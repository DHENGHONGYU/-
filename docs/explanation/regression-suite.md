---
title: regression-suite
code_version: "2.0.0-rc.1"
tier: important
version: v1.0.0
last_updated: 2026-08-11
change_log:
  - version: v1.0.0
    changes: "C 类版本闭环(2026-08-11)：补全 change_log 初始条目"
    date: 2026-08-11
---


# 回归测试套件模板

> **用途**: 定义单次变更或一个 phase 完成后应运行的验证命令
> **来源**: [AGENTS.md](../../AGENTS.md) §十二.4
> **使用方式**: 根据变更规模选择 L1/L2/L3 套件，逐项勾选后归档

---

## L1 轻量（单文件修改 / 类型修复 / 配置调整）

预计耗时：~30s

- [ ] `npm run tsc:prod`
- [ ] 运行与修改相关的单元测试：`npm run test:staged`

---

## L2 标准（模块拆分 / 跨文件重构 / 新增 Store/Service）

预计耗时：~2min

- [ ] L1 全部项
- [ ] `npm run lint`
- [ ] `npm run audit:layers`
- [ ] `npm run audit:deadcode`
- [ ] `npm run audit:docs`

---

## L3 完整（阶段性提交 / PR 合并前 / 核心引擎变更）

预计耗时：~5min

- [ ] L2 全部项
- [ ] `npm run test:clean`
- [ ] `npm run build`
- [ ] `npm run audit`（如时间允许）

---

## 专项回归（按场景追加）

| 场景 | 追加命令 |
|------|---------|
| 新增/修改 MCP Server | `npx vitest run src/mcp/__tests__/mcpAclInterceptor.test.ts` |
| 新增/修改 Widget | `npm run audit:widget-registry` |
| 新增/修改颜色 | `npm run lint:colors` |
| 新增/修改路由 | `npm run audit:routes` |
| 修改数据库 schema | `npx tsc --noEmit` + 相关迁移测试 |

---

## 执行记录

| 日期 | 执行人 | 套件级别 | 结果 | 备注 |
|------|--------|---------|------|------|
| | | | | |


<!-- merge-source: docs/explanation/design/regression-suite.md (2026-07-14 内容融合，避免去重丢失有效信息) -->
## 补充内容（合并自 `../reference/templates/regression-suite.md`）

> 本模板参照 AGENTS.md §12.4 三级回归测试套件。
> 替代"手动决定运行什么"的模式，每个 phase 完成后必须运行对应级别的回归套件。
## 三级回归测试套件
| 级别 | 触发场景 | 包含命令 | 预期耗时 |
| **L1 轻量** | 单文件修改、类型修复 | `tsc --noEmit` + 相关测试 | ~30s |
| **L2 标准** | 模块拆分、跨文件重构 | L1 + `eslint` + `audit:layers` + `audit:deadcode` | ~2min |
| **L3 完整** | 阶段性提交、PR 合并前 | L2 + `npm test -- --run` + `npm run build` | ~5min |
tsc -p tsconfig.json --noEmit
# 相关测试（仅运行受影响的测试文件）
vitest run <affected-test-files> --no-coverage
- 修复单个类型错误
- 修改单个组件内部逻辑
- 添加/修改单个测试用例
tsc -p tsconfig.json --noEmit
vitest run <affected-test-files> --no-coverage
# + ESLint 检查
eslint src/ --ext .ts,.tsx --max-warnings 2000
- 跨文件重构（如 Store 拆分、Service 提取）
- 修改 import 路径
tsc -p tsconfig.json --noEmit
vitest run <affected-test-files> --no-coverage
eslint src/ --ext .ts,.tsx --max-warnings 2000
npm test -- --run
npm run audit
- 阶段性提交（多个 phase 完成后）
- 核心数据层/架构层变更
1. **每个 phase 完成后必须运行对应级别的回归套件**，结果作为 exitCriteria 的一部分
2. **回归套件未通过时不得进入下一 phase**（除非用户明确授权跳过）
3. **回归结果记入任务图**的 phase.exitCriteria 字段
4. **L3 套件中 `npm run audit` 包含全链审计**：layers → hardcode → deadcode → docs → routes → mcp → token → tests → reserved-stores → tokens
