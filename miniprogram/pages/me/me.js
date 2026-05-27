const auth = require('../../utils/auth.js');
const { getMyAddress } = require('../../utils/db.js');

Page({
  data: {
    user: null,
    address: null
  },

  onShow() {
    this.refresh();
  },

  async refresh() {
    const user = auth.getCurrentUser();
    this.setData({ user });
    if (user) {
      try {
        const address = await getMyAddress(user.openid);
        this.setData({ address });
      } catch (err) {
        console.warn('load address failed', err);
      }
    } else {
      this.setData({ address: null });
    }
  },

  goLogin() {
    wx.navigateTo({ url: '/pages/login/login' });
  },

  goAddress() {
    if (!auth.ensureLogin('/pages/address-edit/address-edit')) return;
    wx.navigateTo({ url: '/pages/address-edit/address-edit' });
  },

  goOrders() {
    if (!auth.ensureLogin('/pages/my-orders/my-orders')) return;
    wx.navigateTo({ url: '/pages/my-orders/my-orders' });
  },

  goWishlist() {
    wx.switchTab({ url: '/pages/wishlist/wishlist' });
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
      content: '退出后将无法管理订单和地址，确定吗？',
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
