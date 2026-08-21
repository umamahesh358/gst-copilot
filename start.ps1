# ═══════════════════════════════════════════════════════════
# GST Copilot — One-Click Startup Script (PowerShell)
# ═══════════════════════════════════════════════════════════
# Usage: Right-click → "Run with PowerShell"
#    or: powershell -ExecutionPolicy Bypass -File start.ps1
# ═══════════════════════════════════════════════════════════

$ErrorActionPreference = "Stop"
$ROOT = Split-Path -Parent $MyInvocation.MyCommand.Path

Write-Host ""
Write-Host "  ╔═══════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "  ║     GST Copilot — BizOS V5 Startup    ║" -ForegroundColor Cyan
Write-Host "  ╚═══════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

# ─── Step 1: Load .env file ──────────────────────────────
$envFile = Join-Path $ROOT ".env"
if (-Not (Test-Path $envFile)) {
    Write-Host "  [!] No .env file found!" -ForegroundColor Red
    Write-Host "  [>] Creating from .env.example..." -ForegroundColor Yellow
    $exampleFile = Join-Path $ROOT ".env.example"
    if (Test-Path $exampleFile) {
        Copy-Item $exampleFile $envFile
        Write-Host "  [>] Created .env file. Please edit it with your values:" -ForegroundColor Yellow
        Write-Host "      $envFile" -ForegroundColor White
        Write-Host ""
        Write-Host "  Required:" -ForegroundColor Yellow
        Write-Host "    DATABASE_URL  = your PostgreSQL connection string" -ForegroundColor White
        Write-Host "    SESSION_SECRET = 64+ char random hex string" -ForegroundColor White
        Write-Host ""
        Write-Host "  Generate SESSION_SECRET:" -ForegroundColor Yellow
        $secret = node -e "console.log(require('crypto').randomBytes(64).toString('hex'))" 2>$null
        if ($secret) {
            Write-Host "    $secret" -ForegroundColor Green
        }
        Write-Host ""
        Write-Host "  Edit .env and run this script again." -ForegroundColor Cyan
        Read-Host "  Press Enter to exit"
        exit 0
    } else {
        Write-Host "  [!] .env.example not found either. Aborting." -ForegroundColor Red
        exit 1
    }
}

Write-Host "  [1/6] Loading .env file..." -ForegroundColor Cyan
Get-Content $envFile | ForEach-Object {
    $line = $_.Trim()
    if ($line -and -not $line.StartsWith("#") -and $line.Contains("=")) {
        $parts = $line -split "=", 2
        $key = $parts[0].Trim()
        $val = $parts[1].Trim()
        [System.Environment]::SetEnvironmentVariable($key, $val, "Process")
    }
}
Write-Host "  [✓] Environment loaded" -ForegroundColor Green

# ─── Step 2: Validate required vars ─────────────────────
$missing = @()
if (-not $env:DATABASE_URL -or $env:DATABASE_URL -like "*yourpassword*") { $missing += "DATABASE_URL" }
if (-not $env:SESSION_SECRET -or $env:SESSION_SECRET -eq "REPLACE_ME_WITH_64_CHAR_HEX") { $missing += "SESSION_SECRET" }

if ($missing.Count -gt 0) {
    Write-Host ""
    Write-Host "  [!] Missing or placeholder values in .env:" -ForegroundColor Red
    foreach ($var in $missing) {
        Write-Host "      - $var" -ForegroundColor Yellow
    }
    Write-Host ""
    Write-Host "  Edit your .env file: $envFile" -ForegroundColor Cyan
    Read-Host "  Press Enter to exit"
    exit 1
}
Write-Host "  [2/6] Environment validated" -ForegroundColor Green

# ─── Step 3: Check prerequisites ────────────────────────
Write-Host "  [3/6] Checking prerequisites..." -ForegroundColor Cyan

$nodeVersion = & node -v 2>$null
if (-not $nodeVersion) {
    Write-Host "  [!] Node.js not found. Install from https://nodejs.org" -ForegroundColor Red
    exit 1
}
Write-Host "        Node.js: $nodeVersion" -ForegroundColor DarkGray

$pnpmVersion = & pnpm -v 2>$null
if (-not $pnpmVersion) {
    Write-Host "  [!] pnpm not found. Installing..." -ForegroundColor Yellow
    npm install -g pnpm
    $pnpmVersion = & pnpm -v 2>$null
}
Write-Host "        pnpm:    v$pnpmVersion" -ForegroundColor DarkGray
Write-Host "  [✓] Prerequisites OK" -ForegroundColor Green

# ─── Step 4: Install dependencies ───────────────────────
Write-Host "  [4/6] Installing dependencies..." -ForegroundColor Cyan
Set-Location $ROOT
& pnpm install --frozen-lockfile 2>$null
if ($LASTEXITCODE -ne 0) {
    Write-Host "        Lockfile changed, running full install..." -ForegroundColor DarkGray
    & pnpm install
}
Write-Host "  [✓] Dependencies installed" -ForegroundColor Green

# ─── Step 5: Push database schema ───────────────────────
Write-Host "  [5/6] Pushing database schema (38 tables)..." -ForegroundColor Cyan
Set-Location (Join-Path $ROOT "lib\db")
& pnpm run push 2>&1 | ForEach-Object { Write-Host "        $_" -ForegroundColor DarkGray }
if ($LASTEXITCODE -ne 0) {
    Write-Host "  [!] Schema push failed. Check DATABASE_URL in .env" -ForegroundColor Red
    Write-Host "  [!] Make sure PostgreSQL is running and the database exists." -ForegroundColor Yellow
    Read-Host "  Press Enter to exit"
    exit 1
}
Write-Host "  [✓] Database schema ready" -ForegroundColor Green

# ─── Step 6: Start servers ──────────────────────────────
Write-Host "  [6/6] Starting servers..." -ForegroundColor Cyan
Write-Host ""

# Set ports
$env:PORT = if ($env:PORT) { $env:PORT } else { "3000" }
$apiPort = $env:PORT

# Start API server in background
Write-Host "  [>] API Server starting on port $apiPort..." -ForegroundColor Cyan
Set-Location (Join-Path $ROOT "artifacts\api-server")
$apiJob = Start-Job -ScriptBlock {
    param($rootPath, $envFile)
    # Reload env
    Get-Content $envFile | ForEach-Object {
        $line = $_.Trim()
        if ($line -and -not $line.StartsWith("#") -and $line.Contains("=")) {
            $parts = $line -split "=", 2
            [System.Environment]::SetEnvironmentVariable($parts[0].Trim(), $parts[1].Trim(), "Process")
        }
    }
    $env:NODE_ENV = "development"
    Set-Location (Join-Path $rootPath "artifacts\api-server")
    & pnpm run dev 2>&1
} -ArgumentList $ROOT, $envFile

Start-Sleep -Seconds 3

# Start frontend
Write-Host "  [>] Frontend starting on port 5173..." -ForegroundColor Cyan
$env:PORT = "5173"
$env:BASE_PATH = "/erp-app"
Set-Location (Join-Path $ROOT "artifacts\erp-app")

Write-Host ""
Write-Host "  ╔═══════════════════════════════════════════╗" -ForegroundColor Green
Write-Host "  ║  GST Copilot is starting!                 ║" -ForegroundColor Green
Write-Host "  ║                                           ║" -ForegroundColor Green
Write-Host "  ║  Frontend: http://localhost:5173/erp-app/  ║" -ForegroundColor Green
Write-Host "  ║  API:      http://localhost:${apiPort}/api/   ║" -ForegroundColor Green
Write-Host "  ║                                           ║" -ForegroundColor Green
Write-Host "  ║  Press Ctrl+C to stop all servers         ║" -ForegroundColor Green
Write-Host "  ╚═══════════════════════════════════════════╝" -ForegroundColor Green
Write-Host ""

# Run frontend in foreground (blocks until Ctrl+C)
try {
    & pnpm run dev
} finally {
    # Cleanup: stop API server
    Write-Host ""
    Write-Host "  [>] Stopping API server..." -ForegroundColor Yellow
    Stop-Job $apiJob -ErrorAction SilentlyContinue
    Remove-Job $apiJob -ErrorAction SilentlyContinue
    Write-Host "  [✓] All servers stopped." -ForegroundColor Green
}
