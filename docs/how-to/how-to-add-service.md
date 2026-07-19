---
title: 如何新增一�?Service（DataBridge + Envelope 路由�?
type: how-to
domain: backend
phase: development
tier: standard
status: active
maintainer: V9 Architecture Team
summary: "版本：v1.0.0 日期�?026-07-12 目标：在 15 分钟内完成新�?Service 的全流程，不�?ACL 违规、Envelope 遗漏、类型守卫等常见�?"
tags: [backend, databridge, data]
version: v1.0.0
last_updated: 2026-07-17
code_version: 2.0.0
doc_id: V9-DOC-BACK-027
referenced_by: [V9-DOC-META-000, V9-DOC-BACK-026, V9-DOC-PROJ-122, V9-DOC-PROJ-176, V9-DOC-PROJ-157, V9-DOC-BACK-033, V9-DOC-BACK-045, V9-DOC-PROJ-149]
change_log:
  - version: v1.0.0
changes: Initial version established
date: 2026-07-17
---

# 如何新增一�?Service（DataBridge + Envelope 路由�?
> **版本**：v1.0.0  
> **日期**�?026-07-12  
> **目标**：在 15 分钟内完成新�?Service 的全流程，不�?ACL 违规、Envelope 遗漏、类型守卫等常见�?
---

## 前置检�?
- [ ] 已阅�?`../tutorials/getting-started.md`（了解四步集成契约）
- [ ] 已确�?Service 的数据类型（�?`src/types/` �?`src/data/types.ts` 中定义）
- [ ] 已确认对应的 IndexedDB store（在 `src/config/dbConfig.ts` �?`STORE_NAME` 中注册）
- [ ] 已确�?ACL 权限（在 `src/config/dbConfig.ts` �?`ACL_MATRIX` 中添加读写白名单�?- [ ] 已确�?ENVELOPE_ACTION（在 `src/core/envelope.ts` 或相关枚举中定义�?
---

## 步骤 1：定义数据类型（3 分钟�?
�?`src/data/types.ts` 中定�?Service 输入/输出相关的类型�?
```typescript
// 示例：新�?sectorAnalysisService 的类�?export interface SectorAnalysisInput {
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

> **规则**：Service 层返回统一包装类型 `DataLayerResult<T>`�?> ```typescript
> interface DataLayerResult<T> {
>   success: boolean
>   data?: T
>   error?: string
> }
> ```

---

## 步骤 2：创�?Service�? 分钟�?
�?`src/services/` 下新建子目录或文件。命名规范：`{domain}/{action}Service.ts`�?
### 2.1 标准模板

```typescript
/**
 * @module sectorAnalysisService
 * @description 板块分析数据服务。提供板块评分查询、趋势计算�? *
 * @see @/store/sectorAnalysisStore.ts - 消费�? * @see @/data/dataLayer.ts - 底层数据访问
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
// 查询接口（不修改数据，直接查�?dataLayer�?// ============================================================

/**
 * 加载全部板块分析数据
 */
export async function loadSectorAnalysis(): Promise<DataLayerResult<SectorAnalysisResult[]>> {
  logger.info('[sectorAnalysisService] loadSectorAnalysis 开�?)
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
  logger.info(`[sectorAnalysisService] loadSectorTrend 开�? ${sectorId}`)
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
// 写入接口（通过 DataBridge 路由，确�?ACL 校验与审计）
// ============================================================

/**
 * 保存板块分析结果
 *
 * 通过 DataBridge.forward() 写入，确�?ACL 校验与审计日志�? */
export async function saveSectorAnalysis(
  data: SectorAnalysisResult,
): Promise<DataLayerResult<void>> {
  logger.info(`[sectorAnalysisService] saveSectorAnalysis 开�? ${data.sectorId}`)

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
  logger.info(`[sectorAnalysisService] batchSaveSectorAnalysis 开�? ${items.length} 条`)
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

### 2.2 关键要素检查清�?
| 要素 | 是否必须 | 说明 | 常见错误 |
|------|----------|------|----------|
| `DataLayerResult<T>` | �?必须 | 统一返回包装 | 返回裸数据，错误处理不一�?|
| `DataBridge.forward()` | �?必须（写入） | 写操作必须经�?ACL | 直接调用 `dataLayer.*.insert()`，绕�?ACL |
| `EnvelopeFactory.create()` | �?必须（写入） | 包含 source/target/action/traceId | 遗漏 traceId，难以追�?|
| `MODULE_ID` | �?必须 | 来源模块标识 | 使用字符串硬编码 |
| `ENVELOPE_ACTION` | �?必须 | 动作枚举 | 使用字符串硬编码 |
| `logger.info/error` | �?必须 | 核心分支打印 | 无日志，线上调试困难 |
| `try/catch` | �?必须 | 所�?async 操作包裹 | 未捕获异常，导致调用方崩�?|
| `nanoid` traceId | 🟡 建议 | 唯一追踪标识 | �?traceId，审计日志难以关�?|

---

## 步骤 3：注�?Envelope Action�? 分钟�?
如果使用了新�?`ENVELOPE_ACTION`，必须在 `src/config/dbConfig.ts` 中注册：

```typescript
export enum ENVELOPE_ACTION {
  // ... 现有动作 ...
  insertSectorScore = 'insertSectorScore',
}
```

并在 `src/core/databridge.ts`（或 `DataBridge.routeToDB()`）中添加对应 case�?
```typescript
case ENVELOPE_ACTION.insertSectorScore:
  return await dataLayer.sectorScores.insert(payload)
```

---

## 步骤 4：配�?ACL 权限�? 分钟�?
�?`src/config/dbConfig.ts` �?`ACL_MATRIX` 中，为新 store 添加读写白名单：

```typescript
export const ACL_MATRIX = {
  // ... 现有 store ...
  sectorScores: {
    read: [MODULE_ID.analysis, MODULE_ID.tradinghub, MODULE_ID.scoring],
    write: [MODULE_ID.analysis, MODULE_ID.scoring],
  },
} as const
```

> **规则**：read/write 数组中列出允许访问的 `MODULE_ID`�?
---

## 步骤 5：验证（3 分钟�?
### 5.1 类型检�?
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
      { sectorId: '1', sectorName: '半导�?, score: 4.5, trend: 'up', updatedAt: Date.now() },
    ])
    const result = await loadSectorAnalysis()
    expect(result.success).toBe(true)
    expect(result.data).toHaveLength(1)
  })

  it('saveSectorAnalysis should use DataBridge', async () => {
    // 验证 Envelope 构造正�?..
  })
})
```

### 5.3 架构审计

```bash
npm run audit:layers
# 确认：sectorAnalysisService.ts 无跨层调用违�?```

---

## 常见踩坑与规�?
### �?1：Service 直接写入 dataLayer（绕�?ACL�?
```typescript
// �?错误：直接写入，绕过 ACL 校验与审�?await dataLayer.orders.insert(order)

// �?正确：通过 DataBridge 路由
const envelope = EnvelopeFactory.create({ source, target, action, traceId }, order)
await dataBridge.forward(envelope)
```

### �?2：遗�?traceId

```typescript
// �?错误：无 traceId，审计日志无法关�?EnvelopeFactory.create({ source, target, action }, data)

// �?正确：包�?traceId
EnvelopeFactory.create(
  { source, target, action, traceId: `sector-${nanoid(8)}-${data.sectorId}` },
  data
)
```

### �?3：查询操作也�?DataBridge（性能浪费�?
```typescript
// �?错误：查询操作走 DataBridge，增加不必要的序列化开销
const envelope = EnvelopeFactory.create({ source, target, action: 'query' }, params)
const result = await dataBridge.forward(envelope)

// �?正确：查询操作直接访�?dataLayer（只读，无需 ACL�?const result = await dataLayer.sectorScores.list()
```

> **原则**：读操作直接访问 `dataLayer`，写操作必须通过 `DataBridge.forward()`�?
### �?4：Service 依赖 Store（反向依赖违规）

```typescript
// �?错误：Service 依赖 Store（Store 只能�?pages/components 依赖�?import { useAnalysisStore } from '@/store/analysisStore'
const { scores } = useAnalysisStore.getState() // 违规�?
// �?正确：Service 接收纯数据参数，不依赖任�?Store
export async function computeScore(input: ScoreInput): Promise<ScoreResult> {
  // 纯计算，�?Store 依赖
}
```

### �?5：未�?ACL_MATRIX 中注册权�?
```typescript
// 如果 ACL_MATRIX 中未�?sectorScores 配置 write 权限�?// DataBridge.forward() 会抛�?ACL 拒绝错误�?// 务必在新�?store 时同步更�?ACL_MATRIX�?```

---

## 步骤 6：在 Store 中接入（可选）

Service 创建完成后，�?Store 调用�?
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
| DataBridge 规范 | `../../AGENTS.md` §�?| L4 应用层调用约�?|
| ACL 配置 | `src/config/dbConfig.ts` | 权限矩阵 |
| Envelope 定义 | `src/core/envelope.ts` | 信封工厂 |

---

> **验证完成�?*：更�?`docs/README.md` �?C 类索引，将新�?Service 链接回主索引�