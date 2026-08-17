"""
MCP 协议客户端
==============
模拟 TypeScript 侧 `run_mcp()` 工具调用，封装 iFinD MCP Server 的通信协议。

实际生产环境中，这里应替换为真正的 MCP JSON-RPC 客户端实现。
本示例提供 HTTP 和本地模拟两种模式，便于开发测试。
"""

import json
import time
import asyncio
from dataclasses import dataclass, field
from typing import Any, Optional
from enum import Enum


# ============================================================
# 数据类型
# ============================================================

class McpToolErrorCode(Enum):
    """MCP Tool 错误码"""
    OK              = 0
    SERVER_ERROR    = 500
    TIMEOUT         = 408
    UNAUTHORIZED    = 401
    RATE_LIMITED    = 429
    INVALID_PARAMS  = 400
    NOT_FOUND       = 404
    UNKNOWN         = 999


@dataclass
class McpToolResult:
    """单个 MCP Tool 调用结果"""
    server_name: str
    tool_name: str
    success: bool
    data: Any = None
    error: Optional[str] = None
    error_code: McpToolErrorCode = McpToolErrorCode.OK
    latency_ms: float = 0.0
    raw_response: Optional[str] = None


@dataclass
class McpCallRequest:
    """MCP 调用请求"""
    server_name: str
    tool_name: str
    args: dict
    timeout_seconds: float = 30.0
    retry_count: int = 2


# ============================================================
# MCP 客户端
# ============================================================

class McpClient:
    """
    iFinD MCP 协议客户端

    支持两种模式：
    1. HTTP 模式：通过 JSON-RPC 2.0 over HTTP 调用 MCP Server
       支持连接池复用、自动重试（指数退避）、超时控制
    2. 模拟模式（Mock）：返回合理的模拟数据，用于开发测试

    新增功能（v1.5.0）:
    - 连接池复用（aiohttp.ClientSession）
    - 指数退避重试（500ms → 1000ms → 2000ms）
    - 连接健康检查（ping）
    - 调用统计（成功率、平均延迟）
    """

    def __init__(self, mode: str = "mock", base_url: str = ""):
        self._mode = mode
        self._base_url = base_url
        self._stats = {
            "total_calls": 0,
            "success_calls": 0,
            "failed_calls": 0,
            "total_latency_ms": 0.0,
        }
        # === 新增：连接池 ===
        self._session: Optional[Any] = None  # aiohttp.ClientSession
        self._retry_base_ms = 500
        self._max_retries = 2

    async def _get_session(self):
        """获取或创建 aiohttp 会话（连接池复用）"""
        if self._session is None or self._session.closed:
            import aiohttp
            self._session = aiohttp.ClientSession(
                timeout=aiohttp.ClientTimeout(total=30),
                headers={"Content-Type": "application/json"},
            )
        return self._session

    async def close(self):
        """关闭连接池"""
        if self._session and not self._session.closed:
            await self._session.close()
            self._session = None

    async def ping(self) -> bool:
        """
        连接健康检查

        尝试访问 MCP Server 的健康端点
        """
        if self._mode != "http" or not self._base_url:
            return True  # mock 模式始终可用

        try:
            import aiohttp
            async with aiohttp.ClientSession() as session:
                async with session.get(
                    f"{self._base_url}/health",
                    timeout=aiohttp.ClientTimeout(total=5),
                ) as resp:
                    return resp.status == 200
        except Exception:
            return False

    @property
    def stats(self) -> dict:
        return dict(self._stats)

    async def call_tool(self, request: McpCallRequest) -> McpToolResult:
        """
        调用单个 MCP Tool

        支持自动重试（指数退避）：
        - 第 1 次重试: 500ms 后
        - 第 2 次重试: 1000ms 后
        """
        self._stats["total_calls"] += 1
        start = time.perf_counter()
        last_error = None

        for attempt in range(request.retry_count + 1):
            try:
                if self._mode == "http":
                    result = await self._call_http(request)
                else:
                    result = await self._call_mock(request)

                latency = (time.perf_counter() - start) * 1000
                result.latency_ms = latency

                if result.success:
                    self._stats["success_calls"] += 1
                else:
                    self._stats["failed_calls"] += 1

                self._stats["total_latency_ms"] += latency
                return result

            except asyncio.TimeoutError:
                last_error = ("timeout", McpToolErrorCode.TIMEOUT)
                if attempt < request.retry_count:
                    await asyncio.sleep(self._retry_base_ms * (2 ** attempt) / 1000)
            except Exception as e:
                last_error = (str(e), McpToolErrorCode.UNKNOWN)
                if attempt < request.retry_count:
                    await asyncio.sleep(self._retry_base_ms * (2 ** attempt) / 1000)

        # 所有重试均失败
        self._stats["failed_calls"] += 1
        latency = (time.perf_counter() - start) * 1000
        return McpToolResult(
            server_name=request.server_name,
            tool_name=request.tool_name,
            success=False,
            error=f"重试 {request.retry_count} 次后仍失败: {last_error[0]}" if last_error else "未知错误",
            error_code=last_error[1] if last_error else McpToolErrorCode.UNKNOWN,
            latency_ms=latency,
        )

    async def _call_http(self, request: McpCallRequest) -> McpToolResult:
        """
        HTTP 模式：通过 JSON-RPC 2.0 协议调用 MCP Server

        支持两种部署方式：
        1. 直连模式：MCP Server 直接暴露 HTTP 端点
        2. 网关模式：通过 MCP Gateway 统一路由

        协议: JSON-RPC 2.0 over HTTP POST
        请求格式: {"jsonrpc":"2.0","method":"tools/call","params":{"name":"...","arguments":{...}},"id":1}
        响应格式: {"jsonrpc":"2.0","result":{"content":[{"type":"text","text":"..."}]},"id":1}

        使用连接池复用减少 TCP 握手开销。
        """
        import aiohttp

        # 构建 MCP Gateway URL
        if "/rpc" in self._base_url:
            url = self._base_url
            extra_headers = {"X-MCP-Server": request.server_name}
        else:
            url = f"{self._base_url}/mcp/{request.server_name}/{request.tool_name}"
            extra_headers = {}

        payload = {
            "jsonrpc": "2.0",
            "method": "tools/call",
            "params": {
                "name": request.tool_name,
                "arguments": request.args,
            },
            "id": 1,
        }

        headers = {
            "Content-Type": "application/json",
            **extra_headers,
        }

        try:
            session = await self._get_session()
            async with session.post(
                url,
                json=payload,
                headers=headers,
                timeout=aiohttp.ClientTimeout(total=request.timeout_seconds),
            ) as resp:
                data = await resp.json()

                if resp.status == 200 and "result" in data:
                    result = data["result"]
                    content = result.get("content", [])
                    text = content[0].get("text", "") if content else str(result)
                    return McpToolResult(
                        server_name=request.server_name,
                        tool_name=request.tool_name,
                        success=True,
                        data=text if isinstance(text, str) else result,
                        raw_response=json.dumps(data, ensure_ascii=False),
                    )
                else:
                    error_info = data.get("error", {})
                    return McpToolResult(
                        server_name=request.server_name,
                        tool_name=request.tool_name,
                        success=False,
                        error=error_info.get("message", f"HTTP {resp.status}"),
                        error_code=McpToolErrorCode.SERVER_ERROR,
                        raw_response=json.dumps(data, ensure_ascii=False),
                    )
        except asyncio.TimeoutError:
            raise
        except aiohttp.ClientError as e:
            return McpToolResult(
                server_name=request.server_name,
                tool_name=request.tool_name,
                success=False,
                error=f"连接失败: {e}",
                error_code=McpToolErrorCode.SERVER_ERROR,
            )

    async def _call_mock(self, request: McpCallRequest) -> McpToolResult:
        """
        模拟模式：返回合理的模拟数据

        模拟延时 100-300ms 以模拟真实网络延迟。
        """
        # 模拟网络延迟
        await asyncio.sleep(0.1 + (hash(request.tool_name) % 200) / 1000)

        mock_data = self._generate_mock_data(request)
        return McpToolResult(
            server_name=request.server_name,
            tool_name=request.tool_name,
            success=True,
            data=mock_data,
            raw_response=json.dumps(mock_data, ensure_ascii=False),
        )

    def _generate_mock_data(self, request: McpCallRequest) -> dict:
        """根据 tool_name 生成对应的模拟数据"""
        tool = request.tool_name

        if tool == "get_stock_info":
            return {
                "symbol": "000001.SZ",
                "name": "平安银行",
                "listed_date": "1991-04-03",
                "shenwan_industry": "银行",
                "main_business": "商业银行业务",
                "total_market_cap": 2850_0000_0000,
                "pe": 5.2,
                "pb": 0.55,
                "roe": 10.8,
            }
        elif tool == "get_stock_summary":
            return {
                "symbol": "000001.SZ",
                "pe_percentile": 15.3,
                "pb_percentile": 8.7,
                "dividend_yield": 5.2,
                "total_market_cap": 2850_0000_0000,
            }
        elif tool == "get_stock_performance":
            return {
                "symbol": "000001.SZ",
                "latest_price": 11.25,
                "change_pct": 1.35,
                "volume": 85_000_000,
                "amount": 9.56_0000_0000,
                "turnover_rate": 0.42,
                "kline_daily": [{"date": f"2026-08-{d:02d}", "open": 11.0, "high": 11.3, "low": 10.9, "close": 11.25, "volume": 85_000_000} for d in range(1, 18)],
            }
        elif tool == "stock_highfreq_quotes":
            return {
                "symbol": "000001.SZ",
                "price": 11.25,
                "open": 11.10,
                "high": 11.32,
                "low": 11.05,
                "change_pct": 1.35,
                "volume": 85_000_000,
                "amount": 9.56_0000_0000,
                "turnover_rate": 0.42,
                "ma5": 11.08, "ma10": 10.95, "ma20": 10.72, "ma60": 10.35,
                "kdj_k": 65.3, "kdj_d": 58.7, "kdj_j": 78.5,
                "macd_dif": 0.18, "macd_dea": 0.12, "macd_bar": 0.06,
                "rsi_6": 62.5, "rsi_12": 58.3, "rsi_24": 53.8,
            }
        elif tool == "get_stock_financials":
            return {
                "symbol": "000001.SZ",
                "years": [
                    {"year": 2025, "revenue": 1650_0000_0000, "net_profit": 450_0000_0000, "roe": 10.8, "gross_margin": 42.5, "net_margin": 27.3, "operating_cf": 520_0000_0000, "eps": 2.32},
                    {"year": 2024, "revenue": 1580_0000_0000, "net_profit": 420_0000_0000, "roe": 10.2, "gross_margin": 41.8, "net_margin": 26.6, "operating_cf": 480_0000_0000, "eps": 2.16},
                    {"year": 2023, "revenue": 1500_0000_0000, "net_profit": 390_0000_0000, "roe": 9.8, "gross_margin": 40.9, "net_margin": 26.0, "operating_cf": 450_0000_0000, "eps": 2.01},
                ],
            }
        elif tool == "get_stock_shareholders":
            return {
                "symbol": "000001.SZ",
                "total_shareholders": 285000,
                "avg_holdings_per_account": 68000,
                "top10_holding_pct": 55.8,
                "institutional_holding_pct": 48.3,
                "fund_holding_pct": 12.5,
                "northbound_holding_pct": 4.8,
                "qfii_holding_pct": 2.3,
            }
        elif tool == "get_stock_events":
            return {
                "symbol": "000001.SZ",
                "events": [
                    {"date": "2026-08-15", "type": "业绩预告", "content": "2026H1归母净利润同比增长约15%"},
                    {"date": "2026-06-20", "type": "分红", "content": "10派3.5元(含税)"},
                    {"date": "2026-04-28", "type": "限售解禁", "content": "解禁2.5亿股"},
                ],
            }
        elif tool == "search_notice":
            return {
                "notices": [
                    {"date": "2026-08-15", "title": "2026年半年度报告", "type": "定期报告"},
                    {"date": "2026-07-10", "title": "关于董事辞职的公告", "type": "人事变动"},
                    {"date": "2026-06-20", "title": "2025年度权益分派实施公告", "type": "分红送转"},
                ],
            }
        elif tool == "search_news":
            return {
                "news": [
                    {"date": "2026-08-16", "title": "平安银行数字化转型成效显著", "source": "证券时报"},
                    {"date": "2026-08-14", "title": "机构看好银行板块估值修复", "source": "上海证券报"},
                    {"date": "2026-08-12", "title": "平安银行零售转型加速", "source": "21世纪经济报道"},
                ],
            }
        elif tool == "search_stocks":
            return {
                "peers": [
                    {"symbol": "000001.SZ", "name": "平安银行", "market_cap": 2850_0000_0000, "pe": 5.2},
                    {"symbol": "600036.SH", "name": "招商银行", "market_cap": 9500_0000_0000, "pe": 6.8},
                    {"symbol": "601166.SH", "name": "兴业银行", "market_cap": 4200_0000_0000, "pe": 4.5},
                    {"symbol": "000002.SZ", "name": "万科A", "market_cap": 1200_0000_0000, "pe": 12.3},
                ],
            }
        elif tool == "sector_data":
            return {
                "sector": {
                    "code": "BK0475",
                    "name": "银行",
                    "change_7d": 2.35,
                    "rank_7d": 8,
                    "total_sectors": 134,
                    "avg_pe": 5.8,
                    "avg_pb": 0.62,
                },
            }
        elif tool == "index_data":
            return {
                "indices": [
                    {"code": "000300.SH", "name": "沪深300", "change_30d": 3.25},
                    {"code": "000905.SH", "name": "中证500", "change_30d": 5.12},
                    {"code": "BK0475", "name": "银行指数", "change_30d": 4.85},
                ],
            }
        elif tool == "get_risk_indicators":
            return {
                "pledge_ratio": 2.3,
                "goodwill_ratio": 0.5,
                "violation_records": 0,
                "litigation_count": 1,
            }
        elif tool == "get_esg_data":
            return {
                "esg_score": 72.5,
                "environmental": 68.0,
                "social": 75.0,
                "governance": 74.5,
                "rating": "BBB",
            }
        else:
            return {"message": f"Mock data for {tool}", "symbol": "000001.SZ"}

    @property
    def avg_latency_ms(self) -> float:
        """平均延迟"""
        if self._stats["total_calls"] == 0:
            return 0.0
        return self._stats["total_latency_ms"] / self._stats["total_calls"]


# ============================================================
# 便捷函数：模拟 run_mcp 调用
# ============================================================

async def run_mcp(server_name: str, tool_name: str, args: dict,
                  timeout: float = 30.0) -> McpToolResult:
    """
    模拟 TypeScript 侧 `run_mcp()` 工具调用

    用法:
        result = await run_mcp(
            server_name="mcp_plugin_iFinD_hexin-ifind-ds-stock-mcp",
            tool_name="get_stock_info",
            args={"query": "000001.SZ 平安银行 基本信息"}
        )
    """
    client = McpClient(mode="mock")
    request = McpCallRequest(
        server_name=server_name,
        tool_name=tool_name,
        args=args,
        timeout_seconds=timeout,
    )
    return await client.call_tool(request)