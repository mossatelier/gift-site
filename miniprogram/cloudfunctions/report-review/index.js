// 用户举报晒图：写入 reports 集合，供后台处理（下架/删除）。
// openid 取自 getWXContext，不信客户端。一人对同一条只计一次（重复举报覆盖 reason/时间）。
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

const VALID_REASONS = ['色情低俗', '广告/导流', '虚假信息', '侵权/抄袭', '其他'];

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext();
  const reviewId = String((event && event.reviewId) || '').trim();
  let reason = String((event && event.reason) || '').trim().slice(0, 100);
  if (!OPENID) return { success: false, error: '未获取到用户身份' };
  if (!reviewId) return { success: false, error: '缺少 reviewId' };
  if (VALID_REASONS.indexOf(reason) === -1 && !reason) reason = '其他';

  try {
    // 同一用户对同一条只保留一条举报记录（重复举报更新理由与时间）。
    const existing = await db.collection('reports')
      .where({ openid: OPENID, reviewId })
      .limit(1)
      .get();

    if (existing.data && existing.data.length > 0) {
      await db.collection('reports').doc(existing.data[0]._id).update({
        data: { reason, status: 'pending', updatedAt: db.serverDate() }
      });
    } else {
      await db.collection('reports').add({
        data: {
          _openid: OPENID,
          openid: OPENID,
          reviewId,
          reason,
          status: 'pending',
          createdAt: db.serverDate(),
          updatedAt: db.serverDate()
        }
      });
    }
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
};
