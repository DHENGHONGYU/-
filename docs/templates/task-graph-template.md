# 任务图模板

> 本模板参照 AGENTS.md §12.3 任务图核心结构。
> 每个复杂任务必须建立任务图，包含以下组成部分。

---

## rootTask（根任务）

| 字段 | 内容 |
|:-----|:-----|
| **intent** | 用户原始意图描述 |
| **successCriteria** | 成功标准（可验证的退出条件） |
| **constraints** | 约束条件（范围边界、不可触碰文件等） |

## contextAnchor（上下文锚点）

| 锚点 | 快照内容 |
|:-----|:---------|
| **意图锚点** | 当前操作是否服务于 rootTask.intent？ |
| **范围锚点** | 当前操作是否超出 phase 边界？ |
| **状态锚点** | 工作区状态（git status / git log --oneline -5）是否与预期一致？ |

## phases（阶段分解）

### Phase 1: [阶段名称]

| 字段 | 内容 |
|:-----|:-----|
| **tasks** | 本阶段任务清单 |
| **dependsOn** | 依赖的前置阶段（无则填"无"） |
| **verificationLevel** | L1 轻量 / L2 标准 / L3 完整 |
| **exitCriteria** | 退出条件（含回归测试结果） |

```
任务清单:
  ├─ 1.1 [任务描述] → 预期产出
  ├─ 1.2 [任务描述] → 预期产出
  └─ 1.3 [任务描述] → 预期产出
```

### Phase 2: [阶段名称]

| 字段 | 内容 |
|:-----|:-----|
| **tasks** | ... |
| **dependsOn** | Phase 1 |
| **verificationLevel** | L2 标准 |
| **exitCriteria** | ... |

## tokenBudget（Token 预算）

| 字段 | 内容 |
|:-----|:-----|
| **budget** | 预估 token 上限 |
| **consumed** | 已消耗 token（动态更新） |
| **overrunStrategy** | 超预算策略（如：暂停并汇报用户、收缩范围、跳过非关键验证） |

---

## 使用说明

1. **任务开始前**：填写 rootTask + contextAnchor，运行状态前置检查门禁（§12.2）
2. **每个 phase 开始前**：对照 contextAnchor 三个锚点，确认无漂移
3. **每个 phase 完成后**：运行对应 verificationLevel 的回归套件，结果记入 exitCriteria
4. **触发暂停的条件**（硬性规则）：
   - staged 文件数与 phase 预期不符
   - 发现非本 phase 引入的文件变更
   - pre-commit hook 修改了非 staged 文件
   - token 消耗超过预算 80%
