const { listProducts, countProducts } = require('../../utils/db.js');
const { subcategories, labelOfCategory } = require('../../config.js');
const wishlist = require('../../utils/wishlist.js');
const floatBtn = require('../../utils/floatBtn.js');

const PAGE_SIZE = 20;

// 「母婴好物」虚拟大类 = 这一组细分类
const MOMBABY_GROUP = ['stroller', 'playpen', 'carseat', 'carrier', 'earlyedu', 'toy', 'chairtable', 'ride'];
const MOMBABY_SUBS = MOMBABY_GROUP.map(v => ({ value: v, label: labelOfCategory(v) }));

// 顶部平铺的展示分类
const DISPLAY_CATS = [
  { value: 'all', label: '全部礼品' },
  { value: 'referral', label: '推荐有礼' },
  { value: 'mombaby', label: '母婴好物' },
  { value: 'pet', label: '宠物用品' },
  { value: 'camping', label: '户外露营' }
];
// 「更多」下拉里的分类
const MORE_CATS = [
  { value: 'digital', label: '电子数码' },
  { value: 'appliance', label: '家用电器' }
];

// 积分区间分档（无空档，覆盖全部商品）；15+ 的 max 为 null = 单边
const CARDS_BUCKETS = [
  { key: '6',    label: '6分',     min: 6,  max: 6 },
  { key: '7',    label: '7分',     min: 7,  max: 7 },
  { key: '8',    label: '8分',     min: 8,  max: 8 },
  { key: '9-10', label: '9–10分',  min: 9,  max: 10 },
  { key: '11+',  label: '11分以上', min: 11, max: null }
];
function cardsRangeOf(key) {
  const b = CARDS_BUCKETS.find(x => x.key === key);
  return b ? { cardsMin: b.min, cardsMax: b.max } : { cardsMin: null, cardsMax: null };
}

// 把传入的分类（可能是细分类）解析成展示分类 + 二级
function resolveDisplay(cat) {
  if (!cat || cat === 'all') return { display: 'all', sub: '' };
  if (MOMBABY_GROUP.includes(cat)) return { display: 'mombaby', sub: cat };
  return { display: cat, sub: '' };
}

function displayLabel(value) {
  const all = DISPLAY_CATS.concat(MORE_CATS);
  const f = all.find(c => c.value === value);
  return f ? f.label : labelOfCategory(value);
}

// 推荐有礼按推荐人数换，不显示积分；其他显示兑换积分
function buildMetaText(item) {
  if (item.category === 'referral') {
    if (item.subcategory) {
      const m = String(item.subcategory).match(/推荐\s*(\d+)\s*人/);
      if (m) return `推荐 ${m[1]} 人可领`;
    }
    return '推荐办理可领';
  }
  if (item.cardsNeeded > 0) return `兑换积分：${item.cardsNeeded} 分`;
  return '';
}

Page({
  ...floatBtn,

  data: {
    displayCats: DISPLAY_CATS,
    moreCats: MORE_CATS,
    showMore: false,
    moreLabel: '',              // 当前选中的是「更多」里的分类时，显示其名字
    currentCategory: 'all',     // 展示分类 value
    currentCategoryLabel: '',
    subItems: [],               // 二级 [{value,label}]
    currentSub: '',             // 二级选中 value
    sort: 'default',            // default | newest | cards-asc | cards-desc
    keyword: '',
    cardsBuckets: CARDS_BUCKETS,
    cards: '',                  // 选中的积分档 key（空 = 全部）
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
    let display = 'all';
    let sub = '';
    let initial = { sort: 'default', keyword: '' };

    if (options.category) {
      const r = resolveDisplay(options.category);
      display = r.display; sub = r.sub;
    }
    if (options.sort) initial.sort = options.sort;
    if (options.cards) initial.cards = options.cards;

    const app = getApp();
    if (app.globalData.listCardsIntent != null) {
      initial.cards = app.globalData.listCardsIntent;
      app.globalData.listCardsIntent = null;
    }
    if (app.globalData.listSortIntent === 'newest') {
      initial.sort = 'newest';
      app.globalData.listSortIntent = null;
    }
    if (app.globalData.listSearchIntent) {
      initial.keyword = app.globalData.listSearchIntent;
      app.globalData.listSearchIntent = null;
    }
    if (app.globalData.listCategoryIntent) {
      const r = resolveDisplay(app.globalData.listCategoryIntent);
      display = r.display; sub = r.sub;
      app.globalData.listCategoryIntent = null;
    }

    // 推荐有礼无积分概念，落地即清掉可能带进来的积分筛选
    if (display === 'referral') initial.cards = '';

    initial.currentCategory = display;
    initial.currentSub = sub;
    initial.subItems = this._subItemsOf(display);
    initial.currentCategoryLabel = displayLabel(display);
    initial.moreLabel = this._moreLabelOf(display);
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
      const r = resolveDisplay(app.globalData.listCategoryIntent);
      patch.currentCategory = r.display;
      patch.currentSub = r.sub;
      patch.subItems = this._subItemsOf(r.display);
      patch.moreLabel = this._moreLabelOf(r.display);
      if (r.display === 'referral') patch.cards = '';
      app.globalData.listCategoryIntent = null;
      changed = true;
    }
    if (app.globalData.listCardsIntent != null) {
      patch.cards = app.globalData.listCardsIntent;
      app.globalData.listCardsIntent = null;
      changed = true;
    }
    if (changed) {
      this.setData(patch, () => this.reload());
    } else {
      this.setData({ wishlistMap: patch.wishlistMap });
    }
  },

  // 若 cat 是「更多」里的分类，返回其 label，否则空
  _moreLabelOf(cat) {
    const m = MORE_CATS.find(c => c.value === cat);
    return m ? m.label : '';
  },

  // 某展示分类的二级条
  _subItemsOf(display) {
    if (display === 'mombaby') return MOMBABY_SUBS;
    const subs = subcategories[display] || [];
    return subs.map(s => ({ value: s, label: s }));
  },

  // 根据当前展示分类 + 二级，算出查询用的 {category, subcategory}
  _filter() {
    const { currentCategory, currentSub } = this.data;
    if (currentCategory === 'all') return { category: null, subcategory: null };
    if (currentCategory === 'mombaby') {
      // 选了二级细分类 → 查该细类；否则查整组
      return { category: currentSub || MOMBABY_GROUP, subcategory: null };
    }
    return { category: currentCategory, subcategory: currentSub || null };
  },

  // 积分档位筛选：点同一档再次取消；切换即重新查询
  onSelectCards(e) {
    const key = e.currentTarget.dataset.key || '';
    const next = this.data.cards === key ? '' : key;
    if (next === this.data.cards) return;
    this.setData({ cards: next }, () => this.reload());
  },

  resetCards() {
    if (!this.data.cards) return;
    this.setData({ cards: '' }, () => this.reload());
  },

  onPullDownRefresh() {
    this.reload().then(() => wx.stopPullDownRefresh());
  },

  onReachBottom() {
    if (!this.data.loading && !this.data.noMore) this.loadMore();
  },

  async reload() {
    this.setData({
      items: [],
      skip: 0,
      noMore: false,
      loading: true,
      totalCount: 0,
      currentCategoryLabel: displayLabel(this.data.currentCategory)
    });
    const f = this._filter();
    const { cardsMin, cardsMax } = cardsRangeOf(this.data.cards);
    try {
      const totalCount = await countProducts({ category: f.category, subcategory: f.subcategory, keyword: this.data.keyword, cardsMin, cardsMax });
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
    const { sort, keyword, skip } = this.data;
    const f = this._filter();
    const { cardsMin, cardsMax } = cardsRangeOf(this.data.cards);
    try {
      const raw = await listProducts({
        category: f.category,
        subcategory: f.subcategory,
        keyword,
        sort,
        skip,
        limit: PAGE_SIZE,
        cardsMin,
        cardsMax
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

  // 选展示分类
  onCategoryTap(e) {
    const value = e.currentTarget.dataset.value;
    if (value === this.data.currentCategory) {
      this.setData({ showMore: false });
      return;
    }
    const patch = {
      currentCategory: value,
      subItems: this._subItemsOf(value),
      currentSub: '',
      moreLabel: this._moreLabelOf(value),
      showMore: false
    };
    // 推荐有礼按「推荐人数」换，无积分概念 → 切过去时重置积分筛选
    if (value === 'referral') patch.cards = '';
    this.setData(patch, () => this.reload());
  },

  // 选二级
  onSubTap(e) {
    const sub = e.currentTarget.dataset.sub || '';
    if (sub === this.data.currentSub) return;
    this.setData({ currentSub: sub }, () => this.reload());
  },

  toggleMore() {
    this.setData({ showMore: !this.data.showMore });
  },

  onSortChange(e) {
    const sort = e.currentTarget.dataset.sort;
    if (sort === this.data.sort) return;
    this.setData({ sort }, () => this.reload());
  },

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
    wx.showToast({ title: nowOn ? '已加入心愿单' : '已移除', icon: 'success' });
  },

  onShareAppMessage() {
    return {
      title: '加加好物图集 · 全部礼品',
      path: `/pages/list/list?category=${this.data.currentCategory}`
    };
  }
});
