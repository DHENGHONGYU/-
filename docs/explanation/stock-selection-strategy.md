---
title: stock-selection-strategy
code_version: "2.0.0-rc.1"
tier: important
version: v1.0.0
last_updated: 2026-06-27
change_log:
  - version: v1.0.0
    changes: "C 类版本闭环(2026-08-11)：补全 change_log 初始条目"
    date: 2026-06-27
---




# V9 选股策略总文档

> **Status**: Active
> **Version**: v1.0.0
> **Last Updated**: 2026-06-27
>
> 本文档是 V9 选股策略体系的唯一顶层入口，定义四分类策略体系、三梯队优先级、双策略评分增强机制，以及 20 进 13 筛选规则。
> 目标读者：策略开发者、交易员、架构评审者。

---

## 1. 策略体系概览

V9 选股策略体系由 **四分类选股（strategyEngine）** 与 **双策略评分增强（dualStrategyEngine）** 两个层次构成：

| 层次 | 引擎 | 职责 | 配置来源 |
|------|------|------|----------|
| 选股分类层 | `strategyEngine.ts` | 四分类选股，决定"选什么" | `strategyRules.ts` |
| 评分增强层 | `dualStrategyEngine.ts` | 双策略五维评分，决定"打多少分" | `dualStrategyRules.ts` |

两层次**并存，不互相替代**。选股分类层完成四分类后，评分增强层对候选标的进行独立双维度评分，为驾驶舱 Widget 与交易执行层提供更精细的决策依据。

---

## 2. 四分类策略定义

### 2.1 分类一览

| 分类 | 标识 | 优先级 | 核心逻辑 | 详细文档 |
|------|------|--------|----------|----------|
| 核心稀缺资源 | `core-scarce` | 第一梯队 | 匹配主题 + 综合分达标 | [core-scarce-strategy.md](design/core-scarce-strategy.md) |
| 热门赛道 | `hot-momentum` | 第二梯队 | 板块热门 + 动量达标 | [hot-momentum-strategy.md](design/hot-momentum-strategy.md) |
| 价值洼地 | `value-bargain` | 第二梯队 | 估值分高 + 综合分适中 | [value-bargain-strategy.md](design/value-bargain-strategy.md) |
| 观察仓 | `watchlist` | 第三梯队 | 暂不参与交易，持续跟踪 | [watchlist-strategy.md](design/watchlist-strategy.md) |

### 2.2 分类判定流程

```
输入标的列表
  │
  ├─ 优先级 1：core-scarce
  │   条件：匹配主题（themeRegistry） + 综合分 >= theme.minCompositeScore
  │   → 是：分类为 core-scarce
  │   → 否：继续
  │
  ├─ 优先级 2：hot-momentum
  │   条件：综合分 >= 3.0 + sector 属于热门 TOP5 + 动量 >= 5%
  │   → 是：分类为 hot-momentum
  │   → 否：继续
  │
  ├─ 优先级 3：value-bargain
  │   条件：综合分 >= 3.0 + 估值分 >= 4.0
  │   → 是：分类为 value-bargain
  │   → 否：继续
  │
  └─ 优先级 4：watchlist
      条件：综合分 < 2.8 或未匹配以上任何分类
      → 分类为 watchlist
```

---

## 3. 三梯队优先级

V9 策略体系采用三梯队优先级结构，决定标的在交易执行与驾驶舱展示中的优先级排序：

| 梯队 | 包含分类 | 级别 | 说明 |
|------|----------|------|------|
| **第一梯队** | `core-scarce` | 最高优先级 | 核心持仓，长期持有，主题驱动 |
| **第二梯队** | `hot-momentum`、`value-bargain` | 中等优先级 | 战术交易，各自独立评分 |
| **第三梯队** | `watchlist` | 最低优先级 | 暂不参与交易，持续跟踪 |

**梯队间流转规则**：

- 第一梯队标的若综合分跌破主题门槛，降级为第二梯队或第三梯队。
- 第二梯队标的若估值/动量恶化，降级为第三梯队（观察仓）。
- 第三梯队标的触发轮动信号或评分提升后，可升级为第二梯队。
- 跨梯队流转须经 `DataBridge.forward(UPDATE_STOCK)` 更新 `researchStatus`。

---

## 4. 20 进 13 筛选规则

对所有非 `watchlist` 分类的候选标的，执行两步筛选，最终输出不超过 13 只入选标的。

### 4.1 R2 低估值过滤

```
条件：估值分 < 2.5 且 综合分 < 4.0
→ 剔除，移入 watchlist
→ 综合分 >= 4.0 的标的即使估值分低也不剔除（豁免）
```

### 4.2 综合分排序取 Top13

```
合并 core-scarce + hot-momentum + value-bargain
  → 按综合分降序排列
  → 取前 13 名
  → 未进入前 13 名的候选移入 watchlist
```

---

## 5. 双策略评分增强

### 5.1 热门板块策略评分（HotSectorScore）

| 维度 | 权重 | 核心指标 |
|:---|:---|:---|
| 动量强度 | 35% | 板块强度 Score、涨跌幅排名、成交量放大、资金连续流入、相对强弱 RS |
| 情绪热度 | 25% | 舆情热度排名、散户情绪、龙虎榜机构买入、涨停板数量 |
| 技术突破 | 20% | 突破形态、MACD 信号、RSI 状态、均线系统 |
| 估值风险 | 15% | PE 相对水平、PB 历史分位、市值流动性、股息率 |
| 大盘环境 | 5% | 大盘趋势、系统性风险 |

### 5.2 价值洼地策略评分（ValuePitScore）

| 维度 | 权重 | 核心指标 |
|:---|:---|:---|
| 催化确定性 | 30% | 政策催化、周期拐点、技术突破、订单爆发 |
| 估值安全垫 | 25% | PE/PB 历史分位、股息率、PEG |
| 筹码结构 | 20% | 北向资金流向、基金持仓变化、股东户数趋势 |
| 轮动位置 | 15% | 板块成交量历史分位、资金流入强度、技术金叉 |
| 流动性 | 10% | 日均成交额、换手率、市值规模 |

### 5.3 轮动信号检测

对价值洼地评分处于 3.0-4.0 区间的候选，检测以下三条件：

| 条件 | 阈值 | 说明 |
|------|------|------|
| 成交量放大 | 近 5 日均量 / 近 20 日均量 >= 1.5 | 量能显著放大 |
| 资金净流入 | 连续 >= 2 日净流入 | 主力或北向资金持续流入 |
| 技术金叉 | 价格站上 MA20 幅度 >= 3% | 技术形态确认 |

- 三条件全部命中 → 生成 `buy_rotation` 交易信号
- 未命中 → 加入观察池候选，持续跟踪

---

## 6. 止盈止损差异化配置

| 配置项 | core-scarce | hot-momentum | value-bargain | watchlist |
|--------|-------------|--------------|---------------|-----------|
| 止损线 | 主题策略内部定义 | **-8%** 硬性止损 | **-15%** 分步止损 | 不适用 |
| 止盈线 | 主题策略内部定义 | **+15%** 卖 50% | **+20%** 卖 30% | 不适用 |
| 持有期 | 长期（6-12 月） | 短期（3-15 天） | 中长期（6-12 月） | 持续跟踪 |
| 建仓方式 | 主题组合等权分配 | 立即跟进 / 试探 | 分步建仓（5%→10%→15%） | 不建仓 |

---

## 7. 代码层映射

| 策略组件 | 文件路径 | 说明 |
|----------|----------|------|
| 四分类引擎 | `src/services/trading/strategyEngine.ts` | `runStrategy()` 入口 |
| 双策略编排引擎 | `src/services/trading/dualStrategyEngine.ts` | `runDualStrategy()` 入口 |
| 热门板块分析器 | `src/services/scoring/hotSectorAnalyzer.ts` | 五维评分（动量35%/情绪25%/技术20%/估值15%/大盘5%） |
| 价值洼地分析器 | `src/services/scoring/valuePitAnalyzer.ts` | 五维评分（催化30%/估值25%/筹码20%/轮动15%/流动性10%） |
| 轮动信号检测 | `src/services/scoring/rotationSignalDetector.ts` | 三条件检测 |
| 四分类阈值 | `src/config/strategyRules.ts` | 选股分类阈值 |
| 双策略阈值 | `src/config/dualStrategyRules.ts` | 评分与动作阈值 |
| 统一配置入口 | `src/config/strategyConfig.ts` | 聚合 re-export |
| 主题注册表 | `src/config/themeRegistry.ts` | 第四次工业革命主题配置 |
| 评分适配器 | `src/services/trading/scoringAdapter.ts` | 统一 V6/智能/行业评分 |
| 组合构建器 | `src/services/trading/portfolioBuilder.ts` | 主题持仓组合构建 |

---

## 8. 相关文档

- [核心稀缺资源策略](design/core-scarce-strategy.md)
- [热门赛道策略](design/hot-momentum-strategy.md)
- [价值洼地策略](design/value-bargain-strategy.md)
- [观察仓策略](design/watchlist-strategy.md)
- [架构文档](v9-strategy-architecture.md)
- [ADR-008: 第四次工业革命稀缺核心资源策略](../reference/2026-06-24-adopt-v6-core-resource-trading-strategy.md)
- [ADR-009: 双策略体系](2026-06-27-dual-strategy-system.md)
- [引擎规格](../05-engine-specs.md)
- [架构标准](../03-architecture-standards.md)