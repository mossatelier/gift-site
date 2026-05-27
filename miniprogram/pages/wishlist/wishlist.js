const { getProductsByIds, listMyAddresses, getDefaultAddress } = require('../../utils/db.js');
const wishlist = require('../../utils/wishlist.js');
const auth = require('../../utils/auth.js');

Page({
  data: {
    loading: true,
    items: [],
    openFlow: 'credit',
    user: null,
    address: null,
    addressCount: 0,
    remark: '',
    submitting: false
  },

  onShow() {
    this.refresh();
  },

  onPullDownRefresh() {
    this.refresh().then(() => wx.stopPullDownRefresh());
  },

  async refresh() {
    this.setData({ loading: true });
    const ids = wishlist.getList();
    const user = auth.getCurrentUser();
    this.setData({ user });

    if (user) {
      try {
        const addresses = await listMyAddresses(user.openid);
        // 当前选中的地址：维持已选；否则取默认
        let address = null;
        if (this._pickedAddressId) {
          address = addresses.find(a => a._id === this._pickedAddressId) || null;
        }
        if (!address) {
          address = addresses[0] || null;
        }
        this.setData({ address, addressCount: addresses.length });
      } catch (err) {
        console.warn('load address failed', err);
      }
    } else {
      this.setData({ address: null, addressCount: 0 });
    }

    if (ids.length === 0) {
      this.setData({ items: [], loading: false });
      return;
    }
    try {
      const items = await getProductsByIds(ids);
      this.setData({ items, loading: false });
    } catch (err) {
      console.error('心愿单加载失败', err);
      this.setData({ items: [], loading: false });
      wx.showToast({ title: '加载失败', icon: 'none' });
    }
  },

  goList() {
    wx.switchTab({ url: '/pages/list/list' });
  },

  goProduct(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({ url: `/pages/product/product?id=${id}` });
  },

  removeItem(e) {
    const id = e.currentTarget.dataset.id;
    wishlist.remove(id);
    this.setData({
      items: this.data.items.filter(item => item._id !== id)
    });
    wx.showToast({ title: '已移除', icon: 'success' });
  },

  toggleFlow(e) {
    const flow = e.currentTarget.dataset.flow;
    this.setData({ openFlow: this.data.openFlow === flow ? '' : flow });
  },

  previewQrcode() {
    wx.previewImage({
      urls: ['/images/wishlist-wechat-qr.jpg'],
      current: '/images/wishlist-wechat-qr.jpg'
    });
  },

  onRemarkInput(e) {
    this.setData({ remark: e.detail.value });
  },

  // 点收货地址卡：
  // - 无地址 → 跳新增
  // - 有 1 个 → 跳编辑
  // - 多个 → 跳列表选择
  goAddress() {
    if (!auth.ensureLogin('/pages/wishlist/wishlist')) return;
    const count = this.data.addressCount;
    if (count === 0) {
      wx.navigateTo({
        url: '/pages/address-edit/address-edit?redirect=' + encodeURIComponent('/pages/wishlist/wishlist')
      });
    } else {
      wx.navigateTo({ url: '/pages/address-list/address-list?picker=1' });
    }
  },

  // 来自 address-list picker 模式的回传
  onPickAddress(addressId) {
    this._pickedAddressId = addressId;
  },

  async submitOrder() {
    if (this.data.submitting) return;
    if (this.data.items.length === 0) {
      wx.showToast({ title: '心愿单为空', icon: 'none' });
      return;
    }
    if (!auth.ensureLogin('/pages/wishlist/wishlist')) return;
    if (!this.data.address) {
      wx.showModal({
        title: '请先填写收货地址',
        content: '提交申请前需要填写收货地址，去填写吗？',
        confirmText: '去填写',
        confirmColor: '#d64b2a',
        success: (res) => {
          if (res.confirm) {
            wx.navigateTo({
              url: '/pages/address-edit/address-edit?redirect=' + encodeURIComponent('/pages/wishlist/wishlist')
            });
          }
        }
      });
      return;
    }

    const items = this.data.items.map(it => ({ _id: it._id, qty: 1 }));
    const remark = this.data.remark || '';

    wx.showModal({
      title: '确认提交',
      content: `共 ${items.length} 件礼品，提交后客服会主动联系你`,
      confirmText: '提交',
      confirmColor: '#d64b2a',
      success: async (res) => {
        if (!res.confirm) return;
        this.setData({ submitting: true });
        wx.showLoading({ title: '提交中…', mask: true });
        try {
          const cf = await wx.cloud.callFunction({
            name: 'submit-order',
            data: {
              items,
              addressId: this.data.address._id,
              remark
            }
          });
          wx.hideLoading();
          const r = cf && cf.result;
          if (!r || !r.success) {
            throw new Error((r && r.error) || '提交失败');
          }
          wishlist.saveList([]);
          this.setData({ items: [], remark: '' });
          this._pickedAddressId = null;
          wx.showToast({ title: '提交成功', icon: 'success' });
          setTimeout(() => {
            wx.navigateTo({ url: `/pages/order-detail/order-detail?id=${r.orderId}` });
          }, 600);
        } catch (err) {
          wx.hideLoading();
          console.error('submit failed', err);
          wx.showToast({ title: err.message || '提交失败', icon: 'none' });
        } finally {
          this.setData({ submitting: false });
        }
      }
    });
  },

  onShareAppMessage() {
    return {
      title: '加加好物图集 · 我的心愿单',
      path: '/pages/wishlist/wishlist'
    };
  }
});
