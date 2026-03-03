param(
  [switch]$Silent,
  [switch]$ApplyGitHubOverride
)

$ErrorActionPreference = 'Stop'

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot = Split-Path -Parent (Split-Path -Parent $scriptDir)
$runtimeDir = Join-Path $scriptDir 'runtime'
$runtimeFile = Join-Path $runtimeDir 'local-stack.json'
$backendLog = Join-Path $runtimeDir 'backend.log'
$backendErrLog = Join-Path $runtimeDir 'backend.err.log'
$tunnelLog = Join-Path $runtimeDir 'tunnel.log'
$tunnelErrLog = Join-Path $runtimeDir 'tunnel.err.log'

New-Item -ItemType Directory -Path $runtimeDir -Force | Out-Null

function Write-Info([string]$msg) {
  if (-not $Silent) {
    Write-Host $msg -ForegroundColor Cyan
  }
}

function Get-ListeningOn5000 {
  return Get-NetTCPConnection -LocalPort 5000 -ErrorAction SilentlyContinue |
    Where-Object { $_.State -eq 'Listen' } |
    Select-Object -First 1
}

function Find-ExistingTunnelProcess {
  $procs = Get-CimInstance Win32_Process -Filter "Name='cloudflared.exe'" -ErrorAction SilentlyContinue
  return $procs | Where-Object { $_.CommandLine -match '--url\s+http://localhost:5000' } | Select-Object -First 1
}

function Get-TunnelUrlFromLogs {
  param(
    [string[]]$Paths
  )

  foreach ($path in $Paths) {
    if (-not (Test-Path $path)) { continue }
    $hits = Get-Content $path -ErrorAction SilentlyContinue |
      Select-String -Pattern 'https://[a-z0-9-]+\.trycloudflare\.com' -AllMatches
    if ($hits) {
      $match = [regex]::Match(($hits | Select-Object -Last 1).Line, 'https://[a-z0-9-]+\.trycloudflare\.com')
      if ($match.Success) {
        return $match.Value
      }
    }
  }

  return $null
}

$backendPid = $null
$tunnelPid = $null
$tunnelUrl = $null

$listener = Get-ListeningOn5000
if ($listener) {
  Write-Info "Backend already running on port 5000 (PID $($listener.OwningProcess))."
  $backendPid = [int]$listener.OwningProcess
} else {
  Write-Info 'Starting backend on port 5000...'
  $backendCmd = "Set-Location '$repoRoot'; if (Test-Path '.\.venv\Scripts\Activate.ps1') { . '.\.venv\Scripts\Activate.ps1' }; python backend\01_app.py"
  $backendProc = Start-Process -FilePath 'powershell.exe' -ArgumentList @('-NoProfile','-ExecutionPolicy','Bypass','-Command',$backendCmd) -WindowStyle Hidden -RedirectStandardOutput $backendLog -RedirectStandardError $backendErrLog -PassThru
  $backendPid = $backendProc.Id

  $ready = $false
  for ($i = 0; $i -lt 20; $i++) {
    Start-Sleep -Seconds 1
    if (Get-ListeningOn5000) {
      $ready = $true
      break
    }
  }

  if (-not $ready) {
    throw 'Backend did not start on port 5000 in time. Check scripts/local/runtime/backend.log.'
  }
  Write-Info "Backend started (PID $backendPid)."
}

$existingTunnel = Find-ExistingTunnelProcess
if ($existingTunnel) {
  $tunnelPid = [int]$existingTunnel.ProcessId
  Write-Info "Cloudflared tunnel already running (PID $tunnelPid)."
} else {
  Write-Info 'Starting cloudflared tunnel...'
  if (Test-Path $tunnelLog) { Remove-Item $tunnelLog -Force }
  if (Test-Path $tunnelErrLog) { Remove-Item $tunnelErrLog -Force }
  $tunnelProc = Start-Process -FilePath 'cloudflared.exe' -ArgumentList @('tunnel','--url','http://localhost:5000','--no-autoupdate') -WindowStyle Hidden -RedirectStandardOutput $tunnelLog -RedirectStandardError $tunnelErrLog -PassThru
  $tunnelPid = $tunnelProc.Id

  for ($i = 0; $i -lt 30; $i++) {
    Start-Sleep -Seconds 1
    $tunnelUrl = Get-TunnelUrlFromLogs -Paths @($tunnelLog, $tunnelErrLog)
    if ($tunnelUrl) {
      break
    }
  }

  Write-Info "Tunnel started (PID $tunnelPid)."
}

if (-not $tunnelUrl) {
  $tunnelUrl = Get-TunnelUrlFromLogs -Paths @($tunnelLog, $tunnelErrLog)
}

$state = [ordered]@{
  startedAt = (Get-Date).ToString('s')
  backendPid = $backendPid
  tunnelPid = $tunnelPid
  tunnelUrl = $tunnelUrl
  apiUrl = if ($tunnelUrl) { "$tunnelUrl/api" } else { $null }
  backendHealth = 'http://localhost:5000/health'
}

$state | ConvertTo-Json | Set-Content -Path $runtimeFile -Encoding UTF8

if ($tunnelUrl) {
  Write-Info "Tunnel URL: $tunnelUrl"
  Write-Info "API URL: $tunnelUrl/api"
} else {
  Write-Info 'Tunnel URL not detected yet. Check scripts/local/runtime/tunnel.log.'
}

if ($ApplyGitHubOverride -and $tunnelUrl) {
  $applyScript = Join-Path $scriptDir 'apply-github-api-override.ps1'
  if (Test-Path $applyScript) {
    try {
      & $applyScript | Out-Null
      Write-Info 'Applied GitHub Pages API override in browser.'
    } catch {
      Write-Info "Failed to auto-apply GitHub override: $($_.Exception.Message)"
    }
  }
}
