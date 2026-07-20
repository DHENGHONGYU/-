# V9 无障碍（Accessibility）检查清单

**版本**: v0.9.11 P2-A11Y
**标准**: WCAG 2.1 Level AA
**目标**: Lighthouse Accessibility 评分 90+

---

## 一、交互组件无障碍

### 1.1 按钮（Button）

- [ ] 所有按钮有可访问标签（文字内容或 `aria-label`）
- [ ] 仅含图标的按钮必须添加 `aria-label`
- [ ] 禁用状态按钮添加 `aria-disabled="true"`
- [ ] 加载状态按钮添加 `aria-busy="true"`
- [ ] 关闭按钮添加 `aria-label="关闭"`
- [ ] 聚焦状态样式可见（`focus-visible`）

### 1.2 对话框（Dialog）

- [ ] 添加 `role="dialog"`
- [ ] 添加 `aria-modal="true"`
- [ ] 标题关联 `aria-labelledby`
- [ ] 描述关联 `aria-describedby`
- [ ] 集成 FocusTrap 组件
- [ ] ESC 键可关闭
- [ ] 打开时背景滚动锁定
- [ ] 关闭按钮有 `aria-label="关闭"`

### 1.3 表单输入

- [ ] 所有输入框关联 `<label>`
- [ ] 使用 `id` 和 `htmlFor` 关联
- [ ] 必填字段添加 `aria-required="true"`
- [ ] 错误提示关联 `aria-describedby`
- [ ] 错误状态添加 `aria-invalid="true"`
- [ ] 错误消息使用唯一 ID

### 1.4 开关（Switch/Toggle）

- [ ] 关联 `<label>`
- [ ] 添加 `role="switch"`
- [ ] 选中状态添加 `aria-checked="true"`

### 1.5 复选框（Checkbox）

- [ ] 关联 `<label>`
- [ ] 不确定状态添加 `aria-checked="mixed"`

### 1.6 选择器（Select）

- [ ] 关联 `<label>`
- [ ] 选项列表有 `role="listbox"` 或 `role="option"`
- [ ] 键盘可导航

### 1.7 滑块（Slider）

- [ ] 关联 `<label>`
- [ ] 添加 `role="slider"`
- [ ] 显示当前值 `aria-valuenow`
- [ ] 显示最小/最大值

### 1.8 选项卡（Tabs）

- [ ] 标签列表添加 `role="tablist"`
- [ ] 每个标签添加 `role="tab"`
- [ ] 内容面板添加 `role="tabpanel"`
- [ ] 关联 `aria-controls` 和 `aria-labelledby`
- [ ] 激活状态添加 `aria-selected="true"`
- [ ] 键盘箭头导航

### 1.9 工具提示（Tooltip）

- [ ] 触发元素添加 `aria-describedby`
- [ ] 使用 `id` 关联提示内容
- [ ] 支持键盘触发（焦点触发）

---

## 二、视觉无障碍

### 2.1 颜色对比度

- [ ] 正常文字：对比度 >= 4.5:1
- [ ] 大文字（18px+ 或 14px bold）：对比度 >= 3:1
- [ ] UI 组件和图形对象：对比度 >= 3:1
- [ ] 使用 [WebAIM Contrast Checker](https://webaim.org/resources/contrastchecker/) 验证

### 2.2 焦点状态

- [ ] 所有交互元素有可见焦点样式
- [ ] 使用 `focus-visible` 区分键盘和鼠标操作
- [ ] 焦点样式有足够对比度

### 2.3 图标无障碍

- [ ] 装饰性图标添加 `aria-hidden="true"`
- [ ] 有意义的图标添加 `aria-label`
- [ ] 或使用 `role="img"` + `aria-label`

### 2.4 动画与运动

- [ ] 提供 `prefers-reduced-motion` 媒体查询支持
- [ ] 闪烁内容不超过 3 次/秒

---

## 三、键盘无障碍

### 3.1 基础要求

- [ ] 所有功能可键盘操作
- [ ] Tab 键顺序合理（从上到下，从左到右）
- [ ] 使用原生 HTML 元素优先（`<button>`, `<a>`, `<input>`）
- [ ] 避免使用 `tabindex` > 0

### 3.2 模态框与弹窗

- [ ] 焦点锁定在弹窗内（FocusTrap）
- [ ] Shift+Tab 反向循环
- [ ] 关闭后焦点返回触发元素
- [ ] ESC 键关闭

### 3.3 下拉菜单

- [ ] 箭头键导航
- [ ] Enter/Space 选择
- [ ] ESC 关闭

### 3.4 快捷键

- [ ] 不使用单字母快捷键（与屏幕阅读器冲突）
- [ ] 如使用，添加 `aria-keyshortcuts` 或文档说明

---

## 四、屏幕阅读器支持

### 4.1 Landmarks

- [ ] 使用语义化 HTML（`<header>`, `<main>`, `<nav>`, `<footer>`）
- [ ] 或添加 `role` 属性

### 4.2 Live Regions

- [ ] 动态内容添加 `aria-live`
- [ ] 重要通知使用 `aria-live="assertive"`
- [ ] 一般更新使用 `aria-live="polite"`

### 4.3 图像

- [ ] 所有图像有 `alt` 属性
- [ ] 装饰性图像 `alt=""`
- [ ] 复杂图像使用 `longdesc` 或 `aria-describedby`

---

## 五、常见组件检查清单

### 5.1 已更新组件

| 组件 | 文件 | 无障碍特性 |
|------|------|-----------|
| Button | `src/components/ui/Button.tsx` | aria-disabled, aria-busy, focus-visible |
| Dialog | `src/components/ui/Dialog.tsx` | aria-modal, aria-labelledby, FocusTrap, ESC 关闭 |
| FocusTrap | `src/components/ui/FocusTrap.tsx` | Tab 循环, 焦点管理 |

### 5.2 待更新组件

| 组件 | 文件 | 待实现 |
|------|------|--------|
| Input | `src/components/ui/Input.tsx` | label 关联, error 关联 |
| Select | `src/components/ui/Select.tsx` | listbox role |
| Switch | `src/components/ui/Switch.tsx` | switch role |
| Tabs | `src/components/ui/Tabs.tsx` | tablist/tab/tabpanel |
| Tooltip | `src/components/ui/Tooltip.tsx` | aria-describedby |

---

## 六、验证方法

### 6.1 自动化工具

```bash
# Lighthouse 无障碍审计
npx lighthouse --only-categories=accessibility

# axe-core
npx playwright install-deps
npx playwright test --project=chromium
```

### 6.2 手动测试

1. 禁用 CSS，验证内容和顺序
2. 使用键盘完全操作
3. 使用屏幕阅读器测试（NVDA/VoiceOver）
4. 放大至 200% 检查溢出

### 6.3 TypeScript 验证

```bash
# 类型检查
npx tsc --noEmit

# 应返回 0 errors
```

---

## 七、无障碍工具函数

位于 `src/utils/a11y.ts`：

| 函数 | 用途 |
|------|------|
| `generateId()` | 生成唯一 ID |
| `KEYS` | 键盘常量 |
| `handleKeyboardActivation()` | 回车/空格触发 |
| `handleEscapeKey()` | ESC 键处理 |
| `FOCUSABLE_SELECTORS` | 可聚焦元素选择器 |
| `announceToScreenReader()` | 屏幕阅读器公告 |
| `getFieldAriaProps()` | 表单字段 aria |
| `focusElement()` | 焦点管理 |

---

## 八、参考标准

- [WCAG 2.1](https://www.w3.org/TR/WCAG21/)
- [WAI-ARIA](https://www.w3.org/WAI/ARIA/)
- [WebAIM](https://webaim.org/)
- [axe DevTools](https://www.deque.com/axe/)

---

**最后更新**: 2026-06-29
**维护人**: P2-A11Y Team
