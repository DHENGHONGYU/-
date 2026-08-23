---
skill_id: V9-SKILL-MOCK-DIAG
name: "mock-data-diagnosis"
description: "Mock 数据残留三维诊断与数据校对：维度 1 数据传递链路残留（直接引用/初始值污染/默认策略污染/静默降级/持久化污染五形态）、维度 2 信息孤岛识别（平行通道/同名重复模块/声明≠实际/绕过 DataBridge 四信号）、维度 3 Mock↔真实切换兼容性风险。输出 P0/P1/P2 分级遗留清单与修复路线图。Invoke when Mock→真实环境过渡前清理审计、数据流健康度检查、假数据/信息孤岛排查、或上线前 Mock 就绪度评估时。"
version: v1.0.0
last_updated: 2026-08-23
change_log:
  - version: v1.0.0
    changes: "基于 S 级 Skill 5 段式骨架模板 [_SKILL-TEMPLATE.md](.agents/skills/_SKILL-TEMPLATE.md) 物理化迁移：自用户级 ~/.trae-cn/skills/v9-mock-data-diagnosis 归位项目单一物理源（references/ 附属资产随迁）"
    date: 2026-08-23
mandatory: false
---

# Mock 数据残留诊断与数据校对 — v1.0.0

> **核心铁律：三维互补扫描，单维度会遗漏问题。门禁全绿与 Agent 摘要不可轻信，必须 Grep 实证二次验证。**
> 两个对称失败：**假阴性**（门禁报 0 违规但 Mock 残留真实存在）与**假阳性**（摘要声称 N 处残留但 Grep 证实干净）。
> **不二次验证就交付 = 不可信。**

---

## 一、触发条件

- 项目从开发后期/测试阶段向真实环境过渡前的 Mock 清理审计
- 数据流健康度检查、信息孤岛诊断
- Mock→真实切换就绪度评估、上线前审计
- **文件信号**：`src/fixtures/**`、`src/**/*.mock.ts`、`src/**/mockData*.ts`、`src/**/__mocks__/**`

**准入**：项目存在 Mock/Fixture 机制 + 处于向真实环境过渡阶段 + 有分层架构契约（如 `AGENTS.md`）。
**协作边界**：架构契约违规扫描 → `architecture-pollution-review`；文档-代码一致性 → `doc-code-dual-proofreading`；采集链路功能测试 → `collection-pipeline-testing`（本技能只查链路有无 Mock 残留，不测采集功能）。

---

## 二、前置检查

| # | 检查项 | 方法 | 通过标准 |
|---|--------|-----|---------|
| 1 | 审计脚本盲区确认 | 先读门禁审计脚本源码，确认扫描范围 | 不被「0 violations」误导 |
| 2 | 排除规则 | 所有 Grep 排除 `\.test\.` 与 `/tests/`（只查生产代码） | 证据链干净 |
| 3 | P0 判定标准 | 是否会导致用户**无感知**看到假数据？是 → P0 | 分级基准统一 |

---

## 三、阶段化 SOP

### 维度 1：数据传递链路残留（5 形态，每条产出 file:line）

| 形态 | 扫描要点 | 严重级 |
|---|---|---|
| 1.1 直接引用残留 | 生产代码 `from.*fixtures` / `from.*__mocks__` | Store 级→P0；Service→P1；Component→P2 |
| 1.2 初始值污染 | Store 初始状态用 `MOCK_*` 常量 / `from.*\.mock` | 首屏见假配置 |
| 1.3 **默认策略污染（最危险）** | `new Mock[A-Z]` / `default.*Mock` / `Mock.*Strategy`；核对每个 Mock*Strategy 对应 Real* 是否存在且非空桩 | Real 全空桩→P0；部分空桩→P1 |
| 1.4 静默降级 | `allowMockFallback` / `USE_MOCK` / `NODE_ENV.*mock` 环境分支 | 生产失败静默切假数据、UI 无警告 |
| 1.5 持久化污染 | `generateMock` 写入 DB / `sendWriteEnvelope.*mock` | 假数据混入存储，查询真假混合 |

### 维度 2：信息孤岛识别（4 信号，标志都是"两个"）

1. **平行数据通道**：同一数据概念两套独立获取/存储（如 Context+Provider vs Store）——不互通且使用者 >10 → P0
2. **同名重复模块**：`services/` 下同名文件多份独立实现，逐份验证引用——两份都被生产引用且逻辑不同 → P0
3. **声明 ≠ 实际**：`widgetRegistry` 声明的数据源是常量占位符，运行时走完全不同通道
4. **绕过 DataBridge 直连**：Service 直接 `import` dataLayer Store / `@/data/db`，绕过 ACL + 审计日志

### 维度 3：Mock↔真实切换兼容性

- **类型不同步**：Mock 文件内联 interface vs `@/types/` 规范类型比对（结构不同 → 切真实时运行时崩溃）
- **废弃残留**：`DEPRECATED`/`已废弃`/`保留占位`/`legacy` + `TODO|FIXME|HACK.*mock`

### 修复路线图模板

- **Phase 1（P0 本周）**：移除生产代码 fixtures 引用；合并同名重复模块；关闭生产环境 `allowMockFallback`；打通平行通道为单一事实源
- **Phase 2（P1 本月）**：实现 Mock 策略对应 Real；DI Provider 移除默认 Mock；消除 DataBridge 写入旁路；Mock 生成 action 加 DEV 守卫
- **Phase 3（P2 下月）**：Mock 类型同步 `@/types/`；拓展门禁覆盖盲区；清理废弃配置

---

## 四、陷阱与经验教训

| # | 陷阱 | 后果 | 规避 |
|---|------|-----|-----|
| 1 | 被「0 violations」骗了 | 门禁盲区漏检 | 先读审计脚本源码确认范围，再 Grep 实证 |
| 2 | 只盯"有 Mock"不看"默认启用" | 最危险形态漏检 | 重点审 DI/Provider 默认策略 |
| 3 | 只扫一个维度 | 至少漏两类问题 | 三维并行互补扫描 |
| 4 | 采信 Agent 摘要数字 | 假阳性/假阴性 | Grep 实证是唯一事实源，摘要仅作线索 |
| 5 | 漏查持久化写入路径 | 假数据永久混入 | 维度 1.5 必扫 |

---

## 五、完成交付物清单

| # | 交付物 | 存在位置 | 验证方法 |
|---|--------|---------|---------|
| 1 | 三维扫描全部完成 | 诊断记录 | 每项有 file:line 证据 |
| 2 | 遗留问题清单 + P0/P1/P2 分级 | 报告内 | 分级依据明确 |
| 3 | 修复优先级路线图（Phase 1–3） | 报告内 | 每阶段动作可执行 |
| 4 | 门禁盲区警示 + 复核纠错记录 | 报告内 | 假阳性更正留痕 |
| 5 | 诊断报告 `outputs/mock-diagnosis-report-YYYY-MM-DD.html` | outputs/ | 文件存在 |
