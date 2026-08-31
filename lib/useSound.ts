'use client';

/**
 * UI sound layer — synthesized with Web Audio, no asset files.
 *
 * Why synthesis rather than samples: zero bytes to download (the APK ships to
 * phones on venue wifi), zero licensing questions, and the tones can be tuned
 * to the neon palette rather than borrowed from a sample pack.
 *
 * This is FEEDBACK sound only. Actual music playback is `usePlayback.ts`,
 * which embeds YouTube's player — we never host or synthesize real tracks
 * (docs/LICENSING_RIGHTS.md DO NOT #1).
 */

import { useCallback, useEffect, useRef } from 'react';

export type Sfx =
  | 'tap'          // generic press
  | 'cardPlay'     // card into the deck slot
  | 'throne'       // you took the throne
  | 'dethrone'     // you lost it
  | 'peak'         // Peak Moment
  | 'packTear'     // pack opening, stage 1
  | 'legendary'    // legendary reveal
  | 'warn';        // vibe crossing the dethrone threshold

interface Tone {
  freq: number;
  /** Optional glide target — a rise reads as gain, a fall as loss. */
  to?: number;
  dur: number;
  type: OscillatorType;
  gain: number;
  delay?: number;
}

/**
 * Tuned to feel like the palette: cyan = clean sine, pink = saw, gold =
 * triangle stacks. Kept short — a party app must never sound like an OS.
 */
const SFX: Record<Sfx, Tone[]> = {
  tap: [{ freq: 420, dur: 0.05, type: 'sine', gain: 0.05 }],
  cardPlay: [
    { freq: 320, to: 620, dur: 0.13, type: 'triangle', gain: 0.09 },
    { freq: 880, dur: 0.06, type: 'sine', gain: 0.05, delay: 0.08 },
  ],
  throne: [
    { freq: 392, dur: 0.14, type: 'triangle', gain: 0.1 },
    { freq: 523, dur: 0.14, type: 'triangle', gain: 0.1, delay: 0.1 },
    { freq: 784, dur: 0.26, type: 'triangle', gain: 0.11, delay: 0.2 },
  ],
  dethrone: [
    { freq: 440, to: 180, dur: 0.42, type: 'sawtooth', gain: 0.09 },
    { freq: 220, to: 90, dur: 0.5, type: 'sine', gain: 0.07, delay: 0.05 },
  ],
  peak: [
    { freq: 660, to: 1320, dur: 0.2, type: 'triangle', gain: 0.11 },
    { freq: 880, to: 1760, dur: 0.26, type: 'sine', gain: 0.09, delay: 0.09 },
    { freq: 1320, dur: 0.4, type: 'sine', gain: 0.07, delay: 0.2 },
  ],
  packTear: [
    { freq: 180, to: 90, dur: 0.22, type: 'sawtooth', gain: 0.07 },
    { freq: 2200, dur: 0.05, type: 'square', gain: 0.03, delay: 0.02 },
  ],
  legendary: [
    { freq: 523, dur: 0.18, type: 'triangle', gain: 0.1 },
    { freq: 659, dur: 0.18, type: 'triangle', gain: 0.1, delay: 0.11 },
    { freq: 784, dur: 0.18, type: 'triangle', gain: 0.1, delay: 0.22 },
    { freq: 1047, to: 1568, dur: 0.65, type: 'sine', gain: 0.12, delay: 0.33 },
  ],
  warn: [{ freq: 260, to: 200, dur: 0.16, type: 'square', gain: 0.06 }],
};

const STORAGE_KEY = 'auxwars.muted';

let ctx: AudioContext | null = null;

/** Lazily created: browsers refuse an AudioContext before a user gesture. */
function audioCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!ctx) {
    const AC = window.AudioContext ?? (window as any).webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

export function useSound() {
  const muted = useRef(false);

  useEffect(() => {
    try {
      muted.current = localStorage.getItem(STORAGE_KEY) === '1';
    } catch {
      // Private mode / blocked storage — default to unmuted.
    }
  }, []);

  const play = useCallback((name: Sfx) => {
    if (muted.current) return;

    // Respect the OS "reduce motion" preference as a proxy for "reduce
    // sensory load" — a user who suppressed animation rarely wants chirps.
    if (typeof window !== 'undefined'
      && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;

    const ac = audioCtx();
    if (!ac) return;

    for (const t of SFX[name]) {
      const at = ac.currentTime + (t.delay ?? 0);
      const osc = ac.createOscillator();
      const gain = ac.createGain();

      osc.type = t.type;
      osc.frequency.setValueAtTime(t.freq, at);
      if (t.to !== undefined) {
        osc.frequency.exponentialRampToValueAtTime(Math.max(1, t.to), at + t.dur);
      }

      // Percussive envelope: fast attack, exponential decay. A linear ramp
      // to zero clicks audibly.
      gain.gain.setValueAtTime(0.0001, at);
      gain.gain.exponentialRampToValueAtTime(t.gain, at + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, at + t.dur);

      osc.connect(gain).connect(ac.destination);
      osc.start(at);
      osc.stop(at + t.dur + 0.02);
    }
  }, []);

  const toggleMute = useCallback((): boolean => {
    muted.current = !muted.current;
    try {
      localStorage.setItem(STORAGE_KEY, muted.current ? '1' : '0');
    } catch {
      // Non-fatal: the toggle still works for this session.
    }
    return muted.current;
  }, []);

  const isMuted = useCallback(() => muted.current, []);

  return { play, toggleMute, isMuted };
}
