"""
Demo: LLM 并发解析 10 份审计报告

流程：
1. 从巨潮资讯网下载 10 只股票的年报 PDF
2. pdfplumber 提取 PDF 文本（失败时 fallback 到 AKShare 财务数据）
3. LLM 从文本中抽取结构化财务 JSON（Key 未配置时走 Mock）
4. ThreadPoolExecutor 并发处理（max_workers=5）
5. 输出 JSON 报告 + 控制台汇总

运行方式：
    cd python/data_service
    python demo_llm_financial.py

    # 配置 LLM Key 后跑真实 LLM 抽取：
    set DEEPSEEK_API_KEY=sk-xxx
    python demo_llm_financial.py
"""

import json
import os
import sys
from datetime import datetime

# 确保能 import 同目录模块
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from llm_financial_extractor import extract_financial_batch, LLM_API_KEY, LLM_MODEL

# ─── 测试股票（10 只大盘股，年报 PDF 在巨潮资讯网可查）───
TEST_SYMBOLS = [
    "600519.SH",  # 贵州茅台
    "000001.SZ",  # 平安银行
    "000858.SZ",  # 五粮液
    "600036.SH",  # 招商银行
    "601318.SH",  # 中国平安
    "600276.SH",  # 恒瑞医药
    "000333.SZ",  # 美的集团
    "002594.SZ",  # 比亚迪
    "600900.SH",  # 长江电力
    "601398.SH",  # 工商银行
]

SYMBOL_NAMES = {
    "600519.SH": "贵州茅台",
    "000001.SZ": "平安银行",
    "000858.SZ": "五粮液",
    "600036.SH": "招商银行",
    "601318.SH": "中国平安",
    "600276.SH": "恒瑞医药",
    "000333.SZ": "美的集团",
    "002594.SZ": "比亚迪",
    "600900.SH": "长江电力",
    "601398.SH": "工商银行",
}


def main():
    print("=" * 72)
    print("LLM 并发财务数据解析 Demo")
    print(f"时间: {datetime.now().isoformat()}")
    print(f"股票数: {len(TEST_SYMBOLS)}")
    print(f"LLM 配置: model={LLM_MODEL}, key={'已配置' if LLM_API_KEY else '未配置（走 Mock）'}")
    print("=" * 72)

    # 并发执行
    summary = extract_financial_batch(TEST_SYMBOLS, max_workers=5)

    # ─── 控制台汇总 ───
    print("\n" + "=" * 72)
    print("并发 LLM 财务解析汇总")
    print("=" * 72)
    print(f"{'股票':<14} {'名称':<8} {'来源':<18} {'文本长度':>10} {'耗时ms':>8} {'LLM':>6}")
    print("-" * 72)

    for r in summary["results"]:
        sym = r["symbol"]
        name = SYMBOL_NAMES.get(sym, "")[:4]
        source = r.get("source", "?")
        text_len = r.get("text_length", 0)
        elapsed = r.get("elapsed_ms", 0)
        fin = r.get("financial_data", {})
        if fin.get("_mock"):
            llm_status = "Mock"
        elif fin.get("_error"):
            llm_status = "FAIL"
        else:
            llm_status = "OK"
        print(f"{sym:<14} {name:<8} {source:<18} {text_len:>10} {elapsed:>8} {llm_status:>6}")

    print("-" * 72)
    print(f"总计: {summary['total']} 只 | PDF来源: {summary['pdf_source']} | AKShare兜底: {summary['akshare_fallback']} | 失败: {summary['failed']}")
    print(f"LLM 成功: {summary['llm_success']} | 总耗时: {summary['total_elapsed_ms']}ms | 平均: {summary['avg_elapsed_ms']}ms | 并发数: {summary['concurrency']}")

    # ─── 抽取结果明细 ───
    print("\n--- LLM 抽取结果明细 ---")
    for r in summary["results"]:
        sym = r["symbol"]
        name = SYMBOL_NAMES.get(sym, "")
        fin = r.get("financial_data", {})
        if not fin or fin.get("_error"):
            print(f"\n{sym} {name}: 无数据")
            continue
        print(f"\n{sym} {name} (来源: {r.get('source')}, 耗时: {r.get('elapsed_ms')}ms):")
        for field in ["report_date", "revenue", "revenue_yoy", "net_profit", "net_profit_yoy",
                       "gross_margin", "net_margin", "operating_cf", "rd_ratio",
                       "net_assets", "goodwill"]:
            val = fin.get(field)
            if val is not None:
                if isinstance(val, (int, float)) and abs(val) >= 1e8:
                    print(f"  {field}: {val:.2f} ({val/1e8:.2f}亿)")
                else:
                    print(f"  {field}: {val}")

    # ─── 保存 JSON 报告 ───
    out_dir = os.path.join(os.path.dirname(__file__), "..", "..", "outputs", "llm-financial-demo")
    out_dir = os.path.abspath(out_dir)
    os.makedirs(out_dir, exist_ok=True)
    ts = datetime.now().strftime("%Y%m%d-%H%M%S")
    json_path = os.path.join(out_dir, f"llm-financial-{ts}.json")
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(summary, f, ensure_ascii=False, indent=2, default=str)
    print(f"\n报告已保存: {json_path}")

    if not LLM_API_KEY:
        print("\n⚠ LLM_API_KEY 未配置，以上为 Mock 结果。")
        print("  配置后切换真实 LLM 抽取：")
        print("    set DEEPSEEK_API_KEY=sk-xxx")
        print("    python demo_llm_financial.py")


if __name__ == "__main__":
    main()
