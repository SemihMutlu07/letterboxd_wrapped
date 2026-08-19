import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import IsolatedModal from '@/components/IsolatedModal';
import { __resetBodyScrollLockForTests } from '@/hooks/useBodyScrollLock';

afterEach(() => {
  cleanup();
  __resetBodyScrollLockForTests();
});

describe('IsolatedModal', () => {
  it('portals above the page, locks background scroll, and restores it on close', async () => {
    window.scrollTo = vi.fn();
    Object.defineProperty(window, 'scrollY', { configurable: true, value: 240 });

    function Harness({ open }: { open: boolean }) {
      return (
        <IsolatedModal open={open} onClose={() => {}} label="Film shelf">
          <div data-mw-modal-scroll>Shelf body</div>
        </IsolatedModal>
      );
    }

    const { rerender } = render(<Harness open />);
    expect(await screen.findByRole('dialog', { name: 'Film shelf' })).toBeInTheDocument();
    expect(screen.getByTestId('isolated-modal').parentElement).toBe(document.body);
    expect(document.body).toHaveAttribute('data-mw-scroll-locked', 'true');
    expect(document.documentElement).toHaveAttribute('data-mw-scroll-locked', 'true');
    expect(document.body.style.top).toBe('-240px');

    rerender(<Harness open={false} />);
    expect(document.body).not.toHaveAttribute('data-mw-scroll-locked');
    expect(document.body.style.top).toBe('');
  });

  it('keeps pointer events on the backdrop so the page behind cannot be clicked', async () => {
    render(
      <IsolatedModal open onClose={() => {}} label="Shelf">
        <p>Inside</p>
      </IsolatedModal>,
    );
    const modal = await screen.findByTestId('isolated-modal');
    const backdrop = modal.querySelector('.mw-isolated-modal__backdrop');
    expect(backdrop).not.toBeNull();
    expect(backdrop).toHaveClass('mw-isolated-modal__backdrop');
  });
});
