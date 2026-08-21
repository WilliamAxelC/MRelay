import React, { useState, useEffect, useRef } from 'react';
import { Mic2, X, Edit3, Loader2, Music } from 'lucide-react';
import { cn } from '../lib/utils';

interface LyricsDrawerProps {
  title: string;
  author?: string;
  currentTime: number;
  onClose: () => void;
}

interface LyricLine {
  time: number;
  text: string;
}

export const LyricsDrawer: React.FC<LyricsDrawerProps> = ({
  title,
  author,
  currentTime,
  onClose
}) => {
  const [lyrics, setLyrics] = useState<LyricLine[]>([]);
  const [plainLyrics, setPlainLyrics] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [customLyricsText, setCustomLyricsText] = useState('');
  const activeLineRef = useRef<HTMLDivElement | null>(null);

  // Parse LRC formatted string into timestamped lines
  const parseLRC = (lrc: string): LyricLine[] => {
    const lines = lrc.split('\n');
    const result: LyricLine[] = [];
    const timeRegex = /\[(\d{2}):(\d{2})\.?(\d{2,3})?\]/;

    for (const line of lines) {
      const match = line.match(timeRegex);
      if (match) {
        const min = parseInt(match[1]);
        const sec = parseInt(match[2]);
        const ms = match[3] ? parseInt(match[3].padEnd(3, '0')) : 0;
        const totalSeconds = min * 60 + sec + ms / 1000;
        const text = line.replace(timeRegex, '').trim();
        if (text) {
          result.push({ time: totalSeconds, text });
        }
      }
    }
    return result.sort((a, b) => a.time - b.time);
  };

  // Fetch lyrics from open public LRCLIB API
  useEffect(() => {
    if (!title) return;

    // Clean track title (strip out "(Official Video)", "feat.", etc.)
    const cleanTitle = title
      .replace(/\(.*?official.*?\)/gi, '')
      .replace(/\[.*?official.*?\]/gi, '')
      .replace(/\(.*?lyrics.*?\)/gi, '')
      .replace(/\[.*?lyrics.*?\]/gi, '')
      .replace(/\[.*?video.*?\]/gi, '')
      .replace(/ft\..*$/gi, '')
      .replace(/feat\..*$/gi, '')
      .trim();

    const artist = author ? author.replace(/ - Topic$/i, '').trim() : '';

    setIsLoading(true);
    setLyrics([]);
    setPlainLyrics('');

    const fetchUrl = `https://lrclib.net/api/get?track_name=${encodeURIComponent(cleanTitle)}${artist ? `&artist_name=${encodeURIComponent(artist)}` : ''}`;

    fetch(fetchUrl)
      .then(res => {
        if (!res.ok) throw new Error('Not found in LRCLIB');
        return res.json();
      })
      .then(data => {
        if (data.syncedLyrics) {
          const parsed = parseLRC(data.syncedLyrics);
          setLyrics(parsed);
        } else if (data.plainLyrics) {
          setPlainLyrics(data.plainLyrics);
        } else {
          setPlainLyrics('No lyrics found for this track. You can add custom lyrics below!');
        }
      })
      .catch(() => {
        // Fallback search
        fetch(`https://lrclib.net/api/search?q=${encodeURIComponent(`${cleanTitle} ${artist}`)}`)
          .then(res => res.json())
          .then(results => {
            if (results && results.length > 0 && (results[0].syncedLyrics || results[0].plainLyrics)) {
              if (results[0].syncedLyrics) {
                setLyrics(parseLRC(results[0].syncedLyrics));
              } else {
                setPlainLyrics(results[0].plainLyrics);
              }
            } else {
              setPlainLyrics('No lyrics found for this track. Click "Edit Lyrics" to paste your own!');
            }
          })
          .catch(() => {
            setPlainLyrics('Unable to fetch lyrics automatically. Click "Edit Lyrics" to add singalong lyrics!');
          });
      })
      .finally(() => setIsLoading(false));
  }, [title, author]);

  // Auto-scroll to active line
  const activeIndex = lyrics.findIndex((line, i) => {
    const nextLine = lyrics[i + 1];
    return currentTime >= line.time && (!nextLine || currentTime < nextLine.time);
  });

  useEffect(() => {
    if (activeLineRef.current) {
      activeLineRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'center'
      });
    }
  }, [activeIndex]);

  const handleSaveCustomLyrics = () => {
    if (!customLyricsText.trim()) return;

    if (customLyricsText.includes('[00:')) {
      const parsed = parseLRC(customLyricsText);
      setLyrics(parsed);
      setPlainLyrics('');
    } else {
      setPlainLyrics(customLyricsText);
      setLyrics([]);
    }
    setIsEditing(false);
  };

  return (
    <div className="fixed inset-0 z-[110] bg-black/85 backdrop-blur-xl flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-2xl bg-zinc-950 border border-zinc-800 rounded-3xl p-6 shadow-2xl space-y-6 max-h-[85vh] flex flex-col relative overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-900 pb-4 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-2xl bg-pink-500/10 border border-pink-500/30 flex items-center justify-center text-pink-400 shrink-0">
              <Mic2 className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-black text-white uppercase tracking-wider truncate">
                {title || 'Lyrics'}
              </h3>
              <p className="text-[11px] text-zinc-500 truncate">
                {author || 'Singalong Karaoke Mode'} {lyrics.length > 0 && '• Synced ✨'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => {
                setCustomLyricsText(lyrics.length > 0 ? lyrics.map(l => l.text).join('\n') : plainLyrics);
                setIsEditing(!isEditing);
              }}
              className="p-2 bg-zinc-900 hover:bg-zinc-800 rounded-xl text-zinc-400 hover:text-white border border-zinc-800 transition-colors"
              title="Edit Lyrics"
            >
              <Edit3 className="w-4 h-4" />
            </button>
            <button onClick={onClose} className="p-1.5 hover:bg-zinc-900 rounded-xl text-zinc-400 hover:text-white transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto space-y-4 px-2 py-4 select-none">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center h-64 space-y-3">
              <Loader2 className="w-8 h-8 text-pink-400 animate-spin" />
              <p className="text-xs text-zinc-500 font-bold uppercase tracking-wider">Syncing Lyrics...</p>
            </div>
          ) : isEditing ? (
            <div className="space-y-4">
              <label className="text-[10px] font-bold text-zinc-400 uppercase">
                Paste Lyrics or LRC Format ([00:12.34] Lyric line)
              </label>
              <textarea
                rows={12}
                value={customLyricsText}
                onChange={(e) => setCustomLyricsText(e.target.value)}
                className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl p-4 text-sm font-medium text-white focus:outline-none focus:border-pink-500 font-mono"
              />
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setIsEditing(false)}
                  className="px-4 py-2 bg-zinc-900 hover:bg-zinc-800 text-zinc-400 text-xs font-bold rounded-xl"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveCustomLyrics}
                  className="px-4 py-2 bg-pink-500 hover:bg-pink-400 text-black text-xs font-black uppercase tracking-wider rounded-xl shadow-lg"
                >
                  Save Lyrics
                </button>
              </div>
            </div>
          ) : lyrics.length > 0 ? (
            <div className="space-y-6 text-center py-12">
              {lyrics.map((line, idx) => {
                const isActive = idx === activeIndex;
                const isPassed = idx < activeIndex;

                return (
                  <div
                    key={idx}
                    ref={isActive ? activeLineRef : null}
                    className={cn(
                      "transition-all duration-300 font-bold leading-relaxed cursor-pointer hover:scale-105",
                      isActive
                        ? "text-2xl sm:text-3xl text-pink-400 scale-110 drop-shadow-[0_0_15px_rgba(244,114,182,0.6)]"
                        : isPassed
                        ? "text-base sm:text-lg text-zinc-600"
                        : "text-base sm:text-lg text-zinc-400 opacity-60"
                    )}
                  >
                    {line.text}
                  </div>
                );
              })}
            </div>
          ) : plainLyrics ? (
            <div className="whitespace-pre-line text-center text-sm sm:text-base text-zinc-300 font-medium leading-loose py-6 max-w-lg mx-auto">
              {plainLyrics}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-64 text-zinc-600 space-y-2">
              <Music className="w-8 h-8 animate-pulse" />
              <p className="text-xs font-bold uppercase tracking-wider">No lyrics available</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
