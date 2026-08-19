---
title: completeness-profile-batch2
tier: important
code_version: "2.0.0-rc.2"
version: v1.0.0
last_updated: 2026-08-11
change_log:
  - version: v1.0.0
    changes: "P0 版本闭环(2026-08-11)：补全 change_log 初始条目"
    date: 2026-08-11
---


# V9 模块完成度剖面图 — 批次 B（输入舱）

> **审计范围**：输入舱 6 个子页面  
> **审计方法**：L1 界面 → L2 状态 → L3 数据 → L4 逻辑 → L5 集成  
> **审计日期**：2026-06-27

---

## 批次 B 汇总

| 模块 | L1 界面 | L2 状态 | L3 数据 | L4 逻辑 | L5 集成 | 综合评分 | 健康度 |
|:---|:---|:---|:---|:---|:---|:---|:---|
| B1 输入舱 Hub | ✅ | 🟡 | ✅ | ✅ | ✅ | 90 | 🟢 健康 |
| B2 录入看板 | ✅ | 🟡 | ✅ | ✅ | ✅ | 90 | 🟢 健康 |
| B3 批量导入 | ✅ | 🟡 | ✅ | ✅ | ✅ | 90 | 🟢 健康 |
| B4 热门板块 | ✅ | 🟡 | ✅ | ✅ | ✅ | 90 | 🟢 健康 |
| B5 本地知识库 | ✅ | 🟡 | ✅ | ✅ | ✅ | 90 | 🟢 健康 |
| B6 采集测试 | ✅ | 🟡 | ✅ | ✅ | ✅ | 90 | 🟢 健康 |

---

## B1：输入舱 Hub

| 层级 | 内容 | 状态 | 发现 |
|:---|:---|:---|:---|
| L1 界面 | `InputHubPage.tsx` | ✅ | UI 完整，包含核心功能卡片（录入看板/批量导入/热门板块/采集测试/本地知识库）和可扩展能力卡片（股票池管理/七维采集） |
| L2 状态 | useState | 🟡 | 纯展示页面，仅使用 useState 管理渲染状态，无独立 Zustand Store；因页面功能简单，影响较低 |
| L3 数据 | 无数据接入 | ✅ | 纯导航页面，无需数据接入 |
| L4 逻辑 | 无业务逻辑 | ✅ | 纯展示，无复杂业务逻辑 |
| L5 集成 | 路由已注册 | ✅ | `/input/hub` 已在 `routes.ts:49` 注册，category='input' |

---

## B2：录入看板

| 层级 | 内容 | 状态 | 发现 |
|:---|:---|:---|:---|
| L1 界面 | `InputDashboard.tsx` | ✅ | UI 完整，包含统计卡片、录入表单、StockSearch、PoolBoard（看板/列表视图）、分组管理、数据质量筛选、批量操作 |
| L2 状态 | `usePoolData` hook | 🟡 | 使用 `usePoolData` 自定义 hook 管理股票池数据，无独立 Zustand Store；状态无法跨组件共享 |
| L3 数据 | `inputService` + DataBridge | ✅ | `addStock` 通过 `DataBridge.forward()` 写入，`listStocks/listStocksByStatus` 通过 `dataLayer` 查询 |
| L4 逻辑 | `inputService.ts` | ✅ | 核心逻辑完整：`addStock`（含基础/K线拉取选项）、`searchStocks`（mock 股票库搜索）、`exportPool`/`importPool` |
| L5 集成 | 路由已注册 | ✅ | `/input` 已在 `routes.ts:55` 注册，通过 `InputApp` 子路由分发 |

**问题发现**：快捷操作卡片中仍保留 `/input/prototype` 链接（`InputDashboard.tsx:248`），该路由已从 `routes.ts` 删除，点击将导致 404。

---

## B3：批量导入

| 层级 | 内容 | 状态 | 发现 |
|:---|:---|:---|:---|
| L1 界面 | `BulkImportPanel.tsx` | ✅ | UI 完整，包含文本输入、解析预览表格、目标分组选择、导入结果展示（失败明细） |
| L2 状态 | `usePoolData` hook | 🟡 | 使用 `usePoolData` hook 获取分组列表，无独立 Store |
| L3 数据 | `batchImportService` + DataBridge | ✅ | `importStocks` 调用 `addStock` → `DataBridge.forward()` 写入 |
| L4 逻辑 | `batchImportService.ts` | ✅ | `parseBulkInput` 支持多种格式（CSV/文本/代码），`importStocks` 支持去重和错误记录 |
| L5 集成 | 路由已注册 | ✅ | `/input/bulk-import` 已在 `routes.ts:61` 注册，通过 `InputApp` 子路由分发 |

---

## B4：热门板块

| 层级 | 内容 | 状态 | 发现 |
|:---|:---|:---|:---|
| L1 界面 | `HotSectorPanel.tsx` | ✅ | UI 完整，包含板块选择卡片（含动量/资金指标）、目标分组选择、关联股票列表、单只/批量加入候选池 |
| L2 状态 | `usePoolData` hook + useState | 🟡 | 使用 `usePoolData` 获取股票列表判断已加入状态，无独立 Store |
| L3 数据 | `hotSectorService` + DataBridge | ✅ | `addHotSectorStock`/`addHotSectorStocks` 调用 `addStock` → `DataBridge.forward()` 写入 |
| L4 逻辑 | `hotSectorService.ts` | ✅ | 热门板块数据为配置化样本（HOT_SECTORS），支持按板块代码查询、单只/批量加入候选池 |
| L5 集成 | 路由已注册 | ✅ | `/input/hot-sectors` 已在 `routes.ts:67` 注册，通过 `InputApp` 子路由分发 |

---

## B5：本地知识库

| 层级 | 内容 | 状态 | 发现 |
|:---|:---|:---|:---|
| L1 界面 | `LocalKnowledgePage.tsx` | ✅ | UI 完整，包含三个 Tab：浏览（股票筛选/文档卡片）、搜索（关键词搜索）、统计（文档总数/涉及股票数/分类分布） |
| L2 状态 | useState | 🟡 | 使用 useState 管理文档列表、搜索结果、加载状态，无独立 Zustand Store |
| L3 数据 | `localDocService` + dataLayer | ✅ | `listLocalDocs`/`searchLocalDocs`/`createLocalDoc` 通过 `dataLayer` 操作 IndexedDB |
| L4 逻辑 | `localDocService.ts` | ✅ | 文档管理逻辑完整：列表、搜索、创建、文件夹扫描；支持示例数据导入 |
| L5 集成 | 路由已注册 | ✅ | `/input/local-knowledge` 已在 `routes.ts:189` 注册，独立路由（非 InputApp 子路由） |

---

## B6：采集测试

| 层级 | 内容 | 状态 | 发现 |
|:---|:---|:---|:---|
| L1 界面 | `DataTestPanel.tsx` | ✅ | UI 完整，包含服务健康检查、单接口测试（基础/K线）、批量采集测试（含进度条）、结果表格 |
| L2 状态 | useState | 🟡 | 使用 useState 管理测试状态、结果、进度，无独立 Store |
| L3 数据 | `fetcherService` | ✅ | `checkFetcherHealth`/`fetchStockBasic`/`fetchStockKline` 通过 fetcher 适配器获取数据 |
| L4 逻辑 | `fetcherService.ts` | ✅ | 采集测试逻辑完整：健康检查、基础数据拉取、K线拉取、批量测试（带进度） |
| L5 集成 | 路由已注册 | ✅ | `/input/data-test` 已在 `routes.ts:73` 注册，通过 `InputApp` 子路由分发 |

---

## 批次 B 问题汇总

| 编号 | 模块 | 严重度 | 问题描述 | 文件路径 |
|:---|:---|:---|:---|:---|
| B2-P2-001 | 录入看板 | P2 | 快捷操作卡片中保留 `/input/prototype` 链接，该路由已删除 | `src/apps/input/InputDashboard.tsx:248` |
| B1-P2-002 | 输入舱 Hub | P2 | 无独立 Zustand Store，状态无法跨组件共享 | `src/apps/input/InputApp.tsx` |
| B2-P2-003 | 录入看板 | P2 | 使用 `usePoolData` hook，无独立 Zustand Store | `src/apps/input/InputDashboard.tsx` |
| B3-P2-004 | 批量导入 | P2 | 使用 `usePoolData` hook，无独立 Zustand Store | `src/apps/input/BulkImportPanel.tsx` |
| B4-P2-005 | 热门板块 | P2 | 使用 `usePoolData` hook，无独立 Zustand Store | `src/apps/input/HotSectorPanel.tsx`（已重构，不再存在） |
| B5-P2-006 | 本地知识库 | P2 | 无独立 Zustand Store | `src/pages/input/LocalKnowledgePage.tsx` |
| B6-P2-007 | 采集测试 | P2 | 无独立 Zustand Store | `src/apps/input/DataTestPanel.tsx` |

---

## 批次 B 健康度评估

| 健康度 | 模块数 | 说明 |
|:---|:---|:---|
| 🟢 健康 | 6 | 所有模块 L1-L5 均无 ❌ 缺失层，功能完整可用 |

**结论**：批次 B（输入舱）6 个子页面整体健康，无 P0/P1 级问题。主要优化点为 L2 状态管理层缺少独立 Zustand Store，当前使用 useState 或 usePoolData hook，状态无法跨组件共享，建议后续统一迁移到 Store 模式。