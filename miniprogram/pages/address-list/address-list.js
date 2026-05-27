const auth = require('../../utils/auth.js');
const { listMyAddresses, deleteAddress, setDefaultAddress } = require('../../utils/db.js');

Page({
  data: {
    loading: true,
    addresses: [],
    picker: false   // 选地址模式 ？true 用作 wishlist 提交前选地址回传
  },

  onLoad(query) {
    this.picker = !!(query && query.picker);
    if (!auth.ensureLogin('/pages/address-list/address-list' + (this.picker ? '?picker=1' : ''))) return;
    this.setData({ picker: this.picker });
  },

  onShow() {
    if (!auth.isLoggedIn()) return;
    this.refresh();
  },

  onPullDownRefresh() {
    this.refresh().then(() => wx.stopPullDownRefresh());
  },

  async refresh() {
    const user = auth.getCurrentUser();
    if (!user) return;
    this.setData({ loading: true });
    try {
      const addresses = await listMyAddresses(user.openid);
      this.setData({ addresses, loading: false });
    } catch (err) {
      console.error('load addresses failed', err);
      this.setData({ addresses: [], loading: false });
      wx.showToast({ title: '加载失败', icon: 'none' });
    }
  },

  goAdd() {
    wx.navigateTo({ url: '/pages/address-edit/address-edit' });
  },

  goEdit(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({ url: `/pages/address-edit/address-edit?id=${id}` });
  },

  async setDefault(e) {
    const id = e.currentTarget.dataset.id;
    const user = auth.getCurrentUser();
    if (!user) return;
    wx.showLoading({ title: '保存中', mask: true });
    try {
      await setDefaultAddress(id, user.openid);
      await this.refresh();
      wx.hideLoading();
      wx.showToast({ title: '已设为默认', icon: 'success' });
    } catch (err) {
      wx.hideLoading();
      wx.showToast({ title: err.message || '失败', icon: 'none' });
    }
  },

  remove(e) {
    const id = e.currentTarget.dataset.id;
    const user = auth.getCurrentUser();
    if (!user) return;
    wx.showModal({
      title: '删除地址？',
      content: '删除后不可恢复',
      confirmText: '删除',
      confirmColor: '#d64b2a',
      success: async (res) => {
        if (!res.confirm) return;
        wx.showLoading({ title: '删除中', mask: true });
        try {
          await deleteAddress(id, user.openid);
          await this.refresh();
          wx.hideLoading();
          wx.showToast({ title: '已删除', icon: 'success' });
        } catch (err) {
          wx.hideLoading();
          wx.showToast({ title: err.message || '失败', icon: 'none' });
        }
      }
    });
  },

  // picker 模式：选中一个地址，回传给来源页（心愿单等）
  pick(e) {
    if (!this.data.picker) return;
    const id = e.currentTarget.dataset.id;
    const pages = getCurrentPages();
    const prev = pages[pages.length - 2];
    if (prev && typeof prev.onPickAddress === 'function') {
      prev.onPickAddress(id);
    }
    wx.navigateBack();
  }
});
