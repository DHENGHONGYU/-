---
title: ADR-016: useStockAdd Hook 封装与 ErrorBoundary 并发安全
type: reference
domain: frontend
phase: implementation
tier: standard
status: active
maintainer: V9 Frontend Team
summary: "将 InputDashboard 内联的 addStock 提交流程抽离为可复用 useStockAdd Hook，并在输入舱外层包裹 InputFlowErrorBoundary 捕获局部渲染错误。经并发分析，ErrorBoundary.onReset 在当前实现（同步 setState + 函数式更新）下不存在状态竞争风险，无需加锁。"
tags: [frontend, input-cabin, zustand, error-boundary, adr, reference, hooks, concurrency]
version: v1.0.0
last_updated: 2026-08-09
code_version: "2.0.0-rc.1"
doc_id: V9-DOC-FRONT-002
referenced_by: [V9-DOC-META-000, V9-DOC-PROJ-108, V9-DOC-PROJ-176]
change_log:
  - version: v1.0.0
    changes: Initial version established
    date: 2026-08-09
---

# ADR-016: useStockAdd Hook 封装与 ErrorBoundary 并发安全

> **状态**: Accepted  
> **决策日期**: 2026-08-09  
> **版本**: v1.0.0

---

## 1. 背景（Context）

在 V9 输入舱 `InputDashboard` 组件中，"添加股票到意向池"的核心交互逻辑（表单状态管理、`addStock` 调用、UI 刷新、错误处理）以**内联**方式实现在组件内部，导致以下问题：

1. **复用性不足**：未来 `StockSearch`、批量录入面板、移动端输入窗等组件需要同样的"添加股票"能力时需要重复实现
2. **内联事件处理性能损耗**：`onClick={() => void handleAdd(false, false)}` 每次渲染都重建闭包，虽然 React 有 diff 优化，但对大列表场景（表格内 100+ 行按钮）累积成本可观
3. **useMemo 依赖缺失**：`getIntentionPoolGroups()` 使用空依赖数组 `[]`，当 `items` 变化时分组下拉框无法自动更新
4. **批量采集串行执行**：`handleCollectAll` 中 `for...of` 串行 await N 个 `fetchBasicDataUseCase`，10 只股票采集需 10 倍延迟
5. **缺乏局部错误边界**：单一子组件（如 GaugeRing、表格渲染）抛出的渲染错误会冒泡到全屏 ErrorBoundary，导致整个输入舱不可用，需要刷新页面恢复

此外，团队对 **ErrorBoundary.onReset 在极端并发场景（快速连击、重渲染期间再抛错、异步事件回调）下是否存在状态竞争** 有疑虑，需要一份明确的分析结论指导后续开发。

## 2. 决策（Decision）

### 2.1 useStockAdd Hook 封装

**采用**：将"添加股票"流程抽离为可复用的 `useStockAdd(options)` Hook，对外暴露完整的表单状态与提交接口。

关键设计：
- 使用 `useRef` 持有 `intentionPoolStore.refresh` 最新引用，避免 `handleAdd` 因 store 内部状态变化而频繁重建
- `setState` 所有 setter 均用 `useCallback` 包装，引用稳定
- 通过 `autoClearOnSuccess` / `autoRefreshOnSuccess` / `initialGroup` 三个开关支持多种调用场景
- 暴露 `setMessage` 供外部事件（如 `StockSearch.onSelect`）直接设置消息
- `refresh` 失败不影响添加成功的反馈（降级策略：只记录 warn 日志）

### 2.2 四项性能优化应用

| 优化项 | 变更前 | 变更后 |
|--------|--------|--------|
| 内联函数 | `onClick={() => handleAdd(...)}` 每次渲染重建 | 7 个 handler 全部 `useCallback` 包装 |
| useMemo 依赖 | `getIntentionPoolGroups()` 空依赖 | 依赖 `[items]` |
| 批量采集 | 串行 `for...of await` | `Promise.allSettled()` 并发执行 |
| 冗余 filter | 计划新增 withPriceCount | 发现 `stats.withPrice` 已在 useMemo 内计算，删除冗余 |

### 2.3 ErrorBoundary 局部崩溃兜底

**采用**：在 `InputApp.tsx` 中使用 `InputFlowErrorBoundary` 包裹整个输入舱内容（含 `<InputDashboard>` 和 Suspense 懒加载子页面），配置 `onReset` 回调通过 `key` 自增强制 InputDashboard 实例重建：

```tsx
const [resetKey, setResetKey] = useState(0)

<InputFlowErrorBoundary
  label="InputApp"
  onReset={() => setResetKey((k) => k + 1)}
>
  {matched.component ? (
    <Suspense fallback={...}>{matched.component}</Suspense>
  ) : (
    <InputDashboard key={resetKey} />
  )}
</InputFlowErrorBoundary>
```

与全屏 `ErrorBoundary` 的区别：
- 紧凑型 inline UI，不占满屏幕
- 支持 `onReset` 回调 + `key` 机制清空错误态
- 可配置 `label` 用于日志区分

### 2.4 ErrorBoundary.onReset 并发安全结论

**无需加锁**。逐项分析如下：

| 并发场景 | 是否竞争 | 关键保证机制 |
|----------|----------|--------------|
| 用户快速连击"重试"按钮 | ❌ 无 | React 18 自动批处理：同一 tick 内多次 `setState({hasError:false})` 幂等；`setResetKey((k) => k+1)` 函数式更新读取 latest state，不丢失计数 |
| onReset 触发重渲染期间子组件又抛错 | ❌ 无 | `getDerivedStateFromError` 同步执行，在下一次 render 之前就把 `hasError` 置回 true；无中间态泄漏 |
| 组件卸载后异步事件（如 BATCH_IMPORT_COMPLETED）触发 setState | ❌ 无 | `useEffect` 返回的清理函数（`return off`）保证卸载时取消事件订阅；React 18 卸载组件 setState 是 no-op |
| 多个 InputFlowErrorBoundary 嵌套内层 onReset 触发外层重渲染 | ❌ 无 | 每个 Boundary 维护独立 state；一次事件回调内所有 setState 在同一批处理完成 |

**唯一需要关注的情况（当前代码已规避）**：如果未来 `onReset` 内出现异步操作（如 `await fetch(...)` 后再调用 `setResetKey`），可能因批处理失效产生竞争，需在回调内部加 `if (mountedRef.current)` 守卫。当前 `onReset` 为纯同步操作，完全安全。

## 3. 原因（Rationale）

### 3.1 useStockAdd 封装的收益

- **团队复用**：任意组件均可通过 `import { useStockAdd } from '@/hooks/useStockAdd'` 一行获取完整的添加股票能力，无需重复表单状态管理和错误处理
- **可测试性**：Hook 独立编写单元测试（空表单/成功/失败/异常/开关组合），无需挂载整个 InputDashboard 组件即可覆盖
- **引用稳定性**：`useCallback` + `useRef` 保证返回的函数引用不随 store 内部状态变化而重建，传递给大列表的行操作按钮时可配合 `React.memo` 实现细粒度重渲染控制
- **数据一致性**：单一来源的 addStock 调用，所有消费方自动获得"自动流转已移除"等后续修复

### 3.2 为什么不用加锁

现代 React（React 18+）在设计上已经对用户可见的并发场景提供了足够的保证：

1. **自动批处理（Automatic Batching）**：同一宏任务 tick 内的所有 `setState` 合并，避免中间不一致状态对用户可见
2. **函数式 setState**：`setState((k) => k + 1)` 确保更新基于最新 state，而非闭包捕获的旧值
3. **getDerivedStateFromError 同步性**：错误捕获到 state 更新在同一个 React 执行上下文中同步完成，没有异步间隙
4. **Effect 清理函数**：`useEffect` 的 `return () => unsubscribe()` 模式从设计上避免了"卸载后 setState"的竞争

在这些保证的前提下，对 `onReset` 额外加锁（如 `useRef + if (locked) return`）是**不必要的过度防御**，会：
- 增加代码复杂度和维护成本
- 引入"锁未释放"的新风险（如 onClick 回调抛异常后锁无法释放）
- 没有提供当前场景下实际需要的额外安全性

## 4. 影响（Consequences）

### 4.1 正面影响

- 新增股票能力可被任意组件复用，无需重复实现
- 4 项性能优化对大列表场景有可感知的 UI 响应提升（特别是批量采集并行化）
- 局部组件崩溃不再需要刷新整页，点击"重试"即可恢复
- 错误经 `captureError` 上报错误总线，配合日志的 `label` 标签可快速定位崩溃来源

### 4.2 负面影响

- `InputDashboard` 从直接依赖 `addStock` 改为依赖 `useStockAdd`，增加了一层间接调用
- 引入的 `InputFlowErrorBoundary` 如果配置不当（如未传 `key` 到子组件），可能出现"点击重试但错误态仍在"的误导体验。本次实现中通过 `resetKey` + InputDashboard 的 `key={resetKey}` 机制规避

### 4.3 后续待办

1. 在其他需要"添加股票"能力的组件（如 StockSearch 的 `add` 模式、批量录入面板）中迁移到 `useStockAdd`，统一调用路径
2. 将 `handleCollectAll` 的 `Promise.allSettled` 并发度限制（如 `p-limit` 并发 5 只一次）加入后续迭代，避免一次性发起过多 fetch 请求被上游限频
3. 补充 `useStockAdd` 的 Vitest 单元测试（当前已在 `InputDashboard.addStock.test.tsx` 间接受测，建议补充 Hook 级独立测试）

## 5. 替代方案（Alternatives Considered）

### 5.1 不做 Hook 封装，保留内联逻辑

**被否决**：复用性为零、测试粒度粗、性能优化需要在每个新组件重复应用。

### 5.2 ErrorBoundary.onReset 使用互斥锁守卫

**被否决**：React 18 的批处理 + 函数式 setState 已提供足够保证。加锁属于过度防御，增加了代码复杂度但无实际收益。见 2.4 节分析。

### 5.3 直接在全屏 ErrorBoundary 做"重试"

**被否决**：全屏 ErrorBoundary 覆盖所有页面，输入舱局部崩溃时点击重试会重置整个应用状态（包括用户已打开的其他面板、填写中的表单），用户体验差。局部 ErrorBoundary 只影响输入舱区域。

## 6. 关联资源

### 代码文件

| 文件 | 说明 |
|------|------|
| [useStockAdd.ts](file:///D:/FinSightV9/src/hooks/useStockAdd.ts) | Hook 实现 |
| [InputDashboard.tsx](file:///D:/FinSightV9/src/apps/input/InputDashboard.tsx) | 主要消费方，集成 useStockAdd + 4 项性能优化 |
| [InputApp.tsx](file:///D:/FinSightV9/src/apps/input/InputApp.tsx) | ErrorBoundary + resetKey 机制集成点 |
| [InputFlowErrorBoundary.tsx](file:///D:/FinSightV9/src/components/organisms/input/InputFlowErrorBoundary.tsx) | 紧凑型局部错误边界实现 |
| [inputService.ts](file:///D:/FinSightV9/src/services/input/inputService.ts) | addStock 服务实现 |
| [intentionPoolStore.ts](file:///D:/FinSightV9/src/store/intentionPoolStore.ts) | refresh UI 更新触发点 |

### 文档与测试

| 文件 | 说明 |
|------|------|
| [useStockAdd.md](file:///D:/FinSightV9/docs/reference/useStockAdd.md) | Hook API 参考文档 |
| [InputDashboard.addStock.test.tsx](file:///D:/FinSightV9/src/apps/input/InputDashboard.addStock.test.tsx) | 集成测试（8/8 通过） |
| [InputFlowErrorBoundary.test.tsx](file:///D:/FinSightV9/src/components/organisms/input/InputFlowErrorBoundary.test.tsx) | ErrorBoundary 并发场景单元测试（6/6 通过） |
