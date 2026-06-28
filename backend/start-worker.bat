@echo off
REM Tiny launcher for the durable desktop worker supervisor.
REM Task Scheduler should point here (preferably "At startup").
cd /d "%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0start-worker-supervisor.ps1" >> worker-supervisor-wrapper.log 2>&1
