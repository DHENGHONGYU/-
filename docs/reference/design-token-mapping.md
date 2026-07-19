---
title: V9 设计令牌映射�?
type: reference
domain: frontend
phase: design
tier: standard
status: active
maintainer: V9 Architecture Team
summary: "文档编号: DOC-TOKENS-002 版本: v1.0.0 日期: 2026-07-10 对应 AGENTS.md: §3.5 颜色令牌规范 适用范围:..."
tags: [frontend, token, design]
version: v1.0.0
last_updated: 2026-07-17
code_version: 2.0.0
change_log:
  - version: v1.0.0
changes: Initial version established
date: 2026-07-17
---ence
domain: frontend
phase: design
tier: standard
status: active
maintainer: V9 Architecture Team
tags: [frontend, token, design]
version: v1.0.0
last_updated: 2026-07-17
code_version: 2.0.0
---

# V9 设计令牌映射�?
> **文档编号**: DOC-TOKENS-002  
> **版本**: v1.0.0  
> **日期**: 2026-07-10  
> **对应 AGENTS.md**: §3.5 颜色令牌规范  
> **适用范围**: `src/components/`、`src/pages/`、`src/cockpit/`、`src/apps/` 等所�?UI �?
---

## 1. 为什么需要这份映射表

颜色令牌系统已经从单一 `theme.tokens.ts` 拆分�?L1–L6 六个层次。实际开发中常见的问题是�?
- 不知道某个场景该�?`THEME_TOKENS.color` 还是 `COLOR_TOKENS`�?- 股票涨跌应该�?`STOCK_COLOR_TOKENS` 例外规则，但经常被误写成通用语义色；
- 需�?`text-red-600` 时不知道�?`COLOR_SHADES` 还是 `twText`�?- 图表颜色直接使用 `COLOR_TOKENS` 而非 `chartColors.ts` 中业务调色板�?- 暗色模式、悬停态、Focus 状态大量裸�?Tailwind 类名�?
本表按照“业务场�?�?令牌层级 �?推荐 Import �?代码示例 �?常见错误”进行映射，作为提示词模板和 Husky 门禁的共同依据�?
---

## 2. 快速决策树

```text
1. 是否涉及股票涨跌幅？
   ├─ �?�?使用 STOCK_COLOR_TOKENS（L5），�?§3.1
   └─ �?�?继续下一�?
2. 是否用于图表 / 热力�?/ 雷达�?/ Recharts / canvas�?   ├─ �?�?使用 chartColors.ts 业务调色板（L4），�?§3.4
   └─ �?�?继续下一�?
3. 是否需要特定色阶（�?bg-red-50、text-red-600）？
   ├─ �?�?使用 COLOR_SHADES �?twText/twBg/twBorder（L3），�?§3.3
   └─ �?�?继续下一�?
4. 是否是业务语义色（涨�?评分/信号/因子/风格）？
   ├─ �?�?使用 COLOR_TOKENS（L2），�?§3.2
   └─ �?�?使用 THEME_TOKENS.color（L1）或 SEMANTIC_COLOR_ROLES（L6），�?§3.1

5. 是否是暗色模式、悬停、Focus、渐变、SVG fill�?   ├─ �?�?使用 DARK / HOVER / FOCUS / FILL / GRADIENT（L3），�?§3.3
   └─ �?�?继续下一�?
6. 是否需要使用主题感知的新设计系统（CSS 变量）？
   ├─ �?�?使用 SEMANTIC_COLOR_ROLES（L6），�?§3.5
   └─ �?�?使用 THEME_TOKENS（L1�?```

---

## 3. 分场景映射表

### 3.1 通用状态色（L1 THEME_TOKENS�?
| 业务场景 | 推荐 Token | 代码示例 | 禁止写法 |
|----------|------------|----------|----------|
| 信息提示文本 | `THEME_TOKENS.color.info` | `<span className={THEME_TOKENS.color.info}>提示</span>` | `text-blue-500` |
| 信息提示背景 | `THEME_TOKENS.color.infoBg` | `<div className={THEME_TOKENS.color.infoBg} />` | `bg-blue-500` |
| 信息�?HEX | `THEME_TOKENS.color.infoRaw` | `<span style={{ color: THEME_TOKENS.color.infoRaw }} />` | `#3b82f6` |
| 成功/正向文本 | `THEME_TOKENS.color.success` | `<span className={THEME_TOKENS.color.success}>通过</span>` | `text-green-500` |
| 成功/正向背景 | `THEME_TOKENS.color.successBg` | `<div className={THEME_TOKENS.color.successBg} />` | `bg-green-500` |
| 成功�?HEX | `THEME_TOKENS.color.successRaw` | `<span style={{ color: THEME_TOKENS.color.successRaw }} />` | `#22c55e` |
| 警告/注意文本 | `THEME_TOKENS.color.warning` | `<span className={THEME_TOKENS.color.warning}>警告</span>` | `text-amber-500` |
| 警告/注意背景 | `THEME_TOKENS.color.warningBg` | `<div className={THEME_TOKENS.color.warningBg} />` | `bg-amber-500` |
| 警告�?HEX | `THEME_TOKENS.color.warningRaw` | `<span style={{ color: THEME_TOKENS.color.warningRaw }} />` | `#f59e0b` |
| 危险/错误文本 | `THEME_TOKENS.color.destructive` | `<span className={THEME_TOKENS.color.destructive}>错误</span>` | `text-red-500` |
| 危险/错误背景 | `THEME_TOKENS.color.destructiveBg` | `<div className={THEME_TOKENS.color.destructiveBg} />` | `bg-red-500` |
| 危险�?HEX | `THEME_TOKENS.color.destructiveRaw` | `<span style={{ color: THEME_TOKENS.color.destructiveRaw }} />` | `#ef4444` |
| 弱化/次要文本 | `THEME_TOKENS.color.muted` | `<span className={THEME_TOKENS.color.muted}>次要</span>` | `text-gray-500` |
| 更弱提示文本 | `THEME_TOKENS.color.mutedForeground` | `<span className={THEME_TOKENS.color.mutedForeground}>占位</span>` | `text-gray-400` |
| 弱化背景 | `THEME_TOKENS.color.mutedBackground` | `<div className={THEME_TOKENS.color.mutedBackground} />` | `bg-gray-100` |
| 弱化�?HEX | `THEME_TOKENS.color.mutedRaw` | `<span style={{ color: THEME_TOKENS.color.mutedRaw }} />` | `#9ca3af` |
| 默认边框 | `THEME_TOKENS.color.border` | `<div className={THEME_TOKENS.color.border} />` | `border-gray-200` |
| 边框 HEX | `THEME_TOKENS.color.borderRaw` | `<span style={{ borderColor: THEME_TOKENS.color.borderRaw }} />` | `#e5e7eb` |

### 3.2 业务语义色（L2 COLOR_TOKENS�?
| 业务场景 | 推荐 Token | 代码示例 | 禁止写法 |
|----------|------------|----------|----------|
| **股票上涨（A股）** | `STOCK_COLOR_TOKENS.up` | �?§4.1，禁止用 COLOR_TOKENS.up | `COLOR_TOKENS.up` |
| 评分/高分 | `COLOR_TOKENS.scoreHigh` | `<div className={COLOR_TOKENS.scoreHigh.bgClass}>优秀</div>` | `bg-green-500` |
| 评分/中分 | `COLOR_TOKENS.scoreMid` | `<span className={COLOR_TOKENS.scoreMid.tailwind}>良好</span>` | `text-amber-500` |
| 评分/低分 | `COLOR_TOKENS.scoreLow` | `<span className={COLOR_TOKENS.scoreLow.tailwind}>较差</span>` | `text-red-500` |
| 景气因子 | `COLOR_TOKENS.factorJingqi` | �?§3.4 �?`ROTATION_FACTOR_COLORS` | `#ef4444` |
| 资金因子 | `COLOR_TOKENS.factorZijin` | �?§3.4 �?`ROTATION_FACTOR_COLORS` | `#f59e0b` |
| 估值因�?| `COLOR_TOKENS.factorGuzhi` | �?§3.4 �?`ROTATION_FACTOR_COLORS` | `#3b82f6` |
| β 因子 | `COLOR_TOKENS.factorBeta` | �?§3.4 �?`ROTATION_FACTOR_COLORS` | `#8b5cf6` |
| 量能因子 | `COLOR_TOKENS.factorNengliang` | �?§3.4 �?`ROTATION_FACTOR_COLORS` | `#06b6d4` |
| 成长风格 | `COLOR_TOKENS.styleGrowth` | �?§3.4 �?`MARKET_STYLE_COLORS` | `#3b82f6` |
| 价值风�?| `COLOR_TOKENS.styleValue` | �?§3.4 �?`MARKET_STYLE_COLORS` | `#10b981` |
| 均衡风格 | `COLOR_TOKENS.styleBalanced` | �?§3.4 �?`MARKET_STYLE_COLORS` | `#8b5cf6` |
| 强信�?| `COLOR_TOKENS.signalStrong` | �?§3.4 �?`SIGNAL_GRADE_COLORS` | `#10b981` |
| 中强信号 | `COLOR_TOKENS.signalMediumStrong` | �?§3.4 �?`SIGNAL_GRADE_COLORS` | `#22c55e` |
| 中信�?| `COLOR_TOKENS.signalMedium` | �?§3.4 �?`SIGNAL_GRADE_COLORS` | `#3b82f6` |
| 弱信�?| `COLOR_TOKENS.signalWeak` | �?§3.4 �?`SIGNAL_GRADE_COLORS` | `#f59e0b` |
| 无信�?| `COLOR_TOKENS.signalNone` | �?§3.4 �?`SIGNAL_GRADE_COLORS` | `#9ca3af` |
| 卡片背景 | `COLOR_TOKENS.bgCard` | `<div className={COLOR_TOKENS.bgCard.tailwind} />` | `bg-neutral-50` |
| 悬停背景 | `COLOR_TOKENS.bgHover` | `<div className={COLOR_TOKENS.bgHover.tailwind} />` | `bg-neutral-100` |
| 次要背景 | `COLOR_TOKENS.bgMuted` | `<div className={COLOR_TOKENS.bgMuted.tailwind} />` | `bg-neutral-200` |
| 主要文字 | `COLOR_TOKENS.textPrimary` | `<span className={COLOR_TOKENS.textPrimary.tailwind} />` | `text-slate-800` |
| 次要文字 | `COLOR_TOKENS.textSecondary` | `<span className={COLOR_TOKENS.textSecondary.tailwind} />` | `text-slate-500` |
| 弱化文字 | `COLOR_TOKENS.textMuted` | `<span className={COLOR_TOKENS.textMuted.tailwind} />` | `text-slate-400` |
| 默认边框 | `COLOR_TOKENS.border` | `<div className={COLOR_TOKENS.border.tailwind} />` | `border-slate-200` |
| 悬停边框 | `COLOR_TOKENS.borderHover` | `<div className={COLOR_TOKENS.borderHover.tailwind} />` | `border-slate-300` |
| 焦点�?| `COLOR_TOKENS.focusRing` | `<input className={COLOR_TOKENS.focusRing.tailwind} />` | `ring-blue-500` |

### 3.3 特定色阶与状态辅助（L3 COLOR_SHADES / DARK / HOVER / FOCUS / FILL / GRADIENT�?
| 业务场景 | 推荐方式 | 代码示例 | 禁止写法 |
|----------|----------|----------|----------|
| 浅红背景 | `COLOR_SHADES.red[50]` | `<div className={COLOR_SHADES.red[50]} />` | `bg-red-50` |
| 深红文字 | `COLOR_SHADES.red[600]` | `<span className={COLOR_SHADES.red[600]} />` | `text-red-600` |
| 浅蓝背景 | `COLOR_SHADES.blue[50]` | `<div className={COLOR_SHADES.blue[50]} />` | `bg-blue-50` |
| 深蓝文字 | `COLOR_SHADES.blue[700]` | `<span className={COLOR_SHADES.blue[700]} />` | `text-blue-700` |
| 任意色阶 | `twText / twBg / twBorder` | `<span className={twText('red', 600)} />` | `text-red-600` |
| 暗色背景 slate-800 | `DARK.bgSlate800` | `<div className={DARK.bgSlate800} />` | `dark:bg-slate-800` |
| 暗色背景 neutral-900 | `DARK.bgNeutral900` | `<div className={DARK.bgNeutral900} />` | `dark:bg-neutral-900` |
| 暗色文字 neutral-200 | `DARK.textNeutral200` | `<span className={DARK.textNeutral200} />` | `dark:text-neutral-200` |
| 暗色边框 neutral-700 | `DARK.borderNeutral700` | `<div className={DARK.borderNeutral700} />` | `dark:border-neutral-700` |
| 悬停背景 stone-100 | `HOVER.bgStone100` | `<div className={HOVER.bgStone100} />` | `hover:bg-stone-100` |
| 暗色悬停背景 neutral-800 | `HOVER.darkHoverBgNeutral800` | `<div className={HOVER.darkHoverBgNeutral800} />` | `dark:hover:bg-neutral-800` |
| Focus 边框 emerald | `FOCUS.borderEmerald400` | `<input className={FOCUS.borderEmerald400} />` | `focus:border-emerald-400` |
| SVG 填充 | `FILL.stone700` | `<svg className={FILL.stone700} />` | `fill-stone-700` |
| 渐变 emerald �?sky | `GRADIENT.fromEmerald500` + `GRADIENT.toSky500` | `<div className={cn('bg-gradient-to-r', GRADIENT.fromEmerald500, GRADIENT.toSky500)} />` | `from-emerald-500 to-sky-500` |
| 暗色红文�?| `COLOR_SHADES.red['200Dark']` | `<span className={COLOR_SHADES.red['200Dark']} />` | `dark:text-red-200` |
| 暗色红背�?| `COLOR_SHADES.red['900DarkBg']` | `<div className={COLOR_SHADES.red['900DarkBg']} />` | `dark:bg-red-950` |

### 3.4 图表与业务调色板（L4 chartColors.ts�?
| 业务场景 | 推荐调色�?| 代码示例 | 禁止写法 |
|----------|------------|----------|----------|
| 多系列饼�?柱状�?| `PIE_CHART_PALETTE` | `<PieChart colors={PIE_CHART_PALETTE} />` | `[#3b82f6, #22c55e, ...]` |
| 轮动因子�?| `ROTATION_FACTOR_COLORS` | `lineColor={ROTATION_FACTOR_COLORS.JINGQI}` | `COLOR_TOKENS.factorJingqi.hex`（优先） |
| 市场风格�?| `MARKET_STYLE_COLORS` | `fill={MARKET_STYLE_COLORS.GROWTH}` | `#3b82f6` |
| 信号分级�?| `SIGNAL_GRADE_COLORS` | `color={SIGNAL_GRADE_COLORS.STRONG}` | `#10b981` |
| 得分分档�?| `SCORE_BUCKET_COLORS` | `color={SCORE_BUCKET_COLORS.HIGH}` | `#22c55e` |
| 下跌性质�?| `DECLINE_NATURE_COLORS` | `color={DECLINE_NATURE_COLORS.KILL_LOGIC}` | `#ef4444` |
| 高景气抛售预�?| `ALERT_LEVEL_COLORS` | `color={ALERT_LEVEL_COLORS.RED}` | `#ef4444` |
| 股票池状�?| `STOCK_POOL_STATUS_RAW_COLORS` | `colors={STOCK_POOL_STATUS_RAW_COLORS}` | `[#22c55e, #3b82f6, ...]` |
| 资讯情感趋势 | `SENTIMENT_TREND_COLORS` | `color={SENTIMENT_TREND_COLORS.positive}` | `#10b981` |
| AI 智能体标�?| `AI_AGENT_TAG_COLORS` | `color={AI_AGENT_TAG_COLORS.LLM}` | `#8b5cf6` |
| 中�?占位颜色 | `NEUTRAL_COLOR` | `color={NEUTRAL_COLOR}` | `THEME_TOKENS.color.mutedRaw` |
| 通用图表�?| `CHART_PALETTE` | `fill={CHART_PALETTE.series1}` | `#3b82f6` |
| 通用网格�?| `CHART_PALETTE.grid` | `stroke={CHART_PALETTE.grid}` | `#e5e7eb` |
| 通用坐标轴文�?| `CHART_PALETTE.axis` | `fill={CHART_PALETTE.axis}` | `#6b7280` |

### 3.5 主题感知设计系统（L6 SEMANTIC_COLOR_ROLES�?
> **优先使用场景**：新页面、新组件、不依赖历史 Tailwind 类的模块。`SEMANTIC_COLOR_ROLES` 基于 CSS 变量，自动适配�?暗色主题�?
| 业务场景 | 推荐 Token | 代码示例 | 说明 |
|----------|------------|----------|------|
| 品牌主色文本 | `SEMANTIC_COLOR_ROLES.primary.text` | `<span className={SEMANTIC_COLOR_ROLES.primary.text}>品牌</span>` | 主题感知 |
| 品牌主色背景 | `SEMANTIC_COLOR_ROLES.primary.bg` | `<div className={SEMANTIC_COLOR_ROLES.primary.bg} />` | 主题感知 |
| 品牌主色柔色 | `SEMANTIC_COLOR_ROLES.primary.soft` | `<div className={SEMANTIC_COLOR_ROLES.primary.soft} />` | 浅底深色�?|
| 品牌主色前景 | `SEMANTIC_COLOR_ROLES.primary.fg` | `<span className={SEMANTIC_COLOR_ROLES.primary.fg} />` | 用于主色背景上的文字 |
| 中性文�?| `SEMANTIC_COLOR_ROLES.neutral.text` | `<span className={SEMANTIC_COLOR_ROLES.neutral.text} />` | 对应 text-foreground |
| 中性背�?| `SEMANTIC_COLOR_ROLES.neutral.bg` | `<div className={SEMANTIC_COLOR_ROLES.neutral.bg} />` | 对应 bg-background |
| 中性柔�?| `SEMANTIC_COLOR_ROLES.neutral.soft` | `<div className={SEMANTIC_COLOR_ROLES.neutral.soft} />` | 对应 muted |
| 表面背景 | `SEMANTIC_COLOR_ROLES.surface.bg` | `<div className={SEMANTIC_COLOR_ROLES.surface.bg} />` | 对应 bg-card |
| 表面边框 | `SEMANTIC_COLOR_ROLES.surface.border` | `<div className={SEMANTIC_COLOR_ROLES.surface.border} />` | 对应 border-border |
| 强边�?| `SEMANTIC_COLOR_ROLES.surface.borderStrong` | `<div className={SEMANTIC_COLOR_ROLES.surface.borderStrong} />` | 对应 border-divider |
| 成功柔色 | `SEMANTIC_COLOR_ROLES.success.soft` | `<div className={SEMANTIC_COLOR_ROLES.success.soft} />` | 浅底深色�?|
| 警告柔色 | `SEMANTIC_COLOR_ROLES.warning.soft` | `<div className={SEMANTIC_COLOR_ROLES.warning.soft} />` | 浅底深色�?|
| 危险柔色 | `SEMANTIC_COLOR_ROLES.danger.soft` | `<div className={SEMANTIC_COLOR_ROLES.danger.soft} />` | 浅底深色�?|
| 信息柔色 | `SEMANTIC_COLOR_ROLES.info.soft` | `<div className={SEMANTIC_COLOR_ROLES.info.soft} />` | 浅底深色�?|
| 主色 HEX | `SEMANTIC_COLOR_ROLES.primary.raw` | `style={{ color: SEMANTIC_COLOR_ROLES.primary.raw }}` | 亮色模式代表�?|
| 成功 HEX | `SEMANTIC_COLOR_ROLES.success.raw` | `style={{ color: SEMANTIC_COLOR_ROLES.success.raw }}` | 亮色模式代表�?|

### 3.6 排版、尺寸、间距、动效（L1 THEME_TOKENS�?
| 业务场景 | 推荐 Token | 代码示例 | 禁止写法 |
|----------|------------|----------|----------|
| 图标尺寸 xs | `THEME_TOKENS.iconSizes.xs` | `<Icon className={THEME_TOKENS.iconSizes.xs} />` | `h-3 w-3` |
| 图标尺寸 sm | `THEME_TOKENS.iconSizes.sm` | `<Icon className={THEME_TOKENS.iconSizes.sm} />` | `h-4 w-4` |
| 控件高度 xs | `THEME_TOKENS.controlSizes.xs` | `<button className={THEME_TOKENS.controlSizes.xs} />` | `h-6` |
| 控件高度 md | `THEME_TOKENS.controlSizes.md` | `<button className={THEME_TOKENS.controlSizes.md} />` | `h-10` |
| 内边�?xs | `THEME_TOKENS.spacing.xs` | `<div className={THEME_TOKENS.spacing.xs} />` | `p-1` |
| 内边�?md | `THEME_TOKENS.spacing.md` | `<div className={THEME_TOKENS.spacing.md} />` | `p-4` |
| 水平内边�?sm | `THEME_TOKENS.spacing.pxSm` | `<div className={THEME_TOKENS.spacing.pxSm} />` | `px-2` |
| 垂直内边�?md | `THEME_TOKENS.spacing.pyMd` | `<div className={THEME_TOKENS.spacing.pyMd} />` | `py-2` |
| 圆角 sm | `THEME_TOKENS.radius.sm` | `<div className={THEME_TOKENS.radius.sm} />` | `rounded-sm` |
| 圆角 lg | `THEME_TOKENS.radius.lg` | `<div className={THEME_TOKENS.radius.lg} />` | `rounded-lg` |
| 圆角 full | `THEME_TOKENS.radius.full` | `<div className={THEME_TOKENS.radius.full} />` | `rounded-full` |
| 间隙 xs | `THEME_TOKENS.gap.xs` | `<div className={THEME_TOKENS.gap.xs} />` | `gap-1` |
| 间隙 md | `THEME_TOKENS.gap.md` | `<div className={THEME_TOKENS.gap.md} />` | `gap-3` |
| 堆叠间隙 sm | `THEME_TOKENS.stackGap.sm` | `<div className={THEME_TOKENS.stackGap.sm} />` | `space-y-2` |
| 字号 xs | `THEME_TOKENS.typography.fontSize.xs` | `<span className={THEME_TOKENS.typography.fontSize.xs} />` | `text-xs` |
| 字号 2xl | `THEME_TOKENS.typography.fontSize['2xl']` | `<h2 className={THEME_TOKENS.typography.fontSize['2xl']} />` | `text-2xl` |
| 字重 medium | `THEME_TOKENS.typography.fontWeight.medium` | `<span className={THEME_TOKENS.typography.fontWeight.medium} />` | `font-medium` |
| 字重 bold | `THEME_TOKENS.typography.fontWeight.bold` | `<span className={THEME_TOKENS.typography.fontWeight.bold} />` | `font-bold` |
| 行高 tight | `THEME_TOKENS.typography.lineHeight.tight` | `<p className={THEME_TOKENS.typography.lineHeight.tight} />` | `leading-tight` |
| 字间�?wide | `THEME_TOKENS.typography.letterSpacing.wide` | `<span className={THEME_TOKENS.typography.letterSpacing.wide} />` | `tracking-wide` |
| 焦点环宽�?| `THEME_TOKENS.focusVisible.ringWidth` | `<input className={THEME_TOKENS.focusVisible.ringWidth} />` | `ring-2` |
| 焦点环颜�?| `THEME_TOKENS.focusVisible.ringColor` | `<input className={THEME_TOKENS.focusVisible.ringColor} />` | `ring-blue-500` |
| 过渡动画 | `THEME_TOKENS.motion.fadeIn` | `<div className={THEME_TOKENS.motion.fadeIn} />` | `transition-opacity duration-300 ease-in-out` |
| 骨架屏脉�?| `THEME_TOKENS.motion.skeletonPulse` | `<div className={THEME_TOKENS.motion.skeletonPulse} />` | `animate-pulse` |
| 加载旋转 | `THEME_TOKENS.motion.spin` | `<div className={THEME_TOKENS.motion.spin} />` | `animate-spin` |
| 优秀评分阈�?| `THEME_TOKENS.score.excellent` | `score >= THEME_TOKENS.score.excellent` | 魔法数字 4 |
| 良好评分阈�?| `THEME_TOKENS.score.good` | `score >= THEME_TOKENS.score.good` | 魔法数字 3 |
| 可接受阈�?| `THEME_TOKENS.score.ok` | `score >= THEME_TOKENS.score.ok` | 魔法数字 2 |

---

## 4. 例外与边界规�?
### 4.1 股票颜色例外（L5 STOCK_COLOR_TOKENS�?
**这是项目最重要的例外规�?*�?
- 中国 A 股标准：**红涨绿跌**�?- 所有涉及个�?指数/ETF 涨跌幅的颜色，必须使�?`STOCK_COLOR_TOKENS`�?- 暗色模式下，股票涨跌颜色**不变**（豁免主题切换）�?- 禁止�?`COLOR_TOKENS.up/down` �?`THEME_TOKENS.color.success/destructive` 替代�?
```typescript
// �?正确
import { getStockColorClass } from '@/constants/theme.tokens'
<span className={getStockColorClass(changePct)}>{changePct}%</span>

// �?错误：用了通用语义色，可能被主题切换影�?import { COLOR_TOKENS } from '@/constants/theme.tokens'
<span className={changePct >= 0 ? COLOR_TOKENS.up.tailwind : COLOR_TOKENS.down.tailwind}>
  {changePct}%
</span>
```

### 4.2 图表颜色豁免

`chartColors.ts` 中的 L4 图表调色板已经集中管理，允许使用其内�?HEX 值，但禁止在图表组件之外使用这些 HEX 值。如果图表业务场景与 `COLOR_TOKENS` 语义重合，优先引�?`COLOR_TOKENS.*.hex`�?
### 4.3 令牌定义文件本身

`src/constants/theme/` �?`src/config/chartColors.ts` 中允许出现字面量 Tailwind 类名�?HEX 值，因为它们是“源头”。其他所有文件通过 import 消费，不得在源码中裸写�?
### 4.4 第三方库覆盖

当必须覆盖第三方组件库的样式（如 shadcn/ui、Recharts 默认主题）时，应�?`src/index.css` 或专门的覆盖文件中使�?CSS 变量，并通过设计令牌导出，而不是在业务组件中直接写 `!text-blue-500`�?
---

## 5. 常见错误速查�?
| 错误写法 | 问题 | 正确写法 |
|----------|------|----------|
| `text-red-500` | 硬编�?Tailwind 颜色�?| 状态色�?`THEME_TOKENS.color.destructive`；股票用 `STOCK_COLOR_TOKENS.up.tailwind` |
| `bg-blue-500` | 硬编�?Tailwind 颜色�?| 业务语义�?`COLOR_TOKENS.info.bgClass`；通用状态用 `THEME_TOKENS.color.infoBg` |
| `text-slate-800` | 硬编码文字色 | `COLOR_TOKENS.textPrimary.tailwind` �?`SEMANTIC_COLOR_ROLES.neutral.text` |
| `border-gray-200` | 硬编码边框色 | `THEME_TOKENS.color.border` �?`COLOR_TOKENS.border.tailwind` |
| `dark:bg-slate-800` | 硬编码暗色模�?| `DARK.bgSlate800` |
| `hover:bg-stone-100` | 硬编码悬停�?| `HOVER.bgStone100` |
| `focus:border-emerald-400` | 硬编�?Focus | `FOCUS.borderEmerald400` |
| `from-emerald-500 to-sky-500` | 硬编码渐�?| `GRADIENT.fromEmerald500` + `GRADIENT.toSky500` |
| `fill-stone-700` | 硬编�?SVG fill | `FILL.stone700` |
| `h-4 w-4` | 硬编码图标尺�?| `THEME_TOKENS.iconSizes.sm` |
| `text-xs` | 硬编码字�?| `THEME_TOKENS.typography.fontSize.xs` |
| `p-4` | 硬编码间�?| `THEME_TOKENS.spacing.md` |
| `rounded-lg` | 硬编码圆�?| `THEME_TOKENS.radius.lg` |
| `gap-3` | 硬编码间�?| `THEME_TOKENS.gap.md` |
| 直接使用 `#ef4444` | 硬编�?HEX | 股票�?`STOCK_COLOR_TOKENS.up.hex`；图表用 `CHART_PALETTE.upColor` |
| `score >= 4` | 硬编码阈�?| `score >= THEME_TOKENS.score.excellent` |

---

## 6. AI 提示词注入模�?
当使�?AI 生成 UI 代码时，必须在提示词中显式注入以下约束：

```markdown
## 颜色与令牌使用约�?- 禁止在组件文件中直接书写 HEX 颜色值或 Tailwind 颜色类名（如 `text-red-500`、`bg-blue-50`）�?- 所有颜色必须引�?`src/constants/theme.tokens.ts` �?`src/config/chartColors.ts`�?- 股票涨跌幅必须使�?`STOCK_COLOR_TOKENS`（红涨绿跌，暗色模式不变）�?- 图表颜色使用 `chartColors.ts` 中的业务调色板�?- 需要特定色阶时使用 `COLOR_SHADES` �?`twText/twBg/twBorder`�?- 暗色模式、悬停、Focus、渐变、SVG fill 使用 `DARK / HOVER / FOCUS / FILL / GRADIENT`�?- 新组件优先使�?`SEMANTIC_COLOR_ROLES`（主题感知）�?- 不确定时参�?`./design-token-mapping.md`�?```

---

## 7. 验收清单

新增或修�?UI 代码时，按以下清单自审：

- [ ] 源码中不存在 `text-*` / `bg-*` / `border-*` 等硬编码 Tailwind 颜色类（�?`theme/` �?`chartColors.ts` 外）�?- [ ] 源码中不存在 `#[0-9a-fA-F]{6}` 形式的硬编码 HEX 颜色�?- [ ] 股票涨跌使用 `STOCK_COLOR_TOKENS` �?`getStockColor*` 函数�?- [ ] 图表使用 `chartColors.ts` 业务调色板；
- [ ] 暗色模式使用 `DARK.*` 而非 `dark:bg-*` 等裸类；
- [ ] 悬停态使�?`HOVER.*`�?- [ ] Focus 状态使�?`FOCUS.*`�?- [ ] 渐变使用 `GRADIENT.*`�?- [ ] 字号、字重、行高、间距、圆角、图标尺寸均�?`THEME_TOKENS`�?- [ ] 运行 `npm run lint:colors` �?error�?- [ ] 运行 `npm run audit:tokens` 无违规；
- [ ] 不确定时查看 `./design-token-mapping.md`�?
---

## 8. 相关文件

- `src/constants/theme.tokens.ts` �?令牌 barrel 导出
- `src/constants/theme/theme.tokens.base.ts` �?L1 基础令牌
- `src/constants/theme/theme.tokens.color.ts` �?L2 语义�?- `src/constants/theme/theme.tokens.shades.ts` �?L3 色阶 + 辅助函数
- `src/constants/theme/theme.tokens.helpers.ts` �?L3/4 暗色/悬停/渐变 + 图表调色�?- `src/constants/theme/theme.tokens.stock.ts` �?L5 股票颜色
- `src/constants/theme/theme.tokens.design.ts` �?L6 设计系统
- `src/config/chartColors.ts` �?图表与业务调色板
- `./ui-migration-checklist.md` �?UI 迁移检查清�?- `../../AGENTS.md` §3.5 �?颜色令牌规范
