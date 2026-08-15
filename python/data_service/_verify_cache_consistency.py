"""
缓存数据一致性自动校验脚本

对比 SQLite 缓存数据与 AKShare 实时数据，校验：
1. 板块基本信息一致性 (PE/PB/成份个数)
2. 日线行情数据一致性 (最新收盘价/涨跌幅)
3. 技术指标计算结果一致性

目标板块：通用设备(801072.SI)、半导体(801081.SI)

用法:
    python _verify_cache_consistency.py
    python _verify_cache_consistency.py --sectors 801072.SI,801081.SI
    python _verify_cache_consistency.py --full  # 校验全量板块
"""

import argparse
import json
import logging
import sys
import time
from datetime import datetime
from pathlib import Path
from typing import Optional

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(name)s] %(levelname)s: %(message)s",
)
logger = logging.getLogger("cache-consistency")

# 添加项目路径
sys.path.insert(0, str(Path(__file__).resolve().parent))

import akshare as ak
import pandas as pd
from _sector_cache_db import (
    get_sector_info,
    get_hist_for_sector,
    compute_technical_indicators,
    get_cache_stats,
    is_cache_fresh,
)


# ---------------------------------------------------------------------------
# 配置
# ---------------------------------------------------------------------------

# 默认校验的目标板块
DEFAULT_SECTORS = [
    {"code": "801072.SI", "name": "通用设备"},
    {"code": "801081.SI", "name": "半导体"},
]

# 一致性校验阈值
TOLERANCE = {
    "pe": 0.05,           # PE 允许 5% 偏差
    "pb": 0.05,           # PB 允许 5% 偏差
    "price_pct": 0.02,    # 收盘价允许 2% 偏差
    "change_5d": 1.0,     # 5日涨幅允许 1 个百分点偏差
    "volume_ratio": 0.2,  # 量比允许 0.2 偏差
}


# ---------------------------------------------------------------------------
# 数据获取函数
# ---------------------------------------------------------------------------

def fetch_akshare_sector_info(code: str) -> Optional[dict]:
    """从 AKShare 获取板块基本信息。"""
    try:
        code_num = code.split(".")[0]
        spot_df = ak.sw_index_second_info()
        if spot_df is None or spot_df.empty:
            logger.warning("AKShare 返回空数据: code=%s", code)
            return None

        row = spot_df[spot_df["行业代码"] == code]
        if row.empty:
            logger.warning("AKShare 未找到板块: code=%s", code)
            return None

        row = row.iloc[0]
        return {
            "code": code,
            "name": str(row.get("行业名称", "")),
            "pe": float(row.get("静态市盈率", 0)) if pd.notna(row.get("静态市盈率")) else 0.0,
            "pb": float(row.get("市净率", 0)) if pd.notna(row.get("市净率")) else 0.0,
            "constituent_count": int(row.get("成份个数", 0)) if pd.notna(row.get("成份个数")) else 0,
        }
    except Exception as e:
        logger.error("获取 AKShare 板块信息失败: code=%s, error=%s", code, e)
        return None


def fetch_akshare_hist(code: str, days: int = 60) -> Optional[list]:
    """从 AKShare 获取板块日线数据。"""
    try:
        code_num = code.split(".")[0]
        hist = ak.index_hist_sw(symbol=code_num, period="day")
        if hist is None or len(hist) < 25:
            logger.warning("AKShare 日线数据不足: code=%s, rows=%s", code, 0 if hist is None else len(hist))
            return None

        # 取最近 N 天
        hist = hist.tail(days)
        result = []
        for _, row in hist.iterrows():
            result.append({
                "trade_date": str(row["日期"]),
                "close_price": float(row["收盘"]),
                "volume": float(row["成交量"]),
                "amount": float(row["成交额"]),
            })
        return result
    except Exception as e:
        logger.error("获取 AKShare 日线数据失败: code=%s, error=%s", code, e)
        return None


# ---------------------------------------------------------------------------
# 一致性校验
# ---------------------------------------------------------------------------

def check_consistency(
    code: str,
    name: str,
    cached_info: Optional[dict],
    akshare_info: Optional[dict],
    cached_hist: Optional[list],
    akshare_hist: Optional[list],
    cached_indicators: Optional[dict],
) -> dict:
    """校验缓存数据与 AKShare 数据的一致性。"""
    result = {
        "code": code,
        "name": name,
        "check_time": datetime.now().isoformat(),
        "overall_status": "PASS",
        "details": [],
    }

    # 1. 板块基本信息校验
    if cached_info and akshare_info:
        # PE 校验
        cached_pe = cached_info.get("pe_static", 0)
        akshare_pe = akshare_info.get("pe", 0)
        if akshare_pe > 0:
            pe_diff = abs(cached_pe - akshare_pe) / akshare_pe
            pe_status = "PASS" if pe_diff <= TOLERANCE["pe"] else "FAIL"
            result["details"].append({
                "field": "PE",
                "cached_value": cached_pe,
                "akshare_value": akshare_pe,
                "difference_pct": round(pe_diff * 100, 2),
                "status": pe_status,
            })
            if pe_status == "FAIL":
                result["overall_status"] = "FAIL"

        # PB 校验
        cached_pb = cached_info.get("pb", 0)
        akshare_pb = akshare_info.get("pb", 0)
        if akshare_pb > 0:
            pb_diff = abs(cached_pb - akshare_pb) / akshare_pb
            pb_status = "PASS" if pb_diff <= TOLERANCE["pb"] else "FAIL"
            result["details"].append({
                "field": "PB",
                "cached_value": cached_pb,
                "akshare_value": akshare_pb,
                "difference_pct": round(pb_diff * 100, 2),
                "status": pb_status,
            })
            if pb_status == "FAIL":
                result["overall_status"] = "FAIL"

        # 成份个数校验
        cached_count = cached_info.get("constituent_count", 0)
        akshare_count = akshare_info.get("constituent_count", 0)
        count_diff = abs(cached_count - akshare_count)
        count_status = "PASS" if count_diff <= 2 else "WARN"  # 允许 2 个成份股偏差
        result["details"].append({
            "field": "成份个数",
            "cached_value": cached_count,
            "akshare_value": akshare_count,
            "difference": count_diff,
            "status": count_status,
        })
        if count_status == "WARN" and result["overall_status"] == "PASS":
            result["overall_status"] = "WARN"

    elif not cached_info:
        result["details"].append({
            "field": "板块信息",
            "status": "SKIP",
            "message": "缓存无数据",
        })

    # 2. 日线数据校验（只校验最新一天）
    if cached_hist and akshare_hist:
        # 取最新一天
        latest_cached = cached_hist[-1]
        latest_akshare = akshare_hist[-1]

        # 日期校验
        if latest_cached["trade_date"] != latest_akshare["trade_date"]:
            result["details"].append({
                "field": "最新交易日",
                "cached_value": latest_cached["trade_date"],
                "akshare_value": latest_akshare["trade_date"],
                "status": "WARN",
                "message": "日期不一致",
            })
            if result["overall_status"] == "PASS":
                result["overall_status"] = "WARN"

        # 收盘价校验
        cached_price = latest_cached["close_price"]
        akshare_price = latest_akshare["close_price"]
        if akshare_price > 0:
            price_diff = abs(cached_price - akshare_price) / akshare_price
            price_status = "PASS" if price_diff <= TOLERANCE["price_pct"] else "FAIL"
            result["details"].append({
                "field": "最新收盘价",
                "cached_value": cached_price,
                "akshare_value": akshare_price,
                "difference_pct": round(price_diff * 100, 4),
                "status": price_status,
            })
            if price_status == "FAIL":
                result["overall_status"] = "FAIL"

        # 成交量校验
        cached_vol = latest_cached["volume"]
        akshare_vol = latest_akshare["volume"]
        if akshare_vol > 0:
            vol_diff = abs(cached_vol - akshare_vol) / akshare_vol
            vol_status = "PASS" if vol_diff <= 0.1 else "WARN"  # 允许 10% 成交量偏差
            result["details"].append({
                "field": "成交量",
                "cached_value": cached_vol,
                "akshare_value": akshare_vol,
                "difference_pct": round(vol_diff * 100, 2),
                "status": vol_status,
            })
            if vol_status in ("FAIL", "WARN") and result["overall_status"] == "PASS":
                result["overall_status"] = "WARN"

    elif not cached_hist:
        result["details"].append({
            "field": "日线数据",
            "status": "SKIP",
            "message": "缓存无数据",
        })

    # 3. 技术指标校验（从缓存数据计算 vs 直接从 AKShare 数据计算）
    if cached_indicators and akshare_hist and len(akshare_hist) >= 25:
        # 用 AKShare 数据重新计算技术指标
        closes = [r["close_price"] for r in akshare_hist]
        volumes = [r["volume"] for r in akshare_hist]

        # 5日涨幅
        change_5d_akshare = (
            (closes[-1] - closes[-6]) / closes[-6] * 100
            if len(closes) >= 6 and closes[-6] != 0 else 0.0
        )
        cached_change_5d = cached_indicators.get("change_5d", 0)
        change_diff = abs(cached_change_5d - change_5d_akshare)
        change_status = "PASS" if change_diff <= TOLERANCE["change_5d"] else "FAIL"
        result["details"].append({
            "field": "5日涨幅",
            "cached_value": round(cached_change_5d, 4),
            "akshare_value": round(change_5d_akshare, 4),
            "difference": round(change_diff, 4),
            "status": change_status,
        })
        if change_status == "FAIL":
            result["overall_status"] = "FAIL"

        # 量比
        if len(volumes) >= 25:
            recent_vol = sum(volumes[-5:]) / 5
            prior_vol = sum(volumes[-25:-5]) / 20
            vol_ratio_akshare = recent_vol / prior_vol if prior_vol > 0 else 1.0
            cached_vol_ratio = cached_indicators.get("vol_ratio", 1.0)
            vol_ratio_diff = abs(cached_vol_ratio - vol_ratio_akshare)
            vol_ratio_status = "PASS" if vol_ratio_diff <= TOLERANCE["volume_ratio"] else "FAIL"
            result["details"].append({
                "field": "量比",
                "cached_value": round(cached_vol_ratio, 4),
                "akshare_value": round(vol_ratio_akshare, 4),
                "difference": round(vol_ratio_diff, 4),
                "status": vol_ratio_status,
            })
            if vol_ratio_status == "FAIL":
                result["overall_status"] = "FAIL"

    return result


# ---------------------------------------------------------------------------
# 主校验流程
# ---------------------------------------------------------------------------

def verify_sector(code: str, name: str) -> dict:
    """校验单个板块的缓存数据一致性。"""
    logger.info("=" * 60)
    logger.info("开始校验板块: %s (%s)", name, code)
    logger.info("=" * 60)

    # 1. 获取缓存数据
    t0 = time.perf_counter()
    cached_info = None
    cached_hist = None
    cached_indicators = None

    try:
        all_sectors = get_sector_info()
        for s in all_sectors:
            if s["sector_code"] == code:
                cached_info = s
                break
    except Exception as e:
        logger.warning("读取缓存板块信息失败: %s", e)

    try:
        cached_hist = get_hist_for_sector(code, days=60)
    except Exception as e:
        logger.warning("读取缓存日线数据失败: %s", e)

    try:
        cached_indicators = compute_technical_indicators(code)
    except Exception as e:
        logger.warning("读取缓存技术指标失败: %s", e)

    cache_elapsed = (time.perf_counter() - t0) * 1000
    logger.info("缓存读取耗时: %.1fms", cache_elapsed)

    # 2. 获取 AKShare 实时数据
    t1 = time.perf_counter()
    akshare_info = fetch_akshare_sector_info(code)
    akshare_hist = fetch_akshare_hist(code, days=60)
    akshare_elapsed = (time.perf_counter() - t1) * 1000
    logger.info("AKShare 拉取耗时: %.1fms", akshare_elapsed)

    # 3. 执行一致性校验
    result = check_consistency(
        code=code,
        name=name,
        cached_info=cached_info,
        akshare_info=akshare_info,
        cached_hist=cached_hist,
        akshare_hist=akshare_hist,
        cached_indicators=cached_indicators,
    )

    # 4. 输出结果
    status_icon = {"PASS": "✅", "WARN": "⚠️", "FAIL": "❌"}.get(
        result["overall_status"], "❓"
    )
    logger.info(
        "校验结果: %s %s (缓存 %.1fms vs AKShare %.1fms)",
        status_icon, result["overall_status"], cache_elapsed, akshare_elapsed
    )

    for detail in result["details"]:
        icon = {"PASS": "✅", "WARN": "⚠️", "FAIL": "❌", "SKIP": "⏭️"}.get(
            detail["status"], "❓"
        )
        logger.info(
            "  %s %s: 缓存=%s, AKShare=%s, 差异=%s, 状态=%s",
            icon, detail["field"],
            detail.get("cached_value", "N/A"),
            detail.get("akshare_value", "N/A"),
            detail.get("difference_pct", detail.get("difference", "N/A")),
            detail["status"],
        )

    return result


def generate_report(results: list[dict]) -> str:
    """生成校验报告。"""
    report = {
        "report_time": datetime.now().isoformat(),
        "summary": {
            "total_sectors": len(results),
            "pass_count": sum(1 for r in results if r["overall_status"] == "PASS"),
            "warn_count": sum(1 for r in results if r["overall_status"] == "WARN"),
            "fail_count": sum(1 for r in results if r["overall_status"] == "FAIL"),
            "skip_count": sum(1 for r in results if r["overall_status"] == "SKIP"),
        },
        "results": results,
        "cache_stats": get_cache_stats(),
        "thresholds": TOLERANCE,
    }

    return json.dumps(report, ensure_ascii=False, indent=2)


def main():
    parser = argparse.ArgumentParser(
        description="校验缓存数据与 AKShare 实时数据的一致性"
    )
    parser.add_argument(
        "--sectors",
        type=str,
        default=None,
        help="指定校验的板块代码，用逗号分隔 (如: 801072.SI,801081.SI)",
    )
    parser.add_argument(
        "--full",
        action="store_true",
        help="校验全量板块（从 AKShare 获取列表）",
    )
    parser.add_argument(
        "--cached-only",
        action="store_true",
        help="仅校验已缓存的板块（推荐，快速验证）",
    )
    parser.add_argument(
        "--top-n",
        type=int,
        default=50,
        help="校验 TOP N 板块 (默认: 50，配合 --full 使用)",
    )
    parser.add_argument(
        "--output",
        type=str,
        default=None,
        help="输出报告文件路径",
    )
    args = parser.parse_args()

    # 确定要校验的板块列表
    sectors_to_check = DEFAULT_SECTORS

    if args.sectors:
        codes = [c.strip() for c in args.sectors.split(",")]
        sectors_to_check = [
            {"code": c, "name": c} for c in codes  # 名称将在后续校验中从 AKShare 获取
        ]
    elif args.cached_only:
        # 仅校验已缓存的板块
        logger.info("获取已缓存的板块列表...")
        try:
            cached_sectors = get_sector_info()
            if cached_sectors:
                sectors_to_check = [
                    {"code": s["sector_code"], "name": s["sector_name"]}
                    for s in cached_sectors
                ]
                logger.info("已缓存板块数量: %d", len(sectors_to_check))
            else:
                logger.error("缓存中无板块数据，请先运行预热脚本")
                sys.exit(1)
        except Exception as e:
            logger.error("获取缓存板块列表失败: %s", e)
            sys.exit(1)
    elif args.full:
        logger.info("获取全量板块列表 (TOP %d)...", args.top_n)
        try:
            spot_df = ak.sw_index_second_info()
            if spot_df is not None and not spot_df.empty:
                # 按成份股数量排序取 TOP N
                spot_df = spot_df.sort_values("成份个数", ascending=False).head(args.top_n)
                sectors_to_check = [
                    {"code": str(row["行业代码"]), "name": str(row["行业名称"])}
                    for _, row in spot_df.iterrows()
                ]
                logger.info("TOP %d 板块数量: %d", args.top_n, len(sectors_to_check))
            else:
                logger.error("无法获取板块列表")
                sys.exit(1)
        except Exception as e:
            logger.error("获取板块列表失败: %s", e)
            sys.exit(1)

    # 执行校验
    results = []
    for sector in sectors_to_check:
        try:
            result = verify_sector(sector["code"], sector["name"])
            results.append(result)
        except Exception as e:
            logger.error("校验板块 %s 失败: %s", sector["code"], e)
            results.append({
                "code": sector["code"],
                "name": sector["name"],
                "overall_status": "ERROR",
                "details": [{"status": "ERROR", "message": str(e)}],
            })

    # 生成报告
    report_json = generate_report(results)

    # 输出报告
    print("\n" + "=" * 60)
    print("缓存数据一致性校验报告")
    print("=" * 60)

    report_data = json.loads(report_json)
    summary = report_data["summary"]
    print(f"\n总板块数: {summary['total_sectors']}")
    print(f"✅ 通过: {summary['pass_count']}")
    print(f"⚠️  警告: {summary['warn_count']}")
    print(f"❌ 失败: {summary['fail_count']}")
    print(f"⏭️  跳过: {summary['skip_count']}")

    if summary["fail_count"] > 0:
        print("\n失败板块:")
        for r in results:
            if r["overall_status"] == "FAIL":
                print(f"  ❌ {r['name']} ({r['code']})")
                for d in r["details"]:
                    if d["status"] == "FAIL":
                        print(f"      - {d['field']}: 缓存={d.get('cached_value')}, AKShare={d.get('akshare_value')}")

    print(f"\n缓存统计:")
    cache_stats = report_data.get("cache_stats", {})
    for k, v in cache_stats.items():
        if isinstance(v, dict):
            print(f"  {k}: {v}")
        else:
            print(f"  {k}: {v}")

    # 保存报告
    if args.output:
        output_path = args.output
    else:
        output_dir = Path(__file__).resolve().parent.parent.parent / "outputs"
        output_dir.mkdir(parents=True, exist_ok=True)
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        output_path = output_dir / f"cache_consistency_report_{timestamp}.json"

    with open(output_path, "w", encoding="utf-8") as f:
        f.write(report_json)
    print(f"\n报告已保存: {output_path}")

    # 返回退出码
    if summary["fail_count"] > 0:
        sys.exit(1)
    elif summary["warn_count"] > 0:
        sys.exit(0)
    else:
        sys.exit(0)


if __name__ == "__main__":
    main()
