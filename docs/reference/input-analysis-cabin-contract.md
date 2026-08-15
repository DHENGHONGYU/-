---
title: input-analysis-cabin-contract.md — 输入舱 → 分析舱 数据调用接口契约
type: reference
domain: backend
phase: design
tier: standard
status: active
maintainer: V9 Architecture Team
summary: "定义「分析舱」调用「输入舱」意向候选池数据的只读接口契约：AnalysisCandidate/AnalysisCandidateQuery 契约类型、intentionPoolService 防腐层、analysisStore 消费路径、URL 参数交接与批量评分。"
tags: [backend, input-cabin, analysis-cabin, contract, interface]
version: v1.0.0
last_updated: 2026-08-14
code_version: "2.0.0-rc.1"
doc_id: V9-DOC-BACK-047
referenced_by: [V9-DOC-PROJ-046, V9-DOC-PROJ-053]
change_log:
  - version: v1.0.0
    changes: 初稿：输入舱 → 分析舱 数据调用接口方案（契约类型 + 防腐层服务 + Store 消费 + URL 交接 + 批量评分）
    date: 2026-08-14
---

# input-analysis-cabin-contract.md — 输入舱 → 分析舱 数据调用接口契约

> **定位**：定义「分析舱」消费「输入舱」意向候选池数据的接口契约、数据流、防腐层与交接机制。
> **关联**：`./stockpool-contract.md`（已归档）（股票池存储）、`./scoring-contract.md`（V6 评分）、`./v9-input-cabin-strategy-report.md`（已归档）（输入舱策略）。

---

## 1. 背景与目标

输入舱负责双源录入（来源一：热门板块核心标的；来源二：自定义检索）形成**意向候选池**，
物理数据存于 IndexedDB `stocks` store（`pool === 'intention'`）。

分析舱（个股智能分析、V6 九维评分等）需要**只读消费**该候选池进行后续分析评分。

### 1.1 设计目标

- **解耦**：分析舱不直接读写 `dataLayer`/`stocks` store，经防腐层服务只读消费。
- **契约化**：显式定义 `AnalysisCandidate` 契约类型，跨舱类型安全。
- **来源溯源**：候选条目保留 `screenSource`（hot-sector/manual）与分组信息。
- **评分联动**：join 已有 V6 评分，支持对未评分候选批量评分。
- **热路径隔离**：不重构 `intentionPoolStore.refresh()`，避免影响输入舱 UI 热路径。

### 1.2 分层定位

| 维度 | 说明 |
|------|------|
| 契约类型 | `src/types/modules/analysis.types.ts` |
| 防腐层服务 | `src/services/input/intentionPoolService.ts` |
| 消费方 | `src/store/analysisStore.ts` → `src/apps/analysis/AnalysisApp.tsx` |
| 交接方式 | URL 参数 `?scope=intention` |
| 依赖方向 | 服务层 → `core/databridge`（信封协议），不直写 IndexedDB |

---

## 2. 接口契约类型

文件：`src/types/modules/analysis.types.ts`

```typescript
import type { ScreenSource, StockDataQuality } from '@/data/types/types.stock'

/** 分析作用域 */
export type AnalysisScope = 'intention' | 'all'

/** 分析候选标的 —— 分析舱消费输入舱数据的契约 */
export interface AnalysisCandidate {
  symbol: string
  name: string
  /** 录入来源：hot-sector=来源一（热门板块核心标的）/ manual=来源二（自定义检索） */
  screenSource?: ScreenSource
  /** 意向池分组 */
  group?: string
  /** 采集完成度 */
  dataQuality?: StockDataQuality
  /** 最新价（采集后填充） */
  price?: number
  /** 市盈率 */
  pe?: number
  /** 市净率 */
  pb?: number
  /** 已存在 V6 综合评分（join v6Scores，可选展示） */
  v6Score?: number
  /** 入库时间戳（用于倒序排序） */
  ingestedAt?: number
}

/** 拉取参数 */
export interface AnalysisCandidateQuery {
  scope: AnalysisScope
  /** 仅来源一（hot-sector）/ 来源二（manual） */
  screenSource?: ScreenSource
  /** 分组过滤 */
  group?: string
}
```

字段设计要点：

- `screenSource`：来源溯源，UI 渲染「热门板块 / 自定义检索」标签。
- `v6Score`：join `v6Scores` store，缺失不阻塞（降级为未评分）。
- `ingestedAt`：供倒序排序（最新入库在前），对齐 `intentionPoolStore.refresh()` 排序语义。

---

## 3. 数据流

```
输入舱（双源录入 / 热门板块）
    ↓ 写入（DataBridge.forward → stocks store，pool='intention'）
IndexedDB stocks store（by-pool 索引）
    ↓ 读取（防腐层只读）
intentionPoolService.listIntentionCandidates(query)
    ├─ queryByIndex(by-pool=intention)  → 过滤 pool/screenSource/group
    ├─ queryList(v6Scores)              → join 已有评分（Map 去重保留首条）
    └─ 映射 AnalysisCandidate[]         → ingestedAt 倒序
        ↓
analysisStore.loadStocks('intention', filter)
    ↓
V6ScoreCard（作用域=意向候选池，来源标签 + 已有评分 + 批量评分）
```

---

## 4. 防腐层服务

文件：`src/services/input/intentionPoolService.ts`

```typescript
export async function listIntentionCandidates(
  query: AnalysisCandidateQuery = { scope: 'intention' },
): Promise<DataLayerResult<AnalysisCandidate[]>>
```

| 步骤 | 说明 |
|------|------|
| 1. 读取 | `dataBridge.query` 按 `by-pool` 索引读 `stocks`，兜底过滤 `pool === 'intention'` |
| 2. 过滤 | `screenSource` / `group` 可选过滤 |
| 3. join | 读取 `v6Scores` 构建 symbol→score 索引（`loadV6ScoreMap`，去重保留首条） |
| 4. 映射 | `toAnalysisCandidate` 映射为契约类型，按 `ingestedAt` 倒序 |

降级策略：

- `v6Scores` 读取失败仅 `logger.warn`，候选列表不阻塞（降级无评分）。
- `stocks` 查询失败返回 `{ success: false, error }`，由消费方提示。

ACL：数据源使用 `MODULE_ID.pool`（pool 模块对 `stocks`/`v6Scores` 有 read 权限）。

---

## 5. 消费方集成

### 5.1 analysisStore

文件：`src/store/analysisStore.ts`

- 新增 `candidates: AnalysisCandidate[]` 与 `scope: AnalysisScope` 状态。
- `loadStocks(scope, filter)`：`scope='intention'` 时走 `listIntentionCandidates`，否则走原 `listStocks`（向后兼容）。
- `runBatchScore(symbols)`：调用 `runV6ScoreBatch`（Worker 并行），完成后自动 `loadScores()` 刷新评分标签。

### 5.2 V6ScoreCard（AnalysisApp 默认视图）

文件：`src/apps/analysis/AnalysisApp.tsx`

- 顶部工具条：「加载全部标的」「加载意向候选池」作用域切换 + 「批量评分（N）」按钮（仅作用域=intention 且有未评分候选时显示）。
- 候选卡片：symbol、名称、来源标签（热门板块/自定义检索）、分组、V6 评分 Badge、单条「运行评分」。
- 空态：作用域=intention 且无候选时提示去输入舱录入。

### 5.3 输入舱入口

- `InputDashboardPoolTable` 新增「送入分析舱」按钮 → `/analysis?scope=intention`。
- `InputFlowOverview`「分析舱调用」步骤路径改为 `/analysis?scope=intention`。

---

## 6. URL 参数交接

| 参数 | 取值 | 说明 |
|------|------|------|
| `scope` | `intention` | 进入分析舱时自动加载意向候选池 |
| `source` | `hot-sector` / `manual` / `all`（预留） | 来源过滤（日志记录） |

AnalysisApp 读取逻辑：

```tsx
const handoffScope: AnalysisScope =
  searchParams.get('scope') === 'intention' ? 'intention' : 'all'

useEffect(() => {
  if (handoffScope === 'intention') {
    void loadStocksAction('intention')
  }
}, [handoffScope, loadStocksAction, searchParams])
```

无 `scope` 参数时回退 `all` 作用域，保持原行为。

---

## 7. 批量评分

- 入口：V6ScoreCard「批量评分」按钮（取 `candidates` 中未评分集合）。
- 实现：`analysisStore.runBatchScore` → `runV6ScoreBatch`（`v6ScoreTaskScheduler` Worker 并行）→ 落库 `v6Scores` → `loadScores()` 刷新。
- 空列表防护：`runBatchScore([])` 直接跳过。

---

## 8. 测试策略

| 测试类型 | 文件 | 说明 |
|----------|------|------|
| 服务单元测试 | `src/services/input/intentionPoolService.test.ts` | 读取/过滤/join/降级/异常 8 例 |
| Store 单元测试 | `src/store/analysisStore.test.ts` | intention 加载、批量评分、作用域、边界 41 例 |
| 组件交互（输入舱） | `src/apps/input/InputDashboard.addStock.test.tsx` | 录入流回归 |
| 类型检查 | `tsc --noEmit` | 契约类型跨舱编译 |

---

## 9. 变更日志

| 日期 | 版本 | 变更 | 作者 |
|------|------|------|------|
| 2026-08-14 | v1.0.0 | 初稿：接口方案落盘 | V9 Architecture Team |
