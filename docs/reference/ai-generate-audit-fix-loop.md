---
title: ai-generate-audit-fix-loop
type: reference
domain: qa
phase: testing
tier: reference
status: active
maintainer: V9 Architecture Team
summary: "Version：v1.0.0 | 日期：2026-07-10"
tags: [qa, audit, fix, reference, testing]
version: v1.0.0
last_updated: 2026-07-17
code_version: 2.0.0
doc_id: V9-DOC-QA-028
referenced_by: [V9-DOC-META-000, V9-DOC-PROJ-176]
change_log:
  - version: v1.0.0
changes: Initial version established
date: 2026-07-17
---

# AI 生成—审计—修正飞轮

> **Version**：v1.0.0 | 日期：2026-07-10

## 1. 目标

把 AI 辅助开发从“一次性生成”升级为“生成 → 审计 → 修正 → 再审计”的闭环，
确保 AI 产出在提交前自动通过所有质量门禁，降低人工返工与架构漂移。

## 2. 飞轮流程

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  1. 生成    │ ──? │  2. 审计    │ ──? │  3. 修正    │ ──? │  4. 再审计  │
│  AI 输出    │     │  audit 脚本 │     │  定位修复   │     │  确认通过   │
└─────────────┘     └─────────────┘     └─────────────┘     └─────────────┘
         ▲                                                            │
         └──────────────── 重复直到全部门禁通过 ───────────────────────┘
```

## 3. 各阶段规范

### 3.1 生成阶段

- AI 必须加载对应提示词模板（`prompts/`）与检查清单（`docs/`）。
- 生成前，AI 应调用项目记忆索引检索相关上下文：
  ```bash
  npx tsx scripts/query-ai-memory.ts "<关键词>" --top 5
  ```
- 输出顺序：文件清单 → 类型定义 → Store → Service → UI。
- 每个导出公共实体必须附带 JSDoc（`./jsdoc-convention.md`）。

### 3.2 审计阶段

AI 生成代码后，必须依次运行以下门禁：

| 顺序 | 命令 | 关注点 |
|------|------|--------|
| 1 | `npx tsc --noEmit` | 类型安全、无 `any`、无 `@ts-ignore` |
| 2 | `npm run lint:colors` | 无硬编码颜色类/HEX |
| 3 | `npm run audit:layers` | 无跨层调用 |
| 4 | `npm run audit:docs` | 新增文件已在文档/路由表中找到引用 |
| 5 | `npm run audit:tokens` | 颜色消费走令牌 |
| 6 | `npm run audit:jsdoc` | 公共实体有 JSDoc（基线内） |
| 7 | `npm run audit:complexity` | 不新增深层嵌套/长链式/重复条件 |

### 3.3 修正阶段

- 审计失败时，AI 必须**只修改失败原因**，不扩大改动范围。
- 修正后优先回归运行**失败的命令**，而非全量重跑。
- 常见修正模式：
  - `lint:colors` 失败 → 将硬编码色改为 `COLOR_TOKENS` / `COLOR_SHADES` / `twText()` 等；
  - `audit:layers` 失败 → 将跨层调用改为通过 Store/Service/DataBridge；
  - `audit:docs` 失败 → 在 `../explanation/overview.md` 或相关 `.md` 中补充引用；
  - `audit:jsdoc` 失败 → 为导出函数/组件补充 JSDoc；
  - `audit:complexity` 失败 → 用卫语句/提前返回/提取函数/策略表降低复杂度。

### 3.4 再审计阶段

- 修正后必须重新运行导致失败的命令，直到通过。
- 最终应手动运行完整 `npm run audit`（如果环境稳定）或至少 `tsc:prod` + `audit:layers` + `lint:colors`。

## 4. 与 Husky 预提交的结合

Husky 预提交门禁已扩展为 9 项：

```
lint-staged → lint:colors → tsc:prod → audit:layers → audit:docs →
verify:tokens → audit:tokens → audit:jsdoc → audit:complexity
```

开发者在本地提交前就会触发飞轮的“审计阶段”。
AI 应在生成阶段主动模拟这些检查，避免提交被 Husky 阻断。

## 5. 推荐 AI 提示词模板

在每次 AI 生成任务前，追加以下指令：

> 请按 V9 项目规范生成代码。完成后，必须运行：
> `npx tsc --noEmit && npm run lint:colors && npm run audit:layers && npm run audit:docs && npm run audit:jsdoc && npm run audit:complexity`。
> 如果任一命令失败，请先说明失败原因，然后定位修复并重新运行，直到全部通过。
> 在修复过程中，优先使用 `docs/` 和 `prompts/` 中的规范，必要时通过
> `npx tsx scripts/query-ai-memory.ts "关键词" --top 5` 检索项目记忆。

## 6. 飞轮成功指标

| 指标 | 当前基线 | 短期目标 | 中期目标 |
|------|----------|----------|----------|
| AI 生成后首次提交成功率 | 待观察 | ≥ 70% | ≥ 90% |
| Husky 预提交平均耗时 | ~3–5 分钟 | ≤ 3 分钟 | ≤ 2 分钟 |
| 每任务平均审计—修正轮次 | 待观察 | ≤ 2 轮 | ≤ 1 轮 |
| 新增代码 JSDoc 缺失增量 | 632 处 | 0 新增 | 持续下降 |

## 7. 演进方向

- 将飞轮脚本化：`scripts/docs-tool/llm-doc-generator.ts` 自动运行生成 → 审计 → 修正建议；
- 接入 AI 记忆层，让 AI 在生成前自动检索相关上下文；
- 在 CI 中增加“AI 生成产物”专用流水线，与人工提交分离运行。
