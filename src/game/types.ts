import * as THREE from 'three';

export type GameStateMode = 'title' | 'playing' | 'paused' | 'gameover' | 'victory';

export interface PooledObject {
  mesh: THREE.Object3D;
  active: boolean;
  type: 'asteroid' | 'drone' | 'fuel' | 'scrap' | 'projectile' | 'particle';
  velocity: THREE.Vector3;
  rotationalVelocity: THREE.Vector3;
  radius: number;
  health?: number;
  lifetime?: number;
  maxLifetime?: number;
}

export interface PlayerState {
  mesh: THREE.Group;
  velocity: THREE.Vector3;
  targetPos: THREE.Vector2;
  tilt: number;
  invulnerableTimer: number;
}

export interface PersistentData {
  highScore: number;
  totalScrapCollected: number;
  missionsCompleted: number;
  missionsAttempted: number;
  isMuted: boolean;
}

export interface MissionResult {
  isVictory: boolean;
  score: number;
  scrap: number;
  timeSurvivedSeconds: number;
  reason?: string;
  isNewHighScore?: boolean;
}
