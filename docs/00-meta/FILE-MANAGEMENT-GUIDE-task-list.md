---
title: file-management-guide-task-list
type: meta
domain: project
phase: development
tier: important
status: active
maintainer: V9 Architecture Team
summary: "每个 Phase 完成后，必须执行以下验证，确认无任务漂移�?
tags: [project, guide, management, list, governance, documentation, checklist, component]
version: v1.0.0
last_updated: 2026-07-17
code_version: 2.0.0
doc_id: V9-DOC-PROJ-014
change_log:
  - version: v1.0.0
changes: Initial version established
date: 2026-07-17
---

# file-management-guide.md 修订任务清单

> **Date**: 2026-07-20  
> **关联报告**: `../reports/audit/file-management-guide-test-report.md`  
> **目标文件**: `../how-to/file-management-guide.md`  
> **防止任务漂移原则**: 每个任务必须有明确的验收标准（AC），完成后打勾确�?
---

## 任务总览

| 阶段 | 任务�?| 预计工期 | 目标版本 |
|------|--------|---------|---------|
| Phase 1 - P0 紧急修�?| 4 �?| 1 �?| v1.1.0 |
| Phase 2 - P1 高优先级 | 5 �?| 2 �?| v1.2.0 |
| Phase 3 - P2 中优先级 | 4 �?| 1 个月 | v1.3.0 |
| Phase 4 - P3 低优先级 | 3 �?| 后续迭代 | v1.4.0 |
| **合计** | **16 �?* | **�?6 �?* | �?|

---

## Phase 1 �?P0 紧急修订（本周完成�?
### 任务 1.1：补�?`src/` 目录映射
- **目标**: 将文件归位规则表�?AGENTS.md §一完全对齐
- **修改位置**: `../how-to/file-management-guide.md` �?10-20 �?- **验收标准**:
  - [ ] `src/` 说明列包含完整子目录：`config/`、`core/`、`data/`、`lib/`、`services/`、`store/`、`pages/`、`components/`、`portal/`、`constants/`、`types/`、`apps/`、`cockpit/`
  - [ ] 每个子目录添加一句话说明其职�?  - [ ] �?AGENTS.md §一的目录名 100% 一�?  - [ ] `npx tsc --noEmit` 通过
- **阻塞风险**: �?- **负责�?*: AI 辅助 + 开发者确�?
### 任务 1.2：区�?`src/agents/` �?`.agents/skills/`
- **目标**: 消除两套 agents 目录的歧�?- **修改位置**: `../how-to/file-management-guide.md` �?1 节文件归位规则表
- **验收标准**:
  - [ ] 新增 `src/agents/` 行：说明�?AI 行为扩展（运行时模块，core 层扩展）"
  - [ ] 修正 `.agents/skills/` 行说明：明确�?AI 辅助技能定义文�?
  - [ ] �?AGENTS.md §一的依赖方向规则一�?- **阻塞风险**: 需确认 `src/agents/` 的实际存在�?- **负责�?*: AI 辅助 + 开发者确�?
### 任务 1.3：新�?命名规范"章节
- **目标**: �?AGENTS.md §四的命名约定纳入文件管理规范
- **修改位置**: `../how-to/file-management-guide.md` 新增�?2 节（或插入在现有�?1-2 节之间）
- **验收标准**:
  - [ ] 新增"命名规范"章节，包含以下表格：
    | 对象 | 命名约定 | 示例 |
    |------|---------|------|
    | 文件�?| kebab-case �?PascalCase | `data-bridge.ts` / `DataBridge.ts` |
    | 组件 | PascalCase | `CockpitShell.tsx` |
    | Store | camelCase + `Store` 后缀 | `analysisStore.ts` |
    | 常量 | UPPER_SNAKE_CASE | `ROUTE_REGISTRY` |
    | 类型 | PascalCase + Interface | `interface StockData` |
    | UI 组件 import 路径 | 大小写一�?| `Card` 而非 `card` |
  - [ ] 章节末尾引用 AGENTS.md §�?  - [ ] 不引入新的命名规则，仅复�?AGENTS.md 已有规则
- **阻塞风险**: �?- **负责�?*: AI 辅助

### 任务 1.4：纳入文档体系索�?- **目标**: �?file-management-guide.md 可通过文档导航被发�?- **修改位置**: `../reference/README.md`
- **验收标准**:
  - [ ] �?README.md �?专项文档"或新�?运维规范"分类中添�?`../how-to/file-management-guide.md`
  - [ ] 添加一句话描述�?文件管理规范：源代码归位�?gitignore 维护、提交前检�?
  - [ ] 检�?docs/00-meta/registry-index.md 是否也需更新
- **阻塞风险**: �?- **负责�?*: AI 辅助 + 开发者确�?
---

## Phase 2 �?P1 高优先级（两周完成）

### 任务 2.1：同�?.gitignore 文档
- **目标**: 消除文档与实�?`.gitignore` 的脱�?- **修改位置**: `../how-to/file-management-guide.md` �?2.2 �?- **验收标准**:
  - [ ] 读取根目�?`.gitignore` 文件，逐行分析
  - [ ] 将未在文档中记录的规则按以下新增类别补充�?    - OS 系统文件：`.DS_Store`、`Thumbs.db`
    - Python 环境：`.venv/`、`venv/`、`__pycache__/`、`.pyc`
    - Vite 构建产物：`dist-ssr`、`.vite/`、`*tsbuildinfo`
    - Playwright 截图：`screenshots/`
    - 测试产物：`/test-results/`、`/playwright/.cache/`
    - 生成产物：`*.report.md`、`*audit.md`
  - [ ] 统一文档�?`.gitignore` 的格式（尾部斜杠一致化�?  - [ ] 补充 `.eslintcache` 规则（同时修�?`.gitignore`�?- **阻塞风险**: 需开发者确认新增类别的优先�?- **负责�?*: AI 辅助 + 开发者确�?
### 任务 2.2：新�?`docs/` 子目录分层规�?- **目标**: 明确 docs/ �?8 个编号子目录的用途和存放规则
- **修改位置**: `../how-to/file-management-guide.md` �?1 节文件归位规则表
- **验收标准**:
  - [ ] 新增表格（或扩展现有"文档规范"行）�?    | 子目�?| 用�?| 存放内容 |
    |--------|------|---------|
    | `docs/00-meta/` | 元数据与运维 | 文档索引、审计报告、任务清�?|
    | `docs/01-requirements/` | 需求与规范 | 需求文档、管理规范、质量标�?|
    | `docs/02-design/` | 设计文档 | 架构设计、数据流、策略文�?|
    | `docs/03-development/` | 开发指�?| 编码规范、迁移检查清单、开发手�?|
    | `docs/04-testing/` | 测试文档 | 测试计划、测试报告、修复方�?|
    | `docs/05-deployment/` | 部署文档 | 部署手册、运�?runbook |
    | `docs/06-project-management/` | 项目管理 | 版本计划、进度报�?|
    | `docs/07-archive/` | 归档 | 历史文档、废弃方�?|
  - [ ] 说明编号体系�?0-07 的顺序不可随意变更）
  - [ ] 说明新增子目录需经审批（编号不可冲突�?- **阻塞风险**: 需确认实际子目录列�?- **负责�?*: AI 辅助 + 开发者确�?
### 任务 2.3：新�?数据层文件变�?SOP"
- **目标**: �?AGENTS.md §八的数据库版本管理规则转化为文件管理 SOP
- **修改位置**: `../how-to/file-management-guide.md` 新增章节
- **验收标准**:
  - [ ] 新增"数据层文件变�?SOP"章节，规�?schema 变更时必须同步修改的文件清单�?    - `src/config/dbConfig.ts` �?递增 `DB_VERSION`
    - `src/data/db-schema.ts` �?基线 store 创建逻辑
    - `src/data/db-migrations.ts`（或 `src/data/migrations/`）→ 增量 store 创建逻辑
    - `src/core/acl.ts` �?新增 store �?read/write 白名�?    - `src/core/DataBridge.ts` �?新增 `ENVELOPE_ACTION` �?case
  - [ ] 明确"基线 store"�?增量 store"的选择规则（v1.3.5 规则�?  - [ ] 引用 AGENTS.md §�?- **阻塞风险**: 需确认 `ACL.ts` 的准确路�?- **负责�?*: AI 辅助 + 开发者确�?
### 任务 2.4：建立跨文档引用链路
- **目标**: 打破信息孤岛，使 file-management-guide.md 与其他文档形成引用网�?- **修改位置**: `../how-to/file-management-guide.md` 全文 + 其他文档
- **验收标准**:
  - [ ] 在文件归位规则表后添加引用：`详细分层规则参见 [AGENTS.md](../../AGENTS.md) 第一节`
  - [ ] 在命名规范章节引用：`详细命名约定参见 [AGENTS.md](../../AGENTS.md) 第四节`
  - [ ] �?docs/ 分层规范引用各子目录下的 README（如存在�?  - [ ] 在变更日志或附录添加引用：`更详细的文件管理审查报告参见 [trae-file-management-review.md](../00-meta/trae-file-management-review.md)`
  - [ ] �?AGENTS.md �?迁移收尾：全文件类型扫描"段引�?file-management-guide.md
- **阻塞风险**: 需确认相对路径的正确�?- **负责�?*: AI 辅助

### 任务 2.5：清理文件流�?- **目标**: 消除实际仓库中的文件归位违规
- **修改位置**: 仓库文件系统
- **验收标准**:
  - [ ] 核查 `toolkit/safeCoerce.ts` �?`src/lib/safeCoerce.ts` 的关系，删除重复或统一合并�?`src/lib/`
  - [ ] 核查 `src/core/databridge.ts` 的内容，若属�?core 层则迁移�?`src/core/databridge/`
  - [ ] 核查 `src/lib/` 的内容，合并�?`src/lib/utils/` 或明确职责边�?  - [ ] 核查 `outputs/` 目录，制定管理策略（纳入 `temp/` 或补�?.gitignore�?  - [ ] 运行 `npm run audit:layers` 确认无新增跨层违�?- **阻塞风险**: 文件移动可能破坏 import 路径，需谨慎
- **负责�?*: 开发者主导，AI 辅助

---

## Phase 3 �?P2 中优先级（一个月内完成）

### 任务 3.1：补�?monorepo/多语言目录规范
- **目标**: 覆盖 `packages/`、`python/`、`plugins/` 等特殊目�?- **修改位置**: `../how-to/file-management-guide.md` 新增"根目录特殊目�?章节
- **验收标准**:
  - [ ] 新增表格�?    | 目录 | 用�?| 管理规则 |
    |------|------|---------|
    | `packages/` | monorepo 子项�?| 各子项目独立 package.json，遵循父项目规范 |
    | `python/` | Python 服务 | �?Python 项目规范组织，入口文件明�?|
    | `plugins/` | 数据源插�?| 每个插件独立目录，含 README 和配置说�?|
  - [ ] 说明这些目录�?`src/` 的关系（非源代码，但受项目规范约束）
- **阻塞风险**: �?- **负责�?*: AI 辅助 + 开发者确�?
### 任务 3.2：新�?AI 产物管理规范
- **目标**: 规范 `docs/drafts/` 目录的使�?- **修改位置**: `../how-to/file-management-guide.md` �?1 �?- **验收标准**:
  - [ ] 新增 `docs/drafts/` 行：说明用途为"AI 生成中间产物（草稿、建议、临时报告）"
  - [ ] 规定命名规则：`<描述>-<ISO时间�?.<ext>`（如 `../archive/api-report.md`�?  - [ ] 规定保留策略�?定期归档�?`docs/07-archive/drafts/` 或删除，保留期限不超�?30 �?
  - [ ] 规定 `.gitignore` 策略：drafts/ 是否纳入版本控制
- **阻塞风险**: �?- **负责�?*: AI 辅助 + 开发者确�?
### 任务 3.3：补�?`temp/` 清理策略
- **目标**: 明确临时目录的生命周期管�?- **修改位置**: `../how-to/file-management-guide.md` �?1 节或新增"生命周期管理"章节
- **验收标准**:
  - [ ] 明确清理策略�?每次 `npm run build` 前自动清�?`temp/`"
  - [ ] 或明确保留期限："`temp/` 下文件保留不超过 7 天，�?CI 自动清理"
  - [ ] 明确禁止�?禁止�?`temp/` 用于长期存储"
- **阻塞风险**: 需确认实际清理机制
- **负责�?*: AI 辅助 + 开发者确�?
### 任务 3.4：完善验证命令清�?- **目标**: 使提交前检查与 AGENTS.md §七完全一�?- **修改位置**: `../how-to/file-management-guide.md` �?3 �?- **验收标准**:
  - [ ] 在现�?3 项基础上补充：
    - `npm run audit:hardcode` �?扫描颜色硬编码违�?    - `npm run audit:deadcode` �?扫描未注册页�?    - `npm run audit:docs` �?检查文档同步状�?    - `npm run audit:token` �?Token 消耗检�?  - [ ] 注明�?以上为最小检查集，完整检查请运行 `npm run audit`"
  - [ ] �?AGENTS.md §七的命令列表 100% 一�?- **阻塞风险**: �?- **负责�?*: AI 辅助

---

## Phase 4 �?P3 低优先级（后续迭代）

### 任务 4.1：统一版本号声�?- **目标**: 消除文档版本号体系的不一�?- **修改位置**: `../how-to/file-management-guide.md` 头部 + 变更日志
- **验收标准**:
  - [ ] 在头部注明：`本文档遵�?docs/01-requirements/README.md 的文档体系版�?v2.5.0，自身修订版本为 v1.x.x`
  - [ ] 或：统一采用"项目级版�?+ 文档修订�?双版本号体系
  - [ ] �?`../reference/README.md` 的版本声明对�?- **阻塞风险**: 需项目级决�?- **负责�?*: 开发者决�?
### 任务 4.2：补�?`.eslintcache` 忽略
- **目标**: 防止 ESLint 缓存文件被误提交
- **修改位置**: `.gitignore` + `../how-to/file-management-guide.md` �?2.2 �?- **验收标准**:
  - [ ] �?`.gitignore` 新增 `.eslintcache`
  - [ ] 在文档第 2.2 节新�?ESLint 缓存"类别
- **阻塞风险**: �?- **负责�?*: AI 辅助

### 任务 4.3：增加禁止事项例外条�?- **目标**: 明确根目录禁止规则的边界
- **修改位置**: `../how-to/file-management-guide.md` �?2 �?禁止事项"
- **验收标准**:
  - [ ] 在禁止事项后添加例外条款�?**例外**：标准项目配置文件（`package.json`、`tsconfig.*.json`、`*.config.ts` 等）及项目根级文档（`../../README.md`、`../../AGENTS.md` 等）不受此限�?
- **阻塞风险**: �?- **负责�?*: AI 辅助

---

## 防漂移检查清单（每阶段完成后执行�?
每个 Phase 完成后，必须执行以下验证，确认无任务漂移�?
```powershell
# 1. 类型检查（0 errors�?npx tsc --noEmit

# 2. 架构分层审计�? violations�?npm run audit:layers

# 3. 文档同步检�?npm run audit:docs

# 4. 硬编码检�?npm run audit:hardcode

# 5. 死代码检�?npm run audit:deadcode
```

> **任务漂移判定**：若以上任一检查出现新增违规（与修订前相比），视为任务漂移，需回滚并重新评估�?
---

## 变更日志模板（每次修订后更新�?
```markdown
## 变更日志

| 版本 | 日期 | 变更摘要 |
|------|------|----------|
| v1.0.0 | 2026-07-02 | 初始版本：文件归位�?gitignore 维护、提交前检查、定期审�?|
| v1.1.0 | 2026-07-XX | Phase 1：补�?src/ 目录映射、区�?agents 目录、新增命名规范、纳入文档索�?|
| v1.2.0 | 2026-08-XX | Phase 2：同�?.gitignore、新�?docs/ 分层、新增数据层 SOP、建立引用链路、清理文件流�?|
| v1.3.0 | 2026-08-XX | Phase 3：补�?monorepo 规范、AI 产物管理、temp/ 清理策略、完善验证命�?|
| v1.4.0 | 2026-09-XX | Phase 4：统一版本号、补�?.eslintcache、增加禁止例�?|
```
