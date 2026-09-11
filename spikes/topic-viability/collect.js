/* Lensing — spike 12.2 collector
 * Paste into the devtools console on https://x.com/home, then scroll.
 * Collects visible post text, deduped. Run __lensing.save() when done.
 */
(() => {
  if (window.__lensing) { console.warn('collector already running'); return; }

  const TARGET = 200;
  const MIN_CHARS = 30;
  const posts = new Map();               // normalized text -> record

  const norm = t => t.replace(/\s+/g, ' ').trim().toLowerCase();

  const badge = document.createElement('div');
  badge.style.cssText = `position:fixed;bottom:16px;right:16px;z-index:2147483647;
    background:#111;color:#fff;font:600 13px system-ui;padding:10px 14px;
    border-radius:8px;box-shadow:0 2px 12px rgba(0,0,0,.4);pointer-events:none`;
  document.body.appendChild(badge);

  const render = () => {
    const n = posts.size;
    badge.textContent = n >= TARGET
      ? `Lensing: ${n} posts — enough, run __lensing.save()`
      : `Lensing: ${n} / ${TARGET} posts — keep scrolling`;
    badge.style.background = n >= TARGET ? '#15803d' : '#111';
  };

  const scan = () => {
    for (const cell of document.querySelectorAll('[data-testid="cellInnerDiv"]')) {
      const textEl = cell.querySelector('[data-testid="tweetText"]');
      if (!textEl) continue;                         // ad, who-to-follow, etc.
      const text = textEl.innerText.replace(/\s+/g, ' ').trim();
      if (text.length < MIN_CHARS) continue;
      const key = norm(text);
      if (posts.has(key)) continue;
      const link = cell.querySelector('a[href*="/status/"]');
      posts.set(key, { text, url: link ? link.href : null });
    }
    render();
  };

  const timer = setInterval(scan, 600);
  scan();

  window.__lensing = {
    get count() { return posts.size; },
    stop() { clearInterval(timer); badge.remove(); delete window.__lensing; },
    save(filename = 'posts.json') {
      const data = [...posts.values()].map((p, i) => ({ id: i, ...p }));
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = filename;
      a.click();
      URL.revokeObjectURL(a.href);
      console.log(`saved ${data.length} posts to ${filename}`);
      return data.length;
    }
  };

  console.log('%cLensing collector running.', 'color:#15803d;font-weight:600');
  console.log('Scroll your feed. Run __lensing.save() when the badge turns green.');
})();
