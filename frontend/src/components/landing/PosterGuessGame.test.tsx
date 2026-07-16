import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { PosterGuessGame } from './PosterGuessGame';

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

describe('PosterGuessGame accessibility and focus', () => {
  it('exposes an accessible combobox and lets Escape close its list', async () => {
    render(<PosterGuessGame {...props} />);
    const input = screen.getByRole('combobox');
    expect(input).toHaveClass('text-base');

    await userEvent.type(input, 'god');
    expect(input).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('listbox')).toBeInTheDocument();
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(input).toHaveAttribute('aria-expanded', 'false');
  });

  it('does not trap Tab and restores focus after a wrong guess', async () => {
    render(<PosterGuessGame {...props} />);
    const input = screen.getByRole('combobox');
    await userEvent.type(input, 'god');
    await userEvent.tab();
    expect(screen.getByRole('button', { name: 'Guess' })).toHaveFocus();

    input.focus();
    await userEvent.clear(input);
    await userEvent.type(input, 'wrong film{Enter}');
    await waitFor(() => expect(input).toHaveFocus());
  });
});
