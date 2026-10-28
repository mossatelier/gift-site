const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
function fixture() {
 let page,user={openid:'a'},ids=['p'],resolveSync,resolveProducts;
 const wishlist={getList:()=>ids,saveList:v=>ids=v,remove:id=>ids=ids.filter(x=>x!==id),pullAndMerge:async()=>true};
 const db={getProductsByIds:async()=>ids.map(_id=>({_id})),listMyAddresses:async()=>[],getDefaultAddress(){}};
 const auth={getCurrentUser:()=>user};
 const wx={showToast(){},showLoading(){},hideLoading(){},cloud:{callFunction:async()=>({result:{success:true,orderId:'o'}})}};
 vm.runInNewContext(fs.readFileSync(require.resolve('../miniprogram/pages/wishlist/wishlist'),'utf8'),{
  Page:p=>page=p,wx,console:{warn(){},error(){}},setTimeout(){},require:name=>name.endsWith('db.js')?db:name.endsWith('wishlist.js')?wishlist:name.endsWith('auth.js')?auth:{}});
 page.data=structuredClone(page.data);page.setData=function(p){Object.assign(this.data,p)};
 return {page,db,auth,wishlist,wx,setUser:u=>user=u,setIds:v=>ids=v,ids:()=>ids};
}
test('account switch clears old address even if new account address request fails',async()=>{
 const f=fixture();f.page.data.user={openid:'old'};f.page.data.address={_id:'old-address'};f.page._pickedAddressId='old-address';
 f.db.listMyAddresses=async()=>{throw Error('offline')};await f.page.refresh();
 assert.equal(f.page.data.address,null);assert.equal(f.page._pickedAddressId,null);assert.equal(f.page.data.user.openid,'a');
});
test('removal while refreshing does not leave spinner or allow late data to restore item',async()=>{
 const f=fixture();f.page.data.items=[{_id:'p'}];let resolve;
 f.wishlist.pullAndMerge=()=>new Promise(r=>resolve=r);const pending=f.page.refresh();
 f.page.removeItem({currentTarget:{dataset:{id:'p'}}});resolve(true);await pending;
 assert.equal(f.page.data.loading,false);assert.equal(f.page.data.items.length,0);
});
test('successful order removes only submitted ids, retaining new or undisplayed wishlist items',async()=>{
 const f=fixture();f.setIds(['p','q','hidden']);f.page.data.items=[{_id:'p'},{_id:'q'}];f.page.data.address={_id:'different-now'};
 let sent;f.wx.cloud.callFunction=async ({data})=>{sent=data;return {result:{success:true,orderId:'o'}}};
 await f.page.doSubmitOrder([{_id:'p',qty:1}],'规格',{openid:'a',addressId:'selected'});
 assert.deepEqual(f.ids(),['q','hidden']);assert.equal(sent.addressId,'selected');assert.equal(f.page.data.items[0]._id,'q');
});
test('late successful order from old account does not clear new account wishlist',async()=>{
 const f=fixture();f.setIds(['q']);f.wx.cloud.callFunction=async()=>{f.setUser({openid:'b'});return {result:{success:true,orderId:'o'}}};
 await f.page.doSubmitOrder([{_id:'p'}],'规格',{openid:'a',addressId:'selected'});assert.deepEqual(f.ids(),['q']);
});
