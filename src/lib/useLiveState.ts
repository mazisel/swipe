import { useCallback, useRef, useState, type SetStateAction } from 'react';

// Event handlers can transact against the latest bag even before React renders.
export function useLiveState<T>(initial: T) {
  const [value, render] = useState(initial);
  const current = useRef(initial);
  const set = useCallback((next: SetStateAction<T>) => {
    const updated = typeof next === 'function' ? (next as (previous: T) => T)(current.current) : next;
    current.current = updated;
    render(updated);
  }, []);
  return [value, set, current] as const;
}
