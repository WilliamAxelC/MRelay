import React from 'react';
import { Play, Pause, Disc3, ListMusic, Search, MessageSquare } from 'lucide-react';
import { cn } from '../lib/utils';

export type MobileTab = 'now-playing' | 'queue' | 'search' | 'chat';

interface MobileBottomNavProps {
  activeTab: MobileTab;
  onTabChange: (tab: MobileTab) => void;
  queueCount: number;
  unreadChatCount?: number;
  currentTitle?: string;
  isPlaying: boolean;
  onTogglePlay?: () => void;
  currentThumbnail?: string;
  isHost: boolean;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  activeTab,
  onTabChange,
  queueCount,
  unreadChatCount = 0,
  currentTitle,
  isPlaying,
  onTogglePlay,
  currentThumbnail,
  isHost
}) => {
  return (
    <div className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-zinc-950/95 backdrop-blur-xl border-t border-zinc-900 pb-safe">
      {/* Mini Player Bar (shown if not currently on the now-playing tab) */}
      {currentTitle && activeTab !== 'now-playing' && (
        <div 
          onClick={() => onTabChange('now-playing')}
          className="mx-3 -mt-3.5 mb-1.5 p-2 bg-zinc-900/90 border border-zinc-800 rounded-2xl flex items-center justify-between shadow-2xl backdrop-blur-md cursor-pointer active:scale-98 transition-all"
        >
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <div className="w-9 h-9 rounded-xl bg-zinc-800 overflow-hidden shrink-0 border border-zinc-700/50">
              {currentThumbnail ? (
                <img src={currentThumbnail} alt="Track" className="w-full h-full object-cover" />
              ) : (
                <Disc3 className="w-full h-full p-2 text-zinc-500 animate-spin" />
              )}
            </div>
            <div className="flex flex-col min-w-0 flex-1">
              <span className="text-xs font-bold text-white truncate">{currentTitle}</span>
              <span className="text-[10px] text-emerald-400 font-mono flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                {isPlaying ? 'Playing in Jam' : 'Paused'}
              </span>
            </div>
          </div>
          {isHost && onTogglePlay && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onTogglePlay();
              }}
              className="w-8 h-8 rounded-full bg-white text-black flex items-center justify-center shadow-lg active:scale-90 transition-transform shrink-0 ml-2"
            >
              {isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current ml-0.5" />}
            </button>
          )}
        </div>
      )}

      {/* Navigation Buttons */}
      <div className="flex items-center justify-around px-2 py-1">
        <button
          onClick={() => onTabChange('now-playing')}
          className={cn(
            "flex flex-col items-center justify-center py-2 px-3 rounded-2xl transition-all relative",
            activeTab === 'now-playing' ? "text-emerald-400 font-bold" : "text-zinc-500 hover:text-zinc-300"
          )}
        >
          <Disc3 className={cn("w-5 h-5 transition-transform", activeTab === 'now-playing' && "scale-110 animate-spin [animation-duration:8s]")} />
          <span className="text-[10px] tracking-tight mt-0.5">Player</span>
        </button>

        <button
          onClick={() => onTabChange('queue')}
          className={cn(
            "flex flex-col items-center justify-center py-2 px-3 rounded-2xl transition-all relative",
            activeTab === 'queue' ? "text-emerald-400 font-bold" : "text-zinc-500 hover:text-zinc-300"
          )}
        >
          <div className="relative">
            <ListMusic className="w-5 h-5" />
            {queueCount > 0 && (
              <span className="absolute -top-1.5 -right-2 bg-emerald-500 text-black text-[9px] font-black px-1.5 py-0.2 rounded-full">
                {queueCount}
              </span>
            )}
          </div>
          <span className="text-[10px] tracking-tight mt-0.5">Queue</span>
        </button>

        <button
          onClick={() => onTabChange('search')}
          className={cn(
            "flex flex-col items-center justify-center py-2 px-3 rounded-2xl transition-all relative",
            activeTab === 'search' ? "text-emerald-400 font-bold" : "text-zinc-500 hover:text-zinc-300"
          )}
        >
          <Search className="w-5 h-5" />
          <span className="text-[10px] tracking-tight mt-0.5">Search</span>
        </button>

        <button
          onClick={() => onTabChange('chat')}
          className={cn(
            "flex flex-col items-center justify-center py-2 px-3 rounded-2xl transition-all relative",
            activeTab === 'chat' ? "text-emerald-400 font-bold" : "text-zinc-500 hover:text-zinc-300"
          )}
        >
          <div className="relative">
            <MessageSquare className="w-5 h-5" />
            {unreadChatCount > 0 && (
              <span className="absolute -top-1 -right-1.5 w-2 h-2 rounded-full bg-blue-500 animate-ping" />
            )}
          </div>
          <span className="text-[10px] tracking-tight mt-0.5">Chat</span>
        </button>
      </div>
    </div>
  );
};
