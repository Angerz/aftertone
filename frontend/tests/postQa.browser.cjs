/*
 * Run against a local frontend build. Every API request is mocked; no database is used.
 * AFTERTONE_PLAYWRIGHT_MODULE=/path/to/playwright-core \
 * AFTERTONE_CHROMIUM=/path/to/chromium node tests/postQa.browser.cjs http://127.0.0.1:PORT /tmp/evidence
 * Uses an existing Playwright installation; adds no application dependency.
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require(process.env.AFTERTONE_PLAYWRIGHT_MODULE || 'playwright-core');
const origin = process.argv[2];
assert(origin && /^http:\/\/127\.0\.0\.1:\d+$/.test(origin), 'Use an isolated loopback frontend');
const output = path.resolve(process.argv[3] || '/tmp/aftertone-post-qa-browser');
fs.mkdirSync(output, { recursive: true });
const report = { checks: [], pageErrors: [], writes: [], unexpectedRequests: [] };
const check = (name, value) => { report.checks.push({ name, pass: Boolean(value) }); assert(value, name); };
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };
const artist = { id: 1, name: 'Álvaro Díaz' };
const entry = (id, position, title) => ({ id, global_position: position, track_id: id, track_title: title, artists: [artist], album_id: 1, album_title: 'Álbum sintético', album_year: 2024, cover_url: null, disc_number: 1, track_position: id, base_score: 8, emotional_connection: 4, replay_value: 3, originality: 2, genre: null, notes: 'Synthetic note', final_score: 7.5, rank_movement: 'up', rank_delta: 2, top_100_entered_at: '2026-10-20T00:00:00Z' });
let top = [entry(1, 1, 'Normal title'), entry(2, 7, 'UNBROKENTITLE'.repeat(35))];
let candidates = [entry(101, 101, 'Candidate title')];
let responsePosition = 7;
let behavior = null;

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.AFTERTONE_CHROMIUM, headless: true, args: ['--no-sandbox'] });
  const context = await browser.newContext({ viewport: { width: 390, height: 900 }, reducedMotion: 'reduce' });
  let page;
  try {
    await context.route('**/*', async route => {
      const req = route.request();
      const url = new URL(req.url());
      if (url.origin !== origin) { report.unexpectedRequests.push(url.origin); return route.abort(); }
      if (!url.pathname.startsWith('/api/')) return route.continue();
      if (url.pathname === '/api/auth/session') return route.fulfill({ json: { authenticated: true, csrf_token: 'synthetic-csrf' } });
      if (url.pathname === '/api/favorite-songs' && req.method() === 'GET') {
        const mode = behavior;
        const view = url.searchParams.get('view');
        if (mode && (!mode.view || mode.view === view)) {
          if (mode.gate) await mode.gate.promise;
          if (mode.fail) return route.fulfill({ status: 503, json: { detail: 'Synthetic list failure' } });
          if (mode.empty) return route.fulfill({ json: [] });
        }
        const rows = view === 'candidates' ? candidates : top;
        const needle = (url.searchParams.get('search') || '').toLowerCase();
        return route.fulfill({ json: rows.filter(row => row.track_title.toLowerCase().includes(needle)) });
      }
      if (/^\/api\/favorite-songs\/\d+$/.test(url.pathname) && req.method() === 'PATCH') {
        const id = Number(url.pathname.split('/').at(-1));
        const body = req.postDataJSON();
        report.writes.push(body);
        const original = [...top, ...candidates].find(row => row.id === id);
        // Canned server response: the UI must use this position/score, never derive a rank.
        const updated = { ...original, ...body, global_position: responsePosition, final_score: 8.125 };
        top = top.filter(row => row.id !== id);
        candidates = candidates.filter(row => row.id !== id);
        (responsePosition <= 100 ? top : candidates).push(updated);
        return route.fulfill({ json: updated });
      }
      report.unexpectedRequests.push(req.method() + ' ' + url.pathname);
      return route.fulfill({ status: 404, json: { detail: 'Unexpected synthetic request' } });
    });
    page = await context.newPage();
    page.on('pageerror', error => report.pageErrors.push(error.message));
    const goto = async (query = '') => { await page.goto(origin + '/top-songs' + query); };
    const pressed = async name => await page.getByRole('button', { name, exact: true }).getAttribute('aria-pressed') === 'true';
    const rendered = async id => { await page.locator('#favorite-song-' + id).waitFor(); };
    const screenshot = async name => page.screenshot({ path: path.join(output, name + '.png') });

    // A deliberately unresolved request must not announce an empty ranking.
    for (const view of ['top', 'candidates']) {
      const gate = deferred();
      behavior = { gate, empty: true };
      await goto(view === 'candidates' ? '?view=candidates' : '');
      await page.getByRole('status').waitFor();
      check(view + ': pending has loading and no empty message', await page.locator('.empty').count() === 0);
      await screenshot('pending-' + view);
      gate.resolve();
      await page.locator('.empty').waitFor();
      check(view + ': empty is shown only after response', await page.getByRole('status').count() === 0);
    }
    const populatedGate = deferred();
    behavior = { gate: populatedGate };
    await goto();
    await page.getByRole('status').waitFor();
    check('pending populated response has no empty flash', await page.locator('.empty').count() === 0);
    populatedGate.resolve();
    await rendered(1);
    check('populated response replaces loading', await page.getByRole('status').count() === 0);

    behavior = { fail: true };
    await goto();
    await page.getByRole('alert').waitFor();
    check('request error is neither empty nor indefinitely loading', await page.locator('.empty,[role=status]').count() === 0);
    behavior = null;
    await page.getByRole('button', { name: 'Candidates', exact: true }).click();
    await rendered(101);
    check('next request clears the previous list error', await page.getByRole('alert').count() === 0);

    // The older pending response must not overwrite a subsequently selected view.
    const stale = deferred();
    behavior = { view: 'top', gate: stale };
    await goto();
    await page.getByRole('status').waitFor();
    await page.getByRole('button', { name: 'Candidates', exact: true }).click();
    await rendered(101);
    const oldResponse = page.waitForResponse(response => new URL(response.url()).searchParams.get('view') === 'top');
    stale.resolve();
    await (await oldResponse).finished();
    await page.evaluate(() => new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done))));
    check('late old-view response cannot replace Candidates', await pressed('Candidates') && await page.locator('#favorite-song-1').count() === 0);
    behavior = null;

    await goto();
    await rendered(1);
    check('default view is Top 100', await pressed('Top 100'));
    await page.getByRole('button', { name: 'Candidates', exact: true }).click();
    await rendered(101);
    check('Candidates writes the view URL', new URL(page.url()).searchParams.get('view') === 'candidates');
    await page.goBack();
    await rendered(1);
    check('Back restores Top 100', await pressed('Top 100'));
    await page.goForward();
    await rendered(101);
    check('Forward restores Candidates', await pressed('Candidates'));
    await page.reload();
    await rendered(101);
    check('refresh preserves Candidates', await pressed('Candidates'));
    await goto('?view=invalid');
    await rendered(1);
    check('invalid URL safely defaults to Top 100', await pressed('Top 100'));

    await goto('?view=candidates&focus=101&other=kept');
    await page.locator('#favorite-song-101.favorite-song-focused').waitFor();
    check('focus scroll clears only the focus parameter', new URL(page.url()).searchParams.get('view') === 'candidates' && !new URL(page.url()).searchParams.has('focus') && new URL(page.url()).searchParams.get('other') === 'kept');
    await page.locator('#favorite-song-101').getByRole('button', { name: 'Edit', exact: true }).click();
    const inputs = page.locator('.favorite-evaluation input');
    for (let index = 0; index < 4; index++) {
      const initial = await inputs.nth(index).inputValue();
      const before = report.writes.length;
      await inputs.nth(index).fill('');
      check('blank criterion ' + index + ' suppresses preview', await page.locator('.favorite-rating-summary > strong').innerText() === '—');
      await page.getByRole('button', { name: 'Save changes', exact: true }).click();
      check('blank criterion ' + index + ' blocks PATCH with field feedback/focus', report.writes.length === before && await inputs.nth(index).getAttribute('aria-invalid') === 'true' && await inputs.nth(index).evaluate(node => node === document.activeElement));
      await inputs.nth(index).fill('0');
      check('explicit zero criterion ' + index + ' restores preview', await page.locator('.favorite-rating-summary > strong').innerText() !== '—');
      await inputs.nth(index).fill(initial);
    }
    await inputs.nth(3).fill('0');
    await page.getByRole('button', { name: 'Save changes', exact: true }).click();
    await page.locator('#favorite-song-101.favorite-song-focused').waitFor();
    check('save sends explicit zero without computed scores', report.writes.at(-1).originality === 0 && !('final_score' in report.writes.at(-1)));
    check('post-edit promotion uses the server position, view and score', await pressed('Top 100') && !new URL(page.url()).searchParams.has('view') && await page.locator('#favorite-song-101 .favorite-rank').innerText() === '#07' && await page.locator('#favorite-song-101 .favorite-row-score b').innerText() === '8.13');
    await page.reload();
    await rendered(101);
    check('refresh preserves promoted song view', await pressed('Top 100'));
    responsePosition = 101;
    await page.locator('#favorite-song-101').getByRole('button', { name: 'Edit', exact: true }).click();
    await page.getByRole('button', { name: 'Save changes', exact: true }).click();
    await page.locator('#favorite-song-101.favorite-song-focused').waitFor();
    check('post-edit demotion preserves Candidates in URL', await pressed('Candidates') && new URL(page.url()).searchParams.get('view') === 'candidates' && await page.locator('#favorite-song-101 .favorite-rank').innerText() === '#101');
    await screenshot('post-edit-candidates');

    await goto();
    await rendered(2);
    await page.locator('#favorite-song-2').getByRole('button', { name: 'Edit', exact: true }).click();
    for (const width of [360, 390, 430, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      check('long favorite title wraps at ' + width, await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    }
    await screenshot('long-title-desktop');
    check('no uncaught browser errors', report.pageErrors.length === 0);
    check('all API operations were intercepted', report.unexpectedRequests.length === 0);
  } finally {
    if (page && report.checks.some(row => !row.pass)) await page.screenshot({ path: path.join(output, 'failure.png') }).catch(() => {});
    await browser.close();
    fs.writeFileSync(path.join(output, 'results.json'), JSON.stringify(report, null, 2) + '\n');
  }
  console.log(JSON.stringify({ checks: report.checks.length, failed: report.checks.filter(row => !row.pass), writes: report.writes.length }));
})().catch(error => { console.error(error); process.exitCode = 1; });
