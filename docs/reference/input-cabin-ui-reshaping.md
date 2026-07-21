---
title: 输入舱 UI 体系化重塑说明
type: reference
domain: frontend
phase: design
tier: standard
status: active
maintainer: V9 Architecture Team
summary: "参考 `F:\投资赛道分析\dashboard_v2.html` 的 Kimi 经典布局架构，对 V9 输入舱进行体系化重塑。本次重塑坚持「React 组件化 + V9 数据协议」，禁止静态嵌入 UI..."
tags: [frontend, input-cabin, api]
version: v1.0.0
last_updated: 2026-07-17
code_version: 2.0.0
doc_id: V9-DOC-FRONT-024
referenced_by: [V9-DOC-PROJ-174, V9-DOC-META-000, V9-DOC-PROJ-164, V9-DOC-PROJ-176, V9-DOC-PROJ-182, V9-DOC-PROJ-149]
change_log:
  - version: v1.0.0
changes: Initial version established
date: 2026-07-17
---

# 输入舱 UI 体系化重塑说明

> **Status**: Current  
> **Version**: v0.9.0-docs-review  
> **Last Updated**: 2026-06-24
>
> 参考 `F:\投资赛道分析\dashboard_v2.html` 的 Kimi 经典布局架构，对 V9 输入舱进行体系化重塑。本次重塑坚持「React 组件化 + V9 数据协议」，禁止静态嵌入 UI 组件。

---

## 1. 参考布局到 V9 的映射

| 参考要素 | V9 实现 | 文件 |
|----------|---------|------|
| 深色主题（`#0f172a` 背景） | Tailwind `dark` 类 + 现有 CSS 变量 | `src/index.css`、`src/portal/PortalShell.tsx` |
| 顶部状态栏（56px） | `PortalShell` TopBar | `src/portal/PortalShell.tsx` |
| 左侧侧边栏（260px，分组导航） | `PortalShell` Sidebar | `src/portal/PortalShell.tsx` |
| 卡片网格 / 数据表格 | `Card`、`Table`、`PoolBoard` 等组件 | `src/components/ui/*`、`src/components/pool/*` |
| 标签 / 徽章 | `Badge` 组件 | `src/components/atoms/Badge.tsx` |
| 进度条 | `DataTestPanel` 进度条 | `src/apps/input/DataTestPanel.tsx` |

---

## 2. 架构变更

### 2.1 PortalShell 重塑

`PortalShell` 现在是全局深色经典布局容器：

- **TopBar**：左侧 V9 Logo 徽章 + 系统标题；中间五舱导航 + 驾驶舱入口；右侧采集服务健康点、运行时长、版本号。
- **Sidebar**：260px 宽，按舱室分组显示功能入口，支持分组标题、图标、当前项高亮。
- **Main**：面包屑/标题区 + 子应用内容区。

### 2.2 输入舱子页面拆分

`InputApp` 不再是巨石组件，而是按路径分发的布局组件，承载四个子页面：

| 路径 | 组件 | 说明 |
|------|------|------|
| `/input` | `InputDashboard` | 录入看板：统计卡片、单条录入、股票池看板 |
| `/input/bulk-import` | `BulkImportPanel` | 批量导入：文本解析、预览、导入结果 |
| `/input/hot-sectors` | `HotSectorPanel` | 热门板块：板块卡片、关联股票、加入候选池 |
| `/input/data-test` | `DataTestPanel` | 采集测试：服务健康、单/批量接口测试 |

### 2.3 路由与侧边栏映射

- `src/config/routes.ts` 注册了 `/input/bulk-import`、`/input/hot-sectors`、`/input/data-test`。
- `PortalShell` 的 `PANEL_ITEMS` 扩展为分组结构，输入舱侧边栏分为「候选池」和「数据采集」两组。
- 点击侧边栏项直接导航到对应 URL，实现 URL 与视图的同步。

### 2.4 数据协议

所有数据交互继续使用 V9 既有服务层：

- 单条录入：`inputService.addStock`
- 批量导入：`batchImportService.importStocks`
- 热门板块：`hotSectorService.addHotSectorStock` / `addHotSectorStocks`
- 股票池看板：`usePoolData` + `PoolBoard`
- 分析入口：导航到 `/analysis/stock-score/:symbol`

未引入 `dashboard_v2.html` 中的任何 `/api/*` 路径。

---

## 3. 文件清单

| 文件 | 变更 |
|------|------|
| `src/portal/PortalShell.tsx` | 重写为深色经典布局容器 |
| `src/apps/input/InputApp.tsx` | 改为按路径分发的布局组件 |
| `src/apps/input/InputDashboard.tsx` | 新增录入看板 |
| `src/apps/input/BulkImportPanel.tsx` | 新增批量导入页面 |
| `src/apps/input/HotSectorPanel.tsx` | 新增热门板块页面 |
| `src/apps/input/DataTestPanel.tsx` | 保留并作为子页面使用 |
| `src/config/routes.ts` | 注册输入舱子路由 |
| `src/services/input/batchImportService.ts` | 修复 `代码,名称` 解析 bug |
| `tests/InputApp.test.tsx` | 适配新的子页面结构 |
| `./06-routing-specs.md` | 同步路由表与舱室映射 |
| `./08-implementation-plan.md` | 更新实施状态 |
| `CHANGELOG.md` | 记录本次重塑 |

---

## 4. 验收结果

| 门禁 | 状态 |
|------|------|
| `tsc --noEmit` | ? 通过 |
| `eslint src/` | ? 通过 |
| `vitest run` | ? 291/291 通过 |
| `vite build` | ? 通过 |
| `npm run audit:layers` | ? 0 违规 / 0 警告 |
