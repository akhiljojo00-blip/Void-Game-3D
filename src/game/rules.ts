/**
 * Pure game rules, physics, collision detection, and state machine calculations
 * for Void Extractor 3D roguelike.
 */

export interface Point2D {
  x: number;
  y: number;
}

export interface Point3D {
  x: number;
  y: number;
  z: number;
}

export interface Bounds2D {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

export interface GameStats {
  shields: number;
  maxShields: number;
  fuel: number;
  maxFuel: number;
  scrap: number;
  targetScrap: number;
  score: number;
  warpGateActive: boolean;
  isGameOver: boolean;
  isVictory: boolean;
  gameOverReason: string | null;
}

export const GAME_CONSTANTS = {
  MAX_SHIELDS: 100,
  MAX_FUEL: 100,
  TARGET_SCRAP: 20,
  FUEL_DRAIN_PER_SECOND: 2.2, // ~45s of baseline flight without pickups
  FUEL_PICKUP_RESTORE: 30,
  ASTEROID_SHIELD_DAMAGE: 22,
  DRONE_SHIELD_DAMAGE: 16,
  SCRAP_SCORE_BONUS: 250,
  VICTORY_BONUS: 5000,
  DEFAULT_BOUNDS: {
    minX: -14,
    maxX: 14,
    minY: -9,
    maxY: 9,
  },
  COLLISION_RADII: {
    player: 1.1,
    asteroid: 1.3,
    drone: 1.0,
    fuel: 1.1,
    scrap: 1.0,
    warpGate: 2.4,
  },
};

/**
 * Creates fresh initial game stats
 */
export function createInitialStats(): GameStats {
  return {
    shields: GAME_CONSTANTS.MAX_SHIELDS,
    maxShields: GAME_CONSTANTS.MAX_SHIELDS,
    fuel: GAME_CONSTANTS.MAX_FUEL,
    maxFuel: GAME_CONSTANTS.MAX_FUEL,
    scrap: 0,
    targetScrap: GAME_CONSTANTS.TARGET_SCRAP,
    score: 0,
    warpGateActive: false,
    isGameOver: false,
    isVictory: false,
    gameOverReason: null,
  };
}

/**
 * Bounds clamping for player ship
 */
export function clampPosition(pos: Point2D, bounds: Bounds2D): Point2D {
  return {
    x: Math.max(bounds.minX, Math.min(bounds.maxX, pos.x)),
    y: Math.max(bounds.minY, Math.min(bounds.maxY, pos.y)),
  };
}

/**
 * Computes sphere-to-sphere collision between two 3D or 2D objects
 */
export function checkSphereCollision(
  posA: { x: number; y: number; z?: number },
  radiusA: number,
  posB: { x: number; y: number; z?: number },
  radiusB: number
): boolean {
  const dx = posA.x - posB.x;
  const dy = posA.y - posB.y;
  const dz = (posA.z ?? 0) - (posB.z ?? 0);
  const distSq = dx * dx + dy * dy + dz * dz;
  const radSum = radiusA + radiusB;
  return distSq <= radSum * radSum;
}

/**
 * Calculates normalized tracking velocity toward target
 */
export function calculateTrackingVelocity(
  currentPos: Point2D,
  targetPos: Point2D,
  speed: number
): Point2D {
  const dx = targetPos.x - currentPos.x;
  const dy = targetPos.y - currentPos.y;
  const dist = Math.hypot(dx, dy);

  if (dist < 0.0001) {
    return { x: 0, y: 0 };
  }

  return {
    x: (dx / dist) * speed,
    y: (dy / dist) * speed,
  };
}

/**
 * Drains fuel across elapsed time
 */
export function drainFuel(
  currentFuel: number,
  dt: number,
  drainRate: number = GAME_CONSTANTS.FUEL_DRAIN_PER_SECOND
): number {
  return Math.max(0, currentFuel - dt * drainRate);
}

/**
 * Applies damage to shields
 */
export function applyDamage(currentShields: number, amount: number): number {
  return Math.max(0, currentShields - amount);
}

/**
 * Adds fuel up to maximum
 */
export function restoreFuel(
  currentFuel: number,
  amount: number = GAME_CONSTANTS.FUEL_PICKUP_RESTORE,
  maxFuel: number = GAME_CONSTANTS.MAX_FUEL
): number {
  return Math.min(maxFuel, currentFuel + amount);
}

/**
 * Updates stats when scrap is collected
 */
export function collectScrap(stats: GameStats): GameStats {
  const nextScrap = stats.scrap + 1;
  const warpGateActive = nextScrap >= stats.targetScrap;
  return {
    ...stats,
    scrap: nextScrap,
    score: stats.score + GAME_CONSTANTS.SCRAP_SCORE_BONUS,
    warpGateActive: warpGateActive || stats.warpGateActive,
  };
}

/**
 * Checks win/loss triggers based on current stats and warp gate interaction
 */
export function evaluateGameState(
  stats: GameStats,
  warpGateReached: boolean = false
): GameStats {
  if (stats.isGameOver || stats.isVictory) {
    return stats;
  }

  if (warpGateReached && stats.warpGateActive) {
    return {
      ...stats,
      isVictory: true,
      score: stats.score + GAME_CONSTANTS.VICTORY_BONUS,
    };
  }

  if (stats.shields <= 0) {
    return {
      ...stats,
      shields: 0,
      isGameOver: true,
      gameOverReason: 'Hull Breach: Shields Depleted',
    };
  }

  if (stats.fuel <= 0) {
    return {
      ...stats,
      fuel: 0,
      isGameOver: true,
      gameOverReason: 'Critical Failure: Fuel Exhausted',
    };
  }

  return stats;
}

/**
 * Formats score for display
 */
export function formatScore(score: number): string {
  return Math.round(score).toLocaleString('en-US');
}
