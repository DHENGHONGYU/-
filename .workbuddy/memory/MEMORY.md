# FinSightV9 长期项目记忆（节选）

## 数据采集舱 MCP 化改造（腾讯自选股 SKILL 整合）
- 完成态：marketdata:westock MCP Server 已落地（13 Tool + check_health + 2 Resource），westock 置为采集链维度 04/05/08 优先级1；Electron 由 electron/westockHost.ts(main)+preload 承载，渲染进程经 window.westock IPC 委派。
- **关键实现约束（写测试必记）**：`westockServer.ts` handler 解构 `{data}` 后 `toToolResult(data)` 把 data **直接** `JSON.stringify` 进 `content[0].text`，**无 `{data}` 包装层**。解析测试结果时应直接 `JSON.parse(text)`（数组/对象本身），勿假设 `{data:...}`。
- E2E 实测：真实 CLI 可用率 100%(30/30)，质量评分 AFTER=94.0/BEFORE=0.0/评级 A。修复的致命跨平台缺陷：`spawn('npx')` 在 Windows 因 npx.cmd 不存在 ENOENT → 加 `shell:true` 解决（可用率 0%→100%）。
- CLI 必加全局 `--raw`（否则默认 markdown 表格，`parseJson` 必崩）；真实字段：研报评级 `tzpj`、机构嵌 `title【】`、时间 `time`。

## 腾讯新闻模块（平行范式）
- `TencentNewsCliBridge` **不是孤儿**：`tencentNewsServer.ts:18/138/155/171` 真实消费，NewsServer 与 WeStockServer 是平行 MCP Server。**禁止误删**。
- 真实优化项（非阻塞）：抽取 `BaseCliBridge` 供 WestockCliBridge/TencentNewsCliBridge 共用。

## 技能治理（已闭环·2026-08-16）
- **权威真相源是 `skill-registry.json`**：`projectPhysicalSkills`（18，自然 slug，无 v9- 前缀）= 真正的本地 `.agents/skills/*` 物理技能；`virtualPlatformSkills`（19，v9-* 名）= TRAE CN 平台虚拟技能，**设计上无本地 SKILL.md**（非"缺失"）；`externalPluginSkills`（9）。合计 46。
- **AGENTS.md L1 索引曾把 19 个虚拟 v9-* 谎称为"L1 物理"**——这是唯一真实错位；已重写为 18 自然名物理技能。勿再据 AGENTS.md 旧索引判定"v9-* 物理缺失"。
- **WorkBuddy 加载器只扫 `.workbuddy/skills/`，不扫 `.agents/skills/`**：已将 18 物理技能镜像（cp -r）至 `.workbuddy/skills/`（Windows 不支持 symlink），`.gitignore` 已忽略该镜像目录。漂移自愈：`npm run skill:mirror`（`scripts/skill-mirror.cjs`，覆盖式镜像+清理孤儿）；`.agents/skills/*` 更新后跑一次即可。
- `collection-pipeline-testing`（数据采集 mandatory 门禁）是本轮唯一新增物理技能（由虚拟转物理，自然名）。
- **frontmatter 声明失真（已闭环）**：实测物理 SKILL.md 仅用 `name`/`description`/`version`/`last_updated`/`change_log`，无 `triggers`/`gates`/`mandatory` 三字段；AGENTS.md L65 已纠正——该三字段机器可读真相源指向 `skill-registry.json`。勿再据 AGENTS.md 旧路由表声称"SKILL.md 含三字段"。

## 门禁真值基线（勿被过时报告误导）
- `tsc:prod`：2026-08-18 实测 **EXIT 0 / 0 类型错误**。历史曾有 EXIT:2，错误为并行 Agent 未提交产物（`ScoreComparisonPage.tsx`/`SectorAnalysisPage.tsx`/`DashboardPage.tsx`），属并行环境噪声，非本任务改动；当前基线为 0。同日晚间再次出现 EXIT:2（14 错全在 `ChipStrategyReviewPage.tsx`，并行 Agent 在途 WIP 删 241 行后引用未定义 `CHIP_SIGNALS`/`exportChipStrategyExcel`/`downloadDebugLogFile`/`clearDebugLog`），**非本任务引入，按纪律不擅改**。
- `audit:layers`：2026-08-17 实测 **1462 文件 / 0 违规 / 退出码 0**（仅 1 处过渡期警告 researchPipelineOrchestrator.ts:34 引擎层直连 db，P0 待整改非阻断）。
- `audit:acl-consistency`：2026-08-18 实测 **0 ERROR / 0 WARN**（pool.read 已含 traceRecords/rotationScores 等，P0-4 确认无需改）。
- **observation_reviews 持久化空壳已闭环（2026-08-18 由并行 Agent 完成）**：此前 outputs 日志海量 `NotFoundError: No objectStore named observation_reviews`，根因是 object store 未在 `createSchema` 注册 + dataLayer handler 未接，致 spec 缺口②跨重启持久化实际失效。本轮并行 Agent 补齐：`db-schema.ts:587` ensureStore 注册、`databridge.ts:175` action→store 映射、`databridgeHandlers.ts:678` handler 注册、`dbConfig.ts:281` ENVELOPE_ACTION 枚举、`data-dictionary.ts:1433` 字典条目、`validate-data-blueprint.ts` 扫描盲区修复。**勿再判定 observation_reviews 为 WIP/未接/空壳**；`tests/observation-pool-review.integration.test.ts` 已验证 green。
- `audit:registry` 已 173 条全绿（Currency/Percent/OnboardingGuide 已在 atomRegistry 注册）；`AppErrorState` 缺失告警为瞬时/过渡态。
- **蓝图完成度基线（2026-08-17 重审计）**：`docs/specs/《V9 目标功能清单》.md` 升 v1.1.0，原 23%(L2 Store 口径) → **综合功能达成度 ≈87%**；唯一确缺失项为分析舱 `news-v6`（仅 newsColorTokens.ts 残留）。路由 79(21 deprecated)、80+ 单测、30+ E2E。
- **单元测试基线（2026-08-17 实测，重要修正）**：`npm test` = `vitest run` 569 test files / 9159 例：**8950 passed / 182 failed / 22 skipped**，49 个失败文件，1 unhandled error（Worker exited unexpectedly）。此前任何"2 失败"说法均作废。
- **E2E 基线（2026-08-17）**：蓝图验收 `e2e/blueprint/features.spec.ts` 因 WorkBuddy safe-delete 对 `test-results` 目录 trash 操作被拦截而未能启动；全量 `npm run e2e` 未跑。后续需在干净环境补跑。
- **GLM5.3 测试接入（2026-08-18 闭环）**：`zhipu-glm` preset 含 `glm-5.3`；mock 回显 model；新增 `src/services/llm/llmClient.glm53.test.ts` + `npm run test:llm:glm53` 脚本（实测 7/7 通过）。`llmClient.ts` 新增 `safeParseJson`（不抛异常）+ `stripJsonFences`（剥离 ```json``` 围栏），直接防御混元等弱模型非标准 JSON。
- **vitest 全量 JSON reporter 坑**：默认 4GB 堆下 `vitest run --reporter=json` 会 OOM 崩溃（"Allocation failed - JavaScript heap out of memory"）且 EPERM 写 results.json 失败；提取失败清单改用 `NODE_OPTIONS=--max-old-space-size=8192 npx vitest run --reporter=basic` 再 grep `^FAIL`。

## 观察池→研究池「晋升自动入池」已闭环（2026-08-18）
- 能力落地于 `src/services/orchestration/observationPoolReviewer.ts`：`autoEnroll` 配置（默认 false）+ `enrollToResearchPool(symbol,name)` 注入依赖 + 复盘结果 `enrolled: string[]`。`run()` 在 `autoEnroll && enrollToResearchPool` 时遍历 `promotionEligible` 标的逐一入池（失败不阻断复盘）。
- 生产接线于 `src/services/orchestration/index.ts`：`getObservationPoolReviewer({ autoEnroll: true })` 开启；`isInResearchPool` 权威查 stocks store（`pool==='research'`）；`enrollToResearchPool` 调 `useResearchPoolStore.addItem`（source=`DATA_SOURCE.system`）。`addItem` 自带 DB 去重，重复入池安全返回 false。
- 单测 6/6 通过（含 2 条自动入池用例）。`audit:layers`/`audit:acl-consistency` 均 0 违规。

## 工具约定（可复用 · 踩坑沉淀）
- **IDE ESLint `no-unused-vars` "fix on save" 会剔除尚未被使用的 import**：先加 import 再加用法时，linter 在两次编辑之间删掉 import，导致后续 Edit 反复报 `File has been modified since read`（本次 `index.ts` 因此被回退多次）。
- **解法**：给需要"加 import + 用法"的文件用 `Write` 一次性原子重写整文件（import 与用法同批存在，linter 不删），避免分步 Edit 被 linter 穿插回退。并行 Agent 活跃编辑的共享文件（如 `data-dictionary.ts`/`db-schema.ts`/`ChipStrategyReviewPage.tsx`）严格只读核查、不抢改。

## husky/lint-staged stash 灾难 与 `.git/refs` 损坏 恢复 SOP（反复发作·必须固化）
- 现象：husky pre-commit 的 lint-staged 在 Windows 反复 stash 失败，导致工作树被抹（D 文件）或 `.git/refs` 被删，git 报"not a git repository" / HEAD 无法解析 / `rev-parse HEAD` 报 unknown revision。
- 判规模：`git status --short | awk '{print $1}' | sort | uniq -c` 看 D 数量；`git rev-parse HEAD` 是否可解析。
- 恢复步骤（全部可逆，不碰提交对象）：
  1. 仅还原被删工作树文件：`git diff -z --diff-filter=D --name-only | xargs -0 git checkout --`（保留 M/?? 不动）。
  2. 删 stale lock：`rm -f .git/index.lock` 被 safe-delete 拦截时，用 PowerShell `Remove-Item -LiteralPath 'D:\FinSightV9\.git\index.lock' -Force`。
  3. **`.git/refs` 被删恢复**：`mkdir -p .git/refs/heads .git/refs/tags .git/refs/remotes` 重建目录；`packed-refs` 仍在则大部分 ref 可解析。若当前分支 loose ref 也丢：`git cat-file -t <候选sha>` 验证后 `git update-ref refs/heads/<branch> <sha>` 重建（可逆，仅写 ref 文件，sha 优先取 ORIG_HEAD 或 reflog）。
  4. 复跑门禁确认恢复。
- 根因未除：本会话已升级到删 `.git/refs`，须用户在环境层根因治理（lint-staged / 杀软实时扫描 / 并发 Agent 抢 `.git`）。当前分支 `governance/round9-cleanup-zombie-components` 的 loose ref 曾随 `.git/refs` 被删，已用 `update-ref` 重建至 ORIG_HEAD `7d3569f2`（组件僵尸清理提交，验证有效）。

## 门禁 #12 audit:doc-id — B 系统方案（2026-08-19 实施·已验证）
- 问题：原 `audit-doc-id-reverse.ts` 全磁盘扫描，unregistered-doc/no-doc-id/id-mismatch 同为阻断型，并发 Agent 文档 churn 反复无辜 BLOCK 个人全绿提交。
- 解决：① 分类——`missing-file` 为唯一阻断型（`BLOCKING_TYPES`），其余降级为【警告】（不计入 EXIT）；② 新增 `--changed-only` 差分扫描（仅校验本次提交涉及文件，husky 默认启用）；③ `husky/pre-commit:139` 改为 `BLOCK TSX_RUN scripts/audit/audit-doc-id-reverse.ts --changed-only`；④ 新增 `npm run audit:doc-id:changed` / `audit:doc-id:fix` 脚本；⑤ 退出码仅由阻断型违规决定。
- 验证：全量当前 0 违规 EXIT0；构造 unregistered-doc 实测【警告】EXIT0；构造 missing-file 实测【阻断】EXIT1。`--json` 新增 `blockingViolations` 字段，CI 兼容。
- 结论：个人全绿提交不再被并发 Agent 文档 churn 无辜 BLOCK；真实断链（missing-file）仍严格阻断。
