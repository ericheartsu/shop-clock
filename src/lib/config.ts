/**
 * Shop config — single source of truth for shop-specific labels.
 *
 * When onboarding another shop, swap PRESSES/PHASES here rather than
 * hunting hardcoded strings across the codebase.
 */

export const PRESSES = ['Roq Eco', 'Roq You'] as const;
export type Press = (typeof PRESSES)[number];

export const PHASES = ['Setup', 'Production', 'Teardown'] as const;
export type Phase = (typeof PHASES)[number];

export const PHASE_COLORS: Record<Phase, string> = {
  Setup: 'bg-craft-cyan hover:bg-craft-cyan/90 text-white',
  Production: 'bg-craft-lime hover:bg-craft-lime/90 text-craft-black',
  Teardown: 'bg-craft-orange hover:bg-craft-orange/90 text-white',
};

/**
 * PRESS_TO_DEPARTMENT — HQ Print mirror for future reconcile / unification.
 * Every Press in this file MUST map to the HQ department slug it belongs to.
 * The unification script reads this to land time entries into the right HQ
 * department when shop-clock rows are folded into HQ.
 *
 * HQ departments use slug keys (see hq-print/prisma/seed.mjs). Keep values
 * in sync with that source.
 */
export const PRESS_TO_DEPARTMENT: Record<Press, string> = {
  'Roq Eco': 'screen-print',
  'Roq You': 'screen-print',
};

/**
 * Method picklist — mirrors HQ Print's DecorationMethod names where possible.
 * Kept as plain strings in the DB (no Postgres enum) so adding a new method
 * is a config edit, not a migration.
 *
 * Source of truth for HQ names: C:\Dev\hq-print\prisma\seed.mjs
 *   (currently: "Screen Printing", "Embroidery", "DTG / DTF")
 * We use the more-granular shop vocabulary here (DTG vs DTF split, plus
 * Transfer/Sublimation) per the capture-hardening spec. The unification
 * script will normalize these on the way into HQ.
 */
export const METHODS = [
  'Screen Print',
  'DTG',
  'DTF',
  'Embroidery',
  'Transfer',
  'Sublimation',
] as const;
export type Method = (typeof METHODS)[number];

/**
 * Location picklist — standard decoration positions on a garment.
 * "Other" is a sentinel — when selected, the UI shows a freeform input
 * and stores the text in PhaseZeroDecoration.locationOther.
 */
export const LOCATIONS = [
  'Front Center',
  'Back Center',
  'Left Chest',
  'Right Chest',
  'Neck Tag',
  'Neck Label',
  'Sleeve L',
  'Sleeve R',
  'Hem',
  'Hood',
  'Other',
] as const;
export type Location = (typeof LOCATIONS)[number];

/**
 * Pause reason picklist — reasons an operator hit PAUSE.
 * "Other" falls through to freeform text captured in the pause dialog.
 */
export const PAUSE_REASONS = [
  'Break',
  'Lunch',
  'Material shortage',
  'Mechanical issue',
  'Waiting on art',
  'Waiting on approval',
  'Quality check',
  'Meeting',
  'End of shift',
  'Other',
] as const;
export type PauseReason = (typeof PAUSE_REASONS)[number];

export function isValidPress(value: string): value is Press {
  return (PRESSES as readonly string[]).includes(value);
}

export function isValidPhase(value: string): value is Phase {
  return (PHASES as readonly string[]).includes(value);
}

export function isValidMethod(value: string): value is Method {
  return (METHODS as readonly string[]).includes(value);
}

export function isValidLocation(value: string): value is Location {
  return (LOCATIONS as readonly string[]).includes(value);
}

export function isValidPauseReason(value: string): value is PauseReason {
  return (PAUSE_REASONS as readonly string[]).includes(value);
}
