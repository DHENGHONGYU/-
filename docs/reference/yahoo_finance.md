---
title: Yahoo Finance 插件
type: reference
domain: project
phase: development
tier: standard
status: active
maintainer: V9 Architecture Team
summary: "数据域: Yahoo Finance 全球股票数据 原始路径:..."
tags: [data-source, finance, reference, project]
version: v1.0.0
last_updated: 2026-07-17
code_version: "2.0.0-rc.2"
doc_id: V9-DOC-PROJ-196
referenced_by: [V9-DOC-META-000, V9-DOC-PROJ-176, V9-DOC-PROJ-097, V9-DOC-PROJ-149]
change_log:
  - version: v1.0.0
changes: Initial version established
date: 2026-07-17
---

# Yahoo Finance 插件

> **数据域**: Yahoo Finance 全球股票数据  
> **原始路径**: [`plugins/yahoo_finance/SKILL.md`](../../plugins/yahoo_finance/SKILL.md)（扁平化） / [`plugins/yahoo_finance/skills/yahoo_finance/SKILL.md`](../../plugins/yahoo_finance/skills/yahoo_finance/SKILL.md)（嵌套）  
> **同步日期**: 2025-07-12

---

## 简介

Yahoo Finance 提供给定股票代码的股票信息，包括股票价格和交易信息、公司信息、财务指标、盈利和收入、利润率和回报率、股息、资产负债表数据、所有权、分析师覆盖和风险指标。

## 使用场景

- 股票价格和交易信息查询
- 公司信息和画像数据
- 财务指标、盈利、收入、利润率、回报率和风险指标
- 资产负债表数据及其他支持的报表详情
- 股息、所有权、持有人信息和分析师覆盖

## 环境准备

```bash
# 检查并安装 agent-gw Python SDK
python3 -c "import agent_gw" || python3 -m pip install "$(curl -s https://cdn.kimi.com/agentgw/pysdk/manifest.json | python3 -c "import json,sys; print(json.load(sys.stdin)['latest']['url'])")"
```

API Key 来源：
1. 命令行参数 `api_key=...`
2. 环境变量 `KIMI_API_KEY`
3. 配置文件 `~/.kimi/agent-gw.json`

## 工作流

1. 运行 `python3 scripts/yahoo_finance_tool.py describe` 获取数据源描述文档
2. 仔细阅读返回的 Markdown，了解数据源规则、证券代码格式、覆盖范围、全局约束及各 API 的参数要求
3. 选择最匹配用户问题的 API
4. 严格按照 Markdown 要求构建 `params`，注意证券代码、交易所后缀、日期范围、报表类型、报告期、币种和指标定义
5. 使用 `python3 scripts/yahoo_finance_tool.py call` 调用具体 API
6. 调用失败时，从响应中解释失败原因
7. 调用成功时，先保存返回的文件，然后使用 `resp.result.assistant` 回答；仅在需要展示内容时参考 `resp.result.user`

## 脚本使用

```bash
# 查看数据能力
cd plugins/yahoo_finance
python3 scripts/yahoo_finance_tool.py describe

# 调用具体 API
python3 scripts/yahoo_finance_tool.py call \
  --api-name "<api name from markdown>" \
  --params-json '{"required_param":"value"}'
```

参数较多时，可写入 JSON 文件：
```bash
python3 scripts/yahoo_finance_tool.py call \
  --api-name "<api name>" \
  --params-file path/to/params.json
```

## 响应格式

```python
{
    "is_success": bool,
    "result": {"user": [str], "assistant": [str]} | None,
    "error": {"user": [str], "assistant": [str]} | None,
    "files": [{"name": str, "content": str}],
}
```

- 成功时，优先使用 `result.assistant` 内容
- 有文件返回时，按 `files[].name` 保存文件

---

*本文档与 [`plugins/yahoo_finance/SKILL.md`](../../plugins/yahoo_finance/SKILL.md) 同步，更新时请同时修改两者。*
