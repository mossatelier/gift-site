const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const quiet = {log(){},warn(){},error(){}};
const read = path => fs.readFileSync(require.resolve('../' + path),'utf8');
function productDb(rows) {
 const offsets=[];
 const database={command:{neq:value=>({op:'neq',value}),in:value=>({op:'in',value})},collection(){
  let condition={},skip=0,limit=20;
  return {
   where(value){condition=value;return this},orderBy(){return this},skip(value){skip=value;return this},limit(value){limit=value;return this},
   async get(){
    const result=rows.filter(row=>Object.entries(condition).every(([key,value])=>value&&value.op==='neq'?row[key]!==value.value:value&&value.op==='in'?value.value.includes(row[key]):row[key]===value));
    if (!condition.isPinned) offsets.push(skip);
    return {data:result.slice(skip,skip+limit)};
   }
  };
 }};
 const context={module:{exports:{}},wx:{cloud:{database:()=>database}},console:quiet};
 vm.runInNewContext(read('miniprogram/utils/db.js'),context);
 return {...context.module.exports,offsets};
}
function page(name,db,auth={}) {
 let definition;
 vm.runInNewContext(read('miniprogram/pages/'+name+'/'+name+'.js'),{
  console:quiet,wx:{showToast(){},stopPullDownRefresh(){}},Page:object=>definition=object,
  require(name){
   if(name.endsWith('/db.js'))return db;
   if(name.endsWith('/auth.js'))return auth;
   if(name.endsWith('/config.js'))return {subcategories:{},labelOfCategory:x=>x};
   return {};
  }
 });
 return {...definition,data:structuredClone(definition.data),setData(patch){Object.assign(this.data,patch)}};
}
const products = count => Array.from({length:count},(_,i)=>({_id:'p'+i,isActive:true,category:'referral',subcategory:'二人'}));
const pin = {_id:'pin',isActive:true,isPinned:true,category:'referral',subcategory:'活动'};
const filter = {category:'referral',subcategory:'二人'};
test('extra pinned card does not skip a product on subsequent pages',async()=>{
 const db=productDb([pin,...products(45)]),p=page('list',db);
 p.data.cards='';p._filter=()=>filter;p._loadRequest=1;
 await p._loadPage();assert.equal(p.data.items.length,21);assert.equal(p.data.skip,20);assert.equal(p.data.noMore,false);
 await p.loadMore();await p.loadMore();
 assert.equal(p.data.items.length,46);assert.equal(new Set(p.data.items.map(x=>x._id)).size,46);
 assert.deepEqual(db.offsets,[0,20,40]);assert.equal(p.data.noMore,true);
});
test('short final page with pin is exhausted based on database rows, not displayed cards',async()=>{
 const db=productDb([pin,...products(19)]),result=await db.listProductPage(filter);
 assert.equal(result.items.length,20);assert.equal(result.nextSkip,19);assert.equal(result.hasMore,false);
 assert.equal(Array.isArray(await db.listProducts(filter)),true);
});
test('active-but-deleted pinned and ordinary products never enter pages or offsets',async()=>{
 const db=productDb([{...pin,deleted:true},{...products(1)[0],_id:'deleted',deleted:true},...products(21)]);
 const first=await db.listProductPage(filter),second=await db.listProductPage({...filter,skip:first.nextSkip});
 assert.equal(first.items.length,20);assert.equal(second.items.length,1);
 assert.equal(first.items.some(x=>x._id==='pin'||x._id==='deleted'),false);
});
test('pinned product injected early and later present in normal page is displayed only once',async()=>{
 const rows=products(25);rows[24]={...rows[24],isPinned:true};
 const db=productDb(rows),p=page('list',db);p.data.cards='';p._filter=()=>filter;p._loadRequest=1;
 await p._loadPage();await p.loadMore();assert.equal(p.data.items.length,25);assert.equal(p.data.skip,25);
 assert.equal(p.data.items.filter(x=>x._id==='p24').length,1);
});
function orders(count){return Array.from({length:count},(_,i)=>({_id:'o'+i,status:'pending',createdAt:'2026-10-01'}))}
const auth={getCurrentUser:()=>({openid:'owner'}),ensureLogin:()=>true};
test('my orders loads all records beyond previous 50-order cap',async()=>{
 const data=orders(65),offsets=[];
 const p=page('my-orders',{async listMyOrders(openid,{skip,limit}){assert.equal(openid,'owner');offsets.push(skip);return data.slice(skip,skip+limit)}},auth);
 await p.refresh();assert.equal(p.data.orders.length,20);
 await p.loadMore();await p.loadMore();await p.loadMore();await p.loadMore();
 assert.equal(p.data.orders.length,65);assert.equal(p.data.noMore,true);assert.deepEqual(offsets,[0,20,40,60]);
});
test('older order load cannot overwrite newer refresh or reset its loading state',async()=>{
 const pending=[];const p=page('my-orders',{listMyOrders:()=>new Promise(resolve=>pending.push(resolve))},auth);
 const old=p.refresh(),fresh=p.refresh();pending[1]([{_id:'new',status:'signed'}]);await fresh;
 pending[0]([{_id:'old',status:'pending'}]);await old;assert.equal(p.data.orders.length,1);assert.equal(p.data.orders[0]._id,'new');assert.equal(p.data.loading,false);
});
test('failed next order page preserves visible records and retries same offset',async()=>{
 let fail=true;const offsets=[];const data=orders(25);
 const p=page('my-orders',{async listMyOrders(openid,{skip,limit}){offsets.push(skip);if(skip&&fail)throw Error('offline');return data.slice(skip,skip+limit)}},auth);
 await p.refresh();await p.loadMore();assert.equal(p.data.orders.length,20);assert.equal(p.data.skip,20);assert.equal(p.data.loadError,true);
 fail=false;await p.loadMore({type:'tap'});assert.equal(p.data.orders.length,25);assert.equal(p.data.noMore,true);assert.deepEqual(offsets,[0,20,20]);
});
test('order response after hide is ignored',async()=>{
 let finish;const p=page('my-orders',{listMyOrders:()=>new Promise(resolve=>finish=resolve)},auth);
 const pending=p.refresh();p.onHide();finish([{_id:'old'}]);await pending;assert.equal(p.data.orders.length,0);
});

test('wishlist batch lookup returns all 125 products in requested order and omits unavailable ones',async()=>{
 const rows = products(125);
 rows[25].isActive = false;
 rows[55].deleted = true;
 const db = productDb(rows), requested = rows.map(row => row._id).reverse();
 const result = await db.getProductsByIds(requested);
 assert.equal(result.length, 123);
 assert.deepEqual(Array.from(result, row => row._id), requested.filter(id => id !== 'p25' && id !== 'p55'));
 assert.equal(db.offsets.length, 7);
});
