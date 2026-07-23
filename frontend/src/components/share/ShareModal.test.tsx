import React from 'react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { toBlob } from 'html-to-image';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ShareModal, {
  exportExactPng,
  readPngDimensions,
  SHARE_EXPORT_CONFIG,
  shareSafeUrl,
} from '@/components/ShareModal';
import type { ShareCardData } from './types';
import { normalizeShareCardData, SHARE_VARIANTS, ShareVariantRenderer } from './registry';

vi.mock('next/image', () => ({
  default: ({ src, alt }: React.ImgHTMLAttributes<HTMLImageElement> & { fill?: boolean; priority?: boolean }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} />
  ),
}));

vi.mock('html-to-image', () => ({
  toBlob: vi.fn(),
}));

vi.mock('@/lib/analytics', () => ({
  getTmdbImageUrl: (path: string | null | undefined) => (path ? `http://localhost:8000${path}` : null),
  trackEvent: vi.fn(),
}));

class ResizeObserverMock {
  private cb: ResizeObserverCallback;
  constructor(cb: ResizeObserverCallback) {
    this.cb = cb;
  }
  observe = (target: Element) => {
    this.cb([{ target } as ResizeObserverEntry], this as unknown as ResizeObserver);
  };
  disconnect = vi.fn();
  unobserve = vi.fn();
}

const baseData: ShareCardData = {
  onScreenCrush: { name: 'Actor One', headshotUrl: '/tmdb-proxy/t/p/w300/a1.jpg', count: 4 },
  favoriteDirector: { name: 'Director One', headshotUrl: '/tmdb-proxy/t/p/w300/d1.jpg', count: 5 },
  watchedFilms: 120,
  spentDays: 9,
  spentHours: 216,
  timePercent: 3,
  cinemaScale: 72,
  personaLabel: 'Archivist',
  minutesAverage: 108,
  mostCommonRating: 4,
  peakDecade: '1990s',
  peakDecadeCount: 18,
  topActors: [
    { name: 'Actor One', headshotUrl: '/tmdb-proxy/t/p/w300/a1.jpg', count: 4 },
    { name: 'Actor Two', headshotUrl: '/tmdb-proxy/t/p/w300/a2.jpg', count: 3 },
  ],
  topDirectors: [
    { name: 'Director One', headshotUrl: '/tmdb-proxy/t/p/w300/d1.jpg', count: 5 },
    { name: 'Director Two', headshotUrl: '/tmdb-proxy/t/p/w300/d2.jpg', count: 2 },
  ],
  topReviewWords: [
    { word: 'dreamlike', count: 12 },
    { word: 'lonely', count: 9 },
    { word: 'funny', count: 7 },
  ],
};

function renderShareModal(cardProps = baseData, orientation: 'horizontal' | 'vertical' = 'horizontal') {
  return render(
    <ShareModal
      open
      onClose={() => {}}
      orientation={orientation}
      setOrientation={() => {}}
      cardProps={cardProps}
    />,
  );
}

function exportRoot() {
  const root = document.querySelector<HTMLElement>('[data-active="true"] [data-export-root="true"]');
  expect(root).not.toBeNull();
  return root as HTMLElement;
}

async function openSwapDrawer() {
  await userEvent.click(screen.getByRole('button', { name: /tune actor/i }));
}

beforeEach(() => {
  vi.mocked(toBlob).mockReset();
  // jsdom returns 0 for clientWidth/Height by default; the modal sizes its rail
  // off these, so without a mock variants never enter the mount budget.
  Object.defineProperty(HTMLElement.prototype, 'clientWidth', { configurable: true, value: 400 });
  Object.defineProperty(HTMLElement.prototype, 'clientHeight', { configurable: true, value: 700 });
  // The rail measures pageW/pageH via getBoundingClientRect (jsdom returns all
  // zeros). pageW has no clientWidth fallback, so without this the export cards
  // never mount and exportRoot() is null.
  Object.defineProperty(HTMLElement.prototype, 'getBoundingClientRect', {
    configurable: true,
    value: () => ({ width: 400, height: 700, top: 0, left: 0, right: 400, bottom: 700, x: 0, y: 0, toJSON: () => ({}) }),
  });
  vi.stubGlobal('ResizeObserver', ResizeObserverMock);
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
    cb(0);
    return 1;
  });
  vi.stubGlobal('cancelAnimationFrame', vi.fn());
});

describe('ShareModal person swap', () => {
  it('changes selected actor and director data when variety buttons are clicked', async () => {
    renderShareModal();

    expect(within(exportRoot()).getByText('Actor One')).toBeInTheDocument();
    expect(within(exportRoot()).getByText('Director One')).toBeInTheDocument();

    await openSwapDrawer();
    await userEvent.click(screen.getAllByRole('button', { name: 'Two' })[0]);
    expect(within(exportRoot()).getByText('Actor Two')).toBeInTheDocument();

    const directorButtons = screen.getAllByRole('button', { name: 'Two' });
    await userEvent.click(directorButtons[1]);
    expect(within(exportRoot()).getByText('Director Two')).toBeInTheDocument();
  });

  it('resets stale selected indexes when fresh share data arrives', async () => {
    const { rerender } = renderShareModal();

    await openSwapDrawer();
    await userEvent.click(screen.getAllByRole('button', { name: 'Two' })[0]);
    expect(within(exportRoot()).getByText('Actor Two')).toBeInTheDocument();

    const nextData: ShareCardData = {
      ...baseData,
      onScreenCrush: { name: 'Actor Three', headshotUrl: '/tmdb-proxy/t/p/w300/a3.jpg', count: 6 },
      favoriteDirector: { name: 'Director Three', headshotUrl: '/tmdb-proxy/t/p/w300/d3.jpg', count: 7 },
      topActors: [
        { name: 'Actor Three', headshotUrl: '/tmdb-proxy/t/p/w300/a3.jpg', count: 6 },
        { name: 'Actor Four', headshotUrl: '/tmdb-proxy/t/p/w300/a4.jpg', count: 1 },
      ],
      topDirectors: [
        { name: 'Director Three', headshotUrl: '/tmdb-proxy/t/p/w300/d3.jpg', count: 7 },
        { name: 'Director Four', headshotUrl: '/tmdb-proxy/t/p/w300/d4.jpg', count: 1 },
      ],
    };

    rerender(
      <ShareModal
        open
        onClose={() => {}}
        orientation="horizontal"
        setOrientation={() => {}}
        cardProps={nextData}
      />,
    );

    expect(within(exportRoot()).getByText('Actor Three')).toBeInTheDocument();
    expect(within(exportRoot()).getByText('Director Three')).toBeInTheDocument();
  });
});

describe('ShareModal review words', () => {
  it('renders the top review words in vertical share cards when available', () => {
    renderShareModal(baseData, 'vertical');

    const root = within(exportRoot());
    expect(root.getByText(/review words/i)).toBeInTheDocument();
    expect(root.getByText('dreamlike / lonely / funny')).toBeInTheDocument();
  });

  it('keeps the original metric when review words are unavailable', () => {
    renderShareModal({ ...baseData, topReviewWords: undefined }, 'vertical');

    const root = within(exportRoot());
    expect(root.queryByText(/review words/i)).not.toBeInTheDocument();
    expect(root.getByText(/peak decade/i)).toBeInTheDocument();
  });
});

describe('share registry and privacy', () => {
  it('keeps the canonical seven-card order', () => {
    expect(SHARE_VARIANTS.map(({ label }) => label)).toEqual([
      'Wrapped', 'Apple', 'Editorial', 'Variant 3', 'Double Feature', 'Contact Sheet', 'Admit One',
    ]);
  });

  it('normalizes a missing director without dropping film slots', () => {
    const normalized = normalizeShareCardData({
      ...baseData,
      favoriteDirector: null,
      topFilms: Array.from({ length: 6 }, (_, index) => ({
        title: `Film ${index}`,
        year: '2026',
        posterPath: null,
      })),
    });
    expect(normalized.favoriteDirector).toEqual({
      name: 'Director unavailable',
      headshotUrl: '',
      count: 0,
    });
    expect(normalized.topFilms).toHaveLength(5);
  });

  it('hides the username on every rendered card and resets on reopen', async () => {
    const props = { ...baseData, username: 'long-letterboxd-name' };
    const { rerender } = renderShareModal(props);
    expect(within(exportRoot()).getByText('@long-letterboxd-name')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('switch', { name: /show username/i }));
    expect(within(exportRoot()).queryByText('@long-letterboxd-name')).not.toBeInTheDocument();

    rerender(<ShareModal open={false} onClose={() => {}} orientation="horizontal" setOrientation={() => {}} cardProps={props} />);
    rerender(<ShareModal open onClose={() => {}} orientation="horizontal" setOrientation={() => {}} cardProps={props} />);
    expect(within(exportRoot()).getByText('@long-letterboxd-name')).toBeInTheDocument();
  });
});

describe('shareSafeUrl', () => {
  it('converts direct TMDB image URLs to backend proxy URLs for canvas export', () => {
    expect(shareSafeUrl('https://image.tmdb.org/t/p/w500/person.jpg')).toBe(
      'http://localhost:8000/tmdb-proxy/t/p/w500/person.jpg',
    );
  });
});

function pngBlob(width: number, height: number) {
  const bytes = new Uint8Array(24);
  bytes.set([137, 80, 78, 71, 13, 10, 26, 10]);
  new DataView(bytes.buffer).setUint32(16, width);
  new DataView(bytes.buffer).setUint32(20, height);
  return new Blob([bytes], { type: 'image/png' });
}

describe.each([
  ['horizontal', 1200, 675, 1],
  ['vertical', 1080, 1920, 1.6],
] as const)('exact %s export', (orientation, width, height, pixelRatio) => {
  it('keeps exact output dimensions for every variant on low-memory devices', async () => {
    Object.defineProperty(navigator, 'deviceMemory', { configurable: true, value: 1 });

    for (const { key } of SHARE_VARIANTS) {
      vi.mocked(toBlob).mockResolvedValueOnce(pngBlob(width, height));
      const rendered = render(<ShareVariantRenderer variant={key} data={baseData} orientation={orientation} />);
      const root = rendered.container.querySelector<HTMLElement>('[data-export-root="true"]');
      expect(root, `${key} must expose an export root`).not.toBeNull();

      const blob = await exportExactPng(root!, orientation, '#000');

      expect(await readPngDimensions(blob)).toEqual({ width, height });
      expect(toBlob).toHaveBeenLastCalledWith(root, expect.objectContaining({
        width: SHARE_EXPORT_CONFIG[orientation].domWidth,
        height: SHARE_EXPORT_CONFIG[orientation].domHeight,
        pixelRatio,
        ...(key === 'admit-one' ? { backgroundColor: 'rgb(201, 150, 61)' } : {}),
      }));
      rendered.unmount();
    }
  });

  it('retries failures and wrong-sized blobs without lowering quality', async () => {
    vi.mocked(toBlob)
      .mockRejectedValueOnce(new Error('canvas allocation failed'))
      .mockResolvedValueOnce(pngBlob(1, 1))
      .mockResolvedValueOnce(pngBlob(width, height));

    await expect(exportExactPng(document.createElement('div'), orientation, '#000')).resolves.toBeInstanceOf(Blob);
    expect(vi.mocked(toBlob).mock.calls.slice(-3).map(([, options]) => options?.pixelRatio)).toEqual([
      pixelRatio,
      pixelRatio,
      pixelRatio,
    ]);
  });
});
