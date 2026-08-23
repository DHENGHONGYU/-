---
skill_id: V9-SKILL-CROSSINDEX
name: "cross-index-governance"
description: "文档交叉索引治理：批量补全 doc_id/related_docs/covers_code/covers_docs 等字段，建立文档↔代码↔测试↔SKILL 四向交叉索引的六阶段方法论（基线→文档间→测试→代码→SKILL→审计运维），含字节级编码安全、路径解析修复、写前删后、收敛验证循环。Invoke when 建立文档交叉索引、批量补全 frontmatter、孤儿文档扫描、未解析链接修复、或文档生命周期治理时。"
version: v2.0.0
last_updated: 2026-08-23
change_log:
  - version: v2.0.0
    changes: "基于 S 级 Skill 5 段式骨架模板 [_SKILL-TEMPLATE.md](.agents/skills/_SKILL-TEMPLATE.md) 物理化迁移：自用户级 ~/.trae-cn/skills/cross-index-governance 归位项目单一物理源（v2.0.0 实战重构版：六阶段方法论+编码安全+决策树）"
    date: 2026-08-23
mandatory: true
---

# 文档交叉索引治理（Cross-Index Governance） — v2.0.0

> **核心原则**：批量处理 + 增量校验 + 备份保护 + 渐进式推进 + **字节级编码安全** + **收敛验证循环**。
> 定位：把文档交叉索引治理工作流标准化为可复用技能，支持批量处理 + 校验测试 + 回滚保护。

---

## 一、触发条件

| 触发场景 | 调用阶段 |
|---|---|
| 建立文档交叉索引 | 全流程 |
| 批量补全 doc_id | 阶段 1 |
| 扫描孤儿文档 / 修复未解析链接 | 阶段 2–3 |
| 补全测试-文档 / 代码-文档关联 | 阶段 3 / 4 |
| 统一 SKILL 体系 covers_docs | 阶段 5 |
| 生成文档健康度报告 / 清理归档 | 阶段 6 / 4–5 |

**协作**：文档编写规范 → `doc-management-principles`；编码安全 → `doc-encoding-remediation`。

---

## 二、前置检查（MANDATORY）

任何阶段执行前必须完成：
1. `git status --short` + 确认无未提交变更（或先 stash）
2. 备份 `docs/` 至 `docs-backup-<timestamp>/`
3. 创建工作分支（推荐 worktree 隔离）
4. 基线校验：`npm run doc:gate` 输出留档作对比基线

**安全规则（贯穿全程）**：① Write-Before-Delete（先写目标再删源）② UTF-8 无 BOM ③ DryRun 先行 ④ 批量操作前先 commit ⑤ 路径解析必须有 isExternal 守卫 ⑥ 链接匹配前剥离 `#anchor` ⑦ 文档引用一律 `[text](path.md)` 格式（backtick 路径不被关系构建器识别）。

---

## 三、阶段化 SOP（六阶段）

### 阶段 1：基线建设（P0）
- GOVERNANCE.md 与 `docs/` 实际目录对齐（重要文档用 Markdown 链接，非 backtick）
- 批量补全 `doc_id`（字节级编码安全脚本，每批 ≤ 50，处理后必校验）
- `archive/` 下文档 status 一律 `archived`
- 创建 `master-index.json`（扫描 .md 解析 frontmatter，聚合 registry/tag-taxonomy，派生 referenced_by）
- 校验：`npm run doc:gate` + `tsc:prod` + `lint`

### 阶段 2：文档间索引（P0）
- 构建 `relation-index.json`：**UTF-8 编码**（ASCII 会让中文文件名乱码、隐藏 100+ 未解析链接）、**isExternal 守卫**（防 `docs/docs/` 双前缀）、**剥离 `#anchor`** 再路径匹配
- 分析未解析链接（分类：external / nonexistent / json_file / typos / query_params / chinese）
- 孤儿文档检测（按 tier 分类：important / reference / standard / archive）

### 阶段 3：测试-文档索引（P1）
测试文件头部 JSDoc：`@test_id` + `@covers_docs` + `@module`。优先级：important 100% / reference 50% / standard 30%。

### 阶段 4：代码-文档索引（P1）
`src/` 文件 JSDoc 新增 `@doc V9-DOC-xxx`；CI 强制：新增/修改 src 文件必须含 `@doc`。

### 阶段 5：SKILL-文档关联（P2）
SKILL frontmatter `covers_docs` 仅含有效 V9-DOC-xxx；扫描 `.agents/skills/` 与 `plugins/`。

### 阶段 6：审计与运维（P3）
生成健康报告（历史对比：链接解析率、孤儿数、覆盖率）；**收敛验证循环**：Clean → Rebuild → Analyze → Fix → Repeat，直到指标稳定。

### 决策树（速查）

- **孤儿**：active 且 tier 重要 → GOVERNANCE.md 加交叉引用；active 但低层 → 保留为有意孤儿；archived/draft → 移入 `_pending-review/`
- **未解析链接**：外部 URL → 跳过；解析后存在 → 查编码/anchor/路径格式；不存在但合法跳出 docs/ → 标 isExternal；否则 → 清理队列
- **文件移动**：写目标 → 更新 frontmatter（status=deprecated + moved_from）→ 最后删源

### 批量处理十原则

每批 ≤50 / 批后必校验必 commit / worktree 隔离 / DryRun 先行 / 断点续传（`-StartIndex`）/ 按 tier 切片 / 写前删后 / UTF-8 无 BOM / 基线对比 / 回滚预案（单批 `reset HEAD~1`、单阶段 `reset <hash>`、全量恢复备份）。

---

## 四、陷阱与经验教训

| # | 陷阱 | 后果 | 规避 |
|---|------|-----|-----|
| 1 | ASCII 编码读写 | 中文文件名乱码，隐藏 101 个 `docs/docs/` 链接 + 45 孤儿 | 全程 UTF-8（PowerShell 5.1 用 `UTF8Encoding($false)`） |
| 2 | 栈式路径解析无守卫 | 跳出 `docs/` 根，创建无效 `docs/docs/` 路径 | isExternal 守卫（实测减少 106 个未解析链接） |
| 3 | 带 `#anchor` 直接匹配 | 链接判失效 | 匹配前剥离 `#.*$` |
| 4 | 移动脚本先删后写 | 9 个文件丢失（靠 git/backup 恢复） | Write-Before-Delete |
| 5 | backtick 路径当链接 | 关系构建器不识别，产生 3 个 important 孤儿 | 转标准 Markdown 链接 |
| 6 | 单次大爆炸批处理 | 变更过大无法回滚 | ≤50/批 + 每批 commit |

---

## 五、完成交付物清单

| 产出 | 位置 | 阶段 | 验证 |
|---|---|---|---|
| GOVERNANCE.md 对齐 | `docs/00-meta/` | 1 | `doc:gate` 0 P0 |
| master-index.json | `docs/00-meta/ai-index/` | 1 | 字段完整 |
| relation-index.json | `docs/00-meta/ai-index/` | 2 | double_docs=0, file_url=0 |
| test-doc-index.json / code-doc-index.json | 同上 | 3/4 | 覆盖率达标（95%/全部） |
| skill-doc-index.json | 同上 | 5 | 全部 SKILL 有 covers_docs |
| 月度健康度报告 + 治理总结 | `docs/reports/audit/` | 6 | 含历史对比 |
| 收敛验证通过 | — | 全程 | 正向覆盖率 ≥95%、逆向每实体 ≥1 引用、孤儿清单为零 |

**配套脚本**：`scripts/cross-index/*.ps1`（build-master-index / build-doc-relations / audit-orphan-docs / analyze-unresolved-links / move-pending-docs / generate-health-report 等 12 个）。
