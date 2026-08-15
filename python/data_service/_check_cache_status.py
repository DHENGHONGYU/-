"""检查当前缓存状态"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from _sector_cache_db import get_cache_stats, get_sector_info, get_hist_for_sector

def main():
    print("=" * 60)
    print("当前缓存状态检查")
    print("=" * 60)

    stats = get_cache_stats()
    print("\n缓存统计:")
    for k, v in stats.items():
        if isinstance(v, dict):
            print(f"  {k}:")
            for sk, sv in v.items():
                print(f"    {sk}: {sv}")
        else:
            print(f"  {k}: {v}")

    sectors = get_sector_info()
    print(f"\n已缓存板块数: {len(sectors)}")
    if sectors:
        print("\n板块列表:")
        for s in sectors:
            hist_count = 0
            try:
                hist = get_hist_for_sector(s["sector_code"], days=5)
                hist_count = len(hist) if hist else 0
            except:
                pass
            print(f"  {s['sector_code']} {s['sector_name']} (日线: {hist_count} 条)")

if __name__ == "__main__":
    main()
