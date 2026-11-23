import type { WorldStepInput } from '../game/world';

export type InputMethod = 'touch' | 'keyboard';

export interface UnifiedInput {
  readonly moveTargetX: number | null;
  readonly moveAxis: -1 | 0 | 1;
  readonly action: boolean;
  readonly jump: boolean;
}

interface PointerMoveEntry {
  dir: -1 | 1;
  zoneOnly: boolean;
  targetX: number | null;
}

export class InputController {
  private readonly movePointers = new Map<number, PointerMoveEntry>();
  private readonly heldKeys = new Set<string>();
  private actionQueued = false;
  private jumpQueued = false;
  private lastInputMethod: InputMethod;

  constructor(initialMethod: InputMethod = 'touch') {
    this.lastInputMethod = initialMethod;
  }

  getLastInputMethod(): InputMethod {
    return this.lastInputMethod;
  }

  setInputMethod(method: InputMethod): void {
    this.lastInputMethod = method;
  }

  clear(): void {
    this.movePointers.clear();
    this.heldKeys.clear();
    this.actionQueued = false;
    this.jumpQueued = false;
  }

  setMovePointer(
    pointerId: number,
    dir: -1 | 1,
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
    dir: -1 | 1,
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
    this.movePointers.delete(pointerId);
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

  onKeyDown(code: string, repeat = false): void {
    this.lastInputMethod = 'keyboard';
    if (code === 'Space' && !repeat) {
      this.actionQueued = true;
    } else if ((code === 'KeyW' || code === 'ArrowUp') && !repeat) {
      this.jumpQueued = true;
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

  peekMoveAxis(): -1 | 0 | 1 {
    let dir = 0;
    if (this.heldKeys.has('KeyA') || this.heldKeys.has('ArrowLeft')) dir -= 1;
    if (this.heldKeys.has('KeyD') || this.heldKeys.has('ArrowRight')) dir += 1;
    if (dir === 0 && this.movePointers.size > 0) {
      let latestDir: -1 | 1 = 1;
      for (const entry of this.movePointers.values()) {
        latestDir = entry.dir;
      }
      dir = latestDir;
    }
    if (dir < 0) return -1;
    if (dir > 0) return 1;
    return 0;
  }

  peekMoveTargetX(): number | null {
    if (this.heldKeys.size > 0) return null;
    let latestTargetX: number | null = null;
    for (const entry of this.movePointers.values()) {
      latestTargetX = entry.targetX;
    }
    return latestTargetX;
  }

  consumeFrameInput(): UnifiedInput {
    const input: UnifiedInput = {
      moveTargetX: this.peekMoveTargetX(),
      moveAxis: this.peekMoveAxis(),
      action: this.actionQueued,
      jump: this.jumpQueued,
    };
    this.actionQueued = false;
    this.jumpQueued = false;
    return input;
  }
}

export function toWorldStepInput(input: UnifiedInput): WorldStepInput {
  return {
    moveDir: input.moveAxis,
    bumpPressed: input.action,
    jumpPressed: input.jump,
  };
}
