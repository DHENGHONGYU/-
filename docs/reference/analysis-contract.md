---
title: analysis-contract
code_version: 2.0.0

tier: important
---

---
title: analysis-contract.md
status: draft
owner: 架构组
updated: 2026-07-12
code_version: 2.0.0
tier: important
---

# analysis-contract.md — 投研分析核心子域接口契约

> **定位**：定义 `analysis` 子域的接口契约、职责边界、数据流与依赖关系。  
> **关联**：`./services-catalog.md`（24 子域总览）、`../../AGENTS.md` §一（分层规则）。

---

## 1. 职责边界

### 1.1 核心职责

- **投研数据查询与加载**：为分析页面提供统一的只读数据加载入口，包括股票列表、V6 评分、日线行情、行业评分、智能评分、研究日志等（`scorePageService.ts`、`analysisService.ts`）。
- **评分文档版本库管理**：为单只股票保存每次评分的完整 Markdown 报告与维度得分，自动递增版本号、计算与上一版的差异，支持跨版本对比与跨股票对比（`scoreDocService.ts`）。
- **板块轮动量化与行业评分**：基于十五五规划板块定义，计算板块轮动评分（景气/资金/估值/β/量能五因子），生成共振强度、信号标签、预警等级与下跌性质判定，支持 CSV 导出（`rotationScoreService.ts`、`rotation/rotationCalculator.ts`、`rotation/rotationSignalGrader.ts`、`sectorAnalysisEngine.ts`）。
- **多周期评分趋势聚合**：将行业评分（V4）与智能评分（个股）按周/月/季度聚合为趋势数据，提供可视化时间轴（`scoreTrendService.ts`）。
- **股票筛选与晋级引擎**：按数据质量与评分阈值自动将股票从 `candidate` → `screened` → `deepDive` 晋级流转（`screeningEngine.ts`）。

### 1.2 分层定位

| 维度 | 说明 |
|------|------|
| 所属层 | `src/services/`（服务层） |
| 依赖方向 | 只能依赖 `core/`、`data/`、`lib/`（白名单）、`constants/`、`config/`、`types/` |
| 禁止事项 | 禁止直写 IndexedDB（须经 `DataBridge.forward()`）；**当前部分读操作仍直接调用 `dataLayer`（读操作豁免）** |
| 被依赖方 | `store/`（状态层）、`pages/`（页面层）、`components/` 可消费本服务输出 |

### 1.3 与相邻子域的关系

| 相邻子域 | 关系 | 数据流 |
|----------|------|--------|
| `scoring` | 上游：提供评分阈值与配置 | `scoring/v6-engine/config` → `analysis/scoreDocService`（引用 `DEFAULT_THRESHOLDS`） |
| `stockpool` | 下游协作：流转股票状态 | `analysis/screeningEngine` → `stockpool/stockpoolService`（`transitionStock`） |
| `data-collector` | 上游：提供原始数据 | 外部数据 → `dataLayer` → `analysis/*` 读取 |
| `collection` | 上游：数据编排 | 数据质量检查结果 → `analysis/screeningEngine` 使用 |

---

## 2. 公共接口

### 2.1 类型定义（TypeScript Interface）

```typescript
// 文件：src/services/analysis/scoreDocService.ts

export interface ScoreDocInput {
  symbol: string
  stockName: string
  scoreDate?: string
  composite: number
  l3v: number
  layers: Record<string, V6LayerScore>
  recommendation?: { key: string; label: string; color: string }
  targetPrice?: { bull: number; base: number; bear: number }
  keyRisks?: string[]
  keyCatalysts?: string[]
  reportMd?: string
  modelUsed?: string
  market?: string
  industry?: string
}

export interface ScoreDocDiff {
  newerVersion: number
  olderVersion: number
  compositeDelta: number
  l3vDelta: number
  layerChanges: Array<{
    code: string
    oldScore: number
    newScore: number
    delta: number
  }>
  addedLayers: string[]
  removedLayers: string[]
  ratingChanged: boolean
  oldRating: string
  newRating: string
}
```

```typescript
// 文件：src/services/analysis/scoreTrendService.ts

export type ScoreTrendEntityType = 'industry' | 'stock'

export interface ScoreTrendPoint {
  period: string
  composite: number
  count: number
  dimensions: Record<string, number>
}

export interface ScoreTrendData {
  entityId: string
  entityType: ScoreTrendEntityType
  period: ScoreTrendPeriod
  points: ScoreTrendPoint[]
}
```

```typescript
// 文件：src/services/analysis/screeningEngine.ts

export interface ScreeningResult {
  promotedToScreened: string[]
  promotedToDeepDive: string[]
  errors: string[]
}
```

### 2.2 主入口函数

| 函数 | 签名 | 职责 | 错误处理 |
|------|------|------|----------|
| `listStocks()` | `() => Promise<DataLayerResult<Stock[]>>` | 获取全部标的列表 | `DataBridge.query` 失败返回 error |
| `listV6Scores()` | `() => Promise<DataLayerResult<V6Score[]>>` | 获取全部 V6 评分 | `DataBridge.query` 失败返回 error |
| `saveScoreDoc()` | `(input: ScoreDocInput) => Promise<DataLayerResult<ScoreDocVersion>>` | 保存评分文档并自动递增版本 | `dataLayer.scoreDocs.save` + logger 记录 |
| `getRecentVersions()` | `(symbol: string, limit?: number) => Promise<DataLayerResult<ScoreDocVersion[]>>` | 获取某股票最近 N 个评分版本 | `dataLayer.scoreDocs.listBySymbol` + 排序 |
| `compareTwoVersions()` | `(symbol: string, leftV: number, rightV: number) => Promise<DataLayerResult<ScoreComparisonResult>>` | 同股票两版本对比 | logger 记录 + 返回 error |
| `compareTwoStocksLatest()` | `(left: string, right: string) => Promise<DataLayerResult<ScoreComparisonResult>>` | 跨股票最新版本对比 | logger 记录 + 返回 error |
| `saveRotationScore()` | `(input: RotationInput) => Promise<DataLayerResult<RotationSectorScore>>` | 计算并保存单板块轮动评分 | `DataBridge.forward` + logger 记录 |
| `saveDefaultRotationScores()` | `(date?: string) => Promise<DataLayerResult<RotationSectorScore[]>>` | 批量计算并保存默认板块轮动评分 | `DataBridge.forward` + logger 记录 |
| `getRotationScores()` / `listRotationScores()` | `(code?: string) => Promise<DataLayerResult<RotationSectorScore[]>>` | 查询板块轮动评分 | `dataLayer.rotationScores.list` |
| `exportRotationCsv()` | `(data: RotationCsvRow[]) => string` | 导出看板数据为 CSV | 纯计算，无副作用 |
| `runScreening()` | `() => Promise<DataLayerResult<ScreeningResult>>` | 全量股票池筛选晋级 | `DataBridge.query` + `stockpoolService.transitionStock` |
| `screenSingleStock()` | `(symbol: string) => Promise<DataLayerResult<ScreeningResult>>` | 单只股票即时筛选 | `DataBridge.query` + `stockpoolService.transitionStock` |
| `loadIndustryScoreTrend()` | `(code: string, period: ScoreTrendPeriod) => Promise<Result<ScoreTrendData>>` | 行业评分趋势聚合 | `dataLayer.industryScores.listByCode` + logger 记录 |
| `loadStockScoreTrend()` | `(symbol: string, period: ScoreTrendPeriod) => Promise<Result<ScoreTrendData>>` | 个股智能评分趋势聚合 | `dataLayer.intelligentScores.listBySymbol` + logger 记录 |
| `calculateAndSaveDefaultRotationScores()` | `(date?: string) => Promise<DataLayerResult<RotationSectorScore[]>>` | 编排板块轮动评分计算 | 委托 `rotationScoreService` + logger 记录 |
| `calculateAndSaveDefaultIndustryScores()` | `() => Promise<DataLayerResult<IndustryScore[]>>` | 编排默认行业评分计算 | `DataBridge.forward` + logger 记录 |

### 2.3 事件接口

> 当前 `analysis` 子域未直接发布 `EventBus` 事件。所有状态变更通过 `DataBridge.forward()` 或 `dataLayer` 写操作完成，由 `Store` 层通过 `withBroadcast` 或数据监听机制感知变更。

| 事件名 | 发布方 | 订阅方 | 说明 |
|--------|--------|--------|------|
| `scoreDocs:updated` | 间接（通过 `dataLayer.scoreDocs.save`） | `store/scoreDocStore` | 评分文档保存后 Store 同步 |
| `rotationScores:updated` | 间接（通过 `DataBridge.forward`） | `store/rotationStore` | 板块轮动评分保存后 Store 同步 |

---

## 3. 数据流

```
[外部输入 / 上游服务]
    ↓
analysisService.{query}() / scorePageService.{load}()
    ↓ (DataBridge.query 或 dataLayer 直接读取)
DataBridge / dataLayer → routeToDB() → IndexedDB
    ↓ (数据返回)
analysis 子域 Service (计算/编排/格式化)
    ↓ (DataBridge.forward() 或 dataLayer 直接写入)
DataBridge → routeToDB() → dataLayer → IndexedDB
    ↓ (Zustand withBroadcast)
analysisStore / scoreDocStore / rotationStore (Zustand + withBroadcast)
    ↓
components/pages (仅经 Store 取数)
```

**关键数据流说明**：
- **读路径**：`scorePageService.ts`、`scoreTrendService.ts`、`analysisService.ts` 通过 `dataLayer` 或 `dataBridge.query` 读取数据。
- **写路径**：`rotationScoreService.ts`、`sectorAnalysisEngine.ts` 通过 `DataBridge.forward()` 写入；`scoreDocService.ts` 通过 `dataLayer.scoreDocs.save()` 直接写入（与 `DataBridge.forward()` 路径并存）。
- **筛选路径**：`screeningEngine.ts` 先读取 `dataBridge` 中的股票与评分数据，再调用 `stockpool/stockpoolService.transitionStock()` 更新股票状态。

---

## 4. 配置与依赖

### 4.1 依赖白名单（lib/）

| 依赖 | 路径 | 用途 | 引用文件 |
|------|------|------|----------|
| logger | `@/lib/logger` | 日志输出（`getLogger()`） | `scoreDocService.ts`、`scoreTrendService.ts`、`rotationScoreService.ts`、`sectorAnalysisEngine.ts`、`rotationCalculator.ts` |

### 4.2 其他依赖

| 依赖 | 路径 | 用途 | 备注 |
|------|------|------|------|
| dataBridge | `@/core/databridge` | 数据桥接读写（ACL/审计） | `analysisService.ts`、`rotationScoreService.ts`、`sectorAnalysisEngine.ts`、`screeningEngine.ts` |
| EnvelopeFactory | `@/core/envelope` | 信封工厂（DataBridge 写操作） | `rotationScoreService.ts`、`sectorAnalysisEngine.ts` |
| dataLayer | `@/data/dataLayer` | 直接数据访问（读为主） | `scoreDocService.ts`、`scorePageService.ts`、`scoreTrendService.ts`、`sectorAnalysisEngine.ts`、`rotationScoreService.ts` |
| SECTOR_DEFINITIONS | `@/data/sectorDefinitions` | 板块定义静态数据 | `rotationScoreService.ts` |
| dbConfig | `@/config/dbConfig` | `ENVELOPE_ACTION`、`STORE_NAME`、`MODULE_ID` 等 | `analysisService.ts`、`rotationScoreService.ts`、`screeningEngine.ts`、`sectorAnalysisEngine.ts` |
| rotationConfig | `@/config/rotationConfig` | `DEFAULT_SECTORS`、`ROTATION_FACTORS`、`ALERT_LEVELS`、`SCORE_BUCKETS`、`SUB_FACTOR_MAP`、`SIGNAL_GRADES` | `rotationScoreService.ts`、`rotationCalculator.ts`、`rotationSignalGrader.ts` |
| thresholds | `@/config/thresholds` | `ROTATION_CALCULATOR_THRESHOLDS` | `rotationCalculator.ts` |
| screeningConfig | `@/config/screeningConfig` | `getDefaultScreeningConfig` | `screeningEngine.ts` |
| mathConstants | `@/config/mathConstants` | `MS_PER_DAY` | `scoreTrendService.ts` |
| theme.tokens | `@/constants/theme.tokens` | `COLOR_TOKENS` | `scoreDocService.ts`、`rotationCalculator.ts` |
| scoring config | `@/services/scoring/v6-engine/config` | `DEFAULT_THRESHOLDS` | `scoreDocService.ts`（跨子域引用） |
| stockpoolService | `@/services/stockpool/stockpoolService` | `transitionStock` | `screeningEngine.ts`（跨子域引用） |
| nanoid | `nanoid` | traceId 生成 | `rotationScoreService.ts`、`sectorAnalysisEngine.ts` |

### 4.3 配置项

| 配置名 | 默认值 | 说明 | 来源 |
|--------|--------|------|------|
| `ROTATION_FACTORS` | `{F1..F5}` | 五因子定义与权重 | `src/config/rotationConfig.ts` |
| `DEFAULT_SECTORS` | 15 板块 | 十五五规划板块定义 | `src/config/rotationConfig.ts` |
| `ALERT_LEVELS` | 4 级 | 板块预警等级阈值 | `src/config/rotationConfig.ts` |
| `SCORE_BUCKETS` | 4 档 | 板块评分分档 | `src/config/rotationConfig.ts` |
| `SIGNAL_GRADES` | 5 级 | 轮动信号分级 | `src/config/rotationConfig.ts` |
| `SUB_FACTOR_MAP` | 16 子因子 | 子因子元数据与分值上限 | `src/config/rotationConfig.ts` |
| `ROTATION_CALCULATOR_THRESHOLDS` | — | 计算器阈值（共振/下跌/预警） | `src/config/thresholds.ts` |
| `DEFAULT_THRESHOLDS.rating.strongBuy` | 4.0 | 核心股票评分阈值 | `src/services/scoring/v6-engine/config.ts` |
| `MS_PER_DAY` | 86400000 | 毫秒/天（趋势聚合） | `src/config/mathConstants.ts` |
| `RESEARCH_STATUS` | enum | 研究状态枚举 | `src/config/dbConfig.ts` |
| `ENVELOPE_ACTION` | enum | DataBridge 信封动作 | `src/config/dbConfig.ts` |
| `STORE_NAME` | enum | IndexedDB store 名 | `src/config/dbConfig.ts` |
| `MODULE_ID` | enum | 模块 ID | `src/config/dbConfig.ts` |

---

## 5. 测试策略

| 测试类型 | 文件 | 说明 |
|----------|------|------|
| 单元测试 | `src/services/analysis/__tests__/dataFreshnessGuard.test.ts` | `dataFreshnessGuard` 兼容 facade 测试（9.1 KB） |
| 单元测试 | `src/services/analysis/__tests__/scoreDocService.test.ts` | 评分文档保存/版本/差异计算测试（3.0 KB） |
| 单元测试 | `src/services/analysis/__tests__/scoreTrendService.test.ts` | 多周期趋势聚合/周期标签格式化测试（6.1 KB） |
| 单元测试 | `src/services/analysis/analysisService.test.ts` | `listStocks` / `listV6Scores` 基础查询测试（4.4 KB） |
| 集成测试 | `tests/services/analysis.integration.test.ts` | **建议**：DataBridge 交互、Store 联动、筛选引擎晋级流转 |
| Mock 策略 | `__mocks__/dataLayer.ts` / `__mocks__/databridge.ts` | 隔离 `dataLayer` 与 `dataBridge` 外部依赖 |

---

## 6. 变更日志

| 日期 | 版本 | 变更 | 作者 |
|------|------|------|------|
| 2026-07-12 | v0.1.0 | 契约初稿 | 架构组 |

---

> **TODO[子域 owner]**：
> 1. 补充 `dataLayer` 直接写操作向 `DataBridge.forward()` 的统一迁移计划。
> 2. 补充 `rotationScoreService.ts` 中 `getRotationScores` 直接调用 `dataLayer.rotationScores` 的合规说明（读操作是否豁免需架构评审确认）。
> 3. 运行 `tsc --noEmit` + `audit:layers` 验证。
