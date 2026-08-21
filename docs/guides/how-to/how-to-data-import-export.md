---
title: "如何导入导出与备份 V9 数据"
domain: project
status: active
last_updated: 2026-08-22
code_version: 2.0.0-rc.2
version: v1.0.1
change_log:
  - version: v1.0.1
    changes: "基准日校对(2026-08-22)：R1取真值(P2 正文版本声明行=v1.0.0) → R2 PATCH++(v1.0.1) / last_updated 刷新 / change_log 闭环"
    date: 2026-08-22
---
covers_code:
  - src/config/dbConfig.ts
  - src/data/db-migrations.ts


---
title: 如何导入导出与备份 V9 数据
type: how-to
domain: data
phase: deployment
tier: standard
status: active
maintainer: V9 Architecture Team
summary: "面向日常运维场景的 V9 数据导入导出操作指南，覆盖 IndexedDB 全量导出、JSON 备份恢复、数据重置与跨版本迁移"
tags: [data, import, export, backup, migration, indexeddb]
version: v1.0.0
last_updated: 2026-07-19
code_version: "2.0.0-rc.2"
doc_id: V9-DOC-DATA-078
related_docs: [V9-DOC-DATA-035, V9-DOC-DATA-069]
referenced_by: [V9-DOC-PROJ-349]
change_log:
  - version: v1.0.0
    changes: Initial version established
    date: 2026-07-19
---

# 如何导入导出与备份 V9 数据

> **版本**：v1.0.0  
> **更新日期**：2026-07-19  
> **适用范围**：需要对 V9 本地 IndexedDB 数据进行导出备份、导入恢复、数据重置或跨版本迁移的用户与开发者
---

## 前置检查清单

开始操作前，请逐项确认以下前置条件：

- [ ] 已了解 V9 数据全部存储在浏览器本地 IndexedDB 中
- [ ] 已具备 IndexedDB 基础概念（数据库 / Store / 版本）
- [ ] 了解 V9 采用 DataBridge 信封化写入架构
- [ ] 导入前已对当前数据完成一次导出备份
- [ ] 已阅读 [ADR-002: IndexedDB vs localStorage](../../reference/adr-002-indexeddb-over-localstorage.md)
- [ ] 已阅读 [数据库迁移 v4 到 v6](../../archive/historical-2026-08-16/batch8/db-migration-v4-to-v6.md（已归档）)

---

## 数据存储概览

### 1.1 数据库基本信息

| 配置项 | 值 | 说明 |
|------|----|------|
| 数据库名称 | `V6ProDB` | 统一定义于 `DB_NAME` 常量 |
| 数据库版本 | `32` | 当前 Schema 版本，见 `DB_VERSION` |
| 存储引擎 | IndexedDB | 浏览器本地持久化存储 |
| Store 数量 | 50+ | 按业务域划分的数据表 |

> **配置锚点**：`src/config/dbConfig.ts` 统一定义 `DB_NAME`、`DB_VERSION` 与 `STORE_NAME` 常量。

### 1.2 核心 Store 分组

| 数据域 | 代表 Store | 数据量级 |
|----------|-----------|-----------|
| 股票基础信息 | `stocks` | 全市场 ~ 数千条 |
| 行情数据 | `dailyQuotes` | 每股票 ~ 多年 K 线 |
| 财报数据 | `financialReports` | 每股票 ~ 数十条 |
| 评分结果 | `v6Scores` / `hotSectorScores` / `valuePitScores` | 每股票 ~ 数十条 |
| 新闻舆情 | `news` / `newsStockMap` / `sentimentCache` | 高频 ~ 持续累积 |
| 交易持仓 | `orders` / `portfolios` / `tradeReviews` | 用户操作数据 |
| 配置与治理 | `collectConfig` / `schemaMigrations` / `rbac_*` | 小体量 |
| 画像体系（v32 新增） | `stockProfiles` / `profileItems` / `scoreEvidence` / `profileTags` | 评分证据与画像数据 |

---

## 场景 1：全量数据导出

### 1.1 通过 UI 导出（推荐）

**操作步骤**：

1. 打开 V9 应用主界面
2. 进入数据管理 / 设置面板，找到「数据导出」入口
3. 选择导出范围（默认全量 Store）
4. 点击导出按钮，浏览器将自动下载 JSON 备份文件
5. 下载完成后校验文件大小与内容，确认非空且 JSON 可解析

**导出文件规范**：
- **格式**：JSON，UTF-8 编码
- **内容**：全部业务 Store 的键值数据
- **命名**：`v9-export-YYYYMMDD-v{DB_VERSION}.json`
- **体积**：通常 1MB ~ 50MB，视行情与新闻数据累积量而定

### 1.2 通过代码导出

```typescript
import { dataBridge } from '@/core/databridge'
import { EnvelopeFactory } from '@/core/envelope'
import { ENVELOPE_ACTION, ENVELOPE_TARGET, MODULE_ID } from '@/config/dbConfig'

const envelope = EnvelopeFactory.create(
  {
    source: MODULE_ID.system,
    target: ENVELOPE_TARGET.db,
    action: ENVELOPE_ACTION.exportAll,
    traceId: `export-${Date.now()}`,
  },
  {},
)

const result = await dataBridge.forward(envelope)
// result.payload 为全部 store 的导出数据
// { stocks: [...], dailyQuotes: [...], v6Scores: [...], ... }

// 触发浏览器下载
const blob = new Blob([JSON.stringify(result.payload, null, 2)], { type: 'application/json' })
const url = URL.createObjectURL(blob)
const a = document.createElement('a')
a.href = url
a.download = `v9-export-${new Date().toISOString().slice(0, 10)}-v32.json`
a.click()
URL.revokeObjectURL(url)
```

### 1.3 导出质量检查清单

导出完成后，请逐项确认：

- [ ] 文件大小 > 0，非空文件且下载完整
- [ ] JSON 可正常解析，无截断或编码错误
- [ ] 关键业务 Store 均存在（`stocks`、`dailyQuotes`、`v6Scores` 等）
- [ ] 导出时间与数据最新时间一致
- [ ] 元信息 `_meta.version` 与当前 `DB_VERSION`（32）一致

---

## 场景 2：数据导入恢复

### 2.1 导入前必读

> ⚠️ **重要提醒**：导入操作会覆盖现有数据，执行前务必先完成一次全量导出备份。

导入前检查清单：

- [ ] 已完成当前数据的全量导出备份
- [ ] 备份文件来源可信，未经过手工篡改
- [ ] 备份文件版本与当前数据库版本兼容（见 2.4 兼容性矩阵）
- [ ] 当前无正在进行的采集或评分任务（建议空闲 2 分钟以上再导入）
- [ ] 已知晓导入为覆盖式写入，旧数据不可恢复

### 2.2 通过 UI 导入

**操作步骤**：

1. 打开 V9 应用，进入数据管理 / 设置面板
2. 找到「数据导入」入口
3. 选择本地 JSON 备份文件
4. 系统自动解析并校验文件格式与版本兼容性
5. 确认导入摘要（记录数、跳过数）后执行导入
6. 导入完成后刷新页面，核对关键数据是否恢复

### 2.3 通过代码导入

```typescript
import { dataBridge } from '@/core/databridge'
import { EnvelopeFactory } from '@/core/envelope'
import { ENVELOPE_ACTION, ENVELOPE_TARGET, MODULE_ID } from '@/config/dbConfig'

// 读取备份文件
const file = input.files[0]
const text = await file.text()
const data = JSON.parse(text)

// 构造导入信封
const envelope = EnvelopeFactory.create(
  {
    source: MODULE_ID.system,
    target: ENVELOPE_TARGET.db,
    action: ENVELOPE_ACTION.importAll,
    traceId: `import-${Date.now()}`,
  },
  data,
)

const result = await dataBridge.forward(envelope)
console.log(`导入完成：写入 ${result.imported} 条，跳过 ${result.skipped} 条`)
```

### 2.4 版本兼容性矩阵

| 备份版本 → 当前版本 | 兼容性 | 处理方式 |
|---------------------|--------|------|
| v32 → v32 | ✅ 完全兼容 | 直接导入 |
| v31 → v32 | ✅ 兼容 | 自动补 v31→v32 迁移（新增画像体系 Store） |
| v30 → v32 | ✅ 兼容 | 链式迁移（v30→v31→v32） |
| v29 → v32 | ⚠️ 部分兼容 | 建议先升级到中间版本 |
| v28 及更早 | ❌ 不直接支持 | 需借助历史版本应用逐步升级后导出 |

> **迁移机制说明**：导入时系统会读取备份文件的 `DB_VERSION`，若低于当前版本则自动执行 `runMigrations` 链式迁移，逐版本补齐 Schema 差异后再写入数据。

### 2.5 冲突处理策略

导入时若目标 Store 已存在相同 symbol / 主键的记录，按以下策略处理：

| 策略 | 行为 | 适用场景 |
|------|------|---------|
| 覆盖（默认） | 新记录直接覆盖旧记录 | 恢复备份、数据回滚 |
| 跳过 | 保留旧记录，跳过新记录 | 合并多来源数据 |
| 合并 | 字段级合并，新值优先 | 增量补数 |

> 具体策略以导入 UI 选项为准；代码导入时默认采用覆盖策略，请在导入前自行评估数据冲突风险。

---

## 场景 3：数据重置清空

### 3.1 什么情况下需要重置

以下场景可考虑重置本地数据：

- 数据库结构损坏，应用反复报错
- 数据污染严重，需要从零重建
- 更换使用环境，需要清空旧数据
- 迁移测试后需要回到干净初始状态
- 调试 Schema 迁移逻辑需要干净基线

### 3.2 重置前必读

> ⚠️ **重置操作不可逆，数据将无法恢复**

```typescript
// 重置前必须先完成全量导出备份
// 无备份的重置 = 数据永久丢失
```

### 3.3 重置操作方式

**方式一：通过 UI 重置**

1. 打开 V9 应用，进入数据管理 / 设置面板
2. 找到「数据重置」入口
3. 阅读风险提示，输入确认文本或勾选确认框
4. 执行重置并等待完成

**方式二：通过浏览器开发者工具清空**

1. 按 F12 打开开发者工具
2. 切换到 Application（Chrome）或 Storage（Firefox）面板
3. 展开 IndexedDB → `V6ProDB`
4. 右键选择删除数据库
5. 刷新页面重建

**方式三：通过代码重置**

```typescript
import { dataBridge } from '@/core/databridge'
import { EnvelopeFactory } from '@/core/envelope'
import { ENVELOPE_ACTION, ENVELOPE_TARGET, MODULE_ID } from '@/config/dbConfig'

const envelope = EnvelopeFactory.create(
  {
    source: MODULE_ID.system,
    target: ENVELOPE_TARGET.db,
    action: ENVELOPE_ACTION.resetAll,
    traceId: `reset-${Date.now()}`,
  },
  {},
)

await dataBridge.forward(envelope)
```

### 3.4 重置后验证清单

重置完成后，请逐项确认：

- [ ] 应用可正常启动，无白屏或初始化报错
- [ ] 数据库自动重建完成
- [ ] Schema 版本自动迁移至最新版（v32）
- [ ] 核心 Store 已按初始结构创建
- [ ] 重新采集少量数据验证读写链路正常（建议 2 只股票试跑）

---

## 场景 4：数据库版本迁移机制

### 4.1 D-01 迁移规范

V9 遵循 **D-01 IndexedDB Schema 迁移治理规范**，核心约定如下：

- **版本单调递增**：`DB_VERSION` 每次变更 +1
- **迁移脚本成对**：每次升级必须提供 `Migration` 对象（含 `up` / `down`）
- **升级钩子执行**：`onupgradeneeded` 阶段按版本顺序链式执行迁移
- **禁止跳版本**：迁移必须逐级执行，不允许 `down()` 跨级
- **迁移可追溯**：每次迁移记录写入 `schema_migrations`

### 4.2 迁移触发时机

| 场景 | 触发方式 | 说明 |
|------|---------|------|
| 应用启动时检测到版本差异 | 自动触发 | 冷启动时自动执行 |
| 导入低版本备份文件 | 导入流程内触发 | 先迁移再写入数据 |
| 手工强制迁移 | 开发调试入口 | 用于验证 schema 变更 |
| 降级回滚 | 修改 DB_VERSION | 仅限开发环境 |

### 4.3 近期版本迁移记录（节选）

| 版本 | 变更内容 | 影响范围 |
|------|---------|---------|
| v32 | 新增画像体系 Store（stock_profiles / profile_items / score_evidence / profile_tags） | 评分证据链与个股画像 |
| v31 | 新增采集治理 Store（collection_history / conflict_log / file_import_records 等） | 采集链路审计 |
| v30 | 新增 analysis_results 分析结果表 | 分析层产物存储 |
| v29 | stocks 表新增 pool 字段与 by-pool 索引 | 三池分类查询 |
| v25 | 新增 collect_config 采集配置表 | 采集策略管理 |
| v24 | 新增 RBAC 6 张治理表 | 权限与访问控制 |
| v23 | 新增 schema_migrations 迁移记录表 | 迁移可追踪 |

> **完整迁移清单**：详见 `src/config/dbConfig.ts` 的版本说明与 `src/data/db-migrations.ts` 中的 `MIGRATIONS` 定义。

### 4.4 迁移失败排查

迁移执行失败时按以下顺序排查：

1. **查看控制台日志**：搜索 `[db]` 或 `[migration]` 前缀日志
2. **查看迁移记录**：检查 `schema_migrations` store 中最后一条成功记录
3. **核对版本号**：确认 `DB_VERSION` 与实际 Schema 是否一致（是否存在手工改动）
4. **回滚处理**：若迁移中途失败，优先清空数据库并从最近备份恢复，禁止带病运行

---

## 备份策略建议

### 5.1 备份频率建议

| 使用强度 | 建议频率 | 保留份数 | 备注 |
|----------|---------|---------|---------|
| 轻度使用 | 每周一次 | 7 份 | 按周滚动 |
| 中度使用 | 每周两次 + 大操作前 | 4 份 | 操作前必备份 |
| 重度使用 | 每日一次 + 大操作前 | 12 份 | 建议自动化 |
| 版本升级前 | 升级前一次 | 长期 | 升级回滚保险 |
| 数据重置前 | 重置前一次 | 1 份 | 重置后悔药 |

### 5.2 备份安全清单

- [ ] 备份文件命名包含日期与版本号，便于追溯
- [ ] 备份文件存放于独立目录，避免误删
- [ ] 重要备份至少保留两份副本（本地 + 云盘）
- [ ] 备份文件传输走可信通道（HTTPS 或本地拷贝）
- [ ] 定期抽查备份文件可正常导入（恢复演练）
- [ ] 含交易持仓数据的备份视为敏感文件，注意访问权限控制

### 5.3 存储容量管理

IndexedDB 容量受浏览器配额限制（通常 50MB ~ 数 GB，视磁盘与浏览器策略），需定期关注占用：

**占用大户通常包括**：
- 行情 K 线数据（全市场 × 多年 = 最大头）
- 新闻舆情累积数据
- 评分/画像中间结果缓存

**容量治理建议**：
1. 定期清理过期新闻与情绪缓存
2. 行情数据按需保留（如仅保留近 3 年）
3. 导出备份后清理历史评分中间结果
4. 浏览器配额告警时优先导出再清理

---

## 常见问题

### Q1：导出文件体积异常小？

**排查步骤**：
1. 确认导出时数据库非空（新装应用首次导出自然很小）
2. 确认导出流程完整执行，JSON 未截断（体积比约为数据量的 5:1 属正常）
3. 确认无浏览器扩展拦截了下载或写入

### Q2：导入后数据没有变化？

**排查步骤**：
1. 查看导入返回的 `skipped` 计数，确认是否大量记录被跳过
2. 确认导入后已刷新页面（IndexedDB 写入后 UI 需重新订阅）
3. 确认备份文件版本与当前版本兼容，版本过低可能被拦截
4. 确认导入的是正确的 JSON 文件而非其他格式

### Q3：重置后应用无法启动？

**排查步骤**：
1. 强制刷新页面（Ctrl+Shift+R）排除缓存干扰
2. 查看控制台报错信息，定位初始化失败点
3. 通过开发者工具确认 IndexedDB 是否成功重建

> **提示**：绝大多数重置后启动失败由浏览器缓存导致，强制刷新即可解决。

### Q4：如何把数据迁移到另一台电脑？

**迁移步骤**：
1. 在电脑 A 上执行全量导出
2. 在电脑 B 上安装并打开 V9 应用
3. 按场景 1 完成一次空库导出（留档）
4. 在电脑 B 上执行导入

> **注意**：两台电脑的浏览器内核与 IndexedDB 实现需兼容（推荐同版本 Chrome/Edge），跨浏览器迁移未经完整验证。

---

## 相关文档

| 文档 | 路径 | 说明 |
|------|------|------|
| ADR-002: IndexedDB vs localStorage | `../../reference/adr-002-indexeddb-over-localstorage.md` | 存储选型决策记录 |
| ADR-003: DataBridge 架构 | `../../archive/historical-2026-08-16/batch7/docs/reference/adr-003-databridge-over-direct-datalayer.md（已归档）` | 信封化写入架构决策 |
| 数据库迁移 v4 到 v6 | `../../archive/historical-2026-08-16/batch8/db-migration-v4-to-v6.md（已归档）` | 历史迁移背景说明 |
| 数据库配置锚点 | `../../src/config/dbConfig.ts` | DB_NAME / DB_VERSION / STORE_NAME |
| 迁移脚本实现 | `../../src/data/db-migrations.ts` | D-01 迁移脚本注册处 |
| DataBridge 核心 | `../../src/core/databridge.ts` | 信封路由与 ACL 实现 |

---

> **维护提示**：本文档描述的版本号、Store 清单与迁移记录以 `src/config/dbConfig.ts` 与 `src/data/db-migrations.ts` 为准。数据库版本升级后请同步修订本文档，发现文档与代码不一致时优先提 issue。
