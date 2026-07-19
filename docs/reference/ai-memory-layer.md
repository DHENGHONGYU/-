---
title: ai-memory-layer
type: reference
domain: ai
phase: design
tier: important
status: active
maintainer: V9 Architecture Team
summary: "为 AI 辅助开发工具（Claude Code / Cursor / Trae 等）提供可检索的项目上下文，"
tags: [ai, memory, reference, mcp, documentation]
version: v1.0.0
last_updated: 2026-07-17
code_version: 2.0.0
doc_id: V9-DOC-AI-011
referenced_by: [V9-DOC-META-000, V9-DOC-PROJ-176]
change_log:
  - version: v1.0.0
changes: Initial version established
date: 2026-07-17
---

# 项目专属 AI 记忆层（RAG）

> **Version**：v1.0.0 | 日期：2026-07-10

## 1. 设计目标

为 AI 辅助开发工具（Claude Code / Cursor / Trae 等）提供可检索的项目上下文，
降低 AI 在迁移、新增模块、颜色使用、测试策略等场景下的上下文漂移与返工。

## 2. 索引范围

当前索引覆盖以下核心文档：

| 类别 | 文件 |
|------|------|
| AI 行为契约 | `../../AGENTS.md` |
| 设计令牌规范 | `./design-token-mapping.md` |
| UI 迁移检查 | `./ui-migration-checklist.md` |
| Widget 集成检查 | `./widget-integration-checklist.md` |
| 文档与注释规范 | `./jsdoc-convention.md` |
| 复杂度治理 | `./complexity-governance.md` |
| 测试策略 | `./testing-strategy.md` |
| 提示词模板 | `prompts/*.md` |

## 3. 生成与更新

```bash
# 重新生成 AI 记忆索引
npx tsx scripts/build-ai-memory-index.ts

# 或
npm run build:ai-memory
```

输出文件：`public/ai-memory-index.json`

## 4. 检索方式

### 4.1 命令行

```bash
npx tsx scripts/query-ai-memory.ts "颜色令牌" --top 5
```

### 4.2 运行时服务

```ts
import { queryMemory } from '@/services/system/aiMemoryService'

const results = await queryMemory('Widget 注册三处同步', 3)
for (const { chunk, score } of results) {
  console.log(chunk.file, chunk.title, score)
}
```

## 5. 与提示词工程结合

在 `../../prompts/system-prompt-template.md` 中，已要求 AI 在生成代码前：

1. 检查 `../../AGENTS.md` 分层与颜色规范；
2. 对照 `./ui-migration-checklist.md` / `./widget-integration-checklist.md` 执行迁移或新增 Widget；
3. 检索 AI 记忆索引获取相关片段，作为上下文注入。

未来可在 AI 工具侧接入 `aiMemoryService.queryMemory()`，实现自动检索与注入。

## 6. 演进方向

- v1.1：接入向量嵌入（如 `transformers.js` / OpenAI Embedding），支持语义检索；
- v1.2：与 `build-health-report.ts` 结合，把健康度报告也纳入索引；
- v1.3：在 AI 生成—审计—修正飞轮中，作为自动检索模块调用。
