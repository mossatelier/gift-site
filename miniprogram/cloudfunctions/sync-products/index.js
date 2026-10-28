// 旧 Supabase → CloudBase 同步已退役。
// 商品和银行积分以 CloudBase 后台保存的数据为准；保留无操作入口，
// 即使线上遗留定时触发器或手动调用本函数，也不会覆盖、重建或删除任何数据。
// 部署后请在云开发控制台删除本函数的 sync-every-5-min 定时触发器。
exports.main = async () => ({
  success: true,
  retired: true,
  products: { skipped: true, reason: 'cloudbase-managed' },
  banks: { skipped: true, reason: 'cloudbase-managed' }
});
