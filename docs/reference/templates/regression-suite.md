---
title: regression-suite
tier: important
code_version: 2.0.0
---

---
tier: important
code_version: 2.0.0
---

# 回归测试套件模板

> 本模板参照 AGENTS.md §12.4 三级回归测试套件。
> 替代"手动决定运行什么"的模式，每个 phase 完成后必须运行对应级别的回归套件。

---

## 三级回归测试套件

| 级别 | 触发场景 | 包含命令 | 预期耗时 |
|:-----|:---------|:---------|:---------|
| **L1 轻量** | 单文件修改、类型修复 | `tsc --noEmit` + 相关测试 | ~30s |
| **L2 标准** | 模块拆分、跨文件重构 | L1 + `eslint` + `audit:layers` + `audit:deadcode` | ~2min |
| **L3 完整** | 阶段性提交、PR 合并前 | L2 + `npm test -- --run` + `npm run build` | ~5min |

---

## L1 轻量套件

```bash
# 类型检查
tsc -p tsconfig.json --noEmit

# 相关测试（仅运行受影响的测试文件）
vitest run <affected-test-files> --no-coverage
```

**适用场景**：
- 修复单个类型错误
- 修改单个组件内部逻辑
- 添加/修改单个测试用例

## L2 标准套件

```bash
# L1 全部命令
tsc -p tsconfig.json --noEmit
vitest run <affected-test-files> --no-coverage

# + ESLint 检查
eslint src/ --ext .ts,.tsx --max-warnings 2000

# + 跨层调用审计
npm run audit:layers

# + 死代码审计
npm run audit:deadcode
```

**适用场景**：
- 模块拆分/合并
- 跨文件重构（如 Store 拆分、Service 提取）
- 新增模块/页面
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

# + 完整审计链
npm run audit
```

**适用场景**：
- 阶段性提交（多个 phase 完成后）
- PR 合并前
- 发布前回归
- 核心数据层/架构层变更

---

## 规则

1. **每个 phase 完成后必须运行对应级别的回归套件**，结果作为 exitCriteria 的一部分
2. **回归套件未通过时不得进入下一 phase**（除非用户明确授权跳过）
3. **回归结果记入任务图**的 phase.exitCriteria 字段
4. **L3 套件中 `npm run audit` 包含全链审计**：layers → hardcode → deadcode → docs → routes → mcp → token → tests → reserved-stores → tokens
