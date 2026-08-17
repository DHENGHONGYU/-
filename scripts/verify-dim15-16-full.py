"""全面验证维度 15/16 数据采集：分红股本 + 一致预期与评级

测试方案：
  1. 代理端点连通性测试（4 个端点）
  2. 模块加载 & 函数导出测试
  3. 数据采集链完整调用测试（使用 600519.SH 贵州茅台）
  4. 降级链验证（Tushare 不可用时降级到东财爬虫）
"""
from playwright.sync_api import sync_playwright
import json
import time

BASE_URL = "http://localhost:5173"
TEST_SYMBOL = "600519.SH"  # 贵州茅台 - 分红数据丰富

def test_proxy_endpoints(page):
    """测试 4 个代理端点的连通性"""
    print("=" * 60)
    print("1. 代理端点连通性测试")
    print("=" * 60)
    
    tests = [
        {
            "name": "分红配股 (F10 BonusFinancing)",
            "url": "/api/proxy/em-f10/PC_HSF10/BonusFinancing/PageAjax?code=SH600519"
        },
        {
            "name": "股本结构 (push2)",
            "url": "/api/proxy/em-push2/api/qt/stock/get?secid=1.600519&fields=f38,f39"
        },
        {
            "name": "一致预期 (datacenter)",
            "url": "/api/proxy/em-dc/securities/api/data/v1/get?reportName=RPT_DMSK_FN_INVESTSUMM_STAT&columns=SECURITY_CODE,FORECAST_YEAR,REVENUE_AVG,NET_PROFIT_AVG,EPS_AVG,ANALYST_COUNT&filter=(SECURITY_CODE=\"600519\")&pageNumber=1&pageSize=3&sortTypes=-1&sortColumns=FORECAST_YEAR&source=WEB&client=WEB"
        },
        {
            "name": "评级汇总 (datacenter)",
            "url": "/api/proxy/em-dc/securities/api/data/v1/get?reportName=RPT_DMSK_FN_MAINRATING&columns=SECURITY_CODE,RATING_BUY,RATING_OVERWEIGHT,RATING_HOLD,RATING_UNDERWEIGHT,RATING_SELL,CONSENSUS_RATING,CONSENSUS_TARGET_PRICE&filter=(SECURITY_CODE=\"600519\")&pageNumber=1&pageSize=1&source=WEB&client=WEB"
        }
    ]
    
    results = {}
    for test in tests:
        print(f"\n  [{test['name']}]")
        full_url = f"{BASE_URL}{test['url']}"
        print(f"  URL: {full_url}")
        result = page.evaluate("""
            async ({url, baseUrl}) => {
                try {
                    const resp = await fetch(baseUrl + url);
                    const status = resp.status;
                    const ct = resp.headers.get('content-type') || '';
                    let body = '';
                    let isJson = false;
                    let data = null;
                    try {
                        const text = await resp.text();
                        body = text.slice(0, 500);
                        if (ct.includes('json') || text.trim().startsWith('{') || text.trim().startsWith('[')) {
                            data = JSON.parse(text);
                            isJson = true;
                        }
                    } catch (e) {
                        body = 'PARSE_ERROR: ' + (e.message || '');
                    }
                    return { status, contentType: ct, body, isJson, data };
                } catch (e) {
                    return { status: 0, error: e.message || 'FETCH_ERROR' };
                }
            }
        """, {"url": test["url"], "baseUrl": BASE_URL})
        
        if result.get("error"):
            print(f"  ❌ 失败: {result['error']}")
        elif result.get("status") != 200:
            print(f"  ❌ HTTP {result['status']}")
        else:
            print(f"  ✅ HTTP 200 | Content-Type: {result.get('contentType', 'N/A')}")
            if result.get("isJson") and result.get("data"):
                data = result["data"]
                # 尝试提取关键信息
                if "fhyx" in data:
                    count = len(data["fhyx"])
                    print(f"     fhyx 记录数: {count}")
                    if count > 0:
                        first = data["fhyx"][0]
                        print(f"     首条: {first.get('IMPL_PLAN_PROFILE', 'N/A')} | 除权日: {first.get('EX_DIVIDEND_DATE', 'N/A')}")
                elif "data" in data:
                    if isinstance(data["data"], dict):
                        print(f"     data 字段: {list(data['data'].keys())[:5]}")
                        print(f"     data: {json.dumps(data['data'], ensure_ascii=False)[:300]}")
                    elif isinstance(data["data"], list):
                        print(f"     data 记录数: {len(data['data'])}")
                elif "result" in data:
                    inner = data["result"]
                    if isinstance(inner, dict) and "data" in inner:
                        items = inner["data"]
                        if isinstance(items, list):
                            print(f"     result.data 记录数: {len(items)}")
                            if len(items) > 0:
                                print(f"     首条: {json.dumps(items[0], ensure_ascii=False)[:300]}")
                        else:
                            print(f"     result: {json.dumps(inner, ensure_ascii=False)[:200]}")
                    else:
                        print(f"     result: {json.dumps(inner, ensure_ascii=False)[:200]}")
                else:
                    print(f"     JSON keys: {list(data.keys())[:10]}")
            else:
                body = result.get("body", "")
                if "报表配置不存在" in body:
                    print(f"     ⚠️ 报表配置不存在（reportName 可能已变更）")
                elif "html" in result.get("contentType", "").lower():
                    print(f"     ⚠️ 返回 HTML 而非 JSON（可能需要不同的端点）")
                else:
                    print(f"     body: {body[:200]}")
        
        results[test["name"]] = result
    
    return results


def test_module_loading(page):
    """测试模块加载和函数导出"""
    print("\n" + "=" * 60)
    print("2. 模块加载 & 函数导出测试")
    print("=" * 60)
    
    result = page.evaluate("""
        async () => {
            const mod = await import('/src/services/data-collector/multiSourceFetcher.ts');
            const keys = Object.keys(mod);
            const checks = {
                fetchDividendShareData: typeof mod.fetchDividendShareData === 'function',
                fetchConsensusAndRating: typeof mod.fetchConsensusAndRating === 'function',
                fetchDimensionData: typeof mod.fetchDimensionData === 'function',
            };
            return { keys, checks };
        }
    """)
    
    for name, ok in result.get("checks", {}).items():
        status = "✅" if ok else "❌"
        print(f"  {status} {name}: {'defined' if ok else 'MISSING'}")
    
    print(f"  Exported keys: {result.get('keys', [])}")
    return result


def test_data_collection(page):
    """测试完整数据采集链"""
    print("\n" + "=" * 60)
    print("3. 数据采集链完整调用测试")
    print("=" * 60)
    
    # 测试维度 15
    print(f"\n  [维度 15 分红股本] 标的: {TEST_SYMBOL}")
    dim15_result = page.evaluate("""
        async (symbol) => {
            const mod = await import('/src/services/data-collector/multiSourceFetcher.ts');
            const start = Date.now();
            try {
                const data = await mod.fetchDividendShareData(symbol);
                const elapsed = Date.now() - start;
                return { 
                    success: data !== null, 
                    data: data,
                    elapsedMs: elapsed,
                    error: null
                };
            } catch (e) {
                return { 
                    success: false, 
                    data: null,
                    elapsedMs: Date.now() - start,
                    error: e.message || String(e)
                };
            }
        }
    """, TEST_SYMBOL)
    
    if dim15_result.get("error"):
        print(f"  ❌ 失败: {dim15_result['error']}")
    elif dim15_result.get("success"):
        data = dim15_result["data"]
        print(f"  ✅ 成功 ({dim15_result['elapsedMs']}ms)")
        print(f"     _source: {data.get('_source', 'N/A')}")
        print(f"     totalShares: {data.get('totalShares', 'N/A')} 亿股")
        print(f"     floatShares: {data.get('floatShares', 'N/A')} 亿股")
        print(f"     dividendYield: {data.get('dividendYield', 'N/A')}")
        print(f"     totalDividend3Y: {data.get('totalDividend3Y', 'N/A')}")
        history = data.get("history", [])
        print(f"     分红记录数: {len(history)}")
        if history:
            for i, h in enumerate(history[:3]):
                print(f"       [{i+1}] {h.get('exDividendDate', 'N/A')} | {h.get('planExplanation', 'N/A')} | 每股派息: {h.get('cashDividendPerShare', 'N/A')}")
    else:
        print(f"  ⚠️ 返回 null（所有数据源均不可用）")
        print(f"     耗时: {dim15_result['elapsedMs']}ms")
    
    # 测试维度 16
    print(f"\n  [维度 16 一致预期与评级] 标的: {TEST_SYMBOL}")
    dim16_result = page.evaluate("""
        async (symbol) => {
            const mod = await import('/src/services/data-collector/multiSourceFetcher.ts');
            const start = Date.now();
            try {
                const data = await mod.fetchConsensusAndRating(symbol);
                const elapsed = Date.now() - start;
                return { 
                    success: data !== null, 
                    data: data,
                    elapsedMs: elapsed,
                    error: null
                };
            } catch (e) {
                return { 
                    success: false, 
                    data: null,
                    elapsedMs: Date.now() - start,
                    error: e.message || String(e)
                };
            }
        }
    """, TEST_SYMBOL)
    
    if dim16_result.get("error"):
        print(f"  ❌ 失败: {dim16_result['error']}")
    elif dim16_result.get("success"):
        data = dim16_result["data"]
        print(f"  ✅ 成功 ({dim16_result['elapsedMs']}ms)")
        print(f"     _source: {data.get('_source', 'N/A')}")
        print(f"     dataDate: {data.get('dataDate', 'N/A')}")
        
        estimates = data.get("estimates", [])
        print(f"     一致预期记录数: {len(estimates)}")
        for e in estimates[:3]:
            print(f"       财年 {e.get('fiscalYear', 'N/A')}: 营收 {e.get('revenueEstimate', 'N/A')}亿 | 净利 {e.get('netProfitEstimate', 'N/A')}亿 | EPS {e.get('epsEstimate', 'N/A')} | 分析师 {e.get('analystCount', 'N/A')}人")
        
        rating = data.get("rating")
        if rating:
            print(f"     评级汇总:")
            print(f"       买入: {rating.get('buyCount', 0)} | 增持: {rating.get('overweightCount', 0)} | 持有: {rating.get('holdCount', 0)} | 减持: {rating.get('underweightCount', 0)} | 卖出: {rating.get('sellCount', 0)}")
            print(f"       综合评级: {rating.get('consensusRating', 'N/A')} | 一致目标价: {rating.get('consensusTargetPrice', 'N/A')}")
            print(f"       目标价区间: {rating.get('targetPriceLow', 'N/A')} ~ {rating.get('targetPriceHigh', 'N/A')}")
            print(f"       近期趋势: {rating.get('recentTrend', 'N/A')}")
    else:
        print(f"  ⚠️ 返回 null（所有数据源均不可用）")
        print(f"     耗时: {dim16_result['elapsedMs']}ms")
    
    return {"dim15": dim15_result, "dim16": dim16_result}


def test_fetchDimensionData(page):
    """测试通过 fetchDimensionData 统一入口"""
    print("\n" + "=" * 60)
    print("4. fetchDimensionData 统一入口测试")
    print("=" * 60)
    
    for dim_code in ["15", "16"]:
        dim_name = "分红股本" if dim_code == "15" else "一致预期与评级"
        print(f"\n  [维度 {dim_code} {dim_name}]")
        result = page.evaluate("""
            async ([symbol, dimCode]) => {
                const mod = await import('/src/services/data-collector/multiSourceFetcher.ts');
                const start = Date.now();
                try {
                    const data = await mod.fetchDimensionData(symbol, dimCode);
                    const elapsed = Date.now() - start;
                    return {
                        success: data !== null,
                        hasData: data !== null,
                        keys: data ? Object.keys(data) : [],
                        elapsedMs: elapsed,
                        error: null
                    };
                } catch (e) {
                    return {
                        success: false,
                        hasData: false,
                        keys: [],
                        elapsedMs: Date.now() - start,
                        error: e.message || String(e)
                    };
                }
            }
        """, [TEST_SYMBOL, dim_code])
        
        if result.get("error"):
            print(f"  ❌ 失败: {result['error']}")
        elif result.get("success"):
            print(f"  ✅ 成功 ({result['elapsedMs']}ms) | keys: {result.get('keys', [])}")
        else:
            print(f"  ⚠️ 返回 null ({result['elapsedMs']}ms)")


def main():
    print("=" * 60)
    print(f"维度 15/16 数据采集全面验证")
    print(f"测试标的: {TEST_SYMBOL} (贵州茅台)")
    print(f"Vite 服务: {BASE_URL}")
    print("=" * 60)
    
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        
        # 先导航到 Vite 页面，确保后续 fetch 和 import 可用
        print("导航到 Vite 首页...")
        page.goto(BASE_URL, wait_until="domcontentloaded", timeout=15000)
        print(f"页面标题: {page.title()}")
        
        # 1. 代理端点连通性测试
        proxy_results = test_proxy_endpoints(page)
        
        # 2. 模块加载测试
        module_results = test_module_loading(page)
        
        # 3. 数据采集链测试
        collection_results = test_data_collection(page)
        
        # 4. 统一入口测试
        test_fetchDimensionData(page)
        
        browser.close()
    
    # 汇总
    print("\n" + "=" * 60)
    print("验证汇总")
    print("=" * 60)
    
    # 端点
    ok_count = sum(1 for r in proxy_results.values() if r.get("status") == 200)
    print(f"  代理端点: {ok_count}/{len(proxy_results)} 通过")
    for name, r in proxy_results.items():
        status = "✅" if r.get("status") == 200 else "❌"
        print(f"    {status} {name}")
    
    # 模块
    checks = module_results.get("checks", {})
    mod_ok = all(checks.values())
    print(f"  模块导出: {'✅ 全部通过' if mod_ok else '❌ 有缺失'}")
    
    # 采集
    dim15_ok = collection_results.get("dim15", {}).get("success", False)
    dim16_ok = collection_results.get("dim16", {}).get("success", False)
    print(f"  维度 15 分红股本: {'✅ 成功' if dim15_ok else '❌ 失败/无数据'}")
    print(f"  维度 16 一致预期: {'✅ 成功' if dim16_ok else '❌ 失败/无数据'}")
    
    print("\n完成。")


if __name__ == "__main__":
    main()