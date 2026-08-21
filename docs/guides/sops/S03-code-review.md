---
title: S03 · 代码审查（Code Review）SOP
type: how-to
domain: qa
phase: testing
tier: reference
status: active
maintainer: V9 Architecture Team
summary: "PR 模板 8 字段清单（≥ 6）；3 轮次 Review 检查矩阵（快速审 25 项 / 深度审 20 项 / 架构师复签 10 项）；单模块准入引用 module-completion-standard.md 并补 gap-2：跨模块 Review 时如何快速定位「被调用方契约变更」。"
tags: [sop, code-review, pr-template, review-checklist, cross-module-impact]
version: v1.0.0
last_updated: 2026-08-19
code_version: "2.0.0-rc.2"
doc_id: V9-DOC-SOP-003
related_docs:
  - V9-DOC-MOD-STD      # module-completion-standard.md
  - V9-DOC-GIT-001      # git-commit-governance.md（提交规范引用）
  - V9-DOC-QA-065       # 09-quality-gates.md（门禁引用）
referenced_by: [V9-DOC-SOP-004]
change_log:
  - version: v1.0.0
    changes: "Initial version：固化 PR 模板 8 字段、3 轮 Review 检查矩阵（55+ 条目）、引用模块完成度标准 + 补 gap-2 跨模块契约变更定位法。"
    date: 2026-08-19
---

# S03 · 代码审查（Code Review）SOP

> **编号**：S03 · **适用场景**：开发者将 `feature/*` / `bugfix/*` / `hotfix/*` 分支向 develop / release / main 发起 Pull Request 后的 Code Review 全流程。  
> **执行角色**：PR Owner（发起者） + 2 名 Reviewer（同域 + 跨域各 1 名）；≥ P0 改动须 3 名 Reviewer（额外 +1 架构师）。  
> **预计耗时**：小 PR ≤ 30 分钟；中 PR 1–2 小时；大 PR（> 400 LOC 或跨模块）分批次 2–3 次 review 完成。  
> **规范等级**：🟧 强约束（T2）。**少于 2 Approvals 的 PR 禁止合入**；Branch Protection 设 Required reviewers = 2 兜底。

---

## 参考文档与缺口补充声明

| # | 文档 | 引用/补充说明 |
|---|------|--------------|
| 1 | [模块完成度标准](../module-completion-standard.md) | 单模块准入条件清单原文（§2 S1~S12）被本文 §一 PC-2 引用；§4 Fix-2 **补充 gap-2**：跨模块 Review 时，原文档 §5 仅列出模块内检查项，未描述「调用方 Reviewer 如何快速识别被调用模块的契约改变点」，本文 Fix-2 提供 3 步标准化定位法。 |
| 2 | [Git 提交治理规范](../how-to/git-commit-governance.md) | §二 2.A Conventional 消息格式引用；Scope 列表引用。 |
| 3 | [质量门禁标准](../09-quality-gates.md) §Husky v2 scope-guard | §二 2.B 检查矩阵条目与门禁阈值对齐。 |

---

## 一、前置条件（PR Owner 在提交 PR 前自检）

| # | 条件 | 验证方法 |
|---|------|---------|
| PC-1 | PR 分支命名符合 [S02 §2.A 7 型分支](./S02-dev-workflow.md#2a--分支策略7-种分支类型--worktree-并行--squash-merge-三规则)（`feature/bugfix/hotfix/docs/refactor` + scope + 简述） | PR 标题行第一部分匹配模板 |
| PC-2 | **单模块准入满足**：本次 PR 涉及的核心模块均通过 [模块完成度标准](../module-completion-standard.md) §2 的 12 项清单（S1 语义→S12 用户验证） | `npm run audit:module-completion -- --scope <受影响模块>` 辅助 + 人工勾选 |
| PC-3 | **本地 pre-push 6 步全通过**（`层 硬 僵 密 型 测`）；`git push` 已成功（禁止在 GitHub Web 上直接编辑文件后裸发 PR，除非文档 typo 级 ≤ 5 行） | 查看终端 push 成功输出 |
| PC-4 | PR 描述已填完整 §二 2.A 模板（8 字段，见下）；含截图 / 录屏（UI 改动时必须）；附 Before/After 代码片段（性能改动时必须） | GitHub PR 页 Body 非空、字段齐全 |
| PC-5 | CI Pipeline 首次运行至少已**启动**（绿或红均可，但必须有 run id）；CI 全红说明 push 前门禁没跑通，打回 S02 §2.C 修复 | Actions 页可见至少 1 run |

---

## 二、操作步骤

### 2.A · PR 模板 8 字段清单（🟥 FR-7 ≥ 6 个字段，实际 8）

> 仓库根目录 `PULL_REQUEST_TEMPLATE.md`（或 `.github/PULL_REQUEST_TEMPLATE.md`）必须配好以下 8 字段，否则 PR 打开时打回重填。

| # | 字段名（Markdown 二级标题） | 填写示例 | 校验点 |
|---|--------------------------|---------|--------|
| 1 | **🎯 变更类型**（Type of Change） | `[x] Bug fix (non-breaking change which fixes an issue)` | 至少勾选 1 项；feat+fix 混合时建议拆 PR |
| 2 | **📝 变更摘要**（Summary） | `修复 V6 评分引擎在 ST 股上的评分归一化溢出 bug (#TCK-3421)，新增 2 条边界测试` | ≤ 3 行中文；含 Issue/Task 关联 ID |
| 3 | **🧩 影响范围**（Affected Modules / Scopes） | `scoring: L-5 财务估值层 · dataLayer: STOCKS schema v35 新增字段 ` | 必须与 commit scope 一致；跨模块需列出全部 |
| 4 | **🔬 测试覆盖**（Testing） | `npm run test:stable：V6 相关 312 条 + 新增 2 条 = 314/314；E2E lite 11/11；手动：截图展示修复前后分差` | 自动化命令 + 手动验证均列出 |
| 5 | **📑 相关文档**（Related Docs） | `docs/guides/sops/S05-pre-launch-checklist.md §4.B 25 股票清单已同步更新` / `docs/reports/pre-launch/2026-08-19_v2.0.0-rc.2/06-scorecard.md` | 文档 PR 合并进同一 PR 或附 link |
| 6 | **⚠️ 风险评估**（Risk Assessment · Low/Medium/High） | `Medium：影响范围仅 ST 股样本（<3% 代码），但归一化溢出可能连带 L-8 技术筹码分析` | P0 级功能标 High；并在 §下方加「架构师强制复签」标签 |
| 7 | **🧪 截图 / 录屏**（Screenshots · UI/交互类必填） | （左侧 Before 截图，右侧 After 截图，对比表格） | UI PR 缺此 = BLOCK |
| 8 | **✅ PR Owner 自检清单**（Self-Check） | `[x] Conventional 规范消息；[x] 本地 pre-commit 22 步全 BLOCK=0；[x] 无新增 `any` / `@ts-ignore`；[x] 新增 JSDoc 覆盖公开方法` | 4 项全勾选 = 通过 |

### 2.B · 三层次 Review 检查矩阵（合计 55+ 项）

#### 第一轮 — 快速初审（R1 · 同域 Reviewer · ≤ 25 项 · 目标 30 分钟内完成）

| 类别 | 检查项（1/2/3 = Low/Mid/High 优先级） | 检查方式 |
|------|------------------------------------|---------|
| **合规 C** | C1 Conventional 提交规范（scope/type/format） ✅ **2** | git log --oneline PR..HEAD |
|  | C2 未引入 `any` / `@ts-ignore` / eslint-disable ❌ **3** | `grep -n "any\|@ts-ignore\|eslint-disable" src/...` diff 增量区 |
|  | C3 无硬编码颜色 HEX / RGB（按 lint:colors） ✅ **2** | GitHub diff 中直接搜 |
|  | C4 secrets 明文（API Key / Token / 私钥） ❌ **3** | diff 扫描 + 已知模式（`AKIA...` / `sk-...` / `-----BEGIN`） |
|  | C5 注释 / JSDoc 新增量 ≥ 20% 的新方法 ✅ **1** | LOC 对比 |
| **安全 S** | S1 输入 XSS 防护：用户输入进 innerHTML 前走 xssSanitizer ✅ **3** | diff 中搜 `innerHTML` → 检查前一行 |
|  | S2 URL 参数注入风险：`window.open` 加 `noopener noreferrer` ✅ **2** | 搜关键词 |
|  | S3 SQL / shell 注入：动态构造字符串处需参数化 ✅ **3** | 搜 `` `SELECT `` / `exec(` |
|  | S4 敏感字段不落日志：phone/idCard/password ❌ **3** | 搜 `console\.(log|info|debug)` 附近 |
|  | S5 IndexedDB 敏感字段：用户身份 token 需透明加密 ✅ **2** | DB schema diff |
| **性能 P** | P1 无新增 `n²` 循环：大数据列表无 Array.find 内再 Array.some ❌ **2** | for 循环嵌套检查 |
|  | P2 大模块 lazy：`import('./charts')` 动态 ✅ **2** | 新增 import 语句 |
|  | P3 React.memo / useMemo 高频重渲染组件补 ✅ **1** | 经验判断 |
|  | P4 首屏图片 ≤ 300KB，大于走 webp + 懒加载 ✅ **2** | 资源体积 |
|  | P5 Bundle 体积监控：主 chunk ≤ 6MB、preload ≤ 200KB ✅ **2** | 构建体积报告 diff |
| **质量 Q** | Q1 test:stable 通过率 ≥ 99.2% 对 diff 范围 ✅ **3** | CI 报告核对 |
|  | Q2 边界 Case：null/undefined/空数组/负数/超长字符串 ✅ **2** | 测试代码检查 |
|  | Q3 无新增 `console.log` 留在代码（临时 debug 遗留） ✅ **1** | 搜关键词 |
|  | Q4 error boundary 覆盖：异常路由不白屏 ✅ **2** | 手动或 E2E 注入错误 |
|  | Q5 国际化：UI 中文文案均从 i18n 取 ❌ **2** | `"裸中文"` 搜索（限 UI） |
| **数据 D** | D1 DataBridge 通路：无新的 core/ 直调 dataLayer ✅ **3** | diff 中搜 `dataLayer\.` 排除测试 |
|  | D2 ENVELOPE_ACTION 新动作已在 ACTION_TO_STORE_MAP 注册 ✅ **3** | grep 两边数量对比 |
|  | D3 ACL 矩阵：新增 action 已补 actions.acl.ts 缺项 ✅ **3** | ACL diff 行数 |
|  | D4 MCP Server 变更已同步 Registry + Agent 配置 ✅ **2** | Registry 文件 diff |
|  | D5 DB schema 变更：migration 脚本存在 + DB_VERSION +1 ✅ **3** | schema + DB_VERSION 双重核对 |

#### 第二轮 — 深度二审（R2 · 跨域 Reviewer · ≈ 20 项 · 架构/设计层面）

| 类别 | 检查项 | 方式 |
|------|-------|------|
| 架构分层 | A1 依赖方向：pages↘components↘services↘core↘lib，无反向 ✅ 3 | 依赖图（madge --image） |
|  | A2 原子设计边界：atoms 不引 organisms ✅ 2 | audit:atomic 输出 |
|  | A3 事件监听清理：useEffect 返回 cleanup、组件 unmount 清理订阅 ✅ 3 | React hooks diff |
| 领域模型 | D6 贫血模型风险：新 Entity 是否只有 getter/setter，无行为方法？ ⚠ 1 | 代码结构 |
|  | D7 防腐层（ACL）：外部 API/DB/WS 的数据转换不在组件层 ✅ 3 | services vs components 边界 |
|  | D8 枚举值不重复：新增状态枚举与现有常量无冲突 ✅ 2 | `v9-constant-migration` 辅助 |
| 接口契约 | I1 TypeScript 契约不变：公开方法 return type / 参数列表未 silently 变 ✅ 3 | `.d.ts` diff 或导出类型对比 |
|  | I2 破坏性变更标记 BREAKING CHANGE footer：是则必 bump MAJOR ✅ 3 | commit message footer |
|  | I3 默认参数变化：有默认值的参数从 undefined→具体值可能改变语义 ✅ 2 | 默认值 diff |
| 错误处理 | E1 未捕获 Promise：新增 async/await 处无 try/catch 也无 .catch ❌ 3 | grep `await` 邻近 |
|  | E2 Sentry captureException：P0 路径上报 stack ✅ 2 | Error boundary diff |
|  | E3 重试 / 幂等：HTTP POST / 写操作失败是否重试 ✅ 2 | 写通路 |
| 可测性 | T1 新代码的依赖可注入：new XXX() 改为构造函数参数或工厂注入 ✅ 1 | 依赖创建点 |
|  | T2 公共函数 ≥ 3 条测试（正向/反向/边界） ✅ 2 | tests 目录新增文件检查 |
|  | T3 Quarantine 不新增：失败 Case 不直接扔 quarantine ❌ 2 | tests/quarantine.list diff（=0） |
| 可维护性 | M1 单函数 ≤ 80 LOC（超出需架构师说明） ✅ 1 | diff 行数 |
|  | M2 命名遵循领域词典：新增命名与 docs/domain-glossary 一致 ✅ 1 | 交叉核对 |
|  | M3 无「TODO 无 owner / 无日期」遗留 ✅ 1 | grep `TODO` 未带 owner |
|  | M4 变更日志 CHANGELOG.md / changelog.d/ 已同步 ✅ 2 | 检查文件 |
|  | M5 docs/ 对应文档更新：功能新增 / 废弃均同步更新 ✅ 2 | docs/ diff |

#### 第三轮 — 架构师复签（R3 · 仅 P0 或 High Risk · ≈ 10 项）

1. ✅ 3 分层依赖图整体未违反（A1 确认）
2. ✅ DB_VERSION 变动是否伴随全量 migration 测试
3. ✅ 性能基线（complexity-scan vs baseline）是否不增
4. ✅ 跨模块契约变更（§4 Fix-2 定位）是否已在 PR 描述列出
5. ✅ 安全红线（S1-S5 全部 0 违规 × 3 人 double-check）
6. ✅ RAG 幻觉门禁（RAG=涉及的 PR）通过率 ≥ 99%
7. ✅ 设计令牌系统与设计稿（Figma）diff 是否经设计 Reviewer 签字
8. ✅ 真数 / Mock 策略：上线相关 PR 确认无 Mock 残留
9. ✅ 发布窗口检查：当前日期是否在 release freeze 后 24h 已解封
10. ✅ 回滚预案：若本次变更引入新 Flag 机制，回滚时 Flag 的关闭行为已验证

### 2.C · 跨模块被调用方契约变更定位法（gap-2 · 嵌入 R2 A7 / I1 辅助）

> 以下 3 步在跨模块 Review 时自动执行（**module-completion-standard.md §5 原文 gap-2 未覆盖**，此处补充，在 §4 Fix-2 展开失败修复）

```powershell
# Step 1 — 从 PR diff 提取所有导出类型变动
git diff origin/main...HEAD -- 'src/**/*.ts' 'src/**/*.tsx' | Select-String -Pattern '^\+export (interface|type|enum|function|class|const) '

# Step 2 — 全仓 Grep 反向引用（被哪些其他模块 import 了）
$ExportsChanged = @("ScoringResult", "useV6Score")   # 从 Step 1 挑高风险名字
foreach ($sym in $ExportsChanged) {
  Write-Output "=== 符号 $sym 跨模块引用清单 ==="
  Grep -rn "from.*scoring.*$sym|import.*$sym.*from.*scoring" src/
}

# Step 3 — 对每个跨模块调用方，输出「调用前后」类型契约比对（如参数由 ScoringInputV1→V2）
# 自动检查：所有调用方的传参是否仍匹配新签名（调用方若未同步更新即 BLOCK）
```

**通过标准（gap-2 自动化）**：Step 2 输出的每个 import 行所在模块，在 Step 3 中均无签名不匹配错误（可用 tsc:prod 间接验证，或使用专用脚本 `npm run audit:cross-module-contracts`）。

---

## 三、通过标准

| 层级 | 条件 | 失败级别 |
|------|------|---------|
| PR 模板 | 8 字段完整，至少 6 字段非空（仅允许「截图 / 录屏」非 UI 类 N/A） | BLOCK |
| R1 快速初审 25 项 | 所有 3 级项 = 0 违规；2 级项 ≤ 2；1 级项 ≤ 5 | BLOCK（3 级任何 1 项 = 不通过） |
| R2 深度二审 20 项 | 3 级项 = 0；2 级项 ≤ 3；1 级项 ≤ 6 | BLOCK |
| R3 架构师复签（条件触发） | P0 / High Risk PR：10 项全通过 | BLOCK |
| **最终结论** | R1 Approve + R2 Approve（双签）+ 若需 R3 Approve → **Approve**；否则 Request Changes / Comment | — |

**Review SLA**：R1 在 PR 打开后 4 工作小时内响应；R2 在 R1 通过后 8 工作小时内响应。超时可 @ 指定替补 Reviewer。

---

## 四、常见失败与修复（Top 5 · 含模块标准 gap-2 补充）

| # | 失败典型（Review 打回场景） | 根因 | 修复 | 对应文档 / SKILL |
|---|-------------------------|------|------|-----------------|
| Fix-1 | **PR 模板缺字段**（Screenshots 非 UI 可空；其余 7 字段任一字段为空） | 新成员首次提 PR，没看模板 | 提供 PR 模板的 link；让 Owner 用「Edit」按钮补 8 字段后 re-request review | 治理 §2.A 引用 |
| Fix-2 | **跨模块契约变更未同步**（scoring 改了 ScoringResult 类型，dashboard 模块未更新，tsc:prod 会报错）— module-completion-standard **gap-2** | R2 跨域 Reviewer 未发现 | **3 步标准化定位法**（与 §2.C 对应，失败时的修复路径）：<br>1. `npm run audit:cross-module-contracts -- <模块A>,<模块B>` 自动生成不匹配清单<br>2. 对每个不匹配：要么「调用方同步改传参」（推荐）；要么「导出方补兼容 Overload」<br>3. 改完后 `tsc:prod` exit 0 并重新提交 commit + 请求 re-review | 🔺 gap-2 补充 |
| Fix-3 | **any 引入 + @ts-ignore**（R1-C2 检测到 1 处） | 赶工跳过严格类型 | **修复**：any 改为 `unknown + narrow`；`@ts-ignore` 改为 `@ts-expect-error` + 注释原因 + `TODO` 跟进 ticket | `type-safety-contract` SKILL（6 步） |
| Fix-4 | **DataBridge 通路违规**（R1-D1 检测到 `pages/x.tsx` 直调 `dataLayer.orders`） | 新模块开发者对分层规则不熟悉 | **修复**：按 `v9-databridge-migration` SKILL 的流程，先写 ENVELOPE_ACTION → ACTION_TO_STORE_MAP → Handler → 再把直调改为 `DataBridge.forward()` | v9-databridge-migration |
| Fix-5 | **Quarantine 新增 2 条**（R2-T3 检测到） | 开发人员偷懒，把自己写的失败测试直接扔 quarantine 而不是修 | **修复**：`git revert <那个 commit>`，回滚 quarantine.list diff；本地修测试 + 重跑 test:stable 通过后再提；若确需隔离 → 提交 Quarantine Ticket，由 QA 双审后才允许加 | module-completion-standard §5.4 |

---

## 五、证据与归档

| # | 证据 | 命名 | 生成方式 |
|---|------|------|---------|
| E1 | 完整 PR 审查记录（GitHub Native 导出 Markdown） | `PR<num>-review-export.md` | 浏览器「Save PR Conversation As Markdown」或 `gh pr view <num> --comments` |
| E2 | R1/R2/R3 三位 Reviewer 的逐项打勾清单 | `PR<num>-<sha7>-review-checklist.md` | 用 §2.B 三项矩阵模板生成；每人最后一行写 `Approve / Request Changes / Comment` + 签名 + 日期 |
| E3 | 跨模块契约定位清单（若 PR 是跨模块的） | `PR<num>-cross-module-impact.json` | §2.C 三步脚本 tee 输出 |
| E4 | 最终合并 commit SHA（merge-squash-commit） | `PR<num>-merge-commit-sha.txt` | `git rev-parse HEAD` 在合入后执行 |

**归档目录**：`docs/reports/code-review/YYYY-MM-DD_PR<num>/`

---

## 六、阶段跳转

- **前置**：[S02 日常开发与提交](./S02-dev-workflow.md) Push 成功 + 本地 pre-push 6 步全通过
- **本阶段成功**：R1 + R2（+ R3）Approve 全齐 → 进入 [S04 合并前集成测试](./S04-pre-merge-integration.md)
- **本阶段失败**：Request Changes → 回到 S02 §2.B 修复后，重新执行本 SOP 从 PC-3 自检开始
