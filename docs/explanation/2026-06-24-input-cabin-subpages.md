---
title: ADR-006: 输入舱拆分为四子页面
type: explanation
domain: frontend
phase: planning
tier: standard
status: active
maintainer: V9 Architecture Team
summary: "## 背景 `InputApp.tsx` 逐渐膨胀，包含录入、批量导入、热门板块、采集测试多个功能区，维护困难。"
tags: [frontend, input-cabin, adr]
version: v1.0.0
last_updated: 2026-07-17
code_version: 2.0.0
doc_id: V9-DOC-FRONT-055
referenced_by: [V9-DOC-PROJ-174, V9-DOC-META-000, V9-DOC-PROJ-164, V9-DOC-PROJ-176, V9-DOC-PROJ-182, V9-DOC-PROJ-149]
change_log:
  - version: v1.0.0
changes: Initial version established
date: 2026-07-17
---

# ADR-006: 输入舱拆分为四子页面

> **Status**: Accepted  
> **Version**: v0.9.0-docs-review  
> **Last Updated**: 2026-06-24

- 状态：已接受
- 日期：2026-06-24
- 决策人：@frontend-lead

## 背景

`InputApp.tsx` 逐渐膨胀，包含录入、批量导入、热门板块、采集测试多个功能区，维护困难。

## 选项

| 选项 | 优点 | 缺点 |
|------|------|------|
| A. 拆分为 `/input`、`/input/bulk-import`、`/input/hot-sectors`、`/input/data-test` | 职责清晰、可独立迭代、路由可直达 | 需要维护更多子路由与组件 |
| B. 单页 Tab 切换 | 实现简单 | 文件过大、状态耦合、难以 deep-link |

## 决策

选择 A。与分析舱 `/analysis/*` 子页模式对齐。

## 后果

- `InputApp.tsx` 改为子路由布局组件。
- 新增 `InputDashboard`、`BulkImportPanel`、`HotSectorPanel`、`DataTestPanel`。
- 路由注册表同步更新。

## 相关文档

- `../reference/06-routing-specs.md`
- `../reference/input-cabin-spec.md`
