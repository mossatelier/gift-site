const { test } = require('node:test');
const assert = require('node:assert/strict');
const { save } = require('../assets/order-save');
function fixture(overrides = {}) {
  const order = { _id: 'o', status: 'pending', address: { phone: '13800000000' }, ...overrides };
  const calls = [];
  const call = async (action, payload) => {
    calls.push({ action, payload });
    if (action === 'update-tracking') return { ...order, trackingNo: payload.trackingNo, trackingCompany: payload.trackingCompany, trackingPhone: payload.phone, status: payload.trackingNo ? 'shipped' : order.status };
    return {};
  };
  const fields = { trackingNo: '', trackingCompany: '', phone: order.address.phone, adminNote: '', courierCode: '' };
  return { order, calls, call, fields };
}
test('one save persists tracking and note and returns only after both succeed', async () => {
  const f = fixture();
  const r = await save(f.order, { ...f.fields, trackingNo: '12345', trackingCompany: '中通快递', adminNote: '已发货' }, f.call);
  assert.deepEqual(f.calls.map(c=>c.action), ['update-tracking','update-note']);
  assert.equal(f.order.adminNote, '已发货');
  assert.equal(f.order.trackingNo, '12345');
  assert.equal(r.shipped, true);
});
for (const trackingNo of ['', '12345']) test('note-only edit never triggers shipping with tracking=' + trackingNo, async () => {
  const f = fixture({ trackingNo, status: trackingNo ? 'signed' : 'pending' });
  const status = f.order.status;
  await save(f.order, { ...f.fields, trackingNo, adminNote: '备注' }, f.call);
  assert.deepEqual(f.calls.map(c=>c.action), ['update-note']);
  assert.equal(f.order.status, status);
});
test('tracking-only edit preserves existing note', async () => {
  const f = fixture({ adminNote: '原备注' });
  await save(f.order, { ...f.fields, trackingNo: '12345', adminNote: '原备注' }, f.call);
  assert.deepEqual(f.calls.map(c=>c.action), ['update-tracking']);
  assert.equal(f.order.adminNote, '原备注');
});
test('failed note retains successful tracking and retry does not ship again', async () => {
  const f = fixture();
  const fields = { ...f.fields, trackingNo: '12345', adminNote: '备注' };
  await assert.rejects(save(f.order, fields, async (action, payload) => {
    if (action === 'update-note') throw new Error('模拟失败');
    return f.call(action, payload);
  }), /快递信息已保存.*填写内容已保留/);
  assert.equal(f.order.trackingNo, '12345');
  assert.equal(f.order.adminNote, undefined);
  await save(f.order, fields, f.call);
  assert.deepEqual(f.calls.map(c=>c.action), ['update-tracking','update-note']);
  assert.equal(f.order.adminNote, '备注');
});
test('initial request failure reports failure without success or changing local data', async () => {
  const f = fixture();
  const before = structuredClone(f.order);
  await assert.rejects(save(f.order, {...f.fields, trackingNo:'12345',adminNote:'备注'}, async()=>{throw new Error('网络异常');}), /保存失败/);
  assert.deepEqual(f.order,before);
});
test('unchanged form makes no requests', async () => {
  const f = fixture();
  assert.equal((await save(f.order, f.fields, f.call)).changed, false);
  assert.equal(f.calls.length, 0);
});
test('oversized note is rejected before sending either update', async () => {
  const f = fixture();
  await assert.rejects(save(f.order,{...f.fields,trackingNo:'12345',adminNote:'x'.repeat(1001)},f.call), /最多1000字/);
  assert.equal(f.calls.length, 0);
});
