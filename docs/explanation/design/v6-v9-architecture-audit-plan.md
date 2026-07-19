---
title: V6 �?V9 架构一致性审计计�?
type: explanation
domain: architecture
phase: design
tier: standard
status: active
maintainer: V9 Architecture Team
summary: "状态：已归档（superseded�?*。本文档记录的是 2026-06-30 时点的审计初稿。所有问题的最新状态以..."
tags: [architecture, audit, design, plan]
version: v1.0.0
last_updated: 2026-07-17
code_version: 2.0.0
doc_id: V9-DOC-ARCH-025
related_docs: [V9-DOC-ARCH-018]
referenced_by: [V9-DOC-PROJ-174, V9-DOC-META-000, V9-DOC-PROJ-176, V9-DOC-PROJ-182, V9-DOC-PROJ-149]
change_log:
  - version: v1.0.0
changes: Initial version established
date: 2026-07-17
---

# V6 �?V9 架构一致性审计计�?
> **状态：已归档（superseded�?*。本文档记录的是 2026-06-30 时点的审计初稿。所有问题的最新状态以 [`v6-v9-architecture-audit-action-list.md`](./v6-v9-architecture-audit-action-list.md) v1.6.0 为准（批�?A/B/C/D/E 全部闭环）。下�?§一/§�?�?🟡/🔴 标记保留作为历史快照，不回溯修改；如需查看当前状态，请参�?action-list §3 �?completeness-profile §11.1�?>
> **审计目标**：验�?V6 架构是否真正主导 V9，排查是否存在旧架构残留、地址/路径未更新、以及“一套代码两套组件”的问题�?> **审计范围**：`src/` 源码、`docs/` 架构文档、`v6-ui-assets/` 迁移资产、`temp/backup/` 临时备份�?> **审计原则**：只读分析，不修改代码；所有发现必须附带具体文件路径或行号�?
---

## 一、审计维度与检查项

### 1.1 V6 架构主导性（Architecture Ownership�?
| 检查项 | 检查方�?| 关注�?| 结论 |
|:---|:---|:---|:---|
| 评分引擎是否�?V6 L-1~L8 分层运行 | 阅读 `src/services/scoring/v6-engine/` �?`v6ScoreService.ts` | 生产入口是否调用分层引擎 | 🔴 未主导：生产入口仍是旧版 `v6ScoreService.ts` |
| DataBridge 是否�?V6 抽象实现 | 阅读 `src/core/databridge.ts`、`../../../src/showcase/index.ts` | 动作协议、缓存、ACL 完整�?| 🟡 骨架完成，动作枚举与广播有缺�?|
| Store 层是否按 V6 状态层规范 | 抽样阅读 `src/store/*.ts` | 是否溯源 DataBridge、是否广播变�?| 🟡 基本溯源，广播双写未全覆�?|
| types/modules 四步契约 | 阅读 `src/types/modules/*.ts` 与页面组�?| IOModule 声明、页�?`isVisible/isClickable` | 🟡 类型声明完整，页面层落地薄弱 |

### 1.2 双轨/两套组件问题（Dual Implementation�?
| 检查项 | 检查方�?| 关注�?| 结论 |
|:---|:---|:---|:---|
| 是否存在 `apps/*App` �?`pages/*HubPage` 双轨入口 | 阅读 `src/portal/PortalShell.tsx` | `CABIN_APPS` / `HUB_APPS` 双映�?| 🔴 存在�? 个舱室均有两套入�?|
| 是否存在 V6 �?V9 同名组件 | 全局搜索同名 `.tsx` 文件 | 文件名与导出组件名一致但路径不同 | 🔴 存在：NewsPage/NewsCard、SignalMonitorWidget �?|
| 是否存在原型与正式面板重�?| 检�?`src/apps/input/` | 职责与正式面板重�?| 🔴 存在�? 个原型面�?|
| 是否存在未引用孤儿页�?| 检�?`src/apps/command/ConfigApp.tsx` | 是否有路由引�?| 🔴 存在：ConfigPage 无路由引�?|

### 1.3 路由与地址一致性（Routing & Path�?
| 检查项 | 检查方�?| 关注�?| 结论 |
|:---|:---|:---|:---|
| 路由表与规格文档是否一�?| 对比 `src/config/routes.ts` �?`../../reference/06-routing-specs.md` | 路由数量、path、component | 🟡 文档记录 29 条，实际 35 �?|
| 是否存在硬编码路径未注册 | 搜索 `useNavigate` / `<Link to` 中的 path | 是否�?`routes.ts` 注册 | 🔴 存在：`/output/settings` 未注�?|
| 是否存在绕过 PortalShell 的路�?| 检�?`routes.ts` �?component 是否�?`PortalShell` | 独立页面是否缺少舱室布局 | 🔴 存在：`/input/local-knowledge` |
| 是否存在显式保留�?V6 路由 | 检查含 `v6` �?path | 是否按设计保�?| 🟡 存在：`/analysis/news-v6` 为设计保�?|

### 1.4 废弃资产与备份（Legacy & Debris�?
| 检查项 | 检查方�?| 关注�?| 结论 |
|:---|:---|:---|:---|
| 是否存在完整 V6 UI 源码�?| 检�?`v6-ui-assets/` | 是否被源码引�?| 🔴 存在：完整目录，无引�?|
| 是否存在临时备份 | 检�?`temp/backup/` | 是否�?`.bak` 文件 | 🔴 存在：服�?Store/文档备份 |
| 是否存在一次性迁移服务残�?| 检�?`v6MigrationService.ts`、`migrationTransformers.ts` | 是否仍需运行 | 🟡 存在，需评估是否可删�?|
| Store 中是否含 legacy 迁移方法 | 搜索 `legacy*`、`toV9` | 是否可清�?| 🔴 存在：`newsStore.ts` �?`legacyBookmarkToV9` |

---

## 二、审计发现汇总（三色标记�?
| 维度 | 状�?| 说明 |
|:---|:---|:---|
| V6 评分引擎主导�?| 🔴 红色 | �?`v6-engine` 已实现但未接管主流程，旧 `v6ScoreService.ts` 仍在生产路径 |
| 舱室入口统一�?| 🔴 红色 | `PortalShell` 同时维护 `CABIN_APPS` �?`HUB_APPS` 两套映射 |
| 组件唯一�?| 🔴 红色 | 存在 V9/V6 同名组件、原�?正式面板重复、孤儿页�?|
| 路由一致�?| 🟡 黄色 | 数量偏差、一�?404 硬编码路径、一个绕�?PortalShell 的独立页�?|
| 废弃资产清理 | 🔴 红色 | `v6-ui-assets`、`temp/backup`、迁移服务残留、legacy Store 方法 |
| DataBridge 完整�?| 🟡 黄色 | 核心抽象已建立，动作协议与广播双写有缺口 |
| Store 广播双写 | 🟡 黄色 | 部分 Store 实现，未全覆�?|
| 四步契约落地 | 🟡 黄色 | 类型层完整，页面层薄�?|

---

## 三、关键证据（文件路径 / 行号�?
### 3.1 两套舱室入口

```text
src/portal/PortalShell.tsx:39-53   CABIN_APPS / HUB_APPS 双映射表
src/portal/PortalShell.tsx:206-218 �?pathname.endsWith('/hub') 切换渲染
```

### 3.2 旧评分服务仍在生产路�?
```text
src/services/scoring/v6ScoreService.ts:1-60   启发�?9 因子评分逻辑
src/services/scoring/v6-engine/engine.ts      完整 L-1~L8 分层实现（未被主流程调用�?```

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
src/config/routes.ts:226-230   /input/local-knowledge（绕�?PortalShell�?src/pages/output/OutputHubPage.tsx:48   /output/settings（未注册�?```

### 3.5 废弃/临时目录

```text
v6-ui-assets/source-migration/
temp/backup/
src/apps/input/prototype/
```

---

## 四、整改优先级与批�?
| 批次 | 优先�?| 目标 | 范围 |
|:---|:---|:---|:---|
| A | P0 | �?V6 引擎主导评分；消除舱室双轨入�?| `v6-engine`、`v6ScoreService`、`PortalShell` |
| B | P1 | 清理 V6 资产、原型、备份、冗余资讯页 | `v6-ui-assets`、`temp/backup`、`prototype`、`news-v6`、`ConfigPage` |
| C | P1 | 修复路由与布局一致�?| `routes.ts`、`OutputHubPage`、`newsStore` |
| D | P2 | DataBridge、Store 广播、四步契约、文档同�?| `databridge/index.ts`、核�?Store、核心页面、`06-routing-specs.md` |
| E | P2 | 清理迁移服务�?Mock 占位 | `v6MigrationService`、`migrationTransformers`、Mock Providers、`inputService` |

---

## 五、审计产�?
1. `../../reference/completeness-profile.md` �?第十一章新�?V6→V9 架构一致性专项审计�?2. `../v6-v9-architecture-audit-action-list.md` �?26 项问题清单与批次规划�?3. 本文�?`./v6-v9-architecture-audit-plan.md` �?审计方法与关键证据�?
---

## 六、变更日�?
| 日期 | 版本 | 变更内容 | 变更�?|
|:---|:---|:---|:---|
| 2026-06-30 | v1.0.0 | 初始版本 | V9 Quality Audit Team |
