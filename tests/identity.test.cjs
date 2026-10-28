const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const fixture = require('./helpers/transaction-db.cjs');
const createIdentity = require('../miniprogram/cloudfunctions/login/identity');
function setup(seed = {}, fail) {
 const f = fixture({ users: [], referrals: [], identity_keys: [], ...seed }, fail);
 return { ...f, identity: createIdentity(f.db) };
}
const owner = {_id:'legacy-owner',openid:'owner',referralCode:'123456',rewardPoints:7};
test('login and referral helper copies are identical for independent cloud uploads',()=>{
 assert.equal(fs.readFileSync(require.resolve('../miniprogram/cloudfunctions/login/identity'),'utf8'),fs.readFileSync(require.resolve('../miniprogram/cloudfunctions/referral/identity'),'utf8'));
});
test('concurrent first login creates one account without resetting earned points',async()=>{
 const f=setup();const result=await Promise.all(Array.from({length:12},()=>f.identity.upsert('new-user',{phone:'13800000000',nickName:'客户'})));
 assert.equal(new Set(result.map(u=>u._id)).size,1);assert.equal(f.snapshot().users.length,1);
 f.mutate(s=>s.users[0].rewardPoints=23);await f.identity.upsert('new-user',{phone:'13800000000'});assert.equal(f.snapshot().users[0].rewardPoints,23);
});
test('concurrent different accounts cannot take same phone',async()=>{
 const f=setup();const results=await Promise.allSettled(['a','b'].map(oid=>f.identity.upsert(oid,{phone:'13800000000'})));
 assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal(f.snapshot().users.length,1);assert.equal(f.snapshot().identity_keys.length,1);
});
test('legacy account id, balance and binding are retained',async()=>{
 const f=setup({users:[{...owner,referredByOpenid:'parent'}]});const u=await f.identity.upsert('owner',{phone:'13800000000',ensureCode:true});
 assert.equal(u._id,'legacy-owner');assert.equal(u.rewardPoints,7);assert.equal(u.referredByOpenid,'parent');assert.equal(u.referralCode,'123456');assert.equal(f.snapshot().users.length,1);
});
test('invalid invite does not consume new-user eligibility; valid retry binds',async()=>{
 const f=setup({users:[owner]});assert.equal((await f.identity.bindReferrer('new-user','000000')).success,false);assert.equal(f.snapshot().users.length,1);
 assert.equal((await f.identity.bindReferrer('new-user','123456')).success,true);const s=f.snapshot();assert.equal(s.users.length,2);assert.equal(s.referrals.length,1);assert.equal(s.users[1].referredByOpenid,'owner');
});
test('concurrent invites to different referrers bind once and create one referral',async()=>{
 const f=setup({users:[owner,{_id:'second',openid:'second',referralCode:'654321'}]});
 await Promise.all(['123456','654321','123456','654321'].map(code=>f.identity.bindReferrer('new-user',code)));
 const s=f.snapshot();assert.equal(s.users.length,3);assert.equal(s.referrals.length,1);assert.equal(s.users[2].referredByOpenid,s.referrals[0].referrerOpenid);
});
for(const failure of ['users','referrals','identity_keys'])test('invite creation rolls back on '+failure+' failure and remains eligible',async()=>{
 const f=setup({users:[owner]},failure),before=f.snapshot();await assert.rejects(f.identity.bindReferrer('new-user','123456'),/simulated/);assert.deepEqual(f.snapshot(),before);
});
test('existing users remain ineligible for later referral binding',async()=>{
 const f=setup({users:[owner,{_id:'old',openid:'old',rewardPoints:3}]});assert.equal((await f.identity.bindReferrer('old','123456')).skipped,'existing-user');assert.equal(f.snapshot().referrals.length,0);
});
test('duplicate existing accounts or duplicate codes fail closed',async()=>{
 const f=setup({users:[owner,{...owner,_id:'duplicate'}]});await assert.rejects(f.identity.upsert('owner',{phone:'13800000000'}),/重复/);assert.equal((await f.identity.bindReferrer('new-user','123456')).success,false);assert.equal(f.snapshot().users.length,2);
});
test('phone release allows another account to claim while old phone stays protected until commit',async()=>{
 const f=setup();await f.identity.upsert('a',{phone:'13800000000'});await f.identity.upsert('a',{phone:''});await f.identity.upsert('b',{phone:'13800000000'});
 assert.equal(f.snapshot().users.filter(u=>u.boundPhone==='13800000000').length,1);
});
test('phone reassignment failure rolls back old claim and user',async()=>{
 const f=setup({users:[{_id:'u',openid:'a',boundPhone:'13800000000'}]},'users');const before=f.snapshot();await assert.rejects(f.identity.upsert('a',{phone:'13900000000'}),/simulated/);assert.deepEqual(f.snapshot(),before);
});
test('self referral is rejected without mutation',async()=>{
 const f=setup({users:[owner]}),before=f.snapshot();assert.equal((await f.identity.bindReferrer('owner','123456')).success,false);assert.deepEqual(f.snapshot(),before);
});
test('simultaneous login and referral account initialization share one identity',async()=>{
 const f=setup();await Promise.all([f.identity.upsert('new-user',{phone:'13800000000'}),f.identity.upsert('new-user',{ensureCode:true})]);
 const s=f.snapshot();assert.equal(s.users.length,1);assert.equal(s.users[0].boundPhone,'13800000000');assert.match(s.users[0].referralCode,/^\d{6}$/);
});
test('same generated code collision cannot create duplicate codes',async()=>{
 const vm=require('node:vm');const f=setup();let n=0;
 const context={module:{exports:{}},require,Math:{floor:Math.floor,random:()=>++n<=2?0.1:0.2}};
 vm.runInNewContext(fs.readFileSync(require.resolve('../miniprogram/cloudfunctions/login/identity'),'utf8'),context);
 const identity=context.module.exports(f.db);
 await Promise.all(['a','b'].map(oid=>identity.upsert(oid,{ensureCode:true})));
 assert.equal(new Set(f.snapshot().users.map(u=>u.referralCode)).size,2);assert.equal(f.snapshot().identity_keys.length,2);
});
test('login entry trusts context openid and preserves legacy points',async()=>{
 const vm=require('node:vm'),{createRequire}=require('node:module');
 const f=setup({users:[owner]});const path=require.resolve('../miniprogram/cloudfunctions/login/index.js'),nativeRequire=createRequire(path);
 const context={exports:{},console,require:name=>name==='wx-server-sdk'?{init(){},database:()=>f.db,getWXContext:()=>({OPENID:'owner'})}:nativeRequire(name)};
 vm.runInNewContext(fs.readFileSync(path,'utf8'),context);
 const r=await context.exports.main({phone:'13800000000',openid:'pretend',nickName:'客户'});
 assert.equal(r.success,true);assert.equal(r.user._id,'legacy-owner');assert.equal(r.openid,'owner');assert.equal(r.user.rewardPoints,7);assert.equal(f.snapshot().users.length,1);
});
