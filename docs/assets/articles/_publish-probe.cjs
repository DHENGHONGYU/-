// CDP 连接用户 Chrome → 探测发文页 DOM
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
  log('CONNECT: localhost:9222');
  const browser = await chromium.connectOverCDP('http://localhost:9222');
  log('CONNECTED');

  const context = browser.contexts()[0] || await browser.newContext();
  const page = await context.newPage();

  log('GOTO: 发文页');
  await page.goto('https://cloud.tencent.com/developer/article/write', {
    waitUntil: 'domcontentloaded',
    timeout: 30000
  });
  await page.waitForTimeout(5000);

  const url = page.url();
  log('URL: ' + url);

  if (/login|passport/i.test(url)) {
    log('NOT_LOGGED_IN');
    await page.screenshot({ path: PROJECT + '/articles/_cdp_probe.png' });
    await page.close();
    await browser.close();
    process.exit(1);
  }

  log('LOGGED_IN');

  const probe = await page.evaluate(() => {
    const qsa = (s) => Array.from(document.querySelectorAll(s));
    return {
      title: document.title,
      url: location.href,
      bodyText: document.body?.innerText?.slice(0, 300) || '',
      titleInputs: qsa('input[type="text"], textarea, [contenteditable]').filter(el => {
        const ph = el.placeholder || el.getAttribute('aria-label') || el.getAttribute('placeholder') || '';
        const cls = el.className || '';
        return /标题|title|题目/i.test(ph + ' ' + cls);
      }).map(el => ({ tag: el.tagName, ph: el.placeholder || '', class: (el.className || '').slice(0, 100), id: el.id })).slice(0, 5),
      allInputs: qsa('input').map(el => ({ type: el.type, ph: el.placeholder || '', class: (el.className || '').slice(0, 80), id: el.id })).slice(0, 10),
      textareas: qsa('textarea').map(el => ({ ph: el.placeholder || '', class: (el.className || '').slice(0, 100), id: el.id })),
      contentEditables: qsa('[contenteditable="true"]').map(el => ({ class: (el.className || '').slice(0, 100), tag: el.tagName, id: el.id })),
      codeMirror: !!document.querySelector('.CodeMirror'),
      editorAreas: qsa('[class*="editor"], [class*="Editor"], [class*="markdown"], [class*="Markdown"]').map(el => ({ class: (el.className || '').slice(0, 100), tag: el.tagName, id: el.id })).slice(0, 10),
      fileInputs: qsa('input[type="file"]').map(el => ({ accept: el.accept, multiple: el.multiple, id: el.id, class: (el.className || '').slice(0, 60) })),
      allButtons: qsa('button, [role="button"]').map(el => ({ text: el.textContent?.trim().slice(0, 30), class: (el.className || '').slice(0, 60) })).filter(b => b.text).slice(0, 30),
      iframes: qsa('iframe').map(el => ({ src: (el.src || '').slice(0, 100), id: el.id, name: el.name })).slice(0, 5),
      tagArea: qsa('[class*="tag"], [class*="Tag"], [class*="label"], [class*="Label"]').map(el => ({ class: (el.className || '').slice(0, 80), tag: el.tagName, text: el.textContent?.trim().slice(0, 40) })).slice(0, 8)
    };
  });
  log('PROBE: ' + JSON.stringify(probe, null, 2));

  await page.screenshot({ path: PROJECT + '/articles/_cdp_writepage.png', fullPage: false });
  log('SCREENSHOT_SAVED');

  await page.close();
  await browser.close();
  log('DONE');
})().catch(e => { log('ERR: ' + e.message); process.exit(1); });
