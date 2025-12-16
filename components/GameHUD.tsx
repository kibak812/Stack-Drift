import React from 'react';
import { GameScore, TurnQuality } from '../types';

interface GameHUDProps {
  score: GameScore;
}

export const GameHUD: React.FC<GameHUDProps> = ({ score }) => {
  return (
    <div className="absolute top-0 left-0 w-full p-6 pointer-events-none z-10 flex flex-col items-center">

      {/* Score */}
      <div className="text-4xl font-black text-white drop-shadow-lg tracking-wider">
        {Math.floor(score.score)}
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
             <div className="text-lg font-bold text-green-400">GOOD</div>
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