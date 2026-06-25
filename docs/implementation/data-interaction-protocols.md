# 数据交互协议

> **Status**: Current  
> **Version**: v0.9.0-migration-implemented  
> **Last Updated**: 2026-06-25
>
> 本文档定义 V9 模块间数据交互的统一协议，包括信封结构、调用方向、事件总线、数据血缘与输入舱专用契约。  
> 目标读者：前端开发者、架构师。

---

## 1. 总则

- 所有跨模块写操作必须通过 `DataBridge.forward(StandardEnvelope)`。
- L5/L4 禁止直接调用 `dataLayer` 写方法；读操作优先通过 Service，逐步收敛。
- 每个写操作必须携带来源、目标、动作、traceId、时间戳、数据版本。
- 事件总线用于广播状态变更，订阅方不得反向修改事件源数据。

---

## 2. 标准信封

```ts
interface StandardEnvelope {
  meta: {
    source: ModuleId;        // 来源模块/舱室，如 'input-cabin'
    target: EnvelopeTarget;  // 'indexeddb' / 'event-bus' / 'engine'
    action: EnvelopeAction;  // 详见 dbConfig.ts
    traceId: string;         // 单次操作唯一 ID，便于复盘
    timestamp: number;       // 操作时间戳
    dataVersion: number;     // 数据版本，用于血缘追踪
  };
  payload: unknown;
}
```

---

## 3. 调用方向矩阵

| 调用方 ↓ / 被调用方 → | L5 展示 | L4 应用 | L3 引擎 | L2 数据 | L1 基础设施 |
|------------------------|---------|---------|---------|---------|-------------|
| L5 展示 | ✅ 同层 | ✅ | ✅ | ❌ 禁止直接 | ✅（lib/config/core 稳定部分） |
| L4 应用 | ❌ | ✅ 同层 | ✅ | ❌ 禁止直接写 | ✅ |
| L3 引擎 | ❌ | ❌ | ✅ 同层 | ✅ 读 dataLayer / 写 DataBridge | ✅ |
| L2 数据 | ❌ | ❌ | ❌ | ✅ 同层 | ✅（config/dbConfig 类型） |
| L1 基础设施 | ❌ | ❌ | ❌ | ❌ | ✅ 同层 |

---

## 4. 数据访问路径

```
L5/L4 写 ──→ DataBridge.forward() ──→ ACL ──→ IndexedDB
L5/L4 读 ──→ Service / dataLayer ──→ IndexedDB（读逐步迁移到 Service）
L3 引擎读 ──→ dataLayer
L3 引擎写 ──→ DataBridge.forward()
L2 数据 ──→ db.ts（唯一原生 IndexedDB 操作）
```

---

## 5. 事件总线规范

### 5.1 事件命名

- 全局事件：`{domain}:{event}`，如 `stocks:changed`, `scores:changed`, `orders:changed`。
- 舱室内部事件：`{cabin}:{event}`，如 `input:poolChanged`, `input:importProgress`。
- 禁止事件名硬编码在 UI 层，应来自 `src/lib/eventNames.ts`。

### 5.2 事件订阅原则

- 订阅方只做读取与重渲染，禁止在回调中直接写数据。
- 需要触发写操作时，调用 Service 或 DataBridge。

---

## 6. 数据血缘

### 6.1 字段级血缘

- `stocks.dataVersion`：每次写入递增。
- `v6_scores.algorithmVersion`：生成评分的算法版本。
- `v6_scores.calculatedAt`：评分计算时间戳。
- `orders.signalId`（规划中）：订单来源信号 ID，用于将订单追溯到触发信号与评分版本。当前 `Order` 类型尚未包含该字段，将在复盘引擎/交易复盘笔记阶段补齐。

### 6.2 审计日志

`research_logs` store 自动记录每个 DataBridge 写操作：

```ts
interface ResearchLog {
  id?: number;
  traceId: string;
  source: ModuleId;
  action: EnvelopeAction;
  timestamp: number;
  payloadSummary: string;
}
```

---

## 7. 输入舱数据契约

### 7.1 允许写入的 action

- `INSERT_STOCK`：录入单只股票。
- `BULK_IMPORT`：批量导入（内部拆分为多条 `INSERT_STOCK`）。
- `UPDATE_STOCK`：更新股票状态、数据质量、来源等。
- `SAVE_DAILY_QUOTES`：保存行情/K线数据。

### 7.2 输入舱事件

| 事件 | 触发 | 订阅方 |
|------|------|--------|
| `input:poolChanged` | stocks 表变更 | `InputDashboard`, `PoolBoard` |
| `input:fetcherStatusChanged` | 采集服务健康变化 | `DataTestPanel`, 顶部状态栏 |
| `input:importProgress` | 批量导入进度更新 | `BulkImportPanel` |

### 7.3 数据质量契约

输入舱在采集/导入后更新 `Stock.dataQuality`：

```ts
interface StockDataQuality {
  basic: boolean;
  kline: boolean;
  finance: boolean;
  lastChecked?: number;
}
```

---

## 8. 离线降级

- 断网时，写操作正常持久化到 IndexedDB。
- 需要 LLM/外部接口的功能显示离线徽章并禁用或降级。
- AKShare 拉取失败时保留本地数据，并提示用户检查服务。

---

## 9. 版本比对

| 版本 | 时间 | 变化 |
|------|------|------|
| v0.9.0-docs-base | 2026-06-24 前 | 信封结构在 `03-architecture-standards.md` 中通用描述，缺少输入舱专用契约 |
| v0.9.0-docs-review | 2026-06-24 | 新增本文档，明确调用矩阵、事件命名、数据血缘、输入舱 action/事件/数据质量契约 |
