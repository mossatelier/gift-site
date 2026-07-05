// 隐私协议同意勾选行：☐ 我已阅读并同意《用户服务协议》和《隐私政策》
// 勾选状态写入 storage（utils/consent.js），页面提交前用 consent.requireConsent() 校验。
const consent = require('../../utils/consent.js');

Component({
  data: {
    checked: false
  },

  lifetimes: {
    attached() {
      this.setData({ checked: consent.hasConsent() });
    }
  },

  pageLifetimes: {
    // 从协议页返回时刷新（防止多页勾选状态不同步）
    show() {
      const now = consent.hasConsent();
      if (now !== this.data.checked) this.setData({ checked: now });
    }
  },

  methods: {
    toggle() {
      const next = !this.data.checked;
      consent.setConsent(next);
      this.setData({ checked: next });
      this.triggerEvent('change', { checked: next });
    },

    goTerms() {
      wx.navigateTo({ url: '/pages/agreement/agreement?type=terms' });
    },

    goPrivacy() {
      wx.navigateTo({ url: '/pages/agreement/agreement?type=privacy' });
    }
  }
});
