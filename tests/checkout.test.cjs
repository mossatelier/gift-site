const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const createCheckout=require('../miniprogram/cloudfunctions/submit-order/checkout');
function fixture({balance=20,failWrite,price=6}={}){
 let state={users:[{_id:'u',openid:'user',rewardPoints:balance}],orders:[],points_ledger:[],
  products:[{_id:'p',isActive:true,cardsNeeded:price,title:'礼品'},{_id:'q',isActive:true,cardsNeeded:2,title:'另一个礼品'}],
  addresses:[{_id:'a',openid:'user',recipient:'客户',phone:'13800000000'},{_id:'b',openid:'user',recipient:'另一地址',phone:'13800000000'}],referrals:[]};
 let revision=0,sequence=0;
 const command={gt:v=>({op:'gt',v}),inc:v=>({op:'inc',v})};
 function collection(rows,name,transaction=false){
  rows[name] ||= [];let condition={},max=100;
  const matches=row=>Object.entries(condition).every(([k,v])=>v&&v.op==='gt'?new Date(row[k])>v.v:row[k]===v);
  return {
   where(c){condition=c;return this},limit(n){max=n;return this},orderBy(){return this},
   async get(){return {data:structuredClone(rows[name].filter(matches).slice(0,max))}},
   async update(){return {stats:{updated:0}}},
   doc(id){return {
    async get(){return {data:structuredClone(rows[name].find(r=>r._id===id))}},
    async update({data}){
     if(transaction&&failWrite===name)throw Error('simulated '+name+' failure');
     const row=rows[name].find(r=>r._id===id);assert.ok(row);
     for(const[k,v]of Object.entries(data))row[k]=v&&v.op==='inc'?(row[k]||0)+v.v:structuredClone(v);
     return {stats:{updated:1}};
    }
   }},
   async add({data}){
    if(transaction&&failWrite===name)throw Error('simulated '+name+' failure');
    const id='created-'+sequence++;rows[name].push({...structuredClone(data),_id:id});return {_id:id};
   }
  };
 }
 const db={command,collection:name=>collection(state,name),async runTransaction(fn){
  for(let attempt=0;attempt<50;attempt++){
   const start=revision,copy=structuredClone(state);
   const result=await fn({collection:name=>collection(copy,name,true)});
   if(start!==revision)continue;
   state=copy;revision++;return result;
  }
  throw Error('transaction conflict');
 }};
 const checkout=createCheckout(db);
 const request={openid:'user',items:[{_id:'p',qty:1}],addressId:'a',remark:'红色'};
 return {db,checkout,request,snapshot:()=>structuredClone(state),mutate(fn){fn(state);revision++}};
}
test('12 concurrent identical requests create one order and debit once',async()=>{
 const f=fixture();const results=await Promise.all(Array.from({length:12},()=>f.checkout(f.request)));
 assert.ok(results.every(r=>r.success));assert.equal(new Set(results.map(r=>r.orderId)).size,1);
 assert.equal(results.filter(r=>!r.duplicated).length,1);
 const s=f.snapshot();assert.equal(s.orders.length,1);assert.equal(s.users[0].rewardPoints,14);assert.equal(s.points_ledger.length,1);
});
test('retry succeeds even after original order spent the entire balance',async()=>{
 const f=fixture({balance:6});const a=await f.checkout(f.request),b=await f.checkout(f.request);
 assert.equal(b.success,true);assert.equal(b.duplicated,true);assert.equal(b.orderId,a.orderId);assert.equal(f.snapshot().users[0].rewardPoints,0);
});
for(const failWrite of ['orders','users','points_ledger'])test(failWrite+' failure rolls back order, debit, ledger and dedup record',async()=>{
 const f=fixture({failWrite});const before=f.snapshot();await assert.rejects(f.checkout(f.request),/simulated/);assert.deepEqual(f.snapshot(),before);
});
test('changed address or remark represents a new order',async()=>{
 const f=fixture({balance:100});
 const results=await Promise.all([f.request,{...f.request,addressId:'b'},{...f.request,remark:'蓝色'}].map(r=>f.checkout(r)));
 assert.equal(new Set(results.map(r=>r.orderId)).size,3);assert.equal(f.snapshot().users[0].rewardPoints,82);
});
test('cancelled/refunded order is never reused',async()=>{
 const f=fixture();const first=await f.checkout(f.request);
 f.mutate(s=>{s.orders[0].status='cancelled';s.orders[0].pointsRefundedAt=new Date();s.users[0].rewardPoints+=6});
 const second=await f.checkout(f.request);assert.equal(second.success,true);assert.notEqual(second.orderId,first.orderId);assert.equal(f.snapshot().users[0].rewardPoints,14);
});
test('concurrent different requests cannot exceed available balance',async()=>{
 const f=fixture({balance:10});const results=await Promise.all([f.request,{...f.request,remark:'另一规格'}].map(r=>f.checkout(r)));
 assert.equal(results.filter(r=>r.success).length,1);assert.equal(f.snapshot().users[0].rewardPoints,4);
});
test('minute rate limit remains effective under concurrency; retries still succeed at limit',async()=>{
 const f=fixture({balance:100});const results=await Promise.all(Array.from({length:5},(_,i)=>f.checkout({...f.request,remark:'规格'+i})));
 assert.equal(results.filter(r=>r.success).length,3);assert.equal(f.snapshot().orders.length,3);
 const first=f.snapshot().orders[0];const retry=await f.checkout({...f.request,remark:first.remark});assert.equal(retry.duplicated,true);
});
test('mixed active and unavailable products reject whole request before charging',async()=>{
 const f=fixture();f.mutate(s=>s.products[1].isActive=false);const before=f.snapshot();
 const r=await f.checkout({...f.request,items:[{_id:'p'},{_id:'q'}]});assert.equal(r.success,false);assert.match(r.error,/下架/);assert.deepEqual(f.snapshot(),before);
});
test('free gifts also deduplicate without a points ledger',async()=>{
 const f=fixture({balance:0,price:0});await Promise.all([f.checkout(f.request),f.checkout(f.request)]);
 assert.equal(f.snapshot().orders.length,1);assert.equal(f.snapshot().points_ledger.length,0);
});
test('quantity ordering and duplicate product rows normalize to same request',async()=>{
 const f=fixture({balance:50});const a=await f.checkout({...f.request,items:[{_id:'p'},{_id:'q'},{_id:'p'}]});
 const b=await f.checkout({...f.request,items:[{_id:'q'},{_id:'p',qty:2}]});assert.equal(a.orderId,b.orderId);assert.equal(f.snapshot().users[0].rewardPoints,36);
});
test('account duplicates are rejected instead of charging multiple records',async()=>{
 const f=fixture();f.mutate(s=>s.users.push({...s.users[0],_id:'duplicate'}));const before=f.snapshot();
 assert.equal((await f.checkout(f.request)).success,false);assert.deepEqual(f.snapshot(),before);
});
test('deployment-era recent order is deduplicated before first history write',async()=>{
 const f=fixture();f.mutate(s=>s.orders.push({_id:'legacy',openid:'user',createdAt:new Date(),status:'pending',items:[{productId:'p',qty:1}],address:{recipient:'客户',phone:'13800000000'},remark:'红色',totalCards:6,itemCount:1}));
 const r=await f.checkout(f.request);assert.equal(r.orderId,'legacy');assert.equal(r.duplicated,true);assert.equal(f.snapshot().users[0].rewardPoints,20);
});
test('expired 30-second dedup window permits a new order',async()=>{
 const f=fixture();const a=await f.checkout(f.request);f.mutate(s=>{s.orders[0].createdAt=new Date(Date.now()-31000);s.users[0].checkoutHistory[0].createdAt=s.orders[0].createdAt});
 const b=await f.checkout(f.request);assert.notEqual(a.orderId,b.orderId);
});
test('cloud entry sends notification once after concurrent successful checkout',async()=>{
 const f=fixture();let notifications=0;
 const sdk={init(){},database:()=>f.db,getWXContext:()=>({OPENID:'user'}),openapi:{subscribeMessage:{send:async()=>notifications++}}};
 const c={exports:{},console:{error(){},warn(){}},require:n=>n==='./checkout'?createCheckout:sdk};
 vm.runInNewContext(fs.readFileSync(require.resolve('../miniprogram/cloudfunctions/submit-order/index.js'),'utf8'),c);
 const results=await Promise.all([c.exports.main(f.request),c.exports.main(f.request)]);
 assert.ok(results.every(r=>r.success));assert.equal(notifications,1);assert.equal(f.snapshot().orders.length,1);
});
