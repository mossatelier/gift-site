const wishlist = require('./utils/wishlist.js');

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
    // 已登录用户启动时尝试拉一次心愿单（多设备同步）
    setTimeout(() => {
      wishlist.pullAndMerge();
    }, 500);
  },
  globalData: {
    cloudEnvId: 'cloud1-d0gtch1v896d24828'
  }
});
