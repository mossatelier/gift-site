/**
 * admin-pc.js — 桌面版 Admin Console 的 UI / 交互层。
 *
 * 本阶段实现：登录闭环 + 导航切换 + 数据看板。
 * 所有网络 / 鉴权一律走 window.AdminCore（admin-core.js），这里不重复 fetch / 鉴权。
 *
 * 纯 ES2017，无 import / export。
 */
(function () {
  "use strict";

  var Core = window.AdminCore;

  // ============ DOM 引用 ============

  // 登录视图
  var pcLoginView = document.getElementById("pcLoginView");
  var pcLoginForm = document.getElementById("pcLoginForm");
  var pcLoginEmail = document.getElementById("pcLoginEmail");
  var pcLoginPassword = document.getElementById("pcLoginPassword");
  var pcLoginBtn = document.getElementById("pcLoginBtn");
  var pcLoginMsg = document.getElementById("pcLoginMsg");

  // App 视图外壳
  var pcAppView = document.getElementById("pcAppView");
  var pcClock = document.getElementById("pcClock");
  var pcAccountEmail = document.getElementById("pcAccountEmail");
  var pcLogoutBtn = document.getElementById("pcLogoutBtn");

  // 导航
  var pcNavItems = Array.prototype.slice.call(document.querySelectorAll(".pc-nav-item"));
  var pcPanels = Array.prototype.slice.call(document.querySelectorAll(".pc-panel"));
  var pcBadgeOrders = document.getElementById("pcBadgeOrders");
  var pcBadgeReviews = document.getElementById("pcBadgeReviews");

  // 数据看板
  var pcStatsPeriod = document.getElementById("pcStatsPeriod");
  var pcStatsRefreshBtn = document.getElementById("pcStatsRefreshBtn");
  var pcStatsClock = document.getElementById("pcStatsClock");
  var pcStatsKpis = document.getElementById("pcStatsKpis");
  var pcStatsBody = document.getElementById("pcStatsBody");
  var pcStatsMsg = document.getElementById("pcStatsMsg");

  // ============ 本地状态 ============

  var state = {
    activePanel: "stats",
    statsPeriod: "today",
    stats: null,
    statsLoadedAt: null,
    statsLoaded: false
  };

  var PERIOD_LABEL = { today: "今日", week: "本周", month: "本月", all: "全部" };

  // ============ 工具 ============

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, function (char) {
      var map = {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        "\"": "&quot;",
        "'": "&#39;"
      };
      return map[char] || char;
    });
  }

  function pad2(n) {
    return String(n).padStart(2, "0");
  }

  function weekChar(d) {
    return ["日", "一", "二", "三", "四", "五", "六"][d.getDay()];
  }

  // 北京时间（UTC+8）的 Date 视图：用 UTC 字段读取偏移后的时间，避免依赖本机时区。
  function beijingNow() {
    var now = new Date();
    return new Date(now.getTime() + (now.getTimezoneOffset() + 480) * 60000);
  }

  // 顶栏时钟：YYYY-MM-DD 周X HH:MM:SS（北京时间）
  function formatTopClock(d) {
    return d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate())
      + " 周" + weekChar(d)
      + " " + pad2(d.getHours()) + ":" + pad2(d.getMinutes()) + ":" + pad2(d.getSeconds());
  }

  // 看板「数据更新于」时间戳（带周几）
  function formatStatsTimestamp(d) {
    if (!d) return "";
    return d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate())
      + " (周" + weekChar(d) + ") "
      + pad2(d.getHours()) + ":" + pad2(d.getMinutes()) + ":" + pad2(d.getSeconds());
  }

  // ============ 视图切换：登录 <-> App ============

  function showLoginView() {
    if (pcAppView) pcAppView.hidden = true;
    if (pcLoginView) pcLoginView.style.display = "";
  }

  function showAppView() {
    if (pcLoginView) pcLoginView.style.display = "none";
    if (pcAppView) pcAppView.hidden = false;
  }

  function setLoginMsg(text, tone) {
    if (!pcLoginMsg) return;
    pcLoginMsg.textContent = text || "";
    if (tone) {
      pcLoginMsg.dataset.tone = tone;
    } else {
      delete pcLoginMsg.dataset.tone;
    }
  }

  // ============ 启动 ============

  function init() {
    bindEvents();
    startClock();

    var session = Core.activeSession();
    if (session) {
      enterApp(session);
    } else {
      showLoginView();
    }

    // 会话过期：核心层会派发该事件并清掉本地会话，UI 回到登录视图提示重登。
    window.addEventListener("admin:session-expired", function () {
      showLoginView();
      setLoginMsg("登录已过期，请重新登录。", "error");
      if (pcAccountEmail) pcAccountEmail.textContent = "-";
    });
  }

  // 登录成功 / 已有会话 → 进入 App。
  function enterApp(session) {
    showAppView();

    var email = (session && session.user && session.user.email) || "已登录管理员";
    if (pcAccountEmail) pcAccountEmail.textContent = email;

    // 默认进数据看板
    activatePanel(state.activePanel || "stats");

    // 待办角标（不阻塞看板加载）
    loadBadges();
  }

  // ============ 登录 / 退出 ============

  function bindEvents() {
    if (pcLoginForm) {
      pcLoginForm.addEventListener("submit", handleLogin);
    }
    if (pcLogoutBtn) {
      pcLogoutBtn.addEventListener("click", handleLogout);
    }

    // 导航点击（事件委托到每个 nav item）
    pcNavItems.forEach(function (item) {
      item.addEventListener("click", function (event) {
        event.preventDefault();
        var key = item.getAttribute("data-panel");
        if (key) activatePanel(key);
      });
    });

    // 看板：周期 chip 切换
    if (pcStatsPeriod) {
      pcStatsPeriod.addEventListener("click", function (event) {
        var chip = event.target.closest("[data-stats-period]");
        if (!chip) return;
        var p = chip.getAttribute("data-stats-period");
        if (!p || p === state.statsPeriod) return;
        state.statsPeriod = p;
        var chips = pcStatsPeriod.querySelectorAll(".pc-stats-chip");
        Array.prototype.forEach.call(chips, function (el) {
          el.classList.toggle("active", el === chip);
        });
        loadStats();
      });
    }

    // 看板：刷新
    if (pcStatsRefreshBtn) {
      pcStatsRefreshBtn.addEventListener("click", function () {
        loadStats();
      });
    }
  }

  function handleLogin(event) {
    event.preventDefault();

    var email = (pcLoginEmail && pcLoginEmail.value || "").trim();
    var password = (pcLoginPassword && pcLoginPassword.value) || "";

    if (!email || !password) {
      setLoginMsg("请输入管理员邮箱和密码。", "error");
      return;
    }

    if (pcLoginBtn) pcLoginBtn.disabled = true;
    setLoginMsg("正在登录并校验管理员权限…", null);

    Core.signInWithPassword(email, password)
      .then(function (grant) {
        return Core.fetchCurrentUser(grant.access_token).then(function (user) {
          var session = Object.assign({}, grant, { user: user });
          return Core.verifyAdminAccess(session.access_token).then(function () {
            return session;
          });
        });
      })
      .then(function (session) {
        Core.saveSession(session);
        if (pcLoginPassword) pcLoginPassword.value = "";
        setLoginMsg("登录成功。", "success");
        enterApp(session);
      })
      .catch(function (err) {
        Core.clearSession();
        setLoginMsg((err && err.message) || "登录失败", "error");
      })
      .then(function () {
        if (pcLoginBtn) pcLoginBtn.disabled = false;
      });
  }

  function handleLogout() {
    var session = Core.activeSession();
    var token = session ? session.access_token : null;

    var done = function () {
      Core.clearSession();
      // 复位 App 内状态，回到登录视图
      state.stats = null;
      state.statsLoaded = false;
      if (pcAccountEmail) pcAccountEmail.textContent = "-";
      if (pcLoginPassword) pcLoginPassword.value = "";
      showLoginView();
      setLoginMsg("已退出登录。", null);
    };

    // 远端登出失败不应阻塞本地清理。
    Promise.resolve()
      .then(function () {
        if (token) return Core.signOut(token);
      })
      .catch(function () {})
      .then(done);
  }

  // ============ 导航切换 ============

  function activatePanel(key) {
    state.activePanel = key;

    pcNavItems.forEach(function (item) {
      item.classList.toggle("active", item.getAttribute("data-panel") === key);
    });

    pcPanels.forEach(function (panel) {
      panel.hidden = panel.getAttribute("data-panel") !== key;
    });

    if (key === "stats") {
      // 首次进入看板 / 切回时若无数据则拉取一次
      if (!state.statsLoaded) {
        loadStats();
      }
    }
  }

  // ============ 待办角标 ============

  function setBadge(el, total) {
    if (!el) return;
    var n = Number(total) || 0;
    if (n > 0) {
      el.textContent = n > 99 ? "99+" : String(n);
      el.hidden = false;
    } else {
      el.hidden = true;
    }
  }

  function loadBadges() {
    // 待处理订单数
    Core.callAdminOrders("list", { status: "pending", limit: 1 })
      .then(function (data) {
        setBadge(pcBadgeOrders, data && data.total);
      })
      .catch(function () {
        // 角标失败不打扰；保持隐藏。
      });

    // 待审核晒图数
    Core.callAdminOrders("list-reviews", { status: "pending", limit: 1 })
      .then(function (data) {
        setBadge(pcBadgeReviews, data && data.total);
      })
      .catch(function () {});
  }

  // ============ 实时时钟（顶栏 + 看板共享一个 tick） ============

  function tickClock() {
    var now = beijingNow();
    if (pcClock) {
      pcClock.textContent = formatTopClock(now);
    }
    if (pcStatsClock) {
      // 看板内 mini 时钟只显示 HH:MM:SS
      pcStatsClock.textContent = pad2(now.getHours()) + ":" + pad2(now.getMinutes()) + ":" + pad2(now.getSeconds());
    }
  }

  function startClock() {
    tickClock();
    setInterval(tickClock, 1000);
  }

  // ============ 数据看板 ============

  function setStatsMsg(text, tone) {
    if (!pcStatsMsg) return;
    pcStatsMsg.textContent = text || "";
    if (tone) {
      pcStatsMsg.dataset.tone = tone;
    } else {
      delete pcStatsMsg.dataset.tone;
    }
  }

  function loadStats() {
    if (!pcStatsKpis) return;

    if (!Core.activeSession()) {
      pcStatsKpis.innerHTML = '<p class="pc-empty-text">请先登录管理员账号。</p>';
      if (pcStatsBody) pcStatsBody.innerHTML = "";
      return;
    }

    pcStatsKpis.innerHTML = '<p class="pc-empty-text">加载中…</p>';
    setStatsMsg("", null);

    Core.getStats(state.statsPeriod)
      .then(function (data) {
        state.stats = data;
        state.statsLoadedAt = beijingNow();
        state.statsLoaded = true;
        renderStats();
      })
      .catch(function (err) {
        pcStatsKpis.innerHTML = '<p class="pc-empty-text">' + escapeHtml((err && err.message) || "加载失败") + "</p>";
        if (pcStatsBody) pcStatsBody.innerHTML = "";
      });
  }

  // 同比箭头：绿↑ / 红↓（curr vs prev）
  function renderDelta(curr, prev) {
    if (prev === undefined || prev === null) return "";
    var c = Number(curr) || 0;
    var p = Number(prev) || 0;
    if (p === 0 && c === 0) return '<span class="pc-kpi-delta pc-kpi-delta-flat">—</span>';
    if (p === 0) return '<span class="pc-kpi-delta pc-kpi-delta-up">↑ 新增</span>';
    var pct = Math.round(((c - p) / p) * 100);
    if (pct === 0) return '<span class="pc-kpi-delta pc-kpi-delta-flat">持平</span>';
    var cls = pct > 0 ? "pc-kpi-delta-up" : "pc-kpi-delta-down";
    var arrow = pct > 0 ? "↑" : "↓";
    return '<span class="pc-kpi-delta ' + cls + '">' + arrow + " " + Math.abs(pct) + "%</span>";
  }

  // TOP 榜：requested（申请） / viewed（浏览） / wishlisted（心愿）
  function renderTopList(list, kind) {
    if (!Array.isArray(list) || list.length === 0) {
      return '<p class="pc-empty-text">暂无数据。</p>';
    }
    var unitText = function (p) {
      if (kind === "viewed") return escapeHtml(p.count) + " 次浏览";
      if (kind === "wishlisted") return escapeHtml(p.count) + " 人加心愿";
      return escapeHtml(p.count) + " 次申请 · " + escapeHtml(p.cards || 0) + " 积分";
    };
    return '<div class="pc-stats-top-list">' + list.map(function (p, i) {
      return '<div class="pc-stats-top-item">'
        + '<span class="pc-stats-rank">' + (i + 1) + "</span>"
        + (p.imageUrl ? '<img class="pc-stats-top-img" src="' + escapeHtml(p.imageUrl) + '" alt="">' : "")
        + '<div class="pc-stats-top-body">'
        + '<div class="pc-stats-top-title">' + escapeHtml(p.title) + "</div>"
        + '<div class="pc-stats-top-meta">' + unitText(p) + "</div>"
        + "</div>"
        + "</div>";
    }).join("") + "</div>";
  }

  // 24h 下单时段柱状图（纯 CSS，inline 高度）
  function renderHourlyChart(hourly) {
    var arr = Array.isArray(hourly) ? hourly : new Array(24).fill(0);
    var max = Math.max.apply(null, [1].concat(arr));
    var bars = arr.map(function (v, h) {
      return '<div class="pc-stats-hour">'
        + '<div class="pc-stats-hour-bar-wrap">'
        + '<div class="pc-stats-hour-bar" style="height:' + ((v / max) * 100) + '%" title="' + h + ":00 — " + v + ' 单"></div>'
        + "</div>"
        + '<div class="pc-stats-hour-val">' + (v || "") + "</div>"
        + '<div class="pc-stats-hour-label">' + h + "</div>"
        + "</div>";
    }).join("");
    return '<div class="pc-stats-hours">' + bars + "</div>"
      + '<div class="pc-stats-hours-axis">小时（0-23）</div>';
  }

  // 省份 / 城市分布列表
  function renderRegionList(rows) {
    if (!Array.isArray(rows) || rows.length === 0) {
      return '<p class="pc-empty-text">暂无地址数据。</p>';
    }
    return '<div class="pc-stats-region-list">' + rows.map(function (r, i) {
      return '<div class="pc-stats-region-row">'
        + '<span class="pc-stats-rank">' + (i + 1) + "</span>"
        + '<span class="pc-stats-region-name">' + escapeHtml(r.name) + "</span>"
        + '<span class="pc-stats-region-count">' + escapeHtml(r.count) + " 人</span>"
        + "</div>";
    }).join("") + "</div>";
  }

  function statsCard(title, innerHtml, tag) {
    var head = '<div class="pc-stats-card-title">' + escapeHtml(title)
      + (tag ? ' <span class="pc-stats-card-tag">' + escapeHtml(tag) + "</span>" : "")
      + "</div>";
    return '<div class="pc-stats-card">' + head + innerHtml + "</div>";
  }

  function renderStats() {
    if (!pcStatsKpis || !pcStatsBody) return;

    var s = state.stats;
    if (!s) {
      pcStatsKpis.innerHTML = "";
      pcStatsBody.innerHTML = "";
      return;
    }

    var periodLabel = PERIOD_LABEL[s.period] || s.period;
    var users = s.users || {};
    var orders = s.orders || {};
    var byStatus = orders.byStatus || {};
    var top = Array.isArray(s.topProducts) ? s.topProducts : [];
    var topViewed = Array.isArray(s.topViewed) ? s.topViewed : [];
    var topWishlisted = Array.isArray(s.topWishlisted) ? s.topWishlisted : [];
    var dist = s.addressDistribution || { provinces: [], cities: [], total: 0 };
    var comp = s.comparison;
    var productsNew = (s.products && s.products.newInPeriod) || 0;

    // ===== KPI 卡（写入 #pcStatsKpis）=====
    pcStatsKpis.innerHTML = [
      // 新增用户（带同比）
      '<div class="pc-kpi-card">'
        + '<div class="pc-kpi-label">' + escapeHtml(periodLabel) + "新增用户 " + (comp ? renderDelta(users.newInPeriod, comp.users) : "") + "</div>"
        + '<div class="pc-kpi-value">' + escapeHtml(users.newInPeriod || 0) + "</div>"
        + '<div class="pc-kpi-sub">累计 ' + escapeHtml(users.total || 0) + " 个用户</div>"
        + "</div>",
      // 申请订单（带同比）
      '<div class="pc-kpi-card">'
        + '<div class="pc-kpi-label">' + escapeHtml(periodLabel) + "申请订单 " + (comp ? renderDelta(orders.total, comp.orders) : "") + "</div>"
        + '<div class="pc-kpi-value">' + escapeHtml(orders.total || 0) + "</div>"
        + '<div class="pc-kpi-sub">合计 ' + escapeHtml(orders.totalCards || 0) + " 积分 " + (comp ? renderDelta(orders.totalCards || 0, comp.cards) : "") + "</div>"
        + "</div>",
      // 新上礼品（前三带同比中此项无 prev，按原版不带箭头）
      '<div class="pc-kpi-card">'
        + '<div class="pc-kpi-label">' + escapeHtml(periodLabel) + "新上礼品</div>"
        + '<div class="pc-kpi-value">' + escapeHtml(productsNew) + "</div>"
        + '<div class="pc-kpi-sub">' + (s.period === "all" ? "—" : "周期内 admin 录入数") + "</div>"
        + "</div>",
      // 订单状态分布
      '<div class="pc-kpi-card">'
        + '<div class="pc-kpi-label">订单状态分布</div>'
        + '<div class="pc-stats-status-grid">'
        + '<div class="pc-stats-status-row"><span class="pc-order-status pc-order-status-pending">待处理</span><span>' + escapeHtml(byStatus.pending || 0) + "</span></div>"
        + '<div class="pc-stats-status-row"><span class="pc-order-status pc-order-status-processing">处理中</span><span>' + escapeHtml(byStatus.processing || 0) + "</span></div>"
        + '<div class="pc-stats-status-row"><span class="pc-order-status pc-order-status-done">已完成</span><span>' + escapeHtml(byStatus.done || 0) + "</span></div>"
        + '<div class="pc-stats-status-row"><span class="pc-order-status pc-order-status-cancelled">已取消</span><span>' + escapeHtml(byStatus.cancelled || 0) + "</span></div>"
        + "</div>"
        + "</div>"
    ].join("");

    // ===== 图表 / 榜单（写入 #pcStatsBody）=====
    var sampleNote = (orders.total || 0) > 1000
      ? '<p class="pc-empty-text" style="margin-top:8px;font-size:12px;">该周期订单数过多（≥1000），TOP 5 / 时段分布基于最近 1000 单聚合。</p>'
      : "";

    pcStatsBody.innerHTML = [
      statsCard(periodLabel + "下单时段分布（24h）", renderHourlyChart(s.hourly)),
      statsCard(periodLabel + "最受申请礼品 TOP 5", renderTopList(top, "requested")),
      statsCard("浏览 TOP 10", renderTopList(topViewed, "viewed"), "累计"),
      statsCard("心愿 TOP 10", renderTopList(topWishlisted, "wishlisted"), "未变现意向"),
      statsCard("省份 TOP 5", renderRegionList(dist.provinces), "累计 " + (dist.total || 0) + " 个地址"),
      statsCard("城市 TOP 10", renderRegionList(dist.cities))
    ].join("") + sampleNote;

    // 「数据更新于」放到看板内联消息行
    setStatsMsg("数据更新于 " + formatStatsTimestamp(state.statsLoadedAt), null);
  }

  // ============ 启动 ============

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
