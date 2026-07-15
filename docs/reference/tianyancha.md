---
title: tianyancha
code_version: 2.0.0

tier: important
---

---
title: docs/reference/tianyancha.md
code_version: 2.0.0
tier: important
---

# Tianyancha 插件

> **数据域**: 天眼查企业数据库（中国大陆企业信息）  
> **原始路径**: [`plugins/tianyancha/SKILL.md`](../../plugins/tianyancha/SKILL.md)（扁平化） / [`plugins/tianyancha/skills/tianyancha/SKILL.md`](../../plugins/tianyancha/skills/tianyancha/SKILL.md)（嵌套）  
> **同步日期**: 2025-07-12

---

## 简介

天眼查企业数据库覆盖企业注册、经营、风险、上市、司法、知识产权、投资、关系、集团、资质、私募基金、人员、报告和搜索等数据，共 17 大类 226 个接口。

## 使用场景

- 企业注册信息查询
- 经营状态与风险监控
- 上市信息、司法信息、知识产权查询
- 投资关系、集团关系、资质查询
- 私募基金、人员、报告数据
- 企业多维搜索

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

1. 运行 `python3 scripts/tianyancha_tool.py describe` 获取数据源描述文档
2. 仔细阅读返回的 Markdown，了解数据源规则、证券/实体格式、全局约束及各 API 的参数要求
3. 选择最匹配用户问题的 API
4. 严格按照 Markdown 要求构建 `params`
5. 使用 `python3 scripts/tianyancha_tool.py call` 调用具体 API
6. 调用失败时，从响应中解释失败原因
7. 调用成功时，先保存返回的文件，然后使用 `resp.result.assistant` 回答；仅在需要展示内容时参考 `resp.result.user`

## 脚本使用

```bash
# 查看数据能力
cd plugins/tianyancha
python3 scripts/tianyancha_tool.py describe

# 调用具体 API
python3 scripts/tianyancha_tool.py call \
  --api-name "<api name from markdown>" \
  --params-json '{"required_param":"value"}'
```

参数较多时，可写入 JSON 文件：
```bash
python3 scripts/tianyancha_tool.py call \
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

*本文档与 [`plugins/tianyancha/SKILL.md`](../../plugins/tianyancha/SKILL.md) 同步，更新时请同时修改两者。*
