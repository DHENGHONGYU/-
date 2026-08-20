---
title: 04 - 依赖关系与数据流
type: wiki
domain: architecture
status: frozen
maintainer: FinSightV9 Team
version: 2.0.0
last_updated: 2026-08-19
code_version: "2.0.0-rc.2"
tag: FINAL
doc_id: V9-DOC-WIKI-004
---

# 04 - 依赖关系与数据流 🏁

> 文档体系版本: **v2.0.0 · FINAL** | 本文档修订: rev.3（最终版 · 两轮交叉核对 · 修正信封协议 TARGET=14/ACTION=97/audit聚合=22项 等 6 项）| 基于 AGENTS.md v1.6.0 §一依赖方向规则编写

## 1. 层间依赖规则（强制）

```
                 ┌──────────────────────────────────────┐
   只能向下依赖   │  L5  pages/ components/ cockpit/ portal/ │
                 │  L4  apps/                            │
                 │  L3  services/ agents/ mcp/ hooks/    │
                 │  L2  store/ core/ data/ domain/       │
                 │  L1  lib/ config/ constants/ types/ schema/ │
                 └──────────────────────────────────────┘
```

**逐层依赖白名单**（摘自契约，违规由 `npm run audit:layers` 报错）：

| 层 | 可依赖 | 禁止 |
|----|--------|------|
| `pages/` `components/` | store/、services/、domain/ | 直接调用 dataLayer 或 db |
| `store/` | services/、core/、domain/ | — |
| `services/` | core/、data/、lib/（基础设施白名单）、domain/ | 直接写 db；写入必须走 `DataBridge.forward(StandardEnvelope)` |
| `domain/` | lib/（白名单）、data/types/、config/、constants/、types/ | services/、store/、pages/、components/、core/、apps/ |
| `data/` | dataLayer 子模块（dataLayerStockStores/dataLayerScoreStores 等）仅被同级 data/ 基础设施与 core/databridge 依赖 | — |
| `core/` | lib/ 基础设施白名单；DataBridge 写操作必须委托 data/ 执行 | 直接 `import { db }` 或 dataLayer store |
| `lib/` | core/、config/ | services/、store/、pages/、components/、apps/、domain/ |
| `config/` | lib/ 基础设施白名单 | services/、pages/、components/ |
| `constants/` `types/` `generated/` | 零依赖 | 任何运行时模块 |
| `agents/` | core/、data/ | — |
| `hooks/` | store/、services/、lib/ | — |
| `apps/` | pages/、components/、store/、services/ | — |
| `mcp/` | core/、data/、lib/、services/ | — |
| `services/workers/` | core/、lib/、config/、data/、types/、constants/ | store/、pages/、components/（Worker 纯计算层） |

**lib 基础设施白名单**（core/services/domain 可用的 lib 模块）：`logger`、`logHelpers`、`withBroadcast`、`eventBus`、`format`、`errors`、`utils`、`localStorageManager`、`safeCoerce`、`perf`、`precision`、`validation`、`safeRegex`——其余 lib 模块视为业务模块，依赖即违规。

**依赖反转设计**：Core 层路由器（databridgeStrategyRouter 等）不 import Services，而是在 main.tsx 启动时由 `setStrategyAnalyzers()` / `setFeedbackServices()` / `setPipelineServices()` / `setIndustryAnalysisServices()` 注入回调，保证依赖方向始终向下。

## 2. DataBridge 信封协议数据流（核心机制）

### 2.1 写路径

```
组件/Service 发起写操作
    │
    ▼
DataBridgeAdapter.create()          # 组装 StandardEnvelope { meta, payload }
    │
    ▼
DataBridge.forward(envelope)
    │
    ├─→ AclEngine.check()           # ACL_MATRIX 权限校验（module × store × operation）
    │       │ allowed:false → 返回失败 Result（纵深防御，不落库）
    │
    ├─→ routeToDB(envelope, store)     # 按 ACTION_TO_STORE_MAP 定位目标 Store
    │
    ▼
db（V6Database 实例）写入 IndexedDB（V6ProDB）
    │
    ▼
广播事件（eventBus / query:{store}）→ Zustand Store 更新 → UI 重渲染
```

> 注：契约（AGENTS.md §一）将写入口表述为 `data/gateway/`（规划性"网关"角色）；实际代码中该角色由 [databridge.ts](../../src/core/databridge.ts) 的私有方法 `routeToDB()`（L716）与 [databridgeRouter.ts](../../src/core/databridgeRouter.ts) 承担，物理目录未落地。全局管理动作（resetAll/importAll/exportAll）由 `routeToManager()` 直接委托 `db`。

### 2.2 读路径

```
组件 selector 订阅 Store
    │
    ▼
Service 调用 DataBridge.query(envelope)
    │
    ├─→ 等待 DB 就绪（V6Database.init()）
    ├─→ MemoryCache 命中检查（LRU + TTL）── 命中直接返回
    ├─→ ACL 校验
    │
    ▼
databridgeRouter.routeToQuery()     # envelope → QueryRequest
    │
    ├─→ queryGet  → db.get
    ├─→ queryList → db.getAll
    └─→ queryByIndex → db.getAllByIndex
    │
    ▼
结果写缓存 + 审计日志 → 广播 query:{store} → Store 更新
```

### 2.3 StandardEnvelope 结构

```typescript
{
  meta: {
    action: ENVELOPE_ACTION,    // 97 个：如 'INSERT_STOCK' / 'SAVE_SCORES' / 'QUERY_GET' / 'BULK_SAVE_*' 等
    target: ENVELOPE_TARGET,    // 14 个：'db' | 'analyzer' | 'ui' | 'tradinghub' | 'system' | 'event'
                                //       | 'strategy:hotSector' | 'strategy:valuePit' | 'strategy:rotationSignal'
                                //       | 'executionPlans' | 'executionLogs' | 'missingReports' | 'portfolios' | 'tradeReviews'
    timestamp, traceId, moduleId, ...
  },
  payload: { ... }              // 业务数据
}
```

**铁律**：所有跨模块写操作必须走此协议；新增 EnvelopeAction 必须同步 dbConfig.ts 的 ACTION_TO_STORE_MAP 并跑 `npm run audit:acl-consistency`。

## 3. 五段投研数据流闭环

```
① 采集                ② 分析                ③ 筛选
data-collector  →   v6-engine / analysis  →  screeningEngine
fetcher/multiSource   industryAnalysis        multiFactorScreening
（腾讯/新浪/AKShare/   intelligentScore        （结果持久化 screening_results）
 Tushare/MCP/LLM）    hotSector/valuePit
        │                   │                     │
        ▼                   ▼                     ▼
   daily_quotes         v6_scores /          候选池状态流转
   news / 财务           industry_scores      candidate → screened → deepDive
                                             → watching → archived
                                                    │
④ 复盘                ⑤ 报告                    ▼
tradeReviewAI      generated_reports        执行计划/交易下单
rles-engine        report_templates         orders / portfolios
observation_reviews（观察池跨重启复盘）       execution_logs
```

每段的过程产物均有 IndexedDB Store 兜底（storage-as-bottom-layer 原则），刷新/重启不丢数据。

## 4. 外部数据源依赖拓扑

```
浏览器 / Electron
    │
    ├─ 开发模式：Vite dev server :5199 代理
    │    ├─ /api/collect   → Python Collector :8000（AKShare）
    │    ├─ /api/akshare   → Python Collector :8000
    │    ├─ /api/embed     → Embedding Service :8001
    │    ├─ /health        → 健康检查
    │    ├─ 腾讯行情代理    → qt.gtimg.cn（GBK→UTF-8 转码 + gzip/deflate/br 解压）
    │    │    └─ 自定义插件 tencent-kline-proxy（手工转发，避免 query 逗号编码问题）
    │    └─ 新浪行情代理    → hq.sinajs.cn（GBK→UTF-8）
    │
    └─ 生产模式（Electron）：electron/proxy.ts 同规则本地代理
    
    直连（无代理）：LLM API（DeepSeek 等，Key 经 UI 页 AES-GCM 加密存 localStorage）
                  Tushare Pro / iFinD / Kimi（经 services/fetcher 或 MCP 源）
```

**编码转换要点**：腾讯/新浪返回 GBK 编码，Vite 代理使用 `TextDecoder('gbk')` + `selfHandleResponse` 处理；目标 URL 必须用 `127.0.0.1` 避免 IPv6 解析错位。

## 5. 状态管理依赖（Zustand）

- Store 间通信：`withBroadcast` 中间件（跨 Tab 广播）+ `eventBus`
- **响应式铁律**：组件必须 selector 订阅数据字段；派生函数分三类（Selector Hook `use*` / 纯函数 / `@nonReactive` 标注的 getState 查询）
- Store 注册表：`storeRegistry.ts` 管理活跃/废弃状态与迁移说明
- 派生函数集中导出：`derived.index.ts`

## 6. MCP 服务器体系依赖

```
src/mcp/
├─ core/     # registry（注册表）、client、server、transport、mcpAclMonitor、sampling、elicitation
├─ bridge/   # mcpBridge 桥接
└─ register.ts

配置真相源：src/config/mcpServerRegistry.ts（15 条目：10 enabled + 5 disabled）
  enabled：fetcher / scoring / news / llm / screening / backtest / trading / system / marketdata / pool / data-collector
  disabled（僵尸治理）：analysis / portfolio / knowledge / execution / workflow:main（保留通道校验）

ACL：mcpAclMatrix.ts 定义 ui 角色对查询/导出类 Tool 的授权；写操作一律拒绝
校验：npm run audit:mcp / audit:mcp-usage / audit:acl-consistency
```

## 7. 质量门禁依赖链（Husky）

```
git commit
  └─ pre-commit（22 步）
       ├─ lint-staged（eslint --fix + 颜色令牌校验）
       ├─ tsc:prod（生产类型检查，tsconfig.prod.json 仅源码）
       ├─ audit:registry / audit:layers / audit:atomic / audit:db-references
       ├─ audit:store-coverage / audit:acl-consistency / audit:deadcode
       ├─ vitest registryContract
       ├─ scope-guard v2（单提交≤30 文件、跨顶层域≤2、防临时产物混入）
       └─ skill-router --remind（技能路由提醒）
git push
  └─ pre-push（6 步）
       ├─ gate:quick（layers/mock-modules/acl/atomic/docs/doc-id/db-references/deadcode）
       ├─ widget-registry + complexity-scan
       └─ skill-router --enforce（mandatory 技能未确认即拦截）
```

日常命令速查见 [05 运行方式](05-getting-started.md) §5。

---

## 🏁 修订记录摘要（v2.0.0 FINAL · 两轮共 24 项事实漂移）

**本文档涉及的 6 项修正：**

| # | 漂移项 | 旧值 | 新值（最终）| 核实真相源 |
|---|-------|------|-----------|----------|
| 1 | StandardEnvelope.meta.action 注释数 | "98 个" | **"97 个"（含完整示例）** | `dbConfig.ts` ENVELOPE_ACTION 计数 |
| 2 | StandardEnvelope.meta.target 注释数+列表 | "17 个…" 粗略 | **"14 个"+ 完整枚举 14 项名称** | `dbConfig.ts` ENVELOPE_TARGET 逐行 |
| 3 | pre-commit 主步数 | 模糊 | **22 主步**（门禁链精确标号）| `.husky/pre-commit` 逐段标号 |
| 4 | pre-push 主步数 | 模糊 | **6 主步** 串行 | `.husky/pre-push` 逐段标号 |
| 5 | `npm run audit` 聚合项数 | 21 项 | **22 项**（补 audit:complexity-scan 为 22）| `package.json` L145 audit 命令链逐 && 计数 |
| 6 | Electron 侧车端口职责 | 与 Vite 5199 混淆 | **Electron dev URL: 3000 / Collector:8000 / Embedding:8001 / Daemon:8765** 四端口分流 | `electron/sidecar.ts` + `package.json` electron:dev |

> 完整 24 项漂移清单、两轮轮次归属、验证方法声明 → 见 [README.md §修订记录](README.md#🏁-修订记录--24-项事实漂移全清单v200-final)
