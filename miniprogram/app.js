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

  // 同一次入口的绑定先完成，登录才能创建账号，避免新人被并发登录误判为老用户。
  // 暂时失败保留推荐码；下次 onShow 或点击登录会重试。
  tryBindReferrer(options) {
    const incoming = this._extractRefCode(options);
    if (incoming && incoming !== this._bindTriedFor) this._pendingRefCode = incoming;
    if (!this._pendingRefCode) return Promise.resolve({ success: true, skipped: 'no-pending-code' });
    if (this._bindPending) return this._bindPending;
    this._bindPending = this._drainReferralBinding().finally(() => { this._bindPending = null; });
    return this._bindPending;
  },

  async _drainReferralBinding() {
    while (this._pendingRefCode) {
      const code = this._pendingRefCode;
      let result;
      try {
        if (!wx.cloud) throw new Error('云服务暂不可用');
        const response = await wx.cloud.callFunction({ name: 'referral', data: { action: 'bind-referrer', code } });
        result = response && response.result;
      } catch (err) {
        console.warn('bind-referrer failed', err);
      }
      // terminal 来自新版云函数；精确文案兼容旧服务对无效码/自荐的响应。
      const terminal = result && (result.success || result.terminal === true ||
        ['缺少推荐码', '推荐码无效', '不能推荐自己', '不能绑定自己的推荐码'].includes(result.error));
      if (terminal) {
        this._bindTriedFor = code;
        if (this._pendingRefCode === code) this._pendingRefCode = '';
        if (!this._pendingRefCode) return result;
      } else if (this._pendingRefCode === code) {
        return { success: false, retryable: true, error: '推荐关系暂未确认，请重试登录，避免遗漏推荐记录' };
      }
    }
    return { success: true };
  },

  async waitForReferralBeforeLogin() {
    const result = await this.tryBindReferrer();
    if (result && result.retryable) throw new Error(result.error);
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
