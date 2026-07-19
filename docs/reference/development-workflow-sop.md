---
title: V9 智能投研复盘系统 �?开发工作流 SOP
type: reference
domain: project
phase: development
tier: standard
status: active
maintainer: V9 Architecture Team
summary: "文档体系版本: v2.0.0 | 本文档修�?*: rev.1 | 日期: 2026-07-13 适用范围: 所�?FinSightV9 开发者（AI 辅助 +..."
tags: [project, workflow, system, review]
version: v1.0.0
last_updated: 2026-07-17
code_version: 2.0.0
doc_id: V9-DOC-PROJ-217
related_docs: [V9-DOC-ARCH-002, V9-DOC-PROJ-016]
referenced_by: [V9-DOC-PROJ-032, V9-DOC-META-000, V9-DOC-PROJ-176, V9-DOC-PROJ-149]
change_log:
  - version: v1.0.0
changes: Initial version established
date: 2026-07-17
---

# V9 智能投研复盘系统 �?开发工作流 SOP

> **文档体系版本**: v2.0.0 | **本文档修�?*: rev.1 | **日期**: 2026-07-13
> **适用范围**: 所�?FinSightV9 开发者（AI 辅助 + 人工编码�?> **强制等级**: 必须遵守
> **关联文档**: [AGENTS.md](../../AGENTS.md) v1.4.6+ | [architecture.md](../explanation/architecture.md) | [governance.md](../00-meta/governance.md) | [CHANGELOG.md](../../CHANGELOG.md)

---

## 一、工作流总览

```
┌─────────────────────────────────────────────────────────────�?�? Phase 1: 编码前（查询 �?设计 �?验证基线�?                  �?�?   �?查询 AI 记忆 / 任务图建�?/ 运行架构审计 / 四步集成顺序   �?├─────────────────────────────────────────────────────────────�?�? Phase 2: 编码中（开�?�?实时纠偏 �?本地测试�?              �?�?   �?分层守护 / 颜色令牌 / JSDoc 补齐 / 复杂度监�?           �?├─────────────────────────────────────────────────────────────�?�? Phase 3: 编码后（提交 �?门禁验证 �?覆盖率追踪）              �?�?   �?Husky 14 步阻断门�?+ 1 warn / 测试分层 / 文档同步       �?├─────────────────────────────────────────────────────────────�?�? Phase 4: 上线后（日志 �?复盘 �?知识沉淀�?                  �?�?   �?结构化变更日�?/ 质量指标快照 / 经验教训入库             �?└─────────────────────────────────────────────────────────────�?```

---

## 二、Phase 1: 编码前（Prevent Errors�?
### 2.1 状态前置检查（每次任务开始）

```bash
# 确认当前 commit 位置
git log --oneline -5

# 确认工作区状�?git status --short

# 读取相关方案文档�?AGENTS.md 当前版本
cat AGENTS.md | head -5
```

**触发暂停的条�?*�?- staged 文件数与任务预期不符
- 发现非本任务引入的文件变�?- 当前基线不绿

### 2.2 查询 AI 记忆索引

优先使用知识图谱�?AI 记忆，避免重复搜索已存在的依赖关系：

```bash
# 查询是否有人处理过类似问题（避免重复踩坑�?npx tsx scripts/query-ai-memory.ts "widget 注册"
npx tsx scripts/query-ai-memory.ts "跨层调用"

# 常用架构查询模板
bash scripts/quick-query.sh
```

**何时使用**�?- 准备新建 Widget / Store / Service �?- 遇到不明所以的 lint/type 错误�?- 接手他人遗留代码�?
### 2.3 建立任务图（复杂任务必做�?
对于任何涉及 3 个以上文件或跨模块的任务，必须建立任务图（参�?`../explanation/task-graph-template.md`）：

| 组成部分 | 说明 |
|---------|------|
| **rootTask** | 用户原始意图、成功标准、约束条�?|
| **phases** | 按阶段分解的任务清单，含依赖关系�?verificationLevel |
| **contextAnchor** | 意图锚点、范围锚点、状态锚点（防漂移） |
| **tokenBudget** | token 预算、已消耗、超预算策略 |

**上下文锚点防漂移规则**：每次工具调用前对照三个锚点�?1. 当前操作是否服务�?`rootTask.intent`�?2. 当前操作是否超出 `phase` 边界�?3. 工作区状态是否与 `contextAnchor` 一致？

### 2.4 确认基线�?
任何编码前，先确认当前分支基线全绿（�?30 秒）�?
```bash
# 快速健康检查（L1 轻量：只跑最严格�?4 项）
npm run tsc:prod
npm run audit:layers
npm run audit:mcp
npm run audit:widget-registry
```

**如果基线不绿**：先修复，再开始新功能开发。禁止在红牌基线上叠加新代码�?
### 2.5 四步集成检查清单（新建模块必做�?
新模块严禁直接在 `pages/` �?`components/` 下新建孤立文件，必须按顺序：

| 步骤 | 目录 | 交付�?| 验证命令 |
|------|------|--------|----------|
| 1. 类型定义 | `src/types/modules/` �?`src/data/types.ts` | Interface / Type | `npx tsc --noEmit` |
| 2. Store/状�?| `src/store/` | Zustand Store + `withBroadcast` | `vitest run` |
| 3. Builder/适配 | `src/services/` | Service + DataBridge 写入 | `audit:layers` |
| 4. UI 集成 | `src/pages/` �?`src/components/` | 仅通过 Store 获取数据 | `audit:atomic` |

**一键生�?Widget（第 4 步辅助）**�?```bash
npm run scaffold:widget
```

### 2.6 模块分拆必要性评估（重构/拆分前必做）

分拆前必须满足以下前提之一�?- 存在明确的业务需求变更驱�?- 存在可量化的性能优化目标
- 存在架构升级必要性（违反分层规则、职责混杂）
- 代码复杂度已严重影响开发效率和质量

**禁止为分拆而分�?*�?
评估维度与权重：

| 维度 | 权重 | 评估标准 |
|------|------|---------|
| 业务需�?| 30% | 是否有明确业务变更驱�?|
| 性能优化 | 20% | 是否存在性能瓶颈可通过拆分解决 |
| 架构升级 | 25% | 是否符合分层架构原则 |
| 可维护�?| 25% | 代码复杂度、认知负荷、团队协作效�?|

**决策阈�?*：≥ 70 分建议拆分；50-69 分谨慎评估；< 50 分不建议拆分�?
---

## 三、Phase 2: 编码中（Real-time Guardrails�?
### 3.1 分层守护（最核心�?
每次修改 import 路径后，手动触发�?
```bash
# 扫描 877+ 个文件，0.1 秒出结果
npm run audit:layers
```

**依赖方向规则速查�?*（来�?[AGENTS.md](../../AGENTS.md) §一）：

```
pages/ + components/  �? store/ + services/（禁止直接调�?dataLayer/db�?store/                  �? services/ + core/
services/               �? core/ + data/ + lib/（白名单基础设施�?lib/                    �? core/ + config/（禁止依�?services/store/pages�?core/                   �? 禁止依赖 pages/components/apps/lib/
config/                 �? 禁止依赖 services/pages/components/lib/
agents/                 �? 仅可依赖 core/ + data/
cockpit/                �? 可依�?components/ + store/ + services/
mcp/                    �? 可依�?core/ + data/ + lib/ + services/
schema/                 �? 仅可依赖 types/ + constants/
```

### 3.2 颜色令牌实时检�?
```bash
# 只扫描你正在编辑的文件（3 秒）
npx eslint --config eslint.colors.config.js src/components/YourComponent.tsx
```

**禁止清单**�?- �?`text-red-500`、`bg-blue-100`、`#ef4444`、`border-gray-300`
- �?使用 `COLOR_TOKENS` / `COLOR_SHADES` / `THEME_TOKENS` / `chartColors.ts`

**例外**：股票涨跌颜色（红涨绿跌）使�?`STOCK_COLOR_TOKENS`，豁免主题切换�?
### 3.3 JSDoc 自动补齐

```bash
# 批量为新增函数补 JSDoc�? 秒）
npm run auto:jsdoc
```

**JSDoc 强制�?*�?- 所有新增公共函数、组件、Hook、Store
- 复杂泛型必须�?`@template` 说明
- 参数/返回值类型必须有 `@param` / `@returns`

### 3.4 复杂度实时监�?
```bash
# 扫描当前代码复杂度，超过阈值会标红
npm run complexity-scan
```

**阈值规�?*�?- 禁止深层嵌套�? 4 层）
- 禁止长链式条件（> 3 �?`&&`/`||`�?- 禁止过长函数�? 100 行）

### 3.5 MCP 权限控制（新�?修改 MCP Server 时）

所�?MCP 工具调用必须经过双端权限校验（来�?[AGENTS.md](../../AGENTS.md) §十四）：

- **Client �?*：`mcpAclInterceptor.check(caller, server, tool)`
- **Server �?*：`MCPServerBase.assertServerPermission(caller, tool)`
- **禁止绕过**：禁止直接调�?`MCPServer.callTool()`，必须走 `mcpBridge.callTool`

新增 Server/Tool 权限配置 SOP�?1. �?`src/config/mcpAclMatrix.ts` �?`MCP_ACL_MATRIX` 中配置规�?2. 写操作类 Tool 不要加入 `ui` 角色�?`allowedServers`
3. 查询�?Tool 使用 `'get_*'` / `'list_*'` 通配�?4. 更新 `src/mcp/__tests__/mcpAclInterceptor.test.ts`
5. 运行 `npx vitest run src/mcp/__tests__/mcpAclInterceptor.test.ts`

### 3.6 本地优先原则（新增外部依�?数据源时�?
FinSightV9 是个人本地投研复盘工具，新增模块必须遵守（来�?[AGENTS.md](../../AGENTS.md) §十五）：

- �?不引入后端微服务（FastAPI / Kafka / 云端多数据库集群�?- �?重计算走 Web Worker �?WASM
- �?存储优先本地轻量引擎（IndexedDB / DuckDB / LanceDB�?- �?所有云端端点路径集中在 `src/config/`
- �?实时�?SLA �?`src/constants/cockpit.constants.ts` �?`REALTIME_SLA_MS` 约束

---

## 四、Phase 3: 编码后（Commit & Quality Gates�?
### 4.1 Husky 预提�?14 步阻断门�?+ 1 warn

```bash
git add -A && git commit -m "feat(scope): 描述"
```

门禁自动运行（按 `.husky/pre-commit` 实际顺序，任意一步失败即阻断）：

| 步骤 | 门禁名称 | 目的 | 阻断�?|
|------|----------|------|--------|
| 1/10 | lint-staged | 暂存�?ESLint --fix | �?阻断 |
| 2/10 | lint:colors | 颜色硬编码扫�?| �?阻断 |
| 3/10 | tsc:prod | TypeScript 零错�?| �?阻断 |
| 5/14 | audit:layers | 跨层调用检�?| �?阻断 |
| 6/14 | audit:atomic | 原子组件边界 | �?阻断 |
| 7/14 | file:check | 文档规范检�?| �?阻断 |
| 8/14 | audit:docs | 代码-文档同步 + 版本漂移检�?| �?阻断 |
| 9/14 | verify:tokens | 设计令牌映射 | �?阻断 |
| 10/14 | audit:tokens | 令牌消费检�?| �?阻断 |
| 11/14 | audit:jsdoc | JSDoc 覆盖（基线采集） | ⚠️ 警告 |
| 12/14 | audit:complexity | 代码复杂度（基线采集�?| ⚠️ 警告 |
| 13/14 | audit:widget-registry | Widget 三处注册一致�?| �?阻断 |
| 14/14 | audit:ai-output | AI 输出三道校验 | �?阻断 |
| 15/15 | audit:db-references | DB 引用一致性审�?| �?阻断 |
| warn | audit:path-match | 文档目录-内容匹配 | ⚠️ 警告（不阻断�?|
| warn | audit:doc-integrity | 文档-代码双向完整性（npm scripts / 脚本文件 / 路径存在性） | ⚠️ 警告（不阻断�?|

> **�?*：`.husky/pre-commit` 中编号存在历史跳跃（3/10 后直�?5/14），实际执行顺序以上表为准；warn 项不纳入 15 步编号�?
**如果门禁失败**�?1. 不要 `--no-verify` 跳过（除非修复的是门禁本身的问题�?2. 阅读错误信息，修复对应文�?3. 重新 `git add` 并提�?
### 4.1.1 触发事件矩阵（SOP 与脚本的调用链）

以下事件会自动触发对应审计，避免 SOP/脚本沦为无人调用的清单：

| 事件 | 触发�?| 运行内容 | 阻断�?|
|------|--------|----------|--------|
| `git commit` | `.husky/pre-commit` | 15 步阻断门�?+ `audit:path-match` + `audit:doc-integrity` | `audit:doc-integrity` �?warn，不阻断 |
| `push` / `pull_request` �?`main` | `.github/workflows/quality-check.yml` | lint + typecheck + route + test + audit + `audit:doc-integrity` | `audit:doc-integrity` 非阻塞（基线采集�?|
| `push` / `pull_request` �?`main` | `.github/workflows/doc-automation.yml` | `doc-update-trigger` + `doc-auto-updater --dry-run` + `audit:docs` + `audit:doc-integrity` + `doc:version-check` | `audit:doc-integrity` 非阻�?|
| 本地全量审计 | `npm run audit` | 15 项审计链（含 `audit:doc-integrity`�?| 由子命令自身决定 |
| 月度维护 | `npm run doc:freshness` / `doc-freshness.yml` cron | 保鲜度评�?+ 告警 | 非阻�?|

**新增脚本/门禁的注册义�?*：任何新脚本若进�?SOP §4.1 表格�?§8 工具链地图，必须同时声明其触发事件（Husky / CI / 手动 / 定时），否则视为未完成的接入�?
### 4.2 三级回归测试套件

| 级别 | 触发场景 | 包含命令 | 预期耗时 |
|------|---------|---------|---------|
| **L1 轻量** | 单文件修改、类型修�?| `tsc --noEmit` + 相关测试 | ~30s |
| **L2 标准** | 模块拆分、跨文件重构 | L1 + `eslint` + `audit:layers` + `audit:deadcode` | ~2min |
| **L3 完整** | 阶段性提交、PR 合并�?| L2 + `npm test -- --run` + `npm run build` | ~5min |

**快速测试（仅运行与你修改相关的测试�?*�?```bash
npm run test:staged
```

**全量测试（提交前必做�?*�?```bash
npm run test:clean
```

### 4.3 测试分层策略

| 层级 | 测试类型 | 范围 | 运行命令 | 目标覆盖�?|
|------|----------|------|----------|------------|
| L1 | 单元测试 | 函数/纯逻辑 | `npm run test` | �?80% |
| L2 | 集成测试 | 跨模块交�?| `npx vitest run src/mcp/__tests__/` | �?60% |
| L3 | E2E 测试 | 用户操作流程 | `npm run test:e2e` | 关键路径覆盖 |
| L4 | 崩溃恢复 | 模拟进程中断 | 手动 + 脚本验证 | 核心数据不丢 |
| L5 | 门禁回归 | tsc + audit + lint | `npm run regression` | 100% 通过 |

### 4.4 覆盖率追�?
```bash
# 生成覆盖率报�?npm run coverage

# 查看历史趋势
npm run audit:tests
```

**当前基线**�?30+ 个测试文件（194 �?src/�?36 �?tests/），目标持续增加�?
---

## 五、高频命令速查�?
### 5.1 开发日常（每日 �?5 次）

| 命令 | 耗时 | 用�?|
|------|------|------|
| `npm run tsc:prod` | ~10s | 类型检�?|
| `npm run audit:layers` | ~0.1s | 分层审计 |
| `npx eslint --config eslint.colors.config.js src/...` | ~3s | 颜色合规 |
| `npm run test:staged` | ~2s | 相关测试 |
| `npm run complexity-scan` | ~2s | 复杂度扫�?|

### 5.2 提交前（每次 commit 前）

| 命令 | 耗时 | 用�?|
|------|------|------|
| `git add -A && git commit -m "..."` | ~30s-2min | 触发全部 14 步阻断门�?|
| `npm run test:clean` | ~10s | 全量测试 |

### 5.3 定期维护（每�?每月�?
| 命令 | 频率 | 用�?|
|------|------|------|
| `npm run audit:deadcode` | 每周 | 死代码清�?|
| `npm run audit:mcp` | 每次 MCP 变更 | Server 利用�?|
| `npm run audit:widget-registry` | 每次 Widget 变更 | 注册一致�?|
| `npm run anomaly:detect` | 每周 | 质量异常检�?|
| `npm run build:health` | 每月 | 构建健康报告 |
| `npm run audit` | 每月 | 全量审计（约 15 项） |

---

## 六、Phase 4: 上线后（Log & Learn�?
### 6.1 结构化变更日�?
所有任务完成后必须生成结构化日志，存储�?`docs/changelogs/YYYY-MM/`�?
| 必含�?| 说明 |
|--------|------|
| 任务状态与进度 | �?phase 完成状�?|
| 人机交互记录 | 关键决策点和确认 |
| 文件变更详情 | 新增/修改/删除文件清单 |
| 技术决策记�?| 为何选择此方�?|
| 质量指标快照 | tsc/audit/test 结果 |

```bash
# 查询变更日志
npm run changelog:query -- --date=2026-07-13
npm run changelog:summary
```

### 6.2 文档同步义务

代码变更后必须同步更新文档：
- 类型定义变更 �?数据字典 / API 契约
- 路由变更 �?`./06-routing-specs.md`
- 架构变更 �?`../explanation/03-architecture-standards.md` / 相关 ADR
- AGENTS.md 变更 �?所有引�?AGENTS.md 的文�?
变更后运行：
```bash
npm run audit:docs
npm run file:check
```

---

## 七、特殊场景处�?
### 7.1 门禁脚本本身出错（如 `verify:tokens` 脚本崩溃�?
**原则**：门禁脚本的 bug 不应阻断业务代码提交�?
**处理流程**�?1. 确认错误是脚本问题而非代码问题（查看错误堆栈）
2. 修复脚本或临时从 `.husky/pre-commit` 中注释掉该步�?3. 提交修复脚本�?PR
4. 恢复门禁步骤

### 7.2 紧急修复（hotfix�?
```bash
# 在明确知道后果的情况下，可跳过门�?git commit --no-verify -m "hotfix(scope): 紧急修复描�?
# 但必须在 24 小时内补回门禁验�?```

### 7.3 自主决策边界（AI 辅助编码�?
根据 [AGENTS.md](../../AGENTS.md) §十：

| 类型 | 示例 | 是否需要人工确�?|
|------|------|----------------|
| �?自主执行 | 代码格式化、ESLint 自动修复、补充单元测试、硬编码颜色提取 | �?|
| ⚠️ 人工确认 | 跨模块重构（3+ 模块）、数据库 Schema 变更、接口签名变�?| �?|
| �?人工决策 | 技术栈更换、核心算法重构、安全策略变�?| 必须 |

### 7.4 AI 辅助编码检查清�?
1. **AI 生成代码后，必须运行 `audit:layers`** �?AI 容易误写跨层 import
2. **AI 修改颜色后，必须运行 `lint:colors`** �?AI 容易硬编�?Tailwind 颜色
3. **AI 新增函数后，必须运行 `audit:jsdoc`** �?AI 生成�?JSDoc 经常不完�?4. **AI 重构后，必须运行 `audit:widget-registry`** �?AI 容易漏注�?Widget
5. **AI 修改 MCP Server 后，必须运行 `audit:mcp`** �?AI 容易遗漏 ACL 配置

---

## 八、工具链地图

```
代码质量
  ├── TypeScript: npm run tsc:prod
  ├── ESLint: npm run lint + eslint.colors.config.js
  ├── Complexity: npm run complexity-scan
  └── JSDoc: npm run auto:jsdoc + npm run audit:jsdoc

架构守护
  ├── 分层: npm run audit:layers
  ├── 原子: npm run audit:atomic
  ├── MCP: npm run audit:mcp
  ├── Widget: npm run audit:widget-registry
  └── 路由: npm run audit:routes

测试
  ├── 单元/集成: npm run test / npm run test:staged
  ├── E2E: npm run test:e2e
  ├── 覆盖�? npm run coverage
  └── 回归: npm run regression

文档
  ├── 同步: npm run audit:docs
  ├── 双向完整�? npm run audit:doc-integrity
  ├── 规范: npm run file:check
  ├── 版本: npm run doc:version-check
  └── 路径: npx tsx scripts/audit-path-match.ts

AI 辅助
  ├── 记忆: npm run query:aiMemory
  ├── 脚手�? npm run scaffold:widget
  └── 异常: npm run anomaly:detect
```

---

## 九、更新与维护

- **�?SOP 版本**�?**AGENTS.md 版本**绑定，AGENTS.md 升级时同步修�?- **新增门禁步骤** �?更新 §4.1 表格，并�?§4.1.1 触发事件矩阵中登记触发源
- **新增脚本** �?更新 §5 速查表、�? 工具链地图，并接入至少一个触发事件（Husky / CI / 定时 / 手动�?- **新增 AI 行为约束章节** �?更新 §2/§3 相关检查清�?- **变更提交流程** �?需经过 `npm run audit:docs`、`npm run audit:doc-integrity` �?`npm run file:check` 验证
- **CI 工作流变�?* �?同步更新 §4.1.1 触发事件矩阵

---

> **最后验�?*：本文档更新后，运行以下命令确认 SOP 与当前工具链一致：
> ```bash
> npm run file:check && npm run audit:docs && npm run audit:doc-integrity
> ```
