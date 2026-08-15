---
doc_id: V9-DOC-REF-954
title: risk-derived-data-definition
code_version: "2.0.0-rc.1"
tier: important
status: deprecated
version: v2.0.0
last_updated: 2026-08-15
change_log:
  - version: v2.0.0
    changes: "DEPRECATED（2026-07-14）；2026-08-15 系统性核对：仍保持废弃状态，最新定义见 docs/reference/data-dictionary-index.md v1.1.0、《V9核心数据字典与类型定义（整合版）》.md v1.5 与 src/store/riskStore.derived.ts。"
    date: 2026-08-15
---



# DEPRECATED - risk-derived-data-definition.md

> ⚠️ **此文件已废弃**（2026-07-14）
> 
> 数据定义已整合至 `docs/reference/data-dictionary-index.md`，请通过主索引访问最新定义。

---

# riskStore.derived.ts 详细文档

> **文件**: `src/store/riskStore.derived.ts`  
> **关联 Store**: `riskStore`  
> **函数数量**: 22  
> **类型定义**: 4  
> **版本**: v2.0.0  
> **最后更新**: 2026-07-08

---

## 一、模块概述

`riskStore.derived.ts` 提供风控模块的派生查询函数集合，负责：

1. **执行决策**：判断当前是否可执行交易
2. **熔断管理**：管理熔断状态机（closed → open → half-open）
3. **风控统计**：聚合风控裁决历史数据
4. **趋势分析**：分析风险趋势变化
5. **聚合分析**：按标的聚合风险统计

---

## 二、核心类型定义

### 2.1 RiskTriState — 风控三态

```typescript
type RiskTriState = 'normal' | 'warning' | 'blocked'
```

| 状态 | 含义 | 交易影响 |
|------|------|---------|
| `normal` | 正常 | 交易可执行 |
| `warning` | 警告 | 交易可执行，但有风险提示 |
| `blocked` | 阻塞 | **交易不可执行** |

### 2.2 RiskLevelText — 风险等级文字描述

```typescript
type RiskLevelText = '正常' | '警告' | '阻塞'
```

### 2.3 CircuitState — 熔断状态

```typescript
type CircuitState = 'closed' | 'open' | 'half-open'
```

### 2.4 SymbolRiskStats — 单标的风险统计

```typescript
interface SymbolRiskStats {
  totalChecks: number      // 总检查次数
  blockedCount: number     // 阻塞次数
  warningCount: number     // 警告次数
  normalCount: number      // 正常次数
  lastTriState: RiskTriState  // 最近一次状态
  lastCheckedAt: number    // 最近检查时间戳
}
```

### 2.5 VerdictTimelineEntry — 裁决时间线条目

```typescript
interface VerdictTimelineEntry {
  verdict: RiskVerdict     // 裁决记录
  timeGap: number          // 距上次检查的间隔（ms）
}
```

---

## 三、风控三态判定规则

### 3.1 判定流程

```
风险检查输入（信号、仓位、市场状态等）
        │
        ▼
┌───────────────────────┐
│  风控规则引擎评估     │
└───────────────────────┘
        │
        ▼
┌───────────────────────┐     ┌─────────────┐
│  是否有任何 BLOCK 规则？│──Yes──→ blocked │
└───────────────────────┘     └─────────────┘
        │No
        ▼
┌───────────────────────┐     ┌─────────────┐
│  是否有任何 WARN 规则？│──Yes──→ warning  │
└───────────────────────┘     └─────────────┘
        │No
        ▼
    normal
```

### 3.2 判定阈值

| 风险等级 | 触发条件 | 交易操作 |
|---------|---------|---------|
| `blocked` | 任意 BLOCK 级别规则命中 | 禁止执行交易 |
| `warning` | 无 BLOCK 规则，但有 WARN 规则命中 | 允许执行，显示警告 |
| `normal` | 无 BLOCK 和 WARN 规则命中 | 正常执行 |

---

## 四、熔断状态机

### 4.1 状态转换图

```
                    ┌─────────────────────────────────────────┐
                    │                                         │
                    ▼                                         │
              ┌──────────┐         连续失败 ≥ threshold       ┌──────────┐
              │  closed  │ ────────────────────────────────→ │   open   │
              │ (闭合)   │ ←─────────────────────────────── │  (开启)  │
              └──────────┘     half-open 成功 ≥ threshold    └──────────┘
                    │                                         │
                    │ 失败（half-open 状态下）                   │ 超过 resetTimeoutMs
                    ▼                                         ▼
              ┌──────────┐         成功（half-open 状态下）    ┌──────────┐
              │   open   │ ←─────────────────────────────── │half-open │
              │  (开启)  │                                   │ (半开)   │
              └──────────┘                                   └──────────┘
```

### 4.2 状态说明

| 状态 | 含义 | 请求处理 | 触发条件 |
|------|------|---------|---------|
| `closed` | 熔断闭合 | 请求直通 | 初始状态 / half-open 连续成功 |
| `open` | 熔断开启 | 直接拒绝 | 连续失败达阈值 / half-open 失败 |
| `half-open` | 熔断半开 | 放行探测请求 | open 状态超过 resetTimeoutMs |

### 4.3 默认阈值配置

| 参数 | 默认值 | 说明 |
|------|--------|------|
| `failureThreshold` | 5 | 连续失败阈值，达到后熔断 |
| `resetTimeoutMs` | 30000（30秒） | 熔断后进入 half-open 的等待时间 |
| `successThreshold` | 2 | half-open 下连续成功阈值，达到后闭合 |

---

## 五、风险趋势分析

### 5.1 趋势方向判定

`riskTrendDirection()` 基于最近 N 次检查中 blocked 比例的变化判断趋势：

```typescript
export function riskTrendDirection(): RiskTrendDirection {
  const trend = riskTrend(10)  // 取最近 10 次
  if (trend.length < 4) return 'stable'
  
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

### 5.2 趋势阈值

| 趋势 | 判定条件 | 含义 |
|------|---------|------|
| `worsening` | `secondBlockedRate - firstBlockedRate > 0.1` | 风险恶化，blocked 比例上升超过 10% |
| `improving` | `secondBlockedRate - firstBlockedRate < -0.1` | 风险改善，blocked 比例下降超过 10% |
| `stable` | 变化 ≤ 10% | 风险稳定 |

---

## 六、派生查询函数详解

### 6.1 执行决策

| 函数 | 用途 | 业务规则 |
|------|------|---------|
| `isExecutable()` | 判断当前是否可执行 | `triState !== 'blocked'` |
| `riskLevelText()` | 获取风险等级文字描述 | normal→'正常'，warning→'警告'，blocked→'阻塞' |
| `latestVerdict()` | 获取最近一次裁决 | 返回 verdicts 数组最后一项 |
| `pendingBlocks()` | 获取待解决的 blocks 列表 | 返回 latestVerdict.result.blocks |
| `pendingWarnings()` | 获取待解决的 warnings 列表 | 返回 latestVerdict.result.warnings |

### 6.2 熔断状态

| 函数 | 用途 | 业务规则 |
|------|------|---------|
| `isCircuitOpen()` | 判断回路是否开启 | `circuitState === 'open'` |
| `needsManualIntervention()` | 判断是否需要人工干预 | `circuitState === 'open'` |
| `circuitStateText()` | 获取回路状态文字描述 | closed→'闭合'，open→'开启'，half-open→'半开' |
| `isCircuitHalfOpen()` | 判断回路是否半开 | `circuitState === 'half-open'` |

### 6.3 风控统计

| 函数 | 用途 | 计算逻辑 |
|------|------|---------|
| `blockedCount()` | 获取 blocked 次数 | 遍历 verdicts，统计 triState === 'blocked' 的数量 |
| `warningCount()` | 获取 warning 次数 | 遍历 verdicts，统计 triState === 'warning' 的数量 |
| `normalCount()` | 获取 normal 次数 | 遍历 verdicts，统计 triState === 'normal' 的数量 |
| `blockedRate()` | 获取 blocked 比例 | `blockedCount / total`，除数为 0 返回 0 |
| `verdictsCount()` | 获取裁决总数 | verdicts 数组长度 |

### 6.4 趋势分析

| 函数 | 用途 | 计算逻辑 |
|------|------|---------|
| `riskTrend(limit)` | 获取最近 N 次检查的三态序列 | `verdicts.slice(-limit).map(v => v.triState)` |
| `riskTrendDirection()` | 判断风险趋势方向 | 见 §5.1 |
| `verdictsTimeline(limit)` | 获取裁决时间线（含间隔） | 按时间排序，计算相邻裁决间隔 |

### 6.5 聚合分析

| 函数 | 用途 | 计算逻辑 |
|------|------|---------|
| `symbolRiskStats(symbol)` | 按标的聚合风险统计 | 过滤该标的的所有裁决，统计各状态次数 |

---

## 七、React Hook 形式派生

| Hook | 用途 | 订阅状态 |
|------|------|---------|
| `useIsExecutable()` | 订阅当前是否可执行 | `triState !== 'blocked'` |
| `useRiskLevelText()` | 订阅当前风险等级文字 | triState |
| `useIsCircuitOpen()` | 订阅回路是否开启 | circuitState |
| `usePendingBlocks()` | 订阅待解决的 blocks | verdicts |

---

## 八、缓存策略

所有无参数派生查询使用 `memoizeByRef` 缓存：

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

**缓存机制**：
- 基于 `verdicts` 数组引用记忆化
- 当 `verdicts` 引用未变时，直接返回缓存结果
- 当 `verdicts` 引用变化时（状态更新），重新计算

---

## 九、设计原则

1. **纯函数**：通过 `useRiskStore.getState()` 访问状态，不修改状态
2. **性能优化**：使用 `memoizeByRef` 缓存无参数派生
3. **派生不调用派生**：`blockedCount` 等直接遍历 verdicts，避免调用 `latestVerdict`
4. **空状态安全**：所有派生在空数据时返回合理默认值（0、null、[]）

---

## 十、业务规则汇总

### 10.1 交易执行条件

```
可执行 = triState !== 'blocked'
```

### 10.2 熔断触发条件

```
熔断开启 = 连续失败次数 >= failureThreshold (默认 5)
熔断闭合 = half-open 状态下连续成功次数 >= successThreshold (默认 2)
熔断半开 = open 状态持续时间 >= resetTimeoutMs (默认 30000ms)
```

### 10.3 趋势判定条件

```
恶化 = 后半段 blocked 比例 - 前半段 blocked 比例 > 10%
改善 = 后半段 blocked 比例 - 前半段 blocked 比例 < -10%
平稳 = 变化 <= 10%
```

---

## 十一、与 UI 层的交互

### 11.1 ExecutionPlanPanel 使用场景

| UI 元素 | 使用的派生函数 | 用途 |
|---------|-------------|------|
| 提交按钮禁用状态 | `isExecutable()` | 判断是否可提交执行计划 |
| 阻断原因列表 | `pendingBlocks()` | 显示阻断交易的具体原因 |
| 警告信息列表 | `pendingWarnings()` | 显示风险警告信息 |
| 风险等级显示 | `riskLevelText()` | 显示当前风险等级文字 |

### 11.2 RiskMonitorWidget 使用场景

| UI 元素 | 使用的派生函数 | 用途 |
|---------|-------------|------|
| 熔断状态指示 | `circuitStateText()` | 显示熔断状态 |
| 是否需要干预 | `needsManualIntervention()` | 显示是否需要人工干预 |
| 阻断率统计 | `blockedRate()` | 显示阻断比例 |
| 风险趋势图 | `riskTrend()` | 显示风险趋势变化 |

---

## 十二、合规说明

```
@compliance AGENTS.md §一 分层规则：store 层仅依赖 services 和 core
```

- 仅依赖 `useRiskStore` 和 `lib/derivedCache`
- 符合 AGENTS.md 分层规则，lib 属于基础设施白名单

---

> **文档结束**  
> **文件**: `src/store/riskStore.derived.ts`  
> **版本**: v2.0.0  
> **最后更新**: 2026-07-08