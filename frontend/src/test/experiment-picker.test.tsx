import { describe, it, expect, vi } from 'vitest';
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
  it('shows only fixed account cards with two actions each, no username input', async () => {
    vi.mocked(experimentFixtures.getLocalFixturePreviews).mockResolvedValue(ACCOUNTS);

    render(<ExperimentAccountPicker />);

    for (const account of ACCOUNTS) {
      await screen.findByText(`@${account.username}`);
    }
    expect(document.querySelectorAll('input')).toHaveLength(0);
    expect(screen.getAllByRole('button', { name: 'Open Dossier' })).toHaveLength(5);
    expect(screen.getAllByRole('button', { name: 'Open Story' })).toHaveLength(5);
  });

  it('opens story mode for the clicked account', async () => {
    vi.mocked(experimentFixtures.getLocalFixturePreviews).mockResolvedValue(ACCOUNTS);
    vi.mocked(experimentFixtures.openExperimentStory).mockResolvedValue(undefined);

    render(<ExperimentAccountPicker />);
    await screen.findByText('@semihmutsuz');

    await userEvent.click(screen.getAllByRole('button', { name: 'Open Story' })[0]);
    await vi.waitFor(() => {
      expect(experimentFixtures.openExperimentStory).toHaveBeenCalledWith('semihmutsuz');
    });
  });
});
