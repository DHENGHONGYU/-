---
title: TODO-ADD-TITLE
type: meta
domain: architecture
phase: design
tier: standard
status: active
maintainer: V9 Architecture Team
summary: "背景：对 FinSightV9 做分层架构审查与数据污染检查。初稿由\"门禁绿灯 + 4 路 Agent 摘要\"产出， 复核阶段用 Grep..."
tags: [architecture, review, meta]
version: v1.0.0
last_updated: 2026-07-17
code_version: 2.0.0
change_log:
  - version: v1.0.0
changes: Initial version established
date: 2026-07-17
---

# 架构审查与数据污染检测 — 教训总结（2026-07-16）

> 背景：对 FinSightV9 做分层架构审查与数据污染检查。初稿由"门禁绿灯 + 4 路 Agent 摘要"产出，
> 复核阶段用 Grep 实证每条结论，发现门禁存在<strong>假阴性</strong>，同时初稿摘要存在<strong>假阳性</strong>。
> 本文档沉淀可复用的教训，并配套技能 `architecture-pollution-review`（用户级）。

## 教训 1：门禁绿灯 ≠ 无违规（假阴性最危险）

- 现象：`audit:layers` / `audit:mcp` / `audit:db-references` / `audit:hardcode` 全部"0 违规/通过"，
  但仓库真实存在 31+ 处跨层违规。
- 根因：审计脚本的"禁止清单"与扫描目录**未对齐 `AGENTS.md` 契约**——
  漏扫 `lib`、`src/data`、`src/agents`，且 services→data 直连规则从未对 services 生效。
- 教训：**CI 门禁的范围必须逐条比对契约**。门禁是"按规则扫描"，规则有盲区就必然漏报。
  不要把 `0 violations` 当结论，要先审计"审计脚本本身"。

## 教训 2：Agent 摘要也会误报（假阳性对称存在）

复核 Grep 实证后，初稿 4 项关键结论被推翻：

| 初稿声称 | 真相 | 为何误报 |
|---|---|---|
| 5 个"死服务器" | 5 个 `enabled:false` + 注释，受注册表治理的<strong>有意休眠</strong> | 未读注册表，把"零调用"当"死代码" |
| lib→services/store 污染 | src/lib 对业务层 0 命中，lib 层<strong>干净</strong> | 把类型耦合/相对路径误算为运行时污染 |
| cockpit.constants 硬编码 API | 该文件从 `@/config/apiPaths` 导入 + `import.meta.env`，无硬编码 | 未读文件，沿用旧印象 |
| 腾讯 URL 4 处重复互斥 | URL 单源 `dataSourceUrls.ts`，仅一处定义 | 统计了端点路径，混淆"基地址/端点" |

- 教训：**任何结论必须用第二种独立手段（Grep 实证 `file:line`）二次验证**。门禁与 Agent 摘要都不可轻信。
  假阴性让你漏修，假阳性让你误修/浪费——二者对称。

## 教训 3：循环依赖用"下沉纯类型"最小代价破除

- 现象：`src/data/queryBuilder.ts` 引 `services/contracts`，而 `contracts` 引 `services/errorBus` → data?services 循环。
- 解法：把纯 `Result/ok/fail/isOk/...` 工具下沉 `src/core/result.ts`（`import type` 引用 `lib/errors`，属豁免）；
  `contracts.ts` 改为 re-export，`queryBuilder.ts` 改引 core。
- 收益：循环归零、所有现存 `import { ok } from '@/services/contracts'` 不变、tsc + 9 单测全过。
- 教训：破环优先"下沉无副作用的纯工具到更底层"，而非大改调用方；保持 re-export 兼容旧导入。

## 教训 4：改门禁要用"过渡期 warning + exit 0"

- 扩展 `audit-layer-calls.ts` 补盲区时，存量 23 处 services→data 直连若直接判 violation，会阻塞 husky 预提交，
  引发大规模误伤与开发抵触。
- 解法：存量违规记 `warning`、exit code 0；新违规才升级为 violation。门禁先"可见"再"可阻"。
- 教训：审计脚本是治理杠杆，扩规则要兼顾"不阻断现有 CI"，否则改革推不动。

## 教训 5：契约与代码张力要主动标注，别假装一致

- 张位点：`core → lib`（契约禁，但 code 用 `lib/logger`/`eventBus` 等 infra，20+ 处）、门禁范围 ≠ 契约。
- 教训：发现契约与代码不一致时，二选一——(a) 改代码贴合契约；(b) 改契约并注明豁免理由。
  绝不能"契约写一套、脚本扫一套、代码又一套"三套各说各话。

## 教训 6：配置单源 + 注册表治理是既有优点，审查须先承认再挑刺

- 优点：`dataSourceUrls.ts` 外部 URL 单源（头注禁硬编码）、`mcpServerRegistry.ts` 配置驱动启停 + 热同步。
- 教训：审查不是"找茬比赛"。先确认哪些已做对（避免误报），再指出真问题（双 `directDataAPI`、services 直连）。
  先肯定治理骨架，整改才有可信基线。

## 可复用技能

- `architecture-pollution-review`（用户级 `~/.workbuddy/skills/`）：固化"门禁盲区自检 → MCP 评审 →
  污染检测 → 跨层 Grep 实证 → 数据流溯源 → 结构化报告"五步法，强制二次独立验证。

## 改进路线（当前状态）

- P0 ? 扩门禁盲区 · ? 破 data?services 循环
- P1 ? 收敛 23 处 services→data 直连 · ? 合并双 `directDataAPI.ts` · ? cockpit 三通道归一
- P2 ? 补 15 Envelope→store 映射 · ? AGENTS.md 标注 core?lib-infra 豁免
