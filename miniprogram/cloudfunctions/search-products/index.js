// 商品搜索：同义词扩展 + 字级打分（解决「小米风扇」搜不到「小米智能塔扇」这类问题）
// 客户端正则子串搜索太死板；云函数端拉全量在售商品（几百件）逐个打分排序。
// 入参：{ keyword, category?, subcategory?, cardsMin?, cardsMax?, limit?=100 }
// 返回：{ success, products: [...], total }
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

// 同义词表：组内任意词互通（基于目录真实用词维护；遇到搜不到的词往这里加一行）
// ⚠️ H5 端 assets/site.js 有一份同款表，改这里记得同步改那边
const SYNONYM_GROUPS = [
  ['风扇', '塔扇', '循环扇', '落地扇', '台扇', '电扇'],
  ['遛娃', '溜娃'],
  ['婴儿车', '推车', '口袋车'],
  ['餐椅', '成长椅'],
  ['电饭锅', '电饭煲'],
  ['高压锅', '压力锅'],
  ['吹风机', '电吹风'],
  ['爬行垫', '爬爬垫'],
  ['摇摇马', '木马'],
  ['消毒柜', '消毒器'],
  ['豆浆机', '破壁机'],
  ['调奶器', '恒温壶'],
  ['摄像头', '监控'],
  ['书架', '绘本架', '收纳架']
];

function norm(s) {
  return String(s || '').toLowerCase().replace(/\s+/g, '');
}

// 同义词扩展：把关键词里出现的组内词替换成其它组员，生成变体（上限 12 个防爆炸）
function variantsOf(q) {
  const vs = [q];
  SYNONYM_GROUPS.forEach((g) => {
    g.forEach((w) => {
      if (q.indexOf(w) >= 0) {
        g.forEach((w2) => {
          if (w2 !== w) {
            const v = q.split(w).join(w2);
            if (vs.indexOf(v) < 0) vs.push(v);
          }
        });
      }
    });
  });
  return vs.slice(0, 12);
}

// 打分：整串命中标题=100，命中子类/描述=80；否则按去重字符命中率（≥60% 才算，封顶 70）
function scoreItem(item, variants) {
  const t = norm(item.title);
  const s = norm(item.subcategory);
  const d = norm(item.description);
  let best = 0;
  for (let i = 0; i < variants.length; i++) {
    const v = variants[i];
    if (!v) continue;
    if (t.indexOf(v) >= 0) { best = Math.max(best, 100); continue; }
    if (s.indexOf(v) >= 0 || d.indexOf(v) >= 0) { best = Math.max(best, 80); continue; }
    const chars = Array.from(new Set(v.split('')));
    if (chars.length < 2) continue; // 单字不做模糊，噪声太大
    let hit = 0;
    chars.forEach((c) => { if (t.indexOf(c) >= 0 || s.indexOf(c) >= 0) hit++; });
    const ratio = hit / chars.length;
    if (ratio >= 0.6) best = Math.max(best, Math.round(ratio * 70));
  }
  return best;
}

exports.main = async (event) => {
  try {
    const keyword = norm(event && event.keyword);
    if (!keyword) return { success: true, products: [], total: 0 };
    const limit = Math.min(Math.max(Number(event.limit) || 100, 1), 200);

    // 组条件（与 utils/db.js _buildWhere 口径一致：积分筛选时排除邀请可兑）
    const cond = { isActive: true };
    const category = event.category;
    const hasCards = event.cardsMin != null || event.cardsMax != null;
    if (category && category !== 'all') {
      cond.category = Array.isArray(category) ? _.in(category) : category;
    } else if (hasCards) {
      cond.category = _.neq('referral');
    }
    if (event.subcategory) cond.subcategory = event.subcategory;
    if (event.cardsMin != null && event.cardsMax != null) {
      cond.cardsNeeded = _.gte(event.cardsMin).and(_.lte(event.cardsMax));
    } else if (event.cardsMin != null) {
      cond.cardsNeeded = _.gte(event.cardsMin);
    } else if (event.cardsMax != null) {
      cond.cardsNeeded = _.lte(event.cardsMax);
    }

    // 拉全量候选（云函数端 limit 上限 1000，商品几百件够用）
    const r = await db.collection('products').where(cond)
      .orderBy('sortOrder', 'asc').limit(1000).get();
    const rows = r.data || [];

    const variants = variantsOf(keyword);
    const scored = [];
    rows.forEach((it) => {
      const sc = scoreItem(it, variants);
      if (sc > 0) scored.push({ it, sc });
    });
    scored.sort((a, b) => b.sc - a.sc || (a.it.sortOrder || 0) - (b.it.sortOrder || 0));

    return {
      success: true,
      total: scored.length,
      products: scored.slice(0, limit).map((x) => x.it)
    };
  } catch (err) {
    console.error('search-products failed', err);
    return { success: false, error: err.message || '搜索失败' };
  }
};
