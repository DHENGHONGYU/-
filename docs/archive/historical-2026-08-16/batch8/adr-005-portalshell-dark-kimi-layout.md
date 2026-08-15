---
doc_id: V9-DOC-EXP-910
title: adr-005-portalshell-dark-kimi-layout
code_version: "2.0.0-rc.1"
tier: reference
version: v1.0.0
last_updated: 2026-08-11
change_log:
  - version: v1.0.0
    changes: "C 类版本闭环(2026-08-11)：补全 change_log 初始条目"
    date: 2026-08-11
---



# ADR-005: PortalShell 深色 Kimi 经典布局

> **状态**: Accepted  
> **决策日期**: 2026-06-23  
> **版本**: v1.0.0

---

## 1. 背景（Context）

V9 需要统一五舱（input/analysis/trading/output/command）的导航和布局体验。V6 阶段各舱独立导航，导致：

- 用户在不同舱之间切换时体验不一致。
- 深色/亮色主题切换需要每个舱单独实现。
- 移动端适配成本高昂（5 个舱 × 独立布局）。

同时，V9 定位为「智能投研系统」，用户长时间盯盘，需要低对比度、护眼的深色主题作为默认。

### 触发条件

- UI 设计评审：确认 V9 默认主题为深色，亮色为可选。
- 架构评审：确认五舱共用统一导航容器，减少重复代码。

---

## 2. 决策（Decision）

**采用 `PortalShell` 作为五舱统一导航容器，默认深色 Kimi 经典布局。**

- `PortalShell` 位于 `src/portal/PortalShell.tsx`，包裹所有舱页面。
- 提供统一顶部导航栏、侧边栏、主题切换、全局通知。
- 五舱通过 `src/apps/{cabin}/{Cabin}App.tsx` 分发器懒加载子页面。
- 默认深色主题：暗色统一 `neutral` 高级灰（hue 0，零彩度）；亮色用 `neutral` 高级灰系（背景 `#F2F2F7`，V5 Apple Business Design）。
- 品牌色体系：Apple Blue #007AFF（`--primary: 210 100% 50%`）为单一克制强调色；宋瓷语义色（汝窑天青、官窑粉青等）保留为装饰性点缀。所有颜色走令牌体系（L1-L6），零硬编码。

### 决策理由

- **Why not 各舱独立布局**：重复代码多，主题切换难统一，维护成本高。
- **Why not 第三方 UI 框架**：Ant Design / Material UI 体积大、定制成本高；Tailwind + Shadcn 更轻量。
- **Why 深色默认**：投研场景长时间盯屏，深色模式更护眼；与 Kimi 品牌一致。

---

## 3. 备选方案（Alternatives Considered）

| 方案 | 优点 | 缺点 | 结论 |
|------|------|------|------|
| **A. PortalShell + 深色默认**（最终选择） | 统一体验、减少重复、主题一键切换 | 需要精心设计 Shell 的响应式布局 | ✅ 采纳 |
| **B. 各舱独立布局** | 灵活性高 | 重复代码、主题难统一、维护成本高 | ❌ 否决 |
| **C. Ant Design Pro** | 组件丰富、生态成熟 | 包体积大、样式难以定制为宋韵美学 | ❌ 否决 |
| **D. 亮色默认** | 符合传统网页习惯 | 投研场景长时间使用易视觉疲劳 | ❌ 否决 |

---

## 4. 后果（Consequences）

### 正面影响

- 五舱切换体验一致，新成员上手更快。
- 主题切换（深色/亮色）一处实现，全局生效。
- 移动端适配只需针对 PortalShell，子页面自动响应。

### 负面影响 / 技术债

- PortalShell 本身需要精心设计（响应式、性能、动画）。
  - **技术债**：`./design/tech-debt.md` — 「PortalShell 首屏加载优化」。
- 子页面需遵循 PortalShell 的布局约束（如内容区域最大宽度、内边距）。
  - **缓解**：`../../AGENTS.md` §3.5 定义了令牌体系的 spacing/radius 规范。

---

## 5. 实施与验证

### 实施步骤

- [x] Step 1：实现 `PortalShell.tsx`（导航 + 布局容器）
- [x] Step 2：实现主题切换（`themeStore`，深色/亮色/系统跟随）
- [x] Step 3：定义令牌体系（`theme.tokens.ts`，L1-L6）
- [x] Step 4：实现 `App` 分发器（`src/apps/{cabin}/`，懒加载）
- [ ] Step 5：PortalShell 首屏加载优化（代码分割、预加载）
- [ ] Step 6：移动端汉堡菜单 + 底部导航

### 验证命令

```bash
npm run lint:colors      # 验证颜色零硬编码
npm run audit:tokens     # 验证令牌同步
npm run build            # 验证产物大小
```

---

## 6. 关联文档

| 文档 | 路径 |
|------|------|
| 令牌体系 | `../../AGENTS.md` §3.5 |
| 设计令牌映射 | `../reference/design-token-mapping.md` |
| 令牌使用手册 | `./token-usage-cookbook.md` |
| 宋韵美学 | `./song-aesthetics.md` |
| 原始提案 | `./2026-06-23-portalshell-dark-kimi-layout.md` |

---

## 7. 状态变更记录

| 日期 | 状态 | 变更人 | 备注 |
|------|------|--------|------|
| 2026-06-23 | proposed | @architect | 初始提案 |
| 2026-06-23 | accepted | 架构组 | 评审通过 |
| 2026-07-12 | accepted | docs 治理组 | 扩写为完整 ADR v1.0.0 |
