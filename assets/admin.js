const config = window.APP_CONFIG || {};
const SESSION_STORAGE_KEY = "gift-site-admin-session";

const adminConfigStatus = document.getElementById("adminConfigStatus");
const adminConfigTip = document.getElementById("adminConfigTip");
const adminAuthState = document.getElementById("adminAuthState");
const adminAuthTip = document.getElementById("adminAuthTip");
const adminAuthForm = document.getElementById("adminAuthForm");
const adminLockedPanel = document.getElementById("adminLockedPanel");
const adminWorkspace = document.getElementById("adminWorkspace");
const adminEmailInput = document.getElementById("adminEmailInput");
const adminPasswordInput = document.getElementById("adminPasswordInput");
const adminLoginButton = document.getElementById("adminLoginButton");
const adminLogoutButton = document.getElementById("adminLogoutButton");
const adminAuthMessage = document.getElementById("adminAuthMessage");
const productForm = document.getElementById("productForm");
const adminImageFile = document.getElementById("adminImageFile");
const adminImageUrl = document.getElementById("adminImageUrl");
const adminPreviewEmpty = document.getElementById("adminPreviewEmpty");
const adminPreviewImage = document.getElementById("adminPreviewImage");
const adminSubmitButton = document.getElementById("adminSubmitButton");
const adminSubmitState = document.getElementById("adminSubmitState");
const adminSubmitMessage = document.getElementById("adminSubmitMessage");
const adminRecentList = document.getElementById("adminRecentList");
const adminRefreshButton = document.getElementById("adminRefreshButton");
const adminCategorySelect = document.getElementById("adminCategorySelect");

const categoryOptions = Array.isArray(config.categories)
  ? config.categories.filter((item) => item.value !== "all")
  : [];

const state = {
  session: null,
  previewUrl: "",
  recentProducts: []
};

function isSupabaseConfigured() {
  return Boolean(config.supabaseUrl && config.supabaseAnonKey && config.productsTable && config.storageBucket);
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => {
    const map = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      "\"": "&quot;",
      "'": "&#39;"
    };

    return map[char] || char;
  });
}

function setAuthMessage(text, tone = "idle") {
  adminAuthMessage.textContent = text;
  adminAuthMessage.dataset.tone = tone;
}

function setSubmitState(text, tone = "idle") {
  adminSubmitState.textContent = text;
  adminSubmitState.classList.remove("admin-status-pill-soft", "admin-status-pill-success", "admin-status-pill-error");

  if (tone === "success") {
    adminSubmitState.classList.add("admin-status-pill-success");
  } else if (tone === "error") {
    adminSubmitState.classList.add("admin-status-pill-error");
  } else {
    adminSubmitState.classList.add("admin-status-pill-soft");
  }
}

function setSubmitMessage(text, tone = "idle") {
  adminSubmitMessage.textContent = text;
  adminSubmitMessage.dataset.tone = tone;
}

function saveSession(session) {
  state.session = session;

  if (session) {
    localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
  } else {
    localStorage.removeItem(SESSION_STORAGE_KEY);
  }
}

function readStoredSession() {
  const raw = localStorage.getItem(SESSION_STORAGE_KEY);

  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw);
  } catch {
    localStorage.removeItem(SESSION_STORAGE_KEY);
    return null;
  }
}

function authHeaders(accessToken, extraHeaders = {}) {
  return {
    apikey: config.supabaseAnonKey,
    Authorization: `Bearer ${accessToken}`,
    ...extraHeaders
  };
}

async function signInWithPassword(email, password) {
  const response = await fetch(`${config.supabaseUrl}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: {
      apikey: config.supabaseAnonKey,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ email, password })
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.msg || data.error_description || "登录失败");
  }

  return data;
}

async function refreshSession(refreshToken) {
  const response = await fetch(`${config.supabaseUrl}/auth/v1/token?grant_type=refresh_token`, {
    method: "POST",
    headers: {
      apikey: config.supabaseAnonKey,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ refresh_token: refreshToken })
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.msg || data.error_description || "会话刷新失败");
  }

  return data;
}

async function fetchCurrentUser(accessToken) {
  const response = await fetch(`${config.supabaseUrl}/auth/v1/user`, {
    headers: authHeaders(accessToken)
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.msg || data.error_description || "读取当前用户失败");
  }

  return data;
}

async function signOutRemote(accessToken) {
  await fetch(`${config.supabaseUrl}/auth/v1/logout`, {
    method: "POST",
    headers: authHeaders(accessToken)
  });
}

async function verifyAdminAccess(accessToken) {
  const response = await fetch(`${config.supabaseUrl}/rest/v1/admin_users?select=email&limit=1`, {
    headers: authHeaders(accessToken)
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`管理员验证失败：${response.status} ${errorText}`);
  }

  const data = await response.json();
  if (!Array.isArray(data) || data.length === 0) {
    throw new Error("当前账号不在管理员名单中");
  }
}

function activeSession() {
  return state.session && state.session.access_token ? state.session : null;
}

function updateAuthUi() {
  const session = activeSession();
  const loggedIn = Boolean(session);

  adminAuthState.textContent = loggedIn ? "已登录" : "未登录";
  adminAuthState.classList.remove("admin-status-pill-soft", "admin-status-pill-success", "admin-status-pill-error");
  adminAuthState.classList.add(loggedIn ? "admin-status-pill-success" : "admin-status-pill-soft");

  if (loggedIn) {
    adminAuthTip.textContent = `当前管理员：${session.user?.email || "未知账号"}。只有管理员名单中的账号可以上传、查看和修改数据。`;
    adminLoginButton.disabled = true;
    adminEmailInput.disabled = true;
    adminPasswordInput.disabled = true;
    adminLogoutButton.disabled = false;
    if (adminLockedPanel) {
      adminLockedPanel.hidden = true;
    }
    if (adminWorkspace) {
      adminWorkspace.hidden = false;
    }
  } else {
    adminAuthTip.textContent = "这里改成 Supabase 账号登录。只有被加入管理员名单的账号才能上传和查看后台数据。";
    adminLoginButton.disabled = false;
    adminEmailInput.disabled = false;
    adminPasswordInput.disabled = false;
    adminLogoutButton.disabled = true;
    if (adminLockedPanel) {
      adminLockedPanel.hidden = false;
    }
    if (adminWorkspace) {
      adminWorkspace.hidden = true;
    }
  }
}

function updateFormAccess() {
  const canUseForm = Boolean(activeSession()) && isSupabaseConfigured();

  Array.from(productForm.elements).forEach((element) => {
    element.disabled = !canUseForm;
  });

  adminRefreshButton.disabled = !canUseForm;
}

function fillCategoryOptions() {
  if (!adminCategorySelect || categoryOptions.length === 0) {
    return;
  }

  adminCategorySelect.innerHTML = categoryOptions.map((item) => {
    return `<option value="${escapeHtml(item.value)}">${escapeHtml(item.label)}</option>`;
  }).join("");
}

function updateConfigStatus() {
  adminConfigStatus.classList.remove("admin-status-pill-success", "admin-status-pill-error");

  if (isSupabaseConfigured()) {
    adminConfigStatus.textContent = "已配置";
    adminConfigStatus.classList.add("admin-status-pill-success");
    adminConfigTip.innerHTML = "Supabase 配置已填写。下一步请在 Supabase 里创建管理员账号，并执行 <code>supabase/hardening.sql</code> 完成权限收口。";
  } else {
    adminConfigStatus.textContent = "未配置";
    adminConfigTip.innerHTML = "请先在 <code>assets/config.js</code> 填好 Supabase 项目地址、匿名 Key、数据表名和 bucket 名。";
  }
}

function updatePreview(url = "") {
  state.previewUrl = url;

  if (!url) {
    adminPreviewImage.hidden = true;
    adminPreviewEmpty.hidden = false;
    adminPreviewImage.removeAttribute("src");
    return;
  }

  adminPreviewImage.src = url;
  adminPreviewImage.hidden = false;
  adminPreviewEmpty.hidden = true;
}

function sanitizeFileName(fileName) {
  return fileName.replace(/[^a-zA-Z0-9._-]/g, "-").replace(/-+/g, "-");
}

function storagePublicUrl(filePath) {
  return `${config.supabaseUrl}/storage/v1/object/public/${config.storageBucket}/${filePath}`;
}

function storageUploadEndpoint(filePath) {
  const encodedPath = filePath.split("/").map((segment) => encodeURIComponent(segment)).join("/");
  return `${config.supabaseUrl}/storage/v1/object/${config.storageBucket}/${encodedPath}`;
}

async function uploadFile(file) {
  const session = activeSession();

  if (!session) {
    throw new Error("请先登录管理员账号");
  }

  const fileName = `${Date.now()}-${sanitizeFileName(file.name)}`;
  const folder = config.storageFolder || "products";
  const filePath = `${folder}/${fileName}`;
  const response = await fetch(storageUploadEndpoint(filePath), {
    method: "POST",
    headers: authHeaders(session.access_token, {
      "Content-Type": file.type || "application/octet-stream",
      "x-upsert": "true"
    }),
    body: file
  });

  if (!response.ok) {
    throw new Error(`图片上传失败：${response.status}`);
  }

  return storagePublicUrl(filePath);
}

async function insertProduct(row) {
  const session = activeSession();

  if (!session) {
    throw new Error("请先登录管理员账号");
  }

  const response = await fetch(`${config.supabaseUrl}/rest/v1/${config.productsTable}`, {
    method: "POST",
    headers: authHeaders(session.access_token, {
      "Content-Type": "application/json",
      Prefer: "return=representation"
    }),
    body: JSON.stringify(row)
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`商品写入失败：${response.status} ${errorText}`);
  }

  const data = await response.json();
  return Array.isArray(data) ? data[0] : data;
}

async function loadRecentProducts() {
  const session = activeSession();

  if (!session) {
    adminRecentList.innerHTML = "<p class=\"admin-status-text\">登录管理员账号后，这里会显示最近录入的商品。</p>";
    return;
  }

  if (!isSupabaseConfigured()) {
    adminRecentList.innerHTML = "<p class=\"admin-status-text\">先完成配置后，这里才会读取最近商品。</p>";
    return;
  }

  try {
    const params = new URLSearchParams({
      select: "id,title,category,price,image_url,created_at,is_active",
      order: "created_at.desc",
      limit: "6"
    });
    const response = await fetch(`${config.supabaseUrl}/rest/v1/${config.productsTable}?${params.toString()}`, {
      headers: authHeaders(session.access_token)
    });

    if (!response.ok) {
      throw new Error(`读取最近商品失败：${response.status}`);
    }

    const data = await response.json();
    state.recentProducts = Array.isArray(data) ? data : [];

    if (state.recentProducts.length === 0) {
      adminRecentList.innerHTML = "<p class=\"admin-status-text\">数据库还没有商品，提交第一件后会显示在这里。</p>";
      return;
    }

    adminRecentList.innerHTML = state.recentProducts.map((item) => {
      const categoryLabel = categoryOptions.find((option) => option.value === item.category)?.label || item.category || "未分类";
      return `
        <article class="admin-recent-item">
          <img class="admin-recent-image" src="${escapeHtml(item.image_url || "images/product-1.svg")}" alt="${escapeHtml(item.title || "商品")}">
          <div class="admin-recent-copy">
            <h3>${escapeHtml(item.title || "未命名商品")}</h3>
            <p>${escapeHtml(categoryLabel)} · ¥${escapeHtml(item.price || 0)}</p>
            <p>${item.is_active ? "已上架" : "未上架"}</p>
          </div>
        </article>
      `;
    }).join("");
  } catch (error) {
    adminRecentList.innerHTML = `<p class="admin-status-text">${escapeHtml(error.message)}</p>`;
  }
}

function bindPreviewEvents() {
  adminImageFile?.addEventListener("change", () => {
    const file = adminImageFile.files?.[0];

    if (file) {
      updatePreview(URL.createObjectURL(file));
      return;
    }

    updatePreview(adminImageUrl?.value || "");
  });

  adminImageUrl?.addEventListener("input", () => {
    if (adminImageFile?.files?.length) {
      return;
    }

    updatePreview(adminImageUrl.value.trim());
  });
}

async function restoreSession() {
  const stored = readStoredSession();

  if (!stored) {
    updateAuthUi();
    updateFormAccess();
    return;
  }

  try {
    let session = stored;

    try {
      const user = await fetchCurrentUser(stored.access_token);
      session = { ...stored, user };
    } catch {
      if (!stored.refresh_token) {
        throw new Error("登录会话已失效，请重新登录");
      }

      const refreshed = await refreshSession(stored.refresh_token);
      const user = await fetchCurrentUser(refreshed.access_token);
      session = { ...refreshed, user };
    }

    await verifyAdminAccess(session.access_token);
    saveSession(session);
    setAuthMessage("管理员登录状态已恢复。", "success");
  } catch (error) {
    saveSession(null);
    setAuthMessage(error.message, "error");
  }

  updateAuthUi();
  updateFormAccess();
  loadRecentProducts();
}

adminAuthForm?.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (!isSupabaseConfigured()) {
    setAuthMessage("还没有填写 Supabase 配置。", "error");
    return;
  }

  const email = adminEmailInput.value.trim();
  const password = adminPasswordInput.value;

  if (!email || !password) {
    setAuthMessage("请输入管理员邮箱和密码。", "error");
    return;
  }

  adminLoginButton.disabled = true;
  setAuthMessage("正在登录并校验管理员权限。");

  try {
    const session = await signInWithPassword(email, password);
    const user = await fetchCurrentUser(session.access_token);
    const nextSession = { ...session, user };
    await verifyAdminAccess(nextSession.access_token);
    saveSession(nextSession);
    adminPasswordInput.value = "";
    setAuthMessage("登录成功，现在可以上新商品。", "success");
    updateAuthUi();
    updateFormAccess();
    await loadRecentProducts();
  } catch (error) {
    saveSession(null);
    updateAuthUi();
    updateFormAccess();
    setAuthMessage(error.message, "error");
  } finally {
    adminLoginButton.disabled = Boolean(activeSession());
  }
});

adminLogoutButton?.addEventListener("click", async () => {
  const session = activeSession();

  try {
    if (session?.access_token) {
      await signOutRemote(session.access_token);
    }
  } catch {
    // Ignore remote logout errors and clear local session anyway.
  }

  saveSession(null);
  adminAuthForm.reset();
  updatePreview("");
  updateAuthUi();
  updateFormAccess();
  setAuthMessage("已退出登录。");
  setSubmitMessage("");
  adminRecentList.innerHTML = "<p class=\"admin-status-text\">登录管理员账号后，这里会显示最近录入的商品。</p>";
});

productForm?.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (!activeSession()) {
    setSubmitMessage("请先登录管理员账号。", "error");
    return;
  }

  if (!isSupabaseConfigured()) {
    setSubmitMessage("还没有填写 Supabase 配置，当前不能提交。", "error");
    return;
  }

  const formData = new FormData(productForm);
  const title = String(formData.get("title") || "").trim();
  const category = String(formData.get("category") || "").trim();
  const price = Number(formData.get("price") || 0);
  const description = String(formData.get("description") || "").trim();
  const actionLabel = String(formData.get("actionLabel") || "立即领取").trim() || "立即领取";
  const actionUrl = String(formData.get("actionUrl") || "#service").trim() || "#service";
  const sortOrder = Number(formData.get("sortOrder") || 10);
  const isActive = formData.get("isActive") === "on";
  const externalImageUrl = String(formData.get("imageUrl") || "").trim();
  const imageFile = adminImageFile?.files?.[0];

  if (!title || !category || !description) {
    setSubmitMessage("标题、分类和说明是必填项。", "error");
    return;
  }

  if (!imageFile && !externalImageUrl) {
    setSubmitMessage("请上传图片，或者填一个图片链接。", "error");
    return;
  }

  adminSubmitButton.disabled = true;
  setSubmitState("提交中", "idle");
  setSubmitMessage("正在上传图片并写入商品数据，请稍候。");

  try {
    const imageUrl = imageFile ? await uploadFile(imageFile) : externalImageUrl;
    await insertProduct({
      title,
      category,
      price,
      description,
      image_url: imageUrl,
      action_label: actionLabel,
      action_url: actionUrl,
      sort_order: sortOrder,
      is_active: isActive
    });

    productForm.reset();
    updatePreview("");
    setSubmitState("提交成功", "success");
    setSubmitMessage("商品已写入 Supabase。刷新前台页面后，这件商品就会出现在列表里。", "success");
    await loadRecentProducts();
  } catch (error) {
    setSubmitState("提交失败", "error");
    setSubmitMessage(error.message, "error");
  } finally {
    adminSubmitButton.disabled = false;
  }
});

adminRefreshButton?.addEventListener("click", () => {
  loadRecentProducts();
});

fillCategoryOptions();
updateConfigStatus();
updateAuthUi();
bindPreviewEvents();
setSubmitState("待提交");
setSubmitMessage("");
updateFormAccess();
restoreSession();
