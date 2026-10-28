const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const {createRequire}=require('node:module');
const fixture=require('./helpers/transaction-db.cjs');
function client(storage=new Map()) {
 const answers=['10','客服补发'], calls=[];
 const window={prompt:()=>answers.shift(),confirm:()=>true};
 vm.runInNewContext(fs.readFileSync(require.resolve('../assets/points-grant.js'),'utf8'),{window,localStorage:{getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)},crypto:require('node:crypto').webcrypto});
 return {run:window.PointsGrant.run,storage,calls};
}
test('network failure retains operation across page reload; success clears pending',async()=>{
 const a=client();let first;
 await assert.rejects(a.run('owner','客户',async(action,payload)=>{first=payload;throw Error('network')}),/network/);
 const b=client(a.storage);let second;
 assert.equal(await b.run('owner','客户',async(action,payload)=>{second=payload}),10);
 assert.deepEqual(JSON.parse(JSON.stringify(first)),JSON.parse(JSON.stringify(second)));assert.equal(b.storage.size,0);
});
test('double click during pending request sends one request',async()=>{
 const a=client();let finish,calls=0;
 const first=a.run('owner','客户',()=>{calls++;return new Promise(r=>finish=r)});
 assert.equal(await a.run('owner','客户',()=>{calls++}),null);finish();await first;assert.equal(calls,1);
});
for(const kind of ['admin-orders','referral'])test(kind+' ledger returns newest 200 entries with correct balances',async()=>{
 const f=fixture({users:[{_id:'u',openid:'owner',rewardPoints:300,referralCode:'123456'}],points_ledger:Array.from({length:300},(_,i)=>({_id:'l'+i,openid:'owner',delta:1,createdAt:new Date(1000+i)}))});
 const path=require.resolve('../miniprogram/cloudfunctions/'+kind+'/index.js'),nativeRequire=createRequire(path);
 const context={exports:{},console,Buffer,process:{env:{}},require:name=>name==='wx-server-sdk'?{init(){},database:()=>f.db}:nativeRequire(name)};
 vm.runInNewContext(fs.readFileSync(path,'utf8')+'\nexports.ledger = '+(kind==='admin-orders'?'adminPointsLedger':'getMyPointsLedger')+';',context);
 const result=await context.exports.ledger(kind==='admin-orders'?{openid:'owner',limit:200}:'owner');
 assert.equal(result.items.length,200);assert.equal(result.items[0].balanceAfter,300);assert.equal(result.items[199].balanceAfter,101);assert.equal(Number(result.items[0].createdAt),1299);
});
test('hard delete only removes explicitly selected recycle-bin product',async()=>{
 const f=fixture({products:[{_id:'live',deleted:false},{_id:'trash',deleted:true}]});
 const path=require.resolve('../miniprogram/cloudfunctions/admin-orders/index.js'),nativeRequire=createRequire(path);
 const context={exports:{},console,Buffer,process:{env:{}},require:name=>name==='wx-server-sdk'?{init(){},database:()=>f.db}:nativeRequire(name)};
 vm.runInNewContext(fs.readFileSync(path,'utf8')+'\nexports.remove = adminDeleteProduct;',context);
 await assert.rejects(context.exports.remove({id:'live',hard:true}),/回收站/);
 await context.exports.remove({id:'trash',hard:true});assert.deepEqual(f.snapshot().products,[{_id:'live',deleted:false}]);
});
