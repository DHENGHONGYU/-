---
title: news-data-definition
type: explanation
domain: data
phase: design
tier: important
status: active
maintainer: V9 Architecture Team
summary: "NewsPage 智能资讯中心数据字典：资讯实体的字段、类型与来源定义�?
tags: [data, news, data-definition, plan, architecture, explanation]
version: v1.0.0
last_updated: 2026-07-17
code_version: 2.0.0
doc_id: V9-DOC-DATA-010
change_log:
  - version: v1.0.0
changes: Initial version established
date: 2026-07-17
---

# NewsPage（智能资讯中心）数据字典

> **Version**：v1.0.0  
> **Date**�?026-06-26  
> **最后更�?*�?026-07-05（版本号补标�? 
> **模块范围**：`src/pages/analysis/` · `src/services/news/` · `src/data/types.ts` · `src/config/routes.ts`  
> **关联 PoC**：`../v6pro-to-v9-migration-analysis.md` · `../v6pro-to-v9-migration-analysis.md`

---

## 一、类型定�?
### 1.1 V9 NewsArticle �?资讯文章（数据权威）

| 字段 | 类型 | 必填 | 枚举/范围 | 描述 |
|------|------|------|-----------|------|
| `id` | `string` | �?| - | 唯一标识，格�?`news_${hash}` |
| `title` | `string` | �?| - | 标题 |
| `content` | `string` | �?| - | 正文内容 |
| `url` | `string` | �?| - | 原文链接 |
| `source` | `string` | �?| - | 来源标识，如 `mock` |
| `category` | `string` | �?| - | 分类，如 `个股` / `行业` / `宏观` |
| `publishTime` | `string` | �?| ISO 8601 | 发布时间 |
| `fetchTime` | `string` | �?| ISO 8601 | 采集时间 |
| `sentiment` | `string` | �?| `'positive'` / `'negative'` / `'neutral'` | 情感倾向（V9 权威格式�?|
| `sentimentConfidence` | `number` | �?| 0 ~ 1 | 情感置信�?|
| `relatedStocks` | `string[]` | �?| - | 关联股票代码列表 |
| `keywords` | `string[]` | �?| - | 关键词列�?|
| `hash` | `string` | �?| - | 内容哈希，由 `title\x00content` 生成 |

### 1.2 NewsStockMap �?股票-资讯关联

| 字段 | 类型 | 必填 | 描述 |
|------|------|------|------|
| `id` | `string` | �?| 复合主键 `{symbol}_{newsId}` |
| `symbol` | `string` | �?| 股票代码 |
| `newsId` | `string` | �?| 资讯 ID |
| `relevanceScore` | `number` | �?| 关联得分 |
| `isTitleMatch` | `boolean` | �?| 标题是否命中 |
| `isContentMatch` | `boolean` | �?| 正文是否命中 |
| `industryMatch` | `boolean` | �?| 行业是否命中 |

### 1.3 SentimentCache �?情感分析缓存

| 字段 | 类型 | 必填 | 枚举/范围 | 描述 |
|------|------|------|-----------|------|
| `id` | `string` | �?| `sent_{contentHash}` |
| `contentHash` | `string` | �?| 内容哈希 |
| `sentiment` | `string` | �?| `'positive'` / `'negative'` / `'neutral'` | 情感结果 |
| `confidence` | `number` | �?| 0 ~ 1 | 置信�?|
| `method` | `string` | �?| `'rule'` / `'llm'` / `'hybrid'` | 分析方法 |
| `analyzedAt` | `number` | �?| 毫秒时间�?| 分析时间 |
| `llmModel` | `string` | �?| - | 使用�?LLM 模型 |

### 1.4 V6NewsArticle �?V6 UI 兼容格式

| 字段 | 类型 | 必填 | 枚举/范围 | 描述 |
|------|------|------|-----------|------|
| `id` | `string` | �?| - | 唯一标识 |
| `title` | `string` | �?| - | 标题 |
| `content` | `string` | �?| - | 正文 |
| `url` | `string` | �?| - | 原文链接 |
| `source` | `string` | �?| - | 来源 |
| `category` | `string` | �?| - | 分类 |
| `publishTime` | `string` | �?| ISO 8601 | 发布时间 |
| `fetchTime` | `string` | �?| ISO 8601 | 采集时间 |
| `sentiment` | `number` | �?| -0.99 ~ 0.99 | V6 情感值（V9 string �?number�?|
| `sentimentConfidence` | `number` | �?| 0 ~ 1 | 置信�?|
| `relatedStocks` | `string[]` | �?| - | 关联股票 |
| `keywords` | `string[]` | �?| - | 关键�?|
| `hash` | `string` | �?| - | 内容哈希 |

### 1.5 NewsFilter �?前端筛选条�?
| 字段 | 类型 | 必填 | 枚举/范围 | 描述 |
|------|------|------|-----------|------|
| `category` | `string` | �?| 分类�?/ `'all'` | 分类筛�?|
| `sentiment` | `string` | �?| `'all'` / `'positive'` / `'negative'` / `'neutral'` | 情感筛�?|
| `source` | `string` | �?| 来源�?/ `'all'` | 来源筛�?|
| `stockCode` | `string` | �?| - | 股票代码模糊匹配 |
| `dateRange` | `string` | �?| `'all'` / `'today'` / `'week'` / `'month'` | 时间范围 |
| `searchQuery` | `string` | �?| - | 关键词搜�?|
| `sortBy` | `string` | �?| `'time'` / `'sentiment'` / `'source'` / `'relevance'` | 排序方式 |

### 1.6 NewsBookmark �?资讯收藏（IndexedDB�?
| 字段 | 类型 | 必填 | 描述 |
|------|------|------|------|
| `id` | `string` | �?| 资讯 ID（与 `V6NewsArticle.id` 一致） |
| `bookmarkedAt` | `number` | �?| 收藏时间戳（毫秒�?|

- 存储位置：`STORE_NAME.newsBookmarks`（IndexedDB 表名 `news_bookmarks`�?- 索引：`by-bookmarked-at`（按收藏时间排序�?- 读写入口：`src/store/analysisNewsStore.ts` �?`initBookmarks()` / `toggleBookmark()`
- 迁移策略：首次启动时�?IndexedDB 为空，自动从 `localStorage` �?`v9_news_bookmarks` 迁移并清空旧 key

---

## 二、枚举与映射

### 2.1 情感倾向（V9 权威格式�?
| V9 �?| V6 数值范�?| V6 判定规则 |
|--------|-------------|-------------|
| `positive` | `0.3 ~ 0.99` | `sentiment > 0.3` |
| `negative` | `-0.99 ~ -0.3` | `sentiment < -0.3` |
| `neutral` | `-0.3 ~ 0.3` | `-0.3 �?sentiment �?0.3` |

### 2.2 V9 �?V6 情感转换规则

```ts
const base = sentiment === 'positive' ? 0.6 : sentiment === 'negative' ? -0.6 : 0
const variance = (confidence - 0.5) * 0.4
// positive: min(0.99, base + variance)
// negative: max(-0.99, base - variance)
// neutral: 0
```

### 2.3 V6 �?V9 情感转换规则

```ts
if (sentiment > 0.3) return 'positive'
if (sentiment < -0.3) return 'negative'
return 'neutral'
```

---

## 三、服务层 API

### 3.1 newsService

| 函数 | 入参 | 出参 | 说明 |
|------|------|------|------|
| `saveNewsArticle` | `Omit<NewsArticle, 'id' \| 'sentiment' \| 'sentimentConfidence' \| 'relatedStocks' \| 'hash'>` + 可�?`stocks` / `skipLinking` | `DataLayerResult<NewsArticle>` | 保存单条资讯，自动情感分析、关联股票、去�?|
| `saveNewsArticles` | 上述数组 + 可�?`stocks` | `DataLayerResult<NewsArticle[]>` | 批量保存 |
| `listNews` | 可�?`source/category/sentiment/symbol/keyword/fromTime/toTime/limit` | `DataLayerResult<NewsArticle[]>` | 列表查询，按发布时间倒序 |
| `getNewsBySymbol` | `symbol: string` | `DataLayerResult<NewsArticle[]>` | 按股票代码查关联资讯 |
| `getNewsByHash` | `hash: string` | `DataLayerResult<NewsArticle \| undefined>` | 按哈希查资讯 |
| `generateMockArticles` | `count = 5` | `NewsArticle[]` | 生成模拟资讯 |

### 3.2 适配�?API（src/pages/news-v6/types.ts�?
| 函数 | 入参 | 出参 | 说明 |
|------|------|------|------|
| `adaptV9ToV6` | `V9NewsArticle` | `V6NewsArticle` | V9 �?V6 单条转换 |
| `adaptV6ToV9` | `V6NewsArticle` | `V9NewsArticle` | V6 �?V9 单条转换 |
| `adaptV9ListToV6` | `V9NewsArticle[]` | `V6NewsArticle[]` | 批量转换 |
| `sentimentV9ToV6` | `sentiment, confidence` | `number` | 情感 string �?number |
| `sentimentV6ToV9` | `number` | `sentiment` | 情感 number �?string |

---

## 四、DataBridge / IndexedDB 映射

### 4.1 Store 名称

| Store | 类型 | 说明 |
|-------|------|------|
| `news` | `NewsArticle` | 资讯主表 |
| `news_stock_map` | `NewsStockMap` | 股票-资讯关联�?|
| `sentiment_cache` | `SentimentCache` | 情感分析缓存 |

### 4.2 Envelope Action

| Action | 目标 Store | 说明 |
|--------|------------|------|
| `SAVE_NEWS` | `news` | 保存/更新资讯 |
| `SAVE_NEWS_STOCK_MAP` | `news_stock_map` | 保存关联映射 |
| `SAVE_SENTIMENT_CACHE` | `sentiment_cache` | 保存情感分析结果 |

### 4.3 调用方向

- `src/services/news/newsService.ts` 直接调用 `dataLayer.news.*` / `dataLayer.newsStockMap.*`�?- NewsPage PoC 未新�?DataBridge 端点，复用现�?`newsService.listNews()`�?- 写入操作�?`newsService` 内部协调，未来若需强制�?`DataBridge.forward()`，可参�?ARCH-002 整改要求迁移�?
---

## 五、路由与页面

| 路由 | 页面组件 | 说明 |
|------|----------|------|
| `/analysis/news-v6` | `src/pages/analysis/NewsPage.tsx` | V6 迁移验证页面 |
| `/analysis/news` | `src/pages/analysis/NewsPage.tsx` | V9 原生资讯页面 |

---

## 六、PoC 关键结论

- **无新�?Store**：PoC 未引入全局 Store，页面使用本�?`useState`�?- **无新�?DataBridge 端点**：读取复用现�?`newsService.listNews()`；写入通过 `newsService.saveNewsArticle()` 内部调用 `dataLayer`�?- **数据权威**：V9 `NewsArticle` 为权威结构，V6 UI 仅作为展示层消费 `V6NewsArticle`�?- **路由状�?*：`/analysis/news-v6` 为临时验证路由，验收通过后可替换 `/analysis/news`�?