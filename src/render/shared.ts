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

export type HomeSubView = 'home' | 'map' | 'prelevel';

export const HOME_UI = {
  ctaBtn: { x: 54, y: 486, w: 282, h: 58, r: 18 },
  navMapBtn: { x: 34, y: 562, w: 98, h: 46, r: 14 },
  navEndlessBtn: { x: 146, y: 562, w: 98, h: 46, r: 14 },
  navTutorialBtn: { x: 258, y: 562, w: 98, h: 46, r: 14 },
  mapCard: { x: 22, y: 56, w: 346, h: 528, r: 22 },
  mapBackBtn: { x: 36, y: 72, w: 74, h: 32, r: 10 },
  mapChapterTabs: [
    { chapter: 1 as const, label: '1.街角', x: 36, y: 114, w: 102, h: 32, r: 10 },
    { chapter: 2 as const, label: '2.公园', x: 144, y: 114, w: 102, h: 32, r: 10 },
    { chapter: 3 as const, label: '3.商业街', x: 252, y: 114, w: 102, h: 32, r: 10 },
  ] as const,
  mapNodes: [
    { indexInChapter: 1, x: 86, y: 500, r: 26 },
    { indexInChapter: 2, x: 196, y: 472, r: 26 },
    { indexInChapter: 3, x: 300, y: 432, r: 26 },
    { indexInChapter: 4, x: 224, y: 366, r: 26 },
    { indexInChapter: 5, x: 96, y: 326, r: 26 },
    { indexInChapter: 6, x: 186, y: 266, r: 26 },
    { indexInChapter: 7, x: 296, y: 234, r: 26 },
    { indexInChapter: 8, x: 195, y: 188, r: 30 },
  ] as const,
  preCard: { x: 24, y: 92, w: 342, h: 456, r: 22 },
  preBackBtn: { x: 40, y: 110, w: 86, h: 32, r: 10 },
  preStartBtn: { x: 54, y: 466, w: 282, h: 56, r: 16 },
} as const;

export interface PolaroidSnapshot {
  readonly canvas: HTMLCanvasElement;
  readonly caption: string;
  readonly priority: number;
}

export interface RenderExtra {
  readonly screenMode: ScreenMode;
  readonly homeSubView?: HomeSubView;
  readonly mapChapter?: 1 | 2 | 3;
  readonly selectedCampaignLevel?: number;
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
  readonly snapshot?: PolaroidSnapshot | null;
  readonly resultAnimSec?: number;
}

export const COMIC_PALETTE = {
  outline: '#2B2B3A',
  outlineWidth: 3,
  skyApricotTop: '#FFE4C4',
  skyApricotBottom: '#FFF6EB',
  fountainCyan: '#06B6D4',
  fountainBright: '#38BDF8',
  fountainFoam: '#ECFEFF',
  warningTomato: '#EF4444',
  accentMustard: '#FACC15',
  accentBright: '#FDE047',
  highlight: 'rgba(255, 255, 255, 0.38)',
  surfaceWhite: '#FFFDF9',
  inkDark: '#2B2B3A',
  inkMuted: '#64748B',
} as const;

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
    skyTop: '#FBD2A8',
    skyBottom: '#FFF6EA',
    treeColor: '#6EE7B7',
    railTop: '#CBD5E1',
    railBody: '#F1E6D6',
    floorTop: '#A8B1BE',
    floorMid: '#7C8798',
    floorBot: '#475569',
    isNight: false,
  },
  park: {
    skyTop: '#FDE68A',
    skyBottom: '#FFFBEB',
    treeColor: '#4ADE80',
    railTop: '#D6CFC2',
    railBody: '#F3EFE6',
    floorTop: '#B5AFA4',
    floorMid: '#8A8378',
    floorBot: '#57534E',
    isNight: false,
  },
  commercial: {
    skyTop: '#4C336E',
    skyBottom: '#FDBA74',
    treeColor: '#6D28D9',
    railTop: '#94A3B8',
    railBody: '#CBD5E1',
    floorTop: '#808A9B',
    floorMid: '#566073',
    floorBot: '#2B2B3A',
    isNight: true,
  },
  carnival: {
    skyTop: '#2E1E59',
    skyBottom: '#FB7185',
    treeColor: '#4338CA',
    railTop: '#FACC15',
    railBody: '#475569',
    floorTop: '#64748B',
    floorMid: '#475569',
    floorBot: '#2B2B3A',
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
