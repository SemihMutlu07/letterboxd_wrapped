"""Worker identity — worker_id and version for the desktop scrape worker.

Kept separate from WorkerConfig (runtime/network settings in
desktop_scrape_worker.py) so the identity values can be imported anywhere
without pulling in the whole worker module. Both values are env-overridable
so a multi-worker deployment can give each machine a stable id.
"""
from __future__ import annotations

import os
import socket

# Stable per-machine identity. Defaults to the hostname so a fresh setup
# "just works"; set WORKER_ID explicitly when running more than one worker
# against the same backend (e.g. desktop + laptop).
WORKER_ID = os.getenv("WORKER_ID") or f"desktop-{socket.gethostname().lower()}"

# Human-facing worker version reported in heartbeats. Bump when worker
# behavior changes; independent of WORKER_PROTOCOL_VERSION (the control-plane
# compatibility number in desktop_scrape_worker.py).
WORKER_VERSION = os.getenv("WORKER_VERSION") or "1.0.0"
