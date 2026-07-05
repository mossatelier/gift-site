// 隐私协议同意状态（勾选一次全局记住；提交前用 hasConsent() 校验）
const KEY = 'privacyConsent';

function hasConsent() {
  try { return wx.getStorageSync(KEY) === true; } catch (e) { return false; }
}

function setConsent(val) {
  try { wx.setStorageSync(KEY, !!val); } catch (e) {}
}

// 提交前统一校验：未同意则 toast 提示并返回 false
function requireConsent() {
  if (hasConsent()) return true;
  wx.showToast({ title: '请先勾选同意《隐私政策》', icon: 'none' });
  return false;
}

module.exports = { hasConsent, setConsent, requireConsent };
