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
