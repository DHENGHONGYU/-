---
title: V9 双策略体系与数据流架构规格（用户输入版待校对）
version: v0.1.0-proposal
last_updated: 2026-06-27
maintainer: V9 Architecture Team
status: proposal
change_log:
  - date: 2026-06-27
    author: Kimi Code CLI
    desc: 依据用户输入整理双策略（热门板块/价值洼地）数据流与策略规格，待与现有项目架构校对后进入 ADR 流程
---

# V9 双策略体系与数据流架构规格

> **Status**: Proposal / 待校对  
> **Version**: v0.1.0-proposal  
> **Last Updated**: 2026-06-27  
>  
> 本文档按用户给定开发策略整理，尚未经过架构评审，未与当前代码对齐。  
> 校对目标：`docs/03-architecture-standards.md`、`docs/implementation/v9-system-blueprint.md`、  
> `src/services/trading/strategyEngine.ts`、`src/core/dataflow/`、`src/cockpit/`。

---

## 1. 数据流架构

### 1.1 核心数据流

系统数据流遵循 **"从下到上采集、从上到下决策"** 原则：

```text
外部API层 (腾讯/东财/新浪/LLM)
    ↓ 实时/批量抓取
数据源适配器层 (GBK解码/JSONP/字段映射)
    ↓ 清洗标准化
七维数据存储 (IndexedDB/Memory Cache)
    ↓ 订阅分发
策略引擎层 (V6/V4/轮动)
    ↓ 评分计算
双策略评分输出 (HotSectorScore/ValuePitScore)
    ↓ 信号触发
驾驶舱展示层 (18 Widget实时刷新)
    ↓ 用户决策
交易执行层 (建仓/止盈/止损)
```

### 1.2 驾驶舱数据流

驾驶舱内部数据流由 `DataFlowEngine` 管理，采用发布-订阅模式：

| 数据通道 | 更新频率 | 数据源 | 订阅 Widget |
|---|---|---|---|
| `market:index` | 3 秒 | 腾讯 API | IndexMonitor, MarketEmotion |
| `market:sectors` | 10 秒 | 腾讯 API + 计算 | SectorHeatmap, Watchlist |
| `market:fundflow` | 30 秒 | 东财 API | FundFlow |
| `portfolio:summary` | 事件驱动 | IndexedDB | PortfolioSummary, PnLAnalysis |
| `portfolio:risk` | 1 分钟 | 计算引擎 | RiskMonitor |
| `strategy:signals` | 事件驱动 | 策略引擎 | SignalMonitor, ScoreRadar |
| `agent:status` | 5 秒 | Agent 系统 | AgentStatus, HealthDashboard |
| `agent:logs` | 实时 | Agent 系统 | LogStream |

---

## 2. 双策略体系在架构中的位置

双策略体系贯穿 **业务核心层、策略引擎层、驾驶舱展示层**，是 V6 Pro v3.0 的核心创新。

### 2.1 策略数据流

```text
用户输入: 意向股票清单 + 市场热点
                ↓
    ┌─────────────────────────────┐
    ↓                             ↓
【热门板块路径】               【价值洼地方径】
    ↓                             ↓
V6 个股评分(V6 引擎)           V6 个股评分(V6 引擎)
    ↓                             ↓
>3.5 分? 是→继续              2.8~3.5 分? 是→继续
    ↓                             ↓
动量/情绪/技术/估值           催化/估值/筹码/轮动/流动性
五维度评分(热门引擎)          五维度评分(洼地引擎)
    ↓                             ↓
HotSectorScore [0-5]        ValuePitScore [0-5]
    ↓                             ↓
>4.0→立即跟进               >4.0→立即建仓
3.5-4.0→试探                3.5-4.0→试探
<3.5→不追                   3.0-3.5→等轮动信号
                              ↓
                        轮动信号检测引擎
                        (成交量+资金+技术金叉)
                              ↓
                        信号触发→建仓
                              ↓
                        未触发→加入观察池
```

### 2.2 关键区别

| 对比维度 | 热门板块策略 | 价值洼地策略 |
|---|---|---|
| 核心逻辑 | 板块已在动，跟着趋势走 | 等板块开始动了再进 |
| 投资风格 | 追热点，赚快钱 | 等轮动，赚慢钱 |
| 股票特征 | 高估值、高收益、涨幅快、高风险 | 低估值、未启动、有催化剂、筹码集中 |
| 持有期 | 3–15 天（平均 7 天） | 6–12 个月 |
| 止损线 | -8% 硬性止损，不补仓 | -15%，分步建仓 |
| 止盈线 | +15% 卖 50%，快进快出 | +20% 卖 30% 逐步退出 |
| 分析引擎 | HotSectorAnalyzer | ValuePitAnalyzer + RotationSignal |
| 驾驶舱 Widget | HotSectorWidget（P0 待开发） | ValuePitWidget（P0 待开发） |
| 风险控制 | 大盘跌 10% → 个股跌 20-30% | 提前进去 → 跌 20-30% |

---

## 3. 阈值与动作规则

### 3.1 热门板块路径

| 条件 | 动作 |
|---|---|
| V6 个股评分 > 3.5 | 进入热门五维评分 |
| HotSectorScore > 4.0 | 立即跟进 |
| 3.5 ≤ HotSectorScore ≤ 4.0 | 试探性跟进 |
| HotSectorScore < 3.5 | 不追 |

### 3.2 价值洼地方径

| 条件 | 动作 |
|---|---|
| V6 个股评分 2.8–3.5 | 进入洼地五维评分 |
| ValuePitScore > 4.0 | 立即建仓 |
| 3.5 ≤ ValuePitScore ≤ 4.0 | 试探性建仓 |
| 3.0 ≤ ValuePitScore < 3.5 | 等待轮动信号 |
| ValuePitScore < 3.0 | 不建仓 |

### 3.3 轮动信号检测

触发建仓位轮动信号需同时满足：

- 成交量显著放大（如近 5 日均量 / 近 20 日均量 ≥ 1.5）
- 资金净流入（主力或北向连续 N 日净流入）
- 技术指标金叉（如 MACD 金叉或价格站上 MA20/MA60）

未触发则加入观察池，持续跟踪。

---

## 4. 与现有系统的待对齐项

> 以下内容为整理阶段记录的与现有代码/文档的潜在差异点，详细差异分析见独立校对报告。

- 当前 `src/services/trading/strategyEngine.ts` 已实现 `core-scarce / value-bargain / hot-momentum / excluded` 四分类，但与本规格中的 `HotSectorScore / ValuePitScore` 双评分输出、轮动信号检测引擎尚未对齐。
- 当前 `src/core/dataflow/dataflowEngine.ts` 已内置 `market:index / market:sector / market:fundflow / strategy:signal` 等通道，但与本规格中的更新频率、订阅 Widget 映射存在差异。
- 当前 `src/cockpit/widgets/` 共 12 个 Widget，缺少本规格要求的 `HotSectorWidget`、`ValuePitWidget`、`IndexMonitor`、`RiskMonitor`、`AgentStatus`、`HealthDashboard`、`LogStream` 等。
- 当前 `src/config/strategyRules.ts` 阈值（`compositeMin: 3.6`、`valueBargainCompositeMin: 3.6`、`valueBargainValuationMin: 4.0`）与本规格阈值（热门 3.5/4.0、洼地 2.8–3.5/4.0）不一致。

---

## 5. 下一步建议

1. 由架构评审会确认是否以本规格替换/扩展当前 `strategyEngine.ts` 的策略分类。
2. 若采纳，按 `docs/implementation/implementation-governance.md` 创建 ADR，状态从 `Proposal` 推进到 `Accepted`。
3. 更新 `src/config/strategyRules.ts` 或新增 `src/config/dualStrategyRules.ts` 以承载双策略阈值。
4. 在 `src/services/trading/` 中新增 `hotSectorAnalyzer.ts`、`valuePitAnalyzer.ts`、`rotationSignalDetector.ts`。
5. 在 `src/cockpit/widgets/` 中新增 `HotSectorWidget.tsx`、`ValuePitWidget.tsx`。
6. 同步更新 `docs/03-architecture-standards.md`、`docs/05-engine-specs.md`、`docs/10-glossary.md`。
