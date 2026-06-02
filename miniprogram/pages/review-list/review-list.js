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

  // 举报晒图：选理由 → report-review 云函数写入 reports 集合，供后台处理。
  onReport(e) {
    const id = e.currentTarget.dataset.id;
    if (!id) return;
    const reasons = ['色情低俗', '广告/导流', '虚假信息', '侵权/抄袭', '其他'];
    wx.showActionSheet({
      itemList: reasons,
      success: (res) => {
        wx.cloud.callFunction({
          name: 'report-review',
          data: { reviewId: id, reason: reasons[res.tapIndex] }
        }).then((cf) => {
          const ok = cf && cf.result && cf.result.success;
          wx.showToast({ title: ok ? '已收到举报，感谢反馈' : '举报失败，请重试', icon: 'none' });
        }).catch(() => {
          wx.showToast({ title: '举报失败，请重试', icon: 'none' });
        });
      }
    });
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
