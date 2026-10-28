// 两个云函数各自上传此文件；逻辑必须保持一致。identity_keys 仅允许服务端读写。
const crypto = require('crypto');
module.exports = function identityService(db) {
  const digest = value => crypto.createHash('sha256').update(value).digest('hex').slice(0, 32);
  async function read(ref) {
    try { return (await ref.get()).data || null; }
    catch (e) {
      if (/not.exist|not.found|不存在/i.test(String(e.message || e.errMsg || ''))) return null;
      throw e;
    }
  }
  async function findUser(openid) {
    const rows = (await db.collection('users').where({ openid }).limit(2).get()).data;
    if (rows.length > 1) throw Error('账号记录重复，请联系客服核实');
    return rows[0] || null;
  }
  async function claim(tx, type, value, openid) {
    const id = digest(type + ':' + value), ref = tx.collection('identity_keys').doc(id);
    const key = await read(ref);
    if (key && key.openid && key.openid !== openid) {
      const err = Error(type === 'phone' ? '该手机号已绑定其他微信账号，如需换绑请联系客服' : '推荐码冲突，请重试');
      err.code = type === 'code' ? 'CODE_COLLISION' : 'PHONE_TAKEN';
      throw err;
    }
    const data = { kind: type, openid, updatedAt: new Date() };
    if (key) await ref.update({ data }); else await tx.collection('identity_keys').add({ data: { _id: id, ...data } });
  }
  async function release(tx, type, value, openid) {
    if (!value) return;
    const ref = tx.collection('identity_keys').doc(digest(type + ':' + value));
    const key = await read(ref);
    if (key && key.openid === openid) await ref.update({ data: { openid: '', updatedAt: new Date() } });
  }
  async function upsert(openid, options = {}) {
    const existing = await findUser(openid);
    const uid = existing ? existing._id : 'wx_' + digest(openid);
    if (options.phone) {
      const owners = (await db.collection('users').where({ boundPhone: options.phone }).limit(2).get()).data;
      if (owners.some(u => u.openid !== openid)) throw Error('该手机号已绑定其他微信账号，如需换绑请联系客服');
    }
    for (let attempt = 0; attempt < 25; attempt++) {
      let candidate = existing && existing.referralCode;
      if (options.ensureCode && !candidate) {
        candidate = String(Math.floor(100000 + Math.random() * 900000));
        const rows = (await db.collection('users').where({ referralCode: candidate }).limit(1).get()).data;
        if (rows.length) continue;
      }
      try {
        return await db.runTransaction(async tx => {
          const ref = tx.collection('users').doc(uid), current = await read(ref);
          if (current && current.openid !== openid) throw Error('账户身份不匹配');
          if (options.bind) {
            if (current && current.referredByCode) return { success: true, already: true };
            // 仍然只绑本次首次创建的新用户；老用户不会被后来扫描的推荐码抢走。
            if (current) return { success: true, skipped: 'existing-user' };
            const owner = await read(tx.collection('users').doc(options.bind._id));
            if (!owner || owner.referralCode !== options.bind.referralCode || owner.openid !== options.bind.openid) throw Error('推荐码已变更，请重新扫码');
            if (owner.openid === openid) throw Error('不能推荐自己');
          }
          const now = new Date();
          const user = current || { openid, nickName: '微信用户', avatarUrl: '', rewardPoints: 0, createdAt: now };
          const patch = { updatedAt: now };
          if (options.nickName) patch.nickName = options.nickName;
          if (options.avatarUrl) patch.avatarUrl = options.avatarUrl;
          if (options.ensureCode) {
            const code = user.referralCode || candidate;
            await claim(tx, 'code', code, openid);
            patch.referralCode = code;
          }
          if (options.phone !== undefined) {
            if (options.requireUnboundPhone && user.boundPhone) throw Error('已绑定手机号，如需更换请先解绑');
            if (options.phone) await claim(tx, 'phone', options.phone, openid);
            if (user.boundPhone !== options.phone) await release(tx, 'phone', user.boundPhone, openid);
            patch.boundPhone = options.phone;
            patch.boundPhoneAt = options.phone ? now : null;
          }
          if (options.bind) {
            const owner = options.bind;
            Object.assign(patch, { referredByCode: owner.referralCode, referredByOpenid: owner.openid, referredAt: now });
            await tx.collection('referrals').add({ data: {
              _id: 'ref_' + digest(openid), referrerOpenid: owner.openid, referrerCode: owner.referralCode,
              refereeOpenid: openid, refereeNick: user.nickName, refereePhone: '', status: '待审核',
              rewardPoints: 0, createdAt: now, openedAt: null, rewardedAt: null
            } });
          }
          if (current) await ref.update({ data: patch });
          else await tx.collection('users').add({ data: { _id: uid, ...user, ...patch } });
          return options.bind ? { success: true } : { _id: uid, ...user, ...patch };
        });
      } catch (e) {
        if (e.code === 'CODE_COLLISION' && !(existing && existing.referralCode)) continue;
        throw e;
      }
    }
    throw Error('生成推荐码失败，请重试');
  }
  async function bindReferrer(openid, code) {
    const value = String(code || '').trim();
    if (!value) return { success: false, terminal: true, error: '缺少推荐码' };
    // 无效码不得创建用户，否则会把未注册用户误变成“老用户”。
    const rows = (await db.collection('users').where({ referralCode: value }).limit(2).get()).data;
    if (rows.length !== 1) return { success: false, terminal: rows.length === 0, error: rows.length ? '推荐码重复，请联系客服核实' : '推荐码无效' };
    if (rows[0].openid === openid) return { success: false, terminal: true, error: '不能推荐自己' };
    return upsert(openid, { ensureCode: true, bind: rows[0] });
  }
  return { upsert, bindReferrer };
};
