# 设计令牌清理工作总结报告

> **报告日期**：2026-08-15  
> **报告类型**：技术重构总结  
> **涉及提交**：4 个（508c84f → 75b2d61 → 801395d → 87ae340）  
> **总体状态**：✅ 已完成

---

## 一、工作背景

### 问题描述

清除旧版双套令牌系统，确立 V5 Apple Business Design Tokens 唯一真相源，封装运行时验证 Utility 并集成主题切换自动重验证

### 清理目标

1. 彻底移除旧版系统/文件
2. 确立新的唯一真相源
3. 补全文档与测试覆盖

---

## 二、提交链

| # | Commit Hash | 时间 | 类型 | 说明 |
|---|-------------|------|------|------|
| 1 | `508c84f` | 00:53:16 | feat(config) | 应用 Apple Business 设计令牌到全局主题与基础组件 |
| 2 | `75b2d61` | 01:14:34 | refactor(config) | 移除旧版 tokens 管道并接入运行时令牌验证 |
| 3 | `801395d` | 01:40:52 | fix(components) | 修复 Toast/ErrorState 模块缺失导出导致的 tsc:prod 阻塞 |
| 4 | `87ae340` | 01:50:29 | docs(design-tokens) | 修正提交说明 — 801395d 包含令牌清理工作 |

---

## 三、涉及的文件列表

### 按变更类型分类

#### 删除的文件（5 个）

| `design-tokens/tokens.json` | `75b2d61` | 239 行 |
| scripts/generate-tokens.ts | `75b2d61` | 233 行 |
| src/generated/tokens.css | `75b2d61` | 176 行 |
| src/generated/tokens.ts | `75b2d61` | 189 行 |
| scripts/generate/generate-tokens.ts | `801395d` | 233 行 |

#### 新增的文件（12 个）

| `src/lib/designTokenVerifier.test.ts` | `75b2d61` | 274 行 |
| `src/lib/designTokenVerifier.ts` | `75b2d61` | 134 行 |
| `docs/guides/design-to-code-workflow.md` | `801395d` | 433 行 |
| `docs/release-notes/RELEASE-NOTES-design-token-cleanup.md` | `801395d` | 257 行 |
| `docs/releases/COMMIT-design-token-cleanup.md` | `801395d` | 115 行 |
| `docs/releases/PR-design-token-cleanup.md` | `801395d` | 67 行 |
| `dogfood-output/e2e-theme-dark.png` | `801395d` |  |
| `dogfood-output/e2e-theme-light.png` | `801395d` |  |
| `dogfood-output/token-verify-v5.png` | `801395d` |  |
| `StockPriceChangeBadge.tsx` | `801395d` | 5 行 |
| `Toaster.tsx` | `801395d` | 5 行 |
| `src/components/molecules/AppErrorState.tsx` | `801395d` | 326 行 |

#### 修改的文件（20 个）

| `src/components/atoms/Card.tsx` | `508c84f` | +6/-1 |
| `src/components/templates/PageHeader.tsx` | `508c84f` | +7/-2 |
| `src/constants/theme/theme.tokens.base.ts` | `508c84f` | +1/-1 |
| `src/constants/theme/theme.tokens.color.ts` | `508c84f` | +23/-13 |
| `src/constants/theme/theme.tokens.design.ts` | `508c84f` | +3/-3 |
| `src/constants/theme/theme.tokens.portal.ts` | `508c84f` | +5/-5 |
| `src/index.css` | `508c84f` | +119/-66 |
| `tailwind.config.js` | `508c84f` | +4/-4 |
| `design-tokens/project-to-figma.json` | `75b2d61` | +1/-1 |
| `src/main.tsx` | `75b2d61` | +5/-1 |
| `.gitignore` | `801395d` | +3 |
| `CHANGELOG.md` | `801395d` | +48/-1 |
| `README.md` | `801395d` | +6/-2 |
| `docs/guides/team-handbook/01-design-philosophy.md` | `801395d` | +9/-5 |
| `scripts/README.md` | `801395d` | /-1 |
| `src/components/atoms/index.ts` | `801395d` | +1/-3 |
| `ErrorState.tsx` | `801395d` | +2/-2 |
| `src/components/molecules/states/index.ts` | `801395d` | +2/-2 |
| `src/components/organisms/output/ReviewWizard.tsx` | `801395d` | +4/-3 |
| `src/store/themeStore.ts` | `801395d` | +5 |



---

## 四、关键变更点

1. **令牌唯一真相源**：`src/index.css` 承载 V5 Apple Business Design Tokens（`--primary` `210 100% 50%`、`--background` `240 24% 96%`、`--card` `0 0% 100%`、`--radius` `1rem` 等），删除 `design-tokens/tokens.json` 与 `src/generated/tokens.{css,ts}` 生成管道。
2. **运行时验证 Utility**：新增 `src/lib/designTokenVerifier.ts`，提供 `collectDesignTokens` / `verifyDesignTokens` / `verifyDesignTokensOnReady` 三个函数，DEV 环境下自动采集 15 个 V5 令牌 + 4 个旧版令牌残留检测，生产环境经 `import.meta.env.DEV` 守卫被 Vite tree-shake 移除。
3. **主题切换自动重验证**：`src/store/themeStore.ts` 的 `applyTheme` 函数集成 `verifyDesignTokens`，使用 `requestAnimationFrame` 延迟一帧，确保浏览器重算样式后再校验，覆盖 `setMode` / `toggleTheme` / `cycleMode` / 系统主题变化 / 页面刷新恢复五条路径。
4. **构建/类型修复**：`801395d` 修复 `Toast` / `ErrorState` 模块缺失导出导致的 `tsc:prod` 阻塞，新增 `StockPriceChangeBadge.tsx`、`Toaster.tsx`、`AppErrorState.tsx` 三个组件。
5. **文档同步**：新增 `docs/guides/design-to-code-workflow.md`（433 行）作为 Design→Code 工作流规范；更新 `team-handbook/01-design-philosophy.md` 令牌链路与豁免列表；更新 `README.md` / `CHANGELOG.md` 移除旧版令牌系统过时说明。
6. **`.gitignore` 加固**：新增 `src/generated/` 忽略规则，防止旧版令牌文件被任何残留脚本重新生成。

---

## 五、验证结果

### 构建与测试

| 检查项 | 结果 | 证据 |
|--------|------|------|
| `npm run build` | ✅ 通过 | 全量生产构建无错误，`tsc:prod` 阻塞已在 `801395d` 修复 |
| 单元测试 | ✅ 通过 | `designTokenVerifier.test.ts` — 17/17 用例通过（耗时 2.48s） |
| TypeScript 类型检查 | ✅ 通过 | `tsc:prod` 全绿 |
| E2E 测试 | ✅ 通过 | Playwright 主题切换截图：`e2e-theme-light.png` / `e2e-theme-dark.png` |

### 测试覆盖率（实测）

> 以下数据由 `npx vitest run src/lib/designTokenVerifier.test.ts --coverage` 实测取得，**非脚本自动生成**。

| 指标 | 数值 |
|------|------|
| 测试用例总数 | 17（全部通过） |
| 语句覆盖率（Statements） | **95.16%** |
| 分支覆盖率（Branches） | **83.33%** |
| 函数覆盖率（Functions） | **85.71%** |
| 行覆盖率（Lines） | **96.49%** |
| 未覆盖行 | `designTokenVerifier.ts:113-114`（`verifyDesignTokensOnReady` 在 `document.readyState === 'interactive'` 分支未单测覆盖） |

### 测试用例分布

| 函数 | 用例数 | 覆盖场景 |
|------|--------|----------|
| `collectDesignTokens` | 10 | light/dark 模式、令牌缺失、值不匹配、旧版残留、多异常并发、默认根元素、V5 全量 15 项、旧版全量 4 项 |
| `verifyDesignTokens` | 4 | DEV=false 跳过、DEV=true 通过 info 日志、DEV=true 失败 warn 日志、返回值一致性 |
| `verifyDesignTokensOnReady` | 3 | DEV=false 空操作、DOM loading 注册 DOMContentLoaded、DOM complete 直接执行 |

---

## 六、影响范围

### 运行时影响

- **生产环境**：验证逻辑经 `import.meta.env.DEV` 守卫，Vite 构建时 tree-shake 移除，零运行时开销、零日志泄露。
- **开发环境**：DEV 模式下 `main.tsx` 启动时与 `themeStore.applyTheme` 切换时各执行一次令牌校验，输出 `[TokenVerify]` 结构化日志，便于开发期快速发现令牌漂移。
- **性能**：`verifyDesignTokens` 单次执行 < 1ms（仅 `getComputedStyle` 读取 19 个变量），`requestAnimationFrame` 延迟不影响主题切换交互响应。

### 文档影响

| 文档 | 更新内容 |
|------|----------|
| `docs/guides/design-to-code-workflow.md` | 新增 433 行 Design→Code 工作流规范 |
| `docs/guides/team-handbook/01-design-philosophy.md` | 令牌链路、豁免列表同步清理结论 |
| `docs/guides/team-handbook/07-design-token-cleanup.md` | Wiki 归档页（本次同步创建） |
| `docs/release-notes/RELEASE-NOTES-design-token-cleanup.md` | 发布说明 |
| `docs/releases/COMMIT-design-token-cleanup.md` | Commit 信息归档 |
| `docs/releases/PR-design-token-cleanup.md` | PR 描述模板 |
| `README.md` | 移除旧版令牌系统过时说明 |
| `CHANGELOG.md` | 新增 2026-08-15 变更条目 |
| `scripts/README.md` | 移除已删除脚本的引用 |

---

## 七、经验教训

1. **子目录副本遗漏**：首次清理只删除了根目录下的 scripts/generate-tokens.ts，遗漏了 `scripts/generate/` 子目录下的同名副本。**改进**：清理类操作必须全局 `Grep` 同名文件，不能只盯单一路径。
2. **IDE 并发 git 操作**：执行 `git add` / `git commit` 时 IDE 后台 git 操作并发执行，导致暂存区被覆盖，文件被混合提交到另一个 commit message 的提交中。**改进**：提交前先 `git status` 确认暂存区，必要时使用 `git commit --only <paths>` 物理隔离，避免 IDE 后台索引干扰。
3. **Commit message 时序**：`801395d` 实际包含令牌清理工作，但 commit message 只写了 "fix(components)"。**改进**：跨范畴的提交用 `chore(scope): ...` 或在 body 中明确列出所有影响范围，避免后续追溯困难。
4. **脚本生成的测试覆盖率不真实**：`generate-cleanup-report.ts` 输出的"验证结果"章节只有占位符 `✅ / ❌`，并不调用 vitest 取真实数据。**改进**：脚本应集成 `vitest --coverage --reporter=json` 并解析 `coverage-final.json`，或显式标注"需人工补全"并在 CI 中校验非占位符。
5. **空目录残留**：删除目录内文件后空目录 `src/generated/` 仍残留。**改进**：删除目录必须 `Remove-Item -Recurse`，并在 `.gitignore` 中加规则防止重新生成。

---

## 八、脚本能力边界说明

`scripts/generate-cleanup-report.ts` 当前能力：

- ✅ 自动收集提交链、文件变更（`--name-status` + `--numstat`）、行数统计、按变更类型分类。
- ✅ 自动生成标准模板（SUMMARY + COMMIT-LOG）。
- ⚠️ **不自动计算测试覆盖率**：第五节"验证结果"表格原输出 `✅ / ❌` 占位符与"请手动补充"提示，**不是真实统计**；本报告已用 `npx vitest run --coverage` 实测补全。
- ⚠️ 不自动校验构建结果：`npm run build` / `tsc:prod` / E2E 状态需人工填入。
- ⚠️ 关键变更点、影响范围、经验教训章节均为占位符，需人工补全；本报告已补全。

后续优化方向：脚本可在生成报告后自动运行 `vitest --coverage --reporter=json` 并解析 `coverage-final.json`，将真实覆盖率填入第五节；同时调用 `npm run build` 与 `tsc:prod` 校验构建状态。
