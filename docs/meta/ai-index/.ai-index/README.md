---
title: docs/meta/ai-index/.ai-index/README.md
code_version: 2.0.0
doc_id: V9-DOC-PROJ-306
---


# V9 AI 索引缓存（.ai-index）

> **定位**：存放供 AI Agent 快速加载的项目知识缓存，降低每次对话重复解析 `docs/` 与 `src/` 的 Token 消耗。遵循 AGENTS.md §七 Token 消耗控制规则。
> **状态**：✅ **P2 已完成**（2026-07-12）

---

## 内容

| 文件 | 作用 | 大小 | 生成方式 |
|------|------|------|---------|
| `ai-memory-index.json` | AI 记忆索引（文档分片 + 关键词倒排） | ~288 KB | `scripts/build-ai-memory-index.ts` |
| `code-graph.json` | 代码关系图谱（708 文件 / 138K 行 / 11 层） | ~3.2 MB | `scripts/extract-code-graph.ts` |
| `README.md` | 本说明 | — | 手动维护 |

## 使用方式

### 方式一：AI Agent 启动时加载

```
1. 读取 docs/README.md（获取文档地图）
2. 读取 docs/.ai-index/ 缓存（获取结构化知识）
3. 按需深入具体文档（避免全量扫描 1794 个文件）
```

### 方式二：命令行查询

```powershell
# 查询 AI 记忆索引（文档内容检索）
npx tsx scripts/query-ai-memory.ts "Widget 注册" --top 5

# 查询代码图谱（从 code-graph.json 提取）
# 见 scripts/extract-code-graph.ts 输出统计摘要
```

## 索引内容详情

### code-graph.json（代码关系图谱）

**生成时间**: 2026-07-12  
**统计摘要**:

| 指标 | 数值 |
|------|------|
| 总文件数 | 708 |
| 总代码行数 | 138,543 |
| 架构违规 | 5,556 |
| 层级数 | 11 |

**各层分布**:

| 层级 | 文件数 | 代码行数 | 说明 |
|------|--------|----------|------|
| services | 168 | 38,985 | 20 子域服务层 |
| components | 142 | 18,808 | UI 组件层（atoms/molecules/organisms/templates） |
| unknown | 140 | 22,224 | 未归类（含 hooks、agents、utils 等） |
| store | 61 | 16,086 | 49 个 Zustand Store |
| pages | 52 | 16,394 | 5 舱页面层 |
| data | 42 | 6,308 | IndexedDB / dataLayer / queryBuilder |
| config | 36 | 6,536 | 配置层（路由/DB/引擎/LLM） |
| constants | 25 | 4,268 | 常量层（主题/令牌/数学常数） |
| core | 23 | 5,513 | 核心层（DataBridge/ACL/Envelope/MemoryCache） |
| lib | 18 | 2,921 | 库层（logger/eventBus/format/errors） |
| portal | 1 | 500 | PortalShell 入口 |

**Top 5 被引用文件**:

1. `@/lib/logger` (295 次) — 日志系统
2. `react` (224 次) — React 框架
3. `@/data/types` (145 次) — 类型定义
4. `@/constants/theme.tokens` (129 次) — 设计令牌
5. `lucide-react` (94 次) — 图标库

**Top 5 最大文件**:

1. `src/pages/command/agent/LlmManagementPage.tsx` (1,044 行)
2. `src/services/data-collector/mockDataCollection.ts` (1,040 行)
3. `src/services/rbac/permissionRevocationService.ts` (978 行)
4. `src/pages/input/CollectTaskPage.tsx` (896 行)
5. `src/data/sectorSkillData.ts` (879 行)

**违规类型分布**:

| 类型 | 数量 | 严重程度 | 说明 |
|------|------|---------|------|
| magic-number | 2,236 | warning | 魔法数字（3 位以上数字未提取为常量） |
| cross-layer-call | 2,555 | error | 跨层调用违规（需 `npm run audit:layers` 确认） |
| hardcoded-color | 649 | warning | 硬编码颜色（HEX/Tailwind 颜色类） |
| missing-cleanup | 116 | warning | 事件监听缺少清理逻辑 |

> **注**: 2,555 个 cross-layer-call 中包含大量 `unknown` 层文件的误报（140 个 unknown 文件未正确归类），实际违规数以 `npm run audit:layers` 为准（当前基线 0 违规）。

### ai-memory-index.json（AI 记忆索引）

**生成时间**: 2026-07-10  
**版本**: 1.0.0  
**内容**: 文档分片（chunk）+ 关键词倒排索引，覆盖 `docs/` 目录核心文档。

## 维护

| 索引 | 更新触发条件 | 更新命令 |
|------|-------------|---------|
| `ai-memory-index.json` | 文档新增/修改/删除后 | `npm run build:ai-memory` |
| `code-graph.json` | 代码架构变更后 | `npm run extract:codeGraph` |
| 两者 | CI 每日定时任务 | `system-check-loop.yml` |

## 归属规则

本目录**不计入文档治理孤儿率**（属 AI 缓存产物，由 CI 生成）。但 `README.md` 纳入治理（需随索引更新同步）。
