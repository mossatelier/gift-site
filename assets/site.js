const config = window.APP_CONFIG || {};
const categories = Array.isArray(config.categories) ? config.categories : [];
const categoryLabelMap = new Map(categories.map((item) => [item.value, item.label]));
const nonAllCategories = categories.filter((item) => item.value !== "all");

const track = document.getElementById("bannerTrack");
let slides = Array.from(document.querySelectorAll(".banner-slide"));
let dots = Array.from(document.querySelectorAll(".dot"));
const bannerDots = document.querySelector(".banner-dots");
const mallNavItems = Array.from(document.querySelectorAll("[data-category-link]"));
const sortButtons = Array.from(document.querySelectorAll("[data-sort]"));
const categoryFilter = document.getElementById("categoryFilter");
const productGrid = document.getElementById("productGrid");
const productHotGrid = document.getElementById("productHotGrid");
const productNewGrid = document.getElementById("productNewGrid");
const productResultCount = document.getElementById("productResultCount");
const productSortState = document.getElementById("productSortState");
const productEmpty = document.getElementById("productEmpty");
const productSearchInput = document.getElementById("productSearchInput");
const productSearchButton = document.getElementById("productSearchButton");
const chipRow = document.getElementById("chipRow");
const catRail = document.getElementById("catRail");
const catContentGrid = document.getElementById("catContentGrid");
const catContentTitle = document.getElementById("catContentTitle");
const wishlistGrid = document.getElementById("wishlistGrid");
const wishlistEmpty = document.getElementById("wishlistEmpty");
const wishlistGridWrap = document.getElementById("wishlistGridWrap");
const webOrderForm = document.getElementById("webOrderForm");
const webOrderMsg = document.getElementById("webOrderMsg");
const productDetailEl = document.getElementById("productDetail");
const imageViewer = document.getElementById("imageViewer");
const imageViewerImg = imageViewer ? imageViewer.querySelector(".image-viewer-img") : null;
const earnBankList = document.getElementById("earnBankList");

const WISHLIST_KEY = "gift-site-wishlist";

function getWishlist() {
  try {
    const raw = localStorage.getItem(WISHLIST_KEY);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list.map(String) : [];
  } catch {
    return [];
  }
}

function saveWishlist(ids) {
  const unique = Array.from(new Set(ids.map(String)));
  localStorage.setItem(WISHLIST_KEY, JSON.stringify(unique));
}

function isWishlisted(id) {
  return getWishlist().includes(String(id));
}

function toggleWishlist(id) {
  const list = getWishlist();
  const sid = String(id);
  const idx = list.indexOf(sid);

  if (idx >= 0) {
    list.splice(idx, 1);
  } else {
    list.push(sid);
  }

  saveWishlist(list);
}

const urlParams = (() => {
  try {
    return new URLSearchParams(window.location.search);
  } catch {
    return new URLSearchParams("");
  }
})();

function initialCategory() {
  const fromUrl = urlParams.get("category");
  if (fromUrl && (categoryLabelMap.has(fromUrl) || fromUrl === "mombaby")) {
    return fromUrl;
  }
  return "all";
}

function initialSort() {
  const fromUrl = urlParams.get("sort");
  if (fromUrl === "price" || fromUrl === "newest" || fromUrl === "default") {
    return fromUrl;
  }
  return "default";
}

const state = {
  products: [],
  currentSlide: 0,
  timerId: null,
  sort: initialSort(),
  priceDirection: "asc",
  category: initialCategory(),
  sub: "",
  showMore: false,
  query: urlParams.get("q") || "",
  cards: urlParams.get("cards") || ""
};

// 推荐归属：?ref=6位推荐码 落地即记到本机，下单时带给后台自动建推荐记录
const REF_KEY = "gift-site-ref";
(function captureRef() {
  try {
    const r = urlParams.get("ref");
    if (r && /^\d{6}$/.test(r)) localStorage.setItem(REF_KEY, r);
  } catch (e) { /* ignore */ }
})();
function getRefCode() {
  try { return localStorage.getItem(REF_KEY) || ""; } catch (e) { return ""; }
}

function isSupabaseConfigured() {
  return Boolean(config.supabaseUrl && config.supabaseAnonKey && config.productsTable);
}

function categoryLabel(categoryValue) {
  return categoryLabelMap.get(categoryValue) || "其他分类";
}

// 推荐有礼(referral)按推荐人数显示、不显积分；其余显兑换积分。与小程序口径一致，避免把"推荐2人"误显成"兑换积分2分"。
function buildPointsText(item) {
  if (item.category === "referral") {
    if (item.subcategory) {
      const m = String(item.subcategory).match(/推荐\s*(\d+)\s*人/);
      if (m) return `推荐 ${m[1]} 人可领`;
    }
    return "推荐办理可领";
  }
  return item.cardsNeeded > 0 ? `兑换积分：${item.cardsNeeded} 分` : "";
}

// ====== 分类：大类 + 更多 + 二级（与小程序 list 页口径一致） ======
const subcategories = (config.subcategories && typeof config.subcategories === "object") ? config.subcategories : {};
// 「母婴好物」虚拟大类 = 这一组细分类
const MOMBABY_GROUP = ["stroller", "playpen", "carseat", "carrier", "earlyedu", "toy", "chairtable", "ride"];
// 全部商品页顶部平铺的大类（全部礼品/邀请有礼 移到下方快捷行；电子/家电从「更多」提上来平铺）
const DISPLAY_CATS = [
  { value: "mombaby", label: "母婴好物" },
  { value: "pet", label: "宠物用品" },
  { value: "camping", label: "户外露营" },
  { value: "digital", label: "电子产品" },
  { value: "appliance", label: "家用电器" }
];
// 「更多」下拉已清空（保留结构，以后有新大类再放回来）
const MORE_CATS = [];
// 某展示分类的二级 [{value,label}]：mombaby→8 细类；referral/toy/ride→subcategories
function subItemsOf(display) {
  if (display === "mombaby") return MOMBABY_GROUP.map((v) => ({ value: v, label: categoryLabel(v) }));
  const subs = subcategories[display] || [];
  return subs.map((s) => ({ value: s, label: s }));
}
// 把（可能是细类的）category 解析成 {display, sub}
function resolveDisplay(cat) {
  if (!cat || cat === "all") return { display: "all", sub: "" };
  if (MOMBABY_GROUP.indexOf(cat) >= 0) return { display: "mombaby", sub: cat };
  return { display: cat, sub: "" };
}
function displayCatLabel(value) {
  const f = DISPLAY_CATS.concat(MORE_CATS).find((c) => c.value === value);
  return f ? f.label : categoryLabel(value);
}
// 列表页分类匹配：all / mombaby(整组或单细类) / 普通分类(+二级)
// 积分区间分档；11+ 面板不显示(hidden)但保留匹配——首页「按积分快速兑换」的 11分以上 跳转仍生效
const CARDS_BUCKETS = [
  { key: "5", label: "5积分", min: 5, max: 5 },
  { key: "6", label: "6积分", min: 6, max: 6 },
  { key: "7", label: "7积分", min: 7, max: 7 },
  { key: "8", label: "8积分", min: 8, max: 8 },
  { key: "9-10", label: "9-10积分", min: 9, max: 10 },
  { key: "11+", label: "11分以上", min: 11, max: null, hidden: true }
];
function cardsBucket(key) {
  return CARDS_BUCKETS.find((b) => b.key === key) || null;
}
function cardsMatch(item) {
  const b = cardsBucket(state.cards);
  if (!b) return true;
  // 积分筛选只对「办卡可兑」生效：邀请可兑(referral)的数字是推荐人数不是积分，排除避免口径混淆
  if (item.category === "referral") return false;
  const n = Number(item.cardsNeeded) || 0;
  if (n < b.min) return false;
  if (b.max != null && n > b.max) return false;
  return true;
}
// 积分筛选下拉：点档位立即筛选并收起（免确认）
const cardsFilterToggle = document.getElementById("cardsFilterToggle");
const cardsFilterPanel = document.getElementById("cardsFilterPanel");
function renderCardsFilter() {
  const el = document.getElementById("cardsFilter");
  if (!el) return;
  el.innerHTML = CARDS_BUCKETS.filter((b) => !b.hidden).map((b) =>
    `<button class="cards-chip ${state.cards === b.key ? "active" : ""}" type="button" data-cards-filter="${escapeHtml(b.key)}">${b.label}</button>`
  ).join("");
}
function closeCardsFilterPanel() {
  if (cardsFilterPanel) cardsFilterPanel.hidden = true;
}
// 「积分筛选」按钮：生效时高亮且文字显示当前档位（如「6分 ▾」）；推荐有礼分类无积分概念 → 隐藏入口并收起面板
function updateCardsFilterUI() {
  renderCardsFilter();
  if (cardsFilterToggle) {
    const b = cardsBucket(state.cards);
    cardsFilterToggle.textContent = (b ? b.label : "积分筛选") + " ▾";
    cardsFilterToggle.classList.toggle("active", Boolean(state.cards));
    cardsFilterToggle.hidden = state.category === "referral";
  }
  if (state.category === "referral") closeCardsFilterPanel();
}

function categoryMatch(item) {
  const cat = state.category;
  if (cat === "all") return true;
  if (cat === "mombaby") {
    return state.sub ? item.category === state.sub : MOMBABY_GROUP.indexOf(item.category) >= 0;
  }
  if (item.category !== cat) return false;
  return state.sub ? item.subcategory === state.sub : true;
}

function parseDate(dateValue) {
  const timestamp = Date.parse(dateValue || "");
  return Number.isNaN(timestamp) ? 0 : timestamp;
}

function normalizeProduct(product, index) {
  const cardsNeeded = Number(product.cardsNeeded ?? product.cards_needed ?? 0);
  const rawImages = product.images;
  let images = [];

  if (Array.isArray(rawImages)) {
    images = rawImages.filter((u) => typeof u === "string" && u.trim());
  } else if (typeof rawImages === "string" && rawImages.trim()) {
    try {
      const parsed = JSON.parse(rawImages);
      if (Array.isArray(parsed)) images = parsed.filter((u) => typeof u === "string" && u.trim());
    } catch {
      // ignore
    }
  }

  const primaryImage = product.imageUrl || product.image_url || images[0] || "images/product-1.svg";
  if (images.length === 0 && primaryImage) {
    images = [primaryImage];
  }

  return {
    id: product.id || `product-${index + 1}`,
    title: product.title || "未命名礼品",
    category: product.category || "all",
    subcategory: product.subcategory || "",
    price: Number(product.price || 0),
    description: product.description || "",
    cardsNeeded,
    imageUrl: primaryImage,
    images,
    sortOrder: Number(product.sortOrder ?? product.sort_order ?? index + 1),
    isActive: product.isActive ?? product.is_active ?? true,
    createdAt: product.createdAt || product.created_at || "",
    viewCount: Number(product.viewCount ?? product.view_count ?? 0)
  };
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

// 转义后保留换行（商品描述多行排版用）
function escapeMultiline(value) {
  return escapeHtml(value).replace(/\r?\n/g, "<br>");
}

// 客服信息（后续可在 config.js 配置，缺省走默认；改号一处即可）
function kefuQrSrc() {
  return (typeof config !== "undefined" && config.kefuQr) || "images/wechat-qr.jpg";
}
function kefuWechatId() {
  return (typeof config !== "undefined" && config.kefuWechat) || "L1916959";
}

async function fetchProductsFromSupabase() {
  const params = new URLSearchParams({
    select: "id,title,category,subcategory,price,cards_needed,description,image_url,images,sort_order,is_active,created_at,view_count",
    is_active: "eq.true",
    order: "sort_order.asc.nullslast,created_at.desc"
  });

  const endpoint = `${config.supabaseUrl}/rest/v1/${config.productsTable}?${params.toString()}`;
  const response = await fetch(endpoint, {
    headers: {
      apikey: config.supabaseAnonKey,
      Authorization: `Bearer ${config.supabaseAnonKey}`
    }
  });

  if (!response.ok) {
    throw new Error(`读取商品失败：${response.status}`);
  }

  const data = await response.json();
  return Array.isArray(data) ? data.map(normalizeProduct) : [];
}

async function loadProducts() {
  if (!isSupabaseConfigured()) {
    state.products = (config.fallbackProducts || []).map(normalizeProduct).filter((item) => item.isActive);
    renderAll();
    return;
  }

  try {
    const products = await fetchProductsFromSupabase();
    state.products = products.filter((item) => item.isActive);
  } catch (error) {
    state.products = (config.fallbackProducts || []).map(normalizeProduct).filter((item) => item.isActive);
  }

  renderAll();
}

function goToSlide(index) {
  if (!track || slides.length === 0) {
    return;
  }

  state.currentSlide = (index + slides.length) % slides.length;
  track.style.transform = `translateX(-${state.currentSlide * 100}%)`;
  dots.forEach((dot, dotIndex) => {
    dot.classList.toggle("active", dotIndex === state.currentSlide);
  });
}

function startAutoplay() {
  stopAutoplay();

  if (slides.length === 0) {
    return;
  }

  state.timerId = window.setInterval(() => {
    goToSlide(state.currentSlide + 1);
  }, 3200);
}

function stopAutoplay() {
  if (state.timerId !== null) {
    window.clearInterval(state.timerId);
    state.timerId = null;
  }
}

function updateCategoryNav() {
  mallNavItems.forEach((item) => {
    item.classList.toggle("active", item.dataset.categoryLink === state.category);
  });
}

function updateSortButtons() {
  sortButtons.forEach((button) => {
    const isActive = button.dataset.sort === state.sort;
    button.classList.toggle("active", isActive);
    button.classList.remove("sort-asc", "sort-desc");

    if (button.dataset.sort === "price" && state.sort === "price") {
      button.classList.add(state.priceDirection === "asc" ? "sort-asc" : "sort-desc");
    }
  });
}

function filteredProducts(items = state.products) {
  const keyword = state.query.trim().toLowerCase();

  const filtered = items.filter((item) => {
    if (!categoryMatch(item)) {
      return false;
    }

    if (!cardsMatch(item)) {
      return false;
    }

    if (!keyword) {
      return true;
    }

    const haystack = `${item.title} ${item.description} ${item.subcategory} ${categoryLabel(item.category)}`.toLowerCase();
    return haystack.includes(keyword);
  });

  return filtered.sort((left, right) => {
    if (state.sort === "price") {
      return state.priceDirection === "asc" ? left.cardsNeeded - right.cardsNeeded : right.cardsNeeded - left.cardsNeeded;
    }

    if (state.sort === "newest") {
      return parseDate(right.createdAt) - parseDate(left.createdAt);
    }

    if (left.sortOrder !== right.sortOrder) {
      return left.sortOrder - right.sortOrder;
    }

    return parseDate(right.createdAt) - parseDate(left.createdAt);
  });
}

function productCard(item) {
  const priceText = item.price > 0
    ? `<p class="product-price"><span class="price-symbol">¥</span>${escapeHtml(item.price)}</p>`
    : "";
  const wishlisted = isWishlisted(item.id);
  const detailHref = `product.html?id=${encodeURIComponent(item.id)}`;
  const isReferral = item.category === "referral";
  const tagText = isReferral ? "推荐可兑" : "办卡可兑";
  const tagClass = isReferral ? "title-tag title-tag-referral" : "title-tag title-tag-card";
  const pointsText = buildPointsText(item);

  return `
    <article class="product-card">
      <a class="product-card-link" href="${escapeHtml(detailHref)}">
        <div class="product-media">
          <img class="product-image" src="${escapeHtml(item.imageUrl)}" alt="${escapeHtml(item.title)}" loading="lazy" decoding="async">
        </div>
        <div class="product-body">
          <h3 class="product-title"><span class="${tagClass}">${tagText}</span>${escapeHtml(item.title)}</h3>
          ${priceText}
          ${pointsText ? `<p class="product-cards">${escapeHtml(pointsText)}</p>` : ""}
        </div>
      </a>
      <button class="heart-btn ${wishlisted ? "active" : ""}" type="button" data-wishlist-toggle="${escapeHtml(item.id)}" aria-label="${wishlisted ? "从心愿单移除" : "加入心愿单"}">
        <svg viewBox="0 0 24 24">
          <path d="M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.5-7 10-7 10z" stroke-width="1.8" stroke-linejoin="round"/>
        </svg>
      </button>
    </article>
  `;
}

function renderProducts() {
  if (!productGrid) {
    return;
  }

  const products = filteredProducts();
  productGrid.innerHTML = products.map(productCard).join("");

  if (productResultCount) {
    productResultCount.textContent = `共 ${products.length} 件礼品`;
  }

  if (productEmpty) {
    productEmpty.hidden = products.length > 0;
  }

  updateCategoryNav();
  updateSortButtons();
  updateChipRow();
  updateCardsFilterUI();
}

function renderHomeSections() {
  if (productHotGrid) {
    const hot = state.products
      .slice()
      .sort((left, right) => {
        const diff = (right.viewCount || 0) - (left.viewCount || 0);
        if (diff !== 0) return diff;
        return left.sortOrder - right.sortOrder;
      })
      .slice(0, 10);
    productHotGrid.innerHTML = hot.map(productCard).join("")
      || "<p class=\"product-empty\">暂时没有热门兑换礼品。</p>";
  }

  if (productNewGrid) {
    const fresh = state.products
      .slice()
      .sort((left, right) => parseDate(right.createdAt) - parseDate(left.createdAt))
      .slice(0, 10);
    productNewGrid.innerHTML = fresh.map(productCard).join("")
      || "<p class=\"product-empty\">还没有新品上架。</p>";
  }
}

function categoryGridItem(item) {
  return `
    <a class="cat-grid-item" href="product.html?id=${encodeURIComponent(item.id)}">
      <img class="cat-grid-image" src="${escapeHtml(item.imageUrl)}" alt="${escapeHtml(item.title)}" loading="lazy">
      <span class="cat-grid-label">${escapeHtml(item.title)}</span>
    </a>
  `;
}

function renderCategoryPage() {
  if (!catRail || !catContentGrid) {
    return;
  }

  catRail.innerHTML = nonAllCategories.map((item) => {
    const isActive = item.value === state.category;
    return `<button class="cat-rail-item ${isActive ? "active" : ""}" type="button" data-cat-rail="${escapeHtml(item.value)}">${escapeHtml(item.label)}</button>`;
  }).join("");

  const items = state.products.filter((item) => {
    if (item.category !== state.category) return false;
    return state.sub ? item.subcategory === state.sub : true;
  });

  const activeLabel = categoryLabel(state.category);
  if (catContentTitle) {
    catContentTitle.innerHTML =
      `<span>${escapeHtml(activeLabel)}</span>` +
      `<a class="cat-content-more" href="list.html?category=${encodeURIComponent(state.category)}">查看 ${items.length} 件全部 ›</a>`;
  }

  // 二级 chips（当前分类有二级时显示）
  const subs = subItemsOf(state.category);
  const subHtml = subs.length > 0
    ? `<div class="cat-sub-row"><button class="chip-item chip-sub ${state.sub === "" ? "active" : ""}" type="button" data-cat-sub="">全部</button>${subs.map((item) => {
        return `<button class="chip-item chip-sub ${state.sub === item.value ? "active" : ""}" type="button" data-cat-sub="${escapeHtml(item.value)}">${escapeHtml(item.label)}</button>`;
      }).join("")}</div>`
    : "";

  // 完整商品卡片（带彩色兑换标签），与列表页一致
  const gridHtml = items.length === 0
    ? "<p class=\"cat-empty\">这个分类还没有礼品，去看看其他分类吧。</p>"
    : `<div class="product-grid cat-product-grid">${items.map(productCard).join("")}</div>`;

  catContentGrid.innerHTML = subHtml + gridHtml;
}

function updateChipRow() {
  if (!chipRow) {
    return;
  }

  const priceArrow = state.priceDirection === "asc" ? " ↑" : " ↓";
  // 快捷行：全部礼品/邀请有礼（分类）+ 积分排序/礼品上新（排序）
  const quickCatHtml = [
    { value: "all", label: "全部礼品" },
    { value: "referral", label: "邀请有礼" }
  ].map((item) => {
    const a = item.value === state.category;
    return `<button class="chip-item ${a ? "active" : ""}" type="button" data-chip="${escapeHtml(item.value)}">${escapeHtml(item.label)}</button>`;
  }).join("");
  const sortChips = [
    { value: "price", label: state.sort === "price" ? `积分排序${priceArrow}` : "积分排序", active: state.sort === "price" },
    { value: "newest", label: "礼品上新", active: state.sort === "newest" }
  ];
  const sortHtml = quickCatHtml + sortChips.map((item) => {
    return `<button class="chip-item chip-sort ${item.active ? "active" : ""}" type="button" data-chip-sort="${escapeHtml(item.value)}">${escapeHtml(item.label)}</button>`;
  }).join("") + '<button class="chip-item chip-reset" type="button" data-chip-reset>重置</button>';

  // 大类 chips
  const mainHtml = DISPLAY_CATS.map((item) => {
    const isActive = item.value === state.category;
    return `<button class="chip-item ${isActive ? "active" : ""}" type="button" data-chip="${escapeHtml(item.value)}">${escapeHtml(item.label)}</button>`;
  }).join("");

  // 「更多」chip：MORE_CATS 为空时整体不渲染（结构保留，以后有新大类再放回来）
  const moreActive = MORE_CATS.some((c) => c.value === state.category);
  const moreLabel = moreActive ? displayCatLabel(state.category) : "更多";
  const moreChip = MORE_CATS.length
    ? `<button class="chip-item chip-more ${moreActive || state.showMore ? "active" : ""}" type="button" data-chip-more>${escapeHtml(moreLabel)} ${state.showMore ? "▴" : "▾"}</button>`
    : "";

  // 「更多」下拉面板
  const morePanel = (state.showMore && MORE_CATS.length)
    ? `<div class="chip-more-panel">${MORE_CATS.map((item) => {
        const a = item.value === state.category;
        return `<button class="chip-item ${a ? "active" : ""}" type="button" data-chip="${escapeHtml(item.value)}">${escapeHtml(item.label)}</button>`;
      }).join("")}</div>`
    : "";

  // 二级 chips（当前大类有二级时显示）
  const subs = subItemsOf(state.category);
  const subHtml = subs.length > 0
    ? `<div class="chip-sub-row"><button class="chip-item chip-sub ${state.sub === "" ? "active" : ""}" type="button" data-chip-sub="">全部</button>${subs.map((item) => {
        return `<button class="chip-item chip-sub ${state.sub === item.value ? "active" : ""}" type="button" data-chip-sub="${escapeHtml(item.value)}">${escapeHtml(item.label)}</button>`;
      }).join("")}</div>`
    : "";

  // 两行（对齐小程序）：第一行大类 + 更多；第二行排序；（更多面板在两者之间）；最后二级
  chipRow.innerHTML =
    `<div class="chip-main-row">${mainHtml}${moreChip}</div>` +
    morePanel +
    `<div class="chip-sort-row">${sortHtml}</div>` +
    subHtml;
}

function renderWishlistPage() {
  if (!wishlistGrid && !wishlistEmpty) {
    return;
  }

  const ids = getWishlist();
  const items = state.products.filter((item) => ids.includes(String(item.id)));

  if (wishlistEmpty) {
    wishlistEmpty.hidden = items.length > 0;
  }

  if (wishlistGridWrap) {
    wishlistGridWrap.hidden = items.length === 0;
  }

  if (wishlistGrid) {
    wishlistGrid.innerHTML = items.map(productCard).join("");
  }

  const countEl = document.getElementById("wishlistCount");
  if (countEl) {
    countEl.textContent = `已选 ${items.length} 件`;
  }
}

// 一键复制心愿清单文本（拿去发客服）
function copyWishlistText(btn) {
  const ids = getWishlist();
  const items = state.products.filter((item) => ids.includes(String(item.id)));
  if (items.length === 0) return;
  const lines = items.map((it, i) => `${i + 1}. ${it.title}`);
  const text = `我的心愿清单（加加好物图集）：\n${lines.join("\n")}\n共 ${items.length} 件，想了解如何免费办卡领取~`;
  const done = () => {
    if (!btn) return;
    const old = btn.dataset.label || btn.textContent;
    btn.dataset.label = old;
    btn.textContent = "已复制 ✓";
    btn.classList.add("copied");
    setTimeout(() => {
      btn.textContent = btn.dataset.label || "📋 复制清单";
      btn.classList.remove("copied");
    }, 1800);
  };
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(done).catch(() => fallbackCopyText(text, done));
  } else {
    fallbackCopyText(text, done);
  }
}

// 通用复制（成功/失败都尽力而为；失败时静默，用户仍可手动选）
function copyPlainText(text, done) {
  const cb = done || (() => {});
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(cb).catch(() => fallbackCopyText(text, cb));
  } else {
    fallbackCopyText(text, cb);
  }
}

function fallbackCopyText(text, done) {
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    document.execCommand("copy");
    document.body.removeChild(ta);
    done();
  } catch (err) {
    /* 复制失败静默，用户仍可手动选 */
  }
}

// 省级名称标准化（与小程序 address-edit 同一套）
const PROVINCE_MAP = {
  "北京": "北京市", "天津": "天津市", "上海": "上海市", "重庆": "重庆市",
  "河北": "河北省", "山西": "山西省", "辽宁": "辽宁省", "吉林": "吉林省", "黑龙江": "黑龙江省",
  "江苏": "江苏省", "浙江": "浙江省", "安徽": "安徽省", "福建": "福建省", "江西": "江西省",
  "山东": "山东省", "河南": "河南省", "湖北": "湖北省", "湖南": "湖南省", "广东": "广东省",
  "海南": "海南省", "四川": "四川省", "贵州": "贵州省", "云南": "云南省", "陕西": "陕西省",
  "甘肃": "甘肃省", "青海": "青海省", "台湾": "台湾省",
  "内蒙古": "内蒙古自治区", "广西": "广西壮族自治区", "西藏": "西藏自治区",
  "宁夏": "宁夏回族自治区", "新疆": "新疆维吾尔自治区",
  "香港": "香港特别行政区", "澳门": "澳门特别行政区"
};
const MUNICIPALITIES = ["北京市", "天津市", "上海市", "重庆市"];
// 合法省级名集合（简称+全称都认），用于下单防呆：省份框被填成名字/城市时拦下
const PROVINCE_NAMES = new Set([].concat(Object.keys(PROVINCE_MAP), Object.values(PROVINCE_MAP)));

// 从一整段文字里尽力解析出 收件人/手机/省市区/详细（移植自小程序 parseAddress）
function parseAddress(raw) {
  const out = { recipient: "", phone: "", province: "", city: "", district: "", detail: "" };
  let text = String(raw || "").replace(/[\r\n\t]+/g, " ");

  const pm = text.match(/(?:\+?86[\s-]?)?1[3-9]\d(?:[\s-]?\d){8}/);
  if (pm) {
    out.phone = pm[0].replace(/[^\d]/g, "").replace(/^86/, "");
    text = text.replace(pm[0], " ");
  }

  text = text.replace(/收货人|收件人|收货|收件|姓名|联系电话|联系方式|电话|手机号码|手机号|手机|详细地址|地址/g, " ");
  text = text.replace(/[,，。;；:：、|/\\]/g, " ").replace(/\s+/g, " ").trim();

  let provKey = "", provIdx = -1;
  for (const k of Object.keys(PROVINCE_MAP)) {
    const i = text.indexOf(k);
    if (i >= 0 && (provIdx === -1 || i < provIdx)) { provIdx = i; provKey = k; }
  }
  let rest = text;
  if (provKey) {
    out.province = PROVINCE_MAP[provKey];
    const before = text.slice(0, provIdx).trim();
    if (before) out.recipient = before.split(" ").filter(Boolean)[0] || "";
    rest = text.slice(provIdx + provKey.length)
      .replace(/^(壮族自治区|回族自治区|维吾尔自治区|特别行政区|自治区|省|市)/, "")
      .trim();
  }

  const cityMatch = rest.match(/^(.*?(?:市|自治州|地区|盟))/);
  if (cityMatch) {
    out.city = cityMatch[1].trim();
    rest = rest.slice(cityMatch[1].length).trim();
  } else if (MUNICIPALITIES.includes(out.province)) {
    out.city = out.province;
  }

  const distMatch = rest.match(/^(.*?(?:区|县|旗|市))/);
  if (distMatch) {
    out.district = distMatch[1].trim();
    rest = rest.slice(distMatch[1].length).trim();
  }

  out.detail = rest.trim();

  if (!out.recipient && !out.province) {
    const parts = text.split(" ").filter(Boolean);
    if (parts.length) {
      out.recipient = parts[0];
      out.detail = parts.slice(1).join(" ");
    }
  }
  return out;
}

// 居中专业成功弹窗（替代简陋的 alert）
function showOrderSuccessModal() {
  if (document.getElementById("webOrderSuccess")) return;
  const wrap = document.createElement("div");
  wrap.id = "webOrderSuccess";
  wrap.className = "wo-success";
  wrap.innerHTML =
    '<div class="wo-success-mask"></div>' +
    '<div class="wo-success-card" role="dialog" aria-modal="true">' +
      '<div class="wo-success-icon">✓</div>' +
      '<h3 class="wo-success-title">提交成功</h3>' +
      '<p class="wo-success-text">订单信息已复制到剪贴板，<br>请粘贴发送给客服微信核验，核验后发货。</p>' +
      '<div class="wo-success-actions">' +
        '<a class="wo-success-btn wo-success-btn-primary" href="#contact" data-wo-close>联系客服</a>' +
        '<button class="wo-success-btn" type="button" data-wo-close>好的</button>' +
      '</div>' +
    '</div>';
  document.body.appendChild(wrap);
  const close = () => { wrap.remove(); document.body.style.overflow = ""; };
  wrap.querySelector(".wo-success-mask").addEventListener("click", close);
  wrap.querySelectorAll("[data-wo-close]").forEach((b) => b.addEventListener("click", close));
  document.body.style.overflow = "hidden";
}

// 网页端下单（兜底通道）：心愿单里填收货信息 → 写入云开发 orders（与小程序订单同后台）
function setWebOrderMsg(text, tone) {
  if (!webOrderMsg) return;
  webOrderMsg.textContent = text || "";
  if (tone) webOrderMsg.dataset.tone = tone;
  else delete webOrderMsg.dataset.tone;
}

function bindWebOrder() {
  if (!webOrderForm) return;
  webOrderForm.addEventListener("submit", (event) => {
    event.preventDefault();
    submitWebOrder();
  });

  // 粘贴地址自动识别
  const pasteBtn = document.getElementById("webOrderPasteBtn");
  const pasteInput = document.getElementById("webOrderPaste");
  if (pasteBtn && pasteInput) {
    pasteBtn.addEventListener("click", () => {
      const raw = pasteInput.value || "";
      if (!raw.trim()) { setWebOrderMsg("请先粘贴整段地址。", "error"); return; }
      const r = parseAddress(raw);
      const setIf = (name, val) => {
        const el = webOrderForm.querySelector(`[name="${name}"]`);
        if (el && val) el.value = val;
      };
      setIf("recipient", r.recipient);
      setIf("phone", r.phone);
      setIf("province", r.province);
      setIf("city", r.city);
      setIf("district", r.district);
      setIf("detail", r.detail);
      if (!r.recipient && !r.province && !r.phone) {
        setWebOrderMsg("未能识别，请手动填写。", "error");
      } else {
        setWebOrderMsg("已识别，请核对后提交。", "success");
      }
    });
  }
}

function submitWebOrder() {
  if (!webOrderForm) return;
  const ids = getWishlist();
  const items = state.products.filter((p) => ids.includes(String(p.id)));
  if (items.length === 0) {
    setWebOrderMsg("心愿单是空的，先去添加礼品吧。", "error");
    return;
  }
  if (!config.adminOrdersUrl) {
    setWebOrderMsg("下单服务暂未配置，请直接扫码联系客服。", "error");
    return;
  }
  const fd = new FormData(webOrderForm);
  const get = (k) => (fd.get(k) || "").toString().trim();
  const address = {
    recipient: get("recipient"),
    phone: get("phone"),
    province: get("province"),
    city: get("city"),
    district: get("district"),
    detail: get("detail")
  };
  const remark = get("remark");
  if (!address.recipient) { setWebOrderMsg("请填写收件人姓名。", "error"); return; }
  if (!/^1\d{10}$/.test(address.phone)) { setWebOrderMsg("请填写正确的 11 位手机号。", "error"); return; }
  if (!address.province || !address.city) { setWebOrderMsg("请填写省份和城市。", "error"); return; }
  if (!PROVINCE_NAMES.has(address.province)) { setWebOrderMsg("省份填写有误（应为“广东省”这类省级名称），请检查省/市/区是否填串行了。", "error"); return; }
  if (!address.detail) { setWebOrderMsg("请填写详细地址。", "error"); return; }
  if (!remark) { setWebOrderMsg("请填写备注：想要的颜色 / 规格 / 想办的银行等。", "error"); return; }

  const payload = {
    action: "web-submit-order",
    items: items.map((p) => ({ id: p.id, supabaseId: p.id, title: p.title, cardsNeeded: p.cardsNeeded, price: p.price, imageUrl: p.imageUrl, qty: 1 })),
    address,
    remark,
    referrerCode: getRefCode()
  };

  const btn = webOrderForm.querySelector(".web-order-submit");
  if (btn) btn.disabled = true;
  setWebOrderMsg("提交中…", null);

  fetch(config.adminOrdersUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  })
    .then((res) => res.json().catch(() => ({})))
    .then((json) => {
      if (!json || !json.ok) {
        throw new Error((json && json.error) || "提交失败");
      }
      // 既写系统又复制给客服：把订单信息复制到剪贴板，引导用户发客服核验
      const orderText =
        "【兑换申请·加加好物图集】\n" +
        items.map((p, i) => `${i + 1}. ${p.title}`).join("\n") + "\n" +
        `备注：${remark}\n` +
        `收件人：${address.recipient} ${address.phone}\n` +
        `地址：${address.province}${address.city}${address.district || ""}${address.detail}\n` +
        "（已提交系统，麻烦客服核验后发货~）";
      copyPlainText(orderText);
      saveWishlist([]);
      webOrderForm.reset();
      renderAll();
      showOrderSuccessModal();
    })
    .catch((err) => {
      setWebOrderMsg((err && err.message) || "提交失败，请重试或扫码联系客服。", "error");
    })
    .finally(() => {
      if (btn) btn.disabled = false;
    });
}

const viewedProductIds = new Set();

async function incrementProductView(productId) {
  if (!isSupabaseConfigured()) {
    return null;
  }

  try {
    const response = await fetch(`${config.supabaseUrl}/rest/v1/rpc/increment_product_views`, {
      method: "POST",
      headers: {
        apikey: config.supabaseAnonKey,
        Authorization: `Bearer ${config.supabaseAnonKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ p_id: productId })
    });

    if (!response.ok) {
      return null;
    }

    return Number(await response.json()) || 0;
  } catch {
    return null;
  }
}

function renderProductDetail() {
  if (!productDetailEl) {
    return;
  }

  const id = urlParams.get("id");
  const item = state.products.find((p) => String(p.id) === String(id));

  if (!item) {
    productDetailEl.innerHTML = "<p class=\"product-empty\">没有找到这件礼品。</p>";
    return;
  }

  if (typeof document !== "undefined") {
    document.title = `${item.title} · 加加好物图集`;
  }

  const wishlisted = isWishlisted(item.id);
  const priceText = item.price > 0
    ? `<p class="product-price">参考价 <span class="price-symbol">¥</span>${escapeHtml(item.price)}</p>`
    : "";
  const pointsText = buildPointsText(item);
  const descText = item.description
    ? `<div class="product-detail-section"><h2 class="product-detail-subhead">礼品说明</h2><p class="product-detail-desc">${escapeMultiline(item.description)}</p></div>`
    : "";

  const imageList = item.images && item.images.length > 0 ? item.images : [item.imageUrl];
  const galleryHtml = imageList.length > 1
    ? `<div class="product-detail-gallery">${imageList.map((src, i) => `<img class="product-detail-gallery-img${i === 0 ? " active" : ""}" src="${escapeHtml(src)}" alt="${escapeHtml(item.title)}" data-gallery-pick="${escapeHtml(src)}">`).join("")}</div>`
    : "";

  // 分类 / 二级分类 chip
  const catChip = item.category ? `<span class="pd-chip">${escapeHtml(item.category)}</span>` : "";
  const subChip = item.subcategory ? `<span class="pd-chip pd-chip-sub">${escapeHtml(item.subcategory)}</span>` : "";
  const tagsHtml = (catChip || subChip) ? `<div class="product-detail-tags">${catChip}${subChip}</div>` : "";

  // 兑换方式色标（与列表卡片同色：推荐可兑=青绿，办卡可兑=红）
  const isReferral = item.category === "referral";
  const tagHead = `<div class="product-detail-taghead"><span class="title-tag ${isReferral ? "title-tag-referral" : "title-tag-card"}">${isReferral ? "推荐可兑" : "办卡可兑"}</span></div>`;

  // 内联客服卡：就地加客服，不跳走
  const qr = kefuQrSrc();
  const wx = kefuWechatId();
  const kefuCard = `
    <div class="product-detail-kefu">
      <p class="pd-kefu-title">喜欢这件？联系客服免费领取</p>
      <div class="pd-kefu-row">
        <img class="pd-kefu-qr" src="${escapeHtml(qr)}" alt="客服二维码" data-qr-popup="${escapeHtml(qr)}">
        <div class="pd-kefu-info">
          <p class="pd-kefu-step">① 长按 / 扫码加客服微信</p>
          <p class="pd-kefu-step">② 发送礼品名：<b>${escapeHtml(item.title)}</b></p>
          <p class="pd-kefu-step">③ 客服核对并指引免费办卡领取</p>
          <p class="pd-kefu-wx">微信号：${escapeHtml(wx)}</p>
        </div>
      </div>
    </div>`;

  productDetailEl.innerHTML = `
    <div class="product-detail-media" data-image-zoom>
      <img src="${escapeHtml(item.imageUrl)}" alt="${escapeHtml(item.title)}">
      <span class="product-detail-zoom-hint">点击放大</span>
      <button class="heart-btn ${wishlisted ? "active" : ""}" type="button" data-wishlist-toggle="${escapeHtml(item.id)}" aria-label="${wishlisted ? "从心愿单移除" : "加入心愿单"}">
        <svg viewBox="0 0 24 24">
          <path d="M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.5-7 10-7 10z" stroke-width="1.8" stroke-linejoin="round"/>
        </svg>
      </button>
    </div>
    ${galleryHtml}
    <div class="product-detail-body">
      ${tagHead}
      <h1 class="product-detail-title">${escapeHtml(item.title)}</h1>
      ${tagsHtml}
      <div class="product-detail-meta">
        ${priceText}
        ${pointsText ? `<span class="product-cards">${escapeHtml(pointsText)}</span>` : ""}
      </div>
      <p class="product-detail-views" id="productDetailViews">👁 浏览 ${escapeHtml(item.viewCount || 0)} 次</p>
      <a class="pd-points-link" href="earn.html">💡 积分怎么来？查看「获取积分」对照表 ›</a>
      ${descText}
      ${kefuCard}
      <div class="product-detail-cta-row">
        <button class="pd-cta-btn pd-cta-btn-kefu" type="button" data-qr-popup="${escapeHtml(qr)}">添加客服微信</button>
        <button class="pd-cta-btn pd-cta-btn-submit" type="button" data-collect-submit="${escapeHtml(item.id)}">收藏并提交地址</button>
      </div>
      <p class="pd-cta-note">提交地址后，请微信同步客服，核验订单后发货</p>
      <a class="product-detail-cta-link" href="wishlist.html">查看我的心愿单 ›</a>
    </div>
  `;

  if (!viewedProductIds.has(item.id)) {
    viewedProductIds.add(item.id);
    incrementProductView(item.id).then((newCount) => {
      if (newCount === null) return;
      item.viewCount = newCount;
      const el = document.getElementById("productDetailViews");
      if (el) {
        el.textContent = `👁 浏览 ${newCount} 次`;
      }
    });
  }
}

function openImageViewer(src) {
  if (!imageViewer || !imageViewerImg || !src) {
    return;
  }

  imageViewerImg.src = src;
  imageViewer.hidden = false;
  document.body.style.overflow = "hidden";
}

function closeImageViewer() {
  if (!imageViewer) {
    return;
  }

  imageViewer.hidden = true;
  document.body.style.overflow = "";
}

function renderAll() {
  renderProducts();
  renderHomeSections();
  renderCategoryPage();
  renderWishlistPage();
  renderProductDetail();
}

function bindCategoryRail() {
  catRail?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-cat-rail]");

    if (!button) {
      return;
    }

    state.category = button.dataset.catRail || "all";
    if (state.category === "all" && nonAllCategories.length > 0) {
      state.category = nonAllCategories[0].value;
    }
    state.sub = ""; // 切分类清掉二级，避免旧二级把新分类过滤空

    renderCategoryPage();
  });

  // 分类页右侧二级 chips
  catContentGrid?.addEventListener("click", (event) => {
    const subBtn = event.target.closest("[data-cat-sub]");
    if (!subBtn) {
      return;
    }
    state.sub = subBtn.getAttribute("data-cat-sub") || "";
    renderCategoryPage();
  });
}

function bindEvents() {
  dots.forEach((dot) => {
    dot.addEventListener("click", () => {
      const slideIndex = Number(dot.dataset.slide || 0);
      goToSlide(slideIndex);
      startAutoplay();
    });
  });

  mallNavItems.forEach((item) => {
    item.addEventListener("click", () => {
      state.category = item.dataset.categoryLink || "all";

      if (categoryFilter) {
        categoryFilter.value = state.category;
      }

      renderProducts();
    });
  });

  chipRow?.addEventListener("click", (event) => {
    const sortBtn = event.target.closest("[data-chip-sort]");

    if (sortBtn) {
      const target = sortBtn.dataset.chipSort;

      if (target === "price") {
        if (state.sort === "price") {
          if (state.priceDirection === "asc") {
            state.priceDirection = "desc";
          } else {
            state.sort = "default";
          }
        } else {
          state.sort = "price";
          state.priceDirection = "asc";
        }
      } else if (target === "newest") {
        state.sort = state.sort === "newest" ? "default" : "newest";
      }

      renderProducts();
      return;
    }

    // 「更多」开合
    const moreBtn = event.target.closest("[data-chip-more]");
    if (moreBtn) {
      state.showMore = !state.showMore;
      renderProducts();
      return;
    }

    // 二级筛选
    const subBtn = event.target.closest("[data-chip-sub]");
    if (subBtn) {
      state.sub = subBtn.getAttribute("data-chip-sub") || "";
      renderProducts();
      return;
    }

    // 大类（含「更多」面板里的分类）→ 切大类、清二级、收起更多面板
    const categoryBtn = event.target.closest("[data-chip]");
    if (!categoryBtn) {
      return;
    }
    state.category = categoryBtn.dataset.chip || "all";
    state.sub = "";
    state.showMore = false;
    // 推荐有礼按「推荐人数」换，无积分概念 → 切过去时重置积分筛选
    if (state.category === "referral") { state.cards = ""; }

    if (categoryFilter) {
      categoryFilter.value = state.category;
    }

    renderProducts();
  });

  sortButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const target = button.dataset.sort;

      if (target === "price") {
        if (state.sort === "price") {
          state.priceDirection = state.priceDirection === "asc" ? "desc" : "asc";
        } else {
          state.sort = "price";
          state.priceDirection = "asc";
        }
      } else if (target === "newest") {
        state.sort = "newest";
      } else {
        state.sort = "default";
      }

      renderProducts();
    });
  });

  categoryFilter?.addEventListener("change", (event) => {
    state.category = event.target.value || "all";
    renderProducts();
  });

  function runSearch() {
    const value = productSearchInput?.value || "";

    if (productGrid) {
      state.query = value;
      renderProducts();
      return;
    }

    const target = `list.html?q=${encodeURIComponent(value)}`;
    window.location.href = target;
  }

  productSearchInput?.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      runSearch();
    }
  });

  productSearchButton?.addEventListener("click", runSearch);

  track?.addEventListener("mouseenter", stopAutoplay);
  track?.addEventListener("mouseleave", startAutoplay);
  track?.addEventListener("touchstart", stopAutoplay, { passive: true });
  track?.addEventListener("touchend", startAutoplay, { passive: true });

  document.addEventListener("click", (event) => {
    // 「积分筛选 ▾」按钮：开合下拉面板
    if (cardsFilterToggle && event.target.closest("#cardsFilterToggle")) {
      event.preventDefault();
      if (cardsFilterPanel) {
        if (cardsFilterPanel.hidden) {
          renderCardsFilter();
          cardsFilterPanel.hidden = false;
        } else {
          cardsFilterPanel.hidden = true;
        }
      }
      return;
    }

    // 积分档 chip：点击立即筛选并收起（再点同档取消）
    const cardsChip = event.target.closest("[data-cards-filter]");
    if (cardsChip) {
      event.preventDefault();
      const key = cardsChip.dataset.cardsFilter || "";
      state.cards = state.cards === key ? "" : key;
      closeCardsFilterPanel();
      renderProducts();
      return;
    }

    // 「重置」：清空筛选并收起
    if (event.target.closest("[data-cards-reset]")) {
      event.preventDefault();
      state.cards = "";
      closeCardsFilterPanel();
      renderProducts();
      return;
    }

    // 快捷行「重置」：一键清掉所有筛选（分类/二级/积分/排序/搜索词），回到默认全量列表
    if (event.target.closest("[data-chip-reset]")) {
      event.preventDefault();
      state.category = "all";
      state.sub = "";
      state.cards = "";
      state.sort = "default";
      state.query = "";
      state.showMore = false;
      if (productSearchInput) productSearchInput.value = "";
      closeCardsFilterPanel();
      renderProducts();
      return;
    }

    // 点面板外任意区域 → 收起（面板内点击已在上面分支消化，不会走到这）
    if (cardsFilterPanel && !cardsFilterPanel.hidden && !event.target.closest("#cardsFilterPanel")) {
      closeCardsFilterPanel();
    }

    const heart = event.target.closest("[data-wishlist-toggle]");

    if (heart) {
      event.preventDefault();
      event.stopPropagation();
      toggleWishlist(heart.dataset.wishlistToggle);
      renderAll();
      return;
    }

    // 详情页"收藏并提交地址"：先确保已收藏，再去心愿单填地址提交（H5 下单表单在那里）
    const collectSubmit = event.target.closest("[data-collect-submit]");
    if (collectSubmit) {
      event.preventDefault();
      const cid = collectSubmit.dataset.collectSubmit;
      if (!isWishlisted(cid)) toggleWishlist(cid);
      window.location.href = "wishlist.html#webOrderForm";
      return;
    }

    const copyBtn = event.target.closest("[data-wishlist-copy]");
    if (copyBtn) {
      event.preventDefault();
      copyWishlistText(copyBtn);
      return;
    }

    const zoomTarget = event.target.closest("[data-image-zoom]");
    if (zoomTarget) {
      event.preventDefault();
      const img = zoomTarget.querySelector("img");
      openImageViewer(img?.src);
      return;
    }

    // 缩略图：切换主图（不直接放大，主图点一下才放大）
    const galleryPick = event.target.closest("[data-gallery-pick]");
    if (galleryPick) {
      event.preventDefault();
      const mainImg = document.querySelector(".product-detail-media img");
      if (mainImg) mainImg.src = galleryPick.dataset.galleryPick;
      document.querySelectorAll(".product-detail-gallery-img").forEach((el) => {
        el.classList.toggle("active", el === galleryPick);
      });
      return;
    }

    // 晒图墙图片：点击放大
    const galleryZoom = event.target.closest("[data-gallery-zoom]");
    if (galleryZoom) {
      event.preventDefault();
      openImageViewer(galleryZoom.src);
      return;
    }

    const qrTrigger = event.target.closest("[data-qr-popup]");
    if (qrTrigger) {
      event.preventDefault();
      const src = qrTrigger.getAttribute("href") || qrTrigger.dataset.qrPopup;
      openImageViewer(src);
      return;
    }

    if (event.target.closest(".image-viewer-close") || event.target === imageViewer) {
      closeImageViewer();
    }
  });
}

// 初始化分类/二级：分类页用真实分类（左栏）；列表页把分类解析成 大类 + 二级
if (catRail) {
  const rawCat = urlParams.get("category");
  if (rawCat && categoryLabelMap.has(rawCat) && rawCat !== "all") {
    state.category = rawCat;
  } else if (nonAllCategories.length > 0) {
    state.category = nonAllCategories[0].value;
  }
  state.sub = "";
} else if (productGrid) {
  const resolved = resolveDisplay(state.category);
  state.category = resolved.display;
  state.sub = resolved.sub;
  // 推荐有礼无积分概念，落地即清掉可能从 URL 带进来的积分筛选
  if (state.category === "referral") { state.cards = ""; }
}

if (categoryFilter && categoryLabelMap.has(state.category)) {
  categoryFilter.value = state.category;
}

if (productSearchInput && state.query) {
  productSearchInput.value = state.query;
}

// 后台海报点击目标(小程序页路径)→ H5 页面映射
const MP_PAGE_TO_H5 = {
  "/pages/list/list": "list.html",
  "/pages/category/category": "category.html",
  "/pages/wishlist/wishlist": "wishlist.html",
  "/pages/earn/earn": "earn.html",
  "/pages/progress/progress": "progress.html",
  "/pages/card-flow/card-flow": "card-flow.html",
  "/pages/claim-guide/claim-guide": "claim-guide.html",
  "/pages/bank-new-user/bank-new-user": "bank-new-user.html",
  "/pages/promo/promo": "promo.html"
};

function bannerHref(b) {
  if (!b || !b.linkType || b.linkType === "none") return "";
  if (b.linkType === "product" && b.linkValue) return `product.html?id=${encodeURIComponent(b.linkValue)}`;
  if ((b.linkType === "tab" || b.linkType === "page") && b.linkValue) return MP_PAGE_TO_H5[b.linkValue] || "";
  return "";
}

// 读后台配置的首页海报(Supabase app_config)，有则替换静态轮播，无则保留兜底两张图
async function fetchHomeBanners() {
  if (!track || !isSupabaseConfigured()) return;
  try {
    const url = `${config.supabaseUrl}/rest/v1/app_config?key=eq.home_banners&select=value&limit=1`;
    const res = await fetch(url, {
      headers: { apikey: config.supabaseAnonKey, Authorization: `Bearer ${config.supabaseAnonKey}` }
    });
    if (!res.ok) return;
    const rows = await res.json();
    const list = (rows && rows[0] && Array.isArray(rows[0].value)) ? rows[0].value : [];
    const valid = list.filter((b) => b && b.imageUrl);
    if (valid.length === 0) return; // 后台未配置 → 保留静态兜底

    track.innerHTML = valid.map((b) => {
      const href = bannerHref(b);
      const img = `<img class="banner-image" src="${escapeHtml(b.imageUrl)}" alt="${escapeHtml(b.title || "活动海报")}">`;
      return href
        ? `<a class="banner-slide" href="${escapeHtml(href)}">${img}</a>`
        : `<div class="banner-slide">${img}</div>`;
    }).join("");
    if (bannerDots) {
      bannerDots.innerHTML = valid.map((_, i) =>
        `<button class="dot ${i === 0 ? "active" : ""}" type="button" aria-label="第 ${i + 1} 张" data-slide="${i}"></button>`
      ).join("");
    }
    slides = Array.from(document.querySelectorAll(".banner-slide"));
    dots = Array.from(document.querySelectorAll(".dot"));
    dots.forEach((dot) => {
      dot.addEventListener("click", () => { goToSlide(Number(dot.dataset.slide || 0)); startAutoplay(); });
    });
    state.currentSlide = 0;
    goToSlide(0);
    startAutoplay();
  } catch (err) {
    // 读取失败保留静态兜底
  }
}

// 首页「按积分快速兑换」各档位银行名（后台 Supabase app_config 配置）。
// HTML 内已写默认值，配置存在时整体覆盖（含被清空的项），读不到则保留默认，绝不空白。
async function fetchCardsBankLabels() {
  const row = document.getElementById("pointsQuickRow");
  if (!row || !isSupabaseConfigured()) return;
  try {
    const url = `${config.supabaseUrl}/rest/v1/app_config?key=eq.cards_bank_labels&select=value&limit=1`;
    const res = await fetch(url, {
      headers: { apikey: config.supabaseAnonKey, Authorization: `Bearer ${config.supabaseAnonKey}` }
    });
    if (!res.ok) return;
    const rows = await res.json();
    const labels = (rows && rows[0] && rows[0].value && typeof rows[0].value === "object") ? rows[0].value : null;
    if (!labels) return; // 后台未配置 → 保留 HTML 默认
    row.querySelectorAll("[data-pq-bank]").forEach((el) => {
      const key = el.getAttribute("data-pq-bank");
      if (Object.prototype.hasOwnProperty.call(labels, key)) {
        el.textContent = labels[key] == null ? "" : String(labels[key]);
      }
    });
  } catch (err) {
    // 读取失败保留 HTML 默认
  }
}

async function loadEarnBanks() {
  if (!earnBankList) {
    return;
  }

  if (!isSupabaseConfigured()) {
    earnBankList.innerHTML = "<li class=\"bank-item\"><span class=\"bank-name\">暂无数据</span></li>";
    return;
  }

  try {
    const params = new URLSearchParams({
      select: "name,points",
      order: "points.desc.nullslast"
    });

    const response = await fetch(`${config.supabaseUrl}/rest/v1/banks_earn?${params.toString()}`, {
      headers: {
        apikey: config.supabaseAnonKey,
        Authorization: `Bearer ${config.supabaseAnonKey}`
      }
    });

    if (!response.ok) {
      throw new Error(`读取失败：${response.status}`);
    }

    const banks = await response.json();

    if (!Array.isArray(banks) || banks.length === 0) {
      earnBankList.innerHTML = "<li class=\"bank-item\"><span class=\"bank-name\">暂无数据</span></li>";
      return;
    }

    earnBankList.innerHTML = banks.map((bank) => {
      const pts = bank.points || 0;
      const display = pts > 0 ? `${pts} 分` : "- 分";
      return `<li class="bank-item">
        <span class="bank-name">${escapeHtml(bank.name)}</span>
        <span class="bank-points">${escapeHtml(display)}</span>
      </li>`;
    }).join("");
  } catch (error) {
    earnBankList.innerHTML = `<li class="bank-item"><span class="bank-name">${escapeHtml(error.message)}</span></li>`;
  }
}

// ===== 晒图广场（读 Supabase reviews 镜像表，只读已通过） =====
async function fetchApprovedReviews(opts) {
  opts = opts || {};
  if (!isSupabaseConfigured()) return [];
  let qs = `select=*&order=created_at.desc&limit=${Number(opts.limit) || 30}`;
  if (opts.productId) qs += `&product_id=eq.${encodeURIComponent(opts.productId)}`;
  try {
    const res = await fetch(`${config.supabaseUrl}/rest/v1/reviews?${qs}`, {
      headers: { apikey: config.supabaseAnonKey, Authorization: `Bearer ${config.supabaseAnonKey}` }
    });
    if (!res.ok) return [];
    const rows = await res.json();
    return Array.isArray(rows) ? rows : [];
  } catch (err) {
    return [];
  }
}

function reviewCard(r) {
  const imgs = Array.isArray(r.images) ? r.images : [];
  const n = Math.max(0, Math.min(5, Number(r.rating) || 0));
  const stars = "★".repeat(n) + "☆".repeat(5 - n);
  const imgsHtml = imgs.length === 1
    ? `<img class="rv-img-one" src="${escapeHtml(imgs[0])}" alt="晒图" data-gallery-zoom loading="lazy">`
    : (imgs.length > 1 ? `<div class="rv-imgs">${imgs.map((u) => `<img class="rv-img" src="${escapeHtml(u)}" alt="晒图" data-gallery-zoom loading="lazy">`).join("")}</div>` : "");
  const product = r.product_title
    ? `<a class="rv-product" href="product.html?id=${encodeURIComponent(r.product_id || "")}">🎁 ${escapeHtml(r.product_title)} ›</a>`
    : "";
  const date = r.created_at ? String(r.created_at).slice(0, 10) : "";
  return `<article class="rv-card">
    <div class="rv-head"><span class="rv-nick">${escapeHtml(r.nick_masked || "微信用户")}</span><span class="rv-stars">${stars}</span><span class="rv-date">${date}</span></div>
    ${r.content ? `<p class="rv-content">${escapeHtml(r.content)}</p>` : ""}
    ${imgsHtml}
    ${product}
  </article>`;
}

async function renderReviewsWall() {
  const wall = document.getElementById("reviewsWall");
  if (!wall) return;
  const list = await fetchApprovedReviews({ limit: 50 });
  wall.innerHTML = list.length
    ? list.map(reviewCard).join("")
    : '<div class="rv-empty"><span class="rv-empty-emoji">🌱</span><p>还没有人晒图，敬请期待～</p></div>';
}

async function renderHomeReviewStrip() {
  const strip = document.getElementById("homeReviewStrip");
  if (!strip) return;
  const section = document.getElementById("homeReviewSection");
  const list = await fetchApprovedReviews({ limit: 10 });
  if (list.length === 0) { if (section) section.hidden = true; return; }
  strip.innerHTML = list.map((r) => {
    const img = (Array.isArray(r.images) && r.images[0]) ? r.images[0] : "";
    return `<a class="home-rv-card" href="reviews.html">
      ${img ? `<img class="home-rv-img" src="${escapeHtml(img)}" alt="晒图" loading="lazy">` : ""}
      <div class="home-rv-body"><span class="home-rv-nick">${escapeHtml(r.nick_masked || "微信用户")}</span>${r.content ? `<span class="home-rv-text">${escapeHtml(r.content)}</span>` : ""}</div>
    </a>`;
  }).join("");
}

// 全站悬浮：咨询客服(弹二维码) + 返回顶部。site.js 在每页加载，故每页都有。
function injectFloatWidgets() {
  if (document.querySelector(".float-widgets")) return;
  const qrSrc = config.kefuQr || "images/wechat-qr.jpg";
  const wechatId = config.kefuWechat || "L1916959";
  const wrap = document.createElement("div");
  wrap.className = "float-widgets";
  wrap.innerHTML = `
    <button class="float-btn float-top" type="button" aria-label="返回顶部" hidden>↑</button>
    <button class="float-btn float-chat" type="button" aria-label="联系客服"><span class="float-chat-emoji">💬</span><span class="float-chat-label">咨询</span></button>
    <div class="kefu-pop" hidden>
      <div class="kefu-pop-mask"></div>
      <div class="kefu-pop-card">
        <p class="kefu-pop-title">添加客服微信</p>
        <img class="kefu-pop-qr" src="${escapeHtml(qrSrc)}" alt="客服二维码">
        <p class="kefu-pop-tip">长按二维码保存 / 识别添加<br>微信号：${escapeHtml(wechatId)}</p>
        <button class="kefu-pop-close" type="button">关闭</button>
      </div>
    </div>`;
  document.body.appendChild(wrap);
  const topBtn = wrap.querySelector(".float-top");
  const pop = wrap.querySelector(".kefu-pop");
  const hide = () => { pop.hidden = true; };
  wrap.querySelector(".float-chat").addEventListener("click", () => { pop.hidden = false; });
  wrap.querySelector(".kefu-pop-mask").addEventListener("click", hide);
  wrap.querySelector(".kefu-pop-close").addEventListener("click", hide);
  topBtn.addEventListener("click", () => window.scrollTo({ top: 0, behavior: "smooth" }));
  window.addEventListener("scroll", () => { topBtn.hidden = window.scrollY < 400; }, { passive: true });
}

bindEvents();
bindCategoryRail();
bindWebOrder();
goToSlide(0);
startAutoplay();
loadProducts();
loadEarnBanks();
fetchHomeBanners();
fetchCardsBankLabels();
renderReviewsWall();
renderHomeReviewStrip();
injectFloatWidgets();
