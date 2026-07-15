# scripts/security/ — 安全脚本分类

## 概述

本目录包含所有安全类脚本，用于安全审计、ACL 验证、安装策略等。

## 分类说明

### 安全验证
- `validate-acl-impact.ts` — ACL 影响验证
- `health-check.ts` — 健康检查

### 安装与策略
- `audit-installations.ps1` — 安装审计（PowerShell）
- `install-verify.ts` — 安装验证
- `setup-install-policy.ps1` — 安装策略设置

### MCP 安全
- `create-mcp-server.ts` — MCP 服务器创建
- `mcp-confirmation-demo.ts` — MCP 确认演示

## 使用方式

```bash
# 运行单个安全脚本
tsx scripts/security/validate-acl-impact.ts

# 通过 npm 脚本运行（推荐）
npm run validate:aclImpact
```

## 注意事项

> ⚠️ **重要**: 本目录中的脚本为逻辑分类，实际执行脚本位于 `scripts/` 根目录。根目录脚本包含内部相对路径引用，移动脚本会导致路径失效。

如需新增安全脚本，请在 `scripts/` 根目录创建文件，并在此 README 中添加条目。
