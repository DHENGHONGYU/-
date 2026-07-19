---
title: 宋韵美学设计指南（Song Aesthetics�?
type: explanation
domain: project
phase: planning
tier: standard
status: active
maintainer: V9 Architecture Team
summary: "定位：定�?V9 的「宋韵美学」视觉语言，补 H 类设计指南缺口（P2-2）�?>..."
tags: [project, plan, design]
version: v1.0.0
last_updated: 2026-07-17
code_version: 2.0.0
doc_id: V9-DOC-PROJ-275
change_log:
  - version: v1.0.0
changes: Initial version established
date: 2026-07-17
---tion
domain: project
phase: planning
tier: standard
status: active
maintainer: V9 Architecture Team
tags: [project, plan, design]
version: v1.0.0
last_updated: 2026-07-17
code_version: 2.0.0
---

# 宋韵美学设计指南（Song Aesthetics�?
> **定位**：定�?V9 的「宋韵美学」视觉语言，补 H 类设计指南缺口（P2-2）�?> **权威令牌**：`src/constants/theme.tokens.ts`（L1–L6）、`../reference/design-token-mapping.md`、`./token-usage-cookbook.md`�?> **状�?*：✅ P2 新增（骨架版�?
---

## 1. 核心主张

宋韵美学追求**克制、温润、留�?*。整体以暖灰为骨、低饱和为韵，避免高彩度堆砌�?
## 2. 明暗双模规则（铁律）

- **亮色（默认）**：使�?`stone` 暖灰系�?  - 底：`stone-50 / stone-100`
  - 正文：`stone-800`
  - 强调：`emerald-500`（低饱和绿，宋韵点翠�?- **暗色**：统一切换�?`neutral` 高级灰（hue 0，零彩度）�?  - **只改 `dark:*` 段，禁止改动亮色 `stone` �?*�?- A �?*红涨绿跌**为固定业务色（L5），不随主题变化�?
## 3. 令牌使用

- 所有颜色走 L1–L6 令牌；禁止裸 HEX / Tailwind 数字色类（`lint:colors` 拦截）�?- 场景化写法见 `token-usage-cookbook.md`�?
## 4. 排版与间�?
- 字号/字重/行高�?`THEME_TOKENS.typography`�?- 间距�?`THEME_TOKENS.spacing / gap / stackGap`；圆�?`radius`；控件尺�?`controlSizes`�?
## 5. 留白与层�?
- 卡片�?`stone-50` �?+ `stone-200` 边框 + `./song-aesthetics.md`，保持呼吸感�?- 信息层级靠字号与 `stone` 明度差，而非描边/阴影堆叠�?
## 6. 验收

- �?暗色模式全站 `neutral` 零彩度，亮色维持 `stone` 暖灰�?- �?全站零硬编码颜色（`lint:colors` / `audit:tokens` 绿）�?- �?涨跌色符合中国习惯（红涨绿跌）�?