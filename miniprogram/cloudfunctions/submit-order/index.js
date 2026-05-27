// 创建订单（申请）
// 入参：{ items: [{ _id, qty? }], addressId, remark? }
// 返回：{ success, orderId }
//
// 安全策略：
// - openid 从 getWXContext() 取，不信 client 传值
// - items / address 都做服务端快照：从云开发实时读 products 和 addresses，
//   避免 client 篡改价格/积分；后续 admin 改资料也不影响历史订单
// - 限频：同一 openid 60 秒内最多 3 单（防误点 + 防滥用）

const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();
const _ = db.command;

const MAX_ITEMS = 50;
const RATE_WINDOW_MS = 60 * 1000;
const RATE_MAX = 3;

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext();
  if (!OPENID) return { success: false, error: '未登录' };

  const items = Array.isArray(event && event.items) ? event.items : [];
  const addressId = event && event.addressId;
  const remark = ((event && event.remark) || '').trim().slice(0, 500);

  if (items.length === 0) return { success: false, error: '心愿单为空' };
  if (items.length > MAX_ITEMS) return { success: false, error: '商品过多' };
  if (!addressId) return { success: false, error: '缺少收货地址' };

  // 1. 限频
  const since = new Date(Date.now() - RATE_WINDOW_MS);
  const recent = await db.collection('orders')
    .where({ openid: OPENID, createdAt: _.gt(since) })
    .count();
  if (recent.total >= RATE_MAX) {
    return { success: false, error: '操作太频繁，请稍后再试' };
  }

  // 2. 取地址快照（必须是本人的）
  let addressDoc;
  try {
    const r = await db.collection('addresses').doc(addressId).get();
    addressDoc = r.data;
  } catch (err) {
    return { success: false, error: '地址不存在' };
  }
  if (!addressDoc || addressDoc.openid !== OPENID) {
    return { success: false, error: '地址无效' };
  }

  // 3. 取商品快照
  const ids = Array.from(new Set(items.map(i => String(i && i._id || '')).filter(Boolean)));
  if (ids.length === 0) return { success: false, error: '商品 ID 缺失' };

  const productRes = await db.collection('products')
    .where({ _id: _.in(ids), isActive: true })
    .limit(MAX_ITEMS)
    .get();

  if (productRes.data.length === 0) {
    return { success: false, error: '商品已下架' };
  }

  const productMap = {};
  productRes.data.forEach(p => { productMap[p._id] = p; });

  const itemSnapshots = [];
  let totalCards = 0;
  for (const it of items) {
    const p = productMap[it._id];
    if (!p) continue;
    const qty = Math.max(1, Math.min(99, Number(it.qty) || 1));
    const cards = Number(p.cardsNeeded) || 0;
    itemSnapshots.push({
      productId: p._id,
      supabaseId: p.supabaseId || '',
      title: p.title || '',
      imageUrl: (Array.isArray(p.images) && p.images[0]) || p.imageUrl || '',
      cardsNeeded: cards,
      price: Number(p.price) || 0,
      qty
    });
    totalCards += cards * qty;
  }
  if (itemSnapshots.length === 0) return { success: false, error: '商品已下架' };

  // 4. 组装地址快照（剥掉 _id / openid / 系统字段）
  const addressSnapshot = {
    recipient: addressDoc.recipient || '',
    phone: addressDoc.phone || '',
    province: addressDoc.province || '',
    city: addressDoc.city || '',
    district: addressDoc.district || '',
    detail: addressDoc.detail || ''
  };

  const now = new Date();
  const order = {
    openid: OPENID,
    items: itemSnapshots,
    address: addressSnapshot,
    remark,
    totalCards,
    itemCount: itemSnapshots.length,
    status: 'pending',
    createdAt: now,
    updatedAt: now
  };

  const add = await db.collection('orders').add({ data: order });
  return { success: true, orderId: add._id, itemCount: itemSnapshots.length, totalCards };
};
