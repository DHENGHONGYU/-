---
doc_id: V9-DOC-EXP-967
title: v10-architecture-alignment
code_version: "2.0.0-rc.1"
tier: important
version: v1.0.0
last_updated: 2026-08-11
change_log:
  - version: v1.0.0
    changes: "C 类版本闭环(2026-08-11)：补全 change_log 初始条目"
    date: 2026-08-11
---

# V10 架构白皮书与 V9 对齐报告

> **Status: Future Reference / Deferred**  
> 本文档为外部参考蓝图，仅用于与 V9 当前架构对齐参考，禁止直接作为当前 V9 代码依据。任何落地须先经过 ADR 评审并更新 `docs/01~10` 规格。

> 将 `(参考文档)v10-architecture-whitepaper.md` 的框架性设计思想与 V9 当前实现进行校对，明确**可直接吸收**、**需适配后吸收**、**暂不采纳**三类内容，统一纳入 V9 文档体系。

---

## 1. 总体对照

| 维度 | V10（v6-pro-cockpit） | V9 当前 | 对齐建议 |
|------|----------------------|---------|----------|
| 核心定位 | 面向 A 股的个人智能投研系统 | 一致 | ✅ 保持 |
| 技术栈 | React 19 + TS + Vite + Tailwind + shadcn/ui + Zustand + IndexedDB + Dexie | React 19 + TS + Vite + Tailwind + Zustand + IndexedDB（原生） | ✅ 基本一致，V9 使用原生 IndexedDB 而非 Dexie |
| 架构分层 | 五层 + agents + trading gateway + sector factor | 五层，无 agents/独立 trading gateway | ⚠️ 保留五层，agents/gateway 作为可选扩展 |
| 数据 Schema | 20 个 ObjectStore | 8 个 Store | ⚠️ 按需扩展，避免一次性复制 20 个 Store |
| 通信机制 | StateBoard + eventBus + DataBridge | DataBridge + eventBus | ⚠️ 可借鉴 StateBoard 字段契约思想 |
| 交易体系 | 独立 trading gateway（模拟/真实券商） | `src/services/trading/` 引擎 | ⚠️ 保持服务层下沉，未来可抽象 gateway |
| UI 范式 | 三舱硬隔离（研究/交易/系统）+ 回路横幅 | 五舱深色经典布局 | ⚠️ 保留五舱，借鉴回路/锁定思想 |
| 离线可用 | 必须离线 | 一致 | ✅ 保持 |

---

## 2. 可直接吸收的内容

### 2.1 架构原则

| V10 原则 | V9 落地方式 |
|----------|-------------|
| 数据优先，界面其次 | 已在 `03-architecture-standards.md` 强调 schema 最高优先级 |
| 研究体系不依赖交易层 | 已在 `03-architecture-standards.md` 写明；交易引擎已下沉到 `src/services/trading/` |
| 采集层只采集不计算 | 已在 `fetcherService` 中遵循；需在 `05-engine-specs.md` 中显式声明 |
| 分析层不直接输出交易策略 | V9 `v6ScoreService` 仅输出评分，交易信号由 `signalGenerator` 生成；符合 |

### 2.2 数据层扩展参考

V10 20 个 Store 中，V9 已有或近期可扩展的 Store：

| Store | V9 现状 | 建议 |
|-------|---------|------|
| `stocks` | ✅ | 保持 |
| `daily_quotes` | ✅ | 保持 |
| `v6_scores` | ✅ | 保持 |
| `intelligent_scores` | ✅ | 保持 |
| `industry_scores` | ✅ | 保持 |
| `orders` | ✅ | 保持 |
| `signals` | ✅ | 保持 |
| `research_logs` | ✅ | 保持 |
| `score_history` | 无 | P2 按需新增（评分时间序列） |
| `sector_scores` / `rotation_scores` | 无 | P1/P2 接入 V4 行业评分后新增 |
| `collect_tasks` | 无 | P1 采集任务调度后新增 |
| `trade_reviews` | 无 | P2 交易复盘笔记后新增 |
| `watch_configs` | 无 | P2 观察配置后新增 |
| `local_docs` / `news` / `sentiment_cache` | 无 | P3 知识库/资讯模块后评估 |

> 原则：**不一次性复制 V10 全部 Store**，按 V9 功能节奏逐步扩展，每次扩展必须同步 schema 迁移、类型、文档。

### 2.3 模块间桥梁思想

V10 的「模块间桥梁定义表」可直接作为 V9 数据流文档模板。已在 `../reference/data-interaction-protocols.md` 中吸收：

- 明确桥梁名称、起点、终点、数据类型、触发方式、文件位置。
- 可作为后续扩展 Agent/TradingGateway 的参考。

---

## 3. 需适配后吸收的内容

### 3.1 Agent 智能体调度层

| V10 | V9 现状 | 适配建议 |
|-----|---------|----------|
| `src/agents/` 66 个文件，A2A 协议、8-State 生命周期、心跳监控 | V9 无 `agents/` 目录 | 暂不新建 `agents/`；将 Agent 调度思想融入未来分析调度器，优先保持五层架构清晰 |

**决策**：Agent 是 V10 的核心机制，但 V9 当前以函数式服务层为主。建议：

- P2 之前不引入独立 Agent 目录。
- 若未来需要，将 `AnalysisScheduler` / `FetcherScheduler` 升级为轻量 Agent，而不是直接移植 66 个文件。

### 3.2 Trading Gateway 独立层

| V10 | V9 现状 | 适配建议 |
|-----|---------|----------|
| `src/apps/trading/gateway.ts` + `PaperTradingGateway.ts` + `RealBrokerGateway.ts` | `src/services/trading/` 已有服务 | V9 已符合「交易引擎下沉」原则；未来若支持真实券商，再抽象 `ITradingGateway` 接口 |

### 3.3 板块因子层（Sector Factor Updater）

| V10 | V9 现状 | 适配建议 |
|-----|---------|----------|
| `SectorFactorUpdater.ts` 定时轮询，输出 inflow/outflow/neutral | V9 仅 `industryScoreService.ts` 静态评分 | P1 接入 V4 行业评分 SKILL 后，再评估是否需要独立板块因子更新器 |

### 3.4 StateBoard 共享状态板

| V10 | V9 现状 | 适配建议 |
|-----|---------|----------|
| `src/core/stateBoard.ts` 作为跨模块唯一状态 truth source | V9 使用 `eventBus` + Zustand + DataBridge | 可借鉴「字段契约」思想，但不必完全替换现有机制。建议在 `../reference/data-interaction-protocols.md` 中增加「共享字段契约」章节 |

---

## 4. 暂不采纳的内容

| V10 内容 | 不采纳原因 | V9 替代方案 |
|----------|------------|-------------|
| 三舱硬隔离（研究/交易/系统） | V9 已确立五舱架构，且五舱更贴合现有代码 | 保留五舱，但借鉴三舱的「色调/锁定/回路」思想增强舱室边界 |
| 取消 Widget 驾驶舱 | V9 `CockpitShell` 已作为系统级入口，且用户需要快捷 Dashboard | 保留驾驶舱，但避免 V10 提到的 6 个硬编码 Hub 页面问题 |
| 移除 K 线图/股票图表 | V9 当前分析舱包含 K 线/行情数据，且投资者研究需要图表 | 保留图表，但避免在输入舱展示易引发交易冲动的 K 线 |
| 自然语言入口 `NLInputBox` | V9 当前以表单/搜索为主，NL 入口为 P2 增强项 | 未来可作为 `/command` 总控舱增强功能，不强制替换现有入口 |
| 真实券商 Gateway（eastmoney/同花顺/雪球） | V9 定位为纯研究/模拟交易，真实交易非 P0 | 保留 `RealBrokerGateway` 作为 P3 占位，不提前实现 |
| Hono + tRPC + Drizzle 后端 | V9 当前纯前端即可满足需求 | 标记为 P3 可选扩展，不纳入 v1.0.0 范围 |

---

## 5. 对 V9 文档的更新建议

1. **`03-architecture-standards.md`**：
   - 在「数据访问规范」中增加「共享字段契约」小节，借鉴 StateBoard 思想。
   - 在偏差清单中增加「V10 的 Agent/StateBoard/Gateway 暂未引入」说明。

2. **`05-engine-specs.md`**：
   - 在数据采集引擎约束中显式写明「采集层只采集不计算」。
   - 增加「未来可扩展」章节：Agent 调度、Trading Gateway、Sector Factor Updater。

3. **`../guides/08-implementation-plan.md`**：
   - 将 StateBoard、Agent、Gateway、SectorFactorUpdater 列为 P2/P3 可选探索任务。

4. **`../guides/09-quality-gates.md`**：
   - 增加「与 V10 架构白皮书一致性评审」作为 P3 质量门禁项（可选）。

---

## 6. 五层架构图逐层对照（V9 实际 vs V10 参考图）

> 下图来自 V10/v6-pro-cockpit 参考蓝图，展示了一个理想化的五层架构。下面逐层说明 V9 当前实现与参考图的对应关系、差异与原因。

```
第五层：展示层（Presentation Layer）
┌─────────────────────────────────────────────────────────────┐
│  数据工场   AI体中心   分析仪表盘   交易中心   系统监控      │
│  DataHub   AgentHub   Analysis    Trading    System        │
│  采集/筛选  调度/监控  评分/回测    信号/模拟   知识/配置    │
└─────────────────────────────────────────────────────────────┘

第四层：应用层（Application Layer）
┌─────────────────────────────────────────────────────────────┐
│  输入舱    分析舱     交易舱     输出舱     总控舱         │
│ InputApp AnalysisApp TradingApp OutputApp CommandApp       │
│ 采集/录入  计算/评分   信号/下单   报告/导出   监控/配置    │
└─────────────────────────────────────────────────────────────┘

第三层：引擎层（Engine Layer）
┌─────────────────────────────────────────────────────────────┐
│ TradingOrchestrator  AnalysisScheduler  PaperTrading        │
│ StockScreener        SignalEngine                           │
└─────────────────────────────────────────────────────────────┘

第二层：数据层（Data Layer）
┌─────────────────────────────────────────────────────────────┐
│ db.ts  dataLayer  dataAPI  akshareAdapter  localStorage      │
│ IndexedDB 统一数据  查询接口  采集适配      本地存储        │
└─────────────────────────────────────────────────────────────┘

第一层：基础设施层（Infrastructure Layer）
┌─────────────────────────────────────────────────────────────┐
│ eventBus  DataBridge  logger  config  theme                │
└─────────────────────────────────────────────────────────────┘
```

| 层级 | 参考图模块 | V9 当前实现 | 差异说明 |
|------|-----------|-------------|----------|
| **L5 展示层** | DataHub / AgentHub / Analysis / Trading / System | `src/pages/*`（6 页）<br>`src/apps/*`（五舱）<br>`src/components/*`（16 个）<br>`src/portal/*` / `src/cockpit/*` | 参考图中 L5 颗粒度更细（Hub 化），V9 当前以“舱”为边界聚合页面与组件；AgentHub 尚未落地 |
| **L4 应用层** | InputApp / AnalysisApp / TradingApp / OutputApp / CommandApp | `src/apps/input/*`<br>`src/apps/analysis/*`<br>`src/apps/trading/*`<br>`src/apps/output/*`<br>`src/apps/command/*` | 一一对应，但参考图中 `src/cockpit/*` 被放在 L4，V9 把 `cockpit/` 视为 L5 展示层入口组件 |
| **L3 引擎层** | TradingOrchestrator / AnalysisScheduler / PaperTrading / StockScreener / SignalEngine | `src/services/trading/*`<br>`src/services/analysis/*`<br>`src/services/scoring/*`<br>`src/core/poolTransitionEngine.ts`<br>新增 `src/services/analysis/screeningEngine.ts` | 参考图有独立 `src/agents/` 和 `src/apps/trading/` 目录；V9 引擎以 `src/services/` 为组织单元，Agent 目录未启用，`StockScreener` 刚刚补齐 |
| **L2 数据层** | db.ts / dataLayer / dataAPI / akshareAdapter / localStorage | `src/data/db.ts`<br>`src/data/dataLayer.ts`<br>`src/services/fetcher/fetcherAdapter.ts`<br>`src/config/*`（本地配置） | V9 没有独立的 `dataAPI` 文件；查询封装在 `dataLayer`，适配在 `fetcherAdapter`；`localStorage` 暂未用于业务数据 |
| **L1 基础设施层** | eventBus / DataBridge / logger / config / theme | `src/core/databridge.ts`<br>`src/lib/logger.ts`<br>`src/lib/eventBus.ts`<br>`src/config/*` | 对应关系清晰；`theme` 未作为独立目录，集中在 `src/index.css` + Tailwind 配置 |

### 关键差异结论

1. **参考图是「目标架构」，V9 是「当前实现」**。参考图中 L3 的 `agents/`、`trading/` 目录在 V9 尚未建立，但对应能力已通过 `src/services/` 下沉实现。
2. **L4 应用层与 L5 展示层存在交叉**。V9 的 `cockpit/` 既包含展示组件，也包含部分应用入口逻辑；未来若驾驶舱膨胀，可再拆分为纯 L5 Widget。
3. **数据层缺少 `dataAPI` 独立抽象**。V9 当前通过 `dataLayer` + `DataBridge` 完成数据访问，若未来接入后端，可在 L2 与 L1 之间增加 `dataAPI` 适配层。
4. **参考图不应直接作为 V9 代码依据**。任何从参考图引入的目录或模块（如 `agents/`、`trading/gateway`）必须经过 ADR 评审。

## 7. 版本比对

| 版本 | 时间 | 变化 |
|------|------|------|
| v0.9.0-docs-base | 2026-06-24 前 | 未参考 V10 白皮书 |
| v0.9.0-docs-review | 2026-06-24 | 新增本文档，将 V10 框架性思想分类为「直接吸收 / 适配吸收 / 暂不采纳」，并给出 V9 文档更新建议 |
