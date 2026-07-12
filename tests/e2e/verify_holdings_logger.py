"""验证持仓页面 logger 日志输出"""
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page()

    # 收集 console 日志
    logs = []
    page.on('console', lambda msg: logs.append(f'[{msg.type}] {msg.text}'))

    # 访问持仓管理页面
    page.goto('http://localhost:3001/#/trading/holdings')
    page.wait_for_load_state('networkidle')

    # 等数据加载完成
    page.wait_for_timeout(3000)

    print('=== 页面加载后的 Console 日志 ===')
    for log in logs:
        print(log)

    # 筛选日志
    print('\n=== INFO 级别日志 ===')
    info_logs = [l for l in logs if '[INFO]' in l or '[info]' in l.lower()]
    for log in info_logs:
        print(log)

    print('\n=== holdingsService 相关日志 ===')
    svc_logs = [l for l in logs if 'holdingsService' in l]
    for log in svc_logs:
        print(log)

    print('\n=== HoldingsPage 相关日志 ===')
    page_logs = [l for l in logs if 'HoldingsPage' in l]
    for log in page_logs:
        print(log)

    print('\n=== HoldingsFilter 相关日志 ===')
    filter_logs = [l for l in logs if 'HoldingsFilter' in l]
    for log in filter_logs:
        print(log)

    # 截图
    page.screenshot(path='/tmp/holdings_page.png', full_page=True)
    print('\n截图已保存到 /tmp/holdings_page.png')

    browser.close()