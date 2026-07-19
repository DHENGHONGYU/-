---
title: ADR-004: HashRouter 静态托管方�?
type: explanation
domain: architecture
phase: planning
tier: important
status: active
maintainer: V9 Architecture Team
summary: "V9 作为纯前�?PWA（ADR-001），需要部署到静态托管服务（GitHub Pages、Vercel、Netlify）。这些服务不支持服务端路由配置（�?nginx try_files），"
tags: [architecture, adr, routing, plan, design, strategy, explanation]
version: v1.0.0
last_updated: 2026-07-17
code_version: 2.0.0
doc_id: V9-DOC-ARCH-006
referenced_by: [V9-DOC-META-000, V9-DOC-PROJ-331, V9-DOC-PROJ-176, V9-DOC-PROJ-149]
change_log:
  - version: v1.0.0
changes: Initial version established
date: 2026-07-17
---tion
domain: architecture
phase: planning
tier: important
doc_id: V9-DOC-ARCH-006
status: active
maintainer: V9 Architecture Team
summary: "V9 作为纯前�?PWA（ADR-001），需要部署到静态托管服务（GitHub Pages、Vercel、Netlify）。这些服务不支持服务端路由配置（�?nginx try_files），"
tags: [architecture, adr, routing, plan]
version: v1.0.0
last_updated: 2026-07-17
code_version: 2.0.0
---

# ADR-004: HashRouter 静态托管方�?
> **状�?*: Accepted  
> **决策日期**: 2026-06-21  
> **版本**: v1.0.0

---

## 1. 背景（Context�?
V9 作为纯前�?PWA（ADR-001），需要部署到静态托管服务（GitHub Pages、Vercel、Netlify）。这些服务不支持服务端路由配置（�?nginx `try_files`），因此 `BrowserRouter`（基�?HTML5 History API）在刷新页面时会返回 404�?
### 触发条件

- 2026-06-21 部署评审：确�?V9 首版将部署到 GitHub Pages（免费、无需备案）�?- GitHub Pages 仅支持静态文件托管，无法配置服务端路由回退�?
---

## 2. 决策（Decision�?
**采用 `HashRouter` 替代 `BrowserRouter`，适配静态托管场景�?*

- 路由使用 `/#/path` 格式（如 `/#/analysis`、`/#/trading`）�?- `src/config/routes.ts` 集中注册全部 62 条路由�?- 禁止页面组件内硬编码路径（如 `navigate('/analysis')` 必须通过路由常量）�?- 部署到子路径时（�?`https://user.github.io/v9/`），`vite.config.ts` �?`base` 配置须同步更新�?
### 决策理由

- **Why not BrowserRouter**：需要服务端配置 404 回退，GitHub Pages 不支持�?- **Why not 自定�?404 页面**：GitHub Pages 支持自定�?404.html，但无法传递原始路径参数，用户体验差�?- **HashRouter 的代�?*：URL �?`#`，对 SEO 不友好；�?V9 是内部工具，不依赖搜索引擎流量�?
---

## 3. 备选方案（Alternatives Considered�?
| 方案 | 优点 | 缺点 | 结论 |
|------|------|------|------|
| **A. HashRouter**（最终选择�?| 无需服务端配置，兼容所有静态托�?| URL �?`#`，SEO 不友�?| �?采纳 |
| **B. BrowserRouter + 404.html** | URL 干净，SEO 友好 | 无法传递原始路径，刷新后丢失状�?| �?否决 |
| **C. 自建服务器（nginx�?* | 完全控制路由行为 | 需要服务器、域名、备案，违背 ADR-001 | �?否决 |
| **D. Vercel/Netlify redirects** | 服务端重定向配置 | 绑定特定平台，迁移成本高 | �?否决 |

---

## 4. 后果（Consequences�?
### 正面影响

- 一键部署到 GitHub Pages/Vercel/Netlify，无需任何服务端配置�?- 刷新页面�?404，用户体验一致�?- 子路径部署支持（通过 `base` 配置）�?
### 负面影响 / 技术�?
- URL �?`#`，分享链接不够美观�?  - **缓解**：提供「复制清洁链接」功能（�?`/#/analysis` 转换为可分享的短链接）�?- SEO 不友好（搜索引擎忽略 `#` 后的内容）�?  - **缓解**：V9 是内部工具，不依�?SEO；如需公开，评�?SSR 方案（V10）�?- 路由参数传递方式受限（无法使用 `?query` �?hash 混用）�?  - **缓解**：使�?`state` 传递复杂参数，或编码为 `/#/analysis?symbol=000001`�?
---

## 5. 实施与验�?
### 实施步骤

- [x] Step 1：在 `src/config/routes.ts` 中配�?`HashRouter`
- [x] Step 2：定义路由常量（禁止硬编码路径）
- [x] Step 3：配�?`vite.config.ts` �?`base`（子路径部署�?- [ ] Step 4：补充「复制清洁链接」功�?- [ ] Step 5：路由守卫（数据存在性检查、离线守卫）

### 验证命令

```bash
npm run build
# 检�?dist/index.html 中路由配置正�?```

---

## 6. 关联文档

| 文档 | 路径 |
|------|------|
| ADR-001（纯前端架构�?| `adr-001-pure-frontend-architecture.md` |
| 路由规格 | `./design/06-routing-specs.md` §1 |
| 部署基线 | `../reference/deployment.md` §2（静态托管配置） |
| 原始提案 | `../reference/2026-06-21-hashrouter-for-static-hosting.md` |

---

## 7. 状态变更记�?
| 日期 | 状�?| 变更�?| 备注 |
|------|------|--------|------|
| 2026-06-21 | proposed | @architect | 初始提案 |
| 2026-06-21 | accepted | 架构�?| 评审通过 |
| 2026-07-12 | accepted | docs 治理�?| 扩写为完�?ADR v1.0.0 |
