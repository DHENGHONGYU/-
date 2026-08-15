"""
全量板块数据预热脚本

将 50 个申万二级行业板块的基本信息和日线数据写入 SQLite 缓存。

用法:
    python _warmup_all_sectors.py                      # 预热 TOP 50 板块
    python _warmup_all_sectors.py --count 20           # 预热指定数量
    python _warmup_all_sectors.py --sectors 801072,801081  # 预热指定板块
    python _warmup_all_sectors.py --resume             # 断点续传
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
logger = logging.getLogger("warmup-sectors")

sys.path.insert(0, str(Path(__file__).resolve().parent))

import akshare as ak
import pandas as pd
from _sector_cache_db import upsert_sector_info, upsert_hist_daily, get_cache_stats


# ---------------------------------------------------------------------------
# 配置
# ---------------------------------------------------------------------------

DEFAULT_COUNT = 50          # 默认预热 50 个板块
REQUEST_INTERVAL = 2.0      # AKShare 请求间隔（秒）
BATCH_SIZE = 5              # 每批处理板块数
RETRY_MAX = 3               # 最大重试次数
HISTORY_DAYS = 60           # 日线历史天数

PROGRESS_FILE = Path(__file__).resolve().parent.parent.parent / "outputs" / "warmup_progress.json"


# ---------------------------------------------------------------------------
# 进度管理
# ---------------------------------------------------------------------------

def load_progress() -> dict:
    """加载进度（用于断点续传）。"""
    if PROGRESS_FILE.exists():
        try:
            with open(PROGRESS_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            pass
    return {"completed": [], "failed": [], "last_update": None}


def save_progress(progress: dict):
    """保存进度。"""
    progress["last_update"] = datetime.now().isoformat()
    PROGRESS_FILE.parent.mkdir(parents=True, exist_ok=True)
    with open(PROGRESS_FILE, "w", encoding="utf-8") as f:
        json.dump(progress, f, ensure_ascii=False, indent=2)


# ---------------------------------------------------------------------------
# 数据获取
# ---------------------------------------------------------------------------

def fetch_all_sector_list() -> Optional[pd.DataFrame]:
    """获取全量申万二级行业板块列表。"""
    try:
        logger.info("获取板块列表...")
        spot_df = ak.sw_index_second_info()
        if spot_df is None or spot_df.empty:
            logger.error("AKShare 返回空数据")
            return None
        logger.info("获取到 %d 个板块", len(spot_df))
        return spot_df
    except Exception as e:
        logger.error("获取板块列表失败: %s", e)
        return None


def fetch_sector_hist(code_num: str, days: int = 60) -> Optional[list[dict]]:
    """获取单个板块的日线数据。"""
    try:
        hist = ak.index_hist_sw(symbol=code_num, period="day")
        if hist is None or len(hist) < 25:
            return None

        # 取最近 N 天
        hist = hist.tail(days)
        result = []
        for _, row in hist.iterrows():
            result.append({
                "date": str(row["日期"]),
                "open": float(row.get("开盘", 0)) if pd.notna(row.get("开盘")) else 0,
                "close": float(row["收盘"]),
                "high": float(row.get("最高", 0)) if pd.notna(row.get("最高")) else 0,
                "low": float(row.get("最低", 0)) if pd.notna(row.get("最低")) else 0,
                "volume": float(row["成交量"]),
                "amount": float(row["成交额"]),
                "amplitude": float(row.get("振幅", 0)) if pd.notna(row.get("振幅")) else 0,
                "change_pct": float(row.get("涨跌幅", 0)) if pd.notna(row.get("涨跌幅")) else 0,
                "turnover": float(row.get("换手率", 0)) if pd.notna(row.get("换手率")) else 0,
            })
        return result
    except Exception as e:
        logger.debug("获取日线失败 code=%s: %s", code_num, e)
        return None


# ---------------------------------------------------------------------------
# 预热执行
# ---------------------------------------------------------------------------

def warmup_sectors(
    count: int = DEFAULT_COUNT,
    sector_codes: Optional[list[str]] = None,
    resume: bool = False,
    skip_hist: bool = False,
):
    """
    预热板块数据到 SQLite 缓存。

    Args:
        count: 预热板块数量
        sector_codes: 指定板块代码列表（可选）
        resume: 是否断点续传
        skip_hist: 是否跳过日线数据（仅预热基本信息）
    """
    logger.info("=" * 60)
    logger.info("全量板块数据预热")
    logger.info("=" * 60)

    # 加载进度
    progress = load_progress() if resume else {"completed": [], "failed": [], "last_update": None}
    completed_codes = set(progress["completed"]) if resume else set()

    # 获取板块列表
    if sector_codes:
        spot_df = fetch_all_sector_list()
        if spot_df is None:
            sys.exit(1)
        # 过滤指定板块
        target_df = spot_df[spot_df["行业代码"].isin(sector_codes)]
        if target_df.empty:
            logger.error("未找到指定板块: %s", sector_codes)
            sys.exit(1)
    else:
        spot_df = fetch_all_sector_list()
        if spot_df is None:
            sys.exit(1)
        # 按成份股数量排序取 TOP N
        target_df = spot_df.sort_values("成份个数", ascending=False).head(count)

    logger.info("目标板块数: %d", len(target_df))
    if resume and completed_codes:
        logger.info("已完成: %d 个，剩余: %d 个", len(completed_codes), len(target_df) - len(completed_codes))

    # 预热板块基本信息（一次性）
    logger.info("\n[Phase 1] 预热板块基本信息...")
    info_rows = []
    for _, row in target_df.iterrows():
        code = str(row["行业代码"])
        info_rows.append({
            "code": code,
            "code_num": code.split(".")[0],
            "name": str(row["行业名称"]),
            "level1": str(row.get("上级行业", "")) if pd.notna(row.get("上级行业")) else "",
            "level2": str(row.get("二级行业", "")) if pd.notna(row.get("二级行业")) else "",
            "level3": str(row.get("三级行业", "")) if pd.notna(row.get("三级行业")) else "",
            "constituent_count": int(row["成份个数"]) if pd.notna(row.get("成份个数")) else 0,
            "pe": float(row["静态市盈率"]) if pd.notna(row.get("静态市盈率")) else 0.0,
            "pb": float(row["市净率"]) if pd.notna(row.get("市净率")) else 0.0,
            "total_market_cap": float(row.get("总市值", 0)) if pd.notna(row.get("总市值")) else 0.0,
            "float_market_cap": float(row.get("流通市值", 0)) if pd.notna(row.get("流通市值")) else 0.0,
            "turnover_rate": float(row.get("换手率", 0)) if pd.notna(row.get("换手率")) else 0.0,
            "pe_percentile": 0.0,
            "pb_percentile": 0.0,
            "info_updated_at": datetime.now().isoformat(),
            "data_version": "v1",
        })

    info_count = upsert_sector_info(info_rows)
    logger.info("板块基本信息写入: %d 条", info_count)

    # 预热日线数据（分批，限速）
    if not skip_hist:
        logger.info("\n[Phase 2] 预热日线行情数据...")
        hist_success = 0
        hist_failed = 0
        total_elapsed = 0

        for idx, (_, row) in enumerate(target_df.iterrows(), 1):
            code = str(row["行业代码"])
            code_num = code.split(".")[0]
            name = str(row["行业名称"])

            # 断点续传：跳过已完成的
            if resume and code in completed_codes:
                logger.info("  [%d/%d] 跳过 (已完成): %s %s", idx, len(target_df), code, name)
                continue

            t0 = time.perf_counter()
            success = False

            for attempt in range(RETRY_MAX):
                try:
                    logger.info("  [%d/%d] 拉取: %s %s (尝试 %d/%d)",
                                idx, len(target_df), code, name, attempt + 1, RETRY_MAX)

                    hist_data = fetch_sector_hist(code_num, HISTORY_DAYS)

                    if hist_data and len(hist_data) >= 25:
                        written = upsert_hist_daily(code, hist_data)
                        if written > 0:
                            elapsed = (time.perf_counter() - t0) * 1000
                            total_elapsed += elapsed
                            hist_success += 1
                            success = True
                            logger.info("    ✅ 成功: %d 条, 耗时 %.0fms", written, elapsed)

                            # 保存进度
                            progress["completed"].append(code)
                            save_progress(progress)
                            break
                        else:
                            logger.warning("    ⚠️ 写入失败")
                    else:
                        logger.warning("    ⚠️ 数据不足: %s", "无数据" if hist_data is None else f"{len(hist_data)} 条")

                except Exception as e:
                    logger.error("    ❌ 异常: %s", e)

                if attempt < RETRY_MAX - 1:
                    wait = REQUEST_INTERVAL * (2 ** attempt)  # 指数退避
                    time.sleep(wait)

            if not success:
                hist_failed += 1
                progress["failed"].append({
                    "code": code,
                    "name": name,
                    "error": "获取或写入失败",
                    "time": datetime.now().isoformat(),
                })
                save_progress(progress)

            # 请求间隔（限速）
            time.sleep(REQUEST_INTERVAL)

        # 汇总
        avg_elapsed = total_elapsed / max(hist_success, 1)
        logger.info("\n" + "=" * 60)
        logger.info("预热完成!")
        logger.info("  成功: %d 个板块", hist_success)
        logger.info("  失败: %d 个板块", hist_failed)
        logger.info("  平均耗时: %.0fms/板块", avg_elapsed)
        logger.info("  预计总耗时: %.1fs", total_elapsed / 1000)

    # 输出缓存统计
    logger.info("\n[缓存统计]")
    stats = get_cache_stats()
    for k, v in stats.items():
        if isinstance(v, dict):
            logger.info("  %s: %d 条", k, sum(v.values()) if v else 0)
        else:
            logger.info("  %s: %s", k, v)

    return progress


# ---------------------------------------------------------------------------
# 主函数
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(description="全量板块数据预热")
    parser.add_argument("--count", type=int, default=DEFAULT_COUNT,
                        help=f"预热板块数量 (默认: {DEFAULT_COUNT})")
    parser.add_argument("--sectors", type=str, default=None,
                        help="指定板块代码，逗号分隔 (如: 801072.SI,801081.SI)")
    parser.add_argument("--resume", action="store_true",
                        help="断点续传（从上次中断处继续）")
    parser.add_argument("--skip-hist", action="store_true",
                        help="跳过日线数据预热（仅预热基本信息）")
    parser.add_argument("--skip-progress", action="store_true",
                        help="忽略进度文件，从头开始")
    args = parser.parse_args()

    # 解析指定板块
    sector_codes = None
    if args.sectors:
        sector_codes = [c.strip() for c in args.sectors.split(",")]
        # 规范化代码格式
        sector_codes = [c if "." in c else f"{c}.SI" for c in sector_codes]

    if args.skip_progress and PROGRESS_FILE.exists():
        PROGRESS_FILE.unlink()
        logger.info("已删除进度文件，从头开始")

    progress = warmup_sectors(
        count=args.count,
        sector_codes=sector_codes,
        resume=args.resume,
        skip_hist=args.skip_hist,
    )

    # 生成报告
    report = {
        "report_time": datetime.now().isoformat(),
        "target_count": args.count,
        "completed_count": len(progress.get("completed", [])),
        "failed_count": len(progress.get("failed", [])),
        "completed": progress.get("completed", []),
        "failed": progress.get("failed", []),
        "cache_stats": get_cache_stats(),
    }

    output_dir = Path(__file__).resolve().parent.parent.parent / "outputs"
    output_dir.mkdir(parents=True, exist_ok=True)
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    output_path = output_dir / f"warmup_report_{timestamp}.json"

    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(report, f, ensure_ascii=False, indent=2)

    logger.info("\n预热报告已保存: %s", output_path)

    if progress.get("failed"):
        logger.warning("有 %d 个板块预热失败，可查看报告详情", len(progress["failed"]))
        sys.exit(1)


if __name__ == "__main__":
    main()
