/**
 * The pack reveal sequence.
 *
 * Extracted from app/packs/page.tsx because the screen conflated two
 * different things in one number: the shop counter was `stage === 0`, and
 * SEALED was also 0. That collision meant the sealed pack could never
 * render -- the picker owned its stage -- so the pack first appeared at
 * TEARING, already torn, and the tear animation had no frame to animate
 * from. The double-requestAnimationFrame that exists specifically to give
 * it that frame was working correctly against a state that never showed.
 *
 * Whether the shop is showing is now a separate flag, and these four stages
 * mean only what they say.
 */

export const SEALED = 0;
export const TEARING = 1;
export const FLIPPING = 2;
export const PULLED = 3;

export type RevealStage = typeof SEALED | typeof TEARING | typeof FLIPPING | typeof PULLED;

/** What the reveal looks like at each stage. */
export interface RevealView {
  /** The sealed box is on screen (it goes once the card has taken over). */
  packVisible: boolean;
  /** The tear clip-path is applied. */
  torn: boolean;
  /** The card has slid out of the pack. */
  cardOut: boolean;
  /** The gold spotlight bloom behind the card. */
  spotlight: boolean;
}

export function viewFor(stage: RevealStage): RevealView {
  return {
    packVisible: stage < PULLED,
    // SEALED must render UN-torn: it is the frame the clip-path animates
    // away from. A reveal that starts at TEARING is a jump cut.
    torn: stage >= TEARING,
    cardOut: stage >= TEARING,
    spotlight: stage >= FLIPPING,
  };
}

/**
 * Where a tap takes the reveal next.
 *
 * Returns the next stage, or 'next-card' when there are more pulls to step
 * through, or 'done' when the pack is finished and the shop should return.
 */
export function tapFrom(
  stage: RevealStage,
  revealed: number,
  pullCount: number,
): RevealStage | 'next-card' | 'done' {
  if (stage < PULLED) return (stage + 1) as RevealStage;
  // At PULLED: walk the remaining cards before offering another pack.
  return revealed < pullCount - 1 ? 'next-card' : 'done';
}
