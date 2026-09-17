# HUSEHOLD Deployment Script — runs on your LAPTOP
# Builds the React frontend locally, then deploys it + pulls backend changes on the Pi.

param(
    [string]$PiHost = "admin@192.168.178.49",
    [string]$PiPath = "~/husehold"
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $MyInvocation.MyCommand.Path

Write-Host "==> Building frontend locally..." -ForegroundColor Cyan
Push-Location "$root\frontend"
npm run build
Pop-Location

Write-Host "==> Backing up database..." -ForegroundColor Cyan
$backupDir = "$root\backups"
New-Item -ItemType Directory -Force -Path $backupDir | Out-Null
$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
scp "${PiHost}:${PiPath}/backend/db.sqlite3" "$backupDir\db-$timestamp.sqlite3"

Get-ChildItem "$backupDir\db-*.sqlite3" | Sort-Object Name -Descending | Select-Object -Skip 5 | Remove-Item

Write-Host "==> Pulling latest code on Pi..." -ForegroundColor Cyan
ssh $PiHost "cd $PiPath && git pull origin main"

Write-Host "==> Syncing frontend build to Pi..." -ForegroundColor Cyan
ssh $PiHost "rm -rf $PiPath/frontend/dist"
scp -r "$root\frontend\dist" "${PiHost}:${PiPath}/frontend/dist"

Write-Host "==> Running backend deployment on Pi..." -ForegroundColor Cyan
ssh $PiHost "bash $PiPath/deploy.sh"

Write-Host "==> Deployment complete!" -ForegroundColor Green
