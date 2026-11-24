import type { Tuning } from '../config/tuning';
import type { ScreenMode } from '../game/rules';
import type { PigeonFountainWorld } from '../game/world';
import type { CameraView } from './shared';

export interface CameraOffset {
  readonly x: number;
  readonly y: number;
}

export function createInitialCameraState(t: Tuning): CameraView {
  return {
    x: t.view.width / 2,
    y: t.scene.groundY - 45,
    zoom: 1.3,
  };
}

export function stepCameraState(
  prev: CameraView,
  world: PigeonFountainWorld,
  dtSec: number,
  t: Tuning,
  zoomOverride: number | null = null,
): CameraView {
  const highThresholdY = t.scene.groundY - 85;
  let highestBird: { x: number; y: number } | null = null;
  if (world.player.y < highThresholdY) {
    highestBird = { x: world.player.x, y: world.player.y };
  }
  for (const r of world.rivals) {
    if (r.respawnTimerSec > 0) continue;
    if (r.y < highThresholdY && (!highestBird || r.y < highestBird.y)) {
      highestBird = { x: r.x, y: r.y };
    }
  }

  let targetX = t.view.width / 2;
  let targetY = t.scene.groundY - 45;
  let targetZoom = zoomOverride ?? 1.3;

  if (highestBird && zoomOverride === null) {
    targetZoom = 1.0;
    targetX = Math.max(130, Math.min(260, t.view.width / 2 + (highestBird.x - t.view.width / 2) * 0.45));
    targetY = Math.max(t.scene.groundY - 120, Math.min(t.scene.groundY - 45, highestBird.y + 40));
  }

  const alpha = 1 - Math.exp(-6.5 * Math.max(0, dtSec));
  return {
    x: prev.x + (targetX - prev.x) * alpha,
    y: prev.y + (targetY - prev.y) * alpha,
    zoom: prev.zoom + (targetZoom - prev.zoom) * alpha,
  };
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
