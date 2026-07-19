---
title: ADR-005: PortalShell 深色 Kimi 经典布局
type: explanation
domain: frontend
phase: planning
tier: standard
status: active
maintainer: V9 Architecture Team
summary: "## 背景 早期 UI 规范为浅�?PWA 风格，与 Kimi 产品品牌一致性不足，且五舱导航不够清晰�?"
tags: [frontend, adr, architecture]
version: v1.0.0
last_updated: 2026-07-17
code_version: 2.0.0
doc_id: V9-DOC-FRONT-056
referenced_by: [V9-DOC-PROJ-174, V9-DOC-META-000, V9-DOC-PROJ-164, V9-DOC-PROJ-176, V9-DOC-PROJ-182, V9-DOC-PROJ-149]
change_log:
  - version: v1.0.0
changes: Initial version established
date: 2026-07-17
---

# ADR-005: PortalShell 深色 Kimi 经典布局

> **Status**: Accepted  
> **Version**: v0.9.0-docs-review  
> **Last Updated**: 2026-06-24

- 状态：已接�?- 日期�?026-06-23
- 决策人：@ui-lead

## 背景

早期 UI 规范为浅�?PWA 风格，与 Kimi 产品品牌一致性不足，且五舱导航不够清晰�?
## 选项

| 选项 | 优点 | 缺点 |
|------|------|------|
| A. 深色 Kimi 经典布局（顶部状态栏 + 分组侧边栏） | 品牌一致、专业感强、导航清�?| 需要调整主题令牌与首页/驾驶舱例�?|
| B. 保持浅色 PWA 风格 | 与早期文档一�?| 品牌辨识度低、功能多时导航拥�?|

## 决策

选择 A。PortalShell 使用深色主题容器，首页与驾驶舱保持浅色�?
## 后果

- 根容器始终添�?`dark` 类�?- 顶部�?56px，左侧分组侧边栏 260px�?- 主题令牌继续沿用 HSL CSS 变量�?
## 相关文档

- `../reference/04-ui-ux-specs.md`
