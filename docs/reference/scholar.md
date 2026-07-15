---
title: scholar
code_version: 2.0.0

tier: important
---

---
title: docs/reference/scholar.md
code_version: 2.0.0
tier: important
---

# Scholar 插件

> **数据域**: 学术文献检索（Google Scholar 风格）  
> **原始路径**: [`plugins/scholar/SKILL.md`](../../plugins/scholar/SKILL.md)（扁平化） / [`plugins/scholar/skills/scholar/SKILL.md`](../../plugins/scholar/skills/scholar/SKILL.md)（嵌套）  
> **同步日期**: 2025-07-12

---

## 简介

Scholar 是一个免费可访问的学术文献搜索引擎，索引全文或元数据，覆盖多种出版格式和学科领域。提供全面的学术研究能力，包括基于关键词的论文搜索（返回标题、作者、摘要、引用数、出版年份和访问链接）、高级搜索（支持作者名和出版年份范围过滤），以及详细的作者画像查询（含学术指标 h-index、i10-index、总引用数、研究兴趣和主要出版物）。

适用于学术研究、文献综述、引文分析和趋势研究。

## 使用场景

- 学术论文搜索与关键词检索
- 引文数据分析
- 作者画像查询（h-index、i10-index、总引用数）
- 学术趋势研究
- 文献综述支持

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

1. 运行 `python3 scripts/scholar_tool.py describe` 获取数据源描述文档
2. 仔细阅读返回的 Markdown，了解数据源规则、学术搜索格式、全局约束及各 API 的参数要求
3. 选择最匹配用户问题的 API（论文搜索、高级论文搜索、作者画像查询）
4. 严格按照 Markdown 要求构建 `params`，仅使用 API 支持的关键词、作者、出版年份、分页、画像、引用或访问链接字段
5. 使用 `python3 scripts/scholar_tool.py call` 调用具体 API
6. 调用失败时，从响应中解释失败原因
7. 调用成功时，先保存返回的文件，然后使用 `resp.result.assistant` 回答；仅在需要展示内容时参考 `resp.result.user`

## 脚本使用

```bash
# 查看数据能力
cd plugins/scholar
python3 scripts/scholar_tool.py describe

# 调用具体 API
python3 scripts/scholar_tool.py call \
  --api-name "<api name from markdown>" \
  --params-json '{"required_param":"value"}'
```

参数较多时，可写入 JSON 文件：
```bash
python3 scripts/scholar_tool.py call \
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

*本文档与 [`plugins/scholar/SKILL.md`](../../plugins/scholar/SKILL.md) 同步，更新时请同时修改两者。*
