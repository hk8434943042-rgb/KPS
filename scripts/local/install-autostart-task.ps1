$ErrorActionPreference = 'Stop'

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$startScript = Join-Path $scriptDir 'start-local-stack.ps1'
$taskName = 'KPS-Local-Backend-Tunnel'

if (-not (Test-Path $startScript)) {
  throw "Start script not found: $startScript"
}

$pwsh = (Get-Command powershell.exe).Source
$taskAction = New-ScheduledTaskAction -Execute $pwsh -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$startScript`" -Silent -ApplyGitHubOverride"
$taskTrigger = New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME
$taskPrincipal = New-ScheduledTaskPrincipal -UserId "$env:USERDOMAIN\$env:USERNAME" -RunLevel Limited -LogonType Interactive
$taskSettings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable

Register-ScheduledTask -TaskName $taskName -Action $taskAction -Trigger $taskTrigger -Principal $taskPrincipal -Settings $taskSettings -Description 'Starts KPS backend and cloudflared tunnel at user logon.' -Force | Out-Null

Write-Host "Installed scheduled task: $taskName" -ForegroundColor Green
Write-Host "Run once now: powershell -ExecutionPolicy Bypass -File `"$startScript`"" -ForegroundColor Cyan
