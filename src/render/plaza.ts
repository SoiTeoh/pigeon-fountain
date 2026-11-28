import type { AiArchetype, Tuning } from '../config/tuning';
import { STRINGS_ZH } from '../content/strings.zh';
import type { FountainSlotState } from '../game/rules';
import type { PigeonFountainWorld } from '../game/world';
import { drawMiniBirdAvatar } from './hud';
import { COMIC_PALETTE, roundRect, THEME_PALETTES } from './shared';

export function drawButtIcon(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  scale = 1,
  alpha = 1,
): void {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(x, y);
  ctx.scale(scale, scale);

  // Cute comic pigeon-butt sticker with 3px #2B2B3A outline
  ctx.fillStyle = '#fde047';
  ctx.strokeStyle = '#2B2B3A';
  ctx.lineWidth = 2.6;

  ctx.beginPath();
  ctx.ellipse(-5.5, 0, 7.5, 6.2, -0.15, 0, Math.PI * 2);
  ctx.ellipse(5.5, 0, 7.5, 6.2, 0.15, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Center crease
  ctx.beginPath();
  ctx.moveTo(0, -4);
  ctx.quadraticCurveTo(0, 1, 0, 5);
  ctx.stroke();

  // Down arrow indicator
  ctx.fillStyle = '#f97316';
  ctx.beginPath();
  ctx.moveTo(-4, 8);
  ctx.lineTo(4, 8);
  ctx.lineTo(0, 13);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

export function drawLandingMarker(
  ctx: CanvasRenderingContext2D,
  landingX: number,
  groundY: number,
  canPlug: boolean,
  animTimeSec: number,
): void {
  ctx.save();
  if (canPlug) {
    const pulse = 0.5 + 0.5 * Math.sin(animTimeSec * 18);
    ctx.strokeStyle = `rgba(250, 204, 21, ${0.55 + pulse * 0.45})`;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.ellipse(landingX, groundY - 2, 22 + pulse * 4, 7, 0, 0, Math.PI * 2);
    ctx.stroke();
    drawButtIcon(ctx, landingX, groundY - 22 - pulse * 4, 1.05 + pulse * 0.15, 0.75 + pulse * 0.25);
  } else {
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.58)';
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.ellipse(landingX, groundY - 2, 16, 5, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
  }
  ctx.restore();
}

export function drawPlazaBackground(
  ctx: CanvasRenderingContext2D,
  world: PigeonFountainWorld,
  t: Tuning,
  animTimeSec: number,
  cameraOffsetX = 0,
  skyTopExtra = 260,
  groundBotExtra = 380,
): void {
  const { width, height } = t.view;
  const { groundY } = t.scene;
  const { stage } = world;
  const pal = THEME_PALETTES[stage.theme];
  const minX = -160;
  const fullW = width + 320;
  const minY = -skyTopExtra;
  const maxY = height + groundBotExtra;

  // Layer 1 (Far): Sky gradient + clouds/stars + distant skyline (0.25x parallax)
  const sky = ctx.createLinearGradient(0, minY, 0, groundY);
  sky.addColorStop(0, pal.skyTop);
  sky.addColorStop(1, pal.skyBottom);
  ctx.fillStyle = sky;
  ctx.fillRect(minX, minY, fullW, groundY - minY);

  ctx.save();
  ctx.translate(-cameraOffsetX * 0.25, 0);
  if (pal.isNight) {
    // Twinkling stars & distant skyline silhouettes with comic outlines
    ctx.fillStyle = COMIC_PALETTE.accentBright;
    for (const [sx, sy, phase] of [
      [38, 78, 0.2],
      [112, 92, 1.4],
      [186, 68, 2.3],
      [274, 88, 0.9],
      [344, 74, 3.1],
    ]) {
      const r = 1.6 + 0.8 * Math.sin(animTimeSec * 3.2 + phase);
      ctx.beginPath();
      ctx.arc(sx, sy, r, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.fillStyle = stage.theme === 'carnival' ? '#312E81' : '#3B2D5C';
    ctx.strokeStyle = COMIC_PALETTE.outline;
    ctx.lineWidth = COMIC_PALETTE.outlineWidth;
    const buildings = [
      [-60, 96, 64],
      [14, 108, 66],
      [92, 132, 74],
      [182, 94, 62],
      [256, 126, 68],
      [332, 102, 54],
      [396, 114, 64],
    ];
    for (const [bx, bh, bw] of buildings) {
      ctx.fillRect(bx, groundY - 22 - bh, bw, bh);
      ctx.strokeRect(bx, groundY - 22 - bh, bw, bh);
    }
  } else {
    // Far pastel hills + sticker-style outlined clouds
    ctx.fillStyle = stage.theme === 'park' ? '#BBF7D0' : '#FED7AA';
    ctx.strokeStyle = COMIC_PALETTE.outline;
    ctx.lineWidth = COMIC_PALETTE.outlineWidth;
    ctx.beginPath();
    ctx.moveTo(-120, groundY - 22);
    ctx.quadraticCurveTo(60, groundY - 125, 220, groundY - 22);
    ctx.quadraticCurveTo(340, groundY - 110, width + 120, groundY - 22);
    ctx.fill();
    ctx.stroke();

    const cloudShift = (animTimeSec * 8) % (width + 120);
    for (const [cx, cy, r] of [
      [70, 108, 20],
      [250, 86, 24],
    ]) {
      const x = ((cx + cloudShift) % (width + 120)) - 60;
      const puffs: readonly [number, number, number][] = [
        [x - 16, cy + 4, r * 0.68],
        [x + 18, cy + 4, r * 0.72],
        [x, cy - 2, r * 0.92],
      ];
      ctx.fillStyle = COMIC_PALETTE.outline;
      for (const [px, py, pr] of puffs) {
        ctx.beginPath();
        ctx.arc(px, py, pr + 2.6, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = COMIC_PALETTE.surfaceWhite;
      for (const [px, py, pr] of puffs) {
        ctx.beginPath();
        ctx.arc(px, py, pr, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
  ctx.restore();

  // Layer 2 (Mid): Shops, trees, pavilion arch (0.55x parallax) with 3px #2B2B3A outlines
  ctx.save();
  ctx.translate(-cameraOffsetX * 0.55, 0);
  ctx.strokeStyle = COMIC_PALETTE.outline;
  ctx.lineWidth = COMIC_PALETTE.outlineWidth;
  ctx.lineJoin = 'round';
  if (pal.isNight) {
    if (stage.theme === 'commercial') {
      ctx.fillStyle = '#F472B6';
      roundRect(ctx, 100, groundY - 122, 56, 20, 6);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#FFFDF9';
      ctx.font = '900 10px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('CAFE', 128, groundY - 108);

      ctx.fillStyle = COMIC_PALETTE.fountainBright;
      roundRect(ctx, 264, groundY - 114, 52, 20, 6);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = COMIC_PALETTE.outline;
      ctx.fillText('MILK', 290, groundY - 100);
    } else if (stage.theme === 'carnival') {
      ctx.strokeStyle = COMIC_PALETTE.outline;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(-40, 122);
      ctx.quadraticCurveTo(195, 162, width + 40, 122);
      ctx.stroke();
      const bulbColors = [COMIC_PALETTE.accentMustard, '#FB7185', COMIC_PALETTE.fountainBright, '#4ADE80'];
      for (let i = 0; i < 9; i++) {
        const u = (i + 0.5) / 9;
        const lx = u * width;
        const ly = 122 + 40 * 2 * u * (1 - u);
        ctx.fillStyle = bulbColors[i % bulbColors.length];
        ctx.beginPath();
        ctx.arc(lx, ly + 4, 5.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
    }
  } else {
    if (stage.theme === 'neighborhood') {
      // Cozy comic brick facades + striped shop awning + highlight
      for (const [bx, bw, bh] of [
        [14, 80, 126],
        [296, 78, 114],
      ]) {
        ctx.fillStyle = '#FDBA74';
        ctx.fillRect(bx, groundY - 22 - bh, bw, bh);
        ctx.strokeRect(bx, groundY - 22 - bh, bw, bh);
        ctx.fillStyle = '#EA580C';
        ctx.fillRect(bx - 4, groundY - 28 - bh, bw + 8, 12);
        ctx.strokeRect(bx - 4, groundY - 28 - bh, bw + 8, 12);
        ctx.fillStyle = COMIC_PALETTE.accentBright;
        for (const wx of [bx + 14, bx + bw - 30]) {
          ctx.fillRect(wx, groundY - bh + 2, 16, 20);
          ctx.strokeRect(wx, groundY - bh + 2, 16, 20);
          ctx.fillRect(wx, groundY - bh + 34, 16, 20);
          ctx.strokeRect(wx, groundY - bh + 34, 16, 20);
        }
      }
    } else if (stage.theme === 'park') {
      // Park music pavilion arch + festive triangles
      ctx.strokeStyle = COMIC_PALETTE.outline;
      ctx.lineWidth = 7;
      ctx.beginPath();
      ctx.arc(195, groundY - 22, 110, Math.PI, 0);
      ctx.stroke();
      ctx.strokeStyle = COMIC_PALETTE.surfaceWhite;
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.arc(195, groundY - 22, 110, Math.PI, 0);
      ctx.stroke();
    }

    // Comic bushes / trees with 3px #2B2B3A outline + highlight crescent
    for (const [tx, tr] of [
      [-18, 36],
      [58, 38],
      [138, 46],
      [245, 44],
      [335, 38],
      [408, 36],
    ]) {
      ctx.fillStyle = pal.treeColor;
      ctx.strokeStyle = COMIC_PALETTE.outline;
      ctx.lineWidth = COMIC_PALETTE.outlineWidth;
      ctx.beginPath();
      ctx.arc(tx, groundY - 45, tr, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = COMIC_PALETTE.highlight;
      ctx.beginPath();
      ctx.ellipse(tx - tr * 0.25, groundY - 45 - tr * 0.45, tr * 0.42, tr * 0.18, -0.35, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();

  // Layer 3 (Near): Balustrade, ledges, plaza ground, drainage grate (1.0x)
  ctx.fillStyle = pal.railBody;
  ctx.fillRect(minX, groundY - 22, fullW, 22);
  ctx.fillStyle = pal.railTop;
  ctx.fillRect(minX, groundY - 25, fullW, 6);
  ctx.strokeStyle = COMIC_PALETTE.outline;
  ctx.lineWidth = COMIC_PALETTE.outlineWidth;
  ctx.beginPath();
  ctx.moveTo(minX, groundY - 25);
  ctx.lineTo(minX + fullW, groundY - 25);
  ctx.moveTo(minX, groundY - 19);
  ctx.lineTo(minX + fullW, groundY - 19);
  ctx.stroke();

  // Elevated side ledges
  for (const prop of world.props) {
    if (!prop.elevated) continue;
    const ledgeW = 52;
    const ledgeX = prop.side === 'left' ? 4 : width - 4 - ledgeW;
    const ledgeY = prop.y + prop.h / 2;
    ctx.fillStyle = '#64748B';
    roundRect(ctx, ledgeX, ledgeY, ledgeW, 10, 4);
    ctx.fill();
    ctx.strokeStyle = COMIC_PALETTE.outline;
    ctx.lineWidth = 2.5;
    ctx.stroke();
    ctx.fillStyle = COMIC_PALETTE.highlight;
    ctx.fillRect(ledgeX + 4, ledgeY + 2, ledgeW - 8, 3);
  }

  // Wet stone plaza ground
  const floorGrad = ctx.createLinearGradient(0, groundY, 0, maxY);
  floorGrad.addColorStop(0, pal.floorTop);
  floorGrad.addColorStop(0.28, pal.floorMid);
  floorGrad.addColorStop(1, pal.floorBot);
  ctx.fillStyle = floorGrad;
  ctx.fillRect(minX, groundY, fullW, maxY - groundY);
  ctx.strokeStyle = COMIC_PALETTE.outline;
  ctx.lineWidth = COMIC_PALETTE.outlineWidth;
  ctx.beginPath();
  ctx.moveTo(minX, groundY);
  ctx.lineTo(minX + fullW, groundY);
  ctx.stroke();

  // Stone tile lines
  ctx.strokeStyle = 'rgba(255,255,255,0.16)';
  ctx.lineWidth = 1.5;
  for (let x = -104; x < width + 140; x += 62) {
    ctx.beginPath();
    ctx.moveTo(x, groundY);
    ctx.lineTo(x - 24, maxY);
    ctx.stroke();
  }

  // Metal drainage grate with 3px comic outline
  const grateW = stage.grateRightX - stage.grateLeftX;
  ctx.fillStyle = '#475569';
  roundRect(ctx, stage.grateLeftX, groundY - 2, grateW, 14, 5);
  ctx.fill();
  ctx.strokeStyle = COMIC_PALETTE.outline;
  ctx.lineWidth = COMIC_PALETTE.outlineWidth;
  ctx.stroke();

  ctx.fillStyle = COMIC_PALETTE.outline;
  for (let sx = stage.grateLeftX + 10; sx < stage.grateRightX - 8; sx += 12) {
    ctx.fillRect(sx, groundY + 1, 5, 8);
  }

  // Nozzle markers on grate
  for (const n of world.match.nozzles) {
    const isTarget = n.phase !== 'IDLE';
    const isSurgeWarn = n.phase === 'SURGE_WARN';
    const shakeX = isSurgeWarn ? Math.sin(animTimeSec * 65) * 3 : 0;
    const isMoving = world.stage.movingNozzleSlot === n.slotIndex;

    if (isMoving) {
      // Sweeper-bot base with little wheels under moving nozzle
      ctx.fillStyle = '#0F172A';
      ctx.beginPath();
      ctx.arc(n.x - 10 + shakeX, groundY + 4, 4, 0, Math.PI * 2);
      ctx.arc(n.x + 10 + shakeX, groundY + 4, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#38BDF8';
      roundRect(ctx, n.x - 16 + shakeX, groundY - 3, 32, 7, 3);
      ctx.fill();
      ctx.strokeStyle = COMIC_PALETTE.outline;
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    ctx.fillStyle = isSurgeWarn
      ? COMIC_PALETTE.warningTomato
      : n.style === 'angled' && isTarget
        ? COMIC_PALETTE.fountainCyan
        : isTarget
          ? COMIC_PALETTE.fountainBright
          : '#64748B';
    roundRect(ctx, n.x - 15 + shakeX, groundY - 6, 30, 9, 4);
    ctx.fill();
    ctx.strokeStyle = COMIC_PALETTE.outline;
    ctx.lineWidth = 2.4;
    ctx.stroke();

    if (isTarget && n.style === 'angled') {
      ctx.fillStyle = COMIC_PALETTE.accentBright;
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

export function drawUndergroundPlugPipes(
  ctx: CanvasRenderingContext2D,
  nozzles: readonly FountainSlotState[],
  pluggedSlotIndex: number,
  plugRatio: number,
  pluggerKind: 'player' | AiArchetype,
  t: Tuning,
  animTimeSec: number,
): void {
  const src = nozzles[pluggedSlotIndex];
  if (!src) return;
  const groundY = t.scene.groundY;
  const pipeY = groundY + 7;
  const pulse = 0.5 + 0.5 * Math.sin(animTimeSec * (14 + plugRatio * 18));
  const ringColor =
    pluggerKind === 'player'
      ? '#fde047'
      : pluggerKind === 'red_crest'
        ? '#ef4444'
        : pluggerKind === 'sparrow'
          ? '#f59e0b'
          : '#f8fafc';

  for (const adjIdx of [pluggedSlotIndex - 1, pluggedSlotIndex + 1]) {
    const dst = nozzles[adjIdx];
    if (!dst) continue;

    // Glowing underground pipe connecting plugged nozzle to adjacent target nozzle
    ctx.save();
    ctx.strokeStyle = `rgba(56, 189, 248, ${0.45 + pulse * 0.45})`;
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(src.x, pipeY);
    ctx.lineTo(dst.x, pipeY);
    ctx.stroke();

    ctx.strokeStyle = ringColor;
    ctx.lineWidth = 2;
    ctx.setLineDash([8, 6]);
    ctx.lineDashOffset = -animTimeSec * 45 * (dst.x > src.x ? 1 : -1);
    ctx.beginPath();
    ctx.moveTo(src.x, pipeY);
    ctx.lineTo(dst.x, pipeY);
    ctx.stroke();
    ctx.setLineDash([]);

    // Red "!" + plugger avatar next to adjacent nozzle about to surge
    const warnY = groundY - 96 + Math.sin(animTimeSec * 20) * 3;
    ctx.fillStyle = '#ef4444';
    ctx.strokeStyle = '#2B2B3A';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(dst.x - 10, warnY, 13, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.font = '900 16px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('!', dst.x - 10, warnY + 1);

    drawMiniBirdAvatar(ctx, dst.x + 12, warnY, 10, pluggerKind);
    ctx.restore();
  }
}

export function drawSingleFountainJet(
  ctx: CanvasRenderingContext2D,
  n: FountainSlotState,
  t: Tuning,
  animTimeSec: number,
  plugRatio = 0,
  adjacentPlugRatio = 0,
  contested = false,
  pluggerKind: 'player' | AiArchetype = 'player',
): void {
  const groundY = t.scene.groundY;
  const nx = n.x;

  if (n.phase === 'PLUGGED') {
    const pulse = 0.5 + 0.5 * Math.sin(animTimeSec * (16 + plugRatio * 24));
    const ringRgb =
      pluggerKind === 'red_crest'
        ? '239, 68, 68'
        : pluggerKind === 'sparrow'
          ? '245, 158, 11'
          : pluggerKind === 'white_pigeon'
            ? '248, 250, 252'
            : '250, 204, 21';
    ctx.save();
    ctx.strokeStyle = `rgba(${ringRgb}, ${0.55 + pulse * 0.45})`;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.ellipse(nx, groundY - 2, 22 + plugRatio * 8, 7 + plugRatio * 2, 0, 0, Math.PI * 2);
    ctx.stroke();

    // Small pressure gauge arc under plugged nozzle
    ctx.fillStyle = 'rgba(15, 23, 42, 0.72)';
    roundRect(ctx, nx - 20, groundY + 14, 40, 6, 3);
    ctx.fill();
    ctx.fillStyle = `rgb(${ringRgb})`;
    roundRect(ctx, nx - 19, groundY + 15, Math.max(4, 38 * plugRatio), 4, 2);
    ctx.fill();
    ctx.restore();
    return;
  }

  if (adjacentPlugRatio > 0 && n.phase !== 'SURGE') {
    const sprayH = 18 + adjacentPlugRatio * 56;
    const pulse = 0.5 + 0.5 * Math.sin(animTimeSec * 22);
    ctx.save();
    ctx.fillStyle = `rgba(56, 189, 248, ${0.45 + adjacentPlugRatio * 0.4})`;
    ctx.beginPath();
    ctx.moveTo(nx - 10, groundY - 2);
    ctx.lineTo(nx - 14 - adjacentPlugRatio * 6, groundY - sprayH - pulse * 6);
    ctx.lineTo(nx + 14 + adjacentPlugRatio * 6, groundY - sprayH - pulse * 6);
    ctx.lineTo(nx + 10, groundY - 2);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  if (n.phase === 'IDLE') return;

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
    const isAngryWarn = (n.angryWarnTimerSec ?? 0) > 0;
    const isPlugReward = (n.plugRewardTimerSec ?? 0) > 0;
    const angryJitterX = isAngryWarn ? Math.sin(animTimeSec * 70) * 5 : 0;
    const jetLen = 128;
    const tiltRad = (n.tiltDeg * Math.PI) / 180;
    const baseLean =
      n.style === 'angled'
        ? Math.sin(tiltRad) * jetLen
        : n.lateralDir * (n.lateralStrength / t.fountain.lateralPushMax) * 14;
    const topX = nx + baseLean + angryJitterX;
    const topY = groundY - Math.cos(tiltRad) * jetLen;

    const grad = ctx.createLinearGradient(nx + angryJitterX, groundY, topX, topY);
    grad.addColorStop(
      0,
      isAngryWarn
        ? 'rgba(249, 115, 22, 0.92)'
        : n.style === 'angled'
          ? 'rgba(14, 165, 233, 0.92)'
          : 'rgba(56, 189, 248, 0.85)',
    );
    grad.addColorStop(0.6, isAngryWarn ? 'rgba(253, 186, 116, 0.85)' : 'rgba(186, 230, 253, 0.8)');
    grad.addColorStop(1, 'rgba(255, 255, 255, 0.2)');
    ctx.fillStyle = grad;

    ctx.beginPath();
    ctx.moveTo(nx - 13 + angryJitterX, groundY - 2);
    ctx.quadraticCurveTo(nx - 10 + angryJitterX + baseLean * 0.48, (groundY + topY) / 2, topX - 20, topY);
    ctx.lineTo(topX + 20, topY);
    ctx.quadraticCurveTo(nx + 10 + angryJitterX + baseLean * 0.48, (groundY + topY) / 2, nx + 13 + angryJitterX, groundY - 2);
    ctx.closePath();
    ctx.fill();

    if (isPlugReward) {
      ctx.strokeStyle = COMIC_PALETTE.accentBright;
      ctx.lineWidth = 3.5;
      ctx.stroke();
    } else if (isAngryWarn) {
      ctx.strokeStyle = COMIC_PALETTE.warningTomato;
      ctx.lineWidth = 3;
      ctx.stroke();
    } else {
      ctx.strokeStyle = COMIC_PALETTE.outline;
      ctx.lineWidth = 2.4;
      ctx.stroke();
    }

    // Inner foam stream
    ctx.fillStyle = 'rgba(255,255,255,0.68)';
    ctx.beginPath();
    ctx.moveTo(nx - 5, groundY - 2);
    ctx.lineTo(topX - 7, topY + 22);
    ctx.lineTo(topX + 7, topY + 22);
    ctx.lineTo(nx + 5, groundY - 2);
    ctx.closePath();
    ctx.fill();

    if (contested) {
      const jx = Math.sin(animTimeSec * 48) * 3;
      const jy = Math.cos(animTimeSec * 38) * 2;
      ctx.save();
      ctx.translate(topX + jx, topY - 18 + jy);
      ctx.font = '900 22px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.strokeStyle = '#2B2B3A';
      ctx.lineWidth = 5;
      ctx.strokeText(STRINGS_ZH.hud.contested, 0, 0);
      ctx.fillStyle = '#fde047';
      ctx.fillText(STRINGS_ZH.hud.contested, 0, 0);
      ctx.restore();
    }
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

export function drawPropsAndPickups(
  ctx: CanvasRenderingContext2D,
  world: PigeonFountainWorld,
  animTimeSec: number,
): void {
  // Draw destroyed props first so they always stay behind everything
  for (const prop of world.props) {
    if (prop.intact) continue;
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
  }

  for (const prop of world.props) {
    if (!prop.intact) continue;

    const overlapsBird =
      (Math.abs(world.player.x - prop.x) < prop.w * 0.5 + 18 &&
        Math.abs(world.player.y - 16 - prop.y) < prop.h * 0.5 + 18) ||
      world.rivals.some(
        (r) =>
          r.respawnTimerSec <= 0 &&
          Math.abs(r.x - prop.x) < prop.w * 0.5 + 18 &&
          Math.abs(r.y - 16 - prop.y) < prop.h * 0.5 + 18,
      );

    ctx.save();
    if (overlapsBird) {
      ctx.globalAlpha = 0.42;
    }
    ctx.translate(prop.x, prop.y);
    const hw = prop.w / 2;
    const hh = prop.h / 2;

    if (prop.kind === 'cup_tower') {
      ctx.strokeStyle = COMIC_PALETTE.outline;
      ctx.lineWidth = COMIC_PALETTE.outlineWidth;
      ctx.fillStyle = '#475569';
      roundRect(ctx, -hw + 2, 2, prop.w - 4, hh - 2, 4);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#94A3B8';
      ctx.fillRect(-hw, 0, prop.w, 6);
      ctx.strokeRect(-hw, 0, prop.w, 6);
      for (const [cx, cy] of [
        [-7, -10],
        [7, -10],
        [0, -22],
      ]) {
        ctx.fillStyle = COMIC_PALETTE.surfaceWhite;
        ctx.lineWidth = 2.2;
        ctx.fillRect(cx - 5, cy - 6, 10, 11);
        ctx.strokeRect(cx - 5, cy - 6, 10, 11);
      }
    } else if (prop.kind === 'melon_stall') {
      ctx.strokeStyle = COMIC_PALETTE.outline;
      ctx.lineWidth = COMIC_PALETTE.outlineWidth;
      ctx.fillStyle = '#D97706';
      roundRect(ctx, -hw, 0, prop.w, hh, 4);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = COMIC_PALETTE.accentBright;
      ctx.beginPath();
      ctx.ellipse(-7, -8, 9, 11, -0.1, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.ellipse(8, -9, 9, 12, 0.1, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = COMIC_PALETTE.outline;
      ctx.font = '900 9px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('瓜子', 0, 14);
    } else if (prop.kind === 'balloon_cart') {
      ctx.strokeStyle = COMIC_PALETTE.outline;
      ctx.lineWidth = COMIC_PALETTE.outlineWidth;
      ctx.fillStyle = COMIC_PALETTE.warningTomato;
      roundRect(ctx, -hw + 2, 4, prop.w - 4, hh - 8, 5);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = COMIC_PALETTE.outline;
      ctx.beginPath();
      ctx.arc(-8, hh - 2, 5, 0, Math.PI * 2);
      ctx.arc(8, hh - 2, 5, 0, Math.PI * 2);
      ctx.fill();
      const bob = Math.sin(animTimeSec * 4) * 2.5;
      for (const [bx, by, col] of [
        [-9, -15 + bob, COMIC_PALETTE.accentMustard],
        [8, -14 - bob, COMIC_PALETTE.fountainBright],
        [0, -24 + bob * 0.6, '#FB7185'],
      ] as const) {
        ctx.strokeStyle = COMIC_PALETTE.outline;
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(0, 4);
        ctx.lineTo(bx, by + 7);
        ctx.stroke();
        ctx.fillStyle = col;
        ctx.lineWidth = 2.4;
        ctx.beginPath();
        ctx.ellipse(bx, by, 7, 8.5, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
    } else {
      ctx.strokeStyle = COMIC_PALETTE.outline;
      ctx.lineWidth = COMIC_PALETTE.outlineWidth;
      ctx.fillStyle = '#92400E';
      roundRect(ctx, -hw + 3, -6, prop.w - 6, hh + 6, 4);
      ctx.fill();
      ctx.stroke();
      for (const [cx, cy] of [
        [-7, -14],
        [7, -14],
        [0, -2],
      ]) {
        ctx.fillStyle = '#F5E6D3';
        ctx.lineWidth = 2;
        ctx.fillRect(cx - 5, cy - 6, 10, 12);
        ctx.strokeRect(cx - 5, cy - 6, 10, 12);
        ctx.fillStyle = COMIC_PALETTE.outline;
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
