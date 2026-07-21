---
title: Service 集成开发指南
status: draft
owner: services 子域 owner / 架构组
updated: 2026-07-20
---

# Service 集成开发指南

> **定位**：本文是 `src/services/` 层的新增/维护 Service 的**权威操作手册**，与 `AGENTS.md` §一（分层规则）、§二（四步集成）和 `docs/guides/how-to-add-service.md`（实操模板）共同构成 Service 开发的三级文档体系。
>
> **权威契约**：`AGENTS.md` v1.4.3。当本文与 `AGENTS.md` 冲突时，以 `AGENTS.md` 为准。
>
> **状态**：骨架版（P1），关键节点标记 `[TODO]` 待架构组/各子域 owner 扩写。

---

## 相关文档

| 文档 | 路径 | 职责 |
|------|------|------|
| 工程分层契约 | [`../../AGENTS.md`](../../AGENTS.md) | 分层规则、四步集成、依赖方向铁律 |
| 新增 Service 实操 | [`../guides/how-to-add-service.md`](../guides/how-to-add-service.md) | 15 分钟快速创建 Service 的模板与踩坑指南 |
| 服务子域目录 | [`../reference/services-catalog.md`](../reference/services-catalog.md) | 24 子域清单与职责摘要 |
| 全局架构总览 | [`../architecture/overview.md`](../architecture/overview.md) | 数据流、三级加载链、引擎分层 |
| 新增 Store 指南 | [`../guides/how-to-add-store.md`](../guides/how-to-add-store.md) | Service 的上游消费方（Zustand Store） |
| 编码规范 | [`../standards/coding-conventions.md`](../standards/coding-conventions.md) | JSDoc、复杂度、命名规范 |
| 数据库配置 | `src/config/dbConfig.ts` | `STORE_NAME`、`ACL_MATRIX`、`ENVELOPE_ACTION` 定义 |
| Envelope 工厂 | `src/core/envelope.ts` | 信封构造与类型守卫 |
| DataBridge 核心 | `src/core/databridge.ts` | 路由分发与 ACL 校验 |

---

## 1. 分层定位与依赖规则

### 1.1 Service 层在架构中的位置

```
config/constants/types（零运行时依赖）
        ↑
    core/（DataBridge/ACL/Envelope/EventBus/MemoryCache）
        ↑
   data/（IndexedDB/dataLayer/queryBuilder）
        ↑
    lib/（白名单基础设施）
        ↑
services/（本层：24 子域） ← 只能依赖 core/、data/、lib/（白名单）
        ↑
   store/（49 Zustand Store + withBroadcast）
        ↑
components/pages/portal（UI 层）
```

**铁律**：
- `services/` → 只能依赖 `core/`、`data/` 和 `lib/`（**仅限白名单**）。
- `services/` **禁止**直接写 `db`（IndexedDB），写操作必须通过 `DataBridge.forward()` 路由。
- `services/` **禁止**依赖 `store/`（Store 只能被 pages/components 依赖）。
- `services/` **禁止**依赖 `lib/` 中的业务模块（仅限白名单基础设施）。

### 1.2 验证命令

```powershell
npm run audit:layers
# 期望：0 violations, 0 warnings
```

---

## 2. Service 创建四步（Type → Store → Service → UI）

> 来源：`AGENTS.md` §二。新模块必须按以下顺序集成，**每步可独立回滚**。

### 步骤 1：类型定义（Interface）

在 `src/types/modules/` 或 `src/data/types.ts` 中定义 Service 的输入/输出类型。

```typescript
// src/data/types.ts — 示例：新增 sectorAnalysisService 的类型
export interface SectorAnalysisInput {
  sectorId: string
  dateRange?: { start: string; end: string }
}

export interface SectorAnalysisResult {
  sectorId: string
  sectorName: string
  score: number
  trend: 'up' | 'down' | 'flat'
  updatedAt: number
}

// 统一返回包装（建议）
export interface DataLayerResult<T> {
  success: boolean
  data?: T
  error?: string
}
```

**规则**：
- 所有数据结构必须先定义 TypeScript Interface，禁止使用 `any`。
- 复杂泛型必须有 `Expect<Equals>` 类型测试（位于 `tests/__tests__/types/`）。
- 修改已有类型不得破坏相关 `*.spec.ts` 测试。

**回滚**：仅删除类型文件，不影响其他层。

---

### 步骤 2：Store / 状态（Zustand + withBroadcast）

在 `src/store/` 中创建 Zustand Store，通过 `withBroadcast` 实现跨 Tab 广播。

```typescript
// src/store/sectorAnalysisStore.ts — 示例
import { create } from 'zustand'
import { withBroadcast } from '@/store/helpers/withBroadcast'
import { loadSectorAnalysis } from '@/services/analysis/sectorAnalysisService'
import type { SectorAnalysisResult } from '@/data/types'

interface SectorAnalysisState {
  sectors: SectorAnalysisResult[]
  loading: boolean
  error: string | null
  loadSectors: () => Promise<void>
}

export const useSectorAnalysisStore = create<SectorAnalysisState>()(
  withBroadcast('sectorAnalysis', (set) => ({
    sectors: [],
    loading: false,
    error: null,
    loadSectors: async () => {
      set({ loading: true, error: null })
      const result = await loadSectorAnalysis()
      if (result.success && result.data) {
        set({ sectors: result.data, loading: false })
      } else {
        set({ error: result.error ?? '加载失败', loading: false })
      }
    },
  })),
)
```

**规则**：
- Store 命名：`{domain}Store.ts`（camelCase + `Store` 后缀）。
- Store 只能依赖 `services/` 和 `core/`，禁止直接调用 `dataLayer` 或 `db`。
- 跨 Tab 状态同步必须通过 `withBroadcast` 实现。

**回滚**：删除 Store 文件 + 从 `src/store/index.ts`（如存在聚合导出）移除引用。

> [TODO 扩写]：Store 与 Service 的交互模式（乐观更新、缓存策略、错误重试）。由 store 治理组补充。

---

### 步骤 3：Builder / 适配层（Service）

在 `src/services/` 中创建 Service，通过 `DataBridge` 写入数据。

#### 3.1 目录与文件位置

```
src/services/
├── {subdomain}/           # 子域目录（如 analysis/、scoring/、trading/）
│   ├── index.ts           # 子域聚合导出（可选）
│   ├── {action}Service.ts # 具体服务文件（如 sectorAnalysisService.ts）
│   └── __tests__/         # 子域级单元测试
├── contracts/             # 服务间共享类型
├── errorBus/              # 错误总线
├── resilience/            # 弹性/重试/熔断
├── unifiedStockService.ts # 顶层：统一股票数据服务
├── riskControlService.ts  # 顶层：风控服务
└── feedbackService.ts     # 顶层：用户反馈服务
```

#### 3.2 标准 Service 模板

```typescript
/**
 * @module sectorAnalysisService
 * @description 板块分析数据服务。提供板块评分查询、趋势计算。
 * @see @/store/sectorAnalysisStore.ts — 消费方
 * @see @/data/dataLayer.ts — 底层数据访问（仅查询）
 * @see @/core/databridge.ts — 写入路由（ACL + 审计）
 */

import { dataBridge } from '@/core/databridge'
import { EnvelopeFactory } from '@/core/envelope'
import { MODULE_ID, ENVELOPE_TARGET, ENVELOPE_ACTION } from '@/config/dbConfig'
import { dataLayer } from '@/data/dataLayer'
import type { DataLayerResult, SectorAnalysisResult } from '@/data/types'
import { getLogger } from '@/lib/logger'
import { nanoid } from 'nanoid'

const logger = getLogger()

// ============================================================
// 查询接口（只读，直接访问 dataLayer）
// ============================================================

export async function loadSectorAnalysis(): Promise<DataLayerResult<SectorAnalysisResult[]>> {
  logger.info('[sectorAnalysisService] loadSectorAnalysis 开始')
  try {
    const list = await dataLayer.sectorScores.list()
    logger.info(`[sectorAnalysisService] loadSectorAnalysis 完成: ${list.length} 条`)
    return { success: true, data: list }
  } catch (err) {
    const message = err instanceof Error ? err.message : '加载板块数据失败'
    logger.error('[sectorAnalysisService] loadSectorAnalysis 异常', { error: message })
    return { success: false, error: message }
  }
}

// ============================================================
// 写入接口（通过 DataBridge.forward()，确保 ACL + 审计）
// ============================================================

export async function saveSectorAnalysis(
  data: SectorAnalysisResult,
): Promise<DataLayerResult<void>> {
  logger.info(`[sectorAnalysisService] saveSectorAnalysis 开始: ${data.sectorId}`)

  const envelope = EnvelopeFactory.create(
    {
      source: MODULE_ID.analysis,
      target: ENVELOPE_TARGET.db,
      action: ENVELOPE_ACTION.insertSectorScore,
      traceId: `sector-${nanoid(8)}-${data.sectorId}`,
    },
    data,
  )

  try {
    await dataBridge.forward(envelope)
    logger.info(`[sectorAnalysisService] saveSectorAnalysis 完成: ${data.sectorId}`)
    return { success: true }
  } catch (err) {
    const message = err instanceof Error ? err.message : '保存板块数据失败'
    logger.error('[sectorAnalysisService] saveSectorAnalysis 异常', { error: message })
    return { success: false, error: message }
  }
}
```

**关键要素检查清单**：

| 要素 | 是否必须 | 说明 | 常见错误 |
|------|----------|------|----------|
| `DataLayerResult<T>` | ✅ 必须 | 统一返回包装 | 返回裸数据，错误处理不一致 |
| `DataBridge.forward()` | ✅ 必须（写入） | 写操作必须经过 ACL 校验 | 直接调用 `dataLayer.*.insert()`，绕过 ACL |
| `EnvelopeFactory.create()` | ✅ 必须（写入） | 包含 source/target/action/traceId | 遗漏 traceId，难以追踪 |
| `MODULE_ID` | ✅ 必须 | 来源模块标识 | 使用字符串硬编码 |
| `ENVELOPE_ACTION` | ✅ 必须 | 动作枚举，须在 `dbConfig.ts` 注册 | 使用字符串硬编码 |
| `logger.info/error` | ✅ 必须 | 核心分支打印（filter reset、modal submission、data fusion） | 无日志，线上调试困难 |
| `try/catch` | ✅ 必须 | 所有 async 操作包裹 | 未捕获异常，导致调用方崩溃 |
| `nanoid` traceId | 🟡 建议 | 唯一追踪标识，便于审计日志关联 | 无 traceId，问题排查困难 |

**回滚**：删除 Service 文件 + 从子域 `index.ts` 移除导出。需同步检查 `ENVELOPE_ACTION` 和 `ACL_MATRIX` 是否有残留引用。

> [TODO 扩写]：Service 内部模块拆分必要性评估框架（何时拆分子目录、何时使用 `contracts/`）。参考 `AGENTS.md` §十三。由架构组补充决策树与评分权重。

---

### 步骤 4：核心集成（UI 层）

在 `src/pages/` 或 `src/components/` 中创建 UI，**仅通过 Store 获取数据**。

```typescript
// src/pages/analysis/SectorAnalysisPage.tsx — 示例
import { useSectorAnalysisStore } from '@/store/sectorAnalysisStore'

export function SectorAnalysisPage() {
  const { sectors, loading, error, loadSectors } = useSectorAnalysisStore()

  // 禁止直接调用 Service 或 dataLayer
  // ❌ import { loadSectorAnalysis } from '@/services/analysis/sectorAnalysisService'
  // ❌ await dataLayer.sectorScores.list()

  return (
    <div>
      {loading && <Spinner />}
      {error && <ErrorBanner message={error} />}
      <SectorTable data={sectors} />
    </div>
  )
}
```

**铁律**：
- `pages/` 和 `components/` 只能依赖 `store/` 和 `services/`。
- 禁止直接调用 `dataLayer` 或 `db`。
- 禁止在 UI 组件中直接调用 `DataBridge.forward()`（这属于跨层调用）。

**回滚**：删除 UI 文件 + 从路由注册表移除（如已注册）。回滚后必须执行：

```powershell
npx tsc --noEmit
npm run audit:docs
npm run audit:layers
npm run test -- --run
```

> 详见 `AGENTS.md` §二「回滚验证流程」。

---

## 3. DataBridge 使用规范

### 3.1 核心原则：读直连，写路由

```
┌─────────────────────────────────────────────────────────────┐
│  查询操作（只读）                                              │
│  Service → dataLayer.*.list/get/query() → IndexedDB           │
│  无需 DataBridge，性能最优                                     │
├─────────────────────────────────────────────────────────────┤
│  写入操作（增删改）                                            │
│  Service → EnvelopeFactory.create() → dataBridge.forward()    │
│  → ACL 校验 → dataLayer.*.insert/update/delete() → IndexedDB │
│  必须经 DataBridge，确保权限与审计                               │
└─────────────────────────────────────────────────────────────┘
```

### 3.2 `forward()` 路由规范

写入操作必须构造 `Envelope` 并调用 `dataBridge.forward()`：

```typescript
const envelope = EnvelopeFactory.create(
  {
    source: MODULE_ID.{module},   // 来源模块，须在 dbConfig.ts 注册
    target: ENVELOPE_TARGET.db,   // 目标：固定为 db
    action: ENVELOPE_ACTION.{action}, // 动作枚举，须在 dbConfig.ts 注册
    traceId: `${prefix}-${nanoid(8)}-${id}`, // 唯一追踪 ID
  },
  payload, // 业务数据
)

await dataBridge.forward(envelope)
```

### 3.3 `DataBridge.routeToDB()` 注册

新增 `ENVELOPE_ACTION` 后，必须在 `src/core/databridge.ts`（或 `DataBridge.routeToDB()`）中添加对应 `case`：

```typescript
// src/core/databridge.ts
switch (action) {
  // ... 现有 case ...
  case ENVELOPE_ACTION.insertSectorScore:
    return await dataLayer.sectorScores.insert(payload)
  // TODO: 新增 action 时在此追加 case
}
```

> [TODO 扩写]：DataBridge 的 ACL 校验流程图、审计日志格式、失败重试策略。由 core 组补充。

### 3.4 常见错误

| 错误模式 | 后果 | 修复 |
|----------|------|------|
| 写入直接调用 `dataLayer.*.insert()` | 绕过 ACL 与审计，安全隐患 | 改为 `DataBridge.forward()` |
| 查询也走 `DataBridge.forward()` | 不必要的序列化开销，性能下降 | 查询直接调用 `dataLayer` |
| `traceId` 遗漏 | 审计日志无法关联，问题排查困难 | 强制包含 `traceId` |
| `ENVELOPE_ACTION` 未注册 | `routeToDB()` 抛出未处理异常 | 同步更新 `dbConfig.ts` + `databridge.ts` |

---

## 4. lib 基础设施白名单

`services/` 允许依赖 `lib/` 中的以下模块，**禁止**依赖其他 `lib/` 模块（尤其是业务模块）：

| 模块 | 路径 | 用途 | 注意事项 |
|------|------|------|----------|
| `logger` | `src/lib/logger.ts` | 结构化日志输出 | 所有 Service 必须引入；前缀格式 `[模块名] 操作名` |
| `withBroadcast` | `src/store/helpers/withBroadcast.ts` | 跨 Tab 状态广播 | 仅 Store 层使用，Service 层不直接使用 |
| `eventBus` | `src/lib/eventBus.ts` | 发布/订阅事件总线 | Service 间解耦通信（见 §6） |
| `format` | `src/lib/format.ts` | 数据格式化工具 | 日期、金额、百分比等通用格式化 |
| `errors` | `src/lib/errors.ts` | 错误类定义与处理 | 统一错误构造、错误码映射 |
| `utils` | `src/lib/utils.ts` | 通用工具函数 | 纯函数，无副作用 |
| `localStorageManager` | `src/lib/localStorageManager.ts` | 本地存储管理 | LLM API Key 等敏感数据须用 `setEncrypted/getEncrypted` |
| `safeCoerce` | `src/lib/safeCoerce.ts` | 安全类型转换 | 防御性编程，避免运行时类型错误 |
| `perf` | `src/lib/perf.ts` | 性能测量工具 | 关键路径耗时打点 |

**禁止示例**：

```typescript
// ❌ 错误：依赖 lib/ 中的业务模块（不在白名单）
import { someBusinessHelper } from '@/lib/businessHelpers'

// ❌ 错误：依赖 store/（反向依赖）
import { useAnalysisStore } from '@/store/analysisStore'

// ❌ 错误：依赖 pages/（严重跨层）
import { AnalysisPage } from '@/pages/analysis/AnalysisPage'
```

**验证**：

```powershell
npm run audit:layers
# 期望 services/ 无跨层调用、无 lib/ 非白名单依赖
```

---

## 5. 服务子域命名规范

### 5.1 子域目录命名

- 子域目录：`kebab-case`（如 `data-collector/`、`hybrid-proofread/`）。
- 子域数量：当前 24 个（详见 [`services-catalog.md`](../reference/services-catalog.md)）。
- 新增子域须经架构组评审，避免职责重叠。

### 5.2 Service 文件命名

| 模式 | 示例 | 适用场景 |
|------|------|----------|
| `{action}Service.ts` | `sectorAnalysisService.ts` | 单一职责服务 |
| `{domain}Service.ts` | `portfolioService.ts` | 领域聚合服务 |
| `index.ts` | `src/services/analysis/index.ts` | 子域聚合导出（可选） |

### 5.3 函数命名

| 操作类型 | 前缀 | 示例 |
|----------|------|------|
| 查询（单条） | `load` / `get` | `loadSectorAnalysis()` / `getSectorById()` |
| 查询（列表） | `load` / `list` | `loadSectorAnalysis()` / `listOrders()` |
| 写入（单条） | `save` / `create` | `saveSectorAnalysis()` / `createOrder()` |
| 写入（批量） | `batchSave` / `bulkCreate` | `batchSaveSectorAnalysis()` |
| 更新 | `update` | `updatePortfolioWeights()` |
| 删除 | `delete` / `remove` | `deleteOrder()` |
| 计算（无副作用） | `compute` / `calculate` | `computeRiskScore()` / `calculateMA()` |

---

## 6. 子域间通信

### 6.1 通信原则

Service 子域之间**禁止**直接 import 对方内部文件（避免循环依赖与耦合）。通信通过以下两种机制：

1. **EventBus**（事件总线）：异步、解耦、广播式。
2. **错误总线**（`errorBus/`）：统一错误聚合与上报。

### 6.2 EventBus 通信规范

```typescript
import { EventBus } from '@/lib/eventBus'

// 发布事件
EventBus.publish('sector:score:updated', {
  sectorId: 'semiconductor',
  score: 4.5,
  timestamp: Date.now(),
})

// 订阅事件（必须在 cleanup 中移除）
const handler = (data: SectorScoreEvent) => {
  // 处理逻辑
}
EventBus.subscribe('sector:score:updated', handler)
// 清理时：EventBus.unsubscribe('sector:score:updated', handler)
```

**标准清理模板**：

```typescript
// ✅ 模板：EventBus 订阅清理
useEffect(() => {
  const handler = (data: unknown) => { /* 处理逻辑 */ }
  EventBus.subscribe('eventName', handler)
  return () => EventBus.unsubscribe('eventName', handler)
}, [])

// ✅ 模板：多个监听器批量清理
useEffect(() => {
  const cleanupFns: Array<() => void> = []
  cleanupFns.push(EventBus.subscribe('event1', handler1))
  cleanupFns.push(EventBus.subscribe('event2', handler2))
  return () => cleanupFns.forEach(fn => fn())
}, [])

// ❌ 禁止：在 cleanup 中使用 EventBus.clear()（会影响其他订阅者）
```

**命名规范**：事件名采用 `domain:action:status` 格式（如 `sector:score:updated`、`trade:order:failed`）。

> [TODO 扩写]：EventBus 事件清单与语义规范（当前事件注册表位置、新增事件审批流程）。由 eventBus owner 补充。

### 6.3 错误总线（errorBus）

```typescript
import { errorBus } from '@/services/errorBus'

// 上报错误
errorBus.report({
  module: MODULE_ID.analysis,
  service: 'sectorAnalysisService',
  operation: 'saveSectorAnalysis',
  error: err,
  traceId: envelope.traceId,
  severity: 'error', // 'warn' | 'error' | 'critical'
})
```

**规则**：
- 所有 Service 的 `catch` 块必须向错误总线上报（或至少打印 `logger.error`）。
- 严重错误（`critical`）须触发用户可见通知。
- 错误总线数据用于质量门禁 `audit:token` 与运维监控。

> [TODO 扩写]：errorBus 的聚合策略、上报频率控制、与外部监控系统的对接方式。由 resilience 组补充。

---

## 7. 新服务创建 Checklist

> 本文档的 Checklist 与 `../guides/how-to-add-service.md` 互补：本文侧重架构合规，后者侧重实操模板。

### 7.1 创建前

- [ ] 确认 Service 的职责边界，不与其他 24 子域重叠（参考 [`services-catalog.md`](../reference/services-catalog.md)）。
- [ ] 确定数据类型，已在 `src/types/modules/` 或 `src/data/types.ts` 中定义 Interface。
- [ ] 确认对应的 IndexedDB store：
  - [ ] 在 `src/config/dbConfig.ts` 的 `STORE_NAME` 中注册（新增 store 时）。
  - [ ] 确认 `DB_VERSION` 已递增（新增 store 时）。
  - [ ] 确认创建逻辑在 `createSchema`（基线）或对应 `Migration.up()`（增量）中。
- [ ] 确认 `ACL_MATRIX` 已配置读写白名单（新增 store 时）。
- [ ] 确认 `ENVELOPE_ACTION` 已定义（新增动作时）。

### 7.2 创建中

- [ ] 按 §2 四步顺序创建：Type → Store → Service → UI（可独立回滚）。
- [ ] Service 文件包含 JSDoc（`@module`、`@description`、`@see`）。
- [ ] 查询操作直接访问 `dataLayer`，写入操作通过 `DataBridge.forward()`。
- [ ] 所有 `async` 操作包裹 `try/catch`，返回 `DataLayerResult<T>`。
- [ ] 核心分支包含 `logger.info`/`logger.error`（含 context 对象）。
- [ ] 无 `services/` → `store/` 反向依赖。
- [ ] 无 `services/` → `lib/` 非白名单依赖。
- [ ] 无 `any` 类型，无 `@ts-ignore`（使用 `@ts-expect-error` 并附注释）。

### 7.3 创建后验证

- [ ] `npx tsc --noEmit` — 类型检查零错误。
- [ ] `npm run lint` — ESLint 零错误。
- [ ] `npm run audit:layers` — 零跨层违规。
- [ ] `npm run audit:hardcode` — 零颜色硬编码（如 Service 生成 UI 相关配置）。
- [ ] `npm run audit:docs` — 文档同步零漂移。
- [ ] `npm test -- --run` — 单元测试通过（新增 Service 须补充测试）。
- [ ] `npm run build` — 生产构建通过（如涉及新增路由或页面）。

### 7.4 文档与索引

- [ ] 新 Service 已注册到 `../reference/services-catalog.md`（如新增子域）。
- [ ] 新文档已回链 `docs/README.md` 对应类目（F 类：AI 辅助工程治理）。
- [ ] 双向引用检查：本文引用了 `AGENTS.md`，`AGENTS.md` 或相关索引应引用本文。
- [ ] 变更日志已记录（如需）于 `docs/changelogs/YYYY-MM/`。

---

## 8. 验证与门禁

| 门禁 | 命令 | 预期 | 失败处置 |
|------|------|------|----------|
| 类型检查 | `npx tsc --noEmit` | 零错误 | 禁止提交 |
| ESLint | `npm run lint` | 零错误 | 禁止提交 |
| 分层审计 | `npm run audit:layers` | 0 violations | 禁止提交 |
| 硬编码审计 | `npm run audit:hardcode` | 0 违规 | 禁止提交 |
| 死代码审计 | `npm run audit:deadcode` | 0 未注册页面 | 禁止提交 |
| 文档同步 | `npm run audit:docs` | 0 漂移 | 禁止提交 |
| 令牌合规 | `npm run audit:tokens` | 基线 ratchet 通过 | 禁止提交 |
| JSDoc 审计 | `npm run audit:jsdoc` | 0 缺失 | 禁止提交 |
| 复杂度审计 | `npm run audit:complexity` | 0 深层嵌套/长链 | 禁止提交 |
| 单元测试 | `npm test -- --run` | 全部通过 | 禁止提交 |
| 生产构建 | `npm run build` | 成功 | 禁止提交 |

---

## 9. 版本与变更

| 版本 | 日期 | 变更摘要 |
|------|------|----------|
| v0.1.0 | 2026-07-20 | 骨架版创建：四步集成、DataBridge 规范、lib 白名单、命名规范、子域通信、Checklist。 |

> **兼容性**：本文档基于 `AGENTS.md` v1.4.3 编写。当 `AGENTS.md` 版本升级时，须同步修订本文。

---

> 本文档由 AI 文档工程师生成，经架构组审核后发布。如有疑问，请联系 `services` 子域 owner 或架构组。
