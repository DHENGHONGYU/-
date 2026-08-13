---
title: 颜色令牌生命周期管理指南（入-移-出）
code_version: "2.0.0-rc.1"
tier: important
version: v1.1.0
last_updated: 2026-08-13
change_log:
  - version: v1.1.0
    changes: "twText/twBg/twBorder 全面废弃，迁移至 CSS 变量语义令牌"
    date: 2026-08-13
  - version: v1.0.0
    changes: "P0 版本闭环(2026-08-11)：补全 change_log 初始条目"
    date: 2026-08-11
---

# 颜色令牌生命周期管理指南（入-移-出）

> **版本**: v1.0.0 | **日期**: 2026-07-22
> **适用范围**: `src/constants/theme.tokens.ts`、`src/config/chartColors.ts`、`design-tokens/tokens.json` 的颜色令牌体系
> **权威规范**: [AGENTS.md §3.5 颜色令牌规范](../../AGENTS.md)（场景化使用规则、语义映射、禁止清单的**唯一事实源**）
> **关联技能**: [v9-color-token-remediation](../../.trae/skills/v9-color-token-remediation/SKILL.md)（令牌单源收敛）
> **单源真相**: `design-tokens/tokens.json` → `scripts/generate-tokens.ts` 再生 `index.css` 变量 → `theme.tokens.ts` 导出 `THEME_TOKENS/COLOR_TOKENS/COLOR_SHADES/STOCK_COLOR_TOKENS`；禁止在 UI 层（`components/pages/cockpit/apps`）直接书写 HEX 或裸色类。

---

## 一、令牌层次（速查）

| 层级 | 导出位置 | 用途 |
|------|----------|------|
| L1 基础 | `THEME_TOKENS.color/iconSizes/controlSizes/spacing/radius/typography` | 通用语义色 + 尺寸/间距/圆角/排版 |
| L2 语义 | `COLOR_TOKENS` | 业务语义色（涨跌/评分/因子/信号/背景/文字/边框） |
| L3 色阶 | `COLOR_SHADES` | 特定色阶（图表等特殊场景）|
| L4 图表 | `chartColors.ts`（PIE_CHART_PALETTE / ROTATION_FACTOR_COLORS / SIGNAL_GRADE_COLORS） | 图表/热力图/轮动图配色 |
| 例外 | `STOCK_COLOR_TOKENS` / `getStockColor()` | A股红涨绿跌，**豁免主题切换** |

> 完整场景示例（A–H）与禁止清单见 AGENTS.md §3.5，**本指南不再复制**，仅规定生命周期动作。

> ⚠️ twText/twBg/twBorder 辅助函数已全面废弃（2026-08-13），UI 层请使用 CSS 变量语义令牌（text-foreground / bg-muted / border-border 等）

---

## 二、入（新增令牌）

1. **优先复用**：先查 `COLOR_TOKENS` / `COLOR_SHADES` / `chartColors` 是否已有可复用令牌，**不盲目新增**。
2. **单源登记**：在 `design-tokens/tokens.json` 的 `primary`/`ring`/语义色节点新增（**唯一入口**），**禁止**直接改 `theme.tokens.ts` 或 `index.css` 绕过生成链。
3. **再生 + 校验**：
   ```bash
   npm run generate:tokens        # tokens.json → index.css 变量
   npm run verify:colorSoT        # 单源一致性校验
   npm run audit:tokens           # 裸色/HEX 字面量扫描（基线 ratchet）
   ```
4. **一致性约束**：`--primary` 必须与 `index.css` 的 `--primary` 同色相；强调色全站仅一个（emerald），禁止引入第二个品牌色（AGENTS §3.5「单一克制强调色公约」）。
5. **对照表登记**：在 `docs/reference/design-token-mapping.md` 增加新令牌的业务场景 → Import 示例（文档单源）。

---

## 三、移（重命名 / 迁移令牌）

对标 [FILE-MANAGEMENT-GUIDE.md §6.3](./FILE-MANAGEMENT-GUIDE.md)：

1. **影响评估**：Grep 旧令牌名（`COLOR_TOKENS.xxx` / `THEME_TOKENS.color.xxx`）全仓调用点。
2. **原子改名**：同步改 `tokens.json` 键名 + `generate-tokens.ts` 映射 + 所有消费点 + `design-token-mapping.md`。
3. **残留扫描（强制）**：用 `stale-path-reference-audit` 对旧令牌名做九类文件全仓 Grep 残留 + 交叉验证。
4. **验证命令**：`npm run verify:colorSoT && npm run audit:tokens && npm run audit:hardcode`。

---

## 四、出（废弃 / 清理）

1. **标注**：在 `tokens.json` 对应节点加 `"deprecated": true` + 目标替代令牌注释。
2. **前置确认（三条件）**：达废弃版本 / 全仓 Grep 旧令牌名 0 命中 / `audit:tokens` 0 违规。
3. **安全删除**：从 `tokens.json` + `theme.tokens.ts` 导出 + `design-token-mapping.md` 移除；`generate-tokens.ts` 重新生成 `index.css`。
4. **基线刷新**：若 `audit:tokens` 基线计数变化，消减后 `npm run audit:tokens -- --update-baseline` 并提交 `.token-baseline.json`。

> ⚠️ **当前废弃实例**：`twText/twBg/twBorder` 辅助函数已于 2026-08-13 全面废弃，UI 组件已迁移至 CSS 变量语义令牌（text-foreground / bg-muted / border-border 等）。`COLOR_SHADES` 保留用于图表等特殊场景。

---

## 五、审计门禁清单

| 阶段 | 必跑命令 | 门禁意图 |
|------|----------|----------|
| 入 | `generate:tokens` + `verify:colorSoT` + `audit:tokens` | 单源再生 + 一致性 + 裸色扫描 |
| 移 | `verify:colorSoT` + `audit:tokens` + `audit:hardcode` + 残留扫描 | 无残留 + 无硬编码 |
| 出 | `audit:tokens -- --update-baseline` + `verify:colorSoT` | 基线 ratchet + 单源一致 |

---

## 六、变更日志

| 版本 | 日期 | 变更摘要 |
|------|------|----------|
| v1.1.0 | 2026-08-13 | twText/twBg/twBorder 辅助函数全面废弃，UI 层迁移至 CSS 变量语义令牌；L3 层仅保留 COLOR_SHADES 用于图表等特殊场景 |
| v1.0.0 | 2026-07-22 | 从 AGENTS §3.5 抽取颜色令牌「入-移-出」生命周期指南（不复制场景细则）；绑定 `v9-color-token-remediation` 技能与 `audit:tokens`/`verify:colorSoT` 门禁；修正 AGENTS:376 `design-token-mapping.md` 断链（已加 `reference/` 前缀） |
