---
skill_id: V9-SKILL-HEALTH-AUDIT
name: "health-audit"
description: "健康度复检与状态自洽审计：用实时工具（git/tsc/vitest/automation list）复验进度与健康度，杜绝采信记忆/治理文档导致的假绿灯/假红灯/状态失准，输出评分雷达与行业对标。Invoke when 二次开发前体检、用户要求'再次检查进度和健康度'、门禁回归定位、或文档 vs 现实矛盾核对时。"
version: v1.0.0
last_updated: 2026-08-23
change_log:
  - version: v1.0.0
    changes: "基于 S 级 Skill 5 段式骨架模板 [_SKILL-TEMPLATE.md](.agents/skills/_SKILL-TEMPLATE.md) 物理化迁移：自用户级 ~/.trae-cn/skills/v9-health-audit 归位（2026-07-23 真实复检结晶）"
    date: 2026-08-23
mandatory: false
---

# 健康度复检与状态自洽审计 — v1.0.0

> 目的：在二次开发/复检/对标时，给出**经实时工具复验**的进度、健康度、评分。
> 实证：2026-07-23 复检中，MEMORY.md 与治理文档同时声称 `tsc:prod=0 错误`、`9 条 ACTIVE 自动化`，
> 实时复验发现 tsc:prod 实际 EXIT=2/27 错误、自动化仅 3 条真正注册。

---

## 一、触发条件

- **显式触发**：「健康度」「进度检查」「健康度复检」「二次开发」「门禁体检」「状态校验」「文档 vs 现实」「假绿灯」「假红灯」「行业对标」
- **文件信号**：`outputs/dev-health-review-*.md`、`docs/reports/project-management/development-lessons-learned.md`
- **事件触发**：二次开发前、门禁回归定位、状态漂移核查

**不触发场景**：纯诊断已完成只要分数（直接出报告）；仅改单一测试文件（走 `tsc-test-error-diagnosis`）；涉及 databridge/ACL 数据流（走 `data-flow-integrity-audit`，mandatory）。

**协作 Skill**：`bash-conventions`（命令规范）、`tsc-gate-scope-audit`（tsc 门禁诊断）。

---

## 二、前置检查

| # | 检查项 | 方法 | 通过标准 |
|---|--------|-----|---------|
| 1 | 实时工具可用性 | node / git / vitest 版本确认 | 系统 Node24 直驱（受管 Node22 可能 worker 崩溃） |
| 2 | 退出码捕获方式 | `cmd > log 2>&1; echo EXIT=$?` | **禁止 `| tail` 掩盖退出码** |
| 3 | 基线文档线索 | 收集 MEMORY/治理文档声称的状态数字 | 仅作线索，不作证据 |

---

## 三、阶段化 SOP

### 核心铁律

**实时工具优先于记忆。** 任何状态类事实（自动化条数、门禁是否通过、分支、测试失败数）下结论前必须用工具实时查；记忆/治理文档文字仅作线索。绝对禁止：直接把记忆里的数字当"当前真实状态"；用 `cmd | tail` 跑门禁；用"记忆里说 N 条"反推现状。

### 按序检测法（D1–D7，顺序即纪律）

| # | 检测 | 命令/做法 | 关键点 |
|---|------|----------|--------|
| D1 | git 真实状态 | `git rev-parse --abbrev-ref HEAD` / `git log --oneline -5` / `git status --short | wc -l` | 大量脏文件≠坏 |
| D2 | tsc:prod 真实退出码 | `node ./node_modules/typescript/bin/tsc -p tsconfig.prod.json --noEmit > log 2>&1; echo EXIT=$?` | 必须看退出码不是看输出；系统 Node24 直驱 |
| D3 | 门禁清单+实跑 | 列 `package.json` 的 audit/tsc/test 脚本，实跑关键门禁 | 实跑退出码 = 0 才算绿 |
| D4 | 自动化注册真实条数 | `automation_update list`（SoT = 工具，非记忆） | 与文档声称条数比对，差异即漂移 |
| D5 | 测试基线 | 争议文件直接实跑（分目录防爆） | 文档打架时实跑裁决 |
| D6 | 文档 vs 现实矛盾扫描 | Grep 治理文档中的状态数字 ↔ 工具输出对照 | 每个矛盾记录 `文档声称 X @ file:line vs 工具实测 Y` |
| D7 | CI 真实性核查 | `ls .github/workflows/` + 校验 `run:` 引用的 `.sh/.ps1` 存在性 | 引用脚本缺失 = 假绿灯；勿直接下"无 CI"结论 |

### 检测方法库（可跨项目复用）

| # | 方法 | 何时用 |
|---|------|--------|
| M1 | 实时工具优先 | 任何状态事实 |
| M2 | 真实退出码捕获（禁 `| tail`） | 跑门禁/类型检查 |
| M3 | 争议文件直跑 | 文档对测试数打架 |
| M4 | 文档 vs 现实矛盾扫描 | 校准治理文档 |
| M5 | 分目录批量 vitest + 系统 Node24 | 全量崩 worker |
| M6 | 自动化 SoT 校验 | 定时任务盘点 |
| M7 | 类型回归根因定位（按 `widened literal` / `possibly undefined` 归类） | tsc:prod RED |
| M8 | CI 真实性核查 | 报告"无 CI"/门禁可信度 |
| M9 | 失败测试四归类（断言漂移/严格空检/真缺陷/环境 flaky）+ 最小修复 | 复检测试基线 |

### 失败测试分类诊断 SOP（D5 RED 时）

1. **断言漂移**：源码字段/行为已变且一致有意 → 改测试对齐源码，不动源码
2. **严格空检/拓宽**：改源码类型注解或可选链 `?.`
3. **真实缺陷**：修源码并复跑关联测试
4. **环境/flaky**：Node21+ `vi.stubGlobal('fetch')` 静默失效 → 改 `Object.defineProperty(globalThis,'fetch',{configurable:true,writable:true})`；计时类单独实跑验证 pass 即可

关键坑：同一 service 可能在 `src/` 与 `tests/` 各有一份测试，两份都要核对；外部端点下线 → 测试改断言返回 `[]`，不模拟已失效端点。

### 交付前文档校准

修复/复检后以实时工具为准更新 `.workbuddy/memory/MEMORY.md` 与 `development-lessons-learned.md`。原则：文档写"实测 EXIT=0"可以；写"据记忆应为 0"不行。

### 行业对标（八维评分框架）

架构分层 / 质量门禁 / 设计令牌 / 测试 / AI 治理 / 文档 / CI-CD / 状态自洽，各维对照行业领先实践打分（2026-07 基线综合 67/100（B-），短板在 CI/CD 与状态自洽——恰是"假绿灯"温床）。re-pull 锚点：`DORA metrics elite performers`、`design tokens single source of truth Salesforce Lightning IBM Carbon`、`spec-driven development AI coding agents`。趋势警示：AI Velocity Paradox（瓶颈从写代码移到评审/验证/部署）。

---

## 四、陷阱与经验教训

| # | 陷阱 | 后果 | 规避 |
|---|------|-----|-----|
| 1 | 直接采信记忆/治理文档数字 | 状态失准、假绿灯 | 实时工具复验，文档仅线索 |
| 2 | `| tail` 吞退出码 | RED 误判为 GREEN | `> log 2>&1; echo EXIT=$?` |
| 3 | `import.meta.env.X || CONST` 拓宽字面量类型 | tsc 26 错同源 | 局部类型别名 + 常量注解，不动被依赖导出符号 |
| 4 | 全量 vitest 在受管 Node22 崩 worker | 测试基线误判 | 分目录 + 系统 Node24 |
| 5 | 声称注册 N 条自动化 ≠ 真实注册 | 运维盘点失真 | `automation_update list` 为准 |
| 6 | 报告"无 CI"未先 ls workflows | 误判 | 先 `ls .github/workflows/` |
| 7 | CI `run:` 引用的脚本不存在 | 类型门禁从未真正校验 | 逐引用校验文件存在性 |

---

## 五、完成交付物清单

| # | 交付物 | 存在位置 | 验证方法 |
|---|--------|---------|---------|
| 1 | 复检报告 `outputs/dev-health-review-YYYY-MM-DD.md` | outputs/ | 含综合评分 + 三大核心发现（实时复验证据）+ 八维评分表 + 行业对标 + P0/P1 建议 |
| 2 | 评分雷达（8 维 SVG） | 报告附件 | 可视化存在 |
| 3 | 文档校准（状态数字以实测为准） | MEMORY / lessons-learned | 无"据记忆"表述 |
| 4 | 关键门禁真实退出码记录 | 报告内 | 每项有 EXIT=N 证据 |
