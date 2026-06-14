const wishlist = require('./utils/wishlist.js');

App({
  onLaunch(options) {
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
    this.tryBindReferrer(options);
  },

  // 冷启动后台唤起都会带 options（分享卡片 query.ref / 小程序码 query.scene）
  onShow(options) {
    this.tryBindReferrer(options);
  },

  // 通过分享卡片或推荐小程序码进入 → 自动绑定推荐人（幂等：已绑定/绑自己会被云端忽略）
  tryBindReferrer(options) {
    if (!wx.cloud) return;
    const code = this._extractRefCode(options);
    if (!code || this._bindTriedFor === code) return;
    this._bindTriedFor = code;
    wx.cloud.callFunction({ name: 'referral', data: { action: 'bind-referrer', code } })
      .catch((err) => { console.warn('bind-referrer failed', err); });
  },

  _extractRefCode(options) {
    if (!options) return '';
    const q = options.query || {};
    let raw = '';
    if (q.ref) {
      raw = String(q.ref);
    } else if (q.scene) {
      try { raw = decodeURIComponent(String(q.scene)); } catch (e) { raw = String(q.scene); }
    }
    if (!raw) return '';
    // scene 可能是 "ref=123456" 形式，也可能是纯 "123456"
    if (raw.indexOf('=') >= 0) {
      const m = raw.match(/(?:^|&)ref=([^&]+)/);
      raw = m ? m[1] : raw;
    }
    return /^\d{6}$/.test(raw) ? raw : '';
  },

  globalData: {
    cloudEnvId: 'cloud1-d0gtch1v896d24828'
  }
});
