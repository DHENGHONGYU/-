# Gateway 层写入权限规范

> **版本**: v1.0.0 | **日期**: 2026-07-13
> **基于**: V9 AGENTS.md §一 分层规则
> **目标**: 将直接操作 `dataLayer` 的特权收敛到 Gateway 单一入口，DataBridge 通过 Gateway 间接写入

---

## 1. 设计目标

| 目标 | 说明 |
|---|---|
| **写入收口** | 只有 `Gateway` 能直接调用 `dataLayer.*.save/delete/update`；`DataBridge` 不再直接 `import { db } from '@/data/db'`。 |
| **DataBridge 间接写入** | `DataBridge.forward()` 将 `StandardEnvelope` 路由到 `Gateway.execute()`，由 Gateway 完成最终持久化。 |
| **统一接口** | 所有写入请求必须封装为 `StandardEnvelope`，含 `meta`（来源/目标/动作/追踪）+ `payload`。 |
| **ACL 下沉** | Gateway 内部复用 `ACL_MATRIX`，在"最后一公里"再做一次写权限校验（深度防御）。 |
| **可测试** | Gateway 可 mock，DataBridge 单元测试无需初始化 IndexedDB。 |

---

## 2. 架构位置与分层规则

```
┌─────────────────────────────────────────┐
│  pages / components / UI                │  ← 禁止直接写 dataLayer
├─────────────────────────────────────────┤
│  store / services                       │  ← 写操作必须走 dataBridge.forward(envelope)
├─────────────────────────────────────────┤
│  core / DataBridge                      │  ← 只负责路由、缓存、广播、审计
│                                         │    禁止直接 import db / dataLayer store
├─────────────────────────────────────────┤
│  data / gateway / DataGateway.ts        │  ← 唯一允许直接操作 dataLayer 的层
│  data / dataLayer / *Stores.ts          │  ← 各 domain store 实现
└─────────────────────────────────────────┘
```

### 2.1 强制规则

- `core/databridge.ts` 中删除 `import { db } from '@/data/db'`，改为 `import { dataGateway } from '@/data/gateway/dataGateway'`。
- `core/databridgeHandlers.ts` 中的 Handler 不再直接 `db.put/store.save`，而是构造 `StandardEnvelope` 并调用 `dataGateway.execute(envelope)`。
- `data/gateway/` 只向外暴露 `execute(envelope)` 与只读元数据接口（如 `getSupportedActions()`）。
- `store/`、`services/`、`components/` 禁止 `import { dataLayer } from '@/data/dataLayer'` 执行写操作。

### 2.2 写入权限矩阵

| 层级 | 能否直接写 dataLayer | 必须使用的入口 |
|---|---|---|
| `components/` / `pages/` | ❌ 禁止 | 通过 Store → Service → DataBridge.forward |
| `store/` | ❌ 禁止 | 通过 Service → DataBridge.forward |
| `services/` | ❌ 禁止 | `dataBridge.forward(StandardEnvelope)` |
| `core/DataBridge` | ❌ 禁止 | 将 `StandardEnvelope` 转交给 `DataGateway.execute()` |
| `data/gateway/` | ✅ 唯一允许 | `dataLayer[storeName].save/delete/saveMany` |

---

## 3. StandardEnvelope 统一数据格式

复用并细化现有 `StandardEnvelope`，保持与当前 `src/core/envelope.ts` 兼容。

```typescript
// src/types/modules/envelope.types.ts
import type { EnvelopeAction, EnvelopeTarget, ModuleId } from '@/config/dbConfig'

export interface EnvelopeMeta {
  /** 调用方模块 ID，用于 ACL */
  source: ModuleId
  /** 目标路由，如 'db' | 'event' | 'strategy:hotSector' */
  target: EnvelopeTarget
  /** 具体动作，如 'SAVE_STOCK' | 'DELETE_ORDER' */
  action: EnvelopeAction
  /** 全局唯一追踪 ID，用于链路追踪与审计 */
  traceId: string
  /** 信封创建时间戳（毫秒） */
  timestamp: number
}

export interface StandardEnvelope<TPayload = unknown> {
  meta: EnvelopeMeta
  payload: TPayload
}

/** 写请求结果（Gateway 返回） */
export interface GatewayWriteResult {
  success: boolean
  /** 写入后的主键/标识 */
  key?: string
  /** 影响行数/记录数 */
  affectedCount?: number
  error?: string
}
```

---

## 4. Gateway 层 TypeScript 接口定义

```typescript
// src/data/gateway/dataGateway.ts
import { ENVELOPE_ACTION, STORE_NAME, type EnvelopeAction, type StoreName } from '@/config/dbConfig'
import { dataLayer } from '@/data/dataLayer'
import { getLogger } from '@/lib/logger'
import { aclEngine, inferOperation } from '@/core/acl'
import { EnvelopeFactory, type StandardEnvelope, type GatewayWriteResult } from '@/types/modules/envelope.types'

const logger = getLogger()

/** action → dataLayer store 的显式映射（集中管理，避免分散推断） */
const ACTION_TO_DATALAYER_STORE: Record<string, keyof typeof dataLayer> = {
  [ENVELOPE_ACTION.insertStock]: 'stockStore',
  [ENVELOPE_ACTION.updateStock]: 'stockStore',
  [ENVELOPE_ACTION.deleteStock]: 'stockStore',
  [ENVELOPE_ACTION.saveScores]: 'v6ScoreStore',
  [ENVELOPE_ACTION.saveDailyQuotes]: 'dailyQuoteStore',
  [ENVELOPE_ACTION.saveFinancialReport]: 'financialReportStore',
  [ENVELOPE_ACTION.saveIntelligentScores]: 'intelligentScoreStore',
  [ENVELOPE_ACTION.saveIndustryScores]: 'industryScoreStore',
  [ENVELOPE_ACTION.saveRotationScores]: 'rotationScoreStore',
  [ENVELOPE_ACTION.saveSectorScores]: 'sectorScoreStore',
  [ENVELOPE_ACTION.saveScoreDocs]: 'scoreDocStore',
  [ENVELOPE_ACTION.saveStrategySnapshots]: 'strategySnapshotStore',
  [ENVELOPE_ACTION.saveHotSectorScores]: 'hotSectorScoreStore',
  [ENVELOPE_ACTION.saveValuePitScores]: 'valuePitScoreStore',
  [ENVELOPE_ACTION.saveLocalDocs]: 'localDocStore',
  [ENVELOPE_ACTION.saveNews]: 'newsStore',
  [ENVELOPE_ACTION.saveNewsStockMap]: 'newsStockMapStore',
  [ENVELOPE_ACTION.saveSentimentCache]: 'sentimentCacheStore',
  [ENVELOPE_ACTION.saveResearchLog]: 'researchLogStore',
  [ENVELOPE_ACTION.insertSignal]: 'signalStore',
  [ENVELOPE_ACTION.insertOrder]: 'orderStore',
  [ENVELOPE_ACTION.updateOrder]: 'orderStore',
  [ENVELOPE_ACTION.deleteOrder]: 'orderStore',
  [ENVELOPE_ACTION.saveTradeReview]: 'tradeReviewStore',
  [ENVELOPE_ACTION.saveExecutionPlan]: 'executionPlanStore',
  [ENVELOPE_ACTION.updateExecutionPlan]: 'executionPlanStore',
  [ENVELOPE_ACTION.deleteExecutionPlan]: 'executionPlanStore',
  [ENVELOPE_ACTION.saveExecutionLog]: 'executionLogStore',
  [ENVELOPE_ACTION.saveMissingReport]: 'missingReportStore',
  [ENVELOPE_ACTION.savePortfolio]: 'portfolioStore',
  [ENVELOPE_ACTION.saveWatchlist]: 'watchlistStore',
  [ENVELOPE_ACTION.saveCustomAgent]: 'customAgentStore',
  [ENVELOPE_ACTION.saveCollectConfig]: 'collectConfigStore',
  // ... 其他 action 按 store 归类补充
}

export class DataGateway {
  /**
   * Gateway 唯一公开写入口
   * 1. 校验 StandardEnvelope
   * 2. ACL 二次校验
   * 3. 路由到 dataLayer 对应 store
   */
  async execute(envelope: StandardEnvelope): Promise<GatewayWriteResult> {
    const { meta } = envelope

    // 1. 信封格式校验
    const validation = EnvelopeFactory.validate(envelope)
    if (!validation.valid) {
      logger.error(`[DataGateway] Envelope invalid: ${validation.error}`, { meta })
      return { success: false, error: validation.error }
    }

    // 2. 路由解析
    const storeName = ACTION_TO_DATALAYER_STORE[meta.action]
    if (!storeName) {
      return { success: false, error: `Unsupported action: ${meta.action}` }
    }

    // 3. ACL 校验（写操作）
    const operation = inferOperation(meta.action)
    try {
      aclEngine.assert({ module: meta.source, store: storeName as unknown as StoreName, operation })
    } catch (aclErr) {
      const reason = aclErr instanceof Error ? aclErr.message : String(aclErr)
      logger.error(`[DataGateway] ACL denied: ${reason}`, { meta })
      return { success: false, error: reason }
    }

    // 4. 执行写入
    try {
      const result = await this.routeToStore(envelope, storeName)
      logger.info(`[DataGateway] Write succeeded: action=${meta.action}, store=${storeName}, traceId=${meta.traceId}`)
      return { success: true, ...result }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      logger.error(`[DataGateway] Write failed: action=${meta.action}, store=${storeName}`, { error: err })
      return { success: false, error: message }
    }
  }

  /** 返回 Gateway 支持的所有 action 清单，供 DataBridge 路由决策 */
  getSupportedActions(): readonly EnvelopeAction[] {
    return Object.keys(ACTION_TO_DATALAYER_STORE) as EnvelopeAction[]
  }

  private async routeToStore(
    envelope: StandardEnvelope,
    storeName: keyof typeof dataLayer,
  ): Promise<{ key?: string; affectedCount?: number }> {
    const store = dataLayer[storeName]
    if (!store) {
      throw new Error(`DataLayer store "${storeName}" not found`)
    }

    const { meta, payload } = envelope

    // 统一调用 dataLayer store 的 save / delete 语义
    // 约定：所有 store 都实现 { save(item), delete(id), saveMany(items) }
    if (meta.action.includes('DELETE')) {
      const id = (payload as { id: string }).id
      await store.delete(id)
      return { affectedCount: 1 }
    }

    if (meta.action.startsWith('BULK_')) {
      const items = payload as unknown[]
      await store.saveMany(items)
      return { affectedCount: items.length }
    }

    // 默认 save
    const key = await store.save(payload)
    return { key: key as string }
  }
}

export const dataGateway = new DataGateway()
```

---

## 5. DataBridge 改造示例

`DataBridge.routeToDB()` 不再直接 `db.put`，而是委托给 `dataGateway.execute()`。

```typescript
// src/core/databridge.ts
import { dataGateway } from '@/data/gateway/dataGateway'

export class DataBridge {
  // ... query / subscribe / broadcast 保持不变 ...

  private async routeToDB(envelope: StandardEnvelope, store: StoreName): Promise<void> {
    const { meta } = envelope
    logger.debug(`[DataBridge] routeToDB() via Gateway: action="${meta.action}", store="${store}"`)

    const result = await dataGateway.execute(envelope)
    if (!result.success) {
      throw new EnvelopeError(`Gateway write failed: ${result.error}`)
    }
  }
}
```

---

## 6. 服务层使用示例

```typescript
// src/services/system/customAgentService.ts
import { EnvelopeFactory } from '@/core/envelope'
import { ENVELOPE_ACTION } from '@/config/dbConfig'
import { dataBridge } from '@/core/databridge'
import { nanoid } from 'nanoid'

export async function saveCustomAgent(agent: CustomAgent): Promise<void> {
  const envelope = EnvelopeFactory.create(
    {
      source: 'system',
      target: 'db',
      action: ENVELOPE_ACTION.saveCustomAgent,
      traceId: `custom-agent-${nanoid(8)}`,
    },
    agent,
  )

  await dataBridge.forward(envelope)
}
```

---

## 7. 迁移路径（建议分 3 步）

1. **新增 Gateway**：创建 `src/data/gateway/dataGateway.ts`，把 `ACTION_TO_STORE_MAP` 从 `databridge.ts` 迁移过来，并对接 `dataLayer`。
2. **改造 DataBridge**：`routeToDB` 与 `databridgeHandlers.ts` 改为调用 `dataGateway.execute()`，删除 `import { db }`。
3. **清理上层**：使用 `Grep` 扫描 `src/store`、`src/services`、`src/components` 中直接 `import { dataLayer }` 的写操作，逐个改为 `dataBridge.forward`。

---

## 8. 验证方式

```powershell
# 1. 确认 DataBridge 不再直接依赖 db
rg "import\s+\{\s*db\s*\}\s+from\s+['\"]@/data/db['\"]" src/core

# 2. 确认只有 data/gateway 直接 import dataLayer
rg "from\s+['\"]@/data/dataLayer['\"]" src --count

# 3. 架构审计
npm run audit:layers

# 4. 类型检查
npx tsc --noEmit
```

---

## 9. 相关文档

- [V9 AGENTS.md](../../AGENTS.md) — 分层规则与依赖方向
- [FILE-MANAGEMENT-GUIDE.md](../01-requirements/FILE-MANAGEMENT-GUIDE.md) — 文件入-移-出全生命周期
