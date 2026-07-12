---
title: news-contract.md — 新闻资讯子域接口契约
status: draft
owner: 架构组
updated: 2026-07-12
---

# news-contract.md — 新闻资讯子域接口契约

> **定位**：定义 `news` 子域的接口契约、职责边界、数据流与依赖关系。  
> **关联**：`../../architecture/services-catalog.md`（24 子域总览）、`AGENTS.md` §一（分层规则）。

---

## 1. 职责边界

### 1.1 核心职责

1. **新闻资讯采集与存储**：接收外部新闻数据（`newsService.ts`），执行去重（DJB2 哈希）、情感分析、股票关联后，写入 `dataLayer.news` 与 `newsStockMap` 双表；提供多维度查询（来源、分类、情感、股票、关键词、时间范围）。
2. **规则式情感分析**（`sentimentAnalyzer.ts`）：基于中文财经词典（正面/负面词库 + 程度副词 + 否定词）对新闻标题与正文进行加权情感评分，输出 `positive` / `negative` / `neutral` 三态标签及置信度；结果可写入 `sentimentCache` 避免重复计算。
3. **新闻-股票关联映射**（`stockLinker.ts`）：通过四阶匹配策略（精确代码、精确名称、模糊名称、行业关键词）将单篇新闻关联到股票池，生成 `NewsStockMap` 多对多关系，置信度阈值可配置。
4. **情感趋势聚合**（`sentimentTrendEngine.ts`）：对已入库新闻做纯本地聚合（无网络/LLM 调用），按 `global` / `stock` / `industry` 三维度生成日级情感分布序列，支持空日期填充与日期范围筛选。

### 1.2 分层定位

| 维度 | 说明 |
|------|------|
| 所属层 | `src/services/`（服务层） |
| 依赖方向 | 只能依赖 `core/`、`data/`、`lib/`（白名单）、`config/`、`types/`（零依赖类型） |
| 禁止事项 | 禁止直写 IndexedDB（须经 `DataBridge.forward()` 或 `dataLayer` 接口）；禁止直接调用 `store/`、`pages/`、`components/` |
| 被依赖方 | `store/`（`analysisNewsStore` 消费 `newsService` 与 `sentimentTrendEngine`）、`mcp/servers/news/`（`NewsServer` 封装暴露为 MCP 工具） |

### 1.3 与相邻子域的关系

| 相邻子域 | 关系 | 数据流 |
|----------|------|--------|
| `fetcher` | 上游：提供原始新闻抓取数据 | `fetcher` 抓取 → `newsService.saveNewsArticle()` 入库 |
| `data/` | 同层基础设施：通过 `dataLayer` 读写 IndexedDB | `newsService` ↔ `dataLayer.news` / `dataLayer.newsStockMap` / `dataLayer.sentimentCache` |
| `core/` | 同层基础设施：通过 `DataBridge` 事件转发 | `newsService` → `EnvelopeFactory` → `dataBridge.forward()` → `store/` 订阅者 |
| `mcp/servers/news` | 下游：消费本服务输出为 MCP 工具 | `newsService` / `sentimentAnalyzer` / `sentimentTrendEngine` → `NewsServer` 工具 |
| `store/analysisNewsStore` | 下游：状态层封装服务调用 | `analysisNewsStore` → `listNews` / `saveNewsArticles` / `aggregateSentimentTrend` |

---

## 2. 公共接口

### 2.1 类型定义（TypeScript Interface）

```typescript
// 文件：src/services/news/stockLinker.ts

export interface StockInfo {
  symbol: string
  name: string
  industry?: string
}

export interface StockLink {
  symbol: string
  name: string
  matchType: 'exact_code' | 'exact_name' | 'fuzzy_name' | 'industry'
  confidence: number
  source: 'title' | 'content'
  matchedKeyword: string
}

export interface LinkerConfig {
  enableExactCode: boolean
  enableExactName: boolean
  enableFuzzy: boolean
  enableIndustry: boolean
  minFuzzyLength: number
  confidenceThreshold: number
  maxLinks: number
  titleWeight: number
  contentWeight: number
}

// 文件：src/services/news/sentimentAnalyzer.ts

export type SentimentLabel = 'positive' | 'negative' | 'neutral'

export interface SentimentResult {
  sentiment: SentimentLabel
  confidence: number
  score: number // normalized score in [-1, +1]
}

// 文件：src/types/modules/news.types.ts

export type SentimentTrendDimension = 'global' | 'stock' | 'industry'
export type SentimentType = 'positive' | 'negative' | 'neutral'

export interface SentimentTrendPoint {
  date: string
  positive: number
  negative: number
  neutral: number
  total: number
  positiveRatio: number
  negativeRatio: number
  neutralRatio: number
}

export interface SentimentTrendSeries {
  dimension: SentimentTrendDimension
  value: string
  data: SentimentTrendPoint[]
  summary: {
    totalArticles: number
    positiveCount: number
    negativeCount: number
    neutralCount: number
    avgDailyArticles: number
  }
}

export interface SentimentTrendOptions {
  dimension: SentimentTrendDimension
  value?: string
  startDate?: string
  endDate?: string
  fillGaps?: boolean
}

export interface NewsFilterState {
  keyword: string
  category: string
  sentiment: '' | 'positive' | 'negative' | 'neutral'
  source: string
}

// 文件：src/data/types/types.knowledge.ts

export interface NewsArticle {
  id: string
  title: string
  content: string
  url: string
  source: string
  category: string
  publishTime: string
  fetchTime: string
  sentiment: 'positive' | 'negative' | 'neutral'
  sentimentConfidence: number
  relatedStocks: string[]
  keywords: string[]
  hash: string
}

export interface NewsStockMap {
  id: string // {symbol}_{newsId}
  symbol: string
  newsId: string
  relevanceScore: number
  isTitleMatch: boolean
  isContentMatch: boolean
  industryMatch: boolean
}

export interface SentimentCache {
  id: string // sent_{contentHash}
  contentHash: string
  sentiment: 'positive' | 'negative' | 'neutral'
  confidence: number
  method: 'rule' | 'llm' | 'hybrid'
  analyzedAt: number
  llmModel?: string
}
```

### 2.2 主入口函数

| 函数 | 签名 | 职责 | 错误处理 |
|------|------|------|----------|
| `saveNewsArticle()` | `(article, options?) => Promise<DataLayerResult<NewsArticle>>` | 单篇保存：去重→情感分析→股票关联→写入双表→DataBridge 事件转发 | `logger.error` + `DataLayerResult` 包裹 |
| `saveNewsArticles()` | `(articles, options?) => Promise<DataLayerResult<NewsArticle[]>>` | 批量保存（内部串行调用 `saveNewsArticle`，跳过关联） | 同上 |
| `listNews()` | `(options?) => Promise<DataLayerResult<NewsArticle[]>>` | 多条件查询（来源/分类/情感/股票/关键词/时间范围） | 同上 |
| `getNewsBySymbol()` | `(symbol) => Promise<DataLayerResult<NewsArticle[]>>` | 按股票代码查询关联新闻 | 同上 |
| `getNewsByHash()` | `(hash) => Promise<DataLayerResult<NewsArticle\|undefined>>` | 按哈希查询（去重检查） | 同上 |
| `generateMockArticles()` | `(count=5) => NewsArticle[]` | 生成模拟资讯（测试/演示用） | 无副作用，纯函数 |
| `analyzeNewsArticle()` | `(article) => SentimentResult` | 单篇标题+正文加权情感分析 | 纯计算 |
| `getOrAnalyzeSentiment()` | `(content, method?) => Promise<SentimentResult & {contentHash}>` | 先查缓存再分析，结果写入缓存 | 同上 |
| `analyzeText()` | `(text) => SentimentResult` | 通用文本情感分析 | 纯计算 |
| `classifySentiment()` | `(score, threshold?) => SentimentLabel` | 分数转三态标签 | 纯计算 |
| `linkArticleToStocks()` | `(article, stocks, config?) => {article, links, maps}` | 四阶匹配关联新闻到股票 | 纯计算 |
| `buildStockMap()` | `(stocks) => Map<string, StockInfo>` | 构建 symbol+6位代码双重索引 | 纯计算 |
| `aggregateSentimentTrend()` | `(articles, options) => SentimentTrendSeries` | 情感趋势聚合（global/stock/industry） | `logger.info` 记录 |
| `extractStockOptions()` | `(articles) => string[]` | 提取去重排序的股票代码 | 纯计算 |
| `extractIndustryOptions()` | `(articles) => string[]` | 提取去重排序的分类 | 纯计算 |

### 2.3 事件接口（DataBridge 信封）

| 事件名 | 发布方 | 订阅方 | 说明 |
|--------|--------|--------|------|
| `ENVELOPE_ACTION.saveNews` | `newsService` | `DataBridge` → `store/` | 新文章保存成功后转发，含完整 `NewsArticle` 负载 |
| `ENVELOPE_ACTION.newsArticleLoaded` | `newsService` | `DataBridge` → 可观测性 | `listNews` 查询完成后转发，含查询结果统计 |

> **注**：本服务未直接调用 `EventBus.subscribe/publish`，所有事件通过 `DataBridge.forward(envelope)` 统一路由。

---

## 3. 数据流

```
[外部输入: fetcher / MCP Server / UI Mock 按钮]
    ↓
newsService.saveNewsArticle()
    ├── sentimentAnalyzer.analyzeNewsArticle()  → sentimentCache（缓存写入）
    ├── stockLinker.linkArticleToStocks()        → newsStockMap（关联映射）
    ↓
dataLayer.news.save()  +  dataLayer.newsStockMap.save()
    ↓ (DataBridge.forward)
Envelope → routeToDB() → 通知 store 层订阅者
    ↓
analysisNewsStore (Zustand)
    ├── articles[] → NewsCard / NewsFilterPanel / NewsDetail
    └── sentimentTrend → NewsSentimentTrend (Recharts 图表)
```

**补充说明**：
- `sentimentTrendEngine` 是纯本地聚合引擎，不触发网络/LLM，输入为 `newsStore` 已加载的 `NewsArticle[]`，输出为 `SentimentTrendSeries` 供图表渲染。
- `newsService` 中的 `DataBridge.forward()` 调用均包裹 `try-catch`，确保转发失败不影响主数据保存流程。

---

## 4. 配置与依赖

### 4.1 依赖白名单（lib/ 及基础设施）

| 依赖 | 路径 | 用途 |
|------|------|------|
| `dataLayer` | `@/data/dataLayer` | IndexedDB 读写（news / newsStockMap / sentimentCache） |
| `generateId` | `@/data/db` | 生成数据库 ID |
| `DataLayerResult` 类型 | `@/data/types` | 返回类型包装 |
| `dataBridge` | `@/core/databridge` | 事件信封转发 |
| `EnvelopeFactory` | `@/core/envelope` | 构建标准化信封 |
| `logger` | `@/lib/logger` | 操作日志与错误记录 |
| `ENVELOPE_ACTION/ENVELOPE_TARGET/MODULE_ID` | `@/config/dbConfig` | 信封路由常量 |
| `MOCK_NEWS_URL_PREFIX` | `@/config/dataSourceUrls` | 模拟资讯 URL 前缀 |
| `DJB2_HASH_INIT/DJB2_HASH_MULTIPLIER` | `@/config/mathConstants` | 哈希算法常量 |
| `nanoid` | `nanoid` (npm) | 信封 traceId 生成 |

### 4.2 配置项

| 配置名 | 默认值 | 说明 | 来源 |
|--------|--------|------|------|
| `DEFAULT_LINKER_CONFIG` | `enableExactCode: true`, `enableExactName: true`, `enableFuzzy: true`, `enableIndustry: true`, `minFuzzyLength: 3`, `confidenceThreshold: 0.3`, `maxLinks: 5`, `titleWeight: 1.5`, `contentWeight: 1.0` | 股票关联器配置 | `src/services/news/stockLinker.ts` |
| `DEFAULT_INDUSTRY_KEYWORDS` | 10 行业映射表 | 行业关键词映射（银行/白酒/新能源等） | `src/services/news/stockLinker.ts` |
| `DEFAULT_STOCK_LIBRARY` | 18 只 A 股 | 内置股票库（测试与兜底） | `src/services/news/stockLinker.ts` |
| `POSITIVE_WORDS` | 24 词 | 正面情感词典 | `src/services/news/sentimentAnalyzer.ts` |
| `NEGATIVE_WORDS` | 23 词 | 负面情感词典 | `src/services/news/sentimentAnalyzer.ts` |
| `NEGATION_WORDS` | 9 词 | 否定词词典 | `src/services/news/sentimentAnalyzer.ts` |
| `DEGREE_WORDS` | 10 组 | 程度副词（含放大倍数） | `src/services/news/sentimentAnalyzer.ts` |
| `TITLE_WEIGHT` | `1.5` | 标题情感权重 | `src/services/news/sentimentAnalyzer.ts` |
| `CONTENT_WEIGHT` | `1.0` | 正文情感权重 | `src/services/news/sentimentAnalyzer.ts` |
| `SENTIMENT_THRESHOLD` | `0.1` | 情感分类阈值 | `src/services/news/sentimentAnalyzer.ts` |

---

## 5. 测试策略

| 测试类型 | 文件 | 说明 |
|----------|------|------|
| 单元测试 | `src/services/news/__tests__/sentimentTrendEngine.test.ts` | 情感趋势聚合引擎：global/stock/industry 维度、fillGaps、日期范围、空列表、选项提取（8 用例） |
| 单元测试 | `src/services/news/stockLinker.test.ts` | 股票关联器测试（同目录） |
| 集成测试 | `tests/services/news.integration.test.ts` | 建议覆盖：DataBridge 交互、`newsStore` 联动、保存-查询闭环 |
| Mock 策略 | `generateMockArticles()` | 内置模拟数据生成器，无需外部依赖 |

---

## 6. 变更日志

| 日期 | 版本 | 变更 | 作者 |
|------|------|------|------|
| 2026-07-12 | v0.1.0 | 契约初稿 | 架构组 |

---

> **TODO[子域 owner]**：请按本契约维护 §1-§5，确保与 `services-catalog.md` 的摘要一致。完成后运行 `tsc --noEmit` + `audit:layers` 验证。
