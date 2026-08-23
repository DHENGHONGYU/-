---
skill_id: V9-SKILL-COLOR-TOKEN
name: "color-token-remediation"
description: "设计令牌单源收敛整改 SOP：七层颜色架构映射（index.css HSL ↔ tokens.json ↔ 生成产物 ↔ 语义角色 ↔ 令牌常量 ↔ 主题令牌 ↔ 独立图表调色板）、verify:colorSoT 门禁、CHART_PALETTE/CHART_TOKENS 双调色板坑、低风险优先工作流与防假闭环核验清单。Invoke when 颜色/间距/字体令牌整改、改色后门禁验证、图表中性色收敛、或删冗余色族时。"
version: v1.0.0
last_updated: 2026-08-23
change_log:
  - version: v1.0.0
    changes: "基于 S 级 Skill 5 段式骨架模板 [_SKILL-TEMPLATE.md](.agents/skills/_SKILL-TEMPLATE.md) 物理化迁移：自用户级 ~/.workbuddy/skills/v9-color-token-remediation 归位项目单一物理源（C1–C12 令牌整改实战提炼）"
    date: 2026-08-23
mandatory: false
---

# V9 颜色令牌单源整改 — v1.0.0

> 适用于颜色/间距/字体令牌整改任务的可复用 SOP。**多层颜色来源必须逐一核对，不能只改一处。**

---

## 一、触发条件

- 颜色/间距/字体令牌整改（C1–C12 类）
- 改色后需门禁验证、图表中性色收敛、删冗余色族
- 怀疑生成产物与令牌源漂移

**协作边界**：全仓硬编码颜色扫描 → `audit:hardcode`；Token 基线合规 → `audit:tokens`（只减不增）。

---

## 二、前置检查：令牌架构映射（改色前必读）

| 层级 | 文件 | 角色 |
|---|---|---|
| 运行时权威 | `src/index.css` 的 HSL 变量 | 真实渲染值，语义令牌归一基准 |
| 令牌源（单一事实源） | `design-tokens/tokens.json` | 平台无关；`scripts/generate-tokens.ts` 读取它 |
| 生成产物 | `src/generated/tokens.css` + `tokens.ts` | 由 tokens.json 重算，**禁止手改** |
| 语义角色 | `src/constants/theme/theme.tokens.design.ts` 的 `SEMANTIC_COLOR_ROLES` | 按角色组织（primary/success/danger…） |
| 令牌常量 | `src/constants/theme/theme.tokens.color.ts` 的 `COLOR_TOKENS` | 组件常用，含 `.hex`/`.tailwind`/`.bgClass` |
| 主题令牌 | `theme.tokens.base.ts` 的 `THEME_TOKENS.color` | 裸 Tailwind 类字符串（历史遗留，仅图表/内联） |
| **独立图表调色板** | `theme.tokens.helpers.ts` 的 `CHART_PALETTE` | ⚠️ **不是**由 tokens.json 生成，是独立常量 |

> **关键坑**：`tokens.json` 生成的叫 `CHART_TOKENS`，而组件实际导入的是 `helpers.ts` 的 `CHART_PALETTE`——**两套独立图表调色板**。改图表中性色（grid/axis/tooltipBg）必须**同时**改两处，否则测试守卫失灵、形成假闭环。

---

## 三、阶段化 SOP

### Step 1 — 门禁 `verify:colorSoT`

`scripts/verify-color-single-source.ts` 断言 `index.css` HSL ↔ `SEMANTIC_COLOR_ROLES.raw` 对 5 个语义色一致：
`primary=#0D9165 / success=#21C45D / warning=#F59F0A / danger=#EF4444 / info=#3C83F6`。
每次改色后必跑，期望 exit 0（用系统 Node 直驱 tsx，避免 npm 在部分 shell 下报错）。
其他相关门禁：`audit:tokens`、`lint:colors`（`eslint --config eslint.colors.config.js`）、`audit-spacing.ts`（合法值集已含 12px/20px）。

### Step 2 — 重算生成产物

改 `tokens.json` 后必须重算：`node ./node_modules/tsx/dist/cli.mjs scripts/generate-tokens.ts`。
用 `git diff src/generated/tokens.css src/generated/tokens.ts` 确认**仅预期改动**（删除色族应 0 残留、保留族数量不变）。

### Step 3 — 视觉主题规则

「宋韵美学」：亮色用 `stone` 暖灰，暗色统一 `neutral` 高级灰（hue 0）。整改时**只改 `dark:*` 段，绝不碰亮色 `stone`**；中性色收敛目标族为 **slate**（与 index.css 基座一致）。

### Step 4 — 低风险优先工作流

- **低风险（可立即做、门禁可验证）**：删冗余色族（仅被 tokens.json 内部引用时）、布局令牌 8px 栅格归一化、对齐 `CHART_PALETTE`↔`CHART_TOKENS` 中性色、同步少数字面量测试断言
- **高风险（改全站视觉，须视觉回归）→ 登记为后续工程**：大面积 `gap-3→gap-4`、源码中性色用法迁语义令牌——依赖视觉回归手段就绪后统一推进

### Step 5 — 整改前核验清单（防假闭环）

1. `grep -rn "gray-[0-9]\|slate-[0-9]" src` 确认源码中性色走 Tailwind 默认调色板（删 tokens.json 色族不影响组件）
2. 要删的色族在生成文件的 `--color-base-*` 变量**仅存在于生成文件**、无源码 `var(--...)` 引用 → 删族零影响
3. `grep` 全仓测试，确认无测试断言即将变更的旧 hex（有则同步改断言）
4. 改图表中性色时**同时**改 `tokens.json` 与 `helpers.ts` 两处
5. 跑 `verify:colorSoT` + 受影响测试，全绿才算闭环

---

## 四、陷阱与经验教训

| # | 陷阱 | 后果 | 规避 |
|---|------|-----|-----|
| 1 | 只改一处颜色来源 | 多层架构下渲染与令牌漂移 | 按七层映射逐一核对 |
| 2 | 手改 `src/generated/` | 下次重算被覆盖 | 只改 `tokens.json` 再重算 |
| 3 | 只改 `CHART_TOKENS` 不改 `CHART_PALETTE` | 测试守卫失灵、假闭环 | 双调色板同步改 |
| 4 | 碰亮色 `stone` | 破坏宋韵主题基座 | 只改 `dark:*` 段 |
| 5 | 全站高风险项一把梭 | 无视觉回归手段时引入不可见退化 | 低风险先行，高风险登记 |

**已知测试守卫**：`tests/BacktestPage.colors.test.tsx`（断言 `CHART_PALETTE.grid` 具体 hex，图表中性收敛时必同步）；`tests/scoreDocService.test.ts`（`#9ca3af` 来自 `COLOR_TOKENS.neutral.hex`，独立于 tokens.json）。

---

## 五、完成交付物清单

| # | 交付物 | 验证方法 |
|---|--------|---------|
| 1 | `verify:colorSoT` exit 0 | 实测 |
| 2 | 生成产物重算且仅预期改动 | `git diff` 核对 |
| 3 | 受影响测试全绿 | 实跑 |
| 4 | 高风险项登记清单 | 后续工程留痕 |
