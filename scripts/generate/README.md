# scripts/generate/ — 生成脚本分类

## 概述

本目录包含所有生成类脚本，用于生成代码、文档、报告、配置等。

## 分类说明

### 设计令牌生成
- `generate-tokens.ts` — 生成设计令牌 CSS

### 报告生成
- `generate-tech-debt-report.ts` — 生成技术债务报告
- `generate-pdf-report.ts` — 生成 PDF 报告
- `generate-rectification-pdf.ts` — 生成整改报告 PDF

### 文档生成
- `generate-doc-list-simple.ts` — 生成简单文档更新清单
- `generate-doc-update-list.ts` — 生成文档更新清单（增强版）
- `generate-ah-index-docs.ts` — 生成 AH 索引文档

### 可视化生成
- `generate-store-graph.ts` — 生成 Store 依赖图

## 使用方式

```bash
# 运行单个生成脚本
tsx scripts/generate/generate-tokens.ts

# 通过 npm 脚本运行（推荐）
npm run generate:tokens
```

## 注意事项

> ⚠️ **重要**: 本目录中的脚本为逻辑分类，实际执行脚本位于 `scripts/` 根目录。根目录脚本包含内部相对路径引用，移动脚本会导致路径失效。

如需新增生成脚本，请在 `scripts/` 根目录创建文件，并在此 README 中添加条目。
