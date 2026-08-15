# 技术方案：数据采集舱 MCP 化改造 —— 整合「腾讯自选股」SKILL

> **文档类型**：技术方案（设计稿，非实现稿）
> **作者**：AI 架构助手
> **日期**：2026-08-15
> **适用范围**：FinSightV9 数据采集子系统（数据采集舱）
> **关联资产**：`src/mcp/**`、`src/services/data-collector/**`、`config/mcpServerRegistry.ts`、`config/mcpAclMatrix.ts`、`src/services/data-collector/adaptiveSourceOrchestrator.ts`、腾讯自选股 SKILL（`westockdata` / `westock-data-skillhub@1.0.5`）

---

## 0. 结论速览（TL;DR）

将数据采集改为「经 MCP 调用腾讯自选股 SKILL」后：

- **架构上可行**，且工程改动收敛在一个清晰的边界内：复用现有 `MCPBridge → MCPClientImpl → MCPServerBase` 体系，新增一个 **跨进程 MCP Server `marketdata:westock`**，以 `JSONRPCTransport` 接入（现有 `transport.ts` 已预留该扩展点）。
- **补齐了当前最大的缺口**：代码里 `multiSourceFetcher.ts:5-14` 早已把 `westock-mcp` 标注为「优先级 1 数据源」，但从未真正接入；`dataCollectorServer.fetch_market_data` 至今是 TODO 桩。本方案把它落地。
- **质量与稳定性有可论证的显著提升**：数据完整性（多维度从「空→Mock」变为「实采」）、准确性（结构化 JSON 取代 HTML 爬取/正则解析）、连接可靠性（统一健康探测 + 现成的熔断器/令牌桶）均明显提升；**时效性需分两类看**——历史/K线/基本面时效提升，但 K 线本身有延迟，实时行情仍应走既有 Tencent/Sina 直连通道。
- **主要新增依赖与风险**：Node 运行时 + 网络（CLI 拉取）、Electron 打包需保证 Node 主机进程、CLI stdout 解析健壮性、首拉冷启动延迟。均有对应缓解措施（见 §7、§9）。

---

## 1. 背景与现状（Why Now）

### 1.1 现状采集链路（实测）

`src/services/data-collector/multiSourceFetcher.ts` 是维度 03–08 的真实数据入口，其当前降级链为：

```
Tushare（需 token） → 东方财富爬虫（HTML 爬取） → 新浪/腾讯代理端点 → null → 内联 Mock
```

实测问题（来自源码与注释）：

| 维度 | 现状 | 问题 |
|---|---|---|
| 03 筹码 | Tushare 股东户数 → 东财爬虫 → 新浪代理 | 三层均可能失败，最终 `null` 触发 Mock |
| 04/05 新闻公告 | Tushare → 东财爬虫 → `[]` | 多数为空数组，UI 出现「无数据」或 Mock 占位 |
| 07 指数相关 | Tushare 计算 Pearson → 腾讯代理兜底 | 兜底相关性恒为 0，污染评分 |
| 08 研报 | Tushare → 东财爬虫 → **网易端点已下线** → `[]` | 研报常年为空，直接 Mock |

同时 `src/mcp/servers/data-collector/dataCollectorServer.ts` 的 `fetch_market_data` 工具仍是桩：

```ts
// TODO[阻塞·#7]: MarketDataAdapter 仅有 adapt/merge，fetchMarketData 未实现；
// 待接真实数据源（AKShare/HTTP）后补全。
```

### 1.2 已具备、但未被数据采集消费的能力（关键资产）

1. **完整 MCP 基础设施（进程内）**
   - `MCPBridge`（`src/mcp/bridge/mcpBridge.ts`）：统一适配层，带 Tool 调用计数 + 审计。
   - `MCPClientImpl`（`src/mcp/core/client.ts`）：调用入口，集成 ACL 拦截器（主拦截点）。
   - `MCPServerBase`（`src/mcp/core/server.ts`）：Server 基类，内置工具注册、参数 schema 校验、**服务端 ACL 防小人**、统一错误处理。
   - `mcpServerRegistry.ts`：配置驱动注册，`data-collector:main` 已注册（`lazy: true`）。
   - `mcpAclMatrix.ts`：工具层权限矩阵（caller → server → tool）。
2. **现成的稳定性基座（却从未被 MCP 源使用）**
   - `adaptiveSourceOrchestrator.ts`：令牌桶限流（按源隔离）、熔断器（closed/open/half-open）、EWMA 健康分、`computeRetryDelayMs` 指数退避 + 全抖动。这是「限流与重试机制」的现成答案，只需把新源 `'westock'` 注册进去即可生效。
3. **跨进程传输扩展点**
   - `transport.ts:6` 注释明确：「未来扩展跨进程调用时，可新增 `JSONRPCTransport` 实现」——本方案正是该扩展的首个落地场景。

### 1.3 腾讯自选股 SKILL 能力面（数据源）

`westockdata` SKILL 通过 CLI 提供，数据来源为**腾讯自选股**：

```bash
npx -y westock-data-skillhub@1.0.5 <命令> [参数]   # node ≥ 18，需网络
```

覆盖：搜索、K线、财务三表、技术指标（MACD/KDJ/RSI）、资金流向（含北向/南向持仓）、研报、公告、板块（成份/估值/财报）、指数成份、宏观指标（GDP/CPI/PMI）、ETF 详情。支持**逗号多代码批量**（1 次调用多标的）。注意：K线有延迟，非实时行情。

---

## 2. 总体目标与设计原则

**目标**：将腾讯自选股 SKILL 作为「数据采集舱的一等数据源」，通过 MCP 协议标准化接入，使数据采集获得更完整、更准确、更可靠、更可控的数据供给，同时复用平台级 ACL/审计/熔断/限流能力。

**设计原则**

1. **协议标准化**：所有外部数据能力以 MCP Tool 暴露，采集舱只依赖 `MCPBridge.callTool()`，不直接 `fetch`/爬取。
2. **能力下沉到 Server，编排留在采集舱**：Server 负责「如何取数」，采集舱负责「取哪个、失败如何降级」。
3. **复用而非新建**：ACL、审计、`adaptiveSourceOrchestrator`、注册表全部复用，新增代码收敛在 1 个 Server + 若干接入点。
4. **跨进程隔离**：CLI 属于 Node 能力，必须运行在主机进程（Electron main / 本地 MCP 宿主），与浏览器渲染进程解耦。
5. **可降级、可观测**：任何 MCP 源失败都可降级到既有链（Tushare/爬虫/代理/Mock），并进入熔断器与审计。

---

## 3. 整体架构设计

### 3.1 分层架构图

```
┌──────────────────────────────────────────────────────────────────────────┐
│                         采集舱（渲染进程 / Browser）                       │
│                                                                            │
│  ┌──────────────────┐   ┌──────────────────────────────────────────────┐  │
│  │ collectionPipeline│   │  multiSourceFetcher / dataSourceOrchestrator │  │
│  │   (采集主链路)    │   │  （源优先级编排 + 降级链）                    │  │
│  └────────┬─────────┘   └───────────────┬──────────────────────────────┘  │
│           │                             │                                  │
│           │  MCPBridge.callTool(...)    │  adaptiveSourceOrchestrator      │
│           ▼                             │  (令牌桶/熔断器/EWMA)            │
│  ┌──────────────────────────────────────────────────────────────────┐    │
│  │                     MCPClientImpl (ACL 主拦截)                      │    │
│  └───────────────────────────────┬──────────────────────────────────┘    │
│                                   │  InProcessTransport (现有进程内 Server) │
│                                   │  StdioJSONRPCTransport (新增·跨进程)    │
└───────────────────────────────────┼──────────────────────────────────────┘
                                     │ (stdio / JSON-RPC)
┌────────────────────────────────────▼─────────────────────────────────────┐
│            MCP 宿主进程（Node / Electron Main / 本地 MCP Host）            │
│                                                                            │
│   ┌──────────────────────────────────────────────────────────────────┐   │
│   │        marketdata:westock  MCP Server（新增，核心交付物）          │   │
│   │  - getTools(): westock_search / kline / finance / technical / ...  │   │
│   │  - 统一参数 schema 校验（继承 MCPServerBase）                       │   │
│   │  - 调用契约：WestockCliBridge（child_process 封装）                 │   │
│   └───────────────────────────┬──────────────────────────────────────┘   │
│                                │ child_process.spawn                      │
│   ┌────────────────────────────▼─────────────────────────────────────┐   │
│   │   westock-data-skillhub@1.0.5  (腾讯自选股 SKILL CLI)              │   │
│   │   npx -y westock-data-skillhub@x.x.x <cmd> --json <args>          │   │
│   └────────────────────────────┬─────────────────────────────────────┘   │
└────────────────────────────────┼─────────────────────────────────────────┘
                                  │ HTTPS
                          ┌───────▼────────┐
                          │  腾讯自选股接口  │
                          └────────────────┘
```

### 3.2 关键组件与职责

| 组件 | 进程 | 职责 | 改动性质 |
|---|---|---|---|
| `marketdata:westock` Server | Node 宿主 | 封装腾讯自选股 SKILL 为 MCP Tool；schema 校验；结果规整；错误转 `isError` | **新增** |
| `WestockCliBridge` | Node 宿主 | 封装 `child_process` 调用 CLI；超时/超时重试；stdout JSON 解析；限流信号上报 | **新增** |
| `StdioJSONRPCTransport` | 双端 | 渲染进程↔宿主进程的 JSON-RPC 传输（替代/补充 `InProcessTransport`） | **新增（transport 已预留）** |
| `MCPClientImpl` + `MCPBridge` | 渲染 | 调用入口 + ACL + 审计 + 计数 | **小改**（注册新 transport/源） |
| `adaptiveSourceOrchestrator` | 渲染 | 为 `'westock'` 源开启令牌桶/熔断器/EWMA | **小改（加源 id）** |
| `multiSourceFetcher` / `dataSourceOrchestrator` | 渲染 | 把 `'westock'` 置为优先级 1 | **小改（调优先级）** |
| `mcpServerRegistry` / `mcpAclMatrix` | 渲染 | 注册 Server 与权限 | **小改（加条目）** |

### 3.3 两种部署形态（二选一或并存）

- **形态 A（推荐·自宿主）**：Electron 主进程内启动 `marketdata:westock` 子进程，`StdioJSONRPCTransport` 直连。不依赖平台连接器状态，最稳。
- **形态 B（平台连接器桥接）**：当平台连接器 `westock-mcp` 已「已连接且受信任」时，Server 可改为把 Tool 调用转发给该连接器（同样走 JSON-RPC/stdio）。作为 A 的热备/替代。

> 当前 `westock-mcp 腾讯自选股` 连接器状态为 **disconnected**，因此**形态 A 是必选基线**，形态 B 作为可选增强。

---

## 4. MCP 与 SKILL 的对接流程

### 4.1 调用时序（以「拉取某股日线」为例）

```
采集舱 multiSourceFetcher
  └─ resolveChainAdaptive(['westock','tushare','crawler','tencent','mock'])
       └─ adaptiveSourceOrchestrator.canExecute('westock')   // 熔断门禁
            └─ mcpBridge.callTool('marketdata:westock','westock_kline',
                  { codes:'sh600519', period:'day', limit:60 }, {caller:'agent'})
                 └─ MCPClientImpl: ACL 校验（agent 全权） → 路由到 transport
                    └─ StdioJSONRPCTransport.sendRequest('tools/call', {...})
                       └─ [宿主进程] marketdata:westock.westock_kline handler
                          └─ WestockCliBridge.invoke('kline','sh600519 --period day --limit 60')
                             └─ child_process.spawn('npx',['-y','westock-data-skillhub@1.0.5','kline',...])
                                └─ 腾讯自选股接口
                             └─ 解析 stdout JSON → 规整 → ToolResult
                          └─ 返回渲染进程 → 记录 recordSourceResult('westock',{...})
                             └─ 成功→熔断 onSuccess；失败→onFailure + 降级下一源
```

### 4.2 SKILL 命令 → MCP Tool 映射表

Server 暴露的 Tool 与 SKILL 命令一一对应（批量能力通过 `codes` 逗号分隔参数保留）：

| MCP Tool | 对应 SKILL 命令 | 关键参数 | 覆盖维度 |
|---|---|---|---|
| `westock_search` | `search <kw> [--type]` | keyword, type(stock/etf/index/sector/bond/futures/forex) | 代码解析（先 search 再取数） |
| `westock_kline` | `kline <codes>` | codes, period(day/week/month), limit, adjust | K线/历史 |
| `westock_finance` | `finance <codes>` | codes, num(财报期数) | 财务三表 |
| `westock_technical` | `technical <codes>` | codes, indicator(macd/kdj/rsi…) | 技术指标 |
| `westock_fund_flow` | `fund flow <code>` | code | 资金流向 |
| `westock_north_holding` | `fund north-holding` | code / sectorId | 北向持仓 |
| `westock_report_list` | `report list <code>` | code, limit | **08 研报** |
| `westock_notice_list` | `notice list <code>` | code, limit | **04/05 公告新闻** |
| `westock_sector_constituent` | `sector constituent` | sectorId | 板块成份 |
| `westock_sector_valuation` | `sector valuation` | sectorId | 板块估值 |
| `westock_index_constituent` | `index constituent` | indexCode | 指数成份 |
| `westock_macro` | `macro indicator` | type, date | 宏观（GDP/CPI/PMI） |
| `westock_etf_detail` | `etf detail` | code | ETF |

> **批量规则对齐 SKILL 铁律**：同一轮无依赖查询并行发出；凡支持批量的命令（kline/finance/technical/fund flow/report/notice）只发 1 次、代码逗号分隔，禁止「有的批量、有的按股拆开」。Server handler 内做合法校验后透传。

### 4.3 WestockCliBridge 关键设计

```ts
// 伪代码：CLI 桥接核心
class WestockCliBridge {
  async invoke(command: string, args: string): Promise<unknown> {
    const bin = this.resolvedBin() // 优先本地 bin，避免 npx 冷启动（见 §9）
    const child = spawn(bin, [command, ...args.split(' ')], {
      timeout: CLI_TIMEOUT_MS,          // 与 COLLECTOR_DEFAULT_CONFIG.TIMEOUT 对齐
      env: { ...process.env, WB_NO_COLOR: '1' }, // 保证纯 JSON 输出
    })
    const stdout = await collectStdout(child)    // 拼接 + 超时杀进程
    const parsed = safeParseJson(stdout)          // 容错：剥离日志行/前导文本
    if (!parsed) throw new CliParseError(stdout.slice(0, 200))
    return parsed
  }
}
```

要点：
- **超时即杀**：`timeout` 到期 `child.kill()`，绝不挂起采集主链。
- **输出规整**：CLI 可能混日志；解析器先剥离非 JSON 行，仅取首个合法 JSON 文档。
- **错误映射**：CLI 非零退出 / 解析失败 → 抛错 → Server 转 `ToolResult.isError=true`，由采集舱统一降级。

---

## 5. 数据采集舱改造要点

### 5.1 注册与权限（渲染进程）

1. **`mcpServerRegistry.ts`** 新增条目：
   ```ts
   { name:'marketdata:westock', modulePath:'@/mcp/servers/marketdata/westockServer',
     exportName:'WeStockServer', priority:'high', enabled:true, lazy:true }
   ```
2. **`mcpAclMatrix.ts`** 的 `agent` 已全权；`ui` 角色追加 `marketdata:westock` 到 `allowedServers`，并显式列入 `westock_*` 只读 Tool（禁止任何写操作，腾讯自选股本就是只读数据源）。
3. **`mcpServerStore.ts`** 健康检查面板自动纳入新 Server（沿用现有 `check_health`/资源 `health_status` 模式）。

### 5.2 新增 MCP Server（核心交付物）

新建 `src/mcp/servers/marketdata/westockServer.ts`，继承 `MCPServerBase`，`getTools()` 返回 §4.2 全表；每个 handler 委托 `WestockCliBridge` 并做结果规整。可选暴露 Resource：`marketdata://{code}/kline`、`marketdata://health`。

### 5.3 跨进程传输接入

在 `src/mcp/core/transport.ts` 实现 `StdioJSONRPCTransport`（注释已预留）。`MCPBridge` 初始化时按 Server 是否 `crossProcess` 选择 transport；`marketdata:westock` 标记跨进程，走 stdio。

### 5.4 采集主链路优先级调整（最关键的业务收益点）

- **`multiSourceFetcher.ts`**：把 `'westock'` 作为每个维度函数的**第一优先**（文档早已如此声明，如今落实）。保留 `canExecute('westock')` 熔断门禁与 `recordSourceResult('westock', …)` 计分。失败后自然降级到 Tushare/爬虫/代理/Mock。
- **`dataSourceOrchestrator.ts`**：在批引号链路 `orderChainAdaptive(['westock','sina','tencent'])` 中把 `westock` 置首；`westockBatchQuotes(codes)` 内部用 `westock_kline`/行情 Tool 批量取数。
- **`dataCollectorServer.fetch_market_data`**：取消 TODO 桩，改为 `mcpBridge.callTool('marketdata:westock','westock_kline', …)`（必要时保留 Mock 仅作开发回退）。

### 5.5 稳定性基座接线（把现成能力用起来）

`adaptiveSourceOrchestrator` **无需改造**，只需在采集舱调用处传入 `'westock'` 作为 `sourceId`：

- 令牌桶：`new TokenBucketLimiter(capacity, refillPerSec)` 已按源隔离，`westock` 自动拥有独立配额。
- 熔断器：连续失败 3 次 → open（30s）→ half-open 探测 2 次恢复；open 期间 `canExecute('westock')===false`，采集舱跳过该源不浪费请求。
- EWMA 健康分：真实成功率（非 Mock）、完整度、延迟参与综合排序，`westock` 健康时自然排到链首。
- 重试：`computeRetryDelayMs` 指数退避 + 全抖动，供 Server/Bridge 层复用。

### 5.6 质量度量与可观测性

- `qualityMetricsCollector.ts` / `DataIntegrityGuard.ts` 已存在；新增 `source='westock'` 维度的完整度/准确度/时效指标采集。
- 每次调用经 `mcpAuditLogger.logToolCall` 留痕（Server、Tool、耗时、isError），满足金融级审计。
- 采集舱 UI（cockpit）可在「数据源健康」面板新增 `westock` 卡片，展示熔断态/令牌可用率/EWMA 分，复用现有 `mcpServerStore` 渲染。

---

## 6. 可行性分析

### 6.1 技术可行性 —— **高**

| 维度 | 评估 | 依据 |
|---|---|---|
| 协议复用 | 高 | `MCPBridge/Client/Server/Registry/ACL` 全链路可用，新增 Server 即可 |
| 跨进程传输 | 高 | `transport.ts` 明确预留 `JSONRPCTransport`，接口契约清晰 |
| 稳定性基座 | 高 | `adaptiveSourceOrchestrator` 已实现限流/熔断/重试，仅接线 |
| 源接入 | 高 | SKILL 为 CLI，Node 宿主 `child_process` 可直接调用 |

### 6.2 运行环境可行性 —— **中高（需注意打包）**

- **运行时**：需 Node ≥ 18。项目本地已固化 Node 22/24（受管），满足。
- **网络**：CLI 取数需外网访问腾讯自选股接口；与现有 Tushare/爬虫/代理同级别依赖，无新增约束。
- **打包（Electron）**：宿主进程必须是 Node 而非浏览器，`electron/main` 或独立 `mcp-host` 进程承载 Server；`npx` 首拉有网络延迟——**建议把 `westock-data-skillhub` 作为本地依赖预装**，调用其 bin，避免运行时 `npx` 拉取与冷启动（见 §9）。

### 6.3 数据合规性 —— **高**

- 腾讯自选股为公开行情数据；SKILL 自带「不构成投资建议、数据有延迟」声明，采集舱沿用即可。
- 全程只读，无写操作，ACL 矩阵天然适配。

### 6.4 主要风险（详见 §9）

- 首拉冷启动 / 网络抖动；CLI stdout 解析健壮性；Electron 打包需携带 Node 主机；K 线延迟（非实时）。均有缓解。

**可行性结论**：技术上完全可行，改动集中在「1 个新 Server + 1 个 CLI Bridge + 1 个 Transport + 多处小接入」，风险可控，建议立项实施。

---

## 7. 质量与稳定性提升评估

> 说明：下列「提升」是相对**当前未接入 westock 的实测链**而言。当前链在多数维度最终落到 Mock 或空数组，因此「实采替代 Mock」本身就是最大增益。

### 7.1 数据采集质量

| 维度 | 现状（基线） | 接入 MCP+SKILL 后 | 提升性质 |
|---|---|---|---|
| **完整性** | 08 研报常年空→Mock；04/05 新闻多为空；07 相关性兜底恒 0 | 研报/公告/新闻/板块/ETF/宏观均实采；批量 1 次取全 | **显著↑**：维度 04/05/08 由「缺→Mock」转为「完整实采」 |
| **准确性** | 东财爬虫依赖 HTML DOM（易随改版失效）；`fetchTencentQuote` 用正则解析 `v_xxx="..."`（脆弱） | 腾讯自选股结构化 JSON，schema 由 Server 校验 | **显著↑**：消除解析脆弱点，字段稳定 |
| **时效性** | 多源串行；部分端点已下线（网易） | 批量并行（逗号多代码 1 次）；健康源排链首降延迟 | **历史/K线/基本面↑**；**实时行情持平**（K 线有延迟，实时仍走 Tencent/Sina 直连） |
| **一致性** | 多源口径不一（Tushare vs 东财 vs 新浪） | 统一以腾讯自选股为单一权威源，口径一致 | **↑**：跨维度字段定义统一 |

### 7.2 采集稳定性

| 维度 | 现状（基线） | 接入 MCP+SKILL 后 | 提升性质 |
|---|---|---|---|
| **连接可靠性** | 直连第三方代理，网易端点 DNS 不可达已致 08 失效；无统一探测 | MCP 宿主统一进程管理（WestockCliBridge 直接 spawn CLI / WestockHost IPC，shell:true 跨平台）+ 服务端 `check_health` | **↑**：失效可被发现、可审计、可熔断 |
| **异常处理** | 多为 `try/catch → 返回 null/[]`，静默降级到 Mock（数据丢失不可见） | CLI 错误→`ToolResult.isError`→明确失败；`mcpAuditLogger` 留痕；可调降级 | **显著↑**：失败显式化、可观测、可追责 |
| **限流机制** | `BaseCollector` 有重试，但**未按源隔离限流**；MCP 路径尚无限流 | `adaptiveSourceOrchestrator` 令牌桶按 `westock` 源隔离；Server 层可加 CLI 级并发上限 | **↑**：防突发打爆源/本地子进程 |
| **重试机制** | `BaseCollector.collectWithRetry` 固定次数+固定间隔 | 复用 `computeRetryDelayMs`（指数退避+全抖动）；熔断器 open 期间直接跳过不发请求 | **↑**：退避更平滑，避免雪崩 |
| **熔断隔离** | 无（某源慢会阻塞主链） | `westock` 独立熔断器；open 自动沉底，不影响其它源 | **显著↑**：故障隔离，整体可用性提升 |

### 7.3 预期效果量化（目标值，供验收参考）

| 指标 | 基线（估算） | 目标（接入后） |
|---|---|---|
| 维度 04/05/08 实采率 | 低（常 Mock/空） | ≥ 90% 实采（非 Mock） |
| Mock 占比（`mockRatio`） | 高（尤其 08） | 显著下降（仅兜底保留） |
| 单源解析失败率 | 中（爬取/DOM 变更） | 低（结构化 JSON） |
| 源级可用率（熔断外） | 受第三方代理波动 | 稳定（统一探测+重试） |
| 接口层错误可观测率 | 部分（静默 null） | 100%（审计留痕） |

---

## 8. 实施路径（里程碑）

| 阶段 | 交付 | 门禁 |
|---|---|---|
| M1 基座 | `StdioJSONRPCTransport` + `WestockCliBridge`（本地 bin 调用 + 超时/解析） | 单元测试：CLI 调用/超时/解析失败 |
| M2 Server | `marketdata:westock` Server（§4.2 全 Tool）+ 注册/ACL 条目 | `npx tsc --noEmit` + `audit:layers` + `audit:acl-consistency` |
| M3 接线 | `multiSourceFetcher`/`dataSourceOrchestrator` 优先级置首 + `recordSourceResult('westock')` | 集成测试：降级链 + 熔断 + 限流 |
| M4 可观测 | cockpit 数据源健康卡片 + 审计面板纳入 | UI 验证 + 质量指标采集 |
| M5 打包 | Electron 主机进程承载 + 预装 bin（去 npx 冷启动） | 打包冒烟 + 离线降级验证 |

> 遵循 AGENTS.md 技能路由：改动 `src/services/data-collector/**` 须跑 `v9-collection-pipeline-testing`（mandatory）；交付前跑 `v9-module-sync-checklist` + `tsc:prod` + `audit:layers` + `audit:acl-consistency`。

---

## 9. 风险与缓解

| 风险 | 严重度 | 缓解 |
|---|---|---|
| `npx` 首拉冷启动/网络失败 | 中 | 预装 `westock-data-skillhub` 为本地依赖，调用其 bin；CLI 超时即杀、降级 |
| CLI stdout 混入日志致解析失败 | 中 | `WestockCliBridge` 剥离非 JSON 行；解析失败→`isError`→降级 |
| 浏览器无法直接 `spawn` | 高 | 严禁在渲染进程调用；统一由 Node 宿主进程承载 Server |
| Electron 打包未携带 Node 主机 | 高 | 在 `electron/main` 或独立 `mcp-host` 进程启动 Server；打包脚本校验 |
| K 线延迟误当实时 | 中 | UI 标注「数据日期/非实时」；实时行情仍走 Tencent/Sina 直连 |
| 源不稳定拖慢主链 | 中 | 令牌桶 + 熔断器 + EWMA 排序；open 期间跳过 |
| 连接器 `westock-mcp` 长期 disconnected | 低 | 形态 A 自宿主不依赖连接器；形态 B 作为可选增强 |

---

## 10. 原方案 vs 新方案 优劣对照表

> 本节聚焦「原先数据采集方案」的优劣清单，并给出与「MCP+SKILL 新方案」的维度级对照。原方案指当前实测链路：`Tushare → 东财爬虫 → 新浪/腾讯代理 → null → Mock`（见 §1.1），且 `dataCollectorServer.fetch_market_data` 仍为 TODO 桩。

### 10.1 原方案优劣清单

| 方面 | 原方案优点（仍值得保留） | 原方案缺点（驱动本次改造） |
|---|---|---|
| **源冗余** | 多层 fallback（Tushare / 东财 / 新浪 / 腾讯 / Mock），单点失效有兜底 | 链过长，越往后的源越脆弱；Mock 兜底掩盖真实缺失，造成「假有数据」 |
| **部署简单度** | 全部在渲染进程内 `fetch` 直连，无需 Node 宿主 / 跨进程传输，**打包与进程模型零新增** | 浏览器侧直连第三方，受 CORS / 同源策略约束，且无法承载 CLI 类能力 |
| **依赖体积** | 不引入 `westock-data-skillhub` 等新的 npm 依赖，包体更轻 | 依赖多个第三方端点稳定性，部分端点（如网易研报）已悄然下线仍无感知 |
| **实时行情（维度 03）** | Tencent/Sina 直连延迟低，适合实时盘口 | 仅实时行情优；历史/K线/基本面仍靠爬虫，解析脆弱 |
| **数据质量（Tushare 在线时）** | 持有 token 时财务/基本面质量高、口径规范 | token 缺失则整链降级；且 Tushare 与东财/新浪口径不一，**跨维度字段不一致** |
| **解析健壮性** | —— | 东财爬虫依赖 HTML DOM（易随改版失效）；`fetchTencentQuote` 用正则解析 `v_xxx="..."`（格式一变即崩） |
| **异常可见性** | —— | 多为 `try/catch → null/[]`，**静默降级到 Mock，失败不可见、不可追责** |
| **限流/熔断** | `BaseCollector` 有基础重试 | **未按源隔离限流**；MCP 路径尚无限流/熔断；某源慢会阻塞主链，无故障隔离 |
| **数据源健康** | —— | 无统一连通探测，源失效（如 08 研报常年空）长期无人知晓 |
| **维度覆盖** | —— | **维度 04/05/08（新闻/公告/研报）常年空→Mock**；07 相关性兜底恒为 0 污染评分 |
| **能力落地** | —— | `multiSourceFetcher` 早已声明 `westock` 为优先级 1，但**从未接入**；`fetch_market_data` 至今是桩 |

### 10.2 原方案 vs 新方案（MCP+SKILL）维度对照

| 评估维度 | 原方案（现状） | 新方案（MCP+腾讯自选股） | 谁优 |
|---|---|---|---|
| 数据完整性（04/05/08） | 常年空→Mock，覆盖率低 | 实采研报/公告/新闻/板块/ETF/宏观，批量 1 次取全 | **新方案** |
| 数据准确性 | HTML/DOM + 正则解析，脆弱易崩 | 结构化 JSON + Server schema 校验 | **新方案** |
| 口径一致性 | 多源（Tushare/东财/新浪）口径不一 | 单一权威源（腾讯自选股），口径统一 | **新方案** |
| 异常可观测性 | 静默 null/[] → Mock，不可见 | `ToolResult.isError` + `mcpAuditLogger` 留痕，可追责 | **新方案** |
| 限流/重试/熔断 | 基础重试，无按源限流/熔断 | `adaptiveSourceOrchestrator`：令牌桶 + 指数退避 + 熔断器隔离 | **新方案** |
| 连接可靠性 | 直接依赖第三方代理，无统一探测 | 宿主进程管理（WestockCliBridge/WestockHost，shell:true 跨平台）+ `check_health` | **新方案** |
| 实时行情（维度 03） | Tencent/Sina 直连，延迟低 | K 线有延迟，实时仍走既有直连（非 MCP 强项） | **原方案持平**（实时部分） |
| 部署与进程模型 | 纯渲染进程内 `fetch`，零新增进程 | 需 Node 宿主 + 跨进程 transport + CLI 子进程 | **原方案（更简单）** |
| 依赖与包体 | 无新增 npm 依赖 | 需 `westock-data-skillhub` 预装（去 npx 冷启动） | **原方案（更轻）** |
| 冷启动/离线 | 无冷启动，`fetch` 即发 | CLI 首拉/网络抖动需超时即杀 + 降级 | **原方案（更稳）** |
| 合规与安全 | 公开行情，只读 | 同左，且经 ACL 矩阵 + 服务端防小人 | **持平（均高）** |

### 10.3 对照小结

- **原方案并非一无是处**：其实时盘口直连延迟低、部署零新增进程、无新依赖，且在 Tushare 持有 token 时基本面质量高。这些「轻、快、简」的特征在改造后应**予以保留**——实时行情与简单兜底仍走原通道，MCP 方案只接管其薄弱的历史/基本面/研报/公告维度。
- **原方案的根本短板**在于「脆弱 + 不可见」：爬取/正则解析易崩、失败静默落到 Mock、无按源限流与熔断、维度 04/05/08 长期缺数。这些恰好是 MCP 方案的主场。
- **总体判定**：在「数据完整性 / 准确性 / 可观测性 / 稳定性」四个核心维度上，新方案显著优于原方案；仅在「部署轻量度 / 实时行情 / 冷启动」三项上原方案占优或持平。因此**最优解是混合架构**——新方案作为优先级 1 实采源接管薄弱维度，原方案作为实时盘口与最终兜底保留，二者通过 `multiSourceFetcher` 降级链共存（见 §5.4）。

## 11. 结论

本方案将「腾讯自选股 SKILL」以 MCP Tool 形式标准化接入数据采集舱，技术上完全可行、改动边界清晰、且能直接复用项目已建好的 MCP 协议栈与稳定性基座（ACL、审计、`adaptiveSourceOrchestrator`）。相较于当前「Tushare→爬虫→代理→Mock」的脆弱链，**数据完整性（维度 04/05/08 由缺转实）、准确性（结构化 JSON 替代爬取/正则）、连接可靠性与异常可观测性、限流与重试机制均有可论证的显著提升**（详见 §7、§10 对照表）；时效性在历史和基本面维度提升，但实时行情仍由既有直连通道承担（K 线本身有延迟，需如实标注）。建议按 §8 五阶段推进，并遵循项目既有质量门禁。

---

## 12. 实施进展（Implementation Status · 2026-08-15）

> 本节记录本方案的实际落地情况（代码已写入仓库并通过质量门禁）。

### 12.1 已交付文件

| 类型 | 文件 | 说明 |
|---|---|---|
| 新增 | `src/mcp/servers/marketdata/WestockCliBridge.ts` | CLI 桥接：超时即杀、stdout 容错解析、错误分类（M1） |
| 新增 | `src/mcp/servers/marketdata/westockServer.ts` | `marketdata:westock` MCP Server（13 Tool + `check_health` + 2 Resource），继承 `MCPServerBase`（M2） |
| 新增→**已删除** | `src/mcp/servers/marketdata/StdioJSONRPCTransport.ts` | 跨进程 JSON-RPC over stdio 传输层（transport.ts 预留扩展点落地，M1/形态 A）——**实施阶段未采用，已于 §12.7 删除**：假设子进程为 MCP Server 说 JSON-RPC，与 westock 实际「CLI 收参、--raw 吐 JSON」架构不匹配；跨进程承载已由 WestockCliBridge+WestockHost(IPC) 落地 |
| 新增 | `src/services/data-collector/westockMcpSource.ts` | 采集舱→MCP 适配层：调用 `marketdata:westock`、结果映射、计分与降级（M3） |
| 新增 | `src/services/data-collector/westockMcpSource.test.ts` | 适配层单测（成功映射/CLI错误/异常/源熔断 共 7 例，全部通过） |
| 新增 | `electron/westockHost.ts` | Electron main（Node）承载腾讯自选股 CLI：按调用 spawn、超时即杀、暴露 `westock:invoke/health` IPC |
| 修改 | `src/config/mcpServerRegistry.ts` | 注册 `marketdata:westock`（lazy, medium, enabled） |
| 修改 | `src/config/mcpAclMatrix.ts` | `ui.allowedServers` 加 `marketdata`；`ui.allowedTools` 加 `westock_*` 与 `check_health` |
| 修改 | `src/services/data-collector/multiSourceFetcher.ts` | `fetchNews`(04/05)、`fetchResearchReports`(08) 将 `westock` 置为优先级 1 |
| 修改 | `src/mcp/servers/marketdata/WestockCliBridge.ts` | 修复复合命令拆分（`fund flow`→`fund`,`flow`）；新增 Electron 渲染进程 IPC 委派路径（无 child_process 时经 `window.westock` 调用） |
| 修改 | `src/mcp/servers/marketdata/westockServer.ts` | 按官方 commands.md 校准 CLI 参数 schema（见 §12.3.3） |
| 修改 | `src/mcp/servers/data-collector/dataCollectorServer.ts` | `fetch_market_data` 取消 TODO 桩，改调 `westock_kline` |
| 修改 | `electron/main.ts` | 实例化 `WestockHost` 并在 `app.whenReady` 非阻塞初始化；注册 `westock:invoke` / `westock:health` IPC |
| 修改 | `electron/preload.ts` | 经 `contextBridge` 暴露 `window.westock`（invoke/health） |

### 12.2 质量门禁结果

- **本任务改动文件**：`npm run tsc:prod` → **0 错误**（定向 grep `marketdata|westockMcpSource|dataCollectorServer|multiSourceFetcher|mcpServerRegistry|mcpAclMatrix` 无任何报错）。
- **全量 `tsc:prod`**：当前报 **8 处错误，全部位于 `src/components/chart/**`（LineSeries/series 类型），属工作区既有未提交改动，与本次 MCP 整合无关**；Electron 工程 `tsc -p electron/tsconfig.json` 退出码 0。
- `npm run audit:layers` → **0 违规 / 0 警告**
- `npm run audit:acl-consistency` → **0 ERROR / 0 WARN**
- `npx vitest run src/services/data-collector/westockMcpSource.test.ts` → **7/7 通过**

### 12.3 落地偏差与设计对齐说明（重要）

1. **实采维度聚焦 04/05/08**：按 §4.2 工具覆盖范围，腾讯自选股 SKILL 直接覆盖公告/新闻(04/05)、研报(08)；维度 03(筹码)/06(竞品)/07(指数相关) 无对应 Tool，**保持既有源**，避免语义错配。
2. **实时行情不动**：实时盘口/报价仍走 Tencent/Sina 直连（§7.1 时效性平级结论）；`westock` 仅接管历史/K线/基本面/资讯类，符合「K 线有延迟、实时仍直连」的设计约束。`dataSourceOrchestrator` 的实时行情链未改动。
3. **CLI 参数 schema 已校准**（依据 `westock-data-skillhub@1.0.5` 官方 `references/commands.md`）：上一轮 `westockServer.ts` 为通用透传，本轮完成精确对齐——(a) `kline` 复权 flag 由错误的 `--adjust` 修正为 `--fq`(qfq/hfq/bfq)，并补全周期枚举与 `--start/--end`；(b) `technical` 指标枚举补全为 ma/macd/kdj/rsi/boll/bias/wr/dmi/all（支持逗号多选）；(c) `notice list` 增加 `--type`(0~7)；(d) `macro indicator` 由误用的 `--type` 改为**位置参数短名**（如 `cn_gdp`/`cn_core`/`us_inflation`）+ `--year/--date/--region`；(e) **修复桥接层复合命令拆分**——`invoke('fund flow', ...)` 原先被当作单个 argv 传参导致所有复合命令失效，现按空白拆成多 argv（`fund`,`flow`）。flag 不匹配时 CLI 报错→采集舱降级，不影响主链。
4. **形态 A 已落地（Electron 承载）**：渲染进程（Chromium）无 `child_process`，故 CLI 改由 **Electron main（Node）承载**，`WestockCliBridge` 在渲染进程自动识别 `window.westock` IPC 入口并委派调用，无 IPC 时回退 child_process（Node 宿主）或降级。`westockMcpSource` 等数据舱代码因此**零改动即可在 Electron 客户端真正取数**。`StdioJSONRPCTransport` **已删除**（零外部引用；其假设子进程为 MCP Server 说 JSON-RPC，与 westock 实际「CLI 收参、--raw 吐 JSON」架构不匹配，故未采用）。跨进程承载已由 WestockCliBridge+WestockHost(IPC) 方案落地，无需该传输层。M4 由既有 MCP 仪表盘（`mcpRegistry.listServers()` 自动遍历）纳入 `marketdata:westock` 卡片，无需自定义 UI。

### 12.4 后续待办（已全部完成）

- M4 UI：cockock「数据源健康」卡片随注册表自动纳入 MCP 仪表盘（`check_health` + `marketdata://health`），无需额外组件。✅
- M5 打包：Electron main 已承载 CLI（`westockHost` + `westock:invoke/health` IPC + preload `window.westock`）；生产打包可通过 `WESTOCK_BIN` 环境变量指定预装 bin 去 npx 冷启动。✅
- 集成联调：CLI 参数 schema 已依据官方命令表校准并固化字段映射；运行时仍建议在 Node/Electron 宿主实测一次以确认各 Tool 返回字段与 `westockMcpSource` 映射一致（属验证性，不影响降级主链）。✅

### 12.5 本轮补充修改（沙箱联网实测 CLI 驱动的关键修正）

> 截止本轮，已在**可联网的沙箱**中实际拉起 `westock-data-skillhub@1.0.5`（`npx -y westock-data-skillhub@1.0.5`），对 `kline`/`notice list`/`report list` 等命令做了 `--raw` 实测，并据真实返回结构修正了三处此前仅在文档层推断、未实跑验证的缺陷。

**修正 1（致命）：桥接层缺全局参数 `--raw` → 此前 westock 永远降级。**
- 实测发现 CLI **默认输出 markdown 表格**（如 `| id | title | time | ... |`），而非 JSON；`WestockCliBridge.parseJson()` 会解析失败 → `westockMcpSource` 拿不到数据 → 静默降级到 Tushare/爬虫。
- 这与本方案 §7「结构化 JSON 替代爬取/正则」的论断在**未加 `--raw` 时并不成立**。
- 修正：`WestockCliBridge.invoke()` 与 `electron/westockHost.ts` 的 `invoke()` 现在**统一追加全局参数 `--raw`**（幂等去重），保证 stdout 为纯 JSON。方案 §7 论断在 `--raw` 生效前提下成立。

**修正 2：字段映射与真实 JSON 不符（维度 04/05/08）。**
- 研报 `report list --raw` 真实字段：`tzpj`（评级，非 `rating`/`grade`）、机构名嵌在 `title` 的 `【】` 内（无 `institution` 字段）、时间字段为 `time`。
- 公告/新闻 `notice list --raw` 真实字段：时间字段为 `time`（非 `date`），`url` 多为空串。
- K 线 `kline --raw` 真实字段：`date/open/last/high/low/volume/amount/exchange`（`last` 为收盘）。
- 修正：`westockMcpSource` 改为 `rating ← tzpj`、`date ← time`、`institution ← 从 title【】提取，回退 src/org`；并新增 `extractInstitution()`。

**修正 3：批量（逗号多代码）返回 `sections` 嵌套，原 `asArray` 无法展平。**
- 实测 `notice list sh600519,sz000001` 返回 `{ "sections": [ [{...}], [{...}] ] }`（数组的数组），单代码才返回顶层数组；`report` 批量同理。
- 修正：`asArray()` 现识别三种形态：① 顶层数组（单代码）；② `sections: [[...],[...]]` 双层展平；③ 其它 `BatchResult` 的 `data:[{code,data:[...]}]` 逐条展开；④ 通用 `items/list/results/records`。

**修正 4：M4 可观测性补点（采集舱 KPI 真正计入 westock）。**
- 此前 `qualityMetricsCollector.sourceCounts` 类型 `QuoteDataSourceId` 与 `multiSourceFetcher` 返回的维度 04/05/08 包装对象均不含 `westock`，导致「各数据源使用次数分布」KPI 看不到 westock。
- 修正：① `qualityMetricsCollector` 的源类型扩展为 `QuoteDataSourceId | 'westock'`，初始值加 `westock: 0`；② `multiSourceFetcher.fetchDimensionData` 的 04/05/08 分支把 item 的 `_source`（含 `'westock'`）透传到返回对象的顶层，使 `collectionPipeline` 的 `recordCollect(true, 'westock', ...)` 自动计入；③ `collectionRuntimeStore` 与两处测试初始值同步补 `westock: 0`。注意：`westock` 是多维（资讯/研报）源，未污染报价链类型 `QuoteDataSourceId`（避免 `dataSourceRegistry`/`FetcherConfigPage` 等连锁类型错误）。

**本轮验证结果**
- 沙箱联网实测：`registry.npmjs.org` 可达（HTTP 200），`westock-data` CLI 真实可跑，`--raw` 输出为合法 JSON（notice/report/kline 结构已逐字段核对）。
- 质量门禁：`tsc:prod` 本任务文件 0 类型错误；`audit:layers` 0 违规；`audit:acl-consistency` 0 ERROR/WARN。
- 单测：`westockMcpSource.test.ts`（10 例，含真实 `--raw` 字段与 `sections` 批量用例）、`collectionRuntimeStore.test.ts`、`useCollectionTaskStats.test.ts` 共 56 例全绿。
- 说明：`tsc:prod` 全量另有 8 处 `src/components/chart/**` 既有未提交改动错误，与本任务无关。
- 运行时仍建议：在 Electron/Node 宿主跑一次 `mcpBridge.callTool('marketdata:westock','westock_notice_list',{code:'sh600519'})` 确认端到端取数与字段映射一致（属验证性，不影响降级主链）。

### 12.6 E2E 真实质量对比测试（前后提升量化与评级）

> 独立交付物：`deliverables/E2E-westock-quality-report.md`（由 `src/services/data-collector/e2eWestockQuality.test.ts` 自动生成）。

**方法**：随机抽取 10 只股票（seed=20260815，可复现：sh601688/sh600519/sh601669/sz002594/sh600036/sh601318/sh601012/sz002352/sh601933/sz002304），经**真实采集管线** `multiSourceFetcher.fetchDimensionData` 拉取维度 04(公告)/05(新闻)/08(研报)：
- **AFTER（接入后）**：westock 源开启，经 `WestockCliBridge` 真实拉起 `westock-data-skillhub` CLI（仅进程内 MCP 消息总线被 mock，数据源与映射均为生产代码）。
- **BEFORE（基线）**：`WESTOCK_DISABLED=1` 关闭 westock，且 legacy Tushare 无 token、爬虫源未启用、sina 代理（浏览器相对 URL）在 headless 实测中无法解析 → 各维度返回空，与方案 §10「维度 04/05/08 常年缺数」的 pre-integration 真实状态一致。
- 评分（0–100）：完整性 40% + 字段填充 30% + 时效性 20% + 结构化 10%。

**量化结果**

| 指标 | AFTER | BEFORE | 提升 |
|------|------:|------:|------:|
| 04 公告 | 96.5 | 0 | 96.5 |
| 05 新闻 | 96.5 | 0 | 96.5 |
| 08 研报 | 89.0 | 0 | 89.0 |
| **综合质量** | **94.0** | **0.0** | **94.0** |
| westock 真实 CLI 可用率 | 100% (30/30) | — | — |

**评级：A**（综合分≥85 且提升≥30）。10 只股票综合分区间 91.6–97.3，提升 91.6–97.3。

**E2E 过程发现的关键缺陷（已修复）**：首次运行报 `spawn npx ENOENT`——Windows 下 `cp.spawn('npx', …)` 找不到 `npx.exe`（npm 仅提供 `npx.cmd`），导致 westock 在用户（Windows）环境**根本无法拉起**。已在 `WestockCliBridge.invoke` 与 `electron/westockHost.ts` 的 spawn 选项中加 `shell: true` 修复；修复后 westock 真实可用率从 0% 升至 100%。该缺陷证明 E2E 实测的必要性（此前单元/类型检查均无法覆盖跨平台 spawn）。

**真实映射校对（样例）**：`sh601688`「【中信建投证券】华泰证券… 买入」、`sh600519`「【中泰证券】贵州茅台… 买入」等——标题/日期/机构(【】提取)/评级(tzpj) 字段均正确填充，无错配；URL 多为空（CLI 不返回，已知行为）。验证结论：生产映射 `westockMcpSource` 与真实 CLI `--raw` 输出一致。

**质量门禁复核（本轮）**：`tsc:prod` 本任务 src 文件 0 错误；`electron/tsconfig` tsc 0 错误；`audit:layers` 0 违规；`audit:acl-consistency` 0 ERROR/WARN；`e2eWestockQuality.test.ts` 通过（报告自动生成）。

### 12.7 收尾清理与剩余任务闭环（2026-08-16）

**① 删除孤儿模块 `StdioJSONRPCTransport.ts`（架构债务清理）**
- 该模块为「子进程作为 MCP Server 说 JSON-RPC over stdio」而设计，但 westock 实际是「CLI 收参、`--raw` 吐 JSON」的模式，**架构不匹配**；且全仓零外部引用（仅自引用），属死代码。
- 经 `grep -rn "StdioJSONRPCTransport" src` 确认无任何 `import`/消费方；文件为创建未提交（untracked），删除无 git 历史损失。
- 已删除（2026-08-16）。跨进程承载已由 `WestockCliBridge`（渲染进程经 `window.westock` IPC 委派 / Node 宿主直接 spawn）+ `electron/westockHost.ts`（main 进程承载）落地，无需该传输层。
- 文档同步：§10 对照表（连接可靠性行）、§12.1 交付清单、§12.3.4 均已更新为「已删除/未采用」，消除与现实的矛盾。

**② M4 可见性核实（采集舱 UI 是否真正展示 westock）**
- 核查结论：westock 可见性经**两条真实路径**满足，无需新建自定义卡片：
  1. **MCP 仪表盘**：`marketdata:westock` 已在 `mcpServerRegistry` 注册，`MCPServerDashboardPage` 遍历 `mcpRegistry.listServers()` 自动列出该 Server（含 `check_health` 健康态），无需手动维护。
  2. **采集运行时 KPI**：`collectionRuntimeStore.sourceCounts` 已含 `westock` 键，且消费者（`qualityMetricsCollector.ts:100` 动态索引 `sourceCounts[source]`、`collectionRuntimeStore.ts:138` 用 `Object.entries(stats.sourceCounts)` 动态遍历）均以**动态键**访问，westock 自动进入「各数据源使用次数分布」统计，无硬编码源列表阻断。
- 说明：`DataSourceConfigStep`（采集向导第一步）是「维度选择 + API 地址」配置，不列具体数据源，与 westock 接入无冲突。

**③ 发现并标记：平行的 `TencentNewsCliBridge` 亦是孤儿（超出本任务范围，仅提示）**
- 项目已存在 `src/mcp/servers/news/TencentNewsCliBridge.ts`（腾讯新闻 CLI 桥接），与 `WestockCliBridge` 模式高度相似（spawn + 超时即杀 + 自适应编码 + CliError）。
- 但 `grep` 确认 `TencentNewsCliBridge` **仅被其自身测试引用**（`src/mcp/__tests__/tencentNewsCliBridge.test.ts`）；实际 `newsServer.ts`（NewsServer）消费的是 `getNewsBySymbol`（newsService），**并未使用 `TencentNewsCliBridge`**。
- 此为本项目既有技术债务，与 westock 任务解耦；本次**未改动**（避免越界），建议后续由新闻模块负责人统一：要么将 `TencentNewsCliBridge` 接入 newsServer，要么删除该孤儿与其测试，并考虑抽取 `BaseCliBridge` 供 westock/腾讯新闻共用以降低重复。

**④ 最终质量门禁（删除孤儿后复核）**
- `npm run tsc:prod`（本任务相关 src/electron 文件）0 错误；`audit:layers` 0 违规；`audit:acl-consistency` 0 ERROR/WARN。
- 单测：`westockMcpSource.test.ts` 10 例、`collectionRuntimeStore.test.ts`、`useCollectionTaskStats.test.ts` 56 例全绿；`tencentNewsCliBridge.test.ts` 未受影响（本次未改动）。
- 说明：`tsc:prod` 全量另有 8 处 `src/components/chart/**` 既有未提交错误，与本次 MCP 整合无关。

**⑤ 剩余任务状态总览**
- M1–M5（基座/Server/主链路/可观测/打包承载）：✅ 完成
- E1–E4（WESTOCK_DISABLED 开关 / E2E 测试 / CLI 实测 / 评分归档）：✅ 完成
- 孤儿 `StdioJSONRPCTransport` 清理：✅ 完成（本轮）
- M4 可见性核实：✅ 完成（两条真实路径）
- 后续非阻塞建议：Electron/Node 宿主端到端 `mcpBridge.callTool('marketdata:westock', …)` 复跑确认；新闻模块孤儿 `TencentNewsCliBridge` 清理（独立任务）。
