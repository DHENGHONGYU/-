---
title: file-management-guide
type: how-to
domain: project
phase: development
tier: important
status: active
maintainer: V9 Architecture Team
summary: "file-management-guide step-by-step guide"
tags: [project, guide, management, component, how-to]
version: v1.0.0
last_updated: 2026-07-17
code_version: 2.0.0
doc_id: V9-DOC-PROJ-070
change_log:
  - version: v1.0.0
changes: Initial version established
date: 2026-07-17
---

# V9 文件管理规范

> **Version**: v1.4.0 | **日期**: 2026-07-20
> **适用范围**: 智能投研复盘系统V9 全体开发者及 AI 辅助工具

---

## 一、文件归位规�?
| 文件类型 | 存放目录 | 说明 |
|---|---|---|
| 源代�?| `src/` | 按分层规则放�?`config/`、`core/`、`data/`、`lib/`、`services/`、`store/`、`pages/`、`components/`、`portal/`、`constants/`、`types/`、`apps/`、`cockpit/`、`hooks/`、`devtools/`、`fixtures/`、`i18n/`、`mcp/`、`schema/`、`showcase/`、`generated/` |
| App 分发�?| `src/apps/` | React.lazy 页面加载，三级加载链中间�?|
| 自定�?Hooks | `src/hooks/` | 跨组件共享逻辑，可依赖 `store/`、`services/` �?`lib/` |
| 开发工�?| `src/devtools/` | 开发环境调试工具（DEV 注入），仅开发环境使�?|
| Mock 数据 | `src/fixtures/` | 测试数据供给，仅�?`tests/` 依赖 |
| 国际�?| `src/i18n/` | 国际化配置与翻译资源，可�?`components/` �?`pages/` 引用 |
| AI 行为扩展 | `src/agents/` | 运行时模块，core 层扩展，仅可依赖 `core/` �?`data/` |
| MCP 服务器层 | `src/mcp/` | 20+ 子服务器（analysis/backtest/...），服务层扩展，可依�?`core/`/`data/`/`lib/`/`services/` |
| Schema 校验定义 | `src/schema/` | Zod/JSON Schema 校验定义，仅可依�?`types/` �?`constants/`，可�?`services/`/`data/`/`components/` 引用 |
| 组件展示�?| `src/showcase/` | 开发环境专用展示页（不进入生产构建），仅可依赖 `components/`/`constants/`/`lib/` |
| 代码生成产物 | `src/generated/` | 令牌/类型/脚本自动生成产物，零依赖，可�?`services/`/`components/`/`pages/` 引用 |
| 单元测试 | `tests/` �?`src/**/*.test.ts` | 与源文件同目录的测试需�?`.test.ts`/`.test.tsx` 结尾 |
| E2E 测试 | `e2e/` | Playwright `.spec.ts` 文件 |
| 脚本工具 | `scripts/` | 构建、审计、数据迁移脚�?|
| 文档规范 | `docs/` | 需求、架构、数据字典、实现文�?|
| 审计报告 | `docs/audit/` | 质量审计、架构扫描报�?|
| 临时输出 | `temp/` | 已在 `.gitignore` 中忽�?|
| 提示词模�?| `prompts/` | 系统提示词模板存放目�?|
| AI Skill 定义 | `.agents/skills/` | AI 技能定义文件（系统提示词模板） |
| CI/CD | `.github/workflows/` | GitHub Actions 工作�?|
| Monorepo 子包 | `packages/` | 可独立发布的子包（audit-utils、store-audit�?|
| Python 数据服务 | `python/data_service/` | Python 数据服务层，�?MCP 数据服务子目�?|
| MCP/数据源插�?| `plugins/` | 10 子目录：ifind/imf/kimi-webbridge/scholar/sec_edgar/tianyancha/world_bank_open_data/yahoo_finance/yuandian_law + README.md |

### 禁止事项

- **禁止**在仓库根目录直接创建 `.ts`、`.tsx`、`.ps1`、`.py` 脚本文件
- **禁止**在仓库根目录直接创建报告文件（`.md`、`.json`、`.txt`�?- **禁止**将工具运行输出（`tsc`/`eslint`/`vitest`）重定向到仓库根目录
- **禁止**在根目录新建�?`packages/`、`python/`、`plugins/` 职责重叠的独立目�?
### 例外条款

以下文件不受根目录禁止规则限制：
- 标准项目配置文件：`package.json`、`tsconfig.*.json`、`*.config.ts`、`vite.config.ts` �?- 项目根级文档：`../../README.md`、`../../AGENTS.md`、`../../CHANGELOG.md`、`../explanation/03-architecture-standards.md` �?- CI/CD 配置文件：`.github/workflows/*.yml`、`.husky/*` �?
### docs/ 子目录分�?
`docs/` 目录采用 `NN-语义/` 编号分层体系，所有文档必须放入对应子目录�?
| 子目�?| 用�?| 存放内容 |
|--------|------|----------|
| `docs/00-meta/` | 元数据与运维 | 文档索引、审计报告、任务清单、RCA 报告 |
| `docs/01-requirements/` | 需求与规范 | 需求文档、管理规范、质量标准、设计约�?|
| `docs/02-design/` | 设计文档 | 架构设计、数据流、策略文档、接口契�?|
| `docs/03-development/` | 开发指�?| 编码规范、迁移检查清单、开发手册、构建说�?|
| `docs/04-testing/` | 测试文档 | 测试计划、测试报告、修复方案、覆盖率分析 |
| `docs/05-deployment/` | 部署文档 | 部署手册、运�?runbook、环境配置指�?|
| `docs/06-project-management/` | 项目管理 | 版本计划、进度报告、里程碑记录、任务分�?|
| `docs/07-archive/` | 归档 | 历史文档、废弃方案、已替代决策记录 |

> 详细分层规则参见 [AGENTS.md](../../AGENTS.md) 第一�?
---

## 二、命名规�?
| 对象 | 命名约定 | 示例 |
|------|---------|------|
| 文件�?| kebab-case �?PascalCase | `data-bridge.ts` / `DataBridge.ts` |
| 组件 | PascalCase | `CockpitShell.tsx` |
| Store | camelCase + `Store` 后缀 | `analysisStore.ts` |
| 常量 | UPPER_SNAKE_CASE | `ROUTE_REGISTRY` |
| 类型 | PascalCase + `Interface` 前缀 | `interface StockData` |
| UI 组件 import 路径 | 大小写必须一�?| `Card` 而非 `card` |

> 详细命名约定参见 [AGENTS.md](../../AGENTS.md) 第四�?
---

## 三、`.gitignore` 维护规则

### 2.1 新增忽略规则

当引入新的工具或生成新的产物类别时，必须同步更新 `.gitignore`�?
1. �?`.gitignore` 中添加对应的忽略规则
2. 根目录规则必须带前导 `/`（如 `/tsc_errors.txt`），避免误伤子目录同名文�?3. 添加分组注释说明忽略类别

### 2.2 已配置的忽略类别

| 类别 | 规则示例 | 说明 |
|---|---|---|
| 依赖 | `node_modules/` | npm 依赖 |
| 构建产物 | `dist/` | Vite 构建输出 |
| 环境配置 | `.env`, `.env.local` | 含敏感信息的本地配置 |
| IDE 产物 | `.vscode/`, `.idea/`, `.trae/` | 本地 IDE 配置 |
| 日志 | `*.log`, `logs/` | 运行日志 |
| 测试覆盖 | `coverage/` | 测试覆盖率报�?|
| Playwright | `/playwright-report/`, `.playwright-mcp/` | E2E 测试产物 |
| 临时目录 | `temp/` | 临时文件 |
| 根目录报�?| `/tsc_*.txt`, `/*_report.json` | 质量工具输出 |
| HTML 报告�?| `/v9-*-report/` | 生成式自包含报告 |
| 根目录脚�?| `/run-*.ps1`, `/test_*.py` | 一次性调试脚�?|
| OS 系统文件 | `.DS_Store`, `Thumbs.db` | macOS/Windows 系统文件 |
| Python 环境 | `.venv/`, `venv/`, `__pycache__/`, `*.pyc` | Python 虚拟环境和缓�?|
| Vite 构建产物 | `dist-ssr`, `.vite/`, `*.tsbuildinfo` | Vite 构建中间产物 |
| Playwright 截图 | `screenshots/` | E2E 测试截图 |
| 测试产物 | `/test-results/`, `/playwright/.cache/` | 测试运行产物 |
| 生成产物 | `*.report.md`, `*.audit.md`, `report-*.md` | 验证/审计生成报告 |
| 脚本产物 | `/scripts/component-audit-report.txt` | 脚本运行输出 |
| Vite 配置快照 | `vite.config.ts.timestamp-*.mjs` | Vite 临时配置 |
| Widget 测试日志 | `widget_test_logs/`, `widget_test_logs_run2/` | Widget 测试产物 |
| 构建变体 | `dist_s1verify/`, `dist_preview/`, `dist_e2e/`, `dist-e2e/` | 构建验证产物 |
| 代码质量合规 | `code-quality-compliance/`, `code-quality-compliance.zip` | 代码质量检查产�?|
| Agent 工作日志 | `.workbuddy/*.log` | AI Agent 工作日志 |
| 发布�?| `releases/`, `*.zip` | 发布归档 |
| 独立工具子包 | `tools/file-management-system/` | 工具子包（建议后续抽子仓�?|
| 治理备份 | `build-artifacts/` | 集中存放一次性生成物/治理备份 |
| 构建/测试快照 | `/dist-test/`, `/dist-verify/`, `/coverage_cmd/`, `/e2e-test-report/` | 构建/测试快照 |
| 根级审计日志 | `/lint_output.txt`, `/nested-code-review-report.json`, `/audit-*.txt` | 根级审计/日志/报告产物 |
| ESLint 缓存 | `.eslintcache` | ESLint 增量检查缓�?|

> 本文档基�?`.gitignore`�?67 行规则）编写，新增规则时须同步更新本节�?
---

## 四、数据层文件变更 SOP

修改 IndexedDB 相关文件时，必须按以下顺序执行同步操作：

1. **修改 `src/config/dbConfig.ts`** �?必须递增 `DB_VERSION`
2. **新增 store 注册** �?必须�?`STORE_NAME` 中注�?3. **新增 store 权限** �?必须�?`ACL_MATRIX` 中添加对应的 read/write 白名�?4. **新增 store 创建逻辑** �?按以下规则选择位置�?   - **基线 store**（首次安装时就需要的核心 store）→ �?`createSchema`（`src/data/db-schema.ts`）中添加
   - **增量 store**（版本升级时新增�?store）→ 在对应版本的 `Migration.up()`（`src/data/db-migrations.ts` �?`src/data/migrations/`）中添加
   - **禁止在两处同时添加同一 store 的创建逻辑**（违�?DRY 原则�?5. **新增 `ENVELOPE_ACTION`** �?必须�?`DataBridge.routeToDB()` 中添加对�?case

> 详细规则参见 [AGENTS.md](../../AGENTS.md) 第八�?
---

## 五、提交前检查清�?
每次提交前必须通过以下验证�?
```powershell
# 1. TypeScript 类型检查（0 errors�?npx tsc --noEmit

# 2. ESLint 检查（0 errors，warnings 可接受）
npm run lint

# 3. 架构分层审计�? violations, 0 warnings�?npm run audit:layers

# 4. 目录结构审计�? violations, 0 warnings�?npm run audit:directory

# 5. 颜色硬编码扫描（0 violations�?npm run audit:hardcode

# 6. 死代�?未注册页面扫描（0 unregistered�?npm run audit:deadcode

# 7. 文档同步状态检查（0 inconsistencies�?npm run audit:docs

# 8. Token 消耗检测（0 violations�?npm run audit:token

# 9. AI 输出结构校验�? violations�?npm run audit:ai-output
```

### 提交�?6 步迁移检查单

当你要迁移或重命名一个文档时，必须按顺序执行�?
1. **确认主路�?*：确认新文档的权威位置，旧路径只保留兼容页�?2. **登记重定�?*：在 [docs/_redirect-map.json](../_redirect-map.json) 中新增旧→新映射�?3. **更新主索�?*：同步更�?[docs/README.md](../README.md) 和相关子目录索引�?4. **替换引用**：将仓库内对旧路径的引用改成新路径，避免继续传播旧入口�?5. **保留兼容�?*：旧文件内容最少，只保留说明和跳转链接�?6. **执行审计**：运�?`npm run audit:docs` �?`npm run audit:directory`，确认无异常�?
### 提交规范

- 遵循 Conventional Commits 格式：`<type>[scope]: <description>`
- type 可选：`feat`、`fix`、`docs`、`refactor`、`test`、`chore`、`ci`
- description 使用祈使句（英文）或动宾短语（中文），不超过 72 字符

---

## 六、生命周期管�?
### 6.0 文档迁移 SOP�? 段式�?
当你进行文档迁移、重命名或旧路径兼容处理时，请按以下 4 个阶段执行：

1. **前置准备**
   - 确认文档的主路径与兼容路径�?   - 先阅�?[AGENTS.md](../../AGENTS.md) 与相关索引，避免新旧路径漂移�?   - 确定是否需要保留兼容页、重定向映射或仅更新内部引用�?
2. **执行迁移**
   - 在新路径下维护正式内容�?   - 旧路径仅保留轻量兼容页，内容最少，只保留说明和跳转链接�?   - �?[docs/_redirect-map.json](../_redirect-map.json) 中登记旧→新映射�?   - 同步更新 [docs/README.md](../README.md) 与相关子目录索引�?
3. **验证审计**
   - 执行 `npm run audit:docs`
   - 执行 `npm run audit:directory`
   - 检查仓库内旧路径引用是否已替换，避免继续传播�?
4. **收尾归档**
   - 确认版本号和日期已更新�?   - 将迁移说明写�?PR 描述，方便后续回溯�?   - 若有历史文档需要归档，统一迁入 [docs/07-archive/](../07-archive/)�?
### 文档迁移 PR 模板

当你进行文档迁移、重命名或旧路径兼容处理时，建议�?PR 描述中附上以下模板：

```md
## 文档迁移说明
- 迁移目标�?- 旧路径：
- 新路径：
- 是否保留兼容页：�?/ �?- 是否已登记重定向：是 / �?- 是否已更新主索引：是 / �?- 是否已替换内部引用：�?/ �?- 验证命令：npm run audit:docs && npm run audit:directory
```

### 6.1 AI 生成产物管理

- **存放位置**：`docs/drafts/` �?AI 辅助生成的草�?建议文件专用目录
- **当前存量**�? 个文件（api-doc-draft-*.md 2个、complete-api-doc.md 1个、doc-update-list-*.md 2个、doc-update-suggestion-*.md 3个、script-output-*.log 1个）
- **保留期限**�?  - `.md` 草稿文件：生成后 7 天内若未采纳/迁移，应归档�?`docs/07-archive/drafts/` 或删�?  - `.log` 输出文件：生成后 3 天内保留，过期删�?- **迁移规则**：有价值的草稿内容应在 7 天内合并到正式文档（`docs/01-requirements/`、`docs/03-development/` 等），并删除原草�?- **命名规范**：AI 生成文件建议带时间戳前缀，如 `doc-update-suggestion-YYYY-MM-DDTHH-mm-ss.md`

### 6.2 临时文件清理策略

- **存放位置**：`temp/` 已在 `.gitignore` 中忽略，不进入版本控�?- **当前存量**�?3 个文件（agent_fail*.log、backend_verification_report.json、build_output.txt、check-vitest-env.test.ts、clean*.log、cockpit*.log、coverage-run*.log 等）
- **保留期限**�?  - `.log` 日志文件：保�?7 天，过期自动清理
  - `.json`/`.txt` 报告：保�?14 天，过期归档或删�?  - `.test.ts` 临时测试文件：验证完成后立即删除
- **自动化方�?*：建议添�?`scripts/other/cleanup-reports.ts`，在 `npm run audit` �?CI 中调用，清理超过保留期限的文�?- **手动清理命令**�?  ```powershell
  # 清理 7 天前的日�?  find temp/ -name "*.log" -mtime +7 -delete
  # 清理 14 天前的报�?  find temp/ -name "*.json" -o -name "*.txt" | Where-Object { $_.LastWriteTime -lt (Get-Date).AddDays(-14) } | Remove-Item
  ```

---

## 七、AI 辅助开发操作规范（docs-as-mirror�?
> **Source**：`../../.agents/skills/feature-window-context-doc/SKILL.md` v1.0.0 + `../../prompts/docs-as-mirror-quickref.md`
> **目的**：防�?AI 辅助编写文档时出现架构漂移、信息孤岛、版本号不一致等系统性错�?
### 7.1 五大核心原则

编写或更新任何技术文档前，必须遵守以�?5 大原则：

1. **Truth-First（真相优先）**：先读取 `../../AGENTS.md` 当前版本，再写文档，不凭记忆�?2. **Scan-Before-Write（先扫描后编写）**：先执行 `find`/`cat` 扫描实际文件系统，再写描述，不用模板�?3. **Exhaustiveness（穷尽性原则）**：文件管理规范必须包�?8 个必含章节（目录映射、命名、`.gitignore`、提交前检查、定期审计、生命周期管理、交叉引用、变更日志），不允许"最小化原则"�?4. **Bidirectional Linking（双向引用）**：新文档必须注册到索引、引用相关文档、被相关文档反向引用——三步骤缺一不可�?5. **Version Pinning（版本锁定）**：文档头部必须声明兼容的 `../../AGENTS.md` 版本号（�?`兼容 ../../AGENTS.md v1.4.5+`）�?
### 7.2 10 行快速检查清单（编写任何文档前逐行确认�?
```
1. [ ] 已读�?AGENTS.md 当前版本，记录版本号（当�?v1.4.5�?2. [ ] 已提�?AGENTS.md §一 全部目录定义�?2 �?src/ 子目�?+ 扩展目录�?3. [ ] 已扫描实际文件系统（find . -maxdepth 2 -type d），所有非标准目录有说�?4. [ ] 已读取实�?.gitignore（cat .gitignore），文档覆盖�?�?95%
5. [ ] 已区分相似目录（agents/ vs .agents/skills/，utils/ vs lib/ 等）
6. [ ] 文档包含 8 个必含章节（目录映射、命名�?gitignore、提交前检查、定期审计、生命周期、交叉引用、变更日志）
7. [ ] 已注册到文档索引（docs/README.md �?registry-index.md�?8. [ ] 已建立双向引用（文档引用 AGENTS.md，AGENTS.md 反向引用本文档）
9. [ ] 文档头部声明版本号体系（项目级版�?+ 文档修订�?+ 兼容 AGENTS.md 版本�?10. [ ] 已运�?npm run audit:directory && npm run audit:docs，结�?0 违规
```

### 7.3 验证命令

```powershell
# 目录结构审计�?2/22 匹配�?npm run audit:directory

# 文档同步审计�? inconsistencies�?npm run audit:docs

# 全量审计
npm run audit
```

---

## 八、定期审�?
### 8.1 未跟踪文件检�?
每月执行一次：

```powershell
git status --short | Select-String -Pattern '^\?\?'
```

若结果非空，需分析未跟踪文件来源并按本规范处置�?
### 8.2 `.gitignore` 有效性检�?
每季度执行一次：

```powershell
# 检查是否有已跟踪文件应被忽�?git ls-files | ForEach-Object { git check-ignore -q $_ }
```

---

## 九、变更日�?
| 版本 | 日期 | 变更摘要 |
|------|------|----------|
| v1.4.0 | 2026-07-20 | P2 补全：新�?monorepo/多语言目录规范（packages/python/plugins）；新增生命周期管理章节（AI产物管理+temp清理策略）；章节重编�?|
| v1.3.2 | 2026-07-20 | Phase 5：新�?`src/generated/` �?`.gitignore` 规则�?`prebuild` 令牌生成步骤；将 `npm run audit:directory` 纳入提交前检查清单；AGENTS.md 补充 `src/agents/` �?`src/types/` �?§一目录列表 |
| v1.3.1 | 2026-07-20 | Phase 4：系统性目录梳理——补�?AGENTS.md 遗漏�?`mcp/`、`schema/`、`showcase/`、`generated/`，新增依赖方向规则，同步 file-management-guide.md 目录映射 |
| v1.3.0 | 2026-07-20 | Phase 3：补�?AGENTS.md 未定义目录（hooks/、devtools/、fixtures/、i18n/），同步 file-management-guide.md 目录映射和依赖方向规�?|
| v1.2.0 | 2026-07-20 | Phase 2：同�?.gitignore 文档，新�?docs/ 分层规范，新增数据层文件变更 SOP，建立跨文档引用链路 |
| v1.1.0 | 2026-07-20 | Phase 1：补�?src/ 目录映射，区�?agents 目录，新增命名规�?|
| v1.0.0 | 2026-07-02 | 初始版本：文件归位�?gitignore 维护、提交前检查、定期审�?|

---

## 十、相关文�?
- **[AGENTS.md](../../AGENTS.md)**：V9 架构契约、分层规则、命名约定、验证命令、数据库版本管理
- **[trae-file-management-review.md](../00-meta/trae-file-management-review.md)**：更详细的文件管理审查报告（Trae IDE 生成�?- **[README.md](../README.md)**：文档体系主索引（`docs/01-requirements/` 目录说明�?

<!-- merge-source: docs/reference/file-management-guide.md (2026-07-14 内容融合，避免去重丢失有效信�? -->
## 补充内容（合并自旧版文件管理规范�?
| 类型 | 位置 | 说明 |
|------|------|------|
| 源代�?| `src/` | 按分层规则放�?`core/`、`data/`、`services/`、`store/`、`pages/`、`components/` |
| AI Skill | `.agents/skills/` | AI 辅助技能定�?|

### 补充说明
- 旧版规范中关�?`.gitignore`、提交前检查和未跟踪文件清理的要求，已并入本文件的对应章节�?- 若后续继续有旧版规范内容需要迁移，优先合并到本文件的相应章节，而不是继续在文末新增散落段落�?