const auth = require('../../utils/auth.js');
const { listMyOrders } = require('../../utils/db.js');
const PAGE_SIZE = 20;

// 旧码兼容：processing/preparing→pending、done→shipped、closed→signed
const STATUS_LEGACY = { processing: 'pending', preparing: 'pending', done: 'shipped', closed: 'signed' };
function normStatus(s) { return STATUS_LEGACY[s] || s || 'pending'; }
const STATUS_LABEL = {
  pending: '待发货',
  shipped: '运输中',
  signed: '已签收',
  cancelled: '已取消'
};

Page({
  data: {
    loading: true,
    orders: [],
    skip: 0,
    noMore: false,
    loadError: false
  },

  onShow() {
    if (!auth.ensureLogin('/pages/my-orders/my-orders')) return;
    this.refresh();
  },

  onPullDownRefresh() {
    this.refresh().then(() => wx.stopPullDownRefresh());
  },

  onHide() {
    this._loadRequest = (this._loadRequest || 0) + 1;
  },

  onReachBottom() { this.loadMore(); },

  async refresh() {
    const request = this._loadRequest = (this._loadRequest || 0) + 1;
    this.setData({ orders: [], skip: 0, noMore: false, loadError: false, loading: false });
    await this.loadMore(request);
  },

  async loadMore(request = this._loadRequest) {
    // bindtap 会传事件对象，只有 refresh 的数字参数代表请求批次。
    if (typeof request !== 'number') request = this._loadRequest;
    if (this.data.loading || this.data.noMore) return;
    const user = auth.getCurrentUser();
    if (!user) return;
    const { skip } = this.data;
    this.setData({ loading: true, loadError: false });
    const isCurrent = () => request === this._loadRequest &&
      (auth.getCurrentUser() || {}).openid === user.openid;
    try {
      const raw = await listMyOrders(user.openid, { limit: PAGE_SIZE, skip });
      if (!isCurrent()) return;
      const orders = raw.map(o => ({
        _id: o._id,
        status: normStatus(o.status),
        statusLabel: STATUS_LABEL[normStatus(o.status)] || '待处理',
        itemCount: o.itemCount || (o.items && o.items.length) || 0,
        totalCards: o.totalCards || 0,
        firstImage: (o.items && o.items[0] && o.items[0].imageUrl) || '',
        firstTitle: (o.items && o.items[0] && o.items[0].title) || '',
        createdText: formatDate(o.createdAt)
      }));
      const seen = new Set(this.data.orders.map(o => o._id));
      this.setData({
        orders: this.data.orders.concat(orders.filter(o => !seen.has(o._id))),
        skip: skip + raw.length,
        noMore: raw.length < PAGE_SIZE,
        loading: false
      });
    } catch (err) {
      if (!isCurrent()) return;
      console.error('load orders failed', err);
      this.setData({ loading: false, loadError: true });
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
