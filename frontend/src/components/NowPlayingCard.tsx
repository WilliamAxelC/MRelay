import React, { useState } from 'react';
import { 
  Play, Pause, SkipForward, RotateCcw, Repeat, Repeat1, 
  Volume2, VolumeX, ShieldCheck, Zap, Radio, FastForward, Rewind,
  Heart, Mic2, Gauge
} from 'lucide-react';
import type { P2PStatus } from '../hooks/useP2P';
import { cn } from '../lib/utils';

interface NowPlayingCardProps {
  videoId: string;
  title: string;
  author?: string;
  duration?: string;
  addedBy?: { userId: string; username: string };
  isPlaying: boolean;
  isHost: boolean;
  isUnsynced: boolean;
  volume: number;
  dataSaver: boolean;
  repeatMode: 'off' | 'track' | 'queue';
  playbackRate?: number;
  isLiked?: boolean;
  p2pStatus: P2PStatus;
  p2pLatencyMs: number | null;
  currentTime: number;
  totalDuration: number;
  onPlay: () => void;
  onPause: () => void;
  onSkip: () => void;
  onBack: () => void;
  onSeek: (seconds: number) => void;
  onToggleRepeat: () => void;
  onToggleDataSaver: () => void;
  onToggleUnsynced: () => void;
  onVolumeChange: (vol: number) => void;
  onToggleLike?: () => void;
  onOpenLyrics?: () => void;
  onCyclePlaybackRate?: () => void;
  canGoBack: boolean;
  canSkip: boolean;
  audioUnlocked: boolean;
  onUnlockAudio: () => void;
}

export const NowPlayingCard: React.FC<NowPlayingCardProps> = ({
  videoId,
  title,
  author,
  addedBy,
  isPlaying,
  isHost,
  isUnsynced,
  volume,
  dataSaver,
  repeatMode,
  playbackRate = 1.0,
  isLiked = false,
  p2pStatus,
  p2pLatencyMs,
  currentTime,
  totalDuration,
  onPlay,
  onPause,
  onSkip,
  onBack,
  onSeek,
  onToggleRepeat,
  onToggleDataSaver,
  onToggleUnsynced,
  onVolumeChange,
  onToggleLike,
  onOpenLyrics,
  onCyclePlaybackRate,
  canGoBack,
  canSkip,
  audioUnlocked,
  onUnlockAudio
}) => {
  const [isScrubbing, setIsScrubbing] = useState(false);
  const [scrubValue, setScrubValue] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [prevVolume, setPrevVolume] = useState(volume);

  const displayTime = isScrubbing ? scrubValue : currentTime;
  const effectiveTotalDuration = totalDuration > 0 ? totalDuration : (displayTime > 0 ? Math.max(displayTime, 180) : 180);

  const formatTime = (secs: number) => {
    if (isNaN(secs) || secs < 0) return '0:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const handleScrubChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setScrubValue(parseFloat(e.target.value));
  };

  const handleScrubEnd = () => {
    setIsScrubbing(false);
    onSeek(scrubValue);
  };

  const handleToggleMute = () => {
    if (isMuted) {
      setIsMuted(false);
      onVolumeChange(prevVolume > 0 ? prevVolume : 50);
    } else {
      setPrevVolume(volume);
      setIsMuted(true);
      onVolumeChange(0);
    }
  };

  const thumbnailUrl = videoId 
    ? `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`
    : '';

  return (
    <div className="relative w-full max-w-xl mx-auto flex flex-col items-center p-6 md:p-8 bg-zinc-950/80 border border-zinc-800/80 rounded-[2.5rem] shadow-2xl backdrop-blur-2xl overflow-hidden group">
      {/* Dynamic Ambient Glow */}
      {thumbnailUrl && (
        <div 
          className="absolute inset-0 opacity-20 blur-3xl scale-125 pointer-events-none transition-all duration-1000 -z-10"
          style={{
            backgroundImage: `url(${thumbnailUrl})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center'
          }}
        />
      )}

      {/* Top Meta Chips */}
      <div className="w-full flex items-center justify-between gap-2 mb-4">
        {/* P2P Status Chip */}
        <div className="flex items-center gap-1.5 px-3 py-1 bg-zinc-900/90 border border-zinc-800 rounded-full text-[10px] font-bold tracking-wider uppercase text-zinc-400 shadow-sm">
          <Radio className={cn("w-3 h-3", p2pStatus === 'connected' ? "text-emerald-400 animate-pulse" : "text-blue-400")} />
          <span>{p2pStatus === 'connected' ? 'P2P Direct' : 'WebSocket Relay'}</span>
          {p2pLatencyMs !== null && (
            <span className="text-emerald-400 font-mono">({p2pLatencyMs}ms)</span>
          )}
        </div>

        {/* Mode Chips */}
        <div className="flex items-center gap-1.5">
          {!isHost && (
            <button
              onClick={onToggleUnsynced}
              className={cn(
                "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider transition-all border flex items-center gap-1",
                isUnsynced
                  ? "bg-amber-500/20 text-amber-400 border-amber-500/40"
                  : "bg-zinc-900 text-zinc-500 border-zinc-800 hover:text-zinc-300"
              )}
            >
              <ShieldCheck className="w-3 h-3" />
              <span>{isUnsynced ? 'Detached' : 'Synced'}</span>
            </button>
          )}

          <button
            onClick={onToggleDataSaver}
            className={cn(
              "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider transition-all border flex items-center gap-1",
              dataSaver
                ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/40"
                : "bg-zinc-900 text-zinc-500 border-zinc-800 hover:text-zinc-300"
            )}
          >
            <Zap className="w-3 h-3" />
            <span>{dataSaver ? 'Audio Saver' : 'Video'}</span>
          </button>
        </div>
      </div>

      {/* Album Art Box */}
      <div className="relative w-52 h-52 sm:w-60 sm:h-60 rounded-3xl overflow-hidden shadow-2xl border border-zinc-800/80 mb-4 group-hover:scale-[1.02] transition-transform duration-500 shrink-0 bg-zinc-900 flex items-center justify-center">
        {thumbnailUrl ? (
          <>
            <img 
              src={thumbnailUrl} 
              alt={title || 'Track Thumbnail'} 
              className={cn(
                "w-full h-full object-cover transition-all duration-700",
                dataSaver && "grayscale blur-sm scale-110"
              )}
            />
            {dataSaver && (
              <div className="absolute inset-0 bg-black/40 flex flex-col items-center justify-center text-center p-4">
                <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400 bg-emerald-950/80 px-2.5 py-1 rounded-full border border-emerald-500/40 mb-1">
                  Low Bandwidth Mode
                </span>
                <span className="text-xs text-zinc-300 font-medium">Audio rendering only</span>
              </div>
            )}
          </>
        ) : (
          <div className="flex flex-col items-center justify-center p-6 text-center text-zinc-600 space-y-2">
            <Radio className="w-10 h-10 animate-pulse text-zinc-700" />
            <span className="text-xs font-bold uppercase tracking-wider">No Track Selected</span>
          </div>
        )}
      </div>

      {/* Utilities Action Row: Like, Lyrics, Playback Speed */}
      <div className="flex items-center gap-3 mb-4">
        {videoId && onToggleLike && (
          <button
            onClick={onToggleLike}
            className={cn(
              "p-2 rounded-2xl border transition-all active:scale-90 flex items-center gap-1.5 text-xs font-bold",
              isLiked
                ? "bg-red-500/20 text-red-400 border-red-500/40 shadow-lg shadow-red-500/10"
                : "bg-zinc-900/80 text-zinc-400 hover:text-white border-zinc-800 hover:border-zinc-700"
            )}
            title={isLiked ? "Remove from Liked Songs" : "Save to Liked Songs"}
          >
            <Heart className={cn("w-4 h-4", isLiked && "fill-current")} />
            <span className="hidden sm:inline">{isLiked ? 'Liked' : 'Like'}</span>
          </button>
        )}

        {videoId && onOpenLyrics && (
          <button
            onClick={onOpenLyrics}
            className="p-2 bg-zinc-900/80 hover:bg-zinc-800 text-zinc-400 hover:text-pink-400 border border-zinc-800 hover:border-pink-500/30 rounded-2xl transition-all active:scale-90 flex items-center gap-1.5 text-xs font-bold"
            title="Singalong Lyrics & Karaoke Mode"
          >
            <Mic2 className="w-4 h-4 text-pink-400" />
            <span className="hidden sm:inline">Lyrics</span>
          </button>
        )}

        {onCyclePlaybackRate && (
          <button
            onClick={onCyclePlaybackRate}
            className={cn(
              "p-2 rounded-2xl border transition-all active:scale-90 flex items-center gap-1.5 text-xs font-bold",
              playbackRate !== 1.0
                ? "bg-blue-500/20 text-blue-400 border-blue-500/40"
                : "bg-zinc-900/80 text-zinc-400 hover:text-white border-zinc-800"
            )}
            title="Cycle Playback Speed (0.75x, 0.85x, 1.0x, 1.25x, 1.5x)"
          >
            <Gauge className="w-4 h-4" />
            <span>{playbackRate}x</span>
          </button>
        )}
      </div>

      {/* Track Info */}
      <div className="w-full text-center space-y-1 mb-5">
        <h2 className="text-lg sm:text-xl font-black text-white tracking-tight line-clamp-1" title={title || 'Waiting for Track'}>
          {title || 'Session Idle'}
        </h2>
        <div className="flex items-center justify-center gap-2 text-xs text-zinc-400 font-medium truncate">
          <span>{author || (videoId ? 'YouTube Audio' : 'Add a track to begin')}</span>
          {addedBy && (
            <>
              <span className="text-zinc-600">•</span>
              <span className="text-[11px] text-emerald-400/90 font-medium">
                Added by @{addedBy.username}
              </span>
            </>
          )}
        </div>
      </div>

      {/* Audio Unlock Button */}
      {!audioUnlocked && isPlaying && (
        <button
          onClick={onUnlockAudio}
          className="w-full mb-4 py-2.5 px-4 bg-emerald-500 text-black font-black text-xs uppercase tracking-wider rounded-2xl animate-bounce shadow-lg flex items-center justify-center gap-2"
        >
          <Volume2 className="w-4 h-4" />
          <span>Tap to sync & unmute audio stream</span>
        </button>
      )}

      {/* Playhead Scrubber */}
      <div className="w-full space-y-1.5 mb-5">
        <div className="relative flex items-center">
          <input
            type="range"
            min={0}
            max={effectiveTotalDuration}
            step={0.5}
            value={displayTime}
            disabled={!isHost && !isUnsynced}
            onMouseDown={() => setIsScrubbing(true)}
            onTouchStart={() => setIsScrubbing(true)}
            onChange={handleScrubChange}
            onMouseUp={handleScrubEnd}
            onTouchEnd={handleScrubEnd}
            className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-emerald-400 hover:h-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          />
        </div>
        <div className="flex justify-between items-center text-[11px] font-mono text-zinc-500 px-0.5">
          <span>{formatTime(displayTime)}</span>
          <span>{formatTime(effectiveTotalDuration)}</span>
        </div>
      </div>

      {/* Playback Controls */}
      <div className="flex items-center justify-center gap-4 sm:gap-6 mb-5">
        <button
          onClick={onToggleRepeat}
          disabled={!isHost && !isUnsynced}
          className={cn(
            "p-2.5 rounded-2xl transition-all active:scale-95 disabled:opacity-30 disabled:pointer-events-none",
            repeatMode !== 'off'
              ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30"
              : "text-zinc-500 hover:text-zinc-300"
          )}
          title={`Repeat: ${repeatMode}`}
        >
          {repeatMode === 'track' ? <Repeat1 className="w-5 h-5" /> : <Repeat className="w-5 h-5" />}
        </button>

        <button
          onClick={onBack}
          disabled={(!isHost && !isUnsynced) || !canGoBack}
          className="p-3 bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white rounded-2xl border border-zinc-800 transition-all hover:scale-105 active:scale-90 disabled:opacity-20 disabled:pointer-events-none"
          title="Previous Track"
        >
          <RotateCcw className="w-5 h-5" />
        </button>

        <button
          onClick={() => onSeek(Math.max(0, currentTime - 10))}
          disabled={!isHost && !isUnsynced}
          className="p-2.5 text-zinc-400 hover:text-white rounded-xl hover:bg-zinc-900 transition-all active:scale-90 disabled:opacity-20 disabled:pointer-events-none"
          title="Rewind 10s"
        >
          <Rewind className="w-5 h-5" />
        </button>

        <button
          onClick={isPlaying ? onPause : onPlay}
          disabled={(!isHost && !isUnsynced) || !videoId}
          className={cn(
            "w-16 h-16 rounded-full flex items-center justify-center shadow-xl transition-all duration-300 hover:scale-105 active:scale-95 disabled:opacity-30 disabled:pointer-events-none",
            isPlaying
              ? "bg-zinc-900 text-emerald-400 border-2 border-emerald-400/80 shadow-emerald-500/10"
              : "bg-emerald-400 text-black shadow-emerald-400/30 hover:bg-emerald-300"
          )}
        >
          {isPlaying ? (
            <Pause className="w-7 h-7 fill-current" />
          ) : (
            <Play className="w-7 h-7 fill-current ml-1" />
          )}
        </button>

        <button
          onClick={() => onSeek(Math.min(effectiveTotalDuration, currentTime + 10))}
          disabled={!isHost && !isUnsynced}
          className="p-2.5 text-zinc-400 hover:text-white rounded-xl hover:bg-zinc-900 transition-all active:scale-90 disabled:opacity-20 disabled:pointer-events-none"
          title="Forward 10s"
        >
          <FastForward className="w-5 h-5" />
        </button>

        <button
          onClick={onSkip}
          disabled={(!isHost && !isUnsynced) || !canSkip}
          className="p-3 bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white rounded-2xl border border-zinc-800 transition-all hover:scale-105 active:scale-90 disabled:opacity-20 disabled:pointer-events-none"
          title="Skip Track"
        >
          <SkipForward className="w-5 h-5 fill-current" />
        </button>
      </div>

      {/* Volume Bar */}
      <div className="w-full max-w-xs flex items-center gap-3 px-3 py-2 bg-zinc-900/60 rounded-2xl border border-zinc-800/80">
        <button
          onClick={handleToggleMute}
          className="p-1 text-zinc-400 hover:text-white transition-colors"
        >
          {isMuted || volume === 0 ? <VolumeX className="w-4 h-4 text-red-400" /> : <Volume2 className="w-4 h-4" />}
        </button>
        <input
          type="range"
          min={0}
          max={100}
          value={isMuted ? 0 : volume}
          onChange={(e) => {
            const v = parseInt(e.target.value);
            setIsMuted(v === 0);
            onVolumeChange(v);
          }}
          className="flex-1 h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-emerald-400"
        />
        <span className="text-[11px] font-mono font-bold text-zinc-400 w-8 text-right">
          {isMuted ? 0 : volume}%
        </span>
      </div>
    </div>
  );
};
