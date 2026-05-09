import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('@/lib/api', () => ({
  compareWatchlists: vi.fn(),
  recommendFromCompare: vi.fn(),
  dateNight: vi.fn(),
}));

// ---- OrientationToggle -------------------------------------------------------

import OrientationToggle from '@/components/share/OrientationToggle';

describe('OrientationToggle', () => {
  it('renders both orientation buttons', () => {
    render(<OrientationToggle orientation="horizontal" onChange={() => {}} />);
    expect(screen.getByText('Horizontal')).toBeInTheDocument();
    expect(screen.getByText('Vertical')).toBeInTheDocument();
  });

  it('calls onChange with "vertical" when Vertical is clicked', async () => {
    const onChange = vi.fn();
    render(<OrientationToggle orientation="horizontal" onChange={onChange} />);
    await userEvent.click(screen.getByText('Vertical'));
    expect(onChange).toHaveBeenCalledWith('vertical');
  });

  it('calls onChange with "horizontal" when Horizontal is clicked', async () => {
    const onChange = vi.fn();
    render(<OrientationToggle orientation="vertical" onChange={onChange} />);
    await userEvent.click(screen.getByText('Horizontal'));
    expect(onChange).toHaveBeenCalledWith('horizontal');
  });

  it('applies active style to the selected orientation', () => {
    const { rerender } = render(
      <OrientationToggle orientation="horizontal" onChange={() => {}} />,
    );
    const horizontalBtn = screen.getByText('Horizontal').closest('button')!;
    expect(horizontalBtn.className).toMatch(/bg-gradient-to-r/);

    rerender(<OrientationToggle orientation="vertical" onChange={() => {}} />);
    const verticalBtn = screen.getByText('Vertical').closest('button')!;
    expect(verticalBtn.className).toMatch(/bg-gradient-to-r/);
  });
});

// ---- UploadZone --------------------------------------------------------------

import UploadZone from '@/components/landing/UploadZone';

describe('UploadZone', () => {
  it('renders upload prompt text', () => {
    render(<UploadZone onFiles={() => {}} />);
    expect(screen.getByText(/Begin Your Cinema Reveal/i)).toBeInTheDocument();
    expect(screen.getByText(/Drag a ZIP, CSV files/i)).toBeInTheDocument();
  });

  it('has an accessible region label', () => {
    render(<UploadZone onFiles={() => {}} />);
    expect(screen.getByRole('region', { name: /upload your letterboxd data/i })).toBeInTheDocument();
  });

  it('calls onFiles with dropped files', async () => {
    const onFiles = vi.fn();
    render(<UploadZone onFiles={onFiles} />);
    const dropZone = screen.getByTestId('upload-drop-zone');

    const file = new File(['content'], 'export.zip', { type: 'application/zip' });
    const dataTransfer = { files: [file] as unknown as FileList };

    fireEvent.drop(dropZone, { dataTransfer });
    await waitFor(() => expect(onFiles).toHaveBeenCalledWith(dataTransfer.files));
  });

  it('has a hidden file input that accepts zip and csv', () => {
    render(<UploadZone onFiles={() => {}} />);
    const input = document.getElementById('upload-zone-input') as HTMLInputElement;
    expect(input).not.toBeNull();
    expect(input.accept).toContain('.zip');
    expect(input.accept).toContain('.csv');
  });
});

// ---- WatchlistCompare --------------------------------------------------------

import WatchlistCompare from '@/components/watchlist/WatchlistCompare';
import { compareWatchlists, recommendFromCompare } from '@/lib/api';

describe('WatchlistCompare', () => {
  it('compares two watchlists and renders buckets', async () => {
    vi.mocked(compareWatchlists).mockResolvedValueOnce({
      status: 'success',
      users: ['alice', 'bob'],
      counts: {
        first_total: 2,
        second_total: 2,
        common: 1,
        first_only: 1,
        second_only: 1,
      },
      match_score: 50,
      common: [{ title: 'Aftersun', year: '2022', slug: '/film/aftersun/' }],
      first_only: [{ title: 'Heat', year: '1995', slug: '/film/heat-1995/' }],
      second_only: [{ title: 'Past Lives', year: '2023', slug: '/film/past-lives/' }],
    });

    render(<WatchlistCompare />);
    await userEvent.type(screen.getByLabelText('First watchlist'), 'alice');
    await userEvent.type(screen.getByLabelText('Second watchlist'), 'bob');
    await userEvent.click(screen.getByRole('button', { name: /compare/i }));

    expect(await screen.findByText('50%')).toBeInTheDocument();
    expect(screen.getByText('Aftersun')).toBeInTheDocument();
    expect(screen.getByText('Heat')).toBeInTheDocument();
    expect(screen.getByText('Past Lives')).toBeInTheDocument();
  });

  it('requests a shared recommendation', async () => {
    vi.mocked(compareWatchlists).mockResolvedValueOnce({
      status: 'success',
      users: ['alice', 'bob'],
      counts: {
        first_total: 1,
        second_total: 1,
        common: 1,
        first_only: 0,
        second_only: 0,
      },
      match_score: 100,
      common: [{ title: 'Aftersun', year: '2022', slug: '/film/aftersun/' }],
      first_only: [],
      second_only: [],
    });
    vi.mocked(recommendFromCompare).mockResolvedValueOnce({
      recommendation: {
        title: 'Aftersun',
        year: '2022',
        reason: 'Both of you have it on your watchlist.',
        poster_path: '/p.jpg',
      },
      alternatives: [],
    });

    render(<WatchlistCompare />);
    await userEvent.type(screen.getByLabelText('First watchlist'), 'alice');
    await userEvent.type(screen.getByLabelText('Second watchlist'), 'bob');
    await userEvent.click(screen.getByRole('button', { name: /compare/i }));
    await screen.findByText('Match score');
    expect(screen.getByRole('button', { name: /pick one/i })).not.toBeDisabled();

    await userEvent.click(screen.getByRole('button', { name: /pick one/i }));
    expect(await screen.findByText("Tonight's pick")).toBeInTheDocument();
    expect(screen.getAllByText('Aftersun').length).toBeGreaterThan(0);
  });
});
