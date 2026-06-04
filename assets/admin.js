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
const adminImageSlots = Array.from(document.querySelectorAll("[data-admin-image-slot]"));
const adminImageFiles = Array.from(document.querySelectorAll("[data-admin-image-file]"));
const adminImageUrls = Array.from(document.querySelectorAll("[data-admin-image-url]"));
const adminAddImageSlotButton = document.getElementById("adminAddImageSlot");
const adminImageSlotTip = document.getElementById("adminImageSlotTip");
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
const adminPriceInput = document.getElementById("adminPriceInput");
const adminCardsInput = document.getElementById("adminCardsInput");
const adminTabBanks = document.getElementById("adminTabBanks");
const adminBanksPanel = document.getElementById("adminBanksPanel");
const adminBanksList = document.getElementById("adminBanksList");
const adminBanksMessage = document.getElementById("adminBanksMessage");
const adminBanksRefreshButton = document.getElementById("adminBanksRefreshButton");
const adminTitleInput = document.getElementById("adminTitleInput");
const adminTitleHistory = document.getElementById("adminTitleHistory");
const adminSubcategoryField = document.getElementById("adminSubcategoryField");
const adminSubcategorySelect = document.getElementById("adminSubcategorySelect");
const adminTabOrders = document.getElementById("adminTabOrders");
const adminOrdersPanel = document.getElementById("adminOrdersPanel");
const adminOrdersList = document.getElementById("adminOrdersList");
const adminOrdersMessage = document.getElementById("adminOrdersMessage");
const adminOrdersStatusFilter = document.getElementById("adminOrdersStatusFilter");
const adminOrdersSearchInput = document.getElementById("adminOrdersSearchInput");
const adminOrdersCount = document.getElementById("adminOrdersCount");
const adminOrdersRefreshButton = document.getElementById("adminOrdersRefreshButton");
const adminOrdersBulkBar = document.getElementById("adminOrdersBulkBar");
const adminOrdersSelectAll = document.getElementById("adminOrdersSelectAll");
const adminOrdersSelectedCount = document.getElementById("adminOrdersSelectedCount");
const adminOrdersBulkStatus = document.getElementById("adminOrdersBulkStatus");
const adminOrdersBulkApply = document.getElementById("adminOrdersBulkApply");
const adminOrdersBulkDelete = document.getElementById("adminOrdersBulkDelete");
const adminOrdersBulkClear = document.getElementById("adminOrdersBulkClear");
const adminTabStats = document.getElementById("adminTabStats");
const adminStatsPanel = document.getElementById("adminStatsPanel");
const adminStatsPeriod = document.getElementById("adminStatsPeriod");
const adminStatsGrid = document.getElementById("adminStatsGrid");
const adminStatsMessage = document.getElementById("adminStatsMessage");
const adminStatsRefreshButton = document.getElementById("adminStatsRefreshButton");
const adminTabReviews = document.getElementById("adminTabReviews");
const adminReviewsPanel = document.getElementById("adminReviewsPanel");
const adminReviewsList = document.getElementById("adminReviewsList");
const adminReviewsMessage = document.getElementById("adminReviewsMessage");
const adminReviewsStatusFilter = document.getElementById("adminReviewsStatusFilter");
const adminReviewsCount = document.getElementById("adminReviewsCount");
const adminReviewsRefreshButton = document.getElementById("adminReviewsRefreshButton");
const adminTabCatOrder = document.getElementById("adminTabCatOrder");
const adminCatOrderPanel = document.getElementById("adminCatOrderPanel");
const adminCatOrderList = document.getElementById("adminCatOrderList");
const adminCatOrderMessage = document.getElementById("adminCatOrderMessage");
const adminCatOrderSave = document.getElementById("adminCatOrderSave");
const adminInputOrderList = document.getElementById("adminInputOrderList");
const adminInputOrderMessage = document.getElementById("adminInputOrderMessage");
const adminInputOrderSave = document.getElementById("adminInputOrderSave");
const adminTabHaibao = document.getElementById("adminTabHaibao");
const adminHaibaoPanel = document.getElementById("adminHaibaoPanel");
const adminHaibaoList = document.getElementById("adminHaibaoList");
const adminHaibaoMessage = document.getElementById("adminHaibaoMessage");
const adminHaibaoSave = document.getElementById("adminHaibaoSave");
const adminHaibaoAdd = document.getElementById("adminHaibaoAdd");

const subcategoriesMap = config.subcategories || {};
const TITLE_HISTORY_KEY = "gift-site-admin-title-history";
const TITLE_HISTORY_LIMIT = 30;
const MAX_PRODUCT_IMAGES = 5;
const IMAGE_COMPRESS_MAX_EDGE = 1600;
const IMAGE_COMPRESS_QUALITY = 0.84;
const IMAGE_COMPRESS_MIN_BYTES = 650 * 1024;

const PRICE_PER_CARD = 40;
const LAST_CATEGORY_KEY = "gift-site-admin-last-category";

function getLastCategory() {
  try {
    return localStorage.getItem(LAST_CATEGORY_KEY) || "";
  } catch {
    return "";
  }
}

function saveLastCategory(value) {
  if (!value) {
    return;
  }

  try {
    localStorage.setItem(LAST_CATEGORY_KEY, value);
  } catch {
    // ignore quota errors
  }
}

function restoreLastCategory() {
  const last = getLastCategory();
  if (last && adminCategorySelect && adminCategorySelect.querySelector(`option[value="${last}"]`)) {
    adminCategorySelect.value = last;
  }
  updateSubcategoryField();
}

function updateSubcategoryField() {
  if (!adminSubcategoryField || !adminSubcategorySelect || !adminCategorySelect) {
    return;
  }

  const cat = adminCategorySelect.value;
  const subs = subcategoriesMap[cat];

  if (!subs || subs.length === 0) {
    adminSubcategoryField.hidden = true;
    adminSubcategorySelect.innerHTML = "<option value=\"\">不选</option>";
    return;
  }

  adminSubcategoryField.hidden = false;
  const options = ["<option value=\"\">不选</option>"]
    .concat(subs.map((s) => `<option value="${escapeHtml(s)}">${escapeHtml(s)}</option>`));
  adminSubcategorySelect.innerHTML = options.join("");
}

function getTitleHistory() {
  try {
    const raw = localStorage.getItem(TITLE_HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveTitleHistory(title) {
  if (!title) return;
  const trimmed = title.trim();
  if (!trimmed) return;

  const list = getTitleHistory().filter((t) => t !== trimmed);
  list.unshift(trimmed);
  const trimmedList = list.slice(0, TITLE_HISTORY_LIMIT);

  try {
    localStorage.setItem(TITLE_HISTORY_KEY, JSON.stringify(trimmedList));
  } catch {
    // ignore quota
  }

  renderTitleHistory();
}

function renderTitleHistory() {
  if (!adminTitleHistory) return;
  const list = getTitleHistory();
  adminTitleHistory.innerHTML = list.map((t) => `<option value="${escapeHtml(t)}"></option>`).join("");
}

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
  pendingProductId: "",
  banks: [],
  activeImageSlotCount: 1,
  orders: [],
  ordersTotal: 0,
  ordersStatus: "pending",
  ordersSearch: "",
  ordersPage: 0,
  ordersPageSize: 50,
  expandedOrderId: "",
  selectedOrderIds: new Set(),
  statsPeriod: "today",
  stats: null,
  statsLoadedAt: null,
  reviews: [],
  reviewsStatus: "pending",
  catOrder: [],     // [{value,label}] 小程序前台顺序（不含 all）
  inputOrder: [],   // [{value,label}] 后台录入下拉顺序（不含 all）
  haibanners: []    // [{imageUrl,linkType,linkValue,title,uploading,error,_file}] 首页海报
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

async function authedFetch(url, options = {}, extraHeaders = {}) {
  let session = activeSession();

  if (!session) {
    throw new Error("请先登录管理员账号");
  }

  const buildOptions = (token) => ({
    ...options,
    headers: authHeaders(token, extraHeaders)
  });

  let response = await fetch(url, buildOptions(session.access_token));

  if (response.status === 401 && session.refresh_token) {
    try {
      const refreshed = await refreshSession(session.refresh_token);
      const user = await fetchCurrentUser(refreshed.access_token);
      session = { ...refreshed, user };
      saveSession(session);
    } catch {
      saveSession(null);
      updateAuthUi();
      updateFormAccess();
      throw new Error("登录已过期，请重新登录");
    }

    response = await fetch(url, buildOptions(session.access_token));
  }

  return response;
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

  document.body.classList.toggle("admin-logged-in", loggedIn);

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
  const panels = {
    create: adminCreatePanel,
    edit: adminEditPanel,
    banks: adminBanksPanel,
    orders: adminOrdersPanel,
    stats: adminStatsPanel,
    reviews: adminReviewsPanel,
    catorder: adminCatOrderPanel,
    haibao: adminHaibaoPanel
  };
  const tabs = {
    create: adminTabCreate,
    edit: adminTabEdit,
    banks: adminTabBanks,
    orders: adminTabOrders,
    stats: adminTabStats,
    reviews: adminTabReviews,
    catorder: adminTabCatOrder,
    haibao: adminTabHaibao
  };

  Object.keys(panels).forEach((key) => {
    if (panels[key]) panels[key].hidden = state.activePanel !== key;
    if (tabs[key]) tabs[key].classList.toggle("active", state.activePanel === key);
  });
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
    const matchesKeyword = !keyword || `${item.title || ""} ${categoryLabel} ${item.subcategory || ""} ${item.description || ""}`.toLowerCase().includes(keyword);
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
          <p>${escapeHtml(categoryLabel)} · ${escapeHtml(cardsNeeded)}分兑换</p>
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

// 录入下拉顺序（admin 本地偏好，存 localStorage，方便录入时常用分类靠前）
const INPUT_CAT_ORDER_KEY = "gift-site-admin-input-cat-order";

function getInputCatOrder() {
  try {
    const v = JSON.parse(localStorage.getItem(INPUT_CAT_ORDER_KEY) || "[]");
    return Array.isArray(v) ? v : [];
  } catch { return []; }
}

function orderedInputCategories() {
  const order = getInputCatOrder();
  if (!order.length) return categoryOptions.slice();
  const idx = (val) => { const i = order.indexOf(val); return i < 0 ? 9999 : i; };
  return categoryOptions.slice().sort((a, b) => idx(a.value) - idx(b.value));
}

function fillCategoryOptions() {
  if (!adminCategorySelect || categoryOptions.length === 0) {
    return;
  }

  const ordered = orderedInputCategories();
  adminCategorySelect.innerHTML = ordered.map((item) => {
    return `<option value="${escapeHtml(item.value)}">${escapeHtml(item.label)}</option>`;
  }).join("");

  if (adminFilterCategory) {
    adminFilterCategory.innerHTML = [
      "<option value=\"all\">全部分类</option>",
      ...ordered.map((item) => `<option value="${escapeHtml(item.value)}">${escapeHtml(item.label)}</option>`)
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

function productImagesFromValue(value, fallbackImageUrl = "") {
  let images = [];

  if (Array.isArray(value)) {
    images = value;
  } else if (typeof value === "string" && value.trim()) {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) {
        images = parsed;
      }
    } catch {
      // ignore invalid legacy JSON
    }
  }

  const clean = images.filter((url) => typeof url === "string" && url.trim()).slice(0, MAX_PRODUCT_IMAGES);

  if (clean.length === 0 && fallbackImageUrl) {
    clean.push(fallbackImageUrl);
  }

  return clean;
}

function setImageUrlSlots(urls = []) {
  adminImageFiles.forEach((input) => {
    input.value = "";
  });

  adminImageUrls.forEach((input, index) => {
    input.value = urls[index] || "";
  });
}

function updateImageSlotControls() {
  adminImageSlots.forEach((slot, index) => {
    slot.hidden = index >= state.activeImageSlotCount;
  });

  const reachedMax = state.activeImageSlotCount >= MAX_PRODUCT_IMAGES;

  if (adminAddImageSlotButton) {
    adminAddImageSlotButton.disabled = reachedMax;
    adminAddImageSlotButton.textContent = reachedMax ? "已达到最多图片" : "＋ 添加图片";
  }

  if (adminImageSlotTip) {
    adminImageSlotTip.textContent = reachedMax
      ? "已达到最多图片"
      : `还可添加 ${MAX_PRODUCT_IMAGES - state.activeImageSlotCount} 张图片`;
  }
}

function setActiveImageSlotCount(count) {
  state.activeImageSlotCount = Math.max(1, Math.min(MAX_PRODUCT_IMAGES, Number(count) || 1));
  updateImageSlotControls();
}

function addImageSlot() {
  if (state.activeImageSlotCount >= MAX_PRODUCT_IMAGES) {
    updateImageSlotControls();
    return;
  }

  setActiveImageSlotCount(state.activeImageSlotCount + 1);
}

function firstImagePreviewSource() {
  for (let index = 0; index < MAX_PRODUCT_IMAGES; index += 1) {
    const file = adminImageFiles[index]?.files?.[0];

    if (file) {
      return URL.createObjectURL(file);
    }

    const url = adminImageUrls[index]?.value.trim();

    if (url) {
      return url;
    }
  }

  return "";
}

function updatePreviewFromImageSlots() {
  updatePreview(firstImagePreviewSource());
}

function filledImageSlotCount() {
  let count = 0;

  for (let index = 0; index < MAX_PRODUCT_IMAGES; index += 1) {
    const hasFile = Boolean(adminImageFiles[index]?.files?.[0]);
    const hasUrl = Boolean(adminImageUrls[index]?.value.trim());

    if (hasFile || hasUrl) {
      count += 1;
    }
  }

  return count;
}

async function collectProductImageUrls() {
  const imageUrls = [];

  for (let index = 0; index < MAX_PRODUCT_IMAGES; index += 1) {
    const file = adminImageFiles[index]?.files?.[0];
    const externalUrl = adminImageUrls[index]?.value.trim();

    if (file) {
      imageUrls.push(await uploadFile(file));
    } else if (externalUrl) {
      imageUrls.push(externalUrl);
    }
  }

  return imageUrls;
}

function sanitizeFileName(fileName) {
  return fileName.replace(/[^a-zA-Z0-9._-]/g, "-").replace(/-+/g, "-");
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
  const baseName = String(fileName || "product-image").replace(/\.[^.]+$/, "");
  return `${baseName}.jpg`;
}

function loadImageFile(file) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const objectUrl = URL.createObjectURL(file);

    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(image);
    };

    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("图片读取失败，已跳过压缩。"));
    };

    image.src = objectUrl;
  });
}

function canvasToBlob(canvas, type, quality) {
  return new Promise((resolve) => {
    canvas.toBlob(resolve, type, quality);
  });
}

async function compressImageFile(file) {
  if (!canCompressImage(file)) {
    return file;
  }

  try {
    const image = await loadImageFile(file);
    const sourceWidth = image.naturalWidth || image.width;
    const sourceHeight = image.naturalHeight || image.height;

    if (!sourceWidth || !sourceHeight) {
      return file;
    }

    const scale = Math.min(1, IMAGE_COMPRESS_MAX_EDGE / Math.max(sourceWidth, sourceHeight));
    const shouldResize = scale < 1;
    const shouldCompress = file.size > IMAGE_COMPRESS_MIN_BYTES;

    if (!shouldResize && !shouldCompress) {
      return file;
    }

    const targetWidth = Math.max(1, Math.round(sourceWidth * scale));
    const targetHeight = Math.max(1, Math.round(sourceHeight * scale));
    const canvas = document.createElement("canvas");
    canvas.width = targetWidth;
    canvas.height = targetHeight;

    const ctx = canvas.getContext("2d", { alpha: false });

    if (!ctx) {
      return file;
    }

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, targetWidth, targetHeight);
    ctx.drawImage(image, 0, 0, targetWidth, targetHeight);

    const blob = await canvasToBlob(canvas, "image/jpeg", IMAGE_COMPRESS_QUALITY);

    if (!blob || blob.size >= file.size) {
      return file;
    }

    return new File([blob], compressedImageName(file.name), {
      type: "image/jpeg",
      lastModified: Date.now()
    });
  } catch {
    return file;
  }
}

function storagePublicUrl(filePath) {
  return `${config.supabaseUrl}/storage/v1/object/public/${config.storageBucket}/${filePath}`;
}

function storageUploadEndpoint(filePath) {
  const encodedPath = filePath.split("/").map((segment) => encodeURIComponent(segment)).join("/");
  return `${config.supabaseUrl}/storage/v1/object/${config.storageBucket}/${encodedPath}`;
}

async function uploadFile(file) {
  const uploadTarget = await compressImageFile(file);
  const fileName = `${Date.now()}-${sanitizeFileName(uploadTarget.name)}`;
  const folder = config.storageFolder || "products";
  const filePath = `${folder}/${fileName}`;
  const response = await authedFetch(
    storageUploadEndpoint(filePath),
    { method: "POST", body: uploadTarget },
    {
      "Content-Type": uploadTarget.type || "application/octet-stream",
      "x-upsert": "true"
    }
  );

  if (!response.ok) {
    throw new Error(`图片上传失败：${response.status}`);
  }

  return storagePublicUrl(filePath);
}

async function insertProduct(row) {
  const response = await authedFetch(
    `${config.supabaseUrl}/rest/v1/${config.productsTable}`,
    { method: "POST", body: JSON.stringify(row) },
    {
      "Content-Type": "application/json",
      Prefer: "return=representation"
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`商品写入失败：${response.status} ${errorText}`);
  }

  const data = await response.json();
  return Array.isArray(data) ? data[0] : data;
}

async function updateProduct(productId, row) {
  const response = await authedFetch(
    `${config.supabaseUrl}/rest/v1/${config.productsTable}?id=eq.${encodeURIComponent(productId)}`,
    { method: "PATCH", body: JSON.stringify(row) },
    {
      "Content-Type": "application/json",
      Prefer: "return=representation"
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`商品更新失败：${response.status} ${errorText}`);
  }

  const data = await response.json();
  return Array.isArray(data) ? data[0] : data;
}

async function deleteProduct(productId) {
  const response = await authedFetch(
    `${config.supabaseUrl}/rest/v1/${config.productsTable}?id=eq.${encodeURIComponent(productId)}`,
    { method: "DELETE" },
    { Prefer: "return=representation" }
  );

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
      select: "id,title,category,subcategory,price,cards_needed,description,image_url,images,sort_order,created_at,is_active",
      order: "updated_at.desc",
      limit: "1000"
    });

    let response = await authedFetch(
      `${config.supabaseUrl}/rest/v1/${config.productsTable}?${primaryParams.toString()}`
    );

    if (!response.ok && response.status === 400) {
      const fallbackParams = new URLSearchParams({
        select: "id,title,category,price,image_url,sort_order,created_at,is_active",
        order: "created_at.desc",
        limit: "1000"
      });

      response = await authedFetch(
        `${config.supabaseUrl}/rest/v1/${config.productsTable}?${fallbackParams.toString()}`
      );
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

function bindPriceAutoCalc() {
  if (!adminPriceInput || !adminCardsInput) {
    return;
  }

  adminPriceInput.addEventListener("input", () => {
    const price = Number(adminPriceInput.value);

    if (!Number.isFinite(price) || price <= 0) {
      return;
    }

    const cards = Math.max(1, Math.ceil(price / PRICE_PER_CARD));
    adminCardsInput.value = cards;
  });
}

function bindPreviewEvents() {
  adminAddImageSlotButton?.addEventListener("click", addImageSlot);

  adminImageFiles.forEach((input) => {
    input.addEventListener("change", updatePreviewFromImageSlots);
  });

  adminImageUrls.forEach((input) => {
    input.addEventListener("input", updatePreviewFromImageSlots);
  });
}

function fillForm(product) {
  if (!productForm || !product) {
    return;
  }

  productForm.elements.title.value = product.title || "";
  productForm.elements.category.value = product.category || categoryOptions[0]?.value || "";
  updateSubcategoryField();
  if (productForm.elements.subcategory) {
    productForm.elements.subcategory.value = product.subcategory || "";
  }
  productForm.elements.price.value = Number(product.price || 0) || "";
  productForm.elements.cardsNeeded.value = Number(product.cards_needed || product.price || 0) || "";
  if (productForm.elements.description) {
    productForm.elements.description.value = product.description || "";
  }
  const productImages = productImagesFromValue(product.images, product.image_url || "");
  setImageUrlSlots(productImages);
  setActiveImageSlotCount(productImages.length || 1);
  productForm.elements.sortOrder.value = Number(product.sort_order || 10);
  productForm.elements.isActive.checked = Boolean(product.is_active);
  updatePreviewFromImageSlots();
  setEditorMode(product);
  setSubmitMessage("已载入商品信息，修改后保存即可。");
}

function resetEditor() {
  productForm.reset();
  setImageUrlSlots([]);
  setActiveImageSlotCount(1);
  updatePreview("");
  setEditorMode(null);
  setSubmitMessage("");
  restoreLastCategory();
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
  const subcategory = String(formData.get("subcategory") || "").trim();
  const description = String(formData.get("description") || "").trim();
  const priceInput = Number(formData.get("price") || 0);
  let cardsNeeded = Number(formData.get("cardsNeeded") || 0);

  if (priceInput > 0 && !cardsNeeded) {
    cardsNeeded = Math.max(1, Math.ceil(priceInput / PRICE_PER_CARD));
  }

  const currentEditingId = String(formData.get("editingProductId") || "").trim();
  const sortOrder = Number(formData.get("sortOrder") || 10);
  const isActive = formData.get("isActive") === "on";
  const imageInputCount = filledImageSlotCount();

  if (!title || !category || !priceInput || !cardsNeeded) {
    setSubmitMessage("标题、分类、价格和兑换积分都是必填项。", "error");
    return;
  }

  if (imageInputCount === 0) {
    setSubmitMessage("请至少上传 1 张图片，或者填 1 个图片链接。", "error");
    return;
  }

  adminSubmitButton.disabled = true;
  setSubmitState("提交中", "idle");
  setSubmitMessage(currentEditingId ? "正在保存商品修改，请稍候。" : `正在处理 ${imageInputCount} 张图并写入商品数据，请稍候。`);

  try {
    const imageUrls = await collectProductImageUrls();

    if (imageUrls.length === 0) {
      throw new Error("请至少上传 1 张图片，或者填 1 个图片链接。");
    }

    const primaryImage = imageUrls[0];
    const payload = {
      title,
      category,
      subcategory: subcategory || null,
      price: priceInput,
      cards_needed: cardsNeeded,
      description,
      image_url: primaryImage,
      images: imageUrls,
      sort_order: sortOrder,
      is_active: isActive
    };

    if (currentEditingId) {
      await updateProduct(currentEditingId, payload);
    } else {
      await insertProduct(payload);
    }

    saveLastCategory(category);
    saveTitleHistory(title);
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

adminTabBanks?.addEventListener("click", () => {
  state.activePanel = "banks";
  updatePanelUi();
  loadBanksEarn();
});

adminBanksRefreshButton?.addEventListener("click", () => {
  loadBanksEarn();
});

adminBanksList?.addEventListener("change", (event) => {
  const input = event.target.closest("[data-bank-id]");
  if (!input) return;
  handleBankPointsChange(input);
});

async function loadBanksEarn() {
  if (!adminBanksList) return;

  if (!isSupabaseConfigured()) {
    adminBanksList.innerHTML = "<p class=\"admin-status-text\">当前后台暂时不可用。</p>";
    return;
  }

  try {
    const params = new URLSearchParams({
      select: "id,name,points,sort_order",
      order: "points.desc.nullslast,sort_order.asc"
    });

    const response = await authedFetch(
      `${config.supabaseUrl}/rest/v1/banks_earn?${params.toString()}`
    );

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`读取失败：${response.status} ${text}`);
    }

    state.banks = await response.json();
    renderBanksList();
  } catch (error) {
    adminBanksList.innerHTML = `<p class="admin-status-text">${escapeHtml(error.message)}</p>`;
  }
}

function renderBanksList() {
  if (!adminBanksList) return;

  if (!Array.isArray(state.banks) || state.banks.length === 0) {
    adminBanksList.innerHTML = "<p class=\"admin-status-text\">表中没有银行，请先在 Supabase 里执行 banks-earn-table.sql。</p>";
    return;
  }

  adminBanksList.innerHTML = state.banks.map((bank) => `
    <div class="admin-bank-row">
      <span class="admin-bank-name">${escapeHtml(bank.name)}</span>
      <input class="admin-bank-input" type="number" min="0" max="10" step="1" value="${escapeHtml(bank.points || 0)}" data-bank-id="${escapeHtml(bank.id)}">
      <span class="admin-bank-suffix">分</span>
    </div>
  `).join("");
}

async function handleBankPointsChange(input) {
  const id = input.dataset.bankId;
  const value = Number(input.value);

  if (!Number.isFinite(value) || value < 0 || value > 10) {
    setBanksMessage("积分必须是 0-10 之间的整数。", "error");
    return;
  }

  setBanksMessage("正在保存…");

  try {
    const response = await authedFetch(
      `${config.supabaseUrl}/rest/v1/banks_earn?id=eq.${encodeURIComponent(id)}`,
      { method: "PATCH", body: JSON.stringify({ points: value }) },
      {
        "Content-Type": "application/json",
        Prefer: "return=minimal"
      }
    );

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`保存失败：${response.status} ${text}`);
    }

    setBanksMessage("已保存。", "success");
    const idx = state.banks.findIndex((b) => b.id === id);
    if (idx >= 0) state.banks[idx].points = value;
    state.banks.sort((a, b) => (b.points || 0) - (a.points || 0) || (a.sort_order || 100) - (b.sort_order || 100));
    renderBanksList();
  } catch (error) {
    setBanksMessage(error.message, "error");
  }
}

function setBanksMessage(text, tone = "idle") {
  if (!adminBanksMessage) return;
  adminBanksMessage.textContent = text;
  adminBanksMessage.dataset.tone = tone;
}

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

// ============ 申请管理（订单） ============

const ORDER_STATUS_LABEL = {
  pending: "待处理",
  done: "已发货",
  cancelled: "已取消"
};
// 状态文案（历史 processing/未知 一律兜底「待处理」）
function orderStatusText(s) { return ORDER_STATUS_LABEL[s] || "待处理"; }

function setOrdersMessage(text, tone = "idle") {
  if (!adminOrdersMessage) return;
  adminOrdersMessage.textContent = text;
  adminOrdersMessage.dataset.tone = tone;
}

async function callAdminOrders(action, payload = {}) {
  if (!config.adminOrdersUrl) {
    throw new Error("尚未配置 adminOrdersUrl，请在 assets/config.js 填入云函数 HTTP 触发器地址");
  }
  let session = activeSession();
  if (!session) {
    throw new Error("请先登录管理员账号");
  }

  const doFetch = (token) => fetch(config.adminOrdersUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({ action, ...payload })
  });

  let res = await doFetch(session.access_token);

  // token 过期 → 刷新一次重试（与 authedFetch 对 Supabase 的处理一致）
  if (res.status === 401 && session.refresh_token) {
    try {
      const refreshed = await refreshSession(session.refresh_token);
      const user = await fetchCurrentUser(refreshed.access_token);
      session = { ...refreshed, user };
      saveSession(session);
    } catch {
      saveSession(null);
      updateAuthUi();
      updateFormAccess();
      throw new Error("登录已过期，请重新登录");
    }
    res = await doFetch(session.access_token);
  }

  let json;
  try {
    json = await res.json();
  } catch {
    throw new Error(`返回不是 JSON（HTTP ${res.status}）`);
  }
  if (!res.ok || !json.ok) {
    throw new Error(json && json.error ? json.error : `HTTP ${res.status}`);
  }
  return json.data;
}

// 四个分段各自数量（与订单列表口径一致：待处理含历史 processing；total 不受日期影响）
function loadOrderSegCounts() {
  const segs = document.getElementById("adminOrdersSegs");
  if (!segs || !activeSession()) return;
  ["pending", "done", "cancelled", "all"].forEach((st) => {
    callAdminOrders("list", { status: st, limit: 1 })
      .then((data) => {
        const el = segs.querySelector(`[data-seg-count="${st}"]`);
        if (el) el.textContent = Number(data && data.total) || 0;
      })
      .catch(() => {});
  });
}

async function loadOrders() {
  if (!adminOrdersList) return;
  if (!activeSession()) {
    adminOrdersList.innerHTML = "<p class=\"admin-status-text\">请先登录管理员账号。</p>";
    return;
  }
  adminOrdersList.innerHTML = "<p class=\"admin-status-text\">加载中…</p>";
  setOrdersMessage("");
  loadOrderSegCounts();
  try {
    const status = state.ordersStatus === "all" ? "" : state.ordersStatus;
    const skip = state.ordersPage * state.ordersPageSize;
    const data = await callAdminOrders("list", {
      status,
      search: state.ordersSearch,
      limit: state.ordersPageSize,
      skip
    });
    state.orders = Array.isArray(data && data.items) ? data.items : [];
    state.ordersTotal = (data && data.total) || 0;

    // 翻到了空页面（比如刚才那页的订单都被改状态搬走了）→ 回退一页重拉
    const totalPages = Math.max(1, Math.ceil(state.ordersTotal / state.ordersPageSize));
    if (state.orders.length === 0 && state.ordersPage > 0 && state.ordersPage >= totalPages) {
      state.ordersPage = totalPages - 1;
      return loadOrders();
    }
    renderOrdersList();
  } catch (err) {
    adminOrdersList.innerHTML = `<p class="admin-status-text">${escapeHtml(err.message)}</p>`;
  }
}

function formatOrderDate(d) {
  if (!d) return "";
  try {
    const date = new Date(d);
    const pad = (n) => String(n).padStart(2, "0");
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
  } catch {
    return "";
  }
}

function renderOrdersPagination() {
  const total = state.ordersTotal;
  const size = state.ordersPageSize;
  const page = state.ordersPage;
  const totalPages = Math.max(1, Math.ceil(total / size));
  const start = total === 0 ? 0 : page * size + 1;
  const end = Math.min(total, (page + 1) * size);
  const prevDisabled = page <= 0 ? "disabled" : "";
  const nextDisabled = page >= totalPages - 1 ? "disabled" : "";
  return `
    <div class="admin-orders-pagination">
      <button class="admin-secondary-btn" data-page-prev type="button" ${prevDisabled}>‹ 上一页</button>
      <span class="admin-pagination-info">${start}-${end} / 共 ${total} 单 · 第 ${page + 1} / ${totalPages} 页</span>
      <button class="admin-secondary-btn" data-page-next type="button" ${nextDisabled}>下一页 ›</button>
    </div>
  `;
}

function renderOrdersList() {
  if (!adminOrdersList) return;
  if (adminOrdersCount) {
    const showing = state.orders.length;
    adminOrdersCount.textContent = `当前筛选 ${state.ordersTotal} 单`;
  }
  if (state.orders.length === 0) {
    adminOrdersList.innerHTML = "<p class=\"admin-status-text\">没有符合条件的订单。</p>";
    return;
  }

  const cardsHtml = state.orders.map((o) => {
    const addr = o.address || {};
    const items = Array.isArray(o.items) ? o.items : [];
    const isOpen = state.expandedOrderId === o._id;
    const isChecked = state.selectedOrderIds.has(o._id);
    const itemsHtml = items.map((it) => `
      <div class="admin-order-item">
        ${it.imageUrl ? `<img src="${escapeHtml(it.imageUrl)}" alt="">` : ""}
        <div class="admin-order-item-body">
          <span class="admin-order-item-title">${escapeHtml(it.title || "")}</span>
          <span class="admin-order-item-meta">${escapeHtml(it.cardsNeeded || 0)} 积分 × ${escapeHtml(it.qty || 1)}</span>
        </div>
      </div>
    `).join("");

    const statusSelect = `
      <select class="admin-order-status-select" data-order-id="${escapeHtml(o._id)}">
        ${Object.keys(ORDER_STATUS_LABEL).map(s =>
          `<option value="${s}"${s === o.status ? " selected" : ""}>${escapeHtml(ORDER_STATUS_LABEL[s])}</option>`
        ).join("")}
      </select>
    `;

    return `
      <div class="admin-order-card${isOpen ? " admin-order-open" : ""}">
        <div class="admin-order-head" data-toggle-order="${escapeHtml(o._id)}">
          <input type="checkbox" class="admin-order-checkbox" data-select-order="${escapeHtml(o._id)}"${isChecked ? " checked" : ""}>
          <div class="admin-order-head-left">
            <span class="admin-order-recipient">${escapeHtml(addr.recipient || "(无收件人)")}<span class="admin-order-src ${o.source === "web" ? "admin-order-src-web" : "admin-order-src-mp"}">${o.source === "web" ? "网页" : "小程序"}</span></span>
            <span class="admin-order-summary">${escapeHtml((items[0] && items[0].title) || "礼品")}${items.length > 1 ? "等" : ""} · ${escapeHtml(items.length)}件</span>
          </div>
          <div class="admin-order-head-right">
            <span class="admin-order-status admin-order-status-${escapeHtml(o.status)}">${escapeHtml(orderStatusText(o.status))}</span>
            <span class="admin-order-date">${escapeHtml(formatOrderDate(o.createdAt))}</span>
          </div>
        </div>
        ${isOpen ? `
          <div class="admin-order-body">
            <div class="admin-order-section">
              <strong>收货信息</strong>
              <p>${escapeHtml(addr.recipient || "")}　${escapeHtml(addr.phone || "")}</p>
              <p>${escapeHtml(addr.province || "")} ${escapeHtml(addr.city || "")} ${escapeHtml(addr.district || "")} ${escapeHtml(addr.detail || "")}</p>
              <button class="admin-secondary-btn admin-order-copy" data-copy-order="${escapeHtml(o._id)}" type="button">复制收件信息</button>
            </div>
            <div class="admin-order-section">
              <strong>礼品清单</strong>
              <div class="admin-order-items">${itemsHtml}</div>
            </div>
            ${o.remark ? `<div class="admin-order-section"><strong>备注</strong><p class="admin-order-remark">${escapeHtml(o.remark)}</p></div>` : ""}
            <div class="admin-order-section">
              <strong>订单号</strong>
              <p class="admin-order-id">${escapeHtml(o._id)}</p>
            </div>
            <div class="admin-order-section">
              <strong>快递单号</strong>
              <div class="admin-tracking-row">
                <input class="admin-tracking-company" type="text" placeholder="快递公司(可选)" value="${escapeHtml(o.trackingCompany || "")}" data-tracking-company="${escapeHtml(o._id)}">
                <input class="admin-tracking-no" type="text" placeholder="快递单号" value="${escapeHtml(o.trackingNo || "")}" data-tracking-no="${escapeHtml(o._id)}">
                <button class="admin-secondary-btn admin-tracking-save" data-save-tracking="${escapeHtml(o._id)}" type="button">保存单号</button>
              </div>
              <div class="admin-carrier-quick">
                <span class="admin-carrier-label">常用：</span>
                <span class="carrier-chip" data-carrier="京东物流" data-cid="${escapeHtml(o._id)}">京东</span>
                <span class="carrier-chip" data-carrier="中通快递" data-cid="${escapeHtml(o._id)}">中通</span>
                <span class="carrier-chip" data-carrier="申通快递" data-cid="${escapeHtml(o._id)}">申通</span>
                <span class="carrier-chip" data-carrier="圆通速递" data-cid="${escapeHtml(o._id)}">圆通</span>
                <span class="carrier-chip" data-carrier="韵达速递" data-cid="${escapeHtml(o._id)}">韵达</span>
                <span class="carrier-chip" data-carrier="极兔速递" data-cid="${escapeHtml(o._id)}">极兔</span>
              </div>
            </div>
            <div class="admin-order-section">
              <strong>商家内部备注（仅你可见，客户看不到）</strong>
              <div class="admin-note-row">
                <input class="admin-note-input" type="text" placeholder="例如：客户已电话确认 / 等下卡" value="${escapeHtml(o.adminNote || "")}" data-note="${escapeHtml(o._id)}">
                <button class="admin-secondary-btn admin-note-save" data-save-note="${escapeHtml(o._id)}" type="button">保存备注</button>
              </div>
            </div>
            <div class="admin-order-section admin-order-actions">
              <label>更新状态：${statusSelect}</label>
            </div>
            <div class="admin-order-section admin-order-danger">
              <strong>删除订单 <span class="admin-order-danger-hint">永久删除，仅用于清理测试单</span></strong>
              <button class="admin-secondary-btn admin-order-delete-btn" data-delete-order="${escapeHtml(o._id)}" type="button">🗑 删除此订单</button>
            </div>
          </div>
        ` : ""}
      </div>
    `;
  }).join("");
  adminOrdersList.innerHTML = cardsHtml + renderOrdersPagination();
  updateBulkBar();
}

function updateBulkBar() {
  if (!adminOrdersBulkBar) return;
  const selectedOnPage = state.orders.filter(o => state.selectedOrderIds.has(o._id)).length;
  const total = state.orders.length;
  adminOrdersBulkBar.hidden = total === 0;
  if (adminOrdersSelectAll) {
    adminOrdersSelectAll.checked = total > 0 && selectedOnPage === total;
    adminOrdersSelectAll.indeterminate = selectedOnPage > 0 && selectedOnPage < total;
  }
  if (adminOrdersSelectedCount) {
    adminOrdersSelectedCount.textContent = `已选 ${state.selectedOrderIds.size} 单`;
  }
}

async function handleBulkUpdate() {
  const status = adminOrdersBulkStatus ? adminOrdersBulkStatus.value : "";
  if (!status) {
    setOrdersMessage("请选择要改成的状态。", "error");
    return;
  }
  const ids = Array.from(state.selectedOrderIds);
  if (ids.length === 0) {
    setOrdersMessage("请先勾选订单。", "error");
    return;
  }
  if (!confirm(`确认把 ${ids.length} 单改为「${ORDER_STATUS_LABEL[status]}」？`)) return;
  setOrdersMessage("批量更新中…");
  try {
    const res = await callAdminOrders("update-status-bulk", { orderIds: ids, status });
    state.selectedOrderIds.clear();
    if (adminOrdersBulkStatus) adminOrdersBulkStatus.value = "";
    setOrdersMessage(`成功 ${res.updated} 单，失败 ${res.failed || 0} 单。`, "success");
    loadOrders();
  } catch (err) {
    setOrdersMessage(err.message, "error");
  }
}

// 批量硬删（清理测试单）：二次确认 → delete-orders-bulk → 重拉。看板每次进入重拉，自动同步。
async function handleBulkDelete() {
  const ids = Array.from(state.selectedOrderIds);
  if (ids.length === 0) {
    setOrdersMessage("请先勾选订单。", "error");
    return;
  }
  if (!confirm(`确认永久删除 ${ids.length} 单？\n不可恢复；数据看板统计会相应减少。仅建议用于清理测试单。`)) return;
  setOrdersMessage("批量删除中…");
  try {
    const res = await callAdminOrders("delete-orders-bulk", { orderIds: ids });
    state.selectedOrderIds.clear();
    setOrdersMessage(`已删除 ${res.deleted} 单，失败 ${res.failed || 0} 单。`, "success");
    loadOrders();
  } catch (err) {
    setOrdersMessage(err.message, "error");
  }
}

async function handleOrderStatusChange(select) {
  const orderId = select.dataset.orderId;
  const status = select.value;
  if (!orderId) return;
  setOrdersMessage("正在保存…");
  try {
    await callAdminOrders("update-status", { orderId, status });
    setOrdersMessage("已更新。", "success");
    // 过滤态下改状态会让该单移出当前筛选 → 直接重拉，复用分页/空页回退逻辑，
    // 避免本地 splice + ordersTotal-- 造成的页码错位、当前页卡空
    if (state.ordersStatus !== "all" && state.ordersStatus !== status) {
      state.expandedOrderId = "";
      loadOrders();
    } else {
      // 状态仍在当前筛选内（或全部），就地更新即可
      const idx = state.orders.findIndex((o) => o._id === orderId);
      if (idx >= 0) state.orders[idx].status = status;
      renderOrdersList();
    }
  } catch (err) {
    setOrdersMessage(err.message, "error");
    // 失败时还原 select 显示
    loadOrders();
  }
}

async function handleTrackingSave(orderId) {
  if (!orderId) return;
  const noInput = adminOrdersList.querySelector(`[data-tracking-no="${orderId}"]`);
  const companyInput = adminOrdersList.querySelector(`[data-tracking-company="${orderId}"]`);
  const trackingNo = noInput ? noInput.value.trim() : "";
  const trackingCompany = companyInput ? companyInput.value.trim() : "";
  if (!trackingNo) {
    setOrdersMessage("请填写快递单号。", "error");
    return;
  }
  setOrdersMessage("正在保存单号…");
  try {
    await callAdminOrders("update-tracking", { orderId, trackingNo, trackingCompany });
    // 就地写回；填单号 = 发货 → 云端已自动置「已发货」，前端同步状态并重渲染徽标
    const idx = state.orders.findIndex((o) => o._id === orderId);
    if (idx >= 0) {
      state.orders[idx].trackingNo = trackingNo;
      state.orders[idx].trackingCompany = trackingCompany;
      if (state.orders[idx].status !== "cancelled") state.orders[idx].status = "done";
    }
    renderOrdersList();
    setOrdersMessage("单号已保存，已自动标记「已发货」并推送用户。", "success");
  } catch (err) {
    setOrdersMessage(err.message, "error");
  }
}

async function handleNoteSave(orderId) {
  if (!orderId) return;
  const input = adminOrdersList.querySelector(`[data-note="${orderId}"]`);
  const adminNote = input ? input.value.trim() : "";
  setOrdersMessage("正在保存备注…");
  try {
    await callAdminOrders("update-note", { orderId, adminNote });
    const idx = state.orders.findIndex((o) => o._id === orderId);
    if (idx >= 0) state.orders[idx].adminNote = adminNote;
    setOrdersMessage("备注已保存（仅你可见）。", "success");
  } catch (err) {
    setOrdersMessage(err.message, "error");
  }
}

// 硬删订单（清理测试单）：二次确认 → delete-order → 内存移除 + 总数-1 + 重渲染。
// 数据看板每次进入都重新拉取，故删除后自动同步，无需额外处理。
async function handleOrderDelete(id) {
  const o = state.orders.find((x) => x._id === id);
  if (!o) return;
  const addr = o.address || {};
  const who = addr.recipient ? `「${addr.recipient}」的` : "这笔";
  if (!confirm(`永久删除${who}订单？\n不可恢复；数据看板统计会相应减少。仅建议用于清理测试单。`)) return;
  setOrdersMessage("正在删除…");
  try {
    await callAdminOrders("delete-order", { orderId: id });
    state.orders = state.orders.filter((x) => x._id !== id);
    state.selectedOrderIds.delete(id);
    state.ordersTotal = Math.max(0, state.ordersTotal - 1);
    if (state.expandedOrderId === id) state.expandedOrderId = "";
    renderOrdersList();
    setOrdersMessage("订单已删除，数据看板将自动同步。", "success");
  } catch (err) {
    setOrdersMessage(err.message || "删除失败", "error");
  }
}

function copyOrderAddress(orderId) {
  const o = state.orders.find((x) => x._id === orderId);
  if (!o) return;
  const a = o.address || {};
  const text = `${a.recipient || ""} ${a.phone || ""}\n${a.province || ""} ${a.city || ""} ${a.district || ""} ${a.detail || ""}`;
  navigator.clipboard?.writeText(text).then(
    () => setOrdersMessage("已复制收件信息。", "success"),
    () => setOrdersMessage("复制失败，请手动选中。", "error")
  );
}

adminTabOrders?.addEventListener("click", () => {
  state.activePanel = "orders";
  updatePanelUi();
  loadOrders();
});

adminOrdersRefreshButton?.addEventListener("click", () => loadOrders());

// 状态分段 tab：待处理 / 已发货 / 已取消 / 全部订单
const adminOrdersSegs = document.getElementById("adminOrdersSegs");
adminOrdersSegs?.addEventListener("click", (event) => {
  const btn = event.target.closest("[data-orders-seg]");
  if (!btn) return;
  state.ordersStatus = btn.getAttribute("data-orders-seg") || "pending";
  state.ordersPage = 0;
  state.selectedOrderIds.clear();
  Array.from(adminOrdersSegs.querySelectorAll(".admin-orders-seg")).forEach((b) => {
    b.classList.toggle("active", b === btn);
  });
  loadOrders();
});

let ordersSearchTimer = null;
adminOrdersSearchInput?.addEventListener("input", () => {
  clearTimeout(ordersSearchTimer);
  ordersSearchTimer = setTimeout(() => {
    state.ordersSearch = adminOrdersSearchInput.value || "";
    state.ordersPage = 0;
    state.selectedOrderIds.clear();
    loadOrders();
  }, 300);
});

adminOrdersList?.addEventListener("click", (event) => {
  const checkbox = event.target.closest("[data-select-order]");
  if (checkbox) {
    event.stopPropagation();
    const id = checkbox.dataset.selectOrder;
    if (checkbox.checked) state.selectedOrderIds.add(id);
    else state.selectedOrderIds.delete(id);
    updateBulkBar();
    return;
  }
  const saveTracking = event.target.closest("[data-save-tracking]");
  if (saveTracking) {
    event.stopPropagation();
    handleTrackingSave(saveTracking.dataset.saveTracking);
    return;
  }
  const saveNote = event.target.closest("[data-save-note]");
  if (saveNote) {
    event.stopPropagation();
    handleNoteSave(saveNote.dataset.saveNote);
    return;
  }
  const delOrder = event.target.closest("[data-delete-order]");
  if (delOrder) {
    event.stopPropagation();
    handleOrderDelete(delOrder.dataset.deleteOrder);
    return;
  }
  const carrierChip = event.target.closest(".carrier-chip");
  if (carrierChip) {
    event.stopPropagation();
    const cid = carrierChip.dataset.cid;
    const companyInput = adminOrdersList.querySelector(`[data-tracking-company="${cid}"]`);
    if (companyInput) {
      companyInput.value = carrierChip.dataset.carrier;
      delete companyInput.dataset.auto;
    }
    return;
  }
  const prev = event.target.closest("[data-page-prev]");
  const next = event.target.closest("[data-page-next]");
  const toggle = event.target.closest("[data-toggle-order]");
  const copy = event.target.closest("[data-copy-order]");
  if (prev) {
    if (state.ordersPage > 0) {
      state.ordersPage--;
      state.expandedOrderId = "";
      state.selectedOrderIds.clear(); // 批量选择仅在本页有效，翻页即清空，避免跨页幽灵 ID
      loadOrders();
    }
    return;
  }
  if (next) {
    const totalPages = Math.max(1, Math.ceil(state.ordersTotal / state.ordersPageSize));
    if (state.ordersPage < totalPages - 1) {
      state.ordersPage++;
      state.expandedOrderId = "";
      state.selectedOrderIds.clear();
      loadOrders();
    }
    return;
  }
  if (copy) {
    event.stopPropagation();
    copyOrderAddress(copy.dataset.copyOrder);
    return;
  }
  if (toggle) {
    const id = toggle.dataset.toggleOrder;
    state.expandedOrderId = state.expandedOrderId === id ? "" : id;
    renderOrdersList();
  }
});

adminOrdersList?.addEventListener("change", (event) => {
  const sel = event.target.closest(".admin-order-status-select");
  if (!sel) return;
  handleOrderStatusChange(sel);
});

// 输入快递单号时自动识别快递公司（带字母前缀/常见号段准确，纯数字仅作推荐）
function detectCarrier(noRaw) {
  const no = String(noRaw || "").trim().toUpperCase();
  if (!no) return "";
  const rules = [
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
  for (const [re, name] of rules) {
    if (re.test(no)) return name;
  }
  return "";
}

adminOrdersList?.addEventListener("input", (event) => {
  const noInput = event.target.closest("[data-tracking-no]");
  if (!noInput) return;
  const id = noInput.dataset.trackingNo;
  const companyInput = adminOrdersList.querySelector(`[data-tracking-company="${id}"]`);
  if (!companyInput) return;
  const carrier = detectCarrier(noInput.value);
  // 只在公司框为空或之前是自动填的值时覆盖，避免覆盖手填
  if (carrier && (!companyInput.value || companyInput.dataset.auto === "1")) {
    companyInput.value = carrier;
    companyInput.dataset.auto = "1";
  }
});

adminOrdersSelectAll?.addEventListener("change", () => {
  const checked = adminOrdersSelectAll.checked;
  if (checked) {
    state.orders.forEach(o => state.selectedOrderIds.add(o._id));
  } else {
    state.orders.forEach(o => state.selectedOrderIds.delete(o._id));
  }
  renderOrdersList();
});

adminOrdersBulkApply?.addEventListener("click", handleBulkUpdate);
adminOrdersBulkDelete?.addEventListener("click", handleBulkDelete);

adminOrdersBulkClear?.addEventListener("click", () => {
  state.selectedOrderIds.clear();
  if (adminOrdersBulkStatus) adminOrdersBulkStatus.value = "";
  renderOrdersList();
});

// ============ 数据看板 ============

const PERIOD_LABEL = { today: "今日", week: "本周", month: "本月", all: "全部" };

function setStatsMessage(text, tone = "idle") {
  if (!adminStatsMessage) return;
  adminStatsMessage.textContent = text;
  adminStatsMessage.dataset.tone = tone;
}

function formatStatsTimestamp(d) {
  if (!d) return "";
  const pad = (n) => String(n).padStart(2, "0");
  const week = ["日", "一", "二", "三", "四", "五", "六"][d.getDay()];
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} (周${week}) ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function formatStatsClockParts(d) {
  if (!d) return { date: "", week: "", time: "" };
  const pad = (n) => String(n).padStart(2, "0");
  const week = ["日", "一", "二", "三", "四", "五", "六"][d.getDay()];
  return {
    date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
    week: `周${week}`,
    time: `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
  };
}

async function loadStats() {
  if (!adminStatsGrid) return;
  if (!activeSession()) {
    adminStatsGrid.innerHTML = "<p class=\"admin-status-text\">请先登录管理员账号。</p>";
    return;
  }
  adminStatsGrid.innerHTML = "<p class=\"admin-status-text\">加载中…</p>";
  setStatsMessage("");
  try {
    const data = await callAdminOrders("stats", { period: state.statsPeriod });
    state.stats = data;
    state.statsLoadedAt = new Date();
    renderStats();
  } catch (err) {
    adminStatsGrid.innerHTML = `<p class="admin-status-text">${escapeHtml(err.message)}</p>`;
  }
}

function renderDelta(curr, prev) {
  if (prev === undefined || prev === null) return "";
  const c = Number(curr) || 0;
  const p = Number(prev) || 0;
  if (p === 0 && c === 0) return `<span class="admin-stats-delta admin-stats-delta-flat">—</span>`;
  if (p === 0) return `<span class="admin-stats-delta admin-stats-delta-up">↑ 新增</span>`;
  const pct = Math.round(((c - p) / p) * 100);
  if (pct === 0) return `<span class="admin-stats-delta admin-stats-delta-flat">持平</span>`;
  const cls = pct > 0 ? "admin-stats-delta-up" : "admin-stats-delta-down";
  const arrow = pct > 0 ? "↑" : "↓";
  return `<span class="admin-stats-delta ${cls}">${arrow} ${Math.abs(pct)}%</span>`;
}

function renderTopList(list, kind) {
  if (!Array.isArray(list) || list.length === 0) {
    return '<p class="admin-status-text">暂无数据。</p>';
  }
  const unitText = (p) => {
    if (kind === 'viewed') return `${escapeHtml(p.count)} 次浏览`;
    if (kind === 'wishlisted') return `${escapeHtml(p.count)} 人加心愿`;
    return `${escapeHtml(p.count)} 次申请 · ${escapeHtml(p.cards || 0)} 积分`;
  };
  return `<div class="admin-stats-top-list">${list.map((p, i) => `
    <div class="admin-stats-top-item">
      <span class="admin-stats-rank">${i + 1}</span>
      ${p.imageUrl ? `<img src="${escapeHtml(p.imageUrl)}" alt="">` : ""}
      <div class="admin-stats-top-body">
        <div class="admin-stats-top-title">${escapeHtml(p.title)}</div>
        <div class="admin-stats-top-meta">${unitText(p)}</div>
      </div>
    </div>
  `).join("")}</div>`;
}

function renderHourlyChart(hourly) {
  const arr = Array.isArray(hourly) ? hourly : new Array(24).fill(0);
  const max = Math.max(1, ...arr);
  return `
    <div class="admin-stats-hours">
      ${arr.map((v, h) => `
        <div class="admin-stats-hour">
          <div class="admin-stats-hour-bar-wrap">
            <div class="admin-stats-hour-bar" style="height:${(v / max) * 100}%" title="${h}:00 — ${v} 单"></div>
          </div>
          <div class="admin-stats-hour-val">${v || ""}</div>
          <div class="admin-stats-hour-label">${h}</div>
        </div>
      `).join("")}
    </div>
    <div class="admin-stats-hours-axis">小时（0-23）</div>
  `;
}

function renderStats() {
  if (!adminStatsGrid) return;
  const s = state.stats;
  if (!s) {
    adminStatsGrid.innerHTML = "";
    return;
  }
  const periodLabel = PERIOD_LABEL[s.period] || s.period;
  const byStatus = (s.orders && s.orders.byStatus) || {};
  const top = Array.isArray(s.topProducts) ? s.topProducts : [];
  const topViewed = Array.isArray(s.topViewed) ? s.topViewed : [];
  const topWishlisted = Array.isArray(s.topWishlisted) ? s.topWishlisted : [];
  const dist = s.addressDistribution || { provinces: [], cities: [], total: 0 };
  const comp = s.comparison;
  const productsNew = (s.products && s.products.newInPeriod) || 0;
  const clock = formatStatsClockParts(new Date());

  adminStatsGrid.innerHTML = `
    <div class="admin-stats-timestamp">
      <div class="admin-stats-time-head">
        <span>当前时间</span>
        <span class="admin-stats-live"><i></i>LIVE</span>
      </div>
      <div class="admin-stats-clock" id="adminStatsClockTime">${escapeHtml(clock.time)}</div>
      <div class="admin-stats-date">
        <span id="adminStatsClockDate">${escapeHtml(clock.date)}</span>
        <span id="adminStatsClockWeek">${escapeHtml(clock.week)}</span>
      </div>
      <div class="admin-stats-loaded">数据更新于 ${escapeHtml(formatStatsTimestamp(state.statsLoadedAt))}</div>
    </div>

    <div class="admin-stats-cards">
      <div class="admin-stats-card">
        <div class="admin-stats-label">${escapeHtml(periodLabel)}新增用户 ${comp ? renderDelta(s.users.newInPeriod, comp.users) : ""}</div>
        <div class="admin-stats-value">${escapeHtml(s.users.newInPeriod)}</div>
        <div class="admin-stats-sub">累计 ${escapeHtml(s.users.total)} 个用户</div>
      </div>
      <div class="admin-stats-card">
        <div class="admin-stats-label">${escapeHtml(periodLabel)}申请订单 ${comp ? renderDelta(s.orders.total, comp.orders) : ""}</div>
        <div class="admin-stats-value">${escapeHtml(s.orders.total)}</div>
        <div class="admin-stats-sub">合计 ${escapeHtml(s.orders.totalCards || 0)} 积分 ${comp ? renderDelta(s.orders.totalCards || 0, comp.cards) : ""}</div>
      </div>
      <div class="admin-stats-card">
        <div class="admin-stats-label">${escapeHtml(periodLabel)}新上礼品</div>
        <div class="admin-stats-value">${escapeHtml(productsNew)}</div>
        <div class="admin-stats-sub">${s.period === "all" ? "—" : "周期内 admin 录入数"}</div>
      </div>
      <div class="admin-stats-card">
        <div class="admin-stats-label">订单状态分布</div>
        <div class="admin-stats-status-grid">
          <div class="admin-stats-status-row"><span class="admin-order-status admin-order-status-pending">待处理</span><span>${escapeHtml(byStatus.pending || 0)}</span></div>
          <div class="admin-stats-status-row"><span class="admin-order-status admin-order-status-done">已发货</span><span>${escapeHtml(byStatus.done || 0)}</span></div>
          <div class="admin-stats-status-row"><span class="admin-order-status admin-order-status-cancelled">已取消</span><span>${escapeHtml(byStatus.cancelled || 0)}</span></div>
        </div>
      </div>
    </div>

    <div class="admin-stats-section">
      <h3 class="admin-stats-section-title">${escapeHtml(periodLabel)}下单时段分布（24h）</h3>
      ${renderHourlyChart(s.hourly)}
    </div>

    <div class="admin-stats-section">
      <h3 class="admin-stats-section-title">${escapeHtml(periodLabel)}最受申请礼品 TOP 5</h3>
      ${renderTopList(top, 'requested')}
    </div>

    <div class="admin-stats-section">
      <h3 class="admin-stats-section-title">浏览 TOP 10 <span class="admin-stats-section-tag">累计</span></h3>
      ${renderTopList(topViewed, 'viewed')}
    </div>
    <!-- 心愿 TOP 10 暂时隐藏：心愿单仅登录用户上云、数据稀疏 -->

    <div class="admin-stats-doublerow">
      <div class="admin-stats-section">
        <h3 class="admin-stats-section-title">省份 TOP 5 <span class="admin-stats-section-tag">${escapeHtml(PERIOD_LABEL[state.statsPeriod] || "")}${escapeHtml(dist.total)} 单</span></h3>
        ${dist.provinces.length === 0
          ? '<p class="admin-status-text">暂无地址数据。</p>'
          : `<div class="admin-stats-region-list">${dist.provinces.map((p, i) => `
              <div class="admin-stats-region-row">
                <span class="admin-stats-rank">${i + 1}</span>
                <span class="admin-stats-region-name">${escapeHtml(p.name)}</span>
                <span class="admin-stats-region-count">${escapeHtml(p.count)} 人</span>
              </div>
            `).join("")}</div>`}
      </div>
      <div class="admin-stats-section">
        <h3 class="admin-stats-section-title">城市 TOP 10</h3>
        ${dist.cities.length === 0
          ? '<p class="admin-status-text">暂无地址数据。</p>'
          : `<div class="admin-stats-region-list">${dist.cities.map((c, i) => `
              <div class="admin-stats-region-row">
                <span class="admin-stats-rank">${i + 1}</span>
                <span class="admin-stats-region-name">${escapeHtml(c.name)}</span>
                <span class="admin-stats-region-count">${escapeHtml(c.count)} 人</span>
              </div>
            `).join("")}</div>`}
      </div>
    </div>

    ${s.orders.sampleSize >= 1000
      ? '<p class="admin-status-text" style="margin-top:12px;font-size:12px;">该周期订单数过多（≥1000），TOP 5 / 时段分布基于最近 1000 单聚合。</p>'
      : ""}
  `;
}

adminTabStats?.addEventListener("click", () => {
  state.activePanel = "stats";
  updatePanelUi();
  loadStats();
});

// 实时时钟：每秒更新数据看板顶部的当前时间显示
setInterval(() => {
  const timeEl = document.getElementById("adminStatsClockTime");
  const dateEl = document.getElementById("adminStatsClockDate");
  const weekEl = document.getElementById("adminStatsClockWeek");
  if (!timeEl && !dateEl && !weekEl) return;
  const clock = formatStatsClockParts(new Date());
  if (timeEl) timeEl.textContent = clock.time;
  if (dateEl) dateEl.textContent = clock.date;
  if (weekEl) weekEl.textContent = clock.week;
}, 1000);

adminStatsRefreshButton?.addEventListener("click", () => loadStats());

adminStatsPeriod?.addEventListener("click", (event) => {
  const chip = event.target.closest("[data-stats-period]");
  if (!chip) return;
  const p = chip.dataset.statsPeriod;
  if (p === state.statsPeriod) return;
  state.statsPeriod = p;
  adminStatsPeriod.querySelectorAll(".admin-stats-chip").forEach(el => {
    el.classList.toggle("active", el === chip);
  });
  loadStats();
});

// ============ 晒图审核 ============

const REVIEW_STATUS_LABEL = { pending: "待审核", approved: "已通过", rejected: "已拒绝" };

function setReviewsMessage(text, tone = "idle") {
  if (!adminReviewsMessage) return;
  adminReviewsMessage.textContent = text;
  adminReviewsMessage.dataset.tone = tone;
}

async function loadReviews() {
  if (!adminReviewsList) return;
  if (!activeSession()) {
    adminReviewsList.innerHTML = "<p class=\"admin-status-text\">请先登录管理员账号。</p>";
    return;
  }
  adminReviewsList.innerHTML = "<p class=\"admin-status-text\">加载中…</p>";
  setReviewsMessage("");
  try {
    const data = await callAdminOrders("list-reviews", { status: state.reviewsStatus, limit: 100 });
    state.reviews = Array.isArray(data && data.items) ? data.items : [];
    if (adminReviewsCount) adminReviewsCount.textContent = `共 ${(data && data.total) || 0} 条`;
    renderReviews();
  } catch (err) {
    adminReviewsList.innerHTML = `<p class="admin-status-text">${escapeHtml(err.message)}</p>`;
  }
}

function reviewDate(d) {
  if (!d) return "";
  try {
    const date = new Date(d);
    const pad = (n) => String(n).padStart(2, "0");
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
  } catch { return ""; }
}

function renderReviews() {
  if (!adminReviewsList) return;
  if (state.reviews.length === 0) {
    adminReviewsList.innerHTML = "<p class=\"admin-status-text\">没有符合条件的晒图。</p>";
    return;
  }
  adminReviewsList.innerHTML = state.reviews.map((r) => {
    const imgs = Array.isArray(r.imageUrls) ? r.imageUrls.filter(Boolean) : [];
    const stars = "★".repeat(Math.round(r.rating || 0)) + "☆".repeat(5 - Math.round(r.rating || 0));
    return `
      <div class="admin-review-card">
        <div class="admin-review-head">
          <span class="admin-review-user">${escapeHtml(r.nickName || "微信用户")}</span>
          <span class="admin-review-stars">${stars}</span>
          <span class="admin-order-status admin-order-status-${r.status === 'approved' ? 'done' : (r.status === 'rejected' ? 'cancelled' : 'pending')}">${escapeHtml(REVIEW_STATUS_LABEL[r.status] || r.status)}</span>
        </div>
        ${r.productTitle ? `<div class="admin-review-product">🎁 ${escapeHtml(r.productTitle)}</div>` : ""}
        ${r.content ? `<div class="admin-review-content">${escapeHtml(r.content)}</div>` : ""}
        <div class="admin-review-imgs">
          ${imgs.map(u => `<img src="${escapeHtml(u)}" alt="">`).join("")}
        </div>
        <div class="admin-review-foot">
          <span class="admin-review-date">${escapeHtml(reviewDate(r.createdAt))}</span>
          <span class="admin-review-actions">
            ${r.status !== 'approved' ? `<button class="admin-secondary-btn admin-review-approve" data-approve="${escapeHtml(r._id)}" type="button">通过</button>` : ""}
            ${r.status !== 'rejected' ? `<button class="admin-secondary-btn admin-review-reject" data-reject="${escapeHtml(r._id)}" type="button">拒绝</button>` : ""}
          </span>
        </div>
      </div>
    `;
  }).join("");
}

async function moderateReview(reviewId, status) {
  setReviewsMessage("处理中…");
  try {
    await callAdminOrders("review-status", { reviewId, status });
    const idx = state.reviews.findIndex(r => r._id === reviewId);
    if (idx >= 0) {
      // 当前按状态筛选时，状态变了就移出列表
      if (state.reviewsStatus !== "all" && state.reviewsStatus !== status) {
        state.reviews.splice(idx, 1);
      } else {
        state.reviews[idx].status = status;
      }
    }
    renderReviews();
    setReviewsMessage(status === "approved" ? "已通过，用户端可见。" : "已处理。", "success");
  } catch (err) {
    setReviewsMessage(err.message, "error");
  }
}

adminTabReviews?.addEventListener("click", () => {
  state.activePanel = "reviews";
  updatePanelUi();
  loadReviews();
});

adminReviewsRefreshButton?.addEventListener("click", () => loadReviews());

adminReviewsStatusFilter?.addEventListener("change", () => {
  state.reviewsStatus = adminReviewsStatusFilter.value || "pending";
  loadReviews();
});

adminReviewsList?.addEventListener("click", (event) => {
  const ap = event.target.closest("[data-approve]");
  const rj = event.target.closest("[data-reject]");
  if (ap) { moderateReview(ap.dataset.approve, "approved"); return; }
  if (rj) {
    const img = event.target.closest("[data-reject]");
    if (confirm("确认拒绝这条晒图？")) moderateReview(rj.dataset.reject, "rejected");
    return;
  }
});

// ============ 分类排序 ============

function setCatOrderMessage(text, tone = "idle") {
  if (!adminCatOrderMessage) return;
  adminCatOrderMessage.textContent = text;
  adminCatOrderMessage.dataset.tone = tone;
}

async function loadCatOrder() {
  if (!adminCatOrderList) return;
  if (!activeSession()) {
    adminCatOrderList.innerHTML = "<p class=\"admin-status-text\">请先登录管理员账号。</p>";
    return;
  }
  // 除 all 外的实分类
  const real = categoryOptions.filter(c => c.value !== "all");
  adminCatOrderList.innerHTML = "<p class=\"admin-status-text\">加载中…</p>";
  setCatOrderMessage("");
  try {
    const data = await callAdminOrders("get-category-order", {});
    const order = (data && Array.isArray(data.order)) ? data.order : [];
    const idx = (v) => { const i = order.indexOf(v); return i < 0 ? 9999 : i; };
    state.catOrder = real.slice().sort((a, b) => idx(a.value) - idx(b.value));
    renderCatOrder();
  } catch (err) {
    adminCatOrderList.innerHTML = `<p class="admin-status-text">${escapeHtml(err.message)}</p>`;
  }
}

function renderCatOrder() {
  if (!adminCatOrderList) return;
  adminCatOrderList.innerHTML = state.catOrder.map((c, i) => `
    <div class="admin-catorder-row">
      <span class="admin-catorder-idx">${i + 1}</span>
      <span class="admin-catorder-name">${escapeHtml(c.label)}</span>
      <span class="admin-catorder-btns">
        <button class="admin-secondary-btn" data-cat-up="${i}" type="button" ${i === 0 ? "disabled" : ""}>↑</button>
        <button class="admin-secondary-btn" data-cat-down="${i}" type="button" ${i === state.catOrder.length - 1 ? "disabled" : ""}>↓</button>
      </span>
    </div>
  `).join("");
}

function moveCat(from, to) {
  if (to < 0 || to >= state.catOrder.length) return;
  const arr = state.catOrder;
  const [item] = arr.splice(from, 1);
  arr.splice(to, 0, item);
  renderCatOrder();
}

// 录入下拉顺序（本地）
function setInputOrderMessage(text, tone = "idle") {
  if (!adminInputOrderMessage) return;
  adminInputOrderMessage.textContent = text;
  adminInputOrderMessage.dataset.tone = tone;
}

function loadInputOrder() {
  state.inputOrder = orderedInputCategories();
  renderInputOrder();
}

function renderInputOrder() {
  if (!adminInputOrderList) return;
  adminInputOrderList.innerHTML = state.inputOrder.map((c, i) => `
    <div class="admin-catorder-row">
      <span class="admin-catorder-idx">${i + 1}</span>
      <span class="admin-catorder-name">${escapeHtml(c.label)}</span>
      <span class="admin-catorder-btns">
        <button class="admin-secondary-btn" data-input-up="${i}" type="button" ${i === 0 ? "disabled" : ""}>↑</button>
        <button class="admin-secondary-btn" data-input-down="${i}" type="button" ${i === state.inputOrder.length - 1 ? "disabled" : ""}>↓</button>
      </span>
    </div>
  `).join("");
}

function moveInput(from, to) {
  if (to < 0 || to >= state.inputOrder.length) return;
  const arr = state.inputOrder;
  const [item] = arr.splice(from, 1);
  arr.splice(to, 0, item);
  renderInputOrder();
}

adminInputOrderList?.addEventListener("click", (event) => {
  const up = event.target.closest("[data-input-up]");
  const down = event.target.closest("[data-input-down]");
  if (up) { const i = Number(up.dataset.inputUp); moveInput(i, i - 1); return; }
  if (down) { const i = Number(down.dataset.inputDown); moveInput(i, i + 1); return; }
});

adminInputOrderSave?.addEventListener("click", () => {
  try {
    localStorage.setItem(INPUT_CAT_ORDER_KEY, JSON.stringify(state.inputOrder.map(c => c.value)));
    fillCategoryOptions();   // 立刻应用到录入下拉
    restoreLastCategory();
    setInputOrderMessage("已保存，录入下拉已按新顺序排列。", "success");
  } catch (err) {
    setInputOrderMessage("保存失败：" + err.message, "error");
  }
});

adminTabCatOrder?.addEventListener("click", () => {
  state.activePanel = "catorder";
  updatePanelUi();
  loadCatOrder();
  loadInputOrder();
});

adminCatOrderList?.addEventListener("click", (event) => {
  const up = event.target.closest("[data-cat-up]");
  const down = event.target.closest("[data-cat-down]");
  if (up) { const i = Number(up.dataset.catUp); moveCat(i, i - 1); return; }
  if (down) { const i = Number(down.dataset.catDown); moveCat(i, i + 1); return; }
});

adminCatOrderSave?.addEventListener("click", async () => {
  setCatOrderMessage("保存中…");
  try {
    const order = state.catOrder.map(c => c.value);
    await callAdminOrders("save-category-order", { order });
    setCatOrderMessage("已保存，小程序刷新后按新顺序显示。", "success");
  } catch (err) {
    setCatOrderMessage(err.message, "error");
  }
});

// ============ 首页海报 ============

const HAIBAO_LINKS_M = [
  { type: "none", value: "", label: "不跳转" },
  { type: "tab", value: "/pages/list/list", label: "全部礼品" },
  { type: "tab", value: "/pages/category/category", label: "分类页" },
  { type: "tab", value: "/pages/wishlist/wishlist", label: "心愿单" },
  { type: "product", value: "", label: "指定商品（填商品ID）" }
];

function haibaoLinkIndexM(slot) {
  for (let i = 0; i < HAIBAO_LINKS_M.length; i += 1) {
    const o = HAIBAO_LINKS_M[i];
    if (o.type === "product" && slot.linkType === "product") return i;
    if (o.type === slot.linkType && o.value === (slot.linkValue || "")) return i;
  }
  return 0;
}

function setHaibaoMessage(text, tone = "idle") {
  if (!adminHaibaoMessage) return;
  adminHaibaoMessage.textContent = text;
  adminHaibaoMessage.dataset.tone = tone;
}

async function loadHaibao() {
  if (!adminHaibaoList) return;
  if (!activeSession()) {
    adminHaibaoList.innerHTML = "<p class=\"admin-status-text\">请先登录管理员账号。</p>";
    return;
  }
  adminHaibaoList.innerHTML = "<p class=\"admin-status-text\">加载中…</p>";
  setHaibaoMessage("");
  try {
    const data = await callAdminOrders("get-home-banners", {});
    const arr = (data && Array.isArray(data.banners)) ? data.banners : [];
    state.haibanners = arr.map((b) => ({
      imageUrl: b.imageUrl || "", linkType: b.linkType || "none", linkValue: b.linkValue || "", title: b.title || ""
    }));
    renderHaibao();
  } catch (err) {
    adminHaibaoList.innerHTML = `<p class="admin-status-text">${escapeHtml(err.message)}</p>`;
  }
}

function renderHaibao() {
  if (!adminHaibaoList) return;
  if (state.haibanners.length === 0) {
    adminHaibaoList.innerHTML = "<p class=\"admin-status-text\">还没有海报，点下方「+ 添加海报」开始。无海报时小程序首页显示默认图。</p>";
    return;
  }
  const last = state.haibanners.length - 1;
  adminHaibaoList.innerHTML = state.haibanners.map((slot, i) => {
    const busy = slot.uploading ? "disabled" : "";
    const thumb = slot.imageUrl
      ? `<img class="admin-haibao-thumb" src="${escapeHtml(slot.imageUrl)}" alt="">`
      : `<span class="admin-haibao-thumb admin-haibao-thumb-empty">${slot.uploading ? "上传中…" : "无图"}</span>`;
    const linkIdx = haibaoLinkIndexM(slot);
    const options = HAIBAO_LINKS_M.map((o, oi) => `<option value="${oi}" ${oi === linkIdx ? "selected" : ""}>${escapeHtml(o.label)}</option>`).join("");
    const productInput = slot.linkType === "product"
      ? `<input class="admin-haibao-input" type="text" placeholder="商品 ID（从「编辑礼品」复制）" value="${escapeHtml(slot.linkValue || "")}" data-hb-linkvalue="${i}">`
      : "";
    return `
      <div class="admin-haibao-row">
        <div class="admin-haibao-top">
          <span class="admin-catorder-idx">${i + 1}</span>
          ${thumb}
          <span class="admin-haibao-acts">
            <button class="admin-secondary-btn" data-hb-up="${i}" type="button" ${i === 0 ? "disabled" : busy}>↑</button>
            <button class="admin-secondary-btn" data-hb-down="${i}" type="button" ${i === last ? "disabled" : busy}>↓</button>
            <button class="admin-secondary-btn" data-hb-del="${i}" type="button">删除</button>
          </span>
        </div>
        <label class="admin-haibao-file">选图片<input type="file" accept="image/*" data-hb-file="${i}" ${busy}></label>
        <select class="admin-haibao-input" data-hb-link="${i}">${options}</select>
        ${productInput}
        <input class="admin-haibao-input" type="text" maxlength="50" placeholder="备注（选填，仅后台可见）" value="${escapeHtml(slot.title || "")}" data-hb-title="${i}">
        ${slot.error ? `<span class="admin-haibao-err">${escapeHtml(slot.error)} ${slot._file ? `<button class="admin-secondary-btn" data-hb-retry="${i}" type="button">重试</button>` : ""}</span>` : ""}
      </div>`;
  }).join("");
}

function moveHaibaoM(from, to) {
  if (to < 0 || to >= state.haibanners.length) return;
  const arr = state.haibanners;
  const [item] = arr.splice(from, 1);
  arr.splice(to, 0, item);
  renderHaibao();
}

async function uploadHaibaoSlotM(i, file) {
  const slot = state.haibanners[i];
  if (!slot || !file) return;
  slot.uploading = true;
  slot.error = "";
  slot._file = file;
  renderHaibao();
  setHaibaoMessage("正在上传图片…");
  try {
    const url = await uploadFile(file);
    slot.imageUrl = url;
    slot.uploading = false;
    slot.error = "";
    slot._file = null;
    renderHaibao();
    setHaibaoMessage("图片已上传。", "success");
  } catch (err) {
    slot.uploading = false;
    slot.error = err.message || "上传失败";
    renderHaibao();
    setHaibaoMessage("图片上传失败，可点该行「重试」。", "error");
  }
}

adminHaibaoList?.addEventListener("click", (event) => {
  const up = event.target.closest("[data-hb-up]");
  const down = event.target.closest("[data-hb-down]");
  const del = event.target.closest("[data-hb-del]");
  const retry = event.target.closest("[data-hb-retry]");
  if (up && !up.disabled) { const i = Number(up.dataset.hbUp); moveHaibaoM(i, i - 1); return; }
  if (down && !down.disabled) { const i = Number(down.dataset.hbDown); moveHaibaoM(i, i + 1); return; }
  if (del) {
    const i = Number(del.dataset.hbDel);
    const s = state.haibanners[i];
    if (s && s.uploading) { setHaibaoMessage("图片上传中，请稍候再删除。", "error"); return; }
    state.haibanners.splice(i, 1); renderHaibao(); return;
  }
  if (retry) {
    const i = Number(retry.dataset.hbRetry);
    const s = state.haibanners[i];
    if (s && s._file) uploadHaibaoSlotM(i, s._file);
    return;
  }
});

adminHaibaoList?.addEventListener("change", (event) => {
  const fileInput = event.target.closest("[data-hb-file]");
  if (fileInput) {
    const i = Number(fileInput.dataset.hbFile);
    const f = fileInput.files && fileInput.files[0];
    if (f) uploadHaibaoSlotM(i, f);
    return;
  }
  const linkSel = event.target.closest("[data-hb-link]");
  if (linkSel) {
    const i = Number(linkSel.dataset.hbLink);
    const slot = state.haibanners[i];
    if (!slot) return;
    const opt = HAIBAO_LINKS_M[Number(linkSel.value)] || HAIBAO_LINKS_M[0];
    slot.linkType = opt.type;
    slot.linkValue = (opt.type === "product") ? (slot.linkValue || "") : opt.value;
    renderHaibao();
    return;
  }
});

adminHaibaoList?.addEventListener("input", (event) => {
  const lv = event.target.closest("[data-hb-linkvalue]");
  if (lv) { const i = Number(lv.dataset.hbLinkvalue); if (state.haibanners[i]) state.haibanners[i].linkValue = (lv.value || "").trim(); return; }
  const tt = event.target.closest("[data-hb-title]");
  if (tt) { const i = Number(tt.dataset.hbTitle); if (state.haibanners[i]) state.haibanners[i].title = tt.value || ""; return; }
});

adminHaibaoAdd?.addEventListener("click", () => {
  if (state.haibanners.length >= 20) { setHaibaoMessage("最多 20 张。", "error"); return; }
  state.haibanners.push({ imageUrl: "", linkType: "none", linkValue: "", title: "" });
  renderHaibao();
});

adminHaibaoSave?.addEventListener("click", async () => {
  if (state.haibanners.some((s) => s.uploading)) { setHaibaoMessage("还有图片在上传，请稍候。", "error"); return; }
  if (state.haibanners.some((s) => s.linkType === "product" && !(s.linkValue || "").trim())) {
    setHaibaoMessage("「指定商品」的海报需填写商品 ID。", "error"); return;
  }
  setHaibaoMessage("保存中…");
  try {
    const banners = state.haibanners
      .filter((s) => s.imageUrl)
      .map((s) => ({ imageUrl: s.imageUrl, linkType: s.linkType || "none", linkValue: s.linkValue || "", title: s.title || "" }));
    await callAdminOrders("save-home-banners", { banners });
    // 同时写 Supabase，供 H5 网页端读取（失败不影响小程序）。
    try {
      await authedFetch(
        `${config.supabaseUrl}/rest/v1/app_config`,
        { method: "POST", body: JSON.stringify({ key: "home_banners", value: banners, updated_at: new Date().toISOString() }) },
        { "Content-Type": "application/json", Prefer: "resolution=merge-duplicates,return=minimal" }
      );
      setHaibaoMessage("已保存，小程序下拉刷新 / H5 刷新生效。", "success");
    } catch (e2) {
      setHaibaoMessage("小程序已更新；网页端同步失败：" + (e2.message || ""), "error");
    }
  } catch (err) {
    setHaibaoMessage(err.message, "error");
  }
});

adminTabHaibao?.addEventListener("click", () => {
  state.activePanel = "haibao";
  updatePanelUi();
  loadHaibao();
});

fillCategoryOptions();
restoreLastCategory();
renderTitleHistory();
adminCategorySelect?.addEventListener("change", updateSubcategoryField);
updateAuthUi();
bindPreviewEvents();
bindPriceAutoCalc();
setEditorMode(null);
updateImageSlotControls();
updatePanelUi();
setSubmitMessage("");
updateFormAccess();
restoreSession();
