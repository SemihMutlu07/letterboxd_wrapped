import { execFile } from 'node:child_process';
import { readFile, readdir } from 'node:fs/promises';
import { basename, dirname, resolve } from 'node:path';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const execFileAsync = promisify(execFile);
const frontendDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const script = resolve(frontendDir, 'scripts/prepare-smt-fixture.mjs');
const output = resolve(frontendDir, 'public/demo/smt-fixture.json');
const mediaOutput = resolve(frontendDir, 'public/demo/smt-media');

const titleKey = (value) => String(value ?? '')
  .normalize('NFKC')
  .toLocaleLowerCase('en-US')
  .replace(/[^\p{L}\p{N}]+/gu, ' ')
  .trim();

const yearKey = (value) => {
  const year = Number(value);
  return Number.isFinite(year) ? String(Math.trunc(year)) : '';
};

describe('prepare-smt-fixture', () => {
  it('restores poster paths for every written review with matching film metadata', async () => {
    await execFileAsync(process.execPath, [script], { cwd: frontendDir });
    const fixture = JSON.parse(await readFile(output, 'utf8'));
    const mediaFiles = new Set(await readdir(mediaOutput));
    const details = fixture.summary.details;
    const posters = new Map(
      details.all_films
        .filter((film) => typeof film.poster_path === 'string' && film.poster_path.length > 0)
        .map((film) => [[titleKey(film.title), yearKey(film.year)].join('|'), film.poster_path]),
    );
    const reviews = details.review_analysis.reviews;
    const matchingReviews = reviews.filter((review) => posters.has(
      [titleKey(review.title), yearKey(review.year)].join('|'),
    ));

    expect(matchingReviews.length).toBeGreaterThan(350);
    for (const review of matchingReviews) {
      expect(review.poster_path, `${review.title} (${review.year})`).toBe(
        posters.get([titleKey(review.title), yearKey(review.year)].join('|')),
      );
      expect(review.poster_path).toMatch(/^\/demo\/smt-media\/[^/]+$/);
      expect(mediaFiles.has(basename(review.poster_path))).toBe(true);
    }
    expect(reviews.find((review) => review.title === 'Blow-Up')?.poster_path).toBeTruthy();
    expect(reviews.find((review) => review.title === 'The Silence of the Lambs')?.poster_path).toBeTruthy();
    expect(reviews.find((review) => review.title === 'The Life of Chuck')?.poster_path).toBeTruthy();
  });
});
