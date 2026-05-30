const { listApprovedReviews } = require('../../utils/db.js');

const PAGE = 20;

function formatReview(r) {
  return {
    _id: r._id,
    nickName: r.nickName || '微信用户',
    avatarUrl: r.avatarUrl || '',
    rating: Number(r.rating) || 0,
    content: r.content || '',
    images: Array.isArray(r.images) ? r.images : [],
    productTitle: r.productTitle || '',
    productId: r.productId || '',
    createdText: formatDate(r.createdAt)
  };
}

Page({
  data: {
    loading: true,
    reviews: [],
    page: 0,
    noMore: false
  },

  onLoad() {
    this.load();
  },

  onReachBottom() {
    if (!this.data.noMore && !this._loading) this.load();
  },

  onPullDownRefresh() {
    this.setData({ reviews: [], page: 0, noMore: false });
    this.load().then(() => wx.stopPullDownRefresh());
  },

  async load() {
    this._loading = true;
    try {
      const rows = await listApprovedReviews({ limit: PAGE, skip: this.data.page * PAGE });
      const reviews = this.data.reviews.concat(rows.map(formatReview));
      this.setData({
        reviews,
        loading: false,
        page: this.data.page + 1,
        noMore: rows.length < PAGE
      });
    } catch (err) {
      console.error('load reviews failed', err);
      this.setData({ loading: false });
    } finally {
      this._loading = false;
    }
  },

  previewImage(e) {
    const { urls, current } = e.currentTarget.dataset;
    wx.previewImage({ urls, current });
  },

  goProduct(e) {
    const id = e.currentTarget.dataset.id;
    if (!id) return;
    wx.navigateTo({ url: `/pages/product/product?id=${id}` });
  },

  onShareAppMessage() {
    return { title: '加加好物图集 · 大家的晒图种草', path: '/pages/review-list/review-list' };
  }
});

function formatDate(d) {
  if (!d) return '';
  try {
    const date = typeof d === 'string' ? new Date(d) : d;
    const pad = n => String(n).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  } catch (err) {
    return '';
  }
}
