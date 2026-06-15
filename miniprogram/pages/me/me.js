const auth = require('../../utils/auth.js');
const { getDefaultAddress, listMyAddresses } = require('../../utils/db.js');

Page({
  data: {
    user: null,
    address: null,
    addressCount: 0
  },

  onShow() {
    this.refresh();
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
    } else {
      this.setData({ address: null, addressCount: 0 });
    }
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
