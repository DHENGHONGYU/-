---
title: V9 项目经验教训 — 团队分享摘要版
type: reports
domain: project
phase: retrospective
tier: standard
status: active
maintainer: V9 Architecture Team
summary: "完整版见 [`./lessons-learned.md`](./lessons-learned.md)"
tags: [project, spec, report]
version: v1.0.0
last_updated: 2026-07-17
code_version: 2.0.0
change_log:
  - version: v1.0.0
changes: Initial version established
date: 2026-07-17
---

# V9 项目经验教训 — 团队分享摘要版

> **Version**: v1.0.0 | **日期**: 2026-07-13 | **阅读时长**: 5 分钟
> 完整版见 [`./lessons-learned.md`](./lessons-learned.md)

---

## 执行摘要

V9 项目经过 12 份审计报告的系统排查，累计沉淀 **26 条结构化教训**（P0 9 条 / P1 11 条 / P2 6 条）。核心发现：**配置与文件不同步、框架与业务脱节、防御性代码缺失** 是三大 P0 根因。**文档滞后、验证流程缺失与目录/分层归属混乱** 是 P1 主因。本文档提取 Top 10 教训供团队快速回顾。

---

## Top 10 教训速览

| # | 教训 | 严重级 | 来源 | 一句话总结 |
|---|------|-------|------|----------|
| 1 | **"配置恢复" ≠ "功能恢复"** | ?? P0 | MCP 治理复盘 | 6 个 MCP Server 注册表中 `enabled=true` 但源码文件完全缺失，导致 Agent 编排调用失败。 |
| 2 | **注册时静默失败** | ?? P0 | MCP 治理复盘 | `module not found` 仅打印日志不抛异常，6 个 Server 缺失被淹没在启动日志中，从未触发告警。 |
| 3 | **Agent 运行时与业务脱节** | ?? P0 | Agent 审计报告 | 5 个已注册 Agent 的 `runAgent()` 全是占位符，所有 AI 功能直接调用 LLM，完全绕过 Agent 框架。 |
| 4 | **Engine 双实例** | ?? P0 | Agent 审计报告 | Engine 层独立 `new AgentRuntime()`，与全局单例不是同一对象，注册信息和任务互相不可见。 |
| 5 | **业务参数硬编码** | ?? P0 | 代码质量审计 | 1,913 个 magic numbers，评分引擎配置化率仅 13%，交易服务 27%，阈值/权重/公式参数全部写死。 |
| 6 | **core/databridge 未捕获 Promise** | ?? P0 | 代码质量审计 | 59 处未捕获 Promise Rejection 可能导致进程崩溃；交易逻辑 34 处、分析结果 28 处静默失败。 |
| 7 | **React Router v7 行为变更** | ?? P0 | 输出舱排查 | 嵌套 `<Routes>` 绝对路径在 v7 中不再匹配，导致输出舱/输入舱主内容区完全空白，误诊为路由缺失。 |
| 8 | **应用层跨层调用 L6** | ?? P0 | 代码质量看板 | `InputDashboard`/`DataTestPanel`/`MarketDataProvider` 直接调用 `fetcherService`/`llmClient`，违反六层架构。 |
| 9 | **RBAC 文档断层** | ?? P1 | 文档双向一致性 | v24 引入完整 RBAC 权限系统（6 表+7 动作），但 `../../explanation/03-architecture-standards.md` 和 `../../reference/data-definition.md` 完全无记录。 |
| 10 | **静态分析误导诊断** | ?? P1 | 输出舱排查 | 仅通过代码扫描误诊为"路由未注册"，实际根因需运行时证据（`main.innerHTML=0` + lazy chunk 未请求）定位。 |

---

## 教训详情（一句话总结）

### ?? P0 — 阻断级（需立即修复或已修复）

1. **"配置恢复" ≠ "功能恢复"**：恢复操作只恢复了 Registry 配置，未恢复 server 源码，导致 6 个 Server 名不副实。任何恢复必须验证文件存在性。
2. **注册时静默失败**：`logger.error + return null` 的设计让 6 条关键错误被忽略。失败必须抛异常或触发告警，不能静默跳过。
3. **Agent 运行时与业务脱节**：框架搭好了，业务代码没接入。5 个 Agent 全是空壳，AI 功能直接调用 LLM，Agent 系统形同虚设。
4. **Engine 双实例**：Engine 层自己 `new` 了一个 AgentRuntime，全局单例白建了。两个实例的状态互不可见，任务调度混乱。
5. **业务参数硬编码**：1,913 个 magic numbers，评分引擎 13% 配置化率。阈值改一次要翻 187 个文件，无法动态调整策略。
6. **core/databridge 未捕获 Promise**：59 处未处理 rejection，Node 15+ 会直接崩溃。这是最高稳定性风险，必须加 `.catch()`。
7. **React Router v7 行为变更**：升级 v7 后嵌套 Routes 的绝对路径匹配失效，导致两个舱室白屏。第三方库升级必须做路由兼容性测试。
8. **应用层跨层调用 L6**：L4 直接 import L6 的 fetcher/llm，绕过 L3 代理层。架构隔离被破坏，耦合度急剧上升。

### ?? P1 — 严重级（需决策或流程改进）

9. **RBAC 文档断层**：代码已实现完整的权限系统，但核心文档里找不到。新人入职看文档根本不知道有 RBAC。文档必须纳入功能交付的 DoD。
10. **静态分析误导诊断**：看代码以为是路由没注册，运行时才发现是 Router 版本 bug。复杂问题必须「假设 → 证伪 → 证据 → 修复」的科学流程。
11. **v6-engine 类型不安全**：134 处 `as` 处理 LLM 响应，运行时类型错误风险极高。外部输入必须用 `zod` 验证，禁止用 `as` 蒙混过关。
12. **Agent 初始化不在 bootstrap**：Agent 系统通过模块副作用自动启动，不在 `bootstrapService` 控制链中。初始化顺序不可控，可能依赖未就绪就启动。
13. **诊断前提未验证**：先假设"Server 已恢复"再做验证，结果全部推翻。任何评估必须先建事实基线，再下判断。
14. **审计工具误报阻塞**：59 处 `?? 0` / `?? ''` 防御性默认值被误判为硬编码，门禁 `FAIL`。工具规则必须区分「业务硬编码」和「防御性兜底」。
15. **语义重复与目录错位会绕过静态审计**（教训 25）：`src/services/fetcher/` 与 `src/services/input/` 长期并存 input 域服务，`audit:layers`/`audit:deadcode` 均报告 0 违规。领域目录归位必须作为独立检查项纳入重构 SOP。
16. **Store 层直接依赖 data/ 是隐蔽的跨层违规**（教训 26）：`customAgentStore.ts` 和 `watchlistStore.ts` 直接调用 `dataLayer`，违反 `../../../AGENTS.md`「`store/` 只能依赖 `services/` 和 `core/`」。审计脚本需将 Store→data 导入纳入检测规则。

### ?? P2 — 中等级（可维护性与知识管理）

17. **文档数字滞后**：AGENTS.md 写 20 个子域（实际 21），47 个 Store（实际 49）。手动维护数字永远跟不上代码变更，应引用脚本生成。
18. **组件状态未上提 Store**：大量组件 10+ 个 `useState`，状态分散不可复用。`outputStore`/`commandStore` 已建好但组件没接入。严格执行「四步集成：类型→Store→Service→UI」。
19. **SKILL 与代码差距**：V6 方法论定义了九层分析框架，代码里大部分是占位符。7 个关键模块完全没实现。方法论和代码必须同步交付。
20. **测试覆盖盲区**：测试用例基于文件存在性生成，缺失的 Server 永远不被测试。测试必须基于 Registry 配置生成，而非文件扫描。
21. **Store 持久化缺失**：`backtestStore` 只存当前结果，没有历史查询。设计时必须考虑数据生命周期（临时→持久→归档）。
22. **MCP 参数复杂度未评估**：`backtest` 需要 8 个参数，不适合 MCP 工具调用。新增 Tool 前必须评估参数数量（建议 ≤ 5）和复杂度。

---

## 预防措施清单（按执行频率）

### 每次提交前（开发者自检，5 分钟）

```markdown
□ 运行 `npm run audit:layers` → 0 violations
□ 运行 `npx tsc --noEmit` → 0 errors
□ 运行 `npm run audit:hardcode` → 确认非误报
□ 新增文件已同步注册（Registry/Store/Config/Routes）
□ 新增配置字段有对应的消费逻辑
```

### ?? 每次 PR 合并前（代码评审，10 分钟）

```markdown
□ 新增 MCP Server：通过 9 项检查清单（文件/注册/类名/接口/参数/启动/测试/文档/依赖）
□ 新增 Agent：有真实 handler，非 `return { success: true, data: {} }` 占位符
□ 新增功能：AGENTS.md / architecture.md / data-definition.md 至少更新一份
□ 新增业务参数：已迁移到 `src/config/` 配置层，非硬编码
□ 新增测试：单元测试覆盖 + 关键路径 e2e 覆盖
```

### 每次版本发布前（发布审计，30 分钟）

```markdown
□ 文件存在性 vs 配置注册一致性（Glob 扫描）
□ 文档-代码双向一致性（`doc-code-consistency.cjs`）
□ 全量测试通过（单元 + e2e）
□ 质量门禁全通过（audit:layers/contract/routes/hardcode）
□ Router 版本兼容性（关键路由导航测试）
□ SKILL 方法论与代码权重表对齐
```

---

## 关键改进指标（整改前后对比）

| 指标 | 整改前 | 整改后 | 改善 |
|------|--------|--------|------|
| tsc 非测试错误 | 562 | 0 | ? 清零 |
| ESLint 问题 | 2,792 | 1 | ? 清零 |
| audit:layers 违规 | 3 | 0 | ? 清零 |
| 输出舱 e2e 测试 | 0 | 20 | ? 新增 |
| audit:routes CI 检查 | 无 | 有 | ? 新增 |
| MCP Server 缺失 | 6 | 0 | ? 已识别（待清理或补全） |
| Agent 双实例 | 有 | 已合并 | ? 已修复 |
| 硬编码阈值（v6-engine） | 18 处 | 0 | ? 已迁移到配置层 |

---

> **分享建议**：将本摘要作为新项目/新成员 Onboarding 的必读材料，每次审计后由架构组更新。
> **反馈渠道**：如有新教训或已有教训的更新，提交至 `./lessons-learned.md` 完整版。
