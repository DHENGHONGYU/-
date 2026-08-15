---
title: 2026-06-23-portalshell-dark-kimi-layout
code_version: "2.0.0-rc.1"
tier: reference
version: v0.9.0-docs-review
last_updated: 2026-06-24
change_log:
  - version: v0.9.0-docs-review
    changes: "C 类版本闭环(2026-08-11)：补全 change_log 初始条目"
    date: 2026-06-24
---

# ADR-005: PortalShell 深色 Kimi 经典布局

> **Status**: Accepted  
> **Version**: v0.9.0-docs-review  
> **Last Updated**: 2026-06-24

- 状态：已接受
- 日期：2026-06-23
- 决策人：@ui-lead

## 背景

早期 UI 规范为浅色 PWA 风格，与 Kimi 产品品牌一致性不足，且五舱导航不够清晰。

## 选项

| 选项 | 优点 | 缺点 |
|------|------|------|
| A. 深色 Kimi 经典布局（顶部状态栏 + 分组侧边栏） | 品牌一致、专业感强、导航清晰 | 需要调整主题令牌与首页/驾驶舱例外 |
| B. 保持浅色 PWA 风格 | 与早期文档一致 | 品牌辨识度低、功能多时导航拥挤 |

## 决策

选择 A。PortalShell 使用深色主题容器，首页与驾驶舱保持浅色。

## 后果

- 根容器始终添加 `dark` 类。
- 顶部栏 56px，左侧分组侧边栏 260px。
- 主题令牌继续沿用 HSL CSS 变量。

## 相关文档

- `../specs/04-ui-ux-specs.md`
