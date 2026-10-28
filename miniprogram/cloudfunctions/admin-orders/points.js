const crypto = require('crypto');
module.exports = function createPointsService(db) {
  async function account(openid) {
    const r = await db.collection('users').where({ openid }).limit(2).get();
    if (r.data.length !== 1) throw Error('客户积分账户不存在或不唯一，请先核实账户');
    return r.data[0]._id;
  }
  async function change(tx, uid, openid, delta, entry) {
    const ref = tx.collection('users').doc(uid);
    const user = (await ref.get()).data;
    if (!user || user.openid !== openid) throw Error('积分账户不匹配');
    const balance = Number(user.rewardPoints || 0);
    if (!Number.isSafeInteger(delta) || !Number.isSafeInteger(balance + delta) || balance + delta < 0) throw Error('可用积分不足，无法撤销已使用的积分');
    await ref.update({ data: { rewardPoints: db.command.inc(delta), updatedAt: new Date() } });
    return tx.collection('points_ledger').add({ data: { ...entry, openid, delta, createdAt: new Date() } });
  }
  async function grant({ openid, amount, note, operationId }) {
    const oid = String(openid || '').trim(), amt = Number(amount);
    if (!oid || !Number.isSafeInteger(amt) || amt <= 0) throw Error('积分数额必须是正整数，并指定客户');
    const uid = await account(oid);
    const reason = '客服手动发放' + (note ? '：' + String(note).trim().slice(0,100) : '');
    // 请求编号作为流水的唯一编号；事务重试或响应丢失后的重试都不会再次发放。
    const key = operationId ? crypto.createHash('sha256').update(oid + ':' + String(operationId)).digest('hex') : '';
    return db.runTransaction(async tx => {
      let prior;
      if (key) {
        try { prior = (await tx.collection('points_ledger').doc(key).get()).data; }
        catch (e) { if (!/not.exist|not.found|不存在/i.test(String(e.message || e.errMsg))) throw e; }
      }
      if (prior) {
        if (prior.delta !== amt || prior.reason !== reason || prior.openid !== oid) throw Error('操作编号已用于另一笔发放');
        return { ledgerId: key, openid: oid, delta: amt, duplicated: true };
      }
      const added = await change(tx, uid, oid, amt, { ...(key ? { _id: key } : {}), reason, refId: '', manual: true, reversedAt: null });
      return { ledgerId: added._id, openid: oid, delta: amt };
    });
  }
  async function revoke({ ledgerId }) {
    const id = String(ledgerId || '').trim();
    if (!id) throw Error('缺少 ledgerId');
    const before = (await db.collection('points_ledger').doc(id).get()).data;
    if (!before) throw Error('流水记录不存在');
    const uid = await account(before.openid);
    return db.runTransaction(async tx => {
      const ref = tx.collection('points_ledger').doc(id), entry = (await ref.get()).data;
      if (!entry || !entry.manual || !(entry.delta > 0)) throw Error('只能撤销客服手动发放的记录');
      if (entry.reversedAt) return { ok: true, duplicated: true };
      await change(tx, uid, entry.openid, -entry.delta, { reason: '撤销手动发放', refId: id, manual: false });
      await ref.update({ data: { reversedAt: new Date() } });
      return { ok: true };
    });
  }
  async function referral({ id, status, rewardPoints = 1, remove = false }) {
    const before = (await db.collection('referrals').doc(id).get()).data;
    if (!before) throw Error('推荐记录不存在');
    const uid = before.referrerOpenid ? await account(before.referrerOpenid) : null;
    return db.runTransaction(async tx => {
      const ref = tx.collection('referrals').doc(id), rec = (await ref.get()).data;
      if (!rec) throw Error('推荐记录不存在或已解绑');
      const now = new Date(), patch = { status, updatedAt: now };
      let delta = 0;
      if (!remove && status === '开户成功' && !rec.rewardedAt) {
        delta = Number(rewardPoints);
        if (!Number.isSafeInteger(delta) || delta < 0) throw Error('奖励积分必须是非负整数');
        Object.assign(patch, { rewardPoints: delta, rewardedAt: now, openedAt: rec.openedAt || now });
      } else if ((remove || status !== '开户成功') && rec.rewardedAt) {
        delta = -Number(rec.rewardPoints || 0);
        if (!Number.isFinite(delta) || delta > 0) throw Error('原奖励记录异常');
        Object.assign(patch, { rewardPoints: 0, rewardedAt: null, openedAt: null });
      }
      if (delta) await change(tx, uid, rec.referrerOpenid, delta, {
        reason: delta > 0 ? '推荐开户奖励' : remove ? '推荐解绑回收' : '推荐开户撤销', refId: id
      });
      if (remove) await ref.remove(); else await ref.update({ data: patch });
      return { _id: id, status };
    });
  }
  async function unbind({ id, openid }) {
    let oid = String(openid || '').trim();
    if (!id && !oid) throw Error('缺少 id 或 openid');
    let records = [];
    if (id) {
      const rec = (await db.collection('referrals').doc(id).get()).data;
      if (!rec) throw Error('推荐记录不存在或已解绑');
      if (oid && rec.refereeOpenid && oid !== rec.refereeOpenid) throw Error('推荐记录与客户不匹配');
      oid = rec.refereeOpenid || oid;
      records = [rec];
    }
    // 解绑的是整段关系；同一客户的历史重复记录也一起回收，不能只处理其中一条。
    if (oid) {
      let skip = 0;
      for (;;) {
        const page = (await db.collection('referrals').where({ refereeOpenid: oid }).skip(skip).limit(100).get()).data;
        for (const rec of page) if (!records.some(r => r._id === rec._id)) records.push(rec);
        if (page.length < 100) break;
        skip += page.length;
      }
    }
    const ids = {};
    for (const rec of records) if (rec.referrerOpenid && !ids[rec.referrerOpenid]) ids[rec.referrerOpenid] = await account(rec.referrerOpenid);
    const referee = oid ? await account(oid) : null;
    return db.runTransaction(async tx => {
      let removed = 0;
      for (const before of records) {
        const ref = tx.collection('referrals').doc(before._id);
        const rec = (await ref.get()).data;
        if (!rec) throw Error('推荐记录已变更，请刷新后重试');
        if (rec.referrerOpenid !== before.referrerOpenid || rec.refereeOpenid !== before.refereeOpenid) throw Error('推荐关系已变更，请刷新后重试');
        if (rec.rewardedAt && Number(rec.rewardPoints) > 0) {
          await change(tx, ids[rec.referrerOpenid], rec.referrerOpenid, -Number(rec.rewardPoints), { reason: '推荐解绑回收', refId: rec._id });
        }
        await ref.remove();
        removed++;
      }
      if (referee) {
        const ref = tx.collection('users').doc(referee), user = (await ref.get()).data;
        if (!user || user.openid !== oid) throw Error('客户账户已变更');
        await ref.update({ data: { referredByCode: '', referredByOpenid: '', referredAt: null, updatedAt: new Date() } });
      }
      return { unbound: true, removed };
    });
  }
  return { grant, revoke, referral, unbind };
};
