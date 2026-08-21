import { useEffect, useRef, forwardRef, useImperativeHandle } from 'react';

export interface ReactionParticle {
  id: string;
  emoji: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  opacity: number;
  rotation: number;
  vRot: number;
  life: number;
  maxLife: number;
}

export interface FloatingReactionsRef {
  spawnReaction: (emoji: string, originX?: number) => void;
}

export const FloatingReactions = forwardRef<FloatingReactionsRef>((_, ref) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const particlesRef = useRef<ReactionParticle[]>([]);
  const animationFrameRef = useRef<number | null>(null);

  useImperativeHandle(ref, () => ({
    spawnReaction: (emoji: string, originX?: number) => {
      const canvas = canvasRef.current;
      const width = canvas ? canvas.width : window.innerWidth;
      const height = canvas ? canvas.height : window.innerHeight;

      const baseX = originX !== undefined ? originX : width * (0.3 + Math.random() * 0.4);
      const count = 3 + Math.floor(Math.random() * 3);

      for (let i = 0; i < count; i++) {
        const particle: ReactionParticle = {
          id: `${Date.now()}-${Math.random()}`,
          emoji,
          x: baseX + (Math.random() * 60 - 30),
          y: height - 80 - Math.random() * 40,
          vx: (Math.random() - 0.5) * 2.5,
          vy: -(2.5 + Math.random() * 3.5),
          size: 24 + Math.random() * 16,
          opacity: 1.0,
          rotation: (Math.random() - 0.5) * 0.4,
          vRot: (Math.random() - 0.5) * 0.05,
          life: 0,
          maxLife: 90 + Math.floor(Math.random() * 40)
        };
        particlesRef.current.push(particle);
      }
    }
  }));

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const handleResize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };

    handleResize();
    window.addEventListener('resize', handleResize);

    const render = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const particles = particlesRef.current;
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.life++;
        p.x += p.vx + Math.sin(p.life * 0.08) * 0.8;
        p.y += p.vy;
        p.rotation += p.vRot;

        const progress = p.life / p.maxLife;
        if (progress > 0.6) {
          p.opacity = Math.max(0, 1 - (progress - 0.6) / 0.4);
        }

        ctx.save();
        ctx.globalAlpha = p.opacity;
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation);
        ctx.font = `${p.size}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(p.emoji, 0, 0);
        ctx.restore();

        if (p.life >= p.maxLife || p.y < -50) {
          particles.splice(i, 1);
        }
      }

      animationFrameRef.current = requestAnimationFrame(render);
    };

    animationFrameRef.current = requestAnimationFrame(render);

    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-[90]"
    />
  );
});
