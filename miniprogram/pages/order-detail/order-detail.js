const auth = require('../../utils/auth.js');
const { getMyOrder } = require('../../utils/db.js');

// 旧码兼容：processing→pending、done→shipped、closed→signed
const STATUS_LEGACY = { processing: 'pending', done: 'shipped', closed: 'signed' };
function normStatus(s) { return STATUS_LEGACY[s] || s || 'pending'; }

const STATUS_LABEL = {
  pending: '待处理',
  preparing: '待发货',
  shipped: '运输中',
  signed: '已签收',
  cancelled: '已取消'
};
const STATUS_DESC = {
  pending: '客服已收到申请，将尽快处理',
  preparing: '商家已接单，商品准备中',
  shipped: '礼品运输中，可在下方查看物流',
  signed: '礼品已签收，感谢支持，欢迎再来～',
  cancelled: '订单已取消'
};
// 进度步骤条（已取消不走此流程）
const STEPS = [
  { key: 'pending', label: '待处理' },
  { key: 'preparing', label: '待发货' },
  { key: 'shipped', label: '运输中' },
  { key: 'signed', label: '已签收' }
];

Page({
  data: {
    loading: true,
    order: null,
    statusCode: 'pending',
    statusLabel: '',
    statusDesc: '',
    steps: [],
    isCancelled: false,
    nodes: [],          // 物流节点（快递接口接入后有值）
    signedText: '',
    signedBy: '',
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
      const code = normStatus(order.status);
      const stepIndex = STEPS.findIndex(s => s.key === code);
      const steps = STEPS.map((s, i) => ({
        label: s.label,
        done: stepIndex >= 0 && i <= stepIndex,
        current: i === stepIndex
      }));
      const nodes = Array.isArray(order.logisticsNodes)
        ? order.logisticsNodes.map(n => ({
            time: formatDate(n.time || n.ftime),
            context: n.context || n.status || ''
          }))
        : [];
      this.setData({
        order,
        statusCode: code,
        statusLabel: STATUS_LABEL[code] || '待处理',
        statusDesc: STATUS_DESC[code] || STATUS_DESC.pending,
        steps,
        isCancelled: code === 'cancelled',
        nodes,
        signedText: order.signedAt ? formatDate(order.signedAt) : '',
        signedBy: order.signedBy || '',
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
    if (isNaN(date.getTime())) return typeof d === 'string' ? d : '';
    const pad = n => String(n).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
  } catch (err) {
    return '';
  }
}
