// 登录 / upsert 用户
// 入参：{ phone, nickName?, avatarUrl? }
// 返回：{ success, openid, user }
//
// 身份设计（重要，别改成"手机号即账号"）：
//   openid 是账号主键 —— 微信给的，伪造不了。
//   phone 是必填的业务资料 —— 客服凭它找到人、发积分。
//   本方案没有短信验证，如果把手机号当账号主键，任何人输别人手机号就能登进
//   别人账号、花掉别人积分。所以手机号只作为资料绑定在 openid 上，并保证
//   一个手机号只归属一个 openid。

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
  const phone = String((event && event.phone) || '').trim();
  const now = new Date();

  if (!/^1\d{10}$/.test(phone)) {
    return { success: false, error: '请输入正确的 11 位手机号' };
  }

  try {
    // 手机号已被别的账号占用 → 拒绝（一个手机号只归属一个 openid）
    const taken = await db.collection(COLLECTION)
      .where({ boundPhone: phone, openid: _.neq(OPENID) })
      .limit(1)
      .get();
    if (taken.data.length > 0) {
      return { success: false, error: '该手机号已绑定其他微信账号，如需换绑请联系客服' };
    }

    const existing = await db.collection(COLLECTION)
      .where({ openid: OPENID })
      .limit(1)
      .get();

    if (existing.data.length > 0) {
      const cur = existing.data[0];
      const patch = { updatedAt: now };
      if (nickName && nickName !== cur.nickName) patch.nickName = nickName;
      if (avatarUrl && avatarUrl !== cur.avatarUrl) patch.avatarUrl = avatarUrl;
      if (phone !== cur.boundPhone) {
        patch.boundPhone = phone;
        patch.boundPhoneAt = now;
      }

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
      boundPhone: phone,
      boundPhoneAt: now,
      rewardPoints: 0,
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
