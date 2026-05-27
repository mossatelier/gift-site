const { listProducts } = require('../../utils/db.js');
const { categories, subcategories, labelOfCategory } = require('../../config.js');
const wishlist = require('../../utils/wishlist.js');

// 左侧不显示 "全部礼品"（all），从第二项开始
const mainCategories = categories.filter(c => c.value !== 'all');

// 分类页商品卡片的副标题文案
// - 推荐有礼分类：根据 subcategory "推荐2人" 提取数字，显示"推荐 2 人可领"
//   （避免和"剩余积分"混淆——推荐有礼是按推荐人数发礼品，不是按积分）
// - 其他分类：照旧显示"兑换积分：N 分"
function buildCategoryMetaText(item, currentCategory) {
  if (currentCategory === 'referral' && item.subcategory) {
    const m = String(item.subcategory).match(/推荐\s*(\d+)\s*人/);
    if (m) return `推荐 ${m[1]} 人可领`;
  }
  if (item.cardsNeeded > 0) return `兑换积分：${item.cardsNeeded} 分`;
  return '';
}

Page({
  data: {
    categories: mainCategories,
    currentCategory: mainCategories[0] ? mainCategories[0].value : '',
    currentCategoryLabel: mainCategories[0] ? mainCategories[0].label : '',
    categoryCount: 0,
    subList: [],
    currentSub: '',
    items: [],
    wishlistMap: {},
    keyword: '',
    loading: false
  },

  onLoad() {
    this.updateSubList();
    this.reload();
  },

  onShow() {
    this.setData({ wishlistMap: wishlist.getMap() });
  },

  updateSubList() {
    const subs = subcategories[this.data.currentCategory] || [];
    this.setData({ subList: subs, currentSub: '' });
  },

  async reload() {
    this.setData({
      loading: true,
      items: [],
      currentCategoryLabel: labelOfCategory(this.data.currentCategory)
    });
    try {
      const raw = await listProducts({
        category: this.data.currentCategory,
        subcategory: this.data.currentSub || null,
        limit: 100
      });
      const items = raw.map(it => ({
        ...it,
        _metaText: buildCategoryMetaText(it, this.data.currentCategory)
      }));
      this.setData({ items, categoryCount: items.length, loading: false });
    } catch (err) {
      console.error('加载分类商品失败', err);
      this.setData({ loading: false });
    }
  },

  onCategoryTap(e) {
    const value = e.currentTarget.dataset.value;
    if (value === this.data.currentCategory) return;
    this.setData({ currentCategory: value }, () => {
      this.updateSubList();
      this.reload();
    });
  },

  onSubTap(e) {
    const sub = e.currentTarget.dataset.sub || '';
    if (sub === this.data.currentSub) return;
    this.setData({ currentSub: sub }, () => this.reload());
  },

  onKeywordInput(e) {
    this.setData({ keyword: e.detail.value });
  },

  onSearchSubmit() {
    const kw = (this.data.keyword || '').trim();
    if (kw) {
      getApp().globalData.listSearchIntent = kw;
    }
    wx.switchTab({ url: '/pages/list/list' });
  },

  goListInCategory() {
    const app = getApp();
    app.globalData.listCategoryIntent = this.data.currentCategory;
    wx.switchTab({ url: '/pages/list/list' });
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

  onShareAppMessage() {
    return {
      title: '加加办卡礼品馆 · 商品分类',
      path: '/pages/category/category'
    };
  }
});
