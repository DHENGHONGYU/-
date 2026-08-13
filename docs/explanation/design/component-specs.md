---
title: 基础组件规范（V9 设计基座�?
type: reference
domain: frontend
phase: design
tier: standard
status: active
maintainer: V9 Architecture Team
summary: "唯一事实源（single source of truth）：本文件是 V9 设计系统基础组件的状态化规范基线�?> 评审日期�?026-07-17..."
tags: [frontend, component, design, standards]
version: v1.0.0
last_updated: 2026-07-17
code_version: "2.0.0-rc.1"
doc_id: V9-DOC-FRONT-050
referenced_by: [V9-DOC-META-000]
change_log:
  - version: v1.0.0
changes: Initial version established
date: 2026-07-17
---ence
domain: frontend
phase: design
tier: standard
status: active
version: v1.0.0
last_updated: 2026-07-17
code_version: 2.0.0
maintainer: V9 Architecture Team
tags: [frontend, component, design, standards]
---

# 基础组件规范（V9 设计基座�?
> 唯一事实源（single source of truth）：本文件是 V9 设计系统基础组件的状态化规范基线�?> 评审日期�?026-07-17 �?事实来源：`src/components/atoms/*`、`src/index.css`、`tailwind.config.js`、`src/constants/theme/theme.tokens.*.ts`
> 关联文档：差异核查见 `docs/explanation/design/design-system-audit-report.md`；触发治理见 `docs/meta/doc-trigger-action-map.md` T6�?
## 0. 规范约定

> **废弃通知（2026-08-13）**：`twBg`/`twText`/`twBorder` 辅助函数已于 2026-08-13 全面废弃，UI 层统一使用 CSS 变量语义令牌类。本文件所有组件规范均已使用 CSS 变量语义类（如 `bg-primary`、`text-foreground`、`border-input`、`bg-destructive`、`bg-success` 等），不再使用 `twText()`/`twBg()`/`twBorder()` 生成 Tailwind 类名。`COLOR_SHADES` 仍可用于 JS 逻辑取色。

- **令牌引用基线**：所有组件颜色必须走语义令牌（`bg-primary` / `text-foreground` / `border-input` / `bg-destructive` / `bg-success` 等），禁�?`bg-red-500` / `bg-green-700` �?Tailwind 调色板裸类（非主题感知，明暗不一致）�?- **五态覆�?*：每个组件规范含 默认 / 悬停 / 聚焦 / 禁用 / 加载 五态�?- **字体层级**：引�?`tailwind.config.js` 的排版阶梯（`text-h1`~`text-h4` / `text-body` / `text-body-sm` / `text-caption` / `text-overline`），禁止硬编码字号�?- **间距栅格**：基�?8px 基准（`4/8/16/24/32/48/64`），组件�?间距须落在基准倍数，禁�?12px/20px 等非基准值�?- **明暗适配**：所有颜色经 `index.css` �?HSL 变量自动适配�?暗模式，组件不得写死明暗分支�?- **一致性严重度**：�?合规 �?🟡 待微�?�?🔴 阻断（需整改）�?
---

## 1. Button 按钮

- **使用场景**：页面主操作、次级操作、危险操作、表单提交、中性默认操作�?- **属�?*：`variant: primary|secondary|outline|ghost|default|danger|success`；`size: sm|md|lg`；`asChild`；`isLoading`；原�?`button` 属性�?- **状态样式（已实现，2026-07-17 修订�?*�?  - 默认（各 variant）：
    - `primary` = `bg-primary text-primary-foreground hover:bg-primary/90`
    - `secondary` = `bg-secondary text-secondary-foreground hover:bg-secondary/80`
    - `outline` = `border border-input bg-background hover:bg-accent hover:text-accent-foreground`
    - `ghost` = `hover:bg-accent hover:text-accent-foreground`
    - `default` = `bg-surface-2 text-foreground hover:bg-surface-2/80`（中性实心，基于 `surface-2` 语义令牌�?    - `danger` = `bg-destructive text-destructive-foreground hover:bg-destructive/90`（语义令牌，明暗一致）
    - `success` = `bg-success text-success-foreground hover:bg-success/90`（语义令牌，明暗一致）
  - 聚焦：`focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500`（走 `THEME_TOKENS.focusVisible` 令牌，且已补 `focus-visible:` 前缀，仅聚焦时显示）�?  - 禁用：`disabled:opacity-50 disabled:pointer-events-none`�?  - 加载：`isLoading` 时建议显�?spinner（`motion.spin`）并禁用交互（当前仅声明属性，视觉未实现）�?  - 尺寸：`sm/md/lg` �?`THEME_TOKENS.controlSizes` + `spacing` + `typography` 令牌�?- **交互**：`asChild` 支持多态（如渲染为链接）；点击�?`transition-colors`�?- **与基础体系一致�?*�?  - 🟢 `default` 变体已补全（此前声明未实现，2026-07-17 修复）�?  - 🟢 `danger`/`success` 已改用语义令牌（此前�?`COLOR_TOKENS.*.bgClass` 裸类，非主题感知�?026-07-17 修复）�?  - 🟢 焦点环已修复：原 `ring-2/ring-blue-500` �?`focus-visible:` 前缀导致**恒显蓝环**，现对齐 `Input.tsx` 规范�?026-07-17 修复）�?  - 🟢 `md` 尺寸 `px-3`(12px)�?×4px，属控件内边距的合法 4px 倍数（与 `Input.tsx` 共用 `spacing.pxMd`）；8px 栅格约束针对布局间距，控件内边距允许 4px 步进，判定合规、不作全局改动以免密度回归�?
---

## 2. Input 输入�?
- **使用场景**：表单文本输入、搜索框�?- **属�?*：标�?`input` 属性；`size`；`disabled`；`error`（校验态）�?- **状态样式（应然�?*：默�?`bg-background border border-input`；聚�?`focus-visible:ring-2 ring-ring border-ring`；禁�?`disabled:opacity-50`；错误�?`border-destructive text-destructive`�?- **交互**：输入即时反馈；聚焦显示 ring；与 Label 关联（`htmlFor`）�?- **与基础体系一致�?*：�?标准 shadcn 模式，引用语义令�?`border-input`/`ring-ring`，符合基础体系；建议核对是否残�?`THEME_TOKENS.color` 裸类（应无）�?
---

## 3. Card 卡片

- **使用场景**：信息容器、Widget 外壳、列表项�?- **属�?*：`padding`（建议接 8px 刻度，建�?16/24）；`elevation: sm|md|lg`（接 `ELEVATION` 令牌）；`interactive`�?- **状态样�?*：默�?`bg-card border border-border rounded-md`；悬停（interactive）`hover:shadow-elevation-2`；聚焦（可聚焦卡片）`focus-visible:ring-2 ring-ring`�?- **交互**：作为容器不自带交互，interactive 态提供悬浮抬升�?- **与基础体系一致�?*：�?引用 `bg-card`/`border-border`/`ELEVATION`，一致；🟡 `cardPadding` 若沿�?20px 需并入 8px 刻度�?
---

## 4. Modal 弹窗（Dialog�?
- **使用场景**：确认操作、表单录入、详情浮层�?- **属�?*：`open`；`onClose`；`size`；`title`；`footer`�?- **状态样�?*：遮�?`bg-black/50`；面�?`bg-card shadow-elevation-3 rounded-lg`；标�?`text-h3 font-semibold`；关闭按�?`hover:bg-accent`�?- **交互**：ESC 关闭、点击遮罩关闭、焦点陷阱（focus trap）、打开时锁定背景滚动；进出场用 `motion` 令牌�?- **与基础体系一致�?*：�?应使用语义令牌；建议核对 `molecules/Dialog.tsx` 是否混用 `THEME_TOKENS` 裸类�?
---

## 5. Navbar 导航�?
- **使用场景**：顶部全局导航、舱室切换（五舱工作流）�?- **属�?*：`items`；`activeKey`；`height`（接 `LAYOUT_TOKENS.headerHeight`，建�?56px）；`transparent`�?- **状态样�?*：默�?`bg-background border-b border-border`；激活项 `text-primary border-b-2 border-primary`；悬�?`hover:bg-accent`；禁用项 `opacity-50`�?- **交互**：点击切换舱室、激活态高亮、响应式折叠�?- **与基础体系一致�?*：�?引用语义令牌；�?高度需�?`LAYOUT_TOKENS` 绑定而非硬编码�?
---

## 6. Table 表格

- **使用场景**：数据列表、行�?因子矩阵�?- **属�?*：`columns`；`data`；`striped`；`dense`；`onRowClick`�?- **状态样�?*：表�?`text-caption font-semibold text-tertiary`；单元格 `text-body-sm text-foreground`；行悬停 `hover:bg-muted`；选中�?`bg-primary/10`；涨跌单元格�?`STOCK_COLOR_TOKENS`（红涨绿跌）�?- **交互**：排序、行点击、分页（�?`Pagination` 原子）�?- **与基础体系一致�?*：�?应引用语义令牌与 `STOCK_COLOR_TOKENS`；建议核对是否直接写 `text-green-500` 等裸类（抽样显示组件层裸色极少，合规较好）�?
---

## 7. Tag 标签（Badge�?
- **使用场景**：状态标记、分类、信号等级。实现组件为 `src/components/atoms/Badge.tsx`�?- **属�?*：`variant: default|secondary|outline|destructive|success|warning`；原�?`span` 属性�?- **状态样式（已实现，2026-07-17 修订�?*：默�?`rounded-full px-2.5 py-0.5 text-xs font-semibold`；各变体�?  - `default` = `bg-primary text-primary-foreground hover:bg-primary/80`
  - `secondary` = `bg-secondary text-secondary-foreground hover:bg-secondary/80`
  - `outline` = `border-border text-foreground`（主题感知）
  - `destructive` = `bg-destructive text-destructive-foreground hover:bg-destructive/80`
  - `success` = `bg-success text-success-foreground hover:bg-success/80`
  - `warning` = `bg-warning text-warning-foreground hover:bg-warning/80`
- **交互**：纯展示为主，`transition-colors` 提供悬停过渡�?- **与基础体系一致�?*：�?六变体已全部改用主题感知语义令牌（此�?`destructive/success/warning` �?`COLOR_TOKENS.*.bgClass`＋`text-white`＋`HOVER.bg*` 裸类，明暗不一致；`outline` �?`text-slate-800` 硬编码，2026-07-17 迁移完成，测试同步更新）�?
---

## 8. Checkbox 复选框

- **使用场景**：多选、筛选条件、协议勾选�?- **属�?*：`label`；`checked`；`disabled`；`indeterminate`�?- **状态样式（已实现，2026-07-17 修订�?*：默�?`h-4 w-4 rounded border-border bg-background text-primary accent-primary`；聚�?`focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring`；悬�?`hover:border-primary`；禁�?`opacity-50`；选中 `bg-primary text-primary-foreground`�?- **交互**：点击切换、键�?Space 切换、label 联动�?- **与基础体系一致�?*：�?引用语义令牌（`border-border`/`text-primary`/`ring-ring`）；🟢 焦点环已�?`focus:ring-1` 统一�?`focus-visible:ring-2`，与全局焦点规范一致（2026-07-17 修复）�?
---

## 9. 组件间一致性问题汇总（当前状态）

| 组件 | 问题 | 严重�?| 状�?|
|---|---|---|---|
| Button | `variant="default"` 声明但未实现 | 🔴 | �?已修复（2026-07-17�?|
| Button | `danger`/`success` �?`COLOR_TOKENS` 裸类，非主题感知 | 🔴 | �?已修复（2026-07-17�?|
| Button | 焦点环缺 `focus-visible:` 前缀导致恒显蓝环 | 🔴 | �?已修复（2026-07-17�?|
| Checkbox | 焦点�?`focus:ring-1` vs 全局 `ring-2` 不一�?| 🟡 | �?已修复（2026-07-17�?|
| Badge | `destructive/success/warning` �?`COLOR_TOKENS`＋`text-white` 裸类；`outline` �?`text-slate-800`，明暗不一�?| 🔴 | �?已迁移（2026-07-17，测试同步） |
| Button | `md` 尺寸 `px-3`(12px) �?8px 栅格 | 🟡 | �?判定合规�?×4px 控件内边距，不改动） |
| 文档 | `04-ui-ux-specs.md` 称「朱砂红为警示色」，实现�?amber | 🟡 | �?已订正（cinnabar 归为文化强调色） |
| 通用 | 组件规范文档缺失 | 🔴 | �?已建立本文件（唯一事实源） |


---
## 10. Breadcrumb 面包屑（P2 补全 2026-07-18）

7 个子组件：Breadcrumb / BreadcrumbList / BreadcrumbItem / BreadcrumbLink / BreadcrumbPage / BreadcrumbSeparator / BreadcrumbEllipsis。纯 HTML 属性透传，BreadcrumbLink 支持 `asChild` 属性。

---
## 11. ComplianceDisclaimer 合规声明

| 属性 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| variant | `default` / `compact` / `tooltip` | `default` | default=完整卡片; compact=紧凑条; tooltip=内联文本 |
| extraMessage | `string` | — | 额外自定义说明 |

---
## 12. Label 标签

| 属性 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| optional | `boolean` | — | 显示"(可选)"后缀 |
| 其余 | `LabelHTMLAttributes` | — | 原生 label 透传 |

---
## 13. Progress 进度条

| 属性 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| value | `number` | **必填** | 当前值 |
| max | `number` | `5` | 默认适配 5 星评分场景 |
| label | `string` | — | 左侧标签 |
| showMax | `boolean` | `true` | 显示 value/max |

---
## 14. Radio / RadioGroup 单选

Radio 须嵌套于 RadioGroup 中使用（Context 通信）。
- **RadioGroup**：`value` / `defaultValue` / `onChange` / `name`
- **Radio**：`value`(必填) / `label` / `disabled`

---
## 15. Result 结果页

| 属性 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| status | `success`/`error`/`403`/`404`/`500`/`info` | **必填** | 预设图标/标题/副标题 |
| title | `ReactNode` | 按 status | 覆盖标题 |
| subTitle | `ReactNode` | 按 status | 覆盖副标题 |
| extra | `ReactNode` | — | 底部操作区 |

---
## 16. Select 下拉选择

| 属性 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| onValueChange | `(v: string) => void` | — | shadcn/ui 风格回调 |
| 其余 | `SelectHTMLAttributes` | — | 原生 select 透传 |

---
## 17. Separator 分割线

| 属性 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| orientation | `horizontal` / `vertical` | `horizontal` | 方向 |
| decorative | `boolean` | `true` | 纯装饰(role=none) |

---
## 18. Sheet 侧边面板

| 属性 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| open | `boolean` | — | 打开/关闭 |
| onOpenChange | `(open: boolean) => void` | — | ESC/遮罩关闭 |
| side | `left`/`right`/`top`/`bottom` | `right` | 滑出方向 |

7 个子组件：SheetContent / SheetHeader / SheetFooter / SheetTitle / SheetDescription / SheetClose。

---
## 19. Skeleton 骨架屏

无自定义 props。通过 `className` 控制尺寸（如 `h-4 w-[200px]`）。

---
## 20. Slider 滑块

| 属性 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| min | `number` | `0` | 最小值 |
| max | `number` | `100` | 最大值 |
| step | `number` | `1` | 步长 |
| value | `number` | — | 受控值 |
| defaultValue | `number` | — | 非受控默认值 |
| onValueChange | `(v: number) => void` | — | 变化回调 |
| showTooltip | `boolean` | `false` | 拖拽时显示 tooltip |

---
## 21. StockPriceChange 涨跌标识

| 属性 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| change | `number` | **必填** | 涨跌值(>0涨, <0跌) |
| changePercent | `number` | — | 涨跌百分比 |
| mode | `text`/`bg`/`both` | `text` | 颜色模式 |
| showIcon | `boolean` | `false` | 显示涨跌图标 |
| decimals | `number` | `2` | 小数位数 |
| showPlus | `boolean` | `true` | 正数显示 + |

走令牌系统 `getStockColorHex/getStockColorClass`，A 股红涨绿跌。子组件：StockPriceChangeArrow / StockPriceChangeBadge。

---
## 22. Switch 开关

原生 `<input type="checkbox">` 封装（隐藏 input + 装饰 span）。checked → `bg-primary`；disabled → `opacity-50 cursor-not-allowed`。

---
## 23. Textarea 多行输入

纯原生 `<textarea>` 封装，`min-h-[80px]`。无额外自定义 props。

---
## 24. Toast 消息提示

5 种 variant：`default` / `success` / `error` / `warning` / `info`。Toaster 组件通过 ToastContext 渲染浮动列表。配合 `useToast()` hook 使用。

---
## 25. Toggle 切换按钮

| 属性 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| pressed | `boolean` | — | 受控按下态 |
| defaultPressed | `boolean` | `false` | 非受控默认 |
| onPressedChange | `(p: boolean) => void` | — | 变化回调 |
| variant | `default`/`outline` | `default` | 样式 |
| size | `sm`/`md`/`lg` | `md` | 尺寸 |

---
## 26. Tooltip 工具提示

| 属性 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| content | `ReactNode` | **必填** | 提示内容 |
| side | `top`/`bottom`/`left`/`right` | `top` | 弹出方向 |
| children | `ReactNode` | — | 触发元素 |

纯 CSS hover 实现（`group-hover:opacity-100`），`z-50` 层级。


---
## 27. Popover 气泡浮层（P2 实现 2026-07-18）

| 属性 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| content | ReactNode | **必填** | 浮层内容 |
| side | 'top'/'bottom'/'left'/'right' | 'top' | 弹出方向 |
| children | ReactNode | — | 触发元素 |

纯 CSS hover 实现，group-hover:opacity-100，z-50 层级，pointer-events-none。

## 28. Menu 下拉菜单（P2 实现 2026-07-18）

| 属性 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| items | MenuItem[] | **必填** | 菜单项(key/label/disabled/danger/onClick) |
| open | boolean | **必填** | 受控打开 |
| onClose | () => void | **必填** | 关闭回调 |

Escape 键关闭，disabled 项不响应点击。

## 29. Pagination 分页（P2 实现 2026-07-18）

| 属性 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| page | number | **必填** | 当前页(1-based) |
| total | number | **必填** | 总页数 |
| onChange | (page:number)=>void | **必填** | 页码变化回调 |
| pageSize | number | — | 每页条数 |
| showSizeChanger | boolean | false | 显示每页条数选择器 |

省略号折叠中间页码，显示首/末/前/后导航按钮。

## 30. List 列表（P2 实现 2026-07-18）

| 属性 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| items | ListItem[] | **必填** | 列表项(key/content/icon/action/description) |
| dense | boolean | false | 紧凑模式 |
| striped | boolean | false | 斑马纹 |
| ordered | boolean | false | 有序列表(ol) |

## 31. Grid 栅格（P2 实现 2026-07-18）

| 属性 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| cols | number | 1 | 列数 |
| responsive | {sm?,md?,lg?,xl?} | — | 响应式列数覆盖 |
| gap | 'none'/'sm'/'md'/'lg' | 'md' | 间距 |

基于 CSS Grid 的 12 栅格系统。

## 32. DatePicker 日期选择（P2 实现 2026-07-18）

| 属性 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| value | string | — | 选中日期(ISO格式) |
| minDate | string | — | 最小可选日期 |
| maxDate | string | — | 最大可选日期 |
| onChange | (v:string)=>void | — | 日期变化回调 |

原生 input[type=date] 封装，完整 ring/focus-visible 焦点环。

<!-- auto-update -->
