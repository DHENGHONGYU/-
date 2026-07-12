# V9 架构蓝图（Blueprints）

> **定位**：存放系统级架构蓝图，以 Mermaid/图表形式呈现核心数据流、调用链与部署拓扑。  
> **消费方式**：在支持 Mermaid 的 Markdown 阅读器（如 VS Code + Mermaid 插件、GitHub、Obsidian）中直接渲染。  
> **命名规范**：`v{版本号}-{主题}.{mmd/md}`。

---

## 当前蓝图

| 文件 | 主题 | 说明 | 状态 |
|------|------|------|------|
| `v9-pipeline-sequence.mmd` | 投研 Pipeline 序列图 | 完整采集→评分→策略→信号→交易→复盘主链路（P1–P15），涵盖 16 个 Service 交互 | ✅ 现行 |

## Pipeline 序列图概览

`v9-pipeline-sequence.mmd` 描绘了 V9 投研系统的完整主链路：

```
用户/定时器
  → fetcherService (采集 stocks, daily_quotes)
  → v6ScoreService (L0-L8 因子评分)
  → hotSectorAnalyzer + valuePitAnalyzer (五维评分)
  → rotationScoreService (轮动共振)
  → dualStrategyEngine (双策略信号)
  → signalGenerator (技术综合信号)
  → tradingService (风控+下单)
  → tradeReviewAI (复盘报告)
  → [支线] data-collector / executionPlanService / portfolioService / executionLogService
```

---

## 扩展计划

- [ ] `v9-dataflow-topology.mmd` — 数据层拓扑（IndexedDB Store 关系图）
- [ ] `v9-layer-dependency.mmd` — 分层依赖图（config → core → data → services → store → pages）
- [ ] `v9-cockpit-widget-map.mmd` — Cockpit Widget 组合关系图
