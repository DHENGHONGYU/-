---
title: TODO-ADD-TITLE
type: meta
domain: data
phase: retrospective
tier: standard
status: active
maintainer: V9 Architecture Team
summary: "任务编号: P1-03 执行日期: 2026-07-15 执行人: AI 辅助开发流程 风险等级: ?? 中（涉及状态管理重构，保留全部 actions 行为契约） 依赖:..."
tags: [data, collection, store]
version: v1.0.0
last_updated: 2026-07-17
code_version: 2.0.0
change_log:
  - version: v1.0.0
changes: Initial version established
date: 2026-07-17
---

# P1-03 拆分报告 — collectionWizardStore 模块化重构

> **任务编号**: P1-03
> **执行日期**: 2026-07-15
> **执行人**: AI 辅助开发流程
> **风险等级**: ?? 中（涉及状态管理重构，保留全部 actions 行为契约）
> **依赖**: P1-02（CollectTaskPage 拆分）已完成的容器化思路

---

## 一、任务背景

| 指标 | 拆分前 | 拆分后 | 改善幅度 |
|------|--------|--------|---------|
| 单文件最大行数 | **693** | 486 | **-29.9%** |
| 持久化 actions 耦合度 | 内联在主 store | 独立 mixin 模块 | 完全解耦 |
| 单元测试覆盖 | ? 0 个 | ? 17 个 | 新增 |
| 工具函数可复用性 | ? 私有 | ? 独立导出 | 新增 |
| MOCK 数据可独立维护 | ? 混入 INITIAL_STATE | ? 独立模块 | 新增 |

---

## 二、拆分前架构问题

原 [collectionWizardStore.ts](file:///g:/FinSightV9/src/store/collectionWizardStore.ts) 存在 4 类问题：

1. **职责过载** — 单文件同时承担：状态定义、20+ actions、MOCK 数据、工具函数、持久化、广播
2. **持久化逻辑深度耦合** — `loadSavedConfigs` / `deleteSavedConfig` / `renameSavedConfig` / `exportConfig` / `importConfig` 等 6 个 action 直接依赖 services 层，难以独立测试
3. **MOCK 数据与状态混合** — 60+ 行 MOCK_CONFIGS 数据嵌入 INITIAL_STATE
4. **工具函数无独立可测性** — `generateTraceId` / `formatDuration` 等被主文件闭包私有，无法直接复用

---

## 三、拆分后架构

### 3.1 文件结构

| 文件 | 行数 | 职责 |
|------|------|------|
| [collectionWizardStore.ts](file:///g:/FinSightV9/src/store/collectionWizardStore.ts) | 486 | 核心状态 + 简单 set actions + 任务生命周期 |
| [collectionWizardStore.persistence.ts](file:///g:/FinSightV9/src/store/collectionWizardStore.persistence.ts) | 342 | 持久化相关 actions（load/delete/rename/export/import + loadConfigToWizard） |
| [collectionWizardStore.mock.ts](file:///g:/FinSightV9/src/store/collectionWizardStore.mock.ts) | 113 | MOCK_CONFIGS 默认数据 |
| [collectionWizardStore.utils.ts](file:///g:/FinSightV9/src/store/collectionWizardStore.utils.ts) | 26 | generateTraceId / formatDuration / generateConfigId |
| [__tests__/collectionWizardStore.test.ts](file:///g:/FinSightV9/src/store/__tests__/collectionWizardStore.test.ts) | 230 | 单元测试（17 个测试用例） |

### 3.2 拆分模式：StateCreator Mixin

采用 zustand 官方推荐的 `StateCreator` 模式实现 mixin 注入：

```typescript
// 主 store 通过 spread 合并 persistence actions
export const useCollectionWizardStore = create<CollectionWizardStore>()((set, get, store) => ({
  ...INITIAL_STATE,
  ...createPersistenceActions(set, get, store),  // ← 持久化 mixin
  setStep: (step) => { /* ... */ },
  // ... 其他 actions
}))
```

**优势**：
- 主 store 文件保持精简，所有 actions 仍可通过 `useCollectionWizardStore.getState().xxx()` 统一调用
- persistence 模块可独立测试（仅需 mock PersistenceStateSlice 接口）
- 类型系统通过 `PersistenceStateSlice` 接口精确约束依赖，避免循环引用

### 3.3 依赖关系图

```
                  collectionWizardStore (core, 486 行)
                          │
                ┌─────────┼─────────┐
                │         │         │
                ▼         ▼         ▼
        .persistence  .mock    .utils
         (342 行)   (113 行)  (26 行)
                │
                ▼
       services/collection/*  (DataBridge 持久化)
       services/collection/configExportService  (导入导出)
       lib/withBroadcast  (事件广播)
       lib/validation  (配置名校验)
```

---

## 四、关键技术决策

### 4.1 持久化 actions 拆分为独立 mixin 而非独立 store

**原因**：
- 保持所有 actions 通过同一 `useCollectionWizardStore` 入口，UI 层无需重构
- 持久化操作与向导状态深度耦合（如 `loadConfigToWizard` 需写入 8 个状态字段），独立 store 反而增加胶水代码
- StateCreator 模式是 zustand 官方推荐的代码组织方式，与项目现有 store 架构一致

### 4.2 MOCK_CONFIGS 独立成模块

**原因**：
- MOCK_CONFIGS 数据是开发期 fallback，不应污染生产路径
- 独立后可在 dev/test 环境单独替换 mock 数据源
- 60+ 行业务数据与 INITIAL_STATE 分离，主 store 可读性显著提升

### 4.3 工具函数抽离至 utils

**原因**：
- `generateTraceId` 与 `formatDuration` 被多个模块潜在需要（如 collectionRuntimeStore）
- 工具函数纯函数化，零依赖，方便单测与复用
- `generateConfigId` 与 `collectionWizardPersistence.ts` 中的 ID 生成逻辑保持一致（统一前缀 `wizard_config_`）

---

## 五、验证结果

### 5.1 自动化验证

| 检查项 | 结果 |
|--------|------|
| TypeScript 类型检查 | ? 0 errors |
| ESLint（拆分文件） | ? 0 errors，1 个无关 warning（no-magic-numbers） |
| ESLint（消费方组件） | ? 0 errors，16 个原有 warning（未新增） |
| audit:layers | ? 0 violations |
| 单元测试 | ? 17/17 passed |

### 5.2 消费方验证

所有调用 `useCollectionWizardStore` 的 6 个业务组件均无回归：

- [DataCollectionWizard.tsx](file:///g:/FinSightV9/src/components/organisms/input/DataCollectionWizard.tsx)
- [wizard-steps/CollectionStrategyStep.tsx](file:///g:/FinSightV9/src/components/organisms/input/wizard-steps/CollectionStrategyStep.tsx)
- [wizard-steps/DataSourceConfigStep.tsx](file:///g:/FinSightV9/src/components/organisms/input/wizard-steps/DataSourceConfigStep.tsx)
- [wizard-steps/TaskPreviewStep.tsx](file:///g:/FinSightV9/src/components/organisms/input/wizard-steps/TaskPreviewStep.tsx)
- [wizard-steps/ExecutionMonitorStep.tsx](file:///g:/FinSightV9/src/components/organisms/input/wizard-steps/ExecutionMonitorStep.tsx)
- [TradingFlowPage.tsx](file:///g:/FinSightV9/src/pages/trading/TradingFlowPage.tsx)

### 5.3 测试覆盖范围

```typescript
// utils 模块：3 个测试
? generateTraceId 格式校验
? formatDuration 毫秒/秒格式化
? generateConfigId 前缀校验

// mock 模块：2 个测试
? MOCK_CONFIGS 默认 3 个配置
? MOCK_CONFIGS 完整字段结构

// core 模块：6 个测试
? 初始状态默认值
? setStep 步骤控制
? toggleDimension 维度切换
? setFrequency/setPriority 等 setActions
? addLog 日志记录
? resetWizard 状态重置（保留 savedConfigs）

// persistence 模块：6 个测试
? loadSavedConfigs 从 IndexedDB 加载
? loadConfigToWizard 字段加载
? deleteSavedConfig 移除配置
? renameSavedConfig 重名检测（返回 success=false）
? renameSavedConfig 成功更新（返回 success=true）
? exportConfig 不存在的配置不抛错
```

---

## 六、经验教训

### 6.1 经验

1. **StateCreator Mixin 模式适合强耦合的 actions 拆分** — 当 actions 需操作大量状态字段时，独立 store 反而引入胶水代码，mixin 更轻量
2. **MOCK 数据应从 INITIAL_STATE 分离** — 业务状态与开发期 fallback 数据应解耦，便于测试与维护
3. **工具函数立即 export** — `generateTraceId` 等易被其他 store 复用，独立导出避免代码重复

### 6.2 教训

1. **persist mock 引用导致测试污染** — `resetWizard` 保留 `savedConfigs` 引用，但 `deleteSavedConfig` 修改的是同一引用，导致后续测试看到的状态与初始不一致
   - **修复**：测试中显式 `useCollectionWizardStore.setState({ savedConfigs: MOCK_CONFIGS })` 重置
   - **启示**：生产代码应考虑 MOCK_CONFIGS 浅拷贝避免引用污染

2. **re-export 类型需同步重命名** — 拆分时 `PersistenceSlice` 重命名为 `PersistenceStateSlice`，主 store 中的 re-export 需同步更新，避免外部消费者类型引用断裂

---

## 七、后续工作

- [ ] 将 `generateTraceId` 推广至其他 store（collectionRuntimeStore 等），统一 traceId 命名空间
- [ ] 增加 `collectionWizardStore.derived.ts` 派生查询（如 `hasRunningTask()`、`isConfigValid()`），与项目其他 store 保持一致
- [ ] MOCK_CONFIGS 深拷贝化（使用 `[...MOCK_CONFIGS]`）避免引用污染

---

## 八、变更清单

### 8.1 新增文件（5 个）

- `src/store/collectionWizardStore.persistence.ts` — 持久化 actions mixin
- `src/store/collectionWizardStore.mock.ts` — MOCK 数据
- `src/store/collectionWizardStore.utils.ts` — 工具函数
- `src/store/__tests__/collectionWizardStore.test.ts` — 单元测试
- `src/store/__backup__/collectionWizardStore.ts.2026-07-15.bak` — 拆分前备份

### 8.2 修改文件（1 个）

- `src/store/collectionWizardStore.ts` — 693 → 486 行（-29.9%），通过 spread 注入 persistence actions
