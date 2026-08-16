param(
    [switch]$Headless,
    [switch]$NoBrowser,
    [switch]$Rebuild
)
$ErrorActionPreference = "Stop"
$ScriptRoot = Split-Path -Parent $PSCommandPath
$Port = 11136
$Host.UI.RawUI.WindowTitle = "multi-gpu-cluster-recipes - playbook :$Port"

if (-not $Headless) {
    Write-Host ""
    Write-Host "  Multi-GPU Cluster Recipes - Playbook" -ForegroundColor Cyan
    Write-Host "  LOCAL    http://127.0.0.1:$Port   (static build)" -ForegroundColor Gray
    Write-Host "  PUBLIC   https://goliath.tailfab45.ts.net/multigpu/  (tailscale funnel)" -ForegroundColor Gray
    Write-Host ""
}

# Port zombie clearing
Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue |
    ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }

# Build the funnel variant (baseUrl "/") when missing or stale
$website = Join-Path $ScriptRoot "website"
$buildDir = Join-Path $website "build-funnel"
$newestDoc = Get-ChildItem (Join-Path $ScriptRoot "docs") -Recurse -File -Filter *.md |
    Sort-Object LastWriteTime -Descending | Select-Object -First 1
$needsBuild = $Rebuild -or -not (Test-Path $buildDir) -or
    ($newestDoc -and $newestDoc.LastWriteTime -gt (Get-Item $buildDir -ErrorAction SilentlyContinue).LastWriteTime)
if ($needsBuild) {
    Write-Host "-> Building site (BASE_URL=/)..." -ForegroundColor Yellow
    $npm = (Get-Command npm.cmd -ErrorAction SilentlyContinue).Source
    if (-not $npm) { throw "npm.cmd not found on PATH" }
    Push-Location $website
    $env:BASE_URL = "/"
    & $npm run build -- --out-dir build-funnel
    $buildExit = $LASTEXITCODE
    Remove-Item Env:BASE_URL -ErrorAction SilentlyContinue
    Pop-Location
    if ($buildExit -ne 0) { throw "Site build failed (exit $buildExit)" }
    Write-Host "   Build OK" -ForegroundColor Green
}

# Serve the static build
$py = Get-Command py -ErrorAction SilentlyContinue
if (-not $py) { throw "Python launcher 'py' not found - required for the static server" }
$serverJob = Start-Job -Name "playbook-server" -ScriptBlock {
    param($Dir, $Port)
    Set-Location $Dir
    py -m http.server $Port --bind 127.0.0.1 --directory $Dir
} -ArgumentList $buildDir, $Port

# Readiness poll
for ($i = 0; $i -lt 30; $i++) {
    try {
        $r = Invoke-WebRequest -Uri "http://127.0.0.1:$Port/" -TimeoutSec 2 -UseBasicParsing -ErrorAction Stop
        if ($r.StatusCode -eq 200) { break }
    } catch { }
    Start-Sleep 1
}

if (-not $Headless -and -not $NoBrowser) {
    Start-Process "http://127.0.0.1:$Port"
}

Write-Host "Serving playbook at http://127.0.0.1:$Port  (Ctrl+C to stop)" -ForegroundColor Green
try {
    while ($true) {
        if ($serverJob.State -eq "Failed") {
            Receive-Job $serverJob
            break
        }
        Start-Sleep 5
    }
} finally {
    Stop-Job $serverJob -ErrorAction SilentlyContinue
    Remove-Job $serverJob -Force -ErrorAction SilentlyContinue
}
