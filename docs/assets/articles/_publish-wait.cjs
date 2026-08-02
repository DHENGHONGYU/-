// 等待用户登录 → 探测发文页 DOM → 截图
const { chromium } = require('playwright');
const fs = require('fs');

const PROJECT = process.env.KIMI_WORKSPACE || require('path').join(require('os').homedir(), 'Documents', 'kimi', 'Workspaces', '智能投研复盘系统V9');
const LOG = PROJECT + '/articles/_publish_log.txt';

function log(msg) {
  const line = new Date().toISOString().slice(11, 19) + ' ' + msg;
  console.log(line);
  try { fs.appendFileSync(LOG, line + '\n'); } catch(e) {}
}

(async () => {
  log('CONNECT');
  const browser = await chromium.connectOverCDP('http://localhost:9222');
  const context = browser.contexts()[0] || await browser.newContext();

  let page = context.pages().find(p => p.url().includes('cloud.tencent.com')) || await context.newPage();

  if (!page.url().includes('developer/article')) {
    log('GOTO 发文页');
    await page.goto('https://cloud.tencent.com/developer/article/write', { waitUntil: 'domcontentloaded', timeout: 30000 });
  }
  await page.waitForTimeout(3000);
  let url = page.url();
  log('URL: ' + url);

  if (/login|passport/i.test(url)) {
    log('WAIT_LOGIN: 请在新Chrome窗口扫码登录(5分钟)');
    try {
      await page.waitForURL(/developer\/article\/(write|edit|new)/, { timeout: 300000 });
      log('LOGIN_OK: ' + page.url());
    } catch(e) {
      log('LOGIN_TIMEOUT');
      await browser.close();
      process.exit(1);
    }
  }

  await page.waitForTimeout(5000);
  log('PAGE_READY: ' + page.url());

  const probe = await page.evaluate(() => {
    const qsa = (s) => Array.from(document.querySelectorAll(s));
    return {
      title: document.title,
      url: location.href,
      bodySnippet: document.body?.innerText?.slice(0, 400) || '',
      titleInputs: qsa('input[type="text"], textarea, [contenteditable]').filter(el => {
        const t = (el.placeholder || '') + ' ' + (el.getAttribute('aria-label') || '') + ' ' + (el.className || '');
        return /标题|title|题目/i.test(t);
      }).map(el => ({ tag: el.tagName, ph: el.placeholder || '', cls: (el.className || '').slice(0, 100), id: el.id })).slice(0, 5),
      allTextInputs: qsa('input[type="text"]').map(el => ({ ph: el.placeholder || '', cls: (el.className || '').slice(0, 80), id: el.id })).slice(0, 8),
      textareas: qsa('textarea').map(el => ({ ph: el.placeholder || '', cls: (el.className || '').slice(0, 100), id: el.id })),
      contentEditables: qsa('[contenteditable="true"]').map(el => ({ cls: (el.className || '').slice(0, 100), tag: el.tagName, id: el.id })),
      codeMirror: !!document.querySelector('.CodeMirror'),
      editorDivs: qsa('[class*="editor"], [class*="Editor"], [class*="markdown"], [class*="write"]').map(el => ({ cls: (el.className || '').slice(0, 100), tag: el.tagName, id: el.id })).slice(0, 10),
      fileInputs: qsa('input[type="file"]').map(el => ({ accept: el.accept, multiple: el.multiple, id: el.id })),
      allButtons: qsa('button, [role="button"]').map(el => el.textContent?.trim().slice(0, 25)).filter(Boolean).slice(0, 30),
      iframes: qsa('iframe').map(el => ({ src: (el.src || '').slice(0, 80), id: el.id })).slice(0, 5),
      tagAreas: qsa('[class*="tag"], [class*="Tag"]').map(el => ({ cls: (el.className || '').slice(0, 60), text: el.textContent?.trim().slice(0, 40) })).slice(0, 8)
    };
  });
  log('PROBE: ' + JSON.stringify(probe, null, 2));

  await page.screenshot({ path: PROJECT + '/articles/_cdp_writepage.png', fullPage: false });
  log('SCREENSHOT_SAVED');

  await browser.close();
  log('DONE');
})().catch(e => { log('ERR: ' + e.message); process.exit(1); });
