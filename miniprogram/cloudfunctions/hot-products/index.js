// 首页「热门兑换」：按订单里的商品下单量降序取前 N（与后台「下单商品统计」同口径）。
// 云函数端能聚合订单（客户端 .limit() 只有 20，且无法跨单聚合），所以放这里算。
// 入参：{ limit?: number=6 }  返回：{ products: [云开发商品文档...] }
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

exports.main = async (event) => {
  const limit = Math.min(Math.max(Number(event && event.limit) || 6, 1), 20);

  // 1. 读最近订单（云函数 limit 上限 1000；按时间倒序，反映近况）
  let orders = [];
  try {
    const r = await db.collection('orders').orderBy('createdAt', 'desc').limit(1000).get();
    orders = r.data || [];
  } catch (e) { orders = []; }

  // 2. 聚合：按 productId || title 计下单量（与后台 topProducts 同口径）
  const counts = {};
  for (const o of orders) {
    if (!Array.isArray(o.items)) continue;
    for (const it of o.items) {
      const key = it.productId || it.title;
      if (!key) continue;
      if (!counts[key]) counts[key] = { productId: it.productId || '', title: it.title || '', count: 0 };
      counts[key].count += (it.qty || 1);
    }
  }
  const ranked = Object.values(counts).sort((a, b) => b.count - a.count);

  // 回退：完全没有订单 → 按浏览量出热门，保证首页不空
  const fallbackByView = async () => {
    const r = await db.collection('products').where({ isActive: true })
      .orderBy('viewCount', 'desc').orderBy('sortOrder', 'asc').limit(limit).get();
    return r.data || [];
  };
  if (!ranked.length) return { products: await fallbackByView(), fallback: 'view' };

  // 3. 解析成「云开发上架商品」：先按 productId(_id) 批量取
  const ids = Array.from(new Set(ranked.map(r => r.productId).filter(Boolean)));
  const prodById = {};
  for (let i = 0; i < ids.length; i += 100) {
    const batch = ids.slice(i, i + 100);
    try {
      const r = await db.collection('products').where({ _id: _.in(batch), isActive: true }).limit(100).get();
      (r.data || []).forEach(p => { prodById[p._id] = p; });
    } catch (e) { /* ignore */ }
  }

  // 4. 合并到商品 _id（同一商品可能被 mini按id、web按title 拆成两条，按 _id 合并计数）
  const merged = {}; // _id -> { doc, count }
  const pendingTitles = [];
  for (const r of ranked) {
    const doc = r.productId && prodById[r.productId];
    if (doc) {
      if (!merged[doc._id]) merged[doc._id] = { doc, count: 0 };
      merged[doc._id].count += r.count;
    } else if (r.title) {
      pendingTitles.push(r);
    }
  }
  // 按 title 兜底解析（只在还没凑够时查，控制查询次数）
  for (const r of pendingTitles) {
    if (Object.keys(merged).length >= limit * 3) break;
    try {
      const pr = await db.collection('products').where({ title: r.title, isActive: true }).limit(1).get();
      const doc = pr.data && pr.data[0];
      if (doc) {
        if (!merged[doc._id]) merged[doc._id] = { doc, count: 0 };
        merged[doc._id].count += r.count;
      }
    } catch (e) { /* ignore */ }
  }

  let top = Object.values(merged).sort((a, b) => b.count - a.count).slice(0, limit).map(x => x.doc);

  // 5. 不足 limit（订单覆盖的商品太少）→ 用浏览量补齐，保证有 N 个
  if (top.length < limit) {
    const have = new Set(top.map(p => p._id));
    try {
      const r = await db.collection('products').where({ isActive: true })
        .orderBy('viewCount', 'desc').limit(limit + top.length + 6).get();
      for (const p of (r.data || [])) {
        if (top.length >= limit) break;
        if (!have.has(p._id)) { top.push(p); have.add(p._id); }
      }
    } catch (e) { /* ignore */ }
  }

  return { products: top };
};
