// Confirms the light/dark palettes actually diverge on every screen, not
// just in globals.css. Loads each route, forces data-theme to each value,
// and reads the *computed* background/color off <body> -- the same signal
// a real screen reader or eyeball would get, not just what the stylesheet
// declares.
import { chromium } from 'playwright';

const ROUTES = ['/', '/deck', '/packs', '/chart', '/profile', '/events', '/social'];
const THEMES = ['dark', 'light'];

// Near-black backgrounds ("stage black" gone wrong in light mode) --
// anything under this luminance reads as still-dark to the eye.
const isNearBlack = (rgb) => {
  const m = /rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(rgb);
  if (!m) return false;
  const [r, g, b] = [+m[1], +m[2], +m[3]];
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return luminance < 40;
};

const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
const p = await ctx.newPage();

let failures = 0;

for (const route of ROUTES) {
  console.log(`\n=== ${route} ===`);
  await p.goto(`http://localhost:3100${route}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await p.waitForTimeout(600);

  const readings = {};
  for (const theme of THEMES) {
    await p.evaluate((t) => document.documentElement.setAttribute('data-theme', t), theme);
    // data-theme changes are synchronous CSS, but give layout/paint a beat.
    await p.waitForTimeout(150);
    const { background, color } = await p.evaluate(() => {
      const cs = getComputedStyle(document.body);
      return { background: cs.backgroundColor, color: cs.color };
    });
    readings[theme] = { background, color };
    console.log(`  ${theme.padEnd(5)} background: ${background}   color: ${color}`);
  }

  const bgDiffers = readings.dark.background !== readings.light.background;
  const colorDiffers = readings.dark.color !== readings.light.color;
  const lightIsDark = isNearBlack(readings.light.background);

  if (!bgDiffers) { console.log('  FAIL: background identical between themes'); failures++; }
  if (!colorDiffers) { console.log('  FAIL: text colour identical between themes'); failures++; }
  if (lightIsDark) { console.log('  FAIL: light-mode body background is still near-black'); failures++; }
  if (bgDiffers && colorDiffers && !lightIsDark) console.log('  OK');
}

// --- Surface-token check ---------------------------------------------
//
// "The two themes differ" (above) does not catch a surface token that is
// technically different but has gone visually inert -- e.g. --gold-wash at
// 8% alpha over a near-white light ground reads as no tint at all, even
// though the raw rgba() string is not byte-identical to the dark value.
// This checks the thing the earlier review finding was actually about:
// in light mode, is the element's own background distinguishable from the
// page background it sits on, by more than a few percent per channel?
const channelDelta = (a, b) => {
  const pa = /rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/.exec(a);
  const pb = /rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/.exec(b);
  if (!pa || !pb) return null;
  const [ar, ag, ab] = [+pa[1], +pa[2], +pa[3]];
  const [br, bg, bb] = [+pb[1], +pb[2], +pb[3]];
  return Math.max(Math.abs(ar - br), Math.abs(ag - bg), Math.abs(ab - bb));
};

// Percent-of-255 threshold: "a few percent" per the ask.
const MIN_DELTA_PCT = 3;
const MIN_DELTA = (MIN_DELTA_PCT / 100) * 255;

async function checkSurfaceAgainstPage(route, label, { setup, locator }) {
  console.log(`\n=== surface: ${label} (${route}) ===`);
  await p.goto(`http://localhost:3100${route}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await p.waitForTimeout(600);
  await p.evaluate((t) => document.documentElement.setAttribute('data-theme', t), 'light');
  await p.waitForTimeout(150);

  if (setup) await setup(p);

  const el = p.locator(locator).first();
  const count = await el.count();
  if (count === 0) {
    console.log(`  SKIP: element not present (${locator})`);
    return;
  }

  // `background: var(--token)` sets background-image when the token is a
  // gradient (--vibe-hold-glow) and background-color when it's a flat
  // rgba() (--gold-wash) -- read both and use whichever one actually
  // carries paint, rather than assuming background-color like a solid fill.
  const [elBg, pageBg] = await Promise.all([
    el.evaluate((node) => {
      const cs = getComputedStyle(node);
      return { color: cs.backgroundColor, image: cs.backgroundImage };
    }),
    p.evaluate(() => getComputedStyle(document.body).backgroundColor),
  ]);

  const usesGradient = elBg.image && elBg.image !== 'none';
  // First rgba()/rgb() stop inside the gradient stands in for "the element's
  // paint" -- good enough to prove it diverges from a flat page background.
  const gradientStop = usesGradient ? /rgba?\([^)]+\)/.exec(elBg.image)?.[0] ?? null : null;
  const comparedValue = usesGradient ? gradientStop : elBg.color;

  const delta = comparedValue ? channelDelta(comparedValue, pageBg) : null;
  console.log(`  element background-color: ${elBg.color}`);
  console.log(`  element background-image: ${elBg.image}`);
  console.log(`  compared against:         ${comparedValue ?? 'n/a'}`);
  console.log(`  page background:          ${pageBg}`);
  console.log(`  max channel delta:        ${delta === null ? 'n/a (parse failed)' : delta.toFixed(1)} (need >= ${MIN_DELTA.toFixed(1)})`);

  if (delta === null || delta < MIN_DELTA) {
    console.log(`  FAIL: element paint within ${MIN_DELTA_PCT}% of page background in light mode`);
    failures++;
  } else {
    console.log('  OK');
  }
}

// Room's "TRIGGER PEAK" button -- always rendered, --gold-wash background.
await checkSurfaceAgainstPage('/room', 'gold-wash (room peak button)', {
  locator: 'button[aria-label="Trigger a Peak Moment"]',
});

// Deck's "Hold to Vibe" button in its pressed state -- --vibe-hold-glow
// background only applies while `holding` is true, so simulate a press.
await checkSurfaceAgainstPage('/deck', 'vibe-hold-glow (deck hold state)', {
  locator: 'button[aria-label="Hold to raise the room\'s vibe"]',
  setup: async (page) => {
    const hold = page.locator('button[aria-label="Hold to raise the room\'s vibe"]');
    if ((await hold.count()) === 0) return;
    const box = await hold.boundingBox();
    if (!box) return;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.waitForTimeout(200);
    // Leave the button held for the background read; caller reads it next.
  },
});

// EventDetailView's "EVENT ROOM" callout -- only renders when the seeded
// event's roomMode is 'event'. Not asserted here since it depends on live
// data in this environment (see report), but the same --gold-wash token
// backs it, and that token is covered by the room-button check above.

await b.close();

console.log(`\n${failures === 0 ? 'ALL OK' : `${failures} FAILURE(S)`}`);
process.exit(failures === 0 ? 0 : 1);
