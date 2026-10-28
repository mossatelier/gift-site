// 创建订单（申请）
// 入参：{ items: [{ _id, qty? }], addressId, remark? }
// 返回：{ success, orderId }
//
// 安全策略：
// - openid 从 getWXContext() 取，不信 client 传值
// - items / address 都做服务端快照：从云开发实时读 products 和 addresses，
//   避免 client 篡改价格/积分；后续 admin 改资料也不影响历史订单
// - 限频：同一 openid 60 秒内最多 3 单（防误点 + 防滥用）

const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();

const MAX_ITEMS = 50;
const checkout = require('./checkout')(db);

// 「下单成功通知」订阅消息模板 ID（与小程序端 config.orderPlacedTmplId 同一个）
const ORDER_PLACED_TMPL_ID = '4zU26DwALOyDtm8yRSNmO0vnriyKWW-usUtk2MjGjkg';

// 北京时间 YYYY-MM-DD HH:mm（云函数默认 UTC，+8 小时取墙钟）
function fmtBeijing(d) {
  const date = (d instanceof Date) ? d : new Date(d);
  const t = new Date(date.getTime() + 8 * 3600 * 1000);
  const p = n => String(n).padStart(2, '0');
  return `${t.getUTCFullYear()}-${p(t.getUTCMonth() + 1)}-${p(t.getUTCDate())} ${p(t.getUTCHours())}:${p(t.getUTCMinutes())}`;
}

// 下单成功 → 立即推一条订阅消息。失败不影响下单主流程。
// 模板字段：thing1=商品名称 date2=下单时间 thing13=收货人姓名 phone_number11=收货人电话 character_string4=订单编号
async function sendOrderPlacedNotify(openid, orderId, order) {
  if (!ORDER_PLACED_TMPL_ID || !openid) return;
  const items = Array.isArray(order.items) ? order.items : [];
  const first = (items[0] && items[0].title) || '礼品';
  const goods = items.length > 1 ? `${first.slice(0, 12)}等${items.length}件` : first.slice(0, 20);
  const addr = order.address || {};
  try {
    await cloud.openapi.subscribeMessage.send({
      touser: openid,
      templateId: ORDER_PLACED_TMPL_ID,
      page: `pages/order-detail/order-detail?id=${orderId}`,
      miniprogramState: 'formal',
      lang: 'zh_CN',
      data: {
        thing1: { value: goods },                                       // 商品名称
        date2: { value: fmtBeijing(order.createdAt || new Date()) },    // 下单时间
        thing13: { value: (addr.recipient || '客户').slice(0, 20) },     // 收货人姓名
        phone_number11: { value: (addr.phone || '').slice(0, 17) },     // 收货人电话
        character_string4: { value: String(orderId).slice(0, 32) }      // 订单编号
      }
    });
  } catch (err) {
    console.warn('[submit-order] sendOrderPlacedNotify failed', err);
  }
}

// 下单时按手机号对账推荐关系：
// 后台「手动录入推荐」是按手机号建的记录(refereeOpenid 为空)，新客自己登录拿到的是 openid，二者对不上。
// openid 与手机号只在订单里同时出现，所以在这里把它们接上：
//  1) 把手机号匹配、refereeOpenid 为空的推荐记录关联到该 openid；
//  2) 若该用户还没有上线，补上 users.referredByOpenid；
//  3) 同一被推荐人+同一上线的多条记录(扫码 vs 手填)去重，避免重复发奖励。
// 整段 try 包裹，绝不影响下单主流程。
async function reconcileReferralByPhone(openid, phone) {
  const p = String(phone || '').trim();
  if (!openid || !/^1\d{10}$/.test(p)) return;
  try {
    const pr = await db.collection('referrals').where({ refereePhone: p, refereeOpenid: '' }).get();
    const pending = pr.data || [];
    if (!pending.length) return;
    const now = new Date();
    for (const rec of pending) {
      await db.collection('referrals').doc(rec._id).update({ data: { refereeOpenid: openid, updatedAt: now } });
    }
    // 补上线绑定（仅当该用户当前没有上线，不覆盖已有）
    const ur = await db.collection('users').where({ openid }).limit(1).get();
    const user = ur.data[0];
    if (user && !user.referredByOpenid) {
      const pick = pending[0];
      if (pick.referrerOpenid && pick.referrerOpenid !== openid) {
        await db.collection('users').doc(user._id).update({ data: {
          referredByOpenid: pick.referrerOpenid,
          referredByCode: pick.referrerCode || '',
          referredAt: now,
          updatedAt: now
        }});
      }
    }
    // 去重：同一被推荐人(openid)下、同一上线多条 → 留信息最全的一条，其余删
    const mine = (await db.collection('referrals').where({ refereeOpenid: openid }).get()).data || [];
    const groups = {};
    mine.forEach(r => { (groups[r.referrerOpenid] = groups[r.referrerOpenid] || []).push(r); });
    const score = (r) => (r.rewardedAt ? 8 : 0) + (r.source === 'admin' ? 4 : 0) + (r.refereePhone ? 2 : 0) + (r.status && r.status !== '待审核' ? 1 : 0);
    for (const k in groups) {
      const list = groups[k];
      if (list.length <= 1) continue;
      list.sort((a, b) => score(b) - score(a));
      for (let i = 1; i < list.length; i++) {
        await db.collection('referrals').doc(list[i]._id).remove();
      }
    }
  } catch (err) {
    console.warn('[submit-order] reconcileReferralByPhone failed', err);
  }
}

// 被推荐人下单领礼 = 在走流程：把他自己那条推荐记录从「待审核」推进到「办卡中」。
// 只推进「待审核」，绝不动「开户成功」(那是发奖励档，必须人工核银行办卡后才标)，也不发任何奖励。
async function advanceRefereeStatusOnOrder(openid) {
  if (!openid) return;
  try {
    await db.collection('referrals')
      .where({ refereeOpenid: openid, status: '待审核' })
      .update({ data: { status: '办卡中', updatedAt: new Date() } });
  } catch (err) {
    console.warn('[submit-order] advanceRefereeStatusOnOrder failed', err);
  }
}

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext();
  if (!OPENID) return { success: false, error: '未登录' };

  const items = Array.isArray(event && event.items) ? event.items : [];
  const addressId = event && event.addressId;
  const remark = String((event && event.remark) || '').trim().slice(0, 500);

  if (items.length === 0) return { success: false, error: '心愿单为空' };
  if (items.length > MAX_ITEMS) return { success: false, error: '商品过多' };
  if (!addressId) return { success: false, error: '缺少收货地址' };

  let result;
  try {
    result = await checkout({ openid: OPENID, items, addressId, remark });
  } catch (err) {
    console.error('[submit-order] checkout failed', err);
    return { success: false, error: '暂未确认下单结果，请先查看我的订单；没有订单时再重试' };
  }
  if (!result.success || result.duplicated) return result;
  const { order, orderId, ...response } = result;
  // 通知和推荐对账只在真正创建新订单后执行，不放进可重试的事务回调。
  await sendOrderPlacedNotify(OPENID, orderId, order);
  await reconcileReferralByPhone(OPENID, order.address.phone);
  await advanceRefereeStatusOnOrder(OPENID);
  return { ...response, orderId };
};
