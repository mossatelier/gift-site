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
const identity = require('./identity')(db);

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext();
  if (!OPENID) {
    return { success: false, error: 'no openid in context' };
  }

  const nickName = String(event && event.nickName || '').trim().slice(0, 100);
  const avatarUrl = String(event && event.avatarUrl || '').trim().slice(0, 2000);
  const phone = String((event && event.phone) || '').trim();

  if (!/^1\d{10}$/.test(phone)) {
    return { success: false, error: '请输入正确的 11 位手机号' };
  }

  try {
    const user = await identity.upsert(OPENID, { phone, nickName, avatarUrl });
    return { success: true, openid: OPENID, user };
  } catch (err) {
    console.error('[login] failed', err);
    return { success: false, error: err.message };
  }
};
