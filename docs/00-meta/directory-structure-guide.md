---
title: directory-structure-guide
code_version: 2.0.0

tier: core
---

---
title: docs/00-meta/directory-structure-guide.md
code_version: 2.0.0
tier: core
---

# V9 项目目录结构规范与使用指南

> **Version**: v3.1.1  
> **Last Updated**: 2026-07-15  
> **Maintainer**: 架构资产治理官  
> **Purpose**: 为 APP 开发团队建立规范的文件管理体系；本版基于 2026-07-13 目录结构审计修订并修复文档→代码引用，对齐权威契约 `../../AGENTS.md`
> **权威事实源**: 任何目录/分层争议以 `../../AGENTS.md` 为准
> **Enhancement**: 新增「核心检查文档与自动化校验清单」章节，解决代码先行文档滞后问题

---

## 一、目录结构总览

```
V9/                                  # 项目根目录
├── .agents/                         # AI 技能定义（.agents/skills/）；注意与 src/agents/（运行时模块）区分
├── .codebuddy/                     # 代码助手配置
├── .github/                        # GitHub 配置（CI/CD、PR 模板等）
├── .husky/                         # Git Hooks 配置（pre-commit / pre-push 门禁）
├── .workbuddy/                     # 工作助手配置（memory、skills、tmp）
├── archive/                        # 归档目录（过时资源、历史备份）
├── code-quality-compliance/        # 代码质量合规报告与门禁基线
├── coverage/                       # 测试覆盖率产物（构建生成，建议 gitignore）
├── design-tokens/                  # 设计令牌（主题变量定义）
├── dist/                           # 生产构建产物（构建生成，建议 gitignore）
├── docs/                           # 项目文档（按阶段分类）
├── e2e/                           # 端到端测试
├── eslint-rules/                   # 自定义 ESLint 规则
├── outputs/                        # 生成物/产物输出（110MB，多为自动生成，建议 gitignore 或定期清理）
├── packages/                       # 子包（独立发布模块）
├── plugins/                        # 插件系统（第三方服务集成）
├── prompts/                        # AI 提示词模板
├── public/                         # 静态资源（入口 HTML、图标等）
├── python/                         # Python 工具/脚本（数据分析等辅助）
├── releases/                       # 发布归档（zip 包）
├── scripts/                        # 开发脚本（审计、构建、工具、文档自动更新等）
├── src/                            # 源代码（核心应用逻辑）
├── tests/                          # 单元测试与集成测试
├── tools/                          # 开发工具/辅助脚本集合
└── [配置文件]                      # 根目录配置文件（tsconfig*.json、vite.config.ts、tailwind.config.js、eslint*.config.js、package.json、index.html 等）
```

> **工具/IDE/环境点目录（按需存在，不一一列举）**：`.trae/`、`.trae-cn/`、`.cursorrules`、`.dbg/`、`.playwright-mcp/`、`.venv/`、`.vscode/`、`.npmrc`、`.nvmrc`、`.env.*`、`.complexity-baseline.json`、`.token-baseline.json`、`.dependency-cruiser.js`。这些属工具/环境配置，新开发者按本地环境自行生成，不纳入版本结构约束。

---

## 二、目录分类标准

### 2.1 核心分类体系

| 分类 | 目录 | 职责 | 生命周期 |
|------|------|------|----------|
| **配置层** | `.github`, `.husky`, `.codebuddy`, `.workbuddy`, `.agents`, `design-tokens` | 项目配置、AI 技能、开发工具配置 | 永久 |
| **文档层** | `docs/` | 开发文档、设计规范、测试文档 | 持续更新 |
| **测试层** | `tests/`, `e2e/`, `coverage/` | 单元测试、集成测试、端到端测试、覆盖率产物 | 持续更新（coverage 为产物） |
| **源代码** | `src/` | 核心应用逻辑 | 持续更新 |
| **工具层** | `scripts/`, `packages/`, `tools/`, `python/` | 开发脚本、独立模块、辅助工具、Python 分析 | 按需更新 |
| **扩展层** | `plugins/`, `prompts/` | 插件、AI 提示词 | 按需扩展 |
| **质量/治理层** | `code-quality-compliance/`, `eslint-rules/` | 质量合规报告、自定义 lint 规则 | 持续更新 |
| **产物/归档层** | `outputs/`, `dist/`, `archive/`, `releases/` | 构建/生成产物、历史归档、发布包 | outputs/dist 建议 gitignore；archive/releases 定期清理 |

### 2.2 `docs/` 目录细分

| 子目录 | 编号 | 内容 | 说明 |
|--------|------|------|------|
| `00-meta/` | 00 | 文档治理、项目总览、目录规范、审计 | 文档系统的元数据 |
| `01-requirements/` | 01 | 需求文档、数据宪法、功能清单 | 产品需求定义 |
| `02-design/` | 02 | 架构设计、API 契约、技术规范 | 含 `architecture/`、`ADR/`、`blueprints/`、`cockpit/`、`modules/`、`standards/`、`topics/` 等子目录（高层视图，细节以子目录为准） |
| `03-development/` | 03 | 开发指南、代码规范、模板 | 含 `ai/`、`guides/`、`plugins/` 等子目录 |
| `04-testing/` | 04 | 测试用例、测试计划、测试报告 | 测试相关文档 |
| `05-deployment/` | 05 | 部署方案、运维手册、发布计划 | 部署与运维文档 |
| `06-project-management/` | 06 | 项目管理、进度跟踪、风险评估 | 项目管理文档 |
| `reports/` | - | 审计报告 / 定期报告输出 | **与 §6.1 清理规则对应**（每月清理） |
| `assets/` | - | 文档静态资源 | 文章、图片等静态资产 |
| `../../README.md` | - | `docs/` 根级说明 | 文档系统入口说明 |

### 2.3 `src/` 目录细分

> 本表与权威契约 `AGENTS.md §一` 逐条对齐（22 个一级子目录完全一致）。

| 子目录 | 职责 | 说明 |
|--------|------|------|
| `agents/` | AI Agent 管理 | Agent 注册、运行时、健康监控（运行时模块） |
| `apps/` | 应用模块 | 分析、命令、输入、输出、交易（React.lazy 分发器）；**角色定位与调用链见 §2.3.1** |
| `cockpit/` | 驾驶舱 | Widget 引擎、Widget 注册表（独立布局域） |
| `components/` | UI 组件 | `atoms/` `molecules/` `organisms/` `templates/` `chart/` `cabin/` `cockpit/` `widgets/` |
| `config/` | 应用配置 | API 路径、数据源、阈值配置（零硬编码锚点） |
| `constants/` | 常量定义 | 业务常量、颜色令牌、UI 文本（零硬编码锚点） |
| `core/` | 核心框架 | DataBridge、ACL、路由守卫、Envelope、MemoryCache、EventBus |
| `data/` | 数据访问 | `dataLayer/` `queryBuilder/` `types/` `gateway/`（`gateway/` 是唯一可直操 `db` 的入口） |
| `devtools/` | 开发工具 | 数据流测试等开发辅助工具（仅 DEV） |
| `fixtures/` | Mock 数据供给 | 测试数据；**仅被 `tests/` 依赖，禁止被生产代码引用** |
| `generated/` | 代码自动生成产物 | 令牌/类型/脚本输出；**零依赖** |
| `hooks/` | 自定义 Hook | 数据采集、防抖、页面守卫 |
| `i18n/` | 国际化 | 多语言支持 |
| `lib/` | 工具库 | 日志、验证、加密、性能监控（仅基础设施，禁止业务模块） |
| `mcp/` | MCP 协议 | MCP Server、桥接、ACL |
| `pages/` | 页面组件 | 路由页面定义（5 舱：input/analysis/trading/output/command） |
| `portal/` | 门户组件 | `PortalShell` 入口壳，统一懒加载各舱 `apps/{cabin}/{Xxx}App`（调用链见 §2.3.1） |
| `schema/` | Zod/JSON Schema | 数据验证 Schema 定义 |
| `services/` | 业务服务 | 回测、LLM、新闻、交易、分析、评分等 20+ 子域 |
| `showcase/` | 展示组件 | 功能展示组件（仅 DEV） |
| `store/` | 状态管理 | Zustand store 定义（49 个）+ `helpers/` `withBroadcast` |
| `types/` | 类型定义 | TypeScript 类型声明（零依赖） |

### 2.3.1 三级加载链与 App 角色定位

`apps/` 是「三级加载链中间层」（App 分发器），**只做路由分发与懒加载，不承载页面组件**。调用链：

```
PortalShell (src/portal/PortalShell.tsx)
  └─ React.lazy(() => import('@/apps/{cabin}/{Xxx}App'))   ← 二级：舱分发器
       └─ <{Xxx}App /> → 渲染 src/pages/{cabin}/*Page.tsx   ← 三级：页面
```

| 舱 | App 分发器（src/apps/） | 角色定位 | 调用关系 | 角色清晰度 |
|----|------|------|------|------|
| input | `InputApp.tsx` | 输入舱分发器 | PortalShell→InputApp→pages/input/* | ⚠️ 待整改：`apps/input/` 泄漏 `BulkImportPanel`/`DataTestPanel`/`HotSectorPanel`/`InputDashboard`（应迁 `pages/` 或 `components/`） |
| analysis | `AnalysisApp.tsx` | 分析舱分发器 | PortalShell→AnalysisApp→pages/analysis/* | ✅ 干净薄分发器 |
| trading | `TradingApp.tsx` | 交易舱分发器 | PortalShell→TradingApp→pages/trading/* | ⚠️ 待整改：`apps/trading/` 含 `components/` `panels/` 子目录（应迁 `pages/` 或 `components/`） |
| output | `OutputApp.tsx` | 产出舱分发器 | PortalShell→OutputApp→pages/output/* | ✅ 干净薄分发器 |
| command | `CommandApp.tsx` + `AgentApp.tsx` + `ConfigApp.tsx` | 命令舱分发器（三 dispatcher） | PortalShell→CommandApp / AgentApp；`CommandApp` 内再 `React.lazy(() => import('@/apps/command/ConfigApp'))` → `/command/config` | ⚠️ 文档需显式画出二级嵌套；`ConfigApp` 经 CommandApp 接入而非 PortalShell |

> **角色边界铁律**：`apps/` 内只放 `{Cabin}App.tsx` 分发器；页面组件（Panel/Dashboard/子组件）一律落在 `pages/{cabin}/` 或 `components/`。违反即层级越界，由 `audit:layers` / `audit:deadcode`（AGENTS.md L721 已将 `apps/` 列为路由源扫描）捕获。
> **权威依据**：`AGENTS.md §一`（apps/ 定义）、L720–726（App 分发器契约）。详细逐 App 角色见 `../explanation/cabins-overview.md` §2。

> **`src/` 根级入口/配置文件**（非子目录）：`App.tsx`、`main.tsx`、`index.css`、`theme.config.ts`、`vite-env.d.ts`。

### 2.4 `tests/` 目录细分

| 子目录 | 职责 | 说明 |
|--------|------|------|
| `__mocks__/` | Mock 数据 | 测试用 Mock 对象 |
| `__tests__/` | 组件测试 | UI 组件单元测试 |
| `blueprints/` | 蓝图测试 | 组件/页面蓝图验证 |
| `contracts/` | 契约测试 | 引擎和 Store 契约验证 |
| `e2e/` | 端到端测试 | 跨页面/跨模块集成 |
| `fetcher/` | 数据获取测试 | fetcher 系列单测 |
| `fixtures/` | 测试数据 | 测试用固定数据 |
| `helpers/` | 测试辅助 | 测试工具函数 |
| `performance/` | 性能测试 | 性能基准验证 |
| `remediation/` | 整改验证 | 整改项回归测试 |
| `services/` | 服务测试 | services 层单元测试 |
| `unit/` | 单元测试 | 通用单元用例 |
| `utils/` | 测试工具 | 通用测试工具 |

> **说明**：大量 `*.test.ts` / `*.test.tsx` 直接位于 `tests/` 根级（非子目录），属正常布局；`setup.ts` 为测试引导文件。

---

## 三、命名规范

### 3.1 文件命名规则

| 文件类型 | 命名格式 | 示例 |
|----------|----------|------|
| 组件文件 | PascalCase | `Button.tsx`, `ScoreCard.tsx` |
| 工具函数 | camelCase | `utils.ts`, `format.ts` |
| 类型定义 | snake_case | `backtest.types.ts`, `trade.types.ts` |
| 配置文件 | snake_case | `api_paths.ts`, `llm_config.ts` |
| 测试文件 | `.test.ts/.test.tsx` | `utils.test.ts`, `Button.test.tsx` |
| 文档文件 | PascalCase / 中文 | `../explanation/03-architecture-standards.md`, `数据宪法.md` |
| 脚本文件 | kebab-case（正式） | `audit-layer-calls.ts`, `generate-report.ts` |

### 3.2 目录命名规则

| 层级 | 命名格式 | 示例 |
|------|----------|------|
| 一级目录 | kebab-case | `data-collector`, `market-data` |
| 子目录 | kebab-case | `widget-engine`, `store-helpers` |
| 文档子目录 | 数字前缀 + 名称 | `00-meta`, `02-design` |

### 3.3 临时文件规则

- **禁止**在项目根目录或 `src/` 目录下创建临时文件
- 临时文件应放在 `.workbuddy/tmp/` 或 `scripts/` 目录下
- 临时**调试**脚本以 `_` 前缀标识（如 `_debug_hash.py`）；**正式**脚本采用连字符 kebab-case 命名（如 `audit-layer-calls.ts`）——二者不冲突，前缀仅用于标记"一次性调试产物"
- 临时文件在任务完成后应立即删除

---

## 四、版本控制策略

### 4.1 分支管理

| 分支类型 | 命名格式 | 用途 |
|----------|----------|------|
| 主分支 | `main` | 稳定版本，生产环境部署 |
| 开发分支 | `develop` | 日常开发，集成测试 |
| 功能分支 | `feature/xxx` | 新功能开发 |
| 修复分支 | `fix/xxx` | Bug 修复 |
| 发布分支 | `release/xxx` | 版本发布准备 |

### 4.2 提交规范

采用 Conventional Commits 规范：

```
<type>(<scope>): <description>

<body>

<footer>
```

**类型说明**：

| 类型 | 说明 |
|------|------|
| `feat` | 新功能 |
| `fix` | Bug 修复 |
| `refactor` | 重构（不改变功能） |
| `docs` | 文档更新 |
| `test` | 测试用例 |
| `style` | 代码风格 |
| `chore` | 构建/工具更新 |
| `perf` | 性能优化 |

### 4.3 文档版本管理

- 文档更新需同步更新文件头部的 `Last Updated` 日期
- 重大变更需更新版本号（如 v2.0.0 → v2.1.0）
- 历史版本归档到 `archive/docs/` 目录

---

## 五、文件归档流程

### 5.1 归档条件

以下情况的文件应归档到 `archive/` 目录：

1. **过时资源**：不再使用的组件、脚本、配置
2. **历史备份**：旧版本文档、废弃的设计方案
3. **临时产物**：架构雷达报告、审计报告输出
4. **重复文件**：已合并去重的冗余副本

### 5.2 归档目录结构

```
archive/
├── docs/                        # 文档归档
│   ├── architecture-radar/      # 架构雷达历史报告
│   ├── reports/                 # 审计报告历史
│   ├── playground/              # 实验性文档
│   └── 07-archive/            # 原归档目录迁移（自 docs/07-archive 迁入）
├── knowledge-base/              # 知识库归档
│   ├── audit-logs/             # 审计日志
│   ├── backups/                # 备份
│   ├── changelogs/             # 变更日志
│   ├── reports/                # 报告归档
│   └── temp-files/            # 临时文件归档
├── scripts/                     # 脚本归档
│   ├── doc-notify.ts           # 废弃的文档通知脚本
│   ├── doc-pipeline.ts         # 废弃的文档流水线脚本
│   └── doc-retry.ts           # 废弃的文档重试脚本
└── unused-components/           # 未使用组件归档
    ├── atoms/                   # 原子组件
    ├── organisms/               # 有机体组件
    └── wizard-steps/            # 向导步骤组件
```

### 5.3 归档操作流程

1. **评估**：确认文件不再被项目引用
2. **记录**：在 `docs/00-meta/registry-index.md` 中记录归档信息
3. **迁移**：移动文件到 `archive/` 对应子目录
4. **验证**：运行 `npm run audit:doc-integrity` 确认无引用断裂

---

## 六、文件清理规则

### 6.1 定期清理

| 周期 | 清理内容 | 负责角色 |
|------|----------|----------|
| 每日 | `.workbuddy/tmp/` 临时文件 | 开发人员 |
| 每周 | 脚本目录下 `_` 前缀临时文件 | 开发人员 |
| 每月 | `docs/reports/` 审计报告 | 架构资产治理官 |
| 每季度 | `archive/` 中超过 6 个月的归档 | 架构资产治理官 |

### 6.2 禁止保留的文件

- `.bak`, `.bak2` 等备份文件
- `TEMP*` 临时文件
- 编辑器自动生成的 `.DS_Store`, `Thumbs.db`
- 构建产物目录（`.next`, `dist`, `coverage` 等，应在 `.gitignore` 中排除）

> **已知遗留违规（整改中）**：根目录现存 `:TEMPwebbridge-req-vr.json`（文件名以冒号开头，属 `TEMP*` 临时文件）与 `archive/scripts/doc-pipeline.ts.bak` 违反本规则，已列入整改 TODO T9 待删除。

---

## 七、文档治理原则

### 7.1 单一事实源

- 每个数据定义、API 契约、业务规则应有**唯一的权威文档**
- 禁止在多个目录下维护相同内容的文档
- 文档之间通过链接引用，避免内容重复
- **目录结构权威契约为 `../../AGENTS.md`**；本指南与之冲突时以 `../../AGENTS.md` 为准

### 7.2 文档同步

- 代码变更时应同步更新相关文档
- 定期运行 `npm run audit:docs` 检查文档与代码一致性
- 目录结构变更后运行 `npm run audit:directory` 核对本指南与实际目录，防止漂移
- 文档更新需通过 Pull Request 审查

### 7.3 文档分级

| 级别 | 标识 | 要求 |
|------|------|------|
| **核心文档** | `[CORE]` | 必须与代码同步，定期审查 |
| **参考文档** | `[REF]` | 保持更新，按需审查 |
| **历史文档** | `[ARCHIVE]` | 已归档，不再更新 |

---

## 八、核心检查文档与自动化校验清单

> **说明**：由于代码先行、文档滞后，以下文档和脚本已成为项目实际运行的「事实标准」，必须单独列示以便快速检索和验证。

### 8.1 强制性核心文档

| 优先级 | 文件路径 | 文件名 | 用途 | 关联 SOP |
|--------|----------|--------|------|----------|
| **P0** | `../../AGENTS.md` | AGENTS.md | AI Agent 行为约束、架构决策记录 | §一、§十、§十四 |
| **P0** | `../explanation/architecture.md` | architecture.md | 系统架构总览、分层设计、模块关系 | §一、§1.1 |
| **P0** | `../reference/v9数据宪法.md` | v9数据宪法.md | 数据定义规范、数据源标准 | §2.5 |
| **P0** | `../reference/development-workflow-sop.md` | development-workflow-sop.md | 开发工作流 SOP、门禁清单、工具链地图 | 全文 |
| **P1** | `./directory-structure-guide.md` | directory-structure-guide.md | 目录结构规范、命名规则、归档流程 | 全文 |
| **P1** | `./governance.md` | governance.md | 文档治理规范、版本控制策略 | §七 |
| **P1** | `../reference/api-contract.md` | api-contract.md | API 契约定义、接口规范 | §3.6 |
| **P1** | `../reference/06-routing-specs.md` | 06-routing-specs.md | 路由规范、页面注册规则 | §4.3 |
| **P1** | `../how-to/code-review-guide.md` | code-review-guide.md | 代码审查规范、检查清单 | §8.2 |
| **P2** | `../reference/jsdoc-convention.md` | jsdoc-convention.md | JSDoc 编写规范 | §3.3 |
| **P2** | `../explanation/quality-gates-baseline.md` | quality-gates-baseline.md | 质量门禁基线、阈值标准 | §4.2 |

### 8.2 自动化门禁脚本清单（Husky 14 步阻断门禁）

| 步骤 | npm 命令 | 脚本路径 | 阻断性 | 用途 | 关联 SOP |
|------|----------|----------|--------|------|----------|
| 1 | `npx lint-staged` | — | ✅ 阻断 | 暂存区 ESLint --fix | §4.1 |
| 2 | `npm run lint:colors` | `scripts/audit-color-tokens.ts` | ✅ 阻断 | 颜色硬编码扫描 | §3.2 |
| 3 | `npm run tsc:prod` | — | ✅ 阻断 | TypeScript 零错误 | §2.4 |
| 4 | — | — | ✅ 阻断 | （历史编号跳跃） | — |
| 5 | `npm run audit:layers` | `scripts/audit-layer-calls.ts` | ✅ 阻断 | 跨层调用检查 | §3.1 |
| 6 | `npm run audit:atomic` | `scripts/audit-atomic.ts` | ✅ 阻断 | 原子组件边界 | §3.1 |
| 7 | `npm run file:check` | — | ✅ 阻断 | 文档规范检查 | §4.1 |
| 8 | `npm run audit:docs` | `scripts/audit-doc-sync.ts` | ✅ 阻断 | 代码-文档同步 | §6.2 |
| 9 | `npm run verify:tokens` | — | ✅ 阻断 | 设计令牌映射 | §3.2 |
| 10 | `npm run audit:tokens` | `scripts/audit-token-consumption.ts` | ✅ 阻断 | 令牌消费检查 | §3.2 |
| 11 | `npm run audit:jsdoc` | `scripts/audit-jsdoc.ts` | ⚠️ 警告 | JSDoc 覆盖 | §3.3 |
| 12 | `npm run audit:complexity` | — | ⚠️ 警告 | 代码复杂度 | §3.4 |
| 13 | `npm run audit:widget-registry` | `scripts/audit-widget-registry.ts` | ✅ 阻断 | Widget 注册一致性 | §4.1 |
| 14 | `npm run audit:ai-output` | `scripts/audit-ai-output.ts` | ✅ 阻断 | AI 输出校验 | §7.4 |

### 8.3 文档同步校验工具

| 工具 | npm 命令 | 脚本路径 | 用途 | 触发时机 |
|------|----------|----------|------|----------|
| 文档-代码双向完整性 | `npm run audit:doc-integrity` | `scripts/audit-doc-integrity.ts` | 检查文档引用的 npm scripts、文件路径是否存在 | git commit / CI |
| 代码-文档同步 | `npm run audit:docs` | `scripts/audit-doc-sync.ts` | 检查代码与文档的同步状态、版本漂移 | git commit / CI |
| 文档规范检查 | `npm run file:check` | — | 检查文档格式、命名规范 | git commit |
| 文档版本检查 | `npm run doc:version-check` | — | 检查文档版本一致性 | CI 定时 |
| 文档路径匹配 | `npx tsx scripts/audit-path-match.ts` | `scripts/audit-path-match.ts` | 检查文档目录与内容的匹配度 | git commit（警告） |
| 文档保鲜度 | `npm run doc:freshness` | — | 文档更新频率评分、告警 | 月度定时 |

### 8.4 架构守护审计脚本

| 审计项 | npm 命令 | 脚本路径 | 用途 | 运行频率 |
|--------|----------|----------|------|----------|
| 分层调用审计 | `npm run audit:layers` | `scripts/audit-layer-calls.ts` | 检查跨层调用违规 | 每次 import 变更 |
| 原子组件边界 | `npm run audit:atomic` | `scripts/audit-atomic.ts` | 检查组件边界违规 | 每次组件变更 |
| MCP 权限审计 | `npm run audit:mcp` | `scripts/audit-mcp.ts` | 检查 MCP Server 权限配置 | 每次 MCP 变更 |
| Widget 注册审计 | `npm run audit:widget-registry` | `scripts/audit-widget-registry.ts` | 检查 Widget 三处注册一致性 | 每次 Widget 变更 |
| 路由审计 | `npm run audit:routes` | `scripts/verify-all-routes.ts` | 检查路由与页面文件一致性 | 每次路由变更 |
| DB 引用审计 | `npm run audit:db-references` | `scripts/audit-db-references.ts` | 检查数据库引用一致性 | 每次数据层变更 |

### 8.5 代码质量审计脚本

| 审计项 | npm 命令 | 脚本路径 | 用途 | 运行频率 |
|--------|----------|----------|------|----------|
| 硬编码审计 | `npm run audit:hardcode` | `scripts/audit-hardcode.ts` | 检查硬编码常量 | 每周 |
| 死代码审计 | `npm run audit:deadcode` | `scripts/audit-dead-code.ts` | 检查未使用代码 | 每周 |
| 依赖审计 | `npm run audit:dependencies` | `scripts/audit-dependencies.ts` | 检查依赖版本和安全 | 每周 |
| JSDoc 审计 | `npm run audit:jsdoc` | `scripts/audit-jsdoc.ts` | 检查 JSDoc 覆盖率 | 每次提交（警告） |
| 复杂度审计 | `npm run audit:complexity` | — | 检查代码复杂度 | 每次提交（警告） |
| 组件复用审计 | `npx tsx scripts/audit-component-usage.ts` | `scripts/audit-component-usage.ts` | 检查组件复用情况 | 每月 |

### 8.6 快速检索命令

```bash
# 检索核心文档
find docs/ -name "*.md" | xargs grep -l "\[CORE\]"

# 检索 SOP 引用的脚本
grep -r "npm run" docs/02-design/standards/development-workflow-sop.md | awk '{print $3}' | sort -u

# 检查所有门禁脚本是否存在
for script in $(grep -r "scripts/" docs/02-design/standards/development-workflow-sop.md | awk -F'"' '{print $2}'); do
  if [ -f "$script" ]; then echo "✅ $script"; else echo "❌ $script"; fi
done

# 运行全部核心审计
npm run audit:layers && npm run audit:docs && npm run audit:doc-integrity
```

---

## 九、开发角色定位与调用关系矩阵

> **说明**：本章节定义 APP 开发团队的角色职责、权限边界和模块调用关系，解决"角色及调用关系未区分"的问题。

### 9.1 开发团队角色定义

| 角色 | 英文标识 | 职责范围 | 可访问目录 | 关键技能 |
|------|----------|----------|------------|----------|
| **前端工程师** | `frontend` | UI 组件开发、页面构建、样式维护、交互实现 | `src/components/`, `src/pages/`, `src/hooks/`, `src/i18n/`, `design-tokens/` | React, TypeScript, Tailwind CSS |
| **全栈工程师** | `fullstack` | 业务服务实现、状态管理、路由配置、API 对接 | `src/services/`, `src/store/`, `src/config/`, `src/apps/` | React, Node.js, Zustand |
| **数据工程师** | `data` | Schema 定义、Repository 实现、数据采集、数据质量 | `src/data/`, `src/schema/`, `src/services/collection/`, `src/types/` | IndexedDB, JSON Schema, ETL |
| **AI/Agent 工程师** | `ai-agent` | Agent 逻辑开发、提示词工程、MCP 工具集成 | `src/agents/`, `src/mcp/`, `prompts/`, `src/services/llm/` | LLM, Prompt Engineering |
| **交易工程师** | `trading` | 交易策略、执行引擎、风险管理、回测系统 | `src/apps/trading/`, `src/services/backtest/`, `src/services/trading/` | 金融工程、量化策略 |
| **架构师** | `architect` | 架构设计、技术决策、代码审查、技术债务治理 | 全部目录 | 系统设计、架构模式 |

### 9.2 模块调用关系矩阵

#### 9.2.1 APP 模块调用关系

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              用户界面层 (UI Layer)                           │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐     │
│  │ Analysis │  │ Trading  │  │  Input   │  │ Command  │  │  Output  │     │
│  │   App    │  │   App    │  │   App    │  │   App    │  │   App    │     │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘     │
└───────┼─────────────┼─────────────┼─────────────┼─────────────┼─────────────┘
        │             │             │             │             │
        ▼             ▼             ▼             ▼             ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                            业务服务层 (Service Layer)                        │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐     │
│  │ Analysis │  │ Trading  │  │Collection│  │   LLM    │  │ Backtest │     │
│  │ Services │  │ Services │  │ Services │  │ Services │  │ Services │     │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘     │
└───────┼─────────────┼─────────────┼─────────────┼─────────────┼─────────────┘
        │             │             │             │             │
        ▼             ▼             ▼             ▼             ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                            数据访问层 (Data Layer)                          │
│                         ┌─────────────────────────────┐                    │
│                         │      DataBridge / Store     │                    │
│                         │  (IndexedDB + Repository)   │                    │
│                         └─────────────────────────────┘                    │
└─────────────────────────────────────────────────────────────────────────────┘
```

#### 9.2.2 跨模块调用规则

| 调用方 | 目标模块 | 允许操作 | 数据流向 |
|--------|----------|----------|----------|
| `analysis` | `data` | SELECT | 读取评分、行情、财务数据 |
| `analysis` | `llm` | CALL | 调用 LLM 分析 |
| `trading` | `data` | SELECT/INSERT/UPDATE | 读写交易记录、持仓、执行计划 |
| `trading` | `backtest` | CALL | 执行回测 |
| `trading` | `analysis` | SELECT | 读取分析结果 |
| `input` | `collection` | CALL | 触发数据采集 |
| `input` | `data` | INSERT | 写入股票池、配置 |
| `command` | `agents` | CALL | 调度 Agent |
| `command` | `mcp` | CALL | 调用 MCP 工具 |
| `output` | `data` | SELECT | 读取数据用于导出 |

### 9.3 权限体系层次结构

| 层级 | 权限模型 | 配置位置 | 控制范围 |
|------|----------|----------|----------|
| **L1 - 用户角色层** | Role → App → Action | `src/types/role.types.ts` | 应用内用户功能权限（规划中） |
| **L2 - 调用方角色层** | Caller → Server → Tool | `src/config/mcpAclMatrix.ts` | MCP 工具调用权限 |
| **L3 - 模块权限层** | Module → Store → Operation | `src/config/dbConfig.ts` (ACL_MATRIX) | 数据库模块级 CRUD 权限 |
| **L4 - 数据层权限** | Store → Schema → Field | `src/data/schemas/` | 数据字段级访问控制 |

### 9.4 应用内用户角色定义（规划中）

| 角色 | 英文标识 | 权限范围 | 对应 APP |
|------|----------|----------|----------|
| **分析师** | `analyst` | 查看分析报告、评分数据、行业分析 | Analysis, Input |
| **交易员** | `trader` | 执行交易、管理持仓、查看策略 | Trading, Analysis |
| **管理员** | `admin` | 系统配置、用户管理、数据管理 | 全部 APP |
| **只读用户** | `viewer` | 仅查看，无写操作权限 | Analysis |

### 9.5 角色与模块权限映射

| 开发角色 | ACL_MATRIX 模块 | MCP_ACL_MATRIX 角色 |
|----------|-----------------|---------------------|
| 前端工程师 | — | `ui` |
| 全栈工程师 | `analysis`, `trading`, `input`, `command`, `output` | `system` |
| 数据工程师 | `fetcher`, `data`, `collection` | `system` |
| AI/Agent 工程师 | `llm`, `agents`, `mcp` | `agent` |
| 交易工程师 | `trading`, `backtest`, `execution` | `system` |
| 架构师 | 全部模块 | `system` |

---

## 十、团队协作规范

### 10.1 职责分离

| 层级 | 职责 | 负责人 |
|------|------|--------|
| **UI 层** | 组件开发、样式维护 | 前端开发 |
| **业务逻辑层** | 服务实现、状态管理 | 全栈开发 |
| **数据访问层** | Schema 定义、Repository | 后端开发 |
| **文档层** | 文档编写、同步更新 | 全员负责 |

### 9.2 代码审查流程

1. 开发完成后创建 Pull Request
2. 至少 1 位团队成员审查
3. 通过 `npm run lint`, `npm test`, `npm run audit:layers` 检查
4. 审查通过后合并到 `develop` 分支

### 9.3 资源支持

- **组件库**：`src/components/` 提供统一的 UI 组件
- **工具函数**：`src/lib/` 提供通用工具函数
- **开发环境**：参考 `../tutorials/getting-started.md`
- **文档系统**：`docs/` 目录提供完整的技术文档

---

## 十、违规处理

### 10.1 违规类型

| 违规 | 严重程度 | 处理方式 |
|------|----------|----------|
| 跨层调用 | 严重 | 立即修复 |
| 硬编码 | 中等 | 限期修复 |
| 文档缺失 | 中等 | 补充文档 |
| 文件杂乱 | 轻微 | 定期清理 |

### 10.2 审计工具

| 工具 | 命令 | 用途 |
|------|------|------|
| 分层调用审计 | `npm run audit:layers` | 检查跨层调用违规 |
| 硬编码审计 | `npm run audit:hardcode` | 检查硬编码常量 |
| 死代码审计 | `npm run audit:deadcode` | 检查未使用代码 |
| 文档同步审计 | `npm run audit:docs` | 检查文档与代码一致性 |
| 目录结构审计 | `npm run audit:directory` | 检查本指南与磁盘目录一致性 |

---

## 十一、附录

### A. 目录大小控制目标（实测 2026-07-13）

| 目录 | 当前大小 | 目标大小 | 优化策略 |
|------|----------|----------|----------|
| `docs/` | 16MB | ~15MB | 已达标（归档报告、去重生效） |
| `src/` | 8.4MB | ~25MB | 稳定，远低于上限 |
| `scripts/` | 2.0MB | ~3MB | 已低于目标 |
| `tests/` | 1.9MB | — | 持续更新 |
| `archive/` | 12MB | ~50MB | 长期归档（不限制） |
| `outputs/` | 110MB | 建议 gitignore | 自动生成产物，不入版本库或定期清理 |

### B. 文档/代码数量（实测 2026-07-13）

| 目录 | 当前数量 | 说明 |
|------|----------|------|
| `docs/` | 402 个 `.md` | 已低于历史目标 ~500 |
| `src/` | 935 个 `.ts/.tsx` | 核心源码 |
| `scripts/` | 141 项 | 含审计/构建/文档脚本 |
| `tests/` | 138 个 `.test.*` | 单元/集成测试 |

### C. 常用命令

```bash
# 类型检查
npm run tsc

# 运行测试
npm test

# 运行分层调用审计
npm run audit:layers

# 目录结构审计（本指南 ↔ 磁盘）
npm run audit:directory

# 构建项目
npm run build

# 开发模式
npm run dev

# 文档完整性审计
npm run audit:doc-integrity
```

---

> **文档状态**: 生效中（v2.1.0）  
> **生效日期**: 2026-07-13  
> **审批**: 架构资产治理  
> **修订说明**: 本版整合 2026-07-13 目录结构审计结论，补全 10 个未收录目录、消除 §6.1↔§2.2 内部不一致、精确化 `data/` `components/` 子结构、刷新附录 A/B 为实测值，并与权威契约 `AGENTS.md §一` 对齐。
