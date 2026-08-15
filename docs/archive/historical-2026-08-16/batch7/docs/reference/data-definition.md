---
doc_id: V9-DOC-REF-931
title: "DATA_DEFINITION.md — V9 主数据字典（整合版）"
domain: ref
status: active
version: v2.0.1
last_updated: 2026-08-15
code_version: "2.0.0-rc.1"
referenced_by: [V9-DOC-META-000, V9-DOC-DATA-017, V9-DOC-PROJ-176]
change_log:
  - version: v2.0.1
    changes: "2026-08-15 系统性核对：与代码权威源 src/config/dbConfig.ts 二次对齐（DB_VERSION v32、STORE_NAME 50、MODULE_ID 20）；登记 §A/§B/§C 三个模块的源代码路径仍为 mtime 2026-07-08 基线，字段未发现漂移；与 docs/reference/data-dictionary-index.md v1.1.0 与《V9核心数据字典与类型定义（整合版）》.md v1.5 保持一致。"
    date: 2026-08-15
  - version: v2.0.0
    changes: "2026-07-12 整合 3 份同名 DATA_DEFINITION.md（交易持仓 / 数据采集 / Cockpit Widget），消除同名冲突。"
    date: 2026-07-12
---

> **Version**: v2.0.1（整合版，2026-08-15 核对）
> **Consolidated**: 2026-07-12
> **Maintainer**: 架构资产治理官
> **来源**：合并自 3 份同名 `DATA_DEFINITION.md`（交易持仓管理 / 数据采集 / Cockpit Widget 框架），消除同名冲突与双向一致性落差。
> **代码权威源**：`DB_VERSION=32` · `STORE_NAME=50` · `MODULE_ID=20`（见 [`src/config/dbConfig.ts`](../../src/config/dbConfig.ts)）。

# DATA_DEFINITION.md — V9 主数据字典（整合版）

> 本文件为 V9 项目**唯一主数据字典（Single Source of Truth）**，整合以下三个模块的数据结构定义：
> - **模块 A**：交易持仓管理（`src/pages/trading/` · `src/types/modules/trade.types.ts` · `src/constants/trade.constants.ts` · `src/services/trade/`）
> - **模块 B**：数据采集（`src/services/data-collector/` · `src/types/modules/widget.types.ts` 采集相关类型 · `src/constants/cockpit.constants.ts` 采集配置常量）
> - **模块 C**：Cockpit Widget 框架（`src/types/modules/widget.types.ts` · `src/constants/cockpit.constants.ts` · `src/cockpit/core/widgetRegistry.ts`）
>
> **整合原则**：
> 1. 各模块内容按功能定位分区保留，**所有最新信息均不丢失**。
> 2. 模块 B 与 C **共享的采集类型**（DataSourceConfig / CollectionTask / DataSourceType / CollectionMode / CollectionTaskStatus / 采集器配置常量）在 **§B 统一定义一次**，模块 C 以引用方式接入，**消除重复冗余**。
> 3. 基准选取：以最新更新时间（mtime 2026-07-08）的采集类型版本为准（模块 B 数据采集 v1.2.0 与模块 C Cockpit v1.2.0 内容一致，无字段冲突）；模块 C 的 Cockpit 专有内容（v1.2.0 / 2026-07-06）作为补充并入。

### 冲突解决策略（增强合并标准 v2.0.0）

依据「最新时间戳优先 / 冲突字段最新覆盖 / 去重无冗余 / 输出完整合并结果」的增强合并标准，本次整合严格按下表执行：

| 策略 | 适用情形 | 本次执行结果 |
|------|----------|--------------|
| **时间戳最新优先** | 同一概念的多份定义 | 共享采集类型以 mtime 最新（2026-07-08，模块 B）为基准统一定义；模块 C（2026-07-06）同类定义不再独立保留，改为引用 §B |
| **内容最完整优先** | 字段集有差异时 | 三模块字段集互不重叠（A 交易 / B 采集 / C Widget），各自**完整保留、无裁剪** |
| **冲突字段最新覆盖** | 同名同义字段取值不一致 | **逐字段比对结果：B 与 C 的共享采集类型字段值完全一致（均 v1.2.0），不存在冲突字段，故无需覆盖**；若未来出现冲突，约定以 §B（数据采集，作为数据上游）为准 |
| **去重无冗余** | 重复定义 | 3 份同名文件 → 1 份主字典；共享类型在 §B 定义 1 次、§C 引用，消除全部重复 |
| **完整性校验** | 合并后是否丢信息 | 3 模块全文并入；唯一去重对象是 B/C 间**完全一致**的共享类型，未丢失任何模块专有信息 |

> **增强标准结论**：合并结果满足「去重后且信息完整」——全仓库裸名 `DATA_DEFINITION.md` 仅本文件 1 处；门禁 `audit:docs` 与 `audit-path-match --enforce` 均 **0 违规**。

---

## 0. 整合来源对照表

| 源文件 | 模块 | 原 mtime | 原大小 | 并入章节 | 处理方式 |
|--------|------|-----------|---------|----------|----------|
| `./DATA_DEFINITION.md`（根） | A 交易持仓管理 | 2026-07-08 14:22 | 13,337 B | §A（全文） | 合并后由 `git rm` 移除 |
| `docs/specs/requirements/DATA_DEFINITION.md` | B 数据采集 | 2026-07-08 14:22 | 13,827 B | §B（全文） | 合并后移除（untracked） |
| `docs/specs/design/DATA_DEFINITION.md` | C Cockpit Widget 框架 | 2026-07-06 07:06 | 26,654 B | §C（全文，共享类型改引用 §B） | 合并后移除（untracked） |

> 其余 7 份**按域拆分**的数据字典（`AI_CENTER_` / `BACKTEST_` / `DATAFLOW_` / `MULTI_FACTOR_SCREENING_` / `NEWS_` / `RISK_DERIVED_` / `SEVEN_DIM_CONFIG_DATA_DEFINITION.md`）保持独立，由 `docs/guides/standards/DATA_DICTIONARY_INDEX.md` 索引，不在本文件重复。

---

## 模块 A：交易持仓管理模块

> 生成日期：2026-06-26
> 模块范围：`src/pages/trading/` · `src/types/modules/trade.types.ts` · `src/constants/trade.constants.ts` · `src/services/trade/`

### A.1 TypeScript 接口定义

#### A.1.1 HoldingItem — 持仓明细项

| 字段 | 类型 | 必填 | 枚举/范围 | 描述 |
|------|------|------|-----------|------|
| `code` | `string` | 是 | 6 位数字字符串 | 证券代码（如 `600519`） |
| `name` | `string` | 是 | - | 证券名称 |
| `quantity` | `number` | 是 | ≥ 0，整数 | 持仓数量（股） |
| `currentPrice` | `number` | 是 | > 0 | 当前价格 |
| `avgCost` | `number` | 是 | > 0 | 成本均价 |
| `floatingPnl` | `number` | 是 | 任意实数 | 浮动盈亏金额 |
| `floatingPnlPercent` | `number` | 是 | 任意实数 | 浮动盈亏百分比 |
| `marketValueRatio` | `number` | 是 | 0 ~ 1 | 市值占比 |
| `strategyId` | `string` | 是 | - | 关联策略 ID |
| `strategyType` | `StrategyType` | 是 | `CORE` / `HOT` / `VALUE` | 策略类型（见 A.2.2） |

#### A.1.2 HoldingsQueryParams — 持仓列表查询参数

| 字段 | 类型 | 必填 | 枚举/范围 | 描述 |
|------|------|------|-----------|------|
| `page` | `number` | 是 | ≥ 1 | 当前页码 |
| `pageSize` | `number` | 是 | 10 / 20 / 50 | 每页条数 |
| `startDate` | `string` | 是 | ISO 日期 `YYYY-MM-DD` | 开始日期 |
| `endDate` | `string` | 是 | ISO 日期 `YYYY-MM-DD` | 结束日期 |
| `direction` | `TradeDirection` | 是 | `BUY` / `SELL` / `ALL` | 交易方向（见 A.2.1） |
| `keyword` | `string` | 否 | 任意文本 | 搜索关键词（代码/名称模糊匹配） |

#### A.1.3 HoldingsListData — API 响应数据

| 字段 | 类型 | 必填 | 描述 |
|------|------|------|------|
| `total` | `number` | 是 | 总条数 |
| `list` | `HoldingItem[]` | 是 | 持仓列表 |

#### A.1.4 HoldingsApiResponse\<T\> — 统一 API 响应包装

| 字段 | 类型 | 必填 | 描述 |
|------|------|------|------|
| `code` | `number` | 是 | 状态码（200 = 成功） |
| `data` | `T` | 是 | 响应数据 |
| `message` | `string` | 否 | 错误信息 |

#### A.1.5 TradeActionRequest — 交易操作请求参数

| 字段 | 类型 | 必填 | 枚举/范围 | 描述 |
|------|------|------|-----------|------|
| `code` | `string` | 是 | 6 位数字字符串 | 证券代码 |
| `action` | `HoldingAction` | 是 | `ADD_POSITION` / `CLOSE_POSITION` | 操作类型（见 A.2.3） |
| `quantity` | `number` | 是 | ≥ 100，整数 | 操作数量（股） |

#### A.1.6 TradeActionResponse — 交易操作响应

| 字段 | 类型 | 必填 | 描述 |
|------|------|------|------|
| `code` | `number` | 是 | 状态码 |
| `success` | `boolean` | 是 | 是否成功 |
| `message` | `string` | 是 | 提示信息 |

#### A.1.7 PaginationState — 分页状态

| 字段 | 类型 | 必填 | 描述 |
|------|------|------|------|
| `page` | `number` | 是 | 当前页码 |
| `pageSize` | `number` | 是 | 每页条数 |
| `total` | `number` | 是 | 总条数 |

#### A.1.8 FilterState — 筛选条件

| 字段 | 类型 | 必填 | 枚举/范围 | 描述 |
|------|------|------|-----------|------|
| `startDate` | `string` | 是 | ISO 日期 | 开始日期 |
| `endDate` | `string` | 是 | ISO 日期 | 结束日期 |
| `direction` | `TradeDirection` | 是 | `BUY` / `SELL` / `ALL` | 交易方向 |
| `keyword` | `string` | 是 | 任意文本 | 搜索关键词 |

#### A.1.9 HoldingsLoadingState — 加载状态

| 字段 | 类型 | 必填 | 描述 |
|------|------|------|------|
| `isListLoading` | `boolean` | 是 | 列表数据是否加载中 |
| `isActionLoading` | `boolean` | 是 | 操作是否执行中 |
| `isExporting` | `boolean` | 是 | 导出是否进行中 |

#### A.1.10 TradeModalState — 交易弹窗状态

| 字段 | 类型 | 必填 | 描述 |
|------|------|------|------|
| `open` | `boolean` | 是 | 是否打开 |
| `action` | `HoldingAction \| null` | 是 | 操作类型 |
| `holding` | `HoldingItem \| null` | 是 | 目标持仓项 |

### A.2 枚举与常量映射

#### A.2.1 TRADE_DIRECTION — 交易方向枚举

| 枚举值 | 键名 | 显示标签 | 说明 |
|--------|------|----------|------|
| `'BUY'` | `TRADE_DIRECTION.BUY` | 买入 | 买入方向 |
| `'SELL'` | `TRADE_DIRECTION.SELL` | 卖出 | 卖出方向 |
| `'ALL'` | `TRADE_DIRECTION.ALL` | 全部 | 全部方向（筛选默认值） |

**TypeScript 类型**：`TradeDirection`

#### A.2.2 STRATEGY_TYPE — 策略类型枚举

| 枚举值 | 键名 | 显示标签 | 背景色 | 文字色 | 边框色 |
|--------|------|----------|--------|--------|--------|
| `'CORE'` | `STRATEGY_TYPE.CORE` | 核心仓 | `bg-blue-50` | `text-blue-700` | `border-blue-200` |
| `'HOT'` | `STRATEGY_TYPE.HOT` | 热点短线 | `bg-amber-50` | `text-amber-700` | `border-amber-200` |
| `'VALUE'` | `STRATEGY_TYPE.VALUE` | 价值洼地 | `bg-emerald-50` | `text-emerald-700` | `border-emerald-200` |

**TypeScript 类型**：`StrategyType`

#### A.2.3 HOLDING_ACTION — 持仓操作枚举

| 枚举值 | 键名 | 显示标签 |
|--------|------|----------|
| `'ADD_POSITION'` | `HOLDING_ACTION.ADD_POSITION` | 补仓 |
| `'CLOSE_POSITION'` | `HOLDING_ACTION.CLOSE_POSITION` | 平仓 |

**TypeScript 类型**：`HoldingAction`

#### A.2.4 PNL_COLORS — A 股涨跌颜色映射（交易盈亏专用）

| 状态 | HEX 值 | Tailwind 文字类 | Tailwind 背景类 | 说明 |
|------|--------|-----------------|-----------------|------|
| 上涨（> 0） | `#ef4444` | `text-red-500` | `bg-red-50` | 红色（A 股红涨） |
| 下跌（< 0） | `#22c55e` | `text-green-500` | `bg-green-50` | 绿色（A 股绿跌） |
| 中性（= 0） | `#6b7280` | `text-gray-500` | `bg-gray-50` | 灰色（平盘） |

**工具函数**：
- `getPnlColorClass(value)` → 返回 Tailwind 文字颜色类名
- `getPnlBgClass(value)` → 返回 Tailwind 背景颜色类名
- `getPnlColor(value)` → 返回 HEX 颜色值

> 说明：Cockpit 框架另有一套股票涨跌色 `STOCK_COLOR_MAPPING`（见 §C.2.8），两者均为 A 股「红涨绿跌」语义，字段命名不同（P&L 语义 vs 个股语义），在本字典中分别保留于各自模块。

#### A.2.5 PAGINATION_DEFAULTS — 分页配置

| 常量 | 值 | 说明 |
|------|-----|------|
| `DEFAULT_PAGE` | `1` | 默认页码 |
| `DEFAULT_PAGE_SIZE` | `10` | 默认每页条数 |
| `PAGE_SIZE_OPTIONS` | `[10, 20, 50]` | 可选每页条数 |
| `PAGINATION_MAX_VISIBLE` | `5` | 最大显示页码数 |

#### A.2.6 HOLDINGS_API — API 端点

| 端点 | 方法 | 路径 | 说明 |
|------|------|------|------|
| `LIST` | GET | `/api/v1/trade/holdings` | 获取持仓列表 |
| `ADD_POSITION` | POST | `/api/v1/trade/add-position` | 补仓操作 |
| `CLOSE_POSITION` | POST | `/api/v1/trade/close-position` | 平仓操作 |
| `EXPORT` | GET | `/api/v1/trade/holdings/export` | 导出 Excel |

#### A.2.7 HOLDINGS_REQUEST_CONFIG — 请求配置

| 常量 | 值 | 说明 |
|------|-----|------|
| `TIMEOUT` | `15000` | 请求超时时间（毫秒） |
| `MAX_RETRIES` | `2` | 最大重试次数 |
| `RETRY_DELAY` | `1000` | 重试间隔（毫秒） |

#### A.2.8 表格列宽配置

| 列 | 宽度类名 | 说明 |
|-----|---------|------|
| 证券代码 | `w-[100px]` | 左侧固定列 |
| 证券名称 | `w-[120px]` | 左侧固定列 |
| 持仓数量 | `w-[90px]` | 右对齐 |
| 当前价格 | `w-[100px]` | 右对齐 |
| 成本价 | `w-[100px]` | 右对齐 |
| 浮动盈亏 | `w-[160px]` | 右对齐，语义化颜色 |
| 市值占比 | `w-[100px]` | 右对齐 |
| 策略类型 | `w-[100px]` | 标签 Badge |
| 操作 | `w-[140px]` | 右侧固定列 |

### A.3 API 契约

#### A.3.1 GET /api/v1/trade/holdings

**请求参数**：

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `page` | `number` | 是 | 页码 |
| `pageSize` | `number` | 是 | 每页条数 |
| `startDate` | `string` | 是 | 开始日期 |
| `endDate` | `string` | 是 | 结束日期 |
| `direction` | `string` | 是 | `BUY` / `SELL` / `ALL` |
| `keyword` | `string` | 否 | 搜索关键词 |

**响应示例**：

```json
{
  "code": 200,
  "data": {
    "total": 156,
    "list": [
      {
        "code": "600519",
        "name": "贵州茅台",
        "quantity": 500,
        "currentPrice": 1680.50,
        "avgCost": 1620.00,
        "floatingPnl": 30250.00,
        "floatingPnlPercent": 3.73,
        "marketValueRatio": 0.15,
        "strategyId": "core-001",
        "strategyType": "CORE"
      }
    ]
  }
}
```

#### A.3.2 POST /api/v1/trade/add-position

**请求体**：

```json
{
  "code": "600519",
  "action": "ADD_POSITION",
  "quantity": 200
}
```

**响应**：

```json
{
  "code": 200,
  "success": true,
  "message": "补仓成功，已买入 200 股"
}
```

#### A.3.3 POST /api/v1/trade/close-position

**请求体**：

```json
{
  "code": "600519",
  "action": "CLOSE_POSITION",
  "quantity": 500
}
```

**响应**：

```json
{
  "code": 200,
  "success": true,
  "message": "平仓成功，已卖出 500 股"
}
```

### A.4 组件架构

#### A.4.1 组件树

```
HoldingsPage (主页面)
├── HoldingsFilter (筛选区)
│   ├── 日期选择器 ×2
│   ├── 交易方向下拉
│   ├── 搜索框
│   └── 操作按钮组（搜索/重置/导出）
├── HoldingsTable (数据表格)
│   ├── 左侧固定列：证券代码、证券名称
│   ├── 数据列：持仓数量、当前价格、成本价、浮动盈亏（语义色）、市值占比、策略类型
│   ├── 右侧固定列：补仓/平仓按钮
│   ├── 加载态：Skeleton 骨架屏
│   └── 空态：EmptyState 提示
├── Pagination (分页控件)
│   ├── 总条数展示
│   ├── 每页条数切换
│   ├── 页码翻页
│   └── 跳页输入
└── TradeModal (交易确认弹窗)
    ├── 持仓信息卡片
    ├── 补仓数量输入 / 平仓确认提示
    └── 取消/确认按钮
```

#### A.4.2 数据流

```
FilterState ──→ HoldingsQueryParams ──→ fetchHoldings() ──→ HoldingsApiResponse
                                                    │
PaginationState ─────────────────────────────────────┘
                                                    │
                                                    ▼
                                            useReducer (HoldingsPageState)
                                                    │
                                  ┌─────────────────┼─────────────────┐
                                  ▼                 ▼                  ▼
                          HoldingsTable        Pagination        TradeModal
                                  │
                          点击补仓/平仓
                                  │
                                  ▼
                          TradeModal (确认)
                                  │
                          确认 ───→ executeTradeAction() ──→ 刷新列表
```

### A.5 问题诊断记录

#### Issue 1：未使用的导入

- **文件**：`src/hooks/useDataCollection.ts`
- **根因**：导入了 `getLogger` 和声明了 `logger` 变量但未使用
- **修复**：移除 `import { getLogger } from '@/lib/logger'` 和 `const logger = getLogger()`
- **状态**：✅ 已修复

#### Issue 2：内联样式语法错误

- **文件**：`src/cockpit/widgets/SectorHeatmapWidget.tsx`
- **根因**：`style` 属性中 `backgroundColor` 表达式存在括号嵌套错误
- **修复前**：
  ```jsx
  style={{ backgroundColor: sector.changePercent >= 0 ? `rgba(...)` : `rgba(...)` }}
  ```
- **修复后**：使用 `getHeatmapColor(sector.changePercent)` 函数返回颜色值
  ```jsx
  style={{ backgroundColor: getHeatmapColor(sector.changePercent) }}
  ```
- **状态**：✅ 已修复

#### Issue 3：版本冲突处理缺少错误处理

- **文件**：`src/data/db.ts` (L44-49)
- **根因**：`deleteDB()` 的 `.catch()` 中未重置 `dbInstance = null`
- **修复前**：
  ```typescript
  deleteDB().then(() => { ... }).catch((e) => {
    console.error('[DB] Failed to delete old database:', e)
    reject(error)  // 缺少 dbInstance = null
  })
  ```
- **修复后**：
  ```typescript
  deleteDB().then(() => {
    dbInstance = null
    console.info('[DB] Reopening database after deletion...')
    openDB().then(resolve).catch(reject)
  }).catch((e) => {
    console.error('[DB] Failed to delete old database:', e)
    dbInstance = null
    reject(error)
  })
  ```
- **状态**：✅ 已修复

### A.6 文件清单

| 文件路径 | 类型 | 说明 |
|----------|------|------|
| `src/constants/trade.constants.ts` | 常量 | 交易模块枚举、颜色映射、配置值 |
| `src/types/modules/trade.types.ts` | 类型 | 持仓管理接口定义 |
| `src/services/trade/holdingsService.ts` | 服务 | API 请求封装（超时/重试） |
| `src/pages/trading/HoldingsPage.tsx` | 页面 | 主页面（useReducer 状态管理） |
| `src/pages/trading/components/HoldingsFilter.tsx` | 组件 | 筛选区（日期/方向/搜索） |
| `src/pages/trading/components/HoldingsTable.tsx` | 组件 | 数据表格（固定列/骨架屏/语义色） |
| `src/pages/trading/components/Pagination.tsx` | 组件 | 分页控件（条数切换/跳页） |
| `src/pages/trading/components/TradeModal.tsx` | 组件 | 交易确认弹窗（补仓/平仓） |

---

## 模块 B：数据采集模块

> 生成日期：2026-06-26
> 模块范围：`src/services/data-collector/` · `src/types/modules/widget.types.ts`（采集相关类型）· `src/constants/cockpit.constants.ts`（采集配置常量）
> 规范：所有数据结构必须先定义 TypeScript 接口；组件内禁止硬编码采集配置、超时时间、重试次数，必须从此字典对应的 constants 引用。
> 版本：v1.2.0 / Last Updated 2026-07-06（合并基准选取为 mtime 2026-07-08 的最新版本，内容一致）

### B.1 TypeScript 接口定义

#### B.1.1 DataSourceConfig — 数据源配置

**来源**: `src/types/modules/widget.types.ts`
**用途**: 每个 Widget 声明自身数据需求的核心配置，由 TaskScheduler 解析后创建采集器

| 字段 | 类型 | 必填 | 描述 |
|------|------|------|------|
| `type` | `DataSourceType` | 是 | 数据源类型（mock/rest/websocket），见 B.2.1 |
| `mode` | `CollectionMode` | 是 | 采集模式（polling/once/streaming），见 B.2.2 |
| `interval` | `number` | 是 | 轮询间隔（毫秒），默认 5000 |
| `endpoint` | `string` | 否 | API 端点路径 |
| `params` | `Record<string, unknown>` | 否 | 额外请求参数 |
| `enabled` | `boolean` | 是 | 是否启用采集 |

#### B.1.2 CollectionTask — 采集任务定义

**来源**: `src/types/modules/widget.types.ts`
**用途**: TaskScheduler 管理的单个采集任务，包含状态、重试、执行统计

| 字段 | 类型 | 必填 | 描述 |
|------|------|------|------|
| `taskId` | `string` | 是 | 任务唯一标识，格式 `task_{widgetId}_{instanceId}_{counter}` |
| `widgetId` | `string` | 是 | 关联 Widget 模板 ID |
| `instanceId` | `string` | 是 | 关联 Widget 实例 ID |
| `dataSource` | `DataSourceConfig` | 是 | 数据源配置 |
| `status` | `CollectionTaskStatus` | 是 | 当前状态，见 B.2.3 |
| `error` | `string` | 否 | 错误信息 |
| `lastRun` | `number` | 否 | 上次执行时间（毫秒时间戳） |
| `nextRun` | `number` | 否 | 下次执行时间（毫秒时间戳） |
| `runCount` | `number` | 是 | 执行次数 |
| `successCount` | `number` | 是 | 成功次数 |
| `failCount` | `number` | 是 | 失败次数 |

#### B.1.3 RawMarketData — 原始市场数据

**来源**: `src/types/modules/widget.types.ts`
**用途**: 采集器从外部获取的原始数据结构，未经适配

| 字段 | 类型 | 必填 | 描述 |
|------|------|------|------|
| `dataType` | `string` | 是 | 数据类型：indices/sectors/fundFlow/sentiment/watchlist/portfolio/tradeReview/analysisScores/modelComparison/stockPool/chatHistory/hotSectors/valuePit |
| `source` | `string` | 是 | 数据来源标识 |
| `payload` | `unknown` | 是 | 原始数据载荷 |
| `timestamp` | `number` | 是 | 采集时间（毫秒时间戳） |

#### B.1.4 CollectorConfig — 采集器配置

**来源**: `src/types/modules/widget.types.ts`
**用途**: 各采集器的通用配置项

| 字段 | 类型 | 必填 | 描述 |
|------|------|------|------|
| `timeout` | `number` | 是 | 超时时间（毫秒），默认 10000 |
| `retryCount` | `number` | 是 | 重试次数，默认 3 |
| `retryInterval` | `number` | 是 | 重试间隔（毫秒），默认 2000 |
| `headers` | `Record<string, string>` | 否 | 请求头 |

#### B.1.5 BaseCollector — 基础采集器（抽象类）

**来源**: `src/services/data-collector/collectors/BaseCollector.ts`
**用途**: 所有采集器的基类，提供超时控制、错误捕获、重试机制

**核心方法**:

| 方法 | 签名 | 描述 |
|------|------|------|
| `fetch` | `(task: CollectionTask) => Promise<RawMarketData>` | 执行采集并返回原始数据 |
| `fetchWithRetry` | `(task: CollectionTask) => Promise<RawMarketData>` | 带重试的采集执行 |

**配置**: 超时 10s（`COLLECTOR_DEFAULT_CONFIG.TIMEOUT`），重试 3 次（`COLLECTOR_DEFAULT_CONFIG.RETRY_COUNT`），重试间隔 2s（`COLLECTOR_DEFAULT_CONFIG.RETRY_INTERVAL`）

#### B.1.6 TaskScheduler — 任务调度器

**来源**: `src/services/data-collector/TaskScheduler.ts`
**用途**: 管理 Widget 数据采集任务的注册、启动、停止、错误恢复

**核心方法**:

| 方法 | 签名 | 描述 |
|------|------|------|
| `registerTask` | `(widgetId, instanceId, dataSource) => string` | 注册采集任务，返回 taskId |
| `startTask` | `(taskId: string) => Promise<void>` | 启动采集任务（自动创建对应 Collector） |
| `stopTask` | `(taskId: string) => void` | 停止采集任务，清除定时器 |
| `stopAll` | `() => void` | 停止所有任务（页面销毁时调用） |
| `getTask` | `(taskId: string) => CollectionTask \| undefined` | 获取任务状态 |
| `getAllTasks` | `() => CollectionTask[]` | 获取所有任务列表 |
| `subscribe` | `(callback: CollectionResultCallback) => () => void` | 订阅采集结果回调（返回取消订阅函数） |

**生命周期管理**:
- 自动轮询：根据 `DataSourceConfig.interval` 创建 `setInterval`
- 错误恢复：采集失败后自动记录错误，下一次轮询继续尝试
- 内存防泄漏：`stopAll()` 清除所有 `setInterval` 和 Collector 实例

#### B.1.7 MarketDataAdapter — 市场数据适配器

**来源**: `src/services/data-collector/MarketDataAdapter.ts`
**用途**: 将不同来源（Mock/REST/WebSocket）的原始数据统一映射为 `MarketData`

**核心方法**:

| 方法 | 签名 | 描述 |
|------|------|------|
| `adapt` | `(rawData: RawMarketData) => Partial<MarketData>` | 按 dataType 分派适配 |
| `merge` | `(...partials: Partial<MarketData>[]) => MarketData` | 合并多个数据片段为完整 MarketData |

**支持的数据类型适配**:

| dataType | 适配方法 | 输出字段 |
|----------|---------|---------|
| `indices` | `adaptIndices` | `MarketData.indices` |
| `sectors` | `adaptSectors` | `MarketData.sectors` |
| `fundFlow` | `adaptFundFlows` | `MarketData.fundFlows` |
| `sentiment` | `adaptSentiment` | `MarketData.sentiment` |
| `watchlist` | `adaptWatchlist` | `MarketData.watchlist` |
| `portfolio` | `adaptPortfolio` | `MarketData.portfolio` |
| `tradeReview` | `adaptTradeReview` | `MarketData.tradeReview` |
| `analysisScores` | `adaptAnalysisScores` | `MarketData.analysisScores` |
| `modelComparison` | `adaptModelComparison` | `MarketData.modelComparison` |
| `stockPool` | `adaptStockPool` | `MarketData.stockPool` |
| `chatHistory` | `adaptChatHistory` | `MarketData.chatHistory` |
| `hotSectors` | `adaptHotSectors` | `MarketData.hotSectors` |
| `valuePit` | `adaptValuePit` | `MarketData.valuePit` |

#### B.1.8 采集器实现清单

| 采集器 | 文件 | 描述 | 配置来源 |
|--------|------|------|---------|
| `MockCollector` | `collectors/MockCollector.ts` | 模拟数据采集器，生成随机波动行情 | `MOCK_COLLECTOR_CONFIG` |
| `RestCollector` | `collectors/RestCollector.ts` | REST API 采集器，通过 HTTP 请求获取数据 | `REST_COLLECTOR_CONFIG` |
| `WebSocketCollector` | `collectors/WebSocketCollector.ts` | WebSocket 实时推送采集器（预留） | `WEBSOCKET_COLLECTOR_CONFIG` |

### B.2 枚举常量定义

#### B.2.1 DataSourceType — 数据源类型

**来源**: `src/types/modules/widget.types.ts` + `src/constants/cockpit.constants.ts:163-167`

| 枚举值 | 常量引用 | 描述 |
|--------|---------|------|
| `'mock'` | `DATA_SOURCE_TYPE.MOCK` | 模拟数据源 |
| `'rest'` | `DATA_SOURCE_TYPE.REST` | REST API 数据源 |
| `'websocket'` | `DATA_SOURCE_TYPE.WEBSOCKET` | WebSocket 实时推送 |

#### B.2.2 CollectionMode — 采集模式

**来源**: `src/constants/cockpit.constants.ts:170-174`

| 枚举值 | 常量引用 | 描述 |
|--------|---------|------|
| `'polling'` | `COLLECTION_MODE.POLLING` | 定时轮询 |
| `'once'` | `COLLECTION_MODE.ONCE` | 单次采集 |
| `'streaming'` | `COLLECTION_MODE.STREAMING` | 流式推送 |

#### B.2.3 CollectionTaskStatus — 采集任务状态

**来源**: `src/types/modules/widget.types.ts`

| 枚举值 | 描述 |
|--------|------|
| `'pending'` | 等待执行 |
| `'running'` | 执行中 |
| `'paused'` | 已暂停 |
| `'error'` | 错误 |
| `'completed'` | 已完成 |

#### B.2.4 采集器配置常量

**来源**: `src/constants/cockpit.constants.ts:176-223`

| 常量引用 | 值 | 描述 |
|---------|------|------|
| `COLLECTOR_DEFAULT_CONFIG.TIMEOUT` | `10000` | API 超时时间（毫秒） |
| `COLLECTOR_DEFAULT_CONFIG.RETRY_COUNT` | `3` | 重试次数 |
| `COLLECTOR_DEFAULT_CONFIG.RETRY_INTERVAL` | `2000` | 重试间隔（毫秒） |
| `COLLECTOR_DEFAULT_CONFIG.DEFAULT_POLLING_INTERVAL` | `5000` | 默认轮询间隔（毫秒） |
| `COLLECTOR_DEFAULT_CONFIG.MIN_POLLING_INTERVAL` | `1000` | 最小轮询间隔（毫秒） |
| `COLLECTOR_DEFAULT_CONFIG.MAX_POLLING_INTERVAL` | `60000` | 最大轮询间隔（毫秒） |
| `MOCK_COLLECTOR_CONFIG.MIN_DELAY` | `200` | 模拟延迟最小值（毫秒） |
| `MOCK_COLLECTOR_CONFIG.MAX_DELAY` | `1000` | 模拟延迟最大值（毫秒） |
| `MOCK_COLLECTOR_CONFIG.PRICE_FLUCTUATION` | `0.02` | 随机数据波动范围 |
| `MOCK_COLLECTOR_CONFIG.DEFAULT_SEED` | `'v9-market-data'` | 默认随机种子 |
| `REST_COLLECTOR_CONFIG.BASE_URL` | `import.meta.env.VITE_API_BASE_URL \|\| '/api'` | 基础 API URL |
| `WEBSOCKET_COLLECTOR_CONFIG.RECONNECT_INTERVAL` | `3000` | 重连间隔（毫秒） |
| `WEBSOCKET_COLLECTOR_CONFIG.MAX_RECONNECT_COUNT` | `5` | 最大重连次数 |

#### B.2.5 环境变量驱动

**来源**: `src/constants/cockpit.constants.ts:228`

| 常量引用 | 表达式 | 描述 |
|---------|--------|------|
| `ACTIVE_DATA_SOURCE` | `VITE_DATA_SOURCE_TYPE \|\| 'mock'` | 当前生效的数据源类型，开发环境默认 mock |

### B.3 数据流向

```
┌──────────────────────────────────────────────────────────────────┐
│  数据采集三层架构                                                  │
│                                                                  │
│  WidgetDataSourceConfig ──→ TaskScheduler                         │
│  (type/mode/interval)        │                                   │
│                              │ registerTask() → startTask()      │
│                              ▼                                   │
│                     ┌─────────────────┐                          │
│                     │  BaseCollector   │                          │
│                     │  ├─ MockCollector│                          │
│                     │  ├─ RestCollector│                          │
│                     │  └─ WSCollector  │                          │
│                     └────────┬────────┘                          │
│                              │ fetch() / fetchWithRetry()        │
│                              ▼                                   │
│                         RawMarketData                             │
│                              │                                   │
│                              ▼                                   │
│                     ┌─────────────────┐                          │
│                     │ MarketDataAdapter│                          │
│                     │  adapt() + merge()│                         │
│                     └────────┬────────┘                          │
│                              │                                   │
│                              ▼                                   │
│                          MarketData                               │
│                              │                                   │
│                              ▼                                   │
│                   MarketDataProvider (React Context)             │
│                              │                                   │
│                   ┌──────────┼──────────┐                        │
│                   ▼          ▼          ▼                        │
│              Widget A   Widget B   Widget C                      │
│                                                                  │
│  生命周期:                                                       │
│    registerTask → startTask → fetch → adapt → dispatch           │
│    → (repeat per interval) → stopTask → cleanup                  │
└──────────────────────────────────────────────────────────────────┘
```

**数据来源**：`WidgetRegistry.createInstance()` → `TaskScheduler.registerTask()` → `BaseCollector.fetch()`
**数据去向**：`MarketDataAdapter.adapt()` → `MarketDataProvider` → 各 Widget 组件的 `data` prop
**更新频率**：默认 5 秒轮询，可通过 `DataSourceConfig.interval` 调整
**数据源切换**：通过 `VITE_DATA_SOURCE_TYPE` 环境变量控制，无需修改代码

### B.4 变更日志

| 日期 | 版本 | 变更内容 | 变更人 |
|------|------|----------|--------|
| 2026-06-26 | v1.0.0 | 初始创建，覆盖数据采集三层架构全部类型定义（8 个接口）与枚举常量（5 组） | Architecture Asset Governor |
| 2026-07-06 | v1.2.0 | CollectorConfig +1 字段（headers）；RawMarketData.dataType +2 值（hotSectors/valuePit）；MarketDataAdapter +2 适配规则 | Architecture Asset Governor |

---

## 模块 C：Cockpit Widget 框架

> 生成日期：2026-06-26
> 模块范围：`src/types/modules/widget.types.ts` · `src/constants/cockpit.constants.ts` · `src/cockpit/core/widgetRegistry.ts`
> 规范：所有数据结构必须先定义 TypeScript 接口；组件内禁止硬编码状态、颜色、标签，必须从此字典对应的 constants 文件引用。
> 版本：v1.2.0 / Last Updated 2026-07-06
> **共享采集类型约定**：本模块涉及的 `DataSourceConfig` / `CollectionTask` / `DataSourceType` / `CollectionMode` / `CollectionTaskStatus` / 采集器配置常量，统一定义于 **§B（数据采集模块）**，此处以引用接入，避免冗余。

### C.1 TypeScript 接口定义

#### C.1.1 MarketData — 标准化市场数据

**来源**: `src/types/modules/widget.types.ts:63-92`
**用途**: 所有 Widget 统一消费的数据接口，由 MarketDataAdapter 转换后提供

| 字段 | 类型 | 必填 | 描述 |
|------|------|------|------|
| `timestamp` | `number` | 是 | 数据生成时间（毫秒时间戳） |
| `indices` | `MarketIndexData[]` | 是 | 大盘指数数据列表 |
| `sectors` | `SectorHeatmapData[]` | 是 | 板块热力图数据列表 |
| `fundFlows` | `FundFlowData[]` | 是 | 资金流向数据列表 |
| `sentiment` | `SentimentData` | 是 | 市场情绪数据 |
| `watchlist` | `WatchlistData[]` | 是 | 自选股列表 |
| `portfolio` | `PortfolioData` | 是 | 持仓概览数据 |
| `tradeReview` | `TradeReviewData` | 是 | AI 交易复盘数据 |
| `analysisScores` | `AnalysisScores` | 是 | 投资画像 / 分析评分数据 |
| `modelComparison` | `ModelComparison` | 是 | AI 大模型对比数据 |
| `stockPool` | `StockPool` | 是 | 股票池管理与监控数据 |
| `chatHistory` | `ChatHistory` | 是 | 个股深度分析 / 市场分析聊天数据 |
| `hotSectors` | `HotSectorData[]` | 是 | 热门板块策略评分数据 |
| `valuePit` | `ValuePitData[]` | 是 | 价值洼地策略评分数据 |

#### C.1.2 MarketIndexData — 大盘指数数据

| 字段 | 类型 | 必填 | 描述 |
|------|------|------|------|
| `code` | `string` | 是 | 指数代码，如 `000001`（上证）、`399001`（深证） |
| `name` | `string` | 是 | 指数名称，如 `上证指数` |
| `price` | `number` | 是 | 当前点位 |
| `change` | `number` | 是 | 涨跌额 |
| `changePercent` | `number` | 是 | 涨跌幅（%） |
| `high` | `number` | 否 | 日内最高 |
| `low` | `number` | 否 | 日内最低 |
| `volume` | `string` | 否 | 成交量 |

#### C.1.3 SectorHeatmapData — 板块热力图数据

| 字段 | 类型 | 必填 | 描述 |
|------|------|------|------|
| `name` | `string` | 是 | 板块名称 |
| `code` | `string` | 是 | 板块代码 |
| `changePercent` | `number` | 是 | 涨跌幅（%） |
| `turnover` | `string` | 否 | 成交额 |
| `fundFlow` | `number \| null` | 否 | 资金流向（净流入为正，净流出为负，null 表示无数据） |

#### C.1.4 FundFlowData — 资金流向数据

| 字段 | 类型 | 必填 | 描述 |
|------|------|------|------|
| `type` | `string` | 是 | 资金类型 key，见 `FUND_FLOW_TYPES` |
| `name` | `string` | 是 | 资金类型显示名 |
| `value` | `number` | 是 | 净流入金额 |
| `unit` | `string` | 是 | 金额单位，如 `亿` |

#### C.1.5 SentimentData — 市场情绪数据

| 字段 | 类型 | 必填 | 描述 |
|------|------|------|------|
| `fearGreedIndex` | `number` | 是 | 恐惧贪婪指数 0-100 |
| `fearGreedLabel` | `string` | 是 | 恐惧贪婪标签，如 `极度恐惧` |
| `totalStocks` | `number` | 是 | 总股票数 |
| `up` | `number` | 是 | 上涨家数 |
| `down` | `number` | 是 | 下跌家数 |
| `flat` | `number` | 是 | 平盘家数 |
| `limitUp` | `number` | 是 | 涨停家数 |
| `limitDown` | `number` | 是 | 跌停家数 |

#### C.1.6 WatchlistData — 自选股数据

| 字段 | 类型 | 必填 | 描述 |
|------|------|------|------|
| `name` | `string` | 是 | 股票名称 |
| `code` | `string` | 是 | 股票代码 |
| `price` | `number` | 是 | 最新价 |
| `changePercent` | `number` | 是 | 涨跌幅（%） |

#### C.1.7 PortfolioData — 持仓概览数据

| 字段 | 类型 | 必填 | 描述 |
|------|------|------|------|
| `totalAssets` | `string` | 是 | 总资产 |
| `availableFunds` | `string` | 是 | 可用资金 |
| `todayPnL` | `string` | 是 | 今日盈亏 |
| `todayPnLPercent` | `number` | 是 | 今日盈亏比例（%） |
| `totalPnL` | `string` | 是 | 累计盈亏 |
| `totalPnLPercent` | `number` | 是 | 累计盈亏比例（%） |
| `holdings` | `number` | 是 | 持仓股票数 |

#### C.1.8 TradeReviewData — AI 交易复盘数据

| 字段 | 类型 | 必填 | 描述 |
|------|------|------|------|
| `totalTrades` | `number` | 是 | 总交易次数 |
| `profitable` | `number` | 是 | 盈利次数 |
| `losing` | `number` | 是 | 亏损次数 |
| `winRate` | `number` | 是 | 胜率 0-1 |
| `profitLossRatio` | `number` | 是 | 盈亏比 |
| `disciplineScore` | `number` | 是 | 纪律评分 0-100 |

#### C.1.9 AnalysisScores — 投资画像 / 分析评分

| 字段 | 类型 | 必填 | 描述 |
|------|------|------|------|
| `profile` | `InvestmentProfile` | 是 | 用户投资画像 |
| `kai` | `KaiScore` | 是 | KAI 选股综合评分 |

#### C.1.10 InvestmentProfile — 投资画像

| 字段 | 类型 | 必填 | 描述 |
|------|------|------|------|
| `tags` | `string[]` | 是 | 用户标签列表，如 `["老股民", "择时"]` |
| `metrics` | `ProfileMetric[]` | 是 | 核心指标卡片列表 |

#### C.1.11 ProfileMetric — 投资画像指标

| 字段 | 类型 | 必填 | 描述 |
|------|------|------|------|
| `name` | `string` | 是 | 指标名称，见 `INVESTMENT_PROFILE_METRICS` |
| `score` | `number` | 是 | 指标评分 0-100 |
| `description` | `string` | 否 | 指标说明 |
| `icon` | `string` | 否 | 图标标识 |

#### C.1.12 KaiScore — KAI 选股综合评分

| 字段 | 类型 | 必填 | 描述 |
|------|------|------|------|
| `totalScore` | `number` | 是 | 综合评分 0-100 |
| `sentiment` | `number` | 是 | 情绪值 0-100 |
| `trend` | `number` | 是 | 趋势值 0-100 |
| `flow` | `number` | 是 | 流量值 0-100 |
| `dimensions` | `KaiDimension[]` | 是 | 六大类维度评分 |
| `detailDistribution` | `KaiDetailItem[]` | 是 | 维度细项分布表 |

#### C.1.13 KaiDimension — KAI 评分维度

| 字段 | 类型 | 必填 | 描述 |
|------|------|------|------|
| `name` | `string` | 是 | 维度名称，见 `KAI_DIMENSION_NAMES` |
| `score` | `number` | 是 | 维度得分 0-100 |
| `weight` | `number` | 是 | 权重 0-1 |
| `status` | `string` | 是 | 评分状态文本 |
| `color` | `string` | 是 | 颜色标签，来自 `SCORE_LEVELS` |

#### C.1.14 KaiDetailItem — KAI 维度细项

| 字段 | 类型 | 必填 | 描述 |
|------|------|------|------|
| `dimensionName` | `string` | 是 | 所属维度名称 |
| `itemName` | `string` | 是 | 细项名称 |
| `score` | `number` | 是 | 细项得分 0-100 |
| `weight` | `number` | 是 | 细项权重 0-1 |
| `color` | `string` | 是 | 颜色标签 |

#### C.1.15 ModelComparison — 模型对比数据

| 字段 | 类型 | 必填 | 描述 |
|------|------|------|------|
| `leftModel` | `ModelInfo` | 是 | 左侧模型信息 |
| `rightModel` | `ModelInfo` | 是 | 右侧模型信息 |
| `dimensions` | `CompareDimension[]` | 是 | 对比维度列表 |
| `riskHint` | `string` | 是 | 风险提示文本 |

#### C.1.16 ModelInfo — 模型信息

| 字段 | 类型 | 必填 | 描述 |
|------|------|------|------|
| `id` | `string` | 是 | 模型 ID，见 `LLM_MODEL_VERSIONS` |
| `name` | `string` | 是 | 模型名称 |
| `version` | `string` | 是 | 模型版本号 |
| `score` | `number` | 是 | 模型综合得分 |

#### C.1.17 CompareDimension — 模型对比维度

| 字段 | 类型 | 必填 | 描述 |
|------|------|------|------|
| `name` | `string` | 是 | 维度名称 |
| `leftScore` | `number` | 是 | 左侧模型得分 |
| `rightScore` | `number` | 是 | 右侧模型得分 |
| `weight` | `number` | 是 | 维度权重 0-1 |

#### C.1.18 StockPool — 股票池数据

| 字段 | 类型 | 必填 | 描述 |
|------|------|------|------|
| `stocks` | `StockPoolItem[]` | 是 | 股票列表 |
| `total` | `number` | 是 | 总条数 |
| `page` | `number` | 是 | 当前页码 |
| `pageSize` | `number` | 是 | 每页条数 |

#### C.1.19 StockPoolItem — 股票池条目

| 字段 | 类型 | 必填 | 描述 |
|------|------|------|------|
| `code` | `string` | 是 | 股票代码 |
| `name` | `string` | 是 | 股票名称 |
| `price` | `number` | 是 | 最新价 |
| `changePercent` | `number` | 是 | 涨跌幅（%） |
| `turnover` | `string` | 是 | 成交额 |
| `turnoverRate` | `string` | 是 | 换手率 |
| `statusColor` | `string` | 是 | 状态颜色条，来自 `STOCK_POOL_STATUS_COLORS` |
| `statusLabel` | `string` | 是 | 状态标签文本 |

#### C.1.20 ChatHistory — 聊天历史

| 字段 | 类型 | 必填 | 描述 |
|------|------|------|------|
| `target` | `string` | 是 | 当前选中的标的代码或 `market` |
| `targetType` | `'stock' \| 'market'` | 是 | 标的类型 |
| `messages` | `ChatMessage[]` | 是 | 消息列表 |

#### C.1.21 ChatMessage — 聊天消息

| 字段 | 类型 | 必填 | 描述 |
|------|------|------|------|
| `id` | `string` | 是 | 消息唯一标识 |
| `role` | `'user' \| 'assistant'` | 是 | 消息角色 |
| `content` | `string` | 是 | 消息内容（Markdown 格式） |
| `timestamp` | `number` | 是 | 消息时间戳 |

#### C.1.22 HotSectorData — 热门板块策略评分

**来源**: `src/types/modules/widget.types.ts:337-354`
**用途**: 热门板块策略评分数据，用于驾驶舱 Widget 展示

| 字段 | 类型 | 必填 | 描述 |
|------|------|------|------|
| `symbol` | `string` | 是 | 股票代码 |
| `name` | `string` | 是 | 股票名称 |
| `score` | `number` | 是 | 综合评分 0-5 |
| `action` | `'immediate' \| 'probe' \| 'ignore'` | 是 | 动作建议 |
| `dimensions` | `{ momentum: number; sentiment: number; technical: number; valuation: number; composite: number }` | 是 | 五维评分 |

#### C.1.23 ValuePitData — 价值洼地策略评分

**来源**: `src/types/modules/widget.types.ts:357-377`
**用途**: 价值洼地候选、五维评分与轮动信号状态

| 字段 | 类型 | 必填 | 描述 |
|------|------|------|------|
| `symbol` | `string` | 是 | 股票代码 |
| `name` | `string` | 是 | 股票名称 |
| `score` | `number` | 是 | 综合评分 0-5 |
| `action` | `'immediate' \| 'probe' \| 'wait' \| 'ignore'` | 是 | 动作建议 |
| `rotationSignal` | `boolean` | 是 | 轮动信号是否触发 |
| `dimensions` | `{ catalyst: number; valuation: number; chip: number; rotation: number; liquidity: number; composite: number }` | 是 | 六维评分 |

#### C.1.24 WidgetConfig — Widget 实例配置

| 字段 | 类型 | 必填 | 描述 |
|------|------|------|------|
| `instanceId` | `string` | 是 | 实例唯一标识 |
| `widgetId` | `string` | 是 | Widget 模板 ID |
| `size` | `{ cols: number; rows: number }` | 是 | 网格尺寸 |
| `position` | `{ x: number; y: number }` | 否 | 网格位置 |
| `title` | `string` | 是 | 显示标题 |
| `settings` | `Record<string, unknown>` | 是 | 自定义设置 |
| `visible` | `boolean` | 是 | 是否可见 |
| `collapsed` | `boolean` | 是 | 是否折叠 |
| `dataSource` | `DataSourceConfig` | 否 | 数据源配置 → **见 §B.1.1** |

#### C.1.25 WidgetMeta — Widget 模板元数据

| 字段 | 类型 | 必填 | 描述 |
|------|------|------|------|
| `id` | `string` | 是 | Widget 模板 ID |
| `name` | `string` | 是 | 显示名称 |
| `category` | `string` | 是 | 分类 |
| `description` | `string` | 是 | 功能描述 |
| `defaultSize` | `{ cols: number; rows: number }` | 是 | 默认网格尺寸 |
| `defaultConfig` | `Record<string, unknown>` | 否 | 默认配置 |
| `defaultDataSource` | `DataSourceConfig` | 否 | 默认数据源配置 → **见 §B.1.1** |

#### C.1.26 WidgetRuntimeState — Widget 运行时状态

| 字段 | 类型 | 必填 | 描述 |
|------|------|------|------|
| `instanceId` | `string` | 是 | 实例 ID |
| `widgetId` | `string` | 是 | Widget 模板 ID |
| `status` | `'idle' \| 'loading' \| 'ready' \| 'error'` | 是 | 当前状态 |
| `error` | `string` | 否 | 错误信息 |
| `lastRefresh` | `number` | 否 | 上次刷新时间 |

#### C.1.27 WidgetTemplate — Widget 注册模板（widgetRegistry）

**来源**: `src/cockpit/core/widgetRegistry.ts:9-14`

| 字段 | 类型 | 必填 | 描述 |
|------|------|------|------|
| `meta` | `WidgetMeta` | 是 | Widget 元数据 |
| `component` | `() => Promise<{ default: React.ComponentType }>` | 是 | 懒加载组件工厂函数 |
| `configPanel` | `() => Promise<{ default: React.ComponentType }>` | 否 | 配置面板懒加载工厂函数 |

#### C.1.28 WidgetRegistry 已注册 Widget 清单

| widgetId | 名称 | 分类 | 组件文件 |
|----------|------|------|---------|
| `marketIndices` | 市场指数 | market | `MarketIndicesWidget.tsx` |
| `sectorHeatmap` | 板块热力图 | market | `SectorHeatmapWidget.tsx` |
| `fundFlow` | 资金流向 | market | `FundFlowWidget.tsx` |
| `marketSentiment` | 市场情绪 | market | `MarketSentimentWidget.tsx` |
| `watchlist` | 自选股 | market | `WatchlistWidget.tsx` |
| `portfolioOverview` | 持仓概览 | portfolio | `PortfolioOverviewWidget.tsx` |
| `aiTradeReview` | AI 交易复盘 | strategy | `AITradeReviewWidget.tsx` |
| `investmentProfile` | 投资画像 | analysis | `InvestmentProfileWidget.tsx` |
| `stockPool` | 股票池监控 | analysis | `StockPoolWidget.tsx` |
| `kaiScore` | KAI 综合评分 | analysis | `KaiScoreWidget.tsx` |
| `modelCompare` | 大模型对比 | analysis | `ModelCompareWidget.tsx` |
| `stockChat` | 深度分析助手 | analysis | `StockChatWidget.tsx` |
| `hotSector` | 热门板块策略 | strategy | `HotSectorWidget.tsx` |
| `valuePit` | 价值洼地策略 | strategy | `ValuePitWidget.tsx` |
| `agentPerformance` | 智能体性能追踪 | 系统监控 | `AgentPerformanceWidget.tsx` |
| `engineStatus` | 引擎状态监控 | 系统监控 | `EngineStatusWidget.tsx` |
| `systemArchitecture` | 系统架构视图 | 系统监控 | `SystemArchitectureWidget.tsx` |
| `pnlAnalysis` | 盈亏分析 | 交易分析 | `PnLAnalysisWidget.tsx` |
| `positionControl` | 仓位控制 | 投资组合 | `PositionControlWidget.tsx` |
| `riskMonitor` | 风险监控 | 系统监控 | `RiskMonitorWidget.tsx` |
| `signalMonitor` | 信号监控 | 交易分析 | `SignalMonitorWidget.tsx` |

> 共享采集类型的引用：本清单中各 Widget 的 `dataSource` 配置类型 `DataSourceConfig`（C.1.24 / C.1.25）、采集任务 `CollectionTask`、以及枚举 `DataSourceType` / `CollectionMode` / `CollectionTaskStatus`、采集器配置常量，均统一定义于 **§B 数据采集模块**，此处不再重复定义。

### C.2 枚举常量定义

#### C.2.1 DataSourceType — 数据源类型 → **见 §B.2.1**

#### C.2.2 CollectionMode — 采集模式 → **见 §B.2.2**

#### C.2.3 CollectionTaskStatus — 采集任务状态 → **见 §B.2.3**

#### C.2.4 WIDGET_SIZE — Widget 网格尺寸

**来源**: `src/constants/cockpit.constants.ts:7-13`

| 常量引用 | cols | rows | 用途 |
|---------|------|------|------|
| `WIDGET_SIZE.FULL_WIDTH` | 4 | 2 | 全宽 Widget |
| `WIDGET_SIZE.HALF_WIDTH` | 2 | 2 | 半宽 Widget |
| `WIDGET_SIZE.THIRD_WIDTH` | 1 | 2 | 1/3 宽 Widget |
| `WIDGET_SIZE.LARGE_HEIGHT` | 4 | 3 | 大高度 Widget |
| `WIDGET_SIZE.CHAT_HEIGHT` | 4 | 4 | 聊天 Widget |

#### C.2.5 MARKET_INDEX_CODES — 大盘指数代码

**来源**: `src/constants/cockpit.constants.ts:15-20`

| 常量引用 | 代码 | 名称 |
|---------|------|------|
| `MARKET_INDEX_CODES.SHANGHAI` | `000001` | 上证指数 |
| `MARKET_INDEX_CODES.SHENZHEN` | `399001` | 深证成指 |
| `MARKET_INDEX_CODES.CHINEXT` | `399006` | 创业板指 |
| `MARKET_INDEX_CODES.STAR` | `000688` | 科创50 |

#### C.2.6 FUND_FLOW_TYPES — 资金流向类型

**来源**: `src/constants/cockpit.constants.ts:29-33`

| 常量引用 | 值 | 显示名 |
|---------|------|------|
| `FUND_FLOW_TYPES.MAIN` | `main` | 主力净流入 |
| `FUND_FLOW_TYPES.RETAIL` | `retail` | 散户净流入 |
| `FUND_FLOW_TYPES.NORTH` | `north` | 北向净流入 |

#### C.2.7 SENTIMENT_LEVELS — 市场情绪分级

**来源**: `src/constants/cockpit.constants.ts:51-57`

| 常量引用 | 范围 | 标签 | 颜色 |
|---------|------|------|------|
| `SENTIMENT_LEVELS.EXTREME_FEAR` | 0-20 | 极度恐惧 | `bg-red-600` |
| `SENTIMENT_LEVELS.FEAR` | 20-40 | 恐惧 | `bg-red-400` |
| `SENTIMENT_LEVELS.NEUTRAL` | 40-60 | 中性 | `bg-yellow-400` |
| `SENTIMENT_LEVELS.GREEDY` | 60-80 | 贪婪 | `bg-green-400` |
| `SENTIMENT_LEVELS.EXTREME_GREEDY` | 80-100 | 极度贪婪 | `bg-green-600` |

#### C.2.8 STOCK_COLOR_MAPPING — 股票涨跌颜色映射（A 股标准：红涨绿跌）

**来源**: `src/constants/cockpit.constants.ts:62-81`

| 常量引用 | 含义 | HEX 值 | Tailwind 类名 |
|---------|------|--------|-------------|
| `STOCK_COLOR_MAPPING.UP` | 上涨 | `#ef4444` | `text-red-500` |
| `STOCK_COLOR_MAPPING.DOWN` | 下跌 | `#22c55e` | `text-green-500` |
| `STOCK_COLOR_MAPPING.NEUTRAL` | 平盘 | `#9ca3af` | `text-gray-400` |

#### C.2.9 SCORE_LEVELS — 评分等级映射

**来源**: `src/constants/cockpit.constants.ts:86-92`

| 常量引用 | 范围 | 标签 | 颜色 |
|---------|------|------|------|
| `SCORE_LEVELS.EXCELLENT` | 80-100 | 优秀 | `#22c55e` |
| `SCORE_LEVELS.GOOD` | 60-80 | 良好 | `#3b82f6` |
| `SCORE_LEVELS.AVERAGE` | 40-60 | 一般 | `#f59e0b` |
| `SCORE_LEVELS.POOR` | 20-40 | 较弱 | `#f97316` |
| `SCORE_LEVELS.BAD` | 0-20 | 差 | `#ef4444` |

#### C.2.10 KAI_DIMENSION_NAMES — KAI 评分维度

**来源**: `src/constants/cockpit.constants.ts:97-104`

| 常量引用 | 中文名 |
|---------|--------|
| `KAI_DIMENSION_NAMES.COMPETITIVENESS` | 竞争力 |
| `KAI_DIMENSION_NAMES.TECHNICAL` | 技术面 |
| `KAI_DIMENSION_NAMES.FUNDAMENTAL` | 基本面 |
| `KAI_DIMENSION_NAMES.SENTIMENT` | 情绪面 |
| `KAI_DIMENSION_NAMES.FUND_FLOW` | 资金面 |
| `KAI_DIMENSION_NAMES.INDUSTRY` | 行业面 |

#### C.2.11 LLM_MODEL_VERSIONS — AI 大模型版本

**来源**: `src/constants/cockpit.constants.ts:109-114`

| 常量引用 | ID | 名称 | 版本 |
|---------|------|------|------|
| `LLM_MODEL_VERSIONS.KAILLM_V2_1` | `kaillm-v2.1` | KAILLM v2.1 | v2.1 |
| `LLM_MODEL_VERSIONS.KAILLM_V2_0` | `kaillm-v2.0` | KAILLM v2.0 | v2.0 |
| `LLM_MODEL_VERSIONS.BASELINE_V1_5` | `baseline-v1.5` | 基准模型 v1.5 | v1.5 |
| `LLM_MODEL_VERSIONS.BASELINE_V1_0` | `baseline-v1.0` | 基准模型 v1.0 | v1.0 |

#### C.2.12 INVESTMENT_PROFILE_METRICS — 投资画像指标

**来源**: `src/constants/cockpit.constants.ts:119-125`

| 常量引用 | 名称 | 描述 |
|---------|------|------|
| `INVESTMENT_PROFILE_METRICS.ABILITY` | 投资能力 | 综合收益与风险控制能力 |
| `INVESTMENT_PROFILE_METRICS.STYLE` | 投资风格 | 价值/成长/均衡等风格倾向 |
| `INVESTMENT_PROFILE_METRICS.RISK_CONTROL` | 风控能力 | 回撤控制与仓位管理能力 |
| `INVESTMENT_PROFILE_METRICS.HOLDING` | 持仓透视 | 集中度与行业配置分析 |
| `INVESTMENT_PROFILE_METRICS.TIMING` | 择时风格 | 左侧/右侧交易倾向 |

#### C.2.13 STOCK_POOL_STATUS_COLORS — 股票池状态颜色

**来源**: `src/constants/cockpit.constants.ts:141-146`

| 常量引用 | 颜色 | 标签 |
|---------|------|------|
| `STOCK_POOL_STATUS_COLORS.ACTIVE` | `#22c55e` | 活跃 |
| `STOCK_POOL_STATUS_COLORS.WARM` | `#3b82f6` | 温热 |
| `STOCK_POOL_STATUS_COLORS.COOL` | `#f59e0b` | 冷清 |
| `STOCK_POOL_STATUS_COLORS.COLD` | `#9ca3af` | 冷淡 |

#### C.2.14 SECTOR_COLOR_MAPPING — 板块涨跌颜色

**来源**: `src/constants/cockpit.constants.ts:41-49`

| 常量引用 | Tailwind 类名 | 含义 |
|---------|-------------|------|
| `SECTOR_COLOR_MAPPING.STRONG_UP` | `bg-green-500` | 强势上涨 |
| `SECTOR_COLOR_MAPPING.UP` | `bg-green-400` | 上涨 |
| `SECTOR_COLOR_MAPPING.WEAK_UP` | `bg-green-300` | 微涨 |
| `SECTOR_COLOR_MAPPING.FLAT` | `bg-gray-300` | 平盘 |
| `SECTOR_COLOR_MAPPING.WEAK_DOWN` | `bg-red-300` | 微跌 |
| `SECTOR_COLOR_MAPPING.DOWN` | `bg-red-400` | 下跌 |
| `SECTOR_COLOR_MAPPING.STRONG_DOWN` | `bg-red-500` | 强势下跌 |

#### C.2.15 采集器配置常量 → **见 §B.2.4**

#### C.2.16 网格布局常量

**来源**: `src/constants/cockpit.constants.ts:1-5`

| 常量引用 | 值 | 描述 |
|---------|------|------|
| `GRID_COLUMNS` | `4` | 网格列数 |
| `GRID_ROW_HEIGHT` | `120` | 行高（像素） |
| `GRID_GAP` | `16` | 网格间距（像素） |

### C.3 数据流向

```
┌──────────────────────────────────────────────────────────────────┐
│  Widget 数据流                                                    │
│                                                                  │
│  DataSourceConfig ──→ TaskScheduler ──→ BaseCollector             │
│  (widgetId=xxx)        (register/start)    │                     │
│                                            │ fetch               │
│                                            ▼                     │
│                                     RawMarketData                 │
│                                            │                     │
│                                            ▼                     │
│                                    MarketDataAdapter              │
│                                            │                     │
│                                            ▼                     │
│                                       MarketData                  │
│                                            │                     │
│                                            ▼                     │
│                              MarketDataProvider (Context)         │
│                                   │                              │
│                      ┌────────────┼────────────┐                 │
│                      ▼            ▼            ▼                 │
│                 Widget A     Widget B     Widget C               │
│                                                                  │
│  WidgetRegistry 管理流程:                                        │
│    register(template) → createInstance(widgetId)                 │
│    → updateRuntimeState(instanceId, { status })                  │
│    → removeInstance(instanceId)                                  │
└──────────────────────────────────────────────────────────────────┘
```

**数据来源**：`WidgetRegistry.createInstance()` → `TaskScheduler.register()` → `BaseCollector.fetch()`
**数据去向**：`MarketDataProvider` → 各 Widget 组件的 `data` prop
**更新频率**：默认 5 秒轮询（`COLLECTOR_DEFAULT_CONFIG.DEFAULT_POLLING_INTERVAL`，**见 §B.2.4**），可通过 `DataSourceConfig.interval` 调整

### C.4 变更日志

| 日期 | 版本 | 变更内容 | 变更人 |
|------|------|----------|--------|
| 2026-06-26 | v1.0.0 | 初始创建，覆盖 Widget 框架全部类型定义（28 个接口）与枚举常量（16 组） | Architecture Asset Governor |
| 2026-07-06 | v1.2.0 | MarketData +2 字段（hotSectors/valuePit）；SectorHeatmapData +1 字段（fundFlow）；新增 HotSectorData/ValuePitData 接口；Widget 注册表 12→21 | Architecture Asset Governor |

---

## 整合变更记录

| 日期 | 版本 | 变更内容 | 变更人 |
|------|------|----------|--------|
| 2026-07-12 | v2.0.0 | 将 3 份同名 `DATA_DEFINITION.md`（交易持仓管理 / 数据采集 / Cockpit Widget 框架）整合为单一主数据字典。保留全部模块内容；模块 B 与 C 共享的采集类型在 §B 统一定义一次、§C 引用，消除冗余。合并后原 3 份文件移除（根文件 `git rm`、另两份 untracked 移除）。 | 架构资产治理官 |

> **维护约定**：
> - 本文件为数据字典唯一权威（SSOT）。禁止再创建裸名 `DATA_DEFINITION.md`。
> - 新增按域拆分的数据结构请使用带域前缀的命名（如 `AI_CENTER_DATA_DEFINITION.md`），并在 `docs/guides/standards/DATA_DICTIONARY_INDEX.md` 登记。
> - 修改采集相关类型请同步 §B；修改 Widget 框架类型请同步 §C；两模块共享类型以 §B 为准。
