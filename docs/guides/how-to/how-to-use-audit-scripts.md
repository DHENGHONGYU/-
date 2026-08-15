---
title: 如何使用质量审计脚本
type: how-to
domain: qa
phase: operation
tier: standard
status: active
maintainer: V9 Architecture Team
summary: "面向开发者的 V9 质量审计脚本使用指南，覆盖 40+ 审计脚本的分类、5 个核心命令的使用场景、基线管理与自定义规则扩展"
tags: [qa, audit, quality, gate, testing]
version: v1.2.0
last_updated: 2026-08-09
code_version: "2.0.0-rc.1"
doc_id: V9-DOC-QA-116
related_docs: [V9-DOC-QA-108]
change_log:
  - version: v1.2.0
    changes: 新增命令 12（fix-duplicate-test-ids）与命令 13（split-tests-directory）说明（P3 测试目录治理产物）
    date: 2026-08-09
  - version: v1.1.0
    changes: 新增"代码一致性审计"分类与 `audit-directDataAPI-consistency.mjs` 脚本说明（TD-012/TD-015 治理产物）
    date: 2026-08-09
  - version: v1.0.0
    changes: Initial version established
    date: 2026-07-19
---

# 如何使用质量审计脚本

> **版本**：v1.2.0  
> **更新日期**：2026-08-09  
> **适用范围**：需要运行质量门禁、解读审计报告、扩展自定义审计规则的 V9 开发者
---

## 前置检查清单

开始使用前，请逐项确认以下前置条件：

- [ ] 本地已安装 Node.js ≥ 18 与 npm
- [ ] 项目依赖已安装完成（`npm install` 执行成功）
- [ ] 审计脚本依赖 `tsx` 执行（已随项目依赖安装，无需全局安装）
- [ ] 了解 V9 分层架构（UI / Store / Service / Core / Data / Config）
- [ ] 已阅读 [质量门禁标准](../standards/quality-gates.md) 了解各级门禁定义

---

## 审计体系概览

V9 质量保障体系内置 **40+ 个审计脚本**，统一存放于 `scripts/audit/` 目录，按职责划分为 **7 大类**，并通过 **三级质量门禁**（开发提交 / PR 合并 / 发布回归）分层拦截问题。

### 审计脚本分类

| 类别 | 数量 | 覆盖范围 | 代表脚本 |
|------|---------|---------|---------|
| 架构分层审计 | 6+ | 跨层调用、依赖方向、模块映射完整性 | `audit-layer-calls`、`audit-mapping-integrity` |
| 代码质量审计 | 8+ | 硬编码、死代码、原子性、圈复杂度 | `audit-hardcode`、`audit-dead-code`、`audit-atomic` |
| 文档同步审计 | 5+ | 文档与代码一致性、文档完整性 | `audit-doc-sync`、`audit-doc-integrity` |
| UI/令牌审计 | 5+ | 排版规范、颜色令牌、硬编码样式 | `audit-typography`、`audit-color-tokens` |
| 测试与趋势审计 | 4+ | 测试覆盖、JSDoc 覆盖率、质量趋势 | `audit-tests`、`audit-trend-monitor` |
| 数据与 MCP 审计 | 3+ | MCP 通道、ACL 白名单、数据契约 | `audit-mcp`、`audit-acl-consistency` |
| 代码一致性审计 | 1+ | 跨文件/重复副本的关键差异守护（防止重构回退） | `audit-directDataAPI-consistency.mjs` |

### 三级质量门禁

| 门禁级别 | 命令 | 覆盖内容 | 耗时参考 |
|----------|---------|-----------|---------|
| P0 开发门禁 | gate:dev（提交前必跑） | lint + tsc + 分层 + 原子性 + DB 引用 + ACL | < 30 秒 |
| P1 快速门禁 | gate:quick（PR 合并前） | P0 全部 + Mock + ACL + 文档 + 硬编码 + DB | < 2 分钟 |
| P2 回归门禁 | regression（发布前） | lint + test + 全量审计 + build + e2e | 5-10 分钟 |

---

## 核心命令详解（5 个最常用命令）

### 命令 1：gate:dev（开发提交前必跑）

```bash
npm run gate:dev
```

**包含的检查项**：
- `lint-staged` → 对暂存文件执行 ESLint 检查
- `tsc:prod` → TypeScript 生产配置类型检查
- `audit:layers` → 分层架构违规扫描
- `audit:atomic` → 组件/Store 原子性检查
- `audit:db-references` → 数据库引用与配置一致性
- `audit:acl-consistency` → ACL 白名单一致性校验

**使用时机**：每次 git commit 前运行，全部通过才允许提交。

### 命令 2：gate:quick（PR / 合并前必跑）

```bash
npm run gate:quick
```

**包含的检查项**（在 gate:dev 基础上追加）：
- `audit:mock-modules` → Mock 数据残留扫描
- `audit:docs` → 文档同步 + 文档完整性校验

**使用时机**：提交 PR 前运行；CI 流水线将其作为合并阻塞门禁。

### 命令 3：audit:layers（分层架构审计）

```bash
npm run audit:layers
```

**检查内容**：扫描 `src/` 全部源码的 import 关系，依据 AGENTS.md 分层契约检测跨层违规（例如 service 层 import store 层）。

**输出示例**：
```
=== 分层架构违规报告 ===
违规数量: 3
  1. src/services/foo/fooService.ts:10
     → import { useBarStore } from '@/store/barStore'
     违规原因: service 层禁止依赖 store 层
```

### 命令 4：audit:hardcode（硬编码审计）

```bash
npm run audit:hardcode
```

**检查内容**：扫描引擎层与 UI 层的硬编码残留——引擎层的阈值/权重/魔法数字必须来自 config 注入，UI 层的颜色值必须引用令牌常量，禁止直接书写 HEX 或 Tailwind 数字颜色类。

### 命令 5：audit:quality（增强质量审计）

```bash
# 全量扫描
npm run audit:quality

# 指定目录扫描
npm run audit:quality -- --root src/core

# 输出 SARIF 格式（用于 CI 与代码扫描平台）
npm run audit:quality -- --format sarif

# 跨文件关联分析
npm run audit:quality -- --cross-file

# 保存当前结果为基线
npm run audit:quality -- --baseline save

# 与基线对比（只增不减拦截）
npm run audit:quality -- --baseline check
```

**覆盖范围**：41 项检查规则，覆盖 6 大维度（代码异味 / 类型安全 / 复杂度 / 重复代码 / 日志规范 / 文档注释）。

### 命令 6：audit-directDataAPI-consistency（directDataAPI 一致性审计）

```bash
node scripts/audit-directDataAPI-consistency.mjs
```

**检查内容**：守护 TD-012（directDataAPI 重复副本迁移）+ TD-015（跨配置源引用治理）治理成果不回归。脚本同时支持两种模式自动判定：

| 模式 | 判定标志 | 检查项 |
|------|----------|--------|
| 独立副本模式（旧） | `data-collector/directDataAPI.ts` 含 `fields[N]` 数组索引 + `matchAll` 旧批量逻辑 | 新浪字段索引一致性、批量行情实现逻辑、腾讯 K 线 qfqday 兜底、错误策略、配置源 5 项 |
| 适配层模式（当前） | `data-collector/directDataAPI.ts` 从 `../fetcher/directDataAPI` 导入运行时值 | 8 项运行时 export + 2 项类型 export 齐全性 |

**使用时机**：
- 修改 `src/services/fetcher/directDataAPI.ts` 或 `src/services/data-collector/directDataAPI.ts` 后必跑
- 修改 `src/config/dataSourceUrls.ts` 或 `src/config/marketDataEndpoints.ts` 后必跑
- 建议加入 CI / pre-commit hook 长期守护

**退出码**：`0` = 全部一致；`1` = 存在不一致项

### 命令 7：audit-circuit-breaker-reset（熔断器状态泄漏检查）

```bash
node scripts/audit/audit-circuit-breaker-reset.mjs
```

**检查内容**：扫描所有 import `llmClient`/`llmGateway` 且调用了 `chat()`/`streamingChat()`/`getCircuitBreaker()` 的测试文件，确认其在 `beforeEach` 中包含 `getCircuitBreaker().reset()`，防止模块级共享 CircuitBreaker 状态在测试间泄漏。

**检查策略**：
1. 扫描 `src/` 和 `tests/` 下的 `*.test.{ts,tsx}` 文件
2. 匹配 import from `@/services/llm/llmClient` 或 `@/services/llm/llmGateway`
3. 排除只 import 类型（如 `LlmApiError`）不触发真实 CB 的文件
4. 排除 `vi.mock` 了 llmClient/llmGateway 的文件（mock 后不触发真实 CB）
5. 检查剩余文件是否有 `getCircuitBreaker().reset()` 或 `getCircuitBreaker()` + `.reset()` 间接调用

**使用时机**：
- 新增 LLM 相关测试文件后必跑
- 修改 `llmClient.ts`/`llmGateway.ts`/`llmCircuitBreaker.ts` 后必跑
- 建议加入 CI 长期守护

**退出码**：`0` = 0 个违规；`1` = 存在违规（需添加 reset）

### 命令 8：audit-test-catalog-coverage（测试目录覆盖率检查）

```bash
node scripts/audit/audit-test-catalog-coverage.mjs
```

**检查内容**：扫描所有 `*.test.{ts,tsx}` 文件，检查是否在 `docs/reference/test-catalog.md`（已归档至 `docs/archive/historical-2026-08-16/batch6/docs/reference/test-catalog.md`）中收录，防止测试收录遗漏。

**使用时机**：
- 新增测试文件后必跑
- 建议加入 CI 长期守护

**退出码**：`0` = 全部收录；`1` = 存在未收录（需补录到 test-catalog.md）

### 命令 9：analyze-test-catalog-gaps（测试覆盖率差距分析）

```bash
node scripts/audit/analyze-test-catalog-gaps.mjs
```

**检查内容**：分析未收录在 test-catalog.md 中的测试文件，按子域分类统计，生成分批处理计划。

**使用时机**：test-catalog.md 收录率低于 100% 时运行，制定补录计划。

### 命令 10：batch-add-test-catalog（测试目录批量补录）

```bash
node scripts/audit/batch-add-test-catalog.mjs
```

**检查内容**：将未收录的测试文件批量补录到 test-catalog.md，在文件末尾新增"附录 A. 待整理测试文件"分类，按子域分组列出所有未收录的测试文件。自动更新版本号和变更日志。

**使用时机**：analyze-test-catalog-gaps 生成报告后，执行批量补录。

**退出码**：`0` = 补录成功或无需补录

### 命令 11：audit-test-duplicates（测试文件重复/冗余检查）

```bash
node scripts/audit/audit-test-duplicates.mjs
```

**检查内容**：检查测试文件是否存在重复或冗余逻辑，包括 5 个维度：同名文件、@test_id 重复、过小文件（<500B）、重复 describe 文本、拥挤目录（>10 个文件）。

**使用时机**：
- 定期测试质量审计
- 新增测试文件后检查是否与现有文件重名
- CI 守护：防止 @test_id 重复

**关联报告**：`docs/reports/test-duplicate-cleanup-suggestions-2026-08-09.md`

**关联技术债**：TD-012（已完成）、TD-015（P2 完成，P3 暂缓）— 详见 TECH-DEBT.md（已归档至 `docs/archive/historical-2026-08-16/batch6/docs/reports/TECH-DEBT.md`）

**关联治理报告**：
- [directDataAPI 迁移验证报告](../../../deliverables/software-company/directDataAPI-migration-report-2026-08-09.md)
- [TD-015 治理总结报告](../../../deliverables/software-company/td-015-governance-summary-2026-08-09.md)

### 命令 12：fix-duplicate-test-ids（@test_id 重复自动修复）

```bash
node scripts/audit/fix-duplicate-test-ids.mjs [--dry-run]
```

**修复内容**：扫描所有测试文件的 `@test_id V9-TEST-(ST|UT)-N` 注释，找出重复组，每组保留第一个文件的 @test_id，为后续文件分配新 ID（编号从当前最大值 +1 递增），修改文件中的 `@test_id` 注释。

**使用时机**：
- `audit-test-duplicates` 报告 @test_id 重复后执行修复
- 测试文件合并/迁移后清理重复 ID
- 建议先 `--dry-run` 预览，再正式执行

**参数**：
- `--dry-run`：仅预览修复结果，不修改文件

**执行结果**（2026-08-09）：扫描 534 文件，发现 23 组重复，修改 32 个文件，新分配 23 个 @test_id。

**关联报告**：`docs/reports/test-duplicate-cleanup-suggestions-2026-08-09.md` §三

**关联治理**：tech-debt-cleanup-summary-2026-08-09.md（已归档）

### 命令 13：split-tests-directory（tests/ 目录按子域拆分）

```bash
node scripts/audit/split-tests-directory.mjs [--dry-run]
```

**拆分内容**：扫描 tests/ 根目录下的 `*.test.{ts,tsx}` 文件（不含子目录），根据文件内容中的 `import ... from '@/...'` 路径推断子域，创建子目录并移动文件，对使用相对路径 import 的文件更新路径。

**子域分类规则**：基于 import 路径推断（store/services-llm/services-scoring/services-collection/services-mcp/services-other/components/core/data/lib/hooks/pages/apps/other），共 14 个子域目标目录。

**使用时机**：
- tests/ 根目录文件过多（>50 个）时执行整理
- 按子域归档测试文件，提升可维护性
- 建议先 `--dry-run` 预览拆分结果，再正式执行

**参数**：
- `--dry-run`：仅预览拆分结果，不移动文件

**执行结果**（2026-08-09）：拆分 119 个文件到 14 个子目录，更新 4 个文件的相对 import 路径。

**注意事项**：拆分后需运行回归测试确认 import 路径正确。

**关联治理**：tech-debt-cleanup-summary-2026-08-09.md（已归档）

---

## 场景 1：发布前全量回归

### 1.1 运行回归套件

```bash
npm run regression
```

回归套件按顺序执行以下检查，任一失败即中断：
- ESLint 全量检查
- 单元测试（vitest）
- 全量审计（audit:layers / audit:hardcode / audit:docs 等）
- 生产构建（`npm run build`）
- E2E 测试（playwright）

> **提示**：`regression` 完整运行约 5-10 分钟，建议在发布窗口期执行；日常开发使用 gate:dev / gate:quick 即可。

### 1.2 回归产物归档

回归产生的审计报告按类型归档：

| 归档位置 | 格式 | 说明 |
|----------|------|------|
| 控制台输出 | 文本 | 实时查看，失败时定位第一现场 |
| `docs/reports/audit/` | JSON | 机器可读的审计结果，供趋势分析 |
| `docs/guides/how-to/testing/audit-reports/audit/` | HTML/PNG | 可视化报告，供评审与归档查阅 |

---

## 场景 2：解读审计报告

### 2.1 严重级别定义

| 级别 | 含义 | 处理要求 | 对应优先级 |
|------|------|------|-------------|
| Critical（致命） | 阻断性 | 架构违规、类型错误、数据契约破坏，必须立即修复 | 对应 P0/P1/P2 门禁拦截 |
| Major（严重） | 高优先 | 硬编码、Mock 残留、ACL 不一致，合并前必须修复 | 对应 P1/P2 门禁拦截 |
| Warning（警告） | 建议修复 | 代码异味、日志不规范，允许带债合入但需登记 | 不拦截，计入趋势 |
| Minor（轻微） | 提示 | 注释缺失、命名建议，择机清理 | 不拦截 |

### 2.2 基线对比机制

通过 `--baseline check` 实现质量债只减不增的 ratchet 机制：

- **新增违规** → 对比基线出现新违规 → 拦截，必须修复或说明
- **违规减少** → 对比基线违规数下降 → 通过，建议同步刷新基线
- **基线刷新** → 消减债务后执行 `--baseline save` → 提交新基线

> **基线文件位置**：`scripts/audit-quality.config.json` 同级的 `.baseline.json`。

### 2.3 SARIF 输出对接

通过 `--format sarif` 输出 **SARIF 2.1.0** 标准格式，可对接：
- GitHub Code Scanning
- VS Code SARIF Viewer 插件
- CI/CD 质量看板

---

## 场景 3：门禁选择决策

### 3.1 gate:dev vs gate:quick vs regression

| 维度 | gate:dev | gate:quick | regression |
|------|----------|------------|------------|
| **定位** | 开发自验，提交前最后一道关 | 合并把关（PR 级） | 发布把关（版本级） |
| **使用时机** | 每次 commit 前 | PR 提交 / 合并前 | 发布前 / 定期全量体检 |
| **耗时** | < 30 秒 | < 2 分钟 | 5-10 分钟 |
| **含 lint** | ✅ | ✅ | ✅ |
| **含 tsc** | ✅ | ✅ | ✅ |
| **含单测** | ❌ | ❌ | ✅ |
| **含分层审计** | ✅ | ✅ | ✅ |
| **含 Mock 审计** | ❌ | ✅ | ✅ |
| **含硬编码审计** | ❌ | ✅ | ✅ |
| **E2E 测试** | ❌ | ❌ | ✅ |

### 3.2 P0 / P1 / P2 门禁适用场景

| 级别 | 名称 | 适用场景 | 失败处理 |
|------|------|------|---------|
| P0 | 开发门禁 | 本地开发高频自验，每次提交前必跑 | 修复后重新提交，禁止绕过 |
| P1 | 快速门禁 | PR 评审与合并前，CI 自动执行 | 阻塞合并，修复后重推 |
| P2 | 回归门禁 | 版本发布前全量验证 | 阻塞发布，修复后重新回归 |

---

## 场景 4：扩展自定义审计规则

### 4.1 选择合适的扩展点

按规则归属的类别选择扩展位置：

- 架构分层规则 → 扩展 `audit-layer-calls` 系列脚本
- 代码异味规则 → 在 `audit-quality-enhanced.ts` 中新增 check 函数
- 文档同步规则 → 扩展 `audit-doc-sync.ts` 检查项
- UI/令牌规则 → 扩展对应 UI 审计脚本的扫描模式

### 4.2 在 audit-quality-enhanced 中新增规则

以新增「禁止业务代码使用 console.log」规则为例：

```typescript
// 1. 定义 checkXxx 函数，返回 Finding 数组
function checkConsoleLog(file: ParsedFile): Finding[] {
  const findings: Finding[] = []
  // 基于 AST 遍历节点
  ts.forEachChild(file.sourceFile, (node) => {
    if (ts.isCallExpression(node)) {
      const expr = node.expression
      if (
        ts.isPropertyAccessExpression(expr) &&
        expr.name.getText() === 'log' &&
        expr.expression.getText() === 'console'
      ) {
        findings.push({
          ruleId: 'smell:console-log',
          severity: 'Warning',
          message: '业务代码禁止 console.log，请使用 logger',
          line: file.sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1,
          column: file.sourceFile.getLineAndCharacterOfPosition(node.getStart()).character + 1,
        })
      }
    }
  })
  return findings
}

// 2. 在 scan() 主流程中挂接新规则
export function scan(options: ScanOptions = {}): ScanResult {
  // ...
  for (const file of files) {
    findings.push(...checkConsoleLog(file))
  }
  // ...
}
```

### 4.3 配置规则开关与级别

编辑 `scripts/audit-quality.config.json`：

```json
{
  "rules": {
    "smell:console-log": {
      "enabled": true,
      "severity": "Warning"
    }
  }
}
```

### 4.4 验证新规则

```bash
npm run audit:quality -- --root src/test-sample
```

确认新规则在样本目录上命中预期、无误报后，再纳入全量扫描。

---

## 常见问题

### Q1：审计脚本运行时报找不到 tsx？

**解决**：
```bash
npm install
# 或全局安装备用
npm install -g tsx
```

### Q2：审计结果出现大量历史遗留违规？

**处理步骤**：
1. 先用 `--baseline save` 将现状固化为基线，新增违规才会被拦截
2. 按 P0→P1→P2 优先级分批消减存量债务
3. 用 `--root` 限定目录逐个模块清理
4. 每完成一批清理后刷新基线并提交

### Q3：审计报告的 JSON 产物在哪里？

**位置**：`docs/reports/audit/` 目录，按日期命名，例如：
- `audit-layer-calls-YYYYMMDD.json`
- `audit-hardcode-YYYYMMDD.json`
- `audit-quality-enhanced-YYYYMMDD.json`

### Q4：如何接入 CI/CD？

**接入示例**：
```yaml
# GitHub Actions 示例
- name: Run Quality Gate
  run: npm run gate:quick
  continue-on-error: false
```

> 退出码约定：0 = 全部通过；1 = 存在违规（拦截）；2 = 脚本自身执行异常。

---

## 相关文档

| 文档 | 路径 | 说明 |
|------|------|------|
| 质量门禁标准 | `../standards/quality-gates.md` | 三级门禁的完整定义与验收标准 |
| 测试策略 | `../testing-strategy.md` | 测试分层与回归策略 |
| 审计脚本 README | `../../scripts/audit/README.md` | 全部审计脚本的索引与参数说明 |
| 质量审计配置文件 | `../../scripts/audit-quality.config.json` | audit-quality-enhanced 规则配置 |
| 代码评审指南 | `./code-review-guide.md` | 评审流程与检查清单 |
| 回归套件说明 | `../../explanation/regression-suite.md` | 回归流程的设计背景 |

---

> **维护提示**：新增审计脚本或调整门禁组合时，请同步更新本文档与 `scripts/audit/` 目录下的 README，保持命令清单与实际脚本一致。
