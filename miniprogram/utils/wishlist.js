// 每个账户独立缓存；只同步明确的增删操作，不再将陈旧缓存与云端取并集。
const STORAGE_KEY = 'gift-site-wishlist-v2';
const running = new Map();
let pushTimer;
function openid() {
  try { return JSON.parse(wx.getStorageSync('gift-site-user') || 'null')?.openid || ''; }
  catch (_) { return ''; }
}
function key(oid) { return STORAGE_KEY + ':' + (oid || 'guest'); }
function read(oid) {
  try {
    const value = JSON.parse(wx.getStorageSync(key(oid)) || 'null');
    if (value && Array.isArray(value.ids) && Array.isArray(value.pending)) return value;
  } catch (_) {}
  return { ids: [], pending: [], seq: 0, deviceId: 'd_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2) };
}
function write(oid, state) { wx.setStorageSync(key(oid), JSON.stringify(state)); }
function apply(ids, operations) {
  const values = new Set(ids);
  for (const op of operations) { if (op.present) values.add(op.productId); else values.delete(op.productId); }
  return [...values];
}
function getList() { return read(openid()).ids; }
function saveList(ids) {
  const oid = openid(), state = read(oid), unique = [...new Set(ids.map(String))];
  if (unique.length > 1000 && unique.length > state.ids.length) {
    wx.showToast({ title: '心愿单最多收藏 1000 件，请先移除部分商品', icon: 'none' });
    return state.ids;
  }
  const before = new Set(state.ids), after = new Set(unique);
  for (const id of new Set([...before, ...after])) {
    if (before.has(id) !== after.has(id) && oid) state.pending.push({ seq: ++state.seq, productId: id, present: after.has(id) });
  }
  state.ids = unique; write(oid, state);
  clearTimeout(pushTimer);
  if (oid) pushTimer = setTimeout(() => pushToCloud(oid).catch(e => console.warn('[wishlist] pending sync', e)), 1000);
  return unique;
}
function toggle(id) { const ids = getList(), sid = String(id); return saveList(ids.includes(sid) ? ids.filter(x => x !== sid) : [...ids, sid]); }
function remove(id) { return saveList(getList().filter(x => x !== String(id))); }
function has(id) { return getList().includes(String(id)); }
function getMap() { const map = {}; getList().forEach(id => { map[id] = true; }); return map; }
async function sync(oid) {
  // 新版游客主动添加的商品只迁移一次；旧版共享缓存无归属，不作为新增操作上传。
  const guest = read('');
  if (guest.ids.length) {
    const state = read(oid);
    for (const productId of guest.ids) if (!state.ids.includes(productId)) {
      state.pending.push({ seq: ++state.seq, productId, present: true }); state.ids.push(productId);
    }
    write(oid, state); guest.ids = []; write('', guest);
  }
  for (;;) {
    if (openid() !== oid) return;
    const sent = read(oid), operations = sent.pending.slice(0, 100);
    const response = await wx.cloud.callFunction({ name: 'wishlist-sync', data: { deviceId: sent.deviceId, operations } });
    const result = response && response.result;
    if (!result || !result.success || !Array.isArray(result.productIds)) throw Error(result && result.error || '心愿单同步失败');
    const latest = read(oid);
    latest.pending = latest.pending.filter(op => op.seq > result.ack);
    latest.ids = apply(result.productIds, latest.pending);
    write(oid, latest);
    if (result.rejected && result.rejected.length && openid() === oid) wx.showToast({ title: '心愿单已满，部分新增收藏未保存', icon: 'none' });
    if (!latest.pending.length) return;
  }
}
function pushToCloud(oid = openid()) {
  if (!oid || oid !== openid()) return Promise.resolve();
  if (running.has(oid)) return running.get(oid);
  const task = sync(oid).finally(() => running.delete(oid));
  running.set(oid, task); return task;
}
async function pullAndMerge() {
  try { await pushToCloud(); }
  catch (e) { console.warn('[wishlist] sync failed; local changes retained', e); return false; }
  return true;
}
module.exports = { STORAGE_KEY, getList, saveList, has, toggle, remove, getMap, pullAndMerge, pushToCloud };
