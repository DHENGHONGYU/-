---
title: 价值洼地策略（value-bargain�?
type: explanation
domain: backend
phase: design
tier: standard
status: active
maintainer: V9 Architecture Team
summary: "价值洼地策略（value-bargain�? detailed explanation"
tags: [backend, strategy, design, plan]
version: v1.0.0
last_updated: 2026-07-17
code_version: 2.0.0
doc_id: V9-DOC-BACK-035
related_docs: [V9-DOC-BACK-028, V9-DOC-BACK-030, V9-DOC-BACK-034, V9-DOC-BACK-036, V9-DOC-ARCH-026, V9-DOC-BACK-001]
referenced_by: [V9-DOC-PROJ-174, V9-DOC-META-000, V9-DOC-ARCH-026, V9-DOC-PROJ-331, V9-DOC-PROJ-176, V9-DOC-ARCH-030, V9-DOC-PROJ-182, V9-DOC-BACK-040, V9-DOC-BACK-034, V9-DOC-BACK-028, V9-DOC-PROJ-149, V9-DOC-BACK-030]
change_log:
  - version: v1.0.0
changes: Initial version established
date: 2026-07-17
---tion
domain: backend
phase: design
tier: standard
status: active
maintainer: V9 Architecture Team
tags: [backend, strategy, design, plan]
version: v1.0.0
last_updated: 2026-07-17
code_version: 2.0.0
---

# 价值洼地策略（value-bargain�?
> **Status**: Active
> **Version**: v1.0.0
> **Last Updated**: 2026-06-27
>
> 本文档定�?V9 的价值洼地策略（value-bargain），属于四分类体系中的第二梯队。该策略以估值安全垫为核心，筛选低估值、有催化剂、筹码集中的标的，等待板块轮动信号触发后建仓，追求中长期价值回归收益�?> 目标读者：策略开发者、交易员、架构评审者�?
---

## 1. 策略定义

价值洼地策略（value-bargain）是 V9 四分类选股体系中优先级第三的分类（�?hot-momentum 并列第二梯队）。该策略的核心逻辑�?**"等板块开始动了再�?**，筛选估值处于低位、具备催化潜力、筹码结构良好的标的，配套轮动信号检测引擎决定建仓时机�?
### 核心理念

- **价值等�?*：标的基本面良好但市场尚未充分定价，等待板块轮动信号触发�?- **分步建仓**：不一次性满仓，采用 5% �?10% �?15% 分步建仓策略�?- **宽止�?*�?15% 止损，给予标的更多波动容忍空间�?- **逐步止盈**�?20% �?30%，逐步退出而非一次性清仓�?- **中长期持�?*：持有期 6-12 个月，与价值回归周期匹配�?
---

## 2. 触发条件与阈�?
### 2.1 分类判定条件

```
value-bargain 判定条件（全部满足）�?  1. 综合�?>= valueBargainCompositeMin�?.0�?  2. 估值分 >= valueBargainValuationMin�?.0�?```

### 2.2 四分类阈�?
| 阈�?| 默认�?| 配置位置 | 说明 |
|------|--------|----------|------|
| valueBargainCompositeMin | 3.0 | `strategyRules.ts` | 价值洼地最低综合分 |
| valueBargainValuationMin | 4.0 | `strategyRules.ts` | 价值洼地最低估值分 |

### 2.3 双策略评分阈�?
| 阈�?| 默认�?| 配置位置 | 说明 |
|------|--------|----------|------|
| valuePitV6Min | 2.8 | `dualStrategyRules.ts` | 进入洼地五维评分�?V6 下限 |
| valuePitV6Max | 3.5 | `dualStrategyRules.ts` | 进入洼地五维评分�?V6 上限 |
| valuePitImmediateThreshold | 4.0 | `dualStrategyRules.ts` | ValuePitScore >= 4.0 �?立即建仓 |
| valuePitProbeThreshold | 3.5 | `dualStrategyRules.ts` | ValuePitScore 3.5-4.0 �?试探性建�?|
| valuePitWaitThreshold | 3.0 | `dualStrategyRules.ts` | ValuePitScore 3.0-3.5 �?等待轮动信号 |

### 2.4 动作规则

| ValuePitScore | 动作 | 仓位 |
|---------------|------|------|
| > 4.0 | **立即建仓** | 分步 5%�?0%�?5% |
| 3.5 - 4.0 | **试探性建�?* | 2%-3% |
| 3.0 - 3.5 | **等待轮动信号** | 不建仓，检测轮�?|
| < 3.0 | 不建�?| 0% |

---

## 3. 三梯队位�?
价值洼地策略属�?**第二梯队（中等优先级�?*，与热门赛道策略并列�?
```
第一梯队：core-scarce
第二梯队：hot-momentum + value-bargain  �?本策�?第三梯队：watchlist
```

### 梯队关系

- value-bargain �?core-scarce �?hot-momentum 判定之后执行�?- value-bargain �?hot-momentum 并列第二梯队，但 value-bargain 判定优先级低�?hot-momentum�?- 若标的估值恶化或催化剂消失，可降级为 watchlist�?
---

## 4. 与双策略评分的关�?
价值洼地策略在四分类选股层完成分类后�?*可进一步接受双策略评分增强**�?
### 4.1 ValuePitScore 五维评分

| 维度 | 权重 | 核心指标 | 评分逻辑 |
|:---|:---|:---|:---|
| **催化确定�?* | 30% | 政策催化、周期拐点、技术突破、订单爆�?| 催化剂越确定分越�?|
| **估值安全垫** | 25% | PE/PB 历史分位、股息率、PEG | 估值越低分越高 |
| **筹码结构** | 20% | 北向资金流向、基金持仓变化、股东户数趋�?| 机构吸筹 = 高分 |
| **轮动位置** | 15% | 板块成交量历史分位、资金流入强度、技术金�?| `rotationScoreService.ts` 五因子模�?|
| **流动�?* | 10% | 日均成交额、换手率、市值规�?| �?20 日成交额/市值、换手率 |

### 4.2 轮动信号检�?
�?ValuePitScore 处于 3.0-4.0 区间的候选，检测以下三条件�?
| 条件 | 阈�?| 配置位置 | 说明 |
|------|------|----------|------|
| 成交量放�?| �?5 日均�?/ �?20 日均�?>= 1.5 | `dualStrategyRules.ts` (`rotationVolumeSurgeRatio`) | 量能显著放大 |
| 资金净流入 | 连续 >= 2 日净流入 | `dualStrategyRules.ts` (`rotationFundFlowConsecutiveDays`) | 主力或北向资金持续流�?|
| 技术金�?| 价格站上 MA20 幅度 >= 3% | `dualStrategyRules.ts` (`rotationPriceToMA20Threshold`) | 技术形态确�?|

### 4.3 评分与分类的关系

```
四分类结果：value-bargain
  �?双策略评分：ValuePitAnalyzer 计算 ValuePitScore
  �?轮动检测：RotationSignalDetector 检测三条件
  �?输出：ValuePitScore + TradingSignal（buy_rotation�?  �?信号触发 �?建仓
  �?未触�?�?加入观察池候�?  �?消费：ValuePitWidget 驾驶舱展�?```

---

## 5. 止盈止损差异化配�?
| 配置�?| �?| 配置位置 | 说明 |
|--------|-----|----------|------|
| 止损�?| **-15%** | `dualStrategyRules.ts` (`valuePitStopLossPct`) | 宽止损，给予波动空间 |
| 止盈�?| **+20%** | `dualStrategyRules.ts` (`valuePitTakeProfitPct`) | 触发后卖�?30% 仓位 |
| 止盈卖出比例 | **30%** | `dualStrategyRules.ts` (`valuePitTakeProfitSellRatio`) | 逐步退出，非一次性清�?|
| 持有�?| 6-12 个月 | -- | 中长期价值回�?|
| 建仓方式 | 分步建仓 | -- | 5% �?10% �?15% |
| 补仓策略 | 正金字塔加仓 | -- | 浮盈 > 5% 时加�?|

### 分步建仓规则

```
初始建仓：底�?5%
  �?浮盈 > 5% AND ValuePitScore 维持 >= 4.0 �?加仓�?10%
  �?浮盈 > 10% AND 板块轮动确认 �?加仓�?15%
  �?单票总仓�?<= 25%
```

---

## 6. 策略执行流程

```
1. 输入标的列表（非 core-scarce、非 hot-momentum�?2. 获取标的综合评分、估值分
3. 判定：综合分 >= 3.0 AND 估值分 >= 4.0
   �?是：分类�?value-bargain
   �?否：进入 watchlist 判定
4. 双策略评分：ValuePitAnalyzer 计算 ValuePitScore
5. 动作判定�?   - ValuePitScore > 4.0 �?立即建仓（分�?5%�?0%�?5%�?   - 3.5 <= ValuePitScore <= 4.0 �?试探�?-3%�?   - 3.0 <= ValuePitScore < 3.5 �?等待轮动信号
6. 轮动信号检测：
   - 成交量放�?AND 资金净流入 AND 技术金�?�?生成 buy_rotation 信号
   - 未触�?�?加入观察池候�?7. 驾驶�?ValuePitWidget 展示评分与建�?```

---

## 7. 代码层映�?
| 组件 | 文件路径 | 说明 |
|------|----------|------|
| 四分类引�?| `src/services/trading/strategyEngine.ts` | `classify()` 中优先级 3 判定 |
| 价值洼地分析器 | `src/services/scoring/valuePitAnalyzer.ts` | 五维评分（催�?0%/估�?5%/筹码20%/轮动15%/流动�?0%�?|
| 轮动信号检�?| `src/services/scoring/rotationSignalDetector.ts` | 三条件检�?|
| 双策略编排引�?| `src/services/trading/dualStrategyEngine.ts` | 编排分析器并输出结果 |
| 四分类阈�?| `src/config/strategyRules.ts` | 估值分/综合分阈�?|
| 双策略阈�?| `src/config/dualStrategyRules.ts` | 评分/动作/止盈止损/轮动阈�?|
| 轮动评分服务 | `src/services/analysis/rotationScoreService.ts` | 五因子十六指标板块轮动评�?|
| 价值洼�?Widget | `src/cockpit/widgets/ValuePitWidget.tsx` | 驾驶舱展�?|

---

## 8. 风险控制

| 风险�?| 应对措施 |
|--------|----------|
| 估值陷阱（低估值持续低迷） | 催化确定性占 30% 权重，无催化剂不建仓 |
| 轮动信号误判 | 三条件同时满足才触发，降低单一指标噪声 |
| 提前进去被套 | -15% 宽止�?+ 分步建仓，控制单次亏�?|
| 板块轮动迟迟不来 | 未触发轮动信�?�?加入观察池，不盲目建�?|
| 流动性不�?| 流动性因子占 10%，低流动性标的评分降�?|

---

## 9. 相关文档

- [选股策略总文档](./stock-selection-strategy.md)
- [热门赛道策略](./hot-momentum-strategy.md)
- [观察仓策略](./watchlist-strategy.md)
- [ADR-009: 双策略体系](2026-06-27-dual-strategy-system.md)
- [架构文档](v9-strategy-architecture.md)
- [引擎规格](../../reference/05-engine-specs.md)