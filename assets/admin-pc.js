/**
 * admin-pc.js — 桌面版 Admin Console 的 UI / 交互层。
 *
 * 本阶段实现：登录闭环 + 导航切换 + 数据看板。
 * 所有网络 / 鉴权一律走 window.AdminCore（admin-core.js），这里不重复 fetch / 鉴权。
 *
 * 纯 ES2017，无 import / export。
 */
(function () {
  "use strict";

  var Core = window.AdminCore;

  // ============ DOM 引用 ============

  // 登录视图
  var pcLoginView = document.getElementById("pcLoginView");
  var pcLoginForm = document.getElementById("pcLoginForm");
  var pcLoginEmail = document.getElementById("pcLoginEmail");
  var pcLoginPassword = document.getElementById("pcLoginPassword");
  var pcLoginBtn = document.getElementById("pcLoginBtn");
  var pcLoginMsg = document.getElementById("pcLoginMsg");

  // App 视图外壳
  var pcAppView = document.getElementById("pcAppView");
  var pcClock = document.getElementById("pcClock");
  var pcAccountEmail = document.getElementById("pcAccountEmail");
  var pcLogoutBtn = document.getElementById("pcLogoutBtn");

  // 导航
  var pcNavItems = Array.prototype.slice.call(document.querySelectorAll(".pc-nav-item"));
  var pcPanels = Array.prototype.slice.call(document.querySelectorAll(".pc-panel"));
  var pcBadgeOrders = document.getElementById("pcBadgeOrders");
  var pcBadgePreparing = document.getElementById("pcBadgePreparing");
  var pcBadgeDone = document.getElementById("pcBadgeDone");
  var pcBadgeClosed = document.getElementById("pcBadgeClosed");
  var pcBadgeCancelled = document.getElementById("pcBadgeCancelled");
  var pcBadgeAll = document.getElementById("pcBadgeAll");
  var pcBadgeReviews = document.getElementById("pcBadgeReviews");

  // 数据看板
  var pcStatsPeriod = document.getElementById("pcStatsPeriod");
  var pcStatsRefreshBtn = document.getElementById("pcStatsRefreshBtn");
  var pcStatsClock = document.getElementById("pcStatsClock");
  var pcStatsKpis = document.getElementById("pcStatsKpis");
  var pcStatsBody = document.getElementById("pcStatsBody");
  var pcStatsMsg = document.getElementById("pcStatsMsg");

  // ============ 本地状态 ============

  var state = {
    activePanel: "stats",
    statsPeriod: "today",
    stats: null,
    statsLoadedAt: null,
    statsLoaded: false
  };

  var PERIOD_LABEL = { today: "今日", week: "本周", month: "本月", all: "全部" };

  // ============ 全局 toast（瞬时反馈；持久说明仍用行内 msg） ============
  // 复用 .pc-create-toast 样式；opts.actionText + opts.onAction 可附带「撤销」按钮。
  function toast(text, tone, opts) {
    opts = opts || {};
    var box = document.getElementById("pcToast");
    if (!box) {
      box = document.createElement("div");
      box.id = "pcToast";
      box.className = "pc-create-toast";
      document.body.appendChild(box);
    }
    box.innerHTML = "";
    var span = document.createElement("span");
    span.className = "pc-toast-text";
    span.textContent = text || "";
    box.appendChild(span);
    if (opts.actionText && typeof opts.onAction === "function") {
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "pc-toast-action";
      btn.textContent = opts.actionText;
      btn.addEventListener("click", function () {
        hideToast();
        opts.onAction();
      });
      box.appendChild(btn);
    }
    box.setAttribute("data-tone", tone || "success");
    box.style.pointerEvents = opts.actionText ? "auto" : "none"; // 有「撤销」按钮时才可点
    box.classList.add("pc-create-toast-show");
    if (toast._timer) clearTimeout(toast._timer);
    toast._timer = setTimeout(hideToast, opts.duration || (opts.actionText ? 6000 : 2600));
  }
  function hideToast() {
    var box = document.getElementById("pcToast");
    if (box) box.classList.remove("pc-create-toast-show");
  }

  // 加载失败占位 + 「重试」按钮（避免断网恢复后只能整页刷新而丢未保存内容）。
  function renderLoadError(container, msg, onRetry) {
    if (!container) return;
    container.innerHTML = '<div class="pc-load-error"><p class="pc-empty-text">'
      + escapeHtml(msg || "加载失败") + '</p>'
      + '<button type="button" class="pc-btn-ghost pc-load-retry">重试</button></div>';
    var btn = container.querySelector(".pc-load-retry");
    if (btn && typeof onRetry === "function") btn.addEventListener("click", onRetry);
  }

  // ============ 离开拦截（防误刷新 / 误关页丢未保存内容） ============
  var allowUnload = false; // 主动退出 / 会话过期 reload 时绕过拦截
  function isAdminDirty() {
    if (state.catorderDirty) return true;
    if (state.haibaoDirty) return true;
    if (typeof createFormDirty === "function" && createFormDirty()) return true;
    return false;
  }
  window.addEventListener("beforeunload", function (e) {
    if (allowUnload) return;
    if (isAdminDirty()) {
      e.preventDefault();
      e.returnValue = "";
      return "";
    }
  });

  // ============ 顶栏全局搜索 → 跳到「编辑」面板按关键词过滤 ============
  function globalSearch(term) {
    term = (term || "").trim();
    state.editShowDeleted = false; // 全局搜索一律落到普通商品列表，不进回收站
    activatePanel("edit");
    var input = document.getElementById("pcEditSearch");
    if (input) input.value = term;
    state.editSearch = term;
    state.editPage = 0;
    // 已加载则立即重渲染；未加载时数据到达后的渲染会带上 editSearch。
    if (state.editLoaded && typeof renderEditTable === "function") renderEditTable();
  }

  // ============ 工具 ============

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, function (char) {
      var map = {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        "\"": "&quot;",
        "'": "&#39;"
      };
      return map[char] || char;
    });
  }

  function pad2(n) {
    return String(n).padStart(2, "0");
  }

  function weekChar(d) {
    return ["日", "一", "二", "三", "四", "五", "六"][d.getDay()];
  }

  // 北京时间（UTC+8）的 Date 视图：用 UTC 字段读取偏移后的时间，避免依赖本机时区。
  function beijingNow() {
    var now = new Date();
    return new Date(now.getTime() + (now.getTimezoneOffset() + 480) * 60000);
  }

  // 顶栏时钟：YYYY-MM-DD 周X HH:MM:SS（北京时间）
  function formatTopClock(d) {
    return d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate())
      + " 周" + weekChar(d)
      + " " + pad2(d.getHours()) + ":" + pad2(d.getMinutes()) + ":" + pad2(d.getSeconds());
  }

  // 看板「数据更新于」时间戳（带周几）
  function formatStatsTimestamp(d) {
    if (!d) return "";
    return d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate())
      + " (周" + weekChar(d) + ") "
      + pad2(d.getHours()) + ":" + pad2(d.getMinutes()) + ":" + pad2(d.getSeconds());
  }

  // ============ 视图切换：登录 <-> App ============

  function showLoginView() {
    if (pcAppView) pcAppView.hidden = true;
    if (pcLoginView) pcLoginView.style.display = "";
  }

  function showAppView() {
    if (pcLoginView) pcLoginView.style.display = "none";
    if (pcAppView) pcAppView.hidden = false;
  }

  function setLoginMsg(text, tone) {
    if (!pcLoginMsg) return;
    pcLoginMsg.textContent = text || "";
    if (tone) {
      pcLoginMsg.dataset.tone = tone;
    } else {
      delete pcLoginMsg.dataset.tone;
    }
  }

  // ============ 启动 ============

  function init() {
    bindEvents();
    startClock();

    // 退出 / 会话过期通过 reload 回到登录视图，提示信息经 sessionStorage 传递。
    var notice = null;
    try {
      notice = sessionStorage.getItem("pcAdminNotice");
      if (notice) sessionStorage.removeItem("pcAdminNotice");
    } catch (e) {}

    var session = Core.activeSession();
    if (session) {
      enterApp(session);
    } else {
      showLoginView();
      if (notice) {
        var parts = notice.split("|");
        setLoginMsg(parts[0], parts[1] || null);
      }
    }

    // 会话过期：核心层派发该事件并清掉本地会话 → 整页 reload 彻底清空各模块状态（防换账号串台），回到登录视图。
    window.addEventListener("admin:session-expired", function () {
      try { sessionStorage.setItem("pcAdminNotice", "登录已过期，请重新登录。|error"); } catch (e) {}
      allowUnload = true;
      location.reload();
    });
  }

  // 登录成功 / 已有会话 → 进入 App。
  function enterApp(session) {
    showAppView();

    var email = (session && session.user && session.user.email) || "已登录管理员";
    if (pcAccountEmail) pcAccountEmail.textContent = email;

    // 初始面板：优先用 URL hash（刷新后停留在原面板），hash 非法时回看板。
    var fromHash = (location.hash || "").replace(/^#/, "");
    var validHash = pcPanels.some(function (p) { return p.getAttribute("data-panel") === fromHash; });
    activatePanel(validHash ? fromHash : (state.activePanel || "stats"));

    // 待办角标（不阻塞看板加载）
    loadBadges();
  }

  // ============ 登录 / 退出 ============

  function bindEvents() {
    if (pcLoginForm) {
      pcLoginForm.addEventListener("submit", handleLogin);
    }
    // 记住上次登录邮箱，预填省得手输长邮箱
    try {
      var savedEmail = localStorage.getItem("gift-site-admin-email");
      if (pcLoginEmail && savedEmail && !pcLoginEmail.value) pcLoginEmail.value = savedEmail;
    } catch (e) { /* ignore */ }
    // 显示密码开关
    var pcShowPw = document.getElementById("pcShowPw");
    if (pcShowPw && pcLoginPassword) {
      pcShowPw.addEventListener("change", function () {
        pcLoginPassword.type = pcShowPw.checked ? "text" : "password";
      });
    }
    if (pcLogoutBtn) {
      pcLogoutBtn.addEventListener("click", handleLogout);
    }

    // 导航点击（事件委托到每个 nav item）
    pcNavItems.forEach(function (item) {
      item.addEventListener("click", function (event) {
        event.preventDefault();
        var key = item.getAttribute("data-panel");
        if (!key) return;
        // 订单管理的 4 个入口共用 orders 面板，按 data-orders-status 切筛选
        var ost = item.getAttribute("data-orders-status");
        if (ost && key === "orders") {
          var changed = state.ordersStatus !== ost;
          state.ordersStatus = ost;
          state.ordersPage = 0;
          if (typeof ordersClearSelection === "function") ordersClearSelection();
          activatePanel(key);
          loadOrders(true); // 强制按新状态重拉
          return;
        }
        activatePanel(key);
      });
    });

    // 地址栏 hash 变化（手动改 / 外部链接）→ 切到对应面板（仅登录态、合法面板、且与当前不同）。
    window.addEventListener("hashchange", function () {
      if (!Core.activeSession()) return;
      var k = (location.hash || "").replace(/^#/, "");
      var ok = pcPanels.some(function (p) { return p.getAttribute("data-panel") === k; });
      if (ok && k !== state.activePanel) activatePanel(k);
    });

    // 顶栏全局搜索：回车 → 跳「编辑」面板按词过滤。
    var globalSearchEl = document.getElementById("pcGlobalSearch");
    if (globalSearchEl) {
      globalSearchEl.addEventListener("keydown", function (event) {
        if (event.key === "Enter") {
          event.preventDefault();
          globalSearch(globalSearchEl.value);
        }
      });
    }

    // 看板：周期 chip 切换
    if (pcStatsPeriod) {
      pcStatsPeriod.addEventListener("click", function (event) {
        var chip = event.target.closest("[data-stats-period]");
        if (!chip) return;
        var p = chip.getAttribute("data-stats-period");
        if (!p || p === state.statsPeriod) return;
        state.statsPeriod = p;
        var chips = pcStatsPeriod.querySelectorAll(".pc-stats-chip");
        Array.prototype.forEach.call(chips, function (el) {
          el.classList.toggle("active", el === chip);
        });
        loadStats();
      });
    }

    // 看板：刷新
    if (pcStatsRefreshBtn) {
      pcStatsRefreshBtn.addEventListener("click", function () {
        loadStats();
      });
    }
  }

  function handleLogin(event) {
    event.preventDefault();

    var email = (pcLoginEmail && pcLoginEmail.value || "").trim();
    var password = (pcLoginPassword && pcLoginPassword.value) || "";

    if (!email || !password) {
      setLoginMsg("请输入管理员邮箱和密码。", "error");
      return;
    }

    if (pcLoginBtn) pcLoginBtn.disabled = true;
    setLoginMsg("正在登录并校验管理员权限…", null);

    Core.signInWithPassword(email, password)
      .then(function (grant) {
        return Core.fetchCurrentUser(grant.access_token).then(function (user) {
          var session = Object.assign({}, grant, { user: user });
          return Core.verifyAdminAccess(session.access_token).then(function () {
            return session;
          });
        });
      })
      .then(function (session) {
        Core.saveSession(session);
        try { localStorage.setItem("gift-site-admin-email", email); } catch (e) { /* ignore */ }
        if (pcLoginPassword) pcLoginPassword.value = "";
        setLoginMsg("登录成功。", "success");
        enterApp(session);
      })
      .catch(function (err) {
        Core.clearSession();
        setLoginMsg((err && err.message) || "登录失败", "error");
      })
      .then(function () {
        if (pcLoginBtn) pcLoginBtn.disabled = false;
      });
  }

  function handleLogout() {
    var session = Core.activeSession();
    var token = session ? session.access_token : null;

    var done = function () {
      Core.clearSession();
      // 整页 reload 彻底清空各模块状态（防换账号在旧数据上误操作 / 串台）。
      try { sessionStorage.setItem("pcAdminNotice", "已退出登录。"); } catch (e) {}
      // 清掉 URL hash：重新登录回到默认看板，而非上一会话停留的面板。
      try { history.replaceState(null, "", location.pathname + location.search); } catch (e) {}
      allowUnload = true;
      location.reload();
    };

    // 远端登出失败不应阻塞本地清理。
    Promise.resolve()
      .then(function () {
        if (token) return Core.signOut(token);
      })
      .catch(function () {})
      .then(done);
  }

  // ============ 导航切换 ============

  function activatePanel(key) {
    // 离开「录入」面板且表单有未保存内容时确认（防误切走丢草稿 / 编辑态残留）。
    if (state.activePanel === "create" && key !== "create"
        && typeof createFormDirty === "function" && createFormDirty()) {
      if (!window.confirm("录入表单有未保存的内容，确定离开并放弃？")) {
        return;
      }
      resetCreateForm();
    }
    state.activePanel = key;
    // 写入 URL hash（replaceState 不新增历史项、不滚动），刷新后据此回到原面板。
    try { history.replaceState(null, "", "#" + key); } catch (e) {}

    pcNavItems.forEach(function (item) {
      var samePanel = item.getAttribute("data-panel") === key;
      var ost = item.getAttribute("data-orders-status");
      // 订单管理 4 入口：只高亮与当前筛选一致的那个
      item.classList.toggle("active", samePanel && (!ost || ost === state.ordersStatus));
    });

    pcPanels.forEach(function (panel) {
      panel.hidden = panel.getAttribute("data-panel") !== key;
    });

    if (PANEL_LOADERS[key]) PANEL_LOADERS[key]();
  }

  // 各功能模块把自己的"面板激活时加载"函数注册到这里，
  // 避免每个模块都去改 activatePanel（降低冲突）。
  var PANEL_LOADERS = {
    stats: function () { if (!state.statsLoaded) loadStats(); }
  };

  // ============ 待办角标 ============

  function setBadge(el, total) {
    if (!el) return;
    var n = Number(total) || 0;
    if (n > 0) {
      el.textContent = n > 99 ? "99+" : String(n);
      el.hidden = false;
    } else {
      el.hidden = true;
    }
  }

  function loadBadges() {
    // 四个订单入口各自数量（list 的 total 是该状态全量计数，不受日期影响）
    var badgeJobs = [
      { status: "pending", el: pcBadgeOrders },
      { status: "shipped", el: pcBadgeDone },
      { status: "signed", el: pcBadgeClosed },
      { status: "cancelled", el: pcBadgeCancelled },
      { status: "all", el: pcBadgeAll }
    ];
    badgeJobs.forEach(function (job) {
      Core.callAdminOrders("list", { status: job.status, limit: 1 })
        .then(function (data) {
          if (!job.el) return;
          var n = Number(data && data.total) || 0;
          job.el.textContent = n > 99 ? "99+" : String(n);
          job.el.hidden = false; // 四个入口都常显数量（含 0）
        })
        .catch(function () { /* 角标失败不打扰 */ });
    });
  }

  // ============ 实时时钟（顶栏 + 看板共享一个 tick） ============

  function tickClock() {
    var now = beijingNow();
    if (pcClock) {
      pcClock.textContent = formatTopClock(now);
    }
    if (pcStatsClock) {
      // 看板内 mini 时钟只显示 HH:MM:SS
      pcStatsClock.textContent = pad2(now.getHours()) + ":" + pad2(now.getMinutes()) + ":" + pad2(now.getSeconds());
    }
  }

  function startClock() {
    tickClock();
    setInterval(tickClock, 1000);
  }

  // ============ 数据看板 ============

  function setStatsMsg(text, tone) {
    if (!pcStatsMsg) return;
    pcStatsMsg.textContent = text || "";
    if (tone) {
      pcStatsMsg.dataset.tone = tone;
    } else {
      delete pcStatsMsg.dataset.tone;
    }
  }

  function loadStats() {
    if (!pcStatsKpis) return;

    if (!Core.activeSession()) {
      pcStatsKpis.innerHTML = '<p class="pc-empty-text">请先登录管理员账号。</p>';
      if (pcStatsBody) pcStatsBody.innerHTML = "";
      return;
    }

    pcStatsKpis.innerHTML = '<p class="pc-empty-text">加载中…</p>';
    setStatsMsg("", null);

    Core.getStats(state.statsPeriod)
      .then(function (data) {
        state.stats = data;
        state.statsLoadedAt = beijingNow();
        state.statsLoaded = true;
        renderStats();
      })
      .catch(function (err) {
        renderLoadError(pcStatsKpis, (err && err.message) || "加载失败", function () { loadStats(); });
        if (pcStatsBody) pcStatsBody.innerHTML = "";
      });
  }

  // 同比箭头：绿↑ / 红↓（curr vs prev）
  function renderDelta(curr, prev) {
    if (prev === undefined || prev === null) return "";
    var c = Number(curr) || 0;
    var p = Number(prev) || 0;
    if (p === 0 && c === 0) return '<span class="pc-kpi-delta pc-kpi-delta-flat">—</span>';
    if (p === 0) return '<span class="pc-kpi-delta pc-kpi-delta-up">↑ 新增</span>';
    var pct = Math.round(((c - p) / p) * 100);
    if (pct === 0) return '<span class="pc-kpi-delta pc-kpi-delta-flat">持平</span>';
    var cls = pct > 0 ? "pc-kpi-delta-up" : "pc-kpi-delta-down";
    var arrow = pct > 0 ? "↑" : "↓";
    return '<span class="pc-kpi-delta ' + cls + '">' + arrow + " " + Math.abs(pct) + "%</span>";
  }

  // TOP 榜：requested（申请） / viewed（浏览） / wishlisted（心愿）
  function renderTopList(list, kind) {
    if (!Array.isArray(list) || list.length === 0) {
      return '<p class="pc-empty-text">暂无数据。</p>';
    }
    var unitText = function (p) {
      if (kind === "viewed") return escapeHtml(p.count) + " 次浏览";
      if (kind === "wishlisted") return escapeHtml(p.count) + " 人加心愿";
      return escapeHtml(p.count) + " 次申请 · " + escapeHtml(p.cards || 0) + " 积分";
    };
    return '<div class="pc-stats-top-list">' + list.map(function (p, i) {
      return '<div class="pc-stats-top-item">'
        + '<span class="pc-stats-rank">' + (i + 1) + "</span>"
        + (p.imageUrl ? '<img class="pc-stats-top-img" src="' + escapeHtml(p.imageUrl) + '" alt="">' : "")
        + '<div class="pc-stats-top-body">'
        + '<div class="pc-stats-top-title">' + escapeHtml(p.title) + "</div>"
        + '<div class="pc-stats-top-meta">' + unitText(p) + "</div>"
        + "</div>"
        + "</div>";
    }).join("") + "</div>";
  }

  // 24h 下单时段柱状图（纯 CSS，inline 高度）
  function renderHourlyChart(hourly) {
    var arr = Array.isArray(hourly) ? hourly : new Array(24).fill(0);
    var max = Math.max.apply(null, [1].concat(arr));
    var bars = arr.map(function (v, h) {
      return '<div class="pc-stats-hour">'
        + '<div class="pc-stats-hour-bar-wrap">'
        + '<div class="pc-stats-hour-bar" style="height:' + ((v / max) * 100) + '%" title="' + h + ":00 — " + v + ' 单"></div>'
        + "</div>"
        + '<div class="pc-stats-hour-val">' + (v || "") + "</div>"
        + '<div class="pc-stats-hour-label">' + h + "</div>"
        + "</div>";
    }).join("");
    return '<div class="pc-stats-hours">' + bars + "</div>"
      + '<div class="pc-stats-hours-axis">小时（0-23）</div>';
  }

  // 省份 / 城市分布列表
  function renderRegionList(rows) {
    if (!Array.isArray(rows) || rows.length === 0) {
      return '<p class="pc-empty-text">暂无地址数据。</p>';
    }
    return '<div class="pc-stats-region-list">' + rows.map(function (r, i) {
      return '<div class="pc-stats-region-row">'
        + '<span class="pc-stats-rank">' + (i + 1) + "</span>"
        + '<span class="pc-stats-region-name">' + escapeHtml(r.name) + "</span>"
        + '<span class="pc-stats-region-count">' + escapeHtml(r.count) + " 人</span>"
        + "</div>";
    }).join("") + "</div>";
  }

  function statsCard(title, innerHtml, tag) {
    var head = '<div class="pc-stats-card-title">' + escapeHtml(title)
      + (tag ? ' <span class="pc-stats-card-tag">' + escapeHtml(tag) + "</span>" : "")
      + "</div>";
    return '<div class="pc-stats-card">' + head + innerHtml + "</div>";
  }

  function renderStats() {
    if (!pcStatsKpis || !pcStatsBody) return;

    var s = state.stats;
    if (!s) {
      pcStatsKpis.innerHTML = "";
      pcStatsBody.innerHTML = "";
      return;
    }

    var periodLabel = PERIOD_LABEL[s.period] || s.period;
    var users = s.users || {};
    var orders = s.orders || {};
    var byStatus = orders.byStatus || {};
    var top = Array.isArray(s.topProducts) ? s.topProducts : [];
    var topViewed = Array.isArray(s.topViewed) ? s.topViewed : [];
    var topWishlisted = Array.isArray(s.topWishlisted) ? s.topWishlisted : [];
    var dist = s.addressDistribution || { provinces: [], cities: [], total: 0 };
    var comp = s.comparison;
    var productsNew = (s.products && s.products.newInPeriod) || 0;

    // ===== KPI 卡（写入 #pcStatsKpis）=====
    pcStatsKpis.innerHTML = [
      // 新增用户（带同比）
      '<div class="pc-kpi-card">'
        + '<div class="pc-kpi-label">' + escapeHtml(periodLabel) + "新增用户 " + (comp ? renderDelta(users.newInPeriod, comp.users) : "") + "</div>"
        + '<div class="pc-kpi-value">' + escapeHtml(users.newInPeriod || 0) + "</div>"
        + '<div class="pc-kpi-sub">累计 ' + escapeHtml(users.total || 0) + " 个用户</div>"
        + "</div>",
      // 申请订单（带同比）
      '<div class="pc-kpi-card">'
        + '<div class="pc-kpi-label">' + escapeHtml(periodLabel) + "申请订单 " + (comp ? renderDelta(orders.total, comp.orders) : "") + "</div>"
        + '<div class="pc-kpi-value">' + escapeHtml(orders.total || 0) + "</div>"
        + '<div class="pc-kpi-sub">合计 ' + escapeHtml(orders.totalCards || 0) + " 积分 " + (comp ? renderDelta(orders.totalCards || 0, comp.cards) : "") + "</div>"
        + "</div>",
      // 新上礼品（前三带同比中此项无 prev，按原版不带箭头）
      '<div class="pc-kpi-card">'
        + '<div class="pc-kpi-label">' + escapeHtml(periodLabel) + "新上礼品</div>"
        + '<div class="pc-kpi-value">' + escapeHtml(productsNew) + "</div>"
        + '<div class="pc-kpi-sub">' + (s.period === "all" ? "—" : "周期内 admin 录入数") + "</div>"
        + "</div>",
      // 订单状态分布
      '<div class="pc-kpi-card">'
        + '<div class="pc-kpi-label">订单状态分布</div>'
        + '<div class="pc-stats-status-grid">'
        + '<div class="pc-stats-status-row"><span class="pc-order-status pc-order-status-pending">待发货</span><span>' + escapeHtml(byStatus.pending || 0) + "</span></div>"
        + '<div class="pc-stats-status-row"><span class="pc-order-status pc-order-status-shipped">运输中</span><span>' + escapeHtml(byStatus.shipped || 0) + "</span></div>"
        + '<div class="pc-stats-status-row"><span class="pc-order-status pc-order-status-signed">已签收</span><span>' + escapeHtml(byStatus.signed || 0) + "</span></div>"
        + '<div class="pc-stats-status-row"><span class="pc-order-status pc-order-status-cancelled">已取消</span><span>' + escapeHtml(byStatus.cancelled || 0) + "</span></div>"
        + "</div>"
        + "</div>"
    ].join("");

    // ===== 图表 / 榜单（写入 #pcStatsBody）=====
    var sampleNote = (orders.total || 0) > 1000
      ? '<p class="pc-empty-text" style="margin-top:8px;font-size:12px;">该周期订单数过多（≥1000），TOP 5 / 时段分布基于最近 1000 单聚合。</p>'
      : "";

    pcStatsBody.innerHTML = [
      statsCard(periodLabel + "下单时段分布（24h）", renderHourlyChart(s.hourly)),
      statsCard(periodLabel + "最受申请礼品 TOP 5", renderTopList(top, "requested")),
      statsCard("浏览 TOP 10", renderTopList(topViewed, "viewed"), "累计"),
      // 心愿 TOP 10 暂时隐藏：心愿单仅登录用户上云、数据稀疏（恢复：取消本行注释）
      // statsCard("心愿 TOP 10", renderTopList(topWishlisted, "wishlisted"), "未变现意向"),
      statsCard("省份 TOP 5", renderRegionList(dist.provinces), periodLabel + (dist.total || 0) + " 单"),
      statsCard("城市 TOP 10", renderRegionList(dist.cities))
    ].join("") + sampleNote;

    // 「数据更新于」放到看板内联消息行
    setStatsMsg("数据更新于 " + formatStatsTimestamp(state.statsLoadedAt), null);
  }

  // ============ 编辑礼品（商品列表 / 上下架 / 删除） ============
  //
  // 渲染进 #pcEditPanelBody（html 占位容器）。所有 CRUD 走 AdminCore，
  // 不在此处自写 fetch / 鉴权。前端搜索 + 分类/状态筛选 + 排序 + 50/页分页。

  var EDIT_PAGE_SIZE = 50;

  // 分类下拉来源：config.categories（剔除 all），label 优先用于显示。
  var EDIT_CATEGORIES = (function () {
    var list = (Core.config && Array.isArray(Core.config.categories)) ? Core.config.categories : [];
    return list.filter(function (c) { return c && c.value !== "all"; });
  })();

  function editCategoryLabel(value) {
    for (var i = 0; i < EDIT_CATEGORIES.length; i += 1) {
      if (EDIT_CATEGORIES[i].value === value) return EDIT_CATEGORIES[i].label || value;
    }
    return value || "未分类";
  }

  // 本模块状态挂在共享 state 上（与既有 stats 状态并存，互不影响）。
  state.editProducts = [];      // 原始全量
  state.editSearch = "";        // 搜索关键词
  state.editFilterCat = "all";  // 分类筛选
  state.editFilterStatus = "all"; // 状态筛选 all / active / inactive
  state.editSort = "default";   // default / cards-asc / cards-desc / price-asc / price-desc
  state.editPage = 0;
  state.editPendingId = "";     // 正在执行操作的行（禁用按钮）
  state.editLoaded = false;
  state.editShowDeleted = false; // 「回收站」视图：只看软删商品
  var editSearchTimer = null;

  // 渲染外壳一次（工具栏 + 表格容器 + 分页/消息），后续只重渲染 body。
  function ensureEditShell() {
    var host = document.getElementById("pcEditPanelBody");
    if (!host) return null;
    if (host.getAttribute("data-edit-ready") === "1") return host;

    host.classList.remove("pc-panel-placeholder");
    host.setAttribute("data-edit-ready", "1");

    var catOptions = ['<option value="all">全部分类</option>'].concat(
      EDIT_CATEGORIES.map(function (c) {
        return '<option value="' + escapeHtml(c.value) + '">' + escapeHtml(c.label || c.value) + "</option>";
      })
    ).join("");

    host.innerHTML =
      '<div class="pc-edit-toolbar">'
      + '<input class="pc-edit-search" id="pcEditSearch" type="search" placeholder="搜索标题 / 分类 / 子类 / 描述…" autocomplete="off">'
      + '<select class="pc-edit-select" id="pcEditFilterCat">' + catOptions + "</select>"
      + '<select class="pc-edit-select" id="pcEditFilterStatus">'
      + '<option value="all">全部状态</option>'
      + '<option value="active">已上架</option>'
      + '<option value="inactive">未上架</option>'
      + "</select>"
      + '<span class="pc-edit-count" id="pcEditCount"></span>'
      + '<button class="pc-btn-ghost pc-edit-trash" id="pcEditTrashBtn" type="button">🗑 回收站</button>'
      + '<button class="pc-btn-ghost pc-edit-empty-trash" id="pcEditEmptyTrashBtn" type="button" hidden>清空回收站</button>'
      + '<button class="pc-btn-ghost pc-edit-refresh" id="pcEditRefreshBtn" type="button">刷新</button>'
      + "</div>"
      + '<div class="pc-edit-table-wrap" id="pcEditTableWrap"></div>'
      + '<div class="pc-edit-pager" id="pcEditPager"></div>'
      + '<p class="pc-inline-msg" id="pcEditMsg"></p>';

    // 工具栏交互（一次性绑定）
    var searchEl = document.getElementById("pcEditSearch");
    if (searchEl) {
      searchEl.addEventListener("input", function () {
        if (editSearchTimer) clearTimeout(editSearchTimer);
        editSearchTimer = setTimeout(function () {
          state.editSearch = searchEl.value || "";
          state.editPage = 0;
          renderEditTable();
        }, 300);
      });
    }

    var catEl = document.getElementById("pcEditFilterCat");
    if (catEl) {
      catEl.addEventListener("change", function () {
        state.editFilterCat = catEl.value || "all";
        state.editPage = 0;
        renderEditTable();
      });
    }

    var statusEl = document.getElementById("pcEditFilterStatus");
    if (statusEl) {
      statusEl.addEventListener("change", function () {
        state.editFilterStatus = statusEl.value || "all";
        state.editPage = 0;
        renderEditTable();
      });
    }

    var refreshEl = document.getElementById("pcEditRefreshBtn");
    if (refreshEl) {
      refreshEl.addEventListener("click", function () { loadEditProducts(true); });
    }

    var trashEl = document.getElementById("pcEditTrashBtn");
    if (trashEl) {
      trashEl.addEventListener("click", function () {
        state.editShowDeleted = !state.editShowDeleted;
        state.editPage = 0;
        renderEditTable(); // 内部调用 syncTrashControls() 更新按钮文案/可见性
      });
    }

    var emptyTrashEl = document.getElementById("pcEditEmptyTrashBtn");
    if (emptyTrashEl) {
      emptyTrashEl.addEventListener("click", handleEmptyRecycleBin);
    }

    // 表格区交互（事件委托：排序表头 + 行操作 + 分页）
    var tableWrap = document.getElementById("pcEditTableWrap");
    if (tableWrap) {
      tableWrap.addEventListener("click", handleEditTableClick);
    }
    var pager = document.getElementById("pcEditPager");
    if (pager) {
      pager.addEventListener("click", function (event) {
        var btn = event.target.closest("[data-edit-page]");
        if (!btn || btn.disabled) return;
        var p = Number(btn.getAttribute("data-edit-page"));
        if (!isNaN(p)) {
          state.editPage = p;
          renderEditTable();
        }
      });
    }

    return host;
  }

  function setEditMsg(text, tone) {
    var el = document.getElementById("pcEditMsg");
    if (!el) return;
    el.textContent = text || "";
    if (tone) el.dataset.tone = tone;
    else delete el.dataset.tone;
  }

  // 加载（首次或刷新）。force=true 时无视 editLoaded 重新拉取。
  function loadEditProducts(force) {
    var host = ensureEditShell();
    if (!host) return;

    if (!Core.activeSession()) {
      var wrap0 = document.getElementById("pcEditTableWrap");
      if (wrap0) wrap0.innerHTML = '<p class="pc-empty-text">请先登录管理员账号。</p>';
      var count0 = document.getElementById("pcEditCount");
      if (count0) count0.textContent = "";
      return;
    }

    if (state.editLoaded && !force) {
      // 已加载过且非强制：直接重渲染（切回面板不重复请求）。
      renderEditTable();
      return;
    }

    var wrap = document.getElementById("pcEditTableWrap");
    if (wrap) wrap.innerHTML = '<p class="pc-empty-text">加载中…</p>';
    setEditMsg("", null);

    Core.listProducts({ limit: 1000 })
      .then(function (list) {
        state.editProducts = Array.isArray(list) ? list : [];
        state.editLoaded = true;
        state.editPendingId = "";
        state.editPage = 0;
        renderEditTable();
      })
      .catch(function (err) {
        renderLoadError(wrap, (err && err.message) || "加载失败", function () { loadEditProducts(true); });
        var c = document.getElementById("pcEditCount");
        if (c) c.textContent = "";
      });
  }

  // 应用搜索 + 分类 + 状态筛选，返回过滤后的数组。
  function filteredEditProducts() {
    var keyword = (state.editSearch || "").trim().toLowerCase();
    var cat = state.editFilterCat;
    var status = state.editFilterStatus;

    return state.editProducts.filter(function (item) {
      // 回收站视图只看软删商品；普通视图过滤掉软删商品。
      if (state.editShowDeleted) { if (!item.deleted) return false; }
      else if (item.deleted) return false;
      if (cat !== "all" && item.category !== cat) return false;
      if (status === "active" && !item.is_active) return false;
      if (status === "inactive" && item.is_active) return false;
      if (keyword) {
        var hay = [
          item.title || "",
          editCategoryLabel(item.category),
          item.subcategory || "",
          item.description || ""
        ].join(" ").toLowerCase();
        if (hay.indexOf(keyword) === -1) return false;
      }
      return true;
    });
  }

  // 排序（在过滤后的副本上）。default 保持 listProducts 返回顺序。
  function sortedEditProducts(rows) {
    var s = state.editSort;
    if (s === "default") return rows;
    var copy = rows.slice();
    var cardsOf = function (p) { return Number(p.cards_needed != null ? p.cards_needed : p.price) || 0; };
    var priceOf = function (p) { return Number(p.price) || 0; };
    copy.sort(function (a, b) {
      if (s === "cards-asc") return cardsOf(a) - cardsOf(b);
      if (s === "cards-desc") return cardsOf(b) - cardsOf(a);
      if (s === "price-asc") return priceOf(a) - priceOf(b);
      if (s === "price-desc") return priceOf(b) - priceOf(a);
      return 0;
    });
    return copy;
  }

  // 表头排序指示箭头
  function editSortArrow(field) {
    var s = state.editSort;
    if (field === "cards") {
      if (s === "cards-asc") return " ↑";
      if (s === "cards-desc") return " ↓";
    }
    if (field === "price") {
      if (s === "price-asc") return " ↑";
      if (s === "price-desc") return " ↓";
    }
    return "";
  }

  // 同步「回收站」相关按钮：回收站按钮文案/高亮 + 清空按钮可见性/数量。
  function syncTrashControls() {
    var trashBtn = document.getElementById("pcEditTrashBtn");
    var emptyBtn = document.getElementById("pcEditEmptyTrashBtn");
    var deletedCount = state.editProducts.filter(function (p) { return p.deleted; }).length;
    if (trashBtn) {
      trashBtn.classList.toggle("pc-edit-trash-on", state.editShowDeleted);
      trashBtn.textContent = state.editShowDeleted
        ? "← 返回商品列表"
        : (deletedCount ? "🗑 回收站（" + deletedCount + "）" : "🗑 回收站");
    }
    if (emptyBtn) {
      emptyBtn.hidden = !state.editShowDeleted;
      emptyBtn.disabled = deletedCount === 0 || Boolean(state.editPendingId);
      emptyBtn.textContent = "清空回收站" + (deletedCount ? "（" + deletedCount + "）" : "");
    }
  }

  function renderEditTable() {
    var wrap = document.getElementById("pcEditTableWrap");
    var countEl = document.getElementById("pcEditCount");
    var pagerEl = document.getElementById("pcEditPager");
    if (!wrap) return;
    syncTrashControls();

    if (!state.editLoaded) {
      wrap.innerHTML = '<p class="pc-empty-text">加载中…</p>';
      return;
    }

    var filtered = sortedEditProducts(filteredEditProducts());
    var total = filtered.length;

    if (countEl) countEl.textContent = "共 " + total + " 件";

    if (total === 0) {
      var emptyText = state.editShowDeleted
        ? "回收站是空的。"
        : (state.editProducts.length === 0 ? "数据库里还没有礼品。" : "没有找到匹配的礼品。");
      wrap.innerHTML = '<p class="pc-empty-text">' + emptyText + "</p>";
      if (pagerEl) pagerEl.innerHTML = "";
      return;
    }

    // 分页裁剪
    var pageCount = Math.ceil(total / EDIT_PAGE_SIZE);
    if (state.editPage >= pageCount) state.editPage = pageCount - 1;
    if (state.editPage < 0) state.editPage = 0;
    var start = state.editPage * EDIT_PAGE_SIZE;
    var pageRows = filtered.slice(start, start + EDIT_PAGE_SIZE);

    var head =
      "<thead><tr>"
      + '<th class="pc-edit-col-img">图</th>'
      + '<th class="pc-edit-col-title">标题</th>'
      + '<th class="pc-edit-col-cat">分类 · 子类</th>'
      + '<th class="pc-edit-col-num pc-edit-sortable" data-edit-sort="price">参考价' + editSortArrow("price") + "</th>"
      + '<th class="pc-edit-col-num pc-edit-sortable" data-edit-sort="cards">兑换积分' + editSortArrow("cards") + "</th>"
      + '<th class="pc-edit-col-status">状态</th>'
      + '<th class="pc-edit-col-actions">操作</th>'
      + "</tr></thead>";

    var body = "<tbody>" + pageRows.map(function (item) {
      var id = escapeHtml(item.id || "");
      var pending = state.editPendingId === item.id;
      var cards = Number(item.cards_needed != null ? item.cards_needed : item.price) || 0;
      var price = Number(item.price) || 0;
      var subLabel = item.subcategory ? " · " + escapeHtml(item.subcategory) : "";
      var deletedView = state.editShowDeleted;
      var statusCls = (deletedView || !item.is_active) ? "pc-order-status-cancelled" : "pc-order-status-done";
      var statusLabel = deletedView ? "已删除" : (item.is_active ? "已上架" : "未上架");
      var toggleLabel = item.is_active ? "下架" : "上架";
      // 任意操作在途（含清空回收站的 "__empty__"）时禁用所有行按钮，避免点了被静默吞。
      var disabled = state.editPendingId ? " disabled" : "";
      var img = item.image_url
        ? '<img class="pc-edit-thumb" src="' + escapeHtml(item.image_url) + '" alt="" loading="lazy">'
        : '<span class="pc-edit-thumb pc-edit-thumb-empty"></span>';

      return '<tr class="pc-edit-row" data-edit-row="' + id + '">'
        + '<td class="pc-edit-col-img">' + img + "</td>"
        + '<td class="pc-edit-col-title"><span class="pc-edit-title-text">' + escapeHtml(item.title || "未命名礼品") + "</span></td>"
        + '<td class="pc-edit-col-cat">' + escapeHtml(editCategoryLabel(item.category)) + subLabel + "</td>"
        + '<td class="pc-edit-col-num">' + (price ? "¥" + escapeHtml(price) : "—") + "</td>"
        + '<td class="pc-edit-col-num pc-edit-cards">' + escapeHtml(cards) + " 分</td>"
        + '<td class="pc-edit-col-status"><span class="pc-order-status ' + statusCls + '">' + statusLabel + "</span></td>"
        + '<td class="pc-edit-col-actions">'
        + (deletedView
            ? '<button class="pc-edit-act pc-edit-act-restore" type="button" data-edit-restore="' + id + '"' + disabled + ">恢复</button>"
              + '<button class="pc-edit-act pc-edit-act-harddel" type="button" data-edit-harddel="' + id + '"' + disabled + ">彻底删除</button>"
            : '<button class="pc-edit-act pc-edit-act-edit" type="button" data-edit-edit="' + id + '"' + disabled + ">编辑</button>"
              + '<button class="pc-edit-act pc-edit-act-toggle" type="button" data-edit-toggle="' + id + '"' + disabled + ">" + toggleLabel + "</button>"
              + '<button class="pc-edit-act pc-edit-act-del" type="button" data-edit-del="' + id + '"' + disabled + ">删除</button>")
        + "</td>"
        + "</tr>";
    }).join("") + "</tbody>";

    wrap.innerHTML = '<table class="pc-edit-table">' + head + body + "</table>";

    // 分页
    if (pagerEl) {
      if (pageCount <= 1) {
        pagerEl.innerHTML = "";
      } else {
        var prevDis = state.editPage <= 0 ? " disabled" : "";
        var nextDis = state.editPage >= pageCount - 1 ? " disabled" : "";
        pagerEl.innerHTML =
          '<button class="pc-btn-ghost pc-edit-page-btn" type="button" data-edit-page="' + (state.editPage - 1) + '"' + prevDis + ">上一页</button>"
          + '<span class="pc-edit-page-info">第 ' + (state.editPage + 1) + " / " + pageCount + " 页</span>"
          + '<button class="pc-btn-ghost pc-edit-page-btn" type="button" data-edit-page="' + (state.editPage + 1) + '"' + nextDis + ">下一页</button>";
      }
    }
  }

  // 表格点击委托：排序表头 / 编辑 / 上下架 / 删除
  function handleEditTableClick(event) {
    var sortTh = event.target.closest("[data-edit-sort]");
    if (sortTh) {
      var field = sortTh.getAttribute("data-edit-sort");
      // 三态循环：无 → 降序 → 升序 → 无
      if (field === "cards") {
        state.editSort = state.editSort === "cards-desc" ? "cards-asc"
          : state.editSort === "cards-asc" ? "default" : "cards-desc";
      } else if (field === "price") {
        state.editSort = state.editSort === "price-desc" ? "price-asc"
          : state.editSort === "price-asc" ? "default" : "price-desc";
      }
      renderEditTable();
      return;
    }

    var editBtn = event.target.closest("[data-edit-edit]");
    if (editBtn) {
      handleEditProductEdit(editBtn.getAttribute("data-edit-edit"));
      return;
    }

    var toggleBtn = event.target.closest("[data-edit-toggle]");
    if (toggleBtn) {
      handleEditProductToggle(toggleBtn.getAttribute("data-edit-toggle"));
      return;
    }

    var delBtn = event.target.closest("[data-edit-del]");
    if (delBtn) {
      handleEditProductDelete(delBtn.getAttribute("data-edit-del"));
      return;
    }

    var restoreBtn = event.target.closest("[data-edit-restore]");
    if (restoreBtn) {
      handleEditProductRestore(restoreBtn.getAttribute("data-edit-restore"));
      return;
    }

    var hardDelBtn = event.target.closest("[data-edit-harddel]");
    if (hardDelBtn) {
      handleEditProductHardDelete(hardDelBtn.getAttribute("data-edit-harddel"));
      return;
    }
  }

  function findEditProduct(id) {
    for (var i = 0; i < state.editProducts.length; i += 1) {
      if (state.editProducts[i].id === id) return state.editProducts[i];
    }
    return null;
  }

  // 编辑：跳到「录入礼品」面板并回填（钩子由录入模块暴露为 window.__pcEditProduct）。
  function handleEditProductEdit(id) {
    var p = findEditProduct(id);
    if (!p) { setEditMsg("没有找到要编辑的礼品。", "error"); return; }
    if (typeof window.__pcEditProduct === "function") {
      window.__pcEditProduct(p);
    } else {
      // 录入模块尚未就绪时的兜底（正常情况下不会走到）。
      window.alert("编辑入口暂不可用，请稍后重试。\n\n礼品：" + (p.title || id));
    }
  }

  // 上下架：调 setProductActive，成功后当场切换该行徽标 + 按钮。
  function handleEditProductToggle(id) {
    var p = findEditProduct(id);
    if (!p) { setEditMsg("没有找到要操作的礼品。", "error"); return; }
    if (state.editPendingId) return; // 串行，避免并发误触

    var next = !p.is_active;
    state.editPendingId = id;
    renderEditTable();
    setEditMsg(next ? "正在上架…" : "正在下架…", null);

    Core.setProductActive(id, next)
      .then(function () {
        p.is_active = next;
        state.editPendingId = "";
        renderEditTable();
        setEditMsg(next ? "已上架：" + (p.title || id) : "已下架：" + (p.title || id), "success");
        toast(next ? "已上架：" + (p.title || id) : "已下架：" + (p.title || id), "success");
      })
      .catch(function (err) {
        state.editPendingId = "";
        renderEditTable();
        setEditMsg((err && err.message) || "操作失败", "error");
        toast((err && err.message) || "操作失败", "error");
      });
  }

  // 删除（软删）：二次确认 → deleteProduct（置 deleted+下架）→ 行淡出移出列表 → 「撤销」toast。
  function handleEditProductDelete(id) {
    var p = findEditProduct(id);
    if (!p) { setEditMsg("没有找到要删除的礼品。", "error"); return; }
    if (state.editPendingId) return;

    var ok = window.confirm("确定删除“" + (p.title || "这件礼品") + "”吗？\n将从用户端下架，可在「回收站」找回。");
    if (!ok) return;

    state.editPendingId = id;
    renderEditTable(); // 立即禁用所有行按钮（防并发误触）
    var rowEl = document.querySelector('[data-edit-row="' + (window.CSS && CSS.escape ? CSS.escape(id) : id) + '"]');
    if (rowEl) rowEl.classList.add("pc-edit-row-fading");
    setEditMsg("正在删除…", null);

    Core.deleteProduct(id)
      .then(function () {
        // 标记软删，重渲染后从普通列表淡出（仍保留在内存，回收站可见）。
        var apply = function () {
          p.deleted = true;
          p.is_active = false;
          state.editPendingId = "";
          renderEditTable();
          setEditMsg("已删除：" + (p.title || id) + "（可在「回收站」找回）", "success");
          toast("已删除：" + (p.title || id), "success", {
            actionText: "撤销",
            onAction: function () { handleEditProductRestore(id); }
          });
        };
        if (rowEl) setTimeout(apply, 260);
        else apply();
      })
      .catch(function (err) {
        state.editPendingId = "";
        if (rowEl) rowEl.classList.remove("pc-edit-row-fading");
        renderEditTable();
        setEditMsg((err && err.message) || "删除失败", "error");
        toast((err && err.message) || "删除失败", "error", { duration: 6000 });
      });
  }

  // 找回：清 deleted + 重新上架，重渲染后从回收站移出。
  function handleEditProductRestore(id) {
    var p = findEditProduct(id);
    if (!p) { setEditMsg("没有找到要找回的礼品。", "error"); return; }
    if (state.editPendingId) return;

    state.editPendingId = id;
    renderEditTable(); // 立即禁用所有行按钮
    setEditMsg("正在找回…", null);

    Core.restoreProduct(id)
      .then(function () {
        p.deleted = false;
        p.is_active = true;
        state.editPendingId = "";
        renderEditTable();
        setEditMsg("已找回并上架：" + (p.title || id), "success");
        toast("已找回并上架：" + (p.title || id), "success");
      })
      .catch(function (err) {
        state.editPendingId = "";
        renderEditTable();
        setEditMsg((err && err.message) || "找回失败", "error");
        toast((err && err.message) || "找回失败", "error");
      });
  }

  // 单件彻底删除（不可恢复，从库永久移除）。
  function handleEditProductHardDelete(id) {
    var p = findEditProduct(id);
    if (!p) { setEditMsg("没有找到该礼品。", "error"); return; }
    if (state.editPendingId) return;

    if (!window.confirm("彻底删除“" + (p.title || "这件礼品") + "”？\n将从数据库永久移除，不可恢复、无法找回。")) return;

    hideToast(); // 清掉可能残留的「撤销」toast，避免它指向即将被永久删除的条目
    state.editPendingId = id;
    renderEditTable(); // 立即禁用所有行按钮
    var rowEl = document.querySelector('[data-edit-row="' + (window.CSS && CSS.escape ? CSS.escape(id) : id) + '"]');
    if (rowEl) rowEl.classList.add("pc-edit-row-fading");
    setEditMsg("正在彻底删除…", null);

    Core.hardDeleteProducts([id])
      .then(function () {
        var apply = function () {
          state.editProducts = state.editProducts.filter(function (x) { return x.id !== id; });
          state.editPendingId = "";
          renderEditTable();
          setEditMsg("已彻底删除：" + (p.title || id), "success");
          toast("已彻底删除：" + (p.title || id), "success");
        };
        if (rowEl) setTimeout(apply, 260);
        else apply();
      })
      .catch(function (err) {
        state.editPendingId = "";
        if (rowEl) rowEl.classList.remove("pc-edit-row-fading");
        renderEditTable();
        setEditMsg((err && err.message) || "彻底删除失败", "error");
        toast((err && err.message) || "彻底删除失败", "error", { duration: 6000 });
      });
  }

  // 清空回收站：把所有软删商品一次性彻底删除（按显式 id 列表，绝不误删整表）。
  function handleEmptyRecycleBin() {
    if (state.editPendingId) return;
    var deletedItems = state.editProducts.filter(function (p) { return p.deleted; });
    if (deletedItems.length === 0) { setEditMsg("回收站是空的。", null); return; }

    if (!window.confirm("彻底清空回收站？\n将永久删除 " + deletedItems.length + " 件商品，不可恢复、无法找回。")) return;

    hideToast(); // 清掉可能残留的「撤销」toast，避免它指向即将被永久删除的条目
    var ids = deletedItems.map(function (p) { return p.id; });
    state.editPendingId = "__empty__"; // 占位，阻止并发其它行操作
    renderEditTable(); // 立即让所有行按钮 + 清空按钮进入禁用态
    setEditMsg("正在清空回收站…", null);

    Core.hardDeleteProducts(ids)
      .then(function (n) {
        state.editProducts = state.editProducts.filter(function (p) { return !p.deleted; });
        state.editPendingId = "";
        renderEditTable();
        setEditMsg("已清空回收站，彻底删除 " + (n || ids.length) + " 件。", "success");
        toast("已清空回收站（" + (n || ids.length) + " 件）", "success");
      })
      .catch(function (err) {
        state.editPendingId = "";
        renderEditTable();
        setEditMsg((err && err.message) || "清空失败", "error");
        toast((err && err.message) || "清空失败", "error", { duration: 6000 });
      });
  }

  // 注册面板加载器：首次进入拉取（editLoaded 标记防重复），切回不重复请求。
  PANEL_LOADERS.edit = function () { loadEditProducts(false); };

  // ============ 银行积分（banks_earn） ============
  //
  // 渲染进 #pcBanksPanelBody（html 占位容器）。读取走 Core.listBanks()，
  // 保存走 Core.saveBankPoints(id, points)，不在此处自写 fetch / 鉴权。
  // 设计：说明条 + 刷新 + 紧凑表格（银行名 / 积分 0-10 / “分”）。
  // 输入框 change/blur 自动保存（无保存按钮）；保存中行尾显示状态（保存中 → ✓）；
  // 越界（<0、>10、非整数）行内红字提示且不发请求；保存成功后按积分降序重排。

  state.banks = [];          // 原始数据（按 points 降序展示）
  state.banksLoaded = false; // 防重复拉取标记
  state.banksSavingId = "";  // 正在保存的行 id（避免并发覆盖重排）

  // 银行行排序：积分降序，再按 sort_order 升序兜底（与移动版 / Core 查询一致）。
  function sortBanks() {
    state.banks.sort(function (a, b) {
      return (Number(b.points) || 0) - (Number(a.points) || 0)
        || (Number(a.sort_order) || 100) - (Number(b.sort_order) || 100);
    });
  }

  // 渲染外壳一次（说明条 + 刷新 + 表格容器 + 消息行），后续只重渲染 body。
  function ensureBanksShell() {
    var host = document.getElementById("pcBanksPanelBody");
    if (!host) return null;
    if (host.getAttribute("data-banks-ready") === "1") return host;

    host.classList.remove("pc-panel-placeholder");
    host.setAttribute("data-banks-ready", "1");

    host.innerHTML =
      '<div class="pc-banks-toolbar">'
      + '<p class="pc-banks-note">设置各银行刷卡 / 消费可累积的积分（0-10 分）。修改输入框后自动保存，无需点按钮；按积分从高到低排列。</p>'
      + '<button class="pc-btn-ghost pc-banks-refresh" id="pcBanksRefreshBtn" type="button">刷新</button>'
      + "</div>"
      + '<div class="pc-banks-table-wrap" id="pcBanksTableWrap"></div>'
      + '<p class="pc-inline-msg" id="pcBanksMsg"></p>';

    var refreshEl = document.getElementById("pcBanksRefreshBtn");
    if (refreshEl) {
      refreshEl.addEventListener("click", function () { loadBanks(true); });
    }

    // 表格区交互（事件委托）：输入框 change/blur 自动保存。
    var tableWrap = document.getElementById("pcBanksTableWrap");
    if (tableWrap) {
      var onEdit = function (event) {
        var input = event.target.closest("[data-bank-id]");
        if (!input) return;
        handleBankPointsChange(input);
      };
      tableWrap.addEventListener("change", onEdit);
      tableWrap.addEventListener("blur", onEdit, true); // blur 不冒泡，捕获阶段委托
    }

    return host;
  }

  function setBanksMsg(text, tone) {
    var el = document.getElementById("pcBanksMsg");
    if (!el) return;
    el.textContent = text || "";
    if (tone) el.dataset.tone = tone;
    else delete el.dataset.tone;
  }

  // 加载（首次或刷新）。force=true 时无视 banksLoaded 重新拉取。
  function loadBanks(force) {
    var host = ensureBanksShell();
    if (!host) return;

    var wrap = document.getElementById("pcBanksTableWrap");

    if (!Core.activeSession()) {
      if (wrap) wrap.innerHTML = '<p class="pc-empty-text">请先登录管理员账号。</p>';
      return;
    }

    if (state.banksLoaded && !force) {
      // 已加载过且非强制：直接重渲染（切回面板不重复请求）。
      renderBanksTable();
      return;
    }

    if (wrap) wrap.innerHTML = '<p class="pc-empty-text">加载中…</p>';
    setBanksMsg("", null);

    Core.listBanks()
      .then(function (list) {
        state.banks = Array.isArray(list) ? list : [];
        sortBanks();
        state.banksLoaded = true;
        state.banksSavingId = "";
        renderBanksTable();
      })
      .catch(function (err) {
        renderLoadError(wrap, (err && err.message) || "加载失败", function () { loadBanks(true); });
      });
  }

  function renderBanksTable() {
    var wrap = document.getElementById("pcBanksTableWrap");
    if (!wrap) return;

    if (!state.banksLoaded) {
      wrap.innerHTML = '<p class="pc-empty-text">加载中…</p>';
      return;
    }

    if (!Array.isArray(state.banks) || state.banks.length === 0) {
      wrap.innerHTML = '<p class="pc-empty-text">表中没有银行，请先在 Supabase 里执行 banks-earn-table.sql。</p>';
      return;
    }

    var head =
      "<thead><tr>"
      + '<th class="pc-banks-col-name">银行</th>'
      + '<th class="pc-banks-col-points">积分（0-10）</th>'
      + '<th class="pc-banks-col-state"></th>'
      + "</tr></thead>";

    var body = "<tbody>" + state.banks.map(function (bank) {
      var id = escapeHtml(bank.id || "");
      var points = Number(bank.points) || 0;
      return '<tr class="pc-banks-row" data-banks-row="' + id + '">'
        + '<td class="pc-banks-col-name"><span class="pc-banks-name">' + escapeHtml(bank.name || "未命名银行") + "</span></td>"
        + '<td class="pc-banks-col-points">'
        + '<input class="pc-banks-input" type="number" min="0" max="10" step="1" inputmode="numeric"'
        + ' value="' + escapeHtml(points) + '" data-bank-id="' + id + '">'
        + '<span class="pc-banks-suffix">分</span>'
        + "</td>"
        + '<td class="pc-banks-col-state"><span class="pc-banks-state" data-banks-state="' + id + '"></span></td>'
        + "</tr>";
    }).join("") + "</tbody>";

    wrap.innerHTML = '<table class="pc-banks-table">' + head + body + "</table>";
  }

  // 行尾状态小标（保存中… / ✓ / 错误）。直接定位单元格，避免整表重渲染打断输入焦点。
  function setBankRowState(id, text, tone) {
    var el = document.querySelector('[data-banks-state="' + (window.CSS && CSS.escape ? CSS.escape(id) : id) + '"]');
    if (!el) return;
    el.textContent = text || "";
    if (tone) el.dataset.tone = tone;
    else delete el.dataset.tone;
  }

  // 输入框 change/blur：校验后保存。越界 / 非整数行内红字提示且不发请求。
  function handleBankPointsChange(input) {
    var id = input.getAttribute("data-bank-id");
    if (!id) return;

    var raw = input.value;
    var value = Number(raw);

    // 越界（<0、>10、非整数、空 / 非数字）→ 行内红字，不发请求。
    if (raw === "" || !isFinite(value) || !Number.isInteger(value) || value < 0 || value > 10) {
      setBankRowState(id, "需为 0-10 的整数", "error");
      setBanksMsg("积分必须是 0-10 之间的整数。", "error");
      return;
    }

    var bank = null;
    for (var i = 0; i < state.banks.length; i += 1) {
      if (state.banks[i].id === id) { bank = state.banks[i]; break; }
    }
    if (!bank) return;

    // 未变更则只清状态，不发请求。
    if ((Number(bank.points) || 0) === value) {
      setBankRowState(id, "", null);
      return;
    }

    state.banksSavingId = id;
    setBankRowState(id, "保存中…", null);
    setBanksMsg("正在保存「" + (bank.name || id) + "」…", null);

    Core.saveBankPoints(id, value)
      .then(function () {
        bank.points = value;
        state.banksSavingId = "";
        setBankRowState(id, "✓", "success");
        setBanksMsg("已保存：" + (bank.name || id) + " = " + value + " 分", "success");
        toast("已保存：" + (bank.name || id) + " = " + value + " 分", "success");
        // 保存成功后按积分重排；若顺序变化则重渲染（重渲染会清掉行尾 ✓，可接受）。
        var before = state.banks.slice();
        sortBanks();
        var changed = state.banks.some(function (b, idx) { return b !== before[idx]; });
        if (changed) renderBanksTable();
      })
      .catch(function (err) {
        state.banksSavingId = "";
        setBankRowState(id, "保存失败", "error");
        setBanksMsg((err && err.message) || "保存失败", "error");
        toast((err && err.message) || "保存失败", "error");
      });
  }

  // 注册面板加载器：首次进入拉取（banksLoaded 标记防重复），切回不重复请求。
  PANEL_LOADERS.banks = function () { loadBanks(false); };

  // ============ 分类排序（前台顺序 + 录入下拉顺序） ============
  //
  // 渲染进 #pcCatOrderPanelBody（html 占位容器）。两栏并排：
  //   左栏「📱小程序前台顺序」：存云端。读 callAdminOrders('get-category-order')，
  //     保存 callAdminOrders('save-category-order', { order: [values] })。
  //   右栏「📝后台录入下拉顺序」：存本机 localStorage（与移动版同 key）。
  // 「全部礼品」(all) 概念锁定，不参与排序：分类列表只取实分类。
  // 业务逻辑搬运自移动版 admin.js 的 loadCatOrder / renderCatOrder / orderedInputCategories 等。

  // 录入下拉顺序的 localStorage key —— 与移动版 admin.js 完全一致，两视图共享。
  var CATORDER_INPUT_KEY = "gift-site-admin-input-cat-order";

  // 分类来源：复用编辑模块已计算好的 EDIT_CATEGORIES（已剔除 all），保持单一事实源。
  function catorderRealCategories() {
    return EDIT_CATEGORIES.slice();
  }

  // 读取本机录入顺序（[value, ...]），坏数据兜底为空数组。
  function getInputCatOrder() {
    try {
      var v = JSON.parse(localStorage.getItem(CATORDER_INPUT_KEY) || "[]");
      return Array.isArray(v) ? v : [];
    } catch (e) {
      return [];
    }
  }

  // 按给定的 value 顺序对实分类排序；未出现在 order 里的排到末尾（保持原相对次序）。
  function catorderSortByValues(cats, order) {
    var idx = function (val) {
      var i = order.indexOf(val);
      return i < 0 ? 9999 : i;
    };
    return cats.slice().sort(function (a, b) { return idx(a.value) - idx(b.value); });
  }

  // 本模块状态。catOrder / inputOrder 均为 [{value,label}]（不含 all）。
  state.catOrder = [];          // 左栏：小程序前台顺序（云端）
  state.inputOrder = [];        // 右栏：录入下拉顺序（本机）
  state.catorderDirty = false;  // 左栏未保存脏标
  state.catorderSaving = false; // 左栏保存中（禁用保存按钮）
  state.catorderLoaded = false; // 防重复拉取标记

  // 渲染外壳一次（两栏卡片骨架 + 事件委托），后续只重渲染各列表 body。
  function ensureCatOrderShell() {
    var host = document.getElementById("pcCatOrderPanelBody");
    if (!host) return null;
    if (host.getAttribute("data-catorder-ready") === "1") return host;

    host.classList.remove("pc-panel-placeholder");
    host.setAttribute("data-catorder-ready", "1");

    host.innerHTML =
      '<div class="pc-catorder-grid">'
      // ===== 左栏：小程序前台顺序（云端）=====
      + '<section class="pc-catorder-col">'
      + '<header class="pc-catorder-head">'
      + '<div class="pc-catorder-head-main">'
      + '<h3 class="pc-catorder-title">📱 小程序前台顺序</h3>'
      + '<p class="pc-catorder-note">控制小程序首页分类标签的显示次序（存云端，保存后小程序刷新生效）。</p>'
      + "</div>"
      + '<button class="pc-btn-ghost pc-catorder-refresh" id="pcCatOrderRefreshBtn" type="button">刷新</button>'
      + "</header>"
      + '<div class="pc-catorder-lock">🔒「全部礼品」恒为首位，不参与排序。</div>'
      + '<div class="pc-catorder-list" id="pcCatOrderList"></div>'
      + '<div class="pc-catorder-foot">'
      + '<button class="pc-btn-primary pc-catorder-save" id="pcCatOrderSaveBtn" type="button" disabled>保存到云端</button>'
      + '<span class="pc-inline-msg" id="pcCatOrderMsg"></span>'
      + "</div>"
      + "</section>"
      // ===== 右栏：后台录入下拉顺序（本机）=====
      + '<section class="pc-catorder-col">'
      + '<header class="pc-catorder-head">'
      + '<div class="pc-catorder-head-main">'
      + '<h3 class="pc-catorder-title">📝 后台录入下拉顺序</h3>'
      + '<p class="pc-catorder-note">仅影响本机录入礼品时分类下拉的排列（存本浏览器，常用分类靠前更顺手）。</p>'
      + "</div>"
      + "</header>"
      + '<div class="pc-catorder-list" id="pcInputOrderList"></div>'
      + '<div class="pc-catorder-foot">'
      + '<button class="pc-btn-primary pc-catorder-save" id="pcInputOrderSaveBtn" type="button">保存到本机</button>'
      + '<span class="pc-inline-msg" id="pcInputOrderMsg"></span>'
      + "</div>"
      + "</section>"
      + "</div>";

    // 左栏刷新
    var refreshEl = document.getElementById("pcCatOrderRefreshBtn");
    if (refreshEl) {
      refreshEl.addEventListener("click", function () { loadCatOrder(true); });
    }

    // 左栏列表：↑/↓ 上下移（事件委托）
    var catList = document.getElementById("pcCatOrderList");
    if (catList) {
      catList.addEventListener("click", function (event) {
        var up = event.target.closest("[data-cat-up]");
        var down = event.target.closest("[data-cat-down]");
        if (up) { moveCatOrder(Number(up.getAttribute("data-cat-up")), -1); return; }
        if (down) { moveCatOrder(Number(down.getAttribute("data-cat-down")), 1); return; }
      });
    }

    // 左栏保存
    var saveEl = document.getElementById("pcCatOrderSaveBtn");
    if (saveEl) {
      saveEl.addEventListener("click", saveCatOrder);
    }

    // 右栏列表：↑/↓ 上下移（事件委托）
    var inputList = document.getElementById("pcInputOrderList");
    if (inputList) {
      inputList.addEventListener("click", function (event) {
        var up = event.target.closest("[data-input-up]");
        var down = event.target.closest("[data-input-down]");
        if (up) { moveInputOrder(Number(up.getAttribute("data-input-up")), -1); return; }
        if (down) { moveInputOrder(Number(down.getAttribute("data-input-down")), 1); return; }
      });
    }

    // 右栏保存
    var inputSaveEl = document.getElementById("pcInputOrderSaveBtn");
    if (inputSaveEl) {
      inputSaveEl.addEventListener("click", saveInputOrder);
    }

    return host;
  }

  function setCatOrderMsg(text, tone) {
    var el = document.getElementById("pcCatOrderMsg");
    if (!el) return;
    el.textContent = text || "";
    if (tone) el.dataset.tone = tone;
    else delete el.dataset.tone;
  }

  function setInputOrderMsg(text, tone) {
    var el = document.getElementById("pcInputOrderMsg");
    if (!el) return;
    el.textContent = text || "";
    if (tone) el.dataset.tone = tone;
    else delete el.dataset.tone;
  }

  // 同步左栏保存按钮的可用态（有脏标且非保存中才可点）。
  function syncCatOrderSaveBtn() {
    var btn = document.getElementById("pcCatOrderSaveBtn");
    if (!btn) return;
    btn.disabled = state.catorderSaving || !state.catorderDirty;
    btn.textContent = state.catorderSaving ? "保存中…" : "保存到云端";
  }

  // 渲染一列排序列表（左右共用），kind: "cat" | "input"。
  function renderCatOrderRows(listEl, rows, kind) {
    if (!listEl) return;
    if (!Array.isArray(rows) || rows.length === 0) {
      listEl.innerHTML = '<p class="pc-empty-text">没有可排序的分类。</p>';
      return;
    }
    var upAttr = kind === "cat" ? "data-cat-up" : "data-input-up";
    var downAttr = kind === "cat" ? "data-cat-down" : "data-input-down";
    var last = rows.length - 1;
    listEl.innerHTML = rows.map(function (c, i) {
      var upDis = i === 0 ? " disabled" : "";
      var downDis = i === last ? " disabled" : "";
      return '<div class="pc-catorder-row">'
        + '<span class="pc-catorder-idx">' + (i + 1) + "</span>"
        + '<span class="pc-catorder-name">' + escapeHtml(c.label || c.value) + "</span>"
        + '<span class="pc-catorder-btns">'
        + '<button class="pc-catorder-move" type="button" ' + upAttr + '="' + i + '"' + upDis + ' aria-label="上移">↑</button>'
        + '<button class="pc-catorder-move" type="button" ' + downAttr + '="' + i + '"' + downDis + ' aria-label="下移">↓</button>'
        + "</span>"
        + "</div>";
    }).join("");
  }

  // ----- 左栏：小程序前台顺序（云端） -----

  function loadCatOrder(force) {
    var host = ensureCatOrderShell();
    if (!host) return;

    var listEl = document.getElementById("pcCatOrderList");

    if (!Core.activeSession()) {
      if (listEl) listEl.innerHTML = '<p class="pc-empty-text">请先登录管理员账号。</p>';
      syncCatOrderSaveBtn();
      return;
    }

    if (state.catorderLoaded && !force) {
      // 已加载过且非强制：直接重渲染（切回面板不重复请求，保留未保存的本地调整）。
      renderCatOrderRows(listEl, state.catOrder, "cat");
      syncCatOrderSaveBtn();
      return;
    }

    if (listEl) listEl.innerHTML = '<p class="pc-empty-text">加载中…</p>';
    setCatOrderMsg("", null);

    var real = catorderRealCategories();

    Core.callAdminOrders("get-category-order", {})
      .then(function (data) {
        var order = (data && Array.isArray(data.order)) ? data.order : [];
        state.catOrder = catorderSortByValues(real, order);
        state.catorderLoaded = true;
        state.catorderDirty = false;
        renderCatOrderRows(document.getElementById("pcCatOrderList"), state.catOrder, "cat");
        syncCatOrderSaveBtn();
      })
      .catch(function (err) {
        var el = document.getElementById("pcCatOrderList");
        renderLoadError(el, (err && err.message) || "加载失败", function () { loadCatOrder(true); });
      });
  }

  // 左栏上下移（dir: -1 上 / +1 下），标记脏。
  function moveCatOrder(from, dir) {
    var to = from + dir;
    var arr = state.catOrder;
    if (isNaN(from) || to < 0 || to >= arr.length) return;
    var item = arr.splice(from, 1)[0];
    arr.splice(to, 0, item);
    state.catorderDirty = true;
    renderCatOrderRows(document.getElementById("pcCatOrderList"), arr, "cat");
    syncCatOrderSaveBtn();
    setCatOrderMsg("有未保存的改动。", null);
  }

  function saveCatOrder() {
    if (state.catorderSaving) return;
    if (!Core.activeSession()) {
      setCatOrderMsg("请先登录管理员账号。", "error");
      return;
    }
    state.catorderSaving = true;
    syncCatOrderSaveBtn();
    setCatOrderMsg("保存中…", null);

    var order = state.catOrder.map(function (c) { return c.value; });

    Core.callAdminOrders("save-category-order", { order: order })
      .then(function () {
        state.catorderSaving = false;
        state.catorderDirty = false;
        syncCatOrderSaveBtn();
        setCatOrderMsg("已保存，小程序刷新后按新顺序显示。", "success");
        toast("分类顺序已保存", "success");
      })
      .catch(function (err) {
        state.catorderSaving = false;
        syncCatOrderSaveBtn();
        setCatOrderMsg((err && err.message) || "保存失败", "error");
      });
  }

  // ----- 右栏：后台录入下拉顺序（本机 localStorage） -----

  function loadInputOrder() {
    ensureCatOrderShell();
    state.inputOrder = catorderSortByValues(catorderRealCategories(), getInputCatOrder());
    renderCatOrderRows(document.getElementById("pcInputOrderList"), state.inputOrder, "input");
    setInputOrderMsg("", null);
  }

  function moveInputOrder(from, dir) {
    var to = from + dir;
    var arr = state.inputOrder;
    if (isNaN(from) || to < 0 || to >= arr.length) return;
    var item = arr.splice(from, 1)[0];
    arr.splice(to, 0, item);
    renderCatOrderRows(document.getElementById("pcInputOrderList"), arr, "input");
    setInputOrderMsg("有未保存的改动。", null);
  }

  function saveInputOrder() {
    try {
      localStorage.setItem(CATORDER_INPUT_KEY, JSON.stringify(state.inputOrder.map(function (c) { return c.value; })));
      // 本桌面页若已实现录入模块，会读同一 key；这里仅负责持久化。
      setInputOrderMsg("已保存，录入下拉将按新顺序排列。", "success");
    } catch (err) {
      setInputOrderMsg((err && err.message) || "保存失败", "error");
    }
  }

  // 注册面板加载器：首次进入加载（catorderLoaded 标记防云端重复请求），
  // 切回不重复请求但提供刷新按钮；右栏每次进入都读本机 localStorage（廉价）。
  PANEL_LOADERS.catorder = function () {
    loadCatOrder(false);
    loadInputOrder();
  };

  // ============ 首页海报（home_banners，存云开发 app_config，图传 Supabase Storage） ============
  state.haibanners = [];     // [{imageUrl, linkType, linkValue, title, uploading, error, _file}]
  state.haibaoEpoch = 0;     // 表单代次，作废在途上传孤儿回调
  state.haibaoLoaded = false;
  state.haibaoDirty = false;
  state.haibaoSaving = false;

  var HAIBAO_MAX = 20;
  // 跳转目标白名单（下拉）；product 需另填商品 ID。tab 页用 switchTab、page 用 navigateTo。
  var HAIBAO_LINKS = [
    { type: "none", value: "", label: "不跳转" },
    { type: "tab", value: "/pages/list/list", label: "全部礼品" },
    { type: "tab", value: "/pages/category/category", label: "分类页" },
    { type: "tab", value: "/pages/wishlist/wishlist", label: "心愿单" },
    { type: "product", value: "", label: "指定商品（填商品ID）" }
  ];

  function haibaoLinkIndex(slot) {
    for (var i = 0; i < HAIBAO_LINKS.length; i += 1) {
      var o = HAIBAO_LINKS[i];
      if (o.type === "product" && slot.linkType === "product") return i;
      if (o.type === slot.linkType && o.value === (slot.linkValue || "")) return i;
    }
    return 0;
  }

  function setHaibaoMsg(text, tone) {
    var el = document.getElementById("pcHaibaoMsg");
    if (!el) return;
    el.textContent = text || "";
    if (tone) el.dataset.tone = tone; else delete el.dataset.tone;
  }

  function syncHaibaoSaveBtn() {
    var btn = document.getElementById("pcHaibaoSaveBtn");
    if (!btn) return;
    var uploading = state.haibanners.some(function (s) { return s.uploading; });
    btn.disabled = state.haibaoSaving || uploading || !state.haibaoDirty;
    btn.textContent = state.haibaoSaving ? "保存中…" : "保存到云端";
  }

  function markHaibaoDirty() { state.haibaoDirty = true; syncHaibaoSaveBtn(); }

  function ensureHaibaoShell() {
    var host = document.getElementById("pcHaibaoPanelBody");
    if (!host) return null;
    if (host.getAttribute("data-haibao-ready") === "1") return host;
    host.classList.remove("pc-panel-placeholder");
    host.setAttribute("data-haibao-ready", "1");

    host.innerHTML =
      '<div class="pc-haibao-head">'
      + '<h3 class="pc-haibao-title">首页海报轮播</h3>'
      + '<span class="pc-haibao-hint">上下移调整顺序（第一张最先展示）；建议图片比例 1125×633。保存后小程序下拉刷新或重进首页生效。无海报时小程序显示默认图。</span>'
      + "</div>"
      + '<div class="pc-haibao-list" id="pcHaibaoList"></div>'
      + '<button class="pc-btn-ghost pc-haibao-add" id="pcHaibaoAddBtn" type="button">+ 添加海报</button>'
      + '<div class="pc-haibao-foot"><button class="pc-btn-primary" id="pcHaibaoSaveBtn" type="button">保存到云端</button></div>'
      + '<p class="pc-inline-msg" id="pcHaibaoMsg"></p>';

    var listEl = document.getElementById("pcHaibaoList");
    if (listEl) {
      listEl.addEventListener("click", handleHaibaoClick);
      listEl.addEventListener("change", handleHaibaoChange);
      listEl.addEventListener("input", handleHaibaoInput);
    }
    var addBtn = document.getElementById("pcHaibaoAddBtn");
    if (addBtn) {
      addBtn.addEventListener("click", function () {
        if (state.haibanners.length >= HAIBAO_MAX) { setHaibaoMsg("最多 " + HAIBAO_MAX + " 张。", "error"); return; }
        state.haibanners.push({ imageUrl: "", linkType: "none", linkValue: "", title: "" });
        markHaibaoDirty();
        renderHaibao();
      });
    }
    var saveBtn = document.getElementById("pcHaibaoSaveBtn");
    if (saveBtn) saveBtn.addEventListener("click", saveHaibao);

    return host;
  }

  function renderHaibao() {
    var listEl = document.getElementById("pcHaibaoList");
    if (!listEl) return;
    if (state.haibanners.length === 0) {
      listEl.innerHTML = '<p class="pc-empty-text">还没有海报，点下方「+ 添加海报」开始。无海报时小程序首页显示默认图。</p>';
      syncHaibaoSaveBtn();
      return;
    }
    var last = state.haibanners.length - 1;
    listEl.innerHTML = state.haibanners.map(function (slot, i) {
      var busy = slot.uploading ? " disabled" : "";
      var thumb = slot.imageUrl
        ? '<img class="pc-haibao-thumb" src="' + escapeHtml(slot.imageUrl) + '" alt="">'
        : '<span class="pc-haibao-thumb pc-haibao-thumb-empty">' + (slot.uploading ? "上传中…" : "无图") + "</span>";
      var linkIdx = haibaoLinkIndex(slot);
      var options = HAIBAO_LINKS.map(function (o, oi) {
        return '<option value="' + oi + '"' + (oi === linkIdx ? " selected" : "") + ">" + escapeHtml(o.label) + "</option>";
      }).join("");
      var productInput = slot.linkType === "product"
        ? '<input class="pc-create-input pc-haibao-linkvalue" type="text" placeholder="商品 ID（从「编辑礼品」复制）" value="' + escapeHtml(slot.linkValue || "") + '" data-haibao-linkvalue="' + i + '">'
        : "";
      return '<div class="pc-haibao-row" data-haibao-row="' + i + '">'
        + '<span class="pc-haibao-idx">' + (i + 1) + "</span>"
        + thumb
        + '<div class="pc-haibao-fields">'
        + '<label class="pc-create-img-file-btn pc-haibao-file-btn">选图片<input class="pc-haibao-file" type="file" accept="image/*" data-haibao-file="' + i + '"' + busy + "></label>"
        + '<select class="pc-edit-select pc-haibao-link" data-haibao-link="' + i + '">' + options + "</select>"
        + productInput
        + '<input class="pc-create-input pc-haibao-titleinput" type="text" maxlength="50" placeholder="备注（选填，仅后台可见）" value="' + escapeHtml(slot.title || "") + '" data-haibao-title="' + i + '">'
        + "</div>"
        + '<div class="pc-haibao-acts">'
        + '<button class="pc-edit-act" type="button" data-haibao-move="' + i + '" data-dir="-1"' + (i === 0 ? " disabled" : busy) + ' title="上移">↑</button>'
        + '<button class="pc-edit-act" type="button" data-haibao-move="' + i + '" data-dir="1"' + (i === last ? " disabled" : busy) + ' title="下移">↓</button>'
        + '<button class="pc-edit-act pc-edit-act-del" type="button" data-haibao-del="' + i + '">删除</button>'
        + "</div>"
        + (slot.error ? '<div class="pc-create-img-err pc-haibao-err">' + escapeHtml(slot.error) + (slot._file ? ' <button class="pc-create-img-retry" type="button" data-haibao-retry="' + i + '">重试</button>' : "") + "</div>" : "")
        + "</div>";
    }).join("");
    syncHaibaoSaveBtn();
  }

  function handleHaibaoClick(event) {
    var moveBtn = event.target.closest("[data-haibao-move]");
    if (moveBtn) {
      if (moveBtn.disabled) return;
      var mi = Number(moveBtn.getAttribute("data-haibao-move"));
      var mj = mi + Number(moveBtn.getAttribute("data-dir"));
      if (mj >= 0 && mj < state.haibanners.length) {
        var tmp = state.haibanners[mi];
        state.haibanners[mi] = state.haibanners[mj];
        state.haibanners[mj] = tmp;
        markHaibaoDirty();
        renderHaibao();
      }
      return;
    }
    var delBtn = event.target.closest("[data-haibao-del]");
    if (delBtn) {
      var di = Number(delBtn.getAttribute("data-haibao-del"));
      var s = state.haibanners[di];
      if (s && s.uploading) { setHaibaoMsg("图片上传中，请稍候再删除。", "error"); return; }
      state.haibanners.splice(di, 1);
      markHaibaoDirty();
      renderHaibao();
      return;
    }
    var retryBtn = event.target.closest("[data-haibao-retry]");
    if (retryBtn) {
      var ri = Number(retryBtn.getAttribute("data-haibao-retry"));
      var rs = state.haibanners[ri];
      if (rs && rs._file) uploadHaibaoSlot(ri, rs._file);
      return;
    }
  }

  function handleHaibaoChange(event) {
    var fileInput = event.target.closest("[data-haibao-file]");
    if (fileInput) {
      var fi = Number(fileInput.getAttribute("data-haibao-file"));
      var f = fileInput.files && fileInput.files[0];
      if (f) uploadHaibaoSlot(fi, f);
      return;
    }
    var linkSel = event.target.closest("[data-haibao-link]");
    if (linkSel) {
      var li = Number(linkSel.getAttribute("data-haibao-link"));
      var slot = state.haibanners[li];
      if (!slot) return;
      var opt = HAIBAO_LINKS[Number(linkSel.value)] || HAIBAO_LINKS[0];
      slot.linkType = opt.type;
      slot.linkValue = (opt.type === "product") ? (slot.linkValue || "") : opt.value;
      markHaibaoDirty();
      renderHaibao(); // 切到/离开「指定商品」时显隐商品 ID 输入
      return;
    }
  }

  function handleHaibaoInput(event) {
    var lv = event.target.closest("[data-haibao-linkvalue]");
    if (lv) {
      var i1 = Number(lv.getAttribute("data-haibao-linkvalue"));
      if (state.haibanners[i1]) { state.haibanners[i1].linkValue = (lv.value || "").trim(); markHaibaoDirty(); }
      return;
    }
    var tt = event.target.closest("[data-haibao-title]");
    if (tt) {
      var i2 = Number(tt.getAttribute("data-haibao-title"));
      if (state.haibanners[i2]) { state.haibanners[i2].title = tt.value || ""; markHaibaoDirty(); }
      return;
    }
  }

  // 上传单张海报（epoch 守卫：load/重置后作废在途结果）。
  function uploadHaibaoSlot(i, file) {
    var slot = state.haibanners[i];
    if (!slot || !file) return;
    if (!Core.activeSession()) { setHaibaoMsg("请先登录管理员账号。", "error"); return; }
    var epoch = state.haibaoEpoch;
    slot.uploading = true; slot.error = ""; slot._file = file;
    renderHaibao();
    setHaibaoMsg("正在上传图片…", null);
    Core.uploadImage(file)
      .then(function (url) {
        if (epoch !== state.haibaoEpoch) return;
        slot.imageUrl = url; slot.uploading = false; slot.error = ""; slot._file = null;
        markHaibaoDirty();
        renderHaibao();
        setHaibaoMsg("图片已上传。", "success");
      })
      .catch(function (err) {
        if (epoch !== state.haibaoEpoch) return;
        slot.uploading = false; slot.error = (err && err.message) || "上传失败";
        renderHaibao();
        setHaibaoMsg("图片上传失败，可点该行「重试」。", "error");
      });
  }

  function loadHaibao(force) {
    var host = ensureHaibaoShell();
    if (!host) return;
    if (!Core.activeSession()) {
      var l0 = document.getElementById("pcHaibaoList");
      if (l0) l0.innerHTML = '<p class="pc-empty-text">请先登录管理员账号。</p>';
      return;
    }
    if (state.haibaoLoaded && !force) { renderHaibao(); return; }
    var listEl = document.getElementById("pcHaibaoList");
    if (listEl) listEl.innerHTML = '<p class="pc-empty-text">加载中…</p>';
    setHaibaoMsg("", null);
    Core.callAdminOrders("get-home-banners", {})
      .then(function (data) {
        var arr = (data && Array.isArray(data.banners)) ? data.banners : [];
        state.haibanners = arr.map(function (b) {
          return { imageUrl: b.imageUrl || "", linkType: b.linkType || "none", linkValue: b.linkValue || "", title: b.title || "" };
        });
        state.haibaoLoaded = true;
        state.haibaoEpoch += 1; // 作废任何在途上传
        state.haibaoDirty = false;
        renderHaibao();
      })
      .catch(function (err) {
        renderLoadError(document.getElementById("pcHaibaoList"), (err && err.message) || "加载失败", function () { loadHaibao(true); });
      });
  }

  function saveHaibao() {
    if (state.haibaoSaving) return;
    if (!Core.activeSession()) { setHaibaoMsg("请先登录管理员账号。", "error"); return; }
    if (state.haibanners.some(function (s) { return s.uploading; })) { setHaibaoMsg("还有图片在上传，请稍候。", "error"); return; }
    if (state.haibanners.some(function (s) { return s.linkType === "product" && !(s.linkValue || "").trim(); })) {
      setHaibaoMsg("「指定商品」的海报需填写商品 ID。", "error"); return;
    }
    var payload = state.haibanners
      .filter(function (s) { return s.imageUrl; })
      .map(function (s) { return { imageUrl: s.imageUrl, linkType: s.linkType || "none", linkValue: s.linkValue || "", title: s.title || "" }; });
    state.haibaoSaving = true; syncHaibaoSaveBtn();
    setHaibaoMsg("保存中…", null);
    Core.callAdminOrders("save-home-banners", { banners: payload })
      .then(function () {
        // 同时写 Supabase，供 H5 网页端读取（写失败不影响小程序，仅提示）。
        return Core.saveAppConfig("home_banners", payload).catch(function (err) {
          toast("小程序已更新；网页端同步失败：" + ((err && err.message) || ""), "error");
        });
      })
      .then(function () {
        state.haibaoSaving = false; state.haibaoDirty = false; syncHaibaoSaveBtn();
        setHaibaoMsg("已保存，小程序下拉刷新 / H5 刷新即可看到。", "success");
        toast("首页海报已保存（小程序 + 网页端）", "success");
      })
      .catch(function (err) {
        state.haibaoSaving = false; syncHaibaoSaveBtn();
        setHaibaoMsg((err && err.message) || "保存失败", "error");
        toast((err && err.message) || "保存失败", "error");
      });
  }

  PANEL_LOADERS.haibao = function () { loadHaibao(false); };

  // ============ 积分档银行（cards_bank_labels；云开发 app_config + Supabase app_config 双写） ============
  var CARDBANK_BUCKETS = [
    { key: "6", label: "6分" },
    { key: "7", label: "7分" },
    { key: "8", label: "8分" },
    { key: "9-10", label: "9-10分" },
    { key: "11+", label: "11分以上" }
  ];
  var CARDBANK_DEFAULT = { "6": "交通银行", "7": "浦发银行", "8": "平安/中信银行", "9-10": "", "11+": "全" };
  state.cardbankLoaded = false;
  state.cardbankSaving = false;

  function setCardBankMsg(text, tone) {
    var el = document.getElementById("pcCardBankMsg");
    if (!el) return;
    el.textContent = text || "";
    if (tone) el.dataset.tone = tone; else delete el.dataset.tone;
  }

  function ensureCardBanksShell() {
    var host = document.getElementById("pcCardBanksPanelBody");
    if (!host) return null;
    if (host.getAttribute("data-cardbank-ready") === "1") return host;
    host.classList.remove("pc-panel-placeholder");
    host.setAttribute("data-cardbank-ready", "1");
    host.innerHTML =
      '<div class="pc-haibao-head">'
      + '<h3 class="pc-haibao-title">积分档对应银行</h3>'
      + '<span class="pc-haibao-hint">首页「按积分快速兑换」每个档位下方显示的银行名。留空则该档不显示银行。保存后小程序下拉刷新 / H5 刷新生效。</span>'
      + "</div>"
      + '<div class="pc-cardbank-list" id="pcCardBankList"></div>'
      + '<div class="pc-haibao-foot"><button class="pc-btn-primary" id="pcCardBankSaveBtn" type="button">保存到云端</button></div>'
      + '<p class="pc-inline-msg" id="pcCardBankMsg"></p>';
    var saveBtn = document.getElementById("pcCardBankSaveBtn");
    if (saveBtn) saveBtn.addEventListener("click", saveCardBanks);
    return host;
  }

  function renderCardBanks(labels) {
    var listEl = document.getElementById("pcCardBankList");
    if (!listEl) return;
    listEl.innerHTML = CARDBANK_BUCKETS.map(function (b) {
      var v = (labels && labels[b.key] != null) ? labels[b.key] : "";
      return '<div class="pc-cardbank-row">'
        + '<span class="pc-cardbank-points">' + escapeHtml(b.label) + "</span>"
        + '<input class="pc-create-input pc-cardbank-input" type="text" maxlength="30" placeholder="银行名（留空则不显示）" value="' + escapeHtml(v) + '" data-cardbank-key="' + escapeHtml(b.key) + '">'
        + "</div>";
    }).join("");
  }

  function loadCardBanks(force) {
    var host = ensureCardBanksShell();
    if (!host) return;
    var listEl = document.getElementById("pcCardBankList");
    if (!Core.activeSession()) {
      if (listEl) listEl.innerHTML = '<p class="pc-empty-text">请先登录管理员账号。</p>';
      return;
    }
    if (state.cardbankLoaded && !force) return;
    if (listEl) listEl.innerHTML = '<p class="pc-empty-text">加载中…</p>';
    setCardBankMsg("", null);
    Core.callAdminOrders("get-cards-bank-labels", {})
      .then(function (data) {
        var labels = (data && data.labels && typeof data.labels === "object") ? data.labels : CARDBANK_DEFAULT;
        state.cardbankLoaded = true;
        renderCardBanks(labels);
      })
      .catch(function (err) {
        renderLoadError(listEl, (err && err.message) || "加载失败", function () { loadCardBanks(true); });
      });
  }

  function saveCardBanks() {
    if (state.cardbankSaving) return;
    if (!Core.activeSession()) { setCardBankMsg("请先登录管理员账号。", "error"); return; }
    var inputs = document.querySelectorAll("[data-cardbank-key]");
    var labels = {};
    for (var i = 0; i < inputs.length; i += 1) {
      var inp = inputs[i];
      labels[inp.getAttribute("data-cardbank-key")] = (inp.value || "").trim().slice(0, 30);
    }
    var btn = document.getElementById("pcCardBankSaveBtn");
    state.cardbankSaving = true;
    if (btn) { btn.disabled = true; btn.textContent = "保存中…"; }
    setCardBankMsg("保存中…", null);
    Core.callAdminOrders("save-cards-bank-labels", { labels: labels })
      .then(function () {
        // 同时写 Supabase，供 H5 网页端读取（写失败不影响小程序，仅提示）。
        return Core.saveAppConfig("cards_bank_labels", labels).catch(function (err) {
          toast("小程序已更新；网页端同步失败：" + ((err && err.message) || ""), "error");
        });
      })
      .then(function () {
        state.cardbankSaving = false;
        if (btn) { btn.disabled = false; btn.textContent = "保存到云端"; }
        setCardBankMsg("已保存，小程序下拉刷新 / H5 刷新即可看到。", "success");
        toast("积分档银行已保存（小程序 + 网页端）", "success");
      })
      .catch(function (err) {
        state.cardbankSaving = false;
        if (btn) { btn.disabled = false; btn.textContent = "保存到云端"; }
        setCardBankMsg((err && err.message) || "保存失败", "error");
        toast((err && err.message) || "保存失败", "error");
      });
  }

  PANEL_LOADERS.cardbanks = function () { loadCardBanks(false); };

  // ============ 晒图审核（reviews） ============
  //
  // 渲染进 #pcReviewsPanelBody（html 占位容器）。读取走
  // Core.callAdminOrders('list-reviews', { status, limit })，处理走
  // Core.callAdminOrders('review-status', { reviewId, status })，不在此处自写 fetch / 鉴权。
  // 设计：工具栏（状态筛选 chip + 刷新 + 计数）+ 响应式网格卡（每条晒图一张卡）+ 点缩略图开灯箱。
  // 业务逻辑搬运自移动版 admin.js 的 loadReviews / renderReviews / moderateReview。

  var REVIEW_STATUS_LABEL = { pending: "待审核", approved: "已通过", rejected: "已拒绝" };
  var REVIEW_STATUS_TABS = [
    { value: "pending", label: "待审核" },
    { value: "approved", label: "已通过" },
    { value: "rejected", label: "已拒绝" },
    { value: "all", label: "全部" }
  ];

  state.reviews = [];            // 当前筛选下的列表
  state.reviewsStatus = "pending"; // 状态筛选
  state.reviewsTotal = 0;        // 计数
  state.reviewsLoaded = false;   // 防重复拉取标记
  state.reviewsPendingId = "";   // 正在处理的卡 id（避免并发误触）

  // 统一取每条晒图的唯一 id（云端可能用 _id 或 id）。
  function reviewId(r) {
    return (r && (r._id || r.id)) || "";
  }

  // 晒图日期：YYYY-MM-DD HH:MM（本机时区即可，与移动版一致）。
  function formatReviewDate(d) {
    if (!d) return "";
    try {
      var date = new Date(d);
      if (isNaN(date.getTime())) return "";
      return date.getFullYear() + "-" + pad2(date.getMonth() + 1) + "-" + pad2(date.getDate())
        + " " + pad2(date.getHours()) + ":" + pad2(date.getMinutes());
    } catch (e) {
      return "";
    }
  }

  // 金色星级（实心 ★ + 空心 ☆，凑满 5 颗）。
  function reviewStarsHtml(rating) {
    var n = Math.max(0, Math.min(5, Math.round(Number(rating) || 0)));
    var solid = new Array(n + 1).join("★");
    var hollow = new Array(5 - n + 1).join("☆");
    return '<span class="pc-reviews-stars">'
      + '<span class="pc-reviews-stars-on">' + solid + "</span>"
      + '<span class="pc-reviews-stars-off">' + hollow + "</span>"
      + "</span>";
  }

  // 渲染外壳一次（工具栏 + 网格容器 + 消息行 + 灯箱），后续只重渲染网格。
  function ensureReviewsShell() {
    var host = document.getElementById("pcReviewsPanelBody");
    if (!host) return null;
    if (host.getAttribute("data-reviews-ready") === "1") return host;

    host.classList.remove("pc-panel-placeholder");
    host.setAttribute("data-reviews-ready", "1");

    var tabs = REVIEW_STATUS_TABS.map(function (t) {
      var active = t.value === state.reviewsStatus ? " active" : "";
      return '<button class="pc-reviews-chip' + active + '" type="button" data-reviews-status="'
        + escapeHtml(t.value) + '">' + escapeHtml(t.label) + "</button>";
    }).join("");

    host.innerHTML =
      '<div class="pc-reviews-toolbar">'
      + '<div class="pc-reviews-tabs" id="pcReviewsTabs">' + tabs + "</div>"
      + '<span class="pc-reviews-count" id="pcReviewsCount"></span>'
      + '<button class="pc-btn-ghost pc-reviews-refresh" id="pcReviewsRefreshBtn" type="button">刷新</button>'
      + "</div>"
      + '<div class="pc-reviews-grid" id="pcReviewsGrid"></div>'
      + '<p class="pc-inline-msg" id="pcReviewsMsg"></p>'
      + '<div class="pc-reviews-lightbox" id="pcReviewsLightbox" hidden>'
      + '<button class="pc-reviews-lb-close" id="pcReviewsLbClose" type="button" aria-label="关闭">×</button>'
      + '<button class="pc-reviews-lb-nav pc-reviews-lb-prev" id="pcReviewsLbPrev" type="button" aria-label="上一张">‹</button>'
      + '<img class="pc-reviews-lb-img" id="pcReviewsLbImg" src="" alt="">'
      + '<button class="pc-reviews-lb-nav pc-reviews-lb-next" id="pcReviewsLbNext" type="button" aria-label="下一张">›</button>'
      + '<span class="pc-reviews-lb-counter" id="pcReviewsLbCounter"></span>'
      + "</div>";

    // 状态筛选 chip 切换
    var tabsEl = document.getElementById("pcReviewsTabs");
    if (tabsEl) {
      tabsEl.addEventListener("click", function (event) {
        var chip = event.target.closest("[data-reviews-status]");
        if (!chip) return;
        var s = chip.getAttribute("data-reviews-status");
        if (!s || s === state.reviewsStatus) return;
        state.reviewsStatus = s;
        Array.prototype.forEach.call(tabsEl.querySelectorAll(".pc-reviews-chip"), function (el) {
          el.classList.toggle("active", el === chip);
        });
        loadReviews(true);
      });
    }

    // 刷新
    var refreshEl = document.getElementById("pcReviewsRefreshBtn");
    if (refreshEl) {
      refreshEl.addEventListener("click", function () { loadReviews(true); });
    }

    // 网格区交互（事件委托）：缩略图开灯箱 / 通过 / 拒绝
    var grid = document.getElementById("pcReviewsGrid");
    if (grid) {
      grid.addEventListener("click", handleReviewsGridClick);
    }

    // 灯箱交互
    bindReviewLightbox();

    return host;
  }

  function setReviewsMsg(text, tone) {
    var el = document.getElementById("pcReviewsMsg");
    if (!el) return;
    el.textContent = text || "";
    if (tone) el.dataset.tone = tone;
    else delete el.dataset.tone;
  }

  // 加载（首次或刷新）。force=true 时无视 reviewsLoaded 重新拉取（切状态 / 点刷新）。
  function loadReviews(force) {
    var host = ensureReviewsShell();
    if (!host) return;

    var grid = document.getElementById("pcReviewsGrid");
    var countEl = document.getElementById("pcReviewsCount");

    if (!Core.activeSession()) {
      if (grid) grid.innerHTML = '<p class="pc-empty-text">请先登录管理员账号。</p>';
      if (countEl) countEl.textContent = "";
      return;
    }

    if (state.reviewsLoaded && !force) {
      // 已加载过且非强制：直接重渲染（切回面板不重复请求）。
      renderReviews();
      return;
    }

    if (grid) grid.innerHTML = '<p class="pc-empty-text">加载中…</p>';
    setReviewsMsg("", null);

    Core.callAdminOrders("list-reviews", { status: state.reviewsStatus, limit: 100 })
      .then(function (data) {
        state.reviews = (data && Array.isArray(data.items)) ? data.items : [];
        state.reviewsTotal = (data && data.total) || 0;
        state.reviewsLoaded = true;
        state.reviewsPendingId = "";
        renderReviews();
      })
      .catch(function (err) {
        renderLoadError(grid, (err && err.message) || "加载失败", function () { loadReviews(true); });
        if (countEl) countEl.textContent = "";
      });
  }

  function renderReviews() {
    var grid = document.getElementById("pcReviewsGrid");
    var countEl = document.getElementById("pcReviewsCount");
    if (!grid) return;

    if (countEl) countEl.textContent = "共 " + (state.reviewsTotal || 0) + " 条";

    if (!Array.isArray(state.reviews) || state.reviews.length === 0) {
      grid.innerHTML = '<p class="pc-empty-text">没有符合条件的晒图。</p>';
      return;
    }

    grid.innerHTML = state.reviews.map(function (r) {
      var id = escapeHtml(reviewId(r));
      var imgs = Array.isArray(r.imageUrls) ? r.imageUrls.filter(Boolean) : [];
      var statusCls = r.status === "approved" ? "pc-order-status-done"
        : (r.status === "rejected" ? "pc-order-status-cancelled" : "pc-order-status-pending");
      var statusLabel = REVIEW_STATUS_LABEL[r.status] || r.status || "";
      var nick = escapeHtml(r.nickName || "微信用户");
      var avatarChar = escapeHtml((r.nickName || "微").slice(0, 1));
      var pending = reviewId(r) && state.reviewsPendingId === reviewId(r);
      var disabled = pending ? " disabled" : "";

      var thumbs = imgs.length
        ? '<div class="pc-reviews-thumbs">' + imgs.map(function (u, i) {
            return '<button class="pc-reviews-thumb" type="button" data-review-img="' + id + '" data-review-img-idx="' + i + '">'
              + '<img src="' + escapeHtml(u) + '" alt="" loading="lazy">'
              + "</button>";
          }).join("") + "</div>"
        : "";

      var actions = "";
      if (r.status !== "approved") {
        actions += '<button class="pc-reviews-act pc-reviews-act-approve" type="button" data-review-approve="' + id + '"' + disabled + ">通过</button>";
      }
      if (r.status !== "rejected") {
        actions += '<button class="pc-reviews-act pc-reviews-act-reject" type="button" data-review-reject="' + id + '"' + disabled + ">拒绝</button>";
      }

      return '<article class="pc-reviews-card" data-review-card="' + id + '">'
        + '<header class="pc-reviews-card-head">'
        + '<span class="pc-reviews-avatar" aria-hidden="true">' + avatarChar + "</span>"
        + '<div class="pc-reviews-head-main">'
        + '<span class="pc-reviews-nick">' + nick + "</span>"
        + reviewStarsHtml(r.rating)
        + "</div>"
        + '<span class="pc-order-status ' + statusCls + '">' + escapeHtml(statusLabel) + "</span>"
        + "</header>"
        + (r.productTitle ? '<div class="pc-reviews-product">🎁 ' + escapeHtml(r.productTitle) + "</div>" : "")
        + (r.content ? '<div class="pc-reviews-content">' + escapeHtml(r.content) + "</div>" : "")
        + thumbs
        + '<footer class="pc-reviews-card-foot">'
        + '<span class="pc-reviews-date">' + escapeHtml(formatReviewDate(r.createdAt)) + "</span>"
        + '<span class="pc-reviews-actions">' + actions + "</span>"
        + "</footer>"
        + "</article>";
    }).join("");
  }

  // 网格点击委托：缩略图开灯箱 / 通过 / 拒绝
  function handleReviewsGridClick(event) {
    var thumb = event.target.closest("[data-review-img]");
    if (thumb) {
      var rid = thumb.getAttribute("data-review-img");
      var idx = Number(thumb.getAttribute("data-review-img-idx")) || 0;
      openReviewLightbox(rid, idx);
      return;
    }

    var approveBtn = event.target.closest("[data-review-approve]");
    if (approveBtn) {
      if (approveBtn.disabled) return;
      if (window.confirm("确认通过这条晒图？通过后将对所有用户公开可见。")) {
        moderateReview(approveBtn.getAttribute("data-review-approve"), "approved");
      }
      return;
    }

    var rejectBtn = event.target.closest("[data-review-reject]");
    if (rejectBtn) {
      if (rejectBtn.disabled) return;
      var rid2 = rejectBtn.getAttribute("data-review-reject");
      if (window.confirm("确认拒绝这条晒图？拒绝后用户端不可见。")) {
        moderateReview(rid2, "rejected");
      }
      return;
    }
  }

  function findReview(id) {
    for (var i = 0; i < state.reviews.length; i += 1) {
      if (reviewId(state.reviews[i]) === id) return state.reviews[i];
    }
    return null;
  }

  // 通过 / 拒绝：调 review-status，成功后该卡淡出移除（或当 all 视图时仅更新徽标）。
  function moderateReview(id, status) {
    if (!id) return;
    if (state.reviewsPendingId) return; // 串行
    var review = findReview(id);
    if (!review) { setReviewsMsg("没有找到要处理的晒图。", "error"); return; }

    var prevStatus = review.status;   // 供「撤销」回退
    state.reviewsPendingId = id;
    // 仅禁用当前卡按钮，不整网格重渲染（保留其它卡的滚动位置）。
    var card = document.querySelector('[data-review-card="' + (window.CSS && CSS.escape ? CSS.escape(id) : id) + '"]');
    if (card) {
      Array.prototype.forEach.call(card.querySelectorAll(".pc-reviews-act"), function (b) { b.disabled = true; });
    }
    setReviewsMsg("处理中…", null);

    Core.callAdminOrders("review-status", { reviewId: id, status: status })
      .then(function () {
        review.status = status;
        state.reviewsPendingId = "";
        // 当前按某状态筛选、且处理后状态不再匹配 → 该卡淡出移除；否则就地更新徽标/按钮。
        var shouldRemove = state.reviewsStatus !== "all" && state.reviewsStatus !== status;
        if (shouldRemove && card) {
          card.classList.add("pc-reviews-card-fading");
          var remove = function () {
            state.reviews = state.reviews.filter(function (x) { return reviewId(x) !== id; });
            if (state.reviewsTotal > 0) state.reviewsTotal -= 1;
            renderReviews();
          };
          setTimeout(remove, 260);
        } else {
          renderReviews();
        }
        setReviewsMsg(status === "approved" ? "已通过，用户端可见。" : "已拒绝。", "success");
        // 误判可一键撤销（回退到处理前状态并重新拉取）。
        toast(status === "approved" ? "已通过，用户端可见" : "已拒绝",
          "success",
          { actionText: "撤销", onAction: function () { undoModerate(id, prevStatus); } });
        loadBadges(); // 刷新待审角标
      })
      .catch(function (err) {
        state.reviewsPendingId = "";
        if (card) {
          Array.prototype.forEach.call(card.querySelectorAll(".pc-reviews-act"), function (b) { b.disabled = false; });
        }
        setReviewsMsg((err && err.message) || "处理失败", "error");
        toast((err && err.message) || "处理失败", "error");
      });
  }

  // 撤销审核：把晒图状态回退（不经 moderateReview 的串行/查找，直接调接口后重拉）。
  function undoModerate(id, toStatus) {
    if (!id || !toStatus) return;
    Core.callAdminOrders("review-status", { reviewId: id, status: toStatus })
      .then(function () {
        toast("已撤销", "success");
        loadReviews(true);
        loadBadges();
      })
      .catch(function (err) { toast((err && err.message) || "撤销失败", "error"); });
  }

  // ----- 灯箱（全屏暗遮罩 + 大图 + 左右翻页 + ESC / 点遮罩关） -----

  state.reviewsLb = { imgs: [], index: 0, open: false };

  function bindReviewLightbox() {
    var box = document.getElementById("pcReviewsLightbox");
    if (!box) return;

    // 点遮罩（非图片 / 非翻页按钮）关闭
    box.addEventListener("click", function (event) {
      if (event.target === box) closeReviewLightbox();
    });

    var closeEl = document.getElementById("pcReviewsLbClose");
    if (closeEl) closeEl.addEventListener("click", closeReviewLightbox);

    var prevEl = document.getElementById("pcReviewsLbPrev");
    if (prevEl) prevEl.addEventListener("click", function (e) { e.stopPropagation(); stepReviewLightbox(-1); });

    var nextEl = document.getElementById("pcReviewsLbNext");
    if (nextEl) nextEl.addEventListener("click", function (e) { e.stopPropagation(); stepReviewLightbox(1); });

    // ESC 关闭 / ←→ 翻页（仅灯箱打开时响应）
    document.addEventListener("keydown", function (event) {
      if (!state.reviewsLb.open) return;
      if (event.key === "Escape") { closeReviewLightbox(); }
      else if (event.key === "ArrowLeft") { stepReviewLightbox(-1); }
      else if (event.key === "ArrowRight") { stepReviewLightbox(1); }
    });
  }

  function openReviewLightbox(reviewIdValue, startIndex) {
    var review = findReview(reviewIdValue);
    if (!review) return;
    var imgs = Array.isArray(review.imageUrls) ? review.imageUrls.filter(Boolean) : [];
    if (imgs.length === 0) return;

    state.reviewsLb.imgs = imgs;
    state.reviewsLb.index = Math.max(0, Math.min(imgs.length - 1, Number(startIndex) || 0));
    state.reviewsLb.open = true;

    var box = document.getElementById("pcReviewsLightbox");
    if (box) box.hidden = false;
    renderReviewLightbox();
  }

  function closeReviewLightbox() {
    state.reviewsLb.open = false;
    var box = document.getElementById("pcReviewsLightbox");
    if (box) box.hidden = true;
    var img = document.getElementById("pcReviewsLbImg");
    if (img) img.removeAttribute("src");
  }

  function stepReviewLightbox(dir) {
    var imgs = state.reviewsLb.imgs;
    if (!imgs || imgs.length === 0) return;
    var n = imgs.length;
    state.reviewsLb.index = (state.reviewsLb.index + dir + n) % n;
    renderReviewLightbox();
  }

  function renderReviewLightbox() {
    var imgs = state.reviewsLb.imgs;
    var img = document.getElementById("pcReviewsLbImg");
    var counter = document.getElementById("pcReviewsLbCounter");
    var prevEl = document.getElementById("pcReviewsLbPrev");
    var nextEl = document.getElementById("pcReviewsLbNext");
    if (!img || !imgs || imgs.length === 0) return;

    img.src = imgs[state.reviewsLb.index];
    if (counter) counter.textContent = (state.reviewsLb.index + 1) + " / " + imgs.length;

    // 单图隐藏翻页按钮
    var multi = imgs.length > 1;
    if (prevEl) prevEl.hidden = !multi;
    if (nextEl) nextEl.hidden = !multi;
  }

  // 注册面板加载器：首次进入拉取（reviewsLoaded 标记防重复），切回不重复请求但提供刷新按钮。
  PANEL_LOADERS.reviews = function () { loadReviews(false); };

  // ============ 录入礼品（新建 / 编辑回填） ============
  //
  // 渲染进 #pcCreatePanelBody（html 占位容器）。左右两栏：
  //   左栏（1fr）：表单（标题 / 分类 / 子类 / 参考价 / 兑换积分 / 描述 / 最多 5 张图 / 上架开关）。
  //   右栏（380px sticky）：实时预览卡（主图 / 标题 / 积分 / 参考价）。
  // 所有 CRUD / 图片上传走 AdminCore（createProduct / updateProduct / uploadImage），
  // 不在此处自写 fetch / 鉴权。业务逻辑（价→分换算、图片收集、payload 字段）搬运自移动版 admin.js。
  //
  // 编辑回填：暴露 window.__pcEditProduct(product)，编辑礼品模块的「编辑」按钮调用它即可
  // 跳到本面板并回填，提交时走 updateProduct(id, payload)。

  var CREATE_PRICE_PER_CARD = 40;   // 价格 ÷ 40 ≈ 兑换积分（向上取整、至少 1），与移动版一致。
  var CREATE_MAX_IMAGES = 5;        // 与 AdminCore / 移动版 MAX_PRODUCT_IMAGES 一致。
  var CREATE_INPUT_CAT_KEY = "gift-site-admin-input-cat-order"; // 录入下拉顺序（本机），与分类排序模块共享。

  // 分类来源：复用编辑模块已剔除 all 的 EDIT_CATEGORIES（单一事实源）。
  function createRealCategories() {
    return EDIT_CATEGORIES.slice();
  }

  // 按本机录入顺序排序分类（无记录则按 config 原序）。读 localStorage，坏数据兜底原序。
  function createOrderedCategories() {
    var cats = createRealCategories();
    var order;
    try {
      order = JSON.parse(localStorage.getItem(CREATE_INPUT_CAT_KEY) || "[]");
    } catch (e) {
      order = [];
    }
    if (!Array.isArray(order) || order.length === 0) return cats;
    var idx = function (val) {
      var i = order.indexOf(val);
      return i < 0 ? 9999 : i;
    };
    return cats.slice().sort(function (a, b) { return idx(a.value) - idx(b.value); });
  }

  // config.subcategories 映射（分类 value → [子类名]）。
  function createSubcategoriesFor(catValue) {
    var map = (Core.config && Core.config.subcategories) || {};
    var list = map[catValue];
    return Array.isArray(list) ? list : [];
  }

  // 价格 → 兑换积分（向上取整，至少 1）。价格无效返回空字符串（不强写）。
  function createPriceToCards(price) {
    var p = Number(price) || 0;
    if (p <= 0) return "";
    return Math.max(1, Math.ceil(p / CREATE_PRICE_PER_CARD));
  }

  // 本模块状态。images 为图片槽数组：{ mode: 'file'|'url', url, uploading, error }。
  state.createLoaded = false;     // 外壳是否已建好（防重复建 DOM）。
  state.createEditingId = "";     // 非空 = 编辑态，提交走 updateProduct。
  state.createCardsTouched = false; // 用户是否手改过积分（true 后价格变动不再自动覆盖）。
  state.createSubmitting = false; // 提交中（禁用按钮、防重复提交）。
  state.createUploading = 0;      // 正在上传的图片数（>0 时禁用提交）。
  state.createImages = [];        // 图片槽：[{ url: '', uploading: false }]
  state.createImagesEpoch = 0;    // 表单代次：重置 / 切编辑对象时 +1，作废在途上传的孤儿回调。

  // 渲染外壳一次（左表单骨架 + 右预览卡 + 事件绑定），后续只重渲染图片列表 / 预览。
  function ensureCreateShell() {
    var host = document.getElementById("pcCreatePanelBody");
    if (!host) return null;
    if (host.getAttribute("data-create-ready") === "1") return host;

    host.classList.remove("pc-panel-placeholder");
    host.setAttribute("data-create-ready", "1");

    var catOptions = createOrderedCategories().map(function (c) {
      return '<option value="' + escapeHtml(c.value) + '">' + escapeHtml(c.label || c.value) + "</option>";
    }).join("");

    host.innerHTML =
      '<div class="pc-create-grid">'
      // ===== 左栏：表单 =====
      + '<section class="pc-create-form-col">'
      + '<header class="pc-create-head">'
      + '<h3 class="pc-create-title" id="pcCreateTitleHd">录入礼品</h3>'
      + '<button class="pc-btn-ghost pc-create-back" id="pcCreateBackBtn" type="button" hidden>← 返回编辑列表</button>'
      + '<button class="pc-btn-ghost pc-create-reset" id="pcCreateResetBtn" type="button">清空 / 新建</button>'
      + "</header>"
      + '<form class="pc-create-form" id="pcCreateForm" autocomplete="off" novalidate>'

      + '<label class="pc-create-field">'
      + '<span class="pc-create-label">标题 <i class="pc-create-req">*</i></span>'
      + '<input class="pc-create-input" id="pcCreateTitle" type="text" maxlength="120" placeholder="例如：婴儿推车礼包">'
      + "</label>"

      + '<div class="pc-create-row2">'
      + '<label class="pc-create-field">'
      + '<span class="pc-create-label">分类 <i class="pc-create-req">*</i></span>'
      + '<select class="pc-create-input" id="pcCreateCat">' + catOptions + "</select>"
      + "</label>"
      + '<label class="pc-create-field" id="pcCreateSubField" hidden>'
      + '<span class="pc-create-label">子类</span>'
      + '<select class="pc-create-input" id="pcCreateSub"></select>'
      + "</label>"
      + "</div>"

      + '<div class="pc-create-row2">'
      + '<label class="pc-create-field">'
      + '<span class="pc-create-label">参考价（元）<i class="pc-create-req">*</i></span>'
      + '<input class="pc-create-input" id="pcCreatePrice" type="number" min="0" step="1" inputmode="numeric" placeholder="0">'
      + "</label>"
      + '<label class="pc-create-field">'
      + '<span class="pc-create-label">兑换积分 <i class="pc-create-req">*</i> <span class="pc-create-hint">价格÷40 自动算</span></span>'
      + '<input class="pc-create-input" id="pcCreateCards" type="number" min="1" step="1" inputmode="numeric" placeholder="自动">'
      + "</label>"
      + "</div>"

      + '<label class="pc-create-field">'
      + '<span class="pc-create-label">描述</span>'
      + '<textarea class="pc-create-input pc-create-textarea" id="pcCreateDesc" rows="3" maxlength="2000" placeholder="选填：礼品卖点 / 规格 / 注意事项"></textarea>'
      + "</label>"

      + '<div class="pc-create-field">'
      + '<span class="pc-create-label">图片（最多 ' + CREATE_MAX_IMAGES + ' 张，第一张为主图）<i class="pc-create-req">*</i></span>'
      + '<div class="pc-create-images" id="pcCreateImages"></div>'
      + '<button class="pc-btn-ghost pc-create-addimg" id="pcCreateAddImgBtn" type="button">+ 添加图片</button>'
      + "</div>"

      + '<div class="pc-create-row2">'
      + '<label class="pc-create-field">'
      + '<span class="pc-create-label">排序值（越小越靠前）</span>'
      + '<input class="pc-create-input" id="pcCreateSort" type="number" step="1" inputmode="numeric" placeholder="10" value="10">'
      + "</label>"
      + '<label class="pc-create-field pc-create-switch-field">'
      + '<span class="pc-create-label">上架状态</span>'
      + '<label class="pc-create-switch">'
      + '<input type="checkbox" id="pcCreateActive" checked>'
      + '<span class="pc-create-switch-track"></span>'
      + '<span class="pc-create-switch-text" id="pcCreateActiveText">已上架</span>'
      + "</label>"
      + "</label>"
      + "</div>"

      + '<div class="pc-create-foot">'
      + '<button class="pc-btn-primary pc-create-submit" id="pcCreateSubmitBtn" type="submit">提交新建</button>'
      + '<span class="pc-inline-msg pc-create-msg" id="pcCreateMsg"></span>'
      + "</div>"
      + "</form>"
      + "</section>"

      // ===== 右栏：实时预览卡（sticky） =====
      + '<aside class="pc-create-preview-col">'
      + '<div class="pc-create-preview" id="pcCreatePreview">'
      + '<div class="pc-create-preview-cap">实时预览</div>'
      + '<div class="pc-create-preview-img" id="pcCreatePreviewImg"><span class="pc-create-preview-noimg">暂无主图</span></div>'
      + '<div class="pc-create-preview-body">'
      + '<div class="pc-create-preview-title" id="pcCreatePreviewTitle">礼品标题</div>'
      + '<div class="pc-create-preview-cat" id="pcCreatePreviewCat"></div>'
      + '<div class="pc-create-preview-meta">'
      + '<span class="pc-create-preview-cards" id="pcCreatePreviewCards">— 分</span>'
      + '<span class="pc-create-preview-price" id="pcCreatePreviewPrice"></span>'
      + "</div>"
      + '<div class="pc-create-preview-status" id="pcCreatePreviewStatus"></div>'
      + "</div>"
      + "</div>"
      + "</aside>"
      + "</div>";

    bindCreateEvents();
    return host;
  }

  // 同步分类下拉选项（编辑回填 / 录入顺序变化时调用，保留当前选中值）。
  function refreshCreateCatOptions() {
    var sel = document.getElementById("pcCreateCat");
    if (!sel) return;
    var current = sel.value;
    sel.innerHTML = createOrderedCategories().map(function (c) {
      return '<option value="' + escapeHtml(c.value) + '">' + escapeHtml(c.label || c.value) + "</option>";
    }).join("");
    if (current) sel.value = current;
  }

  // 根据当前分类联动子类下拉（保留 keepValue 若仍合法）。
  function syncCreateSubcategory(keepValue) {
    var catSel = document.getElementById("pcCreateCat");
    var field = document.getElementById("pcCreateSubField");
    var sub = document.getElementById("pcCreateSub");
    if (!catSel || !field || !sub) return;

    var subs = createSubcategoriesFor(catSel.value);
    if (subs.length === 0) {
      field.hidden = true;
      sub.innerHTML = '<option value="">不选</option>';
      sub.value = "";
      return;
    }

    field.hidden = false;
    var opts = ['<option value="">不选</option>'].concat(subs.map(function (s) {
      return '<option value="' + escapeHtml(s) + '">' + escapeHtml(s) + "</option>";
    })).join("");
    sub.innerHTML = opts;
    if (keepValue && subs.indexOf(keepValue) !== -1) {
      sub.value = keepValue;
    } else {
      sub.value = "";
    }
  }

  function setCreateMsg(text, tone) {
    var el = document.getElementById("pcCreateMsg");
    if (!el) return;
    el.textContent = text || "";
    if (tone) el.dataset.tone = tone;
    else delete el.dataset.tone;
  }

  // 轻量 toast（右下角浮层，自动淡出）。无依赖、不污染 html。
  // 录入模块沿用的别名，统一走全局 toast()。
  function createToast(text, tone) {
    toast(text, tone);
  }

  // 绑定表单交互（一次性）。
  function bindCreateEvents() {
    var form = document.getElementById("pcCreateForm");
    var catSel = document.getElementById("pcCreateCat");
    var priceEl = document.getElementById("pcCreatePrice");
    var cardsEl = document.getElementById("pcCreateCards");
    var addImgBtn = document.getElementById("pcCreateAddImgBtn");
    var resetBtn = document.getElementById("pcCreateResetBtn");
    var activeEl = document.getElementById("pcCreateActive");
    var imagesWrap = document.getElementById("pcCreateImages");

    // 分类变化：联动子类 + 刷新预览。
    if (catSel) {
      catSel.addEventListener("change", function () {
        syncCreateSubcategory("");
        renderCreatePreview();
      });
    }

    // 价格变化：未手改过积分时自动算（向上取整，至少 1）。
    if (priceEl) {
      priceEl.addEventListener("input", function () {
        if (!state.createCardsTouched && cardsEl) {
          var v = createPriceToCards(priceEl.value);
          cardsEl.value = v === "" ? "" : String(v);
        }
        renderCreatePreview();
      });
    }

    // 积分手改：打标，之后价格变动不再覆盖；清空则恢复自动。
    if (cardsEl) {
      cardsEl.addEventListener("input", function () {
        state.createCardsTouched = (cardsEl.value || "").trim() !== "";
        renderCreatePreview();
      });
    }

    // 标题 / 描述 / 子类变化 → 刷新预览（事件委托到表单 input/change）。
    if (form) {
      form.addEventListener("input", function (event) {
        var t = event.target;
        if (t && (t.id === "pcCreateTitle" || t.id === "pcCreateDesc")) renderCreatePreview();
      });
      form.addEventListener("submit", handleCreateSubmit);
    }

    // 子类 / 上架开关 change → 刷新预览。
    var subSel = document.getElementById("pcCreateSub");
    if (subSel) subSel.addEventListener("change", renderCreatePreview);
    if (activeEl) {
      activeEl.addEventListener("change", function () {
        var txt = document.getElementById("pcCreateActiveText");
        if (txt) txt.textContent = activeEl.checked ? "已上架" : "未上架";
        renderCreatePreview();
      });
    }

    if (addImgBtn) {
      addImgBtn.addEventListener("click", function () {
        if (state.createImages.length >= CREATE_MAX_IMAGES) {
          setCreateMsg("最多 " + CREATE_MAX_IMAGES + " 张图片。", "error");
          return;
        }
        state.createImages.push({ url: "", uploading: false });
        renderCreateImages();
        renderCreatePreview();
      });
    }

    if (resetBtn) {
      resetBtn.addEventListener("click", function () {
        if (createFormDirty() && !window.confirm("当前填写的内容（含已上传图片）将被清空，确定？")) return;
        resetCreateForm();
      });
    }

    // 编辑态「返回编辑列表」：不保存，清空编辑态并切回编辑面板
    var backBtn = document.getElementById("pcCreateBackBtn");
    if (backBtn) {
      backBtn.addEventListener("click", function () {
        resetCreateForm();
        activatePanel("edit");
      });
    }

    // 图片列表交互（事件委托：选文件 / 填 URL / 删除）。
    if (imagesWrap) {
      imagesWrap.addEventListener("change", handleCreateImageChange);
      imagesWrap.addEventListener("input", handleCreateImageInput);
      imagesWrap.addEventListener("click", handleCreateImageClick);
    }
  }

  // 图片槽列表渲染。每槽：序号（主图标记）+ 文件选择 + URL 输入 + 删除。
  function renderCreateImages() {
    var wrap = document.getElementById("pcCreateImages");
    if (!wrap) return;

    if (state.createImages.length === 0) {
      wrap.innerHTML = '<p class="pc-create-img-empty">还没有图片，点下方「+ 添加图片」开始。第一张为主图。</p>';
      syncCreateAddImgBtn();
      return;
    }

    var last = state.createImages.length - 1;
    wrap.innerHTML = state.createImages.map(function (slot, i) {
      var busy = slot.uploading ? " disabled" : "";
      var primaryTag = i === 0 ? '<span class="pc-create-img-primary">主图</span>' : '<span class="pc-create-img-idx">图' + (i + 1) + "</span>";
      var thumb = slot.url
        ? '<img class="pc-create-img-thumb" src="' + escapeHtml(slot.url) + '" alt="">'
        : '<span class="pc-create-img-thumb pc-create-img-thumb-empty">' + (slot.uploading ? "上传中…" : "无图") + "</span>";
      return '<div class="pc-create-img-slot" data-create-img-slot="' + i + '">'
        + '<div class="pc-create-img-slot-head">' + primaryTag
        + '<div class="pc-create-img-acts">'
        + (i > 0 ? '<button class="pc-create-img-act" type="button" data-create-img-primary="' + i + '"' + busy + ' title="设为主图">设主图</button>' : "")
        + '<button class="pc-create-img-act" type="button" data-create-img-move="' + i + '" data-dir="-1"' + (i === 0 ? " disabled" : busy) + ' title="上移">↑</button>'
        + '<button class="pc-create-img-act" type="button" data-create-img-move="' + i + '" data-dir="1"' + (i === last ? " disabled" : busy) + ' title="下移">↓</button>'
        + '<button class="pc-create-img-del" type="button" data-create-img-del="' + i + '" aria-label="删除">×</button>'
        + "</div>"
        + "</div>"
        + thumb
        + '<div class="pc-create-img-inputs">'
        + '<label class="pc-create-img-file-btn">选文件'
        + '<input class="pc-create-img-file" type="file" accept="image/*" data-create-img-file="' + i + '"' + busy + ">"
        + "</label>"
        + '<input class="pc-create-input pc-create-img-url" type="url" placeholder="或粘贴图片 URL" value="' + escapeHtml(slot.url || "") + '" data-create-img-url="' + i + '"' + busy + ">"
        + "</div>"
        + (slot.error ? '<div class="pc-create-img-err">' + escapeHtml(slot.error)
            + (slot._file ? ' <button class="pc-create-img-retry" type="button" data-create-img-retry="' + i + '">重试</button>' : "")
            + "</div>" : "")
        + "</div>";
    }).join("");

    syncCreateAddImgBtn();
  }

  function syncCreateAddImgBtn() {
    var btn = document.getElementById("pcCreateAddImgBtn");
    if (!btn) return;
    btn.disabled = state.createImages.length >= CREATE_MAX_IMAGES;
  }

  // 上传单个图片槽：压缩 + 上传（走 AdminCore.uploadImage），URL 写回该槽。
  // 记住 file 到 slot._file，失败时「重试」复用，无需重新选文件。
  function uploadCreateSlot(i, file) {
    var slot = state.createImages[i];
    if (!slot || !file) return;
    if (!Core.activeSession()) {
      setCreateMsg("请先登录管理员账号。", "error");
      return;
    }

    // 记录表单代次：若上传期间表单被重置 / 切到编辑别的商品，则这次结果作废（不改计数/不弹陈旧提示）。
    var epoch = state.createImagesEpoch;
    slot.uploading = true;
    slot.error = "";
    slot._file = file;
    state.createUploading += 1;
    renderCreateImages();
    syncCreateSubmitBtn();
    setCreateMsg("正在上传第 " + (i + 1) + " 张图片…", null);

    Core.uploadImage(file)
      .then(function (url) {
        if (epoch !== state.createImagesEpoch) return; // 表单已换代，丢弃孤儿结果
        slot.url = url;
        slot.uploading = false;
        slot.error = "";
        slot._file = null;
        state.createUploading = Math.max(0, state.createUploading - 1);
        renderCreateImages();
        renderCreatePreview();
        syncCreateSubmitBtn();
        var cur = state.createImages.indexOf(slot); // 重排后用实时位置，避免「第 N 张」错位
        setCreateMsg(cur >= 0 ? ("第 " + (cur + 1) + " 张图片已上传。") : "图片已上传。", "success");
      })
      .catch(function (err) {
        if (epoch !== state.createImagesEpoch) return;
        slot.uploading = false;
        slot.error = (err && err.message) || "上传失败";
        state.createUploading = Math.max(0, state.createUploading - 1);
        renderCreateImages();
        syncCreateSubmitBtn();
        var cur = state.createImages.indexOf(slot);
        setCreateMsg((cur >= 0 ? ("第 " + (cur + 1) + " 张") : "该") + "图片上传失败，可点该图下方「重试」。", "error");
      });
  }

  // 选文件 → 上传。
  function handleCreateImageChange(event) {
    var fileInput = event.target.closest("[data-create-img-file]");
    if (!fileInput) return;
    var i = Number(fileInput.getAttribute("data-create-img-file"));
    var slot = state.createImages[i];
    if (!slot) return;
    var file = fileInput.files && fileInput.files[0];
    if (!file) return;
    uploadCreateSlot(i, file);
  }

  // 粘贴 / 输入 URL：直接写回该槽（与选文件二选一，后输入者覆盖）。
  function handleCreateImageInput(event) {
    var urlInput = event.target.closest("[data-create-img-url]");
    if (!urlInput) return;
    var i = Number(urlInput.getAttribute("data-create-img-url"));
    var slot = state.createImages[i];
    if (!slot) return;
    var val = (urlInput.value || "").trim();
    var hadError = !!(slot.error || slot._file); // 之前是上传失败槽
    slot.url = val;
    slot.error = "";
    if (val) slot._file = null; // 粘了 URL 就放弃旧失败文件，避免误点「重试」覆盖刚填的 URL
    // 清掉该槽残留的「错误行 + 重试」DOM（不整列表重渲染，免打断输入焦点）。
    if (hadError && val) {
      var slotEl = urlInput.closest("[data-create-img-slot]");
      var errEl = slotEl && slotEl.querySelector(".pc-create-img-err");
      if (errEl) errEl.remove();
    }
    // 仅更新主图预览，不整列表重渲染（避免打断输入焦点）。
    if (i === 0) renderCreatePreview();
  }

  // 图片槽按钮委托：设为主图 / 上下移 / 重试 / 删除。
  function handleCreateImageClick(event) {
    // 设为主图：把该槽移到第 0 位。
    var primaryBtn = event.target.closest("[data-create-img-primary]");
    if (primaryBtn) {
      if (primaryBtn.disabled) return;
      var pi = Number(primaryBtn.getAttribute("data-create-img-primary"));
      if (pi > 0 && state.createImages[pi]) {
        state.createImages.unshift(state.createImages.splice(pi, 1)[0]);
        renderCreateImages();
        renderCreatePreview();
      }
      return;
    }

    // 上 / 下移：与相邻槽交换。
    var moveBtn = event.target.closest("[data-create-img-move]");
    if (moveBtn) {
      if (moveBtn.disabled) return;
      var mi = Number(moveBtn.getAttribute("data-create-img-move"));
      var mj = mi + Number(moveBtn.getAttribute("data-dir"));
      if (mj >= 0 && mj < state.createImages.length) {
        var tmp = state.createImages[mi];
        state.createImages[mi] = state.createImages[mj];
        state.createImages[mj] = tmp;
        renderCreateImages();
        renderCreatePreview();
      }
      return;
    }

    // 重试上传（复用上次选的文件）。
    var retryBtn = event.target.closest("[data-create-img-retry]");
    if (retryBtn) {
      var ri = Number(retryBtn.getAttribute("data-create-img-retry"));
      var rslot = state.createImages[ri];
      if (rslot && rslot._file) uploadCreateSlot(ri, rslot._file);
      else setCreateMsg("请重新选择该图片文件。", "error");
      return;
    }

    // 删除图片槽。
    var delBtn = event.target.closest("[data-create-img-del]");
    if (delBtn) {
      var i = Number(delBtn.getAttribute("data-create-img-del"));
      var slot = state.createImages[i];
      if (!slot) return;
      if (slot.uploading) { setCreateMsg("图片上传中，请稍候再删除。", "error"); return; }
      state.createImages.splice(i, 1);
      renderCreateImages();
      renderCreatePreview();
      return;
    }
  }

  // 实时预览卡：标题 / 主图 / 积分 / 参考价 / 分类 / 状态。
  function renderCreatePreview() {
    var title = (document.getElementById("pcCreateTitle") || {}).value || "";
    var price = Number((document.getElementById("pcCreatePrice") || {}).value || 0) || 0;
    var cards = (document.getElementById("pcCreateCards") || {}).value || "";
    var catSel = document.getElementById("pcCreateCat");
    var activeEl = document.getElementById("pcCreateActive");
    var mainImg = state.createImages.length ? state.createImages[0].url : "";

    var titleEl = document.getElementById("pcCreatePreviewTitle");
    if (titleEl) titleEl.textContent = title.trim() || "礼品标题";

    var imgBox = document.getElementById("pcCreatePreviewImg");
    if (imgBox) {
      imgBox.innerHTML = mainImg
        ? '<img src="' + escapeHtml(mainImg) + '" alt="">'
        : '<span class="pc-create-preview-noimg">暂无主图</span>';
    }

    var cardsEl = document.getElementById("pcCreatePreviewCards");
    if (cardsEl) {
      var cardsVal = cards !== "" ? cards : (price > 0 ? createPriceToCards(price) : "");
      cardsEl.textContent = (cardsVal === "" ? "—" : cardsVal) + " 分";
    }

    var priceEl = document.getElementById("pcCreatePreviewPrice");
    if (priceEl) priceEl.textContent = price > 0 ? "参考价 ¥" + price : "";

    var catEl = document.getElementById("pcCreatePreviewCat");
    if (catEl && catSel) {
      var subSel = document.getElementById("pcCreateSub");
      var subVal = subSel && !document.getElementById("pcCreateSubField").hidden ? subSel.value : "";
      catEl.textContent = editCategoryLabel(catSel.value) + (subVal ? " · " + subVal : "");
    }

    var statusEl = document.getElementById("pcCreatePreviewStatus");
    if (statusEl) {
      var on = activeEl ? activeEl.checked : true;
      statusEl.innerHTML = '<span class="pc-order-status ' + (on ? "pc-order-status-done" : "pc-order-status-cancelled") + '">'
        + (on ? "已上架" : "未上架") + "</span>";
    }
  }

  function syncCreateSubmitBtn() {
    var btn = document.getElementById("pcCreateSubmitBtn");
    if (!btn) return;
    var busy = state.createSubmitting || state.createUploading > 0;
    btn.disabled = busy;
    btn.textContent = state.createSubmitting
      ? "提交中…"
      : (state.createUploading > 0 ? "图片上传中…" : (state.createEditingId ? "保存修改" : "提交新建"));
  }

  // 切换新建 / 编辑态的标题与按钮文案。
  function syncCreateMode() {
    var hd = document.getElementById("pcCreateTitleHd");
    if (hd) hd.textContent = state.createEditingId ? "编辑礼品" : "录入礼品";
    var backBtn = document.getElementById("pcCreateBackBtn");
    if (backBtn) backBtn.hidden = !state.createEditingId;   // 仅编辑态显示「返回编辑列表」
    syncCreateSubmitBtn();
  }

  // 录入表单是否有未保存内容（编辑态视为有；新建态看关键字段 / 图片）。供离开拦截 + 清空确认共用。
  function createFormDirty() {
    if (!state.createLoaded) return false;
    if (state.createEditingId) return true;
    var t = document.getElementById("pcCreateTitle");
    var pr = document.getElementById("pcCreatePrice");
    var c = document.getElementById("pcCreateCards");
    var d = document.getElementById("pcCreateDesc");
    if ((t && t.value.trim()) || (pr && pr.value.trim()) || (c && c.value.trim()) || (d && d.value.trim())) return true;
    if (Array.isArray(state.createImages) && state.createImages.length) return true;
    return false;
  }

  // 清空表单回到「新建」态。
  function resetCreateForm() {
    state.createEditingId = "";
    state.createCardsTouched = false;
    state.createImages = [];
    state.createUploading = 0;       // 清掉脱离表单的在途计数，避免新表单按钮卡在「图片上传中…」
    state.createImagesEpoch += 1;    // 作废在途上传的孤儿回调

    var titleEl = document.getElementById("pcCreateTitle");
    var priceEl = document.getElementById("pcCreatePrice");
    var cardsEl = document.getElementById("pcCreateCards");
    var descEl = document.getElementById("pcCreateDesc");
    var sortEl = document.getElementById("pcCreateSort");
    var catSel = document.getElementById("pcCreateCat");
    var activeEl = document.getElementById("pcCreateActive");
    var activeText = document.getElementById("pcCreateActiveText");

    if (titleEl) titleEl.value = "";
    if (priceEl) priceEl.value = "";
    if (cardsEl) cardsEl.value = "";
    if (descEl) descEl.value = "";
    if (sortEl) sortEl.value = "10";
    if (catSel) {
      var ordered = createOrderedCategories();
      if (ordered.length) catSel.value = ordered[0].value;
    }
    if (activeEl) activeEl.checked = true;
    if (activeText) activeText.textContent = "已上架";

    syncCreateSubcategory("");
    renderCreateImages();
    renderCreatePreview();
    syncCreateMode();
    setCreateMsg("", null);
  }

  // 收集图片 URL（按槽顺序，去空去重，最多 5 张）。第一张为主图。
  function collectCreateImageUrls() {
    var seen = {};
    var out = [];
    state.createImages.forEach(function (slot) {
      var u = (slot && slot.url || "").trim();
      if (u && !seen[u]) {
        seen[u] = true;
        out.push(u);
      }
    });
    return out.slice(0, CREATE_MAX_IMAGES);
  }

  // 提交：校验 → 组 payload（对齐 Supabase products 表）→ create / update → toast + 收尾。
  function handleCreateSubmit(event) {
    event.preventDefault();
    if (state.createSubmitting) return;

    if (!Core.activeSession()) {
      setCreateMsg("请先登录管理员账号。", "error");
      return;
    }
    if (state.createUploading > 0) {
      setCreateMsg("还有图片正在上传，请稍候。", "error");
      return;
    }
    // 有上传失败的图片槽 → 提醒：它不会被提交。
    var failedCount = state.createImages.filter(function (s) { return s && s.error; }).length;
    if (failedCount > 0 && !window.confirm("有 " + failedCount + " 张图片上传失败、不会被提交。确定继续提交吗？")) {
      return;
    }

    var title = ((document.getElementById("pcCreateTitle") || {}).value || "").trim();
    var category = ((document.getElementById("pcCreateCat") || {}).value || "").trim();
    var subField = document.getElementById("pcCreateSubField");
    var subSel = document.getElementById("pcCreateSub");
    var subcategory = (subField && !subField.hidden && subSel) ? (subSel.value || "").trim() : "";
    var description = ((document.getElementById("pcCreateDesc") || {}).value || "").trim();
    var price = Number((document.getElementById("pcCreatePrice") || {}).value || 0) || 0;
    var cardsRaw = ((document.getElementById("pcCreateCards") || {}).value || "").trim();
    var cards = Number(cardsRaw) || 0;
    var sortOrder = Number((document.getElementById("pcCreateSort") || {}).value || 10);
    var isActive = (document.getElementById("pcCreateActive") || {}).checked !== false;

    // 价格有效但积分留空 → 自动补算（与移动版一致）。
    if (price > 0 && !cards) {
      cards = createPriceToCards(price) || 0;
    }

    if (!title || !category || !price || !cards) {
      setCreateMsg("标题、分类、参考价、兑换积分都是必填项。", "error");
      return;
    }

    var imageUrls = collectCreateImageUrls();
    if (imageUrls.length === 0) {
      setCreateMsg("请至少上传 1 张图片或填 1 个图片 URL。", "error");
      return;
    }

    var payload = {
      title: title,
      category: category,
      subcategory: subcategory || null,
      price: price,
      cards_needed: cards,
      description: description,
      image_url: imageUrls[0],
      images: imageUrls,
      sort_order: isNaN(sortOrder) ? 10 : sortOrder,
      is_active: isActive
    };

    var editingId = state.createEditingId;
    state.createSubmitting = true;
    syncCreateSubmitBtn();
    setCreateMsg(editingId ? "正在保存修改…" : "正在写入礼品…", null);

    var op = editingId
      ? Core.updateProduct(editingId, payload)
      : Core.createProduct(payload);

    op
      .then(function (saved) {
        state.createSubmitting = false;
        // 编辑模块若已加载过列表，更新 / 追加对应行并重渲染，保持两模块一致。
        try {
          syncEditAfterCreate(editingId, saved, payload);
        } catch (e) {}

        if (editingId) {
          createToast("已保存修改：" + title, "success");
          setCreateMsg("已保存。可在「编辑礼品」查看，或继续录入新礼品。", "success");
          resetCreateForm(); // 回到新建态
        } else {
          createToast("已写入礼品：" + title, "success");
          resetCreateForm();
          setCreateMsg("已写入。表单已清空，可继续录入下一件。", "success");
        }
      })
      .catch(function (err) {
        state.createSubmitting = false;
        syncCreateSubmitBtn();
        setCreateMsg((err && err.message) || (editingId ? "保存失败" : "写入失败"), "error");
        createToast((editingId ? "保存失败：" : "写入失败：") + ((err && err.message) || ""), "error");
      });
  }

  // 提交成功后同步编辑模块的内存列表（若已加载），避免切过去看到旧数据。
  function syncEditAfterCreate(editingId, saved, payload) {
    if (!state.editLoaded || !Array.isArray(state.editProducts)) return;
    var row = saved && saved.id ? saved : null;

    if (editingId) {
      for (var i = 0; i < state.editProducts.length; i += 1) {
        if (state.editProducts[i].id === editingId) {
          // 合并：优先用服务端回传，回退到本地 payload。
          state.editProducts[i] = Object.assign({}, state.editProducts[i], payload, row || {});
          break;
        }
      }
    } else if (row) {
      // 新建：插到列表头（与 updated_at.desc 顺序一致）。
      state.editProducts.unshift(Object.assign({}, payload, row));
    }
    // 若编辑面板当前可见，重渲染表格。
    var editHost = document.getElementById("pcEditPanelBody");
    if (editHost && editHost.getAttribute("data-edit-ready") === "1" && typeof renderEditTable === "function") {
      renderEditTable();
    }
  }

  // 编辑回填：载入 product → 切到 create 面板 → 填充表单（图片每张占一槽）。
  function fillCreateForEdit(product) {
    if (!product) return;
    ensureCreateShell();

    state.createEditingId = product.id || "";
    state.createCardsTouched = true; // 编辑态默认尊重已有积分，不自动覆盖。
    state.createUploading = 0;        // 清掉上一表单脱离的在途计数
    state.createImagesEpoch += 1;     // 作废上一表单在途上传的孤儿回调

    refreshCreateCatOptions();

    var titleEl = document.getElementById("pcCreateTitle");
    var priceEl = document.getElementById("pcCreatePrice");
    var cardsEl = document.getElementById("pcCreateCards");
    var descEl = document.getElementById("pcCreateDesc");
    var sortEl = document.getElementById("pcCreateSort");
    var catSel = document.getElementById("pcCreateCat");
    var activeEl = document.getElementById("pcCreateActive");
    var activeText = document.getElementById("pcCreateActiveText");

    if (titleEl) titleEl.value = product.title || "";
    if (catSel) catSel.value = product.category || (createOrderedCategories()[0] || {}).value || "";
    syncCreateSubcategory(product.subcategory || "");
    if (priceEl) priceEl.value = Number(product.price) || "";
    if (cardsEl) {
      var c = Number(product.cards_needed != null ? product.cards_needed : product.price) || 0;
      cardsEl.value = c ? String(c) : "";
    }
    if (descEl) descEl.value = product.description || "";
    if (sortEl) sortEl.value = Number(product.sort_order != null ? product.sort_order : 10);
    if (activeEl) activeEl.checked = product.is_active !== false;
    if (activeText) activeText.textContent = (product.is_active !== false) ? "已上架" : "未上架";

    // 图片：优先 images 数组，回退 image_url；每张一个槽（mode=url）。
    var imgs = [];
    if (Array.isArray(product.images)) {
      imgs = product.images.filter(function (u) { return typeof u === "string" && u.trim(); });
    }
    if (imgs.length === 0 && product.image_url) imgs = [product.image_url];
    state.createImages = imgs.slice(0, CREATE_MAX_IMAGES).map(function (u) {
      return { url: u, uploading: false };
    });

    renderCreateImages();
    renderCreatePreview();
    syncCreateMode();
    setCreateMsg("正在编辑：" + (product.title || product.id || ""), null);
  }

  // 全局钩子：供「编辑礼品」模块的「编辑」按钮调用，跳到本面板并回填。
  window.__pcEditProduct = function (product) {
    activatePanel("create");          // 切面板（会触发 PANEL_LOADERS.create 建外壳）
    fillCreateForEdit(product);        // 回填
  };

  // 注册面板加载器：首次进入建外壳（createLoaded 防重复），切回不重复重建；
  // 提供「清空 / 新建」按钮代替刷新（录入态本无远端数据可拉，分类下拉随时同步本机顺序）。
  PANEL_LOADERS.create = function () {
    var host = ensureCreateShell();
    if (!host) return;
    if (!state.createLoaded) {
      state.createLoaded = true;
      resetCreateForm();
    } else {
      // 切回面板：同步分类下拉（录入顺序可能在「分类排序」里改过），保留当前编辑/录入内容。
      refreshCreateCatOptions();
      renderCreateImages();
      renderCreatePreview();
      syncCreateMode();
    }
  };

  // ============ 申请管理（orders） ============
  //
  // 渲染进 #pcOrdersPanelBody（html 占位容器）。所有读取 / 改状态 / 快递 / 备注
  // 走 Core.callAdminOrders，不在此处自写 fetch / 鉴权。
  // 设计：工具栏（状态筛选 + 搜索 + 计数 + 刷新）+ 订单表格（勾选 / 收件人 / 件数·积分 /
  // 状态徽标 / 下单时间 / 查看）+ 每页 50 分页 + 勾选浮现批量条（全选本页 + 批量改状态）。
  // 点行 → 右侧 ~480px 详情抽屉：收货信息（复制）/ 礼品清单 / 客户备注 / 状态下拉 /
  // 快递（公司 + 单号 + 常用 chip + 自动识别）/ 内部备注。点遮罩 / ESC 关，切行热替换。
  // 业务逻辑搬运自移动版 admin.js 的订单相关函数。

  var ORDERS_PAGE_SIZE = 50;
  var ORDER_STATUS_LABEL = {
    pending: "待发货",
    shipped: "运输中",
    signed: "已签收",
    cancelled: "已取消"
  };
  // 旧码归一：processing/preparing→pending、done→shipped、closed→signed
  var ORDER_STATUS_LEGACY = { processing: "pending", preparing: "pending", done: "shipped", closed: "signed" };
  function normOrderStatus(s) { return ORDER_STATUS_LEGACY[s] || s || "pending"; }
  // 状态文案（历史码/未知一律归一后兜底「待发货」），用于徽标显示
  function orderStatusText(s) { return ORDER_STATUS_LABEL[normOrderStatus(s)] || "待发货"; }
  // 工具栏状态筛选 tab（各环节 + 全部）。
  var ORDER_STATUS_TABS = [
    { value: "pending", label: "待发货" },
    { value: "shipped", label: "运输中" },
    { value: "signed", label: "已签收" },
    { value: "cancelled", label: "已取消" },
    { value: "all", label: "全部订单" }
  ];
  // 详情抽屉常用快递 chip（点击填公司框）。
  var ORDER_CARRIERS = [
    "顺丰速运", "京东物流", "中通快递", "申通快递", "圆通速递", "韵达速递", "极兔速递"
  ];
  // 公司展示名 → 快递100 标准编码（保存时据此推导 courierCode，供物流订阅）。
  // 与 detectCarrier 的返回名保持一致。
  var CARRIER_CODE = {
    "顺丰速运": "shunfeng",
    "圆通速递": "yuantong",
    "中通快递": "zhongtong",
    "申通快递": "shentong",
    "韵达速递": "yunda",
    "京东物流": "jd",
    "极兔速递": "jtexpress",
    "百世快递": "huitongkuaidi",
    "德邦快递": "debangkuaidi",
    "EMS / 邮政": "ems",
    "邮政快递包裹": "youzhengguonei",
    "国通快递": "guotongkuaidi",
    "天天快递": "tiantian"
  };
  function carrierCodeOf(name) { return CARRIER_CODE[String(name || "").trim()] || ""; }

  state.orders = [];                 // 当前页订单
  state.ordersStatus = "pending";    // 状态筛选（pending/processing/done/cancelled/all）
  state.ordersSearch = "";           // 搜索关键词
  state.ordersPage = 0;              // 当前页（0-based）
  state.ordersTotal = 0;            // 当前筛选总数
  state.ordersLoaded = false;        // 防重复拉取标记
  state.ordersSelectedIds = (typeof Set === "function") ? new Set() : null; // 本页勾选集合
  state.ordersDrawerId = "";         // 抽屉当前展示的订单 _id（空 = 关闭）
  state.ordersDrawerSaving = false;  // 抽屉内某操作进行中（禁用对应控件）
  var ordersSearchTimer = null;

  // 订单唯一 id（云端用 _id）。
  function orderId(o) {
    return (o && (o._id || o.id)) || "";
  }

  // 下单时间：YYYY-MM-DD HH:MM（本机时区，与移动版一致）。
  function formatOrderDate(d) {
    if (!d) return "";
    try {
      var date = new Date(d);
      if (isNaN(date.getTime())) return "";
      return date.getFullYear() + "-" + pad2(date.getMonth() + 1) + "-" + pad2(date.getDate())
        + " " + pad2(date.getHours()) + ":" + pad2(date.getMinutes());
    } catch (e) {
      return "";
    }
  }

  // 状态 → 徽标 class（归一旧码）。
  function orderStatusCls(status) {
    return "pc-order-status-" + normOrderStatus(status);
  }

  // 输入快递单号时自动识别快递公司（搬运自移动版 admin.js 的 detectCarrier 规则）。
  function detectCarrier(noRaw) {
    var no = String(noRaw || "").trim().toUpperCase();
    if (!no) return "";
    var rules = [
      [/^SF/, "顺丰速运"],
      [/^YT/, "圆通速递"],
      [/^ZTO|^(75|78)\d{10}$/, "中通快递"],
      [/^STO|^(77|468)\d/, "申通快递"],
      [/^YD|^(31|35|43|19|45|46)\d{11}$/, "韵达速递"],
      [/^(JD|JDV|JDX)/, "京东物流"],
      [/^(JT|JTC)/, "极兔速递"],
      [/^HTKY|^A\d/, "百世快递"],
      [/^DBL|^DPK/, "德邦快递"],
      [/^(EMS|E[A-Z])|^11\d{11}$|^9\d{12}$/, "EMS / 邮政"],
      [/^YZ|^10\d{11}$/, "邮政快递包裹"],
      [/^GTO|^(K|G)\d/, "国通快递"]
    ];
    for (var i = 0; i < rules.length; i += 1) {
      if (rules[i][0].test(no)) return rules[i][1];
    }
    return "";
  }

  // CSS.escape 兜底（用于属性选择器）。
  function ordersCssEscape(value) {
    return (window.CSS && CSS.escape) ? CSS.escape(value) : String(value);
  }

  // 渲染外壳一次（工具栏 + 表格容器 + 分页/消息 + 批量条 + 抽屉/遮罩），后续只重渲染内容。
  function ensureOrdersShell() {
    var host = document.getElementById("pcOrdersPanelBody");
    if (!host) return null;
    if (host.getAttribute("data-orders-ready") === "1") return host;

    host.classList.remove("pc-panel-placeholder");
    host.setAttribute("data-orders-ready", "1");

    var bulkStatusOptions = ['<option value="">批量改为…</option>'].concat(
      Object.keys(ORDER_STATUS_LABEL).map(function (s) {
        return '<option value="' + escapeHtml(s) + '">' + escapeHtml(ORDER_STATUS_LABEL[s]) + "</option>";
      })
    ).join("");

    host.innerHTML =
      '<div class="pc-orders-toolbar">'
      + '<input class="pc-orders-search" id="pcOrdersSearch" type="search" placeholder="搜索收件人 / 手机号 / 订单号…" autocomplete="off">'
      + '<span class="pc-orders-count" id="pcOrdersCount"></span>'
      + '<button class="pc-btn-ghost pc-orders-bulk-logistics" id="pcOrdersBulkLogisticsBtn" type="button">刷新本页物流</button>'
      + '<button class="pc-btn-ghost pc-orders-refresh" id="pcOrdersRefreshBtn" type="button">刷新</button>'
      + "</div>"
      + '<div class="pc-orders-table-wrap" id="pcOrdersTableWrap"></div>'
      + '<div class="pc-orders-pager" id="pcOrdersPager"></div>'
      + '<p class="pc-inline-msg" id="pcOrdersMsg"></p>'
      // 批量条（勾选后浮现）
      + '<div class="pc-orders-bulkbar" id="pcOrdersBulkBar" hidden>'
      + '<label class="pc-orders-bulk-selall"><input type="checkbox" id="pcOrdersSelectAll"> 全选本页</label>'
      + '<span class="pc-orders-bulk-count" id="pcOrdersSelectedCount">已选 0 单</span>'
      + '<select class="pc-orders-bulk-select" id="pcOrdersBulkStatus">' + bulkStatusOptions + "</select>"
      + '<button class="pc-btn-primary pc-orders-bulk-apply" id="pcOrdersBulkApply" type="button">应用</button>'
      + '<button class="pc-orders-bulk-delete" id="pcOrdersBulkDelete" type="button">批量删除</button>'
      + '<button class="pc-btn-ghost pc-orders-bulk-clear" id="pcOrdersBulkClear" type="button">清空</button>'
      + "</div>"
      // 详情抽屉（遮罩 + 右侧面板）
      + '<div class="pc-orders-drawer-mask" id="pcOrdersDrawerMask" hidden></div>'
      + '<aside class="pc-orders-drawer" id="pcOrdersDrawer" hidden>'
      + '<header class="pc-orders-drawer-head">'
      + '<span class="pc-orders-drawer-title" id="pcOrdersDrawerTitle">订单详情</span>'
      + '<button class="pc-orders-drawer-close" id="pcOrdersDrawerClose" type="button" aria-label="关闭">×</button>'
      + "</header>"
      + '<div class="pc-orders-drawer-body" id="pcOrdersDrawerBody"></div>'
      + "</aside>";

    // 状态筛选 chip 切换 → 清空勾选、回首页、重拉。
    var tabsEl = document.getElementById("pcOrdersTabs");
    if (tabsEl) {
      tabsEl.addEventListener("click", function (event) {
        var chip = event.target.closest("[data-orders-status]");
        if (!chip) return;
        var s = chip.getAttribute("data-orders-status");
        if (!s || s === state.ordersStatus) return;
        state.ordersStatus = s;
        state.ordersPage = 0;
        ordersClearSelection();
        Array.prototype.forEach.call(tabsEl.querySelectorAll(".pc-orders-chip"), function (el) {
          el.classList.toggle("active", el === chip);
        });
        loadOrders(true);
      });
    }

    // 搜索（防抖）→ 清空勾选、回首页、重拉。
    var searchEl = document.getElementById("pcOrdersSearch");
    if (searchEl) {
      searchEl.addEventListener("input", function () {
        if (ordersSearchTimer) clearTimeout(ordersSearchTimer);
        ordersSearchTimer = setTimeout(function () {
          state.ordersSearch = searchEl.value || "";
          state.ordersPage = 0;
          ordersClearSelection();
          loadOrders(true);
        }, 300);
      });
    }

    // 刷新（强制重拉当前页）。
    var refreshEl = document.getElementById("pcOrdersRefreshBtn");
    if (refreshEl) {
      refreshEl.addEventListener("click", function () { loadOrders(true); });
    }
    var bulkLogEl = document.getElementById("pcOrdersBulkLogisticsBtn");
    if (bulkLogEl) {
      bulkLogEl.addEventListener("click", batchQueryShippedLogistics);
    }

    // 表格区交互（事件委托）：勾选框 / 行点击开抽屉 / 分页。
    var tableWrap = document.getElementById("pcOrdersTableWrap");
    if (tableWrap) {
      tableWrap.addEventListener("click", handleOrdersTableClick);
      tableWrap.addEventListener("change", handleOrdersTableChange);
    }
    var pager = document.getElementById("pcOrdersPager");
    if (pager) {
      pager.addEventListener("click", function (event) {
        var btn = event.target.closest("[data-orders-page]");
        if (!btn || btn.disabled) return;
        var p = Number(btn.getAttribute("data-orders-page"));
        if (!isNaN(p)) {
          state.ordersPage = p;
          // 跨页保留勾选：翻页不清空（集合按 id 存，渲染时自动回勾）。
          closeOrdersDrawer();
          loadOrders(true);
        }
      });
    }

    // 批量条交互。
    var selectAll = document.getElementById("pcOrdersSelectAll");
    if (selectAll) {
      selectAll.addEventListener("change", function () {
        if (!state.ordersSelectedIds) return;
        if (selectAll.checked) {
          state.orders.forEach(function (o) { state.ordersSelectedIds.add(orderId(o)); });
        } else {
          state.orders.forEach(function (o) { state.ordersSelectedIds.delete(orderId(o)); });
        }
        // 同步行内勾选框，不整表重渲染。
        var wrap = document.getElementById("pcOrdersTableWrap");
        if (wrap) {
          Array.prototype.forEach.call(wrap.querySelectorAll("[data-orders-select]"), function (box) {
            box.checked = state.ordersSelectedIds.has(box.getAttribute("data-orders-select"));
          });
        }
        updateOrdersBulkBar();
      });
    }
    var bulkApply = document.getElementById("pcOrdersBulkApply");
    if (bulkApply) bulkApply.addEventListener("click", handleOrdersBulkUpdate);
    var bulkDelete = document.getElementById("pcOrdersBulkDelete");
    if (bulkDelete) bulkDelete.addEventListener("click", handleOrdersBulkDelete);
    var bulkClear = document.getElementById("pcOrdersBulkClear");
    if (bulkClear) {
      bulkClear.addEventListener("click", function () {
        ordersClearSelection();
        var bs = document.getElementById("pcOrdersBulkStatus");
        if (bs) bs.value = "";
        syncOrdersRowChecks();
        updateOrdersBulkBar();
      });
    }

    // 抽屉关闭：× / 点遮罩 / ESC。关前确认未保存的单号/备注。
    var closeEl = document.getElementById("pcOrdersDrawerClose");
    if (closeEl) closeEl.addEventListener("click", function () { if (confirmDropOrdersDrawer()) closeOrdersDrawer(); });
    var maskEl = document.getElementById("pcOrdersDrawerMask");
    if (maskEl) maskEl.addEventListener("click", function () { if (confirmDropOrdersDrawer()) closeOrdersDrawer(); });
    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape" && state.ordersDrawerId && confirmDropOrdersDrawer()) closeOrdersDrawer();
    });

    // 抽屉内交互（事件委托）：复制 / 状态下拉 / 快递 chip / 保存单号 / 保存备注。
    var drawerBody = document.getElementById("pcOrdersDrawerBody");
    if (drawerBody) {
      drawerBody.addEventListener("click", handleOrdersDrawerClick);
      drawerBody.addEventListener("change", handleOrdersDrawerChange);
      drawerBody.addEventListener("input", handleOrdersDrawerInput);
    }

    return host;
  }

  function setOrdersMsg(text, tone) {
    var el = document.getElementById("pcOrdersMsg");
    if (!el) return;
    el.textContent = text || "";
    if (tone) el.dataset.tone = tone;
    else delete el.dataset.tone;
  }

  // 清空勾选集合。
  function ordersClearSelection() {
    if (state.ordersSelectedIds) state.ordersSelectedIds.clear();
  }

  // 加载（首次或强制）。force=true 时无视 ordersLoaded 重新拉取（切筛选 / 翻页 / 刷新）。
  function loadOrders(force) {
    var host = ensureOrdersShell();
    if (!host) return;

    var wrap = document.getElementById("pcOrdersTableWrap");
    var countEl = document.getElementById("pcOrdersCount");

    if (!Core.activeSession()) {
      if (wrap) wrap.innerHTML = '<p class="pc-empty-text">请先登录管理员账号。</p>';
      if (countEl) countEl.textContent = "";
      return;
    }

    if (state.ordersLoaded && !force) {
      // 已加载过且非强制：直接重渲染（切回面板不重复请求）。
      renderOrdersTable();
      return;
    }

    if (wrap) wrap.innerHTML = '<p class="pc-empty-text">加载中…</p>';
    setOrdersMsg("", null);

    var status = state.ordersStatus === "all" ? "" : state.ordersStatus;
    var skip = state.ordersPage * ORDERS_PAGE_SIZE;

    Core.callAdminOrders("list", {
      status: status,
      search: state.ordersSearch,
      limit: ORDERS_PAGE_SIZE,
      skip: skip
    })
      .then(function (data) {
        state.orders = (data && Array.isArray(data.items)) ? data.items : [];
        state.ordersTotal = (data && data.total) || 0;
        state.ordersLoaded = true;

        // 翻到了空页面（该页订单被改状态搬走）→ 回退一页重拉。
        var totalPages = Math.max(1, Math.ceil(state.ordersTotal / ORDERS_PAGE_SIZE));
        if (state.orders.length === 0 && state.ordersPage > 0 && state.ordersPage >= totalPages) {
          state.ordersPage = totalPages - 1;
          loadOrders(true);
          return;
        }
        renderOrdersTable();
      })
      .catch(function (err) {
        renderLoadError(wrap, (err && err.message) || "加载失败", function () { loadOrders(true); });
        if (countEl) countEl.textContent = "";
      });
  }

  function renderOrdersTable() {
    var wrap = document.getElementById("pcOrdersTableWrap");
    var countEl = document.getElementById("pcOrdersCount");
    var pagerEl = document.getElementById("pcOrdersPager");
    if (!wrap) return;

    if (!state.ordersLoaded) {
      wrap.innerHTML = '<p class="pc-empty-text">加载中…</p>';
      return;
    }

    if (countEl) countEl.textContent = "当前筛选 " + (state.ordersTotal || 0) + " 单";

    if (!Array.isArray(state.orders) || state.orders.length === 0) {
      wrap.innerHTML = '<p class="pc-empty-text">没有符合条件的订单。</p>';
      if (pagerEl) pagerEl.innerHTML = "";
      updateOrdersBulkBar();
      return;
    }

    var head =
      "<thead><tr>"
      + '<th class="pc-orders-col-check"></th>'
      + '<th class="pc-orders-col-recipient">收件人</th>'
      + '<th class="pc-orders-col-summary">礼品 · 件数</th>'
      + '<th class="pc-orders-col-status">状态</th>'
      + '<th class="pc-orders-col-date">下单时间</th>'
      + '<th class="pc-orders-col-view"></th>'
      + "</tr></thead>";

    var body = "<tbody>" + state.orders.map(function (o) {
      var id = orderId(o);
      var idEsc = escapeHtml(id);
      var addr = o.address || {};
      var items = Array.isArray(o.items) ? o.items : [];
      var checked = state.ordersSelectedIds && state.ordersSelectedIds.has(id) ? " checked" : "";
      var isOpen = state.ordersDrawerId === id ? " pc-orders-row-active" : "";
      return '<tr class="pc-orders-row' + isOpen + '" data-orders-row="' + idEsc + '">'
        + '<td class="pc-orders-col-check"><input type="checkbox" class="pc-orders-check" data-orders-select="' + idEsc + '"' + checked + "></td>"
        + '<td class="pc-orders-col-recipient"><span class="pc-orders-recipient">' + escapeHtml(addr.recipient || "(无收件人)") + "</span>"
        + '<span class="pc-orders-src ' + (o.source === "web" ? "pc-orders-src-web" : "pc-orders-src-mp") + '">' + (o.source === "web" ? "网页" : "小程序") + "</span>"
        + (addr.phone ? '<span class="pc-orders-phone">' + escapeHtml(addr.phone) + "</span>" : "") + "</td>"
        + '<td class="pc-orders-col-summary">' + escapeHtml((items[0] && items[0].title) || "礼品") + (items.length > 1 ? "等" : "") + " · " + escapeHtml(items.length) + "件</td>"
        + '<td class="pc-orders-col-status"><span class="pc-order-status ' + orderStatusCls(o.status) + '">'
        + escapeHtml(orderStatusText(o.status)) + "</span></td>"
        + '<td class="pc-orders-col-date">' + escapeHtml(formatOrderDate(o.createdAt)) + "</td>"
        + '<td class="pc-orders-col-view"><button class="pc-orders-view-btn" type="button" data-orders-view="' + idEsc + '">查看</button></td>'
        + "</tr>";
    }).join("") + "</tbody>";

    wrap.innerHTML = '<table class="pc-orders-table">' + head + body + "</table>";

    // 分页（每页 50）。
    if (pagerEl) {
      var totalPages = Math.max(1, Math.ceil((state.ordersTotal || 0) / ORDERS_PAGE_SIZE));
      var page = state.ordersPage;
      var start = state.ordersTotal === 0 ? 0 : page * ORDERS_PAGE_SIZE + 1;
      var end = Math.min(state.ordersTotal, (page + 1) * ORDERS_PAGE_SIZE);
      var prevDis = page <= 0 ? " disabled" : "";
      var nextDis = page >= totalPages - 1 ? " disabled" : "";
      pagerEl.innerHTML =
        '<button class="pc-btn-ghost pc-orders-page-btn" type="button" data-orders-page="' + (page - 1) + '"' + prevDis + ">‹ 上一页</button>"
        + '<span class="pc-orders-page-info">' + start + "-" + end + " / 共 " + (state.ordersTotal || 0) + " 单 · 第 " + (page + 1) + " / " + totalPages + " 页</span>"
        + '<button class="pc-btn-ghost pc-orders-page-btn" type="button" data-orders-page="' + (page + 1) + '"' + nextDis + ">下一页 ›</button>";
    }

    updateOrdersBulkBar();
  }

  // 同步当前页所有行内勾选框（与 selectedIds 集合一致）。
  function syncOrdersRowChecks() {
    var wrap = document.getElementById("pcOrdersTableWrap");
    if (!wrap) return;
    Array.prototype.forEach.call(wrap.querySelectorAll("[data-orders-select]"), function (box) {
      box.checked = !!(state.ordersSelectedIds && state.ordersSelectedIds.has(box.getAttribute("data-orders-select")));
    });
  }

  // 批量条：仅当本页有订单时显示；同步全选框（全选 / 半选）与已选计数。
  function updateOrdersBulkBar() {
    var bar = document.getElementById("pcOrdersBulkBar");
    if (!bar) return;
    var total = state.orders.length;
    bar.hidden = total === 0;

    var selectedOnPage = state.ordersSelectedIds
      ? state.orders.filter(function (o) { return state.ordersSelectedIds.has(orderId(o)); }).length
      : 0;

    var selectAll = document.getElementById("pcOrdersSelectAll");
    if (selectAll) {
      selectAll.checked = total > 0 && selectedOnPage === total;
      selectAll.indeterminate = selectedOnPage > 0 && selectedOnPage < total;
    }
    var countEl = document.getElementById("pcOrdersSelectedCount");
    if (countEl) {
      var size = state.ordersSelectedIds ? state.ordersSelectedIds.size : 0;
      countEl.textContent = "已选 " + size + " 单" + (size > selectedOnPage ? "（含其它页）" : "");
    }
  }

  // 表格点击委托：行 / 查看按钮 → 开抽屉。
  function handleOrdersTableClick(event) {
    // 勾选框走 change 处理，这里忽略其点击冒泡。
    if (event.target.closest("[data-orders-select]")) {
      event.stopPropagation();
      return;
    }
    var viewBtn = event.target.closest("[data-orders-view]");
    if (viewBtn) {
      openOrdersDrawer(viewBtn.getAttribute("data-orders-view"));
      return;
    }
    var row = event.target.closest("[data-orders-row]");
    if (row) {
      openOrdersDrawer(row.getAttribute("data-orders-row"));
    }
  }

  // 表格 change 委托：行勾选框。
  function handleOrdersTableChange(event) {
    var box = event.target.closest("[data-orders-select]");
    if (!box || !state.ordersSelectedIds) return;
    var id = box.getAttribute("data-orders-select");
    if (box.checked) state.ordersSelectedIds.add(id);
    else state.ordersSelectedIds.delete(id);
    updateOrdersBulkBar();
  }

  function findOrder(id) {
    for (var i = 0; i < state.orders.length; i += 1) {
      if (orderId(state.orders[i]) === id) return state.orders[i];
    }
    return null;
  }

  // 批量改状态：确认 → update-status-bulk → 清空勾选、重拉当前页。
  function handleOrdersBulkUpdate() {
    if (state.ordersDrawerSaving) return;
    var sel = document.getElementById("pcOrdersBulkStatus");
    var status = sel ? sel.value : "";
    if (!status) {
      setOrdersMsg("请选择要改成的状态。", "error");
      return;
    }
    var ids = state.ordersSelectedIds ? Array.from(state.ordersSelectedIds) : [];
    if (ids.length === 0) {
      setOrdersMsg("请先勾选订单。", "error");
      return;
    }

    // 确认文案：跨页勾选时披露「其它页」数量，危险终态加退积分/不可逆告警。
    var onPage = state.ordersSelectedIds
      ? state.orders.filter(function (o) { return state.ordersSelectedIds.has(orderId(o)); }).length
      : 0;
    var offPage = ids.length - onPage;
    var msg = "确认把 " + ids.length + " 单改为「" + ORDER_STATUS_LABEL[status] + "」？";
    if (offPage > 0) msg += "\n其中 " + offPage + " 单不在当前页、无法在此逐条核对。";
    if (status === "cancelled") msg += "\n「已取消」通常会退还用户积分、用户端立即可见，不可轻易撤回。";
    else if (status === "shipped") msg += "\n「运输中」用户端将立即显示已发货 / 运输中。";
    else if (status === "signed") msg += "\n「已签收」表示客户已收到礼品。";
    if (!window.confirm(msg)) return;

    setOrdersMsg("批量更新中…", null);
    Core.callAdminOrders("update-status-bulk", { orderIds: ids, status: status })
      .then(function (res) {
        ordersClearSelection();
        if (sel) sel.value = "";
        var updated = (res && res.updated != null) ? res.updated : ids.length;
        var failed = (res && res.failed) || 0;
        setOrdersMsg("成功 " + updated + " 单，失败 " + failed + " 单。", "success");
        toast("批量更新：成功 " + updated + " 单" + (failed ? "，失败 " + failed + " 单" : ""), failed ? "error" : "success");
        closeOrdersDrawer();
        loadOrders(true);
        loadBadges(); // 刷新待办角标
      })
      .catch(function (err) {
        setOrdersMsg((err && err.message) || "批量更新失败", "error");
        toast((err && err.message) || "批量更新失败", "error");
      });
  }

  // 批量硬删（清理测试单）：二次确认 → delete-orders-bulk → 失效看板缓存 → 重拉当前页。
  function handleOrdersBulkDelete() {
    var ids = state.ordersSelectedIds ? Array.from(state.ordersSelectedIds) : [];
    if (ids.length === 0) {
      setOrdersMsg("请先勾选订单。", "error");
      return;
    }
    var onPage = state.ordersSelectedIds
      ? state.orders.filter(function (o) { return state.ordersSelectedIds.has(orderId(o)); }).length
      : 0;
    var offPage = ids.length - onPage;
    var msg = "确认永久删除 " + ids.length + " 单？\n不可恢复；数据看板统计会相应减少。仅建议用于清理测试单。";
    if (offPage > 0) msg += "\n其中 " + offPage + " 单不在当前页、无法在此逐条核对。";
    if (!window.confirm(msg)) return;

    setOrdersMsg("批量删除中…", null);
    Core.deleteOrdersBulk(ids)
      .then(function (res) {
        ordersClearSelection();
        var deleted = (res && res.deleted != null) ? res.deleted : ids.length;
        var failed = (res && res.failed) || 0;
        state.statsLoaded = false; // 失效看板缓存 → 下次打开数据看板重算
        setOrdersMsg("已删除 " + deleted + " 单" + (failed ? "，失败 " + failed + " 单" : "") + "。", failed ? "error" : "success");
        toast("批量删除：成功 " + deleted + " 单" + (failed ? "，失败 " + failed + " 单" : ""), failed ? "error" : "success");
        closeOrdersDrawer();
        loadOrders(true); // 重拉刷新 total / 列表
        loadBadges();
      })
      .catch(function (err) {
        setOrdersMsg((err && err.message) || "批量删除失败", "error");
        toast((err && err.message) || "批量删除失败", "error");
      });
  }

  // ----- 详情抽屉 -----

  // 礼品清单 HTML（图 + 标题 + 积分×数量）。
  function ordersItemsHtml(items) {
    if (!Array.isArray(items) || items.length === 0) {
      return '<p class="pc-orders-empty-line">（无礼品明细）</p>';
    }
    return '<div class="pc-orders-items">' + items.map(function (it) {
      var img = it.imageUrl
        ? '<img class="pc-orders-item-img" src="' + escapeHtml(it.imageUrl) + '" alt="" loading="lazy">'
        : '<span class="pc-orders-item-img pc-orders-item-img-empty"></span>';
      return '<div class="pc-orders-item">' + img
        + '<div class="pc-orders-item-body">'
        + '<span class="pc-orders-item-title">' + escapeHtml(it.title || "") + "</span>"
        + '<span class="pc-orders-item-meta">' + escapeHtml(it.cardsNeeded || 0) + " 积分 × " + escapeHtml(it.qty || 1) + "</span>"
        + "</div></div>";
    }).join("") + "</div>";
  }

  // 抽屉内容（热替换，不重建外壳 / 不重绑事件）。
  function renderOrdersDrawerBody(o) {
    var body = document.getElementById("pcOrdersDrawerBody");
    if (!body) return;
    if (!o) {
      body.innerHTML = '<p class="pc-empty-text">订单已不在当前列表，请刷新。</p>';
      return;
    }

    var id = orderId(o);
    var idEsc = escapeHtml(id);
    var addr = o.address || {};

    var curStatus = normOrderStatus(o.status);
    var statusSelect = '<select class="pc-orders-status-select" data-orders-status-select="' + idEsc + '">'
      + Object.keys(ORDER_STATUS_LABEL).map(function (s) {
        return '<option value="' + escapeHtml(s) + '"' + (s === curStatus ? " selected" : "") + ">"
          + escapeHtml(ORDER_STATUS_LABEL[s]) + "</option>";
      }).join("")
      + "</select>";

    var carrierChips = ORDER_CARRIERS.map(function (c) {
      return '<button class="pc-orders-carrier-chip" type="button" data-orders-carrier="' + escapeHtml(c) + '">'
        + escapeHtml(c) + "</button>";
    }).join("");

    body.innerHTML =
      // 收货信息（一键复制）
      '<section class="pc-orders-sec">'
      + '<div class="pc-orders-sec-head"><strong>收货信息</strong>'
      + '<button class="pc-orders-copy-btn" type="button" data-orders-copy="' + idEsc + '">复制</button></div>'
      + '<p class="pc-orders-addr-line">' + escapeHtml(addr.recipient || "") + "　" + escapeHtml(addr.phone || "") + "</p>"
      + '<p class="pc-orders-addr-line">' + escapeHtml(addr.province || "") + " " + escapeHtml(addr.city || "") + " "
      + escapeHtml(addr.district || "") + " " + escapeHtml(addr.detail || "") + "</p>"
      + "</section>"
      // 礼品清单
      + '<section class="pc-orders-sec">'
      + '<div class="pc-orders-sec-head"><strong>礼品清单</strong></div>'
      + ordersItemsHtml(o.items)
      + "</section>"
      // 客户备注
      + (o.remark
        ? '<section class="pc-orders-sec"><div class="pc-orders-sec-head"><strong>客户备注</strong></div>'
          + '<p class="pc-orders-remark">' + escapeHtml(o.remark) + "</p></section>"
        : "")
      // 订单号
      + '<section class="pc-orders-sec">'
      + '<div class="pc-orders-sec-head"><strong>订单号</strong></div>'
      + '<p class="pc-orders-id">' + idEsc + "</p>"
      + "</section>"
      // 状态
      + '<section class="pc-orders-sec">'
      + '<div class="pc-orders-sec-head"><strong>更新状态</strong></div>'
      + statusSelect
      + "</section>"
      // 快递
      + '<section class="pc-orders-sec">'
      + '<div class="pc-orders-sec-head"><strong>快递单号</strong></div>'
      + '<div class="pc-orders-tracking-row">'
      + '<input class="pc-orders-input pc-orders-tracking-company" type="text" placeholder="快递公司（可选）" value="'
      + escapeHtml(o.trackingCompany || "") + '" data-orders-tracking-company="' + idEsc + '">'
      + '<input class="pc-orders-input pc-orders-tracking-no" type="text" placeholder="快递单号" value="'
      + escapeHtml(o.trackingNo || "") + '" data-orders-tracking-no="' + idEsc + '">'
      + "</div>"
      + '<input class="pc-orders-input pc-orders-tracking-phone" type="text" placeholder="顺丰必填：收件人或寄件人手机号" value="'
      + escapeHtml(o.trackingPhone || (o.address && o.address.phone) || "") + '" data-orders-tracking-phone="' + idEsc + '">'
      + '<div class="pc-orders-carrier-chips"><span class="pc-orders-carrier-label">常用：</span>' + carrierChips + "</div>"
      + '<button class="pc-btn-primary pc-orders-tracking-save" type="button" data-orders-save-tracking="' + idEsc + '">保存单号</button>'
      + "</section>"
      // 物流轨迹（快递100 推送自动写入；老单点「刷新物流」用实时查询拉取）
      + (o.trackingNo
        ? '<section class="pc-orders-sec"><div class="pc-orders-sec-head"><strong>物流轨迹</strong>'
          + (o.signedAt ? '<span class="pc-orders-sec-hint">已签收</span>' : '')
          + '<button class="pc-btn-ghost pc-orders-query-btn" type="button" data-orders-query="' + idEsc + '">刷新物流</button>'
          + "</div>"
          + ((Array.isArray(o.logisticsNodes) && o.logisticsNodes.length)
            ? '<div class="pc-orders-timeline">'
              + o.logisticsNodes.map(function (n, i) {
                return '<div class="pc-orders-tl-node' + (i === 0 ? " latest" : "") + '">'
                  + '<span class="pc-orders-tl-dot"></span>'
                  + '<div class="pc-orders-tl-body"><p class="pc-orders-tl-ctx">' + escapeHtml(n.context || "") + "</p>"
                  + '<p class="pc-orders-tl-time">' + escapeHtml(n.time || "") + "</p></div></div>";
              }).join("")
              + "</div>"
            : '<p class="pc-orders-sec-hint">暂无物流节点。点「刷新物流」立即查询；新发货的单也会自动更新。</p>')
          + ((/顺丰/.test(o.trackingCompany || "") || o.courierCode === "shunfeng")
            ? '<p class="pc-orders-sf-tip">⚠️ 顺丰提示：拼多多/代发单的收件手机是隐私号，刷新会报「验证码错误」、查不到。这种情况把单号复制发给客户，让客户自己在顺丰里查即可（客户查不用验手机）。</p>'
            : '')
          + "</section>"
        : "")
      // 内部备注（客户不可见）
      + '<section class="pc-orders-sec">'
      + '<div class="pc-orders-sec-head"><strong>商家内部备注</strong><span class="pc-orders-sec-hint">仅你可见，客户看不到</span></div>'
      + '<input class="pc-orders-input pc-orders-note-input" type="text" placeholder="例如：客户已电话确认 / 等下卡" value="'
      + escapeHtml(o.adminNote || "") + '" data-orders-note="' + idEsc + '">'
      + '<button class="pc-btn-ghost pc-orders-note-save" type="button" data-orders-save-note="' + idEsc + '">保存备注</button>'
      + "</section>"
      // 删除订单（硬删，主要用于清理测试单；删后数据看板自动同步）
      + '<section class="pc-orders-sec pc-orders-danger">'
      + '<div class="pc-orders-sec-head"><strong>删除订单</strong><span class="pc-orders-sec-hint">永久删除，不可恢复，仅用于清理测试单</span></div>'
      + '<button class="pc-orders-delete-btn" type="button" data-orders-delete="' + idEsc + '">🗑 删除此订单</button>'
      + "</section>"
      // 抽屉内联消息
      + '<p class="pc-inline-msg" id="pcOrdersDrawerMsg"></p>';
  }

  function setOrdersDrawerMsg(text, tone) {
    var el = document.getElementById("pcOrdersDrawerMsg");
    if (!el) return;
    el.textContent = text || "";
    if (tone) el.dataset.tone = tone;
    else delete el.dataset.tone;
  }

  // 抽屉内是否有未保存的单号 / 备注（与已保存值不一致）。
  function ordersDrawerDirty() {
    var id = state.ordersDrawerId;
    if (!id) return false;
    var o = findOrder(id);
    if (!o) return false;
    var noInput = document.querySelector('[data-orders-tracking-no="' + ordersCssEscape(id) + '"]');
    var companyInput = document.querySelector('[data-orders-tracking-company="' + ordersCssEscape(id) + '"]');
    var noteInput = document.querySelector('[data-orders-note="' + ordersCssEscape(id) + '"]');
    if (noInput && noInput.value.trim() !== (o.trackingNo || "")) return true;
    if (companyInput && companyInput.value.trim() !== (o.trackingCompany || "")) return true;
    if (noteInput && noteInput.value.trim() !== (o.adminNote || "")) return true;
    return false;
  }
  // 关闭 / 切换前确认：有未保存单号/备注则拦。
  function confirmDropOrdersDrawer() {
    return !ordersDrawerDirty() || window.confirm("有未保存的快递单号 / 备注，确定放弃并关闭？");
  }

  // 打开抽屉（或热替换内容，切换行高亮）。
  function openOrdersDrawer(id) {
    // 已开着另一单且有未保存内容 → 先确认再切。
    if (state.ordersDrawerId && state.ordersDrawerId !== id && !confirmDropOrdersDrawer()) return;
    var o = findOrder(id);
    if (!o) return;
    state.ordersDrawerId = id;

    var drawer = document.getElementById("pcOrdersDrawer");
    var mask = document.getElementById("pcOrdersDrawerMask");
    var titleEl = document.getElementById("pcOrdersDrawerTitle");
    if (titleEl) {
      var addr = o.address || {};
      titleEl.textContent = (addr.recipient || "订单") + " · " + orderStatusText(o.status);
    }
    renderOrdersDrawerBody(o);

    if (mask) mask.hidden = false;
    if (drawer) {
      drawer.hidden = false;
      // 触发进入动画（下一帧加 open class）。
      requestAnimationFrame(function () { drawer.classList.add("pc-orders-drawer-open"); });
    }
    // 行高亮：清旧、点新。
    var wrap = document.getElementById("pcOrdersTableWrap");
    if (wrap) {
      Array.prototype.forEach.call(wrap.querySelectorAll(".pc-orders-row-active"), function (r) {
        r.classList.remove("pc-orders-row-active");
      });
      var rowEl = wrap.querySelector('[data-orders-row="' + ordersCssEscape(id) + '"]');
      if (rowEl) rowEl.classList.add("pc-orders-row-active");
    }
  }

  function closeOrdersDrawer() {
    state.ordersDrawerId = "";
    var drawer = document.getElementById("pcOrdersDrawer");
    var mask = document.getElementById("pcOrdersDrawerMask");
    if (drawer) {
      drawer.classList.remove("pc-orders-drawer-open");
      // 动画结束后隐藏（与 CSS transition 时长一致）。
      setTimeout(function () {
        if (!state.ordersDrawerId) drawer.hidden = true;
      }, 240);
    }
    if (mask) mask.hidden = true;
    var wrap = document.getElementById("pcOrdersTableWrap");
    if (wrap) {
      Array.prototype.forEach.call(wrap.querySelectorAll(".pc-orders-row-active"), function (r) {
        r.classList.remove("pc-orders-row-active");
      });
    }
  }

  // 抽屉点击委托：复制 / 快递 chip / 保存单号 / 保存备注。
  function handleOrdersDrawerClick(event) {
    var copyBtn = event.target.closest("[data-orders-copy]");
    if (copyBtn) {
      copyOrderAddress(copyBtn.getAttribute("data-orders-copy"));
      return;
    }
    var chip = event.target.closest("[data-orders-carrier]");
    if (chip) {
      var companyInput = document.querySelector("[data-orders-tracking-company]");
      if (companyInput) {
        companyInput.value = chip.getAttribute("data-orders-carrier");
        delete companyInput.dataset.auto;
      }
      return;
    }
    var saveTracking = event.target.closest("[data-orders-save-tracking]");
    if (saveTracking) {
      handleOrdersTrackingSave(saveTracking.getAttribute("data-orders-save-tracking"));
      return;
    }
    var saveNote = event.target.closest("[data-orders-save-note]");
    if (saveNote) {
      handleOrdersNoteSave(saveNote.getAttribute("data-orders-save-note"));
      return;
    }
    var queryLog = event.target.closest("[data-orders-query]");
    if (queryLog) {
      handleOrdersQueryLogistics(queryLog.getAttribute("data-orders-query"));
      return;
    }
    var del = event.target.closest("[data-orders-delete]");
    if (del) {
      handleOrdersDelete(del.getAttribute("data-orders-delete"));
      return;
    }
  }

  // 抽屉 change 委托：状态下拉 → update-status。
  function handleOrdersDrawerChange(event) {
    var sel = event.target.closest("[data-orders-status-select]");
    if (sel) {
      handleOrdersStatusChange(sel.getAttribute("data-orders-status-select"), sel.value);
    }
  }

  // 抽屉 input 委托：单号自动识别快递公司。
  function handleOrdersDrawerInput(event) {
    var noInput = event.target.closest("[data-orders-tracking-no]");
    if (!noInput) return;
    var companyInput = document.querySelector("[data-orders-tracking-company]");
    if (!companyInput) return;
    var carrier = detectCarrier(noInput.value);
    // 只在公司框为空或之前是自动填的值时覆盖，避免覆盖手填。
    if (carrier && (!companyInput.value || companyInput.dataset.auto === "1")) {
      companyInput.value = carrier;
      companyInput.dataset.auto = "1";
    }
  }

  // 改状态：update-status。过滤态下改成不匹配的状态 → 关抽屉重拉；否则就地更新徽标。
  function handleOrdersStatusChange(id, status) {
    if (!id) return;
    var o = findOrder(id);
    if (!o) return;
    if (status === o.status) return;

    // 危险终态二次确认（不可逆 / 用户端立即可见）。取消则还原下拉。
    if (status === "cancelled" || status === "shipped") {
      var warn = status === "cancelled"
        ? "确认把该订单改为「已取消」？此操作通常会退还用户积分，且用户端立即可见，不可轻易撤回。"
        : "确认把该订单改为「运输中」？用户端将显示已发货 / 运输中。";
      if (!window.confirm(warn)) {
        var selR = document.querySelector('[data-orders-status-select="' + ordersCssEscape(id) + '"]');
        if (selR) selR.value = o.status;
        return;
      }
    }

    setOrdersDrawerMsg("正在保存…", null);
    Core.callAdminOrders("update-status", { orderId: id, status: status })
      .then(function () {
        o.status = status;
        var movedOut = state.ordersStatus !== "all" && state.ordersStatus !== status;
        // 已移出当前筛选 → 从批量勾选集合剔除，避免随后「批量应用」把这条已单独改过的单再次刷成另一目标态。
        if (movedOut && state.ordersSelectedIds) state.ordersSelectedIds.delete(id);
        // 就地更新表格该行徽标 + 抽屉标题，不关抽屉、不整页重拉（保留作业上下文）。
        renderOrdersTable();
        var titleEl = document.getElementById("pcOrdersDrawerTitle");
        if (titleEl) {
          var addr = o.address || {};
          titleEl.textContent = (addr.recipient || "订单") + " · " + (ORDER_STATUS_LABEL[status] || status);
        }
        var rowEl = document.querySelector('[data-orders-row="' + ordersCssEscape(id) + '"]');
        if (rowEl) rowEl.classList.add("pc-orders-row-active"); // 重渲染后重新高亮当前行
        var label = ORDER_STATUS_LABEL[status] || status;
        setOrdersDrawerMsg("已更新为「" + label + "」。", "success");
        toast(movedOut ? "已更新为「" + label + "」（已不在当前筛选，刷新后隐藏）" : "已更新为「" + label + "」", "success");
        loadBadges(); // 刷新待办角标
      })
      .catch(function (err) {
        setOrdersDrawerMsg((err && err.message) || "保存失败", "error");
        toast((err && err.message) || "保存失败", "error");
        // 失败时还原下拉显示。
        var sel = document.querySelector('[data-orders-status-select="' + ordersCssEscape(id) + '"]');
        if (sel) sel.value = o.status;
      });
  }

  // 保存快递：update-tracking，就地写回内存。
  // 刷新物流：实时查询当前完整轨迹（老单/手动刷新用）。
  function handleOrdersQueryLogistics(id) {
    if (!id) return;
    var o = findOrder(id);
    if (!o) return;
    var btn = document.querySelector('[data-orders-query="' + ordersCssEscape(id) + '"]');
    if (btn) { btn.disabled = true; btn.textContent = "查询中…"; }
    var phoneInput = document.querySelector('[data-orders-tracking-phone="' + ordersCssEscape(id) + '"]');
    var phone = phoneInput ? phoneInput.value.trim() : "";
    var companyInput = document.querySelector('[data-orders-tracking-company="' + ordersCssEscape(id) + '"]');
    var trackingCompany = companyInput ? companyInput.value.trim() : "";
    setOrdersDrawerMsg("正在查询物流…", null);
    Core.callAdminOrders("query-logistics", { orderId: id, phone: phone, courierCode: carrierCodeOf(trackingCompany), trackingCompany: trackingCompany })
      .then(function (updated) {
        var becameSigned = updated && updated.status === "signed" && o.status !== "signed";
        if (updated) {
          o.logisticsNodes = updated.logisticsNodes || [];
          o.logisticsState = updated.logisticsState || "";
          o.status = updated.status || o.status;
          o.signedAt = updated.signedAt || o.signedAt;
          renderOrdersDrawerBody(o); // 重渲染抽屉内容以显示新轨迹
        }
        setOrdersDrawerMsg("物流已更新。", "success");
        toast("✅ 物流已刷新", "success");
        loadBadges();
        // 签收后从「运输中」筛选视图移走
        if (becameSigned && state.ordersStatus === "shipped") {
          loadOrders(true);
        } else {
          renderOrdersTable();
        }
      })
      .catch(function (err) {
        if (btn) { btn.disabled = false; btn.textContent = "刷新物流"; }
        setOrdersDrawerMsg((err && err.message) || "查询失败", "error");
        toast((err && err.message) || "查询失败", "error");
      });
  }

  // 一键刷新本页所有「运输中」订单的物流（老单批量补轨迹）。顺序执行，避免高频打快递100。
  function batchQueryShippedLogistics() {
    var targets = (state.orders || []).filter(function (o) {
      return normOrderStatus(o.status) === "shipped" && o.trackingNo;
    });
    if (!targets.length) { toast("本页没有可刷新的运输中订单", "error"); return; }
    var btn = document.getElementById("pcOrdersBulkLogisticsBtn");
    if (btn) btn.disabled = true;
    var ok = 0, fail = 0, i = 0, signedCount = 0;
    function step() {
      if (i >= targets.length) {
        if (btn) { btn.disabled = false; btn.textContent = "刷新本页物流"; }
        loadBadges();
        // 有签收的 + 当前在运输中视图 → 重拉以移走已签收
        if (signedCount > 0 && state.ordersStatus === "shipped") loadOrders(true);
        else renderOrdersTable();
        setOrdersMsg("刷新完成：成功 " + ok + " 单" + (fail ? ("，失败 " + fail + " 单") : ""), "success");
        toast("✅ 物流刷新完成 " + ok + " 单" + (fail ? ("（" + fail + " 失败）") : ""), fail ? "error" : "success");
        return;
      }
      var o = targets[i];
      if (btn) btn.textContent = "刷新中 " + (i + 1) + "/" + targets.length;
      setOrdersMsg("刷新物流 " + (i + 1) + "/" + targets.length + "…", null);
      Core.callAdminOrders("query-logistics", { orderId: orderId(o) })
        .then(function (updated) {
          if (updated) {
            if (updated.status === "signed" && o.status !== "signed") signedCount++;
            o.logisticsNodes = updated.logisticsNodes || [];
            o.logisticsState = updated.logisticsState || "";
            o.status = updated.status || o.status;
            o.signedAt = updated.signedAt || o.signedAt;
          }
          ok++;
        })
        .catch(function () { fail++; })
        .then(function () { i++; step(); });
    }
    step();
  }

  function handleOrdersTrackingSave(id) {
    if (!id) return;
    var o = findOrder(id);
    if (!o) return;
    var noInput = document.querySelector('[data-orders-tracking-no="' + ordersCssEscape(id) + '"]');
    var companyInput = document.querySelector('[data-orders-tracking-company="' + ordersCssEscape(id) + '"]');
    var trackingNo = noInput ? noInput.value.trim() : "";
    var trackingCompany = companyInput ? companyInput.value.trim() : "";
    if (!trackingNo) {
      setOrdersDrawerMsg("请填写快递单号。", "error");
      toast("请先填写快递单号", "error");
      return;
    }
    var courierCode = carrierCodeOf(trackingCompany);
    var phoneInput = document.querySelector('[data-orders-tracking-phone="' + ordersCssEscape(id) + '"]');
    var phone = phoneInput ? phoneInput.value.trim() : "";
    setOrdersDrawerMsg(courierCode ? "正在保存单号…" : "正在保存单号（未识别快递公司，将不自动追踪物流）…", null);

    Core.callAdminOrders("update-tracking", { orderId: id, trackingNo: trackingNo, trackingCompany: trackingCompany, courierCode: courierCode, phone: phone })
      .then(function (res) {
        o.trackingNo = trackingNo;
        o.trackingCompany = trackingCompany;
        o.trackingPhone = phone;
        // 填单号 = 发货 → 云端已自动置「运输中」，前端同步状态 + 重渲染
        if (o.status !== "cancelled") {
          o.status = "shipped";
          renderOrdersTable();
          var titleEl = document.getElementById("pcOrdersDrawerTitle");
          if (titleEl) titleEl.textContent = ((o.address || {}).recipient || "订单") + " · " + orderStatusText("shipped");
          var rowEl = document.querySelector('[data-orders-row="' + ordersCssEscape(id) + '"]');
          if (rowEl) rowEl.classList.add("pc-orders-row-active");
          loadBadges();
        }
        setOrdersDrawerMsg("单号已保存，已自动标记「运输中」并推送用户。", "success");
        toast("✅ 单号已保存，已发货并推送用户", "success");
      })
      .catch(function (err) {
        setOrdersDrawerMsg((err && err.message) || "保存失败", "error");
        toast("保存失败：" + ((err && err.message) || ""), "error");
      });
  }

  // 硬删订单（清理测试单）：二次确认 → delete-order → 内存移除 + 总数-1 + 重渲染表
  //   + 失效看板缓存（下次打开数据看板会重新拉取实时统计）+ 关抽屉。
  function handleOrdersDelete(id) {
    if (!id) return;
    var o = findOrder(id);
    if (!o) return;
    var addr = o.address || {};
    var who = addr.recipient ? "「" + addr.recipient + "」的" : "这笔";
    if (!window.confirm("永久删除" + who + "订单？\n不可恢复；数据看板统计会相应减少。仅建议用于清理测试单。")) return;
    setOrdersDrawerMsg("正在删除…", null);
    Core.deleteOrder(id)
      .then(function () {
        state.orders = state.orders.filter(function (x) { return orderId(x) !== id; });
        if (state.ordersSelectedIds) state.ordersSelectedIds.delete(id);
        if (typeof state.ordersTotal === "number") state.ordersTotal = Math.max(0, state.ordersTotal - 1);
        state.statsLoaded = false; // 失效看板缓存 → 下次打开重算（getStats 实时查 orders）
        closeOrdersDrawer();
        renderOrdersTable();
        toast("订单已删除，数据看板将自动同步", "success");
        loadBadges();
      })
      .catch(function (err) {
        setOrdersDrawerMsg((err && err.message) || "删除失败", "error");
        toast((err && err.message) || "删除失败", "error");
      });
  }

  // 保存内部备注：update-note，就地写回内存。
  function handleOrdersNoteSave(id) {
    if (!id) return;
    var o = findOrder(id);
    if (!o) return;
    var input = document.querySelector('[data-orders-note="' + ordersCssEscape(id) + '"]');
    var adminNote = input ? input.value.trim() : "";
    setOrdersDrawerMsg("正在保存备注…", null);

    Core.callAdminOrders("update-note", { orderId: id, adminNote: adminNote })
      .then(function () {
        o.adminNote = adminNote;
        setOrdersDrawerMsg("备注已保存（仅你可见）。", "success");
      })
      .catch(function (err) {
        setOrdersDrawerMsg((err && err.message) || "保存失败", "error");
      });
  }

  // 复制收件信息（收件人 手机\n省 市 区 详细）。
  function copyOrderAddress(id) {
    var o = findOrder(id);
    if (!o) return;
    var a = o.address || {};
    var text = (a.recipient || "") + " " + (a.phone || "") + "\n"
      + (a.province || "") + " " + (a.city || "") + " " + (a.district || "") + " " + (a.detail || "");
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(
        function () { setOrdersDrawerMsg("已复制收件信息。", "success"); },
        function () { setOrdersDrawerMsg("复制失败，请手动选中。", "error"); }
      );
    } else {
      setOrdersDrawerMsg("当前浏览器不支持自动复制，请手动选中。", "error");
    }
  }

  // 注册面板加载器：首次进入拉取（ordersLoaded 标记防重复），切回不重复请求但提供刷新按钮。
  PANEL_LOADERS.orders = function () { loadOrders(false); };

  // ============ 推荐管理 CRM ============
  (function () {
    var REF_TABS = ["", "待审核", "已加微信", "办卡中", "开户成功", "无效"];
    var REF_STATUS_OPTS = ["待审核", "已加微信", "办卡中", "开户成功", "无效"];
    var refState = { status: "", keyword: "", rows: [], bound: false };

    function $(id) { return document.getElementById(id); }
    function esc(s) {
      return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) {
        return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c];
      });
    }
    function fmtDate(d) {
      if (!d) return "";
      var x = new Date(d);
      if (isNaN(x.getTime())) return "";
      var p = function (n) { return n < 10 ? "0" + n : "" + n; };
      return x.getFullYear() + "-" + p(x.getMonth() + 1) + "-" + p(x.getDate());
    }

    function renderRefTabs() {
      var el = $("pcRefTabs"); if (!el) return;
      el.innerHTML = REF_TABS.map(function (s) {
        var label = s === "" ? "全部" : s;
        return '<button class="pc-ref-tab' + (refState.status === s ? " active" : "") +
          '" data-ref-tab="' + esc(s) + '" type="button">' + esc(label) + "</button>";
      }).join("");
    }

    function statusOptions(cur) {
      return REF_STATUS_OPTS.map(function (s) {
        return '<option value="' + esc(s) + '"' + (s === cur ? " selected" : "") + ">" + esc(s) + "</option>";
      }).join("");
    }

    function renderRefList() {
      var el = $("pcRefList"); if (!el) return;
      if (!refState.rows.length) { el.innerHTML = '<p class="pc-ref-empty">暂无推荐记录</p>'; return; }
      el.innerHTML = refState.rows.map(function (r) {
        return '<div class="pc-ref-row">' +
          '<div class="pc-ref-cell pc-ref-ref"><span class="pc-ref-code">' + esc(r.referrerCode || "-") +
            '</span><span class="pc-ref-nick">' + esc(r.referrerNick || "") + "</span></div>" +
          '<div class="pc-ref-cell pc-ref-friend"><span class="pc-ref-fnick">' + esc(r.refereeNick || "-") +
            '</span><span class="pc-ref-phone">' + esc(r.refereePhone || "") + "</span></div>" +
          '<div class="pc-ref-cell"><select class="pc-ref-status-sel" data-ref-id="' + esc(r._id) +
            '" data-ref-prev="' + esc(r.status) + '">' + statusOptions(r.status) + "</select></div>" +
          '<div class="pc-ref-cell pc-ref-reward">' + (r.rewardPoints > 0 ? "+" + r.rewardPoints + "分" : "—") + "</div>" +
          '<div class="pc-ref-cell pc-ref-date">' + esc(fmtDate(r.createdAt)) + "</div>" +
        "</div>";
      }).join("");
    }

    function loadReferral() {
      bindRef();
      renderRefTabs();
      var listEl = $("pcRefList"); if (listEl) listEl.innerHTML = '<p class="pc-ref-empty">加载中…</p>';
      Core.callAdminOrders("referral-list", { status: refState.status, keyword: refState.keyword })
        .then(function (rows) { refState.rows = rows || []; renderRefList(); })
        .catch(function (e) { if (listEl) listEl.innerHTML = '<p class="pc-ref-empty">加载失败：' + esc(e.message) + "</p>"; });
      loadRanking();
    }

    function loadRanking() {
      var el = $("pcRefRanking"); if (!el) return;
      Core.callAdminOrders("referral-ranking", {})
        .then(function (rows) {
          if (!rows || !rows.length) { el.innerHTML = '<p class="pc-ref-empty">暂无数据</p>'; return; }
          el.innerHTML = rows.map(function (r, i) {
            return '<div class="pc-ref-rank-row"><span class="pc-ref-rank-no">' + (i + 1) + "</span>" +
              '<span class="pc-ref-rank-name">' + esc(r.nick || "微信用户") + " <em>" + esc(r.code || "") + "</em></span>" +
              '<span class="pc-ref-rank-stat">有效 ' + (r.opened || 0) + " / 累计 " + (r.total || 0) + " · " + (r.rewardPoints || 0) + "分</span></div>";
          }).join("");
        })
        .catch(function () { el.innerHTML = '<p class="pc-ref-empty">排行加载失败</p>'; });
    }

    function doAdd() {
      var code = ($("pcRefAddCode").value || "").trim();
      var phone = ($("pcRefAddPhone").value || "").trim();
      var nick = ($("pcRefAddNick").value || "").trim();
      var msg = $("pcRefAddMsg");
      if (!/^\d{6}$/.test(code)) { msg.textContent = "推荐码需6位数字"; msg.className = "pc-ref-add-msg error"; return; }
      if (!/^1\d{10}$/.test(phone)) { msg.textContent = "手机号格式不正确"; msg.className = "pc-ref-add-msg error"; return; }
      msg.textContent = "提交中…"; msg.className = "pc-ref-add-msg";
      Core.callAdminOrders("referral-add", { referrerCode: code, phone: phone, nick: nick })
        .then(function () {
          msg.textContent = "已录入 ✓"; msg.className = "pc-ref-add-msg success";
          $("pcRefAddPhone").value = ""; $("pcRefAddNick").value = "";
          loadReferral();
        })
        .catch(function (e) { msg.textContent = e.message; msg.className = "pc-ref-add-msg error"; });
    }

    function changeStatus(sel) {
      var id = sel.getAttribute("data-ref-id");
      var prev = sel.getAttribute("data-ref-prev");
      var next = sel.value;
      if (next === prev) return;
      var payload = { id: id, status: next };
      if (next === "开户成功") {
        var input = window.prompt("发放奖励积分给推荐人：", "1");
        if (input === null) { sel.value = prev; return; }
        var pts = parseInt(input, 10);
        if (isNaN(pts) || pts < 0) { window.alert("积分不合法"); sel.value = prev; return; }
        payload.rewardPoints = pts;
      } else if (prev === "开户成功") {
        if (!window.confirm("从「开户成功」改为「" + next + "」会回收已发奖励积分，确定？")) { sel.value = prev; return; }
      }
      Core.callAdminOrders("referral-set-status", payload)
        .then(function () { loadReferral(); })
        .catch(function (e) { window.alert(e.message); sel.value = prev; });
    }

    function exportCsv() {
      var rows = refState.rows || [];
      if (!rows.length) { window.alert("当前无数据可导出"); return; }
      var head = ["推荐码", "推荐人", "好友昵称", "手机号", "状态", "奖励积分", "录入时间", "开户时间"];
      var lines = [head.join(",")];
      rows.forEach(function (r) {
        lines.push([r.referrerCode, r.referrerNick, r.refereeNick, r.refereePhone, r.status, r.rewardPoints || 0, fmtDate(r.createdAt), fmtDate(r.openedAt)]
          .map(function (v) { return '"' + String(v == null ? "" : v).replace(/"/g, '""') + '"'; }).join(","));
      });
      var blob = new Blob(["﻿" + lines.join("\n")], { type: "text/csv;charset=utf-8" });
      var url = URL.createObjectURL(blob);
      var a = document.createElement("a");
      a.href = url; a.download = "推荐明细.csv"; a.click();
      setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
    }

    function bindRef() {
      if (refState.bound) return;
      refState.bound = true;
      var tabs = $("pcRefTabs");
      if (tabs) tabs.addEventListener("click", function (e) {
        var b = e.target.closest("[data-ref-tab]"); if (!b) return;
        refState.status = b.getAttribute("data-ref-tab"); renderRefTabs(); loadReferral();
      });
      var list = $("pcRefList");
      if (list) list.addEventListener("change", function (e) {
        var sel = e.target.closest(".pc-ref-status-sel"); if (sel) changeStatus(sel);
      });
      var addBtn = $("pcRefAddBtn"); if (addBtn) addBtn.addEventListener("click", doAdd);
      var searchBtn = $("pcRefSearchBtn"); if (searchBtn) searchBtn.addEventListener("click", function () {
        refState.keyword = ($("pcRefSearch").value || "").trim(); loadReferral();
      });
      var searchInp = $("pcRefSearch"); if (searchInp) searchInp.addEventListener("keydown", function (e) {
        if (e.key === "Enter") { refState.keyword = (searchInp.value || "").trim(); loadReferral(); }
      });
      var refreshBtn = $("pcRefRefreshBtn"); if (refreshBtn) refreshBtn.addEventListener("click", loadReferral);
      var exportBtn = $("pcRefExportBtn"); if (exportBtn) exportBtn.addEventListener("click", exportCsv);
    }

    PANEL_LOADERS.referral = loadReferral;
  })();

  // ============ 启动 ============

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
