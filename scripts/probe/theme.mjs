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

await b.close();

console.log(`\n${failures === 0 ? 'ALL OK' : `${failures} FAILURE(S)`}`);
process.exit(failures === 0 ? 0 : 1);
