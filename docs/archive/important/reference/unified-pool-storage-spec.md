---
doc_id: V9-DOC-REF-967
title: unified-pool-storage-spec
code_version: "2.0.0-rc.2"
tier: important
version: v1.0.0
last_updated: 2026-08-11
change_log:
  - version: v1.0.0
    changes: "C 类版本闭环(2026-08-11)：补全 change_log 初始条目"
    date: 2026-08-11
---



# 股票池统一存储方案规范

> **版本**: v1.0.0 | **日期**: 2026-07-13
> **基于**: V9 AGENTS.md §一 分层规则、`./10-glossary.md` §10.1/10.7
> **目标**: 消除 localStorage 意向池 / 研究精选池 / watchlist 与 IndexedDB 之间的双层存储不一致，统一以 IndexedDB `stocks` 表 + `orders` 表为唯一真相源

---

## 1. 问题背景

V9 早期版本存在以下分散存储：

| 旧存储 | 旧位置 | 问题 |
|---|---|---|
| `intention_pool` | localStorage / 独立表 | 与 `stocks` 表数据不同步，无法跨 Tab 共享 |
| `screener_pool` | localStorage / 独立表 | 同上，且筛选结果与研究状态割裂 |
| `watchlist` | localStorage | 容量受限、无法索引、与 `stocks` 观察状态不一致 |
| `v6_paper_trading` | localStorage | 模拟交易记录与 `orders` 表分离，复盘数据不完整 |

当前代码已按 `./10-glossary.md` 完成主体改造，但仍有部分**旧命名兼容代码**和**重复常量定义**需要清理。

---

## 2. 统一存储架构

### 2.1 三层池概念

| 中文池名 | 英文标识 | 存储位置 | 区分字段 |
|---|---|---|---|
| **意向候选池** | Intention Candidate Pool | `stocks` Store（IndexedDB） | `researchStatus = 'candidate'` |
| **研究精选池** | Research Selected Pool | `stocks` Store（IndexedDB） | `researchStatus = 'screened'` |
| **交易持仓池** | Trade Holding Pool | `orders` Store（IndexedDB） | 已成交订单聚合出的持仓 |

> 研究状态机还有 `deepDive`（深度研究池）、`watching`（观察池）、`archived`（归档池），均统一存储于 `stocks` 表，通过 `researchStatus` 区分。

### 2.2 架构图

```
┌─────────────────────────────────────────────────────────────┐
│  UI 层（PoolBoard / PoolList / TradingFlowPage）              │
│  只读：从 Store / Service 获取分组后的池数据                   │
├─────────────────────────────────────────────────────────────┤
│  Store 层                                                     │
│  poolStore          → 管理 stocks 表读写                      │
│  watchlistStore     → 管理 watchlists 自定义观察列表          │
│  orderStore         → 管理 orders 表，推导持仓                │
├─────────────────────────────────────────────────────────────┤
│  Service 层                                                   │
│  stockpoolService   → 股票池分组、流转                        │
│  tradingService     → 订单、持仓计算                          │
├─────────────────────────────────────────────────────────────┤
│  Core 层                                                      │
│  DataBridge.forward(StandardEnvelope) → 统一写入口            │
│  poolTransitionEngine → 状态流转校验                          │
├─────────────────────────────────────────────────────────────┤
│  Data 层                                                      │
│  stocks  Store（IndexedDB）→ 意向/精选/深度/观察/归档统一存储  │
│  orders  Store（IndexedDB）→ 交易订单，聚合为持仓              │
│  watchlists Store（IndexedDB）→ 用户自定义观察列表（可选）      │
└─────────────────────────────────────────────────────────────┘
```

### 2.3 关键约束

- **禁止 localStorage 存储任何股票池数据**（候选/精选/持仓/watchlist）。
- **禁止创建独立表**存储各池数据。
- **所有池查询统一走 `db.getAllByIndex('stocks', 'by-status', status)`**。
- **交易持仓不走股票池流转引擎**，由交易服务独立管理。
- **常量权威源**：`RESEARCH_STATUS`、`ResearchStatus`、`DEFAULT_POOL_GROUP` 统一出自 `src/constants/pool.constants.ts`。

---

## 3. 存储 Schema

### 3.1 `stocks` Store（统一研究池）

```typescript
// src/data/types/types.stock.ts
export interface Stock {
  symbol: string           // 主键
  name: string
  price?: number
  pe?: number
  pb?: number
  roe?: number
  marketCap?: number
  researchStatus: ResearchStatus  // candidate | screened | deepDive | watching | archived
  source: DataSource
  dataVersion: number
  dataQuality?: StockDataQuality
  ingestedAt?: number
  updatedAt?: number
  industryCode?: string
  theme?: string[]
  sector?: string
  group?: string           // 用户自定义分组
  dataProvenance?: 'real' | 'mock' | 'unknown'
  dataSource?: 'tencent' | 'sina' | 'netease' | 'akshare' | 'mock' | 'unknown'
}
```

**索引定义**（`src/data/db-schema.ts`）：

```typescript
ensureStore(db, STORE_NAME.stocks, logger, {
  storeOptions: { keyPath: 'symbol' },
  indexes: [
    { name: 'by-status', keyPath: 'researchStatus' },
    { name: 'by-group', keyPath: 'group' },
    { name: 'by-industry', keyPath: 'industryCode' },
    { name: 'by-sector', keyPath: 'sector' },
  ],
})
```

### 3.2 `orders` Store（交易持仓池来源）

```typescript
// src/data/types/types.order.ts
export interface Order {
  id: string
  symbol: string
  direction: 'buy' | 'sell'
  quantity: number
  price: number
  amount: number
  status: 'pending' | 'filled' | 'cancelled'
  accountType: 'paper' | 'real'
  createdAt: number
  planStopLoss?: number
  planTakeProfit?: number
  planPositionPct?: number
  planFollowed?: boolean
  maxDrawdown?: number
  maxFloatingProfit?: number
  profitCaptureRate?: number
  errors?: string[]
  reviewNoteId?: string
}
```

**持仓推导逻辑**（只读计算，不单独建表）：

```typescript
// src/services/trading/portfolioService.ts 或 portfolioBuilder.ts
export function buildHoldings(orders: Order[]): Holding[] {
  const buyMap = new Map<string, number>() // symbol -> 总买入股数
  const sellMap = new Map<string, number>() // symbol -> 总卖出股数
  const costMap = new Map<string, number>() // symbol -> 总成本

  for (const order of orders.filter((o) => o.status === 'filled')) {
    if (order.direction === 'buy') {
      buyMap.set(order.symbol, (buyMap.get(order.symbol) ?? 0) + order.quantity)
      costMap.set(order.symbol, (costMap.get(order.symbol) ?? 0) + order.amount)
    } else {
      sellMap.set(order.symbol, (sellMap.get(order.symbol) ?? 0) + order.quantity)
    }
  }

  const holdings: Holding[] = []
  for (const [symbol, totalBuy] of buyMap) {
    const totalSell = sellMap.get(symbol) ?? 0
    const quantity = totalBuy - totalSell
    if (quantity > 0) {
      holdings.push({
        symbol,
        quantity,
        avgCost: (costMap.get(symbol) ?? 0) / totalBuy,
      })
    }
  }
  return holdings
}
```

### 3.3 `watchlists` Store（可选自定义观察列表）

```typescript
// src/data/types/types.stock.ts
export interface Watchlist {
  id: string
  name: string
  symbols: string[]
  createdAt: number
  updatedAt: number
}
```

> 与 `stocks.researchStatus = 'watching'` 解耦：`watchlists` 是用户自定义列表，`watching` 是研究流程中的一个状态。

---

## 4. 迁移策略

### 4.1 历史数据迁移（V6 / 早期 V9）

旧 localStorage key 与迁移目标：

| 旧 localStorage key | 迁移目标 | 处理方式 |
|---|---|---|
| `intention_pool` | `stocks` + `researchStatus = 'candidate'` | V6 迁移服务解析后批量写入 |
| `screener_pool` | `stocks` + `researchStatus = 'screened'` | V6 迁移服务解析后批量写入 |
| `watchlist` | `stocks` + `researchStatus = 'watching'` 或 `watchlists` Store | 根据数据字段判断：含研究备注 → stocks；仅 symbol 列表 → watchlists |
| `v6_paper_trading` | `orders` Store | V6 迁移服务转换订单格式后写入 |

### 4.2 运行时迁移（应用启动时）

在 `bootstrapService` 或 `MigrationPanel` 中执行一次：

```typescript
// src/services/system/migration/poolMigration.ts
export async function migrateLegacyPoolStorage(): Promise<void> {
  const migrated = localStorage.getItem('v9-pool-migrated')
  if (migrated === 'true') return

  const legacyKeys = ['intention_pool', 'screener_pool', 'v9-watchlist', 'v6_paper_trading']
  for (const key of legacyKeys) {
    const raw = localStorage.getItem(key)
    if (!raw) continue

    try {
      const parsed = JSON.parse(raw)
      await transformAndImport(key, parsed)
      localStorage.removeItem(key)
    } catch (err) {
      logger.error(`[PoolMigration] 迁移 ${key} 失败`, { error: err })
    }
  }

  localStorage.setItem('v9-pool-migrated', 'true')
}
```

### 4.3 平滑迁移原则

1. **读取优先 IndexedDB**：启动时若 localStorage 有旧数据、IndexedDB 无数据，则迁移；否则跳过。
2. **幂等**：多次执行不重复写入（以 `symbol` 主键去重）。
3. **失败可回滚**：迁移前不删除 localStorage，确认写入成功后再清理。
4. **标记位**：使用 `v9-pool-migrated` 标记，避免每次启动重复扫描。

---

## 5. 清理清单（旧名称兼容代码）

### 5.1 已废弃命名（不得再使用）

| 旧命名 | 状态 |
|---|---|
| `intention_pool` | 已删除 |
| `screener_pool` | 已删除 |
| `v6_paper_trading` | 已删除 |
| `localStorage.watchlist` | 已删除 |
| 从 `@/config/dbConfig` 导入 `RESEARCH_STATUS` / `ResearchStatus` / `DEFAULT_POOL_GROUP` | 已清理（20+ 文件迁移到 `@/constants/stockpool.constants`） |

### 5.2 重复定义清理

- `RESEARCH_STATUS` 与 `DEFAULT_POOL_GROUP` 应仅存在于 `src/constants/pool.constants.ts`。
- `src/config/dbConfig.ts` 中的同名导出应删除，所有引用方改从 `src/constants/pool.constants.ts` 导入。

### 5.3 验证命令

```powershell
# 1. 确认无 localStorage 股票池 key
rg "localStorage\.(getItem|setItem|removeItem).*pool" src
rg "intention_pool|screener_pool|v6_paper_trading" src

# 2. 确认常量从 constants 层导入
rg "from\s+['\"]@/config/dbConfig['\"].*RESEARCH_STATUS|RESEARCH_STATUS\s+from\s+['\"]@/config/dbConfig['\"]" src

# 3. 架构与类型检查
npm.cmd run audit:layers
npx tsc --noEmit
```

---

## 6. 相关文档

- [V9 AGENTS.md](../../AGENTS.md) — 分层规则
- [Glossary](./10-glossary.md) — 废弃命名映射表
- [Gateway 写入权限规范](./gateway-write-permission-spec.md) — 写入收口规范
- [核心数据策略报告](../explanation/core-data-strategy-report.md) — 数据架构、数据库定义、传递协议与蓝图校对
