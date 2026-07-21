import { resultPath } from '@/lib/routes';

type FixtureResponse = {
  username?: string;
  summary?: { details?: unknown };
  error?: string;
};

export async function loadSmtFixture(
  fetchFixture: typeof fetch = fetch,
  storage: Storage = sessionStorage,
  navigate: (url: string) => void = (url) => window.location.replace(url),
) {
  const response = await fetchFixture('/.dev/smt-fixture.json', { cache: 'no-store' });
  const payload = (await response.json()) as FixtureResponse;
  const stats = payload.summary?.details;
  if (!response.ok || !stats || !payload.username) {
    throw new Error(payload.error || 'The local fixture response was incomplete.');
  }
  storage.setItem('letterboxdStats', JSON.stringify(stats));
  storage.setItem('username', payload.username);
  storage.setItem('lb_username', payload.username);
  navigate(resultPath(payload.username));
}
