/**
 * Rarity visual system — values lifted verbatim from the approved design
 * (design/AuxWars.dc.html `RAR` map) via docs/CARD_ART_GENERATION.md §2.
 *
 * Foil appears ONLY on rarity frames. The moment foil decorates a button,
 * rarity stops reading as special.
 */

import type { Rarity } from '@/types/cards';

export interface RarityStyle {
  tag: string;
  label: string;
  frame: string;
  color: string;
  badgeBg: string;
  badgeColor: string;
  /** Escalation: matte → static sheen → animated sheen → reactive holo. */
  effect: 'none' | 'sheen-static' | 'sheen-animated' | 'holo';
  baseSupply: number;
}

export const RARITY: Record<Rarity, RarityStyle> = {
  common: {
    tag: 'CMN',
    label: 'COMMON',
    frame: 'linear-gradient(160deg,#8a6a42,#3a2c1a)',
    color: '#c79a5e',
    badgeBg: 'rgba(138,106,66,.9)',
    badgeColor: '#1d1408',
    effect: 'none',
    baseSupply: 10000,
  },
  rare: {
    tag: 'RARE',
    label: 'RARE',
    frame: 'linear-gradient(160deg,#dfe6ef,#7b8798 45%,#c9d3e0)',
    color: '#cfd8e4',
    badgeBg: 'rgba(223,230,239,.92)',
    badgeColor: '#1b2029',
    effect: 'sheen-static',
    baseSupply: 2500,
  },
  epic: {
    tag: 'EPIC',
    label: 'EPIC',
    frame: 'linear-gradient(160deg,#ffe9a8,#c9962b 42%,#ffd84d)',
    color: '#ffd84d',
    badgeBg: '#ffd84d',
    badgeColor: '#1d1400',
    effect: 'sheen-animated',
    baseSupply: 600,
  },
  legendary: {
    tag: 'LGND',
    label: 'LEGENDARY',
    frame: 'linear-gradient(115deg,#ff2e88,#7b2bff 30%,#4ce3ff 55%,#ffd84d 80%,#ff2e88)',
    color: '#ff8ac4',
    badgeBg: 'linear-gradient(90deg,#ffd84d,#ff2e88)',
    badgeColor: '#0b0512',
    effect: 'holo',
    baseSupply: 250,
  },
};

/** Profile Card frame — cyan/violet axis, deliberately outside the rarity ladder. */
export const PROFILE_FRAME = {
  frame: 'linear-gradient(160deg,#4ce3ff,#7b2bff 55%,#4ce3ff)',
  color: '#4ce3ff',
  badgeBg: 'rgba(76,227,255,.9)',
  badgeColor: '#041016',
} as const;

/** Guest Card — the least attractive card in the game, by design (CLAUDE.md §2). */
export const GUEST_FRAME = {
  frame: 'repeating-linear-gradient(45deg,#3a3a44 0 6px,#2a2a33 6px 12px)',
  color: 'rgba(244,242,255,.45)',
  badgeBg: 'rgba(58,58,68,.9)',
  badgeColor: 'rgba(244,242,255,.6)',
} as const;

/** Avatar gradients — from the design's AV[] palette. */
export const AVATAR_GRADIENTS = [
  'linear-gradient(150deg,#7b2bff,#2a1050)',
  'linear-gradient(150deg,#4ce3ff,#0d3b4d)',
  'linear-gradient(150deg,#ff2e88,#4a0a26)',
  'linear-gradient(150deg,#7dffc3,#0c4030)',
  'linear-gradient(150deg,#ffd84d,#4d3a00)',
  'linear-gradient(150deg,#ff8a4c,#4d1f00)',
  'linear-gradient(150deg,#b98cff,#2d1a4d)',
];

export const avatarFor = (seed: string): string => {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  return AVATAR_GRADIENTS[Math.abs(h) % AVATAR_GRADIENTS.length];
};

/**
 * Vibe Bar color by heat, from the design's renderVals().
 * Cyan (cold) → violet → pink → gold (peak).
 */
export const vibeColor = (vibe: number): string => {
  const hot = vibe / 100;
  if (hot > 0.82) return '#ffd84d';
  if (hot > 0.62) return '#ff2e88';
  if (hot > 0.4) return '#b98cff';
  return '#4ce3ff';
};

/**
 * The CSS variable to use when rendering rarity as READING TEXT.
 *
 * `RARITY[r].color` is tuned to glow on a dark ground and must stay
 * identical across themes, because it paints the frame and the badge — the
 * card's identity, which CLAUDE.md §2 requires be recognisable at a glance
 * and never theme-dependent.
 *
 * A scarcity percentage or a tier label is a different job: it has to be
 * READ. On the cream light ground the epic gold measured 1.38:1. These
 * variables are the same hue family, darkened for light mode only, so the
 * frame never moves while the text stays legible.
 */
export const rarityTextVar = (r: Rarity): string => `var(--rarity-${r}-text)`;
