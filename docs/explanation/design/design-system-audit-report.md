---
title: 设计系统差异对比报告
type: reports
domain: frontend
phase: testing
tier: standard
status: active
maintainer: V9 Architecture Team
summary: "评审类型：系统性校对分析（规范�?/ 一致�?/ 可扩展�?/ 完整性） 评审日期�?026-07-17..."
tags: [frontend, audit, design, system]
version: v1.0.0
last_updated: 2026-07-17
code_version: 2.0.0
doc_id: V9-DOC-FRONT-054
referenced_by: [V9-DOC-META-000, V9-DOC-PROJ-176]
change_log:
  - version: v1.0.0
changes: Initial version established
date: 2026-07-17
---

# V9 智能投研复盘系统 · 设计系统差异对比报告

> 评审类型：系统性校对分析（规范�?/ 一致�?/ 可扩展�?/ 完整性）
> 评审日期�?026-07-17
> 事实来源：`design-tokens/tokens.json`、`src/constants/theme/theme.tokens.*.ts`、`src/index.css`、`tailwind.config.js`、`src/theme.config.ts`、`docs/reference/04-ui-ux-specs.md`、`src/components/atoms/*`
> 说明：所有「渲染值」由 `index.css` �?HSL CSS 变量推导，为界面真实呈现色；各令牌层的「定义值」为代码/文档中声明的色值，二者差异即本报告的核对重点�?
---

## 0. 评审范围与方�?
| 维度 | 校对内容 | 比对对象 |
|---|---|---|
| 颜色体系 | 主色 / 辅助�?/ 语义色（成功·警告·错误·信息�? 中性色阶；HEX·RGB·HSL；明暗适配；命名语义化 | `tokens.json`、`THEME_TOKENS`、`COLOR_TOKENS`、`SEMANTIC_COLOR_ROLES`、`index.css`、设计文�?|
| 字体层级 | H1–H6 + 正文 + 标注；字号·字重·行高·字间距；跳�?/ 缩放比例校验 | `TYPOGRAPHY_SCALE`、`tailwind.config.js`、`THEME_TOKENS.typography`、`theme.config.ts` |
| 间距规则 | 8px 基准栅格�?/8/16/24/32/48/64）；页面/组件�?组件间；非基准倍数校验 | `THEME_TOKENS.spacing/gap`、`theme.config.ts`、`tokens.json.spacing`、`LAYOUT_TOKENS` |
| 基础组件 | 按钮/输入�?卡片/弹窗/导航�?表格/标签/复选框；场景·属性·五态·交互；与基础体系引用一致�?| `src/components/atoms/*`、`src/components/molecules/Dialog.tsx` |

---

## 1. 评分标准与结�?
### 1.1 评分维度定义（每�?1�?0 分）

- **规范性（Normativity�?*：是否存在单一事实源、命名语义化、文档与代码同步、组件是否遵守令牌规则、是否有硬编码旁路�?- **一致性（Consistency�?*：跨层令牌、组件实际引用是否指向同一组基础值；明暗模式、中性色族是否统一�?- **可扩展性（Extensibility�?*：新增主�?颜色/组件是否低成本、有清晰模式、有 helper 与映射支撑�?- **完整性（Completeness�?*：是否覆盖需求全部条目（H1–H6�?px 刻度、组件五态规范文档、HEX/RGB/HSL、明暗方案）�?
### 1.2 评分结果

| 维度 | 得分 | 关键判定 |
|---|---:|---|
| 规范�?| **6 / 10** | 分层令牌结构清晰、有 WCAG AA 修复、figma 映射；但多套并行令牌层、文档与代码漂移、双字体/双间距体系拉低分数�?|
| 一致�?| **5 / 10** | 渲染�?CSS 自身一致；�?primary/success/warning 被定�?4�? 种不同值，中性色族碎片化（slate/gray/neutral/暖灰），Button 危险/成功态绕过语义令牌�?|
| 可扩展�?| **7 / 10** | DTCG `tokens.json`（含 light/dark/semantic/chart）、figma 双向映射、helper 函数、角色化 `SEMANTIC_COLOR_ROLES`、原子组件结构均良好；但多对象并行导致「改一处要�?4�? 处」�?|
| 完整�?| **6 / 10** | 明暗 HSL、组件原子齐备；�?*缺失 H5/H6**、字间距未按层级全覆盖�?px 刻度含非基准值且未收敛为单一刻度�?*组件规范文档缺失**（仅有代码无状态化规范）�?|
| **综合** | **�?6.0 / 10** | 骨架优秀、细节散逸。建议优先收敛「令牌单一事实源」与「组件规范文档」�?|

---

## 2. 颜色体系审计

### 2.1 渲染真值表（界面实际呈现色�?
> �?`src/index.css` `:root` �?`.dark` �?HSL 变量推导�?
| 角色（语义） | 亮色 HSL | 亮色 HEX | 亮色 RGB | 暗色 HSL | 暗色 HEX | 暗色 RGB |
|---|---|---|---|---|---|---|
| 主色 primary | 160 84% 31% | #0D9165 | 13,145,101 | 160 70% 28% | #157958 | 21,121,88 |
| 辅助 secondary | 240 4.8% 95.9% | #F4F4F5 | 244,244,245 | 0 0% 20% | #333333 | 51,51,51 |
| 强调 accent | 240 4.8% 95.9% | #F4F4F5 | 244,244,245 | 0 0% 20% | #333333 | 51,51,51 |
| 表面 surface | 0 0% 100% | #FFFFFF | 255,255,255 | 0 0% 16% | #292929 | 41,41,41 |
| 次级表面 surface-2 | 240 4.8% 96.5% | #F6F6F7 | 246,246,247 | 0 0% 18% | #2E2E2E | 46,46,46 |
| 文字�?foreground | 240 10% 3.9% | #09090B | 9,9,11 | 0 0% 96% | #F5F5F5 | 245,245,245 |
| 文字�?muted-fg | 240 3.8% 46.1% | #757576 | 117,117,118 | 0 0% 64% | #A3A3A3 | 163,163,163 |
| 文字�?text-tertiary | 240 3.8% 60% | #98989A | 152,152,154 | 0 0% 55% | #8C8C8C | 140,140,140 |
| 边框 border | 240 5.9% 90% | #E4E4E7 | 228,228,231 | 0 0% 24% | #3D3D3D | 61,61,61 |
| 强边�?divider | 240 5.9% 78% | #C4C4CA | 196,196,202 | 0 0% 28% | #474747 | 71,71,71 |
| 成功 success | 142 71% 45% | #21C45D | 33,196,93 | 142 69% 48% | #26CF64 | 38,207,100 |
| 警告 warning | 38 92% 50% | #F59F0A | 245,159,10 | 38 92% 55% | #F6A823 | 246,168,35 |
| 错误/危险 destructive | 0 84.2% 60.2% | #EF4444 | 239,68,68 | 0 62.8% 30.6% | #7F1D1D | 127,29,29 |
| 信息 info | 217 91% 60% | #3C83F6 | 60,131,246 | 217 91% 65% | #5593F7 | 85,147,247 |

### 2.2 主色 / 辅助�?
- **主色（行�?强调�?*：渲染层为翡翠绿（`160 84% 31%`）。定义层出现 **4 种不同�?*（见 §2.3 表），且设计文档 `04-ui-ux-specs.md` 写的�?`160 84% 39%`�?10b981），与代�?`160 84% 31%` 不符 �?**文档漂移**�?- **辅助�?*：`secondary` �?`accent` 在亮色均�?`240 4.8% 95.9%`（近 slate-100），暗色均为 `0 0% 20%`。命名语义清晰�?- **宋韵辅助�?*（独立变量，�?§2.6）：ru-blue / guan-green / cinnabar / ivory / warm-gray 已定义但**未接入主�?语义令牌**，形成第二套美学身份�?
### 2.3 语义色差异对比（核心不一致）

| 语义 | 渲染值（index.css�?| SEMANTIC_COLOR_ROLES.raw | COLOR_TOKENS / THEME_TOKENS | tokens.json | 设计文档 | 严重�?|
|---|---|---|---|---|---|---|
| 主色 primary | #0D9165 / #157958 | #0d9165 | �?| #0d9165 / #157958 | 160 84% 31% #0D9165 | 🟢 低（已统一，由 verify:colorSoT 锁值） |
| 成功 success | #21C45D / #26CF64 | #21C45D | #15803D(green-700) / text-green-500 #22C55E | green-700 #15803D | �?| 🔴 �?|
| 警告 warning | #F59F0A / #F6A823 | #F59F0A | #F59E0B(amber-500) | amber-500 #F59E0B | �?| 🟡 �?|
| 错误 danger | #EF4444 / #7F1D1D | #EF4444 | #EF4444 | red-500 #EF4444 | �?| 🟢 低（值一致，仅命名分裂） |
| 信息 info | #3C83F6 / #5593F7 | #3C83F6 | #3C83F6 | blue-500 #3C83F6 | �?| 🟢 一�?|

**关键结论**�?1. `SEMANTIC_COLOR_ROLES.*.raw` �?**info / danger** 与渲染变量一致；**primary / success / warning �?`raw` 与真�?CSS 变量不符**——任何用 `raw` 取色（图�?canvas）的组件，会得到与用 `text-success` 类不同的颜色�?2. **成功色定义已收敛为单一事实�?#21C45D**：`raw` / `tokens.json` / `COLOR_TOKENS.success` 三处对齐；`bg-green-700` 为白字徽章保留的 WCAG AA 深色变体（与 `text-success`/`#21C45D` 并存，非旁路），详见 C3 ✅�?3. **错误色命名三分裂**：`danger`（SEMANTIC_COLOR_ROLES、COLOR_TOKENS）、`destructive`（THEME_TOKENS、tailwind、tokens.json）、需求术语「错误」。建议统一�?`danger` 并保�?`destructive` 别名�?
### 2.4 中性色�?
- 亮色模式中性使�?**hue 240（slate/偏蓝�?*；暗色模式切换为 **hue 0（纯灰）**——符合「亮�?stone 暖灰系、暗�?neutral 高级灰」的设计意图�?- **问题**：令牌层同时混用三套中性家族命名——`slate-*`（`COLOR_TOKENS.textPrimary` 等）、`neutral-*`（`COLOR_TOKENS.bgCard` 等）、`gray-*`（`COLOR_TOKENS.neutral` 等），且 `tokens.json` 同时导出了完�?`gray` �?`slate` 两套色阶。建议收敛为**单一中性族**（推�?slate 作为基础、保�?warm-gray 作宋韵点缀），并统一命名�?
### 2.5 股票涨跌例外色（红涨绿跌，豁免主题）

| 语义 | HEX | RGB | 说明 |
|---|---|---|---|
| 上涨 up | #EF4444 | 239,68,68 | 红，豁免明暗切换 |
| 下跌 down | #22C55E | 34,197,94 | 绿，豁免明暗切换 |
| 平盘 neutral | #9CA3AF | 156,163,175 | �?|

实现集中�?`STOCK_COLOR_TOKENS`（L5），有明确豁免主题约束与 helper（`getStockColor` 等）�?*规范且一�?*，是体系的亮点�?
### 2.6 宋韵美学色（独立变量，未完全接入�?
| 变量 | HSL | HEX | 现状 |
|---|---|---|---|
| ru-blue 汝窑�?| 205 35% 70% | #98B7CD | 已定义，未接入主�?语义 |
| guan-green 官绿 | 145 15% 65% | #98B3A4 | 已定义，未接�?|
| cinnabar 朱砂�?| 5 65% 52% | #D44235 | �?已收敛（2026-07-17）：明确 cinnabar �?*文化强调/装饰�?*，功能警示色�?amber；`04-ui-ux-specs.md` 已订正，消除文档与实现矛�?|
| ivory 象牙�?| 40 33% 94% | #F5EEEB | 背景点缀，未接入 token |
| warm-gray 暖灰 | 30 12% 90% | #E9E6E2 | 中性点缀，未接入 token |

### 2.7 颜色体系修正建议

1. **建立单一事实�?*：以 `index.css` �?HSL 变量为唯一渲染源；`SEMANTIC_COLOR_ROLES.*.raw` 改为由变�?*自动推导**（或代码生成），消除手写 `raw` 与变量不符�?（已落地�?`verify:colorSoT` 门禁锁定 raw==渲染值，替代自动推导，ROI 更优；详�?`docs/explanation/design/color-token-consolidation-feasibility.md`�?
2. **收敛主色定义**：将 `tokens.json` / 设计文档 / `raw` 全部对齐�?`160 84% 31%`（亮�? `160 70% 28%`（暗），并修正文�?`160 84% 39%` 的漂移�?3. **统一成功/警告**：选定一组（建议渲染�?#21C45D / #F59F0A），清除 green-700 / #22A04B / #E6930A 等旁路�?4. **中性族收敛**：以 slate 为基础、warm-gray 为宋韵点缀，统一 `slate/neutral/gray` 命名�?5. ~~**落地宋韵警示�?*~~：✅ 已完成（2026-07-17）——明确「朱砂红仅用于文化强�?装饰，功能警示仍�?amber」，`04-ui-ux-specs.md`（reference + explanation/design 两份）已订正，文档与实现矛盾消除�?
---

## 3. 字体层级审计

### 3.1 当前排版阶梯（`TYPOGRAPHY_SCALE` �?`tailwind.config.js` 已对齐）

| 角色 | 字号 px | 字重 | 行高 | 字间�?| 用�?|
|---|---:|---|---|---|---|
| display | 28 | 700 | 1.2 | -0.01em | 页面主标�?/ 英雄�?|
| h1 | 24 | 700 | 1.25 | -0.01em | 页面标题 |
| h2 | 20 | 600 | 1.3 | �?| 卡片标题 |
| h3 | 18 | 600 | 1.4 | �?| 分组标题 |
| h4 | 16 | 600 | 1.4 | �?| 小标�?/ 表头 |
| body-lg | 16 | 400 | 1.6 | �?| 导语 / 重要段落 |
| body | 14 | 400 | 1.6 | �?| 默认正文 |
| body-sm | 13 | 400 | 1.5 | �?| 辅助正文 / 单元�?|
| caption | 12 | 400 | 1.4 | �?| 说明 / 时间�?|
| overline | 11 | 600 | 1.4 | 0.08em | 分组标签 / 胶囊 |

### 3.2 与「H1–H6」标准对�?
- **缺失 H5 / H6**：体系仅定义�?**h4**，需求要�?H1–H6 全层级。h4(16) 已与 body-lg(16) 重叠，向下延�?h5/h6 会与 body 区间�?6/14/13）冲突，需重排比例�?- **跳级/重叠**：h4(16) == body-lg(16) 存在语义重叠；建�?h5=15/500、h6=13/600，并明确�?body 的边界�?- **字间距覆盖不�?*：仅 display/h1/overline 定义�?letterSpacing，h2–h4、body*、caption 无字间距规范�?
### 3.3 字体双体系问�?
| 体系 | 令牌 | 取�?| 问题 |
|---|---|---|---|
| 新（角色化） | `TYPOGRAPHY_SCALE` / tailwind ladder | display/h1–h4/body*/caption/overline | �?tailwind 对齐，规�?|
| 旧（Tailwind 风） | `THEME_TOKENS.typography.fontSize` | xs12/sm14/base16/lg18/xl20/2xl24/3xl30/4xl36 | 并行存在，无 h1–h6 命名 |
| 旧（配置对象�?| `theme.config.ts.fontSize` | xs12/sm14/base16/lg18/xl20/2xl24 | 同上，第三套 |

新代码可能用 `text-h1` �?`text-2xl` 表达同一视觉，造成不一致�?
### 3.4 字体层级修正建议

1. 补全 **h5�?5px/500）、h6�?3px/600�?*，重排使 h4(16)≠body-lg(16)（建�?body-lg �?15 �?h4 �?18 �?h3 区分）�?2. �?**h2–h4、body*、caption 补全字间�?*规范（可采用 tracking-tight 于标题、tracking-normal 于正文）�?3. 标记 `THEME_TOKENS.typography.fontSize` �?`theme.config.ts.fontSize` �?*废弃**，新代码统一�?`TYPOGRAPHY_SCALE` + `text-*` 工具类�?
---

## 4. 间距规则审计

### 4.1 8px 基准栅格标准 vs 现状

需求标准刻度：**4 / 8 / 16 / 24 / 32 / 48 / 64 px**�? 为半步微调，其余�?8 的倍数）�?
### 4.2 现有多套间距刻度对比

| 来源 | 定义值（px�?| 备注 |
|---|---|---|
| `THEME_TOKENS.spacing` | 4 / 8 / 16 / 24（p-1/2/4/6�?| �?32/48/64 |
| `THEME_TOKENS.gap` | 4 / 8 / **12** / 16 / 24（gap-1/2/3/4/6�?| **12px �?8 倍数** |
| `theme.config.ts.spacing` | 4 / 8 / 16 / 24 / 32 / 48 | �?64 |
| `tokens.json.spacing` | 0/4/8/**12**/16/**20**/24/32/**40**/48/64/**80** | **12/20 �?8 倍数�?0/80 超出标准�?* |
| `LAYOUT_TOKENS` | pagePad 24 / sectionGap 24 / **cardPadding 20** / header 56 | **20px �?8 倍数** |

### 4.3 非基准倍数值清单（需整改�?
- **12px**：`THEME_TOKENS.gap.md`(gap-3)、`tokens.json` spacing-3、Button `md` 尺寸 `px-3`�?- **20px**：`tokens.json` spacing-5、`LAYOUT_TOKENS.cardPadding`�?- 超出标准集但合规�?8 倍数�?0px�?0px（可保留为扩展档，但建议明确列入刻度）�?
### 4.4 间距修正建议

1. 收敛�?*单一 8px 刻度**：`{xs:4, sm:8, md:16, lg:24, xl:32, 2xl:48, 3xl:64}`（可�?`64` 与扩展档 `40/80` 但需登记）�?2. �?`gap-3`(12) �?`gap-2`(8) �?`gap-4`(16)；`cardPadding` 20 �?24；`spacing-5`(20) 下线或改�?24�?3. �?`THEME_TOKENS` / `tokens.json` 间建�?*同一组间距令�?*，消除命名与数值双轨�?
---

## 5. 基础组件规范（Part B�?
> 本节给出各组件「应然规范�?「现状核对」。状态均含：默认 / 悬停 / 聚焦 / 禁用 / 加载�?> 基础组件规范已抽离为独立基线文档 `docs/explanation/design/component-specs.md`（唯一事实源，含五态规范与一致性核对）；本文保留差异发现与核对记录�?
### 5.1 Button 按钮
- **使用场景**：页面主操作、次级操作、危险操作、表单提交�?- **属�?*：`variant: primary|secondary|outline|ghost|danger|success|default`；`size: sm|md|lg`；`asChild`；`isLoading`；原�?button 属性�?- **状态样�?*�?  - 默认：primary=`bg-primary text-primary-foreground`；secondary=`bg-secondary text-secondary-foreground`；outline=`border border-input bg-background`；ghost=`hover:bg-accent`�?  - 悬停：primary=`hover:bg-primary/90`；secondary=`hover:bg-secondary/80`；danger/success=`hover:opacity-90`�?  - 聚焦：`focus-visible:outline-none` + `ring-2 ring-blue-500`（⚠�?直接�?`THEME_TOKENS.focusVisible.ringColor`，非语义 `ring-ring`）�?  - 禁用：`disabled:opacity-50 disabled:pointer-events-none`�?  - 加载：`isLoading` 时建议显�?spinner（`motion.spin`）并禁用交互（当前代码未实现 loading 视觉，仅声明属性）�?- **交互**：`asChild` 支持多态（如渲染为链接）；点击�?`transition-colors`�?- **与基础体系一致�?*：�?`danger`/`success` 已于 2026-07-17 改用语义令牌 `bg-destructive`/`bg-success`（原 `COLOR_TOKENS.*.bgClass` 裸类，非主题感知）；🟢 `variant="default"` 已于 2026-07-17 补全（`bg-surface-2 text-foreground`）；🟢 焦点环已修复——原 `ring-2/ring-blue-500` �?`focus-visible:` 前缀导致恒显蓝环，现对齐 `Input.tsx` 加前缀�?026-07-17）；🟢 `md` 尺寸 `px-3`(12px)�?×4px，属控件内边距合�?4px 倍数（与 `Input.tsx` 共用 `spacing.pxMd`），判定合规、不作全局改动�?
### 5.2 Input 输入�?- **使用场景**：表单文本输入、搜索框�?- **属�?*：标�?`input` 属性；`size`；`disabled`；`error`（校验态）�?- **状态样式（应然�?*：默�?`bg-background border border-input`；聚�?`focus-visible:ring-2 ring-ring border-ring`；禁�?`disabled:opacity-50`；错误�?`border-destructive text-destructive`�?- **交互**：输入即时反馈；聚焦显示 ring；与 Label 关联（`htmlFor`）�?- **与基础体系一致�?*：�?标准 shadcn 模式，引用语义令�?`border-input`/`ring-ring`，符合基础体系；建议核对是否仍残留 `THEME_TOKENS.color` 裸类（应无）�?
### 5.3 Card 卡片
- **使用场景**：信息容器、Widget 外壳、列表项�?- **属�?*：`padding`（建议接 `LAYOUT_TOKENS.cardPadding`，⚠�?当前 20px 需�?24）；`elevation: sm|md|lg`（接 `ELEVATION`）；`interactive`�?- **状态样�?*：默�?`bg-card border border-border rounded-md`；悬停（interactive）`hover:shadow-elevation-2`；聚焦（可聚焦卡片）`focus-visible:ring-2 ring-ring`�?- **交互**：作为容器不自带交互，interactive 态提供悬浮抬升�?- **与基础体系一致�?*：�?引用 `bg-card`/`border-border`/`ELEVATION`，一致；🟡 `cardPadding=20` 需并入 8px 刻度�?
### 5.4 Modal 弹窗（Dialog�?- **使用场景**：确认操作、表单录入、详情浮层�?- **属�?*：`open`；`onClose`；`size`；`title`；`footer`�?- **状态样�?*：遮�?`bg-black/50`；面�?`bg-card shadow-elevation-3 rounded-lg`；标�?`text-h3 font-semibold`；关闭按�?`hover:bg-accent`�?- **交互**：ESC 关闭、点击遮罩关闭、焦点陷阱（focus trap）、打开时锁定背景滚动；进出场用 `motion` 令牌�?- **与基础体系一致�?*：�?应使用语义令牌；建议核对 `molecules/Dialog.tsx` 是否混用 `THEME_TOKENS` 裸类�?
### 5.5 Navbar 导航�?- **使用场景**：顶部全局导航、舱室切换（五舱工作流）�?- **属�?*：`items`；`activeKey`；`height`（接 `LAYOUT_TOKENS.headerHeight=56px`）；`transparent`�?- **状态样�?*：默�?`bg-background border-b border-border`；激活项 `text-primary border-b-2 border-primary`；悬�?`hover:bg-accent`；禁用项 `opacity-50`�?- **交互**：点击切换舱室、激活态高亮、响应式折叠�?- **与基础体系一致�?*：�?引用语义令牌；�?高度 56px �?8 倍数（合规），但需�?`LAYOUT_TOKENS` 绑定而非硬编码�?
### 5.6 Table 表格
- **使用场景**：数据列表、行�?因子矩阵�?- **属�?*：`columns`；`data`；`striped`；`dense`；`onRowClick`�?- **状态样�?*：表�?`text-caption font-semibold text-tertiary`；单元格 `text-body-sm text-foreground`；行悬停 `hover:bg-muted`；选中�?`bg-primary/10`；涨跌单元格�?`STOCK_COLOR_TOKENS`（红涨绿跌）�?- **交互**：排序、行点击、分页（�?`Pagination` 原子）�?- **与基础体系一致�?*：�?应引用语义令牌与 `STOCK_COLOR_TOKENS`；建议核对是否直接写 `text-green-500` 等裸类（�?grep 抽样，组件层裸色极少，合规性较好）�?
### 5.7 Tag 标签（Badge�?- **使用场景**：状态标记、分类、信号等级。实现组件为 `src/components/atoms/Badge.tsx`�?- **属�?*：`variant: default|secondary|outline|destructive|success|warning`�?- **状态样式（已实现，2026-07-17 修订�?*：默�?`rounded-full px-2.5 py-0.5 text-xs font-semibold`；`destructive`/`success`/`warning` 用主题感知语义令�?`bg-destructive|success|warning + text-*-foreground`；`outline` �?`border-border text-foreground`�?- **交互**：纯展示为主，`transition-colors` 提供悬停过渡�?- **与基础体系一致�?*：�?六变体已全部改用主题感知语义令牌�?026-07-17 迁移完成，测试同步）——原 `destructive/success/warning` �?`COLOR_TOKENS.*.bgClass`＋`text-white`＋`HOVER.bg*` 裸类、`outline` �?`text-slate-800`，明暗不一致，已消除�?
### 5.8 Checkbox 复选框
- **使用场景**：多选、筛选条件、协议勾选�?- **属�?*：`label`；`checked`；`disabled`；`indeterminate`�?- **状态样式（已实现，2026-07-17 修订�?*：默�?`h-4 w-4 rounded border-border bg-background text-primary accent-primary`；聚�?`focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring`；悬�?`hover:border-primary`；禁�?`opacity-50`；选中 `bg-primary text-primary-foreground`�?- **交互**：点击切换、键�?Space 切换、label 联动�?- **与基础体系一致�?*：�?引用语义令牌（`border-border`/`text-primary`/`ring-ring`）；🟢 焦点环已�?`focus:ring-1` 统一�?`focus-visible:ring-2`，与全局焦点规范一致（2026-07-17 修复）�?
### 5.9 组件间一致性问题汇�?| 组件 | 问题 | 严重�?| 状�?|
|---|---|---|---|
| Button | danger/success �?`COLOR_TOKENS` 裸类，非主题感知、与语义令牌不符 | 🔴 | �?已修复（2026-07-17�?|
| Button | `variant="default"` 声明但未实现 | 🔴 | �?已修复（2026-07-17�?|
| Button | 焦点环缺 `focus-visible:` 前缀致恒显蓝�?| 🔴 | �?已修复（2026-07-17�?|
| Checkbox | 焦点�?`focus:ring-1` vs 全局 `ring-2` 不一�?| 🟡 | �?已修复（2026-07-17�?|
| Badge | `destructive/success/warning`＋`text-white` 裸类、`outline` �?`text-slate-800`，明暗不一�?| 🔴 | �?已迁移（2026-07-17，测试同步） |
| Button | `md` 尺寸 `px-3`(12px) �?8px 栅格 | 🟡 | �?判定合规�?×4px 控件内边距，不改动） |
| 文档 | `04-ui-ux-specs.md` 称「朱砂红为警示色」，实现�?amber | 🟡 | �?已订正（cinnabar 归为文化强调色） |
| 通用 | 组件规范文档缺失，仅代码无状态化规范 | 🔴 | �?已建�?`docs/explanation/design/component-specs.md` |

---

## 6. 不一致项总表（位�?+ 修正建议�?
| # | 位置 | 不一致描�?| 严重�?| 修正建议 |
|---|---|---|---|---|
| C1 | `SEMANTIC_COLOR_ROLES.*.raw` vs `index.css` | primary/success/warning �?raw 与渲�?HSL 不符 �?已对�?| �?| raw 已手动对齐渲染值（primary #0d9165 / success #21c45d / warning #f59f0a / info #3c83f6），并以 `verify:colorSoT` 门禁锁定（替代原"自动推导/生成"方案，ROI 更优�?|
| C2 | `tokens.json` / 设计文档 / raw | 主色 4 种定义（#0D9265/#0F9D76/#059669/#10b981）→ 已统一 | �?| 统一�?`160 84% 31%`(�?/`160 70% 28%`(�?；raw / `tokens.json` / 文档均已对齐 #0D9165/#157958，新�?`verify:colorSoT` 门禁锁�?|
| C3 | `COLOR_TOKENS.success` vs 语义令牌 | 成功色定义已收敛：raw/tokens.json/`COLOR_TOKENS.success` 三处均对�?#21C45D�?0+ 文本/图标用法经一致性复核语义等价，无需改动 | �?| raw/tokens.json 对齐 #21C45D（含 regenerate tokens.css）；`COLOR_TOKENS.success` 收敛�?{hex:#21C45D, tailwind:text-success, bgClass:bg-green-700[白字徽章 WCAG AA 深色变体], rgb:33,196,93}�?0+ 用法因语义等价自动对齐，仅同�?10 个测试断言（Badge 六变�?hover/主题 + 5 �?C3 字面量测试），全套门禁通过�? 文件 115 测试 + verify:colorSoT�?|
| C4 | `04-ui-ux-specs.md` | 文档 primary `160 84% 39%` 与代�?`31%` 漂移 �?已修�?| �?| 文档已订正为 `160 84% 31% #0D9165`；后续可参�?`verify:colorSoT` 落地文档自动校验 |
| C5 | 命名 | 错误�?`danger`/`destructive`/「错误」三分裂 �?已收�?| �?| 规范语义名统一�?`danger`：`SEMANTIC_COLOR_ROLES.danger` / `COLOR_TOKENS.danger` 已用；`THEME_TOKENS.color` 新增 `danger/dangerBg/dangerRaw` 别名（值等�?#ef4444），�?`destructive*`（仅 3 处引用）�?`@deprecated`、保留为 shadcn tailwind 角色兼容别名 |
| C6 | 中性色 | slate/neutral/gray 三族混用 �?令牌层已收敛 | 🟡 | 令牌层完成：`tokens.json` 删除 `gray` 族（5 处引�?stock.neutral/signal.none/chart.grid·axis·tooltipBg 改指 `slate`�? 重算 tokens.css/ts；`CHART_PALETTE` 图表中性色（grid/axis/tooltipBg/gridLight/axisDark）由 gray 收敛�?slate；`verify:colorSoT`/`audit:tokens`/`lint:colors` 全绿。源码层 **87 处中性色用法**（`COLOR_TOKENS.textPrimary/Secondary/Muted` + `COLOR_SHADES.gray[400]` 等）仍混用，登记为后续工程，�?Ardot 视觉回归到位再批量迁�?|
| C7 | 宋韵 | �?已解决（2026-07-17）：cinnabar 明确为文化强�?装饰色，警示�?amber，`04-ui-ux-specs.md` 已订�?| �?| �?|
| C8 | 字体 | 三套字号体系（TYPOGRAPHY_SCALE vs THEME_TOKENS.typography vs theme.config）→ 收敛�?| 🟡 | 规范体系确立�?`TYPOGRAPHY_SCALE`+`text-*`；`theme.config.ts`（零引用死代码）�?`THEME_TOKENS.typography.fontSize`（~53 处）已标 `@deprecated`；死代码文件待清理窗口删除，53 处存量迁移为独立后续工程 |
| C9 | 字体 | 缺失 H5/H6；h4==body-lg 重叠；字间距覆盖不全 �?已补�?| �?| tailwind + `TYPOGRAPHY_SCALE` �?h5(15px/500)/h6(13px/600)；h4(16/600)==bodyLg(16/400) 明确�?*字重区分**（非真重叠）、h6(13/600)==bodySm(13/400) 同理；字间距沿用 tailwind 默认（标题紧、正文常规），display/h1/overline 保留显式 tracking |
| C10 | 间距 | 12px/20px �?8 倍数（gap-3、cardPadding、spacing-5�?�?低风险子集已落地 | 🟡 | 低风险完成：`LAYOUT_TOKENS.cardPadding` 20px�?4px�?px 栅格归一化）。高风险视觉档登记为后续工程�?*56 �?`gap-3`(12px)→`gap-4`(16px)** �?`spacing-5` 迁移——`audit-spacing.ts` 已含 12/20 为合法值不卡门禁，但改动影响全站视觉，�?Ardot 视觉回归手段恢复后统一推进 |
| C11 | Button/Badge/Checkbox | �?已解决（2026-07-17）：Button danger/success 语义令牌化、default 补全、焦点环�?`focus-visible:` 前缀；Badge 六变体语义令牌化；Checkbox 焦点�?`ring-2`；px-3 判定合规 | �?| 测试同步更新�?8 项通过 |
| C12 | 组件规范 | 8 类基础组件无状态化规范文档 �?已补�?| �?| 已抽离独立基线文�?`docs/explanation/design/component-specs.md`（唯一事实源，含五态规范与一致性核对）；本报告 §5 保留差异发现记录 |

---

## 7. 结论与优先级建议

**总体评价**：V9 设计系统具备**优秀的骨�?*——分层令牌（L1–L6）、HSL 主题变量、明暗双模、figma 双向映射、股票涨跌例外规则、原子组件结构，均为行业最佳实践。但**细节层存在「多源并行、文档漂移、规范缺位�?*三类问题，拉低了一致性与完整性得分（综合 �?6.0/10）�?
**建议优先处理（高 ROI�?*�?1. **【高】收敛令牌单一事实�?*（C1–C3）：�?`raw` / `tokens.json` / 文档全部�?`index.css` 变量推导，一次性消�?4�? 种主�?成功色分裂�?2. **【高】补全组件规范文�?*（C12）：以本报告 §5 为基线，沉淀�?`docs/explanation/design/component-specs.md`，并接入 `audit:docs` 同步门禁�?3. **【中】字�?间距单一�?*（C8–C10）：废弃 `THEME_TOKENS.typography` �?`theme.config.ts` 旧体系，8px 刻度收敛，补 H5/H6�?4. **【中】修�?Button 缺陷**（C11）：danger/success 改语义令牌、`default` 变体落地、内边距并入 8px 栅格�?5. **【低】宋韵落地与文档校验**（C4/C7）：统一文档与代码，明确 cinnabar 用途�?
完成上述后，规范�?一致性可提升�?8+，完整性可补齐 H5/H6 与组件规范，整体达到可对外发布的设计系统水准�?