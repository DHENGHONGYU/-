---
title: V9 批次 D（交易舱）P2 问题修复方案
version: v1.0.0
last_updated: 2026-06-27
maintainer: Quality Auditor
status: draft
---

# V9 批次 D（交易舱）P2 问题修复方案

> **审计范围**：交易舱 4 模块（D1-D4）  
> **问题总数**：4 个 P2 级问题  
> **修复优先级**：按影响范围和修复成本排序

---

## 一、问题汇总

| 编号 | 模块 | 问题描述 | 当前状态 | 影响范围 |
|:---|:---|:---|:---|:---|
| D1-P2-001 | 交易舱 Hub | "交易信号"和"模拟持仓"链接均指向 `/trading`，导航路径不明确 | useState | 导航体验 |
| D1-P2-002 | 交易舱 Hub | 无独立 Zustand Store | useState | 跨组件共享 |
| D2-P2-003 | 交易信号 | 使用 9 个 useState，状态管理分散 | useState | 可维护性 |
| D3-P2-004 | 策略快照 | 使用 10 个 useState，状态管理分散 | useState | 可维护性 |

---

## 二、修复优先级排序

| 优先级 | 问题 | 修复成本 | 收益 | 说明 |
|:---|:---|:---|:---|:---|
| **紧急** | D1-P2-001 | 低（5 分钟） | 高 | 修复导航路径，提升用户体验 |
| **高** | D2-P2-003 | 中（2 小时） | 高 | 交易信号是核心模块，需要跨组件共享状态 |
| **高** | D3-P2-004 | 中（2 小时） | 高 | 策略快照状态复杂，需要统一管理 |
| **低** | D1-P2-002 | 低（30 分钟） | 低 | Hub 为纯展示页面，无状态共享需求 |

---

## 三、详细修复方案

### 3.1 D1-P2-001：修复导航路径不明确

**问题描述**：`TradingHubPage.tsx` 中"交易信号"和"模拟持仓"链接均指向 `/trading`，用户无法区分两个功能入口。

**修复方案**：
- 修改 `TRADING_MODULES` 数组中的 path 字段
- "交易信号" → `/trading/signals`（需要新增路由）或保持 `/trading`（主入口）
- "模拟持仓" → `/trading/holdings`（已有路由）

**修改文件**：`src/pages/trading/TradingHubPage.tsx:32-51`

```typescript
const TRADING_MODULES: HubModule[] = [
  {
    title: '交易信号',
    description: '观察池、信号扫描、买卖下单',
    path: '/trading',
    icon: Activity,
  },
  {
    title: '模拟持仓',
    description: '持仓列表、订单管理',
    path: '/trading/holdings',  // 修复：改为交易持仓路由
    icon: Wallet,
  },
  {
    title: '策略快照',
    description: '核心仓/热点短线/价值洼地分类与历史快照',
    path: '/trading/strategy-snapshots',
    icon: Target,
  },
]
```

**修复成本**：5 分钟  
**验证方式**：点击 Hub 中的"模拟持仓"卡片，应跳转至 `/trading/holdings` 页面

---

### 3.2 D1-P2-002：交易舱 Hub 创建 Zustand Store（可选）

**问题描述**：`TradingHubPage.tsx` 使用 useState 管理渲染状态，无独立 Zustand Store。

**评估**：Hub 页面为纯展示页面，无跨组件状态共享需求，且状态量极少。创建独立 Store 收益有限。

**建议**：保留 useState，不做修复。如未来需要状态共享，再创建 `tradingHubStore.ts`。

**修复成本**：0（不修复）  
**优先级**：低

---

### 3.3 D2-P2-003：交易信号创建 Zustand Store

**问题描述**：`TradingApp.tsx` 使用 9 个 useState，状态管理分散，不利于跨组件共享和维护。

**当前状态变量**：
```typescript
const [stocks, setStocks] = useState<Stock[]>([])           // 观察池股票
const [orders, setOrders] = useState<Order[]>([])           // 订单列表
const [signals, setSignals] = useState<TradingSignal[]>([]) // 交易信号
const [adviceMap, setAdviceMap] = useState<Record<string, TradeAdvice>>({}) // 交易建议
const [portfolio, setPortfolio] = useState<Portfolio | undefined>() // 核心组合
const [strategyResult, setStrategyResult] = useState<StrategyResult | undefined>() // 策略结果
const [portfolioLoading, setPortfolioLoading] = useState(false) // 组合加载状态
const [processingSymbols, setProcessingSymbols] = useState<Set<string>>(new Set()) // 处理中的标的
const [message, setMessage] = useState('')                 // 消息提示
```

**修复方案**：创建 `tradingStore.ts` Zustand Store

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
- 删除所有 useState 声明
- 使用 `useTradingStore` 替代

**修复成本**：2 小时  
**验证方式**：交易信号页面功能正常，状态变更能正确反映到 UI

---

### 3.4 D3-P2-004：策略快照创建 Zustand Store

**问题描述**：`StrategySnapshotPage.tsx` 使用 10 个 useState，状态管理分散，不利于跨组件共享和维护。

**当前状态变量**：
```typescript
const [activeTab, setActiveTab] = useState('current')              // 当前标签页
const [stocks, setStocks] = useState<Stock[]>([])                 // 股票列表
const [v6Scores, setV6Scores] = useState<V6Score[]>([])           // V6 评分
const [rotationScores, setRotationScores] = useState<RotationSectorScore[]>([]) // 轮动评分
const [items, setItems] = useState<StrategyGroupItem[]>([])       // 分类后的股票
const [snapshots, setSnapshots] = useState<StrategySnapshot[]>([]) // 历史快照
const [selectedSnapshot, setSelectedSnapshot] = useState<StrategySnapshot | null>(null) // 当前选中快照
const [loading, setLoading] = useState(false)                     // 加载状态
const [saving, setSaving] = useState(false)                       // 保存状态
const [error, setError] = useState<string | null>(null)           // 错误信息
```

**修复方案**：创建 `strategySnapshotStore.ts` Zustand Store

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
- 删除所有 useState 声明
- 使用 `useStrategySnapshotStore` 替代

**修复成本**：2 小时  
**验证方式**：策略快照页面功能正常，标签切换、快照保存/查看功能正常

---

## 四、修复工作量估算

| 问题 | 修复方式 | 工作量 | 优先级 |
|:---|:---|:---|:---|
| D1-P2-001 | 修改导航路径 | 5 分钟 | 紧急 |
| D1-P2-002 | 不修复（保留 useState） | 0 | 低 |
| D2-P2-003 | 新建 tradingStore.ts | 2 小时 | 高 |
| D3-P2-004 | 新建 strategySnapshotStore.ts | 2 小时 | 高 |
| **总计** | | **4 小时 5 分钟** | |

---

## 五、修复后预期效果

| 指标 | 修复前 | 修复后 |
|:---|:---|:---|
| 交易舱 Hub 导航清晰度 | 低 | 高 |
| 交易信号状态管理 | useState（9个） | Zustand Store |
| 策略快照状态管理 | useState（10个） | Zustand Store |
| 跨组件状态共享 | 不支持 | 支持 |
| L2 状态层完成率 | 75% | 100% |