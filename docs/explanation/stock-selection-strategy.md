---
title: V9 选股策略总文�?
type: explanation
domain: backend
phase: planning
tier: standard
status: active
maintainer: V9 Architecture Team
summary: "本文档是 V9 选股策略体系的唯一顶层入口，定义四分类策略体系、三梯队优先级、双策略评分增强机制，以�?20 �?13 筛选规则�?>..."
tags: [backend, strategy, screening, documentation, plan]
version: v1.0.0
last_updated: 2026-07-17
code_version: 2.0.0
change_log:
  - version: v1.0.0
changes: Initial version established
date: 2026-07-17
---tion
domain: backend
phase: planning
tier: standard
status: active
maintainer: V9 Architecture Team
tags: [backend, strategy, screening, documentation, plan]
version: v1.0.0
last_updated: 2026-07-17
code_version: 2.0.0
---

# V9 选股策略总文�?
> **Status**: Active
> **Version**: v1.0.0
> **Last Updated**: 2026-06-27
>
> 本文档是 V9 选股策略体系的唯一顶层入口，定义四分类策略体系、三梯队优先级、双策略评分增强机制，以�?20 �?13 筛选规则�?> 目标读者：策略开发者、交易员、架构评审者�?
---

## 1. 策略体系概览

V9 选股策略体系�?**四分类选股（strategyEngine�?* �?**双策略评分增强（dualStrategyEngine�?* 两个层次构成�?
| 层次 | 引擎 | 职责 | 配置来源 |
|------|------|------|----------|
| 选股分类�?| `strategyEngine.ts` | 四分类选股，决�?选什�? | `strategyRules.ts` |
| 评分增强�?| `dualStrategyEngine.ts` | 双策略五维评分，决定"打多少分" | `dualStrategyRules.ts` |

两层�?*并存，不互相替代**。选股分类层完成四分类后，评分增强层对候选标的进行独立双维度评分，为驾驶�?Widget 与交易执行层提供更精细的决策依据�?
---

## 2. 四分类策略定�?
### 2.1 分类一�?
| 分类 | 标识 | 优先�?| 核心逻辑 | 详细文档 |
|------|------|--------|----------|----------|
| 核心稀缺资�?| `core-scarce` | 第一梯队 | 匹配主题 + 综合分达�?| [core-scarce-strategy.md](design/core-scarce-strategy.md) |
| 热门赛道 | `hot-momentum` | 第二梯队 | 板块热门 + 动量达标 | [hot-momentum-strategy.md](design/hot-momentum-strategy.md) |
| 价值洼�?| `value-bargain` | 第二梯队 | 估值分�?+ 综合分适中 | [value-bargain-strategy.md](design/value-bargain-strategy.md) |
| 观察�?| `watchlist` | 第三梯队 | 暂不参与交易，持续跟�?| [watchlist-strategy.md](design/watchlist-strategy.md) |

### 2.2 分类判定流程

```
输入标的列表
  �?  ├─ 优先�?1：core-scarce
  �?  条件：匹配主题（themeRegistry�?+ 综合�?>= theme.minCompositeScore
  �?  �?是：分类�?core-scarce
  �?  �?否：继续
  �?  ├─ 优先�?2：hot-momentum
  �?  条件：综合分 >= 3.0 + sector 属于热门 TOP5 + 动量 >= 5%
  �?  �?是：分类�?hot-momentum
  �?  �?否：继续
  �?  ├─ 优先�?3：value-bargain
  �?  条件：综合分 >= 3.0 + 估值分 >= 4.0
  �?  �?是：分类�?value-bargain
  �?  �?否：继续
  �?  └─ 优先�?4：watchlist
      条件：综合分 < 2.8 或未匹配以上任何分类
      �?分类�?watchlist
```

---

## 3. 三梯队优先级

V9 策略体系采用三梯队优先级结构，决定标的在交易执行与驾驶舱展示中的优先级排序：

| 梯队 | 包含分类 | 级别 | 说明 |
|------|----------|------|------|
| **第一梯队** | `core-scarce` | 最高优先级 | 核心持仓，长期持有，主题驱动 |
| **第二梯队** | `hot-momentum`、`value-bargain` | 中等优先�?| 战术交易，各自独立评�?|
| **第三梯队** | `watchlist` | 最低优先级 | 暂不参与交易，持续跟�?|

**梯队间流转规�?*�?
- 第一梯队标的若综合分跌破主题门槛，降级为第二梯队或第三梯队�?- 第二梯队标的若估�?动量恶化，降级为第三梯队（观察仓）�?- 第三梯队标的触发轮动信号或评分提升后，可升级为第二梯队�?- 跨梯队流转须�?`DataBridge.forward(UPDATE_STOCK)` 更新 `researchStatus`�?
---

## 4. 20 �?13 筛选规�?
对所有非 `watchlist` 分类的候选标的，执行两步筛选，最终输出不超过 13 只入选标的�?
### 4.1 R2 低估值过�?
```
条件：估值分 < 2.5 �?综合�?< 4.0
�?剔除，移�?watchlist
�?综合�?>= 4.0 的标的即使估值分低也不剔除（豁免�?```

### 4.2 综合分排序取 Top13

```
合并 core-scarce + hot-momentum + value-bargain
  �?按综合分降序排列
  �?取前 13 �?  �?未进入前 13 名的候选移�?watchlist
```

---

## 5. 双策略评分增�?
### 5.1 热门板块策略评分（HotSectorScore�?
| 维度 | 权重 | 核心指标 |
|:---|:---|:---|
| 动量强度 | 35% | 板块强度 Score、涨跌幅排名、成交量放大、资金连续流入、相对强�?RS |
| 情绪热度 | 25% | 舆情热度排名、散户情绪、龙虎榜机构买入、涨停板数量 |
| 技术突�?| 20% | 突破形态、MACD 信号、RSI 状态、均线系�?|
| 估值风�?| 15% | PE 相对水平、PB 历史分位、市值流动性、股息率 |
| 大盘环境 | 5% | 大盘趋势、系统性风�?|

### 5.2 价值洼地策略评分（ValuePitScore�?
| 维度 | 权重 | 核心指标 |
|:---|:---|:---|
| 催化确定�?| 30% | 政策催化、周期拐点、技术突破、订单爆�?|
| 估值安全垫 | 25% | PE/PB 历史分位、股息率、PEG |
| 筹码结构 | 20% | 北向资金流向、基金持仓变化、股东户数趋�?|
| 轮动位置 | 15% | 板块成交量历史分位、资金流入强度、技术金�?|
| 流动�?| 10% | 日均成交额、换手率、市值规�?|

### 5.3 轮动信号检�?
对价值洼地评分处�?3.0-4.0 区间的候选，检测以下三条件�?
| 条件 | 阈�?| 说明 |
|------|------|------|
| 成交量放�?| �?5 日均�?/ �?20 日均�?>= 1.5 | 量能显著放大 |
| 资金净流入 | 连续 >= 2 日净流入 | 主力或北向资金持续流�?|
| 技术金�?| 价格站上 MA20 幅度 >= 3% | 技术形态确�?|

- 三条件全部命�?�?生成 `buy_rotation` 交易信号
- 未命�?�?加入观察池候选，持续跟踪

---

## 6. 止盈止损差异化配�?
| 配置�?| core-scarce | hot-momentum | value-bargain | watchlist |
|--------|-------------|--------------|---------------|-----------|
| 止损�?| 主题策略内部定义 | **-8%** 硬性止�?| **-15%** 分步止损 | 不适用 |
| 止盈�?| 主题策略内部定义 | **+15%** �?50% | **+20%** �?30% | 不适用 |
| 持有�?| 长期�?-12 月） | 短期�?-15 天） | 中长期（6-12 月） | 持续跟踪 |
| 建仓方式 | 主题组合等权分配 | 立即跟进 / 试探 | 分步建仓�?%�?0%�?5%�?| 不建�?|

---

## 7. 代码层映�?
| 策略组件 | 文件路径 | 说明 |
|----------|----------|------|
| 四分类引�?| `src/services/trading/strategyEngine.ts` | `runStrategy()` 入口 |
| 双策略编排引�?| `src/services/trading/dualStrategyEngine.ts` | `runDualStrategy()` 入口 |
| 热门板块分析�?| `src/services/scoring/hotSectorAnalyzer.ts` | 五维评分（动�?5%/情绪25%/技�?0%/估�?5%/大盘5%�?|
| 价值洼地分析器 | `src/services/scoring/valuePitAnalyzer.ts` | 五维评分（催�?0%/估�?5%/筹码20%/轮动15%/流动�?0%�?|
| 轮动信号检�?| `src/services/scoring/rotationSignalDetector.ts` | 三条件检�?|
| 四分类阈�?| `src/config/strategyRules.ts` | 选股分类阈�?|
| 双策略阈�?| `src/config/dualStrategyRules.ts` | 评分与动作阈�?|
| 统一配置入口 | `src/config/strategyConfig.ts` | 聚合 re-export |
| 主题注册�?| `src/config/themeRegistry.ts` | 第四次工业革命主题配�?|
| 评分适配�?| `src/services/trading/scoringAdapter.ts` | 统一 V6/智能/行业评分 |
| 组合构建�?| `src/services/trading/portfolioBuilder.ts` | 主题持仓组合构建 |

---

## 8. 相关文档

- [核心稀缺资源策略](design/core-scarce-strategy.md)
- [热门赛道策略](design/hot-momentum-strategy.md)
- [价值洼地策略](design/value-bargain-strategy.md)
- [观察仓策略](design/watchlist-strategy.md)
- [架构文档](v9-strategy-architecture.md)
- [ADR-008: 第四次工业革命稀缺核心资源策略](../reference/2026-06-24-adopt-v6-core-resource-trading-strategy.md)
- [ADR-009: 双策略体系](2026-06-27-dual-strategy-system.md)
- [引擎规格](../reference/05-engine-specs.md)
- [架构标准](../reference/03-architecture-standards.md)