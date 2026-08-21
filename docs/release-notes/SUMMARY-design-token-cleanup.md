---
title: docs/release-notes/SUMMARY-design-token-cleanup.md
code_version: 2.0.0-rc.2
---

# 设计令牌清理工作总结报告

> **报告日期**：2026-08-15  
> **报告类型**：技术重构总结  
> **涉及提交**：4 个（508c84f → 75b2d61 → 801395d → 87ae340）  
> **总体状态**：✅ 已完成

---

## 一、工作背景

### 问题描述

项目存在**双套令牌系统冲突**：

| 令牌系统 | 位置 | 色彩体系 | 状态 |
|----------|------|----------|------|
| 旧版（slate 体系） | `design-tokens/tokens.json` → scripts/generate-tokens.ts → src/generated/tokens.css + `tokens.ts` | slate 灰阶 | 需清除 |
| 新版（V5 Apple Business） | `src/index.css` | Apple Blue #007AFF | 保留为唯一真相源 |

旧版通过 `generate-tokens.ts` 从 `tokens.json` 自动生成 `tokens.css` + `tokens.ts`，与 V5 Apple Business Design Tokens 形成命名空间重叠和色值冲突，暗色模式切换时存在色值错乱风险。

### 清理目标

1. 彻底移除旧版令牌管道（文件 + 脚本 + 配置）
2. 确立 `src/index.css` 为 V5 Apple Business Design Tokens 唯一真相源
3. 封装运行时验证 Utility，防止令牌回归
4. 集成主题切换自动重验证
5. 补全文档与测试覆盖

---

## 二、提交链

| # | Commit Hash | 时间 | 类型 | 说明 |
|---|-------------|------|------|------|
| 1 | `508c84f` | 00:53 | feat | 应用 Apple Business 设计令牌到全局主题与基础组件 |
| 2 | `75b2d61` | 01:14 | refactor | 移除旧版 tokens 管道并接入运行时令牌验证 |
| 3 | `801395d` | 01:40 | fix+refactor | 包含 14 个令牌清理文件（因 IDE 并发操作与组件重命名混合提交） |
| 4 | `87ae340` | 01:50 | docs | 修正提交说明 — 补充说明 801395d 包含令牌清理工作 |

---

## 三、涉及的文件列表

### 按变更类型分类

#### 删除的文件（6 个）

| 文件 | 删除提交 | 说明 |
|------|----------|------|
| `design-tokens/tokens.json` | `75b2d61` | 旧版令牌源数据（239 行） |
| scripts/generate-tokens.ts | `75b2d61` | 旧版令牌生成器（233 行） |
| src/generated/tokens.css | `75b2d61` | 旧版生成的 CSS 令牌（176 行） |
| src/generated/tokens.ts | `75b2d61` | 旧版生成的 TS 常量（189 行） |
| scripts/generate/generate-tokens.ts | `801395d` | 旧版令牌生成器子目录副本（233 行） |
| `src/generated/` 目录 | `801395d` | 空目录清理 + .gitignore 防护 |

#### 新增的文件（10 个）

| 文件 | 新增提交 | 说明 |
|------|----------|------|
| `src/lib/designTokenVerifier.ts` | `75b2d61` | 令牌验证 Utility（3 个导出函数，134 行） |
| `src/lib/designTokenVerifier.test.ts` | `75b2d61` | 17 个单元测试（274 行） |
| `docs/guides/design-to-code-workflow.md` | `801395d` | Design→Code 工作流规范 v1.2.0（433 行） |
| `docs/release-notes/RELEASE-NOTES-design-token-cleanup.md` | `801395d` | 完整发布说明（257 行） |
| `docs/releases/COMMIT-design-token-cleanup.md` | `801395d` | Commit 信息文档（115 行） |
| `docs/releases/PR-design-token-cleanup.md` | `801395d` | PR 描述模板（67 行） |
| `docs/releases/COMMIT-FINAL.md` | `801395d` | 最终 Commit 信息文档 |
| `dogfood-output/e2e-theme-light.png` | `801395d` | E2E 测试截图（light 模式） |
| `dogfood-output/e2e-theme-dark.png` | `801395d` | E2E 测试截图（dark 模式） |
| `dogfood-output/token-verify-v5.png` | `801395d` | 令牌验证截图 |

#### 修改的文件（12 个）

| 文件 | 修改提交 | 说明 |
|------|----------|------|
| `src/index.css` | `508c84f` | V5 Apple Business 令牌定义（唯一真相源） |
| `tailwind.config.js` | `508c84f` | Tailwind 配置对齐 V5 令牌 |
| `src/constants/theme/theme.tokens.base.ts` | `508c84f` | 基础令牌对齐 |
| `src/constants/theme/theme.tokens.color.ts` | `508c84f` | 色彩令牌对齐 |
| `src/constants/theme/theme.tokens.design.ts` | `508c84f` | 设计令牌对齐 |
| `src/constants/theme/theme.tokens.portal.ts` | `508c84f` | Portal 令牌对齐 |
| `src/components/atoms/Card.tsx` | `508c84f` | Card 去边框改阴影 |
| `src/components/templates/PageHeader.tsx` | `508c84f` | PageHeader 空值守卫 |
| `src/main.tsx` | `75b2d61` | 120 行内联验证 → 2 行 import + 调用 |
| `src/store/themeStore.ts` | `801395d` | applyTheme() 集成 rAF 延迟验证 |
| `.gitignore` | `801395d` | 新增 `src/generated/` 防护规则 |
| `CHANGELOG.md` | `801395d` | 新增 2026-08-15 变更条目 |
| `README.md` | `801395d` | 更新版本日期、技术亮点、文档链接 |
| `scripts/README.md` | `801395d` | 移除已删除的 generate-tokens.ts 条目 |
| `docs/guides/team-handbook/01-design-philosophy.md` | `801395d` | 更新令牌链路 + 豁免列表 |
| `design-tokens/project-to-figma.json` | `75b2d61` | Figma 映射文件微调 |

---

## 四、关键变更点

### 1. 令牌系统统一

| 变更前 | 变更后 |
|--------|--------|
| 双套令牌（slate + Apple Business） | 单一真相源（V5 Apple Business） |
| `tokens.json` → `generate-tokens.ts` → `tokens.css` + `tokens.ts` | `src/index.css` 直接定义 |
| 暗色模式 primary = `#157958`（翡翠绿） | 暗色模式 primary = `#007AFF`（Apple Blue） |

> **📝 后续更新（2026-08-15）**：颜色契约进一步统一——9 个文档文件已从"翡翠绿"描述对齐为 Apple Blue #007AFF，消除代码与文档的双线叙事。详见 [CHANGELOG.md](../../CHANGELOG.md)。

### 2. 运行时验证 Utility

新增 `src/lib/designTokenVerifier.ts`，导出 3 个函数：

| 函数 | 用途 | 特性 |
|------|------|------|
| `collectDesignTokens(el?)` | 纯函数采集令牌数据 | 可用于测试、其他模块 |
| `verifyDesignTokens(el?)` | 采集 + 结构化日志输出 | DEV 守卫、期望值对比 |
| `verifyDesignTokensOnReady()` | DOM 就绪 + DEV 守卫便捷封装 | 应用入口一键调用 |

**设计约束**：
- `import.meta.env.DEV` 守卫 → 生产构建 Vite tree-shake 完全移除，零运行时开销
- `requestAnimationFrame` 延迟 → 主题切换后等待浏览器重算样式才验证
- 4 个旧版令牌探测（`--color-primary` / `--color-secondary` / `--spacing-1` / `--fontSize-body`）

### 3. 主题切换自动重验证

`themeStore.applyTheme()` 集成验证逻辑，覆盖 5 条主题切换路径：

| 路径 | 触发场景 |
|------|----------|
| `setMode(mode)` | 用户手动选择主题 |
| `toggleTheme()` | 一键明暗切换 |
| `cycleMode()` | PortalShell 顶栏循环切换 |
| `initSystemThemeListener` | 系统主题变化（mode=system 时） |
| `onRehydrateStorage` | 页面刷新后从 localStorage 恢复 |

### 4. .gitignore 防护规则

```gitignore
# Legacy token generation (removed 2026-08-15, prevent regeneration)
src/generated/
```

**精细化设计**：
- `src/generated/` 已忽略 — 防止旧版令牌重新生成
- `scripts/generate/` 未忽略 — 目录下有 8 个有用的生成脚本

### 5. 测试覆盖

**测试框架**：Vitest 2.1.0 + @testing-library/jest-dom 6.9.1 + @vitest/coverage-istanbul 2.1.9

**单元测试**：17 个用例，覆盖三个函数的核心逻辑：

| 函数 | 测试用例数 | 覆盖场景 |
|------|-----------|----------|
| `collectDesignTokens` | 10 | light/dark 模式、缺失令牌、不匹配令牌、旧版残留、多种异常并存、默认参数、令牌数量 |
| `verifyDesignTokens` | 4 | DEV=false 跳过、DEV=true 通过/失败日志、返回值一致性 |
| `verifyDesignTokensOnReady` | 3 | DEV=false 跳过、DOM loading 注册事件、DOM complete 直接执行 |

**E2E 测试**：Playwright 自动化（light → dark → light 循环切换）
- 验证令牌期望值在主题切换后全部匹配
- 验证控制台 0 页面错误
- 截图证据：`dogfood-output/e2e-theme-light.png` + `dogfood-output/e2e-theme-dark.png`

**Mock 策略**：
- `import.meta.env.DEV` 通过 `vi.stubGlobal` mock
- `document.readyState` 通过 `Object.defineProperty` mock
- CSS 变量通过 `element.style.setProperty` 注入测试数据

**关键常量与接口**：
- `LEGACY_TOKEN_NAMES`：4 个旧版令牌探测名（`--color-primary` / `--color-secondary` / `--spacing-1` / `--fontSize-body`）
- `TokenVerificationResult`：返回值接口，包含 `tokens` / `legacyTokens` / `legacyFound` / `passed` / `matched` / `mismatched` / `missing` 字段

### 6. 构建配置变更

| 配置项 | 变更前 | 变更后 | 说明 |
|--------|--------|--------|------|
| `package.json` prebuild | `npm run generate:tokens && npm run tsc:prod` | `npm run tsc:prod` | 移除令牌生成钩子（在更早提交中完成） |
| `.gitignore` | 无 `src/generated/` 规则 | 新增 `src/generated/` | 防止旧版令牌重新生成 |
| husky pre-commit | 17 步门禁 | 17 步门禁（无变更） | 提交时自动运行作用域守卫、tsc:prod、ESLint 等 |

---

## 五、验证结果

### 提交前验证（10 项全通过）

| 检查项 | 结果 |
|--------|------|
| `src/` 中 `--color-*` 令牌定义 | 0 处 ✅ |
| `generated/tokens` 导入引用 | 0 处 ✅ |
| `generate-tokens.ts` 文件残留 | 0 处 ✅ |
| 旧版 slate 色值 `#157958` | 0 处 ✅ |
| `package.json` `generate:tokens` 脚本 | 0 处 ✅ |
| `src/generated/` 目录 | 不存在 ✅ |
| `design-tokens/tokens.json` | 不存在 ✅ |
| 旧版 `--spacing-*`/`--fontSize-body` 令牌 | 6 处（全部为防御性验证代码）✅ |
| 暂存区文件数 | 14 ✅ |
| 工作区遗漏文件 | 0 ✅ |

### 构建与测试

| 检查项 | 结果 |
|--------|------|
| `npm run build` | ✅ exit 0（3223 modules transformed，~12s） |
| 单元测试 | ✅ 17/17 通过（1.08s） |
| TypeScript 类型检查 | ✅ 0 新错误 |
| Playwright E2E（light→dark→light） | ✅ 令牌期望值全部匹配，0 页面错误 |
| 生产 bundle tree-shake | ✅ `TokenVerify` 零残留 |

---

## 六、影响范围

### 运行时影响

| 场景 | 影响 |
|------|------|
| 生产构建 | 零开销（DEV 守卫 + Vite tree-shake） |
| 开发环境 | 启动时自动验证令牌加载（23 条日志） |
| 主题切换 | 5 条路径自动重验证（rAF 延迟） |

### 文档影响

| 文档 | 更新内容 |
|------|----------|
| README.md | 版本日期、技术亮点、文档中心链接 |
| CHANGELOG.md | 2026-08-15 变更条目 |
| 团队手册设计哲学 | 令牌链路 + 豁免列表 |
| scripts/README.md | 移除已删除的 generate-tokens.ts 条目 |

---

## 七、经验教训

### 1. 子目录副本遗漏

首次清理时只删除了 scripts/generate-tokens.ts（根目录），遗漏了 scripts/generate/generate-tokens.ts（子目录副本）。后续校验中发现并清除。

**教训**：删除文件时应全局搜索同名文件，避免遗漏副本。

### 2. IDE 并发 git 操作

执行 `git add` + `git commit` 时，IDE 后台 git 操作并发执行，导致暂存区被覆盖，文件被混合提交到另一个 commit message 的提交中。

**教训**：提交前应确认无其他 git 进程运行，或使用 `git commit --only` 指定文件绕过暂存区。

### 3. 空目录残留

删除目录内文件后，空目录仍残留。需额外执行目录删除 + .gitignore 防护。

**教训**：清理文件后应检查空目录，并添加 .gitignore 规则防止重新生成。
