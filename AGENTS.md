---
title: AGENTS.md — V9 智能投研复盘系统 AI 行为约束契约
status: active
version: v1.5.6
last_updated: 2026-08-11
code_version: "2.0.0-rc.1"
change_log:
  - version: v1.5.6
    changes: "基准日校对(2026-08-11)：R1取真值(P2 正文版本声明行=v1.5.5) → R2 PATCH++(v1.5.6) / last_updated 刷新 / change_log 闭环"
    date: 2026-08-11
---
# AGENTS.md — V9 智能投研复盘系统 AI 行为约束契约

> **版本**: v1.5.6 | **日期**: 2026-08-11
> **适用范围**: 所有 AI 辅助开发工具（Claude Code、Cursor、Trae 等）
> **强制等级**: 所有 AI 生成的代码必须遵守以下约束
>
> **v1.5.5 变更**：落地技能触发机制迭代 3——pre-push 挂 `skill-router --enforce --since <base>` 强制模式（mandatory 命中未确认即拦截，旁路 `SKILL_GATE_CONFIRM=1 git push`）；`skill-router.cjs` 新增 `--since`（推送范围三点 diff）与环境变量旁路；`.trae/rules` 追加技能路由规则段（与 registry/AGENTS.md 三方同步）；注册 2 个定时任务（L5 调度层）：「Mock 残留周检」`40 3 * * 1`、「技能健康度月检」`17 8 1 * *`（Asia/Shanghai）
>
> **v1.5.4 变更**：落地技能触发机制迭代 2——新增 L1 注册表 `.trae/skills/skill-registry.json`、L4 路由器 `scripts/skill-router.cjs`（已挂 pre-commit 提醒模式，命中日志写入 `.trae/skills/usage.log`，`--enforce` 预留给 pre-push）、L6 防漂移审计 `scripts/audit/audit-skill-coverage.cjs`（frontmatter ↔ registry ↔ AGENTS.md 三方一致性）；package.json 新增 `skill:route` / `audit:skill-coverage`
>
> **v1.5.3 变更**：新增「技能路由表」（SKILL 索引升级为 IF-THEN 路由规则：文件信号/关键词信号 × mandatory 门禁，未全绿不得声明完成）；统一 `.agents/skills/` 16 项技能的 frontmatter schema（`triggers.keywords/files/events` + `gates` + `mandatory` 机器可读字段）并修复 4 个损坏的 YAML 头；归因于 2026-07-21 确认技能自动触发机制缺失，落地五层触发体系的 L0 修复层与 L2 路由层（后续迭代：L1 registry、L4 skill-router 钩子、L5 周期任务）
>
> **v1.5.2 变更**：新增 §十六 Bash 使用约定（Git Bash 路径规范 + 受管 venv Python 固化 + 命令入口统一 + 禁止命令清单 + 执行后联动义务）；归因于 2026-07-20 确认 AI 工具默认开放 Bash 调用，需统一 Shell 行为防路径漂移
>
> **v1.5.1 变更**：新增 §二.Store 状态订阅规范（Zustand 响应式铁律 3 条 + 派生函数归类 + Widget 组件数据订阅模板）；归因于 2026-07-19 发现 26 个 Store 派生函数裸用 `getState()` 导致 P0 阻断性不渲染
>
> **v1.5.0 变更**：DataBridge 子模块拆分（databridgeAcl.ts Phase 1）；Widget 布局 5 层梯度 L1-L5；Widget 尺寸/分类枚举完成统一；pre-push 门禁重构（gate:quick + widget-registry + complexity-scan）；质量指标分离 Mock 假绿灯（realSuccessRate）；JSDoc 覆盖 37→19；新增 P1-6 directDataAPI 双份已知缺陷
>
> **v1.5.x 变更**：新增股票字典生成/校验门禁（build:stock-dict / build:stock-dict:verify），受管 venv python 固化于 package.json。
>
> **v1.4.9 变更**：新增 §七.4 数据质量断言三件套规则（auditRecord + recordCollect + refreshStats）；§七 验证命令新增 `audit:acl-consistency`；§八 新增 ENVELOPE_ACTION → handler 注册一致性规则
>
> **v1.4.8 变更**：强化 §八 ACL 白名单约束（新增 store → 必跑 audit:acl-consistency）；增加 §四 状态假红灯教训（recordCollect + recordWrite + refreshStats 三件套）

> **提示词模板与检查清单**：为降低 AI 上下文漂移与人工返工，本项目在 `prompts/` 目录维护系统提示词模板，在 `docs/` 目录维护 `ui-migration-checklist.md`、`widget-integration-checklist.md`、`ai-memory-layer.md` 与 `ai-generate-audit-fix-loop.md`。AI 辅助开发时应优先加载对应模板，执行迁移、新增 Widget、记忆检索或飞轮流程时应按文档逐项核对。
>
> **文档与复杂度规范**：为提升代码可维护性，新增公共函数、组件、Hook、Store 必须补充 JSDoc（见 `docs/03-development/jsdoc-convention.md`）；新增代码应避免深层嵌套、长链式条件与过长函数（见 `docs/03-development/complexity-governance.md`）。
>
> **项目级 SKILL 索引**（三层分离，单一真相源见 `.trae/skills/skill-registry.json`，合计 46 项；MAND=mandatory 强制，adv=advisory 建议）：
> - **L1 项目物理技能（18 项）**：物理存放目录 `.agents/skills/*/SKILL.md`（非 `.trae/skills/`；`.trae/skills/` 仅存放 INDEX.md 与 skill-registry.json 索引文件，无技能本体）。按 registry `categoriesStats` 分十一类（名称均为自然 slug，无 `v9-` 前缀）：
>   - **架构治理 architecture（4）**：`architecture-cleanup`（adv）、`architecture-radar-scan`（adv）、`constant-migration`（MAND）、`databridge-migration`（MAND）
>   - **数据库治理 db-governance（1）**：`db-reference-audit`（adv）
>   - **文档治理 doc-governance（2）**：`doc-freshness-governance`（MAND）、`docs-as-mirror`（adv）
>   - **特性运行时 feature-runtime（1）**：`feature-window-context-doc`（adv）
>   - **行业评分 industry-score（2）**：`industry-score`（adv）、`industry-score-mapping`（adv）
>   - **V6 分析 v6-analysis（3）**：`intelligent-score`（adv）、`v6-docx-output`（adv）、`v6-stock-analysis-model`（adv）
>   - **MCP 安全 mcp-security（1）**：`mcp-ui-acl-authorization`（adv）
>   - **板块分析 sector-analysis（1）**：`sector-analysis-framework`（adv）
>   - **类型安全 type-safety（1）**：`type-safety-contract`（adv）
>   - **估值 valuation（1）**：`valuation-financial-analysis`（adv）
>   - **数据流 data-flow（1）**：`collection-pipeline-testing`（MAND）
> - **L2 外部插件技能（9 项）**：物理存放目录 `plugins/*/skills/*/SKILL.md`；由 TRAE CN 插件加载，不在 `.agents/skills/` 中重复复制。
> - **L3 平台内置虚拟技能（19 项）**：定义见 `.trae/skills/skill-registry.json` 的 `virtualPlatformSkills`（本索引仅计项数，不重复枚举；其 `v9-*` 为 TRAE CN 平台内置，无本地物理目录）。注：`collection-pipeline-testing` 已于 2026-08-16 由 L3 虚拟转为 L1 物理，故虚拟由 20 降为 19。
> - **禁止混加计数**：L1（18）+ L2（9）+ L3（19）= 46 条登记，任何声明不得绕过此分层。

> ⚠️ **技能治理对齐记录（2026-08-16，方案B + P2 已闭环）**：本索引/路由表曾与物理落盘、registry、加载器存在结构性错位，经两轮核查与对齐，现状态如下：
> 1. **真相态已对齐（方案B 反向对齐）**：registry（`skill-registry.json`）为单一真相源——`projectPhysicalSkills` 18 项（自然 slug，无 `v9-` 前缀）、`externalPluginSkills` 9 项、`virtualPlatformSkills` 19 项（含 `v9-*` 平台虚拟技能，无本地 SKILL.md）。本轮执行：(a) 撤销上一轮误加的 `v9-` 前缀重命名（`v9-constant-migration`/`v9-databridge-migration` → 还原 `constant-migration`/`databridge-migration`）；(b) 将新建采集门禁由 `v9-collection-pipeline-testing` 改名为自然名 `collection-pipeline-testing` 并登记为 L1 物理（mandatory，data-flow），同步 registry 由 virtual 转 projectPhysical（virtual 20→19、physical 17→18、total 维持 46）；(c) 本索引 L1 段已重写为 18 自然名物理技能（按 registry 分类与 mandatory 标记），"v9-* 即物理"的谎言已消除；(d) 路由表采集行已改用自然名 `collection-pipeline-testing`。
> 2. **加载器路径错位已缓解（P2 镜像）**：WorkBuddy 加载器仅扫描 `~/.workbuddy/skills/` 与 `{workspace}/.workbuddy/skills/`、**不扫 `.agents/skills/`**；本环境 available_skills 仅含用户级 `v9-color-token-remediation` 等，不含项目 L1 技能。已执行 P2：将 18 个 L1 物理技能镜像至 `D:\FinSightV9\.workbuddy\skills\`（Windows 不支持 symlink，采用 `cp -r` 拷贝；已校验每目录含 SKILL.md 且 `name` 字段与目录一致）——WorkBuddy 现可经 `Skill()` 加载。⚠️ 拷贝存在漂移风险：`.agents/skills/*` 更新后需重新同步——已提供自愈脚本 `npm run skill:mirror`（见 `scripts/skill-mirror.cjs`，覆盖式镜像 + 清理孤儿目录）；或开启 Developer Mode 改用 symlink。
> 3. **frontmatter 声明失真（已纠正）**：原路由表称 SKILL.md frontmatter 含 `triggers`/`gates`/`mandatory` 机器可读字段。实测所有物理 SKILL.md 仅用 `name`/`description`/`version`/`last_updated`/`change_log`，**无此三字段**；`triggers`/`gates`/`mandatory` 确为机器可读真相源，但存放于 `skill-registry.json` 而非 SKILL.md。已在下方匹配规则（L65）纠正指向 registry，未强行改写 18 个 SKILL.md。
> 完整映射、缺口与对齐决策见 `deliverables/AGENTS-skill-governance-reconciliation.md`。

### 技能路由表（任务开始时必须先匹配，v1.5.3 新增）

> **匹配规则**：先文件信号（改动路径），再关键词信号（用户表述/问题现象）；命中 **mandatory** 技能时，其「交付前必跑」未全绿不得声明"完成"。各技能的完整触发词与 gates 以其 **registry 条目**（`.trae/skills/skill-registry.json` 的 `triggers` / `gates` / `mandatory` 字段）为**机器可读单一真相源**；SKILL.md frontmatter 仅承载人类可读元数据（`name`/`description`/`version`/`last_updated`/`change_log`）。本表为会话级路由摘要。

| 信号（满足任一即触发） | 必加载技能 | 类型 | 交付前必跑 |
|---|---|---|---|
| 改动 `src/services/data-collector/**`、`src/store/sevenDimConfigStore.ts`、`src/types/modules/collection.types.ts`，或相关 vitest 失败 | `collection-pipeline-testing` | mandatory | `npx tsc --noEmit` + `npm run tsc:prod` + `npm run audit:layers` + 相关 vitest |
| 新增 EnvelopeAction / 写入新 store、改动 `src/core/databridge*.ts` 或 `src/config/dbConfig.ts`、排查按钮无响应 / 假绿灯 / 跨板块数据异常 | `v9-data-flow-integrity-audit` | mandatory | 该技能 §三 阶段 1–6 + `npm run audit:acl-consistency` |
| 排查 Mock 残留 / 假数据 / 信息孤岛、Mock→真实切换、上线前 Mock 清理审计 | `v9-mock-data-diagnosis` | advisory | 三维 Grep 扫描（每项 file:line 证据）+ 诊断报告归档 `outputs/` |
| 环境迁移 / 换电脑 / 用户目录绝对路径硬编码（C:/Users/<user>/...）、DELL↔Huawei 等多用户机器可移植、路径静默失效排查 | `v9-windows-env-path-doctor` | advisory | `scripts/scan.cjs --verify-current` 输出可移植（crossUser=0 且 sameUserHardcode=0）+ 仅修 src/scripts/configs 真实硬编码 |
| 执行任何 Bash 命令、路径/解释器/门禁命令选择（全局生效） | `v9-bash-conventions` | advisory | 按该技能 §4「执行后联动义务」表选必跑命令 |
| 任何代码改动交付前（改动 `src/services\|store\|core\|pages\|components/**`）、重构/接口变更/重命名、新增 skill 或注册表变更 | `v9-module-sync-checklist` | mandatory | 十域同步清单 + `npx tsc --noEmit` + `npm run tsc:prod` + `npm run audit:layers` + `npm run audit:acl-consistency` |
| 发现文档乱码 / 中文变问号、准备执行文档链接修复（fix-doc-refs 等）前、排查 GBK 二次损坏风险 | `v9-doc-encoding-remediation` | advisory | 三维 Grep（fix 脚本无硬编码 utf-8）+ 编码探测报告 + 复测 GBK_TOTAL=0（排除备份目录） |
| 文件重命名 / 迁移后残留失效链接（僵尸路径）扫描、move 操作退回检查、doc-refs 修复前置 | `stale-path-reference-audit` | advisory | 九类文件全仓 Grep 残留 + 排除生成物/备份噪声 + 交叉验证目标文件存在性 |
| 改动 `tsconfig.json`/`tsconfig.prod.json`/`tsconfig.test.json`、`package.json` 的 tsc 脚本，或 husky `tsc:prod` 门禁报错且错误全在 `*.test.ts`/`*.test-utils.ts` | `v9-tsc-gate-scope-audit` | advisory | 三步诊断（错误分类 + git status 归因）+ 修复后 `tsc:prod` 实测 0 错误 |
| `npm run tsc:test` 退出码非 0、测试文件类型错误爆发（TS2305/TS2322/TS2339/TS2532/TS1011）、契约漂移 / vi.mock 提升陷阱 / 严格空检暴露 | `v9-tsc-test-error-diagnosis` | advisory | 错误按 file:line 归类四大根因 + 修复后 `npm run tsc:test` 实测 0 错误且 `tsc:prod` 保持 0 |
| 颜色令牌新增/重命名/废弃、令牌硬编码（HEX/裸色类）排查、改动 `src/constants/theme.tokens.ts` 或 `src/config/chartColors.ts` | `v9-color-token-remediation` | advisory | `npm run audit:tokens` + `npm run verify:colorSoT` + `npm run audit:hardcode` |
| 二次开发前体检、"再次检查进度/健康度"、门禁回归定位、状态失准/假绿灯排查、文档vs现实矛盾核对 | `v9-health-audit` | advisory | tsc:prod 真实退出码=0 + audit:layers=0 + automation_update list 真实条数 vs 文档声称交叉核对 + 争议测试文件直跑 |
| 新模块集成/PR 提交前代码合规审查、类型安全/零硬编码/事件监听清理/日志规范核查、`audit:layers`/`audit:acl-consistency` 报违规 | `v9-code-quality-audit` | mandatory | 该技能质量维度清单 + `npx tsc --noEmit` + `npm run audit:layers` + `npm run audit:acl-consistency` + `npm run audit:hardcode` |
| 新增组件/新模块/PR Review 三场景、交付前正向+逆向双向校验 | `v9-dev-checklist` | advisory | 该技能三场景清单逐项核对 + `npx tsc --noEmit` |
| audit:layers 报出 core/services 越权读写 dataLayer、将直接操作 dataLayer.stocks/v6Scores 等的代码迁移到 DataBridge 信封协议 | `v9-databridge-migration` | mandatory | 迁移后 `npm run audit:layers` = 0 违规 + `npm run audit:acl-consistency` 全绿 + 相关 vitest 通过 |
| V9 架构债务清理、层违规修复、死组件删除、大组件重构、lint 警告清理、审计脚本报层调用违规 | `architecture-debt-remediation` | mandatory | 该技能六步修复流程 + `npm run audit:layers` = 0 + `npx tsc --noEmit` 0 错误 |
| 新增组件/模块重构/季度清理、僵尸组件/命名冲突/注册一致性/消费方验证 | `component-health-check` | advisory | 该技能审计脚本 + 注册表一致性校验 + 消费方引用验证 |
| 批量补全 doc_id/related_docs/covers_code/covers_docs 字段、建立文档↔代码↔测试↔SKILL 四向交叉索引、doc 生命周期治理 | `cross-index-governance` | mandatory | 该技能批量更新脚本 + frontmatter 完整性校验 + `npm run audit:docs` |
| 创建/编辑/移动 `docs/` 目录任意文档、文档录入与管理整体原则、十目录架构/Frontmatter标准/命名规范 | `doc-management-principles` | advisory | 该技能三环闭环治理清单 + frontmatter 必备字段校验 |
| audit:layers 报出 config 层与 constants 层同一业务常量双份定义、Grep 硬编码报出 `/src/config.*RESEARCH_STATUS/` 等业务常量泄漏、跨层重复常量迁移 | `v9-constant-migration` | mandatory | 迁移后 `npm run audit:layers` = 0 + `npx tsc --noEmit` 0 错误 + 测试 mock 路径更新校验 |

> **变更纪律**：新增技能 = ① 新建 `.trae/skills/<name>/SKILL.md`（frontmatter 含 `triggers`/`gates`/`mandatory`）→ ② 同步 `.trae/skills/skill-registry.json`（L1 注册表）→ ③ 更新本索引与路由表 → ④ 跑 `npm run audit:skill-coverage` 校验三方一致。钩子状态：pre-commit 挂 `--remind --log`（提醒模式，命中记录写入 `.trae/skills/usage.log`）；pre-push 挂 `--enforce --since <base>`（强制模式，mandatory 命中未确认即拦截，旁路 `SKILL_GATE_CONFIRM=1 git push`）。`npm run skill:route` 可随时手工查询。

---

## 一、项目分层规则（禁止跨层调用）

```
src/config/       ← 配置层（零硬编码锚点）
src/core/         ← 核心工具与类型守卫（DataBridge/databridgeAcl/databridgeHandlers/databridgeRouter/databridgeStrategyRouter/ACL/Envelope/MemoryCache/workerPool/stockCodeUtils）
src/agents/       ← AI 行为扩展（运行时模块，core 层扩展）
src/data/         ← 数据层（IndexedDB/dataLayer/queryBuilder/types/gateway）
src/lib/          ← 库函数（logger/logHelpers/format/errors/utils/localStorageManager）
src/domain/       ← 共享业务纯函数层（无 IO/无副作用；scoring/energy, trading/markers, collection/pipeline, export/...）
src/services/      ← 服务层（30+子域：analysis/scoring/fetcher/news/llm/trading/execution/...）
src/store/        ← 状态层（63个Zustand Store + helpers/withBroadcast；含 intentionPoolStore.ts / researchPoolStore.ts / positionPoolStore.ts / registrationContractStore.ts）
src/pages/        ← 页面层（5舱：input/analysis/trading/output/command）
src/components/   ← 组件层（atoms/molecules/organisms/templates + chart/cabin/cockpit/widgets）
src/portal/       ← PortalShell 舱室入口层
src/apps/         ← App 分发器（React.lazy 加载，三级加载链中间层）
src/cockpit/      ← 驾驶舱层（core/data/providers/widgets，独立布局域）
src/constants/    ← 常量层（零硬编码锚点）
src/types/        ← 零依赖（纯类型定义，可被所有层引用）
src/hooks/        ← 自定义 React Hooks（跨组件共享逻辑；含 usePoolBoard.ts）
src/devtools/     ← 开发环境调试工具（DEV 注入）
src/fixtures/     ← Mock 数据供给（测试数据）
src/i18n/         ← 国际化配置与翻译资源
src/mcp/          ← MCP 服务器层（15 个子服务器：analysis/backtest/data-collector/...）
src/schema/       ← Zod/JSON Schema 校验定义（类型守卫扩展）
src/showcase/     ← 组件展示页（开发环境专用，不进入生产构建）
src/generated/    ← 代码自动生成产物（令牌/类型/脚本输出）
src/services/workers/  ← Web Worker 脚本（纯计算逻辑，禁止引 store/pages/components；原约定顶层 src/workers/ 已并入 services 下）
```

### 依赖方向规则

- `pages/` 和 `components/` → 只能依赖 `store/`、`services/` 和 `domain/`，禁止直接调用 `dataLayer` 或 `db`
- `store/` → 只能依赖 `services/`、`core/` 和 `domain/`
- `services/` → 只能依赖 `core/`、`data/`、`lib/`（仅限基础设施）和 `domain/`，禁止直接写 `db`；所有写入必须封装为 `StandardEnvelope` 并通过 `DataBridge.forward()` 发起，最终由 `data/gateway/` 执行
  - **lib 基础设施白名单**：`logger`、`logHelpers`、`withBroadcast`、`eventBus`、`format`、`errors`、`utils`、`localStorageManager`、`safeCoerce`、`perf`、`precision`、`validation`、`safeRegex`
  - 禁止依赖 `lib/` 中的业务模块
- `domain/` → 共享业务纯函数层，仅可依赖 `lib/`（基础设施白名单）、`data/types/`、`config/`、`constants/`、`types/`；禁止依赖 `services/`、`store/`、`pages/`、`components/`、`core/`、`apps/`
- `data/` → `data/gateway/` 是唯一允许直接操作 `dataLayer` 与 `db` 的入口；`dataLayer` 子模块仅被 `data/gateway/` 与同级 `data/` 基础设施依赖
- `lib/` → 仅可依赖 `core/` 和 `config/`，禁止依赖 `services/`、`store/`、`pages/`、`components/`、`apps/`、`domain/`
- `core/` → 禁止依赖 `pages/`、`components/`、`apps/`；仅可依赖 `lib/` 中的**基础设施白名单**（`logger`/`withBroadcast`/`eventBus`/`format`/`errors`/`utils`/`localStorageManager`/`safeCoerce`/`perf`/`precision`/`validation`/`safeRegex`），禁止依赖 `lib/` 业务模块；`DataBridge` 写操作必须委托 `data/gateway/`，禁止直接 `import { db }` 或 `dataLayer` store
  - **说明（v1.4.7）**：`logger`/`eventBus` 等为横切基础设施，被 `core/` 依赖属工程常态，与 `services/` 白名单保持一致；`audit:layers` v3.1 按白名单放行、对业务模块报违规
- `config/` → 禁止依赖 `services/`、`pages/`、`components/`；仅可依赖 `lib/` 中的**基础设施白名单**（同上），禁止依赖 `lib/` 业务模块
- `constants/` → 禁止依赖任何运行时模块（仅导出常量，可被所有层引用）
- `types/` → 零依赖（纯类型定义，可被所有层引用）
- `agents/` → 仅可依赖 `core/` 和 `data/`（属于 core 层扩展）
- `hooks/` → 可依赖 `store/`、`services/` 和 `lib/`，可被 `pages/` 和 `components/` 依赖（跨组件共享逻辑层）
- `devtools/` → 仅开发环境使用，可依赖 `core/` 和 `lib/`（禁止引入生产逻辑）
- `fixtures/` → 测试数据层，仅被 `tests/` 依赖（禁止被生产代码引用）
- `i18n/` → 可依赖 `lib/`，可被 `components/` 和 `pages/` 引用（国际化工具层）
- `apps/` → 可依赖 `pages/`、`components/`、`store/`、`services/`，被 `portal/` 引用（App 分发器，三级加载链中间层）
- `cockpit/` → 可依赖 `components/`、`store/`、`services/`，可被 `pages/` 引用（驾驶舱独立布局域）
- `mcp/` → 可依赖 `core/`、`data/`、`lib/`、`services/`，可被 `services/` 和 `pages/` 引用（MCP 服务器扩展层）
- `schema/` → 仅可依赖 `types/` 和 `constants/`，可被 `services/`、`data/`、`components/` 引用（Schema 校验定义层）
- `showcase/` → 仅开发环境使用，可依赖 `components/`、`constants/`、`lib/`（开发展示页，禁止引入生产逻辑）
- `generated/` → 零依赖（纯自动生成产物），可被 `services/`、`components/`、`pages/` 引用（代码生成层）
- `services/workers/` → 仅可依赖 `core/`、`lib/`、`config/`、`data/`、`types/`、`constants/`，禁止依赖 `store/`、`pages/`、`components/`、`apps/`（Web Worker 纯计算层，无 DOM/React 访问；`core/workerPool/` 管理 Worker 生命周期，可被 `services/` 和 `store/` 引用；原约定顶层 `src/workers/` 已并入 `services/workers/`）

### 验证命令

```powershell
npm run audit:layers
# 期望：0 violations, 0 warnings
```

> 文件归位规则、目录映射与文件生命周期管理详见 [FILE-MANAGEMENT-GUIDE.md](docs/how-to/FILE-MANAGEMENT-GUIDE.md)。

### 📌 教训 1：架构契约是文档编写的唯一真相源

**适用场景**：任何需要描述项目架构、目录结构、分层规则的技术文档编写。

**具体原则**：
1. 文档编写前必须打开并阅读架构契约的**当前版本**（如 `AGENTS.md`、`ARCHITECTURE.md`），不能只凭记忆。
2. 必须逐条对比架构契约中的**每一项定义**（如每个目录、每个命名规则、每个验证命令），确保文档覆盖 100%。
3. 当架构契约与文档存在冲突时，必须以架构契约为准修改文档，不能反向修改架构契约（除非经过架构评审）。

**检查方法**：
```powershell
# 编写前执行：提取所有目录定义
grep -E '^\s*(src/|\.agents/|packages/|docs/)' AGENTS.md
# 编写后执行：对比目录列表，计算遗漏率（目标：0%）
```

**反例**：
- ❌ 凭记忆写："源代码放在 `src/` 下，按 `core/`、`data/`、`services/` 等分层"（遗漏了 `portal/`、`constants/` 等）
- ❌ 引用旧版本：文档依据 `AGENTS.md v1.0.0` 编写，而项目实际使用的是 `v1.4.3`

**正例**：
- ✅ 逐条复制：将 `AGENTS.md` §一的所有目录定义逐条复制到文档表格中，再添加文件管理特有的补充说明
- ✅ 版本对齐：文档头部明确标注"本文档基于 `AGENTS.md v1.4.3` 编写，当 `AGENTS.md` 版本升级时需同步修订本文档"

### 📌 教训 6：多个同类目录必须明确区分

**适用场景**：任何存在多个相似目录（如 `agents/` 与 `.agents/`、`utils/` 与 `lib/`、`config/` 与 `settings/`）的项目。

**具体原则**：
1. 对于每个目录，必须说明其**职责**（存放什么）、**依赖方向**（可依赖哪些层、可被哪些层依赖）、**与相似目录的区别**。
2. 目录命名必须避免歧义：如果两套 `agents` 目录存在，必须明确区分 `src/agents/`（运行时模块）和 `.agents/skills/`（AI 技能定义文件）。
3. 在文件归位规则表中，相似目录必须相邻排列，并附注对比说明。

**检查方法**：
- 搜索仓库中是否存在名称相似的目录（如含相同关键词的目录）。
- 检查文档中是否对每个相似目录都有独立的说明行和职责描述。
- 检查是否说明了目录间的依赖关系（如 `src/agents/` 仅可依赖 `src/core/` 和 `src/data/`）。

**反例**：
- ❌ 文档只写"`.agents/skills/`：AI Skill"，未提及 `src/agents/` 的存在
- ❌ 文档只写"库函数：`src/lib/`"，未说明 `src/utils/` 是旧目录还是新目录

**正例**：
- ✅ 相邻排列对比：
  - `| src/agents/ | AI 行为扩展（运行时模块，core 层扩展） | 仅可依赖 core/ 和 data/ |`
  - `| .agents/skills/ | AI 辅助技能定义文件 | 可被所有层引用 |`
- ✅ 废弃目录明确标注：`| src/utils/ | ⚠️ 已废弃，请使用 src/lib/ | 保留至 v1.5.0 迁移期结束 |`

---

## 二、四步集成编码契约

新模块严禁直接在 `/views` 或 `/pages` 目录下新建 `.vue` 或 `.tsx` 文件并孤立运行，必须按以下四步顺序集成：

1. **类型定义** → 在 `src/types/modules/` 或 `src/data/types.ts` 中定义 Interface
2. **Store/状态** → 在 `src/store/` 中创建 Zustand Store，通过 `withBroadcast` 实现跨 Tab 广播
3. **Builder/适配层** → 在 `src/services/` 中创建 Service，通过 DataBridge 写入数据
4. **核心集成** → 在 `src/pages/` 或 `src/components/` 中创建 UI，仅通过 Store 获取数据

每步可独立回滚，完成后运行 `npx tsc --noEmit` 验证类型安全。

**迁移收尾：全文件类型扫描**（参见 `docs/ui-migration-checklist.md`）：
- 组件目录迁移或重构完成后，必须对**全文件类型**（不仅限于 .tsx/.ts）扫描旧路径残留
- 扫描范围：`src/`、`scripts/`、`docs/`（排除历史报告）、`prompts/`、`AGENTS.md`、`.husky/`
- 扫描文件类型：`.tsx`、`.ts`、`.md`、`.json`、`.mjs`、`.cjs`、`.yaml`、`.yml`、`.sh`
- 特别关注 `AGENTS.md`（AI 行为契约）中的目录结构描述——引用旧目录会直接导致 AI 生成错误代码
- 构建产物（coverage/、dist-test/、docs/reports/）中的旧路径无需手动修改

**回滚验证流程**：
- 回滚后必须执行 `npx tsc --noEmit` 验证类型安全
- 回滚后必须执行 `npm run audit:docs` 检查文档同步状态
- 若回滚涉及接口签名变更，必须更新 `docs/06-routing-specs.md` 或相关数据字典
- 回滚后必须执行 `npm run audit:layers` 确认无跨层调用违规
- 回滚后必须执行 `npm run test -- --run` 确认单元测试通过

### 📌 教训 5：文件管理规范必须覆盖"入-移-出"全生命周期

**适用场景**：任何需要管理文件从创建到归档/删除全生命周期的项目。

**具体原则**：
1. **入（创建）**：新文件/目录的存放规则（目录映射、命名规范）。
2. **移（迁移）**：文件从一个目录迁移到另一个目录的 SOP（包括 import 路径更新、旧路径清理、跨层调用检查）。
3. **出（清理/归档）**：临时文件清理策略（`temp/` 保留期限、AI 产物归档周期、废弃目录清理时机）。
4. 迁移操作完成后必须执行架构审计（`audit:layers`）确认无跨层违规。

**检查方法**：
- 检查文档是否包含"临时文件/目录清理策略"章节。
- 检查文档是否包含"文件迁移 SOP"章节（含 import 路径更新、残留检查）。
- 检查文档是否包含"AI 生成产物管理"章节（存放位置、命名规则、保留期限）。
- 检查是否遗漏了"验证命令清单"的完整覆盖（如 `AGENTS.md` 定义了 7 项，文档必须全部列出）。

**反例**：
- ❌ 只定义"新文件放在 `src/` 下"，未定义"文件迁移时如何清理旧路径"（导致 `toolkit/` 残留、`src/utils/` 与 `src/lib/` 并存）
- ❌ 只定义"`.gitignore` 新增规则"，未定义"`.gitignore` 文档如何与实际同步"
- ❌ 提交前检查只列 3 项命令，遗漏了 `audit:hardcode`、`audit:deadcode` 等

**正例**：
- ✅ 包含"生命周期管理"章节：创建规则（第1节）、迁移 SOP（第2节）、清理策略（第3节）、定期审计（第4节）
- ✅ 验证命令完整列出：`tsc`、`lint`、`audit:layers`、`audit:hardcode`、`audit:deadcode`、`audit:docs`、`audit:token`

### Store 状态订阅规范（Zustand 响应式铁律）

> **问题背景（2026-07-19）**：全项目发现 26 个 Store 的派生函数（`topSignals(10)`、`accuracyTrend()` 等）使用 `store.getState()` 获取数据，是一次性快照而非响应式订阅。组件若只订阅 `loading/error/refresh` 而不订阅数据字段，数据更新后 UI 不会重渲染（P0 阻断）。

#### 铁律 1：组件层禁止裸用 `getState()` 派生函数

```tsx
// ❌ 错误：topSignals() 内部调用 getState()，非响应式
const { loading, error, refresh } = useSignalStore()
const signals = topSignals(10)

// ✅ 正确：通过 selector 直接订阅数据字段
const { loading, error, refresh, signals } = useSignalStore()
const top10 = signals.slice(0, 10)
```

#### 铁律 2：派生函数归类

| 类型 | 定义 | 使用场景 |
|------|------|----------|
| **Selector Hook** | 以 `use` 前缀命名，内部调用 Zustand selector | React 组件中（响应式） |
| **纯函数（static）** | 接收 `data` 参数而非调用 `getState()` | useMemo 中作为计算函数 |
| **非响应式查询** | 使用 `getState()`，JSDoc 标注 `@nonReactive` | Service 层、事件回调、Store action 内部 |

```tsx
// 类型 A：Selector Hook（响应式）
export function useTopSignals(limit = 10): Signal[] {
  return useSignalStore((s) => s.signals.slice(0, limit))
}

// 类型 B：纯函数（无副作用，可安全在 useMemo 中使用）
export function computeAccuracyTrend(reviews: SignalReviewRecord[], windowSize: number) {
  // 仅计算，不访问 store
}

// 类型 C：非响应式查询（仅在 Service/action 中使用）
/** @nonReactive 仅在 Service 层使用，组件中请用 useTopSignals() */
export function topSignals(limit = 10): Signal[] {
  return useSignalStore.getState().signals.slice(0, limit)
}
```

#### 铁律 3：Widget 组件必须订阅数据字段

Widget 的 `useEffect` 空依赖数组仅用于初始数据加载和订阅注册。数据更新依赖 Zustand selector，不是 DataBridge 事件回调：

```tsx
function MyWidget({ config }: Props) {
  // ✅ selector 订阅数据字段（响应式）
  const { data, loading, error, refresh } = useMyStore()

  // ✅ useEffect 仅用于初始加载（空依赖）
  useEffect(() => {
    const cleanup = initMyStoreSubscriptions()
    void refresh()
    return cleanup
  }, [])

  // selector 自动在 data 变化时触发重渲染
  return <WidgetStateShell visualState={...}>...</WidgetStateShell>
}
```

#### 存量清理策略

- **P0（本回合修复）**：Widget 组件正在使用 `getState()` 派生函数的，改为直接 selector 订阅数据字段
- **P1（渐进式）**：新增 Selector Hook（`use` 前缀），存量派生函数保留供 Service 层使用，添加 `@nonReactive` JSDoc 标注
- **P2（长期）**：全部派生函数改为纯函数形式（接收参数），由调用方决定何时计算

#### 验证命令

```powershell
# 搜索组件中裸用 getState() 的派生函数（候选整改点）
grep -rn "topSignals\|accuracyTrend\|winRateTrend\|bestReview\|worstReview\|getDirectionStats\|averageReturn\|averageWin\|averageLoss" src/cockpit/ src/components/ src/pages/
```

---

## 三、代码风格约束

### 类型安全

- 禁止使用 `any`（ESLint `@typescript-eslint/no-explicit-any: error`）
- 禁止使用 `@ts-ignore`（使用 `@ts-expect-error` 并附带注释说明原因）
- 禁止 `Record<string, string>` 作为 EnvelopeAction/branded type 的映射表类型标注（ESLint `no-record-string-string/no-record-string-to-branded: error`）。使用 `Record<string, EnvelopeAction>` 或移除显式类型标注让 TS 推断字面量类型（P3 教训）。
- 所有数据结构必须先定义 TypeScript Interface
- 复杂泛型必须有 `Expect<Equals>` 类型测试（位于 `tests/__tests__/types/`）
- 修改 `UserType` 不得破坏 `user-type.spec.ts`

### 零硬编码

- 引擎层：所有阈值、权重、公式参数必须从 `src/services/scoring/v6-engine/config.ts` 注入
- UI 层：所有颜色值必须引用 `src/constants/` 中的常量，禁止直接使用 HEX 或 Tailwind 数字颜色类
- 组件层：禁止魔法数字（3位以上数字需提取为 const 或 config）

### 日志规范

- 核心分支（filter reset、modal submission、data fusion）必须有 `logger.info` 打印
- 日志前缀格式：`[模块名] 操作名`，如 `[DataBridge] routeToDB() completed`
- 错误日志必须包含 context 对象：`logger.error('操作失败', { error: message })`

### 事件监听清理

- 所有 `useEffect` 中的事件监听必须在 cleanup 中显式移除
- `EventBus.subscribe()` 必须配对 `EventBus.unsubscribe()`
- 测试中使用 `vi.useFakeTimers()` 必须在 `afterEach` 中 `vi.useRealTimers()`

**标准清理模板**（v1.3.1 新增）：

```typescript
// ✅ 模板 1：EventBus 订阅清理
useEffect(() => {
  const handler = (data: unknown) => { /* 处理逻辑 */ }
  EventBus.subscribe('eventName', handler)
  return () => EventBus.unsubscribe('eventName', handler)
}, [])

// ✅ 模板 2：DOM 事件监听清理
useEffect(() => {
  const handler = (e: Event) => { /* 处理逻辑 */ }
  window.addEventListener('resize', handler)
  return () => window.removeEventListener('resize', handler)
}, [])

// ✅ 模板 3：定时器清理
useEffect(() => {
  const timerId = setInterval(() => { /* 定时任务 */ }, 1000)
  return () => clearInterval(timerId)
}, [])

// ✅ 模板 4：多个监听器批量清理
useEffect(() => {
  const cleanupFns: Array<() => void> = []
  
  cleanupFns.push(EventBus.subscribe('event1', handler1))
  cleanupFns.push(EventBus.subscribe('event2', handler2))
  cleanupFns.push(() => window.removeEventListener('scroll', scrollHandler))
  
  return () => cleanupFns.forEach(fn => fn())
}, [])

// ❌ 禁止：在 cleanup 中使用 EventBus.clear()（会影响其他订阅者）
```

### 颜色令牌规范（v2.0.0 新增）

> **核心原则**：所有颜色值必须通过令牌系统引用，禁止在 `src/components/`、`src/pages/`、`src/cockpit/`、`src/apps/` 中直接书写 HEX 值或 Tailwind 颜色类名。
>
> **速查表**：`docs/reference/design-token-mapping.md` 按业务场景给出 L1–L6 令牌的推荐 Import 与代码示例；`.vscode/token-snippets.code-snippets` 提供常用令牌的 VSCode 代码片段。

#### 3.5.1 令牌层次结构（4 层）

| 层级 | 导出文件 | 用途 | 消费方 |
|------|---------|------|--------|
| **L1 基础令牌** | `src/constants/theme.tokens.ts` → `THEME_TOKENS` | 通用语义色 + 尺寸/间距/圆角/排版/图标尺寸/控件尺寸 | 所有 UI 层 |
| **L2 语义令牌** | `src/constants/theme.tokens.ts` → `COLOR_TOKENS` | 业务语义色（涨跌/评分/因子/信号/背景/文字/边框） | 所有 UI 层 |
| **L3 色阶令牌** | `src/constants/theme.tokens.ts` → `COLOR_SHADES` + `twText/twBg/twBorder` | 需要特定色阶时（如 `red-600`、`blue-50`） | 组件层 |
| **L4 图表令牌** | `src/config/chartColors.ts` | 图表/热力图/轮动图专用配色 | 图表组件 |

**THEME_TOKENS 完整结构**：
```typescript
THEME_TOKENS = {
  color: { info, warning, success, destructive, muted, border, ... },
  iconSizes: { xs, sm, md, lg, xl },
  controlSizes: { xs, sm, md, lg },
  spacing: { xs, sm, md, lg, pxSm, pxMd, pxLg, pySm, pyMd, pyLg },
  radius: { sm, md, lg, full },
  gap: { xs, sm, md, lg, xl },
  stackGap: { xs, sm, md, lg, xl },
  score: { excellent, good, ok },
  focusVisible: { ringWidth, ringColor, ringOffset, ringOffsetColor },
  typography: {
    fontSize: { xs, sm, base, lg, xl, '2xl', '3xl', '4xl' },
    fontWeight: { normal, medium, semibold, bold },
    lineHeight: { none, tight, snug, normal, relaxed, loose },
    letterSpacing: { tighter, tight, normal, wide, wider, widest }
  }
}
```

#### 3.5.2 场景化使用规则

**场景 A：通用状态色（信息/警告/成功/错误）**

```typescript
// ✅ 使用 THEME_TOKENS.color
import { THEME_TOKENS } from '@/constants/theme.tokens'

<span className={THEME_TOKENS.color.info}>提示文本</span>        // text-blue-500
<div className={THEME_TOKENS.color.warningBg}>警告背景</div>      // bg-amber-500
<span style={{ color: THEME_TOKENS.color.successRaw }}>成功</span> // #22c55e
```

**场景 B：股票涨跌 / 评分等级 / 信号分级**

```typescript
// ✅ 使用 COLOR_TOKENS
import { COLOR_TOKENS } from '@/constants/theme.tokens'

<span className={COLOR_TOKENS.up.tailwind}>+3.2%</span>           // text-red-500
<div className={COLOR_TOKENS.scoreHigh.bgClass}>高分</div>         // bg-green-500
<span style={{ color: COLOR_TOKENS.signalWeak.hex }}>弱信号</span> // #f59e0b
```

**场景 C：需要特定色阶（如浅色背景 `bg-red-50`、深色文字 `text-red-700`）**

```typescript
// ✅ 使用 COLOR_SHADES
import { COLOR_SHADES } from '@/constants/theme.tokens'

<div className={COLOR_SHADES.red[50]}>浅红背景</div>              // bg-red-50
<span className={COLOR_SHADES.red[600]}>深红文字</span>            // text-red-600
<div className={COLOR_SHADES.blue[100]}>浅蓝背景</div>            // bg-blue-100

// ✅ 或使用辅助函数（当 COLOR_SHADES 未覆盖所需色阶时）
import { twText, twBg, twBorder } from '@/constants/theme.tokens'

<span className={twText('red', 600)}>深红</span>                  // text-red-600
<div className={twBg('blue', 50)}>浅蓝</div>                     // bg-blue-50
<div className={twBorder('gray', 200)}>灰边框</div>               // border-gray-200
```

**场景 D：图表/热力图/轮动图（需要 HEX 色值）**

```typescript
// ✅ 使用 chartColors.ts 中的业务配色
import { PIE_CHART_PALETTE, ROTATION_FACTOR_COLORS } from '@/config/chartColors'

<RechartsPie data={data} colors={PIE_CHART_PALETTE} />
<LineChart lineColor={ROTATION_FACTOR_COLORS.JINGQI} />

// ✅ 或使用 CHART_PALETTE（通用图表色）
import { CHART_PALETTE } from '@/constants/theme.tokens'

<RechartsBar fill={CHART_PALETTE.series1} />
```

**场景 E：暗色模式变体**

```typescript
// ✅ 使用 COLOR_SHADES 的 Dark 变体
import { COLOR_SHADES } from '@/constants/theme.tokens'

<div className={`${COLOR_SHADES.red[500]} ${COLOR_SHADES.red['200Dark']}`}>
  红文字 + 暗色模式浅红
</div>
<div className={`${COLOR_SHADES.red['900DarkBg']}`}>
  暗色模式深红背景
</div>
```

**场景 F：排版令牌（字体大小/字重/行高/字间距）**

```typescript
// ✅ 使用 THEME_TOKENS.typography
import { THEME_TOKENS } from '@/constants/theme.tokens'

<h1 className={cn(
  THEME_TOKENS.typography.fontSize['2xl'],
  THEME_TOKENS.typography.fontWeight.bold,
  THEME_TOKENS.typography.lineHeight.tight,
  THEME_TOKENS.typography.letterSpacing.tight
)}>
  标题文本
</h1>

<p className={cn(
  THEME_TOKENS.typography.fontSize.sm,
  THEME_TOKENS.typography.fontWeight.normal,
  THEME_TOKENS.typography.lineHeight.relaxed
)}>
  正文内容
</p>
```

**单一克制强调色公约 & 令牌管线一致性**（v1.4.0 新增）

> 为满足经典 UI 美学「色彩节制（60-30-10）」与 Nielsen 一致性原则，新增以下硬性规则：
> 1. **单一克制强调色**：全站仅允许一个品牌强调色（当前 = Apple Blue #007AFF，由 `index.css` 的 `--primary` 决定）。禁止在业务组件中引入第二个品牌色；语义色（涨跌/评分/因子/信号）仅限于状态传达，不得用作装饰性强调。
> 2. **令牌管线一致性**：`src/index.css` 是 V5 Apple Business Design Tokens 唯一真相源（`--primary: 210 100% 50%`）。已删除旧版 `design-tokens/tokens.json` 与 `src/generated/tokens.{css,ts}` 生成管道。运行时验证见 `src/lib/designTokenVerifier.ts`。
> 3. **禁止裸色类**：UI 层（`components/pages/cockpit/apps`）禁止直接书写 HEX 或数字色类，一律经 `THEME_TOKENS`/`COLOR_TOKENS`/`COLOR_SHADES`/`chartColors`。
> 4. **对比度门槛**：强调色配白字须达 WCAG AA 正文 4.5:1（`node scripts/a11y-contrast.cjs` 校验）。
> 5. **视觉 QA 回归闸**：`npm run audit:tokens` 为令牌合规 CI 门禁（零依赖，扫描 hex 字面量 + className 裸色类）。采用**基线 ratchet**——违规数只减不增，新增即 exit 1 拦截。基线存于仓库根 `.token-baseline.json`；消减债务后须 `npm run audit:tokens -- --update-baseline` 刷新并提交；本地全量体检用 `--strict`（任意违规即失败）。

**场景 G：图标尺寸和控件尺寸**

```typescript
// ✅ 使用 THEME_TOKENS.iconSizes 和 controlSizes
import { THEME_TOKENS } from '@/constants/theme.tokens'

<svg className={THEME_TOKENS.iconSizes.md}>...</svg>  // h-5 w-5
<button className={cn(THEME_TOKENS.controlSizes.lg, 'px-4')}>
  按钮
</button>  // h-12
```

**场景 H：间距和圆角**

```typescript
// ✅ 使用 THEME_TOKENS.spacing 和 radius
import { THEME_TOKENS } from '@/constants/theme.tokens'

<div className={cn(
  THEME_TOKENS.spacing.md,        // p-4
  THEME_TOKENS.radius.lg,         // rounded-lg
  THEME_TOKENS.gap.sm,            // gap-2
  COLOR_TOKENS.bgCard.tailwind    // bg-card
)}>
  卡片内容
</div>
```

**场景 C：股票涨跌动态颜色（红涨绿跌例外规则）**

> **⚠️ 例外规则**：股票涨跌颜色**不受通用颜色规范或主题切换影响**。
> 上涨 → 红色（`STOCK_COLOR_TOKENS.up` 或 `getStockColor()`），下跌 → 绿色（`STOCK_COLOR_TOKENS.down` 或 `getStockColor()`）。
> 此规则作为颜色令牌体系的例外：**必须豁免主题切换**（暗色模式不改变涨跌颜色）。

```typescript
// ✅ 正确 1：使用 STOCK_COLOR_TOKENS（推荐，自动豁免主题切换）
import { STOCK_COLOR_TOKENS, getStockColor, getStockColorClass } from '@/constants/theme.tokens'

// 自动判断涨跌
const color = getStockColor(stock.changePercent) // => STOCK_COLOR_TOKENS.up 或 down
const className = getStockColorClass(stock.changePercent) // => 'text-red-500' 或 'text-green-500'

// 手动判断
<span className={stock.changePercent > 0 ? STOCK_COLOR_TOKENS.up.tailwind : STOCK_COLOR_TOKENS.down.tailwind}>
  {stock.changePercent > 0 ? '+' : ''}{stock.changePercent.toFixed(2)}%
</span>

// ✅ 正确 2：使用辅助函数（推荐，代码更简洁）
import { getStockColorHex, getStockColorBg } from '@/constants/theme.tokens'

<div style={{ color: getStockColorHex(stock.changePercent) }}>
  涨跌颜色
</div>
<div className={getStockColorBg(stock.changePercent)}>
  涨跌背景
</div>

// ✅ 正确 3：三态（涨/跌/平）
import { STOCK_COLOR_TOKENS } from '@/constants/theme.tokens'

const changeColor = stock.changePercent > 0
  ? STOCK_COLOR_TOKENS.up.tailwind
  : stock.changePercent < 0
    ? STOCK_COLOR_TOKENS.down.tailwind
    : STOCK_COLOR_TOKENS.neutral.tailwind

// ❌ 禁止：硬编码涨跌颜色（即使语义正确）
<span className="text-red-500">+3.2%</span>        // 即使表示上涨也禁止
<span className="text-green-500">-1.5%</span>      // 即使表示下跌也禁止
<span style={{ color: '#ef4444' }}>+3.2%</span>    // 禁止 HEX 硬编码
```

> **豁免说明**：此场景的颜色选择逻辑（条件表达式）不受 §3.5.4 禁止清单约束，
> 但颜色值来源仍必须遵守令牌系统（`STOCK_COLOR_TOKENS.up` / `STOCK_COLOR_TOKENS.down`）。
> 审计脚本 `audit:hardcode` 对包含 `changePercent`、`priceChange`、`涨跌幅` 等关键词的
> 条件表达式中的令牌引用予以豁免。

#### 3.5.3 语义映射速查表

| 业务场景 | 应使用的令牌 | 禁止使用的硬编码 |
|---------|-------------|----------------|
| 股票上涨 | `COLOR_TOKENS.up` | `text-red-500`、`#ef4444` |
| 股票下跌 | `COLOR_TOKENS.down` | `text-green-500`、`#22c55e` |
| 信息提示 | `COLOR_TOKENS.info` 或 `THEME_TOKENS.color.info` | `text-blue-500` |
| 成功状态 | `COLOR_TOKENS.success` | `text-green-500` |
| 警告状态 | `COLOR_TOKENS.warning` | `text-amber-500` |
| 危险/错误 | `COLOR_TOKENS.danger` 或 `THEME_TOKENS.color.destructive` | `text-red-500`、`bg-red-500` |
| 评分高分 | `COLOR_TOKENS.scoreHigh` | `text-green-500` |
| 评分中分 | `COLOR_TOKENS.scoreMid` | `text-amber-500` |
| 评分低分 | `COLOR_TOKENS.scoreLow` | `text-red-500` |
| 轮动因子 | `ROTATION_FACTOR_COLORS.*`（chartColors.ts） | 内联 HEX |
| 信号分级 | `SIGNAL_GRADE_COLORS.*`（chartColors.ts） | 内联 HEX |
| 卡片背景 | `COLOR_TOKENS.bgCard` | `bg-white`、`#ffffff` |
| 默认边框 | `COLOR_TOKENS.border` | `border-slate-200`、`#e2e8f0` |
| 主要文字 | `COLOR_TOKENS.textPrimary` | `text-slate-800`、`#1e293b` |
| 次要文字 | `COLOR_TOKENS.textSecondary` | `text-slate-500`、`#64748b` |

#### 3.5.4 禁止与允许清单

```typescript
// ══════════════════════════════════════════════════════════════
// ❌ 禁止：在 UI 层直接书写颜色硬编码
// ══════════════════════════════════════════════════════════════

// ❌ 禁止 1：HEX 硬编码
<div style={{ color: '#ef4444' }}>错误</div>
<div style={{ backgroundColor: '#3b82f6' }}>信息</div>

// ❌ 禁止 2：Tailwind 颜色类硬编码
<div className="text-red-500 bg-blue-100 border-gray-300">状态</div>
<div className="hover:text-green-600">悬停变色</div>
<div className="dark:bg-slate-800">暗色模式</div>

// ❌ 禁止 3：内联 RGB/HSL
<div style={{ color: 'rgb(239, 68, 68)' }}>错误</div>

// ══════════════════════════════════════════════════════════════
// ✅ 允许：通过令牌系统引用颜色
// ══════════════════════════════════════════════════════════════

// ✅ 允许 1：THEME_TOKENS（通用语义色）
<div className={`${THEME_TOKENS.color.destructive}`}>错误</div>

// ✅ 允许 2：COLOR_TOKENS（业务语义色）
<div className={`${COLOR_TOKENS.up.tailwind} ${COLOR_TOKENS.bgCard.bgClass}`}>
  上涨卡片
</div>

// ✅ 允许 3：COLOR_SHADES（需要特定色阶）
<div className={`${COLOR_SHADES.red[50]} ${COLOR_SHADES.red[200]}`}>
  浅红背景 + 浅红边框
</div>

// ✅ 允许 4：chartColors.ts（图表场景）
<PieChart colors={PIE_CHART_PALETTE} />

// ✅ 允许 5：CHART_PALETTE（通用图表 HEX）
<div style={{ color: CHART_PALETTE.series1 }}>系列1</div>
```

#### 3.5.6 股票涨跌颜色例外规则（红涨绿跌）

> **⚠️ 例外规则**：股票涨跌颜色**不受通用颜色规范或主题切换影响**。

##### 规则说明

**中国A股标准**：
- 股票上涨 → **红色** 显示（红涨）
- 股票下跌 → **绿色** 显示（绿跌）
- 平盘/中性 → **灰色** 显示

**例外原因**：
- 这是**中国股市惯例**，与通用设计系统（成功=绿色、错误=红色）相反
- **必须豁免主题切换**（暗色模式不改变涨跌颜色）
- **必须豁免通用颜色规范**（不使用 `COLOR_TOKENS.success` 或 `COLOR_TOKENS.danger`）

##### 正确用法

```typescript
// ✅ 正确 1：使用 STOCK_COLOR_TOKENS（推荐，自动豁免主题切换）
import { STOCK_COLOR_TOKENS, getStockColor, getStockColorClass } from '@/constants/theme.tokens'

// 自动判断涨跌
const color = getStockColor(stock.changePercent) // => STOCK_COLOR_TOKENS.up 或 down
const className = getStockColorClass(stock.changePercent) // => 'text-red-500' 或 'text-green-500'

// 手动判断
<span className={stock.changePercent > 0 ? STOCK_COLOR_TOKENS.up.tailwind : STOCK_COLOR_TOKENS.down.tailwind}>
  {stock.changePercent > 0 ? '+' : ''}{stock.changePercent.toFixed(2)}%
</span>

// ✅ 正确 2：使用辅助函数（推荐，代码更简洁）
import { getStockColorHex, getStockColorBg } from '@/constants/theme.tokens'

<div style={{ color: getStockColorHex(stock.changePercent) }}>
  涨跌颜色
</div>
<div className={getStockColorBg(stock.changePercent)}>
  涨跌背景
</div>

// ✅ 正确 3：三态（涨/跌/平）
import { STOCK_COLOR_TOKENS } from '@/constants/theme.tokens'

const changeColor = stock.changePercent > 0
  ? STOCK_COLOR_TOKENS.up.tailwind
  : stock.changePercent < 0
    ? STOCK_COLOR_TOKENS.down.tailwind
    : STOCK_COLOR_TOKENS.neutral.tailwind
```

##### 错误用法

```typescript
// ❌ 错误 1：使用通用颜色令牌（会被主题切换影响）
import { COLOR_TOKENS } from '@/constants/theme.tokens'
<span className={COLOR_TOKENS.success.tailwind}>+3.2%</span>  // ❌ 错误！success 是绿色，但上涨应该是红色
<span className={COLOR_TOKENS.danger.tailwind}>-1.5%</span>  // ❌ 错误！danger 是红色，但下跌应该是绿色

// ❌ 错误 2：硬编码颜色（即使语义正确）
<span className="text-red-500">+3.2%</span>   // ❌ 即使表示上涨也禁止
<span className="text-green-500">-1.5%</span> // ❌ 即使表示下跌也禁止

// ❌ 错误 3：使用 COLOR_TOKENS.up/down（不推荐，容易混淆）
import { COLOR_TOKENS } from '@/constants/theme.tokens'
<span className={COLOR_TOKENS.up.tailwind}>+3.2%</span>  // ⚠️ 不推荐，容易与通用颜色混淆
```

##### ESLint 豁免

- `STOCK_COLOR_TOKENS` 和相关辅助函数（`getStockColor()` 等）**豁免** `no-hardcoded-colors` 检查
- 包含 `changePercent`、`priceChange`、`涨跌幅`、`stock.change` 等关键词的条件表达式**豁免**硬编码检查
- 审计脚本 `audit:hardcode` 对上述用法予以豁免

##### 实现说明

- `STOCK_COLOR_TOKENS` 是**独立导出的常量**，不包含在主题切换逻辑中
- 如需实现主题切换（暗色模式），**必须确保** `STOCK_COLOR_TOKENS` 不被修改
- `getStockColor()` 等辅助函数**硬编码**了红涨绿跌规则，不受主题上下文影响

---

#### 3.5.7 颜色令牌检查清单

**提交前自查**：

```typescript
// ✅ 检查清单
[ ] 是否使用了 STOCK_COLOR_TOKENS 或 getStockColor()？（股票涨跌场景）
[ ] 是否使用了 COLOR_TOKENS 或 THEME_TOKENS？（通用场景）
[ ] 是否使用了 COLOR_SHADES 或 twText/twBg/twBorder？（特定色阶场景）
[ ] 是否没有直接硬编码 HEX 或 Tailwind 颜色类？
[ ] 是否理解了红涨绿跌例外规则？
```

---

#### 3.5.6 新增颜色的 SOP

当需要新增一种颜色时，按以下决策树选择放置位置：

```
需要新颜色？
├── 通用语义色（info/warning/success 级别）？
│   └── → 添加到 THEME_TOKENS.color + COLOR_TOKENS
├── 业务语义色（涨跌/评分/信号/因子）？
│   └── → 添加到 COLOR_TOKENS 对应分区
├── 图表专用色（饼图/热力图/轮动图）？
│   └── → 添加到 src/config/chartColors.ts 对应配置
├── 需要特定色阶（如 red-50、red-600）？
│   └── → 添加到 COLOR_SHADES 对应色系
└── 定制色（非标准色，如板块分析低饱和色）？
    └── → 添加到 chartColors.ts 并注释说明"定制色，非标准 token"
```

**新增令牌必须包含**：
1. JSDoc 注释说明用途
2. `hex`、`tailwind`、`bgClass`、`rgb` 四个格式（COLOR_TOKENS 层级）
3. 在语义映射速查表（§3.5.3）中补充对应行

#### 3.5.7 豁免清单

以下文件/场景允许颜色硬编码（审计脚本自动排除）：

| 文件/目录 | 原因 |
|----------|------|
| `src/constants/theme.tokens.ts` | 令牌定义文件本身 |
| `src/config/chartColors.ts` | 图表配色定义文件 |
| `src/config/themeRegistry.ts` | 主题注册文件 |
| `src/theme.config.ts` | 主题配置文件 |
| `tests/` 目录 | 测试文件（但推荐使用令牌断言） |
| `COLOR_SHADES.*.hex` 对象 | 色阶 HEX 定义本身 |
| `CHART_PALETTE` 对象 | 图表调色板 HEX 定义本身 |

#### 3.5.8 审计与验证

```powershell
# 扫描颜色硬编码违规
npm run audit:hardcode

# 预期输出（零违规状态）
# ✅ 0 hardcoded colors in UI layer
```

**违规严重级别**：
- `src/components/`、`src/pages/`、`src/cockpit/`、`src/apps/` 中的 HEX 颜色 → **Major**
- `src/components/`、`src/pages/`、`src/cockpit/`、`src/apps/` 中的 Tailwind 颜色类 → **Major**

---

## 四、命名约定

- **文件名**: kebab-case（如 `data-bridge.ts`）或 PascalCase（如 `DataBridge.ts`）
- **组件**: PascalCase（如 `CockpitShell.tsx`）
- **Store**: camelCase + `Store` 后缀（如 `analysisStore.ts`）
- **常量**: UPPER_SNAKE_CASE（如 `ROUTE_REGISTRY`）
- **类型**: PascalCase + Interface 前缀（如 `interface StockData`）
- **UI 组件 import 路径**: 大小写必须一致（如 `Card` 而非 `card`）

### 📌 教训 3：文档编写必须使用标准化模板/Checklist

**适用场景**：任何项目级规范文档（文件管理规范、编码规范、API 规范、数据规范）的编写。

**具体原则**：
1. 每种文档类型必须有一个"必须包含章节清单"（Mandatory Section Checklist），编写者必须逐项勾选。
2. 文件管理规范必须包含的章节：目录映射表、命名规范、生命周期管理（创建/迁移/清理）、忽略规则、验证命令、交叉引用、版本管理。
3. 对于架构复杂项目，文档必须采用**穷尽性原则**而非**最小化原则**——任何文件都必须能在规范中找到归属规则。

**检查方法**：
- 编写前：读取该文档类型的模板 Checklist，确认所有章节都有覆盖计划。
- 编写后：对照 Checklist 逐项打勾，未覆盖的章节必须说明原因（如"本项目不适用"）。
- 审查时：审查者首先检查 Checklist 完成度，再检查内容质量。

**反例**：
- ❌ 凭经验写文件管理规范："文件放在 `src/` 下，测试放在 `tests/` 下，其他按常识处理"（遗漏命名规范、Schema 变更 SOP、temp 清理策略等）
- ❌ 采用"最小化原则"：只写最确定的规则，灰色地带留给"开发者自行判断"

**正例**：
- ✅ 使用模板：文件管理规范模板要求包含 8 个章节（目录映射、命名规范、`.gitignore`、提交前检查、定期审计、生命周期管理、交叉引用、变更日志），缺一不可
- ✅ 穷尽性原则：每个目录、每种文件类型、每个命名场景都必须在规范中有明确归属

---

## 五、路由注册规则

- 所有业务路由必须在 `src/config/routes.ts` 的 `ROUTE_REGISTRY` 中注册
- 禁止组件内硬编码路由路径
- 新增页面必须同步更新 `ROUTE_REGISTRY` 和 `docs/06-routing-specs.md`
- 路由白名单通过 `ROUTE_WHITELIST` 和 `ROUTE_PREFIX_WHITELIST` 控制

### 三级加载链架构（v2.0.0+）

页面通过三级间接加载，新增页面必须在对应层级注册：

```
routes.ts（48条路由）→ PortalShell → App 分发器（AnalysisApp/TradingApp/...）→ 页面组件
```

- **routes.ts**：注册舱室级路由（`/analysis`、`/trading` 等），指向 `PortalShell`
- **App 分发器**：在 `src/apps/{cabin}/` 中通过 `React.lazy()` 或静态 `import` 加载页面
- **audit:deadcode** 同时扫描三个注册源：`routes.ts` + `src/apps/` + `src/portal/`

### 新增页面 SOP

1. 在 `src/pages/{cabin}/` 创建页面组件
2. 在对应 `src/apps/{cabin}/{Cabin}App.tsx` 中添加 `React.lazy()` 导入和 else-if 分支
3. 运行 `npm run audit:deadcode` 确认页面不再出现在「未注册页面」列表中

### 审计排除规则

`audit:deadcode` 自动排除以下文件（不计入「未注册页面」）：
- 测试文件：`*.test.ts` / `*.test.tsx` / `__tests__/` 目录
- 子组件：`pages/{cabin}/components/` 目录（非独立页面，被父页面导入）

---

## 六、引擎架构约束

- L3/L4/L7/L8 是确定性层（程序计算），L0/L1/L2/L5/L6 是 LLM 可增强层
- L4 应用层不得直接调用 L6 外部依赖（含 LLM 客户端），必须通过 L3 services 路由
- LLM 模型选择和评分因子使用必须通过接口暴露给用户，含显式选择选项
- LLM 调用必须含用户可配置的开关，可禁用/启用特定 LLM 可增强层
- LLM API Key 必须使用 `localStorageManager.setEncrypted/getEncrypted` 加密存储
- LLM 输出必须经 `sanitizeLlmOutput` 消毒后渲染，防止 XSS

---

## 七、验证命令速查

```powershell
# 类型检查
npx tsc --noEmit

# ESLint
npm run lint

# 单元测试
npm test -- --run

# 生产构建
npm run build

# 架构审计
npm run audit            # 全部审计
npm run audit:layers     # 分层调用
npm run audit:mock-modules # Mock 模块安全审查（v1.5.0 新增）
npm run audit:acl-consistency # ACL 权限矩阵一致性（v1.4.9 新增）
npm run audit:directory  # 目录结构
npm run audit:hardcode   # 硬编码
npm run audit:deadcode   # 死代码
npm run audit:docs       # 文档同步
npm run audit:token      # Token 消耗检测
npm run audit:widget-registry # Widget 注册完整性审计

# 股票字典生成与校验（数据资产门禁）
npm run build:stock-dict          # akshare 重新生成 stockDictionary.ts（受管 venv python，T14 触发规则）
npm run build:stock-dict:verify   # 校验四交易所完整性 + 零重复（T14 触发规则）

# 快速门禁（提交前推荐）
npm run gate:quick       # 分层 + Mock + 原子组件 + 文档 + DB 引用
```

### 7.1 Token 消耗控制规则（v1.3.0 新增）

**背景**：知识图谱构建和 AI 辅助开发过程中存在严重的 Token 无谓消耗（月度 1.4M-2.3M tokens），主要来源于脚本重复解析、AI 重复搜索、架构合规检查冗余。

**强制规则**：
- **知识图谱优先**：理解代码关系时，必须先查询 `docs/00-meta/ai-index/.ai-index/code-graph.json`，禁止直接使用 grep/searchCodebase 重复搜索已存在的依赖关系
- **增量解析**：`extract-code-graph.ts` 必须支持增量更新（基于文件 mtime），禁止每次全量解析 466+ 文件
- **缓存查询结果**：常用查询（Store 依赖、跨层违规、最大文件）必须使用 `scripts/quick-query.sh` 模板，禁止重复构建查询逻辑
- **Token 预算**：单次 AI 会话 Token 消耗不得超过 50,000 tokens，超出必须使用知识图谱替代手动搜索

**验证命令**：
```powershell
npm run audit:token
# 期望：0 violations, Token 消耗 < 50,000/会话
```

### 7.2 驾驶舱 Widget 布局治理（v1.5.0 新增）

**背景**：驾驶舱是 FinSightV9 的主入口，Widget 的默认排列直接影响新用户的首次体验。产品定位为**股票研究复盘系统**（非实时交易系统），布局设计需体现「研究全景→深度分析→市场背景→持仓观察→系统运维」的五层梯度。

**布局原则**：
- **L1 研究全景**（首屏）：KAI 评分 + 股票池全景 + 投资画像 — 回答「我在研究什么？」
- **L2 深度分析**（核心区）：AI 对比 + AI 复盘 + 策略信号 — 回答「怎么分析？」
- **L3 市场背景**（辅助层）：大盘指数 + 板块热力 + 资金流向 — 提供研究上下文
- **L4 持仓观察**（末端）：持仓概览 + 自选股 — 仅跟踪，非交易 ⚠️
- **L5 系统运维**（末区）：引擎状态 + 风控 + Agent 性能 — 默认折叠

**变更规则**：
- 修改 `defaultLayout` 必须更新 `widgetRegistry.ts` 的 `createDefaultInstances()`
- 新增 Widget 同步更新三处：`widgetRegistry.ts` + `DEFAULT_WIDGET_CONFIG` + `WIDGET_DEFAULT_DATA_SOURCE`
- 变更后必须运行 `npm run audit:widget-registry` 确认 23/23 覆盖

**验证命令**：
```powershell
npm run audit:widget-registry
# 期望：0 P0 violations, 0 P1 warnings, 23/23 widgets placed
```

### 7.3 Mock 模块安全审查（v1.5.0 新增）

**背景**：P8 教训 — mock `collectionPipeline` 时全量替换导致 `upgradeDimensionsToPipeline` 初始化逻辑丢失。测试中 mock 高风险模块（`@/core/`、`@/services/`、`@/store/`）时，优先使用 `importActual + 局部覆盖` 模式，避免丢失 file-level side effects。

**Mock 安全清单**：
- 高风险模块 mock 优先用 `vi.mock('...', async () => { const actual = await vi.importActual('...'); return { ...actual, fn: vi.fn() } })`
- 全量替换仅在以下情况允许（需加入 `scripts/audit/audit-mock-modules.ts` allowlist）：
  - 需要 `vi.hoisted()` 捕获 callback（如 databridge subscribe）
  - 需自定义 memoryStore 实现
  - 模块仅 1-2 个 export 且全部被覆盖
- audit:mock-modules 提供 `SAFE_FULL_MOCKS` allowlist 机制，exit 0 表示无新增违规

**验证命令**：
```powershell
npm run audit:mock-modules
# 期望：0 violations, exit 0
```

### 7.4 数据质量断言三件套（v1.4.9 新增）

**背景**：L21 教训 — 任务 361/361 完成但 KPI 显示 0%（假红灯）。根因是 `runSingleTrace` 从未调用 `recordCollect()`，且 `runCollection` 完成后未调用 `refreshStats()`。

**三件套规则**：

1. **auditRecord()** — 写入后断言（WAP Audit 阶段）
   - 所有 `dataBridge.forward()` 写入路径之后，必须调用 `auditRecord(storeName, payload)` 校验关键字段非空
   - 校验规则：stocks→symbol、dailyQuotes→symbol、news→id、sectorScores→id、researchLogs→id、traceRecords→traceId
   - 文件：`src/services/data-collector/collectionPipeline.ts`

2. **recordCollect()** — 采集统计
   - `runSingleTrace` 的每个 return 点（成功/失败/unsupported/catch）必须调用 `getQualityMetrics().recordCollect(success, source, latency, fallbackChain)`
   - 不能只调 `recordWrite()`，因为 qualityMetrics 有两个独立统计维度（collect + write）
   - 文件：`src/services/data-collector/collectionPipeline.ts`（6 个 return 点）

3. **refreshStats()** — 统计同步刷新
   - `runCollection` 完成后（成功/失败/异常）必须调用 `runtime.refreshStats()` 同步 qualityMetrics 到 collectionRuntimeStore.stats
   - 否则监控页 KPI 卡片显示初始值 0%（假红灯）
   - 文件：`src/store/sevenDimConfigStore.ts`

**验证命令**：
```powershell
# 验证三件套调用对称性
grep -rn 'recordCollect' src/services/data-collector/collectionPipeline.ts  # 应有 6 处
grep -rn 'recordWrite' src/services/data-collector/collectionPipeline.ts    # 应有 8 处（4 true + 4 false）
grep -rn 'refreshStats' src/store/sevenDimConfigStore.ts                    # 应有 2 处（成功+异常）
grep -rn 'auditRecord' src/services/data-collector/collectionPipeline.ts    # 应有 4 处（3 调用 + 1 定义）
```

- 修改 IndexedDB schema 必须递增 `DB_VERSION`（`src/config/dbConfig.ts`）
- 新增 store 必须在 `STORE_NAME` 中注册
- **新增 store 必须在 `ACL_MATRIX` 中添加对应的 read/write 白名单**（v1.4.7 强化）
  - 同时运行 `npm run audit:acl-consistency` 验证调用方有对应权限
  - 教训：2026-07-18 03-08 维度采集报 ACL Permission denied，因 fetcher 缺 news/sectorScores/researchLogs 写权限
- **新增 ENVELOPE_ACTION 必须在 `ACTION_TO_STORE_MAP` 和 `databridgeHandlers.ts` 中同步注册**（v1.4.9 新增）
  - 运行 `npm run audit:acl-consistency` 验证 action→store→handler 配对一致性
  - 教训：2026-07-18 `saveTraceRecord` 未注册到 PutHandler，fallback 到裸 put → keyPath 失败
- 新增 store 必须有创建逻辑，按以下规则选择位置（v1.3.5 明确）：
  - **基线 store**（首次安装时就需要的核心 store）→ 在 `createSchema`（`src/data/db-schema.ts`）中添加
  - **增量 store**（版本升级时新增的 store）→ 在对应版本的 `Migration.up()`（`src/data/db-migrations.ts` 或 `src/data/migrations/`）中添加
  - 禁止在两处同时添加同一 store 的创建逻辑（违反 DRY 原则）
  - 当前基线 store 清单（由 createSchema 创建，共 29 个）：stocks / v6Scores / intelligentScores / industryScores / orders / watchlists / signals / researchLogs / dailyQuotes / financialReports / rotationScores / sectorScores / scoreDocs / strategySnapshots / localDocs / news / newsStockMap / sentimentCache / newsBookmarks / hotSectorScores / valuePitScores / executionLogs / missingReports / executionPlans / portfolios / tradeReviews / schemaMigrations / collectConfig / customAgents
  - 当前增量 store 清单（由 migration 创建）：RBAC 6 表（rbac_users / rbac_roles / rbac_permissions / rbac_user_roles / rbac_role_permissions / rbac_permission_audit_logs，由 rbacMigrationV24 创建）
  - 注意：schemaMigrations 表本身由 createSchema 创建（基线），但它的"种子数据"由 seed_schema_migrations_tracker migration 写入；customAgents 同理（store 由 createSchema 创建，种子数据由 seed_custom_agents_tracker migration 写入）
- 新增 ENVELOPE_ACTION 必须在 `DataBridge.routeToDB()` 中添加对应 case
- **修改 ACL_MATRIX / ENVELOPE_ACTION / ACTION_TO_STORE_MAP / databridgeHandlers 后必跑 `npm run audit:acl-consistency`**（v1.4.9 新增）
  - T13 触发规则：见 `docs/00-meta/doc-trigger-action-map.md`

---

## 九、LLM 调用透明度

- LLM 调用前必须向用户展示模型选择和评分因子使用情况
- 评分结果必须清晰标注哪些因子使用 LLM 增强 vs 自动计算
- LLM 调用必须包含用户可配置的开关

---

## 十、自主决策规则

### 三级决策矩阵

#### 自主执行（无需人工干预）

**适用场景**：低风险、单模块、完全可逆的操作

- 代码格式化、ESLint 自动修复
- 补充单元测试（覆盖率 < 80% 时）
- 文档同步更新（类型定义变更时）
- 架构合规性检查与自动修复

**自主修复边界**（v1.3.1 新增）：
- ✅ 允许：提取硬编码颜色到 `src/constants/theme.tokens.ts`
- ✅ 允许：提取魔法数字到 `src/config/thresholds.ts`（需遵循命名规范）
- ✅ 允许：修复跨层调用（调整 import 路径）
- ✅ 允许：补充缺失的事件监听清理代码
- ❌ 禁止：新增常量/配置项（涉及 `src/constants/` 或 `src/config/` 的新增）
- ❌ 禁止：修改现有接口签名
- ❌ 禁止：重构组件 props
- ❌ 禁止：删除或重命名已导出的函数/类

**验证机制**：
```powershell
npm run lint --max-warnings 0
npx tsc --noEmit
npm test -- --run
npm run audit:docs
```

#### 人工确认（需人工审批后执行）

**适用场景**：中风险、跨模块、部分可逆的操作

- 跨模块重构（涉及 3 个以上模块）
- 数据库 Schema 变更（修改 DB_VERSION）
- 接口签名变更（影响多个调用方）

**执行流程**：
1. 生成影响分析报告
2. 提交人工审批
3. 获得批准后分步执行
4. 每步完成后验证
5. 最终集成测试

#### 人工决策（必须人工决策）

**适用场景**：高风险、系统级、不可逆的操作

- 技术栈更换（如 Zustand → Redux）
- 核心算法重构（V6 评分引擎）
- 安全策略变更

**决策流程**：
1. 生成技术选型报告
2. 列出候选方案优劣
3. 提交技术评审委员会
4. 获得决策结论
5. 制定迁移计划

### 日志记录要求

所有任务完成后必须生成结构化日志，存储于 `docs/changelogs/YYYY-MM/` 目录，包含：
- 任务状态与进度
- 人机交互记录
- 文件变更详情
- 技术决策记录
- 质量指标快照

**查询工具**：
```powershell
npm run changelog:query -- --date=2026-07-04
npm run changelog:summary
```

---

## 十二、任务图管理机制

### 12.1 机制目标

解决 AI 辅助开发过程中出现的三大问题：
- **上下文任务丢失**：执行过程中忘记原始意图和前置任务
- **任务执行漂移**：操作超出预期范围，混入无关变更
- **过度纠结细节**：验证策略不明确，重复执行验证命令导致 token 浪费

### 12.2 状态前置检查门禁（每次任务开始前强制执行）

```powershell
git log --oneline -5          # 确认当前 commit 位置
git status --short            # 确认工作区状态
读取相关方案文档               # 确认任务边界
读取 docs-as-mirror 快速参考卡  # 防止文档编写违背 5 大核心原则（v1.4.5 新增）
记录 contextAnchor 快照        # 后续对照防漂移
```

### 12.3 任务图核心结构

每个复杂任务必须建立任务图，包含：

| 组成部分 | 说明 |
|---------|------|
| **rootTask** | 用户原始意图、成功标准、约束条件 |
| **phases** | 按阶段分解的任务清单，含依赖关系和 verificationLevel |
| **contextAnchor** | 意图锚点、范围锚点、状态锚点（防漂移） |
| **tokenBudget** | token 预算、已消耗、超预算策略 |

### 12.4 三级回归测试套件

替代"手动决定运行什么"的模式：

| 级别 | 触发场景 | 包含命令 | 预期耗时 |
|------|---------|---------|---------|
| **L1 轻量** | 单文件修改、类型修复 | `tsc --noEmit` + 相关测试 | ~30s |
| **L2 标准** | 模块拆分、跨文件重构 | L1 + `eslint` + `audit:layers` + `audit:deadcode` | ~2min |
| **L3 完整** | 阶段性提交、PR 合并前 | L2 + `npm test -- --run` + `npm run build` | ~5min |

**规则**：每个 phase 完成后必须运行对应级别的回归套件，结果作为 `exitCriteria` 的一部分。

### 12.5 上下文锚点防漂移规则

**每次执行工具调用前**，必须对照三个锚点：

1. **意图锚点**：当前操作是否服务于 `rootTask.intent`？
2. **范围锚点**：当前操作是否超出 `phase` 边界？
3. **状态锚点**：工作区状态是否与 `contextAnchor` 一致？

**触发暂停的条件**（硬性规则）：
- staged 文件数与 phase 预期不符
- 发现非本 phase 引入的文件变更
- pre-commit hook 修改了非 staged 文件
- token 消耗超过预算 80%

### 12.6 知识图谱优先（与 §7.1 协同）

```
理解代码关系时:
├── 优先查询 docs/00-meta/ai-index/.ai-index/code-graph.json     # 缓存的依赖关系
├── 常用查询用 scripts/quick-query.sh 模板    # 14 个预置查询
└── 仅当图谱未覆盖时才用 Grep/SearchCodebase
```

### 12.7 模板文件

- [task-graph-template.md](docs/explanation/task-graph-template.md) — 任务图模板
- [regression-suite.md](docs/reference/templates/regression-suite.md) — 回归测试套件模板

### 📌 教训 2：描述文件系统状态的文档必须通过自动化扫描验证

**适用场景**：任何描述仓库文件结构、目录内容、`.gitignore` 规则、忽略类别的文档。

**具体原则**：
1. 文档中描述的文件/目录/规则必须与实际仓库中的文件一致，不能基于"理想模板"或"常见实践"编写。
2. 对于 `.gitignore` 类文档，必须通过 `cat .gitignore` 读取实际文件，逐行对比文档描述。
3. 对于目录结构类文档，必须通过 `find` 或 `tree` 命令扫描实际文件系统，确认每个目录的存在性和归属。

**检查方法**：
- `.gitignore` 文档：将文档中列出的规则与 `.gitignore` 实际内容做 `diff`，统计文档未覆盖的规则比例（目标：<5%）。
- 目录结构文档：运行 `find . -maxdepth 2 -type d | sort` 与文档目录列表对比，确认所有非标准目录都有说明。
- 格式一致性：检查文档中的规则格式（如尾部斜杠）与 `.gitignore` 实际格式是否一致。

**反例**：
- ❌ 凭模板写 `.gitignore` 说明："通常包含 `node_modules/`、`dist/`、`.env`"（实际仓库可能还有 20 个其他规则未被提及）
- ❌ 文档写 `"Playwright": "/playwright-report/"`，实际 `.gitignore` 还包含 `screenshots/`、`.playwright-mcp/`

**正例**：
- ✅ 先扫描再编写：`cat .gitignore | grep -v '^#' | grep -v '^$' | sort` 获取实际规则列表，分类后写入文档
- ✅ 文档末尾附注："本文档基于 `.gitignore`（167 行规则）编写，新增规则时须同步更新本节"

### 📌 教训 4：文档必须完成"注册-引用-同步"才能视为完成

**适用场景**：任何项目文档的发布和生命周期管理。

**具体原则**：
1. **注册**：新文档必须注册到文档索引（如 `docs/README.md` 或 `REGISTRY_INDEX.md`），包含标题、路径、一句话描述、版本号。
2. **引用**：新文档必须引用所有相关文档（如文件管理规范必须引用 `AGENTS.md`），并在相关文档中反向建立引用（如 `AGENTS.md` 引用文件管理规范）。
3. **同步**：文档的"完成定义"（DoD）必须包含"已注册"和"已引用"两个检查项，未经 DoD 检查的文档视为草稿（Draft），不得发布。

**检查方法**：
- 注册检查：在文档索引中搜索新文档的文件名，确认已被收录。
- 引用检查：在新文档中搜索所有相关文档的引用链接（如 `[AGENTS.md]`），确认双向引用完整。
- 反向检查：在相关文档中搜索新文档的引用，确认引用链路是双向的而非单向的。

**反例**：
- ❌ 文档写完直接存到 `docs/01-requirements/`，未更新 `docs/01-requirements/README.md` 索引
- ❌ 文档引用了 `AGENTS.md`，但 `AGENTS.md` 中没有任何地方引用该文档（单向引用）

**正例**：
- ✅ 文档头部明确列出"相关文档"段落：`[AGENTS.md](AGENTS.md) | [trae-file-management-review.md](docs/00-meta/trae-file-management-review.md)`
- ✅ 文档索引中新增条目：`| 文件管理规范 | FILE-MANAGEMENT-GUIDE.md | 源代码归位、.gitignore 维护、提交前检查 | v1.0.0 |`

## 十三、模块分拆必要性评估框架

### 13.1 核心原则：非必要不分拆

分拆操作需满足以下前提条件之一：
- 存在明确的业务需求变更驱动
- 存在可量化的性能优化目标
- 存在架构升级必要性（如违反分层规则、职责混杂）
- 代码复杂度已严重影响开发效率和质量

**禁止为分拆而分拆**：单纯追求文件行数减少不是分拆的正当理由。

### 13.2 评估维度与权重

| 维度 | 权重 | 评估标准 |
|------|------|---------|
| **业务需求** | 30% | 是否有明确的业务变更驱动？（新增功能、需求变更） |
| **性能优化** | 20% | 是否存在性能瓶颈可通过拆分解决？ |
| **架构升级** | 25% | 是否符合分层架构原则？是否违反依赖方向规则？ |
| **可维护性** | 25% | 代码复杂度（CC）、认知负荷、团队协作效率 |

### 13.3 决策阈值

| 分数 | 决策 |
|------|------|
| ≥ 70 分 | 建议拆分 |
| 50-69 分 | 谨慎评估，考虑替代方案 |
| < 50 分 | 不建议拆分 |

### 13.4 替代方案评估

在决定拆分前，应优先考虑以下替代方案：

1. **函数提取**：将大函数拆分为小函数（不增加文件数）
2. **配置外化**：将常量/配置提取到 config/constants 文件
3. **类型定义分离**：将 interface/type 提取到 types 文件
4. **代码注释优化**：增加架构注释，降低认知负荷

### 13.5 分拆可行性评估清单

| 检查项 | 通过标准 |
|--------|---------|
| 调用点数量 | < 5 处（越少越好） |
| 私有方法内聚度 | 高（方法间关联性强） |
| 循环依赖风险 | 低（无跨模块循环依赖） |
| 测试覆盖度 | ≥ 80%（拆前） |
| 回滚成本 | 低（re-export 保持向后兼容） |

### 13.6 成本风险分析框架

**开发成本**：
- 估算代码迁移工时（按行数和复杂度）
- 估算测试适配工时
- 估算文档更新工时

**维护成本增量**：
- 新增文件数量
- 跨文件依赖关系复杂度
- 模块间接口定义与版本管理

**风险等级**：
| 风险 | 等级 | 应对策略 |
|------|------|---------|
| 循环依赖引入 | 高 | 使用 re-export 模式，确保定义在引用之前 |
| 接口签名变更 | 高 | 保持原接口不变，通过 re-export 兼容 |
| 测试覆盖率下降 | 中 | 拆分前确保测试覆盖，拆分后增量验证 |
| 开发效率短期下降 | 中 | 完成拆分后进行知识转移 |

---

## 十四、MCP 权限控制规范（v1.4.0 新增）

> **核心原则**：所有 MCP 工具调用必须经过双端权限校验（Client 防君子 + Server 防小人），禁止任何绕过权限矩阵的调用路径。

### 14.1 双端校验架构

```
调用方 → MCPBridge.callTool(server, tool, args, context?)
           │
           ▼
┌─────────────────────────────────────────────────┐
│  Client 端（防君子）— MCPClientImpl             │
│  mcpAclInterceptor.check(caller, server, tool)  │ ← 主拦截点
│  拒绝 → 返回 ACL_PERMISSION_DENIED              │
└─────────────────────────────────────────────────┘
           │ 透传 context
           ▼
┌─────────────────────────────────────────────────┐
│  Server 端（防小人）— MCPServerBase              │
│  this.assertServerPermission(caller, tool)      │ ← 深度防御
│  拒绝 → 抛 McpAclError → 返回错误结果           │
└─────────────────────────────────────────────────┘
           │
           ▼
      tool.handler(args) 实际执行
```

**强制规则**：
- 禁止绕过 `MCPClient` 直接调用 `MCPServer.callTool()`（Dashboard 等管理工具也必须走 `mcpBridge.callTool`）
- `MCPServerBase` 子类可重写 `assertServerPermission()` 实现自定义权限逻辑，但必须保留 `super.assertServerPermission()` 调用
- 所有 `mcpBridge.callTool/readResource/getPrompt` 调用必须传入 `context: { caller, callerId? }` 参数

### 14.2 调用方角色定义

| 角色 | 用途 | 权限范围 | 典型场景 |
|------|------|---------|---------|
| `agent` | AI Agent 自主调用 | 全权限（`'*'` / `'*'`） | AgentRuntime 执行任务 |
| `ui` | UI 层调用 | 仅查询类 Server/Tool | 组件按钮点击、表单提交 |
| `ci` | CI 流水线调用 | 仅 `system` Server 的查询/迁移工具 | GitHub Actions、迁移脚本 |
| `system` | 系统内部调用 | 全权限（`'*'` / `'*'`） | Bootstrap、迁移、Dashboard 管理工具 |

### 14.3 权限矩阵配置

权限矩阵定义于 `src/config/mcpAclMatrix.ts` 的 `MCP_ACL_MATRIX` 常量：

```typescript
export const MCP_ACL_MATRIX: Readonly<Record<McpCallerRole, McpPermissionRule>> = {
  agent:  { allowedServers: ['*'], allowedTools: ['*'] },
  ui:     { allowedServers: [9个查询类Server], allowedTools: ['health_check','list_*','get_*','fetch_*',...] },
  ci:     { allowedServers: ['system'], allowedTools: ['get_*','generate_migration_report'] },
  system: { allowedServers: ['*'], allowedTools: ['*'] },
}
```

**通配符规则**：
- `'*'`：匹配任意字符串
- `'prefix_*'`：匹配以 `prefix_` 开头的字符串（保留末尾下划线）

**与 DataBridge ACL 的关系**：
- `ACL_MATRIX`（`src/config/dbConfig.ts`）：数据层权限（module → store → operation）
- `MCP_ACL_MATRIX`（`src/config/mcpAclMatrix.ts`）：工具层权限（caller → server → tool）
- 两者形成纵深防御，互不替代

### 14.4 调用方适配规则

**调用方角色选择决策树**：

```
新增 mcpBridge.callTool 调用？
├── 调用方是 AI Agent（AgentRuntime）？
│   └── → { caller: 'agent', callerId: agentId }
├── 调用方是 UI 组件（按钮/表单）？
│   ├── 仅查询类操作 → { caller: 'ui', callerId: 'ComponentName' }
│   └── 系统管理工具（Dashboard 等） → { caller: 'system', callerId: 'ComponentName' }
├── 调用方是 CI 流水线？
│   └── → { caller: 'ci', callerId: 'github-actions' }
├── 调用方是系统内部（Bootstrap/迁移/Transport）？
│   └── → { caller: 'system', callerId: 'ModuleName' }
└── 不确定？
    └── → 默认 { caller: 'agent' }（全权限，但需在代码审查时确认）
```

**禁止清单**：
- ❌ 禁止 `mcpRegistry.getServer().server.callTool()` 直接调用（绕过 Client）
- ❌ 禁止省略 `context` 参数（除非是向后兼容的旧代码）
- ❌ 禁止在 UI 组件中用 `caller: 'agent'` 规避权限限制

### 14.5 新增 Server/Tool 权限配置 SOP

新增 MCP Server 时，必须按以下顺序配置权限：

1. **在 `MCP_ACL_MATRIX` 中配置权限规则**（`src/config/mcpAclMatrix.ts`）：
   ```typescript
   // 如果新 Server 是查询类（UI 可访问）
   ui: { allowedServers: [..., 'newServer'], allowedTools: [..., 'new_query_tool'] }
   ```

2. **如果是写操作类 Server**，不要添加到 `ui` 角色的 `allowedServers` 中

3. **新增 Tool 时**，根据 Tool 性质配置通配符：
   - 查询类 Tool → 添加 `'get_*'` 或 `'list_*'` 通配符（自动覆盖）
   - 写操作 Tool → 显式列出 Tool 名（如 `'create_order'`）
   - 危险操作 Tool → 仅允许 `agent`/`system` 角色

4. **更新单元测试**（`src/mcp/__tests__/mcpAclInterceptor.test.ts`）：
   - 在"四角色权限对比矩阵"套件中新增测试用例
   - 在"权限拒绝场景全覆盖"套件中新增拒绝场景

5. **运行验证**：
   ```powershell
   npx vitest run src/mcp/__tests__/mcpAclInterceptor.test.ts
   ```

### 14.6 类型定义位置

| 类型 | 定义文件 | 用途 |
|------|---------|------|
| `McpCallerRole` | `src/types/modules/mcp.types.ts` | 调用方角色枚举（零依赖） |
| `McpCallerContext` | `src/types/modules/mcp.types.ts` | 调用方上下文（caller + callerId） |
| `McpPermissionRule` | `src/config/mcpAclMatrix.ts` | 权限规则接口 |
| `MCP_ACL_MATRIX` | `src/config/mcpAclMatrix.ts` | 权限矩阵常量 |
| `mcpAclInterceptor` | `src/mcp/core/mcpAclInterceptor.ts` | 拦截器单例 |
| `McpAclError` | `src/mcp/core/mcpAclInterceptor.ts` | 权限拒绝错误类 |

**分层规则**：
- `types/` 定义 `McpCallerRole`（零依赖，可被所有层引用）
- `config/` 从 `types/` 导入 `McpCallerRole` 定义权限矩阵
- `mcp/core/` 从 `config/` 和 `types/` 导入实现拦截器
- 禁止 `types/` 依赖 `config/`（保持类型层零依赖）

### 14.7 验证命令

```powershell
# MCP ACL 拦截器单元测试（72 用例）
npx vitest run src/mcp/__tests__/mcpAclInterceptor.test.ts

# 全部 MCP 测试 + 集成测试
npx vitest run src/mcp/__tests__/ tests/__tests__/integration/mcp-servers.integration.test.ts

# 类型检查（MCP 相关文件零错误）
npx tsc --noEmit | findstr /R "mcpAcl mcpBridge MCPServer MCPClient"
# 期望：无输出（零错误）
```

### 14.8 错误处理

权限拒绝时统一返回格式：

```typescript
// 拒绝结果（ToolResult）
{
  content: [{ type: 'text', text: 'ACL_PERMISSION_DENIED: <reason>' }],
  isError: true,
}
```

**排查步骤**：
1. 检查 `context.caller` 是否传入正确的角色
2. 检查 `MCP_ACL_MATRIX[caller].allowedServers` 是否包含目标 Server
3. 检查 `MCP_ACL_MATRIX[caller].allowedTools` 是否匹配目标 Tool（注意通配符规则）
4. 查看日志中的 `[MCP:ACL]` 前缀信息

### 📌 教训 7：版本号体系必须在文档发布前明确并统一

**适用场景**：任何多文档协同的项目，特别是文档体系与代码体系版本不同步的情况。

**具体原则**：
1. 采用"项目级版本 + 文档修订号"双版本号体系：项目级版本（如 `v2.5.0`）标识文档体系兼容性，文档修订号（如 `rev.3`）标识该文档自身的修订次数。
2. 或采用统一版本号：所有文档与项目版本保持一致（如全部使用 `v2.5.0`），通过修订日期区分文档更新。
3. 任何情况下，文档头部必须明确说明其版本号体系，以及与其他文档的版本兼容关系。

**检查方法**：
- 检查文档头部是否包含版本号声明和版本号体系说明。
- 检查文档索引中记录的版本号是否与文档实际版本号一致。
- 检查相关文档间的版本号是否有明显冲突（如一个 `v1.0.0`，一个 `v2.5.0`，无法判断谁更旧）。

**反例**：
- ❌ 文档写 `v1.0.0`，README 写 `v2.5.0`，`AGENTS.md` 写 `v1.4.3`——三者无法比较新旧
- ❌ 文档只写版本号，不写版本号体系说明（如"这是文档独立版本还是项目版本？"）

**正例**：
- ✅ `> 文档体系版本: v2.5.0 | 本文档修订: rev.1 | 兼容 AGENTS.md v1.4.3+`
- ✅ 变更日志中记录与相关文档的版本同步关系：`v1.1.0 (2026-07-20) | 同步 AGENTS.md v1.4.3 的目录定义`

---

## 十一、变更日志

| 版本 | 日期 | 变更摘要 |
|------|------|----------|
| v1.5.2 | 2026-07-20 | 新增 §十六 Bash 使用约定（16.1-16.6）：Git Bash 路径规范、受管 venv Python 固化、命令入口统一（npm scripts）、禁止命令清单、执行后联动义务、长命令与超时纪律 |
| v1.4.9 | 2026-07-18 | §七.4 新增数据质量断言三件套规则（auditRecord + recordCollect + refreshStats）；§七 验证命令新增 `audit:acl-consistency`；§八 新增 ENVELOPE_ACTION → handler 注册一致性规则；新增 `scripts/audit/audit-acl-consistency.ts` 门禁脚本；Husky pre-commit 扩展为 16 项 |
| v1.4.8 | 2026-07-18 | §八 强化 ACL 白名单约束（新增 store → 必跑 audit:acl-consistency）；增加 §四 状态假红灯教训（recordCollect + recordWrite + refreshStats 三件套） |
| v1.4.6 | 2026-07-20 | §一 新增 `data/gateway/` 层定义；明确 Gateway 是唯一允许直接操作 `dataLayer`/`db` 的入口，`DataBridge` 写操作必须委托 Gateway；新增 `docs/03-development/gateway-write-permission-spec.md` 规范文档 |
| v1.4.3 | 2026-07-10 | 标题区新增 JSDoc 与复杂度规范引用；新增 `docs/jsdoc-convention.md`、`docs/complexity-governance.md`、`scripts/audit-jsdoc.ts`、`scripts/audit-complexity.ts`；Husky 预提交门禁扩展为 9 项检查（新增 audit:jsdoc、audit:complexity） |
| v1.4.2 | 2026-07-10 | §3.5 颜色令牌规范新增 `docs/design-token-mapping.md` 与 `.vscode/token-snippets.code-snippets` 引用；新增 `design-tokens/figma-to-project.json`、`design-tokens/project-to-figma.json` 双向映射与 `scripts/verify-design-tokens.ts`；Husky 预提交门禁扩展为 7 项检查并新增 `pre-push` 门禁 |
| v1.4.1 | 2026-07-10 | 新增提示词模板与检查清单引用：在标题区引用 `prompts/` 系统提示词模板、`docs/ui-migration-checklist.md` 与 `docs/widget-integration-checklist.md` |
| v1.4.0 | 2026-07-08 | §十四 新增 MCP 权限控制规范（14.1-14.8），包含双端校验架构、4 种调用方角色定义、权限矩阵配置、调用方适配决策树、新增 Server/Tool 权限配置 SOP、类型定义分层规则、验证命令、错误处理排查步骤 |
| v1.3.7 | 2026-07-08 | §十三 新增模块分拆必要性评估框架（13.1-13.6），包含评估维度与权重、决策阈值、替代方案评估、分拆可行性评估清单、成本风险分析框架 |
| v1.3.6 | 2026-07-08 | §十二 新增任务图管理机制（12.1-12.7），包含状态前置检查门禁、三级回归测试套件、上下文锚点防漂移规则；新增 task-graph-template.md 和 regression-suite.md 两个模板文件 |
| v1.3.5 | 2026-07-08 | §7 新增 audit:contract 契约合规性检测脚本；extract-code-graph.ts 新增增量更新+AST 缓存机制；创建 quick-query.sh 快速查询模板；daily-doc-validation.ts 重写括号检查逻辑 |
| v1.3.3 | 2026-07-05 | §3.5.1 补充 THEME_TOKENS 完整结构说明；§3.5.2 新增场景 F/G/H；完成 Alert/Badge 组件 Design Tokens 迁移；新增组件迁移最佳实践文档 |

| v1.3.2 | 2026-07-05 | §1 补充 services→lib 依赖规则（明确 lib 基础设施白名单）；补充 types/ 和 agents/ 层定义；audit-layer-calls.ts v2.2 新增 services→lib 业务模块检测 |
| v1.3.1 | 2026-07-05 | §3 新增事件监听清理标准模板（4 个）、新增 AI 自主修复边界清单（允许/禁止）；§1 补充 lib/ 层依赖规则；§2 补充四步契约回滚验证流程（5 项验证要求）；Store 数量修正 39→44、服务子域 18→20 |
| v1.3.0 | 2026-07-05 | §7 新增 Token 消耗控制规则（§7.1）、新增 audit:token 脚本、优化 audit:layers/hardcode/deadcode 检测能力、新增知识图谱使用指南和常见错误模式清单 |
| v1.2.0 | 2026-07-04 | §5 新增三级加载链架构说明、新增页面 SOP、审计排除规则；audit:deadcode v2.0 支持 App 分发器扫描 |
| v1.1.0 | 2026-07-04 | 新增自主决策规则、日志记录要求 |
| v1.0.0 | 2026-07-02 | 初始版本：分层规则、四步契约、类型安全、零硬编码、路由注册、引擎架构、验证命令、数据库版本管理、LLM透明度 |

---

## 附录：文件管理快速参考卡

> 来源：`docs/00-meta/FILE-MANAGEMENT-GUIDE-optimization-prompt.md`（2026-07-20）

### 快速检查表

| 检查项 | 检查命令/方法 | 通过标准 | 失败后果 |
|--------|-------------|---------|---------|
| 目录完整性 | 对比 `AGENTS.md` §一 vs 文件归位规则表 | 13 个目录 100% 一致 | 文件放错位置，架构漂移 |
| 命名规范 | 扫描新增文件名 | kebab-case/PascalCase/camelCase+Store/UPPER_SNAKE_CASE | 构建失败，认知负荷增加 |
| `.gitignore` 同步 | 逐行对比 `.gitignore` vs 文档 2.2 节 | 类别覆盖率 100%，格式一致 | 文档权威性丧失，重复提交 |
| 文件流浪 | `git status --short` + `find . -name '*.ts'` | 无 `src/` 外源码，无重复目录 | 维护成本倍增，`audit:layers` 失败 |
| 文档引用 | 检查文档末尾引用 + `README.md` 索引 | 引用 `AGENTS.md`，被 `README` 收录 | 信息孤岛，无法发现相关规范 |
| 版本号对齐 | 对比文档头部 vs 项目体系版本 | 双版本号一致（项目级+文档级） | 版本混乱，难以追踪变更 |
| 验证命令完整性 | 对比文档检查清单 vs `AGENTS.md` §七 | 9 条命令 100% 一致 | 遗漏关键检查，技术债务积累 |
| Schema 变更同步 | 检查 `DB_VERSION` + `STORE_NAME` + `ACL` + `Migration` | 全部同步更新 | 运行时崩溃，数据丢失 |
| docs 分层 | 确认文件放入 `00-07` 正确子目录 | 编号体系一致 | 文档无法导航，检索困难 |
| 禁止事项例外 | 检查根目录新增文件 | 标准配置文件/根级文档除外 | 根目录混乱，文件难以管理 |

### 场景速查

**场景 A：AI 生成新文件 → 确保正确目录**
```
1. 读取 AGENTS.md §一，确定文件应放入哪个 src/ 子目录
2. 检查文件归位规则表是否包含该目录（若无，先补文档）
3. 按命名规范确定文件名（kebab-case/PascalCase/camelCase+Store/UPPER_SNAKE_CASE）
4. 确认不创建在 src/ 外的独立目录
5. 确认不创建与已有目录重复的职责目录
```

**场景 B：AI 修改 .gitignore → 确保同步文档**
```
1. 在 .gitignore 新增规则的同时，在文档 2.2 节新增对应类别行
2. 确认类别分组注释清晰
3. 确认格式一致（尾部斜杠、前导 /）
4. 禁止只修改 .gitignore 而不修改文档
5. 禁止只修改文档而不修改 .gitignore
```

**场景 C：AI 编写文档 → 确保与 AGENTS.md 一致**
```
1. 读取 AGENTS.md 最新版本，确认目录名 100% 一致
2. 在文档中引用 AGENTS.md 相关章节（如 §一分层、§四命名）
3. 确认文档被 docs/01-requirements/README.md 索引收录
4. 确认版本号与项目体系版本一致
5. 确认提交前检查清单与 AGENTS.md §七 100% 一致
```

**场景 D：AI 代码迁移 → 防止文件流浪**
```
1. 迁移前确认目标目录已在文件归位规则表中定义
2. 迁移后执行全文件类型扫描（不仅 .tsx/.ts，还包括 .md/.json/.mjs/.cjs/.yaml/.yml/.sh）
3. 检查旧路径是否有残留（文件内容和 import 路径）
4. 检查 AGENTS.md 中的目录结构描述是否引用旧路径（如引用旧目录会导致 AI 生成错误代码）
5. 运行 npm run audit:layers 确认无新增跨层违规

---

## 十五、部署架构原则：本地优先，拒绝云原生过度工程（v1.4.6 新增）

### 15.1 原则声明

FinSightV9 是**个人本地投研复盘工具**，定位决定了部署架构必须坚持 **本地优先**，拒绝云原生过度工程。

### 15.2 约束规则

1. **不引入后端微服务**：不落地 FastAPI / Kafka / 云端多数据库集群。所有计算在浏览器端完成。
2. **重计算走本地**：需要密集计算的功能（回测、因子计算、嵌入）优先走 Web Worker 或 WASM，不依赖远程计算节点。
3. **存储优先本地轻量引擎**：
   - 关系型/文档数据 → IndexedDB（现有 `dataLayer`）
   - 高频行情 → 需要时用 DuckDB / sql.js 列式存储本地
   - 向量检索 → 需要时用 LanceDB / Chroma 本地库，不自建 Milvus 集群
4. **可选云端适配层**：所有数据接入层（Collector / Adapter）预留 Mock/REST/WebSocket 三态切换能力，为未来「本地 + 可选云端」折中方案保留路径。
5. **实时性 SLA**：盘中实时查询的延迟预算由 `src/constants/cockpit.constants.ts` 中的 `REALTIME_SLA_MS`（当前默认 2000ms）约束。当真实行情接入时，WebSocket 推送目标 <500ms，REST 轮询目标 <2000ms。超时时 UI 应显示「数据延迟」警告。

### 15.3 与本文件其他条目的关系

- 本节与 §一（项目分层规则）一致：所有层均运行在浏览器进程内，无需跨服务调用。
- §三「零硬编码」：所有云端端点路径集中在 `src/config/`，不嵌入源码。
- §七「验证命令」不变——门禁依然在本地运行，不依赖外部服务健康状态。
- 新增代码/模块引入本节约束：若提议引入后端依赖（消息队列、远程推理、云端数据库），必须先经 §十三（模块分拆必要性评估）评估。

### 15.4 验证方式

- 新增模块代码审查时检查：是否违反 15.2 中的任一约束。
- 所有新增 npm 依赖审查：避免引入服务端运行时依赖。

---

## 十六、Bash 使用约定（v1.5.2 新增）

> **归因**：2026-07-20 会话确认 Kimi Work 等 AI 工具默认开放 Bash 工具调用。为统一不同 AI 工具的 Shell 行为、避免路径漂移与环境污染，固化本节约定。权限放行（每次调用是否需人工确认）由客户端权限模式控制，不属于本节范围。

### 16.1 默认 Shell 与路径规范

1. 默认 Shell 为 **Git Bash**（POSIX 语义）；禁止假设 PowerShell/CMD 语法。
2. Git Bash 返回的 `/g/...` 路径必须转换为 Windows 形式 `G:\...`（大写盘符 + 反斜杠）；获取当前目录 Windows 路径用 `pwd -W`。
3. 含空格路径在命令行中必须加双引号，如 `"C:\Program Files\Git\bin\bash.exe"`。
4. 一切文件操作限定在**本仓库根目录（当前工作区）**内；确需目录外文件时，先复制进工作区再操作副本，禁止直接改原文件。

### 16.2 Python 环境选择（固化，禁止漂移）

1. 项目 Python 脚本一律通过 `package.json` npm scripts 调用，解释器路径由 `scripts/run-venv-python.cjs` 按 `USERPROFILE` 动态解析受管 venv（如 `node scripts/run-venv-python.cjs default scripts/generate-stock-dict.py`），**禁止硬编码任何用户目录（DELL/huawei 等）或盘符路径（G:/、D:/ 等）**。
   （现有 `build:stock-dict`、`build:sw-industry` 等脚本已在 package.json 改为可移植启动器。）
2. 新增 Python 脚本入口必须登记为 npm script 并沿用同一启动器；禁止在脚本、文档、提示词中引入第二个 Python 解释器路径，亦禁止硬编码任何用户目录或绝对盘符路径（一律改用 `USERPROFILE`/`os.homedir()`/`__file__` 派生或环境变量覆盖）。
3. 禁止向系统 Python 或受管 venv 安装项目依赖；任何 `pip install` 需用户显式确认。

### 16.3 命令入口统一

1. 测试、审计、构建一律走 `package.json` npm scripts，禁止直接调用裸 `vitest` / `tsc` 绕过门禁参数：
   - 单元测试：`npm run test`（即 `vitest run`）
   - 快速门禁：`npm run gate:quick`（完整清单见 §七）
   - 类型检查：`npm run tsc:prod`
2. 有依赖关系的多步命令用 `&&` 串联；相互独立的只读命令应并行发起，禁止串行等待。

### 16.4 禁止命令清单

| 类别 | 禁止项 |
|------|--------|
| 权限 | 任何需要 sudo / 管理员权限的命令 |
| 删除 | `rm -rf` 指向 `src/`、`docs/`、`scripts/` 等受管目录；跨盘符删除 |
| Git | `git push --force`、`git reset --hard`、`git clean -fd`（未经用户显式确认） |
| 配置 | 修改 `.env`、`.env.local`、`.env.development.local`（密钥类文件只读） |
| 依赖 | 未经用户确认的 `npm install` / `pip install` 新依赖 |
| 进程 | 交互式或常驻进程命令；调试启动的 dev server 用完必须终止，禁止残留后台 Node/Vite 进程 |

### 16.5 执行后联动义务

| 触发动作 | 必跑命令/流程 |
|---------|--------------|
| 新增/修改 `src/store/` 下 Store | `npm run audit:acl-consistency` |
| 文件迁移 / 目录重构 | `npm run audit:layers` + §二 全文件类型旧路径扫描 |
| 回滚操作 | §二 回滚验证流程五项（tsc / audit:docs / 接口文档 / audit:layers / test） |
| 修改 token / 颜色相关代码 | `npm run audit:tokens`（基线只减不增） |

### 16.6 长命令与超时纪律

1. 单命令默认预算 60s；构建 / 全量测试类命令须显式声明预期耗时。
2. 禁止交互式命令；可能长时间运行的命令必须先给出退出条件。
3. 每条命令附一句中文说明（为什么跑）；失败时如实报告退出码与 stderr，禁止掩盖为"成功"。

---

## 附录二：相关参考文档

| 文档 | 路径 | 说明 |
|------|------|------|
| 开发工作流 SOP | `docs/03-development/development-workflow-sop.md` | 编码前/中/后/上线后全周期操作指南 |
| Gateway 写入权限规范 | `docs/03-development/gateway-write-permission-spec.md` | Gateway 层职责、StandardEnvelope 格式、迁移路径与验证方式 |
| 文档治理宪法 | `docs/GOVERNANCE.md` | `docs/` 目录治理规则 |
| 编码规范摘要 | `docs/standards/coding-conventions.md` | AGENTS.md 工程约束速查版 |
| Widget 开发指南 | `docs/widget-development-guide.md` | 驾驶舱 Widget 扩展指南 |

```
