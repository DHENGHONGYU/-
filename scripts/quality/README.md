# scripts/quality/ — 质量脚本分类

## 概述

本目录包含所有质量类脚本，用于代码质量评估、复杂度分析、规则检测等。

## 分类说明

### 复杂度分析
- `complexity-scan.ts` — 复杂度扫描
- `measure-complexity-now.ts` — 实时复杂度测量

### 质量配置与审计
- `codeQualityAudit.cjs` — 代码质量综合审计
- `quality-config.ts` — 质量配置

### ESLint 插件
- `eslint-plugin-no-hardcoded-colors.js` — 禁止硬编码颜色 ESLint 插件

## 使用方式

```bash
# 运行单个质量脚本
tsx scripts/quality/complexity-scan.ts

# 通过 npm 脚本运行（推荐）
npm run complexity-scan
```

## 注意事项

> ⚠️ **重要**: 本目录中的脚本为逻辑分类，实际执行脚本位于 `scripts/` 根目录。根目录脚本包含内部相对路径引用，移动脚本会导致路径失效。

如需新增质量脚本，请在 `scripts/` 根目录创建文件，并在此 README 中添加条目。
