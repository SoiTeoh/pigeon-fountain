import type { PlayerExpression } from '../../game/world';
import { COMIC_PALETTE } from '../shared';

export interface DrawBirdOptions {
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
  airborne?: boolean;
  sittingOnWater?: boolean;
  wetSlump?: boolean;
}

const BIRD_COLORS: Record<
  DrawBirdOptions['kind'],
  { body: string; head: string; wing: string; tail: string; beak: string }
> = {
  player: {
    body: '#3B4254',
    head: '#3B4254',
    wing: '#525C73',
    tail: '#252A36',
    beak: '#FACC15',
  },
  white_pigeon: {
    body: '#FFFDF9',
    head: '#FFFDF9',
    wing: '#E2E8F0',
    tail: '#CBD5E1',
    beak: '#FB923C',
  },
  sparrow: {
    body: '#C2742B',
    head: '#B45309',
    wing: '#F59E0B',
    tail: '#78350F',
    beak: '#FDE047',
  },
  red_crest: {
    body: '#F1F5F9',
    head: '#FFFDF9',
    wing: '#CBD5E1',
    tail: '#94A3B8',
    beak: '#F97316',
  },
};

export function drawBird(ctx: CanvasRenderingContext2D, opts: DrawBirdOptions): void {
  const scale = opts.kind === 'sparrow' ? 0.74 : 1;
  const cols = BIRD_COLORS[opts.kind];
  const isAir = Boolean(opts.airborne);
  const isSitting = Boolean(opts.sittingOnWater) && !isAir;
  const isWet = Boolean(opts.wetSlump);

  // Idle breathing & 2-frame walk bounce
  const idleBreathe = !isAir && Math.abs(Math.sin(opts.waddlePhase)) < 0.02 ? Math.sin(opts.animTimeSec * 4.2) * 0.035 : 0;
  const walkBob = !isAir && !isSitting ? Math.abs(Math.sin(opts.waddlePhase)) * -2.2 : 0;
  const floatBob = isSitting ? Math.sin(opts.animTimeSec * 8) * 1.8 : 0;

  ctx.save();
  const waddleTilt = opts.spinRad !== 0 ? 0 : Math.sin(opts.waddlePhase) * 0.09;
  ctx.translate(opts.x, opts.y - 21 * scale + walkBob + floatBob);
  ctx.rotate(opts.spinRad + waddleTilt);
  ctx.scale(
    opts.facing * (opts.squashX - idleBreathe * 0.5) * scale,
    (opts.squashY + idleBreathe) * scale,
  );

  // Red-crest charge aura
  if (opts.redCrestChargeRatio > 0) {
    ctx.strokeStyle = `rgba(239, 68, 68, ${0.45 + opts.redCrestChargeRatio * 0.55})`;
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.arc(0, -4, 30 + Math.sin(opts.animTimeSec * 36) * 2.5, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.strokeStyle = COMIC_PALETTE.outline;
  ctx.lineWidth = COMIC_PALETTE.outlineWidth;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  // Legs: 2-frame strut cycle when walking, tucked when sitting/wet, flailing in air
  ctx.strokeStyle = opts.kind === 'sparrow' ? '#92400E' : '#F59E0B';
  ctx.lineWidth = 3.2;
  if (isSitting || isWet) {
    ctx.beginPath();
    ctx.moveTo(-6, 13);
    ctx.lineTo(-9, 18);
    ctx.moveTo(6, 13);
    ctx.lineTo(9, 18);
    ctx.stroke();
  } else {
    const stride = isAir ? Math.sin(opts.animTimeSec * 24) * 5 : Math.sin(opts.waddlePhase) > 0 ? 4.5 : -4.5;
    ctx.beginPath();
    ctx.moveTo(-5, 13);
    ctx.lineTo(-5 + stride, 21);
    ctx.moveTo(5, 13);
    ctx.lineTo(5 - stride, 21);
    ctx.stroke();
  }

  // Tail feathers (3px outline)
  ctx.fillStyle = cols.tail;
  ctx.strokeStyle = COMIC_PALETTE.outline;
  ctx.lineWidth = COMIC_PALETTE.outlineWidth;
  ctx.beginPath();
  ctx.ellipse(-20, 4, 10, 5.5, -0.35, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Plump 1:1 compact comic body (lower half of 1:1 silhouette)
  ctx.fillStyle = cols.body;
  ctx.beginPath();
  ctx.ellipse(-1, 3, 20, 14.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Simple comic highlight on chest/back
  ctx.fillStyle = COMIC_PALETTE.highlight;
  ctx.beginPath();
  ctx.ellipse(2, -3, 10, 4.5, -0.15, 0, Math.PI * 2);
  ctx.fill();

  // Iridescent collar on 黑小坏 (player)
  if (opts.kind === 'player') {
    const neck = ctx.createLinearGradient(0, -14, 14, 2);
    neck.addColorStop(0, '#A855F7');
    neck.addColorStop(1, '#06B6D4');
    ctx.fillStyle = neck;
    ctx.beginPath();
    ctx.ellipse(6, -5, 8.5, 5.5, 0.2, 0, Math.PI * 2);
    ctx.fill();
  }

  // Sparrow bib marking
  if (opts.kind === 'sparrow') {
    ctx.fillStyle = '#FEF3C7';
    ctx.beginPath();
    ctx.ellipse(9, 4, 7.5, 7, 0.1, 0, Math.PI * 2);
    ctx.fill();
  }

  // Big comic 1:1 head (radius 14.5 ≈ body height 29)
  ctx.fillStyle = cols.head;
  ctx.strokeStyle = COMIC_PALETTE.outline;
  ctx.lineWidth = COMIC_PALETTE.outlineWidth;
  ctx.beginPath();
  ctx.arc(8, -14, 14.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Head highlight crescent
  ctx.fillStyle = COMIC_PALETTE.highlight;
  ctx.beginPath();
  ctx.ellipse(4, -22, 6.5, 3, -0.35, 0, Math.PI * 2);
  ctx.fill();

  // Red crest spiky crown
  if (opts.kind === 'red_crest') {
    ctx.fillStyle = COMIC_PALETTE.warningTomato;
    ctx.beginPath();
    ctx.moveTo(4, -26);
    ctx.lineTo(10, -39);
    ctx.lineTo(14, -28);
    ctx.lineTo(20, -35);
    ctx.lineTo(18, -24);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }

  // Chunky comic beak
  ctx.fillStyle = cols.beak;
  ctx.beginPath();
  ctx.moveTo(20, -17);
  ctx.lineTo(30, -13);
  ctx.lineTo(20, -9);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Large comic eye (~1/3 of face diameter = ~5.2px radius on 14.5px head!)
  const eyeX = 12.5;
  const eyeY = -15.5;
  const eyeR = 5.2;

  if (opts.expression === 'launched') {
    // X dizzy eyes when blasted sky-high
    ctx.strokeStyle = opts.kind === 'player' ? '#FFFDF9' : COMIC_PALETTE.outline;
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    ctx.moveTo(eyeX - 4, eyeY - 4);
    ctx.lineTo(eyeX + 4, eyeY + 4);
    ctx.moveTo(eyeX + 4, eyeY - 4);
    ctx.lineTo(eyeX - 4, eyeY + 4);
    ctx.stroke();
  } else if (opts.expression === 'stunned') {
    // > dizzy eye
    ctx.strokeStyle = opts.kind === 'player' ? '#FFFDF9' : COMIC_PALETTE.outline;
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    ctx.moveTo(eyeX - 4, eyeY - 4);
    ctx.lineTo(eyeX + 3, eyeY);
    ctx.lineTo(eyeX - 4, eyeY + 4);
    ctx.stroke();
  } else {
    // Draw big sclera (1/3 face)
    ctx.fillStyle = '#FFFFFF';
    ctx.strokeStyle = COMIC_PALETTE.outline;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(eyeX, eyeY, eyeR, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Pupil
    const pupilOffset = opts.expression === 'charge' ? 1.6 : 1.0;
    ctx.fillStyle = opts.kind === 'red_crest' && opts.expression === 'charge' ? '#DC2626' : COMIC_PALETTE.outline;
    ctx.beginPath();
    ctx.arc(eyeX + pupilOffset, eyeY, opts.expression === 'panic' ? 2.0 : 2.7, 0, Math.PI * 2);
    ctx.fill();

    // Eye sparkle
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(eyeX + pupilOffset - 1, eyeY - 1.2, 0.9, 0, Math.PI * 2);
    ctx.fill();

    // Signature eyelids & brows per character / state
    if (isWet) {
      // Wet soggy half-closed droop + sweat/water drop
      ctx.fillStyle = cols.head;
      ctx.beginPath();
      ctx.arc(eyeX, eyeY, eyeR + 0.5, Math.PI, 0);
      ctx.fill();
      ctx.strokeStyle = COMIC_PALETTE.outline;
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.moveTo(eyeX - eyeR, eyeY);
      ctx.lineTo(eyeX + eyeR, eyeY + 1.5);
      ctx.stroke();
    } else if (opts.expression === 'bliss') {
      // Happy arched squint + rosy cheek
      ctx.fillStyle = cols.head;
      ctx.beginPath();
      ctx.arc(eyeX, eyeY, eyeR + 0.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = opts.kind === 'player' ? '#FFFDF9' : COMIC_PALETTE.outline;
      ctx.lineWidth = 2.6;
      ctx.beginPath();
      ctx.arc(eyeX, eyeY + 1.5, 3.8, Math.PI * 1.1, Math.PI * 1.9);
      ctx.stroke();
      ctx.fillStyle = 'rgba(251, 113, 133, 0.65)';
      ctx.beginPath();
      ctx.arc(eyeX - 4, eyeY + 5.5, 3.2, 0, Math.PI * 2);
      ctx.fill();
    } else if (opts.kind === 'player' && (opts.expression === 'smug' || !isAir)) {
      // 黑小坏 signature: 眯眼坏笑 (mischievous half-lid + smirk!)
      ctx.fillStyle = cols.head;
      ctx.beginPath();
      ctx.rect(eyeX - eyeR - 1, eyeY - eyeR - 1, eyeR * 2 + 2, eyeR * 0.9);
      ctx.fill();
      ctx.strokeStyle = '#FFFDF9';
      ctx.lineWidth = 2.3;
      ctx.beginPath();
      ctx.moveTo(eyeX - eyeR, eyeY - 0.5);
      ctx.lineTo(eyeX + eyeR, eyeY - 1.5);
      ctx.stroke();
      // Wicked little grin at beak corner
      ctx.strokeStyle = COMIC_PALETTE.accentBright;
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.arc(17, -10.5, 3.5, 0.1, 1.3);
      ctx.stroke();
    } else if (opts.kind === 'white_pigeon') {
      // 白胖 signature: 理所当然霸座的傲慢半睁眼 + 粉腮红
      ctx.fillStyle = cols.head;
      ctx.beginPath();
      ctx.rect(eyeX - eyeR - 1, eyeY - eyeR - 1, eyeR * 2 + 2, eyeR * 0.95);
      ctx.fill();
      ctx.strokeStyle = COMIC_PALETTE.outline;
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.moveTo(eyeX - eyeR, eyeY);
      ctx.lineTo(eyeX + eyeR, eyeY);
      ctx.stroke();
      ctx.fillStyle = 'rgba(251, 113, 133, 0.45)';
      ctx.beginPath();
      ctx.arc(eyeX - 3, eyeY + 5.5, 3, 0, Math.PI * 2);
      ctx.fill();
    } else if (opts.kind === 'sparrow') {
      // 麻雀 signature: 贱笑挑眉
      ctx.strokeStyle = COMIC_PALETTE.outline;
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.moveTo(eyeX - 5, eyeY - 6);
      ctx.quadraticCurveTo(eyeX, eyeY - 9, eyeX + 5, eyeY - 5);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(17, -10, 3, 0.2, 1.5);
      ctx.stroke();
    } else if (opts.kind === 'red_crest' || opts.expression === 'grumpy' || opts.expression === 'charge') {
      // 红冠 signature: 怒目倒三角眉
      ctx.strokeStyle = COMIC_PALETTE.outline;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(eyeX - 5.5, eyeY - 6.5);
      ctx.lineTo(eyeX + 5.5, eyeY - 3);
      ctx.stroke();
    }
  }

  // Animated flapping wing (drawn over body so air-flap / wet droop reads super clearly!)
  const flapAngle =
    opts.expression === 'launched' || isAir
      ? Math.sin(opts.animTimeSec * 28) * 0.55 - 0.35
      : isWet
        ? 0.45
        : opts.expression === 'smug'
          ? -0.25 + Math.sin(opts.animTimeSec * 10) * 0.1
          : -0.1;
  ctx.save();
  ctx.translate(-3, 2);
  ctx.rotate(flapAngle);
  ctx.fillStyle = cols.wing;
  ctx.strokeStyle = COMIC_PALETTE.outline;
  ctx.lineWidth = COMIC_PALETTE.outlineWidth;
  ctx.beginPath();
  ctx.ellipse(0, 0, 12.5, 7.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.restore();

  // Impact speed arc during bump
  if (opts.bumpActive) {
    ctx.strokeStyle = COMIC_PALETTE.accentBright;
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.arc(25, -4, 15, -0.8, 0.8);
    ctx.stroke();
  }

  ctx.restore();

  // Overhead dizzy ring (> □ <) when stunned
  if (opts.stunned) {
    ctx.save();
    ctx.translate(opts.x, opts.y - 48 * scale);
    ctx.strokeStyle = COMIC_PALETTE.accentMustard;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(0, 0, 15 * scale, 4.5, 0, 0, Math.PI * 2);
    ctx.stroke();
    for (let i = 0; i < 3; i++) {
      const a = opts.animTimeSec * 7 + (i * Math.PI * 2) / 3;
      ctx.fillStyle = COMIC_PALETTE.accentBright;
      ctx.beginPath();
      ctx.arc(Math.cos(a) * 15 * scale, Math.sin(a) * 4.5, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = COMIC_PALETTE.surfaceWhite;
    ctx.strokeStyle = COMIC_PALETTE.outline;
    ctx.lineWidth = 3;
    ctx.font = '900 10.5px sans-serif';
    ctx.textAlign = 'center';
    ctx.strokeText('> □ <', 0, -9);
    ctx.fillText('> □ <', 0, -9);
    ctx.restore();
  }
}
