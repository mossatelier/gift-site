// 用户服务协议 / 隐私政策 页
// 入参 type=terms(服务协议) / privacy(隐私政策)，默认 privacy。
// 内容为静态文案（审核要求：明确告知收集手机号/地址的目的、方式、用途）。
Page({
  data: {
    type: 'privacy'
  },

  onLoad(options) {
    const type = options && options.type === 'terms' ? 'terms' : 'privacy';
    this.setData({ type });
    wx.setNavigationBarTitle({ title: type === 'terms' ? '用户服务协议' : '隐私政策' });
  },

  switchType(e) {
    const type = e.currentTarget.dataset.type;
    if (!type || type === this.data.type) return;
    this.setData({ type });
    wx.setNavigationBarTitle({ title: type === 'terms' ? '用户服务协议' : '隐私政策' });
  }
});
