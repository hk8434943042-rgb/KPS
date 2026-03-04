$ErrorActionPreference = 'Stop'
$taskName = 'KPS-Localhost-Stack'

if (Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue) {
  Unregister-ScheduledTask -TaskName $taskName -Confirm:$false
  Write-Host "Removed scheduled task: $taskName" -ForegroundColor Yellow
} else {
  Write-Host "Scheduled task not found: $taskName" -ForegroundColor DarkYellow
}
