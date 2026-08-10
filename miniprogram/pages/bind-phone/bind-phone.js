const auth = require('../../utils/auth.js');

function maskPhone(p) {
  const s = String(p || '');
  if (s.length < 7) return s;
  return s.slice(0, 3) + '****' + s.slice(-4);
}

Page({
  data: {
    loading: true,
    boundPhone: '',
    inputPhone: '',
    submitting: false,
    errorMsg: ''
  },

  onLoad() {
    if (!auth.ensureLogin('/pages/bind-phone/bind-phone')) return;
    this.load();
  },

  async load() {
    this.setData({ loading: true });
    try {
      const cf = await wx.cloud.callFunction({ name: 'referral', data: { action: 'get-my-binding' } });
      const r = cf && cf.result;
      if (!r || !r.success) throw new Error((r && r.error) || '加载失败');
      this.setData({ loading: false, boundPhone: r.boundPhone || '', maskedPhone: maskPhone(r.boundPhone) });
    } catch (err) {
      this.setData({ loading: false });
      wx.showToast({ title: err.message || '加载失败', icon: 'none' });
    }
  },

  onInput(e) {
    this.setData({ inputPhone: e.detail.value, errorMsg: '' });
  },

  async doBind() {
    if (this.data.submitting) return;
    const phone = (this.data.inputPhone || '').trim();
    if (!/^1\d{10}$/.test(phone)) {
      this.setData({ errorMsg: '请输入正确的 11 位手机号' });
      return;
    }
    this.setData({ submitting: true, errorMsg: '' });
    try {
      const cf = await wx.cloud.callFunction({ name: 'referral', data: { action: 'bind-phone', phone } });
      const r = cf && cf.result;
      if (!r || !r.success) throw new Error((r && r.error) || '绑定失败');
      this.setData({
        submitting: false,
        boundPhone: r.boundPhone,
        maskedPhone: maskPhone(r.boundPhone),
        inputPhone: ''
      });
      wx.showToast({ title: '绑定成功', icon: 'success' });
    } catch (err) {
      this.setData({ submitting: false, errorMsg: err.message || '绑定失败' });
    }
  },

  doUnbind() {
    wx.showModal({
      title: '解绑手机号',
      content: '解绑后可以重新绑定新的手机号，确定解绑吗？',
      confirmText: '解绑',
      confirmColor: '#d64b2a',
      success: async (res) => {
        if (!res.confirm) return;
        this.setData({ submitting: true });
        try {
          const cf = await wx.cloud.callFunction({ name: 'referral', data: { action: 'unbind-phone' } });
          const r = cf && cf.result;
          if (!r || !r.success) throw new Error((r && r.error) || '解绑失败');
          this.setData({ submitting: false, boundPhone: '', maskedPhone: '' });
          wx.showToast({ title: '已解绑', icon: 'success' });
        } catch (err) {
          this.setData({ submitting: false });
          wx.showToast({ title: err.message || '解绑失败', icon: 'none' });
        }
      }
    });
  }
});
