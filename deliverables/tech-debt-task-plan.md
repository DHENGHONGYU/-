# 技术债任务安排计划（Tech-Debt Task Plan）

> **生成日期**: 2026-08-19 | **生成人**: WorkBuddy
> **依据**: `docs/archive/normal/explanation/tech-debt.md`（v1.1.0，含 2026-07-12 双重校对批注）
> **目标**: 对台账做去噪 → 优先级重排 → 责任归属 → 迭代排期 → 派发模型，形成可执行、可验收、可门禁卡控的任务安排。

---

## 0. 重要前置说明（状态校正）

上一轮（2026-08-19 凌晨）已"完成"的两项工作，因**并行 Agent 的树重置（`git reset --hard` + `git clean -fd`）被清空**，当前工作树中均不存在：

| 项目 | 状态 | 说明 |
|------|------|------|
| 池 store 工厂收敛 `src/store/helpers/createPoolStore.ts` | ❌ **已丢失（untracked 新文件）** | 未被 git 跟踪，无法从索引恢复，需重做 |
| 3 个池 store 薄包装（position/research/intention） | ⚠️ **已回退到原始实现** | 工作树改动被 `git checkout` 撤销 |
| `tech-debt.md` 的 2026-08-19 状态块 + TD-012/TD-013 | ⚠️ **已回退** | 工作树改动被撤销 |
| 执行总报告 §8.4 / 本日 memory 日志 | ⚠️ **已回退** | 同上 |

**结论**：本轮"安排任务"必须先把"被清空但用户以为已完成"的工作重新立项（见任务 T1-1 / T0-1），否则会出现"假完成"。

---

## 1. 台账去噪（Triage）

台账 TD-001~TD-011 大量条目发现于 2026-07-05~07-06，计划完成日早已过期，且 2026-07-12 双重校对已标注多条**无效/误报**。先清账，再排期。

| 条目 | 原状态 | 判定 | 处理动作 |
|------|--------|------|----------|
| TD-001 评分引擎性能 O(n²) | 🟡 进行中 | ⚠️ **待核实**（疑似已随 domain 层拆分解决） | 转 T0-1 核实，确无则关 |
| TD-002 数据校验重复 | ✅ 已完成 | 有效 | 保持完成 |
| TD-003 单元测试覆盖率<80% | 🔴 待规划 | ✅ **真实且高价值** | 保留 → T2-1 |
| TD-004 api.ts JSDoc | 🔴 待规划 | ❌ **无效**（`src/services/api.ts` 不存在） | T0-1 关闭 |
| TD-005 calculateScore 120 行 | 🔴 待规划 | ❌ **无效**（函数已删/改名） | T0-1 关闭 |
| TD-006 硬编码 API 端点 | 🔴 待规划 | ❌ **已清**（集中至 `marketDataEndpoints.ts`） | T0-1 关闭 |
| TD-007 注释不完整 | 🔴 待规划 | ❌ **误报**（2026-07-12 复核为 tsc 瞬时误报） | T0-1 关闭 |
| TD-008 依赖过期 lodash | 🔴 待规划 | ✅ 低价值 | 保留 → T3-2 |
| TD-009 cockpit 硬编码颜色 | 🔴 待规划 | ✅ 真实 | 并入 color-token 治理 → T3-1 |
| TD-010 单测 Worker 崩溃 | 🔴 待规划 | ✅ 真实（环境） | 保留 → T2-2 |
| TD-011 ESLint 输出为空 | ✅ 已完成 | 有效 | 保持完成 |
| TD-012 池 store 重复样板 | — | ✅ 本轮已做但**被清空** | 转 T1-1 重做 |
| TD-013 researchNote 复制粘贴疑似错误 | — | ✅ 真实数据债 | 保留 → T1-2 |

**净效果**：关闭 4 条无效/误报（TD-004/005/006/007），台账从 13 项降为 9 项有效债务，避免"假债务"占用排期。

---

## 2. 优先级重排与迭代排期

按台账 §1.3 优先级定义 + 20% 规则（每迭代预留 20% 清理时间），将有效债务排入 3 个迭代。

### 迭代 1（立即，本周内）— 收敛 + 数据正确性
| 任务 | 优先级 | 负责人 | 预估 | 完成时限 |
|------|--------|--------|------|----------|
| T1-1 重做池 store 工厂收敛 | P1 | WorkBuddy | 2h | 本周 |
| T1-2 修复 TD-013 `researchNote: stock.sector` | P1 | WorkBuddy | 1h | 本周 |
| T0-1 台账去噪 + 2026-08-19 记录回填 | P1 | 技术负责人 | 1h | 本周 |

### 迭代 2（下迭代）— 测试债（最大头）
| 任务 | 优先级 | 负责人 | 预估 | 完成时限 |
|------|--------|--------|------|----------|
| T2-1 单元测试覆盖率→≥80%（TD-003，按模块分派 Agent 集群） | P1 | QA / Agent 集群 | 8h | 下迭代 |
| T2-2 调查单测 Worker 崩溃（TD-010，Windows forks/内存） | P2 | DevOps | 2h | 下迭代 |

### 迭代 3（季度内）— 质量债 + 预防
| 任务 | 优先级 | 负责人 | 预估 | 完成时限 |
|------|--------|--------|------|----------|
| T3-1 cockpit 硬编码色→令牌（TD-009，并入 v9-color-token-remediation） | P2 | UI | 3h | 季度内 |
| T3-2 依赖更新（TD-008，Dependabot/audit） | P3 | DevOps | 1h | 待规划 |
| T4-1 月度技术债复审节奏 + 台账新鲜度门禁 | P2 | 技术负责人 | 1h | 季度内 |

---

## 3. 任务卡（可执行规格）

### T0-1 台账去噪与回填
- **描述**：关闭 TD-004/005/006/007（无效/误报）；核实 TD-001 是否仍存；追加 2026-08-19 状态块 + TD-012（已完成·被清空待重做）+ TD-013（待规划）。
- **验收**：`tech-debt.md` 仅含有效债务；顶部状态块反映本轮门禁实测（audit:acl 0/0、audit:dup 19.19%）。
- **门禁**：`npm run audit:layers` 0 违规。

### T1-1 重做池 store 工厂收敛（被清空，需重做）
- **描述**：重建 `src/store/helpers/createPoolStore.ts`（~430 行工厂：`createPoolStore<Item extends PoolItem, Status extends PoolStatus>(config)`），将 `position/research/intention` 三 store 收敛为薄包装，**保留全部 20+ 外部消费点导出的名称/签名**（`useXxxPoolStore`、`getXxxPoolTotalCount/ItemBySymbol/Groups`、`initXxxPoolStoreSubscriptions`、`_resetXxxPoolStoreSubscriptionsForTest`、`toPoolItem`）。
- **关键约束**：泛型 `Status extends PoolStatus`；统一 `DEBOUNCE_MS=100`；`withBroadcast` 统一走 `@/lib/withBroadcast`；`researchPoolStore.toPoolItem` 的 `researchNote: stock.sector` **逐字保留**（行为不变，单独登记 TD-013）。
- **验收**：4 文件 `tsc` 零错；`audit:acl-consistency` 0 ERROR/0 WARN；`audit:dup` ≤20% 且三池退出 Top 重复块。
- **门禁**：`tsc:prod` + `audit:acl-consistency` + `audit:dup` + `audit:layers` 全绿。

### T1-2 修复 TD-013（数据正确性）
- **描述**：`researchPoolStore.toPoolItem` 中 `researchNote: stock.sector` 疑似复制粘贴错误（应为备注字段）。核实 Stock 类型真实字段，修正并补单测。
- **验收**：`intentionPoolStore.test.ts` 等消费点不回归；单测覆盖修正后 `toPoolItem`。
- **门禁**：相关 vitest 绿。

### T2-1 单元测试覆盖率→≥80%（TD-003）
- **描述**：按 `src/services/` 子模块分派 Agent 集群（A/B/C/D 平行），补核心逻辑单测；先补测试再改码（童子军规则）。
- **验收**：`npm test -- --coverage` 达 ≥80%；全量 vitest 绿。
- **门禁**：`npm test` 全绿 + 覆盖率门禁。

### T2-2 调查单测 Worker 崩溃（TD-010）
- **描述**：Windows 下 `npm test` tinypool worker 退出（exit 1）；临时用 `--pool forks`。查根因（内存/进程管理）。
- **验收**：默认 `npm test` 稳定跑完，无需 `--pool forks`。
- **门禁**：默认 `npm test` 绿。

### T3-1 cockpit 硬编码色→令牌（TD-009）
- **描述**：`MarketIndicesWidget` 等用 `text-red-500` 等硬编码色，改 `COLOR_TOKENS`/`COLOR_SHADES`（A股红涨绿跌约定）。
- **验收**：`grep -rn "text-red-5\|text-green-5" src/cockpit` 归零；视觉回归无变化。
- **门禁**：`verify:colorSoT` 绿。

### T3-2 依赖更新（TD-008）
- **描述**：`npm audit` + Dependabot 更新过期依赖（lodash 等），查兼容性。
- **验收**：`npm audit` 无高危；构建通过。

### T4-1 月度复审节奏 + 新鲜度门禁
- **描述**：建立月度技术债复审；`doc-freshness-governance` 或 `audit:layers` 扩展覆盖 `tech-debt.md` 新鲜度（>60 天未更新告警）。
- **验收**：门禁脚本可检出过期台账条目。

---

## 4. 派发模型（Dispatch）

| 任务类型 | 派发方式 | 并行度 |
|----------|----------|--------|
| 独立代码债（T1-1/T1-2/T3-1） | 串行（共享 store 文件，避免冲突） | 1 |
| 测试债（T2-1 按模块） | Agent 集群 A/B/C/D 平行，每 Agent 锁固定子目录 | 4 |
| 台账/治理（T0-1/T4-1） | 主 Agent 直做 | 1 |
| 环境/CI（T2-2/T3-2） | DevOps 单点 | 1 |

**完成标准（通用）**：门禁全绿 + 台账状态更新 + 本日 memory 落盘（避免再次被静默清空，建议完成后立即 `git add` 关键产物）。

---

## 5. 风险与对策
- **R1 工作树被并行 Agent 重置**：重做产物**立即 `git add` + 提交**（或至少 `git stash`），避免再次被 `git clean` 清空。本次 T1-1 完成后建议即时提交。
- **R2 台账虚假条目占用排期**：T0-1 先行，关闭 4 条无效项后再排期。
- **R3 覆盖率门禁假绿灯**：T2-1 用真实覆盖率报告，不依赖 Mock。

---

## 6. 测试补充策略（Test Supplement）

> **补充日期**: 2026-08-19 | **目的**: 为整体方案补齐「可测、可验收、可门禁」的测试维度；每个任务卡必须有明确测试命令与门槛，杜绝 T2-1 覆盖率假绿灯（R3）。
> **已实现资产（可复用，勿重复造轮子）**：
> - `src/store/poolStore.test.ts`（并行 Agent 在途产物，覆盖 3 池 10 类场景）— 直接作为 T1-1 验收基线。
> - `vitest.debt.config.ts`（并行 Agent 在途产物，`pool:'forks'` + `fileParallelism:false`）— TD-010 Worker 崩溃的已验证绕过配置。
> - 真实可跑脚本：`npm test` / `test:store` / `test:service` / `coverage`(`--coverage`) / `test:ci` / `test:stable` / `test:quarantine`。

### 6.1 测试命令矩阵（实测可用）

| 意图 | 命令 | 说明 |
|------|------|------|
| 跑全部单测 | `npm test`（`= vitest run`） | 默认 threads 池；TD-010 下可能崩 |
| 仅 store 层 | `npm run test:store` | T1-1 / T1-2 回归核心 |
| 仅 service 层 | `npm run test:service` | T2-1 主体 |
| 覆盖率（全量） | `npm run coverage` 或 `npm run test:ci` | 带 `--coverage`；**建基线用** |
| 覆盖率（仅 src/） | `npm run coverage:unit` | 聚焦源码、排除组件测试噪声 |
| 绕过 Worker 崩溃 | `npx vitest run --config vitest.debt.config.ts` | `pool:'forks'` 已验证可跑完 |
| 稳定性/隔离 | `npm run test:stable` / `npm run test:quarantine` | 基于 `scripts/test-quarantine.mjs` 的quarantine机制 |
| 类型门禁 | `npm run tsc:prod` | 所有代码任务前置 |
| 一致性门禁 | `npm run audit:acl-consistency` / `audit:dup` / `audit:layers` | 见 §6.7 |

> ⚠️ **vitest JSON reporter 坑（实测）**：全量 `vitest run --reporter=json` 在 4GB 堆下会 OOM 崩溃且 EPERM 写 results.json 失败。提取失败清单改用 `NODE_OPTIONS=--max-old-space-size=8192 npx vitest run --reporter=basic` 再 grep `^FAIL`，不要依赖 json 全量报告。

### 6.2 覆盖率测量方法论（破除 R3 假绿灯）

1. **真实基线未知**：台账 §3 TD-003 的「src/services 65%」是 **2026-07-05 旧 claim，从未用 `--coverage` 实测**（长期被 TD-010 Worker 崩溃阻断）。**T2-1 第 0 步必须先测量真实基线**，不得沿用 65% 数字。
2. **测量命令（绕过崩溃）**：`NODE_OPTIONS=--max-old-space-size=8192 npx vitest run --config vitest.debt.config.ts --coverage`（forks 池避免崩），产出 `coverage/` 真实报告。
3. **排除项透明化**：`vite.config.ts` 的 `PREEXISTING_TEST_FAILURES` 排除清单必须在基线报告里单独列明；被排除文件**不计入"已覆盖"**，避免用"整体 80%"掩盖单模块短板。
4. **分模块阈值**：按 `src/services/*` 子模块设独立 `thresholds.lines ≥ 80`，而非仅整体阈值；任一子模块不达标即门禁失败。
5. **CI 门禁固化**：`test:ci`（`vitest run --coverage`）须绿 + vitest `coverage.thresholds` 设死；门禁失败即阻断合并。

### 6.3 池 store 工厂（T1-1）测试矩阵

复用 `src/store/poolStore.test.ts`，并**扩展为工厂验收**：

- **导出契约回归（最关键，防破坏 20+ 消费点）**：
  - 脚本扫描 3 wrapper 的 `export` 列表，与重构前快照 diff，断言 `useXxxPoolStore` / `getXxxPoolTotalCount|ItemBySymbol|Groups` / `initXxxPoolStoreSubscriptions` / `_resetXxxPoolStoreSubscriptionsForTest` / `toPoolItem` 全部存在且签名不变。
  - 跑 `npm run test:store` + 3 池相关 page/component 测试全绿 = 消费者未回归。
- **工厂行为等价**：`refresh`（加载/并发锁/失败保留/loading 区分）、`addItem`、`updateItem`（不存在/symbol 归一化）、`deleteItem`、`updateStatus`（非法流转）、`updateGroup`、`getByStatus`/`getByGroup`、订阅/source 过滤/cleanup 全部绿。
- **约束断言（grep）**：`withBroadcast` 统一走 `@/lib/withBroadcast`；`DEBOUNCE_MS=100` 统一常量；无残留 `zustand` 裸 `create` 于 3 wrapper。
- **td-013 联动**：见 §6.4。

### 6.4 T1-2 `researchNote` 修复 测试

- 在 `src/store/researchPoolStore.test.ts` 新增用例：断言 `toPoolItem(stock).researchNote` 来源。
  - **修正前**：`= stock.sector`（复制粘贴错误，行为已知缺陷）→ 用例标记 `@skip` 作回归锚点。
  - **修正后**：`= 真实备注字段`（查 `Stock` 类型真实字段）→ 断言新来源；删除 skip。
- 行为对照：用真实 `Stock` 类型字段做断言，防止再次复制粘贴。

### 6.5 TD-010 Worker 崩溃（T2-2）测试门禁

- **根因排查项**：Windows tinypool worker 内存超限 / 进程管理；临时绕过 = `pool:'forks'`（已在 `vitest.debt.config.ts` 验证可跑完 569 文件）。
- **排查手段**：`NODE_OPTIONS=--max-old-space-size=8192` 提堆；调 `poolOptions.forks.{minForks,maxForks}`；逐步从 `forks` 回退到默认 `threads` 验证修复。
- **验收门槛**：默认 `npm test`（threads 池）稳定跑完 **全部** test files 不崩溃、不退 1；方可移除 `vitest.debt.config.ts` 依赖。

### 6.6 回归安全协议（跨任务通用）

任何 store / 接口 / 常量改动后，按序跑：
1. `npm run tsc:prod` —— 0 错
2. `npm run test:store` + `npm run test:service` —— 全绿
3. `npm run audit:acl-consistency` —— 0 ERROR/0 WARN
4. `npm run audit:dup` —— ≤20% 且 3 池退出 Top 重复块
5. `npm run audit:layers` —— 0 违规
6. **覆盖率不回退**：每次补测后 `coverage` delta（lines）≥ 0

### 6.7 门禁联动总表

| 任务 | 必跑测试/门禁 | 验收门槛 |
|------|---------------|----------|
| T0-1 台账去噪 | `audit:layers` | 0 违规；`tech-debt.md` 仅含有效债务 |
| T1-1 工厂收敛 | `tsc:prod` + `test:store` + `audit:acl-consistency` + `audit:dup` + `audit:layers` + §6.3 导出契约脚本 | 全绿 + 20+ 导出名/签名不变 |
| T1-2 researchNote | `researchPoolStore.test.ts` 新增用例 + 相关消费测试 | 修正后断言绿、无回归 |
| T2-1 覆盖率→80% | `test:ci`(`--coverage`) + 分模块 thresholds | 真实基线已测 + 各子模块 ≥80% + 排除清单透明 |
| T2-2 Worker 崩溃 | 默认 `npm test`（threads 池） | 全量不崩、不退 1 |
| T3-1 硬编码色 | `verify:colorSoT` | `grep text-red-5\|text-green-5 src/cockpit` 归零 |
| T3-2 依赖更新 | `npm audit` | 无高危；构建通过 |
| T4-1 月度复审 | 新鲜度门禁脚本 | 可检出 >60 天过期条目 |

---

**下一步**：确认本计划（含 §6 测试补充）后，建议从 T0-1（台账去噪）→ T1-1（重做收敛：先写 `createPoolStore.ts` + 3 薄包装，跑 §6.3 导出契约脚本与 `test:store` 全绿，**立即提交**）→ T1-2（修 `researchNote` + 补单测）→ 再派发 T2-1 集群（先按 §6.2 测真实覆盖率基线，再分模块补测到 80%）。

> **执行前提醒（R1）**：当前工作树为并行 Agent 的 `governance/round9-cleanup-zombie-components` 分支（113 项在途改动，含 `poolStore.test.ts`/`vitest.debt.config.ts` 等可用资产）。执行本人任务前，应先将并行 Agent 在途改动安全暂存/备份（已备 `D:/_parallel_wip_backup`），切到本人分支重做，**每完成一项立即提交**，避免再次被树重置清空。
