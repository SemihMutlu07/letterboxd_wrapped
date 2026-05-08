import { useState, useEffect } from 'react';

/**
 * Hook to detect device memory for adaptive performance
 * Returns memory in GB, defaults to 4GB if unavailable
 */
export function useDeviceMemory(): number {
  const [memory, setMemory] = useState<number>(4); // Default to 4GB

  useEffect(() => {
    if (typeof window !== 'undefined' && 'deviceMemory' in navigator) {
      const deviceMemory = (navigator as any).deviceMemory;
      if (typeof deviceMemory === 'number' && deviceMemory > 0) {
        setMemory(deviceMemory);
      }
    }
  }, []);

  return memory;
}

/**
 * Hook to get adaptive pixel ratio based on device memory
 */
export function useAdaptivePixelRatio(): number {
  const memory = useDeviceMemory();
  
  // Lower memory = lower pixel ratio for better performance
  if (memory <= 2) return 1.1;
  if (memory <= 4) return 1.25;
  if (memory <= 8) return 1.4;
  return 1.6;
}


