---
title: pr-7-trade-error-classifier-split-plan
tier: important
code_version: 2.0.0
---

---
tier: important
code_version: 2.0.0
---

# PR-7 tradeErrorClassifier.ts 拆分方案文档

> **方案编号**: PR-7
> **方案日期**: 2026-07-08
> **方案类型**: 单模块重构（services 层内拆分，按 AGENTS.md §10 属"自主执行"边界）
> **方案状态**: 待审批（依赖关系图已分析完成，拆分边界已修订）
> **方案依据**: PR-6 §5.3 原方案 + tradeErrorClassifier.ts 767 行代码精读
> **方案原则**: 先画依赖关系图确认边界，再拆分；拆分必须保持调用点零修改

> **关联文档**:
> - 上游：pr-6-module-split-plan.md §5.3（原方案，本方案对其进行修订）
> - 同期：databridge-split-completion-archive.md、db-split-completion-archive.md

---

## 一、执行摘要

### 1.1 方案目标

针对 PR-6 §5.3 中 tradeErrorClassifier.ts（767 行，12 类错误检测）的拆分方案进行**依赖关系深度分析**，确认拆分边界是否合理，并基于真实依赖关系**修订原方案**。

### 1.2 核心结论（先说结论）

| 评估项 | 结论 |
|--------|------|
| PR-6 §5.3 按错误域分拆为 4 组（trend/risk/discipline/timing）是否合理？ | ❌ **不合理** |
| 错误域分组与代码实际依赖关系是否对齐？ | ❌ **完全错位**（4 组中 4 组内部依赖不一致） |
| 修订后的拆分边界 | ✅ **按"职责+依赖"分层**：definitions / utils / detectors（单文件）/ classifier |
| 调用点影响 | 2 处调用点零修改（保持 `classifyErrors` 主入口导出） |
| 风险等级 | 低（仅文件提取，无逻辑变更） |

### 1.3 修订原因一句话

**PR-6 §5.3 原方案按"错误语义域"分组，但实际代码依赖关系由"辅助函数共用"决定，二者完全错位——同组的 3 个检测器往往分别依赖不同的辅助函数，分拆后会引入 4 条跨文件依赖链路，反而增加复杂度。**

---

## 二、12 类错误规则依赖关系图（核心分析）

### 2.1 12 类错误检测器全景表

| # | 错误类型枚举 | 中文名称 | 严重等级 | 检测函数 | 依赖 buildTradePairs | 依赖 groupOrdersByDay | PR-6 §5.3 原错误域分组 |
|---|------------|---------|---------|---------|---------------------|---------------------|---------------------|
| 1 | CHASE_HIGH_SELL_LOW | 追涨杀跌 | critical | detectChaseHighSellLow | ❌ | ✅（用 `_map` 参数） | trend |
| 2 | EARLY_PROFIT_TAKING | 提前止盈 | major | detectEarlyProfitTaking | ✅ | ❌ | trend |
| 3 | NO_STOP_LOSS | 扛单不止损 | critical | detectNoStopLoss | ✅ | ❌ | risk |
| 4 | AGAINST_TREND_ADDING | 逆势加仓 | critical | detectAgainstTrendAdding | ❌ | ❌ | risk |
| 5 | GREEDY_TAIL_CHASING | 贪鱼尾 | major | detectGreedyTailChasing | ✅ | ❌ | trend |
| 6 | PLAN_VIOLATION | 违反计划 | critical | detectPlanViolation | ❌ | ❌ | discipline |
| 7 | HEAVY_GAMBLING | 重仓豪赌 | critical | detectHeavyGambling | ❌ | ❌ | risk |
| 8 | REVENGE_TRADING | 报复性交易 | major | detectRevengeTrading | ❌ | ❌ | discipline |
| 9 | FOMO_ENTRY | FOMO 入场 | major | detectFomoEntry | ✅ | ❌ | discipline |
| 10 | IGNORE_STOP_LOSS | 忽视止损 | critical | detectIgnoreStopLoss | ✅ | ❌ | timing |
| 11 | HESITATION_MISS | 犹豫错过 | minor | detectHesitationMiss | ❌ | ❌ | timing |
| 12 | OVERTRADING | 过度交易 | minor | detectOvertrading | ❌ | ✅（用 `dayGroups` 参数） | timing |

**统计**：
- 依赖 `buildTradePairs()`：5 个（#2, #3, #5, #9, #10）
- 依赖 `groupOrdersByDay()`：2 个（#1, #12）
- 完全独立：5 个（#4, #6, #7, #8, #11）

### 2.2 依赖关系图（ASCII）

```
                          ┌─────────────────────────────────┐
                          │  classifyErrors(orders)         │
                          │  主入口：编排 12 个检测器        │
                          │  - 顺序执行所有检测器            │
                          │  - 汇总 DetectedError 列表       │
                          │  - 计算纪律评分 100 - Σpenalty   │
                          └────────────────┬────────────────┘
                                           │
                                           │ 调用
                                           │
              ┌────────────────────────────┼────────────────────────────┐
              │                            │                            │
              ▼                            ▼                            ▼
   ┌─────────────────────┐     ┌─────────────────────┐     ┌─────────────────────┐
   │ groupOrdersByDay()  │     │  buildTradePairs()   │     │  （无辅助函数依赖）   │
   │  按日分组辅助函数    │     │  买卖配对辅助函数    │     │  独立检测器          │
   │  返回 Map<key,Order[]>│     │  返回 TradePair[]   │     │                     │
   └──────────┬──────────┘     └──────────┬──────────┘     └──────────┬──────────┘
              │                           │                           │
       ┌──────┴──────┐           ┌────────┼────────┬────────┐         │
       │             │           │        │        │        │         │
       ▼             ▼           ▼        ▼        ▼        ▼         │
   ┌───────┐    ┌───────┐   ┌───────┐┌───────┐┌───────┐┌───────┐    │
   │  #1   │    │  #12  │   │  #2   ││  #3   ││  #5   ││  #9   │    │
   │ 追涨  │    │ 过度  │   │ 提前  ││ 扛单  ││ 贪鱼  ││ FOMO  │    │
   │ 杀跌  │    │ 交易  │   │ 止盈  ││ 不止损││ 尾    ││ 入场  │    │
   │ crit  │    │ minor │   │ major ││ crit  ││ major ││ major │    │
   └───┬───┘    └───┬───┘   └───┬───┘└───┬───┘└───┬───┘└───┬───┘    │
       │            │           │        │        │        │         │
       │            │           │        │        │        │    ┌────┼────┬────┬────┬────┐
       │            │           │        │        │        │    │    │    │    │    │    │
       │            │           │        │        │        │    ▼    ▼    ▼    ▼    ▼    ▼
       │            │           │        │        │        │  #4   #6   #7   #8   #11
       │            │           │        │        │        │  逆势  违反  重仓  报复  犹豫
       │            │           │        │        │        │  加仓  计划  豪赌  交易  错过
       │            │           │        │        │        │  crit  crit  crit major minor
       │            │           │        │        │        │
       └────────────┴───────────┴────────┴────────┴────────┴──┐
                              │                                │
                              ▼                                ▼
              ┌───────────────────────────────────────────────────────┐
              │  共享依赖（所有 12 个检测器都依赖）                    │
              │  ┌──────────────────────────────────────────────────┐  │
              │  │  类型与常量层（来自行 22-202）                    │  │
              │  │  - TradeErrorType enum（12 值）                  │  │
              │  │  - ErrorSeverity type                            │  │
              │  │  - SEVERITY_PENALTY 常量 {critical:15, major:8, minor:3} │  │
              │  │  - TradeErrorDef / DetectedError 接口             │  │
              │  │  - ErrorClassificationResult 接口                 │  │
              │  └──────────────────────────────────────────────────┘  │
              └───────────────────────────────────────────────────────┘
```

### 2.3 主入口编排逻辑（classifyErrors 内部依赖）

```typescript
// 行 659-738：classifyErrors 主入口
export function classifyErrors(orders: Order[]): ErrorClassificationResult {
  const dayGroups = groupOrdersByDay(orders)  // ← 1 次调用，传给 #1 和 #12
  const detectedErrors: DetectedError[] = []

  const detectors = [
    { fn: (o, dg) => detectChaseHighSellLow(o, dg) },   // #1 用 dg
    { fn: (o)    => detectEarlyProfitTaking(o) },        // #2 内部调 buildTradePairs
    { fn: (o)    => detectNoStopLoss(o) },                // #3 内部调 buildTradePairs
    { fn: (o)    => detectAgainstTrendAdding(o) },        // #4 独立
    { fn: (o)    => detectGreedyTailChasing(o) },         // #5 内部调 buildTradePairs
    { fn: (o)    => detectPlanViolation(o) },             // #6 独立
    { fn: (o)    => detectHeavyGambling(o) },             // #7 独立
    { fn: (o)    => detectRevengeTrading(o) },            // #8 独立
    { fn: (o)    => detectFomoEntry(o) },                 // #9 内部调 buildTradePairs
    { fn: (o)    => detectIgnoreStopLoss(o) },            // #10 内部调 buildTradePairs
    { fn: (o)    => detectHesitationMiss(o) },            // #11 独立
    { fn: (o, dg) => detectOvertrading(o, dg) },          // #12 用 dg
  ]

  for (const detector of detectors) {
    const result = detector.fn(orders, dayGroups)
    if (result) detectedErrors.push(result)
  }
  // 计算纪律评分：100 - critical×15 - major×8 - minor×3
}
```

**关键观察**：
- `groupOrdersByDay()` 在主入口调用 1 次，结果通过参数传给 #1 和 #12
- `buildTradePairs()` 在 5 个检测器内部各自调用（不通过主入口传参）
- 所有 12 个检测器返回 `DetectedError | null`，主入口汇总

### 2.4 文件内部代码块依赖关系（按行号）

```
行 1-16      导入（logger, Order 类型, 常量）
   │
   ▼
行 22-101    类型定义层（5 个 export）
   │  ├─ ErrorSeverity (type)
   │  ├─ TradeErrorType (enum, 12 值)
   │  ├─ TradeErrorDef (interface)
   │  ├─ DetectedError (interface)
   │  └─ ErrorClassificationResult (interface)
   │
   ▼
行 107-192   ERROR_DEFINITIONS 数组（12 条，仅被 getErrorDefinitions() 使用）
   │
   ▼
行 198-202   SEVERITY_PENALTY 常量（被 12 个检测器 + calculateDisciplineScore 使用）
   │
   ▼
行 211-221   groupOrdersByDay() 函数（被 #1, #12 通过主入口传参使用）
   │
   ▼
行 227-595   12 个检测器函数（按顺序定义，互相独立无调用）
   │  ├─ detectChaseHighSellLow     (#1, 行 227-259)   用 _map 参数
   │  ├─ detectEarlyProfitTaking    (#2, 行 265-286)   内部调 buildTradePairs
   │  ├─ detectNoStopLoss           (#3, 行 292-313)   内部调 buildTradePairs
   │  ├─ detectAgainstTrendAdding   (#4, 行 319-359)   独立
   │  ├─ detectGreedyTailChasing    (#5, 行 365-386)   内部调 buildTradePairs
   │  ├─ detectPlanViolation        (#6, 行 391-413)   独立
   │  ├─ detectHeavyGambling        (#7, 行 419-450)   独立
   │  ├─ detectRevengeTrading       (#8, 行 456-483)   独立
   │  ├─ detectFomoEntry            (#9, 行 489-510)   内部调 buildTradePairs
   │  ├─ detectIgnoreStopLoss       (#10, 行 516-547)  内部调 buildTradePairs
   │  ├─ detectHesitationMiss       (#11, 行 552-595)  独立
   │  └─ detectOvertrading          (#12, 行 580-595)  用 dayGroups 参数
   │
   ▼
行 601-647   TradePair 接口 + buildTradePairs() 函数（被 #2,#3,#5,#9,#10 调用）
   │
   ▼
行 659-767   主入口（classifyErrors / getErrorDefinitions / getSeverityPenalties / calculateDisciplineScore）
```

**关键发现**：
- `buildTradePairs()` 定义在行 614，**晚于**它的 5 个调用者（行 265-547），靠 JavaScript hoisting（函数声明提升）工作
- 拆分后若将 `buildTradePairs()` 移到 utils 文件，必须确保检测器文件正确 import

---

## 三、PR-6 §5.3 原拆分方案合理性评估

### 3.1 原方案回顾

PR-6 §5.3 原方案按"错误语义域"将 12 个检测器分拆为 4 个文件：

| 文件 | 错误域 | 包含的检测器 |
|------|--------|------------|
| tradeErrorDetectors.trend.ts | 趋势组 | #1 追涨杀跌、#2 提前止盈、#5 贪鱼尾 |
| tradeErrorDetectors.risk.ts | 风险组 | #3 扛单不止损、#4 逆势加仓、#7 重仓豪赌 |
| tradeErrorDetectors.discipline.ts | 纪律组 | #6 违反计划、#8 报复性交易、#9 FOMO入场 |
| tradeErrorDetectors.timing.ts | 时机组 | #10 忽视止损、#11 犹豫错过、#12 过度交易 |

### 3.2 合理性评估矩阵

| 错误域分组 | 内部依赖一致性 | 跨文件依赖引入 | 评估 |
|-----------|--------------|--------------|------|
| trend（#1, #2, #5） | ❌ #1 用 dayGroups，#2/#5 用 buildTradePairs | 2 条 import（utils + dayGroups） | 不合理 |
| risk（#3, #4, #7） | ❌ #3 用 buildTradePairs，#4/#7 独立 | 1 条 import（utils） | 部分合理 |
| discipline（#6, #8, #9） | ❌ #9 用 buildTradePairs，#6/#8 独立 | 1 条 import（utils） | 部分合理 |
| timing（#10, #11, #12） | ❌ #10 用 pairs，#11 独立，#12 用 dayGroups | 2 条 import（utils + dayGroups） | 不合理 |

### 3.3 不合理原因深度分析

#### 问题 1：语义分组与代码依赖完全错位

PR-6 §5.3 按"错误心理学语义"分组（趋势/风险/纪律/时机），但代码实际依赖关系由"辅助函数共用"决定。这两套分组逻辑**没有任何相关性**：

```
错误域分组             代码依赖分组
─────────────         ─────────────
trend:   #1 #2 #5     pairsGroup:     #2 #3 #5 #9 #10
risk:    #3 #4 #7     dayGroupsGroup: #1 #12
discipl: #6 #8 #9     standalone:     #4 #6 #7 #8 #11
timing:  #10 #11 #12
```

两组分类**完全不重合**——同组的 3 个检测器往往分别属于不同的依赖分组。

#### 问题 2：增加跨文件依赖而非减少

按错误域分拆 4 个文件后，每个文件都需要 import：
- 类型与常量层（`TradeErrorType`, `SEVERITY_PENALTY`, `DetectedError` 等）
- 辅助函数（`buildTradePairs` 或 `groupOrdersByDay`，部分文件两个都要）

这意味着 4 个检测器文件 + 1 个 utils 文件 + 1 个 definitions 文件之间会形成 **N×M 的依赖网**，比当前单文件内部直接调用复杂得多。

#### 问题 3：测试复杂度倍增

按错误域分拆后，单元测试需要：
- 4 个独立的检测器测试文件
- 每个测试文件都需要 mock utils 和类型导入
- 跨文件 mock 的维护成本高

而单文件方案只需 1 个测试文件，mock 集中管理。

#### 问题 4：错误域语义价值低

12 类错误的"错误域"归类本质是**心理学语义标签**，对代码工程没有实际意义：
- 同组的检测器不共享状态、不共享数据、不共享逻辑
- 错误域分组不影响检测顺序（主入口是顺序执行所有检测器）
- 错误域分组不影响结果展示（`DetectedError` 已含 `severity` 字段）

### 3.4 评估结论

**PR-6 §5.3 按错误域分拆的方案不合理，必须修订。**

修订原则：
1. **按依赖关系而非语义分组**
2. **减少而非增加跨文件依赖**
3. **保持 12 个检测器在单文件**（400 行在合理范围内）
4. **仅提取真正独立的职责**（类型定义、辅助函数、主入口）

---

## 四、修订后的拆分方案（PR-7 推荐方案）

### 4.1 推荐方案 A：3 层职责分离（强推荐）

```
src/services/trading/
├── tradeErrorClassifier.ts        (~150 行，主入口 + 类型定义 + re-export)
├── tradeErrorDefinitions.ts       (~140 行，12 类错误定义 + 权重常量)
├── tradeErrorDetectors.ts         (~400 行，12 个检测器，单文件)
└── tradeErrorUtils.ts             (~70 行，buildTradePairs + groupOrdersByDay + TradePair 类型)
```

#### 4.1.1 文件职责与依赖方向

```
┌─────────────────────────────────────────────────────────────┐
│ tradeErrorClassifier.ts (主入口，~150 行)                    │
│ - classifyErrors() 主编排函数                                │
│ - getErrorDefinitions() / getSeverityPenalties() /          │
│   calculateDisciplineScore() 工具方法                        │
│ - re-export 子模块公共 API（向后兼容）                       │
└─────────────────────────────┬───────────────────────────────┘
                              │ import
          ┌───────────────────┼───────────────────┐
          ▼                   ▼                   ▼
┌─────────────────────┐ ┌─────────────────┐ ┌─────────────────────┐
│ tradeErrorDefinitions│ │ tradeErrorUtils  │ │ tradeErrorDetectors │
│ (~140 行)            │ │ (~70 行)         │ │ (~400 行)            │
│ - TradeErrorType enum│ │ - TradePair 接口 │ │ - 12 个 detect* 函数│
│ - ErrorSeverity type │ │ - buildTradePairs│ │ - 内部调 utils 函数  │
│ - TradeErrorDef 等   │ │ - groupOrdersByDay│ │                     │
│ - ERROR_DEFINITIONS  │ └─────────────────┘ └─────────────────────┘
│ - SEVERITY_PENALTY   │         ▲                     │
└─────────────────────┘         │                     │
        ▲                       │                     │
        │                       │                     │
        └───────────────────────┴─────────────────────┘
              （detectors 和 utils 都依赖 definitions 的类型与常量）
```

#### 4.1.2 依赖方向说明

| 文件 | 依赖 | 被依赖 |
|------|------|--------|
| tradeErrorDefinitions.ts | 无（纯类型与常量） | classifier, detectors, utils |
| tradeErrorUtils.ts | tradeErrorDefinitions（类型） | classifier, detectors |
| tradeErrorDetectors.ts | tradeErrorDefinitions（类型+常量）, tradeErrorUtils（函数） | classifier |
| tradeErrorClassifier.ts | 三个子模块全部 | 调用点（disciplineStore, generateTradeReview.useCase） |

**无循环依赖**：依赖方向单向，definitions 是底层基石。

#### 4.1.3 拆分边界合理性论证

| 评估维度 | 修订方案 | PR-6 §5.3 原方案 |
|---------|---------|------------------|
| 跨文件依赖数量 | 3 条（utils→def, detectors→def, detectors→utils, classifier→all） | 4 条检测器文件 + N×M 依赖网 |
| 文件数量 | 4 个（含主入口） | 5-7 个（含 4 个 detector 子文件） |
| 单文件最大行数 | ~400 行（detectors） | ~120 行 |
| 测试文件数量 | 3 个（每个子模块 1 个） | 5-7 个（每个子文件 1 个） |
| 检测器内聚性 | ✅ 12 个检测器在同一文件，共享上下文 | ❌ 同错误域检测器无代码内聚 |
| 辅助函数依赖 | ✅ detectors 单文件 import 1 次 utils | ❌ 4 个 detector 文件各自 import utils |
| 向后兼容 | ✅ re-export 保持 API 不变 | ✅ 同 |

### 4.2 备选方案 B：按依赖关系分拆 detectors（不推荐）

```
src/services/trading/
├── tradeErrorClassifier.ts        (~150 行)
├── tradeErrorDefinitions.ts       (~140 行)
├── tradeErrorUtils.ts             (~70 行)
├── tradeErrorDetectors.pairs.ts        (~180 行，#2 #3 #5 #9 #10)
├── tradeErrorDetectors.dayGroups.ts    (~80 行，#1 #12)
└── tradeErrorDetectors.standalone.ts   (~140 行，#4 #6 #7 #8 #11)
```

**不推荐原因**：
1. 6 个文件比方案 A 的 4 个文件多 50% 维护成本
2. 检测器最大文件仅 180 行，过度拆分
3. 主入口 `classifyErrors` 需要从 3 个 detector 文件分别 import，增加编排复杂度
4. 单元测试需要 3 个独立测试文件，mock 重复

### 4.3 推荐结论

**采用方案 A（3 层职责分离）**，理由：
1. 12 个检测器单文件 400 行在合理范围内（<500 行阈值）
2. 减少文件数量，降低维护成本
3. 简化测试（3 个测试文件 vs 5-7 个）
4. 依赖方向清晰，无循环依赖
5. 与 PR-6 §5.3 原方案的"工具函数 + 类型定义"提取思路一致，仅修订 detector 部分不拆分

---

## 五、实施方案（原子化步骤）

### 5.1 步骤 7.1：提取 tradeErrorDefinitions.ts（最低风险）

**操作**：
1. 新建 `src/services/trading/tradeErrorDefinitions.ts`
2. 移动行 22-202 的全部内容（5 个类型定义 + ERROR_DEFINITIONS 数组 + SEVERITY_PENALTY 常量）
3. tradeErrorClassifier.ts 顶部改为 `import type { ... } from './tradeErrorDefinitions'` 并 re-export
4. 验证 2 处调用点（disciplineStore, generateTradeReview.useCase）零修改

**预期文件**：
```typescript
// tradeErrorDefinitions.ts (~140 行)
export type ErrorSeverity = 'critical' | 'major' | 'minor'
export enum TradeErrorType { /* 12 值 */ }
export interface TradeErrorDef { /* ... */ }
export interface DetectedError { /* ... */ }
export interface ErrorClassificationResult { /* ... */ }
export const ERROR_DEFINITIONS: TradeErrorDef[] = [ /* 12 条 */ ]
export const SEVERITY_PENALTY: Record<ErrorSeverity, number> = { /* ... */ }
```

**验证**：
```powershell
npx tsc --noEmit
npm test -- --run tests/__tests__/services/trading/
npm run audit:layers
```

**回滚**：删除 tradeErrorDefinitions.ts，将内容还原回 tradeErrorClassifier.ts。

### 5.2 步骤 7.2：提取 tradeErrorUtils.ts

**操作**：
1. 新建 `src/services/trading/tradeErrorUtils.ts`
2. 移动行 601-647 的 `TradePair` 接口 + `buildTradePairs()` 函数
3. 移动行 211-221 的 `groupOrdersByDay()` 函数
4. tradeErrorClassifier.ts 顶部改为 `import { buildTradePairs, groupOrdersByDay } from './tradeErrorUtils'` 并 re-export

**预期文件**：
```typescript
// tradeErrorUtils.ts (~70 行)
import type { Order } from '@/data/types'
import { PERCENTAGE_BASE } from '@/constants/trade.constants'

export interface TradePair { /* ... */ }
export function buildTradePairs(orders: Order[]): TradePair[] { /* ... */ }
export function groupOrdersByDay(orders: Order[]): Map<string, Order[]> { /* ... */ }
```

**验证**：
```powershell
npx tsc --noEmit
npm test -- --run tests/__tests__/services/trading/
npm run audit:layers
```

**回滚**：删除 tradeErrorUtils.ts，将内容还原回 tradeErrorClassifier.ts。

### 5.3 步骤 7.3：提取 tradeErrorDetectors.ts

**操作**：
1. 新建 `src/services/trading/tradeErrorDetectors.ts`
2. 移动行 227-595 的 12 个检测器函数
3. 顶部 import 类型与常量从 `./tradeErrorDefinitions`，import 辅助函数从 `./tradeErrorUtils`
4. tradeErrorClassifier.ts 顶部改为 `import { detectChaseHighSellLow, ... } from './tradeErrorDetectors'` 并 re-export

**预期文件**：
```typescript
// tradeErrorDetectors.ts (~400 行)
import type { DetectedError } from './tradeErrorDefinitions'
import { TradeErrorType, SEVERITY_PENALTY } from './tradeErrorDefinitions'
import { buildTradePairs, groupOrdersByDay } from './tradeErrorUtils'
import type { Order } from '@/data/types'

export function detectChaseHighSellLow(orders: Order[], _map: Map<string, Order[]>): DetectedError | null { /* ... */ }
export function detectEarlyProfitTaking(orders: Order[]): DetectedError | null { /* ... */ }
// ... 12 个检测器全部 export
```

**验证**：
```powershell
npx tsc --noEmit
npm test -- --run tests/__tests__/services/trading/
npm run audit:layers
npm run audit:hardcode
```

**回滚**：删除 tradeErrorDetectors.ts，将内容还原回 tradeErrorClassifier.ts。

### 5.4 步骤 7.4：精简 tradeErrorClassifier.ts（最终聚合入口）

**操作**：
1. tradeErrorClassifier.ts 仅保留主入口（`classifyErrors`, `getErrorDefinitions`, `getSeverityPenalties`, `calculateDisciplineScore`）
2. 顶部统一 re-export 子模块公共 API（保持向后兼容）
3. 文档化新结构

**预期结果**：
```typescript
// tradeErrorClassifier.ts (~150 行)
import { getLogger } from '@/lib/logger'
import type { Order } from '@/data/types'
import { MAX_SCORE, MIN_SCORE } from '@/constants/trade.constants'
import {
  ERROR_DEFINITIONS,
  SEVERITY_PENALTY,
  type ErrorSeverity,
  type TradeErrorType,
  type TradeErrorDef,
  type DetectedError,
  type ErrorClassificationResult,
} from './tradeErrorDefinitions'
import { groupOrdersByDay } from './tradeErrorUtils'
import {
  detectChaseHighSellLow,
  detectEarlyProfitTaking,
  detectNoStopLoss,
  detectAgainstTrendAdding,
  detectGreedyTailChasing,
  detectPlanViolation,
  detectHeavyGambling,
  detectRevengeTrading,
  detectFomoEntry,
  detectIgnoreStopLoss,
  detectHesitationMiss,
  detectOvertrading,
} from './tradeErrorDetectors'

const logger = getLogger()

// re-export 保持调用点零修改
export type {
  ErrorSeverity,
  TradeErrorType,
  TradeErrorDef,
  DetectedError,
  ErrorClassificationResult,
} from './tradeErrorDefinitions'
export { ERROR_DEFINITIONS, SEVERITY_PENALTY } from './tradeErrorDefinitions'
export { buildTradePairs, groupOrdersByDay } from './tradeErrorUtils'
export type { TradePair } from './tradeErrorUtils'
export {
  detectChaseHighSellLow,
  detectEarlyProfitTaking,
  detectNoStopLoss,
  detectAgainstTrendAdding,
  detectGreedyTailChasing,
  detectPlanViolation,
  detectHeavyGambling,
  detectRevengeTrading,
  detectFomoEntry,
  detectIgnoreStopLoss,
  detectHesitationMiss,
  detectOvertrading,
} from './tradeErrorDetectors'

// 主入口
export function classifyErrors(orders: Order[]): ErrorClassificationResult { /* ... */ }
export function getErrorDefinitions(): TradeErrorDef[] { /* ... */ }
export function getSeverityPenalties(): Record<ErrorSeverity, number> { /* ... */ }
export function calculateDisciplineScore(stats: { /* ... */ }): number { /* ... */ }
```

**验证**：
```powershell
npx tsc --noEmit
npm test -- --run
npm run audit:layers
npm run audit:hardcode
npm run audit:deadcode
```

**回滚**：删除 3 个新文件，将内容还原回 tradeErrorClassifier.ts 单文件。

### 5.5 拆分风险矩阵

| 步骤 | 风险 | 影响范围 | 回滚成本 | 验证强度 |
|------|------|----------|----------|----------|
| 7.1 提取 definitions | 极低 | 0 调用点修改 | 极低 | tsc + 1 测试套件 |
| 7.2 提取 utils | 极低 | 0 调用点修改 | 极低 | tsc + 1 测试套件 |
| 7.3 提取 detectors | 低 | 0 调用点修改（re-export 兼容） | 低 | tsc + 1 测试套件 + audit |
| 7.4 精简 classifier | 低 | 仅文档化 | 极低 | tsc + 全量测试 + 全量审计 |

---

## 六、调用点影响分析

### 6.1 当前调用点清单（修正：7 处生产 + 5 处测试 = 12 处）

> **⚠️ 修正说明（2026-07-08）**：原方案记录"2 处调用点"为低估，经 `grep tradeErrorClassifier` 全量扫描后确认实际 12 处调用点。re-export 兼容策略保持不变，所有调用点零修改。

#### 6.1.1 生产代码调用点（7 处）

| 调用点文件 | 行号 | 导入符号 | 用途 |
|-----------|------|---------|------|
| `src/store/disciplineStore.ts` | 45 | `classifyErrors` | 交易纪律评分计算 |
| `src/services/useCase/generateTradeReview.useCase.ts` | 14 | `classifyErrors` | 交易复盘报告生成 |
| `src/services/trading/tradeReviewAI.types.ts` | 7-8 | `TradeErrorType`, `DetectedError` | AI 复盘类型定义 |
| `src/services/trading/tradeReviewAI.profileGenerator.ts` | 11-12 | `TradeErrorType`, `ErrorClassificationResult` | 心理画像生成 |
| `src/services/trading/tradeReviewAI.dimensions.ts` | 16 | `TradeErrorType` | 六维评估 |
| `src/services/trading/tradeReviewAI.skillDevelopment.ts` | 9 | `ErrorClassificationResult` | 技能发展建议 |
| `src/services/trading/tradeReviewAI.reportGenerator.ts` | 13-16 | `ErrorClassificationResult`, `TradeErrorType` | 报告生成主入口 |

#### 6.1.2 测试代码调用点（5 处）

| 调用点文件 | 行号 | 导入符号 |
|-----------|------|---------|
| `src/services/trading/tradeReviewAI.reportGenerator.test.ts` | 9-10 | `ErrorClassificationResult`, `TradeErrorType` |
| `src/services/trading/tradeReviewAI.profileGenerator.test.ts` | 3-4 | `ErrorClassificationResult`, `TradeErrorType` |
| `src/services/trading/tradeReviewAI.test.ts` | 4 | `TradeErrorType` |
| `src/services/trading/tradeReviewAI.skillDevelopment.test.ts` | 3-4 | `ErrorClassificationResult`, `TradeErrorType` |
| `src/store/disciplineStore.test.ts` | 20 | `vi.mock('@/services/trading/tradeErrorClassifier')` |

#### 6.1.3 调用面分析

**核心导出符号被调用频次**：
- `TradeErrorType` enum：6 处生产 + 4 处测试 = 10 处（最高频，跨多个 tradeReviewAI 子模块）
- `ErrorClassificationResult` type：4 处生产 + 3 处测试 = 7 处
- `DetectedError` type：1 处生产 + 0 处测试 = 1 处
- `classifyErrors` function：2 处生产 + 1 处 mock = 3 处
- `getErrorDefinitions` / `getSeverityPenalties` / `calculateDisciplineScore`：0 处（仅在文档中提及，实际无外部调用）

**关键结论**：`TradeErrorType` 和 `ErrorClassificationResult` 是高频被引用的类型，拆分后必须通过 re-export 保持原导入路径 `@/services/trading/tradeErrorClassifier` 可用。

### 6.2 调用点零修改保证

通过 re-export 模式，tradeErrorClassifier.ts 保持原有的所有导出符号：

```typescript
// 原 tradeErrorClassifier.ts 的导出（拆分前）
export type ErrorSeverity
export enum TradeErrorType
export interface TradeErrorDef
export interface DetectedError
export interface ErrorClassificationResult
export function classifyErrors(orders: Order[]): ErrorClassificationResult
export function getErrorDefinitions(): TradeErrorDef[]
export function getSeverityPenalties(): Record<ErrorSeverity, number>
export function calculateDisciplineScore(stats): number

// 拆分后（re-export 保持全部导出）
export type { ErrorSeverity, TradeErrorType, ... } from './tradeErrorDefinitions'
export { ERROR_DEFINITIONS, SEVERITY_PENALTY } from './tradeErrorDefinitions'
export { buildTradePairs, groupOrdersByDay } from './tradeErrorUtils'  // 新增导出（可选）
export { detectChaseHighSellLow, ... } from './tradeErrorDetectors'   // 新增导出（可选）
export function classifyErrors(orders) { /* ... */ }  // 保留在主入口
export function getErrorDefinitions() { /* ... */ }
export function getSeverityPenalties() { /* ... */ }
export function calculateDisciplineScore(stats) { /* ... */ }
```

**调用点零修改**：2 处调用点不需要任何代码改动。

---

## 七、测试计划

### 7.1 新增单元测试

| 测试文件 | 覆盖目标 | 关键用例 |
|---------|---------|---------|
| `tests/__tests__/services/trading/tradeErrorDefinitions.test.ts` | 类型与常量层 | 12 类错误定义完整性、SEVERITY_PENALTY 数值正确性、枚举值不重复 |
| `tests/__tests__/services/trading/tradeErrorUtils.test.ts` | 辅助函数 | buildTradePairs 配对正确性、groupOrdersByDay 分组正确性、空输入处理 |
| `tests/__tests__/services/trading/tradeErrorDetectors.test.ts` | 12 个检测器 | 每个检测器的正例/负例/边界情况 |

### 7.2 交叉测试（行为一致性回归）

```typescript
// tests/__tests__/services/trading/tradeErrorClassifier.regression.test.ts（新增）
describe('tradeErrorClassifier 拆分后行为回归', () => {
  it('12 类错误检测在拆分前后输出一致', () => {
    // 1. 构造测试订单数据（覆盖 12 类错误场景）
    // 2. 调用 classifyErrors
    // 3. 对比拆分前的快照结果
  })

  it('纪律评分计算公式保持 100 - critical×15 - major×8 - minor×3', () => { /* ... */ })
  it('空订单列表返回满分 100', () => { /* ... */ })
})
```

### 7.3 验证命令清单

```powershell
# === 类型安全 ===
npx tsc --noEmit

# === ESLint ===
npm run lint --max-warnings 0

# === 单元测试 ===
npm test -- --run tests/__tests__/services/trading/

# === 架构审计 ===
npm run audit:layers
npm run audit:hardcode
npm run audit:deadcode

# === 全量回归 ===
npm test -- --run
npm run build
```

---

## 八、与 PR-6 的关系

### 8.1 PR-7 在 PR-6 体系中的定位

```
PR-6 大型模块分拆方案
├── 阶段 1：db.ts 分拆                    ✅ 已完成（2026-07-07）
├── 阶段 2：databridge 系列解耦            ✅ 已完成（2026-07-08）
├── 阶段 3：中优先级模块分拆（4 个模块）
│   ├── 3.1 executionStore 分拆            ⏸️ 待审批
│   ├── 3.2 BacktestEngine 分拆            ⏸️ 待审批
│   ├── 3.3 tradeErrorClassifier 分拆      ⏸️ 待审批 → 由 PR-7 接管
│   └── 3.4 dataFusionEngine 归档          ⏸️ 待审批
└── 阶段 4：全量验证与文档更新
```

### 8.2 PR-7 与 PR-6 §5.3 的关系

| 维度 | PR-6 §5.3 原方案 | PR-7 修订方案 |
|------|----------------|--------------|
| 拆分触发 | 阶段 3 步骤 3.3 | 独立 PR-7 |
| 拆分策略 | 按错误域分 4 组 + definitions + utils | 3 层职责分离（definitions + utils + 单文件 detectors） |
| detector 文件数 | 4 个（trend/risk/discipline/timing） | 1 个（tradeErrorDetectors.ts） |
| 总文件数 | 6-7 个 | 4 个 |
| 调用点影响 | 2 处零修改 | 2 处零修改（一致） |
| 测试文件数 | 5-7 个 | 3 个 |
| 风险等级 | 中（多文件跨依赖） | 低（单文件 detector） |

### 8.3 文档更新要求

PR-7 实施后需要更新以下文档：
1. `docs/changelogs/2026-07/pr-6-module-split-plan.md` — §5.3 标注"由 PR-7 接管，方案已修订"
2. 新建 `docs/changelogs/2026-07/trade-error-classifier-split-completion-archive.md` — 完成归档
3. `../../06-routing-specs.md` — 如有接口签名变更（本次无）

---

## 九、预期收益量化

| 指标 | 当前值 | 目标值 | 改善幅度 |
|------|--------|--------|---------|
| tradeErrorClassifier.ts 行数 | 767 | ~150 | 80%+ |
| 单文件最大行数（services 层） | 767 | ~400（detectors） | 48% |
| 圈复杂度（CC） | 估算 >40 | <30（拆分后） | 25%+ |
| 文件职责清晰度 | 5 职责混杂 | 1 职责/文件 | 5× 改善 |
| 跨文件依赖 | 0（单文件） | 3 条（单向无环） | 工程可接受 |
| 调用点修改数 | - | 0 | 100% 兼容 |

---

## 十、方案审批记录

| 审批节点 | 状态 | 审批人 | 日期 | 备注 |
|---------|------|--------|------|------|
| 依赖关系图分析 | ✅ 已完成 | AI | 2026-07-08 | 12 类错误规则依赖关系已画完 |
| 拆分边界合理性评估 | ✅ 已完成 | AI | 2026-07-08 | PR-6 §5.3 原方案不合理，已修订 |
| 方案文档审批 | ⏸️ 待审批 | 用户 | - | 等待用户确认采用方案 A |
| 步骤 7.1 完成审批 | ⏸️ 待审批 | 用户 | - | 提取 definitions |
| 步骤 7.2 完成审批 | ⏸️ 待审批 | 用户 | - | 提取 utils |
| 步骤 7.3 完成审批 | ⏸️ 待审批 | 用户 | - | 提取 detectors |
| 步骤 7.4 完成审批 | ⏸️ 待审批 | 用户 | - | 精简 classifier |

---

## 十一、附录

### 11.1 12 类错误心理根源映射（参考）

| # | 错误类型 | 心理根源 | 严重等级 |
|---|---------|---------|---------|
| 1 | 追涨杀跌 | 贪婪与恐惧交替，缺乏独立判断，从众心理 | critical |
| 2 | 提前止盈 | 对利润的恐惧，害怕回吐浮盈，缺乏持仓信心 | major |
| 3 | 扛单不止损 | 损失厌恶，不愿承认错误，赌徒心理 | critical |
| 4 | 逆势加仓 | 过度自信，想摊平成本，拒绝接受失败 | critical |
| 5 | 贪鱼尾 | 贪婪，追求完美，想抓住最后一段利润 | major |
| 6 | 违反计划 | 缺乏纪律，自我控制力弱，临场冲动 | critical |
| 7 | 重仓豪赌 | 急功近利，想快速翻本或暴富，风险意识不足 | critical |
| 8 | 报复性交易 | 愤怒、不甘心，想立刻挽回损失 | major |
| 9 | FOMO 入场 | 害怕错过，跟风心理，同伴压力 | major |
| 10 | 忽视止损 | 侥幸心理，过度自信，不愿接受小损失 | critical |
| 11 | 犹豫错过 | 过度谨慎，完美主义，害怕犯错 | minor |
| 12 | 过度交易 | 交易成瘾，无聊，寻求刺激 | minor |

### 11.2 参考文档

- [AGENTS.md v1.3.4](../../../../AGENTS.md) — 项目分层规则与编码契约
- PR-6 大型模块分拆方案 — 上游方案（§5.3 由 PR-7 修订）
- db.ts 拆分归档 — PR-6 阶段 1 归档
- databridge 拆分归档 — PR-6 阶段 2 归档

---

## 十二、附录：重复代码发现（拆分前必须知晓）

> **⚠️ 重要发现（2026-07-08 拆分前审计）**：在运行 `audit:layers` 后补充验证时，发现代码库中存在 **3 个 `buildTradePairs` 实现**。这影响 PR-7 拆分方案的边界设计。

### 12.1 三个 buildTradePairs 实现对比

| # | 文件 | 行号 | 返回类型 | 字段差异 | 算法 |
|---|------|------|---------|--------|------|
| 1 | `tradeErrorClassifier.ts` | 614 | `TradePair[]`（本地接口） | buyId, sellId, **buyPrice, sellPrice**, profitPct, holdDays | FIFO 配对，profitPct 用 `PERCENTAGE_BASE` 取整 |
| 2 | `tradeReviewAI.utils.ts` | 13 | `TradePair[]`（from tradeReviewAI.types） | buyId, sellId, profitPct, holdDays | FIFO 配对，profitPct 用字面量 `100` 取整 |
| 3 | `positionComputer.ts` | 111 | `SymbolTradePair[]` | 含 symbol 聚合统计（totalBuy/totalSell） | **不同算法**（按 symbol 聚合统计） |

### 12.2 关键观察

#### 12.2.1 #1 与 #2 几乎完全重复

`tradeErrorClassifier.ts:614` 和 `tradeReviewAI.utils.ts:13` 的 `buildTradePairs` 实现逻辑**完全相同**（FIFO 配对算法），仅有两点差异：

1. **TradePair 接口字段**：#1 多了 `buyPrice` 和 `sellPrice` 两个字段
2. **取整常量**：#1 使用 `PERCENTAGE_BASE`（来自 `@/constants/trade.constants`），#2 使用字面量 `100`

#### 12.2.2 #1 的 buyPrice/sellPrice 实际未被使用

精读 `tradeErrorClassifier.ts` 中 5 个依赖 `buildTradePairs` 的检测器：

| 检测器 | 使用的字段 | 是否使用 buyPrice/sellPrice |
|--------|---------|--------------------------|
| detectEarlyProfitTaking | `pair.profitPct` | ❌ |
| detectNoStopLoss | `pair.profitPct` | ❌ |
| detectGreedyTailChasing | `pair.profitPct`, `pair.holdDays` | ❌ |
| detectFomoEntry | `pair.profitPct`, `pair.holdDays` | ❌ |
| detectIgnoreStopLoss | `pair.profitPct` | ❌ |

**结论**：`buyPrice` 和 `sellPrice` 字段从未被任何检测器使用，属于**死代码**。

#### 12.2.3 #3 是完全不同的实现

`positionComputer.ts:111` 的 `buildTradePairs` 返回 `SymbolTradePair[]`，按 symbol 聚合统计（totalBuy/totalSell/平均成本价），算法和用途完全不同，不应视为重复。

### 12.3 对 PR-7 拆分方案的影响

#### 12.3.1 拆分时的处理策略（推荐）

**策略 A（保守，PR-7 范围内）**：保留重复，仅拆分不合并
- 将 `tradeErrorClassifier.ts` 的 `buildTradePairs` 原样移到 `tradeErrorUtils.ts`
- 不修改 `tradeReviewAI.utils.ts`（避免影响其他模块）
- 在 `tradeErrorUtils.ts` 中保留 `buyPrice/sellPrice` 字段（即使未使用，避免破坏接口）

**策略 B（积极，PR-7 范围外建议）**：合并去重
- 将 `tradeErrorUtils.ts` 的 `buildTradePairs` 作为唯一实现
- 删除 `tradeReviewAI.utils.ts` 中的重复实现，改从 `@/services/trading/tradeErrorUtils` 导入
- 统一 `TradePair` 类型定义（移除 `buyPrice/sellPrice` 死字段）
- **风险**：需要修改 `tradeReviewAI.utils.ts` 及其调用链，超出 PR-7 范围

#### 12.3.2 推荐方案

**PR-7 采用策略 A**（保守），理由：
1. PR-7 的核心目标是拆分 tradeErrorClassifier.ts，不是代码去重
2. 去重涉及 tradeReviewAI 子模块的修改，需要独立的回归测试
3. 拆分后再发起 PR-8 处理去重问题更安全

**记录为后续优化项**：在 PR-7 完成后，可发起 PR-8 "buildTradePairs 去重与统一"，采用策略 B。

### 12.4 拆分前 audit:layers 验证结果

```powershell
$ npm run audit:layers

[2026-07-08T00:25:27.438Z] 开始审计: audit-layer-calls v3.0
{
  "violations": [],
  "warnings": [],
  "summary": {
    "totalFiles": 770,
    "totalViolations": 0,
    "totalWarnings": 0
  }
}
[2026-07-08T00:25:27.823Z] 扫描完成: 770 文件, 0 违规, 耗时 0.38s
✅ 未发现跨层调用违规或警告
```

**确认**：
- ✅ `tradeErrorClassifier.ts` 当前依赖结构合规（services 层仅依赖 lib/data/constants）
- ✅ 12 处调用点全部为合法的 services 层内部调用或 store→services 调用
- ✅ 无循环依赖、无跨层违规
- ⚠️ 存在 `buildTradePairs` 重复实现（不影响拆分合规性，但建议后续去重）

**结论**：当前依赖结构符合 PR-7 方案 A 的拆分前提，可以开始实施。

---

**方案文档结束**

请审阅本方案，特别是：
1. §二 12 类错误规则依赖关系图 — 确认依赖分析准确性
2. §三 PR-6 §5.3 合理性评估 — 确认"按错误域分拆不合理"的结论
3. §四 推荐方案 A（3 层职责分离）— 确认是否采用
4. §五 实施步骤 — 确认 4 个原子步骤的可接受性
5. §十 审批记录 — 等待用户审批后开始实施

审批后即可开始步骤 7.1（最低风险，先行验证流程）。
