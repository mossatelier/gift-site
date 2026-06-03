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
  query: urlParams.get("q") || ""
};

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
// 全部商品页顶部平铺的大类
const DISPLAY_CATS = [
  { value: "all", label: "全部礼品" },
  { value: "referral", label: "推荐有礼" },
  { value: "mombaby", label: "母婴好物" },
  { value: "pet", label: "宠物用品" },
  { value: "camping", label: "户外露营" }
];
// 「更多」下拉里的大类
const MORE_CATS = [
  { value: "digital", label: "电子数码" },
  { value: "appliance", label: "家用电器" }
];
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
          <img class="product-image" src="${escapeHtml(item.imageUrl)}" alt="${escapeHtml(item.title)}">
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
      .slice(0, 6);
    productHotGrid.innerHTML = hot.map(productCard).join("")
      || "<p class=\"product-empty\">暂时没有热门兑换礼品。</p>";
  }

  if (productNewGrid) {
    const fresh = state.products
      .slice()
      .sort((left, right) => parseDate(right.createdAt) - parseDate(left.createdAt))
      .slice(0, 6);
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
  const sortChips = [
    { value: "price", label: state.sort === "price" ? `积分${priceArrow}` : "积分", active: state.sort === "price" },
    { value: "newest", label: "最新", active: state.sort === "newest" }
  ];
  const sortHtml = sortChips.map((item) => {
    return `<button class="chip-item chip-sort ${item.active ? "active" : ""}" type="button" data-chip-sort="${escapeHtml(item.value)}">${escapeHtml(item.label)}</button>`;
  }).join("");

  // 大类 chips
  const mainHtml = DISPLAY_CATS.map((item) => {
    const isActive = item.value === state.category;
    return `<button class="chip-item ${isActive ? "active" : ""}" type="button" data-chip="${escapeHtml(item.value)}">${escapeHtml(item.label)}</button>`;
  }).join("");

  // 「更多」chip：选中的是更多里的分类时高亮并显示其名
  const moreActive = MORE_CATS.some((c) => c.value === state.category);
  const moreLabel = moreActive ? displayCatLabel(state.category) : "更多";
  const moreChip = `<button class="chip-item chip-more ${moreActive || state.showMore ? "active" : ""}" type="button" data-chip-more>${escapeHtml(moreLabel)} ${state.showMore ? "▴" : "▾"}</button>`;

  // 「更多」下拉面板
  const morePanel = state.showMore
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

  chipRow.innerHTML =
    `<div class="chip-main-row">${sortHtml}<span class="chip-divider" aria-hidden="true"></span>${mainHtml}${moreChip}</div>${morePanel}${subHtml}`;
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
      <a class="product-detail-cta product-detail-cta-ghost" href="wishlist.html">查看我的心愿单 ›</a>
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
    const heart = event.target.closest("[data-wishlist-toggle]");

    if (heart) {
      event.preventDefault();
      event.stopPropagation();
      toggleWishlist(heart.dataset.wishlistToggle);
      renderAll();
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
goToSlide(0);
startAutoplay();
loadProducts();
loadEarnBanks();
fetchHomeBanners();
renderReviewsWall();
renderHomeReviewStrip();
injectFloatWidgets();
