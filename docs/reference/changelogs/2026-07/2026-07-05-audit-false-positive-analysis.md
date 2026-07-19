---
title: 审计脚本误报分析报告
type: reference
domain: qa
phase: testing
tier: standard
status: active
maintainer: V9 Architecture Team
summary: "报告编号: FP-2026-07-05-001 生成时间: 2026-07-05 分析对象: `audit-layer-calls.ts` v2.0 �?v2.1 误报类型:..."
tags: [qa, audit, analysis]
version: v1.0.0
last_updated: 2026-07-17
code_version: 2.0.0
doc_id: V9-DOC-QA-031
change_log:
  - version: v1.0.0
changes: Initial version established
date: 2026-07-17
---

# 审计脚本误报分析报告

> **报告编号**: FP-2026-07-05-001
> **生成时间**: 2026-07-05
> **分析对象**: `audit-layer-calls.ts` v2.0 �?v2.1
> **误报类型**: 跨层调用检测误�?> **影响范围**: 7 处误报（constants �?3 �?+ services �?4 处）

---

## 一、误报清�?
### 1.1 constants 层误报（3 处）

| # | 文件 | 行号 | 审计报告声称 | 实际代码 | 结论 |
|---|------|------|--------------|----------|------|
| 1 | `src/constants/backtest.constants.ts` | 8 | `import type { BacktestStrategy } from '@/store/backtestStore'` | `import type { BacktestStrategy } from '@/types/modules/backtest.types'` | �?合法 |
| 2 | `src/constants/execution.constants.ts` | 6 | `import type { ExecutionPhase } from '@/data/types'` | `import type { ExecutionPhase } from '@/types/modules/execution.types'` | �?合法 |
| 3 | `src/constants/score.constants.ts` | 7 | `import type { ScoreTrendPeriod } from '@/services/analysis/scoreTrendService'` | `import type { ScoreTrendPeriod } from '@/types/modules/score.types'` | �?合法 |

### 1.2 services 层误报（4 处）

| # | 文件 | 行号 | 审计报告声称 | 实际代码 | 结论 |
|---|------|------|--------------|----------|------|
| 4 | `src/services/backtest/BacktestEngine.ts` | 28 | `import type { ... } from '@/store/backtestStore'` | `import type { ... } from '@/types/modules/backtest.types'` | �?合法 |
| 5 | `src/services/export/backtestExportService.ts` | 8 | `import type { ... } from '@/store/backtestStore'` | `import type { ... } from '@/types/modules/backtest.types'` | �?合法 |
| 6 | `src/services/system/architectureService.ts` | 18 | `import { useEngineStore } from '@/store/engineStore'` | `import { getAgentSystemStatus } from '@/agents'` | ⚠️ 需确认 |
| 7 | `src/services/trading/tradingService.ts` | 18 | `import { withBroadcast } from '@/store/helpers/withBroadcast'` | `import { withBroadcast } from '@/lib/withBroadcast'` | �?真实违规 |

---

## 二、根因分�?
### 2.1 核心问题：正则表达式匹配逻辑缺陷

**问题代码**（`audit-layer-calls.ts` v2.0）：

```typescript
// �?9行：constants 层检�?const CONSTANTS_IMPORT_BUSINESS = /from\s+['"](?:\.\.\/(services|store|pages|components|apps|portal|cockpit|core|data|lib)\/|@\/(services|store|pages|components|apps|portal|cockpit|core|data|lib)\/)[^'"]+['"]/
```

**缺陷 1：未排除 `@/types/` 路径**

- `@/types/modules/` 是类型定义层，独立于业务�?- 正则表达式将 `@/types/` 误判为业务层

**缺陷 2：未区分 `import type` �?`import`**

- `import type` 是纯类型导入，编译时会被擦除
- 类型导入不应触发跨层调用检�?
**缺陷 3：未明确 `@/agents/` 层归�?*

- `@/agents/` 未在分层规则中定�?- 脚本将其误判�?store �?
### 2.2 误报触发场景

| 场景 | 触发条件 | 误报原因 |
|------|----------|----------|
| 类型导入 | `import type { X } from '@/types/modules/X'` | 正则未排�?`@/types/` |
| 类型导入 | `import type { X } from '@/store/X'` | 未区�?`import type` |
| agents �?| `import { X } from '@/agents'` | 未定�?agents 层归�?|

---

## 三、修复方�?
### 3.1 代码修复（已完成�?
**修复 1：排�?`@/types/` 路径**

```typescript
// v2.1 修复：排�?types �?const CONSTANTS_IMPORT_BUSINESS = /from\s+['"](?:\.\.\/(services|store|pages|components|apps|portal|cockpit|core|data|lib)\/(?!types\/)|@\/(services|store|pages|components|apps|portal|cockpit|core|data|lib)\/(?!types\/))[^'"]+['"]/
```

**修复 2：跳�?`import type` 语句**

```typescript
// v2.1 新增：检�?import type（类型导入应豁免�?const IMPORT_TYPE_PATTERN = /^\s*import\s+type\s+/

// 在扫描循环中
if (IMPORT_TYPE_PATTERN.test(raw)) continue
```

**修复 3：明�?`@/agents/` 层归�?*

- �?AGENTS.md 中补�?agents 层定�?- �?`@/agents/` 归类�?core 层扩�?
### 3.2 文档修复（待执行�?
**更新 AGENTS.md**�?
```markdown
## 一、项目分层规则（禁止跨层调用�?
```
src/config/       �?配置层（零硬编码锚点�?src/core/         �?核心工具与类型守卫（DataBridge/ACL/Envelope/MemoryCache/EventBus�?src/agents/       �?Agent 层（core 层扩展，提供智能代理能力�?src/data/         �?数据层（IndexedDB/dataLayer/queryBuilder/types�?src/types/        �?类型定义层（纯类型定义，独立于业务层�?...
```

### 依赖方向规则

- `types/` �?零依赖（纯类型定义，可被所有层引用�?- `agents/` �?仅可依赖 `core/` �?`data/`（属�?core 层扩展）
```

---

## 四、验证结�?
### 4.1 修复�?
```powershell
npm run audit:layers
# 输出�? violations
```

### 4.2 修复�?
```powershell
npm run audit:layers
# 预期输出�? violation（submitOrder.useCase.ts�?```

---

## 五、误报处�?SOP（标准作业程序）

### 5.1 误报发现流程

1. **发现误报**：审计报告与实际代码不符
2. **记录误报**：填写误报清单（文件、行号、声称、实际）
3. **根因分析**：定位审计脚本缺�?4. **修复方案**：修改正则表达式/检测逻辑
5. **验证修复**：运行审计脚本确认误报消�?6. **文档更新**：同步更�?AGENTS.md、CHANGELOG.md

### 5.2 误报分析报告模板

```markdown
# 审计脚本误报分析报告

> **报告编号**: FP-YYYY-MM-DD-XXX
> **生成时间**: YYYY-MM-DD
> **分析对象**: 审计脚本名称及版�?> **误报类型**: 误报分类
> **影响范围**: 误报数量及涉及文�?
---

## 一、误报清�?
| # | 文件 | 行号 | 审计报告声称 | 实际代码 | 结论 |
|---|------|------|--------------|----------|------|

## 二、根因分�?
### 2.1 核心问题
### 2.2 误报触发场景

## 三、修复方�?
### 3.1 代码修复
### 3.2 文档修复

## 四、验证结�?
### 4.1 修复�?### 4.2 修复�?
## 五、误报处�?SOP
```

### 5.3 误报预防措施

1. **测试用例覆盖**：为审计脚本编写单元测试，覆盖边界情�?2. **白名单机�?*：对合法模式添加白名单注�?3. **定期审查**：每季度审查审计脚本的误报率
4. **版本控制**：审计脚本版本号与检测规则同步更�?
---

## 六、变更日�?
| 版本 | 日期 | 变更摘要 |
|------|------|----------|
| v2.1 | 2026-07-05 | 修复误报：排�?`@/types/` 路径、跳�?`import type`、明�?`@/agents/` 归属 |
| v2.0 | 2026-07-04 | 初始版本：检�?services/lib/constants 层跨层调�?|

---

> **下一�?*�?> 1. 更新 AGENTS.md 补充 types/agents 层定�?> 2. 运行 `npm run audit:layers` 验证修复结果
> 3. 更新 CHANGELOG.md 记录本次修复
