---
title: World Bank Open Data 插件
type: reference
domain: data
phase: development
tier: standard
status: active
maintainer: V9 Architecture Team
summary: "数据域: 世界银行开放数据（全球发展指标） 原始路径:..."
tags: [data-source, macro, reference, data]
version: v1.0.0
last_updated: 2026-07-17
code_version: "2.0.0-rc.1"
doc_id: V9-DOC-DATA-040
referenced_by: [V9-DOC-META-000, V9-DOC-PROJ-176, V9-DOC-PROJ-097, V9-DOC-PROJ-149]
change_log:
  - version: v1.0.0
changes: Initial version established
date: 2026-07-17
---

# World Bank Open Data 插件

> **数据域**: 世界银行开放数据（全球发展指标）  
> **原始路径**: [`plugins/world_bank_open_data/SKILL.md`](../../plugins/world_bank_open_data/SKILL.md)（扁平化） / [`plugins/world_bank_open_data/skills/world_bank_open_data/SKILL.md`](../../plugins/world_bank_open_data/skills/world_bank_open_data/SKILL.md)（嵌套）  
> **同步日期**: 2025-07-12

---

## 简介

世界银行开放数据是一个免费的全球发展数据平台，覆盖世界各国，提供 29,000+ 指标，涵盖经济、社会和环境指标，包括 GDP、GNP、人口、贫困、失业率、贸易、通胀、教育、健康和环境等时间序列，数据从 1960 年至今。

## 使用场景

- 国家层面的 GDP、GNP、人口、贫困率、失业率、贸易、通胀、教育、健康和环境数据时间序列
- 跨国发展指标比较
- 1960 年至今的年度长期趋势分析（数据可得时）
- 需要世界银行指标定义和国家层面观察的经济、社会和环境研究

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

1. 运行 `python3 scripts/world_bank_open_data_tool.py describe` 获取数据源描述文档
2. 仔细阅读返回的 Markdown，了解数据源规则、国家格式、指标格式、日期范围约束及各 API 的参数要求
3. 选择最匹配用户问题的 API
4. 严格按照 Markdown 要求构建 `params`，注意国家/地区、指标代码或名称、年份范围、单位、来源、频率和国家层面数据约束
5. 使用 `python3 scripts/world_bank_open_data_tool.py call` 调用具体 API
6. 调用失败时，从响应中解释失败原因
7. 调用成功时，先保存返回的文件，然后使用 `resp.result.assistant` 回答；仅在需要展示内容时参考 `resp.result.user`

## 脚本使用

```bash
# 查看数据能力
cd plugins/world_bank_open_data
python3 scripts/world_bank_open_data_tool.py describe

# 调用具体 API
python3 scripts/world_bank_open_data_tool.py call \
  --api-name "<api name from markdown>" \
  --params-json '{"required_param":"value"}'
```

参数较多时，可写入 JSON 文件：
```bash
python3 scripts/world_bank_open_data_tool.py call \
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

*本文档与 [`plugins/world_bank_open_data/SKILL.md`](../../plugins/world_bank_open_data/SKILL.md) 同步，更新时请同时修改两者。*
