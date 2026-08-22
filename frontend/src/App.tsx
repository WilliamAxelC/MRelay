import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useSocket } from './hooks/useSocket';
import type { QueueItem } from './hooks/useSocket';
import { cn } from './lib/utils';
import { 
  Radio, LogOut, Settings, 
  Users, RotateCcw, Link2, Globe, 
  QrCode, X, Maximize2, Moon, Bookmark, HelpCircle, Wand2,
  Heart
} from 'lucide-react';
import { YouTubePlayer } from './components/YouTubePlayer';
import type { YouTubePlayerRef } from './components/YouTubePlayer';
import { NowPlayingCard } from './components/NowPlayingCard';
import { QueueView } from './components/QueueView';
import { ChatView } from './components/ChatView';
import { MediaIngestionForm } from './components/MediaIngestionForm';
import { ShareModal } from './components/ShareModal';
import { UserRosterModal } from './components/UserRosterModal';
import { MobileBottomNav } from './components/MobileBottomNav';
import type { MobileTab } from './components/MobileBottomNav';
import { FloatingReactions } from './components/FloatingReactions';
import type { FloatingReactionsRef } from './components/FloatingReactions';
import { FullscreenPlayer } from './components/FullscreenPlayer';
import { PlaylistDrawer } from './components/PlaylistDrawer';
import { SleepTimerModal } from './components/SleepTimerModal';
import { ShortcutHelpModal } from './components/ShortcutHelpModal';
import { LyricsDrawer } from './components/LyricsDrawer';
import { LikedSongsModal } from './components/LikedSongsModal';
import type { LikedTrack } from './components/LikedSongsModal';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';

const PLAYBACK_RATES = [0.75, 0.85, 1.0, 1.15, 1.25, 1.5];
const LIKED_STORAGE_KEY = 'muser_liked_tracks';

export function App() {
  const [userId] = useState(() => {
    const saved = localStorage.getItem('muser_user_id');
    if (saved) return saved;
    const newId = `user-${crypto.randomUUID()}`;
    localStorage.setItem('muser_user_id', newId);
    return newId;
  });

  const [username, setUsername] = useState(() => {
    return localStorage.getItem('muser_username') || `Guest_${userId.substring(5, 9)}`;
  });

  const [inputRoomId, setInputRoomId] = useState('');
  const [activeRoomId, setActiveRoomId] = useState<string | null>(() => {
    const match = window.location.pathname.match(/^\/room\/([A-Za-z0-9_-]+)/);
    return match ? match[1].toUpperCase() : null;
  });

  const [volume, setVolume] = useState(65);
  const [playbackRate, setPlaybackRate] = useState(1.0);
  const [dataSaver, setDataSaver] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showRosterModal, setShowRosterModal] = useState(false);
  const [showFullscreen, setShowFullscreen] = useState(false);
  const [showPlaylistDrawer, setShowPlaylistDrawer] = useState(false);
  const [showSleepTimer, setShowSleepTimer] = useState(false);
  const [showShortcutHelp, setShowShortcutHelp] = useState(false);
  const [showLyrics, setShowLyrics] = useState(false);
  const [showLikedSongs, setShowLikedSongs] = useState(false);

  const [likedTrackIds, setLikedTrackIds] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem(LIKED_STORAGE_KEY);
      if (saved) {
        const arr: LikedTrack[] = JSON.parse(saved);
        return new Set(arr.map(t => t.videoId));
      }
    } catch {}
    return new Set();
  });

  const [sleepTimerSeconds, setSleepTimerSeconds] = useState<number | null>(null);
  const [sleepTimerTargetTrack, setSleepTimerTargetTrack] = useState<string | null>(null);

  const [editTitle, setEditTitle] = useState('');
  const [chatMaxTokens, setChatMaxTokens] = useState(3);
  const [chatInterval, setChatInterval] = useState(5);
  const [roomPassword, setRoomPassword] = useState('');
  const [publicRoomsFilter, setPublicRoomsFilter] = useState('');
  const [isRefreshingRooms, setIsRefreshingRooms] = useState(false);
  const [roomTitleInput, setRoomTitleInput] = useState('');
  const [mobileTab, setMobileTab] = useState<MobileTab>('now-playing');
  const [isCreatingPublic, setIsCreatingPublic] = useState(true);
  const [isUnsynced, setIsUnsynced] = useState(false);
  const [audioUnlocked, setAudioUnlocked] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [totalDuration, setTotalDuration] = useState(0);
  const [publicRooms, setPublicRooms] = useState<any[]>([]);

  const ytPlayerRef = useRef<YouTubePlayerRef>(null);
  const floatingReactionsRef = useRef<FloatingReactionsRef>(null);

  useEffect(() => {
    if (activeRoomId) {
      window.history.replaceState({}, '', `/room/${activeRoomId.toLowerCase()}`);
    } else {
      window.history.replaceState({}, '', '/');
    }
  }, [activeRoomId]);

  const handleRoomClosed = useCallback((message: string) => {
    alert(message);
    setActiveRoomId(null);
  }, []);

  const handlePlayheadTick = useCallback((playhead: number) => {
    setCurrentTime(playhead);
  }, []);

  const handlePeerReaction = useCallback((emoji: string) => {
    floatingReactionsRef.current?.spawnReaction(emoji);
  }, []);

  const {
    roomState,
    isHost,
    emitMutation,
    messages,
    sendMessage,
    chatError,
    p2pStatus,
    p2pLatencyMs,
    broadcastPlayheadTick,
    broadcastReaction
  } = useSocket(
    activeRoomId,
    userId,
    username,
    roomPassword,
    roomTitleInput,
    isUnsynced,
    handleRoomClosed,
    handlePlayheadTick,
    handlePeerReaction
  );

  const handleLocalReaction = useCallback((emoji: string) => {
    floatingReactionsRef.current?.spawnReaction(emoji);
    broadcastReaction(emoji);
  }, [broadcastReaction]);

  useEffect(() => {
    if (showSettings && roomState) {
      setEditTitle(roomState.title || '');
      setChatMaxTokens(roomState.chatRateLimit?.maxTokens ?? 3);
      setChatInterval(roomState.chatRateLimit ? roomState.chatRateLimit.intervalMs / 1000 : 5);
    }
  }, [showSettings, roomState]);

  // Host playhead broadcast over P2P DataChannel
  useEffect(() => {
    if (!isHost || !roomState?.isPlaying || !activeRoomId) return;

    const interval = setInterval(() => {
      if (ytPlayerRef.current) {
        const cur = ytPlayerRef.current.getCurrentTime();
        if (cur > 0) {
          broadcastPlayheadTick(cur);
        }
      }
    }, 400);

    return () => clearInterval(interval);
  }, [isHost, roomState?.isPlaying, activeRoomId, broadcastPlayheadTick]);

  // Sleep Timer Countdown & Fade-out Effect
  useEffect(() => {
    if (sleepTimerSeconds === null || sleepTimerSeconds <= 0) return;

    const interval = setInterval(() => {
      setSleepTimerSeconds((prev) => {
        if (prev === null || prev <= 1) {
          if (isHost) emitMutation('PAUSE');
          return null;
        }
        if (prev <= 20) {
          const faded = Math.max(0, Math.floor((prev / 20) * 60));
          setVolume(faded);
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [sleepTimerSeconds, isHost, emitMutation]);

  // End of Track Sleep Timer
  useEffect(() => {
    if (sleepTimerTargetTrack && roomState?.currentTrackId && roomState.currentTrackId !== sleepTimerTargetTrack) {
      if (isHost) emitMutation('PAUSE');
      setSleepTimerTargetTrack(null);
    }
  }, [roomState?.currentTrackId, sleepTimerTargetTrack, isHost, emitMutation]);

  const handleSetSleepTimer = (minutes: number | 'end_of_track') => {
    if (minutes === 'end_of_track') {
      setSleepTimerTargetTrack(roomState?.currentTrackId || 'active');
      setSleepTimerSeconds(null);
    } else {
      setSleepTimerSeconds(minutes * 60);
      setSleepTimerTargetTrack(null);
    }
  };

  const handleCancelSleepTimer = () => {
    setSleepTimerSeconds(null);
    setSleepTimerTargetTrack(null);
  };

  const handleCyclePlaybackRate = () => {
    const nextIdx = (PLAYBACK_RATES.indexOf(playbackRate) + 1) % PLAYBACK_RATES.length;
    const nextRate = PLAYBACK_RATES[nextIdx];
    setPlaybackRate(nextRate);
    if (ytPlayerRef.current?.setPlaybackRate) {
      ytPlayerRef.current.setPlaybackRate(nextRate);
    }
  };

  const handleToggleLikeCurrentTrack = () => {
    if (!roomState?.currentTrackId) return;
    const vId = roomState.currentTrackId;

    try {
      const saved = localStorage.getItem(LIKED_STORAGE_KEY);
      let arr: LikedTrack[] = saved ? JSON.parse(saved) : [];

      if (likedTrackIds.has(vId)) {
        arr = arr.filter(t => t.videoId !== vId);
        setLikedTrackIds(new Set(arr.map(t => t.videoId)));
      } else {
        const newLiked: LikedTrack = {
          videoId: vId,
          title: roomState.currentTitle || 'Unknown Track',
          author: roomState.currentAuthor,
          duration: roomState.currentDuration,
          likedAt: Date.now()
        };
        arr = [newLiked, ...arr];
        setLikedTrackIds(new Set(arr.map(t => t.videoId)));
      }

      localStorage.setItem(LIKED_STORAGE_KEY, JSON.stringify(arr));
    } catch {}
  };

  const fetchPublicRooms = useCallback(() => {
    setIsRefreshingRooms(true);
    fetch('/api/rooms')
      .then((res) => res.json())
      .then((data) => {
        if (data.rooms) setPublicRooms(data.rooms);
      })
      .catch((err) => console.error(err))
      .finally(() => setTimeout(() => setIsRefreshingRooms(false), 500));
  }, []);

  useEffect(() => {
    if (!activeRoomId) {
      fetchPublicRooms();
    }
  }, [activeRoomId, fetchPublicRooms]);

  // Lockscreen MediaSession API Integration
  useEffect(() => {
    if ('mediaSession' in navigator) {
      const trackTitle = roomState?.currentTitle || roomState?.title || 'Muser Jam';
      const authorName = roomState?.currentAuthor || activeRoomId || 'Collaborative Music';

      navigator.mediaSession.metadata = new MediaMetadata({
        title: trackTitle,
        artist: authorName,
        album: 'Muser Jam Session',
        artwork: roomState?.currentTrackId
          ? [
              {
                src: `https://img.youtube.com/vi/${roomState.currentTrackId}/hqdefault.jpg`,
                sizes: '480x360',
                type: 'image/jpeg'
              }
            ]
          : []
      });

      navigator.mediaSession.setActionHandler('play', () => emitMutation('PLAY'));
      navigator.mediaSession.setActionHandler('pause', () => emitMutation('PAUSE'));
      navigator.mediaSession.setActionHandler('nexttrack', () => {
        if (isHost) emitMutation('SKIP');
      });
      navigator.mediaSession.setActionHandler('previoustrack', () => {
        if (isHost) emitMutation('BACK');
      });
      navigator.mediaSession.playbackState = roomState?.isPlaying ? 'playing' : 'paused';
    }
  }, [roomState?.title, roomState?.currentTitle, roomState?.currentAuthor, roomState?.currentTrackId, roomState?.isPlaying, activeRoomId, isHost, emitMutation]);

  const handleNameChange = (newName: string) => {
    setUsername(newName);
    localStorage.setItem('muser_username', newName);
  };

  const handleCreateRoom = () => {
    const newRoomId = Math.random().toString(36).substring(2, 8).toUpperCase();
    setActiveRoomId(newRoomId);
  };

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputRoomId.trim()) {
      setActiveRoomId(inputRoomId.trim().toUpperCase());
    }
  };

  const handleLeave = () => {
    setActiveRoomId(null);
    setInputRoomId('');
  };

  const handleIngest = async (urlOrItem: string | any, playNext?: boolean) => {
    try {
      if (typeof urlOrItem === 'object') {
        emitMutation('QUEUE_ADD', {
          item: urlOrItem,
          ...(playNext ? { index: 0 } : {})
        });
        return;
      }

      const input = urlOrItem.trim();

      const listRegex = /[?&]list=([a-zA-Z0-9_-]+)/;
      const listMatch = input.match(listRegex);
      if (listMatch) {
        emitMutation('QUEUE_PLAYLIST_REQUEST', { playlistId: listMatch[1] });
        return;
      }

      const regex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/|music\.youtube\.com\/watch\?v=)([a-zA-Z0-9_-]{11})/;
      const match = input.match(regex);
      const videoId = match ? match[1] : (input.length === 11 ? input : null);

      if (videoId) {
        emitMutation('QUEUE_ADD', {
          item: videoId,
          ...(playNext ? { index: 0 } : {})
        });
      } else {
        throw new Error('Invalid YouTube link or track ID');
      }
    } catch (err: any) {
      alert(err.message || 'Media ingestion failed');
    }
  };

  const handlePlayerStateChange = (state: { isPlaying: boolean; playhead: number; isEnded?: boolean }) => {
    if (isUnsynced) return;
    if (state.isEnded) {
      emitMutation('TRACK_END');
    } else {
      emitMutation(state.isPlaying ? 'PLAY' : 'PAUSE', { playhead: state.playhead });
    }
  };

  const handleTimeUpdate = (curTime: number, dur: number) => {
    setCurrentTime(curTime);
    if (dur > 0) setTotalDuration(dur);
  };

  const handleSeek = (seconds: number) => {
    if (ytPlayerRef.current) {
      ytPlayerRef.current.seekTo(seconds);
    }
    emitMutation('SEEK', { playhead: seconds });
  };

  const handleToggleRepeat = () => {
    if (!isHost) return;
    const current = roomState?.repeatMode || 'off';
    const next = current === 'off' ? 'track' : current === 'track' ? 'queue' : 'off';
    emitMutation('SET_REPEAT_MODE', { repeatMode: next });
  };

  const handleTransferHost = (targetUserId: string) => {
    emitMutation('TRANSFER_AUTHORITY', { targetUserId });
  };

  const handleUnlockAudio = () => {
    if (ytPlayerRef.current) {
      ytPlayerRef.current.unmuteAudio();
    }
    setAudioUnlocked(true);
  };

  const handleLoadSavedPlaylist = (tracks: QueueItem[], mode: 'append' | 'replace') => {
    if (mode === 'replace') {
      emitMutation('QUEUE_CLEAR');
    }
    emitMutation('QUEUE_BATCH_APPEND', { items: tracks });
    setShowPlaylistDrawer(false);
  };

  const handleQueueLikedTrack = (item: QueueItem, playNext?: boolean) => {
    handleIngest(item, playNext);
  };

  const handleQueueAllLiked = (items: QueueItem[]) => {
    emitMutation('QUEUE_BATCH_APPEND', { items });
    setShowLikedSongs(false);
  };

  // Keyboard Shortcuts Hook
  useKeyboardShortcuts({
    onTogglePlay: () => {
      if (roomState?.currentTrackId) {
        emitMutation(roomState.isPlaying ? 'PAUSE' : 'PLAY', { playhead: currentTime });
      }
    },
    onSeekBackward: () => handleSeek(Math.max(0, currentTime - 10)),
    onSeekForward: () => handleSeek(Math.min(totalDuration || 9999, currentTime + 10)),
    onNext: () => { if (isHost) emitMutation('SKIP'); },
    onPrev: () => { if (isHost) emitMutation('BACK'); },
    onToggleMute: () => setVolume((v) => (v === 0 ? 65 : 0)),
    onToggleFullscreen: () => setShowFullscreen((f) => !f),
    onToggleRepeat: handleToggleRepeat,
    onShuffle: () => { if (isHost) emitMutation('QUEUE_SHUFFLE'); },
    onShowHelp: () => setShowShortcutHelp((h) => !h)
  }, !activeRoomId);

  // --- LOBBY VIEW ---
  if (!activeRoomId) {
    return (
      <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-4 md:p-8 relative overflow-y-auto selection:bg-emerald-500 selection:text-black">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="max-w-5xl w-full mx-auto space-y-10 py-8 relative z-10">
          <div className="flex flex-col items-center text-center space-y-3">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-3xl bg-zinc-900 border border-zinc-800 shadow-2xl shadow-emerald-500/10">
              <Radio className="w-8 h-8 text-emerald-400 animate-pulse" />
            </div>
            <h1 className="text-4xl md:text-5xl font-black tracking-tight text-white uppercase italic">
              Muser <span className="text-emerald-400">Jam</span>
            </h1>
            <p className="text-zinc-400 text-sm max-w-md font-medium">
              Synchronized collaborative music sessions with instant WebRTC peer-to-peer playback across Phone & PC.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            <div className="lg:col-span-4 bg-zinc-950/80 border border-zinc-800/80 p-6 md:p-8 rounded-3xl shadow-2xl backdrop-blur-xl flex flex-col justify-between space-y-6">
              <div className="space-y-4">
                <div className="flex items-center gap-2.5">
                  <Users className="w-4 h-4 text-emerald-400" />
                  <h3 className="text-xs font-black text-white uppercase tracking-widest">Your Identity</h3>
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="username" className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider ml-1">
                    Display Name
                  </label>
                  <input
                    id="username"
                    type="text"
                    value={username}
                    onChange={(e) => handleNameChange(e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl px-4 py-3.5 text-sm font-semibold text-white focus:outline-none focus:border-emerald-500/80 transition-all placeholder:text-zinc-600"
                  />
                </div>
              </div>
              <p className="text-[11px] text-zinc-500 leading-relaxed">
                Your profile is saved locally and instantly shared with peers when joining a jam session.
              </p>
            </div>

            <div className="lg:col-span-8 grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-zinc-950/80 border border-zinc-800/80 p-6 md:p-8 rounded-3xl shadow-2xl backdrop-blur-xl flex flex-col justify-between space-y-6">
                <div className="space-y-4">
                  <div className="flex items-center gap-2.5">
                    <Globe className="w-4 h-4 text-emerald-400" />
                    <h3 className="text-xs font-black text-white uppercase tracking-widest">Start New Jam</h3>
                  </div>

                  <div className="space-y-3">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider ml-1">Session Title</label>
                      <input
                        type="text"
                        placeholder="Late Night Vibes..."
                        value={roomTitleInput}
                        onChange={(e) => setRoomTitleInput(e.target.value)}
                        className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl px-4 py-3 text-xs font-medium text-white focus:outline-none focus:border-emerald-500/80 transition-all placeholder:text-zinc-600"
                      />
                    </div>

                    <div className="flex items-center justify-between p-3 bg-zinc-900/60 rounded-2xl border border-zinc-800">
                      <div>
                        <div className="text-xs font-bold text-white">Public Session</div>
                        <div className="text-[10px] text-zinc-500">Show in public browser</div>
                      </div>
                      <button
                        onClick={() => setIsCreatingPublic(!isCreatingPublic)}
                        className={cn(
                          "w-11 h-6 rounded-full transition-all relative",
                          isCreatingPublic ? "bg-emerald-500" : "bg-zinc-800"
                        )}
                      >
                        <div className={cn("w-4 h-4 bg-black rounded-full absolute top-1 transition-all", isCreatingPublic ? "right-1" : "left-1")} />
                      </button>
                    </div>
                  </div>
                </div>

                <button
                  onClick={handleCreateRoom}
                  className="w-full py-4 bg-emerald-500 hover:bg-emerald-400 text-black font-black text-xs uppercase tracking-widest rounded-2xl transition-all active:scale-98 shadow-xl shadow-emerald-500/20"
                >
                  Create Session
                </button>
              </div>

              <div className="bg-zinc-950/80 border border-zinc-800/80 p-6 md:p-8 rounded-3xl shadow-2xl backdrop-blur-xl flex flex-col justify-between space-y-6">
                <form onSubmit={handleJoin} className="space-y-4">
                  <div className="flex items-center gap-2.5">
                    <Link2 className="w-4 h-4 text-blue-400" />
                    <h3 className="text-xs font-black text-white uppercase tracking-widest">Join Session</h3>
                  </div>

                  <div className="space-y-3">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider ml-1">Room Code</label>
                      <input
                        type="text"
                        placeholder="CODE"
                        value={inputRoomId}
                        onChange={(e) => setInputRoomId(e.target.value)}
                        className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl px-4 py-3 font-mono tracking-widest uppercase text-sm font-black text-white focus:outline-none focus:border-blue-500/80 transition-all placeholder:text-zinc-700"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider ml-1">Password (If Protected)</label>
                      <input
                        type="password"
                        placeholder="••••••••"
                        value={roomPassword}
                        onChange={(e) => setRoomPassword(e.target.value)}
                        className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl px-4 py-3 text-xs text-white focus:outline-none focus:border-blue-500/80 transition-all placeholder:text-zinc-700"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="w-full py-4 bg-white hover:bg-zinc-200 text-black font-black text-xs uppercase tracking-widest rounded-2xl transition-all active:scale-98 shadow-xl mt-4"
                  >
                    Connect
                  </button>
                </form>
              </div>
            </div>
          </div>

          <div className="space-y-4 pt-6 border-t border-zinc-900">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <h3 className="text-xs font-black text-zinc-400 uppercase tracking-widest">Active Public Jams</h3>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="Filter sessions..."
                  value={publicRoomsFilter}
                  onChange={(e) => setPublicRoomsFilter(e.target.value)}
                  className="bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-1.5 text-xs text-white placeholder:text-zinc-600 focus:outline-none focus:border-emerald-500/60"
                />
                <button
                  onClick={fetchPublicRooms}
                  className="p-2 bg-zinc-900 hover:bg-zinc-800 rounded-xl border border-zinc-800 text-zinc-400 hover:text-white transition-colors"
                  title="Refresh"
                >
                  <RotateCcw className={cn("w-3.5 h-3.5", isRefreshingRooms && "animate-spin")} />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {publicRooms.filter((r) => (r.title || r.roomId).toLowerCase().includes(publicRoomsFilter.toLowerCase())).length === 0 ? (
                <div className="col-span-full py-12 text-center text-xs text-zinc-600 font-bold uppercase tracking-wider bg-zinc-950/40 rounded-3xl border border-dashed border-zinc-900">
                  No public sessions active. Start one above!
                </div>
              ) : (
                publicRooms
                  .filter((r) => (r.title || r.roomId).toLowerCase().includes(publicRoomsFilter.toLowerCase()))
                  .map((room) => (
                    <div
                      key={room.roomId}
                      className="p-4 bg-zinc-950/60 border border-zinc-800/80 rounded-2xl hover:border-zinc-700 transition-all flex items-center justify-between group"
                    >
                      <div className="min-w-0 pr-3">
                        <h4 className="text-sm font-bold text-white truncate">{room.title || room.roomId}</h4>
                        <div className="flex items-center gap-2 text-[10px] text-zinc-500 font-mono mt-0.5">
                          <span>{room.userCount} {room.userCount === 1 ? 'listener' : 'listeners'}</span>
                          <span>• ID: {room.roomId}</span>
                        </div>
                      </div>
                      <button
                        onClick={() => setActiveRoomId(room.roomId)}
                        className="px-4 py-2 bg-zinc-900 hover:bg-emerald-500 hover:text-black text-white text-xs font-bold rounded-xl border border-zinc-800 transition-all shrink-0"
                      >
                        Join
                      </button>
                    </div>
                  ))
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-black text-white overflow-hidden relative selection:bg-emerald-500 selection:text-black">
      {/* Floating Canvas Reactions Layer */}
      <FloatingReactions ref={floatingReactionsRef} />

      {/* YouTube Media Engine (Fixed behind app layout to maintain background audio & event loop) */}
      <div className="fixed bottom-0 right-0 w-64 h-36 -z-50 pointer-events-none opacity-[0.001] overflow-hidden" aria-hidden="true">
        {roomState?.currentTrackId && (
          <YouTubePlayer
            ref={ytPlayerRef}
            key={roomState.currentTrackId}
            videoId={roomState.currentTrackId}
            isPlaying={roomState.isPlaying}
            targetPlayhead={roomState.currentPlayhead || 0}
            isHost={isHost}
            onStateChange={handlePlayerStateChange}
            onTimeUpdate={handleTimeUpdate}
            updatedAt={roomState.updatedAt || 0}
            volume={volume}
            playbackRate={playbackRate}
            dataSaver={dataSaver}
            isUnsynced={isUnsynced}
          />
        )}
      </div>

      {/* Header */}
      <header className="h-16 shrink-0 border-b border-zinc-900 bg-zinc-950/80 backdrop-blur-xl px-4 md:px-8 flex items-center justify-between z-40">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={handleLeave}
            className="flex items-center gap-2 shrink-0 hover:opacity-80 transition-opacity"
            title="Leave Session"
          >
            <div className="w-8 h-8 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center">
              <Radio className="w-4 h-4 text-emerald-400 animate-pulse" />
            </div>
            <span className="text-sm font-black uppercase italic text-white hidden sm:block">Muser</span>
          </button>

          <div className="w-px h-6 bg-zinc-800 shrink-0" />

          <div className="flex flex-col min-w-0">
            <h2 className="text-sm md:text-base font-black text-white tracking-tight truncate">
              {roomState?.title || activeRoomId}
            </h2>
            <span className="text-[10px] text-zinc-500 font-mono tracking-wider">
              JAM #{activeRoomId} {isHost ? '• MASTER' : '• LISTENER'}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* Quick Reaction Emojis for Peers */}
          <div className="hidden md:flex items-center gap-1 bg-zinc-900/60 p-1 rounded-2xl border border-zinc-800">
            {['🔥', '❤️', '🎉', '🎵'].map((emoji) => (
              <button
                key={emoji}
                onClick={() => handleLocalReaction(emoji)}
                className="w-7 h-7 hover:bg-zinc-800 rounded-xl text-sm flex items-center justify-center transition-all hover:scale-125 active:scale-95"
                title={`Send ${emoji} reaction to peers`}
              >
                {emoji}
              </button>
            ))}
          </div>

          {/* Fullscreen Party Mode */}
          <button
            onClick={() => setShowFullscreen(true)}
            className="p-2.5 bg-zinc-900/80 hover:bg-zinc-800 text-zinc-300 hover:text-white rounded-2xl border border-zinc-800 transition-all"
            title="Fullscreen Party Visualizer (F)"
          >
            <Maximize2 className="w-4 h-4 text-emerald-400" />
          </button>

          {/* Liked Songs Modal */}
          <button
            onClick={() => setShowLikedSongs(true)}
            className="p-2.5 bg-zinc-900/80 hover:bg-zinc-800 text-zinc-300 hover:text-red-400 rounded-2xl border border-zinc-800 transition-all"
            title="Liked Songs Library"
          >
            <Heart className="w-4 h-4 text-red-400" />
          </button>

          {/* Saved Playlists */}
          <button
            onClick={() => setShowPlaylistDrawer(true)}
            className="p-2.5 bg-zinc-900/80 hover:bg-zinc-800 text-zinc-300 hover:text-white rounded-2xl border border-zinc-800 transition-all"
            title="Saved Playlists & Archives"
          >
            <Bookmark className="w-4 h-4 text-emerald-400" />
          </button>

          {/* Sleep Timer */}
          <button
            onClick={() => setShowSleepTimer(true)}
            className={cn(
              "p-2.5 rounded-2xl border transition-all flex items-center gap-1",
              sleepTimerSeconds !== null || sleepTimerTargetTrack !== null
                ? "bg-purple-500/20 text-purple-300 border-purple-500/40"
                : "bg-zinc-900/80 hover:bg-zinc-800 text-zinc-300 hover:text-white border-zinc-800"
            )}
            title="Sleep Timer"
          >
            <Moon className="w-4 h-4" />
            {sleepTimerSeconds !== null && (
              <span className="text-[10px] font-mono font-bold hidden sm:inline">
                {Math.ceil(sleepTimerSeconds / 60)}m
              </span>
            )}
          </button>

          {/* Members / Roster */}
          <button
            onClick={() => setShowRosterModal(true)}
            className="p-2.5 bg-zinc-900/80 hover:bg-zinc-800 text-zinc-300 hover:text-white rounded-2xl border border-zinc-800 transition-all flex items-center gap-1.5"
            title="View active listeners"
          >
            <Users className="w-4 h-4 text-emerald-400" />
            <span className="text-xs font-mono font-bold hidden sm:inline">
              {roomState?.peers?.length || 1}
            </span>
          </button>

          {/* QR Invite */}
          <button
            onClick={() => setShowShareModal(true)}
            className="p-2.5 bg-zinc-900/80 hover:bg-zinc-800 text-zinc-300 hover:text-white rounded-2xl border border-zinc-800 transition-all flex items-center gap-1.5"
            title="Share session QR code"
          >
            <QrCode className="w-4 h-4 text-emerald-400" />
            <span className="text-xs font-bold hidden sm:inline">Invite</span>
          </button>

          {/* Keyboard Shortcuts Help */}
          <button
            onClick={() => setShowShortcutHelp(true)}
            className="p-2.5 bg-zinc-900/80 hover:bg-zinc-800 text-zinc-400 hover:text-white rounded-2xl border border-zinc-800 transition-all hidden lg:flex"
            title="Keyboard Shortcuts (?)"
          >
            <HelpCircle className="w-4 h-4" />
          </button>

          {/* Host Settings */}
          {isHost && (
            <button
              onClick={() => setShowSettings(!showSettings)}
              className="p-2.5 bg-zinc-900/80 hover:bg-zinc-800 text-zinc-300 hover:text-white rounded-2xl border border-zinc-800 transition-all"
              title="Host Settings"
            >
              <Settings className="w-4 h-4" />
            </button>
          )}

          <button
            onClick={handleLeave}
            className="p-2.5 hover:bg-red-950/40 text-zinc-400 hover:text-red-400 rounded-2xl border border-transparent hover:border-red-500/30 transition-all"
            title="Leave Jam"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Main Workspace Layout */}
      <div className="flex-1 flex min-h-0 relative overflow-hidden pb-16 lg:pb-0">
        <div className="flex-1 w-full h-full p-3 md:p-6 lg:grid lg:grid-cols-12 lg:gap-6 overflow-hidden">
          {/* Left: Queue */}
          <div className={cn(
            "h-full lg:col-span-4",
            mobileTab === 'queue' ? "block" : "hidden lg:block"
          )}>
            <QueueView
              queue={roomState?.queue || []}
              history={roomState?.history || []}
              isHost={isHost}
              currentUserId={userId}
              pendingRequests={roomState?.pendingRequests || []}
              isRequestOnly={roomState?.isRequestOnly}
              onReorder={(oldIdx, newIdx) => emitMutation('QUEUE_REORDER', { index: oldIdx, newIndex: newIdx })}
              onRemove={(index) => emitMutation('QUEUE_REMOVE', { index })}
              onJump={(index) => emitMutation('QUEUE_JUMP', { index })}
              onUpvote={(videoId) => emitMutation('QUEUE_UPVOTE', { videoId })}
              onAddAgain={(videoId, title) => emitMutation('QUEUE_ADD', { item: { videoId, title } })}
              onToggleRequestOnly={(val) => emitMutation('SET_REQUEST_ONLY', { isRequestOnly: val })}
              onApprove={(id) => emitMutation('APPROVE_REQUEST', { requestId: id })}
              onDeny={(id) => emitMutation('DENY_REQUEST', { requestId: id })}
              onApproveAll={() => emitMutation('APPROVE_ALL_REQUESTS')}
              onDenyAll={() => emitMutation('DENY_ALL_REQUESTS')}
              onClear={() => emitMutation('QUEUE_CLEAR')}
              onShuffle={() => emitMutation('QUEUE_SHUFFLE')}
            />
          </div>

          {/* Center: Hero Now Playing & Ingestion */}
          <div className={cn(
            "h-full lg:col-span-5 flex flex-col justify-between space-y-4 overflow-y-auto",
            mobileTab === 'now-playing' || mobileTab === 'search' ? "block" : "hidden lg:flex"
          )}>
            <div className="w-full shrink-0">
              <MediaIngestionForm onIngest={handleIngest} />
            </div>

            <div className="flex-1 flex items-center justify-center min-h-0 py-2">
              <NowPlayingCard
                videoId={roomState?.currentTrackId || ''}
                title={roomState?.currentTitle || ''}
                author={roomState?.currentAuthor}
                duration={roomState?.currentDuration}
                addedBy={roomState?.currentTrackAddedBy}
                isPlaying={roomState?.isPlaying || false}
                isHost={isHost}
                isUnsynced={isUnsynced}
                volume={volume}
                playbackRate={playbackRate}
                isLiked={roomState?.currentTrackId ? likedTrackIds.has(roomState.currentTrackId) : false}
                dataSaver={dataSaver}
                repeatMode={roomState?.repeatMode || 'off'}
                p2pStatus={p2pStatus}
                p2pLatencyMs={p2pLatencyMs}
                currentTime={currentTime}
                totalDuration={totalDuration}
                onPlay={() => emitMutation('PLAY', { playhead: currentTime })}
                onPause={() => emitMutation('PAUSE', { playhead: currentTime })}
                onSkip={() => emitMutation('SKIP')}
                onBack={() => emitMutation('BACK')}
                onSeek={handleSeek}
                onToggleRepeat={handleToggleRepeat}
                onToggleDataSaver={() => setDataSaver(!dataSaver)}
                onToggleUnsynced={() => setIsUnsynced(!isUnsynced)}
                onVolumeChange={(v) => setVolume(v)}
                onToggleLike={handleToggleLikeCurrentTrack}
                onOpenLyrics={() => setShowLyrics(true)}
                onCyclePlaybackRate={handleCyclePlaybackRate}
                canGoBack={isHost && (roomState?.history?.length || 0) > 0}
                canSkip={isHost && ((roomState?.queue?.length || 0) > 0 || (roomState?.repeatMode || 'off') !== 'off' || !!roomState?.isDjAutoplayEnabled)}
                audioUnlocked={audioUnlocked}
                onUnlockAudio={handleUnlockAudio}
              />
            </div>
          </div>

          {/* Right: Live Chat */}
          <div className={cn(
            "h-full lg:col-span-3",
            mobileTab === 'chat' ? "block" : "hidden lg:block"
          )}>
            <ChatView
              messages={messages}
              onSendMessage={sendMessage}
              onReaction={handleLocalReaction}
              currentUserId={userId}
              chatError={chatError}
            />
          </div>
        </div>
      </div>

      {/* Mobile Bottom Navigation */}
      <MobileBottomNav
        activeTab={mobileTab}
        onTabChange={(tab) => setMobileTab(tab)}
        queueCount={roomState?.queue?.length || 0}
        unreadChatCount={messages.length > 0 ? 1 : 0}
        currentTitle={roomState?.currentTitle}
        isPlaying={roomState?.isPlaying || false}
        onTogglePlay={() => emitMutation(roomState?.isPlaying ? 'PAUSE' : 'PLAY', { playhead: currentTime })}
        currentThumbnail={roomState?.currentTrackId ? `https://img.youtube.com/vi/${roomState.currentTrackId}/default.jpg` : undefined}
        isHost={isHost}
      />

      {/* Host Settings Modal */}
      {showSettings && isHost && (
        <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-zinc-950 border border-zinc-800 rounded-3xl p-6 shadow-2xl space-y-6">
            <div className="flex items-center justify-between border-b border-zinc-900 pb-4">
              <h3 className="text-sm font-black text-white uppercase tracking-wider">Session Settings</h3>
              <button onClick={() => setShowSettings(false)} className="p-1.5 hover:bg-zinc-900 rounded-xl text-zinc-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider ml-1">Session Title</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    className="flex-1 bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                  />
                  <button
                    onClick={() => emitMutation('SET_TITLE', { title: editTitle })}
                    className="px-3 py-2 bg-emerald-500 text-black font-bold text-xs rounded-xl hover:bg-emerald-400"
                  >
                    Save
                  </button>
                </div>
              </div>

              {/* DJ Autoplay Mode */}
              <div className="flex items-center justify-between p-3 bg-zinc-900/60 rounded-2xl border border-zinc-800">
                <div>
                  <div className="text-xs font-bold text-white flex items-center gap-1.5">
                    <Wand2 className="w-3.5 h-3.5 text-emerald-400" />
                    <span>DJ Autoplay Radio</span>
                  </div>
                  <div className="text-[10px] text-zinc-500">Auto-queue related songs when empty</div>
                </div>
                <button
                  onClick={() => emitMutation('SET_DJ_AUTOPLAY', { isDjAutoplayEnabled: !roomState?.isDjAutoplayEnabled })}
                  className={cn(
                    "w-11 h-6 rounded-full transition-all relative",
                    roomState?.isDjAutoplayEnabled ? "bg-emerald-500" : "bg-zinc-800"
                  )}
                >
                  <div className={cn("w-4 h-4 bg-black rounded-full absolute top-1 transition-all", roomState?.isDjAutoplayEnabled ? "right-1" : "left-1")} />
                </button>
              </div>

              <div className="flex items-center justify-between p-3 bg-zinc-900/60 rounded-2xl border border-zinc-800">
                <div>
                  <div className="text-xs font-bold text-white">Public Jam</div>
                  <div className="text-[10px] text-zinc-500">Show in public browser</div>
                </div>
                <button
                  onClick={() => emitMutation('SET_PUBLIC', { isPublic: !roomState?.isPublic })}
                  className={cn(
                    "w-11 h-6 rounded-full transition-all relative",
                    roomState?.isPublic ? "bg-emerald-500" : "bg-zinc-800"
                  )}
                >
                  <div className={cn("w-4 h-4 bg-black rounded-full absolute top-1 transition-all", roomState?.isPublic ? "right-1" : "left-1")} />
                </button>
              </div>

              <div className="flex items-center justify-between p-3 bg-zinc-900/60 rounded-2xl border border-zinc-800">
                <div>
                  <div className="text-xs font-bold text-white">Governance Mode</div>
                  <div className="text-[10px] text-zinc-500">Require approval for guest adds</div>
                </div>
                <button
                  onClick={() => emitMutation('SET_REQUEST_ONLY', { isRequestOnly: !roomState?.isRequestOnly })}
                  className={cn(
                    "w-11 h-6 rounded-full transition-all relative",
                    roomState?.isRequestOnly ? "bg-emerald-500" : "bg-zinc-800"
                  )}
                >
                  <div className={cn("w-4 h-4 bg-black rounded-full absolute top-1 transition-all", roomState?.isRequestOnly ? "right-1" : "left-1")} />
                </button>
              </div>

              <div className="p-3 bg-zinc-900/60 rounded-2xl border border-zinc-800 space-y-3">
                <div>
                  <div className="text-xs font-bold text-white">Chat Rate Limiter</div>
                  <div className="text-[10px] text-zinc-500">Messages allowed per interval</div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[9px] font-bold text-zinc-500 uppercase">Max msgs</label>
                    <input
                      type="number"
                      min="1"
                      max="50"
                      value={chatMaxTokens}
                      onChange={(e) => setChatMaxTokens(Number(e.target.value))}
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-1.5 text-xs text-white"
                    />
                  </div>
                  <div>
                    <label className="text-[9px] font-bold text-zinc-500 uppercase">Interval (s)</label>
                    <input
                      type="number"
                      min="1"
                      max="60"
                      value={chatInterval}
                      onChange={(e) => setChatInterval(Number(e.target.value))}
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-1.5 text-xs text-white"
                    />
                  </div>
                </div>
                <button
                  onClick={() => emitMutation('SET_CHAT_RATE_LIMIT', { chatRateLimit: { maxTokens: chatMaxTokens, intervalMs: chatInterval * 1000 } })}
                  className="w-full py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl text-xs font-bold transition-all"
                >
                  Update Limits
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Fullscreen Party Mode */}
      {showFullscreen && (
        <FullscreenPlayer
          videoId={roomState?.currentTrackId || ''}
          title={roomState?.currentTitle || ''}
          author={roomState?.currentAuthor}
          addedBy={roomState?.currentTrackAddedBy}
          isPlaying={roomState?.isPlaying || false}
          isHost={isHost}
          volume={volume}
          currentTime={currentTime}
          totalDuration={totalDuration}
          repeatMode={roomState?.repeatMode || 'off'}
          roomId={activeRoomId}
          onPlay={() => emitMutation('PLAY', { playhead: currentTime })}
          onPause={() => emitMutation('PAUSE', { playhead: currentTime })}
          onSkip={() => emitMutation('SKIP')}
          onBack={() => emitMutation('BACK')}
          onSeek={handleSeek}
          onVolumeChange={(v) => setVolume(v)}
          onToggleRepeat={handleToggleRepeat}
          onReact={handleLocalReaction}
          onClose={() => setShowFullscreen(false)}
        />
      )}

      {/* Synced Lyrics Drawer */}
      {showLyrics && roomState?.currentTrackId && (
        <LyricsDrawer
          title={roomState.currentTitle || ''}
          author={roomState.currentAuthor}
          currentTime={currentTime}
          onClose={() => setShowLyrics(false)}
        />
      )}

      {/* Liked Songs Library Modal */}
      {showLikedSongs && (
        <LikedSongsModal
          onQueueTrack={handleQueueLikedTrack}
          onQueueAll={handleQueueAllLiked}
          onClose={() => setShowLikedSongs(false)}
        />
      )}

      {/* Playlists & Archives Drawer */}
      {showPlaylistDrawer && (
        <PlaylistDrawer
          currentQueue={roomState?.queue || []}
          currentTrack={roomState?.currentTrackId ? {
            videoId: roomState.currentTrackId,
            title: roomState.currentTitle,
            duration: roomState.currentDuration,
            author: roomState.currentAuthor
          } : undefined}
          onLoadPlaylist={handleLoadSavedPlaylist}
          onClose={() => setShowPlaylistDrawer(false)}
        />
      )}

      {/* Sleep Timer Modal */}
      {showSleepTimer && (
        <SleepTimerModal
          currentRemainingSeconds={sleepTimerSeconds}
          onSetTimer={handleSetSleepTimer}
          onCancelTimer={handleCancelSleepTimer}
          onClose={() => setShowSleepTimer(false)}
        />
      )}

      {/* Keyboard Shortcuts Cheat Sheet */}
      {showShortcutHelp && (
        <ShortcutHelpModal onClose={() => setShowShortcutHelp(false)} />
      )}

      {/* Share / QR Modal */}
      {showShareModal && (
        <ShareModal
          roomId={activeRoomId}
          roomTitle={roomState?.title || activeRoomId}
          onClose={() => setShowShareModal(false)}
        />
      )}

      {/* User Roster / P2P Modal */}
      {showRosterModal && (
        <UserRosterModal
          peers={roomState?.peers || []}
          currentUserId={userId}
          hostUserId={roomState?.hostUserId}
          isHost={isHost}
          p2pStatus={p2pStatus}
          p2pLatencyMs={p2pLatencyMs}
          onTransferHost={handleTransferHost}
          onClose={() => setShowRosterModal(false)}
        />
      )}
    </div>
  );
}

export default App;
