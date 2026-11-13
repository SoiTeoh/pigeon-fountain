import { tuning, type Tuning } from '../config/tuning';
import type { PigeonFountainWorld, PlayerExpression } from '../game/world';

export interface RenderExtra {
  readonly screenMode: 'title' | 'playing' | 'result';
  readonly bestScore: number;
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

function drawFeatherIcon(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  active: boolean,
): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(-0.45);
  ctx.fillStyle = active ? '#334155' : 'rgba(255,255,255,0.22)';
  ctx.strokeStyle = active ? '#e2e8f0' : 'rgba(255,255,255,0.25)';
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.ellipse(0, 0, 5, 11, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(0, 12);
  ctx.lineTo(0, -9);
  ctx.stroke();
  ctx.restore();
}

function drawPlazaBackground(
  ctx: CanvasRenderingContext2D,
  world: PigeonFountainWorld,
  t: Tuning,
  animTimeSec: number,
): void {
  const { width, height } = t.view;
  const { groundY, grateLeftX, grateRightX } = t.scene;

  // Sky gradient
  const sky = ctx.createLinearGradient(0, 0, 0, groundY);
  sky.addColorStop(0, '#bae6fd');
  sky.addColorStop(1, '#f0f9ff');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, width, groundY);

  // Soft distant clouds
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  const cloudShift = (animTimeSec * 8) % (width + 120);
  for (const [cx, cy, r] of [
    [70, 115, 22],
    [250, 90, 26],
  ]) {
    const x = ((cx + cloudShift) % (width + 120)) - 60;
    ctx.beginPath();
    ctx.arc(x, cy, r, 0, Math.PI * 2);
    ctx.arc(x + 20, cy + 4, r * 0.78, 0, Math.PI * 2);
    ctx.arc(x - 18, cy + 5, r * 0.72, 0, Math.PI * 2);
    ctx.fill();
  }

  // Distant park trees & balustrade
  ctx.fillStyle = '#86efac';
  for (const [tx, tr] of [
    [45, 42],
    [130, 50],
    [245, 46],
    [345, 44],
  ]) {
    ctx.beginPath();
    ctx.arc(tx, groundY - 45, tr, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = '#cbd5e1';
  ctx.fillRect(0, groundY - 22, width, 22);
  ctx.fillStyle = '#94a3b8';
  ctx.fillRect(0, groundY - 24, width, 4);

  // Wet stone plaza ground
  const floorGrad = ctx.createLinearGradient(0, groundY, 0, height);
  floorGrad.addColorStop(0, '#94a3b8');
  floorGrad.addColorStop(0.25, '#64748b');
  floorGrad.addColorStop(1, '#334155');
  ctx.fillStyle = floorGrad;
  ctx.fillRect(0, groundY, width, height - groundY);

  // Stone tile lines
  ctx.strokeStyle = 'rgba(255,255,255,0.14)';
  ctx.lineWidth = 1.5;
  for (let x = 20; x < width; x += 62) {
    ctx.beginPath();
    ctx.moveTo(x, groundY);
    ctx.lineTo(x - 16, height);
    ctx.stroke();
  }

  // Metal drainage grate
  const grateW = grateRightX - grateLeftX;
  ctx.fillStyle = '#334155';
  roundRect(ctx, grateLeftX, groundY - 2, grateW, 14, 4);
  ctx.fill();
  ctx.strokeStyle = '#64748b';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Grate vertical slots
  ctx.fillStyle = '#0f172a';
  for (let sx = grateLeftX + 10; sx < grateRightX - 8; sx += 12) {
    ctx.fillRect(sx, groundY + 1, 5, 8);
  }

  // 3 nozzle markers on grate
  const { fountain } = world.match;
  t.scene.nozzles.forEach((nx, idx) => {
    const isTarget = idx === fountain.slotIndex && fountain.phase !== 'IDLE';
    const isSurgeWarn = isTarget && fountain.phase === 'SURGE_WARN';
    const shakeX = isSurgeWarn ? Math.sin(animTimeSec * 65) * 3 : 0;

    ctx.fillStyle = isSurgeWarn
      ? '#ef4444'
      : isTarget
        ? '#38bdf8'
        : '#475569';
    roundRect(ctx, nx - 16 + shakeX, groundY - 5, 32, 8, 3);
    ctx.fill();
  });
}

function drawFountainJet(
  ctx: CanvasRenderingContext2D,
  world: PigeonFountainWorld,
  t: Tuning,
  animTimeSec: number,
): void {
  const { fountain } = world.match;
  if (fountain.phase === 'IDLE') return;

  const nx = t.scene.nozzles[fountain.slotIndex];
  const groundY = t.scene.groundY;

  if (fountain.phase === 'WARNING') {
    const pulse = 0.5 + 0.5 * Math.sin(animTimeSec * 14);
    ctx.strokeStyle = `rgba(56, 189, 248, ${0.45 + pulse * 0.45})`;
    ctx.lineWidth = 2.5;
    ctx.setLineDash([5, 4]);
    ctx.beginPath();
    ctx.ellipse(nx, groundY - 3, 24 + pulse * 4, 6, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    return;
  }

  if (fountain.phase === 'ACTIVE') {
    const lean = fountain.lateralDir * (fountain.lateralStrength / t.fountain.lateralPushMax) * 14;
    const topY = groundY - 125;

    // Outer spray
    const grad = ctx.createLinearGradient(nx, groundY, nx + lean, topY);
    grad.addColorStop(0, 'rgba(56, 189, 248, 0.85)');
    grad.addColorStop(0.6, 'rgba(186, 230, 253, 0.78)');
    grad.addColorStop(1, 'rgba(255, 255, 255, 0.2)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(nx - 14, groundY - 2);
    ctx.quadraticCurveTo(nx - 10 + lean * 0.5, groundY - 65, nx - 22 + lean, topY);
    ctx.lineTo(nx + 22 + lean, topY);
    ctx.quadraticCurveTo(nx + 10 + lean * 0.5, groundY - 65, nx + 14, groundY - 2);
    ctx.closePath();
    ctx.fill();

    // Inner foam core
    ctx.fillStyle = 'rgba(255,255,255,0.65)';
    ctx.beginPath();
    ctx.moveTo(nx - 6, groundY - 2);
    ctx.lineTo(nx - 8 + lean, topY + 25);
    ctx.lineTo(nx + 8 + lean, topY + 25);
    ctx.lineTo(nx + 6, groundY - 2);
    ctx.closePath();
    ctx.fill();
    return;
  }

  if (fountain.phase === 'SURGE_WARN') {
    const flash = Math.sin(animTimeSec * 28) > 0;
    ctx.fillStyle = flash ? 'rgba(239, 68, 68, 0.35)' : 'rgba(251, 146, 60, 0.25)';
    ctx.fillRect(nx - 26, groundY - 95, 52, 95);

    // Warning exclamation mark
    ctx.save();
    ctx.translate(nx, groundY - 115 + Math.sin(animTimeSec * 22) * 4);
    ctx.fillStyle = '#ef4444';
    ctx.beginPath();
    ctx.arc(0, 0, 16, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = '900 20px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('!', 0, 1);
    ctx.restore();
    return;
  }

  if (fountain.phase === 'SURGE') {
    const grad = ctx.createLinearGradient(nx, groundY, nx, 60);
    grad.addColorStop(0, 'rgba(14, 165, 233, 0.95)');
    grad.addColorStop(0.5, 'rgba(186, 230, 253, 0.92)');
    grad.addColorStop(1, 'rgba(255, 255, 255, 0.65)');
    ctx.fillStyle = grad;
    ctx.fillRect(nx - 24, 70, 48, groundY - 70);
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.fillRect(nx - 11, 70, 22, groundY - 70);
  }
}

function drawPigeon(
  ctx: CanvasRenderingContext2D,
  opts: {
    x: number;
    y: number;
    facing: -1 | 1;
    spinRad: number;
    waddlePhase: number;
    squashX: number;
    squashY: number;
    isPlayer: boolean;
    expression: PlayerExpression | 'grumpy' | 'launched';
    bumpActive: boolean;
  },
): void {
  ctx.save();
  const waddleTilt = opts.spinRad !== 0 ? 0 : Math.sin(opts.waddlePhase) * 0.08;
  ctx.translate(opts.x, opts.y - 20);
  ctx.rotate(opts.spinRad + waddleTilt);
  ctx.scale(opts.facing * opts.squashX, opts.squashY);

  // Legs
  ctx.strokeStyle = '#f59e0b';
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  const stepA = Math.sin(opts.waddlePhase) * 4;
  ctx.beginPath();
  ctx.moveTo(-5, 14);
  ctx.lineTo(-5 + stepA, 22);
  ctx.moveTo(5, 14);
  ctx.lineTo(5 - stepA, 22);
  ctx.stroke();

  // Tail feathers
  ctx.fillStyle = opts.isPlayer ? '#1e293b' : '#cbd5e1';
  ctx.beginPath();
  ctx.ellipse(-20, 4, 10, 6, -0.35, 0, Math.PI * 2);
  ctx.fill();

  // Plump round body
  ctx.fillStyle = opts.isPlayer ? '#334155' : '#f8fafc';
  ctx.strokeStyle = opts.isPlayer ? '#0f172a' : '#94a3b8';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(0, 2, 22, 16, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Wing accent
  ctx.fillStyle = opts.isPlayer ? '#475569' : '#e2e8f0';
  ctx.beginPath();
  ctx.ellipse(-3, 3, 13, 8, -0.15, 0, Math.PI * 2);
  ctx.fill();

  // Iridescent neck for black pigeon
  if (opts.isPlayer) {
    const neck = ctx.createLinearGradient(4, -18, 16, -2);
    neck.addColorStop(0, '#a855f7');
    neck.addColorStop(1, '#10b981');
    ctx.fillStyle = neck;
    ctx.beginPath();
    ctx.ellipse(9, -7, 8, 6, 0.2, 0, Math.PI * 2);
    ctx.fill();
  }

  // Head
  ctx.fillStyle = opts.isPlayer ? '#334155' : '#ffffff';
  ctx.strokeStyle = opts.isPlayer ? '#0f172a' : '#94a3b8';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(11, -14, 11.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Beak
  ctx.fillStyle = '#f59e0b';
  ctx.beginPath();
  ctx.moveTo(21, -16);
  ctx.lineTo(29, -13);
  ctx.lineTo(21, -10);
  ctx.closePath();
  ctx.fill();

  // Facial expressions
  ctx.strokeStyle = opts.isPlayer ? '#f8fafc' : '#0f172a';
  ctx.fillStyle = opts.isPlayer ? '#f8fafc' : '#0f172a';
  ctx.lineWidth = 2;

  if (opts.expression === 'bliss') {
    // ^ ◡ ^
    ctx.beginPath();
    ctx.arc(13, -15, 3.2, Math.PI * 1.1, Math.PI * 1.9);
    ctx.stroke();
    ctx.fillStyle = 'rgba(251, 113, 133, 0.55)';
    ctx.beginPath();
    ctx.arc(9, -10, 3, 0, Math.PI * 2);
    ctx.fill();
  } else if (opts.expression === 'panic') {
    // O □ O + sweat
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(13, -15, 4.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.arc(13.8, -15, 1.8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#38bdf8';
    ctx.beginPath();
    ctx.arc(3, -18, 2.6, 0, Math.PI * 2);
    ctx.fill();
  } else if (opts.expression === 'launched') {
    // × ×
    ctx.beginPath();
    ctx.moveTo(10, -18);
    ctx.lineTo(16, -12);
    ctx.moveTo(16, -18);
    ctx.lineTo(10, -12);
    ctx.stroke();
  } else if (opts.expression === 'grumpy') {
    // Ò _ Ó
    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.arc(13, -14, 2.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(9, -19);
    ctx.lineTo(17, -16);
    ctx.stroke();
  } else {
    // Smug - _ -
    ctx.beginPath();
    ctx.moveTo(9, -15);
    ctx.lineTo(17, -15);
    ctx.stroke();
  }

  // Butt-bump impact aura
  if (opts.bumpActive) {
    ctx.strokeStyle = '#fde047';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(24, 0, 14, -0.8, 0.8);
    ctx.stroke();
  }

  ctx.restore();
}

function drawParticlesAndFloats(
  ctx: CanvasRenderingContext2D,
  world: PigeonFountainWorld,
): void {
  for (const p of world.particles) {
    const alpha = Math.max(0, Math.min(1, p.life / p.maxLife));
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(p.x, p.y);
    ctx.rotate(p.rot);
    if (p.kind.startsWith('feather')) {
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.ellipse(0, 0, p.r * 1.4, p.r * 0.55, 0, 0, Math.PI * 2);
      ctx.fill();
    } else if (p.kind === 'heart') {
      ctx.fillStyle = p.color;
      ctx.font = 'bold 14px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('♥', 0, 0);
    } else {
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(0, 0, p.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  for (const f of world.floats) {
    const alpha = Math.max(0, Math.min(1, f.life / f.maxLife));
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.font = `900 ${Math.round(18 * f.scale)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 4;
    ctx.strokeText(f.text, f.x, f.y);
    ctx.fillStyle = f.color;
    ctx.fillText(f.text, f.x, f.y);
    ctx.restore();
  }
}

function drawHudAndControls(
  ctx: CanvasRenderingContext2D,
  world: PigeonFountainWorld,
  extra: RenderExtra,
  t: Tuning,
): void {
  const { width } = t.view;
  const { match, combo } = world;

  // Top HUD bar
  ctx.fillStyle = 'rgba(15, 23, 42, 0.82)';
  roundRect(ctx, 14, 14, width - 28, 48, 14);
  ctx.fill();

  // Countdown
  ctx.fillStyle = match.remainingSec <= 10 ? '#fca5a5' : '#ffffff';
  ctx.font = '800 18px sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(`${Math.ceil(match.remainingSec)}s`, 28, 38);

  // 3 feathers
  for (let i = 0; i < t.scoring.maxFeathers; i++) {
    drawFeatherIcon(ctx, 90 + i * 22, 38, i < match.feathers);
  }

  // Score + Combo pill
  ctx.fillStyle = '#fde047';
  ctx.font = '800 18px sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText(`${Math.floor(match.score)}分`, width - 66, 38);

  if (combo > 1) {
    ctx.fillStyle = combo === 3 ? '#f97316' : '#38bdf8';
    roundRect(ctx, width - 134, 68, 60, 22, 11);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = '800 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`舒爽 ×${combo}`, width - 104, 79);
  }

  // Mute button
  ctx.fillStyle = 'rgba(255,255,255,0.14)';
  ctx.beginPath();
  ctx.arc(width - 36, 38, 15, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.font = '14px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(extra.muted ? '🔇' : '🔊', width - 36, 39);

  if (extra.screenMode !== 'playing') return;

  // Left / right hold zone subtle labels
  ctx.fillStyle = 'rgba(255,255,255,0.45)';
  ctx.font = '600 12px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('◀ 按住左移 (A/←)', 22, 514);
  ctx.textAlign = 'right';
  ctx.fillText('按住右移 (D/→) ▶', width - 22, 514);

  // Bottom center "肥臀猛顶" button
  const btn = t.scene.bumpButton;
  const cdRatio = world.player.bumpCooldownSec / t.pigeon.bumpCooldownSec;
  const ready = cdRatio <= 0.001;

  ctx.save();
  roundRect(ctx, btn.x - btn.width / 2, btn.y - btn.height / 2, btn.width, btn.height, 24);
  ctx.fillStyle = ready ? '#f59e0b' : '#475569';
  ctx.fill();
  ctx.strokeStyle = ready ? '#fef08a' : '#94a3b8';
  ctx.lineWidth = 2.5;
  ctx.stroke();

  if (!ready) {
    ctx.save();
    ctx.clip();
    ctx.fillStyle = 'rgba(245, 158, 11, 0.35)';
    ctx.fillRect(
      btn.x - btn.width / 2,
      btn.y - btn.height / 2,
      btn.width * (1 - cdRatio),
      btn.height,
    );
    ctx.restore();
  }

  ctx.fillStyle = '#0f172a';
  ctx.font = '900 16px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(ready ? '肥臀猛顶 (Space)' : '蓄力中...', btn.x, btn.y + 1);
  ctx.restore();
}

function drawTitleOverlay(ctx: CanvasRenderingContext2D, bestScore: number, t: Tuning): void {
  const { width, height } = t.view;
  ctx.fillStyle = 'rgba(15, 23, 42, 0.56)';
  ctx.fillRect(0, 0, width, height);

  ctx.fillStyle = '#ffffff';
  roundRect(ctx, 28, 116, width - 56, 390, 22);
  ctx.fill();

  ctx.fillStyle = '#0f172a';
  ctx.font = '900 26px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('坏鸽子抢喷泉', width / 2, 162);

  ctx.fillStyle = '#475569';
  ctx.font = '600 13px sans-serif';
  ctx.fillText('霸占水柱享福 · 算准时机坑哭白胖鸽', width / 2, 192);

  const tips = [
    ['💧 坐上喷泉稳住屁股', '抗住水压不滑出，最高 ×3 舒爽连击'],
    ['⚠️ 红 ! 蓄压快闪开', '贪分会被高压水柱顶飞掉 1 根尾羽'],
    ['🍑 肥臀猛顶（Space）', '把白鸽撞进红 ! 暴喷口，直接 +150！'],
  ];
  tips.forEach(([title, desc], idx) => {
    const ty = 240 + idx * 54;
    ctx.fillStyle = '#f1f5f9';
    roundRect(ctx, 48, ty - 16, width - 96, 44, 10);
    ctx.fill();
    ctx.fillStyle = '#0f172a';
    ctx.font = '800 13px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(title, 62, ty);
    ctx.fillStyle = '#64748b';
    ctx.font = '500 11.5px sans-serif';
    ctx.fillText(desc, 62, ty + 18);
  });

  if (bestScore > 0) {
    ctx.fillStyle = '#d97706';
    ctx.font = '700 13px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`本机最高分：${Math.floor(bestScore)} 分`, width / 2, 402);
  }

  // Start button: x 64..326, y 422..474
  ctx.fillStyle = '#0ea5e9';
  roundRect(ctx, 64, 422, width - 128, 52, 16);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.font = '900 18px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('上广场抢水柱！', width / 2, 454);
}

function drawResultOverlay(
  ctx: CanvasRenderingContext2D,
  world: PigeonFountainWorld,
  bestScore: number,
  t: Tuning,
): void {
  const { width, height } = t.view;
  const { match } = world;
  ctx.fillStyle = 'rgba(15, 23, 42, 0.64)';
  ctx.fillRect(0, 0, width, height);

  ctx.fillStyle = '#ffffff';
  roundRect(ctx, 30, 126, width - 60, 396, 22);
  ctx.fill();

  ctx.fillStyle = '#0f172a';
  ctx.font = '900 24px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(
    match.endReason === 'feathers_zero' ? '尾羽掉光啦！' : '广场霸主账单',
    width / 2,
    170,
  );

  ctx.fillStyle = '#ea580c';
  ctx.font = '900 36px sans-serif';
  ctx.fillText(`${Math.floor(match.score)} 分`, width / 2, 222);

  const rows = [
    ['占领喷泉时长', `${match.soakSec.toFixed(1)} 秒`],
    ['使坏顶飞白鸽', `${match.sabotageCount} 次`],
    ['最高舒爽连击', `×${match.maxCombo}`],
    ['本机最高纪录', `${Math.floor(Math.max(bestScore, match.score))} 分`],
  ];
  rows.forEach(([label, val], idx) => {
    const ry = 274 + idx * 38;
    ctx.fillStyle = '#f8fafc';
    roundRect(ctx, 52, ry - 18, width - 104, 30, 8);
    ctx.fill();
    ctx.fillStyle = '#475569';
    ctx.font = '600 13px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(label, 64, ry);
    ctx.fillStyle = '#0f172a';
    ctx.font = '800 14px sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(val, width - 64, ry);
  });

  // Restart button: x 64..326, y 446..498
  ctx.fillStyle = '#10b981';
  roundRect(ctx, 64, 446, width - 128, 52, 16);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.font = '900 17px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('再来抢一局 (R)', width / 2, 478);
}

function drawDebugOverlay(
  ctx: CanvasRenderingContext2D,
  world: PigeonFountainWorld,
  t: Tuning,
): void {
  const { fountain } = world.match;
  const { groundY, nozzles } = t.scene;

  // Nozzle core zones
  nozzles.forEach((nx, i) => {
    ctx.strokeStyle = i === fountain.slotIndex ? '#22d3ee' : 'rgba(148,163,184,0.5)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 3]);
    ctx.strokeRect(
      nx - t.fountain.coreRadiusPx,
      groundY - 58,
      t.fountain.coreRadiusPx * 2,
      62,
    );
    ctx.setLineDash([]);
  });

  // Pigeon collision circles
  for (const [p, color] of [
    [world.player, '#22d3ee'],
    [world.ai, '#f472b6'],
  ] as const) {
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(p.x, p.y - 20, t.pigeon.radius, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Lateral push vector
  if (fountain.phase === 'ACTIVE' && fountain.lateralDir !== 0) {
    const nx = nozzles[fountain.slotIndex];
    const len = (fountain.lateralStrength / t.fountain.lateralPushMax) * 48 * fountain.lateralDir;
    ctx.strokeStyle = '#facc15';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(nx, groundY - 82);
    ctx.lineTo(nx + len, groundY - 82);
    ctx.stroke();
  }

  // Info box
  ctx.fillStyle = 'rgba(2, 6, 23, 0.8)';
  ctx.fillRect(10, 70, 245, 58);
  ctx.fillStyle = '#22d3ee';
  ctx.font = '11px monospace';
  ctx.textAlign = 'left';
  ctx.fillText(
    `phase=${fountain.phase} t=${fountain.phaseTimerSec.toFixed(2)}s slot=${fountain.slotIndex}`,
    16,
    86,
  );
  ctx.fillText(
    `lat=${fountain.lateralDir * Math.round(fountain.lateralStrength)} occ=${world.occupant}`,
    16,
    102,
  );
  ctx.fillText(
    `pX=${world.player.x.toFixed(1)} aiX=${world.ai.x.toFixed(1)} (${world.ai.intent})`,
    16,
    118,
  );
}

export function drawGameFrame(
  ctx: CanvasRenderingContext2D,
  world: PigeonFountainWorld,
  extra: RenderExtra,
  t: Tuning = tuning,
): void {
  ctx.save();
  const shakeX = world.shakeMag > 0.2 ? (Math.random() - 0.5) * world.shakeMag * 2 : 0;
  const shakeY = world.shakeMag > 0.2 ? (Math.random() - 0.5) * world.shakeMag * 2 : 0;
  ctx.translate(shakeX, shakeY);

  drawPlazaBackground(ctx, world, t, extra.animTimeSec);
  drawFountainJet(ctx, world, t, extra.animTimeSec);

  if (world.ai.respawnTimerSec <= 0) {
    drawPigeon(ctx, {
      x: world.ai.x,
      y: world.ai.y,
      facing: world.ai.facing,
      spinRad: world.ai.spinRad,
      waddlePhase: world.ai.waddlePhase,
      squashX: world.ai.squashX,
      squashY: world.ai.squashY,
      isPlayer: false,
      expression: world.ai.airborne
        ? 'launched'
        : world.occupant === 'ai' && world.match.fountain.phase === 'ACTIVE'
          ? 'bliss'
          : 'grumpy',
      bumpActive: false,
    });
  }

  drawPigeon(ctx, {
    x: world.player.x,
    y: world.player.y,
    facing: world.player.facing,
    spinRad: world.player.spinRad,
    waddlePhase: world.player.waddlePhase,
    squashX: world.player.squashX,
    squashY: world.player.squashY,
    isPlayer: true,
    expression: world.player.expression,
    bumpActive: world.player.bumpAnimSec > 0,
  });

  drawParticlesAndFloats(ctx, world);
  ctx.restore();

  drawHudAndControls(ctx, world, extra, t);

  if (extra.debug) {
    drawDebugOverlay(ctx, world, t);
  }

  if (extra.screenMode === 'title') {
    drawTitleOverlay(ctx, extra.bestScore, t);
  } else if (extra.screenMode === 'result') {
    drawResultOverlay(ctx, world, extra.bestScore, t);
  }
}
