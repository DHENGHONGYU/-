# V9 文档治理宪法（GOVERNANCE）

> **地位**：本文件是 `docs/` 的最高治理规则（仅次于根 `AGENTS.md` 的工程契约）。所有文档相关操作以此为准。
> **版本**：v1.0.0 ｜ **生效**：2026-07-12 ｜ **owner**：docs 治理组 / AI 工程

---

## 1. 设计原则

| 原则 | 说明 |
|------|------|
| **Single Source of Truth（单一真相源）** | 每个事实/字段/接口只在一处定义，其余引用不副本。数据定义见 `standards/DATA_DICTIONARY_INDEX.md`。 |
| **可发现性优先** | 任何文档必须能被 `docs/README.md` 在 1 步内定位；禁止孤岛文件。 |
| **Docs-as-Code** | 文档与代码同等对待，纳入 Husky 预提交门禁（`audit:docs` 等）。 |
| **保鲜优于堆积** | 文档随代码变更同步更新；过期文档进 `07-archive/`，不长期占用活跃区。 |
| **AI 友好** | 结构清晰、路径稳定、含 Frontmatter，便于 LLM/检索索引（`docs/.ai-index/`）。 |

---

## 2. 目录与命名规范

### 2.1 归类（A–H 八类，详见 `README.md`）
所有文档落入对应子类目录；无法归类的进 `docs/misc/` 并登记。

### 2.2 命名
- **格式**：`kebab-case`，英文/数字优先（如 `token-usage-cookbook.md`）。
- **数据定义**：统一 `*-data-definition.md`，并由 `DATA_DICTIONARY_INDEX.md` 索引。
- **归档**：`DEPRECATED_*.md` 仅允许存在于 `07-archive/`。
- **自动产物**：一律落 `reports/_generated/`，不进人工维护区。

### 2.3 禁止项
- 🚫 在 `docs/` 根散落 `.md`（索引/宪法/计划类除外，且须回链 README）。
- 🚫 跨目录复制同一份内容（引用代替副本）。
- 🚫 修改 `AGENTS.md` 分层契约与颜色令牌体系（除非整改项明确包含）。

---

## 3. 文档生命周期（DoD）

| 阶段 | 动作 | 验收（Definition of Done） |
|------|------|----------------------------|
| **创建** | 落入正确子类 + 回链 README + 加 Frontmatter | README 能定位；含 `title/status/owner` |
| **更新** | 同步代码变更 + 跑 `audit:docs` | 文档与代码引用一致，无版本漂移 |
| **过期** | 标记 `DEPRECATED_` + 迁入 `07-archive/` | 活跃目录 0 份 DEPRECATED |
| **删除** | 归档满 6 月 + 双人确认 | 仅从 `07-archive/` 移除 |

---

## 4. 保鲜规则（Freshness）

- **代码-文档同步**：修改 `src/` 中影响文档描述的模块，必须同步更新对应文档，并由 `audit:docs` 拦截漂移。
- **索引一致性**：新增/移动文档后，本 README 与相关类目**当次提交内**同步。
- **定期体检**：每月跑《文档体系体检报告》检索命令，复核孤儿率（≤5%）、重复数（0）、错位目录（0）。
- **清理周期**（`CLEANUP_SCHEDULE.md`）：drafts 7 天 / `_generated` 30 天 / changelogs 永久。

---

## 5. 质量门禁联动

| 门禁 | 作用 | 失败处置 |
|------|------|----------|
| `audit:docs` | 文档-代码同步校验 | 禁止提交，修复漂移 |
| `audit:layers` / `audit:atomic` | 分层/原子边界 | 禁止提交 |
| `lint:colors` | 颜色令牌零硬编码 | 禁止提交 |
| `audit:tokens` | 设计令牌同步 | 禁止提交 |
| `docs/audit-path-match`（P2 新增） | 新增 .md 目录-内容匹配 | Husky pre-commit 拦截 |

---

## 6. 责任矩阵

| 角色 | 职责 |
|------|------|
| docs 治理组 / AI 工程 | 索引、宪法、归档、清理、二级子类、.ai-index |
| 架构组 | overview / cabins-overview / 服务目录 / ADR |
| pages 各舱 owner | 舱 spec |
| services 各子域 owner | 子域接口契约 |
| 设计系统 | 令牌指南 / 美学 / a11y-i18n |
| 工程效能 / Husky | 产物隔离 / .gitignore / 文档门禁 CI |

---

## 7. 与既有契约的关系

- 本文件**不替代** `AGENTS.md`（工程分层契约），仅在其之上补充文档治理维度。
- 本文件**统辖** `README.md`、`00-meta/*`、`CLEANUP_SCHEDULE.md`、`DATA_DICTIONARY_INDEX.md` 等治理文档。
