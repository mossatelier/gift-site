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

    if (PANEL_LOADERS[key]) PANEL_LOADERS[key]();
  }

  // 各功能模块把自己的"面板激活时加载"函数注册到这里，
  // 避免每个模块都去改 activatePanel（降低冲突）。
  var PANEL_LOADERS = {
    stats: function () { if (!state.statsLoaded) loadStats(); }
  };

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

  // ============ 编辑礼品（商品列表 / 上下架 / 删除） ============
  //
  // 渲染进 #pcEditPanelBody（html 占位容器）。所有 CRUD 走 AdminCore，
  // 不在此处自写 fetch / 鉴权。前端搜索 + 分类/状态筛选 + 排序 + 50/页分页。

  var EDIT_PAGE_SIZE = 50;

  // 分类下拉来源：config.categories（剔除 all），label 优先用于显示。
  var EDIT_CATEGORIES = (function () {
    var list = (Core.config && Array.isArray(Core.config.categories)) ? Core.config.categories : [];
    return list.filter(function (c) { return c && c.value !== "all"; });
  })();

  function editCategoryLabel(value) {
    for (var i = 0; i < EDIT_CATEGORIES.length; i += 1) {
      if (EDIT_CATEGORIES[i].value === value) return EDIT_CATEGORIES[i].label || value;
    }
    return value || "未分类";
  }

  // 本模块状态挂在共享 state 上（与既有 stats 状态并存，互不影响）。
  state.editProducts = [];      // 原始全量
  state.editSearch = "";        // 搜索关键词
  state.editFilterCat = "all";  // 分类筛选
  state.editFilterStatus = "all"; // 状态筛选 all / active / inactive
  state.editSort = "default";   // default / cards-asc / cards-desc / price-asc / price-desc
  state.editPage = 0;
  state.editPendingId = "";     // 正在执行操作的行（禁用按钮）
  state.editLoaded = false;
  var editSearchTimer = null;

  // 渲染外壳一次（工具栏 + 表格容器 + 分页/消息），后续只重渲染 body。
  function ensureEditShell() {
    var host = document.getElementById("pcEditPanelBody");
    if (!host) return null;
    if (host.getAttribute("data-edit-ready") === "1") return host;

    host.classList.remove("pc-panel-placeholder");
    host.setAttribute("data-edit-ready", "1");

    var catOptions = ['<option value="all">全部分类</option>'].concat(
      EDIT_CATEGORIES.map(function (c) {
        return '<option value="' + escapeHtml(c.value) + '">' + escapeHtml(c.label || c.value) + "</option>";
      })
    ).join("");

    host.innerHTML =
      '<div class="pc-edit-toolbar">'
      + '<input class="pc-edit-search" id="pcEditSearch" type="search" placeholder="搜索标题 / 分类 / 子类 / 描述…" autocomplete="off">'
      + '<select class="pc-edit-select" id="pcEditFilterCat">' + catOptions + "</select>"
      + '<select class="pc-edit-select" id="pcEditFilterStatus">'
      + '<option value="all">全部状态</option>'
      + '<option value="active">已上架</option>'
      + '<option value="inactive">未上架</option>'
      + "</select>"
      + '<span class="pc-edit-count" id="pcEditCount"></span>'
      + '<button class="pc-btn-ghost pc-edit-refresh" id="pcEditRefreshBtn" type="button">刷新</button>'
      + "</div>"
      + '<div class="pc-edit-table-wrap" id="pcEditTableWrap"></div>'
      + '<div class="pc-edit-pager" id="pcEditPager"></div>'
      + '<p class="pc-inline-msg" id="pcEditMsg"></p>';

    // 工具栏交互（一次性绑定）
    var searchEl = document.getElementById("pcEditSearch");
    if (searchEl) {
      searchEl.addEventListener("input", function () {
        if (editSearchTimer) clearTimeout(editSearchTimer);
        editSearchTimer = setTimeout(function () {
          state.editSearch = searchEl.value || "";
          state.editPage = 0;
          renderEditTable();
        }, 300);
      });
    }

    var catEl = document.getElementById("pcEditFilterCat");
    if (catEl) {
      catEl.addEventListener("change", function () {
        state.editFilterCat = catEl.value || "all";
        state.editPage = 0;
        renderEditTable();
      });
    }

    var statusEl = document.getElementById("pcEditFilterStatus");
    if (statusEl) {
      statusEl.addEventListener("change", function () {
        state.editFilterStatus = statusEl.value || "all";
        state.editPage = 0;
        renderEditTable();
      });
    }

    var refreshEl = document.getElementById("pcEditRefreshBtn");
    if (refreshEl) {
      refreshEl.addEventListener("click", function () { loadEditProducts(true); });
    }

    // 表格区交互（事件委托：排序表头 + 行操作 + 分页）
    var tableWrap = document.getElementById("pcEditTableWrap");
    if (tableWrap) {
      tableWrap.addEventListener("click", handleEditTableClick);
    }
    var pager = document.getElementById("pcEditPager");
    if (pager) {
      pager.addEventListener("click", function (event) {
        var btn = event.target.closest("[data-edit-page]");
        if (!btn || btn.disabled) return;
        var p = Number(btn.getAttribute("data-edit-page"));
        if (!isNaN(p)) {
          state.editPage = p;
          renderEditTable();
        }
      });
    }

    return host;
  }

  function setEditMsg(text, tone) {
    var el = document.getElementById("pcEditMsg");
    if (!el) return;
    el.textContent = text || "";
    if (tone) el.dataset.tone = tone;
    else delete el.dataset.tone;
  }

  // 加载（首次或刷新）。force=true 时无视 editLoaded 重新拉取。
  function loadEditProducts(force) {
    var host = ensureEditShell();
    if (!host) return;

    if (!Core.activeSession()) {
      var wrap0 = document.getElementById("pcEditTableWrap");
      if (wrap0) wrap0.innerHTML = '<p class="pc-empty-text">请先登录管理员账号。</p>';
      var count0 = document.getElementById("pcEditCount");
      if (count0) count0.textContent = "";
      return;
    }

    if (state.editLoaded && !force) {
      // 已加载过且非强制：直接重渲染（切回面板不重复请求）。
      renderEditTable();
      return;
    }

    var wrap = document.getElementById("pcEditTableWrap");
    if (wrap) wrap.innerHTML = '<p class="pc-empty-text">加载中…</p>';
    setEditMsg("", null);

    Core.listProducts({ limit: 1000 })
      .then(function (list) {
        state.editProducts = Array.isArray(list) ? list : [];
        state.editLoaded = true;
        state.editPendingId = "";
        state.editPage = 0;
        renderEditTable();
      })
      .catch(function (err) {
        if (wrap) wrap.innerHTML = '<p class="pc-empty-text">' + escapeHtml((err && err.message) || "加载失败") + "</p>";
        var c = document.getElementById("pcEditCount");
        if (c) c.textContent = "";
      });
  }

  // 应用搜索 + 分类 + 状态筛选，返回过滤后的数组。
  function filteredEditProducts() {
    var keyword = (state.editSearch || "").trim().toLowerCase();
    var cat = state.editFilterCat;
    var status = state.editFilterStatus;

    return state.editProducts.filter(function (item) {
      if (cat !== "all" && item.category !== cat) return false;
      if (status === "active" && !item.is_active) return false;
      if (status === "inactive" && item.is_active) return false;
      if (keyword) {
        var hay = [
          item.title || "",
          editCategoryLabel(item.category),
          item.subcategory || "",
          item.description || ""
        ].join(" ").toLowerCase();
        if (hay.indexOf(keyword) === -1) return false;
      }
      return true;
    });
  }

  // 排序（在过滤后的副本上）。default 保持 listProducts 返回顺序。
  function sortedEditProducts(rows) {
    var s = state.editSort;
    if (s === "default") return rows;
    var copy = rows.slice();
    var cardsOf = function (p) { return Number(p.cards_needed != null ? p.cards_needed : p.price) || 0; };
    var priceOf = function (p) { return Number(p.price) || 0; };
    copy.sort(function (a, b) {
      if (s === "cards-asc") return cardsOf(a) - cardsOf(b);
      if (s === "cards-desc") return cardsOf(b) - cardsOf(a);
      if (s === "price-asc") return priceOf(a) - priceOf(b);
      if (s === "price-desc") return priceOf(b) - priceOf(a);
      return 0;
    });
    return copy;
  }

  // 表头排序指示箭头
  function editSortArrow(field) {
    var s = state.editSort;
    if (field === "cards") {
      if (s === "cards-asc") return " ↑";
      if (s === "cards-desc") return " ↓";
    }
    if (field === "price") {
      if (s === "price-asc") return " ↑";
      if (s === "price-desc") return " ↓";
    }
    return "";
  }

  function renderEditTable() {
    var wrap = document.getElementById("pcEditTableWrap");
    var countEl = document.getElementById("pcEditCount");
    var pagerEl = document.getElementById("pcEditPager");
    if (!wrap) return;

    if (!state.editLoaded) {
      wrap.innerHTML = '<p class="pc-empty-text">加载中…</p>';
      return;
    }

    var filtered = sortedEditProducts(filteredEditProducts());
    var total = filtered.length;

    if (countEl) countEl.textContent = "共 " + total + " 件";

    if (total === 0) {
      var emptyText = state.editProducts.length === 0
        ? "数据库里还没有礼品。"
        : "没有找到匹配的礼品。";
      wrap.innerHTML = '<p class="pc-empty-text">' + emptyText + "</p>";
      if (pagerEl) pagerEl.innerHTML = "";
      return;
    }

    // 分页裁剪
    var pageCount = Math.ceil(total / EDIT_PAGE_SIZE);
    if (state.editPage >= pageCount) state.editPage = pageCount - 1;
    if (state.editPage < 0) state.editPage = 0;
    var start = state.editPage * EDIT_PAGE_SIZE;
    var pageRows = filtered.slice(start, start + EDIT_PAGE_SIZE);

    var head =
      "<thead><tr>"
      + '<th class="pc-edit-col-img">图</th>'
      + '<th class="pc-edit-col-title">标题</th>'
      + '<th class="pc-edit-col-cat">分类 · 子类</th>'
      + '<th class="pc-edit-col-num pc-edit-sortable" data-edit-sort="price">参考价' + editSortArrow("price") + "</th>"
      + '<th class="pc-edit-col-num pc-edit-sortable" data-edit-sort="cards">兑换积分' + editSortArrow("cards") + "</th>"
      + '<th class="pc-edit-col-status">状态</th>'
      + '<th class="pc-edit-col-actions">操作</th>'
      + "</tr></thead>";

    var body = "<tbody>" + pageRows.map(function (item) {
      var id = escapeHtml(item.id || "");
      var pending = state.editPendingId === item.id;
      var cards = Number(item.cards_needed != null ? item.cards_needed : item.price) || 0;
      var price = Number(item.price) || 0;
      var subLabel = item.subcategory ? " · " + escapeHtml(item.subcategory) : "";
      var statusCls = item.is_active ? "pc-order-status-done" : "pc-order-status-cancelled";
      var statusLabel = item.is_active ? "已上架" : "未上架";
      var toggleLabel = item.is_active ? "下架" : "上架";
      var disabled = pending ? " disabled" : "";
      var img = item.image_url
        ? '<img class="pc-edit-thumb" src="' + escapeHtml(item.image_url) + '" alt="" loading="lazy">'
        : '<span class="pc-edit-thumb pc-edit-thumb-empty"></span>';

      return '<tr class="pc-edit-row" data-edit-row="' + id + '">'
        + '<td class="pc-edit-col-img">' + img + "</td>"
        + '<td class="pc-edit-col-title"><span class="pc-edit-title-text">' + escapeHtml(item.title || "未命名礼品") + "</span></td>"
        + '<td class="pc-edit-col-cat">' + escapeHtml(editCategoryLabel(item.category)) + subLabel + "</td>"
        + '<td class="pc-edit-col-num">' + (price ? "¥" + escapeHtml(price) : "—") + "</td>"
        + '<td class="pc-edit-col-num pc-edit-cards">' + escapeHtml(cards) + " 分</td>"
        + '<td class="pc-edit-col-status"><span class="pc-order-status ' + statusCls + '">' + statusLabel + "</span></td>"
        + '<td class="pc-edit-col-actions">'
        + '<button class="pc-edit-act pc-edit-act-edit" type="button" data-edit-edit="' + id + '"' + disabled + ">编辑</button>"
        + '<button class="pc-edit-act pc-edit-act-toggle" type="button" data-edit-toggle="' + id + '"' + disabled + ">" + toggleLabel + "</button>"
        + '<button class="pc-edit-act pc-edit-act-del" type="button" data-edit-del="' + id + '"' + disabled + ">删除</button>"
        + "</td>"
        + "</tr>";
    }).join("") + "</tbody>";

    wrap.innerHTML = '<table class="pc-edit-table">' + head + body + "</table>";

    // 分页
    if (pagerEl) {
      if (pageCount <= 1) {
        pagerEl.innerHTML = "";
      } else {
        var prevDis = state.editPage <= 0 ? " disabled" : "";
        var nextDis = state.editPage >= pageCount - 1 ? " disabled" : "";
        pagerEl.innerHTML =
          '<button class="pc-btn-ghost pc-edit-page-btn" type="button" data-edit-page="' + (state.editPage - 1) + '"' + prevDis + ">上一页</button>"
          + '<span class="pc-edit-page-info">第 ' + (state.editPage + 1) + " / " + pageCount + " 页</span>"
          + '<button class="pc-btn-ghost pc-edit-page-btn" type="button" data-edit-page="' + (state.editPage + 1) + '"' + nextDis + ">下一页</button>";
      }
    }
  }

  // 表格点击委托：排序表头 / 编辑 / 上下架 / 删除
  function handleEditTableClick(event) {
    var sortTh = event.target.closest("[data-edit-sort]");
    if (sortTh) {
      var field = sortTh.getAttribute("data-edit-sort");
      // 三态循环：无 → 降序 → 升序 → 无
      if (field === "cards") {
        state.editSort = state.editSort === "cards-desc" ? "cards-asc"
          : state.editSort === "cards-asc" ? "default" : "cards-desc";
      } else if (field === "price") {
        state.editSort = state.editSort === "price-desc" ? "price-asc"
          : state.editSort === "price-asc" ? "default" : "price-desc";
      }
      renderEditTable();
      return;
    }

    var editBtn = event.target.closest("[data-edit-edit]");
    if (editBtn) {
      handleEditProductEdit(editBtn.getAttribute("data-edit-edit"));
      return;
    }

    var toggleBtn = event.target.closest("[data-edit-toggle]");
    if (toggleBtn) {
      handleEditProductToggle(toggleBtn.getAttribute("data-edit-toggle"));
      return;
    }

    var delBtn = event.target.closest("[data-edit-del]");
    if (delBtn) {
      handleEditProductDelete(delBtn.getAttribute("data-edit-del"));
      return;
    }
  }

  function findEditProduct(id) {
    for (var i = 0; i < state.editProducts.length; i += 1) {
      if (state.editProducts[i].id === id) return state.editProducts[i];
    }
    return null;
  }

  // 编辑：跳到「录入礼品」面板并回填（钩子由录入模块暴露为 window.__pcEditProduct）。
  function handleEditProductEdit(id) {
    var p = findEditProduct(id);
    if (!p) { setEditMsg("没有找到要编辑的礼品。", "error"); return; }
    if (typeof window.__pcEditProduct === "function") {
      window.__pcEditProduct(p);
    } else {
      // 录入模块尚未就绪时的兜底（正常情况下不会走到）。
      window.alert("编辑入口暂不可用，请稍后重试。\n\n礼品：" + (p.title || id));
    }
  }

  // 上下架：调 setProductActive，成功后当场切换该行徽标 + 按钮。
  function handleEditProductToggle(id) {
    var p = findEditProduct(id);
    if (!p) { setEditMsg("没有找到要操作的礼品。", "error"); return; }
    if (state.editPendingId) return; // 串行，避免并发误触

    var next = !p.is_active;
    state.editPendingId = id;
    renderEditTable();
    setEditMsg(next ? "正在上架…" : "正在下架…", null);

    Core.setProductActive(id, next)
      .then(function () {
        p.is_active = next;
        state.editPendingId = "";
        renderEditTable();
        setEditMsg(next ? "已上架：" + (p.title || id) : "已下架：" + (p.title || id), "success");
      })
      .catch(function (err) {
        state.editPendingId = "";
        renderEditTable();
        setEditMsg((err && err.message) || "操作失败", "error");
      });
  }

  // 删除：二次确认 → deleteProduct → 行淡出 → 从数据源移除并重渲染。
  function handleEditProductDelete(id) {
    var p = findEditProduct(id);
    if (!p) { setEditMsg("没有找到要删除的礼品。", "error"); return; }
    if (state.editPendingId) return;

    var ok = window.confirm("确定删除“" + (p.title || "这件礼品") + "”吗？删除后不能恢复。");
    if (!ok) return;

    state.editPendingId = id;
    var rowEl = document.querySelector('[data-edit-row="' + (window.CSS && CSS.escape ? CSS.escape(id) : id) + '"]');
    if (rowEl) rowEl.classList.add("pc-edit-row-fading");
    setEditMsg("正在删除…", null);

    Core.deleteProduct(id)
      .then(function () {
        // 从全量数据移除后重渲染（淡出动画时长后）。
        var remove = function () {
          state.editProducts = state.editProducts.filter(function (x) { return x.id !== id; });
          state.editPendingId = "";
          renderEditTable();
          setEditMsg("已删除：" + (p.title || id), "success");
        };
        if (rowEl) setTimeout(remove, 260);
        else remove();
      })
      .catch(function (err) {
        state.editPendingId = "";
        if (rowEl) rowEl.classList.remove("pc-edit-row-fading");
        renderEditTable();
        setEditMsg((err && err.message) || "删除失败", "error");
      });
  }

  // 注册面板加载器：首次进入拉取（editLoaded 标记防重复），切回不重复请求。
  PANEL_LOADERS.edit = function () { loadEditProducts(false); };

  // ============ 银行积分（banks_earn） ============
  //
  // 渲染进 #pcBanksPanelBody（html 占位容器）。读取走 Core.listBanks()，
  // 保存走 Core.saveBankPoints(id, points)，不在此处自写 fetch / 鉴权。
  // 设计：说明条 + 刷新 + 紧凑表格（银行名 / 积分 0-10 / “分”）。
  // 输入框 change/blur 自动保存（无保存按钮）；保存中行尾显示状态（保存中 → ✓）；
  // 越界（<0、>10、非整数）行内红字提示且不发请求；保存成功后按积分降序重排。

  state.banks = [];          // 原始数据（按 points 降序展示）
  state.banksLoaded = false; // 防重复拉取标记
  state.banksSavingId = "";  // 正在保存的行 id（避免并发覆盖重排）

  // 银行行排序：积分降序，再按 sort_order 升序兜底（与移动版 / Core 查询一致）。
  function sortBanks() {
    state.banks.sort(function (a, b) {
      return (Number(b.points) || 0) - (Number(a.points) || 0)
        || (Number(a.sort_order) || 100) - (Number(b.sort_order) || 100);
    });
  }

  // 渲染外壳一次（说明条 + 刷新 + 表格容器 + 消息行），后续只重渲染 body。
  function ensureBanksShell() {
    var host = document.getElementById("pcBanksPanelBody");
    if (!host) return null;
    if (host.getAttribute("data-banks-ready") === "1") return host;

    host.classList.remove("pc-panel-placeholder");
    host.setAttribute("data-banks-ready", "1");

    host.innerHTML =
      '<div class="pc-banks-toolbar">'
      + '<p class="pc-banks-note">设置各银行刷卡 / 消费可累积的积分（0-10 分）。修改输入框后自动保存，无需点按钮；按积分从高到低排列。</p>'
      + '<button class="pc-btn-ghost pc-banks-refresh" id="pcBanksRefreshBtn" type="button">刷新</button>'
      + "</div>"
      + '<div class="pc-banks-table-wrap" id="pcBanksTableWrap"></div>'
      + '<p class="pc-inline-msg" id="pcBanksMsg"></p>';

    var refreshEl = document.getElementById("pcBanksRefreshBtn");
    if (refreshEl) {
      refreshEl.addEventListener("click", function () { loadBanks(true); });
    }

    // 表格区交互（事件委托）：输入框 change/blur 自动保存。
    var tableWrap = document.getElementById("pcBanksTableWrap");
    if (tableWrap) {
      var onEdit = function (event) {
        var input = event.target.closest("[data-bank-id]");
        if (!input) return;
        handleBankPointsChange(input);
      };
      tableWrap.addEventListener("change", onEdit);
      tableWrap.addEventListener("blur", onEdit, true); // blur 不冒泡，捕获阶段委托
    }

    return host;
  }

  function setBanksMsg(text, tone) {
    var el = document.getElementById("pcBanksMsg");
    if (!el) return;
    el.textContent = text || "";
    if (tone) el.dataset.tone = tone;
    else delete el.dataset.tone;
  }

  // 加载（首次或刷新）。force=true 时无视 banksLoaded 重新拉取。
  function loadBanks(force) {
    var host = ensureBanksShell();
    if (!host) return;

    var wrap = document.getElementById("pcBanksTableWrap");

    if (!Core.activeSession()) {
      if (wrap) wrap.innerHTML = '<p class="pc-empty-text">请先登录管理员账号。</p>';
      return;
    }

    if (state.banksLoaded && !force) {
      // 已加载过且非强制：直接重渲染（切回面板不重复请求）。
      renderBanksTable();
      return;
    }

    if (wrap) wrap.innerHTML = '<p class="pc-empty-text">加载中…</p>';
    setBanksMsg("", null);

    Core.listBanks()
      .then(function (list) {
        state.banks = Array.isArray(list) ? list : [];
        sortBanks();
        state.banksLoaded = true;
        state.banksSavingId = "";
        renderBanksTable();
      })
      .catch(function (err) {
        if (wrap) wrap.innerHTML = '<p class="pc-empty-text">' + escapeHtml((err && err.message) || "加载失败") + "</p>";
      });
  }

  function renderBanksTable() {
    var wrap = document.getElementById("pcBanksTableWrap");
    if (!wrap) return;

    if (!state.banksLoaded) {
      wrap.innerHTML = '<p class="pc-empty-text">加载中…</p>';
      return;
    }

    if (!Array.isArray(state.banks) || state.banks.length === 0) {
      wrap.innerHTML = '<p class="pc-empty-text">表中没有银行，请先在 Supabase 里执行 banks-earn-table.sql。</p>';
      return;
    }

    var head =
      "<thead><tr>"
      + '<th class="pc-banks-col-name">银行</th>'
      + '<th class="pc-banks-col-points">积分（0-10）</th>'
      + '<th class="pc-banks-col-state"></th>'
      + "</tr></thead>";

    var body = "<tbody>" + state.banks.map(function (bank) {
      var id = escapeHtml(bank.id || "");
      var points = Number(bank.points) || 0;
      return '<tr class="pc-banks-row" data-banks-row="' + id + '">'
        + '<td class="pc-banks-col-name"><span class="pc-banks-name">' + escapeHtml(bank.name || "未命名银行") + "</span></td>"
        + '<td class="pc-banks-col-points">'
        + '<input class="pc-banks-input" type="number" min="0" max="10" step="1" inputmode="numeric"'
        + ' value="' + escapeHtml(points) + '" data-bank-id="' + id + '">'
        + '<span class="pc-banks-suffix">分</span>'
        + "</td>"
        + '<td class="pc-banks-col-state"><span class="pc-banks-state" data-banks-state="' + id + '"></span></td>'
        + "</tr>";
    }).join("") + "</tbody>";

    wrap.innerHTML = '<table class="pc-banks-table">' + head + body + "</table>";
  }

  // 行尾状态小标（保存中… / ✓ / 错误）。直接定位单元格，避免整表重渲染打断输入焦点。
  function setBankRowState(id, text, tone) {
    var el = document.querySelector('[data-banks-state="' + (window.CSS && CSS.escape ? CSS.escape(id) : id) + '"]');
    if (!el) return;
    el.textContent = text || "";
    if (tone) el.dataset.tone = tone;
    else delete el.dataset.tone;
  }

  // 输入框 change/blur：校验后保存。越界 / 非整数行内红字提示且不发请求。
  function handleBankPointsChange(input) {
    var id = input.getAttribute("data-bank-id");
    if (!id) return;

    var raw = input.value;
    var value = Number(raw);

    // 越界（<0、>10、非整数、空 / 非数字）→ 行内红字，不发请求。
    if (raw === "" || !isFinite(value) || !Number.isInteger(value) || value < 0 || value > 10) {
      setBankRowState(id, "需为 0-10 的整数", "error");
      setBanksMsg("积分必须是 0-10 之间的整数。", "error");
      return;
    }

    var bank = null;
    for (var i = 0; i < state.banks.length; i += 1) {
      if (state.banks[i].id === id) { bank = state.banks[i]; break; }
    }
    if (!bank) return;

    // 未变更则只清状态，不发请求。
    if ((Number(bank.points) || 0) === value) {
      setBankRowState(id, "", null);
      return;
    }

    state.banksSavingId = id;
    setBankRowState(id, "保存中…", null);
    setBanksMsg("正在保存「" + (bank.name || id) + "」…", null);

    Core.saveBankPoints(id, value)
      .then(function () {
        bank.points = value;
        state.banksSavingId = "";
        setBankRowState(id, "✓", "success");
        setBanksMsg("已保存：" + (bank.name || id) + " = " + value + " 分", "success");
        // 保存成功后按积分重排；若顺序变化则重渲染（重渲染会清掉行尾 ✓，可接受）。
        var before = state.banks.slice();
        sortBanks();
        var changed = state.banks.some(function (b, idx) { return b !== before[idx]; });
        if (changed) renderBanksTable();
      })
      .catch(function (err) {
        state.banksSavingId = "";
        setBankRowState(id, "保存失败", "error");
        setBanksMsg((err && err.message) || "保存失败", "error");
      });
  }

  // 注册面板加载器：首次进入拉取（banksLoaded 标记防重复），切回不重复请求。
  PANEL_LOADERS.banks = function () { loadBanks(false); };

  // ============ 分类排序（前台顺序 + 录入下拉顺序） ============
  //
  // 渲染进 #pcCatOrderPanelBody（html 占位容器）。两栏并排：
  //   左栏「📱小程序前台顺序」：存云端。读 callAdminOrders('get-category-order')，
  //     保存 callAdminOrders('save-category-order', { order: [values] })。
  //   右栏「📝后台录入下拉顺序」：存本机 localStorage（与移动版同 key）。
  // 「全部礼品」(all) 概念锁定，不参与排序：分类列表只取实分类。
  // 业务逻辑搬运自移动版 admin.js 的 loadCatOrder / renderCatOrder / orderedInputCategories 等。

  // 录入下拉顺序的 localStorage key —— 与移动版 admin.js 完全一致，两视图共享。
  var CATORDER_INPUT_KEY = "gift-site-admin-input-cat-order";

  // 分类来源：复用编辑模块已计算好的 EDIT_CATEGORIES（已剔除 all），保持单一事实源。
  function catorderRealCategories() {
    return EDIT_CATEGORIES.slice();
  }

  // 读取本机录入顺序（[value, ...]），坏数据兜底为空数组。
  function getInputCatOrder() {
    try {
      var v = JSON.parse(localStorage.getItem(CATORDER_INPUT_KEY) || "[]");
      return Array.isArray(v) ? v : [];
    } catch (e) {
      return [];
    }
  }

  // 按给定的 value 顺序对实分类排序；未出现在 order 里的排到末尾（保持原相对次序）。
  function catorderSortByValues(cats, order) {
    var idx = function (val) {
      var i = order.indexOf(val);
      return i < 0 ? 9999 : i;
    };
    return cats.slice().sort(function (a, b) { return idx(a.value) - idx(b.value); });
  }

  // 本模块状态。catOrder / inputOrder 均为 [{value,label}]（不含 all）。
  state.catOrder = [];          // 左栏：小程序前台顺序（云端）
  state.inputOrder = [];        // 右栏：录入下拉顺序（本机）
  state.catorderDirty = false;  // 左栏未保存脏标
  state.catorderSaving = false; // 左栏保存中（禁用保存按钮）
  state.catorderLoaded = false; // 防重复拉取标记

  // 渲染外壳一次（两栏卡片骨架 + 事件委托），后续只重渲染各列表 body。
  function ensureCatOrderShell() {
    var host = document.getElementById("pcCatOrderPanelBody");
    if (!host) return null;
    if (host.getAttribute("data-catorder-ready") === "1") return host;

    host.classList.remove("pc-panel-placeholder");
    host.setAttribute("data-catorder-ready", "1");

    host.innerHTML =
      '<div class="pc-catorder-grid">'
      // ===== 左栏：小程序前台顺序（云端）=====
      + '<section class="pc-catorder-col">'
      + '<header class="pc-catorder-head">'
      + '<div class="pc-catorder-head-main">'
      + '<h3 class="pc-catorder-title">📱 小程序前台顺序</h3>'
      + '<p class="pc-catorder-note">控制小程序首页分类标签的显示次序（存云端，保存后小程序刷新生效）。</p>'
      + "</div>"
      + '<button class="pc-btn-ghost pc-catorder-refresh" id="pcCatOrderRefreshBtn" type="button">刷新</button>'
      + "</header>"
      + '<div class="pc-catorder-lock">🔒「全部礼品」恒为首位，不参与排序。</div>'
      + '<div class="pc-catorder-list" id="pcCatOrderList"></div>'
      + '<div class="pc-catorder-foot">'
      + '<button class="pc-btn-primary pc-catorder-save" id="pcCatOrderSaveBtn" type="button" disabled>保存到云端</button>'
      + '<span class="pc-inline-msg" id="pcCatOrderMsg"></span>'
      + "</div>"
      + "</section>"
      // ===== 右栏：后台录入下拉顺序（本机）=====
      + '<section class="pc-catorder-col">'
      + '<header class="pc-catorder-head">'
      + '<div class="pc-catorder-head-main">'
      + '<h3 class="pc-catorder-title">📝 后台录入下拉顺序</h3>'
      + '<p class="pc-catorder-note">仅影响本机录入礼品时分类下拉的排列（存本浏览器，常用分类靠前更顺手）。</p>'
      + "</div>"
      + "</header>"
      + '<div class="pc-catorder-list" id="pcInputOrderList"></div>'
      + '<div class="pc-catorder-foot">'
      + '<button class="pc-btn-primary pc-catorder-save" id="pcInputOrderSaveBtn" type="button">保存到本机</button>'
      + '<span class="pc-inline-msg" id="pcInputOrderMsg"></span>'
      + "</div>"
      + "</section>"
      + "</div>";

    // 左栏刷新
    var refreshEl = document.getElementById("pcCatOrderRefreshBtn");
    if (refreshEl) {
      refreshEl.addEventListener("click", function () { loadCatOrder(true); });
    }

    // 左栏列表：↑/↓ 上下移（事件委托）
    var catList = document.getElementById("pcCatOrderList");
    if (catList) {
      catList.addEventListener("click", function (event) {
        var up = event.target.closest("[data-cat-up]");
        var down = event.target.closest("[data-cat-down]");
        if (up) { moveCatOrder(Number(up.getAttribute("data-cat-up")), -1); return; }
        if (down) { moveCatOrder(Number(down.getAttribute("data-cat-down")), 1); return; }
      });
    }

    // 左栏保存
    var saveEl = document.getElementById("pcCatOrderSaveBtn");
    if (saveEl) {
      saveEl.addEventListener("click", saveCatOrder);
    }

    // 右栏列表：↑/↓ 上下移（事件委托）
    var inputList = document.getElementById("pcInputOrderList");
    if (inputList) {
      inputList.addEventListener("click", function (event) {
        var up = event.target.closest("[data-input-up]");
        var down = event.target.closest("[data-input-down]");
        if (up) { moveInputOrder(Number(up.getAttribute("data-input-up")), -1); return; }
        if (down) { moveInputOrder(Number(down.getAttribute("data-input-down")), 1); return; }
      });
    }

    // 右栏保存
    var inputSaveEl = document.getElementById("pcInputOrderSaveBtn");
    if (inputSaveEl) {
      inputSaveEl.addEventListener("click", saveInputOrder);
    }

    return host;
  }

  function setCatOrderMsg(text, tone) {
    var el = document.getElementById("pcCatOrderMsg");
    if (!el) return;
    el.textContent = text || "";
    if (tone) el.dataset.tone = tone;
    else delete el.dataset.tone;
  }

  function setInputOrderMsg(text, tone) {
    var el = document.getElementById("pcInputOrderMsg");
    if (!el) return;
    el.textContent = text || "";
    if (tone) el.dataset.tone = tone;
    else delete el.dataset.tone;
  }

  // 同步左栏保存按钮的可用态（有脏标且非保存中才可点）。
  function syncCatOrderSaveBtn() {
    var btn = document.getElementById("pcCatOrderSaveBtn");
    if (!btn) return;
    btn.disabled = state.catorderSaving || !state.catorderDirty;
    btn.textContent = state.catorderSaving ? "保存中…" : "保存到云端";
  }

  // 渲染一列排序列表（左右共用），kind: "cat" | "input"。
  function renderCatOrderRows(listEl, rows, kind) {
    if (!listEl) return;
    if (!Array.isArray(rows) || rows.length === 0) {
      listEl.innerHTML = '<p class="pc-empty-text">没有可排序的分类。</p>';
      return;
    }
    var upAttr = kind === "cat" ? "data-cat-up" : "data-input-up";
    var downAttr = kind === "cat" ? "data-cat-down" : "data-input-down";
    var last = rows.length - 1;
    listEl.innerHTML = rows.map(function (c, i) {
      var upDis = i === 0 ? " disabled" : "";
      var downDis = i === last ? " disabled" : "";
      return '<div class="pc-catorder-row">'
        + '<span class="pc-catorder-idx">' + (i + 1) + "</span>"
        + '<span class="pc-catorder-name">' + escapeHtml(c.label || c.value) + "</span>"
        + '<span class="pc-catorder-btns">'
        + '<button class="pc-catorder-move" type="button" ' + upAttr + '="' + i + '"' + upDis + ' aria-label="上移">↑</button>'
        + '<button class="pc-catorder-move" type="button" ' + downAttr + '="' + i + '"' + downDis + ' aria-label="下移">↓</button>'
        + "</span>"
        + "</div>";
    }).join("");
  }

  // ----- 左栏：小程序前台顺序（云端） -----

  function loadCatOrder(force) {
    var host = ensureCatOrderShell();
    if (!host) return;

    var listEl = document.getElementById("pcCatOrderList");

    if (!Core.activeSession()) {
      if (listEl) listEl.innerHTML = '<p class="pc-empty-text">请先登录管理员账号。</p>';
      syncCatOrderSaveBtn();
      return;
    }

    if (state.catorderLoaded && !force) {
      // 已加载过且非强制：直接重渲染（切回面板不重复请求，保留未保存的本地调整）。
      renderCatOrderRows(listEl, state.catOrder, "cat");
      syncCatOrderSaveBtn();
      return;
    }

    if (listEl) listEl.innerHTML = '<p class="pc-empty-text">加载中…</p>';
    setCatOrderMsg("", null);

    var real = catorderRealCategories();

    Core.callAdminOrders("get-category-order", {})
      .then(function (data) {
        var order = (data && Array.isArray(data.order)) ? data.order : [];
        state.catOrder = catorderSortByValues(real, order);
        state.catorderLoaded = true;
        state.catorderDirty = false;
        renderCatOrderRows(document.getElementById("pcCatOrderList"), state.catOrder, "cat");
        syncCatOrderSaveBtn();
      })
      .catch(function (err) {
        var el = document.getElementById("pcCatOrderList");
        if (el) el.innerHTML = '<p class="pc-empty-text">' + escapeHtml((err && err.message) || "加载失败") + "</p>";
      });
  }

  // 左栏上下移（dir: -1 上 / +1 下），标记脏。
  function moveCatOrder(from, dir) {
    var to = from + dir;
    var arr = state.catOrder;
    if (isNaN(from) || to < 0 || to >= arr.length) return;
    var item = arr.splice(from, 1)[0];
    arr.splice(to, 0, item);
    state.catorderDirty = true;
    renderCatOrderRows(document.getElementById("pcCatOrderList"), arr, "cat");
    syncCatOrderSaveBtn();
    setCatOrderMsg("有未保存的改动。", null);
  }

  function saveCatOrder() {
    if (state.catorderSaving) return;
    if (!Core.activeSession()) {
      setCatOrderMsg("请先登录管理员账号。", "error");
      return;
    }
    state.catorderSaving = true;
    syncCatOrderSaveBtn();
    setCatOrderMsg("保存中…", null);

    var order = state.catOrder.map(function (c) { return c.value; });

    Core.callAdminOrders("save-category-order", { order: order })
      .then(function () {
        state.catorderSaving = false;
        state.catorderDirty = false;
        syncCatOrderSaveBtn();
        setCatOrderMsg("已保存，小程序刷新后按新顺序显示。", "success");
      })
      .catch(function (err) {
        state.catorderSaving = false;
        syncCatOrderSaveBtn();
        setCatOrderMsg((err && err.message) || "保存失败", "error");
      });
  }

  // ----- 右栏：后台录入下拉顺序（本机 localStorage） -----

  function loadInputOrder() {
    ensureCatOrderShell();
    state.inputOrder = catorderSortByValues(catorderRealCategories(), getInputCatOrder());
    renderCatOrderRows(document.getElementById("pcInputOrderList"), state.inputOrder, "input");
    setInputOrderMsg("", null);
  }

  function moveInputOrder(from, dir) {
    var to = from + dir;
    var arr = state.inputOrder;
    if (isNaN(from) || to < 0 || to >= arr.length) return;
    var item = arr.splice(from, 1)[0];
    arr.splice(to, 0, item);
    renderCatOrderRows(document.getElementById("pcInputOrderList"), arr, "input");
    setInputOrderMsg("有未保存的改动。", null);
  }

  function saveInputOrder() {
    try {
      localStorage.setItem(CATORDER_INPUT_KEY, JSON.stringify(state.inputOrder.map(function (c) { return c.value; })));
      // 本桌面页若已实现录入模块，会读同一 key；这里仅负责持久化。
      setInputOrderMsg("已保存，录入下拉将按新顺序排列。", "success");
    } catch (err) {
      setInputOrderMsg((err && err.message) || "保存失败", "error");
    }
  }

  // 注册面板加载器：首次进入加载（catorderLoaded 标记防云端重复请求），
  // 切回不重复请求但提供刷新按钮；右栏每次进入都读本机 localStorage（廉价）。
  PANEL_LOADERS.catorder = function () {
    loadCatOrder(false);
    loadInputOrder();
  };

  // ============ 晒图审核（reviews） ============
  //
  // 渲染进 #pcReviewsPanelBody（html 占位容器）。读取走
  // Core.callAdminOrders('list-reviews', { status, limit })，处理走
  // Core.callAdminOrders('review-status', { reviewId, status })，不在此处自写 fetch / 鉴权。
  // 设计：工具栏（状态筛选 chip + 刷新 + 计数）+ 响应式网格卡（每条晒图一张卡）+ 点缩略图开灯箱。
  // 业务逻辑搬运自移动版 admin.js 的 loadReviews / renderReviews / moderateReview。

  var REVIEW_STATUS_LABEL = { pending: "待审核", approved: "已通过", rejected: "已拒绝" };
  var REVIEW_STATUS_TABS = [
    { value: "pending", label: "待审核" },
    { value: "approved", label: "已通过" },
    { value: "rejected", label: "已拒绝" },
    { value: "all", label: "全部" }
  ];

  state.reviews = [];            // 当前筛选下的列表
  state.reviewsStatus = "pending"; // 状态筛选
  state.reviewsTotal = 0;        // 计数
  state.reviewsLoaded = false;   // 防重复拉取标记
  state.reviewsPendingId = "";   // 正在处理的卡 id（避免并发误触）

  // 统一取每条晒图的唯一 id（云端可能用 _id 或 id）。
  function reviewId(r) {
    return (r && (r._id || r.id)) || "";
  }

  // 晒图日期：YYYY-MM-DD HH:MM（本机时区即可，与移动版一致）。
  function formatReviewDate(d) {
    if (!d) return "";
    try {
      var date = new Date(d);
      if (isNaN(date.getTime())) return "";
      return date.getFullYear() + "-" + pad2(date.getMonth() + 1) + "-" + pad2(date.getDate())
        + " " + pad2(date.getHours()) + ":" + pad2(date.getMinutes());
    } catch (e) {
      return "";
    }
  }

  // 金色星级（实心 ★ + 空心 ☆，凑满 5 颗）。
  function reviewStarsHtml(rating) {
    var n = Math.max(0, Math.min(5, Math.round(Number(rating) || 0)));
    var solid = new Array(n + 1).join("★");
    var hollow = new Array(5 - n + 1).join("☆");
    return '<span class="pc-reviews-stars">'
      + '<span class="pc-reviews-stars-on">' + solid + "</span>"
      + '<span class="pc-reviews-stars-off">' + hollow + "</span>"
      + "</span>";
  }

  // 渲染外壳一次（工具栏 + 网格容器 + 消息行 + 灯箱），后续只重渲染网格。
  function ensureReviewsShell() {
    var host = document.getElementById("pcReviewsPanelBody");
    if (!host) return null;
    if (host.getAttribute("data-reviews-ready") === "1") return host;

    host.classList.remove("pc-panel-placeholder");
    host.setAttribute("data-reviews-ready", "1");

    var tabs = REVIEW_STATUS_TABS.map(function (t) {
      var active = t.value === state.reviewsStatus ? " active" : "";
      return '<button class="pc-reviews-chip' + active + '" type="button" data-reviews-status="'
        + escapeHtml(t.value) + '">' + escapeHtml(t.label) + "</button>";
    }).join("");

    host.innerHTML =
      '<div class="pc-reviews-toolbar">'
      + '<div class="pc-reviews-tabs" id="pcReviewsTabs">' + tabs + "</div>"
      + '<span class="pc-reviews-count" id="pcReviewsCount"></span>'
      + '<button class="pc-btn-ghost pc-reviews-refresh" id="pcReviewsRefreshBtn" type="button">刷新</button>'
      + "</div>"
      + '<div class="pc-reviews-grid" id="pcReviewsGrid"></div>'
      + '<p class="pc-inline-msg" id="pcReviewsMsg"></p>'
      + '<div class="pc-reviews-lightbox" id="pcReviewsLightbox" hidden>'
      + '<button class="pc-reviews-lb-close" id="pcReviewsLbClose" type="button" aria-label="关闭">×</button>'
      + '<button class="pc-reviews-lb-nav pc-reviews-lb-prev" id="pcReviewsLbPrev" type="button" aria-label="上一张">‹</button>'
      + '<img class="pc-reviews-lb-img" id="pcReviewsLbImg" src="" alt="">'
      + '<button class="pc-reviews-lb-nav pc-reviews-lb-next" id="pcReviewsLbNext" type="button" aria-label="下一张">›</button>'
      + '<span class="pc-reviews-lb-counter" id="pcReviewsLbCounter"></span>'
      + "</div>";

    // 状态筛选 chip 切换
    var tabsEl = document.getElementById("pcReviewsTabs");
    if (tabsEl) {
      tabsEl.addEventListener("click", function (event) {
        var chip = event.target.closest("[data-reviews-status]");
        if (!chip) return;
        var s = chip.getAttribute("data-reviews-status");
        if (!s || s === state.reviewsStatus) return;
        state.reviewsStatus = s;
        Array.prototype.forEach.call(tabsEl.querySelectorAll(".pc-reviews-chip"), function (el) {
          el.classList.toggle("active", el === chip);
        });
        loadReviews(true);
      });
    }

    // 刷新
    var refreshEl = document.getElementById("pcReviewsRefreshBtn");
    if (refreshEl) {
      refreshEl.addEventListener("click", function () { loadReviews(true); });
    }

    // 网格区交互（事件委托）：缩略图开灯箱 / 通过 / 拒绝
    var grid = document.getElementById("pcReviewsGrid");
    if (grid) {
      grid.addEventListener("click", handleReviewsGridClick);
    }

    // 灯箱交互
    bindReviewLightbox();

    return host;
  }

  function setReviewsMsg(text, tone) {
    var el = document.getElementById("pcReviewsMsg");
    if (!el) return;
    el.textContent = text || "";
    if (tone) el.dataset.tone = tone;
    else delete el.dataset.tone;
  }

  // 加载（首次或刷新）。force=true 时无视 reviewsLoaded 重新拉取（切状态 / 点刷新）。
  function loadReviews(force) {
    var host = ensureReviewsShell();
    if (!host) return;

    var grid = document.getElementById("pcReviewsGrid");
    var countEl = document.getElementById("pcReviewsCount");

    if (!Core.activeSession()) {
      if (grid) grid.innerHTML = '<p class="pc-empty-text">请先登录管理员账号。</p>';
      if (countEl) countEl.textContent = "";
      return;
    }

    if (state.reviewsLoaded && !force) {
      // 已加载过且非强制：直接重渲染（切回面板不重复请求）。
      renderReviews();
      return;
    }

    if (grid) grid.innerHTML = '<p class="pc-empty-text">加载中…</p>';
    setReviewsMsg("", null);

    Core.callAdminOrders("list-reviews", { status: state.reviewsStatus, limit: 100 })
      .then(function (data) {
        state.reviews = (data && Array.isArray(data.items)) ? data.items : [];
        state.reviewsTotal = (data && data.total) || 0;
        state.reviewsLoaded = true;
        state.reviewsPendingId = "";
        renderReviews();
      })
      .catch(function (err) {
        if (grid) grid.innerHTML = '<p class="pc-empty-text">' + escapeHtml((err && err.message) || "加载失败") + "</p>";
        if (countEl) countEl.textContent = "";
      });
  }

  function renderReviews() {
    var grid = document.getElementById("pcReviewsGrid");
    var countEl = document.getElementById("pcReviewsCount");
    if (!grid) return;

    if (countEl) countEl.textContent = "共 " + (state.reviewsTotal || 0) + " 条";

    if (!Array.isArray(state.reviews) || state.reviews.length === 0) {
      grid.innerHTML = '<p class="pc-empty-text">没有符合条件的晒图。</p>';
      return;
    }

    grid.innerHTML = state.reviews.map(function (r) {
      var id = escapeHtml(reviewId(r));
      var imgs = Array.isArray(r.imageUrls) ? r.imageUrls.filter(Boolean) : [];
      var statusCls = r.status === "approved" ? "pc-order-status-done"
        : (r.status === "rejected" ? "pc-order-status-cancelled" : "pc-order-status-pending");
      var statusLabel = REVIEW_STATUS_LABEL[r.status] || r.status || "";
      var nick = escapeHtml(r.nickName || "微信用户");
      var avatarChar = escapeHtml((r.nickName || "微").slice(0, 1));
      var pending = reviewId(r) && state.reviewsPendingId === reviewId(r);
      var disabled = pending ? " disabled" : "";

      var thumbs = imgs.length
        ? '<div class="pc-reviews-thumbs">' + imgs.map(function (u, i) {
            return '<button class="pc-reviews-thumb" type="button" data-review-img="' + id + '" data-review-img-idx="' + i + '">'
              + '<img src="' + escapeHtml(u) + '" alt="" loading="lazy">'
              + "</button>";
          }).join("") + "</div>"
        : "";

      var actions = "";
      if (r.status !== "approved") {
        actions += '<button class="pc-reviews-act pc-reviews-act-approve" type="button" data-review-approve="' + id + '"' + disabled + ">通过</button>";
      }
      if (r.status !== "rejected") {
        actions += '<button class="pc-reviews-act pc-reviews-act-reject" type="button" data-review-reject="' + id + '"' + disabled + ">拒绝</button>";
      }

      return '<article class="pc-reviews-card" data-review-card="' + id + '">'
        + '<header class="pc-reviews-card-head">'
        + '<span class="pc-reviews-avatar" aria-hidden="true">' + avatarChar + "</span>"
        + '<div class="pc-reviews-head-main">'
        + '<span class="pc-reviews-nick">' + nick + "</span>"
        + reviewStarsHtml(r.rating)
        + "</div>"
        + '<span class="pc-order-status ' + statusCls + '">' + escapeHtml(statusLabel) + "</span>"
        + "</header>"
        + (r.productTitle ? '<div class="pc-reviews-product">🎁 ' + escapeHtml(r.productTitle) + "</div>" : "")
        + (r.content ? '<div class="pc-reviews-content">' + escapeHtml(r.content) + "</div>" : "")
        + thumbs
        + '<footer class="pc-reviews-card-foot">'
        + '<span class="pc-reviews-date">' + escapeHtml(formatReviewDate(r.createdAt)) + "</span>"
        + '<span class="pc-reviews-actions">' + actions + "</span>"
        + "</footer>"
        + "</article>";
    }).join("");
  }

  // 网格点击委托：缩略图开灯箱 / 通过 / 拒绝
  function handleReviewsGridClick(event) {
    var thumb = event.target.closest("[data-review-img]");
    if (thumb) {
      var rid = thumb.getAttribute("data-review-img");
      var idx = Number(thumb.getAttribute("data-review-img-idx")) || 0;
      openReviewLightbox(rid, idx);
      return;
    }

    var approveBtn = event.target.closest("[data-review-approve]");
    if (approveBtn) {
      if (approveBtn.disabled) return;
      moderateReview(approveBtn.getAttribute("data-review-approve"), "approved");
      return;
    }

    var rejectBtn = event.target.closest("[data-review-reject]");
    if (rejectBtn) {
      if (rejectBtn.disabled) return;
      var rid2 = rejectBtn.getAttribute("data-review-reject");
      if (window.confirm("确认拒绝这条晒图？拒绝后用户端不可见。")) {
        moderateReview(rid2, "rejected");
      }
      return;
    }
  }

  function findReview(id) {
    for (var i = 0; i < state.reviews.length; i += 1) {
      if (reviewId(state.reviews[i]) === id) return state.reviews[i];
    }
    return null;
  }

  // 通过 / 拒绝：调 review-status，成功后该卡淡出移除（或当 all 视图时仅更新徽标）。
  function moderateReview(id, status) {
    if (!id) return;
    if (state.reviewsPendingId) return; // 串行
    var review = findReview(id);
    if (!review) { setReviewsMsg("没有找到要处理的晒图。", "error"); return; }

    state.reviewsPendingId = id;
    // 仅禁用当前卡按钮，不整网格重渲染（保留其它卡的滚动位置）。
    var card = document.querySelector('[data-review-card="' + (window.CSS && CSS.escape ? CSS.escape(id) : id) + '"]');
    if (card) {
      Array.prototype.forEach.call(card.querySelectorAll(".pc-reviews-act"), function (b) { b.disabled = true; });
    }
    setReviewsMsg("处理中…", null);

    Core.callAdminOrders("review-status", { reviewId: id, status: status })
      .then(function () {
        review.status = status;
        state.reviewsPendingId = "";
        // 当前按某状态筛选、且处理后状态不再匹配 → 该卡淡出移除；否则就地更新徽标/按钮。
        var shouldRemove = state.reviewsStatus !== "all" && state.reviewsStatus !== status;
        if (shouldRemove && card) {
          card.classList.add("pc-reviews-card-fading");
          var remove = function () {
            state.reviews = state.reviews.filter(function (x) { return reviewId(x) !== id; });
            if (state.reviewsTotal > 0) state.reviewsTotal -= 1;
            renderReviews();
          };
          setTimeout(remove, 260);
        } else {
          renderReviews();
        }
        setReviewsMsg(status === "approved" ? "已通过，用户端可见。" : "已拒绝。", "success");
      })
      .catch(function (err) {
        state.reviewsPendingId = "";
        if (card) {
          Array.prototype.forEach.call(card.querySelectorAll(".pc-reviews-act"), function (b) { b.disabled = false; });
        }
        setReviewsMsg((err && err.message) || "处理失败", "error");
      });
  }

  // ----- 灯箱（全屏暗遮罩 + 大图 + 左右翻页 + ESC / 点遮罩关） -----

  state.reviewsLb = { imgs: [], index: 0, open: false };

  function bindReviewLightbox() {
    var box = document.getElementById("pcReviewsLightbox");
    if (!box) return;

    // 点遮罩（非图片 / 非翻页按钮）关闭
    box.addEventListener("click", function (event) {
      if (event.target === box) closeReviewLightbox();
    });

    var closeEl = document.getElementById("pcReviewsLbClose");
    if (closeEl) closeEl.addEventListener("click", closeReviewLightbox);

    var prevEl = document.getElementById("pcReviewsLbPrev");
    if (prevEl) prevEl.addEventListener("click", function (e) { e.stopPropagation(); stepReviewLightbox(-1); });

    var nextEl = document.getElementById("pcReviewsLbNext");
    if (nextEl) nextEl.addEventListener("click", function (e) { e.stopPropagation(); stepReviewLightbox(1); });

    // ESC 关闭 / ←→ 翻页（仅灯箱打开时响应）
    document.addEventListener("keydown", function (event) {
      if (!state.reviewsLb.open) return;
      if (event.key === "Escape") { closeReviewLightbox(); }
      else if (event.key === "ArrowLeft") { stepReviewLightbox(-1); }
      else if (event.key === "ArrowRight") { stepReviewLightbox(1); }
    });
  }

  function openReviewLightbox(reviewIdValue, startIndex) {
    var review = findReview(reviewIdValue);
    if (!review) return;
    var imgs = Array.isArray(review.imageUrls) ? review.imageUrls.filter(Boolean) : [];
    if (imgs.length === 0) return;

    state.reviewsLb.imgs = imgs;
    state.reviewsLb.index = Math.max(0, Math.min(imgs.length - 1, Number(startIndex) || 0));
    state.reviewsLb.open = true;

    var box = document.getElementById("pcReviewsLightbox");
    if (box) box.hidden = false;
    renderReviewLightbox();
  }

  function closeReviewLightbox() {
    state.reviewsLb.open = false;
    var box = document.getElementById("pcReviewsLightbox");
    if (box) box.hidden = true;
    var img = document.getElementById("pcReviewsLbImg");
    if (img) img.removeAttribute("src");
  }

  function stepReviewLightbox(dir) {
    var imgs = state.reviewsLb.imgs;
    if (!imgs || imgs.length === 0) return;
    var n = imgs.length;
    state.reviewsLb.index = (state.reviewsLb.index + dir + n) % n;
    renderReviewLightbox();
  }

  function renderReviewLightbox() {
    var imgs = state.reviewsLb.imgs;
    var img = document.getElementById("pcReviewsLbImg");
    var counter = document.getElementById("pcReviewsLbCounter");
    var prevEl = document.getElementById("pcReviewsLbPrev");
    var nextEl = document.getElementById("pcReviewsLbNext");
    if (!img || !imgs || imgs.length === 0) return;

    img.src = imgs[state.reviewsLb.index];
    if (counter) counter.textContent = (state.reviewsLb.index + 1) + " / " + imgs.length;

    // 单图隐藏翻页按钮
    var multi = imgs.length > 1;
    if (prevEl) prevEl.hidden = !multi;
    if (nextEl) nextEl.hidden = !multi;
  }

  // 注册面板加载器：首次进入拉取（reviewsLoaded 标记防重复），切回不重复请求但提供刷新按钮。
  PANEL_LOADERS.reviews = function () { loadReviews(false); };

  // ============ 录入礼品（新建 / 编辑回填） ============
  //
  // 渲染进 #pcCreatePanelBody（html 占位容器）。左右两栏：
  //   左栏（1fr）：表单（标题 / 分类 / 子类 / 参考价 / 兑换积分 / 描述 / 最多 5 张图 / 上架开关）。
  //   右栏（380px sticky）：实时预览卡（主图 / 标题 / 积分 / 参考价）。
  // 所有 CRUD / 图片上传走 AdminCore（createProduct / updateProduct / uploadImage），
  // 不在此处自写 fetch / 鉴权。业务逻辑（价→分换算、图片收集、payload 字段）搬运自移动版 admin.js。
  //
  // 编辑回填：暴露 window.__pcEditProduct(product)，编辑礼品模块的「编辑」按钮调用它即可
  // 跳到本面板并回填，提交时走 updateProduct(id, payload)。

  var CREATE_PRICE_PER_CARD = 40;   // 价格 ÷ 40 ≈ 兑换积分（向上取整、至少 1），与移动版一致。
  var CREATE_MAX_IMAGES = 5;        // 与 AdminCore / 移动版 MAX_PRODUCT_IMAGES 一致。
  var CREATE_INPUT_CAT_KEY = "gift-site-admin-input-cat-order"; // 录入下拉顺序（本机），与分类排序模块共享。

  // 分类来源：复用编辑模块已剔除 all 的 EDIT_CATEGORIES（单一事实源）。
  function createRealCategories() {
    return EDIT_CATEGORIES.slice();
  }

  // 按本机录入顺序排序分类（无记录则按 config 原序）。读 localStorage，坏数据兜底原序。
  function createOrderedCategories() {
    var cats = createRealCategories();
    var order;
    try {
      order = JSON.parse(localStorage.getItem(CREATE_INPUT_CAT_KEY) || "[]");
    } catch (e) {
      order = [];
    }
    if (!Array.isArray(order) || order.length === 0) return cats;
    var idx = function (val) {
      var i = order.indexOf(val);
      return i < 0 ? 9999 : i;
    };
    return cats.slice().sort(function (a, b) { return idx(a.value) - idx(b.value); });
  }

  // config.subcategories 映射（分类 value → [子类名]）。
  function createSubcategoriesFor(catValue) {
    var map = (Core.config && Core.config.subcategories) || {};
    var list = map[catValue];
    return Array.isArray(list) ? list : [];
  }

  // 价格 → 兑换积分（向上取整，至少 1）。价格无效返回空字符串（不强写）。
  function createPriceToCards(price) {
    var p = Number(price) || 0;
    if (p <= 0) return "";
    return Math.max(1, Math.ceil(p / CREATE_PRICE_PER_CARD));
  }

  // 本模块状态。images 为图片槽数组：{ mode: 'file'|'url', url, uploading, error }。
  state.createLoaded = false;     // 外壳是否已建好（防重复建 DOM）。
  state.createEditingId = "";     // 非空 = 编辑态，提交走 updateProduct。
  state.createCardsTouched = false; // 用户是否手改过积分（true 后价格变动不再自动覆盖）。
  state.createSubmitting = false; // 提交中（禁用按钮、防重复提交）。
  state.createUploading = 0;      // 正在上传的图片数（>0 时禁用提交）。
  state.createImages = [];        // 图片槽：[{ url: '', uploading: false }]

  // 渲染外壳一次（左表单骨架 + 右预览卡 + 事件绑定），后续只重渲染图片列表 / 预览。
  function ensureCreateShell() {
    var host = document.getElementById("pcCreatePanelBody");
    if (!host) return null;
    if (host.getAttribute("data-create-ready") === "1") return host;

    host.classList.remove("pc-panel-placeholder");
    host.setAttribute("data-create-ready", "1");

    var catOptions = createOrderedCategories().map(function (c) {
      return '<option value="' + escapeHtml(c.value) + '">' + escapeHtml(c.label || c.value) + "</option>";
    }).join("");

    host.innerHTML =
      '<div class="pc-create-grid">'
      // ===== 左栏：表单 =====
      + '<section class="pc-create-form-col">'
      + '<header class="pc-create-head">'
      + '<h3 class="pc-create-title" id="pcCreateTitleHd">录入礼品</h3>'
      + '<button class="pc-btn-ghost pc-create-back" id="pcCreateBackBtn" type="button" hidden>← 返回编辑列表</button>'
      + '<button class="pc-btn-ghost pc-create-reset" id="pcCreateResetBtn" type="button">清空 / 新建</button>'
      + "</header>"
      + '<form class="pc-create-form" id="pcCreateForm" autocomplete="off" novalidate>'

      + '<label class="pc-create-field">'
      + '<span class="pc-create-label">标题 <i class="pc-create-req">*</i></span>'
      + '<input class="pc-create-input" id="pcCreateTitle" type="text" maxlength="120" placeholder="例如：婴儿推车礼包">'
      + "</label>"

      + '<div class="pc-create-row2">'
      + '<label class="pc-create-field">'
      + '<span class="pc-create-label">分类 <i class="pc-create-req">*</i></span>'
      + '<select class="pc-create-input" id="pcCreateCat">' + catOptions + "</select>"
      + "</label>"
      + '<label class="pc-create-field" id="pcCreateSubField" hidden>'
      + '<span class="pc-create-label">子类</span>'
      + '<select class="pc-create-input" id="pcCreateSub"></select>'
      + "</label>"
      + "</div>"

      + '<div class="pc-create-row2">'
      + '<label class="pc-create-field">'
      + '<span class="pc-create-label">参考价（元）<i class="pc-create-req">*</i></span>'
      + '<input class="pc-create-input" id="pcCreatePrice" type="number" min="0" step="1" inputmode="numeric" placeholder="0">'
      + "</label>"
      + '<label class="pc-create-field">'
      + '<span class="pc-create-label">兑换积分 <i class="pc-create-req">*</i> <span class="pc-create-hint">价格÷40 自动算</span></span>'
      + '<input class="pc-create-input" id="pcCreateCards" type="number" min="1" step="1" inputmode="numeric" placeholder="自动">'
      + "</label>"
      + "</div>"

      + '<label class="pc-create-field">'
      + '<span class="pc-create-label">描述</span>'
      + '<textarea class="pc-create-input pc-create-textarea" id="pcCreateDesc" rows="3" maxlength="2000" placeholder="选填：礼品卖点 / 规格 / 注意事项"></textarea>'
      + "</label>"

      + '<div class="pc-create-field">'
      + '<span class="pc-create-label">图片（最多 ' + CREATE_MAX_IMAGES + ' 张，第一张为主图）<i class="pc-create-req">*</i></span>'
      + '<div class="pc-create-images" id="pcCreateImages"></div>'
      + '<button class="pc-btn-ghost pc-create-addimg" id="pcCreateAddImgBtn" type="button">+ 添加图片</button>'
      + "</div>"

      + '<div class="pc-create-row2">'
      + '<label class="pc-create-field">'
      + '<span class="pc-create-label">排序值（越小越靠前）</span>'
      + '<input class="pc-create-input" id="pcCreateSort" type="number" step="1" inputmode="numeric" placeholder="10" value="10">'
      + "</label>"
      + '<label class="pc-create-field pc-create-switch-field">'
      + '<span class="pc-create-label">上架状态</span>'
      + '<label class="pc-create-switch">'
      + '<input type="checkbox" id="pcCreateActive" checked>'
      + '<span class="pc-create-switch-track"></span>'
      + '<span class="pc-create-switch-text" id="pcCreateActiveText">已上架</span>'
      + "</label>"
      + "</label>"
      + "</div>"

      + '<div class="pc-create-foot">'
      + '<button class="pc-btn-primary pc-create-submit" id="pcCreateSubmitBtn" type="submit">提交新建</button>'
      + '<span class="pc-inline-msg pc-create-msg" id="pcCreateMsg"></span>'
      + "</div>"
      + "</form>"
      + "</section>"

      // ===== 右栏：实时预览卡（sticky） =====
      + '<aside class="pc-create-preview-col">'
      + '<div class="pc-create-preview" id="pcCreatePreview">'
      + '<div class="pc-create-preview-cap">实时预览</div>'
      + '<div class="pc-create-preview-img" id="pcCreatePreviewImg"><span class="pc-create-preview-noimg">暂无主图</span></div>'
      + '<div class="pc-create-preview-body">'
      + '<div class="pc-create-preview-title" id="pcCreatePreviewTitle">礼品标题</div>'
      + '<div class="pc-create-preview-cat" id="pcCreatePreviewCat"></div>'
      + '<div class="pc-create-preview-meta">'
      + '<span class="pc-create-preview-cards" id="pcCreatePreviewCards">— 分</span>'
      + '<span class="pc-create-preview-price" id="pcCreatePreviewPrice"></span>'
      + "</div>"
      + '<div class="pc-create-preview-status" id="pcCreatePreviewStatus"></div>'
      + "</div>"
      + "</div>"
      + "</aside>"
      + "</div>";

    bindCreateEvents();
    return host;
  }

  // 同步分类下拉选项（编辑回填 / 录入顺序变化时调用，保留当前选中值）。
  function refreshCreateCatOptions() {
    var sel = document.getElementById("pcCreateCat");
    if (!sel) return;
    var current = sel.value;
    sel.innerHTML = createOrderedCategories().map(function (c) {
      return '<option value="' + escapeHtml(c.value) + '">' + escapeHtml(c.label || c.value) + "</option>";
    }).join("");
    if (current) sel.value = current;
  }

  // 根据当前分类联动子类下拉（保留 keepValue 若仍合法）。
  function syncCreateSubcategory(keepValue) {
    var catSel = document.getElementById("pcCreateCat");
    var field = document.getElementById("pcCreateSubField");
    var sub = document.getElementById("pcCreateSub");
    if (!catSel || !field || !sub) return;

    var subs = createSubcategoriesFor(catSel.value);
    if (subs.length === 0) {
      field.hidden = true;
      sub.innerHTML = '<option value="">不选</option>';
      sub.value = "";
      return;
    }

    field.hidden = false;
    var opts = ['<option value="">不选</option>'].concat(subs.map(function (s) {
      return '<option value="' + escapeHtml(s) + '">' + escapeHtml(s) + "</option>";
    })).join("");
    sub.innerHTML = opts;
    if (keepValue && subs.indexOf(keepValue) !== -1) {
      sub.value = keepValue;
    } else {
      sub.value = "";
    }
  }

  function setCreateMsg(text, tone) {
    var el = document.getElementById("pcCreateMsg");
    if (!el) return;
    el.textContent = text || "";
    if (tone) el.dataset.tone = tone;
    else delete el.dataset.tone;
  }

  // 轻量 toast（右下角浮层，自动淡出）。无依赖、不污染 html。
  function createToast(text, tone) {
    var box = document.getElementById("pcCreateToast");
    if (!box) {
      box = document.createElement("div");
      box.id = "pcCreateToast";
      box.className = "pc-create-toast";
      document.body.appendChild(box);
    }
    box.textContent = text || "";
    box.setAttribute("data-tone", tone || "success");
    box.classList.add("pc-create-toast-show");
    if (createToast._timer) clearTimeout(createToast._timer);
    createToast._timer = setTimeout(function () {
      box.classList.remove("pc-create-toast-show");
    }, 2600);
  }

  // 绑定表单交互（一次性）。
  function bindCreateEvents() {
    var form = document.getElementById("pcCreateForm");
    var catSel = document.getElementById("pcCreateCat");
    var priceEl = document.getElementById("pcCreatePrice");
    var cardsEl = document.getElementById("pcCreateCards");
    var addImgBtn = document.getElementById("pcCreateAddImgBtn");
    var resetBtn = document.getElementById("pcCreateResetBtn");
    var activeEl = document.getElementById("pcCreateActive");
    var imagesWrap = document.getElementById("pcCreateImages");

    // 分类变化：联动子类 + 刷新预览。
    if (catSel) {
      catSel.addEventListener("change", function () {
        syncCreateSubcategory("");
        renderCreatePreview();
      });
    }

    // 价格变化：未手改过积分时自动算（向上取整，至少 1）。
    if (priceEl) {
      priceEl.addEventListener("input", function () {
        if (!state.createCardsTouched && cardsEl) {
          var v = createPriceToCards(priceEl.value);
          cardsEl.value = v === "" ? "" : String(v);
        }
        renderCreatePreview();
      });
    }

    // 积分手改：打标，之后价格变动不再覆盖；清空则恢复自动。
    if (cardsEl) {
      cardsEl.addEventListener("input", function () {
        state.createCardsTouched = (cardsEl.value || "").trim() !== "";
        renderCreatePreview();
      });
    }

    // 标题 / 描述 / 子类变化 → 刷新预览（事件委托到表单 input/change）。
    if (form) {
      form.addEventListener("input", function (event) {
        var t = event.target;
        if (t && (t.id === "pcCreateTitle" || t.id === "pcCreateDesc")) renderCreatePreview();
      });
      form.addEventListener("submit", handleCreateSubmit);
    }

    // 子类 / 上架开关 change → 刷新预览。
    var subSel = document.getElementById("pcCreateSub");
    if (subSel) subSel.addEventListener("change", renderCreatePreview);
    if (activeEl) {
      activeEl.addEventListener("change", function () {
        var txt = document.getElementById("pcCreateActiveText");
        if (txt) txt.textContent = activeEl.checked ? "已上架" : "未上架";
        renderCreatePreview();
      });
    }

    if (addImgBtn) {
      addImgBtn.addEventListener("click", function () {
        if (state.createImages.length >= CREATE_MAX_IMAGES) {
          setCreateMsg("最多 " + CREATE_MAX_IMAGES + " 张图片。", "error");
          return;
        }
        state.createImages.push({ url: "", uploading: false });
        renderCreateImages();
        renderCreatePreview();
      });
    }

    if (resetBtn) {
      resetBtn.addEventListener("click", function () { resetCreateForm(); });
    }

    // 编辑态「返回编辑列表」：不保存，清空编辑态并切回编辑面板
    var backBtn = document.getElementById("pcCreateBackBtn");
    if (backBtn) {
      backBtn.addEventListener("click", function () {
        resetCreateForm();
        activatePanel("edit");
      });
    }

    // 图片列表交互（事件委托：选文件 / 填 URL / 删除）。
    if (imagesWrap) {
      imagesWrap.addEventListener("change", handleCreateImageChange);
      imagesWrap.addEventListener("input", handleCreateImageInput);
      imagesWrap.addEventListener("click", handleCreateImageClick);
    }
  }

  // 图片槽列表渲染。每槽：序号（主图标记）+ 文件选择 + URL 输入 + 删除。
  function renderCreateImages() {
    var wrap = document.getElementById("pcCreateImages");
    if (!wrap) return;

    if (state.createImages.length === 0) {
      wrap.innerHTML = '<p class="pc-create-img-empty">还没有图片，点下方「+ 添加图片」开始。第一张为主图。</p>';
      syncCreateAddImgBtn();
      return;
    }

    wrap.innerHTML = state.createImages.map(function (slot, i) {
      var primaryTag = i === 0 ? '<span class="pc-create-img-primary">主图</span>' : '<span class="pc-create-img-idx">图' + (i + 1) + "</span>";
      var thumb = slot.url
        ? '<img class="pc-create-img-thumb" src="' + escapeHtml(slot.url) + '" alt="">'
        : '<span class="pc-create-img-thumb pc-create-img-thumb-empty">' + (slot.uploading ? "上传中…" : "无图") + "</span>";
      return '<div class="pc-create-img-slot" data-create-img-slot="' + i + '">'
        + '<div class="pc-create-img-slot-head">' + primaryTag
        + '<button class="pc-create-img-del" type="button" data-create-img-del="' + i + '" aria-label="删除">×</button>'
        + "</div>"
        + thumb
        + '<div class="pc-create-img-inputs">'
        + '<label class="pc-create-img-file-btn">选文件'
        + '<input class="pc-create-img-file" type="file" accept="image/*" data-create-img-file="' + i + '"' + (slot.uploading ? " disabled" : "") + ">"
        + "</label>"
        + '<input class="pc-create-input pc-create-img-url" type="url" placeholder="或粘贴图片 URL" value="' + escapeHtml(slot.url || "") + '" data-create-img-url="' + i + '"' + (slot.uploading ? " disabled" : "") + ">"
        + "</div>"
        + (slot.error ? '<div class="pc-create-img-err">' + escapeHtml(slot.error) + "</div>" : "")
        + "</div>";
    }).join("");

    syncCreateAddImgBtn();
  }

  function syncCreateAddImgBtn() {
    var btn = document.getElementById("pcCreateAddImgBtn");
    if (!btn) return;
    btn.disabled = state.createImages.length >= CREATE_MAX_IMAGES;
  }

  // 选文件：压缩 + 上传（走 AdminCore.uploadImage），得到 URL 写回该槽。
  function handleCreateImageChange(event) {
    var fileInput = event.target.closest("[data-create-img-file]");
    if (!fileInput) return;
    var i = Number(fileInput.getAttribute("data-create-img-file"));
    var slot = state.createImages[i];
    if (!slot) return;

    var file = fileInput.files && fileInput.files[0];
    if (!file) return;

    if (!Core.activeSession()) {
      setCreateMsg("请先登录管理员账号。", "error");
      return;
    }

    slot.uploading = true;
    slot.error = "";
    state.createUploading += 1;
    renderCreateImages();
    syncCreateSubmitBtn();
    setCreateMsg("正在上传第 " + (i + 1) + " 张图片…", null);

    Core.uploadImage(file)
      .then(function (url) {
        slot.url = url;
        slot.uploading = false;
        slot.error = "";
        state.createUploading = Math.max(0, state.createUploading - 1);
        renderCreateImages();
        renderCreatePreview();
        syncCreateSubmitBtn();
        setCreateMsg("第 " + (i + 1) + " 张图片已上传。", "success");
      })
      .catch(function (err) {
        slot.uploading = false;
        slot.error = (err && err.message) || "上传失败";
        state.createUploading = Math.max(0, state.createUploading - 1);
        renderCreateImages();
        syncCreateSubmitBtn();
        setCreateMsg("第 " + (i + 1) + " 张图片上传失败。", "error");
      });
  }

  // 粘贴 / 输入 URL：直接写回该槽（与选文件二选一，后输入者覆盖）。
  function handleCreateImageInput(event) {
    var urlInput = event.target.closest("[data-create-img-url]");
    if (!urlInput) return;
    var i = Number(urlInput.getAttribute("data-create-img-url"));
    var slot = state.createImages[i];
    if (!slot) return;
    slot.url = (urlInput.value || "").trim();
    slot.error = "";
    // 仅更新主图预览，不整列表重渲染（避免打断输入焦点）。
    if (i === 0) renderCreatePreview();
  }

  // 删除图片槽。
  function handleCreateImageClick(event) {
    var delBtn = event.target.closest("[data-create-img-del]");
    if (!delBtn) return;
    var i = Number(delBtn.getAttribute("data-create-img-del"));
    var slot = state.createImages[i];
    if (!slot) return;
    if (slot.uploading) { setCreateMsg("图片上传中，请稍候再删除。", "error"); return; }
    state.createImages.splice(i, 1);
    renderCreateImages();
    renderCreatePreview();
  }

  // 实时预览卡：标题 / 主图 / 积分 / 参考价 / 分类 / 状态。
  function renderCreatePreview() {
    var title = (document.getElementById("pcCreateTitle") || {}).value || "";
    var price = Number((document.getElementById("pcCreatePrice") || {}).value || 0) || 0;
    var cards = (document.getElementById("pcCreateCards") || {}).value || "";
    var catSel = document.getElementById("pcCreateCat");
    var activeEl = document.getElementById("pcCreateActive");
    var mainImg = state.createImages.length ? state.createImages[0].url : "";

    var titleEl = document.getElementById("pcCreatePreviewTitle");
    if (titleEl) titleEl.textContent = title.trim() || "礼品标题";

    var imgBox = document.getElementById("pcCreatePreviewImg");
    if (imgBox) {
      imgBox.innerHTML = mainImg
        ? '<img src="' + escapeHtml(mainImg) + '" alt="">'
        : '<span class="pc-create-preview-noimg">暂无主图</span>';
    }

    var cardsEl = document.getElementById("pcCreatePreviewCards");
    if (cardsEl) {
      var cardsVal = cards !== "" ? cards : (price > 0 ? createPriceToCards(price) : "");
      cardsEl.textContent = (cardsVal === "" ? "—" : cardsVal) + " 分";
    }

    var priceEl = document.getElementById("pcCreatePreviewPrice");
    if (priceEl) priceEl.textContent = price > 0 ? "参考价 ¥" + price : "";

    var catEl = document.getElementById("pcCreatePreviewCat");
    if (catEl && catSel) {
      var subSel = document.getElementById("pcCreateSub");
      var subVal = subSel && !document.getElementById("pcCreateSubField").hidden ? subSel.value : "";
      catEl.textContent = editCategoryLabel(catSel.value) + (subVal ? " · " + subVal : "");
    }

    var statusEl = document.getElementById("pcCreatePreviewStatus");
    if (statusEl) {
      var on = activeEl ? activeEl.checked : true;
      statusEl.innerHTML = '<span class="pc-order-status ' + (on ? "pc-order-status-done" : "pc-order-status-cancelled") + '">'
        + (on ? "已上架" : "未上架") + "</span>";
    }
  }

  function syncCreateSubmitBtn() {
    var btn = document.getElementById("pcCreateSubmitBtn");
    if (!btn) return;
    var busy = state.createSubmitting || state.createUploading > 0;
    btn.disabled = busy;
    btn.textContent = state.createSubmitting
      ? "提交中…"
      : (state.createUploading > 0 ? "图片上传中…" : (state.createEditingId ? "保存修改" : "提交新建"));
  }

  // 切换新建 / 编辑态的标题与按钮文案。
  function syncCreateMode() {
    var hd = document.getElementById("pcCreateTitleHd");
    if (hd) hd.textContent = state.createEditingId ? "编辑礼品" : "录入礼品";
    var backBtn = document.getElementById("pcCreateBackBtn");
    if (backBtn) backBtn.hidden = !state.createEditingId;   // 仅编辑态显示「返回编辑列表」
    syncCreateSubmitBtn();
  }

  // 清空表单回到「新建」态。
  function resetCreateForm() {
    state.createEditingId = "";
    state.createCardsTouched = false;
    state.createImages = [];

    var titleEl = document.getElementById("pcCreateTitle");
    var priceEl = document.getElementById("pcCreatePrice");
    var cardsEl = document.getElementById("pcCreateCards");
    var descEl = document.getElementById("pcCreateDesc");
    var sortEl = document.getElementById("pcCreateSort");
    var catSel = document.getElementById("pcCreateCat");
    var activeEl = document.getElementById("pcCreateActive");
    var activeText = document.getElementById("pcCreateActiveText");

    if (titleEl) titleEl.value = "";
    if (priceEl) priceEl.value = "";
    if (cardsEl) cardsEl.value = "";
    if (descEl) descEl.value = "";
    if (sortEl) sortEl.value = "10";
    if (catSel) {
      var ordered = createOrderedCategories();
      if (ordered.length) catSel.value = ordered[0].value;
    }
    if (activeEl) activeEl.checked = true;
    if (activeText) activeText.textContent = "已上架";

    syncCreateSubcategory("");
    renderCreateImages();
    renderCreatePreview();
    syncCreateMode();
    setCreateMsg("", null);
  }

  // 收集图片 URL（按槽顺序，去空去重，最多 5 张）。第一张为主图。
  function collectCreateImageUrls() {
    var seen = {};
    var out = [];
    state.createImages.forEach(function (slot) {
      var u = (slot && slot.url || "").trim();
      if (u && !seen[u]) {
        seen[u] = true;
        out.push(u);
      }
    });
    return out.slice(0, CREATE_MAX_IMAGES);
  }

  // 提交：校验 → 组 payload（对齐 Supabase products 表）→ create / update → toast + 收尾。
  function handleCreateSubmit(event) {
    event.preventDefault();
    if (state.createSubmitting) return;

    if (!Core.activeSession()) {
      setCreateMsg("请先登录管理员账号。", "error");
      return;
    }
    if (state.createUploading > 0) {
      setCreateMsg("还有图片正在上传，请稍候。", "error");
      return;
    }

    var title = ((document.getElementById("pcCreateTitle") || {}).value || "").trim();
    var category = ((document.getElementById("pcCreateCat") || {}).value || "").trim();
    var subField = document.getElementById("pcCreateSubField");
    var subSel = document.getElementById("pcCreateSub");
    var subcategory = (subField && !subField.hidden && subSel) ? (subSel.value || "").trim() : "";
    var description = ((document.getElementById("pcCreateDesc") || {}).value || "").trim();
    var price = Number((document.getElementById("pcCreatePrice") || {}).value || 0) || 0;
    var cardsRaw = ((document.getElementById("pcCreateCards") || {}).value || "").trim();
    var cards = Number(cardsRaw) || 0;
    var sortOrder = Number((document.getElementById("pcCreateSort") || {}).value || 10);
    var isActive = (document.getElementById("pcCreateActive") || {}).checked !== false;

    // 价格有效但积分留空 → 自动补算（与移动版一致）。
    if (price > 0 && !cards) {
      cards = createPriceToCards(price) || 0;
    }

    if (!title || !category || !price || !cards) {
      setCreateMsg("标题、分类、参考价、兑换积分都是必填项。", "error");
      return;
    }

    var imageUrls = collectCreateImageUrls();
    if (imageUrls.length === 0) {
      setCreateMsg("请至少上传 1 张图片或填 1 个图片 URL。", "error");
      return;
    }

    var payload = {
      title: title,
      category: category,
      subcategory: subcategory || null,
      price: price,
      cards_needed: cards,
      description: description,
      image_url: imageUrls[0],
      images: imageUrls,
      sort_order: isNaN(sortOrder) ? 10 : sortOrder,
      is_active: isActive
    };

    var editingId = state.createEditingId;
    state.createSubmitting = true;
    syncCreateSubmitBtn();
    setCreateMsg(editingId ? "正在保存修改…" : "正在写入礼品…", null);

    var op = editingId
      ? Core.updateProduct(editingId, payload)
      : Core.createProduct(payload);

    op
      .then(function (saved) {
        state.createSubmitting = false;
        // 编辑模块若已加载过列表，更新 / 追加对应行并重渲染，保持两模块一致。
        try {
          syncEditAfterCreate(editingId, saved, payload);
        } catch (e) {}

        if (editingId) {
          createToast("已保存修改：" + title, "success");
          setCreateMsg("已保存。可在「编辑礼品」查看，或继续录入新礼品。", "success");
          resetCreateForm(); // 回到新建态
        } else {
          createToast("已写入礼品：" + title, "success");
          resetCreateForm();
          setCreateMsg("已写入。表单已清空，可继续录入下一件。", "success");
        }
      })
      .catch(function (err) {
        state.createSubmitting = false;
        syncCreateSubmitBtn();
        setCreateMsg((err && err.message) || (editingId ? "保存失败" : "写入失败"), "error");
        createToast((editingId ? "保存失败：" : "写入失败：") + ((err && err.message) || ""), "error");
      });
  }

  // 提交成功后同步编辑模块的内存列表（若已加载），避免切过去看到旧数据。
  function syncEditAfterCreate(editingId, saved, payload) {
    if (!state.editLoaded || !Array.isArray(state.editProducts)) return;
    var row = saved && saved.id ? saved : null;

    if (editingId) {
      for (var i = 0; i < state.editProducts.length; i += 1) {
        if (state.editProducts[i].id === editingId) {
          // 合并：优先用服务端回传，回退到本地 payload。
          state.editProducts[i] = Object.assign({}, state.editProducts[i], payload, row || {});
          break;
        }
      }
    } else if (row) {
      // 新建：插到列表头（与 updated_at.desc 顺序一致）。
      state.editProducts.unshift(Object.assign({}, payload, row));
    }
    // 若编辑面板当前可见，重渲染表格。
    var editHost = document.getElementById("pcEditPanelBody");
    if (editHost && editHost.getAttribute("data-edit-ready") === "1" && typeof renderEditTable === "function") {
      renderEditTable();
    }
  }

  // 编辑回填：载入 product → 切到 create 面板 → 填充表单（图片每张占一槽）。
  function fillCreateForEdit(product) {
    if (!product) return;
    ensureCreateShell();

    state.createEditingId = product.id || "";
    state.createCardsTouched = true; // 编辑态默认尊重已有积分，不自动覆盖。

    refreshCreateCatOptions();

    var titleEl = document.getElementById("pcCreateTitle");
    var priceEl = document.getElementById("pcCreatePrice");
    var cardsEl = document.getElementById("pcCreateCards");
    var descEl = document.getElementById("pcCreateDesc");
    var sortEl = document.getElementById("pcCreateSort");
    var catSel = document.getElementById("pcCreateCat");
    var activeEl = document.getElementById("pcCreateActive");
    var activeText = document.getElementById("pcCreateActiveText");

    if (titleEl) titleEl.value = product.title || "";
    if (catSel) catSel.value = product.category || (createOrderedCategories()[0] || {}).value || "";
    syncCreateSubcategory(product.subcategory || "");
    if (priceEl) priceEl.value = Number(product.price) || "";
    if (cardsEl) {
      var c = Number(product.cards_needed != null ? product.cards_needed : product.price) || 0;
      cardsEl.value = c ? String(c) : "";
    }
    if (descEl) descEl.value = product.description || "";
    if (sortEl) sortEl.value = Number(product.sort_order != null ? product.sort_order : 10);
    if (activeEl) activeEl.checked = product.is_active !== false;
    if (activeText) activeText.textContent = (product.is_active !== false) ? "已上架" : "未上架";

    // 图片：优先 images 数组，回退 image_url；每张一个槽（mode=url）。
    var imgs = [];
    if (Array.isArray(product.images)) {
      imgs = product.images.filter(function (u) { return typeof u === "string" && u.trim(); });
    }
    if (imgs.length === 0 && product.image_url) imgs = [product.image_url];
    state.createImages = imgs.slice(0, CREATE_MAX_IMAGES).map(function (u) {
      return { url: u, uploading: false };
    });

    renderCreateImages();
    renderCreatePreview();
    syncCreateMode();
    setCreateMsg("正在编辑：" + (product.title || product.id || ""), null);
  }

  // 全局钩子：供「编辑礼品」模块的「编辑」按钮调用，跳到本面板并回填。
  window.__pcEditProduct = function (product) {
    activatePanel("create");          // 切面板（会触发 PANEL_LOADERS.create 建外壳）
    fillCreateForEdit(product);        // 回填
  };

  // 注册面板加载器：首次进入建外壳（createLoaded 防重复），切回不重复重建；
  // 提供「清空 / 新建」按钮代替刷新（录入态本无远端数据可拉，分类下拉随时同步本机顺序）。
  PANEL_LOADERS.create = function () {
    var host = ensureCreateShell();
    if (!host) return;
    if (!state.createLoaded) {
      state.createLoaded = true;
      resetCreateForm();
    } else {
      // 切回面板：同步分类下拉（录入顺序可能在「分类排序」里改过），保留当前编辑/录入内容。
      refreshCreateCatOptions();
      renderCreateImages();
      renderCreatePreview();
      syncCreateMode();
    }
  };

  // ============ 申请管理（orders） ============
  //
  // 渲染进 #pcOrdersPanelBody（html 占位容器）。所有读取 / 改状态 / 快递 / 备注
  // 走 Core.callAdminOrders，不在此处自写 fetch / 鉴权。
  // 设计：工具栏（状态筛选 + 搜索 + 计数 + 刷新）+ 订单表格（勾选 / 收件人 / 件数·积分 /
  // 状态徽标 / 下单时间 / 查看）+ 每页 50 分页 + 勾选浮现批量条（全选本页 + 批量改状态）。
  // 点行 → 右侧 ~480px 详情抽屉：收货信息（复制）/ 礼品清单 / 客户备注 / 状态下拉 /
  // 快递（公司 + 单号 + 常用 chip + 自动识别）/ 内部备注。点遮罩 / ESC 关，切行热替换。
  // 业务逻辑搬运自移动版 admin.js 的订单相关函数。

  var ORDERS_PAGE_SIZE = 50;
  var ORDER_STATUS_LABEL = {
    pending: "待处理",
    processing: "处理中",
    done: "已完成",
    cancelled: "已取消"
  };
  // 工具栏状态筛选 tab（含 all）。
  var ORDER_STATUS_TABS = [
    { value: "pending", label: "待处理" },
    { value: "processing", label: "处理中" },
    { value: "done", label: "已完成" },
    { value: "cancelled", label: "已取消" },
    { value: "all", label: "全部" }
  ];
  // 详情抽屉常用快递 chip（点击填公司框）。
  var ORDER_CARRIERS = [
    "京东物流", "中通快递", "申通快递", "圆通速递", "韵达速递", "极兔速递"
  ];

  state.orders = [];                 // 当前页订单
  state.ordersStatus = "pending";    // 状态筛选（pending/processing/done/cancelled/all）
  state.ordersSearch = "";           // 搜索关键词
  state.ordersPage = 0;              // 当前页（0-based）
  state.ordersTotal = 0;            // 当前筛选总数
  state.ordersLoaded = false;        // 防重复拉取标记
  state.ordersSelectedIds = (typeof Set === "function") ? new Set() : null; // 本页勾选集合
  state.ordersDrawerId = "";         // 抽屉当前展示的订单 _id（空 = 关闭）
  state.ordersDrawerSaving = false;  // 抽屉内某操作进行中（禁用对应控件）
  var ordersSearchTimer = null;

  // 订单唯一 id（云端用 _id）。
  function orderId(o) {
    return (o && (o._id || o.id)) || "";
  }

  // 下单时间：YYYY-MM-DD HH:MM（本机时区，与移动版一致）。
  function formatOrderDate(d) {
    if (!d) return "";
    try {
      var date = new Date(d);
      if (isNaN(date.getTime())) return "";
      return date.getFullYear() + "-" + pad2(date.getMonth() + 1) + "-" + pad2(date.getDate())
        + " " + pad2(date.getHours()) + ":" + pad2(date.getMinutes());
    } catch (e) {
      return "";
    }
  }

  // 状态 → 徽标 class。
  function orderStatusCls(status) {
    return "pc-order-status-" + (status || "pending");
  }

  // 输入快递单号时自动识别快递公司（搬运自移动版 admin.js 的 detectCarrier 规则）。
  function detectCarrier(noRaw) {
    var no = String(noRaw || "").trim().toUpperCase();
    if (!no) return "";
    var rules = [
      [/^SF/, "顺丰速运"],
      [/^YT/, "圆通速递"],
      [/^ZTO|^(75|78)\d{10}$/, "中通快递"],
      [/^STO|^(77|468)\d/, "申通快递"],
      [/^YD|^(31|35|43|19|45|46)\d{11}$/, "韵达速递"],
      [/^(JD|JDV|JDX)/, "京东物流"],
      [/^(JT|JTC)/, "极兔速递"],
      [/^HTKY|^A\d/, "百世快递"],
      [/^DBL|^DPK/, "德邦快递"],
      [/^(EMS|E[A-Z])|^11\d{11}$|^9\d{12}$/, "EMS / 邮政"],
      [/^YZ|^10\d{11}$/, "邮政快递包裹"],
      [/^GTO|^(K|G)\d/, "国通快递"]
    ];
    for (var i = 0; i < rules.length; i += 1) {
      if (rules[i][0].test(no)) return rules[i][1];
    }
    return "";
  }

  // CSS.escape 兜底（用于属性选择器）。
  function ordersCssEscape(value) {
    return (window.CSS && CSS.escape) ? CSS.escape(value) : String(value);
  }

  // 渲染外壳一次（工具栏 + 表格容器 + 分页/消息 + 批量条 + 抽屉/遮罩），后续只重渲染内容。
  function ensureOrdersShell() {
    var host = document.getElementById("pcOrdersPanelBody");
    if (!host) return null;
    if (host.getAttribute("data-orders-ready") === "1") return host;

    host.classList.remove("pc-panel-placeholder");
    host.setAttribute("data-orders-ready", "1");

    var tabs = ORDER_STATUS_TABS.map(function (t) {
      var active = t.value === state.ordersStatus ? " active" : "";
      return '<button class="pc-orders-chip' + active + '" type="button" data-orders-status="'
        + escapeHtml(t.value) + '">' + escapeHtml(t.label) + "</button>";
    }).join("");

    var bulkStatusOptions = ['<option value="">批量改为…</option>'].concat(
      Object.keys(ORDER_STATUS_LABEL).map(function (s) {
        return '<option value="' + escapeHtml(s) + '">' + escapeHtml(ORDER_STATUS_LABEL[s]) + "</option>";
      })
    ).join("");

    host.innerHTML =
      '<div class="pc-orders-toolbar">'
      + '<div class="pc-orders-tabs" id="pcOrdersTabs">' + tabs + "</div>"
      + '<input class="pc-orders-search" id="pcOrdersSearch" type="search" placeholder="搜索收件人 / 手机号 / 订单号…" autocomplete="off">'
      + '<span class="pc-orders-count" id="pcOrdersCount"></span>'
      + '<button class="pc-btn-ghost pc-orders-refresh" id="pcOrdersRefreshBtn" type="button">刷新</button>'
      + "</div>"
      + '<div class="pc-orders-table-wrap" id="pcOrdersTableWrap"></div>'
      + '<div class="pc-orders-pager" id="pcOrdersPager"></div>'
      + '<p class="pc-inline-msg" id="pcOrdersMsg"></p>'
      // 批量条（勾选后浮现）
      + '<div class="pc-orders-bulkbar" id="pcOrdersBulkBar" hidden>'
      + '<label class="pc-orders-bulk-selall"><input type="checkbox" id="pcOrdersSelectAll"> 全选本页</label>'
      + '<span class="pc-orders-bulk-count" id="pcOrdersSelectedCount">已选 0 单</span>'
      + '<select class="pc-orders-bulk-select" id="pcOrdersBulkStatus">' + bulkStatusOptions + "</select>"
      + '<button class="pc-btn-primary pc-orders-bulk-apply" id="pcOrdersBulkApply" type="button">应用</button>'
      + '<button class="pc-btn-ghost pc-orders-bulk-clear" id="pcOrdersBulkClear" type="button">清空</button>'
      + "</div>"
      // 详情抽屉（遮罩 + 右侧面板）
      + '<div class="pc-orders-drawer-mask" id="pcOrdersDrawerMask" hidden></div>'
      + '<aside class="pc-orders-drawer" id="pcOrdersDrawer" hidden>'
      + '<header class="pc-orders-drawer-head">'
      + '<span class="pc-orders-drawer-title" id="pcOrdersDrawerTitle">订单详情</span>'
      + '<button class="pc-orders-drawer-close" id="pcOrdersDrawerClose" type="button" aria-label="关闭">×</button>'
      + "</header>"
      + '<div class="pc-orders-drawer-body" id="pcOrdersDrawerBody"></div>'
      + "</aside>";

    // 状态筛选 chip 切换 → 清空勾选、回首页、重拉。
    var tabsEl = document.getElementById("pcOrdersTabs");
    if (tabsEl) {
      tabsEl.addEventListener("click", function (event) {
        var chip = event.target.closest("[data-orders-status]");
        if (!chip) return;
        var s = chip.getAttribute("data-orders-status");
        if (!s || s === state.ordersStatus) return;
        state.ordersStatus = s;
        state.ordersPage = 0;
        ordersClearSelection();
        Array.prototype.forEach.call(tabsEl.querySelectorAll(".pc-orders-chip"), function (el) {
          el.classList.toggle("active", el === chip);
        });
        loadOrders(true);
      });
    }

    // 搜索（防抖）→ 清空勾选、回首页、重拉。
    var searchEl = document.getElementById("pcOrdersSearch");
    if (searchEl) {
      searchEl.addEventListener("input", function () {
        if (ordersSearchTimer) clearTimeout(ordersSearchTimer);
        ordersSearchTimer = setTimeout(function () {
          state.ordersSearch = searchEl.value || "";
          state.ordersPage = 0;
          ordersClearSelection();
          loadOrders(true);
        }, 300);
      });
    }

    // 刷新（强制重拉当前页）。
    var refreshEl = document.getElementById("pcOrdersRefreshBtn");
    if (refreshEl) {
      refreshEl.addEventListener("click", function () { loadOrders(true); });
    }

    // 表格区交互（事件委托）：勾选框 / 行点击开抽屉 / 分页。
    var tableWrap = document.getElementById("pcOrdersTableWrap");
    if (tableWrap) {
      tableWrap.addEventListener("click", handleOrdersTableClick);
      tableWrap.addEventListener("change", handleOrdersTableChange);
    }
    var pager = document.getElementById("pcOrdersPager");
    if (pager) {
      pager.addEventListener("click", function (event) {
        var btn = event.target.closest("[data-orders-page]");
        if (!btn || btn.disabled) return;
        var p = Number(btn.getAttribute("data-orders-page"));
        if (!isNaN(p)) {
          state.ordersPage = p;
          ordersClearSelection();
          closeOrdersDrawer();
          loadOrders(true);
        }
      });
    }

    // 批量条交互。
    var selectAll = document.getElementById("pcOrdersSelectAll");
    if (selectAll) {
      selectAll.addEventListener("change", function () {
        if (!state.ordersSelectedIds) return;
        if (selectAll.checked) {
          state.orders.forEach(function (o) { state.ordersSelectedIds.add(orderId(o)); });
        } else {
          state.orders.forEach(function (o) { state.ordersSelectedIds.delete(orderId(o)); });
        }
        // 同步行内勾选框，不整表重渲染。
        var wrap = document.getElementById("pcOrdersTableWrap");
        if (wrap) {
          Array.prototype.forEach.call(wrap.querySelectorAll("[data-orders-select]"), function (box) {
            box.checked = state.ordersSelectedIds.has(box.getAttribute("data-orders-select"));
          });
        }
        updateOrdersBulkBar();
      });
    }
    var bulkApply = document.getElementById("pcOrdersBulkApply");
    if (bulkApply) bulkApply.addEventListener("click", handleOrdersBulkUpdate);
    var bulkClear = document.getElementById("pcOrdersBulkClear");
    if (bulkClear) {
      bulkClear.addEventListener("click", function () {
        ordersClearSelection();
        var bs = document.getElementById("pcOrdersBulkStatus");
        if (bs) bs.value = "";
        syncOrdersRowChecks();
        updateOrdersBulkBar();
      });
    }

    // 抽屉关闭：× / 点遮罩 / ESC。
    var closeEl = document.getElementById("pcOrdersDrawerClose");
    if (closeEl) closeEl.addEventListener("click", closeOrdersDrawer);
    var maskEl = document.getElementById("pcOrdersDrawerMask");
    if (maskEl) maskEl.addEventListener("click", closeOrdersDrawer);
    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape" && state.ordersDrawerId) closeOrdersDrawer();
    });

    // 抽屉内交互（事件委托）：复制 / 状态下拉 / 快递 chip / 保存单号 / 保存备注。
    var drawerBody = document.getElementById("pcOrdersDrawerBody");
    if (drawerBody) {
      drawerBody.addEventListener("click", handleOrdersDrawerClick);
      drawerBody.addEventListener("change", handleOrdersDrawerChange);
      drawerBody.addEventListener("input", handleOrdersDrawerInput);
    }

    return host;
  }

  function setOrdersMsg(text, tone) {
    var el = document.getElementById("pcOrdersMsg");
    if (!el) return;
    el.textContent = text || "";
    if (tone) el.dataset.tone = tone;
    else delete el.dataset.tone;
  }

  // 清空勾选集合。
  function ordersClearSelection() {
    if (state.ordersSelectedIds) state.ordersSelectedIds.clear();
  }

  // 加载（首次或强制）。force=true 时无视 ordersLoaded 重新拉取（切筛选 / 翻页 / 刷新）。
  function loadOrders(force) {
    var host = ensureOrdersShell();
    if (!host) return;

    var wrap = document.getElementById("pcOrdersTableWrap");
    var countEl = document.getElementById("pcOrdersCount");

    if (!Core.activeSession()) {
      if (wrap) wrap.innerHTML = '<p class="pc-empty-text">请先登录管理员账号。</p>';
      if (countEl) countEl.textContent = "";
      return;
    }

    if (state.ordersLoaded && !force) {
      // 已加载过且非强制：直接重渲染（切回面板不重复请求）。
      renderOrdersTable();
      return;
    }

    if (wrap) wrap.innerHTML = '<p class="pc-empty-text">加载中…</p>';
    setOrdersMsg("", null);

    var status = state.ordersStatus === "all" ? "" : state.ordersStatus;
    var skip = state.ordersPage * ORDERS_PAGE_SIZE;

    Core.callAdminOrders("list", {
      status: status,
      search: state.ordersSearch,
      limit: ORDERS_PAGE_SIZE,
      skip: skip
    })
      .then(function (data) {
        state.orders = (data && Array.isArray(data.items)) ? data.items : [];
        state.ordersTotal = (data && data.total) || 0;
        state.ordersLoaded = true;

        // 翻到了空页面（该页订单被改状态搬走）→ 回退一页重拉。
        var totalPages = Math.max(1, Math.ceil(state.ordersTotal / ORDERS_PAGE_SIZE));
        if (state.orders.length === 0 && state.ordersPage > 0 && state.ordersPage >= totalPages) {
          state.ordersPage = totalPages - 1;
          loadOrders(true);
          return;
        }
        renderOrdersTable();
      })
      .catch(function (err) {
        if (wrap) wrap.innerHTML = '<p class="pc-empty-text">' + escapeHtml((err && err.message) || "加载失败") + "</p>";
        if (countEl) countEl.textContent = "";
      });
  }

  function renderOrdersTable() {
    var wrap = document.getElementById("pcOrdersTableWrap");
    var countEl = document.getElementById("pcOrdersCount");
    var pagerEl = document.getElementById("pcOrdersPager");
    if (!wrap) return;

    if (!state.ordersLoaded) {
      wrap.innerHTML = '<p class="pc-empty-text">加载中…</p>';
      return;
    }

    if (countEl) countEl.textContent = "当前筛选 " + (state.ordersTotal || 0) + " 单";

    if (!Array.isArray(state.orders) || state.orders.length === 0) {
      wrap.innerHTML = '<p class="pc-empty-text">没有符合条件的订单。</p>';
      if (pagerEl) pagerEl.innerHTML = "";
      updateOrdersBulkBar();
      return;
    }

    var head =
      "<thead><tr>"
      + '<th class="pc-orders-col-check"></th>'
      + '<th class="pc-orders-col-recipient">收件人</th>'
      + '<th class="pc-orders-col-summary">件数 · 积分</th>'
      + '<th class="pc-orders-col-status">状态</th>'
      + '<th class="pc-orders-col-date">下单时间</th>'
      + '<th class="pc-orders-col-view"></th>'
      + "</tr></thead>";

    var body = "<tbody>" + state.orders.map(function (o) {
      var id = orderId(o);
      var idEsc = escapeHtml(id);
      var addr = o.address || {};
      var items = Array.isArray(o.items) ? o.items : [];
      var checked = state.ordersSelectedIds && state.ordersSelectedIds.has(id) ? " checked" : "";
      var isOpen = state.ordersDrawerId === id ? " pc-orders-row-active" : "";
      return '<tr class="pc-orders-row' + isOpen + '" data-orders-row="' + idEsc + '">'
        + '<td class="pc-orders-col-check"><input type="checkbox" class="pc-orders-check" data-orders-select="' + idEsc + '"' + checked + "></td>"
        + '<td class="pc-orders-col-recipient"><span class="pc-orders-recipient">' + escapeHtml(addr.recipient || "(无收件人)") + "</span>"
        + (addr.phone ? '<span class="pc-orders-phone">' + escapeHtml(addr.phone) + "</span>" : "") + "</td>"
        + '<td class="pc-orders-col-summary">' + escapeHtml(items.length) + " 件 · " + escapeHtml(o.totalCards || 0) + " 分</td>"
        + '<td class="pc-orders-col-status"><span class="pc-order-status ' + orderStatusCls(o.status) + '">'
        + escapeHtml(ORDER_STATUS_LABEL[o.status] || o.status || "") + "</span></td>"
        + '<td class="pc-orders-col-date">' + escapeHtml(formatOrderDate(o.createdAt)) + "</td>"
        + '<td class="pc-orders-col-view"><button class="pc-orders-view-btn" type="button" data-orders-view="' + idEsc + '">查看</button></td>'
        + "</tr>";
    }).join("") + "</tbody>";

    wrap.innerHTML = '<table class="pc-orders-table">' + head + body + "</table>";

    // 分页（每页 50）。
    if (pagerEl) {
      var totalPages = Math.max(1, Math.ceil((state.ordersTotal || 0) / ORDERS_PAGE_SIZE));
      var page = state.ordersPage;
      var start = state.ordersTotal === 0 ? 0 : page * ORDERS_PAGE_SIZE + 1;
      var end = Math.min(state.ordersTotal, (page + 1) * ORDERS_PAGE_SIZE);
      var prevDis = page <= 0 ? " disabled" : "";
      var nextDis = page >= totalPages - 1 ? " disabled" : "";
      pagerEl.innerHTML =
        '<button class="pc-btn-ghost pc-orders-page-btn" type="button" data-orders-page="' + (page - 1) + '"' + prevDis + ">‹ 上一页</button>"
        + '<span class="pc-orders-page-info">' + start + "-" + end + " / 共 " + (state.ordersTotal || 0) + " 单 · 第 " + (page + 1) + " / " + totalPages + " 页</span>"
        + '<button class="pc-btn-ghost pc-orders-page-btn" type="button" data-orders-page="' + (page + 1) + '"' + nextDis + ">下一页 ›</button>";
    }

    updateOrdersBulkBar();
  }

  // 同步当前页所有行内勾选框（与 selectedIds 集合一致）。
  function syncOrdersRowChecks() {
    var wrap = document.getElementById("pcOrdersTableWrap");
    if (!wrap) return;
    Array.prototype.forEach.call(wrap.querySelectorAll("[data-orders-select]"), function (box) {
      box.checked = !!(state.ordersSelectedIds && state.ordersSelectedIds.has(box.getAttribute("data-orders-select")));
    });
  }

  // 批量条：仅当本页有订单时显示；同步全选框（全选 / 半选）与已选计数。
  function updateOrdersBulkBar() {
    var bar = document.getElementById("pcOrdersBulkBar");
    if (!bar) return;
    var total = state.orders.length;
    bar.hidden = total === 0;

    var selectedOnPage = state.ordersSelectedIds
      ? state.orders.filter(function (o) { return state.ordersSelectedIds.has(orderId(o)); }).length
      : 0;

    var selectAll = document.getElementById("pcOrdersSelectAll");
    if (selectAll) {
      selectAll.checked = total > 0 && selectedOnPage === total;
      selectAll.indeterminate = selectedOnPage > 0 && selectedOnPage < total;
    }
    var countEl = document.getElementById("pcOrdersSelectedCount");
    if (countEl) {
      var size = state.ordersSelectedIds ? state.ordersSelectedIds.size : 0;
      countEl.textContent = "已选 " + size + " 单";
    }
  }

  // 表格点击委托：行 / 查看按钮 → 开抽屉。
  function handleOrdersTableClick(event) {
    // 勾选框走 change 处理，这里忽略其点击冒泡。
    if (event.target.closest("[data-orders-select]")) {
      event.stopPropagation();
      return;
    }
    var viewBtn = event.target.closest("[data-orders-view]");
    if (viewBtn) {
      openOrdersDrawer(viewBtn.getAttribute("data-orders-view"));
      return;
    }
    var row = event.target.closest("[data-orders-row]");
    if (row) {
      openOrdersDrawer(row.getAttribute("data-orders-row"));
    }
  }

  // 表格 change 委托：行勾选框。
  function handleOrdersTableChange(event) {
    var box = event.target.closest("[data-orders-select]");
    if (!box || !state.ordersSelectedIds) return;
    var id = box.getAttribute("data-orders-select");
    if (box.checked) state.ordersSelectedIds.add(id);
    else state.ordersSelectedIds.delete(id);
    updateOrdersBulkBar();
  }

  function findOrder(id) {
    for (var i = 0; i < state.orders.length; i += 1) {
      if (orderId(state.orders[i]) === id) return state.orders[i];
    }
    return null;
  }

  // 批量改状态：确认 → update-status-bulk → 清空勾选、重拉当前页。
  function handleOrdersBulkUpdate() {
    if (state.ordersDrawerSaving) return;
    var sel = document.getElementById("pcOrdersBulkStatus");
    var status = sel ? sel.value : "";
    if (!status) {
      setOrdersMsg("请选择要改成的状态。", "error");
      return;
    }
    var ids = state.ordersSelectedIds ? Array.prototype.slice.call(state.ordersSelectedIds) : [];
    if (ids.length === 0) {
      setOrdersMsg("请先勾选订单。", "error");
      return;
    }
    if (!window.confirm("确认把 " + ids.length + " 单改为「" + ORDER_STATUS_LABEL[status] + "」？")) return;

    setOrdersMsg("批量更新中…", null);
    Core.callAdminOrders("update-status-bulk", { orderIds: ids, status: status })
      .then(function (res) {
        ordersClearSelection();
        if (sel) sel.value = "";
        var updated = (res && res.updated != null) ? res.updated : ids.length;
        var failed = (res && res.failed) || 0;
        setOrdersMsg("成功 " + updated + " 单，失败 " + failed + " 单。", "success");
        closeOrdersDrawer();
        loadOrders(true);
      })
      .catch(function (err) {
        setOrdersMsg((err && err.message) || "批量更新失败", "error");
      });
  }

  // ----- 详情抽屉 -----

  // 礼品清单 HTML（图 + 标题 + 积分×数量）。
  function ordersItemsHtml(items) {
    if (!Array.isArray(items) || items.length === 0) {
      return '<p class="pc-orders-empty-line">（无礼品明细）</p>';
    }
    return '<div class="pc-orders-items">' + items.map(function (it) {
      var img = it.imageUrl
        ? '<img class="pc-orders-item-img" src="' + escapeHtml(it.imageUrl) + '" alt="" loading="lazy">'
        : '<span class="pc-orders-item-img pc-orders-item-img-empty"></span>';
      return '<div class="pc-orders-item">' + img
        + '<div class="pc-orders-item-body">'
        + '<span class="pc-orders-item-title">' + escapeHtml(it.title || "") + "</span>"
        + '<span class="pc-orders-item-meta">' + escapeHtml(it.cardsNeeded || 0) + " 积分 × " + escapeHtml(it.qty || 1) + "</span>"
        + "</div></div>";
    }).join("") + "</div>";
  }

  // 抽屉内容（热替换，不重建外壳 / 不重绑事件）。
  function renderOrdersDrawerBody(o) {
    var body = document.getElementById("pcOrdersDrawerBody");
    if (!body) return;
    if (!o) {
      body.innerHTML = '<p class="pc-empty-text">订单已不在当前列表，请刷新。</p>';
      return;
    }

    var id = orderId(o);
    var idEsc = escapeHtml(id);
    var addr = o.address || {};

    var statusSelect = '<select class="pc-orders-status-select" data-orders-status-select="' + idEsc + '">'
      + Object.keys(ORDER_STATUS_LABEL).map(function (s) {
        return '<option value="' + escapeHtml(s) + '"' + (s === o.status ? " selected" : "") + ">"
          + escapeHtml(ORDER_STATUS_LABEL[s]) + "</option>";
      }).join("")
      + "</select>";

    var carrierChips = ORDER_CARRIERS.map(function (c) {
      return '<button class="pc-orders-carrier-chip" type="button" data-orders-carrier="' + escapeHtml(c) + '">'
        + escapeHtml(c) + "</button>";
    }).join("");

    body.innerHTML =
      // 收货信息（一键复制）
      '<section class="pc-orders-sec">'
      + '<div class="pc-orders-sec-head"><strong>收货信息</strong>'
      + '<button class="pc-orders-copy-btn" type="button" data-orders-copy="' + idEsc + '">复制</button></div>'
      + '<p class="pc-orders-addr-line">' + escapeHtml(addr.recipient || "") + "　" + escapeHtml(addr.phone || "") + "</p>"
      + '<p class="pc-orders-addr-line">' + escapeHtml(addr.province || "") + " " + escapeHtml(addr.city || "") + " "
      + escapeHtml(addr.district || "") + " " + escapeHtml(addr.detail || "") + "</p>"
      + "</section>"
      // 礼品清单
      + '<section class="pc-orders-sec">'
      + '<div class="pc-orders-sec-head"><strong>礼品清单</strong></div>'
      + ordersItemsHtml(o.items)
      + "</section>"
      // 客户备注
      + (o.remark
        ? '<section class="pc-orders-sec"><div class="pc-orders-sec-head"><strong>客户备注</strong></div>'
          + '<p class="pc-orders-remark">' + escapeHtml(o.remark) + "</p></section>"
        : "")
      // 订单号
      + '<section class="pc-orders-sec">'
      + '<div class="pc-orders-sec-head"><strong>订单号</strong></div>'
      + '<p class="pc-orders-id">' + idEsc + "</p>"
      + "</section>"
      // 状态
      + '<section class="pc-orders-sec">'
      + '<div class="pc-orders-sec-head"><strong>更新状态</strong></div>'
      + statusSelect
      + "</section>"
      // 快递
      + '<section class="pc-orders-sec">'
      + '<div class="pc-orders-sec-head"><strong>快递单号</strong></div>'
      + '<div class="pc-orders-tracking-row">'
      + '<input class="pc-orders-input pc-orders-tracking-company" type="text" placeholder="快递公司（可选）" value="'
      + escapeHtml(o.trackingCompany || "") + '" data-orders-tracking-company="' + idEsc + '">'
      + '<input class="pc-orders-input pc-orders-tracking-no" type="text" placeholder="快递单号" value="'
      + escapeHtml(o.trackingNo || "") + '" data-orders-tracking-no="' + idEsc + '">'
      + "</div>"
      + '<div class="pc-orders-carrier-chips"><span class="pc-orders-carrier-label">常用：</span>' + carrierChips + "</div>"
      + '<button class="pc-btn-primary pc-orders-tracking-save" type="button" data-orders-save-tracking="' + idEsc + '">保存单号</button>'
      + "</section>"
      // 内部备注（客户不可见）
      + '<section class="pc-orders-sec">'
      + '<div class="pc-orders-sec-head"><strong>商家内部备注</strong><span class="pc-orders-sec-hint">仅你可见，客户看不到</span></div>'
      + '<input class="pc-orders-input pc-orders-note-input" type="text" placeholder="例如：客户已电话确认 / 等下卡" value="'
      + escapeHtml(o.adminNote || "") + '" data-orders-note="' + idEsc + '">'
      + '<button class="pc-btn-ghost pc-orders-note-save" type="button" data-orders-save-note="' + idEsc + '">保存备注</button>'
      + "</section>"
      // 抽屉内联消息
      + '<p class="pc-inline-msg" id="pcOrdersDrawerMsg"></p>';
  }

  function setOrdersDrawerMsg(text, tone) {
    var el = document.getElementById("pcOrdersDrawerMsg");
    if (!el) return;
    el.textContent = text || "";
    if (tone) el.dataset.tone = tone;
    else delete el.dataset.tone;
  }

  // 打开抽屉（或热替换内容，切换行高亮）。
  function openOrdersDrawer(id) {
    var o = findOrder(id);
    if (!o) return;
    state.ordersDrawerId = id;

    var drawer = document.getElementById("pcOrdersDrawer");
    var mask = document.getElementById("pcOrdersDrawerMask");
    var titleEl = document.getElementById("pcOrdersDrawerTitle");
    if (titleEl) {
      var addr = o.address || {};
      titleEl.textContent = (addr.recipient || "订单") + " · " + (ORDER_STATUS_LABEL[o.status] || o.status || "");
    }
    renderOrdersDrawerBody(o);

    if (mask) mask.hidden = false;
    if (drawer) {
      drawer.hidden = false;
      // 触发进入动画（下一帧加 open class）。
      requestAnimationFrame(function () { drawer.classList.add("pc-orders-drawer-open"); });
    }
    // 行高亮：清旧、点新。
    var wrap = document.getElementById("pcOrdersTableWrap");
    if (wrap) {
      Array.prototype.forEach.call(wrap.querySelectorAll(".pc-orders-row-active"), function (r) {
        r.classList.remove("pc-orders-row-active");
      });
      var rowEl = wrap.querySelector('[data-orders-row="' + ordersCssEscape(id) + '"]');
      if (rowEl) rowEl.classList.add("pc-orders-row-active");
    }
  }

  function closeOrdersDrawer() {
    state.ordersDrawerId = "";
    var drawer = document.getElementById("pcOrdersDrawer");
    var mask = document.getElementById("pcOrdersDrawerMask");
    if (drawer) {
      drawer.classList.remove("pc-orders-drawer-open");
      // 动画结束后隐藏（与 CSS transition 时长一致）。
      setTimeout(function () {
        if (!state.ordersDrawerId) drawer.hidden = true;
      }, 240);
    }
    if (mask) mask.hidden = true;
    var wrap = document.getElementById("pcOrdersTableWrap");
    if (wrap) {
      Array.prototype.forEach.call(wrap.querySelectorAll(".pc-orders-row-active"), function (r) {
        r.classList.remove("pc-orders-row-active");
      });
    }
  }

  // 抽屉点击委托：复制 / 快递 chip / 保存单号 / 保存备注。
  function handleOrdersDrawerClick(event) {
    var copyBtn = event.target.closest("[data-orders-copy]");
    if (copyBtn) {
      copyOrderAddress(copyBtn.getAttribute("data-orders-copy"));
      return;
    }
    var chip = event.target.closest("[data-orders-carrier]");
    if (chip) {
      var companyInput = document.querySelector("[data-orders-tracking-company]");
      if (companyInput) {
        companyInput.value = chip.getAttribute("data-orders-carrier");
        delete companyInput.dataset.auto;
      }
      return;
    }
    var saveTracking = event.target.closest("[data-orders-save-tracking]");
    if (saveTracking) {
      handleOrdersTrackingSave(saveTracking.getAttribute("data-orders-save-tracking"));
      return;
    }
    var saveNote = event.target.closest("[data-orders-save-note]");
    if (saveNote) {
      handleOrdersNoteSave(saveNote.getAttribute("data-orders-save-note"));
      return;
    }
  }

  // 抽屉 change 委托：状态下拉 → update-status。
  function handleOrdersDrawerChange(event) {
    var sel = event.target.closest("[data-orders-status-select]");
    if (sel) {
      handleOrdersStatusChange(sel.getAttribute("data-orders-status-select"), sel.value);
    }
  }

  // 抽屉 input 委托：单号自动识别快递公司。
  function handleOrdersDrawerInput(event) {
    var noInput = event.target.closest("[data-orders-tracking-no]");
    if (!noInput) return;
    var companyInput = document.querySelector("[data-orders-tracking-company]");
    if (!companyInput) return;
    var carrier = detectCarrier(noInput.value);
    // 只在公司框为空或之前是自动填的值时覆盖，避免覆盖手填。
    if (carrier && (!companyInput.value || companyInput.dataset.auto === "1")) {
      companyInput.value = carrier;
      companyInput.dataset.auto = "1";
    }
  }

  // 改状态：update-status。过滤态下改成不匹配的状态 → 关抽屉重拉；否则就地更新徽标。
  function handleOrdersStatusChange(id, status) {
    if (!id) return;
    var o = findOrder(id);
    if (!o) return;
    setOrdersDrawerMsg("正在保存…", null);

    Core.callAdminOrders("update-status", { orderId: id, status: status })
      .then(function () {
        if (state.ordersStatus !== "all" && state.ordersStatus !== status) {
          // 改后移出当前筛选 → 关抽屉、重拉（复用分页 / 空页回退）。
          closeOrdersDrawer();
          ordersClearSelection();
          setOrdersMsg("已更新。", "success");
          loadOrders(true);
        } else {
          o.status = status;
          // 就地更新表格该行徽标 + 抽屉标题，不整页重拉。
          renderOrdersTable();
          var titleEl = document.getElementById("pcOrdersDrawerTitle");
          if (titleEl) {
            var addr = o.address || {};
            titleEl.textContent = (addr.recipient || "订单") + " · " + (ORDER_STATUS_LABEL[status] || status);
          }
          setOrdersDrawerMsg("已更新为「" + (ORDER_STATUS_LABEL[status] || status) + "」。", "success");
        }
      })
      .catch(function (err) {
        setOrdersDrawerMsg((err && err.message) || "保存失败", "error");
        // 失败时还原下拉显示。
        var sel = document.querySelector('[data-orders-status-select="' + ordersCssEscape(id) + '"]');
        if (sel) sel.value = o.status;
      });
  }

  // 保存快递：update-tracking，就地写回内存。
  function handleOrdersTrackingSave(id) {
    if (!id) return;
    var o = findOrder(id);
    if (!o) return;
    var noInput = document.querySelector('[data-orders-tracking-no="' + ordersCssEscape(id) + '"]');
    var companyInput = document.querySelector('[data-orders-tracking-company="' + ordersCssEscape(id) + '"]');
    var trackingNo = noInput ? noInput.value.trim() : "";
    var trackingCompany = companyInput ? companyInput.value.trim() : "";
    if (!trackingNo) {
      setOrdersDrawerMsg("请填写快递单号。", "error");
      return;
    }
    setOrdersDrawerMsg("正在保存单号…", null);

    Core.callAdminOrders("update-tracking", { orderId: id, trackingNo: trackingNo, trackingCompany: trackingCompany })
      .then(function () {
        o.trackingNo = trackingNo;
        o.trackingCompany = trackingCompany;
        setOrdersDrawerMsg("单号已保存，用户端即可查看。", "success");
      })
      .catch(function (err) {
        setOrdersDrawerMsg((err && err.message) || "保存失败", "error");
      });
  }

  // 保存内部备注：update-note，就地写回内存。
  function handleOrdersNoteSave(id) {
    if (!id) return;
    var o = findOrder(id);
    if (!o) return;
    var input = document.querySelector('[data-orders-note="' + ordersCssEscape(id) + '"]');
    var adminNote = input ? input.value.trim() : "";
    setOrdersDrawerMsg("正在保存备注…", null);

    Core.callAdminOrders("update-note", { orderId: id, adminNote: adminNote })
      .then(function () {
        o.adminNote = adminNote;
        setOrdersDrawerMsg("备注已保存（仅你可见）。", "success");
      })
      .catch(function (err) {
        setOrdersDrawerMsg((err && err.message) || "保存失败", "error");
      });
  }

  // 复制收件信息（收件人 手机\n省 市 区 详细）。
  function copyOrderAddress(id) {
    var o = findOrder(id);
    if (!o) return;
    var a = o.address || {};
    var text = (a.recipient || "") + " " + (a.phone || "") + "\n"
      + (a.province || "") + " " + (a.city || "") + " " + (a.district || "") + " " + (a.detail || "");
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(
        function () { setOrdersDrawerMsg("已复制收件信息。", "success"); },
        function () { setOrdersDrawerMsg("复制失败，请手动选中。", "error"); }
      );
    } else {
      setOrdersDrawerMsg("当前浏览器不支持自动复制，请手动选中。", "error");
    }
  }

  // 注册面板加载器：首次进入拉取（ordersLoaded 标记防重复），切回不重复请求但提供刷新按钮。
  PANEL_LOADERS.orders = function () { loadOrders(false); };

  // ============ 启动 ============

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
