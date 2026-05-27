Page({
  previewImage() {
    wx.previewImage({
      urls: ['/images/guide-card-flow.jpg'],
      current: '/images/guide-card-flow.jpg'
    });
  },

  onShareAppMessage() {
    return {
      title: '办卡流程 · 加加好物图集',
      path: '/pages/card-flow/card-flow'
    };
  }
});
