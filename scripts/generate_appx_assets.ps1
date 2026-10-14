# ==============================================================================
# Script de geração automatizada de assets para Microsoft Store / MSIX / AppX
# Converte build/icon.png em todos os formatos exigidos pelo Windows AppX Manifest
# ==============================================================================

param (
    [string]$SourceIcon = "$PSScriptRoot\..\build\icon.png",
    [string]$OutputDir = "$PSScriptRoot\..\build\appx"
)

Add-Type -AssemblyName System.Drawing

if (-not (Test-Path $SourceIcon)) {
    Write-Error "[MSIX Assets] Arquivo de icone fonte nao encontrado: $SourceIcon"
    exit 1
}

if (-not (Test-Path $OutputDir)) {
    New-Item -ItemType Directory -Path $OutputDir -Force | Out-Null
}

$sourceBitmap = [System.Drawing.Bitmap]::FromFile($SourceIcon)

function Resize-CanvasImage {
    param (
        [int]$CanvasWidth,
        [int]$CanvasHeight,
        [int]$IconWidth,
        [int]$IconHeight,
        [string]$OutputFile,
        [System.Drawing.Color]$BgColor = [System.Drawing.Color]::Transparent
    )

    $targetBitmap = New-Object System.Drawing.Bitmap($CanvasWidth, $CanvasHeight)
    $graphics = [System.Drawing.Graphics]::FromImage($targetBitmap)
    
    $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $graphics.Clear($BgColor)

    $destX = [int][Math]::Round(($CanvasWidth - $IconWidth) / 2)
    $destY = [int][Math]::Round(($CanvasHeight - $IconHeight) / 2)

    $graphics.DrawImage($sourceBitmap, $destX, $destY, $IconWidth, $IconHeight)
    $graphics.Dispose()

    $targetBitmap.Save($OutputFile, [System.Drawing.Imaging.ImageFormat]::Png)
    $targetBitmap.Dispose()
    Write-Host "  -> Gerado: $(Split-Path $OutputFile -Leaf) ($CanvasWidth x $CanvasHeight)"
}

Write-Host "[MSIX Assets] Gerando imagens de exibicao para o pacote MSIX..." -ForegroundColor Cyan

# 1. Square44x44Logo.png (App list icon)
Resize-CanvasImage -CanvasWidth 44 -CanvasHeight 44 -IconWidth 44 -IconHeight 44 -OutputFile "$OutputDir\Square44x44Logo.png"

# 2. Square150x150Logo.png (Medium tile)
Resize-CanvasImage -CanvasWidth 150 -CanvasHeight 150 -IconWidth 150 -IconHeight 150 -OutputFile "$OutputDir\Square150x150Logo.png"

# 3. Wide310x150Logo.png (Wide tile)
Resize-CanvasImage -CanvasWidth 310 -CanvasHeight 150 -IconWidth 150 -IconHeight 150 -OutputFile "$OutputDir\Wide310x150Logo.png"

# 4. StoreLogo.png (50x50 - Loja)
Resize-CanvasImage -CanvasWidth 50 -CanvasHeight 50 -IconWidth 50 -IconHeight 50 -OutputFile "$OutputDir\StoreLogo.png"

# 5. SplashScreen.png (620x300)
$bgColor = [System.Drawing.Color]::FromArgb(255, 30, 30, 46) # #1e1e2e
Resize-CanvasImage -CanvasWidth 620 -CanvasHeight 300 -IconWidth 180 -IconHeight 180 -OutputFile "$OutputDir\SplashScreen.png" -BgColor $bgColor

# 6. SmallTile.png (71x71)
Resize-CanvasImage -CanvasWidth 71 -CanvasHeight 71 -IconWidth 71 -IconHeight 71 -OutputFile "$OutputDir\SmallTile.png"

# 7. LargeTile.png (310x310)
Resize-CanvasImage -CanvasWidth 310 -CanvasHeight 310 -IconWidth 310 -IconHeight 310 -OutputFile "$OutputDir\LargeTile.png"

$sourceBitmap.Dispose()
Write-Host "[MSIX Assets] Todos os assets foram gerados em: $OutputDir" -ForegroundColor Green
exit 0
