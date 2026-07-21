---
title: ADR-006: 输入舱拆分为四子页面
version: v0.9.0
last_updated: 2026-06-24
maintainer: V9 Architecture Team
status: active
change_log:
  - date: 2026-06-24
    author: Documentation Governor
    desc: 注入 Frontmatter 元数据（Phase 3 版本化）
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

- `docs/06-routing-specs.md`
- `docs/implementation/input-cabin-spec.md`
