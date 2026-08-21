---
type: reference
domain: data
phase: design
doc_id: V9-DOC-REF-945
title: data-definition
tier: important
code_version: "2.0.0-rc.2"
version: v1.2.1
last_updated: 2026-08-15
change_log:
  - version: v1.2.1
    changes: "2026-08-15 系统性核对：与 src/data/types.ts、src/services/news/ 对齐，字段无漂移；登记为主字典 §B 内容副本，权威 SSOT 转向 docs/reference/data-definition.md v2.0.1 与 docs/reference/data-dictionary-index.md v1.1.0。"
    date: 2026-08-15
  - version: v1.2.0
    changes: "C 类版本闭环(2026-08-11)：补全 change_log 初始条目"
    date: 2026-07-06

covers_code:
  - src/services/news/newsService.ts
  - src/data/types.ts
  - src/services/news/sentimentAnalyzer.ts
  - src/services/news/stockLinker.ts
  - src/data/dataLayer.ts


---
> **Version**: v1.2.1  
> **Last Updated**: 2026-08-15  
> **Maintainer**: 架构资产治理官

# 新闻资讯模块数据字典

> 生成日期：2026-06-26
> 模块范围：`src/data/types.ts` · `src/services/news/newsService.ts` · `src/services/news/sentimentAnalyzer.ts` · `src/services/news/stockLinker.ts`
> 规范：所有数据结构必须先定义 TypeScript 接口；组件内禁止硬编码状态、颜色、标签，必须从此字典对应的 constants 引用。

---

## 一、TypeScript 接口定义

### 1.1 NewsArticle — 新闻资讯条目

**来源**: `src/data/types.ts:727-742`
**用途**: 存储从外部财经源抓取的新闻资讯，支持 IndexedDB 持久化

| 字段 | 类型 | 必填 | 描述 |
|------|------|------|------|
| `id` | `string` | 是 | 新闻唯一 ID，格式 `news_{contentHash}` |
| `title` | `string` | 是 | 新闻标题 |
| `content` | `string` | 是 | 新闻正文 |
| `url` | `string` | 是 | 原文链接 |
| `source` | `string` | 是 | 新闻来源，如 `财联社`、`mock` |
| `category` | `string` | 是 | 新闻分类，如 `个股`、`行业`、`宏观` |
| `publishTime` | `string` | 是 | 发布时间（ISO 8601 格式） |
| `fetchTime` | `string` | 是 | 抓取时间（ISO 8601 格式） |
| `sentiment` | `'positive' \| 'negative' \| 'neutral'` | 是 | 情感标签，见 §2.1 |
| `sentimentConfidence` | `number` | 是 | 情感分析置信度 0-1 |
| `relatedStocks` | `string[]` | 是 | 关联股票代码列表 |
| `keywords` | `string[]` | 是 | 关键词列表 |
| `hash` | `string` | 是 | 内容哈希值（DJB2 算法），用于去重 |

**数据来源**：`newsService.saveNewsArticle()` → `dataLayer.news.save()`
**数据去向**：`useNewsStore().newsList` → `NewsPage` 展示
**更新频率**：按需采集

### 1.2 NewsStockMap — 股票-资讯多对多关联

**来源**: `src/data/types.ts:744-752`

| 字段 | 类型 | 必填 | 描述 |
|------|------|------|------|
| `id` | `string` | 是 | 关联 ID，格式 `{symbol}_{newsId}` |
| `symbol` | `string` | 是 | 股票代码 |
| `newsId` | `string` | 是 | 新闻 ID |
| `relevanceScore` | `number` | 是 | 关联度评分 0-1 |
| `isTitleMatch` | `boolean` | 是 | 是否标题匹配 |
| `isContentMatch` | `boolean` | 是 | 是否正文匹配 |
| `industryMatch` | `boolean` | 是 | 是否行业匹配 |

### 1.3 SentimentCache — 情感分析缓存

**来源**: `src/data/types.ts:755-763`

| 字段 | 类型 | 必填 | 描述 |
|------|------|------|------|
| `id` | `string` | 是 | 缓存 ID，格式 `sent_{contentHash}` |
| `contentHash` | `string` | 是 | 内容哈希值 |
| `sentiment` | `'positive' \| 'negative' \| 'neutral'` | 是 | 情感标签 |
| `confidence` | `number` | 是 | 置信度 0-1 |
| `method` | `'rule' \| 'llm' \| 'hybrid'` | 是 | 分析方法 |
| `analyzedAt` | `number` | 是 | 分析时间（毫秒时间戳） |
| `llmModel` | `string` | 否 | 使用的 LLM 模型名称 |

### 1.3A NewsBookmark — 新闻书签

**来源**: `src/data/types.ts:766-769`
**用途**: 用户收藏的新闻资讯书签

| 字段 | 类型 | 必填 | 描述 |
|------|------|------|------|
| `id` | `string` | 是 | 书签唯一标识（对应新闻 ID） |
| `bookmarkedAt` | `number` | 是 | 收藏时间（毫秒时间戳） |

### 1.4 SentimentResult — 情感分析结果

**来源**: `src/services/news/sentimentAnalyzer.ts:6-10`

| 字段 | 类型 | 必填 | 描述 |
|------|------|------|------|
| `sentiment` | `SentimentLabel` | 是 | 情感标签，见 §2.1 |
| `confidence` | `number` | 是 | 置信度 0-1 |
| `score` | `number` | 是 | 标准化分数 [-1, +1] |

### 1.5 StockInfo — 股票信息（链接器输入）

**来源**: `src/services/news/stockLinker.ts:4-8`

| 字段 | 类型 | 必填 | 描述 |
|------|------|------|------|
| `symbol` | `string` | 是 | 股票代码，如 `600519.SH` |
| `name` | `string` | 是 | 股票名称 |
| `industry` | `string` | 否 | 所属行业 |

### 1.6 StockLink — 股票链接结果

**来源**: `src/services/news/stockLinker.ts:10-17`

| 字段 | 类型 | 必填 | 描述 |
|------|------|------|------|
| `symbol` | `string` | 是 | 股票代码 |
| `name` | `string` | 是 | 股票名称 |
| `matchType` | `'exact_code' \| 'exact_name' \| 'fuzzy_name' \| 'industry'` | 是 | 匹配类型，见 §2.2 |
| `confidence` | `number` | 是 | 匹配置信度 0-1 |
| `source` | `'title' \| 'content'` | 是 | 匹配来源（标题/正文） |
| `matchedKeyword` | `string` | 是 | 匹配到的关键词 |

### 1.7 LinkerConfig — 股票链接器配置

**来源**: `src/services/news/stockLinker.ts:19-29`

| 字段 | 类型 | 必填 | 默认值 | 描述 |
|------|------|------|--------|------|
| `enableExactCode` | `boolean` | 否 | `true` | 启用代码精确匹配 |
| `enableExactName` | `boolean` | 否 | `true` | 启用名称精确匹配 |
| `enableFuzzy` | `boolean` | 否 | `true` | 启用模糊匹配 |
| `enableIndustry` | `boolean` | 否 | `true` | 启用行业匹配 |
| `minFuzzyLength` | `number` | 否 | `3` | 模糊匹配最小长度 |
| `confidenceThreshold` | `number` | 否 | `0.3` | 置信度阈值 |
| `maxLinks` | `number` | 否 | `5` | 每篇文章最大关联股票数 |
| `titleWeight` | `number` | 否 | `1.5` | 标题权重 |
| `contentWeight` | `number` | 否 | `1.0` | 正文权重 |

### 1.8 newsService — 服务层函数签名

**来源**: `src/services/news/newsService.ts`

| 函数 | 签名 | 描述 |
|------|------|------|
| `saveNewsArticle` | `(article, options?) => Promise<DataLayerResult<NewsArticle>>` | 保存单篇新闻（含情感分析 + 股票关联） |
| `saveNewsArticles` | `(articles, options?) => Promise<DataLayerResult<NewsArticle[]>>` | 批量保存新闻 |
| `listNews` | `(options?) => Promise<DataLayerResult<NewsArticle[]>>` | 按条件筛选新闻列表 |
| `getNewsBySymbol` | `(symbol) => Promise<DataLayerResult<NewsArticle[]>>` | 按股票代码获取关联新闻 |
| `getNewsByHash` | `(hash) => Promise<DataLayerResult<NewsArticle \| undefined>>` | 按哈希查重 |
| `generateMockArticles` | `(count?) => NewsArticle[]` | 生成模拟新闻数据 |

---

## 二、枚举常量定义

### 2.1 SentimentLabel — 情感标签

**来源**: `src/services/news/sentimentAnalyzer.ts:4`

| 枚举值 | 描述 |
|--------|------|
| `'positive'` | 正面 |
| `'negative'` | 负面 |
| `'neutral'` | 中性 |

### 2.2 StockLinkMatchType — 股票匹配类型

**来源**: `src/services/news/stockLinker.ts:13`

| 枚举值 | 置信度基数 | 描述 |
|--------|-----------|------|
| `'exact_code'` | 0.95 | 六位代码精确匹配 |
| `'exact_name'` | 0.90 | 股票名称完全匹配 |
| `'fuzzy_name'` | 0.70 | 名称前缀模糊匹配（2-4 字） |
| `'industry'` | 0.50 | 行业关键词匹配 |

### 2.3 情感词典常量

**来源**: `src/services/news/sentimentAnalyzer.ts:13-85`

| 常量 | 类型 | 条目数 | 描述 |
|------|------|--------|------|
| `POSITIVE_WORDS` | `string[]` | 25 | 正面情感词（如 增长、大涨、涨停） |
| `NEGATIVE_WORDS` | `string[]` | 25 | 负面情感词（如 下跌、暴跌、亏损） |
| `NEGATION_WORDS` | `string[]` | 9 | 否定词（如 不、没有、未） |
| `DEGREE_WORDS` | `Array<{word, multiplier}>` | 10 | 程度副词（如 非常=1.5x, 略有=0.7x） |

### 2.4 行业关键词映射

**来源**: `src/services/news/stockLinker.ts:44-55`

| 行业 | 关键词 |
|------|--------|
| 银行 | 银行、降准、降息、信贷、息差、不良资产 |
| 白酒 | 白酒、茅台、五粮液、酱香、浓香、国窖 |
| 新能源汽车 | 新能源汽车、电动车、锂电池、动力电池、新能源车 |
| 医药 | 医药、创新药、医疗器械、集采、生物药 |
| 非银金融 | 券商、保险、证券、投行、资管 |
| 食品饮料 | 食品、饮料、乳业、牛奶、调味品 |
| 电力设备 | 光伏、风电、储能、新能源、逆变器、硅片 |
| 电子 | 芯片、半导体、集成电路、晶圆、封测、光刻 |
| 房地产 | 房地产、楼市、房价、拿地、土拍 |
| 计算机 | 人工智能、AI、大模型、算力、云计算、软件 |

### 2.5 内置股票库

**来源**: `src/services/news/stockLinker.ts:58-77`
**用途**: 测试与兜底使用的 A 股股票列表，共 18 只

| 代码 | 名称 | 行业 |
|------|------|------|
| `600000.SH` | 浦发银行 | 银行 |
| `600519.SH` | 贵州茅台 | 白酒 |
| `000858.SZ` | 五粮液 | 白酒 |
| `002594.SZ` | 比亚迪 | 新能源汽车 |
| `300750.SZ` | 宁德时代 | 新能源汽车 |
| `600036.SH` | 招商银行 | 银行 |
| `601318.SH` | 中国平安 | 非银金融 |
| `000333.SZ` | 美的集团 | 家用电器 |
| `600276.SH` | 恒瑞医药 | 医药 |
| `002415.SZ` | 海康威视 | 电子 |
| `600887.SH` | 伊利股份 | 食品饮料 |
| `601012.SH` | 隆基绿能 | 电力设备 |
| `300059.SZ` | 东方财富 | 非银金融 |
| `002230.SZ` | 科大讯飞 | 计算机 |
| `600030.SH` | 中信证券 | 非银金融 |
| `601888.SH` | 中国中免 | 商贸零售 |
| `000002.SZ` | 万科A | 房地产 |
| `601398.SH` | 工商银行 | 银行 |

---

## 三、数据流向

```
┌─────────────────────────────────────────────────────────────────┐
│  News 模块数据流                                                 │
│                                                                 │
│  外部数据源 → newsService.saveNewsArticle()                      │
│       │                                                        │
│       ├── 1. 内容哈希去重 (buildHash → getByHash)               │
│       │                                                        │
│       ├── 2. 情感分析                                            │
│       │   getOrAnalyzeSentiment(content)                        │
│       │   ├── 命中缓存 → 返回 SentimentCache                     │
│       │   └── 未命中 → analyzeText() → classifySentiment()      │
│       │       └── 写入 SentimentCache                           │
│       │                                                        │
│       ├── 3. 股票关联                                            │
│       │   linkArticleToStocks(article, stockLibrary)            │
│       │   ├── buildStockMap() 构建股票索引                       │
│       │   ├── matchText(title) 标题匹配                          │
│       │   ├── matchText(content) 正文匹配                        │
│       │   └── 取最佳匹配 → 填充 relatedStocks                    │
│       │                                                        │
│       ├── 4. 写入 IndexedDB                                      │
│       │   ├── dataLayer.news.save(fullArticle)                  │
│       │   └── dataLayer.newsStockMap.save(map)                  │
│       │                                                        │
│       └── 5. 返回 fullArticle                                   │
│                                                                 │
│  查询路径:                                                       │
│    listNews({ source, category, sentiment, symbol, keyword })   │
│    → dataLayer.news.list() → 内存过滤 → 排序返回                 │
│                                                                 │
│  IndexedDB Store: news, news_stock_map, sentiment_cache         │
└─────────────────────────────────────────────────────────────────┘
```

**数据来源**：外部财经 API / Mock 数据 → `newsService.saveNewsArticle()`
**数据去向**：IndexedDB `news` Store → `NewsPage` 展示
**更新频率**：按需采集（非轮询）

---

## 四、Store 层接口（DataLayer）

> 以下为 `src/data/dataLayer.ts` 中新闻模块的 Store 接口定义，用于 IndexedDB 持久化操作。

### 4.1 newsStore — 新闻资讯持久化

**来源**: `src/data/dataLayer.ts:371-385`

| 方法 | 签名 | 描述 |
|------|------|------|
| `save` | `(article: NewsArticle) => Promise<DataLayerResult<void>>` | 保存新闻文章（通过 DataBridge 转发） |
| `get` | `(id: string) => Promise<NewsArticle \| undefined>` | 按 ID 查询新闻 |
| `getByHash` | `(hash: string) => Promise<NewsArticle \| undefined>` | 按内容哈希查重（返回首条） |
| `list` | `() => Promise<NewsArticle[]>` | 获取全量新闻列表 |

**数据流向**：`save` → `sendWriteEnvelope('saveNews', article, 'news')` → `DataBridge.forward()` → IndexedDB `news` Store

### 4.2 newsStockMapStore — 股票-资讯关联持久化

**来源**: `src/data/dataLayer.ts:387-401`

| 方法 | 签名 | 描述 |
|------|------|------|
| `save` | `(mapping: NewsStockMap) => Promise<DataLayerResult<void>>` | 保存股票-资讯关联（通过 DataBridge） |
| `listBySymbol` | `(symbol: string) => Promise<NewsStockMap[]>` | 按股票代码查询关联新闻 |
| `listByNews` | `(newsId: string) => Promise<NewsStockMap[]>` | 按新闻 ID 查询关联股票 |

**索引**：`by-symbol`（股票代码）、`by-news`（新闻 ID）

### 4.3 sentimentCacheStore — 情感分析缓存持久化

**来源**: `src/data/dataLayer.ts:403-420`

| 方法 | 签名 | 描述 |
|------|------|------|
| `save` | `(cache: SentimentCache) => Promise<DataLayerResult<void>>` | 保存情感分析缓存（通过 DataBridge） |
| `get` | `(id: string) => Promise<SentimentCache \| undefined>` | 按 ID 查询缓存 |
| `getByContentHash` | `(contentHash: string) => Promise<SentimentCache \| undefined>` | 按内容哈希查询缓存 |

**索引**：`by-content-hash`（内容哈希），用于缓存命中查询

### 4.4 dataLayer.news 汇聚对象

**来源**: `src/data/dataLayer.ts:446`

```ts
export const dataLayer = {
  news: newsStore,
  newsStockMap: newsStockMapStore,
  sentimentCache: sentimentCacheStore,
  // ... 其他 Store
}
```

**调用规范**：
- **写操作**：必须通过 `dataLayer.news.save()` → `DataBridge.forward()` → 审计日志自动记录
- **读操作**：允许直接调用 `dataLayer.news.get/list/getByHash` → IndexedDB 直接查询

---

## 变更日志

| 日期 | 版本 | 变更内容 | 变更人 |
|------|------|----------|--------|
| 2026-06-26 | v1.0.0 | 初始创建，覆盖新闻模块全部类型定义（8 个接口）与枚举常量（5 组） | Architecture Asset Governor |
| 2026-07-06 | v1.2.0 | 新增 NewsBookmark 接口（§1.3A）；修正行号引用（565→727, 582→744, 593→755） | Architecture Asset Governor |