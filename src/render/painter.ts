import { STAGES, tuning, type StageThemeId, type Tuning } from '../config/tuning';
import {
  evaluateStageStars,
  type FountainSlotState,
  type ScreenMode,
} from '../game/rules';
import type { PigeonFountainWorld, PlayerExpression, RivalBird } from '../game/world';
import type { GameMode, PlayerProgress, StageId } from '../platform/storage';

export interface RenderExtra {
  readonly screenMode: ScreenMode;
  readonly gameMode: GameMode;
  readonly selectedStageId: StageId;
  readonly progress: PlayerProgress;
  readonly muted: boolean;
  readonly debug: boolean;
  readonly animTimeSec: number;
  readonly leftPressed: boolean;
  readonly rightPressed: boolean;
}

interface ThemePalette {
  readonly skyTop: string;
  readonly skyBottom: string;
  readonly treeColor: string;
  readonly railTop: string;
  readonly railBody: string;
  readonly floorTop: string;
  readonly floorMid: string;
  readonly floorBot: string;
  readonly isNight: boolean;
}

const THEME_PALETTES: Record<StageThemeId, ThemePalette> = {
  neighborhood: {
    skyTop: '#bae6fd',
    skyBottom: '#f0f9ff',
    treeColor: '#86efac',
    railTop: '#94a3b8',
    railBody: '#cbd5e1',
    floorTop: '#94a3b8',
    floorMid: '#64748b',
    floorBot: '#334155',
    isNight: false,
  },
  park: {
    skyTop: '#7dd3fc',
    skyBottom: '#fef9c3',
    treeColor: '#4ade80',
    railTop: '#78716c',
    railBody: '#d6d3d1',
    floorTop: '#a8a29e',
    floorMid: '#78716c',
    floorBot: '#44403c',
    isNight: false,
  },
  commercial: {
    skyTop: '#312e81',
    skyBottom: '#f472b6',
    treeColor: '#4c1d95',
    railTop: '#64748b',
    railBody: '#94a3b8',
    floorTop: '#64748b',
    floorMid: '#475569',
    floorBot: '#1e293b',
    isNight: true,
  },
  carnival: {
    skyTop: '#0f172a',
    skyBottom: '#312e81',
    treeColor: '#1e1b4b',
    railTop: '#f59e0b',
    railBody: '#334155',
    floorTop: '#475569',
    floorMid: '#334155',
    floorBot: '#0f172a',
    isNight: true,
  },
};

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
  ctx.fillStyle = active ? '#334155' : 'rgba(255,255,255,0.18)';
  ctx.strokeStyle = active ? '#e2e8f0' : 'rgba(255,255,255,0.24)';
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.ellipse(0, 0, 4.5, 10, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(0, 11);
  ctx.lineTo(0, -8);
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
  const { groundY } = t.scene;
  const { stage } = world;
  const pal = THEME_PALETTES[stage.theme];

  // Sky gradient
  const sky = ctx.createLinearGradient(0, 0, 0, groundY);
  sky.addColorStop(0, pal.skyTop);
  sky.addColorStop(1, pal.skyBottom);
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, width, groundY);

  if (pal.isNight) {
    // Twinkling stars & city skyline silhouette
    ctx.fillStyle = 'rgba(255, 255, 255, 0.72)';
    for (const [sx, sy, phase] of [
      [38, 78, 0.2],
      [112, 92, 1.4],
      [186, 68, 2.3],
      [274, 88, 0.9],
      [344, 74, 3.1],
    ]) {
      const r = 1.4 + 0.8 * Math.sin(animTimeSec * 3.2 + phase);
      ctx.beginPath();
      ctx.arc(sx, sy, r, 0, Math.PI * 2);
      ctx.fill();
    }

    // Distant shops / neon buildings
    ctx.fillStyle = stage.theme === 'carnival' ? '#1e1b4b' : '#334155';
    const buildings = [
      [14, 108, 66],
      [92, 132, 74],
      [182, 94, 62],
      [256, 126, 68],
      [332, 102, 54],
    ];
    for (const [bx, bh, bw] of buildings) {
      ctx.fillRect(bx, groundY - 22 - bh, bw, bh);
    }

    if (stage.theme === 'commercial') {
      // Trendy cafe neon signs
      ctx.fillStyle = 'rgba(244, 114, 182, 0.85)';
      roundRect(ctx, 102, groundY - 118, 52, 18, 5);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 9px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('CAFE', 128, groundY - 106);

      ctx.fillStyle = 'rgba(56, 189, 248, 0.85)';
      roundRect(ctx, 266, groundY - 110, 48, 18, 5);
      ctx.fill();
      ctx.fillStyle = '#0f172a';
      ctx.fillText('MILK', 290, groundY - 98);
    } else if (stage.theme === 'carnival') {
      // Carnival string lights!
      ctx.strokeStyle = 'rgba(255,255,255,0.35)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(0, 122);
      ctx.quadraticCurveTo(195, 162, width, 122);
      ctx.stroke();
      const bulbColors = ['#facc15', '#f43f5e', '#38bdf8', '#4ade80'];
      for (let i = 0; i < 9; i++) {
        const u = (i + 0.5) / 9;
        const lx = u * width;
        const ly = 122 + 40 * 2 * u * (1 - u);
        ctx.fillStyle = bulbColors[i % bulbColors.length];
        ctx.beginPath();
        ctx.arc(lx, ly + 4, 4.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  } else {
    // Soft clouds & neighborhood/park backdrop
    ctx.fillStyle = 'rgba(255,255,255,0.78)';
    const cloudShift = (animTimeSec * 8) % (width + 120);
    for (const [cx, cy, r] of [
      [70, 108, 22],
      [250, 86, 26],
    ]) {
      const x = ((cx + cloudShift) % (width + 120)) - 60;
      ctx.beginPath();
      ctx.arc(x, cy, r, 0, Math.PI * 2);
      ctx.arc(x + 20, cy + 4, r * 0.78, 0, Math.PI * 2);
      ctx.arc(x - 18, cy + 5, r * 0.72, 0, Math.PI * 2);
      ctx.fill();
    }

    if (stage.theme === 'neighborhood') {
      // Cozy residential warm brick facades in background
      ctx.fillStyle = '#fed7aa';
      ctx.fillRect(18, groundY - 148, 76, 126);
      ctx.fillRect(298, groundY - 134, 72, 112);
      ctx.fillStyle = '#fb923c';
      ctx.fillRect(14, groundY - 154, 84, 10);
      ctx.fillRect(294, groundY - 140, 80, 10);
      ctx.fillStyle = '#fef3c7';
      for (const wx of [32, 62, 312, 342]) {
        ctx.fillRect(wx, groundY - 122, 16, 22);
        ctx.fillRect(wx, groundY - 88, 16, 22);
      }
    } else if (stage.theme === 'park') {
      // Park music pavilion arch behind fountain
      ctx.strokeStyle = 'rgba(255,255,255,0.65)';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(195, groundY - 22, 110, Math.PI, 0);
      ctx.stroke();
    }

    // Park trees
    ctx.fillStyle = pal.treeColor;
    for (const [tx, tr] of [
      [58, 38],
      [138, 46],
      [245, 44],
      [335, 38],
    ]) {
      ctx.beginPath();
      ctx.arc(tx, groundY - 45, tr, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Balustrade
  ctx.fillStyle = pal.railBody;
  ctx.fillRect(0, groundY - 22, width, 22);
  ctx.fillStyle = pal.railTop;
  ctx.fillRect(0, groundY - 24, width, 4);

  // Elevated side ledges for Angry-Birds style upper props!
  for (const prop of world.props) {
    if (!prop.elevated) continue;
    const ledgeW = 52;
    const ledgeX = prop.side === 'left' ? 4 : width - 4 - ledgeW;
    const ledgeY = prop.y + prop.h / 2;
    ctx.fillStyle = '#475569';
    roundRect(ctx, ledgeX, ledgeY, ledgeW, 10, 4);
    ctx.fill();
    ctx.fillStyle = '#94a3b8';
    ctx.fillRect(ledgeX + 2, ledgeY, ledgeW - 4, 3);
  }

  // Wet stone plaza ground
  const floorGrad = ctx.createLinearGradient(0, groundY, 0, height);
  floorGrad.addColorStop(0, pal.floorTop);
  floorGrad.addColorStop(0.28, pal.floorMid);
  floorGrad.addColorStop(1, pal.floorBot);
  ctx.fillStyle = floorGrad;
  ctx.fillRect(0, groundY, width, height - groundY);

  // Stone tile lines
  ctx.strokeStyle = 'rgba(255,255,255,0.12)';
  ctx.lineWidth = 1.5;
  for (let x = 20; x < width; x += 62) {
    ctx.beginPath();
    ctx.moveTo(x, groundY);
    ctx.lineTo(x - 16, height);
    ctx.stroke();
  }

  // Metal drainage grate
  const grateW = stage.grateRightX - stage.grateLeftX;
  ctx.fillStyle = '#334155';
  roundRect(ctx, stage.grateLeftX, groundY - 2, grateW, 14, 4);
  ctx.fill();
  ctx.strokeStyle = '#64748b';
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.fillStyle = '#0f172a';
  for (let sx = stage.grateLeftX + 10; sx < stage.grateRightX - 8; sx += 12) {
    ctx.fillRect(sx, groundY + 1, 5, 8);
  }

  // Nozzle markers on grate
  for (const n of world.match.nozzles) {
    const isTarget = n.phase !== 'IDLE';
    const isSurgeWarn = n.phase === 'SURGE_WARN';
    const shakeX = isSurgeWarn ? Math.sin(animTimeSec * 65) * 3 : 0;

    ctx.fillStyle = isSurgeWarn
      ? '#ef4444'
      : n.style === 'angled' && isTarget
        ? '#0ea5e9'
        : isTarget
          ? '#38bdf8'
          : '#475569';
    roundRect(ctx, n.x - 15 + shakeX, groundY - 5, 30, 8, 3);
    ctx.fill();

    // Small angle indicator arrow on nozzle when angled
    if (isTarget && n.style === 'angled') {
      ctx.fillStyle = '#fde047';
      ctx.font = 'bold 10px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(n.tiltDeg > 0 ? '↗' : '↖', n.x, groundY + 9);
    }
  }

  // Auntie corn toss hint on Stage 2 / 4 / Endless
  if (world.auntieNoticeTimerSec > 0) {
    ctx.save();
    ctx.fillStyle = 'rgba(254, 240, 138, 0.94)';
    roundRect(ctx, width / 2 - 86, 94, 172, 24, 12);
    ctx.fill();
    ctx.fillStyle = '#92400e';
    ctx.font = '800 11.5px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('👵 大妈撒出闪亮玉米粒！', width / 2, 106);
    ctx.restore();
  }
}

function drawSingleFountainJet(
  ctx: CanvasRenderingContext2D,
  n: FountainSlotState,
  t: Tuning,
  animTimeSec: number,
): void {
  if (n.phase === 'IDLE') return;
  const groundY = t.scene.groundY;
  const nx = n.x;

  if (n.phase === 'WARNING') {
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

  if (n.phase === 'ACTIVE') {
    const jetLen = 128;
    const tiltRad = (n.tiltDeg * Math.PI) / 180;
    const baseLean =
      n.style === 'angled'
        ? Math.sin(tiltRad) * jetLen
        : n.lateralDir * (n.lateralStrength / t.fountain.lateralPushMax) * 14;
    const topX = nx + baseLean;
    const topY = groundY - Math.cos(tiltRad) * jetLen;

    const grad = ctx.createLinearGradient(nx, groundY, topX, topY);
    grad.addColorStop(
      0,
      n.style === 'angled' ? 'rgba(14, 165, 233, 0.92)' : 'rgba(56, 189, 248, 0.85)',
    );
    grad.addColorStop(0.6, 'rgba(186, 230, 253, 0.8)');
    grad.addColorStop(1, 'rgba(255, 255, 255, 0.2)');
    ctx.fillStyle = grad;

    ctx.beginPath();
    ctx.moveTo(nx - 13, groundY - 2);
    ctx.quadraticCurveTo(nx - 10 + baseLean * 0.48, (groundY + topY) / 2, topX - 20, topY);
    ctx.lineTo(topX + 20, topY);
    ctx.quadraticCurveTo(nx + 10 + baseLean * 0.48, (groundY + topY) / 2, nx + 13, groundY - 2);
    ctx.closePath();
    ctx.fill();

    // Inner foam stream
    ctx.fillStyle = 'rgba(255,255,255,0.68)';
    ctx.beginPath();
    ctx.moveTo(nx - 5, groundY - 2);
    ctx.lineTo(topX - 7, topY + 22);
    ctx.lineTo(topX + 7, topY + 22);
    ctx.lineTo(nx + 5, groundY - 2);
    ctx.closePath();
    ctx.fill();
    return;
  }

  if (n.phase === 'SURGE_WARN') {
    const flash = Math.sin(animTimeSec * 28) > 0;
    ctx.save();
    ctx.translate(nx, groundY);
    ctx.rotate((n.tiltDeg * Math.PI) / 180);
    ctx.fillStyle = flash ? 'rgba(239, 68, 68, 0.38)' : 'rgba(251, 146, 60, 0.25)';
    ctx.fillRect(-25, -95, 50, 95);
    ctx.restore();

    ctx.save();
    ctx.translate(nx, groundY - 115 + Math.sin(animTimeSec * 22) * 4);
    ctx.fillStyle = '#ef4444';
    ctx.beginPath();
    ctx.arc(0, 0, 15, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = '900 19px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('!', 0, 1);
    ctx.restore();
    return;
  }

  if (n.phase === 'SURGE') {
    ctx.save();
    ctx.translate(nx, groundY);
    ctx.rotate((n.tiltDeg * Math.PI) / 180);
    const grad = ctx.createLinearGradient(0, 0, 0, -400);
    grad.addColorStop(0, 'rgba(14, 165, 233, 0.96)');
    grad.addColorStop(0.5, 'rgba(186, 230, 253, 0.92)');
    grad.addColorStop(1, 'rgba(255, 255, 255, 0.6)');
    ctx.fillStyle = grad;
    ctx.fillRect(-24, -400, 48, 400);
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.fillRect(-10, -400, 20, 400);
    ctx.restore();
  }
}

function drawPropsAndPickups(
  ctx: CanvasRenderingContext2D,
  world: PigeonFountainWorld,
  animTimeSec: number,
): void {
  for (const prop of world.props) {
    if (!prop.intact) {
      // Subtle smashed debris shadow + respawn timer ring in endless
      ctx.save();
      ctx.fillStyle = 'rgba(15, 23, 42, 0.24)';
      ctx.beginPath();
      ctx.ellipse(prop.x, prop.y + prop.h / 2 - 4, prop.w * 0.45, 5, 0, 0, Math.PI * 2);
      ctx.fill();
      if (world.stage.propRespawnSec !== null && prop.respawnTimerSec > 0) {
        ctx.fillStyle = 'rgba(255,255,255,0.75)';
        ctx.font = 'bold 10px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`${Math.ceil(prop.respawnTimerSec)}s`, prop.x, prop.y + 4);
      }
      ctx.restore();
      continue;
    }

    ctx.save();
    ctx.translate(prop.x, prop.y);
    const hw = prop.w / 2;
    const hh = prop.h / 2;

    if (prop.kind === 'cup_tower') {
      // Trash bin base + stacked paper cups
      ctx.fillStyle = '#475569';
      roundRect(ctx, -hw + 2, 2, prop.w - 4, hh - 2, 4);
      ctx.fill();
      ctx.fillStyle = '#94a3b8';
      ctx.fillRect(-hw, 0, prop.w, 5);
      // 3 stacked paper cups on top
      for (const [cx, cy] of [
        [-7, -10],
        [7, -10],
        [0, -22],
      ]) {
        ctx.fillStyle = '#ffffff';
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 1.5;
        ctx.fillRect(cx - 5, cy - 6, 10, 11);
        ctx.strokeRect(cx - 5, cy - 6, 10, 11);
      }
    } else if (prop.kind === 'melon_stall') {
      // Wooden crate + plump sunflower seed bags
      ctx.fillStyle = '#b45309';
      roundRect(ctx, -hw, 0, prop.w, hh, 4);
      ctx.fill();
      ctx.strokeStyle = '#78350f';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      // Seed sacks
      ctx.fillStyle = '#fde047';
      ctx.beginPath();
      ctx.ellipse(-7, -8, 9, 11, -0.1, 0, Math.PI * 2);
      ctx.ellipse(8, -9, 9, 12, 0.1, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#92400e';
      ctx.font = 'bold 9px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('瓜子', 0, 14);
    } else if (prop.kind === 'balloon_cart') {
      // Cute vendor cart + 3 bobbing colorful balloons
      ctx.fillStyle = '#e11d48';
      roundRect(ctx, -hw + 2, 4, prop.w - 4, hh - 8, 5);
      ctx.fill();
      ctx.fillStyle = '#0f172a';
      ctx.beginPath();
      ctx.arc(-8, hh - 2, 5, 0, Math.PI * 2);
      ctx.arc(8, hh - 2, 5, 0, Math.PI * 2);
      ctx.fill();
      const bob = Math.sin(animTimeSec * 4) * 2.5;
      for (const [bx, by, col] of [
        [-9, -15 + bob, '#facc15'],
        [8, -14 - bob, '#38bdf8'],
        [0, -24 + bob * 0.6, '#f43f5e'],
      ] as const) {
        ctx.strokeStyle = '#cbd5e1';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, 4);
        ctx.lineTo(bx, by + 7);
        ctx.stroke();
        ctx.fillStyle = col;
        ctx.beginPath();
        ctx.ellipse(bx, by, 7, 8.5, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    } else {
      // coffee_rack: trendy takeaway coffee cup stand
      ctx.fillStyle = '#78350f';
      roundRect(ctx, -hw + 3, -6, prop.w - 6, hh + 6, 4);
      ctx.fill();
      for (const [cx, cy] of [
        [-7, -14],
        [7, -14],
        [0, -2],
      ]) {
        ctx.fillStyle = '#f5e6d3';
        ctx.fillRect(cx - 5, cy - 6, 10, 12);
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(cx - 6, cy - 8, 12, 3);
      }
    }
    ctx.restore();
  }

  // Pickups: corn kernels & melon-seed sparks
  for (const pk of world.pickups) {
    ctx.save();
    ctx.translate(pk.x, pk.y + Math.sin(animTimeSec * 8 + pk.id) * 2.5);
    ctx.fillStyle = pk.kind === 'corn' ? '#facc15' : '#fb923c';
    ctx.strokeStyle = '#fef08a';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.arc(0, 0, pk.kind === 'corn' ? 7 : 5.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 9px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(pk.kind === 'corn' ? '🌽' : '✦', 0, 0.5);
    ctx.restore();
  }
}

function drawBird(
  ctx: CanvasRenderingContext2D,
  opts: {
    x: number;
    y: number;
    facing: -1 | 1;
    spinRad: number;
    waddlePhase: number;
    squashX: number;
    squashY: number;
    kind: 'player' | 'white_pigeon' | 'sparrow' | 'red_crest';
    expression: PlayerExpression | 'grumpy' | 'stunned' | 'charge' | 'launched';
    bumpActive: boolean;
    stunned: boolean;
    redCrestChargeRatio: number;
    animTimeSec: number;
  },
): void {
  const scale = opts.kind === 'sparrow' ? 0.72 : 1;

  ctx.save();
  const waddleTilt = opts.spinRad !== 0 ? 0 : Math.sin(opts.waddlePhase) * 0.08;
  ctx.translate(opts.x, opts.y - 20 * scale);
  ctx.rotate(opts.spinRad + waddleTilt);
  ctx.scale(opts.facing * opts.squashX * scale, opts.squashY * scale);

  // Red-crest charge aura
  if (opts.redCrestChargeRatio > 0) {
    ctx.strokeStyle = `rgba(239, 68, 68, ${0.45 + opts.redCrestChargeRatio * 0.55})`;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, 26 + Math.sin(opts.animTimeSec * 36) * 2, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Legs
  ctx.strokeStyle = opts.kind === 'sparrow' ? '#92400e' : '#f59e0b';
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  const stepA = Math.sin(opts.waddlePhase) * 4;
  ctx.beginPath();
  ctx.moveTo(-5, 14);
  ctx.lineTo(-5 + stepA, 22);
  ctx.moveTo(5, 14);
  ctx.lineTo(5 - stepA, 22);
  ctx.stroke();

  const bodyFill =
    opts.kind === 'player'
      ? '#334155'
      : opts.kind === 'sparrow'
        ? '#b45309'
        : opts.kind === 'red_crest'
          ? '#e2e8f0'
          : '#f8fafc';
  const bodyStroke =
    opts.kind === 'player'
      ? '#0f172a'
      : opts.kind === 'sparrow'
        ? '#78350f'
        : opts.kind === 'red_crest'
          ? '#ef4444'
          : '#94a3b8';

  // Tail feathers
  ctx.fillStyle =
    opts.kind === 'player' ? '#1e293b' : opts.kind === 'sparrow' ? '#78350f' : '#cbd5e1';
  ctx.beginPath();
  ctx.ellipse(-20, 4, 10, 6, -0.35, 0, Math.PI * 2);
  ctx.fill();

  // Body
  ctx.fillStyle = bodyFill;
  ctx.strokeStyle = bodyStroke;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(0, 2, 22, 16, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Wing accent
  ctx.fillStyle =
    opts.kind === 'player'
      ? '#475569'
      : opts.kind === 'sparrow'
        ? '#d97706'
        : opts.kind === 'red_crest'
          ? '#cbd5e1'
          : '#e2e8f0';
  ctx.beginPath();
  ctx.ellipse(-3, 3, 13, 8, -0.15, 0, Math.PI * 2);
  ctx.fill();

  if (opts.kind === 'player') {
    const neck = ctx.createLinearGradient(4, -18, 16, -2);
    neck.addColorStop(0, '#a855f7');
    neck.addColorStop(1, '#10b981');
    ctx.fillStyle = neck;
    ctx.beginPath();
    ctx.ellipse(9, -7, 8, 6, 0.2, 0, Math.PI * 2);
    ctx.fill();
  }

  // Head
  ctx.fillStyle =
    opts.kind === 'player'
      ? '#334155'
      : opts.kind === 'sparrow'
        ? '#b45309'
        : '#ffffff';
  ctx.strokeStyle = bodyStroke;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(11, -14, 11.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Red crest ahoge on red_crest pigeon!
  if (opts.kind === 'red_crest') {
    ctx.fillStyle = '#ef4444';
    ctx.beginPath();
    ctx.moveTo(8, -24);
    ctx.lineTo(14, -35);
    ctx.lineTo(17, -25);
    ctx.lineTo(22, -31);
    ctx.lineTo(19, -22);
    ctx.closePath();
    ctx.fill();
  }

  // Beak
  ctx.fillStyle = opts.kind === 'sparrow' ? '#fde047' : '#f59e0b';
  ctx.beginPath();
  ctx.moveTo(21, -16);
  ctx.lineTo(29, -13);
  ctx.lineTo(21, -10);
  ctx.closePath();
  ctx.fill();

  // Expressions
  ctx.strokeStyle = opts.kind === 'player' ? '#f8fafc' : '#0f172a';
  ctx.fillStyle = opts.kind === 'player' ? '#f8fafc' : '#0f172a';
  ctx.lineWidth = 2;

  if (opts.expression === 'bliss') {
    ctx.beginPath();
    ctx.arc(13, -15, 3.2, Math.PI * 1.1, Math.PI * 1.9);
    ctx.stroke();
    ctx.fillStyle = 'rgba(251, 113, 133, 0.55)';
    ctx.beginPath();
    ctx.arc(9, -10, 3, 0, Math.PI * 2);
    ctx.fill();
  } else if (opts.expression === 'panic' || opts.expression === 'jump') {
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(13, -15, 4.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.arc(13.8, -15, 1.8, 0, Math.PI * 2);
    ctx.fill();
  } else if (opts.expression === 'launched') {
    ctx.beginPath();
    ctx.moveTo(10, -18);
    ctx.lineTo(16, -12);
    ctx.moveTo(16, -18);
    ctx.lineTo(10, -12);
    ctx.stroke();
  } else if (opts.expression === 'stunned') {
    // > □ < dizzy face!
    ctx.beginPath();
    ctx.moveTo(10, -18);
    ctx.lineTo(15, -15);
    ctx.lineTo(10, -12);
    ctx.stroke();
  } else if (opts.expression === 'grumpy' || opts.expression === 'charge') {
    // Ò ▲ Ó angry brows
    ctx.fillStyle = opts.kind === 'red_crest' ? '#dc2626' : '#0f172a';
    ctx.beginPath();
    ctx.arc(13, -14, 2.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#0f172a';
    ctx.beginPath();
    ctx.moveTo(8, -20);
    ctx.lineTo(18, -16);
    ctx.stroke();
  } else {
    ctx.beginPath();
    ctx.moveTo(9, -15);
    ctx.lineTo(17, -15);
    ctx.stroke();
  }

  if (opts.bumpActive) {
    ctx.strokeStyle = '#fde047';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(24, 0, 14, -0.8, 0.8);
    ctx.stroke();
  }

  ctx.restore();

  // Overhead dizzy ring (> □ <) when stunned!
  if (opts.stunned) {
    ctx.save();
    ctx.translate(opts.x, opts.y - 44 * scale);
    ctx.strokeStyle = '#facc15';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.ellipse(0, 0, 14 * scale, 4.5, 0, 0, Math.PI * 2);
    ctx.stroke();
    for (let i = 0; i < 3; i++) {
      const a = opts.animTimeSec * 7 + (i * Math.PI * 2) / 3;
      ctx.fillStyle = '#fde047';
      ctx.beginPath();
      ctx.arc(Math.cos(a) * 14 * scale, Math.sin(a) * 4.5, 2.3, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 2.5;
    ctx.font = '900 10px sans-serif';
    ctx.textAlign = 'center';
    ctx.strokeText('> □ <', 0, -8);
    ctx.fillText('> □ <', 0, -8);
    ctx.restore();
  }
}

function drawParticlesShockwavesAndFloats(
  ctx: CanvasRenderingContext2D,
  world: PigeonFountainWorld,
): void {
  for (const sw of world.shockwaves) {
    const alpha = Math.max(0, sw.life / sw.maxLife);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = sw.color;
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.ellipse(sw.x, sw.y, sw.r, sw.r * 0.28, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

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
    } else if (p.kind === 'cup' || p.kind === 'coffee') {
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.r * 0.7, -p.r, p.r * 1.4, p.r * 2);
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
    ctx.font = `900 ${Math.round(17 * f.scale)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 4;
    ctx.strokeText(f.text, f.x, f.y);
    ctx.fillStyle = f.color;
    ctx.fillText(f.text, f.x, f.y);
    ctx.restore();
  }
}

function drawCircleSkillButton(
  ctx: CanvasRenderingContext2D,
  opts: {
    x: number;
    y: number;
    r: number;
    title: string;
    subtitle: string;
    cooldownRatio: number;
    readyFill: string;
    readyStroke: string;
    textColor: string;
  },
): void {
  const ready = opts.cooldownRatio <= 0.001;
  ctx.save();
  ctx.beginPath();
  ctx.arc(opts.x, opts.y, opts.r, 0, Math.PI * 2);
  ctx.fillStyle = ready ? opts.readyFill : '#334155';
  ctx.fill();
  ctx.strokeStyle = ready ? opts.readyStroke : '#64748b';
  ctx.lineWidth = 2.5;
  ctx.stroke();

  if (!ready) {
    // Sector recovery animation
    const progress = 1 - Math.min(1, Math.max(0, opts.cooldownRatio));
    ctx.save();
    ctx.beginPath();
    ctx.arc(opts.x, opts.y, opts.r - 2, 0, Math.PI * 2);
    ctx.clip();
    ctx.fillStyle = 'rgba(245, 158, 11, 0.36)';
    ctx.beginPath();
    ctx.moveTo(opts.x, opts.y);
    ctx.arc(
      opts.x,
      opts.y,
      opts.r,
      -Math.PI / 2,
      -Math.PI / 2 + progress * Math.PI * 2,
    );
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // Outer recovery arc
    ctx.strokeStyle = opts.readyFill;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(
      opts.x,
      opts.y,
      opts.r,
      -Math.PI / 2,
      -Math.PI / 2 + progress * Math.PI * 2,
    );
    ctx.stroke();
  }

  ctx.fillStyle = ready ? opts.textColor : '#f8fafc';
  ctx.font = '900 12px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(opts.title, opts.x, opts.y - 6);
  ctx.font = '700 10px sans-serif';
  ctx.fillText(opts.subtitle, opts.x, opts.y + 10);
  ctx.restore();
}

function drawHudAndControls(
  ctx: CanvasRenderingContext2D,
  world: PigeonFountainWorld,
  extra: RenderExtra,
  t: Tuning,
): void {
  const { width } = t.view;
  const { match, combo, stage } = world;
  const hud = t.ui.hud;

  // Top HUD bar
  ctx.fillStyle = 'rgba(15, 23, 42, 0.84)';
  roundRect(ctx, hud.bar.x, hud.bar.y, hud.bar.w, hud.bar.h, hud.bar.r);
  ctx.fill();

  // Countdown
  ctx.fillStyle = match.remainingSec <= 10 ? '#fca5a5' : '#ffffff';
  ctx.font = '800 17px sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(`${Math.ceil(match.remainingSec)}s`, 24, 36);

  // 3 feathers
  for (let i = 0; i < t.scoring.maxFeathers; i++) {
    drawFeatherIcon(ctx, 76 + i * 20, 36, i < match.feathers);
  }

  // Score (+ target in stage mode)
  ctx.fillStyle = '#fde047';
  ctx.font = '800 16px sans-serif';
  ctx.textAlign = 'right';
  const scoreText =
    match.mode === 'stage'
      ? `${Math.floor(match.score)}/${stage.targetScore}`
      : `${Math.floor(match.score)}分`;
  ctx.fillText(scoreText, 294, 36);

  // Mute button
  ctx.fillStyle = 'rgba(255,255,255,0.14)';
  ctx.beginPath();
  ctx.arc(hud.muteBtn.x, hud.muteBtn.y, hud.muteBtn.r, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.font = '13px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(extra.muted ? '🔇' : '🔊', hud.muteBtn.x, hud.muteBtn.y + 1);

  // Pause button
  ctx.fillStyle = 'rgba(255,255,255,0.16)';
  ctx.beginPath();
  ctx.arc(hud.pauseBtn.x, hud.pauseBtn.y, hud.pauseBtn.r, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(hud.pauseBtn.x - 4.5, hud.pauseBtn.y - 5.5, 3, 11);
  ctx.fillRect(hud.pauseBtn.x + 1.5, hud.pauseBtn.y - 5.5, 3, 11);

  // Stage label + Combo pill row under HUD
  ctx.fillStyle = 'rgba(15, 23, 42, 0.72)';
  roundRect(ctx, 14, 65, 118, 22, 11);
  ctx.fill();
  ctx.fillStyle = '#e2e8f0';
  ctx.font = '700 11px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(stage.shortName, 73, 76);

  if (combo > 1) {
    ctx.fillStyle = combo === 3 ? '#f97316' : '#38bdf8';
    roundRect(ctx, width - 86, 65, 72, 22, 11);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = '800 12px sans-serif';
    ctx.fillText(`舒爽 ×${combo}`, width - 50, 76);
  }

  if (extra.screenMode !== 'playing' && extra.screenMode !== 'paused') return;

  // Dual-thumb controls at bottom!
  const ctrl = t.ui.controls;

  // Left / Right buttons
  for (const [btn, label, active] of [
    [ctrl.leftBtn, '◀', extra.leftPressed],
    [ctrl.rightBtn, '▶', extra.rightPressed],
  ] as const) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(btn.x, btn.y, btn.r, 0, Math.PI * 2);
    ctx.fillStyle = active ? '#38bdf8' : 'rgba(15, 23, 42, 0.56)';
    ctx.fill();
    ctx.strokeStyle = active ? '#e0f2fe' : 'rgba(255,255,255,0.42)';
    ctx.lineWidth = 2.2;
    ctx.stroke();
    ctx.fillStyle = '#ffffff';
    ctx.font = '900 18px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, btn.x, btn.y + 1);
    ctx.restore();
  }

  // Subtle center key hint
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.font = '600 10.5px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('A/D 移动 · W 小跳 · Space 猛顶', 188, 624);

  // Jump button (小跳 W)
  const jumpCdRatio = world.player.jumpCooldownSec / t.pigeon.jumpCooldownSec;
  drawCircleSkillButton(ctx, {
    x: ctrl.jumpBtn.x,
    y: ctrl.jumpBtn.y,
    r: ctrl.jumpBtn.r,
    title: '小跳',
    subtitle: jumpCdRatio <= 0.001 ? '(W)' : '回气中...',
    cooldownRatio: jumpCdRatio,
    readyFill: '#38bdf8',
    readyStroke: '#bae6fd',
    textColor: '#0f172a',
  });

  // Bump button (肥臀猛顶 Space) -> "回气中..." when cooling!
  const bumpCdRatio = world.player.bumpCooldownSec / t.pigeon.bumpCooldownSec;
  drawCircleSkillButton(ctx, {
    x: ctrl.bumpBtn.x,
    y: ctrl.bumpBtn.y,
    r: ctrl.bumpBtn.r,
    title: bumpCdRatio <= 0.001 ? '肥臀猛顶' : '回气中...',
    subtitle: bumpCdRatio <= 0.001 ? '(Space)' : `${world.player.bumpCooldownSec.toFixed(1)}s`,
    cooldownRatio: bumpCdRatio,
    readyFill: '#f59e0b',
    readyStroke: '#fef08a',
    textColor: '#0f172a',
  });
}

function drawTitleOverlay(
  ctx: CanvasRenderingContext2D,
  extra: RenderExtra,
  t: Tuning,
): void {
  const { width, height } = t.view;
  const ui = t.ui.title;
  const stage = STAGES[extra.selectedStageId];

  ctx.fillStyle = 'rgba(15, 23, 42, 0.58)';
  ctx.fillRect(0, 0, width, height);

  ctx.fillStyle = '#ffffff';
  roundRect(ctx, ui.card.x, ui.card.y, ui.card.w, ui.card.h, ui.card.r);
  ctx.fill();

  ctx.fillStyle = '#0f172a';
  ctx.font = '900 24px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('坏鸽子抢喷泉 V2.0', width / 2, 92);

  ctx.fillStyle = '#64748b';
  ctx.font = '600 12px sans-serif';
  ctx.fillText('怒鸟式弹射破坏 · 双拇指抢泉大乱斗', width / 2, 118);

  // Mode toggle tabs
  for (const [btn, label, active] of [
    [ui.modeStageBtn, '闯关霸占 (4关)', extra.gameMode === 'stage'],
    [ui.modeEndlessBtn, '无尽大乱斗', extra.gameMode === 'endless'],
  ] as const) {
    ctx.fillStyle = active ? '#0ea5e9' : '#f1f5f9';
    roundRect(ctx, btn.x, btn.y, btn.w, btn.h, btn.r);
    ctx.fill();
    ctx.fillStyle = active ? '#ffffff' : '#475569';
    ctx.font = '800 13px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, btn.x + btn.w / 2, btn.y + btn.h / 2);
  }

  if (extra.gameMode === 'stage') {
    // 4 stage cards
    const ids: StageId[] = [1, 2, 3, 4];
    ids.forEach((sid, idx) => {
      const sx = ui.stageCardStartX + idx * (ui.stageCardW + ui.stageCardGap);
      const sy = ui.stageCardY;
      const unlocked = sid <= extra.progress.unlockedStage;
      const selected = sid === extra.selectedStageId;
      const stars = extra.progress.stars[sid];

      ctx.fillStyle = selected ? '#e0f2fe' : unlocked ? '#f8fafc' : '#e2e8f0';
      roundRect(ctx, sx, sy, ui.stageCardW, ui.stageCardH, 12);
      ctx.fill();
      ctx.strokeStyle = selected ? '#0284c7' : unlocked ? '#cbd5e1' : '#94a3b8';
      ctx.lineWidth = selected ? 2.5 : 1.5;
      ctx.stroke();

      ctx.fillStyle = unlocked ? '#0f172a' : '#64748b';
      ctx.font = '800 12.5px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`第 ${sid} 关`, sx + ui.stageCardW / 2, sy + 18);

      ctx.font = '600 10px sans-serif';
      ctx.fillStyle = '#475569';
      ctx.fillText(
        STAGES[sid].shortName.replace(/^\d+\.\s*/, ''),
        sx + ui.stageCardW / 2,
        sy + 36,
        ui.stageCardW - 8,
      );

      if (unlocked) {
        const starStr = '★'.repeat(stars) + '☆'.repeat(3 - stars);
        ctx.fillStyle = stars > 0 ? '#f59e0b' : '#94a3b8';
        ctx.font = 'bold 12px sans-serif';
        ctx.fillText(starStr, sx + ui.stageCardW / 2, sy + 56, ui.stageCardW - 10);

        const best = extra.progress.stageBestScores[sid];
        ctx.fillStyle = '#64748b';
        ctx.font = '700 9.5px sans-serif';
        ctx.fillText(
          best > 0 ? `最高 ${best}` : `目标 ${STAGES[sid].targetScore}`,
          sx + ui.stageCardW / 2,
          sy + 77,
          ui.stageCardW - 10,
        );
      } else {
        ctx.fillStyle = '#64748b';
        ctx.font = '700 11.5px sans-serif';
        ctx.fillText('🔒 未解锁', sx + ui.stageCardW / 2, sy + 64, ui.stageCardW - 8);
      }
    });

    // Selected stage info box
    ctx.fillStyle = '#f8fafc';
    roundRect(ctx, 38, 308, width - 76, 58, 12);
    ctx.fill();
    ctx.fillStyle = '#0f172a';
    ctx.font = '800 13px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`${stage.title}（目标 ${stage.targetScore} 分）`, 50, 328);
    ctx.fillStyle = '#64748b';
    ctx.font = '500 11.5px sans-serif';
    ctx.fillText(stage.subtitle, 50, 348);
  } else {
    // Endless info box
    ctx.fillStyle = '#fef3c7';
    roundRect(ctx, 38, 204, width - 76, 152, 16);
    ctx.fill();
    ctx.fillStyle = '#92400e';
    ctx.font = '900 18px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('60s 无尽广场大乱斗', width / 2, 240);
    ctx.fillStyle = '#78350f';
    ctx.font = '600 12px sans-serif';
    ctx.fillText('5 喷口狂飙 · 道具摧毁 8 秒自动补新', width / 2, 268);
    ctx.fillText('白胖鸽 + 麻雀群 + 红冠鸽同台混战', width / 2, 290);
    ctx.fillStyle = '#d97706';
    ctx.font = '800 15px sans-serif';
    ctx.fillText(`本机最高纪录：${extra.progress.endlessBestScore} 分`, width / 2, 328);
  }

  // Controls guide
  const tips = [
    ['◀ / ▶ 或 A/D', '抗住水压稳住屁股，最高 ×3 舒爽连击'],
    ['小跳 (W)', '跳越对手躲红 !，落喷口触发「铁臀墩坐 +30」'],
    ['肥臀猛顶 (Space)', '顶晕送进红 !/斜喷口，砸塌道具 +120！'],
  ];
  tips.forEach(([title, desc], idx) => {
    const ty = 376 + idx * 38;
    ctx.fillStyle = '#f1f5f9';
    roundRect(ctx, 38, ty, width - 76, 32, 8);
    ctx.fill();
    ctx.fillStyle = '#0f172a';
    ctx.font = '800 10.5px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(title, 46, ty + 16);
    ctx.fillStyle = '#475569';
    ctx.font = '500 10px sans-serif';
    ctx.fillText(desc, 138, ty + 16, width - 182);
  });

  // Start button
  ctx.fillStyle = '#0ea5e9';
  roundRect(ctx, ui.startBtn.x, ui.startBtn.y, ui.startBtn.w, ui.startBtn.h, ui.startBtn.r);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.font = '900 18px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(
    extra.gameMode === 'stage' ? `开始第 ${extra.selectedStageId} 关！` : '进入无尽大乱斗！',
    ui.startBtn.x + ui.startBtn.w / 2,
    ui.startBtn.y + ui.startBtn.h / 2 + 1,
  );
}

function drawPauseOverlay(ctx: CanvasRenderingContext2D, t: Tuning): void {
  const { width, height } = t.view;
  const ui = t.ui.pause;

  ctx.fillStyle = 'rgba(15, 23, 42, 0.68)';
  ctx.fillRect(0, 0, width, height);

  ctx.fillStyle = '#ffffff';
  roundRect(ctx, ui.card.x, ui.card.y, ui.card.w, ui.card.h, ui.card.r);
  ctx.fill();

  ctx.fillStyle = '#0f172a';
  ctx.font = '900 22px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('⏸ 暂停抢泉', width / 2, 212);

  for (const [btn, label, bg, fg] of [
    [ui.resumeBtn, '继续抢泉', '#10b981', '#ffffff'],
    [ui.restartBtn, '重开本局 (R)', '#f59e0b', '#0f172a'],
    [ui.homeBtn, '退出回主页', '#e2e8f0', '#334155'],
  ] as const) {
    ctx.fillStyle = bg;
    roundRect(ctx, btn.x, btn.y, btn.w, btn.h, btn.r);
    ctx.fill();
    ctx.fillStyle = fg;
    ctx.font = '800 16px sans-serif';
    ctx.fillText(label, btn.x + btn.w / 2, btn.y + btn.h / 2 + 1);
  }
}

function drawResultOverlay(
  ctx: CanvasRenderingContext2D,
  world: PigeonFountainWorld,
  extra: RenderExtra,
  t: Tuning,
): void {
  const { width, height } = t.view;
  const { match, stage } = world;
  const ui = t.ui.result;
  const stars =
    match.mode === 'stage' ? evaluateStageStars(match.score, match.endReason, stage) : 0;
  const stageCleared = match.mode === 'stage' && stars >= 1;
  const hasNextStage = stageCleared && match.stageId < 4;

  ctx.fillStyle = 'rgba(15, 23, 42, 0.68)';
  ctx.fillRect(0, 0, width, height);

  ctx.fillStyle = '#ffffff';
  roundRect(ctx, ui.card.x, ui.card.y, ui.card.w, ui.card.h, ui.card.r);
  ctx.fill();

  ctx.fillStyle = '#0f172a';
  ctx.font = '900 22px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const headline =
    match.endReason === 'feathers_zero'
      ? '尾羽掉光啦！'
      : match.mode === 'endless'
        ? '无尽乱斗账单'
        : stageCleared
          ? `第 ${match.stageId} 关制霸成功！`
          : `差一点达到 ${stage.targetScore} 分`;
  ctx.fillText(headline, width / 2, 124);

  if (match.mode === 'stage') {
    const starStr = '★'.repeat(stars) + '☆'.repeat(3 - stars);
    ctx.fillStyle = stars > 0 ? '#f59e0b' : '#94a3b8';
    ctx.font = 'bold 28px sans-serif';
    ctx.fillText(starStr, width / 2, 162);
  }

  ctx.fillStyle = '#ea580c';
  ctx.font = '900 34px sans-serif';
  ctx.fillText(`${Math.floor(match.score)} 分`, width / 2, match.mode === 'stage' ? 204 : 182);

  const bestScore =
    match.mode === 'stage'
      ? Math.max(extra.progress.stageBestScores[match.stageId], Math.floor(match.score))
      : Math.max(extra.progress.endlessBestScore, Math.floor(match.score));

  const rows = [
    ['占领喷泉时长', `${match.soakSec.toFixed(1)} 秒`],
    ['使坏轰飞对手', `${match.sabotageCount} 次`],
    ['道具连锁爆破', `${match.propSmashCount} 次`],
    ['铁臀墩坐 / 最高连击', `${match.slamCount} 次 / ×${match.maxCombo}`],
    ['本关最高纪录', `${bestScore} 分`],
  ];
  rows.forEach(([label, val], idx) => {
    const ry = 246 + idx * 32;
    ctx.fillStyle = '#f8fafc';
    roundRect(ctx, 48, ry - 13, width - 96, 26, 8);
    ctx.fill();
    ctx.fillStyle = '#475569';
    ctx.font = '600 12.5px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(label, 58, ry);
    ctx.fillStyle = '#0f172a';
    ctx.font = '800 13px sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(val, width - 58, ry);
  });

  // Primary button only when there is a next stage; otherwise keep two non-duplicate buttons!
  if (hasNextStage) {
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
    ctx.fillText(
      `下一关：第 ${match.stageId + 1} 关 ▶`,
      ui.primaryBtn.x + ui.primaryBtn.w / 2,
      ui.primaryBtn.y + ui.primaryBtn.h / 2 + 1,
    );
  }

  const leftBtn = hasNextStage ? ui.secondaryLeftBtn : ui.soloLeftBtn;
  const rightBtn = hasNextStage ? ui.secondaryRightBtn : ui.soloRightBtn;

  for (const [btn, label, bg, fg] of [
    [leftBtn, '再来一局 (R)', hasNextStage ? '#f1f5f9' : '#10b981', hasNextStage ? '#0f172a' : '#ffffff'],
    [rightBtn, '返回主页', '#e2e8f0', '#334155'],
  ] as const) {
    ctx.fillStyle = bg;
    roundRect(ctx, btn.x, btn.y, btn.w, btn.h, btn.r);
    ctx.fill();
    ctx.fillStyle = fg;
    ctx.font = hasNextStage ? '800 14px sans-serif' : '900 15px sans-serif';
    ctx.fillText(label, btn.x + btn.w / 2, btn.y + btn.h / 2 + 1);
  }
}

function drawDebugOverlay(
  ctx: CanvasRenderingContext2D,
  world: PigeonFountainWorld,
  t: Tuning,
): void {
  const { groundY } = t.scene;

  // Nozzle core zones & jet vector arrows
  for (const n of world.match.nozzles) {
    ctx.strokeStyle = n.phase !== 'IDLE' ? '#22d3ee' : 'rgba(148,163,184,0.5)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 3]);
    ctx.strokeRect(
      n.x - t.fountain.coreRadiusPx,
      groundY - 58,
      t.fountain.coreRadiusPx * 2,
      62,
    );
    ctx.setLineDash([]);

    // Jet direction vector arrow
    if (n.phase === 'ACTIVE' || n.phase === 'SURGE_WARN' || n.phase === 'SURGE') {
      const rad = (n.tiltDeg * Math.PI) / 180;
      const vx = Math.sin(rad) * 58;
      const vy = -Math.cos(rad) * 58;
      ctx.strokeStyle = n.style === 'angled' ? '#facc15' : '#38bdf8';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(n.x, groundY - 12);
      ctx.lineTo(n.x + vx, groundY - 12 + vy);
      ctx.stroke();
    }
  }

  // Destructible prop collision boxes
  for (const prop of world.props) {
    ctx.strokeStyle = prop.intact ? '#4ade80' : 'rgba(248,113,113,0.45)';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(prop.x - prop.w / 2 - 6, prop.y - prop.h / 2 - 6, prop.w + 12, prop.h + 12);
  }

  // Player collision circle
  ctx.strokeStyle = '#22d3ee';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(world.player.x, world.player.y - 20, t.pigeon.radius, 0, Math.PI * 2);
  ctx.stroke();

  // Rivals collision circles, stun timer, & red-crest charge telegraph lines
  for (const r of world.rivals) {
    if (r.respawnTimerSec > 0) continue;
    ctx.strokeStyle = r.stunTimerSec > 0 ? '#facc15' : '#f472b6';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(r.x, r.y - 20, r.radius, 0, Math.PI * 2);
    ctx.stroke();

    if (r.stunTimerSec > 0) {
      ctx.fillStyle = '#facc15';
      ctx.font = '10px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`stun:${r.stunTimerSec.toFixed(2)}s`, r.x, r.y - 54);
    }

    if (r.archetype === 'red_crest' && (r.redCrestState === 'charging' || r.redCrestState === 'lunging')) {
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 3]);
      ctx.beginPath();
      ctx.moveTo(r.x, r.y - 18);
      ctx.lineTo(r.x + r.redCrestDir * 90, r.y - 18);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  // Info box
  ctx.fillStyle = 'rgba(2, 6, 23, 0.82)';
  ctx.fillRect(10, 92, 260, 44);
  ctx.fillStyle = '#22d3ee';
  ctx.font = '10.5px monospace';
  ctx.textAlign = 'left';
  const activeSummary = world.match.nozzles
    .filter((n) => n.phase !== 'IDLE')
    .map((n) => `#${n.slotIndex}:${n.phase}${n.tiltDeg ? `(${n.tiltDeg}°)` : ''}`)
    .join(' ');
  ctx.fillText(activeSummary || 'all IDLE', 16, 108);
  ctx.fillText(
    `pX=${world.player.x.toFixed(1)} occ=${world.occupant} rivals=${world.rivals.length}`,
    16,
    126,
  );
}

export function drawGameFrame(
  ctx: CanvasRenderingContext2D,
  world: PigeonFountainWorld,
  extra: RenderExtra,
  t: Tuning = tuning,
): void {
  ctx.save();
  const canShake = extra.screenMode === 'playing' && world.shakeMag > 0.2;
  const shakeX = canShake ? (Math.random() - 0.5) * world.shakeMag * 2 : 0;
  const shakeY = canShake ? (Math.random() - 0.5) * world.shakeMag * 2 : 0;
  ctx.translate(shakeX, shakeY);

  drawPlazaBackground(ctx, world, t, extra.animTimeSec);
  drawPropsAndPickups(ctx, world, extra.animTimeSec);

  for (const n of world.match.nozzles) {
    drawSingleFountainJet(ctx, n, t, extra.animTimeSec);
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

  drawBird(ctx, {
    x: world.player.x,
    y: world.player.y,
    facing: world.player.facing,
    spinRad: world.player.spinRad,
    waddlePhase: world.player.waddlePhase,
    squashX: world.player.squashX,
    squashY: world.player.squashY,
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
    drawPauseOverlay(ctx, t);
  } else if (extra.screenMode === 'result') {
    drawResultOverlay(ctx, world, extra, t);
  }
}
