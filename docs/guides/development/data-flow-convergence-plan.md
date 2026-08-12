---
title: Data Flow Convergence Plan
type: explanation
domain: data
phase: design
tier: important
status: active
maintainer: V9 Architecture Team
summary: "数据流架构收敛方案，Widget → Store 双通道统一，包含 Phase 1 桥接、Phase 2 迁移、Phase 3 规划。"
tags: [data, architecture, widget, store, convergence]
version: v1.2
last_updated: 2026-07-18
code_version: "2.0.0-rc.1"
doc_id: V9-DOC-DATA-030
change_log:
  - version: v1.2
changes: Phase 1 bridge + Phase 2 migration completed, Phase 3 planning
date: 2026-07-18
---

# 数据流架构收敛方案：Widget → Store 双通道统一

> **日期**: 2026-07-18 | **版本**: v1.2（Phase 1+2 已完成） | **状态**: Phase 1 桥接 + Phase 2 迁移完成，Phase 3 规划中
> **关联**: `outputs/mock-diagnosis-report-2026-07-18.html` §四·维度

---

## 1. 现状分析

### 1.1 双通道架构（现状）

```
┌──────────────────────────────────────────────────┐
│                 taskScheduler                    │
│         (统一数据采集任务调度器)                  │
└─────────┬──────────────────────┬─────────────────┘
          │ subscribe            │ subscribe
          │                      │
┌─────────▼──────────┐  ┌────────▼───────────────┐
│ MarketDataProvider │  │  marketDataStore       │
│  (React Context)   │  │  (Zustand Store)       │
│                    │  │                        │
│ adapt → merge      │  │  adapt → merge         │
│  → local useState  │  │  → Zustand state       │
└────────┬───────────┘  └────────┬───────────────┘
         │                       │
         │ useMarketData()       │ useMarketDataStore()
         │                       │
┌────────▼───────────┐  ┌────────▼───────────────┐
│  18 Cockpit        │  │  36 Pages              │
│  Widgets           │  │  (analysis/trading/...)│
└────────────────────┘  └────────────────────────┘
```

**问题**：
- 两条管道独立订阅 taskScheduler，各自适配和合并数据
- Widget 数据不写入 Store，Page 数据不被 Widget 感知
- 数据不一致风险：同一股票在 Widget 与 Page 中显示不同价格

### 1.2 涉及文件

| 通道 | 核心文件 | 消费方 |
|------|---------|--------|
| Context | `cockpit/providers/MarketDataProvider.tsx` | 18 个 Widget |
| Store | `store/marketDataStore.ts` | ~36 个 Page |

---

## 2. 目标架构

```
┌──────────────────────────────────────────────────┐
│                 taskScheduler                    │
└──────────────────────┬───────────────────────────┘
                       │ subscribe (单一入口)
                       │
┌──────────────────────▼───────────────────────────┐
│             marketDataStore (CANONICAL)          │
│        唯一数据事实源，统一适配与合并             │
│        marketDataAdapter.adapt() → merge()       │
└──────┬────────────────────────────────┬──────────┘
       │                                │
       │ useMarketDataStore()           │ useMarketData()
       │ (Page 用)                      │ (Widget 用，经 Phase 2 迁移到 Store)
       │                                │
┌──────▼───────────┐          ┌───────────▼──────────┐
│  36 Pages        │          │  18 Widgets          │
└──────────────────┘          └──────────────────────┘
```

---

## 3. 收敛路线图

### Phase 1: 数据桥接（✅ 已完成 2026-07-18）

**目标**：Widget 采集的数据同时写入 Store，Page 可读取但 Widget 仍从 Context 读取

**改动**：
1. 在 `marketDataStore.ts` 添加 `mergeAdaptedData(adapted: Partial<MarketData>)` 方法
2. 在 `MarketDataProvider.tsx` 的 `handleCollectionResult` 回调中，`adapt()` 后调用 `useMarketDataStore.getState().mergeAdaptedData(adapted)`
3. 验证：Page 刷新后能看到 Widget 采集的数据

**风险**：低（单向写入，不影响 Widget 现有行为）

### Phase 2: Widget 读取迁移（✅ 已完成 2026-07-18）

**目标**：Widget 改为从 marketDataStore 读取数据，移除 Context 直连）

**改动**：
1. 在 `marketDataStore.ts` 添加 `sendChatMessage()` 方法（原在 Provider 内）
2. 修改 `useMarketData()` hook，内部调用 `useMarketDataStore()` 而非 `useContext(MarketDataContext)`
3. 修改 `useOptionalMarketData()` 同理
4. Widget 零改动（import 路径不变，消费模式不变）

**验证**：
- `tsc --noEmit`: 0 错误
- marketDataStore 测试: 23/23 ✅
- 桥接集成测试: 11/11 ✅
- Widget 测试（1 文件）159/159 ✅
- CockpitShell 测试: 15/15 ✅

**风险**：低（Widget 不修改 import，仅 hook 内部实现切换）

### Phase 3: 移除双通道（远期）

**目标**：marketDataStore 成为唯一数据获取路径。

**改动**：
1. 删除 MarketDataProvider 中的 `handleCollectionResult` 订阅与 `useState` 本地状态
2. marketDataStore 接管所有 taskScheduler 订阅和适配逻辑
3. 删除 `MarketDataProvider` 组件

---

## 4. 相关架构模式

### 4.1 数据流原则

| 原则 | 说明 |
|------|------|
| 单一事实源 | 相同数据概念只在一个 Store 中维护 |
| 写入归一 | 所有数据写入经 DataBridge.forward() |
| 读取委派 | UI 通过 Store 读取，不直接 fetch/订阅 |

### 4.2 已遵循的模块

以下模块已符合目标架构：
- `inputService → DataBridge → intentionPoolStore → UI`
- `scoring service → DataBridge → dualStrategyStore → UI`
- `collectionPipeline → DataBridge → collectionRuntimeStore → UI`

### 4.3 待收敛的模块

| 模块 | 当前 | 目标 |
|------|------|------|
| Cockpit Widget 数据 | Context 直发 | Store 读取 |
| executionPlanService | 直连 dataLayer store | DataBridge.forward() |
| indexedDBProvider | 直连 23 个 dataLayer store | DataBridge.forward()/query() |
| portfolioService | 直连 portfolioStore | DataBridge.forward() |

---

## 5. 立即验证

以下验证在 Phase 1 完成后执行：

```bash
# 类型检查
npx tsc --noEmit

# 分层审计
npm run audit:layers

# Widget 测试
node ./node_modules/vitest/vitest.mjs run src/cockpit/

# 全量 Store 测试
node ./node_modules/vitest/vitest.mjs run src/store/
```

---

*本文档随架构收敛进展更新。Phase 1 完成后更新至 v1.1。*
