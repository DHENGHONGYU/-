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
version: v1.0.0
last_updated: 2026-07-17
code_version: "2.0.0-rc.1"
doc_id: V9-DOC-DATA-015
referenced_by: [V9-DOC-META-000, V9-DOC-PROJ-176, V9-DOC-PROJ-149]
change_log:
  - version: v1.0.0
changes: Initial version established
date: 2026-07-17
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
| 集成测试 | `MarketDataAdapter.test.ts` | 数据适配 |

---

## 6. 变更日志

| 日期 | 版本 | 变更 | 作者 |
|------|------|------|------|
| 2026-07-12 | v0.1.0 | 契约初稿 | 架构组 |
