const { listHotProducts, listNewProducts } = require('../../utils/db.js');
const wishlist = require('../../utils/wishlist.js');

Page({
  data: {
    loading: true,
    hotList: [],
    newList: [],
    wishlistMap: {},
    keyword: '',
    showQr: false
  },

  onLoad() {
    this.loadAll();
  },

  onShow() {
    this.setData({ wishlistMap: wishlist.getMap() });
  },

  onPullDownRefresh() {
    this.loadAll().then(() => wx.stopPullDownRefresh());
  },

  async loadAll() {
    this.setData({ loading: true });
    try {
      const results = await Promise.all([
        listHotProducts(6),
        listNewProducts(6)
      ]);
      this.setData({ hotList: results[0], newList: results[1], loading: false });
    } catch (err) {
      console.error('加载首页商品失败', err);
      this.setData({ loading: false });
      wx.showToast({ title: '加载失败', icon: 'none' });
    }
  },

  onKeywordInput(e) {
    this.setData({ keyword: e.detail.value });
  },

  onSearchSubmit() {
    const kw = (this.data.keyword || '').trim();
    if (!kw) {
      wx.switchTab({ url: '/pages/list/list' });
      return;
    }
    getApp().globalData.listSearchIntent = kw;
    wx.switchTab({ url: '/pages/list/list' });
  },

  goList() {
    wx.switchTab({ url: '/pages/list/list' });
  },

  goWishlist() {
    wx.switchTab({ url: '/pages/wishlist/wishlist' });
  },

  goListNewest() {
    getApp().globalData.listSortIntent = 'newest';
    wx.switchTab({ url: '/pages/list/list' });
  },

  goCategory() {
    wx.switchTab({ url: '/pages/category/category' });
  },

  goProduct(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({ url: `/pages/product/product?id=${id}` });
  },

  toggleHeart(e) {
    const id = e.currentTarget.dataset.id;
    wishlist.toggle(id);
    const nowOn = wishlist.has(id);
    this.setData({ wishlistMap: wishlist.getMap() });
    wx.showToast({
      title: nowOn ? '已加入心愿单' : '已移除',
      icon: 'success'
    });
  },

  goCardFlow() {
    wx.navigateTo({ url: '/pages/card-flow/card-flow' });
  },

  goClaimGuide() {
    wx.navigateTo({ url: '/pages/claim-guide/claim-guide' });
  },

  goBankNewUser() {
    wx.navigateTo({ url: '/pages/bank-new-user/bank-new-user' });
  },

  goEarn() {
    wx.navigateTo({ url: '/pages/earn/earn' });
  },

  goProgress() {
    wx.navigateTo({ url: '/pages/progress/progress' });
  },

  goPromo() {
    wx.navigateTo({ url: '/pages/promo/promo' });
  },

  showQrcode() {
    this.setData({ showQr: true });
  },

  hideQrcode() {
    this.setData({ showQr: false });
  },

  onShareAppMessage() {
    return {
      title: '加加办卡礼品馆 · 办卡即享精选好礼',
      path: '/pages/index/index'
    };
  },

  onShareTimeline() {
    return {
      title: '加加办卡礼品馆 · 办卡即享精选好礼'
    };
  }
});
