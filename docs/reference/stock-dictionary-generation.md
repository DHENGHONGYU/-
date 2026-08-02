---
title: 股票字典生成与校验
type: reference
domain: development
phase: implementation
tier: important
status: active
maintainer: V9 Product Team (Xu)
summary: "股票字典（src/services/stock/stockDictionary.ts）作为全市场离线搜索单一事实源，由 akshare 三函数生成、校验器校验四交易所完整性与零重复，每周日自动化刷新。"
tags: [reference, stock-dictionary, data-generation, automation, development]
version: v1.0.0
last_updated: 2026-07-19
code_version: 2.0.0
doc_id: V9-DOC-DEV-001
change_log:
  - version: v1.0.0
    changes: Initial version established
    date: 2026-07-19
---

# 股票字典生成与校验

> **Status**: Current
> **Version**: v1.0.0
> **Last Updated**: 2026-07-19

---

## 1. 概述

股票字典是 FinSightV9「全市场离线搜索」（`FullMarketStockService`）的**单一事实源（Single Source of Truth）**。它覆盖 A 股（沪 / 深 / 北交所）与港股（港交所）全部上市公司，使前端在离线 / 弱网环境下也能对股票代码与名称做跨市场检索，无需实时调用行情接口。

三者的职责边界如下：

| 角色 | 文件 | 职责 |
| --- | --- | --- |
| 生成器 | `scripts/generate-stock-dict.py` | 从 akshare 抓取三交易所原始数据，渲染并写出 `stockDictionary.ts` |
| 校验器 | `scripts/verify-stock-dict.py` | 解析 `stockDictionary.ts`，校验四交易所完整性与跨市场 symbol 零重复 |
| 源文件（产物） | `src/services/stock/stockDictionary.ts` | 离线搜索服务直接消费的运行时数据源（**禁止手改**） |

`generate-stock-dict.py` 是数据的唯一生产者，`stockDictionary.ts` 只是它的产物；校验器独立于生成器，保证产物在合入前满足完整性门禁。

---

## 2. 数据源

生成器使用 **akshare** 的三个接口函数，分别覆盖不同交易所：

| akshare 函数 | 覆盖交易所 | 返回关键字段 | 市场判定 |
| --- | --- | --- | --- |
| `stock_info_a_code_name()` | A 股（沪 + 深全量，含 AB 股） | `code`, `name` | 代码前缀 `6` / `900` → `SH`；`0` / `3` / `200` → `SZ` |
| `stock_info_bj_name_code()` | 北交所（BJ） | `证券代码`, `证券简称` | 固定 `BJ` |
| `stock_hk_spot()` | 港股（主板 / 创业板） | `代码`, `中文名称` | 固定 `HK`，代码零填为 5 位（如 `00001` / `00700`） |

### 四交易所口径（当前快照）

字典总量 **8331** 条，跨市场 symbol 零重复：

| 交易所 | market | 条目数 |
| --- | --- | --- |
| 上交所 | SH | 2308 |
| 深交所 | SZ | 2892 |
| 北交所 | BJ | 328 |
| 港交所 | HK | 2803 |
| **合计** | — | **8331** |

> 注：SH + SZ 由 A 股函数按代码前缀拆分得到；北交所单独取数；港股单独取数。三者合并后按 `(symbol, market)` 去重并排序（SH → SZ → BJ → HK，组内按 symbol）。

---

## 3. 运行环境

生成器 / 校验器均运行于受管（managed）的 Windows venv Python。其路径由 `scripts/run-venv-python.cjs` 基于 `USERPROFILE` 环境变量**动态解析**（不再硬编码绝对路径），跨用户 / 跨盘符均可移植：

```bash
node scripts/run-venv-python.cjs default --version
```

> **关键点**：Windows 下 venv 的可执行 Python 位于 `Scripts\` 子目录（即 `Scripts\python.exe`），**不是** `bin/python`。包脚本通过 `scripts/run-venv-python.cjs` 动态定位该 venv，**不再硬编码绝对路径**，直接 `npm run` 即可，无需手动激活 venv。

### （重新）安装 akshare

若 venv 中缺少 akshare，使用该 venv 的 pip 安装（务必用 venv 内的 python 调用 `-m pip`，避免装到系统环境）：

```bash
node scripts/run-venv-python.cjs default -m pip install akshare
```

---

## 4. 用法

`package.json` 已注册两个脚本（通过 `run-venv-python.cjs` 动态解析 venv python，不硬编码绝对路径）：

| 命令 | 脚本定义 | 作用 |
| --- | --- | --- |
| `npm run build:stock-dict` | `…/Scripts/python.exe scripts/generate-stock-dict.py` | 重新生成 `stockDictionary.ts`（重新抓取 + 渲染 + 写出） |
| `npm run build:stock-dict:verify` | `…/Scripts/python.exe scripts/verify-stock-dict.py` | 校验四交易所完整性与零重复（CI / 合入门禁） |

典型工作流：

```bash
# 1) 抓取并重新生成字典
npm run build:stock-dict

# 2) 校验产物（四交易所完整性 + 跨市场 symbol 零重复）
npm run build:stock-dict:verify
```

校验器会打印解析条目数、各市场分布、symbol 唯一性，并在全部断言通过后输出 `校验通过 ✅`。当前快照：`解析条目数: 8331`、`symbol 唯一性: True`、`重复数: 0`。

---

## 5. 自动化

新增每周自动化任务 **`automation-1784399510483`**（rrule：`每周日 03:00`）：

1. `build:stock-dict` —— 重新抓取并生成字典；
2. `build:stock-dict:verify` —— 校验四交易所完整性与零重复；
3. 若产物较上次有变更（新增上市 / 退市），则自动提交。

该自动化保证字典随每周市场变动（IPO 上市、退市）持续刷新，无需人工干预；刷新失败会由校验器在步骤 2 暴露，阻止错误数据合入。

---

## 6. 单一事实源原则

`src/services/stock/stockDictionary.ts` 是**产物而非源**。请严格遵守以下原则：

- **禁止手改** `stockDictionary.ts`（含增删条目、改名称）。任何手改都会被下一次 `build:stock-dict` 覆盖，且绕过了校验门禁。
- 若需调整数据口径、市场判定规则或字段结构，**改生成器 `scripts/generate-stock-dict.py`**，然后重跑：

  ```bash
  npm run build:stock-dict
  npm run build:stock-dict:verify
  ```

- 数据异常（如某交易所条目数偏离预期）优先排查 akshare 接口或生成器逻辑，而不是在产物里打补丁。

这一原则是「代码先行、文档同步」的核心：生成器是唯一权威，文档（本文）与产物都从它派生。

---

## 7. 文档同步触发

本文档是 **`scripts/docs-tool/doc-update-trigger.ts` 中 `T14` 规则**（股票字典生成/校验）的 `docsToUpdate` 落点。当 `scripts/generate-stock-dict.py`、`scripts/verify-stock-dict.py` 或 `src/services/stock/stockDictionary.ts` 发生变更时，文档同步调度器会依据该规则提示将本文档纳入更新范围（提及即可，规则的具体 patterns / 落地由对应改造统一维护）。

> 与该触发机制配套的映射表为 `docs/00-meta/doc-trigger-action-map.md`；新增 / 改动须同步该映射表，本文档归属 Diátaxis 的 `reference` 类（落于 `docs/reference/`）。
