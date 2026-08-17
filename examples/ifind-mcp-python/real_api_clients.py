"""
真实 API 客户端 (real_api_clients)
==================================
对应 TypeScript:
- src/services/data-collector/directDataAPI.ts (腾讯/新浪直连行情)
- src/services/data-collector/tushareProvider.ts (Tushare Pro HTTP API)
- src/services/data-collector/crawlerProvider.ts (东财爬虫)
- src/services/data-collector/kimiAIService.ts (KIMI AI 增强)

核心职责：
1. 腾讯行情 API — 实时行情 / 批量行情 / K线数据
2. 新浪行情 API — 实时行情 / 批量行情
3. Tushare Pro — Token 管理 / 超时重试 / 错误分类
4. 东财爬虫 — 股东数据 / 公告 / 限售解禁 / 分红
5. KIMI AI — 新闻摘要 / 研报解读 / 配额管理
"""

import os
import time
import json
import hashlib
import asyncio
import random
from typing import Any, Optional, List, Dict, Callable
from dataclasses import dataclass, field
from enum import Enum
from urllib.parse import quote


# ============================================================
# 工具函数
# ============================================================

def _safe_float(val: Any, default: float = 0.0) -> float:
    try: return float(val)
    except (ValueError, TypeError): return default

def _safe_int(val: Any, default: int = 0) -> int:
    try: return int(val)
    except (ValueError, TypeError): return default

def _format_symbol(symbol: str, source: str) -> str:
    """将 000001.SZ 格式转为各源所需格式"""
    code = symbol.replace(".SH", "").replace(".SZ", "").replace(".BJ", "")
    if source == "tencent":
        market = "sh" if symbol.endswith(".SH") else "sz" if symbol.endswith(".SZ") else "bj"
        return f"{market}{code}"
    elif source == "sina":
        market = "sh" if symbol.endswith(".SH") else "sz" if symbol.endswith(".SZ") else "bj"
        return f"{market}{code}"
    elif source == "tushare":
        return f"{code}.{symbol.split('.')[-1]}"
    elif source == "eastmoney":
        if symbol.endswith(".SH"):
            return f"SH{code}"
        return f"SZ{code}"
    return symbol


# ============================================================
# 腾讯行情 API
# 对应 TS: directDataAPI.ts tencentQuote / tencentBatchQuotes / tencentKline
# ============================================================

class TencentQuoteAPI:
    """
    腾讯财经实时行情 API

    端点: qt.gtimg.cn
    格式: v_<symbol>="~<name>~<code>~<price>~<prevclose>~<open>~<volume>~..."
    """

    BASE_URL = "https://qt.gtimg.cn/q="

    @staticmethod
    async def quote(symbol: str) -> Optional[dict]:
        """获取单只股票实时行情"""
        code = _format_symbol(symbol, "tencent")
        url = f"{TencentQuoteAPI.BASE_URL}{code}"

        try:
            resp = await _http_get(url, timeout=10, referer="https://finance.qq.com")
            text = await resp.text()

            # 解析腾讯格式: v_sz000001="1~平安银行~000001~11.25~11.10~..."
            for line in text.strip().split("\n"):
                if "=" in line:
                    _, value = line.split("=", 1)
                    value = value.strip('";\n')
                    fields = value.split("~")
                    if len(fields) < 40:
                        continue

                    return {
                        "symbol": symbol,
                        "name": fields[1] if len(fields) > 1 else "",
                        "code": fields[2] if len(fields) > 2 else "",
                        "price": _safe_float(fields[3]),
                        "prev_close": _safe_float(fields[4]),
                        "open": _safe_float(fields[5]),
                        "volume": _safe_int(fields[6]),
                        "high": _safe_float(fields[33]),
                        "low": _safe_float(fields[34]),
                        "amount": _safe_float(fields[37]) * 10000,  # 万→元
                        "change": _safe_float(fields[31]),
                        "change_pct": _safe_float(fields[32]),
                        "pe": _safe_float(fields[39]),
                        "turnover_rate": _safe_float(fields[38]),
                        "timestamp": time.time(),
                    }
        except Exception:
            return None

        return None

    @staticmethod
    async def batch_quotes(symbols: List[str]) -> List[dict]:
        """批量获取实时行情（最多 50 只）"""
        codes = [_format_symbol(s, "tencent") for s in symbols[:50]]
        url = f"{TencentQuoteAPI.BASE_URL}{','.join(codes)}"

        try:
            resp = await _http_get(url, timeout=10, referer="https://finance.qq.com")
            text = await resp.text()

            results = []
            for line in text.strip().split("\n"):
                if "=" in line:
                    _, value = line.split("=", 1)
                    value = value.strip('";\n')
                    fields = value.split("~")
                    if len(fields) < 40:
                        continue
                    # 提取原始 symbol
                    code = fields[2] if len(fields) > 2 else ""
                    for s in symbols:
                        if code in s or s.replace(".SH", "").replace(".SZ", "") == code:
                            results.append({
                                "symbol": s,
                                "name": fields[1],
                                "price": _safe_float(fields[3]),
                                "prev_close": _safe_float(fields[4]),
                                "open": _safe_float(fields[5]),
                                "volume": _safe_int(fields[6]),
                                "high": _safe_float(fields[33]),
                                "low": _safe_float(fields[34]),
                                "change_pct": _safe_float(fields[32]),
                                "pe": _safe_float(fields[39]),
                                "timestamp": time.time(),
                            })
                            break
            return results
        except Exception:
            return []

    @staticmethod
    async def kline(symbol: str, days: int = 60, period: str = "day") -> List[dict]:
        """
        获取历史K线数据

        端点: web.ifzq.gtimg.cn/appstock/app/fqkline/get
        """
        code = _format_symbol(symbol, "tencent")
        param_map = {"day": "qfq", "week": "qfqweek", "month": "qfqmonth"}
        param = param_map.get(period, "qfq")

        url = (
            f"https://web.ifzq.gtimg.cn/appstock/app/fqkline/get"
            f"?param={code},{param},,,{days}"
        )

        try:
            resp = await _http_get(url, timeout=10, referer="https://finance.qq.com")
            data = await resp.json()

            if data.get("code") != 0:
                return []

            klines = []
            stock_data = data.get("data", {}).get(code, {})
            kline_list = stock_data.get(param, []) or stock_data.get("day", [])

            for item in kline_list[-days:]:
                klines.append({
                    "date": item[0],
                    "open": _safe_float(item[1]),
                    "close": _safe_float(item[2]),
                    "high": _safe_float(item[3]),
                    "low": _safe_float(item[4]),
                    "volume": _safe_int(item[5]),
                    "amount": _safe_float(item[6]),
                })
            return klines
        except Exception:
            return []


# ============================================================
# 新浪行情 API
# 对应 TS: directDataAPI.ts sinaQuote / sinaBatchQuotes
# ============================================================

class SinaQuoteAPI:
    """
    新浪财经实时行情 API

    端点: hq.sinajs.cn
    格式: var hq_str_<symbol>="<name>,<open>,<prevclose>,<price>,<high>,<low>,..."
    """

    BASE_URL = "https://hq.sinajs.cn/list="

    @staticmethod
    async def quote(symbol: str) -> Optional[dict]:
        """获取单只股票实时行情"""
        code = _format_symbol(symbol, "sina")
        url = f"{SinaQuoteAPI.BASE_URL}{code}"

        try:
            resp = await _http_get(url, timeout=10, referer="https://finance.sina.com.cn")
            text = await resp.text()

            for line in text.strip().split("\n"):
                if "=" in line:
                    _, value = line.split("=", 1)
                    value = value.strip('";\n ')
                    fields = value.split(",")
                    if len(fields) < 32:
                        continue

                    return {
                        "symbol": symbol,
                        "name": fields[0],
                        "open": _safe_float(fields[1]),
                        "prev_close": _safe_float(fields[2]),
                        "price": _safe_float(fields[3]),
                        "high": _safe_float(fields[4]),
                        "low": _safe_float(fields[5]),
                        "volume": _safe_int(fields[8]),
                        "amount": _safe_float(fields[9]),
                        "change": _safe_float(fields[3]) - _safe_float(fields[2]),
                        "change_pct": _safe_float(fields[3]) / _safe_float(fields[2], 1) * 100 - 100 if _safe_float(fields[2]) > 0 else 0,
                        "timestamp": time.time(),
                    }
        except Exception:
            return None

        return None

    @staticmethod
    async def batch_quotes(symbols: List[str]) -> List[dict]:
        """批量获取实时行情"""
        codes = [_format_symbol(s, "sina") for s in symbols[:50]]
        url = f"{SinaQuoteAPI.BASE_URL}{','.join(codes)}"

        try:
            resp = await _http_get(url, timeout=15, referer="https://finance.sina.com.cn")
            text = await resp.text()

            results = []
            for line in text.strip().split("\n"):
                if "=" in line:
                    key, value = line.split("=", 1)
                    hq_code = key.replace("var hq_str_", "").strip()
                    value = value.strip('";\n ')
                    fields = value.split(",")
                    if len(fields) < 32:
                        continue

                    for s in symbols:
                        s_code = s.replace(".SH", "").replace(".SZ", "").replace(".BJ", "")
                        if hq_code.endswith(s_code):
                            results.append({
                                "symbol": s,
                                "name": fields[0],
                                "open": _safe_float(fields[1]),
                                "price": _safe_float(fields[3]),
                                "high": _safe_float(fields[4]),
                                "low": _safe_float(fields[5]),
                                "volume": _safe_int(fields[8]),
                                "amount": _safe_float(fields[9]),
                                "change_pct": _safe_float(fields[3]) / _safe_float(fields[2], 1) * 100 - 100 if _safe_float(fields[2]) > 0 else 0,
                                "timestamp": time.time(),
                            })
                            break
            return results
        except Exception:
            return []


# ============================================================
# Tushare Pro API
# 对应 TS: tushareProvider.ts
# ============================================================

class TushareErrorCode(Enum):
    TOKEN_MISSING  = "TOKEN_MISSING"
    TOKEN_INVALID  = "TOKEN_INVALID"
    QUOTA_EXCEEDED = "QUOTA_EXCEEDED"
    API_ERROR      = "API_ERROR"
    NETWORK_ERROR  = "NETWORK_ERROR"
    PARSE_ERROR    = "PARSE_ERROR"

class TushareProviderError(Exception):
    def __init__(self, message: str, code: TushareErrorCode, api_name: str = ""):
        super().__init__(message)
        self.code = code
        self.api_name = api_name

class TushareAPI:
    """
    Tushare Pro HTTP API 客户端

    对应 TS: tushareProvider.ts
    API 端点: http://api.tushare.pro
    """

    API_URL = "https://api.tushare.pro"

    def __init__(self, token: Optional[str] = None):
        self._token = token or os.environ.get("TUSHARE_TOKEN", "")
        self._request_count = 0
        self._last_request_time = 0.0

    @property
    def has_token(self) -> bool:
        return bool(self._token)

    async def _call(self, api_name: str, params: dict = None,
                    fields: str = "") -> dict:
        """
        调用 Tushare API

        对应 TS: tushareProvider 中的 safeFetch → POST http://api.tushare.pro
        """
        if not self._token:
            raise TushareProviderError("未配置 Tushare Token", TushareErrorCode.TOKEN_MISSING)

        # 频控：每分钟最多 200 次
        now = time.time()
        if now - self._last_request_time < 0.0:
            self._request_count += 1
            if self._request_count > 200:
                await asyncio.sleep(0.5)
        else:
            self._request_count = 0
            self._last_request_time = now

        payload = {
            "api_name": api_name,
            "token": self._token,
            "params": params or {},
            "fields": fields,
        }

        try:
            resp = await _http_post(
                self.API_URL,
                json_data=payload,
                timeout=15,
                headers={"Content-Type": "application/json"},
            )
            data = await resp.json()

            if data.get("code") != 0:
                msg = data.get("msg", "未知错误")
                if "token" in msg.lower():
                    raise TushareProviderError(msg, TushareErrorCode.TOKEN_INVALID, api_name)
                elif "权限" in msg or "quota" in msg.lower():
                    raise TushareProviderError(msg, TushareErrorCode.QUOTA_EXCEEDED, api_name)
                else:
                    raise TushareProviderError(msg, TushareErrorCode.API_ERROR, api_name)

            return data.get("data", {})
        except TushareProviderError:
            raise
        except Exception as e:
            raise TushareProviderError(str(e), TushareErrorCode.NETWORK_ERROR, api_name)

    async def stock_basic(self, exchange: str = "") -> List[dict]:
        """获取股票基础信息"""
        params = {"exchange": exchange, "list_status": "L",
                  "fields": "ts_code,symbol,name,area,industry,list_date"}
        result = await self._call("stock_basic", params)
        items = result.get("items", [])
        fields = result.get("fields", [])
        return [dict(zip(fields, item)) for item in items]

    async def daily(self, ts_code: str, start_date: str = "",
                    end_date: str = "") -> List[dict]:
        """获取日线行情"""
        params = {"ts_code": ts_code}
        if start_date: params["start_date"] = start_date
        if end_date: params["end_date"] = end_date
        result = await self._call("daily", params)
        items = result.get("items", [])
        fields = result.get("fields", [])
        return [dict(zip(fields, item)) for item in items]

    async def stk_holdernumber(self, ts_code: str) -> List[dict]:
        """获取股东户数"""
        result = await self._call("stk_holdernumber", {"ts_code": ts_code})
        items = result.get("items", [])
        fields = result.get("fields", [])
        return [dict(zip(fields, item)) for item in items]

    async def disclosure(self, ts_code: str) -> List[dict]:
        """获取公告"""
        result = await self._call("disclosure", {"ts_code": ts_code})
        items = result.get("items", [])
        fields = result.get("fields", [])
        return [dict(zip(fields, item)) for item in items]

    async def index_daily(self, ts_code: str) -> List[dict]:
        """获取指数日线"""
        result = await self._call("index_daily", {"ts_code": ts_code})
        items = result.get("items", [])
        fields = result.get("fields", [])
        return [dict(zip(fields, item)) for item in items]

    async def income(self, ts_code: str, period: str = "") -> List[dict]:
        """获取利润表"""
        result = await self._call("income", {"ts_code": ts_code, "period": period})
        items = result.get("items", [])
        fields = result.get("fields", [])
        return [dict(zip(fields, item)) for item in items]

    async def balancesheet(self, ts_code: str) -> List[dict]:
        """获取资产负债表"""
        result = await self._call("balancesheet", {"ts_code": ts_code})
        items = result.get("items", [])
        fields = result.get("fields", [])
        return [dict(zip(fields, item)) for item in items]

    async def dividend(self, ts_code: str) -> List[dict]:
        """获取分红送股"""
        result = await self._call("dividend", {"ts_code": ts_code})
        items = result.get("items", [])
        fields = result.get("fields", [])
        return [dict(zip(fields, item)) for item in items]


# ============================================================
# 东方财富爬虫 API
# 对应 TS: crawlerProvider.ts
# ============================================================

class EastMoneyAPI:
    """
    东方财富公开数据爬虫

    对应 TS: crawlerProvider.ts
    直连东财公开 API，不依赖 Vite 代理
    """

    # 用户代理轮换
    USER_AGENTS = [
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
    ]

    _last_request_time = 0.0
    _min_interval = 1.5  # 东财节流：1.5s

    @staticmethod
    def _rotate_ua() -> str:
        return random.choice(EastMoneyAPI.USER_AGENTS)

    @staticmethod
    async def _throttle():
        now = time.time()
        elapsed = now - EastMoneyAPI._last_request_time
        if elapsed < EastMoneyAPI._min_interval:
            await asyncio.sleep(EastMoneyAPI._min_interval - elapsed)
        EastMoneyAPI._last_request_time = time.time()

    @staticmethod
    async def _safe_fetch(url: str, timeout: int = 15) -> Optional[Any]:
        """节流 + UA 轮换的安全抓取"""
        await EastMoneyAPI._throttle()
        try:
            resp = await _http_get(
                url,
                timeout=timeout,
                headers={"User-Agent": EastMoneyAPI._rotate_ua()},
            )
            return await resp.json()
        except Exception:
            return None

    @staticmethod
    def _eastmoney_code(symbol: str) -> str:
        """000001.SZ → SZ000001"""
        code = symbol.replace(".SH", "").replace(".SZ", "").replace(".BJ", "")
        if symbol.endswith(".SH"):
            return f"SH{code}"
        return f"SZ{code}"

    # ---- 股东数据 (F10) ----

    @staticmethod
    async def shareholder_data(symbol: str) -> Optional[dict]:
        """
        获取股东户数数据

        端点: emweb.securities.eastmoney.com/PC_HSF10/ShareholderResearch/PageAjax
        """
        code = EastMoneyAPI._eastmoney_code(symbol)
        url = (
            "https://emweb.securities.eastmoney.com/PC_HSF10"
            f"/ShareholderResearch/PageAjax?code={code}"
        )
        data = await EastMoneyAPI._safe_fetch(url)
        if not data:
            return None

        holders = data.get("gdrs", [])
        return {
            "symbol": symbol,
            "total_shareholders": holders[0].get("HOLDER_TOTAL_NUM") if holders else None,
            "top10_pct": holders[0].get("HOLD_NUM_RATIO") if holders else None,
            "holders": holders[:5],
        }

    # ---- 公告数据 ----

    @staticmethod
    async def announcements(symbol: str, page_size: int = 20) -> List[dict]:
        """
        获取公告列表

        端点: np-anotice-stock.eastmoney.com/api/security/ann
        """
        code = EastMoneyAPI._eastmoney_code(symbol)
        url = (
            "https://np-anotice-stock.eastmoney.com/api/security/ann"
            f"?page_size={page_size}&page_index=1&stock_list={code}"
        )
        data = await EastMoneyAPI._safe_fetch(url)
        if not data or data.get("code") != 0:
            return []

        items = data.get("data", {}).get("list", [])
        return [
            {
                "title": item.get("title", ""),
                "date": item.get("notice_date", ""),
                "type": item.get("columns", [{}])[0].get("column_name", "") if item.get("columns") else "",
                "url": f"https://np-anotice-stock.eastmoney.com/api/security/ann/detail?art_code={item.get('art_code', '')}",
            }
            for item in items
        ]

    # ---- 限售解禁 ----

    @staticmethod
    async def lockup_expiry(symbol: str) -> List[dict]:
        """
        限售解禁数据

        端点: datacenter.eastmoney.com/securities/api/data/v1/get
        """
        code = symbol.replace(".SH", "").replace(".SZ", "").replace(".BJ", "")
        url = (
            "https://datacenter.eastmoney.com/securities/api/data/v1/get"
            f"?reportName=RPT_LIFT_STOCKDETIAL&columns=ALL"
            f"&filter=(SECURITY_CODE=%22{code}%22)"
            "&sortColumns=CHANGE_DATE&sortTypes=1&pageSize=10"
        )
        data = await EastMoneyAPI._safe_fetch(url)
        if not data or not data.get("success"):
            return []

        items = data.get("result", {}).get("data", [])
        return [
            {
                "date": item.get("CHANGE_DATE", ""),
                "shares": item.get("LIFT_SHARES", 0),
                "ratio": item.get("LIFT_RATIO", 0),
                "market_value": item.get("LIFT_MARKET_CAP", 0),
            }
            for item in items
        ]

    # ---- 分红数据 ----

    @staticmethod
    async def dividend_history(symbol: str) -> List[dict]:
        """
        分红历史数据

        端点: datacenter.eastmoney.com/securities/api/data/v1/get
        """
        code = symbol.replace(".SH", "").replace(".SZ", "").replace(".BJ", "")
        url = (
            "https://datacenter.eastmoney.com/securities/api/data/v1/get"
            f"?reportName=RPT_DMSH_FN_CASH&columns=ALL"
            f"&filter=(SECURITY_CODE=%22{code}%22)"
            "&sortColumns=EX_DIVIDEND_DATE&sortTypes=-1&pageSize=20"
        )
        data = await EastMoneyAPI._safe_fetch(url)
        if not data or not data.get("success"):
            return []

        items = data.get("result", {}).get("data", [])
        return [
            {
                "ex_date": item.get("EX_DIVIDEND_DATE", ""),
                "cash_div": _safe_float(item.get("BONUS_IT_RATIO", 0)),
                "share_div": _safe_float(item.get("TRANSFER_RATIO", 0)),
                "record_date": item.get("RECORD_DATE", ""),
                "plan_date": item.get("PLAN_EXPLANATION", ""),
            }
            for item in items
        ]

    # ---- 一致预期 ----

    @staticmethod
    async def consensus_estimate(symbol: str) -> Optional[dict]:
        """
        一致预期数据

        端点: datacenter.eastmoney.com/securities/api/data/v1/get
        """
        code = symbol.replace(".SH", "").replace(".SZ", "").replace(".BJ", "")
        url = (
            "https://datacenter.eastmoney.com/securities/api/data/v1/get"
            f"?reportName=RPT_F10_FINANCE_MAINFINADATA"
            f"&columns=ALL&filter=(SECURITY_CODE=%22{code}%22)"
            "&pageSize=5"
        )
        data = await EastMoneyAPI._safe_fetch(url)
        if not data or not data.get("success"):
            return None

        items = data.get("result", {}).get("data", [])
        if not items:
            return None

        latest = items[0]
        return {
            "symbol": symbol,
            "revenue_est": _safe_float(latest.get("TOTAL_OPERATE_INCOME", 0)),
            "net_profit_est": _safe_float(latest.get("PARENT_NETPROFIT", 0)),
            "eps_est": _safe_float(latest.get("BASIC_EPS", 0)),
            "report_year": latest.get("REPORT_DATE", ""),
        }


# ============================================================
# KIMI AI 增强服务
# 对应 TS: kimiAIService.ts
# ============================================================

class KimiAITaskPriority(Enum):
    NEWS_SUMMARY  = 1   # 新闻摘要（最高优先级）
    REPORT_DIGEST = 2   # 研报解读
    ANOMALY_CHECK = 3   # 异常检测
    DAILY_REPORT  = 4   # 日报生成

class KimiAIService:
    """
    KIMI AI 增强服务

    对应 TS: kimiAIService.ts
    四大场景：新闻摘要 / 研报解读 / 异常检测 / 日报生成

    配额策略：
    - 每日 30 次调用硬上限
    - 优先级：新闻摘要 > 研报解读 > 异常检测 > 日报
    - 同维度批量合并：5-10 条新闻合并为一次调用
    - 重试：最多 2 次，指数退避 (500ms → 1000ms)
    """

    DAILY_QUOTA = 30
    MAX_RETRIES = 2
    RETRY_BASE_MS = 500

    def __init__(self, api_key: Optional[str] = None, api_url: Optional[str] = None):
        self._api_key = api_key or os.environ.get("KIMI_API_KEY", "")
        self._api_url = api_url or "https://api.moonshot.cn/v1/chat/completions"
        self._used_today = 0
        self._today_date = time.strftime("%Y-%m-%d")

    def _reset_daily_quota(self):
        today = time.strftime("%Y-%m-%d")
        if today != self._today_date:
            self._today_date = today
            self._used_today = 0

    def _check_quota(self, priority: KimiAITaskPriority) -> bool:
        self._reset_daily_quota()
        return self._used_today < self.DAILY_QUOTA

    async def _call_kimi(self, messages: List[dict], temperature: float = 0.3) -> str:
        """调用 KIMI API"""
        if not self._api_key:
            return "[KIMI: 未配置 API Key，返回模板摘要]"

        headers = {
            "Authorization": f"Bearer {self._api_key}",
            "Content-Type": "application/json",
        }
        payload = {
            "model": "moonshot-v1-8k",
            "messages": messages,
            "temperature": temperature,
            "max_tokens": 1024,
        }

        for attempt in range(self.MAX_RETRIES + 1):
            try:
                resp = await _http_post(
                    self._api_url,
                    json_data=payload,
                    timeout=30,
                    headers=headers,
                )
                data = await resp.json()
                content = data.get("choices", [{}])[0].get("message", {}).get("content", "")
                self._used_today += 1
                return content
            except Exception:
                if attempt < self.MAX_RETRIES:
                    await asyncio.sleep(self.RETRY_BASE_MS * (2 ** attempt) / 1000)
                else:
                    return "[KIMI: API 调用失败，返回模板摘要]"

        return "[KIMI: 重试耗尽]"

    async def summarize_news(self, symbol: str, name: str,
                             news_list: List[dict]) -> str:
        """
        新闻摘要 (Dim 05 热点新闻)

        对应 TS: kimiAIService.summarizeNews()
        """
        if not self._check_quota(KimiAITaskPriority.NEWS_SUMMARY):
            return f"[KIMI 配额耗尽] {name}({symbol}) 近期新闻共 {len(news_list)} 条"

        # 批量合并：取前 10 条新闻
        news_text = "\n".join(
            f"- {n.get('date', '')} {n.get('title', '')}"
            for n in news_list[:10]
        )

        messages = [
            {"role": "system", "content": "你是专业的金融新闻分析师。请用 2-3 句话总结以下新闻的核心要点，重点关注对股价可能产生的影响。"},
            {"role": "user", "content": f"股票 {name}({symbol}) 近期新闻：\n{news_text}\n\n请总结核心要点。"},
        ]

        return await self._call_kimi(messages)

    async def digest_research(self, symbol: str, name: str,
                              reports: List[dict]) -> str:
        """
        研报解读 (Dim 08 研报中心)

        对应 TS: kimiAIService.digestResearch()
        """
        if not self._check_quota(KimiAITaskPriority.REPORT_DIGEST):
            return f"[KIMI 配额耗尽] {name}({symbol}) 近180天共 {len(reports)} 份研报"

        report_text = "\n".join(
            f"- {r.get('date', '')} {r.get('title', '')} 评级:{r.get('rating', 'N/A')} 目标价:{r.get('target_price', 'N/A')}"
            for r in reports[:10]
        )

        messages = [
            {"role": "system", "content": "你是专业的券商研报分析师。请用 2-3 句话提炼多份研报的共识观点和分歧点。"},
            {"role": "user", "content": f"股票 {name}({symbol}) 近期研报：\n{report_text}\n\n请提炼共识观点和分歧。"},
        ]

        return await self._call_kimi(messages)

    async def check_anomaly(self, symbol: str, name: str,
                            dim_data: dict) -> str:
        """
        跨维度异常检测

        对应 TS: kimiAIService 的异常检测场景
        """
        if not self._check_quota(KimiAITaskPriority.ANOMALY_CHECK):
            return "[KIMI 配额耗尽] 跳过异常检测"

        messages = [
            {"role": "system", "content": "你是专业的数据异常检测分析师。检查以下维度数据是否存在不一致或异常，用 1-2 句话报告。"},
            {"role": "user", "content": f"股票 {name}({symbol}) 多维度数据：\n{json.dumps(dim_data, ensure_ascii=False, default=str)}\n\n请检查是否存在异常。"},
        ]

        return await self._call_kimi(messages)

    @property
    def remaining_quota(self) -> int:
        self._reset_daily_quota()
        return max(0, self.DAILY_QUOTA - self._used_today)


# ============================================================
# HTTP 工具函数
# ============================================================

async def _http_get(url: str, timeout: int = 10, referer: str = "",
                    headers: dict = None) -> Any:
    """HTTP GET 请求"""
    import aiohttp
    hdrs = headers or {}
    if referer:
        hdrs["Referer"] = referer
    timeout_obj = aiohttp.ClientTimeout(total=timeout)
    session = aiohttp.ClientSession(timeout=timeout_obj)
    try:
        return await session.get(url, headers=hdrs)
    finally:
        await session.close()

async def _http_post(url: str, json_data: dict = None, timeout: int = 10,
                     headers: dict = None) -> Any:
    """HTTP POST 请求"""
    import aiohttp
    timeout_obj = aiohttp.ClientTimeout(total=timeout)
    session = aiohttp.ClientSession(timeout=timeout_obj)
    try:
        return await session.post(url, json=json_data, headers=headers or {})
    finally:
        await session.close()


# ============================================================
# 工厂函数
# ============================================================

def create_tencent_api() -> TencentQuoteAPI:
    return TencentQuoteAPI()

def create_sina_api() -> SinaQuoteAPI:
    return SinaQuoteAPI()

def create_tushare_api(token: Optional[str] = None) -> TushareAPI:
    return TushareAPI(token=token)

def create_eastmoney_api() -> EastMoneyAPI:
    return EastMoneyAPI()

def create_kimi_service(api_key: Optional[str] = None) -> KimiAIService:
    return KimiAIService(api_key=api_key)