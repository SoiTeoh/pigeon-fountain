import type { StageConfig, Tuning } from '../config/tuning';
import type { PlugState } from './plug';
import { clamp, type MatchState, type Occupant } from './rules';
import { pushFloatingText, spawnParticleBurst } from './worldFx';
import type { BonusPickup, FloatingText, Particle, PigeonBody, RivalBird } from './worldTypes';

export interface CornStepResult {
  cornPickedUp: boolean;
  cornSpawnTimerSec: number;
  auntieNoticeDeltaSec: number;
  scoreBonus: number;
}

export function stepCornAndPickups(
  pickups: BonusPickup[],
  player: PigeonBody,
  rivals: readonly RivalBird[],
  stage: StageConfig,
  match: MatchState,
  particles: Particle[],
  floats: FloatingText[],
  simRng: () => number,
  fxRng: () => number,
  nextPickupIdRef: { value: number },
  cornSpawnTimerSec: number,
  dtSec: number,
  t: Tuning,
): CornStepResult {
  let nextCornTimer = cornSpawnTimerSec;
  let auntieNoticeDeltaSec = 0;

  if (stage.cornEnabled) {
    nextCornTimer -= dtSec;
    if (nextCornTimer <= 0) {
      nextCornTimer = t.corn.spawnIntervalSec;
      const nozzle = match.nozzles[Math.floor(simRng() * match.nozzles.length)];
      const offset = (simRng() < 0.5 ? -1 : 1) * (16 + simRng() * 20);
      const targetX = clamp(nozzle.x + offset, t.scene.stageMinX + 10, t.scene.stageMaxX - 10);
      pickups.push({
        id: nextPickupIdRef.value++,
        kind: 'corn',
        x: targetX < 195 ? 20 : t.view.width - 20,
        y: 260,
        vx: (targetX - (targetX < 195 ? 20 : t.view.width - 20)) * 1.4,
        vy: -160,
        value: t.corn.scoreValue,
        ttlSec: t.corn.ttlSec,
      });
      auntieNoticeDeltaSec = 2.2;
    }
  }

  let cornPickedUp = false;
  let scoreBonus = 0;
  for (let i = pickups.length - 1; i >= 0; i--) {
    const pk = pickups[i];
    pk.ttlSec -= dtSec;
    if (pk.ttlSec <= 0) {
      pickups.splice(i, 1);
      continue;
    }
    if (pk.y < t.scene.groundY - 8 || pk.vy < 0) {
      pk.vy += 860 * dtSec;
      pk.x += pk.vx * dtSec;
      pk.y += pk.vy * dtSec;
      if (pk.y >= t.scene.groundY - 8) {
        pk.y = t.scene.groundY - 8;
        pk.vy = 0;
        pk.vx = 0;
        pk.x = clamp(pk.x, t.scene.stageMinX, t.scene.stageMaxX);
      } else {
        pk.x = clamp(pk.x, 12, t.view.width - 12);
      }
    }

    if (
      Math.abs(player.x - pk.x) <= t.corn.pickupRadius &&
      Math.abs(player.y - 16 - pk.y) <= 30
    ) {
      cornPickedUp = true;
      scoreBonus += pk.value;
      spawnParticleBurst(particles, fxRng, pk.x, pk.y, 7, 'spark', '#fde047', 50, 140);
      pushFloatingText(
        floats,
        t,
        pk.x,
        pk.y - 34,
        pk.kind === 'corn' ? `闪亮玉米！+${pk.value}` : `瓜子火花！+${pk.value}`,
        '#fde047',
        1.12,
      );
      pickups.splice(i, 1);
      continue;
    }

    if (pk.kind === 'corn' && pk.vy === 0) {
      const thief = rivals.find(
        (r) =>
          !r.airborne &&
          r.respawnTimerSec <= 0 &&
          r.stunTimerSec <= 0 &&
          Math.abs(r.x - pk.x) <= 18,
      );
      if (thief) {
        pushFloatingText(floats, t, pk.x, pk.y - 30, '玉米被抢吃！', '#cbd5e1', 0.92);
        pickups.splice(i, 1);
      }
    }
  }

  return {
    cornPickedUp,
    cornSpawnTimerSec: nextCornTimer,
    auntieNoticeDeltaSec,
    scoreBonus,
  };
}

export function spawnAmbientFountainParticles(
  particles: Particle[],
  match: MatchState,
  plug: PlugState,
  player: PigeonBody,
  occupant: Occupant,
  fxRng: () => number,
  bubbleSpawnAcc: number,
  soakFxAcc: number,
  dtSec: number,
  t: Tuning,
): { bubbleSpawnAcc: number; soakFxAcc: number } {
  let nextBubbleAcc = bubbleSpawnAcc + dtSec;
  if (nextBubbleAcc >= 0.06) {
    nextBubbleAcc = 0;
    const plugRatio = plug.activeSlotIndex !== null ? clamp(plug.holdSec / t.plug.maxDurationSec, 0, 1) : 0;
    for (const n of match.nozzles) {
      const isAdjacentToPlug =
        plug.activeSlotIndex !== null && Math.abs(n.slotIndex - plug.activeSlotIndex) === 1;
      if (n.phase === 'WARNING' || n.phase === 'PLUGGED' || isAdjacentToPlug) {
        const boost = n.phase === 'PLUGGED' || isAdjacentToPlug ? 1 + plugRatio * 1.4 : 1;
        particles.push({
          x: n.x + (fxRng() - 0.5) * 28,
          y: t.scene.groundY - 4,
          vx: (fxRng() - 0.5) * 28 * boost,
          vy: (-55 - fxRng() * 45) * boost,
          r: 2.5 + fxRng() * 2.5,
          color: n.phase === 'PLUGGED' ? '#fde047' : '#e0f2fe',
          kind: 'water',
          rot: 0,
          vrot: 0,
          life: 0.45,
          maxLife: 0.45,
        });
      } else if (n.phase === 'ACTIVE') {
        const rad = (n.tiltDeg * Math.PI) / 180;
        particles.push({
          x: n.x + (fxRng() - 0.5) * 26,
          y: t.scene.groundY - 42 - fxRng() * 25,
          vx: Math.sin(rad) * 180 + n.lateralDir * 30 + (fxRng() - 0.5) * 55,
          vy: -Math.cos(rad) * 125 - fxRng() * 60,
          r: 2 + fxRng() * 2.5,
          color: '#bae6fd',
          kind: 'water',
          rot: 0,
          vrot: 0,
          life: 0.45,
          maxLife: 0.45,
        });
      }
    }
  }

  let nextSoakAcc = soakFxAcc + dtSec;
  if (occupant === 'player' && nextSoakAcc >= 0.38) {
    nextSoakAcc = 0;
    particles.push({
      x: player.x + (fxRng() - 0.5) * 20,
      y: player.y - 42,
      vx: (fxRng() - 0.5) * 20,
      vy: -45,
      r: 6,
      color: '#fb7185',
      kind: 'heart',
      rot: 0,
      vrot: 0,
      life: 0.75,
      maxLife: 0.75,
    });
  }

  return { bubbleSpawnAcc: nextBubbleAcc, soakFxAcc: nextSoakAcc };
}
