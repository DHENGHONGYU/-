---
title: file-management-guide
code_version: "2.0.0-rc.1"
tier: important
version: v1.5.0
last_updated: 2026-08-11
change_log:
  - version: v1.5.0
    changes: "P0 版本闭环(2026-08-11)：补全 change_log 初始条目"
    date: 2026-08-11
---



# V9 文件管理规范

> **版本**: v1.5.0 | **日期**: 2026-07-22
> **适用范围**: 智能投研复盘系统V9 全体开发者及 AI 辅助工具

---

## 一、文件归位规则

| 文件类型 | 存放目录 | 说明 |
|---|---|---|
| 源代码 | `src/` | 按分层规则放入 `config/`、`core/`、`data/`、`lib/`、`services/`、`store/`、`pages/`、`components/`、`portal/`、`constants/`、`types/`、`apps/`、`cockpit/`、`hooks/`、`devtools/`、`fixtures/`、`i18n/`、`mcp/`、`schema/`、`showcase/`、`generated/` |
| App 分发器 | `src/apps/` | React.lazy 页面加载，三级加载链中间层 |
| 自定义 Hooks | `src/hooks/` | 跨组件共享逻辑，可依赖 `store/`、`services/` 和 `lib/` |
| 开发工具 | `src/devtools/` | 开发环境调试工具（DEV 注入），仅开发环境使用 |
| Mock 数据 | `src/fixtures/` | 测试数据供给，仅被 `tests/` 依赖 |
| 国际化 | `src/i18n/` | 国际化配置与翻译资源，可被 `components/` 和 `pages/` 引用 |
| AI 行为扩展 | `src/agents/` | 运行时模块，core 层扩展，仅可依赖 `core/` 和 `data/` |
| MCP 服务器层 | `src/mcp/` | 20+ 子服务器（analysis/backtest/...），服务层扩展，可依赖 `core/`/`data/`/`lib/`/`services/` |
| Schema 校验定义 | `src/schema/` | Zod/JSON Schema 校验定义，仅可依赖 `types/` 和 `constants/`，可被 `services/`/`data/`/`components/` 引用 |
| 组件展示页 | `src/showcase/` | 开发环境专用展示页（不进入生产构建），仅可依赖 `components/`/`constants/`/`lib/` |
| 代码生成产物 | `src/generated/` | 令牌/类型/脚本自动生成产物，零依赖，可被 `services/`/`components/`/`pages/` 引用 |
| 单元测试 | `tests/` 或 `src/**/*.test.ts` | 与源文件同目录的测试需以 `.test.ts`/`.test.tsx` 结尾 |
| E2E 测试 | `e2e/` | Playwright `.spec.ts` 文件 |
| 脚本工具 | `scripts/` | 构建、审计、数据迁移脚本 |
| 文档规范 | `docs/` | 需求、架构、数据字典、实现文档 |
| 审计报告 | `docs/audit/` | 质量审计、架构扫描报告 |
| 临时输出 | `temp/` | 已在 `.gitignore` 中忽略 |
| 提示词模板 | `prompts/` | 系统提示词模板存放目录 |
| AI Skill 定义 | `.agents/skills/` | AI 技能定义文件（系统提示词模板） |
| CI/CD | `.github/workflows/` | GitHub Actions 工作流 |
| Monorepo 子包 | `packages/` | 可独立发布的子包（audit-utils、store-audit） |
| Python 数据服务 | `python/data_service/` | Python 数据服务层，含 MCP 数据服务子目录 |
| MCP/数据源插件 | `plugins/` | 10 子目录：ifind/imf/kimi-webbridge/scholar/sec_edgar/tianyancha/world_bank_open_data/yahoo_finance/yuandian_law + README.md |

### 禁止事项

- **禁止**在仓库根目录直接创建 `.ts`、`.tsx`、`.ps1`、`.py` 脚本文件
- **禁止**在仓库根目录直接创建报告文件（`.md`、`.json`、`.txt`）
- **禁止**将工具运行输出（`tsc`/`eslint`/`vitest`）重定向到仓库根目录
- **禁止**在根目录新建与 `packages/`、`python/`、`plugins/` 职责重叠的独立目录

### 例外条款

以下文件不受根目录禁止规则限制：
- 标准项目配置文件：`package.json`、`tsconfig.*.json`、`*.config.ts`、`vite.config.ts` 等
- 项目根级文档：`../../README.md`、`../../AGENTS.md`、`../../CHANGELOG.md` 等
- CI/CD 配置文件：`.github/workflows/*.yml`、`.husky/*` 等

#### docs/ 根目录允许文件清单（2026-08-03 更新）

`docs/` 根目录仅保留以下核心概览文档与索引文件，其余文档必须归入 `NN-语义/` 子目录：

| 类别 | 允许文件 | 说明 |
|------|----------|------|
| 编号核心文档 | `01-vision-and-goals.md` ~ `10-glossary.md` | 01-10 编号系列，已合并权威版本 |
| 变更与发布 | `CHANGELOG.md`、`RELEASE_NOTES.md` | 变更日志与发布说明 |
| 审查与规范 | `CODE-REVIEW.md`、`design-tokens.md`、`testing-strategy.md`、`widget-development-guide.md` | 代码审查、设计令牌、测试策略、Widget 开发指南 |
| 索引与导航 | `README.md`、`registry-index.md`（重定向页）、`REGISTRY_INDEX.md` | 文档导航与模块注册索引 |
| 技术债务 | `TECH-DEBT.md` | 技术债务追踪 |
| 数据定义 | `AI_CENTER_DATA_DEFINITION.md`、`BACKTEST_DATA_DEFINITION.md`、`DATAFLOW_DATA_DEFINITION.md`、`DATA_DICTIONARY_INDEX.md`、`multi-factor-screening-data-definition.md`、`news/DATA_DEFINITION.md`、`seven-dim-config-data-definition.md`、`v9-indexeddb-store-schema.md` | 数据字典（被多处引用，待后续迁移至 `reference/`） |
| 配置文件 | `_redirect-map.json`、`class-diagram.mermaid` | 文档重定向映射与类图 |

### docs/ 子目录分层

`docs/` 目录采用 `NN-语义/` 编号分层体系，所有文档必须放入对应子目录：

| 子目录 | 用途 | 存放内容 |
|--------|------|----------|
| `docs/meta/` | 元数据与运维 | 文档索引、审计报告、任务清单、RCA 报告 |
| `docs/specs/requirements/` | 需求与规范 | 需求文档、管理规范、质量标准、设计约束 |
| `docs/specs/design/` | 设计文档 | 架构设计、数据流、策略文档、接口契约 |
| `docs/guides/development/` | 开发指南 | 编码规范、迁移检查清单、开发手册、构建说明 |
| `docs/reports/testing/` | 测试文档 | 测试计划、测试报告、修复方案、覆盖率分析 |
| `docs/05-deployment/` | 部署文档 | 部署手册、运维 runbook、环境配置指南 |
| `docs/reports/project-management/` | 项目管理 | 版本计划、进度报告、里程碑记录、任务分配 |
| `docs/07-archive/` | 归档 | 历史文档、废弃方案、已替代决策记录 |

> 详细分层规则参见 [AGENTS.md](../../AGENTS.md) 第一节

---

## 二、命名规范

| 对象 | 命名约定 | 示例 |
|------|---------|------|
| 文件名 | kebab-case 或 PascalCase | `data-bridge.ts` / `DataBridge.ts` |
| 组件 | PascalCase | `CockpitShell.tsx` |
| Store | camelCase + `Store` 后缀 | `analysisStore.ts` |
| 常量 | UPPER_SNAKE_CASE | `ROUTE_REGISTRY` |
| 类型 | PascalCase + `Interface` 前缀 | `interface StockData` |
| UI 组件 import 路径 | 大小写必须一致 | `Card` 而非 `card` |

> 详细命名约定参见 [AGENTS.md](../../AGENTS.md) 第四节

---

## 三、`.gitignore` 维护规则

### 2.1 新增忽略规则

当引入新的工具或生成新的产物类别时，必须同步更新 `.gitignore`：

1. 在 `.gitignore` 中添加对应的忽略规则
2. 根目录规则必须带前导 `/`（如 `/tsc_errors.txt`），避免误伤子目录同名文件
3. 添加分组注释说明忽略类别

### 2.2 已配置的忽略类别

| 类别 | 规则示例 | 说明 |
|---|---|---|
| 依赖 | `node_modules/` | npm 依赖 |
| 构建产物 | `dist/` | Vite 构建输出 |
| 环境配置 | `.env`, `.env.local` | 含敏感信息的本地配置 |
| IDE 产物 | `.vscode/`, `.idea/`, `.trae/` | 本地 IDE 配置 |
| 日志 | `*.log`, `logs/` | 运行日志 |
| 测试覆盖 | `coverage/` | 测试覆盖率报告 |
| Playwright | `/playwright-report/`, `.playwright-mcp/` | E2E 测试产物 |
| 临时目录 | `temp/` | 临时文件 |
| 根目录报告 | `/tsc_*.txt`, `/*_report.json` | 质量工具输出 |
| HTML 报告包 | `/v9-*-report/` | 生成式自包含报告 |
| 根目录脚本 | `/run-*.ps1`, `/test_*.py` | 一次性调试脚本 |
| OS 系统文件 | `.DS_Store`, `Thumbs.db` | macOS/Windows 系统文件 |
| Python 环境 | `.venv/`, `venv/`, `__pycache__/`, `*.pyc` | Python 虚拟环境和缓存 |
| Vite 构建产物 | `dist-ssr`, `.vite/`, `*.tsbuildinfo` | Vite 构建中间产物 |
| Playwright 截图 | `screenshots/` | E2E 测试截图 |
| 测试产物 | `/test-results/`, `/playwright/.cache/` | 测试运行产物 |
| 生成产物 | `*.report.md`, `*.audit.md`, `report-*.md` | 验证/审计生成报告 |
| 脚本产物 | `/scripts/component-audit-report.txt` | 脚本运行输出 |
| Vite 配置快照 | `vite.config.ts.timestamp-*.mjs` | Vite 临时配置 |
| Widget 测试日志 | `widget_test_logs/`, `widget_test_logs_run2/` | Widget 测试产物 |
| 构建变体 | `dist_s1verify/`, `dist_preview/`, `dist_e2e/`, `dist-e2e/` | 构建验证产物 |
| 代码质量合规 | `code-quality-compliance/`, `code-quality-compliance.zip` | 代码质量检查产物 |
| Agent 工作日志 | `.workbuddy/*.log` | AI Agent 工作日志 |
| 发布包 | `releases/`, `*.zip` | 发布归档 |
| 独立工具子包 | `tools/file-management-system/` | 工具子包（建议后续抽子仓） |
| 治理备份 | `build-artifacts/` | 集中存放一次性生成物/治理备份 |
| 构建/测试快照 | `/dist-test/`, `/dist-verify/`, `/coverage_cmd/`, `/e2e-test-report/` | 构建/测试快照 |
| 根级审计日志 | `/lint_output.txt`, `/nested-code-review-report.json`, `/audit-*.txt` | 根级审计/日志/报告产物 |
| ESLint 缓存 | `.eslintcache` | ESLint 增量检查缓存 |

> 本文档基于 `.gitignore`（167 行规则）编写，新增规则时须同步更新本节。

---

## 四、数据层文件变更 SOP

修改 IndexedDB 相关文件时，必须按以下顺序执行同步操作：

1. **修改 `src/config/dbConfig.ts`** → 必须递增 `DB_VERSION`
2. **新增 store 注册** → 必须在 `STORE_NAME` 中注册
3. **新增 store 权限** → 必须在 `ACL_MATRIX` 中添加对应的 read/write 白名单
4. **新增 store 创建逻辑** → 按以下规则选择位置：
   - **基线 store**（首次安装时就需要的核心 store）→ 在 `createSchema`（`src/data/db-schema.ts`）中添加
   - **增量 store**（版本升级时新增的 store）→ 在对应版本的 `Migration.up()`（`src/data/db-migrations.ts` 或 `src/data/migrations/`）中添加
   - **禁止在两处同时添加同一 store 的创建逻辑**（违反 DRY 原则）
5. **新增 `ENVELOPE_ACTION`** → 必须在 `DataBridge.routeToDB()` 中添加对应 case

> 详细规则参见 [AGENTS.md](../../AGENTS.md) 第八节

---

## 五、提交前检查清单

每次提交前必须通过以下验证：

```powershell
# 1. TypeScript 类型检查（0 errors）
npx tsc --noEmit

# 2. ESLint 检查（0 errors，warnings 可接受）
npm run lint

# 3. 架构分层审计（0 violations, 0 warnings）
npm run audit:layers

# 4. 目录结构审计（0 violations, 0 warnings）
npm run audit:directory

# 5. 颜色硬编码扫描（0 violations）
npm run audit:hardcode

# 6. 死代码/未注册页面扫描（0 unregistered）
npm run audit:deadcode

# 7. 文档同步状态检查（0 inconsistencies）
npm run audit:docs

# 8. Token 消耗检测（0 violations）
npm run audit:token

# 9. AI 输出结构校验（0 violations）
npm run audit:ai-output
```

> **验证命令完整覆盖**：AGENTS.md 教训5 规定的 7 项核心验证命令（`tsc`、`lint`、`audit:layers`、`audit:hardcode`、`audit:deadcode`、`audit:docs`、`audit:token`）已在上文清单中全部列出（#1 `tsc`、#2 `lint`、#3 `audit:layers`、#5 `audit:hardcode`、#6 `audit:deadcode`、#7 `audit:docs`、#8 `audit:token`）；其余 `audit:directory` / `audit:ai-output` 为项目扩展项，不与 7 项冲突。

### 提交规范

- 遵循 Conventional Commits 格式：`<type>[scope]: <description>`
- type 可选：`feat`、`fix`、`docs`、`refactor`、`test`、`chore`、`ci`
- description 使用祈使句（英文）或动宾短语（中文），不超过 72 字符

---

## 六、生命周期管理（入-移-出 全覆盖）

> 覆盖 AGENTS.md 教训5「文件管理规范必须覆盖"入-移-出"全生命周期」：入（创建）= §6.0，移（迁移）= §6.3，出（清理/归档）= §6.1 / §6.2 / §6.4。

### 6.0 入（创建）规则

- **目录命中**：新文件/目录必须能在 §一 目录映射表中找到归属；无匹配项时先增补映射规则再创建，**禁止**在仓库根目录散落（见 §一 禁止事项）。
- **命名命中**：文件名/目录名必须命中 §二 命名规范（kebab-case / PascalCase / UPPER_SNAKE_CASE）。
- **集成顺序**：新建源码模块必须遵循「类型 → Store → Service → UI」四步集成契约（AGENTS.md §二），每步可独立回滚。
- **引用注册**：新文件创建后必须纳入索引并被相关文档反向引用（双向引用，见 §七 7.2），避免信息孤岛。

### 6.1 AI 生成产物管理

- **存放位置**：`docs/archive/drafts/` 为 AI 辅助生成的草稿/建议文件专用目录
- **当前存量**：9 个文件（api-doc-draft-*.md 2个、complete-api-doc.md 1个、doc-update-list-*.md 2个、doc-update-suggestion-*.md 3个、script-output-*.log 1个）
- **保留期限**：
  - `.md` 草稿文件：生成后 7 天内若未采纳/迁移，应归档至 `docs/07-archive/drafts/` 或删除
  - `.log` 输出文件：生成后 3 天内保留，过期删除
- **迁移规则**：有价值的草稿内容应在 7 天内合并到正式文档（`docs/specs/requirements/`、`docs/guides/development/` 等），并删除原草稿
- **命名规范**：AI 生成文件建议带时间戳前缀，如 `doc-update-suggestion-YYYY-MM-DDTHH-mm-ss.md`

### 6.2 临时文件/目录清理策略

- **存放位置**：`temp/` 已在 `.gitignore` 中忽略，不进入版本控制
- **当前存量**：83 个文件（agent_fail*.log、backend_verification_report.json、build_output.txt、check-vitest-env.test.ts、clean*.log、cockpit*.log、coverage-run*.log 等）
- **保留期限**：
  - `.log` 日志文件：保留 7 天，过期自动清理
  - `.json`/`.txt` 报告：保留 14 天，过期归档或删除
  - `.test.ts` 临时测试文件：验证完成后立即删除
- **自动化方案**：建议添加 `scripts/cleanup-temp.ts`，在 `npm run audit` 或 CI 中调用，清理超过保留期限的文件
- **手动清理命令**：
  ```powershell
  # 清理 7 天前的日志
  find temp/ -name "*.log" -mtime +7 -delete
  # 清理 14 天前的报告
  find temp/ -name "*.json" -o -name "*.txt" | Where-Object { $_.LastWriteTime -lt (Get-Date).AddDays(-14) } | Remove-Item
  ```

### 6.3 文件迁移 SOP（移）

文件从一个目录迁移到另一个目录的标准作业流程；完成后必须执行 §五 提交前检查清单全绿，其中 `audit:layers` 为强制项（AGENTS.md 教训5 第4条）。

1. **规划影响面**：列出源路径、目标路径，用 Grep 全仓检索旧路径的所有引用（含大小写变体）。
2. **import 路径更新**：使用 IDE 重构或批量替换更新所有 `import ... from '<old>'` / `require('<old>')`；注意 **Windows 文件系统大小写不敏感但 Git 大小写敏感**，路径大小写必须与目标文件实际大小写一致。
3. **旧路径清理**：删除源文件/目录，确认无残留空目录；若源为被引用模块，先完成第 2 步再删。
4. **跨层调用检查（强制）**：迁移后必须执行 `npm run audit:layers` 确认无跨层违规——尤其避免把上层模块（`pages`/`components`）误迁入下层（`core`/`lib`/`config`）。
5. **全文件类型残留扫描**：参照 AGENTS.md §二「迁移收尾」扫描 `src/`、`scripts/`、`docs/`（排除历史报告）、`prompts/`、`AGENTS.md`、`.husky/` 中的旧路径残留，覆盖 `.ts`/`.tsx`/`.md`/`.json`/`.mjs`/`.cjs`/`.yaml`/`.yml`/`.sh`；**重点检查 `AGENTS.md` 目录描述**——引用旧目录会直接导致 AI 生成错误代码。
6. **文档同步**：更新 §一 目录映射表、§十 相关文档交叉引用；若迁移涉及目录职责变化，同步 AGENTS.md §一。
7. **验证收尾**：运行 §五 提交前检查清单（9 项）全部 0 违规，再提交。

### 6.4 废弃目录清理时机（出）

- **标注**：废弃目录必须在 §一 目录映射表注明 `⚠️ 已废弃` 与**保留截止版本**（参照 AGENTS.md 教训6：`src/utils/` 保留至 v1.5.0 迁移期结束）。
- **清理前置条件**（三者同时满足方可清理）：
  1. 已达保留截止版本；
  2. Grep 全仓 0 命中该目录引用；
  3. `npm run audit:layers` 0 违规。
- **归档 vs 删除**：历史文档/废弃方案迁入 `docs/07-archive/`；纯一次性生成物（已被 `.gitignore` 覆盖）直接删除，无需归档。
- **操作**：满足条件后 `git rm -r <dir>` 并提交，补记 §九 变更日志。

---

## 七、AI 辅助开发操作规范（docs-as-mirror）

> **来源**：`.agents/skills/docs-as-mirror/SKILL.md` v1.0.0 + `prompts/docs-as-mirror-quickref.md`
> **目的**：防止 AI 辅助编写文档时出现架构漂移、信息孤岛、版本号不一致等系统性错误

### 7.1 五大核心原则

编写或更新任何技术文档前，必须遵守以下 5 大原则：

1. **Truth-First（真相优先）**：先读取 `../../AGENTS.md` 当前版本，再写文档，不凭记忆。
2. **Scan-Before-Write（先扫描后编写）**：先执行 `find`/`cat` 扫描实际文件系统，再写描述，不用模板。
3. **Exhaustiveness（穷尽性原则）**：文件管理规范必须包含 8 个必含章节（目录映射、命名、`.gitignore`、提交前检查、定期审计、生命周期管理、交叉引用、变更日志），不允许"最小化原则"。
4. **Bidirectional Linking（双向引用）**：新文档必须注册到索引、引用相关文档、被相关文档反向引用——三步骤缺一不可。
5. **Version Pinning（版本锁定）**：文档头部必须声明兼容的 `../../AGENTS.md` 版本号（如 `兼容 ../../AGENTS.md v1.4.5+`）。

### 7.2 10 行快速检查清单（编写任何文档前逐行确认）

```
1. [ ] 已读取 AGENTS.md 当前版本，记录版本号（当前 v1.4.5）
2. [ ] 已提取 AGENTS.md §一 全部目录定义（22 个 src/ 子目录 + 扩展目录）
3. [ ] 已扫描实际文件系统（find . -maxdepth 2 -type d），所有非标准目录有说明
4. [ ] 已读取实际 .gitignore（cat .gitignore），文档覆盖率 ≥ 95%
5. [ ] 已区分相似目录（agents/ vs .agents/skills/，utils/ vs lib/ 等）
6. [ ] 文档包含 8 个必含章节（目录映射、命名、.gitignore、提交前检查、定期审计、生命周期、交叉引用、变更日志）
7. [ ] 已注册到文档索引（docs/README.md 或 registry-index.md）
8. [ ] 已建立双向引用（文档引用 AGENTS.md，AGENTS.md 反向引用本文档）
9. [ ] 文档头部声明版本号体系（项目级版本 + 文档修订号 + 兼容 AGENTS.md 版本）
10. [ ] 已运行 npm run audit:directory && npm run audit:docs，结果 0 违规
```

### 7.3 验证命令

```powershell
# 目录结构审计（22/22 匹配）
npm run audit:directory

# 文档同步审计（0 inconsistencies）
npm run audit:docs

# 全量审计
npm run audit
```

---

## 八、定期审计

### 8.1 未跟踪文件检查

每月执行一次：

```powershell
git status --short | Select-String -Pattern '^\?\?'
```

若结果非空，需分析未跟踪文件来源并按本规范处置。

### 8.2 `.gitignore` 有效性检查

每季度执行一次：

```powershell
# 检查是否有已跟踪文件应被忽略
git ls-files | ForEach-Object { git check-ignore -q $_ }
```

---

## 九、变更日志

| 版本 | 日期 | 变更摘要 |
|------|------|----------|
| v1.5.0 | 2026-07-22 | 补全 AGENTS.md 教训5「入-移-出」全生命周期：§六 重构为「入(6.0)/移(6.3 文件迁移 SOP)/出(6.1/6.2/6.4 废弃目录清理)」；6.2 标题对齐「临时文件/目录清理策略」；§五 显式声明 7 项核心验证命令全覆盖 |
| v1.4.0 | 2026-07-20 | P2 补全：新增 monorepo/多语言目录规范（packages/python/plugins）；新增生命周期管理章节（AI产物管理+temp清理策略）；章节重编号 |
| v1.3.2 | 2026-07-20 | Phase 5：新增 `src/generated/` 的 `.gitignore` 规则与 `prebuild` 令牌生成步骤；将 `npm run audit:directory` 纳入提交前检查清单；AGENTS.md 补充 `src/agents/` 和 `src/types/` 到 §一目录列表 |
| v1.3.1 | 2026-07-20 | Phase 4：系统性目录梳理——补全 AGENTS.md 遗漏的 `mcp/`、`schema/`、`showcase/`、`generated/`，新增依赖方向规则，同步 file-management-guide.md 目录映射 |
| v1.3.0 | 2026-07-20 | Phase 3：补充 AGENTS.md 未定义目录（hooks/、devtools/、fixtures/、i18n/），同步 file-management-guide.md 目录映射和依赖方向规则 |
| v1.2.0 | 2026-07-20 | Phase 2：同步 .gitignore 文档，新增 docs/ 分层规范，新增数据层文件变更 SOP，建立跨文档引用链路 |
| v1.1.0 | 2026-07-20 | Phase 1：补全 src/ 目录映射，区分 agents 目录，新增命名规范 |
| v1.0.0 | 2026-07-02 | 初始版本：文件归位、.gitignore 维护、提交前检查、定期审计 |

---

## 十、相关文档

- **[AGENTS.md](../../AGENTS.md)**：V9 架构契约、分层规则、命名约定、验证命令、数据库版本管理
- **[trae-file-management-review.md](../00-meta/trae-file-management-review.md)**：更详细的文件管理审查报告（Trae IDE 生成）
- **[README.md](../README.md)**：文档体系主索引（`docs/specs/requirements/` 目录说明）


<!-- merge-source: docs/reference/file-management-guide.md (2026-07-14 内容融合，避免去重丢失有效信息) -->
## 补充内容（合并自 `./file-management-guide.md`）

| 源代码 | `src/` | 按分层规则放入 `core/`、`data/`、`services/`、`store/`、`pages/`、`components/` |
| AI Skill | `.agents/skills/` | AI 辅助技能定义 |
## 二、`.gitignore` 维护规则
## 三、提交前检查清单
每次提交前必须通过以下三项验证：
### 4.1 未跟踪文件检查
### 4.2 `.gitignore` 有效性检查
