const { getProductsByIds } = require('../../utils/db.js');
const wishlist = require('../../utils/wishlist.js');

Page({
  data: {
    loading: true,
    items: [],
    openFlow: 'credit'
  },

  onShow() {
    this.refresh();
  },

  onPullDownRefresh() {
    this.refresh().then(() => wx.stopPullDownRefresh());
  },

  async refresh() {
    this.setData({ loading: true });
    const ids = wishlist.getList();
    if (ids.length === 0) {
      this.setData({ items: [], loading: false });
      return;
    }
    try {
      const items = await getProductsByIds(ids);
      this.setData({ items, loading: false });
    } catch (err) {
      console.error('心愿单加载失败', err);
      this.setData({ items: [], loading: false });
      wx.showToast({ title: '加载失败', icon: 'none' });
    }
  },

  goList() {
    wx.switchTab({ url: '/pages/list/list' });
  },

  goProduct(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({ url: `/pages/product/product?id=${id}` });
  },

  removeItem(e) {
    const id = e.currentTarget.dataset.id;
    wishlist.remove(id);
    this.setData({
      items: this.data.items.filter(item => item._id !== id)
    });
    wx.showToast({ title: '已移除', icon: 'success' });
  },

  toggleFlow(e) {
    const flow = e.currentTarget.dataset.flow;
    this.setData({ openFlow: this.data.openFlow === flow ? '' : flow });
  },

  previewQrcode() {
    wx.previewImage({
      urls: ['/images/wishlist-wechat-qr.jpg'],
      current: '/images/wishlist-wechat-qr.jpg'
    });
  },

  onShareAppMessage() {
    return {
      title: '加加办卡礼品馆 · 我的心愿单',
      path: '/pages/wishlist/wishlist'
    };
  }
});
