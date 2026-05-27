// 心愿单本地存储 + 云端同步
//
// 策略：
// - 未登录：纯本地存储，行为同以前
// - 登录后：
//   · 启动 / 进入应用：拉云端 → 与本地取并集 → 双写
//   · 每次 toggle/remove/clear：本地立刻更新（UI 同步），1 秒防抖推云端
// - 登出：保留本地（用户加的礼品不该突然消失）

const STORAGE_KEY = 'gift-site-wishlist';

function db() {
  return wx.cloud.database();
}

function _readRaw() {
  try {
    const raw = wx.getStorageSync(STORAGE_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr.map(String) : [];
  } catch (err) {
    return [];
  }
}

function _writeRaw(ids) {
  const unique = Array.from(new Set(ids.map(String)));
  wx.setStorageSync(STORAGE_KEY, JSON.stringify(unique));
  return unique;
}

function getList() {
  return _readRaw();
}

// 同步保存：写本地 + 触发推云端
function saveList(ids) {
  const unique = _writeRaw(ids);
  schedulePush();
  return unique;
}

function has(id) {
  return _readRaw().includes(String(id));
}

function toggle(id) {
  const list = _readRaw();
  const sid = String(id);
  const idx = list.indexOf(sid);
  if (idx >= 0) list.splice(idx, 1);
  else list.push(sid);
  return saveList(list);
}

function remove(id) {
  return saveList(_readRaw().filter(x => x !== String(id)));
}

function getMap() {
  const map = {};
  _readRaw().forEach(id => { map[id] = true; });
  return map;
}

// ============ 云端同步 ============

let pushTimer = null;
let pulling = false;

function _getOpenid() {
  try {
    const raw = wx.getStorageSync('gift-site-user');
    if (!raw) return '';
    const u = JSON.parse(raw);
    return (u && u.openid) || '';
  } catch (err) {
    return '';
  }
}

function schedulePush() {
  const openid = _getOpenid();
  if (!openid) return; // 未登录不推
  clearTimeout(pushTimer);
  pushTimer = setTimeout(() => pushToCloud(openid).catch(err => {
    console.warn('[wishlist] push failed', err);
  }), 1000);
}

async function pushToCloud(openid) {
  if (!openid) return;
  const productIds = _readRaw();
  const now = new Date();
  const c = db().collection('wishlists');
  const existing = await c.where({ openid }).limit(1).get();
  if (existing.data[0]) {
    await c.doc(existing.data[0]._id).update({
      data: { productIds, updatedAt: now }
    });
  } else {
    await c.add({ data: { openid, productIds, createdAt: now, updatedAt: now } });
  }
}

// 启动 / 登录后调：拉云端，与本地合并（并集），再回写云端
async function pullAndMerge() {
  const openid = _getOpenid();
  if (!openid || pulling) return;
  pulling = true;
  try {
    const c = db().collection('wishlists');
    const res = await c.where({ openid }).limit(1).get();
    const cloud = res.data[0];
    const cloudIds = cloud && Array.isArray(cloud.productIds) ? cloud.productIds.map(String) : [];
    const localIds = _readRaw();

    const merged = Array.from(new Set([...localIds, ...cloudIds]));

    // 本地立即更新（不触发再次 push，下面会一起处理）
    _writeRaw(merged);

    // 如果合并结果与云端不一致 → 推一次
    const cloudSorted = [...cloudIds].sort();
    const mergedSorted = [...merged].sort();
    const differs = cloudSorted.length !== mergedSorted.length ||
                    cloudSorted.some((id, i) => id !== mergedSorted[i]);
    if (differs) {
      await pushToCloud(openid);
    }
  } catch (err) {
    console.warn('[wishlist] pull/merge failed', err);
  } finally {
    pulling = false;
  }
}

module.exports = {
  STORAGE_KEY,
  getList,
  saveList,
  has,
  toggle,
  remove,
  getMap,
  pullAndMerge,
  pushToCloud
};
