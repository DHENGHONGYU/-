---
title: how-to-add-service
code_version: 2.0.0

tier: important
---

---
title: docs/how-to/how-to-add-service.md
code_version: 2.0.0
tier: important
---

# 如何新增一个 Service（DataBridge + Envelope 路由）

> **版本**：v1.0.0  
> **日期**：2026-07-12  
> **目标**：在 15 分钟内完成新增 Service 的全流程，不踩 ACL 违规、Envelope 遗漏、类型守卫等常见坑

---

## 前置检查

- [ ] 已阅读 `../tutorials/getting-started.md`（了解四步集成契约）
- [ ] 已确定 Service 的数据类型（在 `src/types/` 或 `src/data/types.ts` 中定义）
- [ ] 已确认对应的 IndexedDB store（在 `src/config/dbConfig.ts` 的 `STORE_NAME` 中注册）
- [ ] 已确认 ACL 权限（在 `src/config/dbConfig.ts` 的 `ACL_MATRIX` 中添加读写白名单）
- [ ] 已确认 ENVELOPE_ACTION（在 `src/core/envelope.ts` 或相关枚举中定义）

---

## 步骤 1：定义数据类型（3 分钟）

在 `src/data/types.ts` 中定义 Service 输入/输出相关的类型。

```typescript
// 示例：新增 sectorAnalysisService 的类型
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
```

> **规则**：Service 层返回统一包装类型 `DataLayerResult<T>`：
> ```typescript
> interface DataLayerResult<T> {
>   success: boolean
>   data?: T
>   error?: string
> }
> ```

---

## 步骤 2：创建 Service（5 分钟）

在 `src/services/` 下新建子目录或文件。命名规范：`{domain}/{action}Service.ts`。

### 2.1 标准模板

```typescript
/**
 * @module sectorAnalysisService
 * @description 板块分析数据服务。提供板块评分查询、趋势计算。
 *
 * @see @/store/sectorAnalysisStore.ts - 消费方
 * @see @/data/dataLayer.ts - 底层数据访问
 */

import { dataBridge } from '@/core/databridge'
import { EnvelopeFactory } from '@/core/envelope'
import {
  MODULE_ID,
  ENVELOPE_TARGET,
  ENVELOPE_ACTION,
} from '@/config/dbConfig'
import { dataLayer } from '@/data/dataLayer'
import type { DataLayerResult, SectorAnalysisResult } from '@/data/types'
import { getLogger } from '@/lib/logger'
import { nanoid } from 'nanoid'

const logger = getLogger()

// ============================================================
// 查询接口（不修改数据，直接查询 dataLayer）
// ============================================================

/**
 * 加载全部板块分析数据
 */
export async function loadSectorAnalysis(): Promise<DataLayerResult<SectorAnalysisResult[]>> {
  logger.info('[sectorAnalysisService] loadSectorAnalysis 开始')
  try {
    const list = await dataLayer.sectorScores.list()
    logger.info(`[sectorAnalysisService] loadSectorAnalysis 完成: ${list.length} 条`)
    return { success: true, data: list }
  } catch (err) {
    const message = err instanceof Error ? err.message : '加载板块数据失败'
    logger.error(`[sectorAnalysisService] loadSectorAnalysis 异常: ${message}`)
    return { success: false, error: message }
  }
}

/**
 * 加载指定板块趋势
 */
export async function loadSectorTrend(
  sectorId: string,
): Promise<DataLayerResult<{ date: string; score: number }[]>> {
  logger.info(`[sectorAnalysisService] loadSectorTrend 开始: ${sectorId}`)
  try {
    const result = await dataLayer.sectorScores.getTrend(sectorId)
    return { success: true, data: result }
  } catch (err) {
    const message = err instanceof Error ? err.message : '加载趋势数据失败'
    logger.error(`[sectorAnalysisService] loadSectorTrend 异常: ${message}`)
    return { success: false, error: message }
  }
}

// ============================================================
// 写入接口（通过 DataBridge 路由，确保 ACL 校验与审计）
// ============================================================

/**
 * 保存板块分析结果
 *
 * 通过 DataBridge.forward() 写入，确保 ACL 校验与审计日志。
 */
export async function saveSectorAnalysis(
  data: SectorAnalysisResult,
): Promise<DataLayerResult<void>> {
  logger.info(`[sectorAnalysisService] saveSectorAnalysis 开始: ${data.sectorId}`)

  const envelope = EnvelopeFactory.create(
    {
      source: MODULE_ID.analysis,      // 来源模块
      target: ENVELOPE_TARGET.db,      // 目标：数据库
      action: ENVELOPE_ACTION.insertSectorScore, // 动作类型
      traceId: `sector-${nanoid(8)}-${data.sectorId}`, // 追踪 ID
    },
    data,
  )

  try {
    await dataBridge.forward(envelope)
    logger.info(`[sectorAnalysisService] saveSectorAnalysis 完成: ${data.sectorId}`)
    return { success: true }
  } catch (err) {
    const message = err instanceof Error ? err.message : '保存板块数据失败'
    logger.error(`[sectorAnalysisService] saveSectorAnalysis 异常: ${message}`)
    return { success: false, error: message }
  }
}

/**
 * 批量保存板块分析结果
 */
export async function batchSaveSectorAnalysis(
  items: SectorAnalysisResult[],
): Promise<DataLayerResult<{ saved: number; failed: number }>> {
  logger.info(`[sectorAnalysisService] batchSaveSectorAnalysis 开始: ${items.length} 条`)
  let saved = 0
  let failed = 0

  for (const item of items) {
    const result = await saveSectorAnalysis(item)
    if (result.success) {
      saved++
    } else {
      failed++
      logger.error(`[sectorAnalysisService] 保存失败: ${item.sectorId}, ${result.error}`)
    }
  }

  logger.info(`[sectorAnalysisService] batchSaveSectorAnalysis 完成: saved=${saved}, failed=${failed}`)
  return { success: true, data: { saved, failed } }
}
```

### 2.2 关键要素检查清单

| 要素 | 是否必须 | 说明 | 常见错误 |
|------|----------|------|----------|
| `DataLayerResult<T>` | ✅ 必须 | 统一返回包装 | 返回裸数据，错误处理不一致 |
| `DataBridge.forward()` | ✅ 必须（写入） | 写操作必须经过 ACL | 直接调用 `dataLayer.*.insert()`，绕过 ACL |
| `EnvelopeFactory.create()` | ✅ 必须（写入） | 包含 source/target/action/traceId | 遗漏 traceId，难以追踪 |
| `MODULE_ID` | ✅ 必须 | 来源模块标识 | 使用字符串硬编码 |
| `ENVELOPE_ACTION` | ✅ 必须 | 动作枚举 | 使用字符串硬编码 |
| `logger.info/error` | ✅ 必须 | 核心分支打印 | 无日志，线上调试困难 |
| `try/catch` | ✅ 必须 | 所有 async 操作包裹 | 未捕获异常，导致调用方崩溃 |
| `nanoid` traceId | 🟡 建议 | 唯一追踪标识 | 无 traceId，审计日志难以关联 |

---

## 步骤 3：注册 Envelope Action（2 分钟）

如果使用了新的 `ENVELOPE_ACTION`，必须在 `src/config/dbConfig.ts` 中注册：

```typescript
export enum ENVELOPE_ACTION {
  // ... 现有动作 ...
  insertSectorScore = 'insertSectorScore',
}
```

并在 `src/core/databridge.ts`（或 `DataBridge.routeToDB()`）中添加对应 case：

```typescript
case ENVELOPE_ACTION.insertSectorScore:
  return await dataLayer.sectorScores.insert(payload)
```

---

## 步骤 4：配置 ACL 权限（2 分钟）

在 `src/config/dbConfig.ts` 的 `ACL_MATRIX` 中，为新 store 添加读写白名单：

```typescript
export const ACL_MATRIX = {
  // ... 现有 store ...
  sectorScores: {
    read: [MODULE_ID.analysis, MODULE_ID.tradinghub, MODULE_ID.scoring],
    write: [MODULE_ID.analysis, MODULE_ID.scoring],
  },
} as const
```

> **规则**：read/write 数组中列出允许访问的 `MODULE_ID`。

---

## 步骤 5：验证（3 分钟）

### 5.1 类型检查

```bash
npx tsc --noEmit
```

### 5.2 单元测试（最小模板）

```typescript
import { describe, it, expect, vi } from 'vitest'
import { loadSectorAnalysis, saveSectorAnalysis } from './sectorAnalysisService'
import { dataLayer } from '@/data/dataLayer'

vi.mock('@/data/dataLayer', () => ({
  dataLayer: {
    sectorScores: {
      list: vi.fn(),
      insert: vi.fn(),
    },
  },
}))

describe('sectorAnalysisService', () => {
  it('loadSectorAnalysis should return data', async () => {
    vi.mocked(dataLayer.sectorScores.list).mockResolvedValue([
      { sectorId: '1', sectorName: '半导体', score: 4.5, trend: 'up', updatedAt: Date.now() },
    ])
    const result = await loadSectorAnalysis()
    expect(result.success).toBe(true)
    expect(result.data).toHaveLength(1)
  })

  it('saveSectorAnalysis should use DataBridge', async () => {
    // 验证 Envelope 构造正确...
  })
})
```

### 5.3 架构审计

```bash
npm run audit:layers
# 确认：sectorAnalysisService.ts 无跨层调用违规
```

---

## 常见踩坑与规避

### 坑 1：Service 直接写入 dataLayer（绕过 ACL）

```typescript
// ❌ 错误：直接写入，绕过 ACL 校验与审计
await dataLayer.orders.insert(order)

// ✅ 正确：通过 DataBridge 路由
const envelope = EnvelopeFactory.create({ source, target, action, traceId }, order)
await dataBridge.forward(envelope)
```

### 坑 2：遗漏 traceId

```typescript
// ❌ 错误：无 traceId，审计日志无法关联
EnvelopeFactory.create({ source, target, action }, data)

// ✅ 正确：包含 traceId
EnvelopeFactory.create(
  { source, target, action, traceId: `sector-${nanoid(8)}-${data.sectorId}` },
  data
)
```

### 坑 3：查询操作也走 DataBridge（性能浪费）

```typescript
// ❌ 错误：查询操作走 DataBridge，增加不必要的序列化开销
const envelope = EnvelopeFactory.create({ source, target, action: 'query' }, params)
const result = await dataBridge.forward(envelope)

// ✅ 正确：查询操作直接访问 dataLayer（只读，无需 ACL）
const result = await dataLayer.sectorScores.list()
```

> **原则**：读操作直接访问 `dataLayer`，写操作必须通过 `DataBridge.forward()`。

### 坑 4：Service 依赖 Store（反向依赖违规）

```typescript
// ❌ 错误：Service 依赖 Store（Store 只能被 pages/components 依赖）
import { useAnalysisStore } from '@/store/analysisStore'
const { scores } = useAnalysisStore.getState() // 违规！

// ✅ 正确：Service 接收纯数据参数，不依赖任何 Store
export async function computeScore(input: ScoreInput): Promise<ScoreResult> {
  // 纯计算，无 Store 依赖
}
```

### 坑 5：未在 ACL_MATRIX 中注册权限

```typescript
// 如果 ACL_MATRIX 中未给 sectorScores 配置 write 权限，
// DataBridge.forward() 会抛出 ACL 拒绝错误。
// 务必在新增 store 时同步更新 ACL_MATRIX。
```

---

## 步骤 6：在 Store 中接入（可选）

Service 创建完成后，供 Store 调用：

```typescript
import { loadSectorAnalysis } from '@/services/analysis/sectorAnalysisService'

export const useSectorAnalysisStore = create<SectorAnalysisState>((set, get) => ({
  // ...
  loadSectors: async () => {
    const result = await loadSectorAnalysis()
    if (result.success && result.data) {
      set({ sectors: result.data })
    }
  },
}))
```

---

## 相关文档

| 文档 | 路径 | 说明 |
|------|------|------|
| 新增 Store | `./how-to-add-store.md` | Service 的上游消费方 |
| 新增 Widget | `./how-to-add-widget.md` | Service 的间接消费方 |
| DataBridge 规范 | `../../AGENTS.md` §六 | L4 应用层调用约束 |
| ACL 配置 | `src/config/dbConfig.ts` | 权限矩阵 |
| Envelope 定义 | `src/core/envelope.ts` | 信封工厂 |

---

> **验证完成后**：更新 `docs/README.md` 的 C 类索引，将新增 Service 链接回主索引。