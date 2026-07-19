---
title: 代码复杂度治理规�?
type: explanation
domain: architecture
phase: planning
tier: standard
status: active
maintainer: V9 Architecture Team
summary: "关联文档: [AGENTS.md](../../AGENTS.md) §�?"
tags: [architecture, complexity, management, standards]
version: v1.0.0
last_updated: 2026-07-17
code_version: 2.0.0
doc_id: V9-DOC-ARCH-036
referenced_by: [V9-DOC-META-000, V9-DOC-PROJ-176]
change_log:
  - version: v1.0.0
changes: Initial version established
date: 2026-07-17
---tion
domain: architecture
phase: planning
tier: standard
status: active
maintainer: V9 Architecture Team
tags: [architecture, complexity, management, standards]
version: v1.0.0
last_updated: 2026-07-17
code_version: 2.0.0
---

# 代码复杂度治理规�?
> **Version**: v1.0.0 | **日期**: 2026-07-13
> **适用范围**: 所�?`src/` 下的 TypeScript / TSX 文件
> **强制等级**: 必须遵守
> **关联文档**: [AGENTS.md](../../AGENTS.md) §�?
---

## 一、复杂度红线

| 指标 | 阈�?| 说明 |
|------|------|------|
| 嵌套深度 | �?4 �?| if/for/try/catch/回调等层级累�?|
| 链式条件 | �?3 �?`&&` / `\|\|` | 超过需拆分为命名变量或守卫函数 |
| 函数行数 | �?100 �?| 不含空行和注�?|
| 单个文件行数 | �?500 �?| 超过需评估拆分 |

## 二、治理策�?
### 2.1 降低嵌套

```typescript
// �?深层嵌套
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

// �?提前返回 + 卫语�?function process(data: Data) {
  if (!data || !data.items) return
  for (const item of data.items) {
    if (!item.valid) continue
    // ...
  }
}
```

### 2.2 拆分长条�?
```typescript
// �?长链式条�?if (user && user.role === 'admin' && user.active && !user.locked) {
  // ...
}

// �?提取为命名布�?const canAccessAdmin = user?.role === 'admin' && user?.active && !user?.locked
if (canAccessAdmin) {
  // ...
}
```

## 三、监控与门禁

```bash
# 本地扫描
npm run complexity-scan

# 预提交门禁（当前�?warn 模式�?npm run audit:complexity
```

## 四、例外处�?
以下情况可申请例外：
- 纯数据映�?配置对象（如大型常量表）
- 自动生成的代�?- 经过模块分拆评估后保留的复杂函数

例外必须在代码注释中说明原因�?
---

> **验证命令**: `npm run complexity-scan`


<!-- merge-source: docs/reference/complexity-governance.md (2026-07-14 内容融合，避免去重丢失有效信�? -->
## 补充内容（合并自 `docs/reference/complexity-governance.md`�?
# 代码复杂度专项治理规�?| 指标 | 当前基线 | 短期目标 | 中期目标 |
| 函数嵌套深度 �?4 | 104 �?| �?90 | �?60 |
| 链式条件分支 �?6 | 0 �?| �?3 | �?2 |
| 重复 if 条件 | 39 �?| �?30 | �?15 |
| 函数行数 �?100 | 待接�?| 不再新增 | 逐步拆解 |
| 圈复杂度 �?15 | 待接�?| 不再新增 | 逐步拆解 |
// �?卫语�?+ 提前返回
if (!a) return
if (!b) return
// �?长链�?if-else
if (x === 'a') {
} else if (x === 'b') {
} else if (x === 'c') {
} else if (x === 'd') {
const handlers: Record<string, () => void> = {
  a: handleA,
  b: handleB,
  c: handleC,
  d: handleD,
handlers[x]?.()
const isUp = change > 0
if (isUp) { ... }
if (change > 0) { ... }
// �?提取常量/函数
const isUp = change > 0
if (isUp) { ... }
if (isUp) { ... }
运行 `npm run audit:complexity`（即 `npm run complexity-scan`）扫描：
- 嵌套深度 �?4 的代码块
- 链式 if/else if 分支 �?6 的语�?- 同一函数内重复出现的 if 条件
- 函数行数 �?100（v1.2 规划中）
- 圈复杂度 �?15（v1.2 规划中）
输出结果�?`.complexity-baseline.json` 与命令行报告�?1. 扫描得到优先级列表（按影响范围排序）
2. 每次重构一个函数，运行 `npm run test` �?`npm run audit:layers`
3. 提取可复用函数到 `src/lib/` �?`src/services/` �?helpers
4. 更新 JSDoc 与单元测�?5. 重新扫描确认指标下降
新增代码必须满足�?- 不新增深�?�?4 的嵌�?- 不新�?�?6 分支的链式条�?- 不新增重�?if 条件
`audit:complexity` 作为 CI 检查项，与 `.complexity-baseline.json` 对比，只统计新增违规（债务只减不增）�?