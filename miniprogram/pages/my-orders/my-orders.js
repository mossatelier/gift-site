const auth = require('../../utils/auth.js');
const { listMyOrders } = require('../../utils/db.js');

const STATUS_LABEL = {
  pending: '待处理',
  done: '已发货',
  cancelled: '已取消'
};

Page({
  data: {
    loading: true,
    orders: []
  },

  onShow() {
    if (!auth.ensureLogin('/pages/my-orders/my-orders')) return;
    this.refresh();
  },

  onPullDownRefresh() {
    this.refresh().then(() => wx.stopPullDownRefresh());
  },

  async refresh() {
    const user = auth.getCurrentUser();
    if (!user) return;
    this.setData({ loading: true });
    try {
      const raw = await listMyOrders(user.openid, { limit: 50 });
      const orders = raw.map(o => ({
        _id: o._id,
        status: o.status || 'pending',
        statusLabel: STATUS_LABEL[o.status] || '待处理',
        itemCount: o.itemCount || (o.items && o.items.length) || 0,
        totalCards: o.totalCards || 0,
        firstImage: (o.items && o.items[0] && o.items[0].imageUrl) || '',
        firstTitle: (o.items && o.items[0] && o.items[0].title) || '',
        createdText: formatDate(o.createdAt)
      }));
      this.setData({ orders, loading: false });
    } catch (err) {
      console.error('load orders failed', err);
      this.setData({ loading: false });
      wx.showToast({ title: '加载失败', icon: 'none' });
    }
  },

  goDetail(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({ url: `/pages/order-detail/order-detail?id=${id}` });
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
