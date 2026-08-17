---
title: ADR-015: DuckDB WASM 时序分析引擎
type: explanation
domain: data
phase: design
tier: important
status: proposed
maintainer: V9 Architecture Team
summary: "在现有 JS 计算基础上，引入 DuckDB WASM 作为时序数据分析加速器，支持 SQL 查询和列式存储，为评分引擎和回测系统提供高性能的行情数据处理能力。采用渐进式集成策略，保持 JS 实现作为回退方案。"
tags: [data, duckdb, wasm, timeseries, sql, adr, explanation]
version: v1.0.0
last_updated: 2026-07-20
code_version: "2.0.0-rc.1"
doc_id: V9-DOC-DATA-079
referenced_by: []
change_log:
  - version: v1.0.0
    changes: Initial version proposed
date: 2026-07-20
---

# ADR-015: DuckDB WASM 时序分析引擎

> **状态**: Proposed  
> **提出日期**: 2026-07-20  
> **Version**: v1.0.0

---

## 1. 背景（Context）

### 1.1 现状

V9 项目当前使用纯 JavaScript 实现行情数据的计算和分析：
- 行情数据存储在 IndexedDB 的 `daily_quotes` Store
- 技术指标、波动率、滑动窗口等计算由 JS 实现
- 评分引擎（L8 筹码层）和回测引擎直接调用 JS 计算函数

**现有问题**：
- 大数据量下（如全市场多年日K线），JS 计算性能瓶颈明显
- 复杂的 SQL 风格查询（聚合、分组、窗口函数）需要手写循环
- 代码维护成本高，计算逻辑分散
- 缺少统一的数据分析接口

### 1.2 已有代码桩

项目中已存在 DuckDB 相关的基础实现：
- `duckDBProvider.ts` — DuckDB WASM 时序存储 Provider
- `storageFactory.ts` — 存储工厂，支持动态加载 DuckDB Provider

---

## 2. 决策（Decision）

### 2.1 核心决策

**引入 DuckDB WASM 作为时序数据分析加速器，与现有 JS 实现并存，渐进式集成。**

具体方案：
1. **存储引擎**：DuckDB WASM 在浏览器中运行列式数据库
2. **数据加载**：从 IndexedDB `daily_quotes` 按需加载到 DuckDB 内存表
3. **查询接口**：提供 SQL 查询能力（仅 SELECT，安全限制）
4. **集成方式**：MCP 层暴露 `run_sql_query` 工具，评分/回测引擎按需调用
5. **回退策略**：DuckDB 不可用时自动回退到 JS 实现

### 2.2 不选择的方案

| 方案 | 不选择原因 |
|------|-----------|
| 服务端数据库（PostgreSQL） | 纯前端架构，无后端依赖 |
| SQLite WASM（sql.js） | 行式存储，时序分析性能不如列式 |
| 完全替换 JS 实现 | 风险太高，无回退路径 |
| 新建独立量化分析模块 | 违反"不另起炉灶"原则 |

---

## 3. 方案对比（Alternatives）

### 3.1 方案 A：纯 JS 计算（现状）

**优点**：
- 零依赖，无需加载 WASM
- 完全可控，调试方便
- 内存占用低

**缺点**：
- 大数据量下性能差
- 复杂查询需要手写代码
- 开发效率低

### 3.2 方案 B：DuckDB WASM（本方案）

**优点**：
- 列式存储，时序分析性能优异
- SQL 查询能力，表达力强
- 支持窗口函数、聚合等高级特性
- 本地运行，数据不外泄

**缺点**：
- WASM 文件 ~15MB，首次加载有延迟
- Web Worker 通信开销
- 内存占用较高（数据加载到内存）

### 3.3 方案 C：混合模式（最终方案）

**即本方案**：DuckDB 加速 + JS 回退，按需启用。

**优点**：
- 兼顾性能和可用性
- 渐进式集成，风险可控
- 现有代码无需大规模修改

**缺点**：
- 维护两套计算路径
- 需要处理数据同步

---

## 4. 后果（Consequences）

### 4.1 正面影响

- **性能提升**：列式数据库 + SQL 优化器，复杂分析数量级加速
- **开发效率**：SQL 表达复杂分析逻辑，代码量减少
- **功能增强**：支持窗口函数、CTE、子查询等高级分析
- **架构一致**：遵循 storage 服务域扩展，不另起炉灶

### 4.2 负面影响

- **首次加载延迟**：DuckDB WASM 初始化 ~1-3秒
- **内存占用**：行情数据加载到内存，N 只股票 × M 天 × K 字节
- **复杂度上升**：需维护两套计算路径和降级逻辑
- **安全考虑**：SQL 注入风险（已限制仅 SELECT）

### 4.3 风险缓解

| 风险 | 缓解措施 |
|------|---------|
| WASM 加载失败 | 自动回退 JS 实现，用户无感知 |
| 内存不足 | 限制最大加载数据量，超出部分用 JS 计算 |
| SQL 注入 | 仅允许 SELECT 查询，禁止 DDL/DML |
| 数据同步 | 数据加载后只读，修改走 IndexedDB 主路径 |

---

## 5. 实现细节

### 5.1 架构分层

```
┌─────────────────────────────────────────┐
│         MCP Layer (backtestServer)      │
│  - run_sql_query                        │
│  - get_available_tables                 │
│  - load_quotes_to_duckdb                │
├─────────────────────────────────────────┤
│         Service Layer (storage)         │
│  - DuckDBProviderImpl                   │
│  - init() / querySQL() / close()        │
│  - loadQuotesFromIndexedDB()            │
├─────────────────────────────────────────┤
│         WASM Layer (DuckDB)             │
│  - @duckdb/duckdb-wasm                   │
│  - Web Worker 中运行                    │
├─────────────────────────────────────────┤
│         Data Layer (IndexedDB)          │
│  - daily_quotes Store（数据源）         │
└─────────────────────────────────────────┘
```

### 5.2 关键接口

**DuckDBProvider 对外接口**：

```typescript
// 初始化
init(): Promise<boolean>

// SQL 查询（仅 SELECT）
querySQL(sql: string): Promise<SQLQueryResult>

// 列出可用表
getAvailableTables(): Promise<string[]>

// 从 IndexedDB 加载行情数据
loadQuotesFromIndexedDB(symbol: string): Promise<number>

// OHLCV 聚合
aggregate(symbol: string, windowMs: number): Promise<ListResult<OHLCVRow>>

// 关闭连接
close(): Promise<void>
```

### 5.3 数据库变更

- **DB_VERSION**：不需要递增（DuckDB 数据在内存中，不走 IndexedDB 主表）
- **新增 Store**：无（如果后续需要查询缓存，再加 `duckdb_query_cache`）
- **既有 Store 变更**：无

### 5.4 MCP 工具

| 工具名 | 角色权限 | 说明 |
|--------|---------|------|
| `run_sql_query` | agent / system | 执行 SQL 查询（仅 SELECT） |
| `get_available_tables` | agent / system | 列出可用表 |
| `load_quotes_to_duckdb` | agent / system | 加载行情数据到内存表 |

> **注**：ui 角色默认不开放 SQL 查询权限，避免安全风险。如需在 UI 中使用，通过预定义查询封装。

### 5.5 安全限制

1. **仅 SELECT**：所有 SQL 必须以 `SELECT` 开头，禁止 DDL/DML
2. **内存表**：数据仅在内存中，关闭即释放
3. **只读加载**：从 IndexedDB 加载到 DuckDB 的数据只读
4. **无文件系统**：不挂载本地文件系统，仅内存操作

---

## 6. 回退策略

### 6.1 自动降级触发条件

- DuckDB WASM 加载失败
- 浏览器不支持 WebAssembly
- 内存不足
- SQL 查询执行出错

### 6.2 降级行为

- 自动切换到 JS 计算实现
- 记录警告日志
- 计算结果保持一致（精度可能略有差异）
- 调用方无感知（通过统一接口封装）

---

## 7. 性能影响

### 7.1 时间开销

| 操作 | JS 实现 | DuckDB | 备注 |
|------|--------|--------|------|
| 首次初始化 | 0 | ~1-3s | WASM 下载 + 初始化 |
| 数据加载（N条） | 0（已在 IndexedDB） | O(N) | 从 IndexedDB 读取并插入 |
| 简单聚合 | O(N) | O(log N) | 列式存储优势 |
| 复杂窗口函数 | O(N²) | O(N) | SQL 优化器优势 |

### 7.2 空间开销

- **WASM 文件**：~15MB（浏览器缓存）
- **内存数据**：N 天行情 × ~100 字节/行 = 约 100N KB
- **Web Worker**：额外线程开销

---

## 8. 应用场景

### 8.1 L8 筹码层计算（可选加速）

- 八级筹码分布计算
- 滑动窗口统计
- 波动率计算

### 8.2 回测引擎（可选加速）

- 多股票批量回测
- 绩效指标计算
- 交易统计分析

### 8.3 数据探索（MCP 工具）

- AI Agent 按需查询行情数据
- 自由组合分析维度
- 快速验证投资假设

---

## 9. 参考资料

- [DuckDB WASM](https://duckdb.org/docs/api/wasm/overview.html) - DuckDB WebAssembly 官方文档
- [DuckDB SQL](https://duckdb.org/docs/sql/introduction) - DuckDB SQL 参考
- [@duckdb/duckdb-wasm npm](https://www.npmjs.com/package/@duckdb/duckdb-wasm) - npm 包
