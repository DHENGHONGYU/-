# AGENTS.md — V9 智能投研复盘系统 AI 行为约束契约

> **版本**: v1.3.4 | **日期**: 2026-07-06
> **适用范围**: 所有 AI 辅助开发工具（Claude Code、Cursor、Trae 等）
> **强制等级**: 所有 AI 生成的代码必须遵守以下约束

---

## 一、项目分层规则（禁止跨层调用）

```
src/config/       ← 配置层（零硬编码锚点）
src/core/         ← 核心工具与类型守卫（DataBridge/ACL/Envelope/MemoryCache/EventBus）
src/data/         ← 数据层（IndexedDB/dataLayer/queryBuilder/types）
src/lib/          ← 库函数（logger/format/errors/utils/localStorageManager）
src/services/      ← 服务层（20个子域：analysis/scoring/fetcher/news/llm/trading/execution/...）
src/store/        ← 状态层（47个Zustand Store + helpers/withBroadcast）
src/pages/        ← 页面层（5舱：input/analysis/trading/output/command）
src/components/   ← 组件层（ui/cabin/chart/pool/news/strategy/...）
src/portal/       ← PortalShell 舱室入口层
src/constants/    ← 常量层（零硬编码锚点）
```

### 依赖方向规则

- `pages/` 和 `components/` → 只能依赖 `store/` 和 `services/`，禁止直接调用 `dataLayer` 或 `db`
- `store/` → 只能依赖 `services/` 和 `core/`
- `services/` → 只能依赖 `core/`、`data/` 和 `lib/`（仅限基础设施），禁止直接写 `db`（通过 `DataBridge.forward()`）
  - **lib 基础设施白名单**：`logger`、`withBroadcast`、`eventBus`、`format`、`errors`、`utils`、`localStorageManager`、`safeCoerce`
  - 禁止依赖 `lib/` 中的业务模块
- `lib/` → 仅可依赖 `core/` 和 `config/`，禁止依赖 `services/`、`store/`、`pages/`、`components/`、`apps/`
- `core/` → 禁止依赖 `pages/`、`components/`、`apps/`、`lib/`
- `config/` → 禁止依赖 `services/`、`pages/`、`components/`、`lib/`
- `constants/` → 禁止依赖任何运行时模块（仅导出常量，可被所有层引用）
- `types/` → 零依赖（纯类型定义，可被所有层引用）
- `agents/` → 仅可依赖 `core/` 和 `data/`（属于 core 层扩展）

### 验证命令

```powershell
npm run audit:layers
# 期望：0 violations, 0 warnings
```

---

## 二、四步集成编码契约

新模块严禁直接在 `/views` 或 `/pages` 目录下新建 `.vue` 或 `.tsx` 文件并孤立运行，必须按以下四步顺序集成：

1. **类型定义** → 在 `src/types/modules/` 或 `src/data/types.ts` 中定义 Interface
2. **Store/状态** → 在 `src/store/` 中创建 Zustand Store，通过 `withBroadcast` 实现跨 Tab 广播
3. **Builder/适配层** → 在 `src/services/` 中创建 Service，通过 DataBridge 写入数据
4. **核心集成** → 在 `src/pages/` 或 `src/components/` 中创建 UI，仅通过 Store 获取数据

每步可独立回滚，完成后运行 `npx tsc --noEmit` 验证类型安全。

**回滚验证流程**：
- 回滚后必须执行 `npx tsc --noEmit` 验证类型安全
- 回滚后必须执行 `npm run audit:docs` 检查文档同步状态
- 若回滚涉及接口签名变更，必须更新 `docs/06-routing-specs.md` 或相关数据字典
- 回滚后必须执行 `npm run audit:layers` 确认无跨层调用违规
- 回滚后必须执行 `npm run test -- --run` 确认单元测试通过

---

## 三、代码风格约束

### 类型安全

- 禁止使用 `any`（ESLint `@typescript-eslint/no-explicit-any: error`）
- 禁止使用 `@ts-ignore`（使用 `@ts-expect-error` 并附带注释说明原因）
- 所有数据结构必须先定义 TypeScript Interface
- 复杂泛型必须有 `Expect<Equals>` 类型测试（位于 `tests/__tests__/types/`）
- 修改 `UserType` 不得破坏 `user-type.spec.ts`

### 零硬编码

- 引擎层：所有阈值、权重、公式参数必须从 `src/services/scoring/v6-engine/config.ts` 注入
- UI 层：所有颜色值必须引用 `src/constants/` 中的常量，禁止直接使用 HEX 或 Tailwind 数字颜色类
- 组件层：禁止魔法数字（3位以上数字需提取为 const 或 config）

### 日志规范

- 核心分支（filter reset、modal submission、data fusion）必须有 `logger.info` 打印
- 日志前缀格式：`[模块名] 操作名`，如 `[DataBridge] routeToDB() completed`
- 错误日志必须包含 context 对象：`logger.error('操作失败', { error: message })`

### 事件监听清理

- 所有 `useEffect` 中的事件监听必须在 cleanup 中显式移除
- `EventBus.subscribe()` 必须配对 `EventBus.unsubscribe()`
- 测试中使用 `vi.useFakeTimers()` 必须在 `afterEach` 中 `vi.useRealTimers()`

**标准清理模板**（v1.3.1 新增）：

```typescript
// ✅ 模板 1：EventBus 订阅清理
useEffect(() => {
  const handler = (data: unknown) => { /* 处理逻辑 */ }
  EventBus.subscribe('eventName', handler)
  return () => EventBus.unsubscribe('eventName', handler)
}, [])

// ✅ 模板 2：DOM 事件监听清理
useEffect(() => {
  const handler = (e: Event) => { /* 处理逻辑 */ }
  window.addEventListener('resize', handler)
  return () => window.removeEventListener('resize', handler)
}, [])

// ✅ 模板 3：定时器清理
useEffect(() => {
  const timerId = setInterval(() => { /* 定时任务 */ }, 1000)
  return () => clearInterval(timerId)
}, [])

// ✅ 模板 4：多个监听器批量清理
useEffect(() => {
  const cleanupFns: Array<() => void> = []
  
  cleanupFns.push(EventBus.subscribe('event1', handler1))
  cleanupFns.push(EventBus.subscribe('event2', handler2))
  cleanupFns.push(() => window.removeEventListener('scroll', scrollHandler))
  
  return () => cleanupFns.forEach(fn => fn())
}, [])

// ❌ 禁止：在 cleanup 中使用 EventBus.clear()（会影响其他订阅者）
```

### 颜色令牌规范（v2.0.0 新增）

> **核心原则**：所有颜色值必须通过令牌系统引用，禁止在 `src/components/`、`src/pages/`、`src/cockpit/`、`src/apps/` 中直接书写 HEX 值或 Tailwind 颜色类名。

#### 3.5.1 令牌层次结构（4 层）

| 层级 | 导出文件 | 用途 | 消费方 |
|------|---------|------|--------|
| **L1 基础令牌** | `src/constants/theme.tokens.ts` → `THEME_TOKENS` | 通用语义色 + 尺寸/间距/圆角/排版/图标尺寸/控件尺寸 | 所有 UI 层 |
| **L2 语义令牌** | `src/constants/theme.tokens.ts` → `COLOR_TOKENS` | 业务语义色（涨跌/评分/因子/信号/背景/文字/边框） | 所有 UI 层 |
| **L3 色阶令牌** | `src/constants/theme.tokens.ts` → `COLOR_SHADES` + `twText/twBg/twBorder` | 需要特定色阶时（如 `red-600`、`blue-50`） | 组件层 |
| **L4 图表令牌** | `src/config/chartColors.ts` | 图表/热力图/轮动图专用配色 | 图表组件 |

**THEME_TOKENS 完整结构**：
```typescript
THEME_TOKENS = {
  color: { info, warning, success, destructive, muted, border, ... },
  iconSizes: { xs, sm, md, lg, xl },
  controlSizes: { xs, sm, md, lg },
  spacing: { xs, sm, md, lg, pxSm, pxMd, pxLg, pySm, pyMd, pyLg },
  radius: { sm, md, lg, full },
  gap: { xs, sm, md, lg, xl },
  stackGap: { xs, sm, md, lg, xl },
  score: { excellent, good, ok },
  focusVisible: { ringWidth, ringColor, ringOffset, ringOffsetColor },
  typography: {
    fontSize: { xs, sm, base, lg, xl, '2xl', '3xl', '4xl' },
    fontWeight: { normal, medium, semibold, bold },
    lineHeight: { none, tight, snug, normal, relaxed, loose },
    letterSpacing: { tighter, tight, normal, wide, wider, widest }
  }
}
```

#### 3.5.2 场景化使用规则

**场景 A：通用状态色（信息/警告/成功/错误）**

```typescript
// ✅ 使用 THEME_TOKENS.color
import { THEME_TOKENS } from '@/constants/theme.tokens'

<span className={THEME_TOKENS.color.info}>提示文本</span>        // text-blue-500
<div className={THEME_TOKENS.color.warningBg}>警告背景</div>      // bg-amber-500
<span style={{ color: THEME_TOKENS.color.successRaw }}>成功</span> // #22c55e
```

**场景 B：股票涨跌 / 评分等级 / 信号分级**

```typescript
// ✅ 使用 COLOR_TOKENS
import { COLOR_TOKENS } from '@/constants/theme.tokens'

<span className={COLOR_TOKENS.up.tailwind}>+3.2%</span>           // text-red-500
<div className={COLOR_TOKENS.scoreHigh.bgClass}>高分</div>         // bg-green-500
<span style={{ color: COLOR_TOKENS.signalWeak.hex }}>弱信号</span> // #f59e0b
```

**场景 C：需要特定色阶（如浅色背景 `bg-red-50`、深色文字 `text-red-700`）**

```typescript
// ✅ 使用 COLOR_SHADES
import { COLOR_SHADES } from '@/constants/theme.tokens'

<div className={COLOR_SHADES.red[50]}>浅红背景</div>              // bg-red-50
<span className={COLOR_SHADES.red[600]}>深红文字</span>            // text-red-600
<div className={COLOR_SHADES.blue[100]}>浅蓝背景</div>            // bg-blue-100

// ✅ 或使用辅助函数（当 COLOR_SHADES 未覆盖所需色阶时）
import { twText, twBg, twBorder } from '@/constants/theme.tokens'

<span className={twText('red', 600)}>深红</span>                  // text-red-600
<div className={twBg('blue', 50)}>浅蓝</div>                     // bg-blue-50
<div className={twBorder('gray', 200)}>灰边框</div>               // border-gray-200
```

**场景 D：图表/热力图/轮动图（需要 HEX 色值）**

```typescript
// ✅ 使用 chartColors.ts 中的业务配色
import { PIE_CHART_PALETTE, ROTATION_FACTOR_COLORS } from '@/config/chartColors'

<RechartsPie data={data} colors={PIE_CHART_PALETTE} />
<LineChart lineColor={ROTATION_FACTOR_COLORS.JINGQI} />

// ✅ 或使用 CHART_PALETTE（通用图表色）
import { CHART_PALETTE } from '@/constants/theme.tokens'

<RechartsBar fill={CHART_PALETTE.series1} />
```

**场景 E：暗色模式变体**

```typescript
// ✅ 使用 COLOR_SHADES 的 Dark 变体
import { COLOR_SHADES } from '@/constants/theme.tokens'

<div className={`${COLOR_SHADES.red[500]} ${COLOR_SHADES.red['200Dark']}`}>
  红文字 + 暗色模式浅红
</div>
<div className={`${COLOR_SHADES.red['900DarkBg']}`}>
  暗色模式深红背景
</div>
```

**场景 F：排版令牌（字体大小/字重/行高/字间距）**

```typescript
// ✅ 使用 THEME_TOKENS.typography
import { THEME_TOKENS } from '@/constants/theme.tokens'

<h1 className={cn(
  THEME_TOKENS.typography.fontSize['2xl'],
  THEME_TOKENS.typography.fontWeight.bold,
  THEME_TOKENS.typography.lineHeight.tight,
  THEME_TOKENS.typography.letterSpacing.tight
)}>
  标题文本
</h1>

<p className={cn(
  THEME_TOKENS.typography.fontSize.sm,
  THEME_TOKENS.typography.fontWeight.normal,
  THEME_TOKENS.typography.lineHeight.relaxed
)}>
  正文内容
</p>
```

**场景 G：图标尺寸和控件尺寸**

```typescript
// ✅ 使用 THEME_TOKENS.iconSizes 和 controlSizes
import { THEME_TOKENS } from '@/constants/theme.tokens'

<svg className={THEME_TOKENS.iconSizes.md}>...</svg>  // h-5 w-5
<button className={cn(THEME_TOKENS.controlSizes.lg, 'px-4')}>
  按钮
</button>  // h-12
```

**场景 H：间距和圆角**

```typescript
// ✅ 使用 THEME_TOKENS.spacing 和 radius
import { THEME_TOKENS } from '@/constants/theme.tokens'

<div className={cn(
  THEME_TOKENS.spacing.md,        // p-4
  THEME_TOKENS.radius.lg,         // rounded-lg
  THEME_TOKENS.gap.sm,            // gap-2
  COLOR_TOKENS.bgCard.tailwind    // bg-card
)}>
  卡片内容
</div>
```

**场景 C：股票涨跌动态颜色（红涨绿跌例外规则）**

> **⚠️ 例外规则**：股票涨跌颜色**不受通用颜色规范或主题切换影响**。
> 上涨 → 红色（`STOCK_COLOR_TOKENS.up` 或 `getStockColor()`），下跌 → 绿色（`STOCK_COLOR_TOKENS.down` 或 `getStockColor()`）。
> 此规则作为颜色令牌体系的例外：**必须豁免主题切换**（暗色模式不改变涨跌颜色）。

```typescript
// ✅ 正确 1：使用 STOCK_COLOR_TOKENS（推荐，自动豁免主题切换）
import { STOCK_COLOR_TOKENS, getStockColor, getStockColorClass } from '@/constants/theme.tokens'

// 自动判断涨跌
const color = getStockColor(stock.changePercent) // => STOCK_COLOR_TOKENS.up 或 down
const className = getStockColorClass(stock.changePercent) // => 'text-red-500' 或 'text-green-500'

// 手动判断
<span className={stock.changePercent > 0 ? STOCK_COLOR_TOKENS.up.tailwind : STOCK_COLOR_TOKENS.down.tailwind}>
  {stock.changePercent > 0 ? '+' : ''}{stock.changePercent.toFixed(2)}%
</span>

// ✅ 正确 2：使用辅助函数（推荐，代码更简洁）
import { getStockColorHex, getStockColorBg } from '@/constants/theme.tokens'

<div style={{ color: getStockColorHex(stock.changePercent) }}>
  涨跌颜色
</div>
<div className={getStockColorBg(stock.changePercent)}>
  涨跌背景
</div>

// ✅ 正确 3：三态（涨/跌/平）
import { STOCK_COLOR_TOKENS } from '@/constants/theme.tokens'

const changeColor = stock.changePercent > 0
  ? STOCK_COLOR_TOKENS.up.tailwind
  : stock.changePercent < 0
    ? STOCK_COLOR_TOKENS.down.tailwind
    : STOCK_COLOR_TOKENS.neutral.tailwind

// ❌ 禁止：硬编码涨跌颜色（即使语义正确）
<span className="text-red-500">+3.2%</span>        // 即使表示上涨也禁止
<span className="text-green-500">-1.5%</span>      // 即使表示下跌也禁止
<span style={{ color: '#ef4444' }}>+3.2%</span>    // 禁止 HEX 硬编码
```

> **豁免说明**：此场景的颜色选择逻辑（条件表达式）不受 §3.5.4 禁止清单约束，
> 但颜色值来源仍必须遵守令牌系统（`STOCK_COLOR_TOKENS.up` / `STOCK_COLOR_TOKENS.down`）。
> 审计脚本 `audit:hardcode` 对包含 `changePercent`、`priceChange`、`涨跌幅` 等关键词的
> 条件表达式中的令牌引用予以豁免。

#### 3.5.3 语义映射速查表

| 业务场景 | 应使用的令牌 | 禁止使用的硬编码 |
|---------|-------------|----------------|
| 股票上涨 | `COLOR_TOKENS.up` | `text-red-500`、`#ef4444` |
| 股票下跌 | `COLOR_TOKENS.down` | `text-green-500`、`#22c55e` |
| 信息提示 | `COLOR_TOKENS.info` 或 `THEME_TOKENS.color.info` | `text-blue-500` |
| 成功状态 | `COLOR_TOKENS.success` | `text-green-500` |
| 警告状态 | `COLOR_TOKENS.warning` | `text-amber-500` |
| 危险/错误 | `COLOR_TOKENS.danger` 或 `THEME_TOKENS.color.destructive` | `text-red-500`、`bg-red-500` |
| 评分高分 | `COLOR_TOKENS.scoreHigh` | `text-green-500` |
| 评分中分 | `COLOR_TOKENS.scoreMid` | `text-amber-500` |
| 评分低分 | `COLOR_TOKENS.scoreLow` | `text-red-500` |
| 轮动因子 | `ROTATION_FACTOR_COLORS.*`（chartColors.ts） | 内联 HEX |
| 信号分级 | `SIGNAL_GRADE_COLORS.*`（chartColors.ts） | 内联 HEX |
| 卡片背景 | `COLOR_TOKENS.bgCard` | `bg-white`、`#ffffff` |
| 默认边框 | `COLOR_TOKENS.border` | `border-slate-200`、`#e2e8f0` |
| 主要文字 | `COLOR_TOKENS.textPrimary` | `text-slate-800`、`#1e293b` |
| 次要文字 | `COLOR_TOKENS.textSecondary` | `text-slate-500`、`#64748b` |

#### 3.5.4 禁止与允许清单

```typescript
// ══════════════════════════════════════════════════════════════
// ❌ 禁止：在 UI 层直接书写颜色硬编码
// ══════════════════════════════════════════════════════════════

// ❌ 禁止 1：HEX 硬编码
<div style={{ color: '#ef4444' }}>错误</div>
<div style={{ backgroundColor: '#3b82f6' }}>信息</div>

// ❌ 禁止 2：Tailwind 颜色类硬编码
<div className="text-red-500 bg-blue-100 border-gray-300">状态</div>
<div className="hover:text-green-600">悬停变色</div>
<div className="dark:bg-slate-800">暗色模式</div>

// ❌ 禁止 3：内联 RGB/HSL
<div style={{ color: 'rgb(239, 68, 68)' }}>错误</div>

// ══════════════════════════════════════════════════════════════
// ✅ 允许：通过令牌系统引用颜色
// ══════════════════════════════════════════════════════════════

// ✅ 允许 1：THEME_TOKENS（通用语义色）
<div className={`${THEME_TOKENS.color.destructive}`}>错误</div>

// ✅ 允许 2：COLOR_TOKENS（业务语义色）
<div className={`${COLOR_TOKENS.up.tailwind} ${COLOR_TOKENS.bgCard.bgClass}`}>
  上涨卡片
</div>

// ✅ 允许 3：COLOR_SHADES（需要特定色阶）
<div className={`${COLOR_SHADES.red[50]} ${COLOR_SHADES.red[200]}`}>
  浅红背景 + 浅红边框
</div>

// ✅ 允许 4：chartColors.ts（图表场景）
<PieChart colors={PIE_CHART_PALETTE} />

// ✅ 允许 5：CHART_PALETTE（通用图表 HEX）
<div style={{ color: CHART_PALETTE.series1 }}>系列1</div>
```

#### 3.5.6 股票涨跌颜色例外规则（红涨绿跌）

> **⚠️ 例外规则**：股票涨跌颜色**不受通用颜色规范或主题切换影响**。

##### 规则说明

**中国A股标准**：
- 股票上涨 → **红色** 显示（红涨）
- 股票下跌 → **绿色** 显示（绿跌）
- 平盘/中性 → **灰色** 显示

**例外原因**：
- 这是**中国股市惯例**，与通用设计系统（成功=绿色、错误=红色）相反
- **必须豁免主题切换**（暗色模式不改变涨跌颜色）
- **必须豁免通用颜色规范**（不使用 `COLOR_TOKENS.success` 或 `COLOR_TOKENS.danger`）

##### 正确用法

```typescript
// ✅ 正确 1：使用 STOCK_COLOR_TOKENS（推荐，自动豁免主题切换）
import { STOCK_COLOR_TOKENS, getStockColor, getStockColorClass } from '@/constants/theme.tokens'

// 自动判断涨跌
const color = getStockColor(stock.changePercent) // => STOCK_COLOR_TOKENS.up 或 down
const className = getStockColorClass(stock.changePercent) // => 'text-red-500' 或 'text-green-500'

// 手动判断
<span className={stock.changePercent > 0 ? STOCK_COLOR_TOKENS.up.tailwind : STOCK_COLOR_TOKENS.down.tailwind}>
  {stock.changePercent > 0 ? '+' : ''}{stock.changePercent.toFixed(2)}%
</span>

// ✅ 正确 2：使用辅助函数（推荐，代码更简洁）
import { getStockColorHex, getStockColorBg } from '@/constants/theme.tokens'

<div style={{ color: getStockColorHex(stock.changePercent) }}>
  涨跌颜色
</div>
<div className={getStockColorBg(stock.changePercent)}>
  涨跌背景
</div>

// ✅ 正确 3：三态（涨/跌/平）
import { STOCK_COLOR_TOKENS } from '@/constants/theme.tokens'

const changeColor = stock.changePercent > 0
  ? STOCK_COLOR_TOKENS.up.tailwind
  : stock.changePercent < 0
    ? STOCK_COLOR_TOKENS.down.tailwind
    : STOCK_COLOR_TOKENS.neutral.tailwind
```

##### 错误用法

```typescript
// ❌ 错误 1：使用通用颜色令牌（会被主题切换影响）
import { COLOR_TOKENS } from '@/constants/theme.tokens'
<span className={COLOR_TOKENS.success.tailwind}>+3.2%</span>  // ❌ 错误！success 是绿色，但上涨应该是红色
<span className={COLOR_TOKENS.danger.tailwind}>-1.5%</span>  // ❌ 错误！danger 是红色，但下跌应该是绿色

// ❌ 错误 2：硬编码颜色（即使语义正确）
<span className="text-red-500">+3.2%</span>   // ❌ 即使表示上涨也禁止
<span className="text-green-500">-1.5%</span> // ❌ 即使表示下跌也禁止

// ❌ 错误 3：使用 COLOR_TOKENS.up/down（不推荐，容易混淆）
import { COLOR_TOKENS } from '@/constants/theme.tokens'
<span className={COLOR_TOKENS.up.tailwind}>+3.2%</span>  // ⚠️ 不推荐，容易与通用颜色混淆
```

##### ESLint 豁免

- `STOCK_COLOR_TOKENS` 和相关辅助函数（`getStockColor()` 等）**豁免** `no-hardcoded-colors` 检查
- 包含 `changePercent`、`priceChange`、`涨跌幅`、`stock.change` 等关键词的条件表达式**豁免**硬编码检查
- 审计脚本 `audit:hardcode` 对上述用法予以豁免

##### 实现说明

- `STOCK_COLOR_TOKENS` 是**独立导出的常量**，不包含在主题切换逻辑中
- 如需实现主题切换（暗色模式），**必须确保** `STOCK_COLOR_TOKENS` 不被修改
- `getStockColor()` 等辅助函数**硬编码**了红涨绿跌规则，不受主题上下文影响

---

#### 3.5.7 颜色令牌检查清单

**提交前自查**：

```typescript
// ✅ 检查清单
[ ] 是否使用了 STOCK_COLOR_TOKENS 或 getStockColor()？（股票涨跌场景）
[ ] 是否使用了 COLOR_TOKENS 或 THEME_TOKENS？（通用场景）
[ ] 是否使用了 COLOR_SHADES 或 twText/twBg/twBorder？（特定色阶场景）
[ ] 是否没有直接硬编码 HEX 或 Tailwind 颜色类？
[ ] 是否理解了红涨绿跌例外规则？
```

---

#### 3.5.6 新增颜色的 SOP

当需要新增一种颜色时，按以下决策树选择放置位置：

```
需要新颜色？
├── 通用语义色（info/warning/success 级别）？
│   └── → 添加到 THEME_TOKENS.color + COLOR_TOKENS
├── 业务语义色（涨跌/评分/信号/因子）？
│   └── → 添加到 COLOR_TOKENS 对应分区
├── 图表专用色（饼图/热力图/轮动图）？
│   └── → 添加到 src/config/chartColors.ts 对应配置
├── 需要特定色阶（如 red-50、red-600）？
│   └── → 添加到 COLOR_SHADES 对应色系
└── 定制色（非标准色，如板块分析低饱和色）？
    └── → 添加到 chartColors.ts 并注释说明"定制色，非标准 token"
```

**新增令牌必须包含**：
1. JSDoc 注释说明用途
2. `hex`、`tailwind`、`bgClass`、`rgb` 四个格式（COLOR_TOKENS 层级）
3. 在语义映射速查表（§3.5.3）中补充对应行

#### 3.5.7 豁免清单

以下文件/场景允许颜色硬编码（审计脚本自动排除）：

| 文件/目录 | 原因 |
|----------|------|
| `src/constants/theme.tokens.ts` | 令牌定义文件本身 |
| `src/config/chartColors.ts` | 图表配色定义文件 |
| `src/config/themeRegistry.ts` | 主题注册文件 |
| `src/theme.config.ts` | 主题配置文件 |
| `tests/` 目录 | 测试文件（但推荐使用令牌断言） |
| `COLOR_SHADES.*.hex` 对象 | 色阶 HEX 定义本身 |
| `CHART_PALETTE` 对象 | 图表调色板 HEX 定义本身 |

#### 3.5.8 审计与验证

```powershell
# 扫描颜色硬编码违规
npm run audit:hardcode

# 预期输出（零违规状态）
# ✅ 0 hardcoded colors in UI layer
```

**违规严重级别**：
- `src/components/`、`src/pages/`、`src/cockpit/`、`src/apps/` 中的 HEX 颜色 → **Major**
- `src/components/`、`src/pages/`、`src/cockpit/`、`src/apps/` 中的 Tailwind 颜色类 → **Major**

---

## 四、命名约定

- **文件名**: kebab-case（如 `data-bridge.ts`）或 PascalCase（如 `DataBridge.ts`）
- **组件**: PascalCase（如 `CockpitShell.tsx`）
- **Store**: camelCase + `Store` 后缀（如 `analysisStore.ts`）
- **常量**: UPPER_SNAKE_CASE（如 `ROUTE_REGISTRY`）
- **类型**: PascalCase + Interface 前缀（如 `interface StockData`）
- **UI 组件 import 路径**: 大小写必须一致（如 `Card` 而非 `card`）

---

## 五、路由注册规则

- 所有业务路由必须在 `src/config/routes.ts` 的 `ROUTE_REGISTRY` 中注册
- 禁止组件内硬编码路由路径
- 新增页面必须同步更新 `ROUTE_REGISTRY` 和 `docs/06-routing-specs.md`
- 路由白名单通过 `ROUTE_WHITELIST` 和 `ROUTE_PREFIX_WHITELIST` 控制

### 三级加载链架构（v2.0.0+）

页面通过三级间接加载，新增页面必须在对应层级注册：

```
routes.ts（48条路由）→ PortalShell → App 分发器（AnalysisApp/TradingApp/...）→ 页面组件
```

- **routes.ts**：注册舱室级路由（`/analysis`、`/trading` 等），指向 `PortalShell`
- **App 分发器**：在 `src/apps/{cabin}/` 中通过 `React.lazy()` 或静态 `import` 加载页面
- **audit:deadcode** 同时扫描三个注册源：`routes.ts` + `src/apps/` + `src/portal/`

### 新增页面 SOP

1. 在 `src/pages/{cabin}/` 创建页面组件
2. 在对应 `src/apps/{cabin}/{Cabin}App.tsx` 中添加 `React.lazy()` 导入和 else-if 分支
3. 运行 `npm run audit:deadcode` 确认页面不再出现在「未注册页面」列表中

### 审计排除规则

`audit:deadcode` 自动排除以下文件（不计入「未注册页面」）：
- 测试文件：`*.test.ts` / `*.test.tsx` / `__tests__/` 目录
- 子组件：`pages/{cabin}/components/` 目录（非独立页面，被父页面导入）

---

## 六、引擎架构约束

- L3/L4/L7/L8 是确定性层（程序计算），L0/L1/L2/L5/L6 是 LLM 可增强层
- L4 应用层不得直接调用 L6 外部依赖（含 LLM 客户端），必须通过 L3 services 路由
- LLM 模型选择和评分因子使用必须通过接口暴露给用户，含显式选择选项
- LLM 调用必须含用户可配置的开关，可禁用/启用特定 LLM 可增强层
- LLM API Key 必须使用 `localStorageManager.setEncrypted/getEncrypted` 加密存储
- LLM 输出必须经 `sanitizeLlmOutput` 消毒后渲染，防止 XSS

---

## 七、验证命令速查

```powershell
# 类型检查
npx tsc --noEmit

# ESLint
npm run lint

# 单元测试
npm test -- --run

# 生产构建
npm run build

# 架构审计
npm run audit          # 全部审计
npm run audit:layers   # 分层调用
npm run audit:hardcode # 硬编码
npm run audit:deadcode # 死代码
npm run audit:docs     # 文档同步
npm run audit:token    # Token 消耗检测（v1.3.0 新增）
```

### 7.1 Token 消耗控制规则（v1.3.0 新增）

**背景**：知识图谱构建和 AI 辅助开发过程中存在严重的 Token 无谓消耗（月度 1.4M-2.3M tokens），主要来源于脚本重复解析、AI 重复搜索、架构合规检查冗余。

**强制规则**：
- **知识图谱优先**：理解代码关系时，必须先查询 `docs/reports/code-graph.json`，禁止直接使用 grep/searchCodebase 重复搜索已存在的依赖关系
- **增量解析**：`extract-code-graph.ts` 必须支持增量更新（基于文件 mtime），禁止每次全量解析 466+ 文件
- **缓存查询结果**：常用查询（Store 依赖、跨层违规、最大文件）必须使用 `scripts/quick-query.sh` 模板，禁止重复构建查询逻辑
- **Token 预算**：单次 AI 会话 Token 消耗不得超过 50,000 tokens，超出必须使用知识图谱替代手动搜索

**验证命令**：
```powershell
npm run audit:token
# 期望：0 violations, Token 消耗 < 50,000/会话
```

---

## 八、数据库版本管理

- 修改 IndexedDB schema 必须递增 `DB_VERSION`（`src/config/dbConfig.ts`）
- 新增 store 必须在 `STORE_NAME` 中注册
- 新增 store 必须在 `ACL_MATRIX` 中添加对应的 read/write 白名单
- 新增 store 必须有创建逻辑，按以下规则选择位置（v1.3.5 明确）：
  - **基线 store**（首次安装时就需要的核心 store）→ 在 `createSchema`（`src/data/db-schema.ts`）中添加
  - **增量 store**（版本升级时新增的 store）→ 在对应版本的 `Migration.up()`（`src/data/db-migrations.ts` 或 `src/data/migrations/`）中添加
  - 禁止在两处同时添加同一 store 的创建逻辑（违反 DRY 原则）
  - 当前基线 store 清单（由 createSchema 创建，共 27 个）：stocks / v6Scores / intelligentScores / industryScores / orders / watchlists / signals / researchLogs / dailyQuotes / financialReports / rotationScores / sectorScores / scoreDocs / strategySnapshots / localDocs / news / newsStockMap / sentimentCache / newsBookmarks / hotSectorScores / valuePitScores / executionLogs / missingReports / executionPlans / portfolios / tradeReviews / schemaMigrations
  - 当前增量 store 清单（由 migration 创建）：RBAC 6 表（rbac_users / rbac_roles / rbac_permissions / rbac_user_roles / rbac_role_permissions / rbac_permission_audit_logs，由 rbacMigrationV24 创建）
  - 注意：schemaMigrations 表本身由 createSchema 创建（基线），但它的"种子数据"由 seed_schema_migrations_tracker migration 写入
- 新增 ENVELOPE_ACTION 必须在 `DataBridge.routeToDB()` 中添加对应 case

---

## 九、LLM 调用透明度

- LLM 调用前必须向用户展示模型选择和评分因子使用情况
- 评分结果必须清晰标注哪些因子使用 LLM 增强 vs 自动计算
- LLM 调用必须包含用户可配置的开关

---

## 十、自主决策规则

### 三级决策矩阵

#### 自主执行（无需人工干预）

**适用场景**：低风险、单模块、完全可逆的操作

- 代码格式化、ESLint 自动修复
- 补充单元测试（覆盖率 < 80% 时）
- 文档同步更新（类型定义变更时）
- 架构合规性检查与自动修复

**自主修复边界**（v1.3.1 新增）：
- ✅ 允许：提取硬编码颜色到 `src/constants/theme.tokens.ts`
- ✅ 允许：提取魔法数字到 `src/config/thresholds.ts`（需遵循命名规范）
- ✅ 允许：修复跨层调用（调整 import 路径）
- ✅ 允许：补充缺失的事件监听清理代码
- ❌ 禁止：新增常量/配置项（涉及 `src/constants/` 或 `src/config/` 的新增）
- ❌ 禁止：修改现有接口签名
- ❌ 禁止：重构组件 props
- ❌ 禁止：删除或重命名已导出的函数/类

**验证机制**：
```powershell
npm run lint --max-warnings 0
npx tsc --noEmit
npm test -- --run
npm run audit:docs
```

#### 人工确认（需人工审批后执行）

**适用场景**：中风险、跨模块、部分可逆的操作

- 跨模块重构（涉及 3 个以上模块）
- 数据库 Schema 变更（修改 DB_VERSION）
- 接口签名变更（影响多个调用方）

**执行流程**：
1. 生成影响分析报告
2. 提交人工审批
3. 获得批准后分步执行
4. 每步完成后验证
5. 最终集成测试

#### 人工决策（必须人工决策）

**适用场景**：高风险、系统级、不可逆的操作

- 技术栈更换（如 Zustand → Redux）
- 核心算法重构（V6 评分引擎）
- 安全策略变更

**决策流程**：
1. 生成技术选型报告
2. 列出候选方案优劣
3. 提交技术评审委员会
4. 获得决策结论
5. 制定迁移计划

### 日志记录要求

所有任务完成后必须生成结构化日志，存储于 `docs/changelogs/YYYY-MM/` 目录，包含：
- 任务状态与进度
- 人机交互记录
- 文件变更详情
- 技术决策记录
- 质量指标快照

**查询工具**：
```powershell
npm run changelog:query -- --date=2026-07-04
npm run changelog:summary
```

---

## 十一、变更日志

| 版本 | 日期 | 变更摘要 |
|------|------|----------|
| v1.3.3 | 2026-07-05 | §3.5.1 补充 THEME_TOKENS 完整结构说明（typography/iconSizes/controlSizes/spacing/radius/gap/stackGap）；§3.5.2 新增场景 F/G/H（排版令牌、图标尺寸、间距圆角使用示例）；完成 Alert/Badge 组件 Design Tokens 迁移；新增组件迁移最佳实践文档 |
| v1.3.2 | 2026-07-05 | §1 补充 services→lib 依赖规则（明确 lib 基础设施白名单）；补充 types/ 和 agents/ 层定义；audit-layer-calls.ts v2.2 新增 services→lib 业务模块检测 |
| v1.3.1 | 2026-07-05 | §3 新增事件监听清理标准模板（4 个）、新增 AI 自主修复边界清单（允许/禁止）；§1 补充 lib/ 层依赖规则；§2 补充四步契约回滚验证流程（5 项验证要求）；Store 数量修正 39→44、服务子域 18→20 |
| v1.3.0 | 2026-07-05 | §7 新增 Token 消耗控制规则（§7.1）、新增 audit:token 脚本、优化 audit:layers/hardcode/deadcode 检测能力、新增知识图谱使用指南和常见错误模式清单 |
| v1.2.0 | 2026-07-04 | §5 新增三级加载链架构说明、新增页面 SOP、审计排除规则；audit:deadcode v2.0 支持 App 分发器扫描 |
| v1.1.0 | 2026-07-04 | 新增自主决策规则、日志记录要求 |
| v1.0.0 | 2026-07-02 | 初始版本：分层规则、四步契约、类型安全、零硬编码、路由注册、引擎架构、验证命令、数据库版本管理、LLM透明度 |
