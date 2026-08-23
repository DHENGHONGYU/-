---
title: data-collector 服务契约
type: reference
domain: data
phase: design
tier: important
status: active
maintainer: data-collector 子域 / 架构组
summary: "协调 fetcher 服务执行数据采集任务，管理采集管道、质量检测、缺失报告补全。"
tags: [data, collection, contract, reference, data-definition, store]
version: v1.0.4
last_updated: 2026-08-23
code_version: "2.0.0-rc.2"
doc_id: V9-DOC-DATA-015
referenced_by: [V9-DOC-META-000, V9-DOC-PROJ-176, V9-DOC-PROJ-149]
change_log:
  - version: v1.0.4
    changes: "遗留问题整改 P2/P3（2026-08-23）：① P2 测试侧同步——collection-dry-run COLLECTION_ACTION_STORE 补登记 saveDimensionCollectData、dataLayer 属性计数 49→50、blueprint Store 计数 55→56；② P3 collectionPipeline.ts（1555 行）拆分为 facade（~440 行）+ 7 个 pipeline/ 子模块（pipelineTypes/pipelineMappings/pipelineEvents/pipelineAudit/pipelineWriters/pipelineDataGen/pipelineHandlers），公开 API 零破坏（runSingleTrace/runBatchTrace/createDefaultCollectionConfig/resolve* 等 13 处消费方导入不变）；③ mockFallbackPolicy EWMA 断言适配重试×熔断交互（sina 重试 3 次达熔断阈值被跳过为预期行为）。接口契约无 BREAKING"
    date: 2026-08-23
  - version: v1.0.3
    changes: "代码侧变更确认兼容（采集管线卫生整改 2026-08-23）：① 退避策略统一——删除 dataSourceOrchestrator 本地 backoffDelayMs，新增 adaptiveSourceOrchestrator.computePolicyBackoffMs 作为 RetryPolicy 退避唯一入口（指数退避+全抖动+maxDelayMs 封顶）；② 新增 dataSourceOrchestrator.test.ts（12 例：降级链/重试/熔断跳过/akshare 占位/mock 门禁）与 adaptiveSourceOrchestrator.test.ts（7 例：退避公式/封顶/退化策略）；③ 删除 collectionPipeline 死代码 _unused_upgradeDimensionsLocally_；④ 七维→16 维过时注释对齐；⑤ akshare 占位治理文档化（注册表 disabled + 占位可观测性说明）"
    date: 2026-08-23
  - version: v1.0.2
    changes: "采集质量整改（P0）：① 接通 pipeline 重试循环——dataSourceOrchestrator 行情/K 线单源按 dimension.retryPolicy 指数退避重试，新增 RETRY 生命周期事件；② qualityMetrics 落库——新增 quality_metrics_history 存储（DB v37）与 qualityMetricsPersistence 服务，采集收尾三路径持久化指标快照；③ 新增 collectionPipeline.contract.test.ts 35 例契约单测"
    date: 2026-08-22
  - version: v1.0.1
    changes: "代码侧变更确认兼容：维度10-16采集接线修复 + ACL_MATRIX fetcher 增 localDocs + MonthlyBudgetGuard 预算守卫 + dry-run 静态接线校验"
    date: 2026-08-22
  - version: v1.0.0
    changes: Initial version established
    date: 2026-07-17

covers_code:
  - src/config/collectConfig.ts
  - src/services/data-collector/collectionPipeline.ts
  - src/services/data-collector/pipeline/
  - src/services/data-collector/dataSourceOrchestrator.ts
  - src/services/data-collector/dataSourceOrchestrator.test.ts
  - src/services/data-collector/adaptiveSourceOrchestrator.ts
  - src/services/data-collector/adaptiveSourceOrchestrator.test.ts


---
# data-collector-contract.md — 数据采集编排服务

> **定位**：协调 fetcher 服务执行数据采集任务，管理采集管道、质量检测、缺失报告补全。  
> **Source**：`./services-catalog.md`（子域 #5）、`../../AGENTS.md` §一。

---

## 1. 职责边界

### 1.1 核心职责

1. **采集任务编排**：将用户的采集需求（如「采集所有 A 股日 K」）拆分为可执行的 fetcher 任务队列。
2. **质量检测**：采集完成后校验数据完整性（缺失字段、异常值、时间断档）。
3. **缺失报告补全**：检测缺失数据，生成补采任务并自动调度。
4. **采集监控**：实时展示采集进度、成功率、失败重试次数。

### 1.2 分层定位

| 维度 | 说明 |
|------|------|
| 所属层 | `src/services/data-collector/`（服务层 #5） |
| 依赖方向 | `services/fetcher/`（上游数据源）、`core/`（DataBridge）、`lib/`（logger） |
| 禁止事项 | 禁止直写 IndexedDB（须经 DataBridge.forward()） |
| 被依赖方 | `store/collectionStore`、`pages/input/`（采集配置页面） |

### 1.3 与相邻子域的关系

| 相邻子域 | 关系 | 数据流 |
|----------|------|--------|
| `fetcher` | 下游调用 | `data-collector` → `fetcher`（触发采集） |
| `collection` | 上游调用方 | `collection` → `data-collector`（编排指令） |
| `input` | 下游消费方 | `data-collector` → `input`（采集进度反馈） |

---

## 2. 公共接口

### 2.1 类型定义

```typescript
// src/services/data-collector/dataCollectorTypes.ts

export interface CollectionTask {
  id: string;
  symbolList: string[];
  dataTypes: DataType[];      // 'daily_quotes' | 'financial_report' | 'news'
  schedule?: 'once' | 'daily' | 'weekly';
  priority: 'high' | 'normal' | 'low';
  createdAt: string;
}

export interface CollectionResult {
  taskId: string;
  total: number;
  success: number;
  failed: number;
  missing: MissingReport[];
  qualityScore: number;       // 0-100
}

export interface MissingReport {
  symbol: string;
  dataType: DataType;
  missingFields: string[];
  dateRange: { start: string; end: string };
}

export type DataType = 'daily_quotes' | 'financial_report' | 'news' | 'sector_data';
```

### 2.2 主入口函数

> **模块结构（v1.0.4，2026-08-23 P3 拆分）**：`collectionPipeline.ts` 保留为 **facade**（runSingleTrace/runBatchTrace 编排入口 + withLogging 包装 + 全部公开符号 re-export），实现拆分至 `src/services/data-collector/pipeline/` 7 个子模块：`pipelineTypes`（模式/选项/结果类型）、`pipelineMappings`（维度→模式/动作/源链解析）、`pipelineEvents`（生命周期事件）、`pipelineAudit`（字段审计与完整度上报）、`pipelineWriters`（写库分派）、`pipelineDataGen`（非行情数据生成）、`pipelineHandlers`（4 类分模式处理器）。**公开 API 与导入路径零破坏**，消费方一律继续从 `collectionPipeline` 导入。


| 函数 | 签名 | 职责 | 错误处理 |
|------|------|------|----------|
| `runCollection()` | `(task: CollectionTask) => Promise<CollectionResult>` | 执行采集任务 | 部分失败记录 missing report |
| `detectMissing()` | `(symbol: string, dataType: DataType) => MissingReport[]` | 检测缺失数据 | 无（纯查询） |
| `scheduleAutoFix()` | `(reports: MissingReport[]) => void` | 自动补采调度 | 调度失败 → logger |
| `getQualityMetrics()` | `(taskId: string) => QualityMetrics` | 采集质量统计 | 无（纯查询） |

### 2.3 事件接口

| 事件名 | 发布方 | 订阅方 | 说明 |
|--------|--------|--------|------|
| `collector:task:started` | data-collector | `collectionStore` | 任务开始 |
| `collector:task:completed` | data-collector | `collectionStore` | 任务完成 |
| `collector:missing:detected` | data-collector | `missingReportStore` | 缺失报告生成 |
| `collect:retry` | dataSourceOrchestrator | `collectionRuntimeStore` | 单源失败后按指数退避重试（v1.0.2 新增，P0-1） |

---

## 3. 数据流

```
用户配置（input 页面）
  ↓
collectionTaskStore（Zustand）
  ↓
data-collector.runCollection()
  ├─> 拆分为 fetcher 子任务
  ├─> 调用 fetcher.fetchBatch()
  ├─> 质量检测（qualityMetricsCollector）
  ├─> 生成 missing reports
  ↓
DataBridge.forward() → IndexedDB
  ↓
EventBus
  ↓
collectionStore / missingReportStore
```

---

## 4. 配置与依赖

### 4.1 依赖白名单

| 依赖 | 路径 | 用途 |
|------|------|------|
| logger | `@/lib/logger` | 采集任务日志 |
| EventBus | `@/lib/eventBus` | 任务状态事件 |
| errors | `@/lib/errors` | CollectionError |

### 4.2 配置项

| 配置名 | 默认值 | 说明 | 来源 |
|--------|--------|------|------|
| `COLLECTION_BATCH_SIZE` | 50 | 每批采集股票数 | `src/config/collectConfig.ts` |
| `COLLECTION_QUALITY_THRESHOLD` | 80 | 质量分合格线 | `src/config/collectConfig.ts` |
| `COLLECTION_AUTO_FIX` | true | 是否自动补采 | 用户配置（localStorage） |

---

## 5. 测试策略

| 测试类型 | 文件 | 说明 |
|----------|------|------|
| 单元测试 | `collectionReportService.test.ts` | 采集报告生成 |
| 单元测试 | `missingReportDetector.test.ts` | 缺失检测逻辑 |
| 契约测试 | `collectionPipeline.contract.test.ts` | 维度模式解析/接线一致性/链解析/默认配置（35 例，v0.2.0 新增） |
| 集成测试 | `MarketDataAdapter.test.ts` | 数据适配 |

---

## 6. 变更日志

| 日期 | 版本 | 变更 | 作者 |
|------|------|------|------|
| 2026-08-23 | v0.3.0 | 遗留问题整改 P2/P3：① 维度 11-14 改道 `dimension_collect_data` 专用存储（DB v38，八处注册点 + 测试侧四处计数/映射同步）；② `collectionPipeline.ts` 拆分为 facade + 7 个 `pipeline/` 子模块（公开 API 零破坏）；③ 全仓「七维」过时文案统一为十六维/采集策略配置（事实性七维与测试锁定标题保留）；④ EWMA 测试断言适配重试×熔断交互 | 架构组 |
| 2026-08-22 | v0.2.0 | P0 三项整改：① 接通 pipeline 重试循环（dataSourceOrchestrator 按 `dimension.retryPolicy` 指数退避，新增 `collect:retry` 事件）；② qualityMetrics 落库（`DB_VERSION` 36→37，新增 `quality_metrics_history` 存储 + `qualityMetricsPersistence` 服务，采集收尾三路径持久化）；③ 新增 `collectionPipeline.contract.test.ts` 35 例契约单测 | 架构组 |
| 2026-07-12 | v0.1.0 | 契约初稿 | 架构组 |
