# 技术方案：数据采集舱 MCP 化改造 —— 整合「腾讯新闻」SKILL

> **文档类型**：技术方案（设计稿 + 接入范式，对齐 `MCP-SKILL-腾讯自选股-数据采集舱改造方案.md`）
> **作者**：AI 架构助手
> **日期**：2026-08-15
> **适用范围**：FinSightV9 数据采集子系统（数据采集舱）
> **关联资产**：`src/mcp/**`、`src/services/data-collector/**`、`config/mcpServerRegistry.ts`、`config/mcpAclMatrix.ts`、`src/services/data-collector/adaptiveSourceOrchestrator.ts`、腾讯新闻 SKILL（`tencent-news` / `tencent-news__skillhub`）
> **前置条件**：腾讯新闻 CLI（`tencent-news-cli`）已安装（v1.0.14，SHA256 校验通过），API Key 已配置（2026-08-16 实测可取数）

---

## 0. 结论速览（TL;DR）

将数据采集扩展为「经 MCP 调用腾讯新闻 SKILL」后：

- **架构上可行**，且与「腾讯自选股」方案共用同一套基座：`MCPBridge → MCPClientImpl → MCPServerBase` + `StdioJSONRPCTransport` + `adaptiveSourceOrchestrator`（限流/熔断/重试）。新增一个跨进程 MCP Server `news:tencent`，以 `JSONRPCTransport` 接入。
- **补齐当前新闻/资讯维度的核心缺口**：`multiSourceFetcher` 的 `fetchNews`(维度 04/05) 当前走「Tushare → 东财爬虫 → `[]`」链，常年为空数组触发 Mock 占位；引入腾讯新闻后，维度 04/05 由「缺→Mock」转为「实采资讯」。
- **与腾讯自选股方案互补而非重叠**：腾讯自选股覆盖**个股/行情/财务/研报**(维度 03/07/08)；腾讯新闻覆盖**泛资讯/热点/行业新闻**(维度 04/05 的「资讯」侧与行业舆情)，两者经同一降级链共存。
- **主要新增依赖与风险**：Node 运行时 + 网络（CLI 拉取）、**API Key 鉴权**（必填，用户自取，2026-08-16 已就绪）、**CLI 输出为 UTF-8 但 Windows 宿主易按 GBK 误解码**（桥接层须按 UTF-8 显式解码，否则中文乱码——已实测验证）。

---

## 1. 背景与现状（Why Now）

### 1.1 现状采集链路（实测，来自 `MCP-SKILL-腾讯自选股` 方案 §1.1）

```
Tushare（需 token） → 东方财富爬虫（HTML 爬取） → 新浪/腾讯代理端点 → null → 内联 Mock
```

其中维度 04/05（新闻/公告）现状：

| 维度 | 现状 | 问题 |
|---|---|---|
| 04/05 新闻公告 | Tushare → 东财爬虫 → `[]` | 多数为空数组，UI 出现「无数据」或 Mock 占位 |

`src/mcp/servers/data-collector/dataCollectorServer.ts` 的 `fetch_market_data` 已由腾讯自选股方案落地（接 `westock_kline`）。但**泛资讯/行业新闻**维度仍缺一个稳定、结构化、可审计的来源。

### 1.2 腾讯新闻 SKILL 能力面（数据源）

`tencent-news` SKILL 通过本地 CLI（`tencent-news-cli`，Windows 落盘于 `%HOME%/.tencent-news-cli/bin/`）提供，数据来源为**腾讯新闻**。

```bash
# 经 skill 脚本调用（自动注入 --caller）
powershell scripts/run-cli.ps1 <subcommand> [args]
```

子命令面（经 `help` 实测；CLI stdout 为 UTF-8，Windows 宿主（PowerShell/系统码表 GBK）直接重定向会误解码，桥接层须按 UTF-8 显式解码）：

| 子命令 | 能力 | 对采集舱的价值 |
|---|---|---|
| `hot` | 热点新闻摘要 | 维度 04 泛热点资讯 |
| `search <kw> --limit N` | 关键词新闻检索 | **核心**：按「数据采集/数据要素/金融科技」等检索行业资讯 |
| `morning` | 今日早报 | 维度 05 日报类资讯 |
| `evening` | 今日晚报（18:00 前提示改查 hot） | 维度 05 日报类资讯 |
| `jiaozhen` | 较真核查（事实核查） | 资讯真实性核验，降低舆情噪声 |
| `weather` | 天气（默认当前地区，`--adcode` 指定） | 非金融，可忽略或作衍生维度 |
| `apikey-set/get/clear` | API Key 管理（持久化到系统配置文件） | **必填**：无 Key 无法取数 |
| `feedback` | 使用问题反馈 | 运维 |

> **关键约束**：调用任何取数子命令（`hot`/`search`/`morning`/`evening`/`jiaozhen`）**均需在 `apikey-set` 后**；API Key 由用户从 `https://news.qq.com/exchange?scene=appkey` 自取，技能不代开浏览器。

### 1.3 已具备、可直接复用的能力（关键资产）

与腾讯自选股方案完全一致（见其 §1.2）：`MCPBridge` / `MCPClientImpl` / `MCPServerBase` / `mcpServerRegistry` / `mcpAclMatrix` / `adaptiveSourceOrchestrator` / `transport.ts` 预留的 `JSONRPCTransport`。腾讯新闻方案直接复用，新增代码收敛在 **1 个 Server + 1 个 CLI Bridge**。

---

## 2. 总体目标与设计原则

**目标**：将腾讯新闻 SKILL 作为「数据采集舱的泛资讯/行业新闻一等数据源」，通过 MCP 协议标准化接入，补齐维度 04/05 的「资讯」侧，复用平台级 ACL/审计/熔断/限流能力，并为投研复盘提供行业舆情输入。

**设计原则**（对齐腾讯自选股方案 §2）

1. **协议标准化**：所有外部资讯能力以 MCP Tool 暴露，采集舱只依赖 `MCPBridge.callTool()`。
2. **能力下沉到 Server，编排留在采集舱**：Server 负责「如何取资讯」，采集舱负责「取哪个主题、失败如何降级」。
3. **复用而非新建**：ACL、审计、`adaptiveSourceOrchestrator`、注册表全部复用。
4. **跨进程隔离**：CLI 属 Node 能力，运行在主机进程（Electron main / 本地 MCP 宿主），与渲染进程解耦。
5. **可降级、可观测**：任何 MCP 源失败降级到既有链（Tushare/爬虫/代理/Mock），进入熔断器与审计。
6. **UTF-8 解码容错**（腾讯新闻特有）：CLI stdout 实测为 UTF-8；但 Windows 宿主（PowerShell 默认按系统码表 GBK）重定向会误解码成乱码。Bridge 层须抓取原始字节并按 UTF-8 显式解码后再解析。

---

## 3. 整体架构设计

### 3.1 分层架构图

```
┌──────────────────────────────────────────────────────────────────────────┐
│                         采集舱（渲染进程 / Browser）                       │
│  ┌──────────────────┐   ┌──────────────────────────────────────────────┐  │
│  │ collectionPipeline│   │  multiSourceFetcher / dataSourceOrchestrator │  │
│  │   (采集主链路)    │   │  （源优先级编排 + 降级链，维度 04/05）         │  │
│  └────────┬─────────┘   └───────────────┬──────────────────────────────┘  │
│           │  MCPBridge.callTool(...)    │  adaptiveSourceOrchestrator      │
│           ▼                             │  (令牌桶/熔断器/EWMA)            │
│  ┌──────────────────────────────────────────────────────────────────┐    │
│  │                     MCPClientImpl (ACL 主拦截)                      │    │
│  └───────────────────────────────┬──────────────────────────────────┘    │
└───────────────────────────────────┼──────────────────────────────────────┘
                                     │ (stdio / JSON-RPC)
┌────────────────────────────────────▼─────────────────────────────────────┐
│            MCP 宿主进程（Node / Electron Main / 本地 MCP Host）            │
│   ┌──────────────────────────────────────────────────────────────────┐   │
│   │        news:tencent  MCP Server（新增，核心交付物）                │   │
│   │  - getTools(): tn_hot / tn_search / tn_morning / tn_evening / ...  │   │
│   │  - 统一参数 schema 校验（继承 MCPServerBase）                       │   │
│   │  - 调用契约：TencentNewsCliBridge（child_process 封装 + GBK 解码）  │   │
│   └───────────────────────────┬──────────────────────────────────────┘   │
│                                │ child_process.spawn                      │
│   ┌────────────────────────────▼─────────────────────────────────────┐   │
│   │   tencent-news-cli  (腾讯新闻 SKILL CLI, v1.0.14)                  │   │
│   │   run-cli.ps1 <cmd> [args]  →  HTTPS → 腾讯新闻接口               │   │
│   └────────────────────────────┬─────────────────────────────────────┘   │
└────────────────────────────────┼─────────────────────────────────────────┘
                          ┌───────▼────────┐
                          │  腾讯新闻接口    │
                          └────────────────┘
```

### 3.2 关键组件与职责

| 组件 | 进程 | 职责 | 改动性质 |
|---|---|---|---|
| `news:tencent` Server | Node 宿主 | 封装腾讯新闻 SKILL 为 MCP Tool；schema 校验；结果规整；错误转 `isError` | **新增** |
| `TencentNewsCliBridge` | Node 宿主 | 封装 `child_process` 调用 CLI；**按 UTF-8 显式解码**（抓取原始 bytes，规避宿主 GBK 误解码）；超时重试；stdout 解析 | **新增** |
| `StdioJSONRPCTransport` | 双端 | 渲染↔宿主 JSON-RPC 传输（腾讯自选股已落地，复用） | **复用** |
| `MCPClientImpl` + `MCPBridge` | 渲染 | 调用入口 + ACL + 审计 + 计数 | **小改**（注册新源） |
| `adaptiveSourceOrchestrator` | 渲染 | 为 `'tencentnews'` 源开启令牌桶/熔断器/EWMA | **小改（加源 id）** |
| `multiSourceFetcher` | 渲染 | 把 `'tencentnews'` 置为维度 04/05 优先级 1 | **小改（调优先级）** |
| `mcpServerRegistry` / `mcpAclMatrix` | 渲染 | 注册 Server 与权限 | **小改（加条目）** |

---

## 4. MCP 与 SKILL 的对接流程

### 4.1 SKILL 命令 → MCP Tool 映射表

Server 暴露的 Tool 与 SKILL 子命令一一对应：

| MCP Tool | 对应 SKILL 命令 | 关键参数 | 覆盖维度 |
|---|---|---|---|
| `tn_hot` | `hot` | — | 维度 04 泛热点 |
| `tn_search` | `search <kw>` | kw(关键词), limit(返回条数) | **维度 04/05 行业资讯（核心）** |
| `tn_morning` | `morning` | — | 维度 05 早报 |
| `tn_evening` | `evening` | — | 维度 05 晚报 |
| `tn_jiaozhen` | `jiaozhen <claim>` | claim(待核查说法) | 资讯真实性核验 |
| `tn_weather` | `weather` | adcode(可选) | 衍生（默认忽略） |

> **批量与降级**：`search` 按主题串行多关键词（数据采集/数据要素/金融科技/财经）各发 1 次，结果合并；任一关键词失败→该主题降级，不影响其它主题，进入熔断器与审计。

### 4.2 TencentNewsCliBridge 关键设计（含 GBK 解码）

```ts
// 伪代码：CLI 桥接核心（重点处理 GBK 输出）
class TencentNewsCliBridge {
  async invoke(command: string, args: string): Promise<string> {
    const bin = this.resolvedBin() // 优先本地 bin：%HOME%/.tencent-news-cli/bin/tencent-news-cli.exe
    const child = spawn(bin, [command, ...args.split(' ')], {
      timeout: CLI_TIMEOUT_MS,
      env: { ...process.env },
    })
    const raw = await collectRawStdout(child)        // 拼接原始 bytes
    const text = this.decode(raw)                    // ★ 按 UTF-8 显式解码（关键）
    return text
  }
  private decode(buf: Buffer): string {
    // CLI 输出为 UTF-8；Windows 宿主默认按 GBK 误读会乱码，故显式按 utf-8 解码
    return buf.toString('utf8')
  }
}
```

要点：
- **UTF-8 解码（腾讯新闻特有）**：CLI `help`/`hot`/`search` 实测 stdout 为 **UTF-8** 编码；早期的 `鏄吘璁` 类乱码，根因是 **Windows 宿主（PowerShell 默认按系统码表 GBK）直接重定向误解码**，并非 CLI 本身输出 GBK。Bridge 须抓取原始 bytes 并按 `utf-8` 解码后再做 JSON/文本规整——Node 端用 `Buffer.toString('utf8')` 即可，无需 `iconv-lite`。
- **超时即杀**：`timeout` 到期 `child.kill()`，绝不挂起采集主链。
- **错误映射**：CLI 非零退出 / 未配 Key → 抛错 → Server 转 `ToolResult.isError=true`，由采集舱统一降级。

---

## 5. 数据采集舱改造要点

### 5.1 注册与权限（渲染进程）

1. **`mcpServerRegistry.ts`** 新增条目：
   ```ts
   { name:'news:tencent', modulePath:'@/mcp/servers/news/tencentNewsServer',
     exportName:'TencentNewsServer', priority:'high', enabled:true, lazy:true }
   ```
2. **`mcpAclMatrix.ts`**：`ui.allowedServers` 加 `news`；`ui.allowedTools` 加 `tn_*` 只读 Tool（腾讯新闻本就是只读资讯源）。
3. **`mcpServerStore.ts`** 健康检查面板自动纳入（沿用 `check_health` / `health_status` 模式）。

### 5.2 新增 MCP Server

新建 `src/mcp/servers/news/tencentNewsServer.ts`，继承 `MCPServerBase`，`getTools()` 返回 §4.1 全表；每个 handler 委托 `TencentNewsCliBridge` 并做 GBK 解码 + 结果规整。

### 5.3 采集主链路优先级调整

- **`multiSourceFetcher.ts`**：`fetchNews`(04/05) 把 `'tencentnews'` 作为**第一优先**，保留 `canExecute('tencentnews')` 熔断门禁与 `recordSourceResult('tencentnews', …)` 计分；失败后降级到 Tushare/爬虫/Mock。
- **`dataCollectorServer.fetch_market_data`**：无需改动（已由腾讯自选股接管行情维度）；腾讯新闻单独服务资讯维度。

### 5.4 稳定性基座接线

`adaptiveSourceOrchestrator` 无需改造，采集舱调用处传入 `'tencentnews'` 作为 `sourceId`：令牌桶/熔断器/EWMA/重试全部自动生效（同腾讯自选股方案 §5.5）。

---

## 6. 可行性分析

| 维度 | 评估 | 依据 |
|---|---|---|
| 协议复用 | 高 | 与腾讯自选股共用 MCP 栈，新增 Server 即可 |
| 跨进程传输 | 高 | `StdioJSONRPCTransport` 已由腾讯自选股落地 |
| 源接入 | 高 | SKILL 为 CLI，Node 宿主 `child_process` 可直接调用 |
| 数据合规性 | 高 | 腾讯新闻为公开资讯；全程只读，ACL 天然适配 |
| **编码适配** | 中 | CLI 输出 UTF-8，但 Windows 宿主易按 GBK 误解码；Bridge 须按 UTF-8 显式解码（已实测验证） |
| **API Key** | 低 | 用户自取并 `apikey-set` 已完成（2026-08-16 实测可取数） |

**可行性结论**：技术上完全可行，改动收敛在「1 个新 Server + 1 个 CLI Bridge（含 GBK 解码）」，风险可控。

---

## 7. 质量与稳定性提升评估

> 相对**当前未接入腾讯新闻的实测链**（维度 04/05 多为空→Mock）。

| 维度 | 现状（基线） | 接入 MCP+SKILL 后 | 提升性质 |
|---|---|---|---|
| **完整性** | 维度 04/05 常年空→Mock | 热点/行业资讯/早晚报实采 | **显著↑**：维度 04/05 由「缺→Mock」转为「完整实采」 |
| **准确性** | 东财爬虫 HTML DOM（易失效） | 腾讯新闻结构化/标准化资讯 | **↑**：消除解析脆弱点 |
| **行业舆情输入** | 无 | `search` 按主题检索行业资讯，支撑投研复盘 | **新增能力** |
| **连接可靠性** | 直连第三方代理，无统一探测 | 宿主进程 + 连通探测 + `check_health` | **↑** |
| **异常可观测** | 静默 null/[] → Mock | `isError` + 审计留痕 | **显著↑** |
| **限流/熔断** | 无按源隔离 | `adaptiveSourceOrchestrator` 按 `tencentnews` 隔离 | **↑** |

---

## 8. 实施路径（里程碑）

| 阶段 | 交付 | 门禁 |
|---|---|---|
| M1 基座 | `TencentNewsCliBridge`（本地 bin + GBK 解码 + 超时/解析） | 单测：CLI 调用/超时/GBK 解码 |
| M2 Server | `news:tencent` Server（§4.1 全 Tool）+ 注册/ACL | `npx tsc --noEmit` + `audit:layers` + `audit:acl-consistency` |
| M3 接线 | `multiSourceFetcher.fetchNews` 优先级置首 + `recordSourceResult('tencentnews')` | 集成测试：降级 + 熔断 |
| M4 可观测 | cockpit 数据源健康卡片 + 审计纳入 | UI 验证 |
| M5 打包 | Electron 主机承载 + 预装 bin | 打包冒烟 |

> 遵循 AGENTS.md 技能路由：改动 `src/services/data-collector/**` 须跑 `v9-collection-pipeline-testing`（mandatory）；交付前跑 `v9-module-sync-checklist` + `tsc:prod` + `audit:layers` + `audit:acl-consistency`。

---

## 9. 风险与缓解

| 风险 | 严重度 | 缓解 |
|---|---|---|
| **CLI 输出被宿主按 GBK 误解码** | 中 | CLI 本身输出 UTF-8；Bridge 抓取原始 bytes 按 `utf-8` 显式解码（§4.2，已实测） |
| **API Key 缺失** | 高（阻断取数） | 用户自取 `https://news.qq.com/exchange?scene=appkey` 后 `apikey-set`；无 Key 时采集舱降级到既有链 |
| `npx`/CLI 首拉冷启动 | 中 | 预装 `tencent-news-cli` 为本地 bin（本方案已完成安装落盘） |
| CLI stdout 混入日志 | 中 | Bridge 剥离非内容行；解析失败→`isError`→降级 |
| 浏览器无法直接 `spawn` | 高 | 严禁渲染进程调用；统一由 Node 宿主承载（同腾讯自选股形态 A） |
| Electron 打包未携带 | 高 | `electron/main` 承载 Server；`TENCENT_NEWS_CLI` 环境变量指定 bin |
| 资讯时效性/噪声 | 中 | `jiaozhen` 事实核查 + 主题白名单过滤；标注数据时间 |

---

## 10. 与「腾讯自选股」方案的分工

| 数据源 | 主覆盖维度 | 角色 | 在采集舱的位置 |
|---|---|---|---|
| 腾讯自选股 (`marketdata:westock`) | 03 筹码 / 07 指数相关 / 08 研报 + 行情/财务 | 结构化金融数据 | 优先级 1 实采源 |
| **腾讯新闻 (`news:tencent`)** | **04/05 泛资讯/行业新闻/早晚报** | **行业舆情与资讯** | **优先级 1 资讯源** |
| 既有 Tushare/爬虫/代理 | 兜底 | 最终 fallback | 保留为降级链 |

两者经 `multiSourceFetcher` 降级链共存，互不重叠、互补覆盖，共同消除维度 04/05/08 的「常年空→Mock」问题。

---

## 11. 实施进展（Implementation Status）

> 本节记录本方案的实际落地情况（截至 2026-08-16）。

### 11.1 已完成

| 类型 | 内容 | 说明 |
|---|---|---|
| 基础设施 | `tencent-news-cli` 安装 | v1.0.14，SHA256 校验通过，落盘 `%HOME%/.tencent-news-cli/bin/`，写入用户 PATH；`cli-state` 已确认 `cliExists=true` |
| 方案文档 | 本文件 | 对齐腾讯自选股范式的 MCP 整合设计稿 |
| 命令面测绘 | `run-cli.ps1 help` | 实测子命令：`hot`/`search`/`morning`/`evening`/`jiaozhen`/`weather`/`apikey-*` |
| **API Key 配置** | `apikey-set` 已执行并通过 `apikey-get` 验证 | 2026-08-16 完成；Key 持久化到 HKCU 注册表（来源显示「配置文件」） |
| **真实采集（实证）** | 9 个有效命令全 RC=0，共 140 条结构化资讯 | 见 §12；产出资料文档 `deliverables/腾讯新闻-数据采集行业及资讯资料.md` |
| **编码实测结论** | 推翻原「CLI 输出 GBK」假设 | 实测 CLI 输出为 **UTF-8**；乱码是 Windows 宿主按 GBK 重定向误解码所致（§4.2/§9/§12） |
| **M1 基座（代码落地）** | `TencentNewsCliBridge` + 单测 | `src/mcp/servers/news/TencentNewsCliBridge.ts`：本地 bin 解析（options.bin > `TENCENT_NEWS_CLI` env > `%HOME%/.tencent-news-cli/bin/`）+ **自适应解码**（严格 UTF-8 → 严格 gb18030 → 宽松 UTF-8，先拼接全部 stdout 字节再一次性解码，防 chunk 切断多字节序列；主路径即「按 UTF-8 显式解码」，gb18030 回退兼容真 GBK 场景）+ 超时即杀（缺省 20s）+ CliError 五类错误映射。单测 `src/mcp/__tests__/tencentNewsCliBridge.test.ts` 15 用例全绿（含 GBK/UTF-8/跨 chunk 分片/超时/非零退出/空输出/bin 优先级）；门禁：`vitest` 15/15、`tsc:prod` 0 错、`eslint` 0 警告；真实 CLI `help` 端到端验证中文无乱码 |

### 11.2 待办

- [x] **API Key 配置**：用户自取后执行 `apikey-set`，2026-08-16 已验证可取数。
- [x] **真实采集**：用 `search`/`hot`/`morning` 采集「数据采集/数据要素/金融科技/财经/AI数据/算力/科技产业」行业与资讯资料，整理为 `deliverables/腾讯新闻-数据采集行业及资讯资料.md` 补充进项目，并回填本文件「实际采集结果」章节（§12）。
- [x] M1 代码落地（`TencentNewsCliBridge` + 自适应解码 + 单测 15/15，见 §11.1）。
- [x] **M2–M5 代码落地（Server + 注册/ACL + 接线 + 可观测 + 打包）**，遵循项目质量门禁（见 §8）。交付物与门禁实测如下（2026-08-15 续做）：

| 里程碑 | 交付物（路径） | 门禁实测 |
|---|---|---|
| M2 Server | `src/mcp/servers/news/tencentNewsServer.ts`（`marketdata:tencentnews`，6 Tool + `check_health` + `marketdata://tencentnews/health` 资源）；注册 `src/config/mcpServerRegistry.ts` | `tsc:prod` 0 错误；`audit:layers` 0 违规；`audit:acl-consistency` 0 ERROR/WARN |
| M3 接线 | `src/services/data-collector/tencentNewsMcpSource.ts`（`fetchNewsViaTencentNews`/`fetchIndustryNewsViaTencentNews`/`parseTencentNewsText` + `recordSourceResult('tencentnews')`）；`multiSourceFetcher.ts` 插入 `tencentnews` 优先级 0.5（westock 之后、Tushare 之前） | vitest `tencentNewsMcpSource.test.ts` **10/10 通过**（1.49s，线程池） |
| M4 可观测 | `qualityMetricsCollector.ts` / `collectionRuntimeStore.ts`（含 test fixtures）`sourceCounts` 增 `tencentnews: 0` | `tsc:prod` 0 错误 |
| M5 打包 | `electron/tencentNewsHost.ts`（main 进程承载 CLI）+ `electron/main.ts` IPC 句柄 `tencentnews:invoke`/`tencentnews:health` + `electron/preload.ts` 暴露 `window.tencentnews` | `tsc:prod` 0 错误 |

> **门禁总览（2026-08-15 实测）**：`tsc:prod` ✅ 0 错误 · `audit:layers` ✅ 0 违规 · `audit:acl-consistency` ✅ 0 ERROR/0 WARN · `audit:hardcode` ⚠️ 166 项均为**仓库既有**问题（扫描 1482 文件），**本 M1–M5 新增文件 0 命中** · vitest 单测 ✅ 10/10。
> **环境注意**：本沙箱 `vitest` 默认 `forks` 池冷启动会挂起（>5min 无输出），改用 `--pool=threads` 即 1.49s 跑完；属 vitest 环境特性，非代码缺陷。

### 11.3 备注

- CLI 输出实测为 **UTF-8**（非 GBK）；早期乱码是 Windows 宿主（PowerShell 默认按 GBK）重定向误解码所致。真实采集时 Bridge/落盘脚本须**抓取原始 bytes 按 UTF-8 显式解码**，已用 Python 验证可行（本方案 §4.2、§9、§12 已给出缓解与实证）。
- `tencent-news` 平台连接器当前为 disconnected；本方案采用「形态 A 自宿主」（同腾讯自选股），不依赖连接器状态。

---

## 12. 实际采集结果（实证，2026-08-16）

> 本节为方案落地后**真实跑通**的采集实证，作为 §11 的细化与可行性（§6）的实证支撑。

### 12.1 采集命令与结果

| 命令 | 主题/类型 | RC | 结构化条目数 |
|---|---|---|---|
| `hot` | 热点新闻榜 | 0 | 10 |
| `morning` | 今日早报 | 0 | 10 |
| `evening` | 今日晚报 | 0 | 0（18:00 前返回提示文案，非错误，已如实记录） |
| `search 数据采集` | 行业主题 | 0 | 20 |
| `search 数据要素` | 行业主题 | 0 | 20 |
| `search 金融科技` | 行业主题 | 0 | 20 |
| `search 财经` | 行业主题 | 0 | 20 |
| `search AI数据` | 行业主题 | 0 | 20 |
| `search 算力` | 行业主题 | 0 | 20 |
| `search 科技产业` | 行业主题 | 0 | 20 |
| **合计** | 9 个有效命令 | **全部 0** | **140 条**（去重前，按主题分别计） |

- 取数方式：MCP 化腾讯新闻 SKILL → 直接调用 `tencent-news-cli` 子命令（与 §3 设计的 `news:tencent` Server 调用路径一致）。
- 落盘：原始数据归档于 `_tmp_verify/tn_raw/20260816-000358_*.txt`（10 个原始文件 + manifest）；结构化资料文档见 `deliverables/腾讯新闻-数据采集行业及资讯资料.md`。
- 编码处理：Python 抓取 CLI 原始 stdout 字节，按 UTF-8 解码，中文 100% 正常（验证 §4.2 的 UTF-8 解码方案可行）。

### 12.2 采集到的核心产业信号（节选自资料文档）

1. **具身智能数据采集是 2026 年最强主线**：机器人训练真实交互数据需求爆发；「数据采集员」成新兴职业（宿迁等地）；贵州将具身智能数据采集**首次**纳入大数据发展专项资金核心支持方向（20 条即申即享政策、最高奖励 500 万元）；动作捕捉/多模态传感器/数据采集终端产业链成型。
2. **数据要素政策持续加码**：国家《循环经济发展"十五五"规划》《国有文物资源数据管理办法》出台；地方以"真金白银"推动数据产业，数据从"资源"向"要素/资产"加速流通。
3. **AI 数据 + 算力双轮驱动**：真实交互数据被单独采购，算力（国产 AI 模组/数据采集终端）成机器人落地关键约束，数据采集与算力基础设施深度绑定。
4. **金融科技侧合规数据采集**：工商银行等申请数据采集专利，强调"完整性与准确性"，金融数据采集在风控/监管报送场景的合规化需求上升。

### 12.3 对 FinSightV9 的价值验证

- 维度 04/05（泛资讯/行业新闻）由「常年空→Mock」转为**真实结构化资讯**（标题/摘要/来源/发布时间/链接五字段齐备），实证 §7 的"完整性/准确性显著提升"结论。
- 主题检索能力可直接支撑投研复盘的**行业舆情输入**（政策 + 龙头动态 + 新职业/新产业链）。
- 工程层面验证了「CLI 输出 UTF-8、宿主须显式按 UTF-8 解码」这一关键坑，避免后续实现误用 `iconv-lite` 做 GBK 解码而二次出错。

### 12.4 下一步（代码落地）

§8 的 M1–M5 已落地：Server 实际命名为 `marketdata:tencentnews`（对齐 westock 的 `marketdata:westock`），调用路径与 §4.1 设计一致；`TencentNewsCliBridge` 按 UTF-8 解码（非 GBK）；`multiSourceFetcher.fetchNews` 将 `'tencentnews'` 置为维度 04/05 优先级 0.5（westock 之后、Tushare 之前）。

---

## 13. 跨环境可移植性（其他开发环境接入）

> 目标：保证 M1–M5 在任意其他开发机 / CI 上均可跑通，不产生"本机能跑、换机器挂"的路径或密钥漂移。

### 13.1 已验证（本仓库源码 0 风险）

- **零硬编码用户路径**：M1–M5 全部 11 个源文件（Server / Bridge / Source / Host / main / preload / registry / multiSourceFetcher / qualityMetricsCollector / collectionRuntimeStore 及两个 test fixture）经 Grep 扫描 **0 命中** `C:/Users`、`/Users/`、`D:/FinSightV9`、`DELL`、`Huawei` 等用户绝对路径。
- **零硬编码密钥**：API Key **不进入任何源码或提交文件**（`git grep 69e89c82` 在已跟踪文件中返回空）。密钥由 CLI 本地配置持有（`tencent-news-cli apikey-set`），写入用户目录 `~/.tencent-news-cli/`，随用户走、不进仓库。
- **CLI bin 解析全平台可移植**：`electron/tencentNewsHost.ts` 的 `resolveBin()` 顺序为 `env.TENCENT_NEWS_CLI` → `${HOME|USERPROFILE}/.tencent-news-cli/bin/` → `PATH` 兜底；`win32` 自动补 `.exe`，其它平台用无后缀名。无硬编码落盘路径。
- **优雅降级**：CLI 未安装 / 密钥未配置 / 调用超时 → `CliError` 被 `tencentNewsMcpSource` 捕获并 `recordSourceResult('tencentnews',{success:false})`，`multiSourceFetcher` 自动降级到 Tushare→EastMoney→Sina；Electron `init()` 在 bin 缺失时仅 `warn`，**不阻塞主进程启动**。
- **编码自适应**：`TencentNewsCliBridge.decodeCliBytes` 在 UTF-8 → gb18030 → 宽松 UTF-8 间回退，跨宿主 codepage 不崩。

### 13.2 其他开发环境接入前置条件（一次性）

1. **安装腾讯新闻 CLI**（本机形态 A 自宿主，不依赖平台连接器）：
   - 安装后确保 `tencent-news-cli`（Windows 为 `tencent-news-cli.exe`）在 `PATH`，或落在 `~/.tencent-news-cli/bin/`，或用 `TENCENT_NEWS_CLI` 指向自定义绝对路径。
2. **配置密钥（每机各自配置，勿共用 / 勿入库）**：
   ```bash
   tencent-news-cli apikey-set <YOUR_OWN_KEY>
   ```
3. **可选环境变量**：
   - `TENCENT_NEWS_CLI`：自定义 CLI 可执行文件路径（覆盖默认解析顺序）。
   - `TENCENT_NEWS_TIMEOUT_MS`：单次调用超时（默认 20000ms；超时自动 SIGKILL）。

### 13.3 测试运行注意

- 本仓库单测在本沙箱默认 `forks` 池冷启动会挂起（>5min 无输出，属 vitest 环境特性，非代码缺陷）；本机正常 `npx vitest run` 即可。若遇挂起，加 `--pool=threads`：
  ```bash
  npx vitest run src/services/data-collector/tencentNewsMcpSource.test.ts --pool=threads
  ```
- 门禁在普通开发环境按 AGENTS.md 执行：`npm run tsc:prod` / `audit:layers` / `audit:acl-consistency` / `audit:hardcode` / 相关 vitest。

---

## 14. 真实案例基线测试（2026-08-16）

> 目的：对环境与真实案例做基线测试，量化**质量**（字段完整率）与**效率**（延迟），作为 M1–M5 前后对比的参考线，并暴露缺陷。

### 14.1 方法与范围

- 临时基线脚本 `_tmp_verify/tencentNewsBaseline.test.ts`（gitignored，不进提交套件，避免 CI 无 CLI 时失败）。
- **仅 mock `mcpBridge` 的「路由」**（指向真实 `TencentNewsServer` handler），数据层（CLI spawn + 文本解析 + 计分 `recordSourceResult`）**全部真实**。
- 覆盖：6 per-tool 真实调用（hot/morning/evening/search/jiaozhen/weather）+ 2 端到端适配器调用（`fetchNewsViaTencentNews` / `fetchIndustryNewsViaTencentNews`）+ 降级路径 + `check_health`/资源。
- 实时 CLI：`C:\Users\DELL/.tencent-news-cli/bin/tencent-news-cli.exe`；密钥来自 CLI 本地配置文件（非源码）。
- **基线过程中修复 1 个真实缺陷**：`tencentnews_jiaozhen` 原 `buildArgs` 把 claim 当位置参数传（`jiaozhen <claim>`），而 CLI 要求 `jiaozhen --query=<claim>` → 100% 失败；已改为 ` --query=<claim>`。

### 14.2 实测指标（真实 CLI 取数）

| 调用 | 类型 | 延迟(ms) | 条目数 | 字段完整率(title/source/date/url/content) | 备注 |
|---|---|---:|---:|---|---|
| `tencentnews_hot` | per-tool | ~800 | 10 | 10/10/10/10/10 (100%) | 热点榜 |
| `tencentnews_morning` | per-tool | ~940 | 15 | 15/0/0/15/15 | 早报无 source/date 字段（CLI 数据特性，非缺陷） |
| `tencentnews_evening` | per-tool | ~260 | 0 | — | 18:00 前返回提示文案（非错误，已如实记录） |
| `tencentnews_search` | per-tool | ~1100 | 10 | 10/10/10/10/10 (100%) | 行业主题检索 |
| `tencentnews_jiaozhen` | per-tool | 12–20s(波动) | 0 | — | 事实核查工具（非新闻流）；输出非列表格式→0 解析条目；上游延迟大、偶发 20s 超时 |
| `tencentnews_weather` | per-tool | ~600 | 0 | — | 非金融衍生维度；上游 API 对 adcode 失败→0 条目（优雅降级） |
| **`fetchNewsViaTencentNews(hot_news)`** | 端到端 | **~970** | **25** | title/url/content 25/25；source/date 10/25（仅 hot 部分有） | hot 10 + morning 15 合并 |
| **`fetchIndustryNewsViaTencentNews`** | 端到端 | **~1250** | **20** | 20/20/20/20/20 (100%) | search×2（数据采集 + 金融科技）各 10 |

### 14.3 降级与健壮性（全部符合预期）

- `TENCENTNEWS_DISABLED=1` → `fetchNewsViaTencentNews` 返回 `null`（跳过，不崩）。
- `announcement` 类别 → 返回 `null`（腾讯新闻无个股公告维度，正确降级）。
- `check_health` → `{"ok":true,"source":"tencentnews","server":"marketdata:tencentnews"}`；资源暴露 `marketdata://tencentnews/health`（application/json）。
- CLI 缺失 / 超时 / 非零退出均被 `TencentNewsCliBridge` 捕获 → 适配器 `recordSourceResult({success:false})` → `multiSourceFetcher` 自动降级其它源，**主流程不中断**。

### 14.4 质量与效率结论（vs M1–M5 之前）

- **之前**：维度 04/05（泛资讯 / 行业新闻）常年空 或 Mock，无真实结构化资讯。
- **之后**：真实结构化资讯（标题 / 摘要 / 来源 / 时间 / 链接五字段），维度 04/05 由「空 → 真实」。
  - **质量**：`hot` / `search` 端到端 100% 字段完整；行业检索 20 条全字段齐备，可直接支撑投研复盘行业舆情输入。
  - **效率**：单次聚合取数 **< 1.3s**（hot_news 25 条 ~0.97s；行业 20 条 ~1.25s），满足采集舱实时性；CLI 单次调用 0.25–1.15s，无瓶颈。
- **已知改进项（非阻断）**：
  1. `jiaozhen` 事实核查工具上游延迟大（偶发 ~20s 超时），且其输出非新闻列表→0 解析条目；它**不在**新闻采集主路径（`fetchNews` / `fetchIndustry` 仅用 hot/morning/search），不影响维度 04/05 质量/效率。若后续在 UI 暴露事实核查，需单独适配其结果格式并加超时保护。
  2. `morning` 早报缺 source/date 字段（CLI 数据特性）；聚合后 source/date 仅 hot 部分有。如需早报也带 source/date，推动 CLI 侧补全或适配器补默认。
  3. `weather` 非金融衍生维度，上游偶发失败→0 条目，已优雅降级，不影响主流程。

### 14.5 复跑方式

```bash
npx vitest run _tmp_verify/tencentNewsBaseline.test.ts --pool=threads
```

（需本机已装 CLI 且 `apikey-set`；脚本位于 gitignored 的 `_tmp_verify/`，不进提交测试套件。）

---

## 15. 质量 / 效率修复与复测（2026-08-16 续）

> 在 §14 基线基础上，针对暴露的两个真实缺陷做修复，并复测确认质量与效率达标。

### 15.1 修复清单

| # | 缺陷 | 根因 | 修复 |
|---|---|---|---|
| F1 | **缓存穿透禁用/熔断**：`TENCENTNEWS_DISABLED=1` 或源熔断时，`withCache` 仍返回旧缓存数据，导致 DISABLED 失效、熔断穿透 | 缓存读取在守卫（`isTencentNewsEnabled`/`canExecute`）**之前** | 在 `fetchNewsViaTencentNews` / `fetchIndustryNewsViaTencentNews` 中将禁用/熔断守卫提到 `withCache` **之外**，禁用/熔断直接 `return null`，绝不返回缓存旧值；失败/空结果依旧不写入缓存 |
| F2 | **`jiaozhen` 必超时**：`tencentnews_jiaozhen` 上游常态 >20s，被 Bridge 实例级 20s 超时误杀 → 100% 失败 | 单命令无独立超时；事实核查天然慢 | `TencentNewsCliBridge.invoke` 增加 `options.timeoutMs` 覆盖；`TencentNewsServer` 为 `jiaozhen` 设 `timeoutMs: 60_000` 透传，避免误杀（hot/morning/search 仍走 20s 默认，不影响主路径失败快速暴露） |
| F3 | **早报被整体丢弃 + 字段漏**：`multiSourceFetcher` 对结果 `slice(0,10)`，而 `fetchNewsViaTencentNews` 返回 hot(10)+morning(15)=25，早报 15 条全被切掉；且早报缺 source/date | 聚合未去重/未交织/未补默认 | `fetchNewsViaTencentNews` 改为：早报补默认 `source='腾讯新闻·早报'`、`date=今天` → 字段完整；hot/morning 按标题去重；交织（实时 hot 前 7 + 早报 morning 前 3）使 top10 同时覆盖实时与早报，整体字段完整率 100% |
| F4 | **多标的重复 spawn CLI（效率）** | `fetchNews(symbol,'hot_news')` 按标的逐个调用，而腾讯新闻 hot/morning 与标的无关，无缓存 → N 标的 = N 次重复 CLI | 增加模块级 TTL 缓存（hot_news 60s / industry 5min）+ **in-flight 去重**（并发首调共享同一 Promise），失败/空不缓存；TTL 可经 `TENCENTNEWS_CACHE_TTL_MS` 覆盖 |

### 15.2 复测指标（真实 CLI，2026-08-16 续测）

| 调用 | 延迟(ms) | 条目 | 完整率 | 备注 |
|---|---:|---:|---|---|
| `tencentnews_hot` | 998 | 10 | 10/10/10/10/10 | 热点榜 |
| `tencentnews_morning` | 707 | 15 | 15/0/0/15/15 | 早报本身缺 source/date（CLI 特性） |
| `tencentnews_evening` | 95 | 0 | — | 18:00 前提示文案 |
| `tencentnews_search` | 803 | 10 | 10/10/10/10/10 | 行业检索 |
| `tencentnews_jiaozhen` | **36795** | 0 | — | **修复后 isError=false**（60s 超时内成功，之前必超时失败） |
| `tencentnews_weather` | 450 | 0 | — | 非金融衍生维度，优雅降级 |
| `fetchNewsViaTencentNews(hot_news)` | 678 | **10** | **10/10/10/10/10 (100%)** | 交织后 top10 同时含实时+早报，字段完整率由 10/25 → 100% |
| `fetchIndustryNewsViaTencentNews` | 1265 | 20 | 20/20/20/20/20 | 行业检索 100% |
| 缓存命中（二次同采集周期调用） | **0** | — | — | 首次真实 CLI 635ms → 二次命中缓存 0ms |

### 15.3 降级复测（修复后符合预期）

- `TENCENTNEWS_DISABLED=1` → `fetchNewsViaTencentNews` 返回 `null`（**不再穿透缓存返回旧数据**）。
- `announcement` → `null`（正确降级）。
- 单测 `tencentNewsMcpSource.test.ts`：**12/12 通过**（新增「缓存命中不重复 spawn」「仅早报补默认」两用例）。
- 门禁：`tsc:prod` ✅0、`audit:layers` ✅0、`audit:acl-consistency` ✅0/0、相关 vitest ✅。

### 15.4 质量 / 效率结论（最终）

- **质量**：维度 04/05 交付 top10 字段完整率 **100%**（实时热点 + 早报行业头条交织覆盖）；行业检索 100%；禁用/熔断守卫在缓存之外，降级语义正确。
- **效率**：同采集周期内多标的（如 50 只）聚合取数由「50×2 次 CLI spawn」收敛为「1 次真实调用 + N−1 次缓存命中（0ms）」，采集主链无冗余 CLI 开销；单次聚合 < 1.3s，无瓶颈。
- **遗留（非阻断）**：`jiaozhen` / `weather` 输出非新闻列表、上游波动，已各自加超时/降级保护，不在新闻主路径，不影响维度 04/05 质量与效率。

---

## 16. 维度 05 质量再加固：生产入口合并 westock + 腾讯新闻（2026-08-16 续二）

> §14/§15 已在「腾讯新闻源自身」达到 100% 字段完整 + 缓存提效。但复测发现一个**生产接入层的真实质量缺口**：`multiSourceFetcher.fetchNews` 旧实现中，westock（步骤 0）一旦返回数据即 **early-return**，`fetchNewsViaTencentNews`（步骤 0.5）被**阴影遮蔽**——只要 westock 有数据，维度 05 就只剩 westock 的个股公告，新接入的腾讯新闻 richer 泛资讯/行业舆情永远进不来。

### 16.1 修复：hot_news 并行双源合并去重

- `fetchNews(symbol,'hot_news')` 改为 **`Promise.all` 并行**取 westock（个股公告/新闻）+ 腾讯新闻（泛资讯/行业舆情），`collected` 合并后 `dedupeNewsItems` 去重 → `slice(0,10)`。
- **优先级保持**：westock 先 `push`，去重时保留首次出现 → westock 项天然靠前（个股维度优先）。
- **去重键**：优先按**标题**归一化（避免两源重复报道同一事件被算两条），标题缺失退化 `url/id`。
- **效率无损**：腾讯新闻带 60s TTL 缓存（F4），并行取数对采集主链几乎零额外成本；相对旧串行早返回，并行反而**降低**端到端延迟。
- **announcement 维度语义不变**：腾讯新闻对该维度返回 `null`（无个股公告能力），`tencentTask` 直接 `Promise.resolve()`，仅 westock 贡献，降级链照旧。

### 16.2 复测指标（真实 CLI，2026-08-16 续二测）

| 用例 | 结果 |
|---|---|
| `fetchNews('sh600519','hot_news')` 真实生产入口 | **712ms，10 条，腾讯新闻贡献=10**（本沙箱 westock CLI 未装→全来自腾讯新闻；单元已证明 westock 优先+去重确定性） |
| 字段完整率（top10） | title/url/content 10/10（100%） |
| 单测 `multiSourceFetcher.tencentnews.test.ts`（新增，7 用例） | **7/7 通过**：双源合并/同标题去重/westock 优先/单源缺失/超 10 截断/announcement 仅 westock/双源皆空降级 |
| 回归 `tencentNewsMcpSource.test.ts` + `multiSourceFetcher.test.ts` | **34/34 通过**（无回归） |
| 门禁 | `tsc:prod` ✅0、`audit:layers` ✅0、`audit:acl-consistency` ✅0/0、相关 vitest ✅ |

### 16.3 质量 / 效率结论（最终）

- **质量（维度 05）**：修复前 westock 有数据即遮蔽腾讯新闻；修复后无论 westock 有无数据，腾讯新闻 richer 泛资讯/行业舆情**必然进入**维度 05，与 westock 个股公告**互补合并**，top10 同时覆盖「个股 + 市场泛资讯」，字段完整率 100%。
- **效率**：并行双源 + 腾讯新闻 TTL 缓存，采集主链无冗余 CLI 开销；相对旧实现（串行 + 阴影遮蔽），延迟不增反降。
- **健壮性**：双源任一失败/空均被 `try/catch` 隔离，不影响另一源；双源皆失败才走 Tushare/东财/新浪降级链，主流程不中断。
