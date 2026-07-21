---
title: jsdoc-convention
code_version: 2.0.0

tier: important
---



# JSDoc 编写规范

> **版本**: v1.0.0 | **日期**: 2026-07-13
> **适用范围**: 所有 `src/` 下的 TypeScript / TSX 文件
> **强制等级**: 必须遵守
> **关联文档**: [AGENTS.md](../../AGENTS.md) §三

---

## 一、强制补充 JSDoc 的场景

| 场景 | 要求 |
|------|------|
| 新增公共函数 | ✅ 必须 |
| 新增 React 组件 | ✅ 必须 |
| 新增自定义 Hook | ✅ 必须 |
| 新增 Zustand Store | ✅ 必须 |
| 复杂泛型 | ✅ 必须有 `@template` 说明 |
| 私有辅助函数 | ⚠️ 推荐 |

## 二、标准格式

```typescript
/**
 * 函数一句话说明。
 *
 * 详细说明（可选）：说明业务语义、边界条件、调用时机。
 *
 * @param userId - 用户唯一标识
 * @param options - 可选配置
 * @returns 用户信息对象
 * @throws {Error} 当 userId 为空时抛出
 *
 * @example
 * ```typescript
 * const user = await getUser('u-123')
 * ```
 */
async function getUser(userId: string, options?: GetUserOptions): Promise<User> {
  // ...
}
```

## 三、标签使用规则

| 标签 | 用途 | 是否强制 |
|------|------|---------|
| `@param` | 参数说明 | 是 |
| `@returns` | 返回值说明 | 是 |
| `@throws` | 异常说明 | 推荐 |
| `@example` | 用法示例 | 推荐（公共 API） |
| `@template` | 泛型约束说明 | 复杂泛型时强制 |
| `@deprecated` | 标记废弃 | 废弃函数时强制 |

## 四、禁止事项

- ❌ 只写 `@param userId` 而无参数用途说明
- ❌ 复制函数签名作为 JSDoc 内容
- ❌ 在简单 getter/setter 上写冗余 JSDoc

---

> **验证命令**: `npm run audit:jsdoc`


<!-- merge-source: docs/reference/jsdoc-convention.md (2026-07-14 内容融合，避免去重丢失有效信息) -->
## 补充内容（合并自 `docs/reference/jsdoc-convention.md`）

# JSDoc 与文档门禁规范
## 1. 必须使用 JSDoc 的实体
| 实体类型 | 最小要求 | 示例位置 |
| 导出函数/方法 | `@param` / `@returns` | `src/services/`, `src/lib/` |
| 导出 React 组件 | `@description` + props 说明 | `src/components/`, `src/pages/` |
| 复杂 Hook | 说明输入输出、副作用、清理要求 | `src/hooks/` |
| Store action | 说明 action 语义与触发事件 | `src/store/` |
| Service 配置 | 说明单位、默认值、约束 | `src/services/scoring/v6-engine/config.ts` |
| 公共类型/接口 | 字段说明 | `src/types/` |
## 2. JSDoc 模板
 * 一句话说明函数做什么。
 * @param symbol - 股票代码（如 600519）
 * @param startDate - 起始日期 ISO 字符串
 * @returns 计算后的评分对象
 * @throws 当 symbol 为空时抛出 ValidationError
export function calculateScore(symbol: string, startDate: string): ScoreResult { ... }
 * 自选股 Widget
 * @description
 * 展示用户自选股的实时价格与涨跌幅。数据通过 `useMarketData()` 注入。
 * @param props.config - Widget 实例配置
export default function WatchlistWidget({ config }: WatchlistWidgetProps): React.JSX.Element { ... }
 * @description
 * 在 Widget 挂载时自动请求数据，卸载时取消订阅。
 * @returns data 当前市场数据，loadingMap 加载状态，errorMap 错误信息
export function useMarketData() { ... }
- 禁止空 JSDoc 块 `/** */`
- 禁止 `@ts-ignore`，必须使用 `@ts-expect-error` 并附带原因
- 禁止参数类型与 JSDoc `@param` 类型不一致
- 禁止在私有未导出函数上写冗长 JSDoc（简单注释即可）
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
