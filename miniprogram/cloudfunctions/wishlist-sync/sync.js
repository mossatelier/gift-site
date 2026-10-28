const crypto = require('crypto');
module.exports = db => async function sync(openid, { deviceId, operations = [] }) {
  if (!/^[a-zA-Z0-9_-]{8,100}$/.test(deviceId || '') || !Array.isArray(operations) || operations.length > 100) throw Error('心愿单同步参数不正确');
  let previous = 0;
  for (const op of operations) {
    if (!op || !Number.isSafeInteger(op.seq) || op.seq <= previous || typeof op.present !== 'boolean' || typeof op.productId !== 'string' || !op.productId || op.productId.length > 128) throw Error('心愿单修改记录不正确');
    previous = op.seq;
  }
  const id = 'wishlist_' + crypto.createHash('sha256').update(openid).digest('hex');
  // 仅首次升级时采用最后保存的旧列表；之后旧设备缓存不再反向覆盖新列表。
  const legacy = (await db.collection('wishlists').where({ openid }).orderBy('updatedAt', 'desc').limit(1).get()).data[0];
  return db.runTransaction(async tx => {
    const ref = tx.collection('wishlists').doc(id);
    let current;
    try { current = (await ref.get()).data; }
    catch (err) { if (!/not.exist|not.found|不存在/i.test(String(err.message || err.errMsg))) throw err; }
    if (current && current.openid !== openid) throw Error('心愿单账户不匹配');
    const source = current || legacy || {};
    const ids = new Set((current ? current.productIdsV2 || [] : source.productIds || []).map(String));
    const devices = { ...(current && current.devices || {}) };
    let ack = devices[deviceId] || 0;
    if (!(deviceId in devices) && Object.keys(devices).length >= 128) throw Error('同步设备过多，请联系客服处理');
    const rejected = [];
    for (const op of operations) {
      if (op.seq <= ack) continue;
      if (op.seq !== ack + 1) throw Error('心愿单修改记录不连续，请重新同步');
      if (op.present && !ids.has(op.productId) && ids.size >= 1000) rejected.push(op.productId);
      else if (op.present) ids.add(op.productId);
      else ids.delete(op.productId);
      ack = op.seq;
    }
    devices[deviceId] = ack;
    const data = { openid, _openid: openid, productIds: [...ids], productIdsV2: [...ids], devices, updatedAt: new Date(), version: (current && current.version || 0) + 1 };
    if (current) await ref.update({ data });
    else await tx.collection('wishlists').add({ data: { _id: id, ...data, createdAt: new Date() } });
    return { productIds: data.productIds, ack, rejected, version: data.version };
  });
};
