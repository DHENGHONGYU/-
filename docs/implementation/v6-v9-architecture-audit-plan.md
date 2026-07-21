---
title: V6 → V9 架构一致性审计计划
version: v1.1.0
last_updated: 2026-07-01
maintainer: Quality Auditor
status: superseded
superseded_by: docs/implementation/v6-v9-architecture-audit-action-list.md v1.6.0
---

# V6 → V9 架构一致性审计计划

> **状态：已归档（superseded）**。本文档记录的是 2026-06-30 时点的审计初稿。所有问题的最新状态以 [`v6-v9-architecture-audit-action-list.md`](./v6-v9-architecture-audit-action-list.md) v1.6.0 为准（批次 A/B/C/D/E 全部闭环）。下文 §一/§二 的 🟡/🔴 标记保留作为历史快照，不回溯修改；如需查看当前状态，请参阅 action-list §3 与 completeness-profile §11.1。
>
> **审计目标**：验证 V6 架构是否真正主导 V9，排查是否存在旧架构残留、地址/路径未更新、以及“一套代码两套组件”的问题。
> **审计范围**：`src/` 源码、`docs/` 架构文档、`v6-ui-assets/` 迁移资产、`temp/backup/` 临时备份。
> **审计原则**：只读分析，不修改代码；所有发现必须附带具体文件路径或行号。

---

## 一、审计维度与检查项

### 1.1 V6 架构主导性（Architecture Ownership）

| 检查项 | 检查方法 | 关注点 | 结论 |
|:---|:---|:---|:---|
| 评分引擎是否按 V6 L-1~L8 分层运行 | 阅读 `src/services/scoring/v6-engine/` 与 `v6ScoreService.ts` | 生产入口是否调用分层引擎 | 🔴 未主导：生产入口仍是旧版 `v6ScoreService.ts` |
| DataBridge 是否按 V6 抽象实现 | 阅读 `src/core/databridge.ts`、`src/databridge/index.ts` | 动作协议、缓存、ACL 完整性 | 🟡 骨架完成，动作枚举与广播有缺口 |
| Store 层是否按 V6 状态层规范 | 抽样阅读 `src/store/*.ts` | 是否溯源 DataBridge、是否广播变更 | 🟡 基本溯源，广播双写未全覆盖 |
| types/modules 四步契约 | 阅读 `src/types/modules/*.ts` 与页面组件 | IOModule 声明、页面 `isVisible/isClickable` | 🟡 类型声明完整，页面层落地薄弱 |

### 1.2 双轨/两套组件问题（Dual Implementation）

| 检查项 | 检查方法 | 关注点 | 结论 |
|:---|:---|:---|:---|
| 是否存在 `apps/*App` 与 `pages/*HubPage` 双轨入口 | 阅读 `src/portal/PortalShell.tsx` | `CABIN_APPS` / `HUB_APPS` 双映射 | 🔴 存在：5 个舱室均有两套入口 |
| 是否存在 V6 与 V9 同名组件 | 全局搜索同名 `.tsx` 文件 | 文件名与导出组件名一致但路径不同 | 🔴 存在：NewsPage/NewsCard、SignalMonitorWidget 等 |
| 是否存在原型与正式面板重复 | 检查 `src/apps/input/prototype/` | 职责与正式面板重叠 | 🔴 存在：5 个原型面板 |
| 是否存在未引用孤儿页面 | 检查 `src/pages/command/ConfigPage.tsx` | 是否有路由引用 | 🔴 存在：ConfigPage 无路由引用 |

### 1.3 路由与地址一致性（Routing & Path）

| 检查项 | 检查方法 | 关注点 | 结论 |
|:---|:---|:---|:---|
| 路由表与规格文档是否一致 | 对比 `src/config/routes.ts` 与 `docs/06-routing-specs.md` | 路由数量、path、component | 🟡 文档记录 29 条，实际 35 条 |
| 是否存在硬编码路径未注册 | 搜索 `useNavigate` / `<Link to` 中的 path | 是否在 `routes.ts` 注册 | 🔴 存在：`/output/settings` 未注册 |
| 是否存在绕过 PortalShell 的路由 | 检查 `routes.ts` 中 component 是否为 `PortalShell` | 独立页面是否缺少舱室布局 | 🔴 存在：`/input/local-knowledge` |
| 是否存在显式保留的 V6 路由 | 检查含 `v6` 的 path | 是否按设计保留 | 🟡 存在：`/analysis/news-v6` 为设计保留 |

### 1.4 废弃资产与备份（Legacy & Debris）

| 检查项 | 检查方法 | 关注点 | 结论 |
|:---|:---|:---|:---|
| 是否存在完整 V6 UI 源码包 | 检查 `v6-ui-assets/` | 是否被源码引用 | 🔴 存在：完整目录，无引用 |
| 是否存在临时备份 | 检查 `temp/backup/` | 是否含 `.bak` 文件 | 🔴 存在：服务/Store/文档备份 |
| 是否存在一次性迁移服务残留 | 检查 `v6MigrationService.ts`、`migrationTransformers.ts` | 是否仍需运行 | 🟡 存在，需评估是否可删除 |
| Store 中是否含 legacy 迁移方法 | 搜索 `legacy*`、`toV9` | 是否可清理 | 🔴 存在：`newsStore.ts` 含 `legacyBookmarkToV9` |

---

## 二、审计发现汇总（三色标记）

| 维度 | 状态 | 说明 |
|:---|:---|:---|
| V6 评分引擎主导性 | 🔴 红色 | 新 `v6-engine` 已实现但未接管主流程，旧 `v6ScoreService.ts` 仍在生产路径 |
| 舱室入口统一性 | 🔴 红色 | `PortalShell` 同时维护 `CABIN_APPS` 与 `HUB_APPS` 两套映射 |
| 组件唯一性 | 🔴 红色 | 存在 V9/V6 同名组件、原型/正式面板重复、孤儿页面 |
| 路由一致性 | 🟡 黄色 | 数量偏差、一个 404 硬编码路径、一个绕过 PortalShell 的独立页面 |
| 废弃资产清理 | 🔴 红色 | `v6-ui-assets`、`temp/backup`、迁移服务残留、legacy Store 方法 |
| DataBridge 完整性 | 🟡 黄色 | 核心抽象已建立，动作协议与广播双写有缺口 |
| Store 广播双写 | 🟡 黄色 | 部分 Store 实现，未全覆盖 |
| 四步契约落地 | 🟡 黄色 | 类型层完整，页面层薄弱 |

---

## 三、关键证据（文件路径 / 行号）

### 3.1 两套舱室入口

```text
src/portal/PortalShell.tsx:39-53   CABIN_APPS / HUB_APPS 双映射表
src/portal/PortalShell.tsx:206-218 按 pathname.endsWith('/hub') 切换渲染
```

### 3.2 旧评分服务仍在生产路径

```text
src/services/scoring/v6ScoreService.ts:1-60   启发式 9 因子评分逻辑
src/services/scoring/v6-engine/engine.ts      完整 L-1~L8 分层实现（未被主流程调用）
```

### 3.3 同名组件重复

```text
src/pages/analysis/NewsPage.tsx
src/pages/news-v6/NewsPage.tsx
src/components/news/NewsCard.tsx
src/pages/news-v6/components/NewsCard.tsx
src/cockpit/widgets/SignalMonitorWidget.tsx
v6-ui-assets/source-migration/widgets/widgets/strategy/SignalMonitorWidget.tsx
```

### 3.4 路由异常

```text
src/config/routes.ts:190-194   /analysis/news-v6（V6 风格保留页）
src/config/routes.ts:226-230   /input/local-knowledge（绕过 PortalShell）
src/pages/output/OutputHubPage.tsx:48   /output/settings（未注册）
```

### 3.5 废弃/临时目录

```text
v6-ui-assets/source-migration/
temp/backup/
src/apps/input/prototype/
```

---

## 四、整改优先级与批次

| 批次 | 优先级 | 目标 | 范围 |
|:---|:---|:---|:---|
| A | P0 | 让 V6 引擎主导评分；消除舱室双轨入口 | `v6-engine`、`v6ScoreService`、`PortalShell` |
| B | P1 | 清理 V6 资产、原型、备份、冗余资讯页 | `v6-ui-assets`、`temp/backup`、`prototype`、`news-v6`、`ConfigPage` |
| C | P1 | 修复路由与布局一致性 | `routes.ts`、`OutputHubPage`、`newsStore` |
| D | P2 | DataBridge、Store 广播、四步契约、文档同步 | `databridge/index.ts`、核心 Store、核心页面、`06-routing-specs.md` |
| E | P2 | 清理迁移服务与 Mock 占位 | `v6MigrationService`、`migrationTransformers`、Mock Providers、`inputService` |

---

## 五、审计产出

1. `docs/implementation/completeness-profile.md` — 第十一章新增 V6→V9 架构一致性专项审计。
2. `docs/implementation/v6-v9-architecture-audit-action-list.md` — 26 项问题清单与批次规划。
3. 本文档 `docs/implementation/v6-v9-architecture-audit-plan.md` — 审计方法与关键证据。

---

## 六、变更日志

| 日期 | 版本 | 变更内容 | 变更人 |
|:---|:---|:---|:---|
| 2026-06-30 | v1.0.0 | 初始版本 | V9 Quality Audit Team |
