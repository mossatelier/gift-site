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
const adminTabGoods = document.getElementById("adminTabGoods");
const adminGoodsSubnav = document.getElementById("adminGoodsSubnav");
const adminGoodsTabCreate = document.getElementById("adminGoodsTabCreate");
const adminGoodsTabEdit = document.getElementById("adminGoodsTabEdit");
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
const adminOrdersBulkLogisticsButton = document.getElementById("adminOrdersBulkLogisticsButton");
const adminOrdersOnlyFail = document.getElementById("adminOrdersOnlyFail");
const adminOrdersBulkBar = document.getElementById("adminOrdersBulkBar");
const adminOrdersSelectAll = document.getElementById("adminOrdersSelectAll");
const adminOrdersSelectedCount = document.getElementById("adminOrdersSelectedCount");
const adminOrdersBulkStatus = document.getElementById("adminOrdersBulkStatus");
const adminOrdersBulkApply = document.getElementById("adminOrdersBulkApply");
const adminOrdersBulkDelete = document.getElementById("adminOrdersBulkDelete");
const adminOrdersBulkClear = document.getElementById("adminOrdersBulkClear");
const adminTabReferral = document.getElementById("adminTabReferral");
const adminReferralPanel = document.getElementById("adminReferralPanel");
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
const adminTabCardBank = document.getElementById("adminTabCardBank");
const adminCardBankPanel = document.getElementById("adminCardBankPanel");
const adminCardBankList = document.getElementById("adminCardBankList");
const adminCardBankSave = document.getElementById("adminCardBankSave");
const adminCardBankMessage = document.getElementById("adminCardBankMessage");
const adminHaibaoMessage = document.getElementById("adminHaibaoMessage");
const adminHaibaoSave = document.getElementById("adminHaibaoSave");
const adminHaibaoAdd = document.getElementById("adminHaibaoAdd");
const adminTabRefShare = document.getElementById("adminTabRefShare");
const adminRefSharePanel = document.getElementById("adminRefSharePanel");
const adminRefShareThumb = document.getElementById("adminRefShareThumb");
const adminRefShareThumbEmpty = document.getElementById("adminRefShareThumbEmpty");
const adminRefShareFile = document.getElementById("adminRefShareFile");
const adminRefShareTitle = document.getElementById("adminRefShareTitle");
const adminRefShareSave = document.getElementById("adminRefShareSave");
const adminRefShareMessage = document.getElementById("adminRefShareMessage");

const subcategoriesMap = config.subcategories || {};
const TITLE_HISTORY_KEY = "gift-site-admin-title-history";
const TITLE_HISTORY_LIMIT = 30;
const MAX_PRODUCT_IMAGES = 5;
// ⚠️ 2026-07-30 收紧（原 1600px/0.84/650KB）：图太大导致月出站 8GB 撑爆 Supabase 免费版 5GB。
// 与 admin-core.js 保持一致，两处都要改。
const IMAGE_COMPRESS_MAX_EDGE = 800;
const IMAGE_COMPRESS_QUALITY = 0.78;
const IMAGE_COMPRESS_MIN_BYTES = 80 * 1024;
// 上传体积硬上限：base64 传给云函数会膨胀 33%，超过 HTTP 网关请求体上限就 413
const IMAGE_UPLOAD_MAX_BYTES = 65 * 1024;

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
  ordersOnlyFail: false,   // 「只看物流异常」筛选（前端过滤本页）
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

// C 步：登录改走云开发（admin-orders 的 auth-login）。
// 双轨期：云开发失败时回退 Supabase，确保切换过程中后台不会锁死。
async function signInWithPassword(email, password) {
  if (config.adminOrdersUrl) {
    try {
      const res = await fetch(config.adminOrdersUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "auth-login", email, password })
      });
      const json = await res.json();
      if (res.ok && json && json.ok && json.data && json.data.access_token) {
        return json.data;
      }
      const msg = json && json.error ? String(json.error) : "";
      if (/密码|锁定|邮箱/.test(msg)) throw new Error(msg);
    } catch (e) {
      if (e && /密码|锁定|邮箱/.test(e.message || "")) throw e;
      // 网络异常或云端未初始化 → 落到 Supabase 兜底
    }
  }
  return signInViaSupabase(email, password);
}

// 旧登录方式（双轨兜底；云开发登录稳定后可删）
async function signInViaSupabase(email, password) {
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
    referral: adminReferralPanel,
    stats: adminStatsPanel,
    reviews: adminReviewsPanel,
    catorder: adminCatOrderPanel,
    haibao: adminHaibaoPanel,
    cardbank: adminCardBankPanel,
    refshare: adminRefSharePanel
  };
  Object.keys(panels).forEach((key) => {
    if (panels[key]) panels[key].hidden = state.activePanel !== key;
  });

  // 「礼品管理」合并 tab：录入/编辑 两个子视图共用，二者之一激活时高亮
  const inGoods = state.activePanel === "create" || state.activePanel === "edit";
  const tabActive = {
    goods: inGoods,
    banks: state.activePanel === "banks",
    orders: state.activePanel === "orders",
    referral: state.activePanel === "referral",
    stats: state.activePanel === "stats",
    reviews: state.activePanel === "reviews",
    catorder: state.activePanel === "catorder",
    haibao: state.activePanel === "haibao",
    cardbank: state.activePanel === "cardbank",
    refshare: state.activePanel === "refshare"
  };
  const tabEls = {
    goods: adminTabGoods,
    banks: adminTabBanks,
    orders: adminTabOrders,
    referral: adminTabReferral,
    stats: adminTabStats,
    reviews: adminTabReviews,
    catorder: adminTabCatOrder,
    haibao: adminTabHaibao,
    cardbank: adminTabCardBank,
    refshare: adminTabRefShare
  };
  Object.keys(tabEls).forEach((k) => {
    if (tabEls[k]) tabEls[k].classList.toggle("active", tabActive[k]);
  });

  // 礼品管理子切换（录入/编辑）：仅在礼品视图显示
  if (adminGoodsSubnav) adminGoodsSubnav.hidden = !inGoods;
  if (adminGoodsTabCreate) adminGoodsTabCreate.classList.toggle("active", state.activePanel === "create");
  if (adminGoodsTabEdit) adminGoodsTabEdit.classList.toggle("active", state.activePanel === "edit");
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

    // 逐级降质量，直到体积达标（base64 会膨胀 33%，超了会被 HTTP 网关 413 拒收）
    let blob = null;
    for (const q of [IMAGE_COMPRESS_QUALITY, 0.7, 0.62, 0.55, 0.45]) {
      blob = await canvasToBlob(canvas, "image/jpeg", q);
      if (blob && blob.size <= IMAGE_UPLOAD_MAX_BYTES) break;
    }
    // 仍超标就再缩边长重压一次
    if (blob && blob.size > IMAGE_UPLOAD_MAX_BYTES) {
      canvas.width = Math.max(1, Math.round(targetWidth * 0.7));
      canvas.height = Math.max(1, Math.round(targetHeight * 0.7));
      const ctx2 = canvas.getContext("2d", { alpha: false });
      ctx2.fillStyle = "#ffffff";
      ctx2.fillRect(0, 0, canvas.width, canvas.height);
      ctx2.drawImage(image, 0, 0, canvas.width, canvas.height);
      blob = await canvasToBlob(canvas, "image/jpeg", 0.6);
    }

    if (!blob) {
      return file;
    }
    if (blob.size >= file.size && file.size <= IMAGE_UPLOAD_MAX_BYTES) {
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

// 读成 base64（经云函数中转写入云存储）
function fileToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("图片读取失败"));
    reader.readAsDataURL(blob);
  });
}

// 图片存云开发存储，经 admin-orders 云函数中转。
// ⚠️ HTTP 网关请求体上限约 96KB，base64 膨胀 33%
//    → compressImageFile 会把图压到 IMAGE_UPLOAD_MAX_BYTES(65KB) 以内。
async function uploadFile(file) {
  const uploadTarget = await compressImageFile(file);
  const base64 = await fileToBase64(uploadTarget);
  const data = await callAdminOrders("upload-image", {
    base64,
    name: sanitizeFileName(uploadTarget.name || "image.jpg")
  });
  if (!data || !data.url) throw new Error("图片上传失败：云端未返回地址");
  return data.url;
}

async function insertProduct(row) {
  const data = await callAdminOrders("products-create", { payload: row });
  return (data && data.product) || data;
}

async function updateProduct(productId, row) {
  return callAdminOrders("products-update", { id: productId, payload: row });
}

async function deleteProduct(productId) {
  return callAdminOrders("products-delete", { id: productId });
}

async function loadRecentProducts() {
  const session = activeSession();

  if (!session) {
    adminRecentList.innerHTML = "<p class=\"admin-status-text\">登录管理员账号后，这里会显示最近录入的商品。</p>";
    return;
  }

  try {
    const data = await callAdminOrders("products-list", { limit: 1000 });
    state.recentProducts = (data && Array.isArray(data.products)) ? data.products : [];
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

    // 云开发签发的会话：没有 refresh_token，用 expires_at 判活；校验交给云函数
    if (!stored.refresh_token && stored.expires_at) {
      if (Date.now() >= Number(stored.expires_at)) {
        throw new Error("登录已过期，请重新登录");
      }
      saveSession(stored);
      setAuthMessage("管理员登录状态已恢复。", "success");
      updateAuthUi();
      updateFormAccess();
      loadRecentProducts();
      return;
    }

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

// 记住上次登录邮箱，预填省得手输长邮箱（只存在本机浏览器，不进公开代码；密码交浏览器保存/自动填）
try {
  const _savedEmail = localStorage.getItem("gift-site-admin-email");
  if (adminEmailInput && _savedEmail && !adminEmailInput.value) adminEmailInput.value = _savedEmail;
} catch (e) { /* ignore */ }

// 显示密码开关
const adminShowPw = document.getElementById("adminShowPw");
adminShowPw?.addEventListener("change", () => {
  if (adminPasswordInput) adminPasswordInput.type = adminShowPw.checked ? "text" : "password";
});

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
    // 云开发登录已在服务端校验过身份并直接返回 user，无需再走 Supabase 的两步验证
    let nextSession = session;
    if (!session.user) {
      const user = await fetchCurrentUser(session.access_token);
      nextSession = { ...session, user };
      await verifyAdminAccess(nextSession.access_token);
    }
    saveSession(nextSession);
    try { localStorage.setItem("gift-site-admin-email", email); } catch (e) { /* ignore */ }
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

// 礼品管理合并 tab：进入默认「录入」子视图
adminTabGoods?.addEventListener("click", () => {
  if (state.activePanel !== "create" && state.activePanel !== "edit") {
    state.activePanel = "create";
  }
  updatePanelUi();
});
// 子切换：录入
adminGoodsTabCreate?.addEventListener("click", () => {
  state.activePanel = "create";
  updatePanelUi();
});
// 子切换：编辑（切换时加载列表，沿用原行为）
adminGoodsTabEdit?.addEventListener("click", () => {
  state.activePanel = "edit";
  updatePanelUi();
  loadRecentProducts();
});

adminTabBanks?.addEventListener("click", () => {
  state.activePanel = "banks";
  updatePanelUi();
  loadBanksEarn();
});

// ============ 推荐管理 CRM（手机后台） ============
adminTabReferral?.addEventListener("click", () => {
  state.activePanel = "referral";
  updatePanelUi();
  loadReferralAdmin();
});

const REF_ADMIN_TABS = ["", "待审核", "已加微信", "办卡中", "开户成功", "无效"];
const REF_ADMIN_STATUS_OPTS = ["待审核", "已加微信", "办卡中", "开户成功", "无效"];
const refAdminState = { status: "", keyword: "", rows: [], bound: false };

function refEsc(s) {
  return String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
}
function refFmtDate(d) {
  if (!d) return "";
  const x = new Date(d);
  if (isNaN(x.getTime())) return "";
  const p = (n) => (n < 10 ? "0" + n : "" + n);
  return `${x.getFullYear()}-${p(x.getMonth() + 1)}-${p(x.getDate())}`;
}

function renderRefAdminTabs() {
  const el = document.getElementById("adminRefTabs");
  if (!el) return;
  el.innerHTML = REF_ADMIN_TABS.map((s) => {
    const label = s === "" ? "全部" : s;
    return `<button class="admin-ref-tab${refAdminState.status === s ? " active" : ""}" data-ref-tab="${refEsc(s)}" type="button">${refEsc(label)}</button>`;
  }).join("");
}

function refStatusOptions(cur) {
  return REF_ADMIN_STATUS_OPTS.map((s) => `<option value="${refEsc(s)}"${s === cur ? " selected" : ""}>${refEsc(s)}</option>`).join("");
}

function renderRefAdminList() {
  const el = document.getElementById("adminRefList");
  if (!el) return;
  if (!refAdminState.rows.length) {
    el.innerHTML = '<p class="admin-ref-empty">暂无推荐记录</p>';
    return;
  }
  el.innerHTML = refAdminState.rows.map((r) => `
    <div class="admin-ref-card">
      <div class="admin-ref-card-top">
        <span class="admin-ref-friend">${refEsc(r.alias || r.realName || r.refereeNick || "客户")}</span>
        <span class="admin-ref-phone">${refEsc(r.realPhone || r.refereePhone || "")}</span>
        ${r.orderCount > 0 ? `<span class="admin-ref-ordered">已下单${r.orderCount}</span>` : `<span class="admin-ref-noorder">未下单</span>`}
        ${!r.refereeOpenid ? `<span class="admin-ref-pending" title="手动录入，还没关联到微信账号；TA 下单填这个手机号时会自动对账">⏳ 待对账</span>` : ""}
      </div>
      ${(r.realName && r.refereeNick && r.realName !== r.refereeNick) ? `<div class="admin-ref-card-sub">微信昵称：${refEsc(r.refereeNick)}</div>` : ""}
      <div class="admin-ref-card-mid">推荐人：<b>${refEsc(r.referrerCode || "-")}</b> ${refEsc(r.referrerNick || "")}</div>
      <div class="admin-ref-card-bot">
        <select class="admin-ref-status-sel" data-ref-id="${refEsc(r._id)}" data-ref-prev="${refEsc(r.status)}">${refStatusOptions(r.status)}</select>
        <span class="admin-ref-reward">${r.rewardPoints > 0 ? "+" + r.rewardPoints + "分" : ""}</span>
        <span class="admin-ref-date">${refEsc(refFmtDate(r.createdAt))}</span>
        <button class="admin-ref-unbind" data-ref-unbind="${refEsc(r._id)}" data-ref-name="${refEsc(r.refereeNick || "该好友")}" type="button">解绑</button>
      </div>
    </div>`).join("");
}

async function loadReferralAdmin() {
  bindRefAdmin();
  renderRefAdminTabs();
  const listEl = document.getElementById("adminRefList");
  if (listEl) listEl.innerHTML = '<p class="admin-ref-empty">加载中…</p>';
  try {
    const rows = await callAdminOrders("referral-list", { status: refAdminState.status, keyword: refAdminState.keyword });
    refAdminState.rows = rows || [];
    renderRefAdminList();
  } catch (e) {
    if (listEl) listEl.innerHTML = `<p class="admin-ref-empty">加载失败：${refEsc(e.message)}</p>`;
  }
  loadRefAdminRanking();
  loadRefAdminTree();
}

async function loadRefAdminTree() {
  const el = document.getElementById("adminRefTree");
  if (!el) return;
  el.innerHTML = '<p class="admin-ref-empty">加载中…</p>';
  try {
    const res = await callAdminOrders("referral-tree", {});
    const nodes = (res && res.nodes) || [];
    if (!nodes.length) { el.innerHTML = '<p class="admin-ref-empty">暂无关系（还没有人通过邀请进来）</p>'; return; }
    const map = {}, roots = [];
    nodes.forEach((n) => { n.children = []; map[n.id] = n; });
    nodes.forEach((n) => { (n.parent && map[n.parent]) ? map[n.parent].children.push(n) : roots.push(n); });
    const renderNode = (n, depth) => {
      const ok = n.status === "开户成功"
        ? '<span class="admin-tree-ok">已开卡</span>'
        : (n.status ? `<span class="admin-tree-st">${refEsc(n.status)}</span>` : "");
      const sub = n.children.length ? `<span class="admin-tree-cnt">下${n.children.length}</span>` : "";
      const ph = n.phone ? `<span class="admin-tree-phone">${refEsc(n.phone)}</span>` : "";
      const dispName = n.alias || n.realName || n.nick;
      const nm = refEsc(dispName);
      const aliasBtn = `<button class="admin-tree-alias" type="button" data-tree-alias="${refEsc(n.id)}" data-tree-cur="${refEsc(n.alias || "")}">✎</button>`;
      const unbind = n.parent ? `<button class="admin-tree-unbind" type="button" data-tree-unbind="${refEsc(n.id)}" data-tree-name="${refEsc(dispName)}">解绑</button>` : "";
      let html = `<div class="admin-tree-node" style="margin-left:${depth * 16}px"><span class="admin-tree-dot"></span><span class="admin-tree-nick">${nm}</span>${aliasBtn}${ph}<span class="admin-tree-code">${refEsc(n.code)}</span>${ok}${sub}${unbind}</div>`;
      n.children.forEach((c) => { html += renderNode(c, depth + 1); });
      return html;
    };
    const head = `<p class="admin-ref-empty">共 ${nodes.length} 人在关系网中${res.truncated ? "（超1000仅显示部分）" : ""}</p>`;
    el.innerHTML = head + roots.map((r) => renderNode(r, 0)).join("");
  } catch (e) {
    el.innerHTML = '<p class="admin-ref-empty">关系树加载失败</p>';
  }
}

async function loadRefAdminRanking() {
  const el = document.getElementById("adminRefRanking");
  if (!el) return;
  try {
    const rows = await callAdminOrders("referral-ranking", {});
    if (!rows || !rows.length) { el.innerHTML = '<p class="admin-ref-empty">暂无数据</p>'; return; }
    el.innerHTML = rows.map((r, i) => `
      <div class="admin-ref-rank-row">
        <span class="admin-ref-rank-no">${i + 1}</span>
        <span class="admin-ref-rank-name">${refEsc(r.nick || "微信用户")} <em>${refEsc(r.code || "")}</em></span>
        <span class="admin-ref-rank-stat">有效 ${r.opened || 0} / 累计 ${r.total || 0} · ${r.rewardPoints || 0}分</span>
      </div>`).join("");
  } catch (e) {
    el.innerHTML = '<p class="admin-ref-empty">排行加载失败</p>';
  }
}

async function doRefAdminAdd() {
  const code = (document.getElementById("adminRefAddCode").value || "").trim();
  const phone = (document.getElementById("adminRefAddPhone").value || "").trim();
  const nick = (document.getElementById("adminRefAddNick").value || "").trim();
  const msg = document.getElementById("adminRefAddMsg");
  if (!/^\d{6}$/.test(code)) { msg.textContent = "推荐码需6位数字"; msg.className = "admin-ref-add-msg error"; return; }
  if (!/^1\d{10}$/.test(phone)) { msg.textContent = "手机号格式不正确"; msg.className = "admin-ref-add-msg error"; return; }
  msg.textContent = "提交中…"; msg.className = "admin-ref-add-msg";
  try {
    await callAdminOrders("referral-add", { referrerCode: code, phone, nick });
    msg.textContent = "已录入 ✓"; msg.className = "admin-ref-add-msg success";
    document.getElementById("adminRefAddPhone").value = "";
    document.getElementById("adminRefAddNick").value = "";
    loadReferralAdmin();
  } catch (e) {
    msg.textContent = e.message; msg.className = "admin-ref-add-msg error";
  }
}

async function changeRefAdminStatus(sel) {
  const id = sel.getAttribute("data-ref-id");
  const prev = sel.getAttribute("data-ref-prev");
  const next = sel.value;
  if (next === prev) return;
  const payload = { id, status: next };
  if (next === "开户成功") {
    const input = window.prompt("发放奖励积分给推荐人：", "1");
    if (input === null) { sel.value = prev; return; }
    const pts = parseInt(input, 10);
    if (isNaN(pts) || pts < 0) { window.alert("积分不合法"); sel.value = prev; return; }
    payload.rewardPoints = pts;
  } else if (prev === "开户成功") {
    if (!window.confirm("从「开户成功」改为「" + next + "」会回收已发奖励积分，确定？")) { sel.value = prev; return; }
  }
  try {
    await callAdminOrders("referral-set-status", payload);
    loadReferralAdmin();
  } catch (e) {
    window.alert(e.message); sel.value = prev;
  }
}

async function doRefAdminUnbind(id, name) {
  if (!id) return;
  if (!window.confirm("解绑「" + (name || "该好友") + "」？\n会移除这条推荐关系、清空其下线归属，已发奖励积分一并回收。不可恢复。")) return;
  try {
    await callAdminOrders("referral-unbind", { id });
    adminToast("已解绑");
    loadReferralAdmin();
  } catch (e) {
    window.alert(e.message);
  }
}

async function doRefAdminUnbindOpenid(openid, name) {
  if (!openid) return;
  if (!window.confirm("解绑「" + (name || "该用户") + "」？\n会断开他与上线的关系、删相关推荐记录、回收已发积分。他自己的下线(若有)会各自独立。不可恢复。")) return;
  try {
    await callAdminOrders("referral-unbind", { openid });
    adminToast("已解绑");
    loadReferralAdmin();
  } catch (e) {
    window.alert(e.message);
  }
}

async function doRefAdminSetAlias(openid, cur) {
  if (!openid) return;
  const v = window.prompt("给这个人设个备注名（方便认人，留空可清除）：", cur || "");
  if (v === null) return;
  try {
    await callAdminOrders("referral-set-alias", { openid, alias: v.trim() });
    adminToast("已保存备注");
    loadReferralAdmin();
  } catch (e) {
    window.alert(e.message);
  }
}

function bindRefAdmin() {
  if (refAdminState.bound) return;
  refAdminState.bound = true;
  const tabs = document.getElementById("adminRefTabs");
  if (tabs) tabs.addEventListener("click", (e) => {
    const b = e.target.closest("[data-ref-tab]");
    if (!b) return;
    refAdminState.status = b.getAttribute("data-ref-tab");
    renderRefAdminTabs();
    loadReferralAdmin();
  });
  const list = document.getElementById("adminRefList");
  if (list) list.addEventListener("change", (e) => {
    const sel = e.target.closest(".admin-ref-status-sel");
    if (sel) changeRefAdminStatus(sel);
  });
  if (list) list.addEventListener("click", (e) => {
    const ub = e.target.closest("[data-ref-unbind]");
    if (ub) doRefAdminUnbind(ub.getAttribute("data-ref-unbind"), ub.getAttribute("data-ref-name"));
  });
  const tree = document.getElementById("adminRefTree");
  if (tree) tree.addEventListener("click", (e) => {
    const al = e.target.closest("[data-tree-alias]");
    if (al) { doRefAdminSetAlias(al.getAttribute("data-tree-alias"), al.getAttribute("data-tree-cur")); return; }
    const ub = e.target.closest("[data-tree-unbind]");
    if (ub) doRefAdminUnbindOpenid(ub.getAttribute("data-tree-unbind"), ub.getAttribute("data-tree-name"));
  });
  const addBtn = document.getElementById("adminRefAddBtn");
  if (addBtn) addBtn.addEventListener("click", doRefAdminAdd);
  const refreshBtn = document.getElementById("adminRefRefreshBtn");
  if (refreshBtn) refreshBtn.addEventListener("click", loadReferralAdmin);
  const searchBtn = document.getElementById("adminRefSearchBtn");
  if (searchBtn) searchBtn.addEventListener("click", () => {
    refAdminState.keyword = (document.getElementById("adminRefSearch").value || "").trim();
    loadReferralAdmin();
  });
  const searchInp = document.getElementById("adminRefSearch");
  if (searchInp) searchInp.addEventListener("keydown", (e) => {
    if (e.key === "Enter") { refAdminState.keyword = (searchInp.value || "").trim(); loadReferralAdmin(); }
  });
}

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
    const data = await callAdminOrders("banks-list", {});
    state.banks = (data && Array.isArray(data.banks)) ? data.banks : [];
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
    await callAdminOrders("banks-save-points", { id, points: value });

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
  pending: "待发货",
  shipped: "运输中",
  signed: "已签收",
  cancelled: "已取消"
};
// 旧码归一：processing/preparing→pending、done→shipped、closed→signed
const ORDER_STATUS_LEGACY = { processing: "pending", preparing: "pending", done: "shipped", closed: "signed" };
function normOrderStatus(s) { return ORDER_STATUS_LEGACY[s] || s || "pending"; }
// 状态文案（历史码/未知归一后兜底「待发货」）
function orderStatusText(s) { return ORDER_STATUS_LABEL[normOrderStatus(s)] || "待发货"; }

function setOrdersMessage(text, tone = "idle") {
  if (!adminOrdersMessage) return;
  adminOrdersMessage.textContent = text;
  adminOrdersMessage.dataset.tone = tone;
}

// 居中浮层提示，自动消失。用于关键操作（存单号 / 改状态 / 批量）的醒目反馈，
// 替代「只有底部小字、容易没看见」的体验。
let _adminToastTimer = null;
function adminToast(text, tone = "success") {
  let el = document.getElementById("adminToast");
  if (!el) {
    el = document.createElement("div");
    el.id = "adminToast";
    el.className = "admin-toast";
    document.body.appendChild(el);
  }
  el.textContent = text;
  el.dataset.tone = tone;
  // 强制重绘以便重复触发动画
  void el.offsetWidth;
  el.classList.add("show");
  clearTimeout(_adminToastTimer);
  _adminToastTimer = setTimeout(() => el.classList.remove("show"), 2200);
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
  ["pending", "shipped", "signed", "cancelled", "all"].forEach((st) => {
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
    // 进入「运输中」视图时自动刷一次本页物流（同一单号计费周期内不重复扣）。
    // 用 key 防重复触发：同一状态/页/搜索只自动刷一次，避免分页/签收回写造成的循环。
    if (state.ordersStatus === "shipped") {
      const autoKey = `shipped:${state.ordersPage}:${state.ordersSearch || ""}`;
      if (state._autoLogiKey !== autoKey) {
        state._autoLogiKey = autoKey;
        batchQueryShippedLogistics(true);
      }
    }
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
  // 「只看物流异常」：纯前端过滤本页，不重新请求
  const rows = state.ordersOnlyFail
    ? (state.orders || []).filter((o) => o && o.logiFailKind)
    : (state.orders || []);
  if (adminOrdersCount) {
    adminOrdersCount.textContent = state.ordersOnlyFail
      ? `物流异常 ${rows.length} 单（本页）`
      : `当前筛选 ${state.ordersTotal} 单`;
  }
  if (rows.length === 0) {
    adminOrdersList.innerHTML = `<p class="admin-status-text">${state.ordersOnlyFail ? "本页没有物流异常的订单。" : "没有符合条件的订单。"}</p>`;
    return;
  }

  const cardsHtml = rows.map((o) => {
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
          `<option value="${s}"${s === normOrderStatus(o.status) ? " selected" : ""}>${escapeHtml(ORDER_STATUS_LABEL[s])}</option>`
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
            <span class="admin-order-status admin-order-status-${escapeHtml(normOrderStatus(o.status))}">${escapeHtml(orderStatusText(o.status))}</span>${logiFailBadge(o)}
            <span class="admin-order-date">${escapeHtml(formatOrderDate(o.createdAt))}</span>
          </div>
        </div>
        ${isOpen ? `
          <div class="admin-order-body">
            <div class="admin-order-section">
              <strong>收货信息</strong>
              <p>${escapeHtml(addr.recipient || "")}　${escapeHtml(addr.phone || "")}</p>
              <p>${escapeHtml(addr.province || "")} ${escapeHtml(addr.city || "")} ${escapeHtml(addr.district || "")} ${escapeHtml(addr.detail || "")}</p>
              ${o.referredBy ? `<p class="admin-order-referby">🤝 推荐人：<b>${escapeHtml(o.referredBy.code || "")}</b> ${escapeHtml(o.referredBy.nick || "")}</p>` : ""}
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
                <input class="admin-tracking-phone" type="text" placeholder="顺丰必填：收件人或寄件人手机号" value="${escapeHtml(o.trackingPhone || (o.address && o.address.phone) || "")}" data-tracking-phone="${escapeHtml(o._id)}">
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
            ${o.trackingNo ? `
            <div class="admin-order-section">
              <div class="admin-tl-head">
                <strong>物流轨迹${o.signedAt ? " · 已签收" : ""}</strong>
                <button class="admin-secondary-btn admin-tl-refresh" data-query-logistics="${escapeHtml(o._id)}" type="button">刷新物流</button>
              </div>
              ${(Array.isArray(o.logisticsNodes) && o.logisticsNodes.length) ? `
              <div class="admin-timeline">
                ${o.logisticsNodes.map((n, i) => `
                  <div class="admin-tl-node${i === 0 ? " latest" : ""}">
                    <span class="admin-tl-dot"></span>
                    <div class="admin-tl-body">
                      <p class="admin-tl-ctx">${escapeHtml(n.context || "")}</p>
                      <p class="admin-tl-time">${escapeHtml(n.time || "")}</p>
                    </div>
                  </div>`).join("")}
              </div>` : `<p class="admin-order-danger-hint">暂无物流节点。点「刷新物流」立即查询；新发货的单也会自动更新。</p>`}
              ${(/顺丰/.test(o.trackingCompany || "") || o.courierCode === "shunfeng") ? `<p class="admin-sf-tip">⚠️ 顺丰提示：拼多多/代发单的收件手机是隐私号，刷新会报「验证码错误」、查不到。这种情况把单号复制发给客户，让客户自己在顺丰里查即可（客户查不用验手机）。</p>` : ""}
            </div>` : ""}
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
    adminToast(`✅ 批量更新成功 ${res.updated} 单`, "success");
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
    adminToast(`🗑️ 已删除 ${res.deleted} 单`, "success");
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
    adminToast("✅ 状态已更新为「" + (ORDER_STATUS_LABEL[normOrderStatus(status)] || status) + "」", "success");
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

// 刷新物流：实时查询当前完整轨迹（老单/手动刷新用）
async function handleQueryLogistics(orderId) {
  if (!orderId) return;
  setOrdersMessage("正在查询物流…");
  const btn = adminOrdersList.querySelector(`[data-query-logistics="${orderId}"]`);
  if (btn) { btn.disabled = true; btn.textContent = "查询中…"; }
  const phoneInput = adminOrdersList.querySelector(`[data-tracking-phone="${orderId}"]`);
  const phone = phoneInput ? phoneInput.value.trim() : "";
  const companyInput = adminOrdersList.querySelector(`[data-tracking-company="${orderId}"]`);
  const trackingCompany = companyInput ? companyInput.value.trim() : "";
  try {
    const updated = await callAdminOrders("query-logistics", { orderId, phone, courierCode: carrierCodeOf(trackingCompany), trackingCompany });
    const idx = state.orders.findIndex((o) => o._id === orderId);
    let becameSigned = false;
    if (idx >= 0 && updated) {
      becameSigned = updated.status === "signed" && state.orders[idx].status !== "signed";
      state.orders[idx].logisticsNodes = updated.logisticsNodes || [];
      state.orders[idx].logisticsState = updated.logisticsState || "";
      state.orders[idx].status = updated.status || state.orders[idx].status;
      state.orders[idx].signedAt = updated.signedAt || state.orders[idx].signedAt;
    }
    setOrdersMessage("物流已更新。", "success");
    adminToast("✅ 物流已刷新", "success");
    // 签收后从「运输中」分段移走
    if (becameSigned && state.ordersStatus === "shipped") loadOrders();
    else renderOrdersList();
  } catch (err) {
    if (btn) { btn.disabled = false; btn.textContent = "刷新物流"; }
    setOrdersMessage(err.message, "error");
    adminToast((err.message || "查询失败"), "error");
  }
}

// 一键刷新本页所有「运输中」订单的物流（老单批量补轨迹）。顺序执行，避免高频打快递100。
// 物流异常标记：与状态标签同一行
function logiFailBadge(o) {
  if (!o || !o.logiFailKind) return "";
  const isNeedInfo = o.logiFailKind === "need_info";
  const text = isNeedInfo ? "待补信息" : "查不到";
  const cls = isNeedInfo ? "admin-logi-tag admin-logi-tag-info" : "admin-logi-tag admin-logi-tag-warn";
  const tip = `${isNeedInfo ? "待补信息" : "查不到轨迹"}：${o.logiFailHint || o.logiFailMsg || ""}`;
  return `<span class="${cls}" title="${escapeHtml(tip)}">${text}</span>`;
}

async function batchQueryShippedLogistics(auto) {
  const all = (state.orders || []).filter((o) => normOrderStatus(o.status) === "shipped" && o.trackingNo);
  // 自动刷新跳过已标记「注定失败」的单；手动点按钮 = 明确要求重试，全部刷。
  const targets = auto ? all.filter((o) => !o.logiFailKind) : all;
  const skipped = all.length - targets.length;
  if (!targets.length) {
    if (!auto) adminToast("本页没有可刷新的运输中订单", "error");
    else if (skipped) setOrdersMessage(`已跳过 ${skipped} 单物流异常（点「刷新本页物流」可强制重试）`);
    return;
  }
  const btn = adminOrdersBulkLogisticsButton;
  if (btn) btn.disabled = true;
  let ok = 0, fail = 0, signedCount = 0;
  for (let i = 0; i < targets.length; i += 1) {
    if (btn) btn.textContent = `刷新中 ${i + 1}/${targets.length}`;
    setOrdersMessage(`刷新物流 ${i + 1}/${targets.length}…`);
    try {
      const updated = await callAdminOrders("query-logistics", { orderId: targets[i]._id });
      const idx = state.orders.findIndex((o) => o._id === targets[i]._id);
      if (idx >= 0 && updated) {
        if (updated.status === "signed" && state.orders[idx].status !== "signed") signedCount += 1;
        state.orders[idx].logisticsNodes = updated.logisticsNodes || [];
        state.orders[idx].logisticsState = updated.logisticsState || "";
        state.orders[idx].status = updated.status || state.orders[idx].status;
        state.orders[idx].signedAt = updated.signedAt || state.orders[idx].signedAt;
        // 查成功 → 云端已清标记，本地同步清掉
        state.orders[idx].logiFailKind = "";
        state.orders[idx].logiFailMsg = "";
        state.orders[idx].logiFailHint = "";
      }
      ok += 1;
    } catch (err) {
      fail += 1;
      // 云函数已按错误分类写库；本地同步一份，立刻能看到标签
      const msg = (err && err.message) || "";
      const kind = /未识别快递公司|必须填手机号|还没有快递单号/.test(msg) ? "need_info"
        : (/暂无轨迹|查询请求失败|timeout/i.test(msg) ? "" : "not_found");
      const idx = state.orders.findIndex((o) => o._id === targets[i]._id);
      if (kind && idx >= 0) {
        state.orders[idx].logiFailKind = kind;
        state.orders[idx].logiFailMsg = msg;
        state.orders[idx].logiFailHint = kind === "need_info"
          ? msg.replace(/^[^：]*：/, "")
          : (state.orders[idx].courierCode === "shunfeng" || /验证码错误/.test(msg)
              ? "顺丰代发多为隐私号，快递100 无法校验手机 → 查不到轨迹。请把单号发客户自查。"
              : "快递100 查不到该单号轨迹，请核对单号。");
      }
    }
  }
  if (btn) { btn.disabled = false; btn.textContent = "刷新本页物流"; }
  const extra = (fail ? `，失败 ${fail} 单` : "") + (skipped ? `，跳过 ${skipped} 单已知异常` : "");
  setOrdersMessage(`刷新完成：成功 ${ok} 单${extra}`, "success");
  adminToast(`✅ 物流刷新完成 ${ok} 单${fail ? `（${fail} 失败）` : ""}`, fail ? "error" : "success");
  if (signedCount > 0 && state.ordersStatus === "shipped") loadOrders();
  else renderOrdersList();
}

async function handleTrackingSave(orderId) {
  if (!orderId) return;
  const noInput = adminOrdersList.querySelector(`[data-tracking-no="${orderId}"]`);
  const companyInput = adminOrdersList.querySelector(`[data-tracking-company="${orderId}"]`);
  const trackingNo = noInput ? noInput.value.trim() : "";
  const trackingCompany = companyInput ? companyInput.value.trim() : "";
  if (!trackingNo) {
    setOrdersMessage("请填写快递单号。", "error");
    adminToast("请先填写快递单号", "error");
    return;
  }
  const phoneInput = adminOrdersList.querySelector(`[data-tracking-phone="${orderId}"]`);
  const phone = phoneInput ? phoneInput.value.trim() : "";
  const courierCode = carrierCodeOf(trackingCompany);
  setOrdersMessage(courierCode ? "正在保存单号…" : "正在保存单号（未识别快递公司，将不自动追踪物流）…");
  try {
    await callAdminOrders("update-tracking", { orderId, trackingNo, trackingCompany, courierCode, phone });
    // 就地写回；填单号 = 发货 → 云端已自动置「运输中」，前端同步状态并重渲染徽标
    const idx = state.orders.findIndex((o) => o._id === orderId);
    if (idx >= 0) {
      state.orders[idx].trackingNo = trackingNo;
      state.orders[idx].trackingCompany = trackingCompany;
      state.orders[idx].trackingPhone = phone;
      if (state.orders[idx].status !== "cancelled") state.orders[idx].status = "shipped";
    }
    renderOrdersList();
    setOrdersMessage("单号已保存，已自动标记「运输中」并推送用户。", "success");
    adminToast("✅ 单号已保存，已发货并推送用户", "success");
  } catch (err) {
    setOrdersMessage(err.message, "error");
    adminToast("保存失败：" + (err.message || ""), "error");
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
    adminToast("✅ 备注已保存", "success");
  } catch (err) {
    setOrdersMessage(err.message, "error");
    adminToast("保存失败：" + (err.message || ""), "error");
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
adminOrdersBulkLogisticsButton?.addEventListener("click", () => batchQueryShippedLogistics());
adminOrdersOnlyFail?.addEventListener("change", () => {
  state.ordersOnlyFail = !!adminOrdersOnlyFail.checked;
  renderOrdersList();
});

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
  const queryLog = event.target.closest("[data-query-logistics]");
  if (queryLog) {
    event.stopPropagation();
    handleQueryLogistics(queryLog.dataset.queryLogistics);
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

// 公司展示名 → 快递100 标准编码（保存时据此推导 courierCode，供物流订阅）。与 detectCarrier 返回名一致。
const CARRIER_CODE = {
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
          <div class="admin-stats-status-row"><span class="admin-order-status admin-order-status-pending">待发货</span><span>${escapeHtml(byStatus.pending || 0)}</span></div>
          <div class="admin-stats-status-row"><span class="admin-order-status admin-order-status-shipped">运输中</span><span>${escapeHtml(byStatus.shipped || 0)}</span></div>
          <div class="admin-stats-status-row"><span class="admin-order-status admin-order-status-signed">已签收</span><span>${escapeHtml(byStatus.signed || 0)}</span></div>
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
    // 只写云开发；H5 现在也经 web-api 读同一份，不再需要 Supabase 双写
    await callAdminOrders("save-home-banners", { banners });
    setHaibaoMessage("已保存，小程序下拉刷新 / H5 刷新生效。", "success");
  } catch (err) {
    setHaibaoMessage(err.message, "error");
  }
});

adminTabHaibao?.addEventListener("click", () => {
  state.activePanel = "haibao";
  updatePanelUi();
  loadHaibao();
});

// ===== 积分档银行（cards_bank_labels；云开发 app_config + Supabase app_config 双写） =====
const CARDBANK_BUCKETS_M = [
  { key: "5", label: "5分" },
  { key: "6", label: "6分" },
  { key: "7", label: "7分" },
  { key: "8", label: "8分" },
  { key: "9-10", label: "9-10分" }
];
const CARDBANK_DEFAULT_M = { "5": "", "6": "交通银行", "7": "浦发银行", "8": "平安/中信银行", "9-10": "" };

function setCardBankMessage(text, tone) {
  if (!adminCardBankMessage) return;
  adminCardBankMessage.textContent = text || "";
  if (tone) adminCardBankMessage.dataset.tone = tone; else delete adminCardBankMessage.dataset.tone;
}

function renderCardBankM(labels) {
  if (!adminCardBankList) return;
  adminCardBankList.innerHTML = CARDBANK_BUCKETS_M.map((b) => {
    const v = (labels && labels[b.key] != null) ? labels[b.key] : "";
    return '<div class="admin-cardbank-row">'
      + '<span class="admin-cardbank-points">' + escapeHtml(b.label) + "</span>"
      + '<input class="admin-cardbank-input" type="text" maxlength="30" placeholder="银行名（留空则不显示）" value="' + escapeHtml(v) + '" data-cardbank-key="' + escapeHtml(b.key) + '">'
      + "</div>";
  }).join("");
}

async function loadCardBank() {
  if (!adminCardBankList) return;
  if (!activeSession()) { adminCardBankList.innerHTML = '<p class="admin-status-text">请先登录管理员账号。</p>'; return; }
  adminCardBankList.innerHTML = '<p class="admin-status-text">加载中…</p>';
  setCardBankMessage("");
  try {
    const data = await callAdminOrders("get-cards-bank-labels", {});
    const labels = (data && data.labels && typeof data.labels === "object") ? data.labels : CARDBANK_DEFAULT_M;
    renderCardBankM(labels);
  } catch (err) {
    adminCardBankList.innerHTML = '<p class="admin-status-text">加载失败：' + escapeHtml(err.message || "") + "</p>";
  }
}

adminCardBankSave?.addEventListener("click", async () => {
  if (!activeSession()) { setCardBankMessage("请先登录管理员账号。", "error"); return; }
  const inputs = adminCardBankList ? adminCardBankList.querySelectorAll("[data-cardbank-key]") : [];
  const labels = {};
  inputs.forEach((inp) => { labels[inp.getAttribute("data-cardbank-key")] = (inp.value || "").trim().slice(0, 30); });
  setCardBankMessage("保存中…");
  try {
    // 只写云开发；H5 现在也经 web-api 读同一份，不再需要 Supabase 双写
    await callAdminOrders("save-cards-bank-labels", { labels });
    setCardBankMessage("已保存，小程序下拉刷新 / H5 刷新生效。", "success");
  } catch (err) {
    setCardBankMessage(err.message, "error");
  }
});

adminTabCardBank?.addEventListener("click", () => {
  state.activePanel = "cardbank";
  updatePanelUi();
  loadCardBank();
});

// ===== 邀请分享卡片（referral_share；云开发 app_config + Supabase app_config 双写） =====
const REFSHARE_DEFAULT_TITLE = "加加好物图集 · 办指定银行免费领正品好礼";
const refShareState = { imageUrl: "", title: "", uploading: false };

function setRefShareMessage(text, tone) {
  if (!adminRefShareMessage) return;
  adminRefShareMessage.textContent = text || "";
  if (tone) adminRefShareMessage.dataset.tone = tone; else delete adminRefShareMessage.dataset.tone;
}

function renderRefShareThumb() {
  if (!adminRefShareThumb || !adminRefShareThumbEmpty) return;
  if (refShareState.imageUrl) {
    adminRefShareThumb.src = refShareState.imageUrl;
    adminRefShareThumb.hidden = false;
    adminRefShareThumbEmpty.hidden = true;
  } else {
    adminRefShareThumb.hidden = true;
    adminRefShareThumbEmpty.hidden = false;
    adminRefShareThumbEmpty.textContent = refShareState.uploading ? "上传中…" : "未设置";
  }
}

async function loadRefShare() {
  if (!adminRefSharePanel) return;
  if (!activeSession()) { setRefShareMessage("请先登录管理员账号。", "error"); return; }
  setRefShareMessage("加载中…");
  try {
    const data = await callAdminOrders("get-referral-share", {});
    refShareState.imageUrl = (data && data.imageUrl) || "";
    refShareState.title = (data && data.title) || "";
    if (adminRefShareTitle) adminRefShareTitle.value = refShareState.title || "";
    renderRefShareThumb();
    setRefShareMessage("");
  } catch (err) {
    setRefShareMessage("加载失败：" + (err.message || ""), "error");
  }
}

adminRefShareFile?.addEventListener("change", async (event) => {
  const f = event.target.files && event.target.files[0];
  if (!f) return;
  refShareState.uploading = true;
  renderRefShareThumb();
  setRefShareMessage("正在上传图片…");
  try {
    const url = await uploadFile(f);
    refShareState.imageUrl = url;
    refShareState.uploading = false;
    renderRefShareThumb();
    setRefShareMessage("图片已上传，别忘了点「保存」。", "success");
  } catch (err) {
    refShareState.uploading = false;
    renderRefShareThumb();
    setRefShareMessage("图片上传失败：" + (err.message || ""), "error");
  } finally {
    event.target.value = "";
  }
});

adminRefShareSave?.addEventListener("click", async () => {
  if (!activeSession()) { setRefShareMessage("请先登录管理员账号。", "error"); return; }
  if (refShareState.uploading) { setRefShareMessage("图片还在上传，请稍候。", "error"); return; }
  const title = (adminRefShareTitle ? adminRefShareTitle.value : "").trim().slice(0, 40) || REFSHARE_DEFAULT_TITLE;
  const payload = { imageUrl: refShareState.imageUrl || "", title };
  setRefShareMessage("保存中…");
  try {
    const saved = await callAdminOrders("save-referral-share", payload);
    refShareState.title = (saved && saved.title) || title;
    refShareState.imageUrl = (saved && saved.imageUrl) || payload.imageUrl;
    if (adminRefShareTitle) adminRefShareTitle.value = refShareState.title;
    renderRefShareThumb();
    // 只写云开发；不再 Supabase 双写
    setRefShareMessage("已保存，小程序下拉刷新 / 重进邀请页生效。", "success");
  } catch (err) {
    setRefShareMessage(err.message, "error");
  }
});

adminTabRefShare?.addEventListener("click", () => {
  state.activePanel = "refshare";
  updatePanelUi();
  loadRefShare();
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
