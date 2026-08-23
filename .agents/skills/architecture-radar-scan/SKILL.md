---
skill_id: V9-SKILL-ARCHITECTURE-RADAR-SCAN
name: "architecture-radar-scan"
description: "对V9项目进行六层架构无损探测，揪出设计层面的重大遗漏与隐含腐化点，输出架构热力风险图（红/黄/绿）与分级修复方案（P0阻塞/P1严重/P2优化）。复用项目自带的5个审计脚本（audit:layers/hardcode/deadcode/component-usage/docs）与ESLint静态分析，结合人工探查覆盖循环依赖、贫血模型、防腐层缺失、大组件癌变、用例缺失、僵尸代码等12类架构缺陷。Invoke when user asks for architecture health scan, architecture audit, design flaw detection, tech debt assessment, or mentions 架构扫描/架构健康度/架构雷达/腐化点检测/遗漏点排查；版本迭代前技术债务评估、重大重构前基线建立、定期架构巡检（每两周一次）。"
version: v1.0.4
last_updated: 2026-08-23
code_version: "2.0.0-rc.1"
change_log:
  - version: v1.0.4
    changes: "跨平台 SKILL 体系统一(2026-08-23)：补全 skill_id 对齐 registry，junction 单一物理源加载，统一索引与跨平台加载契约登记"
    date: 2026-08-23
  - version: v1.0.3
    changes: "基准日校对(2026-08-22)：R1取真值(P1 change_log 最新条目=v1.0.2) → R2 PATCH++(v1.0.3) / last_updated 刷新 / change_log 闭环"
    date: 2026-08-22
  - version: v1.0.2
    changes: "§一 触发条件 改写为 RULE-TPL 三标签格式（显式触发×2 / 脚本/审计触发×2 / 设计/协议触发×1），词命中 ≥4，满足 RULE-TPL §一 可判定规则校验。"
    date: 2026-08-21
  - version: v1.0.1
    changes: "Batch-B P0-1 段补齐：基于 S 级 Skill 5 段式骨架模板重构，原 12 段自定义长文合并重映射为标准一~五段；§二前置检查合并真相源锚定+基线表格化（7 项），并把原红线清单放入§二铁律；§三扫描 SOP 拆 7 个 Phase（自动化脚本+6 层无损探测）；§四扩展至 8 条教训（后果+规避双字段）；§五交付物≥10 项+必要且充分条件声明；保留原 P0/P1/P2 分级判定规则（附录 A）+ 已知绿基线（附录 B）+ 验证命令速查。补 mandatory 字段对齐 registry。"
    date: 2026-08-21
  - version: v1.0.0
    changes: "C 类版本闭环(2026-08-11)：补全 change_log 初始条目"
    date: 2026-08-11
mandatory: false
---

# 架构 360° 雷达扫描 — v1.0.1

> **版本**: v1.0.1 | **日期**: 2026-08-21 | **校验基准**: V9 AGENTS.md + ARCHITECTURE.md 当前版本 + eslint.config.js
> **扫描性质**: 只读分析，扫描阶段禁止修改任何代码文件；发现必须包含具体文件路径或行号
> **输出格式**: 架构热力风险图（三色 14 检测项 × 趋势） + P0/P1/P2 分级遗漏清单（含具体 path:line） + 分批重构执行路径 + 经验教训 + 交付物勾表

---

## 一、触发条件（Invoke When · RULE-TPL 三标签标注：显式触发 / 脚本/审计触发 / 设计/协议触发）

- **显式触发 1**：用户明确要求「架构健康度复检」「行业对标/技术债务评估」「架构热力风险图」「腐化点检测+遗漏点排查」「定期架构巡检（每两周一次）」
- **显式触发 2**：版本迭代 RC 前一周系统性评估技术债务存量；重大重构（如 Gateway 门面化 / DataBridge 信封化 / 新模块批量落地）前建立架构基线；PRD 大版本变更后核对「文档vs现实矛盾」
- **脚本/审计触发 3**：`npm run audit`（串联 layers + hardcode + deadcode + docs）输出多项 FAIL 需要分级归因；或 `npm run eslint --max-warnings 0` 报大量 warn 需要大组件癌变 / 注释残留 / eslint-disable 反模式识别；或 `npx madge --circular src/` 检出循环依赖（脚本盲区告警）
- **脚本/审计触发 4**：任何 `npm run tsc:prod` 或 `npm run vitest run` 批量 FAIL 但表面是 symptom，怀疑根因来自分层腐败 / Store 贫血 / DataBridge ACL 矩阵漂移等结构性问题 → 先扫 Radar 再改代码
- **设计/协议触发 5**：AGENTS.md / ARCHITECTURE.md 大版本更新后，需要重新评估六层架构 14 个检测项与当前磁盘实际的一致性；或新引擎（AI 约束/类型测试）引入后横向扫描项扩展，需要对齐检测口径

**不触发场景 · 减少误激活**：
- 单次 P0 故障 hotfix（应直接修复，不应启动全量扫描）；
- 纯文档修改、纯配置项变更（与代码结构无关）。

**协作 Skill / 链式调用**：
- 扫描后发现 P0 跨层违规→`architecture-cleanup`（清理 SOP）· `databridge-migration`（DataBridge 信封迁移）；
- 发现类型 `any` 破洞→`type-safety-contract`（类型安全 6 步契约）；
- 发现文档同步遗漏→`docs-as-mirror`（真相优先+双向引用）+ `doc-freshness-governance`（双版本校对）；
- 发现常量化硬编码→`constant-migration`（跨层常量归位）。

---

## 二、前置检查

> **铁律（扫描红线清单 · 违反任一即 FAIL）**：① 扫描阶段禁止修改任何代码文件；② 禁止跳过 5 个自动化审计脚本（layers/hardcode/deadcode/component-usage/docs），优先复用项目自带脚本，不重复造轮子；③ 所有发现必须含具体 `path:line`，禁止输出无定位的泛泛结论；④ 禁止将 P2 建议混入 P0 清单（分级必须严格）；⑤ 禁止在未运行 `tsc --noEmit` 的情况下给出重构命令；⑥ 禁止一次性输出所有批次修复（分批推进，每批用户确认）；⑦ 禁止忽略项目已知绿色基线与已知黄/红项对比参照。

| # | 检查项 | 命令 / 方法 | 通过标准 |
|---|--------|-----------|---------|
| 1 | 读取 5 个真相源，建立架构基线 | 打开并阅读：路由注册表 `src/config/routes.ts`、数据总线 `src/core/databridge.ts`、全局类型 `src/data/types.ts`、架构说明 `ARCHITECTURE.md`、代码规范 `eslint.config.js` | 真相源当前版本号与关键指标（路由数/分层数/Store 数/组件数/关键规则）记录到报告 |
| 2 | 对照 10 层分层定义（参照系） | 读取 AGENTS.md §一分层：core/data/lib/services/store/pages/components/portal/config/constants | 分层定义 10/10 明确，报告中作为扫描对照依据 |
| 3 | 已知绿色基线锚定 | 读 §附录 B（v0.9.18 快照）：`@ts-ignore=0`、`: any` 生产=0、`axios=0`、`audit:layers`=0violations/2warnings、路由数=35 等 | 本次扫描结果逐项与基线对比，输出 ↓/→/↑ 趋势 |
| 4 | 已知黄/红项锚定 | `useCase` 目录不存在（L5.1 🔴/🟡）、页面直接 import Service=8 个（L3.1 🟡）、`.cursorrules` 不存在（横向 AI 🔴）、audit:hardcode Critical≈389（🟡）、僵尸代码≈11（🟡） | 本次扫描对已知项标注「改善/持平/恶化」，不得重复遗漏 |
| 5 | 审计脚本存在性与可执行性 | 确认 5 个脚本路径真实存在：scripts/audit-layer-calls.ts、audit-hardcode.ts、audit-deadcode.ts、audit-component-usage.ts、audit-docs.* | 5/5 全存在且 tsx 执行无 file not found |
| 6 | 扫描前快照与残差记录 | `git status --short > outputs/arch-radar-before.txt`；记录 `tsc --noEmit` 既有错误清单 | 有快照 + 残差清单，后续重构 FAIL 不得把历史问题算入本次 |
| 7 | 工具依赖确认（madge 临时使用） | `npx madge --version`（无需安装到 dependencies，npx 即可） | 循环依赖探测工具可用；madge 不可用时退化为 audit:layers + 人工 Grep 闭环 |

---

## 三、阶段化 SOP

按 7 个 Phase 顺序执行（Step 0 自动化脚本必跑，Step 1-6 六层探测 + 横向治理），禁止跳过 Step 0；扫描阶段只读，重构命令只在「分批执行路径」中给出（且必须附验证命令）。

### **目标**：14 项检测（L1×3 + L2×2 + L3×3 + L4×2 + L5×2 + L6×2 + 横向×2）全部给出 🟢/🟡/🔴 结论 + 具体 path:line + 趋势；P0/P1/P2 分级遗漏清单逐项可落地。

### Phase 1 · Step 0：跑 5 个自动化审计脚本（5 分钟 · 建立数据基线）

**交付物**: 5 份审计输出快照

```powershell
# 并行运行 5 个脚本（互不依赖，退出码语义见脚本）
npm run audit:layers                         # L3 跨层调用违规：exit 1=violations
npm run audit:hardcode                       # L1/L4 硬编码：exit 1=Fatal(config层股票代码)
npm run audit:deadcode                       # L6 死代码/路由漂移：exit 1=路由文件缺失
npx tsx scripts/audit-component-usage.ts     # L4 组件复用率：exit 0=始终，输出JSON+报告
npm run audit:docs                           # L6 代码-文档同步：exit 1=未文档化src文件
```

**必做**：将各脚本 exit code 与输出关键数字（violations 数、Fatal/Critical 数、route mismatch 数、复用率分布、docs 遗漏数）填入 §五 热力风险图对应行，与已知绿基线对比。

### Phase 2 · Step 1：L1 领域数据定义扫描（贫血模型 / 伪类型安全 / 数据关系孤儿）

**交付物**: L1 × 3 项 检测报告（每项带 path:line）

1. **贫血模型检测**：Grep `src/data/types.ts` + `src/types/**` 中 `validate|sanitize|normalize|compute`（充血特征），对比 Grep `src/services/**/*.ts` 中 `validate|isValid|checkStatus|assertValid`（散落校验）。按 🟢 充血 / 🟡 集中单一 / 🔴 多处散落 分级。
2. **伪类型安全检测**：Grep 生产代码（排除 test）中 `: any\b|as any\b|<any>` 与 `@ts-ignore|@ts-nocheck|@ts-expect-error`；**重点核 `src/core/databridge.ts` + `src/data/dataLayer.ts` + `src/store/*.ts` 公共通道**。公共数据通道出现 `any` = P0 阻塞。
3. **数据关系孤儿检测**：Grep `databridge.ts` 与 `dataLayer.ts` 中 `delete|remove|cascade|orphan`，检查父级删除时子级引用处理（级联删除 / orphan 标记 / 悬空引用）。悬空=🔴，orphan 标记=🟡，级联=🟢。

### Phase 3 · Step 2：L2 功能模块与边界扫描（循环依赖 / 上帝模块）

**交付物**: L2 × 2 项 检测报告

1. **循环依赖探测**：`npx madge --circular --extensions ts src/`；失败退化方案：`audit:layers`（间接覆盖）+ Grep utils → components 的反向引用模式。modules/A ↔ modules/B 双向循环=🔴。
2. **上帝模块检测**：统计 `src/services/**/index.ts` 导出数（>15 = 🔴）、统计 `src/store/*.ts` 行数（>500 行 = 🔴），按 §三 2.2 命令执行。

### Phase 4 · Step 3：L3 数据桥与路由防腐层（直接裸奔 / DTO 遗漏 / 鉴权穿透）

**交付物**: L3 × 3 项 检测报告

1. **直接裸奔检测**：Grep `src/pages/**/*.tsx` 中 `from.*services`（绕过 Store）；`audit:layers` 报 page→dataLayer 写操作 = 🔴；Grep `axios|fetch\(` 于 pages/components（已知基线 0，复查）。
2. **DTO 遗漏检测**：Grep 页面 TSX 中 `created_at|updated_at|user_id|stock_code|order_id`（后端命名透传）；Glob 全仓 `*Mapper*|*Adapter*|*ViewModel*` 确认转换层存在性。
3. **鉴权穿透检测**：Grep `RouteGuard|ACL|hasPermission|canAccess|beforeEach|isAuthenticated`。仅 Token 判断 + 无按钮级权限 = 🔴。

### Phase 5 · Step 4-5：L4 组件层 + L5 应用层

**交付物**: L4/L5 各 2 项，共 4 项报告

- **L4.1 大组件癌变**：Glob `src/pages, src/components, src/cockpit` TSX 行数 + useEffect 计数，>500 行 或 >5 个 useEffect = 🔴。结合 `audit-component-usage.ts` 详细数据。
- **L4.2 样式硬耦合**：`audit:hardcode`（已覆盖颜色硬编码）；Grep 组件直接硬 Tailwind 色类 vs 是否有 `className?:` props 传递机制。
- **L5.1 用例缺失**：Glob `*useCase*|*PlaceOrder*|*SubmitOrder*` 目录/文件；Grep 页面 TSX `onClick.*async|onSubmit.*async` 中散落复杂交互。
- **L5.2 事务边界模糊**：Grep `src/store/**` 中 `optimistic|rollback|revert|snapshot|prevState`，判断乐观更新 Rollback 机制是否存在。

### Phase 6 · Step 6：L6 架构演进治理 + 横向元能力

**交付物**: L6 × 2 + 横向 × 2 = 4 项报告

- **L6.1 僵尸代码**：`audit:deadcode`（已覆盖路由缺失）+ Grep 连续注释代码块（>5 行/文件） + `npm run lint` 中的 `no-unused-vars`。僵尸代码比 >5% = 🔴。
- **L6.2 依赖漂移**：读 package.json dependencies，按状态库/函数库/HTTP 客户端/图表库 4 类分类，同功能 3+ 库=🔴。
- **横向 1 · AI 行为约束**：Test-Path `.cursorrules|prompts/|.trae/rules|AGENTS.md|CLAUDE.md`。无任何 AI 约束文件 = 🔴（V9 已知项重点对比改善状态）。
- **横向 2 · 类型测试遗漏**：Glob `__tests__/types` 目录；Grep `Expect<Equals|ts-expect`。无类型测试目录 → CI 遗漏类型回归拦截。

### Phase 7 · 报告组装：热力风险图 + 分级遗漏清单 + 分批重构路径

**交付物**: 最终扫描报告（严格按 §附录 A 分级判定标准）

1. **架构热力风险图**（§附录 A 表头模板）：14 行 × 7 列（层级/检测项/风险/发现数/代表文件/趋势/备注）。
2. **P0/P1/P2 分级遗漏清单**（§附录 A 格式）：每个问题含具体 `path:line`、违反原则、后果、修复方向。P0 判定标准满足任一即 P0（公共数据通道 `any` / 循环依赖致运行错误 / 页面直接写 dataLayer / 路由文件缺失 / config 硬编码股票代码 Fatal）。
3. **重构执行路径**（3 批）：第一批 P0（阻塞修复，附具体命令 + `tsc --noEmit && audit:layers` 验证）→ 第二批 P1（近期重构）→ 第三批 P2（中长期演进）。**分批推进原则**：每批完成后必须等用户确认再继续；每批完成后强制 `npx tsc --noEmit && npm test -- --run && npm run lint` 验证。

---

## 四、陷阱与经验教训

| # | 教训 | 后果 | 规避方法 |
|---|------|------|---------|
| 1 | 扫描阶段擅自修改代码 | 与只读性质冲突；基线污染；用户无法区分扫描与修复阶段 | §二铁律① + Phase 0-6 全程只读；重构命令仅出现在 Phase 7「分批执行路径」中，且必须附验证命令 |
| 2 | 发现无 `path:line`，仅靠泛泛描述 | Reviewer 无法定位；修 bug 时无从下手；报告公信力下降 | §二铁律③；每个发现至少含 1 个 `path:line` 代表例；使用 Grep 与脚本直接输出拼接进报告 |
| 3 | P0/P1/P2 分级混乱（把 P2 写进 P0） | 用户误以为有阻塞性缺陷，排期被扭曲；真正 P0 淹没在噪音中 | §二铁律④ + §附录 A 判定标准（满足任一才升 P0），三档分别输出，不得混写 |
| 4 | 一次性出所有修复命令，用户来不及确认 | 大改动引发连锁 FAIL，回滚困难 | §二铁律⑥；Phase 7 按 P0→P1→P2 三批列出，每批用户确认通过后再进入下一批 |
| 5 | 只跑 audit:*，不做人工 6 层扫描 | 审计脚本盲区（语义重复、贫血模型、useCase 缺失）永远无法暴露 | §二铁律②强调「复用脚本 + 人工 Grep」；Phase 1-6 7 步中 Phase 0（5 脚本）+ Phase 1-6（12 项人工+半自动化）都要跑 |
| 6 | 不锚定已知绿基线，直接给结论 | 无法判断「比历史好还是恶化」；趋势列全是问号 | §二 3-4 强制锚定 v0.9.18 绿基线 + 已知黄/红项；每项趋势标 ↓改善 / →持平 / ↑恶化 |
| 7 | 重构命令不附 `tsc --noEmit` 验证条件 | 修复脚本引入语法错误/跨层违规，CI 红一片 | §二铁律⑤；每条修复命令必须后接验证命令，且首步验证必含 `tsc --noEmit` |
| 8 | 遗漏横向治理检测（AI 约束 / 类型测试） | 只看代码结构不看 AI 行为约束 & 类型回归门禁 → 下一迭代 AI 自由输出风格漂移 | §三 Phase 6 必须覆盖 L6 × 2 + 横向 × 2 = 4 项；不得因「非代码」原因遗漏 |

---

## 五、完成交付物清单

### 5.1 交付物清单（≥10 项 · 完成打勾）

- [x] **1. 架构基线真相源记录**：5 个真相源当前版本 + 关键指标（路由数/分层/Store 数/规则）
- [x] **2. 已知绿/黄/红对比锚定表**：与 v0.9.18 基线 + 已知黄红项对照
- [ ] **3. 扫描前快照 + 残差清单**：`outputs/arch-radar-before.txt` + tsc 历史错误清单
- [ ] **4. Phase 1 五份自动化审计报告**：layers/hardcode/deadcode/component-usage/docs（退出码 + 关键数摘要）
- [ ] **5. L1×3 检测报告**：贫血模型 + 伪类型安全 + 数据关系孤儿（每项 path:line）
- [ ] **6. L2×2 + L3×3 检测报告**：循环依赖/上帝模块 + 裸奔/DTO/鉴权穿透（path:line + 分级）
- [ ] **7. L4×2 + L5×2 检测报告**：大组件癌变/样式耦合 + 用例缺失/事务边界（path:line）
- [ ] **8. L6×2 + 横向×2 检测报告**：僵尸代码/依赖漂移 + AI 约束/类型测试遗漏
- [ ] **9. 架构热力风险图**（14 行 × 🟢🟡🔴 × 趋势）
- [ ] **10. 🔴 P0 致命遗漏清单**（每条含 path:line + 后果 + 修复方向）
- [ ] **11. 🟡 P1 架构债务清单 + 🟢 P2 优化清单**（分档格式正确）
- [ ] **12. 分批重构执行路径**（P0 第一批附具体命令 + `tsc --noEmit` 验证命令）
- [ ] **13. 命令退出码速查**（5 个审计脚本 exit code 语义说明）
- [ ] **14. 关联 Skill 协同路线图**（发现→对应 Skill 的迁移路径清单）

### 5.2 必要且充分条件

> **当且仅当**以下 4 条**同时成立**，方可声称本次架构雷达扫描完成：
> 1. **覆盖完整**：Phase 0（5 自动化脚本） + Phase 1-6（12 项人工+半自动化） + Phase 7（报告组装）全部执行，无跳过；14 项检测（L1×3 / L2×2 / L3×3 / L4×2 / L5×2 / L6×2 / 横向×2）全部给出 🟢/🟡/🔴 + 趋势 + path:line 代表例。
> 2. **分级合规**：P0/P1/P2 三档严格按 §附录 A 判定标准分级，P0 只含真正阻塞项（不得混入 P2）；P0 清单每项都附具体 `path:line` + 违反原则 + 后果 + 修复方向。
> 3. **只读且可回溯**：扫描阶段未修改任何代码（可通过 `git diff` 与 before 快照对比 0 diff 证明）；所有结论可由他人重跑 Phase 0-6 脚本独立复现。
> 4. **分批执行路径可用**：Phase 7 的 P0 第一批每条修复命令都后接 `npx tsc --noEmit` 为首步的验证命令；并明确「先等用户确认 P0，再推进 P1/P2」。

---

## 附录 A · P0/P1/P2 分级判定规则速查

### P0 判定标准（满足任一）
1. DataBridge/dataLayer/store 公共通道出现 `any` 或 `@ts-ignore`
2. 循环依赖导致编译或运行时错误
3. 页面直接调用 dataLayer 写操作（audit:layers 违规）
4. 路由注册文件缺失（audit:deadcode exit 1）
5. config 层硬编码股票代码（audit:hardcode Fatal 级）

### P1 判定标准（满足任一）
- index.ts 导出 >15；组件 >500 行或 useEffect>5；Store >500 行
- 页面直接 import Service（绕过 Store）；复杂交互散落在 onClick（无 useCase）
- 僵尸代码 >5%；无 AI 行为约束文件

### P2 判定标准（优化空间）
- 类型测试未纳入 CI；部分模块缺 DTO 转换层；2 个功能相近库；组件 300~500 行；少量 docs 遗漏

### 热力风险图表头模板

| 层级 | 检测项 | 风险等级 | 发现数 | 代表性文件 | 趋势 | 备注 |
|------|--------|---------|--------|-----------|------|------|
| L1~L6 + 横向 | （14 行） | 🟢/🟡/🔴 | N | `path:line` | ↑/→/↓ | 与基线对比 |

---

## 附录 B · 验证命令速查

| 命令 | 用途 | 退出码语义 |
|------|------|-----------|
| `npx tsc --noEmit` | TS 类型检查 | 0=通过 |
| `npm run lint` | ESLint 静态 | 0=通过 |
| `npm test -- --run` | Vitest 单测 | 0=通过 |
| `npm run build` | 生产构建 | 0=通过 |
| `npm run audit:layers` | 分层调用 | 0=无违规；1=violations |
| `npm run audit:hardcode` | 硬编码 | 0=无 Fatal；1=Fatal 级 |
| `npm run audit:deadcode` | 死代码/路由 | 0=无路由缺失 |
| `npm run audit:docs` | 文档同步 | 0=全部文档化 |
| `npx tsx scripts/audit-component-usage.ts` | 组件复用率 | 始终 0（输出 JSON） |
| `npx madge --circular --extensions ts src/` | 循环依赖 | 0=无循环 |
| `npm run audit` | 前 4 项串联 | 全通过=0 |

---

## 附录 C · 相关参考与 Skill 协同

- AGENTS.md §一 分层规则 · §七 验证命令全集
- ARCHITECTURE.md（驾驶舱 Widget 架构+分层设计）
- 关联 Skill：`architecture-cleanup`（清理落地）· `databridge-migration`（DataBridge）· `constant-migration`（常量化）· `type-safety-contract`（类型变更）· `docs-as-mirror`（文档对齐）· `v9-code-quality-audit`（代码质量合规）
