const config = window.APP_CONFIG || {};
const SESSION_STORAGE_KEY = "gift-site-admin-session";

const adminAuthState = document.getElementById("adminAuthState");
const adminAuthTip = document.getElementById("adminAuthTip");
const adminAuthForm = document.getElementById("adminAuthForm");
const adminAccountCard = document.getElementById("adminAccountCard");
const adminAccountEmail = document.getElementById("adminAccountEmail");
const adminLockedPanel = document.getElementById("adminLockedPanel");
const adminWorkspace = document.getElementById("adminWorkspace");
const adminEmailInput = document.getElementById("adminEmailInput");
const adminPasswordInput = document.getElementById("adminPasswordInput");
const adminLoginButton = document.getElementById("adminLoginButton");
const adminLogoutButton = document.getElementById("adminLogoutButton");
const adminLogoutButtonLogged = document.getElementById("adminLogoutButtonLogged");
const adminAuthMessage = document.getElementById("adminAuthMessage");
const adminTabCreate = document.getElementById("adminTabCreate");
const adminTabEdit = document.getElementById("adminTabEdit");
const adminCreatePanel = document.getElementById("adminCreatePanel");
const adminEditPanel = document.getElementById("adminEditPanel");
const productForm = document.getElementById("productForm");
const adminImageFile = document.getElementById("adminImageFile");
const adminImageUrl = document.getElementById("adminImageUrl");
const adminPreviewEmpty = document.getElementById("adminPreviewEmpty");
const adminPreviewImage = document.getElementById("adminPreviewImage");
const adminEditorTitle = document.getElementById("adminEditorTitle");
const editingProductId = document.getElementById("editingProductId");
const adminSubmitButton = document.getElementById("adminSubmitButton");
const adminCancelEditButton = document.getElementById("adminCancelEditButton");
const adminSubmitState = document.getElementById("adminSubmitState");
const adminSubmitMessage = document.getElementById("adminSubmitMessage");
const adminRecentList = document.getElementById("adminRecentList");
const adminRefreshButton = document.getElementById("adminRefreshButton");
const adminSearchInput = document.getElementById("adminSearchInput");
const adminFilterCategory = document.getElementById("adminFilterCategory");
const adminCategorySelect = document.getElementById("adminCategorySelect");

const categoryOptions = Array.isArray(config.categories)
  ? config.categories.filter((item) => item.value !== "all")
  : [];

const state = {
  session: null,
  previewUrl: "",
  editingProduct: null,
  recentProducts: [],
  activePanel: "create",
  searchQuery: "",
  filterCategory: "all",
  pendingProductId: ""
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
    adminAuthTip.textContent = "登录成功，现在可以管理礼品。";
    adminLoginButton.disabled = true;
    adminEmailInput.disabled = true;
    adminPasswordInput.disabled = true;
    adminLogoutButton.disabled = false;
    if (adminAuthForm) {
      adminAuthForm.hidden = true;
    }
    if (adminAccountCard) {
      adminAccountCard.hidden = false;
    }
    if (adminAccountEmail) {
      adminAccountEmail.textContent = session.user?.email || "未知账号";
    }
    if (adminLockedPanel) {
      adminLockedPanel.hidden = true;
    }
    if (adminWorkspace) {
      adminWorkspace.hidden = false;
    }
  } else {
    adminAuthTip.textContent = "请输入管理员邮箱和密码，登录后即可管理商品。";
    adminLoginButton.disabled = false;
    adminEmailInput.disabled = false;
    adminPasswordInput.disabled = false;
    adminLogoutButton.disabled = true;
    if (adminAuthForm) {
      adminAuthForm.hidden = false;
    }
    if (adminAccountCard) {
      adminAccountCard.hidden = true;
    }
    if (adminAccountEmail) {
      adminAccountEmail.textContent = "-";
    }
    if (adminLockedPanel) {
      adminLockedPanel.hidden = false;
    }
    if (adminWorkspace) {
      adminWorkspace.hidden = true;
    }
  }
}

function updatePanelUi() {
  const isCreate = state.activePanel === "create";

  if (adminTabCreate) {
    adminTabCreate.classList.toggle("active", isCreate);
  }
  if (adminTabEdit) {
    adminTabEdit.classList.toggle("active", !isCreate);
  }
  if (adminCreatePanel) {
    adminCreatePanel.hidden = !isCreate;
  }
  if (adminEditPanel) {
    adminEditPanel.hidden = isCreate;
  }
}

function updateFormAccess() {
  const canUseForm = Boolean(activeSession()) && isSupabaseConfigured();

  Array.from(productForm.elements).forEach((element) => {
    element.disabled = !canUseForm;
  });

  adminRefreshButton.disabled = !canUseForm;
}

function setEditorMode(product = null) {
  state.editingProduct = product;

  if (product) {
    state.activePanel = "create";
    updatePanelUi();
    if (adminEditorTitle) {
      adminEditorTitle.textContent = "编辑商品";
    }
    if (editingProductId) {
      editingProductId.value = product.id || "";
    }
    if (adminSubmitButton) {
      adminSubmitButton.textContent = "保存商品修改";
    }
    if (adminCancelEditButton) {
      adminCancelEditButton.hidden = false;
    }
    setSubmitState("编辑中");
    return;
  }

  if (adminEditorTitle) {
    adminEditorTitle.textContent = "录入商品";
  }
  if (editingProductId) {
    editingProductId.value = "";
  }
  if (adminSubmitButton) {
    adminSubmitButton.textContent = "上传并新增商品";
  }
  if (adminCancelEditButton) {
    adminCancelEditButton.hidden = true;
  }
  setSubmitState("待提交");
}

function filteredRecentProducts() {
  const keyword = state.searchQuery.trim().toLowerCase();
  const selectedCategory = state.filterCategory;

  return state.recentProducts.filter((item) => {
    const categoryLabel = categoryOptions.find((option) => option.value === item.category)?.label || item.category || "";
    const matchesKeyword = !keyword || `${item.title || ""} ${categoryLabel}`.toLowerCase().includes(keyword);
    const matchesCategory = selectedCategory === "all" || item.category === selectedCategory;
    return matchesKeyword && matchesCategory;
  });
}

function renderRecentProducts() {
  const items = filteredRecentProducts();

  if (items.length === 0) {
    adminRecentList.innerHTML = "<p class=\"admin-status-text\">没有找到匹配的礼品。</p>";
    return;
  }

  adminRecentList.innerHTML = items.map((item) => {
    const categoryLabel = categoryOptions.find((option) => option.value === item.category)?.label || item.category || "未分类";
    const cardsNeeded = Number(item.cards_needed || item.price || 0);
    const actionId = escapeHtml(item.id || "");
    const isPending = state.pendingProductId === item.id;
    const toggleLabel = item.is_active ? "下架" : "上架";
    const statusLabel = item.is_active ? "已上架" : "未上架";
    return `
      <article class="admin-recent-item">
        <img class="admin-recent-image" src="${escapeHtml(item.image_url || "images/product-1.svg")}" alt="${escapeHtml(item.title || "商品")}">
        <div class="admin-recent-copy">
          <h3>${escapeHtml(item.title || "未命名商品")}</h3>
          <p>${escapeHtml(categoryLabel)} · ${escapeHtml(cardsNeeded)}卡兑换</p>
          <p>${statusLabel}</p>
        </div>
        <div class="admin-recent-actions">
          <button class="admin-secondary-btn admin-edit-btn" type="button" data-edit-id="${actionId}" ${isPending ? "disabled" : ""}>编辑</button>
          <button class="admin-secondary-btn admin-toggle-btn" type="button" data-toggle-id="${actionId}" ${isPending ? "disabled" : ""}>${toggleLabel}</button>
          <button class="admin-secondary-btn admin-danger-btn" type="button" data-delete-id="${actionId}" ${isPending ? "disabled" : ""}>删除</button>
        </div>
      </article>
    `;
  }).join("");
}

function fillCategoryOptions() {
  if (!adminCategorySelect || categoryOptions.length === 0) {
    return;
  }

  adminCategorySelect.innerHTML = categoryOptions.map((item) => {
    return `<option value="${escapeHtml(item.value)}">${escapeHtml(item.label)}</option>`;
  }).join("");

  if (adminFilterCategory) {
    adminFilterCategory.innerHTML = [
      "<option value=\"all\">全部分类</option>",
      ...categoryOptions.map((item) => `<option value="${escapeHtml(item.value)}">${escapeHtml(item.label)}</option>`)
    ].join("");
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

async function updateProduct(productId, row) {
  const session = activeSession();

  if (!session) {
    throw new Error("请先登录管理员账号");
  }

  const response = await fetch(`${config.supabaseUrl}/rest/v1/${config.productsTable}?id=eq.${encodeURIComponent(productId)}`, {
    method: "PATCH",
    headers: authHeaders(session.access_token, {
      "Content-Type": "application/json",
      Prefer: "return=representation"
    }),
    body: JSON.stringify(row)
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`商品更新失败：${response.status} ${errorText}`);
  }

  const data = await response.json();
  return Array.isArray(data) ? data[0] : data;
}

async function deleteProduct(productId) {
  const session = activeSession();

  if (!session) {
    throw new Error("请先登录管理员账号");
  }

  const response = await fetch(`${config.supabaseUrl}/rest/v1/${config.productsTable}?id=eq.${encodeURIComponent(productId)}`, {
    method: "DELETE",
    headers: authHeaders(session.access_token, {
      Prefer: "return=representation"
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`商品删除失败：${response.status} ${errorText}`);
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
    adminRecentList.innerHTML = "<p class=\"admin-status-text\">当前后台暂时不可用，请联系网站维护人员。</p>";
    return;
  }

  try {
    const primaryParams = new URLSearchParams({
      select: "id,title,category,price,cards_needed,image_url,action_label,action_url,sort_order,created_at,is_active",
      order: "updated_at.desc",
      limit: "50"
    });

    let response = await fetch(`${config.supabaseUrl}/rest/v1/${config.productsTable}?${primaryParams.toString()}`, {
      headers: authHeaders(session.access_token)
    });

    if (!response.ok && response.status === 400) {
      const fallbackParams = new URLSearchParams({
        select: "id,title,category,price,image_url,action_label,action_url,sort_order,created_at,is_active",
        order: "created_at.desc",
        limit: "50"
      });

      response = await fetch(`${config.supabaseUrl}/rest/v1/${config.productsTable}?${fallbackParams.toString()}`, {
        headers: authHeaders(session.access_token)
      });
    }

    if (!response.ok) {
      throw new Error(`读取最近商品失败：${response.status}`);
    }

    const data = await response.json();
    state.recentProducts = Array.isArray(data) ? data : [];
    state.pendingProductId = "";

    if (state.recentProducts.length === 0) {
      adminRecentList.innerHTML = "<p class=\"admin-status-text\">数据库还没有商品，提交第一件后会显示在这里。</p>";
      return;
    }
    renderRecentProducts();
  } catch (error) {
    adminRecentList.innerHTML = `<p class="admin-status-text">${escapeHtml(error.message)}</p>`;
  }
}

async function handleToggleProduct(productId) {
  const targetProduct = state.recentProducts.find((item) => item.id === productId);

  if (!targetProduct) {
    setSubmitMessage("没有找到要操作的礼品。", "error");
    return;
  }

  state.pendingProductId = productId;
  renderRecentProducts();

  try {
    await updateProduct(productId, {
      is_active: !targetProduct.is_active
    });
    setSubmitMessage(targetProduct.is_active ? "礼品已下架。" : "礼品已重新上架。", "success");
    await loadRecentProducts();
  } catch (error) {
    state.pendingProductId = "";
    renderRecentProducts();
    setSubmitMessage(error.message, "error");
  }
}

async function handleDeleteProduct(productId) {
  const targetProduct = state.recentProducts.find((item) => item.id === productId);

  if (!targetProduct) {
    setSubmitMessage("没有找到要删除的礼品。", "error");
    return;
  }

  const confirmed = window.confirm(`确定删除“${targetProduct.title || "这件礼品"}”吗？删除后不能恢复。`);

  if (!confirmed) {
    return;
  }

  state.pendingProductId = productId;
  renderRecentProducts();

  try {
    await deleteProduct(productId);

    if (state.editingProduct?.id === productId) {
      resetEditor();
    }

    setSubmitMessage("礼品已删除。", "success");
    await loadRecentProducts();
  } catch (error) {
    state.pendingProductId = "";
    renderRecentProducts();
    setSubmitMessage(error.message, "error");
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

function fillForm(product) {
  if (!productForm || !product) {
    return;
  }

  productForm.elements.title.value = product.title || "";
  productForm.elements.category.value = product.category || categoryOptions[0]?.value || "";
  productForm.elements.cardsNeeded.value = Number(product.cards_needed || product.price || 0) || "";
  productForm.elements.imageUrl.value = product.image_url || "";
  productForm.elements.actionLabel.value = product.action_label || "立即领取";
  productForm.elements.actionUrl.value = product.action_url || "#service";
  productForm.elements.sortOrder.value = Number(product.sort_order || 10);
  productForm.elements.isActive.checked = Boolean(product.is_active);
  updatePreview(product.image_url || "");
  setEditorMode(product);
  setSubmitMessage("已载入商品信息，修改后保存即可。");
}

function resetEditor() {
  productForm.reset();
  updatePreview("");
  setEditorMode(null);
  setSubmitMessage("");
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
    setAuthMessage("当前后台暂时不可用，请联系网站维护人员。", "error");
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
    setAuthMessage("登录成功，现在可以新增和编辑商品。", "success");
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
  resetEditor();
  updateAuthUi();
  updateFormAccess();
  setAuthMessage("已退出登录。");
  adminRecentList.innerHTML = "<p class=\"admin-status-text\">登录管理员账号后，这里会显示最近录入的商品。</p>";
});

adminLogoutButtonLogged?.addEventListener("click", () => {
  adminLogoutButton?.click();
});

productForm?.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (!activeSession()) {
    setSubmitMessage("请先登录管理员账号。", "error");
    return;
  }

  if (!isSupabaseConfigured()) {
    setSubmitMessage("当前后台暂时不可用，请联系网站维护人员。", "error");
    return;
  }

  const formData = new FormData(productForm);
  const title = String(formData.get("title") || "").trim();
  const category = String(formData.get("category") || "").trim();
  const cardsNeeded = Number(formData.get("cardsNeeded") || 0);
  const currentEditingId = String(formData.get("editingProductId") || "").trim();
  const actionLabel = String(formData.get("actionLabel") || "立即领取").trim() || "立即领取";
  const actionUrl = String(formData.get("actionUrl") || "#service").trim() || "#service";
  const sortOrder = Number(formData.get("sortOrder") || 10);
  const isActive = formData.get("isActive") === "on";
  const externalImageUrl = String(formData.get("imageUrl") || "").trim();
  const imageFile = adminImageFile?.files?.[0];

  if (!title || !category || !cardsNeeded) {
    setSubmitMessage("标题、分类和几卡兑换是必填项。", "error");
    return;
  }

  if (!imageFile && !externalImageUrl) {
    setSubmitMessage("请上传图片，或者填一个图片链接。", "error");
    return;
  }

  adminSubmitButton.disabled = true;
  setSubmitState("提交中", "idle");
  setSubmitMessage(currentEditingId ? "正在保存商品修改，请稍候。" : "正在上传图片并写入商品数据，请稍候。");

  try {
    const imageUrl = imageFile ? await uploadFile(imageFile) : externalImageUrl;
    const payload = {
      title,
      category,
      price: cardsNeeded,
      cards_needed: cardsNeeded,
      description: "",
      image_url: imageUrl,
      action_label: actionLabel,
      action_url: actionUrl,
      sort_order: sortOrder,
      is_active: isActive
    };

    if (currentEditingId) {
      await updateProduct(currentEditingId, payload);
    } else {
      await insertProduct(payload);
    }

    resetEditor();
    setSubmitState("提交成功", "success");
    setSubmitMessage(currentEditingId ? "商品已更新。刷新前台页面后即可看到最新内容。" : "商品已写入。刷新前台页面后，这件商品就会出现在列表里。", "success");
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

adminTabCreate?.addEventListener("click", () => {
  state.activePanel = "create";
  updatePanelUi();
});

adminTabEdit?.addEventListener("click", () => {
  state.activePanel = "edit";
  updatePanelUi();
  loadRecentProducts();
});

adminSearchInput?.addEventListener("input", () => {
  state.searchQuery = adminSearchInput.value || "";
  renderRecentProducts();
});

adminFilterCategory?.addEventListener("change", () => {
  state.filterCategory = adminFilterCategory.value || "all";
  renderRecentProducts();
});

adminRecentList?.addEventListener("click", (event) => {
  const editButton = event.target.closest("[data-edit-id]");
  const toggleButton = event.target.closest("[data-toggle-id]");
  const deleteButton = event.target.closest("[data-delete-id]");

  if (toggleButton) {
    const targetId = toggleButton.dataset.toggleId || "";

    if (!targetId) {
      return;
    }

    handleToggleProduct(targetId);
    return;
  }

  if (deleteButton) {
    const targetId = deleteButton.dataset.deleteId || "";

    if (!targetId) {
      return;
    }

    handleDeleteProduct(targetId);
    return;
  }

  if (!editButton) {
    return;
  }

  const targetId = editButton.dataset.editId || "";
  const targetProduct = state.recentProducts.find((item) => item.id === targetId);

  if (!targetProduct) {
    setSubmitMessage("没有找到要编辑的商品。", "error");
    return;
  }

  fillForm(targetProduct);
  window.scrollTo({ top: 0, behavior: "smooth" });
});

adminCancelEditButton?.addEventListener("click", () => {
  resetEditor();
});

fillCategoryOptions();
updateAuthUi();
bindPreviewEvents();
setEditorMode(null);
updatePanelUi();
setSubmitMessage("");
updateFormAccess();
restoreSession();
