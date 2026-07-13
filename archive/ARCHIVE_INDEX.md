# Archive Index - V9 Intelligent Research Review System

> **Created**: 2026-07-13  
> **Version**: 1.0.0  
> **Purpose**: 记录归档文件清单、分类、来源和价值评估，便于后续知识检索和复用

---

## 1. Archive Structure

```
archive/
├── docs/                     # 文档归档
│   ├── 07-archive/          # 废弃文档与截图
│   ├── architecture-radar/   # 架构雷达分析产物
│   ├── playground/           # 文档草稿与实验
│   └── reports/              # 历史报告归档
├── scripts/                  # 废弃脚本
└── unused-components/        # 未使用组件
```

---

## 2. Archive Classification

### 2.1 Value Assessment Legend

| 标识 | 含义 | 说明 |
|:---|:---|:---|
| 🟢 高价值 | 可能再次使用 | 保留完整，定期审查 |
| 🟡 中价值 | 参考资料 | 保留，按需检索 |
| 🔴 低价值 | 临时产物 | 可在下次清理时删除 |

---

## 3. Detailed Index

### 3.1 docs/07-archive/ — 废弃文档

| 文件 | 类型 | 来源 | 价值 | 说明 |
|:---|:---|:---|:---|:---|
| AI_CENTER_DATA_DEFINITION.md.DEPRECATED | 数据定义 | 旧版 AI Center 规范 | 🟡 | 已被新规范替代 |
| BACKTEST_DATA_DEFINITION.md.DEPRECATED | 数据定义 | 旧版回测数据规范 | 🟡 | 已被新规范替代 |
| DATAFLOW_DATA_DEFINITION.md.DEPRECATED | 数据定义 | 旧版数据流规范 | 🟡 | 已被新规范替代 |
| DEPRECATED_batch1-merge-report.md | 合并报告 | 批次1合并记录 | 🟡 | 历史参考 |
| DEPRECATED_batch2-merge-report.md | 合并报告 | 批次2合并记录 | 🟡 | 历史参考 |
| DEPRECATED_batch3-merge-report.md | 合并报告 | 批次3合并记录 | 🟡 | 历史参考 |
| DEPRECATED_cockpit-news-doc-correction-plan.md | 修正计划 | 驾驶舱新闻文档修正 | 🟡 | 历史参考 |
| DEPRECATED_doc-sync-gap-list.md | 差距清单 | 文档同步差距 | 🟡 | 历史参考 |
| DEPRECATED_ui-module-alignment.md | 对齐报告 | UI模块对齐 | 🟡 | 历史参考 |
| DEPRECATED_v9-issue-execution-board.md | 执行看板 | 问题执行追踪 | 🟡 | 历史参考 |
| DEPRECATED_v9-issue-resolution-schedule.md | 解决计划 | 问题解决时间表 | 🟡 | 历史参考 |
| DEPRECATED_v9-parallel-task-schedule.md | 任务计划 | 并行任务计划 | 🟡 | 历史参考 |
| MULTI_FACTOR_SCREENING_DATA_DEFINITION.md.DEPRECATED | 数据定义 | 旧版多因子筛选规范 | 🟡 | 已被新规范替代 |
| NEWS_DATA_DEFINITION.md.DEPRECATED | 数据定义 | 旧版新闻数据规范 | 🟡 | 已被新规范替代 |
| README.md | 说明 | 归档目录说明 | 🟢 | 索引文档 |
| RISK_DERIVED_DATA_DEFINITION.md.DEPRECATED | 数据定义 | 旧版风险派生数据规范 | 🟡 | 已被新规范替代 |
| SEVEN_DIM_CONFIG_DATA_DEFINITION.md.DEPRECATED | 数据定义 | 旧版七维度配置规范 | 🟡 | 已被新规范替代 |

#### screenshots/ — 截图归档

| 文件 | 类型 | 来源 | 价值 | 说明 |
|:---|:---|:---|:---|:---|
| _hub_via_hash.png | 截图 | Agent Hub | 🟡 | 历史参考 |
| agent-detail-fetcher.png | 截图 | Agent详情 | 🟡 | 历史参考 |
| agent-detail-notfound.png | 截图 | Agent详情 | 🟡 | 历史参考 |
| agent-detail-v6.png | 截图 | Agent详情 | 🟡 | 历史参考 |
| agent-hub.png | 截图 | Agent Hub | 🟡 | 历史参考 |
| agent-registry.png | 截图 | Agent注册表 | 🟡 | 历史参考 |
| placeholder-capability-graph.png | 截图 | 能力图 | 🟡 | 历史参考 |
| placeholder-custom.png | 截图 | 自定义 | 🟡 | 历史参考 |
| placeholder-dag-scheduler.png | 截图 | DAG调度器 | 🟡 | 历史参考 |
| placeholder-feedback.png | 截图 | 反馈 | 🟡 | 历史参考 |
| placeholder-llm.png | 截图 | LLM | 🟡 | 历史参考 |
| placeholder-tasks.png | 截图 | 任务 | 🟡 | 历史参考 |
| placeholder-trigger.png | 截图 | 触发器 | 🟡 | 历史参考 |
| report.json | 数据 | 截图报告 | 🟡 | 历史数据 |

---

### 3.2 docs/architecture-radar/ — 架构雷达

| 文件 | 类型 | 来源 | 价值 | 说明 |
|:---|:---|:---|:---|:---|
| architecture-radar-v2.html | HTML | 架构雷达v2 | 🟢 | 可复用分析工具 |
| unregistered-pages-analysis.html | HTML | 未注册页面分析 | 🟢 | 可复用分析工具 |
| fonts/* | 字体 | 分析工具字体 | 🟡 | 依赖资源 |
| js/echarts.min.js | JS | 图表库 | 🟡 | 依赖资源 |
| assets/charts.js | JS | 图表脚本 | 🟡 | 依赖资源 |

---

### 3.3 docs/playground/ — 文档草稿

| 文件 | 类型 | 来源 | 价值 | 说明 |
|:---|:---|:---|:---|:---|
| api-doc-draft-*.md | 草稿 | API文档草稿 | 🟡 | 可参考 |
| complete-api-doc.md | 文档 | API文档 | 🟢 | 可复用 |
| doc-update-list-*.md | 清单 | 文档更新清单 | 🟡 | 历史参考 |
| doc-update-suggestion-*.md | 建议 | 文档更新建议 | 🟡 | 历史参考 |

---

### 3.4 docs/reports/ — 历史报告

| 文件 | 类型 | 来源 | 价值 | 说明 |
|:---|:---|:---|:---|:---|
| audit/* | JSON | 审计报告 | 🟡 | 历史数据 |
| doc-pipeline/* | MD | 文档流水线报告 | 🟡 | 历史参考 |
| lessons-learned/* | MD | 经验教训 | 🟢 | 知识库 |
| test/proofread-report.md | MD | 校对报告 | 🟡 | 历史参考 |
| 2026-07-*.md | MD | 月度报告 | 🟢 | 历史记录 |
| audit-batch-C-analysis.md | MD | 批次分析 | 🟡 | 历史参考 |
| code-quality-report-*.md | MD | 代码质量报告 | 🟢 | 可对比 |
| mcp-architecture-*.md | MD | MCP架构报告 | 🟢 | 架构参考 |
| system-rectification-*.md | MD | 系统整改报告 | 🟢 | 历史记录 |

---

### 3.5 scripts/ — 废弃脚本

| 文件 | 类型 | 来源 | 价值 | 说明 |
|:---|:---|:---|:---|:---|
| doc-notify.ts | TS | 文档通知 | 🟡 | 已废弃 |
| doc-pipeline.ts | TS | 文档流水线 | 🟡 | 已废弃 |
| doc-retry.ts | TS | 文档重试 | 🟡 | 已废弃 |

---

### 3.6 unused-components/ — 未使用组件

| 文件 | 类型 | 来源 | 价值 | 说明 |
|:---|:---|:---|:---|:---|
| wizard-steps/DataSourceConfigStep.tsx | TSX | 数据源配置步骤 | 🟢 | 可复用 |
| wizard-steps/ExecutionMonitorStep.tsx | TSX | 执行监控步骤 | 🟢 | 可复用 |

---

## 4. Retrieval Guidelines

### 4.1 How to Search

| 搜索目标 | 建议路径 | 关键词 |
|:---|:---|:---|
| 数据定义规范 | `docs/07-archive/` | `DATA_DEFINITION` |
| 审计历史 | `docs/reports/audit/` | `audit-` |
| 架构分析 | `docs/architecture-radar/` | `radar` |
| 废弃组件 | `unused-components/` | 组件名 |

### 4.2 Reactivation Process

1. 在本索引中找到目标文件
2. 评估价值等级
3. 🟢 高价值：直接恢复使用
4. 🟡 中价值：审查后决定是否恢复
5. 🔴 低价值：如需恢复，先确认必要性

---

## 5. Cleanup Schedule

| 时间 | 操作 | 负责人 |
|:---|:---|:---|
| 2026-07-13 | 初始归档 | V9 Quality Audit Team |
| 2026-08-01 | 首次清理审查 | V9 Quality Audit Team |
| 2026-09-01 | 月度审查 | V9 Quality Audit Team |

---

## 6. Statistics

| 类别 | 文件数 | 大小 | 高价值 | 中价值 | 低价值 |
|:---|:---|:---|:---|:---|:---|
| docs/07-archive/ | 18 | ~1MB | 1 | 17 | 0 |
| docs/architecture-radar/ | ~60 | ~2MB | 2 | ~58 | 0 |
| docs/playground/ | 8 | ~1MB | 1 | 7 | 0 |
| docs/reports/ | ~70 | ~5MB | 10 | ~60 | 0 |
| scripts/ | 3 | ~0.1MB | 0 | 3 | 0 |
| unused-components/ | 2 | ~0.1MB | 2 | 0 | 0 |
| **合计** | **~161** | **~9.2MB** | **16** | **~137** | **0** |