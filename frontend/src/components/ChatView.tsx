import React, { useState, useRef, useEffect } from 'react';
import { Send, MessageSquare, AlertCircle, Smile } from 'lucide-react';
import { cn } from '../lib/utils';
import type { ChatMessage } from '../hooks/useSocket';

interface ChatViewProps {
  messages: ChatMessage[];
  onSendMessage: (text: string) => void;
  onReaction?: (emoji: string) => void;
  currentUserId: string;
  chatError?: { message: string; remainingMs: number } | null;
}

const QUICK_EMOJIS = ['🔥', '❤️', '👏', '🎉', '💃', '🚀', '✨', '🎧'];

export const ChatView: React.FC<ChatViewProps> = React.memo(({ 
  messages, 
  onSendMessage, 
  onReaction,
  currentUserId, 
  chatError 
}) => {
  const [text, setText] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, chatError]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (text.trim()) {
      onSendMessage(text.trim());
      setText('');
    }
  };

  const handleEmojiClick = (emoji: string) => {
    if (onReaction) {
      onReaction(emoji);
    } else {
      onSendMessage(emoji);
    }
  };

  return (
    <div className="flex flex-col h-full bg-zinc-950/80 rounded-3xl border border-zinc-800/80 overflow-hidden shadow-2xl backdrop-blur-xl relative">
      {/* Header */}
      <div className="p-4 border-b border-zinc-900 bg-zinc-950 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-emerald-400" />
          <h3 className="text-sm font-black text-white uppercase tracking-wider">Live Chat</h3>
        </div>
        <span className="text-[10px] font-mono font-bold text-zinc-500">{messages.length} messages</span>
      </div>

      {/* Messages Feed */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center space-y-2">
            <Smile className="w-8 h-8 text-zinc-700 animate-pulse" />
            <p className="text-xs font-bold uppercase tracking-wider text-zinc-600">No Messages Yet</p>
            <p className="text-[11px] text-zinc-500 max-w-xs">Drop a message or reaction to start the conversation!</p>
          </div>
        ) : (
          messages.map((msg) => {
            const isSystem = msg.userId === 'system' || msg.username === 'System';
            const isSelf = msg.userId === currentUserId;

            if (isSystem) {
              return (
                <div key={msg.id} className="flex justify-center py-1">
                  <span className="text-[10px] font-mono text-zinc-600 font-bold uppercase tracking-widest bg-zinc-900/60 px-3 py-1 rounded-full border border-zinc-800/60">
                    {msg.text}
                  </span>
                </div>
              );
            }

            return (
              <div
                key={msg.id}
                className={cn(
                  "flex flex-col max-w-[85%]",
                  isSelf ? "ml-auto items-end" : "mr-auto items-start"
                )}
              >
                {!isSelf && (
                  <span className="text-[10px] font-bold text-zinc-400 mb-1 px-1">
                    {msg.username}
                  </span>
                )}
                <div
                  className={cn(
                    "px-4 py-2.5 rounded-2xl text-xs break-words shadow-md leading-relaxed",
                    isSelf
                      ? "bg-emerald-500 text-black font-semibold rounded-br-none shadow-emerald-500/10"
                      : "bg-zinc-900 text-zinc-200 rounded-bl-none border border-zinc-800/80 shadow-black/30"
                  )}
                >
                  {msg.text}
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Quick Reaction Emojis */}
      <div className="px-3 py-1.5 bg-zinc-900/40 border-t border-zinc-900/80 flex items-center justify-between gap-1 overflow-x-auto">
        {QUICK_EMOJIS.map((emoji) => (
          <button
            key={emoji}
            onClick={() => handleEmojiClick(emoji)}
            className="p-1 text-sm hover:scale-125 transition-transform active:scale-95 rounded-lg hover:bg-zinc-800/60"
            title={`Send ${emoji}`}
          >
            {emoji}
          </button>
        ))}
      </div>

      {/* Input Area */}
      <div className="p-3 border-t border-zinc-900 bg-zinc-950 flex flex-col gap-2">
        {chatError && (
          <div className="flex items-center gap-2 text-[11px] font-bold text-red-400 bg-red-950/40 border border-red-900/40 rounded-xl px-3 py-2 animate-in fade-in">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{chatError.message}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex gap-2">
          <input
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Type a message..."
            disabled={!!chatError}
            className="flex-1 bg-zinc-900 border border-zinc-800 rounded-2xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500/80 transition-all placeholder:text-zinc-600 disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={!!chatError || !text.trim()}
            className="p-2.5 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-30 disabled:pointer-events-none text-black rounded-2xl transition-all active:scale-95 shadow-lg shadow-emerald-500/10 shrink-0 font-bold"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
});
