const auth = require('../../utils/auth.js');
const { getMyOrder } = require('../../utils/db.js');

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
    createdText: ''
  },

  onLoad(query) {
    this.orderId = query && query.id;
    if (!auth.ensureLogin(`/pages/order-detail/order-detail?id=${this.orderId || ''}`)) return;
    this.load();
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
    } catch (err) {
      console.error(err);
      this.setData({ loading: false });
      wx.showToast({ title: '加载失败', icon: 'none' });
    }
  },

  copyOrderId() {
    if (!this.orderId) return;
    wx.setClipboardData({
      data: this.orderId,
      success: () => wx.showToast({ title: '订单号已复制', icon: 'success' })
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
