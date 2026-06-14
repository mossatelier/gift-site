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

const USERS = 'users';
const REFERRALS = 'referrals';

// 开户成功 = 计入"有效办卡"的状态
const STATUS_OPENED = '开户成功';

// 生成 6 位唯一数字推荐码
async function genUniqueCode() {
  for (let i = 0; i < 25; i++) {
    const code = String(Math.floor(100000 + Math.random() * 900000));
    const exist = await db.collection(USERS).where({ referralCode: code }).count();
    if (exist.total === 0) return code;
  }
  throw new Error('生成推荐码失败，请重试');
}

// 取（或补建）我的 users 记录，并保证有推荐码
async function ensureMyUser(openid) {
  const r = await db.collection(USERS).where({ openid }).limit(1).get();
  let user = r.data[0];
  const now = new Date();
  if (!user) {
    const code = await genUniqueCode();
    const doc = { openid, nickName: '微信用户', avatarUrl: '', referralCode: code, rewardPoints: 0, createdAt: now, updatedAt: now };
    const add = await db.collection(USERS).add({ data: doc });
    return { _id: add._id, ...doc };
  }
  if (!user.referralCode) {
    const code = await genUniqueCode();
    await db.collection(USERS).doc(user._id).update({ data: { referralCode: code, updatedAt: now } });
    user.referralCode = code;
  }
  if (user.rewardPoints == null) user.rewardPoints = 0;
  return user;
}

function maskPhone(p) {
  const s = String(p || '');
  if (s.length < 7) return s;
  return s.slice(0, 3) + '****' + s.slice(-4);
}

async function getMyReferral(openid) {
  const me = await ensureMyUser(openid);
  // 明细（我推荐的好友）
  const res = await db.collection(REFERRALS)
    .where({ referrerOpenid: openid })
    .orderBy('createdAt', 'desc')
    .limit(100)
    .get();
  const rows = res.data || [];
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

async function bindReferrer(openid, code) {
  const c = String(code || '').trim();
  if (!c) return { success: false, error: '缺少推荐码' };
  const me = await ensureMyUser(openid);
  if (me.referredByCode) return { success: true, already: true };       // 已绑定，不覆盖
  if (me.referralCode === c) return { success: false, error: '不能绑定自己的推荐码' };

  const ref = await db.collection(USERS).where({ referralCode: c }).limit(1).get();
  const referrer = ref.data[0];
  if (!referrer) return { success: false, error: '推荐码无效' };
  if (referrer.openid === openid) return { success: false, error: '不能推荐自己' };

  const now = new Date();
  await db.collection(USERS).doc(me._id).update({
    data: { referredByCode: c, referredByOpenid: referrer.openid, referredAt: now, updatedAt: now }
  });

  // 自动建一条「待审核」推荐记录（同一对推荐关系只建一次）
  const dup = await db.collection(REFERRALS)
    .where({ referrerOpenid: referrer.openid, refereeOpenid: openid })
    .count();
  if (dup.total === 0) {
    await db.collection(REFERRALS).add({
      data: {
        referrerOpenid: referrer.openid,
        referrerCode: c,
        refereeOpenid: openid,
        refereeNick: me.nickName || '微信用户',
        refereePhone: '',
        status: '待审核',
        rewardPoints: 0,
        createdAt: now,
        openedAt: null,
        rewardedAt: null
      }
    });
  }
  return { success: true };
}

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext();
  if (!OPENID) return { success: false, error: '未登录' };
  const action = event && event.action;
  try {
    if (action === 'get-my-referral') return await getMyReferral(OPENID);
    if (action === 'bind-referrer') return await bindReferrer(OPENID, event.code);
    return { success: false, error: '未知操作' };
  } catch (err) {
    console.error('[referral]', action, err);
    return { success: false, error: (err && err.message) || '服务异常' };
  }
};
