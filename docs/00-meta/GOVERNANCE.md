---
title: V9 文档治理宪法（GOVERNANCE）
type: meta
domain: project
phase: planning
tier: important
status: active
maintainer: V9 Architecture Team
summary: "V9 文档治理宪法：基于 Diátaxis + 数字前缀的实际分类体系，定义单一真相源、双向一致性、保鲜度、归档清理四大治理原则"
tags: [project, governance, documentation, meta, diataxis]
version: v2.0.0
last_updated: 2026-07-19
code_version: 2.0.0
doc_id: V9-DOC-PROJ-016
referenced_by: [V9-DOC-PROJ-032, V9-DOC-META-000, V9-DOC-PROJ-CROSSINDEX-001, V9-DOC-PROJ-217, V9-DOC-PROJ-175, V9-DOC-PROJ-218]
change_log:
  - version: v2.0.0
    changes: "重写分类体系：A-H 八类 → Diátaxis + 数字前缀（对齐实测数据 806 文档）"
    date: 2026-07-19
  - version: v1.0.0
    changes: "Initial version established（A-H 八类）"
    date: 2026-07-12
---

# V9 文档治理宪法（GOVERNANCE）

> **Version**: v2.0.0 | **日期**: 2026-07-19
> **适用范围**: `docs/` 目录下所有文档及自动产物
> **强制等级**: 所有文档维护者必须遵守
> **变更说明**: v2.0.0 将 A-H 八类分类体系改为实际使用的 Diátaxis + 数字前缀体系，对齐 2026-07-19 实测 806 文档现状

---

## 一、治理原则

### 1.1 单一真相源（Single Source of Truth）

- `docs/README.md` 是文档体系的**唯一顶层入口**，任何新成员或 AI Agent 应从这里 1 步定位核心文档
- 禁止在 `docs/` 根目录下散落独立文档；所有新增文档必须落入对应分类子目录
- 同一主题**禁止**出现多份独立文档；如有重复，必须合并或归档到 `docs/archive/`
- `docs/00-meta/master-index.json`（待建）是文档元数据的**唯一机械真相源**，所有派生索引必须从其生成

### 1.2 双向一致性（Bidirectional Consistency）

- **代码变更 ↔ 文档同步**：代码变更后，必须同步更新相关文档（如 `AGENTS.md`、数据字典、API 契约）
- **文档变更 ↔ 代码验证**：文档变更后，必须运行 `npm run audit:docs` 验证代码-文档一致性
- **frontmatter ↔ 目录位置一致**：`status: archived` 的文档必须在 `docs/archive/` 目录下；反之亦然
- 双向一致性评分目标：≥90/100

### 1.3 保鲜度（Freshness）

- 文档必须标注 `version` + `last_updated` 头部信息
- 超过 30 天未更新的文档自动触发 `audit:docs` 告警
- 超过 90 天未更新的文档标记为 `STALE`，需重新验证或归档

---

## 二、文档归类体系（Diátaxis + 数字前缀）

> **v2.0.0 重大变更**：原 A-H 八类分类体系与实际使用脱节，现统一为 Diátaxis + 数字前缀体系。
> **实测数据**（2026-07-19）：806 总文档，676 活跃文档，使用 6 个 type 分类。

### 2.1 六类分类体系（基于 frontmatter `type` 字段）

| type | 数量 | 占比 | 对应目录 | 文档示例 | 准入规则 |
|------|------|------|----------|----------|----------|
| **tutorials** | 2 | 0.3% | `docs/tutorials/` | getting-started.md | 学习导向，循序渐进 |
| **how-to** | 14 | 2% | `docs/how-to/`, `docs/guides/` | how-to-add-widget.md, FILE-MANAGEMENT-GUIDE.md | 任务导向，解决具体问题 |
| **reference** | 244 | 36% | `docs/reference/`, `docs/01-requirements/` | api-contract.md, data-definition.md, ADR | 信息导向，机械参考 |
| **explanation** | 214 | 32% | `docs/explanation/`, `docs/architecture/`, `docs/design/` | overview.md, design-tokens.md | 理解导向，背景阐释 |
| **reports** | 119 | 18% | `docs/reports/`, `docs/06-project-management/` | audit-*.md, CHANGELOG.md | 过程产物，自动或半自动生成 |
| **meta** | 75 | 11% | `docs/00-meta/` | GOVERNANCE.md, doc-id-registry.md, tag-taxonomy.md | 治理文档，元数据规范 |

### 2.2 数字前缀目录约定

| 前缀 | 用途 | 示例目录 |
|------|------|----------|
| `00-` | 元数据与治理 | `docs/00-meta/` |
| `01-` | 需求与产品 | `docs/01-product/`, `docs/01-requirements/` |
| `02-` | 设计与架构 | `docs/02-design/`（已拆分为 architecture/ + design/ + explanation/design/） |
| `03-` | 开发规范 | `docs/03-development/` |
| `04-` | 测试策略 | `docs/04-testing/` |
| `05-` | 部署运维 | `docs/05-deployment/`（已拆分为 ops/） |
| `06-` | 项目管理 | `docs/06-project-management/` |
| `07-` | 归档（已废弃，改用 `archive/`） | `docs/archive/`（无前缀） |

### 2.3 实际一级目录清单（2026-07-19 实测）

```
docs/
├── 00-meta/                  # 治理与元数据（type: meta）
├── 01-product/               # 产品需求（type: reference/explanation）
├── 01-requirements/          # 需求规格（type: reference）
├── 03-development/           # 开发规范（type: reference）
├── 04-testing/               # 测试策略（type: reference/reports）
├── 06-project-management/    # 项目管理（type: reports）
├── ai/                       # AI 集成（type: explanation/reference）
├── architecture/             # 架构设计（type: explanation）
├── archive/                  # 归档目录（status: archived）
├── assets/                   # 静态资源（图片等）
├── design/                   # 设计规范（type: explanation）
├── drafts/                   # 草稿（type: reports）
├── explanation/              # 阐释性文档（type: explanation）
├── guides/                   # 操作指南（type: how-to）
├── how-to/                   # How-to 文档（type: how-to）
├── modules/                  # 模块说明（type: reference）
├── ops/                      # 运维手册（type: reference/how-to）
├── prompts/                  # 提示词模板（type: reference）
├── reference/                # 参考文档（type: reference）
├── standards/                # 标准规范（type: reference）
├── team-handbook/            # 团队手册（type: explanation）
├── tutorials/                # 教程（type: tutorials）
├── README.md                 # 顶层入口
├── _redirect-map.json        # 重定向映射
└── registry-index.md         # 注册索引
```

### 2.4 禁止散落规则

- **禁止**在 `docs/` 根目录新建独立 `.md` 文件（`README.md`、`GOVERNANCE.md` 除外）
- **禁止**在 `docs/` 根目录新建 `.txt`、`.json` 等产物文件（`_redirect-map.json` 除外）
- **自动产物**必须写入 `docs/reports/` 或 `docs/archive/`
- **临时草稿**必须放入 `docs/drafts/`，并在定稿后迁移到对应类目或删除

---

## 三、新增文档 SOP

### 3.1 新增文档四步法

```
1. 确定分类 → 从六类 type 中选择对应（tutorials/how-to/reference/explanation/reports/meta）
2. 选择目录 → 落入该 type 对应的子目录（参考 2.1 表格）
3. 编写 frontmatter → 遵循 document-metadata-standard.md 规范
4. 回链索引 → 更新 docs/README.md 对应分类 + docs/00-meta/doc-id-registry.md
```

### 3.2 frontmatter 头部规范

所有文档必须包含以下 frontmatter 字段（基于 `docs/00-meta/document-metadata-standard.md`）：

```yaml
---
title: <文档标题>
type: <tutorials|how-to|reference|explanation|reports|meta>
domain: <project|architecture|frontend|backend|data|ai|qa|product>
phase: <planning|design|development|testing|deployment>
tier: <quick-note|standard|important|reference|core>
status: <draft|review|active|deprecated|archived>
maintainer: <维护者>
summary: "<一句话摘要>"
tags: [<分类标签>, <模块标签>, <属性标签>]
version: <MAJOR.MINOR.PATCH>
last_updated: <YYYY-MM-DD>
doc_id: V9-DOC-<DOMAIN>-<NNN>
change_log:
  - version: <版本>
    changes: <变更说明>
    date: <日期>
---
```

### 3.3 文件命名规范

| 类型 | 命名规则 | 示例 |
|------|---------|------|
| 规范文档 | `kebab-case.md` | `coding-conventions.md` |
| 数据字典 | `*-data-definition.md` | `news-data-definition.md` |
| 索引文件 | `*-index.md` 或 `*-registry.md` | `doc-id-registry.md` |
| 报告文件 | `YYYY-MM-DD-*.md` | `2026-07-12-security-audit.md` |
| 归档文件 | `DEPRECATED_*.md` 或置于 `archive/` 目录 | `DEPRECATED_old-spec.md` |
| ADR 文档 | `adr-NNN-*.md` | `adr-001-pure-frontend-architecture.md` |

### 3.4 版本号规范

采用 `MAJOR.MINOR.PATCH`：
- **MAJOR**：架构范式或目录结构不兼容变更（如分类体系调整）
- **MINOR**：新增文档、扩展章节、新增 artifact 类型
- **PATCH**：修正错误、更新行号引用、刷新时间戳

---

## 四、自动产物治理（reports 类）

### 4.1 产物分类

| 产物类型 | 生成方式 | 保留期 | 存储位置 | 是否纳入版本控制 |
|---------|---------|--------|---------|----------------|
| **审计报告** | `npm run audit:*` | 30 天 | `docs/reports/audit/` | 是 |
| **覆盖率报告** | `npm run test:ci` | 14 天 | `coverage/` | 否（.gitignore） |
| **视觉回归基线** | `npm run test:e2e:visual` | 永久 | `e2e/*-snapshots/` | 是 |
| **变更日志** | 手动维护 | 永久 | `CHANGELOG.md`（根级） | 是 |
| **Code Graph** | `npm run build:ai-memory` | 7 天 | `docs/reports/code-graph/` | 是 |
| **系统巡检报告** | CI `system-check-loop.yml` | 7 天 | `docs/reports/system-check/` | 是 |
| **依赖分析报告** | `npm run audit:dependencies` | 30 天 | `docs/reports/dependency-analysis.*` | 是 |
| **API 提取报告** | `npm run api:extract` | 7 天 | `docs/reports/api/` | 是 |
| **预审查报告** | `npm run pre-review` | 7 天 | `docs/reports/pre-review/` | 是 |

### 4.2 保留期规则

```
永久保留: CHANGELOG.md, 视觉回归基线, ADR, 架构决策
30 天:   审计报告 (audit-*), 依赖分析, 构建产物分析
14 天:   覆盖率报告, E2E 测试产物
7 天:    系统巡检报告, Code Graph, API 提取, 预审查
```

> **清理机制**：由 `./cleanup-schedule.md` 定义自动化清理脚本，定期扫描并删除过期产物。

---

## 五、文档保鲜度检查

### 5.1 自动化检查

```powershell
# 检查文档保鲜度（超过 30 天未更新的文档）
npm run audit:docs

# 生成告警报告
npm run doc:freshness-alert
```

### 5.2 检查规则

| 指标 | 阈值 | 动作 |
|------|------|------|
| 超过 30 天未更新 | 黄色警告 | CI 输出警告日志 |
| 超过 90 天未更新 | 红色标记 STALE | 必须人工验证或归档 |
| 代码-文档双向不一致 | 任何差异 | `audit:docs` 失败 |
| frontmatter 字段缺失 | 任何核心字段缺失 | doc:gate 失败 |
| status 与目录位置不一致 | 如 archive/ 下 status≠archived | doc:gate 失败 |

---

## 六、归档与清理

### 6.1 归档目录

- `docs/archive/`：所有 DEPRECATED 文档统一归此处
- 归档文档必须将 frontmatter `status` 字段改为 `archived`
- 归档文档必须包含归档原因、替代文档、归档日期

### 6.2 归档模板

```markdown
---
title: <原标题>
type: <原 type>
status: archived
maintainer: <维护者>
summary: "<原摘要>"
tags: [archived]
version: <最后版本>
last_updated: <归档日期>
doc_id: <原 doc_id>
change_log:
  - version: <最后版本>
    changes: "归档：<归档原因>"
    date: <归档日期>
---

# <原标题>

> **归档日期**: <YYYY-MM-DD>
> **归档原因**: <具体原因，如内容已合并到 xxx>
> **替代文档**: <替代文档路径，如无则填"无">
> **状态**: 仅保留历史参考，不再维护

---

[原内容保留...]
```

### 6.3 状态机（五阶段）

```
draft → review → active → deprecated → archived → purged
  ↑        ↑        ↑          ↑            ↑          ↑
  草稿    评审    活跃      废弃         归档       清除
```

- `draft`：新建文档初始状态
- `review`：等待评审
- `active`：已发布，正常维护
- `deprecated`：已废弃，但仍在原目录（过渡期）
- `archived`：已归档，必须迁移到 `docs/archive/`
- `purged`：已从仓库删除（仅保留 git 历史）

---

## 七、相关文档索引

| 文档 | 路径 | 内容 |
|------|------|------|
| 文档主控索引 | `docs/README.md` | 六类导航、快速入门 |
| 交叉索引综合解决方案 | `docs/00-meta/cross-index-comprehensive-solution.md` | 四大交叉索引子系统设计 |
| 文档元数据标准 | `docs/00-meta/document-metadata-standard.md` | frontmatter 字段规范 |
| doc_id 注册表 | `docs/00-meta/doc-id-registry.md` | 所有 doc_id 登记 |
| 标签分类体系 | `docs/00-meta/tag-taxonomy.md` | tags 字段受控词表 |
| 清理周期表 | `docs/00-meta/cleanup-schedule.md` | 自动产物保留期与清理脚本 |
| 文档体系体检 | `docs/00-meta/文档体系体检报告-v9.md` | 文档体系健康度评估 |
| 变更日志 | `CHANGELOG.md`（根级） | 版本变更、质量指标 |
| 代码审查标准 | `docs/how-to/code-review-guide.md` | PR 审查清单 |
| 技术债管理 | `docs/explanation/design/tech-debt.md` | 技术债登记与清理计划 |
| 文件管理指南 | `docs/how-to/FILE-MANAGEMENT-GUIDE.md` | 文件生命周期 SOP |

---

## 八、变更日志

| 版本 | 日期 | 变更摘要 |
|------|------|----------|
| v2.0.0 | 2026-07-19 | 重写分类体系：A-H 八类 → Diátaxis + 数字前缀；新增五阶段状态机；新增 frontmatter 完整规范；对齐 806 文档实测数据 |
| v1.0.0 | 2026-07-12 | 初始版本：A-H 八类分类体系 + 治理原则 + 自动产物治理 |
