$ErrorActionPreference = 'Continue'

Write-Host ""
Write-Host "=== Stopping Vehicle Automation services ===" -ForegroundColor Cyan

$targets = @{}

# processes listening on 5000 / 5173
$listening = netstat -ano | Where-Object { $_ -match 'LISTENING' }
foreach ($line in $listening) {
    $parts = @($line -split '\s+' | Where-Object { $_ })
    if ($parts.Count -ge 5 -and $parts[1] -match ':(5000|5173)$') {
        $port = if ($parts[1] -match ':5000$') { 'backend/frontend' } else { 'frontend' }
        $targets[[int]$parts[4]] = "port $($parts[1])"
    }
}

# python running backend app.py (parent reloader + child)
Get-CimInstance Win32_Process -Filter "Name='python.exe'" -ErrorAction SilentlyContinue |
    Where-Object { $_.CommandLine -match 'app\.py' } |
    ForEach-Object { $targets[[int]$_.ProcessId] = 'backend app.py' }

# vite dev server (npm wrapper children)
Get-CimInstance Win32_Process -Filter "Name='node.exe'" -ErrorAction SilentlyContinue |
    Where-Object { $_.CommandLine -match 'node_modules\\vite|\\vite\\bin' } |
    ForEach-Object { $targets[[int]$_.ProcessId] = 'vite' }

# cloudflared tunnel
Get-Process cloudflared -ErrorAction SilentlyContinue |
    ForEach-Object { $targets[[int]$_.Id] = 'cloudflared tunnel' }

if ($targets.Count -eq 0) {
    Write-Host "  nothing to stop - all services already stopped" -ForegroundColor Yellow
    Write-Host ""
    return
}

foreach ($procId in $targets.Keys) {
    $reason = $targets[$procId]
    try {
        Stop-Process -Id $procId -Force -ErrorAction Stop
        Write-Host "  stopped pid $procId ($reason)" -ForegroundColor Gray
    } catch {
        Write-Host "  pid $procId already gone ($reason)" -ForegroundColor Gray
    }
}

Start-Sleep -Milliseconds 800

# verify
$stillUp = @()
foreach ($port in 5000, 5173) {
    $up = netstat -ano | Where-Object { $_ -match 'LISTENING' } |
        Where-Object { (@($_ -split '\s+' | Where-Object { $_ })[1]) -match ":$port$" }
    if ($up) { $stillUp += $port }
}
if (Get-Process cloudflared -ErrorAction SilentlyContinue) { $stillUp += 'cloudflared' }

if ($stillUp.Count -eq 0) {
    Write-Host "  all services stopped" -ForegroundColor Green
} else {
    Write-Host "  still running: $($stillUp -join ', ')" -ForegroundColor Yellow
}
Write-Host ""
