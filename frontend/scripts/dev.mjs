#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parsePort, probeBackendPort } from './dev-port-utils.mjs';

const frontendDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const backendPort = parsePort(process.env.BACKEND_PORT);
const apiBase = `http://localhost:${backendPort}`;
const probe = await probeBackendPort(backendPort);

if (probe.state === 'other') {
  console.error(`[dev] Refusing to start: port ${backendPort} is occupied by a non-Movies Wrapped service (${probe.detail}).`);
  console.error('[dev] This is the failure mode that shows up as a browser CORS error.');
  console.error('[dev] Stop the process on that port, or run with an explicit override: BACKEND_PORT=8002 npm run dev');
  process.exit(1);
}

const children = [];
let shuttingDown = false;

function run(name, command, args, env) {
  const child = spawn(command, args, {
    cwd: frontendDir,
    env,
    stdio: 'inherit',
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
  console.error(`[dev] Use NEXT_PUBLIC_API_BASE=${apiBase} or unset it and let npm run dev set it.`);
  process.exit(1);
}

console.log(`[dev] Frontend API base: ${apiBase}`);

if (probe.state === 'letterboxd') {
  console.log(`[dev] Reusing existing Movies Wrapped backend on ${apiBase}.`);
} else {
  run('backend', 'npm', ['run', 'dev:backend'], sharedEnv);
}

run('frontend', 'npm', ['run', 'dev:frontend'], sharedEnv);
