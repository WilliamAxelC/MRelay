import React from 'react';
import { Keyboard, X } from 'lucide-react';

interface ShortcutHelpModalProps {
  onClose: () => void;
}

const SHORTCUTS = [
  { key: 'Space / K', desc: 'Play or Pause playback' },
  { key: 'Left / J', desc: 'Rewind 10 seconds' },
  { key: 'Right / L', desc: 'Forward 10 seconds' },
  { key: 'N', desc: 'Skip to next track (Host)' },
  { key: 'P', desc: 'Back to previous track (Host)' },
  { key: 'M', desc: 'Toggle Audio Mute' },
  { key: 'F', desc: 'Toggle Fullscreen Party Mode' },
  { key: 'R', desc: 'Cycle Repeat Mode (Off/Track/Queue)' },
  { key: 'S', desc: 'Shuffle Queue (Host)' },
  { key: '?', desc: 'Open this Keyboard Shortcuts cheat sheet' },
  { key: 'Esc', desc: 'Close modals and exit fullscreen' },
];

export const ShortcutHelpModal: React.FC<ShortcutHelpModalProps> = ({ onClose }) => {
  return (
    <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-zinc-950 border border-zinc-800 rounded-3xl p-6 shadow-2xl space-y-6">
        <div className="flex items-center justify-between border-b border-zinc-900 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Keyboard className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-black text-white uppercase tracking-wider">Keyboard Shortcuts</h3>
              <p className="text-[11px] text-zinc-500">Power user controls</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-zinc-900 rounded-xl text-zinc-400 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
          {SHORTCUTS.map((s) => (
            <div
              key={s.key}
              className="flex items-center justify-between p-3 bg-zinc-900/60 rounded-2xl border border-zinc-800/80 text-xs"
            >
              <span className="text-zinc-300 font-medium">{s.desc}</span>
              <kbd className="px-2.5 py-1 bg-zinc-800 border border-zinc-700 rounded-lg text-white font-mono font-bold text-[11px] shadow-sm">
                {s.key}
              </kbd>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
