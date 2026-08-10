#!/usr/bin/env node
import { access, cp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { basename, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const frontendDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const destinationDir = resolve(frontendDir, 'public/demo');
const destination = resolve(destinationDir, 'smt-fixture.json');
const mediaDestination = resolve(destinationDir, 'smt-media');
const mediaCache = resolve(frontendDir, '.next/cache/smt-media');

if (process.argv.includes('--clean')) {
  await rm(destinationDir, { force: true, recursive: true });
  process.exit(0);
}

const fixtureDir = resolve(frontendDir, 'dev-fixtures/analysis-runs');
const source = resolve(fixtureDir, 'semihmutsuz.json');
const mediaSource = resolve(fixtureDir, 'semihmutsuz-media');
const shareCardMediaManifest = resolve(fixtureDir, 'semihmutsuz-share-card-media.json');

const titleKey = (value) => String(value ?? '')
  .normalize('NFKC')
  .toLocaleLowerCase('en-US')
  .replace(/[^\p{L}\p{N}]+/gu, ' ')
  .trim();

const yearKey = (value) => {
  const year = Number(value);
  return Number.isFinite(year) ? String(Math.trunc(year)) : '';
};

function restoreReviewPosters(fixture) {
  const details = fixture?.summary?.details;
  const reviewAnalysis = details?.review_analysis;
  if (!details || !reviewAnalysis) return 0;

  const posterByTitleYear = new Map();
  for (const film of details.all_films ?? []) {
    if (typeof film?.poster_path !== 'string' || !film.poster_path) continue;
    posterByTitleYear.set(
      `${titleKey(film.title)}|${yearKey(film.year)}`,
      film.poster_path,
    );
  }

  let restored = 0;
  for (const collection of [
    reviewAnalysis.reviews ?? [],
    reviewAnalysis.top_liked_reviews ?? [],
  ]) {
    for (const review of collection) {
      const posterPath = posterByTitleYear.get(
        `${titleKey(review.title)}|${yearKey(review.year)}`,
      );
      if (!posterPath) continue;
      review.poster_path = posterPath;
      restored += 1;
    }
  }
  return restored;
}

function localizeFixtureMedia(value, mediaFiles) {
  if (Array.isArray(value)) {
    return value.map((item) => localizeFixtureMedia(item, mediaFiles));
  }
  if (!value || typeof value !== 'object') return value;

  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => {
      if (
        (key === 'poster_path' || key === 'profile_path') &&
        typeof item === 'string' &&
        mediaFiles.has(basename(item))
      ) {
        return [key, `/demo/smt-media/${basename(item)}`];
      }
      return [key, localizeFixtureMedia(item, mediaFiles)];
    }),
  );
}

function collectMediaPaths(value, collected = new Map()) {
  if (Array.isArray(value)) {
    for (const item of value) collectMediaPaths(item, collected);
    return collected;
  }
  if (!value || typeof value !== 'object') return collected;

  for (const [key, item] of Object.entries(value)) {
    if (
      (key === 'poster_path' || key === 'profile_path') &&
      typeof item === 'string' &&
      item
    ) {
      collected.set(basename(item), item);
    } else {
      collectMediaPaths(item, collected);
    }
  }
  return collected;
}

async function materializeMedia(file, remotePath, availableFiles) {
  const destinationPath = resolve(mediaDestination, file);
  if (availableFiles.has(file)) {
    await cp(resolve(mediaSource, file), destinationPath);
    return;
  }

  const cachePath = resolve(mediaCache, file);
  try {
    await access(cachePath);
    await cp(cachePath, destinationPath);
    return;
  } catch {
    // A cold checkout fills the build cache from TMDB's public image CDN.
  }

  const response = await fetch(`https://image.tmdb.org/t/p/w185${remotePath}`);
  if (!response.ok || !response.headers.get('content-type')?.startsWith('image/')) {
    throw new Error(`Could not cache fixture media ${file}: HTTP ${response.status}`);
  }
  const bytes = Buffer.from(await response.arrayBuffer());
  await writeFile(cachePath, bytes);
  await writeFile(destinationPath, bytes);
}

try {
  const fixture = JSON.parse(await readFile(source, 'utf8'));
  const restoredReviewPosters = restoreReviewPosters(fixture);
  const shareCardMedia = JSON.parse(await readFile(shareCardMediaManifest, 'utf8'));
  const mediaFiles = new Set(await readdir(mediaSource));
  const requiredShareCardMedia = [
    ...shareCardMedia.people.map(({ file }) => file),
    ...shareCardMedia.posters.map(({ file }) => file),
  ];
  const missingShareCardMedia = requiredShareCardMedia.filter((file) => !mediaFiles.has(file));

  if (shareCardMedia.people.length !== 2 || shareCardMedia.posters.length !== 10) {
    throw new Error('Share-card media manifest must contain exactly 2 people and 10 posters.');
  }
  if (missingShareCardMedia.length > 0) {
    throw new Error(`Missing share-card media: ${missingShareCardMedia.join(', ')}`);
  }

  const reviewMedia = collectMediaPaths([
    fixture.summary.details.review_analysis.reviews ?? [],
    fixture.summary.details.review_analysis.top_liked_reviews ?? [],
  ]);
  for (const file of requiredShareCardMedia) {
    reviewMedia.set(file, `/${file}`);
  }
  const fixtureMediaFiles = new Set(reviewMedia.keys());
  const localizedFixture = localizeFixtureMedia(fixture, fixtureMediaFiles);

  await mkdir(destinationDir, { recursive: true });
  await rm(mediaDestination, { force: true, recursive: true });
  await mkdir(mediaDestination, { recursive: true });
  await mkdir(mediaCache, { recursive: true });
  const mediaEntries = [...reviewMedia.entries()].sort(([left], [right]) => left.localeCompare(right));
  for (let index = 0; index < mediaEntries.length; index += 12) {
    await Promise.all(
      mediaEntries
        .slice(index, index + 12)
        .map(([file, remotePath]) => materializeMedia(file, remotePath, mediaFiles)),
    );
  }
  await writeFile(destination, `${JSON.stringify(localizedFixture, null, 2)}\n`);
  console.log(
    `[smt] Prepared Semih's local fixture with ${fixtureMediaFiles.size} local media files and ${restoredReviewPosters} review poster references.`,
  );
} catch (error) {
  await rm(destinationDir, { force: true, recursive: true });
  const detail = error instanceof Error ? error.message : String(error);
  console.error(`[smt] Could not prepare the local fixture: ${detail}`);
  process.exit(1);
}
