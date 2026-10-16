/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { SpaceExtractionEngine } from './game/engine';
import { GameStats, createInitialStats } from './game/rules';
import { GameStateMode, PersistentData } from './game/types';
import { loadSaveData, saveMissionStats, saveMutePreference } from './game/storage';
import { sound } from './game/audio';
import { HUD } from './components/HUD';
import { StartScreen, GameOverScreen, VictoryScreen, PauseScreen } from './components/ModalScreens';
import { TouchControls } from './components/TouchControls';

export default function App() {
  const mountRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<SpaceExtractionEngine | null>(null);

  // React state for HUD and Modals
  const [gameState, setGameState] = useState<GameStateMode>('title');
  const [stats, setStats] = useState<GameStats>(createInitialStats);
  const [saveData, setSaveData] = useState<PersistentData>(loadSaveData);
  const [isMuted, setIsMuted] = useState<boolean>(() => loadSaveData().isMuted);
  const [gameOverReason, setGameOverReason] = useState<string>('');
  const [isNewHighScore, setIsNewHighScore] = useState<boolean>(false);
  const [damageFlash, setDamageFlash] = useState<boolean>(false);

  // Initialize engine once on mount
  useEffect(() => {
    if (!mountRef.current) return;

    // Apply saved mute preference to audio engine
    sound.setMuted(isMuted);

    const engine = new SpaceExtractionEngine(mountRef.current, {
      onStatsUpdate: (newStats) => {
        setStats({ ...newStats });
      },
      onStateChange: (newState, reason) => {
        setGameState(newState);
        if (reason) setGameOverReason(reason);

        if (newState === 'gameover' || newState === 'victory') {
          // Commit results to persistence
          const result = saveMissionStats(
            engine.stats.score,
            engine.stats.scrap,
            newState === 'victory'
          );
          setIsNewHighScore(result.isNewHighScore);
          setSaveData(result.data);
        }
      },
      onScrapCollected: () => {
        // Handled in audio and stats
      },
      onDamageTaken: () => {
        setDamageFlash(true);
        setTimeout(() => setDamageFlash(false), 120);
      },
    });

    engineRef.current = engine;

    // Support ?autostart=1 query parameter
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('autostart') === '1') {
      engine.startMission();
    }

    return () => {
      engine.dispose();
      engineRef.current = null;
    };
  }, []);

  const handleStartMission = useCallback(() => {
    if (engineRef.current) {
      engineRef.current.startMission();
    }
  }, []);

  const handleTogglePause = useCallback(() => {
    if (!engineRef.current) return;
    if (gameState === 'playing') {
      engineRef.current.pauseMission();
    } else if (gameState === 'paused') {
      engineRef.current.resumeMission();
    }
  }, [gameState]);

  const handleToggleMute = useCallback(() => {
    const nextMuted = sound.toggleMute();
    setIsMuted(nextMuted);
    saveMutePreference(nextMuted);
  }, []);

  const handleFireLaser = useCallback(() => {
    if (engineRef.current) {
      engineRef.current.fireLaser();
    }
  }, []);

  const handleTouchMove = useCallback((x: number, y: number) => {
    if (engineRef.current) {
      engineRef.current.setTouchMove(x, y);
    }
  }, []);

  const handleTouchFire = useCallback((firing: boolean) => {
    if (engineRef.current) {
      engineRef.current.setTouchFiring(firing);
    }
  }, []);

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-gray-950 font-sans select-none">
      {/* Isolated Three.js Canvas Container */}
      <div
        ref={mountRef}
        data-testid="webgl-canvas-container"
        className="absolute inset-0 w-full h-full z-0"
      />

      {/* Cyberpunk HUD Overlay (Active during Playing and Paused states) */}
      {(gameState === 'playing' || gameState === 'paused') && (
        <HUD
          stats={stats}
          isMuted={isMuted}
          onToggleMute={handleToggleMute}
          onTogglePause={handleTogglePause}
          isPaused={gameState === 'paused'}
          onFireLaser={handleFireLaser}
          hasDamageFlash={damageFlash}
        />
      )}

      {/* Mobile Touch Controls */}
      {gameState === 'playing' && (
        <TouchControls
          onMoveChange={handleTouchMove}
          onFireChange={handleTouchFire}
        />
      )}

      {/* State Transitions Modals */}
      {gameState === 'title' && (
        <StartScreen onStart={handleStartMission} saveData={saveData} />
      )}

      {gameState === 'gameover' && (
        <GameOverScreen
          onRestart={handleStartMission}
          stats={stats}
          reason={gameOverReason}
          saveData={saveData}
          isNewHighScore={isNewHighScore}
        />
      )}

      {gameState === 'victory' && (
        <VictoryScreen
          onRestart={handleStartMission}
          stats={stats}
          saveData={saveData}
          isNewHighScore={isNewHighScore}
        />
      )}

      {gameState === 'paused' && (
        <PauseScreen
          onResume={handleTogglePause}
          onRestart={handleStartMission}
        />
      )}
    </div>
  );
}
