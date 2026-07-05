import { beforeEach, describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import ExperimentAccountPicker from '@/components/ExperimentAccountPicker';
import * as experimentFixtures from '@/lib/experiment-fixtures';

const ACCOUNTS = ['semihmutsuz', 'emirermis', 'mertefesenturk', 'baris_saydam', 'isilaykolik'].map((username) => ({
  id: username,
  username,
  started_at: null,
  finished_at: '2026-07-04T00:00:00Z',
  total_films: 100,
  sinefil_meter: 50,
  cinematic_persona: 'Tester',
  average_rating: 3.5,
  total_countries: 10,
  displayName: username,
  caption: 'caption',
  accent: '#ff8a3d',
}));

vi.mock('@/lib/experiment-fixtures', () => ({
  getLocalFixturePreviews: vi.fn(),
  openExperimentAccount: vi.fn(),
  openExperimentStory: vi.fn(),
}));

describe('ExperimentAccountPicker', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows fixed account cards and a local-only account search', async () => {
    vi.mocked(experimentFixtures.getLocalFixturePreviews).mockResolvedValue(ACCOUNTS);

    render(<ExperimentAccountPicker />);

    for (const account of ACCOUNTS) {
      expect(await screen.findAllByText(`@${account.username}`)).not.toHaveLength(0);
    }
    expect(screen.getByLabelText('Search bundled experiment account')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Open Dossier' })).toHaveLength(5);
    expect(screen.getAllByRole('button', { name: 'Open Story' })).toHaveLength(5);
  });

  it('filters to bundled accounts and opens the selected dossier from the search', async () => {
    vi.mocked(experimentFixtures.getLocalFixturePreviews).mockResolvedValue(ACCOUNTS);
    vi.mocked(experimentFixtures.openExperimentAccount).mockResolvedValue(undefined);

    render(<ExperimentAccountPicker />);

    const input = await screen.findByLabelText('Search bundled experiment account');
    await userEvent.type(input, 'emir');

    expect(screen.getAllByRole('button', { name: 'Open Dossier' })).toHaveLength(1);
    expect(screen.getAllByText('@emirermis')).not.toHaveLength(0);

    await userEvent.click(screen.getByRole('button', { name: 'Open' }));
    await vi.waitFor(() => {
      expect(experimentFixtures.openExperimentAccount).toHaveBeenCalledWith('emirermis');
    });
  });

  it('opens story mode for the clicked account', async () => {
    vi.mocked(experimentFixtures.getLocalFixturePreviews).mockResolvedValue(ACCOUNTS);
    vi.mocked(experimentFixtures.openExperimentStory).mockResolvedValue(undefined);

    render(<ExperimentAccountPicker />);
    await screen.findAllByText('@semihmutsuz');

    await userEvent.click(screen.getAllByRole('button', { name: 'Open Story' })[0]);
    await vi.waitFor(() => {
      expect(experimentFixtures.openExperimentStory).toHaveBeenCalledWith('semihmutsuz');
    });
  });
});
