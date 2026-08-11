'use client';

import { useLayoutEffect, useRef, useState } from 'react';

/** Matches `Big` max size so card height stays stable. */
const MAX_FONT_REM = 4.5;
const MIN_FONT_REM = 1.1;
const SINGLE_LINE_MIN_HEIGHT = '4.275rem';

type IntroUsernameProps = {
  username: string;
};

/**
 * Intro headline for @username — always one line; shrinks font to fit container width.
 * Card height is pinned to a single max-size line (same footprint as `Big`).
 */
export function IntroUsername({ username }: IntroUsernameProps) {
  const containerRef = useRef<HTMLParagraphElement>(null);
  const textRef = useRef<HTMLSpanElement>(null);
  const [fontSizeRem, setFontSizeRem] = useState(MAX_FONT_REM);
  const [truncate, setTruncate] = useState(false);

  useLayoutEffect(() => {
    const container = containerRef.current;
    const text = textRef.current;
    if (!container || !text) return;

    const fit = () => {
      const available = container.clientWidth;
      if (available <= 0) return;

      let lo = MIN_FONT_REM;
      let hi = MAX_FONT_REM;
      let best = MIN_FONT_REM;

      while (hi - lo > 0.04) {
        const mid = (lo + hi) / 2;
        text.style.fontSize = `${mid}rem`;
        if (text.scrollWidth <= available) {
          best = mid;
          lo = mid;
        } else {
          hi = mid;
        }
      }

      text.style.fontSize = `${best}rem`;
      const stillOverflows = text.scrollWidth > available;
      setFontSizeRem(best);
      setTruncate(stillOverflows);
    };

    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(container);
    return () => observer.disconnect();
  }, [username]);

  return (
    <p
      ref={containerRef}
      data-testid="intro-username-headline"
      className="mt-3 w-full max-w-full overflow-hidden md:mt-4"
      style={{ minHeight: SINGLE_LINE_MIN_HEIGHT }}
    >
      <span
        ref={textRef}
        className={`block max-w-full font-black leading-[0.95] text-stone-50 whitespace-nowrap ${
          truncate ? 'truncate' : ''
        }`}
        style={{ fontSize: `${fontSizeRem}rem` }}
      >
        @{username}
      </span>
    </p>
  );
}
