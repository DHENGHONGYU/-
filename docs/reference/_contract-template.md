---
title: _contract-template
code_version: "2.0.0-rc.1"
tier: important
version: v1.0.0
last_updated: 2026-08-11
change_log:
  - version: v1.0.0
    changes: "C 类版本闭环(2026-08-11)：补全 change_log 初始条目"
    date: 2026-08-11
---


# {subdomain}-contract.md — {子域中文名} 接口契约

> **定位**：定义 `{subdomain}` 子域的接口契约、职责边界、数据流与依赖关系。  
> **关联**：`./services-catalog.md`（24 子域总览）、`../../AGENTS.md` §一（分层规则）。

---

## 1. 职责边界

### 1.1 核心职责

- {列出 2-4 条核心职责，如：采集外部行情数据、统一管理股票数据写入}
- {具体职责说明}

### 1.2 分层定位

| 维度 | 说明 |
|------|------|
| 所属层 | `src/services/`（服务层） |
| 依赖方向 | 只能依赖 `core/`、`data/`、`lib/`（白名单） |
| 禁止事项 | 禁止直写 IndexedDB（须经 `DataBridge.forward()`） |
| 被依赖方 | `store/`（状态层）、`pages/`（页面层）可消费本服务输出 |

### 1.3 与相邻子域的关系

| 相邻子域 | 关系 | 数据流 |
|----------|------|--------|
| {upstream} | 上游：提供输入 | `upstream` → `本服务` |
| {downstream} | 下游：消费输出 | `本服务` → `downstream` |

---

## 2. 公共接口

### 2.1 类型定义（TypeScript Interface）

```typescript
// 文件：src/services/{subdomain}/{subdomain}Types.ts

export interface {Subdomain}Input {
  // 输入参数
}

export interface {Subdomain}Output {
  // 输出结果
}

export interface {Subdomain}Config {
  // 配置项
}
```

### 2.2 主入口函数

| 函数 | 签名 | 职责 | 错误处理 |
|------|------|------|----------|
| `load{Entity}()` | `(params: {Subdomain}Input) => Promise<{Subdomain}Output>` | {描述} | `ErrorBus` 上报 + logger 记录 |
| `save{Entity}()` | `(data: {Subdomain}Output) => Promise<void>` | {描述} | `DataBridge.forward()` 路由 |
| `compute{Metric}()` | `(stocks: StockData[]) => {Subdomain}Output` | {描述} | 纯计算，无副作用 |

### 2.3 事件接口

| 事件名 | 发布方 | 订阅方 | 说明 |
|--------|--------|--------|------|
| `{subdomain}:loaded` | 本服务 | `store/{subdomain}Store` | 数据加载完成 |
| `{subdomain}:error` | 本服务 | `errorBus` | 错误上报 |

---

## 3. 数据流

```
[外部输入 / 上游服务]
    ↓
{Subdomain}Service.{action}()
    ↓ (DataBridge.forward())
DataBridge → routeToDB() → dataLayer → IndexedDB
    ↓ (EventBus)
{subdomain}Store (Zustand + withBroadcast)
    ↓
components/pages (仅经 Store 取数)
```

---

## 4. 配置与依赖

### 4.1 依赖白名单（lib/）

| 依赖 | 路径 | 用途 |
|------|------|------|
| logger | `@/lib/logger` | 日志输出 |
| EventBus | `@/lib/eventBus` | 事件发布/订阅 |
| format | `@/lib/format` | 数据格式化 |
| errors | `@/lib/errors` | 错误类型定义 |

### 4.2 配置项（如适用）

| 配置名 | 默认值 | 说明 | 来源 |
|--------|--------|------|------|
| `{CONFIG_KEY}` | `{default}` | {说明} | `src/config/` |

---

## 5. 测试策略

| 测试类型 | 文件 | 说明 |
|----------|------|------|
| 单元测试 | `src/services/{subdomain}/__tests__/` | 纯函数、计算逻辑 |
| 集成测试 | `tests/services/{subdomain}.integration.test.ts` | DataBridge 交互、Store 联动 |
| Mock 策略 | `__mocks__/{subdomain}Service.ts` | 隔离外部依赖 |

---

## 6. 变更日志

| 日期 | 版本 | 变更 | 作者 |
|------|------|------|------|
| 2026-07-12 | v0.1.0 | 契约初稿 | 架构组 |

---

> **TODO[子域 owner]**：请按本模板填充 §1-§5，确保与 `services-catalog.md` 的摘要一致。完成后运行 `tsc --noEmit` + `audit:layers` 验证。
