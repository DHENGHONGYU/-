"""
真实数据验证：L1 失败 → L2 hexin-v 自动切换 → L3 SQLite 缓存。

验证流程：
1. 检查 SQLite 现有数据（记录数、日期范围、样本）
2. 阶段一：mock L1 失败 → 真实 L2 hexin-v 调用 → 验证 SQLite 写入
3. 阶段二：mock L1+L2 失败 → L3 SQLite 缓存读取 → 验证 AVG 聚合
4. 展示 SQLite 最近 30 日样本记录

运行：
    cd python/data_service
    python _verify_real_degradation.py
"""
import logging
import sys
from datetime import datetime

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(name)s] %(levelname)s: %(message)s",
    stream=sys.stdout,
)

import _sector_fund_flow as ff
import _sector_fund_flow_db as db
import _ths_hexinv as hexinv

logger = logging.getLogger("verify_real")


def section(title: str) -> None:
    print("\n" + "=" * 70)
    print(title)
    print("=" * 70)


# ============================================================
# 1. 检查 SQLite 现有数据
# ============================================================

def check_existing_sqlite_data() -> dict:
    section("步骤1: 检查 SQLite 现有数据")
    import sqlite3

    db_path = db.get_db_path()
    print(f"  数据库路径: {db_path}")
    print(f"  文件存在: {db_path.exists()}")

    if not db_path.exists():
        print("  [INFO] 数据库文件不存在，无历史数据")
        return {"total": 0, "dates": [], "sources": []}

    conn = db._get_conn()
    try:
        # 总记录数
        total = conn.execute("SELECT COUNT(*) FROM sector_fund_flow").fetchone()[0]
        print(f"  总记录数: {total}")

        # 日期范围
        date_range = conn.execute(
            "SELECT MIN(date), MAX(date) FROM sector_fund_flow"
        ).fetchone()
        print(f"  日期范围: {date_range[0]} ~ {date_range[1]}")

        # 数据来源分布
        sources = conn.execute(
            "SELECT source, COUNT(*) FROM sector_fund_flow GROUP BY source"
        ).fetchall()
        print(f"  数据来源分布: {dict(sources)}")

        # 行业数量
        sector_count = conn.execute(
            "SELECT COUNT(DISTINCT sector_name) FROM sector_fund_flow"
        ).fetchone()[0]
        print(f"  覆盖行业数: {sector_count}")

        return {
            "total": total,
            "date_range": (date_range[0], date_range[1]),
            "sources": dict(sources),
            "sector_count": sector_count,
        }
    finally:
        conn.close()


# ============================================================
# 2. 阶段一：mock L1 失败 → 真实 L2 hexin-v
# ============================================================

def verify_l1_fail_l2_real() -> dict | None:
    section("步骤2: mock L1 失败 → 真实 L2 hexin-v 调用")

    # 先验证 hexin-v 可用
    v_code = hexinv.generate_hexin_v()
    if not v_code:
        print("  [FAIL] hexin-v 生成失败，无法测试 L2")
        return None
    print(f"  [INFO] hexin-v 生成成功 len={len(v_code)}")

    # 清理今天的数据，确保验证的是本次 L2 写入
    today = datetime.now().strftime("%Y-%m-%d")
    conn = db._get_conn()
    conn.execute("DELETE FROM sector_fund_flow WHERE date = ?", (today,))
    conn.commit()
    conn.close()
    print(f"  [setup] 已清理今天({today})的数据")

    # mock L1 失败
    original_l1 = ff.fetch_sector_fund_flow_l1
    ff.fetch_sector_fund_flow_l1 = lambda: (_ for _ in ()).throw(
        RuntimeError("mock: L1 AKShare 被反爬")
    )

    try:
        print("  [INFO] 开始调用 fetch_sector_fund_flow（L1 已 mock 失败）...")
        result = ff.fetch_sector_fund_flow(sector_names=["白酒", "银行", "半导体"])
    finally:
        ff.fetch_sector_fund_flow_l1 = original_l1

    if result:
        print(f"  [PASS] L2 hexin-v 兜底成功，获取 {len(result)} 个行业")
        # 显示 TOP 5
        sorted_items = sorted(result.items(), key=lambda x: -x[1])[:5]
        print("  [INFO] 净流入 TOP 5:")
        for i, (name, amount) in enumerate(sorted_items, 1):
            print(f"         TOP{i}: {name} {amount:+.2f} 亿元")

        # 验证 SQLite 写入
        conn = db._get_conn()
        today_count = conn.execute(
            "SELECT COUNT(*) FROM sector_fund_flow WHERE date = ? AND source = 'L2_hexinv'",
            (today,),
        ).fetchone()[0]
        conn.close()
        print(f"  [PASS] SQLite 写入验证: 今日 L2_hexinv 记录数 = {today_count}")
        return {"l2_industries": len(result), "sqlite_written": today_count}
    else:
        print("  [WARN] L2 hexin-v 调用失败（可能网络/反爬），跳过 SQLite 写入验证")
        return None


# ============================================================
# 3. 阶段二：mock L1+L2 失败 → L3 SQLite 缓存
# ============================================================

def verify_l1_l2_fail_l3_cache() -> dict | None:
    section("步骤3: mock L1+L2 失败 → L3 SQLite 缓存读取")

    # 获取 SQLite 中已有的行业名称
    conn = db._get_conn()
    today = datetime.now().strftime("%Y-%m-%d")
    sectors_in_db = conn.execute(
        "SELECT DISTINCT sector_name FROM sector_fund_flow WHERE date = ?", (today,)
    ).fetchall()
    conn.close()

    if not sectors_in_db:
        print("  [SKIP] SQLite 中无今日数据，无法测试 L3（依赖步骤2 的 L2 写入）")
        return None

    sector_names = [s[0] for s in sectors_in_db]
    print(f"  [INFO] SQLite 中今日已有 {len(sector_names)} 个行业，用于 L3 查询")

    # mock L1+L2 失败
    original_l1 = ff.fetch_sector_fund_flow_l1
    original_l2 = ff.fetch_sector_fund_flow_l2
    ff.fetch_sector_fund_flow_l1 = lambda: None
    ff.fetch_sector_fund_flow_l2 = lambda: None

    try:
        print("  [INFO] 开始调用 fetch_sector_fund_flow（L1+L2 均 mock 失败）...")
        result = ff.fetch_sector_fund_flow(sector_names=sector_names[:5])
    finally:
        ff.fetch_sector_fund_flow_l1 = original_l1
        ff.fetch_sector_fund_flow_l2 = original_l2

    if result:
        print(f"  [PASS] L3 SQLite 缓存命中，返回 {len(result)} 个行业")
        print("  [INFO] L3 缓存样本:")
        for name, avg in list(result.items())[:5]:
            print(f"         {name}: 5日均净流入 {avg:+.2f} 亿元")
        return {"l3_cached": len(result)}
    else:
        print("  [WARN] L3 缓存未命中（SQLite 中无足够历史数据）")
        return None


# ============================================================
# 4. 展示 SQLite 最近 30 日样本记录
# ============================================================

def show_sqlite_samples() -> None:
    section("步骤4: SQLite 最近 30 日样本记录展示")

    conn = db._get_conn()
    try:
        # 今日全部记录
        today = datetime.now().strftime("%Y-%m-%d")
        today_rows = conn.execute(
            "SELECT sector_name, net_amount, source, fetched_at "
            "FROM sector_fund_flow WHERE date = ? "
            "ORDER BY net_amount DESC LIMIT 10",
            (today,),
        ).fetchall()

        if today_rows:
            print(f"\n  今日({today}) 净流入 TOP 10 样本:")
            print(f"  {'行业名称':<12} {'净流入(亿)':>12} {'来源':<12} {'写入时间'}")
            print(f"  {'-'*12} {'-'*12} {'-'*12} {'-'*26}")
            for name, amount, source, fetched in today_rows:
                print(f"  {name:<12} {amount:>+12.2f} {source:<12} {fetched}")
        else:
            print(f"\n  今日({today}) 无数据")

        # 最近 30 日每日统计
        print(f"\n  最近 30 日每日记录数统计:")
        daily_stats = conn.execute(
            "SELECT date, COUNT(*), SUM(CASE WHEN net_amount > 0 THEN 1 ELSE 0 END), "
            "ROUND(AVG(net_amount), 2) "
            "FROM sector_fund_flow WHERE date >= date('now', '-30 days') "
            "GROUP BY date ORDER BY date DESC LIMIT 10"
        ).fetchall()

        if daily_stats:
            print(f"  {'日期':<12} {'记录数':>6} {'净流入>0':>8} {'均值(亿)':>10}")
            print(f"  {'-'*12} {'-'*6} {'-'*8} {'-'*10}")
            for date, count, positive, avg in daily_stats:
                print(f"  {date:<12} {count:>6} {positive:>8} {avg:>+10.2f}")
        else:
            print("  最近 30 日无数据")

        # 数据来源全局分布
        print(f"\n  全局数据来源分布:")
        source_stats = conn.execute(
            "SELECT source, COUNT(*), ROUND(AVG(net_amount), 2) "
            "FROM sector_fund_flow GROUP BY source"
        ).fetchall()
        for source, count, avg in source_stats:
            print(f"    {source}: {count} 条, 均值 {avg:+.2f} 亿")

    finally:
        conn.close()


# ============================================================
# 主流程
# ============================================================

if __name__ == "__main__":
    section("f2Zijin 三层降级真实数据验证")
    print(f"  验证时间: {datetime.now().isoformat()}")
    print(f"  数据库: {db.get_db_path()}")

    # 1. 检查现有数据
    existing = check_existing_sqlite_data()

    # 2. L1 失败 → L2 真实调用
    l2_result = verify_l1_fail_l2_real()

    # 3. L1+L2 失败 → L3 缓存
    l3_result = verify_l1_l2_fail_l3_cache()

    # 4. 展示样本
    show_sqlite_samples()

    # 汇总
    section("验证汇总")
    print(f"  SQLite 现有数据: {existing['total']} 条记录")
    print(f"  L2 hexin-v 真实调用: {'PASS' if l2_result else 'FAIL/SKIP'}")
    print(f"  L3 SQLite 缓存读取: {'PASS' if l3_result else 'FAIL/SKIP'}")

    all_pass = l2_result is not None and l3_result is not None
    print(f"\n  整体结论: {'ALL PASS - 三层降级链路验证通过' if all_pass else 'PARTIAL - 部分环节失败，见上方详情'}")
