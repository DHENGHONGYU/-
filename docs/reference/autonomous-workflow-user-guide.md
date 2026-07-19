---
title: V9 自主工作流使用指�?
type: reference
domain: product
phase: development
tier: standard
status: active
maintainer: V9 Architecture Team
summary: "版本: v1.0.0 | 日期: 2026-07-04 适用对象: V9 项目团队成员 目标: 帮助团队成员快速掌握自主工作流工具的使用方�?"
tags: [product, workflow, guide]
version: v1.0.0
last_updated: 2026-07-17
code_version: 2.0.0
change_log:
  - version: v1.0.0
changes: Initial version established
date: 2026-07-17
---ence
domain: product
tier: standard
status: active
maintainer: V9 Architecture Team
tags: [product, workflow, guide]
phase: development
version: v1.0.0
last_updated: 2026-07-17
code_version: 2.0.0
---

# V9 自主工作流使用指�?
> **版本**: v1.0.0 | **日期**: 2026-07-04  
> **适用对象**: V9 项目团队成员  
> **目标**: 帮助团队成员快速掌握自主工作流工具的使用方�?
---

## 一、工具概�?
V9 自主工作流系统包含以下核心工具：

| 工具 | 命令 | 用�?|
|------|------|------|
| **日志查询工具** | `npm run changelog:query` | 查询和分析历史任务日�?|
| **文档更新触发�?* | `npm run doc:trigger` | 检测代码变更并提示需要更新的文档 |
| **工作流规则引�?* | `npm run workflow:decide` | 根据代码变更自动判断决策级别 |
| **异常检测器** | `npm run anomaly:detect` | 检测系统指标异常并告警 |

---

## 二、日志查询工�?
### 2.1 基本用法

```bash
# 查询所有日�?npm run changelog:query -- --all

# 按日期查�?npm run changelog:query -- --date=2026-07-04

# 按日期范围查�?npm run changelog:query -- --since=2026-07-01 --until=2026-07-31

# 按任务类型查�?npm run changelog:query -- --type=code_refactor

# 按参与者查�?npm run changelog:query -- --participant=张三

# 按状态查�?npm run changelog:query -- --status=completed

# 关键词搜�?npm run changelog:query -- --keyword=评分引擎
```

### 2.2 高级功能

```bash
# 查看统计摘要
npm run changelog:summary

# 导出�?Markdown 报告
npm run changelog:query -- --all --export=markdown

# 导出到指定文�?npm run changelog:query -- --date=2026-07 --export=markdown --output=docs/reports/2026-07.md

# JSON 格式输出（便于程序处理）
npm run changelog:query -- --all --json
```

### 2.3 常见场景

**场景 1：查看本周完成的任务**
```bash
npm run changelog:query -- --since=2026-07-01 --until=2026-07-07 --status=completed
```

**场景 2：生成月度报�?*
```bash
npm run changelog:query -- --date=2026-07 --export=markdown --output=docs/reports/monthly-2026-07.md
```

**场景 3：查找某人的所有决�?*
```bash
npm run changelog:query -- --participant=架构�?--json
```

---

## 三、文档更新触发器

### 3.1 基本用法

```bash
# 检查代码变更并提示需要更新的文档
npm run doc:trigger

# 仅检查模式（不生成更新建议）
npm run doc:check
```

### 3.2 触发器类�?
触发器会自动检测以下类型的代码变更�?
| 触发�?| 监控路径 | 需要更新的文档 |
|--------|---------|---------------|
| **T1 类型定义变更** | `src/data/types.ts`<br>`src/types/modules/*.ts`<br>`src/services/scoring/v6-engine/types.ts` | `./data-dictionary-index.md`<br>`./v9核心数据字典与类型定�?整合�?.md` |
| **T2 接口变更** | `src/services/**/index.ts`<br>`src/core/databridge.ts`<br>`src/data/dataLayer.ts` | `./api-contract.md`<br>`./databridge端点与数据映射清�?md` |
| **T3 架构调整** | `src/config/routes.ts`<br>`src/config/dbConfig.ts`<br>`../../AGENTS.md` | `./03-architecture-standards.md`<br>`./06-routing-specs.md`<br>`../explanation/03-architecture-standards.md` |
| **T4 配置参数变更** | `src/constants/*.ts`<br>`src/config/thresholds.ts`<br>`src/services/scoring/v6-engine/config.ts` | `./05-engine-specs.md`<br>`./09-quality-gates.md` |

### 3.3 工作流程

1. 提交代码前运�?`npm run doc:trigger`
2. 查看输出的文档更新建�?3. 手动更新相关文档
4. 运行 `npm run audit:docs` 验证文档同步状�?5. 提交代码和文档变�?
### 3.4 最佳实�?
- **每次提交前检�?*：在 `git commit` 前运�?`npm run doc:trigger`
- **批量更新**：如果涉及多个文档，可以一次性更新后统一提交
- **验证同步**：更新文档后运行 `npm run audit:docs` 确保无遗�?
---

## 四、工作流规则引擎

### 4.1 基本用法

```bash
# 查看决策建议
npm run workflow:decide

# 详细模式（显示评估过程）
npm run workflow:decide -- --verbose

# JSON 格式输出
npm run workflow:decide:json
```

### 4.2 决策级别

规则引擎会根据代码变更特征自动判断决策级别：

| 级别 | 适用场景 | 处理方式 |
|------|---------|---------|
| **�?自主执行** | 低风险、单模块、完全可�?| 直接执行，无需人工干预 |
| **�?人工确认** | 中风险、跨模块、部分可�?| 生成影响分析报告，提交人工审�?|
| **�?人工决策** | 高风险、系统级、不可�?| 生成技术选型报告，提交技术评审委员会 |

### 4.3 规则示例

**规则 R001：单模块代码修复**
- 条件：单个模块内的代码修复、格式化、注释更�?- 决策：自主执�?- 理由：低风险、完全可逆、影响范围可�?
**规则 R005：跨模块重构**
- 条件：涉�?3 个以上模块的重构操作
- 决策：人工确�?- 理由：跨模块重构影响范围广，需要人工评估影�?
**规则 R010：核心算法重�?*
- 条件：修�?V6 评分引擎、数据融合算�?- 决策：人工决�?- 理由：核心算法变更影响业务核心逻辑

### 4.4 工作流程

1. 开始新任务前运�?`npm run workflow:decide`
2. 查看决策级别和建�?3. 根据决策级别选择处理方式�?   - **自主执行**：直接开始任�?   - **人工确认**：生成影响分析报告，等待审批
   - **人工决策**：生成技术选型报告，提交评�?4. 任务完成后生成结构化日志

---

## 五、异常检测器

### 5.1 基本用法

```bash
# 检测异�?npm run anomaly:detect

# JSON 格式输出
npm run anomaly:detect:json

# 更新基线指标
npm run anomaly:baseline

# 自定义阈�?npm run anomaly:detect -- --threshold=10
```

### 5.2 异常类型

| 异常类型 | 检测方�?| 严重程度 | 处理策略 |
|---------|---------|---------|---------|
| **测试失败�?* | > 阈值（默认 5%�?| �?严重 | 检查失败的测试用例，修复代码或更新测试 |
| **Lint 警告** | 超过基线 10% | �?�?| 运行 `npm run lint --fix` 自动修复 |
| **硬编码问�?* | 超过基线 5% | �?�?| 提取硬编码到 `constants/` �?`config/` |
| **文档同步** | 存在未文档化模块 | �?�?| 运行 `npm run doc:trigger` 检查需要更新的文档 |
| **类型错误** | 存在类型错误 | 严重 | 运行 `npx tsc --noEmit` 查看错误详情并修�?|

### 5.3 基线管理

基线指标存储�?`docs/metrics/baseline.json`，包含：
- 测试失败�?- Lint 警告�?- 硬编码问题数
- 文档同步问题�?- 类型错误�?
**更新基线的场�?*�?- 系统重构后指标稳定在新水�?- 新增功能导致指标永久性变�?- 定期（如每月）回顾和调整

### 5.4 工作流程

1. 定期运行 `npm run anomaly:detect`（建议每日或每次重大变更后）
2. 查看异常告警
3. 根据严重程度处理异常�?   - **严重**：立即处理，阻塞其他任务
   - **�?*：优先处理，当天完成
   - **�?*：计划处理，本周完成
4. 处理完成后运�?`npm run anomaly:baseline` 更新基线（如需要）

---

## 六、集成工作流

### 6.1 日常开发流�?
```bash
# 1. 开始任务前：评估决策级�?npm run workflow:decide

# 2. 开发过程中：定期检查异�?npm run anomaly:detect

# 3. 提交代码前：检查文档同�?npm run doc:trigger

# 4. 提交代码前：验证架构合规
npm run audit

# 5. 任务完成后：生成日志
# （由 AI 助手自动完成�?```

### 6.2 CI/CD 集成

GitHub Actions 工作流已配置以下自动化检查：

- **代码提交�?*：自动运行架构审�?- **Pull Request �?*：自动生�?changelog 摘要并评�?- **合并�?main �?*：自动生成月度报�?
### 6.3 团队协作规范

**代码审查清单**�?- [ ] 是否运行�?`npm run workflow:decide` 并遵循决策级别？
- [ ] 是否运行�?`npm run doc:trigger` 并更新了相关文档�?- [ ] 是否运行�?`npm run audit` 并确保无违规�?- [ ] 是否运行�?`npm run anomaly:detect` 并处理了异常�?- [ ] 是否生成了结构化日志�?
---

## 七、故障排�?
### 7.1 常见问题

**问题 1：日志查询工具无输出**
- 原因：`docs/changelogs/` 目录下没有日志文�?- 解决：确保任务完成后生成了结构化日志

**问题 2：文档触发器报错**
- 原因：Git 环境异常或无法获�?diff
- 解决：检�?Git 状态，或手动指定变更文�?
**问题 3：规则引擎判断不准确**
- 原因：规则条件不匹配实际场景
- 解决：查�?`--verbose` 输出，调整规则或手动指定决策级别

**问题 4：异常检测器误报**
- 原因：基线指标过�?- 解决：运�?`npm run anomaly:baseline` 更新基线

### 7.2 获取帮助

- 查看工具帮助：`npm run <command> -- --help`
- 查看详细文档：`../prompts/autonomous-workflow-optimization.md`
- 联系架构治理团队

---

## 八、附�?
### 8.1 命令速查�?
| 命令 | 用�?|
|------|------|
| `npm run changelog:query -- --all` | 查询所有日�?|
| `npm run changelog:query -- --date=YYYY-MM-DD` | 按日期查�?|
| `npm run changelog:query -- --since=YYYY-MM-DD --until=YYYY-MM-DD` | 按日期范围查�?|
| `npm run changelog:summary` | 查看统计摘要 |
| `npm run changelog:query -- --export=markdown` | 导出 Markdown 报告 |
| `npm run doc:trigger` | 检查文档更新需�?|
| `npm run doc:check` | 仅检查模�?|
| `npm run workflow:decide` | 查看决策建议 |
| `npm run workflow:decide -- --verbose` | 详细模式 |
| `npm run anomaly:detect` | 检测异�?|
| `npm run anomaly:baseline` | 更新基线 |

### 8.2 相关文档

- [自主工作流优化策略](../explanation/design/autonomous-workflow-optimization.md)
- [AI 行为约束契约](../../AGENTS.md)
- [质量门禁](../explanation/design/09-quality-gates.md)
- [实施治理](../explanation/design/implementation-governance.md)

---

> **文档维护**: 本文档由 V9 架构治理团队维护  
> **更新频率**: 根据工具迭代持续更新
