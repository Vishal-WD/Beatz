'use client';

/**
 * Every primitive, every variant, on one page.
 *
 * This is the review surface for the Industry-grammar direction (spec §7.1)
 * and the source for the Claude Design push. Not linked from the app nav.
 */

import { useState } from 'react';
import {
  Button, Panel, Badge, Field, Segmented, Stat, Sheet, EmptyState,
} from '@/components/ui';
import { RARITY } from '@/lib/rarity';
import type { Rarity } from '@/types/cards';

const FILTERS = ['ALL', 'COMMON', 'RARE', 'EPIC', 'LEGENDARY'] as const;

export default function UiProof() {
  const [text, setText] = useState('');
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>('ALL');
  const [sheetOpen, setSheetOpen] = useState(false);

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: 'var(--sp-7) var(--sp-5)' }}>
      <div
        style={{
          font: "400 10px/1 var(--font-tele)",
          letterSpacing: '.24em',
          color: 'var(--neon-pink)',
        }}
      >
        INDUSTRY GRAMMAR · BEATZ GROUND
      </div>
      <h1
        style={{
          font: "400 clamp(36px,8vw,58px)/.92 var(--font-heading)",
          textTransform: 'uppercase',
          margin: 'var(--sp-3) 0 var(--sp-7)',
        }}
      >
        UI Primitives
      </h1>

      <Section title="Buttons">
        <Row>
          <Button variant="primary">Primary</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="danger">Danger</Button>
          <Button disabled>Disabled</Button>
        </Row>
        <Row>
          <Button size="sm">Small</Button>
          <Button size="md">Medium</Button>
          <Button size="lg">Large</Button>
        </Row>
        <Row>
          {(['common', 'rare', 'epic', 'legendary'] as Rarity[]).map((r) => (
            <Button key={r} variant="primary" accent={RARITY[r].color}>
              {RARITY[r].tag}
            </Button>
          ))}
        </Row>
      </Section>

      <Section title="Panels — marks are the signature">
        <Row>
          <Panel style={{ flex: 1 }}>Filled, marked</Panel>
          <Panel filled={false} style={{ flex: 1 }}>Drawn, marked</Panel>
          <Panel marks={false} style={{ flex: 1 }}>Filled, no marks</Panel>
        </Row>
      </Section>

      <Section title="Badges — rarity keeps its colour">
        <Row>
          <Badge>NEUTRAL</Badge>
          <Badge tone="live">● LIVE</Badge>
          <Badge tone="warn">OWNED ONLY</Badge>
          <Badge tone="accent">OPEN DOOR</Badge>
          {(['common', 'rare', 'epic', 'legendary'] as Rarity[]).map((r) => (
            <Badge key={r} accent={RARITY[r].color}>{RARITY[r].label}</Badge>
          ))}
        </Row>
      </Section>

      <Section title="Form">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)', maxWidth: 340 }}>
          <Field label="NIGHT NAME" value={text} onChange={setText} placeholder="Basement 4AM" />
          <Segmented
            label="Rarity filter"
            options={FILTERS}
            value={filter}
            onChange={setFilter}
            accentFor={(f) =>
              f === 'ALL' ? undefined : RARITY[f.toLowerCase() as Rarity].color}
          />
        </div>
      </Section>

      <Section title="Stats">
        <Panel>
          <div style={{ display: 'flex', gap: 'var(--sp-3)' }}>
            <Stat label={'TOTAL REIGNS\nWON'} value={37} accent="var(--neon-cyan)" />
            <Stat label={'PEAK\nVIBE'} value={99} accent="var(--neon-gold)" />
            <Stat label={'CHALLENGER\nWIN RATE'} value="61%" accent="var(--neon-pink)" />
          </div>
        </Panel>
      </Section>

      <Section title="Sheet and empty state">
        <Row>
          <Button variant="primary" onClick={() => setSheetOpen(true)}>Open sheet</Button>
        </Row>
        <Panel filled={false}>
          <EmptyState
            title="NOTHING HERE YET"
            hint="Create a night to see it listed."
            action={<Button variant="primary">Create a night</Button>}
          />
        </Panel>
      </Section>

      <Sheet open={sheetOpen} onClose={() => setSheetOpen(false)} title="Create a night">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)' }}>
          <Field label="NAME" value={text} onChange={setText} placeholder="Basement 4AM" />
          <Button variant="primary" block onClick={() => setSheetOpen(false)}>Done</Button>
        </div>
      </Sheet>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: 'var(--sp-8)' }}>
      <div
        style={{
          font: "400 9px/1 var(--font-tele)",
          letterSpacing: '.2em',
          color: 'var(--ink-40)',
          paddingBottom: 'var(--sp-3)',
          borderBottom: 'var(--border-hair)',
          marginBottom: 'var(--sp-4)',
        }}
      >
        {title.toUpperCase()}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)' }}>
        {children}
      </div>
    </section>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', gap: 'var(--sp-3)', flexWrap: 'wrap', alignItems: 'center' }}>
      {children}
    </div>
  );
}
