---
title: ADR-006: 输入舱拆分为四子页面
type: reference
domain: frontend
phase: design
tier: important
status: active
maintainer: V9 Architecture Team
summary: "V9 输入舱（/input）负责数据输入与采集配置。初期设计为单一页面，但随着功能增加，单一页面承载过多功能："
tags: [frontend, input-cabin, adr, reference, component, ui]
version: v1.0.0
last_updated: 2026-07-17
code_version: 2.0.0
doc_id: V9-DOC-FRONT-001
change_log:
  - version: v1.0.0
changes: Initial version established
date: 2026-07-17
---

# ADR-006: 输入舱拆分为四子页面

> **状态**: Accepted  
> **决策日期**: 2026-06-24  
> **版本**: v1.0.0

---

## 1. 背景（Context）

V9 输入舱（`/input`）负责数据输入与采集配置。初期设计为单一页面，但随着功能增加，单一页面承载过多功能：

- 行情源配置（Tushare/Yahoo API Key）
- 采集任务管理（批量采集、定时任务）
- 数据源注册（本地 CSV 导入、自定义数据源）
- 采集监控（实时进度、失败重试）

导致页面过长、加载慢、用户难以定位功能。

### 触发条件

- 用户反馈：输入舱功能过多，每次进入需要滚动大量内容。
- 架构评审：确认输入舱需要按功能域拆分为子页面，保持每个页面聚焦单一职责。

---

## 2. 决策（Decision）

**输入舱从单一页面拆分为 4 个子页面（未来可扩展至 8 个），由 `InputApp` 分发器统一管理。**

当前 4 个子页面：
1. **录入看板**（`/input/dashboard`）：采集任务总览、快捷入口
2. **批量导入**（`/input/batch`）：CSV/Excel 批量导入、字段映射
3. **采集配置**（`/input/config`）：行情源 API Key、限流配置、定时任务
4. **采集监控**（`/input/monitor`）：实时进度、失败日志、补采操作

`InputApp` 使用 else-if 链 + `React.lazy()` 加载子页面，与 analysis/trading/output/command 舱保持一致的三级加载链。

### 决策理由

- **Why not 保持单一页面**：功能过载，加载慢，维护困难。
- **Why not 拆分为独立舱**：输入功能紧密相关，独立舱会增加导航复杂度；子页面足够。
- **Why 4 个子页面**：当前功能域可清晰分为 4 组；未来可扩展至 8 个（如本地知识库、七维配置等）。

---

## 3. 备选方案（Alternatives Considered）

| 方案 | 优点 | 缺点 | 结论 |
|------|------|------|------|
| **A. 拆分为 4 子页面**（最终选择） | 职责清晰、加载快、易维护 | 需要 App 分发器管理 | ? 采纳 |
| **B. 保持单一页面 + Tab 切换** | 实现简单 | 仍是一次性加载全部功能、URL 无法直接定位到某个 Tab | ? 否决 |
| **C. 拆分为独立舱** | 完全解耦 | 导航复杂、舱间通信成本高 | ? 否决 |

---

## 4. 后果（Consequences）

### 正面影响

- 每个子页面聚焦单一职责，加载速度提升。
- URL 可直接定位到具体功能（如 `/#/input/config` 直接进入采集配置）。
- 与 analysis/trading/output/command 舱的加载模式一致，降低认知成本。

### 负面影响 / 技术债

- `InputApp` 分发器的 else-if 链可能膨胀（从 4 分支到 8 分支）。
  - **技术债**：`../explanation/design/tech-debt.md` — 「InputApp 分发器路由表膨胀」（待评估 switch/映射表重构）。
- 子页面间共享状态需要通过 `InputStore`（Zustand）或 URL 参数传递。
  - **缓解**：已定义 `inputStore.ts` 管理跨子页面状态。

---

## 5. 实施与验证

### 实施步骤

- [x] Step 1：实现 `InputApp.tsx` 分发器（4 分支 else-if + React.lazy）
- [x] Step 2：实现 4 个子页面组件
- [x] Step 3：在 `routes.ts` 注册子路由
- [x] Step 4：实现 `inputStore.ts`（跨子页面状态）
- [ ] Step 5：扩展至 8 子页面（本地知识库、七维配置、抓取配置、采集监控）
- [ ] Step 6：评估 else-if 链重构为路由映射表

### 验证命令

```bash
npm run audit:deadcode   # 验证子页面已注册
npm run audit:layers       # 验证 InputApp 依赖合规
```

---

## 6. 关联文档

| 文档 | 路径 |
|------|------|
| 路由规格 | `../explanation/design/06-routing-specs.md` §3.2 |
| 舱室总览 | `../explanation/cabins-overview.md` §1 |
| 原始提案 | `../explanation/2026-06-24-input-cabin-subpages.md` |

---

## 7. 状态变更记录

| 日期 | 状态 | 变更人 | 备注 |
|------|------|--------|------|
| 2026-06-24 | proposed | @architect | 初始提案 |
| 2026-06-24 | accepted | 架构组 | 评审通过 |
| 2026-07-12 | accepted | docs 治理组 | 扩写为完整 ADR v1.0.0 |
