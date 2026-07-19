---
title: T-09 WCAG 对比度复核报�?
type: explanation
domain: frontend
phase: planning
tier: standard
status: active
maintainer: V9 Architecture Team
summary: "WCAG 对比度复核报告，检查色板体系的可访问性合规�?
tags: [frontend, a11y, report, plan]
version: v1.0.0
last_updated: 2026-07-17
code_version: 2.0.0
change_log:
  - version: v1.0.0
changes: Initial version established
date: 2026-07-17
---

# T-09 WCAG 对比度复核报�?
- **任务**: T-09 WCAG 对比度复�?- **执行�?*: A7 · 视觉 QA AGENT
- **复核时间**: 2026/7/10 08:37:03
- **项目**: 智能投研复盘系统 V9
- **重点颜色**: emerald 主色（`#10b981` / Tailwind `emerald-500`�?
## 1. 色板体系速览

当前颜色体系由两个来源共同定义：

1. **Design Tokens 真源**: `design-tokens/tokens.json`
2. **运行时主题令�?*: `src/constants/theme.tokens.ts`（及其拆分后的子模块�?
### 1.1 emerald 相关关键色�?
| 色阶 | HEX | 备注 |
|------|-----|------|
| emerald-50 | `#ecfdf5` | 浅色背景 |
| emerald-400 | `#34d399` | 暗色模式高亮文字 |
| emerald-500 | `#10b981` | **主色**，暗色主�?primary / 信号�?/ 风格价�?|
| emerald-600 | `#059669` | 亮色主题 primary |
| emerald-700 | `#047857` | 可用于正文（AA 达标�?|

### 1.2 WCAG 对比度阈�?
- **正文 AA**: 4.5:1（`< 18px 常规文字，或 < 14px 粗体`�?- **大字/粗体 AA**: 3.0:1（`�?18px 常规文字，或 �?14px 粗体`�?- **AAA 正文**: 7.0:1（本报告仅复�?AA�?
## 2. Design Tokens 关键色对校验

以下色对来自 `design-tokens/tokens.json` 解析后的实际值�?
| 场景 | 前景�?| 背景�?| 对比�?| 正文 AA | 大字 AA |
|------|--------|--------|--------|---------|---------|
| 主色/白字(�? | `#059669` | `#ffffff` | **3.77:1** | �?| �?|
| 主色/背景(�? | `#059669` | `#ffffff` | **3.77:1** | �?| �?|
| 主色/前景�?�? | `#10b981` | `#f8fafc` | **2.42:1** | �?| �?|
| 信息�?白字 | `#3b82f6` | `#ffffff` | **3.68:1** | �?| �?|
| 警告�?白字 | `#f59e0b` | `#ffffff` | **2.15:1** | �?| �?|
| 危险�?白字 | `#ef4444` | `#ffffff` | **3.76:1** | �?| �?|

**Design Tokens 达标情况**: 2/8 组色对满足正�?AA�?
## 3. 正文 AA 不达标场景清单（文件/行号�?
以下场景�?`src/` 中直接使�?emerald 色作为文本色或等效文本色（`color` 内联样式），并在默认背景（亮色背�?`#ffffff` / 暗色背景 `#020617`）下对比度不�?4.5:1�?*

| 文件 | 行号 | 使用/颜色 | 背景�?| 对比�?| 模式 | 备注 |
|------|------|-----------|--------|--------|------|------|
| `src/config/rotationConfig.ts` | 39 | `#10b981` / `#10b981` | `#ffffff` | **2.54:1** | light | emerald-500 主色，正文对比度不足 |
| `src/config/rotationConfig.ts` | 324 | `#10b981` / `#10b981` | `#ffffff` | **2.54:1** | light | emerald-500 主色，正文对比度不足 |
| `src/config/rotationConfig.ts` | 376 | `#10b981` / `#10b981` | `#ffffff` | **2.54:1** | light | emerald-500 主色，正文对比度不足 |
| `src/config/rotationConfig.ts` | 406 | `#10b981` / `#10b981` | `#ffffff` | **2.54:1** | light | emerald-500 主色，正文对比度不足 |
| `src/constants/ai-center.constants.ts` | 107 | `#10b981` / `#10b981` | `#ffffff` | **2.54:1** | light | emerald-500 主色，正文对比度不足 |
| `src/constants/health.constants.ts` | 176 | `#10b981` / `#10b981` | `#ffffff` | **2.54:1** | light | emerald-500 主色，正文对比度不足 |
| `src/constants/newsColorTokens.ts` | 11 | `text-emerald-600` / `#059669` | `#ffffff` | **3.77:1** | light | emerald-600 亮色主色，正文对比度不足 |
| `src/constants/newsColorTokens.ts` | 12 | `hover:text-emerald-600` / `#059669` | `#ffffff` | **3.77:1** | light | emerald-600 亮色主色，正文对比度不足 |
| `src/constants/newsColorTokens.ts` | 19 | `text-emerald-500` / `#10b981` | `#ffffff` | **2.54:1** | light | emerald-500 主色，正文对比度不足 |
| `src/constants/theme/theme.tokens.color.ts` | 43 | `text-emerald-500` / `#10b981` | `#ffffff` | **2.54:1** | light | emerald-500 主色，正文对比度不足 |
| `src/constants/theme/theme.tokens.color.ts` | 85 | `text-emerald-500` / `#10b981` | `#ffffff` | **2.54:1** | light | emerald-500 主色，正文对比度不足 |
| `src/constants/theme/theme.tokens.color.ts` | 93 | `text-emerald-500` / `#10b981` | `#ffffff` | **2.54:1** | light | emerald-500 主色，正文对比度不足 |
| `src/constants/theme/theme.tokens.shades.ts` | 144 | `text-emerald-500` / `#10b981` | `#ffffff` | **2.54:1** | light | emerald-500 主色，正文对比度不足 |
| `src/constants/theme/theme.tokens.shades.ts` | 145 | `text-emerald-600` / `#059669` | `#ffffff` | **3.77:1** | light | emerald-600 亮色主色，正文对比度不足 |
| `src/pages/analysis/IntelligentScorePage.tsx` | 105 | `#10b981` / `#10b981` | `#ffffff` | **2.54:1** | light | emerald-500 主色，正文对比度不足 |
| `src/pages/analysis/IntelligentScorePage.tsx` | 105 | `#10b981` / `#10b981` | `#ffffff` | **2.54:1** | light | emerald-500 主色，正文对比度不足 |
| `src/pages/analysis/IntelligentScorePage.tsx` | 106 | `#059669` / `#059669` | `#ffffff` | **3.77:1** | light | emerald-600 亮色主色，正文对比度不足 |
| `src/pages/analysis/IntelligentScorePage.tsx` | 107 | `#10b981` / `#10b981` | `#ffffff` | **2.54:1** | light | emerald-500 主色，正文对比度不足 |
| `src/pages/analysis/IntelligentScorePage.tsx` | 110 | `#059669` / `#059669` | `#ffffff` | **3.77:1** | light | emerald-600 亮色主色，正文对比度不足 |
| `src/portal/PortalShell.tsx` | 206 | `text-emerald-600` / `#059669` | `#ffffff` | **3.77:1** | light | emerald-600 亮色主色，正文对比度不足 |

## 4. 问题定级与修复建�?
### P1（高优先级）—�?必须修复

1. **暗色主题主色按钮/标签文字不可�?*
   - 位置: `design-tokens/tokens.json` �?`dark.color.primary` = `#10b981`
   - 问题: 与前景色 `dark.color.primaryForeground`（`#f8fafc`）对比度�?**2.42:1**，远低于正文 AA 4.5:1，也低于大字 AA 3.0:1�?   - 修复: 将暗色主色加深至 emerald-600（`#059669`）或 emerald-700（`#047857`），确保与浅色文字对比度 �?4.5:1�?
2. **亮色主题主色按钮/标签文字对比度不�?*
   - 位置: `design-tokens/tokens.json` �?`light.color.primary` = `#059669`
   - 问题: 与白色前景对比度 **3.77:1**，不满足正文 AA，仅满足大字 AA�?   - 修复: 将亮色主色加深至 emerald-700（`#047857`），或仅用于大字�?粗体按钮�?
3. **语义 token �?emerald-500 被直接用作正文字�?*
   - 位置: `src/constants/theme/theme.tokens.color.ts`
   - 涉及 token: `COLOR_TOKENS.emerald`、`COLOR_TOKENS.styleValue`、`COLOR_TOKENS.signalStrong`
   - 问题: 这些 token �?`tailwind` 字段�?`text-emerald-500`，一旦被组件用于正文，在白色背景上对比度�?**2.54:1**（`#10b981` vs `#ffffff`）�?   - 修复: 将文本色 token 统一改为 `text-emerald-700`（`#047857`），或新�?`emeraldText` / `emeraldSoft` 等专用文�?token�?
### P2（中优先级）—�?建议修复

1. **新闻模块 positive 文本�?emerald-600 在正文场景下不达�?*
   - 位置: `src/constants/newsColorTokens.ts:11` �?`text: 'text-emerald-600'`
   - 问题: `#059669` 在白色背景上对比�?**3.77:1**，不满足正文 AA�?   - 修复: 正文场景改为 `text-emerald-700`（`#047857`），图标/装饰可保�?emerald-600�?
2. **PortalShell 导航激活�?emerald-600**
   - 位置: `src/portal/PortalShell.tsx:206` �?`text-emerald-600 dark:text-emerald-400`
   - 问题: 亮色模式 emerald-600 在白色背景上对比�?3.77:1，未达正�?AA；但导航项通常字号 �?14px 且为粗体，可能按大字 AA 3.0:1 通过�?   - 修复: 若用于正文，改为 emerald-700；若作为导航高亮（粗�?�?4px），可保留并补充说明�?
3. **IntelligentScorePage 内联样式 emerald �?*
   - 位置: `src/pages/analysis/IntelligentScorePage.tsx:105-110`
   - 问题: 使用 `#10b981`（h1, h2, .dimension-name）和 `#059669`（h2, .dimension-name）作为标�?正文色�?   - 修复: 标题可保�?emerald-600/700（大�?AA 通过）；正文/维度名改�?emerald-700�?
## 5. 推荐替换方案

| 当前用法 | 推荐替换 | 使用场景 | 替换后对比度（白底） |
|----------|----------|----------|---------------------|
| `emerald-500` / `#10b981` | `emerald-700` / `#047857` | 正文、小字号、标签文�?| **5.63:1** |
| `emerald-500` / `#10b981` | `emerald-600` / `#059669` | 大字号标题、粗体、装�?| 3.77:1（大�?AA�?|
| `emerald-600` / `#059669` | `emerald-700` / `#047857` | 正文、小字号 | 5.63:1 |
| `bg-emerald-500` + 白字 | `bg-emerald-700` + 白字 | 按钮、Badge、胶�?| 5.63:1 |
| `dark:bg-emerald-500` + 浅字 | `dark:bg-emerald-700` + 浅字 | 暗色按钮 | �?4.5:1 |

## 6. 结论

本次复核发现 **6 �?Design Tokens 色对** �?**20 �?src/ 文本色使�?* 未满�?WCAG AA 正文对比度要求。emerald 主色（`#10b981`）在亮色背景下正文对比度仅约 3.0:1，在暗色背景下与浅色文字对比度仅 2.42:1�?*不建议用于正文或小字�?*。建议优先执�?P1 修复：将按钮/主色加深�?emerald-700（`#047857`），并调整文本色 token �?emerald-700�?
---
报告�?`scripts/other/a11y-contrast.cjs` 自动生成�?