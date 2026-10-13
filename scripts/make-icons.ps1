# Generates icons/icon{16,32,48,128}.png: a teal-to-indigo glass tile with the Tamil letter KA.
# Run: npm run icons   (Windows, uses System.Drawing)
Add-Type -AssemblyName System.Drawing

$outDir = Join-Path $PSScriptRoot '..\icons'
New-Item -ItemType Directory -Force $outDir | Out-Null
$glyph = [string][char]0x0B95   # KA, kept as a code point so this script stays ASCII-only

foreach ($size in 16, 32, 48, 128) {
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

  $bmp.Save((Join-Path $outDir "icon$size.png"), [System.Drawing.Imaging.ImageFormat]::Png)
  $g.Dispose(); $bmp.Dispose()
}
Write-Output "Icons written to $outDir"
