<#
.SYNOPSIS
    Generate 6 cryptographically secure QR secrets for Prague Explorer caches.

.DESCRIPTION
    Writes secrets to:
      .env              — CACHE_N_QR_SECRET vars (gitignored, for record-keeping)
      scripts/qr-secrets.json — consumed by scripts/print-qrs.html

    Refuses to run if either output file would be committed to git.
    Refuses to overwrite existing secrets unless -Force is passed.

.PARAMETER Force
    Overwrite existing secrets. WARNING: invalidates all printed QR codes.

.EXAMPLE
    .\scripts\generate-qr-secrets.ps1
    .\scripts\generate-qr-secrets.ps1 -Force
#>
param(
    [switch]$Force
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

# ── Verify both output files are gitignored ──────────────────────────────────

$gitignorePath = Join-Path $PSScriptRoot ".." ".gitignore"
if (-not (Test-Path $gitignorePath)) {
    Write-Error "Could not find .gitignore at $gitignorePath. Run from repo root."
    exit 1
}

$gitignoreContent = Get-Content $gitignorePath -Raw

if (-not ($gitignoreContent -match "qr-secrets\.json")) {
    Write-Error "scripts/qr-secrets.json must be listed in .gitignore before running this script."
    exit 1
}
if (-not ($gitignoreContent -match "(?m)^\.env\r?$")) {
    Write-Error ".env must be listed in .gitignore before running this script."
    exit 1
}

# ── Idempotency check ─────────────────────────────────────────────────────────

$envPath = Join-Path $PSScriptRoot ".." ".env"
if (Test-Path $envPath) {
    $envContent = Get-Content $envPath -Raw -ErrorAction SilentlyContinue
    if ($envContent -match "CACHE_1_QR_SECRET=\S") {
        if (-not $Force) {
            Write-Error @"
QR secrets already exist in .env.
Use -Force to regenerate.
WARNING: -Force will invalidate all printed QR codes.
"@
            exit 1
        }
        Write-Warning "-Force specified. Existing secrets will be overwritten. Printed QR codes will be invalid."
    }
}

# ── Generate 6 cryptographically secure 32-byte secrets ──────────────────────

$rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
$secrets = @{}
$caches = @(
    @{ Id = 1; NameCz = "Vysehrad";               NameEn = "Vysehrad Fortress" },
    @{ Id = 2; NameCz = "Narodni trida";           NameEn = "Narodni Street — Velvet Revolution" },
    @{ Id = 3; NameCz = "Staromestske namesti";    NameEn = "Old Town Square" },
    @{ Id = 4; NameCz = "Zizkovsky televizni vysilac"; NameEn = "Zizkov TV Tower" },
    @{ Id = 5; NameCz = "Letenska plan — Metronom"; NameEn = "Letna Plain — Metronome" },
    @{ Id = 6; NameCz = "Kampa — Lennonova zed";  NameEn = "Kampa — Lennon Wall" }
)

foreach ($cache in $caches) {
    $bytes = New-Object byte[] 32
    $rng.GetBytes($bytes)
    $secrets[$cache.Id] = ([System.BitConverter]::ToString($bytes) -replace "-", "").ToLower()
}
$rng.Dispose()

# ── Write to .env (append or replace existing CACHE_*_QR_SECRET lines) ───────

$newEnvLines = 1..6 | ForEach-Object { "CACHE_${_}_QR_SECRET=$($secrets[$_])" }

if (Test-Path $envPath) {
    $existing = Get-Content $envPath | Where-Object { $_ -notmatch "^CACHE_\d+_QR_SECRET=" }
    $updated = $existing + $newEnvLines
    Set-Content $envPath ($updated -join "`n") -Encoding utf8NoBOM
} else {
    Set-Content $envPath ($newEnvLines -join "`n") -Encoding utf8NoBOM
}

# ── Write to scripts/qr-secrets.json ─────────────────────────────────────────

$jsonCaches = $caches | ForEach-Object {
    $id = $_.Id
    [PSCustomObject]@{
        id           = $id
        nameCz       = $_.NameCz
        nameEn       = $_.NameEn
        qrValue      = "${id}:$($secrets[$id])"
        secretPreview = $secrets[$id].Substring(0, 4)
    }
}

$json = [PSCustomObject]@{
    generated = (Get-Date -Format "yyyy-MM-dd HH:mm:ss")
    warning   = "DO NOT COMMIT. Contains QR secrets. Gitignored."
    caches    = $jsonCaches
}

$jsonPath = Join-Path $PSScriptRoot "qr-secrets.json"
$json | ConvertTo-Json -Depth 4 | Set-Content $jsonPath -Encoding utf8NoBOM

# ── Confirmation — first 4 hex chars only (never print full secrets) ──────────

Write-Host ""
Write-Host "QR secrets generated successfully." -ForegroundColor Green
Write-Host ""
Write-Host "Cache  Preview  (first 4 chars — verify these match the print page)"
Write-Host "─────  ───────"
foreach ($id in 1..6) {
    Write-Host "  $id      $($secrets[$id].Substring(0, 4))..."
}
Write-Host ""
Write-Host "Files written (both gitignored — do not commit):"
Write-Host "  .env                    — CACHE_N_QR_SECRET vars"
Write-Host "  scripts/qr-secrets.json — for scripts/print-qrs.html"
Write-Host ""
Write-Host "NEXT STEP: Run 'npx serve scripts/' and open http://localhost:3000/print-qrs.html" -ForegroundColor Cyan
Write-Host ""
Write-Warning "Regenerating secrets after printing invalidates all physical QR codes."
