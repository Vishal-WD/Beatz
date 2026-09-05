'use client';

/**
 * Finding people, and following them.
 *
 * Lives on the ROOM lobby because that is where you go to find something to
 * join — searching for a person and searching for a room are the same
 * intention. Following is a discovery mechanism only: CLAUDE.md §1.1 is
 * explicit that it must never touch rarity, pull odds or supply, so nothing
 * here writes anything but a follows row.
 *
 * There is no /u/[handle] route on purpose. The app is a static export, so
 * every dynamic path has to be enumerable at build time — which is exactly
 * what 404'd the event pages. A person opens as a sheet over this screen
 * instead, which needs no route at all.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { Avatar } from '@/components/Avatar';
import {
  searchPeople, fetchFollowList, toggleFollow, type PersonResult,
} from '@/lib/supabase';
import { useHaptics } from '@/lib/useHaptics';

/** A green dot for present, a hollow one for not. */
function Presence({ online }: { online: boolean }) {
  return (
    <span
      title={online ? 'Online now' : 'Offline'}
      style={{
        width: 7, height: 7, borderRadius: '50%', flexShrink: 0,
        background: online ? 'var(--neon-mint)' : 'transparent',
        border: online ? 'none' : '1px solid var(--ink-40)',
        boxShadow: online ? '0 0 6px var(--neon-mint)' : 'none',
      }}
    />
  );
}

function FollowButton({
  person, following, busy, onToggle,
}: {
  person: PersonResult;
  following: boolean;
  busy: boolean;
  onToggle: (p: PersonResult, next: boolean) => void;
}) {
  return (
    <button
      data-press
      disabled={busy}
      onClick={(e) => { e.stopPropagation(); onToggle(person, !following); }}
      aria-label={following ? `Unfollow ${person.displayName}` : `Follow ${person.displayName}`}
      style={{
        flexShrink: 0,
        font: '700 9px/1 var(--font-tele)', letterSpacing: '.14em',
        padding: '8px 13px', borderRadius: 'var(--radius-pill)',
        background: following ? 'transparent' : 'var(--neon-pink)',
        color: following ? 'var(--ink-60)' : 'var(--ink-on-neon)',
        border: following ? 'var(--border-hair)' : '1px solid transparent',
        opacity: busy ? 0.5 : 1,
      }}
    >
      {following ? 'FOLLOWING' : 'FOLLOW'}
    </button>
  );
}

function PersonRow({
  person, following, busy, onToggle,
}: {
  person: PersonResult;
  following: boolean;
  busy: boolean;
  onToggle: (p: PersonResult, next: boolean) => void;
}) {
  return (
    <div
      style={{
        display: 'flex', alignItems: 'center', gap: 11, padding: '9px 0',
        borderBottom: 'var(--border-hair)',
      }}
    >
      <Avatar id={person.id} initials={person.initials} url={person.avatarUrl} size={38} />

      {/* min-width:0 or a long display name refuses to shrink and pushes the
          follow button off the row — flex items default to min-width:auto. */}
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Presence online={person.online} />
          <span
            style={{
              font: '600 13px/1.25 var(--font-body)', color: 'var(--ink)',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}
          >
            {person.displayName}
          </span>
        </span>
        <span
          style={{
            display: 'block', font: '400 10px/1.3 var(--font-body)', color: 'var(--ink-40)',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}
        >
          @{person.handle}
          {person.online ? ' · online' : ''}
        </span>
      </span>

      <FollowButton person={person} following={following} busy={busy} onToggle={onToggle} />
    </div>
  );
}

export function PeopleSearch({ onFollowChange }: { onFollowChange?: () => void } = {}) {
  const haptic = useHaptics();

  const [q, setQ] = useState('');
  const [results, setResults] = useState<PersonResult[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [following, setFollowing] = useState<PersonResult[]>([]);
  const [followedIds, setFollowedIds] = useState<Set<string>>(new Set());
  const [busyId, setBusyId] = useState<string | null>(null);

  /* Who you already follow, so the buttons render in the right state from
     the first paint rather than flipping once a request lands. */
  const loadFollowing = useCallback(async () => {
    const list = await fetchFollowList('following');
    setFollowing(list);
    setFollowedIds(new Set(list.map((p) => p.id)));
  }, []);

  useEffect(() => { void loadFollowing(); }, [loadFollowing]);

  /*
    Debounced search. Typing "vishal" would otherwise fire six queries and
    render whichever came back last — which is not necessarily the one for
    what is now in the box.
  */
  const seq = useRef(0);
  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) { setResults(null); setSearching(false); return; }

    setSearching(true);
    const mine = ++seq.current;
    const id = setTimeout(async () => {
      const found = await searchPeople(term);
      // A slower earlier request must not overwrite a newer one.
      if (mine !== seq.current) return;
      setResults(found);
      setSearching(false);
    }, 280);

    return () => clearTimeout(id);
  }, [q]);

  const onToggle = useCallback(async (person: PersonResult, next: boolean) => {
    setBusyId(person.id);
    haptic('light');

    // Optimistic: the button answers immediately, and reverts if the write
    // fails. A follow that waits on a round trip feels broken.
    setFollowedIds((prev) => {
      const s = new Set(prev);
      if (next) s.add(person.id); else s.delete(person.id);
      return s;
    });

    const ok = await toggleFollow(person.id, next);
    if (!ok) {
      setFollowedIds((prev) => {
        const s = new Set(prev);
        if (next) s.delete(person.id); else s.add(person.id);
        return s;
      });
    } else {
      await loadFollowing();
      // A follower count rendered beside this component would otherwise sit
      // stale, disagreeing with the list directly underneath it.
      onFollowChange?.();
    }
    setBusyId(null);
  }, [haptic, loadFollowing, onFollowChange]);

  const term = q.trim();
  const showing = term.length >= 2 ? results : null;

  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ position: 'relative', marginBottom: 10 }}>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Find people"
          aria-label="Search for people by name or handle"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          style={{
            width: '100%', boxSizing: 'border-box',
            font: '400 13px/1.3 var(--font-body)', color: 'var(--ink)',
            padding: '11px 34px 11px 13px',
            borderRadius: 'var(--radius-pill)',
            background: 'var(--surface-inset)',
            border: 'var(--border-hair)',
            outline: 'none',
          }}
        />
        {q && (
          <button
            onClick={() => setQ('')}
            aria-label="Clear search"
            style={{
              position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)',
              width: 24, height: 24, borderRadius: '50%',
              background: 'transparent', border: 'none', color: 'var(--ink-40)',
              font: '400 15px/1 var(--font-body)',
            }}
          >
            ×
          </button>
        )}
      </div>

      {/* Search results replace the following list while a term is typed. */}
      {showing !== null ? (
        showing.length === 0 && !searching ? (
          <div style={{ font: '400 11px/1.4 var(--font-body)', color: 'var(--ink-40)', padding: '10px 0' }}>
            Nobody matching “{term}”.
          </div>
        ) : (
          <div>
            {showing.map((p) => (
              <PersonRow
                key={p.id}
                person={p}
                following={followedIds.has(p.id)}
                busy={busyId === p.id}
                onToggle={onToggle}
              />
            ))}
          </div>
        )
      ) : following.length > 0 ? (
        <div>
          <div
            style={{
              font: '400 8px/1 var(--font-tele)', letterSpacing: '.18em',
              color: 'var(--ink-40)', margin: '4px 0 6px',
            }}
          >
            FOLLOWING · {following.filter((p) => p.online).length} ONLINE
          </div>
          {following.map((p) => (
            <PersonRow
              key={p.id}
              person={p}
              following={followedIds.has(p.id)}
              busy={busyId === p.id}
              onToggle={onToggle}
            />
          ))}
        </div>
      ) : (
        <div style={{ font: '400 11px/1.4 var(--font-body)', color: 'var(--ink-40)', padding: '2px 0 6px' }}>
          Search a name or @handle to find people.
        </div>
      )}
    </div>
  );
}
