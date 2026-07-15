# scripts/fix/ — 修复脚本分类

## 概述

本目录包含所有修复类脚本，用于自动修复代码违规、文档问题、配置错误等。

## 分类说明

### 架构违规修复
- `fix-layer-violations.ts` — 分层违规修复
- `fix-p0-violations.ts` — P0 违规自动修复

### 文档修复
- `fix-doc-refs.ts` — 文档引用修复
- `fix-cross-references.ts` — 交叉引用修复

### 代码质量修复
- `fix-typography-violations.ts` — 排版违规自动修复
- `fix-silent-fallback.ts` — 静默回退修复
- `auto-fix-jsdoc.ts` — JSDoc 自动修复

### 项目配置修复
- `update-package-json.ts` — 更新 package.json 路径
- `organize-scripts.ts` — 脚本组织工具

## 使用方式

```bash
# 运行单个修复脚本
tsx scripts/fix/fix-layer-violations.ts

# 通过 npm 脚本运行（推荐）
npm run fix:layerViolations
```

## 注意事项

> ⚠️ **重要**: 本目录中的脚本为逻辑分类，实际执行脚本位于 `scripts/` 根目录。根目录脚本包含内部相对路径引用，移动脚本会导致路径失效。

如需新增修复脚本，请在 `scripts/` 根目录创建文件，并在此 README 中添加条目。
