---
skill_id: V9-SKILL-COLLECTION
name: collection-pipeline-testing
title: "采集链路测试与修复标准工作流"
description: "FinSightV9 数据采集链路（sevenDimConfigStore + collectionPipeline 及其依赖）改动后的标准化测试、修复与门禁验证流程。基于 ①-⑦ 修复全流程的 16 条教训提炼。"
agent_created: true
category: code-quality
triggers:
  keywords: [采集链路, 七维, collectionPipeline, sevenDimConfigStore, 采集维度, 采集测试, 联动测试]
  files:
    - "src/store/sevenDimConfigStore.ts"
    - "src/services/data-collector/**"
    - "src/types/modules/collection.types.ts"
    - "tests/__tests__/sevenDimConfigStore.test.ts"
    - "tests/unit/sevenDimEstimate.test.ts"
  events: [test-failure]
gates:
  - "npx tsc --noEmit"
  - "npm run tsc:prod"
  - "npm run audit:layers"
  - "node ./node_modules/vitest/vitest.mjs run tests/__tests__/sevenDimConfigStore.test.ts"
mandatory: true
covers_docs: [V9-DOC-DATA-054, V9-DOC-QA-046, V9-DOC-DATA-036, docs/archive/reference-historical/data-collection-route-ui-audit.md, V9-DOC-DATA-064]
---

# 采集链路测试与修复标准工作流

## 执行流程

### 阶段 1: 改动影响分析

```bash
# 1.1 确认改动文件
git diff --name-only

# 1.2 对每个改动文件，识别所有消费者
grep -rn 'import.*from.*{改动模块}' src/ tests/

# 1.3 特别检查：类型定义改动需搜索所有 import 该类型的文件
grep -rn 'import.*type.*CollectionTraceSpan' src/ tests/
```

**输出**: 影响面清单（文件 × 风险级别）

### 阶段 2: 分场景检查清单

#### 场景 A: Store 状态字段改动

- [ ] `grep -rn 'oldFieldName' tests/` — 测试文件全部同步
- [ ] `grep -rn 'oldFieldName' src/` — 所有消费者同步
- [ ] 旧字段 boolean → 集合类型时，检查守卫逻辑从 `if (state.isXxx)` 变为 `if (state.xxxArray.length > 0)`
- [ ] `beforeEach` / `reset` / `initialState` 包含新字段

#### 场景 B: 数据源新增外部只读依赖

- [ ] 列出所有 `useXxxStore.getState().xxx` — 确认每个被依赖的 Store 在测试中提供了种子数据
- [ ] 核实种子数据的最小字段集（参考依赖方实际访问的属性）
- [ ] 种子数据为空会导致提前 return 的场景，必须种子化

#### 场景 C: Mock 含模块初始化逻辑的模块

- [ ] 审查 mock 目标是否有 file-level side effects（顶层 `const x = init()` / `createXxx()` 等）
- [ ] 如果有 → 必须使用 `importActual` + 局部覆盖，禁止全量替换

```typescript
// ✅ 正确模式
vi.mock('@/services/xxx', async () => {
  const actual = await vi.importActual<typeof import('@/services/xxx')>('@/services/xxx')
  return { ...actual, onlyMockThisFunction: vi.fn().mockResolvedValue(...) }
})

// ❌ 错误模式
vi.mock('@/services/xxx', () => ({
  onlyMockThisFunction: vi.fn(),
  upgradeDimensionsToPipeline: vi.fn((x) => x),  // 丢失原始逻辑！
}))
```

#### 场景 D: Envelope/DataBridge 写入路径改动

- [ ] 确认 payload 扁平化：不再使用 `{ store, data }` 包装
- [ ] 所有 catch 分支对称调用 `recordWrite(false)`
- [ ] `grep -rn 'recordWrite' src/services/data-collector/` 确认每个 try 对应至少一个 catch 里有 `recordWrite(false)`

#### 场景 E: 跨文件重命名

- [ ] `grep -rn 'oldName' src/ tests/` — 0 残留
- [ ] `npx tsc --noEmit` + `npm run tsc:prod` 双检全绿

### 阶段 3: 门禁验证（全绿方可交付）

```bash
# 类型检查（双检）
npx tsc --noEmit
npm run tsc:prod

# 分层审计
npm run audit:layers

# 相关单元测试
node ./node_modules/vitest/vitest.mjs run tests/__tests__/sevenDimConfigStore.test.ts
node ./node_modules/vitest/vitest.mjs run tests/unit/sevenDimEstimate.test.ts

# 全局残留检查
grep -rn 'isCollecting' tests/__tests__/sevenDimConfigStore.test.ts  # 应仅剩初始化和完成断言
grep -rn '{ store, data }' src/services/data-collector/  # 应 0 结果
```

### 阶段 4: 联动测试补充（新增功能必须覆盖）

**P0: 必须覆盖的 4 个联动场景**

| 场景 | 测试内容 | 关键断言 |
|---|---|---|
| 按钮锁定 | 采集启动 → `isClickable()`=false → 完成 → 恢复 | `collectProgress` 0→100 |
| 维度级锁定 | 维度 01 采集中 → `isClickable('01')`=false, `isClickable('02')`=true | 未锁维度可操作 |
| 守卫拦截 | collectingDimensions 非空 → `runCollection()` 不执行 | 不会重复触发 |
| 保存优先 | isSaving=true → `isClickable()`=false | 保存 > 采集 > 空闲 |

**完整联动测试方案**: 参见 `outputs/reports/2026-07-18-collection-pipeline-lessons-and-skill.md` §四

## 经验教训速查

| # | 教训 | 关键词 |
|---|---|---|
| L1 | 全量 Grep 验证，不信'声称 N 处' | search-completeness |
| L4 | tsc --noEmit + tsc:prod 双检 | gatekeeping-dual |
| L6 | 映射表类型必须精确，禁用宽类型 | type-precision |
| L8 | 重命名必须 grep 全 src+tests | rename-sop |
| L10 | 测试需种子化所有外部 Store 依赖 | seed-data |
| L12 | Mock 含初始化逻辑的模块用 importActual | mock-importActual |
| L14 | 并发状态禁止用 boolean | set-over-boolean |
| L15 | recordWrite 双路径对称 | symmetric-tracking |

## 关联文档

- 诊断报告: `outputs/reports/2026-07-17-collection-flow-diagnosis.md`
- 经验总结: `outputs/reports/2026-07-18-collection-pipeline-lessons-and-skill.md`
- 项目记忆: `.workbuddy/memory/2026-07-18.md`
- 架构契约: `AGENTS.md`
