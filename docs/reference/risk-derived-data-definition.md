---
title: DEPRECATED - risk-derived-data-definition.md
type: reference
domain: data
phase: design
tier: standard
status: active
maintainer: V9 Architecture Team
summary: "⚠️ 此文件已废弃�?026-07-14�?> 数据定义已整合至..."
tags: [data, data-definition, definition]
version: v1.0.0
last_updated: 2026-07-17
code_version: 2.0.0
doc_id: V9-DOC-DATA-046
change_log:
  - version: v1.0.0
changes: Initial version established
date: 2026-07-17
---

# DEPRECATED - risk-derived-data-definition.md

> ⚠️ **此文件已废弃**�?026-07-14�?> 
> 数据定义已整合至 `docs/reference/data-dictionary-index.md`，请通过主索引访问最新定义�?
---

# riskStore.derived.ts 详细文档

> **文件**: `src/store/riskStore.derived.ts`  
> **关联 Store**: `riskStore`  
> **函数数量**: 22  
> **类型定义**: 4  
> **版本**: v2.0.0  
> **最后更�?*: 2026-07-08

---

## 一、模块概�?
`riskStore.derived.ts` 提供风控模块的派生查询函数集合，负责�?
1. **执行决策**：判断当前是否可执行交易
2. **熔断管理**：管理熔断状态机（closed �?open �?half-open�?3. **风控统计**：聚合风控裁决历史数�?4. **趋势分析**：分析风险趋势变�?5. **聚合分析**：按标的聚合风险统计

---

## 二、核心类型定�?
### 2.1 RiskTriState �?风控三�?
```typescript
type RiskTriState = 'normal' | 'warning' | 'blocked'
```

| 状�?| 含义 | 交易影响 |
|------|------|---------|
| `normal` | 正常 | 交易可执�?|
| `warning` | 警告 | 交易可执行，但有风险提示 |
| `blocked` | 阻塞 | **交易不可执行** |

### 2.2 RiskLevelText �?风险等级文字描述

```typescript
type RiskLevelText = '正常' | '警告' | '阻塞'
```

### 2.3 CircuitState �?熔断状�?
```typescript
type CircuitState = 'closed' | 'open' | 'half-open'
```

### 2.4 SymbolRiskStats �?单标的风险统�?
```typescript
interface SymbolRiskStats {
  totalChecks: number      // 总检查次�?  blockedCount: number     // 阻塞次数
  warningCount: number     // 警告次数
  normalCount: number      // 正常次数
  lastTriState: RiskTriState  // 最近一次状�?  lastCheckedAt: number    // 最近检查时间戳
}
```

### 2.5 VerdictTimelineEntry �?裁决时间线条�?
```typescript
interface VerdictTimelineEntry {
  verdict: RiskVerdict     // 裁决记录
  timeGap: number          // 距上次检查的间隔（ms�?}
```

---

## 三、风控三态判定规�?
### 3.1 判定流程

```
风险检查输入（信号、仓位、市场状态等�?        �?        �?┌───────────────────────�?�? 风控规则引擎评估     �?└───────────────────────�?        �?        �?┌───────────────────────�?    ┌─────────────�?�? 是否有任�?BLOCK 规则？│──Yes──�?blocked �?└───────────────────────�?    └─────────────�?        │No
        �?┌───────────────────────�?    ┌─────────────�?�? 是否有任�?WARN 规则？│──Yes──�?warning  �?└───────────────────────�?    └─────────────�?        │No
        �?    normal
```

### 3.2 判定阈�?
| 风险等级 | 触发条件 | 交易操作 |
|---------|---------|---------|
| `blocked` | 任意 BLOCK 级别规则命中 | 禁止执行交易 |
| `warning` | �?BLOCK 规则，但�?WARN 规则命中 | 允许执行，显示警�?|
| `normal` | �?BLOCK �?WARN 规则命中 | 正常执行 |

---

## 四、熔断状态机

### 4.1 状态转换图

```
                    ┌─────────────────────────────────────────�?                    �?                                        �?                    �?                                        �?              ┌──────────�?        连续失败 �?threshold       ┌──────────�?              �? closed  �?────────────────────────────────�?�?  open   �?              �?(闭合)   �?←─────────────────────────────── �? (开�?  �?              └──────────�?    half-open 成功 �?threshold    └──────────�?                    �?                                        �?                    �?失败（half-open 状态下�?                  �?超过 resetTimeoutMs
                    �?                                        �?              ┌──────────�?        成功（half-open 状态下�?   ┌──────────�?              �?  open   �?←─────────────────────────────── │half-open �?              �? (开�?  �?                                  �?(半开)   �?              └──────────�?                                  └──────────�?```

### 4.2 状态说�?
| 状�?| 含义 | 请求处理 | 触发条件 |
|------|------|---------|---------|
| `closed` | 熔断闭合 | 请求直�?| 初始状�?/ half-open 连续成功 |
| `open` | 熔断开�?| 直接拒绝 | 连续失败达阈�?/ half-open 失败 |
| `half-open` | 熔断半开 | 放行探测请求 | open 状态超�?resetTimeoutMs |

### 4.3 默认阈值配�?
| 参数 | 默认�?| 说明 |
|------|--------|------|
| `failureThreshold` | 5 | 连续失败阈值，达到后熔�?|
| `resetTimeoutMs` | 30000�?0秒） | 熔断后进�?half-open 的等待时�?|
| `successThreshold` | 2 | half-open 下连续成功阈值，达到后闭�?|

---

## 五、风险趋势分�?
### 5.1 趋势方向判定

`riskTrendDirection()` 基于最�?N 次检查中 blocked 比例的变化判断趋势：

```typescript
export function riskTrendDirection(): RiskTrendDirection {
  const trend = riskTrend(10)  // 取最�?10 �?  if (trend.length < 4) return 'stable'
  
  const half = Math.floor(trend.length / 2)
  const firstHalf = trend.slice(0, half)
  const secondHalf = trend.slice(half)
  
  const firstBlockedRate = safeDivide(
    firstHalf.filter(t => t === 'blocked').length,
    firstHalf.length
  )
  const secondBlockedRate = safeDivide(
    secondHalf.filter(t => t === 'blocked').length,
    secondHalf.length
  )
  
  const diff = secondBlockedRate - firstBlockedRate
  if (diff > 0.1) return 'worsening'   // 恶化：blocked 比例上升超过 10%
  if (diff < -0.1) return 'improving'  // 改善：blocked 比例下降超过 10%
  return 'stable'                      // 平稳：变化在 10% 以内
}
```

### 5.2 趋势阈�?
| 趋势 | 判定条件 | 含义 |
|------|---------|------|
| `worsening` | `secondBlockedRate - firstBlockedRate > 0.1` | 风险恶化，blocked 比例上升超过 10% |
| `improving` | `secondBlockedRate - firstBlockedRate < -0.1` | 风险改善，blocked 比例下降超过 10% |
| `stable` | 变化 �?10% | 风险稳定 |

---

## 六、派生查询函数详�?
### 6.1 执行决策

| 函数 | 用�?| 业务规则 |
|------|------|---------|
| `isExecutable()` | 判断当前是否可执�?| `triState !== 'blocked'` |
| `riskLevelText()` | 获取风险等级文字描述 | normal�?正常'，warning�?警告'，blocked�?阻塞' |
| `latestVerdict()` | 获取最近一次裁�?| 返回 verdicts 数组最后一�?|
| `pendingBlocks()` | 获取待解决的 blocks 列表 | 返回 latestVerdict.result.blocks |
| `pendingWarnings()` | 获取待解决的 warnings 列表 | 返回 latestVerdict.result.warnings |

### 6.2 熔断状�?
| 函数 | 用�?| 业务规则 |
|------|------|---------|
| `isCircuitOpen()` | 判断回路是否开�?| `circuitState === 'open'` |
| `needsManualIntervention()` | 判断是否需要人工干�?| `circuitState === 'open'` |
| `circuitStateText()` | 获取回路状态文字描�?| closed�?闭合'，open�?开�?，half-open�?半开' |
| `isCircuitHalfOpen()` | 判断回路是否半开 | `circuitState === 'half-open'` |

### 6.3 风控统计

| 函数 | 用�?| 计算逻辑 |
|------|------|---------|
| `blockedCount()` | 获取 blocked 次数 | 遍历 verdicts，统�?triState === 'blocked' 的数�?|
| `warningCount()` | 获取 warning 次数 | 遍历 verdicts，统�?triState === 'warning' 的数�?|
| `normalCount()` | 获取 normal 次数 | 遍历 verdicts，统�?triState === 'normal' 的数�?|
| `blockedRate()` | 获取 blocked 比例 | `blockedCount / total`，除数为 0 返回 0 |
| `verdictsCount()` | 获取裁决总数 | verdicts 数组长度 |

### 6.4 趋势分析

| 函数 | 用�?| 计算逻辑 |
|------|------|---------|
| `riskTrend(limit)` | 获取最�?N 次检查的三态序�?| `verdicts.slice(-limit).map(v => v.triState)` |
| `riskTrendDirection()` | 判断风险趋势方向 | �?§5.1 |
| `verdictsTimeline(limit)` | 获取裁决时间线（含间隔） | 按时间排序，计算相邻裁决间隔 |

### 6.5 聚合分析

| 函数 | 用�?| 计算逻辑 |
|------|------|---------|
| `symbolRiskStats(symbol)` | 按标的聚合风险统�?| 过滤该标的的所有裁决，统计各状态次�?|

---

## 七、React Hook 形式派生

| Hook | 用�?| 订阅状�?|
|------|------|---------|
| `useIsExecutable()` | 订阅当前是否可执�?| `triState !== 'blocked'` |
| `useRiskLevelText()` | 订阅当前风险等级文字 | triState |
| `useIsCircuitOpen()` | 订阅回路是否开�?| circuitState |
| `usePendingBlocks()` | 订阅待解决的 blocks | verdicts |

---

## 八、缓存策�?
所有无参数派生查询使用 `memoizeByRef` 缓存�?
```typescript
export const verdictStats = memoizeByRef((verdicts: readonly RiskVerdict[]) => {
  let blockedCount = 0
  let warningCount = 0
  let normalCount = 0
  for (const v of verdicts) {
    if (v.triState === 'blocked') blockedCount++
    else if (v.triState === 'warning') warningCount++
    else normalCount++
  }
  return { blockedCount, warningCount, normalCount, total: verdicts.length }
}, 'verdictStats')
```

**缓存机制**�?- 基于 `verdicts` 数组引用记忆�?- �?`verdicts` 引用未变时，直接返回缓存结果
- �?`verdicts` 引用变化时（状态更新），重新计�?
---

## 九、设计原�?
1. **纯函�?*：通过 `useRiskStore.getState()` 访问状态，不修改状�?2. **性能优化**：使�?`memoizeByRef` 缓存无参数派�?3. **派生不调用派�?*：`blockedCount` 等直接遍�?verdicts，避免调�?`latestVerdict`
4. **空状态安�?*：所有派生在空数据时返回合理默认值（0、null、[]�?
---

## 十、业务规则汇�?
### 10.1 交易执行条件

```
可执�?= triState !== 'blocked'
```

### 10.2 熔断触发条件

```
熔断开�?= 连续失败次数 >= failureThreshold (默认 5)
熔断闭合 = half-open 状态下连续成功次数 >= successThreshold (默认 2)
熔断半开 = open 状态持续时�?>= resetTimeoutMs (默认 30000ms)
```

### 10.3 趋势判定条件

```
恶化 = 后半�?blocked 比例 - 前半�?blocked 比例 > 10%
改善 = 后半�?blocked 比例 - 前半�?blocked 比例 < -10%
平稳 = 变化 <= 10%
```

---

## 十一、与 UI 层的交互

### 11.1 ExecutionPlanPanel 使用场景

| UI 元素 | 使用的派生函�?| 用�?|
|---------|-------------|------|
| 提交按钮禁用状�?| `isExecutable()` | 判断是否可提交执行计�?|
| 阻断原因列表 | `pendingBlocks()` | 显示阻断交易的具体原�?|
| 警告信息列表 | `pendingWarnings()` | 显示风险警告信息 |
| 风险等级显示 | `riskLevelText()` | 显示当前风险等级文字 |

### 11.2 RiskMonitorWidget 使用场景

| UI 元素 | 使用的派生函�?| 用�?|
|---------|-------------|------|
| 熔断状态指�?| `circuitStateText()` | 显示熔断状�?|
| 是否需要干�?| `needsManualIntervention()` | 显示是否需要人工干�?|
| 阻断率统�?| `blockedRate()` | 显示阻断比例 |
| 风险趋势�?| `riskTrend()` | 显示风险趋势变化 |

---

## 十二、合规说�?
```
@compliance AGENTS.md §一 分层规则：store 层仅依赖 services �?core
```

- 仅依�?`useRiskStore` �?`lib/derivedCache`
- 符合 AGENTS.md 分层规则，lib 属于基础设施白名�?
---

> **文档结束**  
> **文件**: `src/store/riskStore.derived.ts`  
> **版本**: v2.0.0  
> **最后更�?*: 2026-07-08