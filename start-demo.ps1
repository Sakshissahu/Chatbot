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

# A previous run leaves a cloudflared process that keeps the log file open. Every
# run rotates to a brand-new tunnel anyway, so stop the previously-tracked tunnel
# first - this releases the log handle (otherwise the Remove-Item below throws
# "file is being used by another process" and aborts the whole run).
if (Test-Path $stateFile) {
  try {
    $prev = Get-Content $stateFile -Raw | ConvertFrom-Json
    if ($prev.cloudflaredPid) {
      $old = Get-Process -Id $prev.cloudflaredPid -ErrorAction SilentlyContinue
      if ($old -and $old.ProcessName -eq 'cloudflared') {
        Write-Note "stopping previous tunnel (PID $($prev.cloudflaredPid))..."
        Stop-Process -Id $prev.cloudflaredPid -Force -ErrorAction SilentlyContinue
        Start-Sleep -Milliseconds 600
      }
    }
  } catch { }
}
# Remove the old log; if a handle still lingers, fall back to a unique log name
# so a stale lock can never block the run.
if (Test-Path $tunnelLog) {
  try { Remove-Item $tunnelLog -Force -ErrorAction Stop }
  catch { $tunnelLog = Join-Path $env:TEMP ("ibchat-cloudflared-{0}.log" -f (Get-Date -Format 'yyyyMMddHHmmss')) }
}

# Quick-tunnel registration can transiently fail ("failed to request quick
# Tunnel: ... context deadline exceeded"), so retry the whole launch a few times.
# The URL pattern requires a hyphenated multi-word host, so we never mis-capture
# the API endpoint (api.trycloudflare.com) that shows up in cloudflared's
# diagnostic/error lines.
$urlPattern = 'https://[a-z0-9]+(?:-[a-z0-9]+)+\.trycloudflare\.com'
$tunnelUrl  = $null
$proc       = $null
for ($attempt = 1; $attempt -le 3 -and -not $tunnelUrl; $attempt++) {
  if ($attempt -gt 1) {
    Write-Note "tunnel registration failed - retrying (attempt $attempt/3)..."
    $tunnelLog = Join-Path $env:TEMP ("ibchat-cloudflared-{0}-{1}.log" -f (Get-Date -Format 'yyyyMMddHHmmss'), $attempt)
  }
  $proc = Start-Process -FilePath $cf `
    -ArgumentList @('tunnel','--no-autoupdate','--url','http://localhost:8088') `
    -RedirectStandardError $tunnelLog -RedirectStandardOutput "$tunnelLog.out" `
    -WindowStyle Hidden -PassThru

  for ($i = 0; $i -lt 30; $i++) {
    Start-Sleep -Milliseconds 1000
    if (Test-Path $tunnelLog) {
      $m = Select-String -Path $tunnelLog -Pattern $urlPattern -ErrorAction SilentlyContinue | Select-Object -First 1
      if ($m) { $tunnelUrl = $m.Matches[0].Value; break }
      if (Select-String -Path $tunnelLog -Pattern 'failed to request quick Tunnel' -ErrorAction SilentlyContinue) { break }
    }
  }
  if (-not $tunnelUrl) {
    try { Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue } catch {}
    Start-Sleep -Milliseconds 800
  }
}
if (-not $tunnelUrl) {
  throw "Could not establish a Cloudflare quick-tunnel after 3 attempts. See $tunnelLog"
}
Write-Ok "tunnel: $tunnelUrl  (cloudflared PID $($proc.Id))"

# Smoke-test the tunnel before wiring Vercel to it. Brand-new *.trycloudflare.com
# names take a few seconds for DNS to propagate locally, so POLL for up to ~45s
# rather than failing on the first (too-early) attempt.
$tunHost = ([Uri]$tunnelUrl).Host
$tunnelReady = $false
Write-Host '    waiting for the tunnel to become reachable (up to ~45s)...'
for ($i = 0; $i -lt 30; $i++) {
  try {
    $t = Invoke-WebRequest -UseBasicParsing -Uri "$tunnelUrl/bff/health" -TimeoutSec 5
    if ($t.StatusCode -eq 200) {
      Write-Ok "tunnel health (ready after ~$([int]($i*1.5))s): $($t.Content)"
      $tunnelReady = $true
      break
    }
  } catch { }
  Start-Sleep -Milliseconds 1500
}
if (-not $tunnelReady) {
  # Local DNS sometimes lags on brand-new names. Confirm the name resolves on a
  # public resolver - if so, the tunnel is live for everyone (incl. Vercel) and we
  # must NOT abort the deploy just because THIS PC's resolver hasn't caught up.
  try {
    $gl = Resolve-DnsName -Name $tunHost -Server 1.1.1.1 -Type A -ErrorAction Stop
    Write-Note "tunnel is LIVE globally ($($gl[0].IPAddress)) but THIS PC's DNS hasn't caught up - continuing."
    Write-Note "Teammates and Vercel are unaffected. To test from this PC: wait ~1 min or set DNS to 1.1.1.1."
  } catch {
    Write-Note "tunnel not reachable from THIS PC yet (DNS still propagating): $($_.Exception.Message)"
    Write-Note "Continuing anyway - quick-tunnels are typically live globally within a minute."
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
# Every `vercel` call below MUST run with .\myui as the working directory, because
# that is where .vercel\project.json (the project link) lives. Push-Location moves
# the PowerShell location; we ALSO sync [Environment]::CurrentDirectory so the native
# `vercel` child process inherits .\myui as its CWD on every host. Without this sync,
# the CLI can resolve against the ragflow root instead and fail at the Vercel step
# ("project not linked" / wrong scope), which is exactly what used to break here.
Write-Step 3 'Pointing the Vercel frontend at the tunnel (VITE_BACKEND_URL)...'
$prevEnvCwd = [Environment]::CurrentDirectory
$prevEAP    = $ErrorActionPreference
Push-Location $frontend
[Environment]::CurrentDirectory = (Get-Location).ProviderPath
try {
  # `vercel` resolves to a node-backed .ps1 shim that writes progress/hints to
  # stderr; under ErrorActionPreference='Stop' any such stderr write raises a
  # terminating NativeCommandError and aborts the whole script. Relax to
  # 'Continue' for the Vercel calls and gate success on $LASTEXITCODE instead.
  $ErrorActionPreference = 'Continue'

  if (-not (Test-Path (Join-Path $frontend '.vercel\project.json'))) {
    Write-Note 'This project is not linked to Vercel yet.'
    Write-Note 'Run once:   cd myui ;  vercel login ;  vercel link'
    Write-Note "Then re-run start-demo.ps1.  Tunnel stays up at: $tunnelUrl"
    return
  }

  # Idempotently SET the production VITE_BACKEND_URL to the new tunnel URL.
  # `env rm` first clears any existing value (a harmless no-op the first time -
  # its "not found" output is discarded) so the following `env add` never errors
  # with "already exists". The value is piped to `env add` via stdin (non-interactive).
  Write-Host '    updating production env var (VITE_BACKEND_URL)...'
  & vercel env rm VITE_BACKEND_URL production --yes 2>$null | Out-Null
  $tunnelUrl | & vercel env add VITE_BACKEND_URL production 2>$null | Out-Null
  if ($LASTEXITCODE -ne 0) {
    throw "Failed to set VITE_BACKEND_URL on Vercel (env add exit $LASTEXITCODE)."
  }
  Write-Ok "VITE_BACKEND_URL (production) = $tunnelUrl"

  if ($NoRedeploy) {
    Write-Note 'Skipping redeploy (-NoRedeploy). Run: vercel deploy --prod  in .\myui to apply.'
    return
  }

  Write-Step 4 'Building + deploying to Vercel production...'
  $deployOut = (& vercel deploy --prod --yes 2>&1 | ForEach-Object { "$_" })
  $deployExit = $LASTEXITCODE
  $deployOut | ForEach-Object { Write-Host "    $_" }
  if ($deployExit -ne 0) {
    throw "vercel deploy failed (exit $deployExit). See the output above."
  }
  $liveUrl = "https://ib-chatbot-six.vercel.app"

  Write-Host "`n=========================================================" -ForegroundColor Magenta
  Write-Host "  DEMO IS LIVE - share this link:" -ForegroundColor Magenta
  if ($liveUrl) { Write-Host "    $liveUrl" -ForegroundColor White }
  else { Write-Host "    (see the Production URL in the output above)" -ForegroundColor White }
  Write-Host "  backend tunnel : $tunnelUrl" -ForegroundColor DarkGray
  Write-Host "  stop the demo  : .\stop-demo.ps1" -ForegroundColor DarkGray
  Write-Host "=========================================================`n" -ForegroundColor Magenta
}
finally {
  $ErrorActionPreference = $prevEAP
  [Environment]::CurrentDirectory = $prevEnvCwd
  Pop-Location
}
