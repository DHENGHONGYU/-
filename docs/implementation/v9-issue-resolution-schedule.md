# V9 问题整改调度表

> 生成时间：2026-06-25  
> 调度官：Issue Resolution Orchestrator  
> 输入材料：`docs/implementation/v9-documentation-audit-report.md` + `src/` 代码扫描  
> 规则：同一物理文件被多个 Agent 命中时，合并为联合修复任务，由 **Architecture-Fix Agent** 牵头

---

## 问题汇总与责任路由

| 问题ID | 责任Agent | 修改代码责任（牵头Agent） | 根因分析（一句话） | 核心修复代码片段（含路径） | 验证方式 | 状态 |
|--------|-----------|---------------------------|--------------------|---------------------------|----------|------|
| **ARCH-001** | Architecture-Fix | **Architecture-Fix（联合：Interaction-Fix 协作用于 INT-007）** | `App.tsx` 作为 L5/L4 入口直接调用 `db.init()`，跳过 Service/DataBridge。 | `src/App.tsx:9,12-16`：删除 `import { db }`，改为 `import { initializeApp } from '@/services/system/bootstrapService'`。 | `grep -n "from '@/data/db'" src/App.tsx` 为空；`db.init()` 仅出现在 L2/L1。 | 待执行 |
| **ARCH-002** | Architecture-Fix | **Architecture-Fix（联合：Data-Flow-Fix 协作用于 DF-002 在 tradingService.ts 的 price 校验）** | L3 服务大量调用 `dataLayer.*.save()`，信封 source/traceId 由 dataLayer 硬编码，违反 L3 “写走 DataBridge” 约定。 | `src/services/analysis/sectorScoreService.ts:8,52-53` 等 13 个文件：改 `dataLayer.*.save()` 为 `DataBridge.forward(EnvelopeFactory.create(...))`。 | 增强 `audit-layer-calls.ts` 扫描 `dataLayer\.[a-zA-Z]+\.(save\|add\|put\|update\|delete)` 结果为 0。 | 待执行 |
| **ARCH-003** | Architecture-Fix | **Architecture-Fix（联合：Data-Flow-Fix 协作用于 DF-007 的 dataVersion/审计日志）** | `v6MigrationService.ts` 982 行，同时承担类型、推断、映射、校验、11+ store 导入，是 God Service。 | 拆分为 `src/services/system/migration/{migrationTypes,transformers,validators,storeMigrators/*,v6MigrationService}.ts`。 | `wc -l src/services/system/v6MigrationService.ts` ≤ 250；集成测试结果与改造前一致。 | 待执行 |
| **ARCH-004** | Architecture-Fix | Architecture-Fix | `rotationScoreService.ts` 775 行，配置/计算/持久化耦合。 | 提取 `src/config/rotationConfig.ts`、`src/services/analysis/rotation/{calculator,signalGrader}.ts`。 | `wc -l rotationScoreService.ts` ≤ 250；计算得分与改造前一致。 | 待执行 |
| **ARCH-005** | Architecture-Fix | Architecture-Fix | `ScoreDocPage.tsx` / `StrategySnapshotPage.tsx` 作为 L5 直接读 `dataLayer`，且无过渡期标注。 | `src/pages/analysis/ScoreDocPage.tsx:14,41` 等改为调用只读 Service。 | `npm run audit:layers` 的 L5/L4 读 dataLayer 警告降为 0。 | 待执行 |
| **ARCH-006** | Architecture-Fix | Architecture-Fix | `src/config/themeRegistry.ts` 反向依赖 `src/data/themeSymbolPool.ts` 业务数据。 | 新建 `src/config/symbols.ts`，`themeRegistry.ts` 改从 `@/config/symbols` 导入。 | `grep -R "from '@/data/themeSymbolPool'" src/config` 为空。 | 待执行 |
| **ARCH-007** | Architecture-Fix | **Architecture-Fix（联合：Interaction-Fix 协作用于 INT-006 的禁用 Tooltip）** | `IntelligentScorePage`/`IndustryScorePage`/`InputDashboard` 超过 400 行，God Component。 | 提取 `src/hooks/cabin/useIntelligentScore.ts` 等 Hook，页面仅负责渲染。 | ESLint `max-lines: 300` 通过；页面测试行为不变。 | 待执行 |
| **DF-001** | Data-Flow-Fix | Data-Flow-Fix | DataBridge 写成功后只广播到禁用的 `'db'` 频道，没有按真实 store 广播，UI 无法自动同步。 | `src/core/databridge.ts:97-104`：增加 `this.broadcast(targetStore, envelope)` 与 `eventBus.emit(`${targetStore}:changed`, envelope)`。 | DataBridge 测试中 mock `db.put`，断言 `eventBus.emit('stocks:changed')` 被调用。 | 待执行 |
| **DF-002** | Data-Flow-Fix | **Architecture-Fix 牵头（在 ARCH-002 联合修复中处理 tradingService.ts 的价格校验）** | `tradingService.ts` 对缺失股价使用 `?? 0` 静默回退，导致订单/仓位计算失真。 | `src/services/trading/tradingService.ts:60-66`：显式校验 `stock.price === undefined \|\| stock.price <= 0` 并返回错误。 | `tradingService.test.ts` 构造 `price: undefined` 的 stock，断言返回 `success: false`。 | 待执行 |
| **DF-003** | Data-Flow-Fix | Data-Flow-Fix | `dataflowStore`/`pageStore`/`widgetStore`/`agentStore` 模块顶层订阅 eventBus 永不取消。 | `src/store/dataflowStore.ts:35-51` 等改为 `init*Subscriptions()` / `destroy*Subscriptions()` 模式。 | `eventBus.getStats().totalListeners` 在 destroy 后应为 0。 | 待执行 |
| **DF-004** | Data-Flow-Fix | Data-Flow-Fix | `updateStatus`/`updateGroup` 未递增 `dataVersion`，数据血缘断裂。 | `src/core/databridge.ts:153-162`：自动递增 `dataVersion: (existing.dataVersion ?? 1) + 1`。 | 测试断言 `updateGroup` 后 `dataVersion` +1。 | 待执行 |
| **DF-005** | Data-Flow-Fix | Data-Flow-Fix | ACL 拒绝后 DataBridge 直接抛错，缺少降级队列/重试。 | `src/core/databridge.ts:76-79`：对行情类 envelope 写入 `fallbackQueue`，提供 `DataBridge.retryFailed()`。 | mock ACL 抛错，断言行情 envelope 进入降级队列而非抛错。 | 待执行 |
| **DF-006** | Data-Flow-Fix | Data-Flow-Fix | DataFlowEngine SSE 断开后不自动重连或切回轮询。 | `src/core/dataflow/dataflowEngine.ts:74-79`：增加指数退避重连与 `_fallbackToPolling`。 | mock EventSource onerror，断言 setTimeout 重连被调度。 | 待执行 |
| **DF-007** | Data-Flow-Fix | **Architecture-Fix 牵头（在 ARCH-003 联合修复中处理 v6MigrationService.ts 的数据血缘）** | `db.import()` 对缺失表静默 `?? []`，数据覆盖不可感知且无血缘。 | `src/data/db.ts:265-273`：前置 schema 校验，缺失表时抛错或 warning；导入后写审计日志。 | 构造缺表数据调用 `db.import()`，断言抛出 `ImportSchemaError` 或记录 warning。 | 待执行 |
| **INT-001** | Interaction-Fix | Interaction-Fix | `TradingApp` 买入/卖出无 pending 态与失败反馈，可重复下单。 | `src/apps/trading/TradingApp.tsx:95-125,214-221`：增加 `processingSymbols` + `useToast`。 | 连续快速点击“买入”只产生一笔订单；失败时弹出 error Toast。 | 待执行 |
| **INT-002** | Interaction-Fix | Interaction-Fix | `HotSectorPanel` “全部加入候选池” 无 loading/禁用态。 | `src/apps/input/HotSectorPanel.tsx:63-85,147`：增加 `addingAll` + `useToast`。 | 请求期间按钮禁用并显示“加入中...”；失败时弹出 error Toast。 | 待执行 |
| **INT-003** | Interaction-Fix | Interaction-Fix | `AnalysisApp` 加载/评分失败静默吞错，无 loading。 | `src/apps/analysis/AnalysisApp.tsx:15-39,50-52`：增加 loading 与 Toast 错误反馈。 | 模拟 `listStocks`/`runV6Score` 失败，点击后弹出 error Toast。 | 待执行 |
| **INT-004** | Interaction-Fix | Interaction-Fix | `StockSearch` 直接录入模式无 loading/错误/防重放。 | `src/components/input/StockSearch.tsx:60-72`：增加 `adding` + `useToast`。 | 快速多次点击同一结果只产生一次录入；失败时弹出 error Toast。 | 待执行 |
| **INT-005** | Interaction-Fix | Interaction-Fix | `LocalKnowledgePage` 异步操作无 loading/错误反馈。 | `src/pages/input/LocalKnowledgePage.tsx:81-124`：增加 `loading` + `useToast`。 | 导入/搜索时按钮禁用；失败时弹出 error Toast。 | 待执行 |
| **INT-006** | Interaction-Fix | **Architecture-Fix 牵头（在 ARCH-007 联合修复中处理页面拆分时同步增加 Tooltip）** | `IndustryScorePage`/`IntelligentScorePage` 评分按钮禁用无 Tooltip。 | `src/pages/analysis/IndustryScorePage.tsx:272`、`IntelligentScorePage.tsx:274`：用 `Tooltip` 包裹禁用按钮。 | 悬停禁用按钮显示具体原因（配置缺失/评分中）。 | 待执行 |
| **INT-007** | Interaction-Fix | **Architecture-Fix 牵头（在 ARCH-001 联合修复中处理 App.tsx 初始化失败反馈）** | `App.tsx` IndexedDB 初始化失败仅 `console.error`，用户无感知。 | `src/App.tsx:12-15`：增加 `useToast` 错误提示。 | 让 `db.init()` reject，页面加载后应常驻显示 error Toast。 | 待执行 |
| **DOC-001** | Doc-Sync-Fix | Doc-Sync-Fix | `.env.example` 新增 `VITE_AKSHARE_BASE_URL` 但 `src/vite-env.d.ts` 未声明类型。 | `src/vite-env.d.ts:3-7`：增加 `readonly VITE_AKSHARE_BASE_URL?: string`。 | `npm run tsc` 通过；grep 命中该声明。 | 待执行 |
| **DOC-002** | Doc-Sync-Fix | Doc-Sync-Fix | `docs/05-engine-specs.md` 仍标记数据流引擎为“未实现”，与代码矛盾。 | `docs/05-engine-specs.md:94-114`：更新目录与状态为 🟡 部分实现。 | 通读该节不再出现“🔴 未实现”。 | 待执行 |
| **DOC-003** | Doc-Sync-Fix | Doc-Sync-Fix | `docs/05-engine-specs.md` 引用不存在的 `rotationSignalGenerator.ts`/`rotationConfig.ts`。 | `docs/05-engine-specs.md:302-317`：替换为实际文件 `rotationScoreService.ts`。 | `find src -name 'rotationSignalGenerator.ts'` 无结果。 | 待执行 |
| **DOC-004** | Doc-Sync-Fix | Doc-Sync-Fix | `docs/05-engine-specs.md` 把 `fetcherConfig.ts` 放在错误目录。 | `docs/05-engine-specs.md:30-37,330-335`：路径改为 `src/config/fetcherConfig.ts`。 | `ls src/services/fetcher/` 无 `fetcherConfig.ts`。 | 待执行 |
| **DOC-005** | Doc-Sync-Fix | Doc-Sync-Fix | 核心/实施文档 frontmatter 版本号未统一。 | 批量更新 8 个文档的 `> **Version**: ...` 为 `v0.9.0-migration-implemented`。 | `grep -R '^> \*\*Version' docs/` 仅 Deferred 文档保留旧版本。 | 待执行 |
| **DOC-006** | Doc-Sync-Fix | Doc-Sync-Fix | `docs/09-quality-gates.md` E2E 状态前后矛盾。 | `docs/09-quality-gates.md:275-276` 及 4.3 节：更新为 E2E 已建立 5/5 通过。 | `npm run test:e2e` 通过；文档无“E2E 测试缺失”字样。 | 待执行 |
| **DOC-007** | Doc-Sync-Fix | Doc-Sync-Fix | `docs/06-routing-specs.md` 第 8 节映射表遗漏已注册路由。 | `docs/06-routing-specs.md:221-242`：追加 score-docs/news/strategy-snapshots/local-knowledge。 | 将 `getAllPaths()` 输出与表格逐行比对无遗漏。 | 待执行 |

---

## 联合修复任务说明

| 联合任务 | 牵头 Agent | 协作者 | 涉及文件 | 合并理由 |
|----------|------------|--------|----------|----------|
| JT-001 App.tsx 启动与初始化反馈 | Architecture-Fix | Interaction-Fix | `src/App.tsx` | ARCH-001 与 INT-007 均修改 `App.tsx` |
| JT-002 tradingService.ts 写操作与价格校验 | Architecture-Fix | Data-Flow-Fix | `src/services/trading/tradingService.ts` | ARCH-002 与 DF-002 均修改该文件 |
| JT-003 v6MigrationService.ts 拆分与数据血缘 | Architecture-Fix | Data-Flow-Fix | `src/services/system/v6MigrationService.ts` | ARCH-003 与 DF-007 均修改该文件 |
| JT-004 IndustryScorePage / IntelligentScorePage 拆分与禁用提示 | Architecture-Fix | Interaction-Fix | `src/pages/analysis/IndustryScorePage.tsx`、`src/pages/analysis/IntelligentScorePage.tsx` | ARCH-007 与 INT-006 均修改这两个文件 |

---

## 一键回滚预案

若整改后出现问题，可快速 `git checkout` 以下文件回退（按责任 Agent 分组）：

```bash
# Architecture-Fix 修改的文件
git checkout src/App.tsx \
  src/services/system/bootstrapService.ts \
  src/services/analysis/rotationScoreService.ts \
  src/services/analysis/sectorScoreService.ts \
  src/services/news/newsService.ts \
  src/services/news/sentimentAnalyzer.ts \
  src/services/scoring/industryScoreService.ts \
  src/services/scoring/intelligentScoreService.ts \
  src/services/scoring/v6ScoreService.ts \
  src/services/stockpool/stockpoolService.ts \
  src/services/system/localDocService.ts \
  src/services/system/v6MigrationService.ts \
  src/services/system/migration/ \
  src/services/trading/strategySnapshotService.ts \
  src/services/trading/tradingService.ts \
  src/pages/analysis/ScoreDocPage.tsx \
  src/pages/trading/StrategySnapshotPage.tsx \
  src/config/themeRegistry.ts \
  src/config/symbols.ts \
  src/data/themeSymbolPool.ts \
  src/pages/analysis/IntelligentScorePage.tsx \
  src/apps/input/InputDashboard.tsx \
  src/pages/analysis/IndustryScorePage.tsx \
  src/hooks/cabin/

# Data-Flow-Fix 修改的文件
git checkout src/core/databridge.ts \
  src/core/dataflow/dataflowEngine.ts \
  src/core/fallbackQueue.ts \
  src/data/db.ts \
  src/data/dataLayer.ts \
  src/store/dataflowStore.ts \
  src/store/pageStore.ts \
  src/store/widgetStore.ts \
  src/store/agentStore.ts \
  src/services/fetcher/fetcherService.ts

# Interaction-Fix 修改的文件
git checkout src/apps/trading/TradingApp.tsx \
  src/apps/input/HotSectorPanel.tsx \
  src/apps/analysis/AnalysisApp.tsx \
  src/components/input/StockSearch.tsx \
  src/pages/input/LocalKnowledgePage.tsx

# Doc-Sync-Fix 修改的文件
git checkout src/vite-env.d.ts \
  .env.example \
  docs/05-engine-specs.md \
  docs/06-routing-specs.md \
  docs/09-quality-gates.md \
  docs/01-vision-and-goals.md \
  docs/02-functional-specs.md \
  docs/04-ui-ux-specs.md \
  docs/07-operation-strategy.md \
  docs/10-glossary.md \
  docs/implementation/data-interaction-protocols.md \
  docs/implementation/v9-current-state-review.md \
  docs/implementation/architecture-version-comparison.md
```

> 提示：若已新增文件（如 `src/services/system/bootstrapService.ts`、`src/config/symbols.ts`、`src/core/fallbackQueue.ts`、`src/hooks/cabin/`、`src/services/system/migration/`），`git checkout` 无法直接删除新增文件，需使用 `git clean -fd` 或 `git reset --hard` 谨慎清理。
