import React from 'react';
import { X, Crown, Radio, UserCheck } from 'lucide-react';
import type { PeerInfo } from '../hooks/useSocket';
import type { P2PStatus } from '../hooks/useP2P';
import { cn } from '../lib/utils';

interface UserRosterModalProps {
  peers: PeerInfo[];
  currentUserId: string;
  hostUserId?: string;
  isHost: boolean;
  p2pStatus: P2PStatus;
  p2pLatencyMs: number | null;
  onTransferHost: (targetUserId: string) => void;
  onClose: () => void;
}

export const UserRosterModal: React.FC<UserRosterModalProps> = ({
  peers,
  currentUserId,
  hostUserId,
  isHost,
  p2pStatus,
  p2pLatencyMs,
  onTransferHost,
  onClose
}) => {
  return (
    <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-zinc-950 border border-zinc-800 rounded-3xl p-6 shadow-2xl space-y-6">
        <div className="flex items-center justify-between border-b border-zinc-900 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400">
              <UserCheck className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-black text-white uppercase tracking-wider">Session Members</h3>
              <p className="text-[11px] text-zinc-500">{peers.length} active {peers.length === 1 ? 'listener' : 'listeners'}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-zinc-900 rounded-xl text-zinc-400 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* P2P Network Status Header */}
        <div className="p-3.5 bg-zinc-900/60 rounded-2xl border border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Radio className={cn("w-4 h-4", p2pStatus === 'connected' ? "text-emerald-400 animate-pulse" : "text-blue-400")} />
            <div className="flex flex-col">
              <span className="text-[11px] font-black uppercase text-white tracking-wider">
                {p2pStatus === 'connected' ? 'WebRTC P2P Direct' : 'WebSocket Relay'}
              </span>
              <span className="text-[9px] text-zinc-500">
                {p2pStatus === 'connected' ? 'Zero-latency direct mesh link' : 'Synchronized via central relay'}
              </span>
            </div>
          </div>
          {p2pLatencyMs !== null && (
            <div className="px-2.5 py-1 bg-emerald-500/10 border border-emerald-500/30 rounded-lg text-emerald-400 font-mono text-[10px] font-bold">
              {p2pLatencyMs}ms
            </div>
          )}
        </div>

        {/* Peer List */}
        <div className="max-h-72 overflow-y-auto space-y-2 pr-1">
          {peers.map((peer) => {
            const isPeerHost = peer.userId === hostUserId;
            const isSelf = peer.userId === currentUserId;

            return (
              <div
                key={peer.userId}
                className={cn(
                  "flex items-center justify-between p-3 rounded-2xl border transition-colors",
                  isSelf ? "bg-zinc-900/90 border-zinc-700/80" : "bg-zinc-900/40 border-zinc-800/60"
                )}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-xl bg-zinc-800 border border-zinc-700 flex items-center justify-center font-bold text-xs text-white shrink-0">
                    {peer.username[0]?.toUpperCase() || '?'}
                  </div>
                  <div className="flex flex-col min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-white truncate">
                        {peer.username} {isSelf && <span className="text-zinc-500 font-normal">(You)</span>}
                      </span>
                      {peer.isDetached && (
                        <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/30">
                          Detached
                        </span>
                      )}
                    </div>
                    <span className="text-[9px] text-zinc-600 font-mono truncate">ID: {peer.userId}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {isPeerHost ? (
                    <div className="flex items-center gap-1 px-2 py-1 bg-yellow-500/10 border border-yellow-500/30 rounded-lg text-yellow-400 text-[10px] font-bold">
                      <Crown className="w-3 h-3 fill-current" />
                      <span>Host</span>
                    </div>
                  ) : (
                    isHost && (
                      <button
                        onClick={() => {
                          if (confirm(`Transfer Host permissions to ${peer.username}?`)) {
                            onTransferHost(peer.userId);
                          }
                        }}
                        className="p-2 hover:bg-yellow-500/20 text-zinc-500 hover:text-yellow-400 rounded-xl transition-all border border-transparent hover:border-yellow-500/30"
                        title="Make Host"
                      >
                        <Crown className="w-4 h-4" />
                      </button>
                    )
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
