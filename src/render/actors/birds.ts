import type { PlayerExpression } from '../../game/world';

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
}

export function drawBird(ctx: CanvasRenderingContext2D, opts: DrawBirdOptions): void {
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
