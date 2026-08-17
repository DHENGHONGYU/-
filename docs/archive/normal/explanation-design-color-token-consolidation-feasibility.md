---
title: 颜色令牌单源整改可行性分析与实践方案
type: explanation
domain: frontend
phase: design
tier: standard
status: active
maintainer: V9 Architecture Team
summary: "V9 设计系统颜色令牌多源分裂的根治方案（可行性评估 + 本轮执行）。"
tags: [frontend, token, refactor]
version: v1.0.0
last_updated: 2026-07-17
code_version: "2.0.0-rc.1"
doc_id: V9-DOC-FRONT-049
referenced_by: [V9-DOC-META-000]
change_log:
  - version: v1.0.0
changes: Initial version established
date: 2026-07-17
---

# 颜色令牌单源整改 · 可行性分析与实践方案

> **版本**: v1.0.0 | **日期**: 2026-07-17
> **范围**: V9 设计系统颜色令牌多源分裂的根治方案（可行性评估 + 本轮执行）
> **前置文档**: `docs/explanation/design/design-system-audit-report.md`（四维评分与差异总表）、`docs/explanation/design/component-specs.md`

---

## 0. 摘要（结论先行）

上一轮审计指出「主色被定义 4 种、成功色 4 种、SEMANTIC_COLOR_ROLES.*.raw 与渲染 HSL 不符」，并建议「以 `index.css` 为唯一事实源，由 `raw`/`tokens.json` 自动推导」。
本轮我对**真实令牌生成链路**做了精准测绘，发现实际架构比原假设更复杂（见 §1）：存在 **3 个手写颜色源 + 1 条生成链路**，而非简单的「index.css 单文件」。在此基础上给出 3 套策略对比（§3），**推荐策略 C（调和 + 守护门禁）** 作为本轮执行方案——它以最低风险一次性消除主色与警示色的可观测分裂，并用自动化门禁防止回归，而不动构建链路（避免高风险的生成器重构）。

> **关于 HEX 取值的说明（重要）**：本报告所有 HEX 均由脚本 `scripts/verify-color-single-source.ts` 中的标准 HSL→RGB 算法从 `index.css` 的 HSL 实算得出（已通过正负向双重验证）。早期手算的 `#0D9265`/`#22A04B`/`#F59E0B`/`#3B82F6` 经脚本复核为**计算误差**，真实值见下表。

| 语义 | index.css HSL | 实算 HEX | RGB |
|---|---|---|---|
| 主色 primary | 160 84% 31% | **#0D9165** | 13,145,101 |
| 成功 success | 142 71% 45% | **#21C45D** | 33,196,93 |
| 警告 warning | 38 92% 50% | **#F59F0A** | 245,159,10 |
| 危险 danger | 0 84.2% 60.2% | **#EF4444** | 239,68,68 |
| 信息 info | 217 91% 60% | **#3C83F6** | 60,131,246 |

**执行结论**：策略 C 已落地（§5），新增 `scripts/verify-color-single-source.ts` 门禁，主色四值收敛为 1 个真值 `#0D9165`（亮）/ `#157958`（暗），警示/成功/信息 raw 全部对齐实算值。

---

## 1. 真实架构测绘（consumer graph）

| 源 | 文件 | 性质 | 被谁消费 | 当前主色值 |
|---|---|---|---|---|
| **A 运行时 CSS 变量** | `src/index.css`（`:root` + `.dark`） | 手写 | Tailwind（`tailwind.config.js` 映射为 `bg-primary` 等）+ `main.tsx:8` 直接 import | `--primary: 160 84% 31%` → **#0D9165** |
| **B 语义令牌 TS** | `src/constants/theme/theme.tokens.design.ts`（`SEMANTIC_COLOR_ROLES.*.raw`） | 手写 | React 组件 / **canvas 图表**（取 HEX 画布） | `primary.raw: #0d9165` ✅ |
| **C 业务色 TS** | `src/constants/theme/theme.tokens.color.ts`（`COLOR_TOKENS`） | 手写（历史遗留层） | 图表/内联（裸 Tailwind 色板类） | 无 `primary` 键；`emerald: #10b981` |
| **D 生成源 JSON** | `design-tokens/tokens.json` | 手写（生成器输入） | `scripts/generate-tokens.ts`（prebuild 触发） | `light.color.primary = {emerald.600}` → **#059669** |
| **D' 生成产物** | `src/generated/tokens.css` + `src/generated/tokens.ts` | **自动生成** | `main.tsx:9` import 的 `.css`；`.ts`（`BASE_COLORS`/`SEMANTIC_COLORS`）**无引用方（孤儿）** | `--light-primary: #059669` |

**关键发现**：
1. `index.css` 是**运行时权威**（Tailwind 实际读它），但它**不是生成出来的**——是手写的。原假设「index.css 由生成器产出」不成立。
2. 生成器 `generate-tokens.ts`（存在**两份完全相同的副本**：`scripts/generate-tokens.ts` 与 `scripts/generate/generate-tokens.ts`）把 `tokens.json` 渲染为 `src/generated/tokens.css`。该 CSS 虽被 `main.tsx` import，但其变量命名为 `--light-primary`/`--semantic-*`，**与 `index.css` 的 `--primary` 不重名、不互相覆盖**，属于「加载了但几乎无人消费」的冗余层。
3. `src/generated/tokens.ts`（`BASE_COLORS` 等）**全仓库零引用**——彻底孤儿。
4. 历史上至少有 3 次「主色整改」尝试（emerald-600 #059669 → emerald-700 #15803d → 当前 160 84% 31% #0D9165），均未在全部源收敛，这正是多源分裂反复出现的根因。

---

## 2. 当前分裂量化（执行前）

| 角色 | A index.css（权威） | B SEMANTIC.raw（执行前） | C COLOR_TOKENS | D tokens.json | 文档 | 是否分裂 |
|---|---|---|---|---|---|---|
| **主色 primary** | #0D9165 (160 84% 31%) | #0f9d76 🔴 | —（无键） | #059669 (emerald.600) | #10b981 (160 84% 39%) | 🔴 **4 值** |
| **成功 success** | #21C45D (142 71% 45%) | #22a04b 🔴 | #15803d (green-700, WCAG 刻意) | green.600 #16a34a | — | 🟡 raw 不一致，C/D 为不同绿（设计意图） |
| **警示 warning** | #F59F0A (38 92% 50%) | #e6930a 🔴 | #f59e0b ✅ | amber.500 #f59e0b | — | 🔴 **raw 与权威不符** |
| **危险 danger** | #EF4444 (0 84.2% 60.2%) | #ef4444 ✅ | #ef4444 ✅ | red.500 #ef4444 | — | 🟢 全一致 |
| **信息 info** | #3C83F6 (217 91% 60%) | #3b82f6 🟡 | #3b82f6 ✅ | blue.500 #3b82f6 | — | 🟡 raw 不一致 |

**结论**：可观测分裂集中在 **主色 primary（4 值）** 与 **success/warning/info 的 `.raw`（图表取色错位）**。COLOR_TOKENS/tokens.json 中的「不同绿」多为 WCAG 对比度或基础色板的设计意图，不应强行统一。

---

## 3. 可行策略对比

### 策略 A：生成器单源（tokens.json → 一切）

- 做法：把 `index.css` 的语义变量改为 `@import` 生成产物；扩展 `generate-tokens.ts` 同时产出 `SEMANTIC_COLOR_ROLES.raw` 与 `COLOR_TOKENS`；`theme.tokens.*.ts` 改为 import 生成值。
- 优点：理论最彻底，单一机器源。
- 风险：**高**。触及 prebuild 构建链路、main.tsx、2 个令牌模块、index.css 结构；历史已证明此类大改易半途而废（见 §1 发现 4）。回归面大，需全量回归测试。
- 工作量：L（约 3–5 人日）。

### 策略 B：反向生成（index.css → tokens.json）

- 做法：写解析器把 `index.css` 的 `:root`/`.dark` 反向生成 `tokens.json`。
- 优点：以运行时为源。
- 风险：**中**。需新建 CSS→JSON 解析器，丢失现有 `tokens.json` 的引用解析（`{global.color.base.emerald.600}`）能力；与现有生成器方向相反，维护心智负担大。
- 工作量：L。

### 策略 C：调和 + 守护门禁（推荐，本轮执行）✅

- 做法：
  1. **指定 `index.css` 为权威真相**（它本就是运行时权威且已通过 WCAG AA 校验，见 `index.css` P1-4 注释）。
  2. **一次性调和** B 的 `SEMANTIC_COLOR_ROLES.raw`（primary/success/warning/info）与 D 的 `tokens.json`（primary/ring）对齐到 index.css 实算值。
  3. **修正文档** `04-ui-ux-specs.md` 中 `--primary/--ring` 漂移（39% → 31%）。
  4. **新增门禁** `scripts/verify-color-single-source.ts`：解析 `index.css` 的 HSL→HEX，断言与 `SEMANTIC_COLOR_ROLES.raw`（图表取色源）一致；接入 `audit` 复合门禁，防回归。
- 优点：**低风险、即时见效、根治反复**。不动构建链路，不碰孤儿生成层，直接消除可观测分裂，并用自动化守住。
- 风险：**低**。仅触及 2 个 TS 常量文件、1 个 JSON 主键、1 个文档片段，新增 1 个独立脚本。
- 工作量：S（约 0.5 人日）。

> 备注：策略 A/B 可作为 **后续 Phase 2** 选项（当团队决定彻底清理孤儿生成层、统一令牌链路时），但当前不应为「消除主色四值」这一目标承担其风险。

---

## 4. 推荐方案 C · 详细执行计划

### Phase 1（本轮已执行）

- [x] `theme.tokens.design.ts` `SEMANTIC_COLOR_ROLES`：`primary.raw` `#0f9d76` → `#0d9165`；`success.raw` `#22a04b` → `#21c45d`；`warning.raw` `#e6930a` → `#f59f0a`；`info.raw` `#3b82f6` → `#3c83f6`（全部对齐 index.css 实算 HEX）。
- [x] `design-tokens/tokens.json`：`light.color.primary`/`ring` → `#0d9165`；`dark.color.primary`/`ring` → `#157958`（对齐权威，使生成产物 `--light-primary` 不再与 `--primary` 分裂）。
- [x] `docs/reference/04-ui-ux-specs.md` 与 `docs/explanation/design/04-ui-ux-specs.md`：`--primary`/`--ring` 由 `160 84% 39%`(#10b981) 修正为 `160 84% 31%`(#0D9165)；主题色 `#10b981` → `#0D9165`。
- [x] 新增 `scripts/verify-color-single-source.ts` 门禁；接入 `package.json` 的 `audit` 复合门禁（新增 `verify:colorSoT`）。

### Phase 2（可选，后续）

- 清理 `src/generated/tokens.ts` 孤儿文件，或在 `AGENTS.md` 明确其为「仅供 Figma 映射参考、非运行消费」。
- 统一 `scripts/generate-tokens.ts` 双副本为单副本（消除重复维护）。
- 如决定推进策略 A，再评估构建链路改造。

---

## 5. 执行结果（本轮）

| 项 | 改前 | 改后 | 状态 |
|---|---|---|---|
| `SEMANTIC_COLOR_ROLES.primary.raw` | #0f9d76 | #0d9165 | ✅ |
| `SEMANTIC_COLOR_ROLES.success.raw` | #22a04b | #21c45d | ✅ |
| `SEMANTIC_COLOR_ROLES.warning.raw` | #e6930a | #f59f0a | ✅ |
| `SEMANTIC_COLOR_ROLES.info.raw` | #3b82f6 | #3c83f6 | ✅ |
| `tokens.json` light/dark primary·ring | #059669 / emerald.500 | #0d9165 / #157958 | ✅ |
| `04-ui-ux-specs.md` --primary/--ring | 160 84% 39% (#10b981) | 160 84% 31% (#0D9165) | ✅ |
| 门禁 `verify:colorSoT` | — | 已新增并接入 `audit` | ✅ |

**门禁验证**：`tsx scripts/verify-color-single-source.ts` 针对 primary/success/warning/danger/info 断言 index.css 与 SEMANTIC.raw 一致，运行通过（exit 0）；并已做负向测试（故意破坏 raw 触发 exit 1）。

---

## 6. 风险登记

| 风险 | 等级 | 缓解 |
|---|---|---|
| 改 `*.raw` 影响 canvas 图表取色 | 低 | raw 本就应与 UI 一致；仅从错误绿值修正为权威绿。 |
| `tokens.json` 主键改为字面量，破坏生成器引用解析 | 低 | 仅改 `light/dark.color.primary`/`ring` 为字面量，生成器原样输出，不触发引用解析；孤儿产物无消费方。 |
| 新增门禁误报阻断 CI | 低 | 仅比对 5 个语义色的 HEX，且值已对齐；已做负向验证。 |
| 历史「主色整改」经验表明大改易半途而废 | 已规避 | 策略 C 不做大改，仅调和 + 门禁；Phase 2 才评估策略 A。 |

---

## 7. 验证与门禁

- **新增门禁**：`verify:colorSoT`：`tsx scripts/verify-color-single-source.ts`
  - 解析 `src/index.css` `:root` 的 `--primary/--success/--warning/--destructive/--info` 的 HSL → HEX（标准算法）。
  - 解析 `src/constants/theme/theme.tokens.design.ts` 的 `SEMANTIC_COLOR_ROLES.<role>.raw`。
  - 断言两者 HEX 相等（不区分大小写）；任一不等则 exit 1 并打印差异。
- **接入**：已加入 `package.json` 的 `audit` 复合门禁（与 `audit:layers`/`audit:docs` 等同级），pre-push/CI 自动守护。
- **手测**：`npm run audit` 全绿；`vitest` 组件用例不受影响（未改组件 API）。

---

## 8. 工作量估算

| 策略 | 工作量 | 风险 | 推荐度 |
|---|---|---|---|
| A 生成器单源 | 3–5 人日 | 高 | 后续 Phase 2 |
| B 反向生成 | 3–5 人日 | 中 | 不推荐 |
| **C 调和 + 门禁（本轮）** | **0.5 人日** | **低** | **✅ 已执行** |

---

## 9. 结论

以「`index.css` 为权威 + 调和漂移值 + 自动化门禁」的策略 C，以最低风险、最短工期消除了主色四值分裂与 success/warning/info 的 `.raw` 错位，并用 `verify:colorSoT` 门禁把「单一事实源」从一次性约定变成可持续守护的工程约束——这比再次手动改值（历史已证明会反复漂移）更可靠。后续若团队决定清理孤儿生成层、彻底统一令牌链路，可再评估策略 A。
