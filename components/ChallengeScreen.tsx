import React from 'react';
import { Trophy, Target, X } from 'lucide-react';
import { SharedScore, formatRelativeTime, clearSharedScoreFromUrl } from '../utils/share';

interface ChallengeScreenProps {
  challengeScore: SharedScore;
  myHighScore: number;
  onAccept: () => void;
  onDismiss: () => void;
}

export const ChallengeScreen: React.FC<ChallengeScreenProps> = ({
  challengeScore,
  myHighScore,
  onAccept,
  onDismiss
}) => {
  const scoreDiff = myHighScore - challengeScore.score;
  const isWinning = scoreDiff > 0;
  const isTied = scoreDiff === 0;

  const handleDismiss = () => {
    clearSharedScoreFromUrl();
    onDismiss();
  };

  const handleAccept = () => {
    clearSharedScoreFromUrl();
    onAccept();
  };

  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900/98 z-40 backdrop-blur-md p-6">
      {/* Close button */}
      <button
        onClick={handleDismiss}
        className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white transition-colors"
      >
        <X className="w-6 h-6" />
      </button>

      {/* Title */}
      <div className="text-center mb-8">
        <Target className="w-12 h-12 text-cyan-400 mx-auto mb-3" />
        <h2 className="text-2xl font-bold text-white mb-1">CHALLENGE!</h2>
        <p className="text-slate-400 text-sm">누군가 점수를 공유했어요</p>
        <p className="text-slate-500 text-xs mt-1">{formatRelativeTime(challengeScore.timestamp)}</p>
      </div>

      {/* Score Comparison */}
      <div className="w-full max-w-xs space-y-4 mb-8">
        {/* Challenger Score */}
        <div className="bg-slate-800/80 rounded-xl p-4 border border-slate-700">
          <div className="text-slate-400 text-sm mb-1">상대 점수</div>
          <div className="text-4xl font-black text-rose-500">
            {Math.floor(challengeScore.score)}
          </div>
        </div>

        {/* VS Divider */}
        <div className="flex items-center justify-center">
          <div className="flex-1 h-px bg-slate-700" />
          <span className="px-4 text-slate-500 font-bold">VS</span>
          <div className="flex-1 h-px bg-slate-700" />
        </div>

        {/* My Score */}
        <div className="bg-slate-800/80 rounded-xl p-4 border border-cyan-700/50">
          <div className="flex items-center gap-2 text-cyan-400 text-sm mb-1">
            <Trophy className="w-4 h-4" />
            <span>내 최고 점수</span>
          </div>
          <div className="text-4xl font-black text-cyan-400">
            {myHighScore}
          </div>
        </div>

        {/* Result */}
        <div className={`text-center py-3 rounded-lg ${
          isWinning ? 'bg-emerald-900/50 text-emerald-400' :
          isTied ? 'bg-yellow-900/50 text-yellow-400' :
          'bg-rose-900/50 text-rose-400'
        }`}>
          {isWinning ? (
            <span className="font-bold">+{scoreDiff}점 앞서고 있어요!</span>
          ) : isTied ? (
            <span className="font-bold">동점이에요!</span>
          ) : (
            <span className="font-bold">{Math.abs(scoreDiff)}점 뒤처져 있어요!</span>
          )}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="w-full max-w-xs space-y-3">
        <button
          onClick={handleAccept}
          className="w-full py-4 bg-cyan-600 hover:bg-cyan-500 text-white font-bold rounded-xl shadow-lg transition-all active:scale-95 border-b-4 border-cyan-800"
        >
          {isWinning ? '기록 갱신하기!' : '도전하기!'}
        </button>
        <button
          onClick={handleDismiss}
          className="w-full py-3 bg-slate-700 hover:bg-slate-600 text-slate-300 font-bold rounded-xl transition-all active:scale-95"
        >
          나중에
        </button>
      </div>
    </div>
  );
};
