---
title: ADR-004: React Router HashRouter
version: v0.9.0
last_updated: 2026-06-24
maintainer: V9 Architecture Team
status: active
change_log:
  - date: 2026-06-24
    author: Documentation Governor
    desc: 注入 Frontmatter 元数据（Phase 3 版本化）
---
# ADR-004: React Router HashRouter

> **Status**: Accepted  
> **Version**: v0.9.0-docs-review  
> **Last Updated**: 2026-06-24

- 状态：已接受
- 日期：2026-06-21
- 决策人：@architect

## 背景

V9 计划部署到 GitHub Pages 等静态托管，需要离线刷新无 404。

## 选项

| 选项 | 优点 | 缺点 |
|------|------|------|
| A. HashRouter | 静态托管友好、刷新无 404 | URL 不美观、SEO 不友好 |
| B. BrowserRouter + 服务端 rewrite | URL 美观 | 需要服务端配置 |

## 决策

选择 A。工具型应用对 SEO 不敏感，静态托管便利性更重要。

## 后果

- 所有路由使用 hash 部分，如 `/#/input/bulk-import`。
- 路由注册表集中管理于 `src/config/routes.ts`。

## 相关文档

- `docs/06-routing-specs.md`
