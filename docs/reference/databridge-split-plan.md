---
title: databridge-split-plan
code_version: "2.0.0-rc.1"
tier: important
version: v1.0
last_updated: 2026-08-11
change_log:
  - version: v1.0
    changes: "C 类版本闭环(2026-08-11)：补全 change_log 初始条目"
    date: 2026-08-11
---


# databridge.ts 详细分拆方案

> **版本**: v1.0 | **日期**: 2026-07-07
> **状态**: 待实施
> **优先级**: 🔴 高（13 个循环依赖根因 + 跨层违规）

---

## 一、当前状态分析

### 1.1 文件基本信息

| 指标 | 数值 |
|------|------|
| 文件路径 | [src/core/databridge.ts](../../src/core/databridge.ts) |
| 行数 | 568 行 |
| 大小 | 24KB |
| 已拆分子模块 | 2 个（databridgeHandlers.ts + databridgeStrategyRouter.ts） |
| tsc 错误 | 0（无 databridge 相关错误） |

### 1.2 已完成拆分

| 子模块 | 行数 | 职责 | 状态 |
|--------|------|------|------|
| [databridgeHandlers.ts](../../src/core/databridgeHandlers.ts) | - | EnvelopeHandler 类族 + HandlerRegistry | ✅ 已拆分 |
| [databridgeStrategyRouter.ts](../../src/core/databridgeStrategyRouter.ts) | - | 策略路由逻辑（STRATEGY_CHANNEL + routeToStrategy） | ✅ 已拆分（含违规） |

### 1.3 当前 databridge.ts 结构（568 行）

```
databridge.ts (568 行)
├── 第 1-35 行：imports + re-exports
├── 第 37-47 行：常量（FORWARD_SLOW_THRESHOLD_MS / BROADCAST_SLOW_THRESHOLD_MS）
├── 第 52-105 行：ACTION_TO_STORE_MAP + inferStore() 函数（路由映射表）
├── 第 107-132 行：QueryRequest / QueryResult 接口
├── 第 134-566 行：DataBridge 类
│   ├── query()（144-247 行）：读操作（缓存 + ACL + 审计）
│   ├── invalidateCache()（253-261 行）：缓存失效
│   ├── buildCacheKey()（263-272 行）：缓存 key 构建
│   ├── writeQueryAuditLog()（274-285 行）：查询审计日志
│   ├── forward()（287-367 行）：写操作入口（ACL + 路由 + 广播）
│   ├── subscribe()（369-397 行）：频道订阅机制
│   ├── isMarketEnvelope()（399-401 行）：市场信封判断
│   ├── failedEnvelopes / retryFailed()（403-425 行）：重试机制
│   ├── routeToDB()（427-453 行）：DB 路由
│   ├── routeToManager()（455-492 行）：管理器路由
│   ├── writeAuditLog()（494-523 行）：审计日志
│   └── broadcast()（525-565 行）：广播机制
└── 第 568 行：export const dataBridge = new DataBridge()
```

### 1.4 跨层依赖违规

[databridgeStrategyRouter.ts:16-18](../../src/core/databridgeStrategyRouter.ts) 存在 core → services 违规：

```typescript
// ❌ 违规：core 层依赖 services 层
import { analyze as analyzeHotSector } from '@/services/scoring/hotSectorAnalyzer'
import { detect as detectRotation } from '@/services/scoring/rotationSignalDetector'
import { analyze as analyzeValuePit } from '@/services/scoring/valuePitAnalyzer'
```

**根因**：策略路由逻辑直接调用 services 层的分析器，形成 core → services 依赖，违反 AGENTS.md §1 分层规则。

---

## 二、分拆方案

### 2.1 方案 A：维持当前结构（推荐）

**理由**：
1. **568 行在合理范围**（<600 行阈值）
2. **DataBridge 类方法紧密耦合**（共享 private 字段：subscribers/fallbackQueue/handlerRegistry/readCache）
3. **已有 2 个子模块拆分**，核心职责已分离
4. **拆分风险 > 收益**（强制拆分会破坏封装性）

**仅需修复**：databridgeStrategyRouter.ts 的跨层违规。

### 2.2 方案 B：进一步拆分（可选）

如需进一步降低单文件行数，可提取以下模块：

| 新模块 | 提取内容 | 行数 | 风险 |
|--------|----------|------|------|
| `databridgeRouteMap.ts` | ACTION_TO_STORE_MAP + inferStore() | ~60 | 低（纯数据 + 纯函数） |
| `databridgeAuditLog.ts` | writeAuditLog() + writeQueryAuditLog() | ~50 | 低（独立功能） |
| `databridgeTypes.ts` | QueryRequest + QueryResult + EnvelopeCallback | ~30 | 低（纯类型） |

**拆分后 databridge.ts**：约 430 行（568 - 140）

### 2.3 跨层违规修复方案（必须实施）

**目标**：消除 databridgeStrategyRouter.ts 的 core → services 依赖

**方案：依赖注入**

```typescript
// databridgeStrategyRouter.ts（修改后）
// ❌ 删除：import { analyze as analyzeHotSector } from '@/services/scoring/hotSectorAnalyzer'
// ✅ 改为：通过接口注入

export interface StrategyAnalyzers {
  hotSector: (input: HotSectorAnalyzerInput) => Promise<unknown>
  rotation: (input: RotationSignalInput) => Promise<unknown>
  valuePit: (input: ValuePitAnalyzerInput) => Promise<unknown>
}

export function createStrategyRouter(analyzers: StrategyAnalyzers) {
  return function routeToStrategy(envelope: StandardEnvelope, ctx: StrategyRouterContext) {
    // 使用注入的 analyzers 而非直接 import
  }
}
```

```typescript
// databridge.ts（修改后）
import { analyze as analyzeHotSector } from '@/services/scoring/hotSectorAnalyzer'  // ❌ 仍在 core 层
// 改为：在 apps/ 或 portal/ 层注入

// 更好的方案：在 apps/ 层初始化时注入
// src/apps/analysis/AnalysisApp.tsx
const strategyRouter = createStrategyRouter({
  hotSector: analyzeHotSector,
  rotation: detectRotation,
  valuePit: analyzeValuePit,
})
dataBridge.setStrategyRouter(strategyRouter)
```

---

## 三、实施步骤

### 阶段 1：跨层违规修复（必须）

| 步骤 | 操作 | 风险 |
|------|------|------|
| 1.1 | 在 databridgeStrategyRouter.ts 定义 StrategyAnalyzers 接口 | 低 |
| 1.2 | 修改 routeToStrategy 接收 analyzers 参数 | 中 |
| 1.3 | 在 apps/ 层初始化时注入 analyzers | 中 |
| 1.4 | 删除 databridgeStrategyRouter.ts 的 services import | 低 |
| 1.5 | 运行 tsc + audit:layers 验证 | - |

### 阶段 2：可选拆分（方案 B）

| 步骤 | 操作 | 风险 |
|------|------|------|
| 2.1 | 提取 databridgeRouteMap.ts（ACTION_TO_STORE_MAP） | 低 |
| 2.2 | 提取 databridgeAuditLog.ts（审计日志方法） | 低 |
| 2.3 | 提取 databridgeTypes.ts（接口定义） | 低 |
| 2.4 | 更新 databridge.ts 的 imports | 低 |
| 2.5 | 运行 tsc + audit:layers + test 验证 | - |

---

## 四、预期效果

### 4.1 阶段 1 效果

| 指标 | 优化前 | 优化后 |
|------|--------|--------|
| 跨层违规 | 3 处（core → services） | 0 处 |
| 循环依赖根因 | databridgeStrategyRouter 参与循环 | 消除 |
| audit:layers 违规数 | 减少 3 处 | - |

### 4.2 阶段 2 效果（方案 B）

| 指标 | 优化前 | 优化后 |
|------|--------|--------|
| databridge.ts 行数 | 568 行 | ~430 行 |
| 模块数 | 3（databridge + 2 子模块） | 6（databridge + 5 子模块） |
| 单一职责 | 混杂路由/审计/类型 | 职责分离 |

---

## 五、风险评估

| 风险项 | 概率 | 影响 | 缓解措施 |
|--------|------|------|----------|
| 依赖注入改造影响调用方 | 中 | 中 | 保持 dataBridge 公共 API 不变 |
| 策略路由逻辑行为变化 | 低 | 高 | 添加单元测试验证 |
| 子模块拆分导致循环依赖 | 低 | 中 | 使用 madge 检测 |

---

## 六、验证清单

- [ ] `npx tsc --noEmit` 无错误
- [ ] `npm run audit:layers` 跨层违规减少
- [ ] `npx madge --circular` 循环依赖减少
- [ ] `npm test -- --run` 测试通过
- [ ] dataBridge 公共 API 不变（向后兼容）

---

## 七、决策建议

**推荐方案**：
1. **立即实施阶段 1**（跨层违规修复）—— 消除 13 个循环依赖的根因之一
2. **暂缓阶段 2**（可选拆分）—— 568 行可接受，优先处理违规问题

是否按此方案实施？
