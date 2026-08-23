---
skill_id: V9-SKILL-COMP-HEALTH
name: "component-health-check"
description: "组件健康度审计与治理：六步法（死代码审计→注册表审计→原子层级审计→注册体检→命名冲突排查→治理建议），僵尸组件判定三条件、保留价值五要素评分（0-10 分映射 P0–P3 分级处置）、五类常见模式识别与标准报告模板。只诊断不删除。Invoke when 检查组件健康度/僵尸组件/死代码、新增组件或重构后验证注册与引用、季度清理盘点、或命名冲突排查时。"
version: v1.0.0
last_updated: 2026-08-23
change_log:
  - version: v1.0.0
    changes: "基于 S 级 Skill 5 段式骨架模板 [_SKILL-TEMPLATE.md](.agents/skills/_SKILL-TEMPLATE.md) 物理化迁移：自用户级 ~/.trae-cn/skills/component-health-check 归位项目单一物理源（死代码审计 v4.0 + 注册表审计 v1.1 经验提炼）"
    date: 2026-08-23
mandatory: false
---

# 组件健康度检查（Component Health Check） — v1.0.0

> 组件生命周期治理的诊断工具：识别僵尸组件、命名冲突、注册缺失等健康度问题，输出分级处置建议。
> **本技能只诊断和建议，不直接执行删除**——报告供用户决策，确认后再配合 `architecture-debt-remediation` 清理。

---

## 一、触发条件

| 场景 | 触发 |
|------|------|
| 检查组件健康度 / 僵尸组件 / 死代码 | 必须执行 |
| 新增组件或重构后验证注册与引用 | 建议执行 |
| 季度性代码清理前盘点 | 必须执行 |
| "这个组件有没有人用"的疑问 / 架构升级遗留排查 / 同名冲突怀疑 | 按需执行 |

**文件信号**：`src/components/**`、`src/widgets/**`、`src/store/**`。
**协同**：清理执行 → `architecture-debt-remediation`；新增组件注册同步 → `module-sync-checklist`；删除后残留验证 → `fix-verification-governance`；文档索引同步 → `cross-index-governance`。

---

## 二、前置检查

| # | 检查项 | 方法 | 通过标准 |
|---|--------|-----|---------|
| 1 | 扫描模式选择 | 新增后验证 → 增量 `audit:deadcode -- --staged`；季度盘点/重构回归 → 全量 | 模式匹配场景 |
| 2 | 动态注册豁免清单 | `widgetRegistry.ts` 动态注册、lazy 加载、Portal 条件加载、测试工具组件 | 静态扫描零引用≠僵尸 |
| 3 | 报告持久化 | `scripts/audit/docs/reports/audit/audit-dead-code-{timestamp}.json` | 基线可对比 |

---

## 三、阶段化 SOP（六步法）

### Step 1 — 死代码审计 `npm run audit:deadcode`

| 指标 | 正常值 | 异常处理 |
|---|---|---|
| `unusedComponents` | 0 或已知 wip 范围 | 超阈值逐一排查 |
| `nameCollisions` | 0 | 必须全部解决 |
| `componentRefCounts` 低引用 Top 10 | 无 P0 级僵尸 | 进 Step 2 深度分析 |
| `emptyComponents` | 0 | 直接标 P0 删除 |

### Step 2 — 注册表审计 `npm run audit:registry`

`unregistered`（磁盘有未注册）=0；`missingConsumers`（active 缺 consumers）=0；`wipComponents` ≤5（超 2 迭代未转正需重评）；`incompleteDeprecation`（缺 `supersededBy`/`removalTarget`）=0。注册表与磁盘必须**双向一致**。

### Step 3 — 原子层级审计 `npm run audit:atomic`

层级链 atoms → molecules → organisms → templates → pages，依赖只能自下而上。`crossLayerImports`=0、`misclassifiedComponents`=0、`atomMoleculeOverlap`=0。两层同名时优先保留更上层封装版本。

### Step 4 — 组件注册体检（`componentRegistry.ts` 逐项）

active 必有非空 consumers；wip 超 2 迭代（约 4 周）评估转正或删除；deprecated 必有 supersededBy + removalTarget；命名符合 PascalCase + 层级前缀（如 AtomButton / MolCardHeader）。
关键判断：有 consumers 但零引用 → 信息过时；无 consumers 且零引用 → 高概率僵尸进 Step 5。

### Step 5 — 命名冲突排查

| 冲突类型 | 处置 |
|---|---|
| 同名不同层 | 评估职责，合并到合适层级，删冗余版本 |
| 功能重叠 | 确定主版本，另一个标 deprecated |
| 拆分过度（小组件无独立复用价值） | 合并回父组件 |
| 历史遗留（旧版未删） | 标 deprecated，按移除计划删除 |

保留版本标准：复用度更高、接口更清晰、测试更完整。

### Step 6 — 生成治理建议（分级）

**僵尸判定三条件（同时满足）**：① 业务/上层零引用（排除测试）② 非动态注册 ③ 连续 2 迭代无新增引用。仅零引用不足以判定。

**保留价值五要素**（每项 0–2 分）：通用性 / 设计质量 / 配套完整度 / 业务定位 / 维护成本。
评分映射：0–2 → P0 立即删除；3–5 → P1 标 deprecated（有替代者）或 P2 观察；6–8 → P2 观察排期接入；9–10 → P3 接入计划。

**五类常见模式**：① P2 规划原子（未入 barrel 有冒烟测试）→ 在路线图入 P3，否则 P0 ② 整套半成品模块（有 store+service 无路由）→ 评估业务价值定 P0/P2/P3 ③ 架构升级遗留（Old/Legacy/V1 后缀）→ 迁移中 P1、零引用 P0 ④ 前瞻性储备（无消费方）→ 设接入期限，到期未接入删除 ⑤ 同名冲突两层各一个 → 对比定主版本或重命名区分。

---

## 四、陷阱与经验教训

| # | 陷阱 | 后果 | 规避 |
|---|------|-----|-----|
| 1 | 零引用即判僵尸 | 误删动态注册组件 | 三条件同时满足 + 动态豁免清单单独验证 |
| 2 | 诊断时直接删除 | 误删无法追责 | 只出报告，确认后由架构债务技能执行 |
| 3 | 删组件不清理配套 | 残留引用/测试僵尸 | 同步清理：barrel 导出、注册表、测试、文档引用、类型、配套 store/service |
| 4 | 迷信测试覆盖率保留组件 | 无业务引用的测试也是债务 | 以五要素为准，测试只是其中一项 |
| 5 | 重命名后不更新引用 | 编译失败 | 更新 barrel 导出和所有引用方 |

---

## 五、完成交付物清单

| # | 交付物 | 验证方法 |
|---|--------|---------|
| 1 | 组件健康度检查报告（标准模板：扫描时间/组件总数/各指标计数 + 处置建议表 + 命名冲突表 + 风险提示） | 字段齐全 |
| 2 | 每项处置含优先级 + 理由（评分依据） | P0–P3 分级明确 |
| 3 | 动态注册组件人工确认清单 | 单独验证记录 |
| 4 | 修复后回归 | `npm run audit:deadcode`（+ registry + atomic）全绿 |
| 5 | 用户决策确认留痕 | 删除动作先经确认 |

**相关文档**：组件准入政策 / 生命周期 SOP / 弃用政策 / 原子组件体系（`docs/guides/` 与 `docs/explanation/`）。
