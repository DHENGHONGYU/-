---
title: backtest-contract.md — 回测引擎接口契约
status: draft
owner: 架构组
updated: 2026-07-12
---

# backtest-contract.md — 回测引擎接口契约

> **定位**：定义 `backtest` 子域的接口契约、职责边界、数据流与依赖关系。  
> **关联**：`../../architecture/services-catalog.md`（24 子域总览）、`AGENTS.md` §一（分层规则）。

---

## 1. 职责边界

### 1.1 核心职责

1. **策略回测编排**：接收回测配置（策略类型、日期范围、初始资金、手续费率、滑点、仓位上限），在日期范围内逐日执行虚拟交易，模拟真实市场环境下的策略表现。
2. **信号/订单事件加载**：从 `dataLayer` 读取 `signals` 与 `orders` 数据，按策略类型过滤、按日期范围筛选，信号不足时自动降级合并订单事件作为补充。
3. **虚拟交易执行**：模拟买入/卖出操作，计算滑点后成交价与手续费，跟踪持仓变化（加仓平均成本法、减仓清仓），执行仓位上限与现金约束检查。
4. **绩效指标计算**：基于每日净值曲线计算总收益率、年化收益率、最大回撤、夏普比率、胜率、盈亏交易统计，并输出标准化 `BacktestResult`。

### 1.2 分层定位

| 维度 | 说明 |
|------|------|
| 所属层 | `src/services/`（服务层） |
| 依赖方向 | 只能依赖 `core/`、`data/`、`lib/`（白名单） |
| 禁止事项 | 禁止直写 IndexedDB（须经 `DataBridge.forward()`）；本域直接读取 dataLayer 属例外历史路径 |
| 被依赖方 | `store/`（`backtestStore` 管理结果与状态）、`pages/`（回测结果展示页）可消费本服务输出 |

### 1.3 与相邻子域的关系

| 相邻子域 | 关系 | 数据流 |
|----------|------|--------|
| `dataLayer` (`src/data/dataLayer`) | 上游数据源 | `signals.list()` / `orders.list()` / `dailyQuotes.get()` → 本服务 |
| `trading/positionSizer` | 同层依赖：仓位计算 | `calculatePosition()` 输入 portfolioValue / currentHolding → 返回 targetShares |
| `types/modules/backtest.types` | 类型契约 | 共享 `BacktestStrategy` / `BacktestResult` / `BacktestTrade` 定义 |
| `store/backtestStore` | 下游消费 | 本服务 `BacktestEngineResult` → Store 持久化与状态管理 |

---

## 2. 公共接口

### 2.1 类型定义（TypeScript Interface）

```typescript
// 文件：src/services/backtest/BacktestEngine.ts

export interface BacktestEngineConfig {
  strategy: BacktestStrategy          // 'hot_sector' | 'value_pit' | 'composite'
  startDate: string                   // ISO 日期（如 '2024-01-01'）
  endDate: string
  initialCapital: number              // 初始资金
  commissionRate: number              // 手续费率（如 0.0003 = 0.03%）
  slippage: number                    // 滑点比率（如 0.001 = 0.1%）
  maxPositionPct: number              // 单票最大仓位占比（如 0.2 = 20%）
}

export interface VirtualOrder {
  id: string
  symbol: string
  direction: 'buy' | 'sell'
  price: number                       // 含滑点后的实际成交价
  quantity: number
  date: string
  commission: number                  // 该笔交易手续费
}

export interface VirtualPosition {
  symbol: string
  quantity: number
  avgCost: number                     // 加权平均成本
  currentPrice: number                // 回测结束日收盘价
  marketValue: number
  unrealizedPnL: number               // 未实现盈亏
}

export interface BacktestEngineResult {
  trades: VirtualOrder[]
  positions: VirtualPosition[]
  dailyValues: { date: string; totalValue: number; cash: number }[]
  metrics: BacktestResult             // 来自 @/types/modules/backtest.types
}
```

```typescript
// 文件：src/services/backtest/backtestEventLoader.ts

export interface BacktestEvent {
  symbol: string
  direction: 'buy' | 'sell'
  date: string
  price: number
  confidence: number
  source: 'signal' | 'order'
  strategy?: string
}
```

```typescript
// 文件：src/services/backtest/backtestMetrics.ts

export interface InternalPosition {
  quantity: number
  avgCost: number
}
```

### 2.2 主入口函数

| 函数 | 签名 | 职责 | 错误处理 |
|------|------|------|----------|
| `BacktestEngine.run()` | `(config: BacktestEngineConfig) => Promise<BacktestEngineResult>` | 执行完整回测流程（加载事件 → 预加载行情 → 逐日执行 → 计算指标） | `logger.warn` 降级（如 signals/orders 读取失败返回空结果） |
| `loadBacktestEvents()` | `(config: BacktestEngineConfig) => Promise<BacktestEvent[]>` | 加载并合并信号/订单事件，按日期排序 | 读取失败时返回空数组（优雅降级） |
| `calculateBacktestMetrics()` | `(dailyValues, trades, config) => BacktestResult` | 计算总收益、年化、回撤、夏普、胜率等绩效指标 | 纯计算，无副作用；空输入时返回 `createEmptyMetrics` |
| `buildVirtualPositions()` | `(positions, endDate, quotesCache) => VirtualPosition[]` | 将内部持仓映射为最终快照 | 无行情时回退到 avgCost |
| `createEmptyResult()` | `(config: BacktestEngineConfig) => BacktestEngineResult` | 空事件时的默认结果工厂 | 行为契约：`pnlCurve = [1.0]` |

### 2.3 事件接口

> 本子域当前未使用 `EventBus` 进行事件发布。结果通过 `BacktestEngine.run()` 的返回值直接传递，由调用方（如 `backtestStore`）消费。

| 事件名 | 发布方 | 订阅方 | 说明 |
|--------|--------|--------|------|
| — | — | — | 当前未定义独立事件接口 |

---

## 3. 数据流

```
[外部输入：回测配置]
    ↓
BacktestEngine.run(config)
    ├─→ backtestEventLoader.loadBacktestEvents()  →  dataLayer.signals.list() / orders.list()
    ├─→ backtestEventLoader.preloadQuotes()        →  dataLayer.dailyQuotes.get()
    ├─→ 逐日执行：_processSellEvents() / _processBuyEvents()
    │       ↓ 复用 trading/positionSizer.calculatePosition()
    ├─→ backtestMetrics.calculateBacktestMetrics()
    └─→ backtestMetrics.buildVirtualPositions()
            ↓
    BacktestEngineResult（纯返回值，不自动写入 IndexedDB）
            ↓
    调用方（如 backtestStore）通过 DataBridge.forward() 持久化
            ↓
    backtestStore (Zustand + withBroadcast)
            ↓
    components/pages（仅经 Store 取数）
```

**说明**：
- 回测引擎本身**不直接写入 IndexedDB**，结果以纯返回值形式输出。
- 数据持久化由调用方（`backtestStore` 或其他编排层）通过 `DataBridge.forward()` 完成。
- 行情数据通过 `dataLayer.dailyQuotes.get()` 读取（非 DataBridge 路由），属历史路径，未来如需统一可迁移。

---

## 4. 配置与依赖

### 4.1 依赖白名单（lib/ 及合规依赖）

| 依赖 | 路径 | 用途 |
|------|------|------|
| logger | `@/lib/logger` | 日志输出（`[BacktestEngine] 开始回测 / 回测完成`） |
| dataLayer | `@/data/dataLayer` | 读取 signals、orders、dailyQuotes |
| data/db | `@/data/db` | `generateId()` 生成虚拟订单 ID |
| data/types | `@/data/types` | `DailyQuotes`、`Signal`、`Order` 类型 |
| types/modules/backtest.types | `@/types/modules/backtest.types` | `BacktestStrategy`、`BacktestResult`、`BacktestTrade` |
| trading/positionSizer | `@/services/trading/positionSizer` | 同层服务：计算目标买入股数 |
| config/mathConstants | `@/config/mathConstants` | `TRADING_DAYS_PER_YEAR`（⚠️ 跨层依赖：`services/` 应仅依赖 `core/`、`data/`、`lib/`） |

### 4.2 配置项

| 配置名 | 默认值 | 说明 | 来源 |
|--------|--------|------|------|
| `MIN_SIGNAL_EVENTS_FOR_COMBINE` | `5` | 信号事件不足此数量时，用订单事件补充合并 | 模块内常量（`backtestEventLoader.ts`） |
| `MS_END_OF_DAY` | `999` | 毫秒精度：一天结束时刻的毫秒部分 | 模块内常量（`backtestEventLoader.ts`） |
| `TRADING_DAYS_PER_YEAR` | — | 年化计算用交易日数 | `@/config/mathConstants` |
| `RISK_FREE_RATE` | `0.03` | 无风险利率（用于夏普比率计算） | 模块内常量（`backtestMetrics.ts`） |

---

## 5. 测试策略

| 测试类型 | 文件 | 说明 |
|----------|------|------|
| 单元测试 | `src/services/backtest/BacktestEngine.test.ts` | 共 28+ 用例，覆盖：空事件降级、绩效指标（收益/回撤/夏普/胜率）、交易执行（滑点/手续费/现金不足跳过）、持仓管理（平均成本/清仓）、策略过滤（hot_sector / value_pit / composite）、日期范围过滤与周末跳过 |
| 行为契约测试 | `BacktestEngine.test.ts`（`run() 行为契约`套件） | 6 个契约测试：① 结果结构完整性 ② buy→sell 完整路径 ③ 空事件零值 ④ 滑点方向正确 ⑤ dailyValues 升序+跳过周末 ⑥ positions/dailyValues 注入 metrics |
| Mock 策略 | 同文件内 `vi.mock` | Mock `dataLayer`、`logger`、`generateId`、`calculatePosition`，隔离外部依赖 |

> 注：测试文件与源码同目录，未使用 `__tests__/` 子目录。当前无独立集成测试文件。

---

## 6. 变更日志

| 日期 | 版本 | 变更 | 作者 |
|------|------|------|------|
| 2026-07-12 | v0.1.0 | 契约初稿 | 架构组 |

---

> **TODO[子域 owner]**：
> 1. 评估 `@/config/mathConstants` 依赖是否需迁移至 `src/constants/` 或 `src/core/`，以消除 services→config 跨层违规。
> 2. 若未来引入 EventBus 发布回测完成事件，需在 §2.3 补充事件接口表格。
> 3. 完成后运行 `tsc --noEmit` + `audit:layers` 验证。
