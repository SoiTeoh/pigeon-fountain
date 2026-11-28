import { tuning, type Tuning } from '../config/tuning';
import { STRINGS_ZH } from '../content/strings.zh';
import { findNearbyPluggableNozzles, findPredictedPlugNozzle } from '../game/plug';
import { didPlayerWinRace, evaluateNozzleOccupant } from '../game/rules';
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
import {
  COMIC_PALETTE,
  computeViewportLayout,
  roundRect,
  type RenderExtra,
} from './shared';

export type { RenderExtra } from './shared';

export function drawGameFrame(
  ctx: CanvasRenderingContext2D,
  world: PigeonFountainWorld,
  extra: RenderExtra,
  t: Tuning = tuning,
): void {
  const layout = computeViewportLayout(
    extra.logicalHeight ?? t.view.height,
    extra.safeTopPx ?? 0,
    t,
  );
  const cam = extra.camera ?? {
    x: t.view.width / 2,
    y: t.scene.groundY - 45,
    zoom: 1.3,
  };
  const shake = computeCameraShake(world, extra.screenMode);
  const screenFocusY = t.scene.groundY - 45 + layout.worldBaselineShiftY;

  ctx.save();
  ctx.translate(t.view.width / 2 + shake.x, screenFocusY + shake.y);
  ctx.scale(cam.zoom, cam.zoom);
  ctx.translate(-cam.x, -cam.y);

  drawPlazaBackground(
    ctx,
    world,
    t,
    extra.animTimeSec,
    cam.x - t.view.width / 2,
    280 + layout.worldBaselineShiftY,
    380 + layout.bottomOffsetY,
  );
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

    // Show crisp yellow bump-range target ring under grounded rivals inside bumpReachPx
    if (!world.player.airborne && world.player.bumpCooldownSec <= 0) {
      for (const r of world.rivals) {
        if (r.airborne || r.respawnTimerSec > 0) continue;
        if (Math.abs(r.x - world.player.x) <= t.pigeon.bumpReachPx) {
          ctx.save();
          ctx.strokeStyle = '#FACC15';
          ctx.lineWidth = 2.6;
          ctx.setLineDash([5, 4]);
          ctx.beginPath();
          ctx.ellipse(r.x, t.scene.groundY - 1, 22, 6.5, 0, 0, Math.PI * 2);
          ctx.stroke();
          ctx.restore();
        }
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
      airborne: r.airborne,
      sittingOnWater: onActive,
      wetSlump: false,
      scaleMult: world.stage.bossKind === 'big_white' && r.id === 0 ? 1.28 : 1,
      isBoss: Boolean(world.stage.bossKind && r.id === 0),
    });
  }

  const plugJitterX =
    world.plug.activeSlotIndex !== null
      ? Math.sin(extra.animTimeSec * (45 + plugRatio * 40)) * (1.2 + plugRatio * 4.5)
      : 0;

  const isResult = extra.screenMode === 'result';
  const playerWon = isResult ? didPlayerWinRace(world.match) : false;
  const playerLost = isResult && !playerWon;

  drawBird(ctx, {
    x: world.player.x + plugJitterX,
    y: world.player.y,
    facing: world.player.facing,
    spinRad: world.player.spinRad,
    waddlePhase: world.player.waddlePhase,
    squashX:
      (playerWon ? 1.06 : playerLost ? 1.28 : world.player.squashX) +
      (world.plug.activeSlotIndex !== null ? plugRatio * 0.14 : 0),
    squashY:
      (playerWon ? 0.96 : playerLost ? 0.72 : world.player.squashY) -
      (world.plug.activeSlotIndex !== null ? plugRatio * 0.1 : 0),
    kind: 'player',
    expression: playerWon ? 'smug' : playerLost ? 'panic' : world.player.expression,
    bumpActive: world.player.bumpAnimSec > 0,
    stunned: false,
    redCrestChargeRatio: 0,
    animTimeSec: extra.animTimeSec,
    airborne: world.player.airborne,
    sittingOnWater: world.occupant === 'player',
    wetSlump: playerLost,
  });

  if (playerLost) {
    // Comic rain cloud + drops over defeated wet pigeon
    const cx = world.player.x;
    const cy = world.player.y - 58;
    ctx.save();
    ctx.fillStyle = '#475569';
    ctx.strokeStyle = '#2B2B3A';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(cx - 10, cy, 10, 0, Math.PI * 2);
    ctx.arc(cx + 2, cy - 4, 13, 0, Math.PI * 2);
    ctx.arc(cx + 14, cy, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 2;
    for (let i = -1; i <= 1; i++) {
      const dropY = cy + 12 + ((extra.animTimeSec * 48 + i * 7) % 14);
      ctx.beginPath();
      ctx.moveTo(cx + i * 9, dropY);
      ctx.lineTo(cx + i * 9 - 2, dropY + 5);
      ctx.stroke();
    }
    ctx.restore();
  }

  drawParticlesShockwavesAndFloats(ctx, world);
  ctx.restore();

  if (extra.screenMode !== 'title') {
    drawHudAndControls(ctx, world, extra, t);
  }

  if (extra.screenMode === 'playing') {
    const badgeY = layout.hudOffsetY + 74;
    if ((world.match.photoFlashSec ?? 0) > 0) {
      ctx.save();
      ctx.strokeStyle = COMIC_PALETTE.accentBright;
      ctx.lineWidth = 4;
      roundRect(ctx, 4, layout.hudOffsetY + 4, t.view.width - 8, layout.logicalHeight - layout.hudOffsetY - 8, 12);
      ctx.stroke();

      ctx.fillStyle = COMIC_PALETTE.accentBright;
      roundRect(ctx, t.view.width / 2 - 86, badgeY, 172, 22, 11);
      ctx.fill();
      ctx.strokeStyle = COMIC_PALETTE.outline;
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = COMIC_PALETTE.outline;
      ctx.font = '900 11px "PingFang SC", "Microsoft YaHei", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(STRINGS_ZH.hud.photoFlashActive, t.view.width / 2, badgeY + 11);
      ctx.restore();
    } else if (world.stage.lowGravity) {
      ctx.save();
      ctx.fillStyle = 'rgba(224, 242, 254, 0.92)';
      roundRect(ctx, t.view.width / 2 - 68, badgeY, 136, 20, 10);
      ctx.fill();
      ctx.strokeStyle = COMIC_PALETTE.outline;
      ctx.lineWidth = 1.8;
      ctx.stroke();
      ctx.fillStyle = '#0369A1';
      ctx.font = '800 10.5px "PingFang SC", "Microsoft YaHei", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(STRINGS_ZH.hud.lowGravityBadge, t.view.width / 2, badgeY + 10);
      ctx.restore();
    }

    if (world.assistEnabled) {
      const assistY =
        (world.match.photoFlashSec ?? 0) > 0 || world.stage.lowGravity ? badgeY + 26 : badgeY;
      ctx.save();
      ctx.fillStyle = '#FEF08A';
      roundRect(ctx, t.view.width / 2 - 64, assistY, 128, 20, 10);
      ctx.fill();
      ctx.strokeStyle = COMIC_PALETTE.outline;
      ctx.lineWidth = 1.8;
      ctx.stroke();
      ctx.fillStyle = COMIC_PALETTE.outline;
      ctx.font = '900 10.5px "PingFang SC", "Microsoft YaHei", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(STRINGS_ZH.hud.assistActive, t.view.width / 2, assistY + 10);
      ctx.restore();
    }
  }

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
