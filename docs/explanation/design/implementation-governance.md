---
title: 实施治理与架构决策记�?
type: explanation
domain: project
phase: design
tier: standard
status: active
maintainer: V9 Architecture Team
summary: "本文档定�?V9 项目实施治理规则、架构决策记录（ADR）模板、文档版本比对机制与审计基线维护流程�?..."
tags: [project, governance, architecture, implementation]
version: v1.0.0
last_updated: 2026-07-17
code_version: 2.0.0
change_log:
  - version: v1.0.0
changes: Initial version established
date: 2026-07-17
---tion
domain: project
phase: design
tier: standard
status: active
maintainer: V9 Architecture Team
tags: [project, governance, architecture, implementation]
version: v1.0.0
last_updated: 2026-07-17
code_version: 2.0.0
---

# 实施治理与架构决策记�?
> **Status**: Current  
> **Version**: v0.9.0-migration-implemented  
> **Last Updated**: 2026-06-24
>
> 本文档定�?V9 项目实施治理规则、架构决策记录（ADR）模板、文档版本比对机制与审计基线维护流程�? 
> 目标读者：项目负责人、核心开发者、架构师�?
---

## 1. 治理目标

1. **文档即代码契�?*：任何架�?功能/路由/数据协议变更必须先更新文档，再修改代码�?2. **可追�?*：每个重要决策保�?ADR，记录背景、选项、利弊与最终选择�?3. **可量�?*：质量审计基线随版本发布更新，禁止用目标值替代当前值�?4. **可删除�?*：研究体系不依赖交易层；输入舱不依赖分析/交易舱即可独立完成录入与管理�?
---

## 2. 架构决策记录（ADR�?
### 2.1 何时�?ADR

- 引入新的架构分层、模块、数�?store�?- 变更调用方向、数据协议、路由结构�?- 引入新的外部依赖或数据服务（�?AKShare、LLM）�?- 变更主题/设计令牌/布局范式�?
### 2.2 ADR 模板

每个 ADR 存放�?`docs/implementation/adr/YYYY-MM-DD-title.md`�?
```markdown
# ADR-XXX: 标题

- 状态：提议 / 已接�?/ 已废�?/ 已替�?- 日期：YYYY-MM-DD
- 决策人：@

## 背景

## 选项

| 选项 | 优点 | 缺点 |
|------|------|------|
| A | ... | ... |
| B | ... | ... |

## 决策

## 后果

## 相关文档
```

### 2.3 已归�?ADR

| 编号 | 标题 | 状�?| 日期[^1] |
|------|------|------|------|
| ADR-001 | 纯前端无后端架构 | 已接�?| 2026-06-24 |
| ADR-002 | IndexedDB 替代 localStorage | 已接�?| 2026-06-24 |
| ADR-003 | DataBridge 替代直接 dataLayer 写入 | 已接�?| 2026-06-24 |
| ADR-004 | React Router HashRouter | 已接�?| 2026-06-24 |
| ADR-005 | PortalShell 深色 Kimi 经典布局 | 已接�?| 2026-06-24 |
| ADR-006 | 输入舱拆分为四子页面 | 已接�?| 2026-06-24 |
| ADR-007 | 补齐筛选引擎、信号持久化与复盘引�?| 已接�?| 2026-06-24 |
| ADR-008 | 采用 v6-pro-cockpit "第四次工业革命稀缺核心资�? 交易策略 | 已接�?| 2026-06-24 |
| ADR-009 | 引入热门板块与价值洼地双策略体系 | 已接�?| 2026-06-27 |

[^1]: 表中「日期」为**架构决策接受日期**。Batch-2 审查�?8 �?ADR 均于 2026-06-24 被接受；ADR 文件名前缀 `YYYY-MM-DD` 为各自首次起�?讨论日期，可能与接受日期不同�?
#### 编号↔文件名对照�?
| 编号 | 文件�?|
|------|--------|
| ADR-001 | 2026-06-20-pure-frontend-architecture.md |
| ADR-002 | 2026-06-20-indexeddb-over-localstorage.md |
| ADR-003 | 2026-06-21-databridge-over-direct-datalayer.md |
| ADR-004 | 2026-06-21-hashrouter-for-static-hosting.md |
| ADR-005 | 2026-06-23-portalshell-dark-kimi-layout.md |
| ADR-006 | 2026-06-24-input-cabin-subpages.md |
| ADR-007 | 2026-06-24-pool-screening-signal-persistence-review-engine.md |
| ADR-008 | 2026-06-24-adopt-v6-core-resource-trading-strategy.md |
| ADR-009 | 2026-06-27-dual-strategy-system.md |

---

## 3. 文档版本比对机制

### 3.1 版本标识

- 规划基线：`v{semver}-docs-base`
- 校对更新版：`v{semver}-docs-review`
- 每次发布前，所�?`docs/` 根目录规格文档应同步�?`v{next}-docs-review`�?
### 3.2 版本比对文档

- 全局比对：`../../reference/architecture-version-comparison.md`
- 单项文档末尾应包含「版本比对」小节，引用全局比对文档并列出本文件主要变化�?
### 3.3 比对内容

| 维度 | 需记录�?|
|------|----------|
| 架构分层 | 目录映射变化、新�?删除模块 |
| 调用方向 | 新增/解除的调用限�?|
| 数据协议 | 新增 store、字段、信�?action、事件名 |
| 路由映射 | 新增/删除/拆分路由，组件与服务映射 |
| UI/UX | 主题、布局、组件库变化 |
| 质量门禁 | 测试数量、审计基线、覆盖率阈�?|
| 功能规格 | 新增/变更用户故事与验收标�?|

---

## 4. 审计基线维护

### 4.1 基线来源

| 审计�?| 脚本 | 更新时机 |
|--------|------|----------|
| 跨层调用 | `scripts/audit-layer-calls.ts` | 每次发布�?|
| 硬编�?| `scripts/audit-hardcode.ts` | 每次发布�?|
| 死代�?空壳 | `scripts/audit-dead-code.ts` | 每次发布�?|
| 路由一致�?| `audit-dead-code.ts` 路由校验 | 每次路由变更�?|

### 4.2 基线更新流程

1. 运行 `npm run audit`�?2. 将结果填�?`../../reference/09-quality-gates.md` �?7 节「当前扫描基线」�?3. 若基线恶化，需�?PR 中说明原因与回滚计划�?4. 发布版本时，将基线数据同步到 `../../../CHANGELOG.md`�?
### 4.3 基线收敛目标

| 审计�?| v1.0.0 目标 |
|--------|-------------|
| 跨层调用违规 | 0 |
| 硬编码魔法数字（引擎层） | 0 |
| 硬编�?Tailwind 颜色（UI 层） | 0 |
| 死代码提�?| 0 |
| 路由-文件漂移 | 0 |

---

## 5. 代码-文档同步规则

1. **先文档后代码**：新增模�?路由/字段前，先在对应 `docs/` 文档中描述�?2. **PR 检查清�?*：每�?PR 必须勾选：
   - [ ] 相关 `docs/` 已更新�?   - [ ] `../../../CHANGELOG.md` 已更新（如用户可见）�?   - [ ] 路由变更已同步到 `../../reference/06-routing-specs.md`�?   - [ ] schema 变更已同步到 `../../reference/03-architecture-standards.md`�?   - [ ] 新增用户故事已同步到 `../../reference/02-functional-specs.md`�?3. **文档漂移扫描**：`audit-dead-code.ts` 未来将增加「路由注册表 vs 文件存在性」校验�?
---

## 6. 当前治理状�?
| 治理�?| 状�?| 备注 |
|--------|------|------|
| ADR 目录 | �?| 已建�?`docs/implementation/adr/`，共 8 �?ADR |
| 文档版本比对 | �?| 已建�?`../architecture-version-comparison.md` |
| 质量审计基线 | �?| 当前 0 跨层违规，硬编码/死代码基线已记录 |
| 代码-文档同步规则 | �?| 已写入本文档 |
| CI 强制执行 | 🔴 | 待建�?`.github/workflows/ci.yml` |

---

## 7. 版本比对

| 版本 | 时间 | 变化 |
|------|------|------|
| v0.9.0-docs-base | 2026-06-24 �?| 缺少统一 ADR 模板、版本比对机制、审计基线维护流�?|
| v0.9.0-docs-review | 2026-06-24 | 新增本文档，建立 ADR、版本比对、审计基线、代�?文档同步规则 |
| v0.9.0-migration-implemented | 2026-06-24 | 统一版本号；�?ADR 列表中补充「日期」字段说明（接受日期 vs 文件起草日期�?|
