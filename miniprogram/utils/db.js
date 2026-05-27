// 云开发数据库封装层
// 集合：products（与原 Supabase products 表字段对齐，camelCase 命名）

const COLLECTION = 'products';

function db() {
  return wx.cloud.database();
}

function products() {
  return db().collection(COLLECTION);
}

// 构造 where 条件（多字段搜索：title + description + subcategory 都尝试匹配）
function _buildWhere({ category, subcategory, keyword }) {
  const _ = db().command;
  const cond = { isActive: true };
  if (category && category !== 'all') cond.category = category;
  if (subcategory) cond.subcategory = subcategory;
  if (keyword) {
    const re = db().RegExp({ regexp: keyword, options: 'i' });
    cond._matchKeyword = _.or([
      { title: re },
      { description: re },
      { subcategory: re }
    ]);
  }
  // _matchKeyword 不是真实字段，转化成 db().command.or 的合法格式
  if (cond._matchKeyword) {
    const or = cond._matchKeyword;
    delete cond._matchKeyword;
    return _.and([cond, or]);
  }
  return cond;
}

// 列表查询：sort 支持 default | newest | cards-asc | cards-desc
async function listProducts({
  category = null,
  subcategory = null,
  limit = 20,
  skip = 0,
  keyword = '',
  sort = 'default'
} = {}) {
  let q = products().where(_buildWhere({ category, subcategory, keyword }));

  if (sort === 'newest') {
    q = q.orderBy('createdAt', 'desc');
  } else if (sort === 'cards-asc') {
    q = q.orderBy('cardsNeeded', 'asc').orderBy('sortOrder', 'asc');
  } else if (sort === 'cards-desc') {
    q = q.orderBy('cardsNeeded', 'desc').orderBy('sortOrder', 'asc');
  } else {
    q = q.orderBy('sortOrder', 'asc').orderBy('createdAt', 'desc');
  }

  const res = await q.skip(skip).limit(limit).get();
  return res.data.map(normalize);
}

// 仅返回符合条件的总数（不拉数据）
async function countProducts({
  category = null,
  subcategory = null,
  keyword = ''
} = {}) {
  const res = await products().where(_buildWhere({ category, subcategory, keyword })).count();
  return res.total || 0;
}

// 取单个商品
async function getProductById(id) {
  const res = await products().doc(id).get();
  return normalize(res.data);
}

// 按 ID 数组批量取（云开发不支持 doc().in，用 _id in 查询）
async function getProductsByIds(ids) {
  if (!Array.isArray(ids) || ids.length === 0) return [];
  const _ = db().command;
  const res = await products()
    .where({
      _id: _.in(ids),
      isActive: true
    })
    .limit(100)
    .get();
  // 保留传入顺序
  const map = {};
  res.data.forEach(item => { map[item._id] = normalize(item); });
  return ids.map(id => map[id]).filter(Boolean);
}

// 取热门：按 viewCount 降序，并列时按 sortOrder 升序（与 H5 一致）
async function listHotProducts(limit = 6) {
  const res = await products()
    .where({ isActive: true })
    .orderBy('viewCount', 'desc')
    .orderBy('sortOrder', 'asc')
    .limit(limit)
    .get();
  return res.data.map(normalize);
}

// 取银行积分对照（按 points 降序）
async function listBanks() {
  const res = await db()
    .collection('banks_earn')
    .orderBy('points', 'desc')
    .orderBy('sortOrder', 'asc')
    .limit(50)
    .get();
  return res.data.map(b => ({
    _id: b._id,
    name: b.name || '',
    points: Number(b.points) || 0,
    sortOrder: Number(b.sortOrder) || 100
  }));
}

// 取新品（按 createdAt 降序前 N 个）
async function listNewProducts(limit = 6) {
  return listProducts({ limit, sort: 'newest' });
}

// 字段归一化 —— 兼容老数据 image_url 与新数据 images 数组
function normalize(item) {
  if (!item) return item;
  const images = Array.isArray(item.images) && item.images.length > 0
    ? item.images
    : (item.imageUrl || item.image_url ? [item.imageUrl || item.image_url] : []);
  return {
    _id: item._id,
    title: item.title || '',
    category: item.category || '',
    subcategory: item.subcategory || '',
    price: Number(item.price) || 0,
    cardsNeeded: Number(item.cardsNeeded || item.cards_needed) || 0,
    description: item.description || '',
    images,
    imageUrl: images[0] || '',
    sortOrder: Number(item.sortOrder || item.sort_order) || 10,
    isActive: item.isActive !== false,
    createdAt: item.createdAt || item.created_at || '',
    viewCount: Number(item.viewCount || item.view_count) || 0
  };
}

// ============ 地址（addresses 集合，一人一份） ============

async function getMyAddress(openid) {
  if (!openid) return null;
  const res = await db().collection('addresses')
    .where({ openid })
    .limit(1)
    .get();
  return res.data[0] || null;
}

async function upsertMyAddress(openid, patch) {
  if (!openid) throw new Error('未登录');
  const now = new Date();
  const cleaned = {
    recipient: (patch.recipient || '').trim(),
    phone: (patch.phone || '').trim(),
    province: (patch.province || '').trim(),
    city: (patch.city || '').trim(),
    district: (patch.district || '').trim(),
    detail: (patch.detail || '').trim()
  };
  if (!cleaned.recipient) throw new Error('请填写收件人姓名');
  if (!/^1\d{10}$/.test(cleaned.phone)) throw new Error('手机号格式不正确');
  if (!cleaned.province || !cleaned.city) throw new Error('请选择所在地区');
  if (!cleaned.detail) throw new Error('请填写详细地址');

  const existing = await getMyAddress(openid);
  if (existing) {
    await db().collection('addresses').doc(existing._id).update({
      data: { ...cleaned, updatedAt: now }
    });
    return { ...existing, ...cleaned, updatedAt: now };
  }
  const doc = { openid, ...cleaned, createdAt: now, updatedAt: now };
  const add = await db().collection('addresses').add({ data: doc });
  return { _id: add._id, ...doc };
}

// ============ 订单（orders 集合，写靠云函数，读靠 SDK） ============

async function listMyOrders(openid, { limit = 20, skip = 0 } = {}) {
  if (!openid) return [];
  const res = await db().collection('orders')
    .where({ openid })
    .orderBy('createdAt', 'desc')
    .skip(skip)
    .limit(limit)
    .get();
  return res.data;
}

async function getMyOrder(openid, id) {
  if (!openid || !id) return null;
  const r = await db().collection('orders').doc(id).get();
  const order = r && r.data;
  if (!order || order.openid !== openid) return null;
  return order;
}

module.exports = {
  listProducts,
  countProducts,
  getProductById,
  getProductsByIds,
  listHotProducts,
  listNewProducts,
  listBanks,
  getMyAddress,
  upsertMyAddress,
  listMyOrders,
  getMyOrder
};
