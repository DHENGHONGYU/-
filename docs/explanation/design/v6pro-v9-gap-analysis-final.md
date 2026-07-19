---
title: V6 Pro �?V9 架构差异分析报告（最终版�?tier: important
type: explanation
domain: project
phase: design
status: active
maintainer: V9 Architecture Team
summary: "V9 额外新增5�?Widget（InvestmentProfile/StockPool/KaiScore/ModelCompare/StockChat），不在 V6 Pro 规格中，保留�?
tags: [project, gap-analysis, architecture, analysis]
version: v2.1.0
last_updated: 2026-07-02
code_version: 2.0.0
doc_id: V9-DOC-PROJ-053
---

# V6 Pro �?V9 架构差异分析报告

> 审计基准：`../v6pro-to-v9-migration-analysis.md`、`../trading-core-factors.md`、`v6pro_architecture_v3.png`
> 审计范围：V9 `src/` 全部代码、`tests/`、`docs/`、`cockpit/`
> 审计日期�?026-06-27

---

## 第一部分：差异总表

### 1.1 策略引擎�?(V6 Engine / AI Engine)

| 模块 | V6 Pro 规格 | V9 现状 | 严重�?| 决策 |
|------|------------|---------|--------|------|
| V6个股分析引擎 L0-L8 | 九层漏斗（STEEP/护城�?竞品/财务/估�?情景/T+0/Hype/第二曲线/筹码），llmClient.ts 1281�?| **完全缺失**。V9�?v6ScoreService.ts(176�?�?因子自动评分 | 🔴 P0 | **纳入阶段7补充** |
| V4行业分析 SKILL-D | 四种SKILL模型(N/C/A/D) | SKILL-D **缺失**，仅N/C/A三种 | 🔴 P0 | **纳入阶段3** |
| sectorSkillData.ts | 884�?| 746�?-138行，16%差距) | 🟡 P1 | 阶段3补充 |
| 五因子权�?| 景气40%/资金25%/估�?5%/β12%/量能8% | 景气40%/资金**30%**/估�?5%/β**10%**/量能**5%** | 🔴 P0 | **纳入阶段2修正** |
| 市场风格周期过滤�?| 运行时过�?| 配置已定义但**未接入运行时** | 🟡 P1 | 纳入阶段3 |
| 成交量检测逻辑 | 成交量�?.5 | 20%历史分位突破 | 🟡 P1 | 纳入阶段3统一 |
| 策略分类体系 | 四分�?core-scarce/value-bargain/hot-momentum/excluded) | excluded�?*watchlist** 已修�?| �?已对�?| �?|
| 策略配置�?| strategyRules.ts | strategyRules.ts + dualStrategyRules.ts 并存 | 🟡 P1 | 纳入阶段2统一 |
| v6ScoreService 架构 | 走DataBridge | 直接调用dataLayer | 🔴 P0 | **纳入阶段10修正** |

### 1.2 交易复盘系统 (Trade Review)

| 模块 | V6 Pro 规格 | V9 现状 | 严重�?| 决策 |
|------|------------|---------|--------|------|
| TradeErrorClassifier | 12类错误检测，~420�?| **完全缺失** | 🔴 P0 | **纳入阶段7补充** |
| TradeReviewAI | 六维复盘报告，~380�?| **完全缺失** | 🔴 P0 | **纳入阶段7补充** |
| 纪律评分公式 | 100-critical×15-major×8-minor×3 | **完全缺失** | 🔴 P0 | 纳入阶段7 |
| 心理画像 | 6种画�?追涨/恐盈/扛单/情绪�?激�?冲动) | **完全缺失** | 🔴 P0 | 纳入阶段7 |
| 订单Schema扩展 | 9个复盘扩展字�?| Order类型�?个基础字段 | 🔴 P0 | **纳入阶段9修正** |
| AITradeReviewWidget | 消费真实复盘数据 | 仅UI骨架，渲染Mock数据 | 🟡 P1 | 纳入阶段8接入 |
| 测试文件 | 29项测�?| 0�?| 🔴 P0 | 纳入阶段11 |

### 1.3 驾驶�?Widget �?
| 分类 | V6 Pro 规格 | V9 已实�?| 缺失 | 状�?|
|------|------------|---------|------|------|
| 市场全景(5) | IndexMonitor/SectorHeatmap/FundFlow/MarketEmotion/Watchlist | 5/5 | 0 | �?全覆�?|
| 持仓交易(5) | PortfolioSummary/PnLAnalysis/PositionControl/RiskMonitor/AI交易复盘 | 2/5 | PnLAnalysis/PositionControl/RiskMonitor | **缺失3�?* |
| 选股策略(4) | SignalMonitor/ScoreRadar/StockScreener/Backtest | 0/4 | 全部缺失 | **缺失4�?* |
| 智能�?4) | AgentStatus/TaskQueue/HealthDashboard/LogStream | 0/4 | 全部缺失 | **缺失4�?* |
| 待开�?2) | HotSectorWidget/ValuePitWidget | 2/2 | 0 | �?已实�?|
| **合计** | **18** | **9** | **11** | **50%** |

V9 额外新增5�?Widget（InvestmentProfile/StockPool/KaiScore/ModelCompare/StockChat），不在 V6 Pro 规格中，保留�?
### 1.4 数据通道�?
| 通道 | V6 Pro 规格 | V9 现状 | 状�?|
|------|------------|---------|------|
| market:index | 3s | 5s | �?频率偏差 |
| market:sectors | 10s | 10s | �?|
| market:fundflow | 30s | 15s | �?频率偏差 |
| portfolio:summary | 事件驱动 | 10s轮询 | 🟡 模式不同 |
| portfolio:risk | 1min | **缺失** | **缺失** |
| strategy:signals | 事件驱动 | 5s轮询 | 🟡 模式不同 |
| agent:status | 5s | 10s | �?频率偏差 |
| agent:logs | 实时 | **缺失** | **缺失** |

V9 额外新增4条通道（market:emotion/portfolio:holding/strategy:score/system:health），保留�?
### 1.5 基础设施�?
| 模块 | V6 Pro 规格 | V9 现状 | 严重�?|
|------|------------|---------|--------|
| 框架引擎(5) | WidgetRegistry/WidgetEngine/DataFlowEngine/EventBus/GridLayout | 5/5 �?| �?|
| IndexedDB | 17个Store | 24个Store �?| �?|
| 独立Memory Cache | 统一TTL/容量/LRU | 散布在DataFlowEngine/WidgetEngine�?| 🟡 P1 |
| localStorage统一封装 | LocalStorageManager | 散落在CockpitShell/newsStore�?| 🟡 P1 |
| 数据融合�?| UnifiedStockData | **完全缺失** | 🟡 P1 |
| 八维数据架构 | 01基础~08研报 | dataDimensions.ts 完整定义 �?| �?|

---

## 第二部分：最终策略对齐定�?
### 2.1 策略分类体系（四分类�?
| 英文�?| 中文�?| 定义 | 触发条件 |
|--------|--------|------|---------|
| **core-scarce** | 核心稀缺资�?| 第四次工业革命稀缺核心资�?| 匹配主题 + V6综合�?�?主题门槛 |
| **hot-momentum** | 热门赛道 | 热门板块动量追涨 | sector热门TOP5 + 动量�?.05 + 综合分≥3.0 |
| **value-bargain** | 价值洼�?| 估值偏�?综合分适中 | 估值分�?.0 + 综合分≥3.0 |
| **watchlist** | 观察�?| 暂不参与交易，持续跟�?| 综合�?2.8 或未匹配以上分类 |

### 2.2 三梯队结�?
```
第一梯队（优先锁定）：core-scarce（核心稀缺资源）
第二梯队（并列）�?   hot-momentum（热门赛道）+ value-bargain（价值洼地）
第三梯队（跟踪）�?   watchlist（观察仓�?```

### 2.3 双策略评分增�?
| 策略 | 五维权重 | 核心文件 |
|------|---------|---------|
| HotSector 热门板块 | 动量35% / 情绪25% / 技�?0% / 估�?5% / 大盘5% | hotSectorAnalyzer.ts |
| ValuePit 价值洼�?| 催化30% / 估�?5% / 筹码20% / 轮动15% / 流动�?0% | valuePitAnalyzer.ts |

双策略评分作为四分类之上�?*上层评分增强**，与分类并行但不替代�?
### 2.4 板块轮动五因子权重（修正后）

| 因子 | V6 Pro 规格 | 修正�?|
|------|------------|--------|
| 景气因子(F1) | 40% | 40% |
| 资金因子(F2) | 25% | **25%**（从30%修正�?|
| 估值因�?F3) | 15% | 15% |
| β+相关系数(F4) | 12% | **12%**（从10%修正�?|
| 量能因子(F5) | 8% | **8%**（从5%修正�?|

---

## 第三部分：补充到12阶段计划的新增任�?
基于以上差异分析，在原有12阶段基础上新增以下任务：

| 新增编号 | 所属阶�?| 任务 | 严重�?|
|----------|---------|------|--------|
| N01 | 阶段3 | SKILL-D 行业分析模型实现 | 🔴 |
| N02 | 阶段3 | sectorSkillData.ts 补齐�?84�?| 🟡 |
| N03 | 阶段3 | 市场风格周期过滤器运行时接入 | 🟡 |
| N04 | 阶段3 | 成交量检测统一�?.5倍量�?| 🟡 |
| N05 | 阶段2 | 五因子权重修�?30�?5/10�?2/5�?) | 🔴 |
| N06 | 阶段7 | V6个股分析引擎L0-L8九层漏斗实现 | 🔴 |
| N07 | 阶段7 | TradeErrorClassifier 12类错误检�?| 🔴 |
| N08 | 阶段7 | TradeReviewAI 六维复盘报告 | 🔴 |
| N09 | 阶段7 | 纪律评分+心理画像 | 🔴 |
| N10 | 阶段9 | Order类型扩展9个复盘字�?| 🔴 |
| N11 | 阶段8 | 11个缺失Widget实现（PnLAnalysis等） | 🔴 |
| N12 | 阶段4 | portfolio:risk + agent:logs 通道新增 | 🔴 |
| N13 | 阶段4 | 通道模式从轮询改为事件驱�?| 🟡 |
| N14 | 阶段10 | 独立Memory Cache模块 | 🟡 |
| N15 | 阶段10 | localStorage统一封装 | 🟡 |
| N16 | 阶段10 | 数据融合�?UnifiedStockData | 🟡 |
| N17 | 阶段11 | TradeErrorClassifier + TradeReviewAI 29项测�?| 🔴 |

---

## 第四部分：确认结�?
**当前V9实现覆盖�?*�?- 双策略核心引擎：95%（权重一致，外部数据字段待补�?- 策略分类体系：已按四分类+watchlist修正
- 驾驶舱Widget�?0%�?/18，全部市场全�?2个待开发已实现�?- 框架引擎�?00%
- 交易执行层：100%（核心模块，另扩�?个）
- 数据通道�?5%�?/8，缺�?个）
- 交易复盘系统�?*~5%**（仅UI骨架�?- V6个股分析引擎L0-L8�?*0%**
- 基础设施：基本完整，缺统一封装�?
**V6 Pro 三份参考文档与V9�?8个差异点已全部识别，补充�?7个新增任务，纳入12阶段执行计划�?*