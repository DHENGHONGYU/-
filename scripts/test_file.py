"""Playwright 使用 file:// 协议测试构建产物"""
import os
from playwright.sync_api import sync_playwright

dist_dir = os.path.join(os.path.dirname(__file__), "..", "dist-test")
index_path = os.path.join(dist_dir, "index.html")
file_url = f"file:///{index_path.replace(os.sep, '/')}"

screenshot_dir = os.path.join(os.path.dirname(__file__), "test-screenshots")
os.makedirs(screenshot_dir, exist_ok=True)

print(f"Testing: {file_url}")

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page()

    # 捕获 console
    console_msgs = []
    page.on("console", lambda msg: console_msgs.append(f"[{msg.type}] {msg.text}"))

    try:
        page.goto(file_url, timeout=15000, wait_until="domcontentloaded")
        page.wait_for_timeout(3000)
        title = page.title()
        print(f"✅ 页面加载: '{title}'")

        # 截图
        page.screenshot(path=os.path.join(screenshot_dir, "01-homepage-file.png"), full_page=True)
        print("✅ 首页截图已保存")

        # 检查导航
        nav_links = page.locator("nav a, [role='navigation'] a, .sidebar a, a[href]").all()
        print(f"📋 导航链接: {len(nav_links)} 个")

        for i, link in enumerate(nav_links[:10]):
            try:
                text = link.inner_text().strip()[:40]
                href = link.get_attribute("href") or ""
                print(f"  [{i}] '{text}' -> {href}")
            except:
                pass

        # 检查按钮
        buttons = page.locator("button").all()
        print(f"📋 按钮: {len(buttons)} 个")
        for i, btn in enumerate(buttons[:10]):
            try:
                text = btn.inner_text().strip()[:40]
                visible = btn.is_visible()
                disabled = btn.is_disabled()
                state = "可见" if visible else "隐藏"
                if disabled: state += "|禁用"
                print(f"  [{i}] '{text}' ({state})")
            except:
                pass

        # 检查输入框
        inputs = page.locator("input").all()
        print(f"📋 输入框: {len(inputs)} 个")

        # 检查表格
        tables = page.locator("table").all()
        print(f"📋 表格: {len(tables)} 个")

        # 检查图表
        charts = page.locator("svg, canvas, [class*=chart], [class*=Chart]").all()
        print(f"📋 图表/Canvas: {len(charts)} 个")

        # 控制台日志
        errors = [m for m in console_msgs if "error" in m.lower()]
        warnings = [m for m in console_msgs if "warn" in m.lower()]
        print(f"\n📡 控制台: {len(errors)} 错误, {len(warnings)} 警告")
        for e in errors[:5]:
            print(f"  ❌ {e[:120]}")
        for w in warnings[:5]:
            print(f"  ⚠️ {w[:120]}")

    except Exception as e:
        print(f"❌ 测试失败: {e}")

    browser.close()
    print("\n✅ 测试完成")