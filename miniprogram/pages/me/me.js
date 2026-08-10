const auth = require('../../utils/auth.js');
const { getDefaultAddress, listMyAddresses, getAntiPiracyNotice } = require('../../utils/db.js');

Page({
  data: {
    user: null,
    address: null,
    addressCount: 0,
    rewardPoints: 0,
    antiPiracyNotice: null
  },

  onShow() {
    this.refresh();
    if (!this._noticeLoaded) {
      this._noticeLoaded = true;
      getAntiPiracyNotice().then((notice) => this.setData({ antiPiracyNotice: notice })).catch(() => {});
    }
  },

  async refresh() {
    const user = auth.getCurrentUser();
    this.setData({ user });
    if (user) {
      try {
        const addresses = await listMyAddresses(user.openid);
        this.setData({
          address: addresses[0] || null,
          addressCount: addresses.length
        });
      } catch (err) {
        console.warn('load address failed', err);
      }
      wx.cloud.callFunction({ name: 'referral', data: { action: 'get-my-points' } })
        .then((cf) => {
          const r = cf && cf.result;
          if (r && r.success) this.setData({ rewardPoints: r.rewardPoints || 0 });
        })
        .catch((err) => console.warn('load points failed', err));
    } else {
      this.setData({ address: null, addressCount: 0, rewardPoints: 0 });
    }
  },

  goPoints() {
    if (!auth.ensureLogin('/pages/points/points')) return;
    wx.navigateTo({ url: '/pages/points/points' });
  },

  goLogin() {
    wx.navigateTo({ url: '/pages/login/login' });
  },

  goAddress() {
    if (!auth.ensureLogin('/pages/address-list/address-list')) return;
    wx.navigateTo({ url: '/pages/address-list/address-list' });
  },

  goOrders() {
    if (!auth.ensureLogin('/pages/my-orders/my-orders')) return;
    wx.navigateTo({ url: '/pages/my-orders/my-orders' });
  },

  goWishlist() {
    wx.switchTab({ url: '/pages/wishlist/wishlist' });
  },

  goReferral() {
    if (!auth.ensureLogin('/pages/referral/referral')) return;
    wx.navigateTo({ url: '/pages/referral/referral' });
  },

  goService() {
    wx.previewImage({
      urls: ['/images/wechat-qr.jpg'],
      current: '/images/wechat-qr.jpg'
    });
  },

  goAgreement() {
    wx.navigateTo({ url: '/pages/agreement/agreement?type=privacy' });
  },

  logout() {
    wx.showModal({
      title: '退出登录',
      content: '退出后将无法管理领取记录和地址，确定吗？',
      confirmText: '退出',
      confirmColor: '#d64b2a',
      success: (res) => {
        if (res.confirm) {
          auth.clearCurrentUser();
          this.setData({ user: null, address: null });
          wx.showToast({ title: '已退出', icon: 'success' });
        }
      }
    });
  }
});
