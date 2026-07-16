import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PosterImage } from './Placeholders';

describe('PosterImage', () => {
  it('tries a new image after a previous src failed', () => {
    const { rerender } = render(<PosterImage src="/broken.jpg" alt="Poster" />);
    fireEvent.error(screen.getByAltText('Poster'));
    expect(screen.queryByAltText('Poster')).toBeNull();

    rerender(<PosterImage src="/working.jpg" alt="Poster" />);

    expect(screen.getByAltText('Poster')).toHaveAttribute('src', '/working.jpg');
  });
});
