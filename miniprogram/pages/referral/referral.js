const auth = require('../../utils/auth.js');

const RULES = [
  '把你的专属推荐码 / 分享卡片发给新朋友；',
  '新朋友联系客服微信办卡，办卡时报上你的推荐码；',
  '好友银行开户成功后，奖励积分自动到账；',
  '好友 30 天内开户均算有效推荐（伴侣及凑卡不算）。'
];

Page({
  data: {
    loading: true,
    code: '',
    nickName: '',
    stats: { total: 0, opened: 0, rewardPoints: 0 },
    list: [],
    rules: RULES
  },

  onLoad() {
    if (!auth.ensureLogin('/pages/referral/referral')) return;
    wx.showShareMenu && wx.showShareMenu({ withShareTicket: false, menus: ['shareAppMessage'] });
    this.load();
  },

  onShow() {
    // 返回本页时刷新（如客服刚标记开户/加了积分）
    if (this._loadedOnce) this.load();
  },

  async load() {
    this.setData({ loading: true });
    try {
      const cf = await wx.cloud.callFunction({ name: 'referral', data: { action: 'get-my-referral' } });
      const r = cf && cf.result;
      if (!r || !r.success) throw new Error((r && r.error) || '加载失败');
      this.setData({
        loading: false,
        code: r.code || '',
        nickName: r.nickName || '微信用户',
        stats: r.stats || { total: 0, opened: 0, rewardPoints: 0 },
        list: (r.list || []).map(it => ({
          ...it,
          createdText: formatDate(it.createdAt),
          isOk: it.status === '开户成功'
        }))
      });
      this._loadedOnce = true;
    } catch (err) {
      console.error('load referral failed', err);
      this.setData({ loading: false });
      wx.showToast({ title: err.message || '加载失败', icon: 'none' });
    }
  },

  copyCode() {
    if (!this.data.code) return;
    wx.setClipboardData({
      data: this.data.code,
      success: () => wx.showToast({ title: '推荐码已复制', icon: 'success' })
    });
  },

  // 分享卡片带上我的推荐码（好友打开后自动绑定 → 见 app.js）
  onShareAppMessage() {
    const code = this.data.code;
    return {
      title: '加加好物图集 · 办卡免费领好礼，用我的推荐码更省心',
      path: `/pages/index/index${code ? '?ref=' + code : ''}`
    };
  }
});

function formatDate(d) {
  if (!d) return '';
  try {
    const date = typeof d === 'string' ? new Date(d) : d;
    const pad = n => String(n).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  } catch (e) {
    return '';
  }
}
