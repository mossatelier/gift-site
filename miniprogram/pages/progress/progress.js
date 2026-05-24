const BANKS = [
  {
    key: 'citic',
    name: '中信银行',
    logo: '/images/banks/citic.jpg',
    url: 'https://e.creditcard.ecitic.com/citiccard/ebank-ocp/bsvc-card/index.html#/cardInput'
  },
  {
    key: 'pingan',
    name: '平安银行',
    logo: '/images/banks/pingan.jpg',
    url: 'https://bank-static.pingan.com.cn/ca/ccBooking/ccBookingHtml/query/index.html'
  },
  {
    key: 'bocom',
    name: '交通银行',
    logo: '/images/banks/bocom.jpg',
    url: 'https://creditcardapp.bankcomm.com/cpqweb/apply/status/preinquiry.html'
  },
  {
    key: 'spdb',
    name: '浦发银行',
    logo: '/images/banks/spdb.jpg',
    url: 'https://adsp.spdbccc.com.cn/adsp/view/mobile/phoneCheck.html?ciphertext=E85B42DFBE1844DA0392D08EC07186A1FE1FA5ACAFDF0319739C36E5A24A958E1D7CA7516A994BE28301511984F668EF11AB915BD1C47ABCFEEB9616A14D26D0'
  },
  {
    key: 'cmb',
    name: '招商银行',
    logo: '/images/banks/cmb.jpg',
    url: 'https://xyk.cmbchina.com/card-management-site/progress-query'
  },
  {
    key: 'cmbc',
    name: '民生银行',
    logo: '',
    url: 'https://wx.creditcard.cmbc.com.cn/front/creditGetProgressSeaNew'
  },
  {
    key: 'hxb',
    name: '华夏银行',
    logo: '',
    url: 'https://wxstatic.creditcard.hxb.com.cn/nwxhx/6304/#/identityVerification/identityVerification'
  },
  {
    key: 'ceb',
    name: '光大银行',
    logo: '',
    url: 'http://t.cn/A667YPJ1'
  },
  {
    key: 'fubon',
    name: '富邦华一银行',
    logo: '',
    url: 'https://creditapply.fubonchina.com/ws-gateway/mvue/m/#/queryInfo?business=CJ04'
  },
  {
    key: 'cgb',
    name: '广发银行',
    logo: '',
    url: 'https://wap.cgbchina.com.cn/h5-mobilebank-web/h5/ws/subfield/index?srcChannel=WS&mbp_subcode=200003112'
  }
];

Page({
  data: {
    banks: BANKS
  },

  copyUrl(e) {
    const { url, name } = e.currentTarget.dataset;
    wx.setClipboardData({
      data: url,
      success: () => {
        wx.showToast({
          title: `${name}链接已复制`,
          icon: 'success'
        });
      }
    });
  },

  onShareAppMessage() {
    return {
      title: '银行办卡进度查询 · 加加办卡礼品馆',
      path: '/pages/progress/progress'
    };
  }
});
