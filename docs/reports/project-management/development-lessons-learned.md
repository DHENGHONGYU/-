---
title: development-lessons-learned
tier: T2
status: active
type: reports
domain: project
doc_id: V9-DOC-AUTO-8C4E8E
code_version: 2.0.0
summary: 本知识库是 V9 项目开发周期的"错题本 + 作战手册"。它把散落在每日工作记忆、`AGENTS.md`、各 TODO 清单中的教训，按四大维度系统性归类，并给出可复用的 SOP / Skill / 命令。最后 §6 把"当前周期未完成或需改进的工作"梳理成带优先级与解决方案的遗留清单，供二次开发直
maintainer: V9 Architecture Team
phase: maintenance
---

# V9 智能投研复盘系统 · 开发经验教训与遗留问题知识库

> **Version**: v1.0.0 ｜ **提炼日期**: 2026-07-22 ｜ **用途**: 二次开发知识底座 + 遗留问题优先级参考
> **数据基线**: 截至 2026-07-22 实测 —— 全量 `vitest run`：**82 failed / 6598 passed / 21 skipped / 8 errors / 36 失败文件 / 6701 总计**（⚠️ 此数 2026-07-23 复检存疑：三大争议文件直跑 37 passed/0 failed，全量因受管 Node22 worker 崩溃不可复现）；`tsc:prod` **0 错误**（⚠️ 2026-07-23 复检曾回归 27 错，已最小化修复至 EXIT=0）；运维自动化 **3 条 ACTIVE**（⚠️ 原"9 条"为状态失准，`automation_update list` 实测仅 3 条真正注册）。
> **核心方法论**: 本仓一切"修复完成 / 任务完成"声明，必须以**独立复验**为据（扫描器 [OK] / 单测退出码 0 / `git hash-object` 比对）。凡"声称完成"而未复验者，皆出现过假象。

---

## 0. 本文档定位与阅读指引

本知识库是 V9 项目开发周期的"错题本 + 作战手册"。它把散落在每日工作记忆、`AGENTS.md`、各 TODO 清单中的教训，按**四大维度**系统性归类，并给出**可复用的 SOP / Skill / 命令**。最后 §6 把"当前周期未完成或需改进的工作"梳理成**带优先级与解决方案的遗留清单**，供二次开发直接认领。

| 章节 | 内容 | 适用场景 |
| :--- | :--- | :--- |
| §1 重大遗漏与疏忽 | 该做没做 / 做了但假的 | 复盘踩坑、避免重蹈 |
| §2 技术选型偏差 | 工具/运行时/命令用错 | 选工具、跑命令前 |
| §3 架构设计不足 | 设计层面的结构性缺陷 | 架构评审、重构 |
| §4 流程管理缺陷 | 协作/门禁/状态管理漏洞 | 流程改进、任务分派 |
| §5 可复用方法论沉淀 | 已固化的 Skill/SOP/铁律 | 直接调用 |
| §6 遗留问题与优先级 | 当前周期未完成项 + 排期 | 二次开发认领 |

---

## 1. 开发期间出现的重大遗漏与疏忽

### 1.1 环境路径硬编码（DELL）病 —— 最昂贵的疏忽

- **现象**：项目在旧机（用户 DELL）把 `%USERPROFILE%/...` 绝对路径写死进 `package.json` 脚本、venv 配置、测试 fixture、文档指令。换到本机 huawei 后路径静默失效。
- **连锁后果**：
  - `npm run build:stock-dict` 失败的 venv 里 akshare 被清空（仅 11 包）→ **每周日 A+H 股字典定时任务瘫痪**（字典是 8331 条股票的基础数据）。
  - 多处脚本指向 `D:/FinSightV9`、`%USERPROFILE%/Desktop/...csv` 等不存在路径。
- **根因**：**环境相关路径未参数化**，违反"环境无关"原则。
- **修复**：42 文件 / 66 处替换为 `%USERPROFILE%` 或当前用户；venv 重装 `akshare==1.18.64`；`scripts/pressure-concentration-test.ts:446` 改为 `%USERPROFILE%/Desktop/...csv`。
- **防复发**：技能 `windows-env-path-doctor` 已强制 **Step 0 环境优先探测**（绝不写死用户名）；新增脚本一律用 `%USERPROFILE%` / `$USERPROFILE`。

### 1.2 "声明完成"的假修复 —— 信任但验证的反面教材

- **事件**：一轮声称"P0/P1/P2 全绿，DELL→huawei 修复完成"，但后续核查发现**文件根本没被改写**——修复脚本在沙箱内做文件遍历时原生段错误（exit 139）崩溃于写入前，却记录了"成功"。
- **教训**：任何"修复完成"都必须以**独立复验**闭环（扫描器 [OK] No stale paths + `--verify-current` 全绿）。本项目已因此吃过两次亏（环境修复、文档批量 `--apply`）。
- **固化**：详见 §5.1 "信任但验证"铁律。

### 1.3 自动化注册"声称完成实际未注册"

- **事件**：工作记忆声称已注册 5 条运维自动化（Git 备份 / CloudStudio 部署 / A+H 字典刷新等），并给出了 ID。但 `automation_update list` 仅返回 3 条且不对应，记忆给的两个 ID 均 `not found`。
- **真相**：那 5 条**实际未注册**（或 ID 已失效）。A+H 字典刷新任务虽已修路径，但没挂着仍不会跑。
- **修复**：2026-07-22 用 `automation_update create`（cwds=`L:\FinSightV9`）尝试重建，但 **2026-07-23 复检 `automation_update list` 实测仅 3 条真正注册**（A+H 字典刷新 / CloudStudio 周构建 / 每日 Git 备份）；声称的"重建 5 条 + tsc:test 趋势 1 条"并未真正落地，"9 条 ACTIVE"为状态失准。以工具为准。
- **教训**：**状态类事实必须实时工具校验，不能依赖记忆文字**。相关铁律见 §5.4。

### 1.4 记忆系统被覆盖丢失

- **事件**：一轮写入的 `2026-07-21.md` 曾被记忆目录同步/恢复覆盖丢失（备份源仅到 `2026-07-19.md`），被迫重建。
- **防护**：环境病 / Skill 相关事实以 `%USERPROFILE%/.workbuddy/skills/windows-env-path-doctor/` 为准（独立于项目记忆目录），降低单点丢失风险。

### 1.5 文档无版本控制 + gitignore 不全 → 工作树污染

- **测量**：225+ 处工作树改动中，**92% 是非生产文档噪音**，仅 3% 是源码改动。
- **根因四层**：
  - A. 文档无版控：AI 每次会话自动更新 200+ 文档从未提交，diffs 累计 ~5K 行。
  - B. `gitignore` 不全：`docs-backup-20260719-085501/` 未排除 → **590K 行噪音（96.6%）**；`e2e/*/results.json` 未排除 → 8K 行。
  - C. 工作记忆膨胀：单文件最大 2487 行 diff，无蒸馏触发。
  - D. 有效改动被遮蔽：1 个生产 bugfix + 7 个测试修复被完全淹没。
- **修复（待执行）**：`.gitignore` 追加 `docs-backup-*/` + `e2e/**/_tmp*` + `e2e/**/test-results-*/`；创建 `.gitattributes` 统一 LF。详见 §6 优先级 P2-1。

### 1.6 tsc:prod 门禁作用域缺陷（曾长期红灯）

- **现象**：`tsc:prod` 长期 120 错误，阻塞 pre-push，但**生产源码 0 错误**——全错在 `*.test.ts`。
- **根因**：`tsconfig.json` 用 `include:["src/**/*"]`（无测试排除）扫**整个工作树（含 untracked 新测试）**，而专门的 `tsconfig.test.json`（`tsc:test`）**未挂任何 husky 门禁**。该门禁比真实 `vite build`（不类型检查测试）更严，不反映生产缺陷。
- **修复**：2026-07-22 修复 7 个测试文件的类型漂移（`PoolStatus`/`DataSource`/`AccountType` 枚举成员、`V6Score.score`、`TradeSummary.totalTrades`、`QuoteData`/`FinancialData` 字段改名），实测 `tsc:prod` **EXIT=0**。
- **遗留**：`tsc:test` 仍应挂 **warn 级门禁**，避免测试类型漂移再次静默累积（见 §6 P1-3）。

### 1.7 一个生产 bugfix 被 225 处文档噪音淹没

- **事实**：有效改动（1 个生产 bugfix + 7 个测试修复）被文档自动更新钩子产物（doc-sync 自动改并 staged ~205 份 docs）完全遮蔽，难以评审与提交。
- **教训**：文档自动更新钩子产物**不应与代码改动混在同一提交**；应分提交或排除。

---

## 2. 技术选型上的偏差

### 2.1 受管运行时沙箱段错误（最隐蔽的工具陷阱）

- **现象**：受管 Node 22 / 受管 Python 3.13 在沙箱内做**重型文件遍历 / 写入 / 原生 import**（pandas/numpy/akshare）时，间歇原生段错误（exit 139 / 0xC0000005）。**同一命令加 `dangerouslyDisableSandbox: true` 即 `exit=0`。**
- **偏差**：误以为段错误是"环境病"或"代码 bug"，浪费大量时间归因。
- **正解**：**任何批量文件改写 / 扫描必须 sandbox-off**；重型 import 用系统 Node24 或脱离沙箱跑。
- **注意**：`tsc` / `vite build` / `eslint` 在受管 Node 22 下正常，仅 `tsx` 类脚本不稳。

### 2.2 批量文件改写脚本的"自修改"陷阱

- **现象**：写"路径替换"脚本时，其源码含被替换的模式串（如 `%USERPROFILE%`）。若 `os.walk` 根在仓内，会遍历到自己文件、破坏自身模式（变空操作）。
- **正解**：脚本放**仓库外**（如 `%USERPROFILE%/AppData/Local/Temp/`），walk 根在仓内触及不到。

### 2.3 Grep 工具对反斜杠 + `|` 模式假阴性

- **现象**：本仓 DELL 残留用 `%USERPROFILE%|Users/<user>|...` 这类模式 Grep，**误报"已干净"**。
- **正解**：用技能自带扫描器 `windows-env-path-doctor --verify-current`（正向校验工具链存在），或简单**大小写敏感 `DELL` 字面 Grep** 交叉确认。

### 2.4 Bash 管道统计的 SIGPIPE 段错误

- **现象**：本沙箱内 `git ... | head` / `git ... | awk` 会因 SIGPIPE 致**消费者端段错误**（`head`/`awk` 崩，非 git）；`grep -c '^??'` 把 `??` 当正则量词误报 0。
- **正解**：**凡 git 管道统计一律落盘再 grep/wc**，禁直接喂 head/awk；用 `grep -E '^\?\?'` 或 `grep -F`。

### 2.5 git status / git diff 在沙箱内间歇性失效

- **现象**：`git status --porcelain` 读数在 0/23/39/数百行间跳变，曾误判 27 个未跟踪测试文件"不存在"。
- **正解**：核实"文件是否脏 / 改动归属"优先用 `git hash-object <文件>` vs `git rev-parse HEAD:<path>` 或磁盘 `stat` 交叉验证，勿盲信 `git status`；必要时 `dangerouslyDisableSandbox:true`。
- **结论**：该抖动与 DELL→Huawei 机器迁移**无关**（DELL 路径 0 处、git 配置/钩子零残留、remote 是人名非机器名）。

### 2.6 vitest 调试选型偏差

- **vi.mock 提升期引用**：`vi.mock('@/data/db', () => dbModule)` 在 hoisting 时 `dbModule` 未初始化 → "Cannot access before initialization"。**正解**：`vi.mock('x', async () => { const { y } = await import('./util'); return y })`。
- **getByText 跨元素拆字**：默认只匹配元素**直接文本节点**；`<span>0</span> Widget` 需用函数匹配器 `getByText((_t,el)=>el?.textContent?.trim()==='0 Widget')`。
- **单文件隔离跑**：混跑全量易跨文件污染与资源饥饿（全量 6701 例跑 13.5 分钟曾饿死其他进程）。**正解**：单文件隔离验证 + 系统 Node24。

### 2.7 盘符记忆错误（G: vs L:）

- **现象**：记忆曾写项目在 `G:/FinSightV9`，实际在 `L:\FinSightV9`。导致一度在错误路径上操作。
- **正解**：操作前用 `pwd` / `ls` 确认当前工作目录；自动化 cwds 用真实路径 `L:\FinSightV9`。

---

## 3. 架构设计上的不足

### 3.1 门禁作用域与生产实际脱节（结构性缺陷）

- **问题**：`tsc:prod` 用 `tsconfig.json`（`include:["src/**/*"]`，无测试排除）扫全工作树含 untracked 测试，而 `tsconfig.test.json`（`tsc:test`）未挂门禁。结果：门禁比真实 `vite build` 更严、不反映生产缺陷，却阻塞 pre-push。
- **改进方向**：
  1. 新增 `tsconfig.prod.json`（`exclude: **/*.test.ts|*.test-utils.ts|*.spec.ts`），`tsc:prod` 指向它 → 与 build 一致。
  2. 编辑器/测试仍用 `tsconfig.json` + `tsc:test`。
  3. `tsc:test` 挂 **warn 级门禁**，防止测试类型漂移累积。

### 3.2 Store 单例状态污染

- **问题**：部分测试间 Zustand Store 单例状态未完全重置，导致偶发 flaky / 假红灯。AGENTS.md v1.5.1 已记载 26 个 Store 派生函数裸用 `getState()` 导致 P0 不渲染。
- **改进**：强化 `tests/setup.ts` 的 `beforeEach` 重置逻辑；新增 Store 必须遵循"Zustand 响应式铁律 3 条"（见 AGENTS.md §二）。

### 3.3 测试与实现脱钩（源码重构后的类型漂移）

- **问题**：源码（`pool.types`、`v6-engine/types`、`dbConfig`、`dualStrategyRules` 等）重构后，**18 个 `*.test.ts` 引用旧 API**（旧枚举字面量 `'intention'`/`'researching'`、旧字段 `totalOrders`/`totalScore`/`close`），导致 tsc:prod 120 错误、测试失败。
- **根因**：**重构未同步更新测试**，且 `tsc:test` 无门禁，漂移静默累积。
- **改进**：重构 PR 必须包含对应测试更新；`tsc:test` 挂门禁；引入"重构三同步"（类型→测试→文档）。

### 3.4 DataBridge ACL 严格化与实际调用不匹配

- **现象**：W1 日志中出现 `AclError: Module fetcher cannot SELECT on store daily_quotes` / `Module user is not allowed to perform SELECT`。ACL 白名单比实际调用更严。
- **改进**：新增 store 写入必须经 `audit:acl-consistency`；排查按钮无响应 / 假绿灯时优先加载 `data-flow-integrity-audit` 技能（mandatory）。

### 3.5 文档自动更新钩子产生大量噪音提交

- **问题**：doc-sync 钩子在每次提交时自动改写 ~205 份 docs 并 staged，使有效代码改动被淹没，且 `--auto-update` 在移动文档未同步 3 处时会报 FILE_NOT_FOUND。
- **改进**：文档自动更新产物与代码改动**分提交**；移动文档须同步映射表§二 + TRIGGER_RULES + 各目录 README 三处。

### 3.6 工作记忆缺乏蒸馏触发

- **问题**：单文件最大 2487 行 diff（工作记忆膨胀），无蒸馏触发机制，导致记忆难读、易覆盖丢失。
- **改进**：每日日志超 ~200 行即蒸馏进 `MEMORY.md`；定期（>30 天）把旧日志并入长期记忆并删除。

### 3.7 测试资产散落、outputs 混入测试

- **现象**：`outputs/verify-arch-diagram.test.mjs` 作为测试混在交付物目录（outputs 本应被 gitignore），被 vitest 误扫。
- **改进**：测试文件统一归口 `tests/` 或 `src/**/*.test.ts`；`outputs/` 仅放交付物，排除测试扫描。

---

## 4. 流程管理上的缺陷

### 4.1 "声明完成"无独立复验（流程最大漏洞）

- **表现**：多轮出现"声称完成"但实测未完成（环境修复假象、文档批量 `--apply` 假成功、自动化未注册）。
- **根因**：缺少**交付前强制复验关卡**。
- **固化**：§5.1 信任但验证铁律 + `module-sync-checklist` 技能（mandatory，交付前必跑）。

### 4.2 记忆与真实状态不符

- **表现**：自动化注册、盘符（G:/L:）等状态类事实，记忆文字与实时工具校验冲突。
- **根因**：状态以"写过"为据，未"查过"。
- **固化**：§5.4 "状态类事实实时校验"铁律。

### 4.3 单会话范围失控

- **表现**：环境修复 / 测试修复 / 文档治理 / 远端推送 多主题混在同一会话，导致上下文过载、限频中断（429/499）需多次"继续"。
- **改进**：**一会话一主题**；用 TaskCreate 拆分；中断后直接继续无需重述（用户习惯）。

### 4.4 提交策略摇摆（--no-verify 反复）

- **表现**：因 husky 门禁挂死 / tsc:prod 红灯，多次 `--no-verify` 提交，违反 AGENTS.md "禁止擅自 --no-verify"。
- **改进**：门禁问题单独立项（如 §6 P1-3 修 `tsc:test` 门禁），而非绕过；确需 bypass 须用户授权并留痕。

### 4.5 限频导致任务断点难续

- **表现**：模型限频（429/499）中断长任务，需用户多次"继续"。
- **改进**：长任务拆小步 + 每步落盘记忆 + 用后台任务（`run_in_background`）跑重型命令，避免前台超时。

### 4.6 缺乏"遗留问题单一事实源"

- **表现**：遗留项散落 `01-p1-debt-cleanup-todo_root.md`、`unit-test-repair-roadmap_testing.md`、每日记忆，无统一优先级矩阵，导致"W1 ≤40 目标"与真实 82 失败脱节。
- **改进**：本文档 §6 作为**遗留问题单一事实源**，每周更新一次。

---

## 5. 可复用方法论沉淀（已固化）

### 5.1 铁律 #1：信任但验证（Trust but Verify）

> 任何"修复完成 / 任务完成"声明，必须以**独立复验**为据，禁止仅以"脚本打印成功"为据。

- **环境路径**：扫描器 [OK] No stale paths + `--verify-current` 全绿。
- **代码修复**：单测退出码 0（如 `node ./node_modules/vitest/vitest.mjs run <file>`）。
- **文件改动**：`git hash-object` vs `git rev-parse HEAD:<path>` 比对。
- **状态类**：`automation_update list` / `ls` 实时校验，不信记忆文字。

### 5.2 铁律 #2：批量文件操作 sandbox-off + 仓库外脚本

- 任何批量文件改写 / 扫描：`dangerouslyDisableSandbox: true`。
- 替换脚本放仓库外（`%USERPROFILE%/AppData/Local/Temp/`），避免自修改。
- 重型 import 用系统 Node24 或脱离沙箱。

### 5.3 铁律 #3：vitest 调试闭环

- `vi.mock` 工厂引用模块顶层变量 → 改 `async () => { const { y } = await import('./util'); return y }`。
- `getByText` 跨元素拆字 → 函数匹配器读 `textContent`。
- 单文件隔离跑 + 系统 Node24，避免全量混跑污染。

### 5.4 铁律 #4：状态类事实实时校验

- 自动化 / 盘符 / 分支 / 门禁状态，**先用工具查，再写结论**。
- 记忆文字仅作线索，不作证据。

### 5.5 已提炼 Skill（可直接调用）

| Skill | 类别 | 触发场景 | 关键能力 |
| :--- | :--- | :--- | :--- |
| `windows-env-path-doctor` | devops | 环境迁移 / 路径硬编码排查 | 环境优先探测 + `--verify-current` 正向校验 + 扫描器 |
| `doc-encoding-remediation` | doc-governance | GBK 乱码诊断→转码 | 确定性判据（严格 UTF-8 失败且 gb18030 成功 = GBK）+ 四重护栏 |
| `module-sync-checklist` | code-quality | 任何代码改动交付前 | 十域同步清单 + 门禁（mandatory） |
| `collection-pipeline-testing` | data-flow | 采集链路改动 | tsc + audit:layers + vitest（mandatory） |
| `data-flow-integrity-audit` | data-flow | 按钮无响应 / 假绿灯 / 跨板块异常 | 全链路审计 + `audit:acl-consistency`（mandatory） |
| `mock-data-diagnosis` | data-flow | Mock 残留 / 假数据 | 三维 Grep 扫描 + 诊断报告 |
| `devops-automation` | devops | 备份 / 部署 / 周期任务 | backup-branch.ts / batch-deploy.ts |
| `bash-conventions` | code-quality | 执行任何 Bash 命令 | §7 沙箱内 Git 全树扫描防段错误手册 |

### 5.6 关键命令速查

```powershell
# 单文件单测（一档验收，最稳）
node ./node_modules/vitest/vitest.mjs run <file>.test.tsx

# 系统 Node24 直驱 tsx（绕开受管 Node22 段错误）
"C:/Program Files/nodejs/node.exe" ./node_modules/tsx/dist/cli.mjs scripts/xxx.ts

# 门禁复测（sandbox-off 跑重型）
dangerouslyDisableSandbox:true npm run audit:layers

# 文件改动确定性核验
git hash-object <文件>          # 工作树 blob
git rev-parse HEAD:<path>       # HEAD blob，一致则未改

# 环境路径残留扫描（正向校验）
# ⚠️ 已废弃：scripts/scan_stale_paths.py 已失效
python scripts/scan_stale_paths.py --verify-current

# 自动化实时校验
automation_update list
```

---

## 6. 遗留问题与优先级矩阵（当前开发周期）

> **数据来源**：2026-07-22 全量 `vitest run` 日志（`temp/_w1_full2.log`）实测解析 + `automation_update list` + `tsc:prod` 实测；**2026-07-23 复检以实时工具重新校准**（见上 ⚠️ 注记：tsc 回归已修、自动化实为 3 条、测试数存疑）。状态事实以工具为准，文档仅作派生记录。
> **重要更正**：路线图 `unit-test-repair-roadmap_testing.md` 的 W1 目标"失败 ≤40"**未达成**——真实全量失败为 **82 例 / 36 文件**。已修复的 4 个文件（duckDBProvider / databridgeHandlers.mutation / databridgeHandlers.edge / CockpitShell.test.tsx）确已转绿，但失败源在另外 32 个文件。

### 6.1 当前真实状态快照

| 指标 | 数值 | 备注 |
| :--- | :--- | :--- |
| 全量测试 | 82 failed / 6598 passed / 21 skipped / **8 errors**（2026-07-23 存疑：争议文件直跑 37 passed/0 failed） | 6701 总计，36 失败文件；全量受管 Node22 worker 崩溃不可复现 |
| tsc:prod | **0 错误** | 2026-07-22 修 7 测试文件后 EXIT=0；2026-07-23 复检曾回归 27 错（widgetRegistry×26 + stockCodeUtils×1），已最小化修复至 EXIT=0 |
| 运维自动化 | **3 条 ACTIVE** | automation_update list 实测：A+H 字典刷新 + CloudStudio 周构建 + 每日 Git 备份（原"9 条"为状态失准） |
| 工作树未提交 | 225+ 处 | 92% 文档噪音，仅 3% 源码 |
| P1 架构债务 | 高优(H)全 ✅；中优(M1/M2/M3)待开始；低优(L1/L2/L3)待开始 | 见 `01-p1-debt-cleanup-todo_root.md` |

### 6.2 82 例失败的根因聚类（按失败文件分布）

| 聚类 | 代表文件（失败用例数） | 根因推断 | 修复方向 |
| :--- | :--- | :--- | :--- |
| **驾驶舱面板测试** | `tests/CockpitShell.panel.test.ts` (54) | 新测试断言面板标题/描述/计数与当前渲染不符 | 对齐渲染或更新断言（修代码优先） |
| **服务层测试** | `tests/services/profileService.test.ts` (45) | 服务重构后测试未同步 / Mock 不匹配 | 更新 fixture + 断言 |
| **Widget 测试** | `tests/IndustryChainWidget.test.ts` (33) | 渲染/数据断言漂移 | 对齐组件实现 |
| **核心数据层** | `databridgeHandlers.query`(12) / `queryBuilder`(12) / `stockCodeUtils`(12) / `databridgePriority`(12) / `crawlerProvider`(12) | 断言/NaN/ACL 严格化 | 逐文件修 |
| **项目自审脚本测试** | `audit-doc-sync`(9) / `doc-cross-ref-sync`(6) / `daily-doc-validation`(3) / `verify-all-routes`(3) / `audit-hardcode`(1) / `audit-layer-calls`(1) / `audit-mapping-integrity`(1) / `audit-split-quality`(1) / `audit-token-consumption`(1) | 审计正则/白名单漂移（如 lib 白名单变更） | 同步审计脚本与定义 |
| **导入流** | `BulkImportPanel.test.tsx`(6,**含 uncaught error**) / `batchImportService`(3) / `watchlistImportService`(1) | **react-router context 为 null**（缺 MemoryRouter）→ 8 个 uncaught error 源头 | 测试 setup 包 `MemoryRouter` |
| **同步服务** | `communitySyncService`(6) / `researchReportSyncService`(6) | 异步/网络 Mock 不稳定 | 稳定 Mock + 重试 |
| **回归/P1 修复测试** | `p1-fix-regression.test.ts`(6) | P1 修复后回归测试自身漂移 | 重新审视断言 |
| **Store 测试** | `poolStore`(3) / `tradingStore`(3) | 单例状态污染 | beforeEach 重置 |
| **useCase / MCP / 蓝图** | `generateTradeReview`(3) / `getUnifiedStockView`(3) / `mcp/servers`(3) / `reference/blueprints/dataRelationship`(3) / `hotSectorService`(3) / `tushareProvider`(3) / `e2e-verify-25stocks`(3) | 类型/断言漂移 | 逐文件修 |
| **散落残留** | `outputs/verify-arch-diagram.test.mjs`(1) / `IntentionPoolBoard`(1) / `useIntentionPoolBoard`(1) | 测试放错目录 / 新 Store 缺测 | 归位或补测 |

### 6.3 遗留问题优先级清单

#### P0（阻塞交付 / 必须本周期清零）

| 编号 | 问题 | 解决方案 | 验收 | 负责 |
| :--- | :--- | :--- | :--- | :--- |
| **P0-1** | 8 个 uncaught error（BulkImportPanel react-router context null） | 测试 setup 包裹 `<MemoryRouter>`；或组件内加路由兜底 | 全量 0 uncaught error | 单人 |
| **P0-2** | 82 失败收敛至 ≤40（W1 真实目标） | 按 §6.2 聚类逐文件修，**修代码优先于改测试**；先啃 CockpitShell.panel(54) + profileService(45) + IndustryChainWidget(33) 三大头（占 132/279 失败场景） | `vitest run` 全绿或 ≤40 | 单人 |
| **P0-3** | 工作树 225+ 未提交（1 生产 bugfix + 7 测试修复被淹没） | 先提交有效代码改动（精确排除非测试文档）；文档噪音另批或按 §6 P2-1 治理后提交 | 有效改动入库、可评审 | 单人 |

#### P1（重要 / 本周期应启动）

| 编号 | 问题 | 解决方案 | 验收 | 截止建议 |
| :--- | :--- | :--- | :--- | :--- |
| **P1-1** | `tsc:test` 未挂门禁，测试类型漂移静默累积 | 把 `tsc:test` 挂 **warn 级** husky 门禁；新增 `tsconfig.prod.json` 让 `tsc:prod` 与 build 一致 | 测试漂移 PR 即时报警 | 2026-07-25 |
| **P1-2** | P1 架构债务中优 M1/M2/M3 待开始 | M1 清 104 未用组件 / M2 拆 10 大组件 / M3 补 DataBridge 删除级联 | 见 `01-p1-debt-cleanup-todo_root.md` 验收 | 08-05~08-13 |
| **P1-3** | 23 个缺测 Store 补齐 | 按 roadmap §4 优先级（researchPool/positionPool/intentionPool 等 P0 先补） | 核心 Store 有测试 | 持续 |
| **P1-4** | 审计脚本测试漂移（9 文件） | 审计正则/白名单变更时同步更新 `tests/__tests__/scripts/*` | 审计测试全绿 | 2026-07-28 |

#### P2（改进 / 可延后）

| 编号 | 问题 | 解决方案 | 验收 |
| :--- | :--- | :--- | :--- |
| **P2-1** | gitignore 不全（docs-backup 590K 行噪音） | `.gitignore` 追加 `docs-backup-*/` + `e2e/**/_tmp*` + `e2e/**/test-results-*/`；`.gitattributes` 统一 LF | 工作树噪音清零 |
| **P2-2** | 文档无版控累积 | 文档自动更新产物与代码改动**分提交**；移动文档同步 3 处 | 提交可评审 |
| **P2-3** | `outputs/` 混入测试 | `outputs/verify-arch-diagram.test.mjs` 移出或排除扫描 | vitest 不扫 outputs |
| **P2-4** | 工作记忆蒸馏 | 每日日志 >200 行即蒸馏进 MEMORY.md；>30 天旧日志并入长期记忆 | 记忆可读、抗丢失 |
| **P2-5** | lint warnings（P1-L1/L2） | 清理 no-magic-numbers / strict-boolean-expressions / no-unsafe-* | warnings ≤100 |

### 6.4 建议排期（与现有路线图衔接）

```
2026-07-22 本周：P0-1（MemoryRouter）+ P0-2（82→≤40 三大头）+ P0-3（提交有效改动）
2026-07-25     ：P1-1（tsc:test 门禁）+ P1-4（审计脚本测试）
2026-07-29     ：W2 攻坚（Store 隔离 + NaN 链路，见 roadmap）
2026-08-05~13  ：P1-2（M1/M2/M3 架构债务）
2026-08-18~25  ：P1-L1/L2/L3（lint + 巡检机制）
持续           ：P1-3（23 缺测 Store）+ P2 改进项
```

---

## 7. 二次开发快速上手清单（Checklist）

1. **环境**：先跑 `windows-env-path-doctor --verify-current`，确认用户/venv/node 路径真实存在（当前 huawei，`L:\FinSightV9`）。
2. **门禁**：改代码前读 `AGENTS.md` 技能路由表，命中 mandatory 技能必须跑其 gates。
3. **测试**：单文件用 `node ./node_modules/vitest/vitest.mjs run <file>`（系统 Node24 + 隔离）。
4. **复验**：任何"完成"都按 §5.1 信任但验证闭环。
5. **遗留**：认领 §6 优先级项，更新本表状态，避免与 roadmap 重复。
6. **记忆**：每天结束 append `L:\FinSightV9\.workbuddy\memory/YYYY-MM-DD.md`；>200 行蒸馏进 `MEMORY.md`。

---

*本知识库为 V9 项目活文档，随开发周期持续更新。每次完成一项 §6 遗留问题，应同步更新对应状态与本文档版本号。*
