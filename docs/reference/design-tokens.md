---
doc_id: V9-DOC-REF-939
title: design-tokens
type: reference
domain: frontend
phase: design
status: active
maintainer: UI Team
summary: "FinSight V9 Design Token System V8 Apple Business Edition 完整规范"
tags: [design-tokens, apple-design, css-variables, tailwind, color-system, typography]
version: v2.0.0
last_updated: 2026-08-19
code_version: 2.0.0-rc.2
tier: important
related_docs:
  - V9-DOC-REF-940
  - V9-DOC-GUIDE-001
  - V9-DOC-META-001
change_log:
  - version: v2.0.0
    changes: "V8 Apple Business Edition 全面升级：暖象牙灰→Apple冷白，对齐Apple Human Interface Guidelines"
    date: 2026-08-19
  - version: v1.1.0
    changes: "twBg/twText/twBorder 全面废弃，迁移至 CSS 变量语义令牌"
    date: 2026-08-13
  - version: v1.0.0
    changes: "P0 版本闭环(2026-08-11)：补全 change_log 初始条目"
    date: 2026-08-11
---
covers_code:
  - src/constants/theme/theme.tokens.color.ts
  - src/constants/theme.tokens.ts
  - src/config/chartColors.ts


# FinSight V9 Design Token System

> **版本**: V8 (Apple Business Edition)
> **更新日期**: 2026-08-19
> **设计基准**: Apple Human Interface Guidelines · iOS/macOS Design Tokens
> **主题**: 冷色调 · 专业简洁 · 视觉层次清晰

---

## 一、架构概览

### 1.1 设计哲学

FinSight V9 采用 Apple Business 设计语言，核心设计原则：

| 原则 | 说明 |
|------|------|
| **冷色调** | 使用 HSL 240 色相家族，呈现专业、冷静的视觉感受 |
| **纯白卡片** | 背景使用 #FFFFFF，配合轻微阴影实现浮层效果 |
| **Apple Blue** | 主色 `#007AFF`，贯穿按钮、链接、焦点状态 |
| **静态阴影** | alpha ≤ 0.05，克制而有层次 |
| **浮层阴影** | alpha ≤ 0.08，对话框/下拉菜单等临时元素 |
| **紧凑排版** | 14px 基准字号，紧凑行高，高效信息密度 |

### 1.2 架构层次

```
┌─────────────────────────────────────────────────────────────┐
│                    CSS Variables (Source of Truth)           │
│                         src/index.css                        │
├─────────────────────────────────────────────────────────────┤
│                    Tailwind Configuration                     │
│                      tailwind.config.js                       │
├─────────────────────────────────────────────────────────────┤
│                    Semantic Token Constants                   │
│              src/constants/theme/ (COLOR_TOKENS, etc.)       │
├─────────────────────────────────────────────────────────────┤
│                    Component Layer                            │
│         Card, PageContainer, Button, Badge, etc.             │
└─────────────────────────────────────────────────────────────┘
```

### 1.3 文件索引

| 文件 | 角色 | 优先级 |
|------|------|--------|
| `src/index.css` | CSS 变量真相源 | T0 |
| `tailwind.config.js` | Tailwind 配置映射 | T0 |
| `src/constants/theme/theme.tokens.color.ts` | 颜色语义令牌 | T0 |
| `src/constants/theme.tokens.ts` | 综合令牌出口 | T1 |

---

## 二、颜色系统

### 2.1 核心语义色 (Semantic Colors)

#### 背景与前景

| CSS 变量 | HSL 值 | 近似色值 | Tailwind 类 | 用途 |
|----------|--------|----------|-------------|------|
| `--background` | `240 24% 96%` | `#F5F5F7` | `bg-background` | 页面主背景 (Apple System Gray) |
| `--foreground` | `240 3% 12%` | `#1F1F24` | `text-foreground` | 主文字颜色 |
| `--card` | `0 0% 100%` | `#FFFFFF` | `bg-card` | 卡片背景 (纯白) |
| `--card-foreground` | `240 3% 12%` | `#1F1F24` | `text-card-foreground` | 卡片内文字 |
| `--popover` | `0 0% 100%` | `#FFFFFF` | `bg-popover` | 弹出层背景 |
| `--popover-foreground` | `240 3% 12%` | `#1F1F24` | `text-popover-foreground` | 弹出层文字 |

#### 主色与强调色

| CSS 变量 | HSL 值 | 近似色值 | Tailwind 类 | 用途 |
|----------|--------|----------|-------------|------|
| `--primary` | `210 100% 50%` | `#007AFF` | `bg-primary` | Apple Blue · 主操作按钮、链接 |
| `--primary-foreground` | `0 0% 100%` | `#FFFFFF` | `text-primary-foreground` | 主色上的文字 |
| `--secondary` | `240 5% 94%` | `#F0F0F3` | `bg-secondary` | 次要背景 (Apple Grouped Background) |
| `--secondary-foreground` | `240 3% 12%` | `#1F1F24` | `text-secondary-foreground` | 次要背景上的文字 |
| `--accent` | `240 5% 94%` | `#F0F0F3` | `bg-accent` | 强调背景 |
| `--accent-foreground` | `240 3% 12%` | `#1F1F24` | `text-accent-foreground` | 强调背景上的文字 |

#### 中性色

| CSS 变量 | HSL 值 | 近似色值 | Tailwind 类 | 用途 |
|----------|--------|----------|-------------|------|
| `--muted` | `240 5% 94%` | `#F0F0F3` | `bg-muted` | 弱化背景 |
| `--muted-foreground` | `240 2% 45%` | `#595963` | `text-muted-foreground` | 次要文字 (Apple Secondary Label) |
| `--border` | `240 6% 88%` | `#E3E3E8` | `border-border` | 标准边框 |
| `--input` | `240 6% 88%` | `#E3E3E8` | `border-input` | 输入框边框 |
| `--ring` | `210 100% 50%` | `#007AFF` | `ring-ring` | 焦点环颜色 |

#### 状态色

| CSS 变量 | HSL 值 | 近似色值 | Tailwind 类 | 用途 |
|----------|--------|----------|-------------|------|
| `--success` | `142 71% 45%` | `#22C55E` | `bg-success` | 成功状态 |
| `--success-foreground` | `0 0% 100%` | `#FFFFFF` | `text-success-foreground` | 成功状态上的文字 |
| `--warning` | `36 100% 50%` | `#F59E0B` | `bg-warning` | 警告状态 |
| `--warning-foreground` | `0 0% 100%` | `#FFFFFF` | `text-warning-foreground` | 警告状态上的文字 |
| `--info` | `210 100% 50%` | `#0A84FF` | `bg-info` | 信息状态 |
| `--info-foreground` | `0 0% 100%` | `#FFFFFF` | `text-info-foreground` | 信息状态上的文字 |
| `--destructive` | `0 84% 60%` | `#EF4444` | `bg-destructive` | 错误/危险状态 |
| `--destructive-foreground` | `0 0% 100%` | `#FFFFFF` | `text-destructive-foreground` | 错误状态上的文字 |

### 2.2 语义化颜色令牌 (COLOR_TOKENS)

定义于 `src/constants/theme/theme.tokens.color.ts`：

```typescript
export const COLOR_TOKENS = {
  // 股票涨跌色 (中国市场惯例：红涨绿跌)
  up:      { hex: '#ef4444', tailwind: 'bg-destructive', rgb: '239, 68, 68' },
  down:    { hex: '#22c55e', tailwind: 'bg-success',    rgb: '34, 197, 94'  },
  neutral: { hex: '#9ca3af', tailwind: 'bg-stock-neutral', rgb: '156, 163, 175' },

  // 状态色
  info:    { hex: '#007aff', tailwind: 'bg-info',    rgb: '0, 122, 255'  },
  success: { hex: '#21c45d', tailwind: 'bg-success', rgb: '33, 196, 93'  },
  warning: { hex: '#f59e0b', tailwind: 'bg-warning', rgb: '245, 158, 11' },
  danger:  { hex: '#ef4444', tailwind: 'bg-destructive', rgb: '239, 68, 68' },

  // 评分等级
  scoreHigh: { hex: '#22c55e', tailwind: 'bg-score-high' },
  scoreMid:  { hex: '#f59e0b', tailwind: 'bg-score-mid'  },
  scoreLow:  { hex: '#ef4444', tailwind: 'bg-score-low'  },

  // 背景色 (Apple 风格)
  bgCard:  { hex: '#ffffff', tailwind: 'bg-card'    },  // 纯白卡片
  bgHover: { hex: '#f5f5f5', tailwind: 'bg-muted'   },  // 悬停背景
  bgMuted: { hex: '#e5e5e5', tailwind: 'bg-muted'   },  // 次要背景

  // 文字色
  textPrimary:   { hex: '#1f1f24', tailwind: 'text-foreground'     },
  textSecondary: { hex: '#595963', tailwind: 'text-muted-foreground' },
  textMuted:     { hex: '#8e8e93', tailwind: 'text-tertiary'       },

  // 边框色
  border:      { hex: '#e3e3e8', tailwind: 'border-border'  },
  borderHover: { hex: '#d1d1d6', tailwind: 'border-border'  },
}
```

### 2.3 状态色透明变体

| 用途 | Tailwind 类 | 效果 |
|------|-------------|------|
| 成功徽章背景 | `bg-success/20` | 20% 透明度绿色底 |
| 警告徽章背景 | `bg-warning/20` | 20% 透明度琥珀底 |
| 错误徽章背景 | `bg-destructive/20` | 20% 透明度红色底 |
| 信息徽章背景 | `bg-info/20` | 20% 透明度蓝色底 |

### 2.4 暗色模式映射

| 亮色变量 | 暗色变量 | 暗色 HSL | 暗色近似值 |
|----------|----------|----------|------------|
| `--background` | → | `240 5% 8%` | `#111114` |
| `--foreground` | → | `240 10% 96%` | `#F2F2F7` |
| `--card` | → | `240 4% 12%` | `#1C1C1E` |
| `--primary` | → | `210 100% 60%` | `#3B82F6` |
| `--secondary` | → | `240 4% 16%` | `#2C2C2E` |
| `--muted-foreground` | → | `240 3% 60%` | `#8E8E93` |
| `--border` | → | `240 4% 24%` | `#38383A` |

---

## 三、字体系统

### 3.1 字体栈

```
--font-family-sans:
  DM Sans, SF Pro Display, Inter,
  PingFang SC, Microsoft YaHei,
  system-ui, -apple-system, BlinkMacSystemFont,
  "Segoe UI", Roboto, sans-serif

--font-family-mono:
  SF Mono, JetBrains Mono, Fira Code,
  Consolas, monospace
```

### 3.2 排版阶梯

| Token | 字号 | 行高 | 字重 | 字间距 | Tailwind 类 | 用途 |
|-------|------|------|------|--------|-------------|------|
| `--fs-display` | 28px (1.75rem) | 1.2 | 700 | 0em | `text-display` | 页面主标题 |
| `--fs-h1` | 24px (1.5rem) | 1.25 | 700 | 0em | `text-h1` | 一级标题 |
| `--fs-h2` | 20px (1.25rem) | 1.3 | 600 | - | `text-h2` | 二级标题 |
| `--fs-h3` | 18px (1.125rem) | 1.4 | 600 | - | `text-h3` | 三级标题 |
| `--fs-h4` | 16px (1rem) | 1.4 | 600 | - | `text-h4` | 四级标题 |
| `--fs-h5` | 15px (0.9375rem) | 1.4 | 500 | - | `text-h5` | 五级标题 |
| `--fs-h6` | 13px (0.8125rem) | 1.4 | 600 | - | `text-h6` | 六级标题 |
| `--fs-body-lg` | 16px (1rem) | 1.6 | 400 | - | `text-body-lg` | 大号正文 |
| `--fs-body` | 14px (0.875rem) | 1.6 | 400 | - | `text-body` | 默认正文 |
| `--fs-body-sm` | 13px (0.8125rem) | 1.5 | 400 | - | `text-body-sm` | 小号正文 |
| `--fs-caption` | 12px (0.75rem) | 1.4 | 400 | - | `text-caption` | 辅助说明 |
| `--fs-overline` | 11px (0.6875rem) | 1.4 | 600 | 0.08em | `text-overline` | 标签/微型标注 |

### 3.3 字间距规范

| Token | 值 | 用途 |
|-------|-----|------|
| `--tracking-cjk-heading` | `0em` | CJK 标题 (Apple 规范：不使用负字距) |
| `--tracking-cjk-body` | `0.015em` | CJK 正文 |
| `--tracking-cjk-caption` | `0.02em` | CJK 辅助文字 |
| `--tracking-cjk-table` | `0.01em` | CJK 表格 |
| `--tracking-latin-tight` | `-0.02em` | Latin 紧凑 (等宽数字) |
| `--tracking-latin-normal` | `0em` | Latin 正常 |
| `--tracking-latin-wide` | `0.05em` | Latin 宽松 |

### 3.4 全局字体设置

```css
body {
  font-feature-settings: "tnum";  /* 启用等宽数字 */
  font-size: 14px;                 /* 基准字号 */
  line-height: 1.6;                /* 基准行高 */
  letter-spacing: var(--tracking-cjk-body);
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}
```

---

## 四、间距与尺寸

### 4.1 间距扩展

| Token | 值 | Tailwind 类 | 用途 |
|-------|-----|-------------|------|
| 4.5 | 1.125rem (18px) | `p-4.5`, `gap-4.5` | 组件内紧凑间距 |
| 18 | 4.5rem (72px) | `p-18`, `gap-18` | 大间距 (区块分隔) |
| 22 | 5.5rem (88px) | `p-22`, `gap-22` | 超大间距 (Section) |

### 4.2 响应式内边距

| 断点 | 类名 | 间距 | 说明 |
|------|------|------|------|
| 默认 (mobile) | `p-4` | 16px | 移动端内边距 |
| `sm` (640px+) | `sm:p-6` | 24px | 平板端内边距 |
| `lg` (1024px+) | `lg:p-8` | 32px | 桌面端内边距 |

### 4.3 最大宽度

| Token | 值 | Tailwind 类 | 用途 |
|-------|-----|-------------|------|
| container | 1200px | `max-w-container` | 标准页面容器 |
| portal | 1440px | `max-w-portal` | 宽屏门户布局 |

### 4.4 圆角令牌

| Token | 值 | Tailwind 类 | 用途 |
|-------|-----|-------------|------|
| `--radius` | 1rem (16px) | `rounded-2xl` | 卡片、面板 (Apple 标准圆角) |
| `--radius-sm` | calc(1rem - 4px) = 12px | `rounded-xl` | 内嵌卡片、按钮 |
| `--radius-md` | calc(1rem - 2px) = 14px | `rounded-2xl` (自定义) | 次级卡片 |

---

## 五、阴影系统

### 5.1 静态阴影 (alpha ≤ 0.05)

| Token | CSS 值 | Tailwind 类 | 用途 |
|-------|--------|-------------|------|
| `--shadow-sm` | `0 1px 2px 0 rgba(0, 0, 0, 0.04)` | `shadow-elevation-1` | 微元素阴影 |
| `--shadow-md` | `0 2px 6px -1px rgba(0, 0, 0, 0.05)` | `shadow-elevation-2` | 卡片默认阴影 |
| `--surface-elevated` | `0 4px 12px -2px rgba(0, 0, 0, 0.05)` | `shadow-surface-elevated` | 高优先级 Widget |

### 5.2 浮层阴影 (alpha ≤ 0.08)

| Token | CSS 值 | Tailwind 类 | 用途 |
|-------|--------|-------------|------|
| `--shadow-lg` | `0 8px 24px -8px rgba(0, 0, 0, 0.08)` | `shadow-elevation-3` | 大卡片、面板 |
| `--surface-floating` | `0 8px 24px -4px rgba(0, 0, 0, 0.08)` | `shadow-surface-floating` | 弹窗、下拉菜单 |

### 5.3 阴影层级规范

```
┌─────────────────────────────────────────────────────────────┐
│                        阴影层级规范                          │
├─────────────────────────────────────────────────────────────┤
│ Level 0: 无边框无阴影 (分隔线使用 border)                     │
│ Level 1: shadow-elevation-1  (α ≤ 0.04)  ← 微元素           │
│ Level 2: shadow-elevation-2  (α ≤ 0.05)  ← 卡片默认         │
│ Level 3: shadow-elevation-3  (α ≤ 0.08)  ← 浮层/弹窗        │
│                                                             │
│ ⚠️ Apple 规范: 阴影 alpha 必须 ≤ 0.08                       │
└─────────────────────────────────────────────────────────────┘
```

### 5.4 暗色模式阴影

| Token | 暗色 CSS 值 |
|-------|------------|
| `--shadow-sm` | `0 1px 2px 0 rgba(0, 0, 0, 0.35)` |
| `--shadow-md` | `0 2px 6px -1px rgba(0, 0, 0, 0.40)` |
| `--shadow-lg` | `0 8px 24px -8px rgba(0, 0, 0, 0.50)` |

---

## 六、组件样式规范

### 6.1 Card 组件

**设计规范**:
- 背景: 纯白 `#FFFFFF` (`bg-card`)
- 圆角: 16px (`rounded-2xl`)
- 阴影: `shadow-elevation-1` (默认) → `shadow-elevation-2` (hover)
- 过渡: `transition-shadow duration-200`
- 无边框 (使用阴影实现浮层效果)

```tsx
// src/components/atoms/Card.tsx
export const Card = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        'rounded-2xl bg-card text-card-foreground',
        'shadow-elevation-1 transition-shadow duration-200',
        'hover:shadow-elevation-2',
        className,
      )}
      {...props}
    />
  ),
)
```

### 6.2 PageContainer 组件

**设计规范**:
- 最大宽度: 1200px (`max-w-container`)
- 居中: `mx-auto`
- 响应式内边距: `p-4 sm:p-6 lg:p-8`

```tsx
// src/components/templates/PageContainer.tsx
export function PageContainer({ children, className, centered = true }) {
  return (
    <main
      className={cn(
        'w-full p-4 sm:p-6 lg:p-8',
        centered && 'mx-auto max-w-container',
        className,
      )}
    >
      {children}
    </main>
  )
}
```

### 6.3 表面层级工具类

```css
/* 高优先级 Widget */
.widget-card-elevated {
  box-shadow: var(--surface-elevated);
  border-color: hsl(var(--warm-gray) / 0.6);
}

/* 浮层面板 */
.widget-card-floating {
  box-shadow: var(--surface-floating);
  border-color: hsl(var(--border) / 0.8);
}
```

---

## 七、响应式设计

### 7.1 响应式断点

| 断点 | 宽度 | 说明 |
|------|------|------|
| 默认 | 0+ | 移动端 |
| `sm` | 640px+ | 平板 |
| `md` | 768px+ | 大屏平板 |
| `lg` | 1024px+ | 笔记本 |
| `xl` | 1280px+ | 桌面 |

### 7.2 响应式工具类

| 类名 | 说明 | 响应式行为 |
|------|------|-----------|
| `.page-container` | 页面容器 | 自动适配断点内边距 |
| `.chart-responsive` | 图表容器 | 280→320→380px 高度 |
| `.heading-responsive` | 响应式标题 | text-xl → text-2xl → text-3xl |
| `.touch-target` | 触摸目标 | 最小 44×44px |
| `.card-grid` | 卡片网格 | auto-fill, minmax(280px, 1fr) |
| `.card-grid-sm` | 小卡片网格 | auto-fill, minmax(240px, 1fr) |
| `.table-responsive` | 表格容器 | 移动端水平滚动 |
| `.layout-two-col` | 两栏布局 | 移动端堆叠，md+ 并排 |
| `.sidebar-panel` | 侧边栏 | 移动端隐藏 |
| `.mobile-bottom-nav` | 底部导航 | 移动端显示，md+ 隐藏 |
| `.stats-grid` | 统计网格 | 2→3→6 列响应式 |

### 7.3 响应式实现示例

```css
.chart-responsive {
  --chart-height: 280px;
  height: var(--chart-height);
}
@media (min-width: 640px) {
  .chart-responsive { --chart-height: 320px; }
}
@media (min-width: 1024px) {
  .chart-responsive { --chart-height: 380px; }
}

.stats-grid {
  display: grid;
  gap: 0.75rem;
  grid-template-columns: repeat(2, 1fr);
}
@media (min-width: 640px) {
  .stats-grid { grid-template-columns: repeat(3, 1fr); }
}
@media (min-width: 1024px) {
  .stats-grid { grid-template-columns: repeat(6, 1fr); }
}
```

---

## 八、使用指南

### 8.1 正确用法

```tsx
// ✅ 使用语义化 CSS 变量
<div className="bg-background text-foreground">
  <Card className="p-6">
    <h1 className="text-h1 font-bold">标题</h1>
    <p className="text-body text-muted-foreground">正文内容</p>
    <Button className="bg-primary text-primary-foreground">
      按钮
    </Button>
  </Card>
</div>

// ✅ 使用 COLOR_TOKENS
import { COLOR_TOKENS } from '@/constants/theme/color'
<span className={COLOR_TOKENS.up.tailwind}>+2.35%</span>

// ✅ 使用透明度变体
<Badge className="bg-success/20 text-success">成功</Badge>
```

### 8.2 禁止用法

```tsx
// ❌ 禁止：硬编码颜色
<div style={{ color: '#007AFF' }}>
<span className="text-red-500">上涨</span>

// ❌ 禁止：暖色调令牌
<div style={{ backgroundColor: '#f5f5f0' }}>  // 禁止暖灰背景
```

### 8.3 决策流程

```
需要新颜色？
├── 通用语义色？
│   └── 添加到 CSS 变量 + Tailwind 配置 + COLOR_TOKENS
├── 业务语义色？
│   └── 添加到 COLOR_TOKENS 对应分区
├── 图表专用色？
│   └── 添加到 src/config/chartColors.ts
└── 定制色？
    └── 添加到 COLOR_TOKENS 并注释说明
```

---

## 九、主题切换

### 9.1 使用 themeStore

```tsx
import { useThemeStore } from '@/store/themeStore'

function Component() {
  const { mode, setMode, toggleTheme, cycleMode } = useThemeStore()

  // mode: 'light' | 'dark' | 'system'
  setMode('dark')     // 切换到暗色模式
  toggleTheme()       // light ↔ dark
  cycleMode()         // light → dark → system → light
}
```

### 9.2 CSS 变量自动适配

所有 `bg-*`、`text-*`、`border-*` 类均通过 CSS 变量自动适配主题：

```tsx
// ✅ 自动适配 light/dark
<div className="bg-card text-foreground">
  <span className="text-muted-foreground">自动适配</span>
</div>
```

---

## 十、验证与审计

### 10.1 审计命令

```bash
# 硬编码检查
npm run audit:hardcode

# 代码质量检查
npm run lint

# 类型检查
npx tsc --noEmit
```

### 10.2 禁止项

- ❌ 禁止在 `src/` 源码中硬编码 HEX/RGB 颜色值
- ❌ 禁止使用 Tailwind 原始色阶 (如 `text-red-500`, `bg-blue-600`)
- ❌ 禁止使用暖色调 HSL 值 (色相 30-40 范围)

### 10.3 豁免范围

以下文件允许颜色硬编码：
- `src/constants/theme/` - 令牌定义文件
- `src/config/chartColors.ts` - 图表配色定义
- `tests/` - 测试文件

---

## 附录：色值速查表

### Apple 系统颜色对照

| 用途 | V8 Token | 色值 | Apple 规范 |
|------|----------|------|-----------|
| 系统背景 | `--background` | `#F5F5F7` | System Background |
| 卡片背景 | `--card` | `#FFFFFF` | Card Background |
| 分组背景 | `--secondary` | `#F0F0F3` | Grouped Background |
| 主标签 | `--foreground` | `#1F1F24` | Label |
| 次标签 | `--muted-foreground` | `#595963` | Secondary Label |
| 三级标签 | `--text-tertiary` | `#73737A` | Tertiary Label |
| 分隔线 | `--border` | `#E3E3E8` | Separator |
| 蓝色 | `--primary` | `#007AFF` | Blue |
| 绿色 | `--success` | `#34C759` | Green |
| 红色 | `--destructive` | `#FF3B30` | Red |
| 橙色 | `--warning` | `#FF9500` | Orange |

### V7 → V8 迁移映射

| V7 Token (暖) | V8 Token (冷) | 变化 |
|---------------|---------------|------|
| `36 20% 96%` | `240 24% 96%` | 背景：暖灰→冷灰 |
| `40 33% 98%` | `0 0% 100%` | 卡片：暖白→纯白 |
| `30 5% 12%` | `240 3% 12%` | 前景：暖深→冷深 |
| `36 10% 88%` | `240 6% 88%` | 边框：暖灰→冷灰 |
| HSL 30-40 色相 | HSL 240 色相 | 全面转冷 |

---

## 附录：UI 决策速查表（原 design-token-decision-map）

> 4 场景 × 22 条规则，快速查阅「该用什么令牌」。

| 场景 | 元素 | 令牌 | 值 | 禁止 |
|------|------|------|----|------|
| 颜色 | 主按钮 | `primary` | #2563eb | 非令牌色 |
| 颜色 | 次按钮 | `secondary` | #6b7280 | 灰色硬编码 |
| 颜色 | 成功/错误/警告 | `success/error/warning` | #22c55e/#ef4444/#f59e0b | 各自硬编码 |
| 颜色 | 表头/斑马纹 | `bg.hover/bg.alt` | rgba(0,0,0,.03) | 硬编码灰 |
| 颜色 | 边框/聚焦 | `border/border.focus` | #e5e7eb/#2563eb | #d1d5db 等 |
| 颜色 | 占位/滚动条 | `text.disabled` | #9ca3af | #888/#aaa |
| 字号 | 正文/辅助 | `sm/xs` | 14px/12px | 13/15/11/13 |
| 字号 | 卡片/弹窗标题 | `md` | 16px | 15/17/18/20 |
| 字号 | 页面/仪表盘标题 | `lg/title` | 20px/18px | 18/22/16/20 |
| 字号 | Badge/按钮文字 | `xs/sm` | 12px/14px | 11/13/12/16 |
| 字号 | 数值展示/表格 | `lg/sm` | 20px/14px | 18/24/13/15 |
| 间距 | 卡片内边距 | `SPACING[16/24]` | 16/24px | 14/18/20/28 |
| 间距 | 组件间/卡片间 | `SPACING[8/24]` | 8/24px | 6/10/12/20/28 |
| 间距 | Label-Input/表单行 | `SPACING[8/16]` | 8/16px | 6/10/14/18 |
| 间距 | 弹窗 body/header | `SPACING[24/16]` | 24/16px | 20/28/14/18 |
| 间距 | 行高/列表项 | `1.5×/SPACING[8]` | 1.5×/8px | 1.2/1.3/1.8 |
| 间距 | Tab/Nav | `SPACING[12/16]` | 12/16px | 10/14/18 |
| 圆角 | 按钮/Badge/Input | `RADIUS.sm` | 4px | 2/6/8 |
| 圆角 | 卡片/Panel | `RADIUS.md` | 8px | 6/12/10/16 |
| 圆角 | Modal/Drawer | `RADIUS.md/lg` | 8/16px | 12/16/8/24 |
| 圆角 | Avatar/Pill | `rounded-full` | 圆形 | 方形 |

---

## 相关文档

- [V9 编码规范](coding-conventions.md)
- [组件命名规范](../guides/standards/component-naming-conventions.md)
- [质量门禁](../guides/standards/quality-gates.md)
- [Tailwind CSS 文档](https://tailwindcss.com/docs)
- [Apple Human Interface Guidelines](https://developer.apple.com/design/human-interface-guidelines/)
