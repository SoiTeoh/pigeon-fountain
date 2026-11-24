import type { StageConfig, Tuning } from '../config/tuning';
import { decideAiMove } from './ai';
import {
  checkPropHit,
  clamp,
  computeParabolicLaunchVelocity,
  type MatchState,
  type PropState,
} from './rules';
import { pushFloatingText, rivalFeatherSpec, spawnParticleBurst, spawnPropDebrisParticles } from './worldFx';
import type { BonusPickup, FloatingText, Particle, PigeonBody, RivalBird } from './worldTypes';

export interface RivalStepResult {
  redCrestCharged: boolean;
  angledCannonLaunch: boolean;
  propSmashed: boolean;
  shakeMagDelta: number;
  hitStopSec: number;
  match: MatchState;
}

export function pickPropFallbackDir(props: readonly PropState[], fromX: number): -1 | 1 {
  const intact = props.filter((p) => p.intact);
  if (intact.length > 0) {
    let nearest = intact[0];
    let bestDist = Math.abs(nearest.x - fromX);
    for (const p of intact) {
      const d = Math.abs(p.x - fromX);
      if (d < bestDist) {
        bestDist = d;
        nearest = p;
      }
    }
    return nearest.x >= fromX ? 1 : -1;
  }
  return fromX >= 195 ? -1 : 1;
}

export function launchRivalFromFountain(
  r: RivalBird,
  nozzleX: number,
  tiltDeg: number,
  isCannon: boolean,
  props: readonly PropState[],
  particles: Particle[],
  floats: FloatingText[],
  fxRng: () => number,
  t: Tuning,
): number {
  const vel = computeParabolicLaunchVelocity(
    {
      birdX: r.x,
      nozzleX,
      tiltDeg,
      fallbackDir: pickPropFallbackDir(props, nozzleX),
    },
    t,
  );
  r.airborne = true;
  r.launchedByFountain = true;
  r.stunTimerSec = 0;
  r.redCrestState = 'idle';
  r.vx = vel.vx;
  r.vy = vel.vy;
  const feather = rivalFeatherSpec(r.archetype);
  spawnParticleBurst(particles, fxRng, r.x, t.scene.groundY - 24, 16, feather.kind, feather.color, 90, 260);
  if (isCannon) {
    pushFloatingText(floats, t, r.x, t.scene.groundY - 88, '斜喷炮弹！+80', '#38bdf8', 1.18);
  } else {
    pushFloatingText(
      floats,
      t,
      r.x,
      t.scene.groundY - 92,
      `太坏了！+${t.scoring.sabotageBonus}`,
      '#f59e0b',
      1.25,
    );
  }
  return 9.5;
}

export function stepRivalsMovement(
  rivals: RivalBird[],
  playerX: number,
  match: MatchState,
  dtSec: number,
  t: Tuning,
): boolean {
  let redCrestCharged = false;
  for (const r of rivals) {
    if (r.respawnTimerSec > 0) {
      r.respawnTimerSec = Math.max(0, r.respawnTimerSec - dtSec);
      if (r.respawnTimerSec === 0) {
        const fromLeft = playerX > 195;
        r.x = fromLeft ? t.scene.stageMinX : t.scene.stageMaxX;
        r.y = t.scene.groundY;
        r.vx = fromLeft ? 150 : -150;
        r.vy = 0;
        r.airborne = false;
        r.launchedByFountain = false;
        r.spinRad = 0;
        r.stunTimerSec = 0;
        r.redCrestState = 'idle';
        r.redCrestTimerSec = 0;
      }
      continue;
    }

    if (r.stunTimerSec > 0) {
      r.stunTimerSec = Math.max(0, r.stunTimerSec - dtSec);
    }

    if (!r.airborne) {
      const decision = decideAiMove(
        {
          archetype: r.archetype,
          birdIndex: r.id,
          aiX: r.x,
          playerX,
          nozzles: match.nozzles,
          stunTimerSec: r.stunTimerSec,
          surgeReactElapsedSec: r.surgeReactElapsedSec,
          redCrestState: r.redCrestState,
          redCrestTimerSec: r.redCrestTimerSec,
          redCrestCooldownSec: r.redCrestCooldownSec,
          redCrestDir: r.redCrestDir,
          elapsedSec: match.elapsedSec,
          dtSec,
        },
        t,
      );
      r.intent = decision.intent;
      r.surgeReactElapsedSec = decision.nextSurgeReactElapsedSec;
      r.redCrestState = decision.nextRedCrestState;
      r.redCrestTimerSec = decision.nextRedCrestTimerSec;
      r.redCrestCooldownSec = decision.nextRedCrestCooldownSec;
      r.redCrestDir = decision.nextRedCrestDir;
      if (decision.startedCharge) {
        redCrestCharged = true;
      }

      const baseMax =
        r.archetype === 'sparrow'
          ? t.pigeon.sparrowMaxSpeed
          : r.archetype === 'red_crest'
            ? t.pigeon.redCrestMaxSpeed
            : t.pigeon.aiMaxSpeed;

      if (r.stunTimerSec > 0) {
        r.vx -= r.vx * Math.min(1, 3.6 * dtSec);
      } else if (decision.moveDir !== 0) {
        r.facing = decision.moveDir;
        if (r.redCrestState === 'lunging') {
          r.vx = decision.moveDir * t.pigeon.redCrestLungeSpeed;
        } else {
          r.vx += decision.moveDir * t.pigeon.aiMoveAccel * dtSec;
          r.vx = clamp(r.vx, -baseMax * decision.speedMultiplier, baseMax * decision.speedMultiplier);
        }
        r.waddlePhase += dtSec * (r.archetype === 'sparrow' ? 18 : 12);
      } else {
        r.vx -= r.vx * Math.min(1, t.pigeon.groundDrag * dtSec);
      }
    } else {
      r.vy += t.pigeon.gravity * dtSec;
      r.spinRad -= 15 * dtSec;
    }
  }
  return redCrestCharged;
}

export function resolveRivalInteractions(
  player: PigeonBody,
  rivals: RivalBird[],
  props: PropState[],
  pickups: BonusPickup[],
  stage: StageConfig,
  match: MatchState,
  particles: Particle[],
  floats: FloatingText[],
  fxRng: () => number,
  nextPickupIdRef: { value: number },
  dtSec: number,
  t: Tuning,
): RivalStepResult {
  let nextMatch = match;
  let angledCannonLaunch = false;
  let propSmashed = false;
  let shakeMagDelta = 0;
  let hitStopSec = 0;

  for (const r of rivals) {
    if (r.airborne || r.respawnTimerSec > 0 || r.stunTimerSec <= 0) continue;
    for (const nozzle of nextMatch.nozzles) {
      if (
        nozzle.phase === 'ACTIVE' &&
        nozzle.style === 'angled' &&
        Math.abs(r.x - nozzle.x) <= t.fountain.coreRadiusPx
      ) {
        angledCannonLaunch = true;
        shakeMagDelta = Math.max(
          shakeMagDelta,
          launchRivalFromFountain(r, nozzle.x, nozzle.tiltDeg, true, props, particles, floats, fxRng, t),
        );
        nextMatch = {
          ...nextMatch,
          score: nextMatch.score + 80,
          sabotageCount: nextMatch.sabotageCount + 1,
        };
        break;
      }
    }
  }

  if (!player.airborne) {
    for (const r of rivals) {
      if (r.airborne || r.respawnTimerSec > 0) continue;
      if (
        r.archetype === 'red_crest' &&
        r.redCrestState === 'lunging' &&
        Math.abs(r.x - player.x) <= t.pigeon.radius + r.radius - 2
      ) {
        player.vx = r.redCrestDir * 310;
        player.squashX = 0.78;
        player.squashY = 1.24;
        r.redCrestState = 'idle';
        r.redCrestTimerSec = 0;
        shakeMagDelta = Math.max(shakeMagDelta, 5.5);
        pushFloatingText(floats, t, player.x, t.scene.groundY - 62, '被顶开啦！', '#fb7185', 1);
      }

      const minSep = (t.pigeon.radius + r.radius) * 0.82;
      const dx = r.x - player.x;
      const absDx = Math.abs(dx);
      if (absDx < minSep) {
        const dir = dx >= 0 ? 1 : -1;
        const overlap = (minSep - absDx) * 0.5;
        player.x -= dir * overlap;
        r.x += dir * overlap;
        player.vx -= dir * t.pigeon.softBounceSpeed * dtSec * 4;
        r.vx += dir * t.pigeon.softBounceSpeed * dtSec * 4;
      }
    }
  }

  for (const r of rivals) {
    if (!r.airborne || !r.launchedByFountain || r.respawnTimerSec > 0) continue;
    for (let pi = 0; pi < props.length; pi++) {
      const prop = props[pi];
      if (!prop.intact) continue;
      if (checkPropHit(r.x, r.y, r.radius, prop)) {
        propSmashed = true;
        props[pi] = {
          ...prop,
          intact: false,
          respawnTimerSec: stage.propRespawnSec ?? 0,
        };
        hitStopSec = t.props.hitStopSec;
        shakeMagDelta = Math.max(shakeMagDelta, 12);
        nextMatch = {
          ...nextMatch,
          score: nextMatch.score + prop.bonus,
          propSmashCount: nextMatch.propSmashCount + 1,
        };
        spawnPropDebrisParticles(particles, fxRng, prop);
        pushFloatingText(floats, t, prop.x, prop.y - 26, `连锁爆破 +${prop.bonus}！`, '#facc15', 1.28);

        if (prop.kind === 'melon_stall') {
          for (let s = 0; s < t.props.melonSparkCount; s++) {
            const targetX = clamp(
              prop.side === 'left' ? 90 + s * 36 : 300 - s * 36,
              t.scene.stageMinX + 8,
              t.scene.stageMaxX - 8,
            );
            pickups.push({
              id: nextPickupIdRef.value++,
              kind: 'melon_spark',
              x: prop.x,
              y: prop.y - 12,
              vx: (targetX - prop.x) * 1.9,
              vy: -280 - s * 35,
              value: t.props.melonSparkValue,
              ttlSec: 9.0,
            });
          }
        }

        r.vx = -r.vx * 0.35;
        r.vy = Math.min(r.vy, -110);
        break;
      }
    }
  }

  return {
    redCrestCharged: false,
    angledCannonLaunch,
    propSmashed,
    shakeMagDelta,
    hitStopSec,
    match: nextMatch,
  };
}

export function performPlayerBump(
  player: PigeonBody & { bumpCooldownSec: number; bumpAnimSec: number },
  rivals: RivalBird[],
  particles: Particle[],
  floats: FloatingText[],
  fxRng: () => number,
  t: Tuning,
): { bumpedHit: boolean; bumpedWhiff: boolean; shakeMagDelta: number } {
  player.bumpCooldownSec = t.pigeon.bumpCooldownSec;
  player.bumpAnimSec = 0.22;

  const targets = rivals.filter(
    (r) =>
      !r.airborne &&
      r.respawnTimerSec <= 0 &&
      Math.abs(r.x - player.x) <= t.pigeon.bumpReachPx,
  );

  let dashDir: -1 | 1 = player.facing;
  if (targets.length > 0) {
    let nearest = targets[0];
    let bestD = Math.abs(nearest.x - player.x);
    for (const r of targets) {
      const d = Math.abs(r.x - player.x);
      if (d < bestD) {
        bestD = d;
        nearest = r;
      }
    }
    dashDir = nearest.x >= player.x ? 1 : -1;
  }

  player.facing = dashDir;
  player.vx = dashDir * t.pigeon.bumpSelfDashSpeed;
  player.squashX = 1.3;
  player.squashY = 0.8;

  if (targets.length > 0) {
    for (const r of targets) {
      const knockMult = r.archetype === 'sparrow' ? t.pigeon.sparrowKnockbackMult : 1;
      const hitDir = r.x >= player.x - 10 ? dashDir : (-dashDir as -1 | 1);
      r.vx = hitDir * t.pigeon.bumpKnockbackSpeed * knockMult;
      r.stunTimerSec = t.pigeon.bumpStunSec;
      r.redCrestState = 'idle';
      r.redCrestTimerSec = 0;
      r.squashX = 0.76;
      r.squashY = 1.26;
      const feather = rivalFeatherSpec(r.archetype);
      spawnParticleBurst(particles, fxRng, r.x, t.scene.groundY - 24, 4, feather.kind, feather.color, 55, 140);
    }
    spawnParticleBurst(particles, fxRng, player.x + dashDir * 24, t.scene.groundY - 22, 9, 'spark', '#fde047', 80, 215);
    if (targets.length >= 2) {
      pushFloatingText(floats, t, player.x, t.scene.groundY - 68, '一锅端！', '#fde047', 1.12);
    }
    return { bumpedHit: true, bumpedWhiff: false, shakeMagDelta: 5 };
  }
  return { bumpedHit: false, bumpedWhiff: true, shakeMagDelta: 0 };
}
