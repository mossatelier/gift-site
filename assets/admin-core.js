/**
 * admin-core.js — 后台「纯业务 / 网络 / 数据层」核心。
 *
 * 从 assets/admin.js 抽离而来，零 DOM 操作、零渲染、零 document.getElementById。
 * 供手机版（admin.js）与桌面版复用。挂载为全局对象 window.AdminCore。
 *
 * 非 module（无 import/export），ES2017 语法（async/await + 展开运算符）。
 *
 * 关键解耦：原版 authedFetch / callAdminOrders 在刷新失败时会直接调用 UI 函数
 * （updateAuthUi / updateFormAccess）。Core 不依赖 UI —— 改为：
 *   clearSession() + window.dispatchEvent(new CustomEvent('admin:session-expired'))
 *   然后 throw new Error('登录已过期，请重新登录')。
 * 调用方应监听 'admin:session-expired' 事件来刷新自己的界面。
 */
(function () {
  "use strict";

  var config = window.APP_CONFIG || {};

  // 与 admin.js 复用同一个 localStorage key —— 两个视图共享登录态。
  var SESSION_STORAGE_KEY = "gift-site-admin-session";

  // 图片压缩参数（与 admin.js 保持一致）。
  // ⚠️ 2026-07-30 收紧：原为 1600px/q0.84/仅>650KB才压，导致 910 张图共 150MB、
  // 月出站流量 8GB 撑爆 Supabase 免费版 5GB（服务被 402 停,图片全白）。
  // 现改为 900px/q0.78/>80KB就压 —— 小程序列表每张图实际只显示约 170pt 宽，900px 足够。
  var MAX_PRODUCT_IMAGES = 5;
  var IMAGE_COMPRESS_MAX_EDGE = 900;
  var IMAGE_COMPRESS_QUALITY = 0.78;
  var IMAGE_COMPRESS_MIN_BYTES = 80 * 1024;

  // 内存里的会话镜像。saveSession 时同步写 localStorage。
  var sessionRef = { session: null };

  // ============ 会话 ============

  function getSession() {
    var raw;
    try {
      raw = localStorage.getItem(SESSION_STORAGE_KEY);
    } catch (e) {
      return null;
    }

    if (!raw) {
      return null;
    }

    try {
      return JSON.parse(raw);
    } catch (e) {
      try {
        localStorage.removeItem(SESSION_STORAGE_KEY);
      } catch (e2) {}
      return null;
    }
  }

  function saveSession(session) {
    sessionRef.session = session;

    try {
      if (session) {
        localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
      } else {
        localStorage.removeItem(SESSION_STORAGE_KEY);
      }
    } catch (e) {
      // ignore quota / privacy-mode errors
    }
  }

  function clearSession() {
    saveSession(null);
  }

  // 当前有效会话（内存优先，回退到 localStorage），无 access_token 则视为未登录。
  function activeSession() {
    if (sessionRef.session && sessionRef.session.access_token) {
      return sessionRef.session;
    }
    var stored = getSession();
    if (stored && stored.access_token) {
      sessionRef.session = stored;
      return stored;
    }
    return null;
  }

  // 会话过期统一处理：清会话 + 派发全局事件 + 抛错。
  function notifySessionExpired() {
    clearSession();
    try {
      window.dispatchEvent(new CustomEvent("admin:session-expired"));
    } catch (e) {
      // 老环境兜底
      try {
        var evt = document.createEvent("Event");
        evt.initEvent("admin:session-expired", false, false);
        window.dispatchEvent(evt);
      } catch (e2) {}
    }
    return new Error("登录已过期，请重新登录");
  }

  // ============ 鉴权 ============

  function authHeaders(accessToken, extraHeaders) {
    var base = {
      apikey: config.supabaseAnonKey,
      Authorization: "Bearer " + accessToken
    };
    if (extraHeaders) {
      for (var k in extraHeaders) {
        if (Object.prototype.hasOwnProperty.call(extraHeaders, k)) {
          base[k] = extraHeaders[k];
        }
      }
    }
    return base;
  }

  async function signInWithPassword(email, password) {
    var response = await fetch(config.supabaseUrl + "/auth/v1/token?grant_type=password", {
      method: "POST",
      headers: {
        apikey: config.supabaseAnonKey,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ email: email, password: password })
    });

    var data = await response.json();

    if (!response.ok) {
      throw new Error(data.msg || data.error_description || "登录失败");
    }

    return data;
  }

  async function refreshSession(refreshToken) {
    var response = await fetch(config.supabaseUrl + "/auth/v1/token?grant_type=refresh_token", {
      method: "POST",
      headers: {
        apikey: config.supabaseAnonKey,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ refresh_token: refreshToken })
    });

    var data = await response.json();

    if (!response.ok) {
      throw new Error(data.msg || data.error_description || "会话刷新失败");
    }

    return data;
  }

  async function fetchCurrentUser(accessToken) {
    var response = await fetch(config.supabaseUrl + "/auth/v1/user", {
      headers: authHeaders(accessToken)
    });

    var data = await response.json();

    if (!response.ok) {
      throw new Error(data.msg || data.error_description || "读取当前用户失败");
    }

    return data;
  }

  // 远端登出（清服务端会话）。本地清理由调用方决定（一般 clearSession()）。
  async function signOut(accessToken) {
    var token = accessToken;
    if (!token) {
      var s = activeSession();
      token = s ? s.access_token : null;
    }
    if (!token) {
      return;
    }
    await fetch(config.supabaseUrl + "/auth/v1/logout", {
      method: "POST",
      headers: authHeaders(token)
    });
  }

  async function verifyAdminAccess(accessToken) {
    var response = await fetch(config.supabaseUrl + "/rest/v1/admin_users?select=email&limit=1", {
      headers: authHeaders(accessToken)
    });

    if (!response.ok) {
      var errorText = await response.text();
      throw new Error("管理员验证失败：" + response.status + " " + errorText);
    }

    var data = await response.json();
    if (!Array.isArray(data) || data.length === 0) {
      throw new Error("当前账号不在管理员名单中");
    }
  }

  // ============ 带鉴权的 fetch（Supabase REST / Storage） ============

  async function authedFetch(url, options, extraHeaders) {
    options = options || {};
    extraHeaders = extraHeaders || {};

    var session = activeSession();

    if (!session) {
      throw new Error("请先登录管理员账号");
    }

    var buildOptions = function (token) {
      var opts = {};
      for (var k in options) {
        if (Object.prototype.hasOwnProperty.call(options, k)) {
          opts[k] = options[k];
        }
      }
      opts.headers = authHeaders(token, extraHeaders);
      return opts;
    };

    var response = await fetch(url, buildOptions(session.access_token));

    if (response.status === 401 && session.refresh_token) {
      try {
        var refreshed = await refreshSession(session.refresh_token);
        var user = await fetchCurrentUser(refreshed.access_token);
        session = Object.assign({}, refreshed, { user: user });
        saveSession(session);
      } catch (e) {
        throw notifySessionExpired();
      }

      response = await fetch(url, buildOptions(session.access_token));
    }

    return response;
  }

  // ============ 云函数 admin-orders ============

  async function callAdminOrders(action, payload) {
    payload = payload || {};

    if (!config.adminOrdersUrl) {
      throw new Error("尚未配置 adminOrdersUrl，请在 assets/config.js 填入云函数 HTTP 触发器地址");
    }

    var session = activeSession();
    if (!session) {
      throw new Error("请先登录管理员账号");
    }

    var doFetch = function (token) {
      return fetch(config.adminOrdersUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + token
        },
        body: JSON.stringify(Object.assign({ action: action }, payload))
      });
    };

    var res = await doFetch(session.access_token);

    // token 过期 → 刷新一次重试（与 authedFetch 对 Supabase 的处理一致）
    if (res.status === 401 && session.refresh_token) {
      try {
        var refreshed = await refreshSession(session.refresh_token);
        var user = await fetchCurrentUser(refreshed.access_token);
        session = Object.assign({}, refreshed, { user: user });
        saveSession(session);
      } catch (e) {
        throw notifySessionExpired();
      }
      res = await doFetch(session.access_token);
    }

    var json;
    try {
      json = await res.json();
    } catch (e) {
      throw new Error("返回不是 JSON（HTTP " + res.status + "）");
    }
    if (!res.ok || !json.ok) {
      throw new Error(json && json.error ? json.error : "HTTP " + res.status);
    }
    return json.data;
  }

  // 薄封装：看板统计。
  function getStats(period) {
    return callAdminOrders("stats", { period: period });
  }

  // 薄封装：硬删除订单（清理测试单）。删后数据看板实时重算自动同步。
  function deleteOrder(orderId) {
    return callAdminOrders("delete-order", { orderId: orderId });
  }
  function deleteOrdersBulk(orderIds) {
    return callAdminOrders("delete-orders-bulk", { orderIds: orderIds });
  }

  // ============ 商品（Supabase REST） ============

  function productsEndpoint() {
    return config.supabaseUrl + "/rest/v1/" + config.productsTable;
  }

  /**
   * 读取商品列表，含原 admin.js 的 400 降级逻辑：
   * 首选包含 subcategory/images/description 等列；若库表缺列返回 400，
   * 降级到只取基础列再试一次。
   */
  async function listProducts(opts) {
    opts = opts || {};
    var limit = opts.limit != null ? String(opts.limit) : "1000";

    var fullCols = "id,title,category,subcategory,price,cards_needed,description,image_url,images,sort_order,created_at,is_active";
    // 优先带 deleted 列（软删标记）；列不存在 → 退回不带 deleted 的完整列；再退回精简列。
    var tiers = [
      { select: fullCols + ",deleted", order: "updated_at.desc" },
      { select: fullCols, order: "updated_at.desc" },
      { select: "id,title,category,price,image_url,sort_order,created_at,is_active", order: "created_at.desc" }
    ];

    var response;
    for (var i = 0; i < tiers.length; i += 1) {
      var params = new URLSearchParams({ select: tiers[i].select, order: tiers[i].order, limit: limit });
      response = await authedFetch(productsEndpoint() + "?" + params.toString());
      if (response.ok) {
        var data = await response.json();
        return Array.isArray(data) ? data : [];
      }
      if (response.status !== 400) break; // 非 400（列缺失）不再降级重试
    }

    throw new Error("读取最近商品失败：" + (response ? response.status : "?"));
  }

  async function createProduct(payload) {
    var response = await authedFetch(
      productsEndpoint(),
      { method: "POST", body: JSON.stringify(payload) },
      {
        "Content-Type": "application/json",
        Prefer: "return=representation"
      }
    );

    if (!response.ok) {
      var errorText = await response.text();
      throw new Error("商品写入失败：" + response.status + " " + errorText);
    }

    var data = await response.json();
    return Array.isArray(data) ? data[0] : data;
  }

  // 写 Supabase app_config（upsert，key 为主键）。供 H5 直读（如首页海报 home_banners）。
  async function saveAppConfig(key, value) {
    var response = await authedFetch(
      config.supabaseUrl + "/rest/v1/app_config",
      { method: "POST", body: JSON.stringify({ key: key, value: value, updated_at: new Date().toISOString() }) },
      { "Content-Type": "application/json", Prefer: "resolution=merge-duplicates,return=minimal" }
    );
    if (!response.ok) {
      var errorText = await response.text();
      throw new Error("Supabase 配置写入失败：" + response.status + " " + errorText);
    }
  }

  async function updateProduct(productId, payload) {
    var response = await authedFetch(
      productsEndpoint() + "?id=eq." + encodeURIComponent(productId),
      { method: "PATCH", body: JSON.stringify(payload) },
      {
        "Content-Type": "application/json",
        Prefer: "return=representation"
      }
    );

    if (!response.ok) {
      var errorText = await response.text();
      throw new Error("商品更新失败：" + response.status + " " + errorText);
    }

    var data = await response.json();
    return Array.isArray(data) ? data[0] : data;
  }

  // 软删除：置 deleted=true + 下架（is_active=false），保留行 → 可在「回收站」找回。
  // 同步层已按 is_active 同步，下架后约 5 分钟内小程序端不再展示。
  async function deleteProduct(productId) {
    var response = await authedFetch(
      productsEndpoint() + "?id=eq." + encodeURIComponent(productId),
      { method: "PATCH", body: JSON.stringify({ deleted: true, is_active: false }) },
      { "Content-Type": "application/json", Prefer: "return=representation" }
    );

    if (!response.ok) {
      var errorText = await response.text();
      // deleted 列尚未在 Supabase 建好时给出明确指引（避免误以为删除坏了）。
      if (/deleted/i.test(errorText) && (response.status === 400 || response.status === 404)) {
        throw new Error('删除失败：商品表还没有 deleted 列。请先在 Supabase SQL Editor 执行：\nALTER TABLE products ADD COLUMN deleted boolean NOT NULL DEFAULT false;');
      }
      throw new Error("商品删除失败：" + response.status + " " + errorText);
    }

    var data = await response.json();
    return Array.isArray(data) ? data[0] : data;
  }

  // 找回：清除 deleted 标记并重新上架。
  function restoreProduct(productId) {
    return updateProduct(productId, { deleted: false, is_active: true });
  }

  // 彻底删除（不可恢复）：按显式 id 列表 DELETE。用显式 id 而非 deleted=eq.true 过滤，
  // 即使 RLS / 过滤异常也只会命中已知的回收站条目，绝不会误删整表。返回被删数量。
  async function hardDeleteProducts(ids) {
    if (!Array.isArray(ids)) return 0;
    var clean = ids.map(function (id) { return String(id).trim(); }).filter(Boolean);
    if (clean.length === 0) return 0;

    // 分批删，控制 URL 长度（每个 UUID 约 37 字符，大批量一次拼接会触发 414）。
    var BATCH = 80;
    var total = 0;
    for (var i = 0; i < clean.length; i += BATCH) {
      var inList = clean.slice(i, i + BATCH).map(encodeURIComponent).join(",");
      var response = await authedFetch(
        productsEndpoint() + "?id=in.(" + inList + ")",
        { method: "DELETE" },
        { Prefer: "return=representation" }
      );
      if (!response.ok) {
        var errorText = await response.text();
        throw new Error("彻底删除失败：已删 " + total + " 件，本批 " + response.status + " " + errorText);
      }
      var data = await response.json();
      total += Array.isArray(data) ? data.length : 0;
    }
    return total;
  }

  // 上下架薄封装。
  function setProductActive(productId, isActive) {
    return updateProduct(productId, { is_active: Boolean(isActive) });
  }

  // ============ 图片：压缩 + 上传到 Supabase Storage ============

  function sanitizeFileName(fileName) {
    return String(fileName).replace(/[^a-zA-Z0-9._-]/g, "-").replace(/-+/g, "-");
  }

  function canCompressImage(file) {
    if (!file) {
      return false;
    }

    if (/^image\/(jpeg|png|webp)$/i.test(file.type || "")) {
      return true;
    }

    return /\.(jpe?g|png|webp)$/i.test(file.name || "");
  }

  function compressedImageName(fileName) {
    var baseName = String(fileName || "product-image").replace(/\.[^.]+$/, "");
    return baseName + ".jpg";
  }

  function loadImageFile(file) {
    return new Promise(function (resolve, reject) {
      var image = new Image();
      var objectUrl = URL.createObjectURL(file);

      image.onload = function () {
        URL.revokeObjectURL(objectUrl);
        resolve(image);
      };

      image.onerror = function () {
        URL.revokeObjectURL(objectUrl);
        reject(new Error("图片读取失败，已跳过压缩。"));
      };

      image.src = objectUrl;
    });
  }

  function canvasToBlob(canvas, type, quality) {
    return new Promise(function (resolve) {
      canvas.toBlob(resolve, type, quality);
    });
  }

  /**
   * 压缩图片：超过 1600px 长边缩放、或大于 650KB 时转 JPEG（质量 0.84）。
   * 非图片 / 压缩无收益 / 出错 时原样返回传入的 file。永不 throw。
   */
  async function compressImageFile(file) {
    if (!canCompressImage(file)) {
      return file;
    }

    try {
      var image = await loadImageFile(file);
      var sourceWidth = image.naturalWidth || image.width;
      var sourceHeight = image.naturalHeight || image.height;

      if (!sourceWidth || !sourceHeight) {
        return file;
      }

      var scale = Math.min(1, IMAGE_COMPRESS_MAX_EDGE / Math.max(sourceWidth, sourceHeight));
      var shouldResize = scale < 1;
      var shouldCompress = file.size > IMAGE_COMPRESS_MIN_BYTES;

      if (!shouldResize && !shouldCompress) {
        return file;
      }

      var targetWidth = Math.max(1, Math.round(sourceWidth * scale));
      var targetHeight = Math.max(1, Math.round(sourceHeight * scale));
      var canvas = document.createElement("canvas");
      canvas.width = targetWidth;
      canvas.height = targetHeight;

      var ctx = canvas.getContext("2d", { alpha: false });

      if (!ctx) {
        return file;
      }

      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, targetWidth, targetHeight);
      ctx.drawImage(image, 0, 0, targetWidth, targetHeight);

      var blob = await canvasToBlob(canvas, "image/jpeg", IMAGE_COMPRESS_QUALITY);

      if (!blob || blob.size >= file.size) {
        return file;
      }

      return new File([blob], compressedImageName(file.name), {
        type: "image/jpeg",
        lastModified: Date.now()
      });
    } catch (e) {
      return file;
    }
  }

  // Storage 公开访问 URL。
  function publicUrl(filePath) {
    return config.supabaseUrl + "/storage/v1/object/public/" + config.storageBucket + "/" + filePath;
  }

  // Storage 上传端点（路径段逐个 encodeURIComponent）。
  function encodedPath(filePath) {
    var encoded = filePath.split("/").map(function (segment) {
      return encodeURIComponent(segment);
    }).join("/");
    return config.supabaseUrl + "/storage/v1/object/" + config.storageBucket + "/" + encoded;
  }

  /**
   * 压缩并上传一张图片到 Supabase Storage，返回其公开 URL。
   * 文件名 = 时间戳-清洗后的原名；目录 = config.storageFolder（默认 products）。
   */
  async function uploadImage(file) {
    var uploadTarget = await compressImageFile(file);
    var fileName = Date.now() + "-" + sanitizeFileName(uploadTarget.name);
    var folder = config.storageFolder || "products";
    var filePath = folder + "/" + fileName;

    var response = await authedFetch(
      encodedPath(filePath),
      { method: "POST", body: uploadTarget },
      {
        "Content-Type": uploadTarget.type || "application/octet-stream",
        "x-upsert": "true",
        "cache-control": "max-age=31536000"  // 缓存1年：图内容不变，让浏览器缓存，省 Supabase 出站流量
      }
    );

    if (!response.ok) {
      throw new Error("图片上传失败：" + response.status);
    }

    return publicUrl(filePath);
  }

  // ============ 银行（banks_earn） ============

  async function listBanks() {
    var params = new URLSearchParams({
      select: "id,name,points,sort_order",
      order: "points.desc.nullslast,sort_order.asc"
    });

    var response = await authedFetch(config.supabaseUrl + "/rest/v1/banks_earn?" + params.toString());

    if (!response.ok) {
      var text = await response.text();
      throw new Error("读取失败：" + response.status + " " + text);
    }

    return await response.json();
  }

  async function saveBankPoints(id, points) {
    var response = await authedFetch(
      config.supabaseUrl + "/rest/v1/banks_earn?id=eq." + encodeURIComponent(id),
      { method: "PATCH", body: JSON.stringify({ points: points }) },
      {
        "Content-Type": "application/json",
        Prefer: "return=minimal"
      }
    );

    if (!response.ok) {
      var text = await response.text();
      throw new Error("保存失败：" + response.status + " " + text);
    }
  }

  // ============ 导出 ============

  window.AdminCore = {
    config: config,
    SESSION_STORAGE_KEY: SESSION_STORAGE_KEY,

    // 会话
    getSession: getSession,
    saveSession: saveSession,
    clearSession: clearSession,
    activeSession: activeSession,

    // 鉴权
    authHeaders: authHeaders,
    signInWithPassword: signInWithPassword,
    refreshSession: refreshSession,
    fetchCurrentUser: fetchCurrentUser,
    signOut: signOut,
    verifyAdminAccess: verifyAdminAccess,

    // 网络
    authedFetch: authedFetch,
    callAdminOrders: callAdminOrders,
    getStats: getStats,
    deleteOrder: deleteOrder,
    deleteOrdersBulk: deleteOrdersBulk,

    // 商品
    listProducts: listProducts,
    createProduct: createProduct,
    updateProduct: updateProduct,
    deleteProduct: deleteProduct,
    restoreProduct: restoreProduct,
    hardDeleteProducts: hardDeleteProducts,
    setProductActive: setProductActive,

    // 图片
    compressImageFile: compressImageFile,
    uploadImage: uploadImage,
    publicUrl: publicUrl,
    encodedPath: encodedPath,

    // 银行
    listBanks: listBanks,
    saveBankPoints: saveBankPoints,

    // 通用配置（写 Supabase，供 H5 直读）
    saveAppConfig: saveAppConfig
  };
})();
