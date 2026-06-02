// 管理员订单接口（HTTP 触发器）
// 三个 action：list / get / update-status
//
// 认证：admin.html 调用时在 Authorization header 带 Supabase JWT。
// 本函数：
//   1) 用 token 调 Supabase /auth/v1/user 拿邮箱
//   2) 用 email 查 admin_users 表确认管理员身份
//   3) 通过才执行操作
//
// 请求格式：POST /admin-orders   body = { action, ... }
// 返回：    { ok: true/false, data?, error? }

const cloud = require('wx-server-sdk');
const https = require('https');
const { URL } = require('url');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();
const _ = db.command;

const SUPABASE_URL = 'https://ukoqffocqjokcroilyyv.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVrb3FmZm9jcWpva2Nyb2lseXl2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUzMzMxMDUsImV4cCI6MjA5MDkwOTEwNX0.jKFzbuDLbbDboUD8vJLAu0uTkkEzE2YnC2bHU5I8RH0';

const ALLOWED_STATUS = ['pending', 'processing', 'done', 'cancelled'];

// ---------- HTTP helper ----------

function httpsReq(urlString, { method = 'GET', headers = {}, body } = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(urlString);
    const opts = {
      method,
      hostname: u.hostname,
      port: u.port || 443,
      path: u.pathname + u.search,
      headers
    };
    const req = https.request(opts, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        resolve({ status: res.statusCode, body: data });
      });
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

// ---------- Supabase admin auth ----------

async function verifyAdmin(accessToken) {
  if (!accessToken) throw new Error('未登录');

  const userRes = await httpsReq(`${SUPABASE_URL}/auth/v1/user`, {
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${accessToken}`
    }
  });
  if (userRes.status !== 200) throw new Error('登录已过期，请重新登录');
  const user = JSON.parse(userRes.body);
  if (!user || !user.email) throw new Error('账号无效');

  const adminRes = await httpsReq(
    `${SUPABASE_URL}/rest/v1/admin_users?email=eq.${encodeURIComponent(user.email)}&select=email&limit=1`,
    {
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${accessToken}`
      }
    }
  );
  if (adminRes.status !== 200) throw new Error('管理员校验失败');
  const rows = JSON.parse(adminRes.body);
  if (!Array.isArray(rows) || rows.length === 0) {
    throw new Error('当前账号不在管理员名单');
  }
  return user.email;
}

// ---------- Actions ----------

async function listOrders({ status, limit = 50, skip = 0, search = '' }) {
  const where = {};
  if (status && ALLOWED_STATUS.includes(status)) where.status = status;

  // search 暂时只在 client 端过滤（数据量小，避免索引复杂）
  const res = await db.collection('orders')
    .where(where)
    .orderBy('createdAt', 'desc')
    .skip(Number(skip) || 0)
    .limit(Math.min(Number(limit) || 50, 200))
    .get();

  const countRes = await db.collection('orders').where(where).count();

  let items = res.data;
  if (search) {
    const kw = String(search).toLowerCase();
    items = items.filter(o => {
      const hay = [
        o.address && o.address.recipient,
        o.address && o.address.phone,
        o.remark,
        ...(Array.isArray(o.items) ? o.items.map(i => i && i.title) : [])
      ].filter(Boolean).join(' ').toLowerCase();
      return hay.includes(kw);
    });
  }

  return { items, total: countRes.total || 0 };
}

async function getOrder({ orderId }) {
  if (!orderId) throw new Error('缺少 orderId');
  const r = await db.collection('orders').doc(orderId).get();
  return r.data;
}

async function updateOrderStatus({ orderId, status, adminNote }) {
  if (!orderId) throw new Error('缺少 orderId');
  if (!ALLOWED_STATUS.includes(status)) throw new Error('非法状态');
  const patch = { status, updatedAt: new Date() };
  if (typeof adminNote === 'string') patch.adminNote = adminNote.slice(0, 1000);
  await db.collection('orders').doc(orderId).update({ data: patch });
  const r = await db.collection('orders').doc(orderId).get();
  return r.data;
}

// 北京时间偏移（云函数运行环境为 UTC，统一按 UTC+8 计算周期边界）
const BJ_OFFSET_MS = 8 * 3600 * 1000;

// 取「北京时间的当前墙上时刻」对应的各字段（用 getUTC* 读出来即是北京时间）
function bjParts(nowMs) {
  const d = new Date(nowMs + BJ_OFFSET_MS);
  return {
    year: d.getUTCFullYear(),
    month: d.getUTCMonth(),
    date: d.getUTCDate(),
    dow: d.getUTCDay() || 7, // 周日(0) → 7
    hour: d.getUTCHours()
  };
}

// 给定北京时间的 (年,月,日)，返回该北京零点对应的真实 UTC 毫秒
function bjMidnightToUtcMs(year, month, date) {
  return Date.UTC(year, month, date) - BJ_OFFSET_MS;
}

// 周期统计
async function getStats({ period = 'today' }) {
  const nowMs = Date.now();
  const bj = bjParts(nowMs);

  // 当前周期起点（按北京时间）
  let sinceMs = null;
  if (period === 'today') {
    sinceMs = bjMidnightToUtcMs(bj.year, bj.month, bj.date);
  } else if (period === 'week') {
    sinceMs = bjMidnightToUtcMs(bj.year, bj.month, bj.date - bj.dow + 1);
  } else if (period === 'month') {
    sinceMs = bjMidnightToUtcMs(bj.year, bj.month, 1);
  }

  // 上期同比：与本期【等长且对齐到当前进度】，避免「整段上期 vs 本期至今」口径不对等
  // today/week 用固定毫秒回退一个周期；month 回退一个日历月
  let prevSinceMs = null;
  let prevUntilMs = null;
  if (sinceMs !== null) {
    if (period === 'today') {
      prevSinceMs = sinceMs - 24 * 3600 * 1000;
      prevUntilMs = nowMs - 24 * 3600 * 1000;
    } else if (period === 'week') {
      prevSinceMs = sinceMs - 7 * 24 * 3600 * 1000;
      prevUntilMs = nowMs - 7 * 24 * 3600 * 1000;
    } else if (period === 'month') {
      // 上月同一日同一时刻（北京时间），月末日溢出由 Date.UTC 自动进位
      const prevMonthSince = bjMidnightToUtcMs(bj.year, bj.month - 1, 1);
      const elapsed = nowMs - sinceMs; // 本月已过去的时长
      prevSinceMs = prevMonthSince;
      prevUntilMs = prevMonthSince + elapsed;
    }
  }

  const since = sinceMs !== null ? new Date(sinceMs) : null;
  const orderWhere = since ? { createdAt: _.gte(since) } : {};
  const prevWhere = prevSinceMs !== null
    ? { createdAt: _.and(_.gte(new Date(prevSinceMs)), _.lt(new Date(prevUntilMs))) }
    : null;

  // 并发拉取
  const [
    usersTotalRes,
    usersNewRes,
    ordersTotalRes,
    ordersRes,
    productsNewRes,
    topViewedRes,
    allWishlists,
    allAddresses,
    prevUsersRes,
    prevOrdersTotalRes,
    prevOrdersDataRes
  ] = await Promise.all([
    db.collection('users').count(),
    since ? db.collection('users').where({ createdAt: _.gte(since) }).count() : Promise.resolve({ total: 0 }),
    db.collection('orders').where(orderWhere).count(),
    db.collection('orders').where(orderWhere).orderBy('createdAt', 'desc').limit(1000).get(),
    since ? db.collection('products').where({ createdAt: _.gte(since) }).count() : Promise.resolve({ total: 0 }),
    db.collection('products').where({ isActive: true }).orderBy('viewCount', 'desc').limit(10).get(),
    fetchAll(db.collection('wishlists'), 5000),
    fetchAll(db.collection('addresses'), 5000),
    prevWhere ? db.collection('users').where(prevWhere).count() : Promise.resolve({ total: 0 }),
    prevWhere ? db.collection('orders').where(prevWhere).count() : Promise.resolve({ total: 0 }),
    prevWhere ? db.collection('orders').where(prevWhere).orderBy('createdAt', 'desc').limit(1000).get() : Promise.resolve({ data: [] })
  ]);

  const usersTotal = usersTotalRes.total || 0;
  const usersNew = since ? (usersNewRes.total || 0) : usersTotal;
  const ordersTotal = ordersTotalRes.total || 0;
  const orders = ordersRes.data || [];
  const productsNew = since ? (productsNewRes.total || 0) : 0;

  // 状态分布
  const byStatus = { pending: 0, processing: 0, done: 0, cancelled: 0 };
  for (const o of orders) {
    if (byStatus[o.status] !== undefined) byStatus[o.status]++;
  }

  // TOP 5 申请
  const productCounts = {};
  for (const o of orders) {
    if (Array.isArray(o.items)) {
      for (const it of o.items) {
        const key = it.productId || it.title;
        if (!key) continue;
        if (!productCounts[key]) {
          productCounts[key] = {
            productId: it.productId || '', title: it.title || '(未命名)',
            imageUrl: it.imageUrl || '', count: 0, cards: 0
          };
        }
        const qty = it.qty || 1;
        productCounts[key].count += qty;
        productCounts[key].cards += (it.cardsNeeded || 0) * qty;
      }
    }
  }
  const topProducts = Object.values(productCounts)
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  const totalCards = orders.reduce((sum, o) => sum + (o.totalCards || 0), 0);

  // 时段分布（周期内订单按北京时间小时）
  const hourly = new Array(24).fill(0);
  for (const o of orders) {
    if (o.createdAt) {
      try {
        const h = new Date(new Date(o.createdAt).getTime() + BJ_OFFSET_MS).getUTCHours();
        if (h >= 0 && h < 24) hourly[h]++;
      } catch {}
    }
  }

  // TOP 10 浏览（累计）
  const topViewed = (topViewedRes.data || []).map(p => ({
    productId: p._id,
    title: p.title || '(未命名)',
    imageUrl: (Array.isArray(p.images) && p.images[0]) || p.imageUrl || '',
    count: Number(p.viewCount) || 0
  }));

  // TOP 10 心愿单（累计）
  const wishCount = {};
  for (const w of allWishlists) {
    if (Array.isArray(w.productIds)) {
      for (const id of w.productIds) {
        if (!id) continue;
        wishCount[id] = (wishCount[id] || 0) + 1;
      }
    }
  }
  const topWishlistIds = Object.entries(wishCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);
  let prodMap = {};
  if (topWishlistIds.length > 0) {
    const ids = topWishlistIds.map(x => x[0]);
    const prodRes = await db.collection('products').where({ _id: _.in(ids) }).limit(50).get();
    prodRes.data.forEach(p => { prodMap[p._id] = p; });
  }
  const topWishlisted = topWishlistIds.map(([id, count]) => {
    const p = prodMap[id];
    return {
      productId: id,
      title: p ? p.title : '(已下架/找不到)',
      imageUrl: p ? ((Array.isArray(p.images) && p.images[0]) || p.imageUrl || '') : '',
      count
    };
  });

  // 地域分布（累计）
  const provCount = {};
  const cityCount = {};
  for (const a of allAddresses) {
    if (a.province) provCount[a.province] = (provCount[a.province] || 0) + 1;
    if (a.province && a.city) {
      const key = `${a.province} ${a.city}`;
      cityCount[key] = (cityCount[key] || 0) + 1;
    }
  }
  const provinces = Object.entries(provCount)
    .sort((a, b) => b[1] - a[1]).slice(0, 5)
    .map(([name, count]) => ({ name, count }));
  const cities = Object.entries(cityCount)
    .sort((a, b) => b[1] - a[1]).slice(0, 10)
    .map(([name, count]) => ({ name, count }));

  // 同比
  let comparison = null;
  if (prevWhere) {
    const prevOrders = (prevOrdersDataRes && prevOrdersDataRes.data) || [];
    const prevCards = prevOrders.reduce((sum, o) => sum + (o.totalCards || 0), 0);
    comparison = {
      users: prevUsersRes.total || 0,
      orders: prevOrdersTotalRes.total || 0,
      cards: prevCards
    };
  }

  return {
    period,
    since: since ? since.toISOString() : null,
    users: { total: usersTotal, newInPeriod: usersNew },
    orders: {
      total: ordersTotal, byStatus, totalCards,
      sampleSize: orders.length
    },
    products: { newInPeriod: productsNew },
    topProducts,
    topViewed,
    topWishlisted,
    addressDistribution: {
      total: allAddresses.length,
      provinces,
      cities
    },
    hourly,
    comparison
  };
}

async function fetchAll(query, limit = 5000) {
  const PAGE = 100;
  let all = [];
  let skip = 0;
  while (skip < limit) {
    const res = await query.skip(skip).limit(PAGE).get();
    all = all.concat(res.data);
    if (res.data.length < PAGE) break;
    skip += PAGE;
  }
  return all;
}

async function updateOrderStatusBulk({ orderIds, status }) {
  if (!Array.isArray(orderIds) || orderIds.length === 0) {
    throw new Error('缺少 orderIds');
  }
  if (orderIds.length > 200) throw new Error('单次最多 200 单');
  if (!ALLOWED_STATUS.includes(status)) throw new Error('非法状态');
  const now = new Date();
  // 并发 20 一批
  const BATCH = 20;
  let updated = 0;
  let failed = 0;
  for (let i = 0; i < orderIds.length; i += BATCH) {
    const slice = orderIds.slice(i, i + BATCH);
    const results = await Promise.allSettled(slice.map(id =>
      db.collection('orders').doc(id).update({
        data: { status, updatedAt: now }
      })
    ));
    results.forEach(r => {
      if (r.status === 'fulfilled') updated++;
      else failed++;
    });
  }
  return { updated, failed, total: orderIds.length };
}

// 「发货通知」订阅消息模板 ID（与小程序端 config.shipNotifyTmplId 同一个）
const SHIP_NOTIFY_TMPL_ID = 'ogImsJ3zh8t9wc_AX2gPzLCPqsfTmqH9JqbwLhGlUWQ';

// 推送发货提醒（订阅消息）。失败不影响录单号主流程。
// 模板字段：thing1=快递公司 thing11=商品名称 character_string5=快递单号 thing2=订单名称 thing7=备注
async function sendShipNotify(order, trackingNo, trackingCompany) {
  if (!SHIP_NOTIFY_TMPL_ID) return;
  if (!order || !order._openid) return;
  const items = Array.isArray(order.items) ? order.items : [];
  const itemTitle = (items[0] && items[0].title) || '礼品';
  const orderName = items.length > 1
    ? `${itemTitle.slice(0, 12)}等${items.length}件`
    : itemTitle.slice(0, 20);
  try {
    await cloud.openapi.subscribeMessage.send({
      touser: order._openid,
      templateId: SHIP_NOTIFY_TMPL_ID,
      page: `pages/order-detail/order-detail?id=${order._id}`,
      miniprogramState: 'formal',
      lang: 'zh_CN',
      data: {
        thing1: { value: (trackingCompany || '快递').slice(0, 20) },   // 快递公司
        thing11: { value: itemTitle.slice(0, 20) },                    // 商品名称
        character_string5: { value: (trackingNo || '').slice(0, 32) }, // 快递单号
        thing2: { value: orderName },                                  // 订单名称
        thing7: { value: '已发货，请留意物流信息' }                      // 备注
      }
    });
  } catch (err) {
    console.warn('[admin-orders] sendShipNotify failed', err);
  }
}

// 更新快递信息
async function updateTracking({ orderId, trackingNo, trackingCompany }) {
  if (!orderId) throw new Error('缺少 orderId');
  const patch = {
    trackingNo: String(trackingNo || '').trim().slice(0, 50),
    trackingCompany: String(trackingCompany || '').trim().slice(0, 30),
    updatedAt: new Date()
  };
  await db.collection('orders').doc(orderId).update({ data: patch });
  const r = await db.collection('orders').doc(orderId).get();
  // 录入单号后推送发货提醒（仅当填了单号）
  if (patch.trackingNo) {
    await sendShipNotify(r.data, patch.trackingNo, patch.trackingCompany);
  }
  return r.data;
}

// 分类显示顺序（存 app_config 集合，key=category_order）
async function getCategoryOrder() {
  const r = await db.collection('app_config').where({ key: 'category_order' }).limit(1).get();
  return { order: (r.data[0] && r.data[0].order) || [] };
}

async function saveCategoryOrder({ order }) {
  if (!Array.isArray(order)) throw new Error('order 必须是数组');
  const clean = order.map(String).slice(0, 100);
  const now = new Date();
  const existing = await db.collection('app_config').where({ key: 'category_order' }).limit(1).get();
  if (existing.data[0]) {
    await db.collection('app_config').doc(existing.data[0]._id).update({ data: { order: clean, updatedAt: now } });
  } else {
    await db.collection('app_config').add({ data: { key: 'category_order', order: clean, createdAt: now, updatedAt: now } });
  }
  return { order: clean };
}

// 首页海报（存 app_config 集合，key=home_banners）
async function getHomeBanners() {
  const r = await db.collection('app_config').where({ key: 'home_banners' }).limit(1).get();
  return { banners: (r.data[0] && r.data[0].banners) || [] };
}

async function saveHomeBanners({ banners }) {
  if (!Array.isArray(banners)) throw new Error('banners 必须是数组');
  const ALLOWED_LINK = ['none', 'tab', 'page', 'product', 'url'];
  const clean = banners.slice(0, 20).map((b) => {
    b = b || {};
    let linkType = String(b.linkType || 'none');
    if (ALLOWED_LINK.indexOf(linkType) < 0) linkType = 'none';
    return {
      imageUrl: String(b.imageUrl || '').slice(0, 500),
      linkType: linkType,
      linkValue: String(b.linkValue || '').slice(0, 200),
      title: String(b.title || '').slice(0, 50)
    };
  }).filter((b) => b.imageUrl); // 丢弃没图的空槽
  const now = new Date();
  const existing = await db.collection('app_config').where({ key: 'home_banners' }).limit(1).get();
  if (existing.data[0]) {
    await db.collection('app_config').doc(existing.data[0]._id).update({ data: { banners: clean, updatedAt: now } });
  } else {
    await db.collection('app_config').add({ data: { key: 'home_banners', banners: clean, createdAt: now, updatedAt: now } });
  }
  return { banners: clean };
}

// 商家内部备注（客户端不可见）
async function updateNote({ orderId, adminNote }) {
  if (!orderId) throw new Error('缺少 orderId');
  await db.collection('orders').doc(orderId).update({
    data: { adminNote: String(adminNote || '').slice(0, 1000), updatedAt: new Date() }
  });
  return { orderId };
}

// ---------- 晒图审核 ----------

async function listReviews({ status = 'pending', limit = 50, skip = 0 }) {
  const where = {};
  if (status && status !== 'all') where.status = status;

  const res = await db.collection('reviews')
    .where(where)
    .orderBy('createdAt', 'desc')
    .skip(Number(skip) || 0)
    .limit(Math.min(Number(limit) || 50, 100))
    .get();
  const countRes = await db.collection('reviews').where(where).count();

  // 云存储 fileID → 临时 https（admin 网页看图）
  const fileIDs = [];
  res.data.forEach(r => { if (Array.isArray(r.images)) fileIDs.push(...r.images); });
  const urlMap = {};
  if (fileIDs.length) {
    try {
      const t = await cloud.getTempFileURL({ fileList: fileIDs.slice(0, 200) });
      (t.fileList || []).forEach(f => {
        if (f.fileID && f.tempFileURL) urlMap[f.fileID] = f.tempFileURL;
      });
    } catch (err) {
      console.warn('[admin-orders] getTempFileURL failed', err);
    }
  }
  const items = res.data.map(r => ({
    ...r,
    imageUrls: (Array.isArray(r.images) ? r.images : []).map(id => urlMap[id] || '')
  }));
  return { items, total: countRes.total || 0 };
}

async function reviewStatus({ reviewId, status }) {
  if (!reviewId) throw new Error('缺少 reviewId');
  if (!['approved', 'rejected', 'pending'].includes(status)) throw new Error('非法状态');
  await db.collection('reviews').doc(reviewId).update({
    data: { status, updatedAt: new Date() }
  });
  return { reviewId, status };
}

// ---------- Entry ----------

function buildResponse(statusCode, payload) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Authorization, Content-Type',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Max-Age': '86400'
    },
    body: JSON.stringify(payload)
  };
}

exports.main = async (event) => {
  // CORS preflight
  if ((event.httpMethod || '').toUpperCase() === 'OPTIONS') {
    return buildResponse(204, {});
  }

  // 解析 body
  let body = {};
  try {
    if (event.body) {
      body = typeof event.body === 'string' ? JSON.parse(event.body) : event.body;
    } else if (event.action) {
      // 也支持直接传 action（云函数测试 / 非 HTTP 调用）
      body = event;
    }
  } catch (err) {
    return buildResponse(400, { ok: false, error: '请求体解析失败' });
  }

  // 取 token
  const headers = event.headers || {};
  const authHeader = headers.Authorization || headers.authorization || '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();

  try {
    const adminEmail = await verifyAdmin(token);
    let data;
    switch (body.action) {
      case 'list':
        data = await listOrders(body);
        break;
      case 'get':
        data = await getOrder(body);
        break;
      case 'update-status':
        data = await updateOrderStatus(body);
        break;
      case 'update-status-bulk':
        data = await updateOrderStatusBulk(body);
        break;
      case 'update-tracking':
        data = await updateTracking(body);
        break;
      case 'update-note':
        data = await updateNote(body);
        break;
      case 'get-category-order':
        data = await getCategoryOrder(body);
        break;
      case 'save-category-order':
        data = await saveCategoryOrder(body);
        break;
      case 'get-home-banners':
        data = await getHomeBanners(body);
        break;
      case 'save-home-banners':
        data = await saveHomeBanners(body);
        break;
      case 'stats':
        data = await getStats(body);
        break;
      case 'list-reviews':
        data = await listReviews(body);
        break;
      case 'review-status':
        data = await reviewStatus(body);
        break;
      default:
        return buildResponse(400, { ok: false, error: '未知 action' });
    }
    return buildResponse(200, { ok: true, data, adminEmail });
  } catch (err) {
    console.error('[admin-orders]', body.action, err);
    return buildResponse(err.message === '未登录' || /过期|管理员/.test(err.message) ? 401 : 500, {
      ok: false,
      error: err.message
    });
  }
};
