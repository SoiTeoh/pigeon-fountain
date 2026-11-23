import { tuning, type Tuning } from '../config/tuning';
import { PigeonFountainWorld } from '../game/world';
import type { GameMode, StageId } from '../platform/storage';
import { toWorldStepInput, type UnifiedInput } from './input';
import { normalizeSeed } from './rng';

export interface ReplayKeyFrame {
  /** Frame index (0-based) */
  f: number;
  /** moveAxis (-1 | 0 | 1) */
  a: -1 | 0 | 1;
  /** action pressed on this frame */
  act?: 1;
  /** jump pressed on this frame */
  jmp?: 1;
  /** optional rounded moveTargetX */
  tx?: number;
}

export interface ReplayData {
  v: 1;
  mode: GameMode;
  stageId: StageId;
  seed: number;
  totalFrames: number;
  frames: ReplayKeyFrame[];
  finalHash?: string;
}

export class ReplayRecorder {
  readonly mode: GameMode;
  readonly stageId: StageId;
  readonly seed: number;
  private readonly frames: ReplayKeyFrame[] = [];
  private frameIndex = 0;
  private lastAxis: -1 | 0 | 1 = 0;
  private lastTargetX: number | undefined = undefined;

  constructor(mode: GameMode, stageId: StageId, seed: number) {
    this.mode = mode;
    this.stageId = stageId;
    this.seed = normalizeSeed(seed);
  }

  recordFrame(input: UnifiedInput): void {
    const tx = input.moveTargetX === null ? undefined : Math.round(input.moveTargetX);
    const axisChanged = input.moveAxis !== this.lastAxis;
    const targetChanged = tx !== this.lastTargetX;
    const hasImpulse = input.action || input.jump;

    if (axisChanged || targetChanged || hasImpulse) {
      const kf: ReplayKeyFrame = {
        f: this.frameIndex,
        a: input.moveAxis,
      };
      if (input.action) kf.act = 1;
      if (input.jump) kf.jmp = 1;
      if (tx !== undefined) kf.tx = tx;
      this.frames.push(kf);
      this.lastAxis = input.moveAxis;
      this.lastTargetX = tx;
    }

    this.frameIndex += 1;
  }

  finalize(finalHash?: string): ReplayData {
    return {
      v: 1,
      mode: this.mode,
      stageId: this.stageId,
      seed: this.seed,
      totalFrames: this.frameIndex,
      frames: this.frames.map((kf) => ({ ...kf })),
      ...(finalHash ? { finalHash } : {}),
    };
  }
}

export class ReplayPlayer {
  readonly data: ReplayData;
  private cursor = 0;
  private currentAxis: -1 | 0 | 1 = 0;
  private currentTargetX: number | null = null;

  constructor(data: ReplayData) {
    this.data = data;
  }

  reset(): void {
    this.cursor = 0;
    this.currentAxis = 0;
    this.currentTargetX = null;
  }

  getFrameInput(frameIndex: number): UnifiedInput {
    let action = false;
    let jump = false;

    while (this.cursor < this.data.frames.length && this.data.frames[this.cursor].f <= frameIndex) {
      const kf = this.data.frames[this.cursor];
      this.currentAxis = kf.a;
      this.currentTargetX = kf.tx ?? null;
      if (kf.f === frameIndex) {
        if (kf.act === 1) action = true;
        if (kf.jmp === 1) jump = true;
      }
      this.cursor += 1;
    }

    return {
      moveTargetX: this.currentTargetX,
      moveAxis: this.currentAxis,
      action,
      jump,
    };
  }

  isFinished(frameIndex: number): boolean {
    return frameIndex >= this.data.totalFrames;
  }
}

export function runReplay(
  data: ReplayData,
  t: Tuning = tuning,
): { world: PigeonFountainWorld; finalHash: string } {
  const world = new PigeonFountainWorld(data.mode, data.stageId, t, data.seed);
  const player = new ReplayPlayer(data);
  const dtMs = t.loop.fixedDtMs;

  for (let frame = 0; frame < data.totalFrames; frame++) {
    const unified = player.getFrameInput(frame);
    world.step(toWorldStepInput(unified), dtMs);
  }

  return {
    world,
    finalHash: world.getStateHash(),
  };
}

export function serializeReplay(data: ReplayData): string {
  return JSON.stringify(data);
}

export function parseReplay(raw: string): ReplayData {
  const parsed = JSON.parse(raw) as ReplayData;
  if (!parsed || parsed.v !== 1 || !Array.isArray(parsed.frames)) {
    throw new Error('Invalid replay payload');
  }
  return parsed;
}
