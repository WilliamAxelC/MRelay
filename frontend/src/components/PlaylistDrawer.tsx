import React, { useState, useEffect } from 'react';
import { 
  Bookmark, Plus, Trash2, Download, Upload, 
  Play, FolderPlus, X, Copy, Check, Music2
} from 'lucide-react';
import type { QueueItem } from '../hooks/useSocket';

export interface SavedPlaylist {
  id: string;
  name: string;
  createdAt: number;
  tracks: {
    videoId: string;
    title: string;
    duration?: string;
    author?: string;
  }[];
}

interface PlaylistDrawerProps {
  currentQueue: QueueItem[];
  currentTrack?: { videoId: string; title: string; duration?: string; author?: string };
  onLoadPlaylist: (tracks: QueueItem[], mode: 'append' | 'replace') => void;
  onClose: () => void;
}

const STORAGE_KEY = 'muser_saved_playlists';

export const PlaylistDrawer: React.FC<PlaylistDrawerProps> = ({
  currentQueue,
  currentTrack,
  onLoadPlaylist,
  onClose
}) => {
  const [playlists, setPlaylists] = useState<SavedPlaylist[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [importJson, setImportJson] = useState('');
  const [isImporting, setIsImporting] = useState(false);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(playlists));
  }, [playlists]);

  const handleSaveCurrentJam = () => {
    if (!newPlaylistName.trim()) return;

    const allTracks: QueueItem[] = [];
    if (currentTrack?.videoId) {
      allTracks.push({
        videoId: currentTrack.videoId,
        title: currentTrack.title,
        duration: currentTrack.duration,
        author: currentTrack.author
      });
    }
    allTracks.push(...currentQueue);

    if (allTracks.length === 0) {
      alert('Cannot save an empty queue!');
      return;
    }

    const newPlaylist: SavedPlaylist = {
      id: `pl-${Date.now()}`,
      name: newPlaylistName.trim(),
      createdAt: Date.now(),
      tracks: allTracks.map(t => ({
        videoId: t.videoId,
        title: t.title,
        duration: t.duration,
        author: t.author
      }))
    };

    setPlaylists([newPlaylist, ...playlists]);
    setNewPlaylistName('');
    setIsCreating(false);
  };

  const handleDelete = (id: string) => {
    setPlaylists(playlists.filter(p => p.id !== id));
  };

  const handleExport = (playlist: SavedPlaylist) => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(playlist, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `${playlist.name.replace(/\s+/g, '_')}_muser.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const handleCopyJson = (playlist: SavedPlaylist) => {
    navigator.clipboard.writeText(JSON.stringify(playlist));
    setCopiedId(playlist.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleImportJson = () => {
    try {
      const parsed = JSON.parse(importJson.trim());
      if (!parsed.name || !Array.isArray(parsed.tracks)) {
        throw new Error('Invalid playlist format');
      }

      const imported: SavedPlaylist = {
        id: `pl-${Date.now()}`,
        name: parsed.name + ' (Imported)',
        createdAt: Date.now(),
        tracks: parsed.tracks.filter((t: any) => t.videoId && t.title)
      };

      setPlaylists([imported, ...playlists]);
      setImportJson('');
      setIsImporting(false);
    } catch {
      alert('Invalid Muser playlist JSON format');
    }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-xl bg-zinc-950 border border-zinc-800 rounded-3xl p-6 shadow-2xl space-y-6 max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-900 pb-4 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Bookmark className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-black text-white uppercase tracking-wider">Playlists & Archives</h3>
              <p className="text-[11px] text-zinc-500">{playlists.length} saved custom playlists</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-zinc-900 rounded-xl text-zinc-400 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => { setIsCreating(!isCreating); setIsImporting(false); }}
            className="flex-1 py-2.5 px-3 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 font-bold text-xs rounded-2xl border border-emerald-500/30 transition-all flex items-center justify-center gap-1.5"
          >
            <FolderPlus className="w-4 h-4" />
            <span>Save Current Jam ({currentQueue.length + (currentTrack?.videoId ? 1 : 0)})</span>
          </button>
          <button
            onClick={() => { setIsImporting(!isImporting); setIsCreating(false); }}
            className="py-2.5 px-3 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white font-bold text-xs rounded-2xl border border-zinc-800 transition-all flex items-center justify-center gap-1.5"
          >
            <Upload className="w-4 h-4" />
            <span>Import</span>
          </button>
        </div>

        {/* Save Form */}
        {isCreating && (
          <div className="p-4 bg-zinc-900/60 rounded-2xl border border-zinc-800 space-y-3 shrink-0 animate-in fade-in duration-150">
            <label className="text-[10px] font-bold text-zinc-400 uppercase">New Playlist Name</label>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="e.g. Chill Session #1"
                value={newPlaylistName}
                onChange={(e) => setNewPlaylistName(e.target.value)}
                className="flex-1 bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
              />
              <button
                onClick={handleSaveCurrentJam}
                className="px-4 py-2 bg-emerald-500 text-black font-bold text-xs rounded-xl hover:bg-emerald-400"
              >
                Save
              </button>
            </div>
          </div>
        )}

        {/* Import Form */}
        {isImporting && (
          <div className="p-4 bg-zinc-900/60 rounded-2xl border border-zinc-800 space-y-3 shrink-0 animate-in fade-in duration-150">
            <label className="text-[10px] font-bold text-zinc-400 uppercase">Paste Muser Playlist JSON</label>
            <textarea
              rows={3}
              placeholder='{"name": "My Mix", "tracks": [...]}'
              value={importJson}
              onChange={(e) => setImportJson(e.target.value)}
              className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-3 text-xs text-white font-mono focus:outline-none focus:border-emerald-500"
            />
            <button
              onClick={handleImportJson}
              className="w-full py-2 bg-emerald-500 text-black font-bold text-xs rounded-xl hover:bg-emerald-400"
            >
              Parse & Import Playlist
            </button>
          </div>
        )}

        {/* Playlists List */}
        <div className="flex-1 overflow-y-auto space-y-3 pr-1">
          {playlists.length === 0 ? (
            <div className="text-center text-zinc-600 text-xs py-12 space-y-2">
              <Music2 className="w-8 h-8 mx-auto text-zinc-700 animate-pulse" />
              <p>No saved playlists yet. Click above to save the current session!</p>
            </div>
          ) : (
            playlists.map((pl) => (
              <div
                key={pl.id}
                className="p-4 bg-zinc-900/40 hover:bg-zinc-900/70 border border-zinc-800/80 rounded-2xl transition-all space-y-3"
              >
                <div className="flex items-center justify-between">
                  <div className="min-w-0">
                    <h4 className="text-sm font-bold text-white truncate">{pl.name}</h4>
                    <p className="text-[10px] text-zinc-500">
                      {pl.tracks.length} tracks • Created {new Date(pl.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleCopyJson(pl)}
                      className="p-1.5 hover:bg-zinc-800 rounded-xl text-zinc-400 hover:text-white"
                      title="Copy JSON"
                    >
                      {copiedId === pl.id ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                    </button>
                    <button
                      onClick={() => handleExport(pl)}
                      className="p-1.5 hover:bg-zinc-800 rounded-xl text-zinc-400 hover:text-white"
                      title="Export file"
                    >
                      <Download className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(pl.id)}
                      className="p-1.5 hover:bg-red-950/40 text-zinc-500 hover:text-red-400 rounded-xl"
                      title="Delete playlist"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => onLoadPlaylist(pl.tracks as any, 'append')}
                    className="flex-1 py-2 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white text-xs font-bold rounded-xl border border-zinc-800 transition-all flex items-center justify-center gap-1.5"
                  >
                    <Plus className="w-3.5 h-3.5" /> Append to Queue
                  </button>
                  <button
                    onClick={() => onLoadPlaylist(pl.tracks as any, 'replace')}
                    className="flex-1 py-2 bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-black uppercase tracking-wider rounded-xl transition-all flex items-center justify-center gap-1.5"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" /> Play Now
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
