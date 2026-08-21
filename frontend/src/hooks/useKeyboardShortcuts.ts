import { useEffect } from 'react';

interface KeyboardShortcutHandlers {
  onTogglePlay?: () => void;
  onSeekForward?: () => void;
  onSeekBackward?: () => void;
  onNext?: () => void;
  onPrev?: () => void;
  onToggleMute?: () => void;
  onToggleFullscreen?: () => void;
  onToggleRepeat?: () => void;
  onShuffle?: () => void;
  onShowHelp?: () => void;
}

export function useKeyboardShortcuts(
  handlers: KeyboardShortcutHandlers,
  disabled: boolean = false
) {
  useEffect(() => {
    if (disabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore keystrokes inside input, textarea, or contentEditable elements
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) {
        return;
      }

      switch (e.key) {
        case ' ':
        case 'k':
        case 'K':
          e.preventDefault();
          handlers.onTogglePlay?.();
          break;
        case 'ArrowLeft':
        case 'j':
        case 'J':
          e.preventDefault();
          handlers.onSeekBackward?.();
          break;
        case 'ArrowRight':
        case 'l':
        case 'L':
          e.preventDefault();
          handlers.onSeekForward?.();
          break;
        case 'n':
        case 'N':
          e.preventDefault();
          handlers.onNext?.();
          break;
        case 'p':
        case 'P':
          e.preventDefault();
          handlers.onPrev?.();
          break;
        case 'm':
        case 'M':
          e.preventDefault();
          handlers.onToggleMute?.();
          break;
        case 'f':
        case 'F':
          e.preventDefault();
          handlers.onToggleFullscreen?.();
          break;
        case 'r':
        case 'R':
          e.preventDefault();
          handlers.onToggleRepeat?.();
          break;
        case 's':
        case 'S':
          e.preventDefault();
          handlers.onShuffle?.();
          break;
        case '?':
          e.preventDefault();
          handlers.onShowHelp?.();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handlers, disabled]);
}
