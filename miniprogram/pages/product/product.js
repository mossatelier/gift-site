const { getProductById, getDefaultAddress } = require('../../utils/db.js');
const config = require('../../config.js');
const { labelOfCategory } = config;
const auth = require('../../utils/auth.js');
const wishlist = require('../../utils/wishlist.js');

// 推荐有礼按推荐人数换，不显示积分
function buildPointsText(product) {
  if (product.category === 'referral') {
    if (product.subcategory) {
      const m = String(product.subcategory).match(/推荐\s*(\d+)\s*人/);
      if (m) return `邀请 ${m[1]} 人可领`;
    }
    return '邀请可领';   // 邀请有礼一律不显示积分
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
    wishlisted: false,
    // 收藏并提交地址 弹层
    showSubmit: false,
    submitAddress: null,
    submitRemark: '',
    submitting: false
  },

  onLoad(options) {
    const id = options.id;
    if (!id) {
      this.setData({ loading: false });
      return;
    }
    this.productId = id;
    this.setData({ wishlisted: wishlist.has(id) });
    // 从地址页返回后，自动重开"收藏并提交地址"弹层
    const app = getApp();
    if (app.globalData && app.globalData.pendingProductSubmit === id) {
      app.globalData.pendingProductSubmit = null;
      this._reopenAfterLoad = true;
    }
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
      if (this._reopenAfterLoad) {
        this._reopenAfterLoad = false;
        this.openSubmit();
      }
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

  // ===== ③ 收藏并提交地址（既写系统又复制给客服）=====
  async openSubmit() {
    const p = this.data.product;
    if (!this.productId || !p) return;
    // 收藏：确保该礼品在心愿单里
    if (!wishlist.has(this.productId)) {
      wishlist.toggle(this.productId);
      this.setData({ wishlisted: true });
    }
    if (!auth.ensureLogin(`/pages/product/product?id=${this.productId}`)) return;
    await this._loadSubmitAddress();
    this.setData({ showSubmit: true });
  },

  async _loadSubmitAddress() {
    try {
      const user = auth.getCurrentUser();
      if (!user) return;
      const addr = await getDefaultAddress(user.openid);
      this.setData({ submitAddress: addr || null });
    } catch (e) {
      console.warn('load default address failed', e);
    }
  },

  closeSubmit() { this.setData({ showSubmit: false }); },
  noop() {},
  onRemarkInput(e) { this.setData({ submitRemark: e.detail.value }); },

  // 去填写/更换地址：有默认则编辑、没有则新建；存意图，返回后自动重开弹层
  goSubmitAddress() {
    const app = getApp();
    app.globalData = app.globalData || {};
    app.globalData.pendingProductSubmit = this.productId;
    const def = this.data.submitAddress;
    const redirect = encodeURIComponent(`/pages/product/product?id=${this.productId}`);
    const idPart = def && def._id ? `?id=${def._id}&` : '?';
    this.setData({ showSubmit: false });
    wx.navigateTo({ url: `/pages/address-edit/address-edit${idPart}redirect=${redirect}` });
  },

  confirmSubmit() {
    if (this.data.submitting) return;
    if (!this.data.submitAddress) {
      wx.showToast({ title: '请先填写收货地址', icon: 'none' });
      return;
    }
    const remark = (this.data.submitRemark || '').trim();
    if (!remark) {
      wx.showToast({ title: '请填写备注（颜色/规格等）', icon: 'none' });
      return;
    }
    // 立刻上锁，防连点重复下单
    this.setData({ submitting: true });
    const tmplIds = [config.orderPlacedTmplId, config.shipNotifyTmplId].filter(Boolean);
    if (tmplIds.length) {
      wx.requestSubscribeMessage({ tmplIds, complete: () => this._doConfirmSubmit(remark) });
    } else {
      this._doConfirmSubmit(remark);
    }
  },

  async _doConfirmSubmit(remark) {
    const p = this.data.product;
    const addr = this.data.submitAddress;
    wx.showLoading({ title: '提交中…', mask: true });
    try {
      const cf = await wx.cloud.callFunction({
        name: 'submit-order',
        data: { items: [{ _id: this.productId, qty: 1 }], addressId: addr._id, remark }
      });
      wx.hideLoading();
      const r = cf && cf.result;
      if (!r || !r.success) throw new Error((r && r.error) || '提交失败');
      const text =
        '【兑换申请·加加好物图集】\n' +
        `礼品：${p.title}\n` +
        `备注：${remark}\n` +
        `收件人：${addr.recipient} ${addr.phone}\n` +
        `地址：${addr.province || ''}${addr.city || ''}${addr.district || ''}${addr.detail || ''}\n` +
        '（已提交系统，麻烦客服核验后发货~）';
      const finish = () => {
        // 已下单，从心愿单移除该件，避免回到心愿单再次重复提交
        wishlist.remove(this.productId);
        this.setData({ showSubmit: false, submitRemark: '', wishlisted: false, submitting: false });
        wx.showModal({
          title: '提交成功',
          content: '申请信息已复制到剪贴板，请粘贴发送给客服微信核验，核验后发货。',
          confirmText: '去找客服',
          cancelText: '知道了',
          confirmColor: '#d64b2a',
          success: (res) => { if (res.confirm) this.showQrcode(); }
        });
      };
      wx.setClipboardData({ data: text, success: finish, fail: finish });
    } catch (err) {
      wx.hideLoading();
      console.error('submit from product failed', err);
      this.setData({ submitting: false });
      wx.showToast({ title: err.message || '提交失败', icon: 'none' });
    }
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
