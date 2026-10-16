import React from 'react';
import { GameStats } from '../game/rules';
import { Shield, Flame, Gem, Volume2, VolumeX, Pause, Play, Crosshair } from 'lucide-react';

interface HUDProps {
  stats: GameStats;
  isMuted: boolean;
  onToggleMute: () => void;
  onTogglePause: () => void;
  isPaused: boolean;
  onFireLaser: () => void;
  hasDamageFlash: boolean;
}

export const HUD: React.FC<HUDProps> = ({
  stats,
  isMuted,
  onToggleMute,
  onTogglePause,
  isPaused,
  onFireLaser,
  hasDamageFlash,
}) => {
  const shieldPercent = Math.max(0, Math.min(100, Math.round(stats.shields)));
  const fuelPercent = Math.max(0, Math.min(100, Math.round(stats.fuel)));
  const isFuelCritical = stats.fuel < 25;
  const isShieldCritical = stats.shields < 30;

  return (
    <div
      className={`fixed inset-0 pointer-events-none z-10 flex flex-col justify-between p-3 md:p-6 transition-colors duration-150 ${
        hasDamageFlash ? 'bg-red-500/20' : ''
      }`}
    >
      {/* Top HUD Cluster: Neon Shields, Fuel, and Scrap Ore */}
      <header className="flex flex-col gap-2 w-full max-w-6xl mx-auto">
        {/* Row 1: Side-by-side Shields & Fuel */}
        <div className="flex items-center gap-2 w-full">
          {/* Shields Progress Bar */}
          <div
            className={`flex-1 p-2 rounded-lg border backdrop-blur-none transition-all ${
              isShieldCritical
                ? 'bg-red-950/80 border-red-500 text-red-400 shadow-[0_0_15px_rgba(239,68,68,0.4)]'
                : 'bg-gray-900/85 border-cyan-500/60 text-cyan-300 shadow-[0_0_10px_rgba(6,182,212,0.25)]'
            }`}
          >
            <div className="flex items-center justify-between text-[11px] sm:text-xs font-mono font-semibold tracking-wider mb-1">
              <span className="flex items-center gap-1">
                <Shield className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-cyan-400" />
                SHIELDS
              </span>
              <span className="tabular-nums font-bold text-xs sm:text-sm">
                {shieldPercent}%
              </span>
            </div>
            <div className="w-full bg-gray-950 h-2 sm:h-2.5 rounded-full overflow-hidden border border-cyan-900/60">
              <div
                className={`h-full transition-all duration-150 rounded-full ${
                  isShieldCritical
                    ? 'bg-gradient-to-r from-red-600 to-rose-400'
                    : 'bg-gradient-to-r from-cyan-600 via-teal-400 to-cyan-300'
                }`}
                style={{ width: `${shieldPercent}%` }}
              />
            </div>
          </div>

          {/* Fuel Progress Bar */}
          <div
            className={`flex-1 p-2 rounded-lg border backdrop-blur-none transition-all ${
              isFuelCritical
                ? 'bg-amber-950/80 border-amber-500 text-amber-400 shadow-[0_0_15px_rgba(245,158,11,0.4)]'
                : 'bg-gray-900/85 border-purple-500/60 text-purple-300 shadow-[0_0_10px_rgba(168,85,247,0.25)]'
            }`}
          >
            <div className="flex items-center justify-between text-[11px] sm:text-xs font-mono font-semibold tracking-wider mb-1">
              <span className="flex items-center gap-1">
                <Flame className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-purple-400" />
                FUEL
              </span>
              <span className="tabular-nums font-bold text-xs sm:text-sm">
                {fuelPercent}%
              </span>
            </div>
            <div className="w-full bg-gray-950 h-2 sm:h-2.5 rounded-full overflow-hidden border border-purple-900/60">
              <div
                className={`h-full transition-all duration-150 rounded-full ${
                  isFuelCritical
                    ? 'bg-gradient-to-r from-amber-600 to-yellow-400'
                    : 'bg-gradient-to-r from-purple-600 via-fuchsia-400 to-purple-300'
                }`}
                style={{ width: `${fuelPercent}%` }}
              />
            </div>
          </div>
        </div>

        {/* Row 2: Scrap Ore, Score, and Actions */}
        <div className="flex items-center justify-between gap-2 w-full">
          {/* Scrap Ore Counter */}
          <div className="flex items-center gap-2 bg-gray-900/90 border border-amber-500/70 px-3 py-1 rounded-lg shadow-[0_0_10px_rgba(251,191,36,0.25)]">
            <Gem className="w-4 h-4 text-amber-400" />
            <span className="text-[10px] font-mono uppercase tracking-wider text-amber-400">
              SCRAP
            </span>
            <div className="flex items-baseline gap-0.5 font-mono font-bold text-sm text-amber-300 tabular-nums">
              <span>{stats.scrap}</span>
              <span className="text-[10px] text-amber-500/70">/{stats.targetScrap}</span>
            </div>
            {stats.warpGateActive && (
              <span className="ml-1 px-1.5 py-0.5 rounded bg-cyan-500/20 border border-cyan-400 text-cyan-300 text-[10px] font-mono font-bold uppercase tracking-wider">
                WARP READY
              </span>
            )}
          </div>

          {/* Right: Score and Controls */}
          <div className="flex items-center gap-1.5">
            <div className="flex items-center bg-gray-900/85 border border-cyan-500/40 px-2.5 py-1 rounded-lg">
              <span className="text-xs font-mono font-bold text-cyan-200 tabular-nums">
                {Math.round(stats.score).toLocaleString()}
              </span>
            </div>

            <button
              onClick={onToggleMute}
              aria-label={isMuted ? 'Unmute game audio' : 'Mute game audio'}
              className="pointer-events-auto p-1.5 rounded-lg bg-gray-900/90 border border-gray-700 hover:border-cyan-400 text-gray-300 hover:text-cyan-300 transition-colors shadow-sm focus:outline-none"
              tabIndex={-1}
            >
              {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>

            <button
              onClick={onTogglePause}
              aria-label={isPaused ? 'Resume game' : 'Pause game'}
              className="pointer-events-auto p-1.5 rounded-lg bg-gray-900/90 border border-gray-700 hover:border-cyan-400 text-gray-300 hover:text-cyan-300 transition-colors shadow-sm focus:outline-none"
              tabIndex={-1}
            >
              {isPaused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </header>

      {/* Critical Warnings Notice in Center */}
      <div className="flex flex-col items-center justify-center my-auto pointer-events-none">
        {isFuelCritical && (
          <div className="bg-amber-950/90 border-2 border-amber-500 text-amber-300 px-4 py-1.5 rounded-md font-mono text-xs uppercase tracking-widest font-bold shadow-[0_0_20px_rgba(245,158,11,0.5)] mb-2">
            WARNING: LOW FUEL RESERVES - HARVEST GREEN CANISTERS
          </div>
        )}
        {stats.warpGateActive && (
          <div className="bg-cyan-950/90 border-2 border-cyan-400 text-cyan-300 px-5 py-2 rounded-md font-mono text-sm uppercase tracking-widest font-bold shadow-[0_0_25px_rgba(6,182,212,0.6)] animate-pulse">
            EXTRACTION WARP GATE SPAWNED - ENTER THE VORTEX TO ESCAPE
          </div>
        )}
      </div>

      {/* Bottom Footer Control Clues */}
      <footer className="w-full max-w-6xl mx-auto flex items-center justify-between text-xs font-mono text-gray-400 pb-1">
        <div className="hidden sm:block">
          <span className="text-cyan-400 font-semibold">WASD / ARROWS</span> Move Ship &bull;{' '}
          <span className="text-cyan-400 font-semibold">SPACE</span> Fire Lasers &bull;{' '}
          <span className="text-cyan-400 font-semibold">P / ESC</span> Pause &bull;{' '}
          <span className="text-cyan-400 font-semibold">M</span> Mute
        </div>

        {/* Desktop Quick Fire Button (also supports clicks) */}
        <button
          onClick={onFireLaser}
          className="pointer-events-auto hidden sm:flex items-center gap-1.5 px-3 py-1 bg-cyan-950/80 hover:bg-cyan-900 border border-cyan-500/50 hover:border-cyan-400 text-cyan-300 rounded text-xs font-mono tracking-wider transition-colors shadow-sm"
          tabIndex={-1}
        >
          <Crosshair className="w-3.5 h-3.5" />
          FIRE LASER [SPACE]
        </button>
      </footer>
    </div>
  );
};
