---
title: V9 文档管理体系团队培训材料
type: meta
domain: project
phase: planning
tier: standard
status: active
maintainer: V9 Architecture Team
summary: "文档定位：帮助团队成员快速掌握新的文档管理体系> 培训时长：约 30 分钟 目标读者*：全体开发人员、产品经理、测试人员"
tags: [project, documentation, management]
version: v1.0.0
last_updated: 2026-07-17
code_version: 2.0.0
doc_id: V9-DOC-PROJ-320
related_docs: [V9-DOC-PROJ-316, V9-DOC-PROJ-315, V9-DOC-PROJ-317, V9-DOC-PROJ-321]
referenced_by: [V9-DOC-META-000, V9-DOC-PROJ-175]
change_log:
  - version: v1.0.0
changes: Initial version established
date: 2026-07-17
---

# V9 文档管理体系团队培训材料

> **文档定位**：帮助团队成员快速掌握新的文档管理体系
> **培训时长**：约 30 分钟
> **目标读者**：全体开发人员、产品经理、测试人员
---

## 目录

1. [为什么要做文档治理](#一为什么要做文档治理)
2. [核心概念快速入门](#二核心概念快速入门)
3. [三维分类体系详解](#三三维分类体系详解)
4. [日常开发文档操作](#四日常开发文档操作)
5. [Frontmatter 填写指南](#五frontmatter-填写指南)
6. [常见问题 FAQ](#六常见问题-faq)
7. [快速参考卡](#七快速参考卡)

---

## 一、为什么要做文档治理
### 1.1 痛点回顾

**整理前的问题**：
| 问题 | 表现 | 影响 |
|------|------|------|
| 📚 文档量大 | 700+ 份文档，找东西费劲 | 新人上手慢，老人也找不到 |
| 🗂️ 分类混乱 | 同一个主题的文档散落在各处 | 重复劳动，信息不一致 |
| 🏷️ 命名不一 | 中英文混合、大小写混乱、语义不清 | 不知道文件里是什么 |
| 🪦 死文档多 | 过时的、废弃的、重复的文档混在活跃文档里 | 干扰判断，误用旧文档 |
| 🔗 引用断裂 | 链接失效、找不到相关文档 | 信息孤岛，学习成本高 |

### 1.2 治理目标

**一句话总结**：让团队成员能在 **30 秒内** 找到需要的文档，并且知道这份文档**是否可信、是否最新**。

**具体目标**：
```
✅ 找得到  →  分类清晰、索引完善、搜索友好
✅ 看得懂  →  结构标准、命名规范、元数据完整
✅ 信得过  →  版本明确、状态清晰、维护可追溯
✅ 用得顺  →  模板统一、工具配套、流程简单
```

### 1.3 对每个人的好处
| 角色 | 好处 |
|------|------|
| **新人** | 30 分钟建立全局认知，快速找到学习路径 |
| **开发** | 不用再问"这个文档在哪"，专注写代码 |
| **架构师** | 决策有记录，设计有传承，减少重复沟通 |
| **产品** | 需求文档规范统一，版本清晰可追溯 |
| **测试** | 测试用例和报告分类清晰，方便查阅 |
| **所有人** | 减少找文档的时间，提高工作效率 |

---

## 二、核心概念快速入门

### 2.1 五个必须知道的概念
| # | 概念 | 一句话解释 | 类比 |
|---|------|-----------|------|
| 1 | **三维分类** | 每份文档都有类型/领域/阶段三个标签 | 像图书馆的分类号 |
| 2 | **Frontmatter** | 文档头部的元数据（标题、版本、分类等） | 书的版权页 |
| 3 | **文档编号** | 每份文档的唯一身份证号 | 图书 ISBN 号 |
| 4 | **生命周期** | 草稿→活跃→废弃→归档 | 产品生命周期 |
| 5 | **Diátaxis** | 四种文档类型的理论框架 | 文档分类的行业标准 |

### 2.2 文档放在哪里

**快速记忆：六种类型，六个目录**

| 你想写... | 放到... | 例子 |
|-----------|---------|------|
| 技术规范、API、标准 | `docs/reference/` | 编码规范、接口契约 |
| 设计思路、原理解释 | `docs/explanation/` | 架构设计、ADR 决策 |
| 操作指南、步骤教程 | `docs/guides/how-to/` | 新增 Store、部署指南 |
| 入门教程、学习路径 | `docs/guides/tutorials/` | 快速上手指南 |
| 报告、复盘、总结 | `docs/reports/` | 审计报告、经验教训 |
| 文档本身的规范 | `docs/meta/` | 分类体系、命名规范 |

**简单判断方法**：
- 回答"**是什么**" → reference
- 回答"**为什么**" → explanation
- 回答"**怎么做**" → how-to
- 回答"**教我学**" → tutorials
- 回答"**怎么样**" → reports
- 回答"**文档怎么管**" → 00-meta

---

## 三、三维分类体系详解
### 3.1 第一维：文档类型（是什么类型的文档？）

```
T1 参考类（Reference）    ← 查资料用
T2 解释类（Explanation）  ← 理解原理用
T3 指南类（How-to）       ← 照着做用
T4 教程类（Tutorials）    ← 学入门用
T5 报告类（Reports）      ← 看结果用
T6 元文档类（Meta）       ← 管文档用
```

**快速判断练习**：

| 文档 | 类型 | 为什么 |
|------|------|--------|
| 编码规范 | T1 参考 | 是标准，查着用 |
| 架构设计文档 | T2 解释 | 讲为什么这样设计 |
| 新增 Store 步骤 | T3 指南 | 照着步骤做 |
| 新人快速上手 | T4 教程 | 从 0 开始学 |
| 代码审计报告 | T5 报告 | 展示审计结果 |
| 命名规范文档 | T6 元文档 | 管文档的规范 |

### 3.2 第二维：功能领域（涉及哪个技术领域？）
```
D1 架构与基础设施  ← 架构、核心框架
D2 前端与 UI/UX    ← 页面、组件、设计
D3 后端与服务层    ← 服务、引擎、算法
D4 数据与存储      ← 数据库、数据模型
D5 AI 与模型       ← LLM、Agent、MCP
D6 测试与质量      ← 测试、质量、审计
D7 项目与团队      ← 管理、流程、协作
D8 产品与业务      ← 需求、用户、竞品
```

**快速判断**：看文档主要讲什么技术领域的内容。
### 3.3 第三维：开发阶段（属于项目哪个阶段？）

```
P0 规划与立项    ← 愿景、目标、可行性
P1 需求与分析    ← 需求、用户故事、竞品
P2 设计与架构    ← 架构、UI、数据设计
P3 开发与实现    ← 编码、集成、优化
P4 测试与质量    ← 测试、审计、质量
P5 部署与运维    ← 发布、部署、运维
P6 复盘与演进    ← 总结、教训、规划
```

**快速判断**：看文档主要在生命周期哪个阶段产生/使用。

### 3.4 举几个例子
| 文档标题 | 类型 | 领域 | 阶段 |
|----------|------|------|------|
| DataBridge 架构设计 | explanation | architecture | design |
| 编码规范速查 | reference | project | development |
| 新增 Widget 指南 | how-to | frontend | development |
| 代码质量审计报告 | reports | qa | testing |
| 经验教训库 | reports | project | retrospective |
| 产品愿景与目标 | reference | product | planning |

---

## 四、日常开发文档操作

### 4.1 新增文档（5 步法）
```
第 1 步：确定类型 → 放在哪个目录？
    ↓
第 2 步：规范命名 → kebab-case，语义化
    ↓
第 3 步：复制模板 → Frontmatter + 标准结构
    ↓
第 4 步：填写内容 → 按结构写内容
    ↓
第 5 步：更新索引 → 在 README 或清单中登记
```

**检查清单（新增文档后）**：
- [ ] 放在正确的目录了吗？
- [ ] 文件名是全小写 + 连字符吗？
- [ ] Frontmatter 填完整了吗？
- [ ] 上一级 README 更新了吗？
- [ ] 相关文档有互相链接吗？
### 4.2 修改文档（3 个必做）

1. **更新版本号**：
   - 大改（结构重写）→ 升 minor 版本（v1.0 → v1.1）
   - 小改（错别字、补充）→ 升 patch 版本（v1.0 → v1.0.1）

2. **更新变更日志**：
   ```yaml
   change_log:
     - date: 2026-07-17
       version: v1.1.0
       author: 张三
       desc: 新增 xxx 章节
   ```

3. **更新 last_updated 日期**

### 4.3 废弃文档（3 个步骤）

1. **标记废弃状态**：
   ```yaml
   status: deprecated
   deprecated_by: new-document-path.md
   ```

2. **添加废弃提示**：在文档顶部加横幅

3. **通知相关人**：确保大家知道改用新文档

### 4.4 找文档（3 种方法）

| 方法 | 适用场景 | 怎么用 |
|------|----------|--------|
| **按目录找** | 知道大概类型 | 从 docs/ 根目录逐层进入 |
| **按索引找** | 想快速浏览 | 看各目录的 README |
| **搜索找** | 知道关键词 | 用 IDE 的全局搜索（Ctrl+Shift+F） |

**推荐流程**：先看总目录 → 进入子目录 → 看 README 索引 → 找到目标文档

---

## 五、Frontmatter 填写指南

### 5.1 什么是 Frontmatter

Frontmatter 是 Markdown 文件顶部的 YAML 元数据块，用 `---` 包裹。
```markdown
---
title: 文档标题
version: v1.0.0
last_updated: 2026-07-17
---

# 文档标题

正文内容...
```

### 5.2 必填字段（5 个必须填）

| 字段 | 填什么 | 示例 |
|------|--------|------|
| `title` | 文档的标题（中文即可） | `DataBridge 统一写入网关` |
| `type` | 文档类型：reference/explanation/how-to/tutorials/reports/meta | `explanation` |
| `domain` | 功能领域：architecture/frontend/backend/data/ai/qa/project/product | `architecture` |
| `version` | 文档版本号 | `v1.0.0` |
| `last_updated` | 最后更新日期（YYYY-MM-DD） | `2026-07-17` |

### 5.3 推荐填写的字段

| 字段 | 填什么 | 什么时候填 |
|------|--------|-----------|
| `doc_id` | 文档编号（自动分配） | 正式发布时 |
| `phase` | 开发阶段 | 分类清晰的文档 |
| `status` | 状态：active/draft/deprecated | 非 active 状态必填 |
| `maintainer` | 维护负责人 | 核心文档 |
| `tags` | 自定义标签数组 | 方便搜索 |
| `summary` | 一句话摘要 | 长文档 |
| `change_log` | 变更日志 | 重要文档 |

### 5.4 完整示例

```yaml
---
title: V6 评分引擎设计
doc_id: V9-DOC-T2D3P2-001
type: explanation
domain: backend
phase: design
tier: important
code_version: 2.0.0
version: v1.2.0
last_updated: 2026-07-17
maintainer: Algorithm Team
---
title: 文档管理体系团队培训材料

# Classification
type: meta
domain: project
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
tags: [v6, scoring, engine, algorithm]
summary: V6 十一层评分引擎的架构设计和实现原理
change_log:
  - date: 2026-07-17
    version: v1.2.0
    author: 李四
    desc: 新增交叉验证章节
  - date: 2026-06-25
    version: v1.0.0
    author: 张三
    desc: 初始版本
---
```

### 5.5 常见错误

❌ **错误**：字段名写错（用 `Title` 而不是 `title`）
✅ **正确**：全小写字段名

❌ **错误**：日期格式不对（`2026/7/17`）
✅ **正确**：`2026-07-17`（ISO 格式）

❌ **错误**：版本号前面没 v（`1.0.0`）
✅ **正确**：`v1.0.0`

---

## 六、常见问题 FAQ

### Q1：我不确定文档该放哪个类型怎么办？

**A**：按主要用途判断：
- 主要用来查 → reference
- 主要用来理解 → explanation
- 主要照着做 → how-to
- 实在拿不准 → 放 explanation，后续可以移动

> 记住：分类是辅助查找的，不是绝对的。放错了也没关系，后续可以调整。
### Q2：文档涉及多个领域，domain 填哪个？

**A**：选最主要的那个领域，然后用 tags 补充其他领域。

例子：一份关于 UI 组件的架构文档
- domain: `frontend`（主要是前端）
- tags: `[components, architecture, design-system]`

### Q3：旧文档没有 Frontmatter 怎么办？

**A**：
- 不强制，逐步补全
- 核心文档优先补
- 修改旧文档时顺便加上

### Q4：我写的文档很重要，怎么让大家知道？

**A**：
1. 填好 Frontmatter 的 `summary` 和 `tags`
2. 在相关文档中加链接（双向引用）
3. 在目录 README 中放到显眼位置
4. 团队群里通知一声
### Q5：死文档怎么处理？可以直接删吗？

**A**：**不要直接删除**！
- 确认没用 → 标记为 `deprecated`
- 等待 30 天（观察期）
- 确认确实没人用 → 移入 `archive/`
- 归档 6 个月以上的草稿/临时 → 可考虑删除

> 原则：宁可多留，不误删。删除是不可逆的，归档还能恢复。

### Q6：分类体系会不会太复杂了？
**A**：理解上可能需要一点时间，但用起来很简单：
- 新人：只要知道 6 个大类型，按目录找就行
- 老员工：用熟了 10 秒就能定位
- 自动化：后续会有脚本辅助分类和检查

### Q7：我需要背下来所有规则吗？
**A**：不需要！
- 核心的 5-10 个规则记一下就行
- 忘了就查这份培训材料或风格指南
- 常用的模板可以存在 IDE snippets 里
---

## 七、快速参考卡

### 7.1 六个文档类型速记

```
参考（Reference）  →  查标准、查 API
解释（Explanation）→  看设计、懂原理
指南（How-to）     →  跟着做、一步步
教程（Tutorials）  →  学入门、零基础
报告（Reports）    →  看结果、看总结
元文档（Meta）     →  管文档、定规范
```

### 7.2 命名规范速记

```
✅ 全小写 + 连字符
✅ 语义化，一看就懂
✅ 英文优先
❌ 不用中文
❌ 不用下划线
❌ 不用特殊字符
```

### 7.3 Frontmatter 必填 5 字段

```yaml
---
title: 标题
type: reference|explanation|how-to|tutorials|reports|meta
domain: architecture|frontend|backend|data|ai|qa|project|product
version: vX.Y.Z
last_updated: YYYY-MM-DD
---
```

### 7.4 文档生命周期

```
草稿（draft）
    ↓ 内容完成，审核通过
活跃（active）  ← 大多数文档的状态
    ↓ 有新文档替代，功能变更
废弃（deprecated）
    ↓ 30 天观察期，确认无用
归档（archived）
```

### 7.5 找文档 3 步走

```
第 1 步：它是什么类型？   →  去对应目录
第 2 步：看 README 索引  →  快速浏览
第 3 步：全局搜索关键词  →  精确定位
```

---

## 附录：相关文档

- 📘 [文档分类体系规范](document-classification-system.md) — 完整的分类体系说明
- 📗 [文档风格指南与命名规范](document-style-guide.md) — 详细的格式和写作规范
- 📙 [文档整理工作流程](document-organization-workflow.md) — 全量整理的工作流程
- 📕 [死文档审计与归档管理](document-archive-management.md) — 归档策略详解
- 📊 [文档清单 CSV](document-inventory.csv) — 全量文档清单

---

> **培训完成后**：
> 1. 打开 docs/ 目录，熟悉一下结构
> 2. 找一份你熟悉的文档，看看它的分类对不对
> 3. 下次写文档时，记得用上 Frontmatter
> 4. 有问题找文档管理员或架构组
