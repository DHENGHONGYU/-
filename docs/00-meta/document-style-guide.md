---
title: V9 文档风格指南与命名规�?
type: meta
domain: project
phase: development
tier: standard
status: active
maintainer: V9 Architecture Team
summary: "文档定位：定义项目文档的命名规则、格式标准、结构要求和写作规范 适用范围：所有项目文档（Markdown 格式�?>..."
tags: [project, guide, standards]
version: v1.0.0
last_updated: 2026-07-17
code_version: 2.0.0
change_log:
  - version: v1.0.0
changes: Initial version established
date: 2026-07-17
---meta
domain: project
tier: standard
status: active
maintainer: V9 Architecture Team
tags: [project, guide, standards]
phase: development
version: v1.0.0
last_updated: 2026-07-17
code_version: 2.0.0
---

# V9 文档风格指南与命名规�?
> **文档定位**：定义项目文档的命名规则、格式标准、结构要求和写作规范
> **适用范围**：所有项目文档（Markdown 格式�?> **目标读�?*：全体项目成员、文档贡献�?
---

## 目录

1. [文件命名规范](#一文件命名规范)
2. [目录结构规范](#二目录结构规�?
3. [文档格式标准](#三文档格式标�?
4. [文档结构模板](#四文档结构模�?
5. [写作风格指南](#五写作风格指�?
6. [Frontmatter 规范](#六frontmatter-规范)
7. [版本管理规范](#七版本管理规�?

---

## 一、文件命名规�?
### 1.1 命名总原�?
| 原则 | 说明 | 示例 |
|------|------|------|
| **语义�?* | 文件名能反映文档内容 | `databridge-architecture.md` �?|
| **全小�?* | 统一使用小写字母 | `UserGuide.md` �?�?`user-guide.md` �?|
| **连字符分�?* | 多单词用 `-`（kebab-case�?| `user_guide.md` �?�?`user-guide.md` �?|
| **英文优先** | 文件名使用英文，内容可用中文 | `数据架构.md` �?�?`data-architecture.md` �?|
| **简洁明�?* | 不超�?5 个单词，30 字符以内 | `very-long-file-name-example.md` �?|
| **不使用特殊字�?* | 避免空格、中文、特殊符�?| `my doc (2).md` �?|

### 1.2 各类型文档命名约�?
| 文档类型 | 命名模式 | 示例 |
|----------|----------|------|
| **架构设计** | `<module>-architecture.md` / `<module>-design.md` | `databridge-architecture.md` |
| **ADR 决策** | `adr-<number>-<topic>.md` | `adr-001-pure-frontend.md` |
| **操作指南** | `how-to-<action>.md` / `<topic>-guide.md` | `how-to-add-store.md` |
| **教程** | `<topic>-tutorial.md` / `getting-started.md` | `getting-started.md` |
| **规范标准** | `<domain>-conventions.md` / `<topic>-spec.md` | `coding-conventions.md` |
| **报告** | `<type>-report.md` / `<topic>-audit.md` | `code-quality-audit-report.md` |
| **经验教训** | `lessons-learned-<date>.md` / `<topic>-lessons.md` | `lessons-learned-2026-07.md` |
| **数据定义** | `data-definition.md` / `<module>-types.md` | `news-data-definition.md` |
| **模板** | `<type>-template.md` | `feature-doc-template.md` |
| **README** | 目录入口固定�?`README.md` | `README.md` |

### 1.3 版本号与日期命名

**含日期的文档**�?```
<topic>-<YYYY-MM-DD>.md
lessons-learned-2026-07-12.md
release-notes-2026-07-15.md
```

**含版本号的文�?*�?```
<topic>-v<major>.<minor>.md
architecture-v2.0.md
migration-guide-v1.5.md
```

**避免使用**�?- �?`final.md` / `final-final.md`（用版本号替代）
- �?`new.md` / `old.md`（用日期或版本号�?- �?`test.md` / `temp.md`（删除临时文件）
- �?`copy.md` / `副本.md`（用版本管理�?
---

## 二、目录结构规�?
### 2.1 目录命名

| 规则 | 说明 | 示例 |
|------|------|------|
| 全小�?| 目录名全部小�?| `reference/` �?|
| kebab-case | 多单词用连字�?| `team-handbook/` �?|
| 数字前缀（可选） | 用于排序时用两位数字 | `01-product/` �?|
| 简洁明�?| 不超�?3 个单�?| `very-long-directory-name/` �?|

### 2.2 目录层级

```
docs/                           # 文档根目�?├── <一级目�?/                  # L1：大类别�? 大类型）
�?  ├── <二级目录>/             # L2：子类别�? 个子类）
�?  �?  ├── <三级目录>/         # L3：细分类（可选）
�?  �?  �?  └── *.md           # 具体文档
�?  �?  └── README.md          # 二级目录入口（可选）
�?  └── README.md              # 一级目录入口（必选）
└── README.md                  # 文档总入口（必选）
```

**层级规则**�?- 最�?4 层目录（不含 docs/�?- 每个目录都有 README.md 作为入口（最深层可选）
- 同级目录数量不超�?15 个，过多则考虑拆分

### 2.3 必选目�?
| 目录 | 用�?| 入口 README |
|------|------|-------------|
| `reference/` | 参考类文档 | �?必�?|
| `explanation/` | 解释类文�?| �?必�?|
| `how-to/` | 指南类文�?| �?必�?|
| `tutorials/` | 教程类文�?| �?必�?|
| `reports/` | 报告类文�?| �?必�?|
| `00-meta/` | 元文档类 | �?必�?|

### 2.4 可选目�?
| 目录 | 用�?| 说明 |
|------|------|------|
| `team-handbook/` | 团队手册 | 跨类型综合资�?|
| `archive/` | 归档文档 | 死文�?旧版�?|
| `assets/` | 静态资�?| 图片/附件�?|
| `drafts/` | 草稿 | 未完成文�?|
| `design/` | 设计资源 | UI 设计相关 |

---

## 三、文档格式标�?
### 3.1 Markdown 规范

**标题层级**�?```markdown
# H1 文档标题（唯一，每�?1 个）
## H2 大章�?### H3 子章�?#### H4 小节
##### H5 更细的小节（尽量少用�?```

**列表**�?- 无序列表�?`-`，不�?`*` �?`+`
- 有序列表�?`1.`（自动编号）
- 列表项超�?2 行要缩进对齐

**代码�?*�?```markdown
```typescript
// 必须指定语言
const foo = 'bar';
``` �?```

**表格**�?- 表头与内容对�?- 列数不超�?6 列，过多考虑拆分
- 简单表格优先，复杂数据用列�?
**链接**�?```markdown
<!-- 相对路径引用 -->
[文件名](relative/path/to/file.md)

<!-- 锚点引用 -->
[章节名](file.md#章节锚点)

<!-- 外部链接 -->
[描述](https://example.com)
```

### 3.2 排版规范

| 规则 | 说明 |
|------|------|
| **段落间距** | 段落之间空一�?|
| **行尾空格** | 删除行尾多余空格 |
| **文件末尾** | 文件末尾保留一个空�?|
| **中文排版** | 中英文之间加空格（如 "React 组件"�?|
| **标点** | 中文用中文标点，英文用英文标�?|
| **数字与单�?* | 数字与单位之间加空格（如 "500 KB"�?|

### 3.3 文档长度

| 文档类型 | 推荐长度 | 超过则考虑 |
|----------|----------|-----------|
| 操作指南 | 2-5 �?| 拆分为系列指�?|
| 技术参�?| 5-20 �?| 按主题分章节 |
| 设计文档 | 5-15 �?| 拆分为多�?ADR |
| 报告�?| 5-30 �?| 摘要 + 详细分册 |
| README | 1-3 �?| 导航到详细文�?|

---

## 四、文档结构模�?
### 4.1 标准文档结构

```markdown
---
# Frontmatter
title: 文档标题
doc_id: V9-DOC-T1D1P2-001
type: reference
domain: architecture
phase: design
---

# 文档标题

> 一句话文档定位 / 摘要
> **适用范围**�?..
> **目标读�?*�?..

---

## 目录
<!-- 可选，长文档建议有 -->

---

## 正文章节 1

内容...

## 正文章节 2

内容...

---

## 附录 / 参考链�?
- 相关文档 1
- 相关文档 2

> **维护说明**：本文档�?XXX 维护，如有问题请联系...
```

### 4.2 README 模板

```markdown
---
title: <目录�?
tier: important
code_version: 2.0.0
---

# <目录�?

> **Diátaxis 分类**�?类型>
> **用�?*：一句话说明本目录内�?> **读�?*：目标读�?
---

## 📂 快速入�?
| 文档 | 说明 |
|------|------|
| [文档 1](path/to/doc1.md) | 一句话描述 |
| [文档 2](path/to/doc2.md) | 一句话描述 |

---

## 🔗 相关目录

- [相关目录 1](../other-dir/)
- [相关目录 2](../another-dir/)
```

### 4.3 ADR 模板

```markdown
---
title: ADR-001 <决策标题>
status: Accepted / Proposed / Deprecated
date: YYYY-MM-DD
---

# ADR-001�?决策标题>

## 背景

问题描述...

## 决策

决策内容...

## 备选方�?
- 方案 A�?..
- 方案 B�?..

## 后果

### 正面
- ...

### 负面
- ...

## 相关文档

- ...
```

### 4.4 报告类模�?
```markdown
---
title: <报告标题>
date: YYYY-MM-DD
author: 作�?type: report
---

# <报告标题>

## 概述

背景、目的、范�?..

## 方法

数据来源、分析方�?..

## 发现 / 结果

主要发现、数据展�?..

## 建议 / 结论

改进建议、行动计�?..

## 附录

详细数据、补充说�?..
```

---

## 五、写作风格指�?
### 5.1 写作原则

| 原则 | 说明 | 示例 |
|------|------|------|
| **读者优�?* | 从读者角度思考，假设读者不了解背景 | �?"这个功能很简�? �?�?"本功能用�?.." |
| **简洁明�?* | 一句话说清一件事，避免冗�?| �?"在大多数情况下，通常我们�?.." �?�?"通常..." |
| **结构�?* | 用标�?列表/表格组织内容，不写大段文�?| 多用列表和表�?|
| **可操�?* | 指南类文档要有明确的操作步骤 | �?"你可以配置一�? �?�?"步骤 1：打开配置文件..." |
| **一致�?* | 术语统一，命名统一，风格统一 | 同一概念用同一个词 |
| **客观中�?* | 描述事实，不带情绪和主观判断 | �?"这个设计很烂" �?�?"该设计存在以下问�?.." |

### 5.2 不同类型文档的写作要�?
**参考类（Reference�?*�?- 信息密集，结构清�?- 按字母或逻辑顺序排列
- 完整性优先，简洁其�?- 适合查阅，不适合通读

**解释类（Explanation�?*�?- 讲清�?为什�?
- 有背景、有推理、有结论
- 可以有多种观点的对比
- 适合深度理解

**指南类（How-to�?*�?- 面向目标，步骤清�?- 每步有明确的输入输出
- 有前置条件说�?- 有常见问题和排错

**教程类（Tutorials�?*�?- 从零开始，循序渐进
- 每步有验证点
- 假设读者是新手
- 有完整的示例

**报告类（Reports�?*�?- 数据驱动，结论明�?- 有方法、有证据、有建议
- 结构完整，逻辑清晰
- 可追溯、可验证

### 5.3 技术文�?Do's and Don'ts

�?**Do**�?- 提供代码示例
- 说明前置条件
- 标注版本兼容�?- 给出常见错误和解决方�?- 提供相关文档链接

�?**Don't**�?- 假设读者知道所有背景知�?- 使用模糊的词语（"可能"�?大概"�?- 只有文字没有示例
- 写很长的段落而不分点
- 在文档中夹杂个人情绪

---

## 六、Frontmatter 规范

### 6.1 必填字段

| 字段 | 类型 | 说明 | 示例 |
|------|------|------|------|
| `title` | string | 文档标题 | `DataBridge 架构设计` |
| `doc_id` | string | 文档唯一编号 | `V9-DOC-T2D1P2-001` |
| `type` | string | 文档类型（reference/explanation/how-to/tutorials/reports/meta�?| `explanation` |
| `domain` | string | 功能域（architecture/frontend/backend/data/ai/qa/project/product�?| `architecture` |
| `phase` | string | 开发阶段（planning/requirements/design/development/testing/deployment/retrospective�?| `design` |
| `code_version` | string | 对应代码版本 | `2.0.0` |
| `version` | string | 文档版本 | `v1.0.0` |
| `last_updated` | string | 最后更新日期（YYYY-MM-DD�?| `2026-07-17` |
| `status` | string | 文档状态（active/deprecated/draft/archived�?| `active` |

### 6.2 可选字�?
| 字段 | 类型 | 说明 | 示例 |
|------|------|------|------|
| `tier` | string | 重要级别（important/reference/supporting�?| `important` |
| `maintainer` | string | 维护�?| `Architecture Team` |
| `author` | string | 作�?| `张三` |
| `tags` | array | 自定义标�?| `[databridge, acl, envelope]` |
| `summary` | string | 一句话摘要 | `DataBridge 统一写入网关的架构设计` |
| `change_log` | array | 变更日志 | 见下 |
| `deprecated_by` | string | 被哪个文档替�?| `new-doc.md` |
| `supersedes` | string | 替代了哪个文�?| `old-doc.md` |

### 6.3 完整示例

```yaml
---
title: DataBridge 统一写入网关架构设计
doc_id: V9-DOC-T2D1P2-001
type: explanation
domain: architecture
phase: design
tier: important
code_version: 2.0.0
version: v1.2.0
last_updated: 2026-07-17
maintainer: Architecture Team
author: 张三
---
title: 文档风格指南与命名规�?
# Classification
type: meta
domain: project # TODO: confirm
tier: standard # TODO: confirm
status: active

# Version
version: v1.0.0 # TODO: confirm
last_updated: 2026-07-17
code_version: 2.0.0
doc_system_version: v1.0.0

# People & Tags
maintainer: Documentation Team
# tags: [tag1, tag2]
# summary: One-line summary

---
tags: [databridge, acl, envelope, write-gateway]
summary: 详细阐述 DataBridge 统一写入网关的设计思路、架构选型和实现方�?
change_log:
  - date: 2026-07-17
    version: v1.2.0
    author: 张三
    desc: 新增系统管理方法章节
  - date: 2026-06-21
    version: v1.0.0
    author: 李四
    desc: 初始版本
---
```

---

## 七、版本管理规�?
### 7.1 版本号规�?
采用**语义化版�?*：`v<major>.<minor>.<patch>`

| 级别 | 说明 | 示例 |
|------|------|------|
| `major` | 重大变更，结构重构，不兼�?| `v1.0.0` �?`v2.0.0` |
| `minor` | 新增内容，兼容扩�?| `v1.0.0` �?`v1.1.0` |
| `patch` | 小修订，错别字、格式调�?| `v1.0.0` �?`v1.0.1` |

### 7.2 变更日志

每份重要文档必须维护 `change_log`，记录：
- 日期
- 版本�?- 作�?- 变更描述（简洁明了）

### 7.3 文档生命周期

```
草稿（draft�?�?活跃（active�?�?废弃（deprecated�?�?归档（archived�?```

| 状�?| 说明 | Frontmatter |
|------|------|-------------|
| `draft` | 编写中，未正式发�?| `status: draft` |
| `active` | 当前有效，持续维�?| `---
title: 文档风格指南与命名规�?
# Classification
type: meta
domain: project # TODO: confirm
tier: standard # TODO: confirm
status: active

# Version
version: v1.0.0 # TODO: confirm
last_updated: 2026-07-17
code_version: 2.0.0
doc_system_version: v1.0.0

# People & Tags
maintainer: Documentation Team
# tags: [tag1, tag2]
# summary: One-line summary

---` |
| `deprecated` | 不推荐使用，有新文档替代 | `status: deprecated` + `deprecated_by` |
| `archived` | 已归档，不再维护 | 移至 archive/ 目录 |

### 7.4 废弃流程

1. 在新文档中添�?`supersedes: old-doc.md`
2. 在旧文档中添�?`status: deprecated` �?`deprecated_by: new-doc.md`
3. 在旧文档顶部添加废弃提示横幅
4. 30 天后移入 `archive/` 目录

---

> **本规范由文档管理团队维护，如有疑问请联系文档管理员�?*
