# 部署：admin.html「申请管理」面板

新功能让你在 admin.html 直接看 / 改用户的礼品申请订单，不用再开云开发控制台。

## 1. 部署 admin-orders 云函数

微信开发者工具 → 右键 `cloudfunctions/admin-orders` → 上传并部署：云端安装依赖

部署完后进云开发控制台 → 云函数 → admin-orders → 函数配置 → 执行超时时间 → 改 **20 秒**（要先调 Supabase 验证 token + 查 admin_users，外部 HTTP 慢一点）。

## 2. 启用 HTTP 触发器

云开发控制台 → 云函数 → admin-orders → 触发管理 → 新建触发器

- 触发器名称：随便（比如 `http`）
- 触发方式：**HTTP 触发器**
- 路径：`/admin-orders`

保存后会显示一个 URL，形如：
```
https://service-xxx-1234567890.gz.apigw.tencentcs.com/release/admin-orders
```

复制这个 URL。

## 3. 把 URL 填进 config.js

打开 `assets/config.js`，找到 `adminOrdersUrl: ""`，填入刚才复制的地址：

```js
adminOrdersUrl: "https://service-xxx-1234567890.gz.apigw.tencentcs.com/release/admin-orders",
```

保存。如果 admin.html 是部署到服务器的（Cloudflare Pages / Vercel 等），把这个变更推上去。

## 4. 验证

1. 浏览器打开 admin.html，登录管理员账号
2. 顶部 tab 应该看到「申请管理」按钮
3. 点进去 → 默认显示「待处理」订单
4. 看见之前小程序里提交的订单
5. 点订单卡片展开 → 看见地址、礼品清单、备注、订单号
6. 改下方的「更新状态」下拉框 → 改成「处理中」→ 应该 toast「已更新」
7. 回到小程序「我的订单」 → 状态立刻变成「处理中」（无延迟）
8. 「复制收件信息」按钮把姓名+电话+地址复制到剪贴板，方便发快递

## 设计说明

- 鉴权：admin.html 调云函数时带 Supabase 的 access_token，云函数把 token 转手去问 Supabase 「这是谁？」 + 查 admin_users 表确认是管理员才放行
- 数据：订单写读都在云开发 orders 集合，admin 改状态后小程序立刻看到
- HTTP 触发器：腾讯云开发免费版有少量额度，admin 自己用绝对够

## 已知限制

- 状态变化没有通知用户。如果要做，可以加微信订阅消息（用户主动订阅一次后可以推 N 条）
- 没有"已读 / 未读"标记。如果想要，加个 hasNew 字段也不难
- 数据看板里 TOP 5 礼品如果某周期订单数超过 1000 单，是基于最近 1000 单聚合的（admin-orders 内有提示文案）

## 更新（订单分页 / 批量更新 / 数据看板）

如果你之前部署过 admin-orders 老版本，本次新增了 stats / update-status-bulk 两个 action。重新部署 admin-orders 即可，HTTP 触发器和环境变量不用动。

刷新 admin.html 后能看到：
- 「申请管理」tab：每页 50 单 + 上下页 + 行首勾选框 + 批量改状态
- 「数据看板」tab：今日 / 本周 / 本月 / 全部 4 个周期，看用户数、订单数、状态分布、TOP 5 礼品
