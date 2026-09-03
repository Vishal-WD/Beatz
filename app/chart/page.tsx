'use client';

/**
 * Screen 06 — World Chart.
 *
 * This screen used to be a marketplace: rows expanded into "RANKED BIDS"
 * listing invented Drop amounts against four hardcoded player names, with
 * OFFERS and OFFER_COUNTS arrays supplying equally invented totals, above
 * buttons that did nothing. No bid, offer or trade has ever existed in this
 * app — there is no bids table and no trade path.
 *
 * It is not a gap to fill in either. CLAUDE.md §3 keeps Drops earn-only
 * *alongside* a card-sell path precisely because the combination is a real
 * loot-box regulatory risk, and that constraint does not relax just because
 * we sideload the APK rather than ship to Play (§7.1).
 *
 * What is real, and already tracked, is scarcity: supply is finite and every
 * pull decrements it. So the chart ranks what the room has actually claimed.
 */

import { useEffect, useMemo, useState } from 'react';
import { PhoneShell } from '@/components/PhoneChrome';
import { useSound } from '@/lib/useSound';
import { RARITY } from '@/lib/rarity';
import { fetchChartRows } from '@/lib/supabase';
import { buildChart, type ChartEntry, type ChartRow } from '@/lib/domain/chart';
import { EmptyState } from '@/components/ui';

type LoadState = 'loading' | 'ready' | 'empty';

export default function ChartScreen() {
  const { play } = useSound();
  const [rows, setRows] = useState<ChartRow[]>([]);
  const [state, setState] = useState<LoadState>('loading');
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void fetchChartRows().then((r) => {
      if (cancelled) return;
      setRows(r ?? []);
      setState(r && r.length > 0 ? 'ready' : 'empty');
    });
    return () => { cancelled = true; };
  }, []);

  const chart = useMemo(() => buildChart(rows, 40), [rows]);

  return (
    <PhoneShell>
      <div style={{ padding: '4px 16px 24px' }}>
        <div style={{ marginBottom: 16 }}>
          <div style={{ font: '400 26px/1 var(--font-title)', textTransform: 'uppercase' }}>
            World Chart
          </div>
          <div
            style={{
              font: '400 8px/1 var(--font-tele)', letterSpacing: '.2em',
              color: 'var(--neon-cyan)', marginTop: 6,
            }}
          >
            {state === 'ready' ? `${chart.length} CARDS · RANKED BY SCARCITY` : 'LOADING'}
          </div>
        </div>

        {state === 'loading' && (
          <div style={{ font: '400 9px/1 var(--font-tele)', letterSpacing: '.16em', color: 'var(--ink-25)' }}>
            LOADING…
          </div>
        )}

        {state === 'empty' && (
          <EmptyState
            title="NO CARDS YET"
            hint="The chart fills in as cards are minted and claimed."
          />
        )}

        {state === 'ready' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {chart.map((e) => (
              <ChartRowView
                key={e.cardId}
                entry={e}
                open={openId === e.cardId}
                onToggle={() => { setOpenId(openId === e.cardId ? null : e.cardId); play('tap'); }}
              />
            ))}
          </div>
        )}
      </div>
    </PhoneShell>
  );
}

function ChartRowView({
  entry, open, onToggle,
}: { entry: ChartEntry; open: boolean; onToggle: () => void }) {
  const r = RARITY[entry.rarity];
  const claimed = entry.supplyTotal - entry.supplyRemaining;
  const pct = Math.round(entry.scarcity * 100);

  return (
    <div
      style={{
        borderRadius: 12, overflow: 'hidden',
        background: 'var(--booth-panel)',
        border: `1px solid ${open ? r.color : 'var(--hairline)'}`,
      }}
    >
      <button
        onClick={onToggle}
        aria-expanded={open}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: 10,
          padding: 11, background: 'transparent', border: 'none', textAlign: 'left',
        }}
      >
        <span style={{ font: '700 12px/1 var(--font-stat)', color: 'var(--ink-40)', width: 20, flexShrink: 0 }}>
          {entry.rank}
        </span>

        {entry.artworkUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={entry.artworkUrl}
            alt=""
            style={{ width: 38, height: 38, borderRadius: 8, objectFit: 'cover', flexShrink: 0 }}
          />
        ) : (
          <span style={{ width: 38, height: 38, borderRadius: 8, background: 'rgba(255,255,255,.06)', flexShrink: 0 }} />
        )}

        <span style={{ flex: 1, minWidth: 0 }}>
          <span
            style={{
              display: 'block', font: '400 15px/1.05 var(--font-title)',
              textTransform: 'uppercase', overflow: 'hidden',
              textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}
          >
            {entry.title}
          </span>
          <span
            style={{
              display: 'block', font: '500 8px/1 var(--font-tele)', letterSpacing: '.1em',
              color: 'var(--ink-40)', marginTop: 4, overflow: 'hidden',
              textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}
          >
            {entry.subtitle}
          </span>
        </span>

        <span style={{ textAlign: 'right', flexShrink: 0 }}>
          <span style={{ display: 'block', font: '700 17px/1 var(--font-stat)', color: r.color }}>
            {pct}%
          </span>
          <span style={{ display: 'block', font: '400 7px/1 var(--font-tele)', letterSpacing: '.12em', color: 'var(--ink-40)', marginTop: 3 }}>
            CLAIMED
          </span>
        </span>
      </button>

      {open && (
        <div style={{ padding: '0 11px 12px' }}>
          <div
            style={{
              height: 3, borderRadius: 2, background: 'rgba(255,255,255,.08)',
              overflow: 'hidden', marginBottom: 9,
            }}
          >
            <div style={{ width: `${pct}%`, height: '100%', background: r.color }} />
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
            <Stat label="CLAIMED" value={claimed.toLocaleString()} />
            <Stat label="REMAINING" value={entry.supplyRemaining.toLocaleString()} />
            <Stat label="PRINTED" value={entry.supplyTotal.toLocaleString()} />
          </div>

          <div
            style={{
              font: '400 7px/1.6 var(--font-tele)', letterSpacing: '.1em',
              color: 'var(--ink-25)', marginTop: 10,
            }}
          >
            {r.tag} · SUPPLY IS FINITE AND EVERY PULL DECREMENTS IT
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ font: '700 13px/1 var(--font-stat)', color: 'var(--ink)' }}>{value}</div>
      <div style={{ font: '400 7px/1 var(--font-tele)', letterSpacing: '.12em', color: 'var(--ink-40)', marginTop: 3 }}>
        {label}
      </div>
    </div>
  );
}
