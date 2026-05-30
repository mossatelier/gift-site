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

  // 点二维码本身 → 放大，长按可识别跳转
  previewQr(e) {
    const qr = e.currentTarget.dataset.qr;
    if (!qr) return;
    wx.previewImage({ urls: [qr], current: qr });
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
