---
title: 增强提示词：多源信息合并去重（最新优先 / 冲突覆盖）
type: meta
domain: ai
phase: development
tier: standard
status: active
maintainer: V9 Architecture Team
summary: "用途：将多个数据源（同名或同主题文件）的信息合并为一份去重且完整的产物。 适用场景：同名 `../reference/data-definition.md`、重复..."
tags: [meta, documentation, prompt, optimization, ai]
version: v1.0.0
last_updated: 2026-07-17
code_version: 2.0.0
doc_id: V9-DOC-AI-032
change_log:
  - version: v1.0.0
changes: Initial version established
date: 2026-07-17
---

# 增强提示词：多源信息合并去重（最新优先 / 冲突覆盖）

> **用途**：将多个数据源（同名或同主题文件）的信息合并为一份去重且完整的产物。
> **适用场景**：同名 `../reference/data-definition.md`、重复 spec、散落的检索日志/内部资料、多版本文档收敛。
> **设计原则**：先核对事实再动手；可逆操作优先（`mv` 而非 `rm`）；不绕过任何门禁；合并后可审计。

---

## 一、增强版提示词（可直接复制到 AI IDE / TRAE / Cursor / Claude Code）

```
将多个数据源中的信息进行合并处理，确保所有最新、最完整的信息被保留，
同时对各数据源之间重叠或共享的部分进行去重操作，避免信息冗余。
在合并过程中，优先保留时间戳最新或内容最完整的记录，
对于冲突字段采用最新数据覆盖策略，最终输出一份去重后且信息完整的合并结果。

执行约束（必遵循）：
1. 事实优先：先用 find/git/stat 等命令定位全部同名/同主题文件，核对 mtime 与大小，
   禁止仅凭文件名判断“重复”——同名可能分属不同模块（如交易/采集/Widget）。
2. 内容比对：对共享/重叠部分做逐字段比对，区分“真重复”与“同名异义”。
3. 基准选取：时间戳最新者优先；若字段集互补则各取完整；冲突字段以最新数据覆盖，
   并在产物中记录冲突解决策略与依据。
4. 去重不丢信息：仅去除真正冗余的重复定义，保留每个数据源的专有内容。
5. 落位规范：合并产物放入最合适目录（如数据字典统一归 docs/standards/），
   更新索引并移除/改指针旧源文件（tracked 用 git rm，untracked 用 rm，内容已全量并入）。
6. 门禁校验：合并后运行 audit:docs / audit-path-match --enforce（若有），
   0 违规方可交付；不绕过任何既有门禁。
7. 可追溯：在产物中写入“来源对照表 + 冲突解决策略 + 变更记录”，使合并可审计。
```

---

## 二、结构化执行清单（四阶段）

### 阶段 1 · 定位与核对（事实优先）
- [ ] `find . -name "<同名>.md" -not -path "*/node_modules/*" -printf "%p | %s | %TY-%Tm-%Td %TH:%TM\n"`
- [ ] 逐份 `Read` 全文，识别**模块归属**（同名≠同内容）
- [ ] `git ls-files` / `git status` 确认 tracked / untracked
- [ ] 记录：文件清单 + mtime + 大小 + 模块角色

### 阶段 2 · 比对与策略
- [ ] 对共享/重叠部分**逐字段比对**，产出冲突矩阵
- [ ] 判定每类重叠：真重复 / 同名异义 / 互补字段
- [ ] 选定基准：mtime 最新 ＞ 内容最完整 ＞ 约定上游
- [ ] 明确冲突字段处理（最新覆盖 / 上游优先），写入策略表

### 阶段 3 · 合并产出
- [ ] 新建唯一主文件（SSOT）于最合适目录
- [ ] 分区保留各模块**全部**内容；共享部分定义 1 次 + 引用接入
- [ ] 写入：来源对照表 + 冲突解决策略 + 变更记录（审计轨迹）
- [ ] 更新索引（如 `../reference/data-dictionary-index.md`）指向主文件
- [ ] 移除旧源（tracked→`git rm`，untracked→`rm`）

### 阶段 4 · 校验与归档
- [ ] `npm run audit:docs` → 0 违规
- [ ] `node scripts/audit-path-match.mjs --enforce` → 0 违规（若已建）
- [ ] 更新 CHANGELOG 与当日 memory 日志
- [ ] 交付主文件 + 索引

---

## 三、本项目实战样例（V9 §二十三）

| 项 | 内容 |
|----|------|
| 源 | 3 份同名 `../reference/data-definition.md`：交易持仓(07-08) / 数据采集(07-08) / Cockpit Widget(07-06) |
| 发现 | 同名异义（3 模块）；仅 B∩C 共享采集类型为真重复（v1.2.0 一致） |
| 基准 | 采集类型以 07-08（模块 B）为准；C 引用 |
| 产物 | `../reference/data-definition.md`（v2.0.0，1202 行） |
| 去重 | 3→1；共享类型定义 1 次 |
| 门禁 | audit:docs 0 / audit-path-match 0 |
| 遗留 | 7 份域数据字典（`AI_CENTER_` 等）保持独立由索引登记，未并入 |

> 该提示词与 `docs/00-meta/prompt-execute-remediation.md`（P0–P2 执行元提示词）配套使用：
> 先以本提示词完成单类合并，再纳入整体整改的优先级编排。
