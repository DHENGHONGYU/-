"""Browser verification: test dimensions 15 & 16 data collection via Playwright."""
from playwright.sync_api import sync_playwright
import json

TEST_SYMBOL = "600519.SH"  # 贵州茅台
BASE_URL = "http://127.0.0.1:5173"

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True, args=["--no-sandbox", "--disable-setuid-sandbox"])
    context = browser.new_context(ignore_https_errors=True)
    page = context.new_page()
    
    console_logs = []
    page.on("console", lambda msg: console_logs.append(f"[{msg.type}] {msg.text}"))

    print(f"Navigating to {BASE_URL}...")
    try:
        page.goto(BASE_URL, timeout=10000, wait_until="commit")
        print("Navigation committed.")
        # Wait for the app to render - look for the root element
        page.wait_for_selector("#root", timeout=15000)
        print("App root element found.")
        page.wait_for_timeout(5000)  # Extra time for modules to load
        print("App initialized.\n")
    except Exception as e:
        print(f"Page init failed: {e}")
        # Try to take a screenshot to debug
        page.screenshot(path="scripts/debug-screenshot.png")
        print("Screenshot saved to scripts/debug-screenshot.png")

    # Run all tests in a single evaluate to avoid context destruction
    print("=" * 60)
    print(f"Running all tests for {TEST_SYMBOL}")
    print("=" * 60)
    
    results = page.evaluate("""
        async () => {
            const results = {};
            
            // Test 1: fetchDimensionData('15') — 分红股本
            try {
                const mod = await import('/src/services/data-collector/multiSourceFetcher.ts');
                const data = await mod.fetchDimensionData('__SYMBOL__', '15');
                results.test1 = { success: true, data: data };
            } catch (e) {
                results.test1 = { success: false, error: e.message };
            }
            
            // Test 2: fetchDimensionData('16') — 一致预期
            try {
                const mod = await import('/src/services/data-collector/multiSourceFetcher.ts');
                const data = await mod.fetchDimensionData('__SYMBOL__', '16');
                results.test2 = { success: true, data: data };
            } catch (e) {
                results.test2 = { success: false, error: e.message };
            }
            
            return results;
        }
    """.replace("__SYMBOL__", TEST_SYMBOL))
    
    # ── Display Test 1 results ──
    print()
    print("=" * 60)
    print(f"Test 1: fetchDimensionData('{TEST_SYMBOL}', '15') — 分红股本")
    print("=" * 60)
    t1 = results.get("test1", {})
    if t1.get("success"):
        data = t1.get("data")
        if data:
            print(f"  [OK] 获取到数据")
            print(f"    symbol:    {data.get('symbol')}")
            print(f"    source:    {data.get('_source')}")
            print(f"    总股本:    {data.get('totalShares')} 亿股")
            print(f"    流通股本:  {data.get('floatShares')} 亿股")
            print(f"    股息率:    {data.get('dividendYield')}")
            print(f"    3年分红:   {data.get('totalDividend3Y')}")
            print(f"    分红率:    {data.get('payoutRatio3Y')}")
            history = data.get("history", [])
            print(f"    分红记录数: {len(history)}")
            if history:
                for i, h in enumerate(history[:5]):
                    print(f"      [{i+1}] {h.get('exDividendDate')} 每股现金{h.get('cashDividendPerShare')}元 送{h.get('bonusShareRatio')}股 转增{h.get('transferShareRatio')}股")
        else:
            print("  [WARN] 返回 null (无可用数据源 — Tushare Token 未配置且东财爬虫可能失败)")
    else:
        print(f"  [FAIL] 异常: {t1.get('error')}")

    # ── Display Test 2 results ──
    print()
    print("=" * 60)
    print(f"Test 2: fetchDimensionData('{TEST_SYMBOL}', '16') — 一致预期")
    print("=" * 60)
    t2 = results.get("test2", {})
    if t2.get("success"):
        data = t2.get("data")
        if data:
            print(f"  [OK] 获取到数据")
            print(f"    symbol:    {data.get('symbol')}")
            print(f"    source:    {data.get('_source')}")
            rating = data.get("rating", {})
            if rating:
                print(f"    买入: {rating.get('buyCount')}, 增持: {rating.get('overweightCount')}, 持有: {rating.get('holdCount')}, 减持: {rating.get('underweightCount')}, 卖出: {rating.get('sellCount')}")
                print(f"    综合评级: {rating.get('consensusRating')}")
                print(f"    一致目标价: {rating.get('consensusTargetPrice')}")
                print(f"    目标价区间: {rating.get('targetPriceLow')} - {rating.get('targetPriceHigh')}")
                print(f"    评级趋势: {rating.get('recentTrend')}")
            estimates = data.get("estimates", [])
            print(f"    预测年份数: {len(estimates)}")
            for est in estimates:
                print(f"      {est.get('fiscalYear')}: 营收={est.get('revenueEstimate')}亿, 净利={est.get('netProfitEstimate')}亿, EPS={est.get('epsEstimate')}, 分析师={est.get('analystCount')}人")
        else:
            print("  [WARN] 返回 null (无可用数据源)")
    else:
        print(f"  [FAIL] 异常: {t2.get('error')}")

    # ── Console logs summary ──
    print()
    print("=" * 60)
    print("Console Logs (relevant)")
    print("=" * 60)
    keywords = ['crawler', 'dividend', 'consensus', 'Tushare', 'multiSource', '东财', '分红', '预期', '评级', 'OK', '获取']
    relevant = [l for l in console_logs if any(kw in l for kw in keywords)]
    if relevant:
        for l in relevant:
            print(f"  {l}")
    else:
        print("  (无相关日志)")

    browser.close()
    print("\nDone.")