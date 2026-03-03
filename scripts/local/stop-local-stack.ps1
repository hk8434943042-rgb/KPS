$ErrorActionPreference = 'SilentlyContinue'

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$runtimeFile = Join-Path (Join-Path $scriptDir 'runtime') 'local-stack.json'

function Stop-ProcById([int]$id) {
  if ($id -gt 0) {
    Stop-Process -Id $id -Force -ErrorAction SilentlyContinue
  }
}

if (Test-Path $runtimeFile) {
  try {
    $state = Get-Content $runtimeFile -Raw | ConvertFrom-Json
    Stop-ProcById -id ([int]$state.backendPid)
    Stop-ProcById -id ([int]$state.tunnelPid)
  } catch {
  }
}

Get-CimInstance Win32_Process -Filter "Name='cloudflared.exe'" |
  Where-Object { $_.CommandLine -match '--url\s+http://localhost:5000' } |
  ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }

Write-Host 'Stopped local backend/tunnel processes (if running).' -ForegroundColor Yellow
