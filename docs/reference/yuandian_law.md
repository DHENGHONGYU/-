---
title: yuandian_law
code_version: 2.0.0

tier: important
---

---
title: docs/reference/yuandian_law.md
code_version: 2.0.0
tier: important
---

# Yuandian Law 插件

> **数据域**: 元典法律数据库（中国大陆法律法规与案例）  
> **原始路径**: [`plugins/yuandian_law/SKILL.md`](../../plugins/yuandian_law/SKILL.md)（扁平化） / [`plugins/yuandian_law/skills/yuandian_law/SKILL.md`](../../plugins/yuandian_law/skills/yuandian_law/SKILL.md)（嵌套）  
> **同步日期**: 2025-07-12

---

## 简介

元典法律数据库（Yuandian Law）是中国（大陆）法律数据库，涵盖法律法规、司法解释和法院案例。提供语义搜索和关键词搜索以及详情查询——覆盖所有效力级别的法律法规（宪法、国家法律、司法解释、行政法规、部门规章等）和普通与权威案例——支持多维过滤（效力级别、效力状态、法院、行政区划、案例类别、日期等）。适用于法律案例分析、法律咨询、法律研究和合规分析。

## 使用场景

- 法律法规语义搜索和关键词搜索
- 法律详情查询（法律、法规、司法解释、行政规章）
- 法院案例检索（普通案例和权威案例）
- 多维度过滤：效力级别、效力状态、法院、行政区划、案例类别、日期
- 法律案例分析、法律咨询、法律研究和合规分析

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

1. 运行 `python3 scripts/yuandian_law_tool.py describe` 获取数据源描述文档
2. 仔细阅读返回的 Markdown，了解数据源规则、法律领域格式、全局约束及各 API 的参数要求
3. 选择最匹配用户问题的 API（语义搜索、关键词搜索、法律法规或案例详情查询）
4. 严格按照 Markdown 要求构建 `params`，仅使用 API 支持的过滤器（效力级别、效力状态、法院、行政区划、案例类别、日期）
5. 使用 `python3 scripts/yuandian_law_tool.py call` 调用具体 API
6. 调用失败时，从响应中解释失败原因
7. 调用成功时，先保存返回的文件，然后使用 `resp.result.assistant` 回答；仅在需要展示内容时参考 `resp.result.user`

## 脚本使用

```bash
# 查看数据能力
cd plugins/yuandian_law
python3 scripts/yuandian_law_tool.py describe

# 调用具体 API
python3 scripts/yuandian_law_tool.py call \
  --api-name "<api name from markdown>" \
  --params-json '{"required_param":"value"}'
```

参数较多时，可写入 JSON 文件：
```bash
python3 scripts/yuandian_law_tool.py call \
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

*本文档与 [`plugins/yuandian_law/SKILL.md`](../../plugins/yuandian_law/SKILL.md) 同步，更新时请同时修改两者。*
