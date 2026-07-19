---
title: TODO-ADD-TITLE
type: reference
domain: architecture
phase: design
tier: standard
status: active
maintainer: V9 Architecture Team
summary: "本文回答\"系统怎么搭、模块怎么连、未来怎么�?*\"。权威基线：`AGENTS.md`（分层契约）、`docs/explanation/system-architec..."
tags: [architecture, guide, list]
version: v1.0.0
last_updated: 2026-07-17
code_version: 2.0.0
change_log:
  - version: v1.0.0
changes: Initial version established
date: 2026-07-17
---

# 02 · 整体架构设计思路（Overall Architecture�?
> 本文回答"**系统怎么搭、模块怎么连、未来怎么�?*"。权威基线：`AGENTS.md`（分层契约）、`docs/explanation/system-architecture.md`、`docs/explanation/architecture.md`、`docs/reference/gateway-write-permission-spec.md`、`docs/explanation/adr-001-pure-frontend-architecture.md`�?> ⚠️ �?`README.md` 文档漂移提示：Gateway 网关当前�?*目标架构**，DataBridge 仍直�?`db`�?
---

## 1. 架构总览（L5 �?L1 五层视图�?
```
L5 表现�?  pages / components / portal / cockpit
L4 应用�?  apps（React.lazy 三级加载链中间层�?L3 引擎�?  services / agents / core / 数据�?dataflow)
L2 数据�?  data / db（IndexedDB�?L1 基础设施 src/lib / config / core
```

五大业务舱（Cabin）映射：

| �?| 目录 | 职责 |
|----|------|------|
| 输入�?| `input` | 采集任务、七维配�?|
| 分析�?| `analysis` | 热门板块/行业评分/智能评分/多因子筛�?回测 |
| 交易�?| `trading` | 持仓/组合/风控/策略快照/交易流（可选插件） |
| 输出�?| `output` | 仪表�?研报/复盘向导 |
| 总控�?| `command` | MCP 看板/智能体看�?系统健康/能力展示 |

渲染链路：`main.tsx �?App.tsx �?portal/PortalShell.tsx �?apps/*/XxxApp（lazy）→ pages/*`

---

## 2. 分层与依赖规则（禁止跨层调用�?
`AGENTS.md` §一 定义 `src/` �?**23 个目�?*的分层与依赖方向。核心约束：

| �?| 可依�?| 禁止依赖 |
|----|--------|----------|
| `pages/components` | `store` / `services` | 直连 `db` / `dataLayer` |
| `store` | `services` / `core` | 直连 `db` |
| `services` | `core` / `data` / `lib`（基础设施�?| 直连 `db`（写必须�?DataBridge�?|
| `core` | �?| `pages/components/apps/lib` 业务模块 |
| `lib` | `core` / `config` | `services/store/pages/components` |
| `config/constants/types` | 零依�?| 任何运行时模�?|
| `workers` | `core/lib/config/data/types/constants` | `store/pages/components/apps` |

**关键写约�?*：`services` 所有写入必须封装为 `StandardEnvelope` 并经 `DataBridge.forward()`，最终由 `data/gateway/`（目标）执行�?
验证：`npm run audit:layers`（目�?0 violations）�?
---

## 3. 核心运行时基础设施（src/core�?
| 模块 | 职责 |
|------|------|
| `databridge.ts` |
| `databridgeAcl.ts` | ACL 校验子模块：assertQueryAcl / assertAclWithFallback / isMarketEnvelope，从 databridge.ts Phase 1 提取 |
| `databridgeHandlers.ts` | HandlerRegistry + EnvelopeHandler 类族 |
| `databridgeRouter.ts` | routeToQuery / routeToEvent / routeToManager |
| `databridgeStrategyRouter.ts` | STRATEGY_CHANNEL + routeToStrategy 策略路由 | 唯一切面入口：校验信�?�?ACL 鉴权 �?审计日志 �?路由 �?广播变更事件 |
| `envelope.ts` | 统一消息信封 `{ meta, payload }`，meta �?`source/target/action/traceId` |
| `acl.ts` | 基于 `ACL_MATRIX` �?module→store→operation 鉴权�?最后一公里"深度防御�?|
| `memoryCache.ts` | 内存缓存（默�?TTL 10s、LRU 200 条、`performance.now()` 时间戳） |
| `eventBus.ts` | 跨模块事件总线；写�?`emit("${store}Changed")`，订阅方自动刷新 |

---

## 4. 数据流（Data Flow�?
### 4.1 写路径（采集 �?存储�?```mermaid
sequenceDiagram
    participant S as Service
    participant DB as DataBridge
    participant A as ACL
    participant G as data/gateway (目标)
    participant D as IndexedDB
    participant E as EventBus
    S->>DB: forward(Envelope)
    DB->>DB: EnvelopeFactory.validate()
    DB->>A: assertAclWithFallback()
    A-->>DB: pass / reject(入队重试)
    DB->>G: routeToAction()
    G->>D: db.put / store.save
    DB->>DB: invalidateCache(store)
    DB->>E: broadcast(store, envelope)
    E-->>Store: "${store}Changed" �?Zustand set()
```

### 4.2 �?/ 响应路径
- Store 订阅 EventBus 频道 �?`set()` 更新 Zustand �?组件 `useStore()` 重渲染�?- 或直接经 `dataBridge.query()` / `dataLayer` 查询�?
### 4.3 驾驶舱采集管�?```mermaid
flowchart LR
    TS[TaskScheduler] --> C[Collector: Mock/REST/WebSocket]
    C --> R[RawMarketData]
    R --> A[MarketDataAdapter.adapt]
    A --> P[MarketDataProvider.setData]
    P --> U[useMarketData]
    U --> W[Widget 重渲染]
```

**核心原则**：统一数据入口（写库必�?DataBridge）；事件驱动刷新（写库后广播 `${store}${CHANGED_SUFFIX}`，订�?Store 自动更新并触发视图重渲染）�?
---

## 5. 五舱与驾驶舱（Cockpit�?
- 驾驶舱基�?**React-Grid-Layout** 实现可拖�?可缩�?Widget；所有数据收敛到 `MarketData` 接口，经 `MarketDataProvider` 注入�?- 五大核心 Widget：A 投资画像/分析中心、B 股票池管理监控、C KAI 选股综合评分、D AI 大模型智能对比、E 个股/市场深度分析聊天�?- 当前已注�?**33 �?Widget**；新�?Widget �?`03-ui-components.md` §3 �?三处注册"�?
---

## 6. 扩展能力（分布式 / 任务部署可扩展性）

当前�?*纯前端、无服务�?*架构（ADR-001），但有意识地把扩展能力放在以下维度�?
| 扩展维度 | 机制 | 文件 |
|----------|------|------|
| **多实例一致�?* | �?Tab 广播（`withBroadcast` 封装 `eventBus.emit`，主动同�?`${store}Changed`�?| `src/lib/withBroadcast.ts` |
| **算力横向扩展** | Web Worker 计算池（�? Worker），重计算移出主线程，失败自动回退主线�?| `src/services/workers/v6ScoreTaskScheduler.ts` + `v6ScoreWorker.ts` |
| **任务调度/部署** | Agent 运行�?+ 任务队列（`agentRuntime`/`taskQueue`/`agentHealthMonitor`），订阅 `AGENT_*` 事件 | `src/agents/` |
| **能力横向扩展** | MCP 协议接入无限第三方工�?数据�?5 �?Server，双�?ACL 校验�?| `src/mcp/` |
| **AI 记忆/检�?* | 倒排索引 `public/ai-memory-index.json`，`queryMemory()` 关键词检�?| `scripts/build-ai-memory-index.ts` + `src/services/system/aiMemoryService.ts` |

### 6.1 关于"分布式任务部�?的诚实说�?- **现状边界**：所有数据在单一浏览�?IndexedDB 内，无服务端、无跨机调度。所�?分布�?目前体现�?*客户端多实例（跨 Tab�? Worker 并行 + MCP 远程能力调用**三层�?- **未来路径**：当规模 > 1 万用户且需集中数据管理时（ADR-001 回滚条件），�?V10 评估引入服务端；届时 Gateway 网关（`dataGateway.execute()` 单一写入口）即是为该演进预留的收口点——当前先把写权限逻辑收敛�?`DataBridge` + `ACL_MATRIX`，降低未来迁移成本�?
---

## 7. 质量门禁（Quality Gates�?
| 门禁 | 命令 | 作用 |
|------|------|------|
| 分层调用 | `audit:layers` | 目录分层合规 |
| 原子层级 | `audit:atomic` | 组件跨层 import 禁令 |
| 颜色硬编�?| `lint:colors` | 强制设计令牌 |
| 令牌扫描 | `audit:tokens` | 无令牌硬编码违规 |
| 文档同步 | `audit:docs` | 触发→更新映射一�?|
| JSDoc | `audit:jsdoc` | 公共实体必须�?JSDoc |
| 复杂�?| `audit:complexity` | 嵌套/链式/重复 if 债务只减不增 |
| 硬编�?| `audit:hardcode` | 硬编�?URL/颜色基线 |
| 合流 | `gate:dev` / `gate:quick` | 串联多项门禁 |

---

## 附：架构图可视化
- 源文件：`docs/architecture/architecture-diagrams.html`（分层图/数据流图/舱室地图）�?- 本文 Mermaid 图需在支�?Mermaid 的查看器（GitHub、VS Code Mermaid 插件、Typora）中渲染�?