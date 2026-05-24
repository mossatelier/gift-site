// 给指定商品的 viewCount +1
// 入参：{ id: '<云开发 _id>' }
// 调用方：小程序商品详情页 onLoad 时

const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();
const _ = db.command;

exports.main = async (event, context) => {
  const { id } = event || {};
  if (!id) {
    return { success: false, error: 'id is required' };
  }
  try {
    await db.collection('products').doc(id).update({
      data: { viewCount: _.inc(1) }
    });
    return { success: true };
  } catch (err) {
    console.error('[inc-view] update failed', err);
    return { success: false, error: err.message };
  }
};
