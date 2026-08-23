import { useState, useRef, forwardRef, useImperativeHandle } from 'react';

export interface FloatingReactionItem {
  id: number;
  emoji: string;
  leftPercent: number;
  driftPx: number;
  scale: number;
  rotationDeg: number;
}

export interface FloatingReactionsRef {
  spawnReaction: (emoji: string) => void;
}

interface FloatingReactionsProps {
  enabled?: boolean;
}

export const FloatingReactions = forwardRef<FloatingReactionsRef, FloatingReactionsProps>(({ enabled = true }, ref) => {
  const [reactions, setReactions] = useState<FloatingReactionItem[]>([]);
  const idCounter = useRef(0);

  useImperativeHandle(ref, () => ({
    spawnReaction: (emoji: string) => {
      if (!enabled) return;

      const newId = ++idCounter.current;
      const leftPercent = 35 + Math.random() * 30; // Centered floating lane
      const driftPx = (Math.random() - 0.5) * 80;
      const scale = 0.9 + Math.random() * 0.35;
      const rotationDeg = (Math.random() - 0.5) * 30;

      setReactions((prev) => {
        const next = [...prev, { id: newId, emoji, leftPercent, driftPx, scale, rotationDeg }];
        if (next.length > 12) {
          return next.slice(-12);
        }
        return next;
      });

      setTimeout(() => {
        setReactions((prev) => prev.filter((r) => r.id !== newId));
      }, 1500);
    }
  }));

  if (!enabled || reactions.length === 0) return null;

  return (
    <div className="fixed inset-0 pointer-events-none z-[90] overflow-hidden" aria-hidden="true">
      {reactions.map((r) => (
        <span
          key={r.id}
          className="absolute bottom-20 select-none animate-float-fade transform-gpu pointer-events-none"
          style={{
            left: `${r.leftPercent}%`,
            '--drift-x': `${r.driftPx}px`,
            '--drift-rot': `${r.rotationDeg}deg`,
            '--drift-scale': `${r.scale}`,
            fontSize: `${28 * r.scale}px`,
            willChange: 'transform, opacity'
          } as React.CSSProperties}
        >
          {r.emoji}
        </span>
      ))}
    </div>
  );
});
