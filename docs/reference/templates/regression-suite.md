---
title: 回归测试套件模板
type: reference
domain: qa
phase: testing
tier: standard
status: active
maintainer: V9 Architecture Team
summary: "本模板参�?AGENTS.md §12.4 三级回归测试套件�?> 替代\"手动决定运行什�?的模式，每个 phase 完成后必须运行对应级别的回归套件�?"
tags: [qa, test, testing, template]
version: v1.0.0
last_updated: 2026-07-17
code_version: 2.0.0
doc_id: V9-DOC-QA-033
referenced_by: [V9-DOC-META-000, V9-DOC-PROJ-176]
change_log:
  - version: v1.0.0
changes: Initial version established
date: 2026-07-17
---

# 回归测试套件模板

> 本模板参�?AGENTS.md §12.4 三级回归测试套件�?> 替代"手动决定运行什�?的模式，每个 phase 完成后必须运行对应级别的回归套件�?
---

## 三级回归测试套件

| 级别 | 触发场景 | 包含命令 | 预期耗时 |
|:-----|:---------|:---------|:---------|
| **L1 轻量** | 单文件修改、类型修�?| `tsc --noEmit` + 相关测试 | ~30s |
| **L2 标准** | 模块拆分、跨文件重构 | L1 + `eslint` + `audit:layers` + `audit:deadcode` | ~2min |
| **L3 完整** | 阶段性提交、PR 合并�?| L2 + `npm test -- --run` + `npm run build` | ~5min |

---

## L1 轻量套件

```bash
# 类型检�?tsc -p tsconfig.json --noEmit

# 相关测试（仅运行受影响的测试文件�?vitest run <affected-test-files> --no-coverage
```

**适用场景**�?- 修复单个类型错误
- 修改单个组件内部逻辑
- 添加/修改单个测试用例

## L2 标准套件

```bash
# L1 全部命令
tsc -p tsconfig.json --noEmit
vitest run <affected-test-files> --no-coverage

# + ESLint 检�?eslint src/ --ext .ts,.tsx --max-warnings 2000

# + 跨层调用审计
npm run audit:layers

# + 死代码审�?npm run audit:deadcode
```

**适用场景**�?- 模块拆分/合并
- 跨文件重构（�?Store 拆分、Service 提取�?- 新增模块/页面
- 修改 import 路径

## L3 完整套件

```bash
# L2 全部命令
tsc -p tsconfig.json --noEmit
vitest run <affected-test-files> --no-coverage
eslint src/ --ext .ts,.tsx --max-warnings 2000
npm run audit:layers
npm run audit:deadcode

# + 全量测试
npm test -- --run

# + 构建
npm run build

# + 完整审计�?npm run audit
```

**适用场景**�?- 阶段性提交（多个 phase 完成后）
- PR 合并�?- 发布前回�?- 核心数据�?架构层变�?
---

## 规则

1. **每个 phase 完成后必须运行对应级别的回归套件**，结果作�?exitCriteria 的一部分
2. **回归套件未通过时不得进入下一 phase**（除非用户明确授权跳过）
3. **回归结果记入任务�?*�?phase.exitCriteria 字段
4. **L3 套件�?`npm run audit` 包含全链审计**：layers �?hardcode �?deadcode �?docs �?routes �?mcp �?token �?tests �?reserved-stores �?tokens
