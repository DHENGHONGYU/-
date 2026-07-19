---
title: governance
type: meta
domain: project
phase: planning
tier: important
status: active
maintainer: V9 Architecture Team
summary: "## 一、治理原�? ### 1.1 单一真相源（Single Source of Truth�? ### 1.2 双向一致性（Bidirectional..."
tags: [project, governance, management, documentation]
version: v1.0.0
last_updated: 2026-07-17
code_version: 2.0.0
doc_id: V9-DOC-PROJ-016
change_log:
  - version: v1.0.0
changes: Initial version established
date: 2026-07-17
---

# V9 文档治理宪法（GOVERNANCE�?
> **Version**: v1.0.0 | **日期**: 2026-07-12
> **适用范围**: `docs/` 目录下所有文档及自动产物
> **强制等级**: 所有文档维护者必须遵�?
---

## 一、治理原�?
### 1.1 单一真相源（Single Source of Truth�?
- `docs/README.md` 是文档体系的**唯一顶层入口**，任何新成员�?AI Agent 应从这里 1 步定位核心文档�?- 禁止�?`docs/` 根目录下散落独立文档；所有新增文档必须落�?A–H 对应子类目录�?- 同一主题**禁止**出现多份独立文档；如有重复，必须合并或归档到 `docs/07-archive/`�?
### 1.2 双向一致性（Bidirectional Consistency�?
- **代码变更 �?文档同步**：代码变更后，必须同步更新相关文档（�?`../../AGENTS.md`、数据字典、API 契约）�?- **文档变更 �?代码验证**：文档变更后，必须运�?`npm run audit:docs` 验证代码-文档一致性�?- 双向一致性评分目标：�?90/100（当�?82/100）�?
### 1.3 保鲜度（Freshness�?
- 文档必须标注 `version` + `last updated` 头部信息�?- 超过 30 天未更新的文档自动触�?`audit:docs` 告警�?- 超过 90 天未更新的文档标记为 `STALE`，需重新验证或归档�?
---

## 二、文档归类（A–H 八类�?
| �?| 名称 | 目录 | 文档示例 | 准入规则 |
|----|------|------|---------|---------|
| **A** | 导航与治�?| `docs/00-meta/`, `docs/01-requirements/`, `docs/03-development/plugins/` | README、GOVERNANCE、体检报告、愿景目标、插件文�?| 全局规则，禁止业务细�?|
| **B** | 架构设计 | `docs/02-design/architecture/`, `docs/05-deployment/` | overview、cabins-overview、services-catalog、安全模型、RELEASE_NOTES | 架构决策、模块关系、接口定�?|
| **C** | 功能模块 | `docs/02-design/cabins/`, `docs/02-design/components/`, `docs/02-design/cockpit/`, `docs/02-design/store/`, `docs/02-design/services/`, `docs/02-design/data-layer/` | 舱室 spec、组件体系、Widget、Store、服务契约、数据字�?| 功能规格、业务流程、UI 映射 |
| **D** | 技术规�?| `docs/02-design/standards/`, `docs/03-development/` | AGENTS.md、编码规范、设计令牌、质量门禁、JSDoc 规范、迁移规�?| 分层规则、令牌规范、门禁标�?|
| **E** | 测试策略 | `docs/04-testing/` | 测试策略、测试用例、覆盖率报告、门�?| 测试分层、覆盖率、清理义�?|
| **F** | AI 辅助工程治理 | `docs/03-development/ai/`, `docs/02-design/ai/`, `docs/03-development/checklists/` | 提示词模板、记忆层、AI 工程入口、检查表 | AI 约束、提示词工程、飞轮流�?|
| **G** | 过程与质量产�?| `docs/reports/`, `docs/06-project-management/changelogs/` | 审计报告、变更日志、复盘报告、草稿、发布管�?| 自动产物、变更日志、质量报�?|
| **H** | 跨域补充 | `docs/03-development/guides/`, `docs/05-deployment/ops/` | 入门指南、How-to、安全模型、部署架构、Runbook、无障碍 | 操作指南、How-to、Runbook |

### 2.1 禁止散落规则

- �?禁止�?`docs/` 根目录新建独�?`.md` 文件（`../../README.md` �?`governance.md` 除外）�?- �?禁止�?`docs/` 根目录新�?`.txt`、`.json` 等产物文件�?- �?自动产物必须写入 `docs/reports/` �?`docs/07-archive/`�?- �?临时草稿必须放入 `docs/drafts/`，并在定稿后迁移到对应类目或删除�?
---

## 三、新增文�?SOP

### 3.1 新增文档四步�?
```
1. 确定类目 �?�?A–H 表中选择对应�?2. 选择目录 �?落入该类对应的子目录
3. 编写内容 �?遵循本节格式规范
4. 回链索引 �?更新 docs/README.md 对应类目
```

### 3.2 文档头部规范

所有文档必须包含以下头部信息：

```markdown
# 文档标题

> **Version**: v1.0.0 | **日期**: 2026-07-12
> **适用范围**: 具体适用范围
> **强制等级**: 必须遵守 / 推荐参�?
---
```

### 3.3 文件命名规范

| 类型 | 命名规则 | 示例 |
|------|---------|------|
| 规范文档 | `../reference/jsdoc-convention.md` | `../reference/coding-conventions.md` |
| 数据字典 | `*-data-definition.md` | `../reference/news-data-definition.md` |
| 索引文件 | `*-index.md` | `../reference/data-dictionary-index.md` |
| 报告文件 | `YYYY-MM-DD-*.md` | `../archive/2026-07-12-security-audit.md` |
| 归档文件 | `DEPRECATED_*.md` | `../explanation/design/deprecated-batch1-merge-report.md` |

### 3.4 版本号规�?
采用 `MAJOR.MINOR.PATCH`�?- **MAJOR**：架构范式或目录结构不兼容变更（�?A–H 类目调整）�?- **MINOR**：新增文档、扩展章节、新�?artifact 类型�?- **PATCH**：修正错误、更新行号引用、刷新时间戳�?
---

## 四、自动产物治理（G 类）

### 4.1 产物分类

| 产物类型 | 生成方式 | 保留�?| 存储位置 | 是否纳入版本控制 |
|---------|---------|--------|---------|----------------|
| **审计报告** | `npm run audit:*` | 30 �?| `docs/reports/audit/` | �?|
| **覆盖率报�?* | `npm run test:ci` | 14 �?| `coverage/` | �?(�?.gitignore) |
| **视觉回归基线** | `npm run test:e2e:visual` | 永久 | `e2e/*-snapshots/` | �?|
| **变更日志** | 手动维护 | 永久 | `../../CHANGELOG.md` (�? | �?|
| **Code Graph** | `npm run build:ai-memory` | 7 �?| `docs/reports/code-graph/` | �?|
| **系统巡检报告** | CI `system-check-loop.yml` | 7 �?| `docs/reports/system-check/` | �?|
| **依赖分析报告** | `npm run audit:dependencies` | 30 �?| `docs/reports/dependency-analysis.*` | �?|
| **API 提取报告** | `npm run api:extract` | 7 �?| `../archive/api-report.md` | �?|
| **预审查报�?* | `npm run pre-review` | 7 �?| `docs/reports/pre-review/` | �?|

### 4.2 保留期规�?
```
永久保留: CHANGELOG.md, 视觉回归基线, ADR, 架构决策
30 �? 审计报告 (audit-*), 依赖分析, 构建产物分析
14 �? 覆盖率报�? E2E 测试产物
7  �? 系统巡检报告, Code Graph, API 提取, 预审�?```

> **清理机制**：由 `./cleanup-schedule.md` 定义自动化清理脚本，定期扫描并删除过期产物�?
### 4.3 根级产物迁移计划

以下根级产物文件应逐步迁移�?`docs/reports/` 对应子目录：

| 当前位置 | 目标位置 | 优先�?|
|---------|---------|--------|
| �?`audit-*-result.txt` | `docs/reports/audit/` | P1 |
| �?`coverage/` | `coverage/`（已 .gitignore�?| �?|
| �?`../../CHANGELOG.md` | 保持根级（永久保留） | �?|

---

## 五、文档保鲜度检�?
### 5.1 自动化检�?
```powershell
# 检查文档保鲜度（超�?30 天未更新的文档）
npm run doc:freshness

# 自动修复（更新时间戳并标记）
npm run doc:freshness:auto

# 生成告警报告
npm run doc:freshness-alert
```

### 5.2 检查规�?
| 指标 | 阈�?| 动作 |
|------|------|------|
| 超过 30 天未更新 | 黄色警告 | CI 输出警告日志 |
| 超过 90 天未更新 | 红色标记 STALE | 必须人工验证或归�?|
| 代码-文档双向不一�?| 任何差异 | `audit:docs` 失败 |

---

## 六、归档与清理

### 6.1 归档目录

- `docs/07-archive/`：所�?DEPRECATED 文档统一归此�?- 归档文档必须重命名为 `../archive/DEPRECATED_原文件名.md`�?- 归档文档必须包含归档原因、替代文档、归档日期�?
### 6.2 归档模板

```markdown
# DEPRECATED_原文件名

> **归档日期**: 2026-07-12
> **归档原因**: 内容已合并到 `../explanation/overview.md`
> **替代文档**: `../explanation/overview.md`
> **状�?*: 仅保留历史参考，不再维护

---

[原内容保�?..]
```

---

## 七、相关文档索�?
| 文档 | 路径 | 内容 |
|------|------|------|
| 文档主控索引 | `docs/README.md` | A–H 八类导航、快速入�?|
| 清理周期�?| `./cleanup-schedule.md` | 自动产物保留期与清理脚本 |
| 文档体系体检 | `docs/00-meta/文档体系体检报告-v9.md` | 文档体系健康度评�?|
| 变更日志 | `../../CHANGELOG.md` | 版本变更、质量指�?|
| 代码审查标准 | `../reference/code-review.md` | PR 审查清单 |
| 技术债管�?| `../explanation/design/tech-debt.md` | 技术债登记与清理计划 |
