# Widget 类型定义变更分析文档

> **变更日期**：2026-08-04  
> **影响范围**：Widget 框架模块、投资组合数据类型  
> **变更类型**：放宽类型定义（从 `number` 改为 `number | undefined`）

---

## 一、变更概览

### 1.1 变更文件清单

| 文件路径 | 涉及接口 | 变更字段 |
|---------|---------|---------|
| `src/types/modules/widget.types.ts` | `MarketIndexData` | `price`, `change`, `changePercent` |
| `src/types/modules/widget.types.ts` | `WatchlistData` | `price`, `changePercent` |
| `src/data/types/types.portfolio.ts` | `PortfolioHolding` | `price`, `marketValue`, `score` |

### 1.2 具体变更对比

#### MarketIndexData 接口变更

**变更前：**
```typescript
export interface MarketIndexData {
  code: string
  name: string
  price: number           // 变更前
  change: number          // 变更前
  changePercent: number   // 变更前
  high?: number
  low?: number
  volume?: string
}
```

**变更后：**
```typescript
export interface MarketIndexData {
  code: string
  name: string
  price: number | undefined           // 变更后
  change: number | undefined          // 变更后
  changePercent: number | undefined   // 变更后
  high?: number
  low?: number
  volume?: string
}
```

#### WatchlistData 接口变更

**变更前：**
```typescript
export interface WatchlistData {
  name: string
  code: string
  price: number           // 变更前
  changePercent: number   // 变更前
}
```

**变更后：**
```typescript
export interface WatchlistData {
  name: string
  code: string
  price: number | undefined           // 变更后
  changePercent: number | undefined   // 变更后
}
```

#### PortfolioHolding 接口变更

**变更前：**
```typescript
export interface PortfolioHolding {
  symbol: string
  name: string
  currentShares: number
  currentWeight: number
  targetWeight: number
  targetShares: number
  price: number           // 变更前
  marketValue: number     // 变更前
  score: number           // 变更前
  rationale: string
}
```

**变更后：**
```typescript
export interface PortfolioHolding {
  symbol: string
  name: string
  currentShares: number
  currentWeight: number
  targetWeight: number
  targetShares: number
  price: number | undefined           // 变更后
  marketValue: number | undefined     // 变更后
  score: number | undefined           // 变更后
  rationale: string
}
```

---

## 二、放宽类型定义的理由

### 2.1 业务层面

| 理由 | 说明 |
|-----|------|
| **数据源不稳定性** | 后端行情接口在非交易时段、停牌、异常等情况下可能返回 null 或缺失字段 |
| **多数据源聚合** | Widget 框架支持多数据源（REST/WebSocket/Mock），不同数据源的数据完整性不同 |
| **异步加载特性** | 前端渲染时数据可能尚未完全加载，部分字段处于 pending 状态 |
| **历史数据缺失** | 某些标的（如新股、退市股）可能缺少历史价格、评分等数据 |

### 2.2 技术层面

| 理由 | 说明 |
|-----|------|
| **防御性编程** | 避免 `Cannot read properties of undefined (reading 'toFixed')` 等运行时错误 |
| **类型安全** | TypeScript 强制消费方处理 undefined 值，减少遗漏 |
| **渐进式增强** | 组件可以在数据缺失时显示占位符（如 `--`），而非崩溃 |
| **统一数据契约** | 与后端 API 实际返回的 JSON 结构保持一致（JSON 字段可省略） |

### 2.3 实际场景举例

```typescript
// 场景 1：非交易时段行情
const afterHoursData: WatchlistData = {
  name: '贵州茅台',
  code: '600519',
  price: undefined,        // 非交易时段无最新价
  changePercent: undefined // 涨跌幅无法计算
}

// 场景 2：停牌标的
const suspendedStock: WatchlistData = {
  name: '某停牌股票',
  code: '000001',
  price: 0,                // 停牌价格为 0（或 undefined）
  changePercent: undefined // 无法计算涨跌幅
}

// 场景 3：评分数据未生成
const unscoredHolding: PortfolioHolding = {
  symbol: '688981.SH',
  name: '中芯国际',
  currentShares: 300,
  currentWeight: 0,
  targetWeight: 0.05,
  targetShares: 400,
  price: undefined,    // 行情未采集
  marketValue: undefined,
  score: 3.8,          // 评分有但行情缺失
  rationale: '评分有但行情缺'
}
```

---

## 三、潜在影响分析

### 3.1 正面影响

| 影响维度 | 描述 |
|---------|------|
| **稳定性提升** | 消除了因 undefined 调用 `.toFixed()` 导致的崩溃 |
| **用户体验改善** | 页面显示 `--` 占位符而非白屏或报错 |
| **代码质量提升** | 强制开发者处理空值，减少潜在遗漏 |
| **调试友好** | TypeScript 编译期即可发现空值处理遗漏 |

### 3.2 需要注意的影响

| 影响维度 | 描述 | 风险等级 |
|---------|------|
| **消费方改造** | 所有使用这些接口的组件需要添加空值处理逻辑 | 中 |
| **服务层改造** | 业务服务（如排序、计算）需要兼容 undefined 值 | 中 |
| **类型守卫需求** | 某些场景需要显式类型守卫（Type Guard）才能继续使用 | 低 |
| **测试用例更新** | 单元测试需要覆盖 undefined 场景 | 低 |

### 3.3 已完成的改造工作

#### 组件层改造

| 组件 | 改造内容 | 文件路径 |
|-----|---------|---------|
| `WatchlistWidget` | 使用 `safeFormatNumber` 处理 `price`/`changePercent`，添加 `isValidNumber` 守卫 | `src/cockpit/widgets/WatchlistWidget.tsx` |
| `MarketIndicesWidget` | 使用 `safeFormatNumber` 处理 `price`/`change`/`changePercent`，添加 `isValidNumber` 守卫 | `src/cockpit/widgets/MarketIndicesWidget.tsx` |
| `CoreResourcePanel` | 使用 `safeFormatNumber` 处理 `score`/`price`/`marketValue`，添加 `formatPositionRatio` 防除零 | `src/apps/trading/panels/CoreResourcePanel.tsx` |

#### 服务层改造

| 服务 | 改造内容 | 文件路径 |
|-----|---------|---------|
| `watchlistMoversService` | 过滤有效数据，使用 `??` 提供默认值 | `src/services/trading/watchlistMoversService.ts` |
| `portfolioService` | 使用 `??` 处理 `marketValue` 参与计算 | `src/services/portfolio/portfolioService.ts` |
| `portfolioBuilder` | 使用 `??` 处理 `price` 参与权重计算 | `src/services/trading/portfolioBuilder.ts` |
| `rebalancePortfolio.useCase` | 使用 `??` 处理 `marketValue`，添加 `price` 存在性检查 | `src/services/useCase/rebalancePortfolio.useCase.ts` |

#### 工具函数支撑

| 函数 | 功能描述 | 文件路径 |
|-----|---------|---------|
| `safeFormatNumber` | 安全格式化数值，处理 undefined/null/NaN/Infinity | `src/lib/format.ts` |
| `safeFormatPercent` | 安全格式化百分比，自动添加 +/- 符号 | `src/lib/format.ts` |
| `safeFormatInt` | 安全格式化整数 | `src/lib/format.ts` |
| `isValidNumber` | 类型守卫函数，检查是否为有效数字 | `src/lib/format.ts` |

---

## 四、缓解措施与最佳实践

### 4.1 推荐使用 safeFormatNumber

```typescript
// ❌ 不推荐：直接调用 .toFixed()
const displayPrice = stock.price.toFixed(2)

// ✅ 推荐：使用 safeFormatNumber
import { safeFormatNumber } from '@/lib/format'
const displayPrice = safeFormatNumber(stock.price, 2)
// 当 price 为 undefined 时返回 '--'
```

### 4.2 推荐使用空值合并运算符

```typescript
// ❌ 不推荐：直接参与运算
const marketValue = holding.price * holding.currentShares

// ✅ 推荐：使用 ?? 提供默认值
const marketValue = (holding.price ?? 0) * holding.currentShares
```

### 4.3 推荐使用类型守卫

```typescript
import { isValidNumber } from '@/lib/format'

// ❌ 不推荐：直接使用
const sorted = list.sort((a, b) => a.changePercent - b.changePercent)

// ✅ 推荐：先过滤有效数据
const validList = list.filter((item) => isValidNumber(item.changePercent))
const sorted = validList.sort((a, b) => a.changePercent - b.changePercent)
```

### 4.4 推荐使用条件检查

```typescript
// ❌ 不推荐：假设 price 一定存在
if (totalValue > 0) {
  const shares = Math.floor(investable * targetWeight / holding.price)
}

// ✅ 推荐：检查 price 是否存在
if (totalValue > 0 && holding.price) {
  const shares = Math.floor(investable * targetWeight / holding.price)
}
```

---

## 五、后续建议

### 5.1 短期建议

| 优先级 | 建议 | 负责人 |
|-------|------|-------|
| P0 | 完成所有消费方的空值处理改造 | 前端开发 |
| P0 | 添加 undefined 场景的单元测试 | 测试工程师 |
| P1 | 审计其他可能受影响的接口调用点 | 代码所有者 |
| P1 | 补充 `safeFormatNumber` 的使用文档 | 文档维护者 |

### 5.2 长期建议

| 优先级 | 建议 | 负责人 |
|-------|------|-------|
| P2 | 建立数据契约测试，确保 API 返回值符合类型定义 | 测试工程师 |
| P2 | 考虑使用 `zod` 等库进行运行时类型验证 | 架构师 |
| P3 | 推广 `safeFormatNumber` 等安全工具函数的使用规范 | 团队负责人 |

### 5.3 验证计划

| 验证项 | 方法 | 预期结果 |
|-------|------|---------|
| TypeScript 编译 | `npx tsc --noEmit` | 0 错误 |
| 单元测试 | `npm run test` | 所有测试通过 |
| 浏览器验证 | 访问 `/dev/widget-price-guard` 页面 | 无崩溃，显示 `--` 占位符 |
| Lighthouse 审计 | 检查错误日志 | 无 TypeError |

---

## 六、变更文件完整清单

### 类型定义文件

- [widget.types.ts](file:///d:/FinSightV9/src/types/modules/widget.types.ts)
- [types.portfolio.ts](file:///d:/FinSightV9/src/data/types/types.portfolio.ts)

### 工具函数文件

- [format.ts](file:///d:/FinSightV9/src/lib/format.ts)

### 组件文件

- [WatchlistWidget.tsx](file:///d:/FinSightV9/src/cockpit/widgets/WatchlistWidget.tsx)
- [MarketIndicesWidget.tsx](file:///d:/FinSightV9/src/cockpit/widgets/MarketIndicesWidget.tsx)
- [CoreResourcePanel.tsx](file:///d:/FinSightV9/src/apps/trading/panels/CoreResourcePanel.tsx)

### 服务文件

- [watchlistMoversService.ts](file:///d:/FinSightV9/src/services/trading/watchlistMoversService.ts)
- [portfolioService.ts](file:///d:/FinSightV9/src/services/portfolio/portfolioService.ts)
- [portfolioBuilder.ts](file:///d:/FinSightV9/src/services/trading/portfolioBuilder.ts)
- [rebalancePortfolio.useCase.ts](file:///d:/FinSightV9/src/services/useCase/rebalancePortfolio.useCase.ts)

### 验证页面

- [WidgetPriceGuardVerifyPage.tsx](file:///d:/FinSightV9/src/pages/WidgetPriceGuardVerifyPage.tsx)

---

## 附录：相关文档

- [安全格式化设计决策文档](./pr-safe-format-design-decisions.md)
- [toFixed() 扫描报告](./tofixed-scan-report.md)

---

**文档维护者**：V9 前端团队  
**最后更新**：2026-08-04
