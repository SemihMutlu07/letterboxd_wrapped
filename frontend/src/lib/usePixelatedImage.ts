import { useEffect, useRef, useState } from 'react';
import { getTmdbImageUrl } from '@/lib/analytics';

// TMDB poster images are 2:3 (e.g. w300 = 300x450) — keep the canvas at that
// ratio so posters aren't stretched into a square.
const CANVAS_WIDTH = 300;
const CANVAS_HEIGHT = 450;
// Block dimension (in source-canvas pixels) per pixelation level.
// Level 0 = most pixelated (spawn), higher levels = sharper.
const BLOCKS_PER_LEVEL = [4, 6, 10, 16, 26, 40];

export function usePixelatedImage(
  posterPath: string | null | undefined,
  level: number,
  maxLevel: number,
  revealed = false,
) {
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

    canvas.width = CANVAS_WIDTH;
    canvas.height = CANVAS_HEIGHT;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    if (revealed) {
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(img, 0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      return;
    }

    const clampedLevel = Math.min(Math.max(level, 0), maxLevel);
    const blocksX = BLOCKS_PER_LEVEL[clampedLevel] ?? BLOCKS_PER_LEVEL[BLOCKS_PER_LEVEL.length - 1];
    const blocksY = Math.round(blocksX * (CANVAS_HEIGHT / CANVAS_WIDTH));

    const offscreen = document.createElement('canvas');
    offscreen.width = blocksX;
    offscreen.height = blocksY;
    const offCtx = offscreen.getContext('2d');
    if (!offCtx) return;

    offCtx.drawImage(img, 0, 0, blocksX, blocksY);

    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(offscreen, 0, 0, blocksX, blocksY, 0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  }, [loaded, level, maxLevel, revealed]);

  return { canvasRef, loaded, error, maxLevel: BLOCKS_PER_LEVEL.length - 1 };
}
