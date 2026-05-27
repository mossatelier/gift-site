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

// 周期统计
async function getStats({ period = 'today' }) {
  const now = new Date();
  let since = null;
  if (period === 'today') {
    since = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  } else if (period === 'week') {
    // 周一为本周起点
    const dow = now.getDay() || 7; // 周日=0 → 7
    since = new Date(now.getFullYear(), now.getMonth(), now.getDate() - dow + 1);
  } else if (period === 'month') {
    since = new Date(now.getFullYear(), now.getMonth(), 1);
  }

  // 用户
  const usersTotal = (await db.collection('users').count()).total || 0;
  const usersNew = since
    ? ((await db.collection('users').where({ createdAt: _.gte(since) }).count()).total || 0)
    : usersTotal;

  // 订单：拉周期内 + 取总数
  const orderWhere = since ? { createdAt: _.gte(since) } : {};
  const ordersTotal = (await db.collection('orders').where(orderWhere).count()).total || 0;
  const orderRes = await db.collection('orders')
    .where(orderWhere)
    .orderBy('createdAt', 'desc')
    .limit(1000)
    .get();
  const orders = orderRes.data;

  // 按状态分布
  const byStatus = { pending: 0, processing: 0, done: 0, cancelled: 0 };
  for (const o of orders) {
    if (byStatus[o.status] !== undefined) byStatus[o.status]++;
  }

  // Top 5 申请最多的礼品（按 qty 累计）
  const productCounts = {};
  for (const o of orders) {
    if (Array.isArray(o.items)) {
      for (const it of o.items) {
        const key = it.productId || it.title;
        if (!key) continue;
        if (!productCounts[key]) {
          productCounts[key] = {
            productId: it.productId || '',
            title: it.title || '(未命名)',
            imageUrl: it.imageUrl || '',
            count: 0,
            cards: 0
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

  // 总积分（周期内）
  const totalCards = orders.reduce((sum, o) => sum + (o.totalCards || 0), 0);

  return {
    period,
    since: since ? since.toISOString() : null,
    users: { total: usersTotal, newInPeriod: usersNew },
    orders: {
      total: ordersTotal,
      byStatus,
      totalCards,
      sampleSize: orders.length // 用了多少条数据做聚合（受 1000 上限）
    },
    topProducts
  };
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
      case 'stats':
        data = await getStats(body);
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
