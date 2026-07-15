# scripts/docs-tool/ — 文档工具脚本分类

## 概述

本目录包含所有文档工具类脚本，用于文档管理、验证、同步、更新等。

## 分类说明

### 文档验证
- `check-docs.ts` — 文档检查
- `daily-doc-validation.ts` — 每日文档验证
- `doc-freshness-score.ts` — 文档新鲜度评分
- `doc-freshness-alert.ts` — 文档过期预警
- `doc-version-check.ts` — 文档版本检查

### 文档同步与更新
- `doc-auto-updater.ts` — 文档自动更新器
- `doc-cross-ref-sync.ts` — 文档交叉引用同步
- `doc-update-trigger.ts` — 文档更新触发器
- `doc-version-history.ts` — 文档版本历史
- `doc-arch-version-compare.ts` — 架构版本对比

### 文档生成
- `doc-dict-ast-extract.ts` — 文档字典 AST 提取
- `llm-doc-generator.ts` — LLM 辅助文档更新生成

### 文档迁移
- `migrate-doc-categories.ts` — 文档分类迁移
- `sync-doc-categories.ts` — 文档分类同步

## 使用方式

```bash
# 运行单个文档工具
tsx scripts/docs-tool/daily-doc-validation.ts

# 通过 npm 脚本运行（推荐）
npm run daily-doc:validate
```

## 注意事项

> ⚠️ **重要**: 本目录中的脚本为逻辑分类，实际执行脚本位于 `scripts/` 根目录。根目录脚本包含内部相对路径引用，移动脚本会导致路径失效。

如需新增文档工具脚本，请在 `scripts/` 根目录创建文件，并在此 README 中添加条目。
