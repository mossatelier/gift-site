const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const createUpdater = require('../miniprogram/cloudfunctions/admin-orders/order-status');

// In-memory optimistic transactions: competing commits retry; failed writes roll back.
function fixture(orders, { failWrite, users } = {}) {
  let rows = {
    orders: Object.fromEntries(orders.map(o => [o._id, { openid: 'customer', totalCards: 6, pointsDeducted: true, status: 'pending', ...o }])),
    users: users || { account: { _id: 'account', openid: 'customer', rewardPoints: 10 } },
    points_ledger: {}
  };
  let revision = 0;
  let sequence = 0;
  const collection = (data, name) => ({
    doc(id) {
      return {
        async get() { return { data: structuredClone(data[name][id]) }; },
        async update({ data: patch }) {
          if (name === failWrite) throw new Error('simulated ' + name + ' failure');
          assert.ok(data[name][id], 'document must exist');
          for (const [key, value] of Object.entries(patch)) {
            data[name][id][key] = value && value.increment !== undefined
              ? (data[name][id][key] || 0) + value.increment : value;
          }
          return { stats: { updated: 1 } };
        }
      };
    },
    where(condition) {
      return { limit(count) { return { async get() {
        return { data: Object.values(data[name]).filter(row => Object.entries(condition).every(([k,v]) => row[k] === v)).slice(0, count) };
      } }; } };
    },
    async add({ data: row }) {
      if (name === failWrite) throw new Error('simulated ' + name + ' failure');
      const id = 'ledger-' + sequence++;
      data[name][id] = { _id: id, ...row };
      return { _id: id };
    }
  });
  const db = {
    command: { inc: increment => ({ increment }) },
    collection: name => collection(rows, name),
    async runTransaction(callback) {
      for (let attempt = 0; attempt < 50; attempt++) {
        const originalRevision = revision;
        const copy = structuredClone(rows);
        const result = await callback({ collection: name => collection(copy, name) });
        if (revision !== originalRevision) continue;
        rows = copy;
        revision++;
        return result;
      }
      throw new Error('transaction conflict');
    }
  };
  const update = createUpdater({ db, normalizeStatus: s => ({ processing: 'pending', preparing: 'pending', done: 'shipped', closed: 'signed' }[s] || s || 'pending'), allowedStatuses: ['pending', 'shipped', 'signed', 'cancelled'] });
  return { db, update, snapshot: () => structuredClone(rows) };
}

for (const status of ['pending', 'processing', 'preparing', 'shipped', 'signed', 'cancelled']) {
  test('cancel refunds actual deduction from ' + status, async () => {
    const f = fixture([{ _id: 'order', status, totalCards: 13 }]);
    await f.update({ orderId: 'order', status: 'cancelled' });
    const data = f.snapshot();
    assert.equal(data.users.account.rewardPoints, 23);
    assert.equal(data.orders.order.status, 'cancelled');
    assert.equal(data.orders.order.pointsRefundedAmount, 13);
    assert.equal(Object.values(data.points_ledger)[0].refId, 'order');
    assert.equal(Object.values(data.points_ledger)[0].delta, 13);
  });
}
test('concurrent and repeated cancellation refunds only once', async () => {
  const f = fixture([{ _id: 'order' }]);
  await Promise.all(Array.from({ length: 12 }, () => f.update({ orderId: 'order', status: 'cancelled' })));
  await f.update({ orderId: 'order', status: 'cancelled' });
  assert.equal(f.snapshot().users.account.rewardPoints, 16);
  assert.equal(Object.keys(f.snapshot().points_ledger).length, 1);
});
test('concurrent refunds for different orders preserve both credits', async () => {
  const f = fixture([{ _id: 'a' }, { _id: 'b', totalCards: 9 }]);
  await Promise.all(['a', 'b'].map(orderId => f.update({ orderId, status: 'cancelled' })));
  assert.equal(f.snapshot().users.account.rewardPoints, 25);
  assert.equal(Object.keys(f.snapshot().points_ledger).length, 2);
});
for (const failWrite of ['users', 'points_ledger', 'orders']) {
  test(failWrite + ' failure leaves balance, status and ledger unchanged', async () => {
    const f = fixture([{ _id: 'order' }], { failWrite });
    const before = f.snapshot();
    await assert.rejects(f.update({ orderId: 'order', status: 'cancelled' }), /simulated/);
    assert.deepEqual(f.snapshot(), before);
  });
}
test('unpaid, zero-point and already refunded orders receive no credit', async () => {
  const f = fixture([{ _id: 'unpaid', pointsDeducted: false }, { _id: 'zero', totalCards: 0 }, { _id: 'refunded', pointsRefundedAt: new Date() }]);
  for (const orderId of ['unpaid', 'zero', 'refunded']) await f.update({ orderId, status: 'cancelled' });
  assert.equal(f.snapshot().users.account.rewardPoints, 10);
  assert.equal(Object.keys(f.snapshot().points_ledger).length, 0);
});
test('missing customer rejects cancellation without changing order', async () => {
  const f = fixture([{ _id: 'order' }], { users: {} });
  const before = f.snapshot();
  await assert.rejects(f.update({ orderId: 'order', status: 'cancelled' }), /账户/);
  assert.deepEqual(f.snapshot(), before);
});
test('refunded order cannot be reopened without a new deduction', async () => {
  const f = fixture([{ _id: 'order' }]);
  await f.update({ orderId: 'order', status: 'cancelled' });
  await assert.rejects(f.update({ orderId: 'order', status: 'shipped' }), /重新下单/);
  assert.equal(f.snapshot().orders.order.status, 'cancelled');
});
test('bulk cancellation uses the same refund logic and reports individual failures', async () => {
  const f = fixture([{ _id: 'a' }, { _id: 'b', totalCards: 8 }, { _id: 'missing-account', openid: 'absent' }]);
  const source = fs.readFileSync(require.resolve('../miniprogram/cloudfunctions/admin-orders/index.js'), 'utf8');
  const context = {
    require(name) {
      if (name === 'wx-server-sdk') return { init() {}, database: () => f.db };
      if (name === './points') return require('../miniprogram/cloudfunctions/admin-orders/points');
      if (name === './order-status') return createUpdater;
      return require(name);
    },
    exports: {}, process: { env: {} }, console, Buffer
  };
  vm.runInNewContext(source + '\nexports.testBulk = updateOrderStatusBulk;', context);
  const result = await context.exports.testBulk({ orderIds: ['a', 'b', 'a', 'missing-account'], status: 'cancelled' });
  assert.equal(result.updated, 3);
  assert.equal(result.failed, 1);
  assert.equal(f.snapshot().users.account.rewardPoints, 24);
  assert.equal(Object.keys(f.snapshot().points_ledger).length, 2);
  assert.equal(f.snapshot().orders['missing-account'].status, 'pending');
});
