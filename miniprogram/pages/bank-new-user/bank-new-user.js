Page({
  previewImage() {
    wx.previewImage({
      urls: ['/images/guide-bank-new-user.jpg'],
      current: '/images/guide-bank-new-user.jpg'
    });
  },

  onShareAppMessage() {
    return {
      title: '银行新户 · 加加办卡礼品馆',
      path: '/pages/bank-new-user/bank-new-user'
    };
  }
});
