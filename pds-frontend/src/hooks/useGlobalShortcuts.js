import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';

const SEQUENCE_TIMEOUT_MS = 600;

/** "g" + these keys, typed within SEQUENCE_TIMEOUT_MS of each other, navigate to `to`. */
const SEQUENCES = [
  { keys: ['g', 'd'], to: '/admin' },
  { keys: ['g', 's'], to: '/admin/shops' },
  { keys: ['g', 'h', 'b'], to: '/admin/health/blockchain' },
  { keys: ['g', 'h', 'i'], to: '/admin/health/iot' },
  { keys: ['g', 'a'], to: '/admin/anomalies' },
];

function isTypingTarget(target) {
  if (!target) return false;
  const tag = target.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable;
}

/**
 * Global admin keyboard shortcuts: Ctrl/Cmd+K opens the command palette
 * (via `onOpenPalette`), and "g" + a follow-up sequence (see SEQUENCES)
 * navigates directly to a page. Sequence keys are ignored while focus is in
 * a form control so typing "g" in a search box never hijacks navigation;
 * Ctrl/Cmd+K still works from inside a form control.
 *
 * Mount this once (in the admin layout), not per-page.
 *
 * @param {Object} options
 * @param {() => void} options.onOpenPalette - called when Ctrl/Cmd+K is pressed.
 */
export function useGlobalShortcuts({ onOpenPalette }) {
  const navigate = useNavigate();
  const bufferRef = useRef([]);
  const timerRef = useRef(null);

  useEffect(() => {
    const resetBuffer = () => {
      bufferRef.current = [];
      clearTimeout(timerRef.current);
    };

    const handleKeyDown = (event) => {
      const isMod = event.metaKey || event.ctrlKey;

      if (isMod && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        resetBuffer();
        onOpenPalette();
        return;
      }

      if (isMod || event.altKey || isTypingTarget(event.target)) {
        return;
      }

      const key = event.key.toLowerCase();
      if (!/^[a-z]$/.test(key)) {
        resetBuffer();
        return;
      }

      const nextBuffer = [...bufferRef.current, key];
      const stillPossible = SEQUENCES.some(
        (seq) => seq.keys.length >= nextBuffer.length && seq.keys.slice(0, nextBuffer.length).join('') === nextBuffer.join('')
      );

      if (!stillPossible) {
        bufferRef.current = /^[a-z]$/.test(key) && key === 'g' ? ['g'] : [];
      } else {
        bufferRef.current = nextBuffer;
      }

      const match = SEQUENCES.find((seq) => seq.keys.join('') === bufferRef.current.join(''));
      if (match) {
        resetBuffer();
        navigate(match.to);
        return;
      }

      clearTimeout(timerRef.current);
      timerRef.current = setTimeout(resetBuffer, SEQUENCE_TIMEOUT_MS);
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      clearTimeout(timerRef.current);
    };
  }, [navigate, onOpenPalette]);
}
