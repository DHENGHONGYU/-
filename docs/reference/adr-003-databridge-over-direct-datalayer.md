---
title: ADR-003: DataBridge 替代直接 dataLayer 写入
type: reference
domain: data
phase: design
tier: important
status: active
maintainer: V9 Architecture Team
summary: "V9 作为纯前端智能投研系统，所有数据持久化于本地 IndexedDB。在引入 DataBridge 之前，"
tags: [data, databridge, adr, reference, data-definition, store]
version: v1.1.0
last_updated: 2026-07-17
code_version: "2.0.0-rc.1"
doc_id: V9-DOC-DATA-013
referenced_by: [V9-DOC-META-000, V9-DOC-PROD-005, V9-DOC-DATA-056, V9-DOC-PROJ-176, V9-DOC-PROJ-156, V9-DOC-ARCH-041, V9-DOC-PROJ-149, V9-DOC-ARCH-013]
change_log:
  - version: v1.1.0
    changes: "C 类版本闭环(2026-08-11)：change_log 对齐当前版本"
    date: 2026-07-17
  - version: v1.0.0
    changes: Initial version established
    date: 2026-07-17
---

# ADR-003: DataBridge 替代直接 dataLayer 写入

> **状态**: Accepted  
> **决策日期**: 2026-06-21  
> **Version**: v1.1.0（2026-07-16 增补：系统管理方法 + Store 包装层合规 + audit 升级）

---

## 1. 背景（Context）

V9 作为纯前端智能投研系统，所有数据持久化于本地 IndexedDB。在引入 DataBridge 之前，各 Service 子域直接调用 `dataLayer.save()` 或 `db.put()` 写入数据，导致以下问题：

- **来源不可追溯**：无法知道哪个模块写入了哪条数据，调试困难。
- **权限分散**：没有统一的权限控制点，任何服务可以写入任何 Store。
- **审计缺失**：无法自动生成写入审计日志，不利于合规与复盘。
- **事件通知缺失**：写入后无法自动触发跨 Tab 广播（`withBroadcast`），导致多 Tab 数据不同步。

### 触发条件

- `../explanation/design/mcp-coupling-analysis-report.md` §问题 1 指出：DataBridge 当前为 30+ case 的 switch，但至少有 5 个服务仍在绕开 DataBridge 直写 db。
- `../../AGENTS.md` §一（分层规则）明确要求：services 层禁止直写 db，须经 DataBridge。

### 相关前置决策

- ADR-001（纯前端架构）：决定了数据自管于本地 IndexedDB，需要统一的数据写入网关。
- ADR-002（IndexedDB 替代 localStorage）：确立了 IndexedDB 作为唯一持久化方案，需要规范写入接口。

---

## 2. 决策（Decision）

**选择方案 A：DataBridge + StandardEnvelope 统一写入网关。**

所有跨模块写操作必须经 `DataBridge.forward(envelope)`，由 `routeToDB()` 根据 `action` 路由到对应 Store。禁止任何 Service 直接调用 `dataLayer.save()` 或 `db.put()`。

### 决策理由

- **Why not B（直接调用 dataLayer）**：虽然减少了样板代码，但牺牲了来源追溯、权限控制、审计日志和事件广播，长期维护成本更高。
- **与 AGENTS.md 兼容性**：完全符合 §一（分层规则：services → core/data/lib）和 §八（数据库版本管理：DB_VERSION/STORE_NAME/ACL_MATRIX）。
- **与引擎规格兼容性**：L3 纯计算层（scoring/signal/risk）不受影响，它们只读数据；L4 应用层（services）负责写入，经 DataBridge 路由。

### 关键约束

1. `StandardEnvelope` 必须含 `source`（来源模块）、`target`（目标 Store）、`action`（操作类型）、`traceId`（追踪 ID）、`timestamp`（时间戳）。
2. `ENVELOPE_ACTION` 白名单：CREATE/UPDATE/DELETE/READ/BATCH/SYNC/MIGRATE。
3. `ACL_MATRIX` 校验模块-Store-操作三元组：只有白名单中的模块可以写入特定 Store。
4. 写入成功后自动触发 `EventBus.publish('store:updated', { store, traceId })`，供 `withBroadcast` 跨 Tab 广播。
5. 自动写入 `research_logs` 审计日志（Store 级别）。

### v1.1 增补：系统管理方法（2026-07-16）

DataBridge 新增 4 个一等公民方法，均经过 ACL 校验 + 审计日志：

| 方法 | 用途 | ACL 要求 |
|------|------|----------|
| `init()` | 数据库初始化（幂等） | 无（启动阶段） |
| `exportAllData(source)` | 全量数据导出 | `system` 模块 |
| `importAllData(data, source)` | 全量数据导入 | `system` 模块 |
| `resetAllData(source)` | 全量数据重置 | `system` 模块 |

**设计原则**：系统管理操作必须通过 DataBridge 统一入口，禁止 services 直接调用 `db.export()/db.import()/db.reset()`。

---

## 3. 备选方案（Alternatives Considered）

| 方案 | 优点 | 缺点 | 结论 |
|------|------|------|------|
| **A. DataBridge + Envelope**（最终选择） | 统一网关、ACL、审计、广播 | 增加少量样板代码（每个写入需构造 envelope） | ? 采纳 |
| **B. 直接调用 dataLayer** | 简单直接，无额外抽象 | 来源难追溯、权限分散、难以审计、无自动广播 | ? 否决 |
| **C. Repository 模式（每个 Store 一个 Repository）** | 更细粒度的权限控制 | 过度设计，24 个 Store 需要 24 个 Repository，维护成本高 | ? 否决 |
| **D. Middleware 拦截（在 dataLayer 层拦截）** | 对 Service 透明，不改调用方式 | 在底层拦截无法获取业务上下文（traceId、source 模块名） | ? 否决 |

---

## 4. 后果（Consequences）

### 正面影响

- 所有写入操作可审计、可追溯、可回滚。
- 跨 Tab 数据同步由 DataBridge 统一触发，无需各 Service 手动广播。
- ACL 矩阵集中管理，新增 Store 时只需更新一处配置。
- 与 AGENTS.md 分层规则一致，audit:layers 零违规。

### 负面影响 / 技术债

- 每个写入操作需构造 `StandardEnvelope`，增加 ~3 行样板代码。
- `routeToDB()` 当前为 30+ case 的 switch，随着 Store 增加可能膨胀。
  - **技术债登记**：`../explanation/design/tech-debt.md` — 「DataBridge.routeToDB() 策略模式重构」（待 ADR-010）。
- 已有 5 个服务绕开 DataBridge 直写 db，需要逐步迁移。
  - **迁移清单**：`../explanation/design/mcp-coupling-analysis-report.md` §问题 5。

### 影响范围

| 模块 | 影响 | 需修改 |
|------|------|--------|
| `src/core/DataBridge.ts` | 核心路由类，需完善 ACL 校验 | ? 已完成 |
| `src/data/db-schema.ts` | 新增 Store 须同步 ACL_MATRIX | ? 已完成 |
| `src/services/*` | 所有写操作需改为 DataBridge.forward() | ?? 部分完成（5 个服务仍直写） |
| `src/store/*` | 无需修改，只消费 EventBus 事件 | — |
| `src/pages/*` | 无需修改，只经 Store 取数 | — |

---

## 5. 实施与验证（Implementation & Validation）

### 5.1 实施步骤 checklist

- [x] Step 1：定义 `StandardEnvelope` Interface（`../../src/showcase/types.ts`）
- [x] Step 2：实现 `DataBridge.forward()` 路由方法
- [x] Step 3：定义 `ENVELOPE_ACTION` 枚举和 `ACL_MATRIX`
- [x] Step 4：在 `db-schema.ts` 中注册 `research_logs` 审计日志 Store
- [x] Step 5：迁移直写服务（audit:layers v3.4 后 0 违规/0 警告）
- [x] Step 5.1：`dataLayerHelpers` 迁移到 `databridgeQueries`（re-export 兼容层）
- [x] Step 5.2：`generateId/now` 上移到 `src/lib/utils.ts`
- [x] Step 5.3：系统管理操作（export/import/reset）纳入 DataBridge
- [x] Step 5.4：`bootstrapService` 改用 `dataBridge.init()`
- [x] Step 5.5：audit:layers 智能识别合规 Store 包装层
- [ ] Step 6：将 `routeToDB()` 的 switch 重构为策略模式（待 ADR-010）
- [ ] Step 7：补充 `DataBridge` 集成测试（覆盖率 ≥ 80%）

### 5.2 验证命令

```bash
# 类型安全
npx tsc --noEmit

# 跨层调用合规（services 不得直写 db）
npm run audit:layers

# 文档同步
npm run audit:docs
```

### 5.3 回滚条件与回滚步骤

**回滚条件**：
- DataBridge 引入后性能下降 > 20%（写入延迟从 < 50ms 增加到 > 60ms）
- 发现严重 ACL 绕过漏洞
- 超过 10 个服务因 DataBridge 引入而产生无法修复的 bug

**回滚步骤**：
1. 在 `DataBridge.ts` 中增加 `bypass` 模式（环境变量 `VITE_DATABRIDGE_BYPASS=true`）
2. 各 Service 恢复直接调用 `dataLayer.save()`
3. 移除 `StandardEnvelope` 构造，但保留 `traceId` 手动注入
4. 回滚后运行 `tsc --noEmit` + `audit:layers` 验证

---

## 6. 关联文档（Related Documents）

| 文档 | 路径 | 说明 |
|------|------|------|
| 全局架构总览 | `../explanation/overview.md` | 数据流全景（§4） |
| 引擎规格 | `./05-engine-specs.md` | L3 纯计算层职责、数据流 §4 |
| 路由规格 | `../explanation/design/06-routing-specs.md` | 三级加载链 |
| MCP 耦合分析 | `../explanation/design/mcp-coupling-analysis-report.md` | DataBridge 问题 1-5 |
| 数据层总览 | `../explanation/data-layer-overview.md` | DataBridge 路由机制、QueryBuilder |
| DataBridge 主题包 | `./project/plans/README.md` | DataBridge 相关文档聚合索引 |
| 原始提案 | `./project/2026-06-21-databridge-over-direct-datalayer.md` | ADR-003 的原始文件 |

---

## 7. 状态变更记录（Status Log）

| 日期 | 状态 | 变更人 | 备注 |
|------|------|--------|------|
| 2026-06-21 | proposed | @architect | 初始提案，基于 `./databridge-split-plan.md` |
| 2026-06-24 | accepted | 架构组 | 架构评审通过，与 AGENTS.md 分层规则无冲突 |
| 2026-07-12 | accepted | docs 治理组 | 扩写为完整 ADR（v1.0.0），补充七节内容、备选方案、技术债、回滚步骤 |
| 2026-07-16 | accepted | 架构组 | v1.1.0 增补：系统管理方法（init/exportAll/importAll/resetAll）纳入 DataBridge；audit:layers v3.4 升级；store 包装层合规判定；0 违规/0 警告达成 |

---

_本文档由 ADR 骨架（v0.9.0）扩写为完整 ADR（v1.0.0），作为 ADR 扩写标杆。_
