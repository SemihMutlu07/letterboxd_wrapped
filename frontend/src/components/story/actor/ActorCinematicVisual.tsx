'use client';

import type { PersonSequenceData } from '../types';
import { PersonCinematicVisual } from '../person/PersonCinematicVisual';

export function ActorCinematicVisual({
  sequence,
  accent,
}: {
  sequence: PersonSequenceData;
  accent: string;
}) {
  return (
    <PersonCinematicVisual
      sequence={sequence}
      accent={accent}
      portraitMicroDrift
      portraitEase={[0.25, 0.46, 0.45, 0.94]}
    />
  );
}
