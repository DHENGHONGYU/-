"""
东财数据采集 ETL Bridge 服务
=============================
Flask/FastAPI 风格的 HTTP 桥接服务，将 Python 东财数据采集能力
暴露为 HTTP API，供 Vite dev server 通过 proxy 调用。

启动: python etl_bridge.py --port 8002
接口:
  GET  /api/python/health                         — 健康检查
  GET  /api/python/fetch?type=<type>&symbol=<s>   — 单维度采集
  POST /api/python/batch                          — 批量采集
  GET  /api/python/cross-validate?symbol=<s>      — 交叉验证
"""

import json
import sys
import os
import argparse
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs
from typing import Any

# 确保可以导入同目录模块
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from eastmoney_fetcher import (
    fetch_chip_distribution,
    fetch_stock_news,
    fetch_industry_competitors,
    fetch_research_reports,
    fetch_fund_flow,
    fetch_institutional_holdings,
    batch_fetch,
    FetchResult,
)

# ============================================================
# 维度 → 采集函数映射
# ============================================================

FETCHER_MAP = {
    "03": fetch_chip_distribution,
    "04": fetch_stock_news,
    "05": fetch_stock_news,
    "06": fetch_industry_competitors,
    "08": fetch_research_reports,
    "12": fetch_fund_flow,
    "13": fetch_institutional_holdings,
}


def _result_to_dict(r: FetchResult) -> dict[str, Any]:
    """将 FetchResult 转为可序列化字典"""
    from dataclasses import asdict
    return asdict(r)


# ============================================================
# 交叉验证器
# ============================================================

def cross_validate(symbol: str) -> dict[str, Any]:
    """对单只股票执行双源交叉验证"""
    results = {}
    discrepancies = []

    # 资金流向 (dim 12)
    fund_result = fetch_fund_flow(symbol)
    results["12_fundflow"] = _result_to_dict(fund_result)

    if fund_result.success and fund_result.data:
        main_inflow = fund_result.data.get("mainNetInflow", 0)
        if abs(main_inflow) > 1e8:  # 超过1亿
            discrepancies.append({
                "dimension": "12",
                "field": "mainNetInflow",
                "value": main_inflow,
                "threshold": 1e8,
                "warning": "主力净流入超过1亿，建议交叉验证",
            })

    # 机构持仓 (dim 13)
    holdings_result = fetch_institutional_holdings(symbol)
    results["13_holdings"] = _result_to_dict(holdings_result)

    if holdings_result.success and holdings_result.data:
        inst_ratio = holdings_result.data.get("institutionalRatio", 0)
        if inst_ratio > 80:
            discrepancies.append({
                "dimension": "13",
                "field": "institutionalRatio",
                "value": inst_ratio,
                "threshold": 80,
                "warning": "机构持仓占比超过80%，高度控盘",
            })

    return {
        "symbol": symbol,
        "results": results,
        "discrepancies": discrepancies,
        "passed": len(discrepancies) == 0,
        "source": "eastmoney",
    }


# ============================================================
# HTTP 请求处理器
# ============================================================

class ETLBridgeHandler(BaseHTTPRequestHandler):
    """ETL Bridge HTTP 请求处理器"""

    def _send_json(self, data: dict, status: int = 200):
        """发送 JSON 响应"""
        body = json.dumps(data, ensure_ascii=False, indent=2).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _send_error(self, message: str, status: int = 400):
        self._send_json({"error": message, "status": status}, status)

    def do_OPTIONS(self):
        self._send_json({}, 204)

    def do_GET(self):
        parsed = urlparse(self.path)
        path = parsed.path.rstrip("/")
        params = parse_qs(parsed.query)

        # 健康检查
        if path == "/api/python/health":
            self._send_json({
                "status": "ok",
                "service": "FinSight V9 ETL Bridge",
                "endpoints": [
                    "GET  /api/python/health",
                    "GET  /api/python/fetch?type=<dim>&symbol=<code>",
                    "POST /api/python/batch",
                    "GET  /api/python/cross-validate?symbol=<code>",
                ],
            })
            return

        # 单维度采集
        if path == "/api/python/fetch":
            dim = params.get("type", [None])[0]
            symbol = params.get("symbol", [None])[0]
            if not dim or not symbol:
                self._send_error("Missing required params: type, symbol")
                return

            fetcher = FETCHER_MAP.get(dim)
            if not fetcher:
                self._send_error(f"Unknown dimension type: {dim}. Available: {list(FETCHER_MAP.keys())}")
                return

            result = fetcher(symbol)
            self._send_json({
                "success": result.success,
                "data": _result_to_dict(result),
            })
            return

        # 交叉验证
        if path == "/api/python/cross-validate":
            symbol = params.get("symbol", [None])[0]
            if not symbol:
                self._send_error("Missing required param: symbol")
                return

            result = cross_validate(symbol)
            self._send_json(result)
            return

        self._send_error(f"Unknown endpoint: {path}", 404)

    def do_POST(self):
        parsed = urlparse(self.path)
        path = parsed.path.rstrip("/")

        # 批量采集
        if path == "/api/python/batch":
            content_length = int(self.headers.get("Content-Length", 0))
            if content_length == 0:
                self._send_error("Empty request body")
                return

            body = json.loads(self.rfile.read(content_length).decode("utf-8"))
            symbols = body.get("symbols", [])
            if not symbols:
                self._send_error("Missing required field: symbols (array)")
                return

            all_results = batch_fetch(symbols)
            output = {
                s: [_result_to_dict(r) for r in rs]
                for s, rs in all_results.items()
            }
            self._send_json({"success": True, "data": output})
            return

        self._send_error(f"Unknown endpoint: {path}", 404)

    def log_message(self, format, *args):
        """自定义日志格式"""
        print(f"[ETL Bridge] {args[0]}")


# ============================================================
# 启动入口
# ============================================================

def main():
    parser = argparse.ArgumentParser(description="FinSight V9 ETL Bridge")
    parser.add_argument("--port", type=int, default=8002, help="服务端口 (默认: 8002，避免与AkShare采集器8000冲突)")
    parser.add_argument("--host", type=str, default="127.0.0.1", help="绑定地址 (默认: 127.0.0.1)")
    args = parser.parse_args()

    server = HTTPServer((args.host, args.port), ETLBridgeHandler)
    print(f"🚀 FinSight V9 ETL Bridge 启动")
    print(f"   地址: http://{args.host}:{args.port}")
    print(f"   健康检查: http://{args.host}:{args.port}/api/python/health")
    print(f"   按 Ctrl+C 停止服务")

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n👋 服务已停止")
        server.server_close()


if __name__ == "__main__":
    main()