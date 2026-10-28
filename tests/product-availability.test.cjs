const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const quiet={log(){},error(){},warn(){}};
function page(name, db={}) {
 let definition;
 const app={globalData:{}};
 const wx={showToast(){},setNavigationBarTitle(){},cloud:{callFunction:async()=>({result:{success:true}})}};
 let toggles=0;
 const config={categories:[],subcategories:{},labelOfCategory:x=>x,sortCategories:x=>x};
 const ctx={console:quiet,wx,getApp:()=>app,Page:x=>definition=x,setTimeout,clearTimeout,setInterval,clearInterval,
 require(file){
  if(file.endsWith('/db.js'))return db;
  if(file.endsWith('/config.js'))return config;
  if(file.endsWith('/wishlist.js'))return {getMap:()=>({}),has:()=>false,toggle(){toggles++},getList:()=>[]};
  return {};
 }};
 vm.runInNewContext(read(`miniprogram/pages/${name}/${name}.js`),ctx);
 const instance={...definition,data:structuredClone(definition.data),setData(patch,cb){Object.assign(this.data,patch);if(cb)cb();}};
 return {instance,app,toggles:()=>toggles};
}
test('retired sync cannot read or mutate any database or contact Supabase',async()=>{
 const ctx={exports:{},require(){throw Error('retired function must not load a database/network client')}};
 vm.runInNewContext(read('miniprogram/cloudfunctions/sync-products/index.js'),ctx);
 for(let i=0;i<5;i++)assert.equal((await ctx.exports.main({Type:'Timer'})).retired,true);
 assert.deepEqual(JSON.parse(read('miniprogram/cloudfunctions/sync-products/config.json')).triggers,[]);
});
test('detail lookup rejects inactive/deleted products and allows reactivated products',async()=>{
 let product={_id:'p',isActive:false};
 const database = { collection: () => ({ doc: () => ({ get: async () => ({ data: product }) }) }) };
 const ctx = { module: { exports: {} }, wx: { cloud: { database: () => database } } };
 vm.runInNewContext(read('miniprogram/utils/db.js'),ctx);
 assert.equal(await ctx.module.exports.getProductById('p'),null);
 product={...product,isActive:true,deleted:true};assert.equal(await ctx.module.exports.getProductById('p'),null);
 product={...product,deleted:false};assert.equal((await ctx.module.exports.getProductById('p'))._id,'p');
});
test('old detail link and open detail cannot collect an off-shelf product',async()=>{
 let active=true;
 const p=page('product',{getProductById:async()=>active?{_id:'p',title:'礼品',category:'toy'}:null}).instance;
 p.productId='p';await p.loadProduct('p');assert.equal(p.data.product.title,'礼品');
 active=false;await p.toggleWishlist();assert.equal(p.data.product,null);assert.equal(p.data.showSubmit,false);
 await p.openSubmit();assert.equal(p.data.showSubmit,false);
 active=true;await p.loadProduct('p');assert.equal(p.data.product._id,'p');
});
test('detail network failure clears stale product and shows retry message',async()=>{
 const p=page('product',{getProductById:async()=>{throw Error('offline')}}).instance;
 p.data.product={_id:'old'};await p.loadProduct('old');assert.equal(p.data.product,null);assert.match(p.data.loadError,/加载失败/);
});
test('list returns refresh data while keeping search and filters',()=>{
 const p=page('list').instance;let refresh=0;p.reload=()=>refresh++;
 p.data.keyword='推车';p.data.currentCategory='toy';p.data.currentSub='益智类';p.data.sort='cards-asc';p.data.cards='5';
 p.onShow();p.onShow();assert.equal(refresh,1);
 assert.equal(p.data.keyword,'推车');assert.equal(p.data.currentCategory,'toy');assert.equal(p.data.currentSub,'益智类');assert.equal(p.data.sort,'cards-asc');assert.equal(p.data.cards,'5');
});
test('home and category refresh on each visit',()=>{
 for(const name of ['index','category']){
  const p=page(name).instance;let count=0;p[name==='index'?'loadAll':'reload']=()=>count++;
  p.onShow();p.onShow();assert.equal(count,2);
 }
});
test('older list response cannot restore stale goods after a newer refresh',async()=>{
 let finish;
 const p=page('list',{listProductPage:()=>new Promise(r=>finish=r)}).instance;
 p._loadRequest=1;p._filter=()=>({});p.data.cards='';p.data.items=[];
 const old=p._loadPage(1);p._loadRequest=2;p.data.items=[{_id:'new'}];
 finish({items:[{_id:'off-shelf'}],nextSkip:1,hasMore:false});await old;assert.equal(p.data.items[0]._id,'new');assert.equal(p.data.items.length,1);
});
