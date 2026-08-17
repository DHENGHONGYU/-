"""
东财公开端点数据采集器 (East Money Public API Fetcher)
========================================================
覆盖维度: 03(筹码)、04(重大事项)、05(热点新闻)、06(行业竞品)、
         08(研报)、12(资金流向)、13(机构持仓)

数据源: 东方财富公开 JSON 端点 (push2.eastmoney.com / data.eastmoney.com)
方案 D — 多源聚合去重 + 直连行情
"""

import json
import time
import random
from typing import Any, Optional
from dataclasses import dataclass, field, asdict

import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

# ============================================================
# 配置
# ============================================================

USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:128.0) Gecko/20100101 Firefox/128.0",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15",
]

REQUEST_TIMEOUT = 15
MAX_RETRIES = 3
BACKOFF_FACTOR = 1.5
RATE_LIMIT_DELAY = (0.3, 1.2)  # 随机延迟范围(秒)


def _create_session() -> requests.Session:
    """创建带重试策略的 session"""
    session = requests.Session()
    retry = Retry(
        total=MAX_RETRIES,
        backoff_factor=BACKOFF_FACTOR,
        status_forcelist=[429, 500, 502, 503, 504],
    )
    adapter = HTTPAdapter(max_retries=retry)
    session.mount("http://", adapter)
    session.mount("https://", adapter)
    session.headers.update({
        "User-Agent": random.choice(USER_AGENTS),
        "Accept": "application/json, text/plain, */*",
        "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
        "Referer": "https://data.eastmoney.com/",
    })
    return session


def _rate_limit():
    """随机延迟，避免触发反爬"""
    time.sleep(random.uniform(*RATE_LIMIT_DELAY))


# ============================================================
# 数据类型
# ============================================================

@dataclass
class FetchResult:
    success: bool
    dimension: str
    symbol: str
    source: str
    data: Optional[dict] = None
    error: Optional[str] = None
    timestamp: float = field(default_factory=time.time)


# ============================================================
# 维度 03 — 筹码分布 (股东户数/集中度)
# ============================================================

def fetch_chip_distribution(symbol: str, session: Optional[requests.Session] = None) -> FetchResult:
    """
    采集筹码分布数据。
    端点: push2.eastmoney.com/api/qt/stock/fflow (股东户数)
    """
    sess = session or _create_session()
    market = "1" if symbol.startswith("6") else "0"
    secid = f"{market}.{symbol}"

    try:
        _rate_limit()
        url = "https://push2.eastmoney.com/api/qt/stock/fflow/get"
        params = {
            "secid": secid,
            "fields1": "f1,f2,f3",
            "fields2": "f51,f52,f53,f54,f55,f56,f57",
            "lmt": "0",
            "klt": "101",
        }
        resp = sess.get(url, params=params, timeout=REQUEST_TIMEOUT)
        resp.raise_for_status()
        body = resp.json()

        if body.get("data") and body["data"].get("klines"):
            lines = body["data"]["klines"]
            return FetchResult(
                success=True,
                dimension="03",
                symbol=symbol,
                source="eastmoney",
                data={
                    "holderCount": _safe_parse(lines[-1], 1),
                    "holderChange": _safe_parse(lines[-1], 2),
                    "avgHolding": _safe_parse(lines[-1], 3),
                    "rawLines": len(lines),
                },
            )
        return FetchResult(success=False, dimension="03", symbol=symbol, source="eastmoney", error="empty_data")

    except Exception as e:
        return FetchResult(success=False, dimension="03", symbol=symbol, source="eastmoney", error=str(e))


# ============================================================
# 维度 04/05 — 重大事项 / 热点新闻
# ============================================================

def fetch_stock_news(symbol: str, limit: int = 20, session: Optional[requests.Session] = None) -> FetchResult:
    """
    采集股票相关新闻/公告。
    端点: push2.eastmoney.com/api/qt/stock/news (个股新闻)
    """
    sess = session or _create_session()
    market = "1" if symbol.startswith("6") else "0"
    secid = f"{market}.{symbol}"

    try:
        _rate_limit()
        url = "https://push2.eastmoney.com/api/qt/stock/news/get"
        params = {
            "secid": secid,
            "lmt": limit,
            "ut": "bd1d9ddb04089700cf9c27f6f7426281",
            "fields": "code,name,title,type,url,datetime,source,summary",
        }
        resp = sess.get(url, params=params, timeout=REQUEST_TIMEOUT)
        resp.raise_for_status()
        body = resp.json()

        if body.get("data") and body["data"].get("list"):
            items = body["data"]["list"]
            return FetchResult(
                success=True,
                dimension="04/05",
                symbol=symbol,
                source="eastmoney",
                data={
                    "news": [
                        {
                            "title": item.get("title", ""),
                            "type": item.get("type", ""),
                            "source": item.get("source", ""),
                            "url": item.get("url", ""),
                            "datetime": item.get("datetime", ""),
                            "summary": item.get("summary", ""),
                        }
                        for item in items
                    ],
                    "total": body["data"].get("total", len(items)),
                },
            )
        return FetchResult(success=False, dimension="04/05", symbol=symbol, source="eastmoney", error="empty_data")

    except Exception as e:
        return FetchResult(success=False, dimension="04/05", symbol=symbol, source="eastmoney", error=str(e))


# ============================================================
# 维度 06 — 行业竞品
# ============================================================

def fetch_industry_competitors(symbol: str, session: Optional[requests.Session] = None) -> FetchResult:
    """
    采集行业竞品数据。
    端点: push2.eastmoney.com/api/qt/clist/get (行业成分股)
    """
    sess = session or _create_session()
    market = "1" if symbol.startswith("6") else "0"
    secid = f"{market}.{symbol}"

    try:
        _rate_limit()
        # Step 1: 获取股票所属行业
        profile_url = "https://push2.eastmoney.com/api/qt/stock/get"
        profile_params = {
            "secid": secid,
            "fields": "f57,f58,f100,f127,f128,f129,f135,f136",
        }
        resp = sess.get(profile_url, params=profile_params, timeout=REQUEST_TIMEOUT)
        resp.raise_for_status()
        profile = resp.json()

        industry = profile.get("data", {}).get("f100", "未知行业")

        # Step 2: 获取行业成分股排名
        _rate_limit()
        clist_url = "https://push2.eastmoney.com/api/qt/clist/get"
        clist_params = {
            "pn": "1",
            "pz": "20",
            "po": "1",
            "np": "1",
            "ut": "bd1d9ddb04089700cf9c27f6f7426281",
            "fltt": "2",
            "invt": "2",
            "fid": "f20",
            "fs": f"b:{industry}+f:!50",
            "fields": "f12,f14,f20,f21,f40,f115",
        }
        resp = sess.get(clist_url, params=clist_params, timeout=REQUEST_TIMEOUT)
        resp.raise_for_status()
        body = resp.json()

        if body.get("data") and body["data"].get("diff"):
            items = body["data"]["diff"]
            return FetchResult(
                success=True,
                dimension="06",
                symbol=symbol,
                source="eastmoney",
                data={
                    "industry": industry,
                    "competitors": [
                        {
                            "code": item.get("f12", ""),
                            "name": item.get("f14", ""),
                            "marketCap": item.get("f20", 0) / 1e8 if item.get("f20") else 0,
                            "pe": item.get("f115", 0),
                            "rank": i + 1,
                        }
                        for i, item in enumerate(items)
                    ],
                    "total": body["data"].get("total", 0),
                },
            )
        return FetchResult(success=False, dimension="06", symbol=symbol, source="eastmoney", error="empty_data")

    except Exception as e:
        return FetchResult(success=False, dimension="06", symbol=symbol, source="eastmoney", error=str(e))


# ============================================================
# 维度 08 — 研报中心
# ============================================================

def fetch_research_reports(symbol: str, limit: int = 20, session: Optional[requests.Session] = None) -> FetchResult:
    """
    采集机构研报数据。
    端点: data.eastmoney.com/report/stock.js (个股研报)
    """
    sess = session or _create_session()
    market = "1" if symbol.startswith("6") else "0"
    secid = f"{market}.{symbol}"

    try:
        _rate_limit()
        url = "https://datacenter.eastmoney.com/securities/api/data/v1/get"
        params = {
            "reportName": "RPT_ORG_RESEARCHREPORT",
            "columns": "ALL",
            "filter": f'(SECURITY_CODE="{symbol}")',
            "pageNumber": "1",
            "pageSize": str(limit),
            "sortTypes": "-1",
            "sortColumns": "NOTICE_DATE",
            "source": "WEB",
            "client": "WEB",
        }
        resp = sess.get(url, params=params, timeout=REQUEST_TIMEOUT)
        resp.raise_for_status()
        body = resp.json()

        if body.get("success") and body.get("result") and body["result"].get("data"):
            items = body["result"]["data"]
            return FetchResult(
                success=True,
                dimension="08",
                symbol=symbol,
                source="eastmoney",
                data={
                    "reports": [
                        {
                            "title": item.get("REPORT_TITLE", ""),
                            "orgName": item.get("ORG_NAME", ""),
                            "rating": item.get("RATING", ""),
                            "targetPrice": item.get("TARGET_PRICE", None),
                            "analyst": item.get("ANALYST_NAME", ""),
                            "noticeDate": item.get("NOTICE_DATE", ""),
                            "summary": item.get("REPORT_SUMMARY", ""),
                        }
                        for item in items
                    ],
                    "total": body["result"].get("count", 0),
                },
            )
        return FetchResult(success=False, dimension="08", symbol=symbol, source="eastmoney", error="empty_data")

    except Exception as e:
        return FetchResult(success=False, dimension="08", symbol=symbol, source="eastmoney", error=str(e))


# ============================================================
# 维度 12 — 资金流向
# ============================================================

def fetch_fund_flow(symbol: str, session: Optional[requests.Session] = None) -> FetchResult:
    """
    采集资金流向数据。
    端点: push2.eastmoney.com/api/qt/stock/fflow/daykline/get
    """
    sess = session or _create_session()
    market = "1" if symbol.startswith("6") else "0"
    secid = f"{market}.{symbol}"

    try:
        _rate_limit()
        url = "https://push2.eastmoney.com/api/qt/stock/fflow/daykline/get"
        params = {
            "secid": secid,
            "fields1": "f1,f2,f3,f7",
            "fields2": "f51,f52,f53,f54,f55,f56,f57,f58,f59,f60,f61,f62,f63,f64,f65",
            "lmt": "1",
            "klt": "101",
        }
        resp = sess.get(url, params=params, timeout=REQUEST_TIMEOUT)
        resp.raise_for_status()
        body = resp.json()

        if body.get("data") and body["data"].get("klines"):
            latest = body["data"]["klines"][-1].split(",")
            return FetchResult(
                success=True,
                dimension="12",
                symbol=symbol,
                source="eastmoney",
                data={
                    "date": latest[0] if len(latest) > 0 else "",
                    "mainNetInflow": _safe_parse(latest, 1),       # 主力净流入
                    "superLargeNetInflow": _safe_parse(latest, 3), # 超大单净流入
                    "largeNetInflow": _safe_parse(latest, 5),      # 大单净流入
                    "mediumNetInflow": _safe_parse(latest, 7),     # 中单净流入
                    "smallNetInflow": _safe_parse(latest, 9),      # 小单净流入
                    "mainInflowRatio": _safe_parse(latest, 11),    # 主力净流入占比
                },
            )
        return FetchResult(success=False, dimension="12", symbol=symbol, source="eastmoney", error="empty_data")

    except Exception as e:
        return FetchResult(success=False, dimension="12", symbol=symbol, source="eastmoney", error=str(e))


# ============================================================
# 维度 13 — 机构持仓
# ============================================================

def fetch_institutional_holdings(symbol: str, session: Optional[requests.Session] = None) -> FetchResult:
    """
    采集机构持仓数据。
    端点: push2.eastmoney.com/api/qt/stock/holder/get (十大股东)
    """
    sess = session or _create_session()
    market = "1" if symbol.startswith("6") else "0"
    secid = f"{market}.{symbol}"

    try:
        _rate_limit()
        # Step 1: 十大股东
        url = "https://datacenter.eastmoney.com/securities/api/data/v1/get"
        params = {
            "reportName": "RPT_F10_EH_HOLDERSNUM",
            "columns": "ALL",
            "filter": f'(SECURITY_CODE="{symbol}")',
            "pageNumber": "1",
            "pageSize": "10",
            "sortTypes": "-1",
            "sortColumns": "END_DATE",
            "source": "WEB",
            "client": "WEB",
        }
        resp = sess.get(url, params=params, timeout=REQUEST_TIMEOUT)
        resp.raise_for_status()
        body = resp.json()

        if body.get("success") and body.get("result") and body["result"].get("data"):
            latest = body["result"]["data"][0]
            return FetchResult(
                success=True,
                dimension="13",
                symbol=symbol,
                source="eastmoney",
                data={
                    "endDate": latest.get("END_DATE", ""),
                    "totalShareholders": latest.get("HOLDERS_NUM", 0),
                    "avgHoldingShares": latest.get("AVG_HOLDING_NUM", 0),
                    "top10Ratio": latest.get("TOP10_HOLDERS_RATIO", 0),
                    "institutionalRatio": latest.get("INST_HOLDERS_RATIO", 0),
                    "mutualFundRatio": latest.get("MUTUAL_FUND_HOLDERS_RATIO", 0),
                },
            )

        return FetchResult(success=False, dimension="13", symbol=symbol, source="eastmoney", error="empty_data")

    except Exception as e:
        return FetchResult(success=False, dimension="13", symbol=symbol, source="eastmoney", error=str(e))


# ============================================================
# 批量采集
# ============================================================

def fetch_all_dimensions(symbol: str) -> list[FetchResult]:
    """对单只股票执行全维度采集"""
    session = _create_session()
    results = []

    fetchers = [
        ("03", fetch_chip_distribution),
        ("04/05", fetch_stock_news),
        ("06", fetch_industry_competitors),
        ("08", fetch_research_reports),
        ("12", fetch_fund_flow),
        ("13", fetch_institutional_holdings),
    ]

    for dim, fetcher in fetchers:
        try:
            result = fetcher(symbol, session=session)
            results.append(result)
        except Exception as e:
            results.append(FetchResult(success=False, dimension=dim, symbol=symbol, source="eastmoney", error=str(e)))

    return results


def batch_fetch(symbols: list[str]) -> dict[str, list[FetchResult]]:
    """批量采集多只股票"""
    return {symbol: fetch_all_dimensions(symbol) for symbol in symbols}


# ============================================================
# 工具函数
# ============================================================

def _safe_parse(arr: list[str], idx: int, default: float = 0.0) -> float:
    """安全解析数组元素为浮点数"""
    try:
        if idx < len(arr) and arr[idx]:
            return float(arr[idx])
        return default
    except (ValueError, TypeError):
        return default


def to_json(results: list[FetchResult]) -> str:
    """序列化采集结果为 JSON"""
    return json.dumps([asdict(r) for r in results], ensure_ascii=False, indent=2)


# ============================================================
# CLI 入口
# ============================================================

if __name__ == "__main__":
    import sys

    if len(sys.argv) < 2:
        print("用法: python eastmoney_fetcher.py <symbol> [symbol2 ...]")
        print("示例: python eastmoney_fetcher.py 600519 000858")
        sys.exit(1)

    symbols = sys.argv[1:]
    all_results = batch_fetch(symbols)

    for symbol, results in all_results.items():
        print(f"\n=== {symbol} ===")
        for r in results:
            status = "✅" if r.success else "❌"
            print(f"  {status} [{r.dimension}] {r.source}: {r.error or 'OK'}")

    # 输出 JSON
    output = {s: [asdict(r) for r in rs] for s, rs in all_results.items()}
    print("\n--- JSON ---")
    print(json.dumps(output, ensure_ascii=False, indent=2))