// 提交晒图评价（UGC，先审后发）
// 入参：{ orderId, productId, images:[fileID], content, rating }
// 返回：{ success, reviewId }
//
// 安全：
// - openid 取自 getWXContext()，不信 client
// - 校验订单属于本人（且建议已完成）
// - 一个订单只能晒一次（防刷）
// - 文字过微信内容安全检测 msgSecCheck（违规直接拒）
//   图片靠 admin 人工审核（先审后发），机器图检后续可加 mediaCheckAsync
// - 写入 reviews，status=pending，_openid 显式写（用户端 SDK 按 _openid 读自己的）

const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();
const _ = db.command;

const MAX_IMAGES = 9;
const MAX_CONTENT = 500;

// 文字内容安全检测（v2 同步）。检测服务异常时放行，靠人工审核兜底
async function checkText(content, openid) {
  const text = (content || '').trim();
  if (!text) return { ok: true };
  try {
    const res = await cloud.openapi.security.msgSecCheck({
      version: 2,
      scene: 1,
      openid,
      content: text
    });
    const suggest = res && res.result && res.result.suggest;
    if (suggest === 'risky' || suggest === 'block') {
      return { ok: false, error: '文字含违规内容，请修改后再提交' };
    }
    return { ok: true };
  } catch (err) {
    console.warn('[submit-review] msgSecCheck failed, fall back to manual review', err);
    return { ok: true }; // 检测不可用时不拦，交人工审核
  }
}

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext();
  if (!OPENID) return { success: false, error: '未登录' };

  const images = Array.isArray(event && event.images) ? event.images.filter(Boolean) : [];
  const content = ((event && event.content) || '').trim().slice(0, MAX_CONTENT);
  const rating = Math.max(0, Math.min(5, Number(event && event.rating) || 0));
  const orderId = (event && event.orderId) || '';
  let productId = (event && event.productId) || '';

  if (images.length === 0) return { success: false, error: '请至少上传一张图片' };
  if (images.length > MAX_IMAGES) return { success: false, error: `最多 ${MAX_IMAGES} 张图片` };

  // 校验订单归属（必须本人）
  let order = null;
  if (orderId) {
    try {
      const r = await db.collection('orders').doc(orderId).get();
      order = r.data;
    } catch (err) {
      return { success: false, error: '订单不存在' };
    }
    if (!order || order._openid !== OPENID) {
      return { success: false, error: '订单无效' };
    }
    // 一个订单只能晒一次
    const dup = await db.collection('reviews').where({ openid: OPENID, orderId }).count();
    if (dup.total > 0) return { success: false, error: '该订单已经晒过图啦' };
    // 商品快照取订单首个礼品
    if (!productId && Array.isArray(order.items) && order.items[0]) {
      productId = order.items[0].productId || '';
    }
  }

  // 商品快照
  let productTitle = '';
  let productImage = '';
  if (orderId && order && Array.isArray(order.items) && order.items[0]) {
    productTitle = order.items[0].title || '';
    productImage = order.items[0].imageUrl || '';
  } else if (productId) {
    try {
      const p = await db.collection('products').doc(productId).get();
      if (p.data) {
        productTitle = p.data.title || '';
        productImage = (Array.isArray(p.data.images) && p.data.images[0]) || p.data.imageUrl || '';
      }
    } catch (err) { /* ignore */ }
  }

  // 文字内容安全
  const textCheck = await checkText(content, OPENID);
  if (!textCheck.ok) return { success: false, error: textCheck.error };

  // 用户昵称头像
  let nickName = '微信用户';
  let avatarUrl = '';
  try {
    const u = await db.collection('users').where({ openid: OPENID }).limit(1).get();
    if (u.data[0]) {
      nickName = u.data[0].nickName || nickName;
      avatarUrl = u.data[0].avatarUrl || '';
    }
  } catch (err) { /* ignore */ }

  const now = new Date();
  const doc = {
    _openid: OPENID,
    openid: OPENID,
    orderId,
    productId,
    productTitle,
    productImage,
    images,          // 云存储 fileID 数组
    content,
    rating,
    nickName,
    avatarUrl,
    status: 'pending',
    createdAt: now,
    updatedAt: now
  };
  const add = await db.collection('reviews').add({ data: doc });
  return { success: true, reviewId: add._id };
};
