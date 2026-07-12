# V9 自主工作流使用指南

> **版本**: v1.0.0 | **日期**: 2026-07-04  
> **适用对象**: V9 项目团队成员  
> **目标**: 帮助团队成员快速掌握自主工作流工具的使用方法

---

## 一、工具概览

V9 自主工作流系统包含以下核心工具：

| 工具 | 命令 | 用途 |
|------|------|------|
| **日志查询工具** | `npm run changelog:query` | 查询和分析历史任务日志 |
| **文档更新触发器** | `npm run doc:trigger` | 检测代码变更并提示需要更新的文档 |
| **工作流规则引擎** | `npm run workflow:decide` | 根据代码变更自动判断决策级别 |
| **异常检测器** | `npm run anomaly:detect` | 检测系统指标异常并告警 |

---

## 二、日志查询工具

### 2.1 基本用法

```bash
# 查询所有日志
npm run changelog:query -- --all

# 按日期查询
npm run changelog:query -- --date=2026-07-04

# 按日期范围查询
npm run changelog:query -- --since=2026-07-01 --until=2026-07-31

# 按任务类型查询
npm run changelog:query -- --type=code_refactor

# 按参与者查询
npm run changelog:query -- --participant=张三

# 按状态查询
npm run changelog:query -- --status=completed

# 关键词搜索
npm run changelog:query -- --keyword=评分引擎
```

### 2.2 高级功能

```bash
# 查看统计摘要
npm run changelog:summary

# 导出为 Markdown 报告
npm run changelog:query -- --all --export=markdown

# 导出到指定文件
npm run changelog:query -- --date=2026-07 --export=markdown --output=docs/reports/2026-07.md

# JSON 格式输出（便于程序处理）
npm run changelog:query -- --all --json
```

### 2.3 常见场景

**场景 1：查看本周完成的任务**
```bash
npm run changelog:query -- --since=2026-07-01 --until=2026-07-07 --status=completed
```

**场景 2：生成月度报告**
```bash
npm run changelog:query -- --date=2026-07 --export=markdown --output=docs/reports/monthly-2026-07.md
```

**场景 3：查找某人的所有决策**
```bash
npm run changelog:query -- --participant=架构师 --json
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

### 3.2 触发器类型

触发器会自动检测以下类型的代码变更：

| 触发器 | 监控路径 | 需要更新的文档 |
|--------|---------|---------------|
| **T1 类型定义变更** | `src/data/types.ts`<br>`src/types/modules/*.ts`<br>`src/services/scoring/v6-engine/types.ts` | `docs/DATA_DICTIONARY_INDEX.md`<br>`docs/《V9核心数据字典与类型定义（整合版）》.md` |
| **T2 接口变更** | `src/services/**/index.ts`<br>`src/core/databridge.ts`<br>`src/data/dataLayer.ts` | `docs/trade/API_CONTRACT.md`<br>`docs/《DataBridge端点与数据映射清单》.md` |
| **T3 架构调整** | `src/config/routes.ts`<br>`src/config/dbConfig.ts`<br>`AGENTS.md` | `docs/03-architecture-standards.md`<br>`docs/06-routing-specs.md`<br>`ARCHITECTURE.md` |
| **T4 配置参数变更** | `src/constants/*.ts`<br>`src/config/thresholds.ts`<br>`src/services/scoring/v6-engine/config.ts` | `docs/05-engine-specs.md`<br>`docs/09-quality-gates.md` |

### 3.3 工作流程

1. 提交代码前运行 `npm run doc:trigger`
2. 查看输出的文档更新建议
3. 手动更新相关文档
4. 运行 `npm run audit:docs` 验证文档同步状态
5. 提交代码和文档变更

### 3.4 最佳实践

- **每次提交前检查**：在 `git commit` 前运行 `npm run doc:trigger`
- **批量更新**：如果涉及多个文档，可以一次性更新后统一提交
- **验证同步**：更新文档后运行 `npm run audit:docs` 确保无遗漏

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
| **✓ 自主执行** | 低风险、单模块、完全可逆 | 直接执行，无需人工干预 |
| **◐ 人工确认** | 中风险、跨模块、部分可逆 | 生成影响分析报告，提交人工审批 |
| **✗ 人工决策** | 高风险、系统级、不可逆 | 生成技术选型报告，提交技术评审委员会 |

### 4.3 规则示例

**规则 R001：单模块代码修复**
- 条件：单个模块内的代码修复、格式化、注释更新
- 决策：自主执行
- 理由：低风险、完全可逆、影响范围可控

**规则 R005：跨模块重构**
- 条件：涉及 3 个以上模块的重构操作
- 决策：人工确认
- 理由：跨模块重构影响范围广，需要人工评估影响

**规则 R010：核心算法重构**
- 条件：修改 V6 评分引擎、数据融合算法
- 决策：人工决策
- 理由：核心算法变更影响业务核心逻辑

### 4.4 工作流程

1. 开始新任务前运行 `npm run workflow:decide`
2. 查看决策级别和建议
3. 根据决策级别选择处理方式：
   - **自主执行**：直接开始任务
   - **人工确认**：生成影响分析报告，等待审批
   - **人工决策**：生成技术选型报告，提交评审
4. 任务完成后生成结构化日志

---

## 五、异常检测器

### 5.1 基本用法

```bash
# 检测异常
npm run anomaly:detect

# JSON 格式输出
npm run anomaly:detect:json

# 更新基线指标
npm run anomaly:baseline

# 自定义阈值
npm run anomaly:detect -- --threshold=10
```

### 5.2 异常类型

| 异常类型 | 检测方式 | 严重程度 | 处理策略 |
|---------|---------|---------|---------|
| **测试失败率** | > 阈值（默认 5%） | 高/严重 | 检查失败的测试用例，修复代码或更新测试 |
| **Lint 警告** | 超过基线 10% | 中/高 | 运行 `npm run lint --fix` 自动修复 |
| **硬编码问题** | 超过基线 5% | 中/高 | 提取硬编码到 `constants/` 或 `config/` |
| **文档同步** | 存在未文档化模块 | 中/高 | 运行 `npm run doc:trigger` 检查需要更新的文档 |
| **类型错误** | 存在类型错误 | 严重 | 运行 `npx tsc --noEmit` 查看错误详情并修复 |

### 5.3 基线管理

基线指标存储在 `docs/metrics/baseline.json`，包含：
- 测试失败率
- Lint 警告数
- 硬编码问题数
- 文档同步问题数
- 类型错误数

**更新基线的场景**：
- 系统重构后指标稳定在新水平
- 新增功能导致指标永久性变化
- 定期（如每月）回顾和调整

### 5.4 工作流程

1. 定期运行 `npm run anomaly:detect`（建议每日或每次重大变更后）
2. 查看异常告警
3. 根据严重程度处理异常：
   - **严重**：立即处理，阻塞其他任务
   - **高**：优先处理，当天完成
   - **中**：计划处理，本周完成
4. 处理完成后运行 `npm run anomaly:baseline` 更新基线（如需要）

---

## 六、集成工作流

### 6.1 日常开发流程

```bash
# 1. 开始任务前：评估决策级别
npm run workflow:decide

# 2. 开发过程中：定期检查异常
npm run anomaly:detect

# 3. 提交代码前：检查文档同步
npm run doc:trigger

# 4. 提交代码前：验证架构合规
npm run audit

# 5. 任务完成后：生成日志
# （由 AI 助手自动完成）
```

### 6.2 CI/CD 集成

GitHub Actions 工作流已配置以下自动化检查：

- **代码提交时**：自动运行架构审计
- **Pull Request 时**：自动生成 changelog 摘要并评论
- **合并到 main 时**：自动生成月度报告

### 6.3 团队协作规范

**代码审查清单**：
- [ ] 是否运行了 `npm run workflow:decide` 并遵循决策级别？
- [ ] 是否运行了 `npm run doc:trigger` 并更新了相关文档？
- [ ] 是否运行了 `npm run audit` 并确保无违规？
- [ ] 是否运行了 `npm run anomaly:detect` 并处理了异常？
- [ ] 是否生成了结构化日志？

---

## 七、故障排查

### 7.1 常见问题

**问题 1：日志查询工具无输出**
- 原因：`docs/changelogs/` 目录下没有日志文件
- 解决：确保任务完成后生成了结构化日志

**问题 2：文档触发器报错**
- 原因：Git 环境异常或无法获取 diff
- 解决：检查 Git 状态，或手动指定变更文件

**问题 3：规则引擎判断不准确**
- 原因：规则条件不匹配实际场景
- 解决：查看 `--verbose` 输出，调整规则或手动指定决策级别

**问题 4：异常检测器误报**
- 原因：基线指标过时
- 解决：运行 `npm run anomaly:baseline` 更新基线

### 7.2 获取帮助

- 查看工具帮助：`npm run <command> -- --help`
- 查看详细文档：`docs/implementation/autonomous-workflow-optimization.md`
- 联系架构治理团队

---

## 八、附录

### 8.1 命令速查表

| 命令 | 用途 |
|------|------|
| `npm run changelog:query -- --all` | 查询所有日志 |
| `npm run changelog:query -- --date=YYYY-MM-DD` | 按日期查询 |
| `npm run changelog:query -- --since=YYYY-MM-DD --until=YYYY-MM-DD` | 按日期范围查询 |
| `npm run changelog:summary` | 查看统计摘要 |
| `npm run changelog:query -- --export=markdown` | 导出 Markdown 报告 |
| `npm run doc:trigger` | 检查文档更新需求 |
| `npm run doc:check` | 仅检查模式 |
| `npm run workflow:decide` | 查看决策建议 |
| `npm run workflow:decide -- --verbose` | 详细模式 |
| `npm run anomaly:detect` | 检测异常 |
| `npm run anomaly:baseline` | 更新基线 |

### 8.2 相关文档

- [自主工作流优化策略](./autonomous-workflow-optimization.md)
- [AI 行为约束契约](../../AGENTS.md)
- [质量门禁](../09-quality-gates.md)
- [实施治理](./implementation-governance.md)

---

> **文档维护**: 本文档由 V9 架构治理团队维护  
> **更新频率**: 根据工具迭代持续更新
