---
doc_id: V9-DOC-ARCH-053
title: V9 策略架构文档
version: v0.9.8
last_updated: 2026-06-29
maintainer: V9 Architecture Team
status: active
changelog:
  - date: 2026-06-29
    author: V9质量治理小组
    desc: P0+P1 质量整改完成：thresholds.ts v1.1.0（300+常量）、COLOR_TOKENS、DataState组件库、uiText.ts（1019文案）、fetcherInterceptor（HTTP拦截器）、no-magic-numbers ESLint规则
  - date: 2026-06-27
    author: V9 Architecture Team
    desc: 初始版本
change_log:
  - version: v0.9.8
    changes: "C 类版本闭环(2026-08-11)：补全 change_log 初始条目"
    date: 2026-06-29
code_version: 2.0.0-rc.2
---

# V9 策略架构文档

> **Status**: Active
> **Version**: v0.9.8
> **Last Updated**: 2026-06-29
>
> 本文档定义 V9 选股策略体系的分层架构、数据流、事件流与三梯队+双策略架构关系，是策略模块的架构层唯一真相源。
> 目标读者：架构师、策略引擎开发者、前端开发者。

---

## 1. 策略模块分层图

V9 策略模块严格遵循五层架构，从配置层到展示层逐层依赖：

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│  L5 展示层 (UI)                                                                  │
│  ┌──────────────────────────┐  ┌──────────────────────────┐                      │
│  │ 驾驶舱 Widget             │  │ 交易舱 Panel              │                      │
│  │ ┌──────────────────────┐ │  │ ┌──────────────────────┐ │                      │
│  │ │ HotSectorWidget      │ │  │ │ CoreResourcePanel    │ │                      │
│  │ │ ValuePitWidget       │ │  │ │ HoldingsTable        │ │                      │
│  │ │ WatchlistWidget      │ │  │ │ TradingApp           │ │                      │
│  │ │ ScoreRadar           │ │  │ └──────────────────────┘ │                      │
│  │ └──────────────────────┘ │  └──────────────────────────┘                      │
│  └──────────────────────────┘                                                    │
├─────────────────────────────────────────────────────────────────────────────────┤
│  L4 应用层 (Apps)                                                                │
│  ┌──────────────────────────────────────────────────────────────────────┐       │
│  │ cockpit/CockpitShell.tsx  →  Widget 引擎  →  widgetRegistry.ts       │       │
│  │ apps/trading/TradingApp.tsx  →  交易编排  →  信号 + 订单 + 风控      │       │
│  │ apps/stockpool/  →  池间流转  →  candidate/screened/deepDive/watching │       │
│  └──────────────────────────────────────────────────────────────────────┘       │
├─────────────────────────────────────────────────────────────────────────────────┤
│  L3 引擎层 (Services)                                                            │
│  ┌──────────────────────────────────────────────────────────────────────┐       │
│  │ 四分类选股引擎                       双策略评分引擎                    │       │
│  │ ┌──────────────────────────┐  ┌────────────────────────────────────┐ │       │
│  │ │ strategyEngine.ts        │  │ dualStrategyEngine.ts (编排)       │ │       │
│  │ │ runStrategy()            │  │   ├── hotSectorAnalyzer.ts         │ │       │
│  │ │ classify() 四分类判定    │  │   │   (动量35% 情绪25% 技术20%     │ │       │
│  │ │ 20进13 筛选规则          │  │   │    估值15% 大盘5%)             │ │       │
│  │ │ R2 低估值过滤            │  │   ├── valuePitAnalyzer.ts          │ │       │
│  │ └──────────────────────────┘  │   │   (催化30% 估值25% 筹码20%     │ │       │
│  │                                │   │    轮动15% 流动性10%)          │ │       │
│  │ 辅助服务                       │   └── rotationSignalDetector.ts   │ │       │
│  │ ┌──────────────────────────┐  │       (成交量×1.5 资金连续 金叉)   │ │       │
│  │ │ scoringAdapter.ts        │  └────────────────────────────────────┘ │       │
│  │ │ portfolioBuilder.ts      │                                          │       │
│  │ │ signalGenerator.ts       │  交易服务                                │       │
│  │ │ positionSizer.ts         │  ┌────────────────────────────────────┐ │       │
│  │ │ riskEngine.ts            │  │ tradingService.ts                  │ │       │
│  │ │ themeRegistry.ts         │  │ takeProfitEngine.ts                │ │       │
│  │ │ hotSectorService.ts      │  │ stopLossEngine.ts                  │ │       │
│  │ └──────────────────────────┘  └────────────────────────────────────┘ │       │
│  └──────────────────────────────────────────────────────────────────────┘       │
├─────────────────────────────────────────────────────────────────────────────────┤
│  L2 数据层 (Data)                                                                │
│  ┌──────────────────────────────────────────────────────────────────────┐       │
│  │ dataLayer.ts  →  stocks / v6_scores / hot_sector_scores /             │       │
│  │                   value_pit_scores / signals / orders / daily_quotes  │       │
│  │ DataBridge.ts  →  forward(StandardEnvelope) + ACL 权限校验             │       │
│  │ db.ts  →  IndexedDB 封装 + 版本迁移 (DB_VERSION=14)                    │       │
│  └──────────────────────────────────────────────────────────────────────┘       │
├─────────────────────────────────────────────────────────────────────────────────┤
│  L1 基础设施层 (Config / Core)                                                   │
│  ┌──────────────────────────────────────────────────────────────────────┐       │
│  │ 策略配置                   核心基础设施                                │       │
│  │ ┌──────────────────────────┐  ┌────────────────────────────────────┐ │       │
│  │ │ strategyConfig.ts (入口) │  │ eventBus.ts  (on/emit/off)         │ │       │
│  │ │ strategyRules.ts (四分类)│  │ envelope.ts  (StandardEnvelope)    │ │       │
│  │ │ dualStrategyRules.ts     │  │ databridge.ts (forward + ACL)      │ │       │
│  │ │ rotationConfig.ts (轮动) │  │ poolTransitionEngine.ts            │ │       │
│  │ │ tradingConfig.ts (交易)  │  │ dataflowEngine.ts (SSE/轮询)       │ │       │
│  │ │ scoreFactors.ts (因子)   │  └────────────────────────────────────┘ │       │
│  │ └──────────────────────────┘                                          │       │
│  └──────────────────────────────────────────────────────────────────────┘       │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. 数据流图

### 2.1 核心数据流：从 DataBridge 到策略引擎到 Widget

```
                          ┌──────────────────────┐
                          │   外部 API 数据源      │
                          │  (腾讯/东财/AKShare)   │
                          └──────────┬───────────┘
                                     │ HTTP / SSE
                                     ▼
                          ┌──────────────────────┐
                          │ strategyDataAdapter   │
                          │ (字段映射 + 清洗)      │
                          └──────────┬───────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              DataBridge (L2)                                     │
│                                                                                 │
│  forward(INSERT_STOCK)  forward(SAVE_SCORES)  forward(SAVE_DAILY_QUOTES)        │
│       │                      │                        │                         │
│       ▼                      ▼                        ▼                         │
│  ┌─────────┐          ┌──────────┐            ┌──────────────┐                  │
│  │ stocks   │          │v6_scores │            │daily_quotes   │                  │
│  │ Store    │          │ Store    │            │ Store         │                  │
│  └────┬─────┘          └────┬─────┘            └──────┬───────┘                  │
│       │                     │                         │                          │
└───────┼─────────────────────┼─────────────────────────┼──────────────────────────┘
        │                     │                         │
        │  ┌──────────────────┴──────────────────┐      │
        │  │                                     │      │
        ▼  ▼                                     ▼      ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                          策略引擎层 (L3)                                          │
│                                                                                 │
│  ┌───────────────────────────────┐   ┌────────────────────────────────┐        │
│  │  strategyEngine.ts            │   │  dualStrategyEngine.ts          │        │
│  │  runStrategy(stocks)          │   │  runDualStrategy(stocks)        │        │
│  │                               │   │                                 │        │
│  │  输入: Stock[]                │   │  输入: Stock[]                  │        │
│  │  消费:                        │   │  消费:                          │        │
│  │   • scoringAdapter           │   │   • hotSectorAnalyzer           │        │
│  │     (V6+智能+行业评分)        │   │   • valuePitAnalyzer            │        │
│  │   • hotSectorService         │   │   • rotationSignalDetector      │        │
│  │     (热门板块)                │   │                                 │        │
│  │   • themeRegistry            │   │  输出: DualStrategyResult        │        │
│  │     (主题匹配)                │   │   • HotSectorScore[]            │        │
│  │                               │   │   • ValuePitScore[]             │        │
│  │  输出: StrategyResult         │   │   • Signal[] (buy_rotation)     │        │
│  │   • selected (Top13)         │   │   • watchlistCandidates[]       │        │
│  │   • coreScarce[]             │   │                                 │        │
│  │   • hotMomentum[]            │   │  持久化:                         │        │
│  │   • valueBargain[]           │   │   • REFRESH_HOT_SECTOR_SCORES   │        │
│  │   • watchlist[]              │   │   • REFRESH_VALUE_PIT_SCORES    │        │
│  └───────────────┬───────────────┘   └───────────────┬────────────────┘        │
│                  │                                   │                          │
│                  │  StrategyResult                   │  DualStrategyResult      │
│                  │                                   │                          │
└──────────────────┼───────────────────────────────────┼──────────────────────────┘
                   │                                   │
                   │  ┌────────────────────────────────┘
                   │  │
                   ▼  ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                            驾驶舱展示层 (L4/L5)                                   │
│                                                                                 │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐              │
│  │ CoreResourcePanel│  │ HotSectorWidget  │  │ ValuePitWidget   │              │
│  │                  │  │                  │  │                  │              │
│  │ 展示:            │  │ 展示:            │  │ 展示:            │              │
│  │ • core-scarce    │  │ • HotSectorScore │  │ • ValuePitScore  │              │
│  │   组合持仓        │  │ • 五维雷达图     │  │ • 五维雷达图     │              │
│  │ • 再平衡计划      │  │ • 动作建议       │  │ • 轮动信号状态   │              │
│  │ • 偏离度监控      │  │ • 止盈止损线     │  │ • 动作建议       │              │
│  └──────────────────┘  └──────────────────┘  └──────────────────┘              │
│                                                                                 │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐              │
│  │ WatchlistWidget  │  │ ScoreRadar       │  │ TradingApp       │              │
│  │                  │  │                  │  │                  │              │
│  │ 展示:            │  │ 展示:            │  │ 展示:            │              │
│  │ • watchlist 标的  │  │ • 综合评分概览   │  │ • 交易信号       │              │
│  │ • 进入原因       │  │ • 分类分布       │  │ • 仓位建议       │              │
│  │ • 升级条件       │  │ • 得分趋势       │  │ • 风控状态       │              │
│  └──────────────────┘  └──────────────────┘  └──────────────────┘              │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### 2.2 策略评分持久化数据流

```
dualStrategyEngine.runDualStrategy()
  │
  ├── hotSectorAnalyzer.analyzeHotSectors()
  │     → HotSectorScore[]
  │     → DataBridge.forward(REFRESH_HOT_SECTOR_SCORES)
  │           → IndexedDB: hot_sector_scores Store
  │
  └── valuePitAnalyzer.analyzeValuePits()
        → ValuePitScore[]
        → rotationSignalDetector.detectBySector()
              → Signal[] (buy_rotation)
              → watchlistCandidates[]
        → DataBridge.forward(REFRESH_VALUE_PIT_SCORES)
              → IndexedDB: value_pit_scores Store
```

---

## 3. 事件流图

### 3.1 EventBus 发布/订阅关系

```
                          ┌──────────────────┐
                          │    EventBus       │
                          │  (L1 core)        │
                          └───┬──────┬───────┘
                              │      │
          ┌───────────────────┘      └───────────────────┐
          │                                               │
          ▼                                               ▼
  ┌──────────────────┐                          ┌──────────────────┐
  │ 数据层事件        │                          │ 策略层事件        │
  │                  │                          │                  │
  │ stocks:changed   │                          │ strategy:updated  │
  │ scores:updated   │                          │ signal:generated  │
  │ quotes:updated   │                          │ rotation:detected │
  │ signals:updated  │                          │ pool:transitioned │
  │ orders:updated   │                          │ scores:refreshed  │
  └────────┬─────────┘                          └────────┬─────────┘
           │                                             │
           ▼                                             ▼
  ┌────────────────────────────────────────────────────────────────┐
  │                        订阅者                                   │
  │                                                                │
  │  stocks:changed →                                                        │
  │    ├── StockPoolPage (刷新列表)                                          │
  │    ├── HotSectorWidget (更新热门板块标的)                                 │
  │    └── WatchlistWidget (更新观察仓列表)                                   │
  │                                                                          │
  │  scores:updated →                                                        │
  │    ├── ScoreRadar (刷新评分雷达)                                          │
  │    ├── CoreResourcePanel (更新组合评分)                                   │
  │    └── strategyEngine (触发重新分类)                                      │
  │                                                                          │
  │  strategy:updated →                                                      │
  │    ├── CoreResourcePanel (更新组合)                                       │
  │    ├── HotSectorWidget (更新热门评分)                                     │
  │    ├── ValuePitWidget (更新洼地评分)                                      │
  │    └── WatchlistWidget (更新观察仓)                                       │
  │                                                                          │
  │  signal:generated →                                                      │
  │    ├── TradingApp (显示交易建议)                                          │
  │    └── SignalMonitor (信号监控)                                          │
  │                                                                          │
  │  rotation:detected → trading hub                                                 │
  │    ├── ValuePitWidget (更新轮动状态)                                      │
  │    └── dualStrategyEngine (更新观察池候选)                                │
  │                                                                          │
  │  pool:transitioned →                                                     │
  │    ├── StockPoolPage (刷新池分布)                                         │
  │    └── WatchlistWidget (更新观察仓)                                       │
  └────────────────────────────────────────────────────────────────┘
```

### 3.2 策略执行事件时序

```
User Action (触发策略)
  │
  ▼
strategyEngine.runStrategy()
  │
  ├── [1] Promise.all: getCompositeScores + fetchMomentumMap + fetchTopHotSectors
  │
  ├── [2] classify() × N (四分类判定)
  │
  ├── [3] R2 低估值过滤
  │
  ├── [4] 综合分排序 Top13
  │
  ├── [5] emit('strategy:updated', StrategyResult)
  │
  ▼
dualStrategyEngine.runDualStrategy()
  │
  ├── [6] Promise.all: analyzeHotSectors + analyzeValuePits
  │
  ├── [7] rotationSignalDetector.detectBySector() × N
  │
  ├── [8] emit('scores:refreshed', DualStrategyResult)
  │
  ├── [9] emit('rotation:detected', signals[])
  │
  ▼
Widget 订阅者收到事件 → 重新渲染
```

---

## 4. 三梯队 + 双策略架构关系图

### 4.1 完整架构关系（ASCII Art）

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           V9 策略体系 — 三梯队 + 双策略                          │
│                                                                                 │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │                        四分类选股层 (strategyEngine)                      │   │
│  │                                                                         │   │
│  │   输入: Stock[]  ──────────────────────────────────────► 输出: 四分类     │   │
│  │                                                                         │   │
│  │   ┌────────────────────────────────────────────────────────────────┐   │   │
│  │   │  分类判定优先级 (从高到低)                                        │   │   │
│  │   │                                                                  │   │   │
│  │   │  ┌──────────────────────────────────────────────────────────┐   │   │   │
│  │   │  │ P1: core-scarce (第一梯队)                                │   │   │   │
│  │   │  │   条件: matchTheme() AND composite >= theme.minScore      │   │   │   │
│  │   │  │   配置: themeRegistry.ts                                  │   │   │   │
│  │   │  │   输出: 主题持仓组合 → CoreResourcePanel                   │   │   │   │
│  │   │  └──────────────────────────────────────────────────────────┘   │   │   │
│  │   │                          │ 未匹配                                │   │   │
│  │   │                          ▼                                       │   │   │
│  │   │  ┌──────────────────────────────────────────────────────────┐   │   │   │
│  │   │  │ P2: hot-momentum (第二梯队)                               │   │   │   │
│  │   │  │   条件: composite>=3.0 AND hotSector AND momentum>=5%     │   │   │   │
│  │   │  │   配置: strategyRules.ts                                  │   │   │   │
│  │   │  │   输出: 热门赛道候选 → HotSectorWidget                     │   │   │   │
│  │   │  └──────────────────────────────────────────────────────────┘   │   │   │
│  │   │                          │ 未匹配                                │   │   │
│  │   │                          ▼                                       │   │   │
│  │   │  ┌──────────────────────────────────────────────────────────┐   │   │   │
│  │   │  │ P3: value-bargain (第二梯队)                              │   │   │   │
│  │   │  │   条件: composite>=3.0 AND valuation>=4.0                 │   │   │   │
│  │   │  │   配置: strategyRules.ts                                  │   │   │   │
│  │   │  │   输出: 价值洼地候选 → ValuePitWidget                      │   │   │   │
│  │   │  └──────────────────────────────────────────────────────────┘   │   │   │
│  │   │                          │ 未匹配                                │   │   │
│  │   │                          ▼                                       │   │   │
│  │   │  ┌──────────────────────────────────────────────────────────┐   │   │   │
│  │   │  │ P4: watchlist (第三梯队)                                  │   │   │   │
│  │   │  │   条件: composite<2.8 OR 未匹配任何分类                    │   │   │   │
│  │   │  │          OR 20进13淘汰 OR R2低估值过滤                     │   │   │   │
│  │   │  │   配置: strategyRules.ts                                  │   │   │   │
│  │   │  │   输出: 观察仓列表 → WatchlistWidget                       │   │   │   │
│  │   │  └──────────────────────────────────────────────────────────┘   │   │   │
│  │   └────────────────────────────────────────────────────────────────┘   │   │
│  │                                                                         │   │
│  │   20进13筛选: 合并 P1+P2+P3 → R2低估值过滤 → 综合分排序 → Top13         │   │
│  └─────────────────────────────────────────────────────────────────────────┘   │
│                                         │                                        │
│                                         │ 四分类结果                              │
│                                         ▼                                        │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │                       双策略评分增强层 (dualStrategyEngine)               │   │
│  │                                                                         │   │
│  │   ┌─────────────────────────────┐   ┌─────────────────────────────┐    │   │
│  │   │ 热门板块评分                  │   │ 价值洼地评分                  │    │   │
│  │   │ hotSectorAnalyzer.ts         │   │ valuePitAnalyzer.ts          │    │   │
│  │   │                              │   │                              │    │   │
│  │   │  动量强度         35% █████  │   │  催化确定性       30% █████  │    │   │
│  │   │  情绪热度         25% ████   │   │  估值安全垫       25% ████   │    │   │
│  │   │  技术突破         20% ███    │   │  筹码结构         20% ███    │    │   │
│  │   │  估值风险         15% ██     │   │  轮动位置         15% ██     │    │   │
│  │   │  大盘环境          5% █      │   │  流动性           10% ██     │    │   │
│  │   │                              │   │                              │    │   │
│  │   │  动作规则:                    │   │  动作规则:                    │    │   │
│  │   │  >4.0 → 立即跟进 (5-8%)       │   │  >4.0 → 立即建仓 (5→10→15%) │    │   │
│  │   │  3.5-4.0 → 试探 (2-3%)       │   │  3.5-4.0 → 试探 (2-3%)      │    │   │
│  │   │  <3.5 → 不追                 │   │  3.0-3.5 → 等轮动信号        │    │   │
│  │   │                              │   │  <3.0 → 不建仓               │    │   │
│  │   │  止盈止损:                    │   │                              │    │   │
│  │   │  止损 -8% | 止盈 +15%卖50%   │   │  止盈止损:                    │    │   │
│  │   └──────────────┬──────────────┘   │  止损 -15% | 止盈 +20%卖30%  │    │   │
│  │                  │                  └──────────────┬──────────────┘    │   │
│  │                  │                                 │                    │   │
│  │                  │    ┌────────────────────────────┘                    │   │
│  │                  │    │                                                 │   │
│  │                  │    ▼                                                 │   │
│  │                  │  ┌─────────────────────────────┐                    │   │
│  │                  │  │ 轮动信号检测                  │                    │   │
│  │                  │  │ rotationSignalDetector.ts    │                    │   │
│  │                  │  │                              │                    │   │
│  │                  │  │ 条件1: 量比 >= 1.5           │                    │   │
│  │                  │  │ 条件2: 资金连续净流入 >= 2天  │                    │   │
│  │                  │  │ 条件3: priceToMA20 >= 3%     │                    │   │
│  │                  │  │                              │                    │   │
│  │                  │  │ 三条件全满足 → buy_rotation   │                    │   │
│  │                  │  │ 未满足 → watchlistCandidates  │                    │   │
│  │                  │  └─────────────────────────────┘                    │   │
│  │                  │                                                     │   │
│  └──────────────────┼─────────────────────────────────────────────────────┘   │
│                     │                                                          │
│                     ▼                                                          │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │                          输出: DualStrategyResult                        │   │
│  │                                                                         │   │
│  │  hotSectorScores[]  ──────► HotSectorWidget  ──────► 驾驶舱展示          │   │
│  │  valuePitScores[]   ──────► ValuePitWidget   ──────► 驾驶舱展示          │   │
│  │  signals[]          ──────► TradingApp       ──────► 交易执行            │   │
│  │  watchlistCandidates[] ───► WatchlistWidget  ──────► 驾驶舱展示          │   │
│  └─────────────────────────────────────────────────────────────────────────┘   │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### 4.2 三梯队流转状态机

```
                    ┌──────────────┐
                    │  标的入库     │
                    │  (INSERT)    │
                    └──────┬───────┘
                           │
                           ▼
              ┌────────────────────────┐
              │   四分类判定            │
              │   strategyEngine       │
              └───┬───────┬───────┬────┘
                  │       │       │
         ┌────────┘       │       └────────┐
         ▼                ▼                ▼
┌─────────────────┐ ┌──────────────┐ ┌──────────────┐
│ 第一梯队         │ │ 第二梯队      │ │ 第三梯队      │
│ core-scarce     │ │ hot-momentum │ │ watchlist    │
│                 │ │ value-bargain│ │              │
│ 长期持有         │ │ 战术交易      │ │ 持续跟踪      │
│ 主题驱动         │ │ 动量/估值    │ │ 等待触发      │
│ 6-12月持有       │ │ 3-15天/6-12月│ │ 无固定期限    │
└────────┬────────┘ └──────┬───────┘ └──────┬───────┘
         │                 │                │
         │  综合分跌破      │  动量/估值恶化   │  评分提升/信号触发
         │  主题门槛        │                │
         │                 │                │
         ▼                 ▼                │
    ┌────────────────────────────────────────┘
    │   降级
    ▼
┌──────────────┐     评分提升 + 条件满足     ┌─────────────────────┐
│  watchlist    │ ──────────────────────────►│ 第二梯队 (升级)       │
│  (降级)       │                            │ hot-momentum /       │
│              │ ◄────────────────────────── │ value-bargain        │
└──────────────┘     条件恶化 (降级)          └─────────────────────┘
```

### 4.3 策略配置与代码文件映射

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        配置层 (src/config/)                              │
│                                                                         │
│  strategyConfig.ts  ──── 统一入口 (re-export 所有策略配置)               │
│       │                                                                 │
│       ├── strategyRules.ts  ──── 四分类阈值 (compositeMin, watchlistV6Max, │
│       │                          valueBargainValuationMin, selectedMaxCount...) │
│       │                                                                 │
│       ├── dualStrategyRules.ts ─ 双策略阈值 (hotSectorImmediateThreshold, │
│       │                          valuePitStopLossPct, rotationVolumeSurgeRatio...) │
│       │                                                                 │
│       ├── rotationConfig.ts  ─── 轮动五因子 (景气40%/资金25%/估值15%/     │
│       │                          β12%/量能8%)                           │
│       │                                                                 │
│       └── tradingConfig.ts   ─── 交易风控 (信号阈值/Kelly参数/仓位上限)   │
│                                                                         │
├─────────────────────────────────────────────────────────────────────────┤
│                        引擎层 (src/services/)                            │
│                                                                         │
│  src/services/trading/                                                  │
│       ├── strategyEngine.ts        ──── 四分类选股引擎                   │
│       ├── dualStrategyEngine.ts    ──── 双策略编排引擎                   │
│       ├── scoringAdapter.ts        ──── 评分聚合适配器                   │
│       ├── portfolioBuilder.ts      ──── 组合构建器                      │
│       ├── signalGenerator.ts       ──── 交易信号生成                    │
│       ├── positionSizer.ts         ──── 仓位计算                        │
│       └── riskEngine.ts            ──── 风控引擎                        │
│                                                                         │
│  src/services/scoring/                                                  │
│       ├── hotSectorAnalyzer.ts     ──── 热门板块五维评分                  │
│       ├── valuePitAnalyzer.ts      ──── 价值洼地五维评分                  │
│       └── rotationSignalDetector.ts ─── 轮动信号检测                    │
│                                                                         │
├─────────────────────────────────────────────────────────────────────────┤
│                        展示层 (src/cockpit/ / src/apps/)                  │
│                                                                         │
│  src/cockpit/widgets/                                                   │
│       ├── HotSectorWidget.tsx       ──── 热门板块评分展示                │
│       ├── ValuePitWidget.tsx        ──── 价值洼地评分展示                │
│       └── WatchlistWidget.tsx       ──── 观察仓展示 (待建)               │
│                                                                         │
│  src/apps/trading/                                                      │
│       ├── TradingApp.tsx            ──── 交易主面板                      │
│       └── components/CoreResourcePanel.tsx ── 核心稀缺组合面板           │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 5. 架构约束

### 5.1 调用方向铁律

```
L5 (展示层)  ──调用──►  L4 (应用层)  ──调用──►  L3 (引擎层)  ──调用──►  L2 (数据层)
                                                                          │
L3 写操作 ──必须经过──►  DataBridge.forward(StandardEnvelope)  ──►  L2 IndexedDB
L5/L4 ──禁止直接写──►  dataLayer (必须通过 L3 服务层)
L1 (配置层) ──禁止依赖──►  L3/L4/L5 (只能被上层依赖)
```

### 5.2 策略模块特殊约束

| 约束 | 说明 |
|------|------|
| 配置层禁止依赖引擎层 | `strategyRules.ts` / `dualStrategyRules.ts` 不 import `services/` 任何文件 |
| 引擎层禁止硬编码阈值 | 所有阈值从 `src/config/` 读取，不得在引擎文件中直接写死数值 |
| 数据写操作走 DataBridge | 策略引擎的评分持久化、信号写入均通过 `DataBridge.forward()` |
| 四分类与双策略解耦 | `strategyEngine.ts` 和 `dualStrategyEngine.ts` 可独立运行，互不依赖 |
| 研究体系不依赖交易层 | 删除 `src/services/trading/` 后，输入舱/分析舱功能完整运行 |

---

## 6. 相关文档

- [选股策略总文档](../../normal/explanation/stock-selection-strategy.md)
- [核心稀缺资源策略](../../normal/core-scarce-strategy.md)
- [热门赛道策略](../../normal/hot-momentum-strategy.md)
- [价值洼地策略](../../normal/value-bargain-strategy.md)
- [观察仓策略](../../normal/watchlist-strategy.md)
- [ADR-008: 第四次工业革命稀缺核心资源策略](../../drafts/date-prefix/2026-06-24-adopt-v6-core-resource-trading-strategy.md)
- [ADR-009: 双策略体系](../../drafts/date-prefix/2026-06-27-dual-strategy-system.md)
- [架构标准](../explanation/03-architecture-standards.md)
- [引擎规格](../../../explanation/05-engine-specs.md)
- [双策略数据流规格](../../../explanation/design/dual-strategy-dataflow-spec.md)