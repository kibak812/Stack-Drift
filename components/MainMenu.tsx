import React from 'react';
import { Trophy, Settings, Play } from 'lucide-react';

interface MainMenuProps {
  onStart: () => void;
  highScore: number;
}

export const MainMenu: React.FC<MainMenuProps> = ({ onStart, highScore }) => {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900 z-20">
      <div className="mb-12 text-center">
        <h1 className="text-5xl font-black text-white italic tracking-tighter transform -skew-x-12 mb-2">
          STACK <span className="text-rose-500">DRIFT</span>
        </h1>
        <p className="text-slate-400 text-sm tracking-widest uppercase">화면 좌/우를 눌러 드리프트하세요</p>
      </div>

      <button 
        onClick={onStart}
        className="group relative px-12 py-6 bg-rose-500 rounded-2xl shadow-[0_0_40px_rgba(244,63,94,0.4)] active:scale-95 transition-all mb-8"
      >
        <div className="absolute inset-0 bg-white opacity-0 group-hover:opacity-20 rounded-2xl transition-opacity" />
        <Play className="w-12 h-12 text-white fill-current" />
      </button>

      <div className="flex items-center space-x-2 text-slate-300 bg-slate-800/50 px-6 py-3 rounded-full border border-slate-700">
        <Trophy className="w-5 h-5 text-yellow-400" />
        <span className="font-bold font-mono text-xl">{highScore}</span>
      </div>

      <div className="absolute bottom-8 flex space-x-6">
         <button className="p-3 bg-slate-800 rounded-full text-slate-400 hover:text-white hover:bg-slate-700 transition-colors">
            <Settings className="w-6 h-6" />
         </button>
      </div>
    </div>
  );
};