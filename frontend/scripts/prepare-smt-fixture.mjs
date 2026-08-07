#!/usr/bin/env node
import { cp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { basename, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const frontendDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const destinationDir = resolve(frontendDir, 'public/.dev');
const destination = resolve(destinationDir, 'smt-fixture.json');
const mediaDestination = resolve(destinationDir, 'smt-media');

if (process.argv.includes('--clean')) {
  await rm(destinationDir, { force: true, recursive: true });
  process.exit(0);
}

const fixtureDir = resolve(frontendDir, 'dev-fixtures/analysis-runs');
const source = resolve(fixtureDir, 'semihmutsuz.json');
const mediaSource = resolve(fixtureDir, 'semihmutsuz-media');
const shareCardMediaManifest = resolve(fixtureDir, 'semihmutsuz-share-card-media.json');

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
        return [key, `/.dev/smt-media/${basename(item)}`];
      }
      return [key, localizeFixtureMedia(item, mediaFiles)];
    }),
  );
}

try {
  const fixture = JSON.parse(await readFile(source, 'utf8'));
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

  const shareCardMediaFiles = new Set(requiredShareCardMedia);
  const localizedFixture = localizeFixtureMedia(fixture, shareCardMediaFiles);

  await mkdir(destinationDir, { recursive: true });
  await rm(mediaDestination, { force: true, recursive: true });
  await mkdir(mediaDestination, { recursive: true });
  await Promise.all(
    requiredShareCardMedia.map((file) =>
      cp(resolve(mediaSource, file), resolve(mediaDestination, file)),
    ),
  );
  await writeFile(destination, `${JSON.stringify(localizedFixture, null, 2)}\n`);
  console.log(
    `[smt] Prepared Semih's local fixture with 2 portraits and 10 posters.`,
  );
} catch (error) {
  await rm(destinationDir, { force: true, recursive: true });
  const detail = error instanceof Error ? error.message : String(error);
  console.error(`[smt] Could not prepare the local fixture: ${detail}`);
  process.exit(1);
}
