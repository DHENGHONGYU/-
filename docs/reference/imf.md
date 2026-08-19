---
title: IMF 插件
type: reference
domain: project
phase: development
tier: standard
status: active
maintainer: V9 Architecture Team
summary: "数据域: 国际货币基金组织（IMF）全球宏观经济数据 原始路径: [`plugins/imf/SKILL.md`](../../plugins/imf/SKILL.md)（扁平化） /..."
tags: [data-source, macro, reference, project]
version: v1.0.0
last_updated: 2026-07-17
code_version: "2.0.0-rc.2"
doc_id: V9-DOC-PROJ-220
referenced_by: [V9-DOC-META-000, V9-DOC-PROJ-176, V9-DOC-PROJ-097, V9-DOC-PROJ-149]
change_log:
  - version: v1.0.0
changes: Initial version established
date: 2026-07-17
---

# IMF 插件

> **数据域**: 国际货币基金组织（IMF）全球宏观经济数据  
> **原始路径**: [`plugins/imf/SKILL.md`](../../plugins/imf/SKILL.md)（扁平化） / [`plugins/imf/skills/imf/SKILL.md`](../../plugins/imf/skills/imf/SKILL.md)（嵌套）  
> **同步日期**: 2025-07-12

---

## 简介

IMF 提供《世界经济展望》（WEO）数据库中的全球宏观经济数据，涵盖 GDP 增长、通胀、政府债务、失业率、贸易平衡等指标，覆盖 190+ 国家/地区，同时提供 COFER 储备货币构成数据。

## 使用场景

- 跨国比较 GDP 增长、通胀、失业率、政府债务、经常账户、贸易平衡等宏观指标
- 历史宏观经济趋势分析与 WEO 预测数据
- 需要 IMF 国家/地区/全球宏观数据的政策研究
- COFER 官方外汇储备货币份额分析（USD、EUR、CNY、JPY、GBP、CHF、AUD、CAD）

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

1. 运行 `python3 scripts/imf_tool.py describe` 获取数据源描述文档
2. 仔细阅读返回的 Markdown，了解数据源规则、国家/地区格式、指标名称、数据集约束及各 API 的参数要求
3. 选择最匹配用户问题的 API
4. 严格按照 Markdown 要求构建 `params`，注意国家/地区、指标、年份范围、预测 vs 历史期间、数据集/源表、单位和频率等要求
5. 使用 `python3 scripts/imf_tool.py call` 调用具体 API
6. 调用失败时，从响应中解释失败原因
7. 调用成功时，先保存返回的文件，然后使用 `resp.result.assistant` 回答；仅在需要展示内容时参考 `resp.result.user`

## 脚本使用

```bash
# 查看数据能力
cd plugins/imf
python3 scripts/imf_tool.py describe

# 调用具体 API
python3 scripts/imf_tool.py call \
  --api-name "<api name from markdown>" \
  --params-json '{"required_param":"value"}'
```

参数较多时，可写入 JSON 文件：
```bash
python3 scripts/imf_tool.py call \
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

*本文档与 [`plugins/imf/SKILL.md`](../../plugins/imf/SKILL.md) 同步，更新时请同时修改两者。*
