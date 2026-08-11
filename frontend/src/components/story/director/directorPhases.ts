export const DIRECTOR_STREAM_POSTER_CAP = 12;

export type DirectorPhase =
  | 'textReveal'
  | 'portraitIntro'
  | 'compose'
  | 'streamBurst'
  | 'streamAmbient'
  | 'final';

export const DIRECTOR_PHASE_ORDER: readonly DirectorPhase[] = [
  'textReveal',
  'portraitIntro',
  'compose',
  'streamBurst',
  'streamAmbient',
  'final',
];

/** Wall-clock offsets from slide mount — navigation never waits on these. */
export const DIRECTOR_PHASE_MS: Partial<Record<DirectorPhase, number>> = {
  portraitIntro: 650,
  compose: 1300,
  streamBurst: 1900,
  streamAmbient: 3200,
  final: 3200,
};

export function directorPhaseAt(elapsedMs: number): DirectorPhase {
  let phase: DirectorPhase = 'textReveal';
  for (const candidate of DIRECTOR_PHASE_ORDER) {
    const threshold = DIRECTOR_PHASE_MS[candidate];
    if (threshold != null && elapsedMs >= threshold) {
      phase = candidate;
    }
  }
  return phase;
}

export function showDirectorRewatch(phase: DirectorPhase, reduce: boolean): boolean {
  if (reduce) return true;
  return phase === 'streamBurst' || phase === 'streamAmbient' || phase === 'final';
}
