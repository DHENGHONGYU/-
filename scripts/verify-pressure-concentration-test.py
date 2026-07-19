"""
Independent verification of the 50-stock pressure concentration test report.
Recalculates all key metrics from CSV and compares against generated Markdown.
"""

import csv
import math
import re
from collections import Counter
from pathlib import Path

CSV_PATH = Path(r"C:/Users/DELL/Desktop/股票清单/hot_stocks_50.csv")
REPORT_PATH = Path(r"G:/FinSightV9/deliverables/software-company/concentration-test-report-2026-07-19.md")


def parse_csv(path):
    stocks = []
    with open(path, "r", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        for row in reader:
            stocks.append({
                "no": int(row["序号"]),
                "symbol": row["股票代码"],
                "name": row["股票名称"],
                "sector": row["所属板块"],
                "concept": row["概念标签"],
                "isHot": row["是否热门板块"] == "热门",
                "heatScore": float(row["热度得分"]),
                "recentReturn": float(row["近期涨跌幅(%)"]),
                "marketCap": float(row["总市值(亿元)"]),
            })
    return stocks


def hhi(weights):
    total = sum(weights)
    if total == 0:
        return 0
    return sum((w / total) ** 2 for w in weights)


def sector_layer(cap):
    if cap >= 5000:
        return "超大盘(≥5000亿)"
    if cap >= 2000:
        return "大盘(2000-5000亿)"
    if cap >= 1000:
        return "中大盘(1000-2000亿)"
    if cap >= 200:
        return "中盘(200-1000亿)"
    return "小盘(<200亿)"


def standard_layer(cap):
    if cap >= 1000:
        return "大盘(≥1000亿)"
    if cap >= 200:
        return "中盘(200-1000亿)"
    return "小盘(<200亿)"


TECH_SECTORS = {"半导体", "机器人", "AI算力", "消费电子", "华为概念", "新能源", "数字经济", "低空经济"}
FINANCIAL_SECTORS = {"银行", "保险", "券商"}
CYCLICAL_DEFENSIVE = {"公用事业", "周期/能源", "石油石化", "交通运输", "家电", "食品饮料", "地产"}
MEDICAL = {"创新药"}
MILITARY = {"军工"}


def recalculate(stocks):
    total = len(stocks)
    sectors = Counter(st["sector"] for st in stocks)
    sector_counts = sorted(sectors.values(), reverse=True)
    sector_hhi = hhi(sector_counts)
    effective_sectors = 1 / sector_hhi if sector_hhi else 0

    market_caps = sorted(st["marketCap"] for st in stocks)
    min_cap = market_caps[0]
    max_cap = market_caps[-1]
    mean_cap = sum(market_caps) / total
    median_cap = (market_caps[total // 2] if total % 2 else (market_caps[total // 2 - 1] + market_caps[total // 2]) / 2)

    layer_counts = Counter(sector_layer(cap) for cap in market_caps)
    standard_layer_counts = Counter(standard_layer(cap) for cap in market_caps)
    cap_weighted_hhi = hhi(market_caps)

    tech_growth_count = sum(1 for st in stocks if st["sector"] in TECH_SECTORS)
    financial_count = sum(1 for st in stocks if st["sector"] in FINANCIAL_SECTORS)
    cyclical_count = sum(1 for st in stocks if st["sector"] in CYCLICAL_DEFENSIVE)
    medical_count = sum(1 for st in stocks if st["sector"] in MEDICAL)
    military_count = sum(1 for st in stocks if st["sector"] in MILITARY)

    hot_count = sum(1 for st in stocks if st["isHot"])
    hot_ratio = hot_count / total

    returns = [st["recentReturn"] for st in stocks]
    return_mean = sum(returns) / total
    return_min = min(returns)
    return_max = max(returns)
    return_std = math.sqrt(sum((r - return_mean) ** 2 for r in returns) / (total - 1))

    total_cap = sum(st["marketCap"] for st in stocks)
    total_heat = sum(st["heatScore"] for st in stocks)

    equal_weights = [1 / total] * total
    cap_weights = [st["marketCap"] / total_cap for st in stocks]
    heat_weights = [st["heatScore"] / total_heat for st in stocks]

    def analyze(weights):
        indexed = [(stocks[i], weights[i]) for i in range(total)]
        indexed.sort(key=lambda x: x[1], reverse=True)
        top10 = [f"{item[0]['name']}({item[1]:.3f})" for item in indexed[:10]]
        top10_sum = sum(item[1] for item in indexed[:10])
        max_weight = indexed[0][1]
        max_stock = indexed[0][0]["name"]
        return {
            "top10": top10,
            "top10Sum": top10_sum,
            "hhi": hhi(weights),
            "maxWeight": max_weight,
            "maxStock": max_stock,
        }

    equal_scenario = analyze(equal_weights)
    cap_scenario = analyze(cap_weights)
    heat_scenario = analyze(heat_weights)

    return {
        "total": total,
        "sectors": sectors,
        "sector_hhi": sector_hhi,
        "effective_sectors": effective_sectors,
        "min_cap": min_cap,
        "max_cap": max_cap,
        "mean_cap": mean_cap,
        "median_cap": median_cap,
        "layer_counts": layer_counts,
        "standard_layer_counts": standard_layer_counts,
        "cap_weighted_hhi": cap_weighted_hhi,
        "tech_growth_count": tech_growth_count,
        "financial_count": financial_count,
        "cyclical_count": cyclical_count,
        "medical_count": medical_count,
        "military_count": military_count,
        "hot_count": hot_count,
        "hot_ratio": hot_ratio,
        "return_mean": return_mean,
        "return_min": return_min,
        "return_max": return_max,
        "return_std": return_std,
        "equal_scenario": equal_scenario,
        "cap_scenario": cap_scenario,
        "heat_scenario": heat_scenario,
    }


def extract_report_metrics(path):
    text = path.read_text(encoding="utf-8")
    return text


def compare(label, expected, actual, tolerance=None, fmt="{:.4f}"):
    match = False
    if tolerance is not None:
        match = abs(expected - actual) < tolerance
    else:
        match = expected == actual

    status = "PASS" if match else "FAIL"
    if tolerance is not None:
        print(f"  {status}: {label}: expected={fmt.format(expected)}, actual={fmt.format(actual)}, diff={abs(expected - actual):.6f}")
    else:
        print(f"  {status}: {label}: expected={expected}, actual={actual}")
    return match


def main():
    stocks = parse_csv(CSV_PATH)
    metrics = recalculate(stocks)
    report = extract_report_metrics(REPORT_PATH)

    print("=== Independent CSV Recalculation vs Generated Report ===\n")
    print(f"CSV rows parsed: {len(stocks)}\n")

    all_pass = True

    print("1. Stock count")
    all_pass &= compare("Total stocks", 50, metrics["total"])

    print("\n2. Sector distribution")
    expected_sectors = {
        "半导体": 6,
        "机器人": 5,
        "银行": 5,
        "低空经济": 3,
        "军工": 3,
        "公用事业": 3,
        "食品饮料": 3,
        "周期/能源": 3,
        "AI算力": 2,
        "消费电子": 2,
        "华为概念": 2,
        "创新药": 2,
        "券商": 2,
        "新能源": 2,
        "地产": 2,
        "数字经济": 1,
        "保险": 1,
        "石油石化": 1,
        "交通运输": 1,
        "家电": 1,
    }
    for sector, expected in expected_sectors.items():
        actual = metrics["sectors"].get(sector, 0)
        all_pass &= compare(f"  {sector}", expected, actual)
    all_pass &= compare("Distinct sectors", 20, len(metrics["sectors"]))
    all_pass &= compare("Sector HHI", 0.0656, metrics["sector_hhi"], tolerance=0.0001)
    all_pass &= compare("Effective sectors", 15.2, metrics["effective_sectors"], tolerance=0.05)

    print("\n3. Market cap layers")
    all_pass &= compare("超大盘(≥5000亿)", 27, metrics["layer_counts"]["超大盘(≥5000亿)"])
    all_pass &= compare("大盘(2000-5000亿)", 16, metrics["layer_counts"]["大盘(2000-5000亿)"])
    all_pass &= compare("中大盘(1000-2000亿)", 6, metrics["layer_counts"]["中大盘(1000-2000亿)"])
    all_pass &= compare("Others (中盘+小盘)", 1, metrics["layer_counts"]["中盘(200-1000亿)"] + metrics["layer_counts"]["小盘(<200亿)"])
    all_pass &= compare("标准分层-大盘(≥1000亿)", 49, metrics["standard_layer_counts"]["大盘(≥1000亿)"])
    all_pass &= compare("标准分层-中盘(200-1000亿)", 1, metrics["standard_layer_counts"]["中盘(200-1000亿)"])
    all_pass &= compare("Min cap", 678, metrics["min_cap"], tolerance=0.5)
    all_pass &= compare("Max cap", 8543, metrics["max_cap"], tolerance=0.5)
    all_pass &= compare("Mean cap", 4958, metrics["mean_cap"], tolerance=1)
    all_pass &= compare("Median cap", 5362, metrics["median_cap"], tolerance=1)
    all_pass &= compare("Cap weighted HHI", 0.0241, metrics["cap_weighted_hhi"], tolerance=0.0001)

    print("\n4. Weight scenarios")
    all_pass &= compare("Equal top10 sum", 0.20, metrics["equal_scenario"]["top10Sum"], tolerance=0.001)
    all_pass &= compare("Equal HHI", 0.0200, metrics["equal_scenario"]["hhi"], tolerance=0.0001)
    all_pass &= compare("Cap top10 sum", 0.322, metrics["cap_scenario"]["top10Sum"], tolerance=0.001)
    all_pass &= compare("Cap HHI", 0.0241, metrics["cap_scenario"]["hhi"], tolerance=0.0001)
    all_pass &= compare("Heat top10 sum", 0.268, metrics["heat_scenario"]["top10Sum"], tolerance=0.001)
    all_pass &= compare("Heat HHI", 0.0213, metrics["heat_scenario"]["hhi"], tolerance=0.0001)

    print("\n5. Theme and hot ratios")
    all_pass &= compare("Tech growth count", 23, metrics["tech_growth_count"])
    all_pass &= compare("Tech growth ratio", 0.46, metrics["tech_growth_count"] / metrics["total"], tolerance=0.001)
    all_pass &= compare("Hot count", 30, metrics["hot_count"])
    all_pass &= compare("Hot ratio", 0.60, metrics["hot_ratio"], tolerance=0.001)
    all_pass &= compare("Financial count", 8, metrics["financial_count"])
    all_pass &= compare("Cyclical/defensive count", 14, metrics["cyclical_count"])
    all_pass &= compare("Medical count", 2, metrics["medical_count"])
    all_pass &= compare("Military count", 3, metrics["military_count"])

    print("\n6. Return statistics")
    all_pass &= compare("Return mean", 2.63, metrics["return_mean"], tolerance=0.01)
    all_pass &= compare("Return min", -4.66, metrics["return_min"], tolerance=0.01)
    all_pass &= compare("Return max", 11.31, metrics["return_max"], tolerance=0.01)
    all_pass &= compare("Return std", 4.46, metrics["return_std"], tolerance=0.01)

    print("\n7. Report string assertions")
    checks = [
        ("标题包含 50 只股票集中度", r"50 只股票集中度穿行测试报告"),
        ("分析日期 2026-07-19", r"2026-07-19"),
        ("样本量 50 只", r"50 只"),
        ("科技成长 46%", r"46%"),
        ("热门股 60%", r"60%"),
        ("等权 HHI 0.0200", r"0\.0200"),
        ("市值加权 HHI 0.0241", r"0\.0241"),
        ("热度加权 HHI 0.0213", r"0\.0213"),
        ("板块数 20", r"板块数[\s*]+20"),
        ("板块 HHI 0.0656", r"0\.0656"),
        ("有效板块数 15.2", r"15\.2"),
        ("数据源说明章节", r"数据源说明"),
        ("执行摘要章节", r"执行摘要"),
        ("结论章节", r"整体集中度评估结论"),
        ("优化建议章节", r"优化建议"),
        ("数据补充清单章节", r"数据补充清单"),
    ]
    for label, pattern in checks:
        found = re.search(pattern, report) is not None
        status = "PASS" if found else "FAIL"
        print(f"  {status}: {label}")
        all_pass &= found

    print("\n=== Final result ===")
    print("PASS" if all_pass else "FAIL")
    return 0 if all_pass else 1


if __name__ == "__main__":
    raise SystemExit(main())
