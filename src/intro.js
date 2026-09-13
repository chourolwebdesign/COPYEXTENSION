/**
 * CopyPaste Unlocker - on-page intro.
 *
 * Isolated world, top frame only. Draws a short, non-interactive overlay when a
 * target page loads, then removes itself. Everything lives in a closed shadow
 * root with pointer-events disabled, so the page can neither style it nor be
 * blocked by it.
 */
(() => {
  'use strict';

  const DEFAULTS = { enabled: true, intro: true };
  const LIFETIME = 4200;

  if (window.top !== window) return;

  chrome.storage.local.get(DEFAULTS, (s) => {
    if (chrome.runtime.lastError) return;
    if (s.enabled === false || s.intro === false) return;
    ready(() => show(chrome.runtime.getURL('assets/mask.svg')));
  });

  const ready = (fn) => {
    if (document.body) return fn();
    document.addEventListener('DOMContentLoaded', fn, { once: true });
  };

  function show(eyeUrl) {
    const host = document.createElement('div');
    host.dataset.copypasteUnlocker = 'intro';
    host.style.cssText = 'all:initial;position:fixed;inset:0;z-index:2147483647;pointer-events:none';
    const root = host.attachShadow({ mode: 'closed' });

    root.innerHTML = `
      <style>
        :host, * { box-sizing: border-box; }
        .stage {
          position: fixed; inset: 0; display: grid; place-items: center;
          font: 13px/1.5 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
          animation: out .5s ease ${LIFETIME - 700}ms forwards;
        }
        .card {
          position: relative; width: 300px; padding: 22px 20px 18px;
          text-align: center; border: 1px solid #16241c; border-radius: 12px;
          background: rgba(3,7,5,.93);
          box-shadow: 0 0 60px rgba(0,255,156,.18), inset 0 0 40px rgba(0,255,156,.05);
          animation: in .35s cubic-bezier(.2,.9,.3,1.4) both;
        }
        .card::after {
          content: ""; position: absolute; inset: 0; border-radius: 12px; pointer-events: none;
          background: repeating-linear-gradient(180deg, rgba(0,255,156,.05) 0 1px, transparent 1px 3px);
        }
        .eye { display: block; width: 150px; margin: 0 auto 14px; }
        .line { min-height: 20px; letter-spacing: .14em; font-weight: 600; }
        .l1 { color: #ff3b3b; text-shadow: 0 0 14px rgba(255,59,59,.65);
              animation: l1 2s ease .35s both, flick .17s steps(2,end) 7 .35s; }
        .l2 { color: #00ff9c; text-shadow: 0 0 14px rgba(0,255,156,.6);
              animation: l2 .5s ease 2.35s both; }
        @keyframes in   { from { opacity: 0; transform: translateY(8px) scale(.96); } }
        @keyframes out  { to   { opacity: 0; transform: scale(.985); } }
        @keyframes l1   { 0% { opacity: 0 } 8%, 86% { opacity: 1 } 100% { opacity: 0 } }
        @keyframes l2   { from { opacity: 0; transform: translateY(4px) } to { opacity: 1; transform: none } }
        @keyframes flick{ 50% { opacity: .35; transform: translateX(-1px); } }
        .stack { display: grid; }
        .stack > * { grid-area: 1 / 1; }
        @media (prefers-reduced-motion: reduce) {
          .card, .l1, .l2 { animation-duration: .01ms; animation-delay: 0s; }
          .l1 { opacity: 0 }
        }
      </style>
      <div class="stage">
        <div class="card">
          <img class="eye" src="${eyeUrl}" alt="">
          <div class="stack">
            <div class="line l1">I'M WATCHING YOU</div>
            <div class="line l2">...just kidding</div>
          </div>
        </div>
      </div>`;

    document.body.appendChild(host);
    setTimeout(() => host.remove(), LIFETIME);
  }
})();
