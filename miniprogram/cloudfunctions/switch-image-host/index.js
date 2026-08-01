// 一次性收尾工具 v5：把云开发 products / app_config 里残留的 Supabase 图片地址
// 换成云开发存储地址（文件都已搬好，这里只改数据库字段）。
//   旧 https://ukoqffocqjokcroilyyv.supabase.co/storage/v1/object/public/product-images/products/x.jpg
//   新 https://636c-cloud1-d0gtch1v896d24828-1436264391.tcb.qcloud.la/products/x.jpg
// 用法：云函数 → 云端测试 → 入参 {} → 运行（秒级完成）。
// 跑完确认无残留即可删除本云函数及其触发器。
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

const OLD_PREFIX = 'https://ukoqffocqjokcroilyyv.supabase.co/storage/v1/object/public/product-images/';
const NEW_PREFIX = 'https://636c-cloud1-d0gtch1v896d24828-1436264391.tcb.qcloud.la/';

const needs = (u) => typeof u === 'string' && u.startsWith(OLD_PREFIX);
const swap = (u) => (needs(u) ? NEW_PREFIX + u.slice(OLD_PREFIX.length) : u);

exports.main = async () => {
  const out = { productsFixed: 0, configsFixed: 0, samples: [], errors: [] };

  // ===== products：分页扫全量（云函数单次上限 1000）=====
  const PAGE = 1000;
  for (let skip = 0; skip < 5000; skip += PAGE) {
    const r = await db.collection('products').skip(skip).limit(PAGE).get();
    const rows = r.data || [];
    for (const p of rows) {
      const patch = {};
      if (Array.isArray(p.images) && p.images.some(needs)) patch.images = p.images.map(swap);
      if (needs(p.imageUrl)) patch.imageUrl = swap(p.imageUrl);
      if (!Object.keys(patch).length) continue;
      try {
        await db.collection('products').doc(p._id).update({ data: patch });
        out.productsFixed++;
        if (out.samples.length < 5) out.samples.push({ title: p.title, url: (patch.images && patch.images[0]) || patch.imageUrl });
      } catch (e) {
        out.errors.push({ id: p._id, err: String((e && e.message) || e).slice(0, 200) });
      }
    }
    if (rows.length < PAGE) break;
  }

  // ===== app_config =====
  try {
    const cfg = await db.collection('app_config').limit(50).get();
    for (const row of (cfg.data || [])) {
      const patch = {};
      if (row.key === 'home_banners' && Array.isArray(row.banners) && row.banners.some((b) => b && needs(b.imageUrl))) {
        patch.banners = row.banners.map((b) => (b ? { ...b, imageUrl: swap(b.imageUrl) } : b));
      }
      if (row.key === 'referral_share' && needs(row.imageUrl)) patch.imageUrl = swap(row.imageUrl);
      if (!Object.keys(patch).length) continue;
      await db.collection('app_config').doc(row._id).update({ data: patch });
      out.configsFixed++;
    }
  } catch (e) {
    out.errors.push({ scope: 'app_config', err: String((e && e.message) || e).slice(0, 200) });
  }

  out.ok = out.errors.length === 0;
  out.hint = `已修 ${out.productsFixed} 件商品 / ${out.configsFixed} 条配置` + (out.ok ? '，告诉 Claude 复验' : '，有错误请发给 Claude');
  return out;
};
