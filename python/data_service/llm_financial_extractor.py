"""
LLM 并发财务数据解析模块

流程：
1. 从巨潮资讯网（cninfo）下载年报 PDF（失败时 fallback 到 AKShare 财务数据转文本）
2. pdfplumber 提取 PDF 文本
3. LLM 从文本中抽取结构化财务 JSON（OpenAI 兼容 API，Key 从环境变量读取）
4. ThreadPoolExecutor 并发处理 N 只股票

环境变量配置：
    DEEPSEEK_API_KEY=sk-xxx       # LLM API Key（也支持 LLM_API_KEY）
    LLM_BASE_URL=https://api.deepseek.com  # 可选，默认 DeepSeek
    LLM_MODEL=deepseek-chat       # 可选，默认 deepseek-chat

    未配置 Key 时自动走 Mock 响应，配好后一键切换真实 LLM。
"""

import json
import logging
import os
import re
import tempfile
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import Any, Optional

logger = logging.getLogger("v9-llm-financial")

# ──────────────────────────────────────────────
# LLM 配置（从环境变量读取）
# ──────────────────────────────────────────────

LLM_API_KEY = os.environ.get("DEEPSEEK_API_KEY") or os.environ.get("LLM_API_KEY") or os.environ.get("ARK_API_KEY") or ""
LLM_BASE_URL = os.environ.get("LLM_BASE_URL", "https://api.deepseek.com")
LLM_MODEL = os.environ.get("LLM_MODEL", "deepseek-chat")

# ──────────────────────────────────────────────
# 巨潮资讯网年报 PDF 下载
# ──────────────────────────────────────────────

_CNINFO_SEARCH_URL = "http://www.cninfo.com.cn/new/hisAnnouncement/query"
_CNINFO_STOCK_LIST_URL = "http://www.cninfo.com.cn/new/data/szse_stock.json"
_CNINFO_PDF_BASE = "http://static.cninfo.com.cn/"
_DEFAULT_SAVE_DIR = os.path.join(tempfile.gettempdir(), "v9-reports")

# 全量股票 orgId 映射缓存（24h TTL，巨潮 stock 参数需要 "代码,orgId" 格式）
_ORG_MAP_CACHE: dict[str, Any] = {"data": None, "ts": 0.0}
_ORG_MAP_TTL = 86400


def _get_cninfo_org_map() -> dict[str, str]:
    """获取巨潮全量股票 代码→orgId 映射（带 24h 缓存）。

    巨潮 hisAnnouncement/query 的 stock 参数必须用 "代码,orgId" 格式，
    orgId 是巨潮内部机构 ID（如 gssh0600519），无法从代码直接推导，必须从接口获取。
    """
    now = time.time()
    if _ORG_MAP_CACHE["data"] is not None and now - _ORG_MAP_CACHE["ts"] < _ORG_MAP_TTL:
        return _ORG_MAP_CACHE["data"]

    import requests

    try:
        resp = requests.get(
            _CNINFO_STOCK_LIST_URL,
            headers={"User-Agent": "Mozilla/5.0"},
            timeout=15,
        )
        data = resp.json()
        stock_list = data.get("stockList") or []
        org_map = {item["code"]: item["orgId"] for item in stock_list if item.get("code") and item.get("orgId")}
        _ORG_MAP_CACHE["data"] = org_map
        _ORG_MAP_CACHE["ts"] = now
        logger.info("[pdf] 巨潮 orgId 映射加载: %d 只股票", len(org_map))
        return org_map
    except Exception as e:
        logger.warning("[pdf] 巨潮 orgId 映射获取失败: %s", e)
        return _ORG_MAP_CACHE["data"] or {}


def _to_cninfo_stock(symbol: str) -> Optional[str]:
    """转巨潮资讯网 stock 参数格式：600519.SH → '600519,gssh0600519'。

    依赖 orgId 映射，映射缺失时返回 None（调用方需 fallback）。
    """
    clean = symbol.split(".")[0]
    org_map = _get_cninfo_org_map()
    org_id = org_map.get(clean)
    if not org_id:
        logger.warning("[pdf] 巨潮未找到 orgId: %s", symbol)
        return None
    return f"{clean},{org_id}"


def download_annual_report(symbol: str, save_dir: str = _DEFAULT_SAVE_DIR) -> Optional[str]:
    """
    从巨潮资讯网搜索并下载最新年报 PDF。

    @returns PDF 本地路径，失败返回 None
    """
    import requests

    os.makedirs(save_dir, exist_ok=True)
    stock_param = _to_cninfo_stock(symbol)
    if not stock_param:
        return None

    try:
        resp = requests.post(
            _CNINFO_SEARCH_URL,
            data={
                "stock": stock_param,
                "searchkey": "年度报告",
                "category": "category_ndbg_szsh",
                "page_num": "1",
                "page_size": "10",
                "plate": "",
            },
            headers={
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
                "Content-Type": "application/x-www-form-urlencoded",
            },
            timeout=15,
        )
        data = resp.json()
        announcements = data.get("announcements") or []
        if not announcements:
            logger.warning("[pdf] 巨潮未找到年报: %s", symbol)
            return None

        # 优先选「年度报告」全文（排除摘要/英文版/修订版/半年度）
        target = None
        for ann in announcements:
            title = ann.get("announcementTitle", "")
            if (
                "年度报告" in title
                and "摘要" not in title
                and "英文" not in title
                and "已取消" not in title
                and "半年度" not in title
            ):
                target = ann
                break
        if not target:
            target = announcements[0]

        # 注意：巨潮字段是 adjunctUrl（驼峰），非 adjunct_url
        adjunct_url = target.get("adjunctUrl") or target.get("adjunct_url") or ""
        if not adjunct_url:
            logger.warning("[pdf] 巨潮年报 adjunctUrl 为空: %s, title=%s", symbol, target.get("announcementTitle"))
            return None

        pdf_url = _CNINFO_PDF_BASE + adjunct_url
        pdf_path = os.path.join(save_dir, f"{symbol.split('.')[0]}_annual.pdf")

        resp = requests.get(pdf_url, timeout=120, headers={"User-Agent": "Mozilla/5.0"})
        if resp.status_code != 200 or len(resp.content) < 10000:
            logger.warning("[pdf] PDF 下载异常: %s, status=%d, size=%d", symbol, resp.status_code, len(resp.content))
            return None

        with open(pdf_path, "wb") as f:
            f.write(resp.content)
        logger.info(
            "[pdf] 下载成功: %s → %s (%.1f KB, %s)",
            symbol, os.path.basename(pdf_path), len(resp.content) / 1024, target.get("announcementTitle"),
        )
        return pdf_path
    except Exception as e:
        logger.warning("[pdf] 下载失败: %s, %s", symbol, e)
        return None


# ──────────────────────────────────────────────
# PDF 文本提取
# ──────────────────────────────────────────────


def extract_pdf_text(pdf_path: str, max_pages: int = 30) -> Optional[str]:
    """
    用 pdfplumber 提取 PDF 文本（前 max_pages 页，通常包含财务摘要）。

    @returns 提取的文本，失败返回 None
    """
    try:
        import pdfplumber
    except ImportError:
        logger.error("[pdf] pdfplumber 未安装，请运行: pip install pdfplumber")
        return None

    try:
        texts: list[str] = []
        with pdfplumber.open(pdf_path) as pdf:
            total_pages = len(pdf.pages)
            for page in pdf.pages[:max_pages]:
                text = page.extract_text() or ""
                texts.append(text)
        full_text = "\n\n".join(texts)
        logger.info("[pdf] 文本提取: %s, %d/%d 页, %d 字符", os.path.basename(pdf_path), min(total_pages, max_pages), total_pages, len(full_text))
        return full_text
    except Exception as e:
        logger.error("[pdf] 文本提取失败: %s, %s", pdf_path, e)
        return None


# ──────────────────────────────────────────────
# Fallback: AKShare 财务数据转文本
# ──────────────────────────────────────────────


def get_akshare_financial_text(symbol: str) -> Optional[str]:
    """
    从 AKShare 获取财务数据表格，转为文本。
    当 PDF 下载失败或文本提取失败时作为 fallback。
    """
    try:
        import akshare as ak

        clean = symbol.split(".")[0]
        lines = [f"股票代码: {symbol}", "财务数据摘要（来自 AKShare）:"]

        # 财务摘要
        df = ak.stock_financial_abstract(symbol=clean)
        if df is not None and not df.empty:
            date_cols = [c for c in df.columns if c not in ("选项", "指标")]
            for _, row in df.iterrows():
                metric = str(row.get("指标", ""))
                vals = [f"{c}: {row[c]}" for c in date_cols[:4]]
                lines.append(f"  {metric}: {', '.join(vals)}")

        # 财务指标
        try:
            df2 = ak.stock_financial_analysis_indicator(symbol=clean, start_year="2023")
            if df2 is not None and not df2.empty:
                latest = df2.iloc[-1]
                lines.append(f"报告期: {latest.get('日期', '')}")
                for col in df2.columns:
                    if col != "日期":
                        val = latest.get(col)
                        if val is not None and str(val).strip():
                            lines.append(f"  {col}: {val}")
        except Exception:
            pass

        text = "\n".join(lines)
        if len(text) < 50:
            return None
        logger.info("[fallback] AKShare 文本生成: %s, %d 字符", symbol, len(text))
        return text
    except Exception as e:
        logger.warning("[fallback] AKShare 获取失败: %s, %s", symbol, e)
        return None


# ──────────────────────────────────────────────
# LLM JSON 抽取
# ──────────────────────────────────────────────

_EXTRACTION_PROMPT = """你是一个专业的财务数据分析师。请从以下上市公司年度报告文本中提取关键财务指标。

请严格按照以下 JSON 格式输出，不要输出任何其他内容（不要 markdown 代码块标记）：
{
  "report_date": "YYYY-MM-DD",
  "revenue": 123456789.00,
  "revenue_yoy": 15.5,
  "net_profit": 123456789.00,
  "net_profit_yoy": 10.2,
  "gross_margin": 45.3,
  "net_margin": 20.1,
  "operating_cf": 123456789.00,
  "rd_ratio": 5.2,
  "receivables": 123456789.00,
  "inventory_turnover_days": 45.0,
  "interest_bearing_debt": 123456789.00,
  "goodwill": 123456789.00,
  "net_assets": 123456789.00,
  "shareholder_pledge": 10.5
}

字段说明：
- 所有金额单位为元（如营收 10 亿 = 1000000000）
- 比率为百分比（如毛利率 45.3% = 45.3）
- revenue_yoy / net_profit_yoy: 同比增长率（%）
- rd_ratio: 研发费用占营收比例（%）
- shareholder_pledge: 股东质押比例（%）
- 如果文本中找不到某项，对应字段设为 null

以下是年报文本：
---
{text}
---
"""


def _strip_code_fence(text: str) -> str:
    """去除 LLM 输出可能包裹的 markdown 代码块标记"""
    text = text.strip()
    if text.startswith("```"):
        text = re.sub(r"^```(?:json)?\s*", "", text)
        text = re.sub(r"\s*```$", "", text)
    return text.strip()


def _mock_llm_response(symbol: str) -> dict[str, Any]:
    """API Key 未配置时的 Mock 响应（结构完整但值为 null）"""
    return {
        "_mock": True,
        "_note": "LLM_API_KEY 未配置，返回 Mock。配置 DEEPSEEK_API_KEY 后切换真实 LLM 抽取。",
        "symbol": symbol,
        "report_date": None,
        "revenue": None,
        "revenue_yoy": None,
        "net_profit": None,
        "net_profit_yoy": None,
        "gross_margin": None,
        "net_margin": None,
        "operating_cf": None,
        "rd_ratio": None,
        "receivables": None,
        "inventory_turnover_days": None,
        "interest_bearing_debt": None,
        "goodwill": None,
        "net_assets": None,
        "shareholder_pledge": None,
    }


def llm_extract_financial(text: str, symbol: str) -> dict[str, Any]:
    """
    调用 LLM 从年报文本中抽取结构化财务 JSON。

    使用 OpenAI 兼容 API（DeepSeek / 通义千问 / Kimi 等均可）。
    API Key 从环境变量读取，未配置时返回 Mock。
    """
    if not LLM_API_KEY:
        logger.warning("[llm] API Key 未配置（DEEPSEEK_API_KEY / LLM_API_KEY / ARK_API_KEY），返回 Mock: %s", symbol)
        return _mock_llm_response(symbol)

    import requests

    # 截取前 12000 字符（避免 token 超限，约 6000-8000 tokens）
    truncated = text[:12000]
    prompt = _EXTRACTION_PROMPT.format(text=truncated)

    try:
        resp = requests.post(
            f"{LLM_BASE_URL}/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {LLM_API_KEY}",
                "Content-Type": "application/json",
            },
            json={
                "model": LLM_MODEL,
                "messages": [{"role": "user", "content": prompt}],
                "temperature": 0.1,
                "max_tokens": 2000,
            },
            timeout=90,
        )
        resp.raise_for_status()
        content = resp.json()["choices"][0]["message"]["content"]
        cleaned = _strip_code_fence(content)
        result = json.loads(cleaned)
        result["_llm_model"] = LLM_MODEL
        result["_llm_tokens_estimate"] = len(prompt) // 3
        logger.info("[llm] 抽取成功: %s, 字段数=%d", symbol, len([k for k, v in result.items() if v is not None and not k.startswith("_")]))
        return result
    except Exception as e:
        logger.error("[llm] 抽取失败: %s, %s", symbol, e)
        return {"_error": str(e), "symbol": symbol}


# ──────────────────────────────────────────────
# 单只股票完整处理
# ──────────────────────────────────────────────


def extract_one(symbol: str, save_dir: str = _DEFAULT_SAVE_DIR) -> dict[str, Any]:
    """
    处理单只股票完整链路：下载 PDF → 提取文本 → LLM 抽取。

    PDF 下载/提取失败时自动 fallback 到 AKShare 数据转文本。
    """
    t0 = time.time()
    result: dict[str, Any] = {"symbol": symbol, "source": "unknown"}

    # 1. 尝试下载年报 PDF
    pdf_path = download_annual_report(symbol, save_dir)

    text: Optional[str] = None
    if pdf_path:
        text = extract_pdf_text(pdf_path, max_pages=30)
        if text:
            result["source"] = "pdf"
            result["pdf_path"] = os.path.basename(pdf_path)
            result["text_length"] = len(text)
        else:
            logger.warning("[extract] PDF 文本提取失败，fallback AKShare: %s", symbol)

    if not text:
        # fallback: AKShare 数据转文本
        text = get_akshare_financial_text(symbol)
        if text:
            result["source"] = "akshare-fallback"
            result["text_length"] = len(text)
        else:
            result["source"] = "failed"
            result["error"] = "无法获取文本（PDF 下载失败且 AKShare 获取失败）"
            result["elapsed_ms"] = round((time.time() - t0) * 1000)
            return result

    # 2. LLM 抽取
    financial_data = llm_extract_financial(text, symbol)
    result["financial_data"] = financial_data
    result["elapsed_ms"] = round((time.time() - t0) * 1000)
    return result


# ──────────────────────────────────────────────
# 并发批量处理
# ──────────────────────────────────────────────


def extract_financial_batch(
    symbols: list[str],
    max_workers: int = 5,
    save_dir: str = _DEFAULT_SAVE_DIR,
) -> dict[str, Any]:
    """
    并发处理多只股票的财务数据 LLM 抽取。

    @param symbols: 股票代码列表（如 ["600519.SH", "000001.SZ"]）
    @param max_workers: 最大并发数（默认 5，避免 API 限流）
    @returns 汇总结果（含逐条详情 + 统计摘要）
    """
    t0 = time.time()
    results: list[dict[str, Any]] = []

    logger.info(
        "[batch] 开始并发 LLM 财务抽取: %d 只股票, max_workers=%d, llm_configured=%s, model=%s",
        len(symbols), max_workers, bool(LLM_API_KEY), LLM_MODEL,
    )

    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        future_map = {executor.submit(extract_one, sym, save_dir): sym for sym in symbols}
        for future in as_completed(future_map):
            sym = future_map[future]
            try:
                r = future.result()
                results.append(r)
                logger.info(
                    "[batch] 完成: %s, source=%s, text=%d 字符, elapsed=%dms",
                    sym, r.get("source"), r.get("text_length", 0), r.get("elapsed_ms", 0),
                )
            except Exception as e:
                logger.error("[batch] 异常: %s, %s", sym, e)
                results.append({"symbol": sym, "source": "error", "error": str(e), "elapsed_ms": 0})

    total_ms = round((time.time() - t0) * 1000)

    # 按原始顺序排列
    order_map = {sym: i for i, sym in enumerate(symbols)}
    results.sort(key=lambda r: order_map.get(r.get("symbol", ""), 999))

    # 统计
    pdf_count = sum(1 for r in results if r.get("source") == "pdf")
    akshare_count = sum(1 for r in results if r.get("source") == "akshare-fallback")
    failed_count = sum(1 for r in results if r.get("source") in ("failed", "error"))
    llm_success = sum(1 for r in results if r.get("financial_data") and not r["financial_data"].get("_error"))

    summary: dict[str, Any] = {
        "total": len(symbols),
        "pdf_source": pdf_count,
        "akshare_fallback": akshare_count,
        "failed": failed_count,
        "llm_success": llm_success,
        "llm_configured": bool(LLM_API_KEY),
        "llm_model": LLM_MODEL,
        "total_elapsed_ms": total_ms,
        "avg_elapsed_ms": round(total_ms / max(len(symbols), 1)),
        "concurrency": max_workers,
        "results": results,
    }

    logger.info(
        "[batch] 汇总: total=%d, pdf=%d, akshare=%d, failed=%d, llm_success=%d, total=%dms, avg=%dms",
        summary["total"], pdf_count, akshare_count, failed_count, llm_success, total_ms, summary["avg_elapsed_ms"],
    )
    return summary
