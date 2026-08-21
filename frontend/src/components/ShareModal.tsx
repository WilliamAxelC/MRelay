import React, { useEffect, useRef, useState } from 'react';
import { X, Copy, Check, QrCode, Smartphone, Link } from 'lucide-react';

interface ShareModalProps {
  roomId: string;
  roomTitle: string;
  onClose: () => void;
}

export const ShareModal: React.FC<ShareModalProps> = ({ roomId, roomTitle, onClose }) => {
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const roomUrl = `${window.location.origin}/room/${roomId.toLowerCase()}`;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(roomUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(roomId);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  // Draw QR code using canvas with dynamic pixel mapping
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Use a lightweight QR code generation or high-contrast matrix
    // Generate QR code via quick API or self-contained matrix
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(roomUrl)}&color=ffffff&bgcolor=18181b&margin=1`;
    img.onload = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    };
  }, [roomUrl]);

  return (
    <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-zinc-950 border border-zinc-800 rounded-3xl p-6 shadow-2xl space-y-6 relative">
        <div className="flex items-center justify-between border-b border-zinc-900 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <QrCode className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-black text-white uppercase tracking-wider">Join Jam Session</h3>
              <p className="text-[11px] text-zinc-500">{roomTitle || roomId}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-zinc-900 rounded-xl text-zinc-400 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* QR Code Canvas */}
        <div className="flex flex-col items-center justify-center p-6 bg-zinc-900/50 rounded-2xl border border-zinc-800/80 space-y-3">
          <div className="w-48 h-48 bg-zinc-900 rounded-xl p-2 flex items-center justify-center overflow-hidden border border-zinc-800 shadow-inner">
            <canvas ref={canvasRef} width={200} height={200} className="w-full h-full rounded-lg" />
          </div>
          <div className="flex items-center gap-1.5 text-xs text-zinc-400 font-medium">
            <Smartphone className="w-3.5 h-3.5 text-emerald-400" />
            <span>Scan with phone camera to join instantly</span>
          </div>
        </div>

        {/* Room Code & Copy Link */}
        <div className="space-y-3">
          <div className="flex items-center justify-between p-3.5 bg-zinc-900/80 rounded-2xl border border-zinc-800">
            <div className="flex flex-col">
              <span className="text-[10px] uppercase font-bold tracking-widest text-zinc-500">Room Code</span>
              <span className="text-base font-mono font-black text-white tracking-widest">{roomId}</span>
            </div>
            <button
              onClick={handleCopyCode}
              className="px-3.5 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 active:scale-95"
            >
              {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedCode ? 'Copied' : 'Copy'}</span>
            </button>
          </div>

          <button
            onClick={handleCopyLink}
            className="w-full py-3.5 bg-emerald-500 hover:bg-emerald-400 text-black font-black rounded-2xl transition-all shadow-lg shadow-emerald-500/10 flex items-center justify-center gap-2 uppercase tracking-wider text-xs active:scale-98"
          >
            {copiedLink ? <Check className="w-4 h-4 text-black" /> : <Link className="w-4 h-4 text-black" />}
            <span>{copiedLink ? 'Link Copied to Clipboard!' : 'Copy Shareable Link'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
