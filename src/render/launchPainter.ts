import { LAUNCH_STAGES } from '../config/launchStages';
import {
  CHARACTERS,
  launchTuning,
  type LaunchTuning,
  type PigeonCharacterId,
} from '../config/launchTuning';
import type { LaunchScreenMode } from '../game/launchRules';
import type { LaunchPrototypeWorld } from '../game/launchWorld';
import type { LaunchChapterStageId, LaunchProgress } from '../platform/storage';

export interface LaunchRenderExtra {
  readonly screenMode: LaunchScreenMode;
  readonly selectedStageId: LaunchChapterStageId;
  readonly progress: LaunchProgress;
  readonly polaroidCanvas: HTMLCanvasElement | null;
  readonly muted: boolean;
  readonly debug: boolean;
  readonly animTimeSec: number;
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

function drawMiniPigeonBadge(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  active: boolean,
): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = active ? '#334155' : 'rgba(255,255,255,0.18)';
  ctx.strokeStyle = active ? '#e2e8f0' : 'rgba(255,255,255,0.22)';
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.ellipse(0, 2, 7.5, 5.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(4.5, -3.5, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  if (active) {
    ctx.fillStyle = '#f59e0b';
    ctx.beginPath();
    ctx.moveTo(8, -4.5);
    ctx.lineTo(11.5, -3);
    ctx.lineTo(8, -1.5);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

function drawBackground(
  ctx: CanvasRenderingContext2D,
  world: LaunchPrototypeWorld,
  t: LaunchTuning,
  animTimeSec: number,
): void {
  const { width, height } = t.view;
  const { groundY } = t.physics;

  const sky = ctx.createLinearGradient(0, 0, 0, groundY);
  sky.addColorStop(0, world.stage.id === 6 ? '#fde68a' : '#bae6fd');
  sky.addColorStop(1, '#f0f9ff');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, width, groundY);

  // Clouds
  ctx.fillStyle = 'rgba(255,255,255,0.78)';
  const shift = (animTimeSec * 6) % (width + 120);
  for (const [cx, cy, r] of [
    [80, 108, 22],
    [260, 88, 26],
  ]) {
    const x = ((cx + shift) % (width + 120)) - 60;
    ctx.beginPath();
    ctx.arc(x, cy, r, 0, Math.PI * 2);
    ctx.arc(x + 20, cy + 4, r * 0.78, 0, Math.PI * 2);
    ctx.arc(x - 18, cy + 5, r * 0.72, 0, Math.PI * 2);
    ctx.fill();
  }

  // Park trees & balustrade
  ctx.fillStyle = '#86efac';
  for (const [tx, tr] of [
    [52, 38],
    [142, 46],
    [255, 42],
    [348, 36],
  ]) {
    ctx.beginPath();
    ctx.arc(tx, groundY - 40, tr, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = '#cbd5e1';
  ctx.fillRect(0, groundY - 18, width, 18);
  ctx.fillStyle = '#94a3b8';
  ctx.fillRect(0, groundY - 20, width, 3);

  // Stone plaza ground
  const floorGrad = ctx.createLinearGradient(0, groundY, 0, height);
  floorGrad.addColorStop(0, '#94a3b8');
  floorGrad.addColorStop(0.28, '#64748b');
  floorGrad.addColorStop(1, '#334155');
  ctx.fillStyle = floorGrad;
  ctx.fillRect(0, groundY, width, height - groundY);

  ctx.strokeStyle = 'rgba(255,255,255,0.12)';
  ctx.lineWidth = 1.5;
  for (let x = 22; x < width; x += 62) {
    ctx.beginPath();
    ctx.moveTo(x, groundY);
    ctx.lineTo(x - 16, height);
    ctx.stroke();
  }

  // Main iron grate
  const fx = world.stage.fountainX;
  ctx.fillStyle = '#334155';
  roundRect(ctx, fx - 28, groundY - 2, 56, 12, 4);
  ctx.fill();
  ctx.strokeStyle = '#94a3b8';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.fillStyle = '#0f172a';
  for (let sx = fx - 20; sx <= fx + 16; sx += 9) {
    ctx.fillRect(sx, groundY + 1, 4, 7);
  }

  // Relay fountains
  for (const r of world.stage.relays) {
    ctx.fillStyle = '#0284c7';
    roundRect(ctx, r.x - 28, groundY - 3, 56, 12, 4);
    ctx.fill();
    ctx.strokeStyle = '#bae6fd';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = '#e0f2fe';
    ctx.font = '800 9.5px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('二段喷泉', r.x, groundY + 21);
  }
}

function drawStageStructures(
  ctx: CanvasRenderingContext2D,
  world: LaunchPrototypeWorld,
  animTimeSec: number,
): void {
  const { stage } = world;

  // Platforms (concrete / elevated wood bridge)
  for (const p of stage.platforms) {
    if (p.kind === 'wood') {
      ctx.fillStyle = '#92400e';
      roundRect(ctx, p.x - p.w / 2, p.y - p.h / 2, p.w, p.h, 5);
      ctx.fill();
      ctx.fillStyle = '#d97706';
      ctx.fillRect(p.x - p.w / 2, p.y - p.h / 2, p.w, 6);
      if (stage.id === 6 && p.h > 40) {
        // Milk-tea stall counter banner!
        ctx.fillStyle = '#fef3c7';
        roundRect(ctx, p.x - 42, p.y - 16, 84, 28, 6);
        ctx.fill();
        ctx.fillStyle = '#9a3412';
        ctx.font = '900 12px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('🧋 网红奶茶', p.x, p.y - 2);
      }
    } else {
      ctx.fillStyle = '#78716c';
      roundRect(ctx, p.x - p.w / 2, p.y - p.h / 2, p.w, p.h, 4);
      ctx.fill();
      ctx.fillStyle = '#a8a29e';
      ctx.fillRect(p.x - p.w / 2, p.y - p.h / 2, p.w, 8);
    }
  }

  // Walls / eaves / awning posts
  for (const w of stage.walls) {
    if (w.kind === 'eave') {
      ctx.fillStyle = '#dc2626';
      roundRect(ctx, w.x - w.w / 2, w.y - w.h / 2, w.w, w.h, 4);
      ctx.fill();
      ctx.fillStyle = '#fef2f2';
      ctx.fillRect(w.x - w.w / 2 + 4, w.y - w.h / 2 + 2, w.w - 8, 3);
    } else if (w.kind === 'post') {
      ctx.fillStyle = '#475569';
      roundRect(ctx, w.x - w.w / 2, w.y - w.h / 2, w.w, w.h, 4);
      ctx.fill();
    } else {
      ctx.fillStyle = '#9a3412';
      roundRect(ctx, w.x - w.w / 2, w.y - w.h / 2, w.w, w.h, 4);
      ctx.fill();
      ctx.strokeStyle = '#fed7aa';
      ctx.lineWidth = 1.2;
      for (let by = w.y - w.h / 2 + 16; by < w.y + w.h / 2 - 8; by += 18) {
        ctx.beginPath();
        ctx.moveTo(w.x - w.w / 2 + 2, by);
        ctx.lineTo(w.x + w.w / 2 - 2, by);
        ctx.stroke();
      }
      ctx.fillStyle = '#cbd5e1';
      roundRect(ctx, w.x - w.w / 2 - 2, w.y - w.h / 2 - 3, w.w + 4, 7, 3);
      ctx.fill();
    }
  }

  // Fragile glass barriers (Stage 5)
  for (const g of world.glasses) {
    if (g.broken) continue;
    ctx.save();
    ctx.translate(g.body.position.x, g.body.position.y);
    ctx.fillStyle = 'rgba(125, 211, 252, 0.52)';
    ctx.strokeStyle = '#e0f2fe';
    ctx.lineWidth = 2;
    ctx.fillRect(-g.w / 2, -g.h / 2, g.w, g.h);
    ctx.strokeRect(-g.w / 2, -g.h / 2, g.w, g.h);
    ctx.beginPath();
    ctx.moveTo(-g.w / 2 + 2, -g.h / 2 + 10);
    ctx.lineTo(g.w / 2 - 2, -g.h / 2 + 26);
    ctx.moveTo(-g.w / 2 + 2, 0);
    ctx.lineTo(g.w / 2 - 2, 16);
    ctx.stroke();
    ctx.restore();
  }

  // Hinged elastic awning (Stage 4)
  if (stage.awning && world.awningBody) {
    const a = stage.awning;
    const ab = world.awningBody;
    ctx.save();
    ctx.translate(ab.position.x, ab.position.y);
    ctx.rotate(ab.angle);
    // Striped cafe awning
    ctx.fillStyle = world.awningFlattened ? '#10b981' : '#ef4444';
    roundRect(ctx, -a.w / 2, -a.h / 2, a.w, a.h, 5);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    for (let sx = -a.w / 2 + 12; sx < a.w / 2 - 12; sx += 24) {
      ctx.fillRect(sx, -a.h / 2 + 1, 10, a.h - 2);
    }
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 2;
    roundRect(ctx, -a.w / 2, -a.h / 2, a.w, a.h, 5);
    ctx.stroke();
    // Center hinge bolt
    ctx.fillStyle = '#fde047';
    ctx.beginPath();
    ctx.arc(0, 0, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    ctx.fillStyle = world.awningFlattened ? '#10b981' : '#ef4444';
    ctx.font = '800 10.5px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(world.awningFlattened ? '已压平!' : '弹性斜棚', a.x, a.y + 30);
  }

  // Fixed park bench
  if (stage.bench) {
    const b = stage.bench;
    const supportBottom =
      stage.platforms.length > 0
        ? stage.platforms[stage.platforms.length - 1].y -
          stage.platforms[stage.platforms.length - 1].h / 2
        : world.t.physics.groundY;
    ctx.fillStyle = '#334155';
    ctx.fillRect(b.x - b.w / 2 + 12, b.y + b.h / 2, 8, Math.max(4, supportBottom - (b.y + b.h / 2)));
    ctx.fillRect(b.x + b.w / 2 - 20, b.y + b.h / 2, 8, Math.max(4, supportBottom - (b.y + b.h / 2)));

    ctx.fillStyle = '#92400e';
    roundRect(ctx, b.x - b.w / 2 + 4, b.y - 22, b.w - 8, 9, 4);
    ctx.fill();

    ctx.fillStyle = '#d97706';
    roundRect(ctx, b.x - b.w / 2, b.y - b.h / 2, b.w, b.h, 5);
    ctx.fill();
    ctx.strokeStyle = '#78350f';
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  // Golden breathing target seat indicator + "坐这儿!" sign
  const seat = stage.seat;
  const pulse = 0.5 + 0.5 * Math.sin(animTimeSec * 4.5);
  ctx.save();
  ctx.strokeStyle = `rgba(250, 204, 21, ${0.45 + pulse * 0.45})`;
  ctx.fillStyle = `rgba(254, 240, 138, ${0.08 + pulse * 0.1})`;
  ctx.lineWidth = 2;
  ctx.setLineDash([6, 4]);
  roundRect(ctx, seat.x - seat.halfW + 6, seat.y - 24, (seat.halfW - 6) * 2, 46, 12);
  ctx.fill();
  ctx.stroke();
  ctx.setLineDash([]);

  const signY = seat.y - 38 + Math.sin(animTimeSec * 3.5) * 2;
  ctx.fillStyle = '#f59e0b';
  roundRect(ctx, seat.x - 28, signY - 10, 56, 20, 10);
  ctx.fill();
  ctx.fillStyle = '#0f172a';
  ctx.font = '900 11px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('坐这儿!', seat.x, signY + 0.5);
  ctx.restore();

  // Decorative cups
  for (const cup of world.cups) {
    ctx.save();
    ctx.translate(cup.body.position.x, cup.body.position.y);
    ctx.rotate(cup.body.angle);
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = cup.disturbed ? '#f43f5e' : '#38bdf8';
    ctx.lineWidth = 1.8;
    roundRect(ctx, -cup.w / 2, -cup.h / 2, cup.w, cup.h, 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = cup.disturbed ? '#fb7185' : '#0ea5e9';
    ctx.fillRect(-cup.w / 2 + 1, -2, cup.w - 2, 4);
    ctx.restore();
  }
}

function drawFountainJetsAndAim(
  ctx: CanvasRenderingContext2D,
  world: LaunchPrototypeWorld,
): void {
  const { groundY } = world.t.physics;

  if (world.mainSprayAnimSec > 0) {
    const ratio = world.mainSprayAnimSec / 0.5;
    const fx = world.stage.fountainX;
    ctx.save();
    ctx.globalAlpha = Math.min(1, ratio * 1.4);
    const grad = ctx.createLinearGradient(fx, groundY, fx + 35, groundY - 140);
    grad.addColorStop(0, 'rgba(56, 189, 248, 0.95)');
    grad.addColorStop(1, 'rgba(255, 255, 255, 0.25)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(fx - 14, groundY);
    ctx.lineTo(fx + 10, groundY - 130);
    ctx.lineTo(fx + 44, groundY - 122);
    ctx.lineTo(fx + 14, groundY);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  for (const r of world.stage.relays) {
    const timer = world.relaySprayTimers[r.id] ?? 0;
    if (timer <= 0) continue;
    ctx.save();
    ctx.globalAlpha = Math.min(1, (timer / 0.6) * 1.3);
    const grad = ctx.createLinearGradient(r.x, groundY, r.x + 55, groundY - 220);
    grad.addColorStop(0, 'rgba(14, 165, 233, 0.96)');
    grad.addColorStop(0.7, 'rgba(186, 230, 253, 0.85)');
    grad.addColorStop(1, 'rgba(255, 255, 255, 0.15)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(r.x - 14, groundY);
    ctx.lineTo(r.x + 28, groundY - 210);
    ctx.lineTo(r.x + 64, groundY - 200);
    ctx.lineTo(r.x + 14, groundY);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  if (world.phase === 'aiming' && world.isDragging) {
    const anchorX = world.stage.fountainX;
    const anchorY = world.stage.fountainY;

    ctx.save();
    ctx.strokeStyle = world.aimValid ? 'rgba(14, 165, 233, 0.7)' : 'rgba(148, 163, 184, 0.6)';
    ctx.lineWidth = 3;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(anchorX, anchorY);
    ctx.lineTo(world.dragPointer.x, world.dragPointer.y);
    ctx.stroke();
    ctx.setLineDash([]);

    const dots = world.previewDots;
    for (let i = 0; i < dots.length; i++) {
      const alpha = Math.max(0.18, 1 - i / dots.length);
      const r = Math.max(2.2, 4.2 - i * 0.18);
      ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
      ctx.strokeStyle = `rgba(14, 165, 233, ${alpha})`;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(dots[i].x, dots[i].y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
    ctx.restore();
  }
}

function drawPigeonSprite(
  ctx: CanvasRenderingContext2D,
  opts: {
    x: number;
    y: number;
    angle: number;
    kind: 'black_bad' | 'fat_chonk' | 'white' | 'red_crest';
    facing: -1 | 1;
    squashX: number;
    squashY: number;
    expression: 'smug' | 'squint_strain' | 'panic' | 'grumpy' | 'launched';
    alpha?: number;
  },
): void {
  const isFat = opts.kind === 'fat_chonk';
  const scale = isFat ? 1.24 : opts.kind === 'red_crest' ? 1.1 : 1.0;

  ctx.save();
  ctx.globalAlpha = opts.alpha ?? 1;
  ctx.translate(opts.x, opts.y);
  ctx.rotate(opts.angle);
  ctx.scale(opts.facing * opts.squashX * scale, opts.squashY * scale);

  // Tail
  ctx.fillStyle = isFat
    ? '#475569'
    : opts.kind === 'black_bad'
      ? '#1e293b'
      : '#cbd5e1';
  ctx.beginPath();
  ctx.ellipse(-18, 4, 9, 5.5, -0.3, 0, Math.PI * 2);
  ctx.fill();

  // Body
  ctx.fillStyle = isFat
    ? '#64748b'
    : opts.kind === 'black_bad'
      ? '#334155'
      : opts.kind === 'red_crest'
        ? '#e2e8f0'
        : '#ffffff';
  ctx.strokeStyle = isFat
    ? '#1e293b'
    : opts.kind === 'black_bad'
      ? '#0f172a'
      : opts.kind === 'red_crest'
        ? '#ef4444'
        : '#94a3b8';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(0, 3, isFat ? 22 : 20, isFat ? 17 : 15, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Fat chonk speckled belly patch!
  if (isFat) {
    ctx.fillStyle = '#cbd5e1';
    ctx.beginPath();
    ctx.ellipse(4, 7, 13, 10, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#94a3b8';
    ctx.beginPath();
    ctx.arc(0, 6, 2, 0, Math.PI * 2);
    ctx.arc(7, 8, 2.2, 0, Math.PI * 2);
    ctx.arc(4, 2, 1.8, 0, Math.PI * 2);
    ctx.fill();
  }

  // Wing
  ctx.fillStyle = isFat
    ? '#475569'
    : opts.kind === 'black_bad'
      ? '#475569'
      : '#e2e8f0';
  ctx.beginPath();
  ctx.ellipse(-3, 4, 11.5, 7, -0.12, 0, Math.PI * 2);
  ctx.fill();

  if (opts.kind === 'black_bad') {
    const neck = ctx.createLinearGradient(4, -14, 15, 0);
    neck.addColorStop(0, '#a855f7');
    neck.addColorStop(1, '#10b981');
    ctx.fillStyle = neck;
    ctx.beginPath();
    ctx.ellipse(8, -5, 7, 5.5, 0.2, 0, Math.PI * 2);
    ctx.fill();
  }

  // Head
  ctx.fillStyle = isFat
    ? '#64748b'
    : opts.kind === 'black_bad'
      ? '#334155'
      : '#ffffff';
  ctx.strokeStyle =
    opts.kind === 'red_crest'
      ? '#ef4444'
      : isFat || opts.kind === 'black_bad'
        ? '#0f172a'
        : '#94a3b8';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(10, -11, 10.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  if (opts.kind === 'red_crest') {
    ctx.fillStyle = '#ef4444';
    ctx.beginPath();
    ctx.moveTo(7, -21);
    ctx.lineTo(13, -32);
    ctx.lineTo(16, -22);
    ctx.lineTo(21, -28);
    ctx.lineTo(18, -19);
    ctx.closePath();
    ctx.fill();
  }

  // Beak
  ctx.fillStyle = '#f59e0b';
  ctx.beginPath();
  ctx.moveTo(19, -13);
  ctx.lineTo(27, -10);
  ctx.lineTo(19, -7);
  ctx.closePath();
  ctx.fill();

  // Expressions
  ctx.strokeStyle = opts.kind === 'black_bad' || isFat ? '#f8fafc' : '#0f172a';
  ctx.fillStyle = opts.kind === 'black_bad' || isFat ? '#f8fafc' : '#0f172a';
  ctx.lineWidth = 2;

  if (opts.expression === 'squint_strain') {
    ctx.beginPath();
    ctx.moveTo(8, -14);
    ctx.lineTo(13, -11);
    ctx.lineTo(8, -8);
    ctx.stroke();
  } else if (opts.expression === 'panic') {
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(11, -12, 3.8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.arc(12, -12, 1.7, 0, Math.PI * 2);
    ctx.fill();
  } else if (opts.expression === 'launched') {
    ctx.beginPath();
    ctx.moveTo(8, -14);
    ctx.lineTo(14, -8);
    ctx.moveTo(14, -14);
    ctx.lineTo(8, -8);
    ctx.stroke();
  } else if (opts.expression === 'grumpy') {
    ctx.fillStyle = opts.kind === 'red_crest' ? '#dc2626' : '#0f172a';
    ctx.beginPath();
    ctx.arc(11, -11, 2.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#0f172a';
    ctx.beginPath();
    ctx.moveTo(7, -16);
    ctx.lineTo(15, -13);
    ctx.stroke();
  } else {
    // Smug - _ - (or ￣ ^ ￣ for fat_chonk)
    ctx.beginPath();
    if (isFat) {
      ctx.moveTo(7, -12);
      ctx.lineTo(15, -13);
    } else {
      ctx.moveTo(7, -12);
      ctx.lineTo(15, -12);
    }
    ctx.stroke();
  }

  ctx.restore();
}

function drawBirdsAndEffects(
  ctx: CanvasRenderingContext2D,
  world: LaunchPrototypeWorld,
  animTimeSec: number,
): void {
  // Rivals
  for (const r of world.rivals) {
    drawPigeonSprite(ctx, {
      x: r.body.position.x,
      y: r.body.position.y,
      angle: r.body.angle,
      kind: r.archetype,
      facing: -1,
      squashX: 1,
      squashY: 1,
      expression: r.knocked ? 'launched' : 'grumpy',
    });
  }

  // Spent black/fat pigeons
  for (const s of world.spentBirds) {
    drawPigeonSprite(ctx, {
      x: s.body.position.x,
      y: s.body.position.y,
      angle: s.body.angle,
      kind: s.characterId,
      facing: 1,
      squashX: 1,
      squashY: 1,
      expression: 'smug',
      alpha: 0.72,
    });
  }

  // Active pigeon
  const b = world.activeBird;
  let drawX = b.position.x;
  let drawY = b.position.y;
  let sqX = 1;
  let sqY = 1;
  let expr: 'smug' | 'squint_strain' | 'panic' | 'launched' = 'smug';

  if (world.phase === 'aiming' && world.isDragging && world.aimValid) {
    const p = world.aimPowerRatio;
    drawX += Math.sin(animTimeSec * 48) * (1.2 + p * 2.4);
    drawY += p * 6;
    sqX = 1 + p * 0.22;
    sqY = 1 - p * 0.2;
    expr = 'squint_strain';
  } else if (world.diveSlamAnimSec > 0) {
    sqX = 1.26;
    sqY = 0.76;
    expr = 'panic';
  } else if (world.phase === 'flying') {
    expr = world.lastSpeedPxPerSec > 180 ? 'panic' : 'smug';
  } else if (world.phase === 'settling_win' || (world.phase === 'round_over' && world.won)) {
    expr = 'smug';
  }

  drawPigeonSprite(ctx, {
    x: drawX,
    y: drawY,
    angle: b.angle,
    kind: world.selectedCharacter,
    facing: 1,
    squashX: sqX,
    squashY: sqY,
    expression: expr,
  });

  // Green circular settle progress ring ONLY when truly inside target seat zone!
  if (world.phase === 'flying' && world.inTargetSeatZone && world.settleProgress > 0.01) {
    ctx.save();
    const rx = b.position.x;
    const ry = b.position.y - 40;
    ctx.strokeStyle = 'rgba(15, 23, 42, 0.35)';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(rx, ry, 12, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = '#22c55e';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(rx, ry, 12, -Math.PI / 2, -Math.PI / 2 + world.settleProgress * Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 9px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('稳', rx, ry + 0.5);
    ctx.restore();
  }

  // Victory speech bubble
  if (world.phase === 'settling_win' || (world.phase === 'round_over' && world.won)) {
    ctx.save();
    const bx = Math.min(310, Math.max(80, b.position.x));
    const by = b.position.y - 52;
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 2;
    roundRect(ctx, bx - 54, by - 14, 108, 26, 13);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#0f172a';
    ctx.font = '900 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('我就想坐这儿', bx, by - 1);
    ctx.restore();
  }

  for (const sw of world.shockwaves) {
    ctx.save();
    ctx.globalAlpha = Math.max(0, sw.life / sw.maxLife);
    ctx.strokeStyle = sw.color;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(sw.x, sw.y, sw.r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  for (const p of world.particles) {
    ctx.save();
    ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
    ctx.translate(p.x, p.y);
    ctx.rotate(p.rot);
    ctx.fillStyle = p.color;
    if (p.kind.startsWith('feather')) {
      ctx.beginPath();
      ctx.ellipse(0, 0, p.r * 1.4, p.r * 0.55, 0, 0, Math.PI * 2);
      ctx.fill();
    } else if (p.kind === 'glass') {
      ctx.fillRect(-p.r, -p.r * 0.5, p.r * 2, p.r);
    } else {
      ctx.beginPath();
      ctx.arc(0, 0, p.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  for (const f of world.floats) {
    ctx.save();
    ctx.globalAlpha = Math.max(0, f.life / f.maxLife);
    ctx.font = `900 ${Math.round(16 * f.scale)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 3.5;
    ctx.strokeText(f.text, f.x, f.y);
    ctx.fillStyle = f.color;
    ctx.fillText(f.text, f.x, f.y);
    ctx.restore();
  }

  // Camera shutter flash on Polaroid capture
  if (world.flashAlpha > 0.01) {
    ctx.fillStyle = `rgba(255, 255, 255, ${world.flashAlpha})`;
    ctx.fillRect(0, 0, world.t.view.width, world.t.view.height);
  }
}

function drawHud(
  ctx: CanvasRenderingContext2D,
  world: LaunchPrototypeWorld,
  extra: LaunchRenderExtra,
  t: LaunchTuning,
): void {
  const { width } = t.view;
  const hud = t.ui.hud;

  ctx.fillStyle = 'rgba(15, 23, 42, 0.84)';
  roundRect(ctx, hud.bar.x, hud.bar.y, hud.bar.w, hud.bar.h, hud.bar.r);
  ctx.fill();

  ctx.fillStyle = '#f8fafc';
  ctx.font = '800 12.5px sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(`第 ${world.stage.id} 关`, 24, 28);

  ctx.fillStyle = '#94a3b8';
  ctx.font = '600 9.5px sans-serif';
  ctx.fillText('Launch Prototype · 阶段 1', 24, 44);

  const total = t.match.totalPigeons;
  const avail = world.pigeonsRemaining;
  for (let i = 0; i < total; i++) {
    drawMiniPigeonBadge(ctx, 168 + i * 24, 35, i < avail);
  }

  ctx.fillStyle = 'rgba(255,255,255,0.16)';
  roundRect(ctx, hud.retryBtn.x, hud.retryBtn.y, hud.retryBtn.w, hud.retryBtn.h, hud.retryBtn.r);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.font = '800 11.5px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('↺ 重试(R)', hud.retryBtn.x + hud.retryBtn.w / 2, hud.retryBtn.y + hud.retryBtn.h / 2 + 0.5);

  ctx.fillStyle = 'rgba(255,255,255,0.16)';
  ctx.beginPath();
  ctx.arc(hud.muteBtn.x, hud.muteBtn.y, hud.muteBtn.r, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.font = '13px sans-serif';
  ctx.fillText(extra.muted ? '🔇' : '🔊', hud.muteBtn.x, hud.muteBtn.y + 1);

  ctx.fillStyle = 'rgba(255,255,255,0.16)';
  ctx.beginPath();
  ctx.arc(hud.homeBtn.x, hud.homeBtn.y, hud.homeBtn.r, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.font = '13px sans-serif';
  ctx.fillText('🏠', hud.homeBtn.x, hud.homeBtn.y + 1);

  if (extra.screenMode !== 'playing') return;

  // Sub-goal pill below HUD
  ctx.fillStyle = world.subGoalCompleted ? 'rgba(16, 185, 129, 0.88)' : 'rgba(15, 23, 42, 0.72)';
  roundRect(ctx, 14, 64, 224, 22, 11);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.font = '700 10.5px sans-serif';
  ctx.textAlign = 'left';
  const subPrefix =
    world.stage.subGoalKind === 'preserve_cups'
      ? world.subGoalCompleted
        ? '★2 保持无损：'
        : '★2 已倒杯：'
      : world.subGoalCompleted
        ? '★2 已达成：'
        : '★2 目标：';
  ctx.fillText(`${subPrefix}${world.stage.subGoalText}`, 24, 75, 204);

  // Context hint above bottom bar
  let hint = '向后下方拖拉黑鸽/胖鸽蓄压瞄准，松手喷射！';
  if (world.phase === 'flying') {
    if (world.inTargetSeatZone) {
      hint = '稳住别滑出长椅…';
    } else if (!world.diveSlamUsed && !world.isSupported) {
      hint = `空中点击 / Space：${CHARACTERS[world.selectedCharacter].skillName}！`;
    } else if (world.canAdvanceNextBird()) {
      hint = '未落座，点击右下或按 Space 换下一只！';
    } else {
      hint = '观察落点调整拉弓力度…';
    }
  } else if (world.phase === 'settling_win') {
    hint = '坐稳啦！咔嚓定格中…';
  }

  ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
  ctx.font = '700 11.5px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(hint, width / 2, 612, width - 28);

  // Bottom-left Character Switcher cards (黑小坏 vs 胖大肥)
  const canSwitch = world.phase === 'aiming' && !world.isDragging;
  const charButtons: readonly [
    PigeonCharacterId,
    { readonly x: number; readonly y: number; readonly w: number; readonly h: number; readonly r: number },
  ][] = [
    ['black_bad', hud.charBlackBtn],
    ['fat_chonk', hud.charFatBtn],
  ];
  for (const [cid, rect] of charButtons) {
    const spec = CHARACTERS[cid];
    const selected = world.selectedCharacter === cid;
    ctx.save();
    ctx.globalAlpha = canSwitch || selected ? 1 : 0.48;
    ctx.fillStyle = selected ? '#0ea5e9' : 'rgba(15, 23, 42, 0.65)';
    roundRect(ctx, rect.x, rect.y, rect.w, rect.h, rect.r);
    ctx.fill();
    ctx.strokeStyle = selected ? '#fef08a' : 'rgba(255,255,255,0.3)';
    ctx.lineWidth = selected ? 2.2 : 1.2;
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.font = '900 12.5px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(spec.name, rect.x + rect.w / 2, rect.y + 15);
    ctx.fillStyle = selected ? '#fef08a' : '#cbd5e1';
    ctx.font = '600 9.5px sans-serif';
    ctx.fillText(spec.tag, rect.x + rect.w / 2, rect.y + 31);
    ctx.restore();
  }

  // Bottom-right "下一只" button when stopped off-seat
  if (world.canAdvanceNextBird()) {
    const nb = hud.nextBirdBtn;
    ctx.fillStyle = '#f59e0b';
    roundRect(ctx, nb.x, nb.y, nb.w, nb.h, nb.r);
    ctx.fill();
    ctx.fillStyle = '#0f172a';
    ctx.font = '900 12.5px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('下一只 (Space)', nb.x + nb.w / 2, nb.y + nb.h / 2 + 1);
  } else {
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.font = '600 10px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(
      canSwitch ? '发射前可切换鸽种' : 'Space 触发特技',
      hud.nextBirdBtn.x + hud.nextBirdBtn.w / 2,
      hud.nextBirdBtn.y + hud.nextBirdBtn.h / 2 + 1,
    );
  }
}

function drawTitleOverlay(
  ctx: CanvasRenderingContext2D,
  extra: LaunchRenderExtra,
  t: LaunchTuning,
): void {
  const { width, height } = t.view;
  const ui = t.ui.title;
  const selectedStage = LAUNCH_STAGES[extra.selectedStageId];

  ctx.fillStyle = 'rgba(15, 23, 42, 0.58)';
  ctx.fillRect(0, 0, width, height);

  ctx.fillStyle = '#ffffff';
  roundRect(ctx, ui.card.x, ui.card.y, ui.card.w, ui.card.h, ui.card.r);
  ctx.fill();

  ctx.fillStyle = '#0284c7';
  ctx.font = '800 11.5px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('Launch Prototype · 阶段 1（首章 6 关）', width / 2, 86);

  ctx.fillStyle = '#0f172a';
  ctx.font = '900 23px sans-serif';
  ctx.fillText('坏鸽子抢喷泉 · 弹射版', width / 2, 118);

  ctx.fillStyle = '#64748b';
  ctx.font = '600 11.5px sans-serif';
  ctx.fillText('黑小坏 × 胖大肥双鸽切换 · 首章「街角到广场」', width / 2, 144);

  // 3x2 grid of 6 stages
  const ids: LaunchChapterStageId[] = [1, 2, 3, 4, 5, 6];
  ids.forEach((sid, idx) => {
    const col = idx % 3;
    const row = Math.floor(idx / 3);
    const sx = ui.gridStartX + col * (ui.cardW + ui.gapX);
    const sy = ui.gridStartY + row * (ui.cardH + ui.gapY);
    const cfg = LAUNCH_STAGES[sid];
    const selected = extra.selectedStageId === sid;
    const stars = extra.progress.stars[sid];
    const best = extra.progress.bestScores[sid];

    ctx.fillStyle = selected ? '#e0f2fe' : '#f8fafc';
    roundRect(ctx, sx, sy, ui.cardW, ui.cardH, 12);
    ctx.fill();
    ctx.strokeStyle = selected ? '#0284c7' : '#cbd5e1';
    ctx.lineWidth = selected ? 2.5 : 1.5;
    ctx.stroke();

    ctx.fillStyle = '#0f172a';
    ctx.font = '900 13px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`第 ${sid} 关`, sx + ui.cardW / 2, sy + 20);

    ctx.fillStyle = '#475569';
    ctx.font = '600 10.5px sans-serif';
    ctx.fillText(cfg.shortName.replace(/^\d+\.\s*/, ''), sx + ui.cardW / 2, sy + 40, ui.cardW - 10);

    const starStr = '★'.repeat(stars) + '☆'.repeat(3 - stars);
    ctx.fillStyle = stars > 0 ? '#f59e0b' : '#94a3b8';
    ctx.font = 'bold 12px sans-serif';
    ctx.fillText(starStr, sx + ui.cardW / 2, sy + 60, ui.cardW - 10);

    ctx.fillStyle = '#64748b';
    ctx.font = '700 9.5px sans-serif';
    ctx.fillText(best > 0 ? `最高 ${best}` : '点击挑战', sx + ui.cardW / 2, sy + 80, ui.cardW - 10);
  });

  // Selected stage preview box
  ctx.fillStyle = '#f8fafc';
  roundRect(ctx, 34, 372, width - 68, 122, 14);
  ctx.fill();
  ctx.fillStyle = '#0f172a';
  ctx.font = '900 14px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(selectedStage.title, 48, 396, width - 96);

  ctx.fillStyle = '#475569';
  ctx.font = '600 11.5px sans-serif';
  ctx.fillText(selectedStage.subtitle, 48, 420, width - 96);

  ctx.fillStyle = '#d97706';
  ctx.font = '800 11px sans-serif';
  ctx.fillText(`★2 小目标：${selectedStage.subGoalText}`, 48, 444, width - 96);

  ctx.fillStyle = '#64748b';
  ctx.font = '600 10.5px sans-serif';
  ctx.fillText('黑小坏(速降精准落座) · 胖大肥(重磅压棚清场)', 48, 472, width - 96);

  // Start button
  ctx.fillStyle = '#0ea5e9';
  roundRect(ctx, ui.startBtn.x, ui.startBtn.y, ui.startBtn.w, ui.startBtn.h, ui.startBtn.r);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.font = '900 18px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(`进入第 ${extra.selectedStageId} 关！`, width / 2, ui.startBtn.y + 26);
}

function drawResultOverlay(
  ctx: CanvasRenderingContext2D,
  world: LaunchPrototypeWorld,
  extra: LaunchRenderExtra,
  t: LaunchTuning,
): void {
  const { width, height } = t.view;
  const ui = t.ui.result;
  const { won, scoreResult, stage, subGoalCompleted, pigeonsRemaining } = world;
  const hasNext = won && stage.id < 6;

  ctx.fillStyle = 'rgba(15, 23, 42, 0.68)';
  ctx.fillRect(0, 0, width, height);

  ctx.fillStyle = '#ffffff';
  roundRect(ctx, ui.card.x, ui.card.y, ui.card.w, ui.card.h, ui.card.r);
  ctx.fill();

  ctx.fillStyle = '#0f172a';
  ctx.font = '900 20px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(won ? '好位置坐稳啦！' : '3 只鸽子都飞光啦！', width / 2, 76);

  const starStr = '★'.repeat(scoreResult.stars) + '☆'.repeat(3 - scoreResult.stars);
  ctx.fillStyle = scoreResult.stars > 0 ? '#f59e0b' : '#94a3b8';
  ctx.font = 'bold 24px sans-serif';
  ctx.fillText(starStr, width / 2, 106);

  // Polaroid thumbnail preview if won & captured
  if (won && extra.polaroidCanvas) {
    ctx.save();
    ctx.translate(width / 2, 206);
    ctx.rotate(-0.025);
    ctx.shadowColor = 'rgba(15, 23, 42, 0.25)';
    ctx.shadowBlur = 12;
    ctx.shadowOffsetY = 5;
    ctx.drawImage(extra.polaroidCanvas, -96, -84, 192, 168);
    ctx.restore();

    ctx.fillStyle = '#ea580c';
    ctx.font = '900 22px sans-serif';
    ctx.fillText(`${scoreResult.totalScore} 分`, width / 2, 314);

    ctx.fillStyle = '#475569';
    ctx.font = '600 11.5px sans-serif';
    ctx.fillText(
      `★2 ${subGoalCompleted ? '已达成 (+300)' : '未达成'} · 剩 ${pigeonsRemaining} 鸽 (+${scoreResult.bonusScore})`,
      width / 2,
      342,
      width - 68,
    );

    // Save Polaroid PNG button
    ctx.fillStyle = '#fef3c7';
    roundRect(
      ctx,
      ui.savePhotoBtn.x,
      ui.savePhotoBtn.y,
      ui.savePhotoBtn.w,
      ui.savePhotoBtn.h,
      ui.savePhotoBtn.r,
    );
    ctx.fill();
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 1.6;
    ctx.stroke();
    ctx.fillStyle = '#92400e';
    ctx.font = '800 13.5px sans-serif';
    ctx.fillText(
      '📷 保存残局照片 (PNG)',
      ui.savePhotoBtn.x + ui.savePhotoBtn.w / 2,
      ui.savePhotoBtn.y + ui.savePhotoBtn.h / 2 + 1,
    );
  } else {
    ctx.fillStyle = '#ea580c';
    ctx.font = '900 32px sans-serif';
    ctx.fillText(`${scoreResult.totalScore} 分`, width / 2, 166);

    const rows = [
      ['★1 好位置坐稳', won ? '达成' : '未达成'],
      [`★2 ${stage.subGoalText}`, subGoalCompleted ? '达成' : '未达成'],
      ['★3 剩余黑鸽奖励', `${pigeonsRemaining} 只`],
    ];
    rows.forEach(([label, val], idx) => {
      const ry = 236 + idx * 38;
      ctx.fillStyle = '#f8fafc';
      roundRect(ctx, 46, ry - 15, width - 92, 30, 8);
      ctx.fill();
      ctx.fillStyle = '#475569';
      ctx.font = '600 12px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(label, 56, ry, 185);
      ctx.fillStyle = '#0f172a';
      ctx.font = '800 12px sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(val, width - 56, ry);
    });
  }

  if (hasNext) {
    ctx.fillStyle = '#0ea5e9';
    roundRect(
      ctx,
      ui.primaryBtn.x,
      ui.primaryBtn.y,
      ui.primaryBtn.w,
      ui.primaryBtn.h,
      ui.primaryBtn.r,
    );
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = '900 16px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`下一关：第 ${stage.id + 1} 关 ▶`, width / 2, ui.primaryBtn.y + ui.primaryBtn.h / 2 + 1);
  }

  const leftRect = hasNext ? ui.leftBtn : ui.soloLeftBtn;
  const rightRect = hasNext ? ui.rightBtn : ui.soloRightBtn;
  for (const [btn, label, bg, fg] of [
    [leftRect, '重玩本关 (R)', hasNext ? '#f1f5f9' : '#10b981', hasNext ? '#0f172a' : '#ffffff'],
    [rightRect, '返回选关', '#e2e8f0', '#334155'],
  ] as const) {
    ctx.fillStyle = bg;
    roundRect(ctx, btn.x, btn.y, btn.w, btn.h, btn.r);
    ctx.fill();
    ctx.fillStyle = fg;
    ctx.font = hasNext ? '800 13.5px sans-serif' : '900 15px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(label, btn.x + btn.w / 2, btn.y + btn.h / 2 + 1);
  }
}

function drawDebugOverlay(
  ctx: CanvasRenderingContext2D,
  world: LaunchPrototypeWorld,
  t: LaunchTuning,
): void {
  ctx.save();
  ctx.strokeStyle = '#22d3ee';
  ctx.lineWidth = 1.5;
  for (const body of [
    ...world.supportBodies,
    ...world.cups.map((c) => c.body),
    ...world.spentBirds.map((s) => s.body),
    world.activeBird,
    ...world.rivals.map((r) => r.body),
  ]) {
    ctx.beginPath();
    body.vertices.forEach((v, idx) => {
      if (idx === 0) ctx.moveTo(v.x, v.y);
      else ctx.lineTo(v.x, v.y);
    });
    ctx.closePath();
    ctx.stroke();
  }

  for (const r of world.stage.relays) {
    ctx.strokeStyle = '#facc15';
    ctx.setLineDash([4, 3]);
    ctx.strokeRect(
      r.x - r.triggerRadiusPx,
      r.y - r.triggerHeightPx,
      r.triggerRadiusPx * 2,
      r.triggerHeightPx * 2,
    );
    ctx.setLineDash([]);
  }

  const seat = world.stage.seat;
  ctx.strokeStyle = '#4ade80';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(seat.x - seat.halfW, seat.minY, seat.halfW * 2, seat.maxY - seat.minY);

  if (world.phase === 'aiming' && world.isDragging && world.aimValid) {
    const fx = world.stage.fountainX;
    const fy = world.stage.fountainY;
    ctx.strokeStyle = '#f43f5e';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(fx, fy);
    ctx.lineTo(fx + world.aimLaunchVx * 0.16, fy + world.aimLaunchVy * 0.16);
    ctx.stroke();
  }

  ctx.fillStyle = 'rgba(2, 6, 23, 0.84)';
  ctx.fillRect(10, 92, 286, 56);
  ctx.fillStyle = '#22d3ee';
  ctx.font = '10.5px monospace';
  ctx.textAlign = 'left';
  ctx.fillText(
    `phase=${world.phase} char=${world.selectedCharacter} spd=${world.lastSpeedPxPerSec.toFixed(1)}`,
    16,
    108,
  );
  ctx.fillText(
    `inSeat=${world.inTargetSeatZone} settle=${world.settleTimerSec.toFixed(2)}/${t.settle.durationSec}s`,
    16,
    124,
  );
  const awnDeg = world.awningBody ? ((world.awningBody.angle * 180) / Math.PI).toFixed(1) : 'n/a';
  ctx.fillText(
    `aim=(${world.aimLaunchVx.toFixed(0)},${world.aimLaunchVy.toFixed(0)}) awn=${awnDeg}° sub=${world.subGoalCompleted}`,
    16,
    140,
  );
  ctx.restore();
}

export function drawLaunchFrame(
  ctx: CanvasRenderingContext2D,
  world: LaunchPrototypeWorld,
  extra: LaunchRenderExtra,
  t: LaunchTuning = launchTuning,
): void {
  ctx.save();
  const canShake = extra.screenMode === 'playing' && world.shakeMag > 0.2;
  const sx = canShake ? (Math.random() - 0.5) * world.shakeMag * 2 : 0;
  const sy = canShake ? (Math.random() - 0.5) * world.shakeMag * 2 : 0;
  ctx.translate(sx, sy);

  drawBackground(ctx, world, t, extra.animTimeSec);
  drawStageStructures(ctx, world, extra.animTimeSec);
  drawFountainJetsAndAim(ctx, world);
  drawBirdsAndEffects(ctx, world, extra.animTimeSec);
  ctx.restore();

  drawHud(ctx, world, extra, t);

  if (extra.debug) {
    drawDebugOverlay(ctx, world, t);
  }

  if (extra.screenMode === 'title') {
    drawTitleOverlay(ctx, extra, t);
  } else if (extra.screenMode === 'result') {
    drawResultOverlay(ctx, world, extra, t);
  }
}
