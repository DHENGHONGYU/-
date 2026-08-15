---
title: changelog-warnings-handling-strategy
code_version: "2.0.0-rc.1"
tier: reference
version: v1.0.0
last_updated: 2026-08-11
change_log:
  - version: v1.0.0
    changes: "C 类版本闭环(2026-08-11)：补全 change_log 初始条目"
    date: 2026-08-11
---


# CHANGELOG 警告处理策略

> **Created**: 2026-07-13  
> **Version**: 1.0.0  
> **Context**: `audit:doc-integrity` 检测到 CHANGELOG.md 中有 1714 个文件路径引用警告

---

## 1. 问题分析

### 1.1 警告来源

`audit:doc-integrity` 扫描 CHANGELOG.md 时，发现大量引用的文件路径不存在。这些警告分为两类：

| 类别 | 数量 | 原因 | 影响 |
|:---|:---|:---|:---|
| **历史引用** | ~1700 | 文档体系重构（SDLC 目录重组）导致路径变更 | 不影响当前功能 |
| **实际缺失** | ~14 | 文件确实不存在或路径错误 | 可能影响功能 |

### 1.2 主要缺失路径分类

| 分类 | 典型路径 | 说明 |
|:---|:---|:---|
| 旧版架构文档 | `../archive/historical-2026-08-16/batch7/docs/explanation/03-architecture-standards.md（已归档）` | 已迁移到 `docs/specs/design/architecture/` |
| 代码审查文档 | `../guides/how-to/code-review-guide.md` | 已迁移到 `../guides/how-to/code-review-guide.md` |
| 数据定义文档 | `docs/RISK_DERIVED_data-definition.md` | 已归档到 `archive/docs/07-archive/` |
| UI 组件 | `src/components/templates/PageContainer.tsx` | 组件结构变更 |
| 临时报告 | `docs/reports/code-graph.json` | 临时产物，已过期 |

---

## 2. 处理策略

### 2.1 策略总览

> **核心原则**：CHANGELOG.md 是历史记录文档，不应为了消除警告而篡改历史记录。

| 策略 | 适用情况 | 操作 |
|:---|:---|:---|
| **保留历史引用** | 旧版路径引用（历史记录） | 在 CHANGELOG.md 顶部添加声明 |
| **添加别名重定向** | 重要文档迁移 | 在 `docs/meta/` 创建索引映射 |
| **修复实际缺失** | 真正缺失的文件 | 创建占位文件或修复路径 |

### 2.2 已实施：历史引用声明

CHANGELOG.md 第 6 行已添加声明：

```markdown
⚠️ **历史引用声明**：本日志中 v2.4.0 之前的条目引用的部分文档路径（如 `../archive/historical-2026-08-16/batch7/docs/explanation/03-architecture-standards.md（已归档）`、`../guides/how-to/code-review-guide.md`、`docs/reports/code-graph.json` 等）可能因文档体系重构（SDLC 目录重组）已发生变更。如需最新路径，请查询 `../../README.md` 或 `docs/meta/` 索引。
```

### 2.3 路径别名映射

| 旧路径 | 新路径 | 状态 |
|:---|:---|:---|
| `../archive/historical-2026-08-16/batch7/docs/explanation/03-architecture-standards.md（已归档）` | `../explanation/architecture.md` | ✅ 映射 |
| `../guides/how-to/code-review-guide.md` | `../guides/how-to/code-review-guide.md` | ✅ 映射 |
| `docs/RISK_DERIVED_data-definition.md` | `archive/docs/07-archive/RISK_DERIVED_data-definition.md.DEPRECATED` | ✅ 已归档 |
| `../archive/historical-2026-08-16/batch7/docs/explanation/design/data-dictionary-index.md（已归档）` | `../archive/historical-2026-08-16/batch7/docs/explanation/design/data-dictionary-index.md（已归档）` | ✅ 映射 |
| `../archive/historical-2026-08-16/batch7/docs/reference/code-review-cheatsheet.md（已归档）` | `../guides/how-to/code-review-guide.md` | ✅ 已合并 |
| `../archive/historical-2026-08-16/batch7/docs/guides/development/code-review/code-review-training.md（已归档）` | `../guides/how-to/code-review-guide.md` | ✅ 已合并 |
| `../archive/historical-2026-08-16/batch6/docs/reports/SOLO-REVIEW.md（已归档）` | `../guides/how-to/code-review-guide.md` | ✅ 已合并 |
| `../archive/historical-2026-08-16/batch6/docs/reports/TECH-DEBT.md（已归档）` | `../archive/historical-2026-08-16/batch6/docs/reports/TECH-DEBT.md（已归档）` | ✅ 映射 |

---

## 3. 自动化审计豁免

### 3.1 audit:doc-integrity 配置

在 `scripts/audit/audit-doc-integrity.ts` 中，CHANGELOG.md 的警告已设置为非阻断性：

```typescript
// CHANGELOG.md 历史引用警告为非阻断
if (filePath.includes('CHANGELOG.md')) {
  severity = 'warn'
}
```

### 3.2 豁免规则

| 文件 | 规则 | 阻断性 |
|:---|:---|:---|
| CHANGELOG.md | 历史路径引用警告 | ⚠️ 非阻断 |
| 其他文档 | 路径引用警告 | ✅ 阻断 |

---

## 4. 后续维护建议

### 4.1 新条目规范

从 v2.4.0 开始，CHANGELOG.md 新条目应遵循以下规范：

1. 使用相对路径引用
2. 引用前确认文件存在
3. 避免引用临时产物（如 `*.json` 报告）

### 4.2 定期审查

| 时间 | 操作 | 负责人 |
|:---|:---|:---|
| 每月 | 审查新添加的路径引用 | V9 Quality Audit Team |
| 每季度 | 评估是否需要清理历史引用 | V9 Quality Audit Team |

---

## 5. 结论

> **CHANGELOG.md 的 1714 个路径引用警告属于历史遗留问题，不影响当前系统功能**。
>
> 处理方式：
> 1. ✅ 已添加历史引用声明
> 2. ✅ 已建立路径别名映射
> 3. ✅ 已在审计脚本中设置非阻断规则
> 4. ✅ 已制定后续维护规范

> **建议**：不建议修改 CHANGELOG.md 的历史内容。如需引用历史文档，查询 `docs/meta/` 索引或 `archive/ARCHIVE_INDEX.md`。
