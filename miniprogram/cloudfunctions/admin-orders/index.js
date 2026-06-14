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
const crypto = require('crypto');
const { URL } = require('url');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();
const _ = db.command;

const SUPABASE_URL = 'https://ukoqffocqjokcroilyyv.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVrb3FmZm9jcWpva2Nyb2lseXl2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUzMzMxMDUsImV4cCI6MjA5MDkwOTEwNX0.jKFzbuDLbbDboUD8vJLAu0uTkkEzE2YnC2bHU5I8RH0';

// 快递100 物流（凭据走环境变量，绝不写进代码——仓库公开）。
// 控制台「云函数 → admin-orders → 配置 → 环境变量」里填：
//   KUAIDI100_KEY          授权 key
//   KUAIDI100_CALLBACK_URL admin-orders 自身的 HTTP 触发器地址（快递100 物流更新回调到这里）
const KD_KEY = process.env.KUAIDI100_KEY || '';
const KD_CUSTOMER = process.env.KUAIDI100_CUSTOMER || '';   // 实时查询用（订阅推送不需要）
const KD_CALLBACK = process.env.KUAIDI100_CALLBACK_URL || '';
const KD_SUBSCRIBE_URL = 'https://poll.kuaidi100.com/poll';
const KD_QUERY_URL = 'https://poll.kuaidi100.com/poll/query.do';

// 订单状态机：待发货(pending) → 运输中(shipped) → 已签收(signed)（＋已取消 cancelled）
// pending 即「待发货」(下单创建的初始态)；旧码兼容：processing/preparing→pending、done→shipped、closed→signed。
const ALLOWED_STATUS = ['pending', 'shipped', 'signed', 'cancelled'];
const STATUS_LEGACY = { processing: 'pending', preparing: 'pending', done: 'shipped', closed: 'signed' };
// 任意（含历史）状态码 → 新码
function normStatus(s) { return STATUS_LEGACY[s] || s || 'pending'; }
// 某新状态在库里对应的所有码（查询用，吸收历史单）
function statusQueryCodes(s) {
  if (s === 'pending') return ['pending', 'processing', 'preparing'];
  if (s === 'shipped') return ['shipped', 'done'];
  if (s === 'signed') return ['signed', 'closed'];
  return [s];
}

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

// 二进制下载（图片字节）
function httpsGetBuffer(urlString) {
  return new Promise((resolve, reject) => {
    const u = new URL(urlString);
    https.get({ hostname: u.hostname, port: u.port || 443, path: u.pathname + u.search }, (res) => {
      if (res.statusCode >= 300) { res.resume(); reject(new Error('下载失败 ' + res.statusCode)); return; }
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks)));
    }).on('error', reject);
  });
}

// 上传字节到 Supabase Storage（用管理员 JWT，桶 product-images）
function uploadToSupabaseStorage(objectPath, buffer, contentType, token) {
  return new Promise((resolve, reject) => {
    const u = new URL(`${SUPABASE_URL}/storage/v1/object/${objectPath}`);
    const req = https.request({
      method: 'POST',
      hostname: u.hostname, port: 443, path: u.pathname + u.search,
      headers: {
        Authorization: `Bearer ${token}`,
        apikey: SUPABASE_ANON_KEY,
        'Content-Type': contentType,
        'Content-Length': buffer.length,
        'x-upsert': 'true'
      }
    }, (res) => {
      let data = ''; res.on('data', (c) => { data += c; });
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) resolve(true);
        else reject(new Error('Storage 上传失败 ' + res.statusCode + ' ' + data));
      });
    });
    req.on('error', reject); req.write(buffer); req.end();
  });
}

// 昵称打码（与小程序 db.js maskNick 一致）
function maskNick(name) {
  name = String(name || '').trim();
  if (!name) return '微信用户';
  const chars = Array.from(name);
  if (chars.length <= 1) return chars[0] || '微信用户';
  if (chars.length === 2) return chars[0] + '*';
  const stars = '*'.repeat(Math.min(chars.length - 2, 4));
  return chars[0] + stars + chars[chars.length - 1];
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
  // 按新状态筛选，自动吸收历史码（done/closed/processing）
  if (status && (ALLOWED_STATUS.includes(status) || STATUS_LEGACY[status])) {
    const codes = statusQueryCodes(normStatus(status));
    where.status = codes.length > 1 ? _.in(codes) : codes[0];
  }

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
  const next = normStatus(status);
  if (!ALLOWED_STATUS.includes(next)) throw new Error('非法状态');
  const curRes = await db.collection('orders').doc(orderId).get();
  const cur = (curRes && curRes.data) || {};
  const patch = { status: next, updatedAt: new Date() };
  // 进入「已签收」且尚无签收时间 → 盖手动签收时间（快递接口自动签收会另填，不覆盖）
  if (next === 'signed' && !cur.signedAt) patch.signedAt = new Date();
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
    prevUsersRes,
    prevOrdersTotalRes,
    prevOrdersDataRes
  ] = await Promise.all([
    db.collection('users').count(),
    since ? db.collection('users').where({ createdAt: _.gte(since) }).count() : Promise.resolve({ total: 0 }),
    db.collection('orders').where(orderWhere).count(),
    db.collection('orders').where(orderWhere).orderBy('createdAt', 'desc').limit(1000).get(),
    // 商品 createdAt 是同步自 Supabase 的 ISO 字符串（非 Date），用 ISO 字符串比较（ISO 8601 字符串序=时间序）
    since ? db.collection('products').where({ createdAt: _.gte(since.toISOString()) }).count() : Promise.resolve({ total: 0 }),
    db.collection('products').where({ isActive: true }).orderBy('viewCount', 'desc').limit(10).get(),
    fetchAll(db.collection('wishlists'), 5000),
    prevWhere ? db.collection('users').where(prevWhere).count() : Promise.resolve({ total: 0 }),
    prevWhere ? db.collection('orders').where(prevWhere).count() : Promise.resolve({ total: 0 }),
    prevWhere ? db.collection('orders').where(prevWhere).orderBy('createdAt', 'desc').limit(1000).get() : Promise.resolve({ data: [] })
  ]);

  const usersTotal = usersTotalRes.total || 0;
  const usersNew = since ? (usersNewRes.total || 0) : usersTotal;
  const ordersTotal = ordersTotalRes.total || 0;
  const orders = ordersRes.data || [];
  const productsNew = since ? (productsNewRes.total || 0) : 0;

  // 状态分布（历史码归一：processing→pending、done→shipped、closed→signed）
  const byStatus = { pending: 0, shipped: 0, signed: 0, cancelled: 0 };
  for (const o of orders) {
    const k = normStatus(o.status);
    if (byStatus[k] !== undefined) byStatus[k]++;
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

  // 地域分布（按周期内订单的收货地址快照统计，与订单口径一致；删订单即随之减少）
  const provCount = {};
  const cityCount = {};
  let geoTotal = 0;
  for (const o of orders) {
    const a = o.address || {};
    if (!a.province) continue;
    provCount[a.province] = (provCount[a.province] || 0) + 1;
    geoTotal += 1;
    if (a.city) {
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
      total: geoTotal,
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
  const next = normStatus(status);
  if (!ALLOWED_STATUS.includes(next)) throw new Error('非法状态');
  const now = new Date();
  const bulkData = { status: next, updatedAt: now };
  if (next === 'signed') bulkData.signedAt = now; // 批量改已签收时盖签收时间
  // 并发 20 一批
  const BATCH = 20;
  let updated = 0;
  let failed = 0;
  for (let i = 0; i < orderIds.length; i += BATCH) {
    const slice = orderIds.slice(i, i + BATCH);
    const results = await Promise.allSettled(slice.map(id =>
      db.collection('orders').doc(id).update({
        data: bulkData
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

// 向快递100 订阅该单号的物流推送：物流有更新会回调 KD_CALLBACK。best-effort，失败不影响发货。
async function subscribeLogistics({ com, num, phone }) {
  if (!KD_KEY || !KD_CALLBACK) {
    console.warn('[kd100] 未配置 KUAIDI100_KEY / KUAIDI100_CALLBACK_URL，跳过订阅');
    return { skipped: true };
  }
  if (!com || !num) return { skipped: true };
  const paramObj = {
    company: com,
    number: num,
    key: KD_KEY,
    parameters: { callbackurl: KD_CALLBACK, resultv2: '1', autoCom: '0' }
  };
  if (phone) paramObj.parameters.phone = String(phone);
  const form = 'schema=json&param=' + encodeURIComponent(JSON.stringify(paramObj));
  try {
    const res = await httpsReq(KD_SUBSCRIBE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(form)
      },
      body: form
    });
    let parsed = {};
    try { parsed = JSON.parse(res.body); } catch (e) {}
    console.log('[kd100] subscribe', num, res.status, res.body);
    return parsed;
  } catch (err) {
    console.warn('[kd100] subscribe failed', err);
    return { error: String(err) };
  }
}

// 从签收节点文案尽力提取签收人
function extractSignedBy(ctx) {
  if (!ctx) return '';
  const m = ctx.match(/签收人[:：]?\s*([^\s，,。]+)/);
  if (m) return m[1];
  if (/驿站|代收|代签|快递柜|菜鸟|丰巢/.test(ctx)) return '代收';
  if (/本人/.test(ctx)) return '本人签收';
  return '';
}

// 把快递100 的 data 数组 + state 落成订单 patch（推送/实时查询共用）。
function buildLogisticsPatch(order, dataArr, stateRaw) {
  const nodes = Array.isArray(dataArr)
    ? dataArr.map(d => ({ time: d.ftime || d.time || '', context: d.context || '', status: d.status || '' }))
    : [];
  const state = String(stateRaw || '');
  const patch = { logisticsNodes: nodes, logisticsState: state, updatedAt: new Date() };
  if (state === '3' && order.status !== 'cancelled' && order.status !== 'signed') {
    patch.status = 'signed';
    if (!order.signedAt) patch.signedAt = new Date();
    const by = extractSignedBy(nodes[0] && nodes[0].context);
    if (by) patch.signedBy = by;
  }
  return patch;
}

// 快递100 物流推送回调处理：按单号匹配订单，写物流节点；签收(state=3)自动置「已签收」。
// 返回快递100 约定的应答体，否则会被反复重推。
async function handleLogisticsPush(param) {
  const lr = param && param.lastResult;
  if (!lr || !lr.nu) return { result: false, returnCode: '500', message: '缺少单号' };
  const num = String(lr.nu);
  let order = null;
  try {
    const r = await db.collection('orders').where({ trackingNo: num }).limit(1).get();
    order = r.data && r.data[0];
  } catch (e) {
    console.warn('[kd100] push find order failed', e);
  }
  // 找不到对应订单也回 200，避免快递100 不断重推
  if (!order) return { result: true, returnCode: '200', message: '无对应订单' };

  const patch = buildLogisticsPatch(order, lr.data, lr.state);
  try {
    await db.collection('orders').doc(order._id).update({ data: patch });
  } catch (e) {
    console.error('[kd100] push update failed', e);
    return { result: false, returnCode: '500', message: '写入失败' };
  }
  return { result: true, returnCode: '200', message: '成功' };
}

// 实时查询：主动拉一次当前完整轨迹（适合老单/手动刷新；订阅只推未来变化）。
async function queryLogistics({ orderId }) {
  if (!orderId) throw new Error('缺少 orderId');
  if (!KD_KEY || !KD_CUSTOMER) throw new Error('未配置快递100 凭据（KUAIDI100_KEY / KUAIDI100_CUSTOMER）');
  const r = await db.collection('orders').doc(orderId).get();
  const o = r.data;
  if (!o) throw new Error('订单不存在');
  if (!o.trackingNo) throw new Error('该订单还没有快递单号');
  if (!o.courierCode) throw new Error('未识别快递公司：请在「快递公司」框填写后重新保存单号，再查询');

  const paramObj = { com: o.courierCode, num: o.trackingNo, resultv2: '1' };
  const phone = (o.address && o.address.phone) || '';
  if (phone) paramObj.phone = String(phone);
  const param = JSON.stringify(paramObj);
  const sign = crypto.createHash('md5').update(param + KD_KEY + KD_CUSTOMER).digest('hex').toUpperCase();
  const form = 'customer=' + encodeURIComponent(KD_CUSTOMER) + '&sign=' + sign + '&param=' + encodeURIComponent(param);

  let parsed = {};
  try {
    const res = await httpsReq(KD_QUERY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(form) },
      body: form
    });
    console.log('[kd100] query', o.trackingNo, res.status, res.body);
    try { parsed = JSON.parse(res.body); } catch (e) {}
  } catch (err) {
    throw new Error('查询请求失败：' + String(err).slice(0, 100));
  }
  // 成功返回含 data 数组；失败返回 {result:false, message, returnCode}
  if (!Array.isArray(parsed.data) || parsed.data.length === 0) {
    const msg = parsed.message || parsed.returnCode || '快递100 暂无轨迹';
    throw new Error('查询无结果：' + String(msg).slice(0, 120));
  }
  const patch = buildLogisticsPatch(o, parsed.data, parsed.state);
  await db.collection('orders').doc(orderId).update({ data: patch });
  const r2 = await db.collection('orders').doc(orderId).get();
  return r2.data;
}

// 更新快递信息：填了单号 = 发货 → 自动置「运输中」(shipped) + 推送（已取消的不动）
// courierCode = 快递公司标准编码（快递100，用于订阅物流）；trackingCompany = 展示名
async function updateTracking({ orderId, trackingNo, trackingCompany, courierCode }) {
  if (!orderId) throw new Error('缺少 orderId');
  const trimmedNo = String(trackingNo || '').trim().slice(0, 50);
  const patch = {
    trackingNo: trimmedNo,
    trackingCompany: String(trackingCompany || '').trim().slice(0, 30),
    courierCode: String(courierCode || '').trim().slice(0, 30),
    updatedAt: new Date()
  };
  if (trimmedNo) {
    const cur = await db.collection('orders').doc(orderId).get();
    if (cur.data && cur.data.status !== 'cancelled') patch.status = 'shipped';
  }
  await db.collection('orders').doc(orderId).update({ data: patch });
  const r = await db.collection('orders').doc(orderId).get();
  // 录入单号后推送发货提醒（仅当填了单号）
  if (patch.trackingNo) {
    await sendShipNotify(r.data, patch.trackingNo, patch.trackingCompany);
  }
  // 发货 + 有快递公司编码 → 向快递100 订阅物流推送（best-effort，失败不影响发货）
  if (patch.status === 'shipped' && patch.courierCode && patch.trackingNo) {
    const phone = (r.data && r.data.address && r.data.address.phone) || '';
    await subscribeLogistics({ com: patch.courierCode, num: patch.trackingNo, phone });
  }
  return { ...r.data, _autoDone: patch.status === 'shipped' };
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

// 首页「按积分快速兑换」每个档位显示的银行名（存 app_config，key=cards_bank_labels）
// 档位 key 与全部礼品页积分筛选一致；value 为展示用银行名（可空）。
const CARDS_BANK_KEYS = ['6', '7', '8', '9-10', '11+'];
const CARDS_BANK_DEFAULT = { '6': '交通银行', '7': '浦发银行', '8': '平安/中信银行', '9-10': '', '11+': '全' };

function normalizeBankLabels(input) {
  const src = (input && typeof input === 'object') ? input : {};
  const out = {};
  CARDS_BANK_KEYS.forEach((k) => {
    const v = src[k];
    out[k] = (v == null ? '' : String(v)).trim().slice(0, 30);
  });
  return out;
}

async function getCardsBankLabels() {
  const r = await db.collection('app_config').where({ key: 'cards_bank_labels' }).limit(1).get();
  const saved = r.data[0] && r.data[0].labels;
  // 未配置过 → 给默认；配置过 → 以保存值为准（含被清空的项）
  const labels = saved ? normalizeBankLabels(saved) : Object.assign({}, CARDS_BANK_DEFAULT);
  return { labels };
}

async function saveCardsBankLabels({ labels }) {
  const clean = normalizeBankLabels(labels);
  const now = new Date();
  const existing = await db.collection('app_config').where({ key: 'cards_bank_labels' }).limit(1).get();
  if (existing.data[0]) {
    await db.collection('app_config').doc(existing.data[0]._id).update({ data: { labels: clean, updatedAt: now } });
  } else {
    await db.collection('app_config').add({ data: { key: 'cards_bank_labels', labels: clean, createdAt: now, updatedAt: now } });
  }
  return { labels: clean };
}

// 商家内部备注（客户端不可见）
async function updateNote({ orderId, adminNote }) {
  if (!orderId) throw new Error('缺少 orderId');
  await db.collection('orders').doc(orderId).update({
    data: { adminNote: String(adminNote || '').slice(0, 1000), updatedAt: new Date() }
  });
  return { orderId };
}

// 硬删除订单（真删文档，用于清理测试单）。删除后数据看板因实时查询会自动同步。
async function deleteOrder({ orderId }) {
  if (!orderId) throw new Error('缺少 orderId');
  await db.collection('orders').doc(orderId).remove();
  return { deleted: true, orderId };
}

// 批量硬删除订单
async function deleteOrdersBulk({ orderIds }) {
  if (!Array.isArray(orderIds) || orderIds.length === 0) throw new Error('缺少 orderIds');
  let deleted = 0;
  let failed = 0;
  for (const id of orderIds) {
    try {
      await db.collection('orders').doc(id).remove();
      deleted += 1;
    } catch (err) {
      failed += 1;
    }
  }
  return { deleted, failed, total: orderIds.length };
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

// 把一条晒图镜像到 Supabase reviews 表（供 H5 晒图广场直读）：
// 图片从云存储转存到 Supabase Storage 拿稳定公网 URL，昵称打码后写入。
async function mirrorReviewToSupabase(review, token) {
  if (!token || !review || !review._id) return;
  const fileIDs = (Array.isArray(review.images) ? review.images : []).slice(0, 9);
  const publicUrls = [];
  if (fileIDs.length) {
    const t = await cloud.getTempFileURL({ fileList: fileIDs });
    const map = {};
    (t.fileList || []).forEach((f) => { if (f.fileID && f.tempFileURL) map[f.fileID] = f.tempFileURL; });
    for (let i = 0; i < fileIDs.length; i += 1) {
      const temp = map[fileIDs[i]];
      if (!temp) continue;
      try {
        const buf = await httpsGetBuffer(temp);
        let ext = (String(fileIDs[i]).split('?')[0].split('.').pop() || 'jpg').toLowerCase();
        if (['jpg', 'jpeg', 'png', 'webp'].indexOf(ext) < 0) ext = 'jpg';
        const objectPath = `product-images/reviews/${review._id}-${i}.${ext}`;
        await uploadToSupabaseStorage(objectPath, buf, 'image/' + (ext === 'jpg' ? 'jpeg' : ext), token);
        publicUrls.push(`${SUPABASE_URL}/storage/v1/object/public/${objectPath}`);
      } catch (e) {
        console.warn('[mirror] 图片转存失败', e.message);
      }
    }
  }
  const row = {
    id: review._id,
    nick_masked: maskNick(review.nickName),
    rating: Number(review.rating) || 0,
    content: String(review.content || '').slice(0, 500),
    images: publicUrls,
    product_id: review.productId || '',
    product_title: review.productTitle || '',
    created_at: review.createdAt ? new Date(review.createdAt).toISOString() : new Date().toISOString()
  };
  const res = await httpsReq(`${SUPABASE_URL}/rest/v1/reviews`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates,return=minimal'
    },
    body: JSON.stringify(row)
  });
  if (res.status >= 300) throw new Error('镜像 reviews 失败 ' + res.status + ' ' + res.body);
}

async function deleteSupabaseReview(reviewId, token) {
  if (!token || !reviewId) return;
  await httpsReq(`${SUPABASE_URL}/rest/v1/reviews?id=eq.${encodeURIComponent(reviewId)}`, {
    method: 'DELETE',
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}`, Prefer: 'return=minimal' }
  });
}

async function reviewStatus({ reviewId, status }, token) {
  if (!reviewId) throw new Error('缺少 reviewId');
  if (!['approved', 'rejected', 'pending'].includes(status)) throw new Error('非法状态');
  await db.collection('reviews').doc(reviewId).update({
    data: { status, updatedAt: new Date() }
  });
  // 镜像到 Supabase 供 H5 读取：通过→镜像；拒绝/撤回→删镜像。失败不阻断审核（仅日志）。
  try {
    if (status === 'approved') {
      const doc = await db.collection('reviews').doc(reviewId).get();
      if (doc && doc.data) await mirrorReviewToSupabase(doc.data, token);
    } else {
      await deleteSupabaseReview(reviewId, token);
    }
  } catch (e) {
    console.warn('[admin-orders] 镜像 Supabase 失败', e.message);
  }
  return { reviewId, status };
}

// 网页端公开下单：无微信登录，写入云开发 orders（source='web'），商家在同一后台「订单管理」核对。
// 不收款，仅领取登记；做基本校验 + 商品快照（按 supabaseId 校正标题/积分）。
// 网页订单商品组合签名（supabaseId×数量，排序拼接）——用于防重复下单
function webOrderSig(snaps) {
  return (Array.isArray(snaps) ? snaps : [])
    .map(s => String(s.supabaseId || s.productId || '') + 'x' + (Number(s.qty) || 1))
    .sort()
    .join('|');
}

// 网页下单带了推荐码 → 自动建一条「待审核」推荐记录（同推荐人+同手机号只建一次）
async function maybeCreateWebReferral(referrerCode, phone, nick) {
  const code = String(referrerCode || '').trim();
  if (!/^\d{6}$/.test(code) || !/^1\d{10}$/.test(String(phone || ''))) return;
  try {
    const ur = await db.collection('users').where({ referralCode: code }).limit(1).get();
    const referrer = ur.data[0];
    if (!referrer) return;
    const dup = await db.collection('referrals').where({ referrerOpenid: referrer.openid, refereePhone: phone }).count();
    if (dup.total > 0) return;
    const now = new Date();
    await db.collection('referrals').add({ data: {
      referrerOpenid: referrer.openid,
      referrerCode: code,
      refereeOpenid: '',
      refereeNick: nick || '网页客户',
      refereePhone: phone,
      status: '待审核',
      rewardPoints: 0,
      createdAt: now,
      openedAt: null,
      rewardedAt: null,
      source: 'web'
    }});
  } catch (e) {
    console.warn('[admin-orders] maybeCreateWebReferral', e);
  }
}

async function webSubmitOrder({ items, address, remark, referrerCode }) {
  const list = Array.isArray(items) ? items : [];
  if (list.length === 0) throw new Error('心愿单为空');
  if (list.length > 50) throw new Error('商品过多');
  const addr = address || {};
  const recipient = String(addr.recipient || '').trim();
  const phone = String(addr.phone || '').trim();
  if (!recipient) throw new Error('请填写收件人姓名');
  if (!/^1\d{10}$/.test(phone)) throw new Error('手机号格式不正确');
  if (!String(addr.province || '').trim() || !String(addr.city || '').trim()) throw new Error('请填写所在省 / 市');
  if (!String(addr.detail || '').trim()) throw new Error('请填写详细地址');

  // 商品快照：优先用云开发 products（按 supabaseId 匹配）校正标题/积分，找不到则用前端传值
  const ids = Array.from(new Set(list.map(it => String((it && (it.supabaseId || it.id)) || '')).filter(Boolean)));
  const map = {};
  if (ids.length) {
    try {
      const r = await db.collection('products').where({ supabaseId: _.in(ids) }).limit(50).get();
      r.data.forEach(p => { if (p.supabaseId) map[String(p.supabaseId)] = p; });
    } catch (e) { /* 匹配失败则用前端值 */ }
  }
  const itemSnapshots = [];
  let totalCards = 0;
  for (const it of list) {
    const key = String((it && (it.supabaseId || it.id)) || '');
    const p = map[key];
    const cards = Number(p && p.cardsNeeded != null ? p.cardsNeeded : (it && it.cardsNeeded)) || 0;
    const qty = Math.max(1, Math.min(99, Number(it && it.qty) || 1));
    itemSnapshots.push({
      productId: (p && p._id) || '',
      supabaseId: key,
      title: String((p && p.title) || (it && it.title) || '礼品').slice(0, 60),
      imageUrl: String((p && ((Array.isArray(p.images) && p.images[0]) || p.imageUrl)) || (it && it.imageUrl) || '').slice(0, 500),
      cardsNeeded: cards,
      price: Number(p && p.price != null ? p.price : (it && it.price)) || 0,
      qty
    });
    totalCards += cards * qty;
  }

  // 防重复：同一手机号 30s 内提交「完全相同的商品组合」→ 视为连点，返回原单（幂等）
  try {
    const dedupSince = new Date(Date.now() - 30 * 1000);
    const recentRes = await db.collection('orders')
      .where({ source: 'web', 'address.phone': phone, createdAt: _.gt(dedupSince) })
      .orderBy('createdAt', 'desc')
      .limit(5)
      .get();
    const sig = webOrderSig(itemSnapshots);
    const dup = (recentRes.data || []).find(o => webOrderSig(o.items) === sig);
    if (dup) return { success: true, orderId: dup._id, duplicated: true };
  } catch (e) { /* 去重查询失败不阻断正常下单 */ }

  const now = new Date();
  const order = {
    openid: '',
    source: 'web',
    items: itemSnapshots,
    address: {
      recipient: recipient.slice(0, 40),
      phone,
      province: String(addr.province).trim().slice(0, 40),
      city: String(addr.city).trim().slice(0, 40),
      district: String(addr.district || '').trim().slice(0, 40),
      detail: String(addr.detail).trim().slice(0, 200)
    },
    remark: String(remark || '').trim().slice(0, 500),
    totalCards,
    itemCount: itemSnapshots.length,
    status: 'pending',
    createdAt: now,
    updatedAt: now
  };
  const add = await db.collection('orders').add({ data: order });
  // 推荐归属：网页下单带了推荐码则建推荐记录（不阻断下单主流程）
  await maybeCreateWebReferral(referrerCode, phone, recipient);
  return { success: true, orderId: add._id };
}

// ---------- 推荐系统 CRM（管理员）----------
const REFERRALS = 'referrals';
const USERS = 'users';
const LEDGER = 'points_ledger';
const REF_STATUS = ['待审核', '已加微信', '办卡中', '开户成功', '无效'];
const REF_OPENED = '开户成功';

async function referralList(body) {
  const status = body.status;
  const keyword = String(body.keyword || '').trim();
  const where = {};
  if (status && REF_STATUS.includes(status)) where.status = status;
  let rows = [];
  try {
    const res = await db.collection(REFERRALS).where(where).orderBy('createdAt', 'desc').limit(200).get();
    rows = res.data || [];
  } catch (e) { rows = []; } // referrals 集合未建/为空容错
  if (keyword) {
    const k = keyword.toLowerCase();
    rows = rows.filter(r =>
      String(r.refereePhone || '').includes(keyword) ||
      String(r.refereeNick || '').toLowerCase().includes(k) ||
      String(r.referrerCode || '').includes(keyword)
    );
  }
  const openids = Array.from(new Set(rows.map(r => r.referrerOpenid).filter(Boolean)));
  const nickMap = {};
  if (openids.length) {
    const ur = await db.collection(USERS).where({ openid: _.in(openids) }).limit(200).get();
    ur.data.forEach(u => { nickMap[u.openid] = { nick: u.nickName, code: u.referralCode }; });
  }
  return rows.map(r => ({
    _id: r._id,
    referrerCode: r.referrerCode || (nickMap[r.referrerOpenid] && nickMap[r.referrerOpenid].code) || '',
    referrerNick: (nickMap[r.referrerOpenid] && nickMap[r.referrerOpenid].nick) || '',
    refereeNick: r.refereeNick || '',
    refereePhone: r.refereePhone || '',
    status: r.status || '待审核',
    rewardPoints: r.rewardPoints || 0,
    createdAt: r.createdAt,
    openedAt: r.openedAt || null,
    rewardedAt: r.rewardedAt || null
  }));
}

async function referralAdd(body) {
  const phone = String(body.phone || '').trim();
  const nick = String(body.nick || '').trim();
  const code = String(body.referrerCode || '').trim();
  if (!/^1\d{10}$/.test(phone)) throw new Error('手机号格式不正确');
  if (!code) throw new Error('请填写推荐码');
  const ur = await db.collection(USERS).where({ referralCode: code }).limit(1).get();
  const referrer = ur.data[0];
  if (!referrer) throw new Error('推荐码不存在');
  const dup = await db.collection(REFERRALS).where({ referrerOpenid: referrer.openid, refereePhone: phone }).count();
  if (dup.total > 0) throw new Error('该手机号已在此推荐人名下');
  const now = new Date();
  const add = await db.collection(REFERRALS).add({ data: {
    referrerOpenid: referrer.openid,
    referrerCode: code,
    refereeOpenid: '',
    refereeNick: nick || '客户',
    refereePhone: phone,
    status: '已加微信',
    rewardPoints: 0,
    createdAt: now,
    openedAt: null,
    rewardedAt: null,
    source: 'admin'
  }});
  return { _id: add._id };
}

async function referralSetStatus(body) {
  const id = body.id;
  const status = body.status;
  if (!id) throw new Error('缺少 id');
  if (!REF_STATUS.includes(status)) throw new Error('状态不合法');
  const cur = await db.collection(REFERRALS).doc(id).get();
  const rec = cur.data;
  if (!rec) throw new Error('记录不存在');
  const now = new Date();
  const patch = { status, updatedAt: now };

  // 开户成功 → 发奖励积分（幂等：rewardedAt 已有则不重复发）
  if (status === REF_OPENED && !rec.rewardedAt) {
    const reward = Math.max(0, Number(body.rewardPoints != null ? body.rewardPoints : 1) || 0);
    patch.openedAt = rec.openedAt || now;
    patch.rewardPoints = reward;
    patch.rewardedAt = now;
    if (reward > 0 && rec.referrerOpenid) {
      await db.collection(USERS).where({ openid: rec.referrerOpenid })
        .update({ data: { rewardPoints: _.inc(reward), updatedAt: now } });
      await db.collection(LEDGER).add({ data: {
        openid: rec.referrerOpenid, delta: reward, reason: '推荐开户奖励', refId: id, createdAt: now
      }});
    }
  }
  // 从开户成功改回其它状态 → 回收已发积分，保持账目一致
  if (status !== REF_OPENED && rec.rewardedAt && rec.rewardPoints > 0 && rec.referrerOpenid) {
    await db.collection(USERS).where({ openid: rec.referrerOpenid })
      .update({ data: { rewardPoints: _.inc(-rec.rewardPoints), updatedAt: now } });
    await db.collection(LEDGER).add({ data: {
      openid: rec.referrerOpenid, delta: -rec.rewardPoints, reason: '推荐开户撤销', refId: id, createdAt: now
    }});
    patch.rewardPoints = 0;
    patch.rewardedAt = null;
    patch.openedAt = null;
  }
  await db.collection(REFERRALS).doc(id).update({ data: patch });
  return { _id: id, status };
}

async function referralRanking() {
  let rows = [];
  try {
    const res = await db.collection(REFERRALS).limit(1000).get();
    rows = res.data || [];
  } catch (e) { rows = []; } // referrals 集合未建/为空容错
  const map = {};
  rows.forEach(r => {
    const k = r.referrerOpenid || '';
    if (!k) return;
    if (!map[k]) map[k] = { openid: k, code: r.referrerCode || '', nick: '', total: 0, opened: 0, rewardPoints: 0 };
    map[k].total += 1;
    if (r.status === REF_OPENED) { map[k].opened += 1; map[k].rewardPoints += (r.rewardPoints || 0); }
  });
  const openids = Object.keys(map);
  if (openids.length) {
    const ur = await db.collection(USERS).where({ openid: _.in(openids) }).limit(1000).get();
    ur.data.forEach(u => { if (map[u.openid]) { map[u.openid].nick = u.nickName || ''; if (!map[u.openid].code) map[u.openid].code = u.referralCode || ''; } });
  }
  return Object.values(map).sort((a, b) => (b.opened - a.opened) || (b.total - a.total));
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

  // 快递100 物流推送回调（公开，无管理员鉴权）：body 为 form-urlencoded，含 param 字段。
  // 必须在 JSON 解析之前处理（form 体 JSON.parse 会失败）。
  {
    let rawBody = (typeof event.body === 'string') ? event.body : '';
    if (rawBody && event.isBase64Encoded) {
      try { rawBody = Buffer.from(rawBody, 'base64').toString('utf8'); } catch (e) {}
    }
    if (rawBody && rawBody.indexOf('param=') >= 0 && rawBody.trim().charAt(0) !== '{') {
      try {
        const qs = require('querystring');
        const parsed = qs.parse(rawBody);
        const paramObj = JSON.parse(parsed.param);
        const data = await handleLogisticsPush(paramObj);
        return buildResponse(200, data);
      } catch (err) {
        console.error('[kd100] push parse/handle', err);
        return buildResponse(200, { result: false, returnCode: '500', message: 'parse error' });
      }
    }
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

  // 公开动作：网页端兜底下单（无需管理员登录，必须在 verifyAdmin 之前处理）
  if (body.action === 'web-submit-order') {
    try {
      const data = await webSubmitOrder(body);
      return buildResponse(200, { ok: true, data });
    } catch (err) {
      console.error('[admin-orders] web-submit-order', err);
      return buildResponse(400, { ok: false, error: err.message || '提交失败' });
    }
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
      case 'query-logistics':
        data = await queryLogistics(body);
        break;
      case 'update-note':
        data = await updateNote(body);
        break;
      case 'delete-order':
        data = await deleteOrder(body);
        break;
      case 'delete-orders-bulk':
        data = await deleteOrdersBulk(body);
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
      case 'get-cards-bank-labels':
        data = await getCardsBankLabels(body);
        break;
      case 'save-cards-bank-labels':
        data = await saveCardsBankLabels(body);
        break;
      case 'stats':
        data = await getStats(body);
        break;
      case 'list-reviews':
        data = await listReviews(body);
        break;
      case 'review-status':
        data = await reviewStatus(body, token);
        break;
      case 'referral-list':
        data = await referralList(body);
        break;
      case 'referral-add':
        data = await referralAdd(body);
        break;
      case 'referral-set-status':
        data = await referralSetStatus(body);
        break;
      case 'referral-ranking':
        data = await referralRanking(body);
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
