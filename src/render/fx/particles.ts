import type { PigeonFountainWorld } from '../../game/world';

export function drawParticlesShockwavesAndFloats(
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
    ctx.font = `900 ${Math.round(18 * f.scale)}px "PingFang SC", "Microsoft YaHei", sans-serif`;
    ctx.textAlign = 'center';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#2B2B3A';
    ctx.lineWidth = 4.5;
    ctx.strokeText(f.text, f.x, f.y);
    ctx.fillStyle = '#fde047';
    ctx.fillText(f.text, f.x, f.y);
    ctx.restore();
  }
}
