$taskName = 'KPS-Local-Backend-Tunnel'
Unregister-ScheduledTask -TaskName $taskName -Confirm:$false -ErrorAction SilentlyContinue
Write-Host "Removed scheduled task: $taskName" -ForegroundColor Yellow
