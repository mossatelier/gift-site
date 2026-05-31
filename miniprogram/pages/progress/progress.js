// 银行办卡进度查询：列表显示 logo，点「查看二维码」才展开二维码，长按识别跳转，复制链接兜底
// 顺序：中信 / 平安 / 浦发 / 交通 / 招商 / 兴业 / 民生
const BANKS = [
  {
    key: 'citic',
    name: '中信银行',
    logo: '/images/banks/citic.jpg',
    qr: '/images/progress/citic-v2.png',
    url: 'https://e.creditcard.ecitic.com/citiccard/ebank-ocp/bsvc-card/index.html#/cardInput'
  },
  {
    key: 'pingan',
    name: '平安银行',
    logo: '/images/banks/pingan.jpg',
    qr: '/images/progress/pingan-v2.png',
    url: 'https://bank-static.pingan.com.cn/ca/ccBooking/ccBookingHtml/query/index.html'
  },
  {
    key: 'spdb',
    name: '浦发银行',
    logo: '/images/banks/spdb.jpg',
    qr: '/images/progress/spdb-v2.png',
    url: 'https://adsp.spdbccc.com.cn/adsp/view/mobile/phoneCheck.html?ciphertext=E85B42DFBE1844DA0392D08EC07186A1FE1FA5ACAFDF0319739C36E5A24A958E1D7CA7516A994BE28301511984F668EF11AB915BD1C47ABCFEEB9616A14D26D0'
  },
  {
    key: 'bocom',
    name: '交通银行',
    logo: '/images/banks/bocom.jpg',
    qr: '/images/progress/bocom-v2.png',
    url: 'https://creditcardapp.bankcomm.com/cpqweb/apply/status/preinquiry.html'
  },
  {
    key: 'cmb',
    name: '招商银行',
    logo: '/images/banks/cmb.jpg',
    qr: '/images/progress/cmb-v2.png',
    url: 'https://xyk.cmbchina.com/card-management-site/progress-query'
  },
  {
    key: 'cib',
    name: '兴业银行',
    logo: '/images/banks/cib.jpg',
    qr: 'https://ukoqffocqjokcroilyyv.supabase.co/storage/v1/object/public/progress/cib-qr.png?v=2',
    url: ''
  },
  {
    key: 'cmbc',
    name: '民生银行',
    logo: '/images/banks/cmbc.jpg',
    qr: '/images/progress/cmbc-v2.png',
    url: 'https://wx.creditcard.cmbc.com.cn/front/creditGetProgressSeaNew'
  }
];

Page({
  data: {
    banks: BANKS,
    openKey: ''   // 当前展开二维码的银行 key
  },

  // 点「查看二维码」：展开/收起对应银行的二维码
  toggleQr(e) {
    const key = e.currentTarget.dataset.key;
    this.setData({ openKey: this.data.openKey === key ? '' : key });
  },

  // 点二维码本身 → 放大
  previewQr(e) {
    const qr = e.currentTarget.dataset.qr;
    if (!qr) return;
    wx.previewImage({ urls: [qr], current: qr });
  },

  // 保存二维码到相册 → 引导去微信扫一扫相册识别
  saveQr(e) {
    const qr = e.currentTarget.dataset.qr;
    const name = e.currentTarget.dataset.name || '';
    if (!qr) return;
    wx.showLoading({ title: '保存中…', mask: true });
    wx.downloadFile({
      url: qr,
      success: (res) => {
        if (res.statusCode !== 200) {
          wx.hideLoading();
          wx.showToast({ title: '下载失败', icon: 'none' });
          return;
        }
        wx.saveImageToPhotosAlbum({
          filePath: res.tempFilePath,
          success: () => {
            wx.hideLoading();
            wx.showModal({
              title: '已保存到相册',
              content: `打开微信「扫一扫」→ 右上角相册 → 选中${name}二维码，即可跳转查询`,
              showCancel: false,
              confirmText: '知道了'
            });
          },
          fail: (err) => {
            wx.hideLoading();
            const msg = String(err.errMsg || '');
            if (msg.indexOf('auth') >= 0 || msg.indexOf('deny') >= 0) {
              wx.showModal({
                title: '需要相册权限',
                content: '保存二维码需要允许访问相册，去设置里开启？',
                confirmText: '去设置',
                success: (r) => { if (r.confirm) wx.openSetting(); }
              });
            } else {
              wx.showToast({ title: '保存失败', icon: 'none' });
            }
          }
        });
      },
      fail: () => {
        wx.hideLoading();
        wx.showToast({ title: '下载失败', icon: 'none' });
      }
    });
  },

  // 兜底：复制查询链接到剪贴板
  copyUrl(e) {
    const { url, name } = e.currentTarget.dataset;
    if (!url) {
      wx.showToast({ title: '请长按二维码识别查询', icon: 'none' });
      return;
    }
    wx.setClipboardData({
      data: url,
      success: () => wx.showToast({ title: `${name}链接已复制`, icon: 'success' })
    });
  },

  onShareAppMessage() {
    return {
      title: '银行办卡进度查询 · 加加好物图集',
      path: '/pages/progress/progress'
    };
  }
});
