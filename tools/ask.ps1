# 由 serve.mjs 调用：在“有控制台”的环境里跑 opencode run，并把 JSON 输出落到文件。
# 关键点：Node 用管道 spawn 时 opencode CLI 会挂住；用 Start-Process + 重定向才正常。

param(
  [Parameter(Mandatory = $true)][string]$Session,
  [Parameter(Mandatory = $true)][string]$PromptFile,
  [Parameter(Mandatory = $true)][string]$OutFile,
  [string]$Model = "",
  [string]$Attach = ""
)

$ErrorActionPreference = "Stop"

$cli = $env:WS_HUB_OPENCODE
if (-not $cli) {
  $cli = Join-Path $env:LOCALAPPDATA "Programs\@opencode-aidesktop\resources\opencode-cli.exe"
}
if (-not (Test-Path $cli)) {
  "CLI not found: $cli" | Set-Content -Path "$OutFile.err" -Encoding UTF8
  exit 3
}

$prompt = [System.IO.File]::ReadAllText($PromptFile, [System.Text.Encoding]::UTF8)

# Node 用管道 spawn 时，CLI 会因为 stdin 不是 EOF 而挂住；显式把 stdin 指向空文件
$nullIn = Join-Path ([System.IO.Path]::GetTempPath()) ("wshub-stdin-" + [guid]::NewGuid().ToString("N") + ".txt")
[System.IO.File]::WriteAllText($nullIn, "")

$argList = @(
  "run", "--format", "json",
  "--session", $Session,
  "--title", "WS-HUB 问答"
)
if ($Model) { $argList += @("--model", $Model) }
if ($Attach -and (Test-Path $Attach)) { $argList += @("--file", $Attach) }
$argList += $prompt

try {
  $p = Start-Process -FilePath $cli -ArgumentList $argList `
    -RedirectStandardInput $nullIn `
    -RedirectStandardOutput $OutFile -RedirectStandardError "$OutFile.err" `
    -PassThru -WindowStyle Hidden -Wait
}
finally {
  Remove-Item $nullIn -Force -ErrorAction SilentlyContinue
}

exit $p.ExitCode
