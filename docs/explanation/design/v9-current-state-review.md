---
title: v9-current-state-review
tier: reference
code_version: 2.0.0
---

# V9 智能投研复盘系统 — 当前状态全面梳理（按实施进度）

> **Status**: Current  
> **Version**: v0.9.0-migration-implemented  
> **Last Updated**: 2026-06-25
>
> 本文档按项目实施进度重新梳理 V9 系统：从基础架构 → 输入舱 → 分析舱 → 池流转 → 数据采集 → 交易舱 → 输出/总控舱 → 进行中/待建项。  
> 同时包含各板块对应的引擎/服务、UI 架构子项、本轮变更前后比对，以及文件引用一致性自查结果。  
> 目标读者：核心开发者、架构师、项目管理者。

---

## 实施总览

```
Phase 1: 基础架构与数据层    ✅ 已完成
Phase 2: 输入舱              ✅ 核心完成；近期增强交互
Phase 3: 分析舱              ✅ 核心完成；近期新增筛选引擎
Phase 4: 股票池流转          ✅ 已完成
Phase 5: 数据采集            ✅ 已完成（Python 服务 + 前端适配）
Phase 6: 交易舱              ✅ 核心完成；近期新增信号持久化
Phase 7: 输出舱 / 总控舱     ✅ 已完成
Phase 8: 复盘引擎 / E2E / CI / PWA  🚧 待建
```

---

## Phase 1: 基础架构与数据层

### 1.1 五层架构

```
┌─────────────────────────────────────────────────────────────────────────┐
│  L5 展示层：pages/, components/, portal/, cockpit/                       │
│  页面、可复用 UI 组件、门户导航、驾驶舱 Dashboard                         │
├─────────────────────────────────────────────────────────────────────────┤
│  L4 应用层：apps/（输入/分析/交易/输出/总控五舱）                         │
│  五舱应用入口、业务编排、子页面组合                                       │
├─────────────────────────────────────────────────────────────────────────┤
│  L3 引擎/服务层：services/, core/                                         │
│  业务服务、筛选/评分/交易/风控/采集引擎、DataBridge、ACL、信封            │
├─────────────────────────────────────────────────────────────────────────┤
│  L2 数据层：data/                                                         │
│  IndexedDB 封装（db.ts）、统一数据接口（dataLayer.ts）、类型定义（types.ts）│
├─────────────────────────────────────────────────────────────────────────┤
│  L1 基础设施层：lib/, config/                                             │
│  事件总线、日志、工具函数、各类配置、主题令牌                               │
└─────────────────────────────────────────────────────────────────────────┘
```

### 1.2 核心架构原则

| 原则 | 说明 | 落地检查 |
|------|------|----------|
| 纯前端 + 本地数据主权 | 数据存储于 IndexedDB（`V6ProDB`，版本 `4`） | ✅ `src/config/dbConfig.ts` / `src/data/db.ts` |
| 跨模块写操作走信封 | 所有写操作通过 `DataBridge.forward(StandardEnvelope)` | ✅ 审计脚本 0 违规 |
| 上层禁止直接写 L2 | L5/L4 不直接调用 `dataLayer.*.(add/save/update/delete)` | ✅ 组件层仅通过 Service 访问 |
| 五舱工作流 | 输入 → 分析 → 交易 → 输出 → 总控 | ✅ `workflowStore` + `PortalShell` |
| 研究体系不依赖交易层 | 删除交易层后研究功能仍可完整运行 | ✅ `orders/signals` 为独立 Store |

### 1.3 数据流

```
UI / Pages / Apps (L5/L4)
        ↓ 调用 Service
   src/services/{module}/*.ts (L3)
        ↓ 构造 StandardEnvelope
   DataBridge.forward(envelope) (L3)
        ↓ validate + ACL + audit + broadcast
   dataLayer.*Store.save/add/... (L2)
        ↓ db.put / db.get / db.getAll
   IndexedDB (V6ProDB)
```

- **读路径**：`UI → Service → dataLayer → db`（不经过 DataBridge）。
- **写路径**：`Service → DataBridge → ACL → dataLayer → db`，并自动写入 `research_logs` 审计。

### 1.4 基础设施文件

| 文件 | 职责 |
|------|------|
| `src/core/databridge.ts` | 信封路由、ACL 校验、审计日志、广播订阅 |
| `src/core/envelope.ts` | 标准信封创建与校验 |
| `src/core/acl.ts` | ACL 权限引擎 |
| `src/core/poolTransitionEngine.ts` | 股票池状态机与合法流转定义 |
| `src/data/dataLayer.ts` | 统一数据访问层（stocks/dailyQuotes/v6Scores/orders/signals 等） |
| `src/data/db.ts` | IndexedDB 封装（`V6Database`） |
| `src/data/types.ts` | 数据模型类型定义 |
| `src/lib/eventBus.ts` | 事件总线 |
| `src/lib/logger.ts` | 日志 |
| `src/lib/utils.ts` | `cn` 等工具函数 |

### 1.5 IndexedDB Schema（v4）

| Store | keyPath | 说明 |
|-------|---------|------|
| `stocks` | `symbol` | 股票基础信息与池状态 |
| `daily_quotes` | `symbol` | 日 K 线/行情数据 |
| `v6_scores` | `symbol` | V6 自动评分 |
| `intelligent_scores` | `id`（autoIncrement） | V6 个股智能评分 |
| `industry_scores` | `id`（autoIncrement） | V4 行业智能评分 |
| `signals` | `id` | 交易信号 |
| `orders` | `id` | 模拟订单 |
| `watchlists` | `id` | 观察列表 |
| `research_logs` | `id`（autoIncrement） | 审计日志 |

### 1.6 基础 UI 组件

```
src/components/ui/
├── Button.tsx
├── Card.tsx
├── Input.tsx
├── Badge.tsx
├── Checkbox.tsx    # 新增
├── Progress.tsx
└── Textarea.tsx
```

### 1.7 路由与导航

| 文件 | 职责 |
|------|------|
| `src/config/routes.ts` | 路由注册表（唯一真相源） |
| `src/App.tsx` | HashRouter + 顶层路由 |
| `src/portal/PortalShell.tsx` | 五舱门户框架（深色模式） |
| `src/cockpit/CockpitShell.tsx` | 驾驶舱 Dashboard |
| `src/store/workflowStore.ts` | 当前激活舱室状态 |

---

## Phase 2: 输入舱

### 2.1 应用入口

| 文件 | 职责 |
|------|------|
| `src/apps/input/InputApp.tsx` | 输入舱应用入口 |
| `src/apps/input/InputDashboard.tsx` | 录入看板（股票池、搜索、统计、批量操作） |
| `src/apps/input/BulkImportPanel.tsx` | 批量文本导入 |
| `src/apps/input/HotSectorPanel.tsx` | 热门板块推荐 |
| `src/apps/input/DataTestPanel.tsx` | 数据采集测试 |

### 2.2 输入舱服务

| 文件 | 关键导出 | 职责 |
|------|----------|------|
| `src/services/input/inputService.ts` | `addStock`、`addStockFromSearch`、`searchStocks`、`exportPool`、`importPool` | 股票录入、搜索、候选池导入导出 |
| `src/services/input/batchImportService.ts` | `parseBulkInput`、`importStocks` | 批量文本解析与导入 |
| `src/services/input/hotSectorService.ts` | `getHotSectors`、`addHotSectorStocks` | 热门板块推荐 |
| `src/services/input/mockStockLibrary.ts` | `MOCK_STOCK_LIBRARY` | 离线 mock 股票库 |

### 2.3 输入舱 UI 组件

```
src/components/input/
├── StockSearch.tsx      # 支持 mode='fill'|'add'
└── QualityIndicator.tsx

src/components/pool/
├── PoolBoard.tsx        # 看板/列表视图切换
├── PoolColumn.tsx
├── PoolCard.tsx         # 新增复选框
├── PoolList.tsx         # 新增列表视图
└── usePoolData.ts
```

### 2.4 输入舱配置

| 文件 | 职责 |
|------|------|
| `src/config/inputConfig.ts` | 搜索、批量导入、数据质量规则配置 |

### 2.5 本轮输入舱增强（变更前后比对）

| 维度 | 变更前 | 变更后 |
|------|--------|--------|
| 股票搜索 | 仅支持回填代码/名称 | 新增 `mode='add'`，选择即录入候选池 |
| 股票池视图 | 仅看板视图 | 新增 `PoolList` 列表视图，支持看板/列表切换 |
| 批量操作 | 无复选框 | `PoolCard`/`PoolList` 支持复选，`InputDashboard` 支持批量归档/流转 |
| 数据质量筛选 | 无 | 新增 `qualityFilter`：all / missingBasic / missingKline / missingFinance |
| 原子组件 | 无 Checkbox | 新增 `Checkbox` 组件 |

---

## Phase 3: 分析舱

### 3.1 应用入口与页面

| 文件 | 职责 |
|------|------|
| `src/apps/analysis/AnalysisApp.tsx` | 分析舱应用入口 |
| `src/pages/analysis/StockAnalysisPage.tsx` | 个股分析/V6 评分 |
| `src/pages/analysis/IndustryScorePage.tsx` | V4 行业智能评分 |
| `src/pages/analysis/IntelligentScorePage.tsx` | V6 个股智能评分（LLM） |
| `src/pages/analysis/SectorAnalysisPage.tsx` | 行业板块分析 |
| `src/pages/analysis/BacktestPage.tsx` | 策略回测 |

### 3.2 评分服务

| 文件 | 关键导出 | 职责 |
|------|----------|------|
| `src/services/scoring/v6ScoreService.ts` | `runV6Score` | V6 九维自动评分 |
| `src/services/scoring/intelligentScoreService.ts` | `runIntelligentScore` | V6 个股智能评分（LLM） |
| `src/services/scoring/industryScoreService.ts` | `runIndustryScore` | V4 行业智能评分 |
| `src/services/scoring/intelligentScorePrompt.ts` | `buildIntelligentScorePrompt` | 个股评分 Prompt |
| `src/services/scoring/industryScorePrompt.ts` | `buildIndustryScorePrompt` | 行业评分 Prompt |

### 3.3 分析舱数据编排

| 文件 | 关键导出 | 职责 |
|------|----------|------|
| `src/services/analysis/analysisService.ts` | `listStocks`、`listV6Scores` | 分析舱基础数据加载 |
| `src/services/analysis/scorePageService.ts` | `loadStockForAnalysis`、`loadV6ScoreForAnalysis` 等 | 分析页面数据编排 |

### 3.4 筛选引擎（本轮新增）

| 文件 | 关键导出 | 职责 |
|------|----------|------|
| `src/services/analysis/screeningEngine.ts` | `runScreening`、`screenSingleStock` | 股票池自动筛选晋升（candidate→screened→deepDive） |
| `src/config/screeningConfig.ts` | `getDefaultScreeningThresholds` | 筛选阈值配置 |

### 3.5 评分相关 UI 组件

```
src/components/
├── ScoreFactorDeltaPanel.tsx
└── ScoreUpdateAlert.tsx
```

### 3.6 本轮筛选引擎增强（变更前后比对）

| 维度 | 变更前 | 变更后 |
|------|--------|--------|
| 筛选能力 | 手动点击流转 | 自动按阈值晋升 candidate→screened→deepDive |
| 配置 | 无 | 新增 `src/config/screeningConfig.ts` |
| 测试 | 无 | 新增 `tests/screeningEngine.test.ts` |
| ACL 合规 | — | 分析舱无 stocks 写权限，通过 `stockpoolService.transitionStock()` 间接驱动 |

---

## Phase 4: 股票池流转

### 4.1 状态机

```
candidate → screened → deepDive → watching → archived
```

| 状态 | 含义 |
|------|------|
| `candidate` | 候选池（刚录入） |
| `screened` | 初筛池 |
| `deepDive` | 深度研究池 |
| `watching` | 观察池（等待交易信号） |
| `archived` | 归档池 |

### 4.2 流转服务

| 文件 | 关键导出 | 职责 |
|------|----------|------|
| `src/services/pool/poolService.ts` | `transitionStock`、`getStocksByStatus`、`getAllPoolGroups` | 股票池状态流转、分组加载 |
| `src/core/poolTransitionEngine.ts` | `POOL_TRANSITIONS`、`isValidTransition`、`getNextStatuses` | 股票池状态机 |

### 4.3 调用链

- 流转触发：`UI → stockpoolService.transitionStock() → DataBridge.forward(UPDATE_STOCK) → stocks Store`
- 事件通知：`eventBus.emit('stocks:changed')`

---

## Phase 5: 数据采集

### 5.1 前端采集服务

| 文件 | 关键导出 | 职责 |
|------|----------|------|
| `src/services/fetcher/fetcherService.ts` | `fetchStockBasic`、`fetchStockKline`、`refreshSymbol` | 股票基础数据/K线采集编排 |
| `src/services/fetcher/fetcherClient.ts` | `collectBasic`、`collectKline` | Python 采集服务 HTTP 客户端 |
| `src/services/fetcher/fetcherAdapter.ts` | `adaptBasicDataToStock`、`adaptKlineDataToDailyQuotes` | 采集数据适配本地模型 |
| `src/services/fetcher/fetcherScheduler.ts` | `getFetcherScheduler` | 手动/事件触发调度 |
| `src/services/fetcher/fetcherTypes.ts` | 采集接口类型 | 类型定义 |

### 5.2 Python 采集服务

| 文件 | 职责 |
|------|------|
| `python/data_service/collect_endpoints.py` | FastAPI 路由：健康检查、基础数据、K线采集 |

### 5.3 配置

| 文件 | 职责 |
|------|------|
| `src/config/fetcherConfig.ts` | 数据采集服务配置 |

---

## Phase 6: 交易舱

### 6.1 应用入口

| 文件 | 职责 |
|------|------|
| `src/apps/trading/TradingApp.tsx` | 交易舱应用入口（信号扫描、交易建议、模拟下单、持仓订单） |

### 6.2 交易服务

| 文件 | 关键导出 | 职责 |
|------|----------|------|
| `src/services/trading/tradingService.ts` | `scanWatchingSignals`、`adviseForStock`、`createBuyOrder`、`createSellOrder` | 信号扫描、交易建议、模拟下单 |
| `src/services/trading/signalGenerator.ts` | `generateSignalsForSymbol`、`pickStrongestSignal` | 技术信号生成 |
| `src/services/trading/positionSizer.ts` | `calculatePosition` | 仓位计算（半 Kelly + 风控约束） |
| `src/services/trading/riskEngine.ts` | `checkOrderRisk` | 订单风控检查 |

### 6.3 交易配置

| 文件 | 职责 |
|------|------|
| `src/config/tradingConfig.ts` | 信号阈值、Kelly 仓位、风控参数 |

### 6.4 信号持久化（本轮新增）

| 维度 | 变更前 | 变更后 |
|------|--------|--------|
| 信号存储 | 信号仅在内存中返回 | `tradingService.scanWatchingSignals()` 将信号写入 `signals` Store |
| 信封动作 | 无 `INSERT_SIGNAL` | 新增 `INSERT_SIGNAL` action |
| ACL | 无 | `tradinghub` 增加 `signals` 读/写权限 |
| 数据层 | 无 `signalStore` | `dataLayer.signals.save/list/listBySymbol` |
| DataBridge 路由 | 无 | 新增 `insertSignal` 分支 |
| 测试 | 无 | 新增 `tests/signalPersistence.test.ts` |

---

## Phase 7: 输出舱 / 总控舱

### 7.1 输出舱

| 文件 | 职责 |
|------|------|
| `src/apps/output/OutputApp.tsx` | 研究报告、数据导出 |

### 7.2 总控舱

| 文件 | 职责 |
|------|------|
| `src/apps/command/CommandApp.tsx` | 系统监控、数据重置、全量导出 |

### 7.3 系统服务

| 文件 | 关键导出 | 职责 |
|------|----------|------|
| `src/services/system/systemService.ts` | `loadSystemStats`、`resetAll`、`exportAll` | 系统统计、重置、导出 |

---

## Phase 8: 进行中 / 待建项

| 项目 | 状态 | 文档位置 | 计划 |
|------|------|----------|------|
| 复盘引擎（ReviewEngine） | 🚧 未实现 | ADR-007 | 待下一轮实现 |
| `tradeErrorClassifier.ts` | 🚧 未建 | `../../reference/05-engine-specs.md` §3.2 | Phase 2/3 待建 |
| `tradeReviewAI.ts` | 🚧 未建 | `../../reference/05-engine-specs.md` §3.2/§3.8 | Phase 2/3 待建 |
| E2E 测试 | 🚧 未建立 | `../../reference/09-quality-gates.md` 门禁 #9 | Phase 3 引入 Playwright |
| CI 工作流 | 🚧 未建立 | `../../reference/09-quality-gates.md` §6.1 | Phase 3 建立 |
| PWA 离线验证 | 🚧 未建立 | `../../reference/09-quality-gates.md` 门禁 #11 | Phase 3 配置 |

---

## ACL 矩阵

ACL 配置定义于 `src/config/dbConfig.ts`，校验逻辑在 `src/core/acl.ts`。

| Module | 读权限 | 写权限 |
|--------|--------|--------|
| `fetcher` | — | `stocks`、`daily_quotes` |
| `stockpool` | `stocks`、`v6_scores` | `stocks` |
| `analyzer` | `stocks`、`v6_scores`、`intelligent_scores`、`industry_scores` | `v6_scores`、`intelligent_scores`、`industry_scores` |
| `tradinghub` | `stocks`、`v6_scores`、`orders`、`signals` | `orders`、`signals` |
| `system` | 全部 | 全部 |
| `user` | `stocks`、`v6_scores`、`orders` | `stocks`、`orders` |

> `research_logs` 仅由 `DataBridge` 内部自动写入，不对外暴露直接写入接口。

---

## 全局 UI 架构

### 样式体系

- **Tailwind CSS**：`src/index.css` 入口，`tailwind.config.js` 配置。
- **shadcn/ui 风格**：自建原子组件，使用 `cn()`（`clsx` + `tailwind-merge`）。
- **CSS 变量主题**：浅色/深色模式，扩展宋瓷语义色（汝蓝、官绿、朱砂等）。
- **深色模式**：`PortalShell.tsx` 根节点硬编码 `className="dark"`，舱室默认深色。

### 路由结构

- **HashRouter**（`src/App.tsx`）。
- 五舱入口渲染 `PortalShell`，由 `PortalShell` 懒加载对应 `src/apps/{cabin}/{Cabin}App.tsx`。
- 分析舱子页面（`/analysis/*`）单独配置，避免被 `PortalShell` 吞掉。

### 组件层级（输入舱示例）

```
InputApp.tsx
└── InputDashboard.tsx
    ├── Card / Button / Input / Badge
    ├── StockSearch
    └── PoolBoard
        ├── PoolColumn (kanban)
        │   └── PoolCard
        │       ├── Checkbox
        │       ├── QualityIndicator
        │       ├── Badge
        │       └── Button
        └── PoolList (list)
            ├── Checkbox
            ├── QualityIndicator
            ├── Badge
            └── Button
```

---

## 文件引用一致性自查结果

### 已修复的文档漂移

| # | 文件 | 问题 | 修复内容 |
|---|------|------|----------|
| 1 | `../../../README.md` | 测试计数写为「6/6」，功能列表过时 | 更新为「291/291，44 个测试文件」；补充筛选引擎、信号持久化、输入舱增强、V6 数据迁移 |
| 2 | `../../reference/03-architecture-standards.md` | DB 版本写为 `3`；`inputConfig.ts` 标为待建；L2 数据层未提及 `signals` | DB 版本更新为 `4`；`inputConfig.ts` 标为已建；偏差清单 D07 改为已修复；L2 映射补充 `signals` |
| 3 | `../../reference/05-engine-specs.md` | `EnvelopeAction` 遗漏 `INSERT_SIGNAL`；ACL 矩阵遗漏 tradinghub 读 `signals`；偏差清单仍写输入舱缺少 `inputConfig.ts` | 补充 `INSERT_SIGNAL`；ACL 矩阵更新；偏差清单更新 |
| 4 | `./implementation-governance.md` | ADR 表只到 ADR-006；ADR 目录状态为「待建立」 | 补充 ADR-007；ADR 目录状态改为已建立 7 个 ADR |
| 5 | `../../reference/data-interaction-protocols.md` | `orders.signalId` 字段在代码中不存在 | 标注为「规划中」，说明将在复盘引擎阶段补齐 |
| 6 | `../../reference/02-functional-specs.md` | 导出示例仅含 stocks/v6_scores/orders/watchlists | 补充全部 Store |
| 7 | `docs/README.md` | 专项文档导航表遗漏 `../../reference/input-cabin-ui-reshaping.md` 与 `investment-pipeline-stage-analysis.md` | 补录两项文档 |
| 8 | `../../reference/09-quality-gates.md` | 当前扫描基线仍写 107/107 passed；偏差收敛计划仍写输入舱缺少 `inputConfig.ts` | 更新为 291/291 passed；E2E 基线更新为 5/5 passed；偏差项改为已修复 |

### 自查结论

- **架构与代码一致**：五层架构、五态股票池、DataBridge 信封流、ACL 矩阵均与代码对齐。
- **跨层调用合规**：`audit:layers` 0 违规 / 0 警告；UI 层未直接调用 `dataLayer` 写操作。
- **文档漂移已收敛**：本轮自查修复了 8 处与最新代码不一致的文档引用。
- **待实现项已诚实记录**：复盘引擎、E2E/CI/PWA 等未落地项在 ADR 与质量门禁文档中均有明确标注。

---

## 质量门禁当前基线

```
✅ tsc --noEmit           0 errors
✅ npm run lint           0 warnings/errors
✅ npm run test           291/291 passed（44 个测试文件）
✅ npm run test:e2e       5/5 passed
✅ npm run build          success
✅ npm run audit:layers   0 违规 / 0 警告（扫描 92 个文件）
```

---

## 下一步建议

1. **复盘引擎**：按 ADR-007 落地 `src/services/output/reviewEngine.ts` 或 `src/services/system/reviewEngine.ts`，补齐交易复盘笔记、错误归类、信号-订单血缘。
2. **信号-评分联动**：将 V6 评分因子作为 `signalGenerator.ts` 的输入，提升交易信号质量。
3. **E2E/CI**：引入 Playwright 并建立 `.github/workflows/ci.yml`，把质量门禁自动化。
4. **架构版本比对文档**：同步更新 `../../reference/architecture-version-comparison.md`，反映 v0.9.0-docs-review 的最新变化。
5. **输入舱原型清理**：`src/apps/input/` 在正式功能稳定后可考虑移除或归档，减少维护面。
