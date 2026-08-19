---
doc_id: V9-DOC-META-008
title: "V9 文档元数据标准规范"
domain: meta
status: active
last_updated: 2026-08-17
---

---
title: V9 文档元数据标准规范
type: meta
domain: project
phase: planning
tier: important
status: active
maintainer: Documentation Team
summary: V9 项目文档 Frontmatter 元数据的完整规范，包括字段定义、枚举值、验证规则、模板示例和迁移指南
tags: [frontmatter, metadata, standard, specification, governance, documentation, spec]
version: v1.0.0
last_updated: 2026-07-17
code_version: "2.0.0-rc.2"
doc_id: V9-DOC-PROJ-026
related_docs: [V9-DOC-PROJ-017, V9-DOC-PROJ-316, V9-DOC-PROJ-315, V9-DOC-QA-111]
referenced_by: [V9-DOC-META-000, V9-DOC-PROJ-017, V9-DOC-PROJ-175]
change_log:
  - version: v1.0.0
doc_system_version: v1.0.0
changes: Initial version established
date: 2026-07-17
---

# V9 文档元数据标准规范

> **标准版本**：v1.0.0
> **生效日期**：2026-07-17
> **适用范围**：V9 项目所有 Markdown 技术文档
> **维护方**：文档治理小组

---

## 目录

1. [概述](#一概述)
2. [设计原则](#二设计原则)
3. [字段分层体系](#三字段分层体系)
4. [核心字段详细规范](#四核心字段详细规范)
5. [推荐字段详细规范](#五推荐字段详细规范)
6. [可选字段与扩展字段](#六可选字段与扩展字段)
7. [枚举值标准字典](#七枚举值标准字典)
8. [Frontmatter 格式规范](#八frontmatter-格式规范)
9. [验证规则](#九验证规则)
10. [文档模板与示例](#十文档模板与示例)
11. [旧字段迁移映射表](#十一旧字段迁移映射表)
12. [渐进式补全方案](#十二渐进式补全方案)
    - [12.7 第一阶段完成报告](#127-第一阶段完成报告)

---

## 一、概述

### 1.1 什么是元数据

元数据（Metadata）是描述文档属性的数据，放在每份 Markdown 文档顶部的 YAML Frontmatter 区块中。它用结构化的方式描述文档的身份、分类、版本、状态等关键信息。

```markdown
---
title: 文档标题
version: v1.0.0
type: reference
domain: architecture
---
```

### 1.2 为什么需要元数据标准

**现状问题**：
- 589 份文档中，96.1% 有 Frontmatter，但核心分类字段覆盖率 < 1%
- 字段命名不统一（`deprecated` / `deprecated_reason` / `deprecated_date` 散见各处
- 字段值随意，缺少约束（同一含义多种写法）
- 缺少唯一标识，无法稳定引用
- 无法进行自动化统计、检索、质量检查

**标准价值**：

| 价值 | 说明 |
|------|------|
| ?? **可检索** | 按类型/领域/阶段/标签快速筛选文档 |
| ?? **可统计** | 自动化生成文档清单和质量报告 |
| ?? **可引用** | doc_id 作为稳定引用，不怕文件移动 |
| ? **可验证** | 自动化检查元数据完整性和合规性 |
| ?? **可追溯** | 版本号 + 变更日志，记录演进历史 |
| ?? **可迁移** | 标准化字段，便于工具链对接 |

### 1.3 适用范围

本标准适用于 V9 项目 `docs/` 目录下所有 `.md` 格式的技术文档，包括：
- 参考文档、设计文档、操作指南
- 教程、报告、复盘
- 元文档（文档治理文档）

**不适用于**：
- 自动生成的索引文件（如 `registry-index.md（已废弃）`）
- 归档目录下的历史文档（`archive/`）
- README.md 索引文件（建议有但不强制）

---

## 二、设计原则

### 2.1 六大原则

| 原则 | 说明 |
|------|------|
| **最小够用** | 核心字段控制在 7 个以内，降低填写负担 |
| **分层必填** | 按文档重要性分级要求，不搞一刀切 |
| **机器友好** | 字段名全小写、值标准化、便于程序解析 |
| **向后兼容** | 旧字段逐步迁移，不强制立即改造 |
| **渐进完善** | 先有再优，分阶段提升覆盖率 |
| **工具支撑** | 配套验证脚本和生成工具，减少手工劳动 |

### 2.2 分层必填策略

根据文档的 [tier（重要级别）](#tier-文档重要级别) 决定必填字段数量：

| 级别 | 含义 | 必填字段数 | 适用文档 |
|------|------|-----------|----------|
| **tier: important** | 核心重要 | 核心 7 + 推荐 5 = 12 个 | 架构设计、核心规范、关键流程 |
| **tier: standard** | 标准文档 | 核心 7 个 | 普通技术文档 |
| **tier: reference** | 参考资料 | 核心 5 个（缺 version、maintainer） | 参考资料、清单类文档 |
| **tier: quick-note** | 快速笔记 | 核心 3 个（title + type + domain） | 临时笔记、草稿 |

> **说明**：tier 字段本身也是元数据的一部分，形成自描述。

---

## 三、字段分层体系

### 3.1 总览

```
┌─────────────────────────────────────────────────┐
│              核心字段（7个，必须有）                 │
│  title / type / domain / version /            │
│  last_updated / status / tier                 │
├─────────────────────────────────────────────────┤
│              推荐字段（8个，建议有）              │
│  doc_id / summary / tags / maintainer /         │
│  phase / code_version / change_log /          │
│  doc_system_version                           │
├─────────────────────────────────────────────────┤
│              可选字段（按需添加）                  │
│  deprecated_by / deprecated_reason /             │
│  superseded_by / supersedes /                │
│  decision_date / audience / ...              │
└─────────────────────────────────────────────────┘
```

### 3.2 字段清单

#### 核心字段（Core Fields）- 7 个

| # | 字段名 | 类型 | 必填性 | 说明 |
|---|--------|------|--------|------|
| 1 | `title` | string | 全部必填 | 文档标题 |
| 2 | `type` | enum | 全部必填 | 文档类型（reference/explanation/how-to/tutorials/reports/meta） |
| 3 | `domain` | enum | 全部必填 | 功能领域（architecture/frontend/backend/data/ai/qa/project/product） |
| 4 | `version` | string | important/standard 必填 | 文档版本号（语义化） |
| 5 | `last_updated` | date | 全部必填 | 最后更新日期 |
| 6 | `status` | enum | 全部必填 | 文档状态（draft/active/deprecated/archived） |
| 7 | `tier` | enum | 全部必填 | 文档重要级别 |

#### 推荐字段（Recommended Fields）- 8 个

| # | 字段名 | 类型 | 必填性 | 说明 |
|---|--------|------|--------|------|
| 8 | `doc_id` | string | important 必填 | 文档唯一标识 |
| 9 | `phase` | enum | important 推荐 | 开发阶段 |
| 10 | `summary` | string | important 推荐 | 一句话摘要 |
| 11 | `tags` | array | 推荐 | 自定义标签 |
| 12 | `maintainer` | string | important 必填 | 维护负责人 |
| 13 | `code_version` | string | 推荐 | 关联的代码版本 |
| 14 | `change_log` | array | important 推荐 | 变更日志 |
| 15 | `doc_system_version` | string | meta 类必填 | 元数据标准版本 |

#### 可选字段（Optional Fields）

| # | 字段名 | 类型 | 适用场景 | 说明 |
|---|--------|------|----------|------|
| 16 | `deprecated_by` | string | status=deprecated 时 | 替代本文档的新文档路径 |
| 17 | `deprecated_reason` | string | status=deprecated 时 | 废弃原因 |
| 18 | `deprecated_date` | date | status=deprecated 时 | 废弃日期 |
| 19 | `superseded_by` | string | 被替代时 | 替代文档（同 deprecated_by，二选一） |
| 20 | `supersedes` | string | 替代其他文档时 | 本文档替代了哪些旧文档 |
| 21 | `decision_date` | date | ADR 决策文档 | 决策日期 |
| 22 | `audience` | array | 面向特定读者 | 目标读者 |
| 23 | `review_date` | date | 需要定期评审的文档 | 下次评审日期 |
| 24 | `related_docs` | array | 有关联文档时 | 相关文档列表 |

---

## 四、核心字段详细规范

### 4.1 title — 文档标题

| 属性 | 值 |
|------|-----|
| 字段类型 | 字符串 |
| 必填 | 是 |
| 格式 | 纯文本，建议中文优先 |
| 最大长度 | 100 字符以内 |

**规范**：
- 准确概括文档内容
- 与正文一级标题（#）保持一致
- 不加版本号（版本号在 version 字段）
- 不加项目前缀（如 V9 / V6 等可放标签里）

**示例**：
```yaml
title: DataBridge 统一写入网关架构设计
```

---

### 4.2 type — 文档类型

| 属性 | 值 |
|------|-----|
| 字段类型 | 枚举 |
| 必填 | 是 |
| 合法值 | 见 [枚举值字典 - 文档类型](#71-文档类型-type) |
| 格式 | 全小写英文 |

**规范**：
- 从枚举值中选择，不得自定义
- 主要用途优先：文档主要用来做什么就选什么类型
- 拿不准时选 `explanation`

**示例**：
```yaml
type: explanation
```

---

### 4.3 domain — 功能领域

| 属性 | 值 |
|------|-----|
| 字段类型 | 枚举 |
| 必填 | 是 |
| 合法值 | 见 [枚举值字典 - 功能领域](#72-功能领域-domain) |
| 格式 | 全小写英文 |

**规范**：
- 从枚举值中选择，不得自定义
- 选最主要的领域，其他领域用 tags 补充
- 跨领域文档选 `project` 或选主导领域

**示例**：
```yaml
domain: architecture
```

---

### 4.4 version — 文档版本号

| 属性 | 值 |
|------|-----|
| 字段类型 | 字符串 |
| 必填 | important/standard 必填 |
| 格式 | 语义化版本 `v主版本.次版本.修订号` |
| 前缀 | 必须以 `v` 开头 |

**版本号规则**：

| 版本位 | 变化时机 | 示例 |
|--------|----------|------|
| **主版本**（vX） | 结构重构、内容重写、定位变化 | v1.0.0 → v2.0.0 |
| **次版本**（v1.Y） | 新增章节、重大更新、内容扩展 | v1.0.0 → v1.1.0 |
| **修订号**（v1.0.Z） | 错别字、格式调整、小补充 | v1.0.0 → v1.0.1 |

**示例**：
```yaml
version: v1.2.0
```

---

### 4.5 last_updated — 最后更新日期

| 属性 | 值 |
|------|-----|
| 字段类型 | 日期 |
| 必填 | 是 |
| 格式 | ISO 8601：`YYYY-MM-DD` |

**规范**：
- 每次修改文档内容后同步更新
- 格式严格：四位年份，月份和日期补零
- 不要用 `YYYY/MM/DD` 或中文日期

**示例**：
```yaml
last_updated: 2026-07-17
```

---

### 4.6 status — 文档状态

| 属性 | 值 |
|------|-----|
| 字段类型 | 枚举 |
| 必填 | 是 |
| 合法值 | 见 [枚举值字典 - 文档状态](#74-文档状态-status) |
| 格式 | 全小写英文 |

**状态流转**：

```
draft（草稿）
    ↓ 内容完成，审核通过
active（活跃）  ← 大多数文档的常态
    ↓ 有新文档替代 / 功能废弃
deprecated（废弃）
    ↓ 30 天观察期，确认无用
archived（归档）
```

**示例**：
```yaml
status: active
```

---

### 4.7 tier — 文档重要级别

| 属性 | 值 |
|------|-----|
| 字段类型 | 枚举 |
| 必填 | 是 |
| 合法值 | 见 [枚举值字典 - 重要级别](#75-重要级别-tier) |
| 格式 | 全小写，可用连字符 |

**分级标准**：

| 级别 | 判断标准 | 占比预期 |
|------|----------|----------|
| `important` | 核心架构、关键规范、团队必读 | ~10% |
| `standard` | 普通技术文档、日常使用 | ~60% |
| `reference` | 参考资料、清单索引 | ~20% |
| `quick-note` | 临时笔记、草稿、探索性文档 | ~10% |

**示例**：
```yaml
tier: important
```

---

## 五、推荐字段详细规范

### 5.1 doc_id — 文档唯一标识

| 属性 | 值 |
|------|-----|
| 字段类型 | 字符串 |
| 必填 | important 级别必填 |
| 格式 | `V9-DOC-<类型码>-<序号>` |
| 唯一性 | 全局唯一，永不重复 |

**编号规则**：

```
V9-DOC-T<类型><领域><阶段>-<三位序号>
```

| 部分 | 说明 | 示例 |
|------|------|------|
| `V9-DOC-` | 固定前缀 | V9-DOC- |
| `T<类型码>` | 文档类型编码 | T2（解释类） |
| `<领域码>` | 功能领域编码 | D3（后端） |
| `<阶段码>` | 开发阶段编码（可选） | P2（设计） |
| `-<序号>` | 三位流水号 | -001 |

**完整示例**：
```yaml
doc_id: V9-DOC-T2D3P2-001
```

**简化版本**（不包含阶段）：
```yaml
doc_id: V9-DOC-T2D3-001
```

> **分配原则**：
- 分配后永久不变，文件移动/重命名都不改变
- 由文档管理员统一分配
- 新增文档时申请，避免冲突时按顺序递增

---

### 5.2 phase — 开发阶段

| 属性 | 值 |
|------|-----|
| 字段类型 | 枚举 |
| 必填 | important 推荐 |
| 合法值 | 见 [枚举值字典 - 开发阶段](#73-开发阶段-phase) |
| 格式 | 全小写英文 |

**规范**：
- 文档主要在哪个阶段产生/使用，就选哪个阶段
- 跨阶段的选主导阶段
- 拿不准可以不填

**示例**：
```yaml
phase: design
```

---

### 5.3 summary — 一句话摘要

| 属性 | 值 |
|------|-----|
| 字段类型 | 字符串 |
| 必填 | important 推荐 |
| 长度 | 50-200 字符 |

**规范**：
- 一句话说清楚文档讲什么，读者不看正文也能判断是否需要读
- 不写"本文档介绍了..."这种废话
- 直接说核心内容

**示例**：
```yaml
summary: V6 十一层评分引擎的架构设计和实现原理，包括评分算法和评分流程详解
```

---

### 5.4 tags — 自定义标签

| 属性 | 值 |
|------|-----|
| 字段类型 | 字符串数组 |
| 必填 | 推荐 |
| 格式 | YAML 数组，全小写，用连字符 |
| 数量 | 建议 3-8 个 |

**规范**：
- 补充 type/domain/phase 覆盖不到的维度用 tags
- 全小写，多个单词用连字符
- 避免太泛的标签（如 "文档"、"技术"）
- 同一维度内聚性：同一类标签

**常用标签参考**：

| 类别 | 示例 |
|------|------|
| 产品模块 | data-bridge, v6-scoring, mcp |
| 技术栈 | react, typescript, indexeddb |
| 特性 | performance, security, accessibility |
| 状态 | experimental, deprecated, wip |

**示例**：
```yaml
tags: [data-bridge, architecture, envelope-protocol, indexedb]
```

---

### 5.5 maintainer — 维护负责人

| 属性 | 值 |
|------|-----|
| 字段类型 | 字符串 |
| 必填 | important 级别必填 |
| 格式 | 人名或团队名 |

**规范**：
- 真实姓名，不是昵称
- 多人用逗号分隔
- 团队可用团队名

**示例**：
```yaml
maintainer: 张三, 李四
maintainer: Architecture Team
```

---

### 5.6 code_version — 关联代码版本

| 属性 | 值 |
|------|-----|
| 字段类型 | 字符串 |
| 必填 | 推荐 |
| 格式 | 语义化版本 |

**规范**：
- 文档对应的代码版本
- 代码大版本升级时检查文档是否需要更新
- meta 类文档可不填

**示例**：
```yaml
code_version: 2.0.0
```

---

### 5.7 change_log — 变更日志

| 属性 | 值 |
|------|-----|
| 字段类型 | 对象数组 |
| 必填 | important 推荐 |
| 格式 | YAML 数组，每个元素含 date/version/author/desc |

**结构**：

```yaml
change_log:
  - date: 2026-07-17
    version: v1.2.0
    author: 张三
    desc: 新增 xxx 章节，调整 yyy 部分
  - date: 2026-06-25
    version: v1.0.0
    author: 李四
    desc: 初始版本
```

**每条包含字段**：
- `date`：变更日期（必填）
- `version`：变更后的版本号（必填）
- `author`：变更人（推荐）
- `desc`：变更说明（必填）

**规范**：
- 按时间倒序排列（最新的在最上面）
- 重要变更才记录，小修订可以不记
- desc 要具体，不要只写"更新"

---

### 5.8 doc_system_version — 元数据标准版本

| 属性 | 值 |
|------|-----|
| 字段类型 | 字符串 |
| 必填 | meta 类文档必填 |
| 格式 | 语义化版本 |

**规范**：
- 遵循本文档的版本号
- 标准升级时同步更新
- 普通技术文档可不填

**示例**：
```yaml
doc_system_version: v1.0.0
```

---

## 六、可选字段与扩展字段

### 6.1 废弃相关字段

当 `status: deprecated` 时，建议补充以下字段：

```yaml
status: deprecated
deprecated_by: path/to/new-document.md
deprecated_reason: 功能重构，新架构不再使用
deprecated_date: 2026-06-01
```

| 字段 | 说明 |
|------|------|
| `deprecated_by` | 替代文档的路径 |
| `deprecated_reason` | 废弃原因 |
| `deprecated_date` | 废弃日期 |

> **注意**：`superseded_by` 与 `deprecated_by` 含义相同，统一使用 `deprecated_by` 即可。

---

### 6.2 替代关系字段

当文档替代了其他文档时：

```yaml
supersedes:
  - old-doc-v1.md
  - old-doc-v2.md
```

---

### 6.3 ADR 专属字段

架构决策记录（ADR）专用：

```yaml
decision_date: 2026-05-15
decision_status: accepted
```

---

### 6.4 自定义扩展字段

如需扩展字段，遵循以下规则：

1. 优先使用已有字段，不要重复造轮子
2. 扩展字段使用小写字母 + 下划线
3. 在文档内保持一致
4. 高频使用的扩展字段考虑升级为标准字段

---

## 七、枚举值标准字典

### 7.1 文档类型（type）

| 枚举值 | 中文名 | 说明 | 目录 |
|--------|----------|------|------|
| `reference` | 参考类 | 技术规范、API、数据字典 | reference/ |
| `explanation` | 解释类 | 设计文档、原理解释 | explanation/ |
| `how-to` | 指南类 | 操作指南、步骤教程 | how-to/ |
| `tutorials` | 教程类 | 入门教程、学习路径 | tutorials/ |
| `reports` | 报告类 | 审计报告、复盘总结 | reports/ |
| `meta` | 元文档类 | 文档治理、规范本身 | 00-meta/ |

---

### 7.2 功能领域（domain）

| 枚举值 | 中文名 | 说明 |
|--------|----------|------|
| `architecture` | 架构与基础设施 | 整体架构、核心框架、基础设施 |
| `frontend` | 前端与 UI/UX | 前端开发、UI组件、交互设计 |
| `backend` | 后端与服务层 | 服务层、引擎、算法、业务逻辑 |
| `data` | 数据与存储 | 数据库、数据模型、数据流转 |
| `ai` | AI 与模型 | LLM、Agent、MCP、AI 智能体 |
| `qa` | 测试与质量 | 测试、质量保证、代码质量 |
| `project` | 项目与团队 | 项目管理、流程、团队协作 |
| `product` | 产品与业务 | 需求、产品设计、竞品分析 |

---

### 7.3 开发阶段（phase）

| 枚举值 | 中文名 | 说明 |
|--------|----------|------|
| `planning` | 规划与立项 | 愿景、目标、可行性分析 |
| `requirements` | 需求与分析 | 需求分析、用户故事、竞品 |
| `design` | 设计与架构 | 架构设计、UI设计、数据设计 |
| `development` | 开发与实现 | 编码、集成、优化 |
| `testing` | 测试与质量 | 测试、审计、质量保证 |
| `deployment` | 部署与运维 | 发布、部署、运维 |
| `retrospective` | 复盘与演进 | 总结、教训、规划 |

---

### 7.4 文档状态（status）

| 枚举值 | 中文名 | 说明 |
|--------|----------|------|
| `draft` | 草稿 | 编写中，内容不完整，仅供参考 |
| `active` | 活跃 | 正常使用，持续维护 |
| `deprecated` | 废弃 | 不再维护，有新文档替代或功能废弃 |
| `archived` | 归档 | 移入归档目录，仅作历史留存 |

---

### 7.5 重要级别（tier）

| 枚举值 | 中文名 | 说明 |
|--------|----------|------|
| `important` | 核心重要 | 团队必读，核心架构/规范，影响面广 |
| `standard` | 标准文档 | 普通技术文档，日常使用 |
| `reference` | 参考资料 | 清单、索引、参考类文档 |
| `quick-note` | 快速笔记 | 临时笔记、探索性文档、草稿 |

---

## 八、Frontmatter 格式规范

### 8.1 基本格式

```yaml
---
title: 文档标题
version: v1.0.0
---
```

**规则**：
- 位于文件最开头，前面不能有任何内容（包括空行）
- 用 `---` 包裹，上下各一行
- 使用 YAML 语法
- 字段名全小写，单词间用下划线
- 冒号后面跟一个空格
- 字符串值一般不用引号（除非有特殊字符）

### 8.2 字段顺序

**统一按以下顺序排列**，便于阅读和对比：

```yaml
---
# 1. 身份标识
title:
doc_id:

# 2. 分类属性
type:
domain:
phase:
tier:
status:

# 3. 版本信息
version:
last_updated:
code_version:
doc_system_version:

# 4. 人员与协作
maintainer:
tags:
summary:

# 5. 变更历史
change_log:

# 6. 特殊状态
deprecated_by:
deprecated_reason:
deprecated_date:

# 7. 其他扩展
...
---
```

> **为什么要统一顺序**：
- 便于快速扫视找到想要的信息
- 减少认知负担，每份文档都一样
- 方便工具处理

### 8.3 注释

YAML 支持 `#` 开头的注释，但**不建议**在 Frontmatter 中大量使用注释。

**可以用的情况：
- 临时标记待确认的字段

```yaml
status: draft # TODO: 待审核后改为 active
```

### 8.4 多行文本

长文本用 `|-` 或 `|` 保持换行：

```yaml
summary: |-
  这是一段很长的摘要，
  可以换行写，
  保持可读性。
```

---

## 九、验证规则

### 9.1 必填校验级别

| 级别 | 说明 | 严重程度 |
|------|------|----------|
| P0 错误 | 违反核心规则，必须修复 | ?? 错误 |
| P1 警告 | 建议改进，不阻塞 | ?? 警告 |
| P2 提示 | 风格建议 | ?? 提示 |

### 9.2 P0 级（必须通过）

| # | 规则 | 说明 |
|---|------|------|
| 1 | Frontmatter 格式正确 | YAML 语法正确，能正常解析 |
| 2 | 核心字段存在 | title / type / domain / status / tier / last_updated 存在 |
| 3 | 枚举值合法 | type / domain / status / tier / phase 值在枚举列表中 |
| 4 | 日期格式正确 | last_updated 格式为 YYYY-MM-DD |
| 5 | 版本号格式正确 | version 以 v 开头，语义化格式 |

### 9.3 P1 级（建议完善）

| # | 规则 | 说明 |
|---|------|------|
| 6 | version 存在 | standard/important 级别应有 version |
| 7 | maintainer 存在 | important 级别应有 maintainer |
| 8 | doc_id 存在 | important 级别应有 doc_id |
| 9 | summary 存在 | important 级别建议有 summary |
| 10 | tags 存在 | 建议添加标签便于检索 |
| 11 | 字段顺序正确 | 按标准顺序排列 |

### 9.4 P2 级（风格提示）

| # | 规则 | 说明 |
|---|------|------|
| 12 | title 与正文一级标题一致 | Frontmatter 的 title 和 # 标题相同 |
| 13 | 标签数量合理 | 3-8 个标签为宜 |
| 14 | change_log 格式规范 | 每条有 date/version/desc |
| 15 | 无废弃字段 | 不使用已废弃的字段名 |

### 9.5 一致性校验

| # | 规则 | 说明 |
|---|------|------|
| 16 | type 与目录一致 | 文档所在目录与 type 匹配 |
| 17 | status 与目录一致 | archived 状态文档应在 archive/ 下 |
| 18 | deprecated 字段一致性 | deprecated 状态应有 deprecated_by |

---

## 十、文档模板与示例

### 10.1 最小模板（quick-note 级别）

```yaml
---
title: 标题
type: reference
domain: architecture
status: draft
tier: quick-note
last_updated: 2026-07-17
---
```

**适用**：快速笔记、临时草稿、探索性文档。

---

### 10.2 标准模板（standard 级别）

```yaml
---
title: 文档标题
type: explanation
domain: architecture
phase: design
status: active
tier: standard
version: v1.0.0
last_updated: 2026-07-17
maintainer: 张三
tags: [tag1, tag2]
summary: 一句话说明文档内容
code_version: 2.0.0
---
```

**适用**：大多数技术文档。

---

### 10.3 重要文档模板（important 级别）

```yaml
---
title: 文档标题
doc_id: V9-DOC-T2D1P2-001
type: explanation
domain: architecture
phase: design
status: active
tier: important
version: v1.0.0
last_updated: 2026-07-17
code_version: 2.0.0
maintainer: 张三, 李四
tags: [tag1, tag2, tag3]
summary: 一句话摘要，说清楚文档核心内容和价值

change_log:
  - date: 2026-07-17
    version: v1.0.0
    author: 张三
    desc: 初始版本
---
```

**适用**：架构设计、核心规范、关键流程文档。

---

### 10.4 废弃文档模板

```yaml
---
title: 旧文档标题
type: reference
domain: architecture
status: deprecated
tier: standard
version: v1.2.0
last_updated: 2026-03-15
deprecated_by: path/to/new-document.md
deprecated_reason: 功能重构，新架构不再使用
deprecated_date: 2026-06-01
---
```

---

### 10.5 ADR 决策文档模板

```yaml
---
title: ADR-001: 决策标题
doc_id: V9-DOC-T2D1P2-001
type: explanation
domain: architecture
phase: design
status: active
tier: important
version: v1.0.0
last_updated: 2026-07-17
decision_date: 2026-05-15
maintainer: Architecture Team
tags: [adr, architecture, decision]
summary: 关于 xxx 的架构决策记录
---
```

---

### 10.6 元文档模板

```yaml
---
title: 元数据标准
doc_id: V9-DOC-META-001
type: meta
domain: project
status: active
tier: important
version: v1.0.0
last_updated: 2026-07-17
doc_system_version: v1.0.0
maintainer: Documentation Team
tags: [metadata, standard, frontmatter]
summary: 元数据标准规范
---
```

---

## 十一、旧字段迁移映射表

### 11.1 字段名统一

| 旧字段名 | 新字段名 | 说明 |
|----------|----------|------|
| `updated` | `last_updated` | 统一字段名 |
| `date` | `last_updated` 或 `decision_date` | 根据含义区分 |
| `owner` | `maintainer` | 统一术语 |
| `deprecated` | `status: deprecated` | 改为枚举值 |
| `changelog` | `change_log` | 统一下划线命名 |
| `doc-version` | `version` | 简化字段名 |
| `doc_version` | `version` | 简化字段名 |
| `superseded_by` | `deprecated_by` | 统一用 deprecated_by |

### 11.2 枚举值统一

| 旧值 | 新值 | 说明 |
|------|------|------|
| `active / 活跃 / 正常 | `active` | 统一英文 |
| `draft / 草稿 / wip` | `draft` | 统一英文 |
| `deprecated / 废弃 / obsolete` | `deprecated` | 统一英文 |
| `archived / 归档` | `archived` | 统一英文 |
| `important / core / 重要` | `important` | 统一英文 |

### 11.3 迁移策略

1. **不强制迁移**：旧文档保持原样，不做批量破坏性修改
2. **修改即更新**：下次修改文档时顺手更新 Frontmatter
3. **新文档新标准**：新增文档严格遵循新标准
4. **核心文档优先**：important 级别的文档优先迁移
5. **工具辅助**：用脚本批量检测和提示

---

## 十二、渐进式补全方案

> **详细实施计划**：请参考 [《文档元数据治理分阶段实施计划》](metadata-governance-phased-plan.md)，包含完整的任务分解、时间线、人力需求和验收标准。

### 12.1 总体策略

**原则**：先有再优，分层推进，不搞运动式治理。

```
Phase 1: 核心字段补齐（覆盖率 80%）
    ↓
Phase 2: 推荐字段完善（覆盖率 60%）
    ↓
Phase 3: 质量持续优化（覆盖率 90%+）
```

### 12.2 第一阶段：核心字段补齐（2 周）

**目标**：所有 active 状态文档的 7 个核心字段覆盖率达到 80%。

| 任务 | 方式 | 预计工作量 |
|------|------|-----------|
| 现有 Frontmatter 扫描 | 脚本自动扫描 | 0.5 人天 |
| 核心字段自动填充 | 脚本根据目录/文件名推断 type/domain/phase | 1 人天 |
| 自动推断结果人工审核 | 按领域分工审核 | 2 人天 |
| 无 Frontmatter 文档补全 | 23 份文档手动补 | 0.5 人天 |

**自动推断规则**：
- 根据目录推断 type：`reference/` → `reference`，`how-to/` → `how-to`
- 根据目录推断 domain：`architecture/` → `architecture`，`frontend/` → `frontend`
- 根据文件名关键词推断：`design` → `design`，`test` → `testing`
- status 默认 `active`（已废弃的单独处理）
- tier 默认 `standard`
- last_updated 取文件修改时间
- version 默认 `v1.0.0`（有变更日志的从日志取）

### 12.3 第二阶段：推荐字段完善（1 个月）

**目标**：
- important 级文档 doc_id 覆盖率 100%
- standard 级文档 maintainer 覆盖率 60%
- tags 覆盖率 60%
- phase 字段覆盖率 75%
- type/domain 人工审核准确率达 90%

| 任务 | 方式 | 预计工作量 |
|------|------|-----------|
| important 文档 doc_id 分配 | 人工分配编号 | 0.5 人天 |
| phase 字段自动补全 + 审核 | 脚本推断 + 人工确认 | 1 人天 |
| maintainer 字段补充 | 按领域负责人分配 | 1 人天 |
| tags 标签体系建设与填充 | 脚本推荐 + 人工确认 | 2 人天 |
| type/domain 人工审核 | 按领域分工 | 3 人天 |
| summary 摘要补充（重要文档） | 手动编写 | 2 人天 |

**第二阶段输出物**：
- `doc-id-registry.md` — 文档唯一标识注册表
- `tag-taxonomy.md` — 标签分类体系
- Phase 2 完成报告与质量数据

### 12.4 第三阶段：质量持续优化（持续）

**目标**：整体元数据质量稳定在优秀水平。

| 任务 | 方式 | 频率 |
|------|------|------|
| 元数据质量检查 | 脚本自动检查 + 报告 | 每月一次 |
| 新文档元数据审核 | PR 检查清单 | 每次新增 |
| 定期抽查复核 | 文档管理员抽查 | 每季度 |
| 标准迭代更新 | 根据反馈优化标准 | 每半年 |

### 12.5 质量指标与度量

**基准数据（2026-07-17 实测）**：590 份文档，567 份有 Frontmatter（96.1%）

**Phase 1 完成数据（2026-07-17 实测）**：660 份文档，660 份有 Frontmatter（100%）

| 指标 | 基准值 | 第一阶段目标 | 第一阶段实际 | 第二阶段目标 | 长期目标 |
|------|--------|-------------|-------------|-------------|---------|
| Frontmatter 拥有率 | 96.1% | 98% | **100%** | 99% | 100% |
| 核心 7 字段完整率 | ~4% | 80% | **100%** | 95% | 98% |
| type 字段覆盖率 | 0.2% | 90% | **100%** | 95% | 98% |
| domain 字段覆盖率 | 0% | 90% | **100%** | 95% | 98% |
| status 字段覆盖率 | 28.4% | 90% | **100%** | 95% | 98% |
| tier 字段合规率 | ~0%（值不标准） | 85% | **100%** | 90% | 95% |
| last_updated 覆盖率 | 19.5% | 80% | **100%** | 90% | 95% |
| version 覆盖率 | 21.1% | 60% | **100%** | 75% | 85% |
| type/domain 准确率 | N/A | 85% | *待人工审核* | 90% | 95% |
| phase 字段覆盖率 | N/A | N/A | **55.8%** | 75% | 90% |
| important 文档 doc_id | 0% | 50% | - | 100% | 100% |
| maintainer 覆盖率 | 19.2% | 40% | 9.7% | 60% | 80% |
| tags 覆盖率 | 0.2% | 30% | 0.3% | 60% | 80% |

### 12.6 第一阶段执行手册

**目标**：2 周内将核心字段覆盖率从 ~4% 提升到 80%。

#### 第 1 天：准备与脚本验证

1. 运行 `audit-frontmatter.ps1`，获取基线数据
2. 运行 auto-complete-frontmatter.ps1（report 模式），预览补全建议
3. 抽样检查 20 份文档的推断准确率，调整推断规则

#### 第 2-3 天：批量自动补全

1. 在分支上执行 `auto-complete-frontmatter.ps1 -Apply`
2. 运行 `validate-frontmatter.ps1`，验证 P0 错误下降情况
3. 按领域分组输出待审核清单

#### 第 4-8 天：分领域人工审核

| 领域 | 预计文档数 | 负责人 | 预计工时 |
|------|-----------|--------|---------|
| architecture | ~50 | 架构组 | 0.5 天 |
| frontend | ~100 | 前端组 | 1 天 |
| backend | ~120 | 后端组 | 1 天 |
| data | ~80 | 数据组 | 0.5 天 |
| ai | ~60 | AI 组 | 0.5 天 |
| qa | ~50 | 测试组 | 0.5 天 |
| project/product | ~100 | 产品/项目 | 1 天 |
| meta | ~30 | 文档组 | 0.5 天 |

**审核要点**：
- type 是否正确？（最关键）
- domain 是否正确？
- tier 分级是否合理？
- status 是否准确？
- 推断不确定的，打上 `# TODO: confirm` 标记

#### 第 9-10 天：收尾与验证

1. 收集各领域审核结果，合并提交
2. 再次运行 `validate-frontmatter.ps1`，确认 P0 错误 < 20%
3. 输出第一阶段验收报告
4. 遗留问题登记到第二阶段任务清单

### 12.7 第一阶段完成报告

**完成时间**：2026-07-17（实际耗时：1 天，远快于预期的 2 周）

**核心成果**：
- 核心 7 字段覆盖率从 ~4% 提升至 **100%**
- Frontmatter 拥有率从 96.1% 提升至 **100%**
- P0 级验证错误从 1369 个降至 **0 个**
- 660 份文档全部通过 P0 级验证

**执行的关键步骤**：

1. **损坏文件修复**：使用 `fix-frontmatter.ps1` 修复了 200+ 份因脚本错误导致 Frontmatter 重复/损坏的文档
2. **自动补全**：使用 `auto-complete-frontmatter.ps1` 为 157 份文档批量补全缺失的核心字段
3. **注释清理与二次补全**：使用 `cleanup-frontmatter.ps1` 清理了 225 份文档的 `# TODO: confirm` / `# migrated from` 注释，并补全了剩余缺失字段

**工具链**：

| 脚本 | 用途 | 处理文档数 |
|------|------|-----------|
| `audit-frontmatter.ps1` | 元数据覆盖率审计 | 660 |
| `validate-frontmatter.ps1` | P0/P1/P2 三级验证 | 660 |
| `fix-frontmatter.ps1` | 修复重复/损坏的 Frontmatter | 200+ |
| `auto-complete-frontmatter.ps1` | 自动补全缺失的核心字段 | 157 |
| `cleanup-frontmatter.ps1` | 清理值注释 + 二次补全 | 225 |

**遗留问题（转入 Phase 2）**：

1. **type/domain 准确率待验证**：自动推断的 type/domain 约 85% 准确，仍需人工审核
2. **phase 字段覆盖率仅 55.8%**：约 292 份文档缺少开发阶段标记
3. **maintainer 覆盖率仅 9.7%**：大部分文档未指定维护人
4. **tags 覆盖率仅 0.3%**：标签体系尚未建立
5. **summary 覆盖率极低**：仅 1 份文档有摘要
6. **doc_id 未分配**：important 级文档尚未分配唯一标识

---

## 附录

### A. 相关文档

- [文档分类体系规范](document-classification-system.md) — 三维分类体系详细说明
- [文档风格指南](document-style-guide.md) — 文档格式和写作规范
- [文档质量控制报告](document-quality-control-report.md（已废弃）) — 质量评估报告

### B. 工具脚本

| 脚本 | 用途 | 用法 |
|------|------|------|
| scripts/docs-tool/normalize-frontmatter.mjs（替代 audit-frontmatter.ps1） | Frontmatter 现状审计与规范化 | 扫描所有文档，统计各字段覆盖率 |
| scripts/docs-tool/normalize-frontmatter.mjs（替代 validate-frontmatter.ps1） | Frontmatter 验证检查 | 按 P0/P1/P2 三级规则验证，输出问题清单 |
| scripts/other/inject-frontmatter.ts（替代 auto-complete-frontmatter.ps1） | 自动补全元数据 | 根据路径/文件名推断 type/domain/phase，支持直接写入 |
| scripts/generate-doc-inventory.ps1（已废弃） | 生成文档清单 | 扫描文档并导出 CSV 清单 |

**常用命令**：

```powershell
# 审计元数据现状
.\scripts\audit-frontmatter.ps1

# 验证元数据合规性
.\scripts\validate-frontmatter.ps1

# 预览自动补全建议（不修改文件）
.\scripts\auto-complete-frontmatter.ps1

# 执行自动补全（会修改文件，慎用！）
.\scripts\auto-complete-frontmatter.ps1 -Apply
```

### C. 版本历史

| 版本 | 日期 | 变更 |
|------|------|------|
| v1.0.0 | 2026-07-17 | 初始版本，建立完整的元数据标准体系 |
