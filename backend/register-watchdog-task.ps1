# Registers the external watchdog as its own scheduled task. Run this ONCE, from an
# ELEVATED PowerShell (right-click -> "Run as administrator" — a normal window opened from
# the taskbar is not enough; Register-ScheduledTask fails with "Erisim engellendi").
#
# -RunLevel Highest is not optional. The watchdog identifies processes by reading
# Win32_Process.CommandLine, which returns $null for a process more privileged than the
# caller. The supervisor task itself runs elevated, so a non-elevated watchdog would see a
# supervisor it cannot identify, skip it by its own fail-safe rule, and silently police
# nothing — the worst possible outcome for a safety net.

param(
    [string]$TaskName   = "LetterboxdWorkerWatchdog",
    [string]$ScriptPath = (Join-Path $PSScriptRoot "watchdog-worker-supervisor.ps1")
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()
           ).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Host "This must be run from an elevated PowerShell (Run as administrator). Nothing was changed."
    exit 1
}
if (-not (Test-Path $ScriptPath)) {
    Write-Host "Watchdog script not found at $ScriptPath. Nothing was changed."
    exit 1
}

$action = New-ScheduledTaskAction -Execute "powershell.exe" `
    -Argument ('-NoProfile -NonInteractive -ExecutionPolicy Bypass -File "{0}"' -f $ScriptPath)

# Two triggers: one that survives reboots, one that starts checking immediately after this
# registration without waiting for the next boot. Both repeat every minute, effectively
# forever (10 years — [TimeSpan]::MaxValue is rejected by some Windows builds).
$forever = New-TimeSpan -Days 3650
$atStartup = New-ScheduledTaskTrigger -AtStartup
$atStartup.Repetition = (New-ScheduledTaskTrigger -Once -At (Get-Date) `
    -RepetitionInterval (New-TimeSpan -Minutes 1) -RepetitionDuration $forever).Repetition
$now = New-ScheduledTaskTrigger -Once -At ((Get-Date).AddMinutes(1)) `
    -RepetitionInterval (New-TimeSpan -Minutes 1) -RepetitionDuration $forever

# The watchdog must run on battery and must never be stopped mid-check by power policy —
# its whole job is to be there during the failure. It is single-shot and finishes in well
# under a second, so a 5-minute execution limit is a generous backstop against a hung run.
$settings = New-ScheduledTaskSettingsSet `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -StartWhenAvailable `
    -MultipleInstances IgnoreNew `
    -ExecutionTimeLimit (New-TimeSpan -Minutes 5)

Register-ScheduledTask -TaskName $TaskName `
    -Action $action `
    -Trigger @($atStartup, $now) `
    -Settings $settings `
    -RunLevel Highest `
    -Description "External memory watchdog for the Letterboxd desktop worker. Kills the supervisor over 400MB or the worker over 2000MB. See watchdog-worker-supervisor.ps1." `
    -Force | Out-Null

Write-Host "Registered scheduled task '$TaskName' (elevated, every 1 minute)."
Write-Host "Verify with:  Get-ScheduledTask -TaskName $TaskName | Select-Object TaskName,State"
Write-Host "Its log:      $(Join-Path $PSScriptRoot 'worker-watchdog.log')  (only written when something matters)"
