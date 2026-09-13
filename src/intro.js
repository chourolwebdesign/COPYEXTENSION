/**
 * CopyPaste Unlocker - breach sequence.
 *
 * Isolated world, top frame only. On page load it takes the screen for ~3.5s:
 * glyph rain, a terminal log that types itself, a progress bar and ACCESS
 * GRANTED, then it dissolves. Everything lives in a closed shadow root with
 * pointer-events disabled, so the page can neither style it nor be blocked by
 * it, and it is torn down completely (animation frame included) afterwards.
 */
(() => {
  'use strict';

  const DEFAULTS = { enabled: true, intro: true, alias: '' };
  const LIFETIME = 3800;

  if (window.top !== window) return;

  chrome.storage.local.get(DEFAULTS, (s) => {
    if (chrome.runtime.lastError) return;
    if (s.enabled === false || s.intro === false) return;
    ready(() => breach(String(s.alias || 'operator').slice(0, 18)));
  });

  function ready(fn) {
    if (document.body) return fn();
    document.addEventListener('DOMContentLoaded', fn, { once: true });
  }

  const rnd = (a, b) => Math.floor(a + Math.random() * (b - a + 1));

  function breach(alias) {
    const host = document.createElement('div');
    host.dataset.copypasteUnlocker = 'intro';
    host.style.cssText = 'all:initial;position:fixed;inset:0;z-index:2147483647;pointer-events:none';
    const root = host.attachShadow({ mode: 'closed' });

    const lines = [
      `[sys] establishing link ......... ${rnd(10, 99)}.${rnd(10, 99)}.*.*`,
      '[sys] target .................... azubiheft.de',
      `[sys] scanning event handlers ... ${rnd(11, 48)} found`,
      '[!!!] clipboard lock ............ detected',
      '[>>>] injecting payload ......... MAIN world',
      '[>>>] silencing copy/paste/cut .. done',
    ];

    root.innerHTML = `
      <style>
        :host, * { box-sizing: border-box; margin: 0; }
        .wrap {
          position: fixed; inset: 0; overflow: hidden;
          background: radial-gradient(120% 90% at 50% 50%, rgba(0,10,6,.95), rgba(0,0,0,.995));
          font: 13px/1.65 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
          animation: flash .12s steps(2,end) 2, fade .55s ease ${LIFETIME - 700}ms forwards;
        }
        canvas { position: absolute; inset: 0; width: 100%; height: 100%; opacity: .5; }
        .scan {
          position: absolute; inset: 0;
          background: repeating-linear-gradient(180deg, rgba(0,255,156,.055) 0 1px, transparent 1px 3px);
        }
        .panel {
          position: absolute; top: 50%; left: 50%; transform: translate(-50%,-50%);
          width: min(560px, 88vw); padding: 26px 28px;
          border: 1px solid rgba(0,255,156,.35); border-radius: 10px;
          background: rgba(1,5,3,.94);
          box-shadow: 0 0 80px rgba(0,255,156,.16), inset 0 0 60px rgba(0,255,156,.04);
        }
        .log p {
          width: 0; overflow: hidden; white-space: nowrap; color: #57e0a4;
          animation: type .34s steps(30,end) var(--d) both;
        }
        .log .hit { color: #ff4747; }
        .log .go { color: #00ff9c; }
        .bar {
          margin: 14px 0 4px; height: 6px; border: 1px solid rgba(0,255,156,.35);
          border-radius: 3px; overflow: hidden;
        }
        .bar i {
          display: block; height: 100%; width: 0; background: #00ff9c;
          box-shadow: 0 0 14px #00ff9c; animation: fill .8s ease 1.35s forwards;
        }
        .pct { font-size: 11px; color: #2f6f55; letter-spacing: .1em; }
        .granted {
          margin-top: 18px; text-align: center; font-size: 27px; font-weight: 700;
          letter-spacing: .22em; color: #00ff9c; opacity: 0;
          animation: slam .4s cubic-bezier(.2,.9,.3,1.5) 2.2s forwards, rgb .22s steps(2,end) 2.2s 5;
        }
        .who {
          margin-top: 6px; text-align: center; font-size: 12px; letter-spacing: .18em;
          color: #2f6f55; opacity: 0; animation: rise .4s ease 2.65s forwards;
          text-transform: uppercase;
        }
        @keyframes type  { to { width: calc(var(--n) * 1ch) } }
        @keyframes fill  { to { width: 100% } }
        @keyframes slam  { from { opacity: 0; transform: scale(1.35) } to { opacity: 1; transform: none } }
        @keyframes rise  { from { opacity: 0; transform: translateY(5px) } to { opacity: 1; transform: none } }
        @keyframes fade  { to { opacity: 0 } }
        @keyframes flash { 50% { background-color: rgba(0,255,156,.10) } }
        @keyframes rgb   {
          50% { text-shadow: 2px 0 rgba(255,0,80,.9), -2px 0 rgba(0,200,255,.9); transform: translateX(-1px) }
        }
        @media (prefers-reduced-motion: reduce) {
          canvas { display: none }
          .wrap, .log p, .bar i, .granted, .who { animation-duration: .01ms; animation-delay: 0s }
          .wrap { animation: fade .3s ease ${LIFETIME - 500}ms forwards }
          .log p { width: calc(var(--n) * 1ch) }
          .granted, .who { opacity: 1 }
        }
      </style>
      <div class="wrap">
        <canvas></canvas>
        <div class="scan"></div>
        <div class="panel">
          <div class="log">
            ${lines.map((l, i) => {
              const cls = l.startsWith('[!!!]') ? ' class="hit"' : l.startsWith('[>>>') ? ' class="go"' : '';
              return `<p${cls} style="--d:${(0.12 + i * 0.19).toFixed(2)}s;--n:${l.length}">${l}</p>`;
            }).join('')}
          </div>
          <div class="bar"><i></i></div>
          <div class="pct">decrypting clipboard layer</div>
          <div class="granted">ACCESS GRANTED</div>
          <div class="who">welcome back, ${alias.replace(/[<&>]/g, '')}</div>
        </div>
      </div>`;

    document.body.appendChild(host);

    const stopRain = rain(root.querySelector('canvas'));
    setTimeout(() => { stopRain(); host.remove(); }, LIFETIME);
  }

  /** Glyph rain. Returns a stop function that cancels the frame loop. */
  function rain(canvas) {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return () => {};

    const ctx = canvas.getContext('2d');
    const dpr = Math.min(devicePixelRatio || 1, 2);
    const w = canvas.width = innerWidth * dpr;
    const h = canvas.height = innerHeight * dpr;
    const size = 16 * dpr;
    const cols = Math.ceil(w / size);
    const drops = Array.from({ length: cols }, () => Math.random() * -60);
    const glyphs = 'アカサタナハマヤラワ0123456789ABCDEF<>/\\|=+*#';
    let frame;

    ctx.font = `${size}px ui-monospace, monospace`;
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, w, h);

    const tick = () => {
      ctx.fillStyle = 'rgba(0,0,0,.09)';
      ctx.fillRect(0, 0, w, h);
      for (let i = 0; i < cols; i++) {
        const y = drops[i] * size;
        if (y > 0) {
          ctx.fillStyle = Math.random() < .04 ? '#d9ffe9' : '#00c97b';
          ctx.fillText(glyphs[(Math.random() * glyphs.length) | 0], i * size, y);
        }
        drops[i] = y > h && Math.random() > .975 ? 0 : drops[i] + 1;
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }
})();
