import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { ReactElement } from 'react';

import { I18nProvider } from '@/i18n/I18nProvider';

import { PosterFieldProvider } from '../PosterFieldContext';
import { DEFAULT_POSTER_FIELD } from '../posterFieldConfig';
import { VerticalPosterFlow } from './VerticalPosterFlow';

const posters = Array.from({ length: 6 }, (_, index) => ({
  type: 'poster' as const,
  url: `/p-${index}.jpg`,
  alt: `Poster ${index}`,
}));

function renderFlow(ui: ReactElement) {
  return render(
    <I18nProvider locale="en">
      <PosterFieldProvider layout={DEFAULT_POSTER_FIELD}>{ui}</PosterFieldProvider>
    </I18nProvider>,
  );
}

describe('VerticalPosterFlow', () => {
  it('renders unique posters without fabricating titles', () => {
    const { getAllByAltText } = renderFlow(
      <VerticalPosterFlow posters={posters} accent="#f59e0b" columns={3} maxUnique={6} />,
    );
    expect(getAllByAltText('Poster 0').length).toBeGreaterThan(0);
    expect(getAllByAltText(/Poster \d/).length).toBeGreaterThanOrEqual(6);
  });

  it('pauses the CSS loop when the story is paused', () => {
    const { container } = render(
      <I18nProvider locale="en">
        <PosterFieldProvider layout={{ ...DEFAULT_POSTER_FIELD, paused: true }}>
          <VerticalPosterFlow posters={posters} accent="#f59e0b" />
        </PosterFieldProvider>
      </I18nProvider>,
    );
    const flowing = container.querySelectorAll('.story-poster-flow');
    expect(flowing.length).toBeGreaterThan(0);
    flowing.forEach((node) => {
      expect((node as HTMLElement).style.animationPlayState).toBe('paused');
    });
  });
});
