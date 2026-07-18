#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { rmSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parsePort, probeBackendPort, findFreePort } from './dev-port-utils.mjs';

const frontendDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const backendPort = parsePort(process.env.BACKEND_PORT);
const apiBase = `http://localhost:${backendPort}`;
const desiredFrontendPort = parsePort(process.env.PORT, 3000);
const frontendPort = await findFreePort(desiredFrontendPort, 'frontend');
const actualFrontendPort = frontendPort !== desiredFrontendPort ? frontendPort : null;
const frontendUrl = `http://localhost:${frontendPort}/experiment`;
const startBackend = process.env.START_BACKEND === '1';
const probe = startBackend ? await probeBackendPort(backendPort) : { state: 'skipped' };

if (probe.state === 'other') {
  console.error(`[dev] Refusing to start: port ${backendPort} is occupied by a non-Movies Wrapped service (${probe.detail}).`);
  console.error('[dev] This is the failure mode that shows up as a browser CORS error.');
  console.error('[dev] Stop the process on that port, or run with an explicit override: BACKEND_PORT=8002 bun run dev');
  process.exit(1);
}

const children = [];
let shuttingDown = false;

function run(name, command, args, env) {
  const child = spawn(command, args, {
    cwd: frontendDir,
    env,
    stdio: 'inherit',
    shell: false,
  });

  children.push(child);
  child.on('exit', (code, signal) => {
    if (shuttingDown) return;
    shuttingDown = true;
    const status = signal ? `signal ${signal}` : `code ${code}`;
    console.error(`[dev] ${name} exited with ${status}; stopping dev session.`);
    stopAll('SIGTERM');
    process.exit(code && code !== 0 ? code : 1);
  });
}

function openBrowser(url) {
  if (process.env.NO_OPEN === '1' || process.env.CI === 'true') return;

  const command =
    process.platform === 'darwin'
      ? 'open'
      : process.platform === 'win32'
        ? 'cmd'
        : 'xdg-open';
  const args = process.platform === 'win32' ? ['/c', 'start', '', url] : [url];

  const child = spawn(command, args, {
    cwd: frontendDir,
    stdio: 'ignore',
    shell: false,
    detached: true,
  });
  child.unref();
}

function stopAll(signal) {
  for (const child of children) {
    if (!child.killed) child.kill(signal);
  }
}

process.on('SIGINT', () => {
  shuttingDown = true;
  stopAll('SIGINT');
});
process.on('SIGTERM', () => {
  shuttingDown = true;
  stopAll('SIGTERM');
});

const sharedEnv = {
  ...process.env,
  BACKEND_PORT: String(backendPort),
  NEXT_PUBLIC_API_BASE: process.env.NEXT_PUBLIC_API_BASE || apiBase,
};

if (sharedEnv.NEXT_PUBLIC_API_BASE.replace(/\/$/, '') !== apiBase) {
  console.error(`[dev] NEXT_PUBLIC_API_BASE (${sharedEnv.NEXT_PUBLIC_API_BASE}) does not match BACKEND_PORT (${backendPort}).`);
  console.error(`[dev] Use NEXT_PUBLIC_API_BASE=${apiBase} or unset it and let bun run dev set it.`);
  process.exit(1);
}

console.log(`[dev] Frontend API base: ${apiBase}`);
console.log('[dev] Cleaning stale Next dev cache...');
rmSync(resolve(frontendDir, '.next'), { recursive: true, force: true });

if (probe.state === 'letterboxd') {
  console.log(`[dev] Reusing existing Movies Wrapped backend on ${apiBase}.`);
} else if (startBackend) {
  run('backend', 'bun', ['run', 'dev:backend'], sharedEnv);
} else {
  console.log('[dev] Backend skipped. Experiment fixtures load locally; use `bun run dev:full` for scrape/API flows.');
}

run('frontend', 'bun', ['run', 'dev:frontend'], {
  ...sharedEnv,
  PORT: String(frontendPort),
});

if (actualFrontendPort) {
  console.log(`[dev] Frontend on port ${actualFrontendPort} (${desiredFrontendPort} was occupied).`);
}

setTimeout(() => {
  console.log(`[dev] Opening ${frontendUrl}`);
  openBrowser(frontendUrl);
}, 2200);
