export type StageId = 1 | 2 | 3 | 4;
export type GameMode = 'stage' | 'endless';

export interface StorageBackend {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export interface PlayerProgress {
  readonly unlockedStage: StageId;
  readonly stars: Record<StageId, 0 | 1 | 2 | 3>;
  readonly stageBestScores: Record<StageId, number>;
  readonly endlessBestScore: number;
}

const PROGRESS_STORAGE_KEY = 'pigeon_fountain_progress_v2';
const LEGACY_BEST_SCORE_KEY = 'pigeon_fountain_best_score_v1';

const browserStorage: StorageBackend = {
  getItem(key: string): string | null {
    try {
      return typeof window !== 'undefined' && window.localStorage
        ? window.localStorage.getItem(key)
        : null;
    } catch {
      return null;
    }
  },
  setItem(key: string, value: string): void {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(key, value);
      }
    } catch {
      // Ignore storage failures in restricted environments
    }
  },
};

export function createInitialProgress(): PlayerProgress {
  return {
    unlockedStage: 1,
    stars: { 1: 0, 2: 0, 3: 0, 4: 0 },
    stageBestScores: { 1: 0, 2: 0, 3: 0, 4: 0 },
    endlessBestScore: 0,
  };
}

function clampStageId(raw: unknown): StageId {
  if (raw === 2 || raw === 3 || raw === 4) return raw;
  return 1;
}

function clampStars(raw: unknown): 0 | 1 | 2 | 3 {
  if (raw === 1 || raw === 2 || raw === 3) return raw;
  return 0;
}

function sanitizeScore(raw: unknown): number {
  return typeof raw === 'number' && Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : 0;
}

export function sanitizeProgress(raw: unknown): PlayerProgress {
  const base = createInitialProgress();
  if (!raw || typeof raw !== 'object') return base;
  const obj = raw as Partial<PlayerProgress>;
  return {
    unlockedStage: clampStageId(obj.unlockedStage),
    stars: {
      1: clampStars(obj.stars?.[1]),
      2: clampStars(obj.stars?.[2]),
      3: clampStars(obj.stars?.[3]),
      4: clampStars(obj.stars?.[4]),
    },
    stageBestScores: {
      1: sanitizeScore(obj.stageBestScores?.[1]),
      2: sanitizeScore(obj.stageBestScores?.[2]),
      3: sanitizeScore(obj.stageBestScores?.[3]),
      4: sanitizeScore(obj.stageBestScores?.[4]),
    },
    endlessBestScore: sanitizeScore(obj.endlessBestScore),
  };
}

export function readProgress(backend: StorageBackend = browserStorage): PlayerProgress {
  const raw = backend.getItem(PROGRESS_STORAGE_KEY);
  if (raw) {
    try {
      return sanitizeProgress(JSON.parse(raw));
    } catch {
      return createInitialProgress();
    }
  }
  const legacyRaw = backend.getItem(LEGACY_BEST_SCORE_KEY);
  if (legacyRaw) {
    const parsed = Number.parseInt(legacyRaw, 10);
    if (Number.isFinite(parsed) && parsed > 0) {
      return {
        ...createInitialProgress(),
        endlessBestScore: Math.floor(parsed),
      };
    }
  }
  return createInitialProgress();
}

export function writeProgress(
  progress: PlayerProgress,
  backend: StorageBackend = browserStorage,
): void {
  backend.setItem(PROGRESS_STORAGE_KEY, JSON.stringify(progress));
}

export function applyStageCompletion(
  progress: PlayerProgress,
  stageId: StageId,
  score: number,
  earnedStars: 0 | 1 | 2 | 3,
): PlayerProgress {
  const cleanScore = Math.max(0, Math.floor(score));
  const prevStars = progress.stars[stageId];
  const nextStars = Math.max(prevStars, earnedStars) as 0 | 1 | 2 | 3;
  const nextUnlocked =
    earnedStars >= 1 && stageId < 4 && progress.unlockedStage <= stageId
      ? ((stageId + 1) as StageId)
      : progress.unlockedStage;

  return {
    ...progress,
    unlockedStage: nextUnlocked,
    stars: {
      ...progress.stars,
      [stageId]: nextStars,
    },
    stageBestScores: {
      ...progress.stageBestScores,
      [stageId]: Math.max(progress.stageBestScores[stageId], cleanScore),
    },
  };
}

export function applyEndlessCompletion(progress: PlayerProgress, score: number): PlayerProgress {
  const cleanScore = Math.max(0, Math.floor(score));
  return {
    ...progress,
    endlessBestScore: Math.max(progress.endlessBestScore, cleanScore),
  };
}

export type LaunchChapterStageId = 1 | 2 | 3 | 4 | 5 | 6;

export interface LaunchProgress {
  readonly unlockedStage: LaunchChapterStageId;
  readonly stars: Record<LaunchChapterStageId, 0 | 1 | 2 | 3>;
  readonly bestScores: Record<LaunchChapterStageId, number>;
}

const LAUNCH_PROGRESS_KEY = 'pigeon_fountain_launch_ch1_v1';

export function createInitialLaunchProgress(): LaunchProgress {
  return {
    unlockedStage: 1,
    stars: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 },
    bestScores: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 },
  };
}

function clampLaunchStageId(raw: unknown): LaunchChapterStageId {
  if (raw === 2 || raw === 3 || raw === 4 || raw === 5 || raw === 6) return raw;
  return 1;
}

export function sanitizeLaunchProgress(raw: unknown): LaunchProgress {
  const base = createInitialLaunchProgress();
  if (!raw || typeof raw !== 'object') return base;
  const obj = raw as Partial<LaunchProgress>;
  return {
    unlockedStage: clampLaunchStageId(obj.unlockedStage),
    stars: {
      1: clampStars(obj.stars?.[1]),
      2: clampStars(obj.stars?.[2]),
      3: clampStars(obj.stars?.[3]),
      4: clampStars(obj.stars?.[4]),
      5: clampStars(obj.stars?.[5]),
      6: clampStars(obj.stars?.[6]),
    },
    bestScores: {
      1: sanitizeScore(obj.bestScores?.[1]),
      2: sanitizeScore(obj.bestScores?.[2]),
      3: sanitizeScore(obj.bestScores?.[3]),
      4: sanitizeScore(obj.bestScores?.[4]),
      5: sanitizeScore(obj.bestScores?.[5]),
      6: sanitizeScore(obj.bestScores?.[6]),
    },
  };
}

export function readLaunchProgress(backend: StorageBackend = browserStorage): LaunchProgress {
  const raw = backend.getItem(LAUNCH_PROGRESS_KEY);
  if (!raw) return createInitialLaunchProgress();
  try {
    return sanitizeLaunchProgress(JSON.parse(raw));
  } catch {
    return createInitialLaunchProgress();
  }
}

export function writeLaunchProgress(
  progress: LaunchProgress,
  backend: StorageBackend = browserStorage,
): void {
  backend.setItem(LAUNCH_PROGRESS_KEY, JSON.stringify(progress));
}

export function applyLaunchStageCompletion(
  progress: LaunchProgress,
  stageId: LaunchChapterStageId,
  score: number,
  earnedStars: 0 | 1 | 2 | 3,
): LaunchProgress {
  const cleanScore = Math.max(0, Math.floor(score));
  const nextStars = Math.max(progress.stars[stageId], earnedStars) as 0 | 1 | 2 | 3;
  const nextUnlocked =
    earnedStars >= 1 && stageId < 6 && progress.unlockedStage <= stageId
      ? ((stageId + 1) as LaunchChapterStageId)
      : progress.unlockedStage;

  return {
    unlockedStage: nextUnlocked,
    stars: {
      ...progress.stars,
      [stageId]: nextStars,
    },
    bestScores: {
      ...progress.bestScores,
      [stageId]: Math.max(progress.bestScores[stageId], cleanScore),
    },
  };
}
