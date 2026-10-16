import React, { useRef, useState } from 'react';
import { Crosshair, ArrowUp, ArrowDown, ArrowLeft, ArrowRight } from 'lucide-react';

interface TouchControlsProps {
  onMoveChange: (x: number, y: number) => void;
  onFireChange: (firing: boolean) => void;
}

export const TouchControls: React.FC<TouchControlsProps> = ({
  onMoveChange,
  onFireChange,
}) => {
  const [activeDir, setActiveDir] = useState<string | null>(null);
  const activeKeys = useRef<{ up: boolean; down: boolean; left: boolean; right: boolean }>({
    up: false,
    down: false,
    left: false,
    right: false,
  });

  const updateVector = () => {
    let x = 0;
    let y = 0;
    if (activeKeys.current.left) x -= 1;
    if (activeKeys.current.right) x += 1;
    if (activeKeys.current.up) y += 1;
    if (activeKeys.current.down) y -= 1;
    onMoveChange(x, y);
  };

  const handleDirStart = (dir: 'up' | 'down' | 'left' | 'right') => {
    activeKeys.current[dir] = true;
    setActiveDir(dir);
    updateVector();
  };

  const handleDirEnd = (dir: 'up' | 'down' | 'left' | 'right') => {
    activeKeys.current[dir] = false;
    setActiveDir(null);
    updateVector();
  };

  return (
    <div className="fixed inset-x-0 bottom-3 px-4 z-20 flex items-end justify-between pointer-events-none md:hidden select-none">
      {/* Virtual D-Pad */}
      <div className="pointer-events-auto bg-gray-950/70 border border-cyan-500/40 rounded-2xl p-2.5 shadow-[0_0_15px_rgba(6,182,212,0.2)] grid grid-cols-3 gap-1.5 w-36 h-36">
        <div />
        <button
          onTouchStart={() => handleDirStart('up')}
          onTouchEnd={() => handleDirEnd('up')}
          onMouseDown={() => handleDirStart('up')}
          onMouseUp={() => handleDirEnd('up')}
          aria-label="Move Up"
          className={`flex items-center justify-center rounded-lg border border-cyan-500/50 ${
            activeDir === 'up' ? 'bg-cyan-500 text-gray-950' : 'bg-gray-900/80 text-cyan-400'
          }`}
        >
          <ArrowUp className="w-5 h-5" />
        </button>
        <div />

        <button
          onTouchStart={() => handleDirStart('left')}
          onTouchEnd={() => handleDirEnd('left')}
          onMouseDown={() => handleDirStart('left')}
          onMouseUp={() => handleDirEnd('left')}
          aria-label="Move Left"
          className={`flex items-center justify-center rounded-lg border border-cyan-500/50 ${
            activeDir === 'left' ? 'bg-cyan-500 text-gray-950' : 'bg-gray-900/80 text-cyan-400'
          }`}
        >
          <ArrowLeft className="w-5 h-5" />
        </button>

        <div className="flex items-center justify-center">
          <div className="w-2.5 h-2.5 rounded-full bg-cyan-400/50" />
        </div>

        <button
          onTouchStart={() => handleDirStart('right')}
          onTouchEnd={() => handleDirEnd('right')}
          onMouseDown={() => handleDirStart('right')}
          onMouseUp={() => handleDirEnd('right')}
          aria-label="Move Right"
          className={`flex items-center justify-center rounded-lg border border-cyan-500/50 ${
            activeDir === 'right' ? 'bg-cyan-500 text-gray-950' : 'bg-gray-900/80 text-cyan-400'
          }`}
        >
          <ArrowRight className="w-5 h-5" />
        </button>

        <div />
        <button
          onTouchStart={() => handleDirStart('down')}
          onTouchEnd={() => handleDirEnd('down')}
          onMouseDown={() => handleDirStart('down')}
          onMouseUp={() => handleDirEnd('down')}
          aria-label="Move Down"
          className={`flex items-center justify-center rounded-lg border border-cyan-500/50 ${
            activeDir === 'down' ? 'bg-cyan-500 text-gray-950' : 'bg-gray-900/80 text-cyan-400'
          }`}
        >
          <ArrowDown className="w-5 h-5" />
        </button>
        <div />
      </div>

      {/* Virtual Laser Cannon Button */}
      <div className="pointer-events-auto flex flex-col items-center gap-2">
        <button
          onTouchStart={() => onFireChange(true)}
          onTouchEnd={() => onFireChange(false)}
          onMouseDown={() => onFireChange(true)}
          onMouseUp={() => onFireChange(false)}
          aria-label="Fire Lasers"
          className="w-20 h-20 rounded-full bg-gradient-to-tr from-cyan-600 to-purple-600 active:from-cyan-400 active:to-purple-400 border-2 border-cyan-300 text-white flex flex-col items-center justify-center shadow-[0_0_20px_rgba(6,182,212,0.4)]"
        >
          <Crosshair className="w-7 h-7 mb-0.5" />
          <span className="text-[10px] font-mono font-bold tracking-wider">FIRE</span>
        </button>
      </div>
    </div>
  );
};
