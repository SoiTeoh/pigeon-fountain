import type { ScreenMode } from '../game/rules';
import type { PigeonFountainWorld } from '../game/world';

export interface CameraOffset {
  readonly x: number;
  readonly y: number;
}

export function computeCameraShake(
  world: PigeonFountainWorld,
  screenMode: ScreenMode,
): CameraOffset {
  const canShake = screenMode === 'playing' && world.shakeMag > 0.2;
  if (!canShake) {
    return { x: 0, y: 0 };
  }
  return {
    x: (Math.random() - 0.5) * world.shakeMag * 2,
    y: (Math.random() - 0.5) * world.shakeMag * 2,
  };
}
