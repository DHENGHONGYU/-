"""
iFinD MCP 14维度数据映射配置
=============================
对应 V9 数据血缘文档 2.22 节：14维度 → iFinD MCP Tool 映射表

架构：采用自然语言查询模式，维度扩展只需新增 DIMENSION_MCP_MAPPING 条目
"""

from dataclasses import dataclass, field
from enum import IntEnum
from typing import List, Callable, Any, Optional

# ============================================================
# MCP Server 标识（对应 5.5 节 MCP 服务器清单）
# ============================================================

class McpServerId:
    """iFinD MCP Server 完整标识符"""
    STOCK  = "mcp_plugin_iFinD_hexin-ifind-ds-stock-mcp"
    INDEX  = "mcp_plugin_iFinD_hexin-ifind-ds-index-mcp"
    NEWS   = "mcp_plugin_iFinD_hexin-ifind-ds-news-mcp"
    FUND   = "mcp_plugin_iFinD_hexin-ifind-ds-fund-mcp"
    GLOBAL = "mcp_plugin_iFinD_hexin-ifind-ds-global-stock-mcp"


class DimensionCode(IntEnum):
    """16维度编码（对应 1.3.2 节 16维度数据源分工）"""
    BASIC_INFO      = 1   # 基本信息
    KLINE           = 2   # K线数据
    CHIP            = 3   # 筹码分布
    MAJOR_EVENTS    = 4   # 重大事项
    HOT_NEWS        = 5   # 热点新闻
    INDUSTRY_PEERS  = 6   # 行业竞品
    RELATED_INDEX   = 7   # 关联指数
    RESEARCH_REPORT = 8   # 研报中心
    FINANCIAL       = 9   # 财务数据
    HOT_SECTORS     = 10  # 热门板块
    TECH_INDICATORS = 11  # 技术指标
    FUND_FLOW       = 12  # 资金流向
    INST_HOLDINGS   = 13  # 机构持仓
    VALUATION       = 14  # 估值分析
    DIVIDEND_SHARES = 15  # 分红股本
    CONSENSUS_EST   = 16  # 一致预期


# ============================================================
# MCP 子查询定义
# ============================================================

@dataclass
class McpSubQuery:
    """
    单个 MCP 子查询定义
    对应 TypeScript: McpToolRequest { name, serverName, toolName, buildArgs, parseResponse }
    """
    name: str                              # 子查询名称（如 "basic_info", "kline"）
    server_name: str                       # MCP Server ID
    tool_name: str                         # MCP Tool 名称
    build_args: Callable[[str], dict]      # 根据 symbol 构建 run_mcp args
    parse_response: Optional[Callable[[Any], Any]] = None  # 响应解析器（可选）


# ============================================================
# 自然语言查询构建器
# ============================================================

def _nl_query_stock_info(symbol: str) -> dict:
    """Dim 01: 基本信息查询"""
    return {
        "query": f"{symbol} 的上市时间、所属申万行业、主营业务、总市值、PE、PB、ROE"
    }

def _nl_query_stock_summary(symbol: str) -> dict:
    """Dim 01: 估值摘要查询"""
    return {
        "query": f"{symbol} 的估值摘要：PE分位、PB分位、股息率、总市值"
    }

def _nl_query_performance(symbol: str) -> dict:
    """Dim 02: K线行情查询"""
    return {
        "query": f"{symbol} 近60个交易日K线数据：开盘价、最高价、最低价、收盘价、成交量、成交额"
    }

def _nl_query_highfreq(symbol: str) -> dict:
    """Dim 11: 高频行情查询"""
    return {
        "symbols": symbol,
        "indicators": "最新价,开盘价,最高价,最低价,涨跌幅,成交额,成交量,换手率,MA5,MA10,MA20,MA60,KDJ_K,KDJ_D,KDJ_J,MACD_DIF,MACD_DEA,MACD_BAR,RSI_6,RSI_12,RSI_24",
        "data_mode": "real_time"
    }

def _nl_query_shareholders(symbol: str) -> dict:
    """Dim 03/13: 股东/机构持仓查询"""
    return {
        "query": f"{symbol} 最新股东户数、户均持股、前十大股东持股比例、机构持股比例、基金持仓、北向资金持仓、QFII持仓"
    }

def _nl_query_events(symbol: str) -> dict:
    """Dim 04: 重大事项查询"""
    return {
        "query": f"{symbol} 近一年重大事项：限售解禁、增减持、股权激励、回购、分红送转、业绩预告、停复牌"
    }

def _nl_query_notice(symbol: str) -> dict:
    """Dim 04: 公告查询"""
    return {
        "query": f"{symbol} 近一年公告：年报、季报、重大合同、资产重组、股权变动"
    }

def _nl_query_news(symbol: str) -> dict:
    """Dim 05: 热点新闻查询"""
    return {
        "query": f"{symbol} 近30天最新动态和新闻"
    }

def _nl_query_peers(symbol: str) -> dict:
    """Dim 06: 行业竞品查询"""
    return {
        "query": f"{symbol} 所属申万行业市值排名前20公司、竞品公司列表"
    }

def _nl_query_sector(symbol: str) -> dict:
    """Dim 06/10: 板块行情查询"""
    return {
        "query": f"{symbol} 所属板块近7天行情涨跌幅、成交额排名"
    }

def _nl_query_index(symbol: str) -> dict:
    """Dim 07: 关联指数查询"""
    return {
        "query": f"沪深300指数、中证500指数、{symbol}所属行业指数近30天涨跌幅"
    }

def _nl_query_research(symbol: str) -> dict:
    """Dim 08: 研报查询"""
    return {
        "query": f"{symbol} 近180天券商研报：评级、目标价、盈利预测、核心观点"
    }

def _nl_query_financials(symbol: str) -> dict:
    """Dim 09/14: 财务数据/估值分析查询"""
    return {
        "query": f"{symbol} 近5年财务数据：营业收入、归母净利润、ROE、毛利率、净利率、经营现金流、EPS、PE分位、PB分位、PS、EV_EBITDA、PEG、股息率"
    }

def _nl_query_fund_flow(symbol: str) -> dict:
    """Dim 12: 资金流向查询"""
    return {
        "query": f"{symbol} 融资融券余额、龙虎榜、主力资金净流入、北向资金净买入"
    }

def _nl_query_risk(symbol: str) -> dict:
    """Dim 04 补充: 风险指标查询"""
    return {
        "query": f"{symbol} 风险指标：质押比例、商誉占比、违规记录、诉讼仲裁"
    }


# ============================================================
# 14维度 → MCP 子查询完整映射
# ============================================================

DIMENSION_MCP_MAPPING: dict[DimensionCode, List[McpSubQuery]] = {
    # Dim 01: 基本信息 — stock-mcp 双查询并行
    DimensionCode.BASIC_INFO: [
        McpSubQuery(
            name="stock_info",
            server_name=McpServerId.STOCK,
            tool_name="get_stock_info",
            build_args=_nl_query_stock_info,
        ),
        McpSubQuery(
            name="stock_summary",
            server_name=McpServerId.STOCK,
            tool_name="get_stock_summary",
            build_args=_nl_query_stock_summary,
        ),
    ],

    # Dim 02: K线数据 — stock-mcp 双查询并行
    DimensionCode.KLINE: [
        McpSubQuery(
            name="performance",
            server_name=McpServerId.STOCK,
            tool_name="get_stock_performance",
            build_args=_nl_query_performance,
        ),
        McpSubQuery(
            name="highfreq_quotes",
            server_name=McpServerId.STOCK,
            tool_name="stock_highfreq_quotes",
            build_args=_nl_query_highfreq,
        ),
    ],

    # Dim 03: 筹码分布 — stock-mcp (股东户数可作为筹码代理指标)
    DimensionCode.CHIP: [
        McpSubQuery(
            name="shareholders",
            server_name=McpServerId.STOCK,
            tool_name="get_stock_shareholders",
            build_args=_nl_query_shareholders,
        ),
    ],

    # Dim 04: 重大事项 — news-mcp + stock-mcp 双 Server 并行
    DimensionCode.MAJOR_EVENTS: [
        McpSubQuery(
            name="notice",
            server_name=McpServerId.NEWS,
            tool_name="search_notice",
            build_args=_nl_query_notice,
        ),
        McpSubQuery(
            name="events",
            server_name=McpServerId.STOCK,
            tool_name="get_stock_events",
            build_args=_nl_query_events,
        ),
        McpSubQuery(
            name="risk",
            server_name=McpServerId.STOCK,
            tool_name="get_risk_indicators",
            build_args=_nl_query_risk,
        ),
    ],

    # Dim 05: 热点新闻 — news-mcp 单查询
    DimensionCode.HOT_NEWS: [
        McpSubQuery(
            name="news",
            server_name=McpServerId.NEWS,
            tool_name="search_news",
            build_args=_nl_query_news,
        ),
    ],

    # Dim 06: 行业竞品 — stock-mcp + index-mcp 跨 Server 并行
    DimensionCode.INDUSTRY_PEERS: [
        McpSubQuery(
            name="search_stocks",
            server_name=McpServerId.STOCK,
            tool_name="search_stocks",
            build_args=_nl_query_peers,
        ),
        McpSubQuery(
            name="sector_data",
            server_name=McpServerId.INDEX,
            tool_name="sector_data",
            build_args=_nl_query_sector,
        ),
    ],

    # Dim 07: 关联指数 — index-mcp 单查询
    DimensionCode.RELATED_INDEX: [
        McpSubQuery(
            name="index_data",
            server_name=McpServerId.INDEX,
            tool_name="index_data",
            build_args=_nl_query_index,
        ),
    ],

    # Dim 08: 研报中心 — news-mcp 单查询
    DimensionCode.RESEARCH_REPORT: [
        McpSubQuery(
            name="research",
            server_name=McpServerId.NEWS,
            tool_name="search_news",
            build_args=_nl_query_research,
        ),
    ],

    # Dim 09: 财务数据 — stock-mcp 单查询
    DimensionCode.FINANCIAL: [
        McpSubQuery(
            name="financials",
            server_name=McpServerId.STOCK,
            tool_name="get_stock_financials",
            build_args=_nl_query_financials,
        ),
    ],

    # Dim 10: 热门板块 — index-mcp 单查询
    DimensionCode.HOT_SECTORS: [
        McpSubQuery(
            name="sector",
            server_name=McpServerId.INDEX,
            tool_name="sector_data",
            build_args=_nl_query_sector,
        ),
    ],

    # Dim 11: 技术指标 — stock-mcp 单查询（高频行情含技术指标）
    DimensionCode.TECH_INDICATORS: [
        McpSubQuery(
            name="highfreq",
            server_name=McpServerId.STOCK,
            tool_name="stock_highfreq_quotes",
            build_args=_nl_query_highfreq,
        ),
    ],

    # Dim 12: 资金流向 — stock-mcp 单查询
    DimensionCode.FUND_FLOW: [
        McpSubQuery(
            name="performance",
            server_name=McpServerId.STOCK,
            tool_name="get_stock_performance",
            build_args=_nl_query_fund_flow,
        ),
    ],

    # Dim 13: 机构持仓 — stock-mcp 单查询
    DimensionCode.INST_HOLDINGS: [
        McpSubQuery(
            name="shareholders",
            server_name=McpServerId.STOCK,
            tool_name="get_stock_shareholders",
            build_args=_nl_query_shareholders,
        ),
    ],

    # Dim 14: 估值分析 — stock-mcp 单查询
    DimensionCode.VALUATION: [
        McpSubQuery(
            name="financials",
            server_name=McpServerId.STOCK,
            tool_name="get_stock_financials",
            build_args=_nl_query_financials,
        ),
    ],
}


# ============================================================
# 维度采集模式判定（对应 1.3.3 节流水线路由）
# ============================================================

class CollectionMode:
    """采集模式"""
    MCP_PRIORITY = "mcp"           # iFinD MCP 优先
    MULTI_SOURCE = "multi_source"  # 多源降级链
    DIRECT_API   = "direct_api"    # 行情API直连

# 维度 → 采集模式映射
DIMENSION_TO_MODE: dict[DimensionCode, str] = {
    DimensionCode.BASIC_INFO:      CollectionMode.DIRECT_API,
    DimensionCode.KLINE:           CollectionMode.DIRECT_API,
    DimensionCode.CHIP:            CollectionMode.MULTI_SOURCE,
    DimensionCode.MAJOR_EVENTS:    CollectionMode.MCP_PRIORITY,
    DimensionCode.HOT_NEWS:        CollectionMode.MCP_PRIORITY,
    DimensionCode.INDUSTRY_PEERS:  CollectionMode.MULTI_SOURCE,
    DimensionCode.RELATED_INDEX:   CollectionMode.MULTI_SOURCE,
    DimensionCode.RESEARCH_REPORT: CollectionMode.MCP_PRIORITY,
    DimensionCode.FINANCIAL:       CollectionMode.MCP_PRIORITY,
    DimensionCode.HOT_SECTORS:     CollectionMode.MCP_PRIORITY,
    DimensionCode.TECH_INDICATORS: CollectionMode.MCP_PRIORITY,
    DimensionCode.FUND_FLOW:       CollectionMode.MCP_PRIORITY,
    DimensionCode.INST_HOLDINGS:   CollectionMode.MCP_PRIORITY,
    DimensionCode.VALUATION:       CollectionMode.MCP_PRIORITY,
    DimensionCode.DIVIDEND_SHARES: CollectionMode.MULTI_SOURCE,
    DimensionCode.CONSENSUS_EST:   CollectionMode.MULTI_SOURCE,
}

# MCP 优先维度（用于判断是否走 mcpCollector）
MCP_PRIORITY_DIMENSIONS = {
    dim for dim, mode in DIMENSION_TO_MODE.items()
    if mode == CollectionMode.MCP_PRIORITY
}

# 多源降级维度
MULTI_SOURCE_DIMENSIONS = {
    dim for dim, mode in DIMENSION_TO_MODE.items()
    if mode == CollectionMode.MULTI_SOURCE
}

# 需要 KIMI AI 增强的维度
KIMI_ENHANCE_DIMENSIONS = {
    DimensionCode.HOT_NEWS,        # 新闻摘要
    DimensionCode.RESEARCH_REPORT, # 研报解读
}


# ============================================================
# 降级链配置（对应 1.3.2 节）
# ============================================================

# 多源维度降级链：按优先级从高到低排列
FALLBACK_CHAINS: dict[DimensionCode, list[str]] = {
    DimensionCode.CHIP:            ["tushare", "eastmoney", "sina"],
    DimensionCode.INDUSTRY_PEERS:  ["tushare", "eastmoney", "tencent"],
    DimensionCode.RELATED_INDEX:   ["tushare", "tencent"],
    DimensionCode.DIVIDEND_SHARES: ["tushare", "eastmoney"],
    DimensionCode.CONSENSUS_EST:   ["eastmoney"],
}

# MCP 优先维度的降级链（MCP 失败时启用）
MCP_FALLBACK_CHAINS: dict[DimensionCode, list[str]] = {
    DimensionCode.MAJOR_EVENTS:    ["westock", "tushare", "eastmoney", "sina"],
    DimensionCode.HOT_NEWS:        ["westock", "tencent", "tushare", "eastmoney", "sina"],
    DimensionCode.RESEARCH_REPORT: ["westock", "tushare", "eastmoney"],
    DimensionCode.FINANCIAL:       ["fetcher_service"],
    DimensionCode.HOT_SECTORS:     [],  # 无降级
    DimensionCode.TECH_INDICATORS: ["akshare"],
    DimensionCode.FUND_FLOW:       ["akshare"],
    DimensionCode.INST_HOLDINGS:   [],  # 无降级
    DimensionCode.VALUATION:       [],  # 无降级
}