# 生成 ws-hub.ico（256x256，四色方块 = 四个工作区）
Add-Type -AssemblyName System.Drawing
$out = Join-Path $PSScriptRoot "ws-hub.ico"
$S = 256

$bmp = New-Object System.Drawing.Bitmap($S, $S)
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$g.Clear([System.Drawing.Color]::Transparent)

function New-RoundedPath([single]$x, [single]$y, [single]$w, [single]$h, [single]$r) {
  $p = New-Object System.Drawing.Drawing2D.GraphicsPath
  $d = $r * 2
  $p.AddArc($x, $y, $d, $d, 180, 90)
  $p.AddArc($x + $w - $d, $y, $d, $d, 270, 90)
  $p.AddArc($x + $w - $d, $y + $h - $d, $d, $d, 0, 90)
  $p.AddArc($x, $y + $h - $d, $d, $d, 90, 90)
  $p.CloseFigure()
  return $p
}

# 底板
$bg = New-RoundedPath 6 6 244 244 46
$b1 = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
  (New-Object System.Drawing.Point(0, 0)),
  (New-Object System.Drawing.Point(0, $S)),
  [System.Drawing.Color]::FromArgb(255, 15, 21, 30),
  [System.Drawing.Color]::FromArgb(255, 8, 11, 16))
$g.FillPath($b1, $bg)
$pen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(255, 48, 58, 72), 5)
$g.DrawPath($pen, $bg)

# 2x2 四色方块
$colors = @(
  [System.Drawing.Color]::FromArgb(255, 88, 166, 255),
  [System.Drawing.Color]::FromArgb(255, 63, 185, 80),
  [System.Drawing.Color]::FromArgb(255, 210, 153, 34),
  [System.Drawing.Color]::FromArgb(255, 188, 140, 255)
)
$size = 84; $gap = 22; $left = 32; $top = 32
for ($i = 0; $i -lt 4; $i++) {
  $x = $left + ($i % 2) * ($size + $gap)
  $y = $top + [math]::Floor($i / 2) * ($size + $gap)
  $p = New-RoundedPath $x $y $size $size 22
  $brush = New-Object System.Drawing.SolidBrush($colors[$i])
  $g.FillPath($brush, $p)
  $brush.Dispose(); $p.Dispose()
}

$g.Dispose()

# 保存成 ICO：256x256 / 32bpp，BMP 格式（兼容性最好）
$rect = New-Object System.Drawing.Rectangle(0, 0, $S, $S)
$bd = $bmp.LockBits($rect, [System.Drawing.Imaging.ImageLockMode]::ReadOnly, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$stride = $bd.Stride
$raw = New-Object byte[] ($stride * $S)
[System.Runtime.InteropServices.Marshal]::Copy($bd.Scan0, $raw, 0, $raw.Length)
$bmp.UnlockBits($bd)
$bmp.Dispose()

$ms = New-Object System.IO.MemoryStream
$bw = New-Object System.IO.BinaryWriter -ArgumentList $ms
# ICONDIR
$bw.Write([UInt16]0); $bw.Write([UInt16]1); $bw.Write([UInt16]1)
# ICONDIRENTRY
$bw.Write([byte]0); $bw.Write([byte]0); $bw.Write([byte]0); $bw.Write([byte]0)
$bw.Write([UInt16]1); $bw.Write([UInt16]32)
$bw.Write([UInt32](40 + $S * $S * 4 + $S * $S / 8))
$bw.Write([UInt32]22)
# BITMAPINFOHEADER
$bw.Write([UInt32]40); $bw.Write([Int32]$S); $bw.Write([Int32]($S * 2))
$bw.Write([UInt16]1); $bw.Write([UInt16]32); $bw.Write([UInt32]0)
$bw.Write([UInt32]($S * $S * 4)); $bw.Write([Int32]0); $bw.Write([Int32]0)
$bw.Write([UInt32]0); $bw.Write([UInt32]0)
# 像素自下而上
for ($y = $S - 1; $y -ge 0; $y--) { $bw.Write($raw, $y * $stride, $S * 4) }
# AND mask 全 0
$bw.Write((New-Object byte[] ($S * $S / 8)))
$bw.Flush()
[System.IO.File]::WriteAllBytes($out, $ms.ToArray())
$bw.Close(); $ms.Close()

"icon written: $out  ($([math]::Round((Get-Item $out).Length/1KB)) KB)"
