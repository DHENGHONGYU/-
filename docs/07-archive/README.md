# 文档归档目录

> **版本**: v1.0.0 | **日期**: 2026-07-13

---

## 目录结构

```
07-archive/
├── README.md                    # 本文件
├── deletion-log.md              # 删除日志
├── deprecated-docs/             # DEPRECATED 文档
├── old-versions/                # 旧版本文档
└── temporary/                   # 临时归档
```

---

## 归档规则

### 1. DEPRECATED 文档
- 超过 90 天未更新且内容已过时的文档
- 被新版本完全替代的文档
- 文件名前缀: `DEPRECATED_`

### 2. 旧版本文档
- 文档更新后被替代的旧版本
- 保留完整历史记录便于追溯
- 文件名格式: `{original-name}_v{version}.md`

### 3. 临时归档
- 待审查确认的文档
- 临时存放期限: 30 天
- 超过期限自动移至 deprecated-docs/

---

## 归档流程

```
1. 标记: 文件名前缀 DEPRECATED_ + 头部添加归档信息
2. 迁移: 移入 docs/07-archive/ 对应子目录
3. 更新引用: 搜索全仓库引用，更新至新位置或标记为已归档
4. 双人确认: 6 个月满期后，需 2 人确认无价值方可删除
5. 删除: git rm，登记至 deletion-log.md
```

---

## 归档信息格式

所有归档文档头部必须包含以下 frontmatter:

```yaml
---
status: deprecated
archived_at: 2026-07-13
archived_by: system
original_path: docs/02-design/old-document.md
replaced_by: docs/02-design/new-document.md
reason: 内容已被新版本完全替代
---
```

---

## 保留期限

| 归档类型 | 保留期限 | 处置方式 |
|----------|----------|----------|
| DEPRECATED | 6 个月 | 双人确认后删除 |
| 旧版本 | 1 年 | 自动删除 |
| 临时归档 | 30 天 | 自动移至 DEPRECATED |

---

## 检索命令

```bash
# 查找所有归档文档
find docs/07-archive -name "*.md"

# 查找特定文档的历史版本
find docs/07-archive/old-versions -name "*data-dictionary*"

# 查看删除日志
cat docs/07-archive/deletion-log.md
```
