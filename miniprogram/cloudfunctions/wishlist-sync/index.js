const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const sync = require('./sync')(cloud.database());
exports.main = async event => {
  const { OPENID } = cloud.getWXContext();
  if (!OPENID) return { success: false, error: '请先登录' };
  try { return { success: true, ...(await sync(OPENID, event || {})) }; }
  catch (err) { console.error('[wishlist-sync]', err); return { success: false, error: err.message || '同步失败，请重试' }; }
};
