# scripts/audit/ — 审计脚本分类

## 概述

本目录包含所有审计类脚本，用于对代码质量、架构规范、文档完整性等进行自动化检测。

## 分类说明

### 架构审计
- `audit-layer-calls.ts` — 跨层调用检测
- `audit-mapping-integrity.ts` — 路由/Store/组件映射完整性
- `audit-execution-paths.ts` — 执行路径审计
- `audit-split-quality.ts` — 代码拆分质量审计
- `audit-reserved-stores.ts` — 保留 Store 名称审计

### 代码质量审计
- `audit-hardcode.ts` — 硬编码值扫描
- `audit-dead-code.ts` — 死代码检测
- `audit-atomic.ts` — 组件/Store 原子规范
- `audit-component-usage.ts` — 组件使用审计
- `audit-dependencies.ts` — 依赖审计

### 文档审计
- `audit-doc-sync.ts` — 文档同步状态审计
- `audit-doc-integrity.ts` — 文档完整性审计
- `audit-version-drift.ts` — 版本漂移检测
- `diagnose-docs.ts` — 文档诊断
- `directory-audit.ts` — 目录结构审计

### UI/视觉审计
- `audit-typography.ts` — 排版规范审计
- `audit-inline-colors.ts` — 内联颜色审计
- `audit-color-tokens.ts` — 颜色令牌合规审计
- `audit-spacing.ts` — 间距规范审计
- `audit-visual.ts` — 视觉回归审计

### 测试与质量审计
- `audit-tests.ts` — 测试质量审计
- `audit-trend-monitor.ts` — 趋势监控审计
- `audit-jsdoc.ts` — JSDoc 覆盖审计

### 安全与 MCP 审计
- `audit-mcp.ts` — MCP 安全性审计
- `audit-mcp-tool-usage.ts` — MCP 工具使用审计

### 评估工具
- `assess-file-system.ts` — 文件系统全面评估

## 使用方式

```bash
# 运行单个审计
tsx scripts/audit/audit-layer-calls.ts

# 通过 npm 脚本运行（推荐）
npm run audit:layers
```

## 注意事项

> ⚠️ **重要**: 本目录中的脚本为逻辑分类，实际执行脚本位于 `scripts/` 根目录。根目录脚本包含内部相对路径引用（如 `../src/config/routes.ts`、`./_debug/_audit-pipeline`），移动脚本会导致路径失效。

如需新增审计脚本，请在 `scripts/` 根目录创建文件，并在此 README 中添加条目。
