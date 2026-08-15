"""脚本：获取通用设备和半导体板块的实际数据，用于生成 SQL 初始化数据"""
import akshare as ak
import json
from datetime import datetime, timedelta
from pathlib import Path

output_dir = Path(__file__).resolve().parent.parent.parent / "outputs"
output_dir.mkdir(parents=True, exist_ok=True)

target_sectors = ["801072", "801081"]
results = {}

# 1. 获取板块基本信息
print("=== 拉取板块基本信息 ===")
spot_df = ak.sw_index_second_info()
for code in target_sectors:
    row = spot_df[spot_df["行业代码"].str.startswith(code)]
    if not row.empty:
        r = row.iloc[0]
        sector_info = {
            "code": str(r["行业代码"]),
            "code_num": code,
            "name": str(r["行业名称"]),
            "level1": str(r.get("上级行业", "")),
            "level2": str(r.get("二级行业", "")),
            "level3": str(r.get("三级行业", "")),
            "constituent_count": int(r.get("成份个数", 0)) if hasattr(r.get("成份个数"), '__int__') else 0,
            "pe": float(r.get("静态市盈率", 0)) if hasattr(r.get("静态市盈率"), '__float__') else 0.0,
            "pb": float(r.get("市净率", 0)) if hasattr(r.get("市净率"), '__float__') else 0.0,
            "total_market_cap": float(r.get("总市值", 0)) if hasattr(r.get("总市值"), '__float__') else 0.0,
            "float_market_cap": float(r.get("流通市值", 0)) if hasattr(r.get("流通市值"), '__float__') else 0.0,
            "turnover_rate": float(r.get("换手率", 0)) if hasattr(r.get("换手率"), '__float__') else 0.0,
            "updated_at": datetime.now().isoformat(),
        }
        results[code] = {"info": sector_info, "hist": []}
        print(f"  {code}.SI {sector_info['name']}: PE={sector_info['pe']} PB={sector_info['pb']} 成份={sector_info['constituent_count']}")

# 2. 获取板块日线数据（最近 60 个交易日）
print("\n=== 拉取板块日线数据 ===")
for code in target_sectors:
    try:
        hist = ak.index_hist_sw(symbol=code, period="day")
        if hist is not None and len(hist) > 0:
            # 取最近 60 天
            recent = hist.tail(60).copy()
            hist_rows = []
            for _, r in recent.iterrows():
                hist_rows.append({
                    "date": str(r["日期"]),
                    "open": float(r["开盘"]) if hasattr(r["开盘"], '__float__') else 0.0,
                    "close": float(r["收盘"]) if hasattr(r["收盘"], '__float__') else 0.0,
                    "high": float(r["最高"]) if hasattr(r["最高"], '__float__') else 0.0,
                    "low": float(r["最低"]) if hasattr(r["最低"], '__float__') else 0.0,
                    "volume": float(r["成交量"]) if hasattr(r["成交量"], '__float__') else 0.0,
                    "amount": float(r["成交额"]) if hasattr(r["成交额"], '__float__') else 0.0,
                    "amplitude": float(r.get("振幅", 0)) if hasattr(r.get("振幅"), '__float__') else 0.0,
                    "change_pct": float(r.get("涨跌幅", 0)) if hasattr(r.get("涨跌幅"), '__float__') else 0.0,
                    "turnover": float(r.get("换手率", 0)) if hasattr(r.get("换手率"), '__float__') else 0.0,
                })
            results[code]["hist"] = hist_rows
            print(f"  {code}.SI: {len(hist_rows)} 条日线数据 ({hist_rows[0]['date']} ~ {hist_rows[-1]['date']})")
    except Exception as e:
        print(f"  {code}.SI 拉取失败: {e}")

# 3. 计算技术指标
print("\n=== 计算技术指标 ===")
for code in target_sectors:
    hist_data = results[code]["hist"]
    if len(hist_data) < 25:
        print(f"  {code}.SI: 数据不足，跳过技术指标计算")
        continue

    closes = [r["close"] for r in hist_data]
    volumes = [r["volume"] for r in hist_data]
    amounts = [r["amount"] for r in hist_data]

    # f1Jingqi: 近5日涨幅
    change_5d = (closes[-1] - closes[-6]) / closes[-6] * 100 if len(closes) >= 6 and closes[-6] != 0 else 0.0
    # 20日涨幅
    return_20d = (closes[-1] - closes[-21]) / closes[-21] * 100 if len(closes) >= 21 and closes[-21] != 0 else 0.0
    # 量比
    recent_vol = sum(volumes[-5:]) / 5 if len(volumes) >= 5 else 0.0
    prior_vol = sum(volumes[-25:-5]) / 20 if len(volumes) >= 25 else recent_vol
    vol_ratio = recent_vol / prior_vol if prior_vol > 0 else 1.0
    # 成交额比
    recent_amt = sum(amounts[-5:]) / 5 if len(amounts) >= 5 else 0.0
    prior_amt = sum(amounts[-25:-5]) / 20 if len(amounts) >= 25 else recent_amt
    amt_ratio = recent_amt / prior_amt if prior_amt > 0 else 1.0

    results[code]["indicators"] = {
        "change_5d": round(change_5d, 4),
        "return_20d": round(return_20d, 4),
        "vol_ratio": round(vol_ratio, 4),
        "amt_ratio": round(amt_ratio, 4),
        "avg_volume_5d": round(recent_vol, 0),
        "avg_amount_5d": round(recent_amt, 0),
        "close_latest": closes[-1],
        "close_5d_ago": closes[-6] if len(closes) >= 6 else None,
        "close_20d_ago": closes[-21] if len(closes) >= 21 else None,
    }
    print(f"  {code}.SI {results[code]['info']['name']}: 5日涨幅={change_5d:.2f}% 20日涨幅={return_20d:.2f}% 量比={vol_ratio:.2f} 额比={amt_ratio:.2f}")

# 4. 保存原始数据 JSON
output_file = output_dir / "sector_init_data.json"
with open(output_file, "w", encoding="utf-8") as f:
    json.dump(results, f, ensure_ascii=False, indent=2)
print(f"\n=== 数据已保存到 {output_file} ===")
print(f"  板块: {list(results.keys())}")
print(f"  每个板块日线数: {[len(results[c]['hist']) for c in target_sectors]}")
