'use client';

/**
 * What plays next.
 *
 * The room could only ever hold one song, so there was nothing to show. Now
 * that a second play queues instead of being refused, the queue has to be
 * visible — a hidden queue is indistinguishable from a lost tap.
 *
 * The panel says different things in different rooms, because the control
 * models genuinely differ (CLAUDE.md §1.1) and pretending otherwise would
 * mislead: a Delegated room's order is decided by votes, a Contested room's
 * by arrival, and in a Spectator room the crowd cannot queue at all.
 */

import { playOrder, canQueue, type QueueEntry } from '@/lib/domain/queue';
import { controlModelFor, type FormatId } from '@/lib/domain/formats';
import { Avatar } from '@/components/Avatar';

export function QueuePanel({
  queue,
  format,
  playerId,
  isHost,
  onRemove,
  onVote,
}: {
  queue: QueueEntry[];
  format: FormatId;
  playerId: string;
  isHost: boolean;
  onRemove: (entryId: string) => void;
  onVote: (entryId: string) => void;
}) {
  const control = controlModelFor(format);
  const ordered = playOrder(queue, format);

  // Votes decide the order in a Delegated room and nowhere else, so the
  // button only appears where pressing it does something.
  const votable = control === 'delegated';

  if (ordered.length === 0) {
    return (
      <div style={{ padding: '14px 2px' }}>
        <Heading count={0} control={control} />
        <div style={{ font: '400 11px/1.5 var(--font-body)', color: 'var(--ink-40)' }}>
          {canQueue(format, isHost)
            ? 'Play another card to line it up next.'
            : 'The host picks what plays here.'}
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: '14px 2px' }}>
      <Heading count={ordered.length} control={control} />

      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {ordered.map((q, i) => {
          const mine = q.playerId === playerId;
          const votes = new Set(q.votes).size;
          const voted = q.votes.includes(playerId);

          return (
            <div
              key={q.id}
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '9px 0',
                borderBottom: i < ordered.length - 1 ? 'var(--border-hair)' : 'none',
              }}
            >
              <span
                aria-hidden
                style={{
                  width: 18, flexShrink: 0, textAlign: 'right',
                  font: '700 11px/1 var(--font-stat)',
                  color: i === 0 ? 'var(--neon-mint)' : 'var(--ink-25)',
                }}
              >
                {i + 1}
              </span>

              <Avatar id={q.playerId} initials={q.displayName.slice(0, 2).toUpperCase()} size={26} />

              {/* min-width:0 or a long title refuses to shrink and pushes the
                  controls off the row — flex defaults to min-width:auto. */}
              <span style={{ flex: 1, minWidth: 0 }}>
                <span
                  style={{
                    display: 'block', font: '600 12px/1.3 var(--font-body)', color: 'var(--ink)',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}
                >
                  {q.cardTitle}
                </span>
                <span
                  style={{
                    display: 'block', font: '400 10px/1.3 var(--font-body)', color: 'var(--ink-40)',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}
                >
                  {q.cardArtist} · {mine ? 'you' : q.displayName}
                </span>
              </span>

              {votable && (
                <button
                  data-press
                  onClick={() => onVote(q.id)}
                  aria-label={voted ? `Remove your vote for ${q.cardTitle}` : `Vote for ${q.cardTitle}`}
                  aria-pressed={voted}
                  style={{
                    flexShrink: 0,
                    display: 'flex', alignItems: 'center', gap: 4,
                    font: '700 9px/1 var(--font-tele)', letterSpacing: '.1em',
                    padding: '7px 10px', borderRadius: 'var(--radius-pill)',
                    background: voted ? 'var(--neon-pink)' : 'transparent',
                    color: voted ? 'var(--ink-on-neon)' : 'var(--ink-60)',
                    border: voted ? '1px solid transparent' : 'var(--border-hair)',
                  }}
                >
                  ▲ {votes}
                </button>
              )}

              {/* Only your own, unless you host the room. */}
              {(mine || isHost) && (
                <button
                  data-press
                  onClick={() => onRemove(q.id)}
                  aria-label={`Remove ${q.cardTitle} from the queue`}
                  style={{
                    flexShrink: 0,
                    width: 26, height: 26, borderRadius: '50%',
                    background: 'transparent', border: 'none',
                    color: 'var(--ink-40)', font: '400 15px/1 var(--font-body)',
                  }}
                >
                  ×
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Heading({ count, control }: { count: number; control: string }) {
  return (
    <div
      style={{
        font: '400 8px/1 var(--font-tele)', letterSpacing: '.18em',
        color: 'var(--ink-40)', marginBottom: 8,
      }}
    >
      UP NEXT{count > 0 ? ` · ${count}` : ''}
      {/* Saying HOW the order is decided, because it is not the same in
          every room and a queue that reorders itself unexplained looks
          broken. */}
      {control === 'delegated' && count > 0 && ' · MOST WANTED FIRST'}
    </div>
  );
}
