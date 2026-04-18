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

export function isValidPress(value: string): value is Press {
  return (PRESSES as readonly string[]).includes(value);
}

export function isValidPhase(value: string): value is Phase {
  return (PHASES as readonly string[]).includes(value);
}
