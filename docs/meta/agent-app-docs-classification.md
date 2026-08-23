---
title: "Agent 应用 · 文档分类索引表"
domain: project
status: active
last_updated: 2026-08-22
code_version: 2.0.0-rc.2
version: v1.0.1
change_log:
  - version: v1.0.1
    changes: "基准日校对(2026-08-22)：R1取真值(P4-else 新建 v1.0.0（无任何版本信息）=v1.0.0) → R2 PATCH++(v1.0.1) / last_updated 刷新 / change_log 闭环"
    date: 2026-08-22
---

---
title: Agent 应用 · 文档分类索引表
type: meta
domain: ai
phase: planning
tier: standard
status: active
maintainer: V9 Architecture Team
summary: "场景标签：`@scene#17:\"Agent 应用\"` 生成时间：2026-07-16 文档总数：19 份> 分类口径：核心⭐/ 重要 🔶 / 参考📘 /..."
tags: [ai, agent, registry, documentation]
version: v1.0.0
last_updated: 2026-07-17
code_version: "2.0.0-rc.2"
doc_id: V9-DOC-AI-031
referenced_by: [V9-DOC-META-000, V9-DOC-PROJ-331, V9-DOC-PROJ-175]
change_log:
  - version: v1.0.0
changes: Initial version established
date: 2026-07-17
---meta
domain: ai
tier: standard
status: active
maintainer: V9 Architecture Team
tags: [ai, agent, registry, documentation]
phase: planning
version: v1.0.0
last_updated: 2026-07-17
code_version: 2.0.0
---

# Agent 应用 · 文档分类索引表
> **场景标签**：`@scene#17:"Agent 应用"`
> **生成时间**：2026-07-16
> **文档总数**：19 份
> **分类口径**：核心 ⭐ / 重要 🔶 / 参考 📘 / 备选 🟢
> **校验说明**：19 份路径已逐一核对磁盘（18 份原路径 OK，1 份原路径 prompts/component/service/store/types-prompt-template.md 不存在，已修正为实际文件 `../../prompts/types-prompt-template.md`，其 3 个同级模板 component/service/store-prompt-template.md 一并归类）

---

## 一、分类汇总
| 层级 | 数量 | 说明 |
|------|------|------|
| ⭐ 核心 | 5 | Agent 应用绕不开：定义 Agent 是什么、怎么跑、怎么管、怎么审计 |
| 🔶 重要 | 6 | 集成与治理必须参考：指导 Agent 融入系统 |
| 📘 参考 | 5 | 有帮助但非必读：深入时可查 |
| 🟢 备选 | 3 | 间接相关或已归档：特定溯源场景才有用 |
| **合计** | **19** | — |

---

## 二、分类索引表（19 份）

### ⭐ 核心（5 份）

| # | 文档名 | 路径 | 关联注册 ID | 归类理由 |
|---|--------|------|------------|----------|
| 1 | Agent Runtime 实现规格 | `docs/reference/agent-runtime-spec.md` | I-257 / SPEC | Agent 层执行引擎唯一实现规格，定义注册/调度/队列/超时核心机制 |
| 2 | AGENTS.md（AI 行为约束契约） | `./AGENTS.md` | — | 项目级顶层契约，分层规则/四步集成/MCP 权限全部在此 |
| 3 | V9 智能体全面检视报告 | ~~`docs/reference/agent-audit-report.md`~~（2026-08-23 文档合并汇总中删除，无后继） | R-128 / RPT | Agent/LLM/AI 全面审计，含 src/agents/、services/llm/、.agents/skills/ 断层分析 |
| 4 | UI 设计分布式 AGENT 执行清单 | `../archive/historical-2026-08-16/batch7/docs/explanation/ui-design-agent-execution-plan.md（已归档）` | I-68/I-69 / DESIGN | P0–P8 可并行验收的具体 Agent 任务分配 |
| 5 | 大模型服务接口契约 | `docs/reference/llm-contract.md` | I-17 / API | LLM 子域接口契约，Agent 调用大模型的协议层 |

### 重要（6 份）

| # | 文档名 | 路径 | 关联注册 ID | 归类理由 |
|---|--------|------|------------|----------|
| 6 | AI 文档入口 | `../../README.md` | — | 旧文档入口，指向 prompts/ 与 agent-runtime-spec.md |
| 7 | Service 集成指南 | `../archive/historical-2026-08-16/batch7/docs/reference/ai/service-integration-guide.md（已归档）` | — | Agent 如何与 Service 层交互 |
| 8 | Store 集成指南 | `docs/reference/prompts/store-integration-guide.md` | — | Agent 与 Zustand Store 的集成路径 |
| 9 | AI 智能体调度中心数据字典 | `docs/reference/AI_CENTER_DATA_DEFINITION.md` | C-14 / DAT | 调度/监控/诊断分析数据字典（已迁移至大写版） |
| 10 | 系统提示词模板 | `../../prompts/system-prompt-template.md` | — | AI 行为模板，强依赖 AGENTS.md |
| 11 | 类型提示词模板（含 3 同级：component/service/store-prompt-template.md） | `../../prompts/types-prompt-template.md` | — | 四步集成编码契约模板（类型优先定义） |

### 参考（5 份）

| # | 文档名 | 路径 | 关联注册 ID | 归类理由 |
|---|--------|------|------------|----------|
| 12 | AI 索引缓存（.ai-index） | `docs/meta/ai-index/.ai-index/` | C-01 / AI | AI Agent 快速加载的知识缓存（ai-memory-index.json + code-graph.json + category-index.json + README） |
| 13 | 架构说明（面向 AI 智能体） | `docs/explanation/architecture.md` | I-39 / ARC | 驾驶舱 Widget 架构，面向 AI 智能体接入 |
| 14 | 文档注册索引（Agent 条目） | `docs/meta/REGISTRY_INDEX.md` | C-01/C-14/C-63/I-257/R-128 等 | 搜索 Agent 相关条目的索引工具 |
| 15 | 模块集成基线比较报告 | docs/reports/audit/report-12-integration-baseline-comparison.md（文件不存在，已归档或移除） | R-144 / RPT | Agent 集群修复后的验证报告 |
| 16 | 模块完成度校验（含 10 个 Agent 子系统） | `../archive/historical-2026-08-16/batch7/docs/explanation/design/quality-audit-plan.md（已归档）` | R-141/R-142 / RPT | 逆向校验含 Agent 子系统 |

### 🟢 备选（3 份）

| # | 文档名 | 路径 | 关联注册 ID | 归类理由 |
|---|--------|------|------------|----------|
| 17 | MCP Server 与 Agent 功能遗漏诊断 | `docs/assets/team-handbook-html/supplementary/V9_MCP_Server与Agent功能遗漏诊断.html` | — | 历史诊断报告，HTML 格式，已过时 |
| 18 | 用户画像与使用场景 | `docs/specs/product/user-personas-and-scenarios.md` | — | 产品级场景，与 Agent 运行时无直接关联 |
| 19 | 文档治理与修复行动计划（AI Agent 集群协同） | docs/meta/prompt-execute-remediation.md（文件不存在，已归档或移除） | C-63 / DAT | Agent 集群协同治理，属治理过程文档 |

> 注：第 19 份 prompt-execute-remediation.md（文件不存在，已归档或移除）亦可作为 🔶 重要（其为 Agent 集群协同治理的执行计划），此处归 🟢 是因它描述的是"文档治理流程"而非"Agent 应用本身"，按需可上提。
---

## 三、关键发现与建议

1. **分布散**：核心文档落在 `docs/reference/`（2）、项目根（1）、`docs/explanation/`（1）、`prompts/`（1），缺统一 Agent 文档入口页。
2. **缺系统级设计文档**：现有文档聚焦"Runtime 实现规格"与"检视报告"，缺一份从业务视角描述 Agent 应用场景、协作模式、数据流的架构设计文档。
3. **`docs/reference/ai/` 已标注为旧入口**：内容陈旧（指向性入口而非实质内容），建议后续建立统一 **Agent 文档专区** 整合分散核心文档。
4. **路径修正记录**：原归类第 11 项路径 prompts/component/service/store/types-prompt-template.md 经磁盘核验不存在，实际为 4 个平级文件（types/component/service/store-prompt-template.md），已取代表性的 `../../prompts/types-prompt-template.md` 入表，其余 3 份同属 🔶 重要。
---

## 四、后续可选动作

- [ ] 在 `docs/reference/` 下新建 **Agent 应用架构设计文档**（补系统级视角缺口）
- [ ] 建立统一 **Agent 文档专区**（整合散落的核心/重要文档入口）
- [ ] 将本索引表登记进 `docs/meta/REGISTRY_INDEX.md`（新增 `scene#17` 维度或 `AGENT` 类目）
