---
title: v9-system-blueprint
type: reference
domain: architecture
phase: design
tier: important
status: active
maintainer: V9 Architecture Team
summary: "愿景：成为中国 A 股个人投资者的研究基础设施 — 不替代券商交易软件，而是成为研究、分析、决策、复盘的独立工具。"
tags: [architecture, system, reference, design, documentation]
version: v1.0.0
last_updated: 2026-06-27
code_version: 2.0.0
doc_id: V9-DOC-ARCH-010
change_log: 
---

# V9 智能投研复盘系统 — 整体架构蓝图

> **Status**: Current  
> **Version**: v0.9.0-migration-implemented  
> **Last Updated**: 2026-06-24
>
> 本文档以 `../archive/v10-architecture-whitepaper.md` 与 `../explanation/completeness-profile-batch4.md` 为参考基座，结合本轮文档校对成果，对 V9 的愿景、架构、数据协议、UI 映射、实施路线、质量门禁进行整体归纳，作为项目当前阶段的统一入口。

---

## 1. 系统定位

| 维度 | 交易工具 | V9 智能投研复盘系统 |
|------|---------|-------------------|
| 核心目标 | 毫秒级下单、盈亏执行 | 认知积累、模式识别、复盘学习 |
| 数据时效 | 实时行情（毫秒级敏感） | 盘后数据、历史回测（分钟/小时级可接受） |
| 数据存储 | 云端账户、交易所对接 | 本地 IndexedDB、个人标注、笔记关联 |
| 交互频率 | 高频操作（盯盘、下单） | 低频深度（筛选、阅读、标记、写复盘） |
| 离线需求 | 必须在线 | 必须支持离线 |
| 技术栈 | 需要后端 | 纯前端即可 |

**愿景**：成为中国 A 股个人投资者的研究基础设施 — 不替代券商交易软件，而是成为研究、分析、决策、复盘的独立工具。

**用户价值主张**：

1. 从"凭感觉买股票" → "数据驱动的研究决策"
2. 从"买完就忘" → "完整的认知积累与复盘闭环"
3. 从"零散信息" → "结构化的知识库与模式识别"
4. 从"追涨杀跌" → "基于 V6 九维评分的系统筛选"
5. 从"单一策略" → "多因子 + 板块轮动 + 择时的组合策略"

---

## 2. 技术栈与约束

| 层级 | 技术选型 | 说明 |
|------|---------|------|
| 前端框架 | React 19 + TypeScript + Vite | 现代前端，类型安全 |
| UI 组件 | Tailwind CSS + shadcn/ui + Radix UI | 原子化 CSS + 可访问组件 |
| 状态管理 | Zustand | 轻量级跨组件 UI 状态 |
| 路由 | React Router 7 HashRouter | 静态托管友好，离线刷新无 404 |
| 图表 | recharts + lightweight-charts | 财务图表 + K 线 |
| 本地存储 | IndexedDB（原生封装） | 数据主权、离线可用 |
| 后端 | 无 | 纯前端即可；未来多设备同步为 P3 可选 |

**架构铁律**：

1. 上层可调用下层，禁止反向依赖。
2. L5/L4 禁止直接写 `dataLayer`，必须通过 `DataBridge.forward()`。
3. 配置层禁止依赖引擎层/映射层。
4. 研究体系不依赖交易层：删除 `src/apps/trading/` 与 `src/services/trading/` 后，研究功能完整运行。
5. 数据优先，界面其次：任何 schema 变更必须同步迁移逻辑、类型定义与文档。

---

## 3. 五层架构（当前实现）

```
┌─────────────────────────────────────────────────────────────────────────┐
│  L5 展示层：pages/, components/, portal/, cockpit/                       │
│  页面、通用组件、PortalShell 主框架、驾驶舱 Widget                       │
├─────────────────────────────────────────────────────────────────────────┤
│  L4 应用层：apps/                                                        │
│  输入舱 / 分析舱 / 交易舱 / 输出舱 / 总控舱                              │
├─────────────────────────────────────────────────────────────────────────┤
│  L3 引擎层：services/（agents/ 初始实现）                                 │
│  scoring/（评分） | fetcher/（采集） | trading/（交易） | input/（输入） │
│  core/dataflow/（数据流引擎）                                            │
├─────────────────────────────────────────────────────────────────────────┤
│  L2 数据层：data/                                                        │
│  db.ts | dataLayer.ts | types.ts                                         │
├─────────────────────────────────────────────────────────────────────────┤
│  L1 基础设施层：lib/, config/, core/                                     │
│  eventBus | DataBridge | ACL | Envelope | theme | routes                 │
└─────────────────────────────────────────────────────────────────────────┘
```

### 3.1 与 V10 参考基座的对齐

| V10 模块 | V9 当前映射 | 说明 |
|----------|-------------|------|
| M1 数据采集层 | `src/data/` + `src/services/fetcher/` | V9 将采集适配与服务下沉到 services/ |
| M2 分析引擎层 | `src/services/scoring/` | V6/V4 评分、智能评分 |
| M3 智能体调度层 | `src/agents/agentRuntime.ts` 已存在；注册表/任务队列/健康监控待完善 | 初始实现，P2/P3 逐步完善 |
| M4 交易网关层 | `src/services/trading/` | 已下沉；P3 可抽象 `ITradingGateway` |
| M5 板块因子层 | `src/services/scoring/industryScoreService.ts` | P1/P2 接入 V4 行业评分后评估独立层 |
| M6 界面展示层 | `src/pages/`, `src/components/` | 对齐 |
| M7 五舱应用层 | `src/apps/` | 对齐，输入舱已拆分子页 |
| M8 驾驶舱层 | `src/cockpit/` | 保留 Widget 驾驶舱 |
| M9 组件库层 | `src/components/ui/` | 对齐 |
| M10 基础设施层 | `src/lib/`, `src/config/`, `src/core/` | 对齐 |

---

## 4. 数据架构

### 4.1 当前 Store 清单

当前 IndexedDB 共 **17 个 Store**：

| Store | 主键 | 用途 |
|-------|------|------|
| `stocks` | `symbol` | 标的 |
| `daily_quotes` | `symbol` | 日行情/K线 |
| `v6_scores` | `symbol` | V6 自动评分 |
| `intelligent_scores` | `id`（自增） | V6 个股智能评分（LLM 增强） |
| `industry_scores` | `id`（自增） | V4 行业评分 |
| `orders` | `id` | 订单 |
| `watchlists` | `id` | 观察列表 |
| `signals` | `id` | 交易信号 |
| `research_logs` | `id`（自增） | 审计日志 |
| `rotation_scores` | `id` | 板块轮动评分 |
| `sector_scores` | `id` | 十五五板块评分 |
| `score_docs` | `docId` | 评分文档版本库 |
| `strategy_snapshots` | `id` | 策略快照 |
| `local_docs` | `id` | 本地知识库 |
| `news` | `id` | 资讯文章 |
| `news_stock_map` | `id` | 股票-资讯关联 |
| `sentiment_cache` | `id` | 情感分析缓存 |

### 4.2 未来可扩展 Store（按优先级）

| Store | 触发场景 | 优先级 |
|-------|----------|--------|
| `score_history` | 评分时间序列 | P2 |
| `collect_tasks` | 采集任务调度 | P1 |
| `trade_reviews` | 交易复盘笔记 | P2 |
| `watch_configs` | 观察配置 | P2 |

> 原则：不一次性复制 V10 的 20 个 Store，按 V9 功能节奏逐步扩展。

### 4.3 核心字段

| 字段 | 类型 | 说明 |
|------|------|------|
| `symbol` | string | 股票代码，如 `600519.SH` |
| `researchStatus` | enum | `candidate / screened / deepDive / watching / archived` |
| `source` | enum | `manual / import / akshare` |
| `dataVersion` | number | 数据版本，用于数据血缘与迁移 |
| `calculatedAt` | number | 评分计算时间戳 |
| `algorithmVersion` | string | 评分算法版本，如 `v9-auto` |
| `dataQuality` | object | `{ basic, kline, finance, lastChecked? }` |

---

## 5. 数据交互协议

### 5.1 标准信封

```ts
interface StandardEnvelope {
  meta: {
    source: ModuleId;        // 如 'input-cabin' / 'fetcher' / 'analyzer'
    target: EnvelopeTarget;  // 'indexeddb'
    action: EnvelopeAction;  // INSERT_STOCK / UPDATE_STOCK / SAVE_DAILY_QUOTES / ...
    traceId: string;
    timestamp: number;
    dataVersion: number;
  };
  payload: unknown;
}
```

### 5.2 调用方向矩阵

| 调用方 ↓ / 被调用方 → | L5 展示 | L4 应用 | L3 引擎 | L2 数据 | L1 基础设施 |
|------------------------|---------|---------|---------|---------|-------------|
| L5 展示 | ? | ? | ? | ? 禁止直接 | ? |
| L4 应用 | ? | ? | ? | ? 禁止直接写 | ? |
| L3 引擎 | ? | ? | ? | ? 读 dataLayer / 写 DataBridge | ? |
| L2 数据 | ? | ? | ? | ? | ? |
| L1 基础设施 | ? | ? | ? | ? | ? |

### 5.3 事件总线规范

| 事件名 | 触发时机 | 订阅方 |
|--------|----------|--------|
| `input:poolChanged` | stocks 表变更 | `InputDashboard`, `PoolBoard` |
| `input:fetcherStatusChanged` | 采集服务健康变化 | `DataTestPanel`, 顶部状态栏 |
| `input:importProgress` | 批量导入进度更新 | `BulkImportPanel` |
| `stocks:changed` | 股票状态流转 | 各舱股票列表 |
| `scores:changed` | 评分更新 | 分析舱、交易舱 |
| `orders:changed` | 订单更新 | 交易舱、持仓 |

### 5.4 模块间桥梁

| 桥梁 | 起点 | 终点 | 数据 | 触发 | 文件 |
|------|------|------|------|------|------|
| 数据采集桥 | `fetcherService` | `db.ts` | Stock / DailyQuotes | 手动/定时 | `src/services/fetcher/*` |
| 分析结果桥 | `v6ScoreService` | `AnalysisApp` | V6Score | `scores:changed` | `src/services/scoring/*` |
| 交易信号桥 | `signalGenerator` | `tradingService` | TradingSignal | 扫描/实时 | `src/services/trading/*` |
| 池间流转桥 | `poolTransitionEngine` | `stockpoolService` | Stock | `stocks:changed` | `src/services/stockpool/*` |
| 配置读取桥 | `src/config/*` | 所有模块 | ConfigObject | import | `src/config/*.ts` |

---

## 6. 路由与 UI 映射

### 6.1 当前路由注册表

| 路径 | 组件 | 服务 | 舱室 |
|------|------|------|------|
| `/` | `HomePage` | — | portal |
| `/cockpit` | `CockpitShell` | — | portal |
| `/input` | `InputDashboard` | `inputService`, `stockpoolService` | input |
| `/input/bulk-import` | `BulkImportPanel` | `batchImportService` | input |
| `/input/hot-sectors` | `HotSectorPanel` | `hotSectorService` | input |
| `/input/data-test` | `DataTestPanel` | `fetcherService` | input |
| `/input/prototype` | `InputPrototype` | mock | input（临时） |
| `/analysis` | `AnalysisApp` | — | analysis |
| `/analysis/stock-score` | `StockAnalysisPage` | `v6ScoreService`, `intelligentScoreService` | analysis |
| `/analysis/stock-score/:symbol` | `StockAnalysisPage` | `v6ScoreService`, `intelligentScoreService` | analysis |
| `/analysis/sector` | `SectorAnalysisPage` | `industryScoreService` | analysis |
| `/analysis/backtest` | `BacktestPage` | — | analysis |
| `/analysis/industry-score` | `IndustryScorePage` | `industryScoreService` | analysis |
| `/analysis/intelligent-score` | `IntelligentScorePage` | `intelligentScoreService` | analysis |
| `/trading` | `TradingApp` | `tradingService`, `signalGenerator`, `riskEngine` | trading |
| `/output` | `OutputApp` | — | output |
| `/command` | `CommandApp` | — | command |

### 6.2 输入舱子页映射

| 子页 | 核心组件 | 能力 |
|------|----------|------|
| 录入看板 | `StockSearch`, `QualityIndicator`, `PoolBoard` | 搜索录入、五态池看板、批量操作、导入/导出 |
| 批量导入 | `BulkImportPanel` | 行级状态、导入进度、错误明细 |
| 热门板块 | `HotSectorPanel` | 板块排名、因子进度条、轮动建议 |
| 采集测试 | `DataTestPanel` | 数据源健康、接口探测、清洗检查 |

---

## 7. UI/UX 当前范式

### 7.1 PortalShell 布局

- 56px 顶部状态栏：Logo 徽章、五舱导航、采集健康、运行时长、版本
- 260px 左侧分组侧边栏：按舱分组（常用 / 采集 / 工具）
- 主内容区 `p-6`，可滚动
- 根容器始终 `dark`；首页 `/` 与驾驶舱 `/cockpit` 保持浅色

### 7.2 从 V6 Pro UI 比对中吸收的改进

| 吸收项 | V9 落点 | 优先级 |
|--------|----------|--------|
| 数据完整性进度条 | `QualityIndicator` | P0 |
| 风控三态按钮 | `RiskBanner` | P1 |
| 最终确认关卡 | `FinalConfirm` | P1 |
| 多空辩论区 | `DebaterPanel` | P2 |
| 系统网关面板 | `GatewayPanel` | P2 |
| 信号质量复盘 | `ReviewDrawer` | P2 |
| Markdown/PDF 报告生成 | `ReportGenerator` | P2 |
| 回路状态横幅 | `LoopBanner` | P2 |

### 7.3 保持现状的项

- Widget 驾驶舱
- K 线图/股票图表（在分析舱）
- 五舱架构（不改为三舱）
- 显式搜索/筛选入口（不强制 NL）

---

## 8. 实施路线（P0 / P1 / P2）

### Phase 2 功能填充（当前）

| 任务 | 优先级 | 状态 | 说明 |
|------|--------|------|------|
| 2.1 AKShare 数据采集适配器 | P1 | ? | 已落地 |
| 2.2 真实行情/财务数据接入评分 | P1 | ?? | 部分真实数据已接入，持续优化 |
| 2.3 股票池流转 UI | P1 | ? | 已落地 |
| 2.3.5 输入舱 UI 体系化重塑 | P1 | ? | 已拆分子页 |
| 2.3.6 输入舱交互增强（搜索/质量指示/批量操作/导入导出） | P0 | ?? | 待实施 |
| 2.3.7 批量导入状态可视化 | P0 | ?? | 待实施 |
| 2.3.8 热门板块信息密度增强 | P1 | ?? | 待实施 |
| 2.3.9 采集测试多维度健康度 | P1 | ?? | 待实施 |
| 2.3.10 采集配置 UI | P2 | ?? | 待实施 |
| 2.4 板块轮动与行业分析 | P1 | TBD | 待开始 |
| 2.4.1 热门板块与价值洼地双策略体系 | P1 | ?? | ADR-009 已接受；类型/Store/Analyzer/Widget 实施中 |
| 2.5 择时信号引擎 | P0 | ? | 已落地 |
| 2.6 仓位管理器 | P0 | ? | 已落地 |
| 2.7 风控引擎 | P0 | ? | 已落地 |
| 2.8 交易错误分类器 | P1 | TBD | 待开始 |
| 2.9 AI 复盘引擎 | P1 | TBD | 待开始 |
| 2.10 策略回测引擎 | P2 | TBD | 待开始 |
| 2.11 交易复盘笔记 | P2 | TBD | 待开始 |
| 2.12 研究报告导出 | P2 | TBD | 待开始 |

### Phase 3 质量加固

- PWA manifest + service worker
- E2E 测试（Playwright）
- CI 流水线
- 覆盖率门禁
- 性能优化

### Phase 4 发布准备（v1.0.0）

- 完整功能验收
- 文档一致性校验
- 数据迁移测试
- 离线可用性验证
- GitHub Pages 部署

---

## 9. 质量门禁

| # | 门禁项 | 当前状态 | 目标 |
|---|--------|----------|------|
| 1 | TypeScript 类型检查 | ? 通过 | 0 errors |
| 2 | ESLint 代码规范 | ? 通过 | 0 warnings/errors |
| 3 | 单元测试 | ? 291/291 通过 | 0 失败 |
| 4 | 生产构建 | ? 通过 | 产物生成成功 |
| 5 | 跨层调用审计 | ? 0 违规 / 2 警告 | 0 违规 |
| 6 | 硬编码审计 | ?? 基线 389 处 | 0 硬编码阈值/颜色 |
| 7 | 空壳/死代码审计 | ?? 基线 11 处提示 | 0 提示 |
| 8 | 测试覆盖率 | ?? 未配置阈值 | core/data/utils ≥ 85%，services ≥ 70% |
| 9 | E2E 冒烟测试 | ? 5/5 passed | 0 失败 |
| 10 | 路由一致性审计 | ?? 基线 0 漂移 | 0 漂移 |
| 11 | PWA 离线验证 | ?? 未建立 | service worker 注册成功 |

---

## 10. 当前偏差与下一步

| # | 偏差 | 影响 | 计划 |
|---|------|------|------|
| D01 | `agents/` 初始实现：`src/agents/agentRuntime.ts` 已存在，注册表/任务队列/健康监控待完善 | Agent 层能力不完整 | Phase 2 完善 Agent 运行时框架 |
| D02 | ?? 已修复：`trading/` 已下沉为 `src/services/trading/` | 交易引擎与应用层已解耦 | 保持并补充交易服务测试 |
| D03 | V6 评分仍部分依赖随机数/模拟数据 | 评分结果质量取决于真实数据完整度；缺少评分理由与报告 | Phase 2 接入真实数据；补充评分报告生成 |
| D04 | ?? 已修复：五舱入口与输入舱子路由均已注册 | 直接访问不再 404 | 保持，未来按功能增加子路由 |
| D05 | 缺少 `thresholds.ts` / `symbols.ts` | 阈值与代码池尚未集中 | Phase 2 按需创建 |
| D06 | ?? 已修复：跨层调用扫描脚本已建立 | 当前基线 0 违规 / 2 警告 | 持续维护 |
| D07 | ?? 已修复：`inputConfig.ts` 已创建 | 搜索/导入/质量规则已集中 | 持续补充高级筛选配置 |
| D08 | 路由表缺少文件一致性审计 | 新增/删除文件后可能漂移 | Phase 2 增强 `audit-dead-code.ts` 路由-文件校验 |
| D09 | UI 层仍存硬编码 Tailwind 颜色/字符串 | 违反映射层规范 | Phase 2 落地正式组件时统一清理 |
| D10 | V10 的 Agent/StateBoard/Gateway 机制尚未引入 | 未来扩展方向未在文档中记录 | Phase 2/P3 按需求逐步评估 |
| D11 | 缺少共享字段契约文档 | 跨模块字段语义可能漂移 | 已在 3.9.7 补充 |
| **D12** | **数据流引擎已实现（`src/core/dataflow/`），详细规格文档待补充** | `src/core/dataflow/` 已提供 SSE/轮询、内存缓存、定时刷新、优先级分发、慢订阅者检测；规格文档待完善 | Phase 2 补充详细规格文档 |
| **D13** | **缺少数据融合层** | `src/services/analysis/` 各服务分散获取数据，缺少统一 `UnifiedStockData` 视图 | Phase 2 实现 `unifiedStockService.ts` |
| **D14** | **Widget 运行时引擎已存在（`src/cockpit/core/widgetEngine.ts`），`CockpitShell` 尚未接入** | 注册表/运行时基础已落地，`CockpitShell` 未调用 | Phase 2 将 CockpitShell 接入 Widget 引擎 |
| **D15** | **评分算法能力降级** | `src/services/scoring/v6ScoreService.ts` 仅启发式计算 + 随机数降级，缺少 LLM 集成与报告生成 | Phase 2 升级评分引擎，接入真实数据与 LLM |
| **D16** | **缺少图表组件库（规格已起草，代码待引入）** | `src/components/ui/` 无 `lightweight-charts` / `recharts`；`./chart-integration.md` 已定义选型、API 与 DataFlow 对接 | Phase 2 引入图表组件 |
| **D17** | **`rotationScoreService.ts` 已实现五因子十六指标模型，上层 `SectorAnalysisPage` 待充分接入** | 板块轮动评分已可计算，上层展示与调用待完善 | Phase 2 在 `SectorAnalysisPage` 接入轮动评分 |
| **D18** | **缺少操作反馈闭环（规格已起草，代码待引入）** | `src/components/atoms/Toast.tsx` 已提供基础组件；`./feedback-loop-spec.md` 已定义 FeedbackService 与 EventBus 集成 | Phase 2 完善反馈机制 |
| **D19** | **`ErrorBoundary.tsx` 已存在并被 `App.tsx` 使用，Widget 级隔离待专项接入（规格已起草）** | 全局错误边界已落地；`./widget-error-handling.md` 已定义 Widget 级包裹与降级 UI | Phase 2 在 Widget 渲染管线中接入 ErrorBoundary |
| **D20** | **缺少热门板块与价值洼地双策略体系** | 策略引擎仅有主题/价值/热门动量三分类，缺少用户规格中的 HotSectorScore / ValuePitScore 双评分输出与轮动信号检测 | Phase 2 新增独立 Store、Analyzer、Detector、Widget；详见 ADR-009 |

---

## 11. 架构决策记录（ADR）

| 编号 | 标题 | 状态 | 日期 |
|------|------|------|------|
| ADR-001 | 纯前端无后端架构 | 已接受 | 2026-06-20 |
| ADR-002 | IndexedDB 替代 localStorage | 已接受 | 2026-06-20 |
| ADR-003 | DataBridge 替代直接 dataLayer 写入 | 已接受 | 2026-06-21 |
| ADR-004 | React Router HashRouter | 已接受 | 2026-06-21 |
| ADR-005 | PortalShell 深色 Kimi 经典布局 | 已接受 | 2026-06-23 |
| ADR-006 | 输入舱拆分为四子页面 | 已接受 | 2026-06-24 |
| ADR-007 | 补齐筛选引擎、信号持久化与复盘引擎 | 已接受 | 2026-06-24 |
| ADR-008 | 采用 v6-pro-cockpit "第四次工业革命稀缺核心资源" 交易策略 | 已接受 | 2026-06-24 |
| ADR-009 | 引入热门板块与价值洼地双策略体系 | 已接受 | 2026-06-27 |

#### 编号?文件名对照表

| 编号 | 文件名 |
|------|--------|
| ADR-001 | 2026-06-20-pure-frontend-architecture.md |
| ADR-002 | 2026-06-20-indexeddb-over-localstorage.md |
| ADR-003 | 2026-06-21-databridge-over-direct-datalayer.md |
| ADR-004 | 2026-06-21-hashrouter-for-static-hosting.md |
| ADR-005 | 2026-06-23-portalshell-dark-kimi-layout.md |
| ADR-006 | 2026-06-24-input-cabin-subpages.md |
| ADR-007 | 2026-06-24-pool-screening-signal-persistence-review-engine.md |
| ADR-008 | 2026-06-24-adopt-v6-core-resource-trading-strategy.md |
| ADR-009 | 2026-06-27-dual-strategy-system.md |

---

## 12. 文档体系索引

### 根目录规格文档

| 编号 | 文档 | 内容 |
|------|------|------|
| 01 | `./01-vision-and-goals.md` | 愿景、目标用户、价值主张 |
| 02 | `./02-functional-specs.md` | 用户故事、核心流程、非功能需求 |
| 03 | `./03-architecture-standards.md` | 五层架构、调用规则、数据 Schema |
| 04 | `./04-ui-ux-specs.md` | UI/UX 规范、主题、布局 |
| 05 | `./05-engine-specs.md` | 引擎规格、DataBridge、评分模型 |
| 06 | `./06-routing-specs.md` | 路由注册表、舱室映射 |
| 07 | `./07-operation-strategy.md` | 运营策略、ADR |
| 08 | `./08-implementation-plan.md` | 分阶段实施计划 |
| 09 | `./09-quality-gates.md` | 质量门禁、扫描脚本 |
| 10 | `./10-glossary.md` | 词汇表、命名规范 |

### 专项实施文档

| 文档 | 内容 |
|------|------|
| `./v9-system-blueprint.md` | 本文档：整体架构蓝图 |
| `./dual-strategy-dataflow-spec.md` | 用户输入的双策略/数据流规格 |
| `../explanation/dual-strategy-gap-analysis.md` | 双策略规格与现有项目差异分析报告 |
| `./architecture-version-comparison.md` | 架构文档版本比对 |
| `./input-cabin-spec.md` | 输入舱业务规格与映射 |
| `./data-interaction-protocols.md` | 数据交互协议 |
| `../explanation/design/implementation-governance.md` | 实施治理与 ADR 规范 |
| `./v9-input-cabin-strategy-report.md` | 输入舱升级策略报告 |
| `./v10-architecture-alignment.md` | V10 白皮书对齐报告 |
| `../archive/ui-module-alignment.md` | V6 Pro UI 模块对齐报告 |
| `./v6-cockpit-ui-reference.md` | v6 UI 参考 |
| `../explanation/trading-core-factors.md` | 交易核心因子导入 |
| `./chart-integration.md` | 图表组件技术选型与 DataBridge 对接 |
| `./feedback-loop-spec.md` | 操作反馈闭环与 EventBus 集成 |
| `./widget-error-handling.md` | Widget 错误边界与降级 UI |
| `./pwa-offline-guide.md` | PWA Service Worker 与离线缓存 |
| `../archive/ADR-001~009.md` | 架构决策记录 |
| `CHANGELOG.md` | 版本变更日志 |

---

## 13. 版本比对

| 版本 | 时间 | 变化 |
|------|------|------|
| v0.9.0-docs-base | 2026-06-24 前 | 分散规格文档，缺少统一蓝图 |
| v0.9.0-docs-review | 2026-06-24 | 新增本文档，将愿景、架构、数据协议、路由映射、UI 范式、实施路线、质量门禁、ADR、文档索引统一归纳；吸收 V10/V6 Pro 参考基座结论 |
| v0.9.0-migration-implemented | 2026-06-24 | 校对 Store 数量、E2E/死代码基线、偏差清单与版本号；与代码真实状态对齐 |
