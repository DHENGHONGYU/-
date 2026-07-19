---
title: refactor-research-pool-rename-plan
type: reference
domain: backend
phase: planning
tier: important
status: active
maintainer: V9 Architecture Team
summary: "�?PoolBoard / poolBoard / usePoolBoard 等泛化旧名替换为精确�?ResearchPoolBoard / researchPoolBoard / useResear�?
tags: [backend, refactor, factor, plan, research]
version: v1.0.0
last_updated: 2026-07-17
code_version: 2.0.0
doc_id: V9-DOC-BACK-011
change_log:
  - version: v1.0.0
changes: Initial version established
date: 2026-07-17
---

# 「股票池」泛化旧名称 内部标识符重命名重构方案

> **Version**: v1.0 | **日期**: 2026-07-20
> **范围**: `src/` + `tests/` + `cockpit/` 中所有研究池专用标识�?> **目标**: �?`PoolBoard` / `poolBoard` / `usePoolBoard` 等泛化旧名替换为精确�?`ResearchPoolBoard` / `researchPoolBoard` / `useResearchPoolBoard`，消除与三分拆后 `intention/research/position` 三池的语义混淆�?
---

## 一、扫描总览

| 维度 | 统计 |
|------|------|
| 涉及文件�?| **~35 �?*�?ts / .tsx / .test.tsx�?|
| 泛化标识符出现次�?| **~200+ �?*（含类型名、变量名、键名、注释、日志） |
| 目录重命�?| **1 �?*（`src/components/organisms/pool/`�?|
| 路由变更 | **1 �?*（`/analysis/pool-board`�?|

---

## 二、分类结论：哪些改、哪些保�?
### �?保留不变（三分拆通用基础设施�?
以下模块�?`intention / research / position` 三池�?*共享基础设施**，`Pool` 作为通用术语在此层是合理的，不应改动�?
| 文件/模块 | 保留理由 |
|-----------|----------|
| `src/services/pool/poolService.ts` | 三池 CRUD 与流转的通用 Service |
| `src/mcp/servers/pool/poolServer.ts` | 三池 MCP Server |
| `src/core/poolTransitionEngine.ts` | 三池状态流转引�?|
| `src/constants/pool.constants.ts` | �?`POOL_TYPE`、`RESEARCH_STATUS` 等三池共用常�?|
| `src/types/modules/pool.types.ts` | �?`PoolItem` 等三池共用类�?|
| `src/store/intentionPoolStore.ts` | 已精确命�?|
| `src/store/researchPoolStore.ts` | 已精确命�?|
| `src/store/positionPoolStore.ts` | 已精确命�?|
| `src/store/poolStore.test.ts` | 三分�?Store 的集成测试，文件名可接受 |

### �?保留不变（驾驶舱独立概念�?
`watchlist`（观察列表）是驾驶舱的独立功能，�?股票�?无继承关系，**全部不动**�?
- `src/cockpit/widgets/WatchlistWidget.tsx`
- `src/cockpit/widgets/WatchlistMoversWidget.tsx`
- `src/data/dataLayerWatchlistStore.ts`
- `src/store/watchlistStore.ts`
- 所�?`WatchlistData` / `watchlist` 类型与键�?
### ⚠️ 必须重命名（研究池专用标识符�?
当前 `PoolBoard` 系列虽然名字泛化，但**已实现上已硬编码为研究池专用**（使�?`RESEARCH_STATUS`、`useResearchPoolStore`、`POOL_TYPE.research`），因此应精确重命名�?`ResearchPool`�?
| 当前泛化�?| 目标精确�?| 性质 |
|-----------|-----------|------|
| `PoolBoard` | `ResearchPoolBoard` | 组件 + 接口 |
| `PoolBoardItem` | `ResearchPoolBoardItem` | 接口 |
| `PoolBoardProps` | `ResearchPoolBoardProps` | 接口 |
| `PoolViewMode` | `ResearchPoolViewMode` | 类型别名 |
| `PoolCard` | `ResearchPoolCard` | 组件 |
| `PoolColumn` | `ResearchPoolColumn` | 组件 |
| `PoolList` | `ResearchPoolList` | 组件 |
| `PoolBoardPage` | `ResearchPoolBoardPage` | 页面 |
| `PoolBoardWidget` | `ResearchPoolBoardWidget` | Widget |
| `usePoolBoard` | `useResearchPoolBoard` | Hook |
| `usePoolDataFromStore` | `useResearchPoolDataFromStore` | Hook |
| `widgetId: 'poolBoard'` | `widgetId: 'researchPoolBoard'` | 注册 ID |
| `dataType: 'poolBoard'` | `dataType: 'researchPoolBoard'` | 数据契约 |
| `MarketData.poolBoard` | `MarketData.researchPoolBoard` | 数据契约 |
| `/analysis/pool-board` | `/analysis/research-pool` | 路由 |
| `[PoolBoard]` | `[ResearchPoolBoard]` | 日志前缀 |

---

## 三、命名映射详�?
### 3.1 文件/目录重命�?
| 原路�?| 新路�?|
|--------|--------|
| `src/components/organisms/pool/` | `src/store/researchPoolStore.ts` |
| `src/components/organisms/pool/PoolBoard.tsx` | `src/components/organisms/pool/PoolBoard.tsx` |
| `src/components/organisms/pool/PoolCard.tsx` | `src/components/organisms/pool/PoolCard.tsx` |
| `src/components/organisms/pool/PoolColumn.tsx` | `src/components/organisms/pool/PoolColumn.tsx` |
| `src/components/organisms/pool/PoolList.tsx` | `src/components/organisms/pool/PoolList.tsx` |
| `src/components/organisms/pool/usePoolDataFromStore.ts` | `src/hooks/usePoolBoard.ts` |
| `src/hooks/usePoolBoard.ts` | `src/hooks/usePoolBoard.ts` |
| `src/pages/analysis/PoolBoardPage.tsx` | `src/pages/analysis/PoolBoardPage.tsx` |
| `src/cockpit/widgets/PoolBoardWidget.tsx` | `src/cockpit/widgets/PoolBoardWidget.tsx` |
| `tests/PoolBoard.test.tsx` | `tests/ResearchPoolBoard.test.tsx` |

### 3.2 类型/接口重命�?
| 原名 | 新名 | 所在文�?|
|------|------|----------|
| `PoolBoard` (interface) | `ResearchPoolBoard` | `src/types/modules/widget.types.ts` |
| `PoolBoardItem` (interface) | `ResearchPoolBoardItem` | `src/types/modules/widget.types.ts` |
| `PoolBoardProps` | `ResearchPoolBoardProps` | `src/components/organisms/pool/PoolBoard.tsx` |
| `PoolViewMode` | `ResearchPoolViewMode` | `src/components/organisms/pool/PoolBoard.tsx` |
| `PoolBoardWidgetProps` | `ResearchPoolBoardWidgetProps` | `src/cockpit/widgets/PoolBoardWidget.tsx` |

### 3.3 数据契约键名重命�?
| 原名 | 新名 | 所在文�?|
|------|------|----------|
| `dataType: 'poolBoard'` | `dataType: 'researchPoolBoard'` | `src/types/modules/widget.types.ts` |
| `MarketData.poolBoard` | `MarketData.researchPoolBoard` | `src/types/modules/widget.types.ts` |
| `DEFAULT_WIDGET_CONFIG.poolBoard` | `DEFAULT_WIDGET_CONFIG.researchPoolBoard` | `src/constants/cockpit.constants.ts` |
| `WIDGET_DEFAULT_DATA_SOURCE.poolBoard` | `WIDGET_DEFAULT_DATA_SOURCE.researchPoolBoard` | `src/constants/cockpit.constants.ts` |
| `MarketDataSourceKey` union `'poolBoard'` | `'researchPoolBoard'` | `src/store/marketDataStore.ts` |
| `WIDGET_ID_TO_DATA_SOURCE_KEY['poolBoard']` | `['researchPoolBoard']` | `src/store/marketDataStore.ts` |
| `uiText.poolBoard` | `uiText.researchPoolBoard` | `src/constants/uiText/uiText.input.ts`、`uiText.errors.ts` |

### 3.4 函数/方法重命�?
| 原名 | 新名 | 所在文�?|
|------|------|----------|
| `getPoolBoard()` | `getResearchPoolBoard()` | `src/services/stock-analysis/scoringStrategy.ts` |
| `getPoolBoard()` | `getResearchPoolBoard()` | `src/services/stock-analysis/mockStockAnalysisProvider.ts` |
| `checkPoolBoard()` | `checkResearchPoolBoard()` | `src/core/pipelineScheduler.ts` |
| `adaptPoolBoard()` | `adaptResearchPoolBoard()` | `src/services/data-collector/MarketDataAdapter.ts` |
| `adaptPoolBoardItem()` | `adaptResearchPoolBoardItem()` | `src/services/data-collector/MarketDataAdapter.ts` |
| `getDefaultPoolBoard()` | `getDefaultResearchPoolBoard()` | `src/services/data-collector/MarketDataAdapter.ts` |
| `generatePoolBoardPayload()` | `generateResearchPoolBoardPayload()` | `src/services/data-collector/mockDataCollection.ts` |

---

## 四、分波次重构方案

> **原则**: 每波独立可验证，波次间不依赖。每波完成后执行 `npx tsc --noEmit && npm run test -- --run` 确认绿�?
### 波次 1：零风险文本清理（用户可见文�?+ 注释 + 日志字符串）

**风险等级**: ⭐（零风险）
**影响文件**: ~15 �?**改动内容**: 仅修改字符串字面量、JSDoc、注释、日志中的中文文本，**不触碰任何标识符名或类型�?*�?
| 文件 | 改动�?|
|------|--------|
| `src/constants/cockpit.constants.ts:503` | title: `"股票池管理与监控"` �?`"研究池管理与监控"` |
| `src/constants/cockpit.constants.ts:169` | JSDoc: `"股票池状态颜色映�?` �?`"研究池状态颜色映�?` |
| `src/constants/cockpit.constants.ts:170` | JSDoc: `"用于股票池列表状态条颜色"` �?`"用于研究池列表状态条颜色"` |
| `src/components/componentRegistry.ts:87-91` | description: `"股票池看�?卡片/列视�?列表"` �?`"研究池看�?卡片/列视�?列表"` |
| `src/types/modules/widget.types.ts:314` | JSDoc: `"股票池看板数�?` �?`"研究池看板数�?` |
| `src/types/modules/widget.types.ts:328` | JSDoc: `"股票池看板条�?` �?`"研究池看板条�?` |
| `src/hooks/usePoolBoard.ts:3` | JSDoc: `"股票池看板页面逻辑"` �?`"研究池看板页面逻辑"` |
| `src/pages/analysis/PoolBoardPage.tsx:3` | JSDoc: `"股票池看板独立页�?` �?`"研究池看板独立页�?` |
| `src/cockpit/widgets/PoolBoardWidget.tsx:33` | JSDoc: `"股票池看�?Widget"` �?`"研究池看�?Widget"` |
| `src/cockpit/widgets/PoolBoardWidget.tsx:34` | JSDoc: `"展示股票池列�?` �?`"展示研究池列�?` |
| `src/core/pipelineScheduler.ts:343` | 日志: `"股票池数据完整�?` �?`"研究池数据完整�?` |
| `src/core/pipelineScheduler.ts:373` | 日志: `"股票池数据完整性校验完�?` �?`"研究池数据完整性校验完�?` |
| `src/store/signalStore.ts:100` | 错误消息: `"查询股票池失�?` �?`"查询研究池失�?` |
| `src/store/signalStore.ts:107` | 日志: `"获取股票�?` �?`"获取研究�?` |
| `src/store/dualStrategyStore.ts:206` | 日志: `"�?DataBridge 获取股票�?` �?`"�?DataBridge 获取研究�?` |
| `src/store/dualStrategyStore.ts:208` | 日志: `"使用传入股票�?` �?`"使用传入研究�?` |
| `src/store/dualStrategyStore.ts:229` | 日志: `"股票池为�?` �?`"研究池为�?` |
| `src/store/strategySnapshotStore.ts:205` | 日志: `"股票池为�?` �?`"研究池为�?` |
| `src/services/screening/multiFactorScreeningEngine.ts:85` | 日志: `"可筛选股票池"` �?`"可筛选研究池"` |
| `src/services/screening/multiFactorScreeningEngine.ts:94` | 日志: `"股票池为�?` �?`"研究池为�?` |
| `src/services/screening/multiFactorScreeningEngine.ts:110` | 日志: `"加载股票池完�?` �?`"加载研究池完�?` |
| `src/services/trading/strategyEngine.ts:55` | 日志: `"输入股票池为�?` �?`"输入研究池为�?` |
| `src/constants/store-channels.constants.ts:22` | JSDoc: `"股票池数据变�?` �?`"三池数据变更"` |
| `src/constants/store-channels.constants.ts:82` | �? `"股票�?` �?`"研究�?` |
| `src/agents/agentComponentRegistry.ts:116` | displayName: `"股票池内省智能体"` �?`"研究池内省智能体"` |
| `src/data/dataLayerStockStores.ts:5` | JSDoc: `"股票�?CRUD"` �?`"三池 CRUD"` |
| `src/data/types/types.dataLayer.ts:16` | 注释: `"股票池相关类�?` �?`"三池相关类型"` |
| `src/services/data-collector/MarketDataAdapter.ts:405` | JSDoc: `"适配股票池数�?` �?`"适配研究池数�?` |
| `src/services/data-collector/MarketDataAdapter.ts:426` | JSDoc: `"适配单个股票池条�?` �?`"适配单个研究池条�?` |
| `src/services/data-collector/MarketDataAdapter.ts:563` | JSDoc: `"默认 PoolBoard"` �?`"默认 ResearchPoolBoard"` |
| `src/services/data-collector/mockDataCollection.ts:248` | JSDoc: `"股票池看板条�?` �?`"研究池看板条�?` |
| `src/services/data-collector/mockDataCollection.ts:260` | JSDoc: `"股票池看板数�?` �?`"研究池看板数�?` |
| `src/services/data-collector/mockDataCollection.ts:567` | JSDoc: `"生成股票池看�?payload"` �?`"生成研究池看�?payload"` |

**验证命令**:
```bash
npx tsc --noEmit
npm run test -- --run
```

---

### 波次 2：类型别名重命名（编译期安全�?
**风险等级**: ⭐⭐（低风险�?**影响文件**: ~8 �?**改动内容**: 仅修�?TypeScript 类型/接口名及其引用，**不触碰组件运行时代码或文件路�?*�?
| 原名 | 新名 | 引用位置 |
|------|------|----------|
| `PoolBoard` (interface) | `ResearchPoolBoard` | `widget.types.ts`, `mockDataCollection.ts`, `MarketDataAdapter.ts`, `scoringStrategy.ts`, `marketDataStore.ts`, `mockStockAnalysisProvider.ts` |
| `PoolBoardItem` (interface) | `ResearchPoolBoardItem` | `widget.types.ts`, `PoolBoardWidget.tsx`, `mockDataCollection.ts`, `MarketDataAdapter.ts`, `scoringStrategy.ts` |
| `PoolBoardProps` | `ResearchPoolBoardProps` | `PoolBoard.tsx`, `PoolBoard.test.tsx` |
| `PoolViewMode` | `ResearchPoolViewMode` | `PoolBoard.tsx`, `usePoolBoard.ts` |
| `PoolBoardWidgetProps` | `ResearchPoolBoardWidgetProps` | `PoolBoardWidget.tsx` |

**验证命令**:
```bash
npx tsc --noEmit
```

---

### 波次 3：组�?Hook/页面标识符重命名（中风险�?
**风险等级**: ⭐⭐⭐（中风险）
**影响文件**: ~15 �?**改动内容**: 修改组件、Hook、页面的导出名和调用名，**不涉及文件路径变�?*�?
| 原名 | 新名 | 导出文件 | 引用文件 |
|------|------|----------|----------|
| `PoolBoard` | `ResearchPoolBoard` | `PoolBoard.tsx` | `PoolBoardPage.tsx`, `PoolBoard.test.tsx`, `components/organisms/index.ts`, `componentRegistry.ts` |
| `PoolCard` | `ResearchPoolCard` | `PoolCard.tsx` | `PoolBoard.tsx`, `components/organisms/index.ts`, `componentRegistry.ts` |
| `PoolColumn` | `ResearchPoolColumn` | `PoolColumn.tsx` | `PoolBoard.tsx`, `components/organisms/index.ts`, `componentRegistry.ts` |
| `PoolList` | `ResearchPoolList` | `PoolList.tsx` | `PoolBoard.tsx`, `components/organisms/index.ts`, `componentRegistry.ts` |
| `usePoolBoard` | `useResearchPoolBoard` | `usePoolBoard.ts` | `PoolBoardPage.tsx` |
| `PoolBoardPage` | `ResearchPoolBoardPage` | `PoolBoardPage.tsx` | `AnalysisApp.tsx` |
| `PoolBoardWidget` | `ResearchPoolBoardWidget` | `PoolBoardWidget.tsx` | `widgetRegistry.ts` |

**验证命令**:
```bash
npx tsc --noEmit
npm run test -- --run
```

---

### 波次 4：数据契约键名重命名（高风险，跨层联动）

**风险等级**: ⭐⭐⭐⭐（高风险�?**影响文件**: ~12 �?**改动内容**: 修改运行时数据契约键名（widgetId、dataType、MarketData 字段、Store 键等），涉及 cockpit、数据层、Widget 注册表三层联动�?
| 契约层级 | 原名 | 新名 | 所在文�?|
|----------|------|------|----------|
| Widget ID | `widgetId: 'poolBoard'` | `'researchPoolBoard'` | `widgetRegistry.ts`, `widgetRegistrySync.test.ts`, `cockpit.constants.ts` |
| 数据类型 | `dataType: 'poolBoard'` | `'researchPoolBoard'` | `widget.types.ts`, `mockDataCollection.ts`, `MarketDataAdapter.ts`, `marketDataStore.ts` |
| MarketData 字段 | `MarketData.poolBoard` | `MarketData.researchPoolBoard` | `widget.types.ts`, `PoolBoardWidget.tsx`, `EngineStatusWidget.test.tsx`, `WatchlistMoversWidget.test.tsx`, `MarketDataAdapter.ts`, `mockDataCollection.ts`, `marketDataStore.ts`, `marketDataStore.test.ts` |
| Store �?| `poolBoard` (MarketDataSourceKey) | `researchPoolBoard` | `marketDataStore.ts`, `marketDataStore.test.ts` |
| Widget 映射 | `WIDGET_ID_TO_DATA_SOURCE_KEY['poolBoard']` | `['researchPoolBoard']` | `marketDataStore.ts` |
| UI 文本�?| `uiText.poolBoard` | `uiText.researchPoolBoard` | `uiText.input.ts`, `uiText.errors.ts` |
| 数据源配�?| `WIDGET_DEFAULT_DATA_SOURCE.poolBoard` | `.researchPoolBoard` | `cockpit.constants.ts` |
| 默认 Widget 配置 | `DEFAULT_WIDGET_CONFIG.poolBoard` | `.researchPoolBoard` | `cockpit.constants.ts` |
| Widget 布局 | `widgetId: 'poolBoard'` | `'researchPoolBoard'` | `widgetRegistry.ts` |
| Mock 生成�?| `generatePoolBoardPayload` | `generateResearchPoolBoardPayload` | `mockDataCollection.ts` |
| Mock 适配�?| `adaptPoolBoard` / `adaptPoolBoardItem` | `adaptResearchPoolBoard` / `adaptResearchPoolBoardItem` | `MarketDataAdapter.ts` |
| 默认数据 | `getDefaultPoolBoard` | `getDefaultResearchPoolBoard` | `MarketDataAdapter.ts` |

**⚠️ 特别注意**:
- `widgetId` 变更�?*影响已保存的用户布局**（LocalStorage 中存储的�?`poolBoard` widgetId 会找不到模板）。需评估是否需要迁移脚本或回退兼容�?- `dataType` 变更需确保所有采集器（`MockCollector.ts` 等）同步更新�?
**验证命令**:
```bash
npx tsc --noEmit
npm run test -- --run
# 手动验证：打开驾驶舱，确认 ResearchPoolBoard Widget 正常渲染
```

---

### 波次 5：文�?目录重命名（最高风险）

**风险等级**: ⭐⭐⭐⭐⭐（最高风险）
**影响文件**: ~20 个（含所�?import 路径更新�?**改动内容**: 物理移动/重命名文件，并更新所�?import 路径�?
| 原路�?| 新路�?|
|--------|--------|
| `src/components/organisms/pool/` | `src/store/researchPoolStore.ts` |
| `src/components/organisms/pool/PoolBoard.tsx` | `src/components/organisms/pool/PoolBoard.tsx` |
| `src/components/organisms/pool/PoolCard.tsx` | `src/components/organisms/pool/PoolCard.tsx` |
| `src/components/organisms/pool/PoolColumn.tsx` | `src/components/organisms/pool/PoolColumn.tsx` |
| `src/components/organisms/pool/PoolList.tsx` | `src/components/organisms/pool/PoolList.tsx` |
| `src/components/organisms/pool/usePoolDataFromStore.ts` | `src/hooks/usePoolBoard.ts` |
| `src/hooks/usePoolBoard.ts` | `src/hooks/usePoolBoard.ts` |
| `src/pages/analysis/PoolBoardPage.tsx` | `src/pages/analysis/PoolBoardPage.tsx` |
| `src/cockpit/widgets/PoolBoardWidget.tsx` | `src/cockpit/widgets/PoolBoardWidget.tsx` |
| `tests/PoolBoard.test.tsx` | `tests/ResearchPoolBoard.test.tsx` |

**需同步更新�?import 路径**:
- `src/components/organisms/index.ts`
- `src/pages/analysis/PoolBoardPage.tsx` �?`ResearchPoolBoardPage.tsx` 内部 import
- `src/apps/analysis/AnalysisApp.tsx`
- `src/cockpit/core/widgetRegistry.ts`
- `src/hooks/usePoolBoard.ts` �?`useResearchPoolBoard.ts` 内部 import
- `tests/PoolBoard.test.tsx` �?`ResearchPoolBoard.test.tsx` 内部 import
- `tests/services/MarketDataAdapter.test.ts`
- `tests/services/MockCollector.test.ts`

**⚠️ 特别注意**:
- 目录重命名后，`src/components/organisms/index.ts` 中的导出路径需同步更新�?- 如果使用 VSCode / WebStorm，建议用 IDE �?"Rename Symbol" + "Move File" 功能自动追踪引用�?- 重命名后需检�?`../../AGENTS.md` 中是否有对该目录的引用�?
**验证命令**:
```bash
npx tsc --noEmit
npm run test -- --run
npm run audit:layers
# 手动验证：打开 /analysis/research-pool 路由，确认页面正常渲�?```

---

### 波次 6：路由变�?
**风险等级**: ⭐⭐⭐⭐（高风险�?**影响文件**: ~4 �?**改动内容**: 修改路由路径，需同步更新所有导航引用�?
| 原路�?| 新路�?|
|--------|--------|
| `/analysis/pool-board` | `/analysis/research-pool` |

**需同步更新的位�?*:
- `src/apps/analysis/AnalysisApp.tsx:54` �?路由注册
- `src/config/routes.ts` �?如有独立路由表注�?- `src/portal/PortalShell.tsx` �?导航菜单链接
- `scripts/verify-all-routes.ts` �?路由验证脚本
- 任何硬编码的导航跳转（如 `navigate('/analysis/pool-board')`�?
**⚠️ 特别注意**:
- 路由变更属于**用户可见的破坏性变�?*。如果已有用户收藏了 `/analysis/pool-board`，需考虑添加重定向：
  ```tsx
  <Route path="/analysis/pool-board" element={<Navigate to="/analysis/research-pool" />} />
  ```
- 或保留旧路由作为别名，在 `AnalysisApp.tsx` �?`ANALYSIS_ROUTES` 中添加兼容条目�?
**验证命令**:
```bash
npx tsc --noEmit
npm run test -- --run
# 手动验证：访问旧路由应重定向到新路由
```

---

## 五、依赖关系图（波次间约束�?
```
波次 1（文本）────�?                 ├──�?可独立执行，无依�?波次 2（类型）────�?        �?波次 3（标识符）──�?                 ├──�?建议按顺序执行，但每波可独立回滚
波次 4（数据契约）�?        �?波次 5（文件重命名�?        �?波次 6（路由变更）
```

**推荐执行顺序**: 波次 1 �?2 �?3 �?4 �?5 �?6
**最小可行方�?*: 仅执行波�?1（文本清理），已能消除绝大多数用户可见的"股票�?字样�?**完整方案**: 执行全部 6 个波次，彻底消除内部泛化标识符�?
---

## 六、回滚策�?
每波重构执行前，建议按以下步骤操作：

1. **创建 feature 分支**:
   ```bash
   git checkout -b refactor/research-pool-rename
   ```

2. **单波次原子提�?*:
   每波完成后独�?commit，commit message 标注波次编号�?
3. **验证清单**（每波必做）:
   ```bash
   npx tsc --noEmit           # 类型检�?   npm run test -- --run      # 单元测试
   npm run audit:layers       # 架构审计（波�?5 后必做）
   npm run lint               # ESLint
   ```

4. **回滚方式**:
   若某波出现问题，直接 `git revert <commit>` 即可，不影响其他波次�?
---

## 七、快速参考：grep 验证命令

重构完成后，可用以下命令验证"股票�?泛化字样是否已清理干净�?
```bash
# 1. 检查是否还有泛化的 PoolBoard 标识符（应仅�?PoolCard/PoolColumn/PoolList 如果还没重命名）
grep -rn "PoolBoard\|poolBoard" src/ tests/ --include="*.ts" --include="*.tsx" | grep -v "ResearchPoolBoard\|researchPoolBoard"

# 2. 检查是否还�?股票�?中文字样（应仅剩通用基础设施中的合理引用�?grep -rn "股票�? src/ tests/ --include="*.ts" --include="*.tsx" --include="*.md"

# 3. 检查是否还有旧路由残留
grep -rn "pool-board" src/ tests/ --include="*.ts" --include="*.tsx"

# 4. 检�?cockpit.constants 中是否还�?poolBoard �?grep -rn "poolBoard:" src/constants/cockpit.constants.ts

# 期望：以上命令输出为空（或仅剩通用基础设施�?poolService/poolServer 中的合理引用�?```

---

## 八、决策建�?
| 场景 | 建议 |
|------|------|
| **时间紧迫** | 仅执�?**波次 1**（文本清理），约 30 分钟，消除用户可见的所�?股票�?字样 |
| **标准重构** | 执行 **波次 1-3**（文�?+ 类型 + 标识符），约 2 小时，内部代码语义精确化 |
| **彻底根治** | 执行 **全部 6 个波�?*，约 4-6 小时，完全消除泛化旧名，包含文件重命名和路由变更 |
| **避免用户布局丢失** | 波次 4 中保�?`widgetId` 兼容层，或波�?6 中添加路由重定向 |
