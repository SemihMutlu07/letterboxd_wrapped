import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import LoadingScreen from './LoadingScreen';

describe('LoadingScreen result transition', () => {
  it('keeps the loading state instead of exposing an early See Wrapped navigation button', () => {
    render(<LoadingScreen mode="scrape" resultReady="/results?u=alice" />);

    expect(screen.queryByRole('button', { name: /see wrapped/i })).not.toBeInTheDocument();
  });
});
