---
title: 文档标签分类体系（受控词表）
type: meta
domain: project
phase: planning
tier: important
status: draft
maintainer: V9 Architecture Team
summary: "与 Frontmatter domain 字段对齐，作为标签冗余以便跨字段检索："
tags: [project, documentation, meta, governance]
version: v0.1.0
last_updated: 2026-07-17
code_version: "2.0.0-rc.1"
doc_id: V9-DOC-PROJ-001
referenced_by: [V9-DOC-META-000, V9-DOC-PROJ-CROSSINDEX-001, V9-DOC-PROJ-017]
change_log:
  - version: v0.1.0
changes: Initial version established
date: 2026-07-17
---

# V9 文档标签分类体系（Tag Taxonomy）

> **状态**：v0.1.0 初稿（基于 661 份文档高频词自动提取 + 人工规整）
> **用途**：`tags` 字段的受控词表；打标签时优先从本表选取，新标签需先登记
> **提取依据**：`scripts/extract-tag-candidates.ps1（已废弃）` 对全库文件名/路径的词频统计

---

## 一、设计原则

1. **受控词表**：只允许使用本表登记的标签，禁止自由造词
2. **三层结构**：领域 → 模块 → 特性，由粗到细
3. **每文档 2-5 个标签**：至少 1 个领域标签 + 1 个模块/特性标签
4. **英文小写连字符**：标签统一 kebab-case 英文，与 type/domain 字段风格一致

---

## 二、第一层：领域标签（8 个，必选其一）

与 Frontmatter `domain` 字段对齐，作为标签冗余以便跨字段检索：

| 标签 | 说明 |
|------|------|
| `architecture` | 架构设计与决策 |
| `frontend` | 前端 UI/组件/页面 |
| `backend` | 后端服务/引擎/算法 |
| `data` | 数据层/存储/字典 |
| `ai` | AI/LLM/Agent/MCP |
| `qa` | 测试/质量/审计 |
| `project` | 项目管理/流程/治理 |
| `product` | 产品/需求/用户 |

---

## 三、第二层：模块标签（按词频 ≥6 提取，按领域分组）

### 3.1 数据与引擎（data / backend）

| 标签 | 词频 | 说明 |
|------|------|------|
| `data-definition` | 22 | 数据结构定义 |
| `dataflow` | 6 | 数据流/数据链路 |
| `databridge` | - | DataBridge 信封协议 |
| `contract` | 26 | 模块契约/接口 |
| `store` | 9 | Zustand store |
| `collection` | 10 | 数据采集 |
| `registry` | 8 | 注册表/索引 |
| `screening` | 7 | 选股筛选 |
| `trading` | 6 | 交易策略 |
| `strategy` | 29 | 策略体系（通用） |

### 3.2 前端与座舱（frontend）

| 标签 | 词频 | 说明 |
|------|------|------|
| `cockpit` | 6 | 座舱框架 |
| `widget` | 8 | Widget 组件 |
| `component` | 6 | 组件体系 |
| `token` | 6 | 设计 token |
| `news` | 7 | 新闻模块 |
| `input-cabin` | 8 | 输入舱 |
| `ui-ux` | - | UI/UX 规范 |

### 3.3 AI 与集成（ai）

| 标签 | 词频 | 说明 |
|------|------|------|
| `mcp` | 14 | MCP Server 体系 |
| `agent` | - | Agent 运行时 |
| `integration` | 10 | 服务集成 |
| `prompt` | - | Prompt 工程 |
| `llm` | - | LLM 管理 |

### 3.4 架构（architecture）

| 标签 | 词频 | 说明 |
|------|------|------|
| `adr` | 10 | 架构决策记录 |
| `dual-strategy` | 8 | 双通道策略 |
| `migration` | 9 | 迁移相关 |
| `refactor` | 6 | 重构 |
| `complexity` | 6 | 复杂度治理 |

---

## 四、第三层：特性/主题标签（横切关注点）

| 标签 | 词频 | 说明 |
|------|------|------|
| `audit` | 43 | 审计类（通用） |
| `quality` | 18 | 质量保障 |
| `test` | 21 | 测试 |
| `checklist` | 6 | 检查清单 |
| `governance` | 9 | 治理 |
| `optimization` | 14 | 优化 |
| `fix` | 13 | 缺陷修复 |
| `remediation` | 12 | 整改 |
| `cleanup` | 6 | 清理 |
| `gap-analysis` | 6 | 差距分析 |
| `completeness` | 11 | 完整性检查 |
| `workflow` | 7 | 工作流 |
| `jsdoc` | 6 | JSDoc 注释 |
| `security` | - | 安全 |
| `performance` | - | 性能 |
| `a11y` | - | 无障碍 |

---

## 五、打标签规范

### 5.1 组合示例

```yaml
# 一份座舱数据字典文档
tags: [data, cockpit, data-definition]

# 一份 MCP 治理审计报告
tags: [ai, mcp, governance, audit]

# 一份架构 ADR
tags: [architecture, adr]
```

### 5.2 禁止事项

- 禁止单标签（至少 2 个：领域 + 模块/特性）
- 禁止超过 5 个标签（避免标签噪音）
- 禁止使用日期、版本号作为标签（`2026`、`v1` 等）
- 禁止与 title 完全重复的无信息量标签

### 5.3 新标签登记流程

1. 检查本表是否已有等价标签
2. 在 PR 中新增标签到本表对应层级
3. 注明词频依据或使用场景
4. 文档治理小组评审后合入

---

## 六、后续工作

- [ ] 各领域负责人确认本领域模块标签（第二层）
- [ ] 运行 suggest-tags.ps1（待开发）批量推荐标签
- [ ] 人工确认后批量写入 Frontmatter
- [ ] 目标：tags 覆盖率 ≥ 60%
