// 悬浮「咨询」按钮的拖动 + 吸附逻辑（各页 Page 用 ...floatBtn 混入）
// 依赖页面 data.floatStyle；按钮约 48px(96rpx)
module.exports = {
  onFloatMove(e) {
    const t = e.touches && e.touches[0];
    if (!t) return;
    this._floatDragging = true;
    this.setData({
      floatStyle: `left:${t.clientX - 24}px;top:${t.clientY - 24}px;right:auto;bottom:auto;`
    });
  },

  onFloatEnd(e) {
    if (!this._floatDragging) return;
    this._floatDragging = false;
    this._floatJustDragged = true;
    setTimeout(() => { this._floatJustDragged = false; }, 120);
    const t = (e.changedTouches && e.changedTouches[0]) || {};
    const info = this._floatWin || (this._floatWin = wx.getSystemInfoSync());
    const W = info.windowWidth || 375;
    const H = info.windowHeight || 667;
    const x = (t.clientX || 0) < W / 2 ? 10 : W - 58;          // 吸附左/右边
    const y = Math.max(80, Math.min((t.clientY || 0) - 24, H - 180));
    this.setData({ floatStyle: `left:${x}px;top:${y}px;right:auto;bottom:auto;` });
  },

  floatService() {
    if (this._floatJustDragged) return;   // 刚拖动完不误触发
    wx.previewImage({ urls: ['/images/wechat-qr.jpg'], current: '/images/wechat-qr.jpg' });
  }
};
