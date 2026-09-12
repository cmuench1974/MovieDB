# Starts the Windows SMB bridge if it is not already healthy.
$ErrorActionPreference = "Stop"
$scriptDir = $PSScriptRoot
$projectRoot = Split-Path -Parent $scriptDir
$envFile = Join-Path $projectRoot ".env"
$pidFile = Join-Path $scriptDir ".smb-bridge.pid"
$bridgeScript = Join-Path $scriptDir "smb-host-bridge.ps1"
$port = 39221

function Get-EnvValue([string]$Name) {
  if (-not (Test-Path $envFile)) { return $null }
  foreach ($line in Get-Content -LiteralPath $envFile) {
    if ($line -match "^\s*#" -or $line -notmatch "=") { continue }
    $key, $value = $line.Split("=", 2)
    if ($key.Trim() -eq $Name) {
      return $value.Trim().Trim('"').Trim("'")
    }
  }
  return $null
}

function Ensure-Token {
  $existing = Get-EnvValue "SMB_BRIDGE_TOKEN"
  if ($existing) { return $existing }
  $token = [guid]::NewGuid().ToString("N")
  Add-Content -LiteralPath $envFile -Value "`nSMB_BRIDGE_TOKEN=$token"
  if (-not (Get-EnvValue "SMB_BRIDGE_URL")) {
    Add-Content -LiteralPath $envFile -Value "SMB_BRIDGE_URL=http://smb-bridge:39221"
  }
  return $token
}

function Test-Bridge {
  try {
    $req = [System.Net.WebRequest]::Create("http://127.0.0.1:$port/health")
    $req.Method = "GET"
    $req.Timeout = 1500
    $resp = $req.GetResponse()
    $ok = [int]$resp.StatusCode -eq 200
    $resp.Close()
    return $ok
  } catch {
    return $false
  }
}

$token = Ensure-Token

if (Test-Bridge) {
  Write-Host "SMB bridge already running."
  exit 0
}

if (Test-Path $pidFile) {
  $oldPid = Get-Content -LiteralPath $pidFile | Select-Object -First 1
  if ($oldPid) {
    Stop-Process -Id ([int]$oldPid) -Force -ErrorAction SilentlyContinue
  }
  Remove-Item -LiteralPath $pidFile -Force -ErrorAction SilentlyContinue
}

$proc = Start-Process -FilePath "powershell.exe" -WorkingDirectory $projectRoot -WindowStyle Hidden -PassThru -ArgumentList @(
  "-NoProfile",
  "-ExecutionPolicy", "Bypass",
  "-File", $bridgeScript,
  "-Port", "$port"
)
Set-Content -LiteralPath $pidFile -Value $proc.Id

$ready = $false
foreach ($i in 1..20) {
  Start-Sleep -Milliseconds 200
  if (Test-Bridge) {
    $ready = $true
    break
  }
}
if (-not $ready) {
  Write-Error "SMB bridge did not become healthy on port $port."
  exit 1
}
Write-Host "SMB bridge started (pid $($proc.Id))."
