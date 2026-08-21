---
doc_id: V9-DOC-REF-968
title: "useStockAdd Hook API 说明"
domain: ref
status: active
last_updated: 2026-08-15
code_version: 2.0.0-rc.2
---

# useStockAdd Hook API 说明

> 股票添加流程可复用 Hook，封装表单状态管理与 `inputService.addStock` 调用链路。

## 简介

`useStockAdd` 将"添加股票到意向候选池"的完整交互逻辑（表单状态、提交、刷新、错误处理）从组件中抽离，供输入舱内任意需要"添加股票"能力的组件复用，例如 `InputDashboard`、`StockSearch`、未来的批量录入面板等。

## 导入

```typescript
import { useStockAdd } from '@/hooks/useStockAdd'
```

## 签名

```typescript
function useStockAdd(options?: UseStockAddOptions): UseStockAddResult
```

## 参数

### UseStockAddOptions

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `autoClearOnSuccess` | `boolean` | `true` | 添加成功后是否自动清空表单字段（symbol/name/group） |
| `autoRefreshOnSuccess` | `true` | `true` | 添加成功后是否自动调用 `intentionPoolStore.refresh()` 触发 UI 重渲染。关闭后调用方需自行处理 UI 刷新 |
| `initialGroup` | `string` | `''` | 表单 group 字段的初始值 |

## 返回值

### UseStockAddResult

| 字段 | 类型 | 说明 |
|------|------|------|
| `symbol` | `string` | 表单字段：股票代码 |
| `name` | `string` | 表单字段：股票名称 |
| `group` | `string` | 表单字段：目标分组 |
| `setSymbol` | `(v: string) => void` | symbol 字段 setter |
| `setName` | `(v: string) => void` | name 字段 setter |
| `setGroup` | `(v: string) => void` | group 字段 setter |
| `submitting` | `boolean` | 是否正在提交中（用于禁用按钮、显示 loading） |
| `message` | `string` | 用户反馈消息（成功/错误/警告） |
| `clearMessage` | `() => void` | 清空消息 |
| `setMessage` | `(msg: string) => void` | 直接设置消息（供外部事件如 `StockSearch.onSelect` 使用） |
| `handleAdd` | `(fetchBasic: boolean, fetchKline: boolean) => Promise<boolean>` | 核心方法，触发 addStock 流程，返回是否成功 |
| `resetForm` | `() => void` | 重置整个表单状态 |

## 使用示例

### 基础用法

```tsx
import { useStockAdd } from '@/hooks/useStockAdd'
import { Button } from '@/components/atoms/Button'
import { Input } from '@/components/atoms/Input'

function StockAddForm() {
  const {
    symbol, name, group,
    setSymbol, setName, setGroup,
    submitting, message,
    handleAdd,
  } = useStockAdd()

  return (
    <form onSubmit={(e) => { e.preventDefault(); void handleAdd(false, false) }}>
      <Input value={symbol} onChange={(e) => setSymbol(e.target.value)} placeholder="股票代码" />
      <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="股票名称" />
      <Button type="submit" disabled={submitting}>仅录入</Button>
      {message && <p className="text-sm text-muted-foreground">{message}</p>}
    </form>
  )
}
```

### 三种录入模式

```tsx
const { handleAdd, submitting } = useStockAdd()

// 1. 仅录入（不拉取数据）
<Button onClick={() => void handleAdd(false, false)} disabled={submitting}>仅录入</Button>

// 2. 录入并拉取基础数据
<Button onClick={() => void handleAdd(true, false)} disabled={submitting}>录入并拉基础</Button>

// 3. 录入并拉取全部数据（基础+K线）
<Button onClick={() => void handleAdd(true, true)} disabled={submitting}>录入并拉全部</Button>
```

### 关闭自动刷新（自定义 UI 更新逻辑）

```tsx
const { handleAdd, message } = useStockAdd({
  autoRefreshOnSuccess: false,
  autoClearOnSuccess: false,
})

// 调用方自行处理刷新
const onSubmit = async () => {
  const ok = await handleAdd(false, false)
  if (ok) {
    // 自定义刷新逻辑，例如重新加载列表、跳转页面等
    await reloadList()
  }
}
```

### 与外部事件联动（使用 setMessage）

```tsx
const { setSymbol, setName, setMessage } = useStockAdd()

<StockSearch
  mode="fill"
  onSelect={(result) => {
    setSymbol(result.symbol)
    setName(result.name)
    setMessage(`已选择 ${result.symbol} ${result.name}，请选择录入方式`)
  }}
/>
```

## 内部行为说明

### 数据流

```
handleAdd(fetchBasic, fetchKline)
  ├─ 前置校验（symbol/name 非空）
  │    └─ 失败 → setMessage('请输入代码和名称') → return false
  ├─ setSubmitting(true)
  ├─ addStock({symbol, name}, { fetchBasicAfterAdd, fetchKlineAfterAdd, group })
  │    ├─ success: true
  │    │    ├─ setMessage(`已添加 ${symbol}`)
  │    │    ├─ autoClearOnSuccess → 清空表单
  │    │    └─ autoRefreshOnSuccess → await refresh()
  │    │         └─ refresh 失败 → 仅记录 warn 日志，不影响成功反馈
  │    └─ success: false
  │         └─ setMessage(result.error ?? '添加失败')
  └─ catch (err)
       └─ setMessage(`添加异常：${err.message}`)
  └─ finally: setSubmitting(false)
```

### 性能设计

- **useRef 持有 refresh 引用**：避免 `refresh` 函数变化导致 `handleAdd` 重建。`handleAdd` 的依赖数组只包含表单字段，不会因为 store 内部状态变化而频繁重建。
- **useCallback 包装所有 setter/handler**：保证返回的函数引用稳定，避免传递给子组件时触发不必要的重渲染。

### 错误处理

| 错误场景 | 处理方式 |
|----------|----------|
| 表单校验失败（空值） | `setMessage('请输入代码和名称')`，不调用 addStock |
| addStock 返回 `success: false` | `setMessage(result.error)`，不触发 refresh |
| addStock 抛出异常 | `setMessage('添加异常：${err.message}')`，不触发 refresh |
| refresh 失败 | 仅记录 warn 日志，**不影响添加成功的反馈** |

## 关联文件

| 文件 | 说明 |
|------|------|
| [useStockAdd.ts](file:///d:/FinSightV9/src/hooks/useStockAdd.ts) | Hook 实现 |
| [inputService.ts](file:///d:/FinSightV9/src/services/input/inputService.ts) | `addStock` 服务实现 |
| [intentionPoolStore.ts](file:///d:/FinSightV9/src/store/intentionPoolStore.ts) | `refresh` 触发 UI 重渲染 |
| [InputDashboard.tsx](file:///d:/FinSightV9/src/apps/input/InputDashboard.tsx) | 主要消费方 |
| [useStockAdd.test.ts](file:///d:/FinSightV9/src/hooks/useStockAdd.test.ts) | 单元测试 |

## 测试覆盖

测试文件：`src/hooks/useStockAdd.test.ts`

| 测试场景 | 验证内容 |
|----------|----------|
| 空表单提交 | 返回 false，message 为"请输入代码和名称" |
| 成功添加 | 返回 true，表单清空，refresh 被调用 |
| addStock 失败 | 返回 false，refresh 未被调用 |
| addStock 异常 | 返回 false，message 包含异常信息 |
| autoRefreshOnSuccess=false | 成功后 refresh 未被调用 |
| autoClearOnSuccess=false | 成功后表单保留原值 |
| setMessage 外部调用 | message 立即更新 |
