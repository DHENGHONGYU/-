---
title: V9 文档迁移计划（A-H 分类体系�?
type: meta
domain: project
phase: planning
tier: standard
status: active
maintainer: V9 Architecture Team
summary: "版本: v1.0.0 | 日期: 2026-07-13 适用范围: docs/ 目录下所有文档的 A-H 分类迁移 强制等级: 必须遵守"
tags: [project, migration, documentation, plan]
version: v1.0.0
last_updated: 2026-07-17
code_version: 2.0.0
change_log:
  - version: v1.0.0
changes: Initial version established
date: 2026-07-17
---meta
domain: project
phase: planning
tier: standard
status: active
maintainer: V9 Architecture Team
tags: [project, migration, documentation, plan]
version: v1.0.0
last_updated: 2026-07-17
code_version: 2.0.0
---

# V9 文档迁移计划（A-H 分类体系�?
> **版本**: v1.0.0 | **日期**: 2026-07-13
> **适用范围**: docs/ 目录下所有文档的 A-H 分类迁移
> **强制等级**: 必须遵守

---

## 一、A-H 分类与物理目录映�?
| 分类 | 名称 | 物理目录 | 说明 |
|------|------|----------|------|
| **A** | 导航与治�?| `00-meta/` | 索引、宪法、归类、体检报告 |
| **B** | 架构设计 | `02-design/architecture/` | 全局架构、舱室、服务、引擎、数据层、安全模�?|
| **C** | 功能模块 | `02-design/` | 各舱 spec、Widget、页面、组件体�?|
| **D** | 技术规�?| `02-design/standards/` | 分层、门禁、令牌、复杂度、API 契约、开发工作流 |
| **E** | 测试策略 | `04-testing/` | 单元/e2e/覆盖�?|
| **F** | AI 辅助工程治理 | `03-development/ai/` | 提示词模板、记忆层、飞轮、AI 工程入口 |
| **G** | 过程与质量产�?| `reports/` | 报告、审计、changelog、草�?|
| **H** | 跨域补充 | `03-development/guides/` | 入门、How-to、安全、部署、i18n |

---

## 二、二级子类映�?
| 二级子类 | 归属一级类 | 物理路径 | 说明 |
|----------|-----------|----------|------|
| A1 索引与宪�?| A | `00-meta/` | README、GOVERNANCE、体检报告 |
| A2 需求规�?| A | `01-requirements/` | 愿景、功能规格、系统蓝�?|
| A3 插件集成 | A | `03-development/plugins/` | 插件/扩展文档 |
| B1 全局架构 | B | `02-design/architecture/` | overview、cabins-overview、services-catalog |
| B2 子系统架�?| B | `02-design/architecture/subsystems/` | 驾驶舱、采集、数据层 |
| B3 架构决策 | B | `02-design/architecture/adr/` | ADR 主索�?+ 决策记录 |
| B4 合规与整�?| B | `02-design/architecture/compliance/` | 架构审计、整改策�?|
| B5 版本/发布 | B | `05-deployment/` | RELEASE_NOTES、PR_DESCRIPTION |
| C1 舱室体系 | C | `02-design/cabins/` | 5 �?spec + PortalShell |
| C2 组件体系 | C | `02-design/components/` | 原子组件、组件库、迁移规�?|
| C3 驾驶�?Widget | C | `02-design/cockpit/` | Widget 开发、集成、错误处�?|
| C4 状态层 Store | C | `02-design/store/` | Zustand Store 规范 |
| C5 服务�?Services | C | `02-design/services/` | 20+ 子域服务契约 |
| C6 数据�?| C | `02-design/data-layer/` | IndexedDB Schema、采集架构、数据血�?|
| C7 数据字典 | C | `02-design/standards/` | DATA_DICTIONARY_INDEX + 数据定义 |
| D1 编码与分层规�?| D | `02-design/standards/` | AGENTS.md 契约、编码规�?|
| D2 设计系统与令�?| D | `02-design/standards/design-tokens/` | L1-L4 令牌、宋韵美�?|
| D3 质量门禁与审�?| D | `02-design/standards/quality-gates/` | audit:* 脚本、复杂度治理 |
| D4 注释与文档化 | D | `../reference/jsdoc-convention.md` | JSDoc 规范、Frontmatter 规范 |
| D5 迁移规范 | D | `03-development/migration/` | v6→v9 迁移、DB Schema 升级 |
| E1 测试分层 | E | `04-testing/` | 单元/集成/E2E 分层 |
| E2 用例与清�?| E | `04-testing/test-cases/` | 测试用例、清�?|
| E3 报告与覆盖率 | E | `04-testing/reports/` | 测试报告、覆盖率 |
| E4 门禁 | E | `04-testing/gates/` | 测试相关质量门禁 |
| F1 提示词模�?| F | `prompts/` | system/component/service/store/types 模板 |
| F2 检查表 | F | `03-development/checklists/` | 迁移/集成检查表 |
| F3 记忆层与飞轮 | F | `02-design/ai/` | AI 记忆层、生成→审计→修复闭�?|
| G1 审计报告 | G | `reports/audit/` | audit JSON/HTML、自动产�?|
| G2 变更日志 | G | `reports/changelogs/` | changelogs/、CHANGELOG.md |
| G3 复盘/整改报告 | G | `reports/retrospectives/` | 架构整改、UI 整改、质量复�?|
| G4 草稿/临时 | G | `reports/drafts/` | 过程草稿、临时产�?|
| G5 发布管理 | G | `reports/release-management/` | 发布计划、回滚方�?|
| H1 安全与权�?| H | `03-development/guides/security/` | 安全模型、MCP ACL |
| H2 部署与运�?| H | `05-deployment/ops/` | 部署架构、Runbook |
| H3 入门与教�?| H | `03-development/guides/getting-started/` | 新手教程、How-to |
| H4 无障碍与国际�?| H | `03-development/guides/accessibility/` | a11y、i18n |

---

## 三、待创建的新目录

| 目录路径 | 用�?| 优先�?|
|----------|------|--------|
| `docs/reports/` | G 类过程与质量产物根目�?| P0 |
| `docs/reports/audit/` | 审计报告自动产物 | P0 |
| `docs/reports/changelogs/` | 变更日志 | P0 |
| `docs/reports/retrospectives/` | 复盘/整改报告 | P1 |
| `docs/reports/drafts/` | 草稿/临时文件 | P1 |
| `docs/reports/release-management/` | 发布管理文档 | P1 |
| `docs/02-design/architecture/subsystems/` | 子系统架�?| P1 |
| `docs/02-design/architecture/compliance/` | 合规与整�?| P1 |
| `docs/02-design/cabins/` | 舱室体系 | P1 |
| `docs/02-design/components/` | 组件体系 | P1 |
| `docs/02-design/store/` | 状态层 Store | P1 |
| `docs/02-design/services/` | 服务层契�?| P1 |
| `docs/02-design/data-layer/` | 数据�?| P1 |
| `docs/02-design/standards/design-tokens/` | 设计令牌 | P1 |
| `docs/02-design/standards/quality-gates/` | 质量门禁 | P1 |
| `docs/03-development/checklists/` | 检查表 | P1 |
| `docs/03-development/migration/` | 迁移规范 | P1 |
| `docs/04-testing/test-cases/` | 测试用例 | P1 |
| `docs/04-testing/reports/` | 测试报告 | P1 |
| `docs/04-testing/gates/` | 测试门禁 | P1 |

---

## 四、重复文档识别与处理策略

### 4.1 重复文档清单

| 文档 | 位置1 | 位置2 | 处理策略 |
|------|-------|-------|----------|
| data-dictionary-index.md | `02-design/` | `02-design/standards/` | 保留 standards/ 版本，归�?02-design/ 版本 |
| code-review.md | `01-requirements/` | `04-testing/audit-reports/audit/` | 保留 01-requirements/ 版本，归�?audit/ 版本 |
| v9-架构缺陷与整改行动清�?md | `02-design/` | `04-testing/audit-reports/audit/` | 保留 02-design/ 版本，归�?audit/ 版本 |
| code-quality-audit-report.md | `01-requirements/` | `04-testing/audit-reports/audit/` | 合并内容�?01-requirements/，归�?audit/ 版本 |
| quality-gates-baseline.md | `03-development/` | `../reference/09-quality-gates.md` | 合并内容�?03-development/，归�?02-design/ 版本 |

### 4.2 版本融合评估标准

| 更新程度 | 评估标准 | 处理策略 |
|----------|----------|----------|
| **完全替代** | 新版本包含旧版本全部内容 + 新增内容 �?50% | 归档旧版本到 07-archive/ |
| **部分融合** | 新版本包含旧版本部分内容，有互补信息 | 合并到新版本，归档旧版本 |
| **增量更新** | 新版本仅更新部分章节或数�?| 保留新版本，归档旧版�?|
| **内容冲突** | 新旧版本内容存在矛盾 | 人工审查后决定保留哪个版�?|
| **独立文档** | 新旧版本主题不同但文件名相似 | 重命名后分别保留 |

---

## 五、迁移执行计�?
### 5.1 批次划分

| 批次 | 分类 | 文件数量 | 预计时间 |
|------|------|----------|----------|
| 1 | A (导航与治�? | ~30 | 1h |
| 2 | B (架构设计) | ~50 | 2h |
| 3 | C (功能模块) | ~80 | 3h |
| 4 | D (技术规�? | ~20 | 1h |
| 5 | E (测试策略) | ~30 | 1h |
| 6 | F (AI 工程) | ~15 | 0.5h |
| 7 | G (过程产物) | ~60 | 2h |
| 8 | H (跨域补充) | ~15 | 0.5h |

### 5.2 迁移步骤

```
1. 创建目标目录结构
2. 识别重复文档并制定融�?归档策略
3. 按批次迁移文�?4. 更新跨文档引用链�?5. 运行 npm run audit:doc-integrity 验证
6. 更新 README.md �?governance.md
7. 创建归档目录并迁移旧版本
```

### 5.3 执行日志

| 日期 | 操作 | 状�?|
|------|------|------|
| 2026-07-13 | 创建归档目录 `00-meta/deprecated-docs/old-versions/` �?`00-meta/deprecated-docs/temporary/` | �?完成 |
| 2026-07-13 | 归档 deployment.md v1.0.0�?2-design/architecture/ �?deprecated-docs/old-versions/�?| �?完成 |
| 2026-07-13 | 归档 data-definition.md v1.0.0-cockpit�?2-design/cockpit/ �?deprecated-docs/old-versions/�?| �?完成 |
| 2026-07-13 | 归档 regression-suite.md v1.0.0�?2-design/ �?deprecated-docs/old-versions/�?| �?完成 |
| 2026-07-13 | 归档 data-dictionary-index.md v1.6.0�?2-design/ �?deprecated-docs/old-versions/�?| �?完成 |
| 2026-07-13 | 归档 registry-index.md v1.0.0-02-design�?2-design/ �?deprecated-docs/old-versions/�?| �?完成 |
| 2026-07-13 | 分类规则扩展完成�?08 个文�?100% 分类 | �?完成 |

### 5.4 归档策略

| 归档类型 | 目录 | 保留期限 | 说明 |
|----------|------|----------|------|
| 旧版�?| `00-meta/deprecated-docs/old-versions/` | 90 �?| 完全被替代的旧版本文�?|
| 临时文件 | `00-meta/deprecated-docs/temporary/` | 30 �?| 临时草稿、中间产�?|

---

## 六、自动更新机制设�?
### 6.1 文档分类同步脚本

```bash
# 扫描 docs/ 并生成分类索�?npm run doc:sync-categories

# 检查文档分类一致�?npm run doc:category-check

# 自动修复分类索引
npm run doc:category-fix
```

### 6.2 新鲜度维护机�?
| 检查项 | 阈�?| 动作 |
|--------|------|------|
| 超过 30 天未更新 | 黄色警告 | CI 输出警告日志 |
| 超过 90 天未更新 | 红色标记 STALE | 必须人工验证或归�?|
| 代码-文档双向不一�?| 任何差异 | audit:docs 失败 |
| 跨文档引用断�?| 任何断裂 | audit:doc-integrity 失败 |

---

## 七、归档策�?
### 7.1 归档目录

```
docs/07-archive/
├── README.md                    # 归档清单
├── deletion-log.md              # 删除日志
├── deprecated-docs/             # DEPRECATED 文档
├── old-versions/                # 旧版本文�?└── temporary/                   # 临时归档
```

### 7.2 归档流程

```
1. 标记：文件名前缀 DEPRECATED_ + 头部添加归档信息
2. 迁移：移�?docs/07-archive/ 对应子目�?3. 更新引用：搜索全仓库引用，更新至新位置或标记为已归档
4. 双人确认�? 个月满期后，需 2 人确认无价值方可删�?5. 删除：git rm，登记至 deletion-log.md
```

---

## 八、验证清�?
- [ ] 所有目录结构符�?A-H 编码规则
- [ ] 无重复文档遗�?- [ ] 跨文档引用全部更�?- [ ] audit:doc-integrity 通过（零阻断性违规）
- [ ] README.md 主控索引同步更新
- [ ] governance.md 分类映射同步更新
- [ ] 自动更新脚本已编写并测试
- [ ] 归档目录已创建并配置
