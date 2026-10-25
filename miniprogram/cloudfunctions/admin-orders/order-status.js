// 订单取消、余额退还和流水必须一起提交；事务冲突重试时重新检查退款标记。
module.exports = function createOrderStatusUpdater({ db, normalizeStatus, allowedStatuses }) {
  return async function updateOrderStatus({ orderId, status, adminNote }) {
    if (!orderId) throw new Error('缺少 orderId');
    const next = normalizeStatus(status);
    if (!allowedStatuses.includes(next)) throw new Error('非法状态');

    // 微信数据库事务仅按文档 ID 读取。先定位账户，再在事务内校验归属。
    let accountId;
    if (next === 'cancelled') {
      const before = (await db.collection('orders').doc(orderId).get()).data;
      if (!before) throw new Error('订单不存在');
      if (before.pointsDeducted && !before.pointsRefundedAt && Number(before.totalCards) > 0) {
        if (!before.openid) throw new Error('订单缺少客户账户，取消失败');
        const accounts = await db.collection('users').where({ openid: before.openid }).limit(2).get();
        if (accounts.data.length !== 1) throw new Error('客户积分账户不存在或不唯一，取消失败');
        accountId = accounts.data[0]._id;
      }
    }

    return db.runTransaction(async transaction => {
      const orderRef = transaction.collection('orders').doc(orderId);
      const cur = (await orderRef.get()).data;
      if (!cur) throw new Error('订单不存在');
      if (cur.pointsRefundedAt && next !== 'cancelled') {
        throw new Error('该订单已取消并退还积分，请客户重新下单');
      }
      const now = new Date();
      const patch = { status: next, updatedAt: now };
      if (next === 'signed' && !cur.signedAt) patch.signedAt = now;
      if (typeof adminNote === 'string') patch.adminNote = adminNote.slice(0, 1000);

      if (next === 'cancelled' && cur.pointsDeducted && !cur.pointsRefundedAt) {
        // totalCards 是下单扣分时保存的快照，不使用商品当前积分价格。
        const points = Number(cur.totalCards);
        if (!Number.isFinite(points) || points < 0) throw new Error('订单扣分记录异常，取消失败');
        if (points > 0) {
          if (!accountId) throw new Error('客户积分账户不存在，取消失败');
          const accountRef = transaction.collection('users').doc(accountId);
          const account = (await accountRef.get()).data;
          if (!account || account.openid !== cur.openid) throw new Error('客户积分账户不匹配，取消失败');
          await accountRef.update({ data: { rewardPoints: db.command.inc(points), updatedAt: now } });
          await transaction.collection('points_ledger').add({ data: {
            openid: cur.openid, delta: points, reason: '订单取消退还', refId: orderId, createdAt: now
          } });
          patch.pointsRefundedAt = now;
          patch.pointsRefundedAmount = points;
        }
      }
      await orderRef.update({ data: patch });
      return { ...cur, ...patch };
    });
  };
};
