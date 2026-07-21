---
title: 观察仓策略（watchlist）
version: v1.0.0
last_updated: 2026-06-27
maintainer: V9 Architecture Team
status: active
---

# 观察仓策略（watchlist）

> **Status**: Active
> **Version**: v1.0.0
> **Last Updated**: 2026-06-27
>
> 本文档定义 V9 的观察仓策略（watchlist），属于四分类体系中的第三梯队。观察仓是 V9 策略体系的"蓄水池"与"缓冲区"，承载暂不满足交易条件但值得持续跟踪的标的，以及从其他分类降级的标的。
> 目标读者：策略开发者、交易员、架构评审者。

---

## 1. 策略定义

观察仓策略（watchlist）是 V9 四分类选股体系中**优先级最低**的分类，承载以下两类标的：

1. **未匹配任何分类**：综合分 >= 2.8 但不满足 core-scarce / hot-momentum / value-bargain 任一判定条件。
2. **评分不足**：综合分 < 2.8，直接归入观察仓。
3. **降级标的**：从 core-scarce、hot-momentum、value-bargain 因评分恶化而降级的标的。
4. **筛选淘汰**：20 进 13 规则中未进入前 13 名的候选。
5. **轮动未触发**：价值洼地候选标的轮动信号未触发。

### 核心理念

- **持续跟踪**：观察仓不是"放弃"，而是"等待"。标的在观察仓中持续接受评分更新与信号检测。
- **动态流转**：观察仓标的可因评分提升或信号触发升级为第二梯队，也可因评分持续恶化被标记为不关注。
- **不参与交易**：观察仓中的标的不产生交易信号，不参与建仓，但参与驾驶舱展示与数据刷新。

---

## 2. 触发条件与阈值

### 2.1 分类判定条件

```
watchlist 判定条件（满足任一）：
  1. 综合分 < watchlistV6Max（2.8）→ 直接归入观察仓
  2. 未匹配 core-scarce / hot-momentum / value-bargain 任一分类
```

### 2.2 降级条件

| 来源分类 | 降级条件 | 说明 |
|----------|----------|------|
| core-scarce | 综合分跌破主题门槛 | 主题匹配不再满足 |
| hot-momentum | 动量衰减 < 5% 或 板块退出 TOP5 | 趋势动能丧失 |
| value-bargain | 估值分 < 4.0 或 综合分 < 3.0 | 估值优势消失 |
| 20 进 13 淘汰 | 综合分排名未进入前 13 | 竞争性淘汰 |
| R2 低估值过滤 | 估值分 < 2.5 且 综合分 < 4.0 | 低估值低质量 |

### 2.3 阈值配置

| 阈值 | 默认值 | 配置位置 | 说明 |
|------|--------|----------|------|
| watchlistV6Max | 2.8 | `strategyRules.ts` | V6 综合分低于此值直接归入观察仓 |
| compositeMin | 3.0 | `strategyRules.ts` | 综合分 >= 3.0 才可能进入 hot-momentum 或 value-bargain |
| lowValuationThreshold | 2.5 | `strategyRules.ts` | 低估值过滤阈值 |
| lowValuationCompositeExempt | 4.0 | `strategyRules.ts` | 低估值豁免综合分 |
| selectedMaxCount | 13 | `strategyRules.ts` | 最多入选标的数量 |

---

## 3. 三梯队位置

观察仓策略属于 **第三梯队（最低优先级）**。

```
第一梯队：core-scarce
第二梯队：hot-momentum + value-bargain
第三梯队：watchlist  ← 本策略
```

### 梯队关系

- watchlist 是所有分类判定的**兜底**，任何未匹配前三个分类的标的均归入观察仓。
- watchlist 是**动态流转的目的地**，从其他分类降级的标的首先进入观察仓。
- watchlist 也是**升级的来源地**，标的可通过评分提升或轮动信号触发升级至第二梯队。

---

## 4. 与双策略评分的关系

观察仓标的**不参与双策略评分增强**，但并非完全脱离评分体系：

### 4.1 观察仓标的评分跟踪

- 观察仓标的仍持续接受 V6 综合评分更新。
- 当综合分提升至 >= 3.0 时，标的重新进入四分类判定流程。
- 观察仓中价值洼地候选标的（如轮动未触发），持续接受 `RotationSignalDetector` 检测。

### 4.2 观察仓与价值洼地的关联

```
价值洼地候选（ValuePitScore 3.0-3.5）
  → 轮动信号检测
  → 未触发 → 加入观察池（watchlistCandidates）
  → 持续跟踪轮动信号
  → 信号触发 → 升级为 value-bargain（build 状态）
```

### 4.3 不参与双策略评分

观察仓中的标的不执行 `HotSectorAnalyzer` 和 `ValuePitAnalyzer` 五维评分，以节省计算资源。仅在标的满足升级条件时，才触发完整的双策略评分流程。

---

## 5. 止盈止损差异化配置

观察仓标的不参与交易，因此**不设止盈止损**：

| 配置项 | 值 | 说明 |
|--------|-----|------|
| 止损线 | 不适用 | 观察仓不建仓，无止损 |
| 止盈线 | 不适用 | 观察仓不建仓，无止盈 |
| 持有期 | 持续跟踪 | 无固定持有期 |
| 建仓方式 | 不建仓 | 仅观察，不产生交易信号 |
| 仓位上限 | 0% | 不参与交易 |

---

## 6. 观察仓管理规则

### 6.1 升级条件

| 升级目标 | 条件 |
|----------|------|
| core-scarce | 综合分 >= 主题门槛 AND 匹配主题 |
| hot-momentum | 综合分 >= 3.0 AND 板块进入热门 TOP5 AND 动量 >= 5% |
| value-bargain | 综合分 >= 3.0 AND 估值分 >= 4.0 |

### 6.2 清理规则

| 条件 | 动作 |
|------|------|
| 综合分 < 2.0 持续 30 天 | 标记为"不关注"，移出活跃观察仓 |
| 标的退市/停牌 | 标记为"停牌"，保留历史数据 |
| 用户手动移除 | 从观察仓中删除 |

### 6.3 展示规则

- 观察仓标的在驾驶舱中以独立 Widget 展示（WatchlistWidget）。
- 按综合分降序排列，突出显示接近升级阈值的标的。
- 标记每个标的进入观察仓的原因（如"V6 综合分 2.4 低于 2.8"、"估值分 3.2 未达 4.0"）。

---

## 7. 策略执行流程

```
1. 标的未匹配 core-scarce / hot-momentum / value-bargain
2. 或综合分 < 2.8
3. 或从其他分类降级
4. 或 20 进 13 筛选淘汰
   → 分类为 watchlist
5. 写入分类原因（reasons）
6. 持续跟踪 V6 评分更新
7. 定期检查升级条件
8. 驾驶舱 WatchlistWidget 展示
```

---

## 8. 代码层映射

| 组件 | 文件路径 | 说明 |
|------|----------|------|
| 四分类引擎 | `src/services/trading/strategyEngine.ts` | `classify()` 中优先级 4 判定（兜底） |
| 四分类阈值 | `src/config/strategyRules.ts` | watchlistV6Max / compositeMin 等阈值 |
| 双策略编排引擎 | `src/services/trading/dualStrategyEngine.ts` | 输出 watchlistCandidates（轮动未触发） |
| 轮动信号检测 | `src/services/scoring/rotationSignalDetector.ts` | 持续检测观察仓中价值洼地候选 |

---

## 9. 相关文档

- [选股策略总文档](./stock-selection-strategy.md)
- [核心稀缺资源策略](./core-scarce-strategy.md)
- [热门赛道策略](./hot-momentum-strategy.md)
- [价值洼地策略](./value-bargain-strategy.md)
- [架构文档](../architecture/v9-strategy-architecture.md)
- [ADR-009: 双策略体系](../implementation/adr/2026-06-27-dual-strategy-system.md)