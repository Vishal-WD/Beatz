/**
 * The static export that goes into the APK.
 *
 * next.config.mjs only sets `output: 'export'` when CAPACITOR=1, so a plain
 * `next build` produces the Vercel build: it writes .next/ and never out/.
 * `npx cap sync` then copies whatever out/ happens to hold, which meant it
 * silently shipped a WEEKS-OLD export while every build reported success.
 * Three separate "regressions" on the device were all this one bug.
 *
 * A script rather than an inline env var because `CAPACITOR=1 next build`
 * is not portable to cmd.exe, and cross-env is not a dependency here.
 *
 * It fails loudly if out/ is missing or empty afterwards -- a build that
 * reports success while producing nothing is the failure mode this exists
 * to prevent.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

// A stale out/ is worse than none: cap sync cannot tell the difference.
rmSync('out', { recursive: true, force: true });

/* Run Next's own JS entry point with this same node binary. Spawning `npx`
   needs a shell on Windows (it is npx.cmd), and a shell means unescaped
   args -- resolving the module avoids both. */
const nextBin = require.resolve('next/dist/bin/next');
const res = spawnSync(process.execPath, [nextBin, 'build'], {
  stdio: 'inherit',
  env: { ...process.env, CAPACITOR: '1', NODE_ENV: 'production' },
});

if (res.status !== 0) process.exit(res.status ?? 1);

if (!existsSync('out') || readdirSync('out').length === 0) {
  console.error(
    '\nBuild reported success but out/ is empty.\n' +
    'The static export did not run — check that next.config.mjs still keys\n' +
    "output:'export' off CAPACITOR=1.\n",
  );
  process.exit(1);
}

console.log(`\nStatic export ready: out/ (${readdirSync('out').length} entries)`);
