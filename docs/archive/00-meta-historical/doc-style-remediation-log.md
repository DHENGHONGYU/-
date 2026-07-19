---
title: doc-style-remediation-log
code_version: 2.0.0
tier: reference
source: 文档风格统一 P1–P3 执行日志
generated: 2026-07-16
---

# V9 文档风格整改执行日志（doc-style-remediation-log）

> **Source**：`doc-style-standard.md`（唯一正源）、`doc-style-remediation-plan.md`（方案与验收）、`markdown-reorg-framework.md`（体系梳理）
> **范围**：`docs/` 全部 695 份 `.md`（含 `archive/`、`deprecated-docs/`）

---

## 一、执行总览

| 阶段 | 工具 | 关键结果 |
|------|------|----------|
| P1 元数据/署名/术语 | `scripts/docs-tool/normalize-style.mjs` | 中文键→英文 336；署名→枚举 7；术语 数据定义→数据字典 / 部件→组件 102 |
| P2 emoji/日期 | 同上脚本 | 标题装饰 emoji 清理 68；日期格式归一 5 |
| P3 风格门禁 | `scripts/docs-tool/style-lint.ts` | 实现 §9 全部检查项；接入 `doc:proofread`(style 维度) 与 `doc:gate`(检查 #7) |
| 收尾修复 | 针对性脚本 | 9 个归档/废弃文件重复 frontmatter 补折叠；1 处署名 `架构资产治理官`→`v9-arch-team` |

**验证结论**：`npm run doc:gate` **7/7 通过**（风格检查 warning 级）；`normalize-style.mjs --dry` 幂等归零；`style-lint` 仅剩 `heading-skip` 168 项 warning。

---

## 二、P1/P2 归一化明细（normalize-style.mjs）

### 安全设计
- 严格跳过 fenced code block（```` ``` ```` / `~~~`）
- 保留原文件 EOL（CRLF/LF 不强制转换，避免全量 diff 膨胀）
- 治理元文档整体跳过（避免破坏规则示例表述）：`doc-style-standard.md`、`doc-style-remediation-plan.md`、`markdown-reorg-framework.md`、`agent-app-docs-classification.md`、`hybrid-proofread-contract.md`、`doc-proofreading-strategy.md`
- 术语替换额外跳过 `archive/`、`deprecated-docs/`（历史冻结）
- 日期归一跳过含 `http` 的行（防误改 URL 路径）

### 变换规则与实测计数
| 规则 | 说明 | 命中数 |
|------|------|--------|
| T1 中文键→英文 | `版本/日期/校对人员/执行人/报告生成人/...` → `Version/Date/Proofreader/Generator/Source`（精确键白名单，值完整保留） | 336 |
| T2 署名→枚举 | `Proofreader`/`Generator` 键值：AI 辅助开发流程→workbuddy、Kimi Code CLI→kimi 等 | 7 |
| T3 装饰 emoji | 标题首部装饰 emoji（📊📋📝🔶…）剥离，状态 emoji（✅⚠️❌🔴🟡🟢⭐）保留 | 68 |
| T4 日期归一 | `YYYY年M月D日` / `YYYY/MM/DD` / `YYYY.MM.DD` → `YYYY-MM-DD` | 5 |
| T5 术语替换 | `数据定义`→`数据字典`、`部件`→`组件`（仅正文，不动代码标识符/文件名） | 102 |

### 预演期拦截的重大 bug（已修复）
1. **T1 值丢失**：初版正则仅捕获键与冒号，重建时丢了值（`> **报告生成时间**：2026-07-12` → `> **Date**：`）。修正为捕获值组并重建补回。dry-run 比对确认 0 丢值。
2. **T1 贪婪误映射**：`校对轮次`/`校对依据` 被误映射成 `Proofreader`。改为精确键白名单。
3. **T2 灾难性切分**：初版触发过宽（含"校对/生成/工具"的任意正文行）+ 按 `/` `、` 切分，把 `ls/find/du`、路径 `工具/IDE` 改成 `|` 垃圾。改为仅对 `Proofreader`/`Generator` 键值做整值/枚举（`、,|；;`）映射。

---

## 三、P3 风格门禁（style-lint.ts）

### 检查项（doc-style-standard.md §9）
`duplicate-frontmatter` / `chinese-frontmatter-key` / `chinese-meta-key` / `unnormalized-author` / `term-violation` / `date-format` / `emoji-heading` / `heading-skip`

### 当前基线（2026-07-16 复检）
| 规则 | 数量 | 处置 |
|------|------|------|
| duplicate-frontmatter | 0 | ✅（归档 9 处已补折叠） |
| chinese-frontmatter-key | 0 | ✅ |
| chinese-meta-key | 0 | ✅ |
| unnormalized-author | 0 | ✅（1 处已修） |
| term-violation | 0 | ✅ |
| date-format | 0 | ✅ |
| emoji-heading | 0 | ✅ |
| heading-skip | 168 | ⚠️ warning 级，待人工清理（不阻断） |

### 门禁接入
- `doc:proofread`：导入 `runStyleChecks()`，新增 `[style]` 输出行（warning 级，不影响 XREF 退出码）。
- `doc:gate`：新增第 7 项「文档风格」检查，调用 `style-lint.ts --json`；当前 warning 级（退出 0），`backlog` 清理后翻 `blocking`。
- `style-lint.ts` 的 `main()` 已加 `import.meta.url` 守卫，被 import 时不触发 CLI 副作用。

---

## 四、复跑与回滚

```bash
# 预演（不改盘，输出 JSON 报告到 scripts/docs/reports/style-normalize/）
node scripts/docs-tool/normalize-style.mjs --dry

# 真实执行
node scripts/docs-tool/normalize-style.mjs

# 风格合规检查（warning 级）
node node_modules/tsx/dist/cli.mjs scripts/docs-tool/style-lint.ts

# 门禁全量（应 7/7 通过）
node node_modules/tsx/dist/cli.mjs scripts/doc-gatekeeper.ts
```

> **未提交**：本批改动均未 `git commit`（分支 `refactor/pr-6-module-split` 已有他人 WIP）。可经 `git diff -- docs/` 复核，单文件可 `git checkout -- <file>` 回滚。
