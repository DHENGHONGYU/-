---
title: V9 UI 组件库使用指�?
type: explanation
domain: frontend
phase: design
tier: standard
status: active
maintainer: V9 Architecture Team
summary: "版本：v1.0.0（P6-UI 组件库完�?+ 无障碍增强） 适用范围：智能投研复盘系�?V9 前端所有页面与 Widget"
tags: [frontend, component, design, guide, plan]
version: v1.0.0
last_updated: 2026-07-17
code_version: 2.0.0
change_log:
  - version: v1.0.0
changes: Initial version established
date: 2026-07-17
---tion
domain: frontend
phase: design
tier: standard
status: active
maintainer: V9 Architecture Team
tags: [frontend, component, design, guide, plan]
version: v1.0.0
last_updated: 2026-07-17
code_version: 2.0.0
---

# V9 UI 组件库使用指�?
> 版本：v1.0.0（P6-UI 组件库完�?+ 无障碍增强）
> 适用范围：智能投研复盘系�?V9 前端所有页面与 Widget

---

## 无障碍规�?
所有组件必须遵循以下无障碍（a11y）标准：

### 表单类组�?- **所有表单输入必须有关联�?label**：通过 `htmlFor` + `id` 关联，或使用 `aria-label` / `aria-labelledby`
- **错误状态必须设�?`aria-invalid="true"`**：同时通过 `aria-describedby` 关联错误提示文本
- **必填字段必须设置 `aria-required="true"`**：并�?label 后添�?`*` 视觉标识
- **帮助文本通过 `aria-describedby` 关联**：确保屏幕阅读器能朗读辅助说�?
### 交互类组�?- **按钮必须有可访问名称**：`aria-label` 或文本内容，图标按钮必须�?`aria-label`
- **开关组件使�?`role="switch"` + `aria-checked`**：而非默认�?checkbox role
- **模态框必须�?FocusTrap**：打开时焦点锁定在模态框内，关闭后焦点返回触发元�?- **下拉选择使用 `aria-expanded` + `aria-haspopup`**：明确告知展开状�?
### 键盘导航
- **所有可交互元素必须可通过 Tab 键聚�?*：`tabIndex={0}` 或原生可聚焦元素
- **Tabs 使用左右箭头键切�?*：Home/End 跳转到首�?- **Switch 支持 Enter/Space 切换**
- **Select 支持上下箭头选择、回车确认、Esc 关闭**
- **Tooltip 支持键盘焦点触发**：不仅是 hover

### 焦点可见
- **统一使用 `focus-visible` 样式**：仅在键盘导航时显示焦点�?- **焦点环规�?*：`2px solid #3b82f6`，偏�?`2px`，圆�?`4px`
- **禁用状态移除焦点环**：`disabled` �?`aria-disabled="true"` 的元素不显示焦点

---

## 组件清单

### 基础组件

#### Button - 按钮
- **变体**：default / primary / secondary / destructive / outline / ghost / link�? 种）
- **尺寸**：sm / md / lg
- **无障�?*：原�?`<button>` 元素，自动支持键�?Enter/Space
- **使用场景**：所有操作触发点

```tsx
<Button variant="primary" size="md" onClick={handleClick}>
  确认
</Button>
```

#### Input - 输入�?- **Props**：`label` / `error` / `helperText` / `required` / `variant`
- **变体**：default / error / success
- **无障碍属�?*�?  - `id` - 用于 label 关联
  - `aria-invalid` - 错误状�?  - `aria-required` - 必填状�?  - `aria-describedby` - 关联错误提示/帮助文本
- **自动生成 id**：未传入时通过 `useId()` 自动生成

```tsx
<Input
  label="股票代码"
  placeholder="请输�?6 位股票代�?
  error="代码格式不正�?
  required
  variant="error"
/>
```

#### Select - 下拉选择
- **Props**：`label` / `error` / `helperText` / `variant`
- **子组�?*：`SelectItem`（`<option role="option">`�?- **无障碍属�?*�?  - `aria-labelledby` - 关联 label
  - `aria-describedby` - 关联错误/帮助文本
  - `aria-invalid` - 错误状�?  - `aria-expanded` - 展开状�?  - `aria-haspopup="listbox"` - 弹出类型
- **键盘支持**：原�?`<select>` 支持上下箭头、回车、Esc

```tsx
<Select label="市场类型">
  <SelectItem value="sh">沪市</SelectItem>
  <SelectItem value="sz">深市</SelectItem>
</Select>
```

#### Switch - 开�?- **Props**：`label` / `checked` / `defaultChecked` / `disabled`
- **无障碍属�?*�?  - `role="switch"` - 开关角色（优于 checkbox�?  - `aria-checked` - 选中状�?  - `aria-label` - �?label 时的可访问名�?  - `tabIndex={0}` - 可聚�?- **键盘支持**：Enter / Space 切换状�?- **焦点样式**：`peer-focus-visible:ring-2`

```tsx
<Switch label="自动复盘" checked={enabled} onCheckedChange={setEnabled} />
```

#### Checkbox - 复选框
- **变体**：default / indeterminate
- **无障�?*：原�?`<input type="checkbox">`，支�?`aria-checked="mixed"`

#### Tabs - 标签�?- **子组�?*：`TabsList` / `TabsTrigger` / `TabsContent`
- **无障碍属�?*�?  - `role="tablist"` - 标签列表（TabsList�?  - `role="tab"` - 标签项（TabsTrigger�?  - `role="tabpanel"` - 内容面板（TabsContent�?  - `aria-selected` - 选中状�?  - `aria-controls` - 关联内容面板 id
  - `aria-labelledby` - 关联触发按钮 id（TabsContent�?  - `aria-orientation="horizontal"` - 方向
- **键盘导航**�?  - `ArrowLeft` / `ArrowRight` - 前后切换
  - `Home` / `End` - 跳转到首/�?  - 自动跳过 disabled �?  - `tabIndex` 遵循 roving tabindex 模式（仅活动项为 0�?
```tsx
<Tabs defaultValue="overview">
  <TabsList>
    <TabsTrigger value="overview">概览</TabsTrigger>
    <TabsTrigger value="detail">详情</TabsTrigger>
  </TabsList>
  <TabsContent value="overview">...</TabsContent>
  <TabsContent value="detail">...</TabsContent>
</Tabs>
```

#### Tooltip - 提示
- **Props**：`content` / `side`（top/bottom/left/right�?- **无障碍属�?*�?  - `role="tooltip"` - 提示角色
  - `aria-describedby` - 触发器关联提示框 id
  - `id` - 提示框唯一标识
- **触发方式**：hover + focus（键盘可访问�?- **注意**：children 必须为单�?ReactElement（触发器�?
```tsx
<Tooltip content="导出当前数据" side="top">
  <Button variant="ghost" size="icon">
    <DownloadIcon />
  </Button>
</Tooltip>
```

### 反馈组件

#### LoadingState - 加载�?- **Props**：`text` / `size`
- **使用场景**：数据加载中占位

#### ErrorState - 错误�?- **Props**：`title` / `description` / `onRetry`
- **无障�?*：`role="alert"` 自动朗读错误信息

#### EmptyState - 空状�?- **Props**：`title` / `description` / `icon` / `action`
- **使用场景**：无数据时的友好提示

#### DataState - 三态组�?- **Props**：`status`（loading/error/success�? `loading` / `error` / `children`
- **统一封装**：自动根据状态切�?Loading/Error/内容展示

#### Dialog - 对话�?- **Props**：`open` / `onOpenChange` / `title` / `description`
- **无障�?*：内�?FocusTrap，`role="dialog"`，`aria-modal="true"`
- **焦点管理**：打开时焦点移至对话框，关闭后返回触发元素

#### Toast - 消息提示
- **Props**：`title` / `description` / `variant` / `duration`
- **无障�?*：`role="status"` �?`role="alert"`，自动朗�?
### 布局组件

#### Card - 卡片
- **子组�?*：`CardHeader` / `CardTitle` / `CardDescription` / `CardContent` / `CardFooter`
- **使用场景**：信息分组展示容�?
#### Separator - 分隔�?- **Props**：`orientation`（horizontal/vertical�?- **无障�?*：`role="separator"`

#### Skeleton - 骨架�?- **Props**：`variant`（text/rect/circle�?- **使用场景**：数据加载前的占位动�?
#### Breadcrumb - 面包屑导�?- **用�?*：展示当前页面在层级结构中的位置，支持层级跳转与当前页标�?- **子组�?*：`Breadcrumb` / `BreadcrumbList` / `BreadcrumbItem` / `BreadcrumbLink` / `BreadcrumbPage` / `BreadcrumbSeparator` / `BreadcrumbEllipsis`
- **无障碍属�?*�?  - `Breadcrumb`（`<nav>`）内�?`aria-label="breadcrumb"`
  - `BreadcrumbPage` 设置 `aria-current="page"` + `aria-disabled="true"`，标记当前页
  - `BreadcrumbSeparator` / `BreadcrumbEllipsis` 设置 `aria-hidden="true"`，对屏幕阅读器隐藏装饰元�?- **使用场景**：多层级页面导航（如：首�?/ 数据采集 / 七维配置�?
**Props**

`Breadcrumb`（容�?`<nav>`）：

| 字段 | 类型 | 默认�?| 说明 |
|------|------|--------|------|
| ...props | `HTMLAttributes<HTMLElement>` | �?| 透传�?`<nav>`，已内置 `aria-label="breadcrumb"` |

`BreadcrumbList`（列�?`<ol>`�? `BreadcrumbItem`（列表项 `<li>`）：

| 字段 | 类型 | 默认�?| 说明 |
|------|------|--------|------|
| ...props | `HTMLAttributes<HTMLOListElement>` \| `HTMLAttributes<HTMLLIElement>` | �?| 透传至底�?`<ol>` / `<li>` 的原生属�?|

`BreadcrumbLink`（可点击链接）：

| 字段 | 类型 | 默认�?| 说明 |
|------|------|--------|------|
| asChild | boolean | `false` | �?`true` 时将 props 合并到子元素（如配合 React Router `<Link>`），不再渲染 `<a>` |
| href | string | �?| 透传�?`AnchorHTMLAttributes`，链接地址 |
| ...props | `AnchorHTMLAttributes<HTMLAnchorElement>` | �?| 透传至底�?`<a>` 的原生属�?|

`BreadcrumbPage`（当前页 `<span>`）：

| 字段 | 类型 | 默认�?| 说明 |
|------|------|--------|------|
| ...props | `HTMLAttributes<HTMLSpanElement>` | �?| 透传�?`<span>`，已内置 `aria-current="page"` �?`aria-disabled="true"` |

`BreadcrumbSeparator` / `BreadcrumbEllipsis`：无额外 props，均为装饰性元素，分别使用 `ChevronRight` / `MoreHorizontal` 图标，并设置 `aria-hidden="true"`�?
```tsx
<Breadcrumb>
  <BreadcrumbList>
    <BreadcrumbItem>
      <BreadcrumbLink href="/">首页</BreadcrumbLink>
    </BreadcrumbItem>
    <BreadcrumbSeparator />
    <BreadcrumbItem>
      <BreadcrumbLink href="/input">数据采集</BreadcrumbLink>
    </BreadcrumbItem>
    <BreadcrumbSeparator />
    <BreadcrumbItem>
      <BreadcrumbPage>七维配置</BreadcrumbPage>
    </BreadcrumbItem>
  </BreadcrumbList>
</Breadcrumb>
```

---

## 设计令牌（Design Tokens�?
### 颜色令牌
所有颜色通过 `COLOR_TOKENS` 常量管理，支�?hex / tailwind / rgb 三种格式�?
```typescript
import { COLOR_TOKENS, getColorHex } from '@/constants/theme.tokens'

COLOR_TOKENS.primary.hex     // '#0AA3C4' (专业�?
COLOR_TOKENS.success.tailwind // 'text-green-500'
COLOR_TOKENS.positive.hex     // '#1DB56A' (盈利�?
COLOR_TOKENS.negative.hex     // '#D94444' (亏损�?
getColorHex('danger')        // '#ef4444'
```

> **v2.2.0 更新**：主色调从翡翠绿 `#10b981` 更新为专业蓝 `#0AA3C4`

### 焦点可见令牌
```typescript
COLOR_TOKENS.focusRing          // 焦点环颜色（#3b82f6�?COLOR_TOKENS.focusRingOffset    // 焦点环偏移（2px�?COLOR_TOKENS.focusRingWidth     // 焦点环宽度（2px�?```

### 间距令牌
基于 4px 栅格系统，语义化间距优先使用�?
```typescript
SPACING_TOKENS.cardPadding     // '16px'
SPACING_TOKENS.sectionGap      // '24px'
SPACING_TOKENS.componentGap    // '12px'
SPACING_TOKENS.widgetGap       // '16px'
```

---

## 使用最佳实�?
### 1. 表单组合
```tsx
<div className="space-y-4">
  <Input label="股票名称" required placeholder="请输入股票名�? />
  <Select label="所属行�?>
    <SelectItem value="tech">科技</SelectItem>
    <SelectItem value="finance">金融</SelectItem>
  </Select>
  <Switch label="加入自�? />
  <Button type="submit">保存</Button>
</div>
```

### 2. Tooltip + 图标按钮
```tsx
<Tooltip content="刷新数据" side="bottom">
  <Button variant="ghost" size="icon" aria-label="刷新数据">
    <RefreshCw className="h-4 w-4" />
  </Button>
</Tooltip>
```

### 3. Tabs 面板
```tsx
<Tabs defaultValue="kline">
  <TabsList>
    <TabsTrigger value="kline">K 线图</TabsTrigger>
    <TabsTrigger value="timeline">分时</TabsTrigger>
  </TabsList>
  <TabsContent value="kline">
    <KlineChart data={data} />
  </TabsContent>
  <TabsContent value="timeline">
    <TimelineChart data={data} />
  </TabsContent>
</Tabs>
```

---

## 业务页面组件说明

### SevenDimConfigPage - 七维采集配置�?
- **路由**：`/input/seven-dim`
- **源文�?*：`src/pages/input/SevenDimConfigPage.tsx`
- **功能**�? 维度采集配置�? 策略模板（价�?成长/防御/周期/全维度）、额度预估仪表盘、全局参数（标的数/历史天数�?- **依赖 Store**：`useSevenDimConfigStore`（`src/store/sevenDimConfigStore.ts`�?- **依赖配置**：`src/config/collectConfig.ts`（提�?`STRATEGY_TEMPLATES`、`DEFAULT_DIMENSIONS`、`FREQUENCY_LABELS`、`DATA_SOURCE_LABELS`、`STORAGE_TYPE_LABELS`、`IMPORTANCE_LABELS`、`IMPORTANCE_BADGE_VARIANT`、`DIMENSION_COLORS`、`GLOBAL_LIMITS` 等常量与类型�?- **子组�?*�?  - `StrategyCard`：策略模板卡片，展示模板名称、描述、维度数量、选中态、禁用�?  - `DimensionRow`：维度行，展示维度名称、重要�?Badge、频�?数据�?存储类型选择、启用开�?- **使用�?UI 组件**：Card / Button / Badge / Switch / Input / Label / Progress / Separator / Breadcrumb
- **测试覆盖**�?1 个组件测试用例（`tests/__tests__/SevenDimConfigPage.test.tsx`），覆盖策略模板切换、维度开关、全局参数校验、额度预估、保存配置、执行采集、面包屑导航等场�?- **无障�?*：表�?Input 通过 `Label` 关联、Switch 使用 `role="switch"` + `aria-checked`、Button 传入可访问名�?
```tsx
// 页面结构示意
<SevenDimConfigPage>
  <Breadcrumb>...</Breadcrumb>
  <section> {/* 策略模板�?*/}
    <StrategyCard /> × 5
  </section>
  <section> {/* 维度配置�?*/}
    <DimensionRow /> × 8
  </section>
  <section> {/* 全局参数 + 额度预估 */}
    <Input /><Progress />
  </section>
  <section> {/* 操作�?*/}
    <Button>保存配置</Button>
    <Button>执行采集</Button>
  </section>
</SevenDimConfigPage>
```

---

## 相关文件

| 文件路径 | 说明 |
|---------|------|
| `src/components/ui/` | UI 组件源码目录 |
| `src/constants/theme.tokens.ts` | 设计令牌（颜�?间距/圆角等） |
| `src/index.css` | 全局样式�?CSS 变量 |
| `tailwind.config.js` | Tailwind 配置 |
| `../a11y-checklist.md` | 无障碍检查清�?|
