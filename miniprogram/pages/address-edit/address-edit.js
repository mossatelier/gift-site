const auth = require('../../utils/auth.js');
const { addAddress, updateAddress } = require('../../utils/db.js');

Page({
  data: {
    loading: false,
    submitting: false,
    redirect: '',
    id: '',             // 编辑模式时存在
    recipient: '',
    phone: '',
    region: [],
    regionText: '',
    detail: ''
  },

  onLoad(query) {
    const redirect = query && query.redirect ? decodeURIComponent(query.redirect) : '';
    const id = query && query.id ? query.id : '';
    this.setData({ redirect, id });
    const back = `/pages/address-edit/address-edit${id ? '?id=' + id : ''}${redirect ? (id ? '&' : '?') + 'redirect=' + encodeURIComponent(redirect) : ''}`;
    if (!auth.ensureLogin(back)) return;
    if (id) this.loadOne(id);
  },

  async loadOne(id) {
    this.setData({ loading: true });
    try {
      const db = wx.cloud.database();
      const r = await db.collection('addresses').doc(id).get();
      const a = r.data;
      if (!a) return;
      const region = [a.province || '', a.city || '', a.district || ''].filter(Boolean);
      this.setData({
        loading: false,
        recipient: a.recipient || '',
        phone: a.phone || '',
        region,
        regionText: region.join(' '),
        detail: a.detail || ''
      });
    } catch (err) {
      console.error(err);
      this.setData({ loading: false });
      wx.showToast({ title: '加载失败', icon: 'none' });
    }
  },

  onRecipient(e) { this.setData({ recipient: e.detail.value }); },
  onPhone(e) { this.setData({ phone: e.detail.value }); },
  onDetail(e) { this.setData({ detail: e.detail.value }); },

  onRegionChange(e) {
    const region = e.detail.value || [];
    this.setData({ region, regionText: region.join(' ') });
  },

  async onSubmit() {
    if (this.data.submitting) return;
    const user = auth.getCurrentUser();
    if (!user) {
      auth.ensureLogin('/pages/address-edit/address-edit');
      return;
    }
    const [province = '', city = '', district = ''] = this.data.region || [];
    const patch = {
      recipient: this.data.recipient,
      phone: this.data.phone,
      province, city, district,
      detail: this.data.detail
    };
    this.setData({ submitting: true });
    try {
      if (this.data.id) {
        await updateAddress(this.data.id, patch);
      } else {
        await addAddress(user.openid, patch);
      }
      wx.showToast({ title: '已保存', icon: 'success' });
      setTimeout(() => {
        const target = this.data.redirect;
        if (!target) {
          wx.navigateBack();
        } else if (/^\/pages\/(index|category|list|wishlist|me)\//.test(target)) {
          wx.switchTab({ url: target, fail: () => wx.navigateBack() });
        } else {
          wx.redirectTo({ url: target, fail: () => wx.navigateBack() });
        }
      }, 500);
    } catch (err) {
      wx.showToast({ title: err.message || '保存失败', icon: 'none' });
    } finally {
      this.setData({ submitting: false });
    }
  }
});
