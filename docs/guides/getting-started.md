---
doc_id: V9-DOC-GUIDE-041
title: "V9 智能投研复盘系统 — 新成员 30 分钟上手指南"
domain: project
status: active
last_updated: 2026-08-17
---
covers_code:
  - src/data/types.ts


---
doc_id: V9-DOC-GUIDE-026
title: getting-started
last_updated: 2026-08-13
change_log:
  - version: v1.0.0
    changes: "文档新鲜度刷新：twBg/twText/twBorder 已废弃，确认令牌引用一致性"
    date: 2026-08-13
---

# V9 智能投研复盘系统 — 新成员 30 分钟上手指南

> **版本**：v1.0.0  
> **日期**：2026-07-12  
> **目标读者**：新加入的开发者、AI Agent（ onboarding 第一站）  
> **阅读时长**：30 分钟（含 5 分钟实操）

---

## 快速定位（1 分钟）

本系统采用 **五舱 + 驾驶舱** 架构：

| 舱室 | 路径 | 功能 | 代表页面 |
|------|------|------|----------|
| **输入舱** | `/input/*` | 数据采集、七维配置、本地知识 | `CollectTaskPage`、`SevenDimConfigPage` |
| **分析舱** | `/analysis/*` | 评分、筛选、回测、板块 | `StockAnalysisPage`、`BacktestPage` |
| **交易舱** | `/trading/*` | 持仓、组合、风控、策略快照 | `HoldingsPage`、`PortfolioPage` |
| **输出舱** | `/output/*` | 研报、复盘、Dashboard | `ResearchReportPage`、`TradeReviewPage` |
| **指令舱** | `/command/*` | MCP Server、系统管理 | `MCPServerDashboardPage` |
| **驾驶舱** | `/cockpit` | 全局 Dashboard | `CockpitShell` |

---

## 第一步：理解项目分层（5 分钟）

```
src/config/       ← 配置层（零硬编码锚点）
src/core/         ← 核心工具（DataBridge/ACL/Envelope/MemoryCache/EventBus）
src/data/         ← 数据层（IndexedDB/dataLayer/queryBuilder）
src/lib/          ← 库函数（logger/format/errors/utils）
src/services/     ← 服务层（23 个子域，通过 DataBridge 写数据）
src/store/        ← 状态层（Zustand + withBroadcast 跨 Tab 广播）
src/pages/        ← 页面层（5 舱 + 驾驶舱）
src/components/   ← 组件层（atoms/molecules/organisms/widgets）
src/portal/       ← PortalShell 舱室入口
src/constants/    ← 常量层（零硬编码锚点）
src/types/        ← 类型层（零依赖）
```

### 核心依赖规则（禁止跨层）

- `pages/` → 只能依赖 `store/` 和 `services/`
- `store/` → 只能依赖 `services/` 和 `core/`
- `services/` → 只能依赖 `core/`、`data/` 和 `lib/`（白名单：logger、withBroadcast、eventBus、format、errors、utils）
- `lib/` → 只能依赖 `core/` 和 `config/`

> 验证命令：`npm run audit:layers`（期望 0 violations）

---

## 第二步：四步集成编码契约（10 分钟）

新增任何模块（Store / Service / Page / Widget）**严禁**直接在 `/views` 或 `/pages` 下孤立新建文件，必须按以下四步顺序集成：

### 步骤 1：类型定义

在 `src/types/modules/` 或 `src/data/types.ts` 中定义 Interface。

```typescript
// 示例：新增 Widget 类型
export interface WidgetConfig {
  id: string
  widgetId: string
  position: { x: number; y: number }
  size: { cols: number; rows: number }
  settings?: Record<string, unknown>
}
```

### 步骤 2：Store/状态

在 `src/store/` 中创建 Zustand Store，通过 `withBroadcast` 实现跨 Tab 广播。

```typescript
import { create } from 'zustand'
import { EVENT_NAMES } from '@/constants/store-channels.constants'
import { withBroadcast } from '@/lib/withBroadcast'

interface MyStoreState {
  data: string[]
  loading: boolean
  loadData: () => Promise<void>
}

export const useMyStore = create<MyStoreState>((set, get) => ({
  data: [],
  loading: false,
  loadData: async () => {
    set({ loading: true })
    // ... 调用 Service
    set({ data: result, loading: false })
    withBroadcast(EVENT_NAMES.STOCKS_CHANGED, { action: 'load' })
  },
}))
```

### 步骤 3：Builder/适配层

在 `src/services/` 中创建 Service，通过 DataBridge 写入数据。

```typescript
import { dataBridge } from '@/core/databridge'
import { EnvelopeFactory } from '@/core/envelope'
import { MODULE_ID, ENVELOPE_TARGET, ENVELOPE_ACTION } from '@/config/dbConfig'

export async function saveMyData(data: MyData) {
  const envelope = EnvelopeFactory.create(
    {
      source: MODULE_ID.myModule,
      target: ENVELOPE_TARGET.db,
      action: ENVELOPE_ACTION.insertMyData,
      traceId: `my-${nanoid(8)}`,
    },
    data,
  )
  return dataBridge.forward(envelope)
}
```

### 步骤 4：核心集成

在 `src/pages/` 或 `src/components/` 中创建 UI，**仅通过 Store 获取数据**。

```typescript
import { useMyStore } from '@/store/myStore'

export function MyPage() {
  const { data, loading, loadData } = useMyStore()
  // UI 渲染...
}
```

> **每步可独立回滚**，完成后运行 `npx tsc --noEmit` 验证类型安全。

---

## 第三步：开发规范速查（10 分钟）

### 类型安全

- ❌ 禁止 `any`（ESLint `@typescript-eslint/no-explicit-any: error`）
- ❌ 禁止 `@ts-ignore`（使用 `@ts-expect-error` 并附带注释）
- ✅ 所有数据结构先定义 TypeScript Interface

### 颜色令牌（红涨绿跌）

```typescript
// ✅ 正确：使用 STOCK_COLOR_TOKENS（自动豁免主题切换）
import { getStockColorClass } from '@/constants/theme.tokens'
<span className={getStockColorClass(stock.changePercent)}>
  {stock.changePercent.toFixed(2)}%
</span>

// ❌ 禁止：硬编码颜色
<span className="text-red-500">+3.2%</span>
```

### 日志规范

```typescript
import { getLogger } from '@/lib/logger'
const logger = getLogger()

logger.info('[MyStore] loadData() completed', { count: data.length })
logger.error('[MyStore] loadData() failed', { error: message })
```

### useEffect 清理模板

```typescript
// ✅ EventBus 订阅清理
useEffect(() => {
  const handler = (data: unknown) => { /* ... */ }
  EventBus.subscribe('eventName', handler)
  return () => EventBus.unsubscribe('eventName', handler)
}, [])

// ✅ 定时器清理
useEffect(() => {
  const timerId = setInterval(() => { /* ... */ }, 1000)
  return () => clearInterval(timerId)
}, [])
```

---

## 第四步：常用命令（5 分钟）

```bash
# 类型检查
npx tsc --noEmit

# 架构审计
npm run audit:layers      # 跨层调用
npm run audit:hardcode    # 颜色硬编码
npm run audit:deadcode    # 死代码
npm run audit:docs        # 文档同步
npm run audit:token       # Token 消耗

# 单元测试
npm test -- --run

# 生产构建
npm run build
```

---

## 第五步：文档地图（按需深入）

| 我想了解... | 阅读文档 | 路径 |
|-------------|----------|------|
| 全局架构 | architecture/overview.md | `../archive/historical-2026-08-16/batch7/docs/explanation/architecture/overview.md（已归档）` |
| 舱室详情 | cabins-overview.md | `../archive/historical-2026-08-16/batch7/docs/explanation/cabins-overview.md（已归档）` |
| 服务子域 | services-catalog.md | `../reference/services-catalog.md` |
| 数据定义 | DATA_DICTIONARY_INDEX.md | `docs/guides/standards/DATA_DICTIONARY_INDEX.md` |
| 编码规范 | AGENTS.md | `AGENTS.md` |
| 颜色令牌 | design-token-mapping.md | `../reference/design-token-mapping.md` |
| 如何新增 Store | how-to-add-store.md | `docs/guides/how-to-add-store.md` |
| 如何新增 Service | how-to-add-service.md | `docs/guides/how-to-add-service.md` |
| 如何新增 Widget | how-to-add-widget.md | `docs/guides/how-to-add-widget.md` |

---

## 常见问题（FAQ）

**Q1：Store 数据如何在多个 Tab 间同步？**  
A：使用 `withBroadcast()` 广播变更事件。其他 Tab 的 Store 订阅相同事件名即可自动刷新。

**Q2：Service 能直接调用 dataLayer 吗？**  
A：不能。必须通过 `DataBridge.forward()` 发送 Envelope，由 ACL 校验后路由到 DB。

**Q3：新增页面需要注册路由吗？**  
A：必须。在 `src/config/routes.ts` 的 `ROUTE_REGISTRY` 中注册，并同步更新 `../archive/historical-2026-08-16/batch7/docs/explanation/06-routing-specs.md（已归档）`。

**Q4：如何调试 IndexedDB 数据？**  
A：浏览器 DevTools → Application → IndexedDB → `v9-database` → 查看各 store。

---

> **下一步**：根据你的任务选择对应的 How-to 指南 → `how-to-add-store.md` / `how-to-add-service.md` / `how-to-add-widget.md`
