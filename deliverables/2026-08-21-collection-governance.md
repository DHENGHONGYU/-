type: deliverable
domain: data-collection
doc\_id: V9-DELIVER-20260821-COLLECTION
title: 输入舱数据采集能力跃迁治理报告（维度 10-16 接线修复）
code\_version: "2.0.0-rc.2"
version: v1.2.0
last\_updated: 2026-08-22
change\_log:

* version: v1.2.0
  changes: "2026-08-22 第三轮+第四轮跃迁闭环：③ 维度 10 专用存储 sector\_collect\_data（DB\_VERSION 35→36，Store 53→54，ENVELOPE\_ACTION.saveSectorCollectData 四位置同步，validate:dataConsistency 类型映射补齐）；④ 采集本地文件即时落盘（用户原则：应采都采+及时存储+文件夹配置化）——新增 config/collectionFileStorage.ts 文件夹接口配置（16 维映射+命名模板）与 localFilePersistService.ts（永不抛出、Electron fileSync 落盘、浏览器降级不阻塞），collectionPipeline 四个写库成功点全接线，10 例单测全绿；七门禁全绿（tsc:prod/layers/acl/db-references/dataConsistency/blueprint/agents-consistency）"
  date: 2026-08-22

* version: v1.1.0
  changes: "2026-08-22 GAP-4 闭环：MonthlyBudgetGuard 补实现（15 例单测一次全绿 + sanityCheck），data-collector:dry-run / test:services:collection-pipeline:prod 两 npm 脚本落地，Skill 漂移消除；GAP-3 闭环：WESTOCK\_LIVE\_E2E=1 实测通过（可用率 100% 30/30，评级 A）；缺口4 复核：portfolioService.test.ts 已被并行会话修复，其 ragRetriever.ts 尚存 TS6133 在途错误（非本次引入）；六门禁实测全绿"
  date: 2026-08-22

* version: v1.0.0
  changes: "采集管线治理闭环：维度 10-14 dispatch 接线 + 维度 10-16 local\_docs 写入 ACL 修复 + dispatch 防漂移回归测试"
  date: 2026-08-21

***

# 输入舱数据采集能力跃迁治理报告（2026-08-21）

> ***
>
> 执行 Skill：`collection-pipeline-governance`（治理 SOP）+ `collection-pipeline-testing`（mandatory 门禁）
> 基线契约：AGENTS.md v1.7.1 / code\_version 2.0.0-rc.2 / DB\_VERSION=35

## 一、Phase 0 场景矩阵勾选

```
□ Scenario A：7 维配置修改（未涉及）
□ Scenario B：新数据源接入（未新增源；接线的 iFinD/Tencent MCP 映射 2026-08-17 已存在）
□ Scenario C：降级阈值调整（未涉及）
□ Scenario D：API 月度预算再平衡（未涉及额度调整；MonthlyBudgetGuard 已于 2026-08-22 补实现，GAP-4 闭环见 §六）
□ Scenario E：Stock 字典增量重建（未涉及）
☑ Scenario F：CI/运行时失败修复 —— 维度 10-14「已注册未接线」+ 维度 15/16 写入 ACL 拒绝
```

**严重度定级：P0**（full 模板默认启用 16 维，其中 7 维运行时必然失败，占比 44%）

## 二、问题诊断（真相源证据）

| GAP               | 现象                             | 根因（file:line 证据）                                                                                                                                                            |
| ----------------- | ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GAP-1 dispatch 断裂 | 维度 10/11/12/13/14 每次采集 100% 失败 | `DIMENSION_TO_MODE` 已映射 5 个 mode（collectionPipeline.ts:107-111，2026-08-17 接入），但 `runSingleTraceImpl` dispatch 只有 quote/kline/financial + 7 个非行情 mode，5 个新 mode 落入「未知采集模式」分支 |
| GAP-2 ACL 断裂      | 维度 15/16 写入必被拒                 | `DIMENSION_TO_ACTION` 将 15/16 路由到 `saveLocalDocs` → `local_docs`，但 `ACL_MATRIX[fetcher]` 的 read/write 均无 `localDocs`（全仓仅 system 模块可写），fail-closed 直接抛错                      |
| GAP-3 主键隐患        | 10-16 维度即使接线成功也会写入抛错           | `local_docs` keyPath=`id`，MCP/爬虫返回的维度数据无 `id` 字段，`PutHandler` db.put() 必抛                                                                                                   |
| GAP-4 治理工具缺失      | Skill 前置检查无法执行                 | `data-collector:dry-run`、`test:services:collection-pipeline:prod` 脚本与 `MonthlyBudgetGuard` 类在代码库中不存在（Skill 漂移，见 §五）                                                         |

**未接线的上下游其实早已就绪**：`mcpCollector.DIMENSION_MCP_MAPPING` 覆盖 01-14 全维度（mcpCollector.ts:341-420）；`multiSourceFetcher.fetchDimensionData` 入口已对 10-14 走 `collectNonNewsDimensionViaMcp`；`saveLocalDocs` 的 ENVELOPE\_ACTION / PutHandler / ACTION\_TO\_STORE\_MAP 四位置齐备。缺的只是 dispatch 最后一层 + ACL 放行 + id 兜底。

## 三、Phase 1 参数模板（Scenario F 修复方案）

```
修复对象：collectionPipeline dispatch + fetcher ACL + local_docs 写入兜底
变更前：维度 10-14 → 「未知采集模式」fail；维度 15/16 → ACL_PERMISSION_DENIED fail
变更后：维度 10-16 → handleNonQuoteMode → fetchDimensionData（iFinD MCP 优先）→ saveLocalDocs → local_docs
调用影响评估：每次 runCollection 新增 7 维度 × N 标的的真实 MCP 调用（原路径为立即失败，零调用）
预算是否通过：Y（原配置频率 2d/weekly 不变，月调用预估由 estimateTotalMonthlyCalls 既有逻辑覆盖）
存储选型说明：10 热门板块**刻意不写** hot_sector_scores —— 该 store 是双策略评分存储
  （keyPath=symbol，analyzer/dualStrategyStore 读写），写原始采集数据会覆盖策略评分；
  统一沿用 15/16 先例写 local_docs（by-symbol 索引可查，category=collection_dim_XX 可筛）。
```

## 四、变更清单（git diff --stat：2 文件 +48/-6，另新增 1 测试文件）

| 文件                                                                    | 变更                                                                                               |        |                                                                                                                                                                                                                                                                                                                       |
| --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ | ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/services/data-collector/collectionPipeline.ts`                   | ① `NonQuoteMode` 扩展 5 mode；② 新增导出 `NON_QUOTE_MODES` 集合替代                                         | <br /> | 长链；③ `DIMENSION_TO_ACTION` 补 10-14 → saveLocalDocs；④ `writeMockDimensionData` 补 storeForDim 10-16 映射 + id 缺失合成（`dim-{code}-{symbol}-{date}`）+ local\_docs schema 字段补齐（symbol/category/addedAt/name）；⑤ `auditRecord` requiredFields 增加 localDocs:['id']；⑥ modeLabel 补 5 项中文标签；⑦ dispatch 改 `NON_QUOTE_MODES.has(mode)` |
| `src/config/dbConfig.ts`                                              | `ACL_MATRIX[fetcher]` read/write 各增 `STORE_NAME.localDocs`（含 2026-08-21 修复注释，沿用 2026-07-18 先例格式） |        |                                                                                                                                                                                                                                                                                                                       |
| `src/services/data-collector/collectionPipeline.dispatch.test.ts`（新增） | 2 条回归断言：所有已配置维度 mode 必有 dispatch 分支；维度 10-16 全在 NON\_QUOTE\_MODES                                |        |                                                                                                                                                                                                                                                                                                                       |

## 五、门禁执行结果（变更前基线 → 变更后）

| 门禁                                            | 基线             | 变更后                                                                            | 结论                                                     |
| --------------------------------------------- | -------------- | ------------------------------------------------------------------------------ | ------------------------------------------------------ |
| `tsc -p tsconfig.prod.json --noEmit`          | 0 错误           | 0 错误                                                                           | ✅ PASS                                                 |
| `audit:layers`（audit-layer-calls.ts）          | 0 违规 / 1497 文件 | 0 违规                                                                           | ✅ PASS                                                 |
| `audit:acl-consistency`                       | —              | 0 ERROR 0 WARN（98 枚举覆盖检查通过）                                                    | ✅ PASS                                                 |
| `vitest run src/services/data-collector`      | —              | 12 文件 123 passed / 1 skipped                                                   | ✅ PASS                                                 |
| ├ 含 Phase 4 MCP 穿透 e2eWestockMcpChain         | —              | 4 passed / 1 skipped（ACL 放行 + 字段透传 + CLI 降级）                                   | ✅ PASS                                                 |
| `vitest run src/core/acl*.test.ts`（ACL 变更影响面） | —              | 3 文件 42 passed                                                                 | ✅ PASS                                                 |
| `tsc -p tsconfig.test.json --noEmit`          | —              | portfolioService.test.ts 3 个语法错误                                               | ⚠️ 非本次引入（该文件基线快照后被他会话改动，git 最后提交 3b0f210d；本次变更文件 0 错误） |
| Phase 5 真实 CLI Live E2E（WESTOCK\_LIVE\_E2E=1） | —              | 2026-08-22 实测通过：westock 连接可用率 **100%（30/30）**，综合质量 94.7，总体评级 **A**（≥ 95% 红线达标） | ✅ PASS                                                 |

## 六、遗留缺口（下一轮跃迁候选）

1. **~~GAP-4 治理工具链缺失~~**~~（P1）~~ **✅ 已闭环（2026-08-22）**：`src/services/data-collector/MonthlyBudgetGuard.ts` 补实现（纯函数式：月度预算推导 / 加权计划预估 / ok-warning-critical-exceeded 四级判定 / sanityCheck 自检，阈值口径与 Skill 触发条件 7 对齐）；`data-collector:dry-run`（tests/collection-dry-run.test.ts，5 模板 × 16 维静态接线四环校验，防「已注册未接线」漂移，报告落盘 outputs/collection-dry-run.json）与 `test:services:collection-pipeline:prod`（--mode production）两 npm 脚本落地。验证：`MonthlyBudgetGuard.test.ts` **15 例全绿** + dry-run 4 例全绿（full 模板 16/16 接线，计划 405 次/月 vs 预算 62000 次/月）+ `tsc:prod` / `audit:layers` / `audit:acl-consistency` / `audit:db-references` / `validate:blueprint`（53 Store / 984 接口）/ `validate:dataConsistency` 六门禁实测全绿。
2. **~~维度 10 的存储升级路径~~**~~（P2）~~ **✅ 已闭环（2026-08-22，第三轮）**：新增 `sector_collect_data` 专用 store（DB\_VERSION 35→36，Store 53→54），维度 10 采集数据脱离 local\_docs 过渡方案结构化落库；详见 §八。
3. **~~Live E2E 环境~~**~~（P1）~~ **✅ 已闭环（2026-08-22）**：`WESTOCK_LIVE_E2E=1` 真实取数实测通过——vitest 派生进程可正常拉起 CLI（npx 缓存复用），10 只股票维度 04/05/08 接入前后对比：westock 可用率 100%（30/30），04 公告/05 新闻综合 97.3，08 研报 89.6，评级 A；报告见 deliverables/E2E-westock-quality-report.md。
4. **并发编辑风险（持续观察）**：`portfolioService.test.ts` 的语法错误已被并行会话修复（tsc:test 该文件归零）；但其会话的 `ragRetriever.ts` 存在在途 TS6133（未使用变量）错误——非本次变更引入，交付前需并行会话自行清零。

## 七、能力跃迁结论

**修复前**：16 维配置注册，实际可成功采集 9 维（01/02/03-08/09），7 维恒失败（10-16）。
**修复后**：16 维全部具备真实采集通路（MCP 映射、fetcher、写入 action、ACL、主键兜底五层齐备），dispatch 完整性由回归测试锁死防漂移。

## 八、第三轮跃迁：维度 10 专用存储（2026-08-22，AGENTS.md v1.7.2）

**动因**：§六.2 遗留缺口——维度 10（热门板块）写 local\_docs 仅为过渡方案，下游结构化消费需要专用存储。

**变更（13 文件）**：

| 层 | 文件 | 变更 |
| --- | --- | --- |
| config | `src/config/dbConfig.ts` | DB\_VERSION 35→36；STORE\_NAME 53→54（基线 29 + 增量 25）；新增 `ENVELOPE_ACTION.saveSectorCollectData`；fetcher ACL 读写放行 |
| data | `db-schema.ts` / `db-migrations.ts` | ensureStore（keyPath=id + by-symbol/by-collected-at 索引）；v36 迁移标记 |
| data | `dataLayerContentStores.ts` / `dataLayer.ts` | `SectorCollectDataRecord` 内联类型 + `sectorCollectDataStore` 工厂 + 接线 |
| core | `databridge.ts` / `databridgeHandlers.ts` | ACTION\_TO\_STORE\_MAP 映射 + PutHandler 注册 |
| services | `collectionPipeline.ts` | 维度 10 改道 saveSectorCollectData；storeForDim '10'→sectorCollectData；字段补齐（symbol/dimensionCode/collectedAt/source）；auditRecord 规则 ['id','symbol'] |
| 门禁脚本 | `validate-data-blueprint.ts` / `validate-data-consistency.ts` | expectedStores=54；STORE\_TO\_TYPE\_MAP 补 sector\_collect\_data→SectorCollectDataRecord |
| 测试 | `tests/collection-dry-run.test.ts` | 静态接线映射表补新 action |
| 契约文档 | `AGENTS.md`（v1.7.2）+ Wiki×4 + S05/S07 | 全部 DB\_VERSION/Store 数字面量同步 36/54（审计脚本要求全仓一致） |

## 九、第四轮跃迁：采集本地文件即时落盘（2026-08-22，AGENTS.md v1.7.3）

**用户原则**：采集来源稳定可采集、采集内容可存储、应采都采、采集**及时存储当地文件**，且当地文件夹必须有**对应的文件夹接口配置**。

**设计**：

```
src/config/collectionFileStorage.ts        ← 文件夹接口配置（config 层单一真相源）
    rootDir = 'outputs/collected-data'
    dimensions: '01'-'16' → { folder, filePattern, enabled }
    命名模板占位符：{symbol} {date} {dimension}
    目录约定与 collectedDataSyncService 批量导出同树：{rootDir}/{symbol}/{维度文件夹}/{文件}

src/services/data-collector/localFilePersistService.ts  ← 即时落盘服务
    persistCollectedDataToLocalFile()：永不抛出契约
      Electron 环境 → window.fileSync.writeFiles IPC 写真实文件系统
      纯浏览器环境 → warn 降级跳过，绝不阻塞采集主链路
    落盘信封：{ _meta:{symbol,dimensionCode,source,collectedAt,version}, data }
```

**接线点（collectionPipeline 四个写库成功路径全覆盖）**：

| 维度 | 写库函数 | 落盘时机 |
| --- | --- | --- |
| 01 行情 | `writeQuoteToStock` | updateStock 成功 + insertStock 成功双路径 |
| 02 K线 | `writeKlineToDailyQuotes` | saveDailyQuotes 成功后 |
| 03–08 / 10–16 | `writeMockDimensionData`（统一写入入口） | forward 成功后 |
| 09 财务 | `handleFinancialMode` | fetchFinancial 写库后，同一份返回数据落盘 |

**验证**：`localFilePersistService.test.ts` 10 例单测全绿（browser-env 降级 / 维度未登记 / 成功路径路径与信封断言 / success:false / IPC 抛异常 / 总开关 / 16 维配置完整性 / 占位符替换）；七门禁全绿——`tsc:prod`=0、`audit:layers`=0、`audit:acl-consistency`=0 ERROR 0 WARN、`audit:db-references`=0、`validate:dataConsistency` exit 0（54 Store）、`audit:agents-consistency` 全部断言通过、vitest（落盘 10 + dry-run 4 + 管线 37 + 批量同步 21）全绿。

**与批量导出的分工**：本服务管「采后即存」（每链路写库成功立即落盘）；`collectedDataSyncService` 管「整批归档 + 汇总报告」（批次目录 + \_summary.md）。两者共用同一目录树，互为补充。
