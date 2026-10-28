const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const fixture=require('./helpers/transaction-db.cjs');
const createSync=require('../miniprogram/cloudfunctions/wishlist-sync/sync');
function setup(fail) {
 const f=fixture({wishlists:[]},fail);return {...f,sync:createSync(f.db)};
}
const op=(seq,productId,present=true)=>({seq,productId,present});
test('two devices concurrently add different products without overwriting',async()=>{
 const f=setup();await Promise.all(['device_aaa','device_bbb'].map((deviceId,i)=>f.sync('u',{deviceId,operations:[op(1,'p'+i)]})));
 const r=await f.sync('u',{deviceId:'device_aaa'});assert.deepEqual([...r.productIds].sort(),['p0','p1']);assert.equal(f.snapshot().wishlists.length,1);
});
test('stale pull and replayed old add cannot resurrect deleted product',async()=>{
 const f=setup();const add={deviceId:'device_aaa',operations:[op(1,'p')]};await f.sync('u',add);
 await f.sync('u',{deviceId:'device_bbb',operations:[op(1,'p',false)]});
 assert.deepEqual((await f.sync('u',add)).productIds,[]);
 assert.deepEqual((await f.sync('u',{deviceId:'device_aaa'})).productIds,[]);
 assert.deepEqual((await f.sync('u',{deviceId:'device_aaa',operations:[op(2,'p')]})).productIds,['p']);
});
test('legacy wishlist migrates once; later stale legacy writes cannot overwrite new list',async()=>{
 const f=setup();f.mutate(s=>s.wishlists.push({_id:'old',openid:'u',productIds:['p'],updatedAt:new Date()}));
 await f.sync('u',{deviceId:'device_aaa',operations:[op(1,'p',false)]});
 f.mutate(s=>s.wishlists[0].updatedAt=new Date(Date.now()+1000));
 assert.deepEqual((await f.sync('u',{deviceId:'device_aaa'})).productIds,[]);
});
test('failed write retains cloud state and missing sequence rejects instead of losing operations',async()=>{
 const f=setup('wishlists');await assert.rejects(f.sync('u',{deviceId:'device_aaa',operations:[op(1,'p')]}),/simulated/);assert.equal(f.snapshot().wishlists.length,0);
 const g=setup();await assert.rejects(g.sync('u',{deviceId:'device_aaa',operations:[op(2,'p')]}),/不连续/);
});
function client(sync, account='u', storage=new Map()) {
 let user=account,fail=false,delay;
 const context={module:{exports:{}},console:{warn(){}},setTimeout:()=>1,clearTimeout(){},wx:{
  getStorageSync:k=>k==='gift-site-user'?JSON.stringify(user?{openid:user}:null):storage.get(k),
  setStorageSync:(k,v)=>storage.set(k,v),cloud:{async callFunction({data}) {
   if(fail)throw Error('offline');
   const result=await sync(user,data);if(delay)await delay;
   return {result:{success:true,...result}};
  }}
 }};
 vm.runInNewContext(fs.readFileSync(require.resolve('../miniprogram/utils/wishlist'),'utf8'),context);
 return {api:context.module.exports,storage,setUser:u=>user=u,setFailure:v=>fail=v,setDelay:v=>delay=v};
}
test('offline deletion retries after restart without stale-cache union; account caches isolated',async()=>{
 const f=setup(),a=client(f.sync),b=client(f.sync);
 a.api.toggle('p');await a.api.pushToCloud();await b.api.pullAndMerge();assert.equal(b.api.has('p'),true);
 a.setFailure(true);a.api.remove('p');assert.equal(await a.api.pullAndMerge(),false);
 const restarted=client(f.sync,'u',a.storage);await restarted.api.pullAndMerge();await b.api.pullAndMerge();assert.equal(b.api.has('p'),false);
 b.setUser('other');assert.equal(b.api.getList().length,0);b.api.toggle('q');await b.api.pushToCloud();b.setUser('u');assert.equal(b.api.has('q'),false);
});
test('new edit during in-flight sync remains queued and is eventually persisted',async()=>{
 const f=setup(),a=client(f.sync);let resume;const wait=new Promise(r=>resume=r);a.setDelay(wait);
 a.api.toggle('p');const job=a.api.pushToCloud();a.api.toggle('q');a.setDelay(null);resume();await job;
 assert.deepEqual([...((await f.sync('u',{deviceId:'observer_1'})).productIds)].sort(),['p','q']);
});
test('guest additions transfer once to logged-in account',async()=>{
 const f=setup(),a=client(f.sync,'');a.api.toggle('p');a.setUser('u');await a.api.pushToCloud();assert.equal(a.api.has('p'),true);
 a.setUser('other');await a.api.pushToCloud();assert.equal(a.api.has('p'),false);
});
test('cloud entry ignores supplied openid and uses authenticated context',async()=>{
 const f=setup(),context={module:{exports:{}},exports:{},console,require:name=>name==='wx-server-sdk'?{init(){},database:()=>f.db,getWXContext:()=>({OPENID:'real'})}:createSync};
 vm.runInNewContext(fs.readFileSync(require.resolve('../miniprogram/cloudfunctions/wishlist-sync/index'),'utf8'),context);
 const r=await context.exports.main({openid:'victim',deviceId:'device_aaa',operations:[op(1,'p')]});assert.equal(r.success,true);assert.equal(f.snapshot().wishlists[0].openid,'real');
});
test('old client overwriting canonical productIds cannot resurrect deleted V2 items',async()=>{
 const f=setup();await f.sync('u',{deviceId:'device_aaa',operations:[op(1,'p'),op(2,'p',false)]});
 f.mutate(s=>{s.wishlists[0].productIds=['p'];s.wishlists[0].updatedAt=new Date()});
 assert.deepEqual((await f.sync('u',{deviceId:'device_aaa'})).productIds,[]);
});
test('retired image migration has no database or network access',async()=>{
 const context={exports:{},require(){throw Error('retired job must not access dependencies')}};
 vm.runInNewContext(fs.readFileSync(require.resolve('../miniprogram/cloudfunctions/switch-image-host/index'),'utf8'),context);
 assert.equal((await context.exports.main()).retired,true);
});
test('full wishlist acknowledges rejected adds so later removals are never blocked',async()=>{
 const f=setup();f.mutate(s=>s.wishlists.push({_id:'old',openid:'u',productIds:Array.from({length:1000},(_,i)=>'p'+i),updatedAt:new Date()}));
 const first=await f.sync('u',{deviceId:'device_aaa',operations:[op(1,'extra')]});
 assert.deepEqual(first.rejected,['extra']);assert.equal(first.ack,1);
 const next=await f.sync('u',{deviceId:'device_aaa',operations:[op(1,'extra'),op(2,'p0',false),op(3,'extra')]});
 assert.equal(next.ack,3);assert.equal(next.productIds.length,1000);assert.ok(next.productIds.includes('extra'));assert.ok(!next.productIds.includes('p0'));
});
