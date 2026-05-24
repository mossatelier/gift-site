// 心愿单本地存储（与 H5 行为一致：只存 ID 数组，详情从云开发实时拉）

const STORAGE_KEY = 'gift-site-wishlist';

function getList() {
  try {
    const raw = wx.getStorageSync(STORAGE_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr.map(String) : [];
  } catch (err) {
    return [];
  }
}

function saveList(ids) {
  const unique = Array.from(new Set(ids.map(String)));
  wx.setStorageSync(STORAGE_KEY, JSON.stringify(unique));
  return unique;
}

function has(id) {
  return getList().includes(String(id));
}

function toggle(id) {
  const list = getList();
  const sid = String(id);
  const idx = list.indexOf(sid);
  if (idx >= 0) {
    list.splice(idx, 1);
  } else {
    list.push(sid);
  }
  return saveList(list);
}

function remove(id) {
  const list = getList().filter(x => x !== String(id));
  return saveList(list);
}

// 返回 { id: true } 形式的 map，便于 WXML 模板直接判断
function getMap() {
  const map = {};
  getList().forEach(id => { map[id] = true; });
  return map;
}

module.exports = {
  STORAGE_KEY,
  getList,
  saveList,
  has,
  toggle,
  remove,
  getMap
};
