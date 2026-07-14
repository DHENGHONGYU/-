"""
智能投研复盘系统V9 — 浏览器自动化测试脚本
按页面、组件、按钮逐项测试
"""
import sys
import os
from playwright.sync_api import sync_playwright
from datetime import datetime

SCREENSHOT_DIR = os.path.join(os.path.dirname(__file__), "test-screenshots")
os.makedirs(SCREENSHOT_DIR, exist_ok=True)

BASE_URL = "http://192.168.3.10:5173"
TEST_REPORT = []
ERRORS = []

def now():
    return datetime.now().strftime("%H:%M:%S")

def ss(page, name):
    """截图并保存"""
    path = os.path.join(SCREENSHOT_DIR, f"{name}.png")
    page.screenshot(path=path, full_page=True)
    return path

def report(status, component, detail=""):
    icon = "✅" if status == "PASS" else "❌" if status == "FAIL" else "⚠️" if status == "WARN" else "🔍"
    msg = f"{icon} [{status}] {component}: {detail}"
    TEST_REPORT.append(msg)
    print(msg)

def run_tests():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(viewport={"width": 1920, "height": 1080})
        page = context.new_page()

        # 捕获 console 错误
        console_errors = []
        page.on("console", lambda msg: console_errors.append(f"[{msg.type}] {msg.text}") if msg.type in ("error", "warning") else None)

        print(f"\n{'='*60}")
        print(f"  智能投研复盘系统V9 — 浏览器自动化测试")
        print(f"  {now()} 开始测试")
        print(f"{'='*60}\n")

        # ============================================
        # 1. 首页加载测试
        # ============================================
        print("─" * 50)
        print("  测试 1: 首页加载")
        print("─" * 50)

        try:
            page.goto(BASE_URL, timeout=30000)
            page.wait_for_load_state("networkidle", timeout=30000)
            page.wait_for_timeout(2000)  # 等待 React 渲染完成
            title = page.title()
            report("PASS", "首页加载", f"标题: '{title}', URL: {page.url}")

            if not title:
                report("FAIL", "首页标题", "页面标题为空")
            else:
                report("PASS", "首页标题", title)

            ss(page, "01-homepage")
            report("PASS", "首页截图", "已保存")
        except Exception as e:
            report("FAIL", "首页加载", str(e))

        # ============================================
        # 2. 导航结构检查
        # ============================================
        print("\n" + "─" * 50)
        print("  测试 2: 导航结构")
        print("─" * 50)

        # 检查导航链接
        nav_links = page.locator("nav a, [role='navigation'] a, .nav a, .sidebar a").all()
        report("PASS" if len(nav_links) > 0 else "WARN", "导航链接", f"找到 {len(nav_links)} 个链接")

        for i, link in enumerate(nav_links[:10]):
            try:
                text = link.inner_text().strip()[:40]
                href = link.get_attribute("href") or ""
                report("PASS", f"导航链接 [{i}]", f"'{text}' -> {href}")
            except:
                report("WARN", f"导航链接 [{i}]", "无法获取文本")

        # 检查所有按钮
        buttons = page.locator("button").all()
        report("PASS" if len(buttons) > 0 else "WARN", "按钮总数", f"找到 {len(buttons)} 个按钮")

        for i, btn in enumerate(buttons[:15]):
            try:
                text = btn.inner_text().strip()[:40]
                visible = btn.is_visible()
                disabled = btn.is_disabled()
                state = "可见" if visible else "隐藏"
                if disabled: state += "|禁用"
                report("PASS", f"按钮 [{i}]", f"'{text}' ({state})")
            except:
                report("WARN", f"按钮 [{i}]", "无法获取状态")

        # ============================================
        # 3. 点击测试 — 逐个导航链接
        # ============================================
        print("\n" + "─" * 50)
        print("  测试 3: 页面导航")
        print("─" * 50)

        if nav_links:
            for i, link in enumerate(nav_links[:8]):
                try:
                    text = link.inner_text().strip()[:30]
                    href = link.get_attribute("href") or ""
                    if not href or href == "#" or href.startswith("javascript"):
                        continue

                    print(f"\n  [{i}] 点击导航: '{text}' -> {href}")
                    link.click()
                    page.wait_for_load_state("networkidle", timeout=15000)
                    page.wait_for_timeout(1500)

                    current_url = page.url
                    new_title = page.title()
                    report("PASS", f"导航至 [{text}]", f"URL: {current_url}, 标题: '{new_title}'")

                    ss(page, f"02-nav-{i}-{text.replace(' ', '-').replace('/', '-')[:20]}")
                    report("PASS", f"截图 [{text}]", "已保存")

                    # 检查页面是否有内容
                    body_text = page.locator("body").inner_text()[:200]
                    if len(body_text) > 20:
                        report("PASS", f"页面内容 [{text}]", f"正文长度: {len(body_text)}")
                    else:
                        report("WARN", f"页面内容 [{text}]", "页面内容较少，可能渲染异常")

                    # 导航回首页
                    page.goto(BASE_URL, timeout=15000)
                    page.wait_for_load_state("networkidle", timeout=15000)
                    page.wait_for_timeout(1000)
                    # 重新获取导航链接
                    nav_links = page.locator("nav a, [role='navigation'] a, .nav a, .sidebar a").all()

                except Exception as e:
                    report("FAIL", f"导航至 [{text}]", str(e))
                    # 恢复
                    try:
                        page.goto(BASE_URL, timeout=15000)
                        page.wait_for_load_state("networkidle", timeout=15000)
                        nav_links = page.locator("nav a, [role='navigation'] a, .nav a, .sidebar a").all()
                    except:
                        pass

        # ============================================
        # 4. 交互元素测试
        # ============================================
        print("\n" + "─" * 50)
        print("  测试 4: 交互元素")
        print("─" * 50)

        page.goto(BASE_URL, timeout=15000)
        page.wait_for_load_state("networkidle", timeout=15000)
        page.wait_for_timeout(2000)

        # 检查输入框
        inputs = page.locator("input").all()
        report("PASS" if len(inputs) > 0 else "WARN", "输入框", f"找到 {len(inputs)} 个")

        for i, inp in enumerate(inputs[:10]):
            try:
                inp_type = inp.get_attribute("type") or "text"
                placeholder = inp.get_attribute("placeholder") or ""
                name = inp.get_attribute("name") or ""
                state = "可见" if inp.is_visible() else "隐藏"
                if inp.is_disabled(): state += "|禁用"
                report("PASS", f"输入框 [{i}]", f"type={inp_type}, placeholder='{placeholder[:30]}', name='{name}' ({state})")
            except:
                report("WARN", f"输入框 [{i}]", "无法获取属性")

        # 检查下拉框
        selects = page.locator("select").all()
        report("PASS" if len(selects) > 0 else "WARN", "下拉框", f"找到 {len(selects)} 个")

        # 检查表格
        tables = page.locator("table").all()
        report("PASS" if len(tables) > 0 else "WARN", "表格", f"找到 {len(tables)} 个")

        # 检查图表容器
        charts = page.locator("[class*='chart'], [class*='Chart'], svg.recharts-surface, canvas").all()
        report("PASS" if len(charts) > 0 else "WARN", "图表/Canvas", f"找到 {len(charts)} 个")

        # ============================================
        # 5. 搜索/筛选功能测试
        # ============================================
        print("\n" + "─" * 50)
        print("  测试 5: 搜索/筛选功能")
        print("─" * 50)

        page.goto(BASE_URL, timeout=15000)
        page.wait_for_load_state("networkidle", timeout=15000)
        page.wait_for_timeout(2000)

        # 搜索框测试
        search_inputs = page.locator("input[type='search'], input[placeholder*='搜索'], input[placeholder*='search'], input[placeholder*='Search']").all()
        if search_inputs:
            try:
                search_inputs[0].click()
                search_inputs[0].fill("测试")
                report("PASS", "搜索框输入", "填充 '测试' 成功")
                search_inputs[0].clear()
                report("PASS", "搜索框清空", "已清空")
            except Exception as e:
                report("FAIL", "搜索框操作", str(e))
        else:
            # 尝试任意文本输入框
            text_inputs = page.locator("input[type='text'], input:not([type])").all()
            if text_inputs:
                report("WARN", "搜索框", f"未找到专用搜索框，找到 {len(text_inputs)} 个文本输入框")
                try:
                    text_inputs[0].click()
                    text_inputs[0].fill("测试")
                    text_inputs[0].clear()
                    report("PASS", "文本输入框", "填充/清空成功")
                except Exception as e:
                    report("FAIL", "文本输入框", str(e))
            else:
                report("WARN", "搜索框", "未找到任何输入框")

        # ============================================
        # 6. 控制台错误检查
        # ============================================
        print("\n" + "─" * 50)
        print("  测试 6: 控制台日志")
        print("─" * 50)

        if console_errors:
            report("WARN", "控制台错误", f"发现 {len(console_errors)} 条错误/警告")
            for err in console_errors[:10]:
                print(f"    {err[:120]}")
        else:
            report("PASS", "控制台错误", "无错误/警告")

        # ============================================
        # 7. 响应式/布局检查
        # ============================================
        print("\n" + "─" * 50)
        print("  测试 7: 响应式布局")
        print("─" * 50)

        page.goto(BASE_URL, timeout=15000)
        page.wait_for_load_state("networkidle", timeout=15000)
        page.wait_for_timeout(1000)

        # 移动端视口
        page.set_viewport_size({"width": 375, "height": 812})
        page.wait_for_timeout(1000)
        ss(page, "03-mobile-viewport")
        report("PASS", "移动端视口 (375x812)", "截图已保存")

        # 平板视口
        page.set_viewport_size({"width": 768, "height": 1024})
        page.wait_for_timeout(1000)
        ss(page, "04-tablet-viewport")
        report("PASS", "平板视口 (768x1024)", "截图已保存")

        # 恢复桌面
        page.set_viewport_size({"width": 1920, "height": 1080})
        page.wait_for_timeout(1000)
        ss(page, "05-desktop-viewport")
        report("PASS", "桌面视口 (1920x1080)", "截图已保存")

        # ============================================
        # 汇总
        # ============================================
        print("\n" + "=" * 60)
        print("  测试汇总")
        print("=" * 60)

        pass_count = sum(1 for r in TEST_REPORT if "PASS" in r)
        fail_count = sum(1 for r in TEST_REPORT if "FAIL" in r)
        warn_count = sum(1 for r in TEST_REPORT if "WARN" in r)

        print(f"\n  ✅ 通过: {pass_count}")
        print(f"  ❌ 失败: {fail_count}")
        print(f"  ⚠️  警告: {warn_count}")
        print(f"  📸 截图: {SCREENSHOT_DIR}")
        print(f"  📋 总计: {len(TEST_REPORT)} 项测试\n")

        browser.close()

    return pass_count, fail_count, warn_count

if __name__ == "__main__":
    run_tests()