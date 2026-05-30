const auth = require('../../utils/auth.js');

const MAX_IMAGES = 9;

Page({
  data: {
    orderId: '',
    productId: '',
    productTitle: '',
    productImage: '',
    images: [],        // 本地临时路径，提交时上传云存储
    content: '',
    rating: 5,
    submitting: false,
    maxImages: MAX_IMAGES
  },

  onLoad(query) {
    const orderId = (query && query.orderId) || '';
    const productId = (query && query.productId) || '';
    const productTitle = query && query.title ? decodeURIComponent(query.title) : '';
    const productImage = query && query.image ? decodeURIComponent(query.image) : '';
    this.setData({ orderId, productId, productTitle, productImage });
    const back = `/pages/review-edit/review-edit?orderId=${orderId}&productId=${productId}`;
    if (!auth.ensureLogin(back)) return;
  },

  chooseImage() {
    const remain = MAX_IMAGES - this.data.images.length;
    if (remain <= 0) {
      wx.showToast({ title: `最多 ${MAX_IMAGES} 张`, icon: 'none' });
      return;
    }
    wx.chooseMedia({
      count: remain,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      sizeType: ['compressed'],
      success: (res) => {
        const paths = res.tempFiles.map(f => f.tempFilePath);
        this.setData({ images: this.data.images.concat(paths).slice(0, MAX_IMAGES) });
      }
    });
  },

  previewImage(e) {
    const idx = e.currentTarget.dataset.index;
    wx.previewImage({ urls: this.data.images, current: this.data.images[idx] });
  },

  removeImage(e) {
    const idx = e.currentTarget.dataset.index;
    const images = this.data.images.slice();
    images.splice(idx, 1);
    this.setData({ images });
  },

  onContent(e) {
    this.setData({ content: e.detail.value });
  },

  setRating(e) {
    this.setData({ rating: Number(e.currentTarget.dataset.value) });
  },

  async onSubmit() {
    if (this.data.submitting) return;
    if (this.data.images.length === 0) {
      wx.showToast({ title: '请至少上传一张图片', icon: 'none' });
      return;
    }
    if (!auth.ensureLogin()) return;

    this.setData({ submitting: true });
    wx.showLoading({ title: '上传中…', mask: true });
    try {
      // 1. 上传图片到云存储
      const openid = (auth.getCurrentUser() || {}).openid || 'anon';
      const fileIDs = [];
      for (let i = 0; i < this.data.images.length; i++) {
        const p = this.data.images[i];
        const ext = (p.split('.').pop() || 'jpg').split('?')[0];
        const up = await wx.cloud.uploadFile({
          cloudPath: `reviews/${openid}-${Date.now()}-${i}.${ext}`,
          filePath: p
        });
        if (up.fileID) fileIDs.push(up.fileID);
      }
      if (fileIDs.length === 0) throw new Error('图片上传失败');

      // 2. 提交评价
      const cf = await wx.cloud.callFunction({
        name: 'submit-review',
        data: {
          orderId: this.data.orderId,
          productId: this.data.productId,
          images: fileIDs,
          content: this.data.content,
          rating: this.data.rating
        }
      });
      wx.hideLoading();
      const r = cf && cf.result;
      if (!r || !r.success) throw new Error((r && r.error) || '提交失败');

      wx.showModal({
        title: '晒图成功',
        content: '感谢分享！审核通过后会展示在种草页。',
        showCancel: false,
        confirmText: '知道了',
        success: () => wx.navigateBack()
      });
    } catch (err) {
      wx.hideLoading();
      console.error('submit review failed', err);
      wx.showToast({ title: err.message || '提交失败', icon: 'none' });
    } finally {
      this.setData({ submitting: false });
    }
  }
});
