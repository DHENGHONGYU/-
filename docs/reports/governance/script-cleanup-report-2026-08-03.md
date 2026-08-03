---
title: package.json 脚本精简变更报告
type: report
domain: governance
phase: F
status: completed
maintainer: engineering-team
summary: F阶段移除package.json中28个重复/废弃npm脚本（24个重复+3个DEPRECATED+1个echo），脚本总数从241降至213，同步更新文档引用
tags: [package.json, scripts, cleanup, dedup, governance]
version: 1.0.0
last_updated: 2026-08-03
doc_id: GOV-SCRIPT-CLEANUP-2026-08-03
---

# package.json 脚本精简变更报告

> **报告日期**: 2026-08-03  
> **提交哈希**: `57d99662`  
> **分支**: `release/v2.1.0-prerelease`  
> **影响文件**: `package.json`, `scripts/README.md`, `docs/reference/development-workflow-sop.md`

---

## 1. 执行摘要

本次清理移除了 `package.json` 中 **28 个**冗余 npm 脚本，包括 24 个重复脚本（保留规范名，删除非规范别名）、3 个已标记 DEPRECATED 的注释脚本和 1 个引用失效路径的 echo 脚本。脚本总数从 **241 降至 213**（净减 28），消除了命名混乱、降低了维护成本，同时确保所有 CI/CD 流水线和 husky 门禁不受影响。

---

## 2. 被移除的 24 个重复脚本完整清单

### 2.1 原始配置信息与替换关系

| # | 被移除脚本 | 原始配置 | 规范名（保留） | 规范配置 | 替换说明 |
|---|-----------|---------|--------------|---------|---------|
| 1 | `verify:designTokens` | `tsx scripts/verify-design-tokens.ts` | `verify:tokens` | `tsx scripts/verify-design-tokens.ts` | 同一脚本文件，camelCase 别名删除 |
| 2 | `verify:allRoutes` | `tsx scripts/verify-all-routes.ts` | `audit:routes` | `tsx scripts/verify-all-routes.ts` | 归入 `audit:*` 命名空间 |
| 3 | `validate:dataBlueprint` | `tsx scripts/other/validate-data-blueprint.ts` | `validate:blueprint` | `tsx scripts/other/validate-data-blueprint.ts` | 同一脚本，camelCase 别名删除 |
| 4 | `audit:tokenConsumption` | `tsx scripts/audit/audit-token-consumption.ts` | `audit:token` | `tsx scripts/audit/audit-token-consumption.ts` | 同一脚本，camelCase 别名删除 |
| 5 | `audit:splitQuality` | `tsx scripts/audit/audit-split-quality.ts` | `audit:split-quality` | `tsx scripts/audit/audit-split-quality.ts` | 同一脚本，camelCase→kebab-case |
| 6 | `audit:reservedStores` | `tsx scripts/audit/audit-reserved-stores.ts` | `audit:reserved-stores` | `tsx scripts/audit/audit-reserved-stores.ts` | 同一脚本，camelCase→kebab-case |
| 7 | `audit:mappingIntegrity` | `tsx scripts/audit/audit-mapping-integrity.ts` | `audit:mapping-integrity` | `tsx scripts/audit/audit-mapping-integrity.ts` | 同一脚本，camelCase→kebab-case |
| 8 | `audit:executionPaths` | `tsx scripts/audit/audit-execution-paths.ts` | `audit:execution-paths` | `tsx scripts/audit/audit-execution-paths.ts` | 同一脚本，camelCase→kebab-case |
| 9 | `audit:deadCode` | `tsx scripts/audit/audit-dead-code.ts` | `audit:deadcode` | `tsx scripts/audit/audit-dead-code.ts` | 同一脚本，camelCase→全小写 |
| 10 | `system:healthDashboard` | `tsx scripts/monitor/system-health-dashboard.ts` | `system:health` | `tsx scripts/monitor/system-health-dashboard.ts` | 同一脚本，camelCase 别名删除 |
| 11 | `system:checkLoop` | `tsx scripts/monitor/system-check-loop.ts` | `system:check-loop` | `tsx scripts/monitor/system-check-loop.ts` | 同一脚本，camelCase→kebab-case |
| 12 | `build:healthReport` | `tsx scripts/build-health-report.ts` | `build:health` | `tsx scripts/build-health-report.ts` | 同一脚本，camelCase 别名删除 |
| 13 | `build:aiMemoryIndex` | `tsx scripts/build-ai-memory-index.ts` | `build:ai-memory` | `tsx scripts/build-ai-memory-index.ts` | 同一脚本，camelCase→kebab-case |
| 14 | `query:aiMemory` | `tsx scripts/other/query-ai-memory.ts` | `query:ai-memory` | `tsx scripts/other/query-ai-memory.ts` | 同一脚本，camelCase→kebab-case |
| 15 | `tokens` | `tsx scripts/generate-tokens.ts` | `generate:tokens` | `tsx scripts/generate-tokens.ts` | 同一脚本，简写名删除 |
| 16 | `pre-reviewCheck` | `tsx scripts/monitor/pre-review-check.ts` | `pre-review` | `tsx scripts/monitor/pre-review-check.ts` | 同一脚本，camelCase 别名删除 |
| 17 | `script:workflowRuleEngine` | `tsx scripts/other/workflow-rule-engine.ts` | `workflow:decide` | `tsx scripts/other/workflow-rule-engine.ts` | 同一脚本，非规范前缀删除 |
| 18 | `create:mcpServer` | `tsx scripts/security/create-mcp-server.ts` | `create:mcp-server` | `tsx scripts/security/create-mcp-server.ts` | 同一脚本，camelCase→kebab-case |
| 19 | `doc:freshnessScore` | `tsx scripts/docs-tool/doc-freshness-score.ts` | `doc:freshness` | `tsx scripts/docs-tool/doc-freshness-score.ts` | 同一脚本，camelCase 别名删除 |
| 20 | `doc:crossRefSync` | `tsx scripts/docs-tool/doc-cross-ref-sync.ts` | `daily-doc:cross-ref` | `tsx scripts/docs-tool/doc-cross-ref-sync.ts` | 归入 `daily-doc:*` 命名空间 |
| 21 | `doc:versionHistory` | `tsx scripts/docs-tool/doc-version-history.ts` | `daily-doc:history` | `tsx scripts/docs-tool/doc-version-history.ts` | 归入 `daily-doc:*` 命名空间 |
| 22 | `daily-doc:validation` | `tsx scripts/docs-tool/daily-doc-validation.ts` | `daily-doc:validate` | `tsx scripts/docs-tool/daily-doc-validation.ts` | 同一脚本，名词→动词规范 |
| 23 | `doc:updateTrigger` | `tsx scripts/docs-tool/doc-update-trigger.ts` | `doc:trigger` | `tsx scripts/docs-tool/doc-update-trigger.ts` | 同一脚本，冗余动词删除 |
| 24 | `token:scan` | `node scripts/other/token-scan.cjs` | `audit:tokens` | `tsx scripts/other/token-scan.cjs` | 归入 `audit:*` 命名空间；运行时从 `node` 统一为 `tsx` |

### 2.2 额外移除的 4 个非重复脚本

| # | 脚本名 | 原始配置 | 移除原因 |
|---|--------|---------|---------|
| 25 | `verify:no-dead-refs` | `# DEPRECATED: moved to verify/ - file missing in migration` | DEPRECATED 注释，引用的脚本文件在迁移中丢失，无实际功能 |
| 26 | `file:scan` | `# DEPRECATED: file-management-system removed` | DEPRECATED 注释，file-management-system 已移除 |
| 27 | `file:batch-migrate` | `# DEPRECATED: file-management-system removed` | DEPRECATED 注释，file-management-system 已移除 |
| 28 | `file:organize` | `echo '文档组织建议手动执行，参考 docs/07-archive/CLEANUP_SCHEDULE.md'` | echo-only 脚本，引用路径 `docs/07-archive/` 在 E 阶段重构后已失效 |

---

## 3. 脚本精简的具体原因和依据

### 3.1 命名规范统一

项目 npm scripts 遵循以下命名约定：
- **kebab-case** 为标准命名风格（如 `audit:split-quality`、`audit:reserved-stores`）
- **`audit:*`** 命名空间用于审计类脚本
- **`daily-doc:*`** 命名空间用于每日文档操作
- **`generate:*`** 命名空间用于生成类脚本

被移除的 24 个重复脚本均违反了上述命名约定，使用了 camelCase（如 `audit:splitQuality`）、非规范前缀（如 `script:workflowRuleEngine`）或简写名（如 `tokens`），导致同一脚本文件存在多个 npm 入口，增加了维护负担和认知成本。

### 3.2 外部引用验证

每个被移除脚本均经过 Grep 全仓库扫描验证，确认：
- **无 `npm run <script-name>` 调用**：在 `.husky/`、`.github/workflows/`、`scripts/`、`src/` 中无实际调用
- **无 CI/CD 依赖**：GitHub Actions 工作流和 husky hooks 使用规范名
- **文档引用已同步更新**：`scripts/README.md` 和 `docs/reference/development-workflow-sop.md` 中的别名引用已修正

### 3.3 保留的"看似重复"脚本

以下脚本虽功能相似但被保留，原因如下：

| 脚本 | 命令 | 保留原因 |
|------|------|---------|
| `test` | `vitest run` | npm 通用默认名，所有开发者习惯 |
| `test:clean` | `vitest run` | 被 `.github/workflows/quality-check.yml` 和 `.husky/pre-push` 引用 |
| `test:ci` | `vitest run --coverage` | 被 `.github/workflows/quality-check.yml` 和 `.github/workflows/ci.yml` 引用 |
| `coverage` | `vitest run --coverage` | npm 约定俗成的覆盖率脚本名 |

---

## 4. 精简前后对比

### 4.1 数量对比

| 指标 | 精简前 | 精简后 | 变化 |
|------|--------|--------|------|
| npm scripts 总数 | 241 | 213 | -28（-11.6%）|
| 重复脚本对 | 25 对 | 1 对 | -24 对 |
| DEPRECATED 脚本 | 3 | 0 | -3 |
| echo-only 脚本 | 1 | 0 | -1 |

> **注**：剩余 1 对"重复"为 `test`/`test:clean`（同命令不同语义）和 `coverage`/`test:ci`（同命令不同语义），因 CI 引用而保留。

### 4.2 优化效果

1. **命名一致性**：消除 camelCase 与 kebab-case 混用，全仓库 scripts 统一为 kebab-case
2. **维护成本降低**：同一脚本文件不再有多个 npm 入口，修改时无需同步多处
3. **认知负担减轻**：开发者无需记忆 `audit:splitQuality` vs `audit:split-quality` 哪个是规范名
4. **CI/CD 安全**：所有 CI 工作流和 husky hooks 使用的规范名均未受影响
5. **文档同步**：`scripts/README.md` 和 `docs/reference/development-workflow-sop.md` 中的脚本引用已同步更新

### 4.3 验证结果

| 验证项 | 结果 | 说明 |
|--------|------|------|
| JSON 格式有效性 | ✅ 通过 | `node -e "require('./package.json')"` 无异常 |
| 规范名脚本完整性 | ✅ 通过 | 24 个规范名脚本全部存在 |
| tsc:prod 类型检查 | ✅ 通过 | `tsc -p tsconfig.prod.json --noEmit` 退出码 0 |
| audit:layers 分层审计 | ✅ 通过 | 0 违规，0 警告 |
| audit:atomic 原子性审计 | ✅ 通过 | 无阻断性违规 |
| audit:db-references | ✅ 通过 | 审计通过（有警告）|
| 预提交门禁 | ✅ 通过 | commit `57d99662` 成功提交 |
| test/coverage 日志增强 | ✅ 通过 | JSON 有效，日志格式验证通过 |

---

## 5. test/coverage 脚本日志增强说明

本次变更同步增强了 `test` 和 `coverage` 脚本，添加了执行前后日志输出：

### 5.1 日志格式

```
[test] START | time=2026-08-03T14:15:02.444Z | cmd=vitest run
... (vitest 输出) ...
[test] PASS | time=2026-08-03T14:16:30.123Z
```

失败时：
```
[test] START | time=2026-08-03T14:15:02.444Z | cmd=vitest run
... (vitest 输出) ...
[test] FAIL | time=2026-08-03T14:15:45.789Z
```

### 5.2 实现方式

使用 `node -e` 内联命令（跨平台兼容，无需创建辅助文件），通过 `&&`/`||` 连接：
- **START 日志**：命令执行前输出脚本名、时间戳、执行的命令
- **PASS 日志**：命令成功后输出脚本名、时间戳
- **FAIL 日志**：命令失败时输出到 stderr 并返回退出码 1

---

## 6. 后续建议

1. **`audit:store-coverage` 失败**：`chatStore` 测试比率 0.83（6 actions / 5 tests），低于 CI 阈值 1.0，需补充测试用例
2. **`verify:all` 聚合脚本**：项目目前无 `verify:all` 脚本，可考虑创建一键验证入口（组合 tsc:prod + audit:layers + test + verify:tokens）
3. **scripts/README.md 孤立脚本**：42 个孤立脚本未接入 package.json，建议定期评估是否需要接入或归档

---

## 7. 变更文件清单

| 文件 | 变更类型 | 变更内容 |
|------|---------|---------|
| `package.json` | 修改 | 移除 28 个脚本；test/coverage 添加日志 |
| `scripts/README.md` | 修改 | 移除别名脚本引用（5 处） |
| `docs/reference/development-workflow-sop.md` | 修改 | `query:aiMemory` → `query:ai-memory` |
