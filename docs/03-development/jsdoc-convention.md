# JSDoc 编写规范

> **版本**: v1.0.0 | **日期**: 2026-07-13
> **适用范围**: 所有 `src/` 下的 TypeScript / TSX 文件
> **强制等级**: 必须遵守
> **关联文档**: [AGENTS.md](../AGENTS.md) §三

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
