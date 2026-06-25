# 03. 架构标准

> **Status**: Current  
> **Version**: v0.9.0-migration-implemented  
> **Last Updated**: 2026-06-25
>
> 本文档是 V9 系统架构的唯一真相源，定义五层架构、调用规则、数据架构、技术选型理由与当前代码偏差。  
> 目标读者：前端/全栈开发者、架构师、新加入成员。  
> 与规划基线的差异见 `docs/implementation/architecture-version-comparison.md`。

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
| L5 展示层 | `pages/`, `components/` | ✅ `pages/`, `components/`, `portal/`, `cockpit/` | 基本对齐 |
| L4 应用层 | `apps/`, `cockpit/` | ✅ `apps/`, `cockpit/`；输入舱已拆分为 Dashboard / BulkImport / HotSector / DataTest 四个子页面 | 对齐 |
| L3 引擎层 | `agents/`, `trading/`, `services/` | ✅ `services/`；交易引擎已下沉至 `src/services/trading/`；采集引擎位于 `src/services/fetcher/`；🟡 `src/agents/agentRuntime.ts` 已存在，注册表/任务队列/健康监控待完善；🟡 `src/core/dataflow/` 已实现，数据融合层（UnifiedStockData）仍缺失 | 部分对齐，见偏差清单 |
| L2 数据层 | `data/`, `db/` | ✅ `src/data/`（含 `db.ts`, `dataLayer.ts`, `types.ts`）；`daily_quotes`、`signals`、`research_logs` store 已落地 | 对齐 |
| L1 基础设施层 | `lib/`, `config/`, `core/` | ✅ `src/lib/`, `src/config/`, `src/core/`；🟡 `eventBus` 本身仍为基础 `on/emit/off`，高级缓存/定时/优先级由 `src/core/dataflow/dataflowEngine.ts` 承载 | 部分对齐 |

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

**当前状态**：🔴 未实现。`UnifiedStockData` 类型已定义于 `src/data/types.ts:665`，仅缺少 `unifiedStockService.ts` 服务实现。

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
├── CockpitShell.tsx          # 驾驶舱外壳
├── widgetRegistry.ts         # Widget 注册表
├── widgetEngine.ts           # Widget 运行时引擎
├── widgetEventBus.ts         # Widget 事件总线
└── widgets/
    ├── market/               # 市场类 Widget
    ├── portfolio/            # 持仓类 Widget
    ├── strategy/             # 策略类 Widget
    └── agent/                # Agent 监控类 Widget
```

> 注：`src/cockpit/widgets/` 子目录（`market`/`portfolio`/`strategy`/`agent`）尚未创建。

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

**当前状态**：🟡 `CockpitShell.tsx` 当前为静态 Dashboard，尚未接入 Widget 引擎的动态网格布局；`src/cockpit/core/widgetEngine.ts` / `widgetRegistry.ts` 已实现基础 Widget 运行时，尚未被 CockpitShell 调用。

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
| `src/theme.config.ts` | 主题令牌 | 禁止 UI 层内联颜色 |

---

## 3.5 引擎层规范

- 禁止静默容错（`?? []` / `|| 0`）
- 禁止全局可变状态
- 禁止幻觉 API 调用
- 禁止 O(n²) 循环（必须标注复杂度）
- 公共函数必须有完整类型签名
- 禁止直接写 DB：必须使用 `DataBridge.forward()`

---

## 3.6 映射层（UI）规范

- 禁止硬编码文本、HEX 颜色、Tailwind 类名
- 禁止组件内业务逻辑/阈值判断
- 数据通过 props 或订阅获取
- 使用 `theme.config.ts` 主题令牌

---

## 3.7 数据 Schema

数据库名：`V6ProDB`  
当前版本：`6`（V9 新库，不与旧项目冲突）

> 注意：早期文档写为版本 `1`/`3`，实际代码已演进至 `6`。v3→v4 新增 `daily_quotes` 与 `signals` Store；v4→v5 为 `stocks` 新增 `group` 字段与 by-group 索引；v5→v6 新增 `rotation_scores`、`sector_scores`、`score_docs`、`strategy_snapshots`、`local_docs`、`news`、`news_stock_map`、`sentiment_cache` Store，支撑 V6 Pro 迁移。

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

详见 `docs/05-engine-specs.md` 第 4 节。

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
| `input:poolChanged` | 股票录入/导入/流转/删除后 | `InputDashboard`, `PoolBoard` |
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
| D11 | 缺少共享字段契约文档 | `docs/03-architecture-standards.md` | 跨模块字段语义可能漂移 | 已在 3.9.7 补充 |
| **D12** | **数据流引擎已实现（`src/core/dataflow/`），详细规格文档待补充** | `src/core/dataflow/` | SSE/轮询/缓存/定时/优先级已落地，规格文档待完善 | Phase 2 补充详细规格文档 |
| **D13** | **缺少数据融合层** | `src/services/analysis/` | 各服务分散获取数据，缺少统一 `UnifiedStockData` 视图 | Phase 2 实现 `unifiedStockService.ts` |
| **D14** | **Widget 运行时引擎已存在（`src/cockpit/core/widgetEngine.ts`），`CockpitShell` 尚未接入** | `src/cockpit/core/widgetEngine.ts` | 注册表/运行时基础已落地，Shell 未调用 | Phase 2 将 CockpitShell 接入 Widget 引擎 |
| **D15** | **评分算法能力降级** | `src/services/scoring/v6ScoreService.ts` | 仅启发式计算 + 随机数降级，缺少 LLM 集成与报告生成 | Phase 2 升级评分引擎，接入真实数据与 LLM |
| **D16** | **缺少图表组件库** | `src/components/ui/` | 无 `lightweight-charts` / `recharts`，数据可视化能力缺失 | Phase 2 引入图表组件 |
| **D17** | **`rotationScoreService.ts` 已实现五因子十六指标模型，上层 `SectorAnalysisPage` 待充分接入** | `src/services/analysis/rotationScoreService.ts` | 板块轮动评分已可计算，上层展示与调用待完善 | Phase 2 在 `SectorAnalysisPage` 接入轮动评分 |
| **D18** | **缺少操作反馈闭环** | `src/components/ui/Toast.tsx` | 仅基础 Toast，缺少操作状态实时更新、数据质量反馈、评分理由 | Phase 2 完善反馈机制 |
| **D19** | **`ErrorBoundary.tsx` 已存在并被 `App.tsx` 使用，Widget 级隔离待专项接入** | `src/components/ErrorBoundary.tsx` | 全局错误边界已落地，Widget 级包裹尚未专项接入 | Phase 2 在 Widget 渲染管线中接入 ErrorBoundary |

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

- `docs/implementation/architecture-version-comparison.md`

主要变化：

1. 修正 L3/L4 实际目录映射（交易、采集引擎已下沉）。
2. 增加 `daily_quotes` store、`dataQuality` 字段与输入舱数据协议。
3. 更新偏差清单，标记已修复项并新增未解决项。
4. 补充配置层清单：`fetcherConfig.ts`、`tradingConfig.ts` 已建，`inputConfig.ts` 已建。
