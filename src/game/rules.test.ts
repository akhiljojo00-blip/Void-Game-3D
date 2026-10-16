import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createInitialStats,
  clampPosition,
  checkSphereCollision,
  calculateTrackingVelocity,
  drainFuel,
  applyDamage,
  restoreFuel,
  collectScrap,
  evaluateGameState,
  GAME_CONSTANTS,
} from './rules.ts';

test('createInitialStats initializes stats with 100 shields, 100 fuel, 0 scrap', () => {
  const stats = createInitialStats();
  assert.equal(stats.shields, 100);
  assert.equal(stats.fuel, 100);
  assert.equal(stats.scrap, 0);
  assert.equal(stats.targetScrap, 20);
  assert.equal(stats.warpGateActive, false);
  assert.equal(stats.isGameOver, false);
  assert.equal(stats.isVictory, false);
});

test('clampPosition confines ship within specified visible bounds', () => {
  const bounds = { minX: -10, maxX: 10, minY: -5, maxY: 5 };
  
  const inside = clampPosition({ x: 2, y: -1 }, bounds);
  assert.deepEqual(inside, { x: 2, y: -1 });

  const clampedMax = clampPosition({ x: 25, y: 15 }, bounds);
  assert.deepEqual(clampedMax, { x: 10, y: 5 });

  const clampedMin = clampPosition({ x: -20, y: -30 }, bounds);
  assert.deepEqual(clampedMin, { x: -10, y: -5 });
});

test('checkSphereCollision accurately identifies overlaps', () => {
  // Touching / overlapping
  const hit = checkSphereCollision({ x: 0, y: 0, z: 0 }, 1.0, { x: 1.5, y: 0, z: 0 }, 1.0);
  assert.equal(hit, true);

  // Distant / no overlap
  const miss = checkSphereCollision({ x: 0, y: 0, z: 0 }, 1.0, { x: 5, y: 5, z: 0 }, 1.0);
  assert.equal(miss, false);
});

test('calculateTrackingVelocity vectors correctly toward target', () => {
  const dronePos = { x: 0, y: 0 };
  const playerPos = { x: 10, y: 0 };
  const velocity = calculateTrackingVelocity(dronePos, playerPos, 4);

  assert.equal(velocity.x, 4);
  assert.equal(velocity.y, 0);

  // Diagonal tracking
  const diagDrone = { x: 0, y: 0 };
  const diagPlayer = { x: 3, y: 4 };
  const diagVel = calculateTrackingVelocity(diagDrone, diagPlayer, 5);
  assert.equal(Math.round(diagVel.x), 3);
  assert.equal(Math.round(diagVel.y), 4);
});

test('drainFuel decrements fuel and stops at 0', () => {
  const remaining = drainFuel(100, 2.0, 5.0);
  assert.equal(remaining, 90);

  const empty = drainFuel(5, 2.0, 5.0);
  assert.equal(empty, 0);
});

test('applyDamage and restoreFuel respect constraints', () => {
  const damageResult = applyDamage(100, 30);
  assert.equal(damageResult, 70);

  const overkillResult = applyDamage(20, 50);
  assert.equal(overkillResult, 0);

  const restored = restoreFuel(50, 30, 100);
  assert.equal(restored, 80);

  const maxCapped = restoreFuel(95, 30, 100);
  assert.equal(maxCapped, 100);
});

test('collectScrap unlocks warp gate when reaching 20', () => {
  let stats = createInitialStats();
  for (let i = 0; i < 19; i++) {
    stats = collectScrap(stats);
  }
  assert.equal(stats.scrap, 19);
  assert.equal(stats.warpGateActive, false);

  stats = collectScrap(stats);
  assert.equal(stats.scrap, 20);
  assert.equal(stats.warpGateActive, true);
});

test('evaluateGameState triggers Game Over when shields or fuel are zero', () => {
  let stats = createInitialStats();
  stats.shields = 0;
  const outOfShields = evaluateGameState(stats);
  assert.equal(outOfShields.isGameOver, true);
  assert.match(outOfShields.gameOverReason!, /Shields Depleted/i);

  stats = createInitialStats();
  stats.fuel = 0;
  const outOfFuel = evaluateGameState(stats);
  assert.equal(outOfFuel.isGameOver, true);
  assert.match(outOfFuel.gameOverReason!, /Fuel Exhausted/i);
});

test('evaluateGameState triggers Victory when warp gate is reached after 20 scrap', () => {
  let stats = createInitialStats();
  stats.scrap = 20;
  stats.warpGateActive = true;

  const victoryState = evaluateGameState(stats, true);
  assert.equal(victoryState.isVictory, true);
  assert.equal(victoryState.score >= 5000, true);
});
