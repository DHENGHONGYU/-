---
title: README
tier: reference
code_version: 2.0.0
status: archived
referenced_by: [V9-DOC-META-000, V9-DOC-PROJ-176]
---


# 归档目录（07-archive）

> **定位**：存放已废弃、过时或不再维护的文档和资源。

## 保留期限

| 类型 | 保留期限 | 清理规则 |
|------|----------|----------|
| **版本归档**（`00-meta-archive-YYYY-MM-DD/`） | 6 个月 | 超过期限自动清理 |
| **废弃文档**（`deprecated-docs/`） | 3 个月 | 标记废弃后 3 个月移除 |
| **临时文件**（`temporary/`） | 7 天 | 任务完成后立即清理 |
| **历史版本**（`old-versions/`） | 永久 | 重要里程碑版本保留 |

## 目录结构

```
07-archive/
├── 00-meta-archive-YYYY-MM-DD/    # 定期归档快照
│   ├── ai-index/                   # AI索引归档
│   ├── deprecated-docs/            # 废弃文档
│   └── *.md                        # 其他归档文档
├── README.md                       # 本文件
└── deletion-log.md                 # 删除记录
```

## 归档流程

1. **标记废弃**：在原文件头部添加 `deprecated: true` frontmatter
2. **迁移至归档**：移动至 `07-archive/` 对应子目录
3. **更新引用**：在 `../reference/data-dictionary-index.md` 或相关索引中标记
4. **记录日志**：在 `deletion-log.md` 中记录删除原因和日期

## 清理触发条件

- 手动执行：运行 `npm run file:clean`
- CI 自动：每月 1 号执行 `docs-cleanup` workflow
- 阈值触发：`deprecated-docs/` 超过 100 个文件时触发

## 注意事项

- **禁止直接删除**：必须经过归档流程
- **保留证据**：重大变更的历史版本应保留
- **更新索引**：归档后必须更新相关索引文档