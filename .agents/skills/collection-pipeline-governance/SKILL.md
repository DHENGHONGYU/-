---
skill_id: V9-SKILL-COLLECTION-PIPELINE-GOVERNANCE
name: "collection-pipeline-governance"
description: "采集管线全链路治理 SOP：7 维配置安全修改、新 MCP/REST 数据源接入、降级阈值与计分策略调整、月度 API 预算评估、stock 字典增量重建、真实取数回归 6 大场景闭环。Invoke when 修改 sevenDimConfigStore（启用/停用维度、频率、模板）、接入新数据源（BaseCollector/Tushare/IFind/MCP 源）、调整 SourcePriorityManager/QualityMetricsCollector/DegradationScorer 参数、或 build:stock-dict/data-collector:dry-run/collection-pipeline:prod 门禁 FAIL 时加载。"
version: "v1.0.2"
last_updated: "2026-08-23"
change_log:
  - version: v1.0.2
    changes: "跨平台 SKILL 体系统一(2026-08-23)：补全 skill_id 对齐 registry，junction 单一物理源加载，统一索引与跨平台加载契约登记"
    date: 2026-08-23
  - version: v1.0.1
    changes: "基于 S 级 5 段式骨架模板补齐（迁移检查清单 Batch-C 打磨）：§二 6 项→7 项前置检查表格化；§五 10 项→12 项交付物（补 registry 对齐+配置快照保存声明）；§五末尾新增必要且充分条件声明；last_updated 2026-08-21 升版激活 RULE-TPL 信号；整体内容子项 14/15→15/15 全满"
    date: 2026-08-21
  - version: v1.0.0
    changes: "初始版本：基于 S 级 5 段式骨架模板（gateway-facade-refactor 提炼）创建，覆盖采集管线 6 大治理场景（7 维配置/数据源接入/降级/预算/字典/CI 回归），固化 8 条 P0 教训与 10 项完成交付物"
    date: 2026-08-20
mandatory: false
---

# 采集管线全链路治理 Skill（GAP-01） — v1.0.1

> **版本**: v1.0.1 | **日期**: 2026-08-21 | **校验基准**: FinSightV9 code_version 2.0.0-rc.2 / DB_VERSION=35 / STORE_NAME=53
> **任务性质**: 治理与配置 SOP，允许修改 7 维配置/采集器/优先级/字典脚本，**禁止**直接调整 MonthlyBudgetGuard 月度额度硬编码、禁止在未跑 dry-run 情况下上线高维度模板
> **输出格式**: 场景化 SOP 矩阵 + 降级阈值参数变更记录 + API 预算测算表 + 门禁结论

---

## 一、触发条件（Invoke When · 8 条可判定规则）

- **显式触发 1**：用户明确要求「改采集配置」「加/减启用维度」「切换配置模板 full/light/balanced/trade」
- **显式触发 2**：用户要求「接入新的数据源」（MCP 新源 / Tushare 新接口 / IFind 字段 / WebSocket 新通道 / MockCollector 新规则）
- **显式触发 3**：调整 QualityMetricsCollector 或 DegradationScorer 的阈值（score < 0.X 触发降级、fallback 队列写入策略）
- **显式触发 4**：用户要求「重建股票字典」「stockDict 增加新字段」「build:stock-dict 失败排查」
- **脚本/审计触发 5**：`npm run data-collector:dry-run` FAIL，或 `test:services:collection-pipeline:prod` FAIL
- **脚本/审计触发 6**：`npm run build:stock-dict` 输出字典 size 与上一版 diff > 5% 或缺失率 > 0.1%
- **预算触发 7**：`MonthlyBudgetGuard.getRemainingBudget()` 提前用完（距月末 > 10 天余额 < 15%）
- **设计/协议触发 8**：怀疑存在「7 维 enabled 但 collector 未接线」「新维度默认 full 模板导致超额调用」「降级阈值过高导致真数据被挡」

**不触发场景**（减少误激活，至少 2 条）：
- 只改 data-collector 单元测试，不碰维度配置 / 源接入 / 阈值 / 字典 / 预算
- 采集管线的 LLM 搜索缓存（`llmSearchCache`）命中规则小改

**协作 Skill（链式调用）**：
- `collection-pipeline-testing`：Phase 4 变更后跑端到端 vitest 与生产域门禁
- `data-flow-integrity-audit`：五段存储兜底矩阵验证采集/分析/筛选阶段新增 Store 覆盖
- `db-reference-audit`：stock 字典重建后 DB 引用一致性检查
- `type-safety-contract`：修改 DimensionPipelineConfig / CollectionConfig 类型时 6 步契约

---

## 二、前置检查清单（先扫后改，必须先通过再动手）

| # | 检查项 | 命令 / 方法 | 通过标准 |
|---|--------|-----------|---------|
| 1 | 契约基线版本 | 读 AGENTS.md 头部 version / code_version，对齐 sevenDimConfigStore.ts 当前模板定义（`generateDimensionsFromTemplate`） | 明确目标修改不会冲突其他在途 PR |
| 2 | 基线 dry-run 全绿 | `npm run data-collector:dry-run` 3 次（消去并发伪影） | 平均 score ≥ 0.92，no FAIL stage，调用次数 ≤ 预算 5% |
| 3 | 基线字典完整性 | `npm run build:stock-dict` + 对比 `data/stock-dict/stock-dict.lines` 上一版 diff | diff ≤ 2% 且缺失率 ≤ 0.05%；无新增 WARN |
| 4 | 当前配置快照 | `sevenDimConfigStore.getState().dimensions.map(d => d.code+':'+d.enabled+':'+d.frequency)` 输出并保存 | 作为 Phase 4 回滚对照 |
| 5 | 月度预算余量 | `MonthlyBudgetGuard.getRemainingBudget()` 并与距月末天数估算日均可用数 | 日均预算 ≥ `estimateDailyCalls(enabledDims, symbolCount, historyDays)`；否则禁止启用 high-frequency 维度 |
| 6 | 注册表与镜像一致性 | `npm run audit:skill-coverage` | 0 Missing / 0 Duplicate / 0 Path Not Exist |
| 7 | 治理目标与版本占位 | 明确治理场景落在 6 大场景哪一项 + 目标 sevenDimConfigStore / 采集器版本号 | 禁止无明确场景就改配置/阈值；作为 Phase 4 收尾对照 |

> **铁律**：上表任一项未通过 → 先修复前置问题，再推进。尤其 P4-P7 的 dry-run/字典/预算三项直接与生产超额风险挂钩，禁止跳过。

---

## 三、阶段化 SOP（按 Phase 0~4 组织，每阶段写目标 + 交付物清单 + 参数模板）

### Phase 0 — 治理基线快照与场景识别

**目标**：明确本次治理落在 6 大场景哪一/哪些，按严重度排优先级；把基线快照保存为事实，避免"改完说不清对不对"。

**交付物**：
1. **场景矩阵勾选**：
   ```
   □ Scenario A：7 维配置修改（启停维度 / 调整频率 / 切模板 / 自定义 priorityOverride）
   □ Scenario B：新数据源接入（BaseCollector 子类 / MCP 源 / Tushare 新接口 / IFind 字段 / WebSocket）
   □ Scenario C：降级阈值调整（QualityMetricsCollector / DegradationScorer 参数 / fallbackQueue 策略）
   □ Scenario D：API 月度预算再平衡（MonthlyBudgetGuard 额度分配 / 优先级权重表调整）
   □ Scenario E：Stock 字典增量重建（脚本新增/改字段 / Tushare 基础表升级 / ST/*ST 标识规则）
   □ Scenario F：CI 门禁失败修复（dry-run / build:stock-dict / collection-pipeline:prod FAIL）
   ```
2. **基线快照保存**：dry-run 报告（3 次平均） + 当前配置快照 + 字典 size + 预算余量
3. **严重度定级**：涉及「新增维度」「新增高频接口」「降级阈值放宽」= P0；调优参数类 = P1

### Phase 1 — 方案评估与参数设计（改代码前先评审阈值）

**目标**：所有数值型参数调整必须先给出「设计理由 + 影响评估」，禁止拍脑袋硬改常量。

**交付物三模板**：

**模板 1（Scenario A · 维度变更）**：
```
维度代码：[basic | valuation | tech | industry | macro | sentiment | news]
变更类型：启停 / 频率 / 模板切换 / priorityOverride
变更前：enabled=X / frequency=3600000 / template=full
变更后：enabled=Y / frequency=1800000 / template=trade
调用影响评估：↑/↓ XX%（引用 estimateDailyCalls 公式）
预算是否通过：Y/N（Phase 0 §5 日均 vs 变更后）
```

**模板 2（Scenario B · 新源接入）**：
```
Source 名称：<如 westock-mcp / tushare-new-interface>
Collector 子类：继承 BaseCollector？走 SourcePriorityManager？
接口成本：每次调用消耗 budget=X（参考同类接口）
真实取数成功率目标：≥ 0.95（同 Westock MCP）
降级策略：失败 → fallback = MockCollector(rate=0.3) ？
接线清单：
  □ SourcePriorityManager 优先级插入（位置：primary/secondary/fallback）
  □ adaptiveSourceOrchestrator.addSource()
  □ QualityMetricsCollector 登记 sourceId → score weight
  □ ACL（如外部 MCP 需加 read 放行行）
```

**模板 3（Scenario C · 降级阈值）**：
```
参数名：如 DegradationScorer.TRIGGER_SCORE / FALLBACK_EXPIRE_MS
原阈值：X
新阈值：Y
触发覆盖率变化：原每日 XX 次降级 → 新每日 YY 次
质量置信度变化：score 标准差 < 0.03 不影响真实取数 Y/N
真数据被挡概率评估：< 0.5% 安全通过
```

### Phase 2 — 实现与接线（按模板逐个修改）

**目标**：按 Phase 1 三个模板逐行落地，保证所有参数变更在审计脚本有留痕。

**关键动作清单**：
| 场景 | 修改文件 | 必跑验证 |
|------|---------|---------|
| A 配置 | `src/store/sevenDimConfigStore.ts` + `src/types/modules/collection.types.ts`（如改接口） | `tsc:prod` 0 错误 + dry-run |
| B 新源 | `src/services/data-collector/<SourceName>.ts`（继承 BaseCollector）+ `SourcePriorityManager.ts` + `adaptiveSourceOrchestrator.ts` + `crawlerProvider.ts` | dry-run + collection-pipeline:prod（全量） |
| C 阈值 | `DataIntegrityGuard.ts` / `qualityMetricsCollector.ts` / 对应 Scorer 文件 | dry-run 3 次 + diff score 分布 |
| D 预算 | `MonthlyBudgetGuard.ts` 常量 + 权重表（`budgetPriorityWeights`） | `MonthlyBudgetGuard.sanityCheck()` 单元测试 |
| E 字典 | `scripts/lib/stock-dict-builder/*.ts` | `build:stock-dict` 两次（消增量缓存）+ 缺失率 < 0.05% |
| F 修复 | 对应失败文件 + 相关 mock/桥接 | `test:services:collection-pipeline:prod` 100% PASS |

### Phase 3 — Dry-run 与字典双校验（变更后真实取数回归）

**目标**：3 次 dry-run 消除并发与缓存伪影；字典 2 次重建消除增量缓存；结果满足阈值才算完成。

**必跑命令矩阵**：
| 命令 | 次数 | 通过阈值 | 不通过的处理 |
|------|-----|---------|------------|
| `npm run tsc:prod` | 1 | 0 error | 先修类型，再跑 dry-run |
| `npm run audit:layers` | 1 | 0 违规 | architecture-cleanup 修复跨层 |
| `npm run data-collector:dry-run` | 3（连续） | 平均 score ≥ 0.90 + 无 FAIL stage + 调用次数 ≤ 预算 5% + std(score) ≤ 0.03 | 调低高频维度频率 + 检查新源是否挂 primary |
| `npm run build:stock-dict` | 2（连续） | 两次结果 size 一致 + 缺失率 ≤ 0.05% + 与上版 diff ≤ 5%（否则人工复核） | 检查字典 builder 的 Tushare/IFind 字段映射 |
| `npm run test:services:collection-pipeline:prod` | 1 | 100% PASS（与 collection-pipeline-testing Skill 协作） | 按该 Skill 的 16 条教训逐条定位 |

### Phase 4 — 契约收尾 + 决策留痕

**交付物打勾表（少一项都不算完）**：
- [ ] **配置变更记录**：将 Phase 1 的三个模板（Scenario A/B/C）写入本次变更 commit message 的 paragraph，或附 `deliverables/YYYY-MM-DD-collection-governance.md`
- [ ] **参数变更注释**：所有硬编码阈值（`DEGRADATION_TRIGGER_SCORE = 0.XX`）旁加 `// 2026-08-20 v1.0.0 调整原因：XXX`
- [ ] **AGENTS.md 同步**：若新增了「禁止模式」「强制命令」，写入 AGENTS.md 对应 section（非禁止级改动可跳过）
- [ ] **sevenDimConfigStore.ts 模板注释**：`generateDimensionsFromTemplate` 旁标注「默认模板经 v1.0.0 治理评审通过」
- [ ] **审计脚本一致性**：`audit:db-references` 若新增了 stockDict 新 Store 字段，同步 RULE 白名单
- [ ] **全量门禁报告**：tsc:prod / audit:layers / 3×dry-run / 2×dict / collection-pipeline:prod 六项全部通过
- [ ] **字典备份**：将 `data/stock-dict/stock-dict.lines` 复制到 `data/stock-dict/history/stock-dict-YYYYMMDD.lines`（单向保留 30 天）
- [ ] **预算余量快照**：`MonthlyBudgetGuard.getRemainingBudget()` 数值记录到变更注释中，作为下次比对基线
- [ ] **镜像同步**：`npm run skill:mirror`（加载器错位治理，将 `.agents/skills/*` 拷贝到 `.workbuddy/skills/`）
- [ ] **总结报告**：场景矩阵勾选表 + 阈值参数变更表 + dry-run/dict 双校验数据表

---

## 四、陷阱与经验教训（8 条，基于 7 维配置与字典 16 次实战踩坑提炼）

| # | 陷阱 | 后果 | 规避 |
|---|------|-----|-----|
| 1 | 改 sevenDimConfigStore 后**直接跳过 dry-run**，提交上 CI → 超额 API 调用当月预算用完 | 资金损失 + 主链路失败 | **Phase 2 改任何维度/频率/模板 → 强制 3 次 dry-run 通过再提交**（本 Skill §Phase 3 铁律） |
| 2 | `build:stock-dict` 只跑 1 次，被增量缓存欺骗 | 第二版字典字段缺失，生产扫 0.1% code 时误触发 FAIL 回滚 | **强制跑 2 次**，size 不一致就再跑，直到连续两次一致（缓存命中后的稳定版） |
| 3 | 新源接入只加 `crawlerProvider`，忘了同步 `SourcePriorityManager` 优先级插入 | 新源永远排 fallback 位，真实取数走不到，质量分数虚高 | **Scenario B 接线清单 5 项逐项打勾**，少一项都不允许 close |
| 4 | 降级阈值放宽（TRIGGER_SCORE 从 0.92→0.85）时**没有同步调整 FALLBACK_EXPIRE_MS** | 降级频繁触发 → fallback 队列写爆 IndexedDB | **阈值调整必须成对评估（trigger + expire + weight）**，单改一项 = 改前必跑质量置信度评估 |
| 5 | MonthlyBudgetGuard 额度调小时**只改常量没改 `budgetPriorityWeights` 权重表** | 高频维度权重仍为 1.0，优先级高的维度先被挡 → 主维度数据缺口 | Phase 1 Scenario D 模板明确「两表同步改：常量 + 权重表」；并跑 `MonthlyBudgetGuard.sanityCheck()` |
| 6 | sevenDimConfigStore 的 `dimensions` 改了 TS interface 但 `collection.types.ts` 不同步 | tsc:prod 在 services/data-collector/** 报 30+ 错误，错误链难定位 | **加载 type-safety-contract** 6 步契约，先改类型再改实现，反向会崩溃 |
| 7 | stockDict 增量重建脚本用了 `TSX 热加载`，但跑前没 `tsc:prod` 清增量缓存 → builder 实际用的是旧版 `dataLayerHelpers.queryStockByCode` 签名 | 字典 size 一致但字段是旧版，引发「新字段全 null」的隐性 bug | build:stock-dict **前必须先跑 `tsc:prod`**，字典脚本零 @ts-ignore |
| 8 | 新 MCP 源接入忘了同步 `mcpServerRegistry.ts` 的 `enabled` + `mcpAclMatrix.ts` UI/角色 ACL 放行 | production 模式下 MCP 被 MCP 拦截器拒 → 新源 dry-run 全失败 | **接入新 MCP 源 4 步同步**：server 注册 + 启用 ACL 矩阵 + UI 放行（若用）+ 本 Skill §三 Scenario B 接线清单全勾 |

---

## 五、完成交付物清单（必要且充分条件 · 12 项 · 少一项 = 未完成）

| # | 交付物 | 存在位置 | 验证方法 |
|---|--------|---------|---------|
| 1 | Phase 0 场景矩阵勾选快照 | commit message paragraph 或 `deliverables/YYYY-MM-DD-collection-governance.md` | grep 场景关键字（Scenario A/B/C/D/E/F）存在 |
| 2 | Phase 1 三个参数模板的「变更前/后/影响评估」 | 同上交付物文件 | 数值变更前后明确对比 + 影响评估说明完整 |
| 3 | sevenDimConfigStore 配置基线快照（维度 code/enabled/frequency 三元组） | `deliverables/YYYY-MM-DD-sevenDim-snapshot-before.json` + after.json | 两文件存在且 diff 与 Phase 1 模板一致 |
| 4 | Phase 3 三次 dry-run 报告（平均 score、调用、std） | dry-run 输出保存为 JSON / 文本 | 平均 score ≥ 0.90 + std ≤ 0.03 + 调用次数 ≤ 月度预算 5% |
| 5 | Phase 3 两次字典一致 + 缺失率 + 历史备份 | `data/stock-dict/stock-dict.lines` 与 `data/stock-dict/history/stock-dict-YYYYMMDD.lines` | `diff` 两次 size 一致，与上版 diff ≤ 5%，备份文件存在 |
| 6 | `tsc:prod` 0 error + `audit:layers` 0 违规 | CI 报告 / 命令输出 | 0 ERROR 0 WARN |
| 7 | `test:services:collection-pipeline:prod` 100% PASS | CI 报告 | 无 FAIL / 无 flaky 标记 |
| 8 | 所有阈值旁 `// 2026-08-21 v1.0.1 change reason:XXX` 注释 | 对应 TS 文件逐行 grep | 命中所有变更阈值常量 |
| 9 | `MonthlyBudgetGuard.sanityCheck()` 单元测试通过 | `npm run test:unit:quick -- MonthlyBudgetGuard` | PASS（100%） |
| 10 | `audit:skill-coverage` 0 Missing/Duplicate/NotExist | CI 报告 | 0 ERROR |
| 11 | 镜像同步 `skill:mirror` 完成 + registry mandatory 对齐 | `.workbuddy/skills/collection-pipeline-governance/SKILL.md` 存在；`.trae/skills/skill-registry.json` 中 `mandatory=false` 与本 Skill Frontmatter `mandatory=false` 一致 | `npm run audit:skill-coverage` 0 MISSING；grep 两者 mandatory 一致 |
| 12 | 总结报告（场景矩阵勾选表 + 阈值参数变更表 + dry-run/dict 双校验数据表） | 最终用户回复 / deliverables 交付文件 | 三张表均存在且数据与命令输出一致 |

> **必要且充分条件声明**：仅当上述 12 项全部满足，才算采集管线治理**完整交付**；任一不满足 = 「治理未完成」，不允许标记为交付结束，禁止在未通过前合入主干/部署到生产。
