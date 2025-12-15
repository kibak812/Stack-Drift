import React from 'react';
import { RefreshCw, PlayCircle } from 'lucide-react';
import { GameScore } from '../types';

interface ResultScreenProps {
  score: GameScore;
  onRestart: () => void;
  onRevive: () => void;
  canRevive: boolean;
}

export const ResultScreen: React.FC<ResultScreenProps> = ({ score, onRestart, onRevive, canRevive }) => {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900/95 z-30 backdrop-blur-sm p-6">
      
      <div className="text-center mb-8">
        <h2 className="text-3xl font-bold text-white mb-2">CRASHED!</h2>
        <div className="text-6xl font-black text-rose-500 drop-shadow-2xl">{Math.floor(score.score)}</div>
        <div className="text-slate-400 mt-2 font-mono">BEST: {score.highScore}</div>
      </div>

      <div className="grid gap-4 w-full max-w-xs">
        {/* Rewarded Ad: Revive */}
        {canRevive && (
          <button 
            onClick={onRevive}
            className="flex items-center justify-center space-x-3 w-full py-4 bg-cyan-600 hover:bg-cyan-500 text-white font-bold rounded-xl shadow-lg transition-all active:scale-95 border-b-4 border-cyan-800"
          >
            <PlayCircle className="w-6 h-6" />
            <span>REVIVE (Watch Ad)</span>
          </button>
        )}

        {/* Rewarded Ad: 2x Score (Visual only for MVP) */}
        <button 
          className="flex items-center justify-center space-x-3 w-full py-3 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-xl shadow-lg opacity-80"
        >
          <PlayCircle className="w-5 h-5" />
          <span>2x SCORE COINS</span>
        </button>

        {/* Interstitial Simulator logic would trigger on Restart */}
        <button 
          onClick={onRestart}
          className="mt-4 flex items-center justify-center space-x-3 w-full py-4 bg-slate-700 hover:bg-slate-600 text-white font-bold rounded-xl transition-all active:scale-95"
        >
          <RefreshCw className="w-6 h-6" />
          <span>RESTART</span>
        </button>
      </div>
    </div>
  );
};