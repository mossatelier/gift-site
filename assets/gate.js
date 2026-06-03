/* 强制引导弹窗：网页客户端已下线，引导访客进入微信小程序。
 * 自包含（自带样式），挂在所有客户页（管理端不引入）。
 * 撤销：删掉各客户页的 <script src="assets/gate.js"> 引用即可恢复网页版。 */
(function () {
  if (document.getElementById("jg-gate")) return;

  var MP_QR = "images/miniprogram-qr.png";
  var KEFU_QR = "images/wishlist-wechat-qr.jpg";
  var WECHAT_ID = "L1916959";

  var style = document.createElement("style");
  style.textContent = [
    "#jg-gate{position:fixed;inset:0;z-index:2147483647;overflow-y:auto;",
    "background:linear-gradient(160deg,#fff7ef 0%,#ffe9d4 100%);",
    "display:flex;align-items:center;justify-content:center;padding:24px 16px;",
    "font-family:-apple-system,BlinkMacSystemFont,'PingFang SC','Hiragino Sans GB','Microsoft YaHei',sans-serif;}",
    "#jg-gate .jg-card{width:100%;max-width:340px;background:#fff;border-radius:24px;",
    "padding:28px 22px 24px;text-align:center;box-shadow:0 20px 50px rgba(120,60,20,.18);}",
    "#jg-gate .jg-logo{font-size:18px;font-weight:800;color:#d64b2a;margin:0 0 18px;}",
    "#jg-gate .jg-title{font-size:21px;font-weight:800;color:#3a2a1a;margin:0 0 8px;}",
    "#jg-gate .jg-sub{font-size:13.5px;line-height:1.6;color:#8a7560;margin:0 0 18px;}",
    "#jg-gate .jg-qr{width:210px;height:210px;object-fit:contain;background:#fff;border-radius:14px;",
    "border:1px solid #eaded0;padding:6px;}",
    "#jg-gate .jg-tip{font-size:13px;font-weight:700;color:#d64b2a;margin:12px 0 0;}",
    "#jg-gate .jg-hr{height:1px;background:#f0e6d8;margin:22px 0 18px;}",
    "#jg-gate .jg-kefu-label{font-size:12.5px;color:#8a7560;margin:0 0 12px;}",
    "#jg-gate .jg-kefu{width:128px;height:128px;object-fit:contain;background:#fff;border-radius:12px;",
    "border:1px solid #eaded0;padding:5px;}",
    "#jg-gate .jg-wx{font-size:13px;color:#3a2a1a;margin:10px 0 0;}",
    "#jg-gate .jg-wx b{color:#d64b2a;letter-spacing:.04em;}"
  ].join("");
  document.head.appendChild(style);

  var gate = document.createElement("div");
  gate.id = "jg-gate";
  gate.setAttribute("role", "dialog");
  gate.setAttribute("aria-modal", "true");
  gate.innerHTML =
    '<div class="jg-card">' +
      '<p class="jg-logo">🏠 加加好物图集</p>' +
      '<h1 class="jg-title">请进入微信小程序</h1>' +
      '<p class="jg-sub">本服务已升级为微信小程序，<br>请微信扫码或长按识别下方小程序码进入浏览与下单。</p>' +
      '<img class="jg-qr" src="' + MP_QR + '" alt="小程序码">' +
      '<p class="jg-tip">微信「扫一扫」 / 长按识别进入小程序</p>' +
      '<div class="jg-hr"></div>' +
      '<p class="jg-kefu-label">也可扫码添加客服微信咨询</p>' +
      '<img class="jg-kefu" src="' + KEFU_QR + '" alt="客服微信二维码" onerror="this.style.display=\'none\'">' +
      '<p class="jg-wx">客服微信：<b>' + WECHAT_ID + '</b></p>' +
    '</div>';

  function mount() {
    if (!document.body) { return; }
    document.body.appendChild(gate);
    document.body.style.overflow = "hidden";
  }
  if (document.body) {
    mount();
  } else {
    document.addEventListener("DOMContentLoaded", mount);
  }
})();
