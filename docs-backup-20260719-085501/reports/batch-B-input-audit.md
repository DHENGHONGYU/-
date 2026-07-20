# 批次 B（输入舱）L1-L5 五层追溯审计报告

> **审计日期**: 2026-07-05
> **审计范围**: 9 个入口（B1-B9）
> **审计员**: 五层追溯审计员

---

## 审计总览

| 入口 | 功能名 | 路由 | 组件 | L1 | L2 | L3 | L4 | L5 |
|------|--------|------|------|----|----|----|----|----|
| B1 | 输入舱模块首页 | `/input/hub` | InputDashboard | 🟡 | 🟡 | ✅ | ✅ | ✅ |
| B2 | 输入舱录入看板 | `/input` | InputDashboard | 🟡 | 🟡 | ✅ | ✅ | ✅ |
| B3 | 批量导入 | `/input/bulk-import` | BulkImportPanel | 🟡 | ❌ | 🟡 | ✅ | ✅ |
| B4 | 热门板块 | `/input/hot-sectors` | HotSectorPanel | 🟡 | 🟡 | 🟡 | ✅ | ✅ |
| B5 | 本地知识库 | `/input/local-knowledge` | LocalKnowledgePage | ✅ | ✅ | ✅ | ✅ | ✅ |
| B6 | 采集测试 | `/input/data-test` | DataTestPanel | 🟡 | ✅ | 🟡 | ✅ | ✅ |
| B7 | 七维采集配置 | `/input/seven-dim` | SevenDimConfigPage | ✅ | ✅ | ❌ | 🟡 | ✅ |
| B8 | 抓取引擎配置 | `/input/fetcher-config` | FetcherConfigPage | ✅ | ❌ | ❌ | ❌ | ✅ |
| B9 | 采集任务监控 | `/input/collect-tasks` | CollectTaskPage | ✅ | ❌ | ❌ | ❌ | ✅ |

**统计**: 0 个全绿 / 4 个有轻微问题 / 5 个有重大缺失

---

## L5 集成层 — 路由注册（合并评估）

**文件**: `src/config/routes.ts`

9 条路由全部在 `ROUTE_REGISTRY` 中注册，category 均为 `'input'`，component 均指向 `PortalShell`：

| 路由 | 行号 | 描述 | 状态 |
|------|------|------|------|
| `/input/hub` | L49 | 输入舱 - 模块首页 | ✅ 已注册 |
| `/input` | L55 | 输入舱 | ✅ 已注册 |
| `/input/bulk-import` | L61 | 输入舱 - 批量导入 | ✅ 已注册 |
| `/input/hot-sectors` | L67 | 输入舱 - 热门板块 | ✅ 已注册 |
| `/input/data-test` | L73 | 输入舱 - 采集测试 | ✅ 已注册 |
| `/input/local-knowledge` | L301 | 本地知识库 | ✅ 已注册 |
| `/input/seven-dim` | L307 | 七维采集策略配置 | ✅ 已注册 |
| `/input/fetcher-config` | L313 | 抓取引擎配置 | ✅ 已注册 |
| `/input/collect-tasks` | L319 | 采集任务监控 | ✅ 已注册 |

**文件**: `src/apps/input/InputApp.tsx`

子路由分发逻辑完整，使用 `useLocation().pathname` + 条件渲染（非嵌套 `<Routes>`），覆盖全部 8 个子路由分支 + 1 个默认分支。3 个懒加载页面（SevenDimConfigPage / FetcherConfigPage / CollectTaskPage）均有 `<Suspense fallback>` 包裹。

**发现**:
- `/input/hub` 路由已注册，但 **不存在** `InputHubPage.tsx` 组件。InputApp 中无 `/input/hub` 的显式分支，该路径落入默认分支渲染 `InputDashboard`。功能上等价于 `/input`，但语义上 `/input/hub` 应有独立的模块首页。
- `ROUTE_WHITELIST` 通过 `ROUTE_REGISTRY` 自动派生，9 条路由的白名单自动生效。

**L5 判定: ✅** — 全部 9 条路由已注册，子路由分发逻辑完整。

---

## B1 — 输入舱模块首页 (`/input/hub`)

> B1 与 B2 共享同一组件 `InputDashboard`（`/input/hub` 落入 InputApp 默认分支）。

### 审计结果

| 层级 | 状态 | 发现 |
|------|------|------|
| L1 | 🟡 | InputDashboard 有 loading 状态（来自 poolStore.loading，按钮显示"刷新中..."）；有 error 展示（`message \|\| error` 区域）；但**无显式 empty 状态**——当 stocks 为空时，PoolBoard 渲染空看板，无引导提示（如"暂无标的，请录入股票"） |
| L2 | 🟡 | `inputHubStore` 存在且完整（state: activeModule/loading/searchResults/isAddingStock; actions: searchStocks/addStockFromSearch/reset），但 **InputDashboard 主体未使用 inputHubStore**，而是直接使用 `poolStore` + 本地 `useState`。`inputHubStore` 仅被 `StockSearch` 子组件间接消费（搜索+录入模式）。`poolStore` 是股票池数据的唯一可信源，架构合理 |
| L3 | ✅ | `inputService.addStock()` 通过 `DataBridge.forward()` 写入，信封 action=`insertStock`/`updateStock`，映射到 `STORE_NAME.stocks`。`StockSearch` 组件通过 `inputHubStore.addStockFromSearch` 间接走 DataBridge 链路。`poolStore.refresh()` 通过 `dataLayer.stocks.list()` 读取数据。DataBridge 端点 `ACTION_TO_STORE_MAP` 中 `insertStock`/`updateStock`/`deleteStock` 全部映射到 `stocks` store |
| L4 | ✅ | 录入校验：symbol 不能为空、name 不能为空；自动检测交易所（SH/SZ）；支持录入后自动拉取基础数据/K线数据；支持分组指定；状态流转经 `poolTransitionEngine` 校验；批量流转/归档/移组逻辑完整 |
| L5 | ✅ | 路由已注册；被 InputApp 默认分支引用；被其他页面通过导航按钮引用（如"批量导入""热门板块"快捷按钮） |

---

## B2 — 输入舱录入看板 (`/input`)

> 与 B1 完全相同，共享 `InputDashboard` 组件。审计结果同 B1。

| 层级 | 状态 | 发现 |
|------|------|------|
| L1 | 🟡 | 同 B1 |
| L2 | 🟡 | 同 B1 |
| L3 | ✅ | 同 B1 |
| L4 | ✅ | 同 B1 |
| L5 | ✅ | 同 B1 |

---

## B3 — 批量导入 (`/input/bulk-import`)

### 审计结果

| 层级 | 状态 | 发现 |
|------|------|------|
| L1 | 🟡 | 有 loading 处理：按钮显示"导入中..."（`importing` 状态）；有错误展示：`message` 区域 + `importResult.errors` 失败明细列表（红色高亮）；有预览区（`importPreview.length > 0` 时展示表格）；**但无显式 empty 状态**——当 textarea 为空时无引导文案，仅有 placeholder |
| L2 | ❌ | **无专属 Store**。全部状态通过组件内 `useState` 管理（importText / importPreview / importResult / importing / message / targetGroup）。不符合四步编码契约的"先建 Store 再建 UI"原则。跨 Tab 同步能力缺失 |
| L3 | 🟡 | `batchImportService.importStocks()` 内部调用 `inputService.addStock()` → `DataBridge.forward()` 链路完整。但 `parseBulkInput()` 是纯前端解析，不经过 DataBridge。数据能最终流入 `poolStore`（通过 refresh），但 BulkImportPanel 自身无 DataBridge 订阅 |
| L4 | ✅ | 校验逻辑完善（VAL-003 安全增强）：最大行数限制（`INPUT_CONFIG.bulkImport.maxRows`）、单行长度限制（200 字符）、A 股代码格式校验（6 位数字）、股票名称长度限制（50 字符）、BOM 处理、重复检测。解析→预览→确认导入三步流程完整 |
| L5 | ✅ | 路由已注册；被 InputApp 条件分支引用；被 InputDashboard 快捷按钮引用 |

---

## B4 — 热门板块 (`/input/hot-sectors`)

### 审计结果

| 层级 | 状态 | 发现 |
|------|------|------|
| L1 | 🟡 | 有 loading 处理：单个按钮显示"加入中..."/"全部加入中..."；有 message 区域展示操作结果；**但无面板级 loading/error 状态**——板块数据来自同步函数 `getHotSectors()`，无异步加载过程。**无 empty 状态处理**——若 `hotSectors` 为空数组，页面将只显示空白卡片标题 |
| L2 | 🟡 | `hotSectorStore` 存在且完整（state: scores/loading/error/isRefreshing/lastUpdated; actions: fetchScores/setScores/refreshScore/reset/clearScores），但 **HotSectorPanel 未使用 hotSectorStore**。HotSectorPanel 使用 `hotSectorService` 的静态数据（`getHotSectors()`）+ 本地 `useState`。`hotSectorStore` 仅被分析舱的 `HotSectorPage.tsx` 使用。输入舱的 HotSectorPanel 与 hotSectorStore 之间存在**状态层断裂** |
| L3 | 🟡 | `hotSectorService.addHotSectorStock()` 内部调用 `inputService.addStock()` → DataBridge 链路完整。但 HotSectorPanel 未订阅 `hotSectorStore` 的 DataBridge 频道（`hot_sector_scores`），导致分析舱的评分结果无法自动同步到输入舱的热门板块面板 |
| L4 | ✅ | 板块推荐逻辑：4 个预设板块（半导体/AI/新能源/大消费），每个板块含 4 维因子评分（动量/资金/估值/情绪）；支持单个/批量加入候选池；已有标的自动禁用按钮；目标分组选择 |
| L5 | ✅ | 路由已注册；被 InputApp 条件分支引用；被 InputDashboard 快捷按钮引用 |

---

## B5 — 本地知识库 (`/input/local-knowledge`)

### 审计结果

| 层级 | 状态 | 发现 |
|------|------|------|
| L1 | ✅ | **三态处理完整**。Loading: `loading` 状态控制按钮 disabled 属性；Error: `error` 变化自动触发 toast 弹出（variant='error'）；Empty: 浏览 Tab 展示"暂无文档，点击'导入示例数据'进行测试"，搜索 Tab 展示"未找到匹配的文档"/"输入关键词后点击搜索"。另有 `message` 区域用于操作反馈（如"扫描完成，发现 N 个文件"） |
| L2 | ✅ | `localKnowledgeStore` 完整：state（activeTab / docs / symbolFilter / keyword / searchResults / message / loading / error）；actions（setActiveTab / loadDocs / searchDocs / scanFolder / importSampleDocs / setSymbolFilter / setKeyword / setMessage / clearMessage）。三 Tab 状态管理（browse/search/stats）。含 `message` 自动清除定时器（durationMs 参数） |
| L3 | ✅ | Store 通过 `localDocService`（listLocalDocs / searchLocalDocs / createLocalDoc / scanFolder）操作数据。`localDocService` 内部使用 `dataLayer` 和 `dataBridge`。DataBridge 订阅已建立：`dataBridge.subscribe('local_docs', ...)` 监听 `ENVELOPE_ACTION.saveLocalDocs`。`ACTION_TO_STORE_MAP` 中 `saveLocalDocs` → `STORE_NAME.localDocs` 映射完整。含 `initLocalKnowledgeStoreSubscriptions()` / `destroyLocalKnowledgeStoreSubscriptions()` 生命周期管理 |
| L4 | ✅ | 文档浏览：支持按股票代码筛选（symbolFilter），自动加载（useEffect 监听）；文档搜索：关键词搜索（支持文档内容/股票代码/标签）；统计面板：文档总数/涉及股票数/分类分布（6 类）；文件夹扫描：File System Access API（带降级提示）；示例数据导入：3 条预设文档逐条导入 + 失败计数 |
| L5 | ✅ | 路由已注册；被 InputApp 条件分支直接引用（非懒加载）；面包屑导航完整（首页→输入舱→本地知识库） |

---

## B6 — 采集测试 (`/input/data-test`)

### 审计结果

| 层级 | 状态 | 发现 |
|------|------|------|
| L1 | 🟡 | 有 loading 处理：健康检查按钮显示"检查中..."；单接口测试按钮在运行时 disabled；批量采集有进度条（`progress%`）+ 按钮显示"采集中..."；有结果展示：单接口 JSON 结果区、批量任务表格（状态 Badge + 结果消息）；**但无显式 empty 状态**——初始时 health=null 显示"未检查" Badge，singleStatus='idle' 时无提示，tasks 为空时表格不渲染（隐式 empty）；**无 error 状态独立展示**——错误信息嵌入在 singleResult JSON 中 |
| L2 | ✅ | `dataTestStore` 完整：state（health / checking / singleSymbol / singleResult / singleStatus / batchText / tasks / batchRunning / progress）；actions（setHealth / setChecking / setSingleSymbol / setSingleResult / setSingleStatus / setBatchText / setTasks / updateTask / setBatchRunning / setProgress / reset）；异步操作（checkHealth / runSingleTest / runBatchTest）。使用 `withBroadcast(EVENT_NAMES.DATA_TEST_CHANGED, ...)` 实现跨 Tab 广播 |
| L3 | 🟡 | Store 直接调用 `fetcherService`（checkFetcherHealth / fetchStockBasic / fetchStockKline），**不经过 DataBridge**。fetcherService 是服务层直接调用，数据结果仅存储在 Store 的 state 中（singleResult / tasks），**不持久化到 IndexedDB**。这意味着测试结果在页面刷新后丢失。无 DataBridge 订阅 |
| L4 | ✅ | 健康检查：调用 fetcherService.checkFetcherHealth()；单接口测试：支持 basic/kline 两个维度，symbol 自动 trim+toUpperCase；批量采集：解析多行文本（支持换行/逗号/分号/中文顿号分隔）→ 逐只采集（basic+kline 串联）→ 实时更新任务状态和进度 → 错误隔离（单只失败不影响后续） |
| L5 | ✅ | 路由已注册；被 InputApp 条件分支引用 |

---

## B7 — 七维采集配置 (`/input/seven-dim`)

### 审计结果

| 层级 | 状态 | 发现 |
|------|------|------|
| L1 | ✅ | **三态处理完整**。Loading: 无独立 loading 状态，但通过 `isSaving`/`isCollecting` 控制按钮文案（"保存中..."/"采集中..."）+ 页面守卫（`isClickable()` 返回 false 时全部控件 disabled）；Error: `error` 展示为独立红色卡片（带"关闭"按钮调用 `clearError`）；Empty: 不适用（配置页始终有默认值展示）。外层包裹 `ErrorBoundary`。采集进度通过 `Progress` 组件展示 |
| L2 | ✅ | `sevenDimConfigStore` 完整：state（activeTemplate / dimensions / symbolCount / historyDays / isDirty / isSaving / isCollecting / collectProgress / error）；派生计算（enabledCount / monthlyCallEstimate / isClickable / tooltipText）；actions（applyTemplate / toggleDimension / setDimensionFrequency / setDimensionSources / setSymbolCount / setHistoryDays / reset / saveConfig / runCollection / clearError）。配置数据来自 `collectConfig.ts`（DEFAULT_DIMENSIONS / STRATEGY_TEMPLATES / GLOBAL_LIMITS） |
| L3 | ❌ | **DataBridge 未接入**。`saveConfig()` 内有 TODO 注释：`// TODO: 调用 DataBridge.forward() 持久化配置到 IndexedDB`，当前使用 `await new Promise(resolve => setTimeout(resolve, 300))` 模拟延迟。`runCollection()` 内有 TODO：`// TODO: 调用 fetcherService 执行实际采集`，当前使用模拟进度（0→100，每步 100ms）。**配置无法持久化，采集为纯模拟** |
| L4 | 🟡 | 配置逻辑完整：5 策略模板切换（价值/成长/防御/周期/全维度）→ 自动生成维度配置；8 维度独立开关/频率/数据源配置；全局参数（标的数 1-maxSymbols 夹紧 / 历史天数 1-1000 夹紧）；额度预估（月调用总量 / 日调用上限 / 额度使用率百分比 + 进度条）。**但 saveConfig 和 runCollection 为桩实现**，不执行实际业务逻辑 |
| L5 | ✅ | 路由已注册；被 InputApp 懒加载分支引用（`React.lazy` + `Suspense`）；面包屑导航完整 |

---

## B8 — 抓取引擎配置 (`/input/fetcher-config`)

### 审计结果

| 层级 | 状态 | 发现 |
|------|------|------|
| L1 | ✅ | **三态处理完整**。Loading: `isLoading` 状态控制，所有面板区域使用 `<Skeleton>` 骨架屏占位（数据源列表 5 行 / 维度配置 6 行 / 日志 5 行）；Error: try-catch 包裹加载逻辑（虽然 Mock 模式下不会触发）；Empty: 使用 `<EmptyState>` 组件（"暂无数据源"/"暂无日志"）。连通性测试有三态（idle→testing→done），idle 时展示 EmptyState + 图标引导。外层包裹 `ErrorBoundary` |
| L2 | ❌ | **无专属 Store**。全部状态通过组件内 `useState` 管理（isLoading / testState / testResults / logs）。配置数据来自 `fetcherConfig.ts` 的纯函数调用（getDefaultFetcherConfig / getDefaultFetcherDimensions / getDefaultFetcherGlobalConfig）。Mock 数据源和日志均为组件内硬编码常量。跨 Tab 同步能力缺失 |
| L3 | ❌ | **无 DataBridge 接入**。页面展示的配置数据来自 `src/config/fetcherConfig.ts`（静态配置），不读取 IndexedDB。连通性测试为 `setTimeout` 模拟（800ms 延迟），不实际请求数据源。日志为硬编码 Mock 数据。**无任何数据持久化或跨模块数据流** |
| L4 | ❌ | 全部为 Mock 展示：连通性测试结果为预设逻辑（网易失败，其余成功）；日志为静态数据；维度配置来自 `fetcherConfig.ts` 默认值，不可编辑。无真实的配置保存、数据源管理、连通性检测能力 |
| L5 | ✅ | 路由已注册；被 InputApp 懒加载分支引用（`React.lazy` + `Suspense`）；面包屑导航完整 |

---

## B9 — 采集任务监控 (`/input/collect-tasks`)

### 审计结果

| 层级 | 状态 | 发现 |
|------|------|------|
| L1 | ✅ | **三态处理完整**。Loading: `isLoading` 状态控制，三个 Tab 内容区域均使用 `<Skeleton>` 骨架屏（任务列表 5 行 / 评分卡片 8 个 / 日志 6 行）；Error: try-catch 包裹加载逻辑；Empty: 使用 `<EmptyState>` 组件（"暂无采集任务"含跳转按钮 / "暂无评分数据" / "暂无日志"）。外层包裹 `ErrorBoundary` |
| L2 | ❌ | **无专属 Store**。全部状态通过组件内 `useState` 管理（isLoading / tasks / healthCards / logs）。所有数据均为组件内硬编码 Mock 常量（MOCK_TASKS / MOCK_HEALTH / MOCK_LOGS）。跨 Tab 同步能力缺失 |
| L3 | ❌ | **无 DataBridge 接入**。页面展示的任务/健康度/日志全部为 Mock 数据，不读取 IndexedDB，不订阅任何 DataBridge 频道。"刷新"按钮无实际功能（仅 UI 展示） |
| L4 | ❌ | 全部为 Mock 展示：5 条预设任务（success/running/pending/failed 各状态）；8 个维度健康度卡片（healthy/warning/critical 各状态）；7 条预设日志。"详情"和"重试"按钮无实际功能。`formatDuration()` 工具函数正确实现了毫秒/秒格式转换 |
| L5 | ✅ | 路由已注册；被 InputApp 懒加载分支引用（`React.lazy` + `Suspense`）；面包屑导航完整 |

---

## 关键发现汇总

### P0 — 阻塞级（影响数据流完整性）

| 编号 | 入口 | 层级 | 问题描述 |
|------|------|------|----------|
| P0-1 | B7 | L3 | `saveConfig()` 为桩实现，配置无法持久化到 IndexedDB。用户配置在页面刷新后丢失 |
| P0-2 | B7 | L3 | `runCollection()` 为桩实现，采集为纯模拟（setTimeout 进度条），不实际调用 fetcherService |
| P0-3 | B8 | L2-L4 | FetcherConfigPage 无 Store、无 DataBridge、无真实逻辑。全页面为 Mock 展示 |
| P0-4 | B9 | L2-L4 | CollectTaskPage 无 Store、无 DataBridge、无真实逻辑。全页面为 Mock 展示 |

### P1 — 严重级（影响架构一致性）

| 编号 | 入口 | 层级 | 问题描述 |
|------|------|------|----------|
| P1-1 | B1/B2 | L2 | `inputHubStore` 存在但 InputDashboard 主体未使用，仅被 StockSearch 子组件间接消费。Store 的 `activeModule` / `loading` 等字段未被页面消费 |
| P1-2 | B4 | L2 | `hotSectorStore` 存在但 HotSectorPanel 未使用，转而使用 hotSectorService 静态数据 + 本地 useState。分析舱的 HotSectorPage 才使用 hotSectorStore，输入舱与分析舱状态层断裂 |
| P1-3 | B3 | L2 | BulkImportPanel 无专属 Store，违反四步编码契约（先建 Store 再建 UI）。跨 Tab 同步能力缺失 |
| P1-4 | B6 | L3 | dataTestStore 直接调用 fetcherService，不经过 DataBridge。测试结果不持久化，页面刷新后丢失 |

### P2 — 优化级

| 编号 | 入口 | 层级 | 问题描述 |
|------|------|------|----------|
| P2-1 | B1 | L5 | `/input/hub` 路由已注册但无独立 InputHubPage 组件，落入默认分支渲染 InputDashboard，与 `/input` 功能完全重复 |
| P2-2 | B1/B2 | L1 | InputDashboard 无显式 empty 状态——stocks 为空时 PoolBoard 渲染空看板，缺少引导提示 |
| P2-3 | B3 | L1 | BulkImportPanel 无显式 empty 状态引导 |
| P2-4 | B4 | L1 | HotSectorPanel 无面板级 loading/error 状态，无 hotSectors 为空时的 empty 处理 |
| P2-5 | B6 | L1 | DataTestPanel 无显式 empty 状态和独立 error 展示区域 |

---

## 数据流拓扑图

```
路由 → PortalShell → InputApp → 页面组件 → Store → Service → DataBridge → IndexedDB

B1/B2: /input/hub, /input → InputDashboard → poolStore(✅) → inputService → DataBridge(✅) → stocks
                                      ↘ StockSearch → inputHubStore(✅) → inputService → DataBridge(✅)

B3: /input/bulk-import → BulkImportPanel → useState(❌) → batchImportService → inputService → DataBridge(✅)

B4: /input/hot-sectors → HotSectorPanel → useState(❌) → hotSectorService → inputService → DataBridge(✅)
                                ↕ (未连接)
                          hotSectorStore(存在但未使用)

B5: /input/local-knowledge → LocalKnowledgePage → localKnowledgeStore(✅) → localDocService → DataBridge(✅) → local_docs

B6: /input/data-test → DataTestPanel → dataTestStore(✅) → fetcherService(直连，不经过 DataBridge)

B7: /input/seven-dim → SevenDimConfigPage → sevenDimConfigStore(✅) → saveConfig(❌桩) / runCollection(❌桩)

B8: /input/fetcher-config → FetcherConfigPage → useState(❌) → fetcherConfig.ts(静态配置，Mock)

B9: /input/collect-tasks → CollectTaskPage → useState(❌) → Mock 硬编码数据
```

---

## 审计结论

输入舱 9 个入口的 **L5 路由注册全部达标**，`ROUTE_REGISTRY` 和 `InputApp` 子路由分发逻辑完整无遗漏。

**核心问题集中在 L2-L4 层**：

1. **B5（本地知识库）是全链路最完善的入口**，五层全部达标，可作为其他入口的参考模板。
2. **B7/B8/B9 三个新建页面（标记"V9 新建"/"D-1 框架"/"D-2 框架"）处于 Mock/桩实现阶段**，L2-L4 存在系统性缺失。其中 B8 和 B9 完全没有 Store 和 DataBridge 接入，B7 的 saveConfig 和 runCollection 为 TODO 桩代码。
3. **B1/B2/B4 存在"Store 已建但页面未用"的断裂问题**——inputHubStore 和 hotSectorStore 各自有完整的 state/actions/DataBridge 订阅，但对应的页面组件绕过了 Store 直接使用本地状态。
4. **B3/B6 的 Service 层链路基本完整**，但 B3 缺少 Store 抽象，B6 的测试结果不经过 DataBridge 持久化。

**建议修复优先级**: P0-1/P0-2（B7 DataBridge 接入）> P0-3/P0-4（B8/B9 Store 创建与 DataBridge 接入）> P1-1/P1-2（B1/B4 Store 连接恢复）> P1-3（B3 Store 创建）> P2 级 UI 优化。
