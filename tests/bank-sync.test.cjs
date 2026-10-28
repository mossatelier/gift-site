const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { EventEmitter } = require('node:events');

function fixture({ productFailure = false } = {}) {
  const bank = { _id: 'bank', supabaseId: 'legacy-bank', name: '测试银行', points: 2, sortOrder: 1 };
  const product = { _id: 'product', supabaseId: 'legacy-product', title: '旧商品名', viewCount: 9, supabaseViewCountSnapshot: 3 };
  const requests = [];
  const bankAccess = [];
  const database = {
    command: {},
    collection(name) {
      if (name === 'banks_earn') bankAccess.push(name);
      const row = name === 'banks_earn' ? bank : product;
      return {
        skip() { return this; }, limit() { return this; },
        async get() { return { data: [{ ...row }] }; },
        doc(id) {
          assert.equal(id, row._id);
          return { async update({ data }) { Object.assign(row, data); return { stats: { updated: 1 } }; } };
        },
        add() { throw new Error('unexpected insert'); }
      };
    }
  };
  const sdk = { init() {}, database: () => database };
  const fakeHttps = {
    get(url, options, callback) {
      requests.push(url);
      const req = new EventEmitter();
      queueMicrotask(() => {
        const res = new EventEmitter();
        const parsed = new URL(url);
        const table = parsed.pathname.split('/').pop();
        res.statusCode = productFailure ? 503 : 200;
        callback(res);
        const data = parsed.searchParams.get('offset') !== '0' ? [] : table === 'banks_earn'
          ? [{ id: 'legacy-bank', name: '测试银行', points: 2, sort_order: 1 }]
          : [{ id: 'legacy-product', title: '新商品名', view_count: 5 }];
        res.emit('data', JSON.stringify(data));
        res.emit('end');
      });
      return req;
    }
  };
  const sync = { exports: {}, console: { log() {}, error() {} }, require: name => name === 'wx-server-sdk' ? sdk : name === 'https' ? fakeHttps : require(name) };
  vm.runInNewContext(fs.readFileSync(require.resolve('../miniprogram/cloudfunctions/sync-products/index.js'), 'utf8'), sync);
  const admin = {
    exports: {}, process: { env: {} }, console, Buffer,
    require: name => name === 'wx-server-sdk' ? sdk : name === './order-status' ? require('../miniprogram/cloudfunctions/admin-orders/order-status') : require(name)
  };
  vm.runInNewContext(fs.readFileSync(require.resolve('../miniprogram/cloudfunctions/admin-orders/index.js'), 'utf8') + '\nexports.saveBank = adminSaveBankPoints;', admin);
  return { bank, product, requests, bankAccess, run: sync.exports.main, save: admin.exports.saveBank };
}

test('bank points saved by actual admin handler survive repeated timer invocations', async () => {
  const f = fixture();
  for (const points of [6, 0, 10]) {
    await f.save({ id: 'bank', points });
    const expected = structuredClone(f.bank);
    f.bankAccess.length = 0;
    for (let i = 0; i < 3; i++) {
      const result = await f.run({ Type: 'Timer' });
      assert.equal(result.success, true);
      assert.equal(result.banks.skipped, true);
      assert.equal(result.banks.reason, 'cloudbase-managed');
      assert.deepEqual(structuredClone(f.bank), expected);
    }
    assert.deepEqual(f.bankAccess, []);
  }
  assert.equal(f.requests.some(url => url.includes('/banks_earn')), false);
});
test('manual invocation also leaves bank data untouched', async () => {
  const f = fixture();
  const before = structuredClone(f.bank);
  await f.run({});
  assert.deepEqual(f.bank, before);
  assert.deepEqual(f.bankAccess, []);
});
test('retired sync preserves products and makes no upstream requests', async () => {
  const f = fixture();
  const before = structuredClone(f.product);
  for (let i = 0; i < 3; i++) {
    const result = await f.run({});
    assert.equal(result.retired, true);
    assert.equal(result.products.skipped, true);
    assert.deepEqual(f.product, before);
  }
  assert.deepEqual(f.requests, []);
});
test('upstream failure cannot revert bank points', async () => {
  const f = fixture({ productFailure: true });
  await f.save({ id: 'bank', points: 7 });
  f.bankAccess.length = 0;
  const result = await f.run({});
  assert.equal(result.success, true);
  assert.equal(f.bank.points, 7);
  assert.deepEqual(f.bankAccess, []);
});
