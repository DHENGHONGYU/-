# UI 设计优化实施计划（详细版）

> 合并《UI设计优化实操方案 V6×V9×WorkBuddy》与《UI设计原则基线与创新水准》两份分析，
> 落地为**可逐步执行、可验收**的实施计划，并标注本回合已执行的增量。
> 配套文档：`UI设计优化实操方案_V6×V9×WorkBuddy.html`、`UI设计原则基线与创新水准_V9.html`

---

## 0. 关键发现（本回合实测，决定 P0 走向）

1. **运行时强调色是绿色，但令牌管线是断裂的** —— 这是「单一真相源」漂移的真实证据：
   - `tailwind.config.js` 将 `primary` 映射为 `hsl(var(--primary))`；真正生效的 `--primary` 由 `src/index.css` 的 `:root{--primary:160 84% 31%}`（绿）手写定义，被 Tailwind 全站消费。
   - `scripts/generate-tokens.ts` 以 `design-tokens/tokens.json`（原 primary = `blue.500` 蓝）生成 `src/generated/tokens.css`，但其输出的变量名是 `--color-primary` / `--color-ring`（而非 `--primary`/`--ring`）。
   - **`--color-primary` 在 `src` 中无任何引用**（已 grep 确认），是未被消费的「死变量」；它不会覆盖 `index.css` 的 `--primary`。因此界面实际一直是**绿色**。
   - 结论：令牌管线断裂——`tokens.json` 声称是单一真相源，但其生成的变量命名与 Tailwind 消费的 `--primary` 不匹配，`--primary` 实际由 `index.css` 手写、并未由 `tokens.json` 驱动。
2. **WCAG 实测**（见 `scripts/a11y-contrast.cjs` 输出）：绿/emerald 主色配白字对比度约 3.4–3.8，满足**大字号/粗体 AA(3:1)**，但未达**正文 AA(4.5:1)**；`emerald.700(#15803d)` 白字达 5.02，可满足严格正文 AA。index.css 注释「≥4.5:1」对正文不严谨。

**P0 决策**：将 `tokens.json` 的 primary/ring 由蓝改为 emerald（与运行时绿色品牌一致），使「规范源」不再自相矛盾；并据实记录管线断裂，作为 P4（令牌 lint + 真·单一真相源）的明确整治项——推荐修正生成器使其输出 `--primary`（而非 `--color-primary`），让 `tokens.json` 真正驱动 UI。蓝色白字对比度更弱，故不取蓝。

---

## 1. 设计水准基线（原则 → 现状评分）

| # | 原则 | 水位 | 承载阶段 |
|---|------|------|----------|
| ① | 视觉层次 | 中 55% | P0/P2 |
| ② | 留白节奏 | 中 50% | P0/P2 |
| ③ | 色彩节制(60-30-10) | 中 60% | P0/P4 |
| ④ | 排版秩序 | 中 58% | P0/P2 |
| ⑤ | 状态可见(Nielsen①) | 低 35% | P1/P3 |
| ⑥ | 一致性(令牌) | 高 75% | P0/P4 |
| ⑦ | 渐进披露 | 低 30% | P5 |
| ⑧ | 容错安心 | 中 45% | P3/P5 |
| ⑨ | 签名母题 | 低 25% | P2 |
| ⑩ | 有意义的美 | 中 50% | P2/P5 |

强项=一致性(⑥)；最弱=签名母题(⑨)/渐进披露(⑦)/状态可见(⑤)。提升策略=把低分项拉到目标线，不推倒重来。

---

## 2. 详细实施计划（P0–P6）

每阶段：`目标 → 具体步骤(文件/命令) → 依赖 → 验收 → 风险`。**✅=本回合已执行**，**⏳=计划中（需视觉/CI 验证）**。

### ✅ P0 设计基线固化（1–2 天）
- **目标**：令牌单一真相源 + 主色 AA 校验 + 单强调色公约。
- 步骤：
  1. ✅ 新建 `scripts/a11y-contrast.cjs` 并运行，产出对比度报告（见 §0）。
  2. ✅ 调和 `design-tokens/tokens.json`：`light.primary`/`light.ring`/`dark.primary`/`dark.ring` 由 `blue.500/400` 改为 `emerald.600/700`；运行生成器重写 `src/generated/tokens.css` + `tokens.ts`（注：生成的 `--color-primary` 仍是死变量，但规范源不再自相矛盾）。
  3. ✅ 对齐 `src/constants/theme/theme.tokens.design.ts` 的 `SEMANTIC_COLOR_ROLES.primary.raw` → `#059669`。
  4. ✅ `AGENTS.md §三` 增补：① 单一克制强调色公约；② 令牌管线一致性规则（tokens.json 为源，generated 须与 index.css 一致，主色=emerald）。
- 验收：`node scripts/a11y-contrast.cjs` 可跑；`grep -n "primary.*blue\|ring.*blue" design-tokens/tokens.json` 零命中；`npm run audit:docs`。
- 风险：低（tokens.json 为生成源，可回滚）。

### ⏳ P1 暗色优先 & 主题体验（2–3 天）
- **目标**：驾驶舱/分析舱默认暗色 + 持久化 + 无 FOUC。
- 步骤：
  1. 新增/调整 `src/store/themeStore.ts`（`withBroadcast` 跨 Tab 同步，符合 AGENTS.md），驾驶舱默认 `dark` 且持久化。
  2. 补全暗色令牌；核查 `chartColors.ts` 暗色变体对比度。
  3. `index.html` 内联脚本在 CSS 加载前读持久化值设 `data-theme`，消除首屏闪白。
  4. **对齐主题属性**：确认 `ThemeProvider` 的 `data-theme` 与 `generated/tokens.css` 的 `[data-theme]` 一致（已一致），并让 `index.css` 的 `.dark` 与 `data-theme` 双轨统一，避免两套变量并存漂移。
- 依赖：P0。验收：驾驶舱暗色覆盖率 100%、无 FOUC、跨 Tab 同步。风险：中（暗色令牌覆盖）。

### ✅ P2 统一视觉锚点（签名母题）（2–3 天中的组件部分）
- **目标**：植入 V9 专属签名母题，统一经 WidgetShell 收口。
- 步骤：
  1. ✅ 新建 `src/components/cockpit/SignalSpectrum.tsx`：全局「信号强度谱」母题（弱→强渐变 + 标记），引用 `SEMANTIC_COLOR_ROLES`/令牌，无硬编码色。
  2. ⏳ 核查全部 cockpit widget 经 `WidgetShell.tsx` 渲染；未接入者统一收口，顶部挂锚点条。
- 依赖：P0。验收：核心 widget 100% 经 WidgetShell；锚点组件单测通过。风险：低。

### ✅ P3 交互与状态标准（3–4 天中的组件部分）
- **目标**：loading/empty/error/skeleton 四态 + 微动效令牌。
- 步骤：
  1. ✅ 新建 `src/components/ui/states/{Loading,Empty,Error,Skeleton}.tsx`，引用 `THEME_TOKENS`/`SEMANTIC_COLOR_ROLES`，无硬编码色。
  2. ✅ `src/constants/theme/theme.tokens.base.ts` 的 `THEME_TOKENS` 新增 `motion`（duration/easing）令牌。
  3. ⏳ 核心 8 个 widget 接入四态（推广）。
- 依赖：P0。验收：核心 widget 四态覆盖 ≥90%；动效零魔法时长。风险：中（改造较多）。

### ⏳ P4 令牌迁移债清零 & 视觉 QA 闸门（2–3 天）
- **目标**：lint 禁裸 Tailwind 色类 + 令牌一致性扫描 CI 闸门。
- 步骤：
  1. ESLint(flat config) 加规则禁 `text-/bg-/border-(red|blue|green|…)-\d+` 裸类（白名单 `STOCK_COLOR_TOKENS` 固定红绿）。分两 PR：先规则(warning)再清零(error)。
  2. `scripts/token-scan.cjs` 扫描源码裸色类，CI 卡点。
  3. Playwright 截图 diff 受本环境沙箱限制，标为**本地手动闸门**。
- 依赖：P0–P3。验收：裸色类 0 命中（白名单除外）；CI 红则阻断。风险：中。

### ⏳ P5 结果优先呈现 & 渐进披露（3–4 天）
- **目标**：复盘「成品卡」+ 向导式复盘。
- 步骤：
  1. 新建 `src/components/output/ResultCard.tsx`（可预览/分享/导出）。
  2. 输入/输出舱引入分步引导（模式切换），老手可跳过。
- 依赖：P2。验收：成品卡可预览/导出；向导可跳过。风险：中。

### ⏳ P6 移动适配 & 常态化巡检（持续）
- **目标**：核心舱室响应式 + 巡检 skill 固化。
- 步骤：
  1. 驾驶舱/复盘卡断点适配（≤375px 不崩）。
  2. `SkillManage` 沉淀「参考站逆向比对」为 `ui-design-audit` skill。
- 依赖：P1。验收：移动断点不崩；skill 可用。风险：低。

---

## 3. 验收闸门（对齐 AGENTS.md）

| 阶段 | 必须通过的闸门 |
|------|----------------|
| P0 | `node scripts/a11y-contrast.cjs`；`npm run audit:docs`；`npx tsc --noEmit` |
| P1 | `npm run audit:layers`；`npm run test -- --run` |
| P2 | `npm run audit:layers`；tsc；锚点单测 |
| P3 | `npm run test -- --run`；四态覆盖 |
| P4 | CI lint gate；`scripts/token-scan.cjs` |
| P5 | tsc；test |
| P6 | 手动移动验真；skill 沉淀 |

**回滚纪律**：每阶段可独立回滚；回滚后重跑 `tsc --noEmit` + `audit:layers` + `test --run` + `audit:docs`。

---

## 4. 本回合已落地产物

| 类型 | 文件 | 说明 |
|------|------|------|
| 新增 | `scripts/a11y-contrast.cjs` | WCAG AA 对比度校验，可运行 |
| 修改 | `design-tokens/tokens.json` | primary/ring 蓝→emerald（与运行时/文档一致） |
| 生成 | `src/generated/tokens.css`、`src/generated/tokens.ts` | 由 tokens.json 重新生成 |
| 修改 | `src/constants/theme/theme.tokens.design.ts` | `SEMANTIC_COLOR_ROLES.primary.raw` → `#059669` |
| 修改 | `AGENTS.md` | §三 增补单强调色 + 令牌管线一致性公约 |
| 新增 | `src/components/cockpit/SignalSpectrum.tsx` | 签名母题组件（P2） |
| 新增 | `src/components/ui/states/{Loading,Empty,Error,Skeleton}.tsx` | 四态组件（P3） |
| 修改 | `src/constants/theme/theme.tokens.base.ts` | `THEME_TOKENS.motion` 动效令牌（P3） |
| 文档 | `UI设计优化实施计划_详细版.md` | 本计划 |

> 待视觉/CI 验证后执行：P1 主题切换、P4 lint/CI、P5 向导、P6 移动（详见 §2）。

## 5. 验证方式
- 本地 `npm run dev` → 强调色应统一为绿色（emerald），不再蓝绿并存。
- `node scripts/a11y-contrast.cjs` 查看对比度报告。
- `npx tsc --noEmit` 校验新增 TS 类型安全。
