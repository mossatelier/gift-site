/* 手机 / 电脑后台共用的一键保存。兼容现有云函数，无需重新部署后端。 */
(function (root) {
  "use strict";
  async function save(order, fields, call) {
    var trackingNo = String(fields.trackingNo || "").trim();
    var trackingCompany = String(fields.trackingCompany || "").trim();
    var phone = String(fields.phone || "").trim();
    var adminNote = String(fields.adminNote || "").trim();
    if (trackingNo.length > 50 || trackingCompany.length > 30 || phone.length > 20 || adminNote.length > 1000) {
      throw new Error("单号最多50字、快递公司最多30字、手机号最多20字、备注最多1000字，请缩短后重试。");
    }
    var trackingChanged = trackingNo !== (order.trackingNo || "")
      || trackingCompany !== (order.trackingCompany || "")
      || phone !== (order.trackingPhone || (order.address && order.address.phone) || "");
    var noteChanged = adminNote !== (order.adminNote || "");
    var saved = [];
    try {
      // 只有物流字段变化才调用发货接口；仅改备注绝不触发推送 / 订阅。
      if (trackingChanged) {
        var result = await call("update-tracking", {
          orderId: order._id, trackingNo: trackingNo, trackingCompany: trackingCompany,
          courierCode: fields.courierCode || "", phone: phone
        });
        Object.assign(order, result);
        saved.push("快递信息");
      }
      if (noteChanged) {
        await call("update-note", { orderId: order._id, adminNote: adminNote });
        order.adminNote = adminNote;
        saved.push("备注");
      }
      return { changed: saved.length > 0, shipped: trackingChanged && !!trackingNo && order.status === "shipped" };
    } catch (error) {
      // 成功部分同步到本地，重试只提交未成功部分，避免再次发货。
      throw new Error((saved.length ? saved.join("、") + "已保存；其余内容保存失败：" : "保存失败：")
        + (error.message || "网络异常") + "。填写内容已保留，请重试。");
    }
  }
  if (typeof module === "object" && module.exports) module.exports = { save: save };
  else root.OrderSave = { save: save };
})(typeof window !== "undefined" ? window : globalThis);
