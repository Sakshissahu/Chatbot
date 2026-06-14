<#
  start-demo.ps1  -  bring the IB Group chat demo online in one command.

  What it does (in order):
    1. Makes sure the local backend (:8088) is up (starts it if not).
    2. Opens a fresh Cloudflare quick-tunnel to the backend and captures the
       new https://*.trycloudflare.com public URL.
    3. Points the Vercel frontend at that tunnel (sets the VITE_BACKEND_URL
       production env var) and triggers a production redeploy.
    4. Prints the live link to share with teammates.

  The tunnel URL changes every run - that is why this script re-points Vercel
  and redeploys each time. The backend CORS allow-list already accepts
  *.vercel.app, so nothing on the backend side changes per demo.

  PREREQUISITES (one-time, done by a human - see DEMO.md):
    - Docker stack running (RAGFlow :80, ibchat_postgres :5442) - see START_HERE.txt
    - vercel login   (once, in a browser)
    - vercel link    (once, inside .\myui - creates/links the Vercel project)

  Usage:
    .\start-demo.ps1                 # full: tunnel + Vercel redeploy
    .\start-demo.ps1 -TunnelOnly     # just the tunnel (no Vercel step)
    .\start-demo.ps1 -NoRedeploy     # set the env var but skip the redeploy
#>
[CmdletBinding()]
param(
  [switch]$TunnelOnly,
  [switch]$NoRedeploy
)

$ErrorActionPreference = 'Stop'
$root      = $PSScriptRoot
$backend   = Join-Path $root 'myui-backend'
$frontend  = Join-Path $root 'myui'
$stateFile = Join-Path $env:TEMP 'ibchat-demo-state.json'
$tunnelLog = Join-Path $env:TEMP 'ibchat-cloudflared.log'

function Write-Step($n, $msg) { Write-Host "`n[$n] $msg" -ForegroundColor Cyan }
function Write-Ok($msg)       { Write-Host "    OK  $msg" -ForegroundColor Green }
function Write-Note($msg)     { Write-Host "    !!  $msg" -ForegroundColor Yellow }

# --- locate cloudflared (PATH, else the standalone copy under LOCALAPPDATA) ---
function Get-Cloudflared {
  $c = Get-Command cloudflared -ErrorAction SilentlyContinue
  if ($c) { return $c.Source }
  $fallback = Join-Path $env:LOCALAPPDATA 'cloudflared\cloudflared.exe'
  if (Test-Path $fallback) { return $fallback }
  throw "cloudflared not found. Install it, or place cloudflared.exe at $fallback"
}

# === 1. backend up? ==========================================================
Write-Step 1 'Checking the local backend (:8088)...'
$backendUp = $false
try {
  $h = Invoke-WebRequest -UseBasicParsing -Uri 'http://localhost:8088/bff/health' -TimeoutSec 4
  $backendUp = ($h.StatusCode -eq 200)
} catch { $backendUp = $false }

if ($backendUp) {
  Write-Ok 'backend already running.'
} else {
  Write-Note 'backend not responding - starting it (npm start) in a new window...'
  Start-Process -FilePath 'powershell' -ArgumentList @(
    '-NoExit','-Command',"Set-Location '$backend'; npm start"
  ) -WindowStyle Minimized | Out-Null
  for ($i = 0; $i -lt 30; $i++) {
    Start-Sleep -Milliseconds 700
    try {
      $h = Invoke-WebRequest -UseBasicParsing -Uri 'http://localhost:8088/bff/health' -TimeoutSec 3
      if ($h.StatusCode -eq 200) { $backendUp = $true; break }
    } catch {}
  }
  if ($backendUp) { Write-Ok 'backend is up.' } else { throw 'backend did not come up - check the new window / Docker stack.' }
}
$health = (Invoke-WebRequest -UseBasicParsing -Uri 'http://localhost:8088/bff/health' -TimeoutSec 4).Content
Write-Ok "health: $health"

# === 2. open the tunnel ======================================================
Write-Step 2 'Opening a Cloudflare quick-tunnel to :8088...'
$cf = Get-Cloudflared
Write-Ok "cloudflared: $cf"
if (Test-Path $tunnelLog) { Remove-Item $tunnelLog -Force }

$proc = Start-Process -FilePath $cf `
  -ArgumentList @('tunnel','--no-autoupdate','--url','http://localhost:8088') `
  -RedirectStandardError $tunnelLog -RedirectStandardOutput "$tunnelLog.out" `
  -WindowStyle Hidden -PassThru

$tunnelUrl = $null
for ($i = 0; $i -lt 40; $i++) {
  Start-Sleep -Milliseconds 700
  if (Test-Path $tunnelLog) {
    $m = Select-String -Path $tunnelLog -Pattern 'https://[a-z0-9-]+\.trycloudflare\.com' -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($m) { $tunnelUrl = $m.Matches[0].Value; break }
  }
}
if (-not $tunnelUrl) {
  try { Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue } catch {}
  throw "Could not capture the tunnel URL. See $tunnelLog"
}
Write-Ok "tunnel: $tunnelUrl  (cloudflared PID $($proc.Id))"

# Smoke-test the tunnel before wiring Vercel to it.
$tunHost = ([Uri]$tunnelUrl).Host
try {
  $t = Invoke-WebRequest -UseBasicParsing -Uri "$tunnelUrl/bff/health" -TimeoutSec 10
  Write-Ok "tunnel health: $($t.Content)"
} catch {
  # Local DNS sometimes lags on brand-new *.trycloudflare.com names. Confirm the
  # name resolves on a public resolver - if so, the tunnel is live for everyone.
  try {
    $gl = Resolve-DnsName -Name $tunHost -Server 1.1.1.1 -Type A -ErrorAction Stop
    Write-Note "tunnel is LIVE globally ($($gl[0].IPAddress)) but THIS PC's DNS hasn't caught up."
    Write-Note "Teammates and Vercel are unaffected. To test from this PC: wait ~1 min or set DNS to 1.1.1.1."
  } catch {
    Write-Note "tunnel not reachable yet: $($_.Exception.Message)"
  }
}

# Persist state so stop-demo.ps1 can tear it down.
@{ tunnelUrl = $tunnelUrl; cloudflaredPid = $proc.Id; startedAt = (Get-Date).ToString('o') } |
  ConvertTo-Json | Set-Content -Path $stateFile -Encoding utf8

if ($TunnelOnly) {
  Write-Host "`nTunnel only. Backend is public at:" -ForegroundColor Magenta
  Write-Host "  $tunnelUrl" -ForegroundColor White
  Write-Host "Stop it with:  .\stop-demo.ps1`n"
  return
}

# === 3. point Vercel at the tunnel + redeploy ================================
Write-Step 3 'Pointing the Vercel frontend at the tunnel (VITE_BACKEND_URL)...'
Push-Location $frontend
try {
  if (-not (Test-Path (Join-Path $frontend '.vercel\project.json'))) {
    Write-Note 'This project is not linked to Vercel yet.'
    Write-Note 'Run once:   cd myui ;  vercel login ;  vercel link'
    Write-Note "Then re-run start-demo.ps1.  Tunnel stays up at: $tunnelUrl"
    return
  }

  # Replace the production VITE_BACKEND_URL with the new tunnel URL.
  Write-Host '    updating production env var...'
  & vercel env rm VITE_BACKEND_URL production --yes 2>$null | Out-Null
  $tunnelUrl | & vercel env add VITE_BACKEND_URL production | Out-Null
  Write-Ok "VITE_BACKEND_URL (production) = $tunnelUrl"

  if ($NoRedeploy) {
    Write-Note 'Skipping redeploy (-NoRedeploy). Run: vercel deploy --prod  in .\myui to apply.'
    return
  }

  Write-Step 4 'Building + deploying to Vercel production...'
  $deployOut = & vercel deploy --prod --yes 2>&1
  $deployOut | ForEach-Object { Write-Host "    $_" }
  $liveUrl = ($deployOut | Select-String -Pattern 'https://[a-z0-9.-]+\.vercel\.app' -AllMatches |
              ForEach-Object { $_.Matches.Value } | Select-Object -Last 1)

  Write-Host "`n=========================================================" -ForegroundColor Magenta
  Write-Host "  DEMO IS LIVE - share this link:" -ForegroundColor Magenta
  if ($liveUrl) { Write-Host "    $liveUrl" -ForegroundColor White }
  else { Write-Host "    (see the Production URL in the output above)" -ForegroundColor White }
  Write-Host "  backend tunnel : $tunnelUrl" -ForegroundColor DarkGray
  Write-Host "  stop the demo  : .\stop-demo.ps1" -ForegroundColor DarkGray
  Write-Host "=========================================================`n" -ForegroundColor Magenta
}
finally {
  Pop-Location
}
