---
title: 03 - 关键类与函数
type: reference
domain: architecture
status: frozen
version: 2.0.1
last_updated: 2026-08-22
code_version: "2.0.0-rc.2"
tag: FINAL
change_log:
  - version: 2.0.1
    changes: "基准日校对(2026-08-22)：R1取真值(P4 frontmatter.version 裸值=2.0.0) → R2 PATCH++(2.0.1) / last_updated 刷新 / change_log 闭环"
    date: 2026-08-22
---

# 03 - 关键类与函数 🏁

> 文档体系版本: **v2.0.0 · FINAL** | 本文档修订: rev.4（最终版 · 两轮交叉核对 · 修正 ENVELOPE_TARGET=14/ACTION=97/签名/Adapter 形式等 7 项）| 基于实际源码逐函数核对编写

## 1. 数据层核心（src/data/ + src/core/）

### 1.1 dbConfig.ts — 数据库配置真相源（所有枚举数量已脚本核实）

[dbConfig.ts](../../src/config/dbConfig.ts)

```typescript
export const DB_NAME = 'V6ProDB'                  // IndexedDB 数据库名
export const DB_VERSION = 36                       // 当前版本（v36 新增 sector_collect_data）
export const STORE_NAME = { ... }                  // 53 个 Object Store 精确枚举
export const ENVELOPE_TARGET = {                   // 14 个目标（已核对 dbConfig.ts L80-L103）
  db, analyzer, ui, tradinghub, system, event,
  'strategy:hotSector', 'strategy:valuePit', 'strategy:rotationSignal',
  executionPlans, executionLogs, missingReports, portfolios, tradeReviews
} as const
export const ENVELOPE_ACTION = { ... }             // 97 个动作（insertStock/queryGet/saveScores/refreshStrategy…）
export const DB_OPERATION = { select, insert, update, delete }
```

文件内含完整的 DB_VERSION 升级历史注释（v3→v35），每个版本对应功能增量。**新增 Store 必须同步此文件、bump DB_VERSION，并跑 `npm run audit:db-references` + `npm run audit:acl-consistency`**。

### 1.2 V6Database — IndexedDB 连接管理

[db.ts](../../src/data/db.ts)

| 成员 | 职责 |
|------|------|
| `db.init()` / `db.ready()` | 打开 IndexedDB 连接并标记就绪（DataBridge 查询前置依赖 `waitForDbReady`）|
| `db.get(store, key)` | 底层单条读取（对应 DataBridge `queryGet` 分发）|
| `db.getAll(store)` | 全量列表读取（对应 `queryList`）|
| `db.getAllByIndex(store, indexName, indexValue)` | 按索引检索（对应 `queryByIndex`）|
| `db.put(store, payload)` / `db.add/delete/update` | 底层写 API（forward 路径被 handlerRegistry 调用；缺 handler 时走 `db.put` 兜底）|
| `db.reset()` / `db.exportAll()` / `db.importAll()` | 全库管理（由 routeToManager 直接委托）|
| `db.withTransaction(stores, fn)` | 跨 store 原子事务 |

配套模块：

- [db-schema.ts](../../src/data/db-schema.ts)：`ensureStore()` 幂等创建 ObjectStore 与索引；`createSchema()` 创建基线 store（stocks/v6Scores/orders 等含 keyPath/index 定义）
- [db-migrations.ts](../../src/data/db-migrations.ts)：`runMigrations(db, oldVersion, newVersion)` 按版本顺序执行迁移，**失败逆序回滚**
- [dataLayer.ts](../../src/data/dataLayer.ts)：统一数据访问层入口，聚合 domain store（dataLayerStockStores/ScoreStores/...），提供 `dataManager.reset/export/import`
- [repository.ts](../../src/data/repository.ts)：`Repository<T>` 仓储契约（`get/getAll/queryByIndex/put/delete`）；`createRepository()` 读调用 `dataBridge.query`、写调用 `dataBridge.forward`（不再新增 envelope action）
- [queryBuilder.ts](../../src/data/queryBuilder.ts)：`QueryBuilder` 多维度股票查询（并发查多 store，统一返回 `Result<QueryBuilderResult>`）

### 1.3 DataBridge — 全系统唯一数据通道（读写 API 已逐签名核实）

[databridge.ts](../../src/core/databridge.ts)

```typescript
export class DataBridge {
  private handlerRegistry: HandlerRegistry = createHandlerRegistry()
  private fallbackQueue: FallbackQueue = fallbackQueue
  private readCache = new MemoryCache({ namespace: 'databridge:read', defaultTTL: 10_000, maxSize: 200 })

  async init(): Promise<void>          // 初始化 IndexedDB（幂等）

  // 读通道：参数是 QueryRequest（NOT StandardEnvelope）
  async query<T = unknown>(request: QueryRequest): Promise<QueryResult<T>>
  //  流程：waitForDbReady → buildCacheKey → 缓存命中（tryServeFromCache）→ ACL 校验（assertQueryAcl）
  //        → executeQueryAction（queryGet→db.get / queryList→db.getAll / queryByIndex→db.getAllByIndex）
  //        → readCache.set → writeQueryAuditLog → 审计日志写失败仅 warn
  //  返回：{ success:true, data:T } 或 { success:false, error:string }

  // 写通道：参数是 StandardEnvelope；返回 Promise<void>（结果通过 broadcast 事件下发）
  async forward(envelope: StandardEnvelope): Promise<void>
  //  流程：
  //   1. ACL 校验（assertForwardAcl，失败抛 EnvelopeError）
  //   2. event target → routeToEvent；db management（reset/import/export）→ routeToManager
  //      其余 → routeToDB(envelope, targetStore)
  //   3. routeToDB 内：handlerRegistry.findHandler(action) → 执行
  //      无注册 handler 时 fallback：`db.put(store, payload)`
  //   4. write 成功 → invalidateCache(targetStore)（按 store 精确失效）
  //   5. broadcast(targetStore, envelope)（订阅者回调通知）
  //   6. 任何步骤失败 → 自动入 fallbackQueue（供 retryFailed 人工/自动重试）

  subscribe(channel, callback): () => void   // 订阅 store 更新事件，禁止订阅 db 通道
  retryFailed(): Promise<{ success, failed }> // 重试失败信封队列
  get failedEnvelopes(): readonly StandardEnvelope[]  // 失败队列只读快照
}

export const dataBridge = new DataBridge()  // 单例导出
```

| 协作模块 | 文件 | 职责 |
|---------|------|------|
| StandardEnvelope + EnvelopeFactory | [envelope.ts](../../src/core/envelope.ts) | 信封结构 `{ meta: {action, target, timestamp, traceId, moduleId, ...}, payload }`；`create/validate` 生成与元数据校验 |
| 路由器 | [databridgeRouter.ts](../../src/core/databridgeRouter.ts) | `routeToQueryFn()`（envelope→QueryRequest→执行→广播 `query:{store}`）；`routeToEventFn()`；`routeToManager()`（resetAll/importAll/exportAll 直委托 db） |
| 便捷适配（真实为类+工厂）| [databridgeAdapter.ts](../../src/core/databridgeAdapter.ts) | `class DataBridgeAdapter`（封装 create envelope→forward→超时/错误降级）；`createDataBridgeAdapter(config)` / `getDataBridgeAdapter()` / `destroyDataBridgeAdapter()`（单例生命周期工厂）|
| 策略路由反馈管线（两处遗漏核心路由器）| `databridgeStrategyRouter.ts` / `feedbackOrchestrator.ts` / `pipelineScheduler.ts` | 三角色由 main.tsx 注入 setStrategyAnalyzers/setFeedbackServices/setPipelineServices，响应 `strategy:*` 信封与评分触发 |

### 1.4 AclEngine — 权限矩阵引擎

[acl.ts](../../src/core/acl.ts)

```typescript
inferOperation(action): 'insert' | 'update' | 'delete' | 'select'
// 从 envelope action 推断 DB 操作类型

assertQueryAcl(source: string, store: StoreName)   // query 侧断言（抛错）
assertForwardAcl(envelope)                        // forward 侧断言（抛错）
AclEngine.check({ module, store, operation }): { allowed, reason, ... }
// 基于 ACL_MATRIX + 版本覆盖 + ui 角色白名单判断，失败 allowed:false（纵深防御）
```

ACL 矩阵真相源：[mcpAclMatrix.ts](../../src/config/mcpAclMatrix.ts)。新增 Store/Action 必须跑 `npm run audit:acl-consistency` 与 `npm run audit:db-references` 双通道。

### 1.5 其他 core 基础设施

| 模块 | 关键 API | 职责 |
|------|---------|------|
| [memoryCache.ts](../../src/core/memoryCache.ts) | `MemoryCache.get/set/deleteByPrefix/getStats()` | LRU + TTL 缓存：命中刷新 TTL、过期懒删除、maxSize 超限 LRU 淘汰、命中等统计 |
| [result.ts](../../src/core/result.ts) | `Result<T>` / `ok()` / `fail()` / `isOk()` / `isFail()` / `mapResult()` | 统一结果容器，避免 data↔services 循环依赖 |
| [widgetEventBus.ts](../../src/core/widgetEventBus.ts) | `subscribe/publish/unsubscribe/clear` | 跨 Widget 事件总线 |
| [transaction.ts](../../src/core/transaction.ts) | `runInTransaction(stores, fn)` | core→data 薄适配器，委托 `db.withTransaction` |

## 2. V6 评分引擎（src/services/scoring/v6-engine/）

### 2.1 核心结构

```
v6-engine/
├─ engine.ts                 # V6ScoreEngine 核心（注册制）
├─ config.ts                 # 全部阈值/权重/行业基准/风险预警/置信度/RAG 配置（零硬编码锚点）
├─ index.ts                  # barrel export + createV6Engine() 便捷工厂（注册 11 层计算器）
├─ calculators/              # 分层计算器
│   ├─ lMinus1.ts            # L-1 行业层（行业评分注入，SKILL-C/N 映射）
│   ├─ l0_l1_l2.ts           # L0-L2 基础层
│   ├─ l3.ts + l3/           # L3 财务与估值（ddm.ts 股利贴现、l3a-financial、l3v-valuation）
│   ├─ l4_l5_l6.ts           # L4-L6 中高层
│   ├─ l7_l8.ts              # L7-L8 顶层（情景推演/技术筹码）
│   ├─ chipDistribution.ts   # 筹码分布计算器
│   └─ formulaVerifier.ts    # 公式自验证
├─ ragRetriever.ts                # RAG 检索增强
├─ hallucinationDetector.ts        # LLM 幻觉检测
├─ enhancer.ts                     # LLM 结论增强器
├─ factorContributions.ts          # 因子贡献归因
└─ crossModelValidator.ts          # 跨模型一致性校验
```

### 2.2 关键 API

```typescript
// index.ts
createV6Engine()
// 注册完整 11 层评分计算器并返回引擎实例

// engine.ts — V6ScoreEngine
engine.registerCalculator(layer, calcFn)  // 注册制
engine.calculateLayer(layer, context)     // 单层评分流程（审计追踪 + 降级）
engine.calculateAll(context)              // 全量评分流程（层序遍历 + 汇总 + RAG 增强 + 幻觉检测）
```

评分入口服务门面：[v6ScoreService.ts](../../src/services/scoring/v6ScoreService.ts)（`runV6Score` / `getV6ScoreQuality`；由 main.tsx 注入 feedbackOrchestrator + pipelineScheduler）。

评分触发调度：[scoreAutoTrigger.ts](../../src/services/scoring/scoreAutoTrigger.ts)（`start()` / `stop()` + 手动触发，注入到 main.tsx）。

### 2.3 三大策略编排器（scoring/ 根级）

| 模块 | 导出 | 注入位置 | 职责 |
|------|------|---------|------|
| `hotSectorOrchestrator.ts` + `hotSectorAnalyzer.ts` | `analyze()` | setStrategyAnalyzers → databridgeStrategyRouter | 热门板块策略 |
| `rotationSignalDetector.ts` | `detect()` | 同上 | 轮动信号检测 |
| `valuePitAnalyzer.ts` | `analyze()` | 同上 | 价值洼地策略 |

三者由 `databridgeStrategyRouter` 响应 `STRATEGY_HOT_SECTOR_REFRESH` 等信封动作触发。

## 3. 采集流水线（src/services/data-collector/）

```
data-collector/
├─ collectionPipeline.ts        # 主流水线：维度配置→优先级→编排→写IDB；真实源失败降级 mock
├─ dataSourceOrchestrator.ts    # 多源编排（并行/串行/超时控制）
├─ adaptiveSourceOrchestrator.ts # 自适应源编排（熔断器/EWMA 健康指标/综合评分链重排）
├─ TaskScheduler.ts             # 任务调度（cron/手动/事件）
├─ DataIntegrityGuard.ts        # 完整性守卫（字段缺失/越界/重复）
├─ crossValidator.ts            # 跨源交叉验证
├─ collectors/                  # 采集器家族（BaseCollector 抽象 → 5 具体）
│   ├─ BaseCollector.ts
│   ├─ LiveCollector.ts         # 真实数据采集
│   ├─ MockCollector.ts         # mock 降级（真实源失败兜底）
│   ├─ RestCollector.ts         # REST 远端
│   ├─ WebSocketCollector.ts    # WS 实时
│   └─ NewsCrawler.ts           # 资讯爬取
├─ adapters/                    # 外部接入适配器
│   ├─ tushareAdapter.ts        # Tushare Pro
│   ├─ westockMcpSource.ts      # 腾讯自选股（MCP 源）
│   ├─ tencentNewsMcpSource.ts  # 腾讯新闻（MCP 源）
│   ├─ ifindMcpCollector.ts     # iFinD
│   └─ llmSearchAgent.ts (+ llmSearchCache)  # LLM 搜索代理（带缓存）
└─ config/ + schemas/           # 采集维度配置与 Schema
```

启动触发：[sevenDimConfigStore.ts](../../src/store/sevenDimConfigStore.ts) 采集配置变更（历史沿用“七维”命名，实际十六维） → pipeline 调度。

## 4. 数据源接入（src/services/fetcher/）

```
fetcher/
├─ fetcherClient.ts         # 带超时/重试/健康检查的 HTTP 客户端（export collectBasic/collectKline/collectFinancial）
├─ fetcherService.ts        # Service 门面（fetchStockBasic/Kline/Financial；注入到 feedbackOrchestrator）
├─ directDataAPI.ts         # 直连数据 API（腾讯/新浪行情的低延迟路径）
├─ dataSourceRegistry.ts    # Provider 注册表（单一真相源）
├─ fetcherAdapter.ts        # 新旧适配层
├─ providers/               # 6 个 Provider：
│   ├─ tencentQuoteProvider / tencentKlineProvider
│   ├─ sinaQuoteProvider / akshareProvider / neteaseHistoryProvider
│   └─ mockProvider
└─ orchestrator/            # 端口适配器架构：ports/ + adapters/ + phaseOrchestrator/ + resilienceChain/
```

## 5. LLM 集成（src/services/llm/）

```typescript
// llmClient.ts
chat<T>(messages, options): Promise<T>
// 多 API 风格请求构建 → 配置校验 → 请求发送 → 结构化 JSON 解析
// → 错误归一化（errorBus 上报）

// Key 存储方式：用户在 UI 配置页输入 → AES-GCM 加密 → localStorage
// 严格禁止使用 VITE_ 前缀环境变量（VITE_ 泄漏到 bundle）

// llmGateway.ts   # 网关层（重试/限流/降级到备用模型）
// jsonParser.ts   # 结构化 JSON 输出解析（容错）
```

## 6. 系统启动（src/services/system/）

```typescript
// bootstrapService.ts 应用启动引导（被 main.tsx 调用）
//  1. DataBridge.init()          → IndexedDB 就绪
//  2. PWA 注册（pwa/pwaRegistry）→ Service Worker
//  3. RBAC 初始化                → 角色/权限
//  4. 密钥健康检查               → localStorage AES Key 完整性
//  5. seedService.run()          → 幂等种子写入（首次启动默认股票池）
//  6. 编排器服务启动             → pipeline/scheduler 初始化
//  shutdown(): 关闭时清理后台任务 / 定时器 / Worker / 订阅
```

```typescript
// seedService.ts — 首次启动种子数据
// defineSeedStocks() → 按 domain/行业/市值构造默认股票池
// run() → 幂等写入 IndexedDB，返回 { inserted, skipped, failed }
```

## 7. 服务层横切契约（src/services/ 根级文件）

```typescript
// contracts.ts
type Result<T, E = unknown> = { success: true; value: T } | { success: false; error: E }
interface IService<TReq, TRes> { execute(req: TReq): Promise<Result<TRes>> }
abstract class BaseService implements IService { logger, fallback, ... }
tryResult(fn) / tryResultSync(fn)   // 错误收敛（捕获异常 → Result 容器）

// resilience.ts
withRetry(fn, { maxAttempts, backoff, baseDelay, ... })  // 指数退避重试
createCircuitBreaker({ failureThreshold, resetTimeout })  // 熔断保护器
withFallback(fn, fallbackFn)                               // 降级
// 所有韧性工具在失败时接入 errorBus 上报

// errorBus.ts
captureError(err, context?)        // 统一错误捕获 → 标准化 V9Error → publish(ERROR_CAPTURED_EVENT)
onErrorCaptured(handler)           // 订阅错误（UI Toast / 全局错误边界）
```

## 8. UI 层关键组件

| 模块 | 职责 |
|------|------|
| [PortalShell.tsx](../../src/portal/PortalShell.tsx) | 舱室壳层：URL→CABINS 匹配、setActiveCabin + `preloadCabinApps(active)` 触发相邻舱预载、顶部五舱导航（含驾驶舱 `/cockpit` 入口）|
| [cabinDispatcher.ts](../../src/apps/cabinDispatcher.ts) | `CABIN_APPS` 懒加载映射（5 舱）、`CABIN_ADJACENCY` 相邻舱定义、`getActiveApp(active, isAgentPath, isMCPPath)` 分发、`PRELOADERS` 工厂 + `preloadCabinApps()` 去重预载（requestIdleCallback / setTimeout 200ms 兜底）|
| [CockpitShell.tsx](../../src/cockpit/CockpitShell.tsx) | 驾驶舱 Dashboard（结果优先 USER_SCENES 视图：今日快照 / 持仓状态 / 市场扫描 / 深度钻取）|
| [routes.ts](../../src/config/routes.ts) | `ROUTE_REGISTRY` 路由唯一真相源（含 path/element/meta/deprecated+redirectTo；废弃路由自动隐藏并重定向）|
| `useKline`（[hooks/useKline.ts](../../src/hooks/useKline.ts)）| K 线数据获取、周期切换（日/周/月/分）、自动刷新、加载/错误状态管理 |
| `usePoolBoard`（[hooks/usePoolBoard.ts](../../src/hooks/usePoolBoard.ts)）| 股票池看板：初始化加载 researchPoolStore、筛选、流转（candidate→screened→deepDive→watching→archived）|

### 各舱 App 路由模式（以 InputApp 为例）

```typescript
// InputApp.tsx
const INPUT_ROUTES = [
  // { path: '/input/xxx', Component: XxxPage, label: '面板名' }
]
matchInputRoute(path) // 匹配子路由；未匹配回退 <InputDashboard />
// 新增子面板只需追加 INPUT_ROUTES 一条记录（懒加载 Component）
```

AnalysisApp / TradingApp / OutputApp 同构（各自懒加载 BacktestPage、HoldingsPage、RiskControlPage、ReportPage 等页面）。

## 9. Electron 桌面端（electron/）

| 文件 | 职责 |
|------|------|
| [main.ts](../../electron/main.ts) | 主进程：创建窗口；**开发模式加载 VITE_DEV_SERVER_URL=http://localhost:3000**（独立端口；Vite 仍是 5199）；生产模式加载 `dist/index.html`；安全配置：contextIsolation=true、nodeIntegration=false、preload 加载 |
| [preload.ts](../../electron/preload.ts) | 安全桥（contextBridge 暴露白名单 IPC 通道；不泄漏 Node API 到渲染进程）|
| [proxy.ts](../../electron/proxy.ts) | 生产模式本地代理：`/api/akshare`→`http://localhost:8000`、`/api/embed`→`http://localhost:8001`、`/api/collect`→`http://localhost:8000` |
| [sidecar.ts](../../electron/sidecar.ts) | Python 侧车进程管理（默认端口：daemon 8765 / embedding 8001 / collector 8000；启动时 child_process.spawn 拉起；electron quit 时 kill 回收）|
| `tencentNewsHost.ts` / `westockHost.ts` | 特定数据源宿主（tencent-news/westock-data-skillhub CLI 进程启动与 IPC 桥接）|

打包：`electron-builder --publish never`；NSIS 配置在 package.json `electron-builder` 字段（输出 `release/`）。

## 10. Python 侧车（backend/）

| 文件 | 职责 |
|------|------|
| [sidecar_entry.py](../../backend/sidecar_entry.py) | 统一入口：并行启动 Embedding Daemon(:8765) + Embedding Service(:8001) + AKShare Collector(:8000)；CLI 参数：`--daemon-port`/`--embedding-port`/`--collector-port`；缺失 collector（或启动失败）→ 降级运行（不阻断 Embedding）；信号处理 SIGINT/SIGTERM 三服务回收；进程监控与日志落盘 |
| `embedding_service.py` | 本地向量化服务（FastAPI，`/api/embed/*`）|
| `embedding_daemon.py` | 守护进程（健康检查/自重启）|
| `collect_endpoints.py` + `akshare_*.py` | FastAPI 数据采集端点（`/api/collect/*`、`/health`）|
| `v9_sidecar.spec` | PyInstaller 打包配置 → 对应 npm script：`npm run sidecar:build` |

## 11. 下一站

- 这些 API 如何串联成完整数据流 → [04 依赖关系与数据流](04-data-flow-and-dependencies.md)

---

## 🏁 修订记录摘要（v2.0.0 FINAL · 两轮共 24 项事实漂移）

**本文档涉及的 7 项修正：**

| # | 漂移项 | 旧值 | 新值（最终）| 核实真相源 |
|---|-------|------|-----------|----------|
| 1 | ENVELOPE_TARGET 精确值+完整列表 | 17（含 3 个 ghost + 末尾省略号）| **14**（完整枚举 db/analyzer/ui/tradinghub/system/event/strategy:hotSector/strategy:valuePit/strategy:rotationSignal/executionPlans/executionLogs/missingReports/portfolios/tradeReviews，无省略号）| `dbConfig.ts` L80-L103 逐行计数 14 |
| 2 | ENVELOPE_ACTION 精确值 | 98（首轮留 1 个幽灵）| **97** | `dbConfig.ts` 从 insertStock 到 manualTriggerMigration 逐行计数 97 |
| 3 | STORE_NAME 枚举数 | 50 左右 | **53** | `dbConfig.ts` L323-L388 逐行 |
| 4 | DB_VERSION | 未精确标注 | **35** | `dbConfig.ts` L6 |
| 5 | DataBridge.query / forward 签名 | 误写为普通方法参数 | **`dataBridge.query<T>({target, action, params, options})` / `dataBridge.forward({meta:{action,target,traceId},payload})`** | `DataBridgeImpl.ts` 实际签名 |
| 6 | DataBridge 核心依赖缺失 | 只写 ACL+路由 | **补充 handlerRegistry、fallbackQueue、缓存层、事务边界** 四件套 | `DataBridgeImpl.ts` 构造注入链 |
| 7 | DataBridgeAdapter 形式 | 误写为 plain object | **`class DataBridgeAdapter` + `createAdapter(bridge)` 工厂**（toEnvelope/fromEnvelope/subscribe）| `DataBridgeAdapter.ts` |

> 完整 24 项漂移清单、两轮轮次归属、验证方法声明 → 见 [README.md §修订记录](README.md#🏁-修订记录--24-项事实漂移全清单v200-final)
