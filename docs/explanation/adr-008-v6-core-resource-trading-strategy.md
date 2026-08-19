---
title: ADR-008: 采用 V6 核心资源交易策略
type: explanation
domain: architecture
phase: planning
tier: important
status: active
maintainer: V9 Architecture Team
summary: "V9 需要引入一套成熟的交易策略作为投研参考。V6-pro-cockpit 已验证的「第四次工业革命稀缺核心资源」主题策略具有："
tags: [architecture, strategy, trading, adr, design, explanation]
version: v1.0.0
last_updated: 2026-07-17
code_version: "2.0.0-rc.2"
doc_id: V9-DOC-ARCH-008
referenced_by: [V9-DOC-META-000, V9-DOC-PROJ-176, V9-DOC-PROJ-149]
change_log:
  - version: v1.0.0
changes: Initial version established
date: 2026-07-17
---

# ADR-008: 采用 V6 核心资源交易策略

> **状态**: Accepted  
> **决策日期**: 2026-06-24  
> **版本**: v1.0.0

---

## 1. 背景（Context）

V9 需要引入一套成熟的交易策略作为投研参考。V6-pro-cockpit 已验证的「第四次工业革命稀缺核心资源」主题策略具有：

- 明确的主题定义（新能源、半导体、AI 算力等稀缺资源）
- 行业代码白名单（已覆盖 50+ 个相关行业）
- 评分过滤与等权分配逻辑（经过 2 年实盘验证）

复用 V6 策略可快速建立 V9 的交易策略模块，减少从零研发的时间成本。

### 触发条件

- `../reference/2026-06-24-adopt-v6-core-resource-trading-strategy.md` 提出复用方案。
- 产品评审：确认 V9 首版需要至少一套完整策略作为 MVP。

---

## 2. 决策（Decision）

**复用 V6-pro-cockpit 的「第四次工业革命稀缺核心资源」主题策略，包括主题定义、行业代码白名单、评分过滤与等权分配逻辑。**

- `themeRegistry.ts` 定义主题规则（行业白名单 + 评分阈值）。
- `portfolioBuilder.ts` 实现组合构建（等权分配 + 风险控制）。
- 策略输出为「参考组合」，用户可一键导入或手动调整。
- 明确标注：「策略输出仅供参考，非投资建议」。

### 决策理由

- **Why not 自研新策略**：时间成本高，需要至少 6 个月回测验证；V6 策略已验证 2 年。
- **Why not 多策略并行**：V9 MVP 只需一套策略；多策略由 ADR-009 覆盖。
- **复用范围**：仅复用策略逻辑（行业白名单、评分规则、分配算法），不复用 V6 UI 代码。

---

## 3. 备选方案（Alternatives Considered）

| 方案 | 优点 | 缺点 | 结论 |
|------|------|------|------|
| **A. 复用 V6 策略**（最终选择） | 快速上线、已验证、降低风险 | 需要适配 V9 数据模型和令牌体系 | ? 采纳 |
| **B. 自研新策略** | 完全自主控制 | 时间成本高、验证周期长 | ? 否决（V10 可评估） |
| **C. 第三方策略库** | 无需自研逻辑 | 数据隐私风险、定制性差、合规风险 | ? 否决 |

---

## 4. 后果（Consequences）

### 正面影响

- V9 首版即可提供完整的主题策略，提升用户价值。
- 复用已验证逻辑，降低策略失效风险。
- 为 ADR-009 的双策略体系提供基础（V6 策略可作为其中一条路径）。

### 负面影响 / 技术债

- V6 策略的数据模型与 V9 不完全一致（如字段命名、Store 结构）。
  - **缓解**：编写数据适配层（`v6Adapter.ts`），在 V9 数据模型与 V6 策略逻辑之间转换。
- V6 策略的 UI 表现（颜色、图表）需要适配 V9 的宋韵美学和令牌体系。
  - **缓解**：重新实现 Widget，仅复用逻辑层。

### 影响范围

| 模块 | 影响 |
|------|------|
| `src/services/trading/` | 新增主题策略引擎 |
| `src/services/portfolio/` | 新增组合构建器 |
| `src/store/themeStore/` | 新增主题配置 Store |
| `src/pages/trading/` | 新增策略展示页面 |

---

## 5. 实施与验证

### 实施步骤

- [x] Step 1：提取 V6 策略逻辑（行业白名单、评分规则、分配算法）
- [x] Step 2：编写 `v6Adapter.ts`（数据模型适配）
- [x] Step 3：实现 `themeRegistry.ts`（主题注册）
- [x] Step 4：实现 `portfolioBuilder.ts`（组合构建）
- [ ] Step 5：补充策略回测（历史数据验证）
- [ ] Step 6：与 ADR-009 双策略体系整合

### 验证命令

```bash
npm run test:clean   # 验证策略计算测试
npm run audit:layers # 验证 trading 层依赖合规
```

---

## 6. 关联文档

| 文档 | 路径 |
|------|------|
| ADR-009（双策略） | `adr-009-dual-strategy-system.md` |
| 引擎规格 | `05-engine-specs.md` §3.3 |
| 原始提案 | `../reference/2026-06-24-adopt-v6-core-resource-trading-strategy.md` |
| 主题策略详情 | `../reference/fourth-industrial-revolution-core-resource-strategy.md` |

---

## 7. 状态变更记录

| 日期 | 状态 | 变更人 | 备注 |
|------|------|--------|------|
| 2026-06-24 | proposed | @architect | 初始提案 |
| 2026-06-24 | accepted | 架构组 | 评审通过 |
| 2026-07-12 | accepted | docs 治理组 | 扩写为完整 ADR v1.0.0 |
