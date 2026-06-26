const { listHotProducts, listHotByOrders, listNewProducts, getHomeBanners, getCardsBankLabels } = require('../../utils/db.js');
const wishlist = require('../../utils/wishlist.js');
const floatBtn = require('../../utils/floatBtn.js');

// 各档位默认银行名（后台未配置时回退，保证不空白）
const CARDS_BANK_DEFAULT = { '6': '交通银行', '7': '浦发银行', '8': '平安/中信银行', '9-10': '', '11+': '全' };

Page({
  ...floatBtn,

  data: {
    loading: true,
    banners: [],
    hotList: [],
    newList: [],
    wishlistMap: {},
    keyword: '',
    showQr: false,
    floatStyle: '',
    showBackTop: false,
    // 积分快捷跳转（与全部礼品页的区间分档一致）；bank 由后台配置覆盖，默认见 CARDS_BANK_DEFAULT
    cardsQuick: [
      { key: '6',    label: '6分',     bank: CARDS_BANK_DEFAULT['6'] },
      { key: '7',    label: '7分',     bank: CARDS_BANK_DEFAULT['7'] },
      { key: '8',    label: '8分',     bank: CARDS_BANK_DEFAULT['8'] },
      { key: '9-10', label: '9-10分',  bank: CARDS_BANK_DEFAULT['9-10'] },
      { key: '11+',  label: '11分以上', bank: CARDS_BANK_DEFAULT['11+'] }
    ]
  },

  onPageScroll(e) {
    const show = e.scrollTop > 400;
    if (show !== this.data.showBackTop) this.setData({ showBackTop: show });
  },

  onLoad() {
    this.loadAll();
  },

  onShow() {
    this.setData({ wishlistMap: wishlist.getMap() });
  },

  onPullDownRefresh() {
    this.loadAll().then(() => wx.stopPullDownRefresh());
  },

  async loadAll() {
    this.setData({ loading: true });
    try {
      const results = await Promise.all([
        listHotByOrders(6).catch(() => listHotProducts(6)),  // 下单排名；云函数失败则回退浏览量
        listNewProducts(6),
        getHomeBanners().catch(() => []),
        getCardsBankLabels().catch(() => ({}))
      ]);
      const labels = results[3] || {};
      const cardsQuick = this.data.cardsQuick.map((it) => ({
        ...it,
        bank: labels[it.key] != null ? labels[it.key] : CARDS_BANK_DEFAULT[it.key]
      }));
      this.setData({
        hotList: results[0],
        newList: results[1],
        banners: results[2] || [],
        cardsQuick,
        loading: false
      });
    } catch (err) {
      console.error('加载首页商品失败', err);
      this.setData({ loading: false });
      wx.showToast({ title: '加载失败', icon: 'none' });
    }
  },

  // 首页海报点击：按后台配置的 linkType 分发（tab 页用 switchTab，普通页/商品用 navigateTo）。
  onBannerTap(e) {
    const { linkType, linkValue } = e.currentTarget.dataset;
    if (!linkType || linkType === 'none' || !linkValue) return;
    if (linkType === 'tab') {
      wx.switchTab({ url: linkValue });
    } else if (linkType === 'page') {
      wx.navigateTo({ url: linkValue });
    } else if (linkType === 'product') {
      wx.navigateTo({ url: `/pages/product/product?id=${linkValue}` });
    }
    // url 外链小程序无法直接打开，MVP 不处理
  },

  onKeywordInput(e) {
    this.setData({ keyword: e.detail.value });
  },

  onSearchSubmit() {
    const kw = (this.data.keyword || '').trim();
    if (!kw) {
      wx.switchTab({ url: '/pages/list/list' });
      return;
    }
    getApp().globalData.listSearchIntent = kw;
    wx.switchTab({ url: '/pages/list/list' });
  },

  goList() {
    wx.switchTab({ url: '/pages/list/list' });
  },

  // 积分快捷栏：跳全部礼品页并按对应积分档筛选
  goCardsList(e) {
    const key = e.currentTarget.dataset.key || '';
    getApp().globalData.listCardsIntent = key;
    wx.switchTab({ url: '/pages/list/list' });
  },

  goWishlist() {
    wx.switchTab({ url: '/pages/wishlist/wishlist' });
  },

  goListNewest() {
    getApp().globalData.listSortIntent = 'newest';
    wx.switchTab({ url: '/pages/list/list' });
  },

  goCategory() {
    wx.switchTab({ url: '/pages/category/category' });
  },

  goProduct(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({ url: `/pages/product/product?id=${id}` });
  },

  toggleHeart(e) {
    const id = e.currentTarget.dataset.id;
    wishlist.toggle(id);
    const nowOn = wishlist.has(id);
    this.setData({ wishlistMap: wishlist.getMap() });
    wx.showToast({
      title: nowOn ? '已加入心愿单' : '已移除',
      icon: 'success'
    });
  },

  goCardFlow() {
    wx.navigateTo({ url: '/pages/card-flow/card-flow' });
  },

  goClaimGuide() {
    wx.navigateTo({ url: '/pages/claim-guide/claim-guide' });
  },

  goBankNewUser() {
    wx.navigateTo({ url: '/pages/bank-new-user/bank-new-user' });
  },

  goEarn() {
    wx.navigateTo({ url: '/pages/earn/earn' });
  },

  goProgress() {
    wx.navigateTo({ url: '/pages/progress/progress' });
  },

  goPromo() {
    wx.navigateTo({ url: '/pages/promo/promo' });
  },

  // 用 previewImage 打开客服码：预览模式长按才能识别二维码（自定义弹层里的 image 不行）
  showQrcode() {
    wx.previewImage({ urls: ['/images/wechat-qr.jpg'], current: '/images/wechat-qr.jpg' });
  },

  hideQrcode() {
    this.setData({ showQr: false });
  },

  backToTop() {
    wx.pageScrollTo({ scrollTop: 0, duration: 300 });
  },

  onShareAppMessage() {
    return {
      title: '加加好物图集 · 办卡即享精选好礼',
      path: '/pages/index/index'
    };
  },

  onShareTimeline() {
    return {
      title: '加加好物图集 · 办卡即享精选好礼'
    };
  }
});
