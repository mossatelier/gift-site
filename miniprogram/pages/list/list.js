const { listProducts, countProducts } = require('../../utils/db.js');
const { categories, labelOfCategory } = require('../../config.js');
const wishlist = require('../../utils/wishlist.js');
const floatBtn = require('../../utils/floatBtn.js');

const PAGE_SIZE = 20;

// 推荐有礼按推荐人数换，不显示积分；其他显示兑换积分
function buildMetaText(item) {
  if (item.category === 'referral' && item.subcategory) {
    const m = String(item.subcategory).match(/推荐\s*(\d+)\s*人/);
    if (m) return `推荐 ${m[1]} 人可领`;
  }
  if (item.cardsNeeded > 0) return `兑换积分：${item.cardsNeeded} 分`;
  return '';
}

Page({
  ...floatBtn,

  data: {
    categories,
    currentCategory: 'all',
    currentCategoryLabel: '',
    sort: 'default', // default | newest | cards-asc | cards-desc
    keyword: '',
    items: [],
    wishlistMap: {},
    totalCount: 0,
    loading: false,
    noMore: false,
    skip: 0,
    floatStyle: '',
    showBackTop: false
  },

  onPageScroll(e) {
    const show = e.scrollTop > 400;
    if (show !== this.data.showBackTop) this.setData({ showBackTop: show });
  },

  onLoad(options) {
    const initial = {};
    if (options.category) initial.currentCategory = options.category;
    if (options.sort) initial.sort = options.sort;

    const app = getApp();
    if (app.globalData.listSortIntent === 'newest') {
      initial.sort = 'newest';
      app.globalData.listSortIntent = null;
    }
    if (app.globalData.listSearchIntent) {
      initial.keyword = app.globalData.listSearchIntent;
      app.globalData.listSearchIntent = null;
    }
    if (app.globalData.listCategoryIntent) {
      initial.currentCategory = app.globalData.listCategoryIntent;
      app.globalData.listCategoryIntent = null;
    }

    initial.currentCategoryLabel = labelOfCategory(initial.currentCategory || 'all');
    this.setData(initial, () => this.reload());
  },

  onShow() {
    const app = getApp();
    let changed = false;
    const patch = { wishlistMap: wishlist.getMap() };
    if (app.globalData.listSortIntent) {
      patch.sort = app.globalData.listSortIntent;
      app.globalData.listSortIntent = null;
      changed = true;
    }
    if (app.globalData.listSearchIntent) {
      patch.keyword = app.globalData.listSearchIntent;
      app.globalData.listSearchIntent = null;
      changed = true;
    }
    if (app.globalData.listCategoryIntent) {
      patch.currentCategory = app.globalData.listCategoryIntent;
      app.globalData.listCategoryIntent = null;
      changed = true;
    }
    if (changed) {
      this.setData(patch, () => this.reload());
    } else {
      this.setData({ wishlistMap: patch.wishlistMap });
    }
  },

  onPullDownRefresh() {
    this.reload().then(() => wx.stopPullDownRefresh());
  },

  onReachBottom() {
    if (!this.data.loading && !this.data.noMore) {
      this.loadMore();
    }
  },

  async reload() {
    this.setData({
      items: [],
      skip: 0,
      noMore: false,
      loading: true,
      totalCount: 0,
      currentCategoryLabel: labelOfCategory(this.data.currentCategory || 'all')
    });
    // 同时取总数和第一页
    const filter = {
      category: this.data.currentCategory,
      subcategory: null,
      keyword: this.data.keyword
    };
    try {
      const totalCount = await countProducts(filter);
      this.setData({ totalCount });
    } catch (err) {
      console.warn('countProducts 失败', err);
    }
    await this._loadPage();
  },

  async loadMore() {
    if (this.data.loading || this.data.noMore) return;
    this.setData({ loading: true });
    await this._loadPage();
  },

  async _loadPage() {
    const { currentCategory, sort, keyword, skip } = this.data;
    try {
      const raw = await listProducts({
        category: currentCategory,
        keyword,
        sort,
        skip,
        limit: PAGE_SIZE
      });
      const page = raw.map(it => ({ ...it, _metaText: buildMetaText(it) }));
      this.setData({
        items: this.data.items.concat(page),
        skip: skip + page.length,
        noMore: page.length < PAGE_SIZE,
        loading: false
      });
    } catch (err) {
      console.error('加载列表失败', err);
      this.setData({ loading: false });
      wx.showToast({ title: '加载失败', icon: 'none' });
    }
  },

  onCategoryTap(e) {
    const value = e.currentTarget.dataset.value;
    if (value === this.data.currentCategory) return;
    this.setData({ currentCategory: value }, () => this.reload());
  },

  onSortChange(e) {
    const sort = e.currentTarget.dataset.sort;
    if (sort === this.data.sort) return;
    this.setData({ sort }, () => this.reload());
  },

  // 积分 chip 三态切换：inactive → asc → desc → inactive
  onCardsSortToggle() {
    let next;
    if (this.data.sort === 'cards-asc') next = 'cards-desc';
    else if (this.data.sort === 'cards-desc') next = 'default';
    else next = 'cards-asc';
    this.setData({ sort: next }, () => this.reload());
  },

  onKeywordInput(e) {
    this.setData({ keyword: e.detail.value });
  },

  onSearch() {
    this.reload();
  },

  goProduct(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({ url: `/pages/product/product?id=${id}` });
  },

  backToTop() {
    wx.pageScrollTo({ scrollTop: 0, duration: 300 });
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

  onShareAppMessage() {
    return {
      title: '加加好物图集 · 全部礼品',
      path: `/pages/list/list?category=${this.data.currentCategory}`
    };
  }
});
