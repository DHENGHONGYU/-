const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });

  // 打开页面
  await page.goto('http://localhost:3002/#/analysis/news-v6', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);

  // 截图：空状态
  await page.screenshot({ path: './screenshots/news-v6-step1-empty.png', fullPage: true });
  console.log('Step 1: Empty state captured');

  // 点击"生成模拟数据"
  const generateBtn = await page.$('text=生成模拟数据');
  if (generateBtn) {
    await generateBtn.click();
    console.log('Clicked generate mock data');
    await page.waitForTimeout(3000); // 等待数据加载

    // 截图：有数据状态
    await page.screenshot({ path: './screenshots/news-v6-step2-with-data.png', fullPage: true });
    console.log('Step 2: Data loaded state captured');

    // 测试筛选功能
    const filterBtn = await page.$('text=筛选');
    if (filterBtn) {
      await filterBtn.click();
      await page.waitForTimeout(500);
      await page.screenshot({ path: './screenshots/news-v6-step3-filter-open.png', fullPage: true });
      console.log('Step 3: Filter panel open captured');
    }

    // 测试搜索功能
    const searchInput = await page.$('input[placeholder*="搜索"]');
    if (searchInput) {
      await searchInput.fill('茅台');
      await page.waitForTimeout(1000);
      await page.screenshot({ path: './screenshots/news-v6-step4-search.png', fullPage: true });
      console.log('Step 4: Search result captured');
      await searchInput.fill('');
      await page.waitForTimeout(500);
    }

    // 点击第一篇文章
    const firstCard = await page.$('h3');
    if (firstCard) {
      await firstCard.click();
      await page.waitForTimeout(500);
      await page.screenshot({ path: './screenshots/news-v6-step5-detail.png', fullPage: true });
      console.log('Step 5: Article detail captured');
    }
  } else {
    console.log('Generate button not found');
  }

  await browser.close();
  console.log('All screenshots captured successfully');
})();
