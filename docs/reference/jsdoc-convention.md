---
title: jsdoc-convention
tier: important
code_version: 2.0.0
status: active
version: v1.0.0
last_updated: 2026-07-21
doc_id: V9-DOC-REF-904
---


# JSDoc 与文档门禁规范

> 版本：v1.0.0 | 日期：2026-07-10

## 1. 必须使用 JSDoc 的实体

| 实体类型 | 最小要求 | 示例位置 |
|----------|----------|----------|
| 导出函数/方法 | `@param` / `@returns` | `src/services/`, `src/lib/` |
| 导出 React 组件 | `@description` + props 说明 | `src/components/`, `src/pages/` |
| 复杂 Hook | 说明输入输出、副作用、清理要求 | `src/hooks/` |
| Store action | 说明 action 语义与触发事件 | `src/store/` |
| Service 配置 | 说明单位、默认值、约束 | `src/services/scoring/v6-engine/config.ts` |
| 公共类型/接口 | 字段说明 | `src/types/` |

## 2. JSDoc 模板

### 函数

```ts
/**
 * 一句话说明函数做什么。
 *
 * @param symbol - 股票代码（如 600519）
 * @param startDate - 起始日期 ISO 字符串
 * @returns 计算后的评分对象
 * @throws 当 symbol 为空时抛出 ValidationError
 */
export function calculateScore(symbol: string, startDate: string): ScoreResult { ... }
```

### React 组件

```tsx
/**
 * 自选股 Widget
 *
 * @description
 * 展示用户自选股的实时价格与涨跌幅。数据通过 `useMarketData()` 注入。
 *
 * @param props.config - Widget 实例配置
 */
export default function WatchlistWidget({ config }: WatchlistWidgetProps): React.JSX.Element { ... }
```

### Hook

```ts
/**
 * 订阅市场数据。
 *
 * @description
 * 在 Widget 挂载时自动请求数据，卸载时取消订阅。
 * @returns data 当前市场数据，loadingMap 加载状态，errorMap 错误信息
 */
export function useMarketData() { ... }
```

## 3. 禁止事项

- 禁止空 JSDoc 块 `/** */`
- 禁止 `@ts-ignore`，必须使用 `@ts-expect-error` 并附带原因
- 禁止参数类型与 JSDoc `@param` 类型不一致
- 禁止在私有未导出函数上写冗长 JSDoc（简单注释即可）

## 4. 文档门禁脚本

运行 `npm run audit:jsdoc` 扫描以下目录：
- `src/services/`
- `src/store/`
- `src/hooks/`
- `src/lib/`（公共导出）
- `src/components/`（导出组件）
- `src/pages/`（页面组件）

输出缺失 JSDoc 的函数/组件列表，并给出文件路径与行号。

## 5. 与 AGENTS.md 的关系

本文档是 `../../AGENTS.md` 中「日志规范」与「零硬编码」的延伸，AI 在生成代码时应按本规范补充 JSDoc。
