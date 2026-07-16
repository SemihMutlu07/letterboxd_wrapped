param(
    [string]$BackendDir = $PSScriptRoot,
    [int]$PollIntervalSeconds = 10,
    [int]$RestartGraceSeconds = 20,
    [int]$LogTailLines = 80
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$SupervisorVersion = "2026-06-28"
$SupervisorStartedAt = (Get-Date).ToUniversalTime().ToString("o")
$SupervisorLog = Join-Path $BackendDir "worker-supervisor.log"
$WorkerLog = Join-Path $BackendDir "worker.log"
$WorkerErrorLog = Join-Path $BackendDir "worker-error.log"
$LastSeenRestartToken = $null
$DesiredState = "run"
$LastControlError = $null
$Child = $null
$ChildStartedAt = $null
$ChildExitCode = $null
$PythonExe = Join-Path $BackendDir ".venv\Scripts\python.exe"

function Write-SupervisorLog {
    param([string]$Message)
    $line = "{0} {1}" -f (Get-Date).ToUniversalTime().ToString("o"), $Message
    Add-Content -Path $SupervisorLog -Value $line
    Write-Host $line
}

function Load-DotEnv {
    $envPath = Join-Path $BackendDir ".env"
    if (-not (Test-Path $envPath)) {
        return
    }
    foreach ($line in Get-Content $envPath) {
        $trimmed = $line.Trim()
        if (-not $trimmed -or $trimmed.StartsWith("#") -or -not $trimmed.Contains("=")) {
            continue
        }
        $name, $value = $trimmed.Split("=", 2)
        $name = $name.Trim()
        $value = $value.Trim().Trim('"').Trim("'")
        if ($name -and -not [Environment]::GetEnvironmentVariable($name, "Process")) {
            [Environment]::SetEnvironmentVariable($name, $value, "Process")
        }
    }
}

function Get-BackendUrl {
    return ([string]$env:WORKER_BACKEND_URL).TrimEnd("/")
}

function Get-WorkerHeaders {
    return @{ "X-Worker-Token" = [string]$env:WORKER_TOKEN }
}

function Invoke-WorkerApi {
    param(
        [string]$Method,
        [string]$Path,
        [object]$Body = $null
    )
    $backendUrl = Get-BackendUrl
    if (-not $backendUrl -or -not $env:WORKER_TOKEN) {
        throw "WORKER_BACKEND_URL and WORKER_TOKEN must be set in .env or the process environment."
    }
    $params = @{
        Uri = "$backendUrl$Path"
        Method = $Method
        Headers = Get-WorkerHeaders
        TimeoutSec = 15
    }
    if ($null -ne $Body) {
        $params.Body = $Body | ConvertTo-Json -Depth 8
        $params.ContentType = "application/json"
    }
    return Invoke-RestMethod @params
}

function Test-ChildRunning {
    if ($null -eq $script:Child) {
        return $false
    }
    try {
        return -not $script:Child.HasExited
    } catch {
        return $false
    }
}

function Start-WorkerChild {
    if (Test-ChildRunning) {
        return
    }
    if (-not (Test-Path $PythonExe)) {
        throw "Worker interpreter not found at $PythonExe. Create backend/.venv before starting the supervisor."
    }
    Write-SupervisorLog ("starting worker child interpreter={0}" -f $PythonExe)
    $script:Child = Start-Process `
        -FilePath $PythonExe `
        -ArgumentList @("-m", "app.worker.desktop_scrape_worker") `
        -WorkingDirectory $BackendDir `
        -RedirectStandardOutput $WorkerLog `
        -RedirectStandardError $WorkerErrorLog `
        -PassThru `
        -WindowStyle Hidden
    $script:ChildStartedAt = (Get-Date).ToUniversalTime().ToString("o")
    $script:ChildExitCode = $null
    Write-SupervisorLog ("worker child started pid={0}" -f $script:Child.Id)
}

function Stop-WorkerChild {
    if (-not (Test-ChildRunning)) {
        return
    }
    $pidToStop = $script:Child.Id
    Write-SupervisorLog ("stopping worker child pid={0}" -f $pidToStop)
    try {
        taskkill.exe /PID $pidToStop /T | Out-Null
        Wait-Process -Id $pidToStop -Timeout $RestartGraceSeconds -ErrorAction SilentlyContinue
    } catch {
        Write-SupervisorLog ("graceful stop failed: {0}" -f $_.Exception.Message)
    }
    if (Test-ChildRunning) {
        Write-SupervisorLog ("forcing worker child stop pid={0}" -f $pidToStop)
        taskkill.exe /PID $pidToStop /T /F | Out-Null
    }
    try {
        $script:Child.Refresh()
        $script:ChildExitCode = $script:Child.ExitCode
    } catch {
        $script:ChildExitCode = $null
    }
}

function Update-RepoFastForward {
    Write-SupervisorLog "verifying desktop_server checkout before worker start"
    try {
        $RepoDir = Split-Path $BackendDir -Parent
        $output = git -C $RepoDir fetch origin desktop_server 2>&1
        foreach ($line in $output) { Write-SupervisorLog ("git: {0}" -f $line) }
        if ($LASTEXITCODE -ne 0) { throw "git fetch failed with exit code $LASTEXITCODE" }

        $output = git -C $RepoDir checkout desktop_server 2>&1
        foreach ($line in $output) { Write-SupervisorLog ("git: {0}" -f $line) }
        if ($LASTEXITCODE -ne 0) { throw "git checkout failed with exit code $LASTEXITCODE" }

        $output = git -C $RepoDir pull --ff-only origin desktop_server 2>&1
        foreach ($line in $output) { Write-SupervisorLog ("git: {0}" -f $line) }
        if ($LASTEXITCODE -ne 0) {
            throw "git pull --ff-only failed with exit code $LASTEXITCODE"
        }
    } catch {
        Write-SupervisorLog ("git pull failed: {0}" -f $_.Exception.Message)
        throw
    }
}

function Get-LogTail {
    $lines = @()
    if (Test-Path $SupervisorLog) {
        $lines += "--- supervisor ---"
        $lines += Get-Content $SupervisorLog -Tail ([Math]::Min(20, $LogTailLines)) -ErrorAction SilentlyContinue
    }
    if (Test-Path $WorkerLog) {
        $lines += "--- worker ---"
        $lines += Get-Content $WorkerLog -Tail $LogTailLines -ErrorAction SilentlyContinue
    }
    return @($lines | Select-Object -Last $LogTailLines)
}

function Get-ControlPath {
    if ($null -eq $script:LastSeenRestartToken) {
        return "/api/worker/control"
    }
    $token = [uri]::EscapeDataString([string]$script:LastSeenRestartToken)
    return "/api/worker/control?last_seen_restart_token=$token"
}

function Report-Supervisor {
    $childStatus = "stopped"
    $childPid = $null
    if (Test-ChildRunning) {
        $childStatus = "running"
        $childPid = $script:Child.Id
    }
    $payload = @{
        supervisor_version = $SupervisorVersion
        supervisor_started_at = $SupervisorStartedAt
        backend_url = Get-BackendUrl
        poll_interval_seconds = $PollIntervalSeconds
        desired_state = $script:DesiredState
        child_status = $childStatus
        child_pid = $childPid
        child_started_at = $script:ChildStartedAt
        child_exit_code = $script:ChildExitCode
        last_restart_token_seen = $script:LastSeenRestartToken
        last_control_error = $script:LastControlError
        log_tail = @(Get-LogTail)
    }
    Invoke-WorkerApi -Method "POST" -Path "/api/worker/supervisor" -Body $payload | Out-Null
}

Load-DotEnv
Update-RepoFastForward
$RepoDir = Split-Path $BackendDir -Parent
$branch = git -C $RepoDir branch --show-current
$sha = git -C $RepoDir rev-parse HEAD
Write-SupervisorLog ("worker supervisor verified interpreter={0} branch={1} sha={2}" -f $PythonExe, $branch, $sha)
Write-SupervisorLog "worker supervisor starting"

while ($true) {
    try {
        $control = Invoke-WorkerApi -Method "GET" -Path (Get-ControlPath)
        $script:LastControlError = $null
        if ($control.desired_state) {
            $script:DesiredState = [string]$control.desired_state
        }
        if ($control.should_restart -eq $true) {
            Write-SupervisorLog ("restart requested token={0}" -f $control.restart_token)
            Stop-WorkerChild
            Update-RepoFastForward
            $script:LastSeenRestartToken = $control.restart_token
            Start-WorkerChild
        } else {
            $script:LastSeenRestartToken = $control.restart_token
        }
    } catch {
        $script:LastControlError = $_.Exception.Message
        $script:DesiredState = "run"
        Write-SupervisorLog ("control poll failed; failing open to run: {0}" -f $script:LastControlError)
    }

    if (-not (Test-ChildRunning)) {
        Start-WorkerChild
    }

    try {
        Report-Supervisor
    } catch {
        Write-SupervisorLog ("supervisor report failed: {0}" -f $_.Exception.Message)
    }

    Start-Sleep -Seconds $PollIntervalSeconds
}
