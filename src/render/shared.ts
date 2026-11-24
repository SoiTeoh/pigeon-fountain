import type { StageThemeId, Tuning } from '../config/tuning';
import type { InputMethod, JoystickVisualState } from '../core/input';
import type { ScreenMode } from '../game/rules';
import type { GameMode, PlayerProgress, StageId } from '../platform/storage';

export interface CameraView {
  readonly x: number;
  readonly y: number;
  readonly zoom: number;
}

export interface ViewportLayout {
  readonly logicalWidth: number;
  readonly logicalHeight: number;
  readonly hudOffsetY: number;
  readonly bottomOffsetY: number;
  readonly overlayOffsetY: number;
  readonly worldBaselineShiftY: number;
}

export function computeViewportLayout(
  logicalHeight: number,
  safeTopPx: number,
  t: Tuning,
): ViewportLayout {
  const clampedH = Math.max(640, Math.min(900, Math.round(logicalHeight)));
  const extraH = clampedH - t.view.height;
  return {
    logicalWidth: t.view.width,
    logicalHeight: clampedH,
    hudOffsetY: Math.max(0, Math.round(safeTopPx)),
    bottomOffsetY: extraH,
    overlayOffsetY: Math.round(extraH / 2),
    worldBaselineShiftY: Math.round(extraH * 0.45),
  };
}

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
  readonly lastInputMethod: InputMethod;
  readonly classicFourButtons: boolean;
  readonly joystick?: JoystickVisualState;
  readonly plugHintText?: string | null;
  readonly showFingerDragHint?: boolean;
  readonly logicalHeight?: number;
  readonly safeTopPx?: number;
  readonly camera?: CameraView;
}

export interface ThemePalette {
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

export const THEME_PALETTES: Record<StageThemeId, ThemePalette> = {
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

export function roundRect(
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

export function drawFeatherIcon(
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
