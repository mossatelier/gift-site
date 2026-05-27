Page({
  data: {
    promos: [
      {
        tag: '最新活动',
        title: '商城新版上线',
        text: '新版礼品商城正式上线，全新分类和心愿单功能上线，欢迎体验。',
        time: '2026-05-09'
      },
      {
        tag: '活动预告',
        title: '银行办卡专享礼',
        text: '最新银行活动持续更新，关注本页可第一时间获取最新福利信息。',
        time: '持续更新'
      }
    ]
  },

  goWishlist() {
    wx.switchTab({ url: '/pages/wishlist/wishlist' });
  },

  onShareAppMessage() {
    return {
      title: '特惠通知 · 加加好物图集',
      path: '/pages/promo/promo'
    };
  }
});
