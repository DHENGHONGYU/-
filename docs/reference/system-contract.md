---
title: system-contract.md
status: draft
owner: 架构组
updated: 2026-07-12
---

# system-contract.md — 系统级服务接口契约

> **定位**：定义 `system` 子域的接口契约、职责边界、数据流与依赖关系。  
> **关联**：`../../architecture/services-catalog.md`（24 子域总览）、`AGENTS.md` §一（分层规则）。

---

## 1. 职责边界

### 1.1 核心职责

- **系统生命周期管理**：集中管理应用启动顺序（IndexedDB 初始化 → PWA Service Worker 注册 → RBAC 权限回收定时任务），以及应用关闭/热更新时的清理钩子，避免 L5/L4 入口组件直接操作数据层。
- **系统状态监控与日志聚合**：通过 `SystemMonitorService` 轮询 Agent 健康状态（15s）与系统综合快照（30s），维护结构化监控日志 FIFO 缓冲区（最大 500 条），并通过 `EventBus` 向监控面板广播。
- **数据治理与本地文档管理**：提供系统统计查询、全量数据重置/导出（经 `DataBridge` ACL 校验），以及本地文件系统文档扫描、分类、摘要提取、分块与导入到 `IndexedDB`。
- **架构可视化与数据迁移**：为架构健康仪表盘提供分层节点、层间连接关系与 V6 引擎层状态映射；编排 V6 到 V9 的全量数据迁移（12 个 store），含转换、验证、审计日志。

### 1.2 分层定位

| 维度 | 说明 |
|------|------|
| 所属层 | `src/services/`（服务层） |
| 依赖方向 | 只能依赖 `core/`、`data/`、`lib/`（白名单） |
| 禁止事项 | 禁止直写 IndexedDB（须经 `DataBridge.forward()`）；读操作可经 `dataLayer` |
| 被依赖方 | `store/`（状态层）、`pages/`（页面层）可消费本服务输出 |

### 1.3 与相邻子域的关系

| 相邻子域 | 关系 | 数据流 |
|----------|------|--------|
| `pwa` | 同层协作：启动时注册 Service Worker | `bootstrapService` → `pwa/registerServiceWorker` |
| `rbac` | 同层协作：启动时激活权限回收定时任务 | `bootstrapService` → `rbac/permissionRevocationService` |
| `agents` | 下游消费：Agent 运行时、健康监控、注册表状态聚合为监控快照 | `agents/*` → `systemMonitorService` / `architectureService` |
| `data`（dataLayer / db） | 基础设施：数据读写与初始化 | `systemService` / `localDocService` / `migration` ↔ `dataLayer` |
| `store`（systemMonitor / engine / agentStore） | 下游：订阅 EventBus 事件获取快照与日志 | `systemMonitorService` / `monitorLogService` → `EventBus` → `store` |

> **注**：`architectureService` 与 `systemMonitorService` 从 `@/agents/` 导入运行时状态，用于监控与可视化聚合。`agents/` 定位为 core 层扩展，当前 services 层对其依赖用于只读状态聚合。

---

## 2. 公共接口

### 2.1 类型定义（TypeScript Interface）

```typescript
// 文件：src/services/system/systemService.ts

export interface SystemStats {
  stocks: number
  orders: number
  scores: number
}
```

```typescript
// 文件：src/services/system/aiMemoryService.ts

export interface MemoryChunk {
  id: string
  file: string
  title: string
  headings: string[]
  content: string
  tokens: number
}

export interface MemoryIndex {
  generatedAt: string
  version: string
  chunks: MemoryChunk[]
  keywords: Record<string, string[]>
}

export interface MemoryQueryResult {
  chunk: MemoryChunk
  score: number
}
```

```typescript
// 文件：src/services/system/localDocService.ts

export interface FileEntry {
  name: string
  path: string
  size: number
  content: string
  lastModified: number
}

export interface ScanResult {
  files: FileEntry[]
  totalSize: number
  errors: string[]
}
```

```typescript
// 文件：src/services/system/monitorLogService.ts

export type MonitorLogLevel = 'info' | 'warn' | 'error' | 'critical'
export type MonitorLogSource = 'engine' | 'agent' | 'system' | 'dataflow'

export interface MonitorLogEntry {
  id: string
  timestamp: number
  level: MonitorLogLevel
  source: MonitorLogSource
  message: string
  context: Record<string, unknown>
}

export interface MonitorLogFilter {
  level?: MonitorLogLevel
  source?: MonitorLogSource
  limit?: number
}
```

```typescript
// 文件：src/services/system/architectureService.ts

export interface ArchitectureNode {
  id: string
  name: string
  description: string
  modules: string[]
  color: string
  status: 'healthy' | 'warning' | 'critical' | 'unknown'
  moduleCount: number
}

export interface ArchitectureConnection {
  from: string
  to: string
  label: string
}

export interface EngineLayerNode {
  id: string
  name: string
  deterministic: boolean
  llmEnhanceable: boolean
  weight: number
  status: 'active' | 'idle' | 'error'
}

export interface AgentNode {
  id: string
  name: string
  status: string
  type: string
}

export interface ArchitectureSnapshot {
  layers: ArchitectureNode[]
  connections: ArchitectureConnection[]
  engineLayers: EngineLayerNode[]
  agentNodes: AgentNode[]
  timestamp: number
}
```

```typescript
// 文件：src/services/system/migration/migrationTypes.ts（核心节选）

export interface MigrationReport {
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

export interface MigrationOptions {
  overwriteExisting?: boolean
  dryRun?: boolean
}
```

### 2.2 主入口函数

| 函数 | 签名 | 职责 | 错误处理 |
|------|------|------|----------|
| `loadSystemStats()` | `() => Promise<DataLayerResult<SystemStats>>` | 查询 stocks/orders/scores 数量 | try-catch 返回 `error` 字段 |
| `resetAll()` | `() => Promise<DataLayerResult<void>>` | 全量数据重置（经 DataBridge ACL） | `DataBridge.forward()` 异常捕获 |
| `exportAll()` | `() => Promise<DataLayerResult<Record<string, unknown[]>>>` | 全量数据导出 | `DataBridge.forward()` + `dataLayer.manager.export()` |
| `initializeApp()` | `() => Promise<void>` | 应用启动：db.init → PWA → RBAC | 抛出异常，阻断后续启动 |
| `shutdownApp()` | `() => void` | 应用关闭：停止 RBAC 定时任务 | logger 记录 |
| `fetchHealthReport()` | `() => Promise<HealthReport>` | 获取 `public/health-report.json` | fetch 失败抛 Error |
| `loadMemoryIndex()` | `() => Promise<MemoryIndex>` | 加载 AI 记忆索引（带缓存） | fetch 失败抛 Error |
| `queryMemory()` | `(query: string, topK?: number) => Promise<MemoryQueryResult[]>` | 关键词检索记忆片段 | 空查询返回空数组 |
| `scanFolder()` | `() => Promise<ScanResult \| null>` | 调用 File System API 扫描目录 | 浏览器不支持返回 `null` |
| `importFilesToDatabase()` | `(scanResult: ScanResult) => Promise<{ imported: number; errors: string[] }>` | 将扫描结果导入 localDocs store | 逐文件错误收集 |
| `searchLocalDocs()` | `(keyword: string) => Promise<DataLayerResult<LocalDoc[]>>` | 按关键词检索本地文档 | try-catch 返回 `error` |
| `runV6Migration()` | `(json: unknown, options?: MigrationOptions) => Promise<DataLayerResult<MigrationReport>>` | V6→V9 全量迁移入口 | parse → validate → transform → import |
| `getSystemMonitorService()` | `() => SystemMonitorService` | 获取监控服务单例 | 惰性创建 |
| `getArchitectureService()` | `() => ArchitectureService` | 获取架构可视化服务单例 | 惰性创建 |
| `getMonitorLogService()` | `() => MonitorLogService` | 获取监控日志服务单例 | 兜底返回临时实例 |

### 2.3 事件接口

| 事件名 | 发布方 | 订阅方 | 说明 |
|--------|--------|--------|------|
| `SYSTEM_MONITOR_SNAPSHOT` | `SystemMonitorService` | `store/`（systemMonitor / agentStore） | 系统综合快照广播（30s 周期） |
| `MONITOR_LOG_ENGINE` | `MonitorLogService` | 监控面板 / engineStore | 引擎状态快照日志事件 |
| `MONITOR_LOG_AGENT` | `MonitorLogService` | 监控面板 / agentStore | Agent 健康状态日志事件 |
| `MONITOR_LOG_SYSTEM` | `MonitorLogService` | 监控面板 / systemMonitorStore | 系统汇总快照日志事件 |
| `ENGINE_STORE_STARTED_CHANGED` | `engineStore`（推测） | `ArchitectureService` | 引擎启停状态变更（ArchitectureService 订阅） |

---

## 3. 数据流

### 3.1 系统统计查询（只读）

```
[dataLayer (stocks / orders / v6Scores)]
    ↓
systemService.loadSystemStats()
    ↓
直接返回 DataLayerResult<SystemStats>（不经 DataBridge）
    ↓
调用方（Store / UI）
```

### 3.2 数据重置/导出（写操作，经 DataBridge）

```
[外部输入：用户触发重置或导出]
    ↓
systemService.resetAll() / exportAll()
    ↓ (EnvelopeFactory.create + DataBridge.forward())
DataBridge → routeToDB() → ACL 校验 → dataLayer / IndexedDB
    ↓
返回 DataLayerResult<void> / DataLayerResult<Record>
```

### 3.3 本地文档导入

```
[用户选择本地目录：File System API]
    ↓
localDocService.scanFolder() → FileEntry[]
    ↓
localDocService.importFilesToDatabase()
    ↓ (dataLayer.localDocs.save)
dataLayer → IndexedDB (localDocs store)
    ↓
返回 { imported, errors }
```

### 3.4 系统监控快照

```
[AgentRuntime / AgentHealthMonitor / EventBus]
    ↓（只读聚合）
SystemMonitorService.getSystemSnapshot()
    ↓ (eventBus.emit)
SYSTEM_MONITOR_SNAPSHOT 事件广播
    ↓
订阅方 Store → components/pages (仅经 Store 取数)
```

### 3.5 V6→V9 迁移

```
[外部输入：V6 导出 JSON]
    ↓
v6MigrationService.runV6Migration()
    ↓（pipeline）
parseV6Export → validateV6ExportTables → transformV6ToV9
    ↓
storeMigrators.migrate*() × 12 stores
    ↓ (dataLayer 直接写入)
IndexedDB（各业务 store）
    ↓
writeMigrationAuditLog()（经 DataBridge 写 researchLogs）
    ↓
返回 MigrationReport
```

---

## 4. 配置与依赖

### 4.1 依赖白名单（lib/）

| 依赖 | 路径 | 用途 |
|------|------|------|
| logger | `@/lib/logger` | 全服务日志输出（含 context 对象） |
| eventBus | `@/lib/eventBus` | 监控事件发布/订阅、架构状态订阅 |

### 4.2 其他关键依赖

| 依赖 | 路径 | 用途 |
|------|------|------|
| dataBridge | `@/core/databridge` | resetAll / exportAll / migration 审计日志的 ACL 路由 |
| EnvelopeFactory | `@/core/envelope` | 构建标准 Envelope |
| dataLayer | `@/data/dataLayer` | 系统统计查询、本地文档 CRUD、迁移写库 |
| db (generateId) | `@/data/db` | 生成本地文档与迁移数据的 ID |

### 4.3 配置项

| 配置名 | 默认值 | 说明 | 来源 |
|--------|--------|------|------|
| `MONITOR_INTERVALS.AGENT_HEALTH` | `15000` (15s) | Agent 状态轮询间隔 | `src/constants/health.constants.ts` |
| `MONITOR_INTERVALS.SYSTEM_SNAPSHOT` | `30000` (30s) | 系统综合快照轮询间隔 | `src/constants/health.constants.ts` |
| `MAX_LOGS` | `500` | 监控日志 FIFO 上限 | `src/services/system/monitorLogService.ts` |
| `MAX_CONTENT_LENGTH` | `50_000` | 本地文档读取最大字符数 | `src/services/system/localDocService.ts` |
| `DEFAULT_CHUNK_SIZE` | `800` | 文档分块大小（字符） | `src/services/system/localDocService.ts` |
| `DEFAULT_CHUNK_OVERLAP` | `100` | 文档分块重叠（字符） | `src/services/system/localDocService.ts` |
| `REPORT_URL` | `/health-report.json` | 架构健康报告地址 | `src/services/system/healthDashboardService.ts` |
| `INDEX_URL` | `/ai-memory-index.json` | AI 记忆索引地址 | `src/services/system/aiMemoryService.ts` |

---

## 5. 测试策略

| 测试类型 | 文件 | 说明 |
|----------|------|------|
| 单元测试 | `src/services/system/systemService.test.ts` | `loadSystemStats` / `resetAll` / `exportAll` 的 mock 测试（含 Envelope 参数校验） |
| 单元测试 | `src/services/system/bootstrapService.test.ts` | `initializeApp` 启动顺序、异常传播、调用次序验证 |
| 集成测试 | `tests/services/system.integration.test.ts` | （模板建议位置）DataBridge 交互、Store 联动、迁移端到端 |
| Mock 策略 | `__mocks__/@/data/dataLayer` | 隔离 IndexedDB 与外部 fetch |

> **TODO[子域 owner]**：当前 `system` 子域缺少 `__tests__/` 目录；建议补充 `SystemMonitorService`、`MonitorLogService`、`ArchitectureService`、`localDocService` 及 migration 管道的单元测试。

---

## 6. 变更日志

| 日期 | 版本 | 变更 | 作者 |
|------|------|------|------|
| 2026-07-12 | v0.1.0 | 契约初稿 | 架构组 |

---

> **TODO[子域 owner]**：
> 1. 确认 `architectureService` 与 `systemMonitorService` 对 `@/agents/` 的依赖是否符合架构预期；如需消除，建议通过 `EventBus` 订阅替代直接导入。
> 2. `bootstrapService.ts` 直接调用 `db.init()` 属于初始化特例，如需严格合规，建议将 db 初始化逻辑下沉至 `data/` 层 bootstrap 钩子。
> 3. 完成后运行 `tsc --noEmit` + `audit:layers` 验证。
