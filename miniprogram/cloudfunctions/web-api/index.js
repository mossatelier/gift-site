// H5 网页端公开只读接口：让网页不再直读 Supabase，改从云开发取数据。
// 通过「HTTP 访问服务」暴露；只读、不含任何敏感信息，无需鉴权。
//
// 字段名对齐 H5 原先从 Supabase 拿到的下划线风格（id/cards_needed/is_active…），
// 这样 site.js 的 normalizeProduct 不用改。
//
// 动作（?action=）：
//   products      商品列表（在售，按 sortOrder 升序）
//   config        app_config（home_banners / cards_bank_labels / referral_share）
//   banks         银行积分表
//   inc-view      浏览量 +1  （POST body 或 ?id= 传云开发 _id）
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

// 云开发驼峰 → H5 期望的下划线字段
function toWebProduct(p) {
  const images = Array.isArray(p.images) && p.images.length
    ? p.images
    : (p.imageUrl ? [p.imageUrl] : []);
  return {
    id: p._id,                       // H5 用它做 URL 上的 id
    cloudId: p._id,
    supabaseId: p.supabaseId || '',
    title: p.title || '',
    category: p.category || '',
    subcategory: p.subcategory || '',
    price: Number(p.price) || 0,
    cards_needed: Number(p.cardsNeeded) || 0,
    description: p.description || '',
    image_url: images[0] || '',
    images,
    sort_order: Number(p.sortOrder) || 10,
    is_active: p.isActive !== false,
    created_at: p.createdAt || '',
    view_count: Number(p.viewCount) || 0
  };
}

function parseEvent(event) {
  const e = event || {};
  if (e.httpMethod || e.headers || e.queryStringParameters) {
    let body = {};
    try { body = e.body ? JSON.parse(e.body) : {}; } catch (err) { /* 非 JSON 忽略 */ }
    return { ...(e.queryStringParameters || {}), ...body, _http: true, _method: e.httpMethod };
  }
  return e;
}

async function listProducts() {
  // 云函数单次上限 1000；商品未来可能到 3000，这里分页拉全
  const out = [];
  const PAGE = 1000;
  for (let skip = 0; skip < 5000; skip += PAGE) {
    const r = await db.collection('products')
      .where({ isActive: _.neq(false) })
      .orderBy('sortOrder', 'asc')
      .orderBy('createdAt', 'desc')
      .skip(skip).limit(PAGE).get();
    const rows = r.data || [];
    out.push(...rows);
    if (rows.length < PAGE) break;
  }
  return out.map(toWebProduct);
}

async function getConfig() {
  const r = await db.collection('app_config').limit(50).get();
  const out = {};
  for (const row of (r.data || [])) {
    if (row.key === 'home_banners') out.home_banners = row.banners || [];
    else if (row.key === 'cards_bank_labels') out.cards_bank_labels = row.labels || {};
    else if (row.key === 'referral_share') out.referral_share = { imageUrl: row.imageUrl || '', title: row.title || '' };
    else if (row.key === 'category_order') out.category_order = row.order || [];
  }
  return out;
}

async function listBanks() {
  const r = await db.collection('banks_earn')
    .orderBy('points', 'desc').orderBy('sortOrder', 'asc').limit(200).get();
  return (r.data || []).map((b) => ({
    id: b._id,
    name: b.name || '',
    points: Number(b.points) || 0,
    sort_order: Number(b.sortOrder) || 100
  }));
}

async function incView(id) {
  if (!id) return { ok: false };
  try {
    await db.collection('products').doc(id).update({ data: { viewCount: _.inc(1) } });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

exports.main = async (rawEvent) => {
  const event = parseEvent(rawEvent);
  const action = String(event.action || 'products');
  try {
    let data;
    if (action === 'products') data = { products: await listProducts() };
    else if (action === 'config') data = { config: await getConfig() };
    else if (action === 'banks') data = { banks: await listBanks() };
    else if (action === 'inc-view') data = await incView(event.id);
    else if (action === 'all') {
      // 首屏一次拿齐，省一次往返
      const [products, config] = await Promise.all([listProducts(), getConfig()]);
      data = { products, config };
    } else {
      return { success: false, error: '未知 action: ' + action };
    }
    return { success: true, ...data };
  } catch (e) {
    console.error('web-api failed', action, e);
    return { success: false, error: (e && e.message) || '服务异常' };
  }
};
