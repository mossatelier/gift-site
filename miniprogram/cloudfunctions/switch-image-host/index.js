// 历史图片迁移已结束，禁止定时任务使用旧快照覆盖商品和配置。
exports.main = async () => ({ ok: true, retired: true, productsFixed: 0, configsFixed: 0 });
