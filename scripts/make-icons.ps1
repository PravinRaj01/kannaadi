# Generates icons/icon{16,32,48,128}.png: a teal-to-indigo glass tile with the Tamil letter KA.
#   npm run icons                       (extension icons only)
#   make-icons.ps1 -Store               also writes the store art to docs-local/store/ (300x300 logo, 440x280 tile)
# Windows only (System.Drawing). Tamil text is built from code points so this script stays ASCII-only.
param([switch]$Store)

Add-Type -AssemblyName System.Drawing

$glyph = [string][char]0x0B95                                                    # KA
$kannaadi = -join ([char[]](0x0B95, 0x0BA3, 0x0BCD, 0x0BA3, 0x0BBE, 0x0B9F, 0x0BBF))  # kannaadi in Tamil
$arrow = [string][char]0x2192

function New-Tile([int]$size) {
  $bmp = New-Object System.Drawing.Bitmap $size, $size
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = 'AntiAlias'
  $g.TextRenderingHint = 'AntiAliasGridFit'
  $g.Clear([System.Drawing.Color]::Transparent)

  $radius = [Math]::Max(3, [int]($size * 0.24))
  $d = $radius * 2
  $max = $size - 1
  $path = New-Object System.Drawing.Drawing2D.GraphicsPath
  $path.AddArc(0, 0, $d, $d, 180, 90)
  $path.AddArc($max - $d, 0, $d, $d, 270, 90)
  $path.AddArc($max - $d, $max - $d, $d, $d, 0, 90)
  $path.AddArc(0, $max - $d, $d, $d, 90, 90)
  $path.CloseFigure()

  $rect = New-Object System.Drawing.Rectangle 0, 0, $size, $size
  $c1 = [System.Drawing.Color]::FromArgb(255, 31, 181, 168)
  $c2 = [System.Drawing.Color]::FromArgb(255, 74, 91, 220)
  $grad = New-Object System.Drawing.Drawing2D.LinearGradientBrush $rect, $c1, $c2, 45
  $g.FillPath($grad, $path)

  # glass highlight on the upper half
  $g.SetClip($path)
  $hi = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(55, 255, 255, 255))
  $g.FillEllipse($hi, -$size * 0.2, -$size * 0.55, $size * 1.4, $size * 1.05)
  $g.ResetClip()

  $font = New-Object System.Drawing.Font 'Nirmala UI', ([single]($size * 0.52)), ([System.Drawing.FontStyle]::Bold), ([System.Drawing.GraphicsUnit]::Pixel)
  $fmt = New-Object System.Drawing.StringFormat
  $fmt.Alignment = 'Center'
  $fmt.LineAlignment = 'Center'
  $box = New-Object System.Drawing.RectangleF 0, ($size * 0.02), $size, $size
  $g.DrawString($glyph, $font, [System.Drawing.Brushes]::White, $box, $fmt)
  $g.Dispose()
  return $bmp
}

$outDir = Join-Path $PSScriptRoot '..\icons'
New-Item -ItemType Directory -Force $outDir | Out-Null
foreach ($size in 16, 32, 48, 128) {
  $bmp = New-Tile $size
  $bmp.Save((Join-Path $outDir "icon$size.png"), [System.Drawing.Imaging.ImageFormat]::Png)
  $bmp.Dispose()
}
Write-Output "Icons written to $outDir"

if ($Store) {
  $storeDir = Join-Path $PSScriptRoot '..\docs-local\store'
  New-Item -ItemType Directory -Force $storeDir | Out-Null

  # store logo: the tile on a transparent 300x300 canvas
  $logo = New-Tile 300
  $logo.Save((Join-Path $storeDir 'logo-300.png'), [System.Drawing.Imaging.ImageFormat]::Png)
  $logo.Dispose()

  # small promotional tile 440x280: soft glass background, tile + wordmark + tagline
  $w = 440; $h = 280
  $bmp = New-Object System.Drawing.Bitmap $w, $h
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = 'AntiAlias'
  $g.TextRenderingHint = 'AntiAliasGridFit'
  $bgRect = New-Object System.Drawing.Rectangle 0, 0, $w, $h
  $bg = New-Object System.Drawing.Drawing2D.LinearGradientBrush $bgRect, ([System.Drawing.Color]::FromArgb(255, 201, 240, 234)), ([System.Drawing.Color]::FromArgb(255, 207, 216, 255)), 35
  $g.FillRectangle($bg, $bgRect)
  $glow = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(90, 246, 227, 255))
  $g.FillEllipse($glow, 250, -60, 300, 260)

  $tile = New-Tile 120
  $g.DrawImage($tile, 40, 40)
  $tile.Dispose()

  $dark = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 18, 32, 44))
  $muted = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 70, 88, 104))
  $accent = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 11, 143, 131))
  $fWord = New-Object System.Drawing.Font 'Segoe UI Semibold', 40, ([System.Drawing.FontStyle]::Regular), ([System.Drawing.GraphicsUnit]::Pixel)
  $fTamil = New-Object System.Drawing.Font 'Nirmala UI', 26, ([System.Drawing.FontStyle]::Bold), ([System.Drawing.GraphicsUnit]::Pixel)
  $fTag = New-Object System.Drawing.Font 'Segoe UI', 21, ([System.Drawing.FontStyle]::Regular), ([System.Drawing.GraphicsUnit]::Pixel)
  $g.DrawString('Kannaadi', $fWord, $dark, 176, 40)
  $g.DrawString($kannaadi, $fTamil, $accent, 178, 92)

  # example line inside a glass strip
  $strip = New-Object System.Drawing.Drawing2D.GraphicsPath
  $sx = 40; $sy = 190; $sw = 360; $sh = 60; $r = 16
  $strip.AddArc($sx, $sy, $r, $r, 180, 90)
  $strip.AddArc($sx + $sw - $r, $sy, $r, $r, 270, 90)
  $strip.AddArc($sx + $sw - $r, $sy + $sh - $r, $r, $r, 0, 90)
  $strip.AddArc($sx, $sy + $sh - $r, $r, $r, 90, 90)
  $strip.CloseFigure()
  $g.FillPath((New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(150, 255, 255, 255))), $strip)
  $g.DrawPath((New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(200, 255, 255, 255)), 1.5), $strip)
  $vanakkam = -join ([char[]](0x0BB5, 0x0BA3, 0x0B95, 0x0BCD, 0x0B95, 0x0BAE, 0x0BCD))
  $fSample = New-Object System.Drawing.Font 'Nirmala UI', 22, ([System.Drawing.FontStyle]::Regular), ([System.Drawing.GraphicsUnit]::Pixel)
  $fSampleB = New-Object System.Drawing.Font 'Segoe UI Semibold', 22, ([System.Drawing.FontStyle]::Regular), ([System.Drawing.GraphicsUnit]::Pixel)
  $g.DrawString($vanakkam, $fSample, $muted, 58, 207)
  $fArrow = New-Object System.Drawing.Font 'Segoe UI Symbol', 22, ([System.Drawing.FontStyle]::Bold), ([System.Drawing.GraphicsUnit]::Pixel)
  $g.DrawString($arrow, $fArrow, $accent, 190, 206)
  $g.DrawString('vanakkam', $fSampleB, $dark, 228, 206)

  $bmp.Save((Join-Path $storeDir 'tile-440x280.png'), [System.Drawing.Imaging.ImageFormat]::Png)
  $g.Dispose(); $bmp.Dispose()
  Write-Output "Store art written to $storeDir"
}
