import React, { useEffect, useRef, useState } from 'react';
import { 
  Play, Pause, SkipForward, RotateCcw, Volume2, 
  Repeat, Repeat1, Minimize2, Radio, QrCode
} from 'lucide-react';
import { cn } from '../lib/utils';

interface FullscreenPlayerProps {
  videoId: string;
  title: string;
  author?: string;
  addedBy?: { userId: string; username: string };
  isPlaying: boolean;
  isHost: boolean;
  volume: number;
  currentTime: number;
  totalDuration: number;
  repeatMode: 'off' | 'track' | 'queue';
  roomId: string;
  onPlay: () => void;
  onPause: () => void;
  onSkip: () => void;
  onBack: () => void;
  onSeek: (seconds: number) => void;
  onVolumeChange: (vol: number) => void;
  onToggleRepeat: () => void;
  onReact: (emoji: string) => void;
  onClose: () => void;
}

export const FullscreenPlayer: React.FC<FullscreenPlayerProps> = ({
  videoId,
  title,
  author,
  addedBy,
  isPlaying,
  isHost,
  volume,
  currentTime,
  totalDuration,
  repeatMode,
  roomId,
  onPlay,
  onPause,
  onSkip,
  onBack,
  onSeek,
  onVolumeChange,
  onToggleRepeat,
  onReact,
  onClose
}) => {
  const visualizerCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const qrCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [showQr, setShowQr] = useState(false);
  const [isScrubbing, setIsScrubbing] = useState(false);
  const [scrubValue, setScrubValue] = useState(0);

  const displayTime = isScrubbing ? scrubValue : currentTime;
  const effectiveDuration = totalDuration > 0 ? totalDuration : (displayTime > 0 ? Math.max(displayTime, 180) : 180);

  const formatTime = (secs: number) => {
    if (isNaN(secs) || secs < 0) return '0:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const inviteUrl = `${window.location.origin}/room/${roomId.toLowerCase()}`;

  // Keyboard shortcut listener for Esc
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === ' ' && isHost) {
        e.preventDefault();
        if (isPlaying) onPause();
        else onPlay();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, isHost, isPlaying, onPause, onPlay]);

  // QR Code Canvas Render
  useEffect(() => {
    if (!showQr) return;
    const canvas = qrCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(inviteUrl)}&color=ffffff&bgcolor=18181b&margin=1`;
    img.onload = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    };
  }, [showQr, inviteUrl]);

  // Audio Visualizer Canvas Loop
  useEffect(() => {
    const canvas = visualizerCanvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const handleResize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };

    handleResize();
    window.addEventListener('resize', handleResize);

    let animId: number;
    let phase = 0;

    const render = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      if (isPlaying) {
        phase += 0.04;
        const numBars = 64;
        const barWidth = canvas.width / numBars;
        const centerY = canvas.height * 0.85;

        for (let i = 0; i < numBars; i++) {
          const distance = Math.abs(i - numBars / 2) / (numBars / 2);
          const envelope = Math.cos(distance * Math.PI * 0.5);
          const wave = Math.sin(phase + i * 0.25) * Math.cos(phase * 0.7 + i * 0.1);
          const barHeight = Math.max(8, (Math.abs(wave) * 90 + Math.sin(phase * 2 + i) * 20) * envelope);

          const gradient = ctx.createLinearGradient(0, centerY - barHeight, 0, centerY + barHeight);
          gradient.addColorStop(0, 'rgba(52, 211, 153, 0.8)');
          gradient.addColorStop(0.5, 'rgba(16, 185, 129, 0.4)');
          gradient.addColorStop(1, 'rgba(5, 150, 105, 0.05)');

          ctx.fillStyle = gradient;
          ctx.beginPath();
          ctx.roundRect(i * barWidth + 2, centerY - barHeight / 2, barWidth - 4, barHeight, 6);
          ctx.fill();
        }
      }

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);
    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', handleResize);
    };
  }, [isPlaying]);

  const thumbnailUrl = videoId 
    ? `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`
    : '';

  const fallbackThumbnailUrl = videoId
    ? `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`
    : '';

  return (
    <div className="fixed inset-0 z-[120] bg-black flex flex-col justify-between p-6 md:p-12 overflow-hidden select-none animate-in fade-in duration-300">
      {/* Background Glow */}
      <div 
        className="absolute inset-0 opacity-30 blur-3xl scale-125 pointer-events-none transition-all duration-1000 -z-10"
        style={{
          backgroundImage: `url(${thumbnailUrl || fallbackThumbnailUrl})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center'
        }}
      />

      {/* Visualizer Canvas */}
      <canvas ref={visualizerCanvasRef} className="absolute inset-0 pointer-events-none z-0" />

      {/* Top Header */}
      <div className="flex items-center justify-between z-10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-zinc-900/80 border border-zinc-800 flex items-center justify-center">
            <Radio className="w-5 h-5 text-emerald-400 animate-pulse" />
          </div>
          <div>
            <h3 className="text-sm font-black uppercase italic text-white tracking-wider">Muser Jam Live</h3>
            <p className="text-[11px] font-mono text-zinc-400">ROOM #{roomId}</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowQr(!showQr)}
            className="p-3 bg-zinc-900/80 hover:bg-zinc-800 text-zinc-300 hover:text-white rounded-2xl border border-zinc-800 transition-all flex items-center gap-2"
            title="Toggle Join QR Code"
          >
            <QrCode className="w-5 h-5 text-emerald-400" />
            <span className="text-xs font-bold hidden sm:inline">Join Party</span>
          </button>
          <button
            onClick={onClose}
            className="p-3 bg-zinc-900/80 hover:bg-zinc-800 text-zinc-400 hover:text-white rounded-2xl border border-zinc-800 transition-all"
            title="Exit Fullscreen (Esc)"
          >
            <Minimize2 className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* QR Code Popout */}
      {showQr && (
        <div className="absolute top-24 right-12 z-50 p-6 bg-zinc-950/95 border border-zinc-800 rounded-3xl shadow-2xl backdrop-blur-2xl flex flex-col items-center space-y-3 animate-in fade-in duration-200">
          <div className="p-3 bg-zinc-900 rounded-2xl border border-zinc-800 shadow-xl">
            <canvas ref={qrCanvasRef} width={180} height={180} className="w-44 h-44 rounded-xl" />
          </div>
          <span className="text-xs font-bold text-white uppercase tracking-wider">Scan to Join Jam</span>
          <span className="text-[10px] text-zinc-400 font-mono">#{roomId}</span>
        </div>
      )}

      {/* Centerpiece Hero */}
      <div className="flex flex-col items-center text-center max-w-2xl mx-auto my-auto space-y-8 z-10">
        <div className="relative w-64 h-64 sm:w-80 sm:h-80 rounded-3xl overflow-hidden shadow-2xl border border-zinc-800/80 bg-zinc-900">
          {videoId ? (
            <img
              src={thumbnailUrl}
              onError={(e) => { (e.target as HTMLImageElement).src = fallbackThumbnailUrl; }}
              alt={title}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-zinc-600">
              <Radio className="w-16 h-16 animate-pulse" />
            </div>
          )}
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl sm:text-4xl font-black text-white tracking-tight line-clamp-2" title={title}>
            {title || 'Session Idle'}
          </h1>
          <div className="flex items-center justify-center gap-2 text-sm sm:text-base text-zinc-400 font-medium">
            <span>{author || 'Muser Jam'}</span>
            {addedBy && (
              <>
                <span className="text-zinc-600">•</span>
                <span className="text-emerald-400">Added by @{addedBy.username}</span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Bottom Controls & Reactions */}
      <div className="max-w-3xl w-full mx-auto space-y-6 z-10">
        {/* Quick Reactions Bar */}
        <div className="flex items-center justify-center gap-2">
          {['🔥', '❤️', '🎉', '🎵', '👏', '🚀', '😍'].map((emoji) => (
            <button
              key={emoji}
              onClick={() => onReact(emoji)}
              className="w-11 h-11 bg-zinc-900/80 hover:bg-zinc-800 border border-zinc-800 rounded-2xl text-xl flex items-center justify-center transition-all hover:scale-125 active:scale-95 shadow-lg"
            >
              {emoji}
            </button>
          ))}
        </div>

        {/* Scrubber */}
        <div className="space-y-2">
          <input
            type="range"
            min={0}
            max={effectiveDuration}
            step={0.5}
            value={displayTime}
            disabled={!isHost}
            onMouseDown={() => setIsScrubbing(true)}
            onTouchStart={() => setIsScrubbing(true)}
            onChange={(e) => setScrubValue(parseFloat(e.target.value))}
            onMouseUp={() => { setIsScrubbing(false); onSeek(scrubValue); }}
            onTouchEnd={() => { setIsScrubbing(false); onSeek(scrubValue); }}
            className="w-full h-2 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-emerald-400 hover:h-2.5 transition-all disabled:opacity-40"
          />
          <div className="flex justify-between text-xs font-mono text-zinc-500">
            <span>{formatTime(displayTime)}</span>
            <span>{formatTime(effectiveDuration)}</span>
          </div>
        </div>

        {/* Playback Buttons */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              onClick={onToggleRepeat}
              disabled={!isHost}
              className={cn(
                "p-3 rounded-2xl transition-all border",
                repeatMode !== 'off'
                  ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/40"
                  : "bg-zinc-900 text-zinc-500 border-zinc-800 hover:text-white"
              )}
            >
              {repeatMode === 'track' ? <Repeat1 className="w-5 h-5" /> : <Repeat className="w-5 h-5" />}
            </button>
          </div>

          <div className="flex items-center gap-6">
            <button
              onClick={onBack}
              disabled={!isHost}
              className="p-3.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white rounded-2xl border border-zinc-800 hover:scale-110 active:scale-95 transition-all disabled:opacity-20"
            >
              <RotateCcw className="w-6 h-6" />
            </button>

            <button
              onClick={isPlaying ? onPause : onPlay}
              disabled={!isHost || !videoId}
              className="w-18 h-18 bg-emerald-400 hover:bg-emerald-300 text-black rounded-full flex items-center justify-center shadow-2xl shadow-emerald-400/30 hover:scale-105 active:scale-95 transition-all disabled:opacity-30 p-5"
            >
              {isPlaying ? <Pause className="w-8 h-8 fill-current" /> : <Play className="w-8 h-8 fill-current ml-1" />}
            </button>

            <button
              onClick={onSkip}
              disabled={!isHost}
              className="p-3.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white rounded-2xl border border-zinc-800 hover:scale-110 active:scale-95 transition-all disabled:opacity-20"
            >
              <SkipForward className="w-6 h-6 fill-current" />
            </button>
          </div>

          <div className="flex items-center gap-2">
            <Volume2 className="w-5 h-5 text-zinc-500" />
            <input
              type="range"
              min={0}
              max={100}
              value={volume}
              onChange={(e) => onVolumeChange(parseInt(e.target.value))}
              className="w-24 h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-emerald-400"
            />
          </div>
        </div>
      </div>
    </div>
  );
};
