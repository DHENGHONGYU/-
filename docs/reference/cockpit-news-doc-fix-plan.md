---
title: Cockpit + News 模块文档修正方案
type: reference
domain: frontend
phase: planning
tier: important
status: active
maintainer: V9 Architecture Team
summary: "Cockpit �?News 相关文档的修复计划（目标文件与整改项清单）�?
tags: [frontend, news, cockpit, fix, component, ui, strategy, widget, documentation, reference]
version: v0.9.1
last_updated: 2026-06-26
code_version: 2.0.0
doc_id: V9-DOC-FRONT-010
related_docs: [V9-DOC-ARCH-028]
referenced_by: [V9-DOC-PROJ-174, V9-DOC-META-000, V9-DOC-PROJ-164, V9-DOC-PROJ-176, V9-DOC-PROJ-182, V9-DOC-PROJ-149]
change_log: 
---

# Cockpit + News 模块文档修正方案

> **基于**: [v9-architecture-data-diff-report.md](../explanation/design/v9-architecture-data-diff-report.md)  
> **Version**: v1.0.0  
> **Date**: 2026-06-26  
> **修正范围**: P0 级差异（DIFF-001, DIFF-004, DIFF-007, DIFF-008, DIFF-014�? 关联 P1 差异（DIFF-006, DIFF-019, DIFF-020�?
---

## 一、修正清单总览

| 序号 | 差异ID | 修正动作 | 目标文件 | 操作类型 |
|------|--------|---------|---------|---------|
| 1 | DIFF-001 | Cockpit/Widget 架构补充 | `./03-architecture-standards.md` §3.1.1, §3.1.4 | 修改 |
| 2 | DIFF-004 | News 模块架构 + 功能规格补充 | `./03-architecture-standards.md` §3.1.1, `./02-functional-specs.md` §2.1 | 修改 |
| 3 | DIFF-007 | Widget 框架数据字典 | `./data-definition.md` | 新建 |
| 4 | DIFF-008 | Cockpit 常量枚举数据字典 | 并入 `./data-definition.md` | 新建 |
| 5 | DIFF-014 | News 模块数据字典 | `./data-definition.md` | 新建 |
| 6 | DIFF-006 | 文档索引更新 | `docs/README.md` | 修改 |
| 7 | DIFF-019 | 词汇表补充新概念 | `./10-glossary.md` | 修改 |
| 8 | DIFF-020 | 功能模块总览补充 | `./02-functional-specs.md` §2.1 | 修改 |

---

## 二、逐项修正方案

### 2.1 DIFF-001：Cockpit/Widget 框架架构补充

**目标文件**: `./03-architecture-standards.md`

**修改位置 1**: §3.1.1 目录与代码实际映射表格（�?36-42 行）

**当前内容**:
```markdown
| L5 展示�?| `pages/`, `components/` | �?`pages/`, `components/`, `portal/`, `cockpit/` | 基本对齐 |
| L4 应用�?| `apps/`, `cockpit/` | �?`apps/`, `cockpit/`；输入舱已拆分为 Dashboard / BulkImport / HotSector / DataTest 四个子页�?| 对齐 |
```

**修改�?*:
```markdown
| L5 展示�?| `pages/`, `components/` | �?`pages/`, `components/`, `portal/`, `cockpit/`（含 12 �?Widget 组件�?| 基本对齐 |
| L4 应用�?| `apps/`, `cockpit/` | �?`apps/`, `cockpit/`（含 CockpitShell + Widget 引擎 + Widget 注册表）；输入舱已拆分为 Dashboard / BulkImport / HotSector / DataTest 四个子页�?| 对齐 |
```

**修改位置 2**: §3.1.4 驾驶�?Widget 架构设计（第 112-154 行）

**当前 §3.1.4 目录结构**:
```markdown
src/cockpit/
├── CockpitShell.tsx          # 驾驶舱外�?├── widgetRegistry.ts         # Widget 注册�?├── widgetEngine.ts           # Widget 运行时引�?├── widgetEventBus.ts         # Widget 事件总线
└── widgets/
    ├── market/               # 市场�?Widget
    ├── portfolio/            # 持仓�?Widget
    ├── strategy/             # 策略�?Widget
    └── agent/                # Agent 监控�?Widget
```

**修改�?*:
```markdown
src/cockpit/
├── CockpitShell.tsx              # 驾驶舱外壳（react-grid-layout 动态网格）
├── core/
�?  ├── widgetRegistry.ts         # Widget 注册表（模板注册 + 实例管理 + 运行时状态）
�?  ├── widgetEngine.ts           # Widget 运行时引�?�?  └── widgetEventBus.ts         # Widget 跨组件事件总线
└── widgets/
    ├── MarketIndicesWidget.tsx    # 大盘指数实时数据
    ├── SectorHeatmapWidget.tsx    # 板块涨跌幅热力图
    ├── FundFlowWidget.tsx         # 资金流向数据
    ├── MarketSentimentWidget.tsx  # 市场情绪指标
    ├── WatchlistWidget.tsx        # 自选股列表
    ├── PortfolioOverviewWidget.tsx # 持仓概览
    ├── AITradeReviewWidget.tsx    # AI 交易复盘分析
    ├── InvestmentProfileWidget.tsx # 投资画像/分析中心
    ├── StockPoolWidget.tsx        # 股票池管理与监控列表
    ├── KaiScoreWidget.tsx         # KAI 选股综合评分图谱
    ├── ModelCompareWidget.tsx     # AI 大模型智能对�?    └── StockChatWidget.tsx        # 个股/市场深度分析聊天
```

**修改位置 3**: �?§3.1.4 末尾追加 "Widget 数据采集�? 子节

**新增内容**:
```markdown
### 3.1.4.1 Widget 数据采集�?
每个 Widget 通过 `DataSourceConfig` 声明数据需求，�?`TaskScheduler` 统一调度采集任务�?
```
DataSourceConfig ──�?TaskScheduler ──�?BaseCollector（Mock/Rest/WebSocket�?                                            �?                                            �?                                      RawMarketData
                                            �?                                            �?                                   MarketDataAdapter
                                            �?                                            �?                                       MarketData
                                            �?                                            �?                              MarketDataProvider（React Context�?                                            �?                                    ┌───────┴───────�?                                    �?              �?                              Widget A          Widget B
```

**采集器三层架�?*�?- **BaseCollector**：超时控制、错误捕获、重试机制（3 次重�?/ 10s 超时�?- **TaskScheduler**：任务注�?启动/停止、错误状态管理、自动轮询与清理
- **MarketDataAdapter**：统一不同来源的原始数�?�?`MarketData` 接口

**当前状�?*：✅ 已实现。`src/services/data-collector/` 下三层架构完整，`src/cockpit/core/widgetRegistry.ts` 已注�?12 个默�?Widget，`CockpitShell` 已接�?Widget 引擎�?```

**修改位置 4**: §3.4 配置层文件清单（�?221-236 行），在表格末尾追加

**新增�?*:
```markdown
| `src/constants/cockpit.constants.ts` | Cockpit Widget 常量（网格、颜色、枚举、数据源配置�?| 禁止�?Widget 组件内硬编码颜色/尺寸 |
```

---

### 2.2 DIFF-004：News 模块架构 + 功能规格补充

**目标文件 A**: `./03-architecture-standards.md` §3.1.1

**修改位置**: §3.1.1 目录与代码实际映射表�?L3 行（�?40 行）

**当前内容**:
```markdown
| L3 引擎�?| `agents/`, `trading/`, `services/` | �?`services/`；交易引擎已下沉�?`src/services/trading/`；采集引擎位�?`src/services/fetcher/`；�?`src/agents/agentRuntime.ts` 已存在，注册�?任务队列/健康监控待完善；🟡 `src/core/dataflow/` 已实现，数据融合层（UnifiedStockData）仍缺失 | 部分对齐，见偏差清单 |
```

**修改�?*:
```markdown
| L3 引擎�?| `agents/`, `trading/`, `services/` | �?`services/`；交易引擎已下沉�?`src/services/trading/`；采集引擎位�?`src/services/fetcher/` �?`src/services/data-collector/`；新闻服务位�?`src/services/news/`（newsService + sentimentAnalyzer + stockLinker）；🟡 `src/agents/agentRuntime.ts` 已存在，注册�?任务队列/健康监控待完善；🟡 `src/core/dataflow/` 已实现，数据融合层（UnifiedStockData）仍缺失 | 部分对齐，见偏差清单 |
```

**目标文件 B**: `./02-functional-specs.md` §2.1

**修改位置**: §2.1 功能模块总览图中，在"数据采集�?之后插入"新闻资讯"模块

**新增模块�?*（插入在"数据采集�?之后�?股票池管�?之前�?
```markdown
├─────────────────────────────────────────────────────────────�?�? 新闻资讯（News Module�?                                     �?�? �?资讯采集与去重（newsService�?                             �?�? �?情感分析（sentimentAnalyzer：规则引�?+ 情感词典�?         �?�? �?股票关联（stockLinker：代�?名称/行业匹配�?                �?�? �?新闻列表页（NewsPage + NewsCard + NewsFeed + FilterPanel�?�?├─────────────────────────────────────────────────────────────�?```

**同时修改 §2.4 末尾**，追�?News 模块用户故事:

```markdown
### 2.4.11 新闻资讯浏览与筛�?
**用户故事**：作为投资者，我想浏览财经新闻并根据情感、股票关联、行业进行筛选，以便快速了解市场动态�?
**验收标准**�?- 新闻列表支持按来源、分类、情感（正面/负面/中性）、关联股票、关键词筛选�?- 每篇新闻展示情感标签和置信度，支持展开查看全文�?- 新闻自动关联相关股票，点击股票代码可跳转至分析页�?- 情感分析基于规则引擎（中文财经词典），结果缓存至 IndexedDB�?- 新闻去重基于内容哈希（DJB2 算法），避免重复存储�?```

---

### 2.3 DIFF-007 + DIFF-008：Cockpit Widget 数据字典（新建）

**目标文件**: `./data-definition.md`（新建）

**文件路径**: `./cockpit/data-definition.md`

**完整内容详见下方 §�?*�?
---

### 2.4 DIFF-014：News 模块数据字典（新建）

**目标文件**: `./data-definition.md`（新建）

**文件路径**: `./news-data-definition.md`

**完整内容详见下方 §�?*�?
---

### 2.5 DIFF-006：文档索引更�?
**目标文件**: `docs/README.md`

**修改位置**: 专项文档表格

**新增�?*:
```markdown
| `ai-center-data-definition.md` | AI 智能体调度中�?+ 健康监控 + 诊断分析 数据字典 |
| `trade/api-contract.md` | 交易持仓管理模块 API 契约 |
| `cockpit/data-definition.md` | Cockpit Widget 框架数据字典（类�?+ 枚举常量�?|
| `news/data-definition.md` | 新闻资讯模块数据字典 |
```

---

### 2.6 DIFF-019 + DIFF-020：词汇表 + 功能模块补充

**目标文件 A**: `./10-glossary.md`

**修改位置**: �?§10.6 模块 ID 表（或末尾新增章节）追加

**新增内容**:
```markdown
## 10.7 2026-06-26 新增概念

| 术语 | 英文 | 定义 | 所属模�?|
|------|------|------|---------|
| **Widget** | Widget | 驾驶舱中可插拔的独立数据展示组件，由 WidgetRegistry 统一管理生命周期 | Cockpit |
| **采集任务** | CollectionTask | TaskScheduler 调度的单次数据采集任务，包含状态、重试、执行统�?| Data Collection |
| **KAI 评分** | KaiScore | 六维度（竞争�?技术面/基本�?情绪�?资金�?行业面）综合选股评分�?-100 �?| Cockpit |
| **MarketData** | MarketData | 标准化市场数据结构，所�?Widget 统一消费的数据接�?| Cockpit / Data Collection |
| **数据采集�?* | DataCollector | 采集层三层架构的采集执行单元，支�?Mock/Rest/WebSocket 三种实现 | Data Collection |
| **任务调度�?* | TaskScheduler | 管理 Widget 数据采集任务的注册、启动、停止、错误恢�?| Data Collection |
| **模型对比** | ModelComparison | AI 大模型（LLM）智能对比，比较不同模型版本在选股任务上的表现 | Cockpit |
| **健康指标** | HealthMetric | Agent/模块的运行健康状态指标，包含 CPU、内存、延迟、错误率 | AI Center |
| **诊断报告** | DiagnosticReport | 系统异常时的自动诊断分析报告，包含根因分析和修复建议 | AI Center |
| **情感分析** | SentimentAnalysis | 基于规则引擎的新闻文本情感分类（正面/负面/中性），使用中文财经情感词�?| News |
| **股票关联** | StockLinking | 将新闻资讯自动匹配到相关股票，支持代码精确匹配、名称模糊匹配、行业匹�?| News |
```

**目标文件 B**: `./02-functional-specs.md` §2.1（已�?2.2 中处理）

---

## 三、Cockpit Widget 数据字典内容

> 以下�?`./data-definition.md` 的完整内容，可直接写入文件�?
---

### 元数据头

```yaml
---
title: Cockpit Widget 框架数据字典
version: v1.0.0
last_updated: 2026-06-26
maintainer: Architecture Asset Governor
source_files:
  - src/types/modules/widget.types.ts
  - src/constants/cockpit.constants.ts
  - src/cockpit/core/widgetRegistry.ts
changelog:
  - version: v1.0.0
    date: 2026-06-26
    changes: 初始创建，覆�?Widget 框架全部类型定义与枚举常�?---
```

### 第一部分：TypeScript 接口定义

#### 1.1 MarketData �?标准化市场数�?
**来源**: `src/types/modules/widget.types.ts:61-86`  
**用�?*: 所�?Widget 统一消费的数据接口，�?MarketDataAdapter 转换后提�?
| 字段 | 类型 | 必填 | 描述 |
|------|------|------|------|
| `timestamp` | `number` | �?| 数据生成时间（毫秒时间戳�?|
| `indices` | `MarketIndexData[]` | �?| 大盘指数数据列表 |
| `sectors` | `SectorHeatmapData[]` | �?| 板块热力图数据列�?|
| `fundFlows` | `FundFlowData[]` | �?| 资金流向数据列表 |
| `sentiment` | `SentimentData` | �?| 市场情绪数据 |
| `watchlist` | `WatchlistData[]` | �?| 自选股列表 |
| `portfolio` | `PortfolioData` | �?| 持仓概览数据 |
| `tradeReview` | `TradeReviewData` | �?| AI 交易复盘数据 |
| `analysisScores` | `AnalysisScores` | �?| 投资画像 / 分析评分数据 |
| `modelComparison` | `ModelComparison` | �?| AI 大模型对比数�?|
| `stockPool` | `StockPool` | �?| 股票池管理与监控数据 |
| `chatHistory` | `ChatHistory` | �?| 个股深度分析 / 市场分析聊天数据 |

#### 1.2 MarketIndexData �?大盘指数数据

| 字段 | 类型 | 必填 | 描述 |
|------|------|------|------|
| `code` | `string` | �?| 指数代码，如 `000001`（上证）、`399001`（深证） |
| `name` | `string` | �?| 指数名称，如 `上证指数` |
| `price` | `number` | �?| 当前点位 |
| `change` | `number` | �?| 涨跌�?|
| `changePercent` | `number` | �?| 涨跌幅（%�?|
| `high` | `number` | �?| 日内最�?|
| `low` | `number` | �?| 日内最�?|
| `volume` | `string` | �?| 成交�?|

#### 1.3 SectorHeatmapData �?板块热力图数�?
| 字段 | 类型 | 必填 | 描述 |
|------|------|------|------|
| `name` | `string` | �?| 板块名称 |
| `code` | `string` | �?| 板块代码 |
| `changePercent` | `number` | �?| 涨跌幅（%�?|
| `turnover` | `string` | �?| 成交�?|

#### 1.4 FundFlowData �?资金流向数据

| 字段 | 类型 | 必填 | 描述 |
|------|------|------|------|
| `type` | `string` | �?| 资金类型 key，见 `FUND_FLOW_TYPES` |
| `name` | `string` | �?| 资金类型显示�?|
| `value` | `number` | �?| 净流入金额 |
| `unit` | `string` | �?| 金额单位，如 `亿` |

#### 1.5 SentimentData �?市场情绪数据

| 字段 | 类型 | 必填 | 描述 |
|------|------|------|------|
| `fearGreedIndex` | `number` | �?| 恐惧贪婪指数 0-100 |
| `fearGreedLabel` | `string` | �?| 恐惧贪婪标签，如 `极度恐惧` |
| `totalStocks` | `number` | �?| 总股票数 |
| `up` | `number` | �?| 上涨家数 |
| `down` | `number` | �?| 下跌家数 |
| `flat` | `number` | �?| 平盘家数 |
| `limitUp` | `number` | �?| 涨停家数 |
| `limitDown` | `number` | �?| 跌停家数 |

#### 1.6 WatchlistData �?自选股数据

| 字段 | 类型 | 必填 | 描述 |
|------|------|------|------|
| `name` | `string` | �?| 股票名称 |
| `code` | `string` | �?| 股票代码 |
| `price` | `number` | �?| 最新价 |
| `changePercent` | `number` | �?| 涨跌幅（%�?|

#### 1.7 PortfolioData �?持仓概览数据

| 字段 | 类型 | 必填 | 描述 |
|------|------|------|------|
| `totalAssets` | `string` | �?| 总资�?|
| `availableFunds` | `string` | �?| 可用资金 |
| `todayPnL` | `string` | �?| 今日盈亏 |
| `todayPnLPercent` | `number` | �?| 今日盈亏比例�?�?|
| `totalPnL` | `string` | �?| 累计盈亏 |
| `totalPnLPercent` | `number` | �?| 累计盈亏比例�?�?|
| `holdings` | `number` | �?| 持仓股票�?|

#### 1.8 TradeReviewData �?AI 交易复盘数据

| 字段 | 类型 | 必填 | 描述 |
|------|------|------|------|
| `totalTrades` | `number` | �?| 总交易次�?|
| `profitable` | `number` | �?| 盈利次数 |
| `losing` | `number` | �?| 亏损次数 |
| `winRate` | `number` | �?| 胜率 0-1 |
| `profitLossRatio` | `number` | �?| 盈亏�?|
| `disciplineScore` | `number` | �?| 纪律评分 0-100 |

#### 1.9 AnalysisScores �?投资画像 / 分析评分

| 字段 | 类型 | 必填 | 描述 |
|------|------|------|------|
| `profile` | `InvestmentProfile` | �?| 用户投资画像 |
| `kai` | `KaiScore` | �?| KAI 选股综合评分 |

#### 1.10 InvestmentProfile �?投资画像

| 字段 | 类型 | 必填 | 描述 |
|------|------|------|------|
| `tags` | `string[]` | �?| 用户标签列表，如 `["老股�?, "择时"]` |
| `metrics` | `ProfileMetric[]` | �?| 核心指标卡片列表 |

#### 1.11 ProfileMetric �?投资画像指标

| 字段 | 类型 | 必填 | 描述 |
|------|------|------|------|
| `name` | `string` | �?| 指标名称，见 `INVESTMENT_PROFILE_METRICS` |
| `score` | `number` | �?| 指标评分 0-100 |
| `description` | `string` | �?| 指标说明 |
| `icon` | `string` | �?| 图标标识 |

#### 1.12 KaiScore �?KAI 选股综合评分

| 字段 | 类型 | 必填 | 描述 |
|------|------|------|------|
| `totalScore` | `number` | �?| 综合评分 0-100 |
| `sentiment` | `number` | �?| 情绪�?0-100 |
| `trend` | `number` | �?| 趋势�?0-100 |
| `flow` | `number` | �?| 流量�?0-100 |
| `dimensions` | `KaiDimension[]` | �?| 六大类维度评�?|
| `detailDistribution` | `KaiDetailItem[]` | �?| 维度细项分布�?|

#### 1.13 KaiDimension �?KAI 评分维度

| 字段 | 类型 | 必填 | 描述 |
|------|------|------|------|
| `name` | `string` | �?| 维度名称，见 `KAI_DIMENSION_NAMES` |
| `score` | `number` | �?| 维度得分 0-100 |
| `weight` | `number` | �?| 权重 0-1 |
| `status` | `string` | �?| 评分状态文�?|
| `color` | `string` | �?| 颜色标签，来�?`SCORE_LEVELS` |

#### 1.14 KaiDetailItem �?KAI 维度细项

| 字段 | 类型 | 必填 | 描述 |
|------|------|------|------|
| `dimensionName` | `string` | �?| 所属维度名�?|
| `itemName` | `string` | �?| 细项名称 |
| `score` | `number` | �?| 细项得分 0-100 |
| `weight` | `number` | �?| 细项权重 0-1 |
| `color` | `string` | �?| 颜色标签 |

#### 1.15 ModelComparison �?模型对比数据

| 字段 | 类型 | 必填 | 描述 |
|------|------|------|------|
| `leftModel` | `ModelInfo` | �?| 左侧模型信息 |
| `rightModel` | `ModelInfo` | �?| 右侧模型信息 |
| `dimensions` | `CompareDimension[]` | �?| 对比维度列表 |
| `riskHint` | `string` | �?| 风险提示文本 |

#### 1.16 ModelInfo �?模型信息

| 字段 | 类型 | 必填 | 描述 |
|------|------|------|------|
| `id` | `string` | �?| 模型 ID，见 `LLM_MODEL_VERSIONS` |
| `name` | `string` | �?| 模型名称 |
| `version` | `string` | �?| 模型版本�?|
| `score` | `number` | �?| 模型综合得分 |

#### 1.17 CompareDimension �?模型对比维度

| 字段 | 类型 | 必填 | 描述 |
|------|------|------|------|
| `name` | `string` | �?| 维度名称 |
| `leftScore` | `number` | �?| 左侧模型得分 |
| `rightScore` | `number` | �?| 右侧模型得分 |
| `weight` | `number` | �?| 维度权重 0-1 |

#### 1.18 StockPool �?股票池数�?
| 字段 | 类型 | 必填 | 描述 |
|------|------|------|------|
| `stocks` | `StockPoolItem[]` | �?| 股票列表 |
| `total` | `number` | �?| 总条�?|
| `page` | `number` | �?| 当前页码 |
| `pageSize` | `number` | �?| 每页条数 |

#### 1.19 StockPoolItem �?股票池条�?
| 字段 | 类型 | 必填 | 描述 |
|------|------|------|------|
| `code` | `string` | �?| 股票代码 |
| `name` | `string` | �?| 股票名称 |
| `price` | `number` | �?| 最新价 |
| `changePercent` | `number` | �?| 涨跌幅（%�?|
| `turnover` | `string` | �?| 成交�?|
| `turnoverRate` | `string` | �?| 换手�?|
| `statusColor` | `string` | �?| 状态颜色条，来�?`STOCK_POOL_STATUS_COLORS` |
| `statusLabel` | `string` | �?| 状态标签文�?|

#### 1.20 ChatHistory �?聊天历史

| 字段 | 类型 | 必填 | 描述 |
|------|------|------|------|
| `target` | `string` | �?| 当前选中的标的代码或 `market` |
| `targetType` | `'stock' \| 'market'` | �?| 标的类型 |
| `messages` | `ChatMessage[]` | �?| 消息列表 |

#### 1.21 ChatMessage �?聊天消息

| 字段 | 类型 | 必填 | 描述 |
|------|------|------|------|
| `id` | `string` | �?| 消息唯一标识 |
| `role` | `'user' \| 'assistant'` | �?| 消息角色 |
| `content` | `string` | �?| 消息内容（Markdown 格式�?|
| `timestamp` | `number` | �?| 消息时间�?|

#### 1.22 DataSourceConfig �?Widget 数据源配�?
| 字段 | 类型 | 必填 | 描述 |
|------|------|------|------|
| `type` | `DataSourceType` | �?| 数据源类型，�?§2.1 |
| `mode` | `CollectionMode` | �?| 采集模式，见 §2.2 |
| `interval` | `number` | �?| 轮询间隔（毫秒） |
| `endpoint` | `string` | �?| API 端点 |
| `params` | `Record<string, unknown>` | �?| 额外请求参数 |
| `enabled` | `boolean` | �?| 是否启用 |

#### 1.23 WidgetConfig �?Widget 实例配置

| 字段 | 类型 | 必填 | 描述 |
|------|------|------|------|
| `instanceId` | `string` | �?| 实例唯一标识 |
| `widgetId` | `string` | �?| Widget 模板 ID |
| `size` | `{ cols: number; rows: number }` | �?| 网格尺寸 |
| `position` | `{ x: number; y: number }` | �?| 网格位置 |
| `title` | `string` | �?| 显示标题 |
| `settings` | `Record<string, unknown>` | �?| 自定义设�?|
| `visible` | `boolean` | �?| 是否可见 |
| `collapsed` | `boolean` | �?| 是否折叠 |
| `dataSource` | `DataSourceConfig` | �?| 数据源配�?|

#### 1.24 WidgetMeta �?Widget 模板元数�?
| 字段 | 类型 | 必填 | 描述 |
|------|------|------|------|
| `id` | `string` | �?| Widget 模板 ID |
| `name` | `string` | �?| 显示名称 |
| `category` | `string` | �?| 分类 |
| `description` | `string` | �?| 功能描述 |
| `defaultSize` | `{ cols: number; rows: number }` | �?| 默认网格尺寸 |
| `defaultConfig` | `Record<string, unknown>` | �?| 默认配置 |
| `defaultDataSource` | `DataSourceConfig` | �?| 默认数据源配�?|

#### 1.25 WidgetRuntimeState �?Widget 运行时状�?
| 字段 | 类型 | 必填 | 描述 |
|------|------|------|------|
| `instanceId` | `string` | �?| 实例 ID |
| `widgetId` | `string` | �?| Widget 模板 ID |
| `status` | `'idle' \| 'loading' \| 'ready' \| 'error'` | �?| 当前状�?|
| `error` | `string` | �?| 错误信息 |
| `lastRefresh` | `number` | �?| 上次刷新时间 |

#### 1.26 CollectionTask �?采集任务定义

| 字段 | 类型 | 必填 | 描述 |
|------|------|------|------|
| `taskId` | `string` | �?| 任务唯一标识 |
| `widgetId` | `string` | �?| 关联 Widget ID |
| `instanceId` | `string` | �?| 关联实例 ID |
| `dataSource` | `DataSourceConfig` | �?| 数据源配�?|
| `status` | `CollectionTaskStatus` | �?| 当前状态，�?§2.4 |
| `error` | `string` | �?| 错误信息 |
| `lastRun` | `number` | �?| 上次执行时间 |
| `nextRun` | `number` | �?| 下次执行时间 |
| `runCount` | `number` | �?| 执行次数 |
| `successCount` | `number` | �?| 成功次数 |
| `failCount` | `number` | �?| 失败次数 |

#### 1.27 WidgetTemplate �?Widget 注册模板（widgetRegistry�?
**来源**: `src/cockpit/core/widgetRegistry.ts:9-14`

| 字段 | 类型 | 必填 | 描述 |
|------|------|------|------|
| `meta` | `WidgetMeta` | �?| Widget 元数�?|
| `component` | `() => Promise<{ default: React.ComponentType }>` | �?| 懒加载组件工厂函�?|
| `configPanel` | `() => Promise<{ default: React.ComponentType }>` | �?| 配置面板懒加载工厂函�?|

#### 1.28 WidgetRegistry 已注�?Widget 清单

| widgetId | 名称 | 分类 | 组件文件 |
|----------|------|------|---------|
| `marketIndices` | 市场指数 | market | `MarketIndicesWidget.tsx` |
| `sectorHeatmap` | 板块热力�?| market | `SectorHeatmapWidget.tsx` |
| `fundFlow` | 资金流向 | market | `FundFlowWidget.tsx` |
| `marketSentiment` | 市场情绪 | market | `MarketSentimentWidget.tsx` |
| `watchlist` | 自选股 | market | `WatchlistWidget.tsx` |
| `portfolioOverview` | 持仓概览 | portfolio | `PortfolioOverviewWidget.tsx` |
| `aiTradeReview` | AI 交易复盘 | strategy | `AITradeReviewWidget.tsx` |
| `investmentProfile` | 投资画像 | analysis | `InvestmentProfileWidget.tsx` |
| `stockPool` | 股票池监�?| analysis | `StockPoolWidget.tsx` |
| `kaiScore` | KAI 综合评分 | analysis | `KaiScoreWidget.tsx` |
| `modelCompare` | 大模型对�?| analysis | `ModelCompareWidget.tsx` |
| `stockChat` | 深度分析助手 | analysis | `StockChatWidget.tsx` |

---

### 第二部分：枚举常量定�?
#### 2.1 DataSourceType �?数据源类�?
**来源**: `src/types/modules/widget.types.ts:12` + `src/constants/cockpit.constants.ts:163-167`

| 枚举�?| 常量引用 | 描述 |
|--------|---------|------|
| `'mock'` | `DATA_SOURCE_TYPE.MOCK` | 模拟数据�?|
| `'rest'` | `DATA_SOURCE_TYPE.REST` | REST API 数据�?|
| `'websocket'` | `DATA_SOURCE_TYPE.WEBSOCKET` | WebSocket 实时推�?|

#### 2.2 CollectionMode �?采集模式

**来源**: `src/constants/cockpit.constants.ts:170-174`

| 枚举�?| 常量引用 | 描述 |
|--------|---------|------|
| `'polling'` | `COLLECTION_MODE.POLLING` | 定时轮询 |
| `'once'` | `COLLECTION_MODE.ONCE` | 单次采集 |
| `'streaming'` | `COLLECTION_MODE.STREAMING` | 流式推�?|

#### 2.3 CollectionTaskStatus �?采集任务状�?
**来源**: `src/types/modules/widget.types.ts:329`

| 枚举�?| 描述 |
|--------|------|
| `'pending'` | 等待执行 |
| `'running'` | 执行�?|
| `'paused'` | 已暂�?|
| `'error'` | 错误 |
| `'completed'` | 已完�?|

#### 2.4 WIDGET_SIZE �?Widget 网格尺寸

**来源**: `src/constants/cockpit.constants.ts:7-13`

| 常量引用 | cols | rows | 用�?|
|---------|------|------|------|
| `WIDGET_SIZE.FULL_WIDTH` | 4 | 2 | 全宽 Widget |
| `WIDGET_SIZE.HALF_WIDTH` | 2 | 2 | 半宽 Widget |
| `WIDGET_SIZE.THIRD_WIDTH` | 1 | 2 | 1/3 �?Widget |
| `WIDGET_SIZE.LARGE_HEIGHT` | 4 | 3 | 大高�?Widget |
| `WIDGET_SIZE.CHAT_HEIGHT` | 4 | 4 | 聊天 Widget |

#### 2.5 MARKET_INDEX_CODES �?大盘指数代码

**来源**: `src/constants/cockpit.constants.ts:15-20`

| 常量引用 | 代码 | 名称 |
|---------|------|------|
| `MARKET_INDEX_CODES.SHANGHAI` | `000001` | 上证指数 |
| `MARKET_INDEX_CODES.SHENZHEN` | `399001` | 深证成指 |
| `MARKET_INDEX_CODES.CHINEXT` | `399006` | 创业板指 |
| `MARKET_INDEX_CODES.STAR` | `000688` | 科创50 |

#### 2.6 FUND_FLOW_TYPES �?资金流向类型

**来源**: `src/constants/cockpit.constants.ts:29-33`

| 常量引用 | �?| 显示�?|
|---------|------|------|
| `FUND_FLOW_TYPES.MAIN` | `main` | 主力净流入 |
| `FUND_FLOW_TYPES.RETAIL` | `retail` | 散户净流入 |
| `FUND_FLOW_TYPES.NORTH` | `north` | 北向净流入 |

#### 2.7 SENTIMENT_LEVELS �?市场情绪分级

**来源**: `src/constants/cockpit.constants.ts:51-57`

| 常量引用 | 范围 | 标签 | 颜色 |
|---------|------|------|------|
| `SENTIMENT_LEVELS.EXTREME_FEAR` | 0-20 | 极度恐惧 | `bg-red-600` |
| `SENTIMENT_LEVELS.FEAR` | 20-40 | 恐惧 | `bg-red-400` |
| `SENTIMENT_LEVELS.NEUTRAL` | 40-60 | 中�?| `bg-yellow-400` |
| `SENTIMENT_LEVELS.GREEDY` | 60-80 | 贪婪 | `bg-green-400` |
| `SENTIMENT_LEVELS.EXTREME_GREEDY` | 80-100 | 极度贪婪 | `bg-green-600` |

#### 2.8 STOCK_COLOR_TOKENS �?股票涨跌颜色映射（A 股标准：红涨绿跌�?
**来源**: `src/constants/cockpit.constants.ts:62-81`

| 常量引用 | 含义 | HEX �?| Tailwind 类名 |
|---------|------|--------|-------------|
| `STOCK_COLOR_TOKENS.UP` | 上涨 | `#ef4444` | `text-red-500` |
| `STOCK_COLOR_TOKENS.DOWN` | 下跌 | `#22c55e` | `text-green-500` |
| `STOCK_COLOR_TOKENS.NEUTRAL` | 平盘 | `#9ca3af` | `text-gray-400` |

#### 2.9 SCORE_LEVELS �?评分等级映射

**来源**: `src/constants/cockpit.constants.ts:86-92`

| 常量引用 | 范围 | 标签 | 颜色 |
|---------|------|------|------|
| `SCORE_LEVELS.EXCELLENT` | 80-100 | 优秀 | `#22c55e` |
| `SCORE_LEVELS.GOOD` | 60-80 | 良好 | `#3b82f6` |
| `SCORE_LEVELS.AVERAGE` | 40-60 | 一�?| `#f59e0b` |
| `SCORE_LEVELS.POOR` | 20-40 | 较弱 | `#f97316` |
| `SCORE_LEVELS.BAD` | 0-20 | �?| `#ef4444` |

#### 2.10 KAI_DIMENSION_NAMES �?KAI 评分维度

**来源**: `src/constants/cockpit.constants.ts:97-104`

| 常量引用 | 中文�?|
|---------|--------|
| `KAI_DIMENSION_NAMES.COMPETITIVENESS` | 竞争�?|
| `KAI_DIMENSION_NAMES.TECHNICAL` | 技术面 |
| `KAI_DIMENSION_NAMES.FUNDAMENTAL` | 基本�?|
| `KAI_DIMENSION_NAMES.SENTIMENT` | 情绪�?|
| `KAI_DIMENSION_NAMES.FUND_FLOW` | 资金�?|
| `KAI_DIMENSION_NAMES.INDUSTRY` | 行业�?|

#### 2.11 LLM_MODEL_VERSIONS �?AI 大模型版�?
**来源**: `src/constants/cockpit.constants.ts:109-114`

| 常量引用 | ID | 名称 | 版本 |
|---------|------|------|------|
| `LLM_MODEL_VERSIONS.KAILLM_V2_1` | `kaillm-v2.1` | KAILLM v2.1 | v2.1 |
| `LLM_MODEL_VERSIONS.KAILLM_V2_0` | `kaillm-v2.0` | KAILLM v2.0 | v2.0 |
| `LLM_MODEL_VERSIONS.BASELINE_V1_5` | `baseline-v1.5` | 基准模型 v1.5 | v1.5 |
| `LLM_MODEL_VERSIONS.BASELINE_V1_0` | `baseline-v1.0` | 基准模型 v1.0 | v1.0 |

#### 2.12 INVESTMENT_PROFILE_METRICS �?投资画像指标

**来源**: `src/constants/cockpit.constants.ts:119-125`

| 常量引用 | 名称 | 描述 |
|---------|------|------|
| `INVESTMENT_PROFILE_METRICS.ABILITY` | 投资能力 | 综合收益与风险控制能�?|
| `INVESTMENT_PROFILE_METRICS.STYLE` | 投资风格 | 价�?成长/均衡等风格倾向 |
| `INVESTMENT_PROFILE_METRICS.RISK_CONTROL` | 风控能力 | 回撤控制与仓位管理能�?|
| `INVESTMENT_PROFILE_METRICS.HOLDING` | 持仓透视 | 集中度与行业配置分析 |
| `INVESTMENT_PROFILE_METRICS.TIMING` | 择时风格 | 左侧/右侧交易倾向 |

#### 2.13 STOCK_POOL_STATUS_COLORS �?股票池状态颜�?
**来源**: `src/constants/cockpit.constants.ts:141-146`

| 常量引用 | 颜色 | 标签 |
|---------|------|------|
| `STOCK_POOL_STATUS_COLORS.ACTIVE` | `#22c55e` | 活跃 |
| `STOCK_POOL_STATUS_COLORS.WARM` | `#3b82f6` | 温热 |
| `STOCK_POOL_STATUS_COLORS.COOL` | `#f59e0b` | 冷清 |
| `STOCK_POOL_STATUS_COLORS.COLD` | `#9ca3af` | 冷淡 |

#### 2.14 SECTOR_COLOR_MAPPING �?板块涨跌颜色

**来源**: `src/constants/cockpit.constants.ts:41-49`

| 常量引用 | Tailwind 类名 | 含义 |
|---------|-------------|------|
| `SECTOR_COLOR_MAPPING.STRONG_UP` | `bg-green-500` | 强势上涨 |
| `SECTOR_COLOR_MAPPING.UP` | `bg-green-400` | 上涨 |
| `SECTOR_COLOR_MAPPING.WEAK_UP` | `bg-green-300` | 微涨 |
| `SECTOR_COLOR_MAPPING.FLAT` | `bg-gray-300` | 平盘 |
| `SECTOR_COLOR_MAPPING.WEAK_DOWN` | `bg-red-300` | 微跌 |
| `SECTOR_COLOR_MAPPING.DOWN` | `bg-red-400` | 下跌 |
| `SECTOR_COLOR_MAPPING.STRONG_DOWN` | `bg-red-500` | 强势下跌 |

#### 2.15 采集器配置常�?
**来源**: `src/constants/cockpit.constants.ts:176-223`

| 常量引用 | �?| 描述 |
|---------|------|------|
| `COLLECTOR_DEFAULT_CONFIG.TIMEOUT` | `10000` | API 超时时间（毫秒） |
| `COLLECTOR_DEFAULT_CONFIG.RETRY_COUNT` | `3` | 重试次数 |
| `COLLECTOR_DEFAULT_CONFIG.RETRY_INTERVAL` | `2000` | 重试间隔（毫秒） |
| `COLLECTOR_DEFAULT_CONFIG.DEFAULT_POLLING_INTERVAL` | `5000` | 默认轮询间隔（毫秒） |
| `MOCK_COLLECTOR_CONFIG.MIN_DELAY` | `200` | 模拟延迟最小值（毫秒�?|
| `MOCK_COLLECTOR_CONFIG.MAX_DELAY` | `1000` | 模拟延迟最大值（毫秒�?|
| `WEBSOCKET_COLLECTOR_CONFIG.RECONNECT_INTERVAL` | `3000` | 重连间隔（毫秒） |
| `WEBSOCKET_COLLECTOR_CONFIG.MAX_RECONNECT_COUNT` | `5` | 最大重连次�?|

#### 2.16 网格布局常量

**来源**: `src/constants/cockpit.constants.ts:1-5`

| 常量引用 | �?| 描述 |
|---------|------|------|
| `GRID_COLUMNS` | `4` | 网格列数 |
| `GRID_ROW_HEIGHT` | `120` | 行高（像素） |
| `GRID_GAP` | `16` | 网格间距（像素） |

---

### 第三部分：数据流�?
```
┌──────────────────────────────────────────────────────────────────�?�? Widget 数据�?                                                   �?�?                                                                 �?�? DataSourceConfig ──�?TaskScheduler ──�?BaseCollector             �?�? (widgetId=xxx)        (register/start)    �?                    �?�?                                           �?fetch               �?�?                                           �?                    �?�?                                    RawMarketData                 �?�?                                           �?                    �?�?                                           �?                    �?�?                                   MarketDataAdapter              �?�?                                           �?                    �?�?                                           �?                    �?�?                                      MarketData                  �?�?                                           �?                    �?�?                                           �?                    �?�?                             MarketDataProvider (Context)         �?�?                                  �?                             �?�?                     ┌────────────┼────────────�?                �?�?                     �?           �?           �?                �?�?                Widget A     Widget B     Widget C               �?�?                                                                 �?�? WidgetRegistry 管理流程:                                        �?�?   register(template) �?createInstance(widgetId)                 �?�?   �?updateRuntimeState(instanceId, { status })                  �?�?   �?removeInstance(instanceId)                                  �?└──────────────────────────────────────────────────────────────────�?```

**数据来源**：`WidgetRegistry.createInstance()` �?`TaskScheduler.register()` �?`BaseCollector.fetch()`  
**数据去向**：`MarketDataProvider` �?�?Widget 组件�?`data` prop  
**更新频率**：默�?5 秒轮询（`COLLECTOR_DEFAULT_CONFIG.DEFAULT_POLLING_INTERVAL`），可通过 `DataSourceConfig.interval` 调整

---

## 四、News 模块数据字典内容

> 以下�?`./data-definition.md` 的完整内容，可直接写入文件�?
---

### 元数据头

```yaml
---
title: 新闻资讯模块数据字典
version: v1.0.0
last_updated: 2026-06-26
maintainer: Architecture Asset Governor
source_files:
  - src/data/types.ts (NewsArticle, NewsStockMap, SentimentCache)
  - src/services/news/newsService.ts
  - src/services/news/sentimentAnalyzer.ts
  - src/services/news/stockLinker.ts
changelog:
  - version: v1.0.0
    date: 2026-06-26
    changes: 初始创建，覆盖新闻模块全部类型定义与枚举常量
---
```

### 第一部分：TypeScript 接口定义

#### 1.1 NewsArticle �?新闻资讯条目

**来源**: `src/data/types.ts:565-579`  
**用�?*: 存储从外部财经源抓取的新闻资讯，支持 IndexedDB 持久�?
| 字段 | 类型 | 必填 | 描述 |
|------|------|------|------|
| `id` | `string` | �?| 新闻唯一 ID，格�?`news_{contentHash}` |
| `title` | `string` | �?| 新闻标题 |
| `content` | `string` | �?| 新闻正文 |
| `url` | `string` | �?| 原文链接 |
| `source` | `string` | �?| 新闻来源，如 `财联社`、`mock` |
| `category` | `string` | �?| 新闻分类，如 `个股`、`行业`、`宏观` |
| `publishTime` | `string` | �?| 发布时间（ISO 8601 格式�?|
| `fetchTime` | `string` | �?| 抓取时间（ISO 8601 格式�?|
| `sentiment` | `'positive' \| 'negative' \| 'neutral'` | �?| 情感标签，见 §2.1 |
| `sentimentConfidence` | `number` | �?| 情感分析置信�?0-1 |
| `relatedStocks` | `string[]` | �?| 关联股票代码列表 |
| `keywords` | `string[]` | �?| 关键词列�?|
| `hash` | `string` | �?| 内容哈希值（DJB2 算法），用于去重 |

**数据来源**：`newsService.saveNewsArticle()` �?`dataLayer.news.save()`  
**数据去向**：`useNewsStore().newsList` �?`NewsPage` 展示  
**更新频率**：按需采集

#### 1.2 NewsStockMap �?股票-资讯多对多关�?
**来源**: `src/data/types.ts:582-590`

| 字段 | 类型 | 必填 | 描述 |
|------|------|------|------|
| `id` | `string` | �?| 关联 ID，格�?`{symbol}_{newsId}` |
| `symbol` | `string` | �?| 股票代码 |
| `newsId` | `string` | �?| 新闻 ID |
| `relevanceScore` | `number` | �?| 关联度评�?0-1 |
| `isTitleMatch` | `boolean` | �?| 是否标题匹配 |
| `isContentMatch` | `boolean` | �?| 是否正文匹配 |
| `industryMatch` | `boolean` | �?| 是否行业匹配 |

#### 1.3 SentimentCache �?情感分析缓存

**来源**: `src/data/types.ts:593-601`

| 字段 | 类型 | 必填 | 描述 |
|------|------|------|------|
| `id` | `string` | �?| 缓存 ID，格�?`sent_{contentHash}` |
| `contentHash` | `string` | �?| 内容哈希�?|
| `sentiment` | `'positive' \| 'negative' \| 'neutral'` | �?| 情感标签 |
| `confidence` | `number` | �?| 置信�?0-1 |
| `method` | `'rule' \| 'llm' \| 'hybrid'` | �?| 分析方法 |
| `analyzedAt` | `number` | �?| 分析时间（毫秒时间戳�?|
| `llmModel` | `string` | �?| 使用�?LLM 模型名称 |

#### 1.4 SentimentResult �?情感分析结果

**来源**: `src/services/news/sentimentAnalyzer.ts:6-10`

| 字段 | 类型 | 必填 | 描述 |
|------|------|------|------|
| `sentiment` | `SentimentLabel` | �?| 情感标签，见 §2.1 |
| `confidence` | `number` | �?| 置信�?0-1 |
| `score` | `number` | �?| 标准化分�?[-1, +1] |

#### 1.5 StockInfo �?股票信息（链接器输入�?
**来源**: `src/services/news/stockLinker.ts:4-8`

| 字段 | 类型 | 必填 | 描述 |
|------|------|------|------|
| `symbol` | `string` | �?| 股票代码，如 `600519.SH` |
| `name` | `string` | �?| 股票名称 |
| `industry` | `string` | �?| 所属行�?|

#### 1.6 StockLink �?股票链接结果

**来源**: `src/services/news/stockLinker.ts:10-17`

| 字段 | 类型 | 必填 | 描述 |
|------|------|------|------|
| `symbol` | `string` | �?| 股票代码 |
| `name` | `string` | �?| 股票名称 |
| `matchType` | `'exact_code' \| 'exact_name' \| 'fuzzy_name' \| 'industry'` | �?| 匹配类型，见 §2.2 |
| `confidence` | `number` | �?| 匹配置信�?0-1 |
| `source` | `'title' \| 'content'` | �?| 匹配来源（标�?正文�?|
| `matchedKeyword` | `string` | �?| 匹配到的关键�?|

#### 1.7 LinkerConfig �?股票链接器配�?
**来源**: `src/services/news/stockLinker.ts:19-29`

| 字段 | 类型 | 必填 | 默认�?| 描述 |
|------|------|------|--------|------|
| `enableExactCode` | `boolean` | �?| `true` | 启用代码精确匹配 |
| `enableExactName` | `boolean` | �?| `true` | 启用名称精确匹配 |
| `enableFuzzy` | `boolean` | �?| `true` | 启用模糊匹配 |
| `enableIndustry` | `boolean` | �?| `true` | 启用行业匹配 |
| `minFuzzyLength` | `number` | �?| `3` | 模糊匹配最小长�?|
| `confidenceThreshold` | `number` | �?| `0.3` | 置信度阈�?|
| `maxLinks` | `number` | �?| `5` | 每篇文章最大关联股票数 |
| `titleWeight` | `number` | �?| `1.5` | 标题权重 |
| `contentWeight` | `number` | �?| `1.0` | 正文权重 |

#### 1.8 newsService �?服务层函数签�?
**来源**: `src/services/news/newsService.ts`

| 函数 | 签名 | 描述 |
|------|------|------|
| `saveNewsArticle` | `(article, options?) => Promise<DataLayerResult<NewsArticle>>` | 保存单篇新闻（含情感分析 + 股票关联�?|
| `saveNewsArticles` | `(articles, options?) => Promise<DataLayerResult<NewsArticle[]>>` | 批量保存新闻 |
| `listNews` | `(options?) => Promise<DataLayerResult<NewsArticle[]>>` | 按条件筛选新闻列�?|
| `getNewsBySymbol` | `(symbol) => Promise<DataLayerResult<NewsArticle[]>>` | 按股票代码获取关联新�?|
| `getNewsByHash` | `(hash) => Promise<DataLayerResult<NewsArticle \| undefined>>` | 按哈希查�?|
| `generateMockArticles` | `(count?) => NewsArticle[]` | 生成模拟新闻数据 |

---

### 第二部分：枚举常量定�?
#### 2.1 SentimentLabel �?情感标签

**来源**: `src/services/news/sentimentAnalyzer.ts:4`

| 枚举�?| 描述 |
|--------|------|
| `'positive'` | 正面 |
| `'negative'` | 负面 |
| `'neutral'` | 中�?|

#### 2.2 StockLinkMatchType �?股票匹配类型

**来源**: `src/services/news/stockLinker.ts:13`

| 枚举�?| 置信度基�?| 描述 |
|--------|-----------|------|
| `'exact_code'` | 0.95 | 六位代码精确匹配 |
| `'exact_name'` | 0.90 | 股票名称完全匹配 |
| `'fuzzy_name'` | 0.70 | 名称前缀模糊匹配�?-4 字） |
| `'industry'` | 0.50 | 行业关键词匹�?|

#### 2.3 情感词典常量

**来源**: `src/services/news/sentimentAnalyzer.ts:13-85`

| 常量 | 类型 | 条目�?| 描述 |
|------|------|--------|------|
| `POSITIVE_WORDS` | `string[]` | 25 | 正面情感词（�?增长、大涨、涨停） |
| `NEGATIVE_WORDS` | `string[]` | 25 | 负面情感词（�?下跌、暴跌、亏损） |
| `NEGATION_WORDS` | `string[]` | 9 | 否定词（�?不、没有、未�?|
| `DEGREE_WORDS` | `Array<{word, multiplier}>` | 10 | 程度副词（如 非常=1.5x, 略有=0.7x�?|

#### 2.4 行业关键词映�?
**来源**: `src/services/news/stockLinker.ts:44-55`

| 行业 | 关键�?|
|------|--------|
| 银行 | 银行、降准、降息、信贷、息差、不良资�?|
| 白酒 | 白酒、茅台、五粮液、酱香、浓香、国�?|
| 新能源汽�?| 新能源汽车、电动车、锂电池、动力电池、新能源�?|
| 医药 | 医药、创新药、医疗器械、集采、生物药 |
| 非银金融 | 券商、保险、证券、投行、资�?|
| 食品饮料 | 食品、饮料、乳业、牛奶、调味品 |
| 电力设备 | 光伏、风电、储能、新能源、逆变器、硅�?|
| 电子 | 芯片、半导体、集成电路、晶圆、封测、光�?|
| 房地�?| 房地产、楼市、房价、拿地、土�?|
| 计算�?| 人工智能、AI、大模型、算力、云计算、软�?|

#### 2.5 内置股票�?
**来源**: `src/services/news/stockLinker.ts:58-77`  
**用�?*: 测试与兜底使用的 A 股股票列表，�?18 �?
| 代码 | 名称 | 行业 |
|------|------|------|
| `600000.SH` | 浦发银行 | 银行 |
| `600519.SH` | 贵州茅台 | 白酒 |
| `000858.SZ` | 五粮�?| 白酒 |
| `002594.SZ` | 比亚�?| 新能源汽�?|
| `300750.SZ` | 宁德时代 | 新能源汽�?|
| `600036.SH` | 招商银行 | 银行 |
| `601318.SH` | 中国平安 | 非银金融 |
| `000333.SZ` | 美的集团 | 家用电器 |
| `600276.SH` | 恒瑞医药 | 医药 |
| `002415.SZ` | 海康威视 | 电子 |
| `600887.SH` | 伊利股份 | 食品饮料 |
| `601012.SH` | 隆基绿能 | 电力设备 |
| `300059.SZ` | 东方财富 | 非银金融 |
| `002230.SZ` | 科大讯飞 | 计算�?|
| `600030.SH` | 中信证券 | 非银金融 |
| `601888.SH` | 中国中免 | 商贸零售 |
| `000002.SZ` | 万科A | 房地�?|
| `601398.SH` | 工商银行 | 银行 |

---

### 第三部分：数据流�?
```
┌─────────────────────────────────────────────────────────────────�?�? News 模块数据�?                                                �?�?                                                                �?�? 外部数据�?�?newsService.saveNewsArticle()                      �?�?      �?                                                       �?�?      ├── 1. 内容哈希去重 (buildHash �?getByHash)               �?�?      �?                                                       �?�?      ├── 2. 情感分析                                            �?�?      �?  getOrAnalyzeSentiment(content)                        �?�?      �?  ├── 命中缓存 �?返回 SentimentCache                     �?�?      �?  └── 未命�?�?analyzeText() �?classifySentiment()      �?�?      �?      └── 写入 SentimentCache                           �?�?      �?                                                       �?�?      ├── 3. 股票关联                                            �?�?      �?  linkArticleToStocks(article, stockLibrary)            �?�?      �?  ├── buildStockMap() 构建股票索引                       �?�?      �?  ├── matchText(title) 标题匹配                          �?�?      �?  ├── matchText(content) 正文匹配                        �?�?      �?  └── 取最佳匹�?�?填充 relatedStocks                    �?�?      �?                                                       �?�?      ├── 4. 写入 IndexedDB                                      �?�?      �?  ├── dataLayer.news.save(fullArticle)                  �?�?      �?  └── dataLayer.newsStockMap.save(map)                  �?�?      �?                                                       �?�?      └── 5. 返回 fullArticle                                   �?�?                                                                �?�? 查询路径:                                                       �?�?   listNews({ source, category, sentiment, symbol, keyword })   �?�?   �?dataLayer.news.list() �?内存过滤 �?排序返回                 �?�?                                                                �?�? IndexedDB Store: news, news_stock_map, sentiment_cache         �?└─────────────────────────────────────────────────────────────────�?```

**数据来源**：外部财�?API / Mock 数据 �?`newsService.saveNewsArticle()`  
**数据去向**：IndexedDB `news` Store �?`NewsPage` 展示  
**更新频率**：按需采集（非轮询�?
---

## 五、变更日�?
| 日期 | 版本 | 变更内容 | 变更�?| 关联差异 |
|------|------|----------|--------|---------|
| 2026-06-26 | v1.0.0 | 生成 Cockpit + News 模块文档修正方案，覆�?8 项差�?| Architecture Asset Governor | DIFF-001,004,006,007,008,014,019,020 |