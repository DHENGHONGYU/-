---
doc_id: V9-DOC-PROJ-GOV-001
title: 文档治理文件结构报告 — 上线前最终归档
status: archived
version: v1.0.0
last_updated: 2026-08-03
code_version: 2.0.0-rc.1
category: governance
tier: standard
maintainer: V9 Dev Team
tags: [governance, file-structure, archive, launch-readiness]
related_docs: [V9-DOC-GOV-001]
summary: "本次文档治理工作完成后 docs/ 目录的完整文件结构归档，包含层级关系、关键文件说明与变更摘要，供长期查阅。"
change_log:
  - version: v1.0.0
    changes: "C 类版本闭环(2026-08-11)：补全 change_log 初始条目"
    date: 2026-08-03
---

# 文档治理文件结构报告 — 上线前最终归档

> **生成日期**: 2026-08-03  
> **基线提交**: `bfc638e2` (merge: 合并 origin/release/v2.1.0-prerelease)  
> **docs/ 文件总数**: 714 (git tracked)  
> **报告用途**: 长期归档与查阅，记录上线前文档治理最终状态

---

## 1. 项目顶层结构

```
FinSightV9/
├── docs/                       # 文档根目录（本报告聚焦）
├── src/                        # 前端源码（React + TypeScript）
│   ├── apps/                   # 应用层（cockpit/trading/stockpool/input）
│   ├── components/             # 组件层（atoms/molecules/organisms/templates）
│   ├── config/                 # 配置层（dbConfig/strategyConfig 等）
│   ├── core/                   # 核心层（envelope/databridge/eventBus）
│   ├── data/                   # 数据层（types/db/stores）
│   ├── hooks/                  # 自定义 Hooks
│   ├── lib/                    # 工具库（logger/crypto/errors）
│   ├── pages/                  # 路由页面
│   ├── services/               # 服务层（fetcher/llm/strategy/data-collector）
│   ├── store/                  # Zustand 状态管理
│   └── types/                  # 全局类型定义
├── scripts/                    # 构建/审计/工具脚本
│   ├── audit/                  # 审计脚本（layer-calls/acl-consistency 等）
│   ├── docs-tool/              # 文档工具（freshness/sync/cross-ref）
│   ├── quality/                # 质量扫描（complexity-scan）
│   └── verify/                 # 验证脚本
├── tests/                      # 测试套件
├── public/                     # 静态资源
├── .github/workflows/          # CI/CD 工作流
├── .husky/                     # Git 钩子（pre-commit/pre-push）
├── .trae/skills/               # Trae SKILL 注册表（权威源）
├── .workbuddy/                 # WorkBuddy 配置（已清理，仅保留必要项）
├── package.json                # 项目配置（npm scripts/deps）
├── tsconfig.json               # TypeScript 配置（主）
├── tsconfig.test.json          # TypeScript 测试配置
├── vite.config.ts              # Vite 构建配置（含 /api/akshare proxy）
├── eslint.config.js            # ESLint 配置
└── README.md                   # 项目说明
```

---

## 2. docs/ 根目录核心文件清单

### 2.1 编号核心文档（01-10 系列，已合并权威版本）

| 序号 | 文件名 | 说明 | 变更说明 |
|------|--------|------|----------|
| 01 | `01-vision-and-goals.md` | 项目愿景与目标 | 权威版本合并自 explanation/ 子目录 |
| 02 | `02-functional-specs.md` | 功能规格说明 | 权威版本合并自 reference/ 子目录 |
| 03 | `03-architecture-standards.md` | 架构标准（五层架构真相源） | 补充 frontmatter，含 doc_id V9-DOC-ARCH-004 |
| 04 | `04-ui-ux-specs.md` | UI/UX 规格说明 | 保留根目录版本，删除子目录副本 |
| 05 | `05-engine-specs.md` | 引擎规格说明 | 保留根目录版本 |
| 06 | `06-routing-specs.md` | 路由规格说明 | 保留根目录版本 |
| 07 | `07-operation-strategy.md` | 运营策略 | 保留根目录版本 |
| 08 | `08-implementation-plan.md` | 实施计划 | 保留根目录版本 |
| 09 | `09-quality-gates.md` | 质量门禁标准 | 保留根目录版本 |
| 10 | `10-glossary.md` | 术语表 | 保留根目录版本 |

### 2.2 变更与发布文档

| 文件名 | 说明 | 变更说明 |
|--------|------|----------|
| `CHANGELOG.md` | 变更日志 | 权威版本合并自 reference/（v2.6.0） |
| `RELEASE_NOTES.md` | 发布说明 | v2.1.0-prerelease 发布说明 |
| `CODE-REVIEW.md` | 代码审查 checklist | 权威版本合并自 reference/ |

### 2.3 技术规格文档

| 文件名 | 说明 | 变更说明 |
|--------|------|----------|
| `design-tokens.md` | 设计令牌定义 | 权威版本合并自 reference/，修复 1 处断链 |
| `testing-strategy.md` | 测试策略 | 保留根目录版本，删除子目录副本 |
| `widget-development-guide.md` | Widget 开发指南 | 保留根目录版本，删除子目录副本 |
| `TECH-DEBT.md` | 技术债务清单 | 保留根目录版本 |
| `V9_IndexedDB_Store_Schema.md` | IndexedDB 存储结构 | 保留根目录版本 |

### 2.4 数据字典文档（DATA_DEFINITION 系列）

| 文件名 | 说明 |
|--------|------|
| `AI_CENTER_DATA_DEFINITION.md` | AI 中心数据定义 |
| `AI_CENTER_VUE3_EXAMPLES.md` | AI 中心 Vue3 示例 |
| `BACKTEST_DATA_DEFINITION.md` | 回测数据定义 |
| `DATAFLOW_DATA_DEFINITION.md` | 数据流数据定义 |
| `MULTI_FACTOR_SCREENING_DATA_DEFINITION.md` | 多因子筛选数据定义 |
| `NEWS_DATA_DEFINITION.md` | 新闻数据定义 |
| `SEVEN_DIM_CONFIG_DATA_DEFINITION.md` | 七维配置数据定义 |
| `DATA_DICTIONARY_INDEX.md` | 数据字典索引 |

### 2.5 架构图与索引

| 文件名 | 说明 | 变更说明 |
|--------|------|----------|
| `class-diagram.mermaid` | 类图（Mermaid） | 保留 |
| `sequence-diagram.mermaid` | 时序图（Mermaid） | 保留 |
| `REGISTRY_INDEX.md` | 文档注册索引（自动生成） | 同步更新 |
| `registry-index.md` | 文档注册索引（旧版） | 待评估是否合并 |
| `_redirect-map.json` | 文档重定向映射 | 新增 32 条重定向记录（总计 444 条） |

### 2.6 中文治理文档（根目录）

| 文件名 | 说明 | 变更说明 |
|--------|------|----------|
| `V9数据宪法.md` | V9 数据治理宪法 | 修复 37 处 file:/// 绝对路径断链 |
| `数据治理路线图.md` | 数据治理路线图 | 修复 5 处 file:/// 绝对路径断链 |
| `踩坑规则门禁指南.md` | 踩坑规则与门禁指南 | 修复 12 处 file:/// 绝对路径断链 |
| `《功能模块数据契约》.md` | 功能模块数据契约 | 保留 |
| `《DataBridge端点与数据映射清单》.md` | DataBridge 端点映射 | 保留 |
| `《V9 代码实现分析报告》.md` | V9 代码实现分析 | 保留 |
| `《V9 架构缺陷与整改行动清单》.md` | 架构缺陷整改清单 | 保留 |
| `《V9 架构覆盖分析报告》.md` | 架构覆盖分析 | 保留 |
| `《V9 目标功能清单》.md` | 目标功能清单 | 保留 |
| `《V9数据架构修订建议》.md` | 数据架构修订建议 | 保留 |
| `《V9核心数据字典与类型定义（整合版）》.md` | 核心数据字典 | 保留 |
| `《V9现有数据资产清单》.md` | 数据资产清单 | 保留 |
| `文件整理清单.md` | 文件整理清单 | 保留 |
| `V9_数据血缘追踪.md` | 数据血缘追踪 | 保留 |
| `V9_L2状态层补齐路线图.md` | L2 状态层补齐路线图 | 保留 |

### 2.7 其他根目录文件

| 文件名 | 说明 |
|--------|------|
| `README.md` | 文档目录说明 |

---

## 3. docs/ 一级子目录结构

### 3.1 Diataxis 分类目录

| 目录 | Diataxis 类别 | 说明 | 文件数（约） |
|------|---------------|------|-------------|
| `tutorials/` | Tutorials | 入门教程 | 5 |
| `how-to/` | How-To | 操作指南 | 20+ |
| `reference/` | Reference | 参考文档 | 40+ |
| `explanation/` | Explanation | 解释性文档 | 30+ |

### 3.2 功能域目录

| 目录 | 说明 | 关键文件 |
|------|------|----------|
| `00-meta/` | 元文档（审计工作表、目录结构、迁移框架） | type-domain-audit-worksheet.md, FILE-MANAGEMENT-GUIDE-optimization-prompt.md |
| `01-product/` | 产品文档 | data-security-and-privacy.md |
| `01-requirements/` | 需求文档 | - |
| `02-design/` | 设计文档 | - |
| `03-development/` | 开发文档 | - |
| `04-testing/` | 测试文档 | security-test-plan.md |
| `06-project-management/` | 项目管理 | 本报告所在目录 |
| `ai/` | AI 相关文档 | - |
| `architecture/` | 架构文档 | - |
| `audit/` | 审计报告 | code-quality-audit-report.md |
| `cockpit/` | 驾驶舱文档 | - |
| `data-collection/` | 数据采集文档 | - |
| `design/` | 设计文档（blueprints） | - |
| `drafts/` | 草稿文档 | - |
| `guides/` | 指南文档 | - |
| `implementation/` | 实施文档 | - |
| `modules/` | 模块文档 | data-layer-overview.md |
| `news/` | 新闻模块文档 | - |
| `ops/` | 运维文档 | data-source-config.md（新增）, production-deployment-guide.md（新增） |
| `prompts/` | 提示词文档 | - |
| `reports/` | 报告文档 | - |
| `specs/` | 规格文档 | - |
| `standards/` | 标准文档 | - |
| `strategy/` | 策略文档 | - |
| `superpowers/` | 超能力文档 | - |
| `team-handbook/` | 团队手册 | 06-team-operation-guide.md（修复 21 处断链） |
| `team-handbook-html/` | 团队手册 HTML 版本 | - |
| `testing/` | 测试文档 | - |
| `trade/` | 交易模块文档 | - |

### 3.3 归档目录

| 目录 | 说明 | 处理原则 |
|------|------|----------|
| `archive/` | 历史归档 | 保留现状，不修改 file:/// 链接（7 个文件含历史绝对路径） |
| `archive/00-meta-historical/` | 元历史归档 | 开发日志、P1 治理报告、预发布审计报告等 |

### 3.4 新增目录

| 目录 | 说明 | 新增文件 |
|------|------|----------|
| `governance/` | 治理报告目录（本次新增） | breaking-changes-report-2026-08-03.md |

---

## 4. 本次文档治理变更摘要

### 4.1 断链修复（共 97 处）

| 文件 | 断链类型 | 修复数量 | 修复方式 |
|------|----------|----------|----------|
| `docs/V9数据宪法.md` | file:/// 跨用户绝对路径 | 37 | 替换为 ./ 相对路径 |
| `docs/guides/team-handbook/06-team-operation-guide.md` | file:/// 跨盘符绝对路径 | 21 | 替换为 ./ 相对路径 |
| `docs/踩坑规则门禁指南.md` | file:/// 跨用户绝对路径 | 12 | 替换为 ./ 相对路径 |
| `docs/explanation/design/踩坑规则门禁指南.md` | file:/// 跨用户绝对路径 | 5 | 替换为 ./ 相对路径 |
| `docs/数据治理路线图.md` | file:/// 跨用户绝对路径 | 5 | 替换为 ./ 相对路径 |
| `docs/audit/code-quality-audit-report.md` | computer:// 错误协议 | 4 | 改为说明性文字（标注历史归档） |
| `docs/reference/walkthrough-scoredoc-report.md` | file:/// 跨用户绝对路径（含乱码） | 4 | 替换为 ./ 相对路径 |
| `docs/specs/product/data-security-and-privacy.md` | file:/// 跨盘符绝对路径 | 4 | 替换为 ../../src/ 相对路径 |
| `docs/reports/testing/security-test-plan.md` | file:/// 跨盘符绝对路径 | 1 | 替换为 ./ 相对路径 |
| `docs/reference/data-collection-route-ui-audit.md` | file:////src/ 错误格式 | 1 | 替换为 ./src/ 相对路径 |
| `docs/design-tokens.md` | ../explanation/architecture.md 错误路径 | 1 | 替换为 ./03-architecture-standards.md |
| `docs/meta/type-domain-audit-worksheet.md` | explanation/01-vision-and-goals.md 旧路径 | 1 | 替换为 ../01-vision-and-goals.md |
| `docs/explanation/design/autonomous-workflow-optimization.md` | CHANGELOG.md/09-quality-gates.md 路径 | 2 | 替换为正确相对路径 |
| `docs/explanation/design/stock-selection-strategy.md` | 05-engine-specs.md/03-architecture-standards.md 路径 | 2 | 替换为正确相对路径 |
| `docs/explanation/design/v9-strategy-architecture.md` | 03-architecture-standards.md/05-engine-specs.md 路径 | 2 | 替换为正确相对路径 |

### 4.2 配置文件修复

| 文件 | 问题 | 修复方式 |
|------|------|----------|
| `package.json` | 重复键 `audit:deadCode` / `audit:deadcode`（大小写不敏感冲突） | 删除重复的 `audit:deadCode` 条目 |

### 4.3 权威版本合并（16 个文档）

| 文档 | 合并来源 | 合并目标 |
|------|----------|----------|
| `01-vision-and-goals.md` | docs/explanation/ | docs/（根目录） |
| `02-functional-specs.md` | docs/reference/ | docs/（根目录） |
| `03-architecture-standards.md` | docs/reference/ | docs/（根目录），补充 frontmatter |
| `CHANGELOG.md` | docs/reference/（v2.6.0） | docs/（根目录） |
| `CODE-REVIEW.md` | docs/reference/ | docs/（根目录） |
| `design-tokens.md` | docs/reference/ | docs/（根目录） |
| `testing-strategy.md` | docs/guides/how-to/ | docs/（根目录，保留版本） |
| `widget-development-guide.md` | docs/guides/how-to/ | docs/（根目录，保留版本） |
| ... | 共 16 个文档完成权威版本合并 | |

### 4.4 重定向映射更新

- `docs/_redirect-map.json` 新增 32 条重定向记录
- 总记录数：444 条
- 覆盖：01-vision-and-goals.md、10-glossary.md、02-functional-specs.md 等路径变更

### 4.5 新增文档

| 文件 | 说明 |
|------|------|
| `docs/reports/governance/breaking-changes-report-2026-08-03.md` | 破坏性变更报告 — 上线前工具配置整合与废弃文件清理 |
| `docs/reports/ops/data-source-config.md` | 数据源配置总结（含 /api/akshare 代理链路验证） |
| `docs/reports/ops/production-deployment-guide.md` | 生产环境部署指南（Nginx/环境变量/AkShare 服务） |

### 4.6 文档治理索引更新

| 文件 | 说明 |
|------|------|
| `docs/guides/how-to/FILE-MANAGEMENT-GUIDE.md` | 新增 "docs/ 根目录允许文件清单" 表格 |
| `docs/REGISTRY_INDEX.md` | 自动生成，同步最新文档注册信息 |
| `docs/meta/type-domain-audit-worksheet.md` | 修正 01-vision-and-goals.md 路径引用 |

---

## 5. 质量验证结果

| 检查项 | 结果 | 说明 |
|--------|------|------|
| JSON 配置文件有效性 | ✅ 通过 | package.json / _redirect-map.json / tsconfig.* 均有效 |
| package.json 重复键 | ✅ 已修复 | 删除 audit:deadCode 重复条目 |
| tsc:prod 类型检查 | ✅ 0 错误 | `tsc -p tsconfig.json --noEmit` 通过 |
| 活跃文档断链扫描 | ✅ 已清理 | 10 个活跃文档 94 处 file:/// 全部修复 |
| 历史归档断链 | ⚠️ 保留现状 | archive/ 目录 7 个文件含历史绝对路径，按归档原则不修改 |
| /api/akshare 代理验证 | ✅ 200 OK | 重启 dev server 后代理链路完全打通 |

---

## 6. 涉及的 Git 提交历史

本次文档治理工作通过以下提交完成（按时间倒序）：

| 提交哈希 | 提交信息 |
|----------|----------|
| `bfc638e2` | merge: 合并 origin/release/v2.1.0-prerelease（18 commits） |
| `aca9cb58` | docs: 上线就绪报告增量更新 |
| `9be324e7` | docs: 自动同步相对路径规范化 |
| `14b68c6c` | chore: 颜色令牌迁移与文档同步 |
| `c3afc287` | docs: 更新 CHANGELOG/CODE-REVIEW/design-tokens 反映上线前治理 |
| `91b2001d` | chore(docs): 文档治理索引同步与源码类型强化 |
| `9127a880` | chore(config): SKILL路径迁移与配置同步 |
| `2fed1ed8` | chore(docs): 上线前文档治理 - 清理 _pending-deletion 与归档迁移 |
| `9a0c82d4` | chore(docs+atoms): 上线前文档治理与 atoms 组件补齐 |
| `3f1be19a` | docs: 编码损坏恢复批次 + 补齐缺失文档 + 映射表一致性 |
| `8e43f92d` | docs(encoding): P2 GBK→UTF-8 转码 + audit:docs 挂死根因修复 |
| `1bbdc338` | chore(backup): 取消自动 git 备案功能并清理 .workbuddy 旧目录 |

---

## 7. 后续维护建议

1. **断链定期扫描**：建议将 `file:///` 绝对路径扫描纳入 CI/CD 门禁，防止新增断链
2. **归档目录清理**：`archive/00-meta-historical/` 中的 7 个文件含历史 file:/// 路径，可在后续专项治理中评估是否转为说明性文字
3. **中文文件名规范**：根目录存在多个中文文件名文档（V9数据宪法.md 等），建议评估是否统一为英文文件名或迁移至子目录
4. **registry-index.md 去重**：根目录同时存在 `REGISTRY_INDEX.md` 和 `registry-index.md`，建议评估是否合并
5. **重定向映射维护**：`_redirect-map.json` 已达 444 条记录，建议定期审计失效重定向

---

**报告生成人**: V9 Dev Team  
**报告版本**: v1.0.0  
**归档位置**: `docs/reports/project-management/docs-governance-file-structure-report-2026-08-03.md`
