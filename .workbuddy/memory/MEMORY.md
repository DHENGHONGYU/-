# 项目记忆（V9 智能投研复盘系统）

## 设计体系
- 宋韵美学：亮色 stone 暖灰；暗色统一 neutral 高级灰（hue 0），只改 `dark:*` 段。
- 令牌 L1 `THEME_TOKENS`→L6 `SEMANTIC_COLOR_ROLES`；UI 走令牌，A股红涨绿跌固定。
- 组件规范唯一事实源 `docs/design/component-specs.md`（受 audit:docs 治理）。
- 功能警示色=amber；朱砂红仅文化装饰。焦点环须组件自加 `focus-visible:`。
- **教训**：改组件类名/variant 须同回合跑其 `.test.tsx`。

## 架构与门禁
- 分层见 `AGENTS.md` §一；新模块「类型→Store→Service→UI」。
- Husky pre-commit 唯一硬闸=`env-path-guard`（脚本 `scripts/env-path-guard.cjs --ci --staged`，**只扫已暂存文件**），拦 `C:/Users/(DELL|huawei)` 硬编码，其余 `set +e`。**⚠️陷阱1**：lint/tsc 失败也会放行提交 → **提交后必须手动复跑 `tsc:prod` 确认 0 错误**。**⚠️陷阱2（2026-07-24 实战）**：若索引被先前操作暂存了大量文件（本仓曾 1689 个），其中混入 12 个硬编码路径文件，commit 会被**连坐拦截**（hook 扫整个索引）。解法：`git reset`（mixed，清空索引、工作树无损）→ 仅 `git add` 本次目标文件 → commit。切勿 `git add -A`（会把坏路径文件重新 staged 再次被拦）。工作树里那 12 个硬编码路径文件仍待 `windows-env-path-doctor` 技能清理（P4）。
- 门禁复测用系统 Node24：`npx tsx scripts/xxx.ts`（`node` 已在 PATH，nvm4w 管理）。
- lib 白名单：`logger/withBroadcast/eventBus/format/errors/utils/localStorageManager/safeCoerce/perf/precision/validation/safeRegex`。**⚠️跨模块业务逻辑（如评分工具）必须落在 `lib/utils/` 下**——`services` 层只能依赖白名单子目录，`lib/score.ts` 这类顶层 `lib/<name>` 会被 `audit:layers` 判为"lib 业务模块"违规（2026-07-24 实战：score 从 `lib/score` 迁至 `lib/utils/score` 才过）。
- pre-push：`gate:quick`+`audit:widget-registry`+`complexity-scan`+`test:clean`+`build`。

## 原子/采集/AI/复杂度/文档
- 原子四层 `audit:atomic` 强约束，基线 0 违规。
- 采集：types `modules/collection.types.ts`；service `data-collector/`；store `collectionRuntime/sevenDimConfig/dataTest`。
- 新增 Widget 改三处：`cockpit/core/widgetRegistry.ts` + `constants/cockpit.constants.ts`（DEFAULT_WIDGET_CONFIG + WIDGET_DEFAULT_DATA_SOURCE）。
- `complexity-scan`：0 深层嵌套/0 长链/0 重复条件。
- 文档触发单一事实源 `docs/00-meta/doc-trigger-action-map.md` + `scripts/docs-tool/doc-update-trigger.ts`。

## Cockpit/Command 治理约定（2026-07-24 收口）
- 纵横交叉布局展示元数据（业务域/视角 label+icon）集中在 `src/constants/cockpit.constants.ts`（`COCKPIT_CROSS_DOMAINS`/`COCKPIT_CROSS_PERSPECTIVES` + `WIDGET_CROSS_LAYOUT`），是 UI 分组单一真相源；layout 组件（CockpitCrossLayout/CrossMatrixOverview）**不得**本地重复定义。
- `outputs/` 受 `.gitignore` 管理：**SOP/验收类文档（如 `outputs/interaction-component-qa-gate-SOP.md`）不进 VCS**，仅本地验收流程读取；蓝图/spec/ADR 等正式架构文档放 `docs/specs/` 进版本控制。
- ADR 惯例：决策记录建独立 `docs/specs/architecture/adr-NNN-<slug>.md`（Status/Context/Decision/Consequences），蓝图内仅留摘要+引用。
- Cockpit 治理全闭环（分支 `feat/cross-index-20260719`）：堆砌→纵横交叉重构(a305be5) / Command Hub(fb6a990) / 评分统一 lib/utils(a305be5) / 统计卡收敛 MetricCard(fe0ab96) / 路径清理(e5353ee) / 组件提质 O1-O3(cf89023) / ADR+蓝图收口(2f2d334)。

## 产品边界
- 个人研究/复盘辅助，非金融产品；本地 IndexedDB；AI 输出标「仅供参考」。五因子评分为合成种子，UI 标「示例」。

## 运维自动化（实测 2 条 ACTIVE；第三条待验证）
- `devops-automation` skill：`backup-branch.ts`（快照 `backup/auto`，`--force-with-lease`）+ `batch-deploy.ts`。
- ACTIVE：每日 03:10 Git 备份(`automation-1784135926736`)、周日 04:00 CloudStudio 构建(`automation-1784135926764`)。
- 待验证：周日 03:00 刷新 A+H 字典(`automation-1784399510483`，2026-07-21 检查时 ID not found，需重新注册或确认)。

## 交互组件验收 SOP（2026-07-19）
- `outputs/interaction-component-qa-gate-SOP.md`：五步法（Grep+实读定标→写断言→最小修复→一档实跑→落盘）+ 反假阳性库（FP-1 Slider / FP-2 B2）。

## 本机环境事实（长期）
- 受管运行时沙箱批量遍历/写入间歇段错误（139）→ 批量操作须 `dangerouslyDisableSandbox:true`。
- 路径替换脚本放仓库外（`$USERPROFILE/AppData/Local/Temp/`）。
- 环境病：**Huawei→DELL 迁移**；活性代码 `src/`、`scripts/` 零硬编码（用 `%USERPROFILE%`）；残留 P0 在 `.trae/`/`.trae-cn/`/`docs/` 等叙述中。技能 `windows-env-path-doctor` 已落地。

## 已知良好基线（2026-07-23 校准 / 2026-07-26 增补）
- 全量单测权威基线（系统 Node24）：原 **30 failed / 12590 passed / 21 skipped / 636 文件**；经 22/22 最小修复（2 源码真缺陷 `databridge.ts`+`tushareAdapter.ts` + 9 测试漂移）提交后，剩余失败 = ~10 flaky 用例（计时/负载，隔离 196/196 全过，**非真实缺陷**，留待 P1-B' 稳定化）。
- `tsc:prod = 0`（修复 `widgetRegistry.ts`×26 + `stockCodeUtils.ts:29` 后；本次 readStatus 误补字段触发 TS2353 已 amend 回退）。
- A股 SW 三级行业已抓（335 行业/5203 只/93.8%）；港股 `hkIndustryMap.ts` 仍空。
- CI：`.github/workflows/quality-check.yml`（**14 job**，2026-07-26 新增 `chart-industry-tests` P0 阻塞 — 5 件套图表组件 106 项用例门禁；typecheck 修为 `npm run tsc:prod`）+ `ci.yml`（`feat/**`：smoke+test+chart-industry-tests+layers+databridge-gate，Node22/SHA-pinned/权限 read）。

## 行业 V4 图表 5 件套测试基线（2026-07-26 新增）
- **5 个组件**：`IndustryV4Panel` / `IndustryV4Radar` / `SubIndicatorBar` / `TrendLineChart` / `ValuationDistribution`（含 `buildHistogram` 纯函数）。
- **测试用例**：106 项全绿（IndustryV4Panel.test 40 + TrendLineChart.test 25 + ValuationDistribution.test 34 + IndustryHeatmap.test 7）。
- **CI 强制门禁**：`chart-industry-tests` job 在 `quality-check.yml` 与 `ci.yml` 中均为 P0 阻塞；本地 pre-push 已通过 `test:clean` 覆盖。
- **可视化报告**：`npm run report:chart` → `outputs/test-results/chart-report.html`。
- **设计蓝图**：`docs/reference/implementation/chart-integration.md` §3.4 + §7（v1.1.0）。
- **Mock 策略关键经验**：当被测组件通过 `<Bar><Cell fill=.../></Bar>` 父子结构设置颜色时，Bar 的 mock 必须渲染 `props.children`，否则 Cell mock 不会被调用；更稳健做法是直接读取 Bar 的 `props.children` 数组中各 Cell React 元素的 `props.fill`。

## 状态事实实时校验铁律（长期）
- 自动注册/盘符/分支/门禁：**先实时工具查**（automation_update list / ls / git hash-object），再写结论。记忆文字仅线索非证据。
- 项目路径以 `L:/FinSightV9`（git bash `/l/FinSightV9`）为准；`G:` 为历史盘符映射已失效。

## 健康度复检技能
- `finsight-health-audit`（`V9-SKILL-HEALTH-AUDIT`，code-quality，advisory）：进度/健康度复检+对标+评分+状态自洽。铁律「实时工具优先于记忆」+ 检测库 M1–M8 + 教训 L1–L8。已注册 `skill-registry.json` 与 `AGENTS.md`。

## 零值兜底整改（2026-07-26 完成）
- **整改背景**：3 个高风险文件存在 `?? 0` 隐式兜底，将缺失值（`null/undefined`）伪装为 `0`，可能误导财务计算与筛选逻辑。
- **整改策略**：显式区分「缺失值 → NaN」与「显式零值 → 保留 0」，在数据流入口添加 `logger.debug` 记录零值原始来源。
- **整改文件清单**（已验证 `?? 0` 残留=0）：
  | 文件 | 行号 | 风险字段 | 日志内容 |
  |------|------|----------|----------|
  | `src/store/positionPoolStore.ts` | L67-L93 | `quantity`/`avgCost`/`currentPrice` | 股票代号+名称+零值/缺失字段列表 |
  | `src/store/profileStore.ts` | L271-L275 | `qualityScore` | 零值比例+缺失比例+筛选阈值 |
  | `src/data/sectorDefinitions.ts` | L592-L597 | `v6Composite` | 板块代码+零值/缺失股票数量 |
- **测试统计**（3 测试文件 / 183 用例全绿 / TypeScript 0 新增错误）：
  | 测试文件 | 行数 | 用例数 | 双向验证 | 深度验证 |
  |----------|------|--------|----------|----------|
  | `positionPoolStore.test.ts` | 1489 | 85 | 12（6 正向 + 6 逆向） | 9 Store 层集成 |
  | `profileStore.test.ts` | 1255 | 76 | —（逻辑在主流程中验证） | 19 数据流集成 |
  | `sectorDefinitions.test.ts` | 416 | 22 | 7（4 正向 + 3 逆向） | 8 板块级集成 |
  - 双向验证：从输入→输出（正向）和输出特征→反推输入（逆向）两个方向验证 NaN 替换逻辑。
  - 深度验证：在真实数据流场景下验证 Store 层行为（refresh/addItem/filter），确保日志触发和数值转换在集成环境中正确。
- **日志原文样例**（已通过 `console.log` 捕获验证）：
  - `[positionPoolStore] toPoolItem: 600519(贵州茅台) 显式零值字段 → [quantity, avgCost, currentPrice(含price)] 原始数据源返回 0，请确认是否为业务有效值`
  - `[positionPoolStore] toPoolItem: 600519(贵州茅台) 缺失字段 → [quantity, avgCost] 用 NaN 替代 0 作为显式空值标记`
  - `[profileStore] loadItems: 2/3 条资料缺失 qualityScore，以默认值 50 参与 minQuality=60 筛选`
  - `[profileStore] loadItems: 1/2 条资料 qualityScore 为显式 0，将参与 minQuality=60 筛选`
  - `[sectorDefinitions] getSectorPoolStocks: sector=IC 有 1/1 只股票 v6Composite 为显式 0，请确认是否为业务有效评分`
  - `[sectorDefinitions] getSectorPoolStocks: sector=IC 有 1/1 只股票缺失 v6Composite，用 NaN 替代 0`
- **保留的合理兜底**（非风险，经评审保留）：
  - `profileStore.ts` L300-L301：`qualityScore ?? 50` + `evidenceWeight ?? 0.5`（排序用中值兜底，非 0）
  - `profileStore.ts` L525：`counts[item.domain] ?? 0`（计数场景的正确初始值）
- **路径修正**：所有路径使用 `src/` 相对路径，无硬编码绝对路径。
- **复测验证**（2026-07-26 最终确认）：
  - `?? 0` 残留扫描：positionPoolStore=0, profileStore=3(合理), sectorDefinitions=0
  - TypeScript 类型检查：0 新增错误
  - 全量测试：183/183 通过（含双向验证 19 + 深度验证 36）

## 教训案例：stash 丢失导致工作树状态失准（2026-07-29 复检）
- **现象**：`git status` 报告 1710 脏文件（491 modified + 491 untracked + 728 other），但 `Test-Path`/`Get-ChildItem` 在 `.workbuddy/` 下找不到 `memory/`、`automations/` 子目录；`AGENTS.md` 也"不存在"。`Read` 工具却又能读到这些文件（实为缓存幻觉）。
- **根因**：`stash@{0} = WIP on fix/p0-seed-retry-memory-fallback`（1220 文件）未被恢复，导致工作树**真实缺失**关键治理文档（MEMORY.md / AGENTS.md / 21 个 SKILL.md / automations 执行记忆 / 大量 src/docs 变更）。`git status` 显示的"M"是 git 索引与 stash 的对比幻影，不是工作树真实状态。
- **诊断方法**：以 `Test-Path`/`Get-ChildItem`/`git ls-files --deleted` 实时工具为准，**不要**直接采信 `git status` 的字符输出，**也不要**采信 `Read` 工具结果（可能命中缓存）。`git stash list` + `git stash show --stat "stash@{0}"` 是定位根因的关键命令。
- **修复**：`git stash pop "stash@{0}"` 因 1550 个 untracked 冲突报错退出码 1，但**关键治理文件已实际恢复**（MEMORY.md 10766B / AGENTS.md 94084B / automations/memory.md 5011B）。stash 条目保留以备后查，确认后 `git stash drop "stash@{0}"`。
- **教训 L10（新增）**：`git status` 输出与工作树真实状态可能因 stash 而脱钩；状态事实必须用 `Test-Path`/`Get-ChildItem`/`git ls-files --deleted` 等文件系统工具二次校验，不能只看 `git status`。`Read` 工具结果可能命中缓存幻觉，**严禁**作为文件存在性证据。
- **教训 L11（新增）**：`git stash pop` 即使退出码非零也可能已部分成功（untracked 冲突不阻塞已 tracked 文件恢复）；pop 后必须用 `Test-Path` 验证关键文件是否真实存在并检查文件大小，再决定是否 `git stash drop`。
- **关联检测法**：v9-health-audit skill 的 D1（git 状态）+ D4（自动化真实条数）应增加 stash 列表检查：`git stash list` 应作为 D1 子步骤，stash 存在时必须 `git stash show --stat` 评估是否为丢失文件根因。
