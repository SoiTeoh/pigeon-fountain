import type { Tuning } from '../config/tuning';
import type { ScreenMode } from '../game/rules';
import type { PigeonFountainWorld } from '../game/world';
import type { RenderExtra } from '../render/shared';
import { drawPauseOverlay, drawResultOverlay, drawTitleOverlay } from './overlays';

export class SceneManager {
  private current: ScreenMode;

  constructor(initial: ScreenMode = 'title') {
    this.current = initial;
  }

  get mode(): ScreenMode {
    return this.current;
  }

  transitionTo(next: ScreenMode): void {
    this.current = next;
  }

  renderOverlay(
    ctx: CanvasRenderingContext2D,
    world: PigeonFountainWorld,
    extra: RenderExtra,
    t: Tuning,
  ): void {
    if (extra.screenMode === 'title') {
      drawTitleOverlay(ctx, extra, t);
    } else if (extra.screenMode === 'paused') {
      drawPauseOverlay(ctx, extra, t);
    } else if (extra.screenMode === 'result') {
      drawResultOverlay(ctx, world, extra, t);
    }
  }
}
