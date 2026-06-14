<#
  stop-demo.ps1 - tear down the Cloudflare tunnel started by start-demo.ps1.

  Stops the cloudflared process recorded in .demo-state.json. The Vercel
  deployment stays live (it just cannot reach the backend until the next
  start-demo.ps1). The local backend and Docker stack are left running.
#>
$ErrorActionPreference = 'SilentlyContinue'
$stateFile = Join-Path $env:TEMP 'ibchat-demo-state.json'

if (-not (Test-Path $stateFile)) {
  Write-Host 'No demo state file found. Stopping any stray cloudflared processes...' -ForegroundColor Yellow
  Get-Process cloudflared -ErrorAction SilentlyContinue | Stop-Process -Force
  Write-Host 'Done.'
  return
}

$state = Get-Content $stateFile -Raw | ConvertFrom-Json
if ($state.cloudflaredPid) {
  $p = Get-Process -Id $state.cloudflaredPid -ErrorAction SilentlyContinue
  if ($p) {
    Stop-Process -Id $state.cloudflaredPid -Force
    Write-Host "Stopped cloudflared (PID $($state.cloudflaredPid)). Tunnel $($state.tunnelUrl) is down." -ForegroundColor Green
  } else {
    Write-Host "cloudflared PID $($state.cloudflaredPid) not running. Cleaning up." -ForegroundColor Yellow
    Get-Process cloudflared -ErrorAction SilentlyContinue | Stop-Process -Force
  }
}
Remove-Item $stateFile -Force
Write-Host 'Demo tunnel torn down. Backend + Docker left running.'
