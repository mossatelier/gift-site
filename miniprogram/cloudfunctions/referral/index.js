// 推荐系统 · 用户端云函数（小程序 callFunction 调用，openid 取自上下文，可信）
// action:
//   get-my-referral  取我的推荐码 + 统计 + 明细（没码自动生成）
//   bind-referrer    我是被某推荐码邀请来的 → 绑定上下级（一次性、不可绑自己）
//
// 数据：
//   users      扩展 referralCode / referredByCode / referredByOpenid / rewardPoints
//   referrals  一条 = 一个被推荐好友 {referrerOpenid, referrerCode, refereeOpenid,
//              refereeNick, refereePhone, status, rewardPoints, createdAt, openedAt, rewardedAt}
//   points_ledger 积分流水（发放在后台 CRM 写，这里只读统计）

const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();
const _ = db.command;
const identity = require('./identity')(db);

const USERS = 'users';
const REFERRALS = 'referrals';

// 开户成功 = 计入"有效办卡"的状态
const STATUS_OPENED = '开户成功';

// 推荐码和账号身份由事务创建，两个云函数共用相同的身份规则。
async function ensureMyUser(openid) {
  return identity.upsert(openid, { ensureCode: true });
}

function maskPhone(p) {
  const s = String(p || '');
  if (s.length < 7) return s;
  return s.slice(0, 3) + '****' + s.slice(-4);
}

async function getMyReferral(openid) {
  const me = await ensureMyUser(openid);
  // 明细（我推荐的好友）；referrals 集合还没建/为空时容错为空，避免整页报错
  let rows = [];
  try {
    const res = await db.collection(REFERRALS)
      .where({ referrerOpenid: openid })
      .orderBy('createdAt', 'desc')
      .limit(100)
      .get();
    rows = res.data || [];
  } catch (e) {
    console.warn('[referral] referrals read failed (collection 可能未建)', e);
    rows = [];
  }
  const opened = rows.filter(r => r.status === STATUS_OPENED).length;
  const list = rows.map(r => ({
    refereeNick: r.refereeNick || '好友',
    refereePhone: maskPhone(r.refereePhone),
    status: r.status || '待审核',
    rewardPoints: r.rewardPoints || 0,
    createdAt: r.createdAt,
    openedAt: r.openedAt || null,
    rewardedAt: r.rewardedAt || null
  }));
  return {
    success: true,
    code: me.referralCode,
    nickName: me.nickName || '微信用户',
    stats: {
      total: rows.length,            // 累计推荐好友
      opened,                        // 有效办卡（开户成功）
      rewardPoints: me.rewardPoints || 0  // 已奖励积分
    },
    list
  };
}

const bindReferrer = identity.bindReferrer;

// 我的积分流水（本人查看，openid 取自可信的 wx 上下文）
// 最新流水在前，以当前余额向前倒推每笔的余额
async function getMyPointsLedger(openid) {
  const me = await ensureMyUser(openid);
  const res = await db.collection('points_ledger').where({ openid })
    .orderBy('createdAt', 'desc').limit(200).get();
  const rows = res.data || [];
  let running = Number(me.rewardPoints || 0);
  const items = rows.map(r => {
    const balanceAfter = running;
    running -= Number(r.delta) || 0;
    return {
      delta: r.delta || 0,
      reason: r.reason || '',
      balanceAfter,
      createdAt: r.createdAt
    };
  });

  return { success: true, rewardPoints: me.rewardPoints || 0, items };
}

// 生成带参小程序码（scene = 6位推荐码），返回 base64 供小程序画到海报上。
// 未发布时 release 版可能报错——前端据 success=false 走"无码海报"降级。
async function getQr(openid) {
  const me = await ensureMyUser(openid);
  try {
    const res = await cloud.openapi.wxacode.getUnlimited({
      scene: 'ref=' + me.referralCode,
      page: 'pages/index/index',
      checkPath: false,
      envVersion: 'release',
      width: 280
    });
    const base64 = 'data:image/png;base64,' + res.buffer.toString('base64');
    return { success: true, code: me.referralCode, qr: base64 };
  } catch (err) {
    console.warn('[referral] getQr', err);
    return { success: false, code: me.referralCode, error: '小程序码生成失败（需小程序发布后可用）' };
  }
}

// 绑定办卡预留手机号：用户自己在小程序里输入，不接短信验证（信任输入，冒充也拿不到分——
// 客服还是会核实办卡凭证才手动加分）。一个手机号只能绑一个账号，重绑需先解绑。
async function getMyBinding(openid) {
  const me = await ensureMyUser(openid);
  return { success: true, boundPhone: me.boundPhone || '' };
}

async function bindPhone(openid, phone) {
  const p = String(phone || '').trim();
  if (!/^1\d{10}$/.test(p)) return { success: false, error: '手机号格式不正确' };
  await identity.upsert(openid, { phone: p, requireUnboundPhone: true, ensureCode: true });
  return { success: true, boundPhone: p };
}

async function unbindPhone(openid) {
  await identity.upsert(openid, { phone: '', ensureCode: true });
  return { success: true, boundPhone: '' };
}

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext();
  if (!OPENID) return { success: false, error: '未登录' };
  const action = event && event.action;
  try {
    if (action === 'get-my-referral') return await getMyReferral(OPENID);
    if (action === 'bind-referrer') return await bindReferrer(OPENID, event.code);
    if (action === 'get-qr') return await getQr(OPENID);
    if (action === 'get-my-points') return await getMyPointsLedger(OPENID);
    if (action === 'get-my-binding') return await getMyBinding(OPENID);
    if (action === 'bind-phone') return await bindPhone(OPENID, event.phone);
    if (action === 'unbind-phone') return await unbindPhone(OPENID);
    return { success: false, error: '未知操作' };
  } catch (err) {
    console.error('[referral]', action, err);
    return { success: false, error: (err && err.message) || '服务异常' };
  }
};
