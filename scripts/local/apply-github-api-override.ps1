param(
  [string]$SiteBase = 'https://hk8434943042-rgb.github.io/KPS'
)

$ErrorActionPreference = 'Stop'

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$runtimeFile = Join-Path (Join-Path $scriptDir 'runtime') 'local-stack.json'

if (-not (Test-Path $runtimeFile)) {
  throw "Runtime state missing: $runtimeFile"
}

$state = Get-Content $runtimeFile -Raw | ConvertFrom-Json
$apiUrl = ($state.apiUrl | Out-String).Trim()

if (-not $apiUrl) {
  throw 'apiUrl missing in runtime state. Start stack first.'
}

$siteBase = $SiteBase.TrimEnd('/')
$encodedApi = [System.Uri]::EscapeDataString($apiUrl)
$target = "$siteBase/set-api.html?api=$encodedApi&redirect=login.html"

Start-Process $target
Write-Host "Opened API override URL:" -ForegroundColor Green
Write-Host $target -ForegroundColor Cyan
