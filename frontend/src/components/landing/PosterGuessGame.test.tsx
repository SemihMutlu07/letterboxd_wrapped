import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { PosterGuessGame } from './PosterGuessGame';
import { I18nProvider } from '@/i18n/I18nProvider';

vi.mock('@/lib/usePixelatedImage', () => ({
  usePixelatedImage: () => ({ canvasRef: { current: null }, loaded: true, error: false }),
}));

const props = {
  movie: { title: 'The Godfather', poster_path: '/poster.jpg' },
  level: 1,
  maxLevel: 5,
  wrongGuesses: 0,
  score: 0,
  nextPoints: 100,
  onWrongGuess: vi.fn(),
  onCorrectGuess: vi.fn(),
  revealedAnswer: false,
};

function renderGame(overrides: Partial<typeof props> = {}) {
  return render(
    <I18nProvider locale="en">
      <PosterGuessGame {...props} {...overrides} />
    </I18nProvider>,
  );
}

function renderTurkishGame() {
  return render(
    <I18nProvider locale="tr">
      <PosterGuessGame {...props} />
    </I18nProvider>,
  );
}

describe('PosterGuessGame accessibility and focus', () => {
  it('exposes an accessible combobox and lets Escape close its list', async () => {
    renderGame();
    const input = screen.getByRole('combobox');
    expect(input).toHaveClass('text-base');

    await userEvent.type(input, 'god');
    expect(input).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('listbox')).toBeInTheDocument();
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(input).toHaveAttribute('aria-expanded', 'false');
  });

  it('uses options without nested interactive controls and supports mouse selection', async () => {
    const onCorrectGuess = vi.fn();
    renderGame({ onCorrectGuess });
    const input = screen.getByRole('combobox');
    await userEvent.type(input, 'godfather');

    const option = screen.getByRole('option', { name: 'The Godfather' });
    expect(option.querySelector('button')).toBeNull();
    await userEvent.click(option);
    expect(onCorrectGuess).toHaveBeenCalledOnce();
  });

  it('does not trap Tab and restores focus after a wrong guess', async () => {
    renderGame();
    const input = screen.getByRole('combobox');
    await userEvent.type(input, 'god');
    await userEvent.tab();
    expect(screen.getByRole('button', { name: 'Guess' })).toHaveFocus();

    input.focus();
    await userEvent.clear(input);
    await userEvent.type(input, 'wrong film{Enter}');
    await waitFor(() => expect(input).toHaveFocus());
  });

  it('uses the active locale for the game controls', () => {
    renderTurkishGame();

    expect(screen.getByRole('button', { name: 'Tahmin et' })).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Bu hangi film? Öneriler için yazmaya başla')).toBeInTheDocument();
  });
});
