---
title: 代码评审报告 · WIP 聚焦评审（2026-07-11）
type: reports
domain: qa
phase: testing
tier: quick-note
status: draft
maintainer: V9 Architecture Team
tags: [qa, audit, report]
version: v1.0.0
last_updated: 2026-07-17
code_version: 2.0.0
change_log:
  - version: v1.0.0
changes: Initial version established
date: 2026-07-17
---

# 代码评审报告 · WIP 聚焦评审（2026-07-11）

> **评审范围**：工作树中 19 个未提交文件 + 未跟踪文件（i18n/UI_TEXT、交易 Store 拆分、数据校验、测试重写）
> **评审角色**：Code Reviewer
> **结论**：? 可提交基础（tsc / audit:atomic / audit:layers 全绿）；发现 4 个 ?? 建议、若干 ?? 改进点，无 ?? 阻断。

---

## 一、门禁状态（提交前硬门槛）

| 门禁 | 命令 | 结果 |
|------|------|------|
| 类型安全 | `tsc:prod` | ? 0 错误（整棵脏树） |
| 原子分层 | `audit:atomic` | ? 0 违规 / 0 警告（133 文件） |
| 跨层调用 | `audit:layers` | ? 0 违规 / 0 警告（865 文件） |
| 颜色令牌 | `lint:colors` | ?? 未跑（建议提交前补跑） |
| 单元测试 | `npm test` | ?? 未跑（建议提交前补跑，尤其 dataLayer.test 3362 行重写） |

> 注：`src/lib/` 与 store→store 的 Facade 依赖均被 `audit:layers` 容忍（0 警告），不阻断提交。

---

## 二、`src/lib/validation.ts`（新增，安全相关）

整体质量高：分层清晰、JSDoc 完整、XSS/脱敏考虑周全，并配套 `dataValidation.test.ts`。

### ?? 建议

**1. `sanitizeObject` 缺循环引用保护（潜在栈溢出）**
Line 360-380：递归遍历对象，但无 `visited` 集合。日志上下文对象常含环引用（如事件对象互指），会触发无限递归 / `RangeError: Maximum call stack size exceeded`。

**Why**：日志记录是高频路径，传入含环对象会使整个日志调用崩溃。
**Suggestion**：用 `WeakSet` 记录已访问对象：
```ts
export function sanitizeObject<T>(obj: T, maxDepth = 5, seen = new WeakSet<object>()): T {
  if (maxDepth < 0 || obj === null || typeof obj !== 'object') return obj
  if (seen.has(obj as object)) return obj  // 或返回 '[Circular]'
  seen.add(obj as object)
  // ...递归时传入 seen
}
```

**2. `formatStockCode` 对非数字输入静默出错**
Line 115-117：`String(code).padStart(6, '0')` 对 `'AAPL'` 返回 `'0AAPL'`、对 `'00700.HK'` 返回 `'000700.HK'`，与 A 股 6 位假设不符。

**Why**：函数签名接受 `string | number` 但语义仅适用于 A 股数字代码，调用方易误用。
**Suggestion**：函数名/注释明确限定 A 股；或加类型守卫 `if (!/^\d+$/.test(String(code))) return String(code)`。

**3. `isSensitiveField` 用 `includes` 导致误判**
Line 340：`'author'.includes('auth') === true`，字段名 `author` 会被当敏感字段脱敏。

**Why**：过度脱敏（低风险，但可能误伤正常字段显示）。
**Suggestion**：短 token（`auth`/`pwd` 等）用精确匹配或词边界；长 token 保留 includes。

**4. `handleBuy` 买入数量缺兜底**
（见 tradingStore 部分第 3 点，同源问题）

### ?? 改进

- **`maskApiKey` / `maskToken` 逻辑重复**（Line 291-307）：提取共享 `maskSecret(s)`。
- **`US_SHARE_CODE_REGEX` 注释不符**：注释写"1-4 位字母"，正则 `[A-Z]{1,5}` 允许 5 位（Line 106-107）。
- **`isValidPercent/Score/Price` 未守 `typeof===number`**：TS 类型约束了编译期，但运行时传 `any` 会做字符串强转（`isValidPrice('5')` 为真）。可加类型断言守卫。

### ?? 亮点
- 配置名校验覆盖 XSS（HTML 标签、危险协议）+ 文件系统敏感字符，防御到位。
- `isValidLlmBaseURL` 先拒危险协议再 `new URL` 校验，顺序是安全的。
- `safeParseNumber` 对 NaN/Infinity/空值均有兜底并支持 clamp，健壮。
- `SENSITIVE_FIELD_NAMES` + `sanitizeObject` 体现日志脱敏意识（LEAK-004）。

---

## 三、`src/store/tradingStore.ts`（Facade 重构）

将单体 Store 拆分为 `watchlistStore / signalAdviceStore / portfolioStore / orderStore` 四个子 Store，本文件退化为**向后兼容 Facade** + 订阅同步。架构模式干净。

### ?? 建议

**1. `isRefreshing` 是死状态**
Line 71 接口声明 + Line 98 初值，但全文件无任何地方将其置 `true`。注释称其为"并发锁"，但 `loadStocks` 未实现并发保护。

**Why**：接口承诺了并发锁能力却未落地，易误导后续维护者。
**Suggestion**：要么在 `loadStocks/loadPortfolio` 入口用 `isRefreshing` 做 `if (get().isRefreshing) return` 守卫，要么删除该字段及注释。

**2. `loadStocks` 无并发保护**
Line 114-131：快速双击"刷新"会并发执行两次 `loadStocks`，各自 `await` 后重复 `set`，可能重复触发 `generateAdviceForStocks`。

**Why**：与上述 `isRefreshing` 意图相关，存在重复副作用风险。
**Suggestion**：用 `isRefreshing` 守卫（见上），或复用 `processingSymbols` 思路的轻量锁。

**3. 买入/卖出数量缺兜底**
Line 199：`advice?.sizing?.action === 'buy' ? advice.sizing.targetShares : 100` —— 若 `action==='buy'` 但 `targetShares` 为 `undefined`，`quantity` 为 `undefined` 传入 `createBuyOrder`。

**Why**：下游可能收到 `undefined` 数量，触发异常或错误下单。
**Suggestion**：改为 `advice?.sizing?.targetShares ?? 100`。

**4. Zustand `subscribe` 未用 selector**
Line 300-328：`useXxxStore.subscribe((state) => {...})` 在子 Store **任意**状态变更时都会触发，而非仅同步字段变更。

**Why**：watchlistStore 若有其它高频字段变更，会频繁 `useTradingStore.setState` 造成无谓重渲染。
**Suggestion**：若已装 `subscribeWithSelector` 中间件，改用 `subscribe(s => s.stocks, stocks => setState({stocks}))`；否则可接受（当前子 Store 字段不多）。

### ?? 改进

- **冗余同步**：`loadStocks` 内 `set({stocks})`（Line 123）与 watchlist 订阅 `set({stocks})`（Line 301）重复，幂等但浪费，可保留订阅、移除 loadStocks 内直接 set。
- **文档补充**：`store→store` 的 Facade 委托被 `audit:layers` 容忍，但 `../../AGENTS.md` §一未提及。建议在 ../../AGENTS.md 注明"Store 间 Facade 委托允许，禁止反向或环状依赖"。

### ?? 亮点
- `handleBuy/handleSell` 用 `processingSymbols` Set 做同 symbol 并发锁，`finally` 中必清理 —— 买入/卖出的并发防护写得很稳。
- `loadPortfolio` 有完整 try/catch，失败写入子 Store error 并回退 Facade 状态。
- `withBroadcast(EVENT_NAMES.ORDERS_CHANGED, ...)` 保持跨 Tab 订单同步，符合项目约定。
- `initTradingStoreFacadeSync` 用模块级单例 + 清理函数，防重复订阅、初始同步一次，生命周期管理正确。
- `tradingStore.test.ts` 随重构同步更新（mock `portfolioService.loadPortfolioInput`），测试维护到位。

---

## 四、`src/constants/uiText/`（i18n 文案抽取）

将 1192 行单文件拆为 6 模块 + barrel，保持原 API 兼容。cockpit widget 已切换引用 `UI_TEXT.analysis.hotSector.noData` / `valuePit.noData`（已核实路径存在）。

### ?? 改进
- 建议新增 lint 规则或 CI 检查，确保**新增用户可见文案**走 `UI_TEXT` 而非硬编码，避免回流。
- `src/constants/uiText/` 是目录，但 `../../AGENTS.md` 只写了 `src/constants/` 单层 —— 非问题，仅提示文档可细化。

---

## 五、`src/lib/` 分层说明

`src/lib/` 含 `a11y / precision / timeUtils / xssSanitizer / dataValidation`（本次新增）。虽不在 `../../AGENTS.md` 标准分层（库函数应在 `src/lib/`），但属既有目录且 `audit:layers` 0 警告容忍。

**Suggestion**：二选一 ——
1. 在 `../../AGENTS.md` §一显式列出 `src/lib/` 作为库函数层（与 `src/lib/` 并存或合并）；
2. 规划将 `src/utils/*` 迁入 `src/lib/`，消除双库目录。

---

## 六、提交前建议清单

- [ ] 处理 `dataValidation.sanitizeObject` 循环引用保护（?? 最高优先，日志高频路径）
- [ ] 处理 `isRefreshing` 死状态 或 落地并发守卫（??）
- [ ] `handleBuy` 数量兜底 `?? 100`（??）
- [ ] 跑 `lint:colors` 确认无新增颜色硬编码
- [ ] 跑 `npm test` 确认 dataLayer.test 等重写后全绿
- [ ] （可选）`../../AGENTS.md` 补充 `src/lib/` 与 store→store Facade 约定

> 以上 ?? 阻断项：无。建议修复 ?? 项后再提交，或作为 follow-up 提交并关联 issue。

---

## 七、修复状态（2026-07-12）

用户确认「继续修复」，已落地全部 ?? 建议并验证通过。

| # | 问题 | 文件 | 修复 |
|---|------|------|------|
| ??1 | `sanitizeObject` 循环引用栈溢出 | dataValidation.ts | 增加 `WeakSet` 循环引用保护 + 回归测试 |
| ??2 | `formatStockCode` 非数字静默出错 | dataValidation.ts | 非纯数字原样返回 |
| ??3 | `isSensitiveField` 误判 | dataValidation.ts | 词边界正则，避免 `author`→`auth` |
| ??4 | `handleBuy` 数量无兜底 | tradingStore.ts | `targetShares ?? 100` |
| ??5 | `isRefreshing` 死状态 | tradingStore.ts | 落地为 4 个 loader 的并发守卫（finally 复位）|
| ?? | `maskApiKey`/`maskToken` 重复 | dataValidation.ts | 提取 `maskSecret` 共享 |
| ?? | US 正则注释不符 | dataValidation.ts | 注释修正 |
| ?? | 数值校验无 typeof 守卫 | dataValidation.ts | 增加 `typeof !== 'number' \|\| isNaN` |

**验证结果**：`tsc:prod` ? 0 错误 · 测试 46 全过 · `audit:atomic` ? 0 · `audit:layers` ? 0 · `lint:colors`(改动文件) ? 干净。

**未处理（原 ?? nit，本次保留）**：Zustand subscribe 未用 selector、loadStocks 冗余 set、`src/lib/` 未入 AGENTS.md 分层文档。
