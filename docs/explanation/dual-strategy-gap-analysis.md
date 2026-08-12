---
title: V9 双策略规格与现有项目差异分析报告
type: explanation
domain: backend
phase: planning
tier: important
status: active
maintainer: V9 Architecture Team
summary: "V9 双策略规格与现有实现的差异分析报告，识别缺口与对齐路径。"
tags: [backend, strategy, dual-strategy, gap-analysis, service, api, analysis, explanation]
version: v1.0.0
last_updated: 2026-06-27
code_version: "2.0.0-rc.1"
doc_id: V9-DOC-BACK-006
referenced_by: [V9-DOC-META-000, V9-DOC-PROJ-176, V9-DOC-PROJ-182, V9-DOC-PROJ-149]
change_log:
  - version: v1.0.0
    changes: "C 类版本闭环(2026-08-11)：change_log 对齐当前版本"
    date: 2026-06-27
---

# V9 双策略规格与现有项目差异分析报告

> **Status**: Proposal / 待评审  
> **Version**: v1.0.0  
> **Last Updated**: 2026-06-27  
>  
> 本文档将 `../reference/dual-strategy-dataflow-spec.md` 中的用户输入规格，与 V9 当前代码实际状态、架构文档进行逐项校对。  
> 所有结论基于 `../reference/03-architecture-standards.md`、`../reference/05-engine-specs.md`、`../reference/v9-system-blueprint.md`、  
> `src/services/trading/strategyEngine.ts`、`src/core/dataflow/`、`src/cockpit/`、`src/config/strategyRules.ts` 等真实状态。

---

## 1. 校对结论总览

| 维度 | 用户规格 | 项目当前状态 | 符合度 |
|---|---|---|---|
| 总体定位 | 双策略（热门板块 + 价值洼地）驱动驾驶舱与交易 | 当前以「第四次工业革命稀缺核心资源」主题策略为核心，已有 `core-scarce / value-bargain / hot-momentum / excluded` 四分类 | 60% |
| 数据流分层 | 外部 API → 适配器 → 七维存储 → 订阅分发 → 策略引擎 → 双策略评分 → 驾驶舱 → 交易 | 五层架构已落地，DataFlowEngine、DataBridge、IndexedDB 已存在；但缺数据融合层、缺热门/洼地双评分通道 | 70% |
| 驾驶舱数据通道 | 8 条通道，3 秒/10 秒/30 秒/事件驱动等频率 | DataFlowEngine 已内置 10 条通道，但命名、频率、订阅 Widget 映射与用户规格不一致 | 40% |
| 双策略评分输出 | HotSectorScore、ValuePitScore [0-5] | 当前仅有 `V6Score.score`、智能评分、行业评分；无独立 HotSectorScore / ValuePitScore 类型与服务 | 10% |
| 轮动信号检测 | 成交量 + 资金 + 技术金叉，触发建仓或观察池 | `rotationScoreService.ts` 已实现五因子十六指标板块轮动模型，但个股级轮动信号检测引擎缺失 | 30% |
| 驾驶舱 Widget | 18 个 Widget（含 HotSectorWidget、ValuePitWidget 等） | 当前已注册 12 个 Widget，缺少用户规格中的 6 个 | 50% |
| 阈值体系 | 热门 3.5/4.0、洼地 2.8–3.5/4.0 等 | `strategyRules.ts` 阈值与热门/洼地口径不完全一致 | 30% |
| 止盈止损 | 热门 -8%/+15% 卖 50%；洼地 -15%/+20% 卖 30% | 交易引擎已有风控/仓位/信号，但缺少按策略分类的差异化止盈止损 | 20% |

---

## 2. 差异明细与可行性方案

### 2.1 核心数据流：外部 API 层与数据源适配

| 子项 | 用户规格 | 项目当前状态 | 差异说明 | 可行性方案 |
|---|---|---|---|---|
| 数据源 | 腾讯 / 东财 / 新浪 / LLM | 当前主要对接本地 Python AKShare 服务（`src/services/fetcher/`），通过 `fetcherClient.ts` 拉取真实数据 | 数据源描述不一致：腾讯/东财/新浪接口未明确落地，AKShare 已作为统一采集入口 | **方案 A**：保持 AKShare 为主采集入口，封装腾讯/东财/新浪适配器作为可选源，通过 `fetcherConfig.ts` 配置切换；**方案 B**：将 AKShare 定位为「数据源适配器层」实现之一，未来按需扩展 |
| 适配器层 | GBK 解码 / JSONP / 字段映射 | `fetcherAdapter.ts` 已做字段映射与清洗，但代码中未体现 GBK/JSONP 处理 | 概念存在，实现程度不足 | 在 `fetcherAdapter.ts` 中补充编码/JSONP 处理工具函数，或在配置层声明不同源的 `responseEncoding` |
| 七维数据存储 | IndexedDB / Memory Cache | IndexedDB 17 个 Store 已落地；DataFlowEngine 内存缓存已落地 | 基本对齐 | 保持；补充 `dataDimension` 字段到 `Stock.dataQuality` 以显式对应「七维」 |

### 2.2 策略引擎层

| 子项 | 用户规格 | 项目当前状态 | 差异说明 | 可行性方案 |
|---|---|---|---|---|
| 双策略评分输出 | `HotSectorScore`、`ValuePitScore` 两个独立 0–5 分评分 | 当前仅有 `V6Score`（综合分）、`IntelligentScore`、`IndustryScore`；策略引擎输出的是分类标签 `StrategyClassification` | 缺少用户规格中的双评分输出类型与引擎 | **推荐方案**：新建 `src/services/scoring/hotSectorAnalyzer.ts` 和 `src/services/scoring/valuePitAnalyzer.ts`，输出 `HotSectorScore` / `ValuePitScore` 类型；保持现有 `strategyEngine.ts` 作为编排入口，内部调用两个 Analyzer |
| 热门路径五维 | 动量 / 情绪 / 技术 / 估值 | `strategyEngine.ts` 已使用 `momentum`（priceToMA20）、`sector` 是否热门、`composite` 综合分；情绪/技术/估值维度未显式拆分 | 维度定义不一致 | 扩展 `HotSectorScore` 结构，显式包含 momentum / sentiment / technical / valuation 四维 + 综合；从已有 `v6ScoreService` 因子与 `daily_quotes` 计算 |
| 洼地方径五维 | 催化 / 估值 / 筹码 / 轮动 / 流动性 | `rotationScoreService.ts` 已覆盖景气/资金/估值/β/量能五因子；个股级筹码/催化/轮动维度未显式建模 | 轮动因子有基础，但个股级洼地维度缺失 | 新建 `ValuePitAnalyzer`，复用 `rotationScoreService.ts` 板块评分作为「轮动」输入，从 `Stock` 和 `daily_quotes` 计算催化/估值/筹码/流动性 |
| 轮动信号检测 | 成交量 + 资金 + 技术金叉，触发建仓或加入观察池 | `rotationScoreService.ts` 输出板块级信号；`poolTransitionEngine` 与 `stockpoolService` 已支持观察池流转；缺少个股级轮动触发器 | 板块级有，个股级无 | 新建 `src/services/scoring/rotationSignalDetector.ts`，对 `value-bargain` 候选计算成交量突破、资金净流入、MA 金叉三条件，命中则生成 `TradingSignal` 触发建仓，否则通过 `DataBridge.forward(UPDATE_STOCK)` 写入 `watchlist` |
| 阈值体系 | 热门 V6>3.5 → HotSectorScore>4.0；洼地 V6 2.8–3.5 → ValuePitScore>4.0 | `strategyRules.ts`：`compositeMin=3.6`、`valueBargainCompositeMin=3.6`、`valueBargainValuationMin=4.0` | 阈值数值与触发口径不完全一致 | 新增 `src/config/dualStrategyRules.ts` 专门承载双策略阈值；或扩展 `StrategyRuleConfig` 增加 `hotSectorV6Min=3.5`、`valuePitV6Min=2.8`、`valuePitV6Max=3.5`、`actionThreshold=4.0` 等字段 |
| 止盈止损 | 按策略分类差异化止盈止损 | `tradingConfig.ts` / `riskEngine.ts` 已有通用止损/仓位/冷却期，但无策略分类差异化 | 缺少策略差异化 | 在 `tradingConfig.ts` 增加 `HOT_MOMENTUM_STOP_LOSS=-0.08`、`VALUE_PIT_STOP_LOSS=-0.15`、`HOT_MOMENTUM_TAKE_PROFIT={0.15:0.5}`、`VALUE_PIT_TAKE_PROFIT={0.2:0.3}` 等配置，由 `riskEngine.ts` 根据持仓标的的 `StrategyClassification` 读取 |

### 2.3 驾驶舱数据流与通道

| 子项 | 用户规格 | 项目当前状态 | 差异说明 | 可行性方案 |
|---|---|---|---|---|
| 通道命名 | `market:sectors`、`market:fundflow`、`portfolio:risk`、`strategy:signals`、`agent:status`、`agent:logs` | 实际通道为 `market:sector`（单数）、`market:fundflow`、`portfolio:summary`、`portfolio:holding`、`strategy:signal`（单数）、`strategy:score`、`agent:status`、`system:health`；无 `portfolio:risk`、`agent:logs` | 通道命名、数量不一致 | **推荐方案**：按用户规格扩展 `DataChannel` 联合类型，新增 `market:sectors`、`portfolio:risk`、`strategy:signals`、`agent:logs`；保留现有通道以兼容已有 Widget；在 `dataflowEngine.ts` 的 `DEFAULT_CHANNELS` 中补充新通道元数据 |
| 更新频率 | `market:index` 3 秒、`market:sectors` 10 秒、`market:fundflow` 30 秒、`portfolio:risk` 1 分钟 | 实际：`market:index` 5 秒、`market:sector` 10 秒、`market:fundflow` 15 秒、`portfolio:summary` 10 秒；无 `portfolio:risk` | 频率不一致 | 调整 `DEFAULT_CHANNELS` 中对应通道的 `refreshInterval`；新增 `portfolio:risk` 60 秒；保持 `market:fundflow` 可配置化 |
| 订阅 Widget 映射 | IndexMonitor、MarketEmotion、SectorHeatmap、Watchlist、FundFlow、PortfolioSummary、PnLAnalysis、RiskMonitor、SignalMonitor、ScoreRadar、AgentStatus、HealthDashboard、LogStream | 实际 Widget：MarketIndicesWidget、SectorHeatmapWidget、FundFlowWidget、MarketSentimentWidget、WatchlistWidget、PortfolioOverviewWidget、AITradeReviewWidget、InvestmentProfileWidget、StockPoolWidget、KaiScoreWidget、ModelCompareWidget、StockChatWidget | Widget 命名、数量不一致 | 建议保留现有 12 个 Widget 并逐步扩展；新增 `HotSectorWidget`、`ValuePitWidget`、`RiskMonitorWidget`、`AgentStatusWidget`、`HealthDashboardWidget`、`LogStreamWidget`；将 `MarketIndicesWidget` 对标 `IndexMonitor`、`MarketSentimentWidget` 对标 `MarketEmotion`、`KaiScoreWidget` 可扩展为 `ScoreRadar` |
| 18 个 Widget | 用户规格要求 18 个 | 当前 12 个 | 缺少 6 个 | 分阶段实施：P0 新增 `HotSectorWidget`、`ValuePitWidget`；P1 新增 `RiskMonitorWidget`、`AgentStatusWidget`；P2 新增 `HealthDashboardWidget`、`LogStreamWidget` |

### 2.4 数据模型与 Schema

| 子项 | 用户规格 | 项目当前状态 | 差异说明 | 可行性方案 |
|---|---|---|---|---|
| 双评分类型 | `HotSectorScore`、`ValuePitScore` | 无 | 需新增类型 | 在 `src/data/types.ts` 新增：
```ts
export interface HotSectorScore {
  symbol: string
  score: number // 0-5
  dimensions: { momentum; sentiment; technical; valuation; composite }
  calculatedAt: number
}
export interface ValuePitScore {
  symbol: string
  score: number // 0-5
  dimensions: { catalyst; valuation; chip; rotation; liquidity }
  rotationSignal: boolean
  calculatedAt: number
}
``` |
| 持久化 Store | 建议新增 `hot_sector_scores`、`value_pit_scores` | 当前 IndexedDB 已有 `v6_scores`、`intelligent_scores`、`industry_scores`、`rotation_scores` 等 17 个 Store | 可以通过扩展现有 Store 或新增 Store | **方案 A（推荐）**：新增 `hot_sector_scores`、`value_pit_scores` 两个 Store，主键 `symbol`，与 `v6_scores` 解耦；**方案 B**：扩展 `v6_scores` 增加 `hotSectorScore` / `valuePitScore` 字段，但会污染通用评分语义 |
| 交易信号类型 | 建仓 / 止盈 / 止损 | `TradingSignal` 已存在；`orders` Store 已存在 | 信号基础设施已具备 | 扩展 `TradingSignal` 增加 `strategy: 'hot-sector' | 'value-pit'` 字段，便于后续差异化执行 |

### 2.5 调用方向与架构合规

| 子项 | 用户规格隐含要求 | 项目当前状态 | 差异说明 | 可行性方案 |
|---|---|---|---|---|
| 写操作通道 | 策略引擎输出评分、信号应写入 IndexedDB 并触发事件 | `v6ScoreService.ts` 仍直接调用 `dataLayer.v6Scores.save()`，未走 `DataBridge.forward()` | 违反架构文档 3.2 调用方向铁律 | 将 `v6ScoreService.ts` 的 `dataLayer.v6Scores.save()` 重构为 `DataBridge.forward(SAVE_SCORE)`；新增 Analyzer 的写操作直接从设计阶段走 DataBridge |
| L3 读数据 | 策略引擎读取 `dataLayer` 已允许 | `strategyEngine.ts` 读取 `dataLayer.dailyQuotes` 和 `getHotSectors()` | 符合 | 保持；新增 Analyzer 读取 `dataLayer` 即可 |
| 配置层依赖 | 阈值、因子权重集中在 `src/config/` | `strategyRules.ts` 已存在 | 符合 | 扩展配置即可 |

### 2.6 现有能力与可复用点

| 现有能力 | 文件 | 如何在双策略中复用 |
|---|---|---|
| V6 自动评分 | `src/services/scoring/v6ScoreService.ts` | 作为双策略前置门槛分数来源 |
| 智能评分（LLM） | `src/services/scoring/intelligentScoreService.ts` | 用于生成热门/洼地维度的 rationale 与证据链 |
| 行业评分 | `src/services/scoring/industryScoreService.ts` | 作为热门板块判定与洼地行业轮动的输入 |
| 板块轮动评分 | `src/services/analysis/rotationScoreService.ts` | 直接作为 `ValuePitScore.dimensions.rotation` 的输入 |
| 策略分类引擎 | `src/services/trading/strategyEngine.ts` | 扩展为双策略编排入口，或保持不变由新增 Analyzer 替代部分逻辑 |
| 主题注册表 | `src/config/themeRegistry.ts` | 热门板块可扩展为主题匹配；价值洼地可与非主题池结合 |
| 数据流引擎 | `src/core/dataflow/dataflowEngine.ts` | 注册新通道，供 Widget 订阅 |
| Widget 注册表/引擎 | `src/cockpit/core/widgetRegistry.ts`、`widgetEngine.ts` | 直接注册新的 HotSectorWidget / ValuePitWidget |
| 股票池流转 | `src/core/poolTransitionEngine.ts` | 轮动信号未触发时，将标的转入 `watchlist` 观察池 |
| 风控/仓位 | `src/services/trading/riskEngine.ts`、`positionSizer.ts` | 读取策略分类，执行差异化止盈止损与仓位 |

---

## 3. 总体建议的实施路径

### 3.1 立即行动（文档/评审层，不改动代码）

1. 由架构负责人评审本报告与 `../reference/dual-strategy-dataflow-spec.md`。
2. 决定是否以本规格替换/扩展 ADR-008 中的「第四次工业革命稀缺核心资源」策略，或作为并行的「双策略体系」独立存在。
3. 若采纳，按 `./design/implementation-governance.md` 创建新 ADR：
   - 标题建议：`ADR-009: 引入热门板块与价值洼地双策略体系`
   - 状态：`Proposal` → `Accepted`
4. 更新以下文档：
   - `../reference/03-architecture-standards.md`：补充双策略类型、Store、Widget 映射
   - `../reference/05-engine-specs.md`：补充 HotSectorAnalyzer / ValuePitAnalyzer / RotationSignalDetector
   - `../reference/10-glossary.md`：新增 `HotSectorScore`、`ValuePitScore`、`RotationSignal` 术语
   - `../reference/08-implementation-plan.md`：将双策略纳入 Phase 2

### 3.2 第一阶段：MVP 双策略引擎（建议 P1）

1. 新增类型：`HotSectorScore`、`ValuePitScore`（`src/data/types.ts`）。
2. 新增 Store：`hot_sector_scores`、`value_pit_scores`（`src/data/db.ts`、`dbConfig.ts`），DB 版本 +1。
3. 新增配置：`src/config/dualStrategyRules.ts`。
4. 新增服务：
   - `src/services/scoring/hotSectorAnalyzer.ts`
   - `src/services/scoring/valuePitAnalyzer.ts`
   - `src/services/scoring/rotationSignalDetector.ts`
5. 扩展 `strategyEngine.ts`：内部调用上述 Analyzer，输出 `StrategyResult` 不变但增加 `hotSectorScores` / `valuePitScores` 字段，或新建 `runDualStrategy()` 函数。
6. 新增测试覆盖：单元测试 + 集成测试。

### 3.3 第二阶段：驾驶舱 Widget（建议 P1/P2）

1. 扩展 `DataChannel` 联合类型与 `DEFAULT_CHANNELS`：
   - `market:sectors`
   - `portfolio:risk`
   - `strategy:signals`
   - `agent:logs`
2. 新增 Widget：
   - `src/cockpit/widgets/HotSectorWidget.tsx`
   - `src/cockpit/widgets/ValuePitWidget.tsx`
3. 在 `widgetRegistry.ts`、`cockpit.constants.ts` 注册并配置默认布局。

### 3.4 第三阶段：交易执行差异化（建议 P2）

1. 扩展 `tradingConfig.ts` 增加双策略止盈止损配置。
2. 扩展 `TradingSignal` 类型增加 `strategy` 字段。
3. 修改 `riskEngine.ts` / `positionSizer.ts`，根据 `strategy` 读取差异化参数。
4. 在 `TradingApp` 增加「热门持仓」与「洼地持仓」分面板展示。

---

## 4. 风险与回退

| 风险 | 影响 | 应对措施 |
|---|---|---|
| 新增 Store 导致老用户 DB 升级失败 | 高 | 按 `db.ts` 现有迁移模式，在 `onupgradeneeded` 中新增 Store；升级前导出备份 |
| 双策略与现有 ADR-008 主题策略冲突 | 中 | 在 ADR-009 中明确关系：双策略为上层框架，ADR-008 主题为热门/核心稀缺路径的输入之一 |
| V6 评分仍部分依赖模拟数据，导致策略输出质量不稳定 | 高 | 在 UI 显示评分置信度；继续推进 Phase 2 真实数据接入 |
| 新增 Analyzer 直接写 `dataLayer` 破坏架构 | 高 | Code Review + 扫描脚本 `audit-layer-calls.ts` 拦截；设计阶段即要求走 `DataBridge.forward()` |
| 驾驶舱 Widget 数量从 12 扩展到 18，影响首屏性能 | 中 | 按需懒加载 Widget 组件；非核心 Widget 默认不启用 |

---

## 5. 附录：引用文档与代码位置

| 引用 | 路径 |
|---|---|
| 用户输入规格 | `../reference/dual-strategy-dataflow-spec.md` |
| 架构标准 | `../reference/03-architecture-standards.md` |
| 引擎规格 | `../reference/05-engine-specs.md` |
| 整体蓝图 | `../reference/v9-system-blueprint.md` |
| 策略引擎 | `src/services/trading/strategyEngine.ts` |
| 策略规则配置 | `src/config/strategyRules.ts` |
| 数据流引擎 | `src/core/dataflow/dataflowEngine.ts`、`src/core/dataflow/dataflowTypes.ts` |
| Widget 注册表 | `src/cockpit/core/widgetRegistry.ts` |
| 驾驶舱外壳 | `src/cockpit/CockpitShell.tsx` |
| 板块轮动评分 | `src/services/analysis/rotationScoreService.ts` |
| V6 评分 | `src/services/scoring/v6ScoreService.ts` |
| 数据类型 | `src/data/types.ts` |
