---
title: 价值洼地策略（value-bargain）
version: v1.0.0
last_updated: 2026-06-27
maintainer: V9 Architecture Team
status: active
---

# 价值洼地策略（value-bargain）

> **Status**: Active
> **Version**: v1.0.0
> **Last Updated**: 2026-06-27
>
> 本文档定义 V9 的价值洼地策略（value-bargain），属于四分类体系中的第二梯队。该策略以估值安全垫为核心，筛选低估值、有催化剂、筹码集中的标的，等待板块轮动信号触发后建仓，追求中长期价值回归收益。
> 目标读者：策略开发者、交易员、架构评审者。

---

## 1. 策略定义

价值洼地策略（value-bargain）是 V9 四分类选股体系中优先级第三的分类（与 hot-momentum 并列第二梯队）。该策略的核心逻辑是 **"等板块开始动了再进"**，筛选估值处于低位、具备催化潜力、筹码结构良好的标的，配套轮动信号检测引擎决定建仓时机。

### 核心理念

- **价值等待**：标的基本面良好但市场尚未充分定价，等待板块轮动信号触发。
- **分步建仓**：不一次性满仓，采用 5% → 10% → 15% 分步建仓策略。
- **宽止损**：-15% 止损，给予标的更多波动容忍空间。
- **逐步止盈**：+20% 卖 30%，逐步退出而非一次性清仓。
- **中长期持有**：持有期 6-12 个月，与价值回归周期匹配。

---

## 2. 触发条件与阈值

### 2.1 分类判定条件

```
value-bargain 判定条件（全部满足）：
  1. 综合分 >= valueBargainCompositeMin（3.0）
  2. 估值分 >= valueBargainValuationMin（4.0）
```

### 2.2 四分类阈值

| 阈值 | 默认值 | 配置位置 | 说明 |
|------|--------|----------|------|
| valueBargainCompositeMin | 3.0 | `strategyRules.ts` | 价值洼地最低综合分 |
| valueBargainValuationMin | 4.0 | `strategyRules.ts` | 价值洼地最低估值分 |

### 2.3 双策略评分阈值

| 阈值 | 默认值 | 配置位置 | 说明 |
|------|--------|----------|------|
| valuePitV6Min | 2.8 | `dualStrategyRules.ts` | 进入洼地五维评分的 V6 下限 |
| valuePitV6Max | 3.5 | `dualStrategyRules.ts` | 进入洼地五维评分的 V6 上限 |
| valuePitImmediateThreshold | 4.0 | `dualStrategyRules.ts` | ValuePitScore >= 4.0 → 立即建仓 |
| valuePitProbeThreshold | 3.5 | `dualStrategyRules.ts` | ValuePitScore 3.5-4.0 → 试探性建仓 |
| valuePitWaitThreshold | 3.0 | `dualStrategyRules.ts` | ValuePitScore 3.0-3.5 → 等待轮动信号 |

### 2.4 动作规则

| ValuePitScore | 动作 | 仓位 |
|---------------|------|------|
| > 4.0 | **立即建仓** | 分步 5%→10%→15% |
| 3.5 - 4.0 | **试探性建仓** | 2%-3% |
| 3.0 - 3.5 | **等待轮动信号** | 不建仓，检测轮动 |
| < 3.0 | 不建仓 | 0% |

---

## 3. 三梯队位置

价值洼地策略属于 **第二梯队（中等优先级）**，与热门赛道策略并列。

```
第一梯队：core-scarce
第二梯队：hot-momentum + value-bargain  ← 本策略
第三梯队：watchlist
```

### 梯队关系

- value-bargain 在 core-scarce 和 hot-momentum 判定之后执行。
- value-bargain 与 hot-momentum 并列第二梯队，但 value-bargain 判定优先级低于 hot-momentum。
- 若标的估值恶化或催化剂消失，可降级为 watchlist。

---

## 4. 与双策略评分的关系

价值洼地策略在四分类选股层完成分类后，**可进一步接受双策略评分增强**：

### 4.1 ValuePitScore 五维评分

| 维度 | 权重 | 核心指标 | 评分逻辑 |
|:---|:---|:---|:---|
| **催化确定性** | 30% | 政策催化、周期拐点、技术突破、订单爆发 | 催化剂越确定分越高 |
| **估值安全垫** | 25% | PE/PB 历史分位、股息率、PEG | 估值越低分越高 |
| **筹码结构** | 20% | 北向资金流向、基金持仓变化、股东户数趋势 | 机构吸筹 = 高分 |
| **轮动位置** | 15% | 板块成交量历史分位、资金流入强度、技术金叉 | `rotationScoreService.ts` 五因子模型 |
| **流动性** | 10% | 日均成交额、换手率、市值规模 | 近 20 日成交额/市值、换手率 |

### 4.2 轮动信号检测

对 ValuePitScore 处于 3.0-4.0 区间的候选，检测以下三条件：

| 条件 | 阈值 | 配置位置 | 说明 |
|------|------|----------|------|
| 成交量放大 | 近 5 日均量 / 近 20 日均量 >= 1.5 | `dualStrategyRules.ts` (`rotationVolumeSurgeRatio`) | 量能显著放大 |
| 资金净流入 | 连续 >= 2 日净流入 | `dualStrategyRules.ts` (`rotationFundFlowConsecutiveDays`) | 主力或北向资金持续流入 |
| 技术金叉 | 价格站上 MA20 幅度 >= 3% | `dualStrategyRules.ts` (`rotationPriceToMA20Threshold`) | 技术形态确认 |

### 4.3 评分与分类的关系

```
四分类结果：value-bargain
  → 双策略评分：ValuePitAnalyzer 计算 ValuePitScore
  → 轮动检测：RotationSignalDetector 检测三条件
  → 输出：ValuePitScore + TradingSignal（buy_rotation）
  → 信号触发 → 建仓
  → 未触发 → 加入观察池候选
  → 消费：ValuePitWidget 驾驶舱展示
```

---

## 5. 止盈止损差异化配置

| 配置项 | 值 | 配置位置 | 说明 |
|--------|-----|----------|------|
| 止损线 | **-15%** | `dualStrategyRules.ts` (`valuePitStopLossPct`) | 宽止损，给予波动空间 |
| 止盈线 | **+20%** | `dualStrategyRules.ts` (`valuePitTakeProfitPct`) | 触发后卖出 30% 仓位 |
| 止盈卖出比例 | **30%** | `dualStrategyRules.ts` (`valuePitTakeProfitSellRatio`) | 逐步退出，非一次性清仓 |
| 持有期 | 6-12 个月 | -- | 中长期价值回归 |
| 建仓方式 | 分步建仓 | -- | 5% → 10% → 15% |
| 补仓策略 | 正金字塔加仓 | -- | 浮盈 > 5% 时加仓 |

### 分步建仓规则

```
初始建仓：底仓 5%
  → 浮盈 > 5% AND ValuePitScore 维持 >= 4.0 → 加仓至 10%
  → 浮盈 > 10% AND 板块轮动确认 → 加仓至 15%
  → 单票总仓位 <= 25%
```

---

## 6. 策略执行流程

```
1. 输入标的列表（非 core-scarce、非 hot-momentum）
2. 获取标的综合评分、估值分
3. 判定：综合分 >= 3.0 AND 估值分 >= 4.0
   → 是：分类为 value-bargain
   → 否：进入 watchlist 判定
4. 双策略评分：ValuePitAnalyzer 计算 ValuePitScore
5. 动作判定：
   - ValuePitScore > 4.0 → 立即建仓（分步 5%→10%→15%）
   - 3.5 <= ValuePitScore <= 4.0 → 试探（2-3%）
   - 3.0 <= ValuePitScore < 3.5 → 等待轮动信号
6. 轮动信号检测：
   - 成交量放大 AND 资金净流入 AND 技术金叉 → 生成 buy_rotation 信号
   - 未触发 → 加入观察池候选
7. 驾驶舱 ValuePitWidget 展示评分与建议
```

---

## 7. 代码层映射

| 组件 | 文件路径 | 说明 |
|------|----------|------|
| 四分类引擎 | `src/services/trading/strategyEngine.ts` | `classify()` 中优先级 3 判定 |
| 价值洼地分析器 | `src/services/scoring/valuePitAnalyzer.ts` | 五维评分（催化30%/估值25%/筹码20%/轮动15%/流动性10%） |
| 轮动信号检测 | `src/services/scoring/rotationSignalDetector.ts` | 三条件检测 |
| 双策略编排引擎 | `src/services/trading/dualStrategyEngine.ts` | 编排分析器并输出结果 |
| 四分类阈值 | `src/config/strategyRules.ts` | 估值分/综合分阈值 |
| 双策略阈值 | `src/config/dualStrategyRules.ts` | 评分/动作/止盈止损/轮动阈值 |
| 轮动评分服务 | `src/services/analysis/rotationScoreService.ts` | 五因子十六指标板块轮动评分 |
| 价值洼地 Widget | `src/cockpit/widgets/ValuePitWidget.tsx` | 驾驶舱展示 |

---

## 8. 风险控制

| 风险项 | 应对措施 |
|--------|----------|
| 估值陷阱（低估值持续低迷） | 催化确定性占 30% 权重，无催化剂不建仓 |
| 轮动信号误判 | 三条件同时满足才触发，降低单一指标噪声 |
| 提前进去被套 | -15% 宽止损 + 分步建仓，控制单次亏损 |
| 板块轮动迟迟不来 | 未触发轮动信号 → 加入观察池，不盲目建仓 |
| 流动性不足 | 流动性因子占 10%，低流动性标的评分降低 |

---

## 9. 相关文档

- [选股策略总文档](./stock-selection-strategy.md)
- [热门赛道策略](./hot-momentum-strategy.md)
- [观察仓策略](./watchlist-strategy.md)
- [ADR-009: 双策略体系](../implementation/adr/2026-06-27-dual-strategy-system.md)
- [架构文档](../architecture/v9-strategy-architecture.md)
- [引擎规格](../05-engine-specs.md)