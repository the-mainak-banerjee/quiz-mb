// Captures real QuizMB screens for the landing page (public/landing) from
// the dev live previews, so the hero always shows the actual product.
//
//   pnpm --filter @quizmb/web dev            (in another terminal)
//   node apps/web/scripts/capture-landing-shots.mjs
//
// Uses Chrome through the DevTools protocol (no extra packages): exact
// device sizes at 2x, with the Next.js dev badge hidden. Set CHROME_PATH if
// Chrome is installed elsewhere.
import { spawn } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';

const ORIGIN = process.env.APP_ORIGIN ?? 'http://localhost:3000';
const CHROME =
  process.env.CHROME_PATH ??
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe';
const OUT = new URL('../public/landing/', import.meta.url);
const PORT = 9333;

const SHOTS = [
  // The host console mid-question: live answer breakdown and controls.
  {
    name: 'host-console',
    path: '/dev/live/host-scored',
    width: 1440,
    height: 900,
  },
  // A participant answering on a phone.
  {
    name: 'participant-answer',
    path: '/dev/live/participant-single-active',
    width: 390,
    height: 844,
  },
  // Feature bento crops (clip: the region of the page, in CSS pixels).
  // The host's leaderboard, shown to participants on demand: the heading
  // and the top players, with the score column.
  {
    name: 'bento-leaderboard',
    path: '/dev/live/host-leaderboard-shown',
    width: 1440,
    height: 1300,
    clip: { x: 452, y: 352, width: 526, height: 840 },
  },
  // A participant's result after the timer: correct, with speed points.
  {
    name: 'bento-result',
    path: '/dev/live/participant-result-correct',
    width: 390,
    height: 844,
    // Just inside the result card's border, keeping its own top padding;
    // the landing frame clips its corners and draws the border.
    clip: { x: 17, y: 106, width: 356, height: 600 },
  },
  // A participant who joined: the lobby, waiting for the host to start.
  {
    name: 'bento-lobby',
    path: '/dev/live/participant-lobby',
    width: 390,
    height: 844,
    // Milo down to the quiz and host card.
    clip: { x: 0, y: 60, width: 390, height: 784 },
  },
  // The participant's history: final score and rank per quiz.
  {
    name: 'bento-history',
    path: '/dev/live/history',
    width: 1440,
    height: 900,
    clip: { x: 112, y: 192, width: 920, height: 540 },
  },
  // The same history on a phone, for small screens (one whole card).
  {
    name: 'bento-history-phone',
    path: '/dev/live/history',
    width: 390,
    height: 844,
    clip: { x: 0, y: 205, width: 390, height: 560 },
  },
];

const chrome = spawn(CHROME, [
  '--headless=new',
  '--disable-gpu',
  '--hide-scrollbars',
  `--remote-debugging-port=${PORT}`,
  `--user-data-dir=${mkdtempSync(join(tmpdir(), 'quizmb-shots-'))}`,
  'about:blank',
]);

try {
  let socket;
  for (let attempt = 0; attempt < 40 && !socket; attempt++) {
    await sleep(250);
    try {
      const targets = await (
        await fetch(`http://127.0.0.1:${PORT}/json`)
      ).json();
      const page = targets.find((target) => target.type === 'page');
      if (page) socket = new WebSocket(page.webSocketDebuggerUrl);
    } catch {
      // Chrome is still starting.
    }
  }
  if (!socket) throw new Error('Chrome did not start');
  await new Promise((resolve) => socket.addEventListener('open', resolve));

  let nextId = 0;
  const pending = new Map();
  socket.addEventListener('message', (event) => {
    const message = JSON.parse(event.data);
    pending.get(message.id)?.(message);
    pending.delete(message.id);
  });
  const send = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const id = ++nextId;
      pending.set(id, (message) =>
        message.error
          ? reject(new Error(message.error.message))
          : resolve(message.result),
      );
      socket.send(JSON.stringify({ id, method, params }));
    });

  await send('Page.enable');
  for (const shot of SHOTS) {
    await send('Emulation.setDeviceMetricsOverride', {
      width: shot.width,
      height: shot.height,
      deviceScaleFactor: 2,
      mobile: shot.width < 768,
    });
    await send('Page.navigate', { url: `${ORIGIN}${shot.path}` });
    // Long enough for a cold dev compile and the entrance animations.
    await sleep(6000);
    await send('Runtime.evaluate', {
      expression: `(() => {
        const style = document.createElement('style');
        style.textContent = 'nextjs-portal{display:none!important}';
        document.head.appendChild(style);
        window.scrollTo(0, 0);
      })()`,
    });
    await sleep(800);
    const { data } = await send('Page.captureScreenshot', {
      format: 'png',
      ...(shot.clip ? { clip: { ...shot.clip, scale: 1 } } : {}),
    });
    writeFileSync(
      new URL(`${shot.name}.png`, OUT),
      Buffer.from(data, 'base64'),
    );
    console.log(`Saved public/landing/${shot.name}.png`);
  }
  socket.close();
} finally {
  chrome.kill();
}
