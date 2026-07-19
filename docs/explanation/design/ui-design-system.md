---
title: V9 UI 设计系统
type: explanation
domain: frontend
phase: design
tier: standard
status: active
maintainer: V9 Architecture Team
summary: "## 1. 设计理念 V9 智能投研复盘系统采用 Refined Finance 设计语言，专为金融数据可视化场景优化�?"
tags: [frontend, plan, design, system]
version: v1.0.0
last_updated: 2026-07-17
code_version: 2.0.0
doc_id: V9-DOC-FRONT-030
referenced_by: [V9-DOC-PROJ-174, V9-DOC-META-000, V9-DOC-QA-071, V9-DOC-PROJ-176, V9-DOC-PROJ-182, V9-DOC-PROJ-149]
change_log:
  - version: v1.0.0
changes: Initial version established
date: 2026-07-17
---

# V9 UI 设计系统

> **Status**: Current  
> **Version**: v2.2.0  
> **Last Updated**: 2026-06-30  
> **Related**: `src/index.css`, `tailwind.config.js`, `src/constants/theme.tokens.ts`

---

## 1. 设计理念

V9 智能投研复盘系统采用 **Refined Finance** 设计语言，专为金融数据可视化场景优化�?
| 设计维度 | 目标 |
|----------|------|
| **专业�?* | 低饱和度配色，传递信任与稳重 |
| **可读�?* | 优化深色主题，降低长时间使用的视觉疲�?|
| **数据表达** | 涨跌色彩语义化，快速传达盈亏信�?|
| **交互反馈** | 微妙的动画与阴影，提升操作确认感 |

---

## 2. 颜色系统

### 2.1 主色�?
```css
/* 专业蓝绿�?*/
--primary: 195 85% 42%;          /* #0AA3C4 - 信任、科技 */
--primary-foreground: 0 0% 100%; /* 白色文字 */

/* 品牌�?*/
--brand-jade: 165 35% 55%;       /* #2E8B7A - 宋瓷绿，典雅 */
--brand-gold: 38 60% 50%;        /* #C9A227 - 古铜金，价值感 */
```

### 2.2 涨跌语义�?
```css
/* 盈利/正向 */
--positive: 152 60% 45%;         /* #1DB56A - 明确的盈利绿 */
--positive-bg: 152 60% 95%;      /* 浅绿背景 */

/* 亏损/负向 */
--negative: 0 65% 55%;           /* #D94444 - 警示�?*/
--negative-bg: 0 65% 95%;        /* 浅红背景 */

/* 中�?*/
--neutral: 220 9% 55%;          /* 灰色，用于无变化 */
```

### 2.3 状态语义色

```css
--success: 152 60% 45%;          /* 成功，与 positive 相同 */
--warning: 38 92% 50%;           /* #F5A623 - 警告�?*/
--info: 205 80% 55%;             /* #2D9CDB - 信息�?*/
```

### 2.4 图表配色

```css
--chart-1: 195 85% 42%;          /* 主色 */
--chart-2: 165 35% 55%;          /* 品牌�?*/
--chart-3: 38 60% 50%;           /* 品牌�?*/
--chart-4: 280 65% 55%;          /* 紫色 */
--chart-5: 330 70% 55%;          /* 粉色 */
```

---

## 3. 阴影系统

```css
--shadow-sm: 0 1px 2px hsl(220 14% 95% / 0.5);    /* 微妙的卡片边�?*/
--shadow: 0 1px 3px hsl(220 14% 90% / 0.5);       /* 标准卡片 */
--shadow-md: 0 4px 6px hsl(220 14% 88% / 0.5);    /* 悬浮效果 */
--shadow-lg: 0 10px 15px hsl(220 14% 85% / 0.5); /* 模态框/下拉 */
--shadow-glow: 0 0 20px hsl(195 85% 42% / 0.15); /* 发光边框效果 */
```

**深色主题阴影**�?```css
.dark {
  --shadow: 0 1px 3px hsl(0 0% 0% / 0.4);
  --shadow-md: 0 4px 6px hsl(0 0% 0% / 0.4);
  --shadow-lg: 0 10px 15px hsl(0 0% 0% / 0.5);
  --shadow-glow: 0 0 30px hsl(195 80% 50% / 0.2);
}
```

---

## 4. 动画系统

### 4.1 关键�?
| 动画�?| 效果 | 时长 |
|--------|------|------|
| `fade-in-up` | 淡入 + 上移 8px | 400ms |
| `scale-in` | 淡入 + 缩放 0.96�? | 300ms |
| `slide-in-right` | 淡入 + 右移 16px | 300ms |
| `pulse-glow` | 脉冲发光效果 | 2s infinite |
| `skeleton-shimmer` | 骨架屏微光闪�?| 1.5s infinite |

### 4.2 工具�?
```html
<!-- 入场动画（需配合 delay 类使用） -->
<div class="animate-fade-in">内容</div>
<div class="animate-fade-in animate-fade-in-delay-1">延迟 50ms</div>
<div class="animate-fade-in animate-fade-in-delay-2">延迟 100ms</div>

<!-- 悬浮效果 -->
<div class="card-hover hover:shadow-lg hover:-translate-y-1">卡片</div>

<!-- 发光边框 -->
<div class="border-glow">发光边框</div>
```

### 4.3 过渡时长

```css
--transition-fast: 150ms;
--transition-normal: 200ms;
--transition-slow: 300ms;
```

---

## 5. 组件规范

### 5.1 Button 变体

| 变体 | 使用场景 | 样式特征 |
|------|----------|----------|
| `primary` | 主要操作 | 渐变背景 (primary→primary/90)、悬浮阴�?提升 |
| `success` | 成功操作 | 渐变背景 (positive→positive/90) |
| `danger` | 危险操作 | 渐变背景 (destructive→destructive/90) |
| `secondary` | 次要操作 | 柔和灰背�?|
| `outline` | 中性操�?| 2px 边框、hover 背景 |
| `ghost` | 最低调 | 无背景、hover 显示 |

### 5.2 Badge 变体

| 变体 | 使用场景 | 样式特征 |
|------|----------|----------|
| `default` | 默认标签 | `bg-primary/15` + `text-primary` |
| `secondary` | 次要标签 | `bg-secondary` |
| `success` | 成功标签 | `bg-positive/15` + `text-positive` |
| `warning` | 警告标签 | `bg-warning/15` + `text-warning` |
| `destructive` | 危险标签 | `bg-destructive/15` + `text-destructive` |
| `outline` | 轮廓标签 | 透明背景 + 边框 |

### 5.3 卡片圆角

| 组件 | 圆角�?|
|------|--------|
| Card | `rounded-xl` (12px) |
| Button | `rounded-md` (sm/md) / `rounded-lg` (lg) |
| Badge | `rounded-full` (胶囊�? |
| Input | `rounded-md` |

---

## 6. 工具�?
### 6.1 涨跌颜色

```html
<span class="text-positive">+10.5%</span>
<span class="text-negative">-3.2%</span>
<div class="bg-positive">盈利背景</div>
<div class="bg-negative">亏损背景</div>
```

### 6.2 渐变与玻璃�?
```html
<!-- 背景渐变 -->
<div class="gradient-bg">渐变背景</div>

<!-- 玻璃态效�?-->
<div class="glass">毛玻璃效�?/div>

<!-- 文字渐变 -->
<h1 class="text-gradient">渐变文字</h1>
```

### 6.3 骨架�?
```html
<div class="skeleton h-4 w-full"></div>
```

---

## 7. 深色主题

深色主题采用低亮度、高对比度设计：

```css
.dark {
  --background: 222 47% 8%;        /* 深蓝黑背�?*/
  --foreground: 210 40% 98%;      /* 高对比度文字 */
  --card: 222 47% 11%;            /* 卡片略浅 */
  --primary: 195 80% 50%;         /* 更饱和的主色 */
  --positive: 152 65% 55%;        /* 更鲜明的盈利�?*/
  --negative: 0 70% 60%;          /* 更鲜明的亏损�?*/
}
```

---

## 8. 字体系统

```css
/* 中文正文 */
font-family: 'Noto Sans SC', system-ui, -apple-system, sans-serif;

/* 数字/代码 */
font-family: 'JetBrains Mono', 'SF Mono', monospace;
font-variant-numeric: tabular-nums;  /* 等宽数字 */
```

---

## 9. 相关文件

| 文件 | 说明 |
|------|------|
| `src/index.css` | 主样式文件，包含所�?CSS 变量和工具类 |
| `tailwind.config.js` | Tailwind 配置，扩展颜色和动画 |
| `src/constants/theme.tokens.ts` | TypeScript 设计令牌常量 |
| `src/components/atoms/Button.tsx` | 按钮组件，支持渐变和多种变体 |
| `src/components/atoms/Badge.tsx` | 徽章组件，涨跌语义化 |
| `src/components/atoms/Card.tsx` | 卡片组件，统一圆角和阴�?|

---

## 10. 使用规范

1. **禁止直接使用 HEX 颜色** - 使用 CSS 变量�?Tailwind 语义�?2. **涨跌信息必须使用语义�?* - `text-positive` / `text-negative`
3. **交互元素需要过渡动�?* - 使用 `transition-base` �?4. **深色主题优先** - 设计时考虑深色模式兼容�?
---

## 11. 页面�?UI 组件清单（按页面归档�?
> 用于追踪各业务页面实际使用的 UI 组件，便于审计与一致性维护�?
### 11.1 SevenDimConfigPage（七维采集配置页�?
- **路由**：`/input/seven-dim`
- **源文�?*：`src/pages/input/SevenDimConfigPage.tsx`
- **依赖 Store**：`useSevenDimConfigStore`（`src/store/sevenDimConfigStore.ts`�?- **依赖配置**：`src/config/collectConfig.ts`（策略模板、维度默认值、频�?数据�?存储类型/重要性标签）
- **测试覆盖**�?1 个组件测试用例（`tests/__tests__/SevenDimConfigPage.test.tsx`�?
**使用�?UI 组件清单**�?
| 组件 | 来源 | 用�?|
|------|------|------|
| `Card` / `CardHeader` / `CardTitle` / `CardDescription` / `CardContent` | `@/components/atoms/Card` | 策略模板卡片、维度行容器、全局参数面板、额度预估面�?|
| `Button` | `@/components/atoms/Button` | 保存配置、执行采集、策略模板选择、维度操�?|
| `Badge` | `@/components/atoms/Badge` | 维度重要性标签、策略模板维度数量标�?|
| `Switch` | `@/components/atoms/Switch` | 维度启用/禁用开�?|
| `Input` | `@/components/atoms/Input` | 标的数、历史天数等全局参数输入 |
| `Label` | `@/components/atoms/Label` | 表单字段关联标签 |
| `Progress` | `@/components/atoms/Progress` | 额度预估可视�?|
| `Separator` | `@/components/atoms/Separator` | 模块间分隔线 |
| `Breadcrumb` 系列 | `@/components/atoms/Breadcrumb` | 顶部面包屑导航（首页 / 输入�?/ 七维采集配置�?|

**子组�?*�?
- `StrategyCard`：策略模板卡片，展示模板名称、描述、维度数量、选中�?- `DimensionRow`：维度行，展示维度名称、重要性、频率、数据源、存储策略、启用开�?