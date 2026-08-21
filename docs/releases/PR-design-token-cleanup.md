---
title: docs/releases/PR-design-token-cleanup.md
code_version: 2.0.0-rc.2
version: v1.0.1
last_updated: 2026-08-22
change_log:
  - version: v1.0.1
    changes: "基准日校对(2026-08-22)：R1取真值(P4-else 新建 v1.0.0（无任何版本信息）=v1.0.0) → R2 PATCH++(v1.0.1) / last_updated 刷新 / change_log 闭环"
    date: 2026-08-22
---

# PR: 设计令牌清理与验证 Utility 重构

## 变更类型

- [x] refactor（重构）
- [x] test（测试）
- [x] docs（文档）
- [x] chore（构建/配置）

## 概述

清除旧版双套令牌系统（slate 体系），确立 `src/index.css` 为 V5 Apple Business Design Tokens 唯一真相源。封装令牌验证 Utility 模块，集成主题切换自动重验证，补全 17 个单元测试 + Playwright E2E 验证。

## 变更摘要

| 分类 | 变更项 | 严重程度 |
|------|--------|---------|
| 🗑️ 旧令牌清除 | 删除 tokens.css / tokens.ts / generate-tokens.ts / tokens.json | P0 |
| 📦 Utility 封装 | 新增 `src/lib/designTokenVerifier.ts`（3 个导出函数） | P1 |
| 🧪 测试覆盖 | 17 个单元测试 + Playwright E2E（light/dark 切换） | P1 |
| 📝 文档更新 | Design→Code 工作流 v1.0→v1.2 + CHANGELOG + 团队手册 | P2 |
| 🔗 主题集成 | `themeStore.applyTheme()` 主题切换后自动重验证 | P2 |

## 文件变更

### 新增（3）
- `src/lib/designTokenVerifier.ts` — 令牌验证 Utility（`collectDesignTokens` / `verifyDesignTokens` / `verifyDesignTokensOnReady`）
- `src/lib/designTokenVerifier.test.ts` — 17 个单元测试
- `docs/release-notes/RELEASE-NOTES-design-token-cleanup.md` — 完整发布说明

### 修改（5）
- `src/main.tsx` — 120 行内联验证 → 2 行 import + 调用
- `src/store/themeStore.ts` — `applyTheme()` 集成 `requestAnimationFrame(() => verifyDesignTokens())`
- `docs/guides/design-to-code-workflow.md` — v1.2.0（新增 §3.3 Utility 文档 + §10 验证记录）
- `docs/guides/team-handbook/01-design-philosophy.md` — 更新令牌链路 + 豁免列表
- `CHANGELOG.md` — 新增 2026-08-15 条目
- `package.json` — 移除 `prebuild` 中的 `generate:tokens`

### 删除（4）
- src/generated/tokens.css — 旧版 slate 色彩令牌（178 行）
- src/generated/tokens.ts — 旧版 TypeScript 常量
- scripts/generate-tokens.ts — 令牌自动生成器
- `design-tokens/tokens.json` — 旧版令牌源数据

## 验证结果

| 检查项 | 结果 |
|--------|------|
| `npm run build` | ✅ exit 0（3223 modules transformed） |
| 单元测试 | ✅ 17/17 通过（1.08s） |
| TypeScript 类型检查 | ✅ 0 新错误 |
| Playwright E2E（light→dark→light） | ✅ 令牌期望值全部匹配，0 页面错误 |
| 生产 bundle tree-shake | ✅ `TokenVerify` 零残留 |
| 旧版 token 全面搜索 | ✅ 0 残留 |

## 关键设计决策

1. **DEV 守卫**：所有验证函数内部 `import.meta.env.DEV` 检查，生产构建 Vite 完全 tree-shake，零运行时开销
2. **`requestAnimationFrame` 延迟**：主题切换后等待浏览器重算样式才验证，避免读到旧 CSS 变量值
3. **`design-tokens/` 目录保留**：仅含 Figma 同步映射文件（非运行时令牌），不在清除范围

## 关联文档

- [发布说明](../release-notes/RELEASE-NOTES-design-token-cleanup.md)
- [Design→Code 工作流规范 v1.2.0](../guides/design-to-code-workflow.md)
- [团队手册 · 设计哲学](../guides/team-handbook/01-design-philosophy.md)
- [CHANGELOG.md](../../CHANGELOG.md)
