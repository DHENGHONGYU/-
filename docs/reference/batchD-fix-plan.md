---
title: batchd-fix-plan
type: reference
domain: project
phase: planning
tier: important
status: draft
maintainer: Quality Auditor
summary: "Batch D 修复计划：区分交易信号与模拟持仓两个混淆入口�?
tags: [project, fix, batch, plan, governance, documentation, strategy, reference]
version: v1.0.0
last_updated: 2026-06-27
code_version: 2.0.0
doc_id: V9-DOC-PROJ-081
referenced_by: [V9-DOC-PROJ-174, V9-DOC-META-000, V9-DOC-PROJ-176, V9-DOC-PROJ-182, V9-DOC-PROJ-149]
change_log:
  - version: v1.0.0
changes: Initial version established
date: 2026-06-27
---

# V9 批次 D（交易舱）P2 问题修复方案

> **审计范围**：交易舱 4 模块（D1-D4�? 
> **问题总数**�? �?P2 级问�? 
> **修复优先�?*：按影响范围和修复成本排�?
---

## 一、问题汇�?
| 编号 | 模块 | 问题描述 | 当前状�?| 影响范围 |
|:---|:---|:---|:---|:---|
| D1-P2-001 | 交易�?Hub | "交易信号"�?模拟持仓"链接均指�?`/trading`，导航路径不明确 | useState | 导航体验 |
| D1-P2-002 | 交易�?Hub | 无独�?Zustand Store | useState | 跨组件共�?|
| D2-P2-003 | 交易信号 | 使用 9 �?useState，状态管理分�?| useState | 可维护�?|
| D3-P2-004 | 策略快照 | 使用 10 �?useState，状态管理分�?| useState | 可维护�?|

---

## 二、修复优先级排序

| 优先�?| 问题 | 修复成本 | 收益 | 说明 |
|:---|:---|:---|:---|:---|
| **紧�?* | D1-P2-001 | 低（5 分钟�?| �?| 修复导航路径，提升用户体�?|
| **�?* | D2-P2-003 | 中（2 小时�?| �?| 交易信号是核心模块，需要跨组件共享状�?|
| **�?* | D3-P2-004 | 中（2 小时�?| �?| 策略快照状态复杂，需要统一管理 |
| **�?* | D1-P2-002 | 低（30 分钟�?| �?| Hub 为纯展示页面，无状态共享需�?|

---

## 三、详细修复方�?
### 3.1 D1-P2-001：修复导航路径不明确

**问题描述**：`TradingHubPage.tsx` �?交易信号"�?模拟持仓"链接均指�?`/trading`，用户无法区分两个功能入口�?
**修复方案**�?- 修改 `TRADING_MODULES` 数组中的 path 字段
- "交易信号" �?`/trading/signals`（需要新增路由）或保�?`/trading`（主入口�?- "模拟持仓" �?`/trading/holdings`（已有路由）

**修改文件**：`src/apps/trading/TradingApp.tsx`

```typescript
const TRADING_MODULES: HubModule[] = [
  {
    title: '交易信号',
    description: '观察池、信号扫描、买卖下�?,
    path: '/trading',
    icon: Activity,
  },
  {
    title: '模拟持仓',
    description: '持仓列表、订单管�?,
    path: '/trading/holdings',  // 修复：改为交易持仓路�?    icon: Wallet,
  },
  {
    title: '策略快照',
    description: '核心�?热点短线/价值洼地分类与历史快照',
    path: '/trading/strategy-snapshots',
    icon: Target,
  },
]
```

**修复成本**�? 分钟  
**验证方式**：点�?Hub 中的"模拟持仓"卡片，应跳转�?`/trading/holdings` 页面

---

### 3.2 D1-P2-002：交易舱 Hub 创建 Zustand Store（可选）

**问题描述**：`TradingHubPage.tsx` 使用 useState 管理渲染状态，无独�?Zustand Store�?
**评估**：Hub 页面为纯展示页面，无跨组件状态共享需求，且状态量极少。创建独�?Store 收益有限�?
**建议**：保�?useState，不做修复。如未来需要状态共享，再创�?`tradingHubStore.ts`�?
**修复成本**�?（不修复�? 
**优先�?*：低

---

### 3.3 D2-P2-003：交易信号创�?Zustand Store

**问题描述**：`TradingApp.tsx` 使用 9 �?useState，状态管理分散，不利于跨组件共享和维护�?
**当前状态变�?*�?```typescript
const [stocks, setStocks] = useState<Stock[]>([])           // 观察池股�?const [orders, setOrders] = useState<Order[]>([])           // 订单列表
const [signals, setSignals] = useState<TradingSignal[]>([]) // 交易信号
const [adviceMap, setAdviceMap] = useState<Record<string, TradeAdvice>>({}) // 交易建议
const [portfolio, setPortfolio] = useState<Portfolio | undefined>() // 核心组合
const [strategyResult, setStrategyResult] = useState<StrategyResult | undefined>() // 策略结果
const [portfolioLoading, setPortfolioLoading] = useState(false) // 组合加载状�?const [processingSymbols, setProcessingSymbols] = useState<Set<string>>(new Set()) // 处理中的标的
const [message, setMessage] = useState('')                 // 消息提示
```

**修复方案**：创�?`tradingStore.ts` Zustand Store

**新建文件**：`src/store/tradingStore.ts`

```typescript
import { create } from 'zustand'
import type { Stock, Order, TradingSignal, Portfolio, StrategyResult } from '@/data/types'
import type { TradeAdvice } from '@/services/trading/tradingService'

interface TradingState {
  stocks: Stock[]
  orders: Order[]
  signals: TradingSignal[]
  adviceMap: Record<string, TradeAdvice>
  portfolio: Portfolio | undefined
  strategyResult: StrategyResult | undefined
  portfolioLoading: boolean
  processingSymbols: Set<string>
  message: string

  setStocks: (stocks: Stock[]) => void
  setOrders: (orders: Order[]) => void
  setSignals: (signals: TradingSignal[]) => void
  setAdviceMap: (map: Record<string, TradeAdvice>) => void
  setPortfolio: (portfolio: Portfolio | undefined) => void
  setStrategyResult: (result: StrategyResult | undefined) => void
  setPortfolioLoading: (loading: boolean) => void
  addProcessingSymbol: (symbol: string) => void
  removeProcessingSymbol: (symbol: string) => void
  setMessage: (message: string) => void
  clearMessage: () => void
}

export const useTradingStore = create<TradingState>((set) => ({
  stocks: [],
  orders: [],
  signals: [],
  adviceMap: {},
  portfolio: undefined,
  strategyResult: undefined,
  portfolioLoading: false,
  processingSymbols: new Set(),
  message: '',

  setStocks: (stocks) => set({ stocks }),
  setOrders: (orders) => set({ orders }),
  setSignals: (signals) => set({ signals }),
  setAdviceMap: (map) => set({ adviceMap: map }),
  setPortfolio: (portfolio) => set({ portfolio }),
  setStrategyResult: (result) => set({ strategyResult: result }),
  setPortfolioLoading: (loading) => set({ portfolioLoading: loading }),
  addProcessingSymbol: (symbol) =>
    set((state) => ({
      processingSymbols: new Set(state.processingSymbols).add(symbol),
    })),
  removeProcessingSymbol: (symbol) =>
    set((state) => {
      const next = new Set(state.processingSymbols)
      next.delete(symbol)
      return { processingSymbols: next }
    }),
  setMessage: (message) => set({ message }),
  clearMessage: () => set({ message: '' }),
}))
```

**修改文件**：`src/apps/trading/TradingApp.tsx`
- 删除所�?useState 声明
- 使用 `useTradingStore` 替代

**修复成本**�? 小时  
**验证方式**：交易信号页面功能正常，状态变更能正确反映�?UI

---

### 3.4 D3-P2-004：策略快照创�?Zustand Store

**问题描述**：`StrategySnapshotPage.tsx` 使用 10 �?useState，状态管理分散，不利于跨组件共享和维护�?
**当前状态变�?*�?```typescript
const [activeTab, setActiveTab] = useState('current')              // 当前标签�?const [stocks, setStocks] = useState<Stock[]>([])                 // 股票列表
const [v6Scores, setV6Scores] = useState<V6Score[]>([])           // V6 评分
const [rotationScores, setRotationScores] = useState<RotationSectorScore[]>([]) // 轮动评分
const [items, setItems] = useState<StrategyGroupItem[]>([])       // 分类后的股票
const [snapshots, setSnapshots] = useState<StrategySnapshot[]>([]) // 历史快照
const [selectedSnapshot, setSelectedSnapshot] = useState<StrategySnapshot | null>(null) // 当前选中快照
const [loading, setLoading] = useState(false)                     // 加载状�?const [saving, setSaving] = useState(false)                       // 保存状�?const [error, setError] = useState<string | null>(null)           // 错误信息
```

**修复方案**：创�?`strategySnapshotStore.ts` Zustand Store

**新建文件**：`src/store/strategySnapshotStore.ts`

```typescript
import { create } from 'zustand'
import type { Stock, V6Score, RotationSectorScore, StrategySnapshot } from '@/data/types'
import type { StrategyGroupItem } from '@/services/trading/strategySnapshotService'

interface StrategySnapshotState {
  activeTab: 'current' | 'history'
  stocks: Stock[]
  v6Scores: V6Score[]
  rotationScores: RotationSectorScore[]
  items: StrategyGroupItem[]
  snapshots: StrategySnapshot[]
  selectedSnapshot: StrategySnapshot | null
  loading: boolean
  saving: boolean
  error: string | null

  setActiveTab: (tab: 'current' | 'history') => void
  setStocks: (stocks: Stock[]) => void
  setV6Scores: (scores: V6Score[]) => void
  setRotationScores: (scores: RotationSectorScore[]) => void
  setItems: (items: StrategyGroupItem[]) => void
  setSnapshots: (snapshots: StrategySnapshot[]) => void
  setSelectedSnapshot: (snapshot: StrategySnapshot | null) => void
  setLoading: (loading: boolean) => void
  setSaving: (saving: boolean) => void
  setError: (error: string | null) => void
  clearError: () => void
}

export const useStrategySnapshotStore = create<StrategySnapshotState>((set) => ({
  activeTab: 'current',
  stocks: [],
  v6Scores: [],
  rotationScores: [],
  items: [],
  snapshots: [],
  selectedSnapshot: null,
  loading: false,
  saving: false,
  error: null,

  setActiveTab: (tab) => set({ activeTab: tab }),
  setStocks: (stocks) => set({ stocks }),
  setV6Scores: (scores) => set({ v6Scores: scores }),
  setRotationScores: (scores) => set({ rotationScores: scores }),
  setItems: (items) => set({ items }),
  setSnapshots: (snapshots) => set({ snapshots }),
  setSelectedSnapshot: (snapshot) => set({ selectedSnapshot: snapshot }),
  setLoading: (loading) => set({ loading }),
  setSaving: (saving) => set({ saving }),
  setError: (error) => set({ error }),
  clearError: () => set({ error: null }),
}))
```

**修改文件**：`src/pages/trading/StrategySnapshotPage.tsx`
- 删除所�?useState 声明
- 使用 `useStrategySnapshotStore` 替代

**修复成本**�? 小时  
**验证方式**：策略快照页面功能正常，标签切换、快照保�?查看功能正常

---

## 四、修复工作量估算

| 问题 | 修复方式 | 工作�?| 优先�?|
|:---|:---|:---|:---|
| D1-P2-001 | 修改导航路径 | 5 分钟 | 紧�?|
| D1-P2-002 | 不修复（保留 useState�?| 0 | �?|
| D2-P2-003 | 新建 tradingStore.ts | 2 小时 | �?|
| D3-P2-004 | 新建 strategySnapshotStore.ts | 2 小时 | �?|
| **总计** | | **4 小时 5 分钟** | |

---

## 五、修复后预期效果

| 指标 | 修复�?| 修复�?|
|:---|:---|:---|
| 交易�?Hub 导航清晰�?| �?| �?|
| 交易信号状态管�?| useState�?个） | Zustand Store |
| 策略快照状态管�?| useState�?0个） | Zustand Store |
| 跨组件状态共�?| 不支�?| 支持 |
| L2 状态层完成�?| 75% | 100% |