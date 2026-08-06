<#
  stop.ps1  --  stop the local Chatbot stack in one command.

  Stops the backend/frontend dev servers and all containers.
  Uses `docker compose stop` (NOT `down -v`), so all data is kept.
#>
[CmdletBinding()]
param()

$ErrorActionPreference = 'SilentlyContinue'
$root    = $PSScriptRoot
$dockerD = Join-Path $root 'docker'
$backend = Join-Path $root 'myui-backend'

function Step($m) { Write-Host "`n>> $m" -ForegroundColor Cyan }

# Stop the dev servers listening on 7071 (backend) and 5173 (frontend).
Step 'Stopping backend/frontend dev servers...'
foreach ($port in 7071, 5173) {
  try {
    Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue |
      Select-Object -ExpandProperty OwningProcess -Unique |
      ForEach-Object { Stop-Process -Id $_ -Force -ErrorAction SilentlyContinue }
  } catch {}
}

# Stop containers (keep data).
Step 'Stopping app database...'
Push-Location $backend; try { docker compose stop | Out-Null } finally { Pop-Location }

Step 'Stopping RAGFlow stack...'
$composeArgs = @('-f','docker-compose.yml')
if (Test-Path (Join-Path $dockerD 'docker-compose.laptop.yml')) { $composeArgs += @('-f','docker-compose.laptop.yml') }
Push-Location $dockerD
try { docker compose @composeArgs stop | Out-Null } finally { Pop-Location }

Write-Host "`nStopped. Data preserved. Start again with:  .\start.ps1`n" -ForegroundColor Magenta
