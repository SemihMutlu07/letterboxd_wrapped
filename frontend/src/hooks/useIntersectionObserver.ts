import { useEffect, useRef, useState } from 'react';

interface UseIntersectionObserverOptions {
  rootMargin?: string;
  threshold?: number | number[];
  triggerOnce?: boolean;
}

/**
 * Hook for intersection-based lazy mounting
 * Returns visibility state and ref to attach to elements
 */
export function useIntersectionObserver(
  options: UseIntersectionObserverOptions = {}
) {
  const { rootMargin = '100px', threshold = 0, triggerOnce = true } = options;
  const [isVisible, setIsVisible] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsVisible(true);
            if (triggerOnce) {
              observer.unobserve(element);
            }
          } else if (!triggerOnce) {
            setIsVisible(false);
          }
        });
      },
      { rootMargin, threshold }
    );

    observer.observe(element);

    return () => {
      observer.unobserve(element);
    };
  }, [rootMargin, threshold, triggerOnce]);

  return { ref, isVisible };
}

/**
 * Hook for lazy loading components below the fold
 */
export function useLazyMount(delay: number = 0) {
  const { ref, isVisible } = useIntersectionObserver({
    rootMargin: '200px',
    triggerOnce: true
  });
  
  const [shouldMount, setShouldMount] = useState(false);

  useEffect(() => {
    if (isVisible) {
      if (delay > 0) {
        const timer = setTimeout(() => setShouldMount(true), delay);
        return () => clearTimeout(timer);
      } else {
        setShouldMount(true);
      }
    }
  }, [isVisible, delay]);

  return { ref, shouldMount };
}
