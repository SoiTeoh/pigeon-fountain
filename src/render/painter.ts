import { tuning, type Tuning } from '../config/tuning';
import { findNearbyPluggableNozzles, findPredictedPlugNozzle } from '../game/plug';
import { evaluateNozzleOccupant } from '../game/rules';
import type { PigeonFountainWorld, RivalBird } from '../game/world';
import { drawPauseOverlay, drawResultOverlay, drawTitleOverlay } from '../scenes/overlays';
import { drawBird } from './actors/birds';
import { computeCameraShake } from './camera';
import { drawParticlesShockwavesAndFloats } from './fx/particles';
import { drawDebugOverlay, drawHudAndControls } from './hud';
import {
  drawButtIcon,
  drawLandingMarker,
  drawPlazaBackground,
  drawPropsAndPickups,
  drawSingleFountainJet,
  drawUndergroundPlugPipes,
} from './plaza';
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

  // Resolve active plugger (player or rival) for unified visuals & underground pipes
  const pluggingRival = world.rivals.find((r) => r.plugSlotIndex !== null);
  const activePlugSlot =
    world.plug.activeSlotIndex ?? pluggingRival?.plugSlotIndex ?? null;
  const plugRatio =
    world.plug.activeSlotIndex !== null
      ? Math.min(1, world.plug.holdSec / t.plug.maxDurationSec)
      : pluggingRival
        ? Math.min(1, pluggingRival.plugHoldSec / t.plug.maxDurationSec)
        : 0;
  const pluggerKind =
    world.plug.activeSlotIndex !== null
      ? 'player'
      : pluggingRival
        ? pluggingRival.archetype
        : 'player';

  const rivalXs = world.rivals.map((r) => (r.respawnTimerSec > 0 ? -999 : r.x));
  const rivalAirbornes = world.rivals.map(
    (r) => r.airborne || r.respawnTimerSec > 0 || r.stunTimerSec > 0,
  );

  for (const n of world.match.nozzles) {
    const isPlugged = activePlugSlot === n.slotIndex;
    const isAdjacent =
      activePlugSlot !== null &&
      Math.abs(n.slotIndex - activePlugSlot) === 1;
    const isContested =
      n.phase === 'ACTIVE' &&
      evaluateNozzleOccupant(
        world.player.x,
        rivalXs,
        n.x,
        world.player.airborne,
        rivalAirbornes,
        t.fountain.coreRadiusPx,
      ) === 'contested';
    drawSingleFountainJet(
      ctx,
      n,
      t,
      extra.animTimeSec,
      isPlugged ? plugRatio : 0,
      isAdjacent ? plugRatio : 0,
      isContested,
      pluggerKind,
    );
  }

  if (activePlugSlot !== null) {
    drawUndergroundPlugPipes(
      ctx,
      world.match.nozzles,
      activePlugSlot,
      plugRatio,
      pluggerKind,
      t,
      extra.animTimeSec,
    );
  }

  // Plugging discoverability: nearby idle/warning nozzles show bouncing butt icon; airborne shows landing prediction
  if (extra.screenMode === 'playing' && world.plug.activeSlotIndex === null) {
    if (world.player.airborne) {
      const pred = findPredictedPlugNozzle(
        world.player.x,
        world.player.y,
        world.player.vx,
        world.player.vy,
        world.player.airborne,
        world.plug.cooldownSec,
        world.match.nozzles,
        t,
      );
      drawLandingMarker(ctx, pred.landingX, t.scene.groundY, pred.nozzle !== null, extra.animTimeSec);
    } else {
      const nearby = findNearbyPluggableNozzles(
        world.player.x,
        world.player.airborne,
        world.plug.cooldownSec,
        world.match.nozzles,
        t,
      );
      const bob = Math.sin(extra.animTimeSec * 7) * 3;
      for (const n of nearby) {
        drawButtIcon(ctx, n.x, t.scene.groundY - 28 + bob, 0.85, 0.9);
      }
    }
  }

  for (const r of world.rivals) {
    if (r.respawnTimerSec > 0) continue;
    const onActive = world.match.nozzles.some(
      (n) => n.phase === 'ACTIVE' && Math.abs(r.x - n.x) <= t.fountain.coreRadiusPx,
    );
    const expr: RivalBird['intent'] extends string
      ? 'launched' | 'stunned' | 'charge' | 'bliss' | 'grumpy' | 'panic'
      : never = r.airborne
      ? 'launched'
      : r.stunTimerSec > 0
        ? 'stunned'
        : r.plugSlotIndex !== null
          ? 'panic'
          : r.smugTimerSec > 0
            ? 'bliss'
            : r.redCrestState === 'charging' || r.redCrestState === 'lunging'
              ? 'charge'
              : onActive
                ? 'bliss'
                : 'grumpy';

    const rivalPlugRatio =
      r.plugSlotIndex !== null ? Math.min(1, r.plugHoldSec / t.plug.maxDurationSec) : 0;
    const rivalJitterX =
      r.plugSlotIndex !== null
        ? Math.sin(extra.animTimeSec * (45 + rivalPlugRatio * 40)) * (1.2 + rivalPlugRatio * 4.5)
        : 0;

    drawBird(ctx, {
      x: r.x + rivalJitterX,
      y: r.y,
      facing: r.facing,
      spinRad: r.spinRad,
      waddlePhase: r.waddlePhase,
      squashX: r.squashX + (r.plugSlotIndex !== null ? rivalPlugRatio * 0.14 : 0),
      squashY: r.squashY - (r.plugSlotIndex !== null ? rivalPlugRatio * 0.1 : 0),
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
