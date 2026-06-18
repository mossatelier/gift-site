const auth = require('../../utils/auth.js');

Page({
  data: {
    avatarUrl: '',
    nickName: '',
    submitting: false,
    redirect: '',
    fromRef: false
  },

  onLoad(query) {
    this.setData({
      redirect: query && query.redirect ? decodeURIComponent(query.redirect) : '',
      fromRef: !!(query && query.from === 'ref')
    });
    // 已登录直接跳回
    if (auth.isLoggedIn()) {
      this.goBackOrRedirect();
    }
  },

  onChooseAvatar(e) {
    const url = e.detail && e.detail.avatarUrl;
    if (url) this.setData({ avatarUrl: url });
  },

  onNickInput(e) {
    this.setData({ nickName: (e.detail.value || '').trim() });
  },

  async onSubmit() {
    if (this.data.submitting) return;
    const nickName = (this.data.nickName || '').trim();
    if (!nickName) {
      wx.showToast({ title: '请填写昵称', icon: 'none' });
      return;
    }
    this.setData({ submitting: true });
    try {
      // 头像如果是临时文件（wxfile://），先上传到云存储
      let avatarUrl = this.data.avatarUrl || '';
      if (avatarUrl && /^(wxfile|http:\/\/tmp|https?:\/\/tmp)/.test(avatarUrl)) {
        try {
          const ext = avatarUrl.split('.').pop().split('?')[0] || 'png';
          const up = await wx.cloud.uploadFile({
            cloudPath: `avatars/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`,
            filePath: avatarUrl
          });
          avatarUrl = up.fileID || '';
        } catch (err) {
          console.warn('avatar upload failed', err);
          avatarUrl = '';
        }
      }
      await auth.callLogin({ nickName, avatarUrl });
      wx.showToast({ title: '欢迎', icon: 'success' });
      setTimeout(() => this.goBackOrRedirect(), 400);
    } catch (err) {
      console.error('login failed', err);
      wx.showToast({ title: err.message || '登录失败', icon: 'none' });
    } finally {
      this.setData({ submitting: false });
    }
  },

  goBackOrRedirect() {
    const target = this.data.redirect;
    if (target) {
      // tab 用 switchTab，其他用 redirectTo
      if (/^\/pages\/(index|category|list|wishlist|me)\//.test(target)) {
        wx.switchTab({ url: target, fail: () => wx.redirectTo({ url: target }) });
      } else {
        wx.redirectTo({ url: target, fail: () => wx.navigateBack() });
      }
    } else {
      const pages = getCurrentPages();
      if (pages.length > 1) {
        wx.navigateBack();
      } else {
        wx.switchTab({ url: '/pages/me/me' });
      }
    }
  }
});
