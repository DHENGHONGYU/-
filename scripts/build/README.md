# scripts/build/ — 构建脚本分类

## 概述

本目录包含所有构建类脚本，用于构建项目产物、索引、报告等。

## 分类说明

### 索引构建
- `build-ai-memory-index.ts` — 构建 AI 记忆索引

### 报告构建
- `build-health-report.ts` — 构建健康报告

### 部署工具
- `deploy-rectification-toolkit.ts` — 整改工具包部署

## 使用方式

```bash
# 运行单个构建脚本
tsx scripts/build/build-health-report.ts

# 通过 npm 脚本运行（推荐）
npm run build:health
```

## 注意事项

> ⚠️ **重要**: 本目录中的脚本为逻辑分类，实际执行脚本位于 `scripts/` 根目录。根目录脚本包含内部相对路径引用，移动脚本会导致路径失效。

如需新增构建脚本，请在 `scripts/` 根目录创建文件，并在此 README 中添加条目。
