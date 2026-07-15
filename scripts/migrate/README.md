# scripts/migrate/ — 迁移脚本分类

## 概述

本目录包含所有迁移类脚本，用于数据迁移、文档迁移、代码迁移等。

## 分类说明

### 文档结构迁移
- `migrate-docs-structure.ts` — docs/ 目录结构迁移

### 数据迁移
- `p1-1-migrate.py` — P1-1 数据迁移

## 使用方式

```bash
# 运行单个迁移脚本
tsx scripts/migrate/migrate-docs-structure.ts
```

## 注意事项

> ⚠️ **重要**: 本目录中的脚本为逻辑分类，实际执行脚本位于 `scripts/` 根目录。根目录脚本包含内部相对路径引用，移动脚本会导致路径失效。

如需新增迁移脚本，请在 `scripts/` 根目录创建文件，并在此 README 中添加条目。
