---
title: proj-195-vs-proj-260-diff
type: report
domain: project
tier: reference
status: active
maintainer: V9 Architecture Team
summary: "PROJ-195 与 PROJ-260 指向的两个同名文件差异对比报告——正文 100% 重复，仅 frontmatter 与 1 处命令冲突（type-check 失效）"
tags: [project, registry, diff, duplicate, conflict, adjudication]
version: v1.0.0
last_updated: 2026-08-13
code_version: "2.0.0-rc.1"
doc_id: V9-DOC-REP-PROJDUP-001
related_docs: [V9-DOC-REP-REGPROJ-001]
change_log:
  - version: v1.0.0
    changes: Initial version established
    date: 2026-08-13
---

# PROJ-195 vs PROJ-260 差异对比报告

> **生成时间**：2026-08-13
> **比对对象**：
> - 文件 A（PROJ-260）：[v9-l2状态层补齐路线图.md](../../explanation/v9-l2状态层补齐路线图.md)（`docs/explanation/`）
> - 文件 B（PROJ-195）：[v9-l2状态层补齐路线图.md](../../reference/v9-l2状态层补齐路线图.md)（`docs/reference/`）

---

## 1. 结论速览

两个文件是**同一文档的两份拷贝**：**正文 §1-§8 逐行 100% 重复**，仅存在 5 处差异，其中 **4 处为 frontmatter 元数据，1 处为真实内容冲突**（B 版的类型检查命令已失效）。

| 类别 | 数量 | 明细 |
|------|------|------|
| 正文重复 | 100% | §1 现状评估 ~ §8 执行进展 全部一致 |
| frontmatter 元数据差异 | 3 | `type`、`tags`、`doc_id` |
| 真实内容冲突 | 1 | §5 验收标准的 npm 命令 |
| 表面冲突（实际等价） | 1 | §8.4 的相对路径 |

---

## 2. 逐处差异

### 2.1 frontmatter（元数据层）

| 字段 | 文件 A（explanation / PROJ-260） | 文件 B（reference / PROJ-195） | 性质 |
|------|--------------------------------|-------------------------------|------|
| `type` | `explanation` | `reference` | 元数据 |
| `tags` | `[project, plan, explanation]` | `[project, plan, reference]` | 元数据 |
| `doc_id` | `V9-DOC-PROJ-260` | `V9-DOC-PROJ-195` | 元数据（重复根因） |

> 其余 frontmatter（title / domain / phase / tier / status / maintainer / summary / version / last_updated / code_version / change_log）两文件**完全一致**。

### 2.2 ⚠️ 真实内容冲突（§5 验收标准，第 1 行）

| 文件 | 命令 | 有效性 |
|------|------|--------|
| A（explanation） | `npm run tsc:prod` 或 `npx tsc --noEmit` | ✅ **有效**（package.json 存在 `tsc:prod`） |
| B（reference） | `npm run type-check` 或 `npx tsc --noEmit` | ❌ **失效**（package.json **无** `type-check` 脚本） |

> **判定**：B 版引用了不存在的 npm 脚本，属于过期残留；A 版命令正确。若保留 B，必须将该行改为 `tsc:prod`。

### 2.3 表面冲突（实际等价，§8.4 末尾相对路径）

| 文件 | 写法 | 解析目标 |
|------|------|----------|
| A（explanation） | `../reference/completeness-profile.md` | `docs/reference/completeness-profile.md` ✅ 存在 |
| B（reference） | `./completeness-profile.md` | `docs/reference/completeness-profile.md` ✅ 存在 |

> **判定**：两者因所在目录不同而相对路径写法不同，**最终都指向同一文件 `docs/reference/completeness-profile.md`，均有效，无需修改**。

---

## 3. 重复定性

这是典型的**文档迁移残留**：同一「V9 L2 状态层补齐路线图」在 `reference/` 与 `explanation/` 各存一份，正文全同，仅靠 `doc_id`（195 / 260）区分。二者都不在当前注册表中（均属遗漏登记项），进一步佐证是未归档的重复副本。

---

## 4. 裁定建议（供人工决策）

| 方案 | 操作 | 适用情形 |
|------|------|----------|
| **方案一（推荐）** | 保留一个文件 + 一个 doc_id，删除另一个 | 文档语义单一，无需双份 |
| 方案二 | 两个都保留，但各归其位（如一个做 reference、一个做 explanation 简版） | 若后续确实要拆分为「路线图」与「说明」两个角色 |

若采用**方案一**，具体取舍依据：

- **保留 A（explanation / PROJ-260）**：其 `tsc:prod` 命令正确，零改动即可用；但需在 registry 登记 `PROJ-260`，删除 B 及其 `PROJ-195`。
- **保留 B（reference / PROJ-195）**：需先修正 §5 的失效命令（`type-check` → `tsc:prod`）再登记 `PROJ-195`，删除 A。
- `reference/` 通常承载可检索的规范性文档，路线图类归 reference 也合理；`explanation/` 侧重原理阐述。

> **决定性动作（无论保留哪个）**：删除另一份 + 修正被保留文件的 `type-check` 失效命令（如保留 B 时）+ 在注册表登记保留方 doc_id。

---

## 5. 后续动作清单

- [ ] 人工裁定保留 A 或 B（建议方案一）
- [ ] 删除另一份重复文件
- [ ] 若保留 B，修正 `npm run type-check` → `npm run tsc:prod`
- [ ] 在 [doc-id-registry.md](../meta/doc-id-registry.md) 登记保留方的 doc_id，并更新 [PROJ 待补齐清单](registry-fill-checklist-V9-DOC-PROJ.md)（#17/#39 二选一）
- [ ] 运行 `npm run audit:docs` 复核
