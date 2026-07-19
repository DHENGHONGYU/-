---
title: Deployment Guide — V9 智能投研复盘系统部署基线
type: meta
domain: project
phase: deployment
tier: standard
status: deprecated
maintainer: V9 Architecture Team
summary: "版本: v1.0.0 | 日期: 2026-07-10 适用范围: V9 全量部署与运维 部署模式: 纯浏览器 SPA（单页应用）+ IndexedDB 本地存储"
tags: [project, guide, deprecated]
version: v1.0.0
last_updated: 2026-07-17
code_version: 2.0.0
change_log:
  - version: v1.0.0
deprecated_by: "Deployment Guide v2.0"
changes: Initial version established
date: 2026-07-17
---

# Deployment Guide — V9 智能投研复盘系统部署基线

> **版本**: v1.0.0 | **日期**: 2026-07-10
> **适用范围**: V9 全量部署与运维
> **部署模式**: 纯浏览器 SPA（单页应用）+ IndexedDB 本地存储

---

## 一、部署架构总览

V9 采用**纯前端架构**，所有业务逻辑运行在浏览器端，数据持久化依赖浏览器 IndexedDB，无需后端服务器或数据库实例：

```
┌─────────────────────────────────────────────────────────────┐
│                      部署架构简图                              │
├─────────────────────────────────────────────────────────────┤
│  用户浏览器                                                   │
│  ├─ React 19 SPA（Vite 构建）                                │
│  ├─ IndexedDB（V6ProDB，31 个 Object Store）                  │
│  ├─ localStorage（配置 + 加密 API Key）                      │
│  └─ Web Crypto API（AES-GCM 加密）                           │
│                          │                                   │
│                          ▼                                   │
│  静态托管（CDN / Nginx / S3 + CloudFront）                  │
│  ├─ dist/index.html（入口）                                  │
│  ├─ dist/assets/*.js（chunk 文件）                           │
│  ├─ dist/assets/*.css（样式）                                │
│  └─ 静态资源（图标、字体）                                    │
│                          │                                   │
│                          ▼                                   │
│  外部服务（仅调用，非部署组件）                                │
│  ├─ LLM API（OpenAI / Claude / Kimi）— 用户配置 API Key       │
│  ├─ 股票数据 API（AkShare / Tushare）— 用户配置数据源         │
│  └─ 新闻/资讯 API（财联社等）— 公开接口                        │
└─────────────────────────────────────────────────────────────┘
```

### 1.1 架构特点

| 特性 | 说明 |
|------|------|
| **无服务器依赖** | 纯静态文件，任意 CDN/静态托管即可部署 |
| **数据本地存储** | IndexedDB（结构化数据）+ localStorage（配置） |
| **用户数据隔离** | 天然浏览器级隔离，不同用户/浏览器数据互不可见 |
| **加密敏感配置** | API Key 等通过 Web Crypto API (AES-GCM) 加密存储 |
| **离线可用** | 首次加载后，核心功能可离线运行（数据已缓存） |

---

## 二、技术栈基线

### 2.1 运行时依赖

| 包名 | 版本 | 用途 |
|------|------|------|
| `react` | ^19.0.0 | UI 框架 |
| `react-dom` | ^19.0.0 | DOM 渲染 |
| `react-router` | ^7.0.0 | 路由管理 |
| `zustand` | ^5.0.0 | 状态管理（49 个 Store） |
| `dayjs` | ^1.11.21 | 日期处理 |
| `recharts` | ^3.9.1 | 图表库 |
| `lightweight-charts` | ^5.2.0 | K 线/轻量图表 |
| `lucide-react` | ^0.460.0 | 图标库 |
| `@heroicons/react` | 2.2.0 | 补充图标 |
| `jspdf` + `jspdf-autotable` | ^4.2.1 / ^5.0.8 | PDF 导出 |
| `xlsx` | ^0.18.5 | Excel 导出 |
| `nanoid` | ^3.3.15 | ID 生成 |
| `web-vitals` | ^5.3.0 | 性能指标采集 |
| `tailwindcss` | ^3.4.15 | CSS 框架 |
| `clsx` + `tailwind-merge` | ^2.1.1 / ^2.5.0 | 类名处理 |

### 2.2 构建工具链

| 工具 | 版本 | 用途 |
|------|------|------|
| `vite` | ^6.0.0 | 构建与开发服务器 |
| `@vitejs/plugin-react` | ^4.3.0 | React Fast Refresh |
| `typescript` | ^5.7.0 | 类型系统 |
| `vitest` | ^2.1.0 | 单元测试 |
| `playwright` | ^1.61.1 | E2E 测试 |
| `eslint` | ^9.15.0 | 代码检查 |
| `husky` | 9.1.7 | Git Hooks |
| `lint-staged` | ^17.0.8 | 暂存区检查 |

### 2.3 Node.js 版本要求

- **开发环境**: Node.js ≥ 20.x
- **CI 环境**: `ubuntu-latest` + `node-version: 20`

---

## 三、构建配置

### 3.1 Vite 构建配置（vite.config.ts）

```typescript
export default defineConfig({
  build: {
    target: 'es2022',        // 目标浏览器支持 ES2022
    outDir: 'dist',          // 输出目录
    sourcemap: false,        // 生产环境关闭 sourcemap（安全考虑）
    rollupOptions: {
      output: {
        manualChunks: {      // 手动代码分割（5 个 chunk）
          'vendor': ['react', 'react-dom', 'react-router', 'zustand', 'dayjs'],
          'ui': ['lucide-react', 'clsx', 'tailwind-merge', '@heroicons/react'],
          'charts': ['recharts', 'lightweight-charts'],
          'pdf': ['jspdf', 'jspdf-autotable'],
          'excel': ['xlsx'],
        },
      },
    },
  },
  server: {
    port: 3000,              // 开发服务器端口
  },
})
```

### 3.2 代码分割策略

| Chunk | 包含内容 | 预估大小 | 懒加载场景 |
|-------|---------|---------|-----------|
| `vendor` | React + Router + Zustand + Dayjs | ~180 KB | 首屏必需 |
| `ui` | 图标 + 工具类 | ~60 KB | 首屏必需 |
| `charts` | Recharts + Lightweight Charts | ~400 KB | 分析/交易页面 |
| `pdf` | jsPDF + autotable | ~200 KB | 导出报告时 |
| `excel` | xlsx | ~150 KB | 导出 Excel 时 |

> **首屏加载**: vendor + ui + 业务代码（不含 charts/pdf/excel），控制在 300 KB 以内（gzip）。

### 3.3 构建产物结构

```
dist/
├── index.html                 # SPA 入口（单页）
├── assets/
│   ├── index-[hash].js        # 主入口 chunk
│   ├── vendor-[hash].js       # 框架 chunk
│   ├── ui-[hash].js           # UI 组件 chunk
│   ├── charts-[hash].js       # 图表 chunk（懒加载）
│   ├── pdf-[hash].js          # PDF 导出 chunk（懒加载）
│   ├── excel-[hash].js        # Excel 导出 chunk（懒加载）
│   ├── index-[hash].css       # Tailwind 样式
│   └── [其他资源...]
└── [静态资源: 图标、字体等]
```

---

## 四、部署环境

### 4.1 部署方式对比

| 方案 | 适用场景 | 优点 | 缺点 |
|------|---------|------|------|
| **CDN 静态托管**（推荐） | 生产环境 | 全球加速、高可用、低成本 | 需配置回源策略 |
| **Nginx 静态服务** | 内网/私有部署 | 完全可控、可配安全策略 | 需维护服务器 |
| **S3 + CloudFront** | AWS 生态 | 无服务器、自动扩展 | 绑定云厂商 |
| **GitHub Pages** | 演示/测试 | 零成本、自动化 | 国内访问慢 |
| **Vercel/Netlify** | 海外用户 | 自动部署、边缘网络 | 国内访问受限 |

### 4.2 纯前端部署注意事项

由于 V9 是纯 SPA，部署时需注意：

#### 4.2.1 路由模式（BrowserRouter vs HashRouter）

V9 使用 `react-router` v7 的 **BrowserRouter**（历史模式），需要服务器配置**回退到 index.html**：

```nginx
# Nginx 配置示例
server {
  listen 80;
  root /var/www/v9;
  index index.html;

  # 静态资源直接服务
  location /assets/ {
    expires 1y;
    add_header Cache-Control "public, immutable";
  }

  # 所有路由回退到 index.html（SPA 必需）
  location / {
    try_files $uri $uri/ /index.html;
  }
}
```

```apache
# Apache .htaccess 示例
RewriteEngine On
RewriteCond %{REQUEST_FILENAME} !-f
RewriteCond %{REQUEST_FILENAME} !-d
RewriteRule . /index.html [L]
```

#### 4.2.2 HTTPS 强制

**必须启用 HTTPS**（Web Crypto API 在非 HTTPS 环境下不可用）：

```nginx
# 强制 HTTPS 跳转
server {
  listen 80;
  return 301 https://$host$request_uri;
}

server {
  listen 443 ssl http2;
  ssl_certificate /path/to/cert.pem;
  ssl_certificate_key /path/to/key.pem;
  # ...
}
```

> ?? **重要**: Web Crypto API（`crypto.subtle`）在 HTTP 环境下不可用，导致加密存储功能失效。生产环境必须 HTTPS。

#### 4.2.3 缓存策略

| 资源类型 | 缓存策略 | 原因 |
|---------|---------|------|
| `index.html` | `no-cache` | 每次更新需重新验证 |
| `assets/*.js` / `assets/*.css` | `max-age=31536000, immutable` | hash 文件名，内容不变则永久缓存 |
| 静态图标/字体 | `max-age=86400` | 偶尔更新 |

```nginx
# Nginx 缓存配置
location /assets/ {
  expires 1y;
  add_header Cache-Control "public, immutable";
}

location = /index.html {
  add_header Cache-Control "no-cache, no-store, must-revalidate";
}
```

#### 4.2.4 Content-Security-Policy（CSP）

建议配置 CSP 防止 XSS（V9 无外部脚本注入，但需允许 LLM API 域名）：

```nginx
add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; connect-src 'self' https://api.openai.com https://api.moonshot.cn https://api.anthropic.com; img-src 'self' data: blob:;" always;
```

> 根据实际接入的 LLM 提供商调整 `connect-src`。

---

## 五、CI/CD 流水线

### 5.1 GitHub Actions 配置

#### 5.1.1 Quality Check（质量门禁）

文件: `.github/workflows/quality-check.yml`

触发条件: `push` 到 `main` / `pull_request` 到 `main`

**Job 矩阵**（10 个并行 Job）：

| Job | 职责 | 超时 | 是否 P0 阻塞 |
|-----|------|------|-------------|
| `lint` | ESLint 代码检查 | 10 min | ? 是 |
| `typecheck` | TypeScript 类型检查 | 10 min | ? 是 |
| `route-verify` | 路由完整性验证 | 10 min | ? 是 |
| `test` | 单元测试（跳过已知失败） | 15 min | ? 是 |
| `coverage` | 覆盖率报告生成 | 20 min | ? 否（仅报告） |
| `audit` | 架构审计 + 文档同步 + 语义验证 | 10 min | ? 是 |
| `dependency-analysis` | 循环依赖/孤立模块检测 | 15 min | ?? P1（重要） |
| `quality-gate-summary` | 汇总所有门禁状态 | 5 min | ? 是（汇总） |
| `contract-validation` | 类型契约运行时验证 | 15 min | ? 否 |
| `snapshot-test` | API/Schema 快照对比 | 10 min | ? 否 |
| `api-extraction` | API 文档自动生成 | 15 min | ? 否 |

#### 5.1.2 System Check Loop（系统巡检）

文件: `.github/workflows/system-check-loop.yml`

触发条件: `每日 00:00 UTC` + `push` 到 `main/develop` + `手动触发`

| 功能 | 说明 |
|------|------|
| 自动检查 | 运行 `system:check-loop` 脚本 |
| 报告归档 | 上传检查报告到 artifact（保留 7 天） |
| 失败告警 | 严重问题时自动创建 GitHub Issue |
| 质量阶段 | 支持 `intensive/normal/lightweight` 三档 |

### 5.2 CI 安全加固

```yaml
# GitHub Actions 安全最佳实践（已实施）
permissions:
  contents: read          # 默认只读
  security-events: write  # 仅用于上传安全审计结果

steps:
  - uses: actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683 # SHA pin 防供应链攻击
  - uses: actions/setup-node@39370e3970a6d050c480ffad4ff0ed4d71f2d81a
  - run: npm ci --ignore-scripts --no-audit  # 禁止安装脚本 + 跳过安装时审计
```

### 5.3 本地验证命令（部署前必执行）

```powershell
# 1. 类型检查
npm run tsc:prod
# 期望: 0 errors

# 2. 全量审计
npm run audit
# 期望: 全部通过

# 3. 单元测试（跳过已知失败）
npm run test:clean
# 期望: 通过

# 4. 生产构建
npm run build
# 期望: dist/ 目录生成，无错误

# 5. 构建产物分析（可选）
npm run analyze
# 输出: dist/stats.html（可视化 chunk 分析）
```

---

## 六、环境配置

### 6.1 无环境变量模式

V9 是纯前端应用，**不依赖构建时环境变量**（`.env` 文件）。所有配置通过运行时 UI 输入，加密存储在 localStorage：

| 配置项 | 存储方式 | 加密 |
|-------|---------|------|
| LLM API Key | `localStorageManager.setEncrypted()` | ? AES-GCM |
| 数据源配置 | `localStorageManager.setEncrypted()` | ? AES-GCM |
| 主题/偏好 | `localStorageManager.set()` | ? 明文 |
| 股票池数据 | IndexedDB | ? 业务数据无需加密 |

### 6.2 运行时配置（用户级）

用户首次使用时需配置：

1. **LLM 提供商**: 选择 OpenAI / Claude / Kimi，输入 API Key（加密存储）
2. **数据源**: 选择 AkShare / Tushare / 手动导入，配置对应参数
3. **评分引擎参数**: 阈值、权重等（从 `src/services/scoring/v6-engine/config.ts` 注入）

---

## 七、监控与健康检查

### 7.1 系统健康检查

```powershell
# 生成本地健康报告
npm run system:health
# 输出: docs/reports/system-health/health-report.json

# 详细模式
npm run system:health:detailed
```

### 7.2 构建健康报告

```powershell
# 生成构建健康报告（包含 chunk 分析、依赖审计、类型覆盖）
npm run build:health
# 输出: docs/reports/build-health-report.md
```

### 7.3 浏览器端监控

| 指标 | 采集方式 | 说明 |
|------|---------|------|
| Web Vitals | `web-vitals` 库 | LCP / FID / CLS / FCP / TTFB |
| IndexedDB 状态 | `db.isReady()` | 数据库初始化状态 |
| 存储容量 | `LocalStorageManager.getCapacity()` | localStorage 使用率 |
| 错误日志 | `logger.error()` | 自动上报到 console / 日志表 |

---

## 八、性能基线

### 8.1 首屏加载目标

| 指标 | 目标值 | 当前状态 |
|------|--------|---------|
| LCP（Largest Contentful Paint） | < 2.5s | 待测 |
| FCP（First Contentful Paint） | < 1.0s | 待测 |
| TTI（Time to Interactive） | < 3.5s | 待测 |
| 首屏 JS 体积 | < 300 KB (gzip) | ~240 KB |
| 总 JS 体积 | < 800 KB (gzip) | ~700 KB |

### 8.2 优化手段（已实施）

| 优化项 | 实现 | 效果 |
|-------|------|------|
| 代码分割 | `manualChunks` 分 5 个 chunk | 按需加载，减少首屏体积 |
| Tree Shaking | Vite Rollup 默认开启 | 消除未使用代码 |
| 缓存策略 | hash 文件名 + immutable 缓存 | 二次访问秒开 |
| 图标按需 | `lucide-react` 树摇 | 只打包使用的图标 |
| 图表懒加载 | `React.lazy()` + 动态导入 | 非图表页不加载 |

---

## 九、部署检查清单

### 9.1 首次部署

```powershell
# ? 首次部署检查清单
[ ] Node.js 20+ 环境就绪
[ ] 运行 npm ci --ignore-scripts 安装依赖
[ ] 运行 npm run tsc:prod 通过类型检查
[ ] 运行 npm run audit 全量审计通过
[ ] 运行 npm run test:clean 测试通过
[ ] 运行 npm run build 生成 dist/
[ ] 确认 dist/ 包含 index.html + assets/
[ ] 配置静态服务器（Nginx/CDN）回退到 index.html
[ ] 启用 HTTPS（强制）
[ ] 配置 CSP 响应头
[ ] 配置缓存策略（index.html 不缓存，assets 永久缓存）
[ ] 验证 Web Crypto API 可用（HTTPS）
[ ] 验证 IndexedDB 可初始化（首次访问自动创建 DB）
```

### 9.2 版本升级

```powershell
# ? 版本升级检查清单（DB_VERSION 变更时）
[ ] 检查 DB_VERSION 是否递增（src/config/dbConfig.ts）
[ ] 检查新增 store 是否在 createSchema 或 Migration 中创建
[ ] 检查新增 store 是否在 ACL_MATRIX 中注册权限
[ ] 检查新增 ENVELOPE_ACTION 是否在 ACTION_TO_STORE_MAP 中映射
[ ] 在测试浏览器中验证数据迁移（旧版本 → 新版本）
[ ] 验证新增 store 的索引正确性
[ ] 运行 npm run audit:reserved-stores 确认无违规
```

### 9.3 回滚流程

```
1. 恢复上一个版本的 dist/ 构建产物
2. 清除 CDN/浏览器缓存（强制刷新）
3. 若涉及 DB_VERSION 回退：提醒用户清除 IndexedDB（或提供降级脚本）
4. 验证核心功能正常（股票池、评分、交易）
```

> ?? **注意**: IndexedDB 不支持版本降级。如果回退到旧代码版本且 DB_VERSION 已升级，浏览器会报错。建议：
> - 向前兼容（新版本代码兼容旧 DB 结构）
> - 或提供数据导出/导入功能作为降级路径

---

## 十、相关文档索引

| 文档 | 路径 | 内容 |
|------|------|------|
| 安全模型 | `../../../reference/security-model.md` | ACL / 加密 / MCP ACL / RBAC |
| CI 配置 | `.github/workflows/quality-check.yml` | 质量门禁流水线 |
| 系统巡检 | `.github/workflows/system-check-loop.yml` | 定时检查 + 自动告警 |
| Vite 配置 | `vite.config.ts` | 构建/开发/测试配置 |
| 包管理 | `package.json` | 依赖版本与脚本 |
| 数据库配置 | `src/config/dbConfig.ts` | DB_VERSION / STORE_NAME / ACL_MATRIX |
| ../../../../AGENTS.md | `../../../../AGENTS.md` §八 | 数据库版本管理规范 |

---

> **?? 待确认项（请补充）**：
> 1. 实际部署目标（云厂商 CDN / 自有服务器 / 内网）？
> 2. 是否已有域名和 HTTPS 证书？
> 3. 是否需要 Docker 镜像化部署（当前无 Dockerfile）？
> 4. 是否需要 PWA 支持（Service Worker、离线缓存清单）？
> 5. 是否需要接入外部监控（如 Sentry、LogRocket）？
> 
> 请确认上述信息后，继续生成 `../../../README.md`。
