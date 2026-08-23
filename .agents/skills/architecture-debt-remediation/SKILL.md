---
skill_id: V9-SKILL-ARCH-DEBT
name: "architecture-debt-remediation"
description: "架构债务系统性治理：层违规修复、services 直连 dataLayer 迁移 DataBridge、未使用组件清理、大组件拆分（≤300 行）、Lint warnings 清理、巡检机制建立。先扫描建基线、先 P0 后 P1、分批验证。Invoke when 清理架构债务、修复 audit:* 警告、重构 services/dataLayer 耦合、拆分大组件、或清理未使用组件时。"
version: v1.0.0
last_updated: 2026-08-23
change_log:
  - version: v1.0.0
    changes: "基于 S 级 Skill 5 段式骨架模板 [_SKILL-TEMPLATE.md](.agents/skills/_SKILL-TEMPLATE.md) 物理化迁移：自用户级 ~/.trae-cn/skills/architecture-debt-remediation 归位项目单一物理源（2026-07-16 P1 架构债务治理经验沉淀）"
    date: 2026-08-23
mandatory: true
---

# 架构债务治理（Architecture Debt Remediation） — v1.0.0

> **治理原则**：① 先扫描后动手（重构前必跑审计建基线）② 先 P0 后 P1/P2（Lint+Test 全绿再进架构清理）
> ③ 分批验证（每批后跑 `tsc:prod` + `lint` + `vitest` + `audit:layers` + `build`）④ 禁止编造人员/日期 ⑤ 文档先行。

---

## 一、触发条件

- 用户要求清理架构债务、修复 `audit:*` 警告
- 重构 services/dataLayer 耦合（迁移 DataBridge）
- 拆分大组件、清理未使用组件
- **协作**：组件健康度诊断 → `component-health-check`（诊断由它做，清理执行由本技能做）；类型变更 → `type-safety-contract`。

---

## 二、前置检查：建立基线（Step 0）

```powershell
npm run audit:layers; npm run audit:hardcode; npm run audit:deadcode
npx tsx scripts/audit-component-usage.ts
npm run tsc:prod; npm run lint; npx vitest run
```

记录：`audit:layers` 警告数、`audit:hardcode` 违规数、未使用组件数、大组件列表（>300 行）、Lint warnings 总数。
**注意**：`audit:layers` 退出码 0 ≠ 无债务——warnings 与 violations 分离，过渡期警告需主动迁移计划。

---

## 三、阶段化 SOP

### Step 1 — 高优先级（安全与防腐层）

1. **修复路由守卫默认放行**：未注册模块的按钮级权限默认返回 `false`；敏感模块显式 `registerButtonPermission`；验证：路由单测 + 权限矩阵
2. **迁移 services 直连 dataLayer**：读 `audit-layer-calls-*.json`，按子域分批（每批 8 文件）——读取改 `DataBridge.query()`，写入构造 `StandardEnvelope` 经 `DataBridge.forward()`；每批跑 `audit:layers` 确认 warnings 下降

```typescript
// ❌ 旧：import { dataLayer } from '@/data/dataLayer'; await dataLayer.stocks.add(stock)
// ✅ 新：await DataBridge.forward({ action: ENVELOPE_ACTION.createStock, payload: stock })
```

### Step 2 — 中优先级（代码组织）

3. **清理未使用组件**：逐项确认——确实无用→删除；开发中→迁 `src/showcase/`；通用原子→保留并补使用场景说明。验证：`build` + `audit:deadcode`
4. **拆分大组件**：目标 ≤300 行、useEffect ≤3；容器组件管状态编排、展示组件管渲染、子组件提取到 `partials/`；拆分前画组件树明确状态归属
5. **补充 DataBridge 删除级联**：`CASCADE_MAP` 关联删除（如删 Stock 级联 orders/v6Scores/dailyQuotes）；验证：删除单测 + `audit:db-references`

### Step 3 — 低优先级（质量门槛）

6. **清理 Lint Warnings**：优先序 `no-unsafe-*` → `strict-boolean-expressions` → `no-magic-numbers` → `no-unnecessary-condition`；每批减 200-300，每批后跑完整单测（防为消警告引入运行时错误）
7. **建立巡检机制**：CI/本地双周执行审计三件套，报告归档 `scripts/docs/reports/audit/`

### 未使用组件判断清单

- [ ] `src/` 中 Grep 组件名，确认无 import
- [ ] 非 `src/showcase/` 专用、非 Storybook/文档示例
- [ ] 删除后 `npm run build` 无错误

---

## 四、陷阱与经验教训

| # | 陷阱 | 后果 | 规避 |
|---|------|-----|-----|
| 1 | 依赖记忆写架构文档 | 契约失真 | 以 `AGENTS.md`/`ARCHITECTURE.md` 现读为准 |
| 2 | Lint 多终端并发输出抖动 | 误判行号/文件 | 重定向到文件后二次确认 |
| 3 | 迁移后测试引用未同步 | 编译失败 | 路径迁移必全局 Grep（含测试） |
| 4 | 一次性改太多 | 回归难定位 | 分批（组件清理/大组件拆分均分批） |
| 5 | 测试硬编码属性数断言 | `dataLayer` 属性数变化即失败 | 用 `toHaveProperty('xxx')` 替代硬编码长度 |
| 6 | 硬编码颜色散落 | `audit:hardcode` 违规 | 迁 `CHART_PALETTE`/`COLOR_TOKENS` |
| 7 | 外部 API 数据 `x \|\| ''` 拼接 | `[object Object]` 隐式字符串化 | `typeof item.x === 'string'` 类型守卫 |
| 8 | 去抖测试等待不足 | 假失败 | 等待时间 > 去抖延迟（300ms 去抖等 400ms） |
| 9 | routeGuard 默认 false 未补白名单 | 功能不可用 | 同步 `registerButtonPermission` 调用 |
| 10 | 窄化类型断言不注释 | 可读性差 | `as string \| number ...` 附原因说明 |

---

## 五、完成交付物清单

| # | 交付物 | 验证方法 |
|---|--------|---------|
| 1 | 基线与各批次审计数字对比 | warnings 单调下降 |
| 2 | 每批次完整门禁通过 | `tsc:prod` → `lint` → `vitest` → `audit:layers` → `build` |
| 3 | TODO 清单（真实负责人/日期，禁占位符） | 按项目编号规范归档 |
| 4 | 循环依赖检查 | `npx madge --circular --extensions ts src/` |
| 5 | 巡检机制登记 | 双周执行 + 报告归档 |
