import React from 'react';
import { GameScore, TurnQuality } from '../types';

interface GameHUDProps {
  score: GameScore;
}

// Minimal coin icon component
const CoinIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg
    viewBox="0 0 20 20"
    className={className}
    fill="none"
  >
    <circle cx="10" cy="10" r="8" fill="url(#coinGradient)" stroke="#d97706" strokeWidth="1.5"/>
    <circle cx="10" cy="10" r="5" stroke="#fbbf24" strokeWidth="1" opacity="0.6"/>
    <defs>
      <linearGradient id="coinGradient" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#fcd34d"/>
        <stop offset="50%" stopColor="#fbbf24"/>
        <stop offset="100%" stopColor="#f59e0b"/>
      </linearGradient>
    </defs>
  </svg>
);

export const GameHUD: React.FC<GameHUDProps> = ({ score }) => {
  return (
    <div className="absolute top-0 left-0 w-full p-6 pointer-events-none z-10 flex flex-col items-center">

      {/* Top bar: Score center, Coins right */}
      <div className="w-full flex items-start justify-between">
        {/* Left spacer for balance */}
        <div className="w-20" />

        {/* Score - centered */}
        <div className="text-4xl font-black text-white drop-shadow-lg tracking-wider">
          {Math.floor(score.score)}
        </div>

        {/* Coins - right aligned */}
        <div className="flex items-center gap-1.5 bg-slate-900/40 backdrop-blur-sm px-3 py-1.5 rounded-full">
          <CoinIcon className="w-5 h-5" />
          <span className="text-amber-300 font-bold text-sm tabular-nums">
            {score.coins}
          </span>
        </div>
      </div>

      {/* Combo / Quality Message */}
      <div className="mt-4 h-12 flex flex-col items-center justify-center">
         {score.combo > 1 && (
             <div className="text-2xl font-bold text-yellow-400 animate-pulse">
                 {score.combo}x COMBO
             </div>
         )}

         {score.lastQuality === TurnQuality.PERFECT && (
             <div className="text-xl font-bold text-cyan-400 scale-110 transition-transform">PERFECT!</div>
         )}
         {score.lastQuality === TurnQuality.GOOD && (
             <div className="text-lg font-bold text-yellow-400">GOOD</div>
         )}
         {score.lastQuality === TurnQuality.MISS && (
             <div className="text-lg font-bold text-red-400">MISS</div>
         )}
      </div>

      {/* Fever Mode indicator - only show text when active */}
      {score.fever && (
          <div className="text-fuchsia-400 font-black text-2xl animate-bounce drop-shadow-[0_0_10px_rgba(217,70,239,0.8)]">
              FEVER!
          </div>
      )}
    </div>
  );
};