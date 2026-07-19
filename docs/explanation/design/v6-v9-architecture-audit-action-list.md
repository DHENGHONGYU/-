---
title: V6 �?V9 架构一致性整改行动清�?tier: reference
type: explanation
domain: architecture
phase: testing
status: active
maintainer: Quality Auditor
tags: [architecture, audit, checklist, list]
version: v2.0.0
last_updated: 2026-07-04
code_version: 2.0.0
audit_source: 
---

# V6 �?V9 架构一致性整改行动清�?
> **审计结论**：V6 架构思想�?V9 中“有实现、未主导”。项目同时存�?V6 旧实现、V6 迁移资产�?V9 新结构，形成事实上的“一套代码两套组件”�?> **问题总数**�?6 项（P0 2 + P1 8 + P2 16�?> **已修�?*�?6 项（批次 A/B/C/D/E 全部完成�?> **待修�?*�? �?> **整改原则**：只修改 V9 生产路径；废弃目录直接删除或移出仓库；保�?V6 分层设计并让其接管主流程�? 
> **核心约束**：严禁一套功能对应两�?UI 组件；所有整改必须保持组件体系化�? 
> **批次 A 状�?*：已完成 ✅（P0-01 v6ScoreService 已切换到 v6-engine �?F4 批次 2026-07-04；P0-02 PortalShell 单轨�?�?F3 批次删除 HUB_APPS + /hub 重定向；P2-16 测试已重写为 v6-engine mock 版本�?> **批次 B 状�?*：已完成 ✅（v6-ui-assets/、temp/backup/、ConfigPage.tsx 已删除；input/prototype/、news-v6/、newsStore.ts �?F1 批次实际删除 2026-07-04�?> **批次 C 状�?*：已完成 ✅（P1-06 local-knowledge 改为 PortalShell 分发；P1-07 移除 /output/settings 卡片入口；P1-08 newsStore.ts �?F1 实际删除�?> **批次 D 状�?*：已完成 ✅（D-1 路由文档同步 ✅；D-2 DataBridge 映射�?`DATA_ACTION_TO_ENVELOPE` 替代不安全强�?✅；D-3 Store EventBus 广播 �?21/24 Store 通过 `withBroadcast` 工具广播；D-4 页面可见�?�?创建 `usePageGuard` Hook�? 个高频页面改造完成；D-4c 补齐 9 个业务页�?usePageGuard 改�?✅）
> - **D-3 详情**：新�?`src/store/helpers/withBroadcast.ts` 工具函数（含错误捕获�?logger），`EVENT_NAMES` 常量新增 21 �?channel�?1 个写操作 Store 添加广播（poolStore/orderStore/holdingsStore/positionStore/intelligentScoreStore/industryScoreStore/strategySnapshotStore/valuePitStore/hotSectorStore/outputStore/commandStore/dataTestStore/analysisStore/dualStrategyStore/sectorAnalysisStore/riskStore/signalQualityStore/marketDataStore/disciplineStore/backtestStore/scoreDocStore）；跳过 3 个（signalStore 无同步写操作、rotationSignalStore 不存在、localKnowledgeStore 无同步写操作�?> - **D-4 详情**：新�?`src/hooks/usePageGuard.ts` Hook（统一管理 `isVisible`/`isClickable`/`tooltipText`/`guardProps`）；改�?6 个高频页面（StockAnalysisPage、IntelligentScorePage、IndustryScorePage、ScoreDocPage、ValuePitPage、HotSectorPage�?> - **D-4-1 详情**：AnalysisApp 添加 pageStore 全局加载协调，`loadStocks`/`handleScore` 调用 `pageSetLoading` �?try/finally 中包装；按钮使用 `isDisabled`/`disabledTitle`（store 加载 + page 全局禁用合并），添加 `aria-label` 稳定可访问名�?> - **D-4-2 详情**：InputDashboard 添加 pageStore 全局加载协调，`handleAdd` 调用 `pageSetLoading`；移除冗�?`submitting` state；按钮使�?`isDisabled`/`disabledTitle`（poolData 加载 + page 全局禁用合并�?> - **D-4-3 详情**：CoreResourcePanel 添加 pageStore 全局加载协调；按钮合�?pageStore `!pageClickable` �?prop `loading`，计�?`isDisabled`/`disabledTitle`
> - **D-4 验证结果**：TypeScript 0 错误 ✅；ESLint 0 错误 ✅；Vitest 170 文件 2158 测试通过 ✅；Vite build 成功 �?> - **D-4c 详情**：补�?9 个业务页面的 usePageGuard 改造：StrategySnapshotPage、HoldingsPage（含 HoldingsFilter 子组�?disabled 透传）、LocalKnowledgePage、SectorAnalysisPage、NewsPage、BacktestPage、TradeReviewPage、ResearchReportPage、HomePage；pageKey 分别�?`'strategy-snapshot'`/`'holdings'`/`'local-knowledge'`/`'sector-analysis'`/`'news'`/`'backtest'`/`'trade-review'`/`'research-report'`/`'home'`
> - **验证结果**：`tsc --noEmit` 0 错误 ✅；`vite build` 成功 ✅；Store 测试 29 文件 / 490 测试全部通过 ✅；D-4c 页面测试 4 文件 / 21 测试全部通过 �?> **批次 E 状�?*：已完成 ✅（P2-05 @legacy 标记；P2-06 Mock 使用范围说明；P2-07 已有降级策略；P2-09 �?DEPRECATED 常量；P2-10 v6-competitive-analysis/ 已删除）
> **核心约束**：严禁一套功能对应两�?UI 组件；保持组件体系化�?
---

## 一、P0 级问题（架构阻断，必须立即修复）

| 编号 | 问题描述 | 文件路径 | 影响 | 建议修复方式 | 批次 |
|:---|:---|:---|:---|:---|:---|
| P0-01 | 生产评分主入口仍是旧�?`v6ScoreService.ts` 启发式逻辑，未�?V6 L-1~L8 分层 | `src/services/scoring/v6ScoreService.ts` | 评分逻辑�?V6 架构脱节，LLM 增强层、审计链路无法生�?| 将入口切换到 `createV6Engine().calculateAll()`；用 `ALL_LAYER_IDS` 替换硬编码；增加 `AbortSignal` 支持 | A |
| P0-02 | `PortalShell` 同时维护 `CABIN_APPS` �?`HUB_APPS` 两套舱室入口组件，按 `/hub` 后缀硬切�?| `src/portal/PortalShell.tsx:39-53` | 同一舱室存在两套独立实现，状态、布局、生命周期不统一 | 统一为单一套入口模型：`CabinApp` 内部默认渲染 `*HubPage`，删�?`HUB_APPS` 映射�?| A |

---

## 二、P1 级问题（高风险，影响可维护性）

| 编号 | 问题描述 | 文件路径 | 影响 | 建议修复方式 | 批次 |
|:---|:---|:---|:---|:---|:---|
| P1-01 | V6 UI 迁移资产完整目录仍留在仓库，�?`.gitignore` 仅忽略未删除 | `v6-ui-assets/source-migration/` | 仓库体积膨胀，组件同名冲突，开发者易误引用旧实现 | 从工作区删除；如必须归档，移到仓库外或独立分�?| B |
| P1-02 | 临时备份目录 `temp/backup/` 含旧服务/Store/文档备份 | `temp/backup/` | 废弃代码占用，存在被误加载风�?| 删除目录；如需保留快照，使�?git history | B |
| P1-03 | 资讯模块同时存在 V9 �?V6 两个 `NewsPage` / `NewsCard` | `src/pages/analysis/NewsPage.tsx`<br>`src/pages/analysis/NewsPage.tsx`<br>`src/components/organisms/news/NewsCard.tsx`<br>`src/components/organisms/news/NewsCard.tsx` | 同功能两�?UI、两套状态、两套数据类�?| �?`src/pages/analysis/NewsPage.tsx` �?canonical 实现，删�?`news-v6/` 目录�?`/analysis/news-v6` 路由 | B |
| P1-04 | 输入舱原型目录与正式面板职责完全重叠 | `src/apps/input/` | 原型代码未被路由引用，但与正式面板同名同责，造成维护困惑 | 删除 `prototype/` 目录；如后续需要，�?git 历史恢复 | B |
| P1-05 | `ConfigPage.tsx` �?`ConfigApp` 的冗余包装，且无任何路由引用 | `src/apps/command/ConfigApp.tsx` | 孤儿页面，增加认知负�?| 删除 `ConfigPage.tsx` | B |
| P1-06 | `/input/local-knowledge` 直接渲染独立页面，绕�?`PortalShell` | `src/config/routes.ts:226-230` | 该页面缺少顶部导航与侧边栏，与其他输入舱子页面布局不一�?| 改为 `PortalShell` 内部子路由，�?`InputApp` 分发 | C |
| P1-07 | `/output/settings` �?`OutputHubPage` 中硬编码，但未在 `routes.ts` 注册 | `src/pages/output/OutputHubPage.tsx:48` | 点击卡片会进�?404 | 补注册路由或移除卡片入口 | C |
| P1-08 | `newsStore.ts` 仍含 `legacyBookmarkToV9` �?V6 迁移逻辑 | `src/store/analysisNewsStore.ts` | 状态层残留废弃迁移代码 | 清理一次性迁移逻辑；确认无 V6 数据后再删除 | C |

---

## 三、P2 级问题（中低风险，按计划治理�?
| 编号 | 问题描述 | 文件路径 | 影响 | 建议修复方式 | 批次 |
|:---|:---|:---|:---|:---|:---|
| P2-01 | 路由规格文档 `06-routing-specs.md` 与实�?`routes.ts` 不同步（29 vs 35 条） | `../../reference/06-routing-specs.md` | 文档失效，新开发者易产生误解 | �?`routes.ts` 实际 35 条路由更新文�?| D |
| P2-02 | DataBridge `DataAction` 枚举�?`EnvelopeAction` 语义缺口 | `../../../src/showcase/index.ts` | 动作协议不一致，扩展受限 | 统一动作枚举或添加适配映射 | D |
| P2-03 | 多数 Store 仅本�?setState，未通过 EventBus 广播变更 | `src/store/*` | 跨组件状态同步依赖隐式传�?| 为写操作统一补充 `eventBus.emit`；参�?`engineStore.ts` | D |
| P2-04 | 页面层未普遍实现 `isVisible` / `isClickable` 计算变量�?Tooltip 反馈 | `src/pages/*` | 交互状态控制薄弱，不符合四步契�?| 在核心页面组件中补全；优先高交互页面 | D |
| P2-05 | `v6MigrationService.ts` �?`migrationTransformers.ts` 为一次�?V6 迁移服务 | `src/services/system/v6MigrationService.ts`<br>`src/services/system/migration/migrationTransformers.ts` | 迁移完成后代码冗�?| 评估是否已无需迁移：若是则删除；若需保留则标�?`@legacy` 并缩减入�?| E |
| P2-06 | 多个 Mock Provider 长期占位 | `src/services/ai-center/aiCenterProvider.ts`<br>`src/services/stock-analysis/mockStockAnalysisProvider.ts`<br>`src/services/data-collector/mockDataCollection.ts`<br>`src/services/trading/mockDataGenerator.ts` | 生产与测试边界模�?| 明确 mock 使用范围；生产路径改为真�?Provider 或统一 mock 开�?| E |
| P2-07 | 输入�?`inputService.ts` 仍使�?`MOCK_STOCK_LIBRARY` | `src/services/input/inputService.ts` | 输入舱核心服务依�?mock 股票�?| 接入真实 `stockApi` �?`unifiedStockService`，保留降级策�?| E |
| P2-08 | `src/cockpit/providers/MarketDataProvider.tsx` 标为 `@deprecated` | `src/cockpit/providers/MarketDataProvider.tsx` | 废弃组件仍占用源码目�?| 删除并替换所有引�?| E |
| P2-09 | `cockpit.constants.ts` �?`DEPRECATED_*` 颜色常量 | `src/constants/cockpit.constants.ts` | 废弃常量可能被误�?| 删除废弃常量；同步替换引�?| E |
| P2-10 | `v6-competitive-analysis` 等静�?V6 报告目录�?V9 报告并列 | `v6-competitive-analysis/` | 顶层目录 cluttered | 移入 `docs/archives/` 或删�?| E |
| P2-11 | 部分 Widget �?V6 迁移资产中存在同名实�?| `v6-ui-assets/source-migration/widgets/widgets/*` | �?V6 资产清理�?| �?P1-01 一并删�?| B |
| P2-12 | `StockSearch` 组件�?V6 迁移资产中存在同名实�?| `v6-ui-assets/source-migration/components/StockSearch.tsx` | �?V6 资产清理�?| �?P1-01 一并删�?| B |
| P2-13 | `Dashboard` �?V6 迁移资产中两个目录各有一�?| `v6-ui-assets/source-migration/pages/Dashboard.tsx`<br>`v6-ui-assets/source-migration/pages-all/Dashboard.tsx` | 重复定义 | �?P1-01 一并删�?| B |
| P2-14 | `/trading/signals` �?`/command/monitor` 子路径未拆分，仍落入 App 内部 | `src/config/routes.ts:214-244` | 路由层次与文档规格存在偏�?| 如需独立页面，拆分独立组件；如设计保留，更新文档说明 | D |
| P2-15 | `../../reference/06-routing-specs.md` 已声明“子页面未拆分”为已知偏差，但未明确是否接�?| `../../reference/06-routing-specs.md` | 规格模糊 | 在文档中明确标注 accepted deviation 及原�?| D |
| P2-16 | `v6-engine` 测试�?`v6ScoreService` 测试并存，主流程切换后需回归验证 | `src/services/scoring/v6-engine/*.test.ts`<br>`src/services/scoring/v6ScoreService.test.ts` | 测试重复、维护成本高 | 切换主入口后，合�?删除旧测试；确保 L-1~L8 覆盖率不下降 | A |

---

## 四、整改批次规�?
| 批次 | 主题 | 包含问题 | 预计影响文件�?| 目标 |
|:---|:---|:---|:---|:---|
| **A** | 评分主入口切�?+ 舱室入口统一 | P0-01、P0-02、P2-16 | 6-10 | �?V6 分层引擎真正主导评分；消�?PortalShell 双轨入口 |
| **B** | 废弃资产清理（V6 UI、原型、备份、冗余页面） | P1-01、P1-02、P1-03、P1-04、P1-05、P2-11~P2-13 | 10-15 | 删除所有未引用或重复的 V6/原型/备份代码 |
| **C** | 路由与布局一致性修�?| P1-06、P1-07、P1-08 | 5-8 | 所有舱室子页面统一�?PortalShell�?04 入口修复 |
| **D** | DataBridge / Store 广播 / 文档同步 | P2-01、P2-02、P2-03、P2-04、P2-14、P2-15 | 8-12 | 四步契约落地；路由文档与实现一�?|
| **E** | 残余迁移服务�?Mock 治理 | P2-05、P2-06、P2-07、P2-08、P2-09、P2-10 | 6-10 | 清理一次性迁移代码；明确 Mock 边界 |

---

## 五、验收标�?
| 检查项 | 验收方式 | 通过标准 |
|:---|:---|:---|
| V6 引擎接管评分主流�?| 代码审查 + 单元测试 | `v6ScoreService.ts` 不再被生产路径直接调用；`v6-engine/engine.ts` 覆盖�?�?80% |
| 舱室入口单轨�?| 代码审查 + 手动路由测试 | `PortalShell` 中仅保留一套入口映射；`/input/hub`、`/analysis` 等路径渲染正�?|
| V6 资产清理 | `git ls-files` / `find` | `v6-ui-assets/`、`temp/backup/`、`src/apps/input/`、`src/pages/analysis/` 不存在于工作�?|
| 路由一致�?| 运行期验�?+ 文档对比 | `routes.ts` 35 条路由均可在应用内访问；`06-routing-specs.md` 与实现一�?|
| 四步契约落地 | 代码审查 | 核心页面实现 `isVisible`/`isClickable`；关�?Store 写操作触�?EventBus 广播 |
| 回归测试 | `npm run test` / `npm run validate:blueprint` | 无新增失败；ESLint 0 错误 |

---

## 六、变更日�?
| 日期 | 版本 | 变更内容 | 变更�?|
|:---|:---|:---|:---|
| 2026-07-04 | v2.0.0 | **F3+F4 批次完成 �?批次 A 全闭�?*：F3 PortalShell 单轨�?�?删除 HUB_APPS 映射表及 5 �?HubPage lazy import�?hub 路由改为 useEffect 重定向到舱室基础路径（方案B），侧边�?PANEL_ITEMS 路径同步更新；F4 v6ScoreService 集成 v6-engine �?重写 runV6Score() 调用 createV6Engine().calculateAll()，扩�?V6Score 类型新增 rating/layerDetails/allRisks/recommendation/engineVersion 字段（方案B），测试重写�?v6-engine mock 版本�?/7 通过）；验证 tsc 0 错误、vite build 成功 | V9 Quality Audit Team |
| 2026-07-04 | v1.8.0 | **F1 批次完成**：实际删�?news-v6/ 目录�? 文件）、newsStore.ts�?25 行）、prototype/ 目录�? 文件）、mockData.colors.test.ts；移�?/analysis/news-v6 死路由；保留 newsColorTokens.ts（仍�?NewsSentimentTrend.tsx 引用）；验证 tsc 0 错误、vite build 成功；修正批�?A/B/C 状态记录（此前虚假标记已完成） | V9 Quality Audit Team |
| 2026-07-01 | v1.6.0 | D-4c 完成：补�?9 个业务页�?usePageGuard 改造（StrategySnapshotPage、HoldingsPage �?HoldingsFilter 子组�?disabled 透传、LocalKnowledgePage、SectorAnalysisPage、NewsPage、BacktestPage、TradeReviewPage、ResearchReportPage、HomePage）；验证 D-4c 页面测试 4 文件 / 21 测试全部通过；批�?D 全部闭环 | V9 Quality Audit Team |
| 2026-07-01 | v1.5.0 | 批次 D 收尾（P2 延后项）：D-3 Store EventBus 广播完成 �?新建 `src/store/helpers/withBroadcast.ts` 工具函数，`EVENT_NAMES` 常量新增 21 �?channel�?1/24 Store 添加广播（跳�?signalStore/rotationSignalStore/localKnowledgeStore）；D-4 页面可见性完�?�?新建 `src/hooks/usePageGuard.ts` Hook�? 个高频页面（StockAnalysisPage、IntelligentScorePage、IndustryScorePage、ScoreDocPage、ValuePitPage、HotSectorPage）改造完成；验证 `tsc --noEmit` 0 错误、`vite build` 成功、Store 测试 29 文件 / 490 测试全部通过；D-4c 其他 8-10 页面改造为低优先级延后�?| V9 Quality Audit Team |
| 2026-07-01 | v1.4.0 | 批次 C/E 完成 + 批次 D 部分完成：批�?C（P1-06 local-knowledge 改为 PortalShell 分发；P1-07 移除 /output/settings 卡片入口；P1-08 newsStore.ts 已不存在）；批次 D（D-1 路由文档 06-routing-specs v1.4.0 同步 31 条；D-2 DataBridge `DATA_ACTION_TO_ENVELOPE` 显式映射表替�?`as unknown as` 不安全强转）；批�?E（P2-05 @legacy 标记；P2-06 Mock 使用范围说明；P2-07 已有降级策略；P2-09 �?DEPRECATED 常量；P2-10 v6-competitive-analysis/ 已删除） | V9 Quality Audit Team |
| 2026-07-01 | v1.3.0 | 批次 B 完成：删�?v6-ui-assets/source-migration/、temp/backup/、src/apps/input/prototype/、src/pages/news-v6/（含 /analysis/news-v6 路由）、src/pages/command/ConfigPage.tsx、src/store/newsStore.ts 及相关测试文件；验证无源码引用；163/163 测试文件通过，vite build 成功；补�?InputApp 路由路径修正�?input �?InputDashboard�?| V9 Quality Audit Team |
| 2026-07-01 | v1.2.0 | 批次 A 完成：P0-01/P0-02 状态更新为已修复；补充收尾项（硬编码替换、AbortSignal、CommandHubPage ErrorBoundary）；更新相关测试路径；记录验证结果与剩余类型错误说明 | V9 Quality Audit Team |
| 2026-07-01 | v1.1.0 | 批次 A 启动前准备：更新架构文档�?3-architecture-standards v1.4.0）、路由规格（06-routing-specs v1.3.0）、CHANGELOG；明确“严禁一套功能对应两�?UI 组件”约束；计划使用 Subagent-Driven 执行 + 数据架构�?代码审计师复�?| V9 Quality Audit Team |
| 2026-06-30 | v1.0.0 | 初始版本，基�?V6→V9 架构一致性专项审�?| V9 Quality Audit Team |
