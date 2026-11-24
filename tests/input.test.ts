import { describe, expect, it } from 'vitest';
import { tuning } from '../src/config/tuning';
import {
  computeJoystickResponse,
  InputController,
  toWorldStepInput,
} from '../src/core/input';
import { PigeonFountainWorld } from '../src/game/world';
import {
  createInitialProgress,
  readProgress,
  writeProgress,
  type StorageBackend,
} from '../src/platform/storage';

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
      moveScale: 1,
      stopOnRelease: false,
      action: true,
      jump: false,
      slam: false,
    });
    expect(toWorldStepInput(frame1)).toEqual({
      moveDir: 1,
      moveScale: 1,
      stopOnRelease: false,
      directControl: true,
      bumpPressed: true,
      jumpPressed: false,
      slamPressed: false,
    });

    const frame2 = input.consumeFrameInput();
    expect(frame2.action).toBe(false);
    expect(frame2.moveAxis).toBe(1);

    input.onKeyUp('KeyD');
    expect(input.peekMoveAxis()).toBe(0);
  });

  it('implements ±5px deadzone, ±26px quadratic acceleration, origin follow, and 1-frame reversal', () => {
    expect(computeJoystickResponse(0)).toEqual({ axis: 0, scale: 0 });
    expect(computeJoystickResponse(5)).toEqual({ axis: 0, scale: 0 });
    expect(computeJoystickResponse(-5)).toEqual({ axis: 0, scale: 0 });

    // Halfway between 5 and 26 is 15.5 -> quadratic scale = 0.5^2 = 0.25
    const mid = computeJoystickResponse(15.5);
    expect(mid.axis).toBe(1);
    expect(mid.scale).toBeCloseTo(0.25, 4);

    expect(computeJoystickResponse(26)).toEqual({ axis: 1, scale: 1 });
    expect(computeJoystickResponse(-60)).toEqual({ axis: -1, scale: 1 });

    // Origin follow: drag to x=160 from origin=100 -> origin follows to 160-26=134
    const input = new InputController('touch');
    expect(input.startJoystick(1, 100, 520, 'touch')).toBe(true);
    input.updateJoystick(1, 160, 520);
    expect(input.getJoystickVisual().originX).toBe(134);
    expect(input.peekMove()).toEqual({ axis: 1, scale: 1 });

    // Reverse 10px back to 150 -> dx from followed origin (134) is +16 (wait, reverse 32px to 128 -> dx = -6 -> immediately reverses!)
    input.updateJoystick(1, 128, 520);
    expect(input.peekMove().axis).toBe(-1);

    // 1-frame reversal in PigeonFountainWorld
    const world = new PigeonFountainWorld('stage', 1, tuning, 123);
    world.step(toWorldStepInput(input.consumeFrameInput()), tuning.loop.fixedDtMs);
    expect(world.player.vx).toBeLessThan(0);

    input.updateJoystick(1, 154, 520);
    world.step(toWorldStepInput(input.consumeFrameInput()), tuning.loop.fixedDtMs);
    expect(world.player.vx).toBeGreaterThan(0);

    // Release joystick -> stop immediately
    input.endPointer(1);
    const relFrame = input.consumeFrameInput();
    expect(relFrame.stopOnRelease).toBe(true);
    world.step(toWorldStepInput(relFrame), tuning.loop.fixedDtMs);
    expect(world.player.vx).toBe(0);
  });

  it('isolates dragging pointer from button triggers and supports multi-touch', () => {
    const input = new InputController('touch');
    expect(input.startJoystick(10, 100, 520, 'touch')).toBe(true);

    expect(input.tryTriggerButton(10, 'bump', false, 'touch')).toBe(false);
    expect(input.tryTriggerButton(10, 'jump', false, 'touch')).toBe(false);

    expect(input.tryTriggerButton(20, 'bump', false, 'touch')).toBe(true);
    const frame = input.consumeFrameInput();
    expect(frame.action).toBe(true);

    expect(input.tryTriggerButton(21, 'jump', true, 'touch')).toBe(true);
    const airFrame = input.consumeFrameInput();
    expect(airFrame.slam).toBe(true);
    expect(airFrame.jump).toBe(false);
  });

  it('ignores key repeat for one-shot jump/action', () => {
    const input = new InputController('keyboard');
    input.onKeyDown('Space', true);
    input.onKeyDown('KeyW', true);
    expect(input.consumeFrameInput()).toEqual({
      moveTargetX: null,
      moveAxis: 0,
      moveScale: 0,
      stopOnRelease: false,
      action: false,
      jump: false,
      slam: false,
    });
  });

  it('persists classicFourButtons setting via storage', () => {
    const mem = new Map<string, string>();
    const backend: StorageBackend = {
      getItem: (k) => mem.get(k) ?? null,
      setItem: (k, v) => {
        mem.set(k, v);
      },
    };
    const p = { ...createInitialProgress(), classicFourButtons: true };
    writeProgress(p, backend);
    expect(readProgress(backend).classicFourButtons).toBe(true);
  });
});
