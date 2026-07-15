---
title: cleanup-schedule
code_version: 2.0.0

tier: core
---

---
title: docs/00-meta/cleanup-schedule.md
code_version: 2.0.0
tier: core
---

# 文档清理周期（CLEANUP_SCHEDULE）

> **定位**：定义文档/产物的保留与清理规则，消除「过程产物过度膨胀、无清理规则」缺口（P1-7）。
> **关联**：被 CI（`audit:docs`、文档门禁）引用；与 `governance.md` §4 保鲜规则一致。
> **版本**：v1.1.0（2026-07-12）

---

## 1. 清理对象与保留期

| 类别 | 路径 | 保留期 | 处置方式 | 责任人 |
|------|------|--------|----------|--------|
| 草稿（drafts） | `docs/drafts/*.md` | **7 天** | 超期自动删或转正；转正需移入对应目录并更新索引 | 作者 |
| 自动产物（generated） | `docs/reports/_generated/` | **30 天**（时间戳文件） | 自动覆盖，不入 VCS；同名文件保留最新 | CI |
| 审计门禁报告 | `docs/reports/audit/*.json` | **永久**（已 gitignore） | 仅本地，不上传；定期手动清理 | 维护者 |
| 过程报告 | `docs/reports/*.md` | **90 天** | 到期归档至 `07-archive/` 或删除 | 维护者 |
| Changelog | `docs/changelogs/YYYY-MM/*.md` | **永久保留** | 入 VCS，按月度目录归档；不主动删除 | 系统 |
| 归档（DEPRECATED） | `docs/07-archive/` | **6 个月** | 满期经双人确认后删除；保留清单见 `../README.md` | 架构组 |
| 中间文档（blueprints/plans） | `docs/blueprints/`、`docs/plans/` | **迭代结束** | 并入对应 spec 或删除；禁止长期空置 | 作者 |
| 临时截图 | `docs/implementation/*.png` | **1 个月** | 如无对应 `.md` 说明文档，直接删除 | 维护者 |
| 体检报告 | `docs/00-meta/文档体系体检报告-v9.md` | **保留最近 3 版** | 旧版归档至 `07-archive/`，新版覆盖 | 维护者 |

---

## 2. 清理触发条件

### 2.1 时间触发（自动）

| 周期 | 触发动作 | 执行方式 |
|------|---------|----------|
| 每日 | 扫描 `docs/drafts/` 超期文件 | 本地脚本 `scripts/cleanup-drafts.sh`（可选） |
| 每月 1 日 | 生成 `docs/00-meta/freshness-report-YYYY-MM.md` | GitHub Actions（T10 待配置） |
| 每季度 | 复核 `07-archive/` 满期文档，发起删除审批 | 人工 |

### 2.2 事件触发（手动）

- **迭代发布**：`blueprints/` 和 `plans/` 内容应合并至对应 spec 或删除。
- **架构评审**：`reports/` 中一次性审计报告，评审后决定是否归档。
- **文档体检**：每次体检后，清理本次标记为「过期」的文档。

---

## 3. 归档流程（SOP）

```
发现过期文档
    │
    ▼
[1] 标记 ── 文件名前缀 `DEPRECATED_` + 头部添加 `> **状态**：已归档，保留至 YYYY-MM-DD`
    │
    ▼
[2] 迁移 ── 移入 `docs/07-archive/`，登记至 `../README.md` 归档清单
    │
    ▼
[3] 更新引用 ── 搜索全仓库引用该文档的路径，更新至新位置或标记为已归档
    │
    ▼
[4] 双人确认 ── 6 个月满期后，需 2 人确认无价值方可删除（GitHub PR 审批）
    │
    ▼
[5] 删除 ── 从 Git 历史移除（`git rm`），登记至 `../archive/deletion-log.md`
```

**禁止**：直接删除活跃目录中的文档而不经标记→迁移流程。

---

## 4. 自动隔离（.gitignore）

以下已加入 `.gitignore`，确保不污染版本库：
- `docs/reports/_generated/`（自动产物）
- `docs/.ai-index/`（AI 缓存，已保留核心索引）
- `releases/`（发布包/zip）
- `coverage/`、`dist*/`、`.playwright-mcp/` 等既有忽略

---

## 5. 验收与检查

- [ ] 清理规则文件存在且被 CI 引用。
- [ ] 核心文档区（`docs/` 根 + 各子类）无自动产物、无过期草稿。
- [ ] `docs/drafts/` 文件数 ≤ 10 份，超期率为 0%。
- [ ] `docs/reports/` 中无超过 90 天的未归档 `.md` 报告。

---

> **相关文档**：`governance.md` §4 保鲜规则、`../README.md` 归档清单、`docs/00-meta/文档体系体检报告-v9.md`
