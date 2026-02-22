Add-Type -AssemblyName System.Drawing

$size = 512
$bmp = New-Object System.Drawing.Bitmap($size, $size, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$graphics = [System.Drawing.Graphics]::FromImage($bmp)
$graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$graphics.Clear([System.Drawing.Color]::Transparent)

$radius = 90
$diameter = $radius * 2
$path = New-Object System.Drawing.Drawing2D.GraphicsPath
$path.AddArc(0, 0, $diameter, $diameter, 180, 90)
$path.AddArc($size - $diameter, 0, $diameter, $diameter, 270, 90)
$path.AddArc($size - $diameter, $size - $diameter, $diameter, $diameter, 0, 90)
$path.AddArc(0, $size - $diameter, $diameter, $diameter, 90, 90)
$path.CloseFigure()

$brandBlue = [System.Drawing.Color]::FromArgb(0, 168, 255)
$blueBrush = New-Object System.Drawing.SolidBrush($brandBlue)
$graphics.FillPath($blueBrush, $path)

$fontSize = 300
$font = New-Object System.Drawing.Font("Outfit", $fontSize, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
$format = New-Object System.Drawing.StringFormat
$format.Alignment = [System.Drawing.StringAlignment]::Center
$format.LineAlignment = [System.Drawing.StringAlignment]::Center

$bounds = New-Object System.Drawing.RectangleF(0, 0, $size, $size)
$whiteBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::White)
$graphics.DrawString("M", $font, $whiteBrush, $bounds, $format)

$outputPath = "c:\Users\Owner\OneDrive\Desktop\MinecraftserverlistProject\MCServerListLauncher\src\assets\icon.png"
$bmp.Save($outputPath, [System.Drawing.Imaging.ImageFormat]::Png)

$graphics.Dispose()
$bmp.Dispose()
$font.Dispose()
$blueBrush.Dispose()
$whiteBrush.Dispose()
