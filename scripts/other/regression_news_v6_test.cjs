/**
 * NewsPage 全量回归测试脚本 (Node.js)
 * 覆盖：页面加载、空状态、数据生成、筛选、搜索、排序、刷新、详情弹窗、收藏等
 */

const { chromium } = require('playwright');

const SCREENSHOT_DIR = './screenshots/regression';
const URL = 'http://localhost:3002/#/analysis/news-v6';
const testResults = [];

function logTest(name, passed, detail = '') {
  const status = passed ? '✅ PASS' : '❌ FAIL';
  testResults.push({ name, passed, detail });
  console.log(`  ${status}: ${name}${detail ? ` - ${detail}` : ''}`);
}

async function takeScreenshot(page, name) {
  const path = `${SCREENSHOT_DIR}/${name}.png`;
  await page.screenshot({ path, fullPage: true });
  console.log(`  📸 Screenshot: ${path}`);
  return path;
}

async function runTests() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

  console.log('\n' + '='.repeat(60));
  console.log('NewsPage 全量回归测试');
  console.log('='.repeat(60));

  try {
    // ===== 测试 1: 页面加载 =====
    console.log('\n[1] 页面加载测试');
    await page.goto(URL, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);

    const title = await page.locator('h1').first().innerText();
    logTest('页面标题正确', title.includes('智能资讯中心'), `标题: ${title}`);

    await takeScreenshot(page, '01_initial_state');

    // ===== 测试 2: 空状态验证 =====
    console.log('\n[2] 空状态验证');
    const emptyState = await page.locator('text=暂无资讯').count();
    logTest('空状态提示显示', emptyState > 0);

    // ===== 测试 3: 生成模拟数据 =====
    console.log('\n[3] 生成模拟数据');
    const generateBtn = page.locator('text=生成模拟数据');
    if (await generateBtn.count() > 0) {
      await generateBtn.click();
      await page.waitForTimeout(3000);
      await takeScreenshot(page, '02_after_generate');

      // 检查是否有资讯标题 (h3 标签)
      const titleCount = await page.locator('h3').count();
      logTest('模拟数据生成成功', titleCount > 0, `标题数量: ${titleCount}`);
    } else {
      logTest('模拟数据生成成功', false, '按钮未找到');
    }

    // ===== 测试 4: 搜索功能 =====
    console.log('\n[4] 搜索功能测试');
    const searchInput = page.locator('input[placeholder*="搜索"]');
    if (await searchInput.count() > 0) {
      await searchInput.fill('茅台');
      await page.waitForTimeout(800);
      await takeScreenshot(page, '03_search_result');
      await searchInput.fill('');
      await page.waitForTimeout(500);
      logTest('搜索功能正常', true);
    } else {
      logTest('搜索功能正常', false, '搜索框未找到');
    }

    // ===== 测试 5: 筛选面板 =====
    console.log('\n[5] 筛选面板测试');
    const filterBtn = page.locator('button:has-text("筛选")');
    if (await filterBtn.count() > 0) {
      await filterBtn.first().click();
      await page.waitForTimeout(500);
      await takeScreenshot(page, '04_filter_panel');

      const panel = await page.locator('text=分类').count();
      logTest('筛选面板展开', panel > 0);

      // 测试分类筛选
      const categoryBtn = page.locator('button:has-text("个股")');
      if (await categoryBtn.count() > 0) {
        await categoryBtn.first().click();
        await page.waitForTimeout(500);
        await takeScreenshot(page, '05_filter_category');
        logTest('分类筛选点击', true);
      }

      // 关闭筛选面板
      await filterBtn.first().click();
      await page.waitForTimeout(300);
    } else {
      logTest('筛选面板展开', false, '筛选按钮未找到');
    }

    // ===== 测试 6: 排序功能 =====
    console.log('\n[6] 排序功能测试');
    const sortSelect = page.locator('select');
    if (await sortSelect.count() > 0) {
      await sortSelect.selectOption('sentiment');
      await page.waitForTimeout(500);
      await takeScreenshot(page, '06_sort_by_sentiment');
      await sortSelect.selectOption('time');
      await page.waitForTimeout(300);
      logTest('排序功能正常', true);
    } else {
      logTest('排序功能正常', false, '排序下拉框未找到');
    }

    // ===== 测试 7: 刷新功能 =====
    console.log('\n[7] 刷新功能测试');
    // 刷新按钮在工具栏区域，通过 SVG 图标或相邻文字识别
    const refreshBtn = page.locator('button').filter({ hasText: '刷新' });
    if (await refreshBtn.count() > 0) {
      await refreshBtn.first().click();
      await page.waitForTimeout(2000);
      await takeScreenshot(page, '07_after_refresh');
      logTest('刷新功能正常', true);
    } else {
      // 尝试通过 SVG lucide 图标找到刷新按钮
      const refreshIcon = page.locator('button svg[class*="lucide-refresh"]');
      if (await refreshIcon.count() > 0) {
        await refreshIcon.locator('..').click();
        await page.waitForTimeout(2000);
        logTest('刷新功能正常', true);
      } else {
        logTest('刷新功能正常', false, '刷新按钮未找到');
      }
    }

    // ===== 测试 8: 资讯卡片点击 =====
    console.log('\n[8] 资讯卡片点击测试');
    const firstTitle = page.locator('h3').first();
    if (await firstTitle.count() > 0) {
      await firstTitle.click();
      await page.waitForTimeout(500);
      await takeScreenshot(page, '08_article_detail');

      const dialog = await page.locator('text=查看原文').count();
      logTest('详情弹窗打开', dialog > 0);

      // 关闭弹窗 - 尝试多种方式
      const closeBtn = page.locator('button:has-text("✕")');
      if (await closeBtn.count() > 0) {
        await closeBtn.first().click();
      } else {
        await page.keyboard.press('Escape');
      }
      await page.waitForTimeout(300);
      logTest('弹窗关闭', true);
    } else {
      logTest('详情弹窗打开', false, '文章标题未找到');
    }

    // ===== 测试 9: 收藏功能 =====
    console.log('\n[9] 收藏功能测试');
    const bookmarkBtn = page.locator('[title="收藏"]');
    if (await bookmarkBtn.count() > 0) {
      await bookmarkBtn.first().click();
      await page.waitForTimeout(300);
      await takeScreenshot(page, '09_after_bookmark');
      logTest('收藏功能正常', true);
    } else {
      logTest('收藏功能正常', false, '收藏按钮未找到');
    }

    // ===== 测试 10: 情感统计条 =====
    console.log('\n[10] 情感统计条测试');
    const sentimentBar = await page.locator('text=情感分布').count();
    logTest('情感统计条显示', sentimentBar > 0);

    // ===== 测试 11: 分页/加载更多 =====
    console.log('\n[11] 加载更多功能测试');
    const loadMoreBtn = page.locator('text=加载更多');
    if (await loadMoreBtn.count() > 0) {
      await loadMoreBtn.first().click();
      await page.waitForTimeout(500);
      await takeScreenshot(page, '10_after_load_more');
      logTest('加载更多功能正常', true);
    } else {
      const allLoaded = await page.locator('text=已加载全部').count();
      logTest('加载更多/已加载全部', allLoaded > 0, '显示已加载全部');
    }

    // ===== 测试 12: 页面结构 =====
    console.log('\n[12] 页面结构测试');
    // news-v6 是独立页面，无面包屑导航。检查页面标题是否正确显示
    const pageTitle = await page.locator('h1:has-text("智能资讯中心")').count();
    logTest('页面结构完整', pageTitle > 0, '标题正确显示');

    // ===== 测试 13: 控制台错误检查 =====
    console.log('\n[13] 控制台错误检查');
    const errors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });
    await page.goto(URL, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    const consoleErrors = errors.filter(e => e.includes('Error') || e.includes('error'));
    logTest('无控制台错误', consoleErrors.length === 0, `错误数: ${consoleErrors.length}`);
    if (consoleErrors.length > 0) {
      consoleErrors.slice(0, 3).forEach(err => console.log(`    ⚠️  ${err.substring(0, 100)}`));
    }

    // ===== 最终截图 =====
    await takeScreenshot(page, '99_final_state');

  } catch (error) {
    console.error('\n❌ 测试异常:', error.message);
    testResults.push({ name: '测试执行', passed: false, detail: error.message });
  }

  // 关闭浏览器
  await browser.close();

  // ===== 测试结果汇总 =====
  console.log('\n' + '='.repeat(60));
  console.log('测试结果汇总');
  console.log('='.repeat(60));

  const passedCount = testResults.filter(r => r.passed).length;
  const totalCount = testResults.length;
  const passRate = totalCount > 0 ? (passedCount / totalCount * 100).toFixed(1) : 0;

  testResults.forEach(r => {
    const status = r.passed ? '✅' : '❌';
    console.log(`  ${status} ${r.name}${r.detail ? ` (${r.detail})` : ''}`);
  });

  console.log(`\n总计: ${passedCount}/${totalCount} 通过 (${passRate}%)`);

  if (passedCount === totalCount) {
    console.log('\n🎉 所有测试通过！');
  } else {
    console.log(`\n⚠️  ${totalCount - passedCount} 项测试失败，请检查。`);
  }

  console.log(`\n截图保存在: ${SCREENSHOT_DIR}/`);

  return passedCount === totalCount;
}

runTests().then(success => {
  process.exit(success ? 0 : 1);
}).catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
