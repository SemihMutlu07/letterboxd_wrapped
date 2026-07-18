import net from 'node:net';
import { execFile } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { promisify } from 'node:util';

export const DEFAULT_BACKEND_PORT = 8000;
export const EXPECTED_BACKEND_TEXT = 'Letterboxd Wrapped';
const execFileAsync = promisify(execFile);

export function parsePort(value, fallback = DEFAULT_BACKEND_PORT) {
  if (value === undefined || value === '') return fallback;
  const port = Number(value);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`Invalid BACKEND_PORT: ${value}`);
  }
  return port;
}

export async function findFreePort(start, label = 'port') {
  for (let offset = 0; offset < 20; offset++) {
    const candidate = start + offset;
    const open = await isPortListeningWithSs(candidate)
      || await isPortListeningInProc(candidate)
      || await isPortOpen(candidate);
    if (!open) return candidate;
    if (offset === 0) {
      console.log(`[dev] ${label} ${candidate} is in use, scanning forward...`);
    }
  }
  throw new Error(`No free port found starting from ${start} (scanned +20).`);
}

export function isPortOpen(port) {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host: '127.0.0.1', port });
    socket.setTimeout(500);
    socket.once('connect', () => {
      socket.destroy();
      resolve(true);
    });
    socket.once('timeout', () => {
      socket.destroy();
      resolve(true);
    });
    socket.once('error', () => {
      resolve(false);
    });
  });
}

async function isPortListeningInProc(port) {
  const portHex = port.toString(16).toUpperCase().padStart(4, '0');
  for (const file of ['/proc/net/tcp', '/proc/net/tcp6']) {
    try {
      const content = await readFile(file, 'utf8');
      const lines = content.trim().split('\n').slice(1);
      for (const line of lines) {
        const fields = line.trim().split(/\s+/);
        const localAddress = fields[1];
        const state = fields[3];
        if (state === '0A' && localAddress?.endsWith(`:${portHex}`)) {
          return true;
        }
      }
    } catch {
      // Non-Linux systems may not have /proc; fall back to the socket probe.
    }
  }
  return false;
}

async function isPortListeningWithSs(port) {
  try {
    const { stdout } = await execFileAsync('ss', ['-ltn']);
    const lines = stdout.trim().split('\n').slice(1);
    return lines.some((line) => {
      const fields = line.trim().split(/\s+/);
      const localAddress = fields[3];
      return localAddress === `*:${port}` || localAddress?.endsWith(`:${port}`);
    });
  } catch {
    return false;
  }
}

export async function probeBackendPort(port) {
  const open = await isPortListeningWithSs(port) || await isPortListeningInProc(port) || await isPortOpen(port);
  if (!open) return { state: 'free' };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 800);
  try {
    const response = await fetch(`http://127.0.0.1:${port}/`, {
      signal: controller.signal,
      headers: { Accept: 'application/json,text/plain,*/*' },
    });
    const text = await response.text();
    if (text.includes(EXPECTED_BACKEND_TEXT)) {
      return { state: 'letterboxd', detail: `HTTP ${response.status}` };
    }
    return { state: 'other', detail: `HTTP ${response.status}` };
  } catch (error) {
    return {
      state: 'other',
      detail: error instanceof Error ? error.message : String(error),
    };
  } finally {
    clearTimeout(timeout);
  }
}
