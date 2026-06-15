# Run this from the myui folder:
#   cd C:\Users\prajjwal.kushwaha\Documents\CODE\BDchatbot\ragflow\myui
#   .\setup-ref.ps1

$root = "_ref"

# Create folders
New-Item -ItemType Directory -Force -Path $root | Out-Null
New-Item -ItemType Directory -Force -Path "$root\dark-ai-chat-ui" | Out-Null
New-Item -ItemType Directory -Force -Path "$root\screenshots" | Out-Null

# Ensure _ref is gitignored (append only if not already present)
$gi = ".gitignore"
if (-not (Test-Path $gi)) { New-Item -ItemType File -Path $gi | Out-Null }
if (-not (Select-String -Path $gi -Pattern '^\s*_ref/?\s*$' -Quiet)) {
    Add-Content -Path $gi -Value "`n# UI reference material (not for commit)`n_ref/"
    Write-Host "Added _ref/ to .gitignore"
} else {
    Write-Host "_ref/ already in .gitignore"
}

Write-Host ""
Write-Host "Folder structure created:" -ForegroundColor Green
Write-Host "  _ref/"
Write-Host "  _ref/dark-ai-chat-ui/"
Write-Host "  _ref/screenshots/"
Write-Host ""
Write-Host "Now drop these in manually:" -ForegroundColor Yellow
Write-Host "  _ref/Strands.jsx              <- from the React Bits doc"
Write-Host "  _ref/Strands.css              <- from the React Bits doc"
Write-Host "  _ref/dark-ai-chat-ui/...      <- unzip the reference UI here (components/, app/globals.css, etc.)"
Write-Host "  _ref/screenshots/*.png        <- optional, a few key screenshots"
