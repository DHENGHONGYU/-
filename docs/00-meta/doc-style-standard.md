---
title: V9 文档风格统一标准（doc-style-standard�?
type: meta
domain: project
phase: planning
tier: important
status: active
maintainer: V9 Architecture Team
summary: "全项�?Markdown 风格唯一正源。取代各模型/各趟 pass 自行发挥的写法�?
tags: [project, spec, documentation, governance]
version: v1.0.0
last_updated: 2026-07-17
code_version: 2.0.0
doc_id: V9-DOC-PROJ-010
change_log:
  - version: v1.0.0
changes: Initial version established
date: 2026-07-17
---meta
domain: project
tier: important
doc_id: V9-DOC-PROJ-010
status: active
maintainer: V9 Architecture Team
summary: "全项�?Markdown 风格唯一正源。取代各模型/各趟 pass 自行发挥的写法�?
tags: [project, spec, documentation]
phase: planning
version: v1.0.0
last_updated: 2026-07-17
code_version: 2.0.0
---

# V9 文档风格统一标准（doc-style-standard�?
> **定位**：全项目 Markdown 风格**唯一正源**。取代各模型/各趟 pass 自行发挥的写法�?> **关联契约**：`doc-proofreading-strategy.md`（交叉引用检查）、`hybrid-proofread-contract.md`（校对服务）、`markdown-reorg-framework.md`（三级分类）�?> **强制等级**：core。任何新文档/修改必须遵循；变更需架构评审�?
---

## 1. 背景：为什么需要本标准

二次检索（2026-07-16）发现多模型/多趟校对导致风格严重割裂�?
- **585 / 694** �?`.md` �?*重复 frontmatter �?*（双�?三块），块间 tier/title 自相矛盾（如 `docs/README.md` �? `tier:important` �? `tier:reference`）�?- **12+ �?*署名标签：`Kimi Code CLI`、`AI Assistant (GLM-5.2)`、`AI 辅助开发流程`、`AI 文档工程师`、`V9 Quality Audit Team`、`software-engineer-2（寇豆码）`�?且字段键名有 **6 �?*（执行人/校对人员/报告生成�?报告作�?日志生成工具/测试执行人）�?- **术语异词**：数据字�?vs 数据定义、智能体 vs Agent vs 代理�?- **日期 4+ �?*且曾存在错年（`registry-index.md` 等曾�?`2025-07-12`，已�?P0-2 修复�?`2026-07-12`）�?- **emoji 体系混乱**：🟢🔵🟡⭐🔶📘📊📋✅🔴⚠️ℹ�?混用，装饰�?emoji 进标题�?- **元数据键中英混用**：`Status/Version/Last Updated` vs `版本/日期/生成时间`�?
本标准将以上全部归一�?
---

## 2. Frontmatter 规范（强制）

- **仅允许单�?`---` �?*，置于文件首行，与正文间空一行�?- **字段集（英文键，受控�?*�?
| 字段 | 必填 | 取�?| 说明 |
|------|------|------|------|
| `title` | �?| 短名 slug（如 `doc-style-standard`�?| **禁止**全路径名（如 `docs/00-meta/doc-style-standard.md`�?|
| `code_version` | �?| 语义版本 `x.y.z` | 缺则�?`1.0.0` |
| `tier` | �?| `core` \| `important` \| `reference` \| `archive` | 前三者与 `markdown-reorg-framework.md` 三级分类一致；`archive` 为归档文档既有约定（52 份使用，生成器已支持前缀 `A-`�?|
| `status` | �?| `draft` \| `active` \| `deprecated` | archive/deprecated 副本�?|
| `source` | �?| 自由文本 | 溯源（如 `scene#17 Agent 应用`�?|
| `generated` | �?| `YYYY-MM-DD` | 生成日期 |
| `date` | �?| `YYYY-MM-DD` | 内容日期 |
| `owner` | �?| 受控枚举 | 责任�?|

- **禁止**：重�?frontmatter 块、中文键（`版本:`/`标题:`）、title 用全路径名、块�?tier 冲突�?
**�?规范写法**
```markdown
---
title: doc-style-standard
code_version: 2.0.0
tier: core
source: 多模型校对风格统一之权威标�?---
title: doc-style-standard

# Classification
type: meta
domain: project # TODO: confirm
tier: core
status: active

# Version
version: v1.0.0 # TODO: confirm
last_updated: 2026-07-16
code_version: 2.0.0

# People & Tags
# maintainer: TODO
# tags: [tag1, tag2]
# summary: One-line summary

---
---

# 文档标题
```

**�?违规写法（须修复�?*
```markdown
---                                    �?�?
title: doc-style-standard
code_version: 2.0.0
tier: core
---
---                                    �?�?（重复，禁止�?title: docs/00-meta/doc-style-standard.md
tier: reference                        �?与块1 冲突
---
```

---

## 3. 元数据块规范（frontmatter 之后�?
- �?`>` 引用块承载人类可读元信息�?*置于标题下方**�?- **键统一英文**（取�?6 种历史中文键）：

| 历史键（禁用�?| 统一�?| 示例 |
|---------------|--------|------|
| 版本 / Version | `Version` | `> **Version**: v1.0.0` |
| 日期 / 报告生成时间 / 同步日期 | `Date` | `> **Date**: 2026-07-16` |
| 校对人员 / 执行�?/ 报告生成�?/ 报告作�?/ 日志生成工具 / 测试执行�?| `Proofreader` / `Generator` | `> **Proofreader**: claude` |
| 单一事实�?/ 关联 | `Source` | `> **Source**: AGENTS.md` |

- **日期格式**：`YYYY-MM-DD`；确需时分�?`YYYY-MM-DD HH:mm`�?*禁止** `2026�?�?6日` / `2026/07/16`�?
---

## 4. 署名/校对字段归一（解�?12+ 种标签）

- 统一键：`Proofreader:`（校对人）、`Generator:`（生成人）�?- **受控枚举**（自由写法一律归一）：

| 类别 | 枚举�?| 覆盖的历史自由写�?|
|------|--------|-------------------|
| 人工 | `human` | 应潇震、人工复�?|
| AI 模型 | `claude` `kimi` `deepseek` `glm` `qwen` `gpt` `gemini` `workbuddy` | Kimi Code CLI、AI Assistant (GLM-5.2)、AI 辅助开发、AI 文档工程�?|
| 团队 | `v9-arch-team` `v9-quality-audit` `v9-doc-eng` | V9 Quality Audit Team、V9 Architecture Team、架构组 |

**�?规范**：`> **Proofreader**: claude | **Generator**: kimi`

---

## 5. 术语表（解决同概念异词）

| 概念 | 统一用词 | 禁用 | 说明 |
|------|---------|------|------|
| 数据字典 / 数据定义 | **数据字典**（文�?`data-definition.md`�?| 混用二�?| �?`reference/data-definition.md` 为唯一正源 |
| 智能�?/ Agent / 代理 | 正文�?*智能�?*；代码标识符�?**Agent** | 代理（指 AI 时） | "代理"仅用�?proxy/网络代理 |
| 组件 / 部件 | **组件**（component�?| 部件 | |
| 契约 / 合同 | **契约**（contract�?| 合同 | |
| 看板 / 面板 | **看板**（kanban�? **面板**（panel�?| 混用 | 区分场景使用 |

> 术语替换**仅限文档正文**，不改动代码标识符与文件名�?
---

## 6. 标题与结�?
- 一�?`#` 全文**仅一�?*（文档标题），副标题连接符统一�?`—`（em dash），**禁止** `·` / `：` 混用�?- 层级连续不跳级（`#`→`##`→`###`）�?- 章节编号：`## 1.` `### 1.1` 十进制，全文档连续�?
---

## 7. Emoji 使用政策（解决体系混乱）

- **仅允许语义状�?emoji，固定语义，禁止装饰�?emoji 进标�?*�?
| emoji | 语义 | 使用场景 |
|-------|------|----------|
| �?| 完成/通过 | 清单项状�?|
| ⚠️ | 警告 | 风险提示 |
| �?| 失败/缺失 | 阻断�?|
| 🔴 / 🟡 / 🟢 | �?�?低危 | 风险等级（对�?`status` 字段�?|
| �?| 评分 1�? | 仅评分场�?|

- **禁止**：`## 📊 统计汇总` 这类装饰 emoji 标题 �?改为 `## 统计汇总`�?- 分类色块（🟢🔵🟡）仅作 tier/status 标记，不进正文句子�?
---

## 8. 链接与引�?
- 文档间引用用 **slug（文件名�?*，不�?`C-/I-/R-` 编号（编号可因重排改变）�?- �?*相对路径**，禁止绝对路径（�?`C:\Users\...\xxx.md`）与越界 `../..`�?
---

## 9. 校验与门禁（补充更新和检查）

将本标准接入自动校对体系�?*已于 2026-07-16 P3 落地实现**）：

- `npm run doc:proofread`：现�?XREF 检查（D2C/C2D/D2D�?*已扩�?`style` 维度**（见下方输出 `[style]` 行）�?- 检查器：`scripts/docs-tool/style-lint.ts`（实现本节全部检查项：重�?frontmatter 块、中文键、未归一署名、术语违例、日期格式、emoji 违规、标题跳级）�?- 半自动归一脚本：`scripts/docs-tool/normalize-style.mjs`（P1/P2 批量修复，含 `--dry` 预演）�?- `doc:gate`：已新增�?7 项「文档风格」检查，当前 `warning` 级（不阻断），与 `doc-proofreading-strategy.md` §4 升级路径一致；�?backlog 清理后翻 `blocking`�?- 关联：`doc-style-remediation-plan.md`（P0–P3 执行方案与验收）、`markdown-reorg-framework.md`（三级分类）�?
---

## 10. 合规自查清单（作�?AI 必读�?
- [ ] 单个 frontmatter 块，字段 `title`/`code_version`/`tier` 齐全且英文键
- [ ] `title` 为短�?slug，无路径
- [ ] 元数据块键全英文（Version/Date/Proofreader/Generator�?- [ ] 署名用受控枚�?- [ ] 术语符合�?5 节术语表
- [ ] 日期 `YYYY-MM-DD`，无错年
- [ ] 标题单一 `#`，连接符 `—`，无装饰 emoji
- [ ] 引用�?slug + 相对路径

## 11. 执行状态（2026-07-16 · P0–P3 全落地）

| 阶段 | 动作 | 结果 |
|------|------|------|
| P0 | 折叠 585 重复 frontmatter、修�?12 错年、合�?3 组同名文件、重�?manifest(694=694) | �?全绿 |
| P1 | 元数据中文键→英�?336)、署名→受控枚举(7)、正文术�?数据定义→数据字�?部件→组�?102) | �?全绿 |
| P2 | 标题装饰 emoji 清理(68)、日期格式归一(5) | �?全绿 |
| P3 | `style-lint.ts` 实现 §9 检查项，接�?`doc:proofread`(style 维度) �?`doc:gate`(检�?7，warning) | �?7/7 门禁通过 |

**当前残留（warning 级，待人�?后续清理�?*：`heading-skip` 168 项（标题层级跳级，不阻断）；治理/归档文档中的示例性术语与示例日期已按规则豁免检查�?
**验证**：`node scripts/docs-tool/normalize-style.mjs --dry` 幂等归零；`node node_modules/tsx/dist/cli.mjs scripts/docs-tool/style-lint.ts` 复检；`npm run doc:gate` 7/7 通过�?