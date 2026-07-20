---
title: file-management-guide.md 综合测试评分报告
type: reports
domain: qa
phase: testing
tier: standard
status: active
maintainer: V9 Architecture Team
summary: "检查时�?*: 2026-07-20 被检查文�?*: `../../how-to/file-management-guide.md` (v1.0.0, 2026-07-02)..."
tags: [qa, test, management]
version: v1.0.0
last_updated: 2026-07-17
code_version: 2.0.0
change_log:
  - version: v1.0.0
changes: Initial version established
date: 2026-07-17
---

# file-management-guide.md 综合测试评分报告

> **检查时�?*: 2026-07-20  
> **被检查文�?*: `../../how-to/file-management-guide.md` (v1.0.0, 2026-07-02)  
> **参考基�?*: `../../../AGENTS.md` (v1.4.3, 2026-07-10)、仓库实际文件分布、`.gitignore`

---

## 一、综合评分总览

| 检查维�?| 得分 | 权重 | 加权得分 | 核心结论 |
|---------|------|------|---------|---------|
| 架构一致�?| 6/10 | 25% | 1.50 | `src/` 子目录映射严重不完整 |
| .gitignore 合规�?| 4/10 | 20% | 0.80 | 文档与实�?.gitignore 严重脱节 |
| 实际文件分布 | 5/10 | 20% | 1.00 | 存在文件流浪、目录重复、monorepo 未覆�?|
| 完整�?| 3/10 | 25% | 0.75 | 命名规范、docs 分层、Schema 变更等缺�?|
| 跨文档引�?| 5/10 | 10% | 0.50 | 信息孤岛，未被文档索引收�?|
| **综合评分** | �?| **100%** | **4.55/10** | **不合格，需紧急修�?* |

> **评级**: 🔴 **不合�?* (4.55/10)  
> **判定标准**: �?8.0 优秀 | 6.0-7.9 合格 | 4.0-5.9 不合�?| < 4.0 严重不合�?
---

## 二、各维度详细评分

### 2.1 架构一致�?�?6/10

**评分依据**: file-management-guide.md 第一�?文件归位规则"�?`src/` 的说明列仅列�?6 个子目录，�?`../../../AGENTS.md` 明确定义�?11 �?`src/` 子目�?+ 1 �?`agents/` 目录，遗漏率高达 42%�?
| # | 问题 | 严重程度 | 具体位置 |
|---|------|---------|---------|
| 1 | 遗漏 `src/portal/`（PortalShell 舱室入口层） | Major | �?2�?|
| 2 | 遗漏 `src/constants/`（常量层�?| Major | �?2�?|
| 3 | 遗漏 `src/config/`（配置层�?| Major | �?2�?|
| 4 | 遗漏 `src/lib/`（库函数层） | Major | �?2�?|
| 5 | 遗漏 `src/types/`（纯类型定义层） | Major | �?2�?|
| 6 | 遗漏 `src/apps/`（App 分发器，三级加载链核心） | Major | 全文 |
| 7 | 遗漏 `agents/`（core 层扩展，�?`.agents/skills/` 混淆�?| Major | �?9�?|
| 8 | 遗漏 `prompts/` 目录 | Minor | 全文 |
| 9 | 版本日期滞后（v1.0.0 vs AGENTS.md v1.4.3�?| Info | �?�?|

**正向发现**:
- 禁止事项定义清晰（根目录 `.ts/.tsx/.ps1/.py` 禁止�?- 提交前检查清单与 AGENTS.md 完全一�?
---

### 2.2 .gitignore 合规�?�?4/10

**评分依据**: 文档�?.2节列出的 11 个忽略类别中�?gitignore 实际包含 167 行规则，超过 60% 已配置规则未被文档提及；同时文档规则示例�?.gitignore 实际格式存在不一致�?
| # | 问题 | 严重程度 | 具体位置 |
|---|------|---------|---------|
| 1 | `.gitignore` 中大量已配置规则（OS 文件、Python 环境、Vite 产物、Playwright 截图、根目录报告等）未被文档记录 | Major | �?.2�?|
| 2 | 文档规则示例�?`.gitignore` 实际格式不一致（尾部斜杠差异�?| Minor | �?.2�?|
| 3 | `.eslintcache` 未在 `.gitignore` 中配�?| Minor | `.gitignore` |
| 4 | `.trae/` 规则�?`.gitignore` 中分散，文档未提�?`.trae-security/` | Info | �?.2�?|
| 5 | 文档"Playwright"类别遗漏 `screenshots/` | Minor | �?.2�?|

**正向发现**:
- 核心忽略类别覆盖完整
- 根目录限定规则使用规范（前导 `/`�?- `.gitignore` 分组注释清晰

---

### 2.3 实际文件分布 �?5/10

**评分依据**: 仓库实际存在大量 file-management-guide.md 未覆盖的目录和文件流浪现象�?
| # | 问题 | 严重程度 | 证据 |
|---|------|---------|------|
| 1 | `src/apps/`、`src/portal/`、`src/cockpit/` 等核心架构目录在文件归位规则表中完全缺失 | Major | AGENTS.md §五、�?.5.4 |
| 2 | `toolkit/` 目录存在"文件流浪"——TypeScript 源码位于 `src/` 之外，且�?`src/lib/safeCoerce.ts` 疑似重复 | Major | `toolkit/safeCoerce.ts` vs `src/lib/safeCoerce.ts` |
| 3 | `src/agents/` �?`.agents/skills/` 两套 agents 目录共存，文档未区分 | Major | `src/agents/` 存在、`.agents/skills/` 存在 |
| 4 | `src/core/databridge.ts` 独立目录�?AGENTS.md �?`src/core/` 定义冲突 | Major | `src/core/databridge.ts` 存在 |
| 5 | `outputs/` 目录存在大量未规范管理的测试产物 | Minor | `outputs/test-doc-auto-update/*.md` |
| 6 | `packages/`、`python/`、`plugins/` 等非规范目录缺少文档说明 | Minor | 根目录存�?|
| 7 | `src/lib/` �?`src/lib/` 并存，职责边界不�?| Minor | `src/lib/validation.ts` |
| 8 | `docs/` 子目录复杂但文档仅简单覆�?| Minor | `docs/00-meta/`~`07-archive/` |
| 9 | `src/devtools/`、`src/fixtures/` 等未在文档中说明 | Info | 实际存在 |
| 10 | 禁止事项未设例外条款（根目录配置文件/项目根文档） | Info | �?2-26�?|

**正向发现**:
- `src/` 核心分层目录结构基本完整
- `tests/` �?`e2e/` 结构良好
- `scripts/` 集中管理
- `.github/workflows/` �?`.agents/skills/` 结构正常
- 未发现根目录直接�?`.ps1` �?`.py` 脚本流浪

---

### 2.4 完整�?�?3/10

**评分依据**: 作为文件管理规范，遗漏了命名规范、docs 分层、Schema 变更、AI 产物管理、日志管理等关键维度�?
| # | 缺失�?| 严重程度 | 应补充位�?|
|---|--------|---------|-----------|
| 1 | **文件命名规范完全缺失**（kebab-case/PascalCase/camelCase/UPPER_SNAKE_CASE�?| Major | 新增"命名规范"一�?|
| 2 | **`docs/` 子目录分层规范缺�?*（`00-meta`~`07-archive` 的用途未说明�?| Major | 新增 docs/ 分层�?|
| 3 | **数据�?Schema 变更与文件管理的关系缺失**（DB_VERSION 递增、STORE_NAME 注册、Migration 文件同步�?| Major | 新增"数据层文件变�?SOP" |
| 4 | **`src/` 关键目录严重遗漏**（apps/portal/constants/types/lib/config 等） | Major | �?节文件归位规�?|
| 5 | **AI 生成产物（`docs/drafts/`）管理规范缺�?* | Minor | 新增 drafts/ 条目 |
| 6 | **`temp/` 目录清理策略缺失**（保留期限、清理时机） | Minor | �?节或新增"生命周期管理" |
| 7 | **配置文件管理规范缺失**（根目录配置 vs `src/config/`�?| Minor | 新增"配置文件管理" |
| 8 | **日志文件管理规范缺失**（`docs/changelogs/` 按月归档�?| Minor | 新增 changelogs/ 条目 |
| 9 | **验证命令覆盖不完�?*（遗�?`audit:hardcode`、`audit:deadcode` 等） | Minor | �?节提交前检�?|
| 10 | **缺少与其他文档的交叉引用** | Minor | 全文补充引用 |

---

### 2.5 跨文档引�?�?5/10

**评分依据**: file-management-guide.md 形成信息孤岛，未被文档体系索引收录，也未引用任何其他相关文档�?
| # | 问题 | 严重程度 | 具体位置 |
|---|------|---------|---------|
| 1 | 未引�?`../../../AGENTS.md` 架构契约（核心相关文档） | Major | �?�?|
| 2 | 未被 `../../reference/README.md` 文档索引收录 | Major | `../../reference/README.md` |
| 3 | 未引用同主题更详细的 `../../00-meta/trae-file-management-review.md` | Minor | 全文 |
| 4 | 版本号体系与项目不一致（v1.0.0 vs README v2.5.0 vs AGENTS v1.4.3�?| Minor | 头部 |
| 5 | 未引�?`.gitignore` 文件本身 | Info | �?�?|

**正向发现**:
- 文件创建过程有明确的溯源记录（`./untracked-files-remediation-report.md`�?- 适用范围�?AGENTS.md 合理互补

---

## 三、问题优先级矩阵

| 优先�?| 问题数量 | 问题清单 | 预期影响 |
|--------|---------|---------|---------|
| 🔴 **P0 - 阻塞�?* | 4�?| `src/` 目录映射不完整、遗�?`apps/`/`portal/`/`constants`/...、命名规范缺失、未纳入文档索引 | AI 和开发者无法正确放置文件，导致架构漂移 |
| 🟠 **P1 - 高优先级** | 6�?| .gitignore 文档脱节、文件流浪（toolkit/、databridge/、agents/ 混淆）、docs 分层缺失、Schema 变更 SOP 缺失、未引用 AGENTS.md、未引用 ../../00-meta/trae-file-management-review.md | 文档权威性受损，实际规范与文档不一�?|
| 🟡 **P2 - 中优先级** | 5�?| outputs/ 未管理、packages/python/plugins 未说明、utils/lib 边界不清、temp/ 清理策略缺失、验证命令不完整 | 长期维护成本增加，文件管理盲区扩�?|
| 🟢 **P3 - 低优先级** | 4�?| 版本号不一致�?eslintcache 缺失、src/devtools 等未说明、禁止事项例外条�?| 细节优化，不影响核心功能 |

---

## 四、改进建议与行动计划

### 4.1 紧急修订（P0 - 本周完成�?
| # | 任务 | 目标文件 | 具体行动 |
|---|------|---------|---------|
| 1 | 补全 `src/` 目录映射 | `../../how-to/file-management-guide.md` �?�?| 将文件归位规则表扩展为完整列表：`config/`、`core/`、`data/`、`lib/`、`services/`、`store/`、`pages/`、`components/`、`portal/`、`constants/`、`types/`、`apps/`、`cockpit/` |
| 2 | 区分 `src/agents/` �?`.agents/skills/` | `../../how-to/file-management-guide.md` �?�?| 新增两行�?AI 行为扩展"→`src/agents/`�?AI 技能定�?→`.agents/skills/` |
| 3 | 新增命名规范章节 | `../../how-to/file-management-guide.md` | 复刻 `../../../AGENTS.md` §四：kebab-case（文件名）、PascalCase（组件）、camelCase+Store（Store）、UPPER_SNAKE_CASE（常量） |
| 4 | 纳入文档索引 | `../../reference/README.md` | �?专项文档"表中添加 `../../how-to/file-management-guide.md` |

### 4.2 高优先级修订（P1 - 两周完成�?
| # | 任务 | 目标文件 | 具体行动 |
|---|------|---------|---------|
| 5 | 同步 .gitignore 文档 | `../../how-to/file-management-guide.md` �?.2�?| �?.gitignore 中所有已配置但未提及的规则按类别补充到文档表�?|
| 6 | 新增 docs/ 子目录分层规�?| `../../how-to/file-management-guide.md` | 新增表格�?0-meta/运维�?1-requirements/需求规范�?2-design/设计�?3-development/开发指南�?4-testing/测试�?5-deployment/部署�?6-project-management/项目管理�?7-archive/归档 |
| 7 | 新增数据层文件变�?SOP | `../../how-to/file-management-guide.md` | 规定 schema 变更时必须同步修改的文件清单：`dbConfig.ts`（DB_VERSION 递增）、`db-schema.ts`（基�?store）、`db-migrations.ts`（增�?store）、`ACL.ts`（白名单）、`DataBridge.routeToDB()`（ENVELOPE_ACTION�?|
| 8 | 建立跨文档引用链�?| `../../how-to/file-management-guide.md` | 在文件归位规则引�?AGENTS.md §一；在命名规范引用 AGENTS.md §四；�?docs/ 分层引用各目�?README |
| 9 | 清理文件流浪 | 仓库 | 核查 `toolkit/` �?`src/lib/` 重复、`src/core/databridge.ts` 归属、`src/lib/` 合并 |

### 4.3 中优先级补充（P2 - 一个月内完成）

| # | 任务 | 目标文件 | 具体行动 |
|---|------|---------|---------|
| 10 | 补充 monorepo/多语言目录规范 | `../../how-to/file-management-guide.md` | 新增"根目录特殊目�?：packages/（子项目）、python/（Python 服务）、plugins/（数据源插件�?|
| 11 | 新增 AI 产物管理规范 | `../../how-to/file-management-guide.md` | 新增 `docs/drafts/` 条目：用途（AI 生成中间产物）、命名规则（时间戳前缀）、保留策略（定期归档�?|
| 12 | 补充 temp/ 清理策略 | `../../how-to/file-management-guide.md` | 明确"每次构建前自动清�?�?保留最�?�? |
| 13 | 完善验证命令清单 | `../../how-to/file-management-guide.md` �?�?| 补充 `audit:hardcode`、`audit:deadcode`、`audit:docs`、`audit:token` |

### 4.4 低优先级优化（P3 - 后续迭代�?
| # | 任务 | 目标文件 | 具体行动 |
|---|------|---------|---------|
| 14 | 统一版本号声�?| `../../how-to/file-management-guide.md` | 采用"文档体系版本 v2.5.0 + 自身修订版本 rev.1"双版本号 |
| 15 | 补充 .eslintcache 忽略 | `.gitignore` | 新增 `.eslintcache` |
| 16 | 增加禁止事项例外条款 | `../../how-to/file-management-guide.md` �?�?| 明确"标准项目配置文件及项目根级文档除�? |

---

## 五、版本升级建�?
当前 `../../how-to/file-management-guide.md` 版本�?**v1.0.0**�?026-07-02），已严重滞后于项目架构（`../../../AGENTS.md` v1.4.3�?026-07-10）�?
建议按以下路线升级：

```
v1.0.0 (2026-07-02) ──�?v1.1.0 (P0 修订完成)
                         ├── 补全 src/ 目录映射
                         ├── 新增命名规范
                         └── 纳入文档索引
                         
                         ──�?v1.2.0 (P1 修订完成)
                         ├── 同步 .gitignore 文档
                         ├── 新增 docs/ 子目录分�?                         ├── 新增数据层文件变�?SOP
                         └── 建立跨文档引用链�?                         
                         ──�?v1.3.0 (P2 修订完成)
                         ├── 补充 monorepo/多语言规范
                         ├── 新增 AI 产物管理
                         └── 完善验证命令清单
```

---

## 六、检查方法论说明

本次综合测试采用**五维度并行检查法**�?
1. **架构一致性检�?*: 对比 file-management-guide.md �?AGENTS.md 的目录结构定�?2. **.gitignore 合规检�?*: 逐条对比文档规则与实�?`.gitignore` 文件
3. **实际文件分布检�?*: 通过 Glob 扫描仓库实际文件分布，识�?文件流浪"
4. **完整性检�?*: 从文档工程角度评估规范覆盖的完整�?5. **跨文档引用检�?*: 检查文档间的引用链路与索引收录情况

每个维度独立评分，按加权平均计算综合评分。问题按严重程度分为 Major/Minor/Info 三级，按业务影响分为 P0/P1/P2/P3 四级�?
---

> **报告生成**: 2026-07-20  
> **下次复查建议**: 修订完成后运�?`npm run audit:docs` 并重新执行本检查流�?