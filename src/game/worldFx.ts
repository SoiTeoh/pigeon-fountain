import type { AiArchetype, PropKind, Tuning } from '../config/tuning';
import type { PlugState } from './plug';
import { clamp, type MatchState, type Occupant, type PropState } from './rules';
import type {
  FloatingText,
  Particle,
  PigeonBody,
  PlayerExpression,
  RivalBird,
  ShockwaveRing,
} from './worldTypes';

export function spawnParticleBurst(
  particles: Particle[],
  fxRng: () => number,
  x: number,
  y: number,
  count: number,
  kind: Particle['kind'],
  color: string,
  speedMin: number,
  speedMax: number,
): void {
  for (let i = 0; i < count; i++) {
    const ang = -Math.PI + fxRng() * Math.PI;
    const spd = speedMin + fxRng() * (speedMax - speedMin);
    particles.push({
      x: x + (fxRng() - 0.5) * 18,
      y: y + (fxRng() - 0.5) * 10,
      vx: Math.cos(ang) * spd,
      vy: Math.sin(ang) * spd - 50,
      r: kind.startsWith('feather') ? 5 + fxRng() * 4 : 3 + fxRng() * 3.5,
      color,
      kind,
      rot: fxRng() * Math.PI * 2,
      vrot: (fxRng() - 0.5) * 12,
      life: 0.65 + fxRng() * 0.5,
      maxLife: 1.15,
    });
  }
}

export function spawnPropDebrisParticles(
  particles: Particle[],
  fxRng: () => number,
  prop: PropState,
): void {
  const kindMap: Record<PropKind, { pKind: Particle['kind']; colors: string[] }> = {
    cup_tower: { pKind: 'cup', colors: ['#ffffff', '#38bdf8', '#94a3b8'] },
    melon_stall: { pKind: 'seed', colors: ['#fde047', '#ca8a04', '#78350f'] },
    balloon_cart: { pKind: 'balloon', colors: ['#f43f5e', '#facc15', '#38bdf8', '#a855f7'] },
    coffee_rack: { pKind: 'coffee', colors: ['#78350f', '#f5e6d3', '#fb923c'] },
  };
  const spec = kindMap[prop.kind];
  for (const color of spec.colors) {
    spawnParticleBurst(particles, fxRng, prop.x, prop.y, 7, spec.pKind, color, 85, 250);
  }
  spawnParticleBurst(particles, fxRng, prop.x, prop.y, 12, 'spark', '#fde047', 100, 260);
}

export function pushFloatingText(
  floats: FloatingText[],
  t: Tuning,
  x: number,
  y: number,
  text: string,
  color: string,
  scale = 1,
): void {
  floats.push({
    x: clamp(x, 66, t.view.width - 66),
    y: clamp(y, 88, t.scene.groundY - 20),
    text,
    color,
    scale,
    life: 1.15,
    maxLife: 1.15,
  });
}

export function rivalFeatherSpec(archetype: AiArchetype): {
  kind: Particle['kind'];
  color: string;
} {
  if (archetype === 'sparrow') return { kind: 'feather_sparrow', color: '#a16207' };
  if (archetype === 'red_crest') return { kind: 'feather_red', color: '#ef4444' };
  return { kind: 'feather_white', color: '#ffffff' };
}

export function stepWorldVisualFx(
  particles: Particle[],
  floats: FloatingText[],
  shockwaves: ShockwaveRing[],
  dtSec: number,
): void {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.life -= dtSec;
    const grav = p.kind.startsWith('feather')
      ? 110
      : p.kind === 'heart'
        ? -40
        : p.kind === 'balloon'
          ? 140
          : 430;
    p.vy += grav * dtSec;
    if (p.kind.startsWith('feather')) {
      p.vx += Math.sin(p.life * 9) * 38 * dtSec;
    }
    p.x += p.vx * dtSec;
    p.y += p.vy * dtSec;
    p.rot += p.vrot * dtSec;
    if (p.life <= 0) particles.splice(i, 1);
  }

  for (let i = floats.length - 1; i >= 0; i--) {
    const f = floats[i];
    f.life -= dtSec;
    f.y -= 36 * dtSec;
    if (f.life <= 0) floats.splice(i, 1);
  }

  for (let i = shockwaves.length - 1; i >= 0; i--) {
    const sw = shockwaves[i];
    sw.life -= dtSec;
    const tNorm = 1 - clamp(sw.life / sw.maxLife, 0, 1);
    sw.r = sw.maxR * tNorm;
    if (sw.life <= 0) shockwaves.splice(i, 1);
  }
}

export function stepBirdSquashAndExpression(
  player: PigeonBody & { bumpAnimSec: number; smugTimerSec: number; isJumping: boolean; expression: PlayerExpression },
  rivals: RivalBird[],
  match: MatchState,
  plug: PlugState,
  occupant: Occupant,
  occupiedSlotIndex: number | null,
  dtSec: number,
  t: Tuning,
): void {
  if (!player.airborne) {
    const targetY =
      occupant === 'player'
        ? t.scene.groundY - t.pigeon.waterLiftPx + Math.sin(match.elapsedSec * 14) * 3.5
        : t.scene.groundY;
    player.y += (targetY - player.y) * Math.min(1, 16 * dtSec);
  }

  for (const r of rivals) {
    if (!r.airborne && r.respawnTimerSec <= 0) {
      const onActiveNozzle = match.nozzles.some(
        (n) => n.phase === 'ACTIVE' && Math.abs(r.x - n.x) <= t.fountain.coreRadiusPx,
      );
      const targetAiY = onActiveNozzle
        ? t.scene.groundY -
          t.pigeon.waterLiftPx * (r.archetype === 'sparrow' ? 1.1 : 0.95) +
          Math.sin(match.elapsedSec * 13 + r.id) * 3.5
        : t.scene.groundY;
      r.y += (targetAiY - r.y) * Math.min(1, 16 * dtSec);
    }
    r.squashX += (1 - r.squashX) * Math.min(1, 12 * dtSec);
    r.squashY += (1 - r.squashY) * Math.min(1, 12 * dtSec);
  }

  player.squashX += (1 - player.squashX) * Math.min(1, 12 * dtSec);
  player.squashY += (1 - player.squashY) * Math.min(1, 12 * dtSec);

  const dangerNear = match.nozzles.some(
    (n) =>
      n.phase === 'SURGE_WARN' &&
      Math.abs(player.x - n.x) <= t.fountain.coreRadiusPx + 14,
  );
  if (player.airborne) {
    player.expression = player.isJumping ? 'jump' : 'launched';
  } else if (player.smugTimerSec > 0) {
    player.expression = 'bliss';
  } else if (player.bumpAnimSec > 0) {
    player.expression = 'bump';
  } else if (dangerNear || plug.activeSlotIndex !== null) {
    player.expression = 'panic';
  } else if (occupant === 'player' && occupiedSlotIndex !== null) {
    const nozzle = match.nozzles[occupiedSlotIndex];
    const edgeDist = nozzle ? Math.abs(player.x - nozzle.x) : 0;
    player.expression = edgeDist > t.fountain.coreRadiusPx * 0.65 ? 'panic' : 'bliss';
  } else {
    player.expression = 'smug';
  }
}
