# FinSight V9 数据采集舱全面重检与可行性评估报告

> 生成日期: 2026-08-17
> 基线: 全工作区扫描 + 交叉验证
> 范围: 采集维度对照、系统集成方法、采集策略、数据存储链路、可行性评估

---

## 一、采集舱整体配置全景

### 1.1 配置层 (src/config/collectConfig.ts)

| 配置项 | 内容 | 状态 |
|--------|------|------|
| 采集维度 | 10 维度 (01-10) | ✅ 已定义 |
| 策略模板 | 5 套 (value / growth / defense / cycle / full) | ✅ 已定义 |
| 频率枚举 | 10 级 (realtime → manual) | ✅ 已定义 |
| 数据源类型 | 7 种 (akshare / ifind / tushare / yahoo / tianyancha / scholar / cache) | ✅ 已定义 |
| 字段注册表 | 10 维度 × 若干字段 (共 50+ 字段) | ✅ 已定义 |
| 全局限流 | 500 标的 / 50 批量 / 10/min / 200/h / 2000/day | ✅ 已定义 |
| 重试策略 | maxRetries=2, backoff×2, 500ms 初始延迟 | ✅ 已定义 |
| 超时策略 | 请求 5s, 维度 30s | ✅ 已定义 |
| 降级策略 | allowFallback=true, allowMockFallback=!PROD, alertRate=80% | ✅ 已定义 |
| API 端点映射 | 10 维度 → 对应 REST API 路径 | ✅ 已定义 |
| 连通性测试 | 5 个端点 (akshare/ifind/yahoo/tianyancha/scholar) | ✅ 已定义 |

### 1.2 类型层 (src/types/modules/collection.types.ts)

| 类型 | 用途 | 状态 |
|------|------|------|
| `DimensionConfig` | 单维度基础配置 | ✅ |
| `DimensionPipelineConfig` | 维度流水线配置 (+sourcePriority/concurrency/retry/timeout/fallback) | ✅ |
| `StrategyTemplate` | 策略模板 (5 套) | ✅ |
| `GlobalCollectPolicy` | 全局采集策略 | ✅ |
| `CollectionConfig` | 完整采集配置 (可持久化) | ✅ |
| `CollectionLifecycleEvent` | 10 种生命周期事件 | ✅ |
| `CollectionTraceSpan` | 链路追踪段 | ✅ |
| `CollectionWizardState` | 4 步采集向导状态 | ✅ |
| `SourceCollectionResult<T>` | 单源采集结果 | ✅ |
| `BatchCollectionResult<T>` | 批量采集结果 | ✅ |

### 1.3 服务层 (src/services/data-collector/)

| 文件 | 职责 | 状态 |
|------|------|------|
| `collectionPipeline.ts` | 采集流水线编排 (配置→执行→写入) | ✅ |
| `dataSourceOrchestrator.ts` | 多源降级链编排 | ✅ |
| `adaptiveSourceOrchestrator.ts` | 自适应源健康检测 | ✅ |
| `multiSourceFetcher.ts` | 多源数据抓取 | ✅ |
| `qualityMetricsCollector.ts` | 质量指标采集 | ✅ |
| `DataIntegrityGuard.ts` | 数据完整性守卫 | ✅ |
| `missingReportDetector.ts` | 缺失数据检测 → 补采任务 | ✅ |
| `collectionReportService.ts` | 采集报告生成 | ✅ |
| `collectedDataSyncService.ts` | 数据同步 | ✅ |
| `tracePersistenceService.ts` | 链路追踪持久化 | ✅ |
| `TaskScheduler.ts` | 任务调度 | ✅ |
| `SourcePriorityManager.ts` | 源优先级管理 | ✅ |
| `MarketDataAdapter.ts` | 行情数据格式统一 | ✅ |

### 1.4 采集器 (src/services/data-collector/collectors/)

| 采集器 | 类型 | 状态 |
|--------|------|------|
| `BaseCollector.ts` | 基类 | ✅ |
| `RestCollector.ts` | REST API | ✅ |
| `WebSocketCollector.ts` | WebSocket 实时 | ✅ |
| `NewsCrawler.ts` | 新闻爬虫 | ✅ |
| `LiveCollector.ts` | 实时行情 | ✅ |
| `MockCollector.ts` | Mock 降级 | ✅ |

### 1.5 数据源适配器

| 适配器 | 覆盖维度 | 状态 |
|--------|---------|------|
| `westockMcpSource.ts` | 04/05/08 (新闻/公告/研报) | ⚠️ 待激活 |
| `tencentNewsMcpSource.ts` | 05 (热点新闻) | ⚠️ 待激活 |
| `tushareProvider.ts` | 01/02/09 (行情/K线/财务) | ✅ 已集成 |
| `tushareAdapter.ts` | 同上 | ✅ |
| `crawlerProvider.ts` | 04/05 (爬虫) | ✅ |
| `directDataAPI.ts` | 01/02 (腾讯直连行情) | ✅ 已验证 |
| `llmSearchAgent.ts` | 05/06 (LLM 增强搜索) | ✅ |

### 1.6 状态层 (Store)

| Store | 职责 | 状态 |
|-------|------|------|
| `sevenDimConfigStore` | 10 维度采集管线配置管理 (CRUD + 执行 + 进度) | ✅ |
| `collectionRuntimeStore` | 运行时状态 (traceSpans/logs/taskStatuses/stats) | ✅ |
| `collectionWizardStore` | 4 步采集向导 | ✅ |

### 1.7 存储层 (IndexedDB: V6ProDB v32)

| Object Store | 用途 | 与采集关系 |
|-------------|------|-----------|
| `stocks` | 股票基础信息 | 维度 01 产出 |
| `daily_quotes` | K线/行情 | 维度 02 产出 |
| `financial_reports` | 财务数据 | 维度 09 产出 |
| `news` | 新闻 | 维度 04/05 产出 |
| `news_stock_map` | 新闻-股票映射 | 关联索引 |
| `sentiment_cache` | 舆情缓存 | 维度 05 产出 |
| `research_logs` | 研报日志 | 维度 08 产出 |
| `sector_scores` | 行业评分 | 维度 06/07 产出 |
| `rotation_scores` | 轮动评分 | 交叉分析 |
| `hot_sector_scores` | 热门板块评分 | 维度 10 产出 |
| `collect_config` | 采集配置 | 持久化 |
| `trace_records` | 链路追踪 | 采集日志 |
| `collection_history` | 采集历史 | 审计 |
| `conflict_log` | 冲突日志 | 质量保障 |
| `missing_reports` | 缺失报告 | 补采触发 |

### 1.8 Stock-Collector 原型 (stock-collector/index.html)

| 页面 | 功能 | 与 V9 系统关系 |
|------|------|---------------|
| 股票录入 | 手动 + 批量导入 + 快捷模板 | 对应 `intentionPoolStore` |
| 热门板块 | 8 板块 × 推荐股票 | 对应 `hot_sector_scores` |
| 筛选池 | 汇总 + 筛选 + 全选 | 对应 `poolStocks` |
| 维度采集 | 8 维度进度 + 整体进度 | 对应 `collectProgress` |
| 采集策略 | 数据源/频率/留存/并发配置 | 对应 `collectConfig` + `CollectionWizardState` |
| 数据存储 | 目录树 + 存储详情 + 导出 | 对应 `dataLayer` + IndexedDB |

---

## 二、采集维度对照汇总 (三层维度体系交叉验证)

### 2.1 三层维度定义对照

| 编号 | Stock-Collector 原型 (D1-D8) | collectConfig.ts (10维) | collection-contract.md (8维) | 重要性 |
|------|------------------------------|------------------------|------------------------------|--------|
| D1/01 | 行情数据 (实时价量额换手率) | 基本信息 (name/industry/marketCap/PE/PB/ROE) | 基本信息 (quote → stocks) | low |
| D2/02 | 财务数据 (营收利润ROE现金流) | K线数据 (open/close/high/low/vol/MA) | K线数据 (kline → dailyQuotes) | medium |
| D3/03 | 技术指标 (MACD/KDJ/RSI/均线) | 筹码分布 (chip/holderCount/cost) | 筹码分布 (chip → news mock) | high |
| D4/04 | 资金流向 (主力净流入/大单动向) | 重大事项 (announcements/notices/reports) | 重大事项 (news → news mock) | high |
| D5/05 | 机构持仓 (基金/北向/社保) | 热点新闻 (title/summary/source/url) | 热点新闻 (news → news mock) | medium |
| D6/06 | 新闻舆情 (公告/研报/社交媒体) | 行业竞品 (rank/competitors/marketShare) | 行业竞品 (competitor → sectorScores mock) | medium |
| D7/07 | 行业对比 (同业估值/市占率) | 关联指数 (indexCode/etf/correlation) | 关联指数 (index → sectorScores mock) | low |
| D8/08 | 估值分析 (DCF/PE-PB Band/PEG) | 研报中心 (reportTitle/rating/target/analyst) | 研报中心 (research → researchLogs mock) | critical |
| —/09 | — | 财务数据 (revenue/netProfit/ROE/CF/eps) | — | critical |
| —/10 | — | 热门板块 (sectorCode/score/signal/五因子) | — | high |

### 2.2 维度差异分析 (关键发现)

**三层体系存在显著不一致**，需要关注：

1. **原型 D2 (财务数据) 与 collectConfig 02 (K线数据) 语义错位**：
   - 原型 D2 = 营收/利润/ROE/现金流 → 对应 collectConfig 维度 09 (财务数据)
   - collectConfig 02 = K线数据 → 原型未单独列出

2. **原型 D3 (技术指标) 与 collectConfig 03 (筹码分布) 语义错位**：
   - 原型 D3 = MACD/KDJ/RSI/均线 → 属于技术分析，在 collectConfig 中无直接对应维度
   - collectConfig 03 = 筹码分布 → 原型未单独列出

3. **原型 D4 (资金流向) 与 collectConfig 04 (重大事项) 语义错位**：
   - 原型 D4 = 主力净流入/大单动向 → 在 collectConfig 中无直接对应
   - collectConfig 04 = 重大事项/公告 → 原型 D6 部分覆盖

4. **原型 D8 (估值分析) 与 collectConfig 08 (研报中心) 语义错位**：
   - 原型 D8 = DCF/PE-PB Band/PEG → 估值建模
   - collectConfig 08 = 研报中心 → 机构研报
   - 估值分析能力在 collectConfig 中分散于 01 (PE/PB) 和 09 (财务)

5. **collectConfig 比原型多 2 个维度** (09 财务数据、10 热门板块)，但原型缺少技术指标、资金流向、估值分析三个独立维度

### 2.3 建议：统一维度体系 (推荐 12 维度)

| 编号 | 维度名称 | 数据来源 | 目标 Store | 原型对应 | 重要性 |
|------|---------|---------|-----------|---------|--------|
| 01 | 基本信息 | 腾讯/akshare | stocks | D1(部分) | low |
| 02 | K线数据 | 腾讯直连/akshare | daily_quotes | — | medium |
| 03 | 技术指标 | 基于 K线计算 | (派生) | D3 | high |
| 04 | 资金流向 | 东财 push2 | (新增) | D4 | high |
| 05 | 筹码分布 | 东财/akshare | (新增) | — | high |
| 06 | 机构持仓 | 东财/akshare | (新增) | D5 | high |
| 07 | 重大事项 | 东财/akshare | news | D6(部分) | high |
| 08 | 热点新闻 | 东财/akshare | news | D6(部分) | medium |
| 09 | 行业竞品 | 东财/akshare | sector_scores | D7 | medium |
| 10 | 关联指数 | 腾讯/akshare | sector_scores | D7(部分) | low |
| 11 | 研报中心 | 东财/ifind | research_logs | D6(部分) | critical |
| 12 | 财务数据 | ifind/akshare | financial_reports | D2 | critical |
| 13 | 估值分析 | 基于财务计算 | (派生) | D8 | high |
| 14 | 热门板块 | akshare | hot_sector_scores | — | high |

---

## 三、系统集成方法与采集策略分析

### 3.1 三层架构集成方法

```
┌─────────────────────────────────────────────────────────────┐
│  Layer 1 — 实时快数据 (浏览器直连 + Vite Proxy)                │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  腾讯 qt.gtimg.cn     → 行情 (维度 01)    ✅ 已验证    │  │
│  │  腾讯 ifzq.gtimg.cn   → K线 (维度 02)     ✅ 已验证    │  │
│  │  新浪 hq.sinajs.cn    → 行情备份 (维度 01) ✅ 已验证    │  │
│  │  Vite proxy           → CORS 解除 + 路径重写           │  │
│  └───────────────────────────────────────────────────────┘  │
│  ↓ 数据流: directDataAPI.ts → DataBridgeWriter → IndexedDB  │
├─────────────────────────────────────────────────────────────┤
│  Layer 2 — A股特有维度 (Python ETL 定时批量)                  │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  东财 push2.eastmoney.com → 资金流/龙虎榜/行业          │  │
│  │  东财 data.eastmoney.com  → 研报/公告/新闻              │  │
│  │  AkShare Python           → 财务/宏观/股东数/板块       │  │
│  │  Flask/FastAPI localhost  → Python ETL Bridge          │  │
│  └───────────────────────────────────────────────────────┘  │
│  ↓ 数据流: Python → HTTP JSON → Vite proxy → IndexedDB     │
├─────────────────────────────────────────────────────────────┤
│  Layer 3 — 本地交叉验证 + 质量门禁                             │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  crossValidator.ts       → 双源对比 (>1% 偏差告警)      │  │
│  │  DataIntegrityGuard.ts   → 完整性校验                   │  │
│  │  missingReportDetector   → 缺失检测 → 补采任务          │  │
│  │  qualityMetricsCollector → 采集统计 + 质量 KPI          │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### 3.2 采集策略矩阵

| 策略模板 | 维度 | 频率 | 回溯天数 | 数据源 | 适用场景 |
|---------|------|------|---------|--------|---------|
| **value** (价值投资) | 01-04 | daily | 252 | akshare/ifind | 长线持有，重基本面 |
| **growth** (成长投资) | 01/02/03/05/06 | daily | 126 | akshare/yahoo | 成长股，重行业趋势 |
| **defense** (防御配置) | 01/02/03/07 | weekly | 504 | akshare/ifind | 熊市避险，重指数 |
| **cycle** (周期轮动) | 01/02/05/06/07/10 | daily | 252 | akshare/yahoo | 板块轮动，重资金 |
| **full** (全维度) | 01-10 | daily | 756 | akshare/ifind/yahoo | 深度研究，全覆盖 |

### 3.3 数据源优先级链 (buildDefaultSourcePriority)

业务数据源 → 直连行情源映射规则：

| 业务源 | 映射到直连源 | 降级链 |
|--------|------------|--------|
| `akshare` | tencent → sina → akshare | 腾讯优先 → 新浪 → AkShare |
| `ifind` | tencent → sina | 腾讯优先 → 新浪 |
| `yahoo` | tencent → sina | 腾讯优先 → 新浪 |
| `tianyancha` | mock | 仅 Mock |
| `scholar` | mock | 仅 Mock |
| `cache` | mock | 仅 Mock |

### 3.4 全局限流策略

| 参数 | 值 | 说明 |
|------|-----|------|
| maxSymbols | 500 | 最大标的数 |
| defaultBatchSize | 50 | 默认批量大小 |
| rateLimitPerMinute | 10 | 每分钟限流 |
| rateLimitPerHour | 200 | 每小时限流 |
| rateLimitPerDay | 2000 | 每天限流 |
| l1CacheTtl | 300s | L1 缓存 TTL |

### 3.5 月度 API 调用量模型

以 20 只标的为例，全维度 (full) 策略：

| 维度 | 频率 | 分钟间隔 | 月调用次数 |
|------|------|---------|-----------|
| 01 基本信息 | monthly | 43200 | 1 |
| 02 K线 | daily | 1440 | 30 |
| 03 筹码 | 3d | 4320 | 10 |
| 04 重大事项 | daily | 1440 | 30 |
| 05 热点新闻 | daily | 1440 | 30 |
| 06 行业竞品 | weekly | 10080 | 5 |
| 07 关联指数 | weekly | 10080 | 5 |
| 08 研报中心 | daily | 1440 | 30 |
| 09 财务数据 | quarterly | 129600 | 1 |
| 10 热门板块 | daily | 1440 | 30 |
| **合计** | | | **~172 次/月** |

20 只标的约 172 次/月，远低于限流 2000 次/天，限流安全。

---

## 四、数据存储与数据链关系可行性评估

### 4.1 数据链全路径 (端到端)

```
┌──────────────────────────────────────────────────────────────────────┐
│  输入层                                                               │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐  │
│  │ 手动录入 + 批量导入│  │ 热门板块推荐       │  │ 快捷模板           │  │
│  │ (stock-collector) │  │ (SECTOR_DATA)     │  │ (TEMPLATES)       │  │
│  └────────┬─────────┘  └────────┬─────────┘  └────────┬─────────┘  │
│           │                     │                     │              │
│           └─────────────────────┼─────────────────────┘              │
│                                 ▼                                    │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │  意向股票筛选池 (poolStocks)                                    │   │
│  │  intentionPoolStore → 标的选择 + 策略匹配                       │   │
│  └──────────────────────────────┬───────────────────────────────┘   │
│                                 │                                    │
│                                 ▼                                    │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │  采集配置层 (sevenDimConfigStore)                               │   │
│  │  CollectionConfig → DimensionPipelineConfig[] → 策略模板        │   │
│  │  ↓ DataBridge.forward(SAVE_COLLECT_CONFIG)                     │   │
│  │  ↓ IndexedDB::collect_config (持久化)                          │   │
│  └──────────────────────────────┬───────────────────────────────┘   │
│                                 │                                    │
│                                 ▼                                    │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │  采集执行层 (collectionPipeline.ts)                             │   │
│  │  Promise.allSettled 并发执行全部启用维度                         │   │
│  │  ↓ 每维度: buildDefaultSourcePriority() → 降级链               │   │
│  │  ↓ dataSourceOrchestrator.fetchQuoteWithConfig()               │   │
│  │  ↓ multiSourceFetcher.fetchDimensionData()                     │   │
│  │  ↓ 阶段 emit COLLECTION_EVENTS.*                               │   │
│  └──────────────────────────────┬───────────────────────────────┘   │
│                                 │                                    │
│                                 ▼                                    │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │  数据写入层 (DataBridge 信封协议)                                │   │
│  │  EnvelopeFactory.create({ source, target, action, payload })   │   │
│  │  ↓ DataBridge.forward() → ACL 校验 → routeToDB                │   │
│  │  ↓ dataLayer → IndexedDB::daily_quotes/stocks/news/...        │   │
│  │  ↓ 每笔写入附带 dataProvenance (real/mock/unknown)             │   │
│  └──────────────────────────────┬───────────────────────────────┘   │
│                                 │                                    │
│                                 ▼                                    │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │  质量门禁层                                                     │   │
│  │  auditRecord() → 写入后断言 (关键字段非空)                      │   │
│  │  recordCollect()/recordWrite() → 采集统计                      │   │
│  │  missingReportDetector → 缺失检测 → 补采任务                   │   │
│  │  refreshStats() → collectionRuntimeStore.stats 更新            │   │
│  └──────────────────────────────┬───────────────────────────────┘   │
│                                 │                                    │
│                                 ▼                                    │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │  消费层                                                         │   │
│  │  DataBridge.query() → 评分引擎 (V6/intelligent/industry)       │   │
│  │  stock-collector 原型 → 维度采集进度展示                        │   │
│  │  数据存储 (Page 6) → 本地目录导出                               │   │
│  └──────────────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────────────┘
```

### 4.2 数据存储架构评估

**存储层架构**：

| 组件 | 技术 | 评估 |
|------|------|------|
| 数据库 | IndexedDB (V6ProDB v32) | ✅ 成熟稳定，40+ Object Store |
| 信封协议 | DataBridge (forward/query/subscribe) | ✅ ACL + 审计 + 路由 |
| 信封工厂 | EnvelopeFactory (create/validate) | ✅ 标准化元数据 |
| 数据访问 | dataLayer (barrel 聚合) | ✅ 统一入口 |
| 关联映射 | ACTION_TO_STORE_MAP | ✅ 显式映射，可审计 |
| 持久化 | DataBridgeWriter adapter | ✅ 附 provenance + source 元数据 |

**存储可行性判定**：

| 维度 | 目标 Store | 当前状态 | 可行性 |
|------|-----------|---------|--------|
| 01 基本信息 | stocks | ✅ 真实数据 | 🟢 可行 |
| 02 K线 | daily_quotes | ✅ 真实数据 (腾讯直连) | 🟢 可行 |
| 03 筹码 | (需新增 store) | 🔴 100% Mock | 🔴 需东财端点接入 |
| 04 重大事项 | news | 🟡 Mock/HTML | 🟡 需东财 RSS/API |
| 05 热点新闻 | news | 🟡 Mock/HTML | 🟡 需东财 RSS/API |
| 06 行业竞品 | sector_scores | 🔴 端点不可达 | 🔴 需东财行业 API |
| 07 关联指数 | sector_scores | 🟡 价格通/相关性未算 | 🟡 需 P2 启用计算 |
| 08 研报中心 | research_logs | 🔴 无可用端点 | 🔴 需东财/MCP 接入 |
| 09 财务数据 | financial_reports | ✅ 已集成 ifind | 🟢 可行 |
| 10 热门板块 | hot_sector_scores | ✅ 已集成 akshare | 🟢 可行 |

**整体可行性：4 维度可行 / 4 维度需适配 / 2 维度不可行**

### 4.3 数据链完整性评估

**已验证链路** (端到端通过)：

1. **行情链路**：腾讯 qt.gtimg.cn → Vite Proxy → directDataAPI → DataBridge → IndexedDB::stocks ✅
2. **K线链路**：腾讯 ifzq.gtimg.cn → Vite Proxy → dataSourceOrchestrator → DataBridge → IndexedDB::daily_quotes ✅
3. **配置持久化**：sevenDimConfigStore → DataBridge.forward(SAVE_COLLECT_CONFIG) → IndexedDB::collect_config ✅
4. **链路追踪**：COLLECTION_EVENTS.* → collectionRuntimeStore → tracePersistenceService → IndexedDB::trace_records ✅
5. **质量门禁**：auditRecord → recordCollect/recordWrite → refreshStats → collectionRuntimeStore.stats ✅

**待验证链路** (P2)：

1. **东财端点链**：push2.eastmoney.com → Python ETL → Flask → Vite Proxy → DataBridge → IndexedDB
2. **交叉验证链**：crossValidator → 双源对比 → 偏差告警
3. **MCP 连接器链**：westock-mcp → 结构化新闻/研报 → DataBridge → IndexedDB

### 4.4 数据存储本地化方案 (stock-collector 原型 Page 6)

原型中定义的本地存储方案与 V9 主系统存在差异：

| 方面 | V9 主系统 | Stock-Collector 原型 | 差距 |
|------|----------|---------------------|------|
| 存储介质 | IndexedDB (浏览器) | 本地文件系统 (模拟) | 原型未对接 IndexedDB |
| 目录结构 | 扁平 Object Store | `data/{code}_{name}/` 树形 | 需映射方案 |
| 数据格式 | 结构化 JSON (信封) | 模拟 JSON 文件 | 格式需统一 |
| 导出方式 | DataBridge.query() | 浏览器下载 Blob | 可对接 |
| 版本管理 | DB_VERSION (v32) | 无 | 需增加 |

**建议**: 原型 Page 6 的本地存储应映射到 V9 的 IndexedDB 架构：
- `data/{code}_{name}/` → IndexedDB Object Store 的 `code` 索引
- 8 维度文件 → 对应各 Object Store 的数据
- 下载功能 → DataBridge.query() + 序列化导出

---

## 五、关键发现与行动项

### 5.1 关键发现

| # | 发现 | 严重程度 | 影响 |
|---|------|---------|------|
| 1 | **三层维度定义不一致**：原型 (8维)、collectConfig (10维)、契约 (8维) 的维度编号、名称、语义存在错位 | P1 | 用户在不同界面看到不同维度定义，混淆 |
| 2 | **原型缺失关键维度**：技术指标、资金流向、机构持仓、估值分析在 collectConfig 中无独立维度 | P1 | 数据采集覆盖不完整 |
| 3 | **4 个维度仍为 Mock**：筹码(03)、竞品(06)、研报(08) 均为 Mock 数据 | P1 | 数据不可用，影响分析结论 |
| 4 | **原型与 V9 主系统存储方案未对接**：原型使用模拟文件系统，V9 使用 IndexedDB | P2 | 原型无法直接复用 V9 数据 |
| 5 | **东财端点方案已有详细设计但未执行**：collection-solution-comparison.md 推荐方案 D，P2 任务已列出但未完成 | P2 | 4 个 Mock 维度无法解锁 |
| 6 | **Python ETL Bridge 未实现**：方案 D 的 Phase 2 未动工 | P2 | 非行情维度无法采集 |
| 7 | **跨层交叉验证未实现**：crossValidator 未开发 | P2 | 单源数据错误无法检测 |

### 5.2 推荐行动项

| 优先级 | 行动 | 影响维度 | 预估工时 |
|--------|------|---------|---------|
| **P0** | 统一三层维度定义，建立 12 维度标准体系 | 全部 | 2h |
| **P0** | 更新 stock-collector 原型，对齐 collectConfig 维度命名 | 原型 | 1h |
| **P1** | 东财公开 JSON 端点接入 (资金流/行业/研报/公告) | 03/04/05/06/08 | 3h |
| **P1** | Python ETL Bridge 实现 (Flask → localhost:8000) | 全部非行情维度 | 2h |
| **P1** | Vite proxy 新增 `/api/proxy/eastmoney/*` 规则 | 全部非行情维度 | 0.5h |
| **P2** | 原型 Page 6 对接 IndexedDB (DataBridge.query) | 原型 | 1.5h |
| **P2** | 交叉验证层 crossValidator 实现 | 全部 | 2h |
| **P2** | 维度 07 相关性计算 (基于 K 线数据) | 07 | 1.5h |
| **P3** | 激活 westock-mcp 连接器 (备用) | 04/05/08 | 1h |

---

## 六、总评

FinSight V9 数据采集舱在**架构设计层面**已经相当成熟：
- 10 维度配置体系完整，5 套策略模板覆盖主要投资风格
- DataBridge 信封协议 + IndexedDB 存储链经过 P0-P1 整改已稳定
- 质量门禁 (auditRecord/recordCollect/refreshStats) 三重保障到位
- 采集链路追踪 (COLLECTION_EVENTS + tracePersistenceService) 可观测性良好

**核心短板**在于：
1. 维度定义三层不一致，需要统一标准化
2. 非行情维度 (03-08) 数据源仍以 Mock 为主，需要执行已设计的方案 D (东财端点)
3. Stock-Collector 原型与 V9 主系统之间的数据桥接尚未建立

**可行性结论**：行情/K线/财务/热门板块 4 个维度可行；其余 6 个维度在完成 P1 行动项后可达到可行状态。建议优先执行 P0 维度统一和 P1 东财端点接入，2-3 个工作日可将整体可行性从 40% 提升至 80%+。