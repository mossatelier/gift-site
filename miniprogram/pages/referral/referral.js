const auth = require('../../utils/auth.js');

const RULES = [
  '把你的专属推荐码 / 分享卡片发给新朋友；',
  '新朋友联系客服微信办卡，办卡时报上你的推荐码；',
  '好友银行开户成功后，奖励积分自动到账；',
  '好友 30 天内开户均算有效推荐（伴侣及凑卡不算）。'
];

Page({
  data: {
    loading: true,
    code: '',
    nickName: '',
    stats: { total: 0, opened: 0, rewardPoints: 0 },
    list: [],
    rules: RULES,
    showPoster: false,
    posterImg: ''
  },

  onLoad() {
    if (!auth.ensureLogin('/pages/referral/referral')) return;
    wx.showShareMenu && wx.showShareMenu({ withShareTicket: false, menus: ['shareAppMessage'] });
    this.load();
  },

  onShow() {
    // 返回本页时刷新（如客服刚标记开户/加了积分）
    if (this._loadedOnce) this.load();
  },

  async load() {
    this.setData({ loading: true });
    try {
      const cf = await wx.cloud.callFunction({ name: 'referral', data: { action: 'get-my-referral' } });
      const r = cf && cf.result;
      if (!r || !r.success) throw new Error((r && r.error) || '加载失败');
      this.setData({
        loading: false,
        code: r.code || '',
        nickName: r.nickName || '微信用户',
        stats: r.stats || { total: 0, opened: 0, rewardPoints: 0 },
        list: (r.list || []).map(it => ({
          ...it,
          createdText: formatDate(it.createdAt),
          isOk: it.status === '开户成功'
        }))
      });
      this._loadedOnce = true;
    } catch (err) {
      console.error('load referral failed', err);
      this.setData({ loading: false });
      wx.showToast({ title: err.message || '加载失败', icon: 'none' });
    }
  },

  copyCode() {
    if (!this.data.code) return;
    wx.setClipboardData({
      data: this.data.code,
      success: () => wx.showToast({ title: '推荐码已复制', icon: 'success' })
    });
  },

  noop() {},
  closePoster() { this.setData({ showPoster: false }); },

  // 生成推荐海报（带小程序码；未发布时降级为无码海报）
  async makePoster() {
    if (!this.data.code) return;
    wx.showLoading({ title: '生成中…', mask: true });
    let qr = '';
    try {
      const cf = await wx.cloud.callFunction({ name: 'referral', data: { action: 'get-qr' } });
      if (cf && cf.result && cf.result.success) qr = cf.result.qr;
    } catch (e) { /* 降级无码 */ }
    try {
      const tempPath = await this._drawPoster(qr);
      wx.hideLoading();
      this.setData({ posterImg: tempPath, showPoster: true });
    } catch (e) {
      console.error('poster failed', e);
      wx.hideLoading();
      wx.showToast({ title: '海报生成失败', icon: 'none' });
    }
  },

  _drawPoster(qrBase64) {
    var self = this;
    return new Promise(function (resolve, reject) {
      wx.createSelectorQuery().select('#posterCanvas').fields({ node: true, size: true }).exec(function (res) {
        var node = res && res[0] && res[0].node;
        if (!node) { reject(new Error('canvas 未就绪')); return; }
        var W = 600, H = 920, dpr = 2;
        node.width = W * dpr; node.height = H * dpr;
        var ctx = node.getContext('2d');
        ctx.scale(dpr, dpr);

        var grad = ctx.createLinearGradient(0, 0, 0, H);
        grad.addColorStop(0, '#ff8a3d'); grad.addColorStop(1, '#e8531f');
        ctx.fillStyle = grad; ctx.fillRect(0, 0, W, H);

        ctx.textAlign = 'center';
        ctx.fillStyle = '#fff'; ctx.font = 'bold 44px sans-serif';
        ctx.fillText('🎁 加加好物图集', W / 2, 90);

        ctx.fillStyle = '#ffffff';
        roundRect(ctx, 40, 130, W - 80, H - 210, 28); ctx.fill();

        ctx.fillStyle = '#2e2318'; ctx.font = 'bold 42px sans-serif';
        ctx.fillText('办卡免费领好礼', W / 2, 212);
        ctx.fillStyle = '#8a7c66'; ctx.font = '24px sans-serif';
        ctx.fillText('用我的推荐码，办卡更省心~', W / 2, 256);

        ctx.fillStyle = '#8a7c66'; ctx.font = '24px sans-serif';
        ctx.fillText('我的专属推荐码', W / 2, 332);
        ctx.fillStyle = '#e8531f'; ctx.font = 'bold 88px sans-serif';
        ctx.fillText(self.data.code, W / 2, 412);

        var finish = function () {
          ctx.fillStyle = '#8a7c66'; ctx.font = '24px sans-serif';
          ctx.fillText(qrBase64 ? '长按图片 / 扫码进入小程序' : '微信搜索小程序：加加好物图集', W / 2, H - 116);
          wx.canvasToTempFilePath({ canvas: node, success: function (r) { resolve(r.tempFilePath); }, fail: reject });
        };

        if (qrBase64) {
          var img = node.createImage();
          img.onload = function () { ctx.drawImage(img, W / 2 - 130, 470, 260, 260); finish(); };
          img.onerror = function () { finish(); };
          img.src = qrBase64;
        } else {
          finish();
        }
      });
    });
  },

  savePoster() {
    var path = this.data.posterImg;
    if (!path) return;
    wx.saveImageToPhotosAlbum({
      filePath: path,
      success: function () { wx.showToast({ title: '已保存到相册', icon: 'success' }); },
      fail: function (err) {
        if (/auth|deny|authorize/i.test(JSON.stringify(err || {}))) {
          wx.showModal({
            title: '需要相册权限',
            content: '请在设置里允许“保存到相册”，再重试。',
            confirmText: '去设置',
            success: function (r) { if (r.confirm) wx.openSetting(); }
          });
        } else {
          wx.showToast({ title: '保存失败', icon: 'none' });
        }
      }
    });
  },

  // 分享卡片带上我的推荐码（好友打开后自动绑定 → 见 app.js）
  onShareAppMessage() {
    const code = this.data.code;
    return {
      title: '加加好物图集 · 办卡免费领好礼，用我的推荐码更省心',
      path: `/pages/index/index${code ? '?ref=' + code : ''}`
    };
  }
});

function formatDate(d) {
  if (!d) return '';
  try {
    const date = typeof d === 'string' ? new Date(d) : d;
    const pad = n => String(n).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  } catch (e) {
    return '';
  }
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
