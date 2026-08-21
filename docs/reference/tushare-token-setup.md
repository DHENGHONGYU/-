---
title: Tushare Pro Token 配置与注册指引
type: reference
domain: data
phase: development
tier: standard
status: active
maintainer: V9 Engineering Team
summary: "说明如何注册 Tushare Pro、获取 Token 并在本地 .env.local 中配置，以及如何验证 Token 连通性"
tags: [tushare, token, data-source, configuration]
version: v1.0.0
last_updated: 2026-07-17
code_version: "2.0.0-rc.2"
doc_id: V9-DOC-DATA-044
change_log:
  - version: v1.0.0
    changes: Initial version established
date: 2026-07-17
---
covers_code:
  - src/services/data-collector/tushareProvider.ts
  - src/config/marketDataEndpoints.ts
  - scripts/verify-tushare-token.ts


# Tushare Pro Token 配置与注册指引

## 1. Tushare Pro 注册步骤

1. 访问官网：[https://tushare.pro](https://tushare.pro)
2. 点击右上角「注册」，使用手机号完成账号注册
3. 登录后进入「个人中心」，完成实名认证
4. 充值积分套餐：推荐选择 **5000 积分套餐**（约 500 元/年，可满足基础数据需求）
5. 在「个人中心」→「接口 Token」页面复制你的专属 Token
6. 将 Token 填入本地 `.env.local` 文件（见下节）

> ⚠️ **注意**：Token 属于个人敏感凭证，必须由用户本人持有并填入，开发者不能代替用户完成支付或手机注册。

## 2. 在 `.env.local` 中配置 Token

项目根目录的 `.env.local` 文件已包含占位行：

```env
# Tushare Pro Token（5000 积分套餐），在 https://tushare.pro 个人中心获取
# 填入后仅在本地开发环境生效，勿提交到版本库（本文件已在 .gitignore 中）
VITE_TUSHARE_TOKEN=
```

将你的 Token 粘贴在 `=` 后面：

```env
VITE_TUSHARE_TOKEN=your_tushare_token_here
```

保存后，需重新启动 Vite dev server 才能读取更新后的环境变量。

## 3. 验证 Token 连通性

### 方式一：命令行脚本（推荐）

确保已安装依赖：

```bash
npm install
```

验证 Token：

```bash
npx tsx scripts/verify-tushare-token.ts
```

或（如果已添加 npm script）：

```bash
npm run verify:tushare
```

成功输出示例：

```text
🔍 Tushare Pro Token 验证脚本
✅ Token 已配置: xxxx****xxxx (长度 32)
⚠️  未检测到 Vite 环境（import.meta.env 不可用）
    将尝试通过本地代理 http://localhost:3000/api/proxy/tushare 或直接调用 Tushare API 验证
    如需通过 Vite 代理验证，请先运行 npm run dev，再通过浏览器页面或 vite-node 执行本脚本

✅ Tushare API 连通性验证成功
   返回状态: code=0, msg=ok
   股票代码: 600519.SH
   股票名称: 贵州茅台
   是否匹配预期（贵州茅台）: 是
```

### 方式二：启动 Vite 后访问页面

```bash
npm run dev
```

启动后，应用代码通过 `import.meta.env.VITE_TUSHARE_TOKEN` 读取 Token，并经由 Vite 代理 `/api/proxy/tushare` 转发请求到 Tushare 服务器。可在数据搜索或股票详情页触发 stock_basic 查询。

## 4. 安全提示

- **Token 不要提交到 Git**：`.env.local` 已在 `.gitignore` 中，不会被版本控制
- **不要在前端代码中硬编码 Token**：生产环境由服务端持有 Token，前端只通过代理转发
- **开发环境临时共享 Token 时**，使用安全的私聊/密钥管理工具，避免在群聊或文档中明文粘贴

## 5. 常见问题

| 问题 | 可能原因 | 解决方案 |
|:---|:---|:---|
| Token 未配置 | `.env.local` 中 `VITE_TUSHARE_TOKEN` 为空 | 填入有效 Token |
| 积分不足 | Tushare 账户积分低于接口消耗 | 充值积分套餐 |
| 代理未启动 | 直接调用 `/api/proxy/tushare` 但 Vite dev server 未运行 | 先运行 `npm run dev` |
| 返回空数据 | 股票代码不存在或接口权限不足 | 检查 stock_basic 接口是否已开通 |
| 网络超时 | 本地网络或 Tushare 服务端问题 | 检查网络连接，稍后重试 |

## 6. 相关文件

- `src/services/data-collector/tushareProvider.ts`：Tushare Pro 数据提供层
- `src/config/marketDataEndpoints.ts`：Tushare API 代理端点配置
- `vite.config.ts`：Vite 代理规则（`/api/proxy/tushare` → `http://api.tushare.pro`）
- `scripts/verify-tushare-token.ts`：Token 验证脚本
