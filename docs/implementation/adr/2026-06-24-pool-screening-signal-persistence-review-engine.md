---
title: ADR-007: 补齐筛选引擎、信号持久化与复盘引擎
version: v0.9.0
last_updated: 2026-06-24
maintainer: V9 Architecture Team
status: active
change_log:
  - date: 2026-06-24
    author: Documentation Governor
    desc: 注入 Frontmatter 元数据（Phase 3 版本化）
---
# ADR-007: 补齐筛选引擎、信号持久化与复盘引擎

> **Status**: Accepted  
> **Version**: v0.9.0-docs-review  
> **Last Updated**: 2026-06-24

- 状态：已接受
- 日期：2026-06-24
- 决策人：@frontend-lead

## 背景

V9 已跑通“录入 → 评分 → 信号/下单 → 导出”的主链路，但投资流程中的三个关键节点仍处于缺失或半缺失状态：

1. **筛选引擎**：分析舱产生的评分无法自动驱动股票池状态流转（candidate → screened → deepDive），目前全靠输入舱看板手动点击。
2. **信号持久化**：交易舱 `signalGenerator` 生成的买卖信号只在内存中使用，未写入 `signals` Store，导致无法复盘信号准确率。
3. **复盘引擎**：输出舱仅有全量导出，缺少对 `orders`、`scores`、`stocks` 的聚合复盘能力。

## 选项

| 选项 | 优点 | 缺点 |
|------|------|------|
| A. 在分析舱实现 `ScreeningEngine`，在交易舱持久化 `signals`，在输出舱实现 `ReviewEngine` | 职责与五舱定位一致，数据流向清晰 | 需要新增多个 service 和测试 |
| B. 全部放在输入舱/总控舱统一调度 | 入口集中 | 违反“分析归分析、交易归交易”的舱职责划分，跨层耦合重 |
| C. 继续手动/占位，后续再补 | 当前改动最小 | 投资研究闭环无法形成，长期技术债务累积 |

## 决策

选择 **A**。按以下顺序落地：

1. **筛选引擎（ScreeningEngine）**：位于 `src/services/analysis/screeningEngine.ts`，基于 `v6_scores` / `intelligent_scores` / `dataQuality` 规则，调用 `stockpoolService.transitionStock` 批量晋升 candidate/screened。
2. **信号持久化（Signal Persistence）**：位于 `src/services/trading/tradingService.ts` 的 `scanWatchingSignals` 流程中，生成信号后通过 `DataBridge.forward(INSERT_SIGNAL)` 写入 `signals` Store。
3. **复盘引擎（ReviewEngine）**：位于 `src/services/output/reviewEngine.ts`（或 `src/services/system/reviewEngine.ts`），聚合 `orders`、`v6_scores`、`intelligent_scores`、`stocks` 计算胜率、盈亏、信号准确率等指标。

## 实施状态

- [x] 筛选引擎已实现并通过测试 (`tests/screeningEngine.test.ts`)
- [x] 信号持久化已实现并通过测试 (`tests/signalPersistence.test.ts`)
- [ ] 复盘引擎待下一轮实现

## 关键落地文件

- `src/config/screeningConfig.ts`
- `src/services/analysis/screeningEngine.ts`
- `src/config/dbConfig.ts`（新增 `insertSignal`、ACL 扩展）
- `src/core/databridge.ts`（新增 `insertSignal` 路由）
- `src/data/dataLayer.ts`（新增 `signalStore`）
- `src/data/types.ts`（`Signal` / `SignalSnapshot` 类型对齐）
- `src/services/trading/signalGenerator.ts` / `tradingService.ts`（信号持久化）

## 后果

- 分析舱从“只读评分”升级为“可驱动流转”。
- 交易信号进入持久化，支持历史复盘。
- 输出舱具备专门的复盘能力，形成“评分 → 交易 → 复盘”闭环。
- 所有写操作继续通过 `DataBridge.forward` 完成，保持现有数据协议不变。

## 相关文档

- `docs/implementation/investment-pipeline-stage-analysis.md`
- `docs/10-glossary.md`
- `docs/02-functional-specs.md`
