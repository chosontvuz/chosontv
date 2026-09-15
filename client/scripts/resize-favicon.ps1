Add-Type -AssemblyName System.Drawing
$srcPath = "C:\Users\shukr\Desktop\KinoMax\client\public\favicon.png"
$img = [System.Drawing.Image]::FromFile($srcPath)

function Save-Square([System.Drawing.Image]$src, [int]$size, [string]$outPath) {
  $bmp = New-Object System.Drawing.Bitmap $size, $size
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
  $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  $g.Clear([System.Drawing.Color]::Black)
  $g.DrawImage($src, 0, 0, $size, $size)
  $g.Dispose()
  $bmp.Save($outPath, [System.Drawing.Imaging.ImageFormat]::Png)
  $bmp.Dispose()
  Write-Output "saved $outPath"
}

Save-Square $img 48 "C:\Users\shukr\Desktop\KinoMax\client\public\favicon-48.png"
Save-Square $img 192 "C:\Users\shukr\Desktop\KinoMax\client\public\favicon-192.png"
$img.Dispose()
