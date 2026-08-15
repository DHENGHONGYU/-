---
title: "ACL 权限清理与文档死链修复操作日志"
type: report
status: archived
version: v1.0.0
last_updated: 2026-08-11
doc_id: V9-DOC-FM-DOCS-REPORTS-ACL-CLEANUP-AND-DOC-FIX-LOG-001
tier: T2
maintainer: V9 Architecture Team
summary: "（自动补齐 frontmatter，待人工完善摘要）"
change_log:
  - version: v1.0.0
    changes: "补齐 frontmatter 元数据（baseline 2026-08-11，自动推断 type=report）"
    date: 2026-08-11
code_version: 2.0.0-rc.1
---
# ACL 权限清理与文档死链修复操作日志

> **操作批次编号**: ACL-DOC-FIX-20260809-01
> **执行时间**: 2026-08-09（Asia/Shanghai）
> **执行工具**: TRAE / GLM-5.2
> **关联文档**: `docs/archive/duplicate-docs-cleanup-20260809-175358/OPERATION-LOG.md`（前置重复文档清理批次 DC-20260809-01）

---

## 一、操作摘要

本次操作包含三大任务：
1. **ACL 权限最小化（news 模块）**：从 `MODULE_ID.news` 移除冗余的八域资料 Store 权限（profileItems/profileTags）
2. **ACL 权限最小化（tradinghub 模块）**：从 `MODULE_ID.tradinghub` 移除冗余的 hotSectorScores/valuePitScores read+write 权限
3. **文档死链修复**：修复 DC-20260809-01 批次归档 8 份重复文档后遗留的 5 处文档死链引用

---

## 二、权限变更详情

### 2.1 变更文件

| 文件 | 变更类型 |
|------|----------|
| `src/config/dbConfig.ts` | ACL_MATRIX 权限缩减 |

### 2.2 变更内容

**模块**: `MODULE_ID.news`

| 权限维度 | 变更前 | 变更后 | 移除项 |
|----------|--------|--------|--------|
| `read` | stocks, news, newsStockMap, sentimentCache, newsBookmarks, **profileItems**, **profileTags** | stocks, news, newsStockMap, sentimentCache, newsBookmarks | profileItems, profileTags |
| `write` | news, newsStockMap, sentimentCache, newsBookmarks, **profileItems**, **profileTags** | news, newsStockMap, sentimentCache, newsBookmarks | profileItems, profileTags |
| `actions` | select, insert, update, delete | select, insert, update, delete | （无变更） |

**移除权限数**: 4 项（read × 2 + write × 2）

### 2.3 移除理由

B2 审计确认 `news` 模块从不读写八域资料 Store：
- `src/services/news/` 目录下零处 profileItems/profileTags/scoreEvidence/stockProfiles 引用
- 所有 `saveProfileItem`/`saveProfileTag`/`saveScoreEvidence`/`saveStockProfile` 调用均由 `analyzer` 模块经 `src/services/profile/*.ts` 发起
- `analyzer` 模块已拥有完整的八域 Store read+write 权限（dbConfig.ts L428-L445）

此前授予 `news` 模块的 profileItems/profileTags 权限为冗余配置，构成权限孤岛。

### 2.4 tradinghub 模块权限变更

**模块**: `MODULE_ID.tradinghub`

| 权限维度 | 变更前 | 变更后 | 移除项 |
|----------|--------|--------|--------|
| `read` | stocks, v6Scores, orders, signals, strategySnapshots, **hotSectorScores**, **valuePitScores** | stocks, v6Scores, orders, signals, strategySnapshots | hotSectorScores, valuePitScores |
| `write` | orders, signals, strategySnapshots, **hotSectorScores**, **valuePitScores** | orders, signals, strategySnapshots | hotSectorScores, valuePitScores |
| `actions` | insert, update, delete | insert, update, delete | （无变更） |

**移除权限数**: 4 项（read × 2 + write × 2）

### 2.5 移除理由

全仓 Grep 确认 tradinghub 模块零代码引用 hotSectorScores/valuePitScores：
- `saveHotSectorScores` 实际写入方为 `analyzer`（`sendWriteEnvelope('saveHotSectorScores', score, 'analyzer')`，见 dataLayerScoreStores.ts:106）
- `saveValuePitScores` 实际写入方为 `analyzer`（`sendWriteEnvelope('saveValuePitScores', score, 'analyzer')`，见 dataLayerScoreStores.ts:120）
- `dualStrategyStore` 查询 hotSectorScores/valuePitScores 时使用 `MODULE_ID.strategy` 作为 source，而非 tradinghub
- tradinghub 实际使用的 Store：orders（insertOrder）、signals（insertSignal）、strategySnapshots（saveStrategySnapshots）、executionPlans（queryList/updateExecutionPlan）、stocks（queryGet）、v6Scores（queryGet）

---

## 三、文档死链修复详情

### 3.1 修复脚本

| 文件 | 变更类型 | 说明 |
|------|----------|------|
| `scripts/fix/fix-doc-refs.ts` | 路径解析修复 | `ROOT` 从 `resolve(__dirname, '..')` 改为 `resolve(__dirname, '..', '..')`，修正脚本位于 `scripts/fix/` 子目录导致的根路径偏移 |

脚本已以 dry-run 模式运行（`--scope all`），但因归档文件 basename 与保留版不同（如 `NEWS_DATA_DEFINITION.md` → `news/DATA_DEFINITION.md`），basename 匹配策略不适用，改为手动修复。

### 3.2 修复的 5 处文档死链（OPERATION-LOG §3.2 清单）

| # | 文件 | 修复内容 | 死链数 |
|---|------|----------|--------|
| 1 | `docs/meta/doc-id-registry.md` | 已在之前修复（无死链残留） | 0 |
| 2 | `docs/guides/how-to/FILE-MANAGEMENT-GUIDE.md` | 已在之前修复（大写字典名 → 保留版 kebab-case 路径） | 0 |
| 3 | `docs/reference/data-dictionary-index.md` | 已在之前修复（NewsArticle 双路径 → 仅保留 news/DATA_DEFINITION.md） | 0 |
| 4 | `docs/_redirect-map.json` | 新增 9 条归档重定向规则（D1-D8） | 9 |
| 5 | `docs/meta/文件整理清单.md` | 修复 §4.3/§二/§三/引用计数表中的死链路径 | 17 |

### 3.3 `docs/meta/文件整理清单.md` 死链修复明细

| 位置 | 原路径（死链） | 修正后路径 |
|------|----------------|------------|
| §4.3 L148 | `docs/V9数据宪法.md` | `docs/reference/V9数据宪法.md` |
| §4.3 L149 | `docs/《V9核心数据字典与类型定义（整合版）》.md` | `docs/reference/v9核心数据字典与类型定义(整合版).md` |
| §4.3 L150 | `docs/《V9现有数据资产清单》.md` | `docs/reference/《V9现有数据资产清单》.md` |
| §4.3 L151 | `docs/《功能模块数据契约》.md` | `docs/reference/《功能模块数据契约》.md` |
| §4.3 L152 | `docs/DATA_DICTIONARY_INDEX.md` | `docs/reference/data-dictionary-index.md` |
| §4.3 L153 | `docs/数据治理路线图.md` | `docs/reference/数据治理路线图.md` |
| §4.3 L154 | `docs/V9_数据血缘追踪.md` | `docs/reference/v9-数据血缘追踪.md` |
| §4.3 L155 | `docs/V9_IndexedDB_Store_Schema.md` | `docs/reference/v9-indexeddb-store-schema.md` |
| §4.3 L156 | `docs/DATAFLOW_DATA_DEFINITION.md` | `docs/explanation/dataflow-data-definition.md` |
| §4.3 L157 | `docs/AI_CENTER_DATA_DEFINITION.md` | `docs/explanation/ai-center-data-definition.md` |
| §4.3 L158 | `docs/NEWS_DATA_DEFINITION.md` | `docs/reference/news/DATA_DEFINITION.md` |
| §二 L34 | `docs/《V9现有数据资产清单》.md`（保留列） | `docs/reference/《V9现有数据资产清单》.md` |
| §二 L35 | `docs/《V9核心数据字典与类型定义（整合版）》.md`（保留列） | `docs/reference/v9核心数据字典与类型定义(整合版).md` |
| §三 L101 | `./reference/V9现有数据资产清单.md`（删除列） | 标注"已归档至 archive/duplicate-docs-cleanup-20260809-175358/" |
| §三 L102 | `docs/V9核心数据字典与类型定义（整合版）.md`（删除列） | 标注"已归档至 archive/duplicate-docs-cleanup-20260809-175358/" |
| 引用计数表 L338 | `docs/《V9现有数据资产清单》.md` | `docs/reference/《V9现有数据资产清单》.md` |
| 引用计数表 L343 | `docs/NEWS_DATA_DEFINITION.md` | `docs/reference/news/DATA_DEFINITION.md` |

### 3.4 `docs/reference/《V9现有数据资产清单》.md` 死链修复

| 行号 | 原路径（死链） | 修正后路径 |
|------|----------------|------------|
| L440 | `docs/NEWS_DATA_DEFINITION.md` | `docs/reference/news/DATA_DEFINITION.md` |

### 3.5 `docs/_redirect-map.json` 新增重定向规则

| # | old_path | new_path | 归档原因 |
|---|----------|----------|----------|
| D1 | `docs/reference/V9现有数据资产清单.md` | `docs/reference/《V9现有数据资产清单》.md` | 保留《》版（v2.2） |
| D2 | `docs/reference/SEVEN_DIM_CONFIG_DATA_DEFINITION.md` | `docs/reference/seven-dim-config-data-definition.md` | 保留 kebab-case 版 |
| D3a | `docs/reference/NEWS_DATA_DEFINITION.md` | `docs/reference/news/DATA_DEFINITION.md` | 保留 news/ 子目录版（v1.2.0） |
| D3b | `docs/reference/news-data-definition.md` | `docs/reference/news/DATA_DEFINITION.md` | 保留 news/ 子目录版（v1.2.0） |
| D4 | `docs/reference/功能模块数据契约.md` | `docs/reference/《功能模块数据契约》.md` | 保留《》版（含 changelog） |
| D5 | `docs/reference/V9_数据血缘追踪.md` | `docs/reference/v9-数据血缘追踪.md` | 保留小写前缀版 |
| D6 | `docs/reference/《V9核心数据字典与类型定义（整合版）》.md` | `docs/reference/v9核心数据字典与类型定义(整合版).md` | 保留无书名号版 |
| D7 | `docs/reference/MULTI_FACTOR_SCREENING_DATA_DEFINITION.md` | `docs/reference/multi-factor-screening-data-definition.md` | 保留 kebab-case 版 |
| D8 | `docs/reference/V9_IndexedDB_Store_Schema.md` | `docs/reference/v9-indexeddb-store-schema.md` | 保留 kebab-case 版 |

---

## 四、所有修改文件清单

| # | 文件路径 | 修改类型 | 说明 |
|---|----------|----------|------|
| 1 | `src/config/dbConfig.ts` | 权限缩减 | news 模块移除 profileItems/profileTags read+write；tradinghub 模块移除 hotSectorScores/valuePitScores read+write |
| 2 | `scripts/fix/fix-doc-refs.ts` | 路径修复 | ROOT 路径解析修正 |
| 3 | `docs/meta/文件整理清单.md` | 死链修复 | 17 处死链路径修正 |
| 4 | `docs/reference/《V9现有数据资产清单》.md` | 死链修复 | 1 处死链路径修正 |
| 5 | `docs/_redirect-map.json` | 重定向规则 | 新增 9 条归档重定向规则 |
| 6 | `docs/reference/《DataBridge端点与数据映射清单》.md` | ACL 同步 | v1.3.0 → v1.3.1：§2.12 移除 news write 权限声明；§6.1/§7 移除 tradinghub 订阅方 |

---

## 五、验证结果

### 5.1 ACL 一致性审计（news + tradinghub 变更后最终结果）

```
npm run audit:acl-consistency
=== ACL 权限矩阵一致性审计 ===
ACTION_TO_STORE_MAP: 87 条映射
ACL_MATRIX: 20 个模块
dataBridge.forward() 调用: 25 处
Handler 注册 action: 81 个
ENVELOPE_ACTION 枚举: 91 个
--- 检查 1: forward() 调用 ACL 权限 ---
  检查 25 处调用，发现 0 处违规
--- 检查 2: action handler 注册完整性 ---
  检查 87 条映射，发现 0 处未注册
--- 检查 3: ENVELOPE_ACTION 枚举覆盖度 ---
  检查 91 个枚举值，发现 0 处可疑
=== 审计通过：0 ERROR, 0 WARN ===
```

### 5.2 TypeScript 类型检查

`npx tsc --noEmit` — 无 dbConfig/ACL_MATRIX/MODULE_ID.news/MODULE_ID.tradinghub 相关错误（全部错误均为预存测试文件问题）

### 5.3 关键测试套件

| 测试文件 | 测试数 | 结果 |
|----------|--------|------|
| `tests/databridge.test.ts` | — | ✅ 通过 |
| `tests/databridgeStore.test.ts` | 8 | ✅ 通过 |
| `tests/databridgePriority.test.ts` | — | ✅ 通过 |
| `tests/databridgeAdapter.test.ts` | — | ✅ 通过 |
| `tests/newsService.test.ts` | 11 | ✅ 通过 |
| `tests/__tests__/integration/pool-acl.integration.test.ts` | — | ✅ 通过 |
| `tests/__tests__/integration/mcp-acl-scenarios.integration.test.ts` | — | ✅ 通过 |
| `src/config/dbConfig.test.ts` | — | ✅ 通过 |
| **合计（首轮 news 验证）** | **117** | **全部通过** |
| **合计（tradinghub 追加验证）** | **103** | **全部通过** |

### 5.4 全量集成测试

```
Test Files  25 failed | 515 passed (540)
Tests  77 failed | 8785 passed | 21 skipped (8883)
```

25 个失败文件均为预存的 UI 组件问题（React Router context、Widget type 不匹配等），与本次 ACL/文档修改无关。

---

## 六、其他模块 ACL 权限审计

### 6.1 审计方法

对 ACL_MATRIX 中全部 20 个模块，交叉比对 `dataBridge.forward()` / `dataBridge.query()` 调用中的 `source` 字段与实际 Store 访问，识别"声明了但未使用"的冗余权限。

### 6.2 审计结果

| 模块 | 状态 | 说明 |
|------|------|------|
| fetcher | ✅ 正常 | 权限均有代码注释说明，与 8 维度采集目标对齐 |
| pool | ✅ 正常 | read+write stocks，read v6Scores/traceRecords 均有使用 |
| analyzer | ✅ 正常 | 八域 Store 权限由 src/services/profile/*.ts 实际使用 |
| rotation | ✅ 正常 | — |
| sector | ✅ 正常 | — |
| **news** | ✅ **已修复** | profileItems/profileTags 冗余权限已移除 |
| **tradinghub** | ✅ **已修复** | hotSectorScores/valuePitScores read+write 冗余已移除（详见 §6.3） |
| trading | ✅ 正常 | strategySnapshots 仅 read，write 仅 orders/signals |
| system | ✅ 正常 | 超级用户，全 Store 权限 |
| **user** | ⚠️ **疑似冗余** | stocks/orders write 疑似冗余（详见 §6.4） |
| strategy | ✅ 正常 | hotSectorScores/valuePitScores write 经 databridgeStrategyRouter 间接使用 |
| orderstore | ✅ 正常 | — |
| holdingsStore | ✅ 正常 | — |
| executionPlans | ✅ 正常 | — |
| executionLogs | ✅ 正常 | — |
| missingReports | ✅ 正常 | — |
| portfolios | ✅ 正常 | — |
| tradeReviews | ✅ 正常 | — |
| datalayer | ✅ 正常 | 全 Store 只读，数据访问层 |
| rbac | ✅ 正常 | — |

### 6.3 tradinghub 模块冗余权限（已修复 ✅）

| 权限 | Store | 代码引用 | 实际写入方 | 结论 | 处理 |
|------|-------|----------|------------|------|------|
| write | hotSectorScores | **零引用** | analyzer（`sendWriteEnvelope('saveHotSectorScores', score, 'analyzer')`） | **冗余** | ✅ 已移除 |
| write | valuePitScores | **零引用** | analyzer（`sendWriteEnvelope('saveValuePitScores', score, 'analyzer')`） | **冗余** | ✅ 已移除 |
| read | hotSectorScores | **零引用** | dualStrategyStore 使用 `MODULE_ID.strategy` 查询 | **冗余** | ✅ 已移除 |
| read | valuePitScores | **零引用** | dualStrategyStore 使用 `MODULE_ID.strategy` 查询 | **冗余** | ✅ 已移除 |

tradinghub 模块实际使用的 Store：orders（insertOrder）、signals（insertSignal）、strategySnapshots（saveStrategySnapshots）、executionPlans（queryList/updateExecutionPlan）、stocks（queryGet）

**处理结果**: 已从 tradinghub 的 read+write 数组移除 hotSectorScores 和 valuePitScores（共 4 项冗余权限）。ACL 审计 0 ERROR，关键测试 103/103 通过。

### 6.4 user 模块疑似冗余权限（需进一步确认）

| 权限 | Store | 代码引用 | 结论 |
|------|-------|----------|------|
| write | stocks | **零引用**（仅 customAgentService 使用 customAgents） | 疑似冗余 |
| write | orders | **零引用** | 疑似冗余 |
| read | stocks | **零引用** | 疑似冗余 |
| read | v6Scores | **零引用** | 疑似冗余 |
| read | orders | **零引用** | 疑似冗余 |

user 模块实际仅使用 `customAgents` Store（`saveCustomAgent`/`deleteCustomAgent`）。

**建议**: 需进一步确认是否存在动态模块解析或间接调用路径，确认后可移除 stocks/orders/v6Scores 的 read+write 权限（共 5 项疑似冗余）。

---

## 七、安全过程验证

| 阶段 | 执行 | 结果 |
|------|------|------|
| 1. 备份基线 | ACL 修改前确认 analyzer 模块已有完整八域权限；确认 tradinghub 实际使用的 Store 不含 hotSectorScores/valuePitScores | ✅ |
| 2. 影响分析 | Grep 确认 news 服务零八域引用；Grep 确认 tradinghub 零 hotSectorScores/valuePitScores 引用 | ✅ |
| 3. 执行（news） | 从 news read+write 移除 profileItems/profileTags | ✅ |
| 3b. 执行（tradinghub） | 从 tradinghub read+write 移除 hotSectorScores/valuePitScores | ✅ |
| 4. 链接重写 | 手动修复 5 处文档死链 + 9 条重定向规则 | ✅ |
| 5. 文档同步 | 《DataBridge 端点与数据映射清单》v1.3.0 → v1.3.1：§2.12 移除 news write 声明；§6.1/§7 移除 tradinghub 订阅方 | ✅ |
| 6. 验证 | ACL 审计 0 ERROR + 关键测试 117+103 通过 | ✅ |
| 7. 回归确认 | 全量测试 8785/8883 通过，失败均为预存问题 | ✅ |
