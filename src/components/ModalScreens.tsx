import React from 'react';
import { Rocket, RotateCcw, Play, Trophy, ShieldAlert, Award, Gem, Flame, Shield } from 'lucide-react';
import { PersistentData } from '../game/types';
import { GameStats } from '../game/rules';

interface StartScreenProps {
  onStart: () => void;
  saveData: PersistentData;
}

export const StartScreen: React.FC<StartScreenProps> = ({ onStart, saveData }) => {
  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center p-4 bg-gray-950/90 pointer-events-auto">
      <div className="max-w-xl w-full bg-gray-900 border-2 border-cyan-500/80 rounded-2xl p-6 sm:p-8 shadow-[0_0_35px_rgba(6,182,212,0.3)] text-center relative overflow-hidden">
        {/* Cyberpunk Top Accent Bar */}
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-purple-500 via-cyan-400 to-purple-500" />

        {/* Bespoke Title Lockup */}
        <div className="inline-flex items-center gap-2 px-3 py-1 bg-cyan-950/80 border border-cyan-500/50 rounded-full text-cyan-300 font-mono text-xs uppercase tracking-widest mb-3">
          Deep Space Extraction Roguelike 3D
        </div>

        <h1 className="text-3xl sm:text-5xl font-black font-mono tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-teal-200 to-purple-400 mb-2">
          VOID EXTRACTOR
        </h1>

        <p className="text-sm sm:text-base text-gray-300 mb-6 max-w-md mx-auto">
          Navigate asteroid belts, outmaneuver sentinel tracking drones, harvest glowing fuel canisters, and extract <span className="text-amber-400 font-semibold">20 Scrap Ore</span> to power the Extraction Warp Gate!
        </p>

        {/* Mission Directives Grid */}
        <div className="grid grid-cols-3 gap-2.5 mb-6 text-left font-mono">
          <div className="bg-gray-950/80 border border-cyan-500/30 p-2.5 rounded-lg flex flex-col justify-between">
            <div className="flex items-center gap-1.5 text-cyan-400 text-xs font-bold mb-1">
              <Shield className="w-3.5 h-3.5" />
              SHIELDS
            </div>
            <p className="text-[11px] text-gray-400 leading-tight">
              Diminished by asteroids & drones.
            </p>
          </div>

          <div className="bg-gray-950/80 border border-purple-500/30 p-2.5 rounded-lg flex flex-col justify-between">
            <div className="flex items-center gap-1.5 text-purple-400 text-xs font-bold mb-1">
              <Flame className="w-3.5 h-3.5" />
              FUEL
            </div>
            <p className="text-[11px] text-gray-400 leading-tight">
              Drains continuously. Catch green cells.
            </p>
          </div>

          <div className="bg-gray-950/80 border border-amber-500/30 p-2.5 rounded-lg flex flex-col justify-between">
            <div className="flex items-center gap-1.5 text-amber-400 text-xs font-bold mb-1">
              <Gem className="w-3.5 h-3.5" />
              20 SCRAP
            </div>
            <p className="text-[11px] text-gray-400 leading-tight">
              Spawns Warp Gate in center to win!
            </p>
          </div>
        </div>

        {/* High Score & Lifetime Persistence Stats */}
        <div className="flex items-center justify-around bg-gray-950/70 border border-gray-800 rounded-xl p-3 mb-6 text-xs font-mono">
          <div>
            <div className="text-gray-400">BEST SCORE</div>
            <div className="text-cyan-300 font-bold text-base tabular-nums">
              {saveData.highScore.toLocaleString()}
            </div>
          </div>
          <div className="h-6 w-px bg-gray-800" />
          <div>
            <div className="text-gray-400">LIFETIME SCRAP</div>
            <div className="text-amber-300 font-bold text-base tabular-nums">
              {saveData.totalScrapCollected}
            </div>
          </div>
          <div className="h-6 w-px bg-gray-800" />
          <div>
            <div className="text-gray-400">EXTRACTIONS</div>
            <div className="text-purple-300 font-bold text-base tabular-nums">
              {saveData.missionsCompleted}
            </div>
          </div>
        </div>

        {/* Primary Action Button */}
        <button
          onClick={onStart}
          data-start="true"
          className="w-full py-4 px-6 bg-gradient-to-r from-cyan-500 via-teal-500 to-purple-600 hover:from-cyan-400 hover:to-purple-500 text-gray-950 font-mono font-black text-lg sm:text-xl rounded-xl shadow-[0_0_25px_rgba(6,182,212,0.6)] hover:shadow-[0_0_35px_rgba(6,182,212,0.8)] transition-all flex items-center justify-center gap-2 group cursor-pointer"
        >
          <Rocket className="w-6 h-6 transition-transform group-hover:-translate-y-1" />
          LAUNCH MISSION
        </button>

        <p className="mt-3 text-xs font-mono text-gray-500">
          Press <kbd className="px-1.5 py-0.5 bg-gray-800 rounded border border-gray-700 text-gray-300">ENTER</kbd> or <kbd className="px-1.5 py-0.5 bg-gray-800 rounded border border-gray-700 text-gray-300">SPACE</kbd> to Launch
        </p>
      </div>
    </div>
  );
};

interface GameOverScreenProps {
  onRestart: () => void;
  stats: GameStats;
  reason: string;
  saveData: PersistentData;
  isNewHighScore: boolean;
}

export const GameOverScreen: React.FC<GameOverScreenProps> = ({
  onRestart,
  stats,
  reason,
  saveData,
  isNewHighScore,
}) => {
  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center p-4 bg-gray-950/92 pointer-events-auto">
      <div className="max-w-md w-full bg-gray-900 border-2 border-red-500/80 rounded-2xl p-6 sm:p-8 shadow-[0_0_40px_rgba(239,68,68,0.35)] text-center relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-red-600 via-rose-500 to-amber-600" />

        <div className="inline-flex items-center justify-center w-14 h-14 bg-red-950/80 border border-red-500/60 rounded-full mb-3 text-red-400">
          <ShieldAlert className="w-8 h-8" />
        </div>

        <h2 className="text-3xl font-black font-mono tracking-tight text-red-400 mb-1">
          MISSION FAILED
        </h2>

        <p className="text-sm font-mono text-gray-300 mb-6 bg-red-950/50 border border-red-900/60 py-2 px-3 rounded-lg">
          {reason || 'Vessel Destroyed in the Deep Void'}
        </p>

        {isNewHighScore && (
          <div className="mb-4 py-1.5 px-3 bg-amber-500/20 border border-amber-400/60 text-amber-300 rounded-lg text-xs font-mono font-bold flex items-center justify-center gap-2">
            <Trophy className="w-4 h-4 text-amber-400" />
            NEW PERSONAL HIGH SCORE!
          </div>
        )}

        {/* Stats Summary */}
        <div className="grid grid-cols-2 gap-3 mb-6 font-mono text-left">
          <div className="bg-gray-950/80 border border-gray-800 p-3 rounded-xl">
            <span className="text-[10px] text-gray-400 uppercase tracking-wider">Mission Score</span>
            <div className="text-xl font-bold text-cyan-300 tabular-nums">
              {Math.round(stats.score).toLocaleString()}
            </div>
          </div>

          <div className="bg-gray-950/80 border border-gray-800 p-3 rounded-xl">
            <span className="text-[10px] text-gray-400 uppercase tracking-wider">Scrap Harvested</span>
            <div className="text-xl font-bold text-amber-300 tabular-nums">
              {stats.scrap} / {stats.targetScrap}
            </div>
          </div>

          <div className="bg-gray-950/80 border border-gray-800 p-3 rounded-xl col-span-2 flex items-center justify-between">
            <span className="text-xs text-gray-400">All-Time Record:</span>
            <span className="text-sm font-bold text-cyan-400 tabular-nums">
              {saveData.highScore.toLocaleString()}
            </span>
          </div>
        </div>

        {/* Fully wired Re-Deploy Button */}
        <button
          onClick={onRestart}
          data-start="true"
          className="w-full py-3.5 px-6 bg-gradient-to-r from-red-600 via-rose-600 to-amber-600 hover:from-red-500 hover:to-amber-500 text-white font-mono font-black text-lg rounded-xl shadow-[0_0_25px_rgba(239,68,68,0.5)] transition-all flex items-center justify-center gap-2 group cursor-pointer"
        >
          <RotateCcw className="w-5 h-5 transition-transform group-hover:rotate-180 duration-300" />
          RE-DEPLOY
        </button>

        <p className="mt-3 text-xs font-mono text-gray-500">
          Press <kbd className="px-1.5 py-0.5 bg-gray-800 rounded border border-gray-700 text-gray-300">ENTER</kbd> to Re-Deploy
        </p>
      </div>
    </div>
  );
};

interface VictoryScreenProps {
  onRestart: () => void;
  stats: GameStats;
  saveData: PersistentData;
  isNewHighScore: boolean;
}

export const VictoryScreen: React.FC<VictoryScreenProps> = ({
  onRestart,
  stats,
  saveData,
  isNewHighScore,
}) => {
  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center p-4 bg-gray-950/92 pointer-events-auto">
      <div className="max-w-md w-full bg-gray-900 border-2 border-cyan-400 rounded-2xl p-6 sm:p-8 shadow-[0_0_40px_rgba(34,211,238,0.4)] text-center relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-cyan-400 via-teal-300 to-purple-400" />

        <div className="inline-flex items-center justify-center w-14 h-14 bg-cyan-950/80 border border-cyan-400 rounded-full mb-3 text-cyan-300 animate-bounce">
          <Award className="w-8 h-8" />
        </div>

        <h2 className="text-3xl font-black font-mono tracking-tight text-cyan-300 mb-1">
          EXTRACTION SUCCESSFUL!
        </h2>

        <p className="text-sm font-mono text-gray-300 mb-6 bg-cyan-950/50 border border-cyan-800/60 py-2 px-3 rounded-lg">
          Warp Jump Initiated &bull; Scrap Ore Secured For High Command
        </p>

        {isNewHighScore && (
          <div className="mb-4 py-1.5 px-3 bg-amber-500/20 border border-amber-400/60 text-amber-300 rounded-lg text-xs font-mono font-bold flex items-center justify-center gap-2">
            <Trophy className="w-4 h-4 text-amber-400" />
            NEW ALL-TIME RECORD ESTABLISHED!
          </div>
        )}

        {/* Stats Summary */}
        <div className="grid grid-cols-2 gap-3 mb-6 font-mono text-left">
          <div className="bg-gray-950/80 border border-cyan-900/60 p-3 rounded-xl">
            <span className="text-[10px] text-gray-400 uppercase tracking-wider">Final Score</span>
            <div className="text-xl font-bold text-cyan-300 tabular-nums">
              {Math.round(stats.score).toLocaleString()}
            </div>
          </div>

          <div className="bg-gray-950/80 border border-amber-900/60 p-3 rounded-xl">
            <span className="text-[10px] text-gray-400 uppercase tracking-wider">Scrap Recovered</span>
            <div className="text-xl font-bold text-amber-300 tabular-nums">
              {stats.scrap} / {stats.targetScrap}
            </div>
          </div>

          <div className="bg-gray-950/80 border border-purple-900/60 p-3 rounded-xl col-span-2 flex items-center justify-between">
            <span className="text-xs text-gray-400">Total Missions Completed:</span>
            <span className="text-sm font-bold text-purple-300 tabular-nums">
              {saveData.missionsCompleted}
            </span>
          </div>
        </div>

        {/* Fully wired Re-Deploy Button */}
        <button
          onClick={onRestart}
          data-start="true"
          className="w-full py-3.5 px-6 bg-gradient-to-r from-cyan-400 via-teal-400 to-purple-500 hover:from-cyan-300 hover:to-purple-400 text-gray-950 font-mono font-black text-lg rounded-xl shadow-[0_0_25px_rgba(34,211,238,0.5)] transition-all flex items-center justify-center gap-2 group cursor-pointer"
        >
          <RotateCcw className="w-5 h-5 transition-transform group-hover:rotate-180 duration-300" />
          RE-DEPLOY
        </button>

        <p className="mt-3 text-xs font-mono text-gray-500">
          Press <kbd className="px-1.5 py-0.5 bg-gray-800 rounded border border-gray-700 text-gray-300">ENTER</kbd> to Re-Deploy
        </p>
      </div>
    </div>
  );
};

interface PauseScreenProps {
  onResume: () => void;
  onRestart: () => void;
}

export const PauseScreen: React.FC<PauseScreenProps> = ({ onResume, onRestart }) => {
  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center p-4 bg-gray-950/85 pointer-events-auto">
      <div className="max-w-sm w-full bg-gray-900 border-2 border-purple-500/80 rounded-2xl p-6 shadow-[0_0_35px_rgba(168,85,247,0.3)] text-center">
        <h2 className="text-2xl font-black font-mono tracking-tight text-purple-400 mb-2">
          MISSION PAUSED
        </h2>
        <p className="text-xs font-mono text-gray-400 mb-6">
          Thrusters suspended. Tactical systems standby.
        </p>

        <div className="flex flex-col gap-3 font-mono">
          <button
            onClick={onResume}
            className="w-full py-3 px-4 bg-cyan-600 hover:bg-cyan-500 text-gray-950 font-bold rounded-xl shadow-md transition-colors flex items-center justify-center gap-2 cursor-pointer"
          >
            <Play className="w-5 h-5" />
            RESUME FLIGHT
          </button>

          <button
            onClick={onRestart}
            data-start="true"
            className="w-full py-3 px-4 bg-gray-800 hover:bg-gray-700 text-gray-300 font-bold rounded-xl border border-gray-600 transition-colors flex items-center justify-center gap-2 cursor-pointer"
          >
            <RotateCcw className="w-5 h-5" />
            ABORT & RE-DEPLOY
          </button>
        </div>
      </div>
    </div>
  );
};
