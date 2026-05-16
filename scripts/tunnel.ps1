# 内网穿透：将本机 HTTP 服务暴露到公网（Cloudflare Quick Tunnel）
# 用法:
#   .\scripts\tunnel.ps1              # 默认端口 5173（Vite 开发服）
#   .\scripts\tunnel.ps1 -Port 8080   # 任意本地端口
# 前提: 本地服务已启动，且监听 127.0.0.1 或 0.0.0.0

param(
    [int]$Port = 5173,
    [string]$Host = "127.0.0.1"
)

$ErrorActionPreference = "Stop"

function Find-Cloudflared {
    $cmd = Get-Command cloudflared -ErrorAction SilentlyContinue
    if ($cmd) { return $cmd.Source }
    $candidates = @(
        "$env:LOCALAPPDATA\Microsoft\WinGet\Packages\Cloudflare.cloudflared_Microsoft.Winget.Source_8wekyb3d8bbwe\cloudflared.exe",
        "$env:LOCALAPPDATA\Microsoft\WinGet\Links\cloudflared.exe",
        "$env:ProgramFiles\Cloudflare\cloudflared\cloudflared.exe"
    )
    foreach ($p in $candidates) {
        if (Test-Path $p) { return $p }
    }
    $found = Get-ChildItem -Path "$env:LOCALAPPDATA\Microsoft\WinGet\Packages" -Recurse -Filter cloudflared.exe -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($found) { return $found.FullName }
    return $null
}

$cloudflared = Find-Cloudflared
if (-not $cloudflared) {
    Write-Host "未找到 cloudflared。请先安装:" -ForegroundColor Red
    Write-Host "  winget install Cloudflare.cloudflared" -ForegroundColor Yellow
    exit 1
}

$url = "http://${Host}:${Port}"
Write-Host ""
Write-Host "正在创建公网隧道 -> $url" -ForegroundColor Cyan
Write-Host "请保持本窗口打开；关闭后外网链接失效。" -ForegroundColor DarkGray
Write-Host "终端里会出现 *.trycloudflare.com 地址，用浏览器打开即可。" -ForegroundColor DarkGray
Write-Host ""

& $cloudflared tunnel --url $url
