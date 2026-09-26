param([switch]$NoWait)

$ErrorActionPreference = 'Continue'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $root

$backendLog = Join-Path $root 'backend_server.log'
$backendErr = Join-Path $root 'backend_server.err.log'
$frontendLog = Join-Path $root 'frontend_dev.log'
$tunnelLog = Join-Path $root 'tunnel.log'
$tunnelErr = Join-Path $root 'tunnel.err.log'

function Test-Port([int]$Port) {
    try {
        $client = New-Object System.Net.Sockets.TcpClient
        $task = $client.BeginConnect('127.0.0.1', $Port, $null, $null)
        $done = $task.AsyncWaitHandle.WaitOne(400, $false)
        $connected = $done -and $client.Connected
        $client.Close()
        return $connected
    } catch {
        return $false
    }
}

function Wait-Port([int]$Port, [int]$TimeoutSec, [string]$Name) {
    $deadline = (Get-Date).AddSeconds($TimeoutSec)
    while ((Get-Date) -lt $deadline) {
        if (Test-Port $Port) {
            Write-Host "        up on :$Port ($Name)" -ForegroundColor Green
            return $true
        }
        Start-Sleep -Milliseconds 800
    }
    Write-Host "        FAILED - $Name did not start within $TimeoutSec s" -ForegroundColor Red
    return $false
}

function Get-TunnelUrl {
    $pattern = 'https://[a-z0-9-]+\.trycloudflare\.com'
    foreach ($file in @($tunnelErr, $tunnelLog)) {
        if (Test-Path $file) {
            $hit = Select-String -Path $file -Pattern $pattern -ErrorAction SilentlyContinue | Select-Object -Last 1
            if ($hit) { return $hit.Matches[0].Value }
        }
    }
    return $null
}

function Get-LanIp {
    $ip = Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
        Where-Object { $_.InterfaceAlias -eq 'Wi-Fi' -and $_.IPAddress -notlike '169.254*' } |
        Select-Object -First 1
    if (-not $ip) {
        $ip = Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
            Where-Object { $_.IPAddress -notlike '127.*' -and $_.IPAddress -notlike '169.254*' } |
            Select-Object -First 1
    }
    if ($ip) { return $ip.IPAddress } else { return $null }
}

Write-Host ""
Write-Host "=== Vehicle Automation - starting services ===" -ForegroundColor Cyan
Write-Host "    root: $root"
Write-Host ""

# ---- [1/3] backend (Flask :5000) ----
if (Test-Port 5000) {
    Write-Host "[1/3] Backend already running on :5000 - reusing" -ForegroundColor Yellow
} else {
    Write-Host "[1/3] Starting backend (Flask)..." -NoNewline
    Start-Process -FilePath 'python' -ArgumentList 'app.py' `
        -WorkingDirectory (Join-Path $root 'backend') `
        -RedirectStandardOutput $backendLog -RedirectStandardError $backendErr `
        -WindowStyle Hidden
    Write-Host ""
    if (-not (Wait-Port 5000 90 'Flask backend')) {
        Write-Host "       see $backendErr" -ForegroundColor Red
        exit 1
    }
}

# ---- [2/3] frontend (Vite :5173) ----
if (Test-Port 5173) {
    Write-Host "[2/3] Frontend already running on :5173 - reusing" -ForegroundColor Yellow
} else {
    Write-Host "[2/3] Starting frontend (Vite)..." -NoNewline
    $npmCmd = "/c npm run dev > `"$frontendLog`" 2>&1"
    Start-Process -FilePath 'cmd.exe' -ArgumentList $npmCmd `
        -WorkingDirectory (Join-Path $root 'frontend') `
        -WindowStyle Hidden
    Write-Host ""
    if (-not (Wait-Port 5173 90 'Vite dev server')) {
        Write-Host "       see $frontendLog" -ForegroundColor Red
        exit 1
    }
}

# ---- [3/3] cloudflare tunnel ----
$tunnelUrl = $null
$cloudflared = Get-Process cloudflared -ErrorAction SilentlyContinue
if ($cloudflared) {
    $tunnelUrl = Get-TunnelUrl
    if ($tunnelUrl) {
        Write-Host "[3/3] Tunnel already running - reusing" -ForegroundColor Yellow
    } else {
        Write-Host "[3/3] Tunnel running but URL unknown - restarting..."
        $cloudflared | Stop-Process -Force -ErrorAction SilentlyContinue
        Start-Sleep -Seconds 2
    }
}

if (-not $tunnelUrl) {
    $exe = 'C:\Program Files (x86)\cloudflared\cloudflared.exe'
    if (-not (Test-Path $exe)) {
        $cmd = Get-Command cloudflared -ErrorAction SilentlyContinue
        if ($cmd) { $exe = $cmd.Source } else {
            Write-Host "[3/3] cloudflared not installed - run: winget install Cloudflare.cloudflared" -ForegroundColor Red
            exit 1
        }
    }
    Remove-Item $tunnelLog, $tunnelErr -ErrorAction SilentlyContinue
    Write-Host "[3/3] Starting Cloudflare tunnel..." -NoNewline
    Start-Process -FilePath $exe -ArgumentList 'tunnel', '--url', 'http://127.0.0.1:5173' `
        -RedirectStandardOutput $tunnelLog -RedirectStandardError $tunnelErr `
        -WindowStyle Hidden
    Write-Host ""

    $deadline = (Get-Date).AddSeconds(90)
    while ((Get-Date) -lt $deadline -and -not $tunnelUrl) {
        Start-Sleep -Milliseconds 800
        $tunnelUrl = Get-TunnelUrl
        if (-not $tunnelUrl -and (Test-Path $tunnelErr)) {
            if (Select-String -Path $tunnelErr -Pattern 'failed to request quick Tunnel' -Quiet -ErrorAction SilentlyContinue) {
                Write-Host "        FAILED - could not reach api.trycloudflare.com" -ForegroundColor Red
                Write-Host "        fix: run fix-hosts.bat as administrator, then rerun this script" -ForegroundColor Yellow
                exit 1
            }
        }
    }
    if (-not $tunnelUrl) {
        Write-Host "        FAILED - no tunnel URL within 90 s (see $tunnelErr)" -ForegroundColor Red
        exit 1
    }
    Write-Host "        tunnel is up" -ForegroundColor Green
}

# ---- summary ----
$lanIp = Get-LanIp
Write-Host ""
Write-Host "=== All services running ===" -ForegroundColor Green
Write-Host "  Local :  http://localhost:5173/"
if ($lanIp) { Write-Host "  LAN   :  http://${lanIp}:5173/" }
Write-Host "  Public:  $tunnelUrl"
Write-Host ""

if ($NoWait) { exit 0 }

$null = Read-Host "Press Enter to stop all servers"
& (Join-Path $root 'stop-all.ps1')
