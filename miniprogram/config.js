// 分类配置 —— 与原 assets/config.js 保持一致

const categories = [
  { value: 'all', label: '全部礼品' },
  { value: 'referral', label: '推荐有礼' },
  { value: 'stroller', label: '婴儿推车' },
  { value: 'playpen', label: '收纳围栏' },
  { value: 'carseat', label: '安全座椅' },
  { value: 'carrier', label: '喂养腰凳' },
  { value: 'earlyedu', label: '早教点读' },
  { value: 'toy', label: '儿童玩具' },
  { value: 'chairtable', label: '餐椅桌椅' },
  { value: 'ride', label: '娱乐骑行' },
  { value: 'pet', label: '宠物用品' },
  { value: 'camping', label: '户外露营' },
  { value: 'digital', label: '电子数码' },
  { value: 'appliance', label: '家用电器' }
];

const subcategories = {
  referral: ['推荐2人', '推荐3人', '推荐5人', '推荐7人', '推荐10人'],
  stroller: ['婴儿车', '遛娃车', '口袋车'],
  toy: ['益智类', '攀爬类', '各种玩具'],
  ride: ['平衡车', '自行车', '滑板车', '扭扭车']
};

function labelOfCategory(value) {
  const found = categories.find(c => c.value === value);
  return found ? found.label : value;
}

// 按后台保存的顺序重排分类；order 里的在前(保持 order 内顺序)，其余按原序在后
// keepAllFirst=true 时保证 'all'(全部礼品) 永远第一
function sortCategories(list, order, keepAllFirst) {
  if (!Array.isArray(order) || order.length === 0) return list.slice();
  const idx = (v) => {
    const i = order.indexOf(v);
    return i < 0 ? 9999 : i;
  };
  const sorted = list.slice().sort((a, b) => idx(a.value) - idx(b.value));
  if (keepAllFirst) {
    const allI = sorted.findIndex(c => c.value === 'all');
    if (allI > 0) {
      const [all] = sorted.splice(allI, 1);
      sorted.unshift(all);
    }
  }
  return sorted;
}

module.exports = {
  categories,
  subcategories,
  labelOfCategory,
  sortCategories,
  siteName: '加加好物图集',
  customerServiceQrPath: '/images/wechat-qr.jpg',
  // 「发货通知」订阅消息模板 ID（小程序后台→订阅消息→公共模板库申请后填）
  // 前端授权和云端推送用的是同一个模板 ID（云端在 admin-orders 里也要填同一个值）
  shipNotifyTmplId: 'ogImsJ3zh8t9wc_AX2gPzLCPqsfTmqH9JqbwLhGlUWQ'
};
