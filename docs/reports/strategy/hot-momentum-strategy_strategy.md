---
title: 热门赛道策略（hot-momentum）
version: v1.0.0
last_updated: 2026-06-27
maintainer: V9 Architecture Team
status: active

tier: T2
type: reference
domain: project
doc_id: V9-DOC-AUTO-489135
code_version: 2.0.0

summary: 热门赛道策略（hot-momentum）是 V9 四分类选股体系中优先级第二的分类（与 value-bargain 并列第二梯队）。该策略的核心逻辑是 "板块已在动，跟着趋势走"，识别处于热门板块且动量指标强劲的标的，执行短期趋势交易。
phase: maintenance
---

# 热门赛道策略（hot-momentum）

> **Status**: Active
> **Version**: v1.0.0
> **Last Updated**: 2026-06-27
>
> 本文档定义 V9 的热门赛道策略（hot-momentum），属于四分类体系中的第二梯队。该策略以板块动量为核心，筛选身处热门板块且动量指标达标的标的，追求短期趋势收益。
> 目标读者：策略开发者、交易员、架构评审者。

---

## 1. 策略定义

热门赛道策略（hot-momentum）是 V9 四分类选股体系中优先级第二的分类（与 value-bargain 并列第二梯队）。该策略的核心逻辑是 **"板块已在动，跟着趋势走"**，识别处于热门板块且动量指标强劲的标的，执行短期趋势交易。

### 核心理念

- **趋势跟随**：板块已经在动，顺势而为，不逆势操作。
- **快进快出**：持有期短（3-15 天），止损紧（-8%），止盈快（+15% 卖 50%）。
- **动量驱动**：以板块动量（priceToMA20）和热门行业排名为核心筛选条件。
- **高风险高回报**：高估值、高涨幅、高波动，需要严格止损。

---

## 2. 触发条件与阈值

### 2.1 分类判定条件

```
hot-momentum 判定条件（全部满足）：
  1. 综合分 >= compositeMin（3.0）
  2. sector 非空，且属于热门 TOP5 板块
  3. 动量（priceToMA20）>= hotMomentumMinMomentum（0.05，即 5%）
```

### 2.2 四分类阈值

| 阈值 | 默认值 | 配置位置 | 说明 |
|------|--------|----------|------|
| compositeMin | 3.0 | `strategyRules.ts` | 综合分最低门槛 |
| hotMomentumTopSectors | 5 | `strategyRules.ts` | 热门板块 TOP N 数量 |
| hotMomentumMinMomentum | 0.05 | `strategyRules.ts` | 最小动量（priceToMA20，5%） |

### 2.3 双策略评分阈值

| 阈值 | 默认值 | 配置位置 | 说明 |
|------|--------|----------|------|
| hotSectorV6Min | 3.5 | `dualStrategyRules.ts` | 进入热门五维评分的 V6 最低分 |
| hotSectorImmediateThreshold | 4.0 | `dualStrategyRules.ts` | HotSectorScore >= 4.0 → 立即跟进 |
| hotSectorProbeThreshold | 3.5 | `dualStrategyRules.ts` | HotSectorScore 3.5-4.0 → 试探性跟进 |

### 2.4 动作规则

| HotSectorScore | 动作 | 仓位 |
|----------------|------|------|
| > 4.0 | **立即跟进** | 5%-8% |
| 3.5 - 4.0 | **试探性跟进** | 2%-3% |
| < 3.5 | 不追 | 0% |

---

## 3. 三梯队位置

热门赛道策略属于 **第二梯队（中等优先级）**，与价值洼地策略并列。

```
第一梯队：core-scarce
第二梯队：hot-momentum + value-bargain  ← 本策略
第三梯队：watchlist
```

### 梯队关系

- hot-momentum 在 core-scarce 判定之后执行，未被 core-scarce 匹配的标的才进入热门赛道判定。
- hot-momentum 与 value-bargain 并列第二梯队，但 hot-momentum 判定优先级高于 value-bargain。
- 若标的动量衰减或板块热度下降，可降级为 watchlist。

---

## 4. 与双策略评分的关系

热门赛道策略在四分类选股层完成分类后，**可进一步接受双策略评分增强**：

### 4.1 HotSectorScore 五维评分

| 维度 | 权重 | 核心指标 | 数据来源 |
|:---|:---|:---|:---|
| **动量强度** | 35% | 板块强度 Score、涨跌幅排名、成交量放大、资金连续流入、相对强弱 RS | `daily_quotes`（MA20/MA60、涨幅）、sectorStrength |
| **情绪热度** | 25% | 舆情热度排名、散户情绪、龙虎榜机构买入、涨停板数量 | 行业评分、新闻热度、资金净流入 |
| **技术突破** | 20% | 突破形态、MACD 信号、RSI 状态、均线系统 | RSI、MACD、成交量突破 |
| **估值风险** | 15% | PE 相对水平、PB 历史分位、市值流动性、股息率 | PE/PB 分位、PEG |
| **大盘环境** | 5% | 大盘趋势、系统性风险 | 指数数据 |

### 4.2 评分与分类的关系

```
四分类结果：hot-momentum
  → 双策略评分：HotSectorAnalyzer 计算 HotSectorScore
  → 输出：HotSectorScore（含五维得分 + action 建议）
  → 消费：HotSectorWidget 驾驶舱展示
```

---

## 5. 止盈止损差异化配置

| 配置项 | 值 | 配置位置 | 说明 |
|--------|-----|----------|------|
| 止损线 | **-8%** | `dualStrategyRules.ts` (`hotSectorStopLossPct`) | 硬性止损，不补仓 |
| 止盈线 | **+15%** | `dualStrategyRules.ts` (`hotSectorTakeProfitPct`) | 触发后卖出 50% 仓位 |
| 止盈卖出比例 | **50%** | `dualStrategyRules.ts` (`hotSectorTakeProfitSellRatio`) | 减半仓锁定利润 |
| 持有期 | 3-15 天（平均 7 天） | -- | 快进快出，不恋战 |
| 仓位上限 | 5%-8%（跟进）/ 2%-3%（试探） | -- | 单票仓位 |
| 补仓策略 | 不补仓 | -- | 止损即出，不逆势加仓 |

### 止损执行规则

- 跌破 -8% 立即执行止损，不设缓冲。
- 不因"反弹预期"推迟止损。
- 止损后 24 小时冷却期内禁止同标的再次买入。

---

## 6. 策略执行流程

```
1. 输入标的列表（非 core-scarce）
2. 获取标的综合评分、sector、动量（priceToMA20）
3. 获取热门板块 TOP5 列表
4. 判定：综合分 >= 3.0 AND sector 热门 AND 动量 >= 5%
   → 是：分类为 hot-momentum
   → 否：进入 value-bargain 判定
5. 双策略评分：HotSectorAnalyzer 计算 HotSectorScore
6. 动作判定：
   - HotSectorScore > 4.0 → 立即跟进（5-8%）
   - 3.5 <= HotSectorScore <= 4.0 → 试探（2-3%）
   - < 3.5 → 不追
7. 驾驶舱 HotSectorWidget 展示评分与建议
```

---

## 7. 代码层映射

| 组件 | 文件路径 | 说明 |
|------|----------|------|
| 四分类引擎 | `src/services/trading/strategyEngine.ts` | `classify()` 中优先级 2 判定 |
| 热门板块分析器 | `src/services/scoring/hotSectorAnalyzer.ts` | 五维评分（动量35%/情绪25%/技术20%/估值15%/大盘5%） |
| 双策略编排引擎 | `src/services/trading/dualStrategyEngine.ts` | 编排分析器并输出结果 |
| 四分类阈值 | `src/config/strategyRules.ts` | 动量/板块/综合分阈值 |
| 双策略阈值 | `src/config/dualStrategyRules.ts` | 评分/动作/止盈止损阈值 |
| 热门板块服务 | `src/services/input/hotSectorService.ts` | 热门板块数据获取 |
| 热门板块 Widget | `src/cockpit/widgets/HotSectorWidget.tsx` | 驾驶舱展示 |

---

## 8. 风险控制

| 风险项 | 应对措施 |
|--------|----------|
| 板块热度快速消退 | 动量阈值（5%）作为筛选器，剔除动量不足的标的 |
| 追高被套 | -8% 硬性止损，不补仓，不扛单 |
| 大盘系统性下跌 | 大盘环境因子占 HotSectorScore 的 5%，大盘走弱时降低评分 |
| 过度交易 | 单日最大交易次数 5 次（风控引擎约束） |

---

## 9. 相关文档

- [选股策略总文档](../../specs/architecture/stock-selection-strategy.md)
- [价值洼地策略](../../specs/architecture/value-bargain-strategy.md)
- [ADR-009: 双策略体系](../../reference/implementation/adr/2026-06-27-dual-strategy-system_adr.md)
- [架构文档](../../explanation/architecture/v9-strategy-architecture_architecture.md)
- [引擎规格](../../specs/05-engine-specs.md)