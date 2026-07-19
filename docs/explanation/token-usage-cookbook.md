---
title: 令牌使用 Cookbook（token-usage-cookbook�?
type: explanation
domain: frontend
phase: planning
tier: standard
status: active
maintainer: V9 Architecture Team
summary: "定位：`../reference/design-token-mapping.md`（令牌映射表）的场景化补�?*，补「令牌指南缺失（不可发现）」缺口�?>..."
tags: [frontend, token, plan]
version: v1.0.0
last_updated: 2026-07-17
code_version: 2.0.0
change_log:
  - version: v1.0.0
changes: Initial version established
date: 2026-07-17
---tion
domain: frontend
phase: planning
tier: standard
status: active
maintainer: V9 Architecture Team
tags: [frontend, token, plan]
version: v1.0.0
last_updated: 2026-07-17
code_version: 2.0.0
---

# 令牌使用 Cookbook（token-usage-cookbook�?
> **定位**：`../reference/design-token-mapping.md`（令牌映射表）的**场景化补�?*，补「令牌指南缺失（不可发现）」缺口�?> **原则**：UI 颜色一律走令牌，`lint:colors` 拦截零硬编码。A �?*红涨绿跌**固定色不随主题变化�?> **状�?*：✅ P1 新增�? 场景�?
---

## 场景 1：通用状态色（信�?警告/成功/错误�?```tsx
import { THEME_TOKENS } from '@/constants/theme.tokens'
<span className={THEME_TOKENS.color.info}>提示</span>        // text-blue-500
<div className={THEME_TOKENS.color.warningBg}>警告背景</div>  // bg-amber-500
```

## 场景 2：股票涨�?/ 评分 / 信号分级
```tsx
import { COLOR_TOKENS } from '@/constants/theme.tokens'
<span className={COLOR_TOKENS.up.tailwind}>+3.2%</span>     // 红（涨）
<div className={COLOR_TOKENS.scoreHigh.bgClass}>高分</div>   // �?<span style={{color: COLOR_TOKENS.signalWeak.hex}}>弱信�?/span>
```

## 场景 3：特定色阶（浅背�?/ 深文字）
```tsx
import { COLOR_SHADES } from '@/constants/theme.tokens'
<div className={COLOR_SHADES.red[50]}>浅红背景</div>
<span className={COLOR_SHADES.red[600]}>深红文字</span>
// 或辅助函�?import { twBg, twText } from '@/constants/theme.tokens'
<div className={twBg('blue',50)}>浅蓝</div>
```

## 场景 4：图�?/ 热力�?/ 轮动�?```ts
import { chartColors } from '@/config/chartColors'  // L4
<LineChart colors={chartColors.line} />
```

## 场景 5：暗色主题（neutral 高级灰）
- 只改 `dark:*` 段，不动亮色 `stone` 暖灰系；统一 hue 0 零彩度�?
## 场景 6：Widget 卡片背景 / 边框 / 间距
```tsx
import { twBg, twBorder, THEME_TOKENS } from '@/constants/theme.tokens'
<div className={`${twBg('stone',50)} ${twBorder('stone',200)} ${THEME_TOKENS.radius.md}`}>
```

## 场景 7：文本层级（字号/字重/行高�?```tsx
import { THEME_TOKENS } from '@/constants/theme.tokens'
<h2 className={`${THEME_TOKENS.typography.fontSize['2xl']} ${THEME_TOKENS.typography.fontWeight.semibold}`}>
```

## 场景 8：语义角色（L6 SEMANTIC_COLOR_ROLES�?- 业务语义角色（如 `primary / danger / success / warning`）映射到 L2/L3，禁止直接使用角色名以外的裸色�?
---

## 令牌层级速查
| �?| 导出 | 用�?|
|----|------|------|
| L1 | `THEME_TOKENS` | 通用语义�?尺寸/圆角/排版 |
| L2 | `COLOR_TOKENS` | 涨跌/评分/因子/信号/背景/文字/边框 |
| L3 | `COLOR_SHADES` + `twText/twBg/twBorder` | 特定色阶 |
| L4 | `chartColors` | 图表专用 |
| L5 | 股票红涨绿跌固定�?| 不随主题 |
| L6 | `SEMANTIC_COLOR_ROLES` | 语义角色映射 |

> 映射总表�?`../reference/design-token-mapping.md`；偏离即触发 `lint:colors` / `audit:tokens` 门禁�?