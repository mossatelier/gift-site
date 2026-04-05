# 礼品站动态商品版

这个版本已经从纯静态商品卡升级成了：

- 前台 `index.html` 动态读取商品
- 后台 `admin.html` 支持手机端录入商品
- 商品图片上传到 Supabase Storage
- 商品信息写入 Supabase 表

## 目录

- `index.html`：前台展示页
- `admin.html`：手机端商品录入页
- `assets/config.js`：站点配置
- `assets/site.js`：前台动态商品逻辑
- `assets/admin.js`：后台上传和写库逻辑
- `supabase/schema.sql`：Supabase 初始化 SQL

## 第一步：创建 Supabase 项目

1. 打开 Supabase 新建项目。
2. 进入 SQL Editor。
3. 执行 `supabase/schema.sql` 里的 SQL。

执行完以后会得到：

- 一张 `products` 表
- 一个 `product-images` bucket
- 一组 quick start 策略

注意：

- 这套策略是为了先跑通手机上新流程
- 它偏方便，不是严格安全版本
- `admin.html` 不要公开到到处传播
- 后续如果你准备正式公开运营，建议把写入策略改成仅登录管理员可用

## 第二步：填写前端配置

编辑 `assets/config.js`：

- `supabaseUrl`
- `supabaseAnonKey`
- `productsTable`
- `storageBucket`
- `storageFolder`
- 可选 `adminPasscode`

默认表名和 bucket 名已经和 SQL 对齐：

- 表：`products`
- bucket：`product-images`

如果你不填 Supabase 配置，前台仍会显示本地占位商品。

## 第三步：部署

把整个目录一起上传，不要只上传单个文件：

- `index.html`
- `admin.html`
- `assets/`
- `images/`

部署后：

- 前台地址：`/index.html`
- 后台地址：`/admin.html`

## 第四步：手机上新

1. 手机打开 `admin.html`
2. 填商品标题、分类、价格、说明
3. 上传图片
4. 提交
5. 刷新前台首页，商品会自动出现

## 当前实现边界

- 已支持新增商品
- 已支持图片上传
- 已支持前台动态读取、分类、搜索、价格排序
- 还没有做后台登录体系
- 还没有做商品编辑、删除、批量管理

如果要继续升级，下一步最值得做的是：

1. 管理员登录
2. 商品编辑/下架
3. 订单或线索收集
