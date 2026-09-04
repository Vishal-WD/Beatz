'use client';

/**
 * A player's picture, or the generated gradient when they have none.
 *
 * The fallback is not a placeholder to be replaced later — most players
 * never upload anything, so the gradient IS the normal case. It is derived
 * from the player id, so it is stable and distinct per person rather than a
 * grey circle everyone shares.
 *
 * An image that fails to load falls back to the same gradient rather than
 * leaving a broken-image glyph: a profile picture that 404s (deleted file,
 * offline, CDN hiccup) should degrade to what the player had before.
 */

import { useState } from 'react';
import { avatarFor } from '@/lib/rarity';

export function Avatar({
  id,
  initials,
  url,
  size = 54,
  ring,
}: {
  id: string;
  initials: string;
  url?: string | null;
  size?: number;
  /** A CSS colour for a thin border — used where the avatar sits on art. */
  ring?: string;
}) {
  const [failed, setFailed] = useState(false);
  const showImage = Boolean(url) && !failed;

  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        background: avatarFor(id),
        display: 'grid',
        placeItems: 'center',
        overflow: 'hidden',
        flexShrink: 0,
        border: ring ? `2px solid ${ring}` : undefined,
        position: 'relative',
      }}
    >
      {showImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={url as string}
          alt=""
          onError={() => setFailed(true)}
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
        />
      ) : (
        <span style={{ font: `700 ${Math.round(size * 0.37)}px/1 var(--font-stat)`, color: 'var(--ink)' }}>
          {initials}
        </span>
      )}
    </div>
  );
}
