const auth = require('../../utils/auth.js');
const { addAddress, updateAddress } = require('../../utils/db.js');

// 省级名称标准化（识别到的关键词 → picker 用的全称）
const PROVINCE_MAP = {
  '北京': '北京市', '天津': '天津市', '上海': '上海市', '重庆': '重庆市',
  '河北': '河北省', '山西': '山西省', '辽宁': '辽宁省', '吉林': '吉林省', '黑龙江': '黑龙江省',
  '江苏': '江苏省', '浙江': '浙江省', '安徽': '安徽省', '福建': '福建省', '江西': '江西省',
  '山东': '山东省', '河南': '河南省', '湖北': '湖北省', '湖南': '湖南省', '广东': '广东省',
  '海南': '海南省', '四川': '四川省', '贵州': '贵州省', '云南': '云南省', '陕西': '陕西省',
  '甘肃': '甘肃省', '青海': '青海省', '台湾': '台湾省',
  '内蒙古': '内蒙古自治区', '广西': '广西壮族自治区', '西藏': '西藏自治区',
  '宁夏': '宁夏回族自治区', '新疆': '新疆维吾尔自治区',
  '香港': '香港特别行政区', '澳门': '澳门特别行政区'
};
const MUNICIPALITIES = ['北京市', '天津市', '上海市', '重庆市'];

// 从一整段文字里尽力解析出收件人 / 手机 / 省市区 / 详细地址
function parseAddress(raw) {
  const out = { recipient: '', phone: '', province: '', city: '', district: '', detail: '' };
  let text = String(raw || '').replace(/[\r\n\t]+/g, ' ');

  // 1. 手机号（兼容 +86 / 86 前缀，以及位间的空格/连字符分隔）
  const pm = text.match(/(?:\+?86[\s-]?)?1[3-9]\d(?:[\s-]?\d){8}/);
  if (pm) {
    out.phone = pm[0].replace(/[^\d]/g, '').replace(/^86/, '');
    text = text.replace(pm[0], ' ');
  }

  // 2. 去掉标签词和标点
  text = text.replace(/收货人|收件人|收货|收件|姓名|联系电话|联系方式|电话|手机号码|手机号|手机|详细地址|地址/g, ' ');
  text = text.replace(/[,，。;；:：、|/\\]/g, ' ').replace(/\s+/g, ' ').trim();

  // 3. 省
  let provKey = '', provIdx = -1;
  for (const k of Object.keys(PROVINCE_MAP)) {
    const i = text.indexOf(k);
    if (i >= 0 && (provIdx === -1 || i < provIdx)) { provIdx = i; provKey = k; }
  }
  let rest = text;
  if (provKey) {
    out.province = PROVINCE_MAP[provKey];
    const before = text.slice(0, provIdx).trim();
    if (before) out.recipient = before.split(' ').filter(Boolean)[0] || '';
    rest = text.slice(provIdx + provKey.length)
      .replace(/^(壮族自治区|回族自治区|维吾尔自治区|特别行政区|自治区|省|市)/, '')
      .trim();
  }

  // 4. 市（到 市/自治州/地区/盟）
  const cityMatch = rest.match(/^(.*?(?:市|自治州|地区|盟))/);
  if (cityMatch) {
    out.city = cityMatch[1].trim();
    rest = rest.slice(cityMatch[1].length).trim();
  } else if (MUNICIPALITIES.includes(out.province)) {
    out.city = out.province; // 直辖市第二级 = 本身
  }

  // 5. 区/县（到 区/县/旗，或县级市）
  const distMatch = rest.match(/^(.*?(?:区|县|旗|市))/);
  if (distMatch) {
    out.district = distMatch[1].trim();
    rest = rest.slice(distMatch[1].length).trim();
  }

  out.detail = rest.trim();

  // 6. 兜底：完全没识别到省 → 第一段当姓名，其余当详细
  if (!out.recipient && !out.province) {
    const parts = text.split(' ').filter(Boolean);
    if (parts.length) {
      out.recipient = parts[0];
      out.detail = parts.slice(1).join(' ');
    }
  }
  return out;
}

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
    detail: '',
    pasteText: ''
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

  onPasteInput(e) { this.setData({ pasteText: e.detail.value }); },

  onClearPaste() { this.setData({ pasteText: '' }); },

  onParsePaste() {
    const raw = (this.data.pasteText || '').trim();
    if (!raw) {
      wx.showToast({ title: '请先粘贴信息', icon: 'none' });
      return;
    }
    const r = parseAddress(raw);
    const region = [r.province, r.city, r.district].filter(Boolean);
    const patch = {};
    if (r.recipient) patch.recipient = r.recipient;
    if (r.phone) patch.phone = r.phone;
    if (r.detail) patch.detail = r.detail;
    if (region.length) {
      patch.region = region;
      patch.regionText = region.join(' ');
    }
    if (Object.keys(patch).length === 0) {
      wx.showToast({ title: '未识别到信息，请手动填写', icon: 'none' });
      return;
    }
    this.setData(patch);
    wx.showToast({ title: '已识别，请核对', icon: 'none' });
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
