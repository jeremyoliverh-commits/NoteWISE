# NoteWise AI - Quick Start Script
Write-Host "🌿 NoteWise AI - Starting up..." -ForegroundColor Green
Write-Host ""

# Check if node exists
$nodePath = "C:\Program Files\nodejs\node.exe"
if (-not (Test-Path $nodePath)) {
    Write-Host "❌ Node.js not found at $nodePath" -ForegroundColor Red
    Write-Host "Please install Node.js from https://nodejs.org" -ForegroundColor Yellow
    exit 1
}

# Navigate to backend
$backendPath = Join-Path $PSScriptRoot "backend"
Set-Location $backendPath

# Install dependencies if needed
if (-not (Test-Path (Join-Path $backendPath "node_modules"))) {
    Write-Host "📦 Installing dependencies..." -ForegroundColor Yellow
    & $nodePath (Join-Path (Split-Path $nodePath) "npm.cmd") install
}

Write-Host "🚀 Server starting at http://localhost:3001" -ForegroundColor Green
Write-Host "🌍 Open your browser to http://localhost:3001" -ForegroundColor Cyan
Write-Host ""
Write-Host "📝 NOTE: For AI features, set your OpenAI API key in backend\.env" -ForegroundColor Yellow
Write-Host ""

# Start the server
& $nodePath server.js
