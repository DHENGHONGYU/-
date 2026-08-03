---
title: pr-8-dedup-plan
type: reference
domain: project
phase: planning
status: active
maintainer: V9 Architecture Team
summary: "消除 audit:split-quality 检测到的 8 处 AP-007 重复函数违规，通过："
tags: [project, changelog, plan, reference, governance, documentation, strategy]
version: v1.0.0
last_updated: 2026-07-17
code_version: 2.0.0
doc_id: V9-DOC-PROJ-085
related_docs: [V9-DOC-QA-025, V9-DOC-PROJ-083, V9-DOC-ARCH-004]
referenced_by: [V9-DOC-PROJ-174, V9-DOC-META-000, V9-DOC-PROJ-176, V9-DOC-PROJ-149]
change_log:
  - version: v1.0.0
changes: Initial version established
date: 2026-07-17
tier: T1
---

# PR-8 重复函数去重重构方案

> **Version**: v1.0.0 | **日期**: 2026-07-08
> **方案状态**: ? 方案制定完成，待审批实施
> **前置依赖**: PR-7（tradeErrorClassifier 拆分）已完成
> **关联审计报告**: [pr-8-dedup-audit-report_changelogs.md](pr-8-dedup-audit-report.md)
> **架构原则**: AP-007 重复代码检测（策略 A：保守合并）

---

## 一、方案概览

### 1.1 目标

消除 audit:split-quality 检测到的 8 处 AP-007 重复函数违规，通过：
- **A 类（5 对）**：合并逻辑完全一致的函数为单一来源
- **B 类（2 对）**：重命名同名不同语义的函数以消除歧义
- **C 类（1 对）**：提取通用评分框架消除结构相似代码

### 1.2 预期成果

| 指标 | 当前 | 目标 | 改善 |
|------|------|------|------|
| AP-007 违规数 | 8 | 0 | -100% |
| 重复代码行数 | ~80 行 | 0 | -100% |
| 新增公共函数 | - | 3 个 | +3 |
| 涉及文件数 | 11 | 11 | 0 |
| 测试用例新增 | - | ~15 | +15 |

### 1.3 实施原则

1. **保守合并**（AP-007 策略 A）：仅合并逻辑完全一致的函数，相似但有差异的保持独立
2. **re-export 兼容**：合并后主文件保留 re-export，确保调用点零修改
3. **分批执行**：按风险等级分 3 批（P0→P1→P2），每批完成后验证
4. **可回滚**：每批独立可回滚，回滚后重新运行审计确认

---

## 二、分批执行计划

### 批次 A：P0 — 逻辑完全一致函数合并（低风险）

**执行顺序**: A1 → A2 → A3
**预计影响**: 5 对函数合并，AP-007 违规减少 5 处

#### A1: `now()` 合并

| 项目 | 内容 |
|------|------|
| **优先级** | P0 |
| **风险** | ?? 低 |
| **影响文件** | 2 文件（timeUtils.ts + db-utils.ts） |
| **调用点** | 3 处（dataLayer 通过 db.ts re-export） |
| **回滚方式** | git checkout timeUtils.ts |

**操作清单**:
1. 修改 `src/lib/format.ts`
   - 删除 `export function now()` 定义
   - 添加 `export { now } from '@/data/db-utils'`（re-export 保持兼容）
2. 运行 `npx tsc --noEmit` 验证类型
3. 运行 `npm test -- --run` 验证测试
4. 运行 `npm run audit:split-quality` 确认 AP-007 减少 1

**验证标准**:
- tsc 0 错误
- 所有测试通过
- AP-007 违规从 8 降至 7

---

#### A2: `formatIndustryDelta` + `formatIntelligentDelta` 合并

| 项目 | 内容 |
|------|------|
| **优先级** | P0 |
| **风险** | ?? 低 |
| **影响文件** | 5 文件（1 新增 lib/format.ts + 4 修改） |
| **调用点** | 0 处跨文件 import（仅内部使用） |
| **回滚方式** | git checkout lib/format.ts + 4 文件 |

**操作清单**:
1. 新增 `src/lib/format.ts`
   - 创建 `formatScoreDelta(current, previous): string` 函数
2. 修改 `src/hooks/cabin/useIndustryScorePage.ts:37-43`
   - 删除本地 `formatIndustryDelta` 定义
   - 添加 `import { formatScoreDelta } from '@/lib/format'`
   - 内部调用点改用 `formatScoreDelta`
3. 修改 `src/store/industryScoreStore.ts:64-70`
   - 删除本地 `formatIndustryDelta` 定义
   - 添加 `import { formatScoreDelta } from '@/lib/format'`
   - 添加 `export { formatScoreDelta as formatIndustryDelta } from '@/lib/format'`（向后兼容）
4. 修改 `src/hooks/cabin/useIntelligentScorePage.ts:38-44`
   - 删除本地 `formatIntelligentDelta` 定义
   - 添加 `import { formatScoreDelta } from '@/lib/format'`
5. 修改 `src/store/intelligentScoreStore.ts:68-74`
   - 删除本地 `formatIntelligentDelta` 定义
   - 添加 `import { formatScoreDelta } from '@/lib/format'`
   - 添加 `export { formatScoreDelta as formatIntelligentDelta } from '@/lib/format'`（向后兼容）
6. 运行 `npx tsc --noEmit` 验证类型
7. 运行 `npm test -- --run` 验证测试
8. 运行 `npm run audit:split-quality` 确认 AP-007 减少 2

**验证标准**:
- tsc 0 错误
- 所有测试通过
- AP-007 违规从 7 降至 5

---

#### A3: `toSafeNumber` + `toSafeBoolean` 合并

| 项目 | 内容 |
|------|------|
| **优先级** | P0 |
| **风险** | ?? 低 |
| **影响文件** | 2 文件（safeCoerce.ts + strategyDataAdapter.ts） |
| **调用点** | strategyDataAdapter 内部 13 处 + safeCoerce 被 3 文件 import |
| **回滚方式** | git checkout strategyDataAdapter.ts |

**操作清单**:
1. 修复 `src/lib/safeCoerce.ts:108-113` 的 `toSafeBoolean` bug
   - 将 `value === 1 || value === 'true' || value === 1` 改为 `value === 1 || value === 'true'`
   - 将 `value === 0 || value === 'false' || value === 0` 改为 `value === 0 || value === 'false'`
2. 修改 `src/services/fetcher/strategyDataAdapter.ts`
   - 删除本地 `toSafeNumber` 定义（行 76-80）
   - 删除本地 `toSafeBoolean` 定义（行 97-102）
   - 在导入区添加 `import { toSafeNumber, toSafeBoolean } from '@/lib/safeCoerce'`
3. 运行 `npx tsc --noEmit` 验证类型
4. 运行 `npm test -- --run` 验证测试（重点：strategyDataAdapter 相关测试）
5. 运行 `npm run audit:split-quality` 确认 AP-007 减少 2

**验证标准**:
- tsc 0 错误
- 所有测试通过（特别是 toSafeBoolean 行为测试）
- AP-007 违规从 5 降至 3

---

### 批次 B：P1 — 同名不同语义函数重命名（中风险）

**执行顺序**: B1 → B2
**预计影响**: 2 对函数重命名，AP-007 违规减少 2 处

#### B1: `generateId` 重命名（a11y.ts）

| 项目 | 内容 |
|------|------|
| **优先级** | P1 |
| **风险** | ?? 中 |
| **影响文件** | 1 文件（a11y.ts，孤儿模块） |
| **调用点** | 0 处（a11y.ts 未被任何文件 import） |
| **回滚方式** | git checkout a11y.ts |

**操作清单**:
1. 修改 `src/lib/validation.ts`
   - 将 `export function generateId(prefix = 'a11y')` 重命名为 `export function generateA11yId(prefix = 'a11y')`
   - 更新 JSDoc 注释
2. 运行 `npx tsc --noEmit` 验证类型
3. 运行 `npm test -- --run` 验证测试
4. 运行 `npm run audit:split-quality` 确认 AP-007 减少 1

**验证标准**:
- tsc 0 错误
- 所有测试通过
- AP-007 违规从 3 降至 2

---

#### B2: `bySector` 重命名（hotSectorStore.ts）

| 项目 | 内容 |
|------|------|
| **优先级** | P1 |
| **风险** | ?? 中 |
| **影响文件** | 2 文件（hotSectorStore.ts + hotSectorStore.test.ts） |
| **调用点** | 1 处测试文件 import |
| **回滚方式** | git checkout hotSectorStore.ts hotSectorStore.test.ts |

**操作清单**:
1. 修改 `src/store/hotSectorStore.ts:221-223`
   - 将 `export function bySector(symbol)` 重命名为 `export function bySymbol(symbol)`
   - 更新注释为「按 symbol 查找评分」
2. 修改 `src/store/hotSectorStore.test.ts:2`
   - 将 import 中的 `bySector` 改为 `bySymbol`
   - 更新测试用例中的函数调用
3. 运行 `npx tsc --noEmit` 验证类型
4. 运行 `npm test -- --run` 验证测试（重点：hotSectorStore 测试）
5. 运行 `npm run audit:split-quality` 确认 AP-007 减少 1

**验证标准**:
- tsc 0 错误
- 所有测试通过
- AP-007 违规从 2 降至 1

---

### 批次 C：P2 — 提取通用评分框架（高风险）

**执行顺序**: C1
**预计影响**: 1 对函数重构，AP-007 违规减少 1 处

#### C1: `analyze` 提取通用框架

| 项目 | 内容 |
|------|------|
| **优先级** | P2 |
| **风险** | ?? 高 |
| **影响文件** | 3 文件（1 新增 _shared/weightedScore.ts + 2 修改） |
| **调用点** | 0 处跨文件 import（各自模块入口） |
| **回滚方式** | git checkout hotSectorDimensions.ts valuePitAnalyzer.ts + 删除 _shared/ |

**操作清单**:
1. 新增 `src/services/scoring/v6-engine/engine.ts`
   - 创建 `calculateWeightedScore(dimensions, weights, config)` 函数
   - 创建 `classifyAction(score, thresholds, defaultAction)` 函数
   - 创建 `WeightedScoreConfig` 接口
2. 修改 `src/services/scoring/hotSectorDimensions.ts:365-418`
   - 导入 `calculateWeightedScore, classifyAction`
   - 重构 `analyze` 函数使用通用框架
   - 保持返回类型 `HotSectorScore` 不变
3. 修改 `src/services/scoring/valuePitAnalyzer.ts:328-372`
   - 导入 `calculateWeightedScore, classifyAction`
   - 新增 `VALUE_PIT_THRESHOLDS` 常量（替代硬编码 100/4.0/3.5/3.0）
   - 重构 `analyze` 函数使用通用框架
   - 保持返回类型 `ValuePitScore` 不变
4. 新增测试 `tests/__tests__/services/scoring/weightedScore.test.ts`
   - 测试 `calculateWeightedScore` 正确性
   - 测试 `classifyAction` 阈值分级
5. 运行 `npx tsc --noEmit` 验证类型
6. 运行 `npm test -- --run` 验证测试（重点：hotSector 和 valuePit 测试）
7. 运行 `npm run audit:split-quality` 确认 AP-007 减少 1
8. 运行 `npm run audit:hardcode` 确认无新增硬编码

**验证标准**:
- tsc 0 错误
- 所有测试通过
- AP-007 违规从 1 降至 0
- AP-002 圈复杂度不增加
- 无新增硬编码违规

---

## 三、审批记录表

| 批次 | 状态 | 审批人 | 审批日期 | 备注 |
|------|------|--------|----------|------|
| 批次 A（P0） | ? 待审批 | - | - | 5 对完全一致函数合并 |
| 批次 B（P1） | ? 待审批 | - | - | 2 对同名函数重命名 |
| 批次 C（P2） | ? 待审批 | - | - | 1 对提取通用框架 |

---

## 四、回滚验证流程

每个批次完成后（或回滚后）必须执行以下验证：

```powershell
# 1. 类型检查
npx tsc --noEmit

# 2. 单元测试
npm test -- --run

# 3. 架构审计
npm run audit:layers

# 4. 拆分质量审计
npm run audit:split-quality

# 5. 硬编码审计（批次 C 必需）
npm run audit:hardcode

# 6. 文档同步审计
npm run audit:docs
```

**回滚条件**（任一触发即回滚）：
- tsc 出现错误
- 测试失败
- audit:layers 出现新增违规
- audit:split-quality 违规数未减少

---

## 五、风险评估

### 5.1 高风险点

| 风险点 | 影响 | 缓解措施 |
|--------|------|----------|
| A3: `toSafeBoolean` bug 修复 | 可能改变现有行为 | 先运行现有测试确认基线，修复后对比测试结果 |
| C1: `analyze` 重构 | 评分结果可能变化 | 重构前后对比评分输出，确保数值一致 |
| C1: 新增 `_shared/` 目录 | 可能违反分层规则 | 新增后运行 audit:layers 确认合规 |

### 5.2 回滚预案

```powershell
# 批次 A 回滚
git checkout src/utils/timeUtils.ts
git checkout src/hooks/cabin/useIndustryScorePage.ts src/store/industryScoreStore.ts
git checkout src/hooks/cabin/useIntelligentScorePage.ts src/store/intelligentScoreStore.ts
git checkout src/services/fetcher/strategyDataAdapter.ts src/lib/safeCoerce.ts
Remove-Item src/lib/format.ts -ErrorAction SilentlyContinue

# 批次 B 回滚
git checkout src/utils/a11y.ts
git checkout src/store/hotSectorStore.ts src/store/hotSectorStore.test.ts

# 批次 C 回滚
git checkout src/services/scoring/hotSectorDimensions.ts src/services/scoring/valuePitAnalyzer.ts
Remove-Item src/services/scoring/_shared -Recurse -ErrorAction SilentlyContinue
```

---

## 六、进度跟踪

| 步骤 | 状态 | 完成时间 | 验证结果 |
|------|------|----------|----------|
| 方案制定 | ? 完成 | 2026-07-08 | - |
| 审批 | ? 待审批 | - | - |
| 批次 A 实施 | ? 待执行 | - | - |
| 批次 B 实施 | ? 待执行 | - | - |
| 批次 C 实施 | ? 待执行 | - | - |
| 最终验证 | ? 待执行 | - | - |
| 变更日志 | ? 待生成 | - | - |

---

## 七、参考文档

- [PR-8 审计报告](pr-8-dedup-audit-report.md)
- [PR-7 变更日志](../../../reports/CHANGELOG.md)
- 边界定义同步文档
- [架构标准 §3.16 模块拆分架构原则](../../../specs/03-architecture-standards.md)
- [AP-007 重复代码检测策略 A（保守合并）](../../../specs/03-architecture-standards.md)
