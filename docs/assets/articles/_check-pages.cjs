const { chromium } = require('playwright');
const fs = require('fs');
const PROJECT = 'C:/Users/huawei/Documents/kimi/Workspaces/智能投研复盘系统V9';

(async () => {
  const browser = await chromium.connectOverCDP('http://localhost:9222');
  const context = browser.contexts()[0];
  const pages = context.pages();
  console.log('PAGE_COUNT: ' + pages.length);
  for (const p of pages) { console.log('PAGE_URL: ' + p.url()); }

  let page = pages.find(p => p.url().includes('developer/article')) || pages[0];
  if (!page) { page = await context.newPage(); }

  // 如果不在发文页，尝试导航
  if (!page.url().includes('developer/article/write')) {
    console.log('NAVIGATE_TO_WRITE');
    await page.goto('https://cloud.tencent.com/developer/article/write', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(4000);
  }

  const url = page.url();
  console.log('CURRENT_URL: ' + url);

  if (/login|passport/i.test(url)) {
    console.log('STILL_NEED_LOGIN');
    await browser.close();
    process.exit(1);
  }

  console.log('LOGGED_IN_OK');
  const probe = await page.evaluate(() => {
    const qsa = (s) => Array.from(document.querySelectorAll(s));
    return {
      title: document.title,
      url: location.href,
      bodySnippet: document.body?.innerText?.slice(0, 400) || '',
      titleInputs: qsa('input[type="text"], textarea, [contenteditable]').filter(el => /标题|title|题目/i.test((el.placeholder||'') + ' ' + (el.className||''))).map(el => ({ tag: el.tagName, ph: el.placeholder||'', cls: (el.className||'').slice(0,100), id: el.id })).slice(0,5),
      allTextInputs: qsa('input[type="text"]').map(el => ({ ph: el.placeholder||'', cls: (el.className||'').slice(0,80), id: el.id })).slice(0,8),
      textareas: qsa('textarea').map(el => ({ ph: el.placeholder||'', cls: (el.className||'').slice(0,100), id: el.id })),
      contentEditables: qsa('[contenteditable="true"]').map(el => ({ cls: (el.className||'').slice(0,100), tag: el.tagName, id: el.id })),
      codeMirror: !!document.querySelector('.CodeMirror'),
      editorDivs: qsa('[class*="editor"],[class*="Editor"],[class*="markdown"],[class*="write"]').map(el => ({ cls: (el.className||'').slice(0,100), tag: el.tagName, id: el.id })).slice(0,10),
      fileInputs: qsa('input[type="file"]').map(el => ({ accept: el.accept, multiple: el.multiple, id: el.id })),
      allButtons: qsa('button,[role="button"]').map(el => el.textContent?.trim().slice(0,25)).filter(Boolean).slice(0,30),
      iframes: qsa('iframe').map(el => ({ src: (el.src||'').slice(0,80), id: el.id })).slice(0,5)
    };
  });
  console.log('PROBE: ' + JSON.stringify(probe, null, 2));
  await page.screenshot({ path: PROJECT + '/articles/_cdp_writepage.png', fullPage: false });
  console.log('SCREENSHOT_SAVED');
  await browser.close();
  console.log('DONE');
})().catch(e => { console.log('ERR: ' + e.message); process.exit(1); });
