const auth = require('../../utils/auth.js');

function formatDateTime(d) {
  if (!d) return '';
  try {
    const date = typeof d === 'string' ? new Date(d) : d;
    const pad = n => String(n).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
  } catch (e) {
    return '';
  }
}

Page({
  data: {
    loading: true,
    rewardPoints: 0,
    items: []
  },

  onLoad() {
    if (!auth.ensureLogin('/pages/points/points')) return;
    this.load();
  },

  onPullDownRefresh() {
    this.load().then(() => wx.stopPullDownRefresh());
  },

  async load() {
    this.setData({ loading: true });
    try {
      const cf = await wx.cloud.callFunction({ name: 'referral', data: { action: 'get-my-points' } });
      const r = cf && cf.result;
      if (!r || !r.success) throw new Error((r && r.error) || '加载失败');
      this.setData({
        loading: false,
        rewardPoints: r.rewardPoints || 0,
        items: (r.items || []).map(it => ({
          ...it,
          timeText: formatDateTime(it.createdAt),
          isIncome: it.delta > 0
        }))
      });
    } catch (err) {
      console.error('load points ledger failed', err);
      this.setData({ loading: false });
      wx.showToast({ title: err.message || '加载失败', icon: 'none' });
    }
  },

  goReferral() {
    wx.navigateTo({ url: '/pages/referral/referral' });
  }
});
