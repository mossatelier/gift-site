Page({
  previewImage() {
    wx.previewImage({
      urls: ['/images/guide-claim.jpg'],
      current: '/images/guide-claim.jpg'
    });
  },

  onShareAppMessage() {
    return {
      title: '领取须知 · 加加好物图集',
      path: '/pages/claim-guide/claim-guide'
    };
  }
});
