# 6 个 Disabled MCP Server 深度复盘报告

> **审计日期**: 2026-07-20  
> **审计对象**: `backtest`, `export`, `input`, `screening`, `stockpool`, `trade`  
> **审计范围**: 源码实现、Service 依赖、业务调用链、设计意图对齐  
> **报告存放**: `docs/06-project-management/mcp-disabled-server-deep-dive.md`

---

## 执行摘要

| Server | 源码状态 | Service 层 | 业务调用 | 设计意图达成度 | 核心根因 | 建议 |
|--------|---------|-----------|---------|--------------|---------|------|
| backtest | ✅ 完整 | ✅ 存在 | 0（ACL矩阵+测试引用） | ⚠️ 部分 | 参数复杂，MCP 薄包装无人需要 | ✅ 保留（Agent 编排用） |
| export | ✅ 完整 | ✅ 存在 | 0 | ❌ 未达成 | 依赖 backtest（已 disabled）；无 MCP 调用入口 | ⚠️ 降级为 service 函数 |
| input | ✅ 完整 | ✅ 活跃使用 | 0（Service 层被多处调用） | ❌ 未达成 | UI 直接走 Service，MCP 薄包装无人需要 | ⚠️ 合入 fetcher:data |
| screening | ✅ 完整 | ✅ 存在 | 0（UI 直接调 engine） | ⚠️ 部分 | UI 有完整交互组件，MCP 无人走 | ✅ 保留（Agent 编排用） |
| stockpool | ✅ 完整 | ✅ 活跃使用 | 0（Service 层被多处调用） | ⚠️ 部分 | UI 直接走 Service，MCP 薄包装无人需要 | ✅ 保留（Agent 内省工具） |
| trade | ✅ 完整 | ✅ 存在 | 0 | ❌ 未达成 | 与 trading:main 功能重叠，边界不清 | ⚠️ 合入 trading:main |

> **关键洞察**: 6 个 Server 中有 4 个（input/screening/stockpool/backtest）的 Service 层实际上被业务代码活跃使用，但**全部被 UI 旁路**——UI 直接调用 Service/Store，不走 MCP 层。这是 V9 项目 MCP 架构的系统性问题：**MCP 是"薄包装"，有 Service 直连路径时无人需要**。

---

## 一、backtest — 回测引擎

### 1.1 设计意图验证

**原始设计意图**：
- 作为 Agent 编排能力的组成部分，提供策略回测、绩效分析、风险指标计算
- 支持通过 MCP 参数化配置（symbol, startDate, endDate, strategy, initialCapital）
- 依赖 fetcher 获取行情数据，依赖 scoring:v6 获取评分数据

**实际表现**：
- `BacktestEngine` Service 完整存在，`src/services/backtest/BacktestEngine.ts` 已实现
- `BacktestServer` 的 `run_backtest` Tool 参数定义清晰，支持 4 个配置字段
- `run_backtest` 在 `mcpAclMatrix.ts` 和单元测试中有引用，但**无业务代码直接调用**
- 在 `analysisTemplatesConfig.ts` 中被列为分析模板之一，但模板本身仅配置，不触发实际调用

**设计意图达成度**: ⚠️ **部分达成** — 引擎核心资产完整，但 MCP 包装层交付即闲置。

### 1.2 偏差原因排查

**根因：MCP 是"薄包装"，但回测参数不适合 schema 化表达**

具体表现：
1. **参数复杂度**: `run_backtest` 需要 symbol + startDate + endDate + strategy + initialCapital。虽然 schema 可以定义，但回测的真正复杂度在于策略规则（MA 交叉、评分阈值、止损条件等），这些规则无法通过 5 个简单参数表达。
2. **UI 路径缺失**: 没有页面或组件通过 `mcpBridge.callTool('backtest', 'run_backtest', ...)` 发起回测。现有的分析页面（`AnalysisApp.tsx`）直接调用 `analysisService` 和 `scoringEngine`，不经过 MCP。
3. **Agent 编排未接入**: `agentComponentRegistry.ts` 中没有注册回测 Agent，Agent 运行时不会自动调用 `run_backtest`。

**责任归属**: 技术方案缺陷（将复杂引擎强行 MCP 化）+ 资源限制（未建设回测 UI 页面）。

### 1.3 当前卡点定位

| 卡点 | 优先级 | 说明 |
|------|--------|------|
| 无回测触发页面 | P1 | 缺少回测配置页面，用户无法通过 UI 发起回测 |
| 策略参数难以 MCP 化 | P1 | 复杂策略规则（如"MA20 上穿 MA60 且 V6 评分 > 4.0"）无法通过简单 JSON schema 表达 |
| Agent 未注册 | P2 | 未在 `agentComponentRegistry.ts` 中注册回测 Agent |
| 依赖 scoring:v6 未就绪 | P2 | 虽然 scoring:v6 已 enabled，但 backtest 本身未启用，无法形成调用链 |

### 1.4 遗漏项识别

- **边界场景**: 未考虑回测结果的可视化展示（收益曲线、回撤图、交易明细表）。当前 `run_backtest` 返回纯 JSON 文本，无配套 UI 组件消费。
- **性能影响**: `BacktestEngine` 每次调用都 `new BacktestEngine()` 实例，无缓存或状态复用。高频回测可能导致 GC 压力。
- **兼容性**: `strategy` 字段使用 `as BacktestStrategy` 强制类型转换，若传入非法策略名会运行时错误，但 schema 中未限制 enum 值。
- **异常处理**: handler 中未捕获 `engine.run()` 的异常，若引擎抛出错误会直接向上传播，可能导致 MCP 通道崩溃。

### 1.5 复盘与提炼

| 5W1H | 内容 |
|------|------|
| **What** | 回测引擎 MCP 化后交付即闲置，Tool 零业务调用 |
| **Why** | 复杂策略参数不适合 MCP schema 表达；缺少回测 UI 页面；Agent 未注册 |
| **Where** | `src/mcp/servers/backtest/backtestServer.ts` / `src/services/backtest/BacktestEngine.ts` |
| **When** | Phase 1 MCP 核心业务 Server 迁移（2026-07-04）引入 |
| **Who** | 架构决策 + 前端开发 |
| **How** | 保留引擎（核心资产），但 disabled MCP 包装层；待建设回测页面和 Agent 后再恢复 |

**经验教训**：
1. **复杂引擎不适合 MCP 薄包装**: 回测引擎的参数复杂度远超 MCP 适合处理的范畴。此类引擎应作为 Service 直接暴露给 UI，或设计专门的 DSL 配置界面。
2. **MCP 化前必须确认调用方**: 在将引擎包装为 MCP Server 之前，必须确认至少有一个调用方（UI 页面、Agent、或定时任务）会通过 MCP 调用它。否则就是"为 MCP 而 MCP"。
3. **核心资产与包装层分离**: `BacktestEngine` 是核心资产，应始终保留；`BacktestServer` 是包装层，可以按需启停。这种分离是正确的，但应在文档中明确区分。

---

## 二、export — 数据导出

### 2.1 设计意图验证

**原始设计意图**：
- 导出回测报告为 PDF 或 Excel 格式
- 依赖 backtest 结果，接收 `BacktestResult` + `BacktestConfig` 生成报告
- 早期设计通过 `backtestStore.getBacktestById()` 查询结果，后改为方案 B（直接传入 result/config）

**实际表现**：
- `backtestExportService.ts` 存在，`exportBacktestReport` 函数已实现
- `ExportServer` 的 `export_backtest_report` Tool 定义完整，注释说明已解除 store 依赖
- **零业务调用**：无任何页面、Agent、或组件调用此 Tool
- 在 `mcpAclInterceptor.test.ts` 和 `exportServer.test.ts` 中有测试覆盖

**设计意图达成度**: ❌ **未达成** — 从未真正可用。

### 2.2 偏差原因排查

**根因：依赖未就绪 + 无调用入口，双重阻塞**

1. **P0 阻塞（已解除）**: 原始设计依赖 `backtestStore.getBacktestById()`，但该 API 未实现。2026-07-13 方案 B 改为直接收 result/config，解除了跨层违规。但解除后仍无人调用。
2. **上游依赖 disabled**: `backtest` Server 本身已 disabled，即使 export 恢复，也没有回测结果可以导出。
3. **UI 无导出入口**: 没有页面或按钮触发 `export_backtest_report`。交易复盘页面（`TradeReviewPage.tsx`）展示的是交易记录，不是回测报告。
4. **报告生成与 MCP 无关**: 导出报告是**纯输出型操作**，不需要 MCP 的"请求-响应"模式。UI 可以直接调用 `exportBacktestReport(result, config, {format: 'pdf'})`，不需要经过 MCP 层。

**责任归属**: 需求理解偏差（将纯输出操作强行 MCP 化）+ 技术阻塞（backtest 未就绪）。

### 2.3 当前卡点定位

| 卡点 | 优先级 | 说明 |
|------|--------|------|
| 上游 backtest 未启用 | P0 | 没有回测结果，export 无数据可导出 |
| 无 UI 导出入口 | P0 | 没有任何页面提供"导出回测报告"按钮 |
| 报告生成不需要 MCP | P1 | 导出是纯副作用操作，MCP 层增加无意义延迟 |

### 2.4 遗漏项识别

- **边界场景**: 未考虑大报告的分片导出。若回测结果包含数万条交易记录，JSON → PDF/Excel 可能内存溢出。
- **异常处理**: `exportBacktestReport` 的异常处理未在 handler 中捕获，若导出失败会返回 `isError: undefined`（未设置）。
- **格式扩展**: 仅支持 pdf/excel，未考虑 csv/html/markdown 等轻量格式。
- **国际化**: 报告中的中文标题和描述未接入 i18n 系统。

### 2.5 复盘与提炼

| 5W1H | 内容 |
|------|------|
| **What** | Export MCP Server 从未被调用，P0 阻塞解除后仍无使用场景 |
| **Why** | 纯输出操作不需要 MCP 包装；上游 backtest 未就绪；无 UI 入口 |
| **Where** | `src/mcp/servers/export/exportServer.ts` / `src/services/export/backtestExportService.ts` |
| **When** | 2026-07-05 创建，2026-07-13 方案 B 解除 P0 阻塞 |
| **Who** | 架构决策 |
| **How** | 降级为 Service 函数，移除 MCP 包装层；待 backtest 恢复后，UI 直接调用 export service |

**经验教训**：
1. **纯输出操作不应 MCP 化**: 导出、下载、打印等纯副作用操作不需要 MCP 的"工具调用"抽象。MCP 适合"查询-计算-决策"型交互，不适合"生成-下载"型操作。
2. **P0 阻塞解除 ≠ 功能可用**: 解除技术阻塞后，必须验证是否有真实的业务调用链。export 是典型例子：P0 解除后，发现根本无人需要调用它。
3. **依赖倒置检查**: 在 design 阶段应检查"谁依赖谁"。export 依赖 backtest，但 backtest 本身未就绪。这种"依赖链断裂"应在设计评审时发现。

---

## 三、input — 数据录入

### 3.1 设计意图验证

**原始设计意图**：
- 提供股票添加、搜索、股票池导入导出的 MCP 工具
- 作为 fetcher 的补充，处理"数据录入"这一独立子域
- 6 个 Tool：add_stock, search_stocks, add_stock_from_search, list_input_stocks, export_stock_pool, import_stock_pool

**实际表现**：
- `inputService.ts` 被**多处业务代码活跃使用**：
  - `InputDashboard.tsx` 直接调用 `addStock`
  - `batchImportExecutor.ts` 直接调用 `addStock`
  - `hotSectorService.ts` 直接调用 `addStock`
  - `StockSearch.tsx` 通过 `useInputHubStore` 调用 `addStockFromSearch`
- **但全部直接调用 Service，不走 MCP**。`InputServer` 的 6 个 Tool 零业务引用。

**设计意图达成度**: ❌ **未达成** — Service 层被活跃使用，但 MCP 层完全闲置。

### 3.2 偏差原因排查

**根因：input 的 6 个工具与 fetcher 天然配合，UI 直接走 Service/Store**

1. **UI 组件直接绑定 Service**: `InputDashboard.tsx` 第 51 行直接 `import { addStock } from '@/services/input/inputService'`，没有任何 MCP 调用。
2. **Store 封装**: `useInputHubStore` 封装了 `addStockFromSearch`，组件通过 Store 而非 MCP 获取数据。
3. **MCP 是"薄包装"**: `InputServer.add_stock` 的 handler 就是 `await addStock({symbol, name})`，没有任何额外逻辑。UI 直接调用 Service 更直接、更快。
4. **自然合并趋势**: input 的添加/搜索功能与 fetcher 的数据获取功能天然配合。在 UI 层面，用户"搜索股票 → 添加股票"的流程由 `StockSearch` 组件 + `InputHubStore` 完成，不需要经过 MCP 层。

**责任归属**: 架构设计问题（input 作为独立 MCP Server 的必要性未充分论证）+ 前端开发习惯（直接调用 Service）。

### 3.3 当前卡点定位

| 卡点 | 优先级 | 说明 |
|------|--------|------|
| UI 组件已绑定 Service | P0 | InputDashboard、StockSearch 等组件直接 import Service，改造成 MCP 调用需大面积重构 |
| 与 fetcher 功能重叠 | P1 | input 的 search_stocks 与 fetcher 的 fetch_stock_basic 功能重叠 |
| 无 Agent 注册 | P2 | 未在 `agentComponentRegistry.ts` 中注册 input Agent |

### 3.4 遗漏项识别

- **批量导入边界**: `import_stock_pool` 的 handler 中 `args.payload as never` 是类型安全漏洞。未校验 payload 结构，恶意数据可能导致导入失败或数据污染。
- **事务一致性**: `add_stock` 先添加股票到股票池，然后异步拉取基础数据（`fetchStockBasic`）。若拉取失败，股票已在池中但数据不完整，形成"脏数据"。
- **重复添加**: `addStock` 未检查 symbol 是否已存在，重复添加可能导致唯一键冲突（取决于底层 DB schema）。
- **权限控制**: 未区分"录入权限"和"查看权限"。任何调用方都可以 export/import 股票池。

### 3.5 复盘与提炼

| 5W1H | 内容 |
|------|------|
| **What** | Input MCP Server 的 6 个 Tool 零业务调用，但 Service 层被活跃使用 |
| **Why** | UI 直接走 Service/Store，MCP 薄包装无人需要；input 与 fetcher 功能重叠 |
| **Where** | `src/mcp/servers/input/inputServer.ts` / `src/services/input/inputService.ts` |
| **When** | 2026-07-05 创建 |
| **Who** | 前端开发习惯 + 架构设计 |
| **How** | 合入 fetcher:data；保留 Service 层；inputServer 作为独立 Server 无必要 |

**经验教训**：
1. **"薄包装"Server 是反模式**: 如果 MCP Server 的 handler 只是简单转发到 Service 函数，那这个 Server 就是"薄包装"。在已有 Service 直连路径时，薄包装 Server 永远不会被使用。
2. **功能重叠检查**: 在新建 Server 前，必须检查现有 Server 是否已覆盖相似功能。input 的 `search_stocks` 与 fetcher 的 `fetch_stock_basic` 功能重叠，应合并而非拆分。
3. **Store 优先 vs MCP 优先**: 前端组件倾向于通过 Store 获取数据，而非通过 MCP 调用。若设计目标是"前端通过 MCP 调用"，必须在组件层面强制约束（如通过 lint 规则禁止直接 import Service）。

---

## 四、screening — 多因子筛选

### 4.1 设计意图验证

**原始设计意图**：
- 提供多因子筛选的 MCP 工具：全量筛选（`run_screening`）和单股评估（`screen_single`）
- 作为 analysis 的下游能力，接收筛选条件返回符合条件的股票列表
- 支持 Resource 接口：通过 `screening://stock/{symbol}` 和 `screening://all` 获取筛选结果

**实际表现**：
- `screeningEngine.ts` 被 `analysisServer.ts` 引用（`screen_stocks` Tool 内部调用 `runScreening`）
- `MultiFactorFilterPanel.tsx` 直接调用 `screeningEngine`，不通过 MCP
- `ScreeningServer` 的 2 个 Tool 和 2 个 Resource 零业务引用

**设计意图达成度**: ⚠️ **部分达成** — 引擎被 analysis 和 UI 使用，但 MCP 层闲置。

### 4.2 偏差原因排查

**根因：UI 有完整交互组件，直接调用 engine 更高效**

1. **组件直接绑定引擎**: `MultiFactorFilterPanel.tsx` 是完整的筛选 UI，用户在前端直接配置筛选条件并执行。组件通过 `useScreeningStore` 或直接使用 `screeningEngine` 获取结果，无需经过 MCP 层。
2. **分析 Server 已覆盖**: `analysisServer` 的 `screen_stocks` Tool 已经内部调用了 `runScreening()`。如果 Agent 需要筛选能力，它可以通过 `analysis:main` 而非 `screening:main` 获取。
3. **实时性要求**: 筛选操作需要实时响应用户交互（点击"筛选"按钮后 200ms 内返回结果）。MCP 调用增加一次序列化/反序列化 + ACL 校验，延迟不可接受。

**责任归属**: 技术方案缺陷（将实时交互操作 MCP 化）+ 需求理解偏差（未区分"实时筛选"和"批量筛选"场景）。

### 4.3 当前卡点定位

| 卡点 | 优先级 | 说明 |
|------|--------|------|
| 实时性要求与 MCP 延迟冲突 | P0 | 筛选是实时交互，MCP 延迟不可接受 |
| analysis Server 已覆盖 | P1 | Agent 可通过 `analysis.screen_stocks` 获取筛选结果，无需单独 screening Server |
| Resource 接口无消费者 | P2 | `screening://stock/{symbol}` 和 `screening://all` 无任何引用 |

### 4.4 遗漏项识别

- **分页缺失**: `run_screening` 的 `limit` 参数默认 20，但无 offset/page 参数。全量筛选结果可能很大，无法分页展示。
- **条件持久化**: 未提供"保存筛选条件"的功能。用户每次筛选都需重新配置条件。
- **结果排序**: 未提供排序参数（如按评分、按市值、按涨跌幅排序）。
- **缓存策略**: `screening://all` Resource 每次请求都重新计算，无缓存。高频访问可能导致性能问题。

### 4.5 复盘与提炼

| 5W1H | 内容 |
|------|------|
| **What** | Screening MCP Server 闲置，UI 直接调 engine，analysis Server 已覆盖筛选能力 |
| **Why** | 实时筛选操作不适合 MCP 化；analysis Server 已提供 screen_stocks 代理 |
| **Where** | `src/mcp/servers/screening/screeningServer.ts` / `src/components/organisms/analysis/screening/MultiFactorFilterPanel.tsx` |
| **When** | 2026-07-04 创建 |
| **Who** | 架构设计 |
| **How** | 保留 engine（核心资产），disabled MCP 包装层；Agent 通过 analysis Server 获取筛选能力 |

**经验教训**：
1. **实时交互操作不应 MCP 化**: 筛选、过滤、搜索等需要实时响应的操作，应通过 Store/Service 直接处理，不应经过 MCP 层。MCP 适合"异步任务"或"Agent 编排"场景。
2. **能力聚合优于拆分**: screening 的筛选能力已整合到 analysis Server 的 `screen_stocks` 中。这说明"聚合相关能力到同一 Server"比"为每个子能力建独立 Server"更合理。
3. **Resource 接口需确认消费者**: 在定义 Resource 前，必须确认有消费者通过 `readResource` 读取它。screening 的 2 个 Resource 定义完善但零消费者，是过度设计。

---

## 五、stockpool — 股票池管理

### 5.1 设计意图验证

**原始设计意图**：
- 管理股票池中的标的：列出（`list_pool_stocks`）、状态流转（`transition_stock`）、分组管理（`list_groups`）
- 支持研究状态机：`candidate` → `screened` → `deepDive` → `watching` → `archived`
- 提供 Resource 接口：`stockpool://stocks` 和 `stockpool://groups`

**实际表现**：
- `stockpoolService.ts` 被**多处业务代码活跃使用**：
  - `usePoolDataFromStore.ts` 调用 `listStocks`
  - `useStockPoolBoard.ts` 调用 `transitionStock` 和 `updateStockGroup`
  - `screeningEngine.ts` 调用 `transitionStock`
  - `scoreDocStore.ts` 和 `strategySnapshotStore.ts` 调用 `listStocks`
- **但全部直接调用 Service，不走 MCP**。`StockPoolServer` 的 3 个 Tool 和 2 个 Resource 零业务引用（`list_pool_stocks`/`list_groups` 仅在 ACL 矩阵中引用）。

**设计意图达成度**: ⚠️ **部分达成** — Service 层被活跃使用，但 MCP 层闲置。状态流转功能是核心资产。

### 5.2 偏差原因排查

**根因：UI 直接走 Service/Store，MCP 薄包装无人需要（与 input 相同模式）**

1. **Store 封装**: `useStockPoolBoard.ts` 和 `usePoolDataFromStore.ts` 是前端状态管理层，直接调用 `stockpoolService` 获取数据。组件通过 Store 消费数据，无需经过 MCP。
2. **状态流转在 UI 中完成**: `transition_stock` 的研究状态变更由用户在股票池看板中操作（如"移入观察"、"归档"），看板组件直接调用 `transitionStock()` 更新状态。
3. **MCP 是"薄包装"**: `StockPoolServer.list_pool_stocks` 的 handler 就是 `await listStocks()`，无任何额外逻辑。

**责任归属**: 架构设计问题（stockpool 作为独立 MCP Server 的必要性未充分论证）+ 前端开发习惯。

### 5.3 当前卡点定位

| 卡点 | 优先级 | 说明 |
|------|--------|------|
| Store 层已覆盖 | P0 | `useStockPoolBoard.ts`、`usePoolDataFromStore.ts` 已提供完整数据获取能力 |
| 无 Agent 使用 | P1 | 未在 `agentComponentRegistry.ts` 中注册 stockpool Agent |
| transition_stock 零引用 | P2 | 在 MCP 层零引用，但 Service 层被多处使用 |

### 5.4 遗漏项识别

- **状态流转校验缺失**: `transitionStock` 在 Service 层未校验流转是否合法（如 `candidate` → `archived` 是否允许跳过中间状态）。当前仅校验目标状态是否有效，不校验流转路径。
- **并发冲突**: 若两个用户同时操作同一只股票的状态变更，无乐观锁或版本控制，可能导致状态覆盖。
- **分组权限**: `list_groups` 返回所有分组，未按用户权限过滤。若系统后期支持多用户，可能出现数据泄露。
- **历史追溯**: 状态流转无历史记录。无法回答"这只股票什么时候从 candidate 变成 watching 的？"

### 5.5 复盘与提炼

| 5W1H | 内容 |
|------|------|
| **What** | StockPool MCP Server 闲置，但 Service 层被活跃使用；状态流转是核心资产 |
| **Why** | UI 直接走 Service/Store；MCP 薄包装无人需要 |
| **Where** | `src/mcp/servers/stockpool/stockPoolServer.ts` / `src/services/stockpool/stockpoolService.ts` / `src/components/organisms/pool/usePoolDataFromStore.ts` |
| **When** | 2026-07-04 创建 |
| **Who** | 架构设计 + 前端开发 |
| **How** | 保留 Service 层和状态流转能力；disabled MCP 包装层；待 Agent 需要"内省股票池"时恢复 |

**经验教训**：
1. **核心资产与包装层分离是正确的**: `stockpoolService` 是核心资产，应保留；`StockPoolServer` 是包装层，可以按需启停。这验证了 V9 架构"Service 层独立于 MCP 层"的设计。
2. **状态机需校验流转路径**: 研究状态机（candidate → screened → deepDive → watching → archived）不能仅校验目标状态有效，必须校验流转路径是否合法。否则可能出现状态跳跃。
3. **历史记录是遗漏项**: 状态流转应有审计日志（who/when/from/to）。这在合规场景中可能是必需的。

---

## 六、trade — 持仓管理

### 6.1 设计意图验证

**原始设计意图**：
- 提供持仓查询（`fetch_holdings`）、交易操作（`execute_trade_action`）、持仓导出（`export_holdings_csv`）的 MCP 工具
- 依赖 `trading` Server，作为 trading 的下游持仓管理模块
- 封装 `/api/v1/trade/holdings` 接口调用，包含请求超时、重试、错误处理

**实际表现**：
- `holdingsService.ts` 实现完整，包含 fetchHoldings、executeTradeAction、exportHoldingsCSV 三个函数
- 使用 `dataBridge` 和 `EnvelopeFactory` 进行事件转发（可观测性）
- `TradeServer` 的 3 个 Tool 零业务引用
- `trading:main` 已提供 `get_orders`、`create_buy_order`、`create_sell_order` 等订单管理工具，与 trade 的功能重叠

**设计意图达成度**: ❌ **未达成** — 功能与 trading 重叠，边界不清，无人使用。

### 6.2 偏差原因排查

**根因：与 trading:main 功能重叠，d4200a7 合并未彻底整合**

1. **功能重叠矩阵**：

| 功能 | trade Server | trading Server | 重叠度 |
|------|-------------|---------------|--------|
| 持仓查询 | `fetch_holdings` | `get_orders`（订单历史）+ `get_strategy_snapshot`（策略快照含持仓） | 高 |
| 买入 | `execute_trade_action` (buy) | `create_buy_order` | 完全重叠 |
| 卖出 | `execute_trade_action` (sell) | `create_sell_order` | 完全重叠 |
| 导出 | `export_holdings_csv` | 无直接对应 | 低 |

2. **命名混淆**: `trade` 和 `trading` 命名过于相似，开发者难以区分。`trading` 是"交易引擎"（信号+订单+风控），`trade` 是"持仓管理"（查询+操作+导出），但两者都涉及订单操作。
3. **数据模型不一致**: 
   - `trade` 使用 `TradeActionRequest`（`code`, `action`, `quantity`），`action` 为 `ADD_POSITION`/`CLOSE_POSITION`
   - `trading` 使用订单模型（`symbol`, `direction`, `quantity`, `price`, `status`）
   - 两者的字段命名和枚举值不一致，增加理解成本
4. **d4200a7 合并遗留**: 提交 d4200a7 将 trade 的部分功能合并到 trading，但保留了 trade Server 的源码。合并未彻底，导致两个 Server 并存。

**责任归属**: 架构决策（d4200a7 合并不彻底）+ 命名规范缺失。

### 6.3 当前卡点定位

| 卡点 | 优先级 | 说明 |
|------|--------|------|
| 与 trading 功能重叠 | P0 | 买入/卖出/持仓查询功能完全重叠，无法共存 |
| 数据模型不一致 | P1 | TradeActionRequest vs trading 订单模型，字段命名和枚举值不一致 |
| 命名混淆 | P1 | `trade` vs `trading` 难以区分，增加维护成本 |
| 无独立调用方 | P2 | 没有任何页面或 Agent 调用 trade 的 Tool |

### 6.4 遗漏项识别

- **持仓导出是唯一差异**: `export_holdings_csv` 是 trade 独有的功能，trading 无直接对应。但导出功能也应通过 trading 的"报告生成"能力提供，而非独立 Server。
- **API 路径硬编码**: `holdingsService.ts` 中硬编码了 `/api/v1/trade/holdings` 路径。若后端 API 变更，需要修改两处（service 和 constants）。
- **DataBridge 异常吞没**: `fetchHoldings` 中的 `dataBridge.forward()` 使用 `void` + `.catch()` 吞没异常，若 DataBridge 失败不会报错，但事件丢失。
- **CSV 导出无进度反馈**: `exportHoldingsCSV` 是同步操作，大数据量导出时会阻塞 UI 线程。未使用 Web Worker 或分片下载。
- **请求参数丢失**: `fetchHoldings` 的 handler 中，`page`/`pageSize` 被硬编码为 1/50，用户传入的 `page`/`pageSize` 参数被忽略。

### 6.5 复盘与提炼

| 5W1H | 内容 |
|------|------|
| **What** | Trade MCP Server 与 trading:main 功能重叠，3 个 Tool 零业务调用 |
| **Why** | d4200a7 合并不彻底；命名混淆导致边界不清；数据模型不一致 |
| **Where** | `src/mcp/servers/trade/tradeServer.ts` / `src/services/trade/holdingsService.ts` / `src/mcp/servers/trading/tradingServer.ts` |
| **When** | 2026-07-05 创建，d4200a7 合并时未彻底整合 |
| **Who** | 架构决策（合并方案）+ 开发执行 |
| **How** | 合入 trading:main；保留 `export_holdings_csv` 功能并迁移到 trading；移除 trade Server 和 holdingsService |

**经验教训**：
1. **合并必须彻底**: d4200a7 是"部分合并"——保留了 trade Server 源码但 disabled 它。这种"半合并"状态是技术债务的根源。合并时应彻底移除被合并方的源码，或明确标注"待迁移清单"。
2. **命名是架构**: `trade` vs `trading` 的命名混淆导致边界不清。Server 命名应遵循"领域 + 职责"格式，如 `trading-engine`（交易引擎）和 `trading-holdings`（持仓管理），或合并为统一的 `trading`。
3. **数据模型一致性检查**: 在新建 Server 前，必须检查现有 Server 的数据模型。若字段命名、枚举值不一致，应在设计阶段统一，而非在代码中做转换适配。
4. **硬编码是隐患**: `holdingsService.ts` 中硬编码的 page=1/pageSize=50 是明显的 bug，说明代码未经充分测试就被提交。应在代码审查中检查"所有 handler 参数是否被使用"。

---

## 七、跨模块共性根因分析

### 7.1 根因分类

6 个 Disabled Server 的失效原因可归为 **3 大类**：

| 类别 | 涉及 Server | 占比 | 核心特征 |
|------|-----------|------|---------|
| **A. MCP 薄包装，Service 直连替代** | input, screening, stockpool | 3/6 | Service 被活跃使用，但 UI/Store 直接调用，MCP 层无价值 |
| **B. 功能重叠，合并未彻底** | trade | 1/6 | 与 trading 边界不清，d4200a7 合并遗留 |
| **C. 依赖未就绪，无调用入口** | backtest, export | 2/6 | 上游依赖 disabled 或参数复杂，无 UI/Agent 调用入口 |

### 7.2 系统性问题："MCP 优先"架构假设不成立

V9 项目的 MCP 架构假设是：**所有能力通过 MCP 暴露，UI 和 Agent 统一通过 MCP 调用**。

实际执行中发现：
1. **前端开发习惯**: React 组件倾向于通过 `import` 直接调用 Service/Store，而非通过异步 MCP 调用。MCP 调用增加了 `await` 和错误处理复杂度。
2. **性能要求**: 实时交互（筛选、搜索、状态流转）无法承受 MCP 的序列化 + ACL 校验延迟。
3. **Agent 生态未成熟**: `agentComponentRegistry.ts` 仅注册了 5 个 Agent，大量 Server 没有对应的 Agent 调用方。
4. **MCP 是"可选路径"而非"唯一路径"**: 当 Service 直接暴露时，MCP 成为"可选"而非"必需"。在资源有限时，开发者自然选择更简单的路径。

### 7.3 决策树：何时需要 MCP Server？

基于本次复盘，建议建立以下决策树：

```
是否需要新建 MCP Server？
├── 能力是否涉及外部系统调用（API/数据库/文件系统）？
│   └── 是 → 必须通过 Service 层封装，但不一定需要 MCP Server
├── 是否有 Agent 调用需求？
│   └── 是 → 需要 MCP Server（Agent 统一走 MCP 通道）
├── 是否有跨 Tab/跨窗口数据同步需求？
│   └── 是 → 需要 MCP Server（通过 withBroadcast 实现）
├── 是否需要权限控制（ACL）？
│   └── 是 → 需要 MCP Server（ACL 在 MCP 层拦截）
├── 是否是纯输出操作（导出/下载/打印）？
│   └── 是 → 不需要 MCP Server（UI 直接调用 Service）
├── 是否是实时交互操作（筛选/搜索/拖拽）？
│   └── 是 → 不需要 MCP Server（Store/Service 直接处理）
└── 现有 Server 是否已覆盖 80% 功能？
    └── 是 → 扩展现有 Server，而非新建
```

---

## 八、改进措施与行动清单

### 8.1 立即执行（P0，本周内）

| # | 措施 | 责任人 | 验收标准 |
|---|------|--------|---------|
| 1 | 将 export 降级为纯 Service 函数，移除 `ExportServer` 和 `backtestExportService` | 架构 | `src/mcp/servers/export/` 目录删除，功能迁移到 `src/services/export/`（无 MCP 包装） |
| 2 | 将 trade 合并入 trading:main，移除 `TradeServer` 和 `holdingsService` | 架构 | `src/mcp/servers/trade/` 和 `src/services/trade/` 删除；持仓导出功能迁移到 `tradingServer` |
| 3 | 修复 `holdingsService.ts` 中的硬编码 bug（page=1/pageSize=50 忽略用户参数） | 开发 | 参数透传正确，单元测试覆盖 |
| 4 | 在 `agentComponentRegistry.ts` 中注册 backtest Agent（即使 Server disabled，提前预留注册位） | 开发 | 注册位存在，注释说明恢复条件 |

### 8.2 短期优化（P1，本月内）

| # | 措施 | 责任人 | 验收标准 |
|---|------|--------|---------|
| 5 | input Service 层合并入 fetcher:data | 架构 | `inputService` 功能迁移到 `fetcherService`，`InputServer` 删除；组件 import 路径更新 |
| 6 | 为 screening 建设 Agent 调用路径（通过 analysis Server 代理） | 开发 | Agent 可通过 `analysis.screen_stocks` 触发筛选，无需恢复 `screening:main` |
| 7 | 为 stockpool 建设 Agent 内省能力（通过 `agentComponentRegistry` 注册） | 开发 | 注册 `stockpool-inspector` Agent，默认 Tool 为 `list_pool_stocks` |
| 8 | 统一数据模型：trade 的 `TradeActionRequest` 与 trading 的订单模型合并 | 架构 | 单一定义 `OrderCreateRequest`，两处共用 |

### 8.3 中期治理（P2，下季度）

| # | 措施 | 责任人 | 验收标准 |
|---|------|--------|---------|
| 9 | 建立 MCP Server 生命周期管理 SOP（决策树 + 检查清单） | 架构 | 文档化入 `docs/02-design/ADR/adr-xxx-mcp-server-lifecycle.md` |
| 10 | 建立 Tool 调用监控（mcpBridge 层计数器） | 开发 | 每月输出 "MCP Tool 调用热力图" |
| 11 | 为 backtest 建设回测 UI 页面 + 报告展示组件 | 产品+前端 | 用户可通过页面配置策略并执行回测，结果展示收益曲线和回撤图 |
| 12 | 为 stockpool 状态流转添加历史审计日志 | 开发 | 每次 `transitionStock` 记录 who/when/from/to，支持查询 |

---

## 九、SKILL 经验沉淀

### SKILL: MCP Server 必要性评估

**触发条件**: 新建或改造 MCP Server 时
**步骤**：
1. 检查现有 Server 是否已覆盖 80% 功能（避免重复）
2. 确认至少一个调用方（UI 页面、Agent、定时任务）
3. 判断操作类型：实时交互 → 不走 MCP；纯输出 → 不走 MCP；跨系统编排 → 走 MCP
4. 检查是否需要 ACL 权限控制（需要 → 走 MCP）
5. 检查是否需要跨 Tab 广播（需要 → 走 MCP）

### SKILL: 合并技术债务清理

**触发条件**: 执行 Server/模块合并时
**步骤**：
1. 列出被合并方的所有 Tool/Resource/Service 函数
2. 逐一迁移到目标方，更新 import 路径
3. 删除被合并方的源码目录
4. 更新 `mcpServerRegistry.ts`，将条目设为 `enabled: false` 或删除
5. 运行 `npm run audit:layers` 确认无跨层违规
6. 运行 `npm run tsc:prod` 确认类型安全

### SKILL: 状态机设计检查清单

**触发条件**: 设计状态流转系统（如 stockpool 的研究状态）
**步骤**：
1. 定义状态图（哪些状态、哪些转换允许）
2. 实现流转校验（不允许的状态跳跃应报错）
3. 添加历史审计日志（who/when/from/to）
4. 考虑并发控制（乐观锁或版本号）
5. 单元测试覆盖所有合法和非法流转路径

---

*本报告基于源码静态分析、git 历史回溯（d4200a7）和业务调用链追踪生成。建议每季度复用 `scripts/mcp-tool-usage-audit.py` 重新审计，持续追踪 MCP 模块健康度。*
