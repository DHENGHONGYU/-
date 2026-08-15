---
doc_id: V9-DOC-PROJ-377
title: "最终 Commit Message（请确认）"
domain: proj
status: active
last_updated: 2026-08-15
---

# 最终 Commit Message（请确认）

## 建议的提交命令

```bash
git commit -m "refactor(design-tokens): 清除旧版双套令牌系统，确立 V5 单一真相源

## 清理范围

### 删除（旧版令牌管道）
- scripts/generate/generate-tokens.ts — 旧版令牌生成器（前次清理遗漏的子目录副本）
- src/generated/ 目录 — 已在前序提交清除，本次新增 .gitignore 防护规则防止重新生成

### 新增
- src/lib/designTokenVerifier.ts — 令牌验证 Utility（3 个导出函数，已在 75b2d61 提交）
  - collectDesignTokens(): 纯函数采集令牌数据
  - verifyDesignTokens(): 采集 + 结构化日志输出
  - verifyDesignTokensOnReady(): DOM 就绪 + DEV 守卫便捷封装
- src/lib/designTokenVerifier.test.ts — 17 个单元测试（已在 75b2d61 提交）
- docs/guides/design-to-code-workflow.md — Design→Code 工作流规范 v1.2.0
- docs/release-notes/RELEASE-NOTES-design-token-cleanup.md — 完整发布说明
- docs/releases/PR-design-token-cleanup.md — PR 描述模板

### 修改
- src/store/themeStore.ts — applyTheme() 集成 requestAnimationFrame(() => verifyDesignTokens())
- .gitignore — 新增 src/generated/ 防护规则
- CHANGELOG.md — 新增 2026-08-15 变更条目
- README.md — 更新版本日期、技术亮点、文档中心链接
- scripts/README.md — 移除已删除的 generate-tokens.ts 条目
- docs/guides/team-handbook/01-design-philosophy.md — 更新令牌链路 + 豁免列表

## 提交前验证（10 项全通过）

| 检查项 | 结果 |
|--------|------|
| src/ 中 --color-* 令牌定义 | 0 处 |
| generated/tokens 导入引用 | 0 处 |
| generate-tokens.ts 文件残留 | 0 处 |
| 旧版 slate 色值 #157958 | 0 处 |
| package.json generate:tokens 脚本 | 0 处 |
| src/generated/ 目录 | 不存在 |
| design-tokens/tokens.json | 不存在 |
| 旧版 --spacing-/--fontSize-/--borderRadius- 令牌 | 6 处（全部为防御性验证代码） |
| 暂存区文件数 | 14 |
| 工作区遗漏文件 | 0 |

## 影响范围

### 运行时影响
- 生产构建：零开销（import.meta.env.DEV 守卫，Vite tree-shake 移除验证代码）
- 开发环境：启动时自动验证令牌加载，主题切换后自动重验证
- 主题切换：5 条切换路径全部集成 rAF 延迟验证

### 构建影响
- npm run build: exit 0（3223 modules transformed）
- 单元测试: 17/17 通过
- TypeScript: 0 新错误

### 文档影响
- 团队手册设计哲学章节已更新令牌链路
- README 已更新技术亮点和文档链接
- CHANGELOG 已记录本次变更

## 根因分析

旧版令牌系统（slate 色彩体系）通过 generate-tokens.ts 从 tokens.json 自动生成 tokens.css + tokens.ts，
与 V5 Apple Business Design Tokens（src/index.css）形成双套令牌冲突。本次清理彻底移除旧版管道，
确立 src/index.css 为唯一真相源，并通过运行时验证 Utility 防止回归。

Refs: commit 75b2d61, docs/guides/design-to-code-workflow.md v1.2.0"
```

## 暂存文件清单（14 个）

| # | 状态 | 文件 |
|---|------|------|
| 1 | M | .gitignore |
| 2 | M | CHANGELOG.md |
| 3 | M | README.md |
| 4 | M | docs/guides/team-handbook/01-design-philosophy.md |
| 5 | M | scripts/README.md |
| 6 | M | src/store/themeStore.ts |
| 7 | D | scripts/generate/generate-tokens.ts |
| 8 | A | docs/guides/design-to-code-workflow.md |
| 9 | A | docs/release-notes/RELEASE-NOTES-design-token-cleanup.md |
| 10 | A | docs/releases/COMMIT-design-token-cleanup.md |
| 11 | A | docs/releases/PR-design-token-cleanup.md |
| 12 | A | dogfood-output/e2e-theme-light.png |
| 13 | A | dogfood-output/e2e-theme-dark.png |
| 14 | A | dogfood-output/token-verify-v5.png |

## 注意事项

1. `src/main.tsx`、`src/lib/designTokenVerifier.ts`、`src/lib/designTokenVerifier.test.ts`、`src/index.css` 已在之前的 commit `75b2d61` 中提交，本次无需再次暂存
2. `docs/releases/COMMIT-design-token-cleanup.md` 是之前生成的提交信息文档，作为历史记录保留
3. 3 张截图作为验证证据提交，位于 dogfood-output/ 目录
