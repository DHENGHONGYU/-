---
title: stockpool-contract
type: reference
domain: project
phase: design
tier: important
status: draft
maintainer: 架构�?summary: "定义 stockpool 子域的接口契约、职责边界、数据流与依赖关系�?
tags: [project, contract, stocks, reference, governance, documentation]
version: v1.0.0
last_updated: 2026-07-17
code_version: 2.0.0
doc_id: V9-DOC-PROJ-108
referenced_by: [V9-DOC-META-000, V9-DOC-PROJ-176, V9-DOC-PROJ-149]
change_log:
  - version: v1.0.0
changes: Initial version established
date: 2026-07-17
---

# stockpool-contract.md �?股票池管理子域接口契�?
> **定位**：定�?`stockpool` 子域的接口契约、职责边界、数据流与依赖关系�? 
> **Source**：`./services-catalog.md`�?4 子域总览）、`../../AGENTS.md` §一（分层规则）�?
---

## 1. 职责边界

### 1.1 核心职责

- **股票池全量查�?*：提�?`listStocks()` 只读接口，获取全部已入库标的列表，支持按 `researchStatus` 索引维度过滤（`getStocksByStatus()`）�?- **研究状态流转管�?*：实现股票在研究生命周期（如 `watching` �?`researching` �?`analyzed` 等）之间的状态机流转，通过 `transitionStock()` 调用 `poolTransitionEngine` 校验合法性，写操作经 `DataBridge` 信封协议�?- **用户自定义分组管�?*：支持按用户自定义分组（`group` 字段）查询股票（`getStocksByGroup()`）、更新分组（`updateStockGroup()`），并识别默认分组（`isDefaultGroup()`）�?- **股票池分组聚�?*：提�?`getAllPoolGroups()` �?`researchStatus` 维度自动聚合所有股票池分组，附带每组可选的流转目标（`PoolTransitionOption`）�?
### 1.2 分层定位

| 维度 | 说明 |
|------|------|
| 所属层 | `src/services/`（服务层�?|
| 依赖方向 | 只能依赖 `core/`、`data/`、`lib/`（白名单�?|
| 禁止事项 | 禁止直写 IndexedDB（须�?`DataBridge.forward()`�?|
| 被依赖方 | `store/`（状态层）、`pages/`（页面层）可消费本服务输�?|

### 1.3 与相邻子域的关系

| 相邻子域 | 关系 | 数据�?|
|----------|------|--------|
| `poolTransitionEngine`（`core/`�?| 上游：提供流转规则与校验 | `core/poolTransitionEngine` �?`stockpoolService`（`isValidTransition`、`getPoolTransitionOptions`�?|
| `DataBridge` / `Envelope`（`core/`�?| 下游：数据持久化通道 | `stockpoolService` �?`DataBridge.forward()` �?`dataLayer` �?IndexedDB |
| `store/`（状态层�?| 下游：消费查询结�?| `stockpoolService.{listStocks,getAllPoolGroups}` �?`store/stockpoolStore`（预期） |
| `config/dbConfig` | 常量源（⚠️ 潜在跨层�?| `src/config/dbConfig` 提供 `DEFAULT_POOL_GROUP`、`RESEARCH_STATUS`、`STORE_NAME` 等常�?|

---

## 2. 公共接口

### 2.1 类型定义（TypeScript Interface�?
```typescript
// 文件：src/services/stockpool/stockpoolService.ts

export interface PoolGroup {
  status: ResearchStatus
  label: string
  stocks: Stock[]
  options: PoolTransitionOption[]
}

// 重导�?core 层类�?export type { PoolTransitionOption } from '@/core/poolTransitionEngine'
```

### 2.2 主入口函�?
| 函数 | 签名 | 职责 | 错误处理 |
|------|------|------|----------|
| `listStocks()` | `() => Promise<DataLayerResult<Stock[]>>` | 获取全部股票列表（只读） | 返回 `DataLayerResult`，错误信息包含异常字符串 |
| `getStocksByStatus(status)` | `(status: ResearchStatus) => Promise<DataLayerResult<Stock[]>>` | 按研究状态索引查询股�?| 返回 `DataLayerResult`，支�?`by-status` 索引 |
| `getAllPoolGroups()` | `() => Promise<DataLayerResult<PoolGroup[]>>` | 按全�?`RESEARCH_STATUS` 聚合分组 | 内部调用 `getStocksByStatus`，错误透传 |
| `getPoolGroups()` | `() => Promise<DataLayerResult<string[]>>` | 获取用户自定义分组唯一列表 | �?`stocks` 提取 `group` 字段去重 |
| `getStocksByGroup(group)` | `(group: string) => Promise<DataLayerResult<Stock[]>>` | 按分组名过滤股票 | 全量查询后内存过�?|
| `transitionStock(symbol, toStatus)` | `(symbol: string, toStatus: ResearchStatus) => Promise<DataLayerResult<Stock>>` | 驱动股票研究状态流�?| 前置校验：空代码、存在性、状态合法性；�?`DataBridge.forward()` 写入 |
| `updateStockGroup(symbol, group)` | `(symbol: string, group: string) => Promise<DataLayerResult<Stock>>` | 更新股票所属分�?| 前置校验：空代码/空分组；�?`DataBridge.forward()` 写入 |
| `isDefaultGroup(group?)` | `(group?: string) => boolean` | 判断是否为默认分�?| 纯计算，无副作用 |

### 2.3 事件接口

> 本服务当前未直接发布 `EventBus` 事件。数据消费方通过 `DataBridge` 返回�?`DataLayerResult` 同步获取结果。若后续需要异步通知，建议新增：

| 事件�?| 发布�?| 订阅�?| 说明 |
|--------|--------|--------|------|
| `stockpool:transitioned` | 本服务（待实现） | `store/stockpoolStore` | 状态流转完成通知 |
| `stockpool:groupUpdated` | 本服务（待实现） | `store/stockpoolStore` | 分组更新完成通知 |

---

## 3. 数据�?
```
[用户操作 / UI 触发]
    �?stockpoolService.transitionStock() / updateStockGroup()
    �?(EnvelopeFactory 封装 + DataBridge.forward())
DataBridge �?routeToDB() �?dataLayer �?IndexedDB (STORE_NAME.stocks)
    �?(query 返回 DataLayerResult)
stockpoolService.{listStocks, getStocksByStatus, getAllPoolGroups}
    �?(Store 调用)
stockpoolStore (Zustand + withBroadcast) �?待实�?    �?(React 组件绑定)
components/pages (仅经 Store 取数)
```

**关键数据节点**�?- **输入**：`symbol`（股票代码）、`toStatus`（目标研究状态）、`group`（分组名称）
- **校验**：`poolTransitionEngine.isValidTransition()` 校验状态流转合法�?- **信封**：`EnvelopeFactory.create()` 生成标准信封，包�?`source: MODULE_ID.stockpool`、`traceId: pool-transition-${nanoid(8)}-${symbol}`
- **输出**：`PoolGroup[]` �?`Stock[]`，均包装�?`DataLayerResult<T>` �?
---

## 4. 配置与依�?
### 4.1 依赖白名单（lib/�?
| 依赖 | 路径 | 用�?|
|------|------|------|
| dataBridge | `@/core/databridge` | 数据桥接，查询与写入路由 |
| EnvelopeFactory | `@/core/envelope` | 信封封装，标准化数据协议 |
| poolTransitionEngine | `@/core/poolTransitionEngine` | 流转规则校验与选项生成 |
| DataLayerResult / Stock | `@/data/types` | 数据层类型定�?|
| nanoid | `nanoid`（第三方�?| 生成 traceId 唯一标识 |

> 本服�?*未直接依�?* `logger`、`eventBus`、`format`、`errors` �?`lib/` 基础设施，错误处理通过 `try/catch` + `DataLayerResult` 返回实现。建议后续补�?`logger.info` 覆盖核心分支（如 `transitionStock`、`updateStockGroup`）�?
### 4.2 配置项（如适用�?
| 配置�?| 默认�?| 说明 | 来源 |
|--------|--------|------|------|
| `DEFAULT_POOL_GROUP` | `'default'` | 默认分组名称 | `src/config/dbConfig` |
| `STORE_NAME.stocks` | `'stocks'` | 股票存储表名 | `src/config/dbConfig` |
| `MODULE_ID.stockpool` | `'stockpool'` | 模块标识 | `src/config/dbConfig` |
| `ENVELOPE_ACTION` | 多种 | 信封动作枚举 | `src/config/dbConfig` |
| `RESEARCH_STATUS` | 多种 | 研究状态枚�?| `src/config/dbConfig` |

> ⚠️ **架构备注**：`src/config/dbConfig` �?`services/` 层导入，�?`../../AGENTS.md` 的依赖方向规则中，`services/` 只能依赖 `core/`、`data/`、`lib/`（白名单）。`config/` 不在 `services/` 的依赖白名单中，属于现有代码中的跨层依赖模式。建议后续将 `DEFAULT_POOL_GROUP`、`STORE_NAME`、`MODULE_ID` 等常量迁移至 `src/constants/` 层�?
---

## 5. 测试策略

| 测试类型 | 文件 | 说明 |
|----------|------|------|
| 单元测试 | `../../src/services/news/__tests__/`（待创建�?| `isDefaultGroup()` 纯函数；`getPoolGroups` 去重逻辑；`transitionStock` 校验分支 |
| 集成测试 | `tests/services/stockpool.integration.test.ts`（待创建�?| `DataBridge` 交互、`EnvelopeFactory` 信封生成、IndexedDB 读写 |
| Mock 策略 | `__mocks__/dataBridge.ts`（复用） | 隔离 `dataBridge.query` / `forward`，模�?`DataLayerResult` 返回 |

> 当前 `src/services/stockpool/` 目录�?*尚无 `__tests__` 目录或测试文�?*，建议按上表补充测试覆盖�?
---

## 6. 变更日志

| 日期 | 版本 | 变更 | 作�?|
|------|------|------|------|
| 2026-07-12 | v0.1.0 | 契约初稿 | 架构�?|

---

> **TODO[子域 owner]**�?> 1. 补充 `EventBus` 事件发布（`stockpool:transitioned`、`stockpool:groupUpdated`），�?Store 可订阅异步通知�?> 2. 补充 `logger.info` 日志覆盖核心分支（`transitionStock`、`updateStockGroup`）�?> 3. 创建 `src/services/pool/poolService.ts` 单元测试，覆盖状态流转校验、分组过滤、错误分支�?> 4. 评估 `src/config/dbConfig` 的跨层依赖：�?`DEFAULT_POOL_GROUP`、`STORE_NAME` 等常量迁移至 `src/constants/` 层�?> 5. 完成后运�?`tsc --noEmit` + `audit:layers` 验证�?