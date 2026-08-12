import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { IntroUsername } from './IntroUsername';

const CASES = [
  'sam',
  'semihmutsuz',
  'averyverylongletterboxdusername',
  'abcdefghijklmnopq',
] as const;

describe('IntroUsername', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it.each(CASES)('renders @%s on a single nowrap line', (username) => {
    render(
      <div style={{ width: 320 }}>
        <IntroUsername username={username} />
      </div>,
    );

    const text = screen.getByText(`@${username}`);
    expect(text).toHaveClass('whitespace-nowrap');
    expect(text.tagName).toBe('SPAN');
  });

  it('reserves one max-size line of vertical space', () => {
    render(<IntroUsername username="sam" />);
    const container = screen.getByTestId('intro-username-headline');
    expect(container.style.minHeight).toBe('4.275rem');
  });

  it('shrinks below max font size when the headline overflows', () => {
    const clientWidthSpy = vi
      .spyOn(HTMLElement.prototype, 'clientWidth', 'get')
      .mockReturnValue(220);
    const scrollWidthSpy = vi
      .spyOn(HTMLElement.prototype, 'scrollWidth', 'get')
      .mockImplementation(function mockScrollWidth(this: HTMLElement) {
        if (this.tagName === 'SPAN') {
          const size = parseFloat(this.style.fontSize || '4.5');
          return size >= 2.5 ? 400 : 200;
        }
        return 220;
      });

    render(<IntroUsername username="averyverylongletterboxdusername" />);
    const text = screen.getByText('@averyverylongletterboxdusername');
    const fontSize = parseFloat(text.style.fontSize);

    expect(fontSize).toBeLessThan(4.5);
    expect(fontSize).toBeGreaterThanOrEqual(1.1);

    clientWidthSpy.mockRestore();
    scrollWidthSpy.mockRestore();
  });

  it('keeps max font size for short usernames that fit', () => {
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(800);
    vi.spyOn(HTMLElement.prototype, 'scrollWidth', 'get').mockReturnValue(120);

    render(<IntroUsername username="sam" />);
    const text = screen.getByText('@sam');
    expect(parseFloat(text.style.fontSize)).toBeCloseTo(4.5, 1);
  });
});
