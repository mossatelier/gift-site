const { listBanks } = require('../../utils/db.js');

// 兜底数据（云开发 banks_earn 集合还没建/还没同步时使用）
const FALLBACK_BANKS = [
  { name: '中信银行', points: 8, sortOrder: 3 },
  { name: '平安银行', points: 8, sortOrder: 5 },
  { name: '浦发银行', points: 7, sortOrder: 2 },
  { name: '兴业银行', points: 7, sortOrder: 4 },
  { name: '交通银行', points: 6, sortOrder: 6 },
  { name: '招商银行', points: 5, sortOrder: 1 }
];

Page({
  data: {
    banks: FALLBACK_BANKS
  },

  onLoad() {
    this.refreshBanks();
  },

  onPullDownRefresh() {
    this.refreshBanks().then(() => wx.stopPullDownRefresh());
  },

  async refreshBanks() {
    try {
      const banks = await listBanks();
      if (banks && banks.length > 0) {
        this.setData({ banks });
      }
    } catch (err) {
      console.warn('云开发 banks_earn 集合未就绪，使用兜底数据', err);
    }
  },

  onShareAppMessage() {
    return {
      title: '获取积分 · 银行积分对照',
      path: '/pages/earn/earn'
    };
  }
});
