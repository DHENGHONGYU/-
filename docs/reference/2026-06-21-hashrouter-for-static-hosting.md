---
title: ADR-004: React Router HashRouter
type: reference
domain: frontend
phase: design
tier: standard
status: active
maintainer: V9 Architecture Team
summary: "## 背景 V9 计划部署�?GitHub Pages 等静态托管，需要离线刷新无 404�?"
tags: [frontend, adr, architecture]
version: v1.0.0
last_updated: 2026-07-17
code_version: 2.0.0
doc_id: V9-DOC-FRONT-027
referenced_by: [V9-DOC-PROJ-174, V9-DOC-META-000, V9-DOC-PROJ-164, V9-DOC-PROJ-176, V9-DOC-PROJ-182, V9-DOC-PROJ-149]
change_log:
  - version: v1.0.0
changes: Initial version established
date: 2026-07-17
---

# ADR-004: React Router HashRouter

> **Status**: Accepted  
> **Version**: v0.9.0-docs-review  
> **Last Updated**: 2026-06-24

- 状态：已接�?- 日期�?026-06-21
- 决策人：@architect

## 背景

V9 计划部署�?GitHub Pages 等静态托管，需要离线刷新无 404�?
## 选项

| 选项 | 优点 | 缺点 |
|------|------|------|
| A. HashRouter | 静态托管友好、刷新无 404 | URL 不美观、SEO 不友�?|
| B. BrowserRouter + 服务�?rewrite | URL 美观 | 需要服务端配置 |

## 决策

选择 A。工具型应用�?SEO 不敏感，静态托管便利性更重要�?
## 后果

- 所有路由使�?hash 部分，如 `/#/input/bulk-import`�?- 路由注册表集中管理于 `src/config/routes.ts`�?
## 相关文档

- `./06-routing-specs.md`
