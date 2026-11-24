/**
 * Deterministic seeded PRNG (Mulberry32) and state hashing helpers.
 * All simulation logic must use this module instead of Math.random().
 */

export const DEFAULT_SIM_SEED = 0x50494745; // 'PIGE'

export function normalizeSeed(seed: number): number {
  if (!Number.isFinite(seed)) return DEFAULT_SIM_SEED;
  const u32 = seed >>> 0;
  return u32 === 0 ? DEFAULT_SIM_SEED : u32;
}

/**
 * Generates a fresh non-zero uint32 seed for starting a new match outside simulation logic.
 */
export function generateRandomSeed(): number {
  if (typeof globalThis.crypto !== 'undefined' && typeof globalThis.crypto.getRandomValues === 'function') {
    const buf = new Uint32Array(1);
    globalThis.crypto.getRandomValues(buf);
    return normalizeSeed(buf[0]);
  }
  const fallback = (Date.now() ^ Math.floor(performance.now() * 1000)) >>> 0;
  return normalizeSeed(fallback);
}

export function mulberry32(seed: number): () => number {
  let state = normalizeSeed(seed);
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface SeededRng {
  readonly seed: number;
  next(): number;
  range(min: number, max: number): number;
  int(minInclusive: number, maxExclusive: number): number;
  chance(probability: number): boolean;
}

export function createSeededRng(seed: number = DEFAULT_SIM_SEED): SeededRng {
  const normalized = normalizeSeed(seed);
  const next = mulberry32(normalized);
  return {
    seed: normalized,
    next,
    range(min: number, max: number): number {
      return min + next() * (max - min);
    },
    int(minInclusive: number, maxExclusive: number): number {
      if (maxExclusive <= minInclusive) return minInclusive;
      return minInclusive + Math.floor(next() * (maxExclusive - minInclusive));
    },
    chance(probability: number): boolean {
      return next() < probability;
    },
  };
}

function fnv1aUpdate(hash: number, str: string): number {
  let h = hash >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h;
}

function hashValue(hash: number, value: unknown): number {
  if (value === null) return fnv1aUpdate(hash, 'null;');
  if (value === undefined) return fnv1aUpdate(hash, 'undef;');
  switch (typeof value) {
    case 'boolean':
      return fnv1aUpdate(hash, value ? 'b:1;' : 'b:0;');
    case 'number': {
      if (Number.isNaN(value)) return fnv1aUpdate(hash, 'n:NaN;');
      if (!Number.isFinite(value)) return fnv1aUpdate(hash, value > 0 ? 'n:Inf;' : 'n:-Inf;');
      const normalized = Object.is(value, -0) ? 0 : Math.round(value * 1e6);
      return fnv1aUpdate(hash, `n:${normalized};`);
    }
    case 'string':
      return fnv1aUpdate(hash, `s:${value.length}:${value};`);
    case 'object': {
      if (Array.isArray(value)) {
        let h = fnv1aUpdate(hash, `a:${value.length}[`);
        for (let i = 0; i < value.length; i++) {
          h = hashValue(h, value[i]);
        }
        return fnv1aUpdate(h, ']');
      }
      const record = value as Record<string, unknown>;
      const keys = Object.keys(record).sort();
      let h = fnv1aUpdate(hash, `o:${keys.length}{`);
      for (const k of keys) {
        h = fnv1aUpdate(h, `${k}:`);
        h = hashValue(h, record[k]);
      }
      return fnv1aUpdate(h, '}');
    }
    default:
      return fnv1aUpdate(hash, `${typeof value};`);
  }
}

/**
 * Computes a deterministic 8-char hex FNV-1a hash of any JSON-like state structure.
 */
export function hashState(value: unknown): string {
  const h = hashValue(0x811c9dc5, value);
  return (h >>> 0).toString(16).padStart(8, '0');
}
