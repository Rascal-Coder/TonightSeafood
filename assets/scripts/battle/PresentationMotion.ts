export interface FrameTween {
  from: number;
  to: number;
  mix: number;
  bridge: number;
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

/**
 * Turns a tiny sprite loop into a held pose followed by a smooth crossfade.
 * The phase is fractional so pooled units do not all breathe in lockstep.
 */
export function frameTween(
  clock: number,
  uid: number,
  frameCount: number,
  secondsPerFrame: number,
  holdRatio = 0.28,
): FrameTween {
  if (frameCount <= 1) return { from: 0, to: 0, mix: 0, bridge: 0 };
  const duration = Math.max(0.08, secondsPerFrame);
  const phase = clock / duration + ((uid * 0.61803398875) % 1);
  const whole = Math.floor(phase);
  const local = phase - whole;
  const linear = clamp01((local - holdRatio) / Math.max(0.01, 1 - holdRatio));
  const mix = linear * linear * (3 - 2 * linear);
  return {
    from: ((whole % frameCount) + frameCount) % frameCount,
    to: (((whole + 1) % frameCount) + frameCount) % frameCount,
    mix,
    bridge: 4 * mix * (1 - mix),
  };
}

