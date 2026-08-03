import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import LoadingScreen from './LoadingScreen';
import { I18nProvider } from '@/i18n/I18nProvider';

describe('LoadingScreen result transition', () => {
  it('keeps the loading state instead of exposing an early See Wrapped navigation button', () => {
    render(
      <I18nProvider locale="en">
        <LoadingScreen mode="scrape" resultReady="/results?u=alice" />
      </I18nProvider>,
    );

    expect(screen.queryByRole('button', { name: /see wrapped/i })).not.toBeInTheDocument();
  });

  it('uses the active locale for scrape progress copy', () => {
    render(
      <I18nProvider locale="tr">
        <LoadingScreen mode="scrape" onCancel={() => undefined} />
      </I18nProvider>,
    );

    expect(screen.getByRole('heading', { name: 'Profilin taranıyor' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'İptal' })).toBeInTheDocument();
  });

  it('shows the queued degraded-state message instead of normal progress when worker fleet is empty', () => {
    render(
      <I18nProvider locale="en">
        <LoadingScreen mode="scrape" queued />
      </I18nProvider>,
    );

    expect(screen.getByText(/Queued — the analysis worker is starting up/i)).toBeInTheDocument();
    // Normal "almost there" / elapsed copy must not appear in degraded mode.
    expect(screen.queryByText(/Almost there/i)).not.toBeInTheDocument();
  });

  it('hides the queued message when the fleet is healthy', () => {
    render(
      <I18nProvider locale="en">
        <LoadingScreen mode="scrape" queued={false} />
      </I18nProvider>,
    );

    expect(screen.queryByText(/Queued — the analysis worker is starting up/i)).not.toBeInTheDocument();
  });
});
