import React, { useState, useEffect } from 'react';
import { AppState, GameScore, TurnQuality } from './types';
import { GameEngine } from './components/GameEngine';
import { GameHUD } from './components/GameHUD';
import { MainMenu } from './components/MainMenu';
import { ResultScreen } from './components/ResultScreen';
import { ChallengeScreen } from './components/ChallengeScreen';
import { SharedScore, getSharedScoreFromUrl } from './utils/share';

const App: React.FC = () => {
  const [appState, setAppState] = useState<AppState>(AppState.MENU);
  const [gameScore, setGameScore] = useState<GameScore>({
    score: 0, highScore: 0, combo: 0, coins: 0, lastQuality: TurnQuality.NONE, fever: false, feverTimer: 0
  });
  const [reviveUsed, setReviveUsed] = useState(false);
  const [isReviving, setIsReviving] = useState(false);
  const [gameId, setGameId] = useState(0);
  const [challengeScore, setChallengeScore] = useState<SharedScore | null>(null);

  // Load high score from local storage and check for shared score in URL
  useEffect(() => {
    const saved = localStorage.getItem('stackdrift_highscore');
    if (saved) {
      setGameScore(prev => ({ ...prev, highScore: parseInt(saved) }));
    }

    // Check for shared score in URL
    const shared = getSharedScoreFromUrl();
    if (shared) {
      setChallengeScore(shared);
    }
  }, []);

  const handleStartGame = () => {
    setGameId(prev => prev + 1); // Force remount
    setAppState(AppState.PLAYING);
    setReviveUsed(false);
    setIsReviving(false);
    
    // Reset Score State immediately
    setGameScore(prev => ({
       score: 0, highScore: prev.highScore, combo: 0, coins: prev.coins, lastQuality: TurnQuality.NONE, fever: false, feverTimer: 0
    }));
  };

  const handleGameOver = (finalScore: GameScore) => {
    setGameScore(prev => {
      const newHighScore = Math.max(prev.highScore, finalScore.score);

      // Save High Score (using prev.highScore to avoid stale closure)
      if (finalScore.score > prev.highScore) {
        localStorage.setItem('stackdrift_highscore', finalScore.score.toString());
      }

      return { ...finalScore, highScore: newHighScore };
    });

    setAppState(AppState.RESULT);
  };

  const handleRevive = () => {
    setReviveUsed(true);
    setIsReviving(true);
    setAppState(AppState.PLAYING);
    setTimeout(() => setIsReviving(false), 100); 
  };

  return (
    <div className="relative w-full h-screen overflow-hidden bg-slate-900 font-sans select-none">
      
      {/* Game Layer */}
      {/* Explicitly check for MENU state to unmount game when in menu, but keep it during RESULT for background */}
      {/* Changing key={gameId} forces a full remount when restart is clicked */}
      {appState !== AppState.MENU && (
        <GameEngine 
          key={gameId} 
          onGameOver={handleGameOver} 
          onScoreUpdate={setGameScore}
          isReviving={isReviving}
        />
      )}

      {/* UI Overlay Layer */}
      {appState === AppState.PLAYING && <GameHUD score={gameScore} />}

      {/* Menus */}
      {appState === AppState.MENU && (
        <MainMenu onStart={handleStartGame} highScore={gameScore.highScore} />
      )}

      {appState === AppState.RESULT && (
        <ResultScreen
          score={gameScore}
          onRestart={handleStartGame}
          onRevive={handleRevive}
          canRevive={!reviveUsed}
        />
      )}

      {/* Challenge Screen - shown when opening a shared link */}
      {challengeScore && appState === AppState.MENU && (
        <ChallengeScreen
          challengeScore={challengeScore}
          myHighScore={gameScore.highScore}
          onAccept={() => {
            setChallengeScore(null);
            handleStartGame();
          }}
          onDismiss={() => setChallengeScore(null)}
        />
      )}
    </div>
  );
};

export default App;