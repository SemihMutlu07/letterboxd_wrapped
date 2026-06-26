@echo off
REM Desktop scrape worker launcher. Reads backend\.env (WORKER_BACKEND_URL,
REM WORKER_TOKEN, TMDB_API_KEY). WORKER_SELF_TEST_ON_START stays OFF on purpose.
REM
REM Auto-boot: Win+R -> shell:startup -> drop a shortcut to this file there.
REM ponytail: Startup folder runs at LOGIN only; use Task Scheduler "at startup"
REM if the desktop ever runs headless/logged-out.
cd /d "%~dp0"
REM If you use a venv, replace "python" with the venv's python.exe path.
python -m app.worker.desktop_scrape_worker >> worker.log 2>&1
