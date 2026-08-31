import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'AuxWars',
  description: 'Hold the throne. Keep the vibe. Lose the aux.',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  // The game surface must not zoom under a two-finger gesture mid-reign.
  maximumScale: 1,
  userScalable: false,
  themeColor: '#05050a',
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="manifest" href="/manifest.json" />
        <link rel="icon" href="/icon.svg" type="image/svg+xml" />
        <link rel="apple-touch-icon" href="/icon.svg" />

        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/*
          STILL A RUNTIME CDN DEPENDENCY — see docs/IMPROVEMENTS.md #4.
          `display=swap` plus the explicit fallback stacks in globals.css mean
          a failed fetch degrades to system faces rather than blocking paint,
          but the type system still breaks. Self-host the .woff2 files before
          the demo (docs/DEMO_FALLBACKS.md, day-before).
        */}
        <link
          href="https://fonts.googleapis.com/css2?family=Anton&family=Barlow+Condensed:wght@500;600;700&family=Barlow:wght@400;500;600&family=JetBrains+Mono:wght@400;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <a href="#main" className="skip-link">
          SKIP TO CONTENT
        </a>
        {children}
      </body>
    </html>
  );
}
