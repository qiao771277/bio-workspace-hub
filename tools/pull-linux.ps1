# 从 Linux 机器拉取采集结果到本机 hub
#
#   .\tools\pull-linux.ps1 -LinuxHost 192.168.1.50 -User lab
#   .\tools\pull-linux.ps1 -LinuxHost gpu-node -LinuxRoot "~/ws-hub/workspaces" -Only linux-1
#
# 需要 Windows 自带 OpenSSH 客户端（scp 在 C:\Windows\System32\OpenSSH\）。
# 只复制 workspaces/<id>/ 目录，不会覆盖本机的 win-main / win-alt。

param(
  [Parameter(Mandatory = $true)][string]$LinuxHost,
  [string]$User = "",
  [string]$LinuxRoot = "~/ws-hub/workspaces",
  [string]$Only = "",
  [string]$Hub = (Split-Path $PSScriptRoot -Parent)
)

$ErrorActionPreference = "Stop"
$target = Join-Path $Hub "workspaces"
if (-not (Test-Path $target)) { throw "找不到 $target —— 确认 hub 路径对不对" }

$remote = if ($User) { "${User}@${LinuxHost}" } else { $LinuxHost }
$src = if ($Only) { "${remote}:$LinuxRoot/$Only" } else { "${remote}:$LinuxRoot/*" }

Write-Host "拉取  $src"
Write-Host "  到  $target"
Write-Host ""

& scp -r $src $target
if ($LASTEXITCODE -ne 0) { throw "scp 失败（退出码 $LASTEXITCODE）。检查主机名、用户名、是否装了 sshd。" }

Get-ChildItem $target -Directory | ForEach-Object {
  $latest = Join-Path $_.FullName "latest.json"
  if (Test-Path $latest) {
    $stamp = (Get-Item $latest).LastWriteTime.ToString("yyyy-MM-dd HH:mm")
    Write-Host ("  {0,-12} 更新于 {1}" -f $_.Name, $stamp)
  }
}

Write-Host ""
Write-Host "下一步：node tools/build.mjs"
