---
title: TradeReviewAI SkillDevelopment 测试说明
type: explanation
domain: qa
phase: design
tier: standard
status: active
maintainer: V9 Architecture Team
summary: "## 1. 测试目标 验证 `TradeReviewAI` 模块中基于交易规则错误提炼 `Skill` 的能力，确保："
tags: [qa, trading, test]
version: v1.0.0
last_updated: 2026-07-17
code_version: 2.0.0
doc_id: V9-DOC-QA-080
referenced_by: [V9-DOC-PROJ-174, V9-DOC-META-000, V9-DOC-PROJ-176, V9-DOC-PROJ-182, V9-DOC-PROJ-149]
change_log:
  - version: v1.0.0
changes: Initial version established
date: 2026-07-17
---

# TradeReviewAI SkillDevelopment 测试说明

## 1. 测试目标

验证 `TradeReviewAI` 模块中基于交易规则错误提炼 `Skill` 的能力，确保：

1. `generateReview()` 生成的 `SkillDevelopment` 结构与 `tradeReview.types.ts` 设计定义一致。
2. 12 类交易错误全部被映射到至少一个技能维度。
3. 技能维度评分、等级、目标等级、Gap 计算逻辑正确。
4. 里程碑（Milestones）和学习路径（LearningPath）按预期生成且关联到正确维度。
5. UI 侧 `AITradeReviewWidget` 可正确渲染新结构而不报错。

## 2. 测试范围

| 范围 | 说明 |
|------|------|
| **被测模块** | `src/services/trading/tradeReviewAI.ts` |
| **依赖模块** | `src/services/trading/tradeErrorClassifier.ts`、`src/data/types.ts`、`src/types/modules/tradeReview.types.ts` |
| **UI 影响面** | `src/cockpit/widgets/AITradeReviewWidget.tsx` 的 Skills Tab |
| **不测试** | LLM 增强版 `generateReviewAsync`、DataBridge 数据接入、浏览器端 IndexedDB |

## 3. 测试环境

- 框架：Vitest 2.x
- 断言库：Vitest 内置 `expect`
- 运行命令：

```bash
# 仅运行本模块测试
npx vitest run src/services/trading/tradeReviewAI.test.ts

# 运行全部测试
npm run test

# TypeScript 编译检查
npm run tsc
```

## 4. 测试文件位置

```
src/services/trading/tradeReviewAI.test.ts
```

## 5. 测试用例清单

### 5.1 SkillDevelopment 结构对齐

| 用例 | 输入 | 预期结果 |
|------|------|---------|
| 生成完整 SkillDevelopment | 2 笔测试订单（含计划违规、重仓、止损问题） | `userId`、`overallLevel`、`updatedAt`、`dimensions`、`milestones`、`learningPath`、`prioritySkills`、`recommendedResources` 均存在且有效 |
| 每个维度字段有效 | 1 笔普通订单 | 所有维度 `code/name/description/currentLevel/targetLevel/score/gap` 字段合法，等级为 5 级枚举之一，分数在 0-100 之间 |

### 5.2 错误到 Skill 的映射覆盖

| 用例 | 输入 | 预期结果 |
|------|------|---------|
| 12 类错误全覆盖 | 遍历 `TradeErrorType` 枚举 | 每种错误类型至少出现在一个 `SKILL_DIMENSIONS` 维度的 `relatedErrors` 中 |
| 止损错误降低 `stop_loss` 评分 | 1 笔 maxDrawdown 很大且触发止损问题的订单 | `stop_loss` 维度评分 < 85 |
| 重仓降低 `position_management` 评分 | `planPositionPct: 0.6` 的订单 | `position_management` 维度评分 < 85 |

### 5.3 技能等级计算

| 用例 | 输入 | 预期结果 |
|------|------|---------|
| 无错误默认 85 分 | 计划遵循、回撤小、仓位轻的订单 | 所有维度评分 = 85，`overallLevel = expert` |
| 严重错误降低等级 | `planPositionPct: 0.8` 的订单 | `position_management.currentLevel = beginner`，`targetLevel = intermediate` |

### 5.4 里程碑与学习路径

| 用例 | 输入 | 预期结果 |
|------|------|---------|
| 里程碑关联维度 | 1 笔普通订单 | 每个 `milestone.skillDimension` 都存在于 `dimensions` 中，`targetLevel` 合法，`criteria` 非空 |
| 学习路径顺序 | 1 笔普通订单 | `learningPath` 按 `order` 升序排列，每个节点包含资源、练习、预计耗时 |

## 6. 关键断言示例

```typescript
expect(skillDevelopment.overallLevel).toMatch(/^(beginner|intermediate|advanced|expert|master)$/)
expect(skillDevelopment.dimensions).toHaveLength(SKILL_DIMENSIONS.length)
expect(stopLossDim!.score).toBeLessThan(85)
```

## 7. 回归测试建议

在每次修改以下文件后，必须运行本测试：

- `src/services/trading/tradeReviewAI.ts`
- `src/services/trading/tradeErrorClassifier.ts`
- `src/types/modules/tradeReview.types.ts`
- `src/cockpit/widgets/AITradeReviewWidget.tsx`

同时建议运行：

```bash
npm run tsc      # 确保类型契约未被破坏
npm run lint     # 确保代码风格合规
```

## 8. 已知限制

1. `SkillDevelopment.dimensions` 运行时接口增加了 `description` 字段（设计文档 `SkillDimension` 未包含），用于里程碑展示。该字段为运行时视图扩展，不改变类型定义契约。
2. 测试仅覆盖同步版 `generateReview()`，LLM 增强版 `generateReviewAsync()` 因依赖外部 API，需单独进行集成测试。
3. 测试使用模拟订单数据，未覆盖真实生产数据流入路径。

## 9. 测试历史

| 日期 | 执行人 | 结果 |
|------|--------|------|
| 2026-06-28 | TRAE | 全部用例通过，`tsc` 通过（除预先存在的 `hotSectorStore.test.ts` 语法错误外） |
