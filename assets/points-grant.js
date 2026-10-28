(function (root) {
  'use strict';
  const busy = new Set();
  root.PointsGrant = {
    async run(openid, name, call) {
      if (!openid) throw Error('这个用户还没有微信身份');
      if (busy.has(openid)) return null;
      busy.add(openid);
      const key = 'pending-points-grant:' + openid;
      try {
        let pending = JSON.parse(localStorage.getItem(key) || 'null');
        if (pending) {
          if (!window.confirm('上次发放 ' + pending.amount + ' 分的结果尚未确认。是否重试确认？不会重复发放。')) return null;
        } else {
          const value = window.prompt('给「' + (name || '该用户') + '」手动发放积分（正整数）：', '');
          if (value === null) return null;
          const amount = Number(value);
          if (!Number.isSafeInteger(amount) || amount <= 0) throw Error('积分数额必须是正整数');
          const note = window.prompt('备注一下原因（可留空）：', '');
          if (note === null) return null;
          const bytes = crypto.getRandomValues(new Uint8Array(16));
          pending = { openid, amount, note, operationId: Array.from(bytes, n => n.toString(16).padStart(2, '0')).join('') };
          localStorage.setItem(key, JSON.stringify(pending));
        }
        try { await call('points-grant-v2', pending); }
        catch (e) {
          if (/未知 action/.test(e.message || '')) throw Error('积分服务尚未升级，请先部署最新 admin-orders 云函数，再重试本笔发放');
          throw e;
        }
        localStorage.removeItem(key);
        return pending.amount;
      } finally { busy.delete(openid); }
    }
  };
})(window);
