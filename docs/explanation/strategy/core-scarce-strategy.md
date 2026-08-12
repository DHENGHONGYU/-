---
title: 核心稀缺资源策略（core-scarce）
version: v1.0.0
last_updated: 2026-06-27
maintainer: V9 Architecture Team
status: active
change_log:
  - version: v1.0.0
    changes: "C 类版本闭环(2026-08-11)：补全 change_log 初始条目"
    date: 2026-06-27
---

# 核心稀缺资源策略（core-scarce）

> **Status**: Active
> **Version**: v1.0.0
> **Last Updated**: 2026-06-27
>
> 本文档定义 V9 的核心稀缺资源策略（core-scarce），属于四分类体系中的第一梯队。该策略基于"第四次工业革命稀缺核心资源"主题，通过主题匹配 + 综合评分达标筛选核心持仓标的。
> 目标读者：策略开发者、交易员、架构评审者。

---

## 1. 策略定义

核心稀缺资源策略（core-scarce）是 V9 四分类选股体系中**优先级最高**的分类，旨在识别并持有"第四次工业革命"背景下的核心稀缺资源标的。该策略基于主题匹配引擎，筛选出符合预定义主题且综合评分达标的标的，作为长期核心持仓。

### 核心理念

- **主题驱动**：围绕"第四次工业革命"（AI、半导体、新能源、量子计算、生物科技等）的稀缺核心资源进行布局。
- **长期持有**：核心持仓不追求短期波动，持有期 6-12 个月。
- **评分驱动**：以 V6 综合评分、V4 行业评分、智能评分为基础，多维度验证标的质地。

---

## 2. 触发条件与阈值

### 2.1 分类判定条件

```
core-scarce 判定条件：
  1. 标的匹配主题（themeRegistry 中定义的主题）AND
  2. 综合分 >= theme.minCompositeScore（主题最低综合分门槛）
```

### 2.2 主题配置

主题定义在 `src/config/themeRegistry.ts`，当前激活的主题为"第四次工业革命稀缺核心资源"，包含：

| 配置项 | 说明 | 示例 |
|--------|------|------|
| 行业代码匹配 | 按行业分类代码筛选 | 半导体、新能源、AI |
| sector 名称匹配 | 按板块名称筛选 | 芯片、光伏、算力 |
| 代码白名单 | 硬编码核心标的列表 | 特定 A 股代码 |
| 主题标签匹配 | 按 Stock.theme 字段匹配 | `["core-resource", "scarce"]` |

### 2.3 评分门槛

| 阈值 | 默认值 | 配置位置 | 说明 |
|------|--------|----------|------|
| minCompositeScore | 4.0 | `themeRegistry.ts` | 主题最低综合分，低于此分不纳入 core-scarce |

---

## 3. 三梯队位置

核心稀缺资源策略属于 **第一梯队（最高优先级）**。

```
第一梯队：core-scarce  ← 本策略
第二梯队：hot-momentum + value-bargain
第三梯队：watchlist
```

### 梯队关系

- core-scarce 标的在分类判定中**最先被评估**，一旦匹配即不再进入后续分类。
- 入选 core-scarce 的标的仍可参与双策略评分增强（HotSectorScore / ValuePitScore），但四分类结果以一梯队为准。
- 若 core-scarce 标的综合分跌破主题门槛，将降级至第二梯队或第三梯队。

---

## 4. 与双策略评分的关系

核心稀缺资源策略属于四分类选股层，**与双策略评分增强层并行**：

| 维度 | 四分类层 | 双策略评分层 |
|------|----------|-------------|
| 本策略角色 | 分类为 core-scarce | 可额外参与 HotSectorScore / ValuePitScore 评分 |
| 输出 | `StrategyClassification = 'core-scarce'` | `HotSectorScore` / `ValuePitScore` |
| 用途 | 决定"选什么" | 决定"打多少分" |

core-scarce 标的在双策略评分中：
- **热门板块评分**：若标的所在板块处于热门 TOP5，可获得 HotSectorScore。
- **价值洼地评分**：若标的估值分 >= 4.0 且综合分在 2.8-3.5 区间，可获得 ValuePitScore。

两者的评分结果均输入驾驶舱 Widget，为交易决策提供更多维度参考。

---

## 5. 止盈止损差异化配置

| 配置项 | 值 | 说明 |
|--------|-----|------|
| 止损线 | 主题策略内部定义 | 核心持仓不设硬性止损，以主题逻辑变化为退出信号 |
| 止盈线 | 主题策略内部定义 | 长期持有，按主题景气度变化调整 |
| 持有期 | 6-12 个月 | 长期主题投资 |
| 建仓方式 | 主题组合等权分配 | 由 `portfolioBuilder.ts` 构建等权组合 |
| 仓位上限 | 单票 <= 25% | 风控约束 |
| 再平衡 | 按季度或偏离度 > 5% | 触发再平衡信号 |

---

## 6. 策略执行流程

```
1. 输入标的列表
2. 遍历标的，调用 matchesTheme(stock, theme) 判断主题匹配
3. 获取综合评分（V6 + 智能 + 行业评分聚合）
4. 综合分 >= theme.minCompositeScore → 分类为 core-scarce
5. 汇总 core-scarce 标的，输入 portfolioBuilder 构建等权组合
6. 输出目标持仓（symbol / targetWeight / targetShares）
7. 驾驶舱 CoreResourcePanel 展示持仓与再平衡计划
```

---

## 7. 代码层映射

| 组件 | 文件路径 | 说明 |
|------|----------|------|
| 主题注册表 | `src/config/themeRegistry.ts` | 主题定义、匹配规则、白名单 |
| 四分类引擎 | `src/services/trading/strategyEngine.ts` | `classify()` 中优先级 1 判定 |
| 组合构建器 | `src/services/trading/portfolioBuilder.ts` | 等权组合构建 |
| 评分适配器 | `src/services/trading/scoringAdapter.ts` | 聚合 V6/智能/行业评分 |
| 核心稀缺面板 | `src/apps/trading/panels/CoreResourcePanel.tsx` | 驾驶舱展示 |

---

## 8. 相关文档

- [选股策略总文档](./stock-selection-strategy.md)
- [ADR-008: 第四次工业革命稀缺核心资源策略](../implementation/adr/2026-06-24-adopt-v6-core-resource-trading-strategy.md)
- [架构文档](../architecture/v9-strategy-architecture.md)
- [引擎规格](../05-engine-specs.md)