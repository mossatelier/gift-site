const { listProducts, countProducts, getCategoryOrder } = require('../../utils/db.js');
const { categories, subcategories, labelOfCategory, sortCategories } = require('../../config.js');
const wishlist = require('../../utils/wishlist.js');
const floatBtn = require('../../utils/floatBtn.js');

// 左侧不显示 "全部礼品"（all），从第二项开始
const mainCategories = categories.filter(c => c.value !== 'all');

// 分类页商品卡片的副标题文案
// - 推荐有礼分类：根据 subcategory "推荐2人" 提取数字，显示"推荐 2 人可领"
//   （避免和"剩余积分"混淆——推荐有礼是按推荐人数发礼品，不是按积分）
// - 其他分类：照旧显示"兑换积分：N 分"
function buildCategoryMetaText(item, currentCategory) {
  if (item.isDisplayOnly) return '';   // 活动说明卡：不是能兑换的礼品，不显示积分/人数
  if (item.category === 'referral' || currentCategory === 'referral') {
    if (item.subcategory) {
      const m = String(item.subcategory).match(/推荐\s*(\d+)\s*人/);
      if (m) return `邀请 ${m[1]} 人可领`;
    }
    return '邀请可领';   // 邀请有礼一律不显示积分
  }
  if (item.cardsNeeded > 0) return `兑换积分：${item.cardsNeeded} 分`;
  return '';
}

Page({
  ...floatBtn,

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
    loading: false,
    intoView: '',
    floatStyle: '',
    showBackTop: false
  },

  onLoad() {
    this.updateSubList();
    this.reload();
    this.applyCategoryOrder();
  },

  async applyCategoryOrder() {
    const order = await getCategoryOrder();
    if (order && order.length) {
      this.setData({ categories: sortCategories(mainCategories, order, false) });
    }
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
      const where = {
        category: this.data.currentCategory,
        subcategory: this.data.currentSub || null
      };
      // 列表只取一部分（云开发客户端 limit 上限 20，不全加载）；
      // 总数单独用 count() 查真实值（不受 20 限制），用于"查看 N 件全部"。
      const [raw, total] = await Promise.all([
        listProducts({ ...where, limit: 100, sort: 'hot' }),
        countProducts(where).catch(() => null)
      ]);
      const items = raw.map(it => ({
        ...it,
        _metaText: buildCategoryMetaText(it, this.data.currentCategory)
      }));
      this.setData({
        items,
        categoryCount: (total != null ? total : items.length),
        loading: false
      });
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

  onRightScroll(e) {
    const show = e.detail.scrollTop > 400;
    if (show !== this.data.showBackTop) this.setData({ showBackTop: show });
  },

  // 右侧内容是 scroll-view，用 scroll-into-view 锚点回到顶部
  backToTop() {
    this.setData({ intoView: '' });
    setTimeout(() => this.setData({ intoView: 'cat-top' }), 0);
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
      title: '加加好物图集 · 商品分类',
      path: '/pages/category/category'
    };
  }
});
