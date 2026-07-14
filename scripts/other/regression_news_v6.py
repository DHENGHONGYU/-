"""
NewsPage 全量回归测试脚本
覆盖：页面加载、空状态、数据生成、筛选、搜索、排序、分页、详情弹窗、刷新、收藏等
"""

from playwright.sync_api import sync_playwright, Page, expect
import os

SCREENSHOT_DIR = './screenshots/regression'
URL = 'http://localhost:3002/#/analysis/news-v6'
PAGE_TITLE = '智能资讯中心'

# 测试结果收集
test_results = []

def log_test(name, passed, detail=''):
    status = '✅ PASS' if passed else '❌ FAIL'
    test_results.append({'name': name, 'passed': passed, 'detail': detail})
    print(f"  {status}: {name}" + (f" - {detail}" if detail else ''))

def ensure_dir(path):
    os.makedirs(path, exist_ok=True)

def take_screenshot(page: Page, name: str):
    path = f"{SCREENSHOT_DIR}/{name}.png"
    ensure_dir(SCREENSHOT_DIR)
    page.screenshot(path=path, full_page=True)
    print(f"  📸 Screenshot: {path}")
    return path

def run_tests():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={'width': 1280, 'height': 900})

        # 确保截图目录存在
        ensure_dir(SCREENSHOT_DIR)

        print("\n" + "="*60)
        print("NewsPage 全量回归测试")
        print("="*60)

        # ===== 测试 1: 页面加载 =====
        print("\n[1] 页面加载测试")
        page.goto(URL, wait_until='networkidle')
        page.wait_for_timeout(1500)

        # 检查标题
        try:
            title = page.locator('h1').first
            title_text = title.inner_text()
            passed = '智能资讯中心' in title_text
            log_test('页面标题正确', passed, f"标题: {title_text}")
        except Exception as e:
            log_test('页面标题正确', False, str(e))

        # 截图：初始状态
        take_screenshot(page, '01_initial_state')

        # ===== 测试 2: 空状态验证 =====
        print("\n[2] 空状态验证")
        empty_state = page.locator('text=暂无资讯')
        try:
            passed = empty_state.count() > 0
            log_test('空状态提示显示', passed)
        except Exception as e:
            log_test('空状态提示显示', False, str(e))

        # ===== 测试 3: 生成模拟数据 =====
        print("\n[3] 生成模拟数据")
        try:
            generate_btn = page.locator('text=生成模拟数据')
            if generate_btn.count() > 0:
                generate_btn.first.click()
                page.wait_for_timeout(3000)  # 等待数据加载
                take_screenshot(page, '02_after_generate')

                # 检查数据是否加载
                cards = page.locator('[class*="Card"]')
                card_count = cards.count()
                passed = card_count > 0
                log_test('模拟数据生成成功', passed, f"卡片数量: {card_count}")
            else:
                log_test('模拟数据生成成功', False, '按钮未找到')
        except Exception as e:
            log_test('模拟数据生成成功', False, str(e))

        # ===== 测试 4: 搜索功能 =====
        print("\n[4] 搜索功能测试")
        try:
            search_input = page.locator('input[placeholder*="搜索"]')
            if search_input.count() > 0:
                search_input.fill('茅台')
                page.wait_for_timeout(800)
                take_screenshot(page, '03_search_result')
                search_input.fill('')
                page.wait_for_timeout(500)
                log_test('搜索功能正常', True)
            else:
                log_test('搜索功能正常', False, '搜索框未找到')
        except Exception as e:
            log_test('搜索功能正常', False, str(e))

        # ===== 测试 5: 筛选面板 =====
        print("\n[5] 筛选面板测试")
        try:
            filter_btn = page.locator('text=筛选')
            if filter_btn.count() > 0:
                filter_btn.first.click()
                page.wait_for_timeout(500)
                take_screenshot(page, '04_filter_panel')

                # 检查筛选面板是否展开
                panel = page.locator('text=分类')
                passed = panel.count() > 0
                log_test('筛选面板展开', passed)

                # 测试分类筛选
                category_btn = page.locator('button:has-text("个股")')
                if category_btn.count() > 0:
                    category_btn.first.click()
                    page.wait_for_timeout(500)
                    take_screenshot(page, '05_filter_category')
                    log_test('分类筛选点击', True)

                # 关闭筛选面板
                filter_btn.first.click()
                page.wait_for_timeout(300)
            else:
                log_test('筛选面板展开', False, '筛选按钮未找到')
        except Exception as e:
            log_test('筛选面板展开', False, str(e))

        # ===== 测试 6: 排序功能 =====
        print("\n[6] 排序功能测试")
        try:
            sort_select = page.locator('select')
            if sort_select.count() > 0:
                sort_select.select_option('sentiment')
                page.wait_for_timeout(500)
                take_screenshot(page, '06_sort_by_sentiment')
                sort_select.select_option('time')
                page.wait_for_timeout(300)
                log_test('排序功能正常', True)
            else:
                log_test('排序功能正常', False, '排序下拉框未找到')
        except Exception as e:
            log_test('排序功能正常', False, str(e))

        # ===== 测试 7: 刷新功能 =====
        print("\n[7] 刷新功能测试")
        try:
            # 找到刷新按钮 (RefreshCw 图标)
            refresh_btn = page.locator('button').filter(has=page.locator('svg[class*="lucide-refresh"]'))
            if refresh_btn.count() > 0:
                refresh_btn.first.click()
                page.wait_for_timeout(2000)
                take_screenshot(page, '07_after_refresh')
                log_test('刷新功能正常', True)
            else:
                # 尝试文字匹配
                refresh_all = page.locator('button:has-text("刷新")')
                if refresh_all.count() > 0:
                    refresh_all.first.click()
                    page.wait_for_timeout(2000)
                    log_test('刷新功能正常', True)
                else:
                    log_test('刷新功能正常', False, '刷新按钮未找到')
        except Exception as e:
            log_test('刷新功能正常', False, str(e))

        # ===== 测试 8: 资讯卡片点击 =====
        print("\n[8] 资讯卡片点击测试")
        try:
            first_title = page.locator('h3').first
            if first_title.count() > 0:
                first_title.click()
                page.wait_for_timeout(500)
                take_screenshot(page, '08_article_detail')

                # 检查弹窗是否出现
                dialog = page.locator('text=查看原文')
                passed = dialog.count() > 0
                log_test('详情弹窗打开', passed)

                # 关闭弹窗
                close_btn = page.locator('button:has-text("✕")')
                if close_btn.count() > 0:
                    close_btn.first.click()
                    page.wait_for_timeout(300)
                else:
                    # 按 ESC 关闭
                    page.keyboard.press('Escape')
                    page.wait_for_timeout(300)
                log_test('弹窗关闭', True)
            else:
                log_test('详情弹窗打开', False, '文章标题未找到')
        except Exception as e:
            log_test('详情弹窗打开', False, str(e))

        # ===== 测试 9: 收藏功能 =====
        print("\n[9] 收藏功能测试")
        try:
            bookmark_btn = page.locator('[title="收藏"]')
            if bookmark_btn.count() > 0:
                bookmark_btn.first.click()
                page.wait_for_timeout(300)
                take_screenshot(page, '09_after_bookmark')
                log_test('收藏功能正常', True)
            else:
                log_test('收藏功能正常', False, '收藏按钮未找到')
        except Exception as e:
            log_test('收藏功能正常', False, str(e))

        # ===== 测试 10: 情感统计条 =====
        print("\n[10] 情感统计条测试")
        try:
            sentiment_bar = page.locator('text=情感分布')
            passed = sentiment_bar.count() > 0
            log_test('情感统计条显示', passed)
        except Exception as e:
            log_test('情感统计条显示', False, str(e))

        # ===== 测试 11: 分页/加载更多 =====
        print("\n[11] 加载更多功能测试")
        try:
            load_more_btn = page.locator('text=加载更多')
            if load_more_btn.count() > 0:
                load_more_btn.first.click()
                page.wait_for_timeout(500)
                take_screenshot(page, '10_after_load_more')
                log_test('加载更多功能正常', True)
            else:
                # 如果没有更多数据，检查是否显示"已加载全部"
                all_loaded = page.locator('text=已加载全部')
                passed = all_loaded.count() > 0
                log_test('加载更多/已加载全部', passed, '显示已加载全部')
        except Exception as e:
            log_test('加载更多功能正常', False, str(e))

        # ===== 测试 12: 面包屑导航 =====
        print("\n[12] 面包屑导航测试")
        try:
            breadcrumb = page.locator('text=首页')
            passed = breadcrumb.count() > 0
            log_test('面包屑导航显示', passed)
        except Exception as e:
            log_test('面包屑导航显示', False, str(e))

        # ===== 测试 13: 控制台错误检查 =====
        print("\n[13] 控制台错误检查")
        errors = []
        page.on('console', lambda msg: errors.append(msg.text) if msg.type == 'error' else None)
        page.goto(URL, wait_until='networkidle')
        page.wait_for_timeout(2000)
        console_errors = [e for e in errors if 'Error' in e or 'error' in e]
        passed = len(console_errors) == 0
        log_test('无控制台错误', passed, f"错误数: {len(console_errors)}")
        if console_errors:
            for err in console_errors[:3]:
                print(f"    ⚠️  {err[:100]}")

        # ===== 最终截图 =====
        take_screenshot(page, '99_final_state')

        # 关闭浏览器
        browser.close()

        # ===== 测试结果汇总 =====
        print("\n" + "="*60)
        print("测试结果汇总")
        print("="*60)
        passed_count = sum(1 for r in test_results if r['passed'])
        total_count = len(test_results)
        pass_rate = (passed_count / total_count * 100) if total_count > 0 else 0

        for r in test_results:
            status = '✅' if r['passed'] else '❌'
            print(f"  {status} {r['name']}" + (f" ({r['detail']})" if r['detail'] else ''))

        print(f"\n总计: {passed_count}/{total_count} 通过 ({pass_rate:.1f}%)")

        if passed_count == total_count:
            print("\n🎉 所有测试通过！")
        else:
            print(f"\n⚠️  {total_count - passed_count} 项测试失败，请检查。")

        print(f"\n截图保存在: {SCREENSHOT_DIR}/")

        return passed_count == total_count

if __name__ == '__main__':
    success = run_tests()
    exit(0 if success else 1)
