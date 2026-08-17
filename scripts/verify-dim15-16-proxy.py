"""
验证维度 15（分红股本）和维度 16（一致预期）的东财代理端点
"""
from playwright.sync_api import sync_playwright
import json, sys

TEST_SYMBOL = '600519'  # 贵州茅台
F10_CODE = 'SH600519'

def main():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        
        # 导航到应用首页，确保 Vite 代理可用
        print("正在连接 Vite 开发服务器...")
        try:
            page.goto('http://localhost:5173', timeout=15000)
            page.wait_for_load_state('networkidle')
            print("✓ 服务器连接成功\n")
        except Exception as e:
            print(f"✗ 服务器连接失败: {e}")
            browser.close()
            return

        all_passed = True

        # ── Test 1: 分红配股 API ──
        print("=" * 60)
        print("Test 1: 分红配股 API (BonusFinancing)")
        print("=" * 60)
        try:
            result = page.evaluate("""
                async () => {
                    const url = '/api/proxy/em-f10/PC_HSF10/BonusFinancing/PageAjax?code=' + 'SH600519';
                    const resp = await fetch(url);
                    const text = await resp.text();
                    return { status: resp.status, ok: resp.ok, preview: text.substring(0, 800) };
                }
            """)
            print(f"  HTTP Status: {result['status']}")
            if result['ok']:
                try:
                    data = json.loads(result['preview'])
                    item_count = len(data.get('data', []))
                    print(f"  ✓ 成功！返回 {item_count} 条分红记录")
                    if item_count > 0:
                        first = data['data'][0]
                        print(f"    首条: {first.get('EX_DIVIDEND_DATE', 'N/A')} | "
                              f"现金分红={first.get('CASH_DIVIDEND', 'N/A')} | "
                              f"方案={first.get('PLAN_EXPLAIN', 'N/A')[:50]}")
                except json.JSONDecodeError:
                    print(f"  ✗ 响应不是 JSON: {result['preview'][:200]}")
                    all_passed = False
            else:
                print(f"  ✗ 请求失败: {result['preview'][:200]}")
                all_passed = False
        except Exception as e:
            print(f"  ✗ 异常: {e}")
            all_passed = False

        # ── Test 2: 股本结构 API ──
        print("\n" + "=" * 60)
        print("Test 2: 股本结构 API (CapitalStructure)")
        print("=" * 60)
        try:
            result = page.evaluate("""
                async () => {
                    const url = '/api/proxy/em-f10/PC_HSF10/CapitalStructure/PageAjax?code=' + 'SH600519';
                    const resp = await fetch(url);
                    const text = await resp.text();
                    return { status: resp.status, ok: resp.ok, preview: text.substring(0, 800) };
                }
            """)
            print(f"  HTTP Status: {result['status']}")
            if result['ok']:
                try:
                    data = json.loads(result['preview'])
                    item_count = len(data.get('data', []))
                    print(f"  ✓ 成功！返回 {item_count} 条股本结构记录")
                    if item_count > 0:
                        first = data['data'][0]
                        print(f"    总股本={first.get('TOTAL_SHARES', 'N/A')}万股 | "
                              f"流通股本={first.get('FLOAT_SHARES', 'N/A')}万股")
                except json.JSONDecodeError:
                    print(f"  ✗ 响应不是 JSON: {result['preview'][:200]}")
                    all_passed = False
            else:
                print(f"  ✗ 请求失败: {result['preview'][:200]}")
                all_passed = False
        except Exception as e:
            print(f"  ✗ 异常: {e}")
            all_passed = False

        # ── Test 3: 一致预期 API ──
        print("\n" + "=" * 60)
        print("Test 3: 一致预期 API (Consensus Estimate)")
        print("=" * 60)
        consensus_ok = False
        for report_name in [
            'RPT_DMSK_FN_INVESTSUMM_STAT',
            'RPT_DMSK_FN_INVESTSUMM',
            'RPT_F10_FINANCE_INVESTSUMM',
            'RPT_DMSK_FN_INVESTSUMM_STAT_NEW',
            'RPT_DMSK_FN_INVESTSUMM_DETAIL',
        ]:
            try:
                result = page.evaluate(f"""
                    async () => {{
                        const base = '/api/proxy/em-dc/securities/api/data/v1/get';
                        const params = new URLSearchParams({{
                            reportName: '{report_name}',
                            columns: 'SECURITY_CODE,FORECAST_YEAR,REVENUE_AVG,NET_PROFIT_AVG,EPS_AVG,ANALYST_COUNT,EPS_HIGH,EPS_LOW',
                            filter: '(SECURITY_CODE="600519")',
                            pageNumber: '1',
                            pageSize: '3',
                            sortTypes: '-1',
                            sortColumns: 'FORECAST_YEAR',
                            source: 'WEB',
                            client: 'WEB',
                        }});
                        const resp = await fetch(base + '?' + params.toString());
                        const text = await resp.text();
                        return {{ status: resp.status, ok: resp.ok, preview: text.substring(0, 800) }};
                    }}
                """)
                if result['ok']:
                    try:
                        data = json.loads(result['preview'])
                        if data.get('success') and data.get('result', {}).get('data'):
                            items = data['result']['data']
                            print(f"  ✓ [{report_name}] 成功！返回 {len(items)} 条一致预期")
                            for item in items[:3]:
                                print(f"    {item.get('FORECAST_YEAR')}年: "
                                      f"营收={item.get('REVENUE_AVG')} | "
                                      f"净利润={item.get('NET_PROFIT_AVG')} | "
                                      f"EPS={item.get('EPS_AVG')} | "
                                      f"分析师={item.get('ANALYST_COUNT')}人")
                            consensus_ok = True
                            break
                        else:
                            msg = data.get('message', '')
                            print(f"  - [{report_name}] 无数据: {msg[:80]}")
                    except json.JSONDecodeError:
                        print(f"  - [{report_name}] 非JSON响应: {result['preview'][:100]}")
                else:
                    print(f"  - [{report_name}] HTTP {result['status']}")
            except Exception as e:
                print(f"  - [{report_name}] 异常: {e}")
        
        if not consensus_ok:
            print("  ✗ 所有 reportName 尝试均失败")
            all_passed = False

        # ── Test 4: 评级汇总 API ──
        print("\n" + "=" * 60)
        print("Test 4: 评级汇总 API (Rating Summary)")
        print("=" * 60)
        rating_ok = False
        for report_name in [
            'RPT_DMSK_FN_MAINRATING',
            'RPT_DMSK_FN_RATINGSTAT',
            'RPT_F10_FINANCE_MAINRATING',
            'RPT_DMSK_FN_MAINRATING_STAT',
        ]:
            try:
                result = page.evaluate(f"""
                    async () => {{
                        const base = '/api/proxy/em-dc/securities/api/data/v1/get';
                        const params = new URLSearchParams({{
                            reportName: '{report_name}',
                            columns: 'SECURITY_CODE,RATING_BUY,RATING_OVERWEIGHT,RATING_HOLD,RATING_UNDERWEIGHT,RATING_SELL,CONSENSUS_RATING,CONSENSUS_TARGET_PRICE,TARGET_PRICE_HIGH,TARGET_PRICE_LOW,RATING_CHANGE',
                            filter: '(SECURITY_CODE="600519")',
                            pageNumber: '1',
                            pageSize: '1',
                            source: 'WEB',
                            client: 'WEB',
                        }});
                        const resp = await fetch(base + '?' + params.toString());
                        const text = await resp.text();
                        return {{ status: resp.status, ok: resp.ok, preview: text.substring(0, 800) }};
                    }}
                """)
                if result['ok']:
                    try:
                        data = json.loads(result['preview'])
                        if data.get('success') and data.get('result', {}).get('data'):
                            items = data['result']['data']
                            print(f"  ✓ [{report_name}] 成功！返回 {len(items)} 条评级")
                            item = items[0]
                            print(f"    买入={item.get('RATING_BUY')} | "
                                  f"增持={item.get('RATING_OVERWEIGHT')} | "
                                  f"持有={item.get('RATING_HOLD')} | "
                                  f"综合评级={item.get('CONSENSUS_RATING')} | "
                                  f"目标价={item.get('CONSENSUS_TARGET_PRICE')}")
                            rating_ok = True
                            break
                        else:
                            msg = data.get('message', '')
                            print(f"  - [{report_name}] 无数据: {msg[:80]}")
                    except json.JSONDecodeError:
                        print(f"  - [{report_name}] 非JSON响应: {result['preview'][:100]}")
                else:
                    print(f"  - [{report_name}] HTTP {result['status']}")
            except Exception as e:
                print(f"  - [{report_name}] 异常: {e}")
        
        if not rating_ok:
            print("  ✗ 所有 reportName 尝试均失败")
            all_passed = False

        # ── 总结 ──
        print("\n" + "=" * 60)
        if all_passed:
            print("✓ 全部测试通过！")
        else:
            print("⚠ 部分测试失败，请检查上述输出")
        print("=" * 60)

        browser.close()

if __name__ == '__main__':
    main()