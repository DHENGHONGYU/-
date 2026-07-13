---
title: stockpool-contract.md — 股票池管理子域接口契约
status: draft
owner: 架构组
updated: 2026-07-12
---

# stockpool-contract.md — 股票池管理子域接口契约

> **定位**：定义 `stockpool` 子域的接口契约、职责边界、数据流与依赖关系。  
> **关联**：`../../architecture/services-catalog.md`（24 子域总览）、`AGENTS.md` §一（分层规则）。

---

## 1. 职责边界

### 1.1 核心职责

- **股票池全量查询**：提供 `listStocks()` 只读接口，获取全部已入库标的列表，支持按 `researchStatus` 索引维度过滤（`getStocksByStatus()`）。
- **研究状态流转管理**：实现股票在研究生命周期（如 `watching` → `researching` → `analyzed` 等）之间的状态机流转，通过 `transitionStock()` 调用 `poolTransitionEngine` 校验合法性，写操作经 `DataBridge` 信封协议。
- **用户自定义分组管理**：支持按用户自定义分组（`group` 字段）查询股票（`getStocksByGroup()`）、更新分组（`updateStockGroup()`），并识别默认分组（`isDefaultGroup()`）。
- **股票池分组聚合**：提供 `getAllPoolGroups()` 按 `researchStatus` 维度自动聚合所有股票池分组，附带每组可选的流转目标（`PoolTransitionOption`）。

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
| `poolTransitionEngine`（`core/`） | 上游：提供流转规则与校验 | `core/poolTransitionEngine` → `stockpoolService`（`isValidTransition`、`getPoolTransitionOptions`） |
| `DataBridge` / `Envelope`（`core/`） | 下游：数据持久化通道 | `stockpoolService` → `DataBridge.forward()` → `dataLayer` → IndexedDB |
| `store/`（状态层） | 下游：消费查询结果 | `stockpoolService.{listStocks,getAllPoolGroups}` → `store/stockpoolStore`（预期） |
| `config/dbConfig` | 常量源（⚠️ 潜在跨层） | `src/config/dbConfig` 提供 `DEFAULT_POOL_GROUP`、`RESEARCH_STATUS`、`STORE_NAME` 等常量 |

---

## 2. 公共接口

### 2.1 类型定义（TypeScript Interface）

```typescript
// 文件：src/services/stockpool/stockpoolService.ts

export interface PoolGroup {
  status: ResearchStatus
  label: string
  stocks: Stock[]
  options: PoolTransitionOption[]
}

// 重导出 core 层类型
export type { PoolTransitionOption } from '@/core/poolTransitionEngine'
```

### 2.2 主入口函数

| 函数 | 签名 | 职责 | 错误处理 |
|------|------|------|----------|
| `listStocks()` | `() => Promise<DataLayerResult<Stock[]>>` | 获取全部股票列表（只读） | 返回 `DataLayerResult`，错误信息包含异常字符串 |
| `getStocksByStatus(status)` | `(status: ResearchStatus) => Promise<DataLayerResult<Stock[]>>` | 按研究状态索引查询股票 | 返回 `DataLayerResult`，支持 `by-status` 索引 |
| `getAllPoolGroups()` | `() => Promise<DataLayerResult<PoolGroup[]>>` | 按全部 `RESEARCH_STATUS` 聚合分组 | 内部调用 `getStocksByStatus`，错误透传 |
| `getPoolGroups()` | `() => Promise<DataLayerResult<string[]>>` | 获取用户自定义分组唯一列表 | 从 `stocks` 提取 `group` 字段去重 |
| `getStocksByGroup(group)` | `(group: string) => Promise<DataLayerResult<Stock[]>>` | 按分组名过滤股票 | 全量查询后内存过滤 |
| `transitionStock(symbol, toStatus)` | `(symbol: string, toStatus: ResearchStatus) => Promise<DataLayerResult<Stock>>` | 驱动股票研究状态流转 | 前置校验：空代码、存在性、状态合法性；经 `DataBridge.forward()` 写入 |
| `updateStockGroup(symbol, group)` | `(symbol: string, group: string) => Promise<DataLayerResult<Stock>>` | 更新股票所属分组 | 前置校验：空代码/空分组；经 `DataBridge.forward()` 写入 |
| `isDefaultGroup(group?)` | `(group?: string) => boolean` | 判断是否为默认分组 | 纯计算，无副作用 |

### 2.3 事件接口

> 本服务当前未直接发布 `EventBus` 事件。数据消费方通过 `DataBridge` 返回的 `DataLayerResult` 同步获取结果。若后续需要异步通知，建议新增：

| 事件名 | 发布方 | 订阅方 | 说明 |
|--------|--------|--------|------|
| `stockpool:transitioned` | 本服务（待实现） | `store/stockpoolStore` | 状态流转完成通知 |
| `stockpool:groupUpdated` | 本服务（待实现） | `store/stockpoolStore` | 分组更新完成通知 |

---

## 3. 数据流

```
[用户操作 / UI 触发]
    ↓
stockpoolService.transitionStock() / updateStockGroup()
    ↓ (EnvelopeFactory 封装 + DataBridge.forward())
DataBridge → routeToDB() → dataLayer → IndexedDB (STORE_NAME.stocks)
    ↓ (query 返回 DataLayerResult)
stockpoolService.{listStocks, getStocksByStatus, getAllPoolGroups}
    ↓ (Store 调用)
stockpoolStore (Zustand + withBroadcast) — 待实现
    ↓ (React 组件绑定)
components/pages (仅经 Store 取数)
```

**关键数据节点**：
- **输入**：`symbol`（股票代码）、`toStatus`（目标研究状态）、`group`（分组名称）
- **校验**：`poolTransitionEngine.isValidTransition()` 校验状态流转合法性
- **信封**：`EnvelopeFactory.create()` 生成标准信封，包含 `source: MODULE_ID.stockpool`、`traceId: pool-transition-${nanoid(8)}-${symbol}`
- **输出**：`PoolGroup[]` 或 `Stock[]`，均包装在 `DataLayerResult<T>` 中

---

## 4. 配置与依赖

### 4.1 依赖白名单（lib/）

| 依赖 | 路径 | 用途 |
|------|------|------|
| dataBridge | `@/core/databridge` | 数据桥接，查询与写入路由 |
| EnvelopeFactory | `@/core/envelope` | 信封封装，标准化数据协议 |
| poolTransitionEngine | `@/core/poolTransitionEngine` | 流转规则校验与选项生成 |
| DataLayerResult / Stock | `@/data/types` | 数据层类型定义 |
| nanoid | `nanoid`（第三方） | 生成 traceId 唯一标识 |

> 本服务**未直接依赖** `logger`、`eventBus`、`format`、`errors` 等 `lib/` 基础设施，错误处理通过 `try/catch` + `DataLayerResult` 返回实现。建议后续补充 `logger.info` 覆盖核心分支（如 `transitionStock`、`updateStockGroup`）。

### 4.2 配置项（如适用）

| 配置名 | 默认值 | 说明 | 来源 |
|--------|--------|------|------|
| `DEFAULT_POOL_GROUP` | `'default'` | 默认分组名称 | `src/config/dbConfig` |
| `STORE_NAME.stocks` | `'stocks'` | 股票存储表名 | `src/config/dbConfig` |
| `MODULE_ID.stockpool` | `'stockpool'` | 模块标识 | `src/config/dbConfig` |
| `ENVELOPE_ACTION` | 多种 | 信封动作枚举 | `src/config/dbConfig` |
| `RESEARCH_STATUS` | 多种 | 研究状态枚举 | `src/config/dbConfig` |

> ⚠️ **架构备注**：`src/config/dbConfig` 被 `services/` 层导入，在 `AGENTS.md` 的依赖方向规则中，`services/` 只能依赖 `core/`、`data/`、`lib/`（白名单）。`config/` 不在 `services/` 的依赖白名单中，属于现有代码中的跨层依赖模式。建议后续将 `DEFAULT_POOL_GROUP`、`STORE_NAME`、`MODULE_ID` 等常量迁移至 `src/constants/` 层。

---

## 5. 测试策略

| 测试类型 | 文件 | 说明 |
|----------|------|------|
| 单元测试 | `src/services/stockpool/__tests__/`（待创建） | `isDefaultGroup()` 纯函数；`getPoolGroups` 去重逻辑；`transitionStock` 校验分支 |
| 集成测试 | `tests/services/stockpool.integration.test.ts`（待创建） | `DataBridge` 交互、`EnvelopeFactory` 信封生成、IndexedDB 读写 |
| Mock 策略 | `__mocks__/dataBridge.ts`（复用） | 隔离 `dataBridge.query` / `forward`，模拟 `DataLayerResult` 返回 |

> 当前 `src/services/stockpool/` 目录下**尚无 `__tests__` 目录或测试文件**，建议按上表补充测试覆盖。

---

## 6. 变更日志

| 日期 | 版本 | 变更 | 作者 |
|------|------|------|------|
| 2026-07-12 | v0.1.0 | 契约初稿 | 架构组 |

---

> **TODO[子域 owner]**：
> 1. 补充 `EventBus` 事件发布（`stockpool:transitioned`、`stockpool:groupUpdated`），使 Store 可订阅异步通知。
> 2. 补充 `logger.info` 日志覆盖核心分支（`transitionStock`、`updateStockGroup`）。
> 3. 创建 `src/services/stockpool/__tests__/stockpoolService.test.ts` 单元测试，覆盖状态流转校验、分组过滤、错误分支。
> 4. 评估 `src/config/dbConfig` 的跨层依赖：将 `DEFAULT_POOL_GROUP`、`STORE_NAME` 等常量迁移至 `src/constants/` 层。
> 5. 完成后运行 `tsc --noEmit` + `audit:layers` 验证。
