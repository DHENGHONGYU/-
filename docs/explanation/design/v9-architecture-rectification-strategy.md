---
title: v9-architecture-rectification-strategy
tier: reference
code_version: 2.0.0
---

---
title: V9 架构整改总体策略与执行计划
version: v1.0.0
last_updated: 2026-06-27
maintainer: Architecture Fix Team
status: active
tier: reference
---

# V9 架构整改总体策略与执行计划

> **关联文档**：
> - `../v9-架构缺陷与整改行动清单.md`（缺陷来源与行动明细）
> - `../../reference/completeness-profile.md`（模块完成度剖面）
> - `../v9-issue-management.md`（调度记录）
>
> **核心目标**：以「L2 状态层统一化」为抓手，按「先收口已创建 Store，再补齐缺失 Store，最后清理集成层残留」的顺序，将 V9 从「组件内分散状态」升级为「Store 集中状态、组件无状态渲染、服务层保持无状态」的五层架构。

---

## 一、总体整改策略

### 1.1 指导思想

```
┌─────────────────────────────────────────────────────────────┐
│  整改原则（按优先级）                                         │
├─────────────────────────────────────────────────────────────┤
│  1. 先存量后增量：先把已创建但未接入的 Store 真正用起来         │
│  2. 先 Hub 后子页：先统一舱室入口状态，再下沉各子页面状态       │
│  3. 先纯状态后 DataBridge：状态层先跑通，再补事件转发           │
│  4. 先验证后推进：每批次改完即跑质量门禁，不累积风险             │
│  5. 最小侵入：保持服务层 API、路由路径、数据模型不变             │
└─────────────────────────────────────────────────────────────┘
```

### 1.2 分层整改策略

| 层 | 当前问题 | 整改方向 | 关键产出 |
|:---|:---|:---|:---|
| L5 展示层 | 组件内 useState 过多 | 组件只负责渲染，状态来自 props 或 Store | 无状态组件 |
| L4 应用层 | App 入口直接管理状态 | App 只做路由/布局分发 | 薄 App 组件 |
| L3 服务层 | 部分结果未转发 DataBridge | 关键写操作/事件统一走信封 | 可追溯事件 |
| L2 状态层 | Store 缺失或与组件脱节 | 补齐 Zustand Store，接入组件 | 统一状态层 |
| L1 基础设施 | 无 | 保持 | — |

### 1.3 风险防控

| 风险 | 可能性 | 影响 | 缓解措施 |
|:---|:---|:---|:---|
| Store 接入导致组件重渲染 | 中 | 中 | 使用 Zustand 选择器按需订阅 |
| 状态初始化时机导致空值 | 中 | 中 | 保留 `loading`/`error` 状态，UI 做兜底 |
| 测试用例因状态结构变化失败 | 高 | 中 | 同步更新 mock，每批次跑 `npm test -- --run` |
| 一次性改动过大 | 高 | 高 | 按批次执行，每批次独立回滚 |

---

## 二、Store 设计规范

### 2.1 命名规范

| 对象 | 规范 | 示例 |
|:---|:---|:---|
| Store hook | `use{Xxx}Store` | `useInputHubStore` |
| Store 文件 | `src/store/{xxx}Store.ts` | `src/store/inputHubStore.ts` |
| 状态接口 | `{Xxx}State` | `InputHubState` |
| Actions 接口 | `{Xxx}Actions` | `InputHubActions` |
| 选择器 | `select{Xxx}` | `selectInputHubCards` |

### 2.2 代码模板

```typescript
// src/store/exampleStore.ts
import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import { getLogger } from '@/lib/logger'

const logger = getLogger()

interface ExampleState {
  data: unknown[]
  loading: boolean
  error: string | null
}

interface ExampleActions {
  setData: (data: unknown[]) => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
  loadData: () => Promise<void>
}

const initialState: ExampleState = {
  data: [],
  loading: false,
  error: null,
}

export const useExampleStore = create<ExampleState & ExampleActions>()(
  devtools(
    (set) => ({
      ...initialState,
      setData: (data) => set({ data }, false, 'setData'),
      setLoading: (loading) => set({ loading }, false, 'setLoading'),
      setError: (error) => set({ error }, false, 'setError'),
      loadData: async () => {
        set({ loading: true, error: null }, false, 'loadData/start')
        try {
          // call service
          set({ loading: false, data: [] }, false, 'loadData/success')
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err)
          logger.error('[exampleStore] loadData failed', { error: message })
          set({ loading: false, error: message }, false, 'loadData/error')
        }
      },
    }),
    { name: 'example-store' }
  )
)

export const selectExampleData = (state: ExampleState & ExampleActions) => state.data
export const selectExampleLoading = (state: ExampleState & ExampleActions) => state.loading
```

### 2.3 接入规范

```typescript
// 组件内只订阅需要的状态，避免整体重渲染
const data = useExampleStore(selectExampleData)
const loading = useExampleStore(selectExampleLoading)
const loadData = useExampleStore((state) => state.loadData)
```

---

## 三、执行计划

### 3.1 批次划分

```
批次0：收口已创建 Store（E 批次收尾）
  ├─ CommandApp 接入 commandStore
  ├─ OutputApp 接入 outputStore
  └─ 验证质量门禁

批次1：输入舱状态层统一（B 批次）
  ├─ InputDashboardStore（高优先级）
  ├─ InputHubStore
  ├─ BulkImportStore
  ├─ HotSectorStore
  ├─ LocalKnowledgeStore
  ├─ DataTestStore
  └─ 移除 /input/prototype 残留链接

批次2：分析舱状态层统一（C 批次）
  ├─ AnalysisHubStore
  ├─ IndustryScoreStore
  ├─ IntelligentScoreStore
  ├─ StockAnalysisStore
  ├─ SectorAnalysisStore
  ├─ ScoreDocStore
  └─ 策略回测占位评估（本期决定是否保留或移除）

批次3：交易舱状态层统一（D 批次）
  ├─ TradingHubStore
  ├─ TradingSignalsStore
  ├─ StrategySnapshotStore
  └─ 修正 Hub 导航路径

批次4：集成层清理与回归收口
  ├─ 清理 CommandHubPage / TradingHubPage 不明确链接
  ├─ 全量质量门禁回归
  └─ 更新完成度剖面图与审计报告
```

### 3.2 本阶段（批次0+批次1先导）具体任务

| 序号 | 任务 | 文件 | 预计改动 |
|:---|:---|:---|:---|
| 1 | 重写 CommandApp 接入 commandStore | `src/apps/command/CommandApp.tsx` | 重写状态逻辑 |
| 2 | 重写 OutputApp 接入 outputStore | `src/apps/output/OutputApp.tsx` | 重写状态逻辑 |
| 3 | 移除 InputDashboard 中 `/input/prototype` 链接 | `src/apps/input/InputDashboard.tsx` | -3 行 |
| 4 | 创建 inputDashboardStore | `src/store/inputDashboardStore.ts` + 修改 `InputDashboard.tsx` | +250/-150 行 |
| 5 | 创建 inputHubStore | `src/store/inputHubStore.ts` + 修改 `InputHubPage.tsx` | +150/-80 行 |
| 6 | 运行质量门禁 | — | 验证全通过 |

---

## 四、验收标准

| 检查项 | 通过标准 |
|:---|:---|
| 编译 | `tsc --noEmit` 0 错误 |
| Lint | `npm run lint` 0 警告/错误 |
| 单元测试 | `npm test -- --run` 不下降（291/291） |
| E2E | `npm run test:e2e` 5/5 passed |
| 构建 | `npm run build` success |
| 层级审计 | `npm run audit:layers` 0 违规 |

---

## 五、变更日志

| 日期 | 版本 | 变更内容 | 变更人 |
|:---|:---|:---|:---|
| 2026-06-27 | v1.0.0 | 制定 V9 架构整改总体策略与执行计划 | Architecture Fix Team |
