"""检查日线数据缓存"""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from _sector_cache_db import get_cache_stats, get_sector_info, get_hist_for_sector

def main():
    stats = get_cache_stats()
    print("缓存统计:")
    print(f"  sector_info: {stats.get('sector_info', 0)} 条")
    print(f"  sector_hist_daily: {stats.get('sector_hist_daily', 0)} 条")

    hist_by_sector = stats.get('hist_by_sector', {})
    print(f"\n有日线的板块数: {len(hist_by_sector)}")
    if hist_by_sector:
        print("日线详情:")
        for k, v in sorted(hist_by_sector.items()):
            print(f"  {k}: {v} 条")

    # 检查板块代码格式
    sectors = get_sector_info()
    if sectors:
        print(f"\n板块代码格式检查 (前5个):")
        for s in sectors[:5]:
            code = s['sector_code']
            hist = get_hist_for_sector(code, days=5)
            hist_count = len(hist) if hist else 0
            print(f"  {code}: 日线 {hist_count} 条")

        # 检查几个典型板块
        test_codes = ['801072.SI', '801081.SI', '801151.SI', '801737.SI']
        print(f"\n典型板块日线检查:")
        for code in test_codes:
            hist = get_hist_for_sector(code, days=60)
            hist_count = len(hist) if hist else 0
            print(f"  {code}: {hist_count} 条")

if __name__ == "__main__":
    main()
