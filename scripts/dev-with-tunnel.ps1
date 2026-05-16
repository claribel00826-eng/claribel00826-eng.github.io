# 一键：启动 Vite 开发服 + 公网隧道（两个新窗口）
# 用法: .\scripts\dev-with-tunnel.ps1

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$frontend = Join-Path $root "frontend"
$tunnelScript = Join-Path $root "scripts\tunnel.ps1"

if (-not (Test-Path $frontend)) {
    Write-Host "找不到 frontend 目录: $frontend" -ForegroundColor Red
    exit 1
}

Write-Host "将在新窗口启动:" -ForegroundColor Cyan
Write-Host "  1) npm run dev  (端口 5173)"
Write-Host "  2) 公网隧道"
Write-Host ""

Start-Process powershell -ArgumentList @(
    "-NoExit",
    "-Command",
    "Set-Location '$frontend'; npm run dev"
)

Start-Sleep -Seconds 4

Start-Process powershell -ArgumentList @(
    "-NoExit",
    "-File",
    $tunnelScript,
    "-Port",
    "5173"
)

Write-Host "已打开两个 PowerShell 窗口。在隧道窗口里复制 trycloudflare.com 链接分享给外网用户。" -ForegroundColor Green
