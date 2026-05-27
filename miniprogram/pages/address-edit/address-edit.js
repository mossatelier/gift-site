const auth = require('../../utils/auth.js');
const { getMyAddress, upsertMyAddress } = require('../../utils/db.js');

Page({
  data: {
    loading: true,
    submitting: false,
    redirect: '',
    recipient: '',
    phone: '',
    region: [],          // [省, 市, 区]
    regionText: '',
    detail: ''
  },

  onLoad(query) {
    const redirect = query && query.redirect ? decodeURIComponent(query.redirect) : '';
    this.setData({ redirect });
    const back = `/pages/address-edit/address-edit${redirect ? '?redirect=' + encodeURIComponent(redirect) : ''}`;
    if (!auth.ensureLogin(back)) return;
    this.loadExisting();
  },

  async loadExisting() {
    const user = auth.getCurrentUser();
    if (!user) return;
    try {
      const a = await getMyAddress(user.openid);
      if (a) {
        const region = [a.province || '', a.city || '', a.district || ''].filter(Boolean);
        this.setData({
          loading: false,
          recipient: a.recipient || '',
          phone: a.phone || '',
          region,
          regionText: region.join(' '),
          detail: a.detail || ''
        });
      } else {
        this.setData({ loading: false });
      }
    } catch (err) {
      console.error(err);
      this.setData({ loading: false });
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
    this.setData({ submitting: true });
    try {
      await upsertMyAddress(user.openid, {
        recipient: this.data.recipient,
        phone: this.data.phone,
        province, city, district,
        detail: this.data.detail
      });
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
