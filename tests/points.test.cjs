const {test} = require('node:test');
const assert = require('node:assert/strict');
const fixture = require('./helpers/transaction-db.cjs');
const createService = require('../miniprogram/cloudfunctions/admin-orders/points');
function setup(failWrite) {
 const f = fixture({users:[{_id:'u',openid:'owner',rewardPoints:0},{_id:'v',openid:'friend',rewardPoints:0,referredByOpenid:'owner'}],points_ledger:[],referrals:[{_id:'r',referrerOpenid:'owner',refereeOpenid:'friend',status:'待审核'}]},failWrite);
 return {...f, service:createService(f.db)};
}
const request={openid:'owner',amount:10,note:'测试',operationId:'same-operation'};
test('concurrent grant retries credit once and retain one ledger',async()=>{
 const f=setup();const out=await Promise.all(Array.from({length:12},()=>f.service.grant(request)));
 assert.equal(new Set(out.map(r=>r.ledgerId)).size,1);assert.equal(f.snapshot().users[0].rewardPoints,10);assert.equal(f.snapshot().points_ledger.length,1);
 await assert.rejects(f.service.grant({...request,amount:20}),/另一笔/);
});
for(const failure of ['users','points_ledger'])test('grant rolls back on '+failure+' failure',async()=>{
 const f=setup(failure),before=f.snapshot();await assert.rejects(f.service.grant(request),/simulated/);assert.deepEqual(f.snapshot(),before);
});
test('distinct operation ids permit intentional repeated grants',async()=>{
 const f=setup();await f.service.grant(request);await f.service.grant({...request,operationId:'new'});assert.equal(f.snapshot().users[0].rewardPoints,20);
});
test('concurrent revocations debit only once; retry original grant after revoke does not recredit',async()=>{
 const f=setup(),first=await f.service.grant(request);await Promise.all(Array.from({length:8},()=>f.service.revoke({ledgerId:first.ledgerId})));
 assert.equal(f.snapshot().users[0].rewardPoints,0);assert.equal(f.snapshot().points_ledger.length,2);
 await f.service.grant(request);assert.equal(f.snapshot().users[0].rewardPoints,0);
});
test('spent points prevent reversal without changing ledger',async()=>{
 const f=setup(),first=await f.service.grant(request);f.mutate(s=>s.users[0].rewardPoints=3);const before=f.snapshot();
 await assert.rejects(f.service.revoke({ledgerId:first.ledgerId}),/不足/);assert.deepEqual(f.snapshot(),before);
});
test('concurrent referral success rewards once; reversal and reopening each act once',async()=>{
 const f=setup();await Promise.all(Array.from({length:8},()=>f.service.referral({id:'r',status:'开户成功',rewardPoints:5})));
 assert.equal(f.snapshot().users[0].rewardPoints,5);assert.equal(f.snapshot().points_ledger.length,1);
 await Promise.all(Array.from({length:8},()=>f.service.referral({id:'r',status:'待审核'})));
 assert.equal(f.snapshot().users[0].rewardPoints,0);assert.equal(f.snapshot().points_ledger.length,2);
 await f.service.referral({id:'r',status:'开户成功',rewardPoints:5});assert.equal(f.snapshot().users[0].rewardPoints,5);
});
test('insufficient reward balance preserves success status and binding',async()=>{
 const f=setup();await f.service.referral({id:'r',status:'开户成功',rewardPoints:10});f.mutate(s=>s.users[0].rewardPoints=3);const before=f.snapshot();
 await assert.rejects(f.service.referral({id:'r',status:'无效'}),/不足/);
 await assert.rejects(f.service.unbind({id:'r'}),/不足/);assert.deepEqual(f.snapshot(),before);
});
test('unbind refunds rewards and clears relationship atomically',async()=>{
 const f=setup();await f.service.referral({id:'r',status:'开户成功',rewardPoints:5});await f.service.unbind({id:'r'});
 const s=f.snapshot();assert.equal(s.users[0].rewardPoints,0);assert.equal(s.users[1].referredByOpenid,'');assert.equal(s.referrals.length,0);assert.equal(s.points_ledger.length,2);
});
test('failure deleting referral rolls back reversal and binding',async()=>{
 const f=setup('referrals');f.mutate(s=>{s.users[0].rewardPoints=5;Object.assign(s.referrals[0],{rewardedAt:new Date(),rewardPoints:5,status:'开户成功'})});const before=f.snapshot();
 await assert.rejects(f.service.unbind({id:'r'}),/simulated/);assert.deepEqual(f.snapshot(),before);
});
test('zero reward success can be reversed and rewarded later',async()=>{
 const f=setup();await f.service.referral({id:'r',status:'开户成功',rewardPoints:0});await f.service.referral({id:'r',status:'无效'});await f.service.referral({id:'r',status:'开户成功',rewardPoints:5});assert.equal(f.snapshot().users[0].rewardPoints,5);
});
for(const failure of ['users','points_ledger','referrals'])test('referral reward rolls back on '+failure+' failure',async()=>{
 const f=setup(failure),before=f.snapshot();await assert.rejects(f.service.referral({id:'r',status:'开户成功',rewardPoints:5}),/simulated/);assert.deepEqual(f.snapshot(),before);
});
test('reversal ledger failure leaves original grant and balance untouched',async()=>{
 const f=setup('points_ledger');f.mutate(s=>{s.users[0].rewardPoints=10;s.points_ledger.push({_id:'grant',openid:'owner',delta:10,manual:true})});const before=f.snapshot();
 await assert.rejects(f.service.revoke({ledgerId:'grant'}),/simulated/);assert.deepEqual(f.snapshot(),before);
});
test('duplicate accounts reject grant instead of choosing arbitrary balance',async()=>{
 const f=setup();f.mutate(s=>s.users.push({_id:'duplicate',openid:'owner',rewardPoints:0}));const before=f.snapshot();await assert.rejects(f.service.grant(request),/不唯一/);assert.deepEqual(f.snapshot(),before);
});
test('unbind rolls back ALL records when combined reversal exceeds available points',async()=>{
 const f=setup();f.mutate(s=>{s.users[0].rewardPoints=5;s.referrals.forEach(r=>Object.assign(r,{rewardedAt:new Date(),rewardPoints:4}));s.referrals.push({...s.referrals[0],_id:'second'})});const before=f.snapshot();
 await assert.rejects(f.service.unbind({openid:'friend'}),/不足/);assert.deepEqual(f.snapshot(),before);
});
