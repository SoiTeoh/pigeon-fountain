import { tuning, type Tuning } from '../config/tuning';
import type { PigeonFountainWorld, RivalBird } from '../game/world';
import { drawPauseOverlay, drawResultOverlay, drawTitleOverlay } from '../scenes/overlays';
import { drawBird } from './actors/birds';
import { computeCameraShake } from './camera';
import { drawParticlesShockwavesAndFloats } from './fx/particles';
import { drawDebugOverlay, drawHudAndControls } from './hud';
import { drawPlazaBackground, drawPropsAndPickups, drawSingleFountainJet } from './plaza';
import type { RenderExtra } from './shared';

export type { RenderExtra } from './shared';

export function drawGameFrame(
  ctx: CanvasRenderingContext2D,
  world: PigeonFountainWorld,
  extra: RenderExtra,
  t: Tuning = tuning,
): void {
  ctx.save();
  const shake = computeCameraShake(world, extra.screenMode);
  ctx.translate(shake.x, shake.y);

  drawPlazaBackground(ctx, world, t, extra.animTimeSec);
  drawPropsAndPickups(ctx, world, extra.animTimeSec);

  const plugRatio =
    world.plug.activeSlotIndex !== null
      ? Math.min(1, world.plug.holdSec / t.plug.maxDurationSec)
      : 0;

  for (const n of world.match.nozzles) {
    const isPlugged = world.plug.activeSlotIndex === n.slotIndex;
    const isAdjacent =
      world.plug.activeSlotIndex !== null &&
      Math.abs(n.slotIndex - world.plug.activeSlotIndex) === 1;
    drawSingleFountainJet(
      ctx,
      n,
      t,
      extra.animTimeSec,
      isPlugged ? plugRatio : 0,
      isAdjacent ? plugRatio : 0,
    );
  }

  for (const r of world.rivals) {
    if (r.respawnTimerSec > 0) continue;
    const onActive = world.match.nozzles.some(
      (n) => n.phase === 'ACTIVE' && Math.abs(r.x - n.x) <= t.fountain.coreRadiusPx,
    );
    const expr: RivalBird['intent'] extends string
      ? 'launched' | 'stunned' | 'charge' | 'bliss' | 'grumpy'
      : never = r.airborne
      ? 'launched'
      : r.stunTimerSec > 0
        ? 'stunned'
        : r.redCrestState === 'charging' || r.redCrestState === 'lunging'
          ? 'charge'
          : onActive
            ? 'bliss'
            : 'grumpy';

    drawBird(ctx, {
      x: r.x,
      y: r.y,
      facing: r.facing,
      spinRad: r.spinRad,
      waddlePhase: r.waddlePhase,
      squashX: r.squashX,
      squashY: r.squashY,
      kind: r.archetype,
      expression: expr,
      bumpActive: r.redCrestState === 'lunging',
      stunned: r.stunTimerSec > 0 && !r.airborne,
      redCrestChargeRatio:
        r.archetype === 'red_crest' && r.redCrestState === 'charging'
          ? 1 - r.redCrestTimerSec / t.pigeon.redCrestChargeSec
          : 0,
      animTimeSec: extra.animTimeSec,
    });
  }

  const plugJitterX =
    world.plug.activeSlotIndex !== null
      ? Math.sin(extra.animTimeSec * (45 + plugRatio * 40)) * (1.2 + plugRatio * 4.5)
      : 0;

  drawBird(ctx, {
    x: world.player.x + plugJitterX,
    y: world.player.y,
    facing: world.player.facing,
    spinRad: world.player.spinRad,
    waddlePhase: world.player.waddlePhase,
    squashX: world.player.squashX + (world.plug.activeSlotIndex !== null ? plugRatio * 0.14 : 0),
    squashY: world.player.squashY - (world.plug.activeSlotIndex !== null ? plugRatio * 0.1 : 0),
    kind: 'player',
    expression: world.player.expression,
    bumpActive: world.player.bumpAnimSec > 0,
    stunned: false,
    redCrestChargeRatio: 0,
    animTimeSec: extra.animTimeSec,
  });

  drawParticlesShockwavesAndFloats(ctx, world);
  ctx.restore();

  drawHudAndControls(ctx, world, extra, t);

  if (extra.debug) {
    drawDebugOverlay(ctx, world, t);
  }

  if (extra.screenMode === 'title') {
    drawTitleOverlay(ctx, extra, t);
  } else if (extra.screenMode === 'paused') {
    drawPauseOverlay(ctx, extra, t);
  } else if (extra.screenMode === 'result') {
    drawResultOverlay(ctx, world, extra, t);
  }
}
