import React, { useState } from 'react';
import { 
  GripVertical, Trash2, Check, X, Shield, ShieldAlert, 
  Shuffle, ListPlus, Heart, ArrowUp, ArrowDown, Plus
} from 'lucide-react';
import type { QueueItem, HistoryItem, PendingRequest } from '../hooks/useSocket';
import { cn } from '../lib/utils';

interface QueueViewProps {
  queue: QueueItem[];
  detachedQueue?: QueueItem[];
  isUnsynced?: boolean;
  history: HistoryItem[];
  isHost: boolean;
  currentUserId: string;
  pendingRequests?: PendingRequest[];
  isRequestOnly?: boolean;
  onReorder: (oldIndex: number, newIndex: number) => void;
  onLocalReorder?: (oldIndex: number, newIndex: number) => void;
  onRemove: (index: number) => void;
  onLocalRemove?: (index: number) => void;
  onJump: (index: number) => void;
  onLocalJump?: (index: number) => void;
  onUpvote?: (videoId: string) => void;
  onAddAgain?: (videoId: string, title: string) => void;
  onToggleRequestOnly?: (val: boolean) => void;
  onApprove?: (id: string) => void;
  onDeny?: (id: string) => void;
  onApproveAll?: () => void;
  onDenyAll?: () => void;
  onClear?: () => void;
  onShuffle?: () => void;
}

export const QueueView: React.FC<QueueViewProps> = React.memo(({
  queue,
  detachedQueue,
  isUnsynced,
  history = [],
  isHost,
  currentUserId,
  pendingRequests = [],
  isRequestOnly,
  onReorder,
  onLocalReorder,
  onRemove,
  onLocalRemove,
  onJump,
  onLocalJump,
  onUpvote,
  onAddAgain,
  onToggleRequestOnly,
  onApprove,
  onDeny,
  onApproveAll,
  onDenyAll,
  onClear,
  onShuffle
}) => {
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<'queue' | 'pending' | 'history'>('queue');
  const [queueMode, setQueueMode] = useState<'room' | 'local'>('room');

  const activeQueue = (queueMode === 'local' && isUnsynced) ? (detachedQueue || []) : queue;

  const handleDragStart = (e: React.DragEvent, index: number) => {
    if (!isHost && queueMode === 'room') {
      e.preventDefault();
      return;
    }
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if ((!isHost && queueMode === 'room') || draggedIndex === null || draggedIndex === index) return;
  };

  const handleDrop = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if ((!isHost && queueMode === 'room') || draggedIndex === null || draggedIndex === index) return;
    if (queueMode === 'local') {
      onLocalReorder?.(draggedIndex, index);
    } else {
      onReorder(draggedIndex, index);
    }
    setDraggedIndex(null);
  };

  const handleMove = (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= activeQueue.length) return;
    if (queueMode === 'local') {
      onLocalReorder?.(index, targetIndex);
    } else {
      onReorder(index, targetIndex);
    }
  };

  return (
    <div className="flex flex-col h-full bg-zinc-950/80 rounded-3xl border border-zinc-800/80 overflow-hidden shadow-2xl backdrop-blur-xl">
      {/* Header & Tabs */}
      <div className="p-4 border-b border-zinc-900 bg-zinc-950 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ListPlus className="w-4 h-4 text-emerald-400" />
            <h3 className="text-sm font-black text-white uppercase tracking-wider">
              {activeTab === 'queue' ? 'Collab Queue' : activeTab === 'pending' ? 'Pending Approval' : 'History'}
            </h3>
          </div>
          <span className="text-[11px] font-mono font-bold text-zinc-500">
            {activeTab === 'queue' ? `${activeQueue.length} tracks` : activeTab === 'pending' ? `${pendingRequests.length} pending` : `${history.length} tracks`}
          </span>
        </div>

        {/* Tab Buttons */}
        <div className="flex items-center gap-1.5 p-1 bg-zinc-900/80 rounded-2xl border border-zinc-800/80">
          <button
            onClick={() => setActiveTab('queue')}
            className={cn(
              "flex-1 py-1.5 rounded-xl text-xs font-bold transition-all",
              activeTab === 'queue' ? "bg-zinc-800 text-white shadow" : "text-zinc-500 hover:text-zinc-300"
            )}
          >
            Queue ({activeQueue.length})
          </button>

          {isHost && (
            <button
              onClick={() => setActiveTab('pending')}
              className={cn(
                "flex-1 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5",
                activeTab === 'pending' ? "bg-zinc-800 text-white shadow" : "text-zinc-500 hover:text-zinc-300"
              )}
            >
              <span>Requests</span>
              {pendingRequests.length > 0 && (
                <span className="px-1.5 py-0.2 bg-red-500 text-white rounded-full text-[9px] font-black animate-pulse">
                  {pendingRequests.length}
                </span>
              )}
            </button>
          )}

          <button
            onClick={() => setActiveTab('history')}
            className={cn(
              "flex-1 py-1.5 rounded-xl text-xs font-bold transition-all",
              activeTab === 'history' ? "bg-zinc-800 text-white shadow" : "text-zinc-500 hover:text-zinc-300"
            )}
          >
            History
          </button>
        </div>

        {/* Host Control Actions */}
        {isHost && activeTab === 'queue' && (
          <div className="flex items-center justify-between gap-2 pt-1">
            <div className="flex items-center gap-1.5">
              <button
                onClick={onShuffle}
                disabled={activeQueue.length < 2}
                className="px-2.5 py-1 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 disabled:opacity-30 rounded-xl text-[11px] font-bold border border-zinc-800 transition-all flex items-center gap-1 active:scale-95"
              >
                <Shuffle className="w-3 h-3" />
                <span>Shuffle</span>
              </button>
              <button
                onClick={onClear}
                disabled={activeQueue.length === 0}
                className="px-2.5 py-1 bg-zinc-900 hover:bg-red-950/40 text-red-400 disabled:opacity-30 rounded-xl text-[11px] font-bold border border-zinc-800 hover:border-red-500/30 transition-all flex items-center gap-1 active:scale-95"
              >
                <Trash2 className="w-3 h-3" />
                <span>Clear</span>
              </button>
            </div>

            <button
              onClick={() => onToggleRequestOnly?.(!isRequestOnly)}
              className={cn(
                "px-2.5 py-1 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all border flex items-center gap-1",
                isRequestOnly
                  ? "bg-amber-500/10 text-amber-400 border-amber-500/40"
                  : "bg-emerald-500/10 text-emerald-400 border-emerald-500/40"
              )}
            >
              {isRequestOnly ? <ShieldAlert className="w-3 h-3" /> : <Shield className="w-3 h-3" />}
              <span>{isRequestOnly ? 'Restricted' : 'Open Jam'}</span>
            </button>
          </div>
        )}
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {activeTab === 'queue' && (
          <>
            {isUnsynced && (
              <div className="flex bg-zinc-900/90 rounded-2xl p-1 mb-2 border border-zinc-800">
                <button
                  onClick={() => setQueueMode('room')}
                  className={cn(
                    "flex-1 text-[10px] font-black uppercase tracking-wider py-1.5 rounded-xl transition-all",
                    queueMode === 'room' ? "bg-zinc-800 text-white" : "text-zinc-500 hover:text-zinc-300"
                  )}
                >
                  Room Queue
                </button>
                <button
                  onClick={() => setQueueMode('local')}
                  className={cn(
                    "flex-1 text-[10px] font-black uppercase tracking-wider py-1.5 rounded-xl transition-all",
                    queueMode === 'local' ? "bg-amber-500/20 text-amber-400" : "text-zinc-500 hover:text-zinc-300"
                  )}
                >
                  Local Queue
                </button>
              </div>
            )}

            {activeQueue.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center space-y-2">
                <ListPlus className="w-8 h-8 text-zinc-700 animate-pulse" />
                <p className="text-xs font-bold uppercase tracking-wider text-zinc-600">The Queue is Empty</p>
                <p className="text-[11px] text-zinc-500 max-w-xs">Search songs or paste YouTube links to collaborate on the playlist!</p>
              </div>
            ) : (
              <ul className="space-y-2">
                {activeQueue.map((item, idx) => {
                  const hasUpvoted = (item.upvotes || []).includes(currentUserId);
                  const upvoteCount = (item.upvotes || []).length;

                  return (
                    <li
                      key={`${item.videoId}-${idx}`}
                      draggable={isHost || queueMode === 'local'}
                      onDragStart={(e) => handleDragStart(e, idx)}
                      onDragOver={(e) => handleDragOver(e, idx)}
                      onDrop={(e) => handleDrop(e, idx)}
                      onDragEnd={() => setDraggedIndex(null)}
                      onClick={() => (isHost || queueMode === 'local') ? (queueMode === 'local' ? onLocalJump?.(idx) : onJump(idx)) : undefined}
                      className={cn(
                        "flex items-center gap-3 p-3 bg-zinc-900/50 hover:bg-zinc-800/80 rounded-2xl border border-zinc-800/60 transition-all group",
                        draggedIndex === idx && "opacity-40 border-dashed",
                        (isHost || queueMode === 'local') && "cursor-pointer"
                      )}
                    >
                      <div className="flex items-center gap-1.5 shrink-0">
                        {(isHost || queueMode === 'local') ? (
                          <GripVertical className="w-4 h-4 text-zinc-600 group-hover:text-zinc-400 cursor-grab active:cursor-grabbing" onClick={(e) => e.stopPropagation()} />
                        ) : (
                          <span className="text-[11px] font-mono text-zinc-600 w-4 text-center">{idx + 1}</span>
                        )}
                      </div>

                      <div className="w-12 h-12 rounded-xl bg-zinc-800 overflow-hidden shrink-0 border border-zinc-700/50">
                        <img 
                          src={`https://img.youtube.com/vi/${item.videoId}/default.jpg`} 
                          alt={item.title} 
                          className="w-full h-full object-cover"
                        />
                      </div>

                      <div className="flex-1 min-w-0">
                        <h4 className="text-xs font-bold text-white truncate line-clamp-1" title={item.title}>
                          {item.title}
                        </h4>
                        <div className="flex items-center gap-2 text-[10px] text-zinc-500 mt-0.5 truncate">
                          {item.author && <span>{item.author}</span>}
                          {item.duration && <span>• {item.duration}</span>}
                          {item.addedBy && (
                            <span className="text-emerald-400/80 truncate">
                              • by @{item.addedBy.username}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => onUpvote?.(item.videoId)}
                          className={cn(
                            "px-2 py-1 rounded-xl text-xs font-bold flex items-center gap-1 transition-all active:scale-90 border",
                            hasUpvoted
                              ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/40"
                              : "bg-zinc-800/80 text-zinc-400 hover:text-white border-zinc-700/60"
                          )}
                          title="Upvote song in collaborative queue"
                        >
                          <Heart className={cn("w-3.5 h-3.5", hasUpvoted && "fill-current")} />
                          {upvoteCount > 0 && <span>{upvoteCount}</span>}
                        </button>

                        {(isHost || queueMode === 'local') && (
                          <div className="flex flex-col opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              disabled={idx === 0}
                              onClick={() => handleMove(idx, 'up')}
                              className="p-1 hover:bg-zinc-700 text-zinc-500 hover:text-white rounded disabled:opacity-20"
                            >
                              <ArrowUp className="w-3 h-3" />
                            </button>
                            <button
                              disabled={idx === activeQueue.length - 1}
                              onClick={() => handleMove(idx, 'down')}
                              className="p-1 hover:bg-zinc-700 text-zinc-500 hover:text-white rounded disabled:opacity-20"
                            >
                              <ArrowDown className="w-3 h-3" />
                            </button>
                          </div>
                        )}

                        {(isHost || queueMode === 'local') && (
                          <button
                            onClick={() => queueMode === 'local' ? onLocalRemove?.(idx) : onRemove(idx)}
                            className="p-1.5 hover:bg-red-500/20 text-zinc-600 hover:text-red-400 rounded-xl transition-colors opacity-0 group-hover:opacity-100"
                            title="Remove from queue"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </>
        )}

        {/* Pending Requests Tab */}
        {activeTab === 'pending' && (
          pendingRequests.length === 0 ? (
            <div className="text-center text-zinc-600 text-xs py-12">No pending track requests</div>
          ) : (
            <div className="space-y-3">
              {pendingRequests.length > 1 && (
                <div className="flex justify-end gap-2 px-1">
                  <button
                    onClick={onApproveAll}
                    className="px-3 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 text-xs font-bold rounded-xl border border-emerald-500/30 flex items-center gap-1.5 transition-colors"
                  >
                    <Check className="w-3.5 h-3.5" /> Accept All
                  </button>
                  <button
                    onClick={onDenyAll}
                    className="px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs font-bold rounded-xl border border-red-500/30 flex items-center gap-1.5 transition-colors"
                  >
                    <X className="w-3.5 h-3.5" /> Reject All
                  </button>
                </div>
              )}

              <ul className="space-y-2">
                {pendingRequests.map((req) => (
                  <li
                    key={req.id}
                    className="flex items-center justify-between gap-3 p-3 bg-zinc-900/60 rounded-2xl border border-zinc-800"
                  >
                    <div className="flex-1 min-w-0">
                      <h4 className="text-xs font-bold text-white truncate">{req.title}</h4>
                      <p className="text-[10px] text-zinc-500 mt-0.5">
                        Requested by <span className="text-emerald-400 font-bold">@{req.username}</span>
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        onClick={() => onApprove?.(req.id)}
                        className="p-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-xl transition-all"
                        title="Approve"
                      >
                        <Check className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => onDeny?.(req.id)}
                        className="p-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 rounded-xl transition-all"
                        title="Deny"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )
        )}

        {/* History Tab */}
        {activeTab === 'history' && (
          history.length === 0 ? (
            <div className="text-center text-zinc-600 text-xs py-12">No tracks in playback history yet</div>
          ) : (
            <ul className="space-y-2">
              {history.map((hist, idx) => (
                <li
                  key={`${hist.videoId}-${idx}`}
                  className="flex items-center justify-between gap-3 p-3 bg-zinc-900/40 rounded-2xl border border-zinc-800/50 hover:bg-zinc-900/70 transition-colors"
                >
                  <div className="w-10 h-10 rounded-xl bg-zinc-800 overflow-hidden shrink-0 border border-zinc-700/50">
                    <img 
                      src={`https://img.youtube.com/vi/${hist.videoId}/default.jpg`} 
                      alt={hist.title} 
                      className="w-full h-full object-cover grayscale opacity-70"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-xs font-medium text-zinc-300 truncate">{hist.title}</h4>
                    <span className="text-[9px] text-zinc-500 uppercase tracking-widest font-mono">
                      {hist.status === 'played' ? 'Played' : 'Skipped'}
                    </span>
                  </div>
                  <button
                    onClick={() => onAddAgain?.(hist.videoId, hist.title)}
                    className="px-2.5 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-white text-[11px] font-bold rounded-xl transition-all flex items-center gap-1 shrink-0"
                    title="Add back to queue"
                  >
                    <Plus className="w-3.5 h-3.5" /> Re-add
                  </button>
                </li>
              ))}
            </ul>
          )
        )}
      </div>
    </div>
  );
});
