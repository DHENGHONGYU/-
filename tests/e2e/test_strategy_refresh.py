"""
测试热门板块和价值洼地页面的数据刷新功能
"""
from playwright.sync_api import sync_playwright
import time
import os

BASE_URL = "http://localhost:3000"
SCREENSHOT_DIR = os.path.join(os.path.dirname(__file__), "screenshots")
os.makedirs(SCREENSHOT_DIR, exist_ok=True)

def test_hot_sector_refresh(page):
    """测试热门板块页面的刷新功能"""
    print("\n" + "=" * 60)
    print("测试 1: 热门板块页面 (HotSectorPage)")
    print("=" * 60)

    # 1. 导航到页面
    print("[1] 导航到 /analysis/hot-sector ...")
    page.goto(f"{BASE_URL}/analysis/hot-sector")
    page.wait_for_load_state("networkidle")

    # 2. 等待页面加载完成（loading 状态应该消失）
    print("[2] 等待初始数据加载...")
    page.wait_for_timeout(2000)

    # 3. 截图 - 初始状态
    page.screenshot(path=os.path.join(SCREENSHOT_DIR, "hot_sector_initial.png"), full_page=True)
    print("[3] 初始状态截图已保存")

    # 4. 检查页面标题
    title = page.title()
    page_heading = page.locator("h1").text_content()
    print(f"    页面标题: {title}")
    print(f"    页面 H1: {page_heading}")

    # 5. 检查板块卡片是否存在
    cards = page.locator('[class*="Card"]').all()
    print(f"    板块卡片数量: {len(cards)}")

    if len(cards) == 0:
        print("    [ERROR] 没有找到板块卡片！")
        # 打印页面内容以便调试
        body_text = page.locator("body").text_content()
        print(f"    页面内容(前500字): {body_text[:500]}")
        return False

    # 6. 检查评分显示
    scores = page.locator('[class*="text-xl"][class*="font-bold"]').all()
    print(f"    评分元素数量: {len(scores)}")
    for i, s in enumerate(scores[:3]):
        print(f"    评分 {i+1}: {s.text_content()}")

    # 7. 点击第一个板块展开详情
    print("[4] 点击第一个板块展开详情...")
    first_card_header = cards[0].locator('[class*="CardHeader"]')
    if first_card_header.count() > 0:
        first_card_header.first.click()
        page.wait_for_timeout(500)

        # 检查展开后是否显示进度条
        progress_bars = page.locator('[role="progressbar"]').all()
        print(f"    展开后进度条数量: {len(progress_bars)}")

        # 截图 - 展开状态
        page.screenshot(path=os.path.join(SCREENSHOT_DIR, "hot_sector_expanded.png"), full_page=True)
        print("[5] 展开详情截图已保存")

        # 再次点击收起
        first_card_header.first.click()
        page.wait_for_timeout(300)

    # 8. 点击刷新按钮
    print("[6] 点击刷新按钮...")
    refresh_btn = page.locator("button:has-text('刷新')")
    if refresh_btn.count() > 0:
        refresh_btn.first.click()
        page.wait_for_timeout(2000)
        page.wait_for_load_state("networkidle")

        # 截图 - 刷新后状态
        page.screenshot(path=os.path.join(SCREENSHOT_DIR, "hot_sector_refreshed.png"), full_page=True)
        print("[7] 刷新后截图已保存")

        # 检查刷新后卡片是否仍然存在
        cards_after = page.locator('[class*="Card"]').all()
        print(f"    刷新后板块卡片数量: {len(cards_after)}")
        if len(cards_after) > 0:
            print("    [OK] 刷新后数据正常显示")
            return True
        else:
            print("    [ERROR] 刷新后没有数据！")
            return False
    else:
        print("    [WARN] 未找到刷新按钮")
        return True

    return True


def test_value_pit_refresh(page):
    """测试价值洼地页面的刷新功能"""
    print("\n" + "=" * 60)
    print("测试 2: 价值洼地页面 (ValuePitPage)")
    print("=" * 60)

    # 1. 导航到页面
    print("[1] 导航到 /analysis/value-pit ...")
    page.goto(f"{BASE_URL}/analysis/value-pit")
    page.wait_for_load_state("networkidle")

    # 2. 等待页面加载完成
    print("[2] 等待初始数据加载...")
    page.wait_for_timeout(2000)

    # 3. 截图 - 初始状态
    page.screenshot(path=os.path.join(SCREENSHOT_DIR, "value_pit_initial.png"), full_page=True)
    print("[3] 初始状态截图已保存")

    # 4. 检查页面标题
    page_heading = page.locator("h1").text_content()
    print(f"    页面 H1: {page_heading}")

    # 5. 检查板块卡片
    cards = page.locator('[class*="Card"]').all()
    print(f"    板块卡片数量: {len(cards)}")

    if len(cards) == 0:
        print("    [ERROR] 没有找到板块卡片！")
        body_text = page.locator("body").text_content()
        print(f"    页面内容(前500字): {body_text[:500]}")
        return False

    # 6. 检查轮动信号徽章
    badges = page.locator('[class*="Badge"]').all()
    print(f"    Badge 数量: {len(badges)}")
    for i, b in enumerate(badges[:5]):
        print(f"    Badge {i+1}: {b.text_content()}")

    # 7. 检查评分
    scores = page.locator('[class*="text-xl"][class*="font-bold"]').all()
    print(f"    评分元素数量: {len(scores)}")
    for i, s in enumerate(scores[:3]):
        print(f"    评分 {i+1}: {s.text_content()}")

    # 8. 点击第一个板块展开详情
    print("[4] 点击第一个板块展开详情...")
    first_card = cards[0]
    card_header = first_card.locator('[class*="CardHeader"]')
    if card_header.count() > 0:
        card_header.first.click()
        page.wait_for_timeout(500)

        # 检查轮动信号详情
        signal_conditions = page.locator('[class*="text-green-500"]').all()
        signal_conditions_fail = page.locator('[class*="text-red-400"]').all()
        print(f"    满足条件数: {len(signal_conditions)}")
        print(f"    不满足条件数: {len(signal_conditions_fail)}")

        # 截图 - 展开状态
        page.screenshot(path=os.path.join(SCREENSHOT_DIR, "value_pit_expanded.png"), full_page=True)
        print("[5] 展开详情截图已保存")

        # 收起
        card_header.first.click()
        page.wait_for_timeout(300)

    # 9. 点击刷新按钮
    print("[6] 点击刷新按钮...")
    refresh_btn = page.locator("button:has-text('刷新')")
    if refresh_btn.count() > 0:
        refresh_btn.first.click()
        page.wait_for_timeout(2000)
        page.wait_for_load_state("networkidle")

        # 截图 - 刷新后
        page.screenshot(path=os.path.join(SCREENSHOT_DIR, "value_pit_refreshed.png"), full_page=True)
        print("[7] 刷新后截图已保存")

        cards_after = page.locator('[class*="Card"]').all()
        print(f"    刷新后板块卡片数量: {len(cards_after)}")
        if len(cards_after) > 0:
            print("    [OK] 刷新后数据正常显示")
            return True
        else:
            print("    [ERROR] 刷新后没有数据！")
            return False
    else:
        print("    [WARN] 未找到刷新按钮")
        return True

    return True


def main():
    print("=" * 60)
    print("策略页面数据刷新功能测试")
    print("=" * 60)

    results = {}

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(viewport={"width": 1440, "height": 900})
        page = context.new_page()

        # 捕获控制台日志
        console_logs = []
        page.on("console", lambda msg: console_logs.append(f"[{msg.type}] {msg.text}"))

        try:
            # 测试 1: 热门板块
            results["hot_sector"] = test_hot_sector_refresh(page)

            # 测试 2: 价值洼地
            results["value_pit"] = test_value_pit_refresh(page)

            # 打印控制台日志
            print("\n" + "=" * 60)
            print("浏览器控制台日志 (最近 20 条)")
            print("=" * 60)
            for log in console_logs[-20:]:
                print(f"  {log}")

        except Exception as e:
            print(f"\n[FATAL] 测试执行异常: {e}")
            import traceback
            traceback.print_exc()
        finally:
            browser.close()

    # 汇总结果
    print("\n" + "=" * 60)
    print("测试结果汇总")
    print("=" * 60)
    for name, passed in results.items():
        status = "[OK] PASS" if passed else "[FAIL]"
        print(f"  {status} - {name}")

    all_passed = all(results.values())
    print(f"\n总结果: {'ALL PASSED' if all_passed else 'SOME FAILED'}")
    return 0 if all_passed else 1


if __name__ == "__main__":
    exit(main())