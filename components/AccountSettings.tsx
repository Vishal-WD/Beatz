'use client';

/**
 * Account settings: picture, password, and deletion.
 *
 * The profile screen previously offered a display-name field and a sign-out
 * link, so there was no way to change a password and no way to leave — the
 * account was permanent once created, which is not acceptable for something
 * holding an email address.
 *
 * Deletion is deliberately the hardest thing on this sheet to do by
 * accident: it is last, it is the only destructive colour, and it requires
 * typing the word DELETE. It is also genuinely permanent — the SQL function
 * behind it removes the auth user, not just the profile row — so the copy
 * says so plainly rather than softening it.
 */

import { useCallback, useRef, useState } from 'react';
import { Button, Field, Sheet } from '@/components/ui';
import { Avatar } from '@/components/Avatar';
import {
  uploadAvatar, removeAvatar, changePassword, deleteAccount, type DbProfile,
} from '@/lib/supabase';

type Busy = null | 'avatar' | 'password' | 'delete';

export function AccountSettings({
  open,
  onClose,
  profile,
  onProfileChanged,
  onDeleted,
}: {
  open: boolean;
  onClose: () => void;
  profile: DbProfile;
  onProfileChanged: () => void;
  onDeleted: () => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<Busy>(null);
  const [note, setNote] = useState<{ kind: 'ok' | 'bad'; text: string } | null>(null);

  const [curPw, setCurPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmText, setConfirmText] = useState('');

  const pickAvatar = useCallback(async (file: File | undefined) => {
    if (!file) return;
    setBusy('avatar');
    setNote(null);
    const res = await uploadAvatar(file);
    setBusy(null);
    if ('error' in res) { setNote({ kind: 'bad', text: res.error }); return; }
    setNote({ kind: 'ok', text: 'Picture updated.' });
    onProfileChanged();
  }, [onProfileChanged]);

  const dropAvatar = useCallback(async () => {
    setBusy('avatar');
    setNote(null);
    const ok = await removeAvatar();
    setBusy(null);
    setNote(ok
      ? { kind: 'ok', text: 'Back to your gradient.' }
      : { kind: 'bad', text: 'Could not remove it.' });
    if (ok) onProfileChanged();
  }, [onProfileChanged]);

  const savePassword = useCallback(async () => {
    setBusy('password');
    setNote(null);
    const res = await changePassword(curPw, newPw);
    setBusy(null);
    if ('error' in res) { setNote({ kind: 'bad', text: res.error }); return; }
    setCurPw(''); setNewPw('');
    setNote({ kind: 'ok', text: 'Password changed.' });
  }, [curPw, newPw]);

  const confirmDelete = useCallback(async () => {
    setBusy('delete');
    setNote(null);
    const res = await deleteAccount();
    setBusy(null);
    if ('error' in res) { setNote({ kind: 'bad', text: res.error }); return; }
    onDeleted();
  }, [onDeleted]);

  return (
    <Sheet open={open} onClose={onClose} title="ACCOUNT">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>

        {/* ── Picture ── */}
        <section style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <SectionLabel>PICTURE</SectionLabel>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <Avatar id={profile.id} initials={profile.initials} url={profile.avatar_url} size={62} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7, flex: 1 }}>
              <input
                ref={fileRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={(e) => void pickAvatar(e.target.files?.[0])}
                style={{ display: 'none' }}
              />
              <PillButton onClick={() => fileRef.current?.click()} disabled={busy !== null}>
                {busy === 'avatar' ? 'WORKING…' : 'CHOOSE A PICTURE'}
              </PillButton>
              {profile.avatar_url && (
                <PillButton onClick={dropAvatar} disabled={busy !== null}>
                  REMOVE
                </PillButton>
              )}
            </div>
          </div>
          <Hint>JPEG, PNG or WebP, up to 2MB. Without one you keep your gradient.</Hint>
        </section>

        {/* ── Password ── */}
        <section style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <SectionLabel>PASSWORD</SectionLabel>
          <Field
            label="CURRENT PASSWORD"
            type="password"
            value={curPw}
            onChange={setCurPw}
            autoComplete="current-password"
          />
          <Field
            label="NEW PASSWORD"
            type="password"
            value={newPw}
            onChange={setNewPw}
            autoComplete="new-password"
          />
          <Button
            onClick={savePassword}
            disabled={busy !== null || !curPw || newPw.length < 8}
          >
            {busy === 'password' ? 'CHANGING…' : 'CHANGE PASSWORD'}
          </Button>
          {/* Said up front rather than only on failure: the current password
              is checked before the change, so a phone left unlocked cannot
              be used to take the account. */}
          <Hint>At least 8 characters. Your current password is verified first.</Hint>
        </section>

        {note && (
          <div
            role="status"
            style={{
              font: '500 9px/1.5 var(--font-tele)', letterSpacing: '.08em',
              color: note.kind === 'ok' ? 'var(--neon-mint)' : 'var(--neon-pink)',
            }}
          >
            {note.text.toUpperCase()}
          </div>
        )}

        {/* ── Deletion ── */}
        <section
          style={{
            display: 'flex', flexDirection: 'column', gap: 10,
            paddingTop: 18, borderTop: 'var(--border-hair)',
          }}
        >
          <SectionLabel tone="danger">DELETE ACCOUNT</SectionLabel>
          <Hint>
            Permanent. Your profile, your collection and your Drops go, and the
            cards return to the supply pool. This cannot be undone.
          </Hint>
          <Field
            label="TYPE DELETE TO CONFIRM"
            value={confirmText}
            onChange={setConfirmText}
            placeholder="DELETE"
          />
          <button
            onClick={confirmDelete}
            disabled={busy !== null || confirmText.trim().toUpperCase() !== 'DELETE'}
            style={{
              font: '700 10px/1 var(--font-tele)', letterSpacing: '.16em',
              padding: '13px 0', borderRadius: 'var(--radius-sm)',
              background: 'transparent',
              border: '1px solid var(--neon-pink)',
              color: 'var(--neon-pink)',
              opacity: busy !== null || confirmText.trim().toUpperCase() !== 'DELETE' ? 0.4 : 1,
            }}
          >
            {busy === 'delete' ? 'DELETING…' : 'DELETE MY ACCOUNT'}
          </button>
        </section>
      </div>
    </Sheet>
  );
}

function SectionLabel({ children, tone }: { children: React.ReactNode; tone?: 'danger' }) {
  return (
    <div
      style={{
        font: '700 8px/1 var(--font-tele)', letterSpacing: '.2em',
        color: tone === 'danger' ? 'var(--neon-pink)' : 'var(--ink-40)',
      }}
    >
      {children}
    </div>
  );
}

function Hint({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ font: '400 9px/1.55 var(--font-body)', color: 'var(--ink-40)' }}>
      {children}
    </div>
  );
}

function PillButton({
  children, onClick, disabled,
}: { children: React.ReactNode; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        font: '700 9px/1 var(--font-tele)', letterSpacing: '.14em',
        padding: '10px 12px', borderRadius: 'var(--radius-sm)',
        background: 'var(--surface-inset)', border: 'var(--border-hair)',
        color: 'var(--ink-60)', opacity: disabled ? 0.45 : 1,
      }}
    >
      {children}
    </button>
  );
}
