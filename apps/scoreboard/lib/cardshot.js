// Natija rasmi: brauzerni DevTools orqali boshqaramiz va kadrni sahifa tayyor bo'lgach olamiz.
// --screenshot + --virtual-time-budget sekin serverda kadrni tasodifiy paytda olardi: rasmsiz, kesilgan yoki bo'sh.
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

// Rasmlar (fon rasmlari ham) va shriftlar yuklanishini kutadi; kartochka chizilganini va yuklanmagan rasmlarni qaytaradi
const READY = `(async () => {
  const wait = (i) => (i.complete ? (i.decode ? i.decode().catch(() => {}) : null) : new Promise((r) => { i.onload = i.onerror = r; }));
  const bg = [...document.querySelectorAll('.tp-flag')].map((e) => (getComputedStyle(e).backgroundImage.match(/url\\("?([^")]+)/) || [])[1]).filter(Boolean)
    .map((src) => { const i = new Image(); i.src = src; return i; });
  await Promise.all([document.fonts.ready, ...[...document.images, ...bg].map(wait)]);
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  await new Promise((r) => setTimeout(r, 250));
  return { card: !!document.querySelector('.tp-center'), broken: [...document.images].filter((i) => !i.naturalWidth).map((i) => i.getAttribute('src')) };
})()`;

function shot({ bin, url, width, height, out, noSandbox, timeoutMs = 40000 }) {
  return new Promise((resolve) => {
    const prof = fs.mkdtempSync(path.join(os.tmpdir(), 'sbshot-'));
    const args = ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--no-first-run', '--no-default-browser-check', '--disable-background-networking',
      '--disable-sync', '--disable-component-update', '--disable-default-apps', '--disable-extensions', '--remote-debugging-port=0', '--user-data-dir=' + prof,
      '--window-size=' + width + ',' + height];
    if (noSandbox) args.push('--no-sandbox', '--disable-dev-shm-usage');
    args.push('about:blank');
    const p = spawn(bin, args, { stdio: ['ignore', 'ignore', 'pipe'], windowsHide: true });
    let ws = null, finished = false, seq = 0, err = '';
    const pending = new Map(), waiters = new Map();
    const done = (ok) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      try { if (ws) ws.close(); } catch (e) { /* yopilgan */ }
      p.once('exit', () => fs.rm(prof, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }, () => resolve(ok)));
      try { p.kill(); } catch (e) { /* tugagan */ }
      if (p.exitCode !== null) fs.rm(prof, { recursive: true, force: true }, () => resolve(ok));
    };
    const timer = setTimeout(() => { console.log('Telegram rasm: vaqt tugadi'); done(false); }, timeoutMs);
    const send = (method, params, sessionId) => new Promise((res, rej) => {
      const id = ++seq;
      pending.set(id, { res, rej });
      ws.send(JSON.stringify({ id, method, params: params || {}, sessionId }));
    });
    const event = (name) => new Promise((res) => waiters.set(name, res));
    const run = async () => {
      const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
      const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
      await send('Page.enable', {}, sessionId);
      await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false }, sessionId);
      const loaded = event('Page.loadEventFired');
      await send('Page.navigate', { url }, sessionId);
      await loaded;
      const ready = await send('Runtime.evaluate', { expression: READY, awaitPromise: true, returnByValue: true }, sessionId);
      const v = (ready.result && ready.result.value) || {};
      if (!v.card) { console.log('Telegram rasm: kartochka chizilmadi'); return done(false); }
      if (v.broken.length) console.log('Telegram rasm: yuklanmagan rasm: ' + v.broken.join(', '));
      const { data } = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false }, sessionId);
      fs.writeFileSync(out, Buffer.from(data, 'base64'));
      done(true);
    };
    p.on('error', () => { console.log('Telegram rasm: brauzer ishga tushmadi'); done(false); });
    p.on('exit', () => { if (!finished) { console.log('Telegram rasm: brauzer to\'xtadi'); done(false); } });
    p.stderr.on('data', (d) => {
      if (ws) return;
      err += d;
      const m = err.match(/DevTools listening on (ws:\/\/\S+)/);
      if (!m) return;
      ws = new WebSocket(m[1]);
      ws.onopen = () => run().catch((e) => { console.log('Telegram rasm: ' + e.message); done(false); });
      ws.onerror = () => done(false);
      ws.onmessage = (e) => {
        const msg = JSON.parse(e.data);
        if (msg.id && pending.has(msg.id)) {
          const q = pending.get(msg.id);
          pending.delete(msg.id);
          if (msg.error) q.rej(new Error(msg.error.message)); else q.res(msg.result);
        } else if (msg.method && waiters.has(msg.method)) {
          const r = waiters.get(msg.method);
          waiters.delete(msg.method);
          r(msg.params);
        }
      };
    });
  });
}

module.exports = { shot };
