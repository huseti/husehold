// Screenshots every page at phone + laptop width and flags layout defects.
// Usage: node scripts/ui-audit.mjs <tokens.json> <outDir> [light|dark]
// tokens.json = {"access": "...", "refresh": "..."} for a local user.
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const [tokensFile, outDir, theme = 'light'] = process.argv.slice(2);
if (!tokensFile || !outDir) {
  console.error('Usage: node scripts/ui-audit.mjs <tokens.json> <outDir> [light|dark]');
  process.exit(1);
}
const tokens = JSON.parse(fs.readFileSync(tokensFile, 'utf8'));
const BASE = process.env.UI_AUDIT_BASE || 'http://localhost:3000';

const PAGES = [
  '/', '/shopping', '/recipes', '/cooking-plan', '/cooking-plan-config', '/tasks',
  '/vouchers', '/packing-lists', '/packing-buckets', '/analytics',
  '/recipe-shopping-config', '/settings',
];
// Dialogs/menus reached by clicks. Only clicks that open UI -- never ones that save data.
const SCENARIOS = [
  // Laptop: navbar "Weitere" dropdown; phone: the bottom bar's "Mehr" tab (avatar + label).
  { name: 'nav-menu', route: '/', click: [{ role: 'button', name: /(^Weitere|Mehr$)/ }] },
  { name: 'account-menu', route: '/', click: [{ css: 'nav button:has(img), nav button:has-text("Mehr")' }] },
  { name: 'avatar-preview', route: '/', click: [{ css: 'nav button:has(img), nav button:has-text("Mehr")' }, { role: 'button', name: /Bild bearbeiten/ }] },
  { name: 'recipe-new', route: '/recipes', click: [{ role: 'button', name: /(Rezept m|M)anuell anlegen/ }] },
  { name: 'voucher-new', route: '/vouchers', click: [{ role: 'button', name: /Gutschein hinzufügen/ }] },
  { name: 'shopping-list-edit', route: '/shopping', click: [{ role: 'button', name: /Liste bearbeiten/ }] },
  { name: 'dashboard-next-week', route: '/', click: [{ role: 'button', name: /Nächste Woche/ }] },
  { name: 'recipe-import', route: '/recipes', click: [{ role: 'button', name: /^\+ (Rezept importieren|Importieren)$/ }] },
  { name: 'recipe-detail', route: '/recipes', click: [{ css: 'main button:has(h3), main button:has(h4)' }] },
  { name: 'packing-new', route: '/packing-lists', click: [{ role: 'button', name: /Neue Packliste/ }] },
  { name: 'tasks-add-single', route: '/tasks', click: [{ role: 'button', name: /einzelne|Einzelaufgabe|hinzufügen/i }] },
  { name: 'tasks-config', route: '/tasks', click: [{ role: 'button', name: /Konfigurieren/ }] },
  { name: 'shopping-history', route: '/shopping', click: [{ role: 'button', name: /^Verlauf$/ }] },
  { name: 'icon-picker-task', route: '/tasks', settle: 3000, click: [{ role: 'button', name: /Konfigurieren/ }, { role: 'button', name: /^Weitere/ }] },
  { name: 'icon-picker-category', route: '/recipe-shopping-config', settle: 3000, click: [{ css: 'summary:has-text("Einkaufslisten-Kategorien")' }, { role: 'button', name: /Icon ändern/ }] },
];

const VIEWPORTS = {
  mobile: { width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 2 },
  laptop: { width: 1440, height: 900, deviceScaleFactor: 1 },
};

function detectDefects() {
  const issues = [];
  const vw = document.documentElement.clientWidth;
  const label = (el) => {
    const txt = (el.innerText || el.getAttribute('aria-label') || el.title || '').trim().replace(/\s+/g, ' ');
    return `${el.tagName.toLowerCase()} "${txt.slice(0, 40)}"`;
  };
  const visible = (el) => {
    const r = el.getBoundingClientRect();
    const s = getComputedStyle(el);
    return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none';
  };

  if (document.documentElement.scrollWidth > vw + 1) {
    issues.push({ type: 'page-horizontal-scroll', detail: `scrollWidth ${document.documentElement.scrollWidth} > ${vw}` });
  }

  for (const el of document.querySelectorAll('button, a, [role="button"], select, input, label, .card, .card-lg')) {
    if (!visible(el)) continue;
    const r = el.getBoundingClientRect();
    if (r.right > vw + 1 || r.left < -1) {
      issues.push({ type: 'off-screen', el: label(el), detail: `left ${Math.round(r.left)} right ${Math.round(r.right)} vw ${vw}` });
    }
  }

  for (const btn of document.querySelectorAll('button, [role="button"]')) {
    if (!visible(btn) || !btn.childNodes.length) continue;
    const box = btn.getBoundingClientRect();
    const range = document.createRange();
    range.selectNodeContents(btn);
    const c = range.getBoundingClientRect();
    if (c.width === 0 || c.height === 0) continue;
    const tol = 1.5;
    if (c.top < box.top - tol || c.bottom > box.bottom + tol || c.left < box.left - tol || c.right > box.right + tol) {
      issues.push({
        type: 'content-overflows-button', el: label(btn),
        detail: `box ${Math.round(box.width)}x${Math.round(box.height)} content ${Math.round(c.width)}x${Math.round(c.height)}`,
      });
    } else if (box.width <= 56 && box.height <= 56 && (() => {
      const s = getComputedStyle(btn);
      return s.paddingTop === s.paddingBottom && s.paddingLeft === s.paddingRight;
    })()) {
      const dx = (c.left + c.right) / 2 - (box.left + box.right) / 2;
      const dy = (c.top + c.bottom) / 2 - (box.top + box.bottom) / 2;
      if (Math.abs(dx) > 2 || Math.abs(dy) > 2) {
        issues.push({ type: 'icon-off-center', el: label(btn), detail: `dx ${dx.toFixed(1)} dy ${dy.toFixed(1)}` });
      }
    }
    const bs = getComputedStyle(btn);
    const bg = (bs.backgroundColor.match(/[\d.]+/g) || []).map(Number);
    const hasFill = bg.length === 3 || (bg.length === 4 && bg[3] > 0.3);
    const hasText = (btn.innerText || '').trim().length > 1;
    if (hasFill && hasText && (parseFloat(bs.paddingLeft) < 6 || parseFloat(bs.paddingTop) < 2)) {
      issues.push({ type: 'unpadded-button', el: label(btn), detail: `padding ${bs.paddingTop} ${bs.paddingLeft}` });
    }
    if (btn.scrollWidth > btn.clientWidth + 1 && getComputedStyle(btn).overflowX !== 'visible') {
      issues.push({ type: 'clipped-text', el: label(btn), detail: `scrollWidth ${btn.scrollWidth} > ${btn.clientWidth}` });
    }
  }
  // WCAG contrast of each element's own text against the first opaque background behind it.
  const parse = (c) => (c.match(/[\d.]+/g) || []).map(Number);
  const lum = ([r, g, b]) => {
    const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  };
  const bgOf = (el) => {
    for (let n = el; n; n = n.parentElement) {
      const c = parse(getComputedStyle(n).backgroundColor);
      if (c.length === 3 || (c.length === 4 && c[3] > 0.5)) return c.slice(0, 3);
    }
    return [255, 255, 255];
  };
  const seenLow = new Set();
  for (const el of document.querySelectorAll('body *')) {
    if (!visible(el)) continue;
    const ownText = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
    const isField = el.matches('input:not([type=checkbox]):not([type=radio]), select, textarea');
    if (!ownText && !isField) continue;
    const s = getComputedStyle(el);
    if (Number(s.opacity) < 1 || el.closest(':disabled, [aria-disabled=true]')) continue;
    const fg = parse(s.color);
    if (fg.length === 4 && fg[3] < 0.5) continue;
    const [l1, l2] = [lum(fg.slice(0, 3)), lum(bgOf(el))].sort((a, b) => b - a);
    const ratio = (l1 + 0.05) / (l2 + 0.05);
    if (ratio < 3) {
      const key = `${el.tagName}|${el.className}`;
      if (seenLow.has(key)) continue;
      seenLow.add(key);
      issues.push({ type: 'low-contrast', el: label(el), detail: `ratio ${ratio.toFixed(2)} color ${s.color} class "${String(el.className).slice(0, 80)}"` });
    }
  }
  return issues;
}

const browser = await chromium.launch();
const report = {};
fs.mkdirSync(outDir, { recursive: true });

for (const [vpName, vp] of Object.entries(VIEWPORTS)) {
  const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, ...vp, colorScheme: theme });
  await context.addInitScript(([a, r, th]) => {
    localStorage.setItem('access_token', a);
    localStorage.setItem('refresh_token', r);
    localStorage.setItem('theme', th);
    localStorage.setItem('language', 'de');
  }, [tokens.access, tokens.refresh, theme]);
  const page = await context.newPage();
  const consoleErrors = [];
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });

  for (const route of PAGES) {
    consoleErrors.length = 0;
    await page.goto(BASE + route, { waitUntil: 'networkidle' });
    await page.waitForTimeout(400);
    const name = `${vpName}${route === '/' ? '_dashboard' : route.replace(/\//g, '_')}`;
    await page.screenshot({ path: path.join(outDir, `${name}.png`), fullPage: true });
    const issues = await page.evaluate(detectDefects);
    report[name] = { issues, consoleErrors: [...consoleErrors] };
    console.log(`${name}: ${issues.length} issue(s)${consoleErrors.length ? `, ${consoleErrors.length} console error(s)` : ''}`);
  }

  for (const sc of SCENARIOS) {
    consoleErrors.length = 0;
    const name = `${vpName}_dialog_${sc.name}`;
    await page.goto(BASE + sc.route, { waitUntil: 'networkidle' });
    try {
      for (const step of sc.click) {
        const loc = step.css ? page.locator(step.css) : page.getByRole(step.role, { name: step.name });
        await loc.locator('visible=true').first().click({ timeout: 3000 });
        await page.waitForTimeout(400);
      }
    } catch (e) {
      console.log(`${name}: SKIPPED (${e.message.split('\n')[0]})`);
      continue;
    }
    if (sc.settle) await page.waitForTimeout(sc.settle);
    await page.screenshot({ path: path.join(outDir, `${name}.png`), fullPage: true });
    const issues = await page.evaluate(detectDefects);
    report[name] = { issues, consoleErrors: [...consoleErrors] };
    console.log(`${name}: ${issues.length} issue(s)${consoleErrors.length ? `, ${consoleErrors.length} console error(s)` : ''}`);
  }
  await context.close();
}

await browser.close();
fs.writeFileSync(path.join(outDir, 'report.json'), JSON.stringify(report, null, 2));
