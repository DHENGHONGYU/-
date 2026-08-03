---
title: 2026-07-09-store-derived-documentation-analysis
tier: T2
status: active
type: reports
domain: project
doc_id: V9-DOC-AUTO-067471
code_version: 2.0.0
summary: 派生计算文件（`.derived.ts`）是 Zustand Store 的配套文件，负责从 Store 状态中派生出计算值，不直接修改状态。
maintainer: V9 Architecture Team
phase: retrospective
---


## 一、什么是派生计算文件

**派生计算文件**（`.derived.ts`）是 Zustand Store 的配套文件，负责从 Store 状态中派生出计算值，不直接修改状态。

**核心特征**：
- **纯函数**：通过 `useStore.getState()` 访问状态，不修改状态
- **性能优化**：使用 `memoizeByRef` 缓存计算结果
- **空状态安全**：所有派生在空数据时返回合理默认值
- **不引入循环依赖**：仅依赖对应 Store 和 `lib/derivedCache`

**架构定位**：

```
┌─────────────────────────────────────────────────────────────┐
│                      UI 层 (pages/components)               │
│                       useDerived() Hook                     │
└───────────────────────────┬─────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                  Store 层 (zustand store)                   │
│    useStore((state) => state.data)  ← 直接状态订阅           │
└───────────────────────────┬─────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│               派生计算层 (.derived.ts)                       │
│  derivedFn() ← 纯函数计算，memoizeByRef 缓存，不触发重渲染   │
│  useDerived() ← Hook 形式，订阅状态变化，触发重渲染          │
└───────────────────────────┬─────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                  服务层 (services)                          │
│              通过 DataBridge 写入数据                        │
└─────────────────────────────────────────────────────────────┘
```
title: 2026-07-09-store-derived-documentation-analysis
tier: T2
status: active
type: reports
doc_id: V9-DOC-DATA-075
domain: data
code_version: 2.0.0

---

## 二、5 个派生计算文件详细分析

### 2.1 analysisStore.derived.ts（分析 Store 派生计算）

**核心功能**：
- 评分等级分布统计（excellent/good/average/poor/bad）
- 按字段查找（symbol、sector、scoreRange）
- 趋势分析（方向、变化率、峰值、谷值）
- Top N 高分标的筛选

**函数数量**：22 个

**为什么需要文档化**：

| 维度 | 说明 |
|------|------|
| **业务价值** | 评分等级分布是投资决策的核心依据，文档化确保评分规则透明 |
| **架构重要性** | 趋势分析算法复杂（基于复合值首尾比较），需要文档说明阈值逻辑 |
| **团队协作** | `topStocks()` 函数的排序逻辑和参数含义需要明确说明 |
| **维护成本** | 评分等级划分标准（≥80、60-79 等）是业务规则，需要文档记录 |

**关键业务规则**：

```typescript
// 评分等级划分（业务规则）
// excellent: ≥80, good: 60-79, average: 40-59, poor: 20-39, bad: <20

// 趋势判定阈值（1% 变化阈值）
const threshold = Math.abs(first) * 0.01
if (diff > threshold) return 'up'
if (diff < -threshold) return 'down'
return 'flat'
```

---

### 2.2 chatStore.derived.ts（聊天 Store 派生计算）

**核心功能**：
- 消息统计（各角色消息数）
- 消息访问（最后一条、按角色查找）
- 发送状态判定（是否可发送）
- 上下文管理（token 估算、截断策略）

**函数数量**：23 个

**为什么需要文档化**：

| 维度 | 说明 |
|------|------|
| **业务价值** | 上下文管理直接影响 LLM 调用成本，文档化确保 token 估算逻辑透明 |
| **架构重要性** | 流式响应进度估算（基于字符数/4）是近似算法，需要文档说明精度限制 |
| **团队协作** | `messagesToTruncate()` 的截断策略影响用户体验，需要明确说明 |
| **维护成本** | token 估算规则（字符数/4）是经验值，需要文档记录以便调整 |

**关键业务规则**：

```typescript
// Token 估算规则（经验值）
export function estimatedTokenCount(): number {
  // 粗略估算：字符数 / 4
  return Math.ceil(charCount / 4)
}

// 默认上下文限制：8000 tokens
export function isOverContextLimit(maxTokens: number = 8000): boolean { ... }
```

---

### 2.3 riskStore.derived.ts（风险 Store 派生计算）

**核心功能**：
- 执行决策（是否可执行、待解决 blocks/warnings）
- 熔断状态管理（闭合/开启/半开）
- 风控统计（阻断次数、阻断率）
- 趋势分析（风险趋势方向）
- 按标的聚合统计

**函数数量**：22 个

**为什么需要文档化**：

| 维度 | 说明 |
|------|------|
| **业务价值** | 风控裁决直接决定交易是否可执行，文档化确保风控规则透明可审计 |
| **架构重要性** | 熔断状态机（closed→open→half-open）是关键业务逻辑，需要状态转换图 |
| **团队协作** | 风控三态判定规则（normal/warning/blocked）是核心业务规则，必须文档化 |
| **维护成本** | 趋势判定阈值（10% 变化）是业务参数，需要文档记录以便调整 |

**关键业务规则**：

```typescript
// 风控三态判定规则
// blocked: 任意 BLOCK 规则命中 → 禁止执行
// warning: 无 BLOCK 规则，但有 WARN 规则命中 → 允许执行，显示警告
// normal: 无 BLOCK 和 WARN 规则命中 → 正常执行

// 趋势判定阈值（10%）
if (diff > 0.1) return 'worsening'
if (diff < -0.1) return 'improving'
return 'stable'
```

---

### 2.4 signalQualityStore.derived.ts（信号质量 Store 派生计算）

**核心功能**：
- 信号质量分级（high/medium/low/unknown）
- 按标的查询指标（准确率、胜率、平均收益）
- 盈亏分析（盈利/亏损复盘记录）
- 方向统计（buy/sell/hold/watch）
- 趋势分析（准确率/胜率随时间变化）

**函数数量**：30 个

**为什么需要文档化**：

| 维度 | 说明 |
|------|------|
| **业务价值** | 信号质量分级直接影响投资决策，文档化确保评级标准透明 |
| **架构重要性** | 方向统计聚合算法复杂（单次遍历完成所有计算），需要性能说明 |
| **团队协作** | 质量分级规则（accuracy ≥ 0.7 = high）是业务参数，需要明确说明 |
| **维护成本** | 滑动窗口趋势分析（windowSize=20）的参数含义需要文档记录 |

**关键业务规则**：

```typescript
// 信号质量分级规则
// high: accuracy >= 0.7
// medium: 0.5 <= accuracy < 0.7
// low: accuracy < 0.5
// unknown: 无复盘数据

// 滑动窗口大小（默认 20）
export function accuracyTrend(windowSize: number = 20): ...
```

---

### 2.5 executionStoreSubscriptions.ts（执行 Store 订阅）

**核心功能**：
- 订阅 DataBridge 上的 signals 和 orders 事件
- 实现执行计划的自动化更新
- 防抖机制避免频繁刷新
- 自循环保护避免处理自身事件

**函数数量**：5 个

**为什么需要文档化**：

| 维度 | 说明 |
|------|------|
| **业务价值** | 交易流程的事件驱动核心，文档化确保交易流程可追溯 |
| **架构重要性** | 事件驱动架构复杂（信号→执行计划→订单的联动），需要架构图 |
| **团队协作** | 自循环保护和防抖机制是关键设计，需要文档说明 |
| **维护成本** | 事件处理逻辑涉及多个模块交互，文档化降低理解成本 |

**关键业务规则**：

```typescript
// 防抖延迟：100ms（避免频繁刷新）
const DEBOUNCE_MS = 100

// 自循环保护：跳过自身发出的事件
if (envelope.meta.source === EXECUTION_STORE_SOURCE) {
  return
}

// 信号自动创建执行计划（仅 buy/sell 方向）
if (signal && (signal.direction === 'buy' || signal.direction === 'sell')) {
  void useExecutionStore.getState().createPlan(signal)
}
```

---

## 三、文档化对开发效率的价值

### 3.1 降低认知负荷

**问题**：新成员需要阅读大量代码才能理解派生计算的逻辑

**解决方案**：通过 JSDoc 注释，新成员可以快速了解：
- 函数的输入输出
- 业务规则和阈值
- UI 使用场景

**对比**：
- 无文档：需要阅读完整函数实现，耗时 5-10 分钟/函数
- 有文档：通过 JSDoc 直接了解函数用途和规则，耗时 < 1 分钟/函数

### 3.2 避免重复实现

**问题**：团队成员可能不知道已有派生函数，重复实现相同逻辑

**解决方案**：通过文档索引（data-dictionary-index_reference.md），团队成员可以快速查找已有函数

**实例**：
- `riskStore.derived.ts` 中已有 `isExecutable()` 函数
- 如果没有文档，其他开发者可能在组件中直接写 `useRiskStore.getState().triState !== 'blocked'`

### 3.3 业务规则一致性

**问题**：评分等级、风控阈值等业务规则散落在代码中，难以统一管理

**解决方案**：通过 JSDoc 注释记录业务规则，确保团队成员理解一致

**实例**：
- 评分等级划分：`score >= 80 = excellent`
- 风控三态：`blocked = 禁止执行`
- 这些规则在文档中明确记录，避免理解偏差

---

## 四、文档化对代码质量的价值

### 4.1 类型安全验证

**问题**：派生函数的参数和返回值类型可能不够明确

**解决方案**：通过 JSDoc 的 `@param`、`@returns` 标签，配合 TypeScript 类型定义，确保类型安全

**实例**：
```typescript
/**
 * @param {string} symbol - 股票代码
 * @returns {SymbolRiskStats} - 该标的的风险统计数据
 */
export function symbolRiskStats(symbol: string): SymbolRiskStats { ... }
```

### 4.2 边界情况处理

**问题**：派生函数在空数据或异常情况下的行为可能不明确

**解决方案**：通过 JSDoc 的 `@description` 和 `@example`，说明边界情况的处理

**实例**：
```typescript
/**
 * @returns {number} - 阻断比例（0-1），无裁决时返回 0
 */
export function blockedRate(): number { ... }
```

### 4.3 性能优化说明

**问题**：派生函数的性能特征（时间复杂度、缓存策略）可能不明确

**解决方案**：通过 JSDoc 的 `@performance` 标签，说明性能特征

**实例**：
```typescript
/**
 * @performance 时间复杂度 O(n)，空间复杂度 O(1)
 */
export const verdictStats = memoizeByRef((verdicts: readonly RiskVerdict[]) => { ... })
```

---

## 五、文档化对团队协作的价值

### 5.1 代码审查效率

**问题**：代码审查时需要理解大量派生计算逻辑

**解决方案**：通过 JSDoc 注释，审查者可以快速了解函数的意图和规则，聚焦于逻辑正确性

**实例**：
- 审查 `riskTrendDirection()` 时，通过 JSDoc 可以快速了解趋势判定算法
- 不需要逐行阅读代码，只需验证算法是否符合业务规则

### 5.2 知识共享

**问题**：核心业务逻辑的知识掌握在少数人手中

**解决方案**：通过文档化，核心业务规则被记录下来，成为团队共享的知识资产

**实例**：
- 风控三态判定规则、熔断状态机转换逻辑等核心业务知识
- 通过文档化，新成员可以快速掌握这些知识

### 5.3 业务规则变更追溯

**问题**：业务规则变更时，难以追溯所有相关代码

**解决方案**：通过文档化，业务规则被集中记录，变更时可以快速定位相关代码

**实例**：
- 如果需要调整风控三态判定阈值
- 通过文档可以快速找到所有使用该规则的派生函数

---

## 六、总结：文档化必要性评分

| 文件 | 业务价值 | 架构重要性 | 团队协作 | 维护成本 | **综合评分** |
|------|---------|-----------|---------|---------|------------|
| analysisStore.derived.ts | ⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐ | **12/16** |
| chatStore.derived.ts | ⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐ | ⭐⭐⭐ | **11/16** |
| riskStore.derived.ts | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | **18/20** |
| signalQualityStore.derived.ts | ⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐ | **13/16** |
| executionStoreSubscriptions.ts | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐ | **17/20** |

**优先级排序**：
1. **riskStore.derived.ts**（最高）— 影响交易安全性
2. **executionStoreSubscriptions.ts**（高）— 核心交易流程
3. **signalQualityStore.derived.ts**（中高）— 信号质量评估
4. **analysisStore.derived.ts**（中）— 评分分析
5. **chatStore.derived.ts**（中）— 聊天功能

---

## 七、建议

1. **建立文档化标准**：为派生计算文件制定统一的 JSDoc 模板
2. **定期审计**：运行 `npm run audit:docs` 确保文档覆盖率
3. **文档与代码同步**：修改业务规则时，同步更新文档
4. **团队培训**：向团队成员宣传文档化的重要性

---

> **分析结束**  
> **Generated**: 2026-07-09  
> **分析版本**: v1.1.0