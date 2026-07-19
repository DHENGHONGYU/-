---
title: TODO-ADD-TITLE
type: meta
domain: project
phase: planning
tier: standard
status: active
maintainer: V9 Architecture Team
summary: "版本：v1.0.0 �?日期�?026-07-15 单一事实�?*：`scripts/docs-tool/doc-proofreading-strategy.ts`..."
tags: [project, strategy, list]
version: v1.0.0
last_updated: 2026-07-17
code_version: 2.0.0
doc_id: V9-DOC-PROJ-324
change_log:
  - version: v1.0.0
changes: Initial version established
date: 2026-07-17
---

# 自动文档校对策略（doc-proofreading-strategy�?
> **版本**：v1.0.0 �?**日期**�?026-07-15
> **单一事实�?*：`scripts/docs-tool/doc-proofreading-strategy.ts`
> **执行引擎**：`scripts/docs-tool/cross-ref-engine.ts`（三类扫描内核）
> **配套执行�?*：`scripts/docs-tool/doc-proofread.ts`（CLI：`npm run doc:proofread`�?
## 1. 背景与问�?
`scripts/audit/audit-doc-code-references.ts` 早已能产出三类交叉引用统�?（文档→代码 / 代码→文�?/ 文档→文档），但它是**游离的独立审计脚�?*�?并未接入"自动文档校对系统"�?
- `daily-doc-validation.ts`（自动校对主流程）的 consistency 维度**只检查文档→文档相对链接**�?  缺漏�?文档→代�?�?代码→文�?两类�?- `doc:gate` 聚合器只跑了 5 项检查，**完全没有**三类交叉引用审计�?
本策略将三类检�?*正式记录进自动文档校对体�?*，并明确�?*适用范围�?核心文档（core）与重要文档（important�?*，由策略配置统一驱动，杜绝各脚本各自硬编码�?
## 2. 三类检查定�?
| 检�?ID | 名称 | 类型 | 扫描来源 | 含义 |
|---------|------|------|----------|------|
| XREF-D2C | 文档→代码引�?| `doc-to-code` | 文档中的 `src/` `scripts/` 链接或反引号路径 | 文档引用的代�?资源文件必须存在 |
| XREF-C2D | 代码→文档引�?| `code-to-doc` | 代码中的 `docs/**/*.md` 链接/反引�?裸路�?| 代码引用的文档路径必须存�?|
| XREF-D2D | 文档→文档引�?| `doc-to-doc` | 文档中的相对 `.md` 链接（如指向 `docs/reference/` 下的契约文档�?| 文档指向其它文档的链接必须有�?|

## 3. 适用范围（策略核心）

```ts
appliesToTiers: ['core', 'important']
```

- �?**doc-to-code / doc-to-doc**：仅�?*源文�?* tier �?{core, important} 时执行并统计�?- �?**code-to-doc**：仅�?*目标文档** tier �?{core, important} 时执行并统计�?- 文档 tier 取自 frontmatter `tier` 字段；缺�?非法时回退 `classifyTier` 路径分类
  （逻辑�?`doc-rule-validator.ts` 一致）�?
> 不在范围内的 `reference` 类文档不计入本策略，但仍�?`audit-doc-code-references.ts`
> 全量审计覆盖（用于整体债务盘点）�?
## 4. 严重度与阻断策略

| 检�?| 严重�?| 是否阻断（blocking�?|
|------|--------|----------------------|
| XREF-D2C | high | false（仅上报�?|
| XREF-C2D | high | false（仅上报�?|
| XREF-D2D | medium | false（仅上报�?|

**当前全部�?仅上报（warning�?**：发现断裂引用时记录�?`warning` 级别发现�?**不阻�?* `daily-doc:validate` �?`doc:gate`。理由：历史 backlog 体量庞大
（文档→代码�?2,176 断裂、文档→文档�?3,999 断裂、代码→文档�?115 断裂），
立即阻断会冲垮既有门禁�?
**升级路径**：待 backlog 清理后，将对应检查的 `blocking` 翻为 `true`
（在 `doc-proofreading-strategy.ts` 中修改），即可自动升级为 `failure` 并阻断门禁—�?无需改动任何调用方�?
## 5. 接入位置（已落地�?
| 接入�?| 文件 | 行为 |
|--------|------|------|
| 自动校对主流�?| `scripts/docs-tool/daily-doc-validation.ts` | 新增 `crossref` 维度，按 tier 过滤核心/重要文档，产�?findings 并入 dimensionSummaries |
| 文档门禁 | `scripts/doc-gatekeeper.ts` | �?6 项检查，调用 `doc:proofread`；当前非阻断，仅上报范围内断�?|
| 定时调度 | `scripts/docs-tool/doc-sync-scheduler.ts` | 步骤 4.5 记录 `proofreadBroken`（范围内断裂总数�?|
| npm 脚本 | `package.json` | `doc:crossref:audit`（全量审计）、`doc:proofread`（策略范围执行） |

类型层：`src/types/modules/doc-validation.types.ts` �?`ValidationDimension`
已增�?`'crossref'`�?
## 6. 使用方法

```bash
# 全量三类交叉引用审计（不区分 tier，用于债务盘点�?npm run doc:crossref:audit

# 依策略对核心/重要文档执行三类检查并上报
npm run doc:proofread
npm run doc:proofread -- --json        # 机器可读输出
npm run doc:proofread -- --output out.json

# 纳入每日自动校对
npm run daily-doc:validate

# 纳入文档门禁
npm run doc:gate
```

## 7. 与既有一致性检查的关系

- `consistency` 维度：检�?*所有文�?*间的相对链接（含资源），不限 tier�?  断裂记为 `warning`�?- `crossref` 维度（本策略）：聚焦**核心/重要文档**的三类引用（含代码引用）�?  断裂按策�?severity/blocking 上报�?- 两者互补：consistency 广覆盖，crossref 强约束核心资产�?
## 8. 附录：已知限制、解析语义与提示

### 8.1 解析语义回退规则（引擎已实现，非误报抑制�?
`cross-ref-engine.ts` �?`validateReference` �?主解�?之外提供两道兜底�?均以**磁盘实际存在�?*为准，绝不掩盖真实断链：

| 回退 | 触发条件 | 行为 | 防护 |
|------|----------|------|------|
| A. 根级裸名 | 目标为裸文件名（无斜杠），如 `AGENTS.md` / `README.md` / `CHANGELOG.md` 被子目录文档裸名引用 | 回退�?`仓库�?裸名` �?valid | 仅当根级确实同名存在�?valid；站点内其它裸名（如 `../explanation/design/implementation-governance.md` �?`docs/` 嵌套处）仍按原逻辑断链 |
| B. `..` 越界 | 主解析结�?*逃逸仓库根**（如 `docs/../../README.md`、`../../../CHANGELOG.md` �?`resolve` 爬出 rootDir�?| 回退�?`仓库�?basename` �?valid | 仅当确实逃�?rootDir 才触发；**站内相对断链**（解析结果仍�?rootDir 内，�?`../archive/nonexistent-placeholder.md`）不受此影响，仍如实断链 |

> 已实测：根级裸名 12 条、`..` 越界中意图指向本仓库根的文件全部�?valid�?> 另有 2 �?`C:\Users\huawei\Desktop\...` 绝对路径（指向其它机器）属真实断链，
> 因回退后仍不存在而正确保留�?
### 8.2 引擎精度边界（伪引用已排除清单）

以下形态在扫描阶段即被 `isPseudoReference` 判为"伪引�?、不计入断链�?模板字符串插�?`` `${...}` ``、glob 通配 `*`、省略号占位 `...`、占位花括号 `{...}`�?尖括号占�?`<...>`、日�?序号占位 `YYYY/MM/DD/NNN/XXX`、多段大写蛇形占位变�?`MODULE_NAME`/`RISK_DERIVED`、行号后缀 `:数字`、命令行 flag `--`、纯目录引用（尾 `/`）�?**真实字面路径（不含上述字符）不受影响�?*

### 8.3 提示（踩坑记录）

1. **块注释内避免字面 `*/`**：在 `.ts` 文件 `/** ... */` 块注释中若写入含 `*/` 的示�?   （如 `` `docs/**/*.md` `` 中的 `*/`），�?*提前闭合块注�?*，后续代码被当作注释内容�?   引发 esbuild �?`Unexpected "*"` / `Unexpected token`�?   **规避**：块注释内示例改用行注释 `//` 或改写措辞（�?"docs 递归匹配写法"）�?   本引�?JSDoc 已据此改写�?2. **解析语义�?校验正确�?范畴**：根级裸�?/ `..` 越界是引用解析语义问题，
   不应�?示例性写法误�?混淆——前者靠 `validateReference` 兜底，后者靠 `isPseudoReference` 过滤�?   二者职责分离，修改时勿混�?