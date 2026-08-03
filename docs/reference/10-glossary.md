---
title: 10. 领域词汇表
type: explanation
domain: project
phase: planning
tier: standard
status: active
maintainer: V9 Architecture Team
summary: "原则：所有概念在代码、UI、文档中必须使用本表规范命名。旧命名逐步迁移清零。"
tags: [project, plan, reference]
version: v1.0.0
last_updated: 2026-07-17
code_version: 2.0.0
doc_id: V9-DOC-PROJ-313
referenced_by: [V9-DOC-PROJ-174, V9-DOC-META-000, V9-DOC-PROJ-176, V9-DOC-PROJ-149, V9-DOC-DATA-024]
change_log:
  - version: v1.0.0
changes: Initial version established
date: 2026-07-17
---

# 10. 领域词汇表

> **Status**: Current  
> **Version**: v2.7.0  
> **Last Updated**: 2026-07-15
>
> **原则**：所有概念在代码、UI、文档中必须使用本表规范命名。旧命名逐步迁移清零。

## 10.1 股票池体系（核心定义）

V9 采用**单表多状态**模型：所有标的统一存储在 `stocks` Store，通过 `researchStatus` 字段区分所处阶段。

研究池链路为严格的五态单向流：

```
意向候选池 → 研究精选池 → 深度研究池 → 观察池 → 归档池
```

| 中文名 | 英文名 | `researchStatus` | 定义 | 进入条件 | 流出动作 |
|--------|--------|------------------|------|----------|----------|
| **意向候选池** | Intention Pool / Candidate Pool | `candidate` | 初步感兴趣的标的，刚录入或采集 | 手动录入、CSV 导入、AKShare 采集 | 完成基础筛选 → 研究精选池 |
| **研究精选池** | Research Picks / Screened Pool | `screened` | 通过初步筛选，进入正式研究的标的 | 从候选池筛选后推送 | 完成深度研究 → 深度研究池 |
| **深度研究池** | Deep Dive Pool | `deepDive` | 已完成深度分析，等待决策的标的 | 从研究精选池推送 | 决定跟踪 → 观察池；不符合 → 归档池 |
| **观察池** | Watchlist / Watching Pool | `watching` | 已决定跟踪，等待买点或持续观察 | 从深度研究池推送 | 不再跟踪 → 归档池 |
| **归档池** | Archive Pool | `archived` | 已淘汰、已卖出或不再关注的标的 | 从任意研究池主动归档 | 重新激活 → 意向候选池 |

### 池间流转规则

```
                    ┌─────────────┐
         ┌─────────│  意向候选池  │←──────── 录入/采集
         │         │  candidate  │
         │         └──────┬──────┘
         │                │ 基础筛选
         │         ┌──────▼──────┐
         │         │  研究精选池  │
         │         │  screened   │
         │         └──────┬──────┘
         │                │ 深度研究
         │         ┌──────▼──────┐
         │         │  深度研究池  │
         │         │  deepDive   │
         │         └──────┬──────┘
         │                │ 决定跟踪
   重新激活 │         ┌──────▼──────┐
   (任意池) │         │    观察池    │────── 不再跟踪 ────┐
            │         │   watching  │                     │
            │         └──────┬──────┘                     │
            │                │                            │
            └────────────────┴────────────────────────────┘
                             │
                      ┌──────▼──────┐
                      │    归档池    │
                      │   archived  │
                      └─────────────┘
```

### 重要澄清

- **研究池只有五态**，对应 `ResearchStatus`：`candidate → screened → deepDive → watching → archived`。
- **交易持仓不属于研究池**，也不写入 `stocks.researchStatus`，它由独立的 `orders` / `positions` Store 管理（见 10.1.2）。
- **不再有独立的 `intention_pool` / `screener_pool` / `watchlist` 表或 localStorage key**。
- 所有研究池的查询统一为：`db.getAllByIndex('stocks', 'by-status', status)`。
- UI 层通过 `StockPoolBoardPage`（`/analysis/stock-pool`）承载 `PoolBoard` / `PoolColumn`，按 `researchStatus` 渲染不同研究池。输入舱侧栏保留跳转入口。

## 10.1.2 交易持仓（独立管理）

| 中文名 | 英文名 | 存储位置 | 定义 | 与观察池的关系 |
|--------|--------|----------|------|----------------|
| **交易持仓池** | Trade Holdings | `orders` Store | 已执行模拟/真实交易的持仓记录 | 由观察池触发买入后生成，卖出后可选择归档研究池或保持观察 |

- 交易舱（`TradingApp`）负责信号生成、下单、持仓管理。
- 交易持仓的增删改查不走股票池流转引擎，而走交易服务（`src/services/trading/*`）。

## 10.2 核心概念

| 中文 | 英文 | 说明 |
|------|------|------|
| 标的 | Stock / Symbol | 股票基础实体，以 `symbol` 为主键 |
| V6 九维评分 | V6 Score | `v6_scores` Store，综合评分 0-5 |
| 板块轮动 | Sector Rotation | `industry_scores` Store（当前）；`rotation_scores` Store（规划中，P2） |
| 模拟盘 | Paper Trading | `accountType: "paper"` |
| 真实交易 | Real Trading | `accountType: "real"`（占位） |
| 五舱 | Five Cabins | input / analysis / trading / output / command |
| 驾驶舱 | Cockpit | 系统监控 Widget  Dashboard |
| 资金配置 | Capital Allocation | 核心长期/热点短线/推荐个股/现金比例 |

## 10.3 路由词汇

| 路径 | 中文 |
|------|------|
| `/` | 首页 |
| `/input` | 输入舱 |
| `/analysis` | 分析舱 |
| `/trading` | 交易舱 |
| `/output` | 输出舱 |
| `/command` | 总控舱 |
| `/cockpit` | 驾驶舱 |
| `/analysis/stock-score` | 个股评分 |
| `/analysis/sector` | 行业分析 |
| `/analysis/backtest` | 策略回测 |

## 10.4 交易与复盘术语

| 中文 | 英文 | 说明 |
|------|------|------|
| 择时信号 | Timing Signal | SignalGenerator 输出的 buy/sell/hold/watch 信号 |
| 安全边际买入 | buy_safety_margin | PE<25%分位 且 PB<20%分位时触发 |
| 回调买入 | buy_dip | 价格<MA20 8% 且 RSI<30 时触发 |
| 突破买入 | buy_pivot | 突破阻力+放量+MACD红柱时触发 |
| 事件驱动买入 | buy_breakout | 业绩超预期>20%时触发 |
| 固定止损 | sell_stop_loss | 跌破计划止损线 7% 时触发 |
| 移动止损 | sell_trailing_stop | 从最高点回撤 10% 时触发 |
| 止盈信号 | sell_profit_taking | 价格>MA20 15% 且 RSI>70 时触发 |
| Kelly 公式 | Kelly Criterion | $f^* = (bp - q) / b$，默认 1/4 Kelly |
| 金字塔加仓 | Pyramid Positioning | 正金字塔/倒金字塔分批建仓策略 |
| 赫芬达尔指数 | HHI | 组合集中度指标，>20% 预警 |
| MAE | Maximum Adverse Excursion | 最大不利偏移，评估入场质量 |
| 利润捕捉率 | Profit Capture Rate | 实际盈利 / 最大浮盈 |
| 计划遵守率 | Plan Adherence Rate | 遵守交易计划的订单占比 |
| 止损执行率 | Stop Loss Execution Rate | 实际执行止损的订单占比 |
| 纪律评分 | Discipline Score | 100 - critical×15 - major×8 - minor×3 |
| 心理画像 | Trader Profile | 基于主导错误生成的交易者类型标签 |
| 数据新鲜度 | Data Freshness | 数据时间戳到当前时间的差值，>48h 标记 stale |
| 主题投资组合 | Theme Portfolio | 按特定主题（如“第四次工业革命稀缺核心资源”）筛选并加权构建的持仓组合 |
| 核心稀缺资源 | Core Scarce Resource | 第四次工业革命中的关键稀缺要素：AI 算力、半导体、数据资产、通信网络、机器视觉等 |
| 综合评分视图 | Composite Score View | scoringAdapter 聚合 V6/智能/行业评分后的统一视图 |
| 再平衡计划 | Rebalance Plan | 对比目标权重与当前持仓后生成的买入/卖出/持有动作列表 |
| 主题注册表 | Theme Registry | `src/config/themeRegistry.ts`，集中管理主题定义与股票映射规则 |

## 10.5 数据字段

### Stock

| 字段 | 类型 | 说明 |
|------|------|------|
| `symbol` | `string` | 主键，如 `600519.SH` |
| `name` | `string` | 股票名称 |
| `price` | `number?` | 当前价格 |
| `researchStatus` | `ResearchStatus` | 所处研究阶段 |
| `source` | `DataSource` | 数据来源 |
| `dataVersion` | `number` | 数据版本 |
| `dataQuality` | `object` | 数据质量 `{ basic, kline, finance, lastChecked? }`，详见 `03-architecture-standards.md` §3.7.2 |
| `industryCode` | `string?` | 行业代码，用于主题映射与组合集中度控制 |
| `theme` | `string[]?` | 主题标签，一只股票可同时属于多个主题 |
| `sector` | `string?` | 板块/Sector 名称，用于展示与行业评分匹配 |
| `group` | `string?` | 股票池默认分组，用于 `by-group` 索引与分组展示；未指定时归为 `default` |
| `ingestedAt` | `number` | 入库时间 |
| `updatedAt` | `number` | 更新时间 |

### V6Score

| 字段 | 类型 | 说明 |
|------|------|------|
| `symbol` | `string` | 主键 |
| `score` | `number` | 综合评分 |
| `factors` | `Record<string, number>` | 九维因子得分 |
| `calculatedAt` | `number` | 计算时间 |
| `dataVersion` | `number` | 关联 stocks.dataVersion |

### Watchlists

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | `string` | 主键 |
| `name` | `string` | 观察列表名称 |
| `symbols` | `string[]` | 标的 symbol 列表 |
| `createdAt` / `updatedAt` | `number` | 创建/更新时间 |

> `watchlists` Store 用于保存用户自定义观察列表，与 `stocks` 的 `watching` 研究状态解耦。

### Order

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | `string` | 主键 |
| `symbol` | `string` | 标的 |
| `direction` | `OrderDirection` | buy / sell |
| `quantity` | `number` | 数量 |
| `price` | `number` | 价格 |
| `amount` | `number` | 成交金额 |
| `status` | `OrderStatus` | pending / filled / cancelled |
| `accountType` | `AccountType` | paper / real |
| `createdAt` | `number` | 创建时间戳 |
| `planStopLoss` | `number?` | 计划止损价 |
| `planTakeProfit` | `number?` | 计划止盈价 |
| `planPositionPct` | `number?` | 计划仓位占比 |
| `planFollowed` | `boolean?` | 是否遵守计划 |
| `maxDrawdown` | `number?` | 最大回撤 |
| `maxFloatingProfit` | `number?` | 最大浮盈 |
| `profitCaptureRate` | `number?` | 利润捕捉率 |
| `errors` | `string[]?` | 错误标签列表 |
| `reviewNoteId` | `string?` | 关联复盘笔记 ID |

## 10.6 模块 ID

| ID | 中文 |
|----|------|
| `fetcher` | 采集器 |
| `stockpool` | 股票池 |
| `analyzer` | 分析器 |
| `tradinghub` | 交易中心 |
| `news` | 新闻 |
| `rotation` | 板块轮动 |
| `sector` | 行业/板块 |
| `system` | 系统 |
| `user` | 用户 |
| `ai-center` | AI 智能体中心 |
| `data-collector` | 数据采集 |
| `cockpit` | 驾驶舱 |
| `health` | 健康监控 |

## 10.7 废弃命名

| 旧命名 | 新命名 | 说明 |
|--------|--------|------|
| `intention_pool`（localStorage/独立表） | `stocks` + `candidate` | 统一入 stocks |
| `screener_pool`（localStorage/独立表） | `stocks` + `screened` | 统一入 stocks |
| `watchlist`（localStorage） | `stocks` + `watching` 或 `watchlists` Store | 观察列表入 IndexedDB |
| `v6_paper_trading`（localStorage） | `orders` Store | 模拟交易入 IndexedDB |
| `code` / `stockCode` | `symbol` | 股票代码统一命名 |

## 10.8 V6 迁移术语

| 中文 | 英文 | 说明 |
|------|------|------|
| V6 导出形态 | `V6ExportShape` | V6 Pro 全量导出 JSON 的顶层结构，包含 `metadata`、`stocks`、`scores`、`trades` 等 |
| V6 迁移服务 | `v6MigrationService` | 解析 `V6ExportShape`，按 V9 规范转换 12 个 store 并写入 IndexedDB |
| 迁移面板 | `MigrationPanel` | 输入舱/总控舱 UI，支持上传 V6 JSON、预览映射、覆盖/跳过策略 |
| 迁移覆盖策略 | overwrite / skip | 默认跳过已存在 symbol；勾选覆盖后更新对应 store |
|- 迁移校验 | migration validation | 检查必填字段、未知状态、重复 symbol，输出错误报告

## 10.9 2026-06-26 新增概念

| 术语 | 英文 | 定义 | 所属模块 |
|------|------|------|---------|
| **Widget** | Widget | 驾驶舱中可插拔的独立数据展示组件，由 WidgetRegistry 统一管理生命周期 | Cockpit |
| **采集任务** | CollectionTask | TaskScheduler 调度的单次数据采集任务，包含状态、重试、执行统计 | Data Collection |
| **KAI 评分** | KaiScore | 六维度（竞争力/技术面/基本面/情绪面/资金面/行业面）综合选股评分，0-100 分 | Cockpit |
| **MarketData** | MarketData | 标准化市场数据结构，所有 Widget 统一消费的数据接口 | Cockpit / Data Collection |
| **数据采集器** | DataCollector | 采集层三层架构的采集执行单元，支持 Mock/Rest/WebSocket 三种实现 | Data Collection |
| **任务调度器** | TaskScheduler | 管理 Widget 数据采集任务的注册、启动、停止、错误恢复 | Data Collection |
| **模型对比** | ModelComparison | AI 大模型（LLM）智能对比，比较不同模型版本在选股任务上的表现 | Cockpit |
| **健康指标** | HealthMetric | Agent/模块的运行健康状态指标，包含 CPU、内存、延迟、错误率 | AI Center |
| **诊断报告** | DiagnosticReport | 系统异常时的自动诊断分析报告，包含根因分析和修复建议 | AI Center |
| **情感分析** | SentimentAnalysis | 基于规则引擎的新闻文本情感分类（正面/负面/中性），使用中文财经情感词典 | News |
| **股票关联** | StockLinking | 将新闻资讯自动匹配到相关股票，支持代码精确匹配、名称模糊匹配、行业匹配 | News |

## 10.10 2026-06-27 新增概念（双策略体系）

| 术语 | 英文 | 定义 | 所属模块 |
|------|------|------|---------|
| **热门板块策略** | Hot Sector Strategy | 板块已在动时跟随趋势，持有期 3–15 天，-8% 硬性止损、+15% 卖 50% 的快进快出策略 | Trading |
| **价值洼地策略** | Value Pit Strategy | 等板块开始轮动后再进入，持有期 6–12 个月，-15% 分步建仓、+20% 卖 30% 的等轮动策略 | Trading |
| **热门板块评分** | HotSectorScore | 单只股票的热门策略五维评分（动量/情绪/技术/估值/综合），0–5 分，持久化于 `hot_sector_scores` Store | Trading |
| **价值洼地评分** | ValuePitScore | 单只股票的价值策略五维评分（催化/估值/筹码/轮动/流动性），0–5 分，持久化于 `value_pit_scores` Store | Trading |
| **轮动信号检测引擎** | Rotation Signal Detector | 对价值洼地候选检测成交量放大 + 资金净流入 + 技术金叉，决定立即建仓或加入观察池 | Trading |
| **双策略编排引擎** | Dual Strategy Engine | 协调 HotSectorAnalyzer、ValuePitAnalyzer、RotationSignalDetector，输出 `DualStrategyResult` | Trading |
| **热门板块 Widget** | HotSectorWidget | 驾驶舱中展示热门板块评分与相关标的的 Widget | Cockpit |
| **价值洼地 Widget** | ValuePitWidget | 驾驶舱中展示价值洼地候选、五维评分与轮动信号状态的 Widget | Cockpit |

## 10.11 2026-07-05 新增概念（四层注册体系）

| 术语 | 英文 | 定义 | 所属模块 |
|------|------|------|---------|
| **Store 注册表** | Store Registry | ~~`src/store/derived.index.ts`~~（文件已删除，待重建），项目当前共 47 个 Zustand Store 通过独立文件直接导出 | Store |
| **Service 注册表** | Service Registry | ~~`src/services/contracts.ts`~~（文件已删除），原集中管理 52 个 Service 的元数据清单，覆盖 21 个域分类 | Services |
| **Component 注册表** | Component Registry | `src/components/componentRegistry.ts`，集中管理 10+ 个业务组件的注册信息与建议集成目标 | Components |
| **Widget 注册表** | Widget Registry | `src/cockpit/core/widgetRegistry.ts`，Class 单例模式管理 19 个 Widget 模板注册、默认布局与运行时状态 | Cockpit |
| **注册条目状态** | Registry Entry Status | 注册表条目的生命周期状态：`available`（可用未集成）→ `active`（已集成）→ `deprecated`（已废弃） | Registry |
| **Store 域** | Store Domain | Store 的业务域分类：`market`/`analysis`/`trading`/`portfolio`/`system`/`cockpit`/`input`/`signal`/`widget` | Registry |
| **Widget 错误边界** | Widget Error Boundary | `WidgetErrorBoundary` 组件，在 `CockpitShell` 中包裹每个 Widget 渲染，实现 Widget 级错误隔离 | Cockpit |
| **模块注册体系** | Module Registry System | 四层注册表（Store/Service/Component/Widget）的统一治理架构，解决模块创建后遗忘导致的死代码问题 | Architecture |
