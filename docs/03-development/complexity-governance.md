# 代码复杂度治理规范

> **版本**: v1.0.0 | **日期**: 2026-07-13
> **适用范围**: 所有 `src/` 下的 TypeScript / TSX 文件
> **强制等级**: 必须遵守
> **关联文档**: [AGENTS.md](../AGENTS.md) §三

---

## 一、复杂度红线

| 指标 | 阈值 | 说明 |
|------|------|------|
| 嵌套深度 | ≤ 4 层 | if/for/try/catch/回调等层级累计 |
| 链式条件 | ≤ 3 个 `&&` / `\|\|` | 超过需拆分为命名变量或守卫函数 |
| 函数行数 | ≤ 100 行 | 不含空行和注释 |
| 单个文件行数 | ≤ 500 行 | 超过需评估拆分 |

## 二、治理策略

### 2.1 降低嵌套

```typescript
// ❌ 深层嵌套
function process(data: Data) {
  if (data) {
    if (data.items) {
      data.items.forEach((item) => {
        if (item.valid) {
          // ...
        }
      })
    }
  }
}

// ✅ 提前返回 + 卫语句
function process(data: Data) {
  if (!data || !data.items) return
  for (const item of data.items) {
    if (!item.valid) continue
    // ...
  }
}
```

### 2.2 拆分长条件

```typescript
// ❌ 长链式条件
if (user && user.role === 'admin' && user.active && !user.locked) {
  // ...
}

// ✅ 提取为命名布尔
const canAccessAdmin = user?.role === 'admin' && user?.active && !user?.locked
if (canAccessAdmin) {
  // ...
}
```

## 三、监控与门禁

```bash
# 本地扫描
npm run complexity-scan

# 预提交门禁（当前为 warn 模式）
npm run audit:complexity
```

## 四、例外处理

以下情况可申请例外：
- 纯数据映射/配置对象（如大型常量表）
- 自动生成的代码
- 经过模块分拆评估后保留的复杂函数

例外必须在代码注释中说明原因。

---

> **验证命令**: `npm run complexity-scan`
