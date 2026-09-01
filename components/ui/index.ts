/**
 * Nine primitives, three contracts. Know which one you're extending before
 * you reach for a style prop:
 *
 * - Frame and Panel accept `style` — callers position them.
 * - Button and Field spread native HTML attributes — they wrap native
 *   elements.
 * - Badge, Segmented, Stat, Sheet and EmptyState are closed — extend the
 *   component rather than styling around it.
 *
 * Across all nine, `borderRadius` is guarded wherever a caller could
 * otherwise override it: square corners are a hard global constraint
 * (spec §7.1), not a per-screen choice.
 */

export { Frame } from './Frame';
export type { FrameProps } from './Frame';
export { Button } from './Button';
export type { ButtonProps, ButtonVariant, ButtonSize } from './Button';
export { Panel } from './Panel';
export type { PanelProps } from './Panel';
export { Badge } from './Badge';
export type { BadgeProps, BadgeTone } from './Badge';
export { Field } from './Field';
export type { FieldProps } from './Field';
export { Segmented } from './Segmented';
export type { SegmentedProps } from './Segmented';
export { Stat } from './Stat';
export type { StatProps } from './Stat';
export { Sheet } from './Sheet';
export type { SheetProps } from './Sheet';
export { EmptyState } from './EmptyState';
export type { EmptyStateProps } from './EmptyState';
