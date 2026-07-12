# V9 数据字典索引（DATA_DICTIONARY_INDEX）

> **定位**：所有 `DATA_DEFINITION*` 文档的**唯一索引**（Single Source of Truth），消除「10 份 DATA_DEFINITION 重复」的双向一致性落差。
> **状态**：✅ P0 新增索引；✅ 2026-07-12 **同名 3 份已合并为 1 份主字典**（整合版 v2.0.0）。
> **实测（2026-07-12）**：共 10 个匹配文件 = **1 个整合主字典** + **7 个独立域定义**（另 2 份同名源文件合并后已移除）。

---

## 1. 核心定义（整合主字典）

> 三份同名 `DATA_DEFINITION.md`（交易持仓管理 / 数据采集 / Cockpit Widget 框架）已于 2026-07-12 整合为**单一主数据字典**，按模块分区保留全部内容，共享采集类型在 §B 统一定义、§C 引用去重。

| 文件 | 字节 | 角色 | 状态 |
|------|------|------|------|
| `docs/standards/DATA_DEFINITION.md` | 整合版 v2.0.0 | **唯一主字典（SSOT）** | ✅ 现行 |
| `./DATA_DEFINITION.md`（根，交易持仓） | 13337 | 源文件（mtime 2026-07-08） | 🗑 已并入主字典后 `git rm` |
| `docs/01-requirements/DATA_DEFINITION.md`（数据采集） | 13827 | 源文件（mtime 2026-07-08） | 🗑 已并入主字典后移除（untracked） |
| `docs/02-design/DATA_DEFINITION.md`（Cockpit Widget） | 26654 | 源文件（mtime 2026-07-06） | 🗑 已并入主字典后移除（untracked） |

> **整合基线**：以最新更新时间（mtime 2026-07-08）的采集类型版本为准（数据采集 v1.2.0 与 Cockpit v1.2.0 内容一致，无字段冲突）；Cockpit 专有内容（v1.2.0 / 2026-07-06）作为补充并入。详见主字典「§0 整合来源对照表」。

## 2. 独立域定义（命名规范 `*-data-definition.md`，合法，保留）

| 文件 | 归属子域 | 内容 |
|------|----------|------|
| `docs/standards/ai-center-data-definition.md` | ai-center | AI 中心数据结构 |
| `docs/standards/backtest-data-definition.md` | backtest | 回测数据 |
| `docs/standards/dataflow-data-definition.md` | dataflow | 数据流定义 |
| `docs/standards/multi-factor-screening-data-definition.md` | screening | 多因子筛选 |
| `docs/standards/news-data-definition.md` | news | 新闻资讯 |
| `docs/standards/risk-derived-data-definition.md` | risk | 衍生风险 |
| `docs/standards/seven-dim-config-data-definition.md` | seven-dim-config | 七维配置 |

## 3. 统一数据模型锚点

- **`UnifiedStockData`**：数据融合统一契约，由 `unifiedStockService` 产出，被 `store/*` 与各页面消费。
- 字段级定义一律先查本索引 → 再进入对应文件，**禁止在别处新建副本**。

## 4. 命名约定（GOVERNANCE 对齐）

- 新增域定义统一 `kebab-case` + `-data-definition.md` 后缀，并**必须**在此索引登记。
- 禁止再创建裸名 `DATA_DEFINITION.md`（避免同名冲突复发）。

## 5. 验收

- ✅ 唯一索引已建立，所有 `DATA_DEFINITION*` 均被引用。
- ✅ **同名 3 份已合并为 1 份主字典**（目标达成：裸名 `DATA_DEFINITION.md` 仅 `docs/standards/` 一处）。
- ✅ 整合主字典已纳入 `docs/README.md` D 类 / `GOVERNANCE.md` 引用。
- ⏳ 新增按域拆分数据字典仍须带域前缀命名并登记于此索引（见 §4）。
