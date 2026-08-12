---
title: 驾驶舱 Widget 集成检查清单
type: reference
domain: frontend
phase: testing
tier: standard
status: active
maintainer: V9 Architecture Team
summary: "新增或修改驾驶舱 Widget 时，必须同步完成三处注册，并遵循设计令牌与数据消费规范。"
tags: [frontend, widget, integration, checklist]
version: v1.0.0
last_updated: 2026-07-17
code_version: "2.0.0-rc.1"
doc_id: V9-DOC-FRONT-017
referenced_by: [V9-DOC-META-000, V9-DOC-PROJ-176, V9-DOC-FRONT-034]
change_log:
  - version: v1.0.0
changes: Initial version established
date: 2026-07-17
---

# 驾驶舱 Widget 集成检查清单

> 新增或修改驾驶舱 Widget 时，必须同步完成三处注册，并遵循设计令牌与数据消费规范。

> **自动化校验（推荐优先使用）**：新增/修改 Widget 后运行 `npm run audit:widget-registry`，脚本自动校验三处注册一致性（registry ? config ? dataSource）、组件文件存在性、默认布局覆盖性。P0 违规直接 exit 1，无需人工逐条对照本清单。
>
> **何时仍需人工检查**：脚本不覆盖的维度（令牌引用、四态实现、JSDoc、useEffect cleanup）仍需按下方清单逐项确认。

## Widget 组件开发

- [ ] 在 `src/cockpit/widgets/` 下创建 Widget 组件文件（命名：`XxxWidget.tsx`）
- [ ] 定义 Props Interface：`{ config: WidgetConfig; data?: MarketData }`
- [ ] 使用 `useMarketData()` 或 `MarketDataProvider` 消费数据
- [ ] 实现 `Loading / Empty / Error / Skeleton` 四态（推荐复用 `WidgetStateShell`）
- [ ] 所有颜色引用令牌：`THEME_TOKENS`、`COLOR_TOKENS`、`COLOR_SHADES`、`STOCK_COLOR_TOKENS`
- [ ] 图标尺寸使用 `THEME_TOKENS.iconSizes`
- [ ] 字体使用 `THEME_TOKENS.typography`
- [ ] `useEffect` 中有 cleanup 函数，移除事件监听/定时器
- [ ] 公共函数有 JSDoc

## 第一处注册：`widgetRegistry.ts`

文件：`src/cockpit/core/widgetRegistry.ts`

- [ ] 在 `registerDefaultWidgets()` 的 `widgets` 数组中添加 `WidgetTemplate` 对象
- [ ] `meta.id` 与 `DEFAULT_WIDGET_CONFIG` 中的 key 一致
- [ ] `meta.name` 使用 `DEFAULT_WIDGET_CONFIG.<key>.title`
- [ ] `meta.category` 使用 `DEFAULT_WIDGET_CONFIG.<key>.category`
- [ ] `meta.defaultSize` 使用 `DEFAULT_WIDGET_CONFIG.<key>.size`
- [ ] `meta.defaultDataSource` 使用 `WIDGET_DEFAULT_DATA_SOURCE.<key>`
- [ ] `component` 使用 `() => import('@/cockpit/widgets/XxxWidget')`
- [ ] 如需配置面板，添加 `configPanel` 字段
- [ ] 如需默认布局，在 `createDefaultInstances()` 的 `defaultLayout` 中添加位置

示例：

```typescript
{
  meta: {
    id: 'myWidget',
    name: DEFAULT_WIDGET_CONFIG.myWidget.title,
    category: DEFAULT_WIDGET_CONFIG.myWidget.category,
    description: '我的 Widget 描述',
    defaultSize: DEFAULT_WIDGET_CONFIG.myWidget.size,
    defaultDataSource: WIDGET_DEFAULT_DATA_SOURCE.myWidget,
  },
  component: () => import('@/cockpit/widgets/MyWidget'),
}
```

## 第二处注册：`DEFAULT_WIDGET_CONFIG`

文件：`src/constants/cockpit.constants.ts`

- [ ] 在 `DEFAULT_WIDGET_CONFIG` 对象中添加对应 key
- [ ] 配置字段包含：`title`、`category`、`size`、`icon`、`defaultConfig`（如需要）
- [ ] `size` 使用 `WIDGET_SIZE` 中的预设值（如 `WIDGET_SIZE.FULL_WIDTH`）
- [ ] `category` 使用项目约定的分类常量

示例：

```typescript
export const DEFAULT_WIDGET_CONFIG = {
  // ... 已有 Widget
  myWidget: {
    title: '我的 Widget',
    category: WIDGET_CATEGORY.MARKET,
    size: WIDGET_SIZE.FULL_WIDTH,
    icon: 'BarChart3',
    defaultConfig: {
      refreshInterval: 5000,
    },
  },
} as const
```

## 第三处注册：`WIDGET_DEFAULT_DATA_SOURCE`

文件：`src/constants/cockpit.constants.ts`

- [ ] 在 `WIDGET_DEFAULT_DATA_SOURCE` 对象中添加与 `DEFAULT_WIDGET_CONFIG` 相同的 key
- [ ] 配置数据源类型、API 端点、刷新频率、转换函数
- [ ] API 路径必须引用 `src/config/apiPaths.ts` 或 `src/config/marketDataEndpoints.ts` 中定义的常量
- [ ] 避免在数据源配置中硬编码 URL

示例：

```typescript
export const WIDGET_DEFAULT_DATA_SOURCE = {
  // ... 已有 Widget
  myWidget: {
    type: 'rest',
    endpoint: API_MARKET_OVERVIEW,
    interval: 5000,
    transformer: 'marketOverviewTransformer',
  },
} as const
```

## 类型补充

- [ ] 如新增 Widget ID 未在 `WidgetId` 联合类型中，更新 `src/types/modules/widget.types.ts`
- [ ] 如新增数据源类型，更新 `WidgetDataSource` 相关类型

## 测试与门禁

- [ ] 运行 `npx tsc --noEmit`
- [ ] 运行 `npm run audit:layers`
- [ ] 运行 `npm run lint:colors`
- [ ] 运行 `npm run test -- --run`
- [ ] 在浏览器中打开驾驶舱，确认 Widget 正常渲染
- [ ] 检查 Widget 数据加载、空态、错误态是否正常

## 文档同步

- [ ] 更新 `docs/` 中驾驶舱 Widget 列表
- [ ] 在 `CHANGELOG.md` 中记录新增 Widget
- [ ] 如 Widget 有配置项，补充使用说明

## 常见陷阱

| 陷阱 | 表现 | 排查方法 |
|------|------|----------|
| 只注册组件，未配 `DEFAULT_WIDGET_CONFIG` | Widget 标题为空或报错 | 检查 `cockpit.constants.ts` |
| 未配 `WIDGET_DEFAULT_DATA_SOURCE` | Widget 数据为空 | 检查数据源配置与 key 一致性 |
| Widget ID 拼写不一致 | TypeScript 报错或运行时异常 | 全局搜索 id/key 是否一致 |
| 硬编码 API 路径 | `audit:hardcode` 失败 | 引用 `apiPaths.ts` 常量 |
| 未处理空态/错误态 | 数据异常时页面白屏 | 接入 `WidgetStateShell` |

