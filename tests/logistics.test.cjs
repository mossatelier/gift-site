const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const {createRequire}=require('node:module');
const crypto=require('node:crypto');
const fixture=require('./helpers/transaction-db.cjs');
const sourcePath=require.resolve('../miniprogram/cloudfunctions/admin-orders/index.js');
function setup(order={},env={}) {
 const f=fixture({orders:[{_id:'o',status:'pending',trackingNo:'',trackingCompany:'申通',courierCode:'shentong',trackingPhone:'13800000000',...order}]});
 const calls={notifications:[],subscriptions:[],http:[]};
 const context={console:{log(){},warn(){},error(){}},exports:{},Buffer,process:{env:{KUAIDI100_KEY:'test-key',KUAIDI100_CUSTOMER:'test-customer',KUAIDI100_CALLBACK_URL:'https://callback.example/',...env}},require:n=>n==='wx-server-sdk'?{init(){},database:()=>f.db}:createRequire(sourcePath)(n)};
 vm.runInNewContext(fs.readFileSync(sourcePath,'utf8')+'\nexports.test={updateTracking,persistLogistics,handleLogisticsPush,logisticsSalt,verifyLogisticsSignature,subscribeLogistics,queryLogisticsInner}; exports.mock = (notify,http) => {sendShipNotify=notify;httpsReq=http;};',context);
 context.exports.mock(async(...args)=>calls.notifications.push(args),async(url,options)=>{calls.http.push({url,...options});return{status:200,body:JSON.stringify({result:true,returnCode:'200'})}});
 return {...f,...context.exports.test,calls,entry:context.exports.main,mock:context.exports.mock};
}
test('signed order stays signed; explicit empty phone clears stored number; no shipping notification',async()=>{
 const f=setup({status:'signed',trackingNo:'old'});
 const r=await f.updateTracking({orderId:'o',trackingNo:'new',phone:''});
 assert.equal(r.status,'signed');assert.equal(r.trackingPhone,'');assert.equal(f.calls.notifications.length,0);assert.equal(f.calls.http.length,0);
});
test('cancelled/refunded order saves edits without shipping or subscription',async()=>{
 const f=setup({status:'cancelled',pointsRefundedAt:new Date()});await f.updateTracking({orderId:'o',trackingNo:'new'});
 assert.equal(f.snapshot().orders[0].status,'cancelled');assert.equal(f.calls.notifications.length,0);assert.equal(f.calls.http.length,0);
});
test('concurrent identical tracking saves ship and subscribe once',async()=>{
 const f=setup();await Promise.all(Array.from({length:8},()=>f.updateTracking({orderId:'o',trackingNo:'new'})));
 assert.equal(f.snapshot().orders[0].status,'shipped');assert.equal(f.calls.notifications.length,1);assert.equal(f.calls.http.length,1);
 const params=JSON.parse(new URLSearchParams(f.calls.http[0].body).get('param'));
 assert.equal(params.parameters.salt,f.logisticsSalt('shentong','new'));assert.equal(params.parameters.salt.length,64);
 assert.equal(f.snapshot().orders[0].trackingPhone,'13800000000');
});
test('phone-only edit on shipped order does not repeat shipping notice',async()=>{
 const f=setup({status:'shipped',trackingNo:'new'});await f.updateTracking({orderId:'o',phone:'13900000000'});assert.equal(f.calls.notifications.length,0);
});
test('cancellation immediately after tracking commit suppresses shipping notification',async()=>{
 const f=setup();const original=f.db.runTransaction;
 f.db.runTransaction=async fn=>{const r=await original(fn);f.mutate(s=>s.orders[0].status='cancelled');return r};
 await f.updateTracking({orderId:'o',trackingNo:'new'});assert.equal(f.calls.notifications.length,0);assert.equal(f.calls.http.length,0);
});
test('delayed query result does not sign cancelled/refunded order',async()=>{
 const f=setup({trackingNo:'old',status:'shipped'}),before=f.snapshot().orders[0];
 f.mutate(s=>{s.orders[0].status='cancelled';s.orders[0].pointsRefundedAt=new Date()});
 await f.persistLogistics('o',before,[{time:'2026-10-29',context:'本人签收'}],'3');assert.equal(f.snapshot().orders[0].status,'cancelled');assert.equal(f.snapshot().orders[0].signedAt,undefined);
});
test('changed tracking number rejects delayed query result',async()=>{
 const f=setup({trackingNo:'old',status:'shipped'}),before=f.snapshot().orders[0];f.mutate(s=>s.orders[0].trackingNo='new');
 await assert.rejects(f.persistLogistics('o',before,[],'3'),/已修改/);assert.equal(f.snapshot().orders[0].status,'shipped');
});
test('delayed in-transit push cannot regress signed tracking',async()=>{
 const f=setup({trackingNo:'old',status:'signed',logisticsState:'3'}),before=f.snapshot().orders[0];
 await f.persistLogistics('o',before,[],'0');assert.equal(f.snapshot().orders[0].logisticsState,'3');
});
function payload(state='3',com='shentong'){return JSON.stringify({status:'shutdown',lastResult:{nu:'old',com,state,data:[{ftime:'2026-10-29 10:00:00',context:'本人签收'}]}})}
function signature(f,raw,com='shentong'){return crypto.createHash('md5').update(raw+f.logisticsSalt(com,'old')).digest('hex').toUpperCase()}
test('unsigned, forged and modified callback data cannot change order',async()=>{
 const f=setup({trackingNo:'old',status:'shipped'}),before=f.snapshot(),raw=payload();
 for(const sign of [undefined,'','0'.repeat(32),signature(f,payload('0'))])assert.equal((await f.handleLogisticsPush(raw,sign)).result,false);
 assert.deepEqual(f.snapshot(),before);
});
test('valid callback signs only matching carrier; original param formatting verified',async()=>{
 const f=setup({trackingNo:'old',status:'shipped'});const raw='  '+payload()+'\n';
 assert.equal((await f.handleLogisticsPush(raw,signature(f,raw))).result,true);assert.equal(f.snapshot().orders[0].status,'signed');
 const other=setup({trackingNo:'old',status:'shipped',courierCode:'yuantong'});await other.handleLogisticsPush(raw,signature(other,raw));assert.equal(other.snapshot().orders[0].status,'shipped');
});
test('missing server key rejects callback even with empty-salt md5',async()=>{
 const f=setup({trackingNo:'old',status:'shipped'},{KUAIDI100_KEY:''}),raw=payload();
 const sign=crypto.createHash('md5').update(raw).digest('hex');assert.equal((await f.handleLogisticsPush(raw,sign)).result,false);
});
test('authenticated realtime query still works for old unsigned subscriptions',async()=>{
 const f=setup({trackingNo:'old',status:'shipped'});f.mock(async()=>{},async()=>({status:200,body:JSON.stringify({data:[{ftime:'2026-10-29',context:'本人签收'}],state:'3'})}));
 assert.equal((await f.queryLogisticsInner({orderId:'o'})).status,'signed');
});

test('HTTP callback entry passes exact decoded param and requires signature',async()=>{
 const f=setup({trackingNo:'old',status:'shipped'}),raw=payload();
 const unsigned=await f.entry({httpMethod:'POST',body:new URLSearchParams({param:raw}).toString()});
 assert.equal(JSON.parse(unsigned.body).returnCode,'403');assert.equal(f.snapshot().orders[0].status,'shipped');
 const body=new URLSearchParams({param:raw,sign:signature(f,raw)}).toString();
 const signed=await f.entry({httpMethod:'POST',isBase64Encoded:true,body:Buffer.from(body).toString('base64')});
 assert.equal(JSON.parse(signed.body).result,true);assert.equal(f.snapshot().orders[0].status,'signed');
});
test('concurrent cancellation wins over callback signing after transaction retry',async()=>{
 const f=setup({trackingNo:'old',status:'shipped'}),before=f.snapshot().orders[0];
 await Promise.all([
  f.persistLogistics('o',before,[{context:'本人签收'}],'3'),
  f.db.runTransaction(async tx=>{const ref=tx.collection('orders').doc('o');await ref.get();await ref.update({data:{status:'cancelled',pointsRefundedAt:new Date()}})})
 ]);
 assert.equal(f.snapshot().orders[0].status,'cancelled');
});
