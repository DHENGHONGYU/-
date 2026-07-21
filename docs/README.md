---
title: V9 文档中心总入口
doc_id: V9-DOC-ROOT-901
tier: important
status: active
version: v1.0.0
last_updated: 2026-07-21
code_version: 2.0.0
---
# 智能投研复盘系统 V9 — 项目文档体系

> **Status**: Current  
> **Version**: v2.5.0  
> **Last Updated**: 2026-07-05
>
> **项目代号**：V9-IRRS（Intelligent Research & Review System）  
> **定位**：面向中国 A 股个人投资者的研究决策与复盘工具  
> **技术栈**：React 19 + TypeScript + Vite + Tailwind CSS + Zustand + IndexedDB  
> **架构**：纯前端 PWA，数据本地主权，离线可用

---

## 文档导航

> 本文档体系当前统一版本为 `v2.5.0`，表示知识图谱 Token 消耗优化与协议缺陷修正后的版本；历史版本（`v0.9.0-docs-base`、`v0.9.0-docs-review`、`v0.9.0-migration-implemented`）仅用于版本比对参考。

本文档体系是项目架构与实现的**唯一真相源**。历史讨论、临时笔记若与本文档冲突，以本文档为准。

| 编号 | 文档 | 状态 | 版本 | 内容 |
|------|------|------|------|------|
| 01 | [愿景与目标](./01-vision-and-goals.md) | ✅ Current (Active) | v0.9.0-migration-implemented | 系统愿景、目标用户、价值主张、SMART 目标 |
| 02 | [功能规格](./02-functional-specs.md) | ✅ Current (Active) | v0.9.0-migration-implemented | 功能模块清单、用户故事、核心流程、非功能需求 |
| 03 | [架构标准](./03-architecture-standards.md) | ✅ Current (Active) | v0.9.0-migration-implemented | 五层架构、分层调用规则、数据架构、Schema、信封结构 |
| 04 | [UI/UX 规范](./04-ui-ux-specs.md) | ✅ Current (Active) | v0.9.0-migration-implemented | 五舱 + 驾驶舱 UI 规范、主题系统、组件库 |
| 05 | [引擎规格](./05-engine-specs.md) | ✅ Current (Active) | v0.9.0-migration-implemented | 分析引擎、交易引擎、评分模型、DataBridge 信封协议 |
| 06 | [路由规格](./06-routing-specs.md) | ✅ Current (Active) | v0.9.0-migration-implemented | 路由注册表、舱室切换、懒加载策略 |
| 07 | [运营策略](./07-operation-strategy.md) | ✅ Current (Active) | v0.9.0-migration-implemented | 开发流程、版本策略、风险控制、ADR、外部参考管控 |
| 08 | [实施计划](./08-implementation-plan.md) | ✅ Current (Active) | v0.9.0-migration-implemented | 分阶段实施计划、验收标准、风险登记 |
| 09 | [质量门禁](./09-quality-gates.md) | ✅ Current (Active) | v0.9.0-migration-implemented | 质量门禁、CI 流水线、测试策略、扫描脚本 |
| 10 | [词汇表](./10-glossary.md) | ✅ Current (Active) | v0.9.0-migration-implemented | 领域词汇表、命名规范、废弃命名对照 |

### 专项文档

| 文档 | 内容 | 状态 |
|------|------|------|
| [因子迭代路线图](./implementation/factor-tracking-roadmap.md) | V6/V4 评分因子的五阶段优化与扩容路径 | Current (Active) |
| [交易核心因子导入](./implementation/trading-core-factors.md) | 从 v6-pro-cockpit 交易策略报告提取的核心痛点、参数与落地建议 | Future Reference / Deferred |
| [输入舱业务规格](./implementation/input-cabin-spec.md) | 输入舱端到端流程、子页职责、服务契约、UI 组件映射 | Current (Active) |
| [输入舱 UI 改造](./implementation/input-cabin-ui-reshaping.md) | 输入舱看板/列表视图、批量操作、搜索模式增强的 UI 改造记录 | Current (Active) |
| [数据交互协议](./implementation/data-interaction-protocols.md) | 信封结构、调用矩阵、事件总线、数据血缘、输入舱专用契约 | Current (Active) |
| [投资流程阶段分析](./implementation/investment-pipeline-stage-analysis.md) | 从候选股到持仓复盘共 13 个阶段的逐项分析 | Current (Active) |
| [实施治理与 ADR](./implementation/implementation-governance.md) | 架构决策记录模板、版本比对机制、审计基线维护、代码-文档同步规则 | Current (Active) |
| [架构版本比对](./implementation/architecture-version-comparison.md) | 架构文档从规划基线到校对版的全量差异对照 | Current (Active) |
| [输入舱升级策略报告](./implementation/v9-input-cabin-strategy-report.md) | 输入舱 UI/代码/路由/映射修改策略、利弊分析与实施计划 | Current (Active) |
| [v6 UI 参考](./implementation/v6-cockpit-ui-reference.md) | v6-pro-cockpit 可复用的 UI 组件与模式总结 | Future Reference / Deferred |
| [V10 架构对齐报告](./implementation/v10-architecture-alignment.md) | V10 白皮书框架思想与 V9 的对齐、吸收、暂缓建议 | Future Reference / Deferred |
| [V6 Pro UI 模块对齐报告](./archive/ui-module-alignment.md) | V6 Pro UI 模块比对结论与 V9 的吸收/保持/暂缓清单 | Future Reference / Deferred |
| [V6 Pro → V9 数据迁移规范](./implementation/v6-to-v9-migration-spec.md) | V6 Pro JSON 全量导出 → V9 的字段映射、转换规则、导入顺序与冲突处理 | Current (Active) |
| [V9 整体架构蓝图](./implementation/v9-system-blueprint.md) | 愿景、架构、数据协议、路由映射、UI 范式、实施路线统一归纳 | Current (Active) |
| [第四次工业革命稀缺核心资源交易策略](./implementation/fourth-industrial-revolution-core-resource-strategy.md) | 解析 v6-pro-cockpit 核心稀缺策略，Phase 1（Schema/主题/评分/组合）已落地 | Current (Active) |
| [更新日志](../CHANGELOG.md) | 版本变更、架构决策、验收数据、已知问题 | Future Reference / Deferred |
| [AI Center 数据字典](./AI_CENTER_DATA_DEFINITION.md) | AI 智能体调度中心 + 健康监控 + 诊断分析 数据字典 | Current (Active) |
| [交易持仓 API 契约](./trade/API_CONTRACT.md) | 交易持仓管理模块 API 契约 | Current (Active) |
| [Cockpit 数据字典](./cockpit/DATA_DEFINITION.md) | Cockpit Widget 框架数据字典（类型 + 枚举常量） | Current (Active) |
| [News 数据字典](./news/DATA_DEFINITION.md) | 新闻资讯模块数据字典 | Current (Active) |
| [Data Collection 数据字典](./data-collection/DATA_DEFINITION.md) | 数据采集模块三层架构数据字典 | Current (Active) |

---

## 快速决策原则

1. **数据优先于界面**：IndexedDB schema 是最高优先级保护对象；任何 schema 变更必须同步更新迁移逻辑与类型定义。
2. **离线可用**：所有核心功能不依赖网络；LLM 评分仅在联网时增强，离线时回退到自动评分。
3. **信封通信**：所有跨模块写操作走 `DataBridge.forward(StandardEnvelope)`，禁止 L5/L4 直接调用 `dataLayer`。
4. **配置驱动**：所有常量、阈值、权重、股票代码池来自 `src/config/`；禁止引擎层与 UI 层硬编码业务数字。
5. **测试先行**：关键引擎函数必须附带防御性测试；新增功能必须同步补充验收测试。
6. **架构诚实**：文档必须记录当前代码与架构策略的真实偏差，禁止用愿景替代现状。

---

## 文档维护规范

- 新增文档请按编号顺序放入 `docs/` 根目录；专项实施文档放入 `docs/implementation/`。
- 每次发布版本必须同步更新本页「文档版本」与根目录 `CHANGELOG.md`。
- 文档中涉及的文件路径、函数名、接口字段必须与代码保持一致；重构后须先更新文档再合并。
