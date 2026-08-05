# @finsightv9/safe-format API 使用文档

> **版本**: 1.0.0  
> **许可**: MIT  
> **运行时依赖**: 零依赖（Zero Dependencies）  
> **目标**: 防止金融 UI 中 `null`/`undefined`/`NaN`/`Infinity` 值导致的 `TypeError`、`RangeError` 和 `Infinity` 显示问题

---

## 目录

- [安装](#安装)
- [TypeScript 类型定义](#typescript-类型定义)
- [API 参考](#api-参考)
  - [safeFormatNumber](#safeformatnumber)
  - [safeFormatPercent](#safeformatpercent)
  - [safeFormatCurrency](#safeformatcurrency)
  - [DEFAULT_FALLBACK](#default_fallback)
- [常用业务场景](#常用业务场景)
- [防护行为速查表](#防护行为速查表)
- [从原生 toFixed 迁移指南](#从原生-tofixed-迁移指南)

---

## 安装

```bash
# 从私有 Verdaccio 仓库安装（需配置 @finsightv9 作用域源）
npm install @finsightv9/safe-format
```

`.npmrc` 作用域配置：

```ini
@finsightv9:registry=http://localhost:4873
```

---

## TypeScript 类型定义

以下为包导出的完整类型定义（源自 `dist/index.d.ts`）：

```typescript
/**
 * 默认兜底值常量
 */
declare const DEFAULT_FALLBACK = "--";

/**
 * 安全格式化数值为指定小数位数字符串
 *
 * @param value    - 待格式化的数值（null/undefined 安全）
 * @param decimals - 小数位数（钳制到 [0, 20]）
 * @param fallback - 无效值返回的兜底字符串（默认 '--'）
 * @returns 格式化后的字符串或兜底值
 */
export declare function safeFormatNumber(
  value: number | undefined | null,
  decimals: number,
  fallback?: string,
): string;

/**
 * 安全格式化百分比（正数自动添加 '+' 前缀）
 *
 * @param value    - 待格式化为百分比的数值（如 1.5 表示 +1.50%）
 * @param decimals - 小数位数（默认 2，钳制到 [0, 20]）
 * @param fallback - 无效值返回的兜底字符串（默认 '--'）
 * @returns 带符号的百分比字符串或兜底值
 */
export declare function safeFormatPercent(
  value: number | undefined | null,
  decimals?: number,
  fallback?: string,
): string;

/**
 * 安全格式化数值（带千分位分隔符）
 *
 * @param value    - 待格式化的数值
 * @param decimals - 小数位数（默认 2，钳制到 [0, 20]）
 * @param fallback - 无效值返回的兜底字符串（默认 '--'）
 * @returns 带千分位的格式化字符串或兜底值
 */
export declare function safeFormatCurrency(
  value: number | undefined | null,
  decimals?: number,
  fallback?: string,
): string;

export { DEFAULT_FALLBACK };

// 默认导出（命名空间式）
declare const _default: {
  safeFormatNumber: typeof safeFormatNumber;
  safeFormatPercent: typeof safeFormatPercent;
  safeFormatCurrency: typeof safeFormatCurrency;
};
export default _default;
```

### 导入方式

```typescript
// 命名导入（推荐）
import { safeFormatNumber, safeFormatPercent, safeFormatCurrency, DEFAULT_FALLBACK } from '@finsightv9/safe-format'

// 默认导入
import safeFormat from '@finsightv9/safe-format'
safeFormat.safeFormatNumber(42, 2)  // '42.00'
```

---

## API 参考

### safeFormatNumber

安全格式化数值为指定小数位数字符串。核心防护函数，其余两个函数共享相同的守卫逻辑。

```typescript
function safeFormatNumber(
  value: number | undefined | null,
  decimals: number,
  fallback?: string,  // 默认 '--'
): string
```

**参数说明**

| 参数 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| `value` | `number \| undefined \| null` | 是 | — | 待格式化的数值 |
| `decimals` | `number` | 是 | — | 小数位数，自动钳制到 `[0, 20]` |
| `fallback` | `string` | 否 | `'--'` | 无效值时返回的兜底字符串 |

**防护行为**

| 输入值 | 结果 | 原因 |
|--------|------|------|
| `null` | `'--'` | null 守卫 |
| `undefined` | `'--'` | undefined 守卫 |
| `NaN` | `'--'` | 非有限数守卫 |
| `Infinity` | `'--'` | 非有限数守卫 |
| `-Infinity` | `'--'` | 非有限数守卫 |
| `decimals = -5` | 钳制为 `0` | 负数钳制 |
| `decimals = 100` | 钳制为 `20` | 超大值钳制 |
| `decimals = NaN` | 钳制为 `0` | NaN 钳制 |
| `decimals = 2.7` | 截断为 `2` | 小数截断 |

**示例**

```typescript
safeFormatNumber(3.14159, 2)           // '3.14'
safeFormatNumber(3.14159, 4)           // '3.1416'
safeFormatNumber(0, 2)                 // '0.00'
safeFormatNumber(-3.14, 2)             // '-3.14'
safeFormatNumber(3.99, 0)              // '4'
safeFormatNumber(null, 2)              // '--'
safeFormatNumber(undefined, 2)         // '--'
safeFormatNumber(NaN, 2)               // '--'
safeFormatNumber(Infinity, 2)          // '--'
safeFormatNumber(3.14, -1)             // '3'
safeFormatNumber(null, 2, 'N/A')       // 'N/A'
safeFormatNumber(undefined, 2, '0.00') // '0.00'
```

---

### safeFormatPercent

安全格式化百分比，正数自动添加 `+` 前缀。

```typescript
function safeFormatPercent(
  value: number | undefined | null,
  decimals?: number,  // 默认 2
  fallback?: string,  // 默认 '--'
): string
```

**示例**

```typescript
safeFormatPercent(1.5, 2)      // '+1.50%'
safeFormatPercent(-1.5, 2)     // '-1.50%'
safeFormatPercent(0, 2)        // '0.00%'
safeFormatPercent(0.5, 1)      // '+0.5%'
safeFormatPercent(null, 2)     // '--'
safeFormatPercent(undefined)   // '--'（decimals 默认 2）
safeFormatPercent(NaN, 2)      // '--'
safeFormatPercent(Infinity, 2) // '--'
safeFormatPercent(3.14, -1)    // '+3%'
safeFormatPercent(3.99, NaN)   // '+4%'
safeFormatPercent(NaN, 2, '')  // ''（空字符串兜底）
```

---

### safeFormatCurrency

安全格式化数值，带 locale-aware 千分位分隔符。适用于大额金融数据展示。

```typescript
function safeFormatCurrency(
  value: number | undefined | null,
  decimals?: number,  // 默认 2
  fallback?: string,  // 默认 '--'
): string
```

**示例**

```typescript
safeFormatCurrency(1234567.89, 2)   // '1,234,567.89'
safeFormatCurrency(1000)            // '1,000.00'（decimals 默认 2）
safeFormatCurrency(1234.56, 0)      // '1,235'
safeFormatCurrency(null, 2)         // '--'
safeFormatCurrency(undefined, 2)    // '--'
safeFormatCurrency(NaN, 2)          // '--'
safeFormatCurrency(Infinity, 2)     // '--'
safeFormatCurrency(null, 2, '$0.00') // '$0.00'
```

---

### DEFAULT_FALLBACK

默认兜底常量，值为 `'--'`。可用于组件条件渲染判断。

```typescript
const DEFAULT_FALLBACK = "--";
```

**使用场景**

```typescript
import { safeFormatNumber, DEFAULT_FALLBACK } from '@finsightv9/safe-format'

function PriceCell({ price }: { price: number | undefined }) {
  const display = safeFormatNumber(price, 2)
  // 当数据缺失时显示骨架屏
  if (display === DEFAULT_FALLBACK) {
    return <Skeleton className="h-4 w-16" />
  }
  return <span className="font-mono">{display}</span>
}
```

---

## 常用业务场景

### 场景一：股票行情列表

```typescript
import { safeFormatNumber, safeFormatPercent, safeFormatCurrency } from '@finsightv9/safe-format'

interface StockQuote {
  name: string
  price: number | undefined
  change: number | null
  changePercent: number | undefined
  volume: number | null
  turnover: number | undefined
  peRatio: number | undefined
}

function StockRow({ quote }: { quote: StockQuote }) {
  return (
    <tr>
      <td>{quote.name}</td>
      <td className="font-mono">{safeFormatNumber(quote.price, 2)}</td>
      <td className="font-mono">{safeFormatNumber(quote.change, 2)}</td>
      <td className="font-mono">{safeFormatPercent(quote.changePercent, 2)}</td>
      <td className="font-mono">{safeFormatCurrency(quote.volume, 0)}</td>
      <td className="font-mono">{safeFormatCurrency(quote.turnover, 0)}</td>
      <td className="font-mono">{safeFormatNumber(quote.peRatio, 2)}</td>
    </tr>
  )
}
```

### 场景二：持仓收益分析

```typescript
import { safeFormatNumber, safeFormatPercent, safeFormatCurrency } from '@finsightv9/safe-format'

interface PortfolioHolding {
  stock: string
  shares: number
  costPrice: number | undefined
  currentPrice: number | null
  returnRate: number | undefined  // 可能为 Infinity（除零）
}

function HoldingRow({ holding }: { holding: PortfolioHolding }) {
  const marketValue = holding.currentPrice != null
    ? holding.currentPrice * holding.shares
    : undefined

  return (
    <tr>
      <td>{holding.stock}</td>
      <td>{holding.shares}</td>
      <td>{safeFormatNumber(holding.costPrice, 2)}</td>
      <td>{safeFormatNumber(holding.currentPrice, 2)}</td>
      <td>{safeFormatPercent(holding.returnRate, 2)}</td>
      <td>{safeFormatCurrency(marketValue, 2)}</td>
    </tr>
  )
}
```

### 场景三：模板字符串与日志

```typescript
import { safeFormatNumber, safeFormatPercent } from '@finsightv9/safe-format'

function buildScoreMessage(score: number | undefined, returnRate: number | null): string {
  return `评分: ${safeFormatNumber(score, 2)} | 收益率: ${safeFormatPercent(returnRate, 2)}`
}

buildScoreMessage(85.5, 12.3)    // '评分: 85.50 | 收益率: +12.30%'
buildScoreMessage(undefined, null) // '评分: -- | 收益率: --'
```

### 场景四：自定义兜底值

```typescript
import { safeFormatNumber } from '@finsightv9/safe-format'

// 停牌股票显示 "停牌"
safeFormatNumber(undefined, 2, '停牌')     // '停牌'

// 数据加载中显示占位零值
safeFormatNumber(null, 2, '0.00')          // '0.00'

// 空字符串兜底（适用于隐藏无效单元格）
safeFormatNumber(NaN, 2, '')               // ''
```

---

## 防护行为速查表

| 输入 | `safeFormatNumber` | `safeFormatPercent` | `safeFormatCurrency` | 原生 `.toFixed()` |
|------|---------------------|----------------------|----------------------|-------------------|
| `null` | `'--'` | `'--'` | `'--'` | **TypeError** |
| `undefined` | `'--'` | `'--'` | `'--'` | **TypeError** |
| `NaN` | `'--'` | `'--'` | `'--'` | `'NaN'` |
| `Infinity` | `'--'` | `'--'` | `'--'` | `'Infinity'` |
| `-Infinity` | `'--'` | `'--'` | `'--'` | `'-Infinity'` |
| `decimals < 0` | 钳制为 `0` | 钳制为 `0` | 钳制为 `0` | **RangeError** |
| `decimals > 100` | 钳制为 `20` | 钳制为 `20` | 钳制为 `20` | 正常（超长小数） |
| `decimals = NaN` | 钳制为 `0` | 钳制为 `0` | 钳制为 `0` | **RangeError** |
| `decimals = 2.7` | 截断为 `2` | 截断为 `2` | 截断为 `2` | 正常（忽略小数部分） |

---

## 从原生 toFixed 迁移指南

```typescript
// ─── Before：存在崩溃风险 ────────────────────────────────

// 价格展示 — price 为 null 时页面崩溃
price.toFixed(2)

// 涨跌幅展示 — change 为 undefined 时页面崩溃
change.toFixed(2) + '%'

// 成交额展示 — turnover 为 null 时页面崩溃
turnover.toLocaleString('en-US', { minimumFractionDigits: 2 })

// decimals 传错 — 抛出 RangeError
price.toFixed(-1)


// ─── After：使用 safe-format 安全防护 ────────────────────

import { safeFormatNumber, safeFormatPercent, safeFormatCurrency } from '@finsightv9/safe-format'

safeFormatNumber(price, 2)           // null → '--'
safeFormatPercent(change, 2)         // undefined → '--'
safeFormatCurrency(turnover, 2)      // null → '--'
safeFormatNumber(price, -1)          // decimals 钳制为 0，返回 '3'
```

### 迁移检查清单

- [ ] 全局搜索 `.toFixed(` 调用点
- [ ] 替换为 `safeFormatNumber(value, decimals)`
- [ ] 百分比场景替换为 `safeFormatPercent(value, decimals)`
- [ ] 大额数据场景替换为 `safeFormatCurrency(value, decimals)`
- [ ] 确认 `value` 类型声明为 `number | undefined | null`
- [ ] 检查组件是否需要根据 `DEFAULT_FALLBACK` 显示骨架屏
