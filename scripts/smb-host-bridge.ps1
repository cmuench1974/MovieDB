# HTTP bridge so the Linux container can list SMB shares via the Windows session
# (mapped drives like Y: \\JUPITER\media). Listens on a high port; requires a token.

param(
  [int]$Port = 39221
)

$ErrorActionPreference = "Stop"
$projectRoot = Split-Path -Parent $PSScriptRoot
$envFile = Join-Path $projectRoot ".env"

function Get-EnvValue([string]$Name) {
  $fromEnv = [Environment]::GetEnvironmentVariable($Name)
  if ($fromEnv) { return $fromEnv }
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

$token = Get-EnvValue "SMB_BRIDGE_TOKEN"
if (-not $token) {
  Write-Error "SMB_BRIDGE_TOKEN is missing in .env"
  exit 1
}

function Send-Response($Client, [int]$Status, [string]$Body) {
  $bytes = [System.Text.Encoding]::UTF8.GetBytes($Body)
  $reason = switch ($Status) {
    200 { "OK" }
    400 { "Bad Request" }
    401 { "Unauthorized" }
    403 { "Forbidden" }
    404 { "Not Found" }
    default { "Error" }
  }
  $header = "HTTP/1.1 $Status $reason`r`nContent-Type: application/json; charset=utf-8`r`nContent-Length: $($bytes.Length)`r`nConnection: close`r`n`r`n"
  $stream = $Client.GetStream()
  $headerBytes = [System.Text.Encoding]::ASCII.GetBytes($header)
  $stream.Write($headerBytes, 0, $headerBytes.Length)
  $stream.Write($bytes, 0, $bytes.Length)
  $stream.Flush()
}

function Test-SafeShareName([string]$Value) {
  return $Value -and $Value -notmatch '[\\/]' -and $Value -ne "." -and $Value -ne ".."
}

function Test-SafeHost([string]$Value) {
  return $Value -match '^[A-Za-z0-9.-]+$' -and $Value -notmatch '\.\.'
}

function Get-UncPath([string]$HostName, [string]$Share, [string]$Folder) {
  if (-not (Test-SafeHost $HostName) -or -not (Test-SafeShareName $Share)) {
    throw "Invalid host or share name."
  }
  $path = "\\$HostName\$Share"
  $cleaned = ($Folder -replace "/", "\").Trim("\")
  if ($cleaned) {
    foreach ($part in $cleaned.Split("\")) {
      if ($part -eq "." -or $part -eq ".." -or $part -eq "") {
        throw "Invalid subfolder."
      }
    }
    $path = Join-Path $path $cleaned
  }
  if ($path -notmatch '^\\\\') {
    throw "Refusing non-UNC path."
  }
  return $path
}

function Read-HttpRequest($Client) {
  $stream = $Client.GetStream()
  $stream.ReadTimeout = 8000
  $buffer = New-Object byte[] 65536
  $memory = New-Object System.IO.MemoryStream
  while ($memory.Length -lt 2MB) {
    $read = $stream.Read($buffer, 0, $buffer.Length)
    if ($read -le 0) { break }
    $memory.Write($buffer, 0, $read)
    $text = [System.Text.Encoding]::UTF8.GetString($memory.ToArray())
    $splitAt = $text.IndexOf("`r`n`r`n")
    if ($splitAt -lt 0) { continue }
    $headerText = $text.Substring(0, $splitAt)
    $body = $text.Substring($splitAt + 4)
    $lines = $headerText -split "`r`n"
    $requestLine = $lines[0]
    $headers = @{}
    foreach ($line in $lines | Select-Object -Skip 1) {
      $colon = $line.IndexOf(":")
      if ($colon -gt 0) {
        $headers[$line.Substring(0, $colon).Trim().ToLowerInvariant()] = $line.Substring($colon + 1).Trim()
      }
    }
    $contentLength = 0
    if ($headers.ContainsKey("content-length")) {
      $contentLength = [int]$headers["content-length"]
    }
    $bodyBytes = [System.Text.Encoding]::UTF8.GetBytes($body)
    while ($bodyBytes.Length -lt $contentLength) {
      $read = $stream.Read($buffer, 0, $buffer.Length)
      if ($read -le 0) { break }
      $more = $bodyBytes.Length
      $all = New-Object byte[] ($more + $read)
      [Array]::Copy($bodyBytes, $all, $more)
      [Array]::Copy($buffer, 0, $all, $more, $read)
      $bodyBytes = $all
    }
    if ($contentLength -gt 0 -and $bodyBytes.Length -gt $contentLength) {
      $trim = New-Object byte[] $contentLength
      [Array]::Copy($bodyBytes, $trim, $contentLength)
      $bodyBytes = $trim
    }
    $parts = $requestLine.Split(" ")
    return @{
      Method  = $parts[0]
      Target  = $parts[1]
      Headers = $headers
      Body    = [System.Text.Encoding]::UTF8.GetString($bodyBytes)
    }
  }
  throw "Could not parse HTTP request."
}

function Get-QueryMap([string]$Target) {
  $map = @{}
  $qIndex = $Target.IndexOf("?")
  if ($qIndex -lt 0) { return $map }
  $query = $Target.Substring($qIndex + 1)
  foreach ($pair in $query.Split("&")) {
    if (-not $pair) { continue }
    $name, $value = $pair.Split("=", 2)
    $map[[Uri]::UnescapeDataString($name)] = if ($null -ne $value) { [Uri]::UnescapeDataString($value) } else { "" }
  }
  return $map
}

$listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Any, $Port)
$listener.Start()
Write-Host "MovieDB SMB bridge on port $Port"

try {
  while ($true) {
    $client = $listener.AcceptTcpClient()
    try {
      $req = Read-HttpRequest $client
      $pathOnly = $req.Target.Split("?")[0]
      if ($req.Method -eq "GET" -and $pathOnly -eq "/health") {
        Send-Response $client 200 '{"ok":true}'
        continue
      }

      $auth = $req.Headers["authorization"]
      if ($auth -ne "Bearer $token") {
        Send-Response $client 401 '{"error":"unauthorized"}'
        continue
      }

      if ($pathOnly -ne "/list") {
        Send-Response $client 404 '{"error":"not found"}'
        continue
      }

      $hostName = $null
      $share = $null
      $folder = ""
      if ($req.Method -eq "POST" -and $req.Body) {
        $json = $req.Body | ConvertFrom-Json
        $hostName = [string]$json.host
        $share = [string]$json.share
        $folder = [string]$json.folder
      } else {
        $query = Get-QueryMap $req.Target
        $hostName = [string]$query.host
        $share = [string]$query.share
        $folder = [string]$query.folder
      }

      $unc = Get-UncPath $hostName $share $folder
      $items = @(Get-ChildItem -LiteralPath $unc -Force -ErrorAction Stop)
      $jsonItems = New-Object System.Collections.Generic.List[string]
      foreach ($item in $items) {
        $size = 0
        if (-not $item.PSIsContainer) { $size = [int64]$item.Length }
        $obj = @{
          name        = [string]$item.Name
          isDirectory = [bool]$item.PSIsContainer
          size        = $size
        }
        $jsonItems.Add(($obj | ConvertTo-Json -Compress -Depth 3))
      }
      $payload = '{"entries":[' + ($jsonItems -join ",") + ']}'
      Send-Response $client 200 $payload
    } catch {
      $msg = $_.Exception.Message.Replace('"', "'")
      Send-Response $client 400 (@{ error = $msg } | ConvertTo-Json -Compress)
    } finally {
      $client.Close()
    }
  }
} finally {
  $listener.Stop()
}
