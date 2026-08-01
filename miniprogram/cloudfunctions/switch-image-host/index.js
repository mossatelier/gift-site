// 一次性收尾工具 v4（极简）：只补搬那 5 张漏掉的图 + 切换 app_config 图片地址。
// 前 1421 张已由前几轮搬完；这里不做任何探测/遍历，几秒即完成，不会超时。
// 用法：云开发控制台 → 云函数 → switch-image-host → 云端测试 → 入参 {} → 运行。
// 跑完就可以删除本云函数及其定时触发器。
const cloud = require('wx-server-sdk');
const https = require('https');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

const OLD_PREFIX = 'https://ukoqffocqjokcroilyyv.supabase.co/storage/v1/object/public/product-images/';
const NEW_PREFIX = 'https://636c-cloud1-d0gtch1v896d24828-1436264391.tcb.qcloud.la/';

// 经全量核对后确认缺失、且被商品实际引用的 5 张
const TARGETS = [
  'products/1778770974354--_20260514224926_20.jpg',
  'products/1779016983314-image-5-.jpeg',
  'products/1780241554621-image-5-.jpeg',
  'products/1780656291838-IMG_2463.jpeg',
  'products/1783437899276-IMG_3751.jpeg'
];

const needs = (u) => typeof u === 'string' && u.startsWith(OLD_PREFIX);
const swap = (u) => (needs(u) ? NEW_PREFIX + u.slice(OLD_PREFIX.length) : u);
const enc = (p) => p.split('/').map(encodeURIComponent).join('/');

function download(url, redirects = 0) {
  return new Promise((resolve, reject) => {
    if (redirects > 5) return reject(new Error('重定向过多'));
    const req = https.get(url, { timeout: 15000 }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        res.resume();
        return download(res.headers.location, redirects + 1).then(resolve, reject);
      }
      if (res.statusCode !== 200) { res.resume(); return reject(new Error(`下载 HTTP ${res.statusCode}`)); }
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks)));
      res.on('error', reject);
    });
    req.on('timeout', () => req.destroy(new Error('下载超时')));
    req.on('error', reject);
  });
}

exports.main = async () => {
  const moved = [];
  const errors = [];

  // ① 补搬 5 张（串行，稳）
  for (const p of TARGETS) {
    try {
      const buf = await download(OLD_PREFIX + enc(p));
      const up = await cloud.uploadFile({ cloudPath: p, fileContent: buf });
      if (!up || !up.fileID) throw new Error('uploadFile 无 fileID: ' + JSON.stringify(up).slice(0, 200));
      moved.push({ p, kb: Math.round(buf.length / 1024), fileID: up.fileID });
    } catch (e) {
      errors.push({ p, err: String((e && e.message) || e).slice(0, 300) });
    }
  }

  // ② 切换 app_config（首页海报 / 邀请分享图）地址
  let configsSwapped = 0;
  const configErrors = [];
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
      configsSwapped++;
    }
  } catch (e) {
    configErrors.push(String((e && e.message) || e).slice(0, 300));
  }

  return {
    movedCount: moved.length,
    moved,
    errors,
    configsSwapped,
    configErrors,
    ok: errors.length === 0,
    hint: errors.length === 0
      ? '✅ 5 张补齐 + 配置已切换，告诉 Claude 做最后一步'
      : '❌ 有失败，把 errors 内容发给 Claude'
  };
};
