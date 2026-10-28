const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
function deferred(){let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b});return {promise,resolve,reject};}
function fixture(handler){
 let app;const calls=[],store=new Map();
 const wishlist={pullAndMerge(){}};
 const wx={cloud:{callFunction:async request=>{calls.push(request);return handler(request);}},setStorageSync:(k,v)=>store.set(k,v),getStorageSync:k=>store.get(k),removeStorageSync:k=>store.delete(k)};
 vm.runInNewContext(fs.readFileSync(require.resolve('../miniprogram/app.js'),'utf8'),{App:value=>app=value,require:()=>wishlist,wx,console,setTimeout});
 const context={module:{exports:{}},require:()=>wishlist,wx,getApp:()=>app,console};
 vm.runInNewContext(fs.readFileSync(require.resolve('../miniprogram/utils/auth.js'),'utf8'),context);
 return {app,auth:context.module.exports,calls,store};
}
const loginResult={result:{success:true,openid:'user',user:{boundPhone:'13800000000'}}};
test('login waits for initial binding and duplicate startup calls share one request',async()=>{
 const binding=deferred();const f=fixture(request=>request.name==='referral'?binding.promise:loginResult);
 const first=f.app.tryBindReferrer({query:{ref:'123456'}});f.app.tryBindReferrer({query:{ref:'123456'}});
 const login=f.auth.callLogin({phone:'13800000000'});await Promise.resolve();assert.equal(f.calls.length,1);assert.equal(f.calls[0].name,'referral');
 binding.resolve({result:{success:true}});await first;await login;assert.equal(f.calls.length,2);assert.equal(f.calls[1].name,'login');assert.equal(f.app._bindTriedFor,'123456');
});
test('network failure preserves pending code and blocks account creation until successful retry',async()=>{
 let succeeds=false;const binding=deferred();const f=fixture(request=>request.name==='login'?loginResult:succeeds?{result:{success:true}}:binding.promise);
 f.app.tryBindReferrer({query:{ref:'123456'}});const login=f.auth.callLogin({phone:'13800000000'});binding.reject(Error('network'));
 await assert.rejects(login,/暂未确认/);assert.equal(f.calls.filter(r=>r.name==='login').length,0);assert.equal(f.app._bindTriedFor,undefined);assert.equal(f.app._pendingRefCode,'123456');
 succeeds=true;await f.auth.callLogin({phone:'13800000000'});assert.equal(f.calls.filter(r=>r.name==='referral').length,2);assert.equal(f.calls.filter(r=>r.name==='login').length,1);
});
test('business failure remains retryable and onShow without a code retries pending invitation',async()=>{
 let attempts=0;const f=fixture(()=>({result:++attempts===1?{success:false,error:'事务冲突'}:{success:true}}));
 await f.app.tryBindReferrer({query:{scene:'ref%3D123456'}});assert.equal(f.app._bindTriedFor,undefined);
 f.app.onShow({query:{}});await f.app._bindPending;assert.equal(attempts,2);assert.equal(f.app._bindTriedFor,'123456');assert.equal(f.app._pendingRefCode,'');
});
for(const response of [{success:false,error:'推荐码无效'},{success:false,error:'不能推荐自己'},{success:true,skipped:'existing-user'},{success:true,already:true}])test('terminal referral result permits login: '+JSON.stringify(response),async()=>{
 const f=fixture(request=>request.name==='login'?loginResult:{result:response});await f.app.tryBindReferrer({query:{ref:'123456'}});await f.auth.callLogin({phone:'13800000000'});
 assert.equal(f.calls.filter(r=>r.name==='referral').length,1);assert.equal(f.calls.filter(r=>r.name==='login').length,1);assert.equal(f.app._bindTriedFor,'123456');
});
test('new invitation arriving during an earlier invalid invitation is processed before login',async()=>{
 const first=deferred(),second=deferred();const f=fixture(request=>request.name==='login'?loginResult:request.data.code==='123456'?first.promise:second.promise);
 f.app.tryBindReferrer({query:{ref:'123456'}});f.app.tryBindReferrer({query:{ref:'654321'}});const login=f.auth.callLogin({phone:'13800000000'});
 first.resolve({result:{success:false,terminal:true,error:'推荐码无效'}});await new Promise(resolve=>setImmediate(resolve));assert.equal(f.calls.length,2);assert.equal(f.calls[1].data.code,'654321');
 second.resolve({result:{success:true}});await login;assert.equal(f.calls[2].name,'login');
});
