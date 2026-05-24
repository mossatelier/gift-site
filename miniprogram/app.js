App({
  onLaunch() {
    if (!wx.cloud) {
      console.error('当前微信开发者工具版本过低，请升级至最新版本以支持云开发');
      return;
    }
    wx.cloud.init({
      env: this.globalData.cloudEnvId,
      traceUser: true
    });
  },
  globalData: {
    cloudEnvId: 'cloud1-d0gtch1v896d24828'
  }
});
