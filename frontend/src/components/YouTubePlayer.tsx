import { useEffect, useRef, useState, forwardRef, useImperativeHandle } from 'react';
import { cn } from '../lib/utils';

declare global {
  interface Window {
    onYouTubeIframeAPIReady: () => void;
    YT: any;
  }
}

export interface YouTubePlayerRef {
  getCurrentTime: () => number;
  getDuration: () => number;
  playVideo: () => void;
  pauseVideo: () => void;
  seekTo: (seconds: number) => void;
  unmuteAudio: () => void;
  setPlaybackRate?: (rate: number) => void;
}

interface YouTubePlayerProps {
  videoId: string;
  isPlaying: boolean;
  targetPlayhead: number;
  isHost: boolean;
  onStateChange: (state: { isPlaying: boolean; playhead: number; isEnded?: boolean }) => void;
  onTimeUpdate?: (currentTime: number, duration: number) => void;
  onAutoplayBlocked?: () => void;
  updatedAt: number;
  volume?: number;
  playbackRate?: number;
  dataSaver?: boolean;
  muted?: boolean;
  isUnsynced?: boolean;
}

export const YouTubePlayer = forwardRef<YouTubePlayerRef, YouTubePlayerProps>(({
  videoId,
  isPlaying,
  targetPlayhead,
  isHost,
  onStateChange,
  onTimeUpdate,
  onAutoplayBlocked,
  updatedAt,
  volume = 50,
  playbackRate = 1.0,
  dataSaver = false,
  muted = false,
  isUnsynced = false
}, ref) => {
  const playerRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isReady, setIsReady] = useState(false);
  const currentVideoIdRef = useRef<string>('');
  const timePollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const propsRef = useRef({ 
    isPlaying, 
    isHost, 
    onStateChange, 
    targetPlayhead, 
    onAutoplayBlocked,
    videoId,
    volume,
    muted,
    playbackRate 
  });

  useEffect(() => {
    propsRef.current = { 
      isPlaying, 
      isHost, 
      onStateChange, 
      targetPlayhead, 
      onAutoplayBlocked,
      videoId,
      volume,
      muted,
      playbackRate 
    };
  }, [isPlaying, isHost, onStateChange, targetPlayhead, onAutoplayBlocked, videoId, volume, muted, playbackRate]);

  useImperativeHandle(ref, () => ({
    getCurrentTime: () => {
      if (playerRef.current && isReady) {
        try {
          return playerRef.current.getCurrentTime() || 0;
        } catch {
          return 0;
        }
      }
      return 0;
    },
    getDuration: () => {
      if (playerRef.current && isReady) {
        try {
          return playerRef.current.getDuration() || 0;
        } catch {
          return 0;
        }
      }
      return 0;
    },
    playVideo: () => {
      if (playerRef.current && isReady) {
        try {
          playerRef.current.playVideo();
        } catch (e) {
          console.warn('[YT Player] Play error', e);
        }
      }
    },
    pauseVideo: () => {
      if (playerRef.current && isReady) {
        try {
          playerRef.current.pauseVideo();
        } catch (e) {
          console.warn('[YT Player] Pause error', e);
        }
      }
    },
    seekTo: (seconds: number) => {
      if (playerRef.current && isReady) {
        try {
          playerRef.current.seekTo(seconds, true);
        } catch (e) {
          console.warn('[YT Player] Seek error', e);
        }
      }
    },
    unmuteAudio: () => {
      if (playerRef.current && isReady) {
        try {
          playerRef.current.unMute();
          playerRef.current.setVolume(volume);
          playerRef.current.playVideo();
        } catch (e) {
          console.warn('[YT Player] Unmute error', e);
        }
      }
    },
    setPlaybackRate: (rate: number) => {
      if (playerRef.current && isReady) {
        try {
          playerRef.current.setPlaybackRate(rate);
        } catch {
          // ignore
        }
      }
    }
  }));

  const handlePlayerStateChange = (event: any) => {
    const newState = event.data;
    const { 
      isHost: currentIsHost, 
      onStateChange: currentOnStateChange 
    } = propsRef.current;

    if (newState === window.YT.PlayerState.ENDED) {
      if (currentIsHost) {
        currentOnStateChange({ isPlaying: false, playhead: 0, isEnded: true });
      }
    }
  };

  // Initialize YouTube Iframe API once on mount
  useEffect(() => {
    const initPlayer = () => {
      if (playerRef.current || !containerRef.current) return;

      const initialVideoId = propsRef.current.videoId || '';
      currentVideoIdRef.current = initialVideoId;

      playerRef.current = new window.YT.Player(containerRef.current, {
        height: '100%',
        width: '100%',
        videoId: initialVideoId,
        playerVars: {
          autoplay: propsRef.current.isPlaying ? 1 : 0,
          controls: 1,
          modestbranding: 1,
          rel: 0,
          mute: propsRef.current.muted ? 1 : 0,
          playsinline: 1,
          origin: window.location.origin
        },
        events: {
          onReady: () => {
            setIsReady(true);
            try {
              playerRef.current.setVolume(propsRef.current.volume);
              if (propsRef.current.muted) playerRef.current.mute();
              if (propsRef.current.playbackRate !== 1.0) {
                playerRef.current.setPlaybackRate(propsRef.current.playbackRate);
              }
              if (propsRef.current.isPlaying && initialVideoId) {
                const startSec = Math.max(0, propsRef.current.targetPlayhead || 0);
                playerRef.current.loadVideoById({ videoId: initialVideoId, startSeconds: startSec });
              }
            } catch {
              // ignore
            }
          },
          onStateChange: handlePlayerStateChange,
          onError: (err: any) => {
            console.warn('[YT Player Error]', err);
          }
        },
      });
    };

    if (!window.YT) {
      const tag = document.createElement('script');
      tag.src = "https://www.youtube.com/iframe_api";
      const firstScriptTag = document.getElementsByTagName('script')[0];
      firstScriptTag?.parentNode?.insertBefore(tag, firstScriptTag);

      window.onYouTubeIframeAPIReady = () => {
        initPlayer();
      };
    } else {
      initPlayer();
    }

    return () => {
      if (playerRef.current) {
        try {
          playerRef.current.destroy();
        } catch {
          // ignore
        }
        playerRef.current = null;
        setIsReady(false);
      }
    };
  }, []);

  // Seamless Track Switching without Iframe destruction (Preserves audio context & autoplay permission)
  useEffect(() => {
    if (!isReady || !playerRef.current || !videoId) return;

    if (currentVideoIdRef.current !== videoId) {
      currentVideoIdRef.current = videoId;
      try {
        const startSeconds = Math.max(0, targetPlayhead || 0);
        if (isPlaying) {
          playerRef.current.loadVideoById({
            videoId,
            startSeconds
          });
        } else {
          playerRef.current.cueVideoById({
            videoId,
            startSeconds
          });
        }
      } catch (e) {
        console.warn('[YT Player] Error loading track by ID', e);
      }
    }
  }, [videoId, isReady, isPlaying, targetPlayhead]);

  // Volume & Mute Sync
  useEffect(() => {
    if (isReady && playerRef.current) {
      try {
        if (muted) {
          playerRef.current.mute();
        } else {
          playerRef.current.unMute();
          playerRef.current.setVolume(volume);
        }
      } catch {
        // ignore
      }
    }
  }, [isReady, volume, muted]);

  // Playback Rate Sync
  useEffect(() => {
    if (isReady && playerRef.current && playbackRate) {
      try {
        playerRef.current.setPlaybackRate(playbackRate);
      } catch {
        // ignore
      }
    }
  }, [isReady, playbackRate]);

  // Continuous Time Polling & Background Tab End-of-Track Watcher
  useEffect(() => {
    if (timePollIntervalRef.current) clearInterval(timePollIntervalRef.current);

    timePollIntervalRef.current = setInterval(() => {
      if (isReady && playerRef.current) {
        try {
          const curTime = playerRef.current.getCurrentTime() || 0;
          const dur = playerRef.current.getDuration() || 0;
          if (onTimeUpdate) {
            onTimeUpdate(curTime, dur);
          }

          // Fallback end-of-track detector for background/throttled tabs
          const { isHost: curHost, isPlaying: curPlaying, onStateChange: curStateChange } = propsRef.current;
          if (curHost && curPlaying && dur > 5 && curTime >= dur - 0.5) {
            curStateChange({ isPlaying: false, playhead: 0, isEnded: true });
          }
        } catch {
          // ignore
        }
      }
    }, 250);

    return () => {
      if (timePollIntervalRef.current) clearInterval(timePollIntervalRef.current);
    };
  }, [isReady, onTimeUpdate]);

  // Handle Playback State & Drift Compensation
  useEffect(() => {
    if (!isReady || !playerRef.current || isUnsynced) return;

    try {
      const currentPlayerState = playerRef.current.getPlayerState();
      
      if (isPlaying && currentPlayerState !== 1 && currentPlayerState !== 3) {
        playerRef.current.playVideo();
      } else if (!isPlaying && currentPlayerState === 1) {
        playerRef.current.pauseVideo();
      }

      const localPlayhead = playerRef.current.getCurrentTime() || 0;
      const transitDelay = (Date.now() - updatedAt) / 1000;
      const computedTarget = isPlaying ? targetPlayhead + transitDelay : targetPlayhead;
      const drift = localPlayhead - computedTarget;

      if (Math.abs(drift) > 1.8 && !isNaN(computedTarget)) {
        const safeTarget = Math.max(0, computedTarget);
        playerRef.current.seekTo(safeTarget, true);
      }
    } catch (e) {
      console.warn('[YT Player] Error applying playback sync', e);
    }
  }, [isReady, isPlaying, targetPlayhead, videoId, isUnsynced, updatedAt]);

  return (
    <div className="w-full h-full rounded-3xl overflow-hidden bg-black relative">
      <div 
        className={cn(
          "absolute inset-0 flex flex-col items-center justify-center bg-zinc-950 transition-opacity duration-500",
          dataSaver ? "opacity-100 z-10" : "opacity-0 pointer-events-none"
        )}
      >
        <img 
          src={`https://img.youtube.com/vi/${videoId}/hqdefault.jpg`} 
          alt="Thumbnail" 
          className="absolute inset-0 z-10 w-full h-full object-cover opacity-20 grayscale blur-md"
        />
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-6 space-y-2 z-20">
          <span className="px-3 py-1 bg-emerald-500/20 border border-emerald-500/40 rounded-full text-[10px] font-black uppercase tracking-widest text-emerald-400">
            Audio-Only Mode
          </span>
          <span className="text-xs text-zinc-400">Bandwidth saver active</span>
        </div>
      </div>
      <div ref={containerRef} className="w-full h-full" />
    </div>
  );
});
