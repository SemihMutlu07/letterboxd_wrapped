/** Shared motion vocabulary for person-cinematic story slides. */

export const REVEAL = {
  duration: 0.55,
  ease: [0.22, 1, 0.36, 1] as const,
};

export const TRANSITION = {
  duration: 0.85,
  ease: [0.33, 1, 0.68, 1] as const,
};

export const EMPHASIS = {
  duration: 0.45,
  ease: [0.16, 1, 0.3, 1] as const,
};

/** Phase timeline (ms) for the staged person reveal. */
export const PHASE_MS = {
  identity: 0,
  portrait: 1100,
  composition: 2100,
  posters: 2800,
  ambient: 3800,
  rewatch: 2800,
} as const;

export type CinematicPhase = 'identity' | 'portrait' | 'composition' | 'posters' | 'ambient';

export function phaseAt(elapsedMs: number, reduceMotion: boolean): CinematicPhase {
  if (reduceMotion) return 'ambient';
  if (elapsedMs < PHASE_MS.portrait) return 'identity';
  if (elapsedMs < PHASE_MS.composition) return 'portrait';
  if (elapsedMs < PHASE_MS.posters) return 'composition';
  if (elapsedMs < PHASE_MS.ambient) return 'posters';
  return 'ambient';
}
