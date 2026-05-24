Page({
  previewImage() {
    wx.previewImage({
      urls: ['/images/guide-card-flow.jpg'],
      current: '/images/guide-card-flow.jpg'
    });
  },

  onShareAppMessage() {
    return {
      title: '办卡流程 · 加加办卡礼品馆',
      path: '/pages/card-flow/card-flow'
    };
  }
});
