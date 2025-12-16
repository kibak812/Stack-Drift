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
      <div className="mt-4 h-16 flex flex-col items-center justify-center">
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

      {/* Fever Gauge / Fever Mode */}
      {score.fever ? (
          <div className="mt-2 text-fuchsia-400 font-black text-3xl animate-bounce">
              FEVER MODE!
          </div>
      ) : (
          <div className="mt-4 w-48">
            <div className="flex justify-between text-xs text-fuchsia-300 mb-1">
              <span>FEVER</span>
              <span>{Math.floor(score.feverGauge)}%</span>
            </div>
            <div className="h-3 bg-slate-700 rounded-full overflow-hidden border border-slate-600">
              <div
                className="h-full bg-gradient-to-r from-fuchsia-500 to-pink-400 transition-all duration-150 ease-out"
                style={{ width: `${score.feverGauge}%` }}
              />
            </div>
          </div>
      )}
    </div>
  );
};