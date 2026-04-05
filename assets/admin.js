const config = window.APP_CONFIG || {};

const adminConfigStatus = document.getElementById("adminConfigStatus");
const adminConfigTip = document.getElementById("adminConfigTip");
const adminLockCard = document.getElementById("adminLockCard");
const adminPasscodeInput = document.getElementById("adminPasscodeInput");
const adminUnlockButton = document.getElementById("adminUnlockButton");
const adminLockMessage = document.getElementById("adminLockMessage");
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
  unlocked: !config.adminPasscode,
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

function setLockMessage(text, tone = "idle") {
  adminLockMessage.textContent = text;
  adminLockMessage.dataset.tone = tone;
}

function updateFormAccess() {
  const canUseForm = state.unlocked && isSupabaseConfigured();
  Array.from(productForm.elements).forEach((element) => {
    if (element.id === "adminPasscodeInput") {
      return;
    }

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
    adminConfigTip.textContent = "Supabase 配置已填写。接下来请确认数据库表、Storage bucket 和策略已经按说明创建。";
  } else {
    adminConfigStatus.textContent = "未配置";
    adminConfigStatus.classList.remove("admin-status-pill-success");
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
  const fileName = `${Date.now()}-${sanitizeFileName(file.name)}`;
  const folder = config.storageFolder || "products";
  const filePath = `${folder}/${fileName}`;
  const response = await fetch(storageUploadEndpoint(filePath), {
    method: "POST",
    headers: {
      apikey: config.supabaseAnonKey,
      Authorization: `Bearer ${config.supabaseAnonKey}`,
      "Content-Type": file.type || "application/octet-stream",
      "x-upsert": "true"
    },
    body: file
  });

  if (!response.ok) {
    throw new Error(`图片上传失败：${response.status}`);
  }

  return storagePublicUrl(filePath);
}

async function insertProduct(row) {
  const response = await fetch(`${config.supabaseUrl}/rest/v1/${config.productsTable}`, {
    method: "POST",
    headers: {
      apikey: config.supabaseAnonKey,
      Authorization: `Bearer ${config.supabaseAnonKey}`,
      "Content-Type": "application/json",
      Prefer: "return=representation"
    },
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
  if (!state.unlocked && config.adminPasscode) {
    adminRecentList.innerHTML = "<p class=\"admin-status-text\">通过口令校验后，才会读取最近商品。</p>";
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
      headers: {
        apikey: config.supabaseAnonKey,
        Authorization: `Bearer ${config.supabaseAnonKey}`
      }
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

function bindLockEvents() {
  if (!config.adminPasscode) {
    adminLockCard.hidden = true;
    return;
  }

  adminLockCard.hidden = false;
  setLockMessage("请输入你在配置里设置的前端口令。");

  adminUnlockButton?.addEventListener("click", () => {
    if ((adminPasscodeInput?.value || "") === config.adminPasscode) {
      state.unlocked = true;
      adminLockCard.hidden = true;
      updateFormAccess();
      setSubmitMessage("口令校验通过，现在可以提交商品。");
      loadRecentProducts();
      return;
    }

    setLockMessage("口令不正确，请重试。", "error");
  });
}

productForm?.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (!state.unlocked) {
    setSubmitMessage("请先通过口令校验。", "error");
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
bindPreviewEvents();
bindLockEvents();
updateFormAccess();
loadRecentProducts();
