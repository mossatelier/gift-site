// 定时同步 Supabase ↔ 云开发
// 同步两张表：products + banks_earn
// 触发器：每 5 分钟一次（见 config.json）
//
// 关键策略：
// - 按 supabaseId 匹配做 upsert，云开发 _id 不变 → 心愿单引用稳定
// - viewCount 仅在 insert 时初始化（来自 supabase view_count），update 时不覆盖
//   这样小程序累加的浏览量不会被同步抹掉

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
    viewCount: Number(p.view_count) || 0  // 仅用于初次 insert
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

// 通用 upsert：preserveFields 列出的字段在 update 时不覆盖（保留云开发现有值）
async function upsertCollection({
  collection,
  incoming,        // 已 normalize 的待写入数据，必须有 supabaseId
  preserveFields = [],
  compareFields    // 用于判断是否需要 update 的字段
}) {
  const stats = { inserted: 0, updated: 0, skipped: 0, deleted: 0, fetched: incoming.length };
  let existing;
  try {
    existing = await fetchAllFromCollection(collection);
  } catch (err) {
    console.warn(`[${collection}] 拉取现有数据失败：${err.message}（集合可能不存在，跳过本表同步）`);
    return { ...stats, error: err.message };
  }

  const existingMap = new Map();
  for (const e of existing) {
    if (e.supabaseId) existingMap.set(e.supabaseId, e);
  }

  for (const item of incoming) {
    const cur = existingMap.get(item.supabaseId);
    if (cur) {
      const changed = compareFields.some(k => cur[k] !== item[k]);
      if (changed) {
        const updateData = { ...item };
        for (const f of preserveFields) delete updateData[f];
        await db.collection(collection).doc(cur._id).update({ data: updateData });
        stats.updated++;
      } else {
        stats.skipped++;
      }
      existingMap.delete(item.supabaseId);
    } else {
      await db.collection(collection).add({ data: item });
      stats.inserted++;
    }
  }

  // Supabase 已不存在的 → 删除
  for (const orphan of existingMap.values()) {
    await db.collection(collection).doc(orphan._id).remove();
    stats.deleted++;
  }

  return stats;
}

exports.main = async (event, context) => {
  const startedAt = Date.now();
  const result = { success: true, products: null, banks: null };

  try {
    // ============ 1. Products 同步 ============
    const supabaseProducts = await httpsGet(
      `${SUPABASE_URL}/rest/v1/products?select=*&limit=1000`,
      {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`
      }
    );
    if (Array.isArray(supabaseProducts)) {
      result.products = await upsertCollection({
        collection: 'products',
        incoming: supabaseProducts.map(normalizeProduct),
        preserveFields: ['viewCount'],   // viewCount 由小程序累加，不要被同步抹掉
        compareFields: [
          'title', 'category', 'subcategory', 'price', 'cardsNeeded',
          'description', 'imageUrl', 'sortOrder', 'isActive', 'updatedAt'
        ]
      });
    } else {
      result.products = { error: 'Supabase /products did not return an array' };
    }

    // ============ 2. Banks (banks_earn) 同步 ============
    const supabaseBanks = await httpsGet(
      `${SUPABASE_URL}/rest/v1/banks_earn?select=*&limit=200`,
      {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`
      }
    );
    if (Array.isArray(supabaseBanks)) {
      result.banks = await upsertCollection({
        collection: 'banks_earn',
        incoming: supabaseBanks.map(normalizeBank),
        preserveFields: [],
        compareFields: ['name', 'points', 'sortOrder', 'updatedAt']
      });
    } else {
      result.banks = { error: 'Supabase /banks_earn did not return an array' };
    }

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
