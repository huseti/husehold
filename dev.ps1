# HUSEHOLD Local Dev Script — runs on your LAPTOP
# Optionally refreshes the local dev SQLite DB from the Pi (production), then
# starts the backend and frontend dev servers, each in its own window.

param(
    [string]$PiHost = "admin@192.168.178.49",
    [string]$PiPath = "~/husehold"
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$localDb = "$root\backend\db.sqlite3"
$backupDir = "$root\backups"

Write-Host "==> Lokale Testdatenbank mit der Produktions-DB vom Pi überschreiben?" -ForegroundColor Yellow
Write-Host "    Das ersetzt den Inhalt von backend\db.sqlite3 unwiderruflich (bis auf das lokale Backup unten)." -ForegroundColor Yellow
$answer = Read-Host "    Fortfahren? (y/N)"

if ($answer -eq "y" -or $answer -eq "Y") {
    New-Item -ItemType Directory -Force -Path $backupDir | Out-Null

    if (Test-Path $localDb) {
        Write-Host "==> Sichere aktuelle lokale DB..." -ForegroundColor Cyan
        $timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
        Copy-Item $localDb "$backupDir\local-db-$timestamp.sqlite3"
        Get-ChildItem "$backupDir\local-db-*.sqlite3" | Sort-Object Name -Descending | Select-Object -Skip 2 | Remove-Item
    } else {
        Write-Host "==> Keine lokale DB vorhanden, nichts zu sichern." -ForegroundColor Cyan
    }

    Write-Host "==> Hole Produktions-DB vom Pi..." -ForegroundColor Cyan
    scp "${PiHost}:${PiPath}/backend/db.sqlite3" $localDb

    Write-Host "==> Lokale DB wurde mit der Produktions-DB überschrieben." -ForegroundColor Green
} else {
    Write-Host "==> Überspringe DB-Refresh, starte mit der bestehenden lokalen DB." -ForegroundColor Cyan
}

Write-Host "==> Starte Backend (Django, Port 8000)..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$root\backend'; venv\Scripts\python.exe manage.py runserver"

Write-Host "==> Starte Frontend (Vite, Port 3000)..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$root\frontend'; npm run dev"

Write-Host "==> Beide Dev-Server laufen in eigenen Fenstern." -ForegroundColor Green
