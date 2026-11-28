export type StageId = 1 | 2 | 3 | 4;
export type TutorialId = 'tut-1' | 'tut-2' | 'tut-3';
export type GameMode = 'stage' | 'endless' | 'tutorial';

export interface StorageBackend {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export interface PlayerProgress {
  readonly unlockedStage: StageId;
  readonly stars: Record<StageId, 0 | 1 | 2 | 3>;
  readonly stageBestScores: Record<StageId, number>;
  readonly unlockedCampaignLevel: number;
  readonly campaignStars: Record<number, 0 | 1 | 2 | 3>;
  readonly campaignBestScores: Record<number, number>;
  readonly consecutiveLosses: Record<number, number>;
  readonly endlessBestScore: number;
  readonly classicFourButtons: boolean;
  readonly plugSuccessCount: number;
  readonly tutorialStep: 1 | 2 | 3 | 'done';
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
    unlockedCampaignLevel: 1,
    campaignStars: {},
    campaignBestScores: {},
    consecutiveLosses: {},
    endlessBestScore: 0,
    classicFourButtons: false,
    plugSuccessCount: 0,
    tutorialStep: 1,
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

function sanitizeTutorialStep(
  raw: unknown,
  unlockedStage: StageId,
  star1: 0 | 1 | 2 | 3,
): 1 | 2 | 3 | 'done' {
  if (raw === 1 || raw === 2 || raw === 3 || raw === 'done') return raw;
  return unlockedStage > 1 || star1 > 0 ? 'done' : 1;
}

function sanitizeNumRecord<T extends number>(
  raw: unknown,
  clampVal: (v: unknown) => T,
): Record<number, T> {
  const out: Record<number, T> = {};
  if (!raw || typeof raw !== 'object') return out;
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    const idx = Number.parseInt(k, 10);
    if (Number.isFinite(idx) && idx >= 1 && idx <= 24) {
      out[idx] = clampVal(v);
    }
  }
  return out;
}

export function sanitizeProgress(raw: unknown): PlayerProgress {
  const base = createInitialProgress();
  if (!raw || typeof raw !== 'object') return base;
  const obj = raw as Partial<PlayerProgress>;
  const unlockedStage = clampStageId(obj.unlockedStage);
  const star1 = clampStars(obj.stars?.[1]);
  const rawCamp = typeof obj.unlockedCampaignLevel === 'number' && Number.isFinite(obj.unlockedCampaignLevel)
    ? Math.max(1, Math.min(24, Math.floor(obj.unlockedCampaignLevel)))
    : unlockedStage;
  return {
    unlockedStage,
    stars: {
      1: star1,
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
    unlockedCampaignLevel: rawCamp,
    campaignStars: sanitizeNumRecord(obj.campaignStars, clampStars),
    campaignBestScores: sanitizeNumRecord(obj.campaignBestScores, sanitizeScore),
    consecutiveLosses: sanitizeNumRecord(obj.consecutiveLosses, sanitizeScore),
    endlessBestScore: sanitizeScore(obj.endlessBestScore),
    classicFourButtons: Boolean(obj.classicFourButtons),
    plugSuccessCount: sanitizeScore(obj.plugSuccessCount),
    tutorialStep: sanitizeTutorialStep(obj.tutorialStep, unlockedStage, star1),
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

export function applyCampaignCompletion(
  progress: PlayerProgress,
  levelIndex: number,
  controlScore: number,
  earnedStars: 0 | 1 | 2 | 3,
  won: boolean,
): PlayerProgress {
  const idx = Math.max(1, Math.min(24, Math.round(levelIndex)));
  const prevStars = progress.campaignStars[idx] ?? 0;
  const nextStars = Math.max(prevStars, earnedStars) as 0 | 1 | 2 | 3;
  const nextUnlocked =
    won && idx < 24 && progress.unlockedCampaignLevel <= idx
      ? idx + 1
      : progress.unlockedCampaignLevel;
  const prevLosses = progress.consecutiveLosses[idx] ?? 0;
  const legacyStageId = (Math.min(4, idx) as StageId);
  const baseUpdated =
    idx <= 4
      ? applyStageCompletion(progress, legacyStageId, controlScore, earnedStars)
      : progress;

  return {
    ...baseUpdated,
    unlockedCampaignLevel: nextUnlocked,
    campaignStars: {
      ...progress.campaignStars,
      [idx]: nextStars,
    },
    campaignBestScores: {
      ...progress.campaignBestScores,
      [idx]: Math.max(progress.campaignBestScores[idx] ?? 0, Math.max(0, Math.floor(controlScore))),
    },
    consecutiveLosses: {
      ...progress.consecutiveLosses,
      [idx]: won ? 0 : prevLosses + 1,
    },
  };
}
