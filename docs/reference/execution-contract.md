---
title: execution-contract
code_version: 2.0.0

tier: important
---

---
title: execution-contract.md — 交易执行子域接口契约
status: draft
owner: 架构组
updated: 2026-07-12
code_version: 2.0.0
tier: important
---

# execution-contract.md — 交易执行子域接口契约

> **定位**：定义 `execution` 子域的接口契约、职责边界、数据流与依赖关系。  
> **关联**：`./services-catalog.md`（24 子域总览）、`../../AGENTS.md` §一（分层规则）。

---

## 1. 职责边界

### 1.1 核心职责

1. **执行计划生命周期管理**：基于交易信号创建执行计划，管理计划的阶段流转（plan → confirmed → executed → reviewed），支持取消操作与孤儿计划查询。
2. **执行日志记录与查询**：记录执行计划每个阶段的实际行为与系统事件，支持按计划、按股票、按失败状态多维查询。
3. **阶段状态机控制**：通过 `PHASE_TRANSITIONS` 状态机约束阶段流转，拒绝非法的状态跃迁。
4. **数据新鲜度校验**：利用 `freshnessGuard` 对执行计划与执行日志进行时间一致性校验（如日志时间戳必须晚于计划创建时间）。

### 1.2 分层定位

| 维度 | 说明 |
|------|------|
| 所属层 | `src/services/`（服务层） |
| 依赖方向 | 只能依赖 `core/`、`data/`、`lib/`（白名单）、`constants/` |
| 禁止事项 | 禁止直写 IndexedDB（经 `dataLayer` Store 间接写入，非 `DataBridge.forward()`） |
| 被依赖方 | `store/`（状态层）、`pages/`（页面层）可消费本服务输出；`useCase` 层有 `createExecutionPlanUseCase` 替代 `createPlan` |

### 1.3 与相邻子域的关系

| 相邻子域 | 关系 | 数据流 |
|----------|------|--------|
| `signals` / `trading` | 上游：提供交易信号 | `Signal` → `executionPlanService.createPlan()` |
| `useCase` | 下游/替代：`createExecutionPlanUseCase` 含风控与仓位计算，已取代旧 `createPlan` | `Signal` → `createExecutionPlanUseCase` → `executionPlanStore` |
| `data/dataLayer` | 下游：持久化存储 | 本服务 → `executionPlanStore` / `executionLogStore` → IndexedDB |
| `core/freshnessGuard` | 基础设施：时间一致性校验 | 本服务 → `checkExecutionPlanFreshness` / `checkExecutionLogFreshness` |

---

## 2. 公共接口

### 2.1 类型定义（TypeScript Interface）

```typescript
// 文件：src/services/execution/executionLogService.ts

export interface WriteLogOptions {
  now?: number
  actor?: string
  details?: string
  success?: boolean
  errorMessage?: string
}
```

```typescript
// 文件：src/services/execution/executionPlanService.ts

export interface CreatePlanOptions {
  now?: number
  confidenceThreshold?: number
  maxPositionPct?: number
  accountType?: ExecutionPlan['accountType']
}

export interface UpdatePhaseOptions {
  now?: number
  actor?: string
}
```

### 2.2 主入口函数

| 函数 | 签名 | 职责 | 错误处理 |
|------|------|------|----------|
| `executionPlanService.createPlan()` | `(signal: Signal, options?: CreatePlanOptions) => Promise<ExecutionPlan \| undefined>` | **@deprecated** 基于信号创建执行计划（旧路径，无风控/无仓位计算） | `logger.error` 记录 + 返回 `undefined` |
| `executionPlanService.listPlans()` | `(symbol?: string) => Promise<ExecutionPlan[]>` | 查询执行计划列表，可按股票过滤 | `logger.error` 记录 + 返回 `[]` |
| `executionPlanService.updatePhase()` | `(planId: string, nextPhase: ExecutionPlan['phase'], options?: UpdatePhaseOptions) => Promise<ExecutionPlan \| undefined>` | 按状态机推进计划阶段，写入阶段流转日志 | `logger.warn` / `logger.error` 记录 + 返回 `undefined` |
| `executionPlanService.cancelPlan()` | `(planId: string, options?: UpdatePhaseOptions) => Promise<ExecutionPlan \| undefined>` | 取消执行计划（需状态机允许） | `logger.warn` / `logger.error` 记录 + 返回 `undefined` |
| `executionPlanService.getOrphanPlans()` | `() => Promise<ExecutionPlan[]>` | 查询非终态的孤儿执行计划 | `logger.error` 记录 + 返回 `[]` |
| `executionLogService.writeLog()` | `(plan: ExecutionPlan, action: ExecutionLogAction, options?: WriteLogOptions) => Promise<ExecutionLog \| undefined>` | 写入一条执行日志 | `logger.error` 记录 + 返回 `undefined` |
| `executionLogService.listByPlan()` | `(planId: string) => Promise<ExecutionLog[]>` | 按执行计划查询日志（时间正序） | `logger.error` 记录 + 返回 `[]` |
| `executionLogService.listBySymbol()` | `(symbol: string) => Promise<ExecutionLog[]>` | 按股票查询日志（时间正序） | `logger.error` 记录 + 返回 `[]` |
| `executionLogService.listFailed()` | `(symbol?: string) => Promise<ExecutionLog[]>` | 查询失败的执行日志 | `logger.error` 记录 + 返回 `[]` |

### 2.3 事件接口

> 当前 `execution` 子域**未直接发布 EventBus 事件**，日志与状态变更通过 `dataLayer` Store 的写入操作间接通知订阅方。

| 事件名 | 发布方 | 订阅方 | 说明 |
|--------|--------|--------|------|
| — | — | — | 无显式 EventBus 事件，数据消费方通过 `dataLayer` 或 `store/` 层监听变化 |

---

## 3. 数据流

```
[交易信号 / 上游服务]
    ↓
executionPlanService.createPlan()  或  createExecutionPlanUseCase()（推荐）
    ↓ (dataLayer Store)
executionPlanStore.save() → IndexedDB
    ↓ (阶段推进/取消时)
executionLogService.writeLog()
    ↓ (dataLayer Store)
executionLogStore.save() → IndexedDB
    ↓ (UI 经 Store 取数)
components/pages (仅经 Store 取数)
```

---

## 4. 配置与依赖

### 4.1 依赖白名单（lib/ + core/ + data/ + constants/）

| 依赖 | 路径 | 用途 |
|------|------|------|
| logger | `@/lib/logger` | 日志输出（`getLogger`） |
| dataLayer | `@/data/dataLayer` | `executionPlanStore`、`executionLogStore` 持久化读写 |
| types | `@/data/types` | `ExecutionPlan`、`ExecutionLog`、`Signal` 类型定义 |
| db | `@/data/db` | `generateId()` 生成日志 ID |
| freshnessGuard | `@/core/freshnessGuard` | `checkExecutionPlanFreshness`、`checkExecutionLogFreshness` 时间校验 |
| execution.constants | `@/constants/execution.constants` | `EXECUTION_PHASE`、`PHASE_TRANSITIONS`、`EXECUTION_LOG_ACTION` 等常量 |

### 4.2 配置项

| 配置名 | 默认值 | 说明 | 来源 |
|--------|--------|------|------|
| `DEFAULT_CONFIDENCE_THRESHOLD` | `0.5` | 信号置信度阈值，低于此值不创建计划 | `@/constants/execution.constants` |
| `DEFAULT_MAX_POSITION_PCT` | `0.1` | 默认最大仓位比例（10%） | `@/constants/execution.constants` |
| `DEFAULT_ACCOUNT_TYPE` | `'paper'` | 默认账户类型（模拟盘） | `@/constants/execution.constants` |

---

## 5. 测试策略

| 测试类型 | 文件 | 说明 |
|----------|------|------|
| 单元测试 | `src/services/execution/executionLogService.test.ts` | `writeLog`、`listByPlan`、`listBySymbol`、`listFailed` 纯逻辑测试 |
| 单元测试 | `src/services/execution/executionPlanService.test.ts` | `createPlan`（@deprecated 旧路径）、`listPlans`、`updatePhase`、`cancelPlan`、`getOrphanPlans` 状态机测试 |
| Mock 策略 | 测试内联 `vi.mock('@/data/dataLayer')` | 隔离 `executionPlanStore` / `executionLogStore` 与 `freshnessGuard` |

> **注**：`createPlan` 相关用例覆盖的是已 `@deprecated` 的旧路径（无风控 / 无仓位计算），仅用于兼容保留，不视为新功能的回归基准。

---

## 6. 变更日志

| 日期 | 版本 | 变更 | 作者 |
|------|------|------|------|
| 2026-07-12 | v0.1.0 | 契约初稿：基于 `executionLogService.ts` + `executionPlanService.ts` 及配套测试生成 | 架构组 |

---

> **TODO[子域 owner]**：
> 1. `createPlan` 已标记 `@deprecated`，需确认 `executionStore.createPlan` / `createExecutionPlanUseCase` 接管进度，完成后移除旧路径及对应测试。
> 2. 考虑补充 EventBus 事件发布（如 `execution:plan-created`、`execution:phase-changed`），便于 `store/` 层订阅。
> 3. 完成后运行 `tsc --noEmit` + `audit:layers` 验证。
