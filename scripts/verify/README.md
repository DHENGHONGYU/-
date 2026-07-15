# scripts/verify/ — 验证脚本分类

## 概述

本目录包含所有验证类脚本，用于验证系统功能、数据一致性、接口契约等。

## 分类说明

### 路由验证
- `verify-all-routes.ts` — 全路由验证
- `verify-design-tokens.ts` — 设计令牌验证

### 里程碑验证
- `verify-m1.ts` — M1 里程碑验收（RAG 向量检索）
- `verify-m2-m3.ts` — M2/M3 里程碑验收（校验关/v6 因子）

### 输出与管道验证
- `verify-pipeline-output.ts` — 流水线输出验证
- `verify-tools.ts` — 工具链验证

### 数据验证
- `validate-data-blueprint.ts` — 数据蓝图验证
- `validate-data-consistency.ts` — 数据一致性验证
- `validate-json.ts` — JSON Schema 验证
- `validate-acl-impact.ts` — ACL 影响验证

## 使用方式

```bash
# 运行单个验证
tsx scripts/verify/verify-all-routes.ts

# 通过 npm 脚本运行（推荐）
npm run verify:allRoutes
```

## 注意事项

> ⚠️ **重要**: 本目录中的脚本为逻辑分类，实际执行脚本位于 `scripts/` 根目录。根目录脚本包含内部相对路径引用，移动脚本会导致路径失效。

如需新增验证脚本，请在 `scripts/` 根目录创建文件，并在此 README 中添加条目。
