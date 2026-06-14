const { getProductById } = require('../../utils/db.js');
const { labelOfCategory } = require('../../config.js');
const wishlist = require('../../utils/wishlist.js');

// 推荐有礼按推荐人数换，不显示积分
function buildPointsText(product) {
  if (product.category === 'referral') {
    if (product.subcategory) {
      const m = String(product.subcategory).match(/推荐\s*(\d+)\s*人/);
      if (m) return `推荐 ${m[1]} 人可领`;
    }
    return '推荐办理可领';   // 推荐有礼一律不显示积分
  }
  if (product.cardsNeeded > 0) return `兑换积分：${product.cardsNeeded} 分`;
  return '';
}

Page({
  data: {
    loading: true,
    product: null,
    categoryLabel: '',
    pointsText: '',
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
        pointsText: buildPointsText(product),
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
    if (!nowOn) {
      wx.showToast({ title: '已移除', icon: 'success' });
      return;
    }
    // 加入心愿单后给出明确的下一步：否则客户卡在详情页（底部 tab 被盖住），
    // 找不到去哪提交地址，导致收藏后流失。
    const count = (wishlist.getList() || []).length;
    wx.showModal({
      title: '已加入心愿单',
      content: `心愿单已有 ${count} 件礼品，去填写收货地址、提交申请吗？`,
      confirmText: '去提交',
      cancelText: '继续逛逛',
      confirmColor: '#d64b2a',
      success: (res) => {
        if (res.confirm) {
          wx.switchTab({ url: '/pages/wishlist/wishlist' });
        }
      }
    });
  },

  goEarn() {
    wx.navigateTo({ url: '/pages/earn/earn' });
  },

  // 用 previewImage 打开客服二维码：预览模式下长按才能「识别图中二维码」
  // （自定义弹层里的 image 长按无法识别二维码）
  showQrcode() {
    wx.previewImage({
      urls: ['/images/wechat-qr.jpg'],
      current: '/images/wechat-qr.jpg'
    });
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
