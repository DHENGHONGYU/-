"""
@module _sector_fund_flow
@lifecycle @Global
@description 板块资金流获取（f2Zijin 三层降级编排）

@remarks
## 三层降级架构
f2Zijin 主力净流入获取优先级：
- L1 (盘中实时, 优先)：AKShare 同花顺 stock_fund_flow_industry
- L2 (盘中实时, 兜底)：hexin-v 手动绕过（_ths_hexinv + requests 直连）
- L3 (缓存兜底)：SQLite 最近5日 net_amount 均值（_sector_fund_flow_db）
- L4 (代理保底)：5日均额/20日均额（保留在 collect_endpoints.py，本模块不处理）

## 返回格式
所有层统一返回 dict[str, float]：{行业名称: 净流入(亿元)}
- 行业名称为同花顺原始名称（如 "白酒"、"银行"）
- 调用方通过 _normalize_sw_name 归一化后匹配申万二级名（如 "白酒II" → "白酒"）

## 降级策略
1. L1 成功 → 写入 SQLite → 返回
2. L1 失败 → 尝试 L2
3. L2 成功 → 写入 SQLite → 返回
4. L2 失败 → 尝试 L3（读 SQLite 最近5日均值，逐板块读取）
5. L3 也无数据 → 返回 None（调用方降级 L4 量价代理）

@see hot-momentum-strategy.md §2.5.2 f2Zijin 三层降级
"""

import io
import logging
import re
from datetime import datetime
from typing import Optional

import requests

from _ths_hexinv import build_ths_headers
from _sector_fund_flow_db import upsert_batch, get_recent_avg_net_amount

logger = logging.getLogger(__name__)

# 同花顺行业资金流接口 URL（field=tradezdf 按涨跌幅排序，desc 降序）
_THS_FUND_FLOW_URL_TEMPLATE = (
    "http://data.10jqka.com.cn/funds/hyzjl/field/tradezdf/order/desc/ajax/1/free/{page}/"
)
_THS_TIMEOUT = 10


def _parse_fund_flow_df(df) -> dict[str, float]:
    """把同花顺资金流 DataFrame 解析为 {行业名称: 净流入(亿元)} 字典。

    兼容两种数据源的列名差异：
    - L1 (AKShare stock_fund_flow_industry)：列名 "主力净流入-净额"，单位元
    - L2 (同花顺 HTTP 直连)：列名 "净额(亿)"，单位亿元

    Args:
        df: pandas DataFrame

    Returns:
        {行业名称: 净流入(亿元)} 字典，空 DataFrame 返回 {}
    """
    if df is None or df.empty:
        return {}

    # 兼容不同列名：L1 可能是 "行业"，L2 解析后可能是 "行业" 或第一列
    name_col = None
    for candidate in ["行业", "行业名称", "板块名称", "名称"]:
        if candidate in df.columns:
            name_col = candidate
            break
    if name_col is None:
        logger.warning("[fund_flow] 未找到行业名称列，实际列: %s", list(df.columns))
        return {}

    # 金额列候选：L1 用 "主力净流入-净额"(元)，L2 用 "净额(亿)"(亿元)
    amount_col = None
    is_yi_unit = False  # 是否已是亿元单位
    for candidate in ["主力净流入-净额", "主力净流入金额", "净额(亿)", "净额"]:
        if candidate in df.columns:
            amount_col = candidate
            # 列名含 "(亿)" 表示已经是亿元单位，无需 /1e8
            is_yi_unit = "(亿)" in candidate or "亿" in candidate
            break
    if amount_col is None:
        logger.warning("[fund_flow] 未找到主力净流入列，实际列: %s", list(df.columns))
        return {}

    result: dict[str, float] = {}
    for _, row in df.iterrows():
        name = str(row[name_col]).strip()
        if not name or name == "nan":
            continue
        try:
            raw = float(row[amount_col])
            # L1 单位是元，需 /1e8 转亿元；L2 已是亿元，直接用
            amount_yi = raw if is_yi_unit else raw / 1e8
            result[name] = round(amount_yi, 4)
        except (TypeError, ValueError):
            continue
    logger.info("[fund_flow] 解析完成 共 %d 个行业 amount_col=%s is_yi=%s",
                len(result), amount_col, is_yi_unit)
    return result


def fetch_sector_fund_flow_l1() -> Optional[dict[str, float]]:
    """L1: AKShare 同花顺行业资金流。

    调用 ak.stock_fund_flow_industry(symbol="同人花顺行业")。
    失败场景：AKShare 未安装 / 接口被反爬 / 返回空 DataFrame

    Returns:
        {行业名称: 净流入(亿元)} 或 None
    """
    try:
        import akshare as ak
    except ImportError:
        logger.warning("[fund_flow L1] akshare 未安装")
        return None

    try:
        # symbol="同人花顺行业" 是 AKShare 的同花顺行业资金流接口
        df = ak.stock_fund_flow_industry(symbol="同人花顺行业")
        result = _parse_fund_flow_df(df)
        if result:
            logger.info("[fund_flow L1] AKShare 成功 获取 %d 个行业", len(result))
            return result
        logger.warning("[fund_flow L1] AKShare 返回空")
        return None
    except Exception as e:
        logger.warning("[fund_flow L1] AKShare 失败: %s", e, exc_info=True)
        return None


def fetch_sector_fund_flow_l2() -> Optional[dict[str, float]]:
    """L2: hexin-v 直连同花顺 HTTP（绕过 AKShare 中间层）。

    使用 _ths_hexinv 生成 hexin-v 验证码，requests 直连同花顺行业资金流页面，
    pd.read_html 解析 HTML 表格。

    失败场景：hexin-v 生成失败 / HTTP 请求失败 / HTML 解析失败

    Returns:
        {行业名称: 净流入(亿元)} 或 None
    """
    headers = build_ths_headers()
    if not headers:
        logger.warning("[fund_flow L2] hexin-v 生成失败，无法调用同花顺")
        return None

    try:
        import pandas as pd
    except ImportError:
        logger.warning("[fund_flow L2] pandas 未安装")
        return None

    all_data: dict[str, float] = {}
    # 同花顺行业资金流通常有 1-3 页，遍历前 3 页足够
    for page in range(1, 4):
        url = _THS_FUND_FLOW_URL_TEMPLATE.format(page=page)
        try:
            resp = requests.get(url, headers=headers, timeout=_THS_TIMEOUT)
            if resp.status_code != 200:
                logger.warning(
                    "[fund_flow L2] page=%d HTTP %d", page, resp.status_code
                )
                break
            # 检查是否被反爬（返回空页面或验证码页面）
            if len(resp.text) < 500:
                logger.warning("[fund_flow L2] page=%d 响应过短 len=%d，疑似反爬",
                               page, len(resp.text))
                break
            dfs = pd.read_html(io.StringIO(resp.text))
            if not dfs:
                break
            page_data = _parse_fund_flow_df(dfs[0])
            if not page_data:
                break
            all_data.update(page_data)
        except Exception as e:
            logger.warning("[fund_flow L2] page=%d 失败: %s", page, e, exc_info=True)
            break

    if all_data:
        logger.info("[fund_flow L2] hexin-v 成功 获取 %d 个行业", len(all_data))
        return all_data
    logger.warning("[fund_flow L2] hexin-v 全部页失败")
    return None


def _persist_to_sqlite(data: dict[str, float], source: str) -> None:
    """把 L1/L2 的成功结果写入 SQLite（供 L3 兜底读取）。

    Args:
        data: {行业名称: 净流入(亿元)}
        source: "L1_AKShare" 或 "L2_hexinv"
    """
    today = datetime.now().strftime("%Y-%m-%d")
    now_iso = datetime.now().isoformat()
    rows = [
        {
            "date": today,
            "sector_code": name,  # 同花顺源无代码，用名称作为 key
            "sector_name": name,
            "net_amount": amount,
            "source": source,
            "fetched_at": now_iso,
        }
        for name, amount in data.items()
    ]
    written = upsert_batch(rows)
    logger.info("[fund_flow] SQLite 写入 %d 行 source=%s", written, source)


def fetch_sector_fund_flow_l3(sector_names: list[str], days: int = 5) -> Optional[dict[str, float]]:
    """L3: 从 SQLite 读取最近 N 日净流入均值（逐板块读取）。

    Args:
        sector_names: 需要查询的行业名称列表
        days: 回看天数，默认 5

    Returns:
        {行业名称: 5日均净流入(亿元)} 或 None（全部无缓存时）
    """
    result: dict[str, float] = {}
    for name in sector_names:
        avg = get_recent_avg_net_amount(name, days=days)
        if avg is not None:
            result[name] = round(avg, 4)
    if result:
        logger.info("[fund_flow L3] SQLite 缓存命中 %d/%d 个行业", len(result), len(sector_names))
        return result
    logger.warning("[fund_flow L3] SQLite 缓存全部未命中")
    return None


def fetch_sector_fund_flow(
    sector_names: Optional[list[str]] = None,
) -> Optional[dict[str, float]]:
    """
    f2Zijin 三层降级编排：L1 → L2 → L3。

    Args:
        sector_names: 需要查询的行业名称列表（L3 兜底时使用）。
                      None 时跳过 L3（调用方自行处理 L4 代理）。

    Returns:
        {行业名称: 净流入(亿元)} 或 None（全部失败，调用方降级 L4）

    降级日志：
        每层结果都带 source 字段，便于监控各层命中率。

    Example:
        >>> data = fetch_sector_fund_flow(["白酒", "银行"])
        >>> if data:
        ...     f2_raw = data.get("白酒")  # 净流入(亿元)
        ... else:
        ...     # 降级 L4 量价代理
    """
    # L1: AKShare 同花顺
    try:
        l1_result = fetch_sector_fund_flow_l1()
    except Exception as e:
        logger.warning("[fund_flow] L1 异常被捕获: %s", e, exc_info=True)
        l1_result = None
    if l1_result:
        _persist_to_sqlite(l1_result, "L1_AKShare")
        logger.info("[fund_flow] 最终来源=L1_AKShare 行业数=%d", len(l1_result))
        return l1_result

    # L2: hexin-v 直连
    logger.warning("[fund_flow] L1 失败，降级 L2 hexin-v")
    try:
        l2_result = fetch_sector_fund_flow_l2()
    except Exception as e:
        logger.warning("[fund_flow] L2 异常被捕获: %s", e, exc_info=True)
        l2_result = None
    if l2_result:
        _persist_to_sqlite(l2_result, "L2_hexinv")
        logger.info("[fund_flow] 最终来源=L2_hexinv 行业数=%d", len(l2_result))
        return l2_result

    # L3: SQLite 缓存
    if sector_names:
        logger.warning("[fund_flow] L2 失败，降级 L3 SQLite 缓存")
        try:
            l3_result = fetch_sector_fund_flow_l3(sector_names)
        except Exception as e:
            logger.warning("[fund_flow] L3 异常被捕获: %s", e, exc_info=True)
            l3_result = None
        if l3_result:
            logger.info("[fund_flow] 最终来源=L3_cache 行业数=%d", len(l3_result))
            return l3_result

    # 全部失败，调用方降级 L4
    logger.error("[fund_flow] L1/L2/L3 全部失败，调用方需降级 L4 量价代理")
    return None


__all__ = [
    "fetch_sector_fund_flow",
    "fetch_sector_fund_flow_l1",
    "fetch_sector_fund_flow_l2",
    "fetch_sector_fund_flow_l3",
]
