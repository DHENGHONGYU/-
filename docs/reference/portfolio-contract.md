---
title: portfolio-contract
code_version: 2.0.0

tier: important
---

---
title: portfolio-contract.md
status: draft
owner: 架构组
updated: 2026-07-12
code_version: 2.0.0
tier: important
---

# portfolio-contract.md — 投资组合（Portfolio）接口契约

> **定位**：定义 `portfolio` 子域的接口契约、职责边界、数据流与依赖关系。  
> **关联**：`./services-catalog.md`（24 子域总览）、`../../AGENTS.md` §一（分层规则）。

---

## 1. 职责边界

### 1.1 核心职责

- **投资组合持仓管理**：提供新增/移除持仓、维护持仓列表及组合总市值的 CRUD 封装。持仓新增时自动校验权重上限并去重。
- **组合再平衡（兼容 Facade）**：`rebalance()` 为向后兼容的薄包装，实际业务逻辑已迁移至 `services/useCase/rebalancePortfolio.useCase`。该用例包含事务内订单执行、Freshness 校验、权重偏差检测与再平衡计划生成。
- **按主题查询组合**：支持按投资主题（`theme`）过滤投资组合列表，返回符合条件的 `Portfolio[]`。
- **持仓权重约束**：在新增持仓时自动将 `targetWeight` 限制在 `DEFAULT_MAX_HOLDING_WEIGHT` 以内，防止单票过度集中。

### 1.2 分层定位

| 维度 | 说明 |
|------|------|
| 所属层 | `src/services/`（服务层） |
| 依赖方向 | 只能依赖 `core/`、`data/`、`lib/`（白名单）、`constants/`、`services/`（同层 UseCase） |
| 禁止事项 | 禁止直接写 IndexedDB（须经 `DataBridge.forward()`）；禁止依赖 `store/`、`pages/`、`components/` |
| 被依赖方 | `store/`（状态层）、`pages/`（页面层）可消费本服务输出 |

### 1.3 与相邻子域的关系

| 相邻子域 | 关系 | 数据流 |
|----------|------|--------|
| `services/useCase/rebalancePortfolio` | 同层委托：再平衡核心逻辑已抽取为独立 UseCase | `portfolioService.rebalance()` → `rebalancePortfolioUseCase()` |
| `data/dataLayer`（`portfolioStore`） | 下游数据持久化：通过 dataLayer 读写 Portfolio 数据 | `portfolioService` → `portfolioStore.get/save/getWithTx/saveWithTx` → IndexedDB |
| `constants/execution.constants` | 配置依赖：持仓权重上限、再平衡阈值、现金预留比例等常量 | `portfolioService` / `rebalancePortfolioUseCase` 读取常量默认值 |
| `core/transaction` | 基础设施：再平衡用例使用事务包装确保数据一致性 | `rebalancePortfolioUseCase` → `runInTransaction()` |
| `core/freshnessGuard` | 基础设施：再平衡前校验组合数据新鲜度 | `rebalancePortfolioUseCase` → `checkPortfolioRebalanceFreshness()` |

---

## 2. 公共接口

### 2.1 类型定义（TypeScript Interface）

本子域无独立的类型定义文件，依赖类型由 `src/data/types/` 统一提供：

```typescript
// 来源：src/data/types/types.portfolio.ts

export interface PortfolioHolding {
  symbol: string
  name: string
  currentShares: number
  currentWeight: number
  targetWeight: number
  targetShares: number
  price: number
  marketValue: number
  score: number
  rationale: string
}

export interface RebalanceAction {
  symbol: string
  action: 'buy' | 'sell' | 'hold'
  shares: number
  reason: string
}

export interface Portfolio {
  id: string
  name: string
  theme: string
  totalValue: number
  cashReserve: number
  holdings: PortfolioHolding[]
  rebalancePlan: RebalanceAction[]
  createdAt: number
  updatedAt: number
}

// 来源：src/services/useCase/rebalancePortfolio.useCase.ts

export interface RebalanceOptions {
  now?: number
  cashReservePct?: number
  maxHoldingWeight?: number
  rebalanceThreshold?: number
}
```

### 2.2 主入口函数

| 函数 | 签名 | 职责 | 错误处理 |
|------|------|------|----------|
| `rebalance()` | `(portfolioId: string, orders: Order[], options?: RebalanceOptions) => Promise<Portfolio \| undefined>` | **已废弃**，薄包装委托给 `rebalancePortfolioUseCase`；根据最新订单再平衡投资组合 | 返回 `undefined`，logger 记录错误 |
| `addHolding()` | `(portfolioId: string, holding: PortfolioHolding) => Promise<Portfolio \| undefined>` | 向投资组合新增持仓；自动校验权重上限与重复持仓 | 返回 `undefined`，logger 记录 warn/error |
| `removeHolding()` | `(portfolioId: string, symbol: string) => Promise<Portfolio \| undefined>` | 从投资组合移除指定持仓，同步扣减总市值 | 返回 `undefined`，logger 记录 warn/error |
| `listByTheme()` | `(theme: string) => Promise<Portfolio[]>` | 按投资主题过滤并返回组合列表 | 返回空数组 `[]`，logger 记录 error |

### 2.3 事件接口

本子域**未直接使用 EventBus** 进行事件发布/订阅。状态变更由调用方通过返回值感知，数据持久化由 `portfolioStore`（dataLayer）完成。若需跨 Tab 广播，应由消费方 Store 通过 `withBroadcast` 实现。

---

## 3. 数据流

```
[外部输入：订单 / 持仓指令 / 主题查询条件]
    ↓
portfolioService.addHolding() / removeHolding() / rebalance() / listByTheme()
    ↓
portfolioStore (dataLayer) — get() / save() / getWithTx() / saveWithTx()
    ↓
IndexedDB (portfolios store)
    ↓ (由消费方 Store 读取并广播)
portfolioStore (Zustand + withBroadcast)
    ↓
components / pages (仅经 Store 取数)
```

**关键路径说明**：
1. `addHolding` / `removeHolding`：直接调用 `portfolioStore.get()` 读取组合，修改内存对象后调用 `portfolioStore.save()` 回写。
2. `rebalance`：已委托至 `rebalancePortfolioUseCase`，内部使用 `runInTransaction()` 包裹 `portfolioStore.getWithTx()` 与 `saveWithTx()`，确保订单执行与组合更新的事务一致性。
3. `listByTheme`：调用 `portfolioStore.list()` 获取全量组合，在内存中按 `theme` 过滤返回。

---

## 4. 配置与依赖

### 4.1 依赖白名单（lib/ 及同层）

| 依赖 | 路径 | 用途 |
|------|------|------|
| logger | `@/lib/logger` | 日志输出（`[portfolioService]` / `[RebalancePortfolioUseCase]` 前缀） |
| transaction | `@/core/transaction` | `runInTransaction()` 事务包装（rebalance UseCase） |
| freshnessGuard | `@/core/freshnessGuard` | `checkPortfolioRebalanceFreshness()` 数据新鲜度校验 |
| portfolioStore | `@/data/dataLayer` | Portfolio 数据的持久化读写 |
| execution.constants | `@/constants/execution.constants` | `DEFAULT_MAX_HOLDING_WEIGHT`、`DEFAULT_CASH_RESERVE_PCT`、`DEFAULT_REBALANCE_THRESHOLD` |
| rebalancePortfolio.useCase | `@/services/useCase/rebalancePortfolio.useCase` | 再平衡核心业务逻辑（同层委托） |

### 4.2 配置项

| 配置名 | 默认值 | 说明 | 来源 |
|--------|--------|------|------|
| `DEFAULT_MAX_HOLDING_WEIGHT` | — | 单只持仓目标权重上限 | `src/constants/execution.constants.ts` |
| `DEFAULT_CASH_RESERVE_PCT` | — | 现金预留比例 | `src/constants/execution.constants.ts` |
| `DEFAULT_REBALANCE_THRESHOLD` | — | 权重偏差触发再平衡的阈值 | `src/constants/execution.constants.ts` |

---

## 5. 测试策略

| 测试类型 | 文件 | 说明 |
|----------|------|------|
| 单元测试 | `src/services/portfolio/portfolioService.test.ts` | 覆盖 `rebalance`（买单/卖单/组合不存在/保存失败）、`addHolding`（新增/重复）、`removeHolding`（移除/持仓不存在）、`listByTheme`（主题过滤） |
| Mock 策略 | `vi.mock('@/data/dataLayer')` | 隔离 `portfolioStore`，Mock `get`/`save`/`getWithTx`/`saveWithTx`；Mock `@/core/transaction` 与 `@/services/analysis/dataFreshnessGuard` |

---

## 6. 变更日志

| 日期 | 版本 | 变更 | 作者 |
|------|------|------|------|
| 2026-07-12 | v0.1.0 | 契约初稿 | 架构组 |

---

> **TODO[子域 owner]**：
> - 若未来 `portfolioService` 新增 EventBus 事件发布，请在 §2.3 补充事件接口表格。
> - `rebalance()` 已标记 `@deprecated`，请在适当时机移除兼容 facade，统一入口至 `rebalancePortfolioUseCase`。
> - 完成后运行 `tsc --noEmit` + `audit:layers` 验证。
