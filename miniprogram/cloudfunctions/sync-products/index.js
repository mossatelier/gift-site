// 定时同步 Supabase ↔ 云开发
// 同步两张表：products + banks_earn
// 触发器：每 5 分钟一次（见 config.json）
//
// 关键策略：
// - 按 supabaseId 匹配做 upsert，云开发 _id 不变 → 心愿单引用稳定
// - viewCount 用「快照 + 增量」方式合并 H5 和小程序两端的浏览：
//     cur.supabaseViewCountSnapshot 记录上次同步时 Supabase 的 view_count
//     delta = supabase.view_count - lastSnapshot  (H5 这次新增的浏览量)
//     新 viewCount = 云开发当前 viewCount + delta  (保留小程序累加 + 加上 H5 新增)
//   首次同步（snapshot 缺失）→ 直接用 Supabase 的 view_count 做初始值

const cloud = require('wx-server-sdk');
const https = require('https');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

const SUPABASE_URL = 'https://ukoqffocqjokcroilyyv.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVrb3FmZm9jcWpva2Nyb2lseXl2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUzMzMxMDUsImV4cCI6MjA5MDkwOTEwNX0.jKFzbuDLbbDboUD8vJLAu0uTkkEzE2YnC2bHU5I8RH0';

function httpsGet(url, headers) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers }, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try { resolve(JSON.parse(data)); }
          catch (e) { reject(new Error(`JSON parse error: ${e.message}`)); }
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${data}`));
        }
      });
    }).on('error', reject);
  });
}

function normalizeProduct(p) {
  const images = Array.isArray(p.images) && p.images.length > 0
    ? p.images
    : (p.image_url ? [p.image_url] : []);
  return {
    supabaseId: p.id,
    title: p.title || '',
    category: p.category || '',
    subcategory: p.subcategory || '',
    price: Number(p.price) || 0,
    cardsNeeded: Number(p.cards_needed) || 0,
    description: p.description || '',
    images,
    imageUrl: images[0] || '',
    sortOrder: Number(p.sort_order) || 10,
    isActive: p.is_active !== false,
    createdAt: p.created_at || '',
    updatedAt: p.updated_at || '',
    _supabaseViewCount: Number(p.view_count) || 0   // 临时字段，不直接写入
  };
}

function normalizeBank(b) {
  return {
    supabaseId: b.id,
    name: b.name || '',
    points: Number(b.points) || 0,
    sortOrder: Number(b.sort_order) || 100,
    updatedAt: b.updated_at || ''
  };
}

async function fetchAllFromCollection(collection) {
  const PAGE_SIZE = 100;
  let all = [];
  let skip = 0;
  while (true) {
    const res = await db.collection(collection).skip(skip).limit(PAGE_SIZE).get();
    all = all.concat(res.data);
    if (res.data.length < PAGE_SIZE) break;
    skip += PAGE_SIZE;
  }
  return all;
}

const PRODUCT_COMPARE_FIELDS = [
  'title', 'category', 'subcategory', 'price', 'cardsNeeded',
  'description', 'imageUrl', 'sortOrder', 'isActive', 'updatedAt'
];

// 并发跑 tasks，但每批最多 CONCURRENCY 个，避免压垮 DB
async function runInBatches(tasks, concurrency = 20) {
  for (let i = 0; i < tasks.length; i += concurrency) {
    await Promise.all(tasks.slice(i, i + concurrency).map(fn => fn()));
  }
}

async function syncProducts(supabaseProducts) {
  const stats = { inserted: 0, updated: 0, skipped: 0, deleted: 0, fetched: supabaseProducts.length };

  let existing;
  try {
    existing = await fetchAllFromCollection('products');
  } catch (err) {
    return { ...stats, error: err.message };
  }

  const map = new Map();
  for (const e of existing) {
    if (e.supabaseId) map.set(e.supabaseId, e);
  }

  const tasks = [];

  for (const sp of supabaseProducts) {
    const norm = normalizeProduct(sp);
    const supabaseVC = norm._supabaseViewCount;
    delete norm._supabaseViewCount;

    const cur = map.get(norm.supabaseId);
    if (cur) {
      // viewCount 合并：H5 新增 + 小程序累加
      const cloudVC = cur.viewCount;
      const lastSnap = cur.supabaseViewCountSnapshot;
      let nextVC;
      if (cloudVC === undefined || lastSnap === undefined) {
        nextVC = supabaseVC;
      } else {
        const delta = Math.max(0, supabaseVC - lastSnap);
        nextVC = cloudVC + delta;
      }
      norm.viewCount = nextVC;
      norm.supabaseViewCountSnapshot = supabaseVC;

      const fieldsChanged = PRODUCT_COMPARE_FIELDS.some(k => cur[k] !== norm[k]);
      const vcChanged = (nextVC !== cloudVC) || (supabaseVC !== lastSnap);

      if (fieldsChanged || vcChanged) {
        const docId = cur._id;
        tasks.push(() => db.collection('products').doc(docId).update({ data: norm }).then(() => { stats.updated++; }));
      } else {
        stats.skipped++;
      }
      map.delete(norm.supabaseId);
    } else {
      norm.viewCount = supabaseVC;
      norm.supabaseViewCountSnapshot = supabaseVC;
      tasks.push(() => db.collection('products').add({ data: norm }).then(() => { stats.inserted++; }));
    }
  }

  // Supabase 已不存在的 → 删除
  for (const orphan of map.values()) {
    const docId = orphan._id;
    tasks.push(() => db.collection('products').doc(docId).remove().then(() => { stats.deleted++; }));
  }

  await runInBatches(tasks, 20);
  return stats;
}

const BANK_COMPARE_FIELDS = ['name', 'points', 'sortOrder', 'updatedAt'];

async function syncBanks(supabaseBanks) {
  const stats = { inserted: 0, updated: 0, skipped: 0, deleted: 0, fetched: supabaseBanks.length };

  let existing;
  try {
    existing = await fetchAllFromCollection('banks_earn');
  } catch (err) {
    return { ...stats, error: err.message };
  }

  const map = new Map();
  for (const e of existing) {
    if (e.supabaseId) map.set(e.supabaseId, e);
  }

  const tasks = [];

  for (const sb of supabaseBanks) {
    const norm = normalizeBank(sb);
    const cur = map.get(norm.supabaseId);
    if (cur) {
      const changed = BANK_COMPARE_FIELDS.some(k => cur[k] !== norm[k]);
      if (changed) {
        const docId = cur._id;
        tasks.push(() => db.collection('banks_earn').doc(docId).update({ data: norm }).then(() => { stats.updated++; }));
      } else {
        stats.skipped++;
      }
      map.delete(norm.supabaseId);
    } else {
      tasks.push(() => db.collection('banks_earn').add({ data: norm }).then(() => { stats.inserted++; }));
    }
  }

  for (const orphan of map.values()) {
    const docId = orphan._id;
    tasks.push(() => db.collection('banks_earn').doc(docId).remove().then(() => { stats.deleted++; }));
  }

  await runInBatches(tasks, 20);
  return stats;
}

exports.main = async (event, context) => {
  const startedAt = Date.now();
  const result = { success: true, products: null, banks: null };

  try {
    // 1. Products
    const supabaseProducts = await httpsGet(
      `${SUPABASE_URL}/rest/v1/products?select=*&limit=1000`,
      {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`
      }
    );
    result.products = Array.isArray(supabaseProducts)
      ? await syncProducts(supabaseProducts)
      : { error: 'Supabase /products did not return an array' };

    // 2. Banks
    const supabaseBanks = await httpsGet(
      `${SUPABASE_URL}/rest/v1/banks_earn?select=*&limit=200`,
      {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`
      }
    );
    result.banks = Array.isArray(supabaseBanks)
      ? await syncBanks(supabaseBanks)
      : { error: 'Supabase /banks_earn did not return an array' };

    result.elapsedMs = Date.now() - startedAt;
    console.log('[sync-products] done', result);
    return result;
  } catch (err) {
    console.error('[sync-products] failed', err);
    return {
      success: false,
      error: err.message,
      products: result.products,
      banks: result.banks
    };
  }
};
