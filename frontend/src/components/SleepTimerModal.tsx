import React from 'react';
import { Moon, X, Clock, Check } from 'lucide-react';

interface SleepTimerModalProps {
  currentRemainingSeconds: number | null;
  onSetTimer: (minutes: number | 'end_of_track') => void;
  onCancelTimer: () => void;
  onClose: () => void;
}

export const SleepTimerModal: React.FC<SleepTimerModalProps> = ({
  currentRemainingSeconds,
  onSetTimer,
  onCancelTimer,
  onClose
}) => {
  const formatCountdown = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const presets = [
    { label: '15 Minutes', value: 15 },
    { label: '30 Minutes', value: 30 },
    { label: '45 Minutes', value: 45 },
    { label: '60 Minutes', value: 60 },
    { label: 'End of Current Song', value: 'end_of_track' as const }
  ];

  return (
    <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-sm bg-zinc-950 border border-zinc-800 rounded-3xl p-6 shadow-2xl space-y-6">
        <div className="flex items-center justify-between border-b border-zinc-900 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400">
              <Moon className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-black text-white uppercase tracking-wider">Sleep Timer</h3>
              <p className="text-[11px] text-zinc-500">Auto-pause & fade out playback</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-zinc-900 rounded-xl text-zinc-400 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Active Timer Display */}
        {currentRemainingSeconds !== null && currentRemainingSeconds > 0 && (
          <div className="p-4 bg-purple-500/10 border border-purple-500/30 rounded-2xl flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <Clock className="w-5 h-5 text-purple-400 animate-pulse" />
              <div>
                <div className="text-xs font-bold text-white">Playback stopping in</div>
                <div className="text-lg font-mono font-black text-purple-400">
                  {formatCountdown(currentRemainingSeconds)}
                </div>
              </div>
            </div>
            <button
              onClick={() => { onCancelTimer(); onClose(); }}
              className="px-3 py-1.5 bg-red-500/20 hover:bg-red-500/30 text-red-400 text-xs font-bold rounded-xl border border-red-500/30 transition-colors"
            >
              Turn Off
            </button>
          </div>
        )}

        {/* Presets List */}
        <div className="space-y-2">
          {presets.map((p) => (
            <button
              key={p.label}
              onClick={() => {
                onSetTimer(p.value);
                onClose();
              }}
              className="w-full flex items-center justify-between p-3.5 rounded-2xl border border-zinc-800 bg-zinc-900/60 text-zinc-300 hover:bg-purple-950/30 hover:border-purple-500/40 hover:text-white transition-all text-xs font-bold text-left group"
            >
              <span>{p.label}</span>
              <Check className="w-4 h-4 opacity-0 group-hover:opacity-100 text-purple-400" />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
