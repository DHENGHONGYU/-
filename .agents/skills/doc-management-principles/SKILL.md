---
skill_id: V9-SKILL-DOC-PRINCIPLES
name: "doc-management-principles"
description: "文档录入与管理整体原则：十目录架构（specs/guides/reference/explanation/reports/archive/assets/meta/audit/lessons）+ Frontmatter 标准（12 必备字段）+ 命名规范 + 开发全生命周期质量链 + 三环闭环治理（audit→lessons→meta）+ 文档操作安全规则。适用于所有开发平台的统一文档标准。Invoke when 创建/编辑/移动/组织 docs/ 下任何文档、判断文档落位目录、或编写 frontmatter 时。"
version: v1.0.0
last_updated: 2026-08-23
change_log:
  - version: v1.0.0
    changes: "基于 S 级 Skill 5 段式骨架模板 [_SKILL-TEMPLATE.md](.agents/skills/_SKILL-TEMPLATE.md) 物理化迁移：自用户级 ~/.trae-cn/skills/doc-management-principles 归位项目单一物理源"
    date: 2026-08-23
mandatory: false
---

# V9 文档录入与管理原则 — v1.0.0

> 将文档体系的治理原则、编写规范、安全规则提炼为可执行技能，确保任何平台（TRAE/Qoder/WorkBuddy/VSCode）下的文档操作都遵循统一标准。
> 权威文档：`docs/meta/DOCUMENT-STRATEGY.md` | `docs/meta/GOVERNANCE.md`

---

## 一、触发条件

- 创建 / 编辑 / 移动 / 组织 `docs/` 下任何文档
- 判断文档应落入哪个目录、编写 frontmatter、命名文件
- **文件信号**：`docs/**`

**协作**：交叉索引建立 → `cross-index-governance`；编码问题 → `doc-encoding-remediation`；重梳后残留扫描 → `stale-path-reference-audit`。

---

## 二、前置检查：十目录架构（所有文档必须落入其一）

| 目录 | 用途 | 决策问句 |
|---|---|---|
| `specs/` | 产品需求、设计规格、架构决策 | 定义"做什么" |
| `guides/` | 操作指南、教程、编码规范 | 指导"怎么做" |
| `reference/` | API 契约、数据定义、蓝图 | 提供"参考信息" |
| `explanation/` | 架构解释、ADR、术语表 | 解释"为什么" |
| `reports/` | 测试/策略/项目管理报告 + `changelogs/` | 记录"做了什么" |
| `audit/` | 审计检查校对体系（policies/guides/checklists/reports） | 审计/检查/校对 |
| `lessons/` | 开发总结教训（architecture/code-quality/data-management/process/retrospectives） | 经验教训/复盘 |
| `meta/` | 文档治理、注册表、风格指南 | 治理/元数据 |
| `assets/` | 图片、HTML 报告、静态资源 | 资源 |
| `archive/` | 废弃文档、历史记录 | 废弃/历史 |

**禁止规则**：① 禁止 `docs/` 根目录新建独立 .md（`README_root.md`、`_redirect-map.json` 除外）② 禁止同一内容多处副本（单一权威）③ 禁止自动产物散落非 `reports/` 目录。

---

## 三、阶段化 SOP

### 1. Frontmatter 标准（所有 .md 必备）

```yaml
---
title: 文档标题
type: reference | guide | explanation | how-to | report | meta
domain: project | product | technical | architecture | frontend | backend | data | ai | qa
phase: planning | design | development | testing | deployment | maintenance | archive
status: active | draft | deprecated | archived   # 必须与目录位置一致
maintainer: 维护者名称
summary: "一句话摘要（50字以内）"
tags: [标签1, 标签2]
version: v1.0.0              # SemVer
last_updated: YYYY-MM-DD
code_version: 2.0.0
doc_id: V9-DOC-{DOMAIN}-{NNN}  # 全局唯一
related_docs: [相关文档ID]
change_log:
  - version: v1.0.0
    changes: 变更描述
    date: YYYY-MM-DD
tier: T0 | T1 | T2            # 核心/重要/一般
---
```

层级审查频率：T0 每季度（100% 交叉索引）/ T1 每半年 / T2 每年。

### 2. 命名规范

- 规范/指南 `kebab-case.md`；数据字典 `*-data-definition.md`；索引 `*-index.md` / `*-registry.md`；审计报告 `{topic}-{date}_audit.md`；教训 `{topic}-lessons.md`；清单 `{phase}-checklist.md`；复盘 `{date}-{topic}.md`；变更日志 `YYYY-MM-DD-<topic>.md`；ADR `adr-NNN-*.md`；归档 `DEPRECATED_*.md` 或入 `archive/`
- **禁止**：中文文件名、空格（用 `-`）、`_v2` 后缀（用 frontmatter version 管理）、日期后缀副本

### 3. 全生命周期质量链

编写前契约（audit/checklists）→ 编码规范（guides/）→ 编写后校对（audit/ + `audit:docs`）→ 回归测试（reports/）→ 上线检查（audit/）→ 教训提炼（lessons/）→ 契约更新（meta/）回环。
防治"代码先行文档滞后"四层：预防（pre-coding-checklist）/ 检测（post-coding-checklist + `audit:docs`）/ 纠正（quality-gates 拦截合并）/ 反哺（`lessons/process/` 记录）。

### 4. 三环闭环治理（audit ↔ lessons ↔ meta）

- audit → lessons：每份审计报告末尾含 `## 相关教训` 链接
- lessons → audit：每份教训文档开头含 `## 相关审计` 链接
- lessons → meta：高频教训提炼为策略更新（DOCUMENT-STRATEGY.md）
- meta → audit：策略变更同步 `audit/policies/`

### 5. 交叉引用与生命周期

- 双向引用（audit↔lessons）、相对路径（禁绝对路径）、锚定权威（不指副本）、失效即修、每级目录有 README 入口
- 六阶段生命周期：创建→审查→发布→维护→归档→删除；归档必须标记原因 + 替代文档 + `status: archived`

### 6. 文档操作安全规则（T0 级强制）

七阶段安全过程：备份基线 → 影响分析 → DryRun → 执行 → 链接重写 → 验证 → 合并审查。
批次 ≤50 文件；备份至 `archive/migration-backup-{date}/`；先写后删；UTF-8 禁 BOM；迁移后更新 `_redirect-map.json`。

### 健康度指标

| 指标 | 目标 | 度量 |
|------|------|------|
| 链接健康度 | 100%（0 断链） | `audit:doc-integrity` |
| 代码交叉引用 | ≥95% | `audit:docs` |
| Frontmatter 完整率 | 100% | `audit:jsdoc` |
| 审计-教训闭环率 | ≥80% | 人工审查 |
| 教训-契约反哺率 | ≥50% | 人工审查 |

---

## 四、陷阱与经验教训

| # | 陷阱 | 后果 | 规避 |
|---|------|-----|-----|
| 1 | 文档放错目录 / status 与位置不一致 | 治理脚本误判 | 按决策树落位，archived 必须在 archive/ |
| 2 | 内容多处副本 | 权威漂移 | 单一权威 + 锚定引用 |
| 3 | 中文文件名 / 空格 / `_v2` 后缀 | 工具链乱码与版本混乱 | kebab-case + frontmatter version |
| 4 | 直删后写（迁移） | 文件丢失 | 先写后删 + 备份 + DryRun |
| 5 | 文档滞后于代码不检查 | 契约失真 | post-coding-checklist + `audit:docs` 拦截 |

---

## 五、完成交付物清单

| # | 交付物 | 验证方法 |
|---|--------|---------|
| 1 | 文档落入正确目录 + frontmatter 完整 | 十目录决策树 + 字段齐全 |
| 2 | 命名合规 | kebab-case、无中文/空格 |
| 3 | 同步更新 `README_root.md` 与 `doc-id-registry.md` | 新文档已登记 |
| 4 | 门禁通过 | `audit:docs` / `audit:doc-integrity` 退出码 0 |
| 5 | 迁移时 `_redirect-map.json` 已更新 | 重定向表含旧→新映射 |
