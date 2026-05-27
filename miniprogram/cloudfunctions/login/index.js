// 登录 / upsert 用户
// 入参：{ nickName?, avatarUrl? }
// 返回：{ success, openid, user }
//
// openid 直接从 cloud.getWXContext() 取，安全可信，不需要 client 传 code

const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();
const _ = db.command;

const COLLECTION = 'users';

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext();
  if (!OPENID) {
    return { success: false, error: 'no openid in context' };
  }

  const nickName = (event && event.nickName || '').trim();
  const avatarUrl = (event && event.avatarUrl || '').trim();
  const now = new Date();

  try {
    const existing = await db.collection(COLLECTION)
      .where({ openid: OPENID })
      .limit(1)
      .get();

    if (existing.data.length > 0) {
      const cur = existing.data[0];
      const patch = { updatedAt: now };
      if (nickName && nickName !== cur.nickName) patch.nickName = nickName;
      if (avatarUrl && avatarUrl !== cur.avatarUrl) patch.avatarUrl = avatarUrl;

      if (Object.keys(patch).length > 1) {
        await db.collection(COLLECTION).doc(cur._id).update({ data: patch });
      }
      return {
        success: true,
        openid: OPENID,
        user: { ...cur, ...patch }
      };
    }

    const doc = {
      openid: OPENID,
      nickName: nickName || '微信用户',
      avatarUrl: avatarUrl || '',
      createdAt: now,
      updatedAt: now
    };
    const add = await db.collection(COLLECTION).add({ data: doc });
    return {
      success: true,
      openid: OPENID,
      user: { _id: add._id, ...doc }
    };
  } catch (err) {
    console.error('[login] failed', err);
    return { success: false, error: err.message };
  }
};
