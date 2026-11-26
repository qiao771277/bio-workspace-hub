# 一键：拉取最新 -> 重建看板 -> 用【默认浏览器】打开
# 双击桌面图标时由 PowerShell 隐藏运行；出错只记日志，不弹窗打断。

param([switch]$NoOpen, [string]$Target = "")

$ErrorActionPreference = "Continue"
try {
  [Console]::OutputEncoding = [System.Text.Encoding]::UTF8
  $OutputEncoding = [System.Text.Encoding]::UTF8
} catch {}

$hub = Split-Path $PSScriptRoot -Parent
$log = Join-Path $PSScriptRoot "open-dashboard.log"
$lockPath = Join-Path $PSScriptRoot ".open.lock"

function Log([string]$m) {
  try {
    $line = ("[{0}] {1}`r`n" -f (Get-Date -Format "yyyy-MM-dd HH:mm:ss"), $m)
    [System.IO.File]::AppendAllText($log, $line, [System.Text.Encoding]::UTF8)
  } catch {}
}

# 防止连点两次同时 pull/build（会报 Cannot fast-forward to multiple branches）
$lock = $null
try {
  $lock = [System.IO.File]::Open($lockPath, [System.IO.FileMode]::OpenOrCreate, [System.IO.FileAccess]::ReadWrite, [System.IO.FileShare]::None)
} catch {
  Log "another instance is running, skip"
  exit 0
}

try {
  Log "---- open ----"
  Set-Location $hub

  $git = (Get-Command git -ErrorAction SilentlyContinue).Source
  if (-not $git -and (Test-Path "C:\Program Files\Git\cmd\git.exe")) { $git = "C:\Program Files\Git\cmd\git.exe" }

  if ($git) {
    try {
      $msg = & $git pull --ff-only 2>&1
      Log ("pull: " + ($msg -join " / "))
    } catch { Log "pull failed: $_" }
  } else { Log "git not found, skip pull" }

  $node = (Get-Command node -ErrorAction SilentlyContinue).Source
  if ($node) {
    try {
      $msg = & $node "tools\build.mjs" 2>&1
      Log ("build: " + ($msg -join " / "))
    } catch { Log "build failed: $_" }
  } else { Log "node not found, skip build" }

  $dash = if ($Target) {
    if ([System.IO.Path]::IsPathRooted($Target)) { $Target } else { Join-Path $hub $Target }
  } else { Join-Path $hub "dashboard.html" }
  if (-not (Test-Path $dash)) {
    Log "ERROR: dashboard.html missing"
    if (-not $NoOpen) { Start-Process notepad.exe $log }
    return
  }

  # 能编辑的版本：起本地服务（只监听 127.0.0.1），浏览器打开 http://127.0.0.1:端口/
  $target = $dash
  if (-not $NoOpen) {
    $port = 8766
    $alive = $false
    try {
      $r = Invoke-WebRequest -Uri "http://127.0.0.1:$port/api/ping" -UseBasicParsing -TimeoutSec 2
      $alive = ($r.StatusCode -eq 200)
    } catch {}

    if (-not $alive -and $node) {
      Start-Process -FilePath $node -ArgumentList @(('"' + (Join-Path $PSScriptRoot "serve.mjs") + '"')) -WorkingDirectory $hub -WindowStyle Hidden
      for ($i = 0; $i -lt 25; $i++) {
        Start-Sleep -Milliseconds 300
        try {
          if ((Invoke-WebRequest -Uri "http://127.0.0.1:$port/api/ping" -UseBasicParsing -TimeoutSec 1).StatusCode -eq 200) { $alive = $true; break }
        } catch {}
      }
      $sf = Join-Path $PSScriptRoot ".server.json"
      if (Test-Path $sf) {
        try { $port = [int](Get-Content $sf -Raw | ConvertFrom-Json).port } catch {}
      }
    }

    if ($alive) {
      $target = "http://127.0.0.1:$port/"
      Log "server up on port $port (edit mode)"
    } else {
      Log "server not running -> opening static file (read-only)"
    }
  }

  # 找默认浏览器：读 https/http 的 UserChoice -> ProgId -> exe
  function Get-OpenCommand([string]$proto) {
    $key = "HKCU:\Software\Microsoft\Windows\Shell\Associations\UrlAssociations\$proto\UserChoice"
    $prog = (Get-ItemProperty $key -ErrorAction SilentlyContinue).ProgId
    if (-not $prog) { return $null }
    $cmd = (Get-ItemProperty "Registry::HKEY_CLASSES_ROOT\$prog\shell\open\command" -ErrorAction SilentlyContinue).'(default)'
    return $cmd
  }

  function Open-WithTemplate([string]$template, [string]$file) {
    if (-not $template) { return $false }
    $t = $template.Trim()
    $exe = $null
    $rest = ""
    if ($t.StartsWith('"')) {
      $end = $t.IndexOf('"', 1)
      if ($end -gt 1) { $exe = $t.Substring(1, $end - 1); $rest = $t.Substring($end + 1).Trim() }
    } else {
      $sp = $t.IndexOf(' ')
      if ($sp -gt 0) { $exe = $t.Substring(0, $sp); $rest = $t.Substring($sp + 1).Trim() } else { $exe = $t }
    }
    if (-not $exe -or -not (Test-Path $exe)) { return $false }

    if ($rest -match '"%1"') { $rest = $rest.Replace('"%1"', ('"' + $file + '"')) }
    elseif ($rest -match '%1') { $rest = $rest.Replace('%1', ('"' + $file + '"')) }

    # 直接用 exe 启动，不要经过 cmd（cmd /c 会把引号吃掉）
    if ([string]::IsNullOrWhiteSpace($rest)) {
      Start-Process -FilePath $exe -ArgumentList ('"' + $file + '"')
    } else {
      Start-Process -FilePath $exe -ArgumentList $rest
    }
    return $true
  }

  if ($NoOpen) { Log "NoOpen, skip launch"; return }

  # 优先 Chrome，其次系统默认浏览器，最后 Edge/Firefox 兜底
  function Find-Chrome {
    $cands = @(
      (Get-ItemProperty "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths\chrome.exe" -ErrorAction SilentlyContinue).'(default)',
      "$env:ProgramFiles\Google\Chrome\Application\chrome.exe",
      "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe",
      "$env:LOCALAPPDATA\Google\Chrome\Application\chrome.exe"
    )
    foreach ($c in $cands) { if ($c -and (Test-Path $c)) { return $c } }
    return $null
  }

  $opened = $false
  $chrome = Find-Chrome
  if ($chrome) {
    try {
      $proc = Start-Process -FilePath $chrome -ArgumentList @("--new-window", ('"' + $target + '"')) -PassThru
      Start-Sleep -Milliseconds 1800
      if ($proc.HasExited -and $proc.ExitCode -ne 0) {
        Log "chrome exited with code $($proc.ExitCode) - likely running elevated, will fall back"
      } else {
        Log "open via chrome: $chrome"
        $opened = $true
        try { (New-Object -ComObject WScript.Shell).AppActivate("WS-HUB") | Out-Null } catch {}
      }
    } catch { Log "chrome failed: $($_.Exception.Message)" }
  }

  if (-not $opened) {
    $tpl = Get-OpenCommand "https"
    if (-not $tpl) { $tpl = Get-OpenCommand "http" }
    if ($tpl) {
      try {
        if (Open-WithTemplate $tpl $target) {
          Log "open via default browser: $tpl"
          $opened = $true
          Start-Sleep -Milliseconds 1200
          try { (New-Object -ComObject WScript.Shell).AppActivate("WS-HUB") | Out-Null } catch {}
        }
      } catch { Log "default browser failed: $($_.Exception.Message)" }
    }
  }

  if (-not $opened) {
    foreach ($e in @("$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe", "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe")) {
      if (Test-Path $e) {
        try {
          Start-Process -FilePath $e -ArgumentList ('"' + $target + '"')
          Log "open via edge fallback: $e"
          $opened = $true
          break
        } catch {}
      }
    }
  }

  if (-not $opened) {
    $cands = @(
      "$env:ProgramFiles\Mozilla Firefox\firefox.exe",
      "${env:ProgramFiles(x86)}\Mozilla Firefox\firefox.exe",
      "$env:ProgramFiles\Google\Chrome\Application\chrome.exe",
      "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe",
      "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe",
      "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe"
    )
    foreach ($c in $cands) {
      if (Test-Path $c) {
        try {
          Start-Process -FilePath $c -ArgumentList ('"' + $target + '"')
          Log "open via fallback: $c"
          $opened = $true
          break
        } catch {}
      }
    }
  }

  if (-not $opened) {
    Log "no browser could open the dashboard"
    if (-not $NoOpen) {
      try {
        Add-Type -AssemblyName System.Windows.Forms
        [System.Windows.Forms.MessageBox]::Show(
          "没能自动打开浏览器。`n`n请手动打开：`n" + $dash,
          "WS-HUB",
          [System.Windows.Forms.MessageBoxButtons]::OK,
          [System.Windows.Forms.MessageBoxIcon]::Warning) | Out-Null
      } catch {
        Start-Process explorer.exe $hub
      }
    }
  }
}
finally {
  if ($lock) { $lock.Close(); $lock.Dispose() }
  Remove-Item $lockPath -Force -ErrorAction SilentlyContinue
}
