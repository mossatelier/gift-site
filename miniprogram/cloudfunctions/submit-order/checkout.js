// 所有同一客户的下单事务都读写同一个 users 文档，冲突后重新检查最近订单。
// 这样两个请求同时到达，也只能生成一单、扣一次分；不需要新建集合。
const RATE_WINDOW_MS = 60 * 1000;
const DEDUP_WINDOW_MS = 30 * 1000;

function signature(order) {
  const quantities = {};
  for (const item of order.items || []) {
    const id = String(item.productId || item._id || '');
    quantities[id] = (quantities[id] || 0) + (Number(item.qty) || 1);
  }
  const address = order.address || {};
  return JSON.stringify([
    Object.keys(quantities).sort().map(id => [id, quantities[id]]),
    ['recipient', 'phone', 'province', 'city', 'district', 'detail'].map(k => String(address[k] || '')),
    String(order.remark || '').trim()
  ]);
}

async function optionalOrder(ref) {
  try { return (await ref.get()).data || null; }
  catch (err) {
    if (/not exist|not found|不存在/i.test(String(err.message || err.errMsg || ''))) return null;
    throw err;
  }
}

module.exports = function createCheckout(db) {
  return async function checkout({ openid, items, addressId, remark }) {
    const users = await db.collection('users').where({ openid }).limit(2).get();
    if (users.data.length !== 1) {
      return { success: false, error: '客户积分账户不存在或不唯一，请联系客服处理' };
    }
    // 兼容部署前创建的订单；新请求依靠用户文档中的近期订单记录协调并发。
    const recent = await db.collection('orders')
      .where({ openid, createdAt: db.command.gt(new Date(Date.now() - RATE_WINDOW_MS)) })
      .orderBy('createdAt', 'desc').limit(10).get();

    return db.runTransaction(async transaction => {
      const userRef = transaction.collection('users').doc(users.data[0]._id);
      const user = (await userRef.get()).data;
      if (!user || user.openid !== openid) throw new Error('客户积分账户无效');
      const now = new Date();
      const since = now.getTime() - RATE_WINDOW_MS;
      const history = Array.isArray(user.checkoutHistory) ? user.checkoutHistory : [];
      const ids = new Set((recent.data || []).map(o => o._id));
      history.filter(o => new Date(o.createdAt).getTime() >= since).forEach(o => ids.add(o.id));
      const recentOrders = [];
      for (const id of ids) {
        const order = await optionalOrder(transaction.collection('orders').doc(id));
        if (order && order.openid === openid && new Date(order.createdAt).getTime() >= since) recentOrders.push(order);
      }

      const addressDoc = (await transaction.collection('addresses').doc(addressId).get()).data;
      if (!addressDoc || addressDoc.openid !== openid) return { success: false, error: '地址无效' };
      const address = {};
      for (const key of ['recipient', 'phone', 'province', 'city', 'district', 'detail']) address[key] = addressDoc[key] || '';
      const quantities = new Map();
      for (const item of items) {
        const id = String(item && item._id || '');
        const qty = item && item.qty != null ? Number(item.qty) : 1;
        if (!id || !Number.isInteger(qty) || qty < 1 || qty > 99) return { success: false, error: '商品或数量无效' };
        quantities.set(id, (quantities.get(id) || 0) + qty);
        if (quantities.get(id) > 99) return { success: false, error: '同一商品单次最多兑换99件' };
      }
      const snapshots = [];
      let totalCards = 0;
      for (const [id, qty] of quantities) {
        const p = (await transaction.collection('products').doc(id).get()).data;
        if (!p || p.isActive !== true || p.deleted) return { success: false, error: '部分商品已下架或不存在，请刷新礼品列表后重新提交' };
        if (p.isDisplayOnly) return { success: false, error: '活动说明不能兑换' };
        const cards = Number(p.cardsNeeded || 0);
        if (!Number.isFinite(cards) || cards < 0) return { success: false, error: '商品积分配置异常，请联系客服' };
        snapshots.push({
          productId: p._id, supabaseId: p.supabaseId || '', title: p.title || '',
          imageUrl: (Array.isArray(p.images) && p.images[0]) || p.imageUrl || '',
          cardsNeeded: cards, price: Number(p.price) || 0, qty
        });
        totalCards += cards * qty;
      }
      const sig = signature({ items: snapshots, address, remark });
      const duplicate = recentOrders.find(o => o.status !== 'cancelled' && !o.pointsRefundedAt
        && new Date(o.createdAt).getTime() >= now.getTime() - DEDUP_WINDOW_MS && signature(o) === sig);
      // 先返回已成功订单，再检查限频和余额：重试不应因刚扣过分而报积分不足。
      if (duplicate) return {
        success: true, orderId: duplicate._id, itemCount: duplicate.itemCount,
        totalCards: duplicate.totalCards, duplicated: true
      };
      if (recentOrders.length >= 3) return { success: false, error: '操作太频繁，请稍后再试' };
      const balance = Number(user.rewardPoints || 0);
      if (!Number.isFinite(balance)) throw new Error('积分余额异常，请联系客服');
      if (balance < totalCards) return {
        success: false, error: `积分不足，还差 ${totalCards - balance} 分才能兑换该礼品`, insufficientPoints: true
      };
      const order = {
        _openid: openid, openid, items: snapshots, address, remark, totalCards,
        itemCount: snapshots.length, status: 'pending', pointsDeducted: totalCards > 0,
        createdAt: now, updatedAt: now
      };
      const created = await transaction.collection('orders').add({ data: order });
      await userRef.update({ data: {
        rewardPoints: db.command.inc(-totalCards), updatedAt: now,
        checkoutHistory: recentOrders.map(o => ({ id: o._id, createdAt: o.createdAt }))
          .concat({ id: created._id, createdAt: now })
      } });
      if (totalCards > 0) await transaction.collection('points_ledger').add({ data: {
        openid, delta: -totalCards, reason: '礼品兑换', refId: created._id, createdAt: now
      } });
      return { success: true, orderId: created._id, itemCount: snapshots.length, totalCards, order };
    });
  };
};
