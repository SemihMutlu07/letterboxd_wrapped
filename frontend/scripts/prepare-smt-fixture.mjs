#!/usr/bin/env node
import { cp, mkdir, rm } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const frontendDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const destinationDir = resolve(frontendDir, 'public/.dev');
const destination = resolve(destinationDir, 'smt-fixture.json');

if (process.argv.includes('--clean')) {
  await rm(destinationDir, { force: true, recursive: true });
  process.exit(0);
}

const source = resolve(
  frontendDir,
  '../../letterboxd_wrapped-experiment/frontend/dev-fixtures/analysis-runs/semihmutsuz.json',
);

try {
  await mkdir(destinationDir, { recursive: true });
  await cp(source, destination);
  console.log('[smt] Prepared the local Semih fixture for /smt.');
} catch (error) {
  await rm(destinationDir, { force: true, recursive: true });
  const detail = error instanceof Error ? error.message : String(error);
  console.error(`[smt] Could not prepare the experiment fixture: ${detail}`);
  process.exit(1);
}
