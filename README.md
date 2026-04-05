# 礼品站动态商品版

这个版本已经从纯静态商品卡升级成了：

- 前台 `index.html` 动态读取商品
- 后台 `admin.html` 支持手机端录入商品
- 商品图片上传到 Supabase Storage
- 商品信息写入 Supabase 表
- 后台改为 Supabase 管理员登录，不再依赖前端明文口令

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

## 安全收口

现在仓库是公开的，所以前端口令不再算安全方案。要收口，请再做下面几步：

1. 在 Supabase 控制台创建一个管理员用户。
2. 在 SQL Editor 执行 `supabase/hardening.sql`。
3. 把你的管理员邮箱写进 `admin_users` 表。
4. 关闭公开注册，只保留你自己的管理员账号。

推荐顺序：

1. 打开 Authentication。
2. 在 Users 里创建你的管理员账号。
3. 回到 SQL Editor 执行：

```sql
insert into public.admin_users (email, note)
values ('你的管理员邮箱', 'site admin')
on conflict (email) do update
set note = excluded.note;
```

4. 再执行 `supabase/hardening.sql`。
5. 去 Auth 设置里关闭公开注册。

这样之后：

- 前台仍然可以公开读取已上架商品
- 只有登录后的管理员账号可以上传图片、写入商品、读取后台最近商品列表
- 仓库公开也不会再因为前端口令暴露而直接失守

## 第二步：填写前端配置

编辑 `assets/config.js`：

- `supabaseUrl`
- `supabaseAnonKey`
- `productsTable`
- `storageBucket`
- `storageFolder`

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
2. 用 Supabase 管理员邮箱和密码登录
3. 填商品标题、分类、价格、说明
4. 上传图片
5. 提交
6. 刷新前台首页，商品会自动出现

## 当前实现边界

- 已支持新增商品
- 已支持图片上传
- 已支持前台动态读取、分类、搜索、价格排序
- 已支持后台登录体系
- 还没有做商品编辑、删除、批量管理

如果要继续升级，下一步最值得做的是：

1. 管理员登录
2. 商品编辑/下架
3. 订单或线索收集
