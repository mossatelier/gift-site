const config = window.APP_CONFIG || {};
const categories = Array.isArray(config.categories) ? config.categories : [];
const categoryLabelMap = new Map(categories.map((item) => [item.value, item.label]));

const track = document.getElementById("bannerTrack");
const slides = Array.from(document.querySelectorAll(".banner-slide"));
const dots = Array.from(document.querySelectorAll(".dot"));
const mallNavItems = Array.from(document.querySelectorAll("[data-category-link]"));
const sortButtons = Array.from(document.querySelectorAll("[data-sort]"));
const categoryFilter = document.getElementById("categoryFilter");
const productGrid = document.getElementById("productGrid");
const productResultCount = document.getElementById("productResultCount");
const productSortState = document.getElementById("productSortState");
const productDataState = document.getElementById("productDataState");
const productDataTip = document.getElementById("productDataTip");
const productEmpty = document.getElementById("productEmpty");
const productSearchInput = document.getElementById("productSearchInput");
const productSearchButton = document.getElementById("productSearchButton");

const state = {
  products: [],
  source: "fallback",
  sourceTip: "填好 Supabase 配置后，这里会自动切换成动态商品。",
  currentSlide: 0,
  timerId: null,
  sort: "default",
  priceDirection: "asc",
  category: "all",
  query: ""
};

function isSupabaseConfigured() {
  return Boolean(config.supabaseUrl && config.supabaseAnonKey && config.productsTable);
}

function categoryLabel(categoryValue) {
  return categoryLabelMap.get(categoryValue) || "其他分类";
}

function parseDate(dateValue) {
  const timestamp = Date.parse(dateValue || "");
  return Number.isNaN(timestamp) ? 0 : timestamp;
}

function normalizeProduct(product, index) {
  return {
    id: product.id || `product-${index + 1}`,
    title: product.title || "未命名礼品",
    category: product.category || "all",
    price: Number(product.price || 0),
    description: product.description || "暂无说明",
    imageUrl: product.imageUrl || product.image_url || "images/product-1.svg",
    actionLabel: product.actionLabel || product.action_label || "查看详情",
    actionUrl: product.actionUrl || product.action_url || "#service",
    sortOrder: Number(product.sortOrder ?? product.sort_order ?? index + 1),
    isActive: product.isActive ?? product.is_active ?? true,
    createdAt: product.createdAt || product.created_at || ""
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

async function fetchProductsFromSupabase() {
  const params = new URLSearchParams({
    select: "id,title,category,price,description,image_url,action_label,action_url,sort_order,is_active,created_at",
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
    state.source = "fallback";
    state.sourceTip = "当前未填写 Supabase 项目地址和匿名 Key，页面先显示本地占位商品。";
    renderProducts();
    return;
  }

  try {
    const products = await fetchProductsFromSupabase();
    state.products = products.filter((item) => item.isActive);
    state.source = "supabase";
    state.sourceTip = state.products.length > 0
      ? "当前商品来自 Supabase，手机端上新后这里会自动刷新展示。"
      : "Supabase 已连接成功，但商品表目前还是空的。";
  } catch (error) {
    state.products = (config.fallbackProducts || []).map(normalizeProduct).filter((item) => item.isActive);
    state.source = "fallback";
    state.sourceTip = `${error.message}，已退回本地占位商品。`;
  }

  renderProducts();
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

function filteredProducts() {
  const keyword = state.query.trim().toLowerCase();

  const filtered = state.products.filter((item) => {
    const matchCategory = state.category === "all" || item.category === state.category;

    if (!matchCategory) {
      return false;
    }

    if (!keyword) {
      return true;
    }

    const haystack = `${item.title} ${item.description} ${categoryLabel(item.category)}`.toLowerCase();
    return haystack.includes(keyword);
  });

  return filtered.sort((left, right) => {
    if (state.sort === "price") {
      return state.priceDirection === "asc" ? left.price - right.price : right.price - left.price;
    }

    if (left.sortOrder !== right.sortOrder) {
      return left.sortOrder - right.sortOrder;
    }

    return parseDate(right.createdAt) - parseDate(left.createdAt);
  });
}

function renderProducts() {
  if (!productGrid) {
    return;
  }

  const products = filteredProducts();
  productGrid.innerHTML = products.map((item) => {
    return `
      <article class="product-card">
        <div class="product-media">
          <img class="product-image" src="${escapeHtml(item.imageUrl)}" alt="${escapeHtml(item.title)}">
          <div class="product-name-badge">${escapeHtml(item.title)}</div>
        </div>
        <div class="product-body">
          <h3 class="product-title">${escapeHtml(item.title)}</h3>
          <p class="product-meta">${escapeHtml(categoryLabel(item.category))} · 参考价 ¥${escapeHtml(item.price)}</p>
          <p class="product-desc">${escapeHtml(item.description)}</p>
          <a class="product-link" href="${escapeHtml(item.actionUrl)}">${escapeHtml(item.actionLabel)}</a>
        </div>
      </article>
    `;
  }).join("");

  if (productResultCount) {
    productResultCount.textContent = `共 ${products.length} 件礼品`;
  }

  if (productSortState) {
    productSortState.textContent = state.sort === "price"
      ? `当前排序：价格${state.priceDirection === "asc" ? "从低到高" : "从高到低"}`
      : "当前排序：综合";
  }

  if (productDataState) {
    productDataState.textContent = state.source === "supabase" ? "数据源：Supabase" : "数据源：本地占位";
    productDataState.classList.toggle("product-source-live", state.source === "supabase");
  }

  if (productDataTip) {
    productDataTip.textContent = state.sourceTip;
  }

  if (productEmpty) {
    productEmpty.hidden = products.length > 0;
  }

  updateCategoryNav();
  updateSortButtons();
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

  sortButtons.forEach((button) => {
    button.addEventListener("click", () => {
      if (button.dataset.sort === "price") {
        if (state.sort === "price") {
          state.priceDirection = state.priceDirection === "asc" ? "desc" : "asc";
        } else {
          state.sort = "price";
          state.priceDirection = "asc";
        }
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

  productSearchInput?.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      state.query = productSearchInput.value || "";
      renderProducts();
    }
  });

  productSearchButton?.addEventListener("click", () => {
    state.query = productSearchInput?.value || "";
    renderProducts();
  });

  track?.addEventListener("mouseenter", stopAutoplay);
  track?.addEventListener("mouseleave", startAutoplay);
  track?.addEventListener("touchstart", stopAutoplay, { passive: true });
  track?.addEventListener("touchend", startAutoplay, { passive: true });
}

bindEvents();
goToSlide(0);
startAutoplay();
loadProducts();
