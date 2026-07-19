---
title: pr-8-dedup-audit-report
type: reference
domain: qa
phase: testing
tier: reference
status: active
maintainer: V9 Architecture Team
summary: "审计工具: audit-split-quality v1.1（AP-007 规则，函数体相似度阈?0.85?> 审计范围: src/ 全量扫描?13 文件?>..."
tags: [qa, audit, changelog, report, log]
version: v1.0.0
last_updated: 2026-07-17
code_version: 2.0.0
doc_id: V9-DOC-QA-025
related_docs: [V9-DOC-PROJ-083, V9-DOC-ARCH-004]
referenced_by: [V9-DOC-PROJ-174, V9-DOC-META-000, V9-DOC-PROJ-176, V9-DOC-PROJ-085, V9-DOC-PROJ-149]
change_log:
  - version: v1.0.0
changes: Initial version established
date: 2026-07-17
---

# PR-8 重复函数去重审计报告

> **Version**: v1.0.0 | **日期**: 2026-07-08
> **审计工具**: audit-split-quality v1.1（AP-007 规则，函数体相似度阈?0.85?> **审计范围**: src/ 全量扫描?13 文件?> **违规总数**: 8 ?AP-007 违规（从优化?243 处降?8 处）

---

## 一、审计概?
### 1.1 违规分布

| 规则 | 违规?| 严重等级 | 说明 |
|------|--------|----------|------|
| AP-007 | 8 | major | 重复函数定义（函数体相似?> 0.85?|

### 1.2 分类结果

| 类别 | 数量 | 重构策略 | 风险等级 |
|------|------|----------|----------|
| **A. 逻辑完全一?* | 5 | 直接合并为单一来源 | 🟢 ?|
| **B. 同名不同语义** | 2 | 重命名以消除歧义 | 🟡 ?|
| **C. 结构相似实现不同** | 1 | 提取通用框架 | 🟠 ?|

### 1.3 调用点统?
| 函数 | 调用点数 | 跨文件调?| 合并安全?|
|------|----------|------------|------------|
| `now` | 3 处（dataLayer?| 是（通过 db.ts re-export?| ?安全 |
| `formatIndustryDelta` | 0 ?import | 否（仅内部使用） | ?安全 |
| `formatIntelligentDelta` | 0 ?import | 否（仅内部使用） | ?安全 |
| `toSafeNumber` | 3 处（marketDataAdapters?| 是（lib/safeCoerce?| ?安全 |
| `toSafeBoolean` | 3 处（marketDataAdapters?| 是（lib/safeCoerce?| ?安全 |
| `generateId` | 1 处（dataLayerTradingStores?| 是（通过 db.ts?| ⚠️ 需重命?|
| `bySector` | 2 处（测试文件?| 否（各自 store 内部?| ⚠️ 需重命?|
| `analyze` | 0 ?import | 否（各自模块入口?| ⚠️ 高风?|

---

## 二、A 类：逻辑完全一致（5 对，优先合并?
### 2.1 `now()` ?时间戳获?
**位置**:
- 📍 `src/data/db-utils.ts:25-27`
- 📍 `src/lib/format.ts`

**相似?*: 1.00（完全一致）

**源代码对?*:

```typescript
// src/data/db-utils.ts:25-27
export function now(): number {
  return Date.now()
}

// src/utils/timeUtils.ts:31-33
export function now(): number {
  return Date.now()
}
```

**差异分析**: 无差异，两处实现完全一致?
**调用?*:
- `src/data/db.ts:7` ?`export { generateId, now } from './db-utils'`（re-export?- `src/data/dataLayerContentStores.ts:14` ?`import { now } from './db'`
- `src/data/dataLayerTradingStores.ts:13` ?`import { generateId, now } from './db'`
- `src/data/dataLayerStockStores.ts:17` ?`import { now } from './db'`

**推荐方案**:
- 保留 `src/data/db-utils.ts` 中的实现（dataLayer 依赖链已建立?- 删除 `src/lib/format.ts` ?`now()` 定义
- `timeUtils.ts` 添加 re-export：`export { now } from '@/data/db-utils'`（保持向后兼容）

**推荐代码**:

```typescript
// src/utils/timeUtils.ts（修改后?// 时间戳函数已迁移?@/data/db-utils，此?re-export 保持向后兼容
export { now } from '@/data/db-utils'
```

---

### 2.2 `formatIndustryDelta()` ?行业评分变化格式?
**位置**:
- 📍 `src/hooks/cabin/useIndustryScorePage.ts:37-43`
- 📍 `src/store/industryScoreStore.ts:64-70`

**相似?*: 1.00（完全一致）

**源代码对?*:

```typescript
// src/hooks/cabin/useIndustryScorePage.ts:37-43
export function formatIndustryDelta(current: number | null, previous: number | null): string {
  if (current === null || previous === null) return ''
  const delta = current - previous
  if (delta > 0) return `(+${delta.toFixed(2)})`
  if (delta < 0) return `(${delta.toFixed(2)})`
  return '(0.00)'
}

// src/store/industryScoreStore.ts:64-70
export function formatIndustryDelta(current: number | null, previous: number | null): string {
  if (current === null || previous === null) return ''
  const delta = current - previous
  if (delta > 0) return `(+${delta.toFixed(2)})`
  if (delta < 0) return `(${delta.toFixed(2)})`
  return '(0.00)'
}
```

**差异分析**: 无差异，两处实现完全一致?
**调用?*: 无跨文件 import（仅各自文件内部使用?
---

### 2.3 `formatIntelligentDelta()` ?智能评分变化格式?
**位置**:
- 📍 `src/hooks/cabin/useIntelligentScorePage.ts:38-44`
- 📍 `src/store/intelligentScoreStore.ts:68-74`

**相似?*: 1.00（完全一致）

**源代码对?*:

```typescript
// src/hooks/cabin/useIntelligentScorePage.ts:38-44
export function formatIntelligentDelta(current: number | null, previous: number | null): string {
  if (current === null || previous === null) return ''
  const delta = current - previous
  if (delta > 0) return `(+${delta.toFixed(2)})`
  if (delta < 0) return `(${delta.toFixed(2)})`
  return '(0.00)'
}

// src/store/intelligentScoreStore.ts:68-74
export function formatIntelligentDelta(current: number | null, previous: number | null): string {
  if (current === null || previous === null) return ''
  const delta = current - previous
  if (delta > 0) return `(+${delta.toFixed(2)})`
  if (delta < 0) return `(${delta.toFixed(2)})`
  return '(0.00)'
}
```

**差异分析**: 无差异。且 `formatIndustryDelta` ?`formatIntelligentDelta` 本身也是同一逻辑，可合并为通用 `formatScoreDelta`?
**推荐方案**: 提取为通用函数 `formatScoreDelta` ?`src/lib/format.ts`

**推荐代码**:

```typescript
// src/lib/format.ts（新增）
/**
 * 格式化评分变化? * @param current 当前评分
 * @param previous 上次评分
 * @returns 格式化后的变化字符串，如 (+1.23) / (-0.45) / (0.00)
 */
export function formatScoreDelta(current: number | null, previous: number | null): string {
  if (current === null || previous === null) return ''
  const delta = current - previous
  if (delta > 0) return `(+${delta.toFixed(2)})`
  if (delta < 0) return `(${delta.toFixed(2)})`
  return '(0.00)'
}
```

```typescript
// src/hooks/cabin/useIndustryScorePage.ts（修改后?import { formatScoreDelta } from '@/lib/format'
// 删除本地 formatIndustryDelta 定义
// 调用处改?formatScoreDelta

// src/store/industryScoreStore.ts（修改后?import { formatScoreDelta } from '@/lib/format'
// 删除本地 formatIndustryDelta 定义
// 保留 re-export 保持向后兼容：export { formatScoreDelta as formatIndustryDelta } from '@/lib/format'

// src/hooks/cabin/useIntelligentScorePage.ts（修改后?import { formatScoreDelta } from '@/lib/format'
// 删除本地 formatIntelligentDelta 定义

// src/store/intelligentScoreStore.ts（修改后?import { formatScoreDelta } from '@/lib/format'
// 删除本地 formatIntelligentDelta 定义
// 保留 re-export 保持向后兼容：export { formatScoreDelta as formatIntelligentDelta } from '@/lib/format'
```

---

### 2.4 `toSafeNumber()` ?安全数字转换

**位置**:
- 📍 `src/lib/safeCoerce.ts:26-30`（权威实现）
- 📍 `src/services/fetcher/strategyDataAdapter.ts:76-80`（重复实现）

**相似?*: 1.00（完全一致）

**源代码对?*:

```typescript
// src/lib/safeCoerce.ts:26-30（权威实现）
export function toSafeNumber(value: unknown, defaultValue = 0): number {
  if (value === null || value === undefined || value === '') return defaultValue
  const num = Number(value)
  return Number.isFinite(num) ? num : defaultValue
}

// src/services/fetcher/strategyDataAdapter.ts:76-80（重复实现）
export function toSafeNumber(value: unknown, defaultValue = 0): number {
  if (value === null || value === undefined || value === '') return defaultValue
  const num = Number(value)
  return Number.isFinite(num) ? num : defaultValue
}
```

**差异分析**: 无差异，两处实现完全一致?
**调用?*:
- `strategyDataAdapter.ts` 内部 13 处调用（?114-155?- `lib/safeCoerce.ts` ?3 ?marketDataAdapters 文件 import

**推荐方案**:
- 删除 `strategyDataAdapter.ts:76-80` 的本?`toSafeNumber` 定义
- ?`strategyDataAdapter.ts` 顶部添加 `import { toSafeNumber, toSafeBoolean } from '@/lib/safeCoerce'`

**推荐代码**:

```typescript
// src/services/fetcher/strategyDataAdapter.ts（修改后顶部?import { toSafeNumber, toSafeBoolean } from '@/lib/safeCoerce'
// 删除本地 toSafeNumber ?toSafeBoolean 定义（行 76-80 ?97-102?```

---

### 2.5 `toSafeBoolean()` ?安全布尔转换

**位置**:
- 📍 `src/lib/safeCoerce.ts:108-113`（权威实现）
- 📍 `src/services/fetcher/strategyDataAdapter.ts:97-102`（重复实现）

**相似?*: 1.00（完全一致）

**源代码对?*:

```typescript
// src/lib/safeCoerce.ts:108-113（权威实现）
export function toSafeBoolean(value: unknown, defaultValue = false): boolean {
  if (typeof value === 'boolean') return value
  if (value === 1 || value === 'true' || value === 1) return true
  if (value === 0 || value === 'false' || value === 0) return false
  return defaultValue
}

// src/services/fetcher/strategyDataAdapter.ts:97-102（重复实现）
export function toSafeBoolean(value: unknown, defaultValue = false): boolean {
  if (typeof value === 'boolean') return value
  if (value === 1 || value === 'true' || value === 1) return true
  if (value === 0 || value === 'false' || value === 0) return false
  return defaultValue
}
```

**差异分析**: 无差异，两处实现完全一致?
**推荐方案**: ?2.4 `toSafeNumber` 一起处理，统一?`@/lib/safeCoerce` 导入?
**备注**: 两处实现都存?`value === 1 || value === 'true' || value === 1` 的重复条件（`value === 1` 出现两次），这是原有代码?bug，合并时应修复为 `value === 1 || value === 'true'`?
**修复后的推荐代码**:

```typescript
// src/lib/safeCoerce.ts（修?bug 后）
export function toSafeBoolean(value: unknown, defaultValue = false): boolean {
  if (typeof value === 'boolean') return value
  if (value === 1 || value === 'true') return true
  if (value === 0 || value === 'false') return false
  return defaultValue
}
```

---

## 三、B 类：同名不同语义? 对，重命名解决）

### 3.1 `generateId()` ?ID 生成?
**位置**:
- 📍 `src/data/db-utils.ts:17-19`（nanoid 实现?- 📍 `src/lib/validation.ts`（自增计数器实现?
**相似?*: 0.00（实现完全不同，仅函数名相同?
**源代码对?*:

```typescript
// src/data/db-utils.ts:17-19
export function generateId(): string {
  return nanoid(16)  // 16 字符随机字符?}

// src/utils/a11y.ts:11-13
let idCounter = 0
export function generateId(prefix = 'a11y'): string {
  return `${prefix}-${++idCounter}`  // 带前缀的自?ID
}
```

**差异分析**: 实现完全不同，语义不同：
- `db-utils.ts`: 生成 16 字符随机 ID（用于数据库主键?- `a11y.ts`: 生成带前缀的自?ID（用?aria-labelledby/aria-describedby?
**调用?*:
- `db-utils.ts` ?`generateId` ?通过 `db.ts` re-export ?`dataLayerTradingStores.ts` 使用
- `a11y.ts` ?`generateId` ?**无调用点**（a11y.ts 是孤儿模块，未被任何文件 import?
**推荐方案**:
- `a11y.ts` 重命名为 `generateA11yId`（强调语义）
- 由于 `a11y.ts` 是孤儿模块，可考虑后续 PR 删除整个文件

**推荐代码**:

```typescript
// src/utils/a11y.ts（修改后?let idCounter = 0
/** 生成无障?ID（用?aria-labelledby/aria-describedby?*/
export function generateA11yId(prefix = 'a11y'): string {
  return `${prefix}-${++idCounter}`
}
```

---

### 3.2 `bySector()` ?板块查找

**位置**:
- 📍 `src/store/hotSectorStore.ts:221-223`（按 symbol 查找?- 📍 `src/store/rotationSignalStore.derived.ts:131-133`（按 sectorId 查找?
**相似?*: 0.65（结构相似，但操作不?store、不同字段、不同返回类型）

**源代码对?*:

```typescript
// src/store/hotSectorStore.ts:221-223
export function bySector(symbol: string): HotSectorScore | undefined {
  return useHotSectorStore.getState().scores.find((s) => s.symbol === symbol)
}

// src/store/rotationSignalStore.derived.ts:131-133
export function bySector(sectorId: string): RotationSignal | undefined {
  return useRotationSignalStore.getState().signals.find(s => s.sectorId === sectorId)
}
```

**差异分析**:
- `hotSectorStore.ts`: 参数名是 `symbol`，查找字段是 `s.symbol`，返?`HotSectorScore`
- `rotationSignalStore.derived.ts`: 参数名是 `sectorId`，查找字段是 `s.sectorId`，返?`RotationSignal`

**问题**: `hotSectorStore.ts` 的函数名 `bySector` 有误导性——它实际?`symbol` 查找，而非?`sector` 查找?
**调用?*:
- `hotSectorStore.ts` ?`bySector` ?仅测试文件使?- `rotationSignalStore.derived.ts` ?`bySector` ?测试文件 + 内部 2 处调用（?275?00?
**推荐方案**:
- `hotSectorStore.ts` 重命名为 `bySymbol`（与实际查找字段一致）
- `rotationSignalStore.derived.ts` 保持 `bySector`（语义正确）

**推荐代码**:

```typescript
// src/store/hotSectorStore.ts（修改后?/** ?symbol 查找评分 */
export function bySymbol(symbol: string): HotSectorScore | undefined {
  return useHotSectorStore.getState().scores.find((s) => s.symbol === symbol)
}

// src/store/hotSectorStore.test.ts（修改后?import { useHotSectorStore, topScores, buySignals, bySymbol } from './hotSectorStore'
```

---

## 四、C 类：结构相似实现不同? 对，提取通用框架?
### 4.1 `analyze()` ?五维评分分析

**位置**:
- 📍 `src/services/scoring/hotSectorDimensions.ts:365-418`
- 📍 `src/services/scoring/valuePitAnalyzer.ts:328-372`

**相似?*: 0.87（结构高度相似，但维度名、阈值、返回类型不同）

**源代码对?*:

```typescript
// src/services/scoring/hotSectorDimensions.ts:365-418
export function analyze(input: HotSectorAnalyzerInput): HotSectorScore {
  const momentum = calculateMomentum(input.momentum)
  const sentiment = calculateSentiment(input.sentiment)
  const breakout = calculateBreakout(input.breakout)
  const valuationRisk = calculateValuationRisk(input.valuationRisk)
  const marketEnv = calculateMarketEnv(input.marketEnv)

  const overallScore =
    momentum * WEIGHTS.momentum +
    sentiment * WEIGHTS.sentiment +
    breakout * WEIGHTS.breakout +
    valuationRisk * WEIGHTS.valuationRisk +
    marketEnv * WEIGHTS.marketEnv

  const rounded =
    Math.round(overallScore * HOT_SECTOR_THRESHOLDS.SCORE_ROUNDING_PRECISION) /
    HOT_SECTOR_THRESHOLDS.SCORE_ROUNDING_PRECISION

  let action: HotSectorScore['action']
  if (rounded >= HOT_SECTOR_THRESHOLDS.ACTION_IMMEDIATE_THRESHOLD) {
    action = 'immediate'
  } else if (rounded >= HOT_SECTOR_THRESHOLDS.ACTION_PROBE_THRESHOLD) {
    action = 'probe'
  } else {
    action = 'ignore'
  }
  // ... 返回 HotSectorScore
}

// src/services/scoring/valuePitAnalyzer.ts:328-372
export function analyze(input: ValuePitAnalyzerInput): ValuePitScore {
  const catalyst = calculateCatalyst(input.catalyst)
  const valuationMargin = calculateValuationMargin(input.valuationMargin)
  const chipStructure = calculateChipStructure(input.chipStructure)
  const rotationPosition = calculateRotationPosition(input.rotationPosition)
  const liquidity = calculateLiquidity(input.liquidity)

  const overallScore =
    catalyst * WEIGHTS.catalyst +
    valuationMargin * WEIGHTS.valuationMargin +
    chipStructure * WEIGHTS.chipStructure +
    rotationPosition * WEIGHTS.rotationPosition +
    liquidity * WEIGHTS.liquidity

  const rounded = Math.round(overallScore * 100) / 100  // 硬编?100

  let action: ValuePitScore['action']
  if (rounded >= 4.0) {        // 硬编码阈?    action = 'immediate'
  } else if (rounded >= 3.5) { // 硬编码阈?    action = 'probe'
  } else if (rounded >= 3.0) { // 硬编码阈?    action = 'wait'            // 多一个状?  } else {
    action = 'ignore'
  }
  // ... 返回 ValuePitScore（多一?rotationSignal 字段?}
```

**差异分析**:

| 维度 | hotSectorDimensions | valuePitAnalyzer |
|------|---------------------|------------------|
| 维度?| momentum/sentiment/breakout/valuationRisk/marketEnv | catalyst/valuationMargin/chipStructure/rotationPosition/liquidity |
| 权重来源 | `WEIGHTS` 常量 | `WEIGHTS` 常量 |
| 精度常量 | `HOT_SECTOR_THRESHOLDS.SCORE_ROUNDING_PRECISION` | 硬编?`100` |
| 阈值来?| `HOT_SECTOR_THRESHOLDS.ACTION_*` | 硬编?`4.0/3.5/3.0` |
| action 状?| 3 个（immediate/probe/ignore?| 4 个（immediate/probe/wait/ignore?|
| 返回类型 | `HotSectorScore` | `ValuePitScore`（多 `rotationSignal` 字段?|
| 维度字段?| momentum/sentiment/technical/valuation/composite/marketEnv | catalyst/valuation/chip/rotation/liquidity/composite |

**问题**:
1. `valuePitAnalyzer.ts` 使用硬编码阈值（违反零硬编码原则?2. 两者结构高度相似（五维加权评分 ?取整 ?action 分级），但无法直接合?
**推荐方案**: 提取通用评分框架 `calculateWeightedScore` ?`src/services/scoring/_shared/`

**推荐代码**:

```typescript
// src/services/scoring/_shared/weightedScore.ts（新增）
/**
 * 通用五维加权评分框架
 * @param dimensions 维度得分对象
 * @param weights 权重对象
 * @param config 评分配置（精度、阈值）
 * @returns 加权总分（已取整? */
export interface WeightedScoreConfig {
  /** 取整精度（如 100 表示保留 2 位小数） */
  roundingPrecision: number
}

export function calculateWeightedScore(
  dimensions: Record<string, number>,
  weights: Record<string, number>,
  config: WeightedScoreConfig,
): number {
  let overallScore = 0
  for (const [key, value] of Object.entries(dimensions)) {
    overallScore += value * (weights[key] ?? 0)
  }
  return Math.round(overallScore * config.roundingPrecision) / config.roundingPrecision
}

/**
 * 根据 action 阈值分? * @param score 总分
 * @param thresholds 阈值配置（从大到小? * @returns action 字符? */
export function classifyAction<T extends string>(
  score: number,
  thresholds: Array<{ threshold: number; action: T }>,
  defaultAction: T,
): T {
  for (const { threshold, action } of thresholds) {
    if (score >= threshold) return action
  }
  return defaultAction
}
```

```typescript
// src/services/scoring/hotSectorDimensions.ts（修改后?import { calculateWeightedScore, classifyAction } from './_shared/weightedScore'

export function analyze(input: HotSectorAnalyzerInput): HotSectorScore {
  const dimensions = {
    momentum: calculateMomentum(input.momentum),
    sentiment: calculateSentiment(input.sentiment),
    breakout: calculateBreakout(input.breakout),
    valuationRisk: calculateValuationRisk(input.valuationRisk),
    marketEnv: calculateMarketEnv(input.marketEnv),
  }

  const rounded = calculateWeightedScore(dimensions, WEIGHTS, {
    roundingPrecision: HOT_SECTOR_THRESHOLDS.SCORE_ROUNDING_PRECISION,
  })

  const action = classifyAction(rounded, [
    { threshold: HOT_SECTOR_THRESHOLDS.ACTION_IMMEDIATE_THRESHOLD, action: 'immediate' },
    { threshold: HOT_SECTOR_THRESHOLDS.ACTION_PROBE_THRESHOLD, action: 'probe' },
  ], 'ignore' as HotSectorScore['action'])

  // ... 返回 HotSectorScore（维度字段映射保持不变）
}
```

```typescript
// src/services/scoring/valuePitAnalyzer.ts（修改后，消除硬编码?import { calculateWeightedScore, classifyAction } from './_shared/weightedScore'

// 新增配置常量（替代硬编码?const VALUE_PIT_THRESHOLDS = {
  SCORE_ROUNDING_PRECISION: 100,
  ACTION_IMMEDIATE_THRESHOLD: 4.0,
  ACTION_PROBE_THRESHOLD: 3.5,
  ACTION_WAIT_THRESHOLD: 3.0,
} as const

export function analyze(input: ValuePitAnalyzerInput): ValuePitScore {
  const dimensions = {
    catalyst: calculateCatalyst(input.catalyst),
    valuationMargin: calculateValuationMargin(input.valuationMargin),
    chipStructure: calculateChipStructure(input.chipStructure),
    rotationPosition: calculateRotationPosition(input.rotationPosition),
    liquidity: calculateLiquidity(input.liquidity),
  }

  const rounded = calculateWeightedScore(dimensions, WEIGHTS, {
    roundingPrecision: VALUE_PIT_THRESHOLDS.SCORE_ROUNDING_PRECISION,
  })

  const action = classifyAction(rounded, [
    { threshold: VALUE_PIT_THRESHOLDS.ACTION_IMMEDIATE_THRESHOLD, action: 'immediate' },
    { threshold: VALUE_PIT_THRESHOLDS.ACTION_PROBE_THRESHOLD, action: 'probe' },
    { threshold: VALUE_PIT_THRESHOLDS.ACTION_WAIT_THRESHOLD, action: 'wait' },
  ], 'ignore' as ValuePitScore['action'])

  // ... 返回 ValuePitScore
}
```

---

## 五、风险矩?
| 函数 | 重构风险 | 影响范围 | 回滚难度 | 优先?|
|------|----------|----------|----------|--------|
| `now` | 🟢 ?| 4 文件 | 🟢 ?| P0 |
| `toSafeNumber` + `toSafeBoolean` | 🟢 ?| 2 文件 | 🟢 ?| P0 |
| `formatIndustryDelta` + `formatIntelligentDelta` | 🟢 ?| 4 文件 | 🟢 ?| P0 |
| `generateId`（重命名?| 🟡 ?| 1 文件（孤儿） | 🟢 ?| P1 |
| `bySector`（重命名?| 🟡 ?| 2 文件 + 2 测试 | 🟡 ?| P1 |
| `analyze`（提取框架） | 🟠 ?| 2 文件 + 新增 1 | 🟠 ?| P2 |

---

## 六、验证清?
### 6.1 合并前验?
```powershell
# 类型检?npx tsc --noEmit

# 单元测试
npm test -- --run

# 架构审计
npm run audit:layers
npm run audit:split-quality
```

### 6.2 合并后验?
```powershell
# 类型检查（确保 re-export 兼容?npx tsc --noEmit

# 单元测试（确保调用点不受影响?npm test -- --run

# 重复函数审计（确?AP-007 违规减少?npm run audit:split-quality
# 期望：AP-007 违规?8 降至 0（A ?5 对合并后?
# 跨层调用审计
npm run audit:layers
# 期望? violations
```

### 6.3 回滚验证

- 每个 batch 完成后立即运?`npx tsc --noEmit` ?`npm test -- --run`
- 若测试失败，立即 `git checkout -- <文件>` 回滚
- 回滚后重新运?`npm run audit:split-quality` 确认违规恢复

---

## 七、参考文?
- [PR-7 变更日志](../../CHANGELOG.md)
- 边界定义同步文档
- [架构标准 §3.16 模块拆分架构原则](../../03-architecture-standards.md)
- [audit-split-quality 脚本](../../../../scripts/audit/audit-split-quality.ts)
- [AP-007 审计报告](../../reports/audit/audit-split-quality-optimized.json)
