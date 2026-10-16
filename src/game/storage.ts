import { PersistentData } from './types';

const STORAGE_KEY = 'void_extractor_save_v1';

const DEFAULT_DATA: PersistentData = {
  highScore: 0,
  totalScrapCollected: 0,
  missionsCompleted: 0,
  missionsAttempted: 0,
  isMuted: false,
};

export function loadSaveData(): PersistentData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_DATA };
    const parsed = JSON.parse(raw);
    return {
      highScore: Number(parsed.highScore) || 0,
      totalScrapCollected: Number(parsed.totalScrapCollected) || 0,
      missionsCompleted: Number(parsed.missionsCompleted) || 0,
      missionsAttempted: Number(parsed.missionsAttempted) || 0,
      isMuted: Boolean(parsed.isMuted),
    };
  } catch {
    return { ...DEFAULT_DATA };
  }
}

export function saveMissionStats(
  score: number,
  scrapCollected: number,
  isVictory: boolean
): { isNewHighScore: boolean; data: PersistentData } {
  const current = loadSaveData();
  const isNewHighScore = score > current.highScore;
  const nextData: PersistentData = {
    ...current,
    highScore: Math.max(current.highScore, score),
    totalScrapCollected: current.totalScrapCollected + scrapCollected,
    missionsCompleted: current.missionsCompleted + (isVictory ? 1 : 0),
    missionsAttempted: current.missionsAttempted + 1,
  };

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(nextData));
  } catch (err) {
    console.warn('Failed to save to localStorage:', err);
  }

  return { isNewHighScore, data: nextData };
}

export function saveMutePreference(isMuted: boolean): void {
  try {
    const current = loadSaveData();
    current.isMuted = isMuted;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
  } catch {}
}
