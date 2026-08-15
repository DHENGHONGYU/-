---
title: "MCP Server CLI Skill 策略"
type: strategy
domain: architecture
phase: development
tier: reference
status: active
maintainer: V9 Architecture Team
summary: "MCP 服务器以 CLI 能力对外暴露、并按技能路由表映射到 AI Skill/Agent 的策略文档。本文档在 2026-07-21 编码损坏事件中正文丢失，于 2026-07-21 依据 src/mcp/ 实际结构与 AGENTS.md 技能路由体系重建为基线版本。"
tags: [mcp, cli, skill, ai, architecture, workflow]
version: v1.1.0
last_updated: 2026-07-21
code_version: "2.0.0-rc.1"
doc_id: V9-DOC-ARCH-058
change_log:
  - version: v1.0.0
    changes: 编码损坏事件后重建 frontmatter 骨架（正文待 P3 重写）
    date: 2026-07-19
  - version: v1.1.0
    changes: 依据 src/mcp/ 实际结构与技能路由体系重建正文基线；状态由"待重写"转为"已重建基线"
    date: 2026-07-21
---

# MCP Server CLI Skill 策略

> **重建说明**：本文档在 2026-07-21 编码损坏事件（提交 `5d54a80`）中正文被整体替换为问号，git 历史与 `_ref-20260715` 备份均无干净版本。本版依据 `src/mcp/` 实际目录结构与 `AGENTS.md` 技能路由表（v1.5.3–v1.5.5）重建为**策略基线**，定义 MCP 服务器如何以 CLI 能力对外暴露、并映射到 AI Skill/Agent。

## 一、背景与目标

V9 通过 `src/mcp/` 提供一组 MCP（Model Context Protocol）服务器，将分析、回测、数据采集、选股等能力以标准化协议暴露给 AI 客户端。随着技能路由体系（v1.5.3 起）成熟，需要将 **MCP 服务器能力** 与 **AI Skill/Agent** 建立稳定的映射，使 CLI/对话入口能按触发规则把请求路由到正确的 MCP 子服务器与技能实现。

目标：

1. **能力可发现**：每个 MCP 子服务器声明其能力清单，CLI 与路由表可枚举。
2. **路由可审计**：MCP 能力 → Skill → 门禁（gates）的映射单一事实源，变更可回溯。
3. **安全边界**：MCP 服务器仅可依赖 `core/`/`data/`/`lib/`/`services/`，禁止越界调用 `pages`/`components`。

## 二、MCP 层结构（实际）

`src/mcp/` 当前结构（可核实）：

- `index.ts` — MCP 服务入口与聚合。
- `register.ts` — 子服务器注册表（能力声明与生命周期登记）。
- `core/` — 运行时核心（协议适配、会话、权限）。
- `bridge/` — 与内部服务/Store 的桥接层。
- `servers/` — **20+ 子服务器**（analysis / backstock / data-collector 等），每个封装一类领域能力。

> 子服务器清单以 `register.ts` 与 `servers/` 目录为权威；新增子服务器须同步登记能力声明并补充对应技能路由条目。

## 三、CLI 暴露策略

MCP 服务器通过 CLI 层对外暴露两类能力：

- **交互式**：对话/Agent 调用经 MCP 协议直连子服务器（由 `bridge/` 与 `core/` 处理会话与权限）。
- **批处理/运维**：脚本化调用（如数据采集、健康检查、字典刷新）通过 `scripts/` 下的受管命令入口，统一走 §十六 Bash 约定（受管 venv/Node、命令入口固化）。

CLI 不应绕过 MCP 协议直接调用内部 Store/服务；所有对外能力须经 `register.ts` 登记，确保可发现、可审计。

## 四、MCP 能力 → Skill 路由映射

复用 `AGENTS.md` 技能路由表范式（文件信号/关键词信号 × mandatory 门禁）：

| 信号 | 命中 MCP 能力 | 路由到 Skill/Agent | 类型 |
|---|---|---|---|
| `src/mcp/servers/analysis/**` 变更 | 分析类能力 | 分析域 Skill（五因子/七维） | mandatory |
| `src/mcp/servers/data-collector/**` 变更 | 采集类能力 | 采集流水线 Skill | mandatory |
| `src/mcp/register.ts` 变更 | 能力注册表 | 技能路由表同步（L1/L2/L4） | mandatory |
| `src/mcp/core/**` 变更 | 协议/权限核心 | 数据流完整性审计 Skill | mandatory |

变更 `register.ts` 或新增子服务器时，须同步：

1. `scripts/skill-router.cjs` 路由规则（L4）；
2. `.trae/skills/skill-registry.json`（L1）；
3. `AGENTS.md` 技能路由表（L2）；
4. 跑 `npm run audit:skill-coverage` 校验三方一致。

## 五、与既有门禁的衔接

- **分层**：`mcp/` 可依赖 `core/`/`data/`/`lib/`/`services/`，被 `services/` 与 `pages/` 引用；禁止依赖 `pages`/`components`/`apps`。
- **ACL**：MCP 写操作须封装为 `StandardEnvelope` 经 `DataBridge.forward()`，最终由 `data/gateway/` 执行；新增 ENVELOPE_ACTION 须同步 `audit:acl-consistency`。
- **技能健康度**：L5 调度任务「技能健康度月检」（`17 8 1 * *`）覆盖 MCP 相关技能。

## 六、待补充（重建基线缺口）

- 各子服务器的**能力清单明细**（以 `register.ts` 与 `servers/` 实际导出为准）。
- CLI 子命令的完整语法与示例。
- MCP 能力 ↔ Skill 的完整映射矩阵（随子服务器扩展持续回填）。

> 本文档为策略基线，后续请基于 `src/mcp/register.ts` 与 `servers/` 实际能力回填 §二/§六，并在 `change_log` 记录补充版本。
