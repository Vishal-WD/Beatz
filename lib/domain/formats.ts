/**
 * The three control models and the six formats pinned to them.
 *
 * CLAUDE.md §1 allows exactly three control models; a fourth needs an
 * explicit recorded decision. Formats are presentation over those models —
 * Concert and Fest differ only by door and scale, so they share mechanics.
 */

export type ControlModel = 'contested' | 'delegated' | 'spectator';
export type FormatId =
  | 'concert' | 'fest' | 'clubbing' | 'night_party' | 'disco' | 'private_party';

/** Who may enter. Independent of CardRule — never merge the two (§1.1). */
export type Visibility = 'open' | 'guest_list';
/** What may be played. Event rooms block Guest Cards (§4). */
export type CardRule = 'casual' | 'event';

export interface FormatDef {
  id: FormatId;
  label: string;
  control: ControlModel;
  visibility: Visibility;
  shoutouts: boolean;
}

export const FORMATS: Record<FormatId, FormatDef> = {
  concert:       { id: 'concert',       label: 'Concert',       control: 'spectator', visibility: 'guest_list', shoutouts: false },
  fest:          { id: 'fest',          label: 'Fest',          control: 'spectator', visibility: 'open',       shoutouts: false },
  clubbing:      { id: 'clubbing',      label: 'Clubbing',      control: 'spectator', visibility: 'guest_list', shoutouts: true  },
  night_party:   { id: 'night_party',   label: 'Night Party',   control: 'delegated', visibility: 'guest_list', shoutouts: false },
  disco:         { id: 'disco',         label: 'Disco',         control: 'contested', visibility: 'open',       shoutouts: true  },
  private_party: { id: 'private_party', label: 'Private Party', control: 'contested', visibility: 'guest_list', shoutouts: true  },
};

export const controlModelFor = (f: FormatId): ControlModel => FORMATS[f].control;

/**
 * Only a contested room takes the throne away. In spectator formats vibe
 * scores the set and cannot end it (§1.2); in delegated the DJ keeps control
 * and only the pool signal weakens.
 */
export const canDethrone = (c: ControlModel): boolean => c === 'contested';

export const allowsShoutouts = (f: FormatId): boolean => FORMATS[f].shoutouts;
