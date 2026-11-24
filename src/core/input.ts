import { tuning, type Tuning } from '../config/tuning';
import type { WorldStepInput } from '../game/world';

export type InputMethod = 'touch' | 'keyboard';

export interface UnifiedInput {
  readonly moveTargetX: number | null;
  readonly moveAxis: -1 | 0 | 1;
  readonly moveScale?: number;
  readonly stopOnRelease?: boolean;
  readonly action: boolean;
  readonly jump: boolean;
  readonly slam?: boolean;
}

export interface JoystickVisualState {
  readonly active: boolean;
  readonly originX: number;
  readonly originY: number;
  readonly currentX: number;
  readonly currentY: number;
  readonly axis: -1 | 0 | 1;
  readonly scale: number;
}

interface PointerMoveEntry {
  dir: -1 | 0 | 1;
  zoneOnly: boolean;
  targetX: number | null;
}

export function computeJoystickResponse(
  dx: number,
  deadzonePx = tuning.ui.controls.joystickDeadzonePx,
  maxRadiusPx = tuning.ui.controls.joystickMaxRadiusPx,
): { axis: -1 | 0 | 1; scale: number } {
  const absDx = Math.abs(dx);
  if (absDx <= deadzonePx) {
    return { axis: 0, scale: 0 };
  }
  const span = Math.max(1, maxRadiusPx - deadzonePx);
  const linear = Math.min(1, (absDx - deadzonePx) / span);
  const scale = linear * linear; // Smooth quadratic acceleration curve
  return {
    axis: dx > 0 ? 1 : -1,
    scale,
  };
}

export class InputController {
  private readonly movePointers = new Map<number, PointerMoveEntry>();
  private readonly buttonPointers = new Map<number, 'jump' | 'bump'>();
  private readonly heldKeys = new Set<string>();
  private joystickPointerId: number | null = null;
  private joystickOriginX = 0;
  private joystickOriginY = 0;
  private joystickCurrentX = 0;
  private joystickCurrentY = 0;
  private stopRequested = false;

  private actionQueued = false;
  private jumpQueued = false;
  private slamQueued = false;
  private lastInputMethod: InputMethod;
  private readonly t: Tuning;

  constructor(initialMethod: InputMethod = 'touch', t: Tuning = tuning) {
    this.lastInputMethod = initialMethod;
    this.t = t;
  }

  getLastInputMethod(): InputMethod {
    return this.lastInputMethod;
  }

  setInputMethod(method: InputMethod): void {
    this.lastInputMethod = method;
  }

  clear(): void {
    this.movePointers.clear();
    this.buttonPointers.clear();
    this.heldKeys.clear();
    this.joystickPointerId = null;
    this.stopRequested = false;
    this.actionQueued = false;
    this.jumpQueued = false;
    this.slamQueued = false;
  }

  isJoystickActive(): boolean {
    return this.joystickPointerId !== null;
  }

  isDragPointer(pointerId: number): boolean {
    return this.joystickPointerId === pointerId || this.movePointers.has(pointerId);
  }

  startJoystick(pointerId: number, x: number, y: number, pointerType?: string): boolean {
    if (this.joystickPointerId !== null || this.buttonPointers.has(pointerId)) {
      return false;
    }
    if (pointerType === 'touch' || pointerType === 'pen' || pointerType === 'mouse') {
      this.lastInputMethod = 'touch';
    }
    this.joystickPointerId = pointerId;
    this.joystickOriginX = x;
    this.joystickOriginY = y;
    this.joystickCurrentX = x;
    this.joystickCurrentY = y;
    this.stopRequested = false;
    return true;
  }

  updateJoystick(pointerId: number, x: number, y: number): boolean {
    if (this.joystickPointerId !== pointerId) return false;
    const maxR = this.t.ui.controls.joystickMaxRadiusPx;
    if (x - this.joystickOriginX > maxR) {
      this.joystickOriginX = x - maxR;
    } else if (x - this.joystickOriginX < -maxR) {
      this.joystickOriginX = x + maxR;
    }
    this.joystickCurrentX = x;
    this.joystickCurrentY = y;
    return true;
  }

  endPointer(pointerId: number): void {
    if (this.joystickPointerId === pointerId) {
      this.joystickPointerId = null;
      this.stopRequested = true;
    }
    this.movePointers.delete(pointerId);
    this.buttonPointers.delete(pointerId);
  }

  getJoystickVisual(): JoystickVisualState {
    if (this.joystickPointerId === null) {
      return {
        active: false,
        originX: 0,
        originY: 0,
        currentX: 0,
        currentY: 0,
        axis: 0,
        scale: 0,
      };
    }
    const resp = computeJoystickResponse(
      this.joystickCurrentX - this.joystickOriginX,
      this.t.ui.controls.joystickDeadzonePx,
      this.t.ui.controls.joystickMaxRadiusPx,
    );
    return {
      active: true,
      originX: this.joystickOriginX,
      originY: this.joystickOriginY,
      currentX: this.joystickCurrentX,
      currentY: this.joystickCurrentY,
      axis: resp.axis,
      scale: resp.scale,
    };
  }

  tryTriggerButton(
    pointerId: number,
    kind: 'jump' | 'bump',
    isAirborne: boolean,
    pointerType?: string,
  ): boolean {
    if (this.isDragPointer(pointerId) || this.buttonPointers.has(pointerId)) {
      return false;
    }
    this.buttonPointers.set(pointerId, kind);
    if (kind === 'bump') {
      this.queueAction(pointerType);
    } else if (isAirborne) {
      this.queueSlam(pointerType);
    } else {
      this.queueJump(pointerType);
    }
    return true;
  }

  setMovePointer(
    pointerId: number,
    dir: -1 | 0 | 1,
    zoneOnly: boolean,
    targetX: number | null = null,
    pointerType?: string,
  ): void {
    if (pointerType === 'touch' || pointerType === 'pen' || pointerType === 'mouse') {
      this.lastInputMethod = 'touch';
    }
    this.movePointers.set(pointerId, { dir, zoneOnly, targetX });
  }

  updateMovePointer(
    pointerId: number,
    dir: -1 | 0 | 1,
    targetX: number | null = null,
  ): void {
    const entry = this.movePointers.get(pointerId);
    if (!entry) return;
    entry.dir = dir;
    entry.targetX = targetX;
  }

  getMovePointer(pointerId: number): Readonly<PointerMoveEntry> | undefined {
    return this.movePointers.get(pointerId);
  }

  removeMovePointer(pointerId: number): void {
    this.endPointer(pointerId);
  }

  queueAction(pointerType?: string): void {
    if (pointerType === 'touch' || pointerType === 'pen' || pointerType === 'mouse') {
      this.lastInputMethod = 'touch';
    }
    this.actionQueued = true;
  }

  queueJump(pointerType?: string): void {
    if (pointerType === 'touch' || pointerType === 'pen' || pointerType === 'mouse') {
      this.lastInputMethod = 'touch';
    }
    this.jumpQueued = true;
  }

  queueSlam(pointerType?: string): void {
    if (pointerType === 'touch' || pointerType === 'pen' || pointerType === 'mouse') {
      this.lastInputMethod = 'touch';
    }
    this.slamQueued = true;
  }

  onKeyDown(code: string, repeat = false, isAirborne = false): void {
    this.lastInputMethod = 'keyboard';
    if (code === 'Space' && !repeat) {
      this.actionQueued = true;
    } else if ((code === 'KeyW' || code === 'ArrowUp') && !repeat) {
      if (isAirborne) {
        this.slamQueued = true;
      } else {
        this.jumpQueued = true;
      }
    } else if (
      code === 'KeyA' ||
      code === 'ArrowLeft' ||
      code === 'KeyD' ||
      code === 'ArrowRight'
    ) {
      this.heldKeys.add(code);
    }
  }

  onKeyUp(code: string): void {
    this.heldKeys.delete(code);
  }

  peekMove(): { axis: -1 | 0 | 1; scale: number } {
    let dir = 0;
    if (this.heldKeys.has('KeyA') || this.heldKeys.has('ArrowLeft')) dir -= 1;
    if (this.heldKeys.has('KeyD') || this.heldKeys.has('ArrowRight')) dir += 1;
    if (dir !== 0) {
      return { axis: dir < 0 ? -1 : 1, scale: 1 };
    }

    if (this.joystickPointerId !== null) {
      const resp = computeJoystickResponse(
        this.joystickCurrentX - this.joystickOriginX,
        this.t.ui.controls.joystickDeadzonePx,
        this.t.ui.controls.joystickMaxRadiusPx,
      );
      return resp;
    }

    if (this.movePointers.size > 0) {
      let latestDir: -1 | 0 | 1 = 0;
      for (const entry of this.movePointers.values()) {
        latestDir = entry.dir;
      }
      return { axis: latestDir, scale: latestDir === 0 ? 0 : 1 };
    }

    return { axis: 0, scale: 0 };
  }

  peekMoveAxis(): -1 | 0 | 1 {
    return this.peekMove().axis;
  }

  consumeFrameInput(): UnifiedInput {
    const move = this.peekMove();
    const input: UnifiedInput = {
      moveTargetX: null,
      moveAxis: move.axis,
      moveScale: move.scale,
      stopOnRelease: this.stopRequested,
      action: this.actionQueued,
      jump: this.jumpQueued,
      slam: this.slamQueued,
    };
    this.stopRequested = false;
    this.actionQueued = false;
    this.jumpQueued = false;
    this.slamQueued = false;
    return input;
  }
}

export function toWorldStepInput(input: UnifiedInput): WorldStepInput {
  return {
    moveDir: input.moveAxis,
    moveScale: input.moveScale,
    stopOnRelease: input.stopOnRelease,
    directControl: input.moveScale !== undefined && input.moveTargetX === null,
    bumpPressed: input.action,
    jumpPressed: input.jump,
    slamPressed: Boolean(input.slam),
  };
}
