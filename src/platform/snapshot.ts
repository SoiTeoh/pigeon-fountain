export interface PolaroidStampInfo {
  readonly stageTitle: string;
  readonly stars: 0 | 1 | 2 | 3;
  readonly mainCaption: string;
  readonly subCaption: string;
}

/**
 * Renders a white Polaroid snapshot canvas from the live game canvas right at win freeze-frame.
 * Designed as a clean lightweight boundary so WeChat MiniGame can swap to `wx.canvasToTempFilePath`.
 */
export function buildPolaroidCanvas(
  sourceCanvas: HTMLCanvasElement,
  info: PolaroidStampInfo,
): HTMLCanvasElement {
  const outW = 300;
  const outH = 264;
  const pad = 16;
  const photoW = outW - pad * 2;
  const photoH = 176;

  const out = document.createElement('canvas');
  out.width = outW;
  out.height = outH;
  const ctx = out.getContext('2d');
  if (!ctx) return out;

  // Classic warm white Polaroid paper
  ctx.fillStyle = '#fefdf8';
  ctx.fillRect(0, 0, outW, outH);
  ctx.strokeStyle = '#e2e8f0';
  ctx.lineWidth = 2;
  ctx.strokeRect(1, 1, outW - 2, outH - 2);

  // Crop center-lower playfield from sourceCanvas (y: ~120..520 of logical 640)
  const sw = sourceCanvas.width;
  const sh = sourceCanvas.height;
  const cropTop = Math.round(sh * 0.16);
  const cropH = Math.round(sh * 0.68);
  ctx.drawImage(sourceCanvas, 0, cropTop, sw, cropH, pad, pad, photoW, photoH);

  // Inner photo border
  ctx.strokeStyle = 'rgba(15, 23, 42, 0.16)';
  ctx.lineWidth = 1;
  ctx.strokeRect(pad, pad, photoW, photoH);

  // Red/gold stamp badge in corner of photo
  ctx.save();
  ctx.translate(outW - 58, pad + 26);
  ctx.rotate(-0.14);
  ctx.strokeStyle = '#dc2626';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.88)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(-42, -13, 84, 26, 6);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#dc2626';
  ctx.font = '900 11px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(`第${info.stageTitle} ${info.stars}★`, 0, 0.5);
  ctx.restore();

  // Handwritten Polaroid caption area
  ctx.fillStyle = '#0f172a';
  ctx.font = '900 14px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(info.mainCaption, outW / 2, pad + photoH + 26, outW - 24);

  ctx.fillStyle = '#64748b';
  ctx.font = '700 11.5px sans-serif';
  ctx.fillText(info.subCaption, outW / 2, pad + photoH + 49, outW - 24);

  return out;
}

export function downloadPolaroidPng(
  polaroidCanvas: HTMLCanvasElement,
  filename: string,
): boolean {
  try {
    const url = polaroidCanvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    return true;
  } catch {
    return false;
  }
}
