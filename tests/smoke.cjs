// Playwright 스모크 테스트: node tests/smoke.cjs
const { chromium } = require('playwright');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const PORT = 5199;
const BASE = `http://localhost:${PORT}/`;
let failures = 0;

function check(cond, msg) {
  if (cond) console.log('  ✓ ' + msg);
  else { console.error('  ✗ ' + msg); failures++; }
}

async function finishPractice(page) {
  // 모든 문항에서 1번을 고르고 다음으로 진행
  for (let i = 0; i < 20; i++) {
    if (await page.locator('.result').count()) return;
    await page.keyboard.press('1');
    await page.locator('.actions .btn.primary').click();
  }
}

(async () => {
  const { startServer } = await import(pathToFileURL(path.join(__dirname, '../scripts/serve.mjs')).href);
  const server = await startServer(PORT);
  const browser = await chromium.launch();
  const errors = [];

  try {
    console.log('데스크톱');
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await ctx.newPage();
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    page.on('dialog', (d) => d.accept());

    await page.goto(BASE);
    await page.waitForSelector('h1');
    check((await page.textContent('h1')).includes('정보처리산업기사'), '홈 제목 표시');
    check((await page.locator('.grid .card').count()) === 3, '과목 카드 3개');

    await page.goto(BASE + '#/learn/s3');
    await page.waitForSelector('.notes .card');
    check((await page.locator('.notes .card').count()) >= 3, '개념 노트 렌더링');

    await page.goto(BASE + '#/quiz/s2');
    await page.waitForSelector('.opt');
    check((await page.locator('.opt').count()) === 4, '선택지 4개');
    await page.keyboard.press('2');
    check((await page.locator('.explain').count()) === 1, '연습 모드: 답 선택 시 해설 표시');
    const stray = await page.evaluate(() => [...document.querySelectorAll('#app, #app *')].some((el) =>
      [...el.childNodes].some((n) => n.nodeType === 3 && /^(false|null|undefined)$/.test(n.textContent.trim()))));
    check(!stray, '화면에 false/null/undefined 텍스트가 새어 나오지 않음');
    await page.locator('.actions .btn.primary').click();
    await finishPractice(page);
    check((await page.textContent('h1')).includes('결과'), '연습 모드: 결과 화면');

    await page.goto(BASE + '#/wrong');
    await page.waitForSelector('h1');
    const hasRetry = await page.locator('a[href="#/wrong/retry"]').count();
    check(hasRetry === 1, '오답노트에 틀린 문제 수집');

    await page.goto(BASE + '#/mock');
    await page.getByRole('button', { name: '시작하기' }).click();
    await page.waitForSelector('.timer');
    check(/남은 시간 \d\d:\d\d/.test(await page.textContent('.timer')), '모의고사 타이머 표시');
    await page.keyboard.press('3');
    check((await page.locator('.explain').count()) === 0, '시험 모드: 제출 전 해설 숨김');
    await page.locator('.palette button').nth(5).click();
    await page.keyboard.press('1');
    check((await page.locator('.palette button.done').count()) === 2, '문항 팔레트에 답한 문항 표시');
    await page.getByRole('button', { name: '제출' }).click();
    await page.waitForSelector('.result');
    check((await page.locator('.result .pass, .result .fail').count()) > 0, '모의고사 합격/과락 판정 표시');

    await page.goto(BASE + '#/stats');
    await page.waitForSelector('h1');
    check((await page.locator('table').count()) >= 1, '학습 기록 표 표시');
    await page.screenshot({ path: path.join(__dirname, '..', 'tests', 'last-desktop.png') });
    await ctx.close();

    console.log('모바일 375px');
    const m = await browser.newContext({ viewport: { width: 375, height: 740 } });
    const mp = await m.newPage();
    mp.on('pageerror', (e) => errors.push(e.message));
    for (const hash of ['', '#/learn/s1', '#/quiz/s2', '#/stats']) {
      await mp.goto(BASE + hash);
      await mp.waitForSelector('h1');
      const overflow = await mp.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      check(overflow <= 0, `가로 스크롤 없음 (${hash || '#/'})`);
    }
    await m.close();

    check(errors.length === 0, '콘솔/페이지 오류 없음' + (errors.length ? ': ' + errors.join(' | ') : ''));
  } finally {
    await browser.close();
    server.close();
  }

  if (failures) { console.error(`\n스모크 테스트 실패: ${failures}건`); process.exit(1); }
  console.log('\n스모크 테스트 통과');
})().catch((e) => { console.error(e); process.exit(1); });
