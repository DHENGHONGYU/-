---
title: collection-contract.md — 数据采集子域接口契约
type: reference
domain: data
phase: design
tier: standard
status: active
maintainer: V9 Architecture Team
summary: "定位：定义 `collection` 子域的接口契约、职责边界、数据流与依赖关系。 关联：`./services-catalog.md`（24 子域总览）、`../../AGENTS.md`..."
tags: [data, collection, contract]
version: v1.0.0
last_updated: 2026-07-17
code_version: 2.0.0
doc_id: V9-DOC-DATA-050
change_log:
  - version: v1.0.0
changes: Initial version established
date: 2026-07-17
---

# collection-contract.md — 数据采集子域接口契约

> **定位**：定义 `collection` 子域的接口契约、职责边界、数据流与依赖关系。  
> **关联**：`./services-catalog.md`（24 子域总览）、`../../AGENTS.md` §一（分层规则）。

---

## 1. 职责边界

### 1.1 核心职责

- **数据采集向导配置持久化**：通过 `DataBridge` 对 `collectConfig` store 进行完整的 CRUD 操作，包括保存（`saveWizardConfig`）、更新（`updateWizardConfig`）、读取（`loadWizardConfig` / `loadAllWizardConfigs`）和删除（`deleteWizardConfig`）配置模板。
- **配置模板导出/导入**：提供 `configExportService` 支持配置模板的 JSON 格式导出与导入功能，包含导出元数据版本管理、格式校验、重名检测及浏览器端文件下载。
- **多维度数据源配置管理**：管理采集向导中多维度（quote、kline、financial 等）数据源的 API 配置、采集频率、优先级、缓存策略等参数，支撑数据采集 pipeline 的编排基础。

### 1.2 分层定位

| 维度 | 说明 |
|------|------|
| 所属层 | `src/services/`（服务层） |
| 依赖方向 | 只能依赖 `core/`、`data/`、`lib/`（白名单） |
| 禁止事项 | 禁止直写 IndexedDB（须经 `DataBridge.forward()`） |
| 被依赖方 | `store/`（状态层）、`pages/`（页面层）可消费本服务输出 |

### 1.3 与相邻子域的关系

| 相邻子域 | 关系 | 数据流 |
|----------|------|--------|
| `data-collector` | 下游：消费输出 | `collection` 保存的采集配置 → `data-collector` 执行实际数据采集任务 |
| `fetcher` | 平行协作：共享数据源定义 | `fetcher` 提供数据源端点元数据，`collection` 管理用户侧采集维度配置 |
| `types/modules/collection` | 上游：类型定义 | 类型层零依赖，本服务消费其定义的 `PersistedWizardConfig` 等接口 |
| `qualityMetricsCollector` | 内部：质量监控 | `collection` 采集过程中调用 `recordCollect()`/`recordWrite()` → `collectRuntimeStore.refreshStats()` → UI 9 Tab 监控 |

### 1.4 8 维度采集配置（2026-07-18 扩展）

| 维度 | 编码 | 采集模式 | 数据源 | 目标 store |
|------|------|----------|--------|------------|
| 基本信息（01） | quote | 实时 | akshare/ifind | `stocks` |
| K线数据（02） | kline | 每日 | akshare | `dailyQuotes` |
| 筹码分布（03） | chip | 每3天 | akshare/ifind | `news`（mock） |
| 重大事项（04） | news | 每日 | akshare/ifind | `news`（mock） |
| 热点新闻（05） | news | 每日 | akshare/yahoo | `news`（mock） |
| 行业竞品（06） | competitor | 每周 | akshare/ifind | `sectorScores`（mock） |
| 关联指数（07） | index | 每周 | akshare/ifind/yahoo | `sectorScores`（mock） |
| 研报中心（08） | research | 每日 | ifind | `researchLogs`（mock） |

### 1.5 数据质量门禁（2026-07-18 新增）

采集管线内置三重质量门禁：
1. **`auditRecord()`** — 写入后断言，校验关键字段非空（stocks→symbol、dailyQuotes→symbol、news→id 等）
2. **`recordCollect()/recordWrite()`** — 采集统计，6 个 return 点对称调用
3. **`refreshStats()`** — 统计同步刷新到 collectionRuntimeStore.stats，监控页 KPI 实时反映

---

## 2. 公共接口

### 2.1 类型定义（TypeScript Interface）

以下类型定义位于 `src/types/modules/collection.types.ts`，为本子域核心消费类型：

```typescript
// 本服务直接消费的核心类型

export interface PersistedWizardConfig {
  id: string
  name: string
  selectedDimensions: string[]
  apiConfigs: Record<string, ApiConfig>
  frequency: CollectionFrequency
  cronExpression: string
  priority: CollectionPriority
  cacheTTL: number
  cacheStrategy: CollectionCacheStrategy
  saveAsTemplate: boolean
  createdAt: number
  updatedAt: number
}

export interface ConfigExportMeta {
  exportVersion: string
  exportedAt: number
  sourceName: string
}

export interface ExportedConfigFile {
  meta: ConfigExportMeta
  config: PersistedWizardConfig
}

export interface ApiConfig {
  baseUrl: string
  apiKey?: string
  timeoutMs: number
  rateLimitPerMinute?: number
}

export type CollectionFrequency = 'realtime' | 'hourly' | 'daily' | 'custom'
export type CollectionPriority = 'high' | 'medium' | 'low'
export type CollectionCacheStrategy = 'stale-while-revalidate' | 'cache-first' | 'network-first'
```

### 2.2 主入口函数

#### collectionWizardPersistence.ts

| 函数 | 签名 | 职责 | 错误处理 |
|------|------|------|----------|
| `saveWizardConfig` | `(config: Omit<PersistedWizardConfig, 'id' \| 'createdAt' \| 'updatedAt'>) => Promise<PersistedWizardConfig>` | 生成唯一 ID 并保存向导配置到 IndexedDB（collectConfig store） | `logger.error` 记录 + 抛出原始错误 |
| `updateWizardConfig` | `(configId: string, updates: Partial<...>) => Promise<PersistedWizardConfig \| null>` | 加载现有配置、合并更新字段后回写 | 配置不存在返回 `null`，失败抛出错误 |
| `loadWizardConfig` | `(configId: string) => Promise<PersistedWizardConfig \| null>` | 通过 DataBridge.query 按 key 查询单个配置 | 查询失败或不存在返回 `null` |
| `loadAllWizardConfigs` | `() => Promise<PersistedWizardConfig[]>` | 查询所有 collectConfig 并按 updatedAt 降序排序 | 失败返回空数组 `[]` |
| `deleteWizardConfig` | `(configId: string) => Promise<boolean>` | 通过 DataBridge.forward 发送删除信封 | 失败返回 `false` |

#### configExportService.ts

| 函数 | 签名 | 职责 | 错误处理 |
|------|------|------|----------|
| `buildExportFile` | `(config: PersistedWizardConfig) => ExportedConfigFile` | 构造包含 meta + config 的导出文件结构 | 纯计算，无副作用 |
| `exportConfigToJSON` | `(config: PersistedWizardConfig) => Blob` | 将配置序列化为 JSON Blob | 纯计算，无副作用 |
| `importConfigFromJSON` | `(file: File) => Promise<ExportedConfigFile>` | 从 File 解析 JSON 并校验格式版本 | 格式错误抛出异常，`logger` 记录 |
| `generateExportFilename` | `(config: PersistedWizardConfig) => string` | 生成符合文件系统安全的导出文件名 | 纯计算，无副作用 |
| `downloadBlob` | `(blob: Blob, filename: string) => void` | 触发浏览器文件下载 | 无 |
| `exportAndDownloadConfig` | `(config: PersistedWizardConfig) => void` | 组合导出 + 下载的便捷函数 | `logger.info` 记录 |
| `validateImportedConfig` | `(config: PersistedWizardConfig, existingNames: string[]) => { ok: true } \| { ok: false; error: string }` | 校验导入配置的名称合法性和重名 | 纯计算，返回结果对象 |

### 2.3 事件接口

本子域**未直接发布/订阅 EventBus 事件**。数据变更通知通过 `DataBridge.forward()` 完成，由 `dataLayer` 写入 `collectConfig` store 后，由消费的 `store/` 层自行同步。`COLLECTION_EVENTS` 常量定义于 `src/types/modules/collection.types.ts`，供采集 pipeline 运行时事件使用（非本服务直接消费）。

---

## 3. 数据流

### 3.1 配置持久化数据流

```
[外部输入：用户在采集向导中填写配置]
    ↓
collectionWizardPersistence.{save/update/load/delete}WizardConfig()
    ↓ (DataBridge.forward() / DataBridge.query())
DataBridge → routeToDB() → dataLayer → IndexedDB (collectConfig store)
    ↓
collectionStore (Zustand + withBroadcast) ← 通过订阅或重新查询获取更新
    ↓
components/pages (仅经 Store 取数)
```

### 3.2 配置导出/导入数据流

```
导出流：
PersistedWizardConfig
    ↓
configExportService.buildExportFile() → ExportedConfigFile
    ↓
JSON.stringify() → Blob
    ↓
浏览器下载（downloadBlob）

导入流：
File (用户选择)
    ↓
configExportService.importConfigFromJSON() → ExportedConfigFile
    ↓
validateImportedConfig() 校验名称/重名
    ↓
collectionWizardPersistence.saveWizardConfig() → IndexedDB
```

---

## 4. 配置与依赖

### 4.1 依赖白名单（lib/ + core/ + config/）

| 依赖 | 路径 | 用途 |
|------|------|------|
| dataBridge | `@/core/databridge` | 数据路由（写入/查询 IndexedDB） |
| EnvelopeFactory | `@/core/envelope` | 构造 DataBridge 信封 |
| ENVELOPE_ACTION / ENVELOPE_TARGET / MODULE_ID / STORE_NAME | `@/config/dbConfig` | DB 操作常量与配置 |
| logger | `@/lib/logger` | 结构化日志输出（info/debug/warn/error） |
| validation | `@/lib/validation` | 配置名称校验（`validateConfigName`） |

### 4.2 配置项

| 配置名 | 默认值 | 说明 | 来源 |
|--------|--------|------|------|
| `CONFIG_ID_PREFIX` | `wizard_config_` | 向导配置模板 ID 前缀（内部常量） | 本模块 |
| `EXPORT_VERSION` | `'1.0'` | 配置导出文件版本号 | `configExportService.ts` |
| `ENVELOPE_ACTION.saveCollectConfig` | — | collectConfig store 写入动作 | `@/config/dbConfig` |
| `ENVELOPE_ACTION.deleteCollectConfig` | — | collectConfig store 删除动作 | `@/config/dbConfig` |
| `ENVELOPE_ACTION.queryGet` / `queryList` | — | 单条/列表查询动作 | `@/config/dbConfig` |

---

## 5. 测试策略

| 测试类型 | 文件 | 说明 |
|----------|------|------|
| 单元测试 | `src/services/collection/collectionWizardPersistence.test.ts` | CRUD 全生命周期测试（创建/读取/更新/删除/列表/过滤/排序），包含 14+ 个测试用例，覆盖成功路径与异常路径 |
| Mock 策略 | 内联 `vi.mock` | `dataBridge` 与 `getLogger` 均通过 Vitest `vi.mock` 隔离，确保测试纯服务逻辑 |

> **注**：`configExportService.ts` 当前暂无独立测试文件，建议补充纯函数单元测试（导出/导入/文件名生成/校验逻辑）。

---

## 6. 变更日志

| 日期 | 版本 | 变更 | 作者 |
|------|------|------|------|
| 2026-07-12 | v0.1.0 | 契约初稿：基于 `collectionWizardPersistence.ts` + `configExportService.ts` 完成职责、接口、数据流与依赖梳理 | 架构组 |

---

> **TODO[子域 owner]**：
> 1. 补充 `configExportService.ts` 的独立单元测试；
> 2. 若采集 pipeline 运行时事件发布逻辑迁移至本子域，需在 §2.3 补充 EventBus 事件接口；
> 3. 完成后运行 `tsc --noEmit` + `audit:layers` 验证。
