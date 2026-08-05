# @finsightv9/safe-format — TypeScript 类型定义与使用场景文档

> **包版本**：1.0.1  
> **类型声明文件**：`dist/index.d.ts` + `dist/index.d.cts`（CJS 环境自动使用）  
> **导入方式**：ESM `import` / CJS `require` 均受支持  
> **零运行时依赖**：包总大小 < 2 KB

---

## 目录

1. [包导出全景](#一包导出全景)
2. [常量 `DEFAULT_FALLBACK`](#二常量-default_fallback)
3. [函数 `safeFormatNumber`](#三函数-safeformatnumber)
4. [函数 `safeFormatPercent`](#四函数-safeformatpercent)
5. [函数 `safeFormatCurrency`](#五函数-safeformatcurrency)
6. [默认导出对象](#六默认导出对象)
7. [导入方式速查](#七导入方式速查)
8. [业务场景映射表（FinSightV9 实战）](#八业务场景映射表finsightv9-实战)
9. [与原生 `toFixed` 的类型兼容性](#九与原生-tofixed-的类型兼容性)
10. [FAQ：常见类型问题排查](#十faq常见类型问题排查)

---

## 一、包导出全景

TypeScript 项目直接从 `@finsightv9/safe-format` 导入时，语言服务（LSP）会
自动解析到 `package.json → exports.".".types` 指向的 `dist/index.d.ts`。

**所有导出符号总览**：

```typescript
// ── 具名导出（推荐） ────────────────────────────────────────────────
export const DEFAULT_FALLBACK: "--";
export function safeFormatNumber(
  value: number | undefined | null,
  decimals: number,
  fallback?: string,
): string;
export function safeFormatPercent(
  value: number | undefined | null,
  decimals?: number,
  fallback?: string,
): string;
export function safeFormatCurrency(
  value: number | undefined | null,
  decimals?: number,
  fallback?: string,
): string;

// ── 默认导出（向后兼容） ─────────────────────────────────────────────
declare const _default: {
  safeFormatNumber: typeof safeFormatNumber;
  safeFormatPercent:  typeof safeFormatPercent;
  safeFormatCurrency: typeof safeFormatCurrency;
};
export default _default;
```

**类型特性**：
- `fallback` 参数一律可选（有重载默认值），返回类型固定为 `string`
- `decimals` 在 `safeFormatPercent` / `safeFormatCurrency` 中也是可选的（默认 2）
- `safeFormatNumber` 的 `decimals` 是**必传**，避免调用方忘记指定精度
- 全部参数接受 `number | undefined | null`；使用时**无需前置空值判断**，类型系统也不会强制你收窄为 `number`

---

## 二、常量 `DEFAULT_FALLBACK`

### 类型签名
```typescript
export const DEFAULT_FALLBACK: "--";
// 实际 JS 值：字符串字面量 "--"，类型被收窄为字面量类型 "--" 而非宽泛 string
```

### 使用场景

**S1 — 自定义占位符与默认占位符保持一致**  
当你需要把兜底值和 UI 判断（`=== "--"`）绑定时，建议直接引用常量而非硬编码，
避免未来版本更改占位符字面量导致业务判断失效：

```typescript
import { safeFormatNumber, DEFAULT_FALLBACK } from "@finsightv9/safe-format";

function renderPrice(price?: number) {
  const text = safeFormatNumber(price, 2);
  return (
    <span className={text === DEFAULT_FALLBACK ? "text-muted" : "text-price"}>
      {text}
    </span>
  );
}
```

**S2 — 多语言（i18n）替换**  
产品在海外市场需要把 `--` 改为 `N/A` 或 `--`，可把 DEFAULT_FALLBACK
作为"未本地化兜底值"的基准：

```typescript
const I18N_FALLBACK = {
  "zh-CN": "--",
  "en-US": "N/A",
  "ja-JP": "-",
} as const;

function formatLocalized(value: number | null | undefined, decimals: number, locale: keyof typeof I18N_FALLBACK) {
  return safeFormatNumber(value, decimals, I18N_FALLBACK[locale]);
}
```

---

## 三、函数 `safeFormatNumber`

### 类型签名
```typescript
/**
 * 安全格式化数值为指定小数位数字符串。
 *
 * 防御清单（返回 fallback 而非抛错）：
 *   ✓ value === undefined
 *   ✓ value === null
 *   ✓ Number.isNaN(value)
 *   ✓ value === ±Infinity
 *   ✓ decimals < 0          → 钳制为 0
 *   ✓ decimals > 20         → 钳制为 20
 *   ✓ !Number.isInteger(decimals)  → Math.trunc 截断
 *   ✓ Number.isNaN(decimals)       → 当作 0
 *
 * @param value    待格式化数值（null/undefined 安全）
 * @param decimals 小数位数（必填，范围 0–20，内部钳制）
 * @param fallback 无效值时返回的兜底字符串，默认 "--"
 * @returns 格式化字符串；异常输入保证返回字符串永不抛错
 */
export function safeFormatNumber(
  value: number | undefined | null,
  decimals: number,
  fallback?: string,
): string;
```

### 使用场景

**S1 — 股票/指数价格显示（小数位固定 2）**  
对应组件：`WatchlistWidget.tsx`、`MarketIndicesWidget.tsx`、`BacktestPage.tsx`

```typescript
import { safeFormatNumber } from "@finsightv9/safe-format";

// 后端返回的行情字段可能在非交易时段为 null
interface MarketQuote {
  symbol: string;
  price: number | null;       // 非交易时段：null
  high?: number;              // 可能缺失（undefined）
  low?: number;
}

function renderQuote(q: MarketQuote) {
  return {
    price: safeFormatNumber(q.price, 2),          // null → "--"
    high:  safeFormatNumber(q.high, 0),           // undefined → "--"
    low:   safeFormatNumber(q.low, 0, "-"),       // 自定义兜底
  };
}
```

**S2 — 置信度/评分（0–100 或 0–1 范围）**  
对应组件：`ExecutionPlanCard.tsx`、`CoreResourcePanel.tsx`、`TradingApp.tsx`

```typescript
interface TradeAdvice {
  confidence: number;         // 0–1 小数
  score: number;              // 0–100 整数
  positionPct: number | null; // 仓位比例，未计算时为 null
}

function renderAdvice(a: TradeAdvice) {
  console.log(
    `置信 ${safeFormatNumber(a.confidence * 100, 0)}%`  +  // 0.87 → "87%"
    ` / 评分 ${safeFormatNumber(a.score, 2)}`           +  // 85.4 → "85.40"
    ` / 仓位 ${safeFormatNumber(a.positionPct * 100, 1)}%` // null * 100 = NaN → "--"
  );
}
```

**S3 — 回测指标（小数位 1 或 2，可能 ±Infinity）**  
对应组件：`BacktestPage.tsx`

```typescript
interface BacktestMetrics {
  sharpeRatio: number;        // 若序列太短计算失败可能是 NaN/Infinity
  winRate: number | null;     // 无交易 → null
  maxDrawdown: number | undefined;
}

function metricsSummary(m: BacktestMetrics) {
  return {
    夏普比率: safeFormatNumber(m.sharpeRatio, 2, "—"),    // Infinity → "—"
    胜率:    `${safeFormatNumber(m.winRate, 2)}%`,        // null → "--%"
    最大回撤: `${safeFormatNumber(m.maxDrawdown, 2)}%`,   // undefined → "--%"
  };
}
```

**S4 — 类型守卫组合用法**  
当你需要对有效值做进一步运算，对无效值做 UI 降级：

```typescript
const raw: number | null = fetchPrice();
const fmt = safeFormatNumber(raw, 2);
if (fmt !== DEFAULT_FALLBACK) {
  // 此作用域内 raw 可被安全断言为有效 number
  const doubled = (raw as number) * 2;
  console.log("翻倍：", safeFormatNumber(doubled, 2));
}
```

---

## 四、函数 `safeFormatPercent`

### 类型签名
```typescript
/**
 * 安全格式化为百分比字符串，正数自动加 `+` 前缀。
 *
 *   safeFormatPercent( 3.14, 2)   → "+3.14%"
 *   safeFormatPercent(-3.14, 2)   → "-3.14%"
 *   safeFormatPercent( 0,    2)   →  "0.00%"    (零无前缀)
 *   safeFormatPercent( null, 2)   →  "--"
 *
 * 防御清单：同 safeFormatNumber（null/undefined/NaN/±Infinity/越界 decimals）
 *
 * @param value    百分比的数值部分（例如 1.5 表示 +1.50%）
 * @param decimals 小数位数，默认 2
 * @param fallback 无效值兜底字符串，默认 "--"
 * @returns 带 % 后缀、正数带 + 前缀的字符串；异常输入返回 fallback（不带 %）
 */
export function safeFormatPercent(
  value: number | undefined | null,
  decimals?: number,   // 默认 2
  fallback?: string,   // 默认 "--"
): string;
```

### 与 `safeFormatNumber` 的类型差异点

- `decimals` 是可选（默认 2），因为百分比在 90% 场景下就是两位小数
- 有效值**一定带 `%` 后缀**，无效值**不带 `%` 后缀**（避免 "–%" 视觉污染），
  这意味着类型层面虽然两者都返回 `string`，但 UI 端做条件判断时可直接检查是否含 `%`：
  ```typescript
  const pctText = safeFormatPercent(data.changePercent, 2);
  const isMissing = !pctText.endsWith("%");   // 仅在 fallback 时为 true
  ```

### 使用场景

**S1 — 个股涨跌幅**  
对应组件：`WatchlistWidget.tsx`、`StockPriceChange.tsx`、`MarketIndicesWidget.tsx`

```typescript
type MarketCap = "large" | "mid" | "small";
interface StockRow {
  changePercent: number | null;   // 停牌 → null
  marketCap: MarketCap;
}

// A股主板 ST 股 ±5%，创业板 ±20%，科创板 ±20%，北交所 ±30%
// safeFormatPercent 统一格式化，不用关心上限
function renderChange(row: StockRow) {
  const text = safeFormatPercent(row.changePercent, 2);
  const cls = text.startsWith("+") ? "text-up"
            : text.startsWith("-") ? "text-down"
            : "text-muted";
  return <span className={cls}>{text}</span>;
}
```

**S2 — 风控指标（VaR / 最大回撤）**  
对应组件：`RiskControlPanel.tsx`

```typescript
interface RiskMetrics {
  var95: number;                 // 95% VaR，通常为 -X%（负值）
  maxDrawdown: number | null;    // 还没发生任何交易 → null
  sharpeRatio: number;           // 已由 safeFormatNumber 负责展示
}

function renderRisk(m: RiskMetrics) {
  return (
    <>
      <p>VaR(95%)：{safeFormatPercent(m.var95, 2)}</p>   // -2.34 → "-2.34%"
      <p>最大回撤：{safeFormatPercent(m.maxDrawdown)}</p> // 默认小数位 2 → null → "--"
    </>
  );
}
```

**S3 — 胜率/盈亏比（来自 Trade Review 报告）**  
对应组件：`TradeReviewPage.tsx`

```typescript
interface Discipline {
  planAdherenceRate: number | undefined;      // 报告不完整 → undefined
  stopLossExecutionRate: number;
  overallScore: number;
}

function disciplineBadges(d: Discipline) {
  return [
    `计划遵守率 ${safeFormatPercent(d.planAdherenceRate, 1, "N/A")}`,   // undefined → "N/A"
    `止损执行率 ${safeFormatPercent(d.stopLossExecutionRate, 1)}`,       // 87.5 → "+87.5%" (正数自动加 +)
  ];
}
```

**S4 — 小数位为 0 的百分比（市场情绪）**  
对应组件：`MarketSentimentWidget.tsx`

```typescript
// 上涨股票数 / 总股票数 → 整数百分比即可
const upRatio = (sentiment.up / sentiment.totalStocks) * 100;
const downRatio = (sentiment.down / sentiment.totalStocks) * 100;
console.log(`上涨 ${safeFormatPercent(upRatio, 0)} 下跌 ${safeFormatPercent(downRatio, 0)}`);
// 上涨 +58% 下跌 -37%
```

---

## 五、函数 `safeFormatCurrency`

### 类型签名
```typescript
/**
 * 安全格式化金额（带千分位分隔符）。
 *
 * 基于 Intl.NumberFormat('en-US')，默认小数位 2。
 * 防御清单：与 safeFormatNumber 完全一致（null/undefined/NaN/±Infinity/越界 decimals）。
 *
 *   safeFormatCurrency(1234567.89, 2)  → "1,234,567.89"
 *   safeFormatCurrency(null,           2)  → "--"
 *
 * 注意：此函数**不附加货币符号**（$ / ¥ / € / ₹）。
 * 需要货币符号时请在结果前拼接，或使用 `Intl.NumberFormat(locale, { style: 'currency', currency })`。
 *
 * @param value    金额（null/undefined 安全）
 * @param decimals 小数位数，默认 2
 * @param fallback 无效值兜底字符串，默认 "--"
 * @returns 带千分位分隔符的字符串；异常输入返回 fallback
 */
export function safeFormatCurrency(
  value: number | undefined | null,
  decimals?: number,   // 默认 2
  fallback?: string,   // 默认 "--"
): string;
```

### 使用场景

**S1 — 投资组合总资产（A股用 ¥ 前缀）**  
FinSightV9 的组合/回测模块展示净值时需要千分位提升可读性：

```typescript
interface Portfolio {
  totalAssets: number | null;    // 未核算 → null
  realizedPnL: number;
  unrealizedPnL: number | undefined;
}

const CN_PREFIX = "¥";
function portfolioSummary(p: Portfolio) {
  return (
    <Card>
      <Stat label="总资产"
            value={`${CN_PREFIX} ${safeFormatCurrency(p.totalAssets, 2)}`} />
      {/* null → "¥ --" 而非直接 --，视觉上保持前缀一致性 */}

      <Stat label="已实现盈亏"
            value={`${p.realizedPnL >= 0 ? "+" : ""}${CN_PREFIX} ${safeFormatCurrency(Math.abs(p.realizedPnL), 2, "0.00")}`} />
      {/* 盈亏项保留符号逻辑在外部，格式化专注于千分位 */}
    </Card>
  );
}
```

**S2 — 回测交易明细中的成交金额**  
对应组件：`BacktestPage.tsx` 交易表格

```typescript
interface TradeRow {
  price: number;
  shares: number;
  notional?: number;   // price * shares（后端可能缺省，前端需要自算）
}

function renderTradeRow(row: TradeRow) {
  const notional = row.notional ?? row.price * row.shares;
  return (
    <td>{safeFormatCurrency(notional, 2)}</td>
    // 10000 股 × 12.34 元 → "123,400.00"
  );
}
```

**S3 — 行业报告中的市场规模（大数展示）**  
对应组件：`IndustryV4Radar.tsx`、`SubIndicatorBar.tsx`

```typescript
// 市场规模数字可能到 10 位数（万亿级别），原生 .toLocaleString 就能处理
const marketSize = 12_345_678_901;   // 123.45 亿人民币
const axisLabel =
  `市场规模 ¥${safeFormatCurrency(marketSize, 0)}`;
// → "市场规模 ¥12,345,678,901"
```

**S4 — 与国际化（多币种）组合**  
真实业务中多币种格式化建议走原生 `Intl`，空值保护仍交给 safe-format：

```typescript
const CURRENCY_FMT: Record<string, Intl.NumberFormat> = {
  "CNY": new Intl.NumberFormat("zh-CN", { style: "currency", currency: "CNY", maximumFractionDigits: 2 }),
  "USD": new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }),
  "HKD": new Intl.NumberFormat("zh-HK", { style: "currency", currency: "HKD", maximumFractionDigits: 2 }),
};

function safeFormatMoney(value: number | null | undefined, currency: keyof typeof CURRENCY_FMT) {
  // 先做空值检查，再委派给带币种符号的 Intl
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return DEFAULT_FALLBACK;
  }
  return CURRENCY_FMT[currency].format(value);
}
```

---

## 六、默认导出对象

为了兼容老代码中的 `import fmt from "@finsightv9/safe-format"` 用法，
包同时提供默认导出对象。其类型与具名导出完全等价：

```typescript
declare const _default: {
  safeFormatNumber: (v: number | null | undefined, d: number, fb?: string) => string;
  safeFormatPercent:  (v: number | null | undefined, d?: number, fb?: string) => string;
  safeFormatCurrency: (v: number | null | undefined, d?: number, fb?: string) => string;
};
export default _default;
```

### 使用示例
```typescript
import fmt from "@finsightv9/safe-format";

fmt.safeFormatNumber(42, 2);      // "42.00"
fmt.safeFormatPercent(1.5, 1);    // "+1.5%"
fmt.safeFormatCurrency(1000, 2);  // "1,000.00"
```

> ⚠️ **Tree-shaking 提示**：生产打包工具（Vite/webpack/Rollup）在 ESM 模式下，
> 具名导入只会打包被用到的 1 个函数（~400 B）；默认导出会把整个对象图打包进来（~1 KB）。
> 新代码一律推荐具名导入。

---

## 七、导入方式速查

### A. ESM / TS（React、Vite、Next.js、ts-node --esm）
```typescript
import {
  safeFormatNumber,
  safeFormatPercent,
  safeFormatCurrency,
  DEFAULT_FALLBACK,
} from "@finsightv9/safe-format";
```

### B. CJS / require（Node <14、Jest、老版 webpack）
```javascript
const { safeFormatNumber, safeFormatPercent, safeFormatCurrency } = require("@finsightv9/safe-format");
```

### C. CJS 默认导出
```javascript
const fmt = require("@finsightv9/safe-format").default;
// 或直接：const fmt = require("@finsightv9/safe-format");   ✅ tsup 已配置 __esModule
fmt.safeFormatNumber(null, 2);   // "--"
```

### D. 动态 import（按需加载）
```typescript
async function renderReport(report: TradeReview) {
  const { safeFormatPercent, safeFormatNumber } = await import("@finsightv9/safe-format");
  return (
    <div>
      胜率 {safeFormatPercent(report.winRate)}
      评分 {safeFormatNumber(report.disciplineScore, 1)}
    </div>
  );
}
```

---

## 八、业务场景映射表（FinSightV9 实战）

下表展示了本包 3 个导出函数在 FinSightV9 项目中的**实际覆盖场景**，
可作为你选型时的决策参考：

| 场景 | 字段 | 推荐函数 | decimals | fallback |
|------|------|----------|:--------:|:--------:|
| 股票价格 / 指数点位 | `price` / `high` / `low` | `safeFormatNumber` | 2 或 0（低价股） | `"--"` |
| 个股涨跌幅 | `changePercent` | `safeFormatPercent` | 2 | `"--"` |
| 板块涨跌幅度 | `sector.pctChange` | `safeFormatPercent` | 1 | `"--"` |
| 置信度（×100 后） | `confidence * 100` | `safeFormatNumber` | 0 | `"--"` |
| 策略评分（0–100） | `score` / `disciplineScore` | `safeFormatNumber` | 1 或 2 | `"--"` |
| 仓位比例 | `positionPct * 100` | `safeFormatNumber` | 1 | `"--"` |
| 回测 夏普比率 | `sharpeRatio` | `safeFormatNumber` | 2 | `"—"`（长线 mdash） |
| 回测 胜率 / VaR / 最大回撤 | `winRate` / `var95` / `maxDrawdown` | `safeFormatPercent` | 2 | `"--"` |
| 风控指标 | `planAdherenceRate` 等 | `safeFormatPercent` | 1 | `"N/A"` |
| 组合总资产 / 持仓市值 | `totalAssets` / `marketValue` | `safeFormatCurrency` | 2 | `"--"`，前面拼 `¥` |
| 单笔交易成交金额 | `price * shares` | `safeFormatCurrency` | 2 | `"0.00"`（占位 0） |
| 行业报告中的市场规模 | `marketSize` | `safeFormatCurrency` | 0 | `"--"` |
| 交易复盘：盈亏金额 | `totalPnL` | `safeFormatCurrency` | 2 | `"--"` |

---

## 九、与原生 `toFixed` 的类型兼容性

当你需要把 legacy 代码迁移到 safe-format 时，只需做最小化替换；类型 100% 兼容：

```typescript
// ── 旧写法 ──────────────────────────────────────────────
// ❌ 空值时报 TypeError
// ❌ Infinity 时输出 "Infinity"
// ❌ decimals <0 或 >100 时 RangeError
const bad = (value ?? null)!.toFixed(2);

// ── 新写法 ──────────────────────────────────────────────
// ✅ 类型层面仍接受 number | null | undefined
// ✅ 返回仍是 string（下游 JSX / 拼接零改动）
// ✅ null / undefined / NaN / Infinity → "--"
const good = safeFormatNumber(value, 2);
```

**`safeFormatNumber(value, 2) === value!.toFixed(2)` 当且仅当**：
- `Number.isFinite(value) === true`（有效值），并且
- `decimals` 是整数且在 `[0, 20]` 之间

---

## 十、FAQ：常见类型问题排查

### Q1. TS2345: Argument of type `string` is not assignable to `number | null | undefined`
> 你传入了字符串（比如 HTML input 的 `event.target.value`）。请先用 `Number(v)` 解析：
> ```typescript
> const input: string = "123.45";
> safeFormatNumber(Number(input), 2);   // ✅ 转换类型后再传
> ```

### Q2. 为什么 `safeFormatNumber` 的 decimals 是必填，而其他两个是可选？
> 设计原则：`safeFormatPercent` / `safeFormatCurrency` 90% 的业务场景默认就是 2 位小数，
> 给默认值能显著降低调用心智负担。而 `safeFormatNumber` 的用途跨度极大（整数价格、4 位外汇报价、1 位评分…），
> 强制指定 decimals 可以避免调用方忘记写精度，得到诸如 `"3"` 而不是业务想要的 `"3.00"` 的隐性 bug。

### Q3. `noUncheckedIndexedAccess` 开启后访问数组元素得到 `number | undefined`，能直接传吗？
> 可以！这正是本包的设计目的之一：
> ```typescript
> const xs: number[] = [1, 2, 3];
> safeFormatNumber(xs[5], 2);   // ✅ xs[5] 是 number | undefined → 直接传，返回 "--"
> ```

### Q4. 为什么 `safeFormatPercent(null, 2)` 返回 `"--"` 而不是 `"--%"`？
> 业务 UI 设计决定：无效值时只显示占位符，不显示百分号，避免出现视觉上误导的 `"–%"` 或 `"N/A%"`。
> 如果你的项目希望无效值也带 %，可以在 fallback 本身里写：
> ```typescript
> safeFormatPercent(null, 2, "--%");   // 按你的项目 UI 定
> ```

### Q5. 如何在 CJS 项目中拿到正确的 `.d.cts` 类型？
> tsconfig 的 `moduleResolution` 为 `node16` / `nodenext` 时 TypeScript 会自动根据调用方
> 环境（`.cts` 文件或 `require()`）选择 `dist/index.d.cts`；普通 `bundler` 模式下两者都会
> 回落到 `dist/index.d.ts`（ESM 类型），但函数签名完全一致，不会出现类型差异。

---

*文档版本：1.0.1 — 与 `@finsightv9/safe-format@1.0.1` 同步发布*
