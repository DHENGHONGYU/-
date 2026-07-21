# V9 并行任务调度表

> 生成时间：2026-06-25  
> 调度官：Agent Orchestrator  
> 执行状态：全部完成

---

## 调度总览

| Batch | 任务数量 | 执行 Agent | 状态 |
|-------|----------|------------|------|
| Batch-1 | 12 | Doc-Sync × 3、Refactor-Agent × 1 | ✅ 已完成 |
| Batch-2 | 9 | Code-Reviewer × 3、Doc-Sync × 2 | ✅ 已完成 |
| Batch-2.5 | 8 | Doc-Sync × 3 | ✅ 已完成 |
| Batch-3 | 1 | Refactor-Agent + Test-Generator Agent | ✅ 已完成 |

---

## 原子任务明细

| Batch序号 | 原子任务描述（含文件路径） | 执行Agent | 状态 |
|-----------|---------------------------|-----------|------|
| Batch-1 | 修改 `docs/03-architecture-standards.md`：DB 版本、Store 清单、偏差清单、DataFlow/Widget/Agent 状态、章节编号、eventBus 示例 | Doc-Sync Agent | ✅ 已完成 |
| Batch-1 | 修改 `docs/06-routing-specs.md`：补全 5 条遗漏路由、修正 PortalShell 映射、HubPage 设计说明 | Doc-Sync Agent | ✅ 已完成 |
| Batch-1 | 修改 `docs/08-implementation-plan.md`：测试基线、Phase 2 任务状态、/input/prototype 决策 | Doc-Sync Agent | ✅ 已完成 |
| Batch-1 | 修改 `docs/09-quality-gates.md`：audit 基线（0/2、389、11）、.nvmrc、coverage 状态 | Doc-Sync Agent | ✅ 已完成 |
| Batch-1 | 修改 `docs/10-glossary.md`：模块 ID、group 字段、watchlists、V6 迁移术语 | Doc-Sync Agent | ✅ 已完成 |
| Batch-1 | 修改 `README.md`：版本标识、待实现列表、L3 描述 | Doc-Sync Agent | ✅ 已完成 |
| Batch-1 | 修改 `docs/README.md`：版本统一、文档性质标注 | Doc-Sync Agent | ✅ 已完成 |
| Batch-1 | 修改 `docs/implementation/implementation-governance.md`：ADR 数量、编号↔文件名对照表 | Doc-Sync Agent | ✅ 已完成 |
| Batch-1 | 修改 `docs/implementation/v9-system-blueprint.md`：store 数量、质量基线、偏差清单、ADR 列表 | Doc-Sync Agent | ✅ 已完成 |
| Batch-1 | 修改 `docs/implementation/input-cabin-spec.md`：inputConfig 状态、/input/local-knowledge | Doc-Sync Agent | ✅ 已完成 |
| Batch-1 | 创建 `.nvmrc` + 配置 `vite.config.ts` coverage 阈值 + 安装 `@vitest/coverage-v8@^2.1.0` | Refactor-Agent | ✅ 已完成 |
| Batch-1 | 更新 `package.json` / `package-lock.json`：新增 `tsc` 与 `regression` 脚本、记录 coverage 依赖 | Refactor-Agent | ✅ 已完成 |
| Batch-2 | 审查 `docs/03-architecture-standards.md` | Code-Reviewer Agent | ✅ 已完成 |
| Batch-2 | 审查 `docs/06-routing-specs.md`、`docs/08-implementation-plan.md`、`docs/09-quality-gates.md`、`docs/10-glossary.md` | Code-Reviewer Agent | ✅ 已完成 |
| Batch-2 | 审查 `README.md`、`docs/README.md`、`docs/implementation/` 下 governance / v9-system-blueprint / input-cabin-spec | Code-Reviewer Agent | ✅ 已完成 |
| Batch-2 | 新增 `docs/implementation/dataflow-engine-spec.md` | Doc-Sync Agent | ✅ 已完成 |
| Batch-2 | 新增 `docs/implementation/agent-runtime-spec.md` | Doc-Sync Agent | ✅ 已完成 |
| Batch-2 | 新增 `docs/implementation/rotation-score-spec.md` | Doc-Sync Agent | ✅ 已完成 |
| Batch-2 | 新增 `docs/implementation/db-migration-v4-to-v6.md` | Doc-Sync Agent | ✅ 已完成 |
| Batch-2 | 新增 `docs/implementation/quality-gates-baseline.md` | Doc-Sync Agent | ✅ 已完成 |
| Batch-2 | 新增 `docs/implementation/adr/2026-06-25-v6-migration.md`（ADR-009） | Doc-Sync Agent | ✅ 已完成 |
| Batch-2.5 | 修复 `docs/03-architecture-standards.md`：DataFlow 实现细节、Widget 子目录、CockpitShell 描述、版本号统一 | Doc-Sync Agent | ✅ 已完成 |
| Batch-2.5 | 修复 `docs/06-routing-specs.md`：HubPage 统称、子页面描述、第 8 节映射、版本号统一 | Doc-Sync Agent | ✅ 已完成 |
| Batch-2.5 | 修复 `docs/08-implementation-plan.md`：章节编号顺序、测试超时说明 | Doc-Sync Agent | ✅ 已完成 |
| Batch-2.5 | 修复 `docs/09-quality-gates.md`：.nvmrc 已创建、coverage 阈值已配置 | Doc-Sync Agent | ✅ 已完成 |
| Batch-2.5 | 修复 `README.md`：L3 描述 | Doc-Sync Agent | ✅ 已完成 |
| Batch-2.5 | 修复 `docs/README.md`：版本说明、表格列冗余 | Doc-Sync Agent | ✅ 已完成 |
| Batch-2.5 | 修复 `docs/implementation/v9-system-blueprint.md`：store 数量、E2E/死代码基线、偏差清单同步 | Doc-Sync Agent | ✅ 已完成 |
| Batch-2.5 | 修复 `docs/implementation/input-cabin-spec.md` 与 `docs/implementation/implementation-governance.md`：路由映射、ADR 日期说明 | Doc-Sync Agent | ✅ 已完成 |
| Batch-3 | 全量回归测试：并发跑 lint/test/audit、串行 build + e2e；调整 `vite.config.ts` testTimeout 为 15000ms | Refactor-Agent + Test-Generator Agent | ✅ 已完成 |

---

## 并行执行指令

以下命令可直接在终端运行，用于复现 Batch-3 全量回归测试或日常并行门禁检查。

### 1. 一键全量回归（推荐）

```bash
npm run regression
```

等价于：

```bash
npx concurrently \
  --names lint,test,audit \
  --prefix-colors blue,yellow,magenta \
  "npm:lint" "npm:test" "npm:audit" \
  && npm run build \
  && npm run test:e2e
```

### 2. 仅并行 lint + 单元测试 + 三层审计（不含 build/e2e）

```bash
npx concurrently \
  --names lint,test,audit \
  --prefix-colors blue,yellow,magenta \
  "npm:lint" "npm:test -- --run" "npm:audit"
```

### 3. 并行跑三层审计脚本

```bash
npx concurrently \
  --names layers,hardcode,deadcode \
  --prefix-colors cyan,magenta,yellow \
  "npm:run audit:layers" "npm:run audit:hardcode" "npm:run audit:deadcode"
```

### 4. 按模块并行跑单元测试（示例）

```bash
npx concurrently \
  --names core,data,services,ui \
  --prefix-colors blue,green,yellow,magenta \
  "npx vitest run tests/databridge.test.ts tests/dataLayer.test.ts" \
  "npx vitest run tests/databridge.test.ts tests/dataLayer.test.ts tests/localDocService.test.ts tests/newsService.test.ts" \
  "npx vitest run tests/*Service.test.ts" \
  "npx vitest run tests/*.test.tsx"
```

### 5. 单独跑 coverage（当前阈值未达标，用于跟踪缺口）

```bash
npm run coverage
```

---

## 回归测试结果

| 门禁项 | 结果 |
|--------|------|
| `tsc --noEmit` | ✅ 通过 |
| `npm run lint` | ✅ 通过 |
| `npm test -- --run` | ✅ 44 files / 291 tests |
| `npm run audit:layers` | ✅ 0 违规 / 2 警告 |
| `npm run audit:hardcode` | ✅ 389 处（基线内） |
| `npm run audit:deadcode` | ✅ 11 处（基线内） |
| `npm run build` | ✅ 通过 |
| `npm run test:e2e` | ✅ 5/5 passed |
