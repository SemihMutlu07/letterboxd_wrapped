import { useCallback, useRef } from 'react';

/**
 * Throttles a function using requestAnimationFrame
 * Useful for resize handlers and scroll events
 */
export function useRafThrottle<T extends (...args: any[]) => void>(
  callback: T,
  deps: React.DependencyList = []
): T {
  const rafRef = useRef<number | null>(null);
  const lastArgsRef = useRef<Parameters<T> | undefined>(undefined);

  const throttledCallback = useCallback(
    (...args: Parameters<T>) => {
      lastArgsRef.current = args;
      
      if (rafRef.current === null) {
        rafRef.current = requestAnimationFrame(() => {
          if (lastArgsRef.current) {
            callback(...lastArgsRef.current);
          }
          rafRef.current = null;
        });
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [callback, ...deps]
  ) as T;

  return throttledCallback;
}

/**
 * Debounces a function with configurable delay
 */
export function useDebounce<T extends (...args: any[]) => void>(
  callback: T,
  delay: number,
  deps: React.DependencyList = []
): T {
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const debouncedCallback = useCallback(
    (...args: Parameters<T>) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      
      timeoutRef.current = setTimeout(() => {
        callback(...args);
        timeoutRef.current = null;
      }, delay);
    },
    [callback, delay, ...deps]
  ) as T;

  return debouncedCallback;
}

/**
 * Micro-batches ResizeObserver callbacks using rAF
 */
export function useResizeObserver(
  callback: (entries: ResizeObserverEntry[]) => void,
  options?: ResizeObserverOptions
) {
  const rafRef = useRef<number | null>(null);
  const pendingEntriesRef = useRef<ResizeObserverEntry[]>([]);

  const batchedCallback = useCallback(
    (entries: ResizeObserverEntry[]) => {
      pendingEntriesRef.current.push(...entries);
      
      if (rafRef.current === null) {
        rafRef.current = requestAnimationFrame(() => {
          if (pendingEntriesRef.current.length > 0) {
            callback(pendingEntriesRef.current);
            pendingEntriesRef.current = [];
          }
          rafRef.current = null;
        });
      }
    },
    [callback]
  );

  return { batchedCallback, options };
}
