---
title: Design Tokens 系统使用指南
type: reference
domain: frontend
phase: design
tier: standard
status: active
maintainer: V9 Architecture Team
summary: "## 概述 V9 智能投研复盘系统采用统一�?Design Tokens..."
tags: [frontend, token, design, system]
version: v1.0.0
last_updated: 2026-07-17
code_version: 2.0.0
change_log:
  - version: v1.0.0
changes: Initial version established
date: 2026-07-17
---

# Design Tokens 系统使用指南

## 概述

V9 智能投研复盘系统采用统一�?Design Tokens 架构，确保颜色、间距、字体等视觉元素的一致性和可维护性。系统支�?light/dark 主题切换，所有令牌通过 JSON 规范文件生成�?
## 架构层次

```
design-tokens/tokens.json (单一数据�?
    �?scripts/generate-tokens.ts (生成�?
    �?src/generated/tokens.css (CSS 变量)
src/generated/tokens.ts (TypeScript 常量)
    �?src/constants/theme.tokens.ts (语义化令�?
    �?组件�?(消费令牌)
```

## 快速开�?
### 1. 在组件中使用颜色令牌

```tsx
import { COLOR_TOKENS, COLOR_SHADES, twText, twBg } from '@/constants/theme.tokens'

// �?正确：使用语义化令牌
<span className={COLOR_TOKENS.up.tailwind}>上涨</span>
<div className={COLOR_TOKENS.bgCard.bgClass}>卡片背景</div>
<span style={{ color: COLOR_TOKENS.danger.hex }}>危险</span>

// �?正确：使用色阶令�?<div className={COLOR_SHADES.red[50]}>浅红背景</div>
<span className={COLOR_SHADES.blue[600]}>深蓝文字</span>

// �?正确：使用辅助函�?<span className={twText('red', 600)}>深红文字</span>
<div className={twBg('blue', 50)}>浅蓝背景</div>

// �?错误：硬编码颜色
<span className="text-red-500">上涨</span>
<div style={{ color: '#ef4444' }}>危险</div>
```

### 2. 主题切换

```tsx
import { useThemeStore } from '@/store/themeStore'

function MyComponent() {
  const { mode, resolvedMode, setMode, toggleTheme, cycleMode } = useThemeStore()

  return (
    <div>
      <p>当前主题: {resolvedMode}</p>
      <button onClick={toggleTheme}>切换 light/dark</button>
      <button onClick={cycleMode}>循环 light �?dark �?system</button>
      <button onClick={() => setMode('light')}>亮色模式</button>
      <button onClick={() => setMode('dark')}>暗色模式</button>
      <button onClick={() => setMode('system')}>跟随系统</button>
    </div>
  )
}
```

### 3. 使用间距令牌

```tsx
import { SPACING_TOKENS } from '@/constants/theme.tokens'

<div style={{ padding: SPACING_TOKENS.cardPadding }}>
  卡片内容
</div>

<div style={{ gap: SPACING_TOKENS.sectionGap }}>
  区块内容
</div>
```

## 令牌分类

### 1. 颜色令牌 (COLOR_TOKENS)

#### 股票涨跌�?```tsx
COLOR_TOKENS.up       // 上涨 - 红色 (#ef4444)
COLOR_TOKENS.down     // 下跌 - 绿色 (#22c55e)
COLOR_TOKENS.neutral  // 平盘 - 灰色 (#9ca3af)
```

#### 状态色
```tsx
COLOR_TOKENS.info     // 信息 - 蓝色 (#3b82f6)
COLOR_TOKENS.success  // 成功 - 绿色 (#15803d)
COLOR_TOKENS.warning  // 警告 - 琥珀 (#f59e0b)
COLOR_TOKENS.danger   // 危险 - 红色 (#ef4444)
```

#### 评分等级�?```tsx
COLOR_TOKENS.scoreHigh  // 高分 - 绿色
COLOR_TOKENS.scoreMid   // 中分 - 琥珀
COLOR_TOKENS.scoreLow   // 低分 - 红色
```

#### 轮动因子�?```tsx
COLOR_TOKENS.factorJingqi     // 景气因子 - 红色
COLOR_TOKENS.factorZijin      // 资金因子 - 琥珀
COLOR_TOKENS.factorGuzhi      // 估值因�?- 蓝色
COLOR_TOKENS.factorBeta       // β因子 - 紫色
COLOR_TOKENS.factorNengliang  // 量能因子 - 青色
```

#### 信号分级�?```tsx
COLOR_TOKENS.signalStrong         // 强信�?- 翠绿
COLOR_TOKENS.signalMediumStrong   // 中强信号 - 绿色
COLOR_TOKENS.signalMedium         // 中信�?- 蓝色
COLOR_TOKENS.signalWeak           // 弱信�?- 琥珀
COLOR_TOKENS.signalNone           // 无信�?- 灰色
```

#### 背景�?```tsx
COLOR_TOKENS.bgCard     // 卡片背景 - 白色
COLOR_TOKENS.bgHover    // 悬停背景 - 浅灰
COLOR_TOKENS.bgMuted    // 次要背景 - 灰色
COLOR_TOKENS.bgEmerald50  // 浅翠绿背�?COLOR_TOKENS.bgGreen50    // 浅绿背景
COLOR_TOKENS.bgBlue50     // 浅蓝背景
COLOR_TOKENS.bgAmber50    // 浅琥珀背景
```

#### 文字�?```tsx
COLOR_TOKENS.textPrimary    // 主要文字 - 深色
COLOR_TOKENS.textSecondary  // 次要文字 - 中灰
COLOR_TOKENS.textMuted      // 弱化文字 - 浅灰
```

#### 边框�?```tsx
COLOR_TOKENS.border       // 默认边框
COLOR_TOKENS.borderHover  // 悬停边框
```

### 2. 色阶令牌 (COLOR_SHADES)

用于需要特定色阶的场景�?
```tsx
// 红色色阶
COLOR_SHADES.red[50]   // bg-red-50
COLOR_SHADES.red[100]  // bg-red-100
COLOR_SHADES.red[200]  // border-red-200
COLOR_SHADES.red[500]  // text-red-500
COLOR_SHADES.red[600]  // text-red-600
COLOR_SHADES.red[700]  // text-red-700

// 暗色模式变体
COLOR_SHADES.red['200Dark']      // dark:text-red-200
COLOR_SHADES.red['900DarkBg']    // dark:bg-red-950
COLOR_SHADES.red['900DarkBorder'] // dark:border-red-900

// HEX �?COLOR_SHADES.red.hex[500]  // #ef4444
```

### 3. 间距令牌 (SPACING_TOKENS)

```tsx
// 基础间距
SPACING_TOKENS.xs    // 4px
SPACING_TOKENS.sm    // 8px
SPACING_TOKENS.md    // 12px
SPACING_TOKENS.lg    // 16px
SPACING_TOKENS.xl    // 24px
SPACING_TOKENS.xxl   // 32px
SPACING_TOKENS.xxxl  // 48px

// 语义化间�?SPACING_TOKENS.sectionGap        // 24px - 区块间距
SPACING_TOKENS.cardPadding       // 16px - 卡片内边�?SPACING_TOKENS.componentGap      // 12px - 组件间距
SPACING_TOKENS.textGap           // 8px - 文本间距
SPACING_TOKENS.iconGap           // 8px - 图标间距
SPACING_TOKENS.inputPadding      // 8px 12px - 输入框内边距
SPACING_TOKENS.pagePadding       // 24px - 页面内边�?SPACING_TOKENS.widgetGap         // 16px - Widget 间距
SPACING_TOKENS.tableCellPadding  // 8px 12px - 表格单元格内边距
```

### 4. 主题令牌 (THEME_TOKENS)

```tsx
// 颜色
THEME_TOKENS.color.info          // text-blue-500
THEME_TOKENS.color.infoBg        // bg-blue-500
THEME_TOKENS.color.infoRaw       // #3b82f6
THEME_TOKENS.color.warning       // text-amber-500
THEME_TOKENS.color.success       // text-green-500
THEME_TOKENS.color.destructive   // text-red-500
THEME_TOKENS.color.muted         // text-gray-500
THEME_TOKENS.color.border        // border-gray-200

// 图标尺寸
THEME_TOKENS.iconSizes.xs  // h-3 w-3
THEME_TOKENS.iconSizes.sm  // h-4 w-4
THEME_TOKENS.iconSizes.md  // h-5 w-5
THEME_TOKENS.iconSizes.lg  // h-6 w-6
THEME_TOKENS.iconSizes.xl  // h-8 w-8

// 控件尺寸
THEME_TOKENS.controlSizes.xs  // h-6
THEME_TOKENS.controlSizes.sm  // h-8
THEME_TOKENS.controlSizes.md  // h-10
THEME_TOKENS.controlSizes.lg  // h-12

// 间距
THEME_TOKENS.spacing.xs   // p-1
THEME_TOKENS.spacing.sm   // p-2
THEME_TOKENS.spacing.md   // p-4
THEME_TOKENS.spacing.lg   // p-6

// 圆角
THEME_TOKENS.radius.sm    // rounded-sm
THEME_TOKENS.radius.md    // rounded-md
THEME_TOKENS.radius.lg    // rounded-lg
THEME_TOKENS.radius.full  // rounded-full

// 间隙
THEME_TOKENS.gap.xs   // gap-1
THEME_TOKENS.gap.sm   // gap-2
THEME_TOKENS.gap.md   // gap-3
THEME_TOKENS.gap.lg   // gap-4
THEME_TOKENS.gap.xl   // gap-6

// 堆叠间隙
THEME_TOKENS.stackGap.xs   // space-y-1
THEME_TOKENS.stackGap.sm   // space-y-2
THEME_TOKENS.stackGap.md   // space-y-3
THEME_TOKENS.stackGap.lg   // space-y-4
THEME_TOKENS.stackGap.xl   // space-y-6

// 评分阈�?THEME_TOKENS.score.excellent  // 4
THEME_TOKENS.score.good       // 3
THEME_TOKENS.score.ok         // 2

// 焦点样式
THEME_TOKENS.focusVisible.ringWidth   // ring-2
THEME_TOKENS.focusVisible.ringColor   // ring-blue-500
THEME_TOKENS.focusVisible.ringOffset  // ring-offset-2
```

### 5. 图表令牌 (CHART_PALETTE)

```tsx
import { CHART_PALETTE } from '@/constants/theme.tokens'

// 系列�?CHART_PALETTE.series1  // #3b82f6 - �?CHART_PALETTE.series2  // #10b981 - 翠绿
CHART_PALETTE.series3  // #f59e0b - 琥珀
CHART_PALETTE.series4  // #ef4444 - �?CHART_PALETTE.series5  // #8b5cf6 - �?CHART_PALETTE.series6  // #06b6d4 - �?
// 辅助元素
CHART_PALETTE.grid         // #e5e7eb - 网格�?CHART_PALETTE.axis         // #6b7280 - 坐标轴文�?CHART_PALETTE.tooltipBg    // #1f2937 - 提示框背�?CHART_PALETTE.tooltipText  // #ffffff - 提示框文�?CHART_PALETTE.upColor      // #10b981 - 涨跌�?�?CHART_PALETTE.downColor    // #ef4444 - 涨跌�?�?CHART_PALETTE.accent       // #0ea5e9 - 强调�?```

### 6. 业务配色 (chartColors.ts)

```tsx
import { 
  PIE_CHART_PALETTE,
  ROTATION_FACTOR_COLORS,
  MARKET_STYLE_COLORS,
  SIGNAL_GRADE_COLORS,
  SCORE_BUCKET_COLORS,
  DECLINE_NATURE_COLORS,
  ALERT_LEVEL_COLORS,
  STOCK_POOL_STATUS_RAW_COLORS,
  SECTOR_FACTOR_COLORS,
  AI_AGENT_TAG_COLORS,
  AI_OVERVIEW_CARD_COLORS,
  SENTIMENT_TREND_COLORS
} from '@/config/chartColors'

// 饼图调色�?<RechartsPie data={data} colors={PIE_CHART_PALETTE} />

// 轮动因子�?<LineChart lineColor={ROTATION_FACTOR_COLORS.JINGQI} />

// 市场风格�?<div style={{ color: MARKET_STYLE_COLORS.GROWTH }}>成长�?/div>

// 信号分级�?<Badge style={{ backgroundColor: SIGNAL_GRADE_COLORS.STRONG }}>强信�?/Badge>
```

## 暗色模式支持

### 使用 DARK 辅助�?
```tsx
import { DARK, HOVER, GRADIENT } from '@/constants/theme.tokens'

<div className={`${DARK.bgSlate800} ${DARK.textSlate100}`}>
  暗色模式背景 + 文字
</div>

<div className={`${HOVER.bgRed100} ${HOVER.bgSlate200}`}>
  悬停效果
</div>

<div className={`${GRADIENT.fromEmerald500} ${GRADIENT.toSky500}`}>
  渐变背景
</div>
```

### 使用 COLOR_SHADES 暗色变体

```tsx
<div className={`${COLOR_SHADES.red[50]} ${COLOR_SHADES.red['200Dark']}`}>
  浅红背景 + 暗色模式浅红文字
</div>

<div className={COLOR_SHADES.red['900DarkBg']}>
  暗色模式深红背景
</div>
```

## 生成令牌

### 运行生成�?
```bash
npm run generate:tokens
```

### 生成输出

- `src/generated/tokens.css` - CSS 变量（自动应用到 `:root`�?- `src/generated/tokens.ts` - TypeScript 常量

### 修改令牌

1. 编辑 `design-tokens/tokens.json`
2. 运行 `npm run generate:tokens`
3. 提交变更

## 验证规则

### ESLint 规则

系统已配�?ESLint 规则防止硬编码颜色值：

```bash
npm run lint
```

### 审计脚本

```bash
npm run audit:hardcode  # 扫描颜色硬编码违�?```

### 豁免清单

以下文件允许颜色硬编码：
- `src/constants/theme.tokens.ts` - 令牌定义文件
- `src/config/chartColors.ts` - 图表配色定义
- `src/config/themeRegistry.ts` - 主题注册文件
- `src/theme.config.ts` - 主题配置文件
- `tests/` 目录 - 测试文件

## 最佳实�?
### �?推荐做法

1. **使用语义化令�?*
   ```tsx
   <span className={COLOR_TOKENS.up.tailwind}>上涨</span>
   ```

2. **使用色阶令牌**
   ```tsx
   <div className={COLOR_SHADES.red[50]}>浅红背景</div>
   ```

3. **使用辅助函数**
   ```tsx
   <span className={twText('red', 600)}>深红文字</span>
   ```

4. **图表使用业务配色**
   ```tsx
   <PieChart colors={PIE_CHART_PALETTE} />
   ```

5. **暗色模式使用 DARK 辅助�?*
   ```tsx
   <div className={DARK.bgSlate800}>暗色背景</div>
   ```

### �?禁止做法

1. **硬编�?HEX �?*
   ```tsx
   // �?错误
   <div style={{ color: '#ef4444' }}>危险</div>
   ```

2. **硬编�?Tailwind 颜色�?*
   ```tsx
   // �?错误
   <span className="text-red-500">上涨</span>
   ```

3. **内联 RGB/HSL**
   ```tsx
   // �?错误
   <div style={{ color: 'rgb(239, 68, 68)' }}>危险</div>
   ```

## 常见问题

### Q: 如何添加新的颜色令牌�?
A: 按照以下决策树选择放置位置�?
```
需要新颜色�?├── 通用语义色（info/warning/success 级别）？
�?  └── �?添加�?THEME_TOKENS.color + COLOR_TOKENS
├── 业务语义色（涨跌/评分/信号/因子）？
�?  └── �?添加�?COLOR_TOKENS 对应分区
├── 图表专用色（饼图/热力�?轮动图）�?�?  └── �?添加�?src/config/chartColors.ts
├── 需要特定色阶（�?red-50、red-600）？
�?  └── �?添加�?COLOR_SHADES 对应色系
└── 定制色（非标准色）？
    └── �?添加�?chartColors.ts 并注释说�?```

### Q: 如何在组件中切换主题�?
A: 使用 `useThemeStore`�?
```tsx
import { useThemeStore } from '@/store/themeStore'

const { setMode, toggleTheme, cycleMode } = useThemeStore()
setMode('dark')      // 切换到暗色模�?toggleTheme()        // �?light/dark 之间切换
cycleMode()          // �?light �?dark �?system 循环
```

### Q: 生成�?CSS 变量如何使用�?
A: CSS 变量已自动应用到 `:root`，可以直接使用：

```tsx
<div style={{ color: 'var(--color-base-red-500)' }}>红色文字</div>
```

### Q: 如何测试暗色模式�?
A: 在浏览器开发者工具中�?
1. 打开开发者工�?(F12)
2. 切换�?Console 标签
3. 运行：`document.documentElement.setAttribute('data-theme', 'dark')`

或使用主题切换按钮测试�?
## 相关文档

- [Design Tokens 规范](https://design-tokens.github.io/community-group/format/)
- [Tailwind CSS 文档](https://tailwindcss.com/docs)
- [V9 架构指南](../explanation/architecture.md)

### 7. 门户布局令牌 (PORTAL_TOKENS)

`PORTAL_TOKENS` �?L6 设计系统层的扩展，专�?`PortalShell` 提供布局、导航、舱室切换、移动端导航、状态指示等样式令牌，消除组件层硬编码颜色类�?
```tsx
import { PORTAL_TOKENS } from '@/constants/theme.tokens'

const { layout, cabin, nav, mobile, status, brand } = PORTAL_TOKENS

// 布局
layout.shellBg     // bg-background
layout.headerBg    // bg-background/90 backdrop-blur-md
layout.sidebarBg   // bg-muted/70
layout.mainBg      // bg-card

// 舱室切换�?cabin.active       // bg-card text-foreground shadow-sm
cabin.inactive     // text-muted-foreground hover:text-foreground hover:bg-muted/80

// 侧边栏导�?nav.active         // bg-card text-foreground shadow-sm
nav.activeIndicator // before:bg-primary
nav.inactive       // text-muted-foreground hover:bg-muted hover:text-foreground

// 移动�?mobile.hamburger        // text-muted-foreground hover:bg-muted
mobile.bottomNavBg      // bg-background/95 backdrop-blur-md border-t border-border
mobile.bottomNavActive  // text-primary
mobile.bottomNavInactive // text-muted-foreground

// 状态指�?status.checking     // bg-amber-400/80 ring-1 ring-amber-400/40 animate-pulse
status.connected    // bg-emerald-500/80 ring-1 ring-emerald-500/40
status.disconnected // bg-destructive/80 ring-1 ring-destructive/40

// 品牌
brand.logoGradient // from-primary to-emerald-600
brand.logoText     // text-white
brand.logoShadow   // shadow-primary/20
```

## 主题切换

### 使用 themeStore

V9 使用基于 Zustand �?`themeStore` 管理主题模式（`light` / `dark` / `system`），并持久化�?`localStorage`�?
```tsx
import { useThemeStore } from '@/store/themeStore'

function MyComponent() {
  const { mode, resolvedMode, setMode, toggleTheme, cycleMode } = useThemeStore()

  return (
    <div>
      <p>当前模式: {mode}（实�? {resolvedMode}�?/p>
      <button onClick={toggleTheme}>切换 light/dark</button>
      <button onClick={cycleMode}>循环 light �?dark �?system</button>
      <button onClick={() => setMode('system')}>跟随系统</button>
    </div>
  )
}
```

- `mode`: 用户选择的模式（`light` | `dark` | `system`�?- `resolvedMode`: 解析后的实际主题（`light` | `dark`�?- `setMode(mode)`: 设置指定模式
- `toggleTheme()`: �?`light` / `dark` 之间切换
- `cycleMode()`: �?`light �?dark �?system �?light` 循环

主题状态会在应用启动时�?`localStorage` 恢复，并�?`system` 模式下自动响应系统主题变化�?
### �?ThemeProvider 的关�?
`themeStore` 已取�?`src/core/ThemeProvider.tsx` 成为主题唯一真相源。`ThemeProvider` 已退役并�?`App.tsx` 中移除，新代码应统一使用 `useThemeStore`�?
## 更新日志

- **2026-07-15**: 新增 `PORTAL_TOKENS`（L6 门户布局令牌扩展）；新增 `themeStore` 统一管理 light/dark/system 主题切换；`PortalShell.tsx` 全面改用 PORTAL_TOKENS 并集�?themeStore�?- **2026-07-05**: 初始版本，建�?Design Tokens 系统和主题切换机�?