param(
  [switch]$Silent,
  [switch]$OpenBrowser
)

$ErrorActionPreference = 'Stop'

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot = Split-Path -Parent (Split-Path -Parent $scriptDir)
$runtimeDir = Join-Path $scriptDir 'runtime'
$runtimeFile = Join-Path $runtimeDir 'localhost-stack.json'
$backendLog = Join-Path $runtimeDir 'backend.local.log'
$backendErrLog = Join-Path $runtimeDir 'backend.local.err.log'
$frontendLog = Join-Path $runtimeDir 'frontend.local.log'
$frontendErrLog = Join-Path $runtimeDir 'frontend.local.err.log'

New-Item -ItemType Directory -Path $runtimeDir -Force | Out-Null

function Write-Info([string]$msg) {
  if (-not $Silent) {
    Write-Host $msg -ForegroundColor Cyan
  }
}

function Get-ListenerPid([int]$Port) {
  $listener = Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue |
    Where-Object { $_.State -eq 'Listen' } |
    Select-Object -First 1
  if ($listener) { return [int]$listener.OwningProcess }
  return $null
}

function Wait-ForPort([int]$Port, [int]$Seconds = 20) {
  for ($i = 0; $i -lt $Seconds; $i++) {
    Start-Sleep -Seconds 1
    if (Get-ListenerPid -Port $Port) { return $true }
  }
  return $false
}

$backendPid = Get-ListenerPid -Port 5000
$frontendPid = Get-ListenerPid -Port 8000

if (-not $backendPid) {
  Write-Info 'Starting backend on port 5000...'
  $dbFile = Join-Path $repoRoot 'database\school.db'
  $dbUrl = 'sqlite:///' + ($dbFile -replace '\\','/')
  $backendCmd = "Set-Location '$repoRoot'; `$env:DATABASE_URL='$dbUrl'; if (Test-Path '.\.venv\Scripts\Activate.ps1') { . '.\.venv\Scripts\Activate.ps1' }; python backend\01_app.py"
  $backendProc = Start-Process -FilePath 'powershell.exe' -ArgumentList @('-NoProfile','-ExecutionPolicy','Bypass','-Command',$backendCmd) -WindowStyle Hidden -RedirectStandardOutput $backendLog -RedirectStandardError $backendErrLog -PassThru
  $backendPid = $backendProc.Id

  if (-not (Wait-ForPort -Port 5000 -Seconds 25)) {
    throw 'Backend failed to start on port 5000. Check scripts/local/runtime/backend.local.err.log'
  }
}
Write-Info "Backend ready (PID $backendPid)."

if (-not $frontendPid) {
  Write-Info 'Starting frontend on port 8000...'
  $frontendCmd = "Set-Location '$repoRoot\\frontend'; python -m http.server 8000"
  $frontendProc = Start-Process -FilePath 'powershell.exe' -ArgumentList @('-NoProfile','-ExecutionPolicy','Bypass','-Command',$frontendCmd) -WindowStyle Hidden -RedirectStandardOutput $frontendLog -RedirectStandardError $frontendErrLog -PassThru
  $frontendPid = $frontendProc.Id

  if (-not (Wait-ForPort -Port 8000 -Seconds 20)) {
    throw 'Frontend failed to start on port 8000. Check scripts/local/runtime/frontend.local.err.log'
  }
}
Write-Info "Frontend ready (PID $frontendPid)."

$state = [ordered]@{
  startedAt = (Get-Date).ToString('s')
  backendPid = $backendPid
  frontendPid = $frontendPid
  backendUrl = 'http://localhost:5000/api'
  frontendUrl = 'http://localhost:8000/login.html'
}

$state | ConvertTo-Json | Set-Content -Path $runtimeFile -Encoding UTF8

if ($OpenBrowser) {
  Start-Process 'http://localhost:8000/login.html' | Out-Null
  Write-Info 'Opened browser at http://localhost:8000/login.html'
}

Write-Info 'Localhost stack is running.'
