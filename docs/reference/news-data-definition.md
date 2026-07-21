---
title: news-data-definition
tier: important
code_version: 2.0.0
---


# NewsPage（智能资讯中心）数据字典

> **版本**：v1.0.0  
> **生成日期**：2026-06-26  
> **最后更新**：2026-07-05（版本号补标）  
> **模块范围**：`src/pages/analysis/` · `src/services/news/` · `src/data/types.ts` · `src/config/routes.ts`  
> **关联 PoC**：`NewsPage-PoC验证报告.md` · `NewsPage-迁移验收确认书.md`

---

## 一、类型定义

### 1.1 V9 NewsArticle — 资讯文章（数据权威）

| 字段 | 类型 | 必填 | 枚举/范围 | 描述 |
|------|------|------|-----------|------|
| `id` | `string` | 是 | - | 唯一标识，格式 `news_${hash}` |
| `title` | `string` | 是 | - | 标题 |
| `content` | `string` | 是 | - | 正文内容 |
| `url` | `string` | 是 | - | 原文链接 |
| `source` | `string` | 是 | - | 来源标识，如 `mock` |
| `category` | `string` | 是 | - | 分类，如 `个股` / `行业` / `宏观` |
| `publishTime` | `string` | 是 | ISO 8601 | 发布时间 |
| `fetchTime` | `string` | 是 | ISO 8601 | 采集时间 |
| `sentiment` | `string` | 是 | `'positive'` / `'negative'` / `'neutral'` | 情感倾向（V9 权威格式） |
| `sentimentConfidence` | `number` | 是 | 0 ~ 1 | 情感置信度 |
| `relatedStocks` | `string[]` | 是 | - | 关联股票代码列表 |
| `keywords` | `string[]` | 是 | - | 关键词列表 |
| `hash` | `string` | 是 | - | 内容哈希，由 `title\x00content` 生成 |

### 1.2 NewsStockMap — 股票-资讯关联

| 字段 | 类型 | 必填 | 描述 |
|------|------|------|------|
| `id` | `string` | 是 | 复合主键 `{symbol}_{newsId}` |
| `symbol` | `string` | 是 | 股票代码 |
| `newsId` | `string` | 是 | 资讯 ID |
| `relevanceScore` | `number` | 是 | 关联得分 |
| `isTitleMatch` | `boolean` | 是 | 标题是否命中 |
| `isContentMatch` | `boolean` | 是 | 正文是否命中 |
| `industryMatch` | `boolean` | 是 | 行业是否命中 |

### 1.3 SentimentCache — 情感分析缓存

| 字段 | 类型 | 必填 | 枚举/范围 | 描述 |
|------|------|------|-----------|------|
| `id` | `string` | 是 | `sent_{contentHash}` |
| `contentHash` | `string` | 是 | 内容哈希 |
| `sentiment` | `string` | 是 | `'positive'` / `'negative'` / `'neutral'` | 情感结果 |
| `confidence` | `number` | 是 | 0 ~ 1 | 置信度 |
| `method` | `string` | 是 | `'rule'` / `'llm'` / `'hybrid'` | 分析方法 |
| `analyzedAt` | `number` | 是 | 毫秒时间戳 | 分析时间 |
| `llmModel` | `string` | 否 | - | 使用的 LLM 模型 |

### 1.4 V6NewsArticle — V6 UI 兼容格式

| 字段 | 类型 | 必填 | 枚举/范围 | 描述 |
|------|------|------|-----------|------|
| `id` | `string` | 是 | - | 唯一标识 |
| `title` | `string` | 是 | - | 标题 |
| `content` | `string` | 是 | - | 正文 |
| `url` | `string` | 是 | - | 原文链接 |
| `source` | `string` | 是 | - | 来源 |
| `category` | `string` | 是 | - | 分类 |
| `publishTime` | `string` | 是 | ISO 8601 | 发布时间 |
| `fetchTime` | `string` | 是 | ISO 8601 | 采集时间 |
| `sentiment` | `number` | 是 | -0.99 ~ 0.99 | V6 情感值（V9 string → number） |
| `sentimentConfidence` | `number` | 是 | 0 ~ 1 | 置信度 |
| `relatedStocks` | `string[]` | 是 | - | 关联股票 |
| `keywords` | `string[]` | 是 | - | 关键词 |
| `hash` | `string` | 是 | - | 内容哈希 |

### 1.5 NewsFilter — 前端筛选条件

| 字段 | 类型 | 必填 | 枚举/范围 | 描述 |
|------|------|------|-----------|------|
| `category` | `string` | 是 | 分类值 / `'all'` | 分类筛选 |
| `sentiment` | `string` | 是 | `'all'` / `'positive'` / `'negative'` / `'neutral'` | 情感筛选 |
| `source` | `string` | 是 | 来源值 / `'all'` | 来源筛选 |
| `stockCode` | `string` | 是 | - | 股票代码模糊匹配 |
| `dateRange` | `string` | 是 | `'all'` / `'today'` / `'week'` / `'month'` | 时间范围 |
| `searchQuery` | `string` | 是 | - | 关键词搜索 |
| `sortBy` | `string` | 是 | `'time'` / `'sentiment'` / `'source'` / `'relevance'` | 排序方式 |

### 1.6 NewsBookmark — 资讯收藏（IndexedDB）

| 字段 | 类型 | 必填 | 描述 |
|------|------|------|------|
| `id` | `string` | 是 | 资讯 ID（与 `V6NewsArticle.id` 一致） |
| `bookmarkedAt` | `number` | 是 | 收藏时间戳（毫秒） |

- 存储位置：`STORE_NAME.newsBookmarks`（IndexedDB 表名 `news_bookmarks`）
- 索引：`by-bookmarked-at`（按收藏时间排序）
- 读写入口：`src/store/analysisNewsStore.ts` 的 `initBookmarks()` / `toggleBookmark()`
- 迁移策略：首次启动时若 IndexedDB 为空，自动从 `localStorage` 的 `v9_news_bookmarks` 迁移并清空旧 key

---

## 二、枚举与映射

### 2.1 情感倾向（V9 权威格式）

| V9 值 | V6 数值范围 | V6 判定规则 |
|--------|-------------|-------------|
| `positive` | `0.3 ~ 0.99` | `sentiment > 0.3` |
| `negative` | `-0.99 ~ -0.3` | `sentiment < -0.3` |
| `neutral` | `-0.3 ~ 0.3` | `-0.3 ≤ sentiment ≤ 0.3` |

### 2.2 V9 → V6 情感转换规则

```ts
const base = sentiment === 'positive' ? 0.6 : sentiment === 'negative' ? -0.6 : 0
const variance = (confidence - 0.5) * 0.4
// positive: min(0.99, base + variance)
// negative: max(-0.99, base - variance)
// neutral: 0
```

### 2.3 V6 → V9 情感转换规则

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
| `saveNewsArticle` | `Omit<NewsArticle, 'id' \| 'sentiment' \| 'sentimentConfidence' \| 'relatedStocks' \| 'hash'>` + 可选 `stocks` / `skipLinking` | `DataLayerResult<NewsArticle>` | 保存单条资讯，自动情感分析、关联股票、去重 |
| `saveNewsArticles` | 上述数组 + 可选 `stocks` | `DataLayerResult<NewsArticle[]>` | 批量保存 |
| `listNews` | 可选 `source/category/sentiment/symbol/keyword/fromTime/toTime/limit` | `DataLayerResult<NewsArticle[]>` | 列表查询，按发布时间倒序 |
| `getNewsBySymbol` | `symbol: string` | `DataLayerResult<NewsArticle[]>` | 按股票代码查关联资讯 |
| `getNewsByHash` | `hash: string` | `DataLayerResult<NewsArticle \| undefined>` | 按哈希查资讯 |
| `generateMockArticles` | `count = 5` | `NewsArticle[]` | 生成模拟资讯 |

### 3.2 适配层 API（src/pages/news-v6/types.ts）

| 函数 | 入参 | 出参 | 说明 |
|------|------|------|------|
| `adaptV9ToV6` | `V9NewsArticle` | `V6NewsArticle` | V9 → V6 单条转换 |
| `adaptV6ToV9` | `V6NewsArticle` | `V9NewsArticle` | V6 → V9 单条转换 |
| `adaptV9ListToV6` | `V9NewsArticle[]` | `V6NewsArticle[]` | 批量转换 |
| `sentimentV9ToV6` | `sentiment, confidence` | `number` | 情感 string → number |
| `sentimentV6ToV9` | `number` | `sentiment` | 情感 number → string |

---

## 四、DataBridge / IndexedDB 映射

### 4.1 Store 名称

| Store | 类型 | 说明 |
|-------|------|------|
| `news` | `NewsArticle` | 资讯主表 |
| `news_stock_map` | `NewsStockMap` | 股票-资讯关联表 |
| `sentiment_cache` | `SentimentCache` | 情感分析缓存 |

### 4.2 Envelope Action

| Action | 目标 Store | 说明 |
|--------|------------|------|
| `SAVE_NEWS` | `news` | 保存/更新资讯 |
| `SAVE_NEWS_STOCK_MAP` | `news_stock_map` | 保存关联映射 |
| `SAVE_SENTIMENT_CACHE` | `sentiment_cache` | 保存情感分析结果 |

### 4.3 调用方向

- `src/services/news/newsService.ts` 直接调用 `dataLayer.news.*` / `dataLayer.newsStockMap.*`。
- NewsPage PoC 未新增 DataBridge 端点，复用现有 `newsService.listNews()`。
- 写入操作由 `newsService` 内部协调，未来若需强制走 `DataBridge.forward()`，可参考 ARCH-002 整改要求迁移。

---

## 五、路由与页面

| 路由 | 页面组件 | 说明 |
|------|----------|------|
| `/analysis/news-v6` | `src/pages/analysis/NewsPage.tsx` | V6 迁移验证页面 |
| `/analysis/news` | `src/pages/analysis/NewsPage.tsx` | V9 原生资讯页面 |

---

## 六、PoC 关键结论

- **无新增 Store**：PoC 未引入全局 Store，页面使用本地 `useState`。
- **无新增 DataBridge 端点**：读取复用现有 `newsService.listNews()`；写入通过 `newsService.saveNewsArticle()` 内部调用 `dataLayer`。
- **数据权威**：V9 `NewsArticle` 为权威结构，V6 UI 仅作为展示层消费 `V6NewsArticle`。
- **路由状态**：`/analysis/news-v6` 为临时验证路由，验收通过后可替换 `/analysis/news`。
