# 在桌面创建「WS-HUB 工作区看板」快捷方式（任意机器都可以跑一次）
#   powershell -ExecutionPolicy Bypass -File tools\install-shortcut.ps1
# 参数：
#   -Name "WS-HUB 工作区看板"   快捷方式文件名
#   -NoDesktop                 不加“桌面”，只打印路径

param(
  [string]$Name = "WS-HUB 工作区看板",
  [switch]$NoDesktop
)

$hub = Split-Path $PSScriptRoot -Parent
$ps1 = Join-Path $PSScriptRoot "open-dashboard.ps1"
$ico = Join-Path $PSScriptRoot "ws-hub.ico"

if (-not (Test-Path $ps1)) { throw "缺少 open-dashboard.ps1" }
if (-not (Test-Path $ico)) {
  Write-Host "没有图标，先生成：" -ForegroundColor Yellow
  & powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot "make-icon.ps1")
}

$desktop = [Environment]::GetFolderPath("Desktop")
$lnkPath = Join-Path $desktop ("$Name.lnk")
$powershell = Join-Path $env:SystemRoot "System32\WindowsPowerShell\v1.0\powershell.exe"

$ws = New-Object -ComObject WScript.Shell
$lnk = $ws.CreateShortcut($lnkPath)
$lnk.TargetPath = $powershell
$lnk.Arguments = '-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File "' + $ps1 + '"'
$lnk.WorkingDirectory = $hub
$lnk.IconLocation = "$ico,0"
$lnk.Description = "拉取最新数据、重建并打开 WS-HUB 工作区看板"
$lnk.WindowStyle = 1
$lnk.Save()

if ($NoDesktop) {
  Write-Host "已生成: $lnkPath"
} else {
  Write-Host "已放到桌面: $lnkPath" -ForegroundColor Green
  Write-Host "图标: $ico"
  Write-Host "动作: git pull -> node tools/build.mjs -> 用默认浏览器打开 dashboard.html"
}
