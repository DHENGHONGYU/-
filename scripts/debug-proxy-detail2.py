"""
深度调试：获取完整响应结构和搜索正确的 API
"""
from playwright.sync_api import sync_playwright
import json

def main():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        
        # ── 1. 分红配股：完整第一条记录 ──
        print("=" * 70)
        print("1. 分红配股 完整响应")
        print("=" * 70)
        page = browser.new_page()
        page.goto('http://localhost:5173', timeout=15000)
        page.wait_for_load_state('networkidle')
        
        result = page.evaluate("""
            async () => {
                const url = '/api/proxy/em-f10/PC_HSF10/BonusFinancing/PageAjax?code=SH600519';
                const resp = await fetch(url);
                return await resp.text();
            }
        """)
        try:
            data = json.loads(result)
            if 'fhyx' in data:
                records = data['fhyx']
                print(f"  记录数: {len(records)}")
                print(f"\n  第1条完整: {json.dumps(records[0], ensure_ascii=False, indent=2)}")
                if len(records) > 1:
                    print(f"\n  第2条完整: {json.dumps(records[1], ensure_ascii=False, indent=2)}")
        except Exception as e:
            print(f"  解析失败: {e}")
            print(f"  原始: {result[:1000]}")
        
        page.close()

        # ── 2. 股本结构：直接访问东财原站 ──
        print("\n" + "=" * 70)
        print("2. 股本结构: 直接访问东财原站")
        print("=" * 70)
        page = browser.new_page()
        urls = [
            'https://emweb.securities.eastmoney.com/PC_HSF10/CapitalStructure/PageAjax?code=SH600519',
            'https://emweb.securities.eastmoney.com/PC_HSF10/CapitalStructure/PageAjax?code=600519',
        ]
        for url in urls:
            try:
                resp = page.goto(url, timeout=10000)
                text = page.content()
                print(f"  {url}")
                print(f"    status={resp.status} preview={text[:200]}")
            except Exception as e:
                print(f"  {url}: 异常={e}")
        page.close()

        # ── 3. 东财 datacenter: 直接访问查找可用 API ──
        print("\n" + "=" * 70)
        print("3. 东财 datacenter: 直接访问探索")
        print("=" * 70)
        page = browser.new_page()
        try:
            # 访问东财数据中心个股页面，查看网络请求
            page.goto('https://data.eastmoney.com/report/zwstock.jshtml?code=600519', timeout=15000)
            page.wait_for_timeout(3000)
            print(f"  页面标题: {page.title()}")
            page.screenshot(path='d:/FinSightV9/scripts/em-data-page.png', full_page=False)
            print("  截图已保存: em-data-page.png")
        except Exception as e:
            print(f"  访问失败: {e}")
        page.close()

        # ── 4. 尝试东财 push2 API 获取股本结构 ──
        print("\n" + "=" * 70)
        print("4. 东财 push2 API 股本结构")
        print("=" * 70)
        page = browser.new_page()
        page.goto('http://localhost:5173', timeout=15000)
        page.wait_for_load_state('networkidle')
        result = page.evaluate("""
            async () => {
                // 使用东财 push2 行情接口获取股本信息
                const url = 'https://push2.eastmoney.com/api/qt/stock/get?secid=1.600519&fields=f20,f21,f38,f39,f40,f41,f42';
                const resp = await fetch(url);
                const text = await resp.text();
                return text.substring(0, 1000);
            }
        """)
        print(f"  push2 响应: {result[:500]}")
        page.close()

        browser.close()

if __name__ == '__main__':
    main()