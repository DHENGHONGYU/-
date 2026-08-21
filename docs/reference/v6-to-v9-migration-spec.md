---
type: reference
domain: data
phase: design
doc_id: V9-DOC-REF-969
title: v6-to-v9-migration-spec
code_version: "2.0.0-rc.2"
tier: important
version: v1.0.0
last_updated: 2026-08-11
change_log:
  - version: v1.0.0
    changes: "C 类版本闭环(2026-08-11)：补全 change_log 初始条目"
    date: 2026-08-11
---

# V6 Pro → V9 JSON 数据迁移规范（中间文档）

> 文档版本：1.0  
> 适用 V9 DB_VERSION：6  
> 最后更新：2026-06-24  

## 1. 概述

### 1.1 为什么需要中间文档
V6 Pro 与 V9 共用同一个 IndexedDB 数据库名 `V6ProDB`，无法在同一浏览器中同时打开。因此迁移必须采用"导出 → 转换 → 导入"的离线 JSON 方式。本文档作为迁移的**唯一权威转换依据**，所有 `v6MigrationService` 中的转换逻辑必须严格对齐本规范，以保证数据可审计、可回归测试。

### 1.2 数据源选择（待决策）
V6 Pro 源码备份中存在两种导出实现，各有优劣：

| 导出入口 | 位置 | 输出结构 | 覆盖 store | 优势 | 劣势 |
|---|---|---|---|---|---|
| `dataManager.export()`（底层全量） | `src/data/db.ts` | `Record<string, any[]>`，下划线 store key | 全部 16 个 store | 数据完整，store key 与 V9 一致 | 无 `version`、`exportTime` 等元信息 |
| `dataLayer.manager.export()`（业务层） | `src/data/dataLayer.ts` | `DataExport`，camelCase key | 仅 6 个 store | 有 `version` 和 `exportTime` 元信息 | 缺失 `sector_scores`、`rotation_scores`、`score_docs`、`strategy_snapshots`、`local_docs`、`news` 等核心 store |

**分析与建议**：
- 若目标是完整迁移 V6 全部历史数据，应优先采用 `dataManager.export()` 的全量导出。缺失的元信息可在 V9 侧补充（例如读取时自动附加 `exportTime`）。
- 若 V6 用户只通过 UI 导出，实际拿到的是 `dataLayer.manager.export()` 的 6-store 版本，则需要在 V9 侧明确提示缺失 store，或补充实现 V6 业务层导出的完整版（在 V6 源码中扩展 `DataExport`）。
- **决策点**：V9 迁移入口默认接受哪种 JSON？是否同时兼容两种 shape？是否先在 V6 侧补齐业务层导出？

**用户决策**：采用方案 A，V9 迁移功能只接受 `dataManager.export()` 的全量导出（下划线 store key）。业务层导出的 camelCase JSON 不在本次支持范围内。

### 1.3 顶层 JSON Shape
```ts
interface V6ExportShape {
  stocks: V6Stock[]
  daily_quotes: V6DailyQuote[]
  v6_scores: V6Score[]
  orders: V6Order[]
  sector_scores: V6SectorScore[]
  rotation_scores: V6RotationScore[]
  score_docs: V6ScoreDoc[]
  strategy_snapshots: V6StrategySnapshot[]
  local_docs: V6LocalDoc[]
  news: V6NewsArticle[]
  news_stock_map: V6NewsStockMap[]
  sentiment_cache: V6SentimentCache[]
  // V6 存在但 V9 暂不导入的 store（将在 1.4 说明）
  v6_reports?: V6Report[]
  score_history?: V6ScoreHistory[]
  concepts?: V6Concept[]
  strategies?: V6Strategy[]
}
```

### 1.4 V6 有但 V9 无直接对应 store 的数据（待决策）

以下 V6 store 在 V9 中没有完全对应的 store，存在多种处理方案，需用户决策：

| V6 Store | 方案 A：迁移/合并 | 方案 B：保留为只读历史 | 方案 C：丢弃 | 建议与分析 |
|---|---|---|---|---|
| `v6_reports` | 合并到 `score_docs.reportMd` | 新增 V9 `v6_reports` store 或本地文件保存 | 不导入 | `score_docs` 已含 `reportMd`，合并最自然；若用户希望保留原始报告对象，可选方案 B。 |
| `score_history` | 拆分为多条 `score_docs`/`v6_scores` | 新增 V9 `score_history` store | 不导入 | 批次摘要信息对审计有价值，建议方案 B；若只关注最新评分，可选方案 C。 |
| `concepts` | 合并到 `stocks.theme` | 新增 V9 `concepts` 只读表 | 不导入 | V9 `stocks.theme` 已支持多主题，方案 A 最简单。 |
| `strategies` | 迁移到 `strategy_snapshots` 的元数据 | 新增 V9 `strategies` 只读表 | 不导入 | 若 V6 中该 store 为空或仅预留，方案 C 即可。 |

**决策点**：上述 store 是否导入？以何种方式导入？当前规范暂按"方案 C：不导入"编写代码作为占位实现，但代码需预留扩展点，便于在用户决策后切换为方案 A/B。用户决策前，不应将这些 store 视为已废弃。

### 1.5 V9 有但 V6 无数据源的 Store

| V9 Store | V6 情况 | 迁移结果 |
|---|---|---|
| `intelligent_scores` | 不存在 | 空 |
| `industry_scores` | 不存在 | 空 |
| `signals` | 运行时生成，无持久化 | 空 |
| `research_logs` | 不存在 | 空 |
| `watchlists` | 不存在 | 空 |

---

## 2. 通用转换规则

### 2.1 时间格式转换
- V6 中的 ISO 时间字符串（如 `createdAt`、`timestamp`、`analyzedAt`、`publishTime`、`fetchTime`）需要按目标字段要求转换。
- V9 要求为 `number`（毫秒时间戳）的字段：使用 `Date.parse(isoString)` 或 `new Date(isoString).getTime()`。
- V9 要求为 `string`（ISO）的字段：保持原字符串。

### 2.2 情感分数转换
V6 中 `sentiment` 为数值 `-1 ~ +1`，V9 为字符串枚举。

```ts
function sentimentNumberToLabel(score: number): 'positive' | 'negative' | 'neutral' {
  if (score > 0.2) return 'positive'
  if (score < -0.2) return 'negative'
  return 'neutral'
}
```

### 2.3 数值安全转换
- 所有数值字段若源数据缺失或为 `null`，按 V9 类型使用 `undefined` 或合理默认值。
- `NaN` / `Infinity` 必须被清理为 `undefined`。

### 2.4 ID / Hash 去重策略
- 导入时按目标 store 的 keyPath 先查询；若已存在，默认 **跳过**（保留 V9 现有数据）。
- 可选策略：**覆盖**（由用户在 MigrationPanel 选择）。
- `news_stock_map` 的 `id` 为 `{symbol}_{newsId}`，重复时跳过。

### 2.5 字符串截断
- `content` / `reportMd` 等长文本字段保持完整，不做截断。
- 文件名/路径字段超过 500 字符时截断。

---

## 3. Store 映射与字段转换详表

### 3.1 `stocks`

**V6 → V9 字段映射**

| V6 字段 | V9 字段 | 转换规则 |
|---|---|---|
| `symbol` | `symbol` | 直接复制，作为 keyPath |
| `name` | `name` | 直接复制 |
| `market` | — | 丢弃（V9 从 symbol 后缀推断） |
| `industryL1` / `industryL2` / `industryL3` | `industryCode` / `sector` / `theme` | `industryCode` 取 `industryL1`；`sector` 取 `industryL2`；`theme` 合并 `conceptTags` + `hotTrack` |
| `csL1` / `csL2` / `csL3` | — | 丢弃 |
| `trackAnalysis` | `theme` / `sector` | 若存在，抽取 `level1/level2/level3` 追加到 `theme` |
| `hotTrack` | `theme` | 追加到 `theme` |
| `conceptTags` | `theme` | 追加到 `theme` |
| `isFavorite` | `researchStatus` | `true` → `watching`，否则 `candidate` |
| `shares` / `avgCost` / `status` / `targetPrice` / `stopLoss` | — | 丢弃；持仓信息应在 orders / portfolio 中维护 |
| `lastScore` | — | 丢弃，可从 `v6_scores` 重新计算 |
| `lastRating` | — | 丢弃 |
| `lastScoredAt` | — | 丢弃 |
| `source` | `source` | 若 V6 值为 `"AI推荐"` / `"策略信号"` / `"手动添加"`，统一映射为 `DATA_SOURCE.manual` |
| `tags` | `theme` / `group` | `tags` 中若含候选池分组语义（如 `"核心资产"`），优先放入 `group`；其余追加到 `theme` |
| `notes` | — | 丢弃 |
| `createdAt` | `ingestedAt` | ISO → ms |
| `updatedAt` | `updatedAt` | ISO → ms |

**V9 默认值填充**
- `researchStatus`: `'candidate'`
- `source`: `'manual'`
- `dataVersion`: `1`
- `group`: `DEFAULT_POOL_GROUP`（`'默认分组'`）

**示例**
```json
// V6
{
  "symbol": "600519.SH",
  "name": "贵州茅台",
  "market": "A股",
  "industryL1": "食品饮料",
  "industryL2": "白酒",
  "industryL3": "高端白酒",
  "conceptTags": ["白酒龙头"],
  "hotTrack": "消费复苏",
  "isFavorite": true,
  "shares": 100,
  "avgCost": 1600,
  "source": "手动添加",
  "tags": ["核心资产"],
  "createdAt": "2026-01-01T00:00:00.000Z",
  "updatedAt": "2026-01-02T00:00:00.000Z"
}

// V9
{
  "symbol": "600519.SH",
  "name": "贵州茅台",
  "researchStatus": "watching",
  "source": "manual",
  "dataVersion": 1,
  "group": "核心资产",
  "industryCode": "食品饮料",
  "sector": "白酒",
  "theme": ["白酒龙头", "消费复苏"],
  "ingestedAt": 1735689600000,
  "updatedAt": 1735776000000
}
```

---

### 3.2 `v6_scores`

V9 的 `v6_scores` 是简化计算分结构，与 V6 的完整 L0-L8 评分差异很大。V6 的完整评分更适合迁移到 `score_docs`；但为了兼容 V9 的 `v6_scores` 模块，同时生成一条简化记录。

**去向 1：V9 `score_docs`（主要）**
- 将 V6 `v6_scores` 的完整记录转换为 `ScoreDocVersion`。
- `docId` 重新生成：`{symbol}__V1__{timestamp}`。
- `version` 固定为 `1`（历史版本信息丢失）。
- `reportMd` 若 V6 无，则根据 layers 生成简要 Markdown。

**去向 2：V9 `v6_scores`（兼容）**

| V6 字段 | V9 字段 | 转换规则 |
|---|---|---|
| `symbol` | `symbol` | 直接复制 |
| `composite` | `score` | 直接复制 |
| `layers` | `factors` | 取每个 layer 的 `score`，键为 layer code |
| `scoreDate` | `calculatedAt` | `Date.parse(scoreDate)` |
| `modelUsed` + `promptVersion` | `algorithmVersion` | `${modelUsed}__${promptVersion}` |
| — | `dataVersion` | `1` |

**示例**
```json
// V6
{
  "symbol": "600519.SH",
  "scoreDate": "2026-06-06",
  "composite": 4.2,
  "layers": {
    "L0": { "score": 4.5, "reason": "...", "weight": 0.1 },
    "L3V": { "score": 4.2, "reason": "...", "weight": 0.15 }
  },
  "modelUsed": "deepseek-chat",
  "promptVersion": "V6-L0L8-v1",
  "createdAt": "2026-06-06T08:00:00.000Z"
}

// V9 v6_scores
{
  "symbol": "600519.SH",
  "score": 4.2,
  "factors": { "L0": 4.5, "L3V": 4.2 },
  "algorithmVersion": "deepseek-chat__V6-L0L8-v1",
  "calculatedAt": 1749187200000,
  "dataVersion": 1
}
```

---

### 3.3 `orders`

| V6 字段 | V9 字段 | 转换规则 |
|---|---|---|
| `id` | — | 丢弃，V9 重新生成 UUID |
| `symbol` | `symbol` | 直接复制 |
| `type` | `direction` | `"buy"` / `"add"` → `'buy'`；`"sell"` / `"reduce"` → `'sell'` |
| `date` + `time` | `createdAt` | 组合为 ISO 字符串后 `Date.parse()`；缺省时使用 `createdAt` |
| `price` | `price` | 直接复制 |
| `shares` | `quantity` | 直接复制 |
| `amount` | `amount` | 直接复制 |
| `fee` | — | 丢弃 |
| `strategy` / `batch` / `note` | — | 丢弃 |
| `createdAt` | `createdAt` | ISO → ms，作为 `date+time` 的 fallback |
| — | `status` | `'filled'` |
| — | `accountType` | `'paper'` |

**示例**
```json
// V6
{ "id": "1717750000000-abc123", "symbol": "600519.SH", "type": "buy", "date": "2026-06-06", "time": "10:30", "price": 1600, "shares": 100, "amount": 160000, "createdAt": "2026-06-06T10:30:00.000Z" }

// V9
{ "id": "ord_xxx", "symbol": "600519.SH", "direction": "buy", "quantity": 100, "price": 1600, "amount": 160000, "status": "filled", "accountType": "paper", "createdAt": 1749203400000 }
```

---

### 3.4 `daily_quotes`

V6 是扁平记录：每个 symbol + tradeDate 一条。V9 是聚合结构：每个 symbol 一条，包含 `latest` 和 `history[]`。

**转换规则**
1. 按 `symbol` 分组。
2. 对每个 symbol 的所有记录按 `tradeDate` 升序排列。
3. 最后一条作为 `latest`。
4. 全部记录转换为 `KlineBar` 后存入 `history`。
5. `updatedAt` 取分组内最大的 `updatedAt`（ISO → ms）。

| V6 字段 | V9 字段 | 转换规则 |
|---|---|---|
| `symbol` | `symbol` | 直接复制 |
| `tradeDate` | `KlineBar.date` | 直接复制 |
| `open` / `high` / `low` / `price` | `open` / `high` / `low` / `close` | `price` → `close` |
| `volume` | `volume` | 直接复制 |
| `amount` | `amount` | 直接复制 |
| — | `period` | `'daily'` |
| — | `adjust` | `'qfq'` |
| `updatedAt` | `updatedAt` | ISO → ms |

**示例**
```json
// V6（两条）
[
  { "symbol": "600519.SH", "tradeDate": "2026-06-05", "open": 1575, "high": 1580, "low": 1570, "price": 1575, "volume": 9000, "amount": 1.4e9, "updatedAt": "2026-06-05T15:00:00.000Z" },
  { "symbol": "600519.SH", "tradeDate": "2026-06-06", "open": 1580, "high": 1620, "low": 1570, "price": 1600, "volume": 10000, "amount": 1.6e9, "updatedAt": "2026-06-06T15:00:00.000Z" }
]

// V9
{
  "symbol": "600519.SH",
  "latest": { "date": "2026-06-06", "open": 1580, "high": 1620, "low": 1570, "close": 1600, "volume": 10000, "amount": 1.6e9 },
  "history": [
    { "date": "2026-06-05", "open": 1575, "high": 1580, "low": 1570, "close": 1575, "volume": 9000, "amount": 1.4e9 },
    { "date": "2026-06-06", "open": 1580, "high": 1620, "low": 1570, "close": 1600, "volume": 10000, "amount": 1.6e9 }
  ],
  "period": "daily",
  "adjust": "qfq",
  "updatedAt": 1749222000000
}
```

---

### 3.5 `sector_scores`

V9 `SectorScoreRecord` 与 V6 结构基本一致，可直接迁移。

| V6 字段 | V9 字段 | 转换规则 |
|---|---|---|
| `id` | `id` | 直接复制 |
| `sectorCode` | `sectorCode` | 直接复制 |
| `scoreDate` | `scoreDate` | 直接复制 |
| `dimensions` | `dimensions` | 直接复制 |
| `composite` | `composite` | 直接复制 |
| `isCore` | `isCore` | 直接复制 |
| `modelUsed` | `modelUsed` | 直接复制 |
| `notes` | — | 丢弃 |
| `createdAt` | `createdAt` | 保持 ISO 字符串 |

---

### 3.6 `rotation_scores`

| V6 字段 | V9 字段 | 转换规则 |
|---|---|---|
| `id` | `id` | 直接复制 |
| `sectorCode` | `sectorCode` | 直接复制 |
| `sectorName` | `sectorName` | 直接复制 |
| `swLevel1/2/3` | `swLevel1/2/3` | 直接复制 |
| `scoreDate` | `scoreDate` | 直接复制 |
| `f1Jingqi` / `f2Zijin` / `f3Guzhi` / `f4Beta` / `f5Nengliang` | 同名 | 直接复制 |
| `total` | `total` | 直接复制 |
| `resonance` | `resonance` | 直接复制 |
| `signal` | `signal` | 直接复制 |
| `signalColor` | — | 丢弃 |
| `alertLevel` | `alertLevel` | 直接复制 |
| `declineType` | `declineType` | 直接复制 |
| `poolStocks` + `poolStockNames` | `poolStocks` | 合并为 `Array<{symbol, name, v6Composite?: number}>` |
| `analysisReport` | `analysisReport` | 直接复制 |
| `modelUsed` | `modelUsed` | 直接复制 |
| `createdAt` | `createdAt` | 保持 ISO 字符串 |

---

### 3.7 `score_docs`

V9 结构与 V6 基本一致，直接迁移。

| V6 字段 | V9 字段 | 转换规则 |
|---|---|---|
| `docId` | `docId` | 直接复制 |
| `symbol` | `symbol` | 直接复制 |
| `stockName` | `stockName` | 直接复制 |
| `version` | `version` | 直接复制 |
| `scoreDate` | `scoreDate` | 直接复制 |
| `composite` / `l3v` / `layers` / `recommendation` / `targetPrice` / `keyRisks` / `keyCatalysts` / `reportMd` / `modelUsed` / `market` / `industry` / `changeFromPrev` | 同名 | 直接复制 |
| `createdAt` | `createdAt` | 保持 ISO 字符串 |

---

### 3.8 `strategy_snapshots`

| V6 字段 | V9 字段 | 转换规则 |
|---|---|---|
| `id` | `id` | 直接复制 |
| `version` | `version` | 直接复制 |
| `timestamp` | `timestamp` | **ISO string → ms** |
| `date` / `time` / `stockCount` / `scoreCount` / `rotationCount` | 同名 | 直接复制 |
| `core` / `hot` / `value` | 同名 | `items` 精简为 `{symbol, name, composite, classification}`，丢弃 `l1Score/l3fScore/l7Score/l8Score/resonance` 等明细 |
| `changeFromPrev` | `changeFromPrev` | 直接复制 |
| `trigger` | `trigger` | 直接复制 |

**示例**
```json
// V6
{
  "id": "snapshot_1717750000000",
  "version": 1,
  "timestamp": "2026-06-06T10:30:00.000Z",
  "date": "2026-06-06",
  "time": "10:30:00",
  "stockCount": 50,
  "core": { "count": 5, "avgComposite": 4.3, "maxComposite": 4.8, "symbols": ["600519.SH"], "items": [{ "symbol": "600519.SH", "name": "贵州茅台", "composite": 4.8, "l1Score": 4.5, "l3fScore": 4.2, "classification": "core" }] },
  "trigger": "manual"
}

// V9
{
  "id": "snapshot_1717750000000",
  "version": 1,
  "timestamp": 1749203400000,
  "date": "2026-06-06",
  "time": "10:30:00",
  "stockCount": 50,
  "scoreCount": 0,
  "rotationCount": 0,
  "core": { "count": 5, "avgComposite": 4.3, "maxComposite": 4.8, "symbols": ["600519.SH"], "items": [{ "symbol": "600519.SH", "name": "贵州茅台", "composite": 4.8, "classification": "core" }] },
  "hot": { "count": 0, "avgComposite": 0, "maxComposite": 0, "symbols": [], "items": [] },
  "value": { "count": 0, "avgComposite": 0, "maxComposite": 0, "symbols": [], "items": [] },
  "trigger": "manual"
}
```

---

### 3.9 `local_docs`

V9 结构与 V6 基本一致，直接迁移。

| V6 字段 | V9 字段 | 转换规则 |
|---|---|---|
| `id` / `symbol` / `name` / `content` / `category` / `tags` / `sourcePath` / `size` / `addedAt` | 同名 | 直接复制 |

---

### 3.10 `news`

| V6 字段 | V9 字段 | 转换规则 |
|---|---|---|
| `id` | `id` | 直接复制 |
| `title` / `content` / `url` / `source` / `category` / `keywords` / `hash` / `relatedStocks` | 同名 | 直接复制 |
| `publishTime` | `publishTime` | 保持 ISO 字符串 |
| `fetchTime` | `fetchTime` | 保持 ISO 字符串 |
| `sentiment` | `sentiment` | **number → label**（见 2.2） |
| `sentimentConfidence` | `sentimentConfidence` | 直接复制 |

---

### 3.11 `news_stock_map`

V9 结构与 V6 基本一致，直接迁移。

| V6 字段 | V9 字段 | 转换规则 |
|---|---|---|
| `id` / `symbol` / `newsId` / `relevanceScore` / `isTitleMatch` / `isContentMatch` / `industryMatch` | 同名 | 直接复制 |

---

### 3.12 `sentiment_cache`

| V6 字段 | V9 字段 | 转换规则 |
|---|---|---|
| `id` / `contentHash` / `confidence` / `method` / `llmModel` | 同名 | 直接复制 |
| `sentiment` | `sentiment` | **number → label**（见 2.2） |
| `analyzedAt` | `analyzedAt` | **ISO string → ms** |

---
## 4. 关键转换函数签名（供 `v6MigrationService` 实现）

```ts
// 1. 情感数值 → 标签
export function sentimentNumberToLabel(score: number): 'positive' | 'negative' | 'neutral'

// 2. ISO 时间 → 毫秒时间戳（安全版本）
export function parseTimestamp(value: string | number | undefined): number | undefined

// 3. 股票行业/主题信息归一化
export function normalizeStockThemes(v6: V6Stock): { industryCode?: string; sector?: string; theme?: string[]; group?: string }

// 4. V6 订单 → V9 订单
export function transformV6Order(v6: V6Order): Order

// 5. V6 行情 → V9 聚合行情（按 symbol 分组）
export function transformV6DailyQuotes(v6Quotes: V6DailyQuote[]): DailyQuotes[]

// 6. V6 评分 → V9 评分（简化）
export function transformV6Score(v6: V6Score): V9V6Score

// 7. V6 评分 → V9 评分文档
export function transformV6ScoreToDoc(v6: V6Score): ScoreDocVersion

// 8. V6 策略快照 → V9 策略快照
export function transformV6StrategySnapshot(v6: V6StrategySnapshot): StrategySnapshot

// 9. V6 资讯 → V9 资讯
export function transformV6NewsArticle(v6: V6NewsArticle): NewsArticle

// 10. V6 情感缓存 → V9 情感缓存
export function transformV6SentimentCache(v6: V6SentimentCache): SentimentCache
```

---

## 5. 冲突处理与导入策略

### 5.1 默认策略：跳过已存在
- 对每个目标 record，先按 keyPath 查询。
- 若存在，计数到 `skipped`，不覆盖。

### 5.2 可选策略：覆盖
- 在 UI 提供开关 `overwriteExisting`。
- 开启时，已存在记录使用转换后的数据写入（通过 dataLayer 对应 save 方法）。

### 5.3 依赖顺序
导入必须按以下顺序执行，以避免外键/关联查询失败：
1. `stocks`
2. `daily_quotes`
3. `v6_scores`（同时生成 `score_docs`）
4. `orders`
5. `sector_scores`
6. `rotation_scores`
7. `score_docs`（V6 原有的 `score_docs`）
8. `strategy_snapshots`
9. `local_docs`
10. `sentiment_cache`
11. `news`
12. `news_stock_map`

### 5.4 失败处理
- 单条记录失败不中断整个迁移。
- 记录 `errors: Array<{ store: string, index: number, error: string, symbol/id?: string }>`。
- 最终报告包含：store 总数、成功数、跳过数、失败数。

---

## 6. 迁移报告结构

```ts
interface MigrationReport {
  success: boolean
  durationMs: number
  summary: {
    totalStores: number
    importedRecords: number
    skippedRecords: number
    failedRecords: number
  }
  details: Array<{
    store: string
    total: number
    success: number
    skipped: number
    failed: number
    errors?: Array<{ index: number; id?: string; error: string }>
  }>
}
```

---

## 7. 版本与兼容性

- **本文档版本**：1.0
- **适用 V9 版本**：v0.9.0+
- **适用 V6 Pro 版本**：源码备份中的最新版本（导出 API 为 `dataManager.export()`）
- **DB_VERSION**：6（迁移过程中不升级数据库 schema）
- **未来变更**：若 V9 schema 升级，需同步更新本文档并递增文档版本号。

---

## 8. 实现检查清单

- [x] 用户已确认 1.2 数据源选择方案（方案 A：全量导出）。
- [x] 用户已确认 1.4 V6 特有 store 的处理方案（暂按方案 C 不导入，预留扩展点）。
- [x] `v6MigrationService.ts` 中所有转换函数与本规范第 3 节字段映射表一致。
- [x] 转换函数能正确处理缺失字段、null、NaN、非预期类型。
- [x] 导入顺序符合第 5.3 节。
- [x] 默认使用"跳过已存在"策略，并支持可选"覆盖"。
- [x] 单元测试覆盖本规范中的每个转换示例。
- [x] `MigrationPanel` 能展示转换预览与迁移报告。
- [x] 全量质量门禁通过。

---

## 9. 附录：V6 导出 JSON 最小可测示例

```json
{
  "stocks": [
    {
      "symbol": "600519.SH",
      "name": "贵州茅台",
      "market": "A股",
      "industryL1": "食品饮料",
      "industryL2": "白酒",
      "conceptTags": ["白酒龙头"],
      "isFavorite": true,
      "source": "手动添加",
      "createdAt": "2026-01-01T00:00:00.000Z",
      "updatedAt": "2026-01-02T00:00:00.000Z"
    }
  ],
  "daily_quotes": [
    {
      "symbol": "600519.SH",
      "tradeDate": "2026-06-06",
      "open": 1580,
      "high": 1620,
      "low": 1570,
      "price": 1600,
      "volume": 10000,
      "amount": 1.6e9,
      "updatedAt": "2026-06-06T15:00:00.000Z"
    }
  ],
  "v6_scores": [
    {
      "symbol": "600519.SH",
      "scoreDate": "2026-06-06",
      "composite": 4.2,
      "layers": { "L0": { "score": 4.5, "reason": "", "weight": 0.1 } },
      "modelUsed": "deepseek-chat",
      "promptVersion": "V6-L0L8-v1",
      "createdAt": "2026-06-06T08:00:00.000Z"
    }
  ],
  "orders": [
    {
      "id": "1717750000000-abc123",
      "symbol": "600519.SH",
      "type": "buy",
      "date": "2026-06-06",
      "time": "10:30",
      "price": 1600,
      "shares": 100,
      "amount": 160000,
      "createdAt": "2026-06-06T10:30:00.000Z"
    }
  ],
  "sector_scores": [],
  "rotation_scores": [],
  "score_docs": [],
  "strategy_snapshots": [],
  "local_docs": [],
  "news": [
    {
      "id": "news_xxx",
      "title": "贵州茅台业绩超预期",
      "content": "...",
      "url": "https://example.com/1",
      "source": "sina",
      "category": "个股",
      "publishTime": "2026-06-06T09:00:00.000Z",
      "fetchTime": "2026-06-06T09:05:00.000Z",
      "sentiment": 0.5,
      "sentimentConfidence": 0.85,
      "relatedStocks": ["600519.SH"],
      "keywords": ["茅台"],
      "hash": "hash_xxx"
    }
  ],
  "news_stock_map": [
    {
      "id": "600519.SH_news_xxx",
      "symbol": "600519.SH",
      "newsId": "news_xxx",
      "relevanceScore": 0.85,
      "isTitleMatch": true,
      "isContentMatch": false,
      "industryMatch": false
    }
  ],
  "sentiment_cache": [
    {
      "id": "sent_xxx",
      "contentHash": "hash_xxx",
      "sentiment": 0.5,
      "confidence": 0.85,
      "method": "rule",
      "analyzedAt": "2026-06-06T09:05:00.000Z"
    }
  ]
}
```
