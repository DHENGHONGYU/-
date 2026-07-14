# SEC EDGAR 插件

> **数据域**: 美国 SEC 上市公司申报文件与财务数据  
> **原始路径**: [`plugins/sec_edgar/SKILL.md`](../../plugins/sec_edgar/SKILL.md)（扁平化） / [`plugins/sec_edgar/skills/sec_edgar/SKILL.md`](../../plugins/sec_edgar/skills/sec_edgar/SKILL.md)（嵌套）  
> **同步日期**: 2025-07-12

---

## 简介

SEC EDGAR 提供全面的美国上市公司申报文件和财务数据，包括公司信息、申报文件、XBRL 事实数据、财务报表、内幕交易、机构持仓和重大公司事件。

## 使用场景

- 美国上市公司公司信息查询
- SEC 申报文件检索（10-K、10-Q、8-K 等）
- XBRL 结构化财务数据
- 财务报表分析
- 内幕交易和机构持仓数据
- 重大公司事件跟踪

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

1. 运行 `python3 scripts/sec_edgar_tool.py describe` 获取数据源描述文档
2. 仔细阅读返回的 Markdown，了解数据源规则、SEC 公司和申报文件格式、全局约束及各 API 的参数要求
3. 选择最匹配用户问题的 API（公司信息、申报文件、XBRL 数据、财务报表、内幕交易、机构持仓、重大公司事件）
4. 严格按照 Markdown 要求构建 `params`，仅使用 API 支持的公司、证券代码、CIK、表格类型、期间、日期、准入编号和分页字段
5. 使用 `python3 scripts/sec_edgar_tool.py call` 调用具体 API
6. 调用失败时，从响应中解释失败原因
7. 调用成功时，先保存返回的文件，然后使用 `resp.result.assistant` 回答；仅在需要展示内容时参考 `resp.result.user`

## 脚本使用

```bash
# 查看数据能力
cd plugins/sec_edgar
python3 scripts/sec_edgar_tool.py describe

# 调用具体 API
python3 scripts/sec_edgar_tool.py call \
  --api-name "<api name from markdown>" \
  --params-json '{"required_param":"value"}'
```

参数较多时，可写入 JSON 文件：
```bash
python3 scripts/sec_edgar_tool.py call \
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

*本文档与 [`plugins/sec_edgar/SKILL.md`](../../plugins/sec_edgar/SKILL.md) 同步，更新时请同时修改两者。*
