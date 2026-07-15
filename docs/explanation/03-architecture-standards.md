---
title: 03-architecture-standards
tier: important
code_version: 2.0.0
---

---
title: docs/explanation/03-architecture-standards.md
code_version: 2.0.0
---

---
title: docs/explanation/03-architecture-standards.md
code_version: 2.0.0
tier: important
---

# 03. 架构标准

> **Status**: Current  
> **Version**: v2.7.0  
> **Last Updated**: 2026-07-15
>
> 本文档是 V9 系统架构的唯一真相源，定义五层架构、调用规则、数据架构、技术选型理由与当前代码偏差。  
> 目标读者：前端/全栈开发者、架构师、新加入成员。  
> 与规划基线的差异见 `docs/explanation/architecture-version-comparison.md`。

---

## 3.1 五层架构

```
┌─────────────────────────────────────────────────────────────────────────┐
│  L5 展示层：pages/, components/                                          │
│  页面、通用组件、UI 渲染                                                 │
├─────────────────────────────────────────────────────────────────────────┤
│  L4 应用层：apps/, cockpit/                                              │
│  五舱应用、驾驶舱、业务编排                                              │
├─────────────────────────────────────────────────────────────────────────┤
│  L3 引擎层：services/, agents/（trading/ 待建）                           │
│  分析引擎、交易引擎、业务服务                                            │
├─────────────────────────────────────────────────────────────────────────┤
│  L2 数据层：data/, db/                                                   │
│  IndexedDB 封装、统一数据接口、schema、迁移                              │
├─────────────────────────────────────────────────────────────────────────┤
│  L1 基础设施层：lib/, config/, core/                                     │
│  事件总线、DataBridge、配置、主题、工具                                  │
└─────────────────────────────────────────────────────────────────────────┘
```

### 3.1.1 目录与代码实际映射

| 层级 | 规划目录 | 当前实际目录 | 状态 |
|------|----------|--------------|------|
| L5 展示层 | `pages/`, `components/` | ✅ `pages/`, `components/`, `portal/`, `cockpit/`（含 21 个 Widget 组件） | 基本对齐 |
| L4 应用层 | `apps/`, `cockpit/` | ✅ `apps/`, `cockpit/`（含 CockpitShell + Widget 引擎 + Widget 注册表）；输入舱已拆分为 Dashboard / BulkImport / HotSector / DataTest 四个子页面 | 对齐 |
| L3 引擎层 | `agents/`, `trading/`, `services/` | ✅ `services/`；交易引擎已下沉至 `src/services/trading/`（含 positionComputer/pnlComputer/riskComputer 纯函数模块）；UseCase 层位于 `src/services/useCase/`（含 11 个 UseCase 文件：createExecutionPlan/executePlan/fetchSectorAnalysis/fetcherOrchestrator/generateTradeReview/getUnifiedStockView/hotSectorQuery/rebalancePortfolio/runDualStrategy/strategySnapshotSave/submitOrder）；采集引擎位于 `src/services/fetcher/` 和 `src/services/data-collector/`；新闻服务位于 `src/services/news/`（newsService + sentimentAnalyzer + stockLinker）；🟡 `src/agents/agentRuntime.ts` 已存在，注册表/任务队列/健康监控待完善；✅ `src/core/dataflow/` 已实现，数据融合层（UnifiedStockData）已实现 | 部分对齐，见偏差清单 |
| L2 数据层 | `data/`, `db/` | ✅ `src/data/`（含 `db.ts`, `dataLayer.ts`, `types.ts`）；`daily_quotes`、`signals`、`research_logs` store 已落地 | 对齐 |
| L1 基础设施层 | `lib/`, `config/`, `core/` | ✅ `src/lib/`, `src/config/`, `src/core/`；🟡 `eventBus` 本身仍为基础 `on/emit/off`，高级缓存/定时/优先级由 `src/core/dataflow/dataflowEngine.ts` 承载 | 部分对齐 |

#### 交易引擎 TradePair 类型体系统一说明（v2.5.0 新增）

交易计算纯函数模块（`positionComputer.ts`）建立了统一的 TradePair 类型层次：

| 类型 | 定义位置 | 用途 | 关键字段 |
|------|----------|------|---------|
| `TradePair` | `tradeReviewAI.types.ts` | 规范交易对基础类型（跨模块共享） | 基础配对字段 |
| `MatchedTradePair` | `positionComputer.ts` | FIFO 配对后的单笔交易对明细，**extends TradePair** | `buyDate`, `sellDate`, `quantity`, `realizedAmount` |
| `SymbolTradePair` | `positionComputer.ts` | 按 symbol 聚合的交易对与持仓信息 | `symbol`, `buyOrders`, `sellOrders`, `pairs: MatchedTradePair[]`, `avgCostPrice`, `openPositions` |
| `PositionItem` | `positionComputer.ts` | 当前未平仓持仓项 | `symbol`, `quantity`, `avgCost`, `costValue`, `direction` |

> **设计决策**：`TradePair` 作为规范类型定义在 `tradeReviewAI.types.ts`，`MatchedTradePair` 通过 `extends TradePair` 扩展持仓计算特有字段。`positionComputer.ts` 重新导出 `TradePair` 类型，消费方可从该模块直接导入。

### 3.1.2 数据流引擎（DataFlow Engine）设计

数据流引擎是数据感知层的核心组件，负责管理数据通道的订阅、缓存、定时刷新与优先级分发。

**设计目标**：
- **实时推送**：支持 SSE 推送 + 轮询回退
- **内存缓存**：10 秒 TTL、最大 200 条目、按优先级分发；当前实现已支持通道 `priority` 字段，但 TTL/容量上限/按优先级排序分发尚未完全落地，标记为 🟡 待完善
- **通道元数据**：支持 `refreshInterval`、`priority`、`persist` 配置
- **慢订阅者检测**：microtask 异步分发，超 16ms 警告
- **序列号追踪**：检测数据丢失，保证数据完整性

**目录结构**：
```
src/core/dataflow/
├── dataflowEngine.ts      # 数据流引擎核心
├── dataflowTypes.ts       # 类型定义
└── defaultDataBuilder.ts  # 默认数据构建器
```

**通道配置示例**：
```ts
interface DataChannel {
  id: string;
  refreshInterval: number;     // 刷新间隔（ms）
  priority: 'high' | 'medium' | 'low';
  persist: boolean;            // 是否持久化到 DB
  maxCacheSize: number;        // 最大缓存条目数
  ttl: number;                 // 缓存过期时间（ms）
}
```

**当前状态**：🟡 部分实现。`src/core/dataflow/dataflowEngine.ts` 已提供 SSE/轮询、内存缓存、定时刷新、慢订阅者检测；通道配置包含 `priority` 字段，但 TTL、容量上限与按优先级排序分发尚未完全落地，详细规格文档待补充。

**数据流引擎接口定义**（`src/types/modules/dataflow.types.ts`）：

| 接口 | 用途 | 核心字段 |
|------|------|---------|
| `DataFlowModuleInput` | 数据流模块输入 | `channel`（string, ✅）, `callback`（(packet: DataPacket) => void, ✅）, `options.intervalMs`（number）, `options.persist`（boolean） |
| `DataFlowModuleOutput` | 数据流模块输出 | `unsubscribe`（() => void, ✅）, `stats.connected`（boolean）, `stats.channels`（number）, `stats.subscribers`（number）, `stats.cacheEntries`（number） |
| `DataPacket` | 数据包 | `channel`（string, ✅）, `data`（unknown, ✅）, `timestamp`（number, ✅）, `seq`（number, ✅） |
| `ChannelMeta` | 通道元数据 | `channel`（string, ✅）, `description`（string, ✅）, `refreshInterval`（number, ✅）, `persist`（boolean, ✅）, `priority`（'high' \| 'normal' \| 'low', ✅） |

> **变更**: 2026-06-26 | v1.1.0 | 补充 DataFlow 数据流引擎接口定义 | 架构资产治理官

### 3.1.3 数据融合层（Data Fusion）设计

数据融合层负责将多源数据（基础数据、K线、财务、评分、信号）融合为统一的数据视图。

**设计目标**：
- **统一数据模型**：`UnifiedStockData` 聚合所有维度数据
- **数据质量感知**：融合时检查各数据源完整性
- **版本一致性**：保证融合数据的版本对齐
- **延迟加载**：按需加载非核心数据维度

**目录结构**：
```
src/services/analysis/
├── unifiedStockService.ts    # 统一数据视图服务
├── dataFusionEngine.ts       # 数据融合引擎
└── unifiedStockTypes.ts      # 统一数据类型定义
```

**UnifiedStockData Schema**：
```ts
interface UnifiedStockData {
  symbol: string;
  basic: StockBasic;
  kline: DailyQuotes | null;
  finance: StockFinance | null;
  v6Score: V6Score | null;
  intelligentScore: IntelligentScore | null;
  signals: TradingSignal[];
  dataQuality: StockDataQuality;
  lastFusedAt: number;
}
```

**当前状态**：✅ 已实现。`UnifiedStockData` 类型已定义于 `src/data/types.ts:665`，`unifiedStockService.ts` 服务已实现，提供统一数据视图。

### 3.1.4 驾驶舱 Widget 架构设计

驾驶舱由可配置的 Widget 网格组成，支持用户自定义布局与内容。

**设计目标**：
- **可插拔架构**：Widget 注册表 + 懒加载引擎
- **生命周期管理**：mount/unmount/update 完整生命周期
- **跨 Widget 联动**：`WidgetEventBus` 支持跨 Widget 数据通信
- **响应式布局**：12列响应式网格，支持编辑模式

**目录结构**：
```
src/cockpit/
├── CockpitShell.tsx              # 驾驶舱外壳（react-grid-layout 动态网格）
├── core/
│   ├── widgetRegistry.ts         # Widget 注册表（模板注册 + 实例管理 + 运行时状态）
│   ├── widgetEngine.ts           # Widget 运行时引擎
│   └── widgetEventBus.ts         # Widget 跨组件事件总线
└── widgets/
    ├── MarketIndicesWidget.tsx    # 大盘指数实时数据
    ├── SectorHeatmapWidget.tsx    # 板块涨跌幅热力图
    ├── FundFlowWidget.tsx         # 资金流向数据
    ├── MarketSentimentWidget.tsx  # 市场情绪指标
    ├── WatchlistWidget.tsx        # 自选股列表
    ├── PortfolioOverviewWidget.tsx # 持仓概览
    ├── AITradeReviewWidget.tsx    # AI 交易复盘分析
    ├── InvestmentProfileWidget.tsx # 投资画像/分析中心
    ├── StockPoolWidget.tsx        # 股票池管理与监控列表
    ├── KaiScoreWidget.tsx         # KAI 选股综合评分图谱
    ├── ModelCompareWidget.tsx     # AI 大模型智能对比
    ├── StockChatWidget.tsx        # 个股/市场深度分析聊天
    ├── AgentPerformance.tsx       # Agent 执行统计与成功率
    ├── EngineStatus.tsx           # 引擎运行状态监控
    ├── SystemArchitecture.tsx     # 系统架构拓扑图
    ├── PnlAnalysis.tsx            # 盈亏分析面板
    ├── PositionControl.tsx        # 仓位控制与风控
    ├── RiskMonitor.tsx            # 风险指标实时监控
    └── SignalMonitor.tsx          # 交易信号监控面板
```

**Widget 定义规范**：
```ts
interface WidgetDefinition {
  id: string;
  name: string;
  category: 'market' | 'portfolio' | 'strategy' | 'agent';
  icon: string;
  defaultSize: { cols: number; rows: number };
  defaultPosition: { x: number; y: number };
  component: React.ComponentType<WidgetProps>;
  dataChannels: string[];      // 订阅的数据通道
  dependencies: string[];      // 依赖的 Widget
}
```

**当前状态**：✅ 已实现。`CockpitShell.tsx` 已接入 Widget 引擎的动态网格布局；`src/cockpit/core/widgetEngine.ts` / `widgetRegistry.ts` 已实现完整 Widget 运行时，并被 CockpitShell 调用。

### 3.1.4.1 Widget 数据采集流

每个 Widget 通过 `DataSourceConfig` 声明数据需求，由 `TaskScheduler` 统一调度采集任务：

```
DataSourceConfig ──→ TaskScheduler ──→ BaseCollector（Mock/Rest/WebSocket）
                                            │
                                            ▼
                                      RawMarketData
                                            │
                                            ▼
                                   MarketDataAdapter
                                            │
                                            ▼
                                       MarketData
                                            │
                                            ▼
                              MarketDataProvider（React Context）
                                            │
                                    ┌───────┴───────┐
                                    ▼               ▼
                              Widget A          Widget B
```

**采集器三层架构**：
- **BaseCollector**：超时控制、错误捕获、重试机制（3 次重试 / 10s 超时）
- **TaskScheduler**：任务注册/启动/停止、错误状态管理、自动轮询与清理
- **MarketDataAdapter**：统一不同来源的原始数据 → `MarketData` 接口

**当前状态**：✅ 已实现。`src/services/data-collector/` 下三层架构完整，`src/cockpit/core/widgetRegistry.ts` 已注册 21 个默认 Widget（含 7 个系统监控类 Widget），`CockpitShell` 已接入 Widget 引擎并包裹 `WidgetErrorBoundary`。

### 3.1.5 Agent 层设计

Agent 层负责多 Agent 协同、任务调度、健康监控与 AI 助手功能。

**设计目标**：
- **Agent 运行时**：注册/调度/健康/任务队列/A2A协议
- **监控面板**：Agent 状态、任务队列、日志流
- **AI 助手**：对话界面 + 本地知识库

**目录结构**：
```
src/agents/
├── agentRuntime.ts           # Agent 运行时
├── agentRegistry.ts          # Agent 注册表
├── taskQueue.ts              # 任务队列
├── healthMonitor.ts          # 健康监控
└── aiAssistant/              # AI 助手
    ├── chatService.ts        # 对话服务
    ├── localKnowledge.ts     # 本地知识库
    └── skillRouter.ts        # 技能路由
```

**当前状态**：🟡 基础实现已存在。`src/agents/agentRuntime.ts` 已实现 Agent 注册、调度、任务队列、超时机制；注册表/健康监控/AI 助手待完善。

### 3.1.5.1 Agent 运行时接口定义

**来源**: `src/types/modules/agent.types.ts`

| 接口 | 用途 | 核心字段 |
|------|------|---------|
| `AgentModuleInput` | Agent 任务输入 | `agentId`, `type`, `payload`, `options.timeout`, `options.priority` |
| `AgentModuleOutput` | Agent 任务输出 | `taskId`, `status`（pending/running/completed/failed/timeout）, `result`, `error`, `executionTimeMs` |
| `AgentDefinition` | Agent 定义 | `id`, `name`, `description`, `type`, `version`, `capabilities[]`, `metadata.tags`, `metadata.config` |
| `AgentInstance` | Agent 运行实例 | `instanceId`, `agentId`, `name`, `status`（idle/running/completed/failed/stopped）, `startTime`, `lastHeartbeat`, `stats.{totalTasks,successTasks,failedTasks,avgExecutionTime}` |
| `IOModule` | 输入输出组合 | `input: AgentModuleInput`, `output: AgentModuleOutput` |

**任务状态流转**：
```
pending → running → completed / failed / timeout
```

**实例状态流转**：
```
idle → running → completed / failed / stopped
```

### 3.1.6 Engine 层设计

Engine 层提供 DataFlow 引擎、Agent 运行时引擎的综合统计与生命周期管理。

**设计目标**：
- **DataFlow 引擎**：SSE/轮询/缓存/定时/优先级管理
- **Agent 运行时引擎**：任务调度、超时控制、健康检查
- **统计聚合**：跨引擎统计快照、健康告警

**核心接口定义**（`src/types/modules/engine.types.ts`）：

| 接口 | 用途 | 核心字段 |
|------|------|---------|
| `EngineConfig` | Engine 启动配置 | `enableSSE`, `sseUrl`, `enableAgentHealthCheck`, `agentHealthCheckInterval` |
| `DataflowStats` | DataFlow 引擎统计快照 | `channels`, `subscriberChannels`, `connected` |
| `AgentRuntimeStats` | Agent 运行时统计快照 | `totalAgents`, `runningTasks`, `completedTasks`, `failedTasks` |
| `EngineStats` | Engine 综合统计 | `dataflow: DataflowStats`, `agents: AgentRuntimeStats` |
| `EngineLifecycleEvent` | 引擎生命周期事件载荷 | `timestamp` |
| `EngineHealthAlertEvent` | 引擎健康告警事件载荷 | `stats: AgentRuntimeStats` |

**当前状态**：🟡 接口定义已存在。`src/core/dataflow/` 已实现 DataFlow 引擎基础，Agent 运行时引擎统计聚合待完善。

### 3.1.7 Page 生命周期

页面生命周期模块提供数据加载、状态管理、交互守卫能力，确保页面组件在路由切换时正确管理数据与状态。

**设计目标**：
- **数据源管理**：声明式数据源注册，按需加载
- **状态标准化**：统一的 loading/error/visible/clickable 状态模型
- **路由守卫**：页面进入/离开时校验权限与状态

**核心接口定义**（`src/types/modules/page.types.ts`）：

| 接口 | 用途 | 核心字段 |
|------|------|---------|
| `PageModuleInput` | 页面模块输入 | `routeParams`（Record\<string, string\>, ✅）, `dataSources`（Array\<{key: string, fetcher: () => Promise\<unknown\>}\>, ✅） |
| `PageModuleOutput` | 页面模块输出 | `data`（Map\<string, unknown\>, ✅）, `loading`（boolean, ✅）, `error`（string \| null, ✅）, `isVisible`（boolean, ✅）, `isClickable`（boolean, ✅） |
| `PageGuard` | 页面守卫 | `isVisible`（boolean, ✅）, `isClickable`（boolean, ✅）, `tooltipText`（string, ✅） |

> **变更**: 2026-06-26 | v1.1.0 | 新增 Page 生命周期接口定义 | 架构资产治理官

### 3.1.8 三层模块注册体系（v2.3.0 新增，v2.5.0 调整）

V9 通过三层注册表实现 Store、Component、Widget 的集中化管理，解决模块"创建后遗忘"导致的死代码与集成遗漏问题。

> **v2.5.0 变更**：`src/services/contracts.ts` 已删除（agent 残留孤立文件），原四层注册体系调整为三层。Service 层模块通过 `../reference/registry-index.md` 和代码目录结构管理。

**注册体系架构**：

```
┌────────────────────────────────────────────────────────────────────┐
│  Widget Registry（Class 单例，运行时懒加载）                          │
│  widgetRegistry.ts → 21 个 Widget 模板 + 默认布局                   │
├────────────────────────────────────────────────────────────────────┤
│  Store Registry（已删除，待重建）                                    │
│  原 storeRegistry.ts 因数据损坏已移除，47 个 Store 直接导出          │
├────────────────────────────────────────────────────────────────────┤
│  Component Registry（静态常量清单，10+ 条目）                        │
│  componentRegistry.ts → 建议集成目标标注                            │
└────────────────────────────────────────────────────────────────────┘
```

**注册表文件位置与设计决策**：

| 注册表 | 文件路径 | 设计模式 | 条目数 | 理由 |
|--------|----------|----------|--------|------|
| Widget | `src/cockpit/core/widgetRegistry.ts` | Class 单例 | 19 | 需要运行时懒加载（`() => import(...)`）和动态布局管理 |
| Store | ~~`src/store/derived.index.ts`~~ | 已删除，待重建 | 47 | 原文件因数据损坏移除，当前 47 个 Store 各自独立导出 |
| Component | `src/components/componentRegistry.ts` | 静态常量数组 | 10+ | 标注 `suggestedTarget` 引导集成 |

**状态流转规范**：

```
available → active（被页面/组件集成后）
active → deprecated（功能下线时）
deprecated → 删除（下个次要版本）
```

**依赖规则**：
- 注册表文件位于各自层级目录内，遵循既有分层规则
- ~~`storeRegistry.ts`~~ 已删除（数据损坏），待重建。当前 47 个 Store 通过 `src/store/` 目录各自独立导出
- `componentRegistry.ts` 位于 `src/components/`，仅记录组件路径与建议集成目标

**当前状态**：⚠️ 部分实现。Widget Registry 和 Component Registry 正常运行；Store Registry 已删除待重建，47 个 Store 各自独立导出。

> **变更**: 2026-07-05 | v2.5.0 | Service Registry 删除，四层调整为三层 | 架构资产治理官
> **变更**: 2026-07-05 | v2.3.0 | 新增四层模块注册体系架构说明 | 架构资产治理官

### 3.1.9 Hybrid Proofread 混合校对模块（v2.6.0 新增）

混合校对模块负责代码安全与合规性检查，通过本地规则引擎与云端风险数据库的协同，实现全面的项目安全扫描。

**设计目标**：
- **本地规则引擎**：基于正则匹配的安全规则检查（硬编码密钥、不安全依赖、敏感文件等）
- **云端风险验证**：文件哈希比对云端风险数据库，识别已知漏洞
- **报告生成**：结构化安全报告，支持多格式导出（Markdown/HTML/JSON）
- **详细日志**：全链路日志记录与耗时统计，便于问题排查

**目录结构**：
```
src/services/hybrid-proofread/
├── index.ts                  # 主入口，runFullProofread 完整流程
├── hashService.ts            # 哈希计算服务（SHA-256）
├── localCollector.ts         # 本地文件扫描与收集
├── ruleEngine.ts             # 规则引擎（规则加载/同步/评估）
├── cloudSyncClient.ts        # 云端风险同步客户端
└── reportGenerator.ts        # 报告生成器（多格式导出）
```

**配置层**：`src/config/hybridProofreadConfig.ts`
- API 端点配置（哈希验证、风险详情、规则版本、规则下载）
- 哈希算法配置（SHA-256，批处理大小 50）
- 规则同步配置（默认版本、同步间隔、缓存策略）
- 扫描配置（排除/包含模式、并发数、超时时间）

**状态层**：`src/store/hybridProofreadStore.ts`
- 扫描状态管理（isScanning、scanStatus、scanProgress）
- 报告数据存储（report、localScan、cloudRisk）
- 规则信息管理（rules、rulesVersion）

**类型层**：`src/data/types/types.hybridProofread.ts`（17 个接口）

| 接口 | 用途 | 核心字段 |
|------|------|---------|
| `FileHash` | 文件哈希信息 | `file_hash`, `file_type`, `file_path`, `project_id`, `last_modified`, `size_bytes` |
| `RuleConfig` | 规则配置 | `rule_id`, `name`, `description`, `severity`, `pattern`, `category`, `action_type` |
| `RuleMatchResult` | 规则匹配结果 | `rule_id`, `rule_name`, `severity`, `category`, `file_path`, `line_number`, `match_text` |
| `LocalScanResult` | 本地扫描结果 | `project_id`, `scan_time`, `total_files`, `scanned_files`, `rule_matches`, `hashes` |
| `CloudRiskResult` | 云端风险结果 | `project_id`, `checked_at`, `hash_count`, `risky_count`, `risks` |
| `ProofreadReport` | 校对报告 | `id`, `project_id`, `project_name`, `scan_time`, `overall_risk_level`, `total_issues`, `local_scan`, `cloud_risk`, `summary`, `recommendations` |
| `RiskDetail` | 风险详情 | `hash`, `cve_id`, `description`, `remediation_advice`, `severity` |
| `RulesSyncResult` | 规则同步结果 | `current_version`, `latest_version`, `updated`, `downloaded_rules`, `skipped_rules` |

**核心流程**：
```
runFullProofread(projectId, projectName, projectPath)
  ├── Step 1: 同步规则（云端版本检查 + 规则下载）
  ├── Step 2: 本地扫描（文件遍历 + 哈希计算）
  ├── Step 3: 规则评估（正则匹配 + 严重级别统计）
  ├── Step 4: 云端风险检查（哈希批量验证 + 风险详情获取）
  └── Step 5: 生成报告（结构化输出 + 多格式导出）
```

**当前状态**：✅ 已实现。所有核心模块已完成，包含详细日志记录与耗时统计，测试脚本覆盖 9 个测试用例。

> **变更**: 2026-07-08 | v2.6.0 | 新增 Hybrid Proofread 模块架构说明 | 架构资产治理官

### 3.1.10 Store 派生计算与事件订阅（v2.6.0 新增）

#### 3.1.10.1 派生计算模式

派生计算（Derived Computations）是基于 Store 原始状态计算得出的派生状态或查询结果。它们是纯函数，不修改状态，只读取状态并返回计算结果。

**设计原则**：
1. **纯函数**：通过 `useStore.getState()` 访问状态，不修改状态
2. **性能优化**：使用 `memoizeByRef` 缓存无参数派生，`buildIndex` 优化 O(n) 查找
3. **空状态安全**：所有派生在空数据时返回合理默认值
4. **不引入循环依赖**：仅依赖对应 Store 和 `lib/derivedCache`

**缓存策略**：
- `memoizeByRef`：基于输入引用的记忆化（适用于 Zustand 状态数组）
- `memoizeByKey`：基于参数 hash 的记忆化（适用于带参数派生）
- `buildIndex`：列表转 Map 索引（O(1) 查找替代 O(n) filter）

**导出模式**：每个 .derived.ts 文件导出：
- 纯函数形式的派生查询
- React Hook 形式的派生订阅（自动响应状态变化）

**派生计算文件清单**：

| 文件 | 关联 Store | 函数数量 | 核心功能 |
|------|-----------|---------|---------|
| `analysisStore.derived.ts` | analysisStore | 22 | 评分等级分布、趋势分析、按字段查找 |
| `chatStore.derived.ts` | chatStore | 23 | 消息统计、上下文管理、Token 估算 |
| `riskStore.derived.ts` | riskStore | 22 | 风控裁决、熔断状态、趋势分析 |
| `signalQualityStore.derived.ts` | signalQualityStore | 30 | 信号质量分级、盈亏分析、方向统计 |

**当前状态**：✅ 已实现。所有派生计算文件均包含完整 JSDoc 注释。

#### 3.1.10.2 事件订阅模式

`executionStoreSubscriptions.ts` 负责订阅 DataBridge 上的 signals 和 orders 事件，实现执行计划的自动化更新。

**事件驱动架构**：
- **信号生成模块** → `insertSignal` 事件 → 自动创建执行计划
- **订单执行模块** → `insertOrder`/`updateOrder` 事件 → 防抖刷新执行计划
- **执行计划模块** → `saveExecutionPlan`/`updateExecutionPhase` 事件 → 防抖刷新执行计划

**核心设计原则**：
1. **自循环保护**：通过 source 检查避免处理自身发出的事件
2. **防抖机制**：100ms 防抖避免频繁刷新导致性能问题
3. **幂等初始化**：多次调用 init 只初始化一次
4. **完整清理**：销毁时清除订阅和定时器

**当前状态**：✅ 已实现。包含完整 JSDoc 注释。

#### 3.1.10.3 基础设施模块

| 模块 | 文件 | 职责 |
|------|------|------|
| 派生缓存工具 | `src/lib/derivedCache.ts` | 派生查询记忆化缓存、性能优化、VERBOSE 日志埋点 |
| 本地存储加密 | `src/lib/localStorageCrypto.ts` | AES-GCM 256 加密、CryptoKey 派生、安全策略 STOR-001 |
| 错误总线 | `src/services/errorBus.ts` | 统一错误捕获、V9Error 收敛、全局错误总线 |
| 韧性工具 | `src/services/resilience.ts` | 指数退避重试、熔断保护器、失败降级、一站式封装 |

#### 3.1.10.4 UI 组件与 Hooks

| 模块 | 文件 | 职责 |
|------|------|------|
| 全局错误处理 | `src/components/organisms/shared/installGlobalErrorHandler.ts` | window.error 事件、unhandledrejection 事件、错误总线集成 |
| 页面容器 | `src/components/templates/PageContainer.tsx` | 页面统一容器（1200px 宽度、居中策略） |
| 页面页头 | `src/components/templates/PageHeader.tsx` | 页面统一页头（标题 + 描述 + 操作区） |
| 确认对话框 | `src/hooks/useConfirmDialog.tsx` | 命令式确认对话框，替代 window.confirm |

#### 3.1.10.5 常量模块

| 模块 | 文件 | 职责 |
|------|------|------|
| 板块常量 | `src/constants/sectorConstants.ts` | 热门赛道标签（15 条）、板块分类、热力等级 |

> **变更**: 2026-07-08 | v2.6.0 | 新增 Store 派生计算与事件订阅架构说明 | 架构资产治理官

### 3.1.11 其他服务与 Store 模块索引（v2.7.0 补齐）

为保证 audit:docs 代码-文档同步审计通过，以下模块在本版本中补充架构说明。这些模块支撑数据同步、文件导入、LLM 管理、预测与搜索等能力。

#### 数据同步服务（`src/services/data-sync/`）

| 文件 | 职责 |
|------|------|
| `src/services/data-sync/globalScheduler.ts` | 全局采集调度引擎，支持 cron-like 定时执行、交易时段感知、连续失败熔断 |
| `src/services/data-sync/conflictResolver.ts` | 数据冲突检测与解决策略 |
| `src/services/data-sync/fieldMerger.ts` | 多源字段合并与优先级处理 |
| `src/services/data-sync/stalenessDetector.ts` | 数据新鲜度检测与过期判定 |
| `src/services/data-sync/updateExecutor.ts` | 同步更新任务的实际执行器 |

#### 数据同步搜索服务（`src/services/data-sync-search/`）

| 文件 | 职责 |
|------|------|
| `src/services/data-sync-search/codeSearcher.ts` | 代码片段检索 |
| `src/services/data-sync-search/docSearcher.ts` | 文档内容检索 |
| `src/services/data-sync-search/historySearcher.ts` | 历史记录检索 |
| `src/services/data-sync-search/semanticSearcher.ts` | 轻量语义搜索器，基于 TF-IDF + 余弦相似度 |

#### 文件导入服务（`src/services/file-import/`）

| 文件 | 职责 |
|------|------|
| `src/services/file-import/parserRegistry.ts` | 文件解析器注册表，按扩展名分发解析器 |
| `src/services/file-import/unifiedFileValidator.ts` | 统一文件校验入口 |
| `src/services/file-import/diffAnalyzer.ts` | 导入数据差异分析 |
| `src/services/file-import/hashComparator.ts` | 文件哈希比对与去重 |
| `src/services/file-import/proofreadReportGenerator.ts` | 导入校对报告生成 |

#### LLM 管理页面

| 文件 | 职责 |
|------|------|
| `src/pages/command/agent/LlmManagement/index.tsx` | LLM 模型、API Key、因子控制、使用统计的管理页面容器 |

#### 采集任务页面

| 文件 | 职责 |
|------|------|
| `src/pages/input/CollectTask/index.tsx` | 数据采集任务管理页面，负责任务创建、调度与监控 |

#### 其他 Store

| 文件 | 职责 |
|------|------|
| `src/store/predictionStore.ts` | 因子预测记录、校验、周期复盘状态管理 |
| `src/store/analysisOrchestratorStore.ts` | 分析编排状态管理 |
| `src/store/dataSyncStore.ts` | 数据同步任务状态管理 |
| `src/store/fileImportStore.ts` | 文件导入流程状态管理 |
| `src/store/searchStore.ts` | 全局搜索状态管理 |

> **变更**: 2026-07-15 | v2.7.0 | 补齐 data-sync、data-sync-search、file-import、LlmManagement、predictionStore 等模块说明 | AI Agent

---

## 3.2 调用方向铁律

1. **只允许上层调用下层**，禁止反向依赖。
2. **L5/L4 禁止直接调用 `dataLayer`**，必须通过 `DataBridge` / Service / `eventBus`。
3. **配置层禁止依赖引擎层/映射层**。
4. **研究体系不依赖交易层**：删除 `src/apps/trading/` 与交易相关服务后，研究功能完整运行。

### 3.2.1 调用方向矩阵

| 调用方 ↓ / 被调用方 → | L5 展示 | L4 应用 | L3 引擎 | L2 数据 | L1 基础设施 |
|------------------------|---------|---------|---------|---------|-------------|
| L5 展示 | ✅ 同层 | ✅ | ✅ | ❌ 禁止直接 | ✅（lib/config/core 中稳定部分） |
| L4 应用 | ❌ | ✅ 同层 | ✅ | ❌ 禁止直接写 | ✅ |
| L3 引擎 | ❌ | ❌ | ✅ 同层 | ✅ 读 dataLayer / 写 DataBridge | ✅ |
| L2 数据 | ❌ | ❌ | ❌ | ✅ 同层 | ✅（config/dbConfig 类型） |
| L1 基础设施 | ❌ | ❌ | ❌ | ❌ | ✅ 同层 |

---

## 3.3 数据访问规范

```
L5/L4 ──→ DataBridge.forward() ──→ L2 IndexedDB（写）
L5/L4 ──→ Service / dataLayer ──→ L2 IndexedDB（读，逐步迁移到 Service）
L3    ──→ dataLayer（读） / DataBridge（写）
L2    ──→ db.ts（唯一原生 IndexedDB 操作）
```

### 3.3.1 为什么写操作必须走 DataBridge

| 问题 | 直接调用 dataLayer | 通过 DataBridge |
|------|-------------------|-----------------|
| 调用来源追溯 | 困难 | `meta.source` + `traceId` |
| 权限控制 | 分散在各处 | 统一 ACL 矩阵 |
| 审计日志 | 需手动埋点 | 自动写入 `research_logs` |
| 事件通知 | 需手动 emit | `broadcast()` 统一触发 |
| 测试 mock | 需 mock db | 可 mock DataBridge 或 fake-indexeddb |

### 3.3.2 DataBridge.query() 单元测试标准模式（v2.2.1 新增）

dataLayer 的所有读操作已统一迁移到 `dataBridge.query()`，测试中**禁止直接 mock `db.get`/`db.getAll`/`db.getAllByIndex`**，必须通过 `mockDataBridgeQuery` 模拟 `dataBridge.query()` 的返回值。

**错误示例（已废弃）**：

```ts
// ❌ 直接 mock db 方法 — 与实现脱节
mockDbGet.mockResolvedValue(score)
const result = await v6ScoreStore.get('000001')
expect(mockDbGet).toHaveBeenCalledWith('v6_scores', '000001')
```

**正确示例（当前标准）**：

```ts
// ✅ mock dataBridge.query() — 与实现一致
const score = createV6Score()
mockDataBridgeQuery.mockResolvedValue({ success: true, data: score })

const result = await v6ScoreStore.get('000001')

expect(mockDataBridgeQuery).toHaveBeenCalledWith({
  action: ENVELOPE_ACTION.queryGet,
  store: STORE_NAME.v6Scores,
  key: '000001',
  source: MODULE_ID.datalayer,
})
expect(result).toEqual(score)
```

**三种 query 模式的 mock 对照表**：

| dataLayer 方法 | 内部调用 | mock 返回值格式 |
|---|---|---|
| `queryGet<T>(store, key)` | `dataBridge.query({ action: queryGet, store, key, source })` | `{ success: true, data: T \| undefined }` |
| `queryList<T>(store)` | `dataBridge.query({ action: queryList, store, source })` | `{ success: true, data: T[] }` |
| `queryByIndex<T>(store, indexName, indexValue)` | `dataBridge.query({ action: queryByIndex, store, indexName, indexValue, source })` | `{ success: true, data: T[] }` |

**失败路径 mock**：

```ts
// query 失败时返回 undefined（queryGet）或空数组（queryList/queryByIndex）
mockDataBridgeQuery.mockResolvedValue({ success: false, error: '查询失败' })

const result = await v6ScoreStore.get('000001')
expect(result).toBeUndefined()  // queryGet 失败 → undefined

const list = await v6ScoreStore.list()
expect(list).toEqual([])        // queryList 失败 → []
```

**测试文件参考**：`src/data/dataLayer.test.ts`（47 个测试用例，覆盖全部 store 的 queryGet/queryList/queryByIndex 路径）

> **变更**: 2026-07-05 | v2.2.1 | 新增 DataBridge.query() 单元测试标准模式 | 架构资产治理官

---

## 3.4 配置层文件清单

| 文件 | 内容 | 禁止 |
|------|------|------|
| `src/config/routes.ts` | 路由注册表 | 禁止硬编码路径字符串 |
| `src/config/dbConfig.ts` | DB 配置、ACL、信封动作、枚举 | 禁止业务逻辑 |
| `src/config/scoreFactors.ts` | 评分因子定义、权重、加权算法 | 禁止在引擎层写数字 |
| `src/config/thresholds.ts`（待建） | 评分/筛选阈值 | 禁止在引擎层写数字 |
| `src/config/weights.ts`（已并入 scoreFactors） | 九维权重 | 禁止在引擎层写数字 |
| `src/config/symbols.ts`（待建） | 股票代码池 | 禁止在引擎层写代码 |
| `src/config/llmConfig.ts` | LLM 基础配置 | 禁止在引擎层写 API 密钥 |
| `src/config/fetcherConfig.ts` | 数据采集配置（已建） | 禁止在引擎层写服务地址/维度开关 |
| `src/config/tradingConfig.ts` | 交易引擎配置（已建） | 禁止在引擎层写信号/仓位阈值 |
| `src/config/inputConfig.ts` | 输入舱配置（已建） | 禁止在 UI 层写导入上限/解析规则 |
| `src/config/apiPaths.ts` | 内部 API 路径集中配置（12 条路径：系统监控/交易/数据采集） | 禁止在常量/服务层硬编码 API 路径字符串 |
| `src/config/dataSourceUrls.ts` | 外部数据源 URL 集中配置 | 禁止在组件/服务层硬编码数据源 URL |
| `src/config/mathConstants.ts` | 数学/金融常量（MS_PER_DAY/TRADING_DAYS_PER_YEAR/VAR_95_Z_SCORE 等 10 项） | 禁止在计算逻辑中硬编码数学常数 |
| `src/config/timeouts.ts` | 超时值集中配置（分析引擎/数据采集/默认请求/LLM 调用 4 项） | 禁止在业务代码中硬编码毫秒数 |
| `src/theme.config.ts` | 主题令牌 | 禁止 UI 层内联颜色 |
| `src/constants/cockpit.constants.ts` | Cockpit Widget 常量（网格、颜色、枚举、数据源配置） | 禁止在 Widget 组件内硬编码颜色/尺寸 |

---

## 3.5 引擎层规范

- 禁止静默容错（`?? []` / `|| 0`）
- 禁止全局可变状态
- 禁止幻觉 API 调用
- 禁止 O(n²) 循环（必须标注复杂度）
- 公共函数必须有完整类型签名
- 禁止直接写 DB：必须使用 `DataBridge.forward()`

### 3.5.1 V6 评分引擎 L3 层辅助函数

`src/services/scoring/v6-engine/calculators/l3/helpers.ts` 包含两个核心评分函数：

| 函数 | 用途 | 评分维度 |
|------|------|---------|
| `scoreMoat()` | 护城河评分（1-5 分） | 毛利率、营收增速、ROE |
| `scoreCompetition()` | 竞争格局评分（1-5 分） | 毛利率趋势、营收增速 |

**评分规则**：
- 护城河评分：毛利率为核心指标（60%+→5.0 分，10%以下→2.0 分），营收增速和 ROE 作为加分项
- 竞争格局评分：通过毛利率水平推断趋势（>40%→递增，<20%→递减），结合营收增速综合评估

---

## 3.6 映射层（UI）规范

- 禁止硬编码文本、HEX 颜色、Tailwind 类名
- 禁止组件内业务逻辑/阈值判断
- 数据通过 props 或订阅获取
- 使用 `theme.config.ts` 主题令牌

---

## 3.7 数据 Schema

数据库名：`V6ProDB`  
当前版本：`21`（V9 新库，不与旧项目冲突）

> 注意：早期文档写为版本 `1`/`3`，实际代码已演进至 `21`。v3→v4 新增 `daily_quotes` 与 `signals` Store；v4→v5 为 `stocks` 新增 `group` 字段与 by-group 索引；v5→v6 新增 `rotation_scores`、`sector_scores`、`score_docs`、`strategy_snapshots`、`local_docs`、`news`、`news_stock_map`、`sentiment_cache` Store，支撑 V6 Pro 迁移；v6→v13 为 V9 架构统一与资讯收藏功能演进；v13→v14 新增 `hot_sector_scores`、`value_pit_scores` Store，支撑双策略体系；v14→v19 为智能体调度层、命令模块等 schema 升级；v19→v20 新增 `command_audit_logs` 存储，支撑命令审计日志持久化；v20→v21 新增 `execution_plans`、`execution_logs`、`missing_reports`、`portfolios`、`trade_reviews` 存储，支撑输出舱与执行模块。

### Store

| Store | 主键 | 用途 |
|-------|------|------|
| `stocks` | `symbol` | 标的 |
| `v6_scores` | `symbol` | V6 自动评分 |
| `intelligent_scores` | `id`（自增） | V6 个股智能评分（LLM 增强） |
| `industry_scores` | `id`（自增） | V4 行业评分 |
| `orders` | `id` | 订单 |
| `watchlists` | `id` | 观察列表 |
| `signals` | `id` | 交易信号 |
| `research_logs` | 自增 | 审计日志 |
| `daily_quotes` | `symbol` | K线/行情数据 |
| `rotation_scores` | `id` | 板块轮动评分 |
| `sector_scores` | `id` | 十五五板块评分 |
| `score_docs` | `docId` | 评分文档版本库 |
| `strategy_snapshots` | `id` | 策略快照 |
| `local_docs` | `id` | 本地知识库文档 |
| `news` | `id` | 资讯文章 |
| `news_stock_map` | `id` | 股票-资讯关联 |
| `sentiment_cache` | `id` | 情感分析缓存 |
| `news_bookmarks` | `id` | 资讯收藏状态 |
| `hot_sector_scores` | `symbol` | 热门板块策略评分 |
| `value_pit_scores` | `symbol` | 价值洼地策略评分 |
| `execution_plans` | `id` | 执行计划 |
| `execution_logs` | `id` | 执行日志 |
| `missing_reports` | `id` | 缺失报告 |
| `portfolios` | `id` | 投资组合 |
| `trade_reviews` | `id` | 交易复盘 |

### 核心字段

| 字段 | 类型 | 说明 |
|------|------|------|
| `symbol` | string | 股票代码，如 `600519.SH` |
| `researchStatus` | enum | `candidate / screened / deepDive / watching / archived` |
| `source` | enum | `manual / import / akshare` |
| `dataVersion` | number | 数据版本，用于数据血缘与迁移 |
| `calculatedAt` | number | 评分计算时间戳 |
| `algorithmVersion` | string | 评分算法版本，如 `v9-auto` |
| `dataQuality` | object | 数据质量对象，如 `{ basic: boolean; kline: boolean; finance: boolean }` |

### 3.7.2 数据质量字段

输入舱在采集/导入后更新 `dataQuality`，供 UI 层的 `QualityIndicator` 组件展示：

```ts
interface StockDataQuality {
  basic: boolean      // 基础字段（name/industry/price/pe/pb）完整
  kline: boolean      // K线/行情数据已拉取
  finance: boolean    // 财务数据已拉取
  lastChecked?: number // 最近一次质量检查时间戳
}
```

> 实现时可将 `dataQuality` 直接存入 `stocks` 表，或独立 `stock_quality` store。选择需评估查询频率与迁移成本。

### 3.7.3 研究池状态与交易持仓的边界

V9 的研究池只有五态，由 `researchStatus` 字段表达：

```
candidate → screened → deepDive → watching → archived
```

- **研究池是标的的“研究生命周期”**，所有状态变更必须经 `poolTransitionEngine` 校验，并通过 `DataBridge.forward(UPDATE_STOCK)` 写入。
- **交易持仓不属于研究池**。已下单的模拟/真实持仓由 `orders` Store 独立管理，不写入 `stocks.researchStatus`。
- 买入后，`watching` 状态的标的可选择继续保留观察，或经人工判断后归档；卖出后的订单记录保留在 `orders` 中，用于复盘。
- 禁止把 `orders` 表中的持仓混淆为“交易持仓池”并纳入股票池流转图。

### 3.7.4 数据模型类型引用（`src/data/types.ts`）

以下类型定义均来源于 `src/data/types.ts`，用于 V6 Pro 迁移与七维数据架构：

| 类型 | 用途 | 核心字段 |
|------|------|---------|
| `DimensionScore` | 智能评分子维度得分 | `name`（string）, `score`（number \| null）, `rationale`（string）, `evidence`（string[]）, `weight`（number） |
| `IndustryDimensionScore` | 行业评分子维度 | `name`（string）, `score`（number \| null）, `rationale`（string）, `evidence`（string[]）, `weight`（number） |
| `IndustryScore` | 行业智能评分 | `code`（string）, `name`（string）, `overallScore`（number \| null）, `dimensionScores`（IndustryDimensionScore[]）, `summary`（string）, `basis`（string）, `sectorSnapshot`（object）, `configSnapshot`（object）, `modelResponse`（string）, `scoredAt`（number） |
| `PortfolioHolding` | 组合持仓明细 | `symbol`（string）, `name`（string）, `currentShares`（number）, `currentWeight`（number）, `targetWeight`（number）, `targetShares`（number）, `price`（number）, `marketValue`（number）, `score`（number）, `rationale`（string） |
| `RebalanceAction` | 再平衡动作 | `symbol`（string）, `action`（'buy' \| 'sell' \| 'hold'）, `shares`（number）, `reason`（string） |
| `StrategyClassification` | 策略分类标签 | `'core-scarce'` \| `'value-bargain'` \| `'hot-momentum'` \| `'excluded'` |
| `StrategyCandidate` | 策略候选标的 | `symbol`（string）, `name`（string）, `composite`（number）, `valuationScore`（number \| null）, `industryScore`（number \| null）, `momentum`（number \| null）, `sector`（string \| null）, `classification`（StrategyClassification）, `reasons`（string[]） |
| `StrategyResult` | 策略结果 | `selected`（StrategyCandidate[]）, `coreScarce`（StrategyCandidate[]）, `valueBargain`（StrategyCandidate[]）, `hotMomentum`（StrategyCandidate[]）, `rejected`（StrategyCandidate[]）, `summary`（object） |
| `SignalSnapshot` | 信号快照 | `pePercentile`（number）, `pbPercentile`（number）, `priceToMA20`（number）, `priceToMA60`（number）, `volumeRatio`（number）, `rsi14`（number）, `macdDirection`（'red' \| 'green' \| 'neutral'） |
| `ResearchLog` | 研究审计日志 | `traceId`（string, ✅）, `timestamp`（number, ✅）, `actor`（string, ✅）, `action`（string, ✅）, `targetType`（string, ✅）, `targetCode`（string, ✅）, `payload`（string） |
| `KlineBar` | K线柱 | `date`（string, ✅）, `open`（number, ✅）, `high`（number, ✅）, `low`（number, ✅）, `close`（number, ✅）, `volume`（number, ✅）, `amount`（number, ✅） |
| `SectorScoreDimensions` | 板块评分三维度 | `planAlignment`（number 0-5）, `policySupport`（number 0-5）, `usChinaParity`（number 0-5） |
| `SectorUsChinaData` | 中美对比数据 | `chinaShare`（string）, `usStatus`（string）, `gap`（string） |
| `SectorDefinition` | 板块定义 | `code`（string）, `name`（string）, `category`（'新兴产业' \| '未来产业' \| '战略基础'）, `description`（string）, `keywords`（string[]）, `dimensions`（SectorScoreDimensions）, `weight`（object）, `composite`（number）, `isCore`（boolean）, `usChina`（SectorUsChinaData）, `keyStocks`（Array）, `relatedConcepts`（string[]） |
| `SectorStockMapping` | 板块-股票映射 | `sectorCode`（string）, `sectorName`（string）, `stockSymbols`（string[]）, `matchType`（'primary' \| 'secondary'） |
| `SectorScoreRecord` | 板块评分记录 | `sectorCode`（string）, `scoreDate`（string）, `dimensions`（SectorScoreDimensions）, `composite`（number）, `isCore`（boolean）, `modelUsed`（string）, `createdAt`（string） |
| `MarketStyle` | 市场风格周期 | `'growth'` \| `'value'` \| `'balanced'` |
| `RotationSubFactor` | 轮动因子子指标 | `code`（string）, `name`（string）, `score`（number）, `calcMethod`（string）, `dataSource`（string）, `freq`（string）, `fullRule`（string）, `midRule`（string）, `zeroRule`（string）, `redLine`（string） |
| `RotationFactor` | 轮动因子 | `code`（string）, `name`（string）, `weight`（number）, `maxScore`（number）, `subCount`（number）, `role`（string）, `color`（string）, `subs`（RotationSubFactor[]） |
| `RotationSignalGrade` | 轮动信号分级 | `minResonance`（number）, `maxResonance`（number）, `label`（string）, `signalType`（string）, `position`（string）, `action`（string）, `color`（string）, `bg`（string） |
| `RotationScoreBucket` | 综合得分分档 | `min`（number）, `label`（string）, `pos`（string）, `desc`（string）, `color`（string） |
| `RotationAlertLevel` | 高景气抛售预警 | `code`（string）, `name`（string）, `color`（string）, `condition`（string）, `action`（string） |
| `DeclineNature` | 下跌性质判定 | `type`（'杀逻辑' \| '杀业绩' \| '杀估值'）, `severity`（'严重' \| '中等' \| '轻微'）, `action`（string）, `color`（string） |
| `RotationSectorScore` | 板块轮动评分记录 | `sectorCode`（string）, `sectorName`（string）, `f1Jingqi`（number）, `f2Zijin`（number）, `f3Guzhi`（number）, `f4Beta`（number）, `f5Nengliang`（number）, `total`（number 0-100）, `resonance`（number 0-10）, `signal`（string）, `alertLevel`（string）, `declineType`（string）, `poolStocks`（Array）, `analysisReport`（string）, `modelUsed`（string）, `createdAt`（string） |
| `V6LayerScore` | V6评分单维度 | `score`（number）, `reason`（string）, `weight`（number） |
| `ScoreDocVersion` | 评分文档版本 | `docId`（string）, `symbol`（string）, `stockName`（string）, `version`（number）, `scoreDate`（string）, `composite`（number）, `l3v`（number）, `layers`（Record\<string, V6LayerScore\>）, `recommendation`（object）, `targetPrice`（object）, `keyRisks`（string[]）, `keyCatalysts`（string[]）, `reportMd`（string）, `modelUsed`（string）, `market`（string）, `changeFromPrev`（object）, `createdAt`（string） |
| `StrategyGroupSnapshot` | 策略分组快照 | `count`（number）, `avgComposite`（number）, `maxComposite`（number）, `symbols`（string[]）, `items`（Array） |
| `StrategySnapshot` | 策略快照 | `id`（string）, `version`（number）, `timestamp`（number）, `date`（string）, `stockCount`（number）, `scoreCount`（number）, `rotationCount`（number）, `core`（StrategyGroupSnapshot）, `hot`（StrategyGroupSnapshot）, `value`（StrategyGroupSnapshot）, `changeFromPrev`（object）, `trigger`（string） |
| `HotSectorScore` | 热门板块策略评分 | `symbol`（string）, `score`（number 0-5）, `dimensions`（{ momentum, sentiment, technical, valuation, composite }）, `triggerAction`（'immediate' \| 'probe' \| 'ignore'）, `calculatedAt`（number）, `dataVersion`（number） |
| `ValuePitScore` | 价值洼地策略评分 | `symbol`（string）, `score`（number 0-5）, `dimensions`（{ catalyst, valuation, chip, rotation, liquidity }）, `rotationSignal`（boolean）, `triggerAction`（'immediate' \| 'probe' \| 'wait' \| 'ignore'）, `calculatedAt`（number）, `dataVersion`（number） |
| `DualStrategyResult` | 双策略编排结果 | `hotSectorScores`（HotSectorScore[]）, `valuePitScores`（ValuePitScore[]）, `signals`（TradingSignal[]）, `watchlistCandidates`（{ symbol, reason }[]）, `summary`（object） |
| `LocalDoc` | 本地知识库文档 | `id`（string）, `symbol`（string）, `name`（string）, `content`（string）, `category`（'研报' \| '财报' \| '行业分析' \| '新闻' \| '策略笔记' \| '其他'）, `tags`（string[]）, `sourcePath`（string）, `size`（number）, `addedAt`（number） |
| `NewsArticle` | 外部财经资讯 | `id`（string）, `title`（string）, `content`（string）, `url`（string）, `source`（string）, `category`（string）, `publishTime`（string）, `fetchTime`（string）, `sentiment`（'positive' \| 'negative' \| 'neutral'）, `sentimentConfidence`（number）, `relatedStocks`（string[]）, `keywords`（string[]）, `hash`（string） |
| `NewsStockMap` | 股票-资讯关联 | `symbol`（string）, `newsId`（string）, `relevanceScore`（number）, `isTitleMatch`（boolean）, `isContentMatch`（boolean）, `industryMatch`（boolean） |
| `SentimentCache` | 情感分析缓存 | `contentHash`（string）, `sentiment`（'positive' \| 'negative' \| 'neutral'）, `confidence`（number）, `method`（'rule' \| 'llm' \| 'hybrid'）, `analyzedAt`（number）, `llmModel`（string） |
| `DataDimensionType` | 七维数据类型 | `'01_basic'` \| `'02_kline'` \| `'03_chip'` \| `'04_events'` \| `'05_news'` \| `'06_industry'` \| `'07_index'` |
| `DimensionStatus` | 单维度采集状态 | `status`（'pending' \| 'collecting' \| 'completed' \| 'failed'）, `records`（number）, `updatedAt`（string）, `hash`（string） |

> **变更**: 2026-06-26 | v1.1.0 | 补充 34 个数据模型类型引用 | 架构资产治理官

---

## 3.8 信封结构

```ts
interface StandardEnvelope {
  meta: {
    source: ModuleId;
    target: EnvelopeTarget;
    action: EnvelopeAction;
    traceId: string;
    timestamp: number;
  };
  payload: unknown;
}
```

详见 `../reference/05-engine-specs.md` 第 4 节。

### 3.8.1 DataBridge 适配层接口定义

**来源**: `src/types/modules/databridge.types.ts`

| 接口 | 用途 | 核心字段 |
|------|------|---------|
| `DataBridgeAdapterConfig` | DataBridgeAdapter 配置 | `enableFallbackQueue`（boolean）, `defaultTimeout`（number） |
| `DataAction` | 数据操作动作枚举 | `'FETCH_NEWS'` \| `'FETCH_STOCKS'` \| `'FETCH_SCORES'` \| `'FETCH_DAILY_QUOTES'` \| `'FETCH_INDUSTRY_SCORES'` \| `'FETCH_INTELLIGENT_SCORES'` \| `'FETCH_STRATEGY_SNAPSHOTS'` \| `'FETCH_LOCAL_DOCS'` \| `'SAVE_NEWS'` \| `'SAVE_STOCK'` \| `'SAVE_SCORE'` \| `'UPDATE_WATCHLIST'` \| `'DELETE_NEWS'` \| `'DELETE_STOCK'` |
| `BridgeQueryOptions` | 查询选项 | `timeout`（number）, `fallbackToCache`（boolean）, `retryCount`（number） |
| `BridgeQueryResult<T>` | 查询结果泛型 | `success`（boolean, ✅）, `data`（T）, `error`（string）, `fromCache`（boolean）, `traceId`（string, ✅） |
| `DataBridgeAdapterStats` | 适配器统计快照 | `pendingQueries`（number, ✅）, `enableFallbackQueue`（boolean, ✅） |

> **变更**: 2026-06-26 | v1.1.0 | 补充 DataBridge 适配层接口定义 | 架构资产治理官

---

## 3.9 技术选型理由

### 3.9.1 纯前端无后端

- **数据主权**：个人投资者数据敏感，不上传服务器。
- **离线可用**：无需网络即可使用核心功能。
- **部署简单**：静态托管即可，降低运维成本。
- **代价**：无法跨设备同步，依赖用户自行导入/导出。

### 3.9.2 IndexedDB 而非 localStorage

- **容量**：IndexedDB 可存数百 MB，localStorage 仅 5–10 MB。
- **结构化**：支持 object store、索引、事务、游标。
- **异步**：IndexedDB 为异步 API，不会阻塞主线程。
- **代价**：API 较底层，需自行处理版本迁移与错误。

### 3.9.3 DataBridge 而非全局 Store

- **明确边界**：每个写操作都携带 source/target/action，便于追踪。
- **权限控制**：ACL 矩阵集中管理，防止越权。
- **审计血缘**：自动记录 `research_logs`，支持复盘与调试。
- **代价**：相比直接调用，增加少量样板代码。

### 3.9.4 React Router HashRouter

- **静态托管友好**：GitHub Pages 等无需服务端 rewrite。
- **离线刷新无 404**：hash 部分不发送到服务器。
- **代价**：URL 不美观，SEO 不友好（工具型应用可接受）。

### 3.9.5 Zustand 而非 Redux

- **轻量**：体积小巧，TypeScript 友好。
- **足够**：本项目仅需少量跨组件 UI 状态。
- **代价**：生态不如 Redux 丰富，但本项目不需要中间件生态。

---

## 3.9.6 输入舱数据协议

输入舱内所有写操作必须经 `DataBridge.forward()`，并携带统一信封字段：

```ts
{
  meta: {
    source: 'input-cabin';           // 舱室来源
    target: 'indexeddb';
    action: 'INSERT_STOCK' | 'BULK_IMPORT' | 'UPDATE_STOCK' | 'SAVE_DAILY_QUOTES';
    traceId: string;
    timestamp: number;
    dataVersion: number;             // 与 stocks.dataVersion 对齐
  },
  payload: unknown;
}
```

输入舱内部事件规范：

| 事件名 | 触发时机 | 订阅方 |
|--------|----------|--------|
| `input:poolChanged` | 股票录入/导入/流转/删除后 | `StockPoolBoardPage`, `PoolBoard` |
| `input:fetcherStatusChanged` | 采集服务健康状态变化后 | `DataTestPanel`, 顶部状态栏 |
| `input:importProgress` | 批量导入进度更新 | `BulkImportPanel` |

### 3.9.7 共享字段契约（借鉴 StateBoard 思想）

V10 的 `StateBoard` 要求跨模块共享状态必须通过统一字段契约。V9 当前使用 `eventBus` + DataBridge + Zustand，但应在以下字段上保持契约一致：

| 字段/对象 | 来源 | 消费方 | 说明 |
|-----------|------|--------|------|
| `Stock.dataQuality` | `fetcherService` / `inputService` | `QualityIndicator`, `PoolCard`, `DataTestPanel` | 数据质量状态 |
| `V6Score.score` / `factors` | `v6ScoreService` | `StockAnalysisPage`, `TradingApp` | 评分结果 |
| `TradingSignal.type` / `confidence` | `signalGenerator` | `TradingApp`, `RiskBanner` | 交易信号 |
| `Order.riskReview` | `riskEngine` | `FinalConfirm`, `RiskBanner` | 风控状态 |

> 禁止各模块自行定义同名但语义不同的字段；新增共享字段须经文档评审。

---

## 3.10 离线机制

### 3.10.1 离线目标

- 核心页面断网后可加载（依赖 PWA 缓存，v1.0.0 完成）。
- 已下载的股票、评分、订单数据可读取。
- V6 自动评分不依赖网络；LLM 智能评分离线时回退到自动评分。

### 3.10.2 离线状态检测

- 使用浏览器 `navigator.onLine` 与 `online/offline` 事件。
- UI 层显示离线徽章，禁用需要 LLM/网络的功能。

### 3.10.3 数据缓存策略

- 股票基础数据、评分结果、订单全部持久化到 IndexedDB。
- 导入的研报/报告文本经解析后本地存储，不上传。

---

## 3.11 错误处理与降级策略

| 场景 | 策略 |
|------|------|
| DataBridge ACL 拒绝 | 抛 `AclError`，UI 提示无权限，不静默忽略 |
| 信封格式非法 | 抛 `EnvelopeError`，阻断操作 |
| DB 写入失败 | 抛 `EnvelopeError`，已写审计日志不保证原子回滚 |
| 股票不存在 | 引擎返回 `{ success: false, error }`，UI 提示 |
| LLM 不可用 | 回退到 V6 自动评分，UI 显示「离线模式」 |
| AKShare 拉取失败 | 保留本地已有数据，提示用户检查服务 |
| IndexedDB 升级失败 | 导出备份 → 重建数据库 → 提示用户恢复 |

---

## 3.12 当前代码-架构偏差清单（V6 Pro 对照评估）

基于 V6 Pro 驾驶舱与 V9 的深度比对，识别以下偏差：

| # | 偏差 | 实际位置 | 影响 | 计划 |
|---|------|----------|------|------|
| D01 | `agents/` 基础运行时已实现（`agentRuntime.ts`），完整框架待完善 | `src/agents/agentRuntime.ts` | 注册表/健康监控/AI 助手待完善 | Phase 2 完善 |
| D02 | 🟢 已修复：`trading/` 已下沉为 `src/services/trading/` | `src/services/trading/*` | 交易引擎与应用层已解耦 | 保持并补充交易服务测试 |
| D03 | V6 自动评分仍部分依赖随机数/模拟数据 | `src/services/scoring/v6ScoreService.ts` | 评分结果质量取决于真实数据完整度；缺少评分理由与报告 | Phase 2 接入真实数据；补充评分报告生成 |
| D04 | 🟢 已修复：五舱入口与输入舱子路由均已注册 | `src/config/routes.ts` | 直接访问不再 404 | 保持，未来按功能增加子路由 |
| D05 | 缺少 `thresholds.ts` / `symbols.ts` | `src/config/` | 阈值与代码池尚未集中 | Phase 2 按需创建 |
| D06 | 🟢 已修复：跨层调用扫描脚本已建立 | `scripts/audit-layer-calls.ts` | 当前基线 0 违规 / 0 警告 | 持续维护 |
| D07 | 🟢 已修复：`inputConfig.ts` 已创建（已存在） | `src/config/inputConfig.ts` | 搜索/导入/质量规则已集中 | 持续补充高级筛选配置 |
| D08 | 路由表缺少文件一致性审计 | `src/config/routes.ts` vs `src/apps/`/`src/pages/` | 新增/删除文件后可能漂移 | Phase 2 增强 `audit-dead-code.ts` 路由-文件校验 |
| D09 | UI 层仍存硬编码 Tailwind 颜色/字符串 | `src/apps/input/prototype/*` 等 | 违反映射层规范 | Phase 2 落地正式组件时统一清理 |
| D10 | V10 的 Agent/StateBoard/Gateway 机制尚未引入 | `src/` | 未来扩展方向未在文档中记录 | Phase 2/P3 按需求逐步评估 |
| D11 | 缺少共享字段契约文档 | `../reference/03-architecture-standards.md` | 跨模块字段语义可能漂移 | 已在 3.9.7 补充 |
| **D12** | **数据流引擎已实现（`src/core/dataflow/`），详细规格文档待补充** | `src/core/dataflow/` | SSE/轮询/缓存/定时/优先级已落地，规格文档待完善 | Phase 2 补充详细规格文档 |
| **D13** | 🟢 已修复：数据融合层已实现（`dataFusionEngine.ts` + `unifiedStockService.ts`） | `src/services/analysis/` | 统一数据视图已落地 | 持续完善数据融合逻辑 |
| **D14** | 🟢 已修复：Widget 运行时引擎已接入 `CockpitShell` | `src/cockpit/CockpitShell.tsx` | 注册表/运行时/Shell 已完整接入 | 持续完善 Widget 生态 |
| **D15** | **评分算法能力降级** | `src/services/scoring/v6ScoreService.ts` | 仅启发式计算 + 随机数降级，缺少 LLM 集成与报告生成 | Phase 2 升级评分引擎，接入真实数据与 LLM |
| **D16** | 🟢 已修复：图表组件库已引入 | `package.json` | 已引入 `lightweight-charts` 和 `recharts`，数据可视化能力已具备 | 持续完善图表组件封装 |
| **D17** | **`rotationScoreService.ts` 已实现五因子十六指标模型，上层 `SectorAnalysisPage` 待充分接入** | `src/services/analysis/rotationScoreService.ts` | 板块轮动评分已可计算，上层展示与调用待完善 | Phase 2 在 `SectorAnalysisPage` 接入轮动评分 |
| **D18** | **缺少操作反馈闭环** | `src/components/atoms/Toast.tsx` | 仅基础 Toast，缺少操作状态实时更新、数据质量反馈、评分理由 | Phase 2 完善反馈机制 |
| **D19** | 🟢 已修复：`WidgetErrorBoundary` 已接入 `CockpitShell` Widget 渲染管线 | `src/cockpit/CockpitShell.tsx` | Widget 级错误隔离已落地，每个 Widget 独立捕获渲染错误 | 保持，持续完善错误恢复策略 |
| **D20** | **缺少热门板块与价值洼地双策略体系** | `src/services/trading/`、`src/cockpit/widgets/` | 策略引擎仅有主题/价值/热门动量三分类，缺少用户规格中的 HotSectorScore / ValuePitScore 双评分输出与轮动信号检测 | Phase 2 新增独立 Store、Analyzer、Detector、Widget；详见 `./design/2026-06-27-dual-strategy-system.md` |

---

## 3.13 Page 组件红色高危区

> **目的**：识别页面脚本中最容易被忽略但对人机交互影响致命的三类问题，建立强制审查机制。

### 3.13.1 问题一：数据请求缺少 pending 状态处理

**页面脚本行为**：数据请求写在 `useEffect`/`componentDidMount` 中，但不处理 loading/pending 状态。

**对人机交互的致命影响**：用户点击菜单后界面"愣住"无反馈，违反响应性原则（Response Time 准则），用户无法判断系统是否正在处理，可能导致重复操作或放弃使用。

**V9 补强指令**：
- 强制包裹 `isLoading` / `loading` 状态变量
- 绑定全局骨架屏（Skeleton）或局部加载指示器
- 请求开始时设置 `loading = true`，结束（成功/失败）时设置 `loading = false`
- 使用 `try-catch-finally` 确保 loading 状态必定被重置

**检查范围**：所有 `src/pages/`、`src/apps/` 下的页面组件

**违规示例**（当前存在于代码中）：
- `StockAnalysisPage.tsx` (第22-28行)：`loadStockForAnalysis`/`loadDailyQuotesForAnalysis`/`loadV6ScoreForAnalysis` 无 loading 状态包裹
- `AnalysisApp.tsx` (第15-20行)：`loadStocks` 无 loading 状态包裹

**修正指令**：
```typescript
// StockAnalysisPage.tsx 第22-28行
useEffect(() => {
  if (symbol) {
    setLoading(true)
    Promise.all([
      loadStockForAnalysis(symbol),
      loadDailyQuotesForAnalysis(symbol),
      loadV6ScoreForAnalysis(symbol),
    ]).then(([stockData, quotesData, scoreData]) => {
      setStock(stockData)
      setQuotes(quotesData)
      setScore(scoreData)
    }).catch(console.error).finally(() => {
      setLoading(false)
    })
  }
}, [symbol])
```

---

### 3.13.2 问题二：监听器未在组件卸载时销毁

**页面脚本行为**：监听 Engine/EventBus 变化，但未在 `useEffect` 返回函数/`componentWillUnmount` 中调用 `removeListener`/`off`。

**对人机交互的致命影响**：页面切走后监听器仍在运行，持续占用 CPU 和内存，长时间操作后界面卡顿，违反资源管理原则。

**V9 补强指令**：
- 显式调用 `removeListener` / `off` / `unsubscribe`
- 使用 `useEffect` 返回函数进行清理
- 复杂场景使用 `WeakRef` 优化引用管理
- 统一使用 `eventBus.on()` 返回的 `off` 函数清理

**检查范围**：所有订阅 EventBus/DataFlowEngine 的页面组件

**违规示例**（当前存在于代码中）：
- `StockAnalysisPage.tsx`：未订阅任何事件，暂时安全
- `TradingApp.tsx`：未订阅任何事件，暂时安全
- 待实现的 Widget 组件必须严格遵循此规则

**修正指令**：
```typescript
// Widget 组件订阅示例
useEffect(() => {
  const unsubscribe = eventBus.on('market:index', handleIndexUpdate)
  return () => unsubscribe()
}, [])
```

---

### 3.13.3 问题三：路由参数变化未重新触发数据刷新

**页面脚本行为**：使用 `useParams` 获取路由参数，但参数变化时未重新触发 DataBridge 刷新。

**对人机交互的致命影响**：从 A 详情页切到 B 详情页，数据还是 A 的，导致严重认知错乱（Cognitive Mismatch），用户看到错误数据可能做出错误决策。

**V9 补强指令**：
- 在路由参数变化时强制添加 `resetState + refetch` 逻辑
- 使用 `useEffect` 监听 `params` 变化
- 每次参数变化先清空旧数据，再重新加载新数据
- 避免依赖 stale closure

**检查范围**：所有使用路由参数的详情页组件

**违规示例**（当前存在于代码中）：
- `StockAnalysisPage.tsx` (第22-28行)：`useEffect` 已依赖 `symbol`，但缺少 resetState 步骤

**修正指令**：
```typescript
// StockAnalysisPage.tsx 第22-28行
useEffect(() => {
  if (symbol) {
    setStock(undefined)
    setQuotes(undefined)
    setScore(undefined)
    setLoading(true)
    Promise.all([
      loadStockForAnalysis(symbol),
      loadDailyQuotesForAnalysis(symbol),
      loadV6ScoreForAnalysis(symbol),
    ]).then(([stockData, quotesData, scoreData]) => {
      setStock(stockData)
      setQuotes(quotesData)
      setScore(scoreData)
    }).catch(console.error).finally(() => {
      setLoading(false)
    })
  }
}, [symbol])
```

---

### 3.13.4 强制审查清单

| 检查项 | 检查方式 | 责任人 |
|--------|----------|--------|
| 所有数据请求是否有 loading 状态 | 代码审查 + ESLint 规则 | 开发 |
| 所有监听器是否在卸载时销毁 | 代码审查 + 内存泄漏检测 | 开发 |
| 所有路由参数变化是否触发刷新 | 代码审查 + 集成测试 | 开发 |
| 是否使用 try-catch-finally | 代码审查 + ESLint 规则 | 开发 |

---

## 3.14 架构守护检查清单

- [ ] `src/apps/` / `src/pages/` / `src/components/` / `src/portal/` / `src/cockpit/` 无直接 import `dataLayer` 写操作。
- [ ] `src/config/` 不 import `src/services/` / `src/apps/` / `src/pages/`。
- [ ] `src/core/` 不 import `src/components/` / `src/pages/`。
- [ ] `src/services/` 写操作全部使用 `DataBridge.forward()`。
- [ ] 删除 `src/apps/trading/` 后，`src/apps/input/`、`src/apps/analysis/`、`src/apps/output/` 仍可独立运行。

---

## 3.15 版本比对

本文档当前版本为 `v0.9.0-migration-implemented`，与规划基线 `v0.9.0-docs-base` 的差异见：

- `../reference/architecture-version-comparison.md`

主要变化：

1. 修正 L3/L4 实际目录映射（交易、采集引擎已下沉）。
2. 增加 `daily_quotes` store、`dataQuality` 字段与输入舱数据协议。
3. 更新偏差清单，标记已修复项并新增未解决项。
4. 补充配置层清单：`fetcherConfig.ts`、`tradingConfig.ts` 已建，`inputConfig.ts` 已建。
5. v2.3.0：新增 §3.1.8 四层模块注册体系架构说明（Store/Service/Component/Widget Registry）。
6. v2.3.0：Widget 注册数从 12 增至 21（新增 7 个系统监控类 Widget 及金融业务 Widget）。
7. v2.3.0：偏差 D19 标记已修复（WidgetErrorBoundary 已接入 CockpitShell）。
8. v2.5.0：配置层新增 `timeouts.ts`（超时集中配置）；`apiPaths.ts`/`mathConstants.ts` 描述更新。
9. v2.5.0：L3 引擎层补充交易计算纯函数（positionComputer/pnlComputer/riskComputer）和 UseCase 层（11 个文件：createExecutionPlan/executePlan/fetchSectorAnalysis/fetcherOrchestrator/generateTradeReview/getUnifiedStockView/hotSectorQuery/rebalancePortfolio/runDualStrategy/strategySnapshotSave/submitOrder）。
10. v2.5.0：§3.1.8 四层注册体系调整为三层（Service Registry 已删除）。
11. v2.5.0：新增 TradePair 类型体系统一说明（MatchedTradePair extends TradePair，SymbolTradePair 按 symbol 聚合）。
12. v2.6.0：新增 §3.16 模块分拆必要性评估框架。

---

## 3.16 模块分拆必要性评估框架

### 3.16.1 核心原则：非必要不分拆

分拆操作需满足以下前提条件之一：
- 存在明确的业务需求变更驱动
- 存在可量化的性能优化目标
- 存在架构升级必要性（如违反分层规则、职责混杂）
- 代码复杂度已严重影响开发效率和质量

**禁止为分拆而分拆**：单纯追求文件行数减少不是分拆的正当理由。

### 3.16.2 评估维度与权重

| 维度 | 权重 | 评估标准 |
|------|------|---------|
| **业务需求** | 30% | 是否有明确的业务变更驱动？（新增功能、需求变更） |
| **性能优化** | 20% | 是否存在性能瓶颈可通过拆分解决？ |
| **架构升级** | 25% | 是否符合分层架构原则？是否违反依赖方向规则？ |
| **可维护性** | 25% | 代码复杂度（CC）、认知负荷、团队协作效率 |

### 3.16.3 决策阈值

| 分数 | 决策 |
|------|------|
| ≥ 70 分 | 建议拆分 |
| 50-69 分 | 谨慎评估，考虑替代方案 |
| < 50 分 | 不建议拆分 |

### 3.16.4 替代方案评估

在决定拆分前，应优先考虑以下替代方案：

1. **函数提取**：将大函数拆分为小函数（不增加文件数）
2. **配置外化**：将常量/配置提取到 config/constants 文件
3. **类型定义分离**：将 interface/type 提取到 types 文件
4. **代码注释优化**：增加架构注释，降低认知负荷

### 3.16.5 分拆可行性评估清单

| 检查项 | 通过标准 |
|--------|---------|
| 调用点数量 | < 5 处（越少越好） |
| 私有方法内聚度 | 高（方法间关联性强） |
| 循环依赖风险 | 低（无跨模块循环依赖） |
| 测试覆盖度 | ≥ 80%（拆前） |
| 回滚成本 | 低（re-export 保持向后兼容） |

### 3.16.6 成本风险分析框架

**开发成本**：
- 估算代码迁移工时（按行数和复杂度）
- 估算测试适配工时
- 估算文档更新工时

**维护成本增量**：
- 新增文件数量
- 跨文件依赖关系复杂度
- 模块间接口定义与版本管理

**风险等级**：
| 风险 | 等级 | 应对策略 |
|------|------|---------|
| 循环依赖引入 | 高 | 使用 re-export 模式，确保定义在引用之前 |
| 接口签名变更 | 高 | 保持原接口不变，通过 re-export 兼容 |
| 测试覆盖率下降 | 中 | 拆分前确保测试覆盖，拆分后增量验证 |
| 开发效率短期下降 | 中 | 完成拆分后进行知识转移 |

### 3.16.7 评估流程图

```
需要分拆模块？
    │
    ├─→ 计算评估分数（业务需求30% + 性能优化20% + 架构升级25% + 可维护性25%）
    │
    ├─→ 分数 < 50？ ──→ 不建议拆分，返回
    │
    ├─→ 50 ≤ 分数 < 70？ ──→ 谨慎评估，考虑替代方案（函数提取/配置外化/类型分离/注释优化）
    │                           │
    │                           └─→ 替代方案可行？ ──→ 执行替代方案
    │                                   │
    │                                   └─→ 替代方案不可行？ ──→ 继续拆分评估
    │
    └─→ 分数 ≥ 70？ ──→ 评估分拆可行性清单
                            │
                            └─→ 清单全部通过？ ──→ 执行拆分
                                    │
                                    └─→ 清单未通过？ ──→ 优化后重试或放弃拆分
```

### 3.16.8 与 AGENTS.md 的关系

本章节与 `../../AGENTS.md` §十三 模块分拆必要性评估框架保持同步。../../AGENTS.md 作为 AI 辅助开发的行为约束契约，本章节作为团队知识库中的架构标准文档，两者共同构成模块分拆决策的双重保障。
