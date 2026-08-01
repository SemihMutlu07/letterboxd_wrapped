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
});
