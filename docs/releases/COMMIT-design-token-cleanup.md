# Git Commit Message: 设计令牌清理与验证 Utility 重构

## 推荐的 Commit 命令

```bash
# 仅暂存本次令牌清理相关的文件
git add scripts/generate/generate-tokens.ts \
        src/store/themeStore.ts \
        src/lib/designTokenVerifier.ts \
        src/lib/designTokenVerifier.test.ts \
        src/main.tsx \
        src/index.css \
        .gitignore \
        CHANGELOG.md \
        README.md \
        scripts/README.md \
        docs/guides/design-to-code-workflow.md \
        docs/guides/team-handbook/01-design-philosophy.md \
        docs/release-notes/RELEASE-NOTES-design-token-cleanup.md \
        docs/releases/PR-design-token-cleanup.md \
        dogfood-output/token-verify-v5.png \
        dogfood-output/e2e-theme-light.png \
        dogfood-output/e2e-theme-dark.png

git commit -m "refactor(design-tokens): 清除旧版双套令牌系统，确立 V5 单一真相源

## 变更范围

### 删除（旧版令牌系统）
- scripts/generate/generate-tokens.ts — 旧版令牌生成器（遗漏副本）
- src/generated/ 目录 — 旧版 tokens.css / tokens.ts 已在前序提交清除，本次清理空目录并加入 .gitignore 防护

### 新增
- src/lib/designTokenVerifier.ts — 令牌验证 Utility（3 个导出函数）
  - collectDesignTokens(): 纯函数采集令牌数据
  - verifyDesignTokens(): 采集 + 结构化日志输出
  - verifyDesignTokensOnReady(): DOM 就绪 + DEV 守卫便捷封装
- src/lib/designTokenVerifier.test.ts — 17 个单元测试（全覆盖）
- docs/guides/design-to-code-workflow.md — Design→Code 工作流规范 v1.2.0
- docs/release-notes/RELEASE-NOTES-design-token-cleanup.md — 完整发布说明
- docs/releases/PR-design-token-cleanup.md — PR 描述模板

### 修改
- src/main.tsx — 120 行内联验证逻辑 → 2 行 import + 调用
- src/store/themeStore.ts — applyTheme() 集成 requestAnimationFrame(() => verifyDesignTokens())
- .gitignore — 新增 src/generated/ 防护规则
- CHANGELOG.md — 新增 2026-08-15 变更条目
- README.md — 更新版本日期、技术亮点、文档中心链接
- scripts/README.md — 移除已删除的 generate-tokens.ts 条目
- docs/guides/team-handbook/01-design-philosophy.md — 更新令牌链路 + 豁免列表

## 验证结果
- npm run build: exit 0 (3223 modules transformed)
- 单元测试: 17/17 通过 (1.08s)
- TypeScript: 0 新错误
- Playwright E2E: light/dark 切换令牌期望值全部匹配
- 旧版令牌全面搜索: 0 残留（8 项检查全通过）

## 根因分析
旧版令牌系统（slate 色彩体系）通过 generate-tokens.ts 从 tokens.json 自动生成 tokens.css + tokens.ts，
与 V5 Apple Business Design Tokens（src/index.css）形成双套令牌冲突。本次清理彻底移除旧版管道，
确立 src/index.css 为唯一真相源，并通过运行时验证 Utility 防止回归。

Closes: 设计令牌清理任务
Refs: docs/guides/design-to-code-workflow.md v1.2.0"
```

## 变更范围统计

| 类型 | 文件数 | 说明 |
|------|--------|------|
| 删除 | 1 | scripts/generate/generate-tokens.ts |
| 新增 | 6 | designTokenVerifier.ts + 测试 + 3 份文档 + 截图 |
| 修改 | 7 | main.tsx + themeStore.ts + .gitignore + CHANGELOG + README + scripts/README + 设计哲学 |
| **合计** | **14** | 不含 dogfood-output 截图（3 张） |

## 关键决策说明

### 1. .gitignore 防护规则
新增 `src/generated/` 规则，防止未来误操作重新生成旧版令牌文件。`scripts/generate/` 目录**未加入** .gitignore，因为目录下还有 8 个其他有用的生成脚本。

### 2. 拆分提交建议
如果希望提交历史更清晰，可拆分为 3 个原子提交：

```bash
# 提交 1: 清除旧版令牌
git add scripts/generate/generate-tokens.ts .gitignore
git commit -m "refactor(design-tokens): 清除旧版令牌生成器遗漏副本

删除 scripts/generate/generate-tokens.ts（上次清理遗漏的子目录副本）。
新增 .gitignore 规则防止 src/generated/ 重新生成。

Refs: commit 75b2d61"

# 提交 2: 验证 Utility 与主题集成
git add src/lib/designTokenVerifier.ts src/lib/designTokenVerifier.test.ts \
        src/main.tsx src/store/themeStore.ts
git commit -m "feat(design-tokens): 封装令牌验证 Utility 并集成主题切换重验证

- 新增 designTokenVerifier.ts（collectDesignTokens/verifyDesignTokens/verifyDesignTokensOnReady）
- 17 个单元测试覆盖核心逻辑
- main.tsx 从 120 行内联逻辑简化为 2 行调用
- themeStore.applyTheme() 集成 rAF 延迟验证
- DEV 守卫保证生产构建零开销"

# 提交 3: 文档更新
git add docs/ CHANGELOG.md README.md scripts/README.md
git commit -m "docs(design-tokens): 更新工作流规范、团队手册、CHANGELOG 与 README

- 新增 Design→Code 工作流规范 v1.2.0
- 新增发布说明与 PR 描述模板
- 更新团队手册设计哲学（令牌链路 + 豁免列表）
- 更新 README 技术亮点与文档中心链接
- 移除 scripts/README 中已删除的 generate-tokens.ts 条目"
```
