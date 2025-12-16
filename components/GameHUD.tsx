import React from 'react';
import { GameScore, TurnQuality } from '../types';

interface GameHUDProps {
  score: GameScore;
}

export const GameHUD: React.FC<GameHUDProps> = ({ score }) => {
  return (
    <>
      {/* Fever Gauge - Ketchapp style: thin bar at absolute top */}
      <div className="absolute top-0 left-0 w-full h-1 z-20 pointer-events-none">
        {score.fever ? (
          <div
            className="h-full w-full animate-pulse"
            style={{
              background: 'linear-gradient(90deg, #f0abfc, #fb7185, #f0abfc, #fb7185)',
              backgroundSize: '200% 100%',
              animation: 'shimmer 1s linear infinite',
            }}
          />
        ) : (
          <div className="h-full w-full bg-slate-800/50">
            <div
              className="h-full transition-all duration-150 ease-out"
              style={{
                width: `${score.feverGauge}%`,
                background: score.feverGauge > 80
                  ? 'linear-gradient(90deg, #d946ef, #fb7185)'
                  : 'linear-gradient(90deg, #a855f7, #d946ef)',
                boxShadow: score.feverGauge > 50 ? '0 0 8px #d946ef' : 'none'
              }}
            />
          </div>
        )}
      </div>

      {/* Main HUD */}
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
    </>
  );
};