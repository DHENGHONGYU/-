# V9 间距令牌规范（Spacing Tokens）

> **版本**: v0.9.14 P5-SPACE
> **状态**: 已实施
> **最后更新**: 2026-06-30

## 设计原则

1. **基于 4px 栅格系统** — 所有间距必须是 4px 的倍数，确保视觉节奏统一
2. **语义化命名优先** — 使用 `cardPadding`、`sectionGap` 等语义化名称而非数值命名
3. **分层使用** — 优先使用语义化 token，基础 token（xs/sm/md/lg）仅用于特殊场景
4. **Tailwind 优先** — 组件 className 中的间距优先使用 Tailwind 类名（`p-4`、`gap-2` 等），`SPACING_TOKENS` 主要用于 style 内联样式和 JavaScript 计算场景

## 令牌清单

### 基础间距（4px 栅格）

| Token | 值 | 等效 Tailwind | 用途 |
|-------|-----|--------------|------|
| `xs` | `4px` | `p-1` / `gap-1` | 极小间距，图标与文本细微调整 |
| `sm` | `8px` | `p-2` / `gap-2` | 小间距，文本间距、紧凑布局 |
| `md` | `12px` | `p-3` / `gap-3` | 中间距，组件间距、表单控件间距 |
| `lg` | `16px` | `p-4` / `gap-4` | 大间距，卡片内边距、区块内间距 |
| `xl` | `24px` | `p-6` / `gap-6` | 超大间距，区块间距、页面元素间距 |
| `xxl` | `32px` | `p-8` / `gap-8` | 极大间距，大区块分隔 |
| `xxxl` | `48px` | `p-12` / `gap-12` | 巨间距，页面级布局分隔 |

### 语义化间距

| Token | 值 | 用途 |
|-------|-----|------|
| `sectionGap` | `24px` | 区块之间的间距 |
| `cardPadding` | `16px` | 卡片内边距 |
| `componentGap` | `12px` | 组件之间的间距 |
| `textGap` | `8px` | 文本行之间的间距 |
| `iconGap` | `8px` | 图标与文本之间的间距 |
| `inputPadding` | `8px 12px` | 输入框内边距（垂直 水平） |

### 布局间距

| Token | 值 | 用途 |
|-------|-----|------|
| `pagePadding` | `24px` | 页面内边距 |
| `widgetGap` | `16px` | Widget 之间的间距 |
| `tableCellPadding` | `8px 12px` | 表格单元格内边距（垂直 水平） |

## 使用规范

### 1. 引入方式

```typescript
import { SPACING_TOKENS } from '@/constants/theme.tokens'
import type { SpacingKey } from '@/constants/theme.tokens'
```

### 2. 使用场景

#### 适用场景

- **style 内联样式**中的 padding / margin / gap
- JavaScript 动态计算间距
- 图表、Canvas 等非 Tailwind 场景的间距配置
- 常量定义中的间距值

```tsx
// 正确：style 内联样式使用 SPACING_TOKENS
<div style={{ padding: SPACING_TOKENS.cardPadding }}>
  ...
</div>

// 正确：JavaScript 计算中使用
const gap = isCompact ? SPACING_TOKENS.sm : SPACING_TOKENS.md
```

#### 不适用场景

- **className 中的 Tailwind 间距类** — 直接使用 Tailwind 类名即可，无需转为 style
- 边框宽度、字体大小、圆角等非间距属性
- 宽度、高度、定位等结构性尺寸

```tsx
// 正确：className 直接用 Tailwind 类名
<div className="p-4 gap-2">
  ...
</div>

// 错误：不必要地将 Tailwind 类转为 style
<div style={{ padding: SPACING_TOKENS.lg, gap: SPACING_TOKENS.sm }}>
  ...
</div>
```

### 3. Token 选择优先级

1. **优先使用语义化 token** — `cardPadding`、`sectionGap`、`componentGap` 等
2. **其次使用布局 token** — `pagePadding`、`widgetGap`、`tableCellPadding` 等
3. **基础 token 仅用于特殊场景** — `xs` / `sm` / `md` / `lg` 等

### 4. 禁止事项

- 禁止在组件中直接写 px 数值作为间距
- 禁止使用 4px 栅格以外的间距值（如 5px、7px、10px）
- 禁止将 SPACING_TOKENS 用于非间距属性（如宽度、高度、字体大小）

## 与现有系统的关系

### THEME_TOKENS 对比

项目中已存在 `THEME_TOKENS.spacing` 和 `THEME_TOKENS.gap`，它们返回 Tailwind 类名字符串，用于 className 属性。

| 系统 | 输出格式 | 使用位置 | 场景 |
|------|---------|---------|------|
| `THEME_TOKENS.spacing` | Tailwind 类名（`p-4`） | className | 静态间距 |
| `THEME_TOKENS.gap` | Tailwind 类名（`gap-2`） | className | 静态 gap |
| `SPACING_TOKENS` | px 字符串（`16px`） | style / JS | 动态间距、内联样式 |

两者互补，不冲突。日常开发优先使用 Tailwind 类名（THEME_TOKENS），需要内联样式或 JS 计算时使用 SPACING_TOKENS。

## 现有 px 硬编码分析

### 全项目 px 分布

截至 v0.9.14，全项目 `src/` 目录共 **59 处** px 硬编码，分布如下：

| 文件 | 数量 | 主要类型 | 是否间距 |
|------|------|---------|---------|
| `trade.constants.ts` | 9 | 表格列宽 `w-[100px]` | 否（宽度） |
| `VirtualizedHoldingsTable.tsx` | 9 | 列宽、行高、定位 | 否（宽度/高度/定位） |
| `HoldingsTable.tsx` | 5 | 列宽、定位偏移 | 否（宽度/定位） |
| `InputDashboard.tsx` | 5 | 输入框最小宽度 | 否（宽度） |
| 其他文件 | 31 | 字体大小、容器高度、最大宽度等 | 否 |

### 结论

项目全面使用 Tailwind CSS，**padding / margin / gap 等间距属性已全部通过 Tailwind 类名实现语义化**，不存在 px 硬编码的间距。现有 px 硬编码主要集中在列宽、行高、字体大小、定位偏移等结构性尺寸，不属于间距范畴，不在本次 P5-SPACE 替换范围内。

### 后续建议

如需进一步减少 px 硬编码，可考虑以下后续任务：

- **P5-SIZE**: 建立尺寸令牌系统（宽度、高度、列宽等）
- **P5-TYPO**: 建立字体大小令牌系统
- **P5-RADIUS**: 完善圆角令牌系统

## 类型定义

```typescript
export type SpacingKey = keyof typeof SPACING_TOKENS
// 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'xxl' | 'xxxl'
// | 'sectionGap' | 'cardPadding' | 'componentGap'
// | 'textGap' | 'iconGap' | 'inputPadding'
// | 'pagePadding' | 'widgetGap' | 'tableCellPadding'
```
