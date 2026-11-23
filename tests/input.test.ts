import { describe, expect, it } from 'vitest';
import { InputController, toWorldStepInput } from '../src/core/input';

describe('core/input', () => {
  it('unifies keyboard and touch movement and tracks lastInputMethod', () => {
    const input = new InputController('touch');
    expect(input.getLastInputMethod()).toBe('touch');

    input.onKeyDown('KeyD', false);
    expect(input.getLastInputMethod()).toBe('keyboard');
    expect(input.peekMoveAxis()).toBe(1);

    input.onKeyDown('Space', false);
    const frame1 = input.consumeFrameInput();
    expect(frame1).toEqual({
      moveTargetX: null,
      moveAxis: 1,
      action: true,
      jump: false,
    });
    expect(toWorldStepInput(frame1)).toEqual({
      moveDir: 1,
      bumpPressed: true,
      jumpPressed: false,
    });

    // Queued one-shot actions are consumed on read
    const frame2 = input.consumeFrameInput();
    expect(frame2.action).toBe(false);
    expect(frame2.moveAxis).toBe(1);

    input.onKeyUp('KeyD');
    expect(input.peekMoveAxis()).toBe(0);
  });

  it('tracks touch pointers independently and switches lastInputMethod back to touch', () => {
    const input = new InputController('keyboard');
    input.setMovePointer(1, -1, false, 72, 'touch');
    expect(input.getLastInputMethod()).toBe('touch');

    input.queueJump('touch');
    const frame = input.consumeFrameInput();
    expect(frame).toEqual({
      moveTargetX: 72,
      moveAxis: -1,
      action: false,
      jump: true,
    });

    input.removeMovePointer(1);
    expect(input.peekMoveAxis()).toBe(0);
  });

  it('ignores key repeat for one-shot jump/action', () => {
    const input = new InputController('keyboard');
    input.onKeyDown('Space', true);
    input.onKeyDown('KeyW', true);
    expect(input.consumeFrameInput()).toEqual({
      moveTargetX: null,
      moveAxis: 0,
      action: false,
      jump: false,
    });
  });
});
