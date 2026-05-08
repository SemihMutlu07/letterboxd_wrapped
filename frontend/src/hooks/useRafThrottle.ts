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


