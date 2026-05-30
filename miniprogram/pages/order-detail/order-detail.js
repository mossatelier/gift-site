const auth = require('../../utils/auth.js');
const { getMyOrder, getMyReviewForOrder } = require('../../utils/db.js');

const STATUS_LABEL = {
  pending: '待处理',
  processing: '处理中',
  done: '已完成',
  cancelled: '已取消'
};

Page({
  data: {
    loading: true,
    order: null,
    statusLabel: '',
    createdText: '',
    canReview: false,   // 已完成且未晒过
    reviewed: false     // 已晒过
  },

  onLoad(query) {
    this.orderId = query && query.id;
    if (!auth.ensureLogin(`/pages/order-detail/order-detail?id=${this.orderId || ''}`)) return;
    this.load();
  },

  onShow() {
    // 从晒图页返回时刷新晒图状态
    if (this.orderId && this.data.order) this.refreshReviewState();
  },

  async load() {
    const user = auth.getCurrentUser();
    if (!user || !this.orderId) {
      this.setData({ loading: false });
      return;
    }
    try {
      const order = await getMyOrder(user.openid, this.orderId);
      if (!order) {
        wx.showToast({ title: '订单不存在', icon: 'none' });
        setTimeout(() => wx.navigateBack(), 600);
        return;
      }
      this.setData({
        order,
        statusLabel: STATUS_LABEL[order.status] || '待处理',
        createdText: formatDate(order.createdAt),
        loading: false
      });
      this.refreshReviewState();
    } catch (err) {
      console.error(err);
      this.setData({ loading: false });
      wx.showToast({ title: '加载失败', icon: 'none' });
    }
  },

  async refreshReviewState() {
    const user = auth.getCurrentUser();
    const order = this.data.order;
    if (!user || !order || order.status !== 'done') {
      this.setData({ canReview: false, reviewed: false });
      return;
    }
    try {
      const existing = await getMyReviewForOrder(user.openid, this.orderId);
      this.setData({ reviewed: !!existing, canReview: !existing });
    } catch (err) {
      this.setData({ canReview: true, reviewed: false });
    }
  },

  goReview() {
    const order = this.data.order;
    const first = order && Array.isArray(order.items) && order.items[0];
    const title = first ? encodeURIComponent(first.title || '') : '';
    const image = first ? encodeURIComponent(first.imageUrl || '') : '';
    const productId = first ? (first.productId || '') : '';
    wx.navigateTo({
      url: `/pages/review-edit/review-edit?orderId=${this.orderId}&productId=${productId}&title=${title}&image=${image}`
    });
  },

  copyOrderId() {
    if (!this.orderId) return;
    wx.setClipboardData({
      data: this.orderId,
      success: () => wx.showToast({ title: '订单号已复制', icon: 'success' })
    });
  },

  copyTracking() {
    const no = this.data.order && this.data.order.trackingNo;
    if (!no) return;
    wx.setClipboardData({
      data: no,
      success: () => wx.showToast({ title: '单号已复制，可去物流平台查询', icon: 'none' })
    });
  },

  contactService() {
    wx.previewImage({
      urls: ['/images/wishlist-wechat-qr.jpg'],
      current: '/images/wishlist-wechat-qr.jpg'
    });
  }
});

function formatDate(d) {
  if (!d) return '';
  try {
    const date = typeof d === 'string' ? new Date(d) : d;
    const pad = n => String(n).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
  } catch (err) {
    return '';
  }
}
