# scripts/monitor/ — 监控脚本分类

## 概述

本目录包含所有监控类脚本，用于系统健康监控、异常检测、趋势分析等。

## 分类说明

### 系统健康监控
- `system-health-dashboard.ts` — 系统健康仪表盘
- `system-check-loop.ts` — 系统检查循环

### 异常检测
- `anomaly-detector.ts` — 异常检测（偏离基线）

### 预审查检查
- `pre-review-check.ts` — 预审查检查

## 使用方式

```bash
# 运行单个监控脚本
tsx scripts/monitor/system-health-dashboard.ts

# 通过 npm 脚本运行（推荐）
npm run system:health
```

## 注意事项

> ⚠️ **重要**: 本目录中的脚本为逻辑分类，实际执行脚本位于 `scripts/` 根目录。根目录脚本包含内部相对路径引用，移动脚本会导致路径失效。

如需新增监控脚本，请在 `scripts/` 根目录创建文件，并在此 README 中添加条目。
