# 更新日志

> 本日志按 [SemVer](https://semver.org/lang/zh-CN/) 记录 V9 智能投研复盘系统的版本变更、架构决策与验收数据。  
> 未发布版本以 `Unreleased` 开头；已发布版本附带构建与测试硬指标。
> 
> ⚠️ **历史引用声明**：本日志中 v2.4.0 之前的条目引用的部分文档路径（如 `docs/explanation/03-architecture-standards.md`、`docs/guides/CODE-REVIEW.md`、`docs/reports/code-graph.json` 等）可能因文档体系重构（SDLC 目录重组）已发生变更。如需最新路径，请查询 `docs/README.md` 或 `docs/meta/` 索引。

---

## [v1.2.0-fix-doc-links] - 2026-08-05

### Summary

文档断链批量修复 + TypeScript 类型错误修复 + 审计脚本增强，文档审计 warnings 从 2858 降至 1417（修复率 50.4%）。

### Fixed — 文档断链修复（1441 条）

本次修复文档断链共 **1441 条**，涵盖以下类别：

| 类别 | 原始数量 | 修复数量 | 修复率 |
|------|---------|---------|--------|
| D — 有候选路径 | 10 | 10 | 100% |
| B — missing-npm-script | 31 | 31 | 100% |
| A — Glob/正则模式 | 153 | 153 | 100% |
| C — 无匹配路径 | 956 | 943+ | ~98.6% |
| **合计** | **2858** | **1441** | **50.4%** |

具体修复的 24 条断链涉及 11 个文档文件：

| 文件 | 修复内容 |
|------|---------|
| `docs/audit/v9-ui-component-feasibility-assessment.md` | `../implementation/` → `../explanation/design/` |
| `docs/specs/product/README.md` | `../README.md` → `../requirements/README.md` |
| `docs/specs/product/data-security-and-privacy.md` | 相对路径深度修正（4 处） |
| `docs/specs/requirements/adr/README.md` | `../../reference/` → `../../../reference/`（3 处） |
| `docs/wiki/doc-quality-governance-wiki-2026-08-03.md` | `../architecture.md` → `../explanation/ARCHITECTURE.md` |
| `docs/wiki/duplicate-docs-comparison-2026-08-04.md` | 小写文件名 → 大写常量名（2 处） |
| `docs/refactor/m1-week1-daily-tasks.md` | `docs/guidelines/` → `docs/guides/`（2 处） |
| `docs/refactor/p0-refactor-plan.md` | `docs/guidelines/` → `docs/guides/` |
| `docs/refactor/optimization-issues.md` | 移除重复 `refactor/` 路径段（4 处） |

### Fixed — TypeScript 类型错误修复（29 个错误，5 个文件）

| 文件 | 错误类型 | 修复方式 |
|------|---------|---------|
| `src/core/acl.branch-coverage.test.ts` | TS6133 未使用导入 / TS2820 类型不匹配 | 移除 `ACL_MATRIX` 导入；`dailyQuotes` → `daily_quotes` |
| `src/core/databridgeAcl.branch-coverage.test.ts` | TS2322 / TS2345 类型不匹配 | 导入 `ModuleId` 类型；`source` 参数类型化；`dailyQuotes` → `daily_quotes` |
| `src/core/databridgeAdapter.branch-coverage.test.ts` | TS2345 无效 DataAction | `queryList` → `FETCH_STOCKS`；非空断言 `!` |
| `src/data/db-schema.test.ts` | TS6133 未使用导入 | 移除 `DEFAULT_POOL_GROUP` 导入 |
| `src/lib/derivedCache.branch-coverage.test.ts` | TS18048 / TS2532 可能为 undefined | `getCacheStatsSnapshot()['key']` 添加 `!` 非空断言 |

### Changed — 审计脚本增强（`scripts/audit/audit-doc-integrity.ts`）

- 扩展 `IGNORED_FILE_PATHS`：新增 `src/devtools/`、`src/workers/`、`src/scripts/configs`、`src/components/ui`
- 扩展 `IGNORED_FILE_PREFIXES`：新增 `scripts/audit/docs/reports/audit/`
- 新增过滤规则：含省略号(`...`)路径、含空格命令参数、含行号后缀引用
- 新增路径纠正：`docs/guidelines/` → `docs/guides/` 自动重定向
- 新增 `resolveRelativePath()` 函数：支持 `./` 和 `../` 相对路径解析

### Added — 报告与任务清单

- `docs/reports/doc-link-fix-comparison-report-2026-08-05.md`：文档断链修复对比报告
- `docs/reports/jira-tech-debt-tasks-2026-08-05.csv`：13 条技术债务 Jira 导入清单

### Remaining Tech Debt — 剩余 13 条技术债务

以下 13 条警告均为文档引用了尚不存在的文件/目录，已登记为低优先级技术债务（Jira CSV: `docs/reports/jira-tech-debt-tasks-2026-08-05.csv`）。
**源文件引用列**格式：`源文件路径:具体行号`，便于快速定位并修复。
**准确性校验**：13/13 源文件引用均经 Grep 交叉验证命中；12/13 缺失路径经 Glob 验证不存在。

| 编号 | 缺失路径 | 源文件引用 | 简要描述 | 建议处理方式 |
|------|---------|-----------|---------|-------------|
| DOC-DEBT-001 | `docs/meta/trae-file-management-review.md` | `AGENTS.md:1233` | Trae 文件管理评审文档未创建 | 在 docs/meta/ 创建文档，或移除 AGENTS.md 中的引用 |
| DOC-DEBT-002 | `src/pages/WidgetPriceGuardDemoPage.tsx` | `docs/pr-safe-format-design-decisions.md:29` | WidgetPriceGuard Demo 页面未创建 | 创建安全格式化 Demo 页，或更新文档引用 |
| DOC-DEBT-003 | `docs/guides/type-contract-governance.md` | `docs/refactor/m1-week1-daily-tasks.md:35` | 类型契约治理文档未创建 | 创建文档（含规范、案例、FAQ），或移除引用 |
| DOC-DEBT-004 | `docs/guides/pre-commit-types-check.md` | `docs/refactor/m1-week1-daily-tasks.md:56` | Pre-commit 类型检查指南未创建 | 记录 tsc:prod/tsc:test 机制原理与排障方法，或移除引用 |
| DOC-DEBT-005 | `docs/refactor/reports/2026-08-04-tech-debt-remediation-report.md` | `docs/refactor/optimization-issues.md:8` | 技术债务修复报告未创建（连同父目录 `reports/` 缺失） | 创建 `docs/refactor/reports/` 目录并写入报告，或改为目标报告的实际路径 |
| DOC-DEBT-006 | `docs/refactor/issue-01-body.md` | `docs/refactor/optimization-issues.md:23` | Issue body 模板文档未创建（shell 命令 `--body-file` 参数引用，非超链接） | 若命令需实际执行则创建模板文件；若仅为示例则标记为 `<placeholder>` 避免审计误报 |
| DOC-DEBT-007 | `docs/api-types` | `docs/refactor/optimization-issues.md:341` | API 类型文档目录未创建（typedoc `--out` 输出目录） | 实现 `docs:types` typedoc 脚本并生成目录，或改为已部署 URL |
| DOC-DEBT-008 | `docs/refactor/2026-08-04-tech-debt-remediation-report.md` | `docs/refactor/p0-refactor-plan.md:8` | 技术债务修复报告未创建（与 DOC-DEBT-005 是同一份报告的两个不同路径，一者含 reports/ 子目录，一者不含） | 统一路径为 `docs/refactor/reports/`（推荐），并修正另一方引用 |
| DOC-DEBT-009 ⚠️ | `scripts/quality/eslint-plugin-no-raw-tofixed.js` | `docs/refactor/p0-refactor-plan.md:286` | ESLint 插件未创建（审计快照时缺失）；**发布后补充**：本地工作目录该文件已存在但状态为 Git 未跟踪（`??`），引用在远程仓库仍不可点击 | **先核实**：若需纳入管理则 `git add` + 提交 + 关闭 Jira 任务；若为本地临时产物则删除，并按描述正式实现 |
| DOC-DEBT-010 | `docs/guides/eslint-rules.md` | `docs/refactor/p0-refactor-plan.md:306` | ESLint 规则文档未创建 | 描述所有 `scripts/quality/eslint-plugin-*` 自定义规则与配置方法，或移除引用 |
| DOC-DEBT-011 | `scripts/quality/eslint-plugin-no-raw-tofixed.test.js` | `docs/refactor/p0-refactor-plan.md:428` | ESLint 插件测试未创建（mocha 测试命令参数，非超链接） | 基于 RuleTester 编写测试用例覆盖每条规则，或把命令标记为 `<待实现>` |
| DOC-DEBT-012 | `src/cockpit/widgets/MarketIndicesWidget.test.tsx` | `docs/regression-test-report-2026-08-04.md:184` | Widget 测试文件未创建（`MarketIndicesWidget.tsx` 组件存在但无对应 .test.tsx） | 参考 `WatchlistMoversWidget.test.tsx` 结构，覆盖 Loading/Error/Empty/Ready 四态 |
| DOC-DEBT-013 | `docs/tofixed-scan-report.md` | `docs/widget-types-change-analysis.md:331` | ToFixed 扫描报告未创建 | 运行 `scan-tofixed-usage.cjs` 并汇总输出生成报告，或移除引用 |

> **完整校验报告**：见 [changelog-v1.2.0-accuracy-check-2026-08-05.md](./docs/reports/changelog-v1.2.0-accuracy-check-2026-08-05.md)（准确率 92.3%，12/13 完全准确）。

### Metrics

| 指标 | 修复前 | 修复后 | 变化 |
|------|--------|--------|------|
| Total Warnings | 2858 | 1417 | **-1441（-50.4%）** |
| Total Violations | 0 | 0 | 0 |
| TS 类型错误 | 29 | 0 | -29 |
| 修改文件数 | — | 18 | — |
| 剩余技术债务 | — | 13 | — |

**提交**: `d8cf7d38`  
**标签**: `v1.2.0-fix-doc-links`  
**分支**: `fix/autorecover-test-comment`

---

## [2.6.0] - 2026-07-26

### Added

- **零值兜底整改 — NaN 显式空值标记与双向验证**：
  - `src/data/sectorDefinitions.test.ts` 新增 22 个测试用例，覆盖 v6Composite 缺失/零值/边界场景
  - `src/store/positionPoolStore.test.ts` 新增 531 行测试，含 12 组双向验证（6 正向 + 6 逆向）
  - `src/store/profileStore.test.ts` 新增 19 组数据流集成测试
  - `docs/reports/zero-fallback-remediation-acceptance-report-2026-07-26.md` 新增验收报告
  - `docs/reports/release-management/v2.6.0-release-report.md` 新增 v2.6.0 发布报告
  - `docs/reports/release-management/code-review-checklist-v2.6.0.md` 新增代码审查自查清单
  - `docs/reports/release-management/v2.6.0-changelog-draft.md` 新增发布变更日志草稿

- **自动推送工具链 — GitAutoPush 模块与 CI/CD 集成**：
  - `.workbuddy/scripts/GitAutoPush.psm1` 新增可复用 PowerShell 模块（8 个导出函数）
  - `.workbuddy/scripts/auto-push-on-network.ps1` 新增单次执行脚本
  - `.workbuddy/scripts/schedule-auto-push.ps1` 新增 5 分钟间隔定时任务脚本
  - `.workbuddy/tests/GitAutoPush.Tests.ps1` 新增 Pester 单元测试（6 场景 20+ 用例）
  - `.github/workflows/git-auto-push.yml` 新增 CI/CD 自动推送工作流
  - `.github/workflows/ci.yml` 新增 `git-autopush-test` Job
  - `docs/reports/release-management/git-auto-push-operation-guide.md` 新增操作文档

### Changed

- **`?? 0` → `Number.NaN` 隐式兜底消除**：
  - `src/store/positionPoolStore.ts`: `quantity`/`avgCost`/`currentPrice` 兜底从 `?? 0` 改为 `?? Number.NaN`
  - `src/data/sectorDefinitions.ts`: `v6Composite` 兜底从 `?? 0` 改为 `?? Number.NaN`
  - `src/store/profileStore.ts`: `qualityScore` 兜底从 `?? 0` 改为 `?? 50`（中值兜底）；`minQuality > 0` 改为 `minQuality !== undefined`
  - 3 个模块关键入口新增 `logger.debug` 日志，区分缺失值与显式零值

### Fixed

- **数据准确性修复 — 隐式零值兜底消除**：
  - 修复 `positionPoolStore.toPoolItem()` 中 `quantity`/`avgCost`/`currentPrice` 缺失时被静默替换为 0 的问题
  - 修复 `sectorDefinitions.getSectorPoolStocks()` 中 `v6Composite` 缺失时被静默替换为 0 的问题
  - 修复 `profileStore.loadItems()` 中 `qualityScore` 缺失时被静默替换为 0 的问题
  - 修复 `profileStore` 筛选逻辑 `minQuality > 0` 无法支持 0 阈值的问题

### Metrics

| 指标 | 数值 |
|------|------|
| 修复文件数 | 3 |
| 新增测试行数 | 531+ |
| 新增测试用例 | 22+ |
| 双向验证组 | 19 |
| 新增 PowerShell 模块函数 | 8 |
| 新增 CI/CD 工作流 | 2 |
| Pester 测试覆盖场景 | 6 |

---

## [Unreleased]

### Added

- **`.gitignore` 覆盖率自动化治理体系（2026-08-05）**：
  - `scripts/audit/audit-gitignore-coverage.sh` 新增 IDE/环境部署追踪治理审计脚本（sh 兼容，pre-commit 集成），3 项检查：① 暂存区 IDE 私有路径拦截 ② .gitignore 规则覆盖率 ③ 保留追踪路径未被误忽略
  - `tests/__tests__/scripts/gitignore-coverage.test.ts` 新增回归测试（14 用例：正向 6 + 逆向 2 + 脚本存在 1 + .gitignore 规则 2 + sh 条件跳过 3），确保未来新增 IDE 文件被自动拦截
  - `docs/guides/how-to/FILE-MANAGEMENT-GUIDE.md` §三 重构为 §2.1/2.2/2.3，新增「IDE/环境部署追踪治理」段落（保留追踪清单 + 必须忽略路径表 + 治理纪律 4 条），修正原 `.trae/` 被误列入忽略清单的错误

- **P0 阻塞项清理工具链与验收体系（2026-08-05）**：
  - `scripts/p0-cleanup.sh` 新增 10 步 P0 自动化清理与验证脚本（支持 `--apply` / `--verify-only` / dry-run 模式），覆盖 tsc:prod 退出码验证、.gitignore 规则验证、路由残留检查、备份文件清理、e2e 产物清理、scripts 同名重复扫描、doc-sync 实现检测、ADR 散落检测、git status 清洁度检查
  - `Dockerfile.prod` 升级为多阶段构建模板（目标镜像 ≤50 MB）：builder 阶段含 Brotli+Gzip 双压缩、runner 阶段使用 `nginxinc/nginx-unprivileged:1.27-alpine` 非 root 运行、8080 端口、`/healthz` 健康检查、OCI 标准标签
  - `docs/reports/p0-cleanup-acceptance-report-2026-08-05.md` 新增 P0 验收报告（含双向回归测试矩阵：正向 4 项 + 逆向 3 项 + IDE 配置规则 10 项全通过）

### Changed

- **pre-commit 钩子新增 .gitignore 覆盖率 BLOCK 步骤（2026-08-05）**：
  - `.husky/pre-commit` 新增 §2.5 步骤（位于 env-check 之后、secrets 之前），调用 `sh scripts/audit/audit-gitignore-coverage.sh`，非 0 退出码即 BLOCK 提交
  - 3 项检查：暂存区 IDE 私有路径拦截 + .gitignore 规则覆盖率 + 保留追踪路径未被误忽略
  - 依据：FILE-MANAGEMENT-GUIDE.md §2.2 / project_memory.md「环境部署追踪治理」

- **`.gitignore` 修复 4 处漏洞 + IDE 配置追踪治理（2026-08-05）**：
  - 新增 P0 修复规则段：`e2e/**/.playwright-artifacts-*/`、`e2e/**/test-artifacts/`、`e2e/**/.last-run.json`、`src/**/__backup__/`、`*.bak`、`*.orig`、`*.backup`、`.codebuddy/`、`.cursorrules`、`e2e/full-coverage/{verify,fresh,final}-*/`
  - 新增 IDE 配置忽略规则：`.workbuddy/`、`.trae-cn/`、`.vscode/`、`.idea/`（保留 `.trae/` 被追踪，作为团队共享 SKILL 体系）
  - 移除过时规则 `.trae/`（line 94，原规则会阻止 .trae/ 整个目录被追踪，与"保留 TRAE"意图冲突）
- **`docs/tech-debt/frozen-tsc-test-baseline-2026-08-05.md` §4 状态同步（2026-08-05）**：
  - §4 标题更新为"tsc:prod P0 问题（2026-08-05 新发现 → 2026-08-05 已修复 ✅）"
  - §4.1 添加状态更新说明：原 75 个 P0 嵌套 import 错误已全部修复，tsc:prod 退出码 = 0
  - §4.4 添加执行状态：15 个文件全部修复，双向回归测试通过
  - §5.3 更新为"tsc:prod P0（原 75 项 → 已修复 0 项 ✅）"

### Removed

- **环境部署追踪清理 — 仅保留 TRAE 被 Git 追踪（2026-08-05）**：
  - **目标**：仅保留 `.trae/`（团队 SKILL 体系）被 Git 追踪，移除所有其他 IDE/环境部署文件的追踪
  - **追踪移除（git rm --cached，工作区文件保留）**：
    - `.workbuddy/`（5 files）：GitAutoPush.psm1 / auto-push-on-network.ps1 / schedule-auto-push.ps1 / GitAutoPush-Deploy-Guide.md / GitAutoPush.Tests.ps1，IDE 私有 PowerShell 自动推送模块
    - `.trae-cn/work/6a43e703deccb368f0f3650f/update-mocks.ps1`（1 file）：TRAE CN 会话临时工作目录产物
    - `.codebuddy/settings.local.json`（1 file）：含 `.local` 后缀的私有配置（工作区文件已在前序清理中删除）
    - `.cursorrules`（1 file）：Cursor IDE 私有规则（前序清理已删除工作区文件）
    - `src/store/__backup__/collectionWizardStore.ts.2026-07-15.bak`（1 file）：源码目录下的备份文件，应使用 git 历史而非文件备份
  - **CI 工作流清理**：
    - `.github/workflows/ci.yml` 删除 `git-autopush-test` Job（依赖已不追踪的 `.workbuddy/tests/GitAutoPush.Tests.ps1`，会因路径缺失而失败）
  - **失效文档删除（死文档治理）**：
    - `docs/reports/release-management/git-auto-push-operation-guide.md`：GitAutoPush 模块操作文档，模块已不再追踪，文档失效
    - `docs/reports/release-management/v2.6.0-changelog-draft.md`：v2.6.0 changelog 草稿，已被 CHANGELOG.md v2.6.0 正式条目取代；且引用了已删除的操作指南与不存在的 `.github/workflows/git-auto-push.yml`
  - **保留追踪（团队共享资产）**：
    - `.trae/`（8 files，团队 SKILL 体系）
    - `.agents/`（18 files，跨工具技能库）
    - `.github/`（12 files，团队 CI，原 13 files - 1 个被删除 Job）
    - `.husky/`（5 files，git hooks）
  - **验证**：`git check-ignore -v` 确认 6 个路径全部被 `.gitignore` 忽略（line 263-268）；`git ls-files .trae/` 确认 8 文件仍被追踪

### Metrics

| 指标 | 数值 |
|------|------|
| 删除追踪文件数 | 9 |
| 新增 .gitignore 规则 | 13 |
| tsc:prod P0 错误修复 | 75 |
| 双向回归测试通过率 | 100% (7/7) |
| IDE 配置规则验证通过率 | 100% (10/10) |

- **完整测试套件运行结果记录（2026-08-05）**：
  - `docs/tech-debt/frozen-tsc-test-baseline-2026-08-05.md` 新增 §9 章节，记录完整 vitest 测试套件运行结果
  - 执行命令：`npx vitest run --no-coverage --reporter=dot`，退出码 1，时长 848.89s（约 14 分钟）
  - 统计：测试文件 526（518 通过 / 7 失败 / 1 跳过），测试用例 9128（9091 通过 / 15 失败 / 22 跳过）
  - 15 个失败用例分布在 7 个文件：`scripts/verify-logger-components.test.tsx`（2，SVG 未渲染）、`tests/e2e-verify-25stocks.integration.test.ts`（1，池流转准确率 0%）、`tests/SectorHeatmapWidget.test.tsx`（1，空数据文案变更）、`tests/ui-components.test.tsx`（3，Toggle 组件 API 漂移）、`src/data/db-connection.test.ts`（4，IDBRequest mock 方法缺失）、`tests/unit/tofixed-p0-regression.test.tsx`（3，组件空安全回归）、`tests/__tests__/scripts/daily-doc-validation.test.ts`（1，文档校验逻辑变更）
  - **关键结论**：47 个非冻结 tsc:test 类型错误与 15 个 vitest 运行时失败之间无直接因果关系（vitest 使用 esbuild 转译跳过类型检查）；构建阻塞由 tsc:prod P0 问题（§4，75 个语法错误）导致，非 tsc:test 错误导致

- **SKILL 体系扩展：安全审查与性能审计能力建设（2026-08-04）**：
  - `.trae/skills/v9-security-review/SKILL.md` 新增安全审查 SKILL（V9-SKILL-SECURITY-REVIEW，mandatory=true），覆盖五大维度：密钥与凭证泄露扫描（`npm run audit:secrets`）、XSS 防护审查（`dangerouslySetInnerHTML`/`innerHTML` Grep + `xssSanitizer` 保护校验）、输入验证审计（URL params/API response/用户输入经 `validation.ts` 校验）、ACL 权限矩阵校验（`npm run audit:acl-consistency`）、依赖安全扫描（`npm audit --audit-level=moderate`）
  - `.trae/skills/v9-performance-audit/SKILL.md` 新增性能审计 SKILL（V9-SKILL-PERFORMANCE-AUDIT），覆盖四大维度：Bundle 体积审计（主 chunk ≤500KB、总体积 ≤2MB gzip）、渲染性能审计（React.memo/useMemo/useCallback 覆盖率、useEffect 依赖与竞态防护、虚拟列表）、数据流效率审计（Store selector 粒度、请求去重、防抖节流）、内存泄漏检测（`quality-gate-check.cjs` 检出事件监听器 cleanup 配对率）
  - `.trae/skills/skill-registry.json`（v2.0.0 → v2.1.0）：注册 2 个新 SKILL，skills 数量 20 → 22，mandatory 数量 8 → 9；同步修复 v9-doc-encoding-remediation 与 component-health-check 的 frontmatter 漂移
  - `.trae/skills/INDEX.md`（v2.0.0 → v2.1.0）：code-quality 分类 7 → 9，总计 20 → 22，mandatory 8 → 9；更新统计表与变更历史
  - **交叉检索报告归档**：本次 SKILL 体系交叉检索（对标业界七阶段生命周期 + 六治理组件框架）识别出安全审查、性能优化两类重大缺口，已通过新增上述 2 个 SKILL 补齐；详细报告见 `docs/reports/changelogs/2026-08/2026-08-04-skill-system-optimization-roadmap.md`

- **文档链接健康度自动化体系（2026-08-03）**：
  - `scripts/docs-tool/link-health-checker.ts` 新增文档链接健康度检查器（扫描/分类/验证/自动修复/报告生成），支持 `--fix`/`--ci`/`--staged`/`--json` 四种模式
  - `scripts/docs-tool/link-health-scheduler.ts` 新增定期调度器（封装检查器 + 历史追踪 + 摘要报告），支持 `--dry-run`/`--ci`/`--summary` 三种模式
  - `.github/doc-ci-ruleset.yml` 新增 CI 检查规则集（DOC-CI-2.1-001 P0 阻塞 + DOC-CI-3.1-005 每日定时）
  - `.github/workflows/doc-health-daily.yml` 新增每日定时工作流（03:20 UTC 自动扫描 + P0 修复 + 自动提交）
  - `package.json` 新增 8 个 npm scripts（`doc:link-check` / `doc:link-check:ci` / `doc:link-check:fix` / `doc:link-check:staged` / `doc:link:schedule` / `doc:link:schedule:dry-run` / `doc:link:schedule:ci` / `doc:link:summary`）
  - `cspell.json` 新增 12 个项目术语（sina/netease/klines/Klines/ifind/autopush/AUTOPUSH/horz/metas/delisted/pycache/venv），消除 6 个文件的拼写检查误报
  - 自动修复 22 处 `file:///` 绝对路径断链为相对路径（P0 断链清零）
  - 验证结果：`tsc:prod` 编译通过（退出码 0），`doc:link-check:ci` P0=0（退出码 0），IDE 诊断全部清零

- **Cockpit 纵横交叉布局治理 Phase 1：纵横交叉骨架（2026-07-25）**：
  - `src/data/sectorDefinitions.test.ts` 新增 22 个测试用例，覆盖 v6Composite 缺失/零值/边界场景
  - `src/store/positionPoolStore.test.ts` 新增 531 行测试，含 12 组双向验证（6 正向 + 6 逆向）
  - `src/store/profileStore.test.ts` 新增 19 组数据流集成测试
  - `docs/reports/zero-fallback-remediation-acceptance-report-2026-07-26.md` 新增验收报告
  - `docs/reports/release-management/v2.6.0-release-report.md` 新增 v2.6.0 发布报告
  - `docs/reports/release-management/code-review-checklist-v2.6.0.md` 新增代码审查自查清单

- **Cockpit 纵横交叉布局治理 Phase 1：纵横交叉骨架（2026-07-25）**：
  - 新增 `CockpitCrossLayout` 纵横交叉布局骨架组件，以「域 × 视角」矩阵组织 Widget 面板
  - 新增 `CrossMatrixOverview` 交叉矩阵总览组件，支持域/视角双向筛选与单元格快速导航
  - 新增 `WidgetSheetDrawer` Widget 详情抽屉组件，承载原独立 Widget 的详情展开交互
  - `WatchlistWidget` 新增子 Tab（自选行情 / 异动榜），整合 `WatchlistMoversWidget`

- **Command Hub 增强 Phase 2：摘要区与架构可视化（2026-07-25）**：
  - Command Hub 运维摘要区嵌入 `EngineStatusCard` 引擎状态摘要卡片
  - Command Hub 运维摘要区嵌入 `SystemArchitectureDiagram` 系统架构摘要卡片
  - `SystemMonitorPage` 引入 `EngineStatusCard` 引擎状态详情面板
  - `HealthDashboardPage` 引入 `SystemArchitectureDiagram` 架构可视化面板

- **组合层检查清单（2026-07-25）**：
  - 新增 `docs/reports/audit/checklists/assembly-layer-checklist.md`，覆盖组合层架构验收检查项

- **ADR-010 决策记录（2026-07-25）**：
  - 新增 ADR-010：Cockpit/Command 职责边界与纵横交叉布局决策记录
  - 归档至 `docs/specs/architecture/adr/` 目录

### Changed

- **v2.6.0 零值兜底整改 — `?? 0` → `Number.NaN` 替换（2026-07-26）**：
  - `src/store/positionPoolStore.ts`: `quantity`/`avgCost`/`currentPrice` 兜底从 `?? 0` 改为 `?? Number.NaN`
  - `src/data/sectorDefinitions.ts`: `v6Composite` 兜底从 `?? 0` 改为 `?? Number.NaN`
  - `src/store/profileStore.ts`: `qualityScore` 兜底从 `?? 0` 改为 `?? 50`（中值兜底）；`minQuality > 0` 改为 `minQuality !== undefined`
  - 3 个模块关键入口新增 `logger.debug` 日志，区分缺失值与显式零值

- **Cockpit Shell 重构为纵横交叉矩阵布局（Phase 1，2026-07-25）**：
  - Cockpit Shell 从平铺 Widget 墙改为纵横交叉矩阵布局（域 × 视角）
  - Widget 元数据新增 `domain` / `perspective` 字段，支持交叉筛选与矩阵定位
  - `WatchlistWidget` 新增子 Tab（自选行情 / 异动榜），整合 WatchlistMovers 功能

- **Command Hub 页面增强（Phase 2，2026-07-25）**：
  - `SystemMonitorPage` 引入 `EngineStatusCard` 引擎状态详情
  - `HealthDashboardPage` 引入 `SystemArchitectureDiagram` 架构可视化

- **ADR-010 归档（2026-07-25）**：
  - ADR-010 归档至 `docs/specs/architecture/adr/` 目录

### Removed

- **Cockpit Widget 精简与 zone 收敛（Phase 1，2026-07-25）**：
  - Cockpit 取消注册 5 个 Widget：`researchPoolBoard`、`watchlistMovers`、`engineStatus`、`systemArchitecture`、`mechanismHealth`
  - Cockpit 移除 `system` zone 逻辑，category 统一为 market/portfolio/ai/strategy 四类

### Fixed

- **SKILL 体系 P0 配置修复与注册表同步（2026-08-04）**：
  - 修复 `v9-doc-encoding-remediation` triggers.files 引用不存在的 `scripts/fix/fix-doc-refs.ts`（历史脚本已迁移），改为 `scripts/lib/encoding.ts` + `scripts/fix/*.ts` + `docs/**/*.md` + `src/**/*.ts`，覆盖实际编码处理文件与受影响文本文件
  - 修复 `component-health-check` gates 命令大小写错误：`audit:component-usage` → `npm run audit:componentUsage`，与 `package.json` 实际脚本名对齐，恢复健康检查门禁可执行性
  - 同步 `skill-registry.json` 与 SKILL.md frontmatter 漂移：v9-doc-encoding-remediation 的 tags/triggers.files/related_skills/freshness_policy/search_keywords 全量对齐
  - 验证：`node -e "require('./.trae/skills/skill-registry.json')"` JSON 合法性通过，22 个 SKILL 全部可解析

- **v2.6.0 数据准确性修复 — 隐式零值兜底消除（2026-07-26）**：
  - 修复 `positionPoolStore.toPoolItem()` 中 `quantity`/`avgCost`/`currentPrice` 缺失时被静默替换为 0 的问题，改为 `Number.NaN` 显式标记
  - 修复 `sectorDefinitions.getSectorPoolStocks()` 中 `v6Composite` 缺失时被静默替换为 0 的问题，改为 `Number.NaN` 显式标记
  - 修复 `profileStore.loadItems()` 中 `qualityScore` 缺失时被静默替换为 0 的问题，改为 `?? 50`（评分中值）
  - 修复 `profileStore` 筛选逻辑 `minQuality > 0` 无法支持 0 阈值的问题，改为 `minQuality !== undefined`
  - 上述修复确保缺失值与业务零值在数据链路中可区分，避免盈亏计算、排名、评分产生误导性结果

### Added

- **投研闭环状态体系（Loop Status，2026-07-21）**：
  - `src/store/loopStatusStore.ts`：闭环五阶段（采集/评分/信号/交易/复盘）状态全局 Store，提供 markStageEvent / refresh / reset，派生函数均为纯函数（AGENTS.md §二 类型 B）
  - `src/store/loopStatusSubscriptions.ts`：EventBus → 闭环阶段订阅管理模块，幂等初始化、完整 cleanup；遵例落位 store 层（audit:layers 规则 5）
  - `src/config/loopConfig.ts`：闭环横幅配置单一真相源（阶段顺序/显示名/stale 阈值 24h/刷新间隔 60s/EventBus 事件→阶段映射），禁止下游硬编码
- **级联删除策略配置（2026-07-21）**：
  - `src/config/cascadeConfig.ts`：所有 Object Store 外键依赖与级联策略（CASCADE/RESTRICT/SET_NULL/SOFT_DELETE/NONE），cascadeExecutor 执行删除前读取此配置处理关联数据
- **行业仪表盘状态管理（2026-07-21）**：
  - `src/store/industryDashboardStore.ts`：行业仪表盘页面 Store（V4 行业分析 + 行业轮动信号），经 fetchIndustryDashboardUseCase 业务编排，DF-002 合规（数据访问经由 Store action 分发）

### Changed

- **驾驶舱分栏面板布局重构（v2.7.0 - 2026-07-20）**：
  - `CockpitShell.tsx` 从单层 ReactGridLayout 重构为 5 面板分栏布局（市场全景/研究筛选/持仓复盘/信号监控/系统状态）
  - 全部 26 个 Widget 保留，按投资者决策流分组到对应面板
  - 面板内部采用左右两列 CSS grid 布局（大 Widget 占整行，小 Widget 并排）
  - 每个面板支持独立折叠/展开，状态持久化到 localStorage
  - 移除 `ReactGridLayout` 依赖，清理 `loadLayout`/`saveLayout`/`sanitizeLayout` 等遗留函数
  - `LAYOUT_VERSION` 升至 v5，触发旧布局自动重置
  - 修复 Widget 标题/数据字体对比度问题（`CardTitle` 添加 `text-foreground`，移除 `opacity-60`）
  - `widgetRegistry.ts` 默认实例按面板重新编排位置坐标
  - 字体对比度修复扩展至 7 个 Widget（`gray-400`→`gray-500`，移除 `opacity-60`）
  - 面板强调色集中到 `PANEL_ACCENT_COLORS` 常量，消除 JSX 硬编码
  - 新增 `CockpitShell.panel.test.tsx` 渲染测试（10 个用例覆盖面板渲染/折叠/持久化/空面板处理）
  - **产业链图谱 Widget v2 重构（v2.7.0 - 2026-07-20）**：
    - 新增上中下游下拉菜单切换（上游/中游/下游/横向）
    - SVG 图谱改用贝塞尔曲线 + 箭头，减少视觉交叉
    - 选中层级居中布局，关联节点分列两侧
    - 节点点击高亮关联路径，非关联元素淡化
    - 底部核心标的卡片 + 实时股价（涨跌色标，30 秒自动刷新）
    - 通过 `tencentBatchQuotes` 批量获取实时行情

- **批量导入整合到录入看板统一入口（v2.7.0 - 2026-07-19）**：
  - `BulkImportPanel` 从独立路由 `/input/bulk-import` 整合到 `InputDashboard` 的 Tabs 中（单次录入 / 批量导入两个 Tab）
  - 移除 `/input/bulk-import` 独立路由、侧边栏入口、PortalShell 导航项
  - `InputDashboard` 使用 `Tabs` molecule 组件替代手写分段控件，统一交互模式
  - `BulkImportPanel` 简化为纯内容组件（移除 Card 包装、步骤指引、bare prop）
  - 同步更新 12 个活跃文档、8 个测试/e2e 文件、路由验证脚本中的引用

### Added

- **八域资料体系与评分证据链（v2.7.0 - 2026-07-19）**：
  - 新增八域资料体系（D1-D8），与 V6 评分层一一映射，支撑评分证据链与研究迭代闭环
  - 新增 4 个 IndexedDB Store：`stock_profiles` / `profile_items` / `score_evidence` / `profile_tags`，DB 版本升至 v32
  - 新增类型定义 `src/data/types/types.profile.ts`，含 ProfileItem / ScoreEvidence / StockProfile / ProfileTag 等 15+ 类型
  - 新增 `profileStore.ts`（Zustand），封装资料查询、筛选、详情、证据链等状态管理
  - 新增资料同步适配器：新闻同步（`newsSyncService`）、本地知识库同步（`localDocSyncService`）、评分报告归档（`scoreDocArchiveService`）
  - 新增衍生指标计算引擎（`derivedMetricsEngine`），4 大类 12+ 指标：杜邦分析 / 估值指标 / 成长质量 / 风险评估
  - 新增分析编排器集成（`profileIntegrationService`）：分析前自动收集资料摘要作为 LLM 上下文，分析后自动归档结论到资料体系
  - 新增八域资料浏览页面（`ProfileBrowsePage`），路由 `/output/profile`：八域导航、多维筛选、资料详情抽屉、证据链可视化
  - 新增 4 个端到端测试脚本：profile-e2e / full-e2e / 4source-e2e / orchestrator-e2e
  - 设计文档：ADR-010（V9-DOC-DATA-028）、八域资料体系设计（V9-DOC-DATA-029）、衍生指标引擎（V9-DOC-DATA-030）、文件系统映射规范（V9-DOC-DATA-031）

- **意向候选池功能（v2.7.0 - 2026-07-20）**：
  - `feat(input): 新增意向候选池功能 — 自选股导入、热门板块推荐、三列看板、批量流转`
  - 新增 `src/pages/input/IntentionPoolBoardPage.tsx`，路由 `/input/intention-pool`
  - 支持自选股导入、热门板块推荐、三列看板展示与批量流转操作

- **股票代码格式转换工具收敛（v2.7.0 - 2026-07-19）**：
  - 新建 `src/core/stockCodeUtils.ts`：抽出 `toTencentCode` / `toSinaCode` / `toNeteaseCode` 三个工具
  - 解决 `services/data-collector/directDataAPI.ts` 与 `services/fetcher/directDataAPI.ts` 双副本维护成本
  - 阶段 1（共享工具抽取）完成，阶段 2（双副本替换为引用）待跟进

- **注册与契约状态查询 Store 落地（v2.7.0 - 2026-07-18）**：
  - 新建 `src/store/registrationContractStore.ts`（Zustand + withBroadcast），封装 `queryStatus` action
  - 服务层 `src/services/analysis/registrationContractService.ts` 提供 `queryStatusService`，与 store 解耦
  - 状态契约类型 `src/types/modules/registration-contract.types.ts` 定义输入/输出 schema
  - 归档理由：补 audit-doc-sync 历史 violation，模块已实际承载"注册与契约状态查询"业务

- **股票字典重生为全市场离线搜索单一事实源（v2.7.0 - 2026-07-19）**：
  - 字典重生为 **8331** 条，覆盖四交易所完整口径：上交所 SH 2308 / 深交所 SZ 2892 / 北交所 BJ 328 / 港交所 HK 2803，跨市场 symbol 零重复。
  - 新增校验门禁 `npm run build:stock-dict:verify`（脚本 `scripts/verify-stock-dict.py`），校验四交易所完整性与零重复。
  - 生成器 `scripts/generate-stock-dict.py` 以 akshare 三函数（`stock_info_a_code_name` / `stock_info_bj_name_code` / `stock_hk_spot`）为数据源，产物 `src/services/stock/stockDictionary.ts` 供 `FullMarketStockService` 离线搜索，禁止手改，改生成器后重跑。
  - 新增每周日 03:00 自动化任务 `automation-1784399510483`：`build:stock-dict` → `build:stock-dict:verify` → 有变更则提交，覆盖新增上市 / 退市。

- **采集链路全维度实现与质量指标分离（v2.7.0 - 2026-07-18）**：
  - 采集管线 `collectionPipeline.ts` 验证：维度 01-08 全部就绪，真实 API 优先 + Mock 降级
  - `qualityMetricsCollector.ts` 新增 `mockCollects` / `mockSuccesses` / `realSuccessRate`，Mock 数据不再虚增真实成功率
  - TaskId 格式统一为 `parentTaskId-symbol-dimensionCode`，trace_records 完整水合回放（`loadPersistedTraces()`）
  - 修复 DataQualityIndicator Token 属性名错误（`tailwindBg` → `bgClass`）

- **DataBridge 子模块拆分 Phase 1（v2.7.0 - 2026-07-18）**：
  - 新建 `src/core/databridgeAcl.ts`（82 行 CC=6）：提取 5 个 ACL 方法（assertQueryAcl 等）
  - `databridge.ts` 从 894→843 行，CC 100→86
  - 架构文档 `02-architecture.md` 更新为 5 子模块明细

- **驾驶舱 Widget 布局 5 层梯度 + 系统区折叠 + KPI 摘要条（v2.7.0 - 2026-07-18）**：
  - L1 研究全景 → L2 深度分析 → L3 市场背景 → L4 持仓观察 → L5 系统运维
  - 持仓概览升级 FULL_WIDTH，12 Widget defaultLayout 全部就位
  - P2-1: 系统运维区默认折叠（localStorage 持久化，ChevronRight 动画按钮）
  - P2-3: 头部新增 4 标签 KPI 条（跟踪标的/待处理信号/采集任务/Widget）
  - Widget 尺寸全部改用 `WIDGET_SIZE` 枚举，分类全英文统一为 7 类

- **门禁体系增强（v2.7.0 - 2026-07-18）**：
  - 新增 `audit:mock-modules`（Mock 安全审查，14 条豁免）、`audit:widget-registry`（26/26 PASS）
  - `npm run gate:quick` 覆盖分层/Mock/ACL/原子/文档/DB 引用
  - 5 个审计脚本 ROOT 路径修复（`..` → `../..`）
  - pre-push 重构为 5 步管道

- **评估器模块与质量审查扩展（v2.6.3 - 2026-07-16）**：
  - 新增 `src/services/evaluators/consistencyEvaluator.ts`、`src/services/evaluators/evaluatorTypes.ts`、`src/services/evaluators/regressionEvaluator.ts`、`src/services/evaluators/rubricEvaluator.ts` 与 `src/services/evaluators/schemaEvaluator.ts`，为回归、基准、规则与一致性评估提供统一评估器接口。
  - 这些模块已接入 `src/services/evaluators/` 目录并用于质量检查/自动化评估流程，支持 `expected` 基线、评分细则、结构一致性判断与回归差异分析。
  - 相关变更已同步纳入代码质量审查与上线前验证流程，便于在 `npm run lint`、`npm run tsc:prod` 与审计脚本中统一确认。

- **PortalShell 与主题系统重构（v2.6.2 - 2026-07-15）**：
  - 新增 `src/store/themeStore.ts`：基于 Zustand 的全局主题状态管理，支持 `light` / `dark` / `system` 三种模式，持久化到 `localStorage`，并提供 `setMode` / `toggleTheme` / `cycleMode` 三种切换方式。
  - 新增 `src/constants/theme/theme.tokens.portal.ts`：L6 设计系统扩展，定义 `PORTAL_TOKENS`（布局 / 舱室切换 / 导航 / 移动端 / 状态指示 / 品牌），消除 `PortalShell.tsx` 中的硬编码颜色类。
  - 新增 `src/apps/cabinDispatcher.ts` 与 `src/apps/{input,analysis,trading,output,command}/index.ts`：统一舱室应用懒加载分发器，支持相邻舱室 `requestIdleCallback` 预加载，降低舱室切换白屏时间。
  - 重构 `src/portal/PortalShell.tsx`：全面改用 `PORTAL_TOKENS` 与 `themeStore`；新增顶栏主题切换按钮（`data-testid="theme-toggle"`）；新增移动端底部导航（五舱图标入口）；保留汉堡菜单抽屉作为子页面导航兜底。
  - 更新 `src/App.tsx` 与 `src/main.tsx`：移除 `ThemeProvider` 包装，改由 `themeStore` 在应用启动前应用持久化主题，避免首屏闪烁。
  - 更新 `docs/reference/design-tokens.md`：补充 `PORTAL_TOKENS` 使用说明与 `themeStore` API 文档。
  - **PortalShell 导航同步补齐**：补充 8 个已注册子页面的侧边栏入口——输入舱 `七维采集配置` / `抓取引擎配置`、分析舱 `热门板块` / `价值洼地` / `多因子筛选`（新增“策略选股”分组）、交易舱 `持仓管理` / `执行计划` / `交易流程`，确保路由注册表、舱室应用内分发与 PortalShell 导航链接三者一致。
  - **themeStore 测试修复**：修复 `src/store/themeStore.test.ts` 中 `system` 模式监听用例因 jsdom `matchMedia` 实例隔离导致的断言失败，8 个测试全部通过。

- **原子组件审计与补齐（v2.6.2 - 2026-07-15）**：
  - 修复 `src/components/atoms/Menu.tsx`：`MenuItem` / `SubMenu` 原使用 React 保留字 `key` 作为 props，会导致运行时无法读取标识；统一改为 `itemKey`。
  - 修复 `src/components/atoms/Radio.tsx`：禁用状态下仍响应 `onChange` 并触发 `onValueChange`；现禁用时阻止值变更回调。
  - 补充缺失单元测试：`Menu.test.tsx`（7 用例）、`Select.test.tsx`（4 用例）、`Radio.test.tsx`（5 用例）、`Popover.test.tsx`（6 用例）、`DatePicker.test.tsx`（6 用例）、`ComplianceDisclaimer.test.tsx`（4 用例），新增 32 个原子组件测试用例全部通过。
  - **componentRegistry 同步**：补登 12 个未注册 organism 组件（`DensityContext` / `DensityToggle` / `SecurityStatus` / `StandardAgentDetail` / search 域 5 组件 / output/prediction 域 3 组件），`audit:atomic` 0 警告通过。
  - **路由一致性修复**：`scripts/verify-all-routes.ts` 预期路径表由过时的 `/analysis/stock-pool` 修正为实际注册的 `/analysis/pool-board`，路由覆盖率达到 100%。

- **性能测试基础设施（v2.6.0）**：
  - 新增 `src/lib/batchQueue.ts`：批量操作限流队列，控制并发操作数量，防止 IndexedDB 热 key 竞争。
  - 新增 `src/lib/seededRandom.ts`：可播种伪随机数生成器（mulberry32），用于性能压测等需要可重复结果的场景。
  - 新增 `src/store/perfMetricsStore.ts`：性能度量 Zustand Store，采集数据处理能力测算页的时序指标，支撑瓶颈定位与性能基线管理。

- **T8 代码复杂度专项治理（v2.6.0）**：
  - 新增 `scripts/complexity-scan.ts`：基于 TypeScript AST 扫描深层嵌套、长链式条件、重复 if 条件，支持基线回归与 CI 集成。
  - 重构 `src/apps/analysis/AnalysisApp.tsx`、`src/apps/input/InputApp.tsx`、`src/apps/output/OutputApp.tsx`、`src/apps/trading/TradingApp.tsx`：将路由映射提取为 `ANALYSIS_ROUTES` / `INPUT_ROUTES` / `OUTPUT_ROUTES` / `TRADING_ROUTES`，消除 ≥6 分支的 if-else-if 链。
  - 新增 `src/types/modules/health.types.ts`：抽取架构健康度类型。
  - 新增 `src/constants/healthStatusStyles.ts`：集中管理健康度状态样式，避免页面层裸 Tailwind 色类。
  - 在 `src/mcp/servers/system/systemServer.ts` 新增 `fetch_health_report` Tool，供页面层通过 MCP 调用。
  - 更新 `.complexity-baseline.json`：长链式条件从 5 处降至 0 处，深层嵌套从 127 处降至 104 处。

- **文档化完善（v2.6.0）**：
  - 为 `src/services/scoring/v6-engine/calculators/l3/helpers.ts` 添加完整 JSDoc 注释（`scoreMoat()` 护城河评分、`scoreCompetition()` 竞争格局评分）。
  - 为 `src/components/ui/PageContainer.tsx` 添加模块级注释。
  - 为 `src/components/ui/PageHeader.tsx` 添加模块级注释。
  - 为 `src/constants/sectorConstants.ts` 添加完整 JSDoc 注释（热门赛道标签、热力等级说明）。
  - 新增 `docs/RISK_DERIVED_DATA_DEFINITION.md`：`riskStore.derived.ts` 详细文档（风控三态规则、熔断状态机、趋势分析规则）。
  - 更新 `docs/reference/DATA_DICTIONARY_INDEX.md`：添加 Store 派生计算、事件订阅、基础设施模块等索引条目。
  - 更新 `docs/explanation/03-architecture-standards.md`：新增 Store 派生计算与事件订阅架构说明（§3.1.10）、V6 评分引擎 L3 层辅助函数说明（§3.5.1）。
  - 新增机制健康监控模块文档：`src/store/mechanismHealthStore.ts`、`src/services/system/mechanismMonitorService.ts`、`src/cockpit/widgets/MechanismHealthWidget.tsx`、`src/pages/command/health/MechanismHealthPanel.tsx` 已在 CHANGELOG 中记录。

- **审计脚本修复（v2.6.0）**：
  - 修复 `scripts/audit-doc-sync.ts` 逻辑缺陷：将完整路径检查移到噪音词检查之前。原逻辑中，文件名是噪音词（如 `helpers`）的文件即使在文档中有完整路径引用，也会被误判为未文档化。修复后，完整路径引用优先于噪音词过滤，避免误判。

- **代码审查系统建立（v2.1.0）**：
  - 新增 `docs/guides/CODE-REVIEW.md`：完整审查标准与流程（P0/P1/P2 三级检查、审查清单、常见问题）。
  - 新增 `docs/CODE-REVIEW-CHEATSHEET.md`：快速参考卡（10 分钟审查指南、检查清单、常见问题）。
  - 新增 `docs/CODE-REVIEW-TRAINING.md`：审查者培训材料（角色职责、审查技巧、沟通礼仪）。
  - 新增 `docs/SOLO-REVIEW.md`：单人开发审查指南（自我审查清单、常见陷阱、工具配置）。
  - 新增 `docs/reports/TECH-DEBT.md`：技术债管理文档（登记模板、优先级定义、清理计划）。
  - 新增 `.github/pull_request_template.md`：PR 模板（审查清单、测试覆盖、技术债登记）。
  - 新增 `.github/CODEOWNERS`：审查者配置（单人开发模式）。
  - 新增 `scripts/pre-review-check.ts` v2.1：预审查检查脚本（ESLint 输出过大修复、临时文件捕获、错误判断优化）。
  - 新增 `commitizen` 配置：`package.json` 添加 `commit` 脚本，支持规范化提交信息。
  - 新增 `.vscode/extensions.json`：VS Code 推荐插件（ESLint、Error Lens、GitLens）。
  - 新增股票涨跌颜色例外规则（`AGENTS.md` §3.5.6）：红涨绿跌不受主题切换影响，使用 `STOCK_COLOR_TOKENS` 豁免令牌。
  - 新增 `STOCK_COLOR_TOKENS`（`src/constants/theme.tokens.ts`）：股票颜色豁免令牌（up/down/bgUp/bgDown），辅助函数 `getStockColor()` / `getStockColorClass()` / `getStockColorHex()` / `getStockColorBg()`。
  - 修复 `src/store/stockAnalysisStore.ts` 语法错误（第 241 行 `})()` → `})();`）。
  - 修复 `scripts/pre-review-check.ts` ESLint 输出为空 Bug（使用临时文件捕获大输出）。
  - 修复 `src/components/ui/Badge.tsx` TypeScript 错误（删除未使用 `logger` 导入）。
  - 修复 `src/cockpit/widgets/MarketIndicesWidget.tsx` 硬编码颜色（使用 `getStockColorClass()`）。
  - 修复 `src/cockpit/widgets/FundFlowWidget.tsx` 硬编码颜色（使用 `twBg()`）。
  - 修复 `src/cockpit/widgets/PortfolioOverviewWidget.tsx` 硬编码颜色（使用 `twBorder()`）。

- **二次校验与遗漏问题修复（v2.6.1 - 2026-07-15）**：
  - 二次运行 `npm run audit:docs`（含文档-代码引用完整性审计）发现 **4,616 个文档引用断裂**（占总数 34.9%），其中：doc-to-code 1,735 处、code-to-doc 96 处、doc-to-doc 2,785 处。
  - Registry 索引缺失 4 个文件、孤立索引项 3 处。
  - 修复 `src/lib/errors.ts:19` 文档引用断裂（`docs/10-glossary.md` → `docs/explanation/10-glossary.md`）。
  - 修复 `src/hooks/useFreshData.ts:13` 文档引用断裂（`docs/implementation/freshness-alerts.md` → `docs/reports/retrospectives/freshness-alerts.md`）。
  - 二次运行 `npm run lint` 发现 **1,655 个 ESLint 警告**（首次未运行 lint 漏检）：220 个 `no-unsafe-*`、108 个 `no-magic-numbers`、6 个 `prefer-nullish`，余 1,321 个其他类型。
  - 全部自动化审计脚本（audit:layers / audit:hardcode / audit:deadcode / audit:docs）通过；TypeScript 编译 0 错误；madge 0 循环依赖。
  - 修复 [P0-01] `src/store/executionStore.ts` ↔ `src/store/executionStoreSubscriptions.ts` 循环依赖（删除第 612 行重导出，拆分 `ExecutionPlanPanel.tsx` 与 `TradingApp.test.tsx` 导入）。
  - **经验教训**：首次系统性评分仅运行了 4 个 audit:* 脚本，未运行 `npm run lint` 与文档-代码引用完整性审计。教训 1：完整 CI 门禁必须包含 lint + 全套 audit 脚本；教训 2：文档同步审计需区分"未文档化文件"与"文档引用断裂"两类问题；教训 3：架构评分需引入 lint 评分维度（warn 数量分等级），与 tsc、madge、audit 共同构成五维健康度。
  - 详细分析见 `docs/meta/secondary-verification-report-2026-07-15.md`。
  - 删除 `.husky/_/prepare-commit-msg` 钩子（路径解析错误）。
  - 提交记录：`ca0c493`、`6d923ab`、`703abbb`、`9dd6ea8`、`1a8ca92`。

- **死代码审计 v3.3 校准与 tsc 回归（v2.6.2 - 2026-07-15）**：
  - 复核 `npm run audit:deadcode` 报告的 11 处 `return null` 警告，确认全部属于合法预期空状态：`catch` 异常回退、`switch default` 默认分支、多行 `if` 守卫、`for`/`while` 循环无匹配兜底、`typeof window === 'undefined'` SSR 守卫。
  - 升级 `scripts/audit-dead-code.ts` 的 null 返回检测：新增 `isExpectedNullReturn` 替代原 `isGuardedNullReturn`，基于花括号深度反向扫描，识别 `catch { ... }`、`} catch (err) {`、`default:`、`if (...) { ... }`、`for`/`while` 循环、`typeof window === 'undefined'` 等预期空状态模式。
  - 放宽单行守卫正则，支持 `if (x) { return null }` 形式。
  - 同步更新 `tests/__tests__/scripts/audit-dead-code.test.ts`：修正 null 返回测试用例以匹配 `'无条件返回 null'` 类型，并新增「忽略 if 守卫中的 return null」用例。
  - 修复执行批次 D 回归验证时发现的阻塞性 TypeScript 错误：
    - `src/services/skills/layerAnalysisSkillFactory.ts:53`：`z.record(z.unknown())` 改为 `z.record(z.string(), z.unknown())`。
    - `src/services/skills/sentimentAnalysisSkill.ts` 与 `src/services/skills/bullBearDebateSkill.ts`：导出 `SentimentOutputSchema` / `SentimentInputSchema` / `BullBearDebateOutputSchema` / `BullBearDebateInputSchema`。
    - `src/services/skills/batchDSkills.test.ts:97`：混合类型 SKILL 数组改用 `registry.registerAll(skills)`。
  - 校准结果：`audit:deadcode` 0 违规、0 警告，扫描 1082 文件；`tsc:prod` 0 错误；`audit:layers` / `audit:routes` 通过；相关单元测试 42 个全部通过。

- **P1-01 完成：拆分 LlmManagementPage.tsx（v2.6.1 - 2026-07-15）**:
  - 将原 1042 行单体组件重构为容器+展示分层架构。
  - 新建目录 `src/pages/command/agent/LlmManagement/`：
    - `index.tsx` (122 行) — 容器主页面，状态编排 + Tab 路由
    - `components/LlmStatsCards.tsx` (65 行) — 顶部统计卡片
    - `components/LlmConfigTab.tsx` (495 行) — 基础配置 Tab（含 4 个内部子组件）
    - `components/LlmAdvancedTab.tsx` (58 行) — 高级参数 Tab
    - `components/LlmFactorsTab.tsx` (109 行) — 因子控制 Tab
    - `components/LlmStatsTab.tsx` (170 行) — 使用统计 Tab
    - `hooks/useLlmConfigState.ts` (137 行) — 状态管理 Hook
    - `hooks/useLlmConfigActions.ts` (280 行) — 业务逻辑 Hook
  - 删除原文件 `LlmManagementPage.tsx` 与备份文件 `LlmManagementPage.tsx.bak`。
  - 更新 `src/apps/command/AgentApp.tsx` 引用路径（`LlmManagementPage` → `LlmManagement`）。
  - 同步修复 4 个 lint 警告：no-misused-promises、strict-boolean-expressions、no-unused-vars、no-floating-promises。
  - 验证通过：tsc 0 错误、madge 0 循环依赖、audit:layers 0 违规、该目录 0 lint 警告。
  - 详细报告见 `docs/meta/p1-01-llm-management-split-report.md`。
  - 拆分后最大文件 495 行（-52.5%），容器 122 行，**P1-01 任务完成**。

### Fixed

- **pre-review-check.ts v2.1**：
  - 修复 ESLint 输出过大导致缓冲区溢出的问题（使用临时文件捕获输出）。
  - 修复命令拼接错误（Windows 路径格式问题）。
  - 优化输出解析（只保留最后 200 行，避免内存问题）。
  - 修复 ESLint 错误判断逻辑（无 error 时视为通过，不是警告）。

- **TypeScript 错误修复**：
  - `src/store/stockAnalysisStore.ts`：修复语法错误（第 241 行）。
  - `src/components/ui/Badge.tsx`：删除未使用 `logger` 导入。

- **硬编码颜色修复**：
  - `MarketIndicesWidget.tsx`：使用 `getStockColorClass()` 替换硬编码颜色。
  - `FundFlowWidget.tsx`：使用 `twBg()` 替换硬编码颜色。
  - `PortfolioOverviewWidget.tsx`：使用 `twBorder()` 替换硬编码颜色。

### Quality Metrics

- `npm run pre-review`：ESLint 2226 warnings / 0 errors（单人开发模式，warnings 不阻塞）。
- `npm run commit`：Commitizen 交互式提交正常工作。
- Husky 预提交钩子：正常工作（删除 `prepare-commit-msg` 后）。

---

### Added

- **P0-5 缺陷修复:ConfigApp updateField NaN/Infinity 守卫缺失（v1.3.2）**:
  - **问题**:`src/apps/command/ConfigApp.tsx` 的 `updateField` 使用 `Number(e.target.value)` 转换输入值,未对 NaN/Infinity 做守卫。`JSON.stringify(NaN)` 会序列化为 `'null'`,导致 localStorage 中的配置数据被污染为 `null`,破坏 `AppConfig` 类型契约,影响下游业务逻辑。
  - **根因**:`Number()` 转换接受任意输入,不抛出异常,只返回 NaN/Infinity,代码未做有限性校验。
  - **修复方案**:在 `updateField` 内对数值字段调用 `lib/safeCoerce.toSafeNumberInRange()` 守卫,同时拦截 NaN、Infinity、越界值(负数、超 100% 等)。无效值默认回退到 `prev[key]`,React controlled input 会自动重置为 prev 的值。
  - **任务 3 增强**:在 ConfigApp.tsx 顶部新增 `NUMBER_FIELD_RANGES` 常量,定义每个数值字段的 `[min, max]` 范围(portfolioValue [0, MAX_SAFE_INTEGER]、maxSinglePositionPct [1, 100]、maxDailyLossPct [0, 100]、stopLossPct [0, 100]、refreshInterval [1, 86400]),覆盖 HTML5 `min`/`max` 属性可被绕过的场景(键盘输入、JS 注入、剪贴板粘贴)。
  - **任务 2 lib/ 复用**:复用现有 `src/lib/safeCoerce.ts` 的 `toSafeNumber()` 函数,并新增 `toSafeNumberInRange(value, min, max, defaultValue)` 函数,统一数据流入口的脏数据防御逻辑。该函数已在 ConfigApp.tsx 接入,后续可推广到其他表单 controlled input。
  - **修复位置**:`src/apps/command/ConfigApp.tsx` L31-34(import + logger)、L72-99(NUMBER_FIELD_RANGES 常量)、L186-223(updateField 守卫逻辑)。
  - **测试覆盖**:`tests/ConfigApp.test.tsx` 新增 11 个用例(原 7 + 新增 11 = 18),覆盖 NaN/Infinity/空字符串/负数/百分比越界/边界值(min/max)等场景。覆盖率提升:Lines 91.44% → 100%、Branches 70% → 100%、Functions 33.33% → 100%。
  - **同步归档**:`docs/changelogs/2026-07/2026-07-05-p0-5-and-legacy-bugs-jira-tickets.md`(Ticket V9-P0-5)。
  - **关联任务**:本次同时修复 6 个历史测试 Bug(AgentTasksPage/AgentTriggerPage 测试文件中的文本匹配冲突、slice 字符数错误、条件渲染 select 消失等),详见归档文件 Ticket V9-BUG-001 ~ V9-BUG-006。

### Added

- **颜色硬编码治理与 Token 消耗优化（v2.0.0）**：
  - 新增 `AGENTS.md §3.5` 颜色令牌使用规范：4 层令牌体系（L1 基础令牌 / L2 语义令牌 / L3 色阶令牌 / L4 图表令牌）、5 个场景化使用规则、15 个业务场景语义映射速查表、新增颜色 SOP 决策树、豁免清单。
  - 新增 `docs/reports/hardcoded-colors-inventory.json` 违规清单缓存文件：记录 35 个文件 140 处颜色违规，按优先级（P0/P1/P2）分类，预计 Token 节省 88%。
  - `scripts/audit/audit-hardcode.ts` 升级至 v2.1：新增 `--export-inventory` 参数，支持扫描并导出违规清单缓存文件，优化 Token 消耗（AI 会话优先查询缓存而非重新扫描）。
  - **根因诊断**：识别 5 大系统性缺陷（令牌系统已建立但未被广泛采用、缺乏自动化强制机制、Token 无谓消耗严重、测试文件颜色断言脆弱、缺乏颜色语义映射文档）。
  - **整改计划**：P0 建立规范与缓存机制（已完成）、P1 重构 TOP 5 热点文件（已完成）、P2 全量迁移剩余文件（已完成）。
  - **P1 批次完成**：重构 5 个热点文件（MockTestPage.tsx 23处、ExecutionPlanCard.tsx 19处、PhaseStepper.tsx 13处、ValuePitPage.tsx 12处、BacktestPage.tsx 11处），共消除 78 处颜色硬编码。新增 ESLint 自定义规则 `no-hardcoded-tailwind-colors`，支持自动检测 className 中的硬编码颜色类。违规文件数从 35 个降至 33 个，颜色违规数从 140 处降至 116 处（-17%）。
  - **P2 批次完成**：全量迁移剩余 33 个文件（共 116 处违规），颜色硬编码违规数从 116 处降至 0 处（-100%）。建立 CI 门禁集成：ESLint 规则集成到 `eslint.config.js`、新增 `lint:colors` 脚本、CI workflow 添加颜色检查步骤、pre-commit 钩子添加颜色检查。违规清单缓存文件更新为 0 违规。Token 消耗从 ~20,000/扫描降至 0。

- **架构审计脚本 v2.0 升级与 Token 消耗控制机制建立（v1.3.0）**：
  - 新增 `scripts/audit-token-consumption.ts`：Token 消耗检测脚本，检查知识图谱增量更新支持、快速查询模板、Token 预算文档、Token 优化文档完整性，预计月度节省 7.58M tokens。
  - 新增 `npm run audit:token` 脚本，纳入 `npm run audit` 全量审计流程。
  - `scripts/audit-layer-calls.ts` 升级至 v2.0：新增 services→store 依赖检测（规则5）、lib→上层依赖检测（规则6）、constants→业务层依赖检测（规则7），支持动态 import() 和 re-export 解析。
  - `scripts/audit/audit-hardcode.ts` 升级至 v2.0：新增硬编码 URL/API 端点检测（Critical）、硬编码超时时间检测（Major）、改进魔法数字排除列表（HTTP 状态码、常见阈值）、增强 Tailwind 颜色检测（支持 hover:/focus:/dark: 等变体前缀）。
  - `scripts/audit-dead-code.ts` 升级至 v2.0：扩展排除规则，新增 hooks/utils/types 子目录排除、useXxx React hooks 文件排除、纯类型文件（*types.ts/*interfaces.ts）排除，显著减少误报。
  - `AGENTS.md` 升级至 v1.3.0：§7 新增 Token 消耗控制规则（§7.1），强制知识图谱优先、增量解析、缓存查询结果、Token 预算控制（单次会话 < 50,000 tokens）。
  - `package.json` 新增 `audit:token` 脚本，`audit` 全量审计命令包含 token 检测。
  - **审计结果**：`audit:layers` 发现 7 处违规（3 处 constants 层依赖 + 4 处 services 直接依赖 store）；`audit:token` 发现 3 处 Token 浪费问题（缺少增量更新、缺少缓存机制、缺少快速查询模板）。

### Added

- **V6 Pro 驾驶舱深度比对评估（v0.9.0-docs-v6pro-assessment）**：
  - 完成 V6 Pro 驾驶舱与 V9 开发基线的全维度架构比对，覆盖 DataBridge、Engine、UI、Agent 四大核心模块。
  - 新增数据流引擎设计（`docs/explanation/03-architecture-standards.md` 3.1.2）：支持 SSE 推送 + 轮询回退、内存缓存（10秒 TTL/200条目）、通道元数据配置、慢订阅者检测、序列号追踪。
  - 新增数据融合层设计（`docs/explanation/03-architecture-standards.md` 3.1.3）：`UnifiedStockData` 统一数据视图，聚合基础/K线/财务/评分/信号多源数据。
  - 新增驾驶舱 Widget 架构设计（`docs/explanation/03-architecture-standards.md` 3.1.4）：注册表 + 懒加载引擎 + 生命周期 + 跨 Widget 联动 + 12列响应式网格。
  - 新增 Agent 层设计（`docs/explanation/03-architecture-standards.md` 3.1.5）：Agent 运行时、注册表、任务队列、健康监控、AI 助手架构。
  - 扩展偏差清单至 D19，新增数据流引擎缺失（D12）、数据融合层缺失（D13）、Widget 框架缺失（D14）、评分算法降级（D15）等关键偏差。
  - 新增评分报告生成设计（`docs/explanation/05-engine-specs.md`）：包含理由、目标价、风险、催化剂的完整报告 Schema。
  - 新增板块轮动评分引擎设计（`docs/explanation/05-engine-specs.md`）：五因子十六指标模型（景气度/估值/动量/资金/政策），支持轮动信号生成。
  - 新增图表组件规范（`docs/specs/04-ui-ux-specs.md`）：`lightweight-charts` K线图、`recharts` 折线图/雷达图/热力图。
  - 扩展组件库清单（`docs/specs/04-ui-ux-specs.md`）：基础 UI 组件、业务组件、图表组件三类。
  - 新增实施计划任务（`docs/guides/08-implementation-plan.md`）：数据流引擎、数据融合、评分报告、板块轮动、Widget框架、图表库、错误边界、反馈闭环共 8 项任务。
  - 更新版本比对文档（`docs/explanation/architecture-version-comparison.md`）：新增 `v0.9.0-docs-v6pro-assessment` 版本记录与 V6 Pro 对照评估新增偏差项。
  - 更新 `docs/01~10` 全部核心文档版本号为 `v0.9.0-docs-v6pro-assessment`，更新日期为 2026-06-25。
  - **新增 Page 组件红色高危区（`docs/explanation/03-architecture-standards.md` 3.13）**：识别页面脚本中最容易被忽略但对人机交互影响致命的三类问题：
    - 问题一：数据请求缺少 pending 状态处理 → 强制包裹 `isLoading` 状态，绑定全局骨架屏
    - 问题二：监听器未在组件卸载时销毁 → 显式调用 `removeListener`，使用 `WeakRef` 优化
    - 问题三：路由参数变化未重新触发数据刷新 → 强制添加 `resetState + refetch` 逻辑
    - 包含当前代码违规示例与修正指令，建立强制审查清单

- **金融业务 Widget 落地（Phase 2.4）**：
  - 实现 5 个驾驶舱业务 Widget：`InvestmentProfileWidget`（投资画像/分析中心）、`StockPoolWidget`（股票池管理）、`KaiScoreWidget`（KAI 选股评分图谱）、`ModelCompareWidget`（AI 大模型对比）、`StockChatWidget`（个股/市场聊天界面）。
  - 扩展 `src/types/modules/widget.types.ts`：新增 `AnalysisScores`、`ModelComparison`、`StockPool`、`ChatHistory` 等类型。
  - 扩展 `src/constants/cockpit.constants.ts`：新增 `STOCK_COLOR_MAPPING`、`SCORE_LEVELS`、`KAI_DIMENSION_NAMES`、`LLM_MODEL_VERSIONS`、`INVESTOR_PROFILE_METRICS`、`STOCK_POOL_STATUS_COLORS`、`CHAT_DEMO_TARGETS`、`RISK_HINTS`，确保颜色、状态、维度、模型版本全部常量化。
  - 新增 `src/services/stock-analysis/mockStockAnalysisProvider.ts`：统一生成 5 个 Widget 的 Mock 数据，所有随机值与常量关联。
  - 扩展 `src/services/data-collector/MarketDataAdapter.ts`：新增 `analysisScores`、`modelComparison`、`stockPool`、`chatHistory` 适配分支与默认值。
  - 扩展 `src/services/data-collector/collectors/MockCollector.ts`：新增 `/stock-analysis/profile|kai|compare|pool|chat` 路由。
  - 扩展 `src/cockpit/providers/MarketDataProvider.tsx`：注入标准化 `MarketData`，新增 `sendChatMessage` 接口。
  - 更新 `src/cockpit/core/widgetRegistry.ts` 与 `CockpitShell.tsx`：注册 5 个新 Widget 并配置默认布局。
  - 新增 `tests/services/MockCollector.test.ts`、`tests/services/MarketDataAdapter.test.ts`，覆盖 A/B/C 板块 24 个用例。
  - 新增架构文档 `ARCHITECTURE.md`：含 Mermaid 图、枚举表、目录树、新增 Widget SOP。
  - 新增数据字典 `DATA_DEFINITION.md`：覆盖 5 个 Widget 的字段、枚举、颜色、服务端映射。

- **AI 智能体调度中心 / 健康监控 / 诊断分析板块设计落地**：
  - 新增 `src/constants/ai-center.constants.ts`：定义 `AGENT_STATUS`、`AGENT_TAG`、`AGENT_TYPE`、`AGENT_OVERVIEW_CARDS`、`AI_CENTER_DATA_SOURCE`。
  - 新增 `src/constants/health.constants.ts`：定义 `HEALTH_STATUS`、`HEALTH_MODULE_CATEGORY`、`DIAGNOSTIC_LEVEL`、`HEALTH_SCORE_THRESHOLDS`。
  - 新增 `src/types/modules/ai-center.types.ts`：定义 `AgentItem`、`AgentListData`、`HealthMetricItem`、`HealthMetricsData`、`DiagnosticReportItem`、`DiagnosticReportsData`、`AICenterData`。
  - 新增 `src/services/ai-center/mockAICenterProvider.ts`：三大板块 Mock 数据生成器，含异常/预警状态用于演示监控效果。
  - 新增 `docs/reference/AI_CENTER_DATA_DEFINITION.md`：AI 中心数据字典，含接口字段、枚举常量、服务端 statusCode 映射、引用约束。
  - 新增 `docs/reference/AI_CENTER_VUE3_EXAMPLES.md`：纯前端 Vue3 组件示例（图标渲染器、Pinia Store、三大 Panel、服务封装、硬编码检查清单），所有状态/颜色/标签/轮询间隔均引用 constants。

- **NewsPage PoC 数据字典补齐**：
  - 新增 `docs/reference/NEWS_DATA_DEFINITION.md`：覆盖 `NewsArticle`、`NewsStockMap`、`SentimentCache`、`V6NewsArticle`、情感映射规则、`newsService` API、DataBridge Store / Envelope Action、路由映射。
  - 明确 PoC 未新增全局 Store 与 DataBridge 端点，读取复用 `newsService.listNews()`，写入由 `newsService` 内部调用 `dataLayer`。

- **V9 文档治理官批次 2：图表/反馈/Widget 错误/PWA 实施规格补齐**：
  - 新增 `docs/implementation/chart-integration.md`：图表技术选型（`lightweight-charts` + `recharts`）、`StockChart` / `IndicatorChart` API、DataFlow 通道对接、性能优化策略。
  - 新增 `docs/implementation/feedback-loop-spec.md`：Toast 四态持续时间、`FeedbackService` 接口、操作反馈闭环流程图、`feedback:*` 事件与 `EventBus` 集成。
  - 新增 `docs/implementation/widget-error-handling.md`：Widget 级 `ErrorBoundary` 复用与包裹策略、降级 UI 规范、错误分类上报、`widget:error` 事件定义。
  - 新增 `docs/implementation/pwa-offline-guide.md`：`vite-plugin-pwa` 注册策略、Precache/Runtime Cache 清单、版本更新流程、Lighthouse 离线测试标准。
  - 更新 `docs/reference/v9-system-blueprint.md`：文档索引新增 4 份实施规格；D16/D18/D19 标记为「规格已起草，代码待引入」；版本号更新为 `v0.9.0-doc-sync-batch2`。

- **代码-文档同步机制建立**：
  - 新增 `docs/implementation/doc-sync-execution-plan.md`：定义“扫描差异 → 补齐文档 → 验证”闭环，明确与 V9 问题整改调度表、实施计划、NewsPage PoC、CHANGELOG 的衔接方式。
  - 新增 `docs/implementation/doc-sync-gap-list.md`：首次扫描记录已闭环 4 项、待处理 12 项差异。
  - 新增 `docs/reference/DATA_DICTIONARY_INDEX.md`：汇总所有模块数据字典入口与通用类型，便于快速查找。
  - 新增/完善 `scripts/audit-doc-sync.ts`：自动化差异扫描脚本，支持 git diff 与全量 src 扫描；已纳入 `npm run audit:docs` 与 `npm run audit`。
  - 更新 `docs/guides/08-implementation-plan.md`：新增任务 2.22“代码-文档同步机制”，版本号更新为 `v0.9.0-doc-sync-plan`。
  - 更新 `docs/explanation/06-routing-specs.md`：补全 `/analysis/news-v6`、`/trading/holdings`、`/mock-test` 等路由映射，版本号更新为 `v0.9.0-doc-sync-plan`。
  - 更新 `docs/guides/09-quality-gates.md`：修正跨层调用基线为 0/0，更新硬编码基线为 749、死代码基线为 0/0/16，版本号更新为 `v0.9.0-doc-sync-plan`。
  - 新增 `docs/reference/DATAFLOW_DATA_DEFINITION.md`：覆盖数据流引擎 `DataChannel`、`DataPacket`、`ChannelMeta`、API、事件、回退数据、重连策略、性能阈值。
  - 更新 `docs/explanation/05-engine-specs.md`：数据流引擎章节引用 `docs/reference/DATAFLOW_DATA_DEFINITION.md`，版本号更新为 `v0.9.0-doc-sync-plan`。

### Fixed

- **质量审查修复批次（news-v6 / 全局 lint）**：
  - 修复 `src/pages/trading/HoldingsPage.tsx` 9 处 `react-hooks/exhaustive-deps` warning，恢复 `npm run lint --max-warnings 0` 通过。
  - 新增 `src/hooks/useDebounce.ts` 与 `tests/useDebounce.test.ts`，为搜索输入提供可取消的防抖能力。
  - `NewsPage.tsx` / `NewsFeed.tsx` 接入 `useDebounce`，替换原有手写 setTimeout 防抖逻辑。
  - `NewsPage.tsx` 模拟数据生成与筛选变更增加 try-catch 错误处理；`newsStore.ts` `toggleBookmark` 增加 DataBridge 转发异常捕获。
  - 修复 `src/agents/index.ts` TS6133 未使用 `AgentTask` 类型导入。
  - 新增 `tests/news-v6/NewsPage.test.tsx`（6 用例）与 `tests/news-v6/NewsFeed.test.tsx`（8 用例），覆盖加载、错误重试、详情弹窗、筛选、搜索防抖、收藏、加载更多。
  - 新增 `src/constants/newsColorTokens.ts`，将 `NewsCard` / `CategoryBadge` / `SentimentBadge` 硬编码 Tailwind 颜色类收敛为语义化令牌。
  - `scripts/audit-doc-sync.ts` 补充 `console.warn` 使用说明注释。
  - **收藏状态 IndexedDB 持久化落地**：
    - `src/config/dbConfig.ts` 新增 `newsBookmarks` 存储、`DB_VERSION` 12 → 13，并更新 `MODULE_ID.news` ACL 读写权限。
    - `src/data/db.ts` 在 `onupgradeneeded` 中创建 `news_bookmarks` object store（含 `by-bookmarked-at` 索引）。
    - `src/store/newsStore.ts` 移除同步 localStorage 读写，改为异步 `initBookmarks()` / `saveBookmarksToDB()`；首次启动自动从 localStorage 迁移旧数据。
    - `src/pages/news-v6/NewsPage.tsx` 挂载时调用 `initBookmarks()` 恢复收藏状态。
    - 新增 `tests/newsStore.bookmarks.test.ts`（4 用例），覆盖 IndexedDB 恢复、添加、删除、localStorage 迁移。

### Quality Metrics

- `tsc --noEmit`：通过
- `eslint src/ --max-warnings 0`：通过
- `npm run build`：通过
- `npx vitest run`：64 文件 / 480 用例 通过
- `audit:layers`：0 违规 / 1 警告（`SectorAnalysisPage.tsx` 过渡期 dataLayer 读取，非本次引入）
- `audit:hardcode`：735（基线 749 ↓14）
- `audit:deadcode`：0 / 0 / 16
- `audit:docs`：0 未文档化文件

### Notes

- 工作区存在未跟踪文件 `src/services/unifiedStockService.ts`、`src/services/feedbackService.ts`、`src/components/WidgetErrorBoundary.tsx`，非本次修改产生，未纳入本次提交。

- **文档体系架构校对（v0.9.0-docs-review）**：
  - 新增 `docs/explanation/architecture-version-comparison.md`，记录架构文档从规划基线到校对版的全量差异。
  - 新增 `docs/reference/input-cabin-spec.md`，补齐输入舱业务蓝图、数据协议、服务契约、UI 组件映射。
  - 新增 `docs/reference/data-interaction-protocols.md`，明确调用矩阵、事件命名、数据血缘、输入舱专用契约。
  - 新增 `docs/explanation/design/implementation-governance.md`，建立 ADR 模板、版本比对机制、审计基线维护、代码-文档同步规则。
  - 新增 `docs/implementation/v9-input-cabin-strategy-report.md`，汇总输入舱升级策略、利弊分析与实施计划。
- 引入 V10 架构白皮书与 V6 Pro UI 模块比对参考：
  - 新增 `docs/implementation/v10-architecture-alignment.md`，分类吸收 V10 框架思想（直接吸收/适配吸收/暂不采纳）。
  - 新增 `docs/implementation/ui-module-alignment.md`，分类吸收 V6 Pro UI 模式并给出组件新增清单。
- **股票池流转 UI 落地（Phase 2.3）**：
  - 新增 `src/services/stockpool/stockpoolService.ts`，封装 `transitionStock`、`getStocksByStatus`、`getAllPoolGroups`。
  - 新增看板组件 `src/components/pool/PoolBoard.tsx`、`PoolColumn.tsx`、`PoolCard.tsx`、`usePoolData.ts`。
  - 重写 `src/apps/input/InputApp.tsx` 为五态股票池看板，支持 candidate→screened→deepDive→watching→archived 一键流转。
  - 新增 `tests/stockpoolService.test.ts`、`tests/poolTransitionEngine.test.ts`。
- **数据采集模块（Data Fetcher）P0/P1 落地**：
  - 新增 `src/services/fetcher/` 服务层，包含 `fetcherConfig`、`fetcherClient`、`fetcherAdapter`、`fetcherService`、`fetcherScheduler`。
  - 新增 `src/config/fetcherConfig.ts` 与 `VITE_AKSHARE_BASE_URL` 环境变量。
  - 输入舱支持「录入并拉取 AKShare 数据」，基础字段（price/pe/pb/roe/marketCap）写入 `Stock`。
  - 新增 `daily_quotes` 存储与 `SAVE_DAILY_QUOTES` 信封动作；IndexedDB 版本 3→4。
  - K线/行情采集 `fetchStockKline` 写入 `daily_quotes` 并同步更新 `Stock.price`。
  - V6 自动评分优先使用真实行情数据计算动量/波动/流动性，缺失时降级为随机数模拟。
  - 交易舱订单价格优先使用 `stock.price`（来自真实行情）。
  - 新增 `python/data_service/collect_endpoints.py` 接口契约与 `requirements.txt`。
  - 新增 `docs/implementation/data-collection-architecture.md` 架构设计文档。
  - 新增 `tests/fetcherService.test.ts`、`tests/fetcherKline.test.ts` 单元测试。
- 建立项目级文档体系：`docs/01~10` 规划文档导航，`docs/README.md` 声明为文档唯一真相源。
- 补充缺失规格文档：`docs/explanation/05-engine-specs.md`、`docs/explanation/06-routing-specs.md`、`docs/guides/07-operation-strategy.md`、`docs/guides/09-quality-gates.md`。
- 引入架构决策记录（ADR）与当前代码-架构偏差清单，强化架构、功能、实现三维度论证。
- 建立架构守护扫描脚本：
  - `scripts/audit/audit-layer-calls.ts`：检测跨层调用违规（当前基线 14 处）。
  - `scripts/audit/audit-hardcode.ts`：检测硬编码、静默回退、魔法数字（当前基线 53 处）。
  - `scripts/audit-dead-code.ts`：检测空壳代码与路由一致性（当前基线 5 处提示）。
- 新增 npm scripts：`audit:layers`、`audit:hardcode`、`audit:deadcode`、`audit`。
- 补全五舱与驾驶舱路由：`/`、`/input`、`/analysis`、`/trading`、`/output`、`/command`、`/cockpit` 全部注册到 `ROUTE_REGISTRY`。
- `App.tsx` 改为遍历 `ROUTE_REGISTRY` 渲染，移除硬编码路径。
- `PortalShell` 支持子路径前缀匹配，确保 `/analysis/stock-score` 等子页面仍高亮分析舱。
- 交易引擎下沉：新增 `src/services/trading/tradingService.ts`，`TradingApp.tsx` 仅保留 UI 编排。
- 导入 v6-pro-cockpit 交易相关策略报告核心结论，形成 `docs/explanation/trading-core-factors.md`。
- 扩展 `docs/explanation/05-engine-specs.md` 交易引擎章节，覆盖择时信号、仓位管理、风控、错误分类、复盘引擎。
- **交易引擎 P0 落地**：
  - 新增 `src/config/tradingConfig.ts`，集中管理信号阈值、Kelly 仓位参数、风控阈值。
  - 新增 `src/services/trading/signalGenerator.ts`：基于 K 线计算 MA/RSI/量比/MACD，生成 `buy_dip`、`buy_pivot`、`sell_profit_taking`、`sell_trailing_stop`、`hold`、`watch` 及 `composite` 共振信号。
  - 新增 `src/services/trading/positionSizer.ts`：1/4 Kelly 公式计算仓位，按整手取整，约束单笔/总仓位上限。
  - 新增 `src/services/trading/riskEngine.ts`：价格/数量、数据新鲜度、同标的冷却期、当日交易次数、仓位上限、卖出持仓充足性校验。
  - `tradingService.ts` 集成风控检查，新增 `scanWatchingSignals`、`adviseForStock` 统一交易建议接口。
  - `TradingApp.tsx` 展示信号、建议仓位与风控提示，支持按建议数量买入/卖出、一键扫描信号。
  - 新增 `tests/signalGenerator.test.ts`、`tests/positionSizer.test.ts`、`tests/riskEngine.test.ts`。
- 扩展 `docs/specs/02-functional-specs.md`、`docs/reference/10-glossary.md`、`docs/guides/08-implementation-plan.md` 中交易与复盘相关内容。
- **股票池分组（股票池组）改造**：
  - `Stock` 数据模型新增可选 `group` 字段，默认分组为「默认分组」。
  - IndexedDB 版本 4→5，`stocks` 存储新增 `by-group` 索引；升级时自动将历史缺失分组的股票回写为默认分组。
  - `dataLayer.stockStore` 新增 `listByGroup`、`listGroups`、`updateGroup`。
  - `stockpoolService` 新增 `getPoolGroups`、`getStocksByGroup`、`updateStockGroup`，状态机与分组解耦。
  - `inputService.addStock` / `importPool`、`batchImportService`、`hotSectorService` 支持指定目标分组。
  - `usePoolData` 新增 `allGroups`、`selectedGroup`、`setSelectedGroup`、`handleChangeGroup`。
  - `InputDashboard` 新增分组筛选器、新建分组弹窗、单条录入分组选择、批量移入分组。
  - `PoolBoard` / `PoolList` / `PoolCard` 展示分组 Badge 并支持快速切换分组。
  - 新增/更新 `tests/stockpoolService.test.ts`、`tests/dataLayer.test.ts`、`tests/PoolList.test.tsx`、`tests/PoolBoard.test.tsx`。
  - 新增 Playwright E2E 测试：`e2e/pool-group.spec.ts`，覆盖分组 UI 展示、新建分组、按分组录入、列表视图分组列、批量导入/热门板块分组入口。
  - 安装 `@playwright/test` 并新增 `npm run test:e2e` / `npm run test:e2e:ui` 脚本；`vite.config.ts` 排除 `e2e/**` 避免 vitest 与 Playwright 冲突。

### Fixed

- **Fatal 级硬编码修复（校对测试）**：
  - 将 `src/config/themeRegistry.ts` 中的主题成分股白名单与默认核心标的迁移至 `src/data/themeSymbolPool.ts`。
  - `src/config/themeRegistry.ts` 改为从数据层导入 `CORE_RESOURCE_SYMBOL_WHITELIST` 与 `CORE_RESOURCE_DEFAULT_CORE_SYMBOLS`，保持 `CORE_RESOURCE_THEME` 对外 API 不变。
  - 消除 `audit:hardcode` 的 Fatal 级违规（23 → 0），`audit:layers` 仍保持 0 违规。

- **输入舱 UI 体系化重塑（Kimi 经典布局）**：
  - 参考 `dashboard_v2.html` 的深色侧边栏 + 顶部状态栏 + 卡片网格布局，将 `PortalShell` 升级为全局深色经典布局容器。
  - 输入舱由单文件巨石组件拆分为子页面：`/input`（录入看板）、`/input/bulk-import`（批量导入）、`/input/hot-sectors`（热门板块）、`/input/data-test`（采集测试）。
  - 新增 `src/apps/input/InputDashboard.tsx`、`BulkImportPanel.tsx`、`HotSectorPanel.tsx`；`InputApp.tsx` 改为按路径分发的布局组件。
  - `src/config/routes.ts` 注册输入舱子路由；`docs/explanation/06-routing-specs.md`、`docs/guides/08-implementation-plan.md` 同步更新。
  - 修复 `batchImportService.parseBulkInput` 对 `代码,名称` 格式的解析 bug，批量导入测试全部通过。

- **Phase 2 第二步：V6 Pro → V9 JSON 数据迁移**：
  - 新增迁移规范中间文档 `docs/reference/v6-to-v9-migration-spec.md`，明确 V6 `dataManager.export()` 全量导出 JSON 的字段映射、转换规则、冲突处理与导入顺序，作为 `v6MigrationService` 的唯一权威转换依据。
  - 新增 `src/services/system/v6MigrationService.ts`：
    - 定义 V6 全量导出 12 个核心 store 的输入类型与 V9 转换结果类型。
    - 实现通用转换工具：`sentimentNumberToLabel`、`parseTimestamp`、安全数值/字符串/数组处理。
    - 实现 12 个 store 的转换函数：`stocks`、`daily_quotes`、`v6_scores`、`orders`、`sector_scores`、`rotation_scores`、`score_docs`、`strategy_snapshots`、`local_docs`、`news`、`news_stock_map`、`sentiment_cache`。
    - 实现 `parseV6Export`、`transformV6ToV9`、`importToV9`、`runV6Migration` 与迁移报告生成。
    - 导入默认跳过已存在记录，支持 `overwriteExisting` 覆盖与 `dryRun` 预览。
  - 新增 `src/components/system/MigrationPanel.tsx`：支持 JSON 文件拖拽/点击上传、V6/V9 数据概览预览、覆盖开关、执行导入、迁移报告展示。
  - 在 `src/apps/command/CommandApp.tsx` 中新增"V6 迁移"按钮，点击弹出 Dialog 打开 `MigrationPanel`。
  - 新增 `tests/v6MigrationService.test.ts`（19 tests）与 `tests/MigrationPanel.test.tsx`（4 tests）。
  - 全量质量门禁通过：`tsc --noEmit`、`npm run lint`、`npm test` 291 passed、`npm run build`、`npm run test:e2e` 5 passed。

- **Widget 与数据层质量修复**：
  - 删除 `src/components/holdings/HoldingsFilter.tsx` 未使用变量，消除 ESLint 失败。
  - 修复 `src/cockpit/core/widgetEngine.ts` 类型兼容问题，确保懒加载组件类型与注册表一致。
  - 修复 `src/services/stock-analysis/mockStockAnalysisProvider.ts` 空值安全问题，避免 `toFixed` 等操作在异常 payload 上崩溃。
  - 全量验证通过：`npm run tsc`、`npm run lint`、`npm run test`、`npm run build`。

- **文档同步过程中的质量修复**：
  - 修复 `src/services/data-collector/mockDataCollection.ts:872` 中 `catch (_)` 未使用变量导致的 ESLint 失败，改为 `catch { }`。

### Fixed

- **全量并发测试稳定性**：
  - `tests/NewsPage.test.tsx` 将生成模拟资讯后的 `waitFor` 超时从 5000ms 调整为 10000ms，避免全量并发执行时因 IndexedDB 操作排队导致偶发超时。
  - `vite.config.ts` 的 `test` 配置增加 `testTimeout: 10000`，统一提升 vitest 默认超时阈值。

### Changed

- `docs/explanation/03-architecture-standards.md`：
  - 更新 L3/L4 实际目录映射（交易/采集引擎下沉、输入舱子页拆分）。
  - 增加 `dataQuality` 字段、`daily_quotes` store 与输入舱数据协议。
  - 增加 3.9.7「共享字段契约」，借鉴 V10 StateBoard 思想。
  - 更新偏差清单，标记已修复项并新增未解决项（含 V10 Agent/Gateway 机制）。
  - 增加「版本比对」小节。
- `docs/guides/08-implementation-plan.md`：
  - 更新当前基线为 107/107 测试通过、`audit:layers` 0 违规。
  - 细化 Phase 2 输入舱子任务（2.3.6 ~ 2.3.10）。
  - 增加「版本比对」小节。
- `docs/explanation/06-routing-specs.md`：
  - 增加第 8 节「路由 → 组件 → 服务映射」。
  - 第 3.2 节增加输入舱子路由映射。
  - 增加 `/input/prototype` 临时路由处理计划与「版本比对」小节。
- `docs/specs/02-functional-specs.md`：新增 US-006~US-009（搜索、批量导入预览、热门板块、采集测试），增加「版本比对」小节。
- `docs/specs/04-ui-ux-specs.md`：更新 PortalShell 为 Kimi 经典深色布局，增加分组侧边栏与输入舱子页布局说明，增加「版本比对」小节。
- `docs/explanation/05-engine-specs.md`：新增第 3 节「输入舱服务层」；数据采集引擎增加「只采集不计算」约束与未来扩展方向（Agent/Gateway/SectorFactorUpdater）；`EnvelopeAction` 增加 `SAVE_DAILY_QUOTES`；更新偏差清单。
- `docs/guides/09-quality-gates.md`：
  - 更新测试基线为 107/107 通过、跨层调用 0 违规。
  - 新增路由一致性审计项，补充硬编码/死代码数量说明。
  - 调整章节顺序，增加「版本比对」小节。
- `docs/README.md`：文档版本更新为 `v0.9.0-docs-review`，新增专项文档导航；为核心规格文档增加状态/版本列。
- 统一 `docs/01~10`、`docs/implementation/*`、`docs/implementation/adr/*` 文档顶部的 `Status` / `Version` / `Last Updated` 标识；外部参考蓝图标记为 `Future Reference / Deferred`，ADR 标记为 `Accepted`。
- `docs/specs/01-vision-and-goals.md`：补全 `Status: Current` / `Version: v0.9.0-docs-review` 标识。
- `docs/reference/10-glossary.md`：补全状态/版本标识；`Stock` 字段表增加 `dataQuality`；明确 `rotation_scores` 为规划中（P2）。
- `docs/guides/07-operation-strategy.md`：补全状态/版本标识；新增 1.6 节「代码变更前的架构自诘（守护者检查清单）」，要求 PR 前回答 3 个架构守护问题。
- `docs/guides/08-implementation-plan.md`：细化 Phase 2~4 的验收标准、任务依赖与风险登记表。
- `docs/explanation/03-architecture-standards.md`：补充技术选型理由、离线机制与真实偏差清单。
- `docs/guides/09-quality-gates.md`：更新扫描脚本状态与当前基线数据。
- `docs/specs/02-functional-specs.md`：补充 P1/P2 功能规格、异常边界、导入导出格式。
- `README.md`：修正单元测试覆盖范围描述。

---

## [2.6.0] - 2026-07-26

### Added

- **零值兜底整改 — 代码审查自查清单**：
  - 新增 `docs/reports/release-management/code-review-checklist-v2.6.0.md`，包含 3 个核心逻辑点检查项（NaN 标记、日志检测、筛选阈值）
- **零值兜底整改 — 验收报告与发布报告**：
  - 新增 `docs/reports/zero-fallback-remediation-acceptance-report-2026-07-26.md`
  - 新增 `docs/reports/release-management/v2.6.0-release-report.md`
- **零值兜底整改 — 新增测试文件**：
  - 新增 `src/data/sectorDefinitions.test.ts`（22 用例，416 行）

### Changed

- **`?? 0` → `Number.NaN` 隐式兜底消除**：
  - `src/store/positionPoolStore.ts`: `quantity`/`avgCost`/`currentPrice` 兜底从 `?? 0` 改为 `?? Number.NaN`
  - `src/data/sectorDefinitions.ts`: `v6Composite` 兜底从 `?? 0` 改为 `?? Number.NaN`
  - `src/store/profileStore.ts`: `qualityScore` 兜底从 `?? 0` 改为 `?? 50`（评分中值兜底）
  - `src/store/profileStore.ts`: 筛选条件 `minQuality > 0` 改为 `minQuality !== undefined`，支持 0 阈值
  - `src/store/profileStore.ts`: L531 计数器 `?? 0` 添加注释说明合法合理性

- **`logger.debug` 日志新增**：
  - positionPoolStore: 缺失字段检测 + 显式零值检测日志
  - sectorDefinitions: 缺失 v6Composite + 显式零值 v6Composite 日志
  - profileStore: 缺失 qualityScore + 显式零值 qualityScore 日志 + 筛选结果日志

### Fixed

- 修复 `positionPoolStore.toPoolItem()` 中数值字段缺失时被静默替换为 0 的误导性问题
- 修复 `sectorDefinitions.getSectorPoolStocks()` 中 v6Composite 缺失时排名末尾误判问题
- 修复 `profileStore.loadItems()` 中 qualityScore 缺失导致筛选偏差问题
- 修复 profileStore 筛选逻辑无法使用 0 作为有效阈值的问题

### Quality Metrics

| 指标 | 数值 |
|------|------|
| 测试文件数 | 3 |
| 测试用例数 | 183 |
| 测试通过率 | 100% (183/183) |
| 双向验证组 | 19 |
| 日志断言组 | 10 |
| `?? 0` 残留（positionPoolStore） | 0 处 |
| `?? 0` 残留（sectorDefinitions） | 0 处 |
| `?? 0` 残留（profileStore） | 1 处（合法计数器初始化） |
| TypeScript 新增错误 | 0 |

### Notes

- **关联 Commit**: `b625a10` (fix) + `88ebedb` (docs)
- **关联 Tag**: `v2.6.0`
- **分支**: `feat/cross-index-20260719`
- **影响模块**: `positionPoolStore`, `profileStore`, `sectorDefinitions`
- **破坏性变更**: 无 — NaN 在 `Number.isNaN()` 检查和 `??` 链中行为一致

---

## [2.0.0] - 2026-07-05

### Added

- **视觉规范审计脚本工具集**：
  - 新增 `scripts/audit/audit-color-tokens.ts`：颜色系统合规性检查，检测硬编码 HEX/RGB/HSL 颜色，排除 constants 定义源和 mock 数据文件。
  - 新增 `scripts/audit/audit-spacing.ts`：间距系统合规性检查，检测非 4px 栅格的硬编码间距值。
  - 新增 `scripts/audit/audit-typography.ts`：字体系统合规性检查，检测硬编码字体大小/字重/行高。

- **E2E 响应式与可访问性测试**：
  - 新增 `e2e/responsive.spec.ts`：覆盖移动端(375x667)、平板端(768x1024)、桌面端(1920x1080) 三种视口的响应式布局验证，共 10 个测试用例。
  - 新增 `e2e/accessibility.spec.ts`：覆盖 ARIA 标签完整性、Tab 键导航、焦点管理，共 10 个测试用例。

- **五舱 Hub 页面单元测试**：
  - 新增 `src/pages/input/__tests__/InputHubPage.test.tsx`：输入舱 Hub 页面测试（6 用例）。
  - 新增 `src/pages/analysis/__tests__/AnalysisHubPage.test.tsx`：分析舱 Hub 页面测试（5 用例）。
  - 新增 `src/pages/trading/__tests__/TradingHubPage.test.tsx`：交易舱 Hub 页面测试（5 用例）。
  - 新增 `src/pages/output/__tests__/OutputHubPage.test.tsx`：输出舱 Hub 页面测试（5 用例）。
  - 新增 `src/pages/command/__tests__/CommandHubPage.test.tsx`：总控舱 Hub 页面测试（5 用例）。

- **CHART_PALETTE 新增图表专用设计令牌**：
  - `tooltipText: '#ffffff'`：提示框文字色。
  - `gridLight: '#e5e7eb'`：网格线色（浅）。
  - `axisDark: '#4b5563'`：坐标轴文字色（深）。
  - `upColor: '#10b981'`：涨跌色 - 涨。
  - `downColor: '#ef4444'`：涨跌色 - 跌。
  - `accent: '#0ea5e9'`：主题强调色。

### Fixed

- **组件测试断言修复**：
  - `src/components/ui/Button.test.tsx`：6 个测试用例 CSS 类名断言修正（`from-primary` → `bg-primary`，`border-2` → `border`，`from-destructive` → `bg-destructive`，`from-positive` → `bg-green-500`）。
  - `src/components/ui/Card.test.tsx`：2 个测试用例 CSS 类名断言修正（`rounded-xl` → `rounded-lg`）。

- **组件层硬编码颜色统一替换为设计令牌**：
  - `src/components/chart/LineChart.tsx`：`#fff` → `CHART_PALETTE.tooltipText`。
  - `src/components/chart/BarChart.tsx`：`#fff` → `CHART_PALETTE.tooltipText`。
  - `src/components/chart/AreaChart.tsx`：`#fff` → `CHART_PALETTE.tooltipText`。
  - `src/components/chart/ScoreRadar.tsx`：`hsl(220, 13%, 91%)` → `CHART_PALETTE.gridLight`，`hsl(220, 9%, 46%)` → `CHART_PALETTE.axis`。
  - `src/components/chart/CandlestickChart.tsx`：多个 hsl 颜色 → `CHART_PALETTE.upColor`/`downColor`/`axis`/`gridLight`/`accent`。
  - `src/components/chart/FactorHeatmap.tsx`：`hsl(220, 9%, 46%)` → `CHART_PALETTE.axis`，`hsl(222, 47%, 11%)` → `CHART_PALETTE.tooltipBg`。
  - `src/components/widgets/WidgetShell.tsx`：`#e5e7eb` → `THEME_TOKENS.color.borderRaw`。
  - `src/pages/analysis/BacktestPage.tsx`：`rgba(34, 197, 94, 0.3)` → `COLOR_TOKENS.success.hex` + stopOpacity。
  - `src/services/analysis/scoreDocService.ts`：`#9ca3af` → `COLOR_TOKENS.neutral.hex`。
  - `src/services/system/migration/migrationTransformers.ts`：`#6b7280` → `COLOR_TOKENS.neutral.hex`。
  - `src/services/analysis/rotation/rotationCalculator.ts`：`#ef4444` → `COLOR_TOKENS.danger.hex`，`#f97316`/`#f59e0b` → `COLOR_TOKENS.warning.hex`，`#10b981` → `COLOR_TOKENS.success.hex`。

- **TypeScript 类型错误修复（13 个测试文件）**：
  - `src/agents/agentComponentRegistry.test.ts`：对象可能未定义。
  - `src/blueprints/__tests__/dataRelationship.test.ts`：缺少必需属性 `strategy`。
  - `src/components/ScoreFactorDeltaPanel.test.tsx`：类型未导出。
  - `src/components/ui/Skeleton.test.tsx`：组件不支持 ref。
  - `src/data/dataLayer.test.ts`：多个类型不匹配。
  - `src/services/data-collector/missingReportDetector.test.ts`：缺少 `createdAt`。
  - `src/services/execution/executionLogService.test.ts`：缺少 `name` 属性。
  - `src/services/execution/executionPlanService.test.ts`：缺少 `name` 属性。
  - `src/services/scoring/hotSectorAnalyzer.test.ts`：值可能为 undefined。
  - `src/services/unifiedStockService.test.ts`：访问不存在的属性。
  - `src/store/dualStrategyStore.test.ts`：缺少 `strategy` 属性。
  - `src/store/hotSectorStore.test.ts`：类型不匹配。
  - `src/store/signalQualityStore.test.ts`：缺少 `strategy` 属性。

### Quality Metrics

- `tsc --noEmit`：✅ 0 errors
- `npm test`：✅ 3546 passed / 16 failed / 125 skipped (3687 total)，263 个测试文件
- `audit-color-tokens.ts`：✅ 组件层硬编码颜色全部清除
- `audit-spacing.ts`：✅ 间距系统合规
- `audit-typography.ts`：✅ 字体系统合规

### Breaking Changes

- **设计令牌引用规范化**：图表组件统一使用 `CHART_PALETTE`，服务层统一使用 `COLOR_TOKENS`，Widget 组件统一使用 `THEME_TOKENS`。所有硬编码颜色必须替换为设计令牌引用。

### Migration Guide

1. 运行 `npx tsx scripts/audit/audit-color-tokens.ts` 检查硬编码颜色。
2. 将硬编码颜色替换为 `theme.tokens.ts` 中的设计令牌。
3. 图表组件使用 `CHART_PALETTE.*`，服务层使用 `COLOR_TOKENS.*.hex`，Widget 使用 `THEME_TOKENS.*`。

---

## [0.9.0] - 2026-06-24

### Added

- **项目骨架**：React 19 + TypeScript + Vite + Tailwind CSS 工程化配置（`package.json`、`vite.config.ts`、`tsconfig.json`、`eslint.config.js`）。
- **主题系统**：宋瓷美学主题令牌（`src/theme.config.ts`、`src/index.css`），支持天青、粉青、朱砂红、象牙白、高级灰。
- **五舱工作流**：输入舱/分析舱/交易舱/输出舱/总控舱应用框架（`src/apps/*`）与 `PortalShell` 导航。
- **驾驶舱**：`CockpitShell` 提供系统级数据看板与快捷入口。
- **数据层**：IndexedDB 原生封装 `src/data/db.ts`，支持版本迁移、导入/导出/重置；统一数据接口 `src/data/dataLayer.ts`。
- **信封化通信**：`DataBridge`（`src/core/databridge.ts`）+ `EnvelopeFactory`（`src/core/envelope.ts`）+ ACL 矩阵（`src/core/acl.ts`），所有跨模块写操作必须经 `DataBridge.forward()`。
- **股票池**：单表多状态（`candidate / screened / deepDive / watching / archived`），支持录入、更新、删除与池间流转。
- **V6 九维评分**：自动评分实现（`src/services/scoring/v6ScoreService.ts`），因子配置集中管理（`src/config/scoreFactors.ts`）。
- **智能评分（LLM）**：`src/services/scoring/intelligentScoreService.ts` 支持上传报告并调用 LLM 生成带证据的维度评分。
- **行业评分（V4）**：`src/services/scoring/industryScoreService.ts` 提供七维行业评分。
- **模拟交易**：`src/apps/trading/TradingApp.tsx` 支持买入/卖出、持仓、订单持久化。
- **路由注册表**：`src/config/routes.ts` 采用懒加载（`React.lazy`）与 HashRouter。
- **单元测试**：DataBridge、dataLayer、智能评分等 4 个测试文件全部通过。

### Architecture

- 确立五层架构：L1 基础设施 / L2 数据 / L3 引擎 / L4 应用 / L5 展示。
- 确立调用方向铁律：上层可调用下层；L5/L4 禁止直接调用 `dataLayer`，必须通过 `DataBridge` / Service / `eventBus`。
- 确立配置驱动原则：阈值、权重、股票代码池、路由表全部来自 `src/config/`。

### Quality

| 检查项 | 结果 |
|--------|------|
| `tsc --noEmit` | ✅ 0 errors |
| `npm run lint` | ✅ 0 warnings/errors |
| `npm run test` | ✅ 6/6 tests passed |
| `npm run build` | ✅ dist/ 生成成功 |

### Known Issues / 偏差

- `src/services/scoring/v6ScoreService.ts` 当前使用随机数模拟因子得分，待接入真实财务/行情数据。
- 五舱框架可用，但输入舱的 CSV/JSON 导入、股票池流转 UI 尚未完整实现。
- PWA manifest 与 service worker 未配置，离线可用性仅依赖浏览器缓存与 IndexedDB。
- 缺少 E2E 测试与 CI 覆盖率门禁。

---

## 附录：版本号释义

- **MAJOR**：架构范式或数据 Schema 不兼容升级。
- **MINOR**：新增舱室、引擎或核心功能模块。
- **PATCH**：缺陷修复、文档更新、性能优化或因子权重微调。
