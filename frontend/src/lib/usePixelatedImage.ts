import { useEffect, useRef, useState } from 'react';
import { getTmdbImageUrl } from '@/lib/analytics';

const CANVAS_SIZE = 300;
// Block dimension (in source-canvas pixels) per pixelation level.
// Level 0 = most pixelated (spawn), higher levels = sharper.
const BLOCKS_PER_LEVEL = [4, 6, 10, 16, 26, 40];

export function usePixelatedImage(posterPath: string | null | undefined, level: number, maxLevel: number) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);

  const src = getTmdbImageUrl(posterPath, 'w300');

  useEffect(() => {
    setLoaded(false);
    setError(false);
    imageRef.current = null;

    if (!src) {
      setError(true);
      return;
    }

    let cancelled = false;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      if (cancelled) return;
      imageRef.current = img;
      setLoaded(true);
    };
    img.onerror = () => {
      if (cancelled) return;
      setError(true);
    };
    img.src = src;

    return () => {
      cancelled = true;
    };
  }, [src]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const img = imageRef.current;
    if (!canvas || !img || !loaded) return;

    canvas.width = CANVAS_SIZE;
    canvas.height = CANVAS_SIZE;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const clampedLevel = Math.min(Math.max(level, 0), maxLevel);
    const blocks = BLOCKS_PER_LEVEL[clampedLevel] ?? BLOCKS_PER_LEVEL[BLOCKS_PER_LEVEL.length - 1];

    const offscreen = document.createElement('canvas');
    offscreen.width = blocks;
    offscreen.height = blocks;
    const offCtx = offscreen.getContext('2d');
    if (!offCtx) return;

    offCtx.drawImage(img, 0, 0, blocks, blocks);

    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
    ctx.drawImage(offscreen, 0, 0, blocks, blocks, 0, 0, CANVAS_SIZE, CANVAS_SIZE);
  }, [loaded, level, maxLevel]);

  return { canvasRef, loaded, error, maxLevel: BLOCKS_PER_LEVEL.length - 1 };
}
