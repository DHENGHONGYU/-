---title: "如何配置 V6 评分引擎权重与阈值"
domain: project
status: active
last_updated: 2026-08-23
code_version: 2.0.0-rc.2
version: v2.0.3
change_log:
  - version: 2.0.3
    changes: "基准校对(2026-08-23)：A类双轨(fm v2.0.2 / 正文 v2.0.0) → 取真值 max=2.0.2 → PATCH++ 对齐 frontmatter/正文/change_log 三轨"
    date: 2026-08-23
  - version: v2.0.2
    changes: "基准日校对(2026-08-22)：R1取真值(P1 change_log 最新条目=v2.0.1) → R2 PATCH++(v2.0.2) / last_updated 刷新 / change_log 闭环"
    date: 2026-08-22
- version: v2.0.1
    changes: "基准日校对(2026-08-22)：R1取真值(P2 正文版本声明行=v2.0.0) → R2 PATCH++(v2.0.1) / last_updated 刷新 / change_log 闭环"
    date: 2026-08-22
---
covers_code:
  - src/services/scoring/v6-engine/config.ts
  - src/services/scoring/v6-engine/types.ts


---
title: 如何配置 V6 评分引擎权重与阈值
type: how-to
domain: backend
phase: design
tier: standard
status: active
maintainer: V9 Architecture Team
summary: "面向开发者与投研用户的 V6 评分引擎配置指南，覆盖 11 层因子权重、行业基准、评级阈值的修改流程与回测验证方法"
tags: [backend, scoring, v6, configuration, factors, weights]
version: v2.0.0
last_updated: 2026-08-09
code_version: "2.0.0-rc.2"
doc_id: V9-DOC-BACK-046
related_docs: [V9-DOC-BACK-020, V9-DOC-DATA-077]
change_log:
  - version: v2.0.0
    changes: "v2.0 权重区分度增强 — 降权数据缺失中性层(L0/L4)、提权真实数据支撑层(L3v/L8)、评级阈值下移"
    date: 2026-08-09
  - version: v1.0.0
    changes: Initial version established
    date: 2026-07-19
---

# 如何配置 V6 评分引擎权重与阈值

> **版本**：v2.0.3  
> **更新日期**：2026-08-09  
> **适用范围**：需要调整 V6 评分引擎的 11 层因子权重、行业估值基准、评级阈值，或进行策略回测验证的开发者与投研用户
---

## 前置检查清单

开始配置前，请逐项确认以下前置条件：

- [ ] 已阅读并理解 [V6 评分契约文档](../../reference/scoring-contract.md) 中的评分口径定义
- [ ] 已能独立运行完整评分流水线（参见 [如何运行评分流水线](./how-to-run-scoring-pipeline.md)）
- [ ] 了解 V6 评分模型的 11 层因子结构（L-1 至 L8）
- [ ] 具备 TypeScript 基础阅读能力，能修改配置文件
- [ ] 已确认当前工作分支非主干分支，配置修改需走独立分支评审
- [ ] 修改前已通过 git 提交保存当前状态，可随时回滚

---

## V6 评分模型概览

### 1.1 9 大维度与 11 层因子

V6 评分引擎采用**多层级加权评分架构**，将个股分析拆解为 11 个可独立计算、可独立跳过的因子层：

| 层级 | 因子名称 | 因子类别 | v1.0 权重 | v2.0 权重 | 数据来源 |
|------|------|---------|---------|---------|---------|
| L-1 | 行业景气度 | 行业层 | 10% | **11%** | 基于 SKILL-C/N 分类 |
| L0 | STEEP 宏观环境 | 宏观层 | 8% | **4%** ↓ | 宏观指标数据 |
| L1 | 基本面质量 | 财务层 | 15% | **12%** ↓ | 财报 + 衍生指标 |
| L2 | 成长能力 | 财务层 | 10% | 10% | 财报同比环比 |
| L3f | 财务健康度 | 财务层 | 10% | 10% | 资产负债与现金流 |
| L3v | 估值水平 | 估值层 | 8% | **14%** ↑ | PE/PB/PEG 对比 |
| L4 | 盈利能力 | 财务层 | 8% | **4%** ↓ | 利润率 + 回报率 |
| L5 | T-M 技术动量 | 技术层 | 5% | 5% | 量价 与 趋势指标 |
| L6 | Hype 情绪热度 | 情绪层 | 7% | **6%** ↓ | 舆情 + 资金流向 |
| L7 | 综合预期 | 预期层 | 15% | **12%** ↓ | 分析师 + 0-1 标准化 |
| L8 | 风险因子 | 风险层 | 4% | **10%** ↑ | K线 + 事件风险 |

> **权重约束**：全部权重之和 = 1.0（100%）。当某层数据缺失被跳过时，剩余层权重自动归一化（例如跳过 L-1 与 L0 后，剩余权重按 15% 档等比例放大，保证总分口径一致）。

### 1.1.1 v2.0 权重调整依据（区分度增强版）

**根因分析**：
1. **数据缺失中性层权重偏高**：L0 STEEP 宏观、L4 情景推演在无财务/行业数据时返回约 3 分中性评分，是拉向评分中心的主要力量。
2. **真实数据支撑层权重偏低**：L3v 估值（PE/PB）、L8 技术筹码（K线）有真实数据支撑且能跨股票区分，但权重仅 8% 与 4%，区分度贡献不足。
3. **评级阈值过高**：v1.0 阈值 strongBuy≥4.0 / buy≥3.0 / hold≥2.0 / sell≥1.0，在评分集中在 2.0–2.6 时，buy≥3.0 永远无法达到。

**调整策略**：

| 调整类别 | 涉及层 | v1.0 → v2.0 | 调整依据 |
|---------|--------|-------------|---------|
| 降低缺失中性层权重 | L0 / L4 | 8%/8% → 4%/4% | 无财务/行业数据时返回中性分，是拉向中心的主因 |
| 提高真实数据支撑层权重 | L3v / L8 | 8%/4% → 14%/10% | 真实 PE/PB/K线能反映估值高低与趋势，跨股票区分度高 |
| 降低离线中性层权重 | L1 / L7 | 15%/15% → 12%/12% | 离线模式下无护城河/第二曲线主观判断数据，返回中性分 |
| 小幅调整 | L-1 / L6 | 10%/7% → 11%/6% | L-1 有行业基准可区分；L6 舆情数据不稳定降权 |

**预期分布变化**（20 只穿行测试验证）：

| 指标 | v1.0 | v2.0 | 变化 |
|------|------|------|------|
| 均值 μ | 2.532 | 2.575 | +0.043 |
| 标准差 σ | 0.196 | 0.290 | **+48%** |
| 极差 | 0.677 | 0.900 | **+33%** |
| 买入(buy) | 0 只 | 9 只 | +9 |
| 持有(hold) | 20 只 | 11 只 | -9 |

> **核心结论**：v1.0 评分严重集中（20 只全部"持有"，无区分度），v2.0 通过降权中性层、提权真实数据层和下移评级阈值，使标准差提升 48%，出现 9 只"买入"评级，区分度显著增强。

### 1.2 配置文件结构

所有配置项统一定义于 `src/services/scoring/v6-engine/config.ts`：

主要导出常量如下：

| 配置类别 | 常量名 | 说明 |
|----------|---------|------|
| 权重配置 | `DEFAULT_WEIGHTS` | 11 层因子默认权重 |
| 阈值配置 | `DEFAULT_THRESHOLDS` | 评级分档与分数区间阈值 |
| 行业基准 | `INDUSTRY_BENCHMARKS` | 8 大行业的 PE/PB 基准 |
| 风险提示 | `RISK_WARNINGS` | 风险提示文案配置 |
| IPC 配置 | `IPC_CONFIG` | 跨进程通信与批处理参数 |
| 筹码分级 | `CHIP_LEVELS` | 筹码分布分级阈值 |
| 置信度配置 | `CONFIDENCE_CONFIG` | 评分置信度计算参数 |
| 引擎总配置 | `DEFAULT_ENGINE_CONFIG` | 引擎级默认配置汇总 |

---

## 场景 1：调整因子权重

### 1.1 默认权重定义

```typescript
// src/services/scoring/v6-engine/config.ts
// v2.0 区分度增强版权重
export const DEFAULT_WEIGHTS: V6ScoreWeightsConfig = {
  lMinus1: 0.11,   // L-1 行业景气度 (11%)  v1.0: 10% → +1%
  l0: 0.04,        // L0 STEEP 宏观环境 (4%)  v1.0: 8% → -4% 数据缺失中性层降权
  l1: 0.12,        // L1 基本面质量 (12%)  v1.0: 15% → -3% 离线中性层降权
  l2: 0.10,        // L2 成长能力 (10%)  不变
  l3f: 0.10,       // L3f 财务健康度 (10%)  不变
  l3v: 0.14,       // L3v 估值水平 (14%)  v1.0: 8% → +6% 真实PE/PB支撑层提权
  l4: 0.04,        // L4 盈利能力 (4%)  v1.0: 8% → -4% 数据缺失中性层降权
  l5: 0.05,        // L5 T-M 技术动量 (5%)  不变
  l6: 0.06,        // L6 Hype 情绪热度 (6%)  v1.0: 7% → -1%
  l7: 0.12,        // L7 综合预期 (12%)  v1.0: 15% → -3% 离线中性层降权
  l8: 0.10,        // L8 风险因子 (10%)  v1.0: 4% → +6% 真实K线支撑层提权
}
```

### 1.2 权重归一化机制

当某层因子因数据缺失被跳过时，引擎会自动对剩余权重归一化，保证总分仍在 0-5 区间：

```typescript
// aggregate() 中的归一化逻辑
const normalizedScore = totalWeight > 0
  ? Math.max(0, Math.min(5, (weightedSum / totalWeight)))
  : 0
```

**归一化规则**：
- 默认情况下 11 层全部参与计算时 `totalWeight = 1.0`，总分直接等于加权和
- 当部分层被跳过（数据缺失）时 `totalWeight < 1.0`，剩余层得分按实际权重占比重新放大
- 例如跳过 L-1 与 L0（合计缺失 18%），最终得分 = 剩余加权和 / 0.82

> **设计意图**：归一化机制保证「数据不全的股票」与「数据完整的股票」评分可比，避免因 L1 财报层或 L7 预期层缺失导致分数系统性偏低。但这也意味着权重调整会改变缺失场景下的放大系数，调整后必须回测验证。

### 1.3 权重调整操作步骤

**步骤 1**：打开配置文件

```bash
code src/services/scoring/v6-engine/config.ts
```

**步骤 2**：修改 `DEFAULT_WEIGHTS` 中目标层权重

例如提升估值层权重、降低情绪层权重：

```typescript
// 修改前
l3v: 0.08,  // 估值 8%
l6: 0.07,   // 情绪 7%

// 修改后
l3v: 0.12,  // 估值提升至 12%
l6: 0.03,   // 情绪降低至 3%
```

**步骤 3**：校验权重总和

修改后必须保证全部权重之和仍为 1.0，可用以下片段快速校验：

```typescript
// 临时校验片段（可在控制台或测试文件执行）
const weights = { lMinus1: 0.10, l0: 0.08, l1: 0.15, l2: 0.10, l3f: 0.10, l3v: 0.12, l4: 0.08, l5: 0.05, l6: 0.03, l7: 0.15, l8: 0.04 }
const sum = Object.values(weights).reduce((a, b) => a + b, 0)
console.log(`权重总和: ${sum}`)  // 期望 1.0
```

**步骤 4**：运行引擎单测验证

```bash
npm test -- v6-engine
```

重点确认 `aggregate` 相关用例全部通过，归一化逻辑未受权重调整影响。

### 1.4 权重调整质量检查清单

- [ ] 权重总和严格等于 1.0（浮点误差容忍至 1.0 ± 0.0001 以内）
- [ ] 单层权重调整幅度不超过 30%（避免评分分布剧烈漂移）
- [ ] 核心层（L1/L7）权重不低于默认值的 50%
- [ ] 调整后缺失场景（如 L0 缺失、L6 缺失）归一化结果仍在合理区间
- [ ] 调整理由已记录在评审记录中，且超过 4 人知悉
- [ ] 变更说明已同步写入本文档的 `change_log` 与代码注释

---

## 场景 2：调整行业估值基准

### 2.1 行业基准结构

V6 内置 8 大行业估值基准，用于 L3v 估值层的相对估值评分：

```typescript
export const INDUSTRY_BENCHMARKS: IndustryBenchmark[] = [
  { sector: '银行', keywords: ['银行', '农商', '城商', '股份制'], 
    peLow: 10, peHigh: 20, peglow: 0.5, pegHigh: 1.0, pbLow: 1.5, pbHigh: 3 },
  { sector: '科技', keywords: ['半导体', '软件', '计算机', '电子', '通信'], 
    peLow: 30, peHigh: 50, peglow: 1.0, pegHigh: 1.8, pbLow: 3, pbHigh: 5 },
  { sector: '消费', keywords: ['食品', '饮料', '家电', '零售', '纺织'], 
    peLow: 15, peHigh: 25, peglow: 0.5, pegHigh: 1.0, pbLow: 2, pbHigh: 4 },
  { sector: '医药', keywords: ['医药', '生物', '医疗', '中药', '器械', '疫苗'], 
    peLow: 20, peHigh: 35, peglow: 1.0, pegHigh: 1.5, pbLow: 3, pbHigh: 6 },
  { sector: '金融', keywords: ['证券', '保险', '信托', '期货'], 
    peLow: 5, peHigh: 10, peglow: 0, pegHigh: 0, pbLow: 0.8, pbHigh: 1.2 },
  { sector: '医药外包', keywords: ['药明', '康龙', 'CXO', '泰格', '凯莱英', '昭衍'], 
    peLow: 25, peHigh: 40, peglow: 0.8, pegHigh: 1.5, pbLow: 3, pbHigh: 5 },
  { sector: '高端制造', keywords: ['机械', '军工', '汽车', '新能源', '电力'], 
    peLow: 15, peHigh: 25, peglow: 0.5, pegHigh: 1.0, pbLow: 2, pbHigh: 4 },
  { sector: 'AI/TMT', keywords: ['AI', '人工智能', 'TMT', '传媒', '互联网', '游戏', '影视'], 
    peLow: 30, peHigh: 60, peglow: 1.0, pegHigh: 2.0, pbLow: 3, pbHigh: 6 },
]
```

### 2.2 新增行业基准

若现有 8 大行业无法覆盖目标股票所属行业，可新增基准条目：

```typescript
// 在 INDUSTRY_BENCHMARKS 数组末尾追加
{
  sector: '新材料',
  keywords: ['材料', '化工', '有色', '钢铁', '稀土'],
  peLow: 40, peHigh: 70,     // 高成长行业 PE 容忍区间
  peglow: 1.2, pegHigh: 2.5,
  pbLow: 3, pbHigh: 6,
}
```

**新增行业注意事项**：
1. `keywords` 必须覆盖该行业常见的板块名称与关键词变体
2. 新增条目不影响已有行业的匹配优先级
3. 匹配失败时回退默认 `peLow/peHigh` 区间，避免评分中断

### 2.3 L-1 行业分类口径

L-1 行业景气度依赖两套行业分类体系：
- **SKILL-C 行业分类**：覆盖申万一级 / 二级行业 / 概念板块 / 主题板块
- **SKILL-N 新闻分类**：覆盖政策 / 事件 / 舆情 / 研报 / 公告 / 快讯
- **分类映射表**：详见行业分类映射文档，景气度评分标准化至 0-1 区间

分类数据结构见 `IndustryScoreData` 类型定义，位于 `src/services/scoring/v6-engine/types.ts`

---

## 场景 3：调整评级阈值

### 3.1 默认阈值定义

评级将 0-5 的综合评分映射为 5 档投资评级：

```typescript
// v2.0 评级阈值（下移以匹配实际评分分布）
export const DEFAULT_THRESHOLDS: V6ScoreThresholdsConfig = {
  rating: {
    strongBuy: 3.5,   // ≥ 3.5 → strong_buy  (v1.0: 4.0)
    buy: 2.6,         // ≥ 2.6 且 < 3.5 → buy  (v1.0: 3.0)
    hold: 1.7,        // ≥ 1.7 且 < 2.6 → hold  (v1.0: 2.0)
    sell: 0.9,        // ≥ 0.9 且 < 1.7 → sell  (v1.0: 1.0)
  },                  // < 0.9 → strong_sell
  layerScore: { min: 0, max: 5 },    // 单层分数区间
  composite: { min: 0, max: 5 },     // 综合分数区间
}
```

### 3.2 阈值调整示例

例如收紧买入标准、提高评级区分度：

```typescript
// 调整后的评级阈值
rating: {
  strongBuy: 4.2,   // 强烈买入门槛提高至 4.2
  buy: 3.3,         // 买入门槛提高至 3.3
  hold: 2.2,        // 持有门槛提高至 2.2
  sell: 1.2,        // 卖出门槛提高至 1.2
}
```

### 3.3 评级与操作建议对照

| 评级 | v1.0 分数区间 | v2.0 分数区间 | 信号强度 | 典型操作 |
|------|---------|---------|------|---------|
| strong_buy | ≥ 4.0 | ≥ 3.5 | 强买入信号 | 建仓 / 加仓 |
| buy | 3.0 - 4.0 | 2.6 - 3.5 | 买入信号 | 建仓 / 小幅加仓 |
| hold | 2.0 - 3.0 | 1.7 - 2.6 | 中性持有 | 持仓观察 / 不加仓 |
| sell | 1.0 - 2.0 | 0.9 - 1.7 | 卖出信号 | 减仓 / 清仓 |
| strong_sell | < 1.0 | < 0.9 | 强卖出信号 | 清仓 / 回避 |

> **分数换算提示**：0-5 分制 × 20 = 0-100 百分制，例如 3.5 分 = 70 分。

---

## 场景 4：回测验证配置

### 4.1 为什么必须回测

任何权重或阈值调整都会改变评分分布，进而影响信号触发频率与组合表现，因此：
- 调整前必须保存基线评分快照，至少覆盖最近 3 个月数据
- 调整后必须对比新旧评分的分布差异与信号变化
- 未通过回测验证的配置禁止合入主干分支

### 4.2 使用 V6ScoreEngine 进行回测

V6 引擎配置支持 **Backtestable** 覆盖模式，可在不修改全局配置的前提下注入临时配置：

```typescript
import { V6ScoreEngine } from '@/services/scoring/v6-engine/engine'
import { DEFAULT_ENGINE_CONFIG, V6ScoreConfigOverride } from '@/services/scoring/v6-engine/config'

// 1. 构造覆盖配置
const customConfig: V6ScoreConfigOverride = {
  weights: {
    ...DEFAULT_ENGINE_CONFIG.weights,
    l3v: 0.12,  // 提升估值层权重
    l6: 0.03,   // 降低情绪层权重
  },
}

// 2. 实例化引擎
const engine = new V6ScoreEngine(customConfig)

// 3. 注册计算器（如需自定义计算器集）
// import { allCalculators } from '@/services/scoring/v6-engine/calculators'
// engine.registerCalculators(allCalculators)

// 4. 执行评分计算
const result = await engine.calculateAll({
  symbol: '600519.SH',
  stock: { symbol: '600519.SH', name: '贵州茅台', pe: 25, pb: 8, roe: 28 },
  financials: { revenue: 1200, netProfit: 500, grossMargin: 0.91 },
  quotes: { latestClose: 1680, return20d: 0.05, return60d: 0.12 },
})

console.log(`综合评分: ${result.score}`)
console.log(`评级: ${result.rating}`)
console.log(`跳过层: ${result.skippedLayers?.join(', ')}`)
```

### 4.3 回测验收标准

回测结果需逐项满足以下验收标准：

- [ ] **分布合理性**：新配置下评分分布无极端集中（如 strong_buy 占比 5-15%，strong_sell 占比 5-15%）
- [ ] **中位数稳定**：全市场评分中位数波动不超过 0.3 分，理想区间 2.5-3.0 附近
- [ ] **区分度**：Top 20% 与 Bottom 20% 股票的评分差值应显著拉开
- [ ] **稳定性**：同一股票在相邻交易日评分变化平缓（单日跳变 < 0.5 分为宜）
- [ ] **覆盖率**：`coverageRate` 指标不低于基线水平（建议 > 0.6）
- [ ] **单测通过**：`npm test -- v6-engine` 全部通过

### 4.4 交叉验证

V6 引擎内置交叉验证机制（对应路线 P2-5），用于检测因子间矛盾信号：

- 同一股票多个因子给出方向相反的信号
- 因子得分与最终评级出现显著背离
- 数据质量异常导致的分数失真
- 预期层与基本面层的系统性冲突

交叉验证结果读取方式：

```typescript
const result = await engine.calculateAll(input)
if (result.crossValidation && !result.crossValidation.passed) {
  console.log('交叉验证未通过，存在矛盾信号')
  result.crossValidation.issues.forEach(issue => {
    console.log(`[${issue.severity}] ${issue.title}: ${issue.description}`)
  })
}
```

---

## 场景 5：运行时动态覆盖配置

### 5.1 V6ScoreConfigOverride

无需修改源码即可在运行时注入自定义配置：

```typescript
const override: V6ScoreConfigOverride = {
  weights: { l1: 0.20, l7: 0.20 },  // 仅覆盖部分字段，其余沿用默认
  thresholds: { rating: { strongBuy: 4.2 } },
  offlineMode: false,
}

const engine = new V6ScoreEngine(override)
```

### 5.2 引擎实例热更新配置

```typescript
// 运行时更新权重
engine.updateConfig({
  weights: { l6: 0.05 },  // 局部更新情绪层权重
})

// 读取当前生效配置
const currentConfig = engine.getConfig()
console.log(currentConfig.weights)
```

---

## 常见问题

### Q1：修改配置后评分没有变化？

**排查步骤**：
1. 确认修改的是 `DEFAULT_WEIGHTS` 而非某个局部副本
2. 确认前端已重新构建（`npm run dev` 或 `npm run build`）
3. 确认目标股票数据完整，若该层被跳过则显示在 `skippedLayers` 中，权重变化不会生效
4. 确认浏览器缓存已清除（强制刷新 Ctrl+Shift+R）

### Q2：权重调整后历史评分数据是否需要重算？

**视使用场景而定**：
- 实时评分场景 → 无需重算，新评分自然采用新权重
- 历史回测场景 → 必须重算，否则 `rating` 口径不一致
- 对比分析场景 → 建议同时保留 `INDUSTRY_BENCHMARKS` 调整前后的两套结果

### Q3：评分结果出现异常高分/低分？

**排查步骤**：
1. 查看 `skippedLayers`，确认是否关键层被跳过导致归一化放大
2. 检查输入数据质量，异常值（如负 PE、缺失财报）会导致极端分数
3. 查看 `factorContributions`，定位贡献异常的因子层
4. 查看 `crossValidation`，确认是否存在矛盾信号未处理
5. 对比调整前后的基线快照，确认是否为配置调整引入的问题

### Q4：如何回滚到上一个稳定配置？

**回滚步骤**：
1. 确认最近一次通过回测验收的配置版本号
2. 通过 git branch 定位该版本对应的提交
3. 直接恢复该提交的 `config.ts`（或另存为 `config-value-investing.ts` 等策略副本）
4. 重新运行单测与回测确认回滚生效

---

## 相关文档

| 文档 | 路径 | 说明 |
|------|------|------|
| V6 评分契约 | `../../reference/scoring-contract.md` | V6 评分口径、数据结构与接口定义 |
| 数据采集契约 | `../../reference/data-collector-contract.md` | 采集层数据格式与通道定义 |
| 引擎配置文件 | `../../src/services/scoring/v6-engine/config.ts` | 权重/阈值/基准的唯一定义处 |
| 引擎核心实现 | `../../src/services/scoring/v6-engine/engine.ts` | V6ScoreEngine 主逻辑 |
| 引擎类型定义 | `../../src/services/scoring/v6-engine/types.ts` | 输入输出类型定义 |
| 评分流水线指南 | `./how-to-run-scoring-pipeline.md` | 采集+评分的完整运行流程 |
| ADR-008 V6 评分架构 | `../reference/adr-008-v6-scoring-architecture.md（已废弃）` | V6 架构设计决策记录 |

---

> **维护提示**：本文档描述的默认权重、阈值与行业基准以 `src/services/scoring/v6-engine/config.ts` 为准。任何配置调整完成后，必须同步更新本文档 `change_log` 并通知相关使用方，避免文档与代码口径漂移。
