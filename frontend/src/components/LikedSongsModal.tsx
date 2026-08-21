import React, { useState, useEffect } from 'react';
import { Heart, X, Play, Plus, Trash2, Search, Download, ListPlus } from 'lucide-react';
import type { QueueItem } from '../hooks/useSocket';

export interface LikedTrack {
  videoId: string;
  title: string;
  author?: string;
  duration?: string;
  likedAt: number;
}

interface LikedSongsModalProps {
  onQueueTrack: (item: QueueItem, playNext?: boolean) => void;
  onQueueAll: (items: QueueItem[]) => void;
  onClose: () => void;
}

const STORAGE_KEY = 'muser_liked_tracks';

export const LikedSongsModal: React.FC<LikedSongsModalProps> = ({
  onQueueTrack,
  onQueueAll,
  onClose
}) => {
  const [likedTracks, setLikedTracks] = useState<LikedTrack[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(likedTracks));
  }, [likedTracks]);

  const handleDelete = (videoId: string) => {
    setLikedTracks(likedTracks.filter(t => t.videoId !== videoId));
  };

  const handleExport = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(likedTracks, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `muser_liked_songs_${Date.now()}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const filtered = likedTracks.filter(t => 
    t.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
    (t.author && t.author.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="fixed inset-0 z-[110] bg-black/85 backdrop-blur-xl flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-xl bg-zinc-950 border border-zinc-800 rounded-3xl p-6 shadow-2xl space-y-6 max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-900 pb-4 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-red-500/10 border border-red-500/30 flex items-center justify-center text-red-400">
              <Heart className="w-4 h-4 fill-current" />
            </div>
            <div>
              <h3 className="text-sm font-black text-white uppercase tracking-wider">Liked Songs</h3>
              <p className="text-[11px] text-zinc-500">{likedTracks.length} saved tracks in your library</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-zinc-900 rounded-xl text-zinc-400 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search & Actions Bar */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="flex-1 flex items-center bg-zinc-900/80 border border-zinc-800 rounded-2xl px-3 py-2">
            <Search className="w-4 h-4 text-zinc-500 mr-2 shrink-0" />
            <input
              type="text"
              placeholder="Search your liked songs..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-transparent text-xs text-white placeholder:text-zinc-500 focus:outline-none"
            />
          </div>
          {likedTracks.length > 0 && (
            <>
              <button
                onClick={() => onQueueAll(likedTracks.map(t => ({ videoId: t.videoId, title: t.title, duration: t.duration, author: t.author })))}
                className="py-2 px-3 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-2xl text-xs font-bold transition-all flex items-center gap-1.5 shrink-0"
                title="Queue all liked songs"
              >
                <ListPlus className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Queue All</span>
              </button>
              <button
                onClick={handleExport}
                className="p-2 bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white border border-zinc-800 rounded-2xl transition-colors"
                title="Export list"
              >
                <Download className="w-4 h-4" />
              </button>
            </>
          )}
        </div>

        {/* Tracks List */}
        <div className="flex-1 overflow-y-auto space-y-2 pr-1">
          {filtered.length === 0 ? (
            <div className="text-center text-zinc-600 text-xs py-16 space-y-2">
              <Heart className="w-8 h-8 mx-auto text-zinc-800 animate-pulse" />
              <p>No liked tracks found. Tap the heart on any song to save it here!</p>
            </div>
          ) : (
            filtered.map((track) => (
              <div
                key={track.videoId}
                className="flex items-center justify-between gap-3 p-3 bg-zinc-900/40 hover:bg-zinc-900/70 border border-zinc-800/60 rounded-2xl transition-all group"
              >
                <div className="w-11 h-11 rounded-xl bg-zinc-800 overflow-hidden shrink-0 border border-zinc-700/50">
                  <img
                    src={`https://img.youtube.com/vi/${track.videoId}/default.jpg`}
                    alt={track.title}
                    className="w-full h-full object-cover"
                  />
                </div>

                <div className="flex-1 min-w-0">
                  <h4 className="text-xs font-bold text-white truncate" title={track.title}>
                    {track.title}
                  </h4>
                  <p className="text-[10px] text-zinc-500 truncate mt-0.5">
                    {track.author} {track.duration && `• ${track.duration}`}
                  </p>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    onClick={() => onQueueTrack({ videoId: track.videoId, title: track.title, duration: track.duration, author: track.author }, true)}
                    className="p-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-xl transition-all"
                    title="Play Next"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                  </button>
                  <button
                    onClick={() => onQueueTrack({ videoId: track.videoId, title: track.title, duration: track.duration, author: track.author }, false)}
                    className="p-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl transition-all"
                    title="Add to Queue"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleDelete(track.videoId)}
                    className="p-2 hover:bg-red-950/40 text-zinc-600 hover:text-red-400 rounded-xl transition-colors"
                    title="Remove from Liked"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
