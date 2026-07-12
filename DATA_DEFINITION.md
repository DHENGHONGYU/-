# DATA_DEFINITION.md — 交易持仓管理模块

> 生成日期：2026-06-26  
> 模块范围：`src/pages/trading/` · `src/types/modules/trade.types.ts` · `src/constants/trade.constants.ts` · `src/services/trade/`

---

## 一、TypeScript 接口定义

### 1.1 HoldingItem — 持仓明细项

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
| `strategyType` | `StrategyType` | 是 | `CORE` / `HOT` / `VALUE` | 策略类型（见 §2.2） |

### 1.2 HoldingsQueryParams — 持仓列表查询参数

| 字段 | 类型 | 必填 | 枚举/范围 | 描述 |
|------|------|------|-----------|------|
| `page` | `number` | 是 | ≥ 1 | 当前页码 |
| `pageSize` | `number` | 是 | 10 / 20 / 50 | 每页条数 |
| `startDate` | `string` | 是 | ISO 日期 `YYYY-MM-DD` | 开始日期 |
| `endDate` | `string` | 是 | ISO 日期 `YYYY-MM-DD` | 结束日期 |
| `direction` | `TradeDirection` | 是 | `BUY` / `SELL` / `ALL` | 交易方向（见 §2.1） |
| `keyword` | `string` | 否 | 任意文本 | 搜索关键词（代码/名称模糊匹配） |

### 1.3 HoldingsListData — API 响应数据

| 字段 | 类型 | 必填 | 描述 |
|------|------|------|------|
| `total` | `number` | 是 | 总条数 |
| `list` | `HoldingItem[]` | 是 | 持仓列表 |

### 1.4 HoldingsApiResponse\<T\> — 统一 API 响应包装

| 字段 | 类型 | 必填 | 描述 |
|------|------|------|------|
| `code` | `number` | 是 | 状态码（200 = 成功） |
| `data` | `T` | 是 | 响应数据 |
| `message` | `string` | 否 | 错误信息 |

### 1.5 TradeActionRequest — 交易操作请求参数

| 字段 | 类型 | 必填 | 枚举/范围 | 描述 |
|------|------|------|-----------|------|
| `code` | `string` | 是 | 6 位数字字符串 | 证券代码 |
| `action` | `HoldingAction` | 是 | `ADD_POSITION` / `CLOSE_POSITION` | 操作类型（见 §2.3） |
| `quantity` | `number` | 是 | ≥ 100，整数 | 操作数量（股） |

### 1.6 TradeActionResponse — 交易操作响应

| 字段 | 类型 | 必填 | 描述 |
|------|------|------|------|
| `code` | `number` | 是 | 状态码 |
| `success` | `boolean` | 是 | 是否成功 |
| `message` | `string` | 是 | 提示信息 |

### 1.7 PaginationState — 分页状态

| 字段 | 类型 | 必填 | 描述 |
|------|------|------|------|
| `page` | `number` | 是 | 当前页码 |
| `pageSize` | `number` | 是 | 每页条数 |
| `total` | `number` | 是 | 总条数 |

### 1.8 FilterState — 筛选条件

| 字段 | 类型 | 必填 | 枚举/范围 | 描述 |
|------|------|------|-----------|------|
| `startDate` | `string` | 是 | ISO 日期 | 开始日期 |
| `endDate` | `string` | 是 | ISO 日期 | 结束日期 |
| `direction` | `TradeDirection` | 是 | `BUY` / `SELL` / `ALL` | 交易方向 |
| `keyword` | `string` | 是 | 任意文本 | 搜索关键词 |

### 1.9 HoldingsLoadingState — 加载状态

| 字段 | 类型 | 必填 | 描述 |
|------|------|------|------|
| `isListLoading` | `boolean` | 是 | 列表数据是否加载中 |
| `isActionLoading` | `boolean` | 是 | 操作是否执行中 |
| `isExporting` | `boolean` | 是 | 导出是否进行中 |

### 1.10 TradeModalState — 交易弹窗状态

| 字段 | 类型 | 必填 | 描述 |
|------|------|------|------|
| `open` | `boolean` | 是 | 是否打开 |
| `action` | `HoldingAction \| null` | 是 | 操作类型 |
| `holding` | `HoldingItem \| null` | 是 | 目标持仓项 |

---

## 二、枚举与常量映射

### 2.1 TRADE_DIRECTION — 交易方向枚举

| 枚举值 | 键名 | 显示标签 | 说明 |
|--------|------|----------|------|
| `'BUY'` | `TRADE_DIRECTION.BUY` | 买入 | 买入方向 |
| `'SELL'` | `TRADE_DIRECTION.SELL` | 卖出 | 卖出方向 |
| `'ALL'` | `TRADE_DIRECTION.ALL` | 全部 | 全部方向（筛选默认值） |

**TypeScript 类型**：`TradeDirection`

### 2.2 STRATEGY_TYPE — 策略类型枚举

| 枚举值 | 键名 | 显示标签 | 背景色 | 文字色 | 边框色 |
|--------|------|----------|--------|--------|--------|
| `'CORE'` | `STRATEGY_TYPE.CORE` | 核心仓 | `bg-blue-50` | `text-blue-700` | `border-blue-200` |
| `'HOT'` | `STRATEGY_TYPE.HOT` | 热点短线 | `bg-amber-50` | `text-amber-700` | `border-amber-200` |
| `'VALUE'` | `STRATEGY_TYPE.VALUE` | 价值洼地 | `bg-emerald-50` | `text-emerald-700` | `border-emerald-200` |

**TypeScript 类型**：`StrategyType`

### 2.3 HOLDING_ACTION — 持仓操作枚举

| 枚举值 | 键名 | 显示标签 |
|--------|------|----------|
| `'ADD_POSITION'` | `HOLDING_ACTION.ADD_POSITION` | 补仓 |
| `'CLOSE_POSITION'` | `HOLDING_ACTION.CLOSE_POSITION` | 平仓 |

**TypeScript 类型**：`HoldingAction`

### 2.4 PNL_COLORS — A 股涨跌颜色映射

| 状态 | HEX 值 | Tailwind 文字类 | Tailwind 背景类 | 说明 |
|------|--------|-----------------|-----------------|------|
| 上涨（> 0） | `#ef4444` | `text-red-500` | `bg-red-50` | 红色（A 股红涨） |
| 下跌（< 0） | `#22c55e` | `text-green-500` | `bg-green-50` | 绿色（A 股绿跌） |
| 中性（= 0） | `#6b7280` | `text-gray-500` | `bg-gray-50` | 灰色（平盘） |

**工具函数**：
- `getPnlColorClass(value)` → 返回 Tailwind 文字颜色类名
- `getPnlBgClass(value)` → 返回 Tailwind 背景颜色类名
- `getPnlColor(value)` → 返回 HEX 颜色值

### 2.5 PAGINATION_DEFAULTS — 分页配置

| 常量 | 值 | 说明 |
|------|-----|------|
| `DEFAULT_PAGE` | `1` | 默认页码 |
| `DEFAULT_PAGE_SIZE` | `10` | 默认每页条数 |
| `PAGE_SIZE_OPTIONS` | `[10, 20, 50]` | 可选每页条数 |
| `PAGINATION_MAX_VISIBLE` | `5` | 最大显示页码数 |

### 2.6 HOLDINGS_API — API 端点

| 端点 | 方法 | 路径 | 说明 |
|------|------|------|------|
| `LIST` | GET | `/api/v1/trade/holdings` | 获取持仓列表 |
| `ADD_POSITION` | POST | `/api/v1/trade/add-position` | 补仓操作 |
| `CLOSE_POSITION` | POST | `/api/v1/trade/close-position` | 平仓操作 |
| `EXPORT` | GET | `/api/v1/trade/holdings/export` | 导出 Excel |

### 2.7 HOLDINGS_REQUEST_CONFIG — 请求配置

| 常量 | 值 | 说明 |
|------|-----|------|
| `TIMEOUT` | `15000` | 请求超时时间（毫秒） |
| `MAX_RETRIES` | `2` | 最大重试次数 |
| `RETRY_DELAY` | `1000` | 重试间隔（毫秒） |

### 2.8 表格列宽配置

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

---

## 三、API 契约

### 3.1 GET /api/v1/trade/holdings

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

### 3.2 POST /api/v1/trade/add-position

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

### 3.3 POST /api/v1/trade/close-position

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

---

## 四、组件架构

### 4.1 组件树

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

### 4.2 数据流

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

---

## 五、问题诊断记录

### Issue 1：未使用的导入

- **文件**：`src/hooks/useDataCollection.ts`
- **根因**：导入了 `getLogger` 和声明了 `logger` 变量但未使用
- **修复**：移除 `import { getLogger } from '@/lib/logger'` 和 `const logger = getLogger()`
- **状态**：✅ 已修复

### Issue 2：内联样式语法错误

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

### Issue 3：版本冲突处理缺少错误处理

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

---

## 六、文件清单

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