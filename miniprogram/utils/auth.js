// 登录态管理（本地缓存 + 云函数 login 调用）
//
// 策略：openid 是真身份，nickName/avatarUrl 是装饰。
// - 进入小程序时不强制登录
// - 在需要的位置（提交订单、管地址、看订单）调 ensureLogin()，
//   未登录会跳 /pages/login 让用户授权头像 + 昵称
// - 已登录但 redirect 跳过去依然会跳"我的"作为 fallback（避免 401 死循环）

const STORAGE_USER = 'gift-site-user';

function getCurrentUser() {
  try {
    const raw = wx.getStorageSync(STORAGE_USER);
    if (!raw) return null;
    const u = JSON.parse(raw);
    if (!u || !u.openid) return null;
    return u;
  } catch (err) {
    return null;
  }
}

function setCurrentUser(user) {
  if (!user || !user.openid) {
    wx.removeStorageSync(STORAGE_USER);
    return null;
  }
  wx.setStorageSync(STORAGE_USER, JSON.stringify(user));
  return user;
}

function clearCurrentUser() {
  wx.removeStorageSync(STORAGE_USER);
}

function isLoggedIn() {
  return !!getCurrentUser();
}

// 调用云函数 login —— upsert + 同步本地缓存
async function callLogin({ phone = '', nickName = '', avatarUrl = '' } = {}) {
  const res = await wx.cloud.callFunction({
    name: 'login',
    data: { phone, nickName, avatarUrl }
  });
  const r = res && res.result;
  if (!r || !r.success) {
    throw new Error((r && r.error) || '登录失败');
  }
  const user = { openid: r.openid, ...(r.user || {}) };
  setCurrentUser(user);
  // 登录后异步合并心愿单（不阻塞）
  try {
    require('./wishlist.js').pullAndMerge();
  } catch (err) {
    console.warn('[auth] wishlist merge after login failed', err);
  }
  return user;
}

// 老用户过渡：手机号改成登录必填之前注册的账号没有 boundPhone，
// 他们本地登录态还在、不会再走登录页，需要在「我的」页引导补填。
function needsPhone() {
  const u = getCurrentUser();
  return !!u && !u.boundPhone;
}

// 在受保护页面 onLoad 调用：未登录跳登录页（回调 redirectUrl）
function ensureLogin(redirectUrl) {
  if (isLoggedIn()) return true;
  const params = redirectUrl
    ? `?redirect=${encodeURIComponent(redirectUrl)}`
    : '';
  wx.navigateTo({ url: `/pages/login/login${params}` });
  return false;
}

module.exports = {
  STORAGE_USER,
  getCurrentUser,
  setCurrentUser,
  clearCurrentUser,
  isLoggedIn,
  needsPhone,
  callLogin,
  ensureLogin
};
