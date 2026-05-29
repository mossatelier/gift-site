const { getProductById } = require('../../utils/db.js');
const { labelOfCategory } = require('../../config.js');
const wishlist = require('../../utils/wishlist.js');

Page({
  data: {
    loading: true,
    product: null,
    categoryLabel: '',
    currentImageIndex: 0,
    showQr: false,
    wishlisted: false
  },

  onLoad(options) {
    const id = options.id;
    if (!id) {
      this.setData({ loading: false });
      return;
    }
    this.productId = id;
    this.setData({ wishlisted: wishlist.has(id) });
    this.loadProduct(id);
  },

  async loadProduct(id) {
    try {
      const product = await getProductById(id);
      this.setData({
        product,
        categoryLabel: labelOfCategory(product.category),
        loading: false
      });
      if (product && product.title) {
        wx.setNavigationBarTitle({ title: product.title });
      }
      this.bumpViewCount(id);
    } catch (err) {
      console.error('加载商品详情失败', err);
      this.setData({ loading: false });
    }
  },

  // 浏览量 +1（同一商品在同一次会话只 +1）
  bumpViewCount(id) {
    const app = getApp();
    if (!app.globalData.viewedIds) app.globalData.viewedIds = new Set();
    if (app.globalData.viewedIds.has(id)) return;
    app.globalData.viewedIds.add(id);
    wx.cloud.callFunction({
      name: 'inc-view',
      data: { id }
    }).then(res => {
      if (res && res.result && res.result.success) {
        const next = (this.data.product && this.data.product.viewCount || 0) + 1;
        this.setData({ 'product.viewCount': next });
      }
    }).catch(err => {
      console.warn('inc-view 调用失败', err);
    });
  },

  onImageChange(e) {
    this.setData({ currentImageIndex: e.detail.current });
  },

  onThumbTap(e) {
    const index = Number(e.currentTarget.dataset.index);
    this.setData({ currentImageIndex: index });
  },

  previewImage(e) {
    const index = e.currentTarget.dataset.index;
    const images = this.data.product.images;
    wx.previewImage({
      urls: images,
      current: images[index]
    });
  },

  toggleWishlist() {
    if (!this.productId) return;
    wishlist.toggle(this.productId);
    const nowOn = wishlist.has(this.productId);
    this.setData({ wishlisted: nowOn });
    wx.showToast({
      title: nowOn ? '已加入心愿单' : '已移除',
      icon: 'success'
    });
  },

  goEarn() {
    wx.navigateTo({ url: '/pages/earn/earn' });
  },

  showQrcode() {
    this.setData({ showQr: true });
  },

  hideQrcode() {
    this.setData({ showQr: false });
  },

  onShareAppMessage() {
    const p = this.data.product;
    return {
      title: p ? `${p.title} · 加加好物图集` : '加加好物图集',
      path: `/pages/product/product?id=${p ? p._id : ''}`,
      imageUrl: p ? p.imageUrl : undefined
    };
  }
});
