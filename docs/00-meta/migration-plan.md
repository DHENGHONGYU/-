# V9 文档迁移计划（A-H 分类体系）

> **版本**: v1.0.0 | **日期**: 2026-07-13
> **适用范围**: docs/ 目录下所有文档的 A-H 分类迁移
> **强制等级**: 必须遵守

---

## 一、A-H 分类与物理目录映射

| 分类 | 名称 | 物理目录 | 说明 |
|------|------|----------|------|
| **A** | 导航与治理 | `00-meta/` | 索引、宪法、归类、体检报告 |
| **B** | 架构设计 | `02-design/architecture/` | 全局架构、舱室、服务、引擎、数据层、安全模型 |
| **C** | 功能模块 | `02-design/` | 各舱 spec、Widget、页面、组件体系 |
| **D** | 技术规范 | `02-design/standards/` | 分层、门禁、令牌、复杂度、API 契约、开发工作流 |
| **E** | 测试策略 | `04-testing/` | 单元/e2e/覆盖率 |
| **F** | AI 辅助工程治理 | `03-development/ai/` | 提示词模板、记忆层、飞轮、AI 工程入口 |
| **G** | 过程与质量产物 | `reports/` | 报告、审计、changelog、草稿 |
| **H** | 跨域补充 | `03-development/guides/` | 入门、How-to、安全、部署、i18n |

---

## 二、二级子类映射

| 二级子类 | 归属一级类 | 物理路径 | 说明 |
|----------|-----------|----------|------|
| A1 索引与宪法 | A | `00-meta/` | README、GOVERNANCE、体检报告 |
| A2 需求规格 | A | `01-requirements/` | 愿景、功能规格、系统蓝图 |
| A3 插件集成 | A | `03-development/plugins/` | 插件/扩展文档 |
| B1 全局架构 | B | `02-design/architecture/` | overview、cabins-overview、services-catalog |
| B2 子系统架构 | B | `02-design/architecture/subsystems/` | 驾驶舱、采集、数据层 |
| B3 架构决策 | B | `02-design/architecture/adr/` | ADR 主索引 + 决策记录 |
| B4 合规与整改 | B | `02-design/architecture/compliance/` | 架构审计、整改策略 |
| B5 版本/发布 | B | `05-deployment/` | RELEASE_NOTES、PR_DESCRIPTION |
| C1 舱室体系 | C | `02-design/cabins/` | 5 舱 spec + PortalShell |
| C2 组件体系 | C | `02-design/components/` | 原子组件、组件库、迁移规范 |
| C3 驾驶舱/Widget | C | `02-design/cockpit/` | Widget 开发、集成、错误处理 |
| C4 状态层 Store | C | `02-design/store/` | Zustand Store 规范 |
| C5 服务层 Services | C | `02-design/services/` | 20+ 子域服务契约 |
| C6 数据层 | C | `02-design/data-layer/` | IndexedDB Schema、采集架构、数据血缘 |
| C7 数据字典 | C | `02-design/standards/` | DATA_DICTIONARY_INDEX + 数据定义 |
| D1 编码与分层规范 | D | `02-design/standards/` | AGENTS.md 契约、编码规范 |
| D2 设计系统与令牌 | D | `02-design/standards/design-tokens/` | L1-L4 令牌、宋韵美学 |
| D3 质量门禁与审计 | D | `02-design/standards/quality-gates/` | audit:* 脚本、复杂度治理 |
| D4 注释与文档化 | D | `03-development/jsdoc-convention.md` | JSDoc 规范、Frontmatter 规范 |
| D5 迁移规范 | D | `03-development/migration/` | v6→v9 迁移、DB Schema 升级 |
| E1 测试分层 | E | `04-testing/` | 单元/集成/E2E 分层 |
| E2 用例与清单 | E | `04-testing/test-cases/` | 测试用例、清单 |
| E3 报告与覆盖率 | E | `04-testing/reports/` | 测试报告、覆盖率 |
| E4 门禁 | E | `04-testing/gates/` | 测试相关质量门禁 |
| F1 提示词模板 | F | `prompts/` | system/component/service/store/types 模板 |
| F2 检查表 | F | `03-development/checklists/` | 迁移/集成检查表 |
| F3 记忆层与飞轮 | F | `02-design/ai/` | AI 记忆层、生成→审计→修复闭环 |
| G1 审计报告 | G | `reports/audit/` | audit JSON/HTML、自动产物 |
| G2 变更日志 | G | `reports/changelogs/` | changelogs/、CHANGELOG.md |
| G3 复盘/整改报告 | G | `reports/retrospectives/` | 架构整改、UI 整改、质量复盘 |
| G4 草稿/临时 | G | `reports/drafts/` | 过程草稿、临时产物 |
| G5 发布管理 | G | `reports/release-management/` | 发布计划、回滚方案 |
| H1 安全与权限 | H | `03-development/guides/security/` | 安全模型、MCP ACL |
| H2 部署与运维 | H | `05-deployment/ops/` | 部署架构、Runbook |
| H3 入门与教程 | H | `03-development/guides/getting-started/` | 新手教程、How-to |
| H4 无障碍与国际化 | H | `03-development/guides/accessibility/` | a11y、i18n |

---

## 三、待创建的新目录

| 目录路径 | 用途 | 优先级 |
|----------|------|--------|
| `docs/reports/` | G 类过程与质量产物根目录 | P0 |
| `docs/reports/audit/` | 审计报告自动产物 | P0 |
| `docs/reports/changelogs/` | 变更日志 | P0 |
| `docs/reports/retrospectives/` | 复盘/整改报告 | P1 |
| `docs/reports/drafts/` | 草稿/临时文件 | P1 |
| `docs/reports/release-management/` | 发布管理文档 | P1 |
| `docs/02-design/architecture/subsystems/` | 子系统架构 | P1 |
| `docs/02-design/architecture/compliance/` | 合规与整改 | P1 |
| `docs/02-design/cabins/` | 舱室体系 | P1 |
| `docs/02-design/components/` | 组件体系 | P1 |
| `docs/02-design/store/` | 状态层 Store | P1 |
| `docs/02-design/services/` | 服务层契约 | P1 |
| `docs/02-design/data-layer/` | 数据层 | P1 |
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
| DATA_DICTIONARY_INDEX.md | `02-design/` | `02-design/standards/` | 保留 standards/ 版本，归档 02-design/ 版本 |
| CODE-REVIEW.md | `01-requirements/` | `04-testing/audit-reports/audit/` | 保留 01-requirements/ 版本，归档 audit/ 版本 |
| V9 架构缺陷与整改行动清单.md | `02-design/` | `04-testing/audit-reports/audit/` | 保留 02-design/ 版本，归档 audit/ 版本 |
| code-quality-audit-report.md | `01-requirements/` | `04-testing/audit-reports/audit/` | 合并内容到 01-requirements/，归档 audit/ 版本 |
| quality-gates-baseline.md | `03-development/` | `02-design/09-quality-gates.md` | 合并内容到 03-development/，归档 02-design/ 版本 |

### 4.2 版本融合评估标准

| 更新程度 | 评估标准 | 处理策略 |
|----------|----------|----------|
| **完全替代** | 新版本包含旧版本全部内容 + 新增内容 ≥ 50% | 归档旧版本到 07-archive/ |
| **部分融合** | 新版本包含旧版本部分内容，有互补信息 | 合并到新版本，归档旧版本 |
| **增量更新** | 新版本仅更新部分章节或数据 | 保留新版本，归档旧版本 |
| **内容冲突** | 新旧版本内容存在矛盾 | 人工审查后决定保留哪个版本 |
| **独立文档** | 新旧版本主题不同但文件名相似 | 重命名后分别保留 |

---

## 五、迁移执行计划

### 5.1 批次划分

| 批次 | 分类 | 文件数量 | 预计时间 |
|------|------|----------|----------|
| 1 | A (导航与治理) | ~30 | 1h |
| 2 | B (架构设计) | ~50 | 2h |
| 3 | C (功能模块) | ~80 | 3h |
| 4 | D (技术规范) | ~20 | 1h |
| 5 | E (测试策略) | ~30 | 1h |
| 6 | F (AI 工程) | ~15 | 0.5h |
| 7 | G (过程产物) | ~60 | 2h |
| 8 | H (跨域补充) | ~15 | 0.5h |

### 5.2 迁移步骤

```
1. 创建目标目录结构
2. 识别重复文档并制定融合/归档策略
3. 按批次迁移文档
4. 更新跨文档引用链接
5. 运行 npm run audit:doc-integrity 验证
6. 更新 README.md 和 GOVERNANCE.md
7. 创建归档目录并迁移旧版本
```

### 5.3 执行日志

| 日期 | 操作 | 状态 |
|------|------|------|
| 2026-07-13 | 创建归档目录 `00-meta/deprecated-docs/old-versions/` 和 `00-meta/deprecated-docs/temporary/` | ✅ 完成 |
| 2026-07-13 | 归档 deployment.md v1.0.0（02-design/architecture/ → deprecated-docs/old-versions/） | ✅ 完成 |
| 2026-07-13 | 归档 DATA_DEFINITION.md v1.0.0-cockpit（02-design/cockpit/ → deprecated-docs/old-versions/） | ✅ 完成 |
| 2026-07-13 | 归档 regression-suite.md v1.0.0（02-design/ → deprecated-docs/old-versions/） | ✅ 完成 |
| 2026-07-13 | 归档 DATA_DICTIONARY_INDEX.md v1.6.0（02-design/ → deprecated-docs/old-versions/） | ✅ 完成 |
| 2026-07-13 | 归档 REGISTRY_INDEX.md v1.0.0-02-design（02-design/ → deprecated-docs/old-versions/） | ✅ 完成 |
| 2026-07-13 | 分类规则扩展完成，408 个文档 100% 分类 | ✅ 完成 |

### 5.4 归档策略

| 归档类型 | 目录 | 保留期限 | 说明 |
|----------|------|----------|------|
| 旧版本 | `00-meta/deprecated-docs/old-versions/` | 90 天 | 完全被替代的旧版本文档 |
| 临时文件 | `00-meta/deprecated-docs/temporary/` | 30 天 | 临时草稿、中间产物 |

---

## 六、自动更新机制设计

### 6.1 文档分类同步脚本

```bash
# 扫描 docs/ 并生成分类索引
npm run doc:sync-categories

# 检查文档分类一致性
npm run doc:category-check

# 自动修复分类索引
npm run doc:category-fix
```

### 6.2 新鲜度维护机制

| 检查项 | 阈值 | 动作 |
|--------|------|------|
| 超过 30 天未更新 | 黄色警告 | CI 输出警告日志 |
| 超过 90 天未更新 | 红色标记 STALE | 必须人工验证或归档 |
| 代码