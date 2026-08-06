<#
  start.ps1  --  bring the whole Chatbot stack up locally in ONE command.

  Usage (from the project root):
      .\start.ps1

  What it does, in order:
    1. Ensures Docker Desktop is running (launches + waits if not).
    2. Starts RAGFlow + its services WITH the laptop SSL override
       (so the OpenAI API works behind the Trend Micro proxy).
    3. Starts the app's Postgres (chat history / logging).
    4. (Best effort) starts Ollama as the offline model backup.
    5. Starts the backend (:7071) and frontend (:5173) in their own windows.
    6. Opens http://localhost:5173 in your browser.

  Stop everything with:  .\stop.ps1
#>
[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$root     = $PSScriptRoot
$dockerD  = Join-Path $root 'docker'
$backend  = Join-Path $root 'myui-backend'
$frontend = Join-Path $root 'myui'

function Step($m) { Write-Host "`n>> $m" -ForegroundColor Cyan }
function Ok($m)   { Write-Host "   OK  $m" -ForegroundColor Green }
function Note($m) { Write-Host "   ..  $m" -ForegroundColor Yellow }

# === 1. Docker Desktop up? ===================================================
Step 'Checking Docker...'
$dockerOk = $false
try { docker info *> $null; $dockerOk = ($LASTEXITCODE -eq 0) } catch { $dockerOk = $false }
if (-not $dockerOk) {
  Note 'Docker not running - launching Docker Desktop...'
  $dd = Join-Path $env:ProgramFiles 'Docker\Docker\Docker Desktop.exe'
  if (Test-Path $dd) { Start-Process $dd | Out-Null }
  for ($i = 0; $i -lt 60; $i++) {
    Start-Sleep -Seconds 3
    try { docker info *> $null; if ($LASTEXITCODE -eq 0) { $dockerOk = $true; break } } catch {}
    Write-Host '   waiting for Docker engine...' -ForegroundColor DarkGray
  }
  if (-not $dockerOk) { throw 'Docker did not start in time. Open Docker Desktop manually and re-run.' }
}
Ok 'Docker engine is running.'

# === 2. RAGFlow stack (with the laptop SSL override if present) ==============
Step 'Starting RAGFlow + services...'
$composeArgs = @('-f','docker-compose.yml')
if (Test-Path (Join-Path $dockerD 'docker-compose.laptop.yml')) {
  $composeArgs += @('-f','docker-compose.laptop.yml')
  Note 'Applying laptop SSL override (OpenAI API behind the proxy).'
}
Push-Location $dockerD
try {
  docker compose @composeArgs up -d | Out-Null
} finally { Pop-Location }
Ok 'RAGFlow stack up (give it ~1-2 min to fully boot the first time).'

# === 3. App Postgres =========================================================
Step 'Starting app database (Postgres)...'
Push-Location $backend
try { docker compose up -d | Out-Null } finally { Pop-Location }
Ok 'Postgres up.'

# === 4. Ollama (offline model backup - best effort) ==========================
Step 'Starting Ollama (offline backup, optional)...'
try {
  $ollamaUp = $false
  try { Invoke-WebRequest -UseBasicParsing 'http://localhost:11434/api/tags' -TimeoutSec 3 | Out-Null; $ollamaUp = $true } catch {}
  if (-not $ollamaUp -and (Get-Command ollama -ErrorAction SilentlyContinue)) {
    $env:OLLAMA_HOST = '0.0.0.0:11434'
    Start-Process -FilePath 'ollama' -ArgumentList 'serve' -WindowStyle Hidden | Out-Null
    Ok 'Ollama starting.'
  } elseif ($ollamaUp) { Ok 'Ollama already running.' } else { Note 'Ollama not installed - skipping (API mode does not need it).' }
} catch { Note 'Ollama step skipped.' }

# === 5. Backend (:7071) + Frontend (:5173) in their own windows ==============
Step 'Starting backend (:7071) and frontend (:5173)...'
Start-Process -FilePath 'powershell' -ArgumentList @(
  '-NoExit','-Command',"Set-Location '$backend'; Write-Host 'BACKEND :7071' -ForegroundColor Cyan; npm run dev"
) -WindowStyle Minimized | Out-Null

Start-Process -FilePath 'powershell' -ArgumentList @(
  '-NoExit','-Command',"Set-Location '$frontend'; Write-Host 'FRONTEND :5173' -ForegroundColor Cyan; npm run dev"
) -WindowStyle Minimized | Out-Null

# wait for the backend health endpoint
Note 'Waiting for the backend to answer...'
$backendUp = $false
for ($i = 0; $i -lt 40; $i++) {
  Start-Sleep -Milliseconds 800
  try {
    $h = Invoke-WebRequest -UseBasicParsing 'http://localhost:7071/bff/health' -TimeoutSec 3
    if ($h.StatusCode -eq 200) { $backendUp = $true; break }
  } catch {}
}
if ($backendUp) { Ok 'Backend is up.' } else { Note 'Backend still starting - check its window.' }

# wait for the frontend dev server
Note 'Waiting for the frontend...'
$frontUp = $false
for ($i = 0; $i -lt 40; $i++) {
  Start-Sleep -Milliseconds 800
  try {
    $f = Invoke-WebRequest -UseBasicParsing 'http://localhost:5173' -TimeoutSec 3
    if ($f.StatusCode -eq 200) { $frontUp = $true; break }
  } catch {}
}
if ($frontUp) { Ok 'Frontend is up.' } else { Note 'Frontend still starting - check its window.' }

# === 6. Open the browser =====================================================
Start-Process 'http://localhost:5173' | Out-Null

Write-Host "`n=========================================================" -ForegroundColor Magenta
Write-Host "  Chatbot is starting - opening http://localhost:5173"      -ForegroundColor Magenta
Write-Host "  Backend  : http://localhost:7071"                          -ForegroundColor DarkGray
Write-Host "  RAGFlow  : http://localhost:7072 (admin)"                  -ForegroundColor DarkGray
Write-Host "  Stop all : .\stop.ps1"                                     -ForegroundColor DarkGray
Write-Host "=========================================================`n" -ForegroundColor Magenta
