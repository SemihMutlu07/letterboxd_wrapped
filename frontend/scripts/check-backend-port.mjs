#!/usr/bin/env node
import { parsePort, probeBackendPort } from './dev-port-utils.mjs';

const port = parsePort(process.env.BACKEND_PORT);
const probe = await probeBackendPort(port);

if (probe.state === 'free') {
  process.exit(0);
}

if (probe.state === 'letterboxd') {
  console.error(`[dev] Port ${port} already has a Movies Wrapped backend. Stop it before running dev:backend again.`);
  process.exit(1);
}

console.error(`[dev] Port ${port} is already occupied by a non-Movies Wrapped service (${probe.detail}).`);
console.error('[dev] Stop that process, or choose an explicit pair: BACKEND_PORT=8002 npm run dev');
process.exit(1);
