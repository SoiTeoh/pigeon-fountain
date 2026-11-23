import { describe, expect, it } from 'vitest';
import { tuning } from '../src/config/tuning';
import { createSeededRng, hashState, mulberry32 } from '../src/core/rng';
import { PigeonFountainWorld, type WorldStepInput } from '../src/game/world';

describe('core/rng determinism', () => {
  it('mulberry32 produces identical sequences for the same seed and differs across seeds', () => {
    const a = mulberry32(123456);
    const b = mulberry32(123456);
    const c = mulberry32(654321);

    const seqA = Array.from({ length: 20 }, () => a());
    const seqB = Array.from({ length: 20 }, () => b());
    const seqC = Array.from({ length: 20 }, () => c());

    expect(seqA).toEqual(seqB);
    expect(seqA).not.toEqual(seqC);
    for (const v of seqA) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('createSeededRng helpers stay bounded', () => {
    const rng = createSeededRng(42);
    for (let i = 0; i < 50; i++) {
      const r = rng.range(-10, 10);
      expect(r).toBeGreaterThanOrEqual(-10);
      expect(r).toBeLessThan(10);
      const n = rng.int(1, 4);
      expect([1, 2, 3]).toContain(n);
    }
  });

  it('produces identical final state hashes when running PigeonFountainWorld twice with the same seed and inputs', () => {
    const runSimulation = (seed: number) => {
      const world = new PigeonFountainWorld('stage', 4, tuning, seed);
      const dtMs = tuning.loop.fixedDtMs;
      for (let frame = 0; frame < 900; frame++) {
        const input: WorldStepInput = {
          moveDir: frame % 90 < 40 ? 1 : frame % 90 < 75 ? -1 : 0,
          bumpPressed: frame % 45 === 10,
          jumpPressed: frame % 60 === 20,
        };
        world.step(input, dtMs);
      }
      return {
        hash: world.getStateHash(),
        score: world.match.score,
        elapsed: world.match.elapsedSec,
      };
    };

    const run1 = runSimulation(20261123);
    const run2 = runSimulation(20261123);
    const runOtherSeed = runSimulation(99999999);

    expect(run1.hash).toBe(run2.hash);
    expect(run1.score).toBe(run2.score);
    expect(run1.elapsed).toBe(run2.elapsed);
    expect(run1.hash).not.toBe(runOtherSeed.hash);
  });

  it('hashState normalizes object key order and -0', () => {
    expect(hashState({ a: 1, b: -0 })).toBe(hashState({ b: 0, a: 1 }));
  });
});
