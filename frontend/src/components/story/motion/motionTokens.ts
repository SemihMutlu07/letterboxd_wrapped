/**
 * Coherent motion vocabulary for the Wrapped story experience.
 * Reveal = snappy entrances; Ambient = slow continuous drift after settle.
 */

export const MOTION_DURATION = {
  revealFast: 0.4,
  reveal: 0.52,
  transition: 0.72,
  streamBurst: 0.34,
  emphasis: 0.46,
  fieldEnter: 0.58,
  panelEnter: 0.44,
  panelExit: 0.36,
  cardReveal: 0.68,
} as const;

export const MOTION_STAGGER = {
  textLabel: 0,
  textHeadline: 0.11,
  textSub: 0.24,
  streamPoster: 0.042,
  curtainPoster: 0.034,
} as const;

export const MOTION_AMBIENT = {
  streamPan: 22,
  portraitDrift: 20,
  verticalStrip: 15,
  verticalCascade: 13,
  verticalMosaic: 17,
} as const;

export const MOTION_EASE = {
  editorial: [0.22, 1, 0.36, 1] as const,
  snap: [0.16, 1, 0.3, 1] as const,
  warm: [0.25, 0.46, 0.45, 0.94] as const,
  drift: [0.45, 0, 0.55, 1] as const,
  outSoft: [0.33, 1, 0.32, 1] as const,
} as const;

export function scaledDuration(base: number, motionScale = 1): number {
  return base * motionScale;
}

export function ambientLoopTransition(
  baseSeconds: number,
  motionScale = 1,
  active = true,
) {
  if (!active) return { duration: 0 };
  return {
    duration: scaledDuration(baseSeconds, motionScale),
    repeat: Infinity,
    repeatType: 'reverse' as const,
    ease: MOTION_EASE.drift,
  };
}

export function verticalDriftTransition(
  baseSeconds: number,
  index: number,
  motionScale = 1,
  active = true,
) {
  return ambientLoopTransition(baseSeconds + (index % 4) * 0.75, motionScale, active);
}
