# Publica los cambios en GitHub con un solo doble clic
Set-Location $PSScriptRoot

$changes = git status --porcelain
if (-not $changes) {
    Write-Host "Sin cambios para publicar." -ForegroundColor Yellow
    Read-Host "Presioná Enter para cerrar"
    exit
}

Write-Host "Cambios detectados:" -ForegroundColor Cyan
git status --short

$msg = Read-Host "`nDescripcion del cambio (Enter = 'Actualizar app')"
if (-not $msg) { $msg = "Actualizar app" }

git add .
git commit -m $msg
git push

Write-Host "`n✅ Publicado en GitHub correctamente." -ForegroundColor Green
Read-Host "Presioná Enter para cerrar"
